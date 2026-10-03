# WHEREGO 실제 서비스 연결 절차

현재 대상은 [Android MVP APK](MVP_ANDROID_BUILD.md) 내부 테스트다. staging에서는 OCR 키를 생략하고 영수증 수동 입력을 먼저 검증할 수 있으며, 키를 연결해야 자동 인식을 검증할 수 있다. 스토어 심사 준비는 이번 APK 빌드 조건에 포함하지 않는다.

2026-10-03. 여행·일정·초대·사진·영수증·커뮤니티의 앱/API/SQL은 로컬 구현했다. 실제 계정과 콘솔이 아직 준비되지 않아 원격 적용·제공자 인증·실기기 인수는 남아 있다. 아래 순서로 테스트 환경을 준비한다. 키·비밀번호를 채팅이나 Git에 올리지 않는다.

## 1. Supabase와 소셜 로그인

1. 개발용 Supabase 프로젝트를 생성한다. 프로젝트 URL과 anon/publishable **공개 키**를 확인한다.
2. `supabase/migrations`의 SQL 6개를 파일명 순서대로 적용한다. 이미 적용한 마이그레이션은 반복 실행하지 않는다. 기존 DB에서는 백업과 제약 위반 데이터 점검을 먼저 수행한다.
3. [소셜 로그인 설정](SOCIAL_AUTH_SETUP.md)에 따라 카카오·구글·애플 제공자와 callback을 등록한다.
4. 최초 실제 소셜 가입 시 `profiles` 트리거가 실행되는지 확인한다. 앱에서 만든 임의 ID를 인증으로 사용하지 않는다.
5. Storage의 `trip-private` 버킷이 **private**, JPG/PNG, 최대 **4MiB**이며 업로드/읽기/삭제 RLS 정책이 적용되었는지 확인한다.

