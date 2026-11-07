# 앱·서버 API 계약

이 문서는 모바일·웹 앱(`apps/mobile`)과 백엔드 API(`apps/api`) 사이의 통신 규격, 제한 시간, 주요 엔드포인트 및 오류 계약을 정의합니다.

---

## 1. 공통 전송 및 타임아웃 정책 (`@wherego/api-client`)

1. **기본 제한 시간**: 일반 API 요청은 **15,000ms (15초)** 제한 시간을 적용합니다.
2. **영수증 OCR 제한 시간**: 영수증 이미지 분석(`POST /api/trips/:tripId/receipts/scan`)은 **75,000ms (75초)** 제한 시간을 적용합니다.
3. **인증 및 멱등성**:
   - 회원 요청은 세션 토큰(Authorization Bearer 또는 쿠키)을 포함합니다.
   - 여행 상태 변경 명령은 고유 `requestKey`와 현재 여행 `version`을 함께 전송하여 네트워크 재시도 시 중복 반영을 막습니다.

---

## 2. 도메인별 주요 엔드포인트

| 구분              | 메서드·경로                                                                                       | 설명                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 시작·버전         | `GET /api/startup`                                                                                | 최소 지원 앱 버전, 업데이트 정책, 서버 상태 조회                                     |
| 인증·프로필       | `POST /api/auth/*`, `GET /api/profile`, `PUT /api/profile`                                        | 소셜 핸드오프 교환, 세션 조회, 프로필·약관 완료 저장, 게스트 여행 가져오기           |
| 홈·초안           | `GET /api/home`, `PUT /api/plan-drafts/:id`                                                       | 홈 컨시어지·추천 데이터 조회 및 여행 생성 서버 초안 저장(계정당 최대 5개)            |
| 여행 워크스페이스 | `GET /api/trips`, `POST /api/trips`, `GET /api/trips/:tripId`, `POST /api/trips/:tripId/commands` | 내 여행 목록, 새 여행 생성, 여행 스냅샷 단건 조회 및 일정·비용·준비물·멤버 명령 실행 |
| 미디어·영수증     | `POST /api/trips/:tripId/media`, `POST /api/trips/:tripId/receipts/scan`                          | 비공개 이미지 업로드(최대 4MB, JPEG/PNG) 및 영수증 OCR 초안(`ReceiptDraft`) 추출     |
| 장소·항공·경로    | `GET /api/places/*`, `GET /api/flights/*`, `POST /api/planning/*`                                 | 장소 검색·상세·사진 프록시, 국내/국제선 항공편 조회, 추천 코스·경로 계산             |
| 발자국(커뮤니티)  | `GET /public/community`, `GET /public/community/:postId`, `POST /api/community/*`                 | 공개 여행 목록·상세 조회, 내 여행 공개/철회, 공개 일정 담기, 게시물 신고·차단        |

---

## 3. 공통 오류 처리 규칙

- 모든 오류 응답은 표준 오류 코드(`foundationErrorCode`)와 HTTP 상태 코드(`400`, `401`, `403`, `404`, `409`, `429`, `500`)를 반환합니다.
- 클라이언트 화면(`userFacingError.ts`)은 미확인 서버 예외 원문(SQL·내부 토큰·스택트레이스)을 사용자에게 직접 노출하지 않고, 재시도 또는 복구 행동을 안내하는 한글 메시지로 변환합니다.
- `409 Conflict`(버전 충돌) 발생 시 자동으로 덮어쓰지 않고 최신 스냅샷을 먼저 재조회하도록 안내합니다.
