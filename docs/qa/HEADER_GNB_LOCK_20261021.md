# 헤더·GNB 규격 고정 보완

작업일: 2026-10-21. 대상은 [소스 전수 검사](HEADER_GNB_CODE_AUDIT_20261021.md)의 F01~F07이다. 기준은 AGENTS.md 8항, DESIGN.md, SCREEN_HEADER_SPEC.md, design-tokens.json과 공개 발자국의 승인된 브랜드형이다.

## 적용 내용

| 검사 항목          | 조치                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 임의 헤더 교체 | 공개 목록의 `header: ReactNode`를 제거하고 `headerVariant: 'public-brand'`로 제한했다. ScreenHeader의 `right: ReactNode`와 LedgerScreen의 미사용 action 슬롯도 제거했다.            |
| F01 제목 스타일    | ScreenTitle은 문자열 제목과 grow만 받는다. 페이지가 글꼴·색·크기·행간·말줄임을 전달하거나 제목 안에 별도 스타일 요소를 넣을 수 없다.                                                |
| F02 페이지 장식    | publicFeedStyles.header와 페이지 래퍼를 제거했다. 기존 바탕·1px 구분선은 공통 HomeHeader의 public-feed 유형과 navigation.brandFeed 토큰으로 보존했다.                               |
| F03 스타일 소유    | HomeHeader를 components로 옮기고 7개 브랜드 배치 스타일을 같은 폴더의 homeHeaderStyles로 분리했다. 헤더 높이·너비·여백·행동 간격, GNB 라벨·초점선은 기존 값의 공통 토큰을 참조한다. |
| F04 미사용 스타일  | loginStyles 3개, myAccountStyles 5개, homeStyles 10개, myTripsStyles 2개, workspaceStyles 1개, DestinationPicker 2개 등 총 23개를 제거했다.                                         |
| F05 구형 목록      | 실행 import가 없는 TravelPlansScreen과 그 전용 travelPlansStyles를 제거했다. 현재 /plans의 MyTripsScreen은 유지했다.                                                                |
| F06 자동 차단      | check:navigation을 만들고 npm run check에 연결했다. 기존 CI·웹 배포·내부 빌드의 check 단계에도 같은 검사가 적용된다.                                                                |
| F07 상태별 헤더    | MY 인증 대기에 MY 헤더를 표시하고, 전체 화면 인증 복구 오류에는 진입 화면 역할에 맞는 RecoveryHeader를 표시한다. 재시도·공개 목록 복귀·토큰 보존 동작을 유지한다.                   |

우측 행동은 이제 HeaderActionItem 배열로 전달한다. 공통 HeaderActions가 의미 아이콘, 접근성 이름, 펼침 상태와 실제 잠금을 연결한다. 검색·계정·더보기·닫기·다음·완료의 문구와 콜백은 보존했다. 텍스트 행동의 폼 잠금도 유지한다.

화면 파일·경로·헤더 유형·인증 전 제목·GNB 표시는 `apps/mobile/src/components/screenNavigationPolicy.json`에서 관리한다. GNB 표시 정책과 인증 복구 헤더가 이 목록을 공유한다. 성공 후 실제 여행명이나 DAY·검색·필터 상태를 일반 제목으로 바꾸지는 않는다. 시작 BI의 헤더 생략도 유지한다.

## 자동 검사 범위

- 전체 앱 소스의 공통 요소 호출을 TypeScript 구문·심벌로 확인한다. 가져오기 별칭과 재내보내기도 추적한다.
- 허용하지 않은 style·속성·JSX spread, 헤더만 감싼 페이지 장식, 헤더 JSX 전달 계약, 페이지 전용 헤더 스타일·복제 컴포넌트를 차단한다.
- 페이지에서 네이티브 헤더·탭 바를 켜거나 별도 렌더러·스타일을 지정하는 것을 차단한다. 부모 여백 생략은 기존 두 시트로 제한한다.
- GNB는 루트의 한 곳에서만 렌더링한다. 신규·삭제 라우트와 정책 목록을 대조하고, 경로·유형·GNB 표시·공통 헤더 연결 누락을 실패 처리한다.
- 규칙 자체의 차단 테스트 8개와 탐색 정책 단위 테스트 4개를 추가했다. 본문 카드·구역 제목은 승인된 사용처와 구분한다.

이 검사는 등록된 경계와 구문을 검사한다. 임의의 새 이름이나 간접 표현으로 만든 모든 시각적 복제를 정적 분석만으로 증명하지는 못한다. 공통 정책·허용 목록의 변경 검토와 실제 화면 캡처 검수도 계속 필요하다. 실행 의존성 연결은 특정 분기가 반드시 렌더링된다는 증명과 구분한다.

## 화면 유지와 상태 검증

참조 시안은 `docs/design/headers/index.html`의 H01~H08이다. 제목 26/36·700·왼쪽 정렬, 로고 24/34, 좌우 20, 최소 터치 48, 헤더 아이콘 24, GNB 라벨 13/20·600과 선택 캡슐·생성 원의 기존 값을 유지한다. 공개 발자국의 바탕·구분선과 홈 로고·계정 위치도 유지한다.

