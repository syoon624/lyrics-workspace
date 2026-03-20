import fs from "node:fs";
import path from "node:path";
import { removeAudioMetaByFolder } from "./dbService.js";

const audioRoot = path.resolve("storage", "audio");

function ensureAudioRoot() {
  if (!fs.existsSync(audioRoot)) {
    fs.mkdirSync(audioRoot, { recursive: true });
  }
}

function safeFolderName(name) {
  const value = (name || "default").trim().replace(/[\\/:*?"<>|]/g, "_");
  return value || "default";
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function getAudioRootPath() {
  ensureAudioRoot();
  return audioRoot;
}

export function createFolder(folderName) {
  ensureAudioRoot();
  const safe = safeFolderName(folderName);
  const folderPath = path.join(audioRoot, safe);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return { folderName: safe, folderPath };
}

export function listFolders() {
  ensureAudioRoot();
  return fs
    .readdirSync(audioRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ko"));
}

export function deleteFolder(folderName) {
  ensureAudioRoot();
  const safe = safeFolderName(folderName);
  const folderPath = path.join(audioRoot, safe);
  if (!fs.existsSync(folderPath)) {
    return false;
  }
  if (!isInside(audioRoot, folderPath)) {
    return false;
  }
  fs.rmSync(folderPath, { recursive: true, force: true });
  removeAudioMetaByFolder(safe);
  return true;
}

export function removeAudioFile(absolutePath) {
  ensureAudioRoot();
  if (!isInside(audioRoot, absolutePath)) return false;
  if (!fs.existsSync(absolutePath)) return false;
  fs.rmSync(absolutePath, { force: true });
  return true;
}

export function toRelativeAudioPath(absolutePath) {
  return path.relative(audioRoot, absolutePath).replace(/\\/g, "/");
}

export function toAbsoluteAudioPath(relativePath) {
  return path.join(audioRoot, relativePath);
}

export function sanitizeUploadedFileName(fileName) {
  const ext = path.extname(fileName || "").toLowerCase();
  const base = path.basename(fileName || "audio", ext).replace(/[^\w.-]/g, "_");
  return `${base || "audio"}_${Date.now()}${ext}`;
}
