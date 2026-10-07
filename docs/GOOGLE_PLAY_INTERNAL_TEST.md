# TripPrint 구글 로그인과 Play 내부 테스트

2026-10-07 현재 목표는 실제 Google 로그인 검증과 Play Console 내부 테스트에서 앱을 설치하는 것이다. Android 앱 식별자는 `com.tripprint.app`이다. Google OAuth 클라이언트 관리 이름은 `TripPrint-dev`이며 웹 애플리케이션 유형을 사용한다.

## 준비 상태

- Google JSON의 Client ID·Client Secret 존재와 Redirect URI를 확인했다. 원문은 Git 제외 폴더에 보관한다.
- 현재 테스트 서버 주소는 `https://tripprint-api-staging.gametps.workers.dev`, 웹 주소는 `https://tripprint-staging.pages.dev`다.
- Google에 등록한 Redirect URI는 `https://tripprint-api-staging.gametps.workers.dev/api/auth/callback/google`다.
- 사용자 승인 후 새 Worker에 `AUTH_SECRET`과 `GOOGLE_CLIENT_SECRET` 두 키만 등록했다.
- 기존 D1의 `0005_member_onboarding.sql`과 새 API·웹 배포를 완료했다. API 버전은 `b23e81c4-22ca-426d-bd54-c2eda8af8b0d`, 고정 웹 배포는 `https://090f6fd0.tripprint-staging.pages.dev`다.
- 실제 서버의 Google 활성 상태·인증 시작·PKCE·state·정확한 콜백·취소 복귀·재사용 거부·CORS를 확인했다. 실제 계정 성공 로그인은 사용자의 계정 선택·동의 후 확인해야 한다.
- Expo CLI는 현재 로그아웃 상태다. 사용자가 직접 로그인해야 실제 클라우드 빌드·서명 설정을 확인할 수 있다.
- 실제 구글 계정 성공 로그인·실기기 설치·Play 내부 테스트 출시는 아직 미실행이다.

로컬 검증: `npm run check` 전체 통과, 릴리스 설정·빌드 hook 테스트 13개 통과, 루트·모바일 Android 네이티브 연결 검사 2개 통과, 배포 웹 산출물 검사 통과. `play-internal`은 서버 공개 설정이 누락되면 빌드를 중단한다. `.env.mvp`도 새 TripPrint 공개 주소로 일치시켰다. `npm run mvp:prepare`의 Android Hermes 번들 생성도 통과했다. 생성된 `.hbc`에 실제 TripPrint API 주소 포함 및 두 서버 비밀 키 원문 미포함을 확인했다. `.hbc`는 설치할 APK/AAB가 아니다.

실제 웹 검증: 새 Chrome 세션에서 Google 버튼이 활성화되고 카카오·네이버 버튼은 비활성화된 것을 확인했다. Google 클릭 후 OAuth 오류가 없는 `/v3/signin/identifier` 로그인 입력 화면에 도착했다. 계정 입력·동의는 자동 수행하지 않았다. 판정은 `.release/google-login/web-verification.json`에, 로그인 화면은 `.release/google-login/tripprint-google-login-ready.png`에 보관한다. 배포 `release.json`의 릴리스 `test-1-google-auth` 및 API 주소도 일치한다.

## 구글 로그인 검증 순서

1. 새 서버 적용 후 API `/health`와 `/api/social/providers`를 확인한다. Google만 사용 가능한 상태인지 검사한다.
2. 새 웹의 로그인 화면에서 **구글로 계속하기**를 선택한다. 실제 Google 계정 선택과 동의는 사용자가 진행한다.
3. 신규 회원이면 닉네임·성별·생년월일을 저장하고 홈으로 이동하는지 확인한다.
4. 앱 종료·재실행 후 로그인과 회원 정보가 복원되는지 확인한다.
5. 로그아웃 → 구글 로그인 취소 → 재시도를 확인한다. 취소한 경우 계정이나 완료되지 않은 회원 설정을 성공으로 표시하지 않아야 한다.
6. 게스트로 여행 하나를 만든 뒤 **마이 → 계정 연결하기**에서 Google 로그인한다. 기존 여행이 유지되고 게스트 인증은 철회되는지 확인한다.
7. 내부 테스트 앱에서도 외부 인증 브라우저가 열리고, 인증 후 `travelapp://auth/callback`으로 새 앱에 복귀하여 위 절차가 동작하는지 확인한다.

