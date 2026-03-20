import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { buildWordHtml, sanitizeFileName } from "../lib/exportUtils";

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function WritePage() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [link, setLink] = useState("");
  const [memo, setMemo] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [provider, setProvider] = useState("openai");
  const [hints, setHints] = useState({ mood: "", theme: "", targetEmotion: "", languageStyle: "" });
  const [aiResult, setAiResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [providerStatus, setProviderStatus] = useState({ openai: false, gemini: false });

  useEffect(() => {
    api.get("/api/providers").then(setProviderStatus).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const text = lyrics || "";
    return { lines: text ? text.split(/\r?\n/).length : 0, chars: text.replace(/\r/g, "").length };
  }, [lyrics]);

  const handleAnalyze = async () => {
    if (!link.trim() && !title.trim()) return window.alert("링크 또는 제목을 입력하세요.");
    setError("");
    setIsAnalyzing(true);
    try {
      const data = await api.post("/api/analyze-song", {
        songLink: link.trim(),
        songTitle: title.trim(),
        artist: artist.trim(),
        memo: memo.trim(),
        hints,
        provider,
      });
      setAiResult(data.generatedTemplate || data.summary || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const insertTemplate = (section) => {
    const templates = {
      verse: "\n[Verse]\n- \n- \n- \n- \n",
      pre: "\n[Pre-Chorus]\n- \n- \n",
      chorus: "\n[Chorus]\n- \n- \n- \n- \n",
      bridge: "\n[Bridge]\n- \n- \n",
    };
    setLyrics((prev) => `${prev}${templates[section] || ""}`);
  };

  const handleExportWord = () => {
    const html = buildWordHtml({ title, artist, link, memo, lyrics });
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    downloadBlob(`${sanitizeFileName(title || "lyrics")}.doc`, blob);
  };

  const handleSaveDraft = async () => {
    if (!lyrics.trim()) return window.alert("가사를 먼저 작성해 주세요.");
    await api.post("/api/drafts", { title: title || "제목 없음", lyrics });
    window.alert("임시 저장 완료!");
  };

  const handleSaveTemplate = async () => {
    if (!lyrics.trim()) return window.alert("가사를 먼저 작성해 주세요.");
    await api.post("/api/templates", { title: title || "제목 없음", content: lyrics });
    window.alert("저장소에 저장 완료!");
  };

  return (
    <>
      <section className="card">
        <h2>기본 정보</h2>
        <div className="grid">
          <label>곡 제목<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>아티스트/의뢰자<input value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          <label className="full">데모곡 링크<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." /></label>
          <label className="full">메모<textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
        </div>
      </section>

      <div className="write-split">
        <section className="card write-editor">
          <h2>가사 에디터</h2>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => insertTemplate("verse")}>Verse</button>
            <button type="button" className="ghost" onClick={() => insertTemplate("pre")}>Pre-Chorus</button>
            <button type="button" className="ghost" onClick={() => insertTemplate("chorus")}>Chorus</button>
            <button type="button" className="ghost" onClick={() => insertTemplate("bridge")}>Bridge</button>
          </div>
          <textarea rows={20} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="여기에 가사를 작성하세요..." />
          <div className="stats">
            <span>줄: {stats.lines}</span>
            <span>글자: {stats.chars}</span>
          </div>
          <div className="actions">
            <button type="button" onClick={handleSaveDraft}>임시 저장</button>
            <button type="button" onClick={handleSaveTemplate}>저장소에 저장</button>
            <button type="button" className="ghost" onClick={handleExportWord}>Word 내보내기</button>
          </div>
        </section>

        <aside className="card write-ai">
          <h2>AI 도우미</h2>
          <div className="grid">
            <label>공급자
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </label>
            <label>상태<input readOnly value={`GPT:${providerStatus.openai ? "on" : "off"} Gemini:${providerStatus.gemini ? "on" : "off"}`} /></label>
            <label>무드<input value={hints.mood} onChange={(e) => setHints((h) => ({ ...h, mood: e.target.value }))} /></label>
            <label>주제<input value={hints.theme} onChange={(e) => setHints((h) => ({ ...h, theme: e.target.value }))} /></label>
            <label>감정<input value={hints.targetEmotion} onChange={(e) => setHints((h) => ({ ...h, targetEmotion: e.target.value }))} /></label>
            <label>문체<input value={hints.languageStyle} onChange={(e) => setHints((h) => ({ ...h, languageStyle: e.target.value }))} /></label>
          </div>
          <div className="actions">
            <button type="button" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? "분석 중..." : "AI 초안 생성"}
            </button>
            {aiResult ? (
              <button type="button" className="ghost" onClick={() => setLyrics(aiResult)}>
                에디터에 적용
              </button>
            ) : null}
          </div>
          {error ? <p className="error">{error}</p> : null}
          {aiResult ? <pre className="ai-result">{aiResult}</pre> : null}
        </aside>
      </div>
    </>
  );
}
