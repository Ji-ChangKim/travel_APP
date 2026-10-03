# 현재 앱 서버 계약

2026-10-03 구현 기준. 제안 API와 구분하며 `apps/api/src/workspace.ts`, 공통 Zod 스키마, SQL을 실제 계약으로 사용한다. [환경 준비](../APP_SERVICES_SETUP.md), [DB 사전](../DB_DICTIONARY.txt)을 함께 확인한다.

보호 경로는 `/api/v1`, Supabase `getUser`로 확인한 비익명 JWT를 사용한다. Worker의 공개 키와 현재 사용자 JWT로만 RPC를 호출한다. 응답은 `{data,meta:{requestId,replayed?}}`, 실패는 공개 오류 envelope다. 본문 상한 16KiB, no-store, 실제 웹 origin CORS.

| 경로                                           | 동작                                                      |
| ---------------------------------------------- | --------------------------------------------------------- |
| `POST /api/v1/trips`                           | 여행·소유자·1~90 DAY 원자 생성                            |
| `GET /api/v1/trips`                            | 본인 참여 여행 목록                                       |
| `GET /api/v1/trips/:tripId/workspace`          | 멤버 전용 일정/비용/준비물/멤버/미디어/영수증 확장 스냅샷 |
| `POST /api/v1/trips/:tripId/commands`          | 아래 strict 원자 명령                                     |
| `POST /api/v1/invites/accept`                  | `{token:64hex}` 초대 수락, JWT 계정 사용                  |
| `POST /api/v1/trips/:tripId/receipts/ocr`      | `{mediaId:UUID}` 비공개 영수증 OCR **확인 후보**          |
| `GET /api/v1/trips/:tripId/media/:mediaId/url` | 등록 원본의 60초 서명 URL                                 |
| `GET /public/community?offset=0`               | 익명 공개 스냅샷 피드                                     |
| `GET /api/v1/community?offset=0`               | 본인 차단 필터 피드                                       |
| `POST /api/v1/community/reports`               | `{postId,reason}` 본인 신고                               |
| `POST /api/v1/community/blocks`                | `{userId}` 본인 작성자 차단                               |

기존 `/me`, `/trips/:id`, checklist 추가/완료 API를 유지한다. 기존 `/api/share/link`, `/api/receipt/ocr`, 장소 검색 임시 경로는 미구현 503을 유지하며 새 앱에서는 사용하지 않는다.

쓰기 명령은 `Idempotency-Key:UUID`와 `If-Match:"trip:<UUID>:<version>"`를 요구한다. 생성/초대 수락은 요청 키만 요구한다. 성공 응답 유실 시 **같은 키·같은 본문·같은 버전**으로 재시도한다. 409 충돌에서는 최신 스냅샷을 읽고 보존한 입력을 사용자가 확인한 뒤 새 요청을 작성한다. 자동 덮어쓰기는 하지 않는다.

## 명령 입력

형식은 `{operation,input}`이며 알 수 없는 필드는 거부한다. HTTP를 우회한 직접 RPC도 역할·부모·정밀도 제약을 검사한다.

| operation            | input                                                                         | 권한              |
| -------------------- | ----------------------------------------------------------------------------- | ----------------- |
| `schedule.save`      | id,dayId,title,type,timeSlot,sortOrder,memo,address                           | owner/editor      |
| `schedule.delete`    | id                                                                            | owner/editor      |
| `expense.save`       | id,title,amount,currency,category,isActual,dayId?,scheduleId?                 | owner/editor      |
| `expense.delete`     | id (manual 지출만)                                                            | owner/editor      |
| `trip.update`        | title,country,city,status                                                     | owner             |
| `trip.period`        | startDate,endDate                                                             | owner             |
| `media.register`     | id,path,purpose,mimeType,scheduleId?                                          | owner/editor      |
| `media.delete`       | id                                                                            | owner/editor      |
| `receipt.confirm`    | id,dayId,mediaId,merchant,transactionDate,amount,currency,details,scheduleId? | owner/editor      |
| `receipt.delete`     | id                                                                            | owner/editor      |
| `invite.create`      | role:editor/viewer                                                            | owner             |
| `invite.revoke`      | id                                                                            | owner             |
| `member.role`        | userId,role:editor/viewer                                                     | owner             |
| `member.remove`      | userId                                                                        | owner             |
| `community.publish`  | title,body,scheduleIds[],photoIds[],includeCosts:boolean                      | owner + COMPLETED |
| `community.withdraw` | {}                                                                            | owner             |

- 일정 type은 PLACE/TRANSPORT/STAY/RESERVATION/TODO/MEMO, 시간은 빈 값 또는 HH:mm, 메모 300자·주소 200자다.
- 비용 category는 food/transport/stay/activity/shopping/etc, 금액은 문자열이다. KRW/JPY 정수, USD 소수 두 자리까지, 양수·정수부 최대 10자리.
- 일정에 연결한 지출 DAY는 일정 DAY와 같아야 한다. 비용이 연결된 일정의 날짜 이동은 거부한다.
- 기간 변경은 DAY 순서·UUID를 유지하고 계획 날짜를 이동한다. 기록이 있는 마지막 DAY 축소 또는 확정 영수증 결제일 제외는 거부한다.
- 파일은 업로드가 존재한 뒤 메타데이터를 등록한다. 원본 경로는 해당 여행 UUID/해당 미디어 UUID.jpg|png다.
- 영수증 확인은 같은 거래에서 필요한 신규 일정·확인 기록·실제 지출을 만든다. 같은 원본 중복 확정을 차단한다. 기존 일정 선택은 그 DAY와 일치해야 한다.
- 공개 게시물은 원본 여행과 별도 스냅샷이다. 일정/사진은 직접 선택하며 영수증 사진은 공개 선택을 거부한다. 금액 합계는 명시적으로 선택할 때만 포함한다.
- 피드는 20개 단위, offset 최대 10,000이다. 신고·차단은 관리자 삭제 기능을 대신하지 않는다.

## 확인 상태

실제 마이그레이션 PostgreSQL 적용과 HTTP 경계, 제한된 Vision 요청/응답, 앱 폼·재시도·파일 선택을 로컬 검증한다. 원격 Supabase/PostgREST/Storage, 실제 OAuth, 실물 영수증 정확도, 공유 시트/기기 복귀는 테스트 콘솔 준비 후 실제 인수가 필요하다.
