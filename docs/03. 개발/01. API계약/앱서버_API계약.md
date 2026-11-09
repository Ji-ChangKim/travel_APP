# 앱·서버 API 계약

모바일·웹 앱과 API 사이의 실제 경로·응답·저장 규칙이다. `/api/v1`은 공통 업무 API 접두어이며 인증·시작·파일·공개 조회는 아래 경로를 사용한다.

## 전송과 제한 시간

- 일반 요청은 15초, `POST /api/v1/trips/:tripId/receipts/ocr`은 75초를 적용한다.
- 회원 요청은 검증된 앱 세션을 전송한다. 앱이 보낸 사용자 ID만으로 권한을 부여하지 않는다.
- 여행 생성·명령은 `Idempotency-Key`로 같은 요청의 중복 반영을 막는다. 변경 명령은 `If-Match: "trip:<tripId>:<version>"`으로 최신 버전을 확인한다.
- 게스트 여행은 현재 기기에만 저장한다. 게스트 서버 저장·재조회는 별도 미구현 과제다. 앱의 기기 저장 성공을 서버 저장으로 표시하지 않는다.

## 주요 경로

| 기능           | 실제 메서드·경로                                                                | 역할                                                             |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 시작           | `GET /public/startup`                                                           | 앱 버전·공통 자료·시작 정책                                      |
| 인증           | `/api/auth/*`, `/api/social/*`                                                  | 실제 인증·세션 조회·소셜 준비와 일회용 교환                      |
| 기본 프로필    | `GET /api/v1/profile`                                                           | 추가 입력 없이 기본 프로필 확인. 생일·성별 등 없어도 앱에서 복원 |
| 계정           | `GET /api/v1/account`                                                           | 본인 계정 종류·비공개 이메일·계정 시각                           |
| 삭제 사전 확인 | `GET /api/v1/account/deletion-preview`                                          | 삭제할 개인 여행·나갈 공유 여행·이전할 소유 여행 구분            |
| 소유권 이전    | `POST /api/v1/account/owned-trips/:tripId/transfer`                             | 현재 참여자를 사용자가 직접 선택한 뒤 이전                       |
| 계정 삭제      | `DELETE /api/v1/account`                                                        | 명시 확인·현재 정책·최근 인증으로 삭제 접수                      |
| 초안           | `GET /api/v1/plan-drafts`, `PUT /api/v1/plan-drafts/:id`                        | 계정별 작성 중 계획 저장·조회                                    |
| 여행           | `GET /api/v1/trips`, `POST /api/v1/trips`                                       | 내 여행 목록·여행 생성                                           |
| 워크스페이스   | `GET /api/v1/trips/:tripId/workspace`, `POST /api/v1/trips/:tripId/commands`    | 권한이 있는 여행의 조회·명령                                     |
| 파일·영수증    | `POST /files/:tripId/:mediaId`, `POST /api/v1/trips/:tripId/receipts/ocr`       | 비공개 이미지 업로드·영수증 정보 추출. 미디어 등록은 별도 명령   |
| 장소·항공·경로 | `/api/v1/places/*`, `/api/v1/flights/*`, `/api/v1/planning/*`                   | 인증된 공급자 조회·경로 요청                                     |
| 커뮤니티       | `GET /public/community`, `GET /public/community/:postId`, `/api/v1/community/*` | 공개 열람·회원별 목록·가져오기·신고·차단. 공개·철회는 여행 명령  |

## 기본 프로필과 계정 관리 응답

`GET /profile`의 기본 프로필은 `id`, `nickname`, 이미지 참조, 실제 `authProvider`, 연결·생성·수정 시각, `onboardingCompleted`, `osPlatform`을 반환한다. 생일·성별·소개를 필수로 요구하지 않는다. 앱은 기본 프로필을 확인한 뒤 원래 목적지로 복귀하고 입력 화면을 관문으로 사용하지 않는다. 2026-11-09 후속 지시에 따라 아래의 MY 닉네임·사진 변경만 허용한다. 과거 `/profile/complete`·파일 ID를 붙인 사진 경로 등은 계속 410이다.

`GET /account`는 `accountType: google_member | legacy_guest | legacy_member`를 반환한다. 이메일은 본인 Google 계정 안내 범위에서만 표시한다. 모든 비게스트를 Google 계정이라고 추정하지 않는다.

삭제 사전 확인은 `policyVersion`, `ownedTripsToDelete[]`, `sharedTripsToLeave[]`, `ownershipTransfersRequired[]`를 반환한다. 배열의 값은 여행 UUID다. 이전 후보는 해당 여행의 실제 워크스페이스에서 조회한 참여자다. 이 결과를 읽지 못하면 삭제 버튼을 활성화하지 않는다.

소유권 이전은 `{ newOwnerId, version }`을 보내고 `{ tripId, newOwnerId, version: 이전값+1 }`을 받는다. 확인한 상대와 최신 버전을 검증하고 이후 사전 확인·소유권을 다시 조회한다.

