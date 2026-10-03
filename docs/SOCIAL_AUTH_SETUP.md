# 카카오·구글·애플 실제 로그인 설정

작성일: 2026-10-03. 소셜 인증 코드는 연결했으며 실제 공급자 콘솔·테스트 계정·실기기 검증이 필요하다.

사용자 확인: Supabase 테스트 프로젝트와 세 공급자 콘솔은 아직 준비되지 않았다. 다음 준비 순서대로 진행한다. 이 문서는 운영 계정을 생성하거나 실제 인증을 검증한 기록이 아니다.

## 앱 공개 설정

`apps/mobile/.env.local`에 `.env.example`의 공개 변수를 설정한다. 이 파일은 Git에 추가하지 않는다. 관리자 키와 OAuth Client Secret은 앱에 넣지 않고 Supabase 콘솔에만 등록한다.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_API_KEY
EXPO_PUBLIC_API_URL=http://localhost:8787
EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL=http://localhost:8081/auth/callback
```

웹 배포는 HTTPS 실주소를 사용하고 하위 경로 배포 시 그 기본 경로도 포함한다. 예: `https://example.com/travel/auth/callback`. 웹 기본 주소와 Supabase Redirect URLs가 정확히 일치해야 한다. 키·토큰을 채팅이나 로그에 붙여 넣지 않는다.

## Supabase Auth와 공급자 콘솔

