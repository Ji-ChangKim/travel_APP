# WHEREGO MVP API 계약

- 버전: v0.1 / 작성일: 2026-10-02 / 상태: **제안 계약, 현행 엔드포인트 아님**
- 관련: [필수 기능](FEATURE_SPEC.md), [데이터 저장](DATA_STORAGE_SPEC.md), [권한](POLICY_DECISIONS.md)
- 제안 prefix: `/api/v1`. 현행 `/api/places/search`, `/api/share/link`, `/api/receipt/ocr` 목업과 분리해 이행한다.
- M1 갱신: `/api/v1`의 생성/조회/준비물 기반은 구현했다. 실제 제공 범위·응답 차이와 미구현 경로는 [실행 기록](M0_M1_EXECUTION.md)을 기준으로 한다. 나머지 계약은 후속 목표이며 기존 목업 경로는 현재 503이다.

## 1. 책임과 공통 규칙

로그인 자체는 실제 Auth 제공자·Supabase Auth 연동으로 수행한다. 아래 API는 발급된 세션을 서버에서 검증하고 actor UUID를 결정한다. 사용자 입력의 userId/ownerId로 로그인·소유권을 대체하지 않는다.

앱→인증된 API→DB 트랜잭션/권한 검사→확정 응답을 권장한다. 서버가 Auth 검증을 생략하는 내부 endpoint를 만들지 않는다. 공개 초대 안내 외 모든 데이터 API는 Authorization Bearer 세션이 필요하다.

| 항목           | 계약                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| 필드명         | JSON camelCase, DB snake_case. 매핑은 서버에서 명시                                                           |
| 식별자         | UUID, 장소 공급자 ID는 별도 문자열                                                                            |
| 날짜/시각      | DATE 문자열 YYYY-MM-DD, timeSlot HH:MM/null, timestamp UTC ISO 8601                                           |
| 금액           | decimal string 예: `"2695"`, `"12.50"`. amount는 응답도 문자열                                                |
| 쓰기 중복키    | `Idempotency-Key: 요청 UUID`, 재전송은 같은 경로·본문·키 유지                                                 |
| 여행 버전      | 모든 여행 쓰기(생성/초대 수락 제외)에 `If-Match: "trip:<UUID>:<version>"` 필수. 이것이 문서의 expectedVersion |
| 프로필 버전    | `If-Match: "profile:<UUID>:<version>"`                                                                        |
| 충돌 후 재작성 | 최신 조회→사용자 변경 확인→새 버전·새 요청 키. 자동 덮어쓰기 금지                                             |
| 응답 유실      | 같은 키로 결과 재생. 버전 검사보다 완료 결과 재생이 먼저, 현재 권한은 항상 재검사                             |
| null           | 선택 연결 없음은 null. PATCH에서 누락은 유지, null은 해당 필드 해제                                           |
| 쓰기 결과      | 성공 상태+확정 ID+tripVersion. 명령 실패는 일부 데이터 저장 성공 없음                                         |
| 보관 여행      | 읽기 가능, 일반 쓰기·초대 수락 거부. owner 보관 해제/삭제만 허용                                              |

중복키 보존은 24시간 권장(D-15). 같은 키의 입력이 다르면 REQUEST_KEY_REUSED. 삭제 재생은 원 실행 사용자에 최소 삭제 확인만 반환한다. 권한 철회 후 이전 결과 재생으로 내용을 노출하지 않는다.

### 성공·오류 형식

