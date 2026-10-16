# travel_APP

여행을 계획하고, 동행자와 일정을 공유하고, 다녀온 이야기를 기록하는 APP/WEB 프로젝트입니다.

페이지별 오류 발생 상황·서버/네트워크/버전 분류·코드 표시·재시도 기준은 [에러 코드 정의서](docs/ERROR_CODE_SPEC.md)를 확인하세요. 현행 서버 오류와 앞으로 적용할 앱 표시 규약을 구분했습니다.

2026-10-12 내부 테스트 핵심 흐름 안정화: 로그인 상태 유지, 일정·비용 입력 오류 복구, 저장 응답 유실·동행 충돌 처리, 사진 계정 확인·재조회·게스트 삭제를 보완했습니다. 변경 파일·자동 검사·실기기 인수 12개 항목은 [핵심 안정화 보고](docs/CURRENT_STATUS.txt)를 확인하세요.

1차 MVP 후보 `0.1.0 / mvp-0.1.0-internal-candidate-20261012`에 메인 추천 자동 슬라이드를 추가했습니다. 검증·성능 측정·산출물 및 Play 내부 테스트 배포 전 인수 항목은 [MVP 마무리 보고](docs/CURRENT_STATUS.txt)를 확인하세요. 실제 원격 출시 완료 여부는 보고서에 별도로 기록합니다.

메인에서 회원 게시물 없이도 도시 사진·소개와 월간 문서 조회 통계를 탐색하도록 공개 Wikimedia API를 연결했습니다. 실제 방문객 순위와 편집 추천을 구분하며, 연결·검증·배포 상태는 [여행지 탐색 API 보고](docs/CURRENT_STATUS.txt)를 확인하세요.

2026-10-12 Play 내부 테스트 목표에 맞춰 비회원 공개 발자국 탐색과 빌드 전 저장·보안·화면 검증을 보완했습니다. Google 저장 목록 직접 동기화의 지원 국가 제약, 미완료 계정 기능, 실제 배포·인수 항목은 [내부 테스트 준비 보고](docs/CURRENT_STATUS.txt)를 확인하세요.

게스트는 Google 인증 없는 기기별 계정이며 여행과 사진을 로컬에 저장합니다. `Quest-` 뒤 대문자·숫자 6자리 닉네임과 모든 회원의 닉네임 중복 방지를 구현했습니다. 최신 정책·검증·배포 전 필요한 `0006_unique_nicknames.sql` 적용은 [기기 게스트 구현 보고](docs/CURRENT_STATUS.txt)를 확인하세요. 이번 스키마와 앱 변경은 아직 원격 배포하지 않았습니다.

2026-10-06 MVP 보완: 이메일 로그인/가입, Google Maps 공유 장소 가져오기, 완료 여행 발자국 다이어리. 범위·변경 파일·실서비스 연결·검증 결과는 [MVP 구현 보고](docs/CURRENT_STATUS.txt)를 확인하세요. `npm start`와 `npm run web`는 현재 MVP가 있는 `apps/mobile`을 실행합니다.

