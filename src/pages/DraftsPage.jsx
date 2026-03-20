import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const data = await api.get("/api/drafts");
    setDrafts(data.items || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    await api.patch(`/api/drafts/${editing.id}`, {
      title: editing.title,
      lyrics: editing.lyrics,
      refAudioId: editing.refAudioId,
    });
    setEditing(null);
    load().catch(() => {});
  };

  const handleDelete = async (id) => {
    if (!window.confirm("삭제할까요?")) return;
    await api.delete(`/api/drafts/${id}`);
    load().catch(() => {});
  };

  if (editing) {
    return (
      <section className="card">
        <h2>초안 편집</h2>
        <div className="grid">
          <label>제목<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></label>
          <label>참조 오디오 ID<input value={editing.refAudioId || ""} onChange={(e) => setEditing({ ...editing, refAudioId: e.target.value })} placeholder="옵션" /></label>
        </div>
        <textarea rows={16} value={editing.lyrics} onChange={(e) => setEditing({ ...editing, lyrics: e.target.value })} />
        <div className="actions">
          <button type="button" onClick={handleSave}>저장</button>
          <button type="button" className="ghost" onClick={() => setEditing(null)}>취소</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>임시 저장 목록</h2>
      <ul className="snapshot-list">
        {drafts.length === 0 ? (
          <li className="snapshot-item">임시 저장본이 없습니다.</li>
        ) : (
          drafts.map((d) => (
            <li key={d.id} className="snapshot-item">
              <div>
                <strong>{d.title}</strong>
                <span className="hint" style={{ marginLeft: 8 }}>
                  {new Date(d.updatedAt).toLocaleString("ko-KR")}
                </span>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => setEditing({ ...d })}>편집</button>
                <button type="button" className="danger" onClick={() => handleDelete(d.id)}>삭제</button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
