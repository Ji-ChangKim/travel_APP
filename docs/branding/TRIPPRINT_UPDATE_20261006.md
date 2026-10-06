# TripPrint 브랜드 파일명 및 앱 적용 기록

2026-10-06. 사용자 요청 형식은 `TripPrint_{용도}_{가로}x{세로}.{확장자}`로 적용했다. 용도는 영문 kebab-case이며, 크기는 실제 파일의 픽셀 크기다. 동일한 22종을 PNG와 SVG로 분리해 총 44개를 제공한다. 같은 심볼·글꼴·여백을 유지하며 원본 PNG의 SHA-256은 파일명 변경 전후 동일하다.

## 현재 자산 목록

자산 폴더는 `apps/mobile/assets/brand/tripprint-v1/`이다. 폴더명은 기존 경로를 유지하며, 현재 명명 규칙의 리비전은 `manifest.json`의 `v2`이다. 아래 PNG와 같은 이름의 SVG도 함께 제공한다. 크기·파일명·PNG SHA-256은 manifest에 기록했다.

| 용도                  | PNG 파일명                                     | 실제 크기 |
| --------------------- | ---------------------------------------------- | --------- |
| symbol-coral-clean    | `TripPrint_symbol-coral-clean_1024x1024.png`   | 1024×1024 |
| symbol-white          | `TripPrint_symbol-white_1024x1024.png`         | 1024×1024 |
| symbol-navy           | `TripPrint_symbol-navy_1024x1024.png`          | 1024×1024 |
| app-icon              | `TripPrint_app-icon_1024x1024.png`             | 1024×1024 |
| play-store-icon       | `TripPrint_play-store-icon_512x512.png`        | 512×512   |
| android-foreground    | `TripPrint_android-foreground_1024x1024.png`   | 1024×1024 |
| android-monochrome    | `TripPrint_android-monochrome_1024x1024.png`   | 1024×1024 |
| splash-symbol         | `TripPrint_splash-symbol_1024x1024.png`        | 1024×1024 |
| favicon-32            | `TripPrint_favicon-32_32x32.png`               | 32×32     |
| favicon-64            | `TripPrint_favicon-64_64x64.png`               | 64×64     |
| logo-horizontal       | `TripPrint_logo-horizontal_1024x320.png`       | 1024×320  |
| logo-horizontal-white | `TripPrint_logo-horizontal-white_1024x320.png` | 1024×320  |
| logo-horizontal-navy  | `TripPrint_logo-horizontal-navy_1024x320.png`  | 1024×320  |
| monogram-tp           | `TripPrint_monogram-tp_512x512.png`            | 512×512   |
| ui-place              | `TripPrint_ui-place_256x256.png`               | 256×256   |
| ui-route              | `TripPrint_ui-route_256x256.png`               | 256×256   |
| ui-camera             | `TripPrint_ui-camera_256x256.png`              | 256×256   |
| ui-record             | `TripPrint_ui-record_256x256.png`              | 256×256   |
| ui-map                | `TripPrint_ui-map_256x256.png`                 | 256×256   |
| ui-flight             | `TripPrint_ui-flight_256x256.png`              | 256×256   |
| logo-stacked          | `TripPrint_logo-stacked_768x768.png`           | 768×768   |
| splash-portrait       | `TripPrint_splash-portrait_1080x1920.png`      | 1080×1920 |

전체 미리보기는 `preview.html`, 이미지 미리보기는 `TripPrint_asset-preview_1200x2308.png`이다. 묶음은 `.release/branding/TripPrint_brand-assets_v2.zip`이다. 생성 참고 초안과 과거 이름의 파일은 이번 배포 자산 묶음에서 제외했다. 공식 글꼴과 라이선스는 fonts 폴더에 포함한다.

## 앱 변경 내용

