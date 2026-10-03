# WHEREGO M0·M1 개발 환경 실행 절차

2026-10-03 갱신. 실제 저장 API 실행에는 별도 **Supabase 테스트 프로젝트**가 필요하다. 전체 앱·소셜 인증·사진/OCR 준비는 [서비스 연결 절차](APP_SERVICES_SETUP.md)를 따른다. 개발 단계에는 운영 DB를 사용하지 않는다.

## 1. 설치·검증

저장소 루트에서 `.nvmrc` Node 22.17.0/npm 11.5.2 사용.

```powershell
npm ci
npm run check
npm run test:foundation
npm run api:build
```

순서대로 타입/lint/format, SQL·HTTP 경계 테스트, staging Worker 번들 dry-run을 실행한다. dry-run은 배포하지 않는다. 테스트는 외부 계정 없이 실행되며 Supabase 전체 에뮬레이터가 아니다.

바인딩 변경 시 타입을 생성한다.

```powershell
npm --workspace=@wherego/api run types
```

## 2. 실제 테스트 서비스 준비

1. Supabase 테스트 프로젝트 URL과 anon/publishable 공개 키 준비. Worker에 service_role/secret 키 금지.
2. `supabase/migrations/` SQL을 이름 순서로 적용. 기존 3개+기반 2개+앱 완성 기능 1개, 총 6개 체인. migration 도구 또는 SQL Editor 사용. 이미 적용한 파일을 반복 실행하지 않는다.
3. 기존 데이터는 백업·사전 점검. 90일 초과 여행, 빈 제목/잘못된 일정 순서·시간, 통화/소수 위반, 다른 여행 참조, owner 불일치는 제약 적용을 실패시킬 수 있다. 자동 삭제로 우회하지 않는다.
4. OAuth 제공자/콜백 및 실제 A/B/C/D Auth 계정 준비. 앱의 임의 프로필 ID는 인증으로 사용할 수 없다. 가입 트리거는 실제 `auth.users.raw_app_meta_data`를 사용한다.
5. 실제 access_token으로 API 호출. 서버 `getUser(token)` 인증 후 동일 JWT로 RPC 실행.

현재 원격 연결·SQL 적용 증거는 없다. 새 테스트 프로젝트 전체 체인 확인과 기존 데이터 이행 검증을 구분한다.

## 3. 로컬 설정·실행

```powershell
Copy-Item -LiteralPath apps/api/.dev.vars.example -Destination apps/api/.dev.vars
Copy-Item -LiteralPath .env.example -Destination .env
```

placeholder를 테스트 프로젝트 값으로 교체한다. `.dev.vars`에는 SUPABASE_URL/SUPABASE_ANON_KEY/ALLOWED_ORIGINS, `.env`에는 모바일 EXPO_PUBLIC 공개 값만 설정한다. 실기기 localhost는 기기 자신이므로 API 주소를 접근 가능한 개발 PC 주소 또는 staging URL로 변경한다. 실제 토큰·비밀 키는 문서/로그에 남기지 않는다.

```powershell
npm run api:dev
```

`GET http://localhost:8787/health`는 생존만 확인. 보호 API의 `503 CONFIGURATION_REQUIRED`는 구성 오류, `401`은 인증 오류다. 환경 미준비를 샘플 데이터로 대체하지 않는다.

현재 기본 내 여행/상세/초대/커뮤니티 화면은 새 API에 연결되어 있다. 이전 메모리 화면은 이름을 붙인 프로토타입으로 보존했고 기본 라우트에서는 사용하지 않는다. 발자취는 여전히 별도의 기기 초안이다. `mobile:web` 실행에는 `apps/mobile/.env`도 실행 위치에 맞춰 준비한다. 새 권한은 기존 직접 프로필 upsert를 차단하므로 테스트 DB부터 인수한다.

## 4. 쓰기 규칙

