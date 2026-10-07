# 로그인·회원 설정 적용 안내

앱 최초 실행은 세션 복원 → 로그인/게스트 선택 → 신규 회원 프로필 설정 → 홈 순서로 진행한다. 게스트는 서버 회원 UUID와 서명 토큰을 발급받아 일정을 저장한다. 기존 이메일 회원은 마이그레이션에서 설정 완료 상태를 보존한다. 신규 일반 회원은 닉네임·성별·생년월일을 저장해야 설정이 완료된다.

## 서버 적용

2026-10-07 사용자 승인 후 `apps/api/migrations/0005_member_onboarding.sql`을 기존 0001~0004 다음에 원격 테스트 D1에 적용하고 새 API → 웹 순으로 배포했다. 원격 마이그레이션 목록에서 미적용 항목이 없는 것을 확인했다. 실제 APK/AAB 빌드와 Google 계정의 성공 로그인은 아직 완료하지 않았다. 설치 테스트 절차는 [Google·Play 내부 테스트](GOOGLE_PLAY_INTERNAL_TEST.md)를 따른다.

## SNS 앱 등록

### TripPrint 배포 주소 전환

2026-10-07 서비스 이름을 TripPrint에 맞추고 아래 테스트 API와 웹 주소에 배포했다. 기존 `wherego` 주소는 이전 테스트 배포 주소이며 이번 변경으로 삭제하지 않았다.

- API Worker: `tripprint-api-staging`
- 웹 Pages 프로젝트: `tripprint-staging`
- API: `https://tripprint-api-staging.gametps.workers.dev`
- 웹: `https://tripprint-staging.pages.dev`
- Google 콘솔에 등록할 Redirect URI: `https://tripprint-api-staging.gametps.workers.dev/api/auth/callback/google`
- 웹 앱 복귀 주소: `https://tripprint-staging.pages.dev/auth/callback`

새 Worker에는 `AUTH_SECRET`과 사용하는 제공자의 비밀 키를 별도로 등록해야 한다. 새 Pages 프로젝트의 기본 주소가 위 주소인지 확인한 후 API → 웹 → 모바일 순으로 배포한다. GitHub 환경 Variables와 EAS 원격 환경의 공개 주소도 함께 변경한다. 기존 D1의 이름·ID와 R2 바인딩은 유지하여 기존 회원·여행 데이터를 사용한다. `0005_member_onboarding.sql` 적용과 새 API의 게스트 인증·회원 조회·Google 로그인 검증을 마친 뒤 새 주소를 사용한다. 이전 Worker·Pages는 이 설정 변경으로 삭제되지 않는다.

2026-10-07 Google 웹 OAuth 클라이언트 `TripPrint-dev` 등록 및 사용자가 전달한 JSON의 콜백 주소 검증을 완료했다. 카카오·네이버는 미등록 상태다. 다음 값이 서버에 설정된 제공자만 로그인 버튼이 활성화된다. Client Secret은 Wrangler secret 또는 Cloudflare 대시보드의 암호화된 비밀 변수로 저장하고 앱 공개 환경 변수에 넣지 않는다.

Google JSON은 Git 제외 경로 `docs/98. keys/google-oauth-client.json`에 보관했다. 공개 Client ID만 `.env.release`와 생성된 `apps/api/.release/wrangler.json`에 반영했다. 새 Worker에 등록할 입력 파일은 Git 제외 경로 `.release/google-login/worker-secrets.json`이며, `AUTH_SECRET`과 `GOOGLE_CLIENT_SECRET` 두 항목만 포함한다. 비밀 원문은 소스·웹 번들·로그에 기록하지 않는다.

새 Worker 비밀 키 등록은 처음에는 자동 승인 검토가 명시적 원격 등록 승인이 없다는 사유로 차단했다. 이후 사용자가 두 키 등록과 테스트 DB·API·웹 배포를 명시적으로 승인하여 모두 적용했다. `AUTH_SECRET`·`GOOGLE_CLIENT_SECRET` 두 항목만 등록했고, 기존 staging D1에 `0005_member_onboarding.sql`을 적용했다. API 버전은 `b23e81c4-22ca-426d-bd54-c2eda8af8b0d`, 웹 고정 배포는 `https://090f6fd0.tripprint-staging.pages.dev`, 릴리스는 `test-1-google-auth`다. 기존 Worker·Pages는 삭제하지 않았다.

원격 D1 전체 로컬 내보내기는 자동 승인 검토가 민감한 데이터의 대량 복제라는 사유로 차단했다. 전체 데이터를 복사하지 않고 Cloudflare Time Travel의 변경 전 복구 지점 식별값만 `.release/google-login/d1-bookmark-before-onboarding.json`에 기록했다. 계정 식별값 중복 그룹 수는 0이며, `0005` 한 개만 미적용인 것을 확인했다. 복구 지점 조회는 복원을 실행하지 않는다.