- 루트 및 모바일 `app.config.ts`: 표시 이름 TripPrint, 1024 앱 아이콘, Android 전경·단색 아이콘, 64 파비콘, 아이보리 배경과 시작 심볼 연결.
- `src/app/index.tsx`: 새 TripPrint 로딩 화면을 실제 게스트·서버 세션 복원에 연결. 초대·지도 공유 복귀 경로를 유지하며 화면 해제 후 이동을 차단.
- `TripPrintLoading.tsx`: 변경된 세로 로고 파일 경로 연결.
- `src/app/login.tsx`: 컨셉 로고, 트립프린트 이름, “여행의 발자취를 남기다.” 적용. 이메일·게스트 로그인 동작과 입력 유지.
- `src/constants/theme.ts`, `features/workspace/ui.tsx`: 아이보리 배경, 네이비 텍스트, 흰 글자가 읽히는 Action Coral #C84432 적용. 로고·아이콘의 Trip Coral은 #FF6B57 유지.
- `WorkspaceScreen.tsx`, `DiaryScreen.tsx`, `service.ts`, `trips/[id].tsx`: 화면·공유 문구의 브랜드 표시 변경.
- `scripts/create-tripprint-assets.mjs`: 재생성 시에도 동일한 파일명·manifest·미리보기 링크 생성.
- `public/release.json`: `test-1-branding`, 브랜드 TripPrint, 자산 v2 식별.

내부 패키지명, 앱 패키지 ID, scheme, Expo 프로젝트 ID, 계정 저장 키, 초대 코드, D1·R2 자원은 유지했다. DB 및 도메인 객체 변경은 없다. 기능용 아이콘 6종은 개별 파일로 제공하며 이번 적용 범위는 앱 아이콘·파비콘·시작·로딩·로그인·브랜드 표시다. 기존 화면의 모든 기능 아이콘을 교체한 것은 아니다.

## 검증 기록

- `npm run check`: TypeScript·ESLint·Prettier 통과.
- `npm run test:auth`: 16/16 통과.
- `npm run test:release`: 18/18 통과, 루트·모바일 Android 네이티브 연결 포함.
- `npm run test:workspace:web`: 사용자 입력·인증 복원·여행·영수증·게시·공유 복귀 8/8 통과. HTTP 공급자는 테스트 응답을 사용한다.
- PNG 22개 이름·실제 크기·SHA-256, SVG 22개 viewBox 및 미리보기 이미지 로딩 확인.

## 배포 기록

`npm run release:prepare` 통과. 실제 서비스 설정으로 웹 18개 경로를 내보냈으며 rewrite·테스트 설정 미포함 검사와 Worker dry-run을 완료했다. 웹 브랜드 업데이트는 [1차 테스트 주소](https://wherego-staging.pages.dev/login)에 반영했다. 개별 배포는 https://9499d50a.wherego-staging.pages.dev 이고, 식별자는 `test-1-branding`이다. 업로드 파일은 22개, 기존 파일 재사용은 38개다. API·D1·R2 변경은 없다.

공개 주소의 release.json이 로컬 원본과 일치하며 JavaScript·파비콘 SHA-256도 일치한다. 직접 접근 6개 경로의 HTML 200, API health 200, 비로그인 여행 조회 401을 확인했다. 격리된 Chrome에서 시작→로그인→TripPrint 로고 표시→게스트 진입→새로고침 복원까지 확인했고 JavaScript 오류가 없었다. 실제 화면 캡처는 `references/TripPrint_login-preview_390x844.png`에 저장했다.

`npm run mvp:prepare`도 통과했다. Android Hermes 번들은 `apps/mobile/.release/android/_expo/static/js/android/entry-d0595185fc44f22bfa0fc20c125cbbd8.hbc`이며 새 로고 PNG가 포함됐다. 이는 APK 설치 파일이 아니다. `eas-cli whoami` 결과가 `Not logged in`이라 APK 서명 빌드는 Expo 로그인 완료 후 진행해야 한다. Google Play 공개 및 실기기 아이콘 마스크·카메라 검증은 아직 진행하지 않았다.

웹 배포 ZIP은 `.release/test1-branding/TripPrint_0.1.0_test-1-branding_web.zip`, 배포 검증 기록은 같은 폴더의 `build-manifest.json`이다. 브랜드 ZIP에는 개별 PNG·SVG, 미리보기, manifest, 글꼴·라이선스, 생성 스크립트, 로딩 컴포넌트, 이 적용 기록이 들어 있다.
