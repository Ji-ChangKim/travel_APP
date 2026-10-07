# TripPrint Android MVP 빌드

## Play Console 패키지명 일치

2026-10-07 사용자가 제공한 Play Console 화면의 앱은 `TripPrint: 여행을 기록하자`, Android 패키지명은 `com.tripprint.app`이다. 루트 `app.config.ts`와 `apps/mobile/app.config.ts`의 `android.package`를 모두 `com.tripprint.app`으로 변경했다. 루트 또는 모바일 디렉터리에서 빌드해도 같은 Play 앱 식별자를 사용한다. 기기에 표시되는 이름은 `TripPrint`이며, iOS 식별자·앱 복귀 scheme·Expo 프로젝트 ID는 기존 설정을 사용한다.

이 수정은 다음 Android 빌드에 적용된다. 기존 APK는 바뀌지 않으며, 이전 `com.travelapp.mobile` 설치본과 새 설치본은 Android에서 서로 다른 앱으로 취급된다. 이전 설치본의 기기 저장 정보와 로그인 상태가 새 앱으로 자동 이전되지는 않는다. Play Console 업로드용 AAB도 `com.tripprint.app`과 해당 앱의 업로드 서명 키로 새로 빌드해야 한다. 이번 수정은 실제 APK/AAB 생성이나 Play Console 업로드를 실행하지 않는다. 구글 웹 OAuth 클라이언트의 서버 콜백 주소는 패키지명 변경으로 바뀌지 않는다.

아래는 2026-10-06 빌드 준비 기록이다. 최신 Google 로그인과 TripPrint 서버·웹 주소 적용 상태는 [로그인·회원 설정 적용 안내](AUTH_ONBOARDING.md)를 확인한다.

2026-10-07 Play Console 내부 테스트용 `play-internal` AAB 프로필을 루트와 모바일 EAS 설정에 추가했다. 실제 내부 테스트 설치를 위한 최신 절차는 [Google·Play 내부 테스트](GOOGLE_PLAY_INTERNAL_TEST.md)를 따른다. `npm run mobile:build:play-internal`은 테스트 서버 설정으로 AAB를 생성하고, `npm run mobile:build:apk`는 직접 설치용 APK를 생성한다. 현재 Expo CLI 로그인을 기다리므로 두 빌드 모두 아직 실행하지 않았다.

## 기존 빌드 준비 기록