계정 삭제는 `{ confirm: true, policyVersion: "account-delete-v1" }`을 보낸다. 서버는 최근 10분 내 인증과 공유 소유권 이전을 검사한다. HTTP 202 `{ jobId, state: "pending", policyVersion }`는 접수이며 실제 삭제 완료가 아니다. 신규 요청에는 90일 복구 유예가 없다. 접수된 요청의 세션만 정리하고 새 계정으로 전환한 뒤 늦게 온 응답은 무시한다. 옛 `POST /account/retirement`는 410이다.

## MY 닉네임·사진 계약

Google 연결이 유효하고 탈퇴·삭제 중이 아닌 본인 회원만 변경한다. 게스트·Google 미연결 계정은 403 `ROLE_FORBIDDEN`이다. 앱이 보낸 회원 ID로 저장 대상을 선택하지 않는다. 시작·가입에는 추가 프로필 입력이 없다.

| 메서드·경로                                              | 입력·응답                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/profile`                                    | 기존 응답 + `nicknameConfigured: boolean`, `nicknameChangeAllowed: boolean`, `nicknameNextChangeAt: ISO datetime 또는 null`, `canEditProfile: boolean`. 미설정 이름은 ‘여행자’, 이미지는 기본 이미지 |
| `GET /api/v1/profile/nickname-availability?nickname=...` | 검증된 `{nickname, available: boolean}`. 본인이 가진 같은 비교 키는 사용 가능. 다른 회원 ID는 반환하지 않음                                                                                          |
| `PATCH /api/v1/profile`                                  | 엄격한 `{nickname: string}`만 허용. 성공 시 최신 프로필. 소개·생일 등 다른 필드는 422                                                                                                                |
| `PUT /api/v1/profile/photo`                              | `Content-Type: image/png`, 실제 PNG 바이트, 최대 10MiB. 성공 시 최신 프로필                                                                                                                          |
| `GET /api/v1/profile/photo`                              | 본인의 현재 PNG만 반환. 없으면 404, 캐시 `no-store`, `ETag`, `nosniff`. 임의 회원 ID 조회 없음                                                                                                       |

닉네임은 NFC 정규화 후 1~10자이며 ASCII 영어·숫자·한글·히라가나·가타카나·일본어 장음 `ー`와 내부 ASCII 공백만 허용한다. 앞뒤 공백·공백만·탭·줄바꿈·한자·이모지·특수문자는 거부한다. 공백은 문자 사이에 총 2개까지이며 길이에 포함한다. 입력을 조용히 잘라 저장하지 않는다.

중복 키는 NFC + 소문자 변환이다. 내부 공백 수는 보존하며 `A가나다`와 `a가나다`는 같은 이름이다. 미설정 기본 표시 이름은 예약하지 않는다. 실제 저장은 D1 고유 제약으로 동시 중복을 막는다. `NICKNAME_TAKEN`은 409다. 사전 중복 확인은 예약이 아니다.

최초 선택 또는 마지막 변경 후 2,592,000,000ms(30일)가 지나야 변경한다. `changed_at`은 서버 UTC 밀리초이며 달력 월을 사용하지 않는다. 아직 이르면 409 `NICKNAME_CHANGE_NOT_READY`다. 정확히 같은 닉네임 요청은 시각을 바꾸지 않는 성공이다. 중복 실패·유효성 실패는 기회를 차감하지 않는다. 닉네임 예약·user.name·기존 공개 게시물 작성자·여행 참여자 이름은 한 D1 배치로 확정한다.

사진은 앱에서 긴 변 최대 1,024px PNG로 변환한다. 서버가 형식·용량·불필요 메타데이터를 검사·정리한다. `MEDIA`의 `tripprint-staging-private` 버킷에 `User/profile/pfImg_{userId}.png`를 덮어쓴다. 사진은 횟수·30일 제한이 없으며 회원당 현재 키 하나만 둔다. `avatarUrl`은 인증된 본인 사진 API + ETag 버전이며 `photoFileRef`는 회원 UUID다. 새 사진은 과거 `profile_photos`·랜덤 파일 ID 경로를 사용하지 않는다.

통신 실패·응답 유실은 성공으로 처리하지 않고 프로필을 재조회한다. 세션 전환 뒤 늦은 응답을 새 회원에 적용하지 않는다. 로컬 DB·R2 검수와 원격 저장을 구분한다. 배포 전 `0016_member_profile_names.sql` → API → 앱 순서로 반영하며 원격 적용은 아직 수행하지 않았다.

### 공통 오류 처리

응답은 공통 오류 코드와 HTTP 상태를 함께 확인한다. 401은 인증 확인, 403 `REAUTHENTICATION_REQUIRED`는 재로그인, 409 `OWNERSHIP_TRANSFER_REQUIRED`·`VERSION_CONFLICT`는 최신 자료 재조회로 연결한다. 통신 오류는 삭제·저장 성공으로 처리하지 않는다. 개인 기록·키·토큰·서버 내부 오류 원문을 화면이나 검수 로그에 표시하지 않는다.

자동 검사에서 외부 공급자 응답을 대체했다면 실제 Google 로그인·장소 검색·영수증 인식 통과로 보고하지 않는다. 서버 응답 성공, 앱 표시, 재진입·재조회 결과를 구분해 기록한다.
