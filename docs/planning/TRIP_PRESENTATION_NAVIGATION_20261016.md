# 여행 표시·내비게이션·확인 창 정합성 수정

- 작성일: 2026-10-16
- 범위: 같은 여행의 상태·기간·열기 행동, 상세/작성 화면의 전역 메뉴, 확인·선택 시트.
- 파일명: `TRIP_PRESENTATION_NAVIGATION_YYYYMMDD.md`. 검수 캡처는 `outputs/trip-consistency/역할-폭.png`, 로그는 `scratch/presentation-*.log`.

## 확인한 원인

홈은 저장 상태로 배지를 표시하면서 날짜로 안내 문구와 정렬을 계산했다. 저장 상태가 PLANNED이고 종료일이 지난 여행에서 ‘여행 예정’과 ‘지난 여행’ 안내가 함께 나올 수 있었다. 홈·목록·상세의 기간 기호와 열기 버튼 문구도 달랐다. 서버에서 날짜만 보고 자동 완료하는 로직은 확인되지 않았다. 서버의 저장 상태·권한 검사와 클라이언트의 날짜 표시를 혼용한 문제가 핵심이었다.

상세 라우트는 이미 루트 Stack에 있었지만 GlobalNavigation을 Stack 밖에서 거의 모든 경로에 렌더링했다. 탭 내부 상세의 push 설정보다 루트 전역 메뉴의 표시 범위를 고쳐야 했다. 일부 모달은 페이지 내부 레이어였고, 확인 창과 메뉴마다 중앙 카드·우측 팝업·하단 패널을 따로 만들었다.

## 공통 표시 기준

공유 도메인 `packages/domain/src/tripLifecycle.ts`가 날짜 단계를 판단한다. 여행의 timezone으로 오늘의 ISO 달력 날짜를 구하며 표시 언어의 날짜 순서는 formatToParts로 제거한다. 예전 기록의 잘못된 시간대는 서버·기기 모두 UTC로 복구한다.

| 조건                        | 화면 단계                 | 저장·권한 영향      |
| --------------------------- | ------------------------- | ------------------- |
| 명시적 COMPLETED / ARCHIVED | 완료한 여행 / 보관한 여행 | 원래 선택 유지      |
| 종료일이 오늘보다 이전      | PAST / 지난 여행          | 자동 완료·공개 없음 |
| 출발일 ≤ 오늘 ≤ 종료일      | IN_PROGRESS / 여행 중     | 원본 상태 변경 없음 |
| 출발 전 DRAFT               | 준비 중                   | 원본 상태 변경 없음 |
| 그 밖의 출발 전 여행        | 여행 예정                 | 원본 상태 변경 없음 |

모바일 `tripPresentation.ts`가 같은 단계에서 배지·안내·버튼·기간을 만든다. 기존 모바일 tripLifecycle은 공유 도메인으로 연결하는 호환 진입점이다. 홈은 다른 작업에서 정리한 ‘현재·다음 여행 한 건’ 요약을 보존한다. 지난 여행은 내 여행의 지난 여행 필터에서 관리한다. 필터 건수·정렬도 같은 단계로 판단한다. 기존 useTripDateRefresh의 분 경계·전경 복귀 갱신을 유지한다.

완료한 여행은 ‘발자국 보기’로 다이어리를, 보관한 여행은 ‘보관한 여행 보기’로 상세를 연다. 나머지는 어디서 열어도 ‘여행 보기’로 상세를 연다. 여러 여행을 여는 최상위 목록 이동은 개별 여행 버튼과 다른 목적지다. 발자국 생성·공개는 기존 명시적 COMPLETED 검사와 소유자 권한을 그대로 사용한다.

기간은 기존 공통 travelDateRange의 `YYYY-MM-DD – YYYY-MM-DD`로 통일했다. 여행 생성 달력의 출발일·도착일 개별 값은 이전 요구대로 같은 해 `MM-DD`, 연도가 다르면 `YY-MM-DD`를 유지한다. 저장 날짜는 바꾸지 않는다.

## 내비게이션과 시트

전역 메뉴는 `/`, `/plans`, `/footprints`, `/community`, `/my`에서만 표시한다. `/trips/{id}`, `/diary/{id}`, `/new-trip`, 인증·가져오기·여행지 상세에는 표시하지 않는다. 최상위 화면에서 연 전체 편집 패널에도 전역 메뉴를 남기지 않는다. 상세는 기존 상단 뒤로가기와 페이지 행동만 사용하며 작성 이탈·저장 잠금은 유지한다. SafeAreaView와 기존 페이지 행동 영역을 보존해 하단 시스템 영역을 두 번 더하지 않는다.

