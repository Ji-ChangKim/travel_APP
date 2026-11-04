# Android Studio 테스트 준비

> 이 문서는 최초 네이티브 준비·APK 검수의 기록이다. 노션 명세 반영 이후의 현재 실행 명령·새 API·검증 범위는 [시작·로그인·프로필 반영 검수](2026-11-04_노션_시작로그인프로필_반영검수.md)를 따른다. 최신 기능은 로컬 API와 `android:metro:local`로 확인한다.

상태: 빌드·에뮬레이터 실행 확인 / 작성일: 2026-11-04 / 범위: 최신 BI·로그인·예외 팝업을 로컬 Android에서 테스트할 준비.

## Android Studio에서 실행

1. Android Studio에서 저장소의 `apps/mobile/android` 폴더를 연다. 저장소 루트나 이전 외부 산출물 폴더를 프로젝트로 열지 않는다.
2. Gradle JDK는 `C:/Program Files/Android/openjdk/jdk-21.0.8`을 선택한다. 로컬 SDK는 `C:/Users/Jichang/AppData/Local/Android/Sdk`다. 프로젝트의 `.gradle/config.properties`와 `local.properties`에 같은 경로를 연결했다.
3. Gradle Sync를 마친 뒤 실행 구성을 `TripPrint`, Build Variant를 `debug`로 선택한다. 테스트 기기는 실행 중인 `Medium_Phone_API_37.0` 에뮬레이터다.
4. 개발 서버가 꺼져 있다면 저장소 루트의 터미널에서 `npm run android:metro`를 실행한다. 개발 서버는 8081 포트에서 앱의 검수 서버 설정으로 시작하며, 이전 Metro 캐시를 비운다. 준비 작업을 마칠 때는 서버를 켜 두었으므로 중복 실행하지 않는다.
5. Run을 누른다. 에뮬레이터를 다시 시작해 연결이 풀린 경우 아래 포트 연결 명령을 실행한다. 검수 APK에 JavaScript가 포함된 release 변형은 Metro 없이 실행할 수 있다.

```powershell
& 'C:/Users/Jichang/AppData/Local/Android/Sdk/platform-tools/adb.exe' -s emulator-5554 reverse tcp:8081 tcp:8081
```

여러 기기가 연결되면 에뮬레이터를 명시적으로 선택한다. 다른 기기의 앱을 지우거나 데이터를 초기화하지 않는다. 포트 8081이 이미 사용 중이면 기존 서버의 프로젝트를 확인하고, 같은 서버를 중복 실행하지 않는다.

로컬 `gradle.properties`의 `reactNativeArchitectures=x86_64`는 현재 에뮬레이터에 맞춘 설정이다. ARM 실기기로 바꿀 때는 해당 기기의 아키텍처(예: `arm64-v8a`)로 바꾸고 다시 빌드한다. 공통 앱 설정과 CI의 아키텍처 목록은 변경하지 않았다.

## 이번 준비 내용

- 최신 앱 설정으로 Android 프로젝트를 생성하고 스플래시 시작 색 `#FFF9F6`과 공통 앱 배경 `#F8F9FF`를 확인했다. React BI의 세로 그라데이션은 앱 코드가 표시한다.
- 원래 네이티브 진입 파일 `MainApplication.kt`·`MainActivity.kt`는 백업과 비교해 내용이 같았다. 공통 버전·지도 키 주입·산출물 내보내기·Windows Studio 동기화·Worklets 연결 스크립트가 적용된 것을 확인했다.
- Studio 실행 구성 `.run/TripPrint.run.xml`, SDK 경로와 JDK 21 설정을 복원했다. 시스템의 기본 Java 8은 변경하지 않았다.
- `scripts/android/start-studio-metro.mjs`와 `npm run android:metro`를 추가했다. 기존 Android CI 공개 설정 함수를 재사용해 검수 APK와 디버그 서버가 같은 staging 서버를 사용한다. 비밀 값은 출력하지 않는다.
- Windows에서 개발 서버가 IPv6에만 연결되는 문제를 IPv4 우선 설정으로 해결했다. `apps/mobile/metro.config.js`에서는 네이티브 빌드·검수 산출물을 파일 감시에서 제외했다. 생성물이 많아 감시 시작이 240초 뒤 실패하던 문제를 수정했으며, 앱·공유 패키지·에셋의 소스 감시는 유지한다.
- 준비 중 함께 수정되던 홈·계획 화면에서 검사를 막은 미사용 `ReactNode` import와 존재하지 않는 `Profile.name` 참조만 정리했다. 홈·계획 화면의 기능 변경 전체는 이 보고서의 검수 대상이 아니다.
- 버전 파일은 `versionName=0.0.1`, `versionCode=14`를 유지했다. 새 빌드의 파일명·해시와 소스 기록으로 이전 설치본과 구분한다.
- Google Play 버튼은 기존 사용자 지시대로 ‘클릭 시 이동’ 로그만 남긴다. 스토어 업로드·실제 스토어 이동·업데이트 완료 처리는 이번 준비에서 실행하지 않는다.

