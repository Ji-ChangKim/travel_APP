# travel_APP 배포 프로세스 가이드

이 문서는 **travel_APP**의 모바일 앱(Android, iOS) 및 웹(Web) 배포 프로세스를 단계별로 안내합니다.

---

## 1. 사전 준비 (EAS CLI & Expo 계정)

Expo의 공식 클라우드 빌드 시스템인 **EAS(Expo Application Services)**를 사용합니다.

### 1-1. Expo 계정 생성

- [expo.dev](https://expo.dev)에서 무료 계정을 생성합니다.

### 1-2. EAS CLI 로그인

터미널에서 아래 명령을 실행하여 로그인합니다:

```powershell
npx eas-cli login
# 또는 npm run eas:login
```

### 1-3. 프로젝트 연결 (최초 1회)

```powershell
npx eas-cli init
```

화면의 안내에 따라 기존 프로젝트에 연결하면 `app.config.ts` 또는 `app.json`에 `extra.eas.projectId`가 자동 등록됩니다.

---

## 2. 배포 프로필 구성 (`eas.json`)

프로젝트 루트의 `eas.json`에 3가지 프로필이 준비되어 있습니다:

| 프로필명          | 용도                         | 빌드 결과물                                            |
| :---------------- | :--------------------------- | :----------------------------------------------------- |
| **`preview`**     | 내부 테스트 및 실기기 검증용 | **Android 설치용 `.apk` 파일** 직접 다운로드 링크 제공 |
| **`production`**  | 구글/애플 스토어 공식 제출용 | **Android `.aab` (App Bundle)**, **iOS `.ipa`** 생성   |
| **`development`** | 네이티브 디버깅용            | Expo Dev Client 빌드                                   |

---

## 3. 플랫폼별 빌드 및 배포 방법

### 3-1. Android 실기기 테스트용 APK 빌드 (가장 빠른 실기기 테스트)

복잡한 인증서나 스토어 등록 없이 실제 Android 스마트폰에 직접 설치할 수 있는 `.apk`를 빌드합니다:

```powershell
# Android 프리뷰 APK 빌드 실행
npm run build:apk
# 또는: npx eas-cli build -p android --profile preview
```

- 빌드가 완료되면 터미널과 이메일로 `.apk` 다운로드 링크 및 모바일로 즉시 스캔 가능한 QR 코드가 제공됩니다.

### 3-2. Google Play Store 출시 (Production AAB)

```powershell
# 프로덕션 빌드 (AAB)
npx eas-cli build -p android --profile production

# 구글 플레이 콘솔에 자동 제출
npx eas-cli submit -p android
```

> 최초 1회 키스토어 생성은 EAS가 클라우드에서 안전하게 자동 생성 및 보관해 줍니다.

### 3-3. Apple App Store / TestFlight 출시 (iOS)

```powershell
# 프로덕션 빌드 (IPA)
npx eas-cli build -p ios --profile production

# App Store Connect / TestFlight로 자동 제출
npx eas-cli submit -p ios
```

> Apple Developer 유료 계정($99/년)이 필요하며, EAS가 인증서(Provisioning Profile, Certificate)를 자동으로 생성 및 동기화합니다.

### 3-4. Android & iOS 동시 빌드

```powershell
npm run build:all
```

---

## 4. 웹(Web) 배포 프로세스

### 4-1. 로컬 정적 빌드 검증

```powershell
npm run build:web
```

- 번들링 및 사전 렌더링된 정적 웹 사이트가 `dist/` 폴더에 생성됩니다.

### 4-2. GitHub Actions 자동 배포 (CI/CD)

- `main` 브랜치에 코드를 푸시하면 [`.github/workflows/deploy-web.yml`](file:///j:/개인%20프로젝트/App/travel_APP/.github/workflows/deploy-web.yml)이 실행되어 GitHub Pages로 자동 배포됩니다.
- GitHub 저장소 설정(`Settings` -> `Pages`)에서 배포 소스를 **GitHub Actions**로 설정해 두면 자동으로 라이브 URL이 활성화됩니다.

---

## 5. 앱 버전 및 메타데이터 관리 (`app.config.ts`)

앱을 업데이트할 때마다 [app.config.ts](file:///j:/개인%20프로젝트/App/travel_APP/app.config.ts)의 버전 정보를 증가시킵니다:

```typescript
// 사용자에게 보이는 버전 (시맨틱 버저닝)
version: '0.1.0',

// iOS 내부 빌드 번호 (정수 문자열, 배포 시마다 +1)
ios: {
  bundleIdentifier: 'com.travelapp.mobile',
  buildNumber: '1',
},

// Android 내부 버전 코드 (정수, 배포 시마다 +1)
android: {
  package: 'com.travelapp.mobile',
  versionCode: 1,
}
```
