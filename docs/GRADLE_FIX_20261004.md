# Android 리소스 연결 빌드 오류 수정

2026-10-04. 첨부한 EAS 로그에서 실패한 작업은 `:app:processReleaseResources`이며 실제 오류는 다음과 같다.

```text
Android resource linking failed
style attribute 'attr/expoNavigationBarHidden' not found
style attribute 'attr/expoEnforceNavigationBarContrast' not found
```

내비게이션 바 플러그인은 앱 테마에 위 속성을 생성했지만, 루트 EAS 빌드의 Android 자동 연결 목록에는 `expo-navigation-bar`가 없었다. 패키지는 모바일 워크스페이스에만 선언돼 있었다. 수정 전 실제 자동 연결 결과에서도 누락을 재현했다. C++·Kotlin deprecated 경고는 이번 리소스 연결 실패의 원인이 아니다.

## 변경 내용

| 파일                                    | 수정                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `package.json`                          | 모바일 앱이 사용하는 SDK 57 네이티브 의존성 9개를 루트 빌드에도 선언                                    |
| `package-lock.json`                     | 설치 재현을 위해 루트 의존성 선언 동기화. 기존 모바일 버전 유지                                         |
| `tests/release/native-linking.test.mjs` | 루트·모바일 각각 실제 Android 자동 연결을 실행해 기능 모듈 포함 여부와 누락됐던 두 속성의 리소스를 검증 |
| `docs/BUILD_CHECKLIST.md`               | 재빌드 전 네이티브 연결 검사 안내 추가                                                                  |
| `docs/GRADLE_FIX_20261004.md`           | 실패 원인·변경 파일·검증 범위·재빌드 절차 기록                                                          |

추가 선언: `expo-navigation-bar`, `@react-native-community/datetimepicker`, `expo-crypto`, `expo-dev-client`, `expo-document-picker`, `expo-file-system`, `expo-image-picker`, `expo-sharing`, `expo-web-browser`. `npx expo install`로 모바일과 동일한 권장 버전을 설치했다. 앱 기능 및 DB 구조 변경은 없다.

Expo의 네이티브 자동 연결은 앱의 의존성 그래프를 기준으로 수행되므로 설정 플러그인의 해석 성공이나 JavaScript 번들 성공만으로 네이티브 모듈 포함을 보장할 수 없다. [공식 자동 연결 문서](https://docs.expo.dev/modules/autolinking/).

## 검증 및 다시 빌드

- `npm run test:release`: 실제 Android 연결 검사를 포함한 12개 테스트 통과.
- 루트 자동 연결 결과에 `expo-navigation-bar`와 `NavigationBarModule` 포함 확인.
- `npm run check`: TypeScript·ESLint·Prettier 통과.
- 루트 Expo config introspection: hidden=true 및 두 Android 테마 속성 생성 확인.
- 로컬 Android SDK가 없어 `gradlew assembleRelease`와 APK 설치는 EAS에서 다시 확인해야 한다.

Expo에서 최신 `main` 커밋으로 새 빌드를 만들고, Android와 소문자 `preview` 프로필을 선택한다. 이전 실패 작업을 다시 열기만 하면 수정 커밋이 반영되지 않는다. 최종 성공 판단은 새 빌드의 Gradle 단계 통과 및 APK 설치 후 확인한다.
