# 작사 워크스페이스 (React + API)

링크/오디오 기반 컨텍스트를 수집하고, AI로 Verse / Pre-Chorus / Chorus / Bridge 작사 가이드를 생성하는 웹앱입니다.

## 핵심 기능

- React 프론트엔드 (Vite, `localhost:8080`)
- Express API 서버 (`localhost:8090`)
- 모델 공급자 선택: OpenAI / Gemini
- 템플릿 DB 저장소 (로컬 JSON DB)
- 오디오 라이브러리:
  - 폴더 생성/삭제
  - 오디오 업로드/삭제/재생
  - 업로드 오디오 전사 기반 AI 초안 생성
- 데모곡 링크/제목 기반 컨텍스트 수집
  - YouTube: 페이지 정보 + 자막(가능한 경우)
  - 기타 링크(멜론 포함): 페이지 텍스트 수집
- AI 섹션 초안 생성
  - `OPENAI_API_KEY`가 있으면 OpenAI 모델 사용
  - 키가 없으면 휴리스틱 템플릿으로 자동 폴백
- 가사 작성/스냅샷/Word(`.doc`) 내보내기 유지

## 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 환경변수 설정

- `.env.example`를 복사해 `.env` 생성
- `OPENAI_API_KEY` 입력(선택)

3. 개발 서버 실행

```bash
npm run dev
```

4. 접속

- 프론트: <http://localhost:8080>
- API 헬스체크: <http://localhost:8090/api/health>

## 프로덕션 실행

1. 빌드

```bash
npm run build
```

2. 서버 실행 (프론트+API 동시 서빙)

```bash
npm start
```

- 기본 포트: `API_PORT` 또는 `PORT`
- 프로덕션에서는 `JWT_SECRET`을 반드시 설정하세요.

## 외부 배포

### 1) Render 배포

- 저장소에 코드 푸시
- Render에서 `New +` → `Blueprint` 선택
- 루트의 `render.yaml`을 자동 인식해 배포
- 환경변수 추가:
  - `OPENAI_API_KEY` (선택)
  - `GEMINI_API_KEY` (선택)
  - `JWT_SECRET` (필수)

### 2) Railway 배포

- `New Project` → GitHub Repo 연결
- Build Command: `npm run build`
- Start Command: `npm start`
- 환경변수는 Render와 동일하게 설정

### 3) Docker 배포

```bash
docker build -t lyrics-workspace .
docker run -p 8090:8090 --env-file .env lyrics-workspace
```

- 배포 후 접속: `http://<서버도메인>/`
- 헬스체크: `http://<서버도메인>/api/health`

## 환경변수

- `OPENAI_API_KEY`: OpenAI API 키 (선택)
- `OPENAI_MODEL`: 기본 `gpt-4o-mini`
- `OPENAI_TRANSCRIBE_MODEL`: 기본 `whisper-1`
- `GEMINI_API_KEY`: Gemini API 키 (선택)
- `GEMINI_MODEL`: 기본 `gemini-1.5-flash`
- `JWT_SECRET`: 인증 토큰 서명키 (필수)
- `API_PORT` 또는 `PORT`: 기본 `8090`

## 주의사항

- 멜론/유튜브 원문 데이터 접근은 플랫폼 정책, 로그인, 지역 제한에 따라 달라질 수 있습니다.
- YouTube 자막이 비공개/미제공이면 자막 없이 분석될 수 있습니다.
- 실제 상업 제출 전에는 생성 결과를 반드시 사람이 검수하세요.
