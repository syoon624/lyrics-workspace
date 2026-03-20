export function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "lyrics";
}

export function buildWordHtml(form) {
  const title = form.title || "제목 없음";
  const artist = form.artist || "-";
  const link = form.link || "-";
  const memo = form.memo || "-";
  const lyrics = (form.lyrics || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedLyrics = lyrics.replace(/\r?\n/g, "<br/>");
  return `<!doctype html>
<html><head><meta charset="UTF-8" /><title>${title}</title></head>
<body style="font-family:'Malgun Gothic',sans-serif;line-height:1.6;">
<h1>작사 제출본</h1>
<p><strong>곡 제목:</strong> ${title}</p>
<p><strong>아티스트/의뢰자:</strong> ${artist}</p>
<p><strong>데모 링크:</strong> ${link}</p>
<p><strong>메모:</strong> ${memo}</p>
<hr/><h2>가사</h2><p>${escapedLyrics || "(내용 없음)"}</p></body></html>`;
}
