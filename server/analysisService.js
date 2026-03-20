import fs from "node:fs";
import axios from "axios";
import * as cheerio from "cheerio";
import { fetchTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openaiTranscribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const geminiClient = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

function isYoutubeUrl(url) {
  return /youtu\.be|youtube\.com/.test(url);
}

function extractYoutubeVideoId(input) {
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "");
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

export function getProviderStatus() {
  return {
    openai: !!openaiClient,
    gemini: !!geminiClient,
    openaiModel,
    geminiModel,
  };
}

async function fetchPageText(url) {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  const $ = cheerio.load(response.data);
  const title = $("title").text().trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  return { title, bodyText };
}

async function collectSongContext({ songLink, songTitle, artist, memo, extraContext }) {
  if (!songLink && !songTitle) {
    return {
      sourceType: "manual",
      sourceTitle: songTitle || "",
      collectedText: [songTitle, artist, memo, extraContext].filter(Boolean).join(" "),
    };
  }

  if (songLink && isYoutubeUrl(songLink)) {
    const videoId = extractYoutubeVideoId(songLink);
    let transcriptText = "";
    if (videoId) {
      try {
        const transcript = await fetchTranscript(videoId, { lang: "ko" });
        transcriptText = transcript.map((item) => item.text).join(" ");
      } catch {
        transcriptText = "";
      }
    }

    let titleFromPage = "";
    try {
      const page = await fetchPageText(songLink);
      titleFromPage = page.title;
    } catch {
      titleFromPage = songTitle || "";
    }

    return {
      sourceType: "youtube",
      sourceTitle: titleFromPage || songTitle || "YouTube",
      collectedText: [titleFromPage, songTitle, artist, memo, transcriptText, extraContext]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (songLink) {
    try {
      const page = await fetchPageText(songLink);
      const sampled = page.bodyText.slice(0, 8000);
      return {
        sourceType: "web-link",
        sourceTitle: page.title || songTitle || "링크 기반",
        collectedText: [page.title, songTitle, artist, memo, sampled, extraContext]
          .filter(Boolean)
          .join("\n"),
      };
    } catch {
      return {
        sourceType: "manual-fallback",
        sourceTitle: songTitle || "수동 입력",
        collectedText: [songTitle, artist, memo, extraContext].filter(Boolean).join("\n"),
      };
    }
  }

  return {
    sourceType: "manual",
    sourceTitle: songTitle || "",
    collectedText: [songTitle, artist, memo, extraContext].filter(Boolean).join("\n"),
  };
}

function buildHeuristicTemplate({ songTitle, artist, hints, contextText }) {
  const title = songTitle || "제목 없음";
  const singer = artist || "아티스트 미정";
  const mood = hints?.mood || "감성적";
  const theme = hints?.theme || "관계의 변화";
  const emotion = hints?.targetEmotion || "여운";
  const style = hints?.languageStyle || "한국어 구어체";
  const contextPreview = (contextText || "").slice(0, 160).replace(/\s+/g, " ");

  return `[Verse]
- ${title}의 첫 장면을 ${mood} 분위기로 시작한다
- 화자는 ${theme}를 직접 설명하지 않고 이미지로 암시한다
- ${singer}의 톤에 맞춰 ${style} 리듬을 짧게 끊는다
- (참고 단서) ${contextPreview || "제공된 단서 기반 확장"}

[Pre-Chorus]
- 감정을 밀어올려 후렴 진입 직전 긴장을 만든다
- 핵심 키워드 1~2개를 반복해 청자 집중을 만든다

[Chorus]
- 한 줄 훅을 먼저 배치하고 변형 반복으로 기억점을 만든다
- 목표 감정 ${emotion}이 가장 또렷하게 느껴지도록 단어를 단순화한다
- 고음 구간을 가정해 모음이 길게 열리는 표현을 넣는다

[Bridge]
- 앞 구간과 대비되는 시점/장면 전환으로 서사를 확장한다
- 결말은 단정하지 않고 반복으로 이어지게 열린 문장으로 마무리한다`;
}

function buildPrompt({ songTitle, artist, hints, context }) {
  return `
너는 한국 대중음악 작사가를 돕는 어시스턴트다.
아래 정보를 분석해서 Verse / Pre-Chorus / Chorus / Bridge의 "작사 가이드 초안"을 만들어라.

요구사항:
1) 실제 가사 완성본이 아니라, 섹션별 작사 방향과 샘플 문장 중심.
2) 한국어로 작성.
3) 각 섹션은 2~4개 불릿.
4) 마지막에 한 줄 요약을 제공.
5) 응답 형식은 JSON:
{
  "summary": "...",
  "generatedTemplate": "..."
}

[입력 정보]
- 곡 제목: ${songTitle || ""}
- 아티스트/의뢰자: ${artist || ""}
- 무드: ${hints?.mood || ""}
- 주제: ${hints?.theme || ""}
- 목표 감정: ${hints?.targetEmotion || ""}
- 문체: ${hints?.languageStyle || ""}

[수집 컨텍스트]
${(context || "").slice(0, 12000)}
`;
}

async function generateWithOpenAI({ songTitle, artist, hints, context }) {
  if (!openaiClient) return null;
  const completion = await openaiClient.chat.completions.create({
    model: openaiModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "너는 작사 가이드 생성 도우미다." },
      { role: "user", content: buildPrompt({ songTitle, artist, hints, context }) },
    ],
  });
  const raw = completion.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function generateWithGemini({ songTitle, artist, hints, context }) {
  if (!geminiClient) return null;
  const model = geminiClient.getGenerativeModel({ model: geminiModel });
  const result = await model.generateContent(buildPrompt({ songTitle, artist, hints, context }));
  const text = result.response.text();
  try {
    const maybeJson = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

async function generateByProvider({ provider, songTitle, artist, hints, context }) {
  if (provider === "gemini") {
    const gemini = await generateWithGemini({ songTitle, artist, hints, context });
    if (gemini) return { result: gemini, model: geminiModel, provider: "gemini" };
  }
  if (provider === "openai" || provider !== "gemini") {
    const openai = await generateWithOpenAI({ songTitle, artist, hints, context });
    if (openai) return { result: openai, model: openaiModel, provider: "openai" };
  }
  return { result: null, model: "heuristic-fallback", provider: "fallback" };
}

export async function transcribeAudioFile(filePath) {
  if (!openaiClient) {
    return { transcript: "", model: "unavailable", note: "OPENAI_API_KEY 미설정" };
  }
  const transcription = await openaiClient.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: openaiTranscribeModel,
    response_format: "text",
  });
  const text = typeof transcription === "string" ? transcription : transcription?.text || "";
  return {
    transcript: text,
    model: openaiTranscribeModel,
    note: text ? "오디오 텍스트 추출 완료" : "텍스트 추출 결과 없음",
  };
}

export async function analyzeSongAndGenerateTemplate(payload) {
  const { songLink, songTitle, artist, memo, hints, provider, extraContext } = payload;
  const context = await collectSongContext({
    songLink,
    songTitle,
    artist,
    memo,
    extraContext,
  });

  const ai = await generateByProvider({
    provider,
    songTitle,
    artist,
    hints,
    context: context.collectedText,
  });

  const generatedTemplate =
    ai.result?.generatedTemplate ||
    buildHeuristicTemplate({ songTitle, artist, hints, contextText: context.collectedText });
  const summary =
    ai.result?.summary ||
    `${context.sourceType} 기반 단서를 사용해 섹션별 작사 초안을 생성했습니다.`;

  return {
    summary,
    generatedTemplate,
    sourceType: context.sourceType,
    sourceTitle: context.sourceTitle,
    collectedTextLength: context.collectedText.length,
    model: ai.model,
    provider: ai.provider,
  };
}
