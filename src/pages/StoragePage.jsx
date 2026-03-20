import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function StoragePage() {
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState("default");
  const [audioFiles, setAudioFiles] = useState([]);
  const [docFiles, setDocFiles] = useState([]);
  const [folderInput, setFolderInput] = useState("");
  const [renameInput, setRenameInput] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadFolders = async () => {
    const data = await api.get("/api/audio/folders");
    setFolders(data.folders || []);
  };

  const loadFiles = async (folder = selected) => {
    const [audio, docs] = await Promise.all([
      api.get(`/api/audio/files?folderName=${encodeURIComponent(folder)}`),
      api.get(`/api/docs/files?folderName=${encodeURIComponent(folder)}`),
    ]);
    setAudioFiles(audio.items || []);
    setDocFiles(docs.items || []);
  };

  useEffect(() => {
    loadFolders().catch(() => {});
  }, []);

  useEffect(() => {
    loadFiles(selected).catch(() => {});
  }, [selected]);

  const handleCreateFolder = async () => {
    if (!folderInput.trim()) return;
    await api.post("/api/audio/folders", { folderName: folderInput.trim() });
    setFolderInput("");
    await loadFolders();
    setSelected(folderInput.trim());
  };

  const handleRenameFolder = async (oldName) => {
    if (!renameInput.trim()) return;
    await api.patch(`/api/audio/folders/${encodeURIComponent(oldName)}`, { newFolderName: renameInput.trim() });
    setRenamingFolder(null);
    setRenameInput("");
    await loadFolders();
    setSelected(renameInput.trim());
  };

  const handleDeleteFolder = async (name) => {
    if (name === "default") return window.alert("default 폴더는 삭제할 수 없습니다.");
    if (!window.confirm(`"${name}" 폴더를 삭제할까요?`)) return;
    await api.delete(`/api/audio/folders/${encodeURIComponent(name)}`);
    await loadFolders();
    setSelected("default");
  };

  const handleUpload = async (event, type) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("folderName", selected);
    try {
      await api.post(type === "doc" ? "/api/docs/upload" : "/api/audio/upload", formData);
      await loadFiles(selected);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>저장소</h2>
      <div className="drive-layout">
        <aside className="drive-sidebar">
          <div className="folder-create">
            <input value={folderInput} onChange={(e) => setFolderInput(e.target.value)} placeholder="새 폴더명" />
            <button type="button" onClick={handleCreateFolder}>+ 폴더</button>
          </div>
          <ul className="folder-list">
            {folders.map((f) => (
              <li key={f}>
                {renamingFolder === f ? (
                  <div className="folder-create">
                    <input value={renameInput} onChange={(e) => setRenameInput(e.target.value)} />
                    <button type="button" onClick={() => handleRenameFolder(f)}>확인</button>
                  </div>
                ) : (
                  <button type="button" className={`folder-item ${f === selected ? "active" : ""}`} onClick={() => setSelected(f)}>
                    <span className="folder-name">{f}</span>
                    <span className="folder-actions">
                      <span onClick={(e) => { e.stopPropagation(); setRenamingFolder(f); setRenameInput(f); }}>이름변경</span>
                      {f !== "default" ? <span className="folder-delete" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f).catch(() => {}); }}>삭제</span> : null}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <section className="drive-content">
          <div className="drive-toolbar">
            <strong>{selected}</strong>
            <label className="upload-label">
              <input type="file" accept="audio/*" onChange={(e) => handleUpload(e, "audio")} disabled={busy} />
              오디오 업로드
            </label>
            <label className="upload-label">
              <input type="file" accept=".doc,.docx,.txt,.pdf" onChange={(e) => handleUpload(e, "doc")} disabled={busy} />
              문서 업로드
            </label>
          </div>

          {audioFiles.length > 0 ? (
            <>
              <h3>오디오</h3>
              <ul className="audio-list">
                {audioFiles.map((a) => (
                  <li key={a.id} className="audio-item">
                    <span>{a.originalName}</span>
                    <audio controls src={a.publicUrl} />
                    <button type="button" className="danger" onClick={async () => { await api.delete(`/api/audio/files/${a.id}`); loadFiles(selected); }}>삭제</button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {docFiles.length > 0 ? (
            <>
              <h3>문서</h3>
              <ul className="audio-list">
                {docFiles.map((d) => (
                  <li key={d.id} className="audio-item">
                    <a href={d.publicUrl} target="_blank" rel="noreferrer">{d.originalName}</a>
                    <button type="button" className="danger" onClick={async () => { await api.delete(`/api/docs/files/${d.id}`); loadFiles(selected); }}>삭제</button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {audioFiles.length === 0 && docFiles.length === 0 ? <p className="hint">이 폴더에 파일이 없습니다.</p> : null}
        </section>
      </div>
    </section>
  );
}
