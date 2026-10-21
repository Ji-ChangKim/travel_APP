# 홈 HTML 적용 검수

작성일: 2026-10-20. 범위는 홈 화면 적용과 브라우저 검수다. 배포·Android 빌드·실기기 인수·Git 커밋과 푸시는 포함하지 않는다.

## 참조와 원인

사용자가 첨부한 HTML을 `docs/design/sources/home-20261020/100_home_empty_reference.html`에 원문 그대로 보존했다. SHA256은 `7a78eb9b2774d0d9343bfe22cbb4b34769a00fd4b06520308ebea2b105678d25`다. 외부 글꼴·Tailwind 스타일을 읽어 원본 화면도 캡처했다.

기존 `STITCH_CURRENT_INTEGRATION.txt`의 10월 19일 적용 범위는 첫 여행 카드뿐이었다. 홈의 나머지 카드·도시 가이드·배치가 남아 있어 원본 HTML과 달랐다. 이번에는 인사·빈 여행 카드·활용 팁·공개 탐색까지 범위를 넓혔다.

적용 전 `DESIGN.md`, `design-tokens.json`, `ledger-tokens.json`, `SCREEN_HEADER_SPEC.md`, `HOME_ONBOARDING_SCREEN_SPEC.md`와 원본 HTML을 대조했다. 최신 홈 규격을 관련 디자인 문서에 기록했다.

## 적용 결과와 원본과의 차이

| 항목           | 적용 결과                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 배치           | 인사 → 빈 여행 카드 → 활용 팁 세 개 → 공개 일정. 기존 도시 가이드와 여행 도구는 아래에 유지                              |
| 색·여백        | 바탕 #F8F9FF, 흰 카드 반경12, 좌우20, 구역 간격24, 빈 카드 안쪽24                                                        |
| 여행 시작 카드 | 가방80/64·위치 도장28·분홍/파랑 SVG 그라데이션·주행동 #B3261E/흰색                                                       |
| 글자·터치      | 제목18/26, 보조14/22, 주요 버튼52. 원본의 11~13px 글씨와 40~44px 행동은 앱의 최소 규격으로 확대                          |
| 안내 문구      | 영수증은 금액 확인 후 저장, 사진·메모는 여행별 보관으로 안내. 자동 확정·최적 경로·개인 전용 메모 약속 제외               |
| 공개 카드      | 실제 공개 목록의 도시 필터·제목·작성자·기간·허용된 사진만 사용. 인기 배지·저장 수·샘플 여행 제외                         |
| 사진·긴 제목   | 사진은144 높이, 사진 오류 안내는 내용에 따라 확장. 제목과 기간은 사진 아래에 표시해 오류 복구와 긴 글자를 가리지 않음    |
| 로고·아이콘    | 공식 TripPrint 로고·로컬 Pretendard 유지. Material Symbols는 설치된 Ionicons·MaterialIcons로 대응. 미구현 알림 버튼 제외 |
| 하단 메뉴      | 병행 변경의 디자인·경로 보존. 미사용 import 정리, 고정60 높이를 최소60과 콘텐츠 높이로 바꿔 200% 글자 겹침 보완          |
| 상태           | 기존 여행 요약·지난 여행 회원의 다음 여행 안내·로딩·오류 재시도 유지. 빈 홈에서 생성 버튼 중복 제거                      |

## 검사와 실제 캡처

`npm run check` 통과: 디자인 대비69/69, 코드 경계358파일 위반0, TypeScript·ESLint·Prettier 통과. 로그는 `outputs/home-html-20261020/check.log`에 저장했다.

브라우저 검사12/12 통과, 건너뜀0·예상 밖 실패0·재실행 의존0. 홈 여섯 검사와 로그인·여행 생성·항공편 입력·여행/공개 조회 복구를 함께 확인했다. 실행 결과는 `outputs/home-html-20261020/results.json`에 저장했다.

검수한 모바일 원본11파일의 통합 SHA256은 `e77bbbd1c11b201277fd4131be6923ee2fcf9cbae0348931c88ea99dc486bb3b`다. 파일별 원본·검사 소스·HTML 해시는 `outputs/home-html-20261020/source-manifest.json`에 기록했다.

브라우저 검사는 HTTP 응답을 격리해 실제 앱의 로그인·생성·필터·사진 권한 요청·원본 이동·복구 동작을 실행한다. 운영 서버나 외부 항공·OCR 공급자의 성공을 뜻하지 않는다. 검사 자료는 제품 데이터와 배포 번들에 넣지 않는다.

캡처 위치는 `outputs/home-html-20261020/`다. 원본 `reference-390.png`, 앱 `home-360.png`·`home-390.png`·`home-430.png`, 공개 필터 `discovery-360.png`·`discovery-390.png`·`discovery-430.png`, 320/200% `home-320-large.png`·`home-320-large-empty.png`, 조회 오류 `home-error.png`, 사진 오류·긴 제목 `photo-error-large.png`·`photo-title-large.png`를 확인한다.

실제 캡처에서 카드 순서·가방 모티프·색·여백·버튼을 원본과 대조했다. 큰 글자에서는 내용을 잘라내지 않고 세로로 늘린다. 공식 로고·최소 글자와 터치·실제 데이터·사진 아래 제목·추가 도시 가이드는 의도적으로 원본과 다르다. Android/iOS 실기기의 글꼴·그림자·터치 인수는 별도로 남는다.

## 변경 파일

- `HomeScreen.tsx`: 배치·단일 생성 행동·공개 탐색 경로.
- `HomeWelcomeGreeting.tsx`, `HomeEmptyHero.tsx`, `HomeGuide.tsx`: 인사·여행 시작 카드·팁의 새 규격과 문구.
- `HomeExplore.tsx`, `homeExploreStyles.ts`: 실제 공개 카드·도시 필터·사진 없는 상태·재시도.
- `HomeHeader.tsx`, `homeStyles.ts`, `homeTheme.ts`: 공식 로고·실제 계정 이동·홈 전용 색과 배경.
- `CommunityPhoto.tsx`: 홈의 표지 높이만 선택적으로 지정. 기존 사진 화면의 기본 비율과 오류 복구 유지.
- `GlobalNavigation.tsx`: 병행 디자인을 유지한 채 미사용 import·확대 글자 높이만 보완.
- `tests/web/workspace.spec.ts`: 홈 여섯 검사와 새 생성 진입 방식. 항공 검사 시계는 날짜 고정 대신 시간 흐름을 유지해 선택창 닫힘을 검증.
- 디자인 문서 세 개·HTML 원본·이 검수 기록.

DB·도메인 객체·API 계약은 바꾸지 않았다. 기존 서버·릴리스 검사·정적 헤더의 병행 변경은 보존했다.
