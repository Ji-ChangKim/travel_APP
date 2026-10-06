# Cloudflare D1·R2 전환과 MVP 배포 보고

2026-10-06. 사용자가 선택한 D1·R2로 백엔드를 전환하고 실제 스테이징에 배포했다. 기존 Supabase 실데이터 백업을 받지 않아 신규 데이터베이스로 시작했다. 기존 SQL과 회귀 검사는 이전 계약 자료로 보존했다.

## 실제 배포

- 웹: https://wherego-staging.pages.dev
- Pages 배포: https://dcf4bfe2.wherego-staging.pages.dev (58개 파일)
- API: https://wherego-api-staging.gametps.workers.dev
- API 버전: `baa4e87f-791a-466b-852b-03f86b246438`
- D1: `wherego-staging`, `1c6b34d4-cbfa-45b2-8859-6531b1f95ac9`
- 비공개 R2: `tripprint-staging-private` (같은 날 브랜드명 변경, 아래 전환 기록 참고)
- 적용 스키마: `apps/api/migrations/0001_cloud_storage.sql`, `0002_auth_rate_limit.sql`, `0003_upload_deletion.sql`
- 서버 `AUTH_SECRET`은 암호화된 Worker Secret으로 등록했다. 앱·공개 설정·Git에는 포함하지 않았다.

## 변경 내용과 파일

