# Google 지도·장소 검색 설정

기준일: 2026-10-16. 내부 테스트 Android 앱의 지도·검색 신고를 확인한 결과다. 설치본의 버전과 빌드 경로는 확인하지 않았으며, 아래 코드 수정은 다음 설치본에 반영해야 한다.

## 확인한 원인과 수정

| 항목                 | 확인한 상태                                                                  | 이번 수정                                                     |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 빈 일정 지도         | 일정이 0개면 지도 컴포넌트를 생성하지 않음                                   | 빈 일정에도 지도 영역과 안내를 함께 표시                      |
| 앱 안의 장소 검색    | 화면은 외부 Google Maps만 열고 검색 API를 호출하지 않음                      | 검색 버튼을 눌렀을 때 인증된 API 조회·결과 선택 연결          |
| 이전 검색 클라이언트 | 폐기된 `/api/places/search`와 이전 응답 형식 사용                            | `/api/v1/places/search`, 인증·공통 응답·취소 신호 사용        |
| GitHub 빌드          | Android 지도 키 전달 설정 없음                                               | Secrets 전달과 prebuild 전 키 형식 검사 추가                  |
| staging 장소 검색    | 사용자 `GOOGLE_PLACES_API_KEY` Secret 등록 후 실제 인증 요청200·결과4개 확인 | 해결. 최신 사진·무료 한도 결과는 `qa/GOOGLE_PLACE_PHOTOS.txt` |

로컬 Android 키의 존재와 형식은 확인했다. GitHub/EAS 원격 키, Google Cloud API 활성화·결제·제한, Play 설치본의 실제 서명은 아직 확인하지 않았다. 로컬 키가 있다는 사실만으로 Play 지도가 열린다고 판단하지 않는다.

## 서로 다른 두 키

