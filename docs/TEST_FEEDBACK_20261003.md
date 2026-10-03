# Android 테스트 피드백 반영

## 반영한 동작

- Android 시스템 내비게이션 바를 기본 숨김으로 설정한다. Expo 네이티브 구현의 스와이프 일시 표시 동작을 사용한다. 시스템 바가 나타나는 경우 탭 높이에 하단 안전 영역을 반영한다.
- SDK의 초기 실제 세션 복원이 끝난 뒤 인증되지 않은 탭 진입은 로그인으로 전환한다. 로그인 성공 또는 사용자가 명시한 게스트 둘러보기 후에만 탭을 연다. 유효한 실제 로그인 세션은 재실행 시 유지한다.
- 새 여행은 항공 편명 등록에서 시작한다. 사용자 요청 변경에 따라 예약 번호 조회와 항공권 이미지 OCR은 구현 범위에서 제외한다. 편명·출발/도착 IATA 공항·선택 시각을 확인 입력한다. 항공편 없이 여행 만들기도 명시적으로 제공한다.
- 나라 검색·추천 → 도시 검색·추천 → 달력 날짜 선택 → 선택 제목 순서로 여행을 작성한다. 추천은 한국·일본·미국이며 다른 목적지는 직접 입력할 수 있다. 추천 선택 시 기본 시간대와 지원 통화를 채운다. 미국 서부 도시는 별도 시간대를 사용한다.
- 여행 날짜·영수증 결제일은 달력, 일정·항공편 시각은 시간 선택기를 제공한다. 제목은 생략 시 기존 서버 자동 생성 규칙을 사용한다. 일정 순서는 수동 입력에서 제외한다.
- 장소 추가 팝업은 영수증 촬영·사진 선택과 Google Places 검색을 먼저 보여준다. 선택한 장소 ID를 일정에 연결하며 장소명·주소는 화면에서 최신 조회한다. Google Maps와 공급자 출처를 표시한다. [구글 지도 변경 및 설정](GOOGLE_MAPS_SETUP.md)
- 발자취 탭은 내 여행과 동일한 서버 여행을 사용한다. 기존 기기 기록은 `/local-records` 화면과 이전 기록 보기 버튼으로 보존한다. 이전 기록 폼은 기존 방식으로 유지하며 자동으로 서버로 옮기지 않는다.

## 새 APK 설치 전 필요한 작업

1. Supabase에 `20261003000002_flight_onboarding.sql`까지 마이그레이션을 적용한다.
2. 최신 API를 테스트 서버에 배포한다.
3. 실제 앱 내 장소 검색은 Google Cloud에서 Places API (New)를 활성화하고 서버 `GOOGLE_PLACES_API_KEY`를 설정한다. 앱에 비밀 키를 넣지 않는다. [설정 절차](GOOGLE_MAPS_SETUP.md)
4. 네이티브 navigation-bar와 날짜 선택기 패키지가 추가되어 새 `preview` APK가 필요하다. JavaScript 업데이트만으로 기존 APK에 적용되지 않는다.

## 검증 범위

확인 결과: `npm run check` 통과, SQL/API 회귀 43개 통과(공급자 변경 후 지도 API 3개 재검증), 앱 브라우저 4개와 기존 기기 기록/콜백 브라우저 4개 통과. SDK 패키지 호환 검사 통과. Android Hermes 번들 1510 모듈·4.4MB 생성, native config introspection에서 `expoNavigationBarHidden=true` 및 날짜 선택기 플러그인을 확인했다. staging Worker dry-run도 통과했다. APK 생성·설치 검증과는 별도 결과다.

항공편 생성·멱등 재시도·잘못된 입력 전체 롤백은 실제 마이그레이션을 적용한 격리 PostgreSQL 엔진으로 검증한다. 지도 검색은 인증·키 누락·요청 endpoint·비밀 헤더·축소 응답의 HTTP 경계를 검증한다. 실제 지도 공급자 정확도, 항공사 운항 조회, 삼성 시스템 바 제스처·키보드·권한 팝업 동작은 원격 설정과 실기기 재검증이 필요하다.

설치 APK의 화면에 하단 탭이 3개만 있으면 현재 소스의 4개 탭과 다르므로 빌드 상세의 Git 커밋과 profile을 확인한다.

## 수정 파일

| 파일                                                                                                                                                                                | 변경                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app.config.ts`, `apps/mobile/app.config.ts`, `apps/mobile/package.json`, `package-lock.json`                                                                                       | 시스템 바·날짜 선택기 설치 및 네이티브 플러그인 설정                                          |
| `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/(tabs)/_layout.tsx`, `apps/mobile/src/features/auth/AuthBridge.tsx`                                                         | 시스템 바 기본 숨김, 안전 영역, 초기 인증 확인 및 탭 진입 보호                                |
| `apps/mobile/src/features/workspace/TravelInputs.tsx`, `PlanEditor.tsx`, `WorkspaceScreen.tsx`                                                                                      | 항공편·공항 추천, 목적지 기본값, 달력·시각 입력, 제목 자동 생성, 영수증/지도 우선 작성        |
| `apps/mobile/src/features/workspace/PlaceSearch.tsx`, `apps/api/src/places.ts`, `apps/api/src/app.ts`, `apps/api/src/ocr.ts`, `apps/api/src/types.ts`, `apps/api/.dev.vars.example` | 인증된 장소 검색, 크기 제한 응답 읽기 재사용, 서버 키와 실패 처리, 출처 표시                  |
| `apps/mobile/src/features/workspace/FootprintsScreen.tsx`, `apps/mobile/src/app/(tabs)/footprints.tsx`, `apps/mobile/src/app/local-records.tsx`                                     | 서버 여행 기록 단일 원본과 이전 기기 기록 진입 유지                                           |
| `packages/domain/src/foundation.ts`, `packages/validation/src/foundation.ts`, `supabase/migrations/20261003000002_flight_onboarding.sql`, `docs/DB_DICTIONARY.txt`                  | 항공편 생성 계약·원자 저장·DB 명세 v1.9                                                       |
| `apps/api/test/database.ts`, `apps/api/test/flight.test.ts`, `apps/api/test/places.test.ts`, `tests/web/workspace.spec.ts`, `tests/web/trail.spec.ts`                               | 항공편 멱등·롤백, 지도 인증·키 누락·비밀 비노출, 달력·공항·로그인·지도 선택 및 이전 기록 회귀 |
| `README.md`, `docs/BUILD_CHECKLIST.md`, `docs/PROJECT_PROGRESS_REPORT.md`, `docs/TEST_FEEDBACK_20261003.md`                                                                         | 피드백 결과, 새 APK와 DB/API 적용 및 실제 공급자 설정 안내                                    |
