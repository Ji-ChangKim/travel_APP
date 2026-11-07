# TripPrint

여행 계획을 만들고 동행자와 일정을 관리하며, 다녀온 기록 중 직접 선택한 내용만 공유하는 모바일·웹 서비스입니다.

---

## 1. 기술 스택 및 현재 기준

- **모바일·웹 앱 (`apps/mobile`)**: Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript · TanStack Query · Zustand
- **백엔드 API (`apps/api`)**: Cloudflare Workers + Hono · Cloudflare D1(SQLite) · 비공개 Cloudflare R2 · Better Auth
- **공통 패키지 (`packages/`)**: `@wherego/domain`, `@wherego/validation`, `@wherego/api-client`
- **디자인 기준**: [디자인 시스템](<docs/02. 디자인/00. 공통규격/디자인시스템.md>) 및 [단일 디자인 토큰](<docs/02. 디자인/00. 공통규격/design-tokens.json>)
- **버전 기준**: [ver.text](ver.text)

---

## 2. 개발 실행 및 검증 명령

Windows 환경에서 Android 에뮬레이터와 로컬 서버를 한 번에 실행할 때는 [start-android.cmd](start-android.cmd)를 사용합니다. 상세 절차는 [Android 개발 실행 안내](<docs/03. 개발/03. 개발환경/Android_개발실행_안내.md>)를 따릅니다.

| 명령                       | 설명                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| `npm run check`            | 문서·디자인 대비·리소스·아키텍처·네비게이션·타입·린트·포맷 통합 검사 |
| `npm run test:auth`        | 인증·오류·멱등성·디자인 토큰 계약 단위 테스트                        |
| `npm run test:foundation`  | 백엔드 API·D1 계약 테스트                                            |
| `npm run test:release`     | 빌드·배포 설정 및 산출물 검증                                        |
| `npm run mobile:build:web` | 웹 정적 빌드 생성                                                    |
| `npm run api:dev`          | 로컬 API 개발 서버 실행                                              |

---

## 3. 저장소 구조

```text
apps/mobile/src/       모바일·웹 화면, 공통 UI 컴포넌트, 상태 및 서비스
apps/mobile/assets/    브랜드, 글꼴, 아이콘, 목적지 이미지 자산
apps/api/src/          백엔드 API, 인증, 미디어, 커뮤니티 서버 로직
apps/api/migrations/   Cloudflare D1 SQL 마이그레이션
packages/domain/       공통 도메인 모델
packages/validation/   공통 입력·응답 검증 스키마
packages/api-client/   공통 HTTP 클라이언트
scripts/               android·build·checks·design·qa·release·shared 도구
tests/                 단위·통합·웹 E2E 테스트 및 픽스처
docs/                  현행 MVP 단일 기준 문서
```

---

## 4. 핵심 문서 바로가기

- **문서 안내**: [docs/README.md](docs/README.md) · [문서 관리 규칙](<docs/00. 문서안내/문서_관리규칙.md>)
- **기획·기능**: [서비스 개요](<docs/01. 서비스기획/00. 서비스정의/서비스_개요.md>) · [MVP 기능 규격](<docs/01. 서비스기획/01. 기능정의/MVP_기능규격.md>)
- **디자인·UI**: [디자인 시스템](<docs/02. 디자인/00. 공통규격/디자인시스템.md>) · [디자인 토큰](<docs/02. 디자인/00. 공통규격/design-tokens.json>) · [헤더·GNB 규격](<docs/02. 디자인/00. 공통규격/헤더GNB_규격.md>)
- **개발·DB**: [저장소 아키텍처](<docs/03. 개발/00. 구조설계/저장소_아키텍처규격.md>) · [앱·서버 API 계약](<docs/03. 개발/01. API계약/앱서버_API계약.md>) · [DB·객체 사전](<docs/03. 개발/02. 데이터정의/DB_객체사전.txt>)
- **배포·운영**: [서버·웹 배포 절차](<docs/04. 운영/01. 배포절차/서버웹_배포절차.md>) · [Android 빌드 절차](<docs/04. 운영/01. 배포절차/Android_GitHub빌드절차.md>)
