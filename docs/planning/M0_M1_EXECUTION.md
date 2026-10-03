# M0·M1 구현 및 검증 기록

- 작성일: 2026-10-02 / 목표일: M0 10/08, M1 10/16
- 범위: 기획·정책·개발 환경 기준, DB·API·권한·원자 저장 기반
- 상태: **로컬 기반 구현 완료, 외부 환경 연결 및 제품 결정 일부 대기**. 두 마일스톤 전체를 인수 완료로 표시하지 않는다.
- 기준: [일자별 일정](DAILY_MILESTONES.md), [정책](POLICY_DECISIONS.md), [환경 실행 절차](../DEVELOPMENT_SETUP.md)

## 1. M0 실행 기준

| 항목            | 결정·산출물                                                                  | 상태                                |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| MVP 범위        | MVP-01~10 유지. 실제 인증→여행/DAY→일정→지도→비용/준비물→초대/권한 순서      | 개발 기준 반영                      |
| 원본 저장       | Supabase PostgreSQL 원본. Worker는 실제 JWT 검증 후 사용자 권한 RPC 호출     | 구현                                |
| 쓰기 방식       | 일반 사용자 직접 테이블 쓰기 금지. RPC 권한·버전·중복 요청 검증과 저장       | 구현                                |
| 기간·제목       | 실제 날짜, 1~90일. 제목 미입력 시 `YYYY 도시 여행`, 국가/도시 공백 제거      | 구현                                |
| 통화·비용       | KRW/JPY/USD, 양수 decimal, KRW/JPY 정수·USD 소수 두 자리. JSON 금액 문자열   | 제약·조회 기반 구현, CRUD/집계 후속 |
| 역할·정보       | owner/editor 쓰기, viewer 조회. 익명 Auth/비참여 명령 거부. 동행 최소 프로필 | 구현                                |
| 재시도·협업     | UUID 키, 동일 사용자·작업·본문 재생, 24시간 유효. 여행 aggregate version     | 구현                                |
| 게스트·오프라인 | 서버 여행 쓰기·오프라인 저장 큐 미지원. 입력 보존/재인증 UI M2               | 서버 차단, UI 후속                  |
| 런타임          | Node 22.17.0/npm 11.5.2, workspaces, Wrangler staging/production 분리        | 로컬 검증                           |
| 테스트          | 격리 PostgreSQL의 실제 SQL 체인, Auth HTTP 경계 fixture                      | 구현                                |
| 플랫폼·공급자   | 앱/초대 웹 지원 조합, OAuth 제공자, 지도 제공자·키·저장 조건                 | 제품/외부 결정 대기                 |
| 실제 환경       | Supabase 테스트 프로젝트·OAuth 콜백·배포 권한·Origin·실기기                  | 접근 정보 대기                      |

사용자의 M0/M1 진행 지시에 따라 구현 가능한 권장안을 개발 기본값으로 채택했다. 별도 제품 오너 승인자·승인일을 만들어 기록하지 않는다. 제공자 선정·계정 삭제/백업 보존·플랫폼 지원은 이번 코드 변경으로 확정되지 않는다.

## 2. M1 산출물

| 범위      | 실제 파일·동작                                                                                                   | 완료 수준                         |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 스키마    | `20261002000001_foundation_schema.sql`: 버전·시간대·통화·일정/작성자·부모 제약·초대/요청 테이블·Auth 트리거 수정 | 로컬 SQL 적용                     |
| 명령·조회 | `20261002000002_foundation_commands.sql`: 사용자 RPC 6개, 여행+owner+DAY 원자 생성, 준비물 명령, snapshot        | 로컬 실행                         |
| Auth      | Auth `getUser(token)` 서버 조회, 익명 거부, 요청별 JWT RPC, 공개 키만 허용                                       | HTTP fixture 검증, 실제 계정 대기 |
| 권한      | RLS 멤버 조회·본인 프로필, 직접 쓰기·내부 함수 실행 금지, RPC 보관/권한 재검사                                   | 실제 SQL 테스트                   |
| 재시도    | 사용자+키 유일성·행 잠금·본문 SHA-256, 확정 결과 같은 트랜잭션, 실패 시 키 행 롤백                               | 순차 재시도·실패 테스트           |
| 충돌      | `If-Match: "trip:<uuid>:<version>"`, 성공 버전 증가, 충돌 409/누락 428                                           | DB·API 검증                       |
| API       | 오류·추적 ID, 허용 Origin CORS, 16KiB 입력 제한, no-store, 외부 호출 10초 제한                                   | HTTP 검증                         |
| 공통 모듈 | 실제 서버/토큰을 명시하는 api-client, 계정 포함 query key, 생성/조회/준비물 호출, domain/Zod                     | 타입 검사, 화면 M2                |
| 환경·CI   | 설정 예제, 바인딩 타입 생성, staging 번들 dry-run, CI 테스트/빌드                                                | 로컬 검증, 원격 CI 대기           |

모바일 화면은 메모리 스토어·임의 로그인 경로를 계속 사용한다. 실제 API 연결은 M2다. 새 권한 적용 시 기존 프로필 직접 upsert는 거부되므로 전환 전 테스트 전용 DB에만 적용한다.

## 3. 구현 API