서버의 준비·PKCE·state·일회용 교환 검사 성공은 Google 계정의 실제 인증 성공과 다르다. 인수 결과는 실제 실행한 단계만 완료로 기록한다. 사용자 정보·로그인 토큰·OAuth 비밀은 검증 로그나 문서에 기록하지 않는다.

## Play Console 내부 테스트 빌드

Play 내부 테스트에 업로드하는 파일은 AAB다. Google Play가 기기에 맞는 APK를 만들어 설치한다. APK 파일을 직접 내려받아 설치할 때는 기존 `preview` 프로필을 사용한다.

루트와 모바일 `eas.json`에 `play-internal` 프로필을 추가했다. `preview`의 테스트 서버 공개 설정·버전 번호 자동 증가·preview 환경을 상속하고 `distribution: store`, `android.buildType: app-bundle`을 사용한다. 기존 운영 production 프로필을 테스트 서버로 바꾸지 않는다. EAS 빌드 hook은 `preview`와 `play-internal` 모두에서 서버 공개 설정 누락을 차단한다.

Expo의 **GitHub에서 빌드를 시작하세요** 화면에서도 같은 프로필을 사용할 수 있다. GitHub 빌드에 사용할 Android 이미지는 `latest`로 지정했다. 입력값은 기본 디렉터리 `apps/mobile`, 플랫폼 Android, Git 참조 `main`, EAS 빌드 프로필 `play-internal`, 환경 `Preview`다. 한국어 자동 번역 화면에서는 Preview가 **시사**로 표시될 수 있다. EAS 제출은 체크하지 않고 완성된 AAB를 Play Console에 직접 업로드한다. 현재 빌드 설정은 배포된 staging 서버를 사용한다.

GitHub 빌드는 Android 서명 자격 증명이 미리 준비되어 있어야 한다. 서명 키가 없거나 초기 설정 오류가 나오면 아래 터미널 빌드 절차로 서명 키 설정과 첫 빌드를 완료한 뒤 GitHub 빌드를 사용한다.

1. 프로젝트 루트 터미널에서 `npm run eas:login`을 실행해 직접 로그인한다. 비밀번호는 채팅에 보내지 않는다. 연결된 Expo 프로젝트 소유자는 `rupang`이며 ID는 `3b23b462-262c-4b64-aff2-5fb03280e6b5`다.
2. 해당 계정에서 프로젝트 접근과 `com.tripprint.app`의 Android 업로드 서명 키를 확인한다. 기존 Play 업로드 키가 있으면 그 키를 사용한다. 처음 빌드하는 경우 EAS의 keystore 생성 절차를 따른다. 서명 키 파일·비밀번호를 Git에 넣지 않는다.
3. 실제 Google 로그인 검증 후 `npm run mobile:build:play-internal`로 AAB를 생성한다.
4. 완료된 Build ID와 AAB 파일을 확인한다. Play Console의 **TripPrint → 테스트 및 출시 → 테스트 → 내부 테스트 → 새 버전 만들기**에서 AAB를 업로드한다.
5. 내부 테스터에 설치할 Google 계정을 추가하고 내부 테스트 버전을 출시한다. 테스터 참여 링크를 해당 기기에서 열어 참여한 뒤 Google Play로 설치한다.
6. 설치된 앱에서 Google 로그인·회원 설정·게스트 연결·로그인 복원·하단 메뉴·알림 권한 안내를 검사한다.

Play Console에 서비스를 업로드하는 계정 인증·테스터 목록·업로드 서명 키 확인이 필요하다. 현재 코드 설정만으로 Play Console 출시가 완료되지는 않는다. 첫 업로드는 콘솔에서 진행할 수 있으며, Play API 서비스 계정 키가 없는 상태를 자동 제출 성공으로 표시하지 않는다.

## GitHub Actions에서 직접 실행하고 확인하기

`.github/workflows/play-internal.yml`의 **Android Play Internal**은 `workflow_dispatch` 실행 버튼으로만 시작한다. main 푸시와 PR은 이 앱 제출 workflow를 실행하지 않는다. main의 코드 품질·인증·릴리스 검사를 통과하면 `apps/mobile`에서 AAB 빌드를 완료할 때까지 기다린다. 결과에서 완료된 Android 빌드 ID 하나를 검증하고 그 ID를 EAS Submit에 지정한다. 제출도 완료할 때까지 기다리며 실패하면 해당 실행은 실패로 기록한다. `--latest`로 다른 실행의 산출물을 제출하지 않는다.

처음 한 번 준비할 항목:

