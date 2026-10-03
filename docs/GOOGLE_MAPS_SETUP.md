# Google Maps 연결 및 변경 보고

2026-10-03. 장소 검색을 Google Places API (New)로 변경했다. 선택한 장소는 일정에 연결하고 Google Maps 앱 또는 웹에서 열 수 있다. 앱 내부 지도 캔버스는 이번 변경에 포함되지 않는다.

## 서버 설정

1. Google Cloud 프로젝트에 결제를 연결하고 **Places API (New)**를 활성화한다.
2. 서버용 API 키를 생성하고 API 제한을 Places API (New)로 설정한다. Cloudflare Worker에서 호출하므로 Android 패키지나 웹 referrer 제한용 키와 분리한다. 비밀 키는 앱 환경 변수·Git에 넣지 않는다.
3. 로컬 API는 `apps/api/.dev.vars`에 `GOOGLE_PLACES_API_KEY`를 설정한다. staging 서버는 `apps/api`에서 `npx wrangler secret put GOOGLE_PLACES_API_KEY --env staging`으로 입력한다.
4. Supabase에 기존 마이그레이션 이후 `20261003000003_google_places.sql`을 적용한다. 이어서 설정한 환경의 최신 API를 배포한다. 로컬 dry-run 성공은 실제 배포를 의미하지 않는다.
5. 최신 커밋으로 EAS의 소문자 `preview` 프로필·Android 플랫폼을 선택해 APK를 다시 만든다. 스토어 제출은 필요 없다.

[Places 설정 공식 문서](https://developers.google.com/maps/documentation/places/web-service/cloud-setup), [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details).

## 저장과 화면 동작

검색 → 장소 선택 → 내용 확인 → 저장 순서다. 장소 ID를 일정과 함께 원자 저장한다. 일정 제목의 기본값은 사용자가 입력한 검색어이며 변경할 수 있다. 구글이 반환한 이름·주소는 일정 카드에서 다시 조회하고 Google Maps 및 공급자 출처를 표시한다. 수동으로 작성한 제목·주소·메모는 기존처럼 저장한다.

장소 ID만 보관하고 공급자 콘텐츠는 DB·영구 캐시에 복사하지 않는다. 선택한 장소 연결 해제와 구버전 클라이언트의 수정도 지원한다. API 키가 없어도 검색어 또는 이미 저장한 장소 ID로 Google Maps를 열 수 있다. [Google Places 데이터 및 출처 정책](https://developers.google.com/maps/documentation/places/web-service/policies).

## 변경 파일

| 파일                                                                                                        | 변경 내용                                                             |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/api/src/places.ts`                                                                                    | Google 검색·상세 조회, 서버 키 헤더, 필드 마스크, 응답 크기·시간 제한 |
| `apps/api/src/app.ts`                                                                                       | 인증된 장소 상세 조회 경로 추가                                       |
| `apps/api/src/types.ts`, `apps/api/.dev.vars.example`                                                       | Google 서버 비밀 키 설정 계약                                         |
| `apps/mobile/src/features/workspace/GooglePlace.tsx`                                                        | 최신 장소 표시·출처·Google Maps 열기                                  |
| `apps/mobile/src/features/workspace/PlaceSearch.tsx`                                                        | Google 검색 결과 선택 및 장소 ID 전달                                 |
| `apps/mobile/src/features/workspace/PlanEditor.tsx`                                                         | 일정 장소 연결·해제와 상세 확인                                       |
| `apps/mobile/src/features/workspace/WorkspaceScreen.tsx`                                                    | 저장한 일정의 장소 표시·지도 열기                                     |
| `apps/mobile/src/features/workspace/forms.ts`                                                               | 일정 폼 장소 ID 보존                                                  |
| `packages/domain/src/workspace.ts`, `packages/validation/src/workspace.ts`                                  | 장소 ID 도메인 및 엄격 입력 계약                                      |
| `supabase/migrations/20261003000003_google_places.sql`                                                      | 비공개 장소 ID 테이블·원자 저장·권한 유지                             |
| `apps/api/test/places.test.ts`, `apps/api/test/workspace.test.ts`                                           | Google HTTP 계약·키 보호·멱등 저장·해제·외부 사용자 거부 검증         |
| `tests/web/workspace.spec.ts`                                                                               | 장소 선택 후 사용자 작성 값과 Google 콘텐츠 구분 검증                 |
| `docs/DB_DICTIONARY.txt`                                                                                    | v2.0 테이블·컬럼·제약·응답 객체 명세                                  |
| `README.md`, `docs/BUILD_CHECKLIST.md`, `docs/PROJECT_PROGRESS_REPORT.md`, `docs/TEST_FEEDBACK_20261003.md` | 공급자 변경·설정·재빌드 안내 갱신                                     |

## 검증

- `npm run check`: 통과.
- `npm run test:foundation`: SQL/API 45개 통과.
- `npm run api:build`: staging Worker dry-run 통과.
- `npm run test:workspace:web`: 브라우저 4개 통과, 기본 웹 번들 복구 완료.
- `npm run mvp:bundle:android`: Android 1511개 모듈 및 Hermes 4.4MB 번들 생성 통과. 서명된 APK 생성은 별도 EAS 빌드가 필요하다.

실제 Google Cloud 키를 사용한 검색, 원격 DB 마이그레이션·API 배포, 새 APK 설치 후 Google Maps 앱 전환 확인은 환경 설정 후 수행해야 한다.
