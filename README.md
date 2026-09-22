# travel_APP

여행을 계획하고, 동행자와 일정을 공유하고, 다녀온 이야기를 기록하는 APP/WEB 프로젝트입니다.

Expo + React Native + TypeScript를 사용해 Android, iOS, 웹에서 같은 화면 코드를 사용합니다. 현재는 개발 환경과 소개 화면까지 구성했으며, 여행 관리·공유·기록 기능은 이후 구현합니다.

## 개발 환경

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

| 명령                       | 용도                                            |
| -------------------------- | ----------------------------------------------- |
| `npm run mobile`           | 모바일 앱(apps/mobile) Expo 개발 서버 실행      |
| `npm run mobile:web`       | 모바일 앱 웹 브라우저 실행                      |
| `npm run mobile:doctor`    | 모바일 앱 Expo 호환성 및 설정 검사              |
| `npm run mobile:build:web` | 모바일 앱 정적 배포 파일(`dist/`) 생성          |
| `npm run mobile:build:apk` | EAS 기반 실기기 설치용 Android APK 빌드         |
| `npm run api:dev`          | Hono API(apps/api) Cloudflare Workers 개발 서버 |
| `npm run check`            | 모노레포 전체 타입·린트·서식 통합 검사          |
| `npm run format`           | 모노레포 전체 코드 서식 자동 정리               |
| `npm run format:check`     | 파일 수정 없이 서식 일치 여부 검사              |
| `npm run build:all`        | Android(AAB) + iOS(IPA) 스토어 프로덕션 빌드    |

### 배포 프로세스 상세 가이드

자세한 빌드 및 배포 절차는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 문서를 참고하세요.

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