| 경로                                    | RPC                                                    | 결과·조건                                              |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| `GET /health`                           | 없음                                                   | liveness만 확인, DB/OAuth 준비와 별개                  |
| `GET /api/v1/me`                        | `wherego_me()`                                         | 본인 id/nickname/bio/version                           |
| `GET /api/v1/trips`                     | `wherego_list_trips()`                                 | 멤버 여행 배열. 필터/페이지/displayStatus M2           |
| `POST /api/v1/trips`                    | `wherego_create_trip(jsonb,uuid)`                      | 여행·owner·DAY. 키 필수, 최초 201/재생 200             |
| `GET /api/v1/trips/:tripId`             | `wherego_trip_snapshot(uuid)`                          | trip/myRole/days/itinerary/expenses/checklists/members |
| `POST /api/v1/trips/:tripId/checklists` | `wherego_add_checklist(uuid,text,bigint,uuid)`         | title 추가, 버전·키 필수                               |
| `PATCH /api/v1/checklists/:itemId`      | `wherego_set_checklist(uuid,uuid,boolean,bigint,uuid)` | 명시 완료 상태. 헤더 여행과 DB 부모 대조               |

성공 `{data,meta:{requestId,replayed?}}`, 실패 `{error:{code,message,fieldErrors?},meta:{requestId}}`. 변경 결과 `tripVersion`을 다음 쓰기 버전으로 사용하고 snapshot은 `trip.version`을 사용한다. 사용자 입력 userId/ownerId로 권한을 판정하지 않는다.

기존 장소 검색·공유·OCR 목업 경로는 실제 연동까지 `503 FEATURE_NOT_READY`다. 일정 CRUD/비용 집계/초대 수락은 이 마일스톤의 완성 기능이 아니다.

## 4. 검증 증거와 한계

| 실행 명령                 | 2026-10-02 결과                                    |
| ------------------------- | -------------------------------------------------- |
| `npm run check`           | 통과: TypeScript 엄격 검사·ESLint 경고 0·Prettier  |
| `npm run test:foundation` | 17개 통과, 실패 0                                  |
| `npm run api:build`       | staging Worker dry-run 번들 생성 성공, 업로드 없음 |
| `npm run build:web`       | Expo 웹 정적 export 성공, 10개 라우트              |

CI에 같은 명령을 연결했으며 실제 원격 CI 실행 결과는 아직 없다.

`npm run test:foundation`: Node test runner+PGlite 실제 PostgreSQL에서 전체 5개 SQL 마이그레이션 실행. Supabase 소유 auth/storage와 Auth HTTP만 fixture다. 제품 SQL을 테스트용 구현으로 대체하지 않는다.

17개 테스트 통과: 가입/프로필, 여행·owner·DAY/중복 재생, 본문 키 충돌, DAY 실패 롤백, viewer/외부/직접 쓰기 거부, 준비물 완료 재생, 버전 충돌 롤백, 익명 거부, 날짜/기간/통화, editor 권한 철회, 다른 여행 부모 참조, 보관/키 만료, HTTP 인증/설정/입력/CORS.

PGlite 인스턴스는 요청을 직렬 처리한다. 잠금과 버전 조건을 구현했지만 **원격 PostgreSQL 독립 연결 동시성·실제 PostgREST·OAuth·재접속·실기기**는 미검증이다. 기획 Q-01~41 전체 통과를 의미하지 않는다.

만료 요청 행은 현재 보존하며 같은 키를 거부한다. 자동 청소는 미구현이다. 행 삭제 후 같은 키를 새 명령으로 인식할 수 있어 임의 TTL 삭제를 연결하지 않았다. 운영 적용 전 보존·키 재사용 정책과 스케줄러를 정한다.

## 5. 목표일까지 남은 실행 카드

| 기한     | 담당 역할·작업                                     | 완료 증거                                 |
| -------- | -------------------------------------------------- | ----------------------------------------- |
| 10/06    | 제품/개발: 플랫폼·OAuth/지도·게스트·외부 접근 확인 | 결정, 테스트 프로젝트, 키 준비 위치, 담당 |
| 10/07    | 개발: 새 테스트 DB 적용·기존 데이터 사전 점검      | schema/RLS/grant 결과, 실패 데이터 처리   |
| 10/08    | 제품/개발: M0 검토, 미준비 영향 확정               | 미결정·담당·기한, 환경 접근 증거          |
| 10/12~13 | 개발: 실제 A(owner)/B(editor)/C(viewer)/D(외부)    | 직접 SELECT/쓰기/RPC 권한 증거            |
| 10/14    | 개발: staging 실제 JWT 호출·snapshot/금액          | HTTP 상태·DB 행·requestId, 토큰 비기록    |
| 10/15    | 개발: 독립 연결 동시 키·같은 버전 경쟁·응답 유실   | 단일 저장·충돌·버전 증가·롤백             |
| 10/16    | 개발/QA: M1 인수·다음 작업 카드                    | 원격 증거+로컬 검사·DB/계약 일치          |

접근 정보 준비 후 외부 검증을 진행한다. 실제 계정/키·원격 적용 결과를 임의 생성하지 않았다. 커밋·푸시·운영 배포는 수행하지 않았다.

## 6. 환경 점검 후속 항목

2026-10-02 `npm audit`: 16개(높음 4, 중간 12), Expo/Router 개발·빌드 의존성 경로. 전이 패키지 보고도 포함하며 독립 취약점 개수와 다르다. 자동 제안에는 Expo 44로 주요 버전 변경이 있어 적용하지 않았다. M0 환경 검토에서 호환 패치와 빌드를 검증해야 한다.
