# TripPrint 배포 준비와 실행

2026-10-07: 현재 Cloudflare D1·R2·Better Auth 구성과 TripPrint 새 주소 전환 상태는 [로그인·회원 설정 적용 안내](AUTH_ONBOARDING.md)를 따른다. 사용자 승인 후 `tripprint-api-staging`과 `tripprint-staging.pages.dev` 배포 및 테스트 D1 회원 설정 변경을 완료했다. `tripprint-api-production`은 미배포 목표다. [Google·Play 내부 테스트](GOOGLE_PLAY_INTERNAL_TEST.md)에 실제 계정 로그인과 AAB 준비 절차를 기록한다. 아래 Supabase 중심의 2026-10-03 기록은 당시 준비 내역이다.

빌드 단계별 완료 여부는 [빌드 준비 체크리스트](BUILD_CHECKLIST.md)에 기록한다.

**현재 작업 목표는 Android 내부 테스트용 MVP APK다.** 스토어 심사·제출과 운영 공개는 이번 빌드 조건에 포함하지 않는다. 먼저 [Android MVP 빌드](MVP_ANDROID_BUILD.md)를 따르고, 아래 production·스토어 항목은 추후 공개 단계에서 확인한다.

2026-10-03. 로컬 구현과 검증을 완료했으며, 이 문서는 **계정 설정 후 staging 배포 → 실제 인수 → production 배포** 순서를 정의한다. 현재 실제 Supabase·소셜 제공자·OCR 연결과 서명된 모바일 빌드는 완료하지 않았다. 환경 검사 성공은 원격 서비스 연결 성공을 의미하지 않는다.

## 1. 배포 구조와 준비 상태

| 대상    | 준비한 구성                                                  | 외부 준비                                                            |
| ------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| 웹      | Expo static export, `apps/mobile/dist`, 여행 UUID rewrite    | Cloudflare Pages 별도 staging/production 프로젝트, 실제 HTTPS 도메인 |
| API     | `tripprint-api-staging` / `tripprint-api-production` Workers | Cloudflare 계정, Worker secret, API 주소                             |
| DB·사진 | Supabase SQL 6개, RLS, private Storage                       | 환경별 프로젝트, 마이그레이션 적용, 백업                             |
| 로그인  | 카카오·구글·애플 PKCE 및 복귀 화면                           | 제공자 콘솔, Supabase 제공자 설정, redirect allowlist                |
| OCR     | Vision 서버 어댑터, 실패 시 수동 입력                        | Google Cloud Vision 활성화, 서버 전용 키                             |
| 모바일  | EAS development/preview/production 환경, 운영 번호 자동 증가 | Expo 계정 접근, 플랫폼 서명, 실제 기기 인수                          |

GitHub Pages 자동 공개를 Cloudflare Pages 수동 배포 워크플로로 교체했다. 현재 rewrite는 도메인 루트 배포를 전제로 한다. Pages 두 프로젝트 모두 production branch를 `main`으로 설정한다. staging도 자체 프로젝트의 기본 주소를 사용하므로 임의 preview 도메인을 OAuth 복귀 주소로 사용하지 않는다.

## 2. 외부 계정 설정 순서

1. [서비스 설정](APP_SERVICES_SETUP.md)과 [소셜 인증 설정](SOCIAL_AUTH_SETUP.md)에 따라 staging Supabase를 만들고 SQL을 순서대로 적용한다. 운영 DB에는 백업 후 검증한 마이그레이션만 적용한다. 워크플로는 DB를 자동 변경하지 않는다.
2. Cloudflare Direct Upload Pages 프로젝트를 staging/production별로 만들고 실제 도메인을 확정한다. API의 HTTPS workers.dev 또는 custom domain도 확정한다. 현재 자동화는 새 프로젝트를 만들거나 custom domain을 연결하지 않는다.
3. Supabase Site URL과 Redirect URLs에 해당 환경의 웹 `/auth/callback`과 모바일 `travelapp://auth/callback`을 설정한다. 제공자 측 callback은 Supabase가 안내하는 주소를 사용한다.
4. OCR 자동 인식을 테스트하려면 해당 Worker에 `GOOGLE_VISION_API_KEY`를 secret으로 등록한다. 앱 공개 설정에 넣지 않는다. staging MVP는 미등록 상태에서 영수증 수동 입력을 테스트할 수 있다. production은 필수 secret이 없으면 Wrangler 배포가 실패한다. 처음 secret을 등록하기 전 Worker가 존재하는지 확인한다.
5. production은 staging과 별도 Supabase·Pages·Worker를 사용한다. 현재 모바일 package와 scheme은 공유하므로 preview/production을 한 기기에 동시에 설치하는 구성은 아니다.