## 네이티브 재생성과 보존

설치된 Expo 57의 CLI 소스를 확인한 결과 `prebuild`는 `--no-clean`이 없으면 네이티브 폴더를 다시 만든다. 이번 최초 실행에서 이 기본 동작을 놓쳐 Android 폴더가 재생성됐다. 실행 전에 보존한 `outputs/android-studio-20261104/native-before.zip`과 대조하고, 로컬 실행·SDK·JDK 연결을 복원했다. 원래 Kotlin 진입 파일 두 개는 같았고, 앱 데이터는 이 작업에서 초기화하지 않았다.

이후 기존 프로젝트를 유지하며 갱신할 때는 모바일 폴더에서 `expo prebuild --platform android --no-install --no-clean`을 사용한다. 네이티브 파일·서명·개별 설정은 먼저 보존하고 변경을 대조한다. prebuild가 자동 변경한 npm의 Android·iOS 실행 명령은 원래 값으로 되돌렸다. 의존성이나 잠금 파일은 교체하지 않았다.

## 빌드와 실행 검증

| 항목             | 환경·기대 결과                                      | 결과·증거                                                                              |
| ---------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 도구             | JDK 21, Gradle wrapper 9.3.1, SDK·기기 연결         | 기존 Studio JBR 25에서도 wrapper 실행 확인. 실제 빌드는 프로젝트 JDK 21 사용           |
| 네이티브 설정    | 새 스플래시·기존 진입 파일·공통 플러그인 보존       | `prebuild.log`, `native-source-comparison.json`                                        |
| APK              | x86_64 디버그 및 JavaScript 포함 로컬 검수 APK 생성 | 통과. `BUILD SUCCESSFUL`, 53분 1초, `gradle-build.log`                                 |
| 에뮬레이터       | 디버그 앱에서 개발 서버 연결 후 로그인 표시         | 통과. Google·게스트 버튼 표시, `native-debug-screen.png`, `native-ready-window.xml`    |
| 독립 실행        | 개발 서버 연결 없이 로그인 표시                     | 통과. release-local 설치 후 8081 연결 제거·앱 종료·재실행, `native-release-smoke.json` |
| 개발 서버        | 같은 staging 공개 설정으로 Metro 시작               | 통과. HTTP 200·`packager-status:running`, `metro-ready.log`                            |
| Studio 빌드 경로 | 로컬 설정으로 debug 작업 구성                       | 통과. Gradle `assembleDebug --dry-run`, `studio-dry-run.log`                           |
| 출시 연결 회귀   | `npm run test:release`                              | 통과. 98개, `release-tests.log`. 파일 감시 제외·소스 유지 회귀 검사 포함               |
| 필수 검사        | `npm run check`                                     | 통과. 종료 코드 0, 타입·린트·서식·프로젝트 검사, `check.log`                           |

모든 로그·해시·네이티브 소스 보존본은 `outputs/android-studio-20261104/`에 둔다. 완성된 APK는 기존 내보내기 규칙에 따라 `outputs/android`에 저장하며 이전 파일을 덮어쓰지 않는다. 이번 빌드의 x86_64 APK는 해당 에뮬레이터용이다. ARM 기기 설치본과 혼동하지 않는다. 로컬 검수용 서명을 Play 배포 서명으로 보고하지 않는다.

| 파일                                         | 용도                                             | 크기              |
| -------------------------------------------- | ------------------------------------------------ | ----------------- |
| `outputs/android/TripPrint_261104_Ver01.apk` | debug. Metro 필요, 에뮬레이터에 최종 설치한 버전 | 101,653,080바이트 |
| `outputs/android/TripPrint_261104_Ver02.apk` | release-local. JavaScript 포함, Metro 없이 실행  | 52,573,986바이트  |