브라우저 검사는 외부 API 응답만 fixture로 격리한 실제 앱 번들을 사용한다. 제품에 더미 계정·가짜 로그인·검수 전용 화면은 추가하지 않았다. 새 검사는 인증 요청을 실제로 대기·실패시켜 MY 로딩→오류→재시도 복구와 작성 진입 오류→공개 목록 복귀를 확인한다. 가려진 배경의 GNB가 읽기·조작에 노출되지 않는지도 검사한다.

최종 검증 결과:

| 검사                           | 결과                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm run check                  | 통과. 대비 75/75, 코드 경계 387개 파일 위반 0건, 탐색 경계 327개 소스·21개 화면 위반 0건, 타입·린트·포맷 통과                                             |
| 자동 차단 규칙 테스트          | 8/8 통과                                                                                                                                                  |
| 탐색 정책 단위 테스트          | 4/4 통과                                                                                                                                                  |
| 헤더·접근성·GNB·복귀 화면 검사 | 21/21 통과. 너비 320·390·430과 글자 100·200%, 긴 제목, 정상·대기·오류·복구 포함                                                                           |
| 관련 동작                      | 최초 19개 통과. 과거 복귀 기대값을 바로잡은 1개도 재실행 통과해 대상 20개 모두 확인                                                                       |
| 실제 캡처 대조                 | MY 대기·오류, 작성 오류, 항공권 입력, 내 여행의 320/200%, 공개 발자국의 390/100%, 홈의 320/200%를 열어 확인. 제목·아이콘·구분선·줄바꿈이 공통 규격과 일치 |

관련 동작 중 과거 검사는 홈에서 여행을 생성했는데도 뒤로가기가 항상 /plans로 가길 기대했다. 현재 승인된 H04 규칙은 실제 이전 화면을 우선하며 이전 화면이 없는 직접 진입에서 /plans를 사용한다. 제품 동작은 바꾸지 않고 검사에 실제 진입 URL을 기록해 복귀를 확인하도록 수정했다. 같은 검사에서 초안 폐기 뒤 재진입, 시간 경고와 일정 삭제 후 예상 비용도 확인했다. 실패한 최초 로그는 related.log에, 해당 검사의 통과 기록은 return-recheck.log에 남겼다.

222개 PNG를 저장한 캡처 폴더에서 위 대표 화면을 직접 열어 확인했다. 큰 글자에서는 헤더·GNB가 내용에 맞게 늘어나고, 오류 본문과 행동은 스크롤로 읽는다. 긴 제목을 줄이거나 가로로 숨겨 통과시키지 않았다. 로딩·오류에 헤더를 추가한 부분이 이번 요청에 따른 시각적 보완이며, 일반 화면의 디자인 수치는 변경하지 않았다.

현재 실행 환경에서 로컬 소켓 연결이 EACCES로 막혀 최초 화면 검사가 대기했다. 대기 작업을 종료한 뒤 로컬 서버·Chrome에 필요한 실행 권한으로 같은 웹 번들을 검사했다. browser-final.log의 종료 결과는 21 passed다. 외부 배포로 우회하거나 앱 코드를 바꾸지 않았다.

로그는 `outputs/header-gnb-lock-20261021/`, 실제 캡처는 `outputs/header-standard/`에 보관한다. 이번 작업에서 API·DB·공개 여행 데이터는 수정하지 않았으며 외부 배포와 Android 빌드는 실행하지 않았다. Android의 운영체제 글자 배율·TalkBack·기기 뒤로가기는 내부 테스트에서 별도로 확인해야 한다.

## 변경 파일 안내

- 공통 구현: components의 ScreenHeader, ScreenTitle, HeaderActions, HomeHeader, homeHeaderStyles, RecoveryHeader, GlobalNavigation, navigationPolicy, screenNavigationPolicy.json, ActionSheet.
- 화면 연결: MY, AuthRecoveryBoundary, AuthFormChrome, HomeScreen, CommunityScreenView, PublicFootprintsScreen, communityFeedTypes, MyTripsControls, FlightTicketEditorView, TripPlanningFlowView, WorkspaceSections, LedgerUI.
- 잔재 제거: 앞 표의 6개 스타일 파일과 TravelPlansScreen·travelPlansStyles. 그 밖의 본문 스타일은 유지한다.
- 검사: scripts/check-navigation-boundaries.mjs, scripts/navigation-guard/, tests/release/navigation-boundaries.test.mjs, tests/auth/navigationPolicy.test.ts, tests/web/workspace.spec.ts, package.json.
- 문서·토큰: SCREEN_HEADER_SPEC.md, FOOTPRINTS_PUBLIC_FEED_SPEC.md, design-tokens.json, 수정 전 감사 기록의 후속 링크와 이 검증 기록.

공유 작업 폴더에 있던 다른 변경은 보존했다. 이번 요청에 없는 커밋·푸시·배포는 수행하지 않았다.