```powershell
& .\apps\api\node_modules\.bin\wrangler.cmd secret put GOOGLE_VISION_API_KEY --config apps/api/wrangler.jsonc --env staging
# 운영 환경은 --env production 사용
```

## 3. 로컬에서 배포용 설정과 산출물 준비

`.env.release.example`을 `.env.release`로 복사한 후 실제 공개 값을 입력한다. 기존 파일은 덮어쓰지 않는다. 이 파일은 Git에서 제외한다. Cloudflare 토큰·OCR 키·OAuth 비밀·관리자 Supabase 키는 넣지 않는다.

```powershell
Copy-Item -LiteralPath .env.release.example -Destination .env.release
npm run release:check
npm run check
npm run test:auth
npm run test:release
npm run test:foundation
npm run test:workspace:web
npm run release:prepare
```

`release:check`는 설정 형식만 검사한다. HTTPS origin, 웹 복귀 경로 일치, 공개 키 역할, localhost/fixture/예시 주소 미사용을 확인하며 키 값을 출력하지 않는다. 프로젝트 존재·공개 키 서명·실제 OAuth 등록은 확인하지 않는다.

`release:prepare`는 검증 후 개발용 .env 로딩을 끄고 Metro 캐시를 초기화하여 웹을 내보낸다. 진입 HTML과 `/trips/* /trips/[id] 200` 규칙, fixture 문자열 미포함을 확인하고 생성된 Worker 설정으로 dry-run 빌드를 실행한다. 원격 배포·DB 적용·스토어 업로드는 하지 않는다.

| 생성 결과                         | 용도                                              |
| --------------------------------- | ------------------------------------------------- |
| `apps/mobile/dist`                | Cloudflare Pages 업로드 디렉터리                  |
| `apps/api/.release/wrangler.json` | 선택 환경의 API 이름·동일 Supabase·허용 웹 origin |

생성 Worker 파일은 Git에서 제외되며 공개 설정만 포함한다. 원본 wrangler.jsonc의 호환 날짜, 필수 secret, 관측 설정을 유지한다. 배포에는 생성 파일을 사용하고 **추가 --env 옵션을 붙이지 않는다**. 설정을 바꾸면 반드시 다시 준비한다. 현재 외부 값이 없으므로 실제 배포용 release:prepare는 통과할 수 없다.

## 4. GitHub Actions 배포 설정

GitHub Settings → Environments에 `staging`, `production`을 만든다. production은 보호 브랜치와 required reviewer를 설정한다. 환경 보호 기능의 지원 여부는 저장소/요금제에 따라 확인한다. production은 인수가 완료된 main 커밋으로만 실행한다.

두 환경에 다음 **Variables**를 설정한다.

- `.env.release.example`의 7개 공개 값 중 `RELEASE_ENV`를 제외한 6개. 환경은 실행 시 선택한다.
- `CLOUDFLARE_ACCOUNT_ID`.

**Secrets**에는 `CLOUDFLARE_API_TOKEN`을 설정한다. Worker 배포와 Pages 배포 권한을 해당 계정에 한정한다. Google Vision 키는 GitHub가 아니라 Worker secret에 등록한다. `EXPO_NO_DOTENV=1`은 워크플로가 고정 설정한다.