ActionSheet는 React Native Modal 기반의 공통 바텀시트다. 아래 고정·흰 표면·둥근 위 모서리·55% 어두운 배경·화면 높이 제한·내부 스크롤·하단 안전 영역을 적용했다. 삭제 확인, 작성 이탈, 항공편 건너뛰기, 홈 여행 메뉴, 여행 더보기와 권한 안내를 연결했다. 전체 입력 화면과 OS 선택기는 전체 화면 모달을 유지한다. 상단 제목을 중복 표시하지 않는다.

모달 등록·우선순위·닫기 전환·배경 읽기 차단·웹 Tab 순환과 Escape·초점 복원은 기존 AppModal 계층을 재사용한다. Android 뒤로는 onRequestClose로 같은 닫기 행동에 연결한다. 취소·바깥 영역·뒤로는 저장 명령을 보내지 않는다. 저장 중 닫기 제한은 각 기존 호출자가 유지한다. iOS·Android 실기기 동작은 브라우저 검사로 대신 인증하지 않는다.

## 변경 파일

- 공통 도메인: packages/domain/src/tripLifecycle.ts, index.ts.
- 표시 모델: tripPresentation.ts, 기존 tripLifecycle.ts, homeDates.ts, presentation.ts.
- 연결: HomeTripList.tsx, TravelPlansScreen.tsx, travelPlans.ts, MY의 예정 여행 통계. 다른 작업의 홈 요약·공통 날짜·시간 갱신·상세 헤더·작업 메뉴 변경은 보존했다.
- 메뉴 범위: navigationPolicy.ts, GlobalNavigation.tsx.
- 공통 시트: ActionSheet.tsx, AppModal.tsx, WorkspaceConfirmDialog.tsx, scheduleExitGuard.tsx, TripPlanningFlow.tsx, HomeHeader.tsx, TripSectionNavigation.tsx, PermissionModal.tsx.
- 검수: tripPresentation.test.ts, 기존 tripLifecycle.test.ts·home-dates.test.ts, workspace.spec.ts, playwright.presentation.config.ts.
- 명세: 이 문서와 DB_DICTIONARY.txt. 물리 DB·저장 상태·공개 계약·마이그레이션 변경 없음.

## 검증

| 검사                  | 결과·증거                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 모델·인증 전체        | 194/194 통과. `scratch/presentation-auth.log`                                                                        |
| 관련 브라우저 흐름    | 15/15 통과. `scratch/presentation-browser-approved.log`                                                              |
| 360·390·430 최종 캡처 | 3/3 통과. DAY·영수증 날짜까지 기간에 맞춘 자료로 갱신. `scratch/presentation-fixture-browser.log`                    |
| 코드 전체             | npm run check 전체 통과. `scratch/presentation-check-complete.log`                                                   |
| Android Hermes        | 생성 통과. `scratch/presentation-android.log`, `apps/mobile/.release/presentation-android`                           |
| Android 자산·비밀     | 자산 65개, 누락 0. 배포 API 포함. 시험 API·서버 키 이름·실제 키·시험 키 미포함. `scratch/presentation-artifacts.log` |

브라우저는 삭제 7종의 취소·단일 명령, 항공편 목록과 여행 생성, 같은 여행의 목록·상세 표시, 전역 메뉴 분리, 현지 자정 이후 필터 갱신, 시트의 배경 차단·Tab·Escape·초점 복원, 프로필 중첩 이탈과 초안 보존을 확인했다. 기존 전체 브라우저 묶음을 모두 실행했다는 의미는 아니다. 전용 출력 `presentation-web`, 8793 포트에서 네트워크 검수 자료만 사용하며 실제 사용자 계정·원격 여행은 수정하지 않았다.

초기 회귀 검사에서 상세의 전역 홈 탭을 누르던 예전 단계를 상단 목록 이동으로 바꿨다. 네이티브 모달의 접근성 제목 전달 누락은 AppModal에서 고쳤으며, 현재 화면 검사에서 이전 화면의 숨겨진 헤더도 찾던 선택자는 보이는 대상으로 좁혔다. 검증 조건을 삭제하거나 성공 데이터로 우회하지 않았다. 최종 캡처 자료의 기간과 DAY·영수증 날짜도 함께 정리했다.

공유 작업 중 전체 형식 검사에서 지목한 design-tokens.json, 루트·문서 README, PRD Markdown은 내용 변경 없이 Prettier 서식만 맞췄다. 변경 전 원문은 `scratch/presentation-*-before-format.txt`에 보관했다. 다른 작업에서 진행 중인 기획·디자인 변경을 되돌리지 않았다.

공식 동작 참고: [Expo Router Stack](https://docs.expo.dev/router/advanced/stack/), [React Native Modal](https://reactnative.dev/docs/modal). 원격 배포·서명 APK/AAB·Play 업로드는 이번 작업에 포함하지 않는다.