준비 검증: `npm run check`, `npm run release:prepare`, 릴리스 설정 테스트 7개, D1 런타임 테스트 8개를 통과했다. 별도 로컬 Workers 런타임에서 Google 활성 상태 → 인증 준비 → Google 인증 URL 생성 → 정확한 서버 callback·PKCE S256·state cookie → 동일 시작 주소 재사용 거부를 확인했다. 로컬 검증은 실제 구글 계정을 생성하거나 인증을 위조하지 않으며, 구글 계정의 실제 성공 로그인·신규 회원 설정·게스트 기록 이전은 원격 적용 후 별도로 확인해야 한다. 전체 웹 파일에서 실제 두 비밀 키의 원문 미포함을 검사했다.

원격 적용 후 실제 서버의 `/health`, Google만 활성화된 제공자 상태, 인증 준비·Google URL 생성·정확한 Client ID/Redirect URI·PKCE·state cookie·취소 후 웹 복귀·시작 URL 재사용 거부·CORS가 통과했다. `.release/google-login/live-verification.json`은 민감한 URL·토큰 없이 판정만 기록한다. 이 검증은 실제 Google 계정의 인증 성공을 뜻하지 않는다.

| 제공자 | 서버 Client ID                | 서버 비밀 키         | 콘솔에 등록할 Redirect URI                 |
| ------ | ----------------------------- | -------------------- | ------------------------------------------ |
| Google | GOOGLE_CLIENT_ID              | GOOGLE_CLIENT_SECRET | `{AUTH_BASE_URL}/api/auth/callback/google` |
| Kakao  | KAKAO_CLIENT_ID (REST API 키) | KAKAO_CLIENT_SECRET  | `{AUTH_BASE_URL}/api/auth/callback/kakao`  |
| Naver  | NAVER_CLIENT_ID               | NAVER_CLIENT_SECRET  | `{AUTH_BASE_URL}/api/auth/callback/naver`  |

구글 OAuth 웹 클라이언트, 카카오 로그인 활성화·Redirect URI·이메일 동의 항목, 네이버 로그인 앱의 프로필 동의를 설정한다. 카카오의 기본 인증 어댑터는 이메일 제공이 필요하다. 네이버는 이메일 미제공 시 고유 연동 ID에서 비전송용 주소를 생성한다. 성별·생년월일은 앱에서 직접 입력받으며 제공자에서 가져오지 않는다.

웹의 `EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL`은 허용 Origin의 `/auth/callback`으로 지정한다. 모바일 복귀 주소는 `travelapp://auth/callback`이다. 제공자에는 앱 scheme 대신 위 서버 Redirect URI를 등록한다. 서버 인증 완료 후 앱으로 일회용 코드를 전달하며 기기에 보관한 SHA-256 검증자로 60초 이내 한 번만 교환한다. 인증 시도는 10분 후 만료하며 새 준비 요청에서 만료 레코드를 정리한다.

게스트는 마이의 **계정 연결하기**에서 SNS 또는 이메일 인증을 완료한다. 기존 게스트 세션은 연결 완료 전까지 유지한다. 서버가 확인한 게스트 계정의 여행 소유권·멤버십·스냅샷·사진 접근권한을 같은 D1 batch로 옮기고 게스트 세션을 철회한다. 이메일이 같다는 이유로 두 일반 회원을 자동 연결하지 않는다. 게스트를 다른 두 계정에 동시에 연결하는 요청은 DB 제약으로 거부한다.

## 알림 및 화면 검증

SNS 비밀 키는 선택 사항이므로 미등록 상태에서도 게스트·이메일 인증을 배포할 수 있다. 배포 설정 생성 시 Client ID는 `.env.release`의 위 서버 변수명 또는 환경별 `wrangler.jsonc` 값을 유지한다. Client Secret은 생성 파일에 복사하지 않고 해당 Worker의 secret으로 등록한다. 로그인 전 받은 초대·OS 장소 공유는 임시 보관하고 인증 및 회원 설정 후 원래 화면에서 이어간다.

`expo-notifications`는 Expo SDK 호환 버전으로 추가했다. 새 네이티브 빌드가 필요하다. 실행 시 짧은 알림 권한 안내를 제공하며 사용자가 **알림 허용하기**를 누르면 운영체제 권한 창이 열린다. 거절/나중에 선택은 기억하며 기기 설정에서 다시 허용할 수 있다. 허용하면 실제 예정 여행의 출발일 오전 9시(기기 시간대)에 로컬 알림을 예약하고, 여행 변경·로그아웃 때 갱신/철회한다. 원격 Push 서비스는 이번 범위에 포함하지 않는다.

하단 내비게이션은 루트 스택과 별도 영역에 있어 상세·생성·편집 화면에서 유지한다. 앱 자체 모달은 화면 영역 안에 표시한다. SNS 브라우저와 운영체제 권한 창은 운영체제 화면이다. 로그인/프로필 설정을 마치기 전에는 메뉴를 표시하되 이동은 비활성화한다.

SNS 실제 성공·취소·재시도와 게스트 연결은 콘솔 등록 후 각 제공자와 실기기에서 추가 인수 검증이 필요하다. 네이티브 권한 창과 실제 알림 수신도 새 APK/IPA 실기기에서 확인한다.

참고: [Better Auth anonymous](https://better-auth.com/docs/plugins/anonymous), [Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth), [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [네이버 API](https://developers.naver.com/docs/login/api/api.md).