```json
{
  "data": { "id": "리소스 UUID", "tripVersion": 13 },
  "meta": { "requestId": "추적 ID", "replayed": false }
}
```

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "다른 변경이 반영되었습니다. 최신 내용을 확인해 주세요.",
    "fieldErrors": {},
    "currentVersion": 14
  },
  "meta": { "requestId": "추적 ID" }
}
```

예시는 구조 설명이며 실제 UUID 값이 아니다. requestId와 mutation key는 별개다. 오류 응답에 SQL 원문·서버 비밀·token_hash·원문 초대 토큰을 포함하지 않는다.

## 2. API 목록

| method/path                                        | 권한                 | 주요 입력                                                                   | 응답·저장                       |
| -------------------------------------------------- | -------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| GET `/me`                                          | 인증 본인            | 없음                                                                        | Profile·version                 |
| PATCH `/me`                                        | 본인                 | nickname/bio + profile 버전                                                 | profiles 갱신                   |
| GET `/trips`                                       | 인증                 | filter/cursor/limit                                                         | 멤버 여행 요약·nextCursor       |
| POST `/trips`                                      | 인증                 | country/city/startDate/endDate/timezone/title?/defaultCurrency?/coverColor? | 201 여행+owner+DAY, version=1   |
| GET `/trips/{tripId}`                              | 멤버                 | 없음                                                                        | 일관된 여행 상세 snapshot       |
| POST `/trips/{tripId}/period-preview`              | owner                | startDate/endDate + 여행 버전                                               | 영향 날짜/개수, 저장 없음       |
| PATCH `/trips/{tripId}`                            | owner                | 변경 필드 + 여행 버전                                                       | 기간·DAY 포함 원자적 수정       |
| DELETE `/trips/{tripId}`                           | owner                | 여행 버전                                                                   | 200 deletedId, 하위 삭제        |
| GET `/places/search`                               | 인증                 | q/provider?, limit/cursor?                                                  | 외부 검색 후보, DB 저장 없음    |
| POST `/trips/{tripId}/days/{dayId}/itinerary`      | owner/editor         | 유형·제목·장소·시각·메모·예상비용 + 버전                                    | 201 일정+선택 장소/비용         |
| PATCH `/itinerary/{itemId}`                        | owner/editor         | 내용 변경·선택 estimatedExpense + 버전                                      | 일정/예상비용 갱신              |
| POST `/itinerary/{itemId}/move`                    | owner/editor         | targetDayId + 버전                                                          | 일정·연결 비용 DAY 이동         |
| DELETE `/itinerary/{itemId}`                       | owner/editor         | 여행 버전                                                                   | 예상 제거·실제 연결 해제        |
| PUT `/trips/{tripId}/days/{dayId}/itinerary-order` | owner/editor         | itemIds 전체 배열 + 버전                                                    | 일괄 sortOrder·버전             |
| POST `/trips/{tripId}/expenses`                    | owner/editor         | 제목·금액·통화·구분·선택 연결 + 버전                                        | 201 비용                        |
| PATCH `/expenses/{expenseId}`                      | owner/editor         | 비용 변경 + 버전                                                            | 비용·연결 검증 후 갱신          |
| DELETE `/expenses/{expenseId}`                     | owner/editor         | 여행 버전                                                                   | 비용 삭제                       |
| POST `/trips/{tripId}/checklists`                  | owner/editor         | title + 버전                                                                | 201 항목                        |
| PATCH `/checklists/{itemId}`                       | owner/editor         | title?/isCompleted? + 버전                                                  | 원하는 상태 저장                |
| DELETE `/checklists/{itemId}`                      | owner/editor         | 여행 버전                                                                   | 항목 삭제                       |
| POST `/trips/{tripId}/invites`                     | owner                | role + 버전                                                                 | 201 inviteId/원문 link 1회/만료 |
| GET `/trips/{tripId}/invites`                      | owner                | 없음                                                                        | 초대 메타데이터, 원문 없음      |
| DELETE `/invites/{inviteId}`                       | owner                | 여행 버전                                                                   | 철회 시각 저장                  |
| GET `/invites/{token}/preview`                     | 유효 링크 소지자     | token 경로                                                                  | 최소 여행·role·expiresAt        |
| POST `/invites/{token}/accept`                     | 실제 인증            | 본문 없음, 중복키                                                           | 200 멤버/여행·role·버전         |
| PATCH `/trips/{tripId}/members/{memberId}`         | owner                | editor/viewer + 버전                                                        | 역할 변경                       |
| DELETE `/trips/{tripId}/members/{memberId}`        | owner 또는 탈퇴 본인 | 여행 버전                                                                   | 멤버 제거/탈퇴                  |

삭제는 성공 응답을 재생하기 위해 200 JSON으로 통일한다. 파일/공개 공유/OCR endpoint는 P1/P2의 별도 계약이며 현행 목업 응답을 MVP 데이터로 연결하지 않는다.

## 3. 주요 읽기 응답

### 내 여행

filter는 all/planned/in_progress/completed/archived, 기본 all(보관 제외). limit 기본 20·최대 100 권장. 정렬/커서는 동일한 filter·정렬 기준으로 사용하며 서버가 불투명 nextCursor를 반환한다. 데이터 변동 후 새로고침은 첫 페이지부터 갱신한다.

각 요약은 id/title/country/city/startDate/endDate/timezone/displayStatus/myRole/coverColor/version을 포함한다. 현재 actor에게 접근 가능한 여행만 반환하고 소유자만 필터링하지 않는다.

### 상세 snapshot

`data`는 다음 필드를 포함한다. 단일 일관된 읽기로 version과 하위 데이터를 맞춘다.

| 필드       | 내용                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| trip       | id/ownerId/title/목적지/기간/timezone/defaultCurrency/status/displayStatus/version      |
| myRole     | owner/editor/viewer                                                                     |
| days       | id/dayNumber/tripDate                                                                   |
| itinerary  | id/dayId/type/title/place?/timeSlot/sortOrder/memo/estimatedByCurrency/actualByCurrency |
| expenses   | id/title/amount/currency/category/isActual/dayId?/scheduleId?/source/paidBy?            |
| checklists | id/title/isCompleted                                                                    |
| members    | memberId/userId/nickname/role/isMe. 연락처/기기/Auth 정보 제외                          |
| totals     | 통화별 estimated/actual/difference와 DAY/공통 합계, 모두 decimal string                 |

MVP는 권장 한도 내 snapshot을 기준으로 시작하고 대형 여행에 대한 페이지 분리는 후속 계약으로 정한다. 권한·표시 데이터 때문에 프로필 전체를 중첩해 반환하지 않는다.

## 4. 여행 생성과 기간 변경

```json
{
  "country": "일본",
  "city": "와카야마",
  "startDate": "2026-11-10",
  "endDate": "2026-11-15",
  "timezone": "Asia/Tokyo",
  "defaultCurrency": "JPY"
}
```

서버는 생략 title을 `2026 와카야마 여행`으로 생성한다. 여행/owner/DAY1~6와 중복키 결과를 동시에 저장한다. 반환 data는 trip·days·myRole·tripVersion을 포함한다.

period-preview는 유지/추가/제외 날짜, 제외 일정/비용 수, blockers, baseVersion을 반환한다. 200 preview의 canApply=false는 저장 실패가 아니라 영향 안내다. 실제 PATCH는 같은 버전에서 다시 검사하며 preview 결과를 신뢰해 검사를 생략하지 않는다.

기간 축소 제외 DAY에 데이터가 있으면 409 PERIOD_HAS_DATA와 해당 DAY ID/개수를 반환한다. 다른 일정이 추가되면 409 VERSION_CONFLICT. 성공은 같은 날짜 ID 유지와 새 DAY 번호를 반환한다.

## 5. 일정·장소·예상비용 계약

```json
{
  "type": "PLACE",
  "title": "토레토레 시장",
  "timeSlot": "12:00",
  "memo": "점심 식사",
  "place": {
    "mode": "provider",
    "provider": "선정 공급자",
    "externalPlaceId": "공급자 식별값"
  },
  "estimatedExpense": {
    "amount": "2000",
    "currency": "JPY",
    "category": "food"
  }
}
```

place 입력은 아래 중 하나다. client가 provider 좌표를 자유롭게 제출해 신뢰시키지 않도록 ID를 서버에서 검증/확정한다.

| mode     | 입력                                         | 검사                                                     |
| -------- | -------------------------------------------- | -------------------------------------------------------- |
| provider | provider/externalPlaceId                     | 선정 공급자·실제 장소 상세 확인, 허용 필드만 저장        |
| manual   | name/address?/latitude?/longitude?/category? | 이름·좌표 쌍/범위, scopeTripId는 서버 설정               |
| existing | placeId                                      | 같은 여행 manual 또는 접근 가능한 provider 장소          |
| null     | 장소 없음                                    | MEMO/TRANSPORT 등 허용, PLACE는 이름 기반 직접 등록 사용 |

type/title/DAY는 필수다. timeSlot 생략/null은 시간 미정. 비용 생략은 없음. PATCH estimatedExpense=null은 해당 schedule 예상 행 삭제, 누락은 유지다. 일정 폼 수정은 비용을 추가 생성하지 않는다.

일정 폼의 예상 0원은 “비용 없음”으로 처리한다. embedded estimatedExpense.amount가 0이면 생성에서는 행을 만들지 않고 수정에서는 기존 schedule 예상 행을 삭제한다. 직접 `/expenses`에 0원을 보내는 요청은 양수 비용 제약으로 거부한다. 0원 행을 원본에 저장하거나 실제 지출로 간주하지 않는다.

순서 PUT itemIds는 DAY 전체 일정 ID의 정확한 순열이어야 한다. 중복/타 여행 ID는 422, 현재 ID 집합과 달라지면 409 ORDER_SET_CHANGED. 서버는 sortOrder=1~N으로 일괄 저장한다.

이동의 targetDayId는 같은 여행, 해당 일정 ID 유지. 비용 DAY도 함께 이동. 삭제는 삭제한 일정 ID·제거 예상비용 ID·연결 해제 실제비용 ID·새 버전을 반환한다.

## 6. 비용·체크 계약

비용 생성 입력은 title/amount/currency/category/isActual, 선택 dayId/scheduleId/paidByUserId다. source는 서버가 manual로 설정하고 client가 receipt/schedule로 위조하지 못하게 한다. 일정 연결이면 DAY를 그 일정에 맞춰 설정하고 불일치 dayId는 거부한다.

schedule source 예상비용은 일정 폼 API에서만 생성한다. 비용 화면에서 같은 행을 편집할 경우 해당 원본 행을 유지해 일정 표시도 갱신한다. 예상→실제는 원래 값을 복사해 POST expenses를 새 키로 요청하며 isActual=true·source=manual이다.

체크 PATCH는 `{ "isCompleted": true }`처럼 원하는 상태를 보낸다. 토글만 수행하는 endpoint는 제공하지 않는다. title·완료 동시 변경은 한 번의 버전 검사로 저장한다.

## 7. 초대·멤버 계약

발급은 `{ "role": "editor" }`, 만료는 서버의 승인 정책으로 설정한다. 원문 token은 고강도 난수이며 서버 DB에는 해시만 저장한다. 최초 201은 inviteId/inviteUrl/role/expiresAt/tripVersion, 중복 재생은 inviteId/상태/linkUnavailable=true만 반환한다. 잃어버린 링크를 새 토큰으로 조용히 교체하지 않는다.

초대 preview는 제목/목적지/기간/예정 역할/만료만 반환한다. 수락 전 일정·비용·개인정보 없음. 경로 토큰은 서버/프록시 로그·오류 수집·분석 이벤트에서 마스킹한다.

수락은 역할을 입력받지 않는다. 서버 토큰 행 잠금·멤버 유일성 검사·여행 상태·만료/철회 검사 후 insert+소비를 원자 처리한다. 기존 멤버이면 existingMember=true·기존 role 반환, 초대를 소비하지 않는다. 단, 존재하지 않거나 철회/만료된 토큰은 먼저 거부한다.

owner 역할 변경은 target owner에 적용 불가. 탈퇴 본인은 editor/viewer만 가능. 제거/탈퇴 성공 후 조회 캐시 제거, 초대의 재수락 정책은 기존 consumed 상태를 유지해 새 초대가 필요하다.

## 8. 에러와 재시도

| HTTP/code                         | 의미                                | 화면 행동                        |
| --------------------------------- | ----------------------------------- | -------------------------------- |
| 401 AUTH_REQUIRED/SESSION_EXPIRED | 인증 없음·만료                      | 재인증 후 원래 행동 복귀         |
| 403 ROLE_FORBIDDEN                | 접근은 가능하나 해당 쓰기 역할 없음 | 편집 중지·권한 안내              |
| 404 RESOURCE_NOT_FOUND            | 없음 또는 비참여 리소스             | 목록 이동, 존재 여부 노출 최소화 |
| 410 INVITE_UNAVAILABLE            | 만료/철회/다른 사용자 소비          | 새 링크 요청 안내                |
| 409 VERSION_CONFLICT              | 여행 버전 불일치                    | 최신 조회·입력 비교·다시 적용    |
| 409 PERIOD_HAS_DATA               | 제외 DAY에 데이터                   | 이동/연결 해제 안내              |
| 409 ORDER_SET_CHANGED             | 현재 일정 ID 목록 변경              | 최신 순서 조회                   |
| 409 REQUEST_KEY_REUSED            | 같은 키·다른 입력                   | client 버그/다른 작업 키 재생성  |
| 409 TRIP_ARCHIVED                 | 보관 상태 쓰기                      | owner 보관 해제 안내             |
| 422 VALIDATION_FAILED             | 입력/금액/부모/좌표 오류            | fieldErrors 표시, 입력 유지      |
| 428 VERSION_REQUIRED              | 버전 헤더 누락                      | 최신 조회 후 다시 시작           |
| 429 RATE_LIMITED                  | 호출 제한                           | Retry-After에 따른 재시도 안내   |
| 503 PROVIDER_UNAVAILABLE          | 검색/지도 연동 실패                 | 직접 등록/주소 목록 제공         |
| 500 INTERNAL_ERROR                | 예기치 않은 실패                    | 입력 유지·requestId로 원인 추적  |

조회는 네트워크/일시 오류에 제한된 재시도가 가능하다. 쓰기는 동일 중복키로만 재시도하고 확정 성공/실패를 모르는 상태에서 새 키로 자동 생성하지 않는다. 401/403/404/410/422를 반복 재시도하지 않는다. 사용자가 변경한 입력은 새 작업 키를 사용한다.

## 9. 구현·검증 연결

데이터 변환은 현행 도메인의 number 비용을 그대로 사용하지 말고 decimal string 및 집계 투영 계약에 맞춰 함께 변경한다. 변경 시 DB 사전·공통 validation·api-client·화면 매핑을 같은 작업으로 갱신한다.

계약 인수는 정상 호출뿐 아니라 다른 계정 리소스 요청, 위조 role/userId, 교차 여행 FK, 응답 유실 재시도, 같은 키/다른 입력, 기간/순서 충돌을 [QA 문서](QA_ACCEPTANCE.md) 기준으로 검증한다.
