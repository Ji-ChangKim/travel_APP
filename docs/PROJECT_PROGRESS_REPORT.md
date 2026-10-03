# WHEREGO 프로젝트 진행 상태 보고서

## 2026-10-03 Android MVP APK로 목표 조정

최종 로컬 검증: npm run check 통과, 인증 11개·배포/MVP 설정 10개·SQL/API 37개·브라우저 6개(총 64개) 통과. 최신 일반 웹 산출물 검사와 staging Worker dry-run도 통과했다. 실제 계정·서명된 APK·실기기 인수는 미완료다.

추가 확인: native config introspection에서 Android package·travelapp 복귀 스킴·마이크 권한 제거와 Camera 라이브러리 선언을 확인했다. Android prebuild는 로컬 공식 템플릿으로도 종료 코드 1로 중단되어 완료로 표시하지 않는다. 서버 앱 브라우저 회귀 2개는 패치 후 통과하고 일반 웹 번들을 복원했다.

사용자는 스토어 심사를 하지 않고 Expo에서 APK를 내려받아 Android 실기기로 테스트하는 MVP를 요청했다. 운영 공개 조건과 APK 내부 테스트 조건을 구분하고, 실제 계정·서버 없이 확인할 수 있는 빌드 문제를 먼저 처리했다. 기존 서버 인증을 가짜 로그인이나 fixture 서버로 대체하지 않았다.

| 변경 파일                                                                                           | 반영 내용                                                                                                             |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `apps/mobile/package.json`, `package-lock.json`                                     | Expo 57.0.26 / Constants 57.0.20 / Linking 57.0.11 / Router 57.0.24 호환 패치, MVP 검사·Android 번들·EAS preview hook |
| `eas.json`, `apps/mobile/eas.json`                                                                  | preview APK 빌드 번호 자동 증가, EXPO_NO_DOTENV=1                                                                     |
| `.env.mvp.example`, `.gitignore`                                                                    | MVP 공개 값 4개 템플릿, 모바일 생성 native 디렉터리 제외                                                              |
| `scripts/mvp-config.mjs`, `scripts/check-mvp-build.mjs`, `scripts/prepare-mvp.mjs`                  | 로컬/EAS 공개 설정 검사, 실제 설정으로 Android/Hermes 번들 생성; 스토어·OCR 키·Pages 계정명 미요구                    |
| `apps/mobile/src/app/+native-intent.tsx`, `tests/auth/native-intent.test.ts`                        | 정상 초대·인증 원문 보존, 16KiB 초과·깨진 퍼센트 인코딩 조기 차단                                                     |
| `apps/api/wrangler.jsonc`, `scripts/release-config.mjs`, `tests/release/config.test.mjs`            | staging OCR 키 선택 사항, 생성 설정에 선택 환경의 secret 요구 적용; production 필수 선언 유지                         |
| `apps/api/worker-configuration.d.ts`, `apps/api/src/ocr.ts`, `apps/api/test/workspace-http.test.ts` | 재생성한 선택 OCR 타입, 안전한 헤더 타입, 미등록 secret 테스트                                                        |
| `tests/release/mvp.test.mjs`                                                                        | APK 공개 설정 4개·누락·localhost·fixture 검사                                                                         |
| `docs/MVP_ANDROID_BUILD.md`, `docs/BUILD_CHECKLIST.md`                                              | Android 내부 빌드·설치 절차, 최소 외부 준비, audit 경로 분석, 기존 플랫폼/스토어 체크리스트 범위 수정                 |
| `docs/DEPLOYMENT.md`, `docs/APP_SERVICES_SETUP.md`, `README.md`, `docs/PROJECT_PROGRESS_REPORT.md`  | 현재 MVP 목표와 staging 수동 영수증 입력 안내 연결                                                                    |

Android export 및 Hermes 컴파일은 1486개 모듈과 약 4.3MB .hbc로 통과했다. 결과는 `apps/mobile/.release/android`이며 서명된 APK가 아니다. 패치 후 Expo 패키지 검사도 통과했다. 인증 11개·배포/MVP 설정 10개·기반 SQL/API 37개는 통과했다. 실제 앱 설치·로그인·자동 OCR 인수를 대신하지 않는다.

