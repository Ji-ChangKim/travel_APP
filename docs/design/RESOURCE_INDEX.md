# TripPrint 리소스 저장 경로

확인일: 2026-10-21. 프로젝트 루트는 `J:\002. Project_Service\travel_APP`다. 아래 경로는 루트를 기준으로 한다. 이 문서는 파일의 실제 위치와 사용 범위를 안내하며, 파일 이동이나 자산 삭제를 수행한 기록이 아니다.

## 앱에 포함되는 원본

| 종류                         | 저장 경로                                                                          | 사용·관리 기준                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 공식 로고·앱 아이콘·스플래시 | `apps/mobile/assets/brand/tripprint-v1/`                                           | PNG·SVG 원본과 `manifest.json` 보존                            |
| 홈 헤더 심볼                 | `apps/mobile/assets/brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png` | 현재 HomeHeader가 실제 참조                                    |
| 가로 로고                    | `apps/mobile/assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.svg`     | 로고 전체가 필요한 화면의 원본                                 |
| 하루 캐릭터                  | `apps/mobile/assets/brand/haru-v1/`                                                | empty·error·loading 원본 PNG와 manifest                        |
| 본문·제목 폰트               | `apps/mobile/assets/fonts/`                                                        | Pretendard Regular·Semibold·Bold OTF, LICENSE와 font-manifest  |
| 로고 전용 폰트               | `apps/mobile/assets/brand/tripprint-v1/fonts/Poppins-Bold.ttf`                     | TripPrintLogo로 등록, 일반 제목에 사용하지 않음                |
| 기존 웹 가변 폰트            | `apps/mobile/assets/brand/tripprint-v1/fonts/PretendardVariable.woff2`             | 기존 디자인 보드용 원본. 실제 앱 등록은 AppFontProvider를 확인 |
| 브랜드 SVG 아이콘            | `apps/mobile/assets/icons/tripprint/`                                              | `icon-manifest.json`·LICENSE와 개별 SVG                        |
| 공통 탐색 아이콘             | `@expo/vector-icons`의 `Ionicons` 패키지                                           | 현재 헤더·GNB에서 사용. PNG를 별도 생성하지 않음               |
| 홈 배경 일러스트             | `apps/mobile/assets/illustrations/home/tripprint-home-create-background.png`       | HomeHeroBackground가 실제 참조, README에 범위 기록             |
| 도시 가이드 이미지           | `apps/mobile/assets/destinations/`                                                 | 8개 도시 JPG, 저작자·출처는 `credits.json`                     |

패키지 아이콘의 설치 위치는 `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/`다. `glyphmaps/Ionicons.json`이 아이콘 이름·글리프 대응표이고 `Fonts/Ionicons.ttf`가 폰트다. node_modules의 파일을 직접 수정하거나 제품 자산의 새 원본으로 복사하지 않는다. 설치 폴더는 의존성 설치로 다시 만들어진다.

BI 영상은 `apps/mobile/src/features/startup/biAsset.ts`의 선택적 연결을 사용한다. 현재 자산 조사에서 MP4 원본은 발견되지 않았다. 실제 추가 경로는 해당 로더가 읽는 `apps/mobile/assets/brand/tripprint-v1/tripprint_bi.mp4`이며, 제작 전에는 공식 심볼과 흰 배경의 기존 정적 대체를 사용한다. 영상이 이미 존재하거나 제작됐다고 표시하지 않는다.

## 디자인 원본·문서·검토 시안

| 자료                   | 저장 경로                                    | 의미                                                    |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------- |
| 공통 디자인 기준       | `docs/design/DESIGN.md`                      | 문서 진입점·적용 범위                                   |
| 공통 토큰              | `docs/design/design-tokens.json`             | 제목·레이아웃·접근성 등의 공통 수치                     |
| 신규 Stitch 범위 토큰  | `docs/design/ledger-tokens.json`             | 지정된 신규 화면만 적용                                 |
| 헤더·GNB 규격 및 글꼴  | `docs/design/SCREEN_HEADER_SPEC.md`          | 상황별 유형·아이콘·색·전환·폰트·예외                    |
| 이번 헤더 시각 규격판  | `docs/design/headers/index.html`             | 정적 검토 시안, 실제 서비스 데이터와 연결하지 않음      |
| 헤더 시안 스타일       | `docs/design/headers/headers.css`            | 공통 규격을 표현하는 검토용 스타일, 앱 스타일 원본 아님 |
| 번호별 기존 페이지     | `docs/design/pages/`                         | PAGE_INDEX·PAGE_MANIFEST와 Num_페이지명 HTML            |
| 기존 전체 클릭 검토판  | `docs/design/review/`                        | 기존 검토용 모듈·스타일·서버                            |
| 홈 HTML 원본           | `docs/design/sources/home-20261020/`         | 사용자 참조 원본 보존                                   |
| 내 여행 HTML 원본      | `docs/design/sources/my-trips-20261020/`     | 있음·없음 원본 보존                                     |
| 발자국 HTML 원본       | `docs/design/sources/footprints-20261020/`   | 공개 피드 참조 원본 보존                                |
| 신규 Stitch 적용 대조  | `docs/design/STITCH_CURRENT_INTEGRATION.txt` | ZIP 대조·토큰 범위·실제 앱 적용 차이                    |
| 기존 실제 UI 캡처 안내 | `docs/1.uiux/SCREENSHOT_INDEX.txt`           | 캡처별 시점·검증 범위 확인                              |
| 로컬 검사·임시 캡처    | `outputs/`                                   | 로컬 검수 증거. Git·제품 배포 입력에서 제외             |

이전의 Stitch ZIP 입력 경로는 `C:\Users\Jichang\Downloads\stitch_.zip`이다. 사용자 다운로드 폴더는 앱 실행 시 참조하는 경로가 아니다. 기존 추출·적용 기록과 현재 저장소 원본은 STITCH_CURRENT_INTEGRATION 문서를 따른다.

## 서버 사진과 빌드 결과

회원의 사진·영수증은 앱 원본 폴더에 저장하지 않는다. 현재 staging Worker의 `MEDIA` 바인딩은 Cloudflare R2의 `tripprint-staging-private` 버킷을 사용한다. 접근 가능한 사진은 API의 권한·공개 범위 확인을 거쳐 조회한다. Google 장소 사진도 장소·사진 조회 API를 사용하며 임의의 다운로드 파일을 앱 자산에 섞지 않는다. 기기 게스트 기록은 기기 저장 계약을 따르며, 서버에 저장됐다고 안내하지 않는다.

`apps/mobile/public/`은 웹 정적 배포용 입력이다. `apps/mobile/dist/`는 웹 내보내기 결과이며 원본 수정 위치가 아니다. Android의 `android/`·빌드 산출물도 생성 결과이므로 디자인 자산의 원본 저장소로 사용하지 않는다. 이번 작업에서는 Android 빌드·배포를 실행하지 않는다.

신규 리소스는 역할에 맞는 assets 하위 폴더에 넣고, 출처·라이선스·원본 이름·적용 화면을 manifest나 README에 남긴다. 디자인 시안은 docs에, 앱이 사용하는 자산은 assets에, 사용자 업로드는 서버·기기 저장에 둔다. 같은 로고·폰트를 화면마다 복제하지 않는다.