Actions의 **Deploy Staging or Production**을 수동 실행한다. 설정 검사, 코드 품질, 인증·배포·SQL/API 테스트, 격리된 브라우저 흐름, 정적 산출물, Worker dry-run을 모두 통과한 뒤 API → 웹 순으로 배포한다. 웹 산출물은 7일 보관한다. CI는 배포하지 않는다. 실제 GitHub runner 실행은 계정 설정 후 확인해야 한다.

API와 웹은 두 개의 독립 배포이므로 원자적이지 않다. API 성공 후 웹 실패하면 기존 웹과 새 API가 공존한다. 첫 공개 시점과 변경마다 기존 계약 호환성을 유지한다. 해당 실패를 해결하거나 이전 API로 되돌린 후 다시 실행한다.

## 5. 모바일 빌드

모노레포의 실제 빌드 위치는 `apps/mobile`이다. EAS 프로젝트 ID와 owner는 기존 값을 유지했다. 계정의 소유/접근 권한과 package·bundleIdentifier를 확인한다. EAS 환경 `preview`에 staging 공개 설정, `production`에 운영 공개 설정 4개를 등록한다. EXPO_PUBLIC 값은 앱에 포함되므로 비밀을 넣지 않는다.

```powershell
npm run mobile:build:apk
# 실제 서명·운영 환경·스토어 준비가 완료된 후에만 실행
npm --workspace=@wherego/mobile run build:all
```

preview는 APK 내부 배포, production은 Android AAB / iOS 실기기 빌드다. 운영 빌드 번호는 EAS remote + autoIncrement로 관리한다. 스토어 자동 제출은 구성하지 않았다. 현재 클라우드 빌드나 store submit을 실행하지 않았다. [EAS 모노레포](https://docs.expo.dev/build-reference/build-with-monorepos/), [환경](https://docs.expo.dev/eas/environment-variables/usage/), [버전 관리](https://docs.expo.dev/build-reference/app-versions/).

## 6. staging 인수와 공개 전 남은 작업

[서비스 인수 절차](APP_SERVICES_SETUP.md)의 두 계정·실기기 검사 전부를 수행한다. `/health`만으로 인수를 완료하지 않는다. 실제 제공자 3개, 초대 로그인 복귀, 저장 재시도, 다른 기기 조회, 사진 권한, 영수증 정확도, 뷰어 쓰기 거부, 비멤버 영수증 접근 거부, 공개 철회·신고·차단을 검증한다. `/login`, `/invite`, `/auth/callback`, `/community`, `/trips/<실제 UUID>` 직접 접근과 새로고침도 확인한다.

운영 공개 전에는 개인정보처리방침·이용약관·계정 삭제 경로, 신고 처리 담당/절차, 원본 영수증 보존/삭제 정책, OCR 예산/쿼터, DB 백업/복구, 고아 파일·재시도 기록 정리, 의존성 취약점 대응을 확정해야 한다. 현재 앱은 스토어 심사 완료 상태가 아니다. 출시 체크를 완료한 것으로 임의 표시하지 않는다.

2026-10-03 `npm audit --omit=dev`는 high 19건, moderate 12건(총 31건)을 보고했다. Expo/Metro/React Native 및 관련 전이 의존성이 포함된다. 보고 수는 실제 배포 경로의 악용 가능성을 판정한 결과가 아니다. 자동 수정 제안에는 Expo 44 등 현재 SDK 57과 맞지 않는 변경이 포함되어 `audit fix --force`를 적용하지 않았다. 호환 가능한 보안 수정과 개별 advisory 영향 평가를 완료하기 전 production 공개 인수는 보류한다.

## 7. 장애와 롤백

Pages는 직전 정상 production 배포로 rollback하고 Worker는 정상 버전으로 rollback한다. 두 환경을 혼동하지 않는다. 배포 커밋·Worker 버전·Pages deployment ID·DB 마이그레이션 이력을 기록한다. DB 파괴적 변경은 앱 롤백으로 되돌아가지 않으므로 백업 복구 또는 전진 수정 계획을 별도로 준비한다. 개인 데이터·초대 토큰·OCR 원문은 로그에 기록하지 않는다.

[Pages CI 업로드](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Worker 설정](https://developers.cloudflare.com/workers/wrangler/configuration/).
