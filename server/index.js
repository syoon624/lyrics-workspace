import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { requireAuth, signToken } from "./authMiddleware.js";
import {
  analyzeSongAndGenerateTemplate,
  getProviderStatus,
  transcribeAudioFile,
} from "./analysisService.js";
import {
  createUser,
  deleteDraftById,
  deleteTemplate,
  findUserByEmail,
  findUserById,
  getAudioMeta,
  listAudioMetaByUser,
  listDocsByUser,
  listDraftsByUser,
  listTemplatesByUser,
  removeAudioMeta,
  removeDocMeta,
  renameAudioFolderInMeta,
  saveAudioMeta,
  saveDocMeta,
  saveDraft,
  saveTemplate,
  updateDraftById,
  updateUserProfile,
} from "./dbService.js";
import {
  createFolder,
  deleteFolder,
  getAudioRootPath,
  listFolders,
  removeAudioFile,
  sanitizeUploadedFileName,
  toAbsoluteAudioPath,
  toRelativeAudioPath,
} from "./audioStorageService.js";

const app = express();
const port = Number(process.env.API_PORT || process.env.PORT || 8090);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/media", express.static(getAudioRootPath()));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const folderName = req.body.folderName || "default";
      const { folderPath } = createFolder(folderName);
      cb(null, folderPath);
    },
    filename: (_req, file, cb) => {
      cb(null, sanitizeUploadedFileName(file.originalname));
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, providers: getProviderStatus() });
});

app.get("/api/providers", (_req, res) => {
  res.json(getProviderStatus());
});

app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ message: "이메일과 비밀번호를 입력해 주세요." });
    return;
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ message: "이미 가입된 이메일입니다." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({ email, passwordHash, displayName });
  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = findUserByEmail(email);
  if (!user) {
    res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.displayName } });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) {
    res.status(404).json({ message: "사용자를 찾지 못했습니다." });
    return;
  }
  res.json({ id: user.id, email: user.email, displayName: user.displayName });
});

app.patch("/api/auth/me", requireAuth, (req, res) => {
  const updated = updateUserProfile(req.userId, req.body || {});
  if (!updated) {
    res.status(404).json({ message: "사용자를 찾지 못했습니다." });
    return;
  }
  res.json({ id: updated.id, email: updated.email, displayName: updated.displayName });
});

app.post("/api/analyze-song", requireAuth, async (req, res) => {
  try {
    const result = await analyzeSongAndGenerateTemplate(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: "AI 분석 중 오류가 발생했습니다.",
      detail: error instanceof Error ? error.message : "unknown error",
    });
  }
});

app.get("/api/templates", requireAuth, (_req, res) => {
  res.json({ items: listTemplatesByUser(_req.userId) });
});

app.post("/api/templates", requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.content?.trim()) {
    res.status(400).json({ message: "템플릿 내용이 비어 있습니다." });
    return;
  }
  const saved = saveTemplate({
    userId: req.userId,
    title: body.title,
    content: body.content,
    meta: body.meta || {},
  });
  res.json(saved);
});

app.delete("/api/templates/:id", requireAuth, (req, res) => {
  res.json({ ok: deleteTemplate(req.params.id) });
});

app.get("/api/drafts", requireAuth, (req, res) => {
  res.json({ items: listDraftsByUser(req.userId) });
});

app.post("/api/drafts", requireAuth, (req, res) => {
  const body = req.body || {};
  const saved = saveDraft({
    userId: req.userId,
    title: body.title,
    lyrics: body.lyrics,
    refAudioId: body.refAudioId,
  });
  res.json(saved);
});

app.patch("/api/drafts/:id", requireAuth, (req, res) => {
  const updated = updateDraftById(req.params.id, req.body || {});
  if (!updated) {
    res.status(404).json({ message: "임시 저장본을 찾지 못했습니다." });
    return;
  }
  res.json(updated);
});

app.delete("/api/drafts/:id", requireAuth, (req, res) => {
  res.json({ ok: deleteDraftById(req.params.id) });
});

app.get("/api/audio/folders", requireAuth, (_req, res) => {
  const folders = listFolders();
  if (!folders.includes("default")) {
    createFolder("default");
    folders.unshift("default");
  }
  res.json({ folders });
});