1. Expo에서 `com.tripprint.app`의 업로드 서명 키와 첫 Android 빌드를 준비한다. 기존 업로드 키가 있으면 유지한다.
2. [Expo 계정 설정](https://expo.dev/settings/access-tokens)에서 프로젝트 접근 권한이 있는 계정의 Access Token을 생성한다. [저장소 Actions Secrets](https://github.com/Ji-ChangKim/travel_APP/settings/secrets/actions)에 `EXPO_TOKEN`이라는 Repository secret으로 저장한다. 토큰 원문을 코드·채팅·로그에 넣지 않는다.
3. Google Cloud에서 **Google Play Android Developer API**를 활성화하고 서비스 계정을 만든다. **IAM 및 관리자 → 서비스 계정 → 해당 계정 → 키 → 키 추가 → 새 키 만들기 → JSON**으로 제출용 키를 발급한다. 서비스 계정 키는 이전에 받은 로그인 OAuth 클라이언트 JSON과 다르다.
4. Play Console의 **사용자 및 권한 → 새 사용자 초대**에서 서비스 계정 이메일을 추가한다. TripPrint 앱에 필요한 앱 정보 보기와 테스트 트랙 출시 권한을 부여한다. 테스터 목록은 사람이 콘솔에서 관리한다.
5. Expo 프로젝트의 **Credentials → Android → com.tripprint.app → Service Credentials → Add a Google Service Account Key**에 JSON을 업로드한다. 이 구성은 키를 EAS에서 관리하므로 제출 JSON을 GitHub 저장소나 Actions Secrets에 추가하지 않는다.

[Android Play Internal 실행 화면](https://github.com/Ji-ChangKim/travel_APP/actions/workflows/play-internal.yml)에서 **Run workflow → Branch: main → release_status → Run workflow**를 선택한다.

| release_status | Play에 반영되는 결과         | 설치 확인                                                          |
| -------------- | ---------------------------- | ------------------------------------------------------------------ |
| `draft`        | 내부 테스트 초안에 AAB 등록  | Play Console에서 초안을 검토하고 내부 테스트 출시를 완료한 뒤 설치 |
| `completed`    | 내부 테스트 트랙에 출시 요청 | 콘솔의 처리·심사와 배포 상태를 확인한 뒤 테스터 참여 링크로 설치   |

처음에는 `draft`를 선택해 앱 초안과 서명·콘솔 설정을 확인한다. 준비된 앱의 후속 배포에는 `completed`를 선택할 수 있다. 새로운 버전을 올릴 때마다 EAS의 원격 versionCode가 증가한다. 기존 초안이나 미완료 출시가 있으면 먼저 해당 버전의 상태를 콘솔에서 확인한다.

배포 후 확인 위치:

- **GitHub → Actions → Android Play Internal → 실행 기록 → build-and-submit**: 실패한 단계와 로그, Summary의 Build ID·제출 상태를 확인한다. 녹색 성공은 선택한 상태로 제출 명령이 성공했다는 의미다. 실제 설치 가능 여부는 Play의 상태로 확인한다.
- **Expo 프로젝트 → Builds / Submissions**: Build ID가 같은 Android AAB와 제출 작업 결과를 확인한다. 빌드 성공과 제출 성공은 각각 확인한다.
- **Play Console → TripPrint → 테스트 및 출시 → 테스트 → 내부 테스트 → 버전**: versionCode와 초안·출시 상태를 확인한다. 전체 트랙의 결과는 **최신 버전 및 번들**, 심사·출시 진행은 **게시 개요**에서 확인한다.
- **Play Console → 내부 테스트 → 테스터**: 휴대폰의 Play 계정을 목록에 추가하고 참여 링크를 복사한다. 휴대폰에서 같은 계정으로 참여해 설치 또는 업데이트한다.

GitHub Actions와 EAS Submit은 AAB 빌드·업로드·내부 테스트 등록을 자동화한다. 공개 운영 트랙 승격은 이 workflow에 포함하지 않는다. Google 심사 승인을 보장하지 않으며, 첫 내부 출시도 콘솔 상태에 따라 심사가 필요할 수 있다. Actions·EAS 빌드는 계정의 실행 시간과 빌드 한도를 사용한다. 토큰·제출 자격 등록과 실제 workflow 실행·Play 제출은 아직 확인하지 않았다.

참고: [Expo APK와 AAB](https://docs.expo.dev/build-reference/apk/), [Google Play 내부 테스트](https://support.google.com/googleplay/android-developer/answer/9845334?hl=ko), [Expo Android 제출](https://docs.expo.dev/submit/android/).