Android 기본 지도는 `GOOGLE_MAPS_ANDROID_API_KEY`를 사용한다. Google Cloud에서 Maps SDK for Android를 활성화하고 Android 앱 제한에 `com.tripprint.app`과 Play Console의 **앱 서명 인증서 SHA-1**을 등록한다. 직접 설치 APK와 Play 설치본의 서명은 다를 수 있으므로 업로드 키만 등록해서는 Play 동작을 보장할 수 없다. [Google 지도 키 보안 지침](https://developers.google.com/maps/api-security-best-practices).

GitHub Actions에는 같은 이름의 Secret을 등록해야 한다. 워크플로는 이 값을 Expo 설정과 Gradle에 전달한다. `node scripts/check-android-maps.mjs`는 누락·형식 오류를 중단하지만 키의 실제 유효성이나 서명 제한을 검증하지는 않는다. EAS를 선택하면 해당 원격 빌드 환경에도 키가 필요하다. 키 원문은 공개 Expo 설정·JS 번들·문서·로그에 넣지 않으며, 앱에는 지도 사용 가능 여부만 전달한다. 네이티브 Manifest에 들어가는 Android 키는 앱 제한으로 보호한다.

장소 검색은 서버 전용 `GOOGLE_PLACES_API_KEY`를 사용한다. Places API (New)를 활성화한 키를 `tripprint-api-staging`의 Worker Secret으로 등록해야 한다. 이 키는 앱에 전달하지 않고 서버에서만 Google 요청 헤더로 사용한다. Android SDK 키로 대신하지 않는다. [Text Search 공식 문서](https://developers.google.com/maps/documentation/places/web-service/text-search).

## 화면과 저장 계약

검색어 입력만으로 Google 요청을 보내지 않는다. 두 글자 이상 입력하고 ‘장소 검색’을 눌러야 조회한다. 도시는 검색어 앞에 붙이며 전체 200자까지 허용한다. 검색 중 중복 실행을 막고, 검색어·도시·계정·잠금 변경, 검색 영역 접기, 화면 종료 시 이전 요청과 시간 제한을 정리한다. 15초 지연, 결과 없음, 인증 만료, 서버 오류는 재검색·직접 입력·외부 지도 이용으로 안내한다.

결과 이름·주소·출처는 현재 화면에서만 보여 준다. 선택하면 Google 장소 ID와 사용자가 입력한 제목을 미저장 폼에 전달하며 자동 저장하지 않는다. 공급자 이름·주소·좌표를 DB나 영구 캐시에 복사하지 않는다. 지도에서 확인한 위치와 사용자가 작성한 주소·메모는 기존 저장 계약을 따른다. 실제 장소 ID로 Google Maps를 여는 경로와 공유 링크 가져오기도 유지한다. [Google Places 정책](https://developers.google.com/maps/documentation/places/web-service/policies).

Android는 네이티브 Google 기본 지도를, 웹 검수 화면은 기존 위치 도식을 사용한다. 웹 테스트 성공은 Android 타일 표시 성공의 근거가 아니다. 기본 지도 열람에는 GPS 권한을 요구하지 않으며 ‘현재 위치’는 별도의 권한 흐름을 따른다.

## 검증과 인계

이번 변경의 검사 결과는 [현재 상태](CURRENT_STATUS.txt)와 [빌드 전 인계](PLAY_INTERNAL_PREBUILD.txt)에 기록한다. API·브라우저 테스트는 외부 HTTP 응답만 대체하며, Google의 실제 검색 성공을 뜻하지 않는다.

키 등록·API 활성화·Play 서명 제한을 확인한 뒤 새 내부 테스트 설치본에서 빈 일정 지도, 위치 선택, 수동 검색, 선택 후 저장, 오류 후 재시도를 확인한다. 사용자의 범위에 따라 이번 작업에서는 AAB/APK 생성·업로드·배포를 실행하지 않는다.

## 이번 검사의 근거

모델·인증 200/200, 릴리스 48/48, 장소 API 5/5, 관련 Chrome 19/19를 통과했다. 릴리스 검사는 제한 환경에서 자동 연결 목록이 0건으로 조회되고 임시 파일 rename이 거부되어 실패했으며, 정상 실행 환경에서 같은 검사가 모두 통과했다. Chrome도 정상 실행 환경에서 실행했다.

로그: `outputs/maps-auth-tests.log`, `outputs/maps-release-tests-native.log`, `outputs/maps-api-tests.log`, `outputs/maps-web-tests-final.log`. `npm run check`는 `outputs/maps-check-verified.log`에서 전체 통과했다. 병행 헤더 수정 뒤 발견한 `CityGuideScreen.tsx`의 미사용 `colors` import 한 줄도 제거했다. 지도 전용 파일 9개는 관련 검사 전후 변경이 없음을 확인했다.

`UI/UX` 채팅의 공통 헤더 수정이 계속되어 검사 시작 뒤 최소 6개 소스 변경을 확인했다. 이번 브라우저 결과는 검수 웹 출력 시점의 코드 기준이며 현재 전체 화면의 통합 최종 검증으로 확정하지 않는다.

## 수정 파일

| 파일                                                                            | 변경                                                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `PlaceSearch.tsx`, `PlaceSearchResults.tsx`                                     | 수동 인증 검색·응답 검증·선택·잠금·시간 제한·취소·오류 안내. 공급자 결과는 화면 메모리만 사용           |
| `ScheduleEditor.tsx`, `PlanEditor.tsx`                                          | 폼·DAY·유형별 검색 수명 분리. 병행 헤더 수정 보존                                                       |
| `TripMap.tsx`, `TripMapCanvas.native.tsx`                                       | 빈 일정 지도 생성과 빈 지도 오류 안내 보완                                                              |
| `packages/api-client/src/index.ts`                                              | 검색을 현재 인증 경로·공통 응답·취소 계약으로 교체                                                      |
| `.github/workflows/play-internal.yml`, `scripts/check-android-maps.mjs`         | Android SDK 키 전달과 prebuild 전 누락·형식 검사                                                        |
| `tests/auth/placeSearch.test.ts`, `tests/release/maps-config.test.mjs`          | 검색 HTTP 계약·오류·취소 및 키 누락·CI 검사                                                             |
| `tests/web/workspace.spec.ts`                                                   | 검색·선택·저장·지연 폐기·빈 결과·503/401·영역 종료·빈 지도 4개 추가. 기존 위치·공유·일정·IA 15개와 검증 |
| `docs/qa/DEVICE_ACCEPTANCE.txt`                                                 | 빈 일정 실제 지도·Play 서명·실제 검색·오류 복구·지연 폐기 인수 항목 추가. 모두 미실행으로 유지          |
| `CityGuideScreen.tsx`                                                           | 병행 변경에서 남은 미사용 import 한 줄 제거                                                             |
| `docs/DB_DICTIONARY.txt`                                                        | 검색 표시 객체·API·요청 수명·빌드 입력 계약. DB 스키마 변경 없음                                        |
| `docs/GOOGLE_MAPS_SETUP.md`, `CURRENT_STATUS.txt`, `PLAY_INTERNAL_PREBUILD.txt` | 확인한 원인·코드 검사·미등록 운영 설정·통합 검증 대기를 구분                                            |

2026-10-16 후속: 사진·검색 API Worker256597e9와 웹eff24df8 반영, D1월별 검색4000/상세4000/사진900 차단. 실제 사진19/19·화면19/19·인증 검색200. Android Maps SDK의 Play 서명 제한/타일 성공과는 별도다. [최신 사진·무료 한도 검증](qa/GOOGLE_PLACE_PHOTOS.txt).
