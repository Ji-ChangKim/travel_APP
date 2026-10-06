# TripPrint 브랜드 자산 v1 제작 보고

> 이 문서는 최초 제작 시점의 기록이다. 이후 파일명을 `TripPrint_{용도}_{가로}x{세로}`로 통일하고 앱에 적용했다. 현재 파일 목록과 적용·배포 결과는 [브랜드 업데이트 기록](TRIPPRINT_UPDATE_20261006.md) 및 자산 폴더의 `manifest.json`을 따른다. 이전 이름은 v1 ZIP에만 보존된다.

2026-10-06. 첨부 컨셉의 위치 핀·여행 경로·비행기를 공통 심볼로 정리하고 용도별 22종을 각각 PNG와 SVG로 제작했다. 이미지 한 장을 작은 조각으로 잘라 쓰는 방식 대신, 이미지 생성 결과와 컨셉을 참고해 편집 가능한 공통 벡터를 만들고 동일한 경로에서 각 자산을 파생시켰다. 글자는 정확한 `TripPrint / 트립프린트` 텍스트와 글꼴로 렌더링했다.

## 저장 위치와 미리보기

- 자산 폴더: `apps/mobile/assets/brand/tripprint-v1/`
- 전체 미리보기: 해당 폴더의 `preview.html`
- 출력 크기와 PNG SHA-256: `manifest.json`
- 묶음: `.release/branding/tripprint-assets-v1.zip` (원본·PNG·SVG·글꼴/라이선스·미리보기·제작 기록 포함)
- 재생성: `node scripts/create-tripprint-assets.mjs`, 이후 해당 자산 폴더에 Prettier 실행

이번 작업은 자산 패키지와 재사용 가능한 로딩 컴포넌트 준비다. 기존 배포 앱의 아이콘/이름/시작 화면을 일괄 교체하거나 재배포하지 않았다. 새 파일을 별도 버전 폴더에 저장했고 기존 앱 자산은 보존했다. Android 설치 파일 생성 완료를 뜻하지 않는다.

## 22종 자산

각 이름에 `.png`, `.svg` 두 형식이 있다. PNG는 고정 크기의 바로 사용 가능한 이미지, SVG는 편집/확대 가능한 원본이다. 워드마크 SVG에는 Poppins/Pretendard 글꼴을 내장했으며 글자를 경로로 변환한 외곽선 버전은 아니다. 인쇄/외부 편집 도구에서 내장 글꼴 처리가 다를 경우 동봉 폰트를 사용하거나 별도 외곽선 변환이 필요하다.

| 파일 이름               | 크기      | 용도                                   |
| ----------------------- | --------- | -------------------------------------- |
| `symbol-coral-clean`    | 1024×1024 | 공통 코랄 심볼, 시작/로딩/마케팅       |
| `symbol-white`          | 1024×1024 | 어두운 배경용 흰색 심볼                |
| `symbol-navy`           | 1024×1024 | 밝은 배경용 네이비 심볼                |
| `app-icon`              | 1024×1024 | 코랄 배경의 앱 아이콘 원본             |
| `play-store-icon`       | 512×512   | Google Play 아이콘용 PNG               |
| `android-foreground`    | 1024×1024 | Android adaptive icon 전경, 흰색/투명  |
| `android-monochrome`    | 1024×1024 | Android 테마 아이콘용 단색 알파 마스크 |
| `splash-symbol`         | 1024×1024 | 네이티브 시작 화면용 심볼              |
| `favicon-32`            | 32×32     | 작은 브라우저 아이콘, 핀 단순형        |
| `favicon-64`            | 64×64     | 큰 브라우저 아이콘, 핀 단순형          |
| `logo-horizontal`       | 1024×320  | 컬러 가로 로고                         |
| `logo-horizontal-white` | 1024×320  | 어두운 배경용 가로 로고                |
| `logo-horizontal-navy`  | 1024×320  | 단색 네이비 가로 로고                  |
| `monogram-tp`           | 512×512   | 보조 TP 모노그램                       |
| `logo-stacked`          | 768×768   | 세로 로고                              |
| `splash-portrait`       | 1080×1920 | 메인 시작 화면 구성/광고용 세로 이미지 |
| `ui-place`              | 256×256   | 장소 핀                                |
| `ui-route`              | 256×256   | 여행 경로                              |
| `ui-camera`             | 256×256   | 사진/카메라                            |
| `ui-record`             | 256×256   | 여행 기록/문서                         |
| `ui-map`                | 256×256   | 지도                                   |
| `ui-flight`             | 256×256   | 항공/이동                              |

공통 심볼은 adaptive icon의 마스크를 고려한 중앙 여백을 두었다. 최종 Android 기기 마스크와 테마 아이콘 검증은 APK 설치 후 진행해야 한다. 앱/스토어 아이콘은 배경이 채워진 정사각 원본이며 바깥 둥근 모서리와 외부 그림자는 넣지 않았다. 포토샵 등에서 임의로 다른 크기로 잘라 심볼 위치를 바꾸지 않는다.

`splash-portrait`는 전체 화면 구성 이미지다. 네이티브 `expo-splash-screen`의 중앙 이미지에는 `splash-symbol.png`를 쓰고 배경을 `#FFF9F3`으로 설정하는 것이 맞다. 긴 세로 포스터를 중앙 심볼 자리에 그대로 넣지 않는다.

## 로딩 화면