| 항목      | 규칙                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| 인증      | `Authorization: Bearer <실제 access_token>`                                         |
| 요청 키   | `Idempotency-Key: <UUID>`, 행동 1회에 생성. 응답 유실 재시도는 같은 키/본문         |
| 버전      | 기존 여행 쓰기 `If-Match: "trip:<tripId>:<version>"`. 생성은 불필요                 |
| 충돌      | 409 자동 덮어쓰기 금지. 입력 유지 후 snapshot 재조회/비교                           |
| 캐시      | `foundationQueryKey(userId,resource,id?)`, 계정 포함. 로그아웃 캐시/입력 제거 UI M2 |
| 체크      | `{isCompleted:true/false}`, 토글 명령 금지                                          |
| 시간·금액 | 여행 timezone·달력 날짜·decimal 문자열                                              |

생성 body 예:

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

여행+owner+6DAY는 같은 트랜잭션. 실패 시 요청 키도 롤백. 성공 결과 재생 시에도 현재 권한 재검사.

## 5. staging·운영 전 확인

`apps/api/wrangler.jsonc`의 env.staging.vars에 공개 URL/키/실제 Origin 설정. production 별도 설정. 공급자 비밀 키가 추가되면 환경별 Wrangler secret binding 사용. `api:build`는 명시한 staging dry-run이며 실제 배포하지 않는다.

실제 적용·인수 결과는 [M0·M1 실행 기록](planning/M0_M1_EXECUTION.md)에 기록한다. 운영 전 동시성·PostgREST·OAuth 복귀·모바일 저장·요청 보존/청소·계정 삭제/백업·지도·Expo 취약점 호환 패치 확인이 필요하다.

근거: [Workers 권장사항](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/), [Supabase API 보안](https://supabase.com/docs/guides/api/securing-your-api), [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Wrangler 타입](https://developers.cloudflare.com/workers/wrangler/commands/#types), [PGlite](https://pglite.dev/docs/).

## 6. EAS 모바일 빌드

실제 Expo 앱 디렉터리는 `apps/mobile`이다. 루트의 `build:apk`, `build:all`은 모바일 워크스페이스 명령으로 위임하며 EAS는 `apps/mobile/app.config.ts`와 `apps/mobile/eas.json`을 사용한다. CLI는 `npx eas-cli`로 실행하므로 전역 설치가 필요하지 않다.

저장소 루트에서 실행한다.

```powershell
npm run eas:login
npm run build:apk
```

스토어용 Android·iOS 빌드는 `npm run build:all`로 실행한다. Expo 계정 로그인과 플랫폼별 서명 자격 증명이 필요하다.

Expo 대시보드의 GitHub 연동 빌드를 사용하는 경우 프로젝트의 **Base directory**를 `apps/mobile`로 지정하고 수정 사항이 포함된 커밋을 선택한다. npm 스크립트 수정은 대시보드의 Base directory 설정을 변경하지 않는다.

`app.config`를 빌드 서버에서 찾지 못한다는 오류가 발생하면 선택한 커밋, Base directory, 업로드 제외 규칙을 확인한다. 현재 `app.config.ts`와 `apps/mobile/app.config.ts`는 Git 추적 대상이며 `.gitignore`에서 제외되지 않는다. `.easignore`를 추가할 경우 기존 비밀 파일 제외 규칙을 유지한다.

빌드를 제출하지 않고 업로드 파일을 검사하려면 `apps/mobile`에서 실행한다. 출력 디렉터리는 저장소 밖의 새 경로를 사용한다.

```powershell
npx --yes eas-cli build:inspect -p android -s archive -e production -o "$env:TEMP/wherego-eas-archive"
```

검증 범위: 로컬 코드 검사와 업로드 아카이브 검사는 원격 Android·iOS 빌드 성공을 보장하지 않는다.

근거: [Expo 모노레포 빌드](https://docs.expo.dev/build-reference/build-with-monorepos/), [EAS 업로드 제외 규칙](https://docs.expo.dev/build-reference/easignore/).
