# TripPrint

여행계획을 만들고 동행자와 일정을 관리하며, 다녀온 기록 중 직접 고른 내용을 공유하는 앱·웹 프로젝트입니다.

실행하는 앱은 `apps/mobile`입니다. 루트 Expo 설정과 `@/` 경로도 `apps/mobile/src`를 사용합니다. 예전 루트 `src/` 프로토타입은 2026-10-19 정리했습니다.

## 현재 기준

- 앱: Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript
- 서버: Cloudflare Workers + Hono, D1, 비공개 R2, Better Auth
- 상태: TanStack Query와 Zustand
- 게스트: 이 기기에 여행과 사진을 저장하며 회원의 서버 여행과 구분
- 브랜드: TripPrint 로고와 하루, 승인된 디자인 토큰 사용
- 버전: [ver.text](ver.text)의 versionCode와 versionName을 앱 설정에서 읽음

[최신 P0 검증 기록](<docs/05. 검수/02. 검수보고/Stitch_P0인수검수.txt>), [정리·자원 관리 점검](<docs/05. 검수/02. 검수보고/리소스코드_정리검수.txt>), [배포 절차](<docs/04. 운영/01. 배포절차/서버웹_배포절차.md>)에서 완료 범위와 남은 검증을 확인합니다. 과거 보고의 미배포·미연결 문장을 현재 상태로 해석하지 않습니다.

[staging 웹](https://tripprint-staging.pages.dev) · [공개 버전 정보](https://tripprint-staging.pages.dev/release.json)

직접 내부 테스트용 AAB를 만들 때는 [빌드 설정·실행 순서](<docs/04. 운영/01. 배포절차/Android_GitHub빌드절차.md>)를 따릅니다. GitHub Actions에서 `main`·`aab`·`submit_play=false`·`draft`를 선택하며, 실제 게스트·Google 로그인 검수는 Play 설치 후 진행합니다. 현재 소스는 versionCode9이고 이미 사용한 번호라면 `ver.text`를 먼저 수정합니다.

## 개발 환경과 실행

Node.js 22.13 이상인 22 LTS 또는 24.3 이상인 24 LTS, npm 11.5.2 기준입니다. 저장소의 `.nvmrc`는 22.17.0입니다.

`npm ci`로 잠금 파일에 맞춰 설치하고 `npm start` 또는 `npm run web`으로 앱을 실행합니다. Android의 지도·인증 등 네이티브 기능은 프로젝트 개발 설치본에서 확인합니다.

| 명령                       | 용도                                      |
| -------------------------- | ----------------------------------------- |
| `npm run check`            | 디자인 대비·코드 경계·타입·린트·서식 검사 |
| `npm run test:auth`        | 입력·계정·여행·자원 수명 회귀 검사        |
| `npm run test:release`     | 배포 설정·산출물 검사                     |
| `npm run test:foundation`  | API 계약 검사                             |
| `npm run mobile:build:web` | 웹 정적 파일 생성                         |
| `npm run api:dev`          | API 개발 서버 실행                        |
| `npm run release:check`    | 배포 환경 설정 검사                       |

Android 빌드·배포는 사용자가 요청한 범위에서 별도로 실행합니다. 웹 출력 생성이나 자동 검사를 실행했다는 이유로 Play 설치본이 업데이트되지는 않습니다.

## 폴더 역할

```text
apps/mobile/src/       실제 앱 화면·컴포넌트·서비스
apps/mobile/assets/    앱에서 사용하는 브랜드·글꼴·이미지
apps/mobile/modules/   프로젝트의 네이티브 모듈
apps/api/src/          API·인증·파일·공유 처리
apps/api/migrations/   D1 변경 이력
packages/api-client/   인증·취소·제한 시간을 적용하는 API 클라이언트
packages/domain/       도메인 모델
packages/validation/   입력·응답 검증 계약
scripts/               개발·배포 검사와 자산 제작 도구
tests/                 자동 검사와 격리된 검수 자료
docs/                  현행 기능·디자인·DB·검수 문서
outputs/               로컬 검수 증거·정리 명세, Git·EAS 제외
.release/              로컬 빌드·도구 자료, Git·EAS 제외
supabase/              이전 백엔드 스키마 참고 자료
```

`apps/mobile/android`의 생성 소스·서명·최종 APK/AAB와 에뮬레이터 데이터는 중간 빌드 캐시와 구분합니다. 용량만 보고 일괄 삭제하지 않습니다. 테스트의 fixture와 디자인 원본도 제품의 더미 데이터와 구분합니다.

[CTO 코드 검토](<docs/05. 검수/02. 검수보고/CTO_코드검토.txt>)에서 기능·표현·예외·고정값의 검수 결과를 확인합니다.

## 작업 기준

- [AGENTS.md](AGENTS.md)의 코드·검증·문구 규칙을 따릅니다.
- UI 변경 전 [DESIGN.md](<docs/02. 디자인/00. 공통규격/디자인시스템.md>), [디자인 토큰](<docs/02. 디자인/00. 공통규격/design-tokens.json>), [헤더 규격](<docs/02. 디자인/00. 공통규격/헤더GNB_규격.md>)을 확인합니다.
- 신규 Stitch 적용 범위는 [원본 대조·연결 기록](<docs/02. 디자인/00. 공통규격/Stitch시안_적용범위.txt>)을 우선합니다.
- DB·도메인 변경은 [DB 사전](<docs/03. 개발/02. 데이터정의/DB_객체사전.txt>)을 함께 수정합니다.
- 환경 변수·서명·계정 자료는 저장소와 화면에 노출하지 않습니다.
- 실제 저장되지 않은 데이터와 미지원 기능을 사용 가능한 것처럼 표시하지 않습니다.
- 생성 파일은 `outputs/` 등 정해진 경로에 두며, 소스와 섞지 않습니다.