| 파일                                                                                             | 변경 이유와 동작                                                                                                                                          |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/cloudAuth.ts`                                                                      | Better Auth 1.7.7 이메일 가입·로그인·서명 Bearer·7일 세션·UUID·D1 기반 인증 요청 제한. 허용 웹 Origin과 네이티브 앱 Origin 검사.                          |
| `apps/api/src/cloudModel.ts`                                                                     | 항공편/자동 DAY, 일정·비용·기간·멤버·초대·영수증·선택 게시의 공통 도메인 변화. BigInt 통화별 합계, 다른 여행 부모/중복 영수증 검사.                       |
| `apps/api/src/cloudStore.ts`                                                                     | D1 prepared statements, 여행 버전 CAS, 멤버 인덱스와 부수 결과의 원자 batch, 멱등 키 본문 해시·재생. 같은 명령의 동시 재시도에서도 한 번 저장.            |
| `apps/api/src/cloudRpc.ts`                                                                       | 기존 앱 API 계약을 D1 조회·저장으로 연결. 실제 사용자 닉네임, 역할 검사, 초대 해시·소비·철회·만료, 신고·차단.                                             |
| `apps/api/src/cloudMedia.ts`                                                                     | 인증된 4MiB JPEG/PNG 생성 전용 R2 업로드. 실제 업로드 메타데이터 검증, 60초 HMAC 주소, 현재 멤버십/공개 선택 재검사, 원본 삭제 표식으로 재등록 경쟁 차단. |
| `apps/api/src/cloudProfiles.ts`                                                                  | 본인 프로필 조회·수정, 닉네임/상세 프로필 원자 저장. 계정 UUID나 인증 유형은 수정 입력에 허용하지 않음.                                                   |
| `apps/api/src/app.ts`                                                                            | 표준 인증·R2·프로필 경로 등록, 서명 토큰 응답 헤더 CORS 노출, DELETE 허용.                                                                                |
| `apps/api/src/backend.ts`                                                                        | D1 바인딩이 있는 실제 배포는 Cloudflare 세션과 명령을 사용. 이전 Supabase 분기는 기존 회귀 검사 자료로 유지.                                              |
| `apps/api/src/workspace.ts`                                                                      | 공통 명령 타입 호환 및 실제 R2 서명 URL 연결.                                                                                                             |
| `apps/api/src/ocr.ts`                                                                            | 등록된 영수증 원본을 R2에서 읽어 기존 Google Vision 분석에 연결. 미설정 공급자는 503과 수동 입력으로 처리.                                                |
| `apps/api/src/errors.ts`                                                                         | 공통 Zod 3 계약과 API Zod 4의 공개 입력 오류 처리.                                                                                                        |
| `apps/api/bindings.d.ts`, `worker-configuration.d.ts`, `wrangler.jsonc`                          | 실제 D1/R2 및 Secret 바인딩, 분리된 스테이징 Origin, Workers 타입 연결. 운영 환경은 별도 저장소 연결 전 배포 차단.                                        |
| `apps/api/migrations/*.sql`                                                                      | 인증·여행·멤버·멱등 기록·초대·공개 글·원본·신고·차단·프로필·인증 요청 제한 14개 테이블.                                                                   |
| `apps/mobile/src/services/cloudAuth.ts`                                                          | 실제 표준 REST 인증, 모바일 SecureStore/웹 Origin 저장소, 서버 세션 확인·철회, 인증 이벤트 revision. 네이티브 요청에 앱 Origin 전달.                      |
| `apps/mobile/src/services/authService.ts`                                                        | 이메일 가입/로그인/로그아웃/현재 사용자 서비스 전환.                                                                                                      |
| `apps/mobile/src/services/profileService.ts`                                                     | 본인 D1 API에 프로필 조회·저장 연결.                                                                                                                      |
| `apps/mobile/src/services/supabase.ts`                                                           | 사용하지 않는 예제 Supabase 연결 모듈 삭제.                                                                                                               |
| `apps/mobile/src/features/auth/AuthBridge.tsx`                                                   | 서버 세션 복원, 전경 재검사, 계정 전환 캐시 정리, 이전 복원 결과의 새 계정 덮어쓰기 방지, 본인 상세 프로필 복원.                                          |
| `apps/mobile/src/features/auth/oauth.ts`                                                         | 미연결 소셜 공급자를 가짜 성공으로 처리하지 않고 이메일 로그인 안내.                                                                                      |
| `apps/mobile/src/features/auth/EmailAuth.tsx`                                                    | 실제 발급 Cloudflare 세션이 있어야 여행 화면 진입.                                                                                                        |
| `apps/mobile/src/app/index.tsx`, `login.tsx`                                                     | 재시작 세션 복원, 이메일 중심 진입, 미연결 소셜 버튼에 준비 중 표시.                                                                                      |
| `apps/mobile/src/app/(tabs)/my.tsx`                                                              | 서버 프로필 저장이 확정돼야 저장 완료 표시. 실패 입력 유지.                                                                                               |
| `apps/mobile/src/features/workspace/service.ts`                                                  | 서버 세션으로 여행 API·실제 R2 업로드/원본 정리 연결.                                                                                                     |
| `apps/mobile/src/features/workspace/CommunityScreen.tsx`                                         | 현재 공개 사진만 Worker 서명 API로 표시.                                                                                                                  |
| `.env.example`, `.env.mvp.example`, `.env.release.example`, `apps/api/.dev.vars.example`         | Supabase 공개 키 대신 Cloudflare API/웹 주소와 서버 Secret 구성.                                                                                          |
| `apps/mobile/eas.json`, `eas.json`                                                               | preview APK에 검증한 공개 스테이징 주소 고정. 비밀 없음.                                                                                                  |
| `scripts/release-config.mjs`, `tests/release/config.test.mjs`, `tests/release/mvp.test.mjs`      | 현재 앱과 맞지 않는 이전 Supabase 빌드 설정 거부. Cloudflare 공개 설정 3개 검사, 실제 D1·R2 바인딩 재사용, 운영 저장소 미구성 배포 차단.                  |
| `tests/cloud/runtime.test.mjs`                                                                   | 실제 Workers D1·R2 런타임 통합 검사 3개: 인증/역할/공개 철회, 동시 저장/영수증/정리 보호/프로필/앱 Origin, 인증 요청 제한.                                |
| `tests/web/workspace.spec.ts`                                                                    | 표준 Cloudflare 인증과 R2 HTTP 경계로 fixture 갱신, 사용자 이메일 폼·사진 선택·초대·여행 흐름 8개 검증.                                                   |
| `apps/api/test/http.test.ts`, `workspace-http.test.ts`                                           | 이전 API 회귀 환경에 인증 기본 URL 항목 추가.                                                                                                             |
| `package.json`, `apps/api/package.json`, `package-lock.json`                                     | 인증 라이브러리/API 전용 호환 Zod 설치, `test:cloud` 및 런타임 테스트 빌드 명령 추가. npm 설치 취약점 0개 보고.                                           |
| `.github/workflows/ci.yml`, `deploy-web.yml`                                                     | D1·R2 런타임 검증과 Cloudflare 공개 환경 사용. 원격 GitHub 환경/자격 설정은 별도.                                                                         |
| `README.md`, `docs/MVP_ANDROID_BUILD.md`, `docs/APP_SERVICES_SETUP.md`, `docs/DB_DICTIONARY.txt` | 현재 배포/연결 절차와 14개 테이블·컬럼·제약·객체 명세 갱신.                                                                                               |

이전 턴의 이메일 폼·지도 공유 링크·사진 촬영·완료 다이어리 보완 파일은 `docs/MVP_IMPLEMENTATION_20261006.md`에 별도로 정리했다.

## 검증 결과

- `npm run check`: TypeScript 엄격 모드·ESLint·Prettier 통과.
- `npm run test:cloud`: 실제 D1·R2·표준 인증 런타임 3/3 통과. 잘못된 비밀번호, 비멤버 조회, 조회자 저장, 변조 서명, 초대 재사용, 공개 철회, 중복 영수증, 직접 원본 삭제, 기록 날짜 축소, 동시 재시도, 프로필, 네이티브 Origin, D1 인증 제한을 검증.
- `npm run test:workspace:web`: HTTP 경계 fixture를 사용하는 실제 사용자 UI 흐름 8/8 통과. 실제 외부 공급자 검증과 구분.
- `npm run test:foundation`: 이전 Supabase SQL/API 계약 회귀 52/52 통과. D1 증거는 위 `test:cloud`에 있음.
- `npm run test:auth`: 공통 입력·계정 초기화·다이어리·딥링크 계약 16/16 통과. 이전 Supabase/PKCE 순수 함수 검사도 포함하며 실제 소셜 성공 증거가 아님.
- `npm run test:release`: 설정·산출물 보호·Android 네이티브 연결 18/18 통과.
- `npm run release:prepare`: 실제 공개 주소의 웹 18개 경로 export, URL 유지 rewrite, 테스트 키 미포함 검사와 Worker dry-run 통과.
- `npm run mvp:prepare`: 실제 API 주소로 Android Hermes 번들 생성. `.release/android`의 `.hbc` 약 3.8MB. APK 아님.
- 실제 스테이징 HTTP: 이메일 가입/로그인·서명 토큰, 항공/DAY·일정·비용·R2 사진 조회·완료·선택 공개 비용 집계 확인.
- 실제 배포 웹을 별도 Chrome에서 확인: 이메일 로그인, 직접 다이어리 URL 진입·새로고침, 커뮤니티 게시글 확인. 페이지 JavaScript 오류 없음. `apps/api/.release/live-diary.png`, `live-community.png`에 검증 화면 보관.
- 실제 서버 검증 후 테스트 게시글 철회·R2 원본 삭제·로그아웃을 확인. 이전 공개 사진 URL은 404, 철회된 세션으로 여행 조회는 401. 생성한 테스트 여행·계정만 D1에서 정리했고 기존 사용자 데이터는 건드리지 않음.

## 남은 연결과 배포 범위

- Android APK: EAS owner `rupang`, project `3b23b462-262c-4b64-aff2-5fb03280e6b5` 설정 준비. Expo CLI 로그인은 아직 미완료이며 기기 승인 코드가 만료됐다. 실제 APK 파일과 EAS 빌드 완료 URL은 아직 없음. 사용자가 Expo 로그인한 뒤 preview 빌드를 실행해야 함.
- Google Places/Vision 실제 키가 없어서 자동 장소 검색·공유 링크의 장소 조회·영수증 자동 OCR은 아직 실제 공급자 인수 미완료. 수동 일정·주소·사진·비용·영수증 확인 저장은 동작함.
- 소셜 로그인, 이메일 확인/재설정 메일은 현재 연결하지 않음. 이메일/비밀번호 로그인은 실제 서버에서 검증함.
- Google Maps 앱·웹 열기와 단일 공유 장소 가져오기 입력은 제공. 저장 목록/Google 북마크 전체 자동 동기화는 후속 기획 필요.
- Android 실기기의 카메라·OS 공유 인텐트·설치와 Play Store 제출/심사/운영 배포는 미완료. 현재 공개 주소는 MVP 스테이징.
- 기존 Supabase 실제 데이터를 옮기려면 프로젝트 복원 또는 사용자 백업 제공이 별도로 필요함.
- Git 커밋/푸시는 요청하지 않아 수행하지 않음. 로컬 서버 환경·검증 계정 자격·스크린샷·배포 산출물은 무시 디렉터리에 보관.

## TripPrint R2 이름 전환 — 2026-10-06

사용자 요청에 따라 `wherego-staging-private`에서 `tripprint-staging-private`로 저장소를 전환한다. [공식 Wrangler R2 명령](https://developers.cloudflare.com/r2/reference/wrangler-commands/)으로 새 버킷을 만들고 `MEDIA` 바인딩을 연결하는 방식이다. 기존 버킷은 객체 0개·0B이고 원격 D1 uploads 테이블도 0개로 확인해 옮길 사진 원본이 없었다. 계정과 여행 데이터, D1 이름 및 API·웹 주소는 유지한다.

새 버킷 실제 설정은 APAC, 기본 저장 클래스 Standard, r2.dev 공개 접근 비활성이다. 자체 브랜드 PNG의 실제 원격 업로드→다운로드 SHA-256 일치를 확인했으며 해당 검증 파일만 삭제했다.

수정 파일은 `apps/api/wrangler.jsonc`의 기본·staging R2 연결, 재생성한 `worker-configuration.d.ts`, `docs/DB_DICTIONARY.txt`, `docs/TEST_1_RELEASE.md`, 이 문서다. 생성되는 `apps/api/.release/wrangler.json`도 새 이름을 사용한다. DB 테이블·도메인 스키마·객체 key·회원 권한·서명 URL 계약에는 변경이 없다.

`npm run check`, 릴리스 검사 18/18 및 Worker dry-run 통과 후 Worker를 재배포했다. 새 API 버전은 `8e8001e3-87ad-4547-8447-2def27237501`이다. 배포 로그에서 `MEDIA → tripprint-staging-private`를 확인했다. 실제 health 200, 비로그인 세션 null, 여행 조회 401, 기존 웹 Origin의 CORS 정상도 확인했다.

기존 `wherego-staging-private`는 삭제 직전에도 객체 0개·0B임을 다시 확인한 후 삭제했다. 버킷 목록에 새 이름이 있고 이전 이름이 없음을 확인했다. 다른 프로젝트 버킷은 변경하지 않았다. 현재 전환 증거는 `.release/tripprint-r2-deployment.json`에 보관한다. 이 문서 상단의 API 버전은 최초 전환 당시 기록이며 이번 R2 연결 전환의 최신 버전은 본 항목의 값을 따른다.
