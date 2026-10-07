# GitHub에서 직접 TripPrint Android 빌드하기

현재 Android Play Internal은 GitHub Linux 실행 환경에서 Gradle로 APK·AAB를 만든다. EXPO_TOKEN 검사와 EAS Build·Submit 호출을 제거했다. Expo 계정·로그인·빌드 서비스를 사용하지 않는다. 앱의 Expo SDK와 Router는 유지하며 로컬 Expo CLI는 네이티브 프로젝트 생성과 JS 번들 묶기에 사용한다.

## APK 다운로드

1. [Android Play Internal](https://github.com/Ji-ChangKim/travel_APP/actions/workflows/play-internal.yml)을 연다.
2. **Run workflow → Branch: main → artifact_type: apk**를 선택한다.
3. **submit_play는 체크 해제**한다. version_code는 처음에는 비워 둔다.
4. Run workflow를 눌러 실행 기록의 `build-and-submit` 로그를 확인한다.
5. 완료된 실행 화면 하단 **Artifacts → tripprint-apk-버전**에서 ZIP을 받고 압축을 푼다.
6. `app-release.apk`를 휴대폰으로 옮겨 설치한다.

서명 키가 없으면 기본 테스트 키로 서명한 release APK를 만든다. JS 번들이 포함되어 Metro 서버 없이 실행한다. 업로드 서명 키가 등록되어 있으면 해당 키로 APK를 서명한다. 테스트 키 APK와 Play 서명 앱은 서로 덮어 설치할 수 없으므로 설치 경로를 바꿀 때 기존 기록과 계정 상태를 확인한다.

## AAB와 Play 내부 테스트

| 실행 목적                     | artifact_type | submit_play | 준비                                       |
| ----------------------------- | ------------- | ----------- | ------------------------------------------ |
| 직접 설치 파일 다운로드       | `apk`         | 체크 해제   | 없음                                       |
| Play에 직접 올릴 AAB 다운로드 | `aab`         | 체크 해제   | 업로드 서명 Secrets 4개                    |
| Play 내부 테스트 자동 제출    | `aab`         | 체크        | 업로드 서명 Secrets 4개와 서비스 계정 JSON |

Play 제출을 선택하면 release_status의 `draft`는 초안 등록, `completed`는 내부 테스트 출시 요청이다. 첫 AAB는 다운로드한 파일을 Play Console에 직접 업로드하여 패키지·서명·앱 설정을 확인할 수 있다. API에서 패키지를 찾지 못하면 첫 수동 업로드를 완료한다.

version_code는 Play에 올린 최고 버전보다 큰 정수를 입력한다. 비워 두면 저장소 Actions variable `ANDROID_VERSION_CODE_BASE`(기본 1000)와 workflow 실행 번호의 합을 사용한다. 같은 실행의 재실행은 동일한 버전 코드다. 이미 올린 버전을 갱신하려면 새 Run workflow를 시작한다. 기존 EAS 경로와 직접 빌드 경로의 버전 관리는 독립적이다.

## 서명과 제출 자격

[GitHub Actions Secrets](https://github.com/Ji-ChangKim/travel_APP/settings/secrets/actions)에 다음 값을 등록한다. 비밀 원문을 코드·채팅·로그에 넣지 않는다.

| Secret                             | 값                                                                  |
| ---------------------------------- | ------------------------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`          | 기존 업로드 keystore를 Base64로 변환한 값                           |
| `ANDROID_KEYSTORE_PASSWORD`        | keystore 비밀번호                                                   |
| `ANDROID_KEY_ALIAS`                | 서명 키 별칭                                                        |
| `ANDROID_KEY_PASSWORD`             | 서명 키 비밀번호                                                    |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play 자동 제출용 서비스 계정 JSON 원문. 파일 다운로드만 하면 불필요 |

기존 Play 업로드가 있으면 같은 업로드 키를 유지한다. 이전 EAS에서 사용한 키라면 해당 키를 내려받아 사용한다. 첫 등록이며 기존 키가 없을 때만 JDK의 `keytool -genkeypair -v -keystore tripprint-upload.jks -alias tripprint-upload -keyalg RSA -keysize 2048 -validity 10000`으로 생성한다. 비밀번호는 대화형으로 입력하고 서명 파일은 Git 제외 폴더에 보관한다.

Google 제출 자격은 다음 순서로 준비한다.

1. Google Cloud에서 Google Play Android Developer API를 활성화하고 서비스 계정을 만든다.
2. IAM 및 관리자 → 서비스 계정 → 해당 계정 → 키 → 키 추가 → 새 키 만들기 → JSON으로 제출용 키를 발급한다. 이전 Google 로그인 OAuth 클라이언트 JSON과는 다르다.
3. Play Console의 사용자 및 권한에서 서비스 계정 이메일에 TripPrint 앱 정보 보기와 테스트 트랙 출시 권한을 부여한다.
4. JSON 원문을 저장소의 GOOGLE_PLAY_SERVICE_ACCOUNT_JSON Secret으로 등록한다. Expo에 업로드할 필요가 없다.

## 실행 결과 확인

- GitHub Actions 실행의 Summary에서 버전 코드·산출물·서명 방식을 확인한다. 실패하면 build-and-submit의 실패 단계 로그를 확인한다.
- 같은 실행 하단 Artifacts에서 APK·AAB를 받는다. 14일간 보관되며 Play 제출이 실패해도 이미 보관한 파일은 받을 수 있다.
- Play Console → TripPrint → 내부 테스트 → 버전에서 같은 versionCode의 등록·배포를 확인한다. 심사는 게시 개요, 전체 트랙은 최신 버전 및 번들에서 확인한다.
- 내부 테스트 → 테스터에서 휴대폰 Play 계정을 등록하고 참여 링크로 설치·업데이트한다.

검사 후 JDK 17·Android SDK를 준비하고 앱 설정에서 네이티브 프로젝트를 생성해 Gradle assembleRelease 또는 bundleRelease를 실행한다. scripts/android-ci.gradle에서 버전과 선택한 업로드 서명을 적용한다. 키는 임시 폴더에 복원하고 종료 시 삭제한다. Gradle 설정 캐시는 사용하지 않는다. 현재 서버 주소는 배포된 staging 설정을 공유한다.

실제 GitHub Gradle 컴파일·Play 제출 성공은 아직 확인하지 않았다. 현재 Windows에서는 네이티브 템플릿 생성이 상세 오류 없이 중단되어 전체 컴파일을 검증하지 못했다. 첫 GitHub Linux APK 실행 결과를 확인해야 한다. 공개 운영 트랙 승격은 이 workflow에 포함하지 않는다. Actions 성공이 Google 심사 승인을 의미하지는 않는다.

참고: [Gradle 명령줄 빌드](https://developer.android.com/build/building-cmdline), [로컬 Android 릴리스 빌드](https://docs.expo.dev/guides/local-app-production/), [Play 업로드 Action](https://github.com/r0adkll/upload-google-play).