처음 준비하는 경우 [Supabase 대시보드](https://supabase.com/dashboard)에서 개발용 프로젝트를 먼저 만든다. Project URL과 publishable/anon 공개 키는 앱 환경 파일에, DB 비밀번호는 별도 안전한 위치에 보관한다. 앱 안에 DB 비밀번호나 service_role 키를 넣지 않는다. 이후 Authentication의 Providers에서 아래 세 공급자를 순서대로 설정한다.

1. 별도 Supabase 테스트 프로젝트를 사용한다. 신규 가입 허용·공급자 활성화·기존 SQL 프로필 트리거를 확인한다. DB 적용은 [개발 환경 절차](DEVELOPMENT_SETUP.md)를 따른다.
2. Supabase Authentication의 Redirect URLs에 `travelapp://auth/callback`, 개발 웹 복귀 주소, 실제 HTTPS 웹 복귀 주소를 등록한다.
3. 카카오 개발자 콘솔에서 앱/카카오 로그인을 설정하고 Supabase Kakao 공급자 화면에서 요구하는 Client ID·Secret을 등록한다.
4. Google Cloud OAuth 콘솔에서 테스트 사용자/동의 화면과 클라이언트를 설정하고 Supabase Google 공급자에 등록한다.
5. Apple Developer에서 Sign in with Apple과 웹 OAuth용 Services ID·키·리턴 URL을 설정하고 Supabase Apple 공급자에 등록한다. 실제 운영 키의 갱신 담당과 기한을 별도로 기록한다.
6. **공급자 콘솔의 OAuth Redirect URI는 Supabase 공급자 화면에 표시한 `/auth/v1/callback` 주소**다. 앱의 `travelapp://auth/callback`은 Supabase가 인증을 완료한 뒤 돌아오는 별도 주소다.
7. 공급자 설정값이 없는 경우 인증 성공으로 표시하지 않는다. 카카오·구글·애플 각각 신규/기존 테스트 계정을 검증한다.

설정 상세 원본: [Supabase Kakao](https://supabase.com/docs/guides/auth/social-login/auth-kakao), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple), [모바일 Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/).

## 실행과 실제 인수

모바일은 `travelapp` scheme이 포함된 Development Build 또는 설치 앱에서 검증한다. Expo Go만으로 실제 운영 앱의 콜백을 인수하지 않는다. 네이티브 패키지 추가 후 앱 바이너리를 다시 빌드해야 한다.

```powershell
npm run check
npm run test:auth
npm run test:foundation
npm run build:web
npm run mobile
```

| 검증                                 | 기대 결과                                                    |
| ------------------------------------ | ------------------------------------------------------------ |
| 공급자별 최초 로그인                 | 실제 Auth UUID로 가입·프로필 생성, 비밀 키는 앱에 없음       |
| 기존 사용자 로그인                   | 같은 Auth UUID 유지, 임시 사용자 ID 없음                     |
| 사용자 취소/동의 거절                | 새 로그인 성공 처리 없이 재시도 가능                         |
| 잘못된 콜백/코드 없음                | 오류 안내, 새 세션 생성 없음                                 |
| 네이티브 브라우저와 라우터 동시 복귀 | 같은 코드 교환을 한 번 수행                                  |
| 앱 종료·재실행                       | SDK 초기 세션으로 사용자 복원                                |
| 전경/배경·토큰 갱신                  | 활성 상태에 맞춰 갱신, 동일 계정의 화면 데이터 유지          |
| A → 로그아웃 → B                     | A의 메모리 여행·일정·비용·초대 토큰·방문과 Query 캐시 초기화 |
| 로그아웃 실패                        | 실패 표시, 로그아웃 완료로 안내하지 않음                     |
| 웹 기본 경로와 콜백 직접 접근        | 등록한 복귀 경로에서 인증 완료/안전한 오류 복귀              |

자동 테스트는 프로필 변환·계정 초기화·콜백/구성 경계만 검증한다. 실제 Supabase·카카오·구글·애플 인증 결과를 fixture로 대체하지 않는다. 기존 게스트/발자취 기기 초안은 서버 인증·보존과 다르다.

## 이번 변경 파일과 역할

| 파일                                                                                             | 변경                                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `apps/mobile/src/features/auth/model.ts`                                                         | 실제 프로필/계정 초기화, 공개 키·콜백·PKCE 흐름 검증                                |
| `apps/mobile/src/features/auth/oauth.ts`                                                         | 제공자 URL 발급·인증 창·웹 이동·실제 코드 교환·중복 콜백 조정                       |
| `apps/mobile/src/features/auth/pkceCrypto.ts`                                                    | 네이티브 보안 난수·SHA-256 보완, 약한 폴백 차단                                     |
| `apps/mobile/src/features/auth/AuthBridge.tsx`                                                   | SDK 세션 복원·갱신·로그아웃 구독, 계정 Query 캐시 제거                              |
| `apps/mobile/src/app/auth/callback.tsx`                                                          | 공통 복귀 화면·실패 안내·새 로그인 복귀                                             |
| `apps/mobile/src/app/_layout.tsx`                                                                | 전역 인증 연결 등록                                                                 |
| `apps/mobile/src/app/login.tsx`                                                                  | 임시 소셜 인증 제거, 실제 서비스 연결, 웹/모바일 실패 안내                          |
| `apps/mobile/src/app/(tabs)/my.tsx`                                                              | 실제 세션 종료 성공 후 이동, 실패 안내                                              |
| `apps/mobile/src/stores/useTripStore.ts`                                                         | 가짜 소셜 사용자 생성 제거, 실제 로그아웃, 계정 컬렉션 초기화·게스트 복원 충돌 방지 |
| `apps/mobile/src/services/supabase.ts`                                                           | PKCE 설정                                                                           |
| `packages/domain/src/index.ts`                                                                   | 이메일 Auth 유형을 게스트와 구분                                                    |
| `app.config.ts`, `apps/mobile/app.config.ts`, `apps/mobile/package.json`, `package-lock.json`    | Expo 호환 인증 브라우저 의존성과 플러그인 설정                                      |
| `.env.example`                                                                                   | 웹 복귀 주소 공개 설정 예제                                                         |
| `package.json`, `tests/auth/auth.test.ts`, `tests/web/auth.spec.ts`                              | 인증 경계 테스트 명령과 콜백 브라우저 테스트                                        |
| `docs/DB_DICTIONARY.txt`                                                                         | v1.7 인증 도메인·계정 상태·PKCE 명세                                                |
| `docs/planning/APP_COMPLETION_SCOPE.md`                                                          | 사용자 7개 완성 기준과 선행 작업                                                    |
| `docs/planning/README.md`, `POLICY_DECISIONS.md`, `DAILY_MILESTONES.md`, `TRAIL_CONTENT_SPEC.md` | 최신 요구 우선 적용·기존 범위 및 일정과의 차이                                      |
| `docs/PROJECT_PROGRESS_REPORT.md`, `docs/SOCIAL_AUTH_SETUP.md`                                   | 실제 변경 범위와 외부 환경 준비·검증 한계                                           |

기존 미커밋 DB/API/발자취 구현은 보존했다. 커밋·푸시·운영 배포·실제 OAuth 계정 생성은 수행하지 않았다.

## 2026-10-03 로컬 검증 기록

- `npm run check`: TypeScript 엄격 검사·ESLint 경고 0·Prettier 전부 통과.
- `npm run test:auth`: 공개 키/실제 UUID/계정 분리/콜백/PKCE 식별자 9개 통과.
- `npm run test:foundation`: 기존 SQL·HTTP·발자취 규칙 28개 통과.
- `npm run build:web`: 공통 인증 콜백 포함 11개 정적 라우트 export 성공.
- `npm run test:trail:web`: 콜백 오류·로그인 복귀와 기존 기기 초안 브라우저 테스트 4개 통과.
- 공급자별 실제 OAuth·Supabase 원격 가입·네이티브 암호/실기기 복귀는 환경 미준비로 미검증.

`expo-web-browser` 설치의 npm 감사 로그는 31개(높음 19·중간 12)를 보고했다. 이전 문서의 감사 수치와 실행 시점/설치 상태가 달라 차이를 원인별로 검증하지 않았으며, 호환성 점검 없이 주요 버전을 바꾸는 자동 수정은 적용하지 않았다. 출시 전 의존성별 대응을 별도 확인해야 한다.