EAS 최초 계정 조회는 Not logged in이었다. 로컬 `.env.mvp`와 모바일 .env/.env.local은 존재하지 않았다(값을 읽거나 출력하지 않음). 실제 로그인·테스트 서버 공개 값·EAS preview 등록이 준비돼야 기능 테스트 APK를 생성할 수 있다. 사용자에게 안전한 로컬 로그인 방법을 안내하고 키·비밀번호를 채팅에 보내지 않도록 했다.

현재 audit 31건은 SDK 강제 다운그레이드 없이 유지된다. 원인 advisory 4개와 Expo/Metro·Router·xcode 경로를 조사하고 Android 딥링크를 보완했다. Expo doctor 온라인 스키마 조회는 TLS 연결 오류로 재시도에도 실패하여 완료로 표시하지 않는다. DB·도메인 객체 스키마 변경은 없고 DB 사전 v1.8을 유지한다. 아래 과거 운영 공개·스토어 준비는 이번 MVP 빌드의 필수 조건이 아니다.

## 2026-10-03 빌드 준비 체크리스트

`docs/BUILD_CHECKLIST.md`를 추가하여 계정·Supabase/소셜 로그인·API/웹/OCR·환경 값·플랫폼 서명·첫 내부 테스트 빌드·운영 빌드 전 실기기 인수 순서로 체크 항목을 정리했다. 이미 통과한 로컬 검사와 아직 미확인인 실제 서비스 준비를 구분하고, Android/iOS 실행 명령과 결과 기록란을 포함했다. `docs/DEPLOYMENT.md`에 체크리스트 링크를 추가했다. 이번 변경은 문서 작성이며 코드·DB·환경 값 변경이나 실제 빌드는 수행하지 않았다.

## 2026-10-03 배포 준비

사용자 “배포 준비까지 진행” 요청에 따라 계정 없이 준비할 수 있는 설정·검증·절차를 정리했다. 실제 원격 배포와 모바일 클라우드 빌드는 완료하지 않았다. 외부 설정이 없으므로 실제 환경 release:prepare 완료 상태는 아니다.