app.post("/api/audio/folders", requireAuth, (req, res) => {
  const created = createFolder(req.body?.folderName || "default");
  res.json({ folderName: created.folderName });
});

app.patch("/api/audio/folders/:folderName", requireAuth, (req, res) => {
  const oldName = req.params.folderName;
  const newName = req.body?.newFolderName;
  if (!newName || !newName.trim()) {
    res.status(400).json({ message: "새 폴더명을 입력해 주세요." });
    return;
  }
  const { folderName: safeName } = createFolder(newName);
  const oldPath = path.join(getAudioRootPath(), oldName);
  const newPath = path.join(getAudioRootPath(), safeName);
  if (fs.existsSync(oldPath) && oldPath !== newPath) {
    const children = fs.readdirSync(oldPath);
    children.forEach((child) => {
      fs.renameSync(path.join(oldPath, child), path.join(newPath, child));
    });
    fs.rmSync(oldPath, { recursive: true, force: true });
  }
  renameAudioFolderInMeta(req.userId, oldName, safeName);
  res.json({ folderName: safeName });
});

app.delete("/api/audio/folders/:folderName", requireAuth, (req, res) => {
  res.json({ ok: deleteFolder(req.params.folderName) });
});

app.get("/api/audio/files", requireAuth, (req, res) => {
  const folderName = String(req.query.folderName || "default");
  const files = listAudioMetaByUser(req.userId).filter((item) => item.folderName === folderName);
  res.json({ items: files });
});

app.post("/api/audio/upload", requireAuth, upload.single("audio"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "업로드 파일이 없습니다." });
    return;
  }
  const folderName = req.body.folderName || "default";
  const item = saveAudioMeta({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: req.userId,
    folderName,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    relativePath: toRelativeAudioPath(req.file.path),
    createdAt: new Date().toISOString(),
  });
  res.json(item);
});

app.post("/api/docs/upload", requireAuth, upload.single("audio"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "업로드 파일이 없습니다." });
    return;
  }
  const folderName = req.body.folderName || "default";
  const item = saveDocMeta({
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: req.userId,
    folderName,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    relativePath: toRelativeAudioPath(req.file.path),
    createdAt: new Date().toISOString(),
  });
  res.json(item);
});

app.get("/api/docs/files", requireAuth, (req, res) => {
  const folderName = String(req.query.folderName || "default");
  const files = listDocsByUser(req.userId).filter((item) => item.folderName === folderName);
  res.json({ items: files });
});

app.delete("/api/docs/files/:id", requireAuth, (req, res) => {
  const target = removeDocMeta(req.params.id);
  if (!target) {
    res.json({ ok: false });
    return;
  }
  removeAudioFile(toAbsoluteAudioPath(target.relativePath));
  res.json({ ok: true });
});

app.delete("/api/audio/files/:id", requireAuth, (req, res) => {
  const target = removeAudioMeta(req.params.id);
  if (!target) {
    res.json({ ok: false });
    return;
  }
  removeAudioFile(toAbsoluteAudioPath(target.relativePath));
  res.json({ ok: true });
});

app.post("/api/audio/analyze/:id", requireAuth, async (req, res) => {
  try {
    const audio = getAudioMeta(req.params.id);
    if (!audio) {
      res.status(404).json({ message: "오디오 파일을 찾지 못했습니다." });
      return;
    }
    const absolutePath = toAbsoluteAudioPath(audio.relativePath);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ message: "오디오 실제 파일이 없습니다." });
      return;
    }
    const transcriptInfo = await transcribeAudioFile(absolutePath);
    const body = req.body || {};
    const result = await analyzeSongAndGenerateTemplate({
      songLink: "",
      songTitle: body.songTitle || path.parse(audio.originalName).name,
      artist: body.artist || "",
      memo: body.memo || "",
      hints: body.hints || {},
      provider: body.provider || "openai",
      extraContext: `오디오 전사 텍스트:\n${transcriptInfo.transcript}`,
    });
    res.json({ ...result, audioId: audio.id, transcriptLength: transcriptInfo.transcript.length });
  } catch (error) {
    res.status(500).json({
      message: "오디오 분석 중 오류가 발생했습니다.",
      detail: error instanceof Error ? error.message : "unknown error",
    });
  }
});

// 프로덕션용 SPA 폴백
const distDir = path.resolve("dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`[lyrics-api] listening on http://localhost:${port}`);
});
