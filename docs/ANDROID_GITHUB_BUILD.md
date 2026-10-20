# TripPrint 내부 테스트용 AAB 만들기

기준일: 2026-10-20. 사용자가 직접 빌드한 뒤 Google Play 내부 테스트에서 게스트·Google 로그인과 저장·재조회·공유를 확인합니다. 이번 개발 작업에서는 Android 빌드·Play 업로드를 실행하지 않았습니다.

기본 경로는 **GitHub Actions에서 AAB 생성 → 다운로드 → Play Console 수동 업로드**입니다. Expo 계정이나 Play 자동 제출용 서비스 계정 없이 사용할 수 있습니다. 앱은 기존 staging 서버를 사용합니다.

## 1. 소스와 버전

- 저장소: [Ji-ChangKim/travel_APP](https://github.com/Ji-ChangKim/travel_APP), 브랜치 `main`.
- 실행 화면: [Android Play Internal](https://github.com/Ji-ChangKim/travel_APP/actions/workflows/play-internal.yml).
- 앱 식별자: `com.tripprint.app`.
- 현재 버전: `ver.text`의 `versionCode=9`, `versionName=0.1.0`.
- **Play에서 9를 이미 사용했다면 `ver.text`를 사용한 최대 번호보다 큰 정수로 수정하고 커밋·푸시한 뒤 실행**합니다. 원격 Play의 사용 번호는 이번 작업에서 확인하지 않았습니다.
- 현재 workflow에는 `version_code` 입력란이 없습니다. 실행 번호로 자동 증가하지 않고 `ver.text`를 그대로 사용합니다.

`main` 푸시에는 일반 CI만 자동 실행됩니다. Android Play Internal과 서버·웹 배포는 수동 실행 전용입니다. 빌드 전 대상 커밋의 CI 결과를 확인합니다.

**현재 빌드 착수 조건:** 2026-10-20 푸시 전 검사에서 전체 웹 화면 회귀검사의 예전 메뉴·문구 기대값이 현재 UI와 맞지 않는 사례가 확인됐습니다. 핵심 보호 흐름을 보완했지만 전체 207건의 통과를 확인하지 않았습니다. Android workflow도 같은 검사를 필수로 실행하므로, 대상 커밋의 CI가 모두 통과한 뒤 아래 빌드를 시작합니다. 검사 단계를 건너뛰지 않습니다. 상세 결과는 [빌드 전 점검 기록](PLAY_INTERNAL_PREBUILD.txt)을 따릅니다.

## 2. GitHub Actions Secrets

[Settings → Secrets and variables → Actions](https://github.com/Ji-ChangKim/travel_APP/settings/secrets/actions)에서 아래 이름을 확인합니다. 올바르게 등록된 값은 다시 발급할 필요가 없습니다. 비밀 원문을 코드·문서·채팅에 넣지 않습니다.

| Secret                             | AAB 생성       | 용도                                  |
| ---------------------------------- | -------------- | ------------------------------------- |
| `GOOGLE_MAPS_ANDROID_API_KEY`      | 필수           | Android Google 지도 표시              |
| `ANDROID_KEYSTORE_BASE64`          | 필수           | 기존 Play 업로드 keystore의 Base64 값 |
| `ANDROID_KEYSTORE_PASSWORD`        | 필수           | keystore 비밀번호                     |
| `ANDROID_KEY_ALIAS`                | 필수           | 업로드 키 별칭                        |
| `ANDROID_KEY_PASSWORD`             | 필수           | 업로드 키 비밀번호                    |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | 자동 제출 시만 | `submit_play=true`인 경우 Play 제출   |

기존 Play 앱의 **업로드 키를 유지**합니다. 앱 서명 키와 업로드 키는 역할이 다릅니다. 이 안내를 따라 임의로 새 키를 만들거나 교체하지 않습니다. GitHub Secret의 등록·유효성은 빌드 계정에서 확인해야 하며 로컬 검사 통과로 대신하지 않습니다.

Android 지도 키는 Maps SDK for Android API 제한과 `com.tripprint.app`·**Play 앱 서명 인증서 SHA-1** 제한을 확인합니다. Play 설치본은 업로드 인증서와 구분합니다.

## 3. 서버 설정과 앱 공개 설정 구분

다음 공개 설정은 기존 `apps/mobile/eas.json`과 CI 준비 스크립트에서 전달합니다. 로컬 `.env`는 Git에 추가하지 않습니다.

| 공개 설정                           | 현재 값                                             |
| ----------------------------------- | --------------------------------------------------- |
| `EXPO_PUBLIC_BACKEND`               | `cloudflare`                                        |
| `EXPO_PUBLIC_API_URL`               | `https://tripprint-api-staging.gametps.workers.dev` |
| `EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL` | `https://tripprint-staging.pages.dev/auth/callback` |

Google OAuth 등록 콜백은 `https://tripprint-api-staging.gametps.workers.dev/api/auth/callback/google`, Android 앱 복귀는 `travelapp://auth/callback`입니다. OAuth 동의 화면이 테스트 상태라면 실제 로그인할 계정을 해당 OAuth 앱의 테스트 사용자에도 등록합니다. Play 내부 테스터 등록과는 별개입니다.

`AUTH_SECRET`·`GOOGLE_CLIENT_SECRET`·`GOOGLE_PLACES_API_KEY`는 **Cloudflare 서버 전용**입니다. Android 빌드 설정에 복사하지 않습니다. `GOOGLE_CLIENT_ID`는 서버 OAuth 설정을 유지합니다. 기존 staging 서버를 사용하므로 앱 빌드를 위해 서버를 다시 배포할 필요는 없습니다. 현재 서버·웹 검수 근거는 [보안 후속 보고](qa/SECURITY_P0_FOLLOWUP.txt)를 따릅니다.

**Stitch MCP 키는 개발 도구 설정 전용**이며 Android·웹·API 배포에 등록하지 않습니다.

## 4. 사용자가 AAB 생성 실행

1. [Android Play Internal](https://github.com/Ji-ChangKim/travel_APP/actions/workflows/play-internal.yml) → **Run workflow**를 엽니다.
2. **Branch: main**을 선택합니다.
3. `artifact_type`을 **`aab`**로 바꿉니다. 기본값은 `apk`입니다.
4. `submit_play`는 **체크 해제**합니다.
5. `release_status`는 **`draft`**로 둡니다. 제출을 끄면 이 값으로 Play 작업이 실행되지 않습니다.
6. 버전·Secrets를 확인한 뒤 사용자가 **Run workflow**를 눌러 시작합니다.

코드·API·인증·웹 흐름 검사 후 Android 프로젝트 생성과 Gradle 빌드가 진행됩니다. 성공한 실행의 **Artifacts → `tripprint-aab-9`**에서 ZIP을 받아 `app-release.aab`를 꺼냅니다. 버전 번호를 바꾸면 이름의 숫자도 바뀌며 파일 보관 기간은 14일입니다.

실패 시 `build-and-submit`의 실패 단계를 확인합니다. 키·서명 누락은 해당 설정을 바로잡고, 코드·검사 실패는 수정한 새 커밋으로 실행합니다. 검사 단계를 삭제하거나 강제로 성공 처리하지 않습니다.

## 5. Play Console 등록·설치

1. Play Console → TripPrint → **테스트 및 출시 → 테스트 → 내부 테스트**에서 새 버전을 만듭니다.
2. `app-release.aab`를 업로드하고 앱 식별자·versionCode·업로드 서명 검사를 확인합니다.
3. 릴리스 설명을 입력하고 Play Console의 검토 절차에 따라 내부 테스트 버전을 출시합니다.
4. 휴대폰에서 사용할 Google 계정이 내부 테스터 목록에 포함됐는지 확인합니다.
5. 같은 계정으로 참여 링크를 열어 참여한 뒤 Google Play에서 설치·업데이트합니다.
6. 빌드 커밋·앱 버전·AAB SHA-256·Play 릴리스를 함께 기록합니다. Windows에서는 `Get-FileHash -Algorithm SHA256 -LiteralPath 'AAB 절대경로'`로 해시를 확인할 수 있습니다.

CI 성공·AAB 생성·Play 등록·테스터 설치를 각각 확인합니다. 자동 제출을 원할 때만 서비스 계정 JSON과 권한을 준비해 `submit_play=true`를 선택합니다. 위 기본 경로에서는 자동 제출을 사용하지 않습니다.

## 6. 설치 후 검수

1. **게스트**: 여행·일정 저장 → 앱 종료·재실행 → 같은 기기 기록 복원.
2. **Google**: 실제 로그인 → 원래 여행 만들기·상세 복귀. 신규 회원은 생일 없이 프로필 설정 완료.
3. **회원 저장**: 여행·DAY 소개·장소 설명·개인 메모 저장 → 재실행·재로그인 → 서버 원문 재조회.
4. **공유**: 공개 항목 선택 → 미리보기 → 범위 확인 → 실제 링크 비교. 개인 메모·예약·동행·영수증 원본·인증 정보 제외 확인.
5. **예외**: 인증 취소·뒤로가기·백그라운드·계정 전환에서 중복 저장·이전 계정 노출 없음.

게스트 여행은 기기 전용이며 Google 회원 여행으로 자동 업로드되지 않습니다. 보존 확인 중 앱 삭제·데이터 초기화는 하지 않습니다. 자세한 기대 결과와 실패 양식은 [DEVICE_ACCEPTANCE.txt의 AUTH 항목](qa/DEVICE_ACCEPTANCE.txt)을 사용합니다. 실제 Google 로그인과 새 Play 설치본 결과는 사용자가 실행한 뒤 기록합니다.

## 선택 경로: EAS

EAS를 선택할 때만 `npm run eas:login` 후 `npm run mobile:build:play-internal`을 실행합니다. 이 명령은 **실제 AAB 빌드를 시작**합니다. 모바일의 `play-internal` 프로필은 Preview 환경·staging 주소·store 배포·app-bundle·로컬 버전을 사용하며 자동 제출을 요청하지 않습니다. EAS 접근 권한·기존 업로드 서명·Preview 환경의 `GOOGLE_MAPS_ANDROID_API_KEY`를 먼저 확인합니다.

공식 참고: [GitHub 수동 실행](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [Google Play 내부 테스트](https://support.google.com/googleplay/android-developer/answer/9845334?hl=ko), [Google 지도 키 보안](https://developers.google.com/maps/api-security-best-practices).