현재 MVP는 Cloudflare Workers + D1 + 비공개 R2 + Better Auth 이메일 로그인으로 동작합니다. [배포된 웹](https://wherego-staging.pages.dev)에서 확인할 수 있습니다. 실제 배포·검증·변경 파일·APK 및 공급자 연결 상태는 [Cloudflare 전환·배포 보고](docs/CURRENT_STATUS.txt)를 확인하세요. 소셜 로그인과 자동 Google OCR/장소 검색은 공급자 설정을 기다리고 있습니다.

1차 테스트 준비본은 `0.1.0 / test-1`입니다. [테스트 안내](docs/CURRENT_STATUS.txt)에 접속 방법·시나리오·배포 기록·미연결 범위를 정리했습니다. [배포 버전 확인](https://wherego-staging.pages.dev/release.json)에서 현재 공개된 버전을 확인할 수 있습니다.

지도는 Google Places 검색과 Google Maps 앱·웹 열기를 사용합니다. [설정 및 변경 보고](docs/GOOGLE_MAPS_SETUP.md)를 확인하세요.

## 개발 환경

Android 설치 테스트의 하단 시스템 바·로그인 진입·항공편 기반 여행 생성·지도/영수증 우선 입력 변경은 [피드백 반영 및 재빌드 절차](docs/CURRENT_STATUS.txt)를 확인하세요.

- Node.js 22.13 이상인 22 LTS 또는 24.3 이상인 24 LTS (`.nvmrc`: 22.17.0)
- npm 11.5.2 기준
- Expo SDK 57 / React Native 0.86 / React 19.2
- Expo Router 파일 기반 라우팅, TypeScript 엄격 모드
- ESLint + Prettier

## 시작하기

```powershell
# 잠금 파일에 기록된 버전으로 패키지를 설치합니다.
npm ci

# Expo 개발 서버를 실행합니다.
npm start
```

| 명령                         | 용도                                               |
| ---------------------------- | -------------------------------------------------- |
| `npm run mobile`             | 모바일 앱(apps/mobile) Expo 개발 서버 실행         |
| `npm run mobile:web`         | 모바일 앱 웹 브라우저 실행                         |
| `npm run mobile:doctor`      | 모바일 앱 Expo 호환성 및 설정 검사                 |
| `npm run mobile:build:web`   | 모바일 앱 정적 배포 파일(`dist/`) 생성             |
| `npm run mobile:build:apk`   | EAS 기반 실기기 설치용 Android APK 빌드            |
| `npm run api:dev`            | Hono API(apps/api) Cloudflare Workers 개발 서버    |
| `npm run check`              | 모노레포 전체 타입·린트·서식 통합 검사             |
| `npm run test:workspace:web` | 격리된 Auth/API/Storage 응답으로 전체 앱 흐름 검증 |
| `npm run format`             | 모노레포 전체 코드 서식 자동 정리                  |
| `npm run format:check`       | 파일 수정 없이 서식 일치 여부 검사                 |
| `npm run build:all`          | Android(AAB) + iOS(IPA) 스토어 프로덕션 빌드       |

### 배포 프로세스 상세 가이드

앱 버전은 루트의 [ver.text](ver.text) 파일에서 관리합니다. `versionCode=2`는 Android 업로드 번호, `versionName=0.1.0`은 사용자 표시 버전입니다. 이 파일을 수정하고 저장하면 Expo와 Android Studio 빌드가 같은 값을 직접 읽습니다. Android Studio에서 Sync 후 서명된 AAB/APK를 새로 생성하세요. Play에 이미 사용한 번호보다 큰 versionCode를 지정해야 합니다. EAS도 local 설정과 자동 증가 해제로 같은 파일을 사용합니다. 상세 내용은 [버전 관리 안내](docs/CURRENT_STATUS.txt)를 참고하세요.

현재 목표는 Expo에서 내려받아 Android 실기기에 설치하는 MVP APK입니다. [Android MVP 빌드 절차](docs/CURRENT_STATUS.txt)와 [체크리스트](docs/CURRENT_STATUS.txt)를 먼저 확인하세요. Cloudflare 공개 API와 웹 주소를 준비해 `npm run mvp:check`, `npm run mvp:prepare`로 검사하고, Expo 로그인·preview 환경 등록 후 `npm run mobile:build:apk`를 실행합니다. 스토어 심사·제출은 이번 범위에 포함하지 않습니다.

자세한 빌드 및 배포 절차는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 문서를 참고하세요.

`.env.release.example`에 따라 실제 공개 설정을 준비한 뒤 `npm run release:check`와 `npm run release:prepare`로 환경 검사·웹 export·Worker dry-run을 실행합니다. 원격 배포는 main에서 staging/production을 선택하는 수동 GitHub Actions로 준비했습니다. 실제 외부 계정 설정·인수와 운영 공개 전 남은 작업은 배포 문서를 따릅니다.

### 실제 휴대폰

개발 PC와 휴대폰을 같은 네트워크에 연결하고 `npm start`로 표시되는 QR 코드를 SDK 57과 호환되는 Expo Go에서 엽니다. Android에서는 Expo Go의 스캔 기능을, iOS에서는 카메라를 사용할 수 있습니다. 실제 iOS 기기에서는 Expo 계정 로그인이 필요할 수 있습니다.

### 에뮬레이터와 Windows

Android 에뮬레이터는 Android Studio와 Android SDK 설정이 필요합니다. Windows에서는 iOS 시뮬레이터를 실행할 수 없으므로 실제 iPhone의 Expo Go를 사용하거나 macOS에서 시뮬레이터를 실행합니다. 스토어 배포용 네이티브 빌드와 서명은 별도 설정이 필요합니다.

## 아키텍처 및 기술 구성

- **앱**: React Native + Expo SDK 57 + TypeScript (Expo Router)
- **상태 관리**: TanStack Query (서버 캐시), Zustand (앱 전역 상태)
- **입력 검증**: Zod + React Hook Form
- **백엔드/인증/DB**: Supabase (Auth, PostgreSQL, Storage)
- **보안 저장**: Expo SecureStore
- **API**: Cloudflare Workers + Hono
- **앱 빌드**: Expo EAS Build

## 폴더 구조

```text
travel_APP/
├── apps/
│   └── api/                # Cloudflare Workers + Hono API (장소 검색, 공유 링크, OCR)
├── packages/
│   ├── domain/             # 11개 핵심 데이터 모델 및 Enum (@wherego/domain)
│   └── validation/         # Zod 검증 스키마 (@wherego/validation)
├── supabase/
│   ├── migrations/         # 11개 테이블 DDL & RLS 정책
│   └── seed.sql            # 초기 시드 데이터
├── src/
│   ├── app/
│   │   ├── _layout.tsx     # 루트 레이아웃 (QueryClientProvider, StatusBar)
│   │   ├── index.tsx       # 온보딩 시작 화면
│   │   └── (tabs)/         # 하단 3개 탭 네비게이션
│   │       ├── _layout.tsx # 탭바 설정
│   │       ├── index.tsx   # [내 여행] 예정·여행 중·완료 필터, 여행 생성, 일정 등록
│   │       ├── footprints.tsx # [발자국] 다녀온 장소 모아보기, GPS 체크인, 후기 작성
│   │       └── my.tsx      # [마이] 프로필, GPS/오프라인 권한, 앱 정보
│   ├── constants/
│   │   └── theme.ts        # 테마 색상 팔레트
│   ├── services/
│   │   ├── supabase.ts     # Supabase 클라이언트 & SecureStore 어댑터
│   │   └── travelStorage.ts# 로컬 데이터 관리
│   └── stores/
│       └── useTripStore.ts # Zustand 여행/일정/발자국 전역 스토어
├── docs/
│   └── DEPLOYMENT.md       # 멀티플랫폼 배포 프로세스 가이드
├── eas.json                # EAS 빌드 프로필 (preview: APK, production: AAB/IPA)
└── app.config.ts           # Expo 앱 식별자 및 플랫폼 설정
```

`@/`는 `src/`를 가리킵니다. 새 화면은 `src/app/`에 추가합니다. 컴포넌트와 통신 계층은 실제 기능을 구현할 때 필요한 범위로 추가합니다.

## 작업 규칙

- 함수 본문에는 하나의 명령을 두고, 동작을 설명하는 한글 주석을 작성합니다.
- 변경 후 `npm run check`를 실행합니다.
- 패키지를 추가할 때 Expo 관련 패키지는 `npx expo install 패키지명`을 사용합니다.
- `package-lock.json`을 함께 관리하고, 재설치는 `npm ci`로 진행합니다.
- `.expo/`, `dist/`, 자동 생성 네이티브 폴더, 로컬 환경 변수와 서명 키는 Git에서 제외합니다.

현재 시작 화면은 서버, 계정 또는 환경 변수 없이 실행됩니다. 아이콘과 시작 이미지는 Expo 기본 리소스이며 실제 서비스 배포 전에 교체할 수 있습니다.

## 공식 문서

- [Expo 프로젝트 생성](https://docs.expo.dev/get-started/create-a-project/)
- [Expo 개발 시작](https://docs.expo.dev/get-started/start-developing/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [ESLint 및 Prettier 설정](https://docs.expo.dev/guides/using-eslint/)