`apps/mobile/src/components/TripPrintLoading.tsx`는 세로 로고·아이보리 배경·네이비 메시지·진한 코랄 ActivityIndicator를 사용하는 React Native 컴포넌트다. 메시지를 props로 바꿀 수 있고 가짜 진행률/완료 상태를 생성하지 않는다.

```tsx
// 실제 세션 또는 데이터 복원 중인 상태에서만 로딩 화면을 표시한다.
<TripPrintLoading message="여행을 불러오고 있어요" />
```

자산 `preview.html`에는 웹에서 확인할 수 있는 점 3개 로딩 애니메이션도 있다. 줄어든 모션 선호 시 애니메이션을 끄며, 앱 컴포넌트의 Native ActivityIndicator와는 별도 미리보기다. 정적 PNG 파일 자체가 애니메이션인 것은 아니다.

## 글꼴·색상·원본

- 영문: Poppins Bold, 한글: Pretendard Variable. 실제 공식 글꼴 파일을 `fonts/`에 보관했다.
- 코랄 `#FF6B57`, 네이비 `#203247`, 아이보리 `#FFF9F3`. 로딩 상태 표시에는 `#C84432`를 사용한다.
- 기능용 6개 아이콘은 네이비 단색과 같은 선 굵기 규칙으로 그렸다. 브랜드 심볼의 코랄 장식과 정보 아이콘의 역할을 구분한다.
- `fonts/Poppins-OFL.txt`, `fonts/Pretendard-LICENSE.txt`를 자산 묶음에 포함한다.
- 출처: [Poppins](https://github.com/google/fonts/tree/main/ofl/poppins), [Pretendard](https://github.com/orioncactus/pretendard). 브랜드명에 대한 권리 확보를 폰트 라이선스 확인과 혼동하지 않는다.
- 생성 심볼 초안 `drafts/symbol-coral-imagegen.png`도 보존했다. 이는 선택된 최종 벡터/PNG와 구분된 참고 초안이며 최종 자산 목록에는 넣지 않았다.

## 사용한 생성 도구와 프롬프트

기본 내장 `image_gen`을 사용했다. API/CLI fallback과 별도 OpenAI API 키는 사용하지 않았다. 입력은 `docs/branding/references/tripprint-concept.png`이고 배경 투명 옵션을 켰다. 생성 결과를 프로젝트에 복사한 뒤 참고용 초안으로 보관했다. 최종 공통 벡터는 제작 스크립트에서 정의하고 PNG는 새로운 SVG 문서를 별도 Chrome으로 렌더링해 내보냈다. 기존 래스터를 Python 등으로 자르거나 수정하지 않았다.

실행 프롬프트:

```text
Use case: background-extraction / logo-brand. Input image 1 is the supplied TripPrint brand concept board. Reconstruct and isolate ONLY its coral location-pin + curved dashed travel route + small airplane brand symbol (as shown above the TripPrint wordmark). Deliver ONE production-ready symbol PNG on genuinely transparent background, square 1024 by 1024 canvas. Preserve the recognizable pin with round transparent center, an elliptical route sweeping under and around the pin, and an airplane ascending to the upper-right. Clean flat shapes, smooth edges, uniform coral #FF6B57, no shadows, no gradients, no texture. Simplify the dashed route into a few substantial readable segments rather than hairlines. Keep the entire mark inside the central 60 percent of the canvas, optically centered, with generous transparent padding for Android adaptive masks and loading animations. All negative space including the pin center must be alpha-transparent. NO wordmark, no text, no letters, no background, no rounded square, no phone, no mockup, no photo. This is the shared master symbol for TripPrint app icons, splash, loading and future marketing.
```

모델 결과는 1254×1254 RGBA였다. 요청한 크기를 충족했다고 간주하지 않고 초안으로 남겼으며, 최종 자산은 벡터 출력 크기를 직접 지정해 만들었다. 첨부 보드의 정확한 픽셀 복제가 아니라 같은 컨셉의 단순화된 제작본이다. 마케팅 배경 사진과 필기체 슬로건은 이번 패키지에 복제하지 않았다.

## 검증과 변경 파일

- `scripts/create-tripprint-assets.mjs`: 공통 심볼·정확한 워드마크·22종 변형·SVG 원본·PNG 내보내기·미리보기·해시 기록을 생성한다.
- `apps/mobile/assets/brand/tripprint-v1/`: 22종 PNG/SVG, 생성 초안, 공식 글꼴/라이선스, manifest, preview를 저장했다.
- `apps/mobile/src/components/TripPrintLoading.tsx`: 새 자산을 소비하는 재사용 로딩 컴포넌트 추가.
- `docs/branding/TRIPPRINT_ASSETS_V1.md`: 사용처·크기·제작 방식·프롬프트·제한·통합 위치 기록.
- 검증: 22종의 실제 출력 크기와 투명 자산의 알파/빈 모서리 확인 통과. 앱 아이콘·로고·세로 시작 화면과 전체 미리보기의 시각 확인 완료. Play Store용 PNG는 512×512, 6,907바이트로 확인했다.
- `npm run check`: TypeScript 엄격 모드·ESLint·Prettier 모두 통과. `git diff --check`도 통과했다.
- `preview-board.png`: 실제 미리보기 HTML의 전체 화면을 1200px 너비로 렌더링해 보관했다.

이번 작업에서 DB/도메인 데이터 객체 변경은 없다. 앱의 실제 시작/로그인/공유 화면에 대한 브랜드 교체는 현재 동작하는 세션 복원과 초대 복귀 흐름을 유지하면서 별도 연결해야 한다.
