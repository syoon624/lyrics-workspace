import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
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
  createFolder,
  createUser,
  deleteDraftById,
  deleteFolder,
  deleteStorageObject,
  deleteTemplate,
  findUserByEmail,
  findUserById,
  getAudioMeta,
  listAudioMetaByUser,
  listDocsByUser,
  listDraftsByUser,
  listFoldersByUser,
  listTemplatesByUser,
  removeAudioMeta,
  removeDocMeta,
  renameFolder,
  saveAudioMeta,
  saveDocMeta,
  saveDraft,
  saveTemplate,
  updateDraftById,
  updateUserProfile,
  uploadFileToStorage,
} from "./supabaseService.js";

const app = express();
const port = Number(process.env.API_PORT || process.env.PORT || 8090);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
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
  const exists = await findUserByEmail(email);
  if (exists) {
    res.status(409).json({ message: "이미 가입된 이메일입니다." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ email, passwordHash, displayName });
  const token = signToken(user.id);
  res.json({ token, user });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await findUserByEmail(email);
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

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.userId);
  if (!user) {
    res.status(404).json({ message: "사용자를 찾지 못했습니다." });
    return;
  }
  res.json(user);
});

app.patch("/api/auth/me", requireAuth, async (req, res) => {
  const updated = await updateUserProfile(req.userId, req.body || {});
  if (!updated) {
    res.status(404).json({ message: "사용자를 찾지 못했습니다." });
    return;
  }
  res.json(updated);
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

app.get("/api/templates", requireAuth, async (req, res) => {
  res.json({ items: await listTemplatesByUser(req.userId) });
});

app.post("/api/templates", requireAuth, async (req, res) => {
  const body = req.body || {};
  if (!body.content?.trim()) {
    res.status(400).json({ message: "템플릿 내용이 비어 있습니다." });
    return;
  }
  const saved = await saveTemplate({
    userId: req.userId,
    title: body.title,
    content: body.content,
    meta: body.meta || {},
  });
  res.json(saved);
});

app.delete("/api/templates/:id", requireAuth, async (req, res) => {
  res.json({ ok: await deleteTemplate(req.params.id) });
});

app.get("/api/drafts", requireAuth, async (req, res) => {
  res.json({ items: await listDraftsByUser(req.userId) });
});

app.post("/api/drafts", requireAuth, async (req, res) => {
  const body = req.body || {};
  const saved = await saveDraft({
    userId: req.userId,
    title: body.title,
    lyrics: body.lyrics,
    refAudioId: body.refAudioId,
  });
  res.json(saved);
});

app.patch("/api/drafts/:id", requireAuth, async (req, res) => {
  const updated = await updateDraftById(req.params.id, req.body || {});
  if (!updated) {
    res.status(404).json({ message: "임시 저장본을 찾지 못했습니다." });
    return;
  }
  res.json(updated);
});

app.delete("/api/drafts/:id", requireAuth, async (req, res) => {
  res.json({ ok: await deleteDraftById(req.params.id) });
});

app.get("/api/audio/folders", requireAuth, async (req, res) => {
  res.json({ folders: await listFoldersByUser(req.userId) });
});

app.post("/api/audio/folders", requireAuth, async (req, res) => {
  const folderName = await createFolder(req.userId, req.body?.folderName || "default");
  res.json({ folderName });
});

app.patch("/api/audio/folders/:folderName", requireAuth, async (req, res) => {
  const folderName = await renameFolder(req.userId, req.params.folderName, req.body?.newFolderName);
  res.json({ folderName });
});

app.delete("/api/audio/folders/:folderName", requireAuth, async (req, res) => {
  res.json({ ok: await deleteFolder(req.userId, req.params.folderName) });
});

app.get("/api/audio/files", requireAuth, async (req, res) => {
  const folderName = String(req.query.folderName || "default");
  const files = await listAudioMetaByUser(req.userId, folderName);
  res.json({ items: files });
});

app.post("/api/audio/upload", requireAuth, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "업로드 파일이 없습니다." });
    return;
  }
  const folderName = req.body.folderName || "default";
  await createFolder(req.userId, folderName);
  const storagePath = `${req.userId}/${folderName}/audio_${Date.now()}_${req.file.originalname}`;
  await uploadFileToStorage(storagePath, req.file.buffer, req.file.mimetype);
  const item = await saveAudioMeta({
    userId: req.userId,
    folderName,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath,
  });
  res.json(item);
});

app.post("/api/docs/upload", requireAuth, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "업로드 파일이 없습니다." });
    return;
  }
  const folderName = req.body.folderName || "default";
  await createFolder(req.userId, folderName);
  const storagePath = `${req.userId}/${folderName}/doc_${Date.now()}_${req.file.originalname}`;
  await uploadFileToStorage(storagePath, req.file.buffer, req.file.mimetype);
  const item = await saveDocMeta({
    userId: req.userId,
    folderName,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath,
  });
  res.json(item);
});

app.get("/api/docs/files", requireAuth, async (req, res) => {
  const folderName = String(req.query.folderName || "default");
  const files = await listDocsByUser(req.userId, folderName);
  res.json({ items: files });
});

app.delete("/api/docs/files/:id", requireAuth, async (req, res) => {
  const target = await removeDocMeta(req.params.id);
  if (!target) {
    res.json({ ok: false });
    return;
  }
  await deleteStorageObject(target.storagePath);
  res.json({ ok: true });
});

app.delete("/api/audio/files/:id", requireAuth, async (req, res) => {
  const target = await removeAudioMeta(req.params.id);
  if (!target) {
    res.json({ ok: false });
    return;
  }
  await deleteStorageObject(target.storagePath);
  res.json({ ok: true });
});

app.post("/api/audio/analyze/:id", requireAuth, async (req, res) => {
  try {
    const audio = await getAudioMeta(req.params.id);
    if (!audio) {
      res.status(404).json({ message: "오디오 파일을 찾지 못했습니다." });
      return;
    }
    const tempFilePath = path.join(os.tmpdir(), `${audio.id}_${Date.now()}.bin`);
    const downloaded = await fetch(audio.publicUrl);
    const arrayBuffer = await downloaded.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));
    const transcriptInfo = await transcribeAudioFile(tempFilePath);
    fs.rmSync(tempFilePath, { force: true });

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
