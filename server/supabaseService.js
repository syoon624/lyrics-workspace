import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const audioBucket = process.env.SUPABASE_STORAGE_BUCKET || "lyrics-files";

if (!url || !serviceRoleKey) {
  // Server can boot, but storage/db APIs will fail with clearer errors.
  console.warn("[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(url || "https://invalid.local", serviceRoleKey || "invalid");

function requireSupabase() {
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getProviderBucket() {
  return audioBucket;
}

export function buildPublicUrl(path) {
  const { data } = supabase.storage.from(audioBucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function createUser({ email, passwordHash, displayName }) {
  requireSupabase();
  const user = {
    id: createId("usr"),
    email: String(email).toLowerCase(),
    password_hash: passwordHash,
    display_name: displayName || "사용자",
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("users").insert(user);
  if (error) throw error;
  return { id: user.id, email: user.email, displayName: user.display_name };
}

export async function findUserByEmail(email) {
  requireSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", String(email).toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    passwordHash: data.password_hash,
    displayName: data.display_name,
  };
}

export async function findUserById(userId) {
  requireSupabase();
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, email: data.email, displayName: data.display_name };
}

export async function updateUserProfile(userId, patch) {
  requireSupabase();
  const updates = {
    display_name: patch.displayName,
    email: patch.email ? String(patch.email).toLowerCase() : undefined,
  };
  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  if (error) throw error;
  return findUserById(userId);
}

export async function ensureDefaultFolder(userId) {
  requireSupabase();
  const { data } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "default")
    .maybeSingle();
  if (!data) {
    await supabase.from("folders").insert({
      id: createId("fld"),
      user_id: userId,
      name: "default",
      created_at: new Date().toISOString(),
    });
  }
}

export async function listFoldersByUser(userId) {
  requireSupabase();
  await ensureDefaultFolder(userId);
  const { data, error } = await supabase
    .from("folders")
    .select("name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((it) => it.name);
}

export async function createFolder(userId, folderName) {
  requireSupabase();
  const safe = String(folderName || "default").trim() || "default";
  const { data } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", safe)
    .maybeSingle();
  if (!data) {
    await supabase.from("folders").insert({
      id: createId("fld"),
      user_id: userId,
      name: safe,
      created_at: new Date().toISOString(),
    });
  }
  return safe;
}

export async function deleteFolder(userId, folderName) {
  requireSupabase();
  if (folderName === "default") return false;
  const audioItems = await listAudioMetaByUser(userId, folderName);
  const docItems = await listDocsByUser(userId, folderName);
  for (const item of [...audioItems, ...docItems]) {
    await deleteStorageObject(item.storagePath);
  }
  await supabase.from("audios").delete().eq("user_id", userId).eq("folder_name", folderName);
  await supabase.from("docs").delete().eq("user_id", userId).eq("folder_name", folderName);
  const { error } = await supabase.from("folders").delete().eq("user_id", userId).eq("name", folderName);
  if (error) throw error;
  return true;
}

export async function renameFolder(userId, oldName, newName) {
  requireSupabase();
  const next = String(newName || "").trim();
  if (!next) throw new Error("새 폴더명을 입력해 주세요.");
  await createFolder(userId, next);
  const audioItems = await listAudioMetaByUser(userId, oldName);
  for (const item of audioItems) {
    const nextPath = item.storagePath.replace(`/${oldName}/`, `/${next}/`);
    await moveStorageObject(item.storagePath, nextPath);
    await supabase
      .from("audios")
      .update({
        folder_name: next,
        storage_path: nextPath,
        public_url: buildPublicUrl(nextPath),
      })
      .eq("id", item.id);
  }
  const docs = await listDocsByUser(userId, oldName);
  for (const item of docs) {
    const nextPath = item.storagePath.replace(`/${oldName}/`, `/${next}/`);
    await moveStorageObject(item.storagePath, nextPath);
    await supabase
      .from("docs")
      .update({
        folder_name: next,
        storage_path: nextPath,
        public_url: buildPublicUrl(nextPath),
      })
      .eq("id", item.id);
  }
  await supabase.from("folders").delete().eq("user_id", userId).eq("name", oldName);
  return next;
}

export async function uploadFileToStorage(storagePath, buffer, mimeType) {
  requireSupabase();
  const { error } = await supabase.storage
    .from(audioBucket)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
  if (error) throw error;
  return buildPublicUrl(storagePath);
}

export async function deleteStorageObject(storagePath) {
  requireSupabase();
  const { error } = await supabase.storage.from(audioBucket).remove([storagePath]);
  if (error) throw error;
}

export async function moveStorageObject(fromPath, toPath) {
  requireSupabase();
  const { error } = await supabase.storage.from(audioBucket).move(fromPath, toPath);
  if (error) throw error;
}

export async function saveAudioMeta({ userId, folderName, originalName, mimeType, size, storagePath }) {
  requireSupabase();
  const item = {
    id: createId("aud"),
    user_id: userId,
    folder_name: folderName,
    original_name: originalName,
    mime_type: mimeType,
    size,
    storage_path: storagePath,
    public_url: buildPublicUrl(storagePath),
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("audios").insert(item);
  if (error) throw error;
  return mapFileMeta(item);
}

export async function listAudioMetaByUser(userId, folderName) {
  requireSupabase();
  let query = supabase.from("audios").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (folderName) query = query.eq("folder_name", folderName);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapFileMeta);
}

export async function getAudioMeta(audioId) {
  requireSupabase();
  const { data, error } = await supabase.from("audios").select("*").eq("id", audioId).maybeSingle();
  if (error) throw error;
  return data ? mapFileMeta(data) : null;
}

export async function removeAudioMeta(audioId) {
  requireSupabase();
  const current = await getAudioMeta(audioId);
  if (!current) return null;
  const { error } = await supabase.from("audios").delete().eq("id", audioId);
  if (error) throw error;
  return current;
}

export async function saveDocMeta({ userId, folderName, originalName, mimeType, size, storagePath }) {
  requireSupabase();
  const item = {
    id: createId("doc"),
    user_id: userId,
    folder_name: folderName,
    original_name: originalName,
    mime_type: mimeType,
    size,
    storage_path: storagePath,
    public_url: buildPublicUrl(storagePath),
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("docs").insert(item);
  if (error) throw error;
  return mapFileMeta(item);
}

export async function listDocsByUser(userId, folderName) {
  requireSupabase();
  let query = supabase.from("docs").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (folderName) query = query.eq("folder_name", folderName);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapFileMeta);
}

export async function removeDocMeta(docId) {
  requireSupabase();
  const { data, error } = await supabase.from("docs").select("*").eq("id", docId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await supabase.from("docs").delete().eq("id", docId);
  return mapFileMeta(data);
}

export async function saveTemplate({ userId, title, content, meta }) {
  requireSupabase();
  const item = {
    id: createId("tpl"),
    user_id: userId,
    title: title || "제목 없음",
    content: content || "",
    meta: meta || {},
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("templates").insert(item);
  if (error) throw error;
  return mapTemplate(item);
}

export async function listTemplatesByUser(userId) {
  requireSupabase();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapTemplate);
}

export async function deleteTemplate(templateId) {
  requireSupabase();
  const { error } = await supabase.from("templates").delete().eq("id", templateId);
  if (error) throw error;
  return true;
}

export async function saveDraft({ userId, title, lyrics, refAudioId }) {
  requireSupabase();
  const now = new Date().toISOString();
  const item = {
    id: createId("drf"),
    user_id: userId,
    title: title || "제목 없음",
    lyrics: lyrics || "",
    ref_audio_id: refAudioId || "",
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from("drafts").insert(item);
  if (error) throw error;
  return mapDraft(item);
}

export async function listDraftsByUser(userId) {
  requireSupabase();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDraft);
}

export async function updateDraftById(draftId, patch) {
  requireSupabase();
  const updates = {
    title: patch.title,
    lyrics: patch.lyrics,
    ref_audio_id: patch.refAudioId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("drafts").update(updates).eq("id", draftId);
  if (error) throw error;
  const { data } = await supabase.from("drafts").select("*").eq("id", draftId).maybeSingle();
  return data ? mapDraft(data) : null;
}

export async function deleteDraftById(draftId) {
  requireSupabase();
  const { error } = await supabase.from("drafts").delete().eq("id", draftId);
  if (error) throw error;
  return true;
}

function mapTemplate(item) {
  return {
    id: item.id,
    userId: item.user_id,
    title: item.title,
    content: item.content,
    meta: item.meta || {},
    createdAt: item.created_at,
  };
}

function mapDraft(item) {
  return {
    id: item.id,
    userId: item.user_id,
    title: item.title,
    lyrics: item.lyrics,
    refAudioId: item.ref_audio_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function mapFileMeta(item) {
  return {
    id: item.id,
    userId: item.user_id,
    folderName: item.folder_name,
    originalName: item.original_name,
    mimeType: item.mime_type,
    size: item.size,
    storagePath: item.storage_path,
    publicUrl: item.public_url,
    createdAt: item.created_at,
  };
}
