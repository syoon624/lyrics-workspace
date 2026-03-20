import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("data");
const dbPath = path.join(dataDir, "db.json");

const initialData = {
  users: [],
  templates: [],
  audios: [],
  docs: [],
  drafts: [],
};

function ensureDbFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), "utf8");
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(dbPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      audios: Array.isArray(parsed.audios) ? parsed.audios : [],
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
    };
  } catch {
    return { ...initialData };
  }
}

function writeDb(data) {
  ensureDbFile();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listTemplates() {
  const db = readDb();
  return db.templates;
}

export function listTemplatesByUser(userId) {
  return listTemplates()
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function saveTemplate({ userId, title, content, meta }) {
  const db = readDb();
  const item = {
    id: createId("tpl"),
    userId,
    title: title || "제목 없음",
    content: content || "",
    meta: meta || {},
    createdAt: new Date().toISOString(),
  };
  db.templates.unshift(item);
  writeDb(db);
  return item;
}

export function deleteTemplate(templateId) {
  const db = readDb();
  const before = db.templates.length;
  db.templates = db.templates.filter((item) => item.id !== templateId);
  writeDb(db);
  return before !== db.templates.length;
}

export function listAudioMeta() {
  const db = readDb();
  return db.audios;
}

export function listAudioMetaByUser(userId) {
  return listAudioMeta()
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function saveAudioMeta(audio) {
  const db = readDb();
  db.audios.unshift(audio);
  writeDb(db);
  return audio;
}

export function removeAudioMeta(audioId) {
  const db = readDb();
  const target = db.audios.find((item) => item.id === audioId);
  db.audios = db.audios.filter((item) => item.id !== audioId);
  writeDb(db);
  return target || null;
}

export function removeAudioMetaByFolder(folderName) {
  const db = readDb();
  const removed = db.audios.filter((item) => item.folderName === folderName);
  db.audios = db.audios.filter((item) => item.folderName !== folderName);
  writeDb(db);
  return removed;
}

export function getAudioMeta(audioId) {
  const db = readDb();
  return db.audios.find((item) => item.id === audioId) || null;
}

export function renameAudioFolderInMeta(userId, oldFolderName, newFolderName) {
  const db = readDb();
  db.audios = db.audios.map((item) => {
    if (item.userId !== userId) return item;
    if (item.folderName !== oldFolderName) return item;
    return {
      ...item,
      folderName: newFolderName,
      relativePath: item.relativePath.replace(`${oldFolderName}/`, `${newFolderName}/`),
    };
  });
  db.docs = db.docs.map((item) => {
    if (item.userId !== userId) return item;
    if (item.folderName !== oldFolderName) return item;
    return {
      ...item,
      folderName: newFolderName,
      relativePath: item.relativePath.replace(`${oldFolderName}/`, `${newFolderName}/`),
    };
  });
  writeDb(db);
}

export function createUser({ email, passwordHash, displayName }) {
  const db = readDb();
  const user = {
    id: createId("usr"),
    email: String(email).toLowerCase(),
    passwordHash,
    displayName: displayName || "사용자",
    createdAt: new Date().toISOString(),
  };
  db.users.unshift(user);
  writeDb(db);
  return user;
}

export function findUserByEmail(email) {
  const db = readDb();
  return db.users.find((item) => item.email === String(email).toLowerCase()) || null;
}

export function findUserById(userId) {
  const db = readDb();
  return db.users.find((item) => item.id === userId) || null;
}

export function updateUserProfile(userId, patch) {
  const db = readDb();
  db.users = db.users.map((item) =>
    item.id === userId
      ? {
          ...item,
          displayName: patch.displayName ?? item.displayName,
          email: patch.email ? String(patch.email).toLowerCase() : item.email,
        }
      : item,
  );
  writeDb(db);
  return findUserById(userId);
}

export function saveDraft({ userId, title, lyrics, refAudioId }) {
  const db = readDb();
  const item = {
    id: createId("drf"),
    userId,
    title: title || "제목 없음",
    lyrics: lyrics || "",
    refAudioId: refAudioId || "",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.drafts.unshift(item);
  writeDb(db);
  return item;
}

export function listDraftsByUser(userId) {
  const db = readDb();
  return db.drafts
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function updateDraftById(draftId, patch) {
  const db = readDb();
  db.drafts = db.drafts.map((item) =>
    item.id === draftId
      ? {
          ...item,
          title: patch.title ?? item.title,
          lyrics: patch.lyrics ?? item.lyrics,
          refAudioId: patch.refAudioId ?? item.refAudioId,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  writeDb(db);
  return db.drafts.find((item) => item.id === draftId) || null;
}

export function deleteDraftById(draftId) {
  const db = readDb();
  const before = db.drafts.length;
  db.drafts = db.drafts.filter((item) => item.id !== draftId);
  writeDb(db);
  return before !== db.drafts.length;
}

export function saveDocMeta(doc) {
  const db = readDb();
  db.docs.unshift(doc);
  writeDb(db);
  return doc;
}

export function listDocsByUser(userId) {
  const db = readDb();
  return db.docs
    .filter((item) => item.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function removeDocMeta(docId) {
  const db = readDb();
  const target = db.docs.find((item) => item.id === docId) || null;
  db.docs = db.docs.filter((item) => item.id !== docId);
  writeDb(db);
  return target;
}