2026-10-06. 현재 MVP는 Cloudflare D1·R2와 실제 이메일 로그인으로 동작한다. [웹](https://wherego-staging.pages.dev), [전환·배포 보고](CLOUDFLARE_MVP_DEPLOYMENT_20261006.md).

APK는 Expo EAS preview에서 생성한다. 현재 Android Hermes 번들/네이티브 연결 검사는 통과했고, 실제 APK 빌드는 Expo 로그인 완료를 기다린다. `.hbc`는 설치 파일이 아니다.

1. 프로젝트 루트에서 `npx --yes eas-cli login`으로 직접 로그인한다. 비밀번호와 토큰은 Git이나 채팅에 올리지 않는다.
2. `npx --yes eas-cli whoami`로 확인한다. 기존 owner `rupang`, project `3b23b462-262c-4b64-aff2-5fb03280e6b5` 접근 권한이 필요하다.
3. `npm run mvp:check`, `npm run mvp:prepare`로 실제 공개 설정과 Android 번들을 확인한다.
4. `npm run mobile:build:apk`로 preview APK를 빌드한다. 최초 서명 키가 없으면 EAS keystore 생성/권한 설정이 필요할 수 있다.
5. EAS의 완료된 빌드에서 APK를 받아 Android 기기에 설치하고 카메라·공유 인텐트·로그인 복원·동행 초대를 검증한다.

`apps/mobile/eas.json` preview에는 다음 공개 값이 이미 고정돼 있다. Supabase 공개 키는 필요하지 않다.

- `EXPO_PUBLIC_BACKEND=cloudflare`
- `EXPO_PUBLIC_API_URL=https://wherego-api-staging.gametps.workers.dev`
- `EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL=https://wherego-staging.pages.dev/auth/callback`
- `EXPO_NO_DOTENV=1`

서버 `AUTH_SECRET`과 Google 공급자 비밀은 앱에 넣지 않는다. 자동 Google Places/Vision과 소셜 인증은 현재 미연결이고, 수동 일정·사진·영수증 확인 저장을 사용할 수 있다. 현재 배포는 MVP 스테이징이며 Play Store 제출/심사/운영 공개는 완료하지 않았다.

## Android 1차 테스트 케이스

[TripPrint Android MVP TC](../outputs/01a10ed6-dad9-7bb0-b46f-02dec62a5c9e/TripPrint_Android_MVP_TC_20261006.xlsx)에 실행 가능한 62개 케이스를 정리했다. P0 28개를 먼저 실행한 뒤 나머지 입력 검증·복원·예외·사용성 케이스를 진행한다. 테스트안내 시트에 APK URL·EAS Build ID·versionCode·기기·테스터를 입력하고 TC 시트의 상태·실제 결과·일시·증거를 기록한다.

계정 A는 소유자, B는 조회자, C는 비멤버/편집자 검사를 위한 독립 테스트 계정이다. 동행 권한·동시 편집은 기기 2대 또는 별도 웹 프로필로 확인한다. 사진은 현재 `tripprint-staging-private` 비공개 R2에 연결된다. 웹/API QA가 필요한 케이스는 실행 환경 열에 표시했다.

2026-10-06 재확인한 `eas-cli whoami`는 `Not logged in`이었다. 현재 실기기 TC는 모두 미실행이며 이전 자동 검사나 Android 번들 성공을 실기기 통과로 처리하지 않는다. 실제 소셜 성공·자동 OCR/Places·메일·즐겨찾기 전체 동기화·iOS 실기기 배포는 연결·기획 후 별도 검사한다.

EAS preview APK를 설치해 테스트하는 방식은 [Expo 내부 배포 문서](https://docs.expo.dev/build/internal-distribution/)와 [APK 생성 문서](https://docs.expo.dev/build-reference/apk/)를 따른다.

## 이전 시작 화면이 나오는 경우

2026-10-06 루트 EAS 설정이 예전 `src/app/index.tsx`를 선택하는 문제를 실제 Expo CLI 경로 검사로 재현했다. 현재 루트 설정은 `apps/mobile/src/app`을 명시하여 모바일 경로에서 실행한 빌드와 동일한 TripPrint 화면을 사용한다. `npm run test:release`에서 두 빌드 경로를 모두 검사한다. 루트 preview 빌드에도 공개 백엔드 설정 검사를 적용했다.

GitHub 연결로 빌드할 때는 최신 변경을 커밋·푸시하고 Expo 프로젝트의 GitHub 설정에서 Base directory를 `apps/mobile`, 브랜치를 `main`, Build profile을 `preview`로 지정한다. [Expo 모노레포 빌드 문서](https://docs.expo.dev/build-reference/build-with-monorepos/)에서 권장하는 앱 디렉터리를 기준으로 빌드한다. 루트 설정의 경로 지정은 기존 루트 빌드와의 호환용이다.

완료된 APK에는 빌드 당시 소스가 들어 있다. Git 푸시나 웹/API 배포로 기존 APK가 바뀌지는 않는다. 수정 후 새 EAS preview 빌드를 생성하고, 새 Build ID의 APK를 설치해야 한다. 로컬에서는 프로젝트 루트에서 `npm --workspace=@wherego/mobile run build:apk -- --clear-cache`로 빌드한다. EAS 빌드 상세의 Git commit hash와 실제 최신 커밋을 비교하고, 설치 후 TripPrint 아이콘 → 브랜드 로딩 → 로그인 화면을 확인한다. 로그인 세션이 있으면 여행 화면으로 이동한다.

사용자가 제시한 Build ID `dc9129fa-2494-44f3-b9d0-87c27932ca37`의 소스 커밋과 작업 디렉터리는 현재 CLI 계정이 로그아웃되어 확인하지 못했다. 위 문제는 로컬에서 재현한 원인이며, 해당 원격 빌드의 사용 소스는 별도 확인이 필요하다.

수정 검증: `npm run check` 전체 통과, `npm run test:release` 20/20 통과. 루트에서도 실제 공개 스테이징 설정으로 Android Hermes export를 성공했다. 소스맵에 현재 `apps/mobile/src/app/index.tsx`, `login.tsx`, `TripPrintLoading.tsx`가 포함되고 이전 루트 시작 화면은 포함되지 않는 것을 확인했다. 로고 PNG도 내보낸 자산에 포함됐다. 검증 번들은 `.release/android-root/_expo/static/js/android/entry-c80d3159bd0c01e783dba84dd8a2587f.hbc`이며 APK나 실기기 테스트 성공을 의미하지 않는다.