SHA-256과 포함 아키텍처는 `apk-manifest.json`에 기록했다. release-local 번들에는 실제 staging API 주소가 들어 있다. 테스트 세션과 로컬 미리보기 포트는 포함되지 않았다. 두 APK 모두 버전 `0.0.1 (14)`이며 로컬 검수 서명을 사용한다. 설치는 `adb install -r`로 진행했고 앱 삭제나 데이터 초기화는 하지 않았다. 기존 기록의 재조회는 로그인·저장 작업을 수행하지 않아 미검증이다.

## 실제 조작 기록

대상은 `81316e6` 기반 공유 작업 트리의 현재 변경분과 이 보고서에 적은 준비 파일이다. 작업 중 다른 채팅에서 홈·계획 화면 변경이 이어졌으므로 APK 전체를 위 커밋과 동일한 소스로 표현하지 않는다. 테스트 환경은 `Medium_Phone_API_37.0`, Android API 37, x86_64, `emulator-5554`, staging 서버다. 가짜 인증 응답을 사용하지 않았다.

| 검사 ID       | 사전 조건·순서                                                 | 기대·실제 결과                                    | 판정·증거                                                                                    |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| AND-STUDIO-01 | debug APK 설치 → Metro 시작 → 포트 연결 → 개발 URL 열기        | 로그인 화면의 Google·게스트 버튼이 표시됨         | 통과. `native-debug-screen.png`, `native-window.xml`                                         |
| AND-STUDIO-02 | release-local 설치 → 포트 연결 제거 → 앱 완전 종료 → 기본 실행 | Metro 연결 없이 로그인 화면 표시                  | 통과. `native-release-frame-5.png`, `native-release-window.xml`, `native-release-smoke.json` |
| AND-STUDIO-03 | debug 재설치 → 8081 연결 복원 → 개발 URL 열기                  | 다음 테스트를 이어갈 로그인 화면과 개발 서버 유지 | 통과. `native-ready-smoke.json`, `native-ready-window.xml`                                   |
| AND-STUDIO-04 | 실제 Google 계정 인증·게스트 시작·저장 후 재조회               | 실제 계정·저장 결과 확인                          | 미검증. 이번 준비에서는 인증 버튼을 누르지 않음                                              |
| AND-STUDIO-05 | Studio GUI에서 Sync·Run, ARM 실기기 설치, Play 설치            | 각 환경에서 실행 확인                             | 미검증. Gradle CLI 빌드와 에뮬레이터 조작으로 범위를 한정                                    |

참조 기준은 `docs/02. 디자인/00. 공통규격/디자인시스템.md`, 같은 폴더의 `design-tokens.json`, 시작·로그인 화면 규격과 아래 예외 팝업 검수 문서다. 실제 로그인 캡처에서 기존 로고·Google 버튼·게스트 버튼·하단 버전 표시를 대조했다. 이번 준비에서는 화면 디자인을 새로 변경하지 않았다. 빠르게 끝나는 BI 전환의 모든 프레임과 네이티브 작은 화면·큰 글꼴·다국어·팝업 조건은 이번 실행에서 다시 검수하지 않았으며, 기존 웹 검수와 구분한다. 우측 상단 개발 메뉴는 디버그 앱에서만 나타난다.

문서 검사도 통과했다. `npm run check:docs`는 문서 131개·링크 626개에서 오류 0개였으며, 로그는 `docs-check.log`에 있다. 이 문서는 주 에이전트가 실행한 빌드·자동 검사·에뮬레이터 조작의 기록이다. 서브에이전트 검토는 요청하지 않았다.

## 테스트할 화면과 범위

앱을 완전히 닫고 다시 실행해 BI 배경·중앙 로고 → 상단 이동 → Google·게스트 버튼 등장 순서를 확인한다. 화면 크기·글자 크기를 바꾸면 원본 비율과 중앙 배치, 팝업 내부 스크롤을 확인한다. 로그인 실패·시작 점검 실패는 중앙 팝업에서 재시도하며, 취소는 성공으로 처리하지 않는다.

업데이트 팝업은 실제 정책 조건에서만 표시한다. 앱에 가짜 필수 업데이트나 가짜 계정을 넣어 시연하지 않는다. 업데이트 UI의 다국어·크기·클릭 로그 증거는 [예외 팝업 검수](2026-11-04_시작로그인_예외팝업_검수.md), 전체 조건은 [예외 체크리스트](<../00. 검수기준/시작_로그인_예외체크리스트.md>)를 따른다.

Android Studio GUI의 메뉴 조작, 실제 Google 계정 인증·실기기·Google Play 설치 검수는 이번 로컬 빌드 준비와 구분한다. 원격 배포·업로드와 운영 데이터 변경은 수행하지 않았다.