| 변경 파일                                           | 반영 내용                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/deploy-web.yml`                  | main 수동 staging/production, GitHub Environment, 설정/자격/품질/브라우저/산출물/dry-run 검사, API 다음 Pages 배포 |
| `.github/workflows/ci.yml`                          | 인증·배포 설정·앱 브라우저 검증 추가                                                                               |
| `scripts/release-config.mjs`                        | HTTPS/공개 키/복귀 경로 검사, 동일 Supabase와 origin의 Worker 설정 생성                                            |
| `scripts/prepare-release.mjs`                       | 환경 검증, Expo 캐시 초기화 export, 산출물 검사, Worker dry-run                                                    |
| `scripts/release-artifacts.mjs`                     | 진입 HTML·동적 여행 rewrite·fixture 및 sb_secret 문자열 검사                                                       |
| `tests/release/config.test.mjs`                     | 환경 생성·secret 제외·정상/누락/관리자 키/주소 불일치 5개 검사                                                     |
| `package.json`                                      | release:check/config/prepare/artifacts 및 test:release 명령                                                        |
| `.env.release.example`                              | 공개 환경 템플릿                                                                                                   |
| `.gitignore`, `.prettierignore`, `eslint.config.js` | 생성 설정 제외, 템플릿 포함                                                                                        |
| `eas.json`, `apps/mobile/eas.json`                  | 개발/미리보기/운영 환경 명시, 운영 autoIncrement                                                                   |
| `docs/DEPLOYMENT.md`                                | 배포 구조·계정·초기 secret·실제 인수·모바일·롤백·출시 미완료 항목                                                  |
| `docs/APP_SERVICES_SETUP.md`                        | PowerShell Wrangler secret 직접 실행 안내                                                                          |
| `README.md`, `docs/PROJECT_PROGRESS_REPORT.md`      | 배포 준비 명령과 검증 결과 안내                                                                                    |

배포 설정 테스트 5개와 기존 웹 산출물 검사는 통과했다. 검증용 공개 값으로 생성한 Worker 설정을 실제 Wrangler dry-run으로 빌드했다(약 970KiB, 원격 업로드 없음). 설정 없는 release:check/prepare는 항목명만 표시하고 의도대로 실패했다. 새 DB·도메인 객체 변경은 없으며 DB 사전 v1.8을 유지한다.

`npm audit --omit=dev`는 high 19건·moderate 12건을 보고했다. SDK 비호환 강제 수정은 적용하지 않았다. 외부 계정/실제 인수·취약점 평가·개인정보/계정 삭제·신고 운영 준비 전 production 공개를 완료한 것으로 취급하지 않는다. [배포 절차](DEPLOYMENT.md)를 따른다.

## 2026-10-03 서버 앱 후속 구현

사용자 “다 진행해” 요청에 따라 기본 여행 화면을 실제 서버 원본으로 전환하고 일정·비용·기간·사진·영수증·초대·커뮤니티 흐름을 구현했다. 기존 메모리 여행 화면은 이름을 붙인 프로토타입으로 보존하고 기본 라우트에서는 사용하지 않는다. 발자취는 독립 기기 초안으로 유지한다. 아래 초기 인증 전환·2026-10-02 점검은 과거 상태다.

실제 콘솔과 테스트 프로젝트가 준비되지 않아 원격 DB 적용·카카오/구글/애플 실제 가입·실물 OCR 정확도·Android/iOS 실기기 공유/복귀는 미검증이다. 환경 준비는 [서비스 연결 절차](APP_SERVICES_SETUP.md), 현재 API는 [앱 서버 계약](planning/APP_SERVER_API.md), 스키마는 DB 사전 v1.8을 따른다. 커밋·푸시·운영 배포는 수행하지 않았다.

### 구현한 동작

- 서버 여행 생성·참여 목록·날짜별 일정 CRUD/시간/순서/주소·준비물·수동 비용과 정확한 통화별 예상/실제 합계.
- 소유자 제목/지역/종료 상태와 기간 변경. DAY UUID·순서 보존, 기록 있는 DAY 축소·확정 결제일 범위 제외 거부.
- 편집자/뷰어 초대 발급·7일 만료·OS 공유·로그인 복귀 토큰 보존·명시적 수락·철회·멤버 역할/제거. 서버가 현재 JWT 권한을 재검사한다.
- JPG/PNG 4MiB 비공개 Storage, 여행/일정 사진, 카메라·영수증 사진 선택, 실제 Vision REST 어댑터, 후보 검토/수동 입력, 원자 일정·영수증·지출 연결, 원본 중복 확정 차단, 사진 원본 삭제 재시도.
- 종료 여행의 선택 일정/사진·선택 비용 공개, 글 갱신/철회, 공개 피드 20개 단위, 비공개 메모/영수증/초대 제외, 본인 신고·작성자 차단.
- 웹과 앱 공통 계약·초대/인증 라우트, 동적 여행 새로고침 rewrite. 계정·여행 전환 시 작성 폼/재시도 상태를 분리한다.
- 저장 응답 유실에서 동일 요청 키/본문/버전 재시도. 충돌 시 폼을 보존하고 최신 내용을 읽은 뒤 사용자가 다시 확인한다.

### 변경 파일 전체 목록

추가 환경 정리: `eslint.config.js`에서 Wrangler의 생성 캐시(`**/.wrangler/**`)를 소스 린트 대상에서 제외했다. 제품 코드의 검사 규칙은 유지한다.

| 파일                                                                                                                                                                                                                                       | 변경                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `supabase/migrations/20261003000001_complete_app.sql`                                                                                                                                                                                      | 5개 테이블, 일정 주소/DAY 제약, 명령·초대·공개 RPC, 비공개 Storage 정책             |
| `packages/domain/src/workspace.ts`, `packages/domain/src/index.ts`                                                                                                                                                                         | 서버 일정/사진/비용/영수증/공개 글/스냅샷/OCR 후보 타입                             |
| `packages/validation/src/workspace.ts`, `packages/validation/src/index.ts`                                                                                                                                                                 | strict 명령·금액/날짜·응답 스키마, 실제 달력 검증 export                            |
| `packages/api-client/src/workspace.ts`, `packages/api-client/src/foundation.ts`, `packages/api-client/src/index.ts`                                                                                                                        | 공통 요청 export, 확장 서버 클라이언트와 런타임 응답 검증                           |
| `apps/api/src/workspace.ts`, `apps/api/src/ocr.ts`, `apps/api/src/app.ts`, `apps/api/src/backend.ts`, `apps/api/src/errors.ts`                                                                                                             | 실제 경로, 사용자 JWT/역할/버전/부모 검사, Vision 제한·비밀 헤더, 파일 서명 URL     |
| `apps/api/wrangler.jsonc`, `apps/api/worker-configuration.d.ts`, `apps/api/.dev.vars.example`                                                                                                                                              | 서버 OCR secret binding·생성 타입·로컬 예제                                         |
| `apps/api/test/bootstrap.sql`, `apps/api/test/http.test.ts`, `apps/api/test/workspace.test.ts`, `apps/api/test/workspace-http.test.ts`                                                                                                     | Storage 외부 fixture 필드와 실제 SQL·API·OCR·권한/중복/기간/공개 검증               |
| `apps/mobile/src/features/workspace/WorkspaceScreen.tsx`, `PlanEditor.tsx`, `ui.tsx`, `forms.ts`, `service.ts`                                                                                                                             | 실제 여행 허브·입력/원본 확인·역할 UI·사진/OCR/공유·멱등 재시도                     |
| `apps/mobile/src/features/workspace/InviteScreen.tsx`, `invite.ts`, `CommunityScreen.tsx`                                                                                                                                                  | 링크 보존/수락·공개 피드·서명 사진·신고/차단                                        |
| `apps/mobile/src/app/(tabs)/index.tsx`, `(tabs)/_layout.tsx`, `(tabs)/community.tsx`, `trips/[id].tsx`, `invite.tsx`                                                                                                                       | 기본 서버 화면과 커뮤니티/초대 라우트 연결, 이전 프로토타입 보존                    |
| `apps/mobile/src/app/login.tsx`, `apps/mobile/src/app/auth/callback.tsx`                                                                                                                                                                   | 로그인 성공 후 보관한 초대 화면 복귀                                                |
| `apps/mobile/package.json`, `package-lock.json`, `app.config.ts`, `apps/mobile/app.config.ts`                                                                                                                                              | Expo 호환 image-picker 설치, 한글 카메라/사진 권한 설정                             |
| `apps/mobile/public/_redirects`, `scripts/preview-trail.mjs`                                                                                                                                                                               | 실제 여행 UUID 직접 접근/새로고침의 정적 템플릿 연결                                |
| `tests/web/workspace.spec.ts`, `playwright.workspace.config.ts`, `playwright.config.ts`, `scripts/verify-workspace-web.mjs`, `package.json`                                                                                                | 실제 버튼/PKCE/파일/재시도/게시/뷰어 흐름, 격리 공개 설정, 테스트 후 일반 번들 복원 |
| `README.md`, `docs/APP_SERVICES_SETUP.md`, `docs/DEVELOPMENT_SETUP.md`, `docs/DB_DICTIONARY.txt`, `docs/PROJECT_PROGRESS_REPORT.md`, `docs/planning/APP_COMPLETION_SCOPE.md`, `docs/planning/APP_SERVER_API.md`, `docs/planning/README.md` | 최신 구현·명세·설정·검증/미완료 범위 기록                                           |

### 최종 검증 상태

- `npm run check`: TypeScript 엄격 모드·ESLint 경고 0·Prettier 최종 확인.
- `npm run test:auth`: 9개 통과.
- `npm run test:foundation`: 37개 통과(실제 SQL·HTTP·OCR/권한·기존 발자취 규칙).
- `npm run test:workspace:web`: 2개 통과, 테스트 후 일반 웹 번들 복원.
- `npm run test:trail:web`: 기존 인증/발자취 화면 4개 통과.
- `npm run api:build`: 최종 Worker staging dry-run 통과, 실제 배포 없음.
- 일반 웹 export: 14개 정적 라우트 성공. 실서비스 환경은 미설정.
- 로컬 Pages 런타임: 실제 여행 UUID 직접 접근 200, Location 없음, 동적 템플릿 표시. HTML 확장자 정규화 리디렉션을 피하는 내부 rewrite 확인.

PostgreSQL/HTTP/OCR 37개와 인증 9개가 통과했다. 전체 앱 Chrome 검증 2개도 통과했다: 실제 PKCE 버튼/콜백 → 여행 생성 → 일정 응답 유실 후 같은 키 재시도 → 비용 → 영수증 파일 선택/OCR 실패 수동 확인 → 웹 새로고침 → 종료/선택 게시 → 공개 응답의 비공개 메모·영수증 제외, 그리고 초대 링크의 인증 복귀 보존 → 명시적 참여 → 뷰어 작성 버튼 차단. 테스트 뒤 캐시를 초기화한 일반 웹 번들(14개 정적 라우트)을 복원했다. 로컬 HTTP fixture 검증은 실제 외부 공급자 인증·OCR 샘플 인수와 구분한다.

### 남은 실제 인수와 출시 준비

원격 환경·실기기 인수, 미등록 Storage 원본/24시간 요청 기록 청소, OCR 정확도·쿼터/과금, 신고 처리 운영, 계정 탈퇴·스토어 심사/약관·의존성 취약점 대응이 남는다. 같은 영수증의 서로 다른 사진을 자동 동일 결제로 탐지하지 않으며 결제 시각·상세 품목 구조화는 미구현이다. 기존 발자취 기기 초안의 해당 필드는 자동 서버 이관하지 않는다. 전체 앱/스토어 출시 완료로 표시하지 않는다.

## 2026-10-03 사용자 요청과 소셜 인증 전환

[앱 완성 범위](planning/APP_COMPLETION_SCOPE.md)에 로그인/가입·날짜/일정·링크 초대·웹 연동·영수증 스캔/OCR·사진/금액/지역·종료 여행 커뮤니티 공유 7개를 반영했다. 사용자의 후속 답변에 따라 카카오/구글/애플 우선과 QR 대신 영수증 스캔을 확정했다. 기존 OCR·사진·커뮤니티 후순위 및 40+5일 계획은 이 추가 범위를 포함하지 않는다.

소셜 로그인에서 임시 사용자 생성과 저장 실패 숨김을 제거하고 실제 Supabase OAuth, Expo 인증 브라우저, PKCE 교환 및 공통 콜백, SDK 세션 구독·복원, 로그아웃과 계정별 메모리/조회 캐시 초기화를 연결했다. `expo-web-browser`를 Expo 호환 설치하고 동적 설정의 플러그인을 수동 등록했다. DB 사전 v1.7에는 인증 객체와 email 유형·계정 전환을 기록했다. 실제 SQL 테이블 변경은 없다.

실제 인증 환경 파일이 로컬에 없어 공급자별 로그인·최초 가입·실기기 콜백은 아직 미검증이다. [설정 절차](SOCIAL_AUTH_SETUP.md)를 따른다. 여행 화면은 메모리 저장, 발자취는 기기 초안이며 초대·OCR·사진 원격 저장·커뮤니티는 남은 구현이다. 아래 2026-10-02 점검은 과거 상태로 읽는다.

최종 로컬 검증: `npm run check` 통과, 인증 테스트 9개 및 기존 DB/API/발자취 규칙 테스트 28개 통과, 웹 정적 11개 라우트 export 성공. 사용자는 테스트 프로젝트·공급자 콘솔 미준비를 확인했고 설정 절차를 함께 정리하도록 요청했다. 운영 인증 완료나 전체 앱 완성을 의미하지 않는다.

최종 웹 번들의 브라우저 테스트 4개(콜백 오류·로그인 복귀, 기존 여행/계획/영수증 원본 보존, 왕복 항공 기준, 날짜 포함 항공 검색)도 통과했다.

- 점검일: 2026-10-02 (Asia/Seoul)
- 기준: 로컬 `main`, HEAD `544278b`; 점검 시작 시 작업 트리 변경 없음
- 방법: PRD 텍스트, 화면·스토어·서비스, SQL, 검사 및 배포 설정 대조
- 결론: **화면은 프로토타입 단계이며 M0/M1 DB·API 기반은 로컬 구현·검증했다. 실제 환경/화면 저장 연결을 포함한 MVP 완료 기준은 미충족.**
- 최신 실행: [M0·M1 구현/검증 기록](planning/M0_M1_EXECUTION.md), [개발 환경](DEVELOPMENT_SETUP.md). 아래 초기 점검과 이후 구현 변경을 구분한다.

## 기존 자료와 최신 변경

통합 기획서는 이미 존재하며 제품 목표, 사용자 흐름, MVP/P1/P2, 개념 모델, API 초안, 완료 기준과 미결정 항목을 담고 있다.

| 자료                                                                   | 확인 결과                                                              |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [통합 PRD v0.3](0.PRD/여행_계획_공유_기록_서비스_통합기획서_v0.3.docx) | 제품 기획 기준 존재. 요구사항별 추적과 결정 이력 보완 필요             |
| [UI 디자인 시스템](1.uiux/ui_design_system.md)                         | 시각 기준 존재. 화면별 상태·예외·권한 명세 보완 필요                   |
| [DB 사전](DB_DICTIONARY.txt)                                           | v1.5 갱신, 5절 실제 M1 변경·제약·RPC·도메인 명세 우선                  |
| [배포 가이드](DEPLOYMENT.md)                                           | 절차 존재. 실제 배포 및 실기기 검증 결과는 이번 점검에서 확인하지 않음 |

2026-10-01에 BI→CI 스플래시와 시작 점검·로그인 진입이 추가되었고 웹 빌드 및 Pages 업로드 경로가 모바일 워크스페이스로 수정되었다. 커밋·설정 존재와 실제 배포 성공은 별도 상태다.

기존 2026-09-24 보고서의 전체 75%, 인증 100% 등 수치는 요구사항별 인수 증거가 없어 현재 판단 기준에서 제외한다. 정적 검사 통과만으로 단일 명령 함수·전수 주석·DB 동기화·제품 완성을 입증할 수 없다.

## 착수 전 코드 근거별 상태

부분 구현은 코드가 있지만 PRD의 전체 흐름이나 저장·권한·외부 연동이 완성되지 않은 상태다. 이번 점검에서 실서비스 검증 완료로 판정한 기능은 없다.

| 영역            | 실제 확인 내용                                                                                                                     | 남은 완료 조건                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 개발 구조       | npm workspaces, 공통 domain/validation/api-client, CI 설정 존재                                                                    | 실행 대상과 중복 루트 `src/` 정리 방향 확정                               |
| 시작 화면       | `apps/mobile/src/app/index.tsx`: BI/CI 애니메이션·로그인 이동. 버전은 로컬 문자열 비교·지연, 데이터는 SecureStore 가용성 확인 수준 | 원격 업데이트·데이터 내용 검증은 미구현                                   |
| 소셜 로그인     | `login.tsx`, `useTripStore.ts`: 제공자별 버튼과 임의 ID 프로필 생성. upsert 실패를 숨기고 화면 진입                                | 실제 OAuth·콜백·Auth 사용자 UUID 연결·세션 복원                           |
| 게스트          | `guestAuthService.ts`: 게스트 프로필 저장·복원 코드 존재                                                                           | 여행 보존·계정 전환 정책 확정. 프로필 보존과 여행 보존은 별개             |
| 여행·DAY·일정   | 스토어와 목록/상세: 생성·날짜 계산·일정 추가/삭제/순서 액션 등 부분 구현                                                           | DB 저장·재조회, 수정 UI·기간 변경, 재접속·다른 기기 검증                  |
| 지도·장소       | 상세 지도 탭은 번호 목록 UI. 장소 좌표는 임의 값 생성. API 검색은 목업                                                             | 실제 장소 검색·좌표 저장·지도 마커와 경로 연동                            |
| 비용·체크리스트 | 스토어 추가·토글 및 화면 합계 표시                                                                                                 | DB 저장·통화별 합계·DAY 연결·권한 검증                                    |
| 초대·공유       | 코드는 현재 메모리의 여행에서 검색. 공유 토큰도 로컬 생성                                                                          | 서버 저장·만료·수락·역할 검증, 다른 기기 참여, 공개 조회                  |
| 방문·후기       | 체크인은 장소/기본 좌표와 `isVerified: true` 기록. 후기 저장은 Alert 후 입력 초기화                                                | 실제 위치·거리 판단, 후기·사진 영구 저장. GPS 200m 인증 완료 근거 없음    |
| 프로필          | Supabase 조회/upsert/update 서비스 존재                                                                                            | 실제 인증 UUID·환경에서 저장과 복원 성공 검증                             |
| DB              | 3개 마이그레이션에 13개 테이블과 일부 정책·트리거 존재                                                                             | 적용 결과 미확인. RLS 활성화와 역할별 CRUD 정책 완비는 별도 검증          |
| API             | `apps/api/src/index.ts`: health·검색·공유·OCR 라우트                                                                               | 검색/OCR은 목업, 공유는 난수 URL 응답. 인증·저장·입력 검증·외부 호출 필요 |
| 웹·배포         | 모바일 export/Pages 워크플로우 존재. `apps/web`은 확장 계획/패키지 수준                                                            | 공유 뷰와 실제 배포·직접 URL 접근 검증                                    |

`apps/mobile/src/services/travelStorage.ts`도 메모리 기반 예시 저장소다. 현재 여행 스토어에는 여행 데이터 persist/DB CRUD 연결이 없어 화면 내 변경을 영구 저장 완료로 해석하면 안 된다.

PRD의 `saved_places`, `trip_invites`, `trip_records`, `trip_photos`와 실제 `visits`, `reviews`, `attachments`, `share_links`의 대응 및 누락을 검토해야 한다. 테이블 개수가 같다는 것만으로 명세 일치를 판단하지 않는다.

## 착수 전 검증 결과와 한계

- `npm run check`: 2026-10-02 실행 완료, TypeScript·ESLint·Prettier 모두 통과(종료 코드 0). 문서 변경 후 최종 재검사 결과도 확인한다.
- 루트 typecheck는 `apps/`, `packages/`를 포함하며 루트 레거시 `src/`는 include 대상이 아니다.
- 자동화 테스트 파일은 이번 파일 목록 검색에서 확인되지 않았다.
- 앱 실행, 실제 OAuth, Supabase 적용, 외부 API, EAS 및 운영 배포는 이번에 검증하지 않았다.

## M0·M1 개발 후 갱신

- 신규 SQL 2개를 추가해 기존 3개와 총 5개 체인을 격리 PostgreSQL에서 적용했다. public 테이블은 15개이며 새 초대/요청 테이블은 직접 사용자 접근을 차단했다.
- 실제 Auth 서버 검증 코드·사용자 JWT RPC·권한/RLS·원자 여행 생성/준비물·버전 충돌·중복 재생·snapshot을 구현했다. 기존 API 목업은 503으로 전환했다.
- domain/validation/api-client 및 계정 query key, 환경 예제/Worker 설정/타입 생성/CI 검증 단계를 추가했다. DB 사전 v1.5와 실행 문서에 계약/한계를 기록했다.
- 기반 자동 테스트 17개가 통과했다. Worker staging dry-run 번들 생성 성공. 원격 Supabase/PostgREST/OAuth·동시 연결·앱 재실행·실기기는 아직 검증하지 않았다.
- 최종 `npm run check` 및 `npm run build:web` 통과. CI 검증 단계를 추가했으나 원격 CI 실행은 아직 없다.
- 모바일의 메모리 스토어와 임의 로그인 경로는 M2 전환 대상이다. M0의 공급자/지원 플랫폼/실제 환경 접근과 M1의 원격 증거는 남아 있다.
- 환경 npm audit 16개(높음 4, 중간 12)는 Expo 관련 경로다. 호환 패치 검토를 후속 환경 작업에 기록했고 주요 버전 자동 변경은 적용하지 않았다.

## 발자취 추가 구현 (2026-10-02)

사용자 추가 요청으로 항공 기준·장소 계획·영수증 콘텐츠를 발자취 탭에 구현했다. 기존 내 여행 계획 가져오기 및 기존 체크인 목록을 유지하고, 원본 사진/PDF와 구매 상세를 기기 초안에 보존한다. 실제 제공 범위는 [발자취 명세](planning/TRAIL_CONTENT_SPEC.md)를 참조한다.

서버 계정 연결·원격 동기화·자동 항공 조회·발권·OCR·실기기 검증은 후속이다. 이 추가 기능을 M0/M1 전체 인수나 기존 메모리 여행의 서버 저장 완료로 해석하지 않는다. DB 사전은 v1.6으로 기기 객체를 추가했으며 public SQL 테이블은 변경하지 않았다.

## 다음 작업 순서

1. [기획 프로세스](planning/PLANNING_PROCESS.md)와 [MVP 추적표](planning/MVP_REQUIREMENTS.md)의 선행 정책·범위를 제품 오너가 확정한다.
2. 실제 Auth 사용자 ID와 여행·DAY·일정 저장/복원을 먼저 연결한다.
3. 일정 수정·순서, 장소·지도, 수동 비용·체크리스트를 인수 기준에 맞춘다.
4. 다른 계정/기기에서 초대 수락과 서버의 owner/editor/viewer 권한을 검증한다.
5. 재접속 보존과 PRD 14.1 통합 시나리오 통과 후 MVP 인수를 진행한다.
6. Realtime·OCR·Today·사진·후기는 확정 범위에 따라 MVP 후반/P1로 진행한다.

## 초기 점검 때의 변경 내역

- 본 보고서: 과거 완료율을 코드 근거별 상태·한계·다음 작업으로 교체.
- `planning/PLANNING_PROCESS.md`: 단계·역할·산출물·통과 조건·필수 문서와 변경 관리 작성.
- `planning/MVP_REQUIREMENTS.md`: 기존 PRD 기반 범위·요구사항별 완료 기준·검증·미결정 사항 작성.
- 제품 코드·DB·도메인 변경 없음. DB 사전은 기존 명세로 유지한다.

## 상세 기획 보완 (2026-10-02)

사용자 요청에 따라 [상세 기획 문서 안내](planning/README.md)를 작성했다. 필수 기능·사용자 흐름/화면·권장 정책·데이터 저장·API 계약·인수 검증 6개 상세 문서를 추가하고 초기 요구사항/프로세스 문서를 연결했다.

기본 프로필과 직접 장소 등록을 PRD의 필수 범위로 보완했다. DB 원본/앱 캐시 분리, 여행·DAY 트랜잭션, 일정/예상비용 단일 원본, 통화별 합계, 기간 축소 차단, 버전 충돌, 초대 원자적 수락과 중복 요청을 목표 설계로 정리했다. 권장 정책 D-01~15는 승인 전이며 QA 41개 케이스는 계획이다.

실제 SQL·TypeScript 객체·제품 코드는 변경하지 않았으며 기능 구현 상태도 위 현황과 동일하다. DB 사전에 기획 부록을 추가해 현행 명세와 목표 필드의 차이 및 상세 저장 설계 참조를 표시했다. 이번 상세 문서 변경 후 `npm run check`는 TypeScript·ESLint·Prettier 전부 통과(종료 코드 0)했으며 로컬 Markdown 링크 대상과 `git diff --check`도 확인했다. QA 기능 케이스는 설계만 작성했으며 실행하지 않았다.

## 일자별 계획 보완 (2026-10-02)

[일자별 업무·마일스톤](planning/DAILY_MILESTONES.md)을 작성했다. 1인 전일제·주 5일·공휴일 제외 기준으로 2026-10-06부터 40영업일 필수 작업과 5영업일 예비를 배정했다. 내부 MVP 인수 목표는 12-01, 예비 대응 재검토일은 12-08이다. 45일 업무/산출물/검증, M0~M8 통과 조건, 일일 프로세스·외부 준비 기한·지연 재산정과 실제 기록 양식을 포함한다.

담당 인원/가용시간·정책/접근 준비는 가정이며 모두 미착수다. 이번 요청은 일정 문서 작성으로, 구현 완료율이나 운영 출시 상태는 변하지 않는다. 문서 안내·운영 프로세스에 계획을 연결했다. 일정 문서 변경 후 `npm run check`는 전부 통과(종료 코드 0)했으며 45개 업무일의 날짜·요일·공휴일 제외, 변경 문서의 로컬 링크 및 `git diff --check`를 검증했다.