Storage 접근은 사용자 JWT와 RLS로 제한하고 원본 조회에는 60초 서명 URL을 사용한다. 공개 중인 선택 사진만 익명 조회가 허용된다. 영수증 원본은 여행 멤버에게만 보인다. 철회 후 신규 URL은 발급할 수 없지만 이미 발급한 URL·다운로드한 사진까지 회수하지는 못한다. [Supabase 비공개 버킷](https://supabase.com/docs/guides/storage/buckets/fundamentals), [서명 URL 동작](https://supabase.com/docs/guides/storage/serving/downloads).

## 2. 앱과 Worker 설정

루트 `.env.example`을 루트 `.env`와 `apps/mobile/.env` 중 실행 위치에 맞게 복사한다. `npm run mobile:web`/`build:web`는 모바일 워크스페이스에서 실행되므로 `apps/mobile/.env`를 사용한다. 원래 로컬 파일이 있다면 덮어쓰지 않는다.

```powershell
Copy-Item -LiteralPath .env.example -Destination apps/mobile/.env
Copy-Item -LiteralPath apps/api/.dev.vars.example -Destination apps/api/.dev.vars
```

| 위치               | 설정                                | 값                              |
| ------------------ | ----------------------------------- | ------------------------------- |
| 앱 `.env`          | `EXPO_PUBLIC_SUPABASE_URL`          | 테스트 Supabase HTTPS URL       |
| 앱 `.env`          | `EXPO_PUBLIC_SUPABASE_ANON_KEY`     | 공개 anon/publishable 키        |
| 앱 `.env`          | `EXPO_PUBLIC_API_URL`               | 실행 중인 Worker API 주소       |
| 앱 `.env`          | `EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL` | 실제 웹 주소 + `/auth/callback` |
| Worker `.dev.vars` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | 앱과 동일 프로젝트 URL·공개 키  |
| Worker `.dev.vars` | `ALLOWED_ORIGINS`                   | 웹의 실제 origin, 쉼표 구분     |
| Worker `.dev.vars` | `GOOGLE_VISION_API_KEY`             | 서버 전용 OCR 비밀 키           |

앱/Worker 모두 `service_role`, `sb_secret_`을 사용할 수 없다. OAuth 제공자 비밀 값은 Supabase 제공자 설정에만 넣는다. 실기기의 `localhost`는 PC가 아니므로 접근 가능한 개발 PC 주소나 staging HTTPS API를 지정한다. 앱 공개 설정을 바꾸면 웹 번들/네이티브 앱을 다시 빌드한다.

공개 설정 변경 후 이전 Metro 캐시가 남으면 다음처럼 초기화하여 빌드한다.

```powershell
npm --workspace=@wherego/mobile run build:web -- --clear
```

서로 다른 터미널에서 실행한다.

```powershell
npm run api:dev
npm run mobile:web
```

`/health` 성공은 인증·DB 준비 완료를 의미하지 않는다. 로그인 후 `/api/v1/trips`의 실제 조회를 확인한다.

## 3. 영수증 OCR

현재 어댑터는 Google Cloud Vision `images:annotate`의 `DOCUMENT_TEXT_DETECTION`을 사용한다. 서버가 비공개 원본을 다운로드하여 base64 본문으로 전달한다. 사용자 입력 URL을 공급자에게 전달하지 않는다. 원본 4MiB, 공급자 응답 256KiB, 문서 텍스트 10,000자로 제한한다. [Vision 요청](https://docs.cloud.google.com/vision/docs/request), [문서 OCR](https://docs.cloud.google.com/vision/docs/ocr).

1. Google Cloud 테스트 프로젝트를 만들고 billing과 Cloud Vision API를 활성화한다. [공식 설정 절차](https://docs.cloud.google.com/vision/docs/setup).
2. API 키를 만들고 API 제한을 Cloud Vision API로 설정한다. Worker의 서버 요청용 키로 사용한다. 브라우저 referer 제한 키를 사용하지 않는다.
3. 로컬 테스트 키를 `apps/api/.dev.vars`의 `GOOGLE_VISION_API_KEY`에 넣는다. 앱 `EXPO_PUBLIC_*`에 넣지 않는다.
   요청은 URL query 대신 `x-goog-api-key` 헤더에 키를 전달한다. [Google API 키 권장사항](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices).
4. staging에서는 다음 명령으로 Worker secret을 입력한다. 이 명령은 원격 설정을 변경하므로 환경 준비 후 운영자가 실행한다.

```powershell
& .\apps\api\node_modules\.bin\wrangler.cmd secret put GOOGLE_VISION_API_KEY --config apps/api/wrangler.jsonc --env staging
```

5. 한국어·일본어·영어 영수증으로 상호·날짜·합계를 비교한다. 인식 결과는 **후보**다. 합계 표식이 없으면 금액은 빈 값으로 남는다. 사용자가 확인해야 일정·실제 지출이 원자적으로 저장된다.

OCR 미설정/실패 시 업로드 원본을 보며 직접 입력할 수 있다. 현재 PDF·HEIC는 지원하지 않는다. JPG/PNG를 선택한다. 동일 원본의 중복 확정은 DB unique 제약으로 막지만, 같은 영수증을 다른 사진으로 다시 촬영한 경우에는 자동 동일 결제 탐지가 없다. 실제 정확도·호출 비용·쿼터·보존 조건은 샘플 인수 후 확정한다.

## 4. 초대와 웹 연결

- 초대는 소유자가 편집자/뷰어로 발급한다. 토큰은 64자이며 DB 초대 테이블에는 SHA-256 해시를 저장한다. 성공 재시도용 제한된 `mutation_requests` 결과에는 원문이 남으며 직접 조회 권한은 없다.
- 만료 7일, 초대 하나당 수락 계정 하나. 기존 멤버가 수락해도 기존 역할을 임의 변경하지 않는다. 소유자가 역할 변경·멤버 제거·초대 취소를 수행한다.
- 링크는 웹 기본 주소의 `/invite#token=…`이다. fragment는 HTTP 요청 경로에 전달되지 않는다. 로그인 전 초대는 현재 탭 sessionStorage/네이티브 SecureStore에 임시 보관한다. 인증 후 초대 화면에서 사용자가 참여를 확정한다.
- 카카오톡·메시지는 설치된 앱의 공유 시트에서 사용자가 선택한다. 현재 카카오 메시지 서버 API로 자동 발송하지 않는다.
- 다른 기기에는 `localhost` 링크를 보내지 않는다. 실제 HTTPS 웹을 배포하고 복귀 URL과 Supabase allowlist를 맞춘다. `/invite`, `/auth/callback`, `/community`, 동적 `/trips/:id`의 직접 접근·새로고침을 검증한다.
- 같은 Expo 화면, Auth, API, DB 계약을 웹에서도 사용한다. 별도 웹 플래너 디자인은 아직 출시하지 않았다.
- Cloudflare Pages에는 `apps/mobile/public/_redirects`가 웹 export에 복사되어 `/trips/*`를 동적 HTML 템플릿으로 연결한다. 다른 정적 호스팅에서도 같은 경로의 내부 rewrite를 설정해야 한다. [Pages 내부 proxy 규칙](https://developers.cloudflare.com/pages/configuration/redirects/).

## 5. 로컬 검증과 실제 인수

```powershell
npm run check
npm run test:auth
npm run test:foundation
npm run api:build
npm run build:web
npm run test:trail:web
npm run test:workspace:web
```

`api:build`는 staging **dry-run**이며 배포하지 않는다. SQL 검증은 실제 마이그레이션을 PGlite PostgreSQL에 적용한다. 전체 화면 검증은 격리된 Chrome과 Auth/API/Storage HTTP fixture로 실행한다. `test:workspace:web`는 테스트 공개 설정으로 번들을 생성하고 검증 후 일반 번들을 복원한다. 실제 제공자나 실제 OCR 정확도의 증거는 아니다.

실제 인수는 두 계정과 Android/iOS 기기에서 다음 순서를 확인한다.

1. 제공자별 최초 가입·재로그인·취소·세션 복원·로그아웃·계정 전환.
2. 여행 생성 → 날짜별 일정 → 비용 → 사진 → 앱 재실행/다른 기기 조회.
3. A 초대 → B 링크/로그인 → 뷰어 쓰기 거부 → 편집자 저장 → 취소/멤버 제거.
4. 영수증 촬영 → 후보 수정 → 기존/새 일정 확인 저장 → 응답 유실 재시도 → 합계 중복 없음.
5. 종료 → 공개 일정/사진/비용 선택 → 비멤버 피드 조회 → 원본 영수증 접근 거부 → 철회·신고·차단.

출시 전에 원격 PostgREST/Storage 정책·모바일 권한·동시 요청을 확인한다. 파일 업로드 후 메타데이터 등록을 중단하면 원본이 남을 수 있어 Storage와 `trip_media`의 미등록 원본 정리 작업이 필요하다. 등록 사진 삭제는 DB 참조 해제 후 실제 Storage 원본을 제거하며 실패하면 같은 요청으로 재시도한다. `mutation_requests`의 24시간 만료 행 청소와 신고 검토 운영도 준비한다.

계정 탈퇴·스토어 심사 자료·서비스 약관·운영 신고 관리 화면·의존성 취약점 대응은 출시 전 별도 완료해야 한다. 현재 구현만으로 스토어 출시 준비 완료나 앱 전체 실제 인수를 선언하지 않는다.
