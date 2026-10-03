# WHEREGO Android MVP 테스트 빌드

2026-10-03. 이번 목표는 **Expo EAS preview에서 APK를 생성하고 Android 휴대폰에 내려받아 기능을 테스트하는 것**이다. 스토어 심사·스토어 제출·운영 공개는 이번 작업 범위에 포함하지 않는다. 내부 APK도 실제 로그인과 공유 데이터를 테스트하려면 테스트 서버가 필요하다.

## MVP에 포함한 기능

- 실제 소셜 계정 로그인과 로그아웃. 최초 연결한 제공자부터 검증하고 나머지는 미검증으로 기록한다.
- 여행·날짜별 일정·비용·지역·사진 저장 및 다른 계정/기기 조회.
- 초대 링크 생성·공유·로그인 복귀·참여와 편집자/뷰어 권한.
- 영수증 사진 촬영·선택·확인 후 일정/실제 지출에 추가.
- 종료 여행의 선택 일정/사진/비용 공개와 철회·신고·차단.

영수증 OCR 키는 staging에서 선택 사항이다. 없으면 사진을 보며 직접 입력하고, 키를 연결한 이후 자동 인식 후보를 검증한다. 인식 성공을 임의 생성하지 않는다. production Worker의 필수 OCR 선언은 유지한다.

## 여기서 준비한 것과 외부에서 필요한 것

| 여기서 처리                                            | 외부 접근이 필요한 작업                             |
| ------------------------------------------------------ | --------------------------------------------------- |
| SDK 57 권장 패치 버전 적용, 코드·SQL/API·설정 테스트   | Expo 계정 직접 로그인, 기존 프로젝트 접근 권한      |
| Android 번들/Hermes 컴파일, Android 네이티브 생성 검사 | APK 서명 키 확인 또는 EAS keystore 생성 선택        |
| preview APK/빌드 번호/개발 .env 제외 설정              | EAS preview 공개 환경 값 4개 등록                   |
| MVP 환경 사전 검사와 EAS hook                          | Supabase 테스트 프로젝트와 실제 소셜 제공자 설정    |
| 비정상 Android 딥링크 크기·인코딩 검사                 | 휴대폰에서 접근 가능한 API·웹 주소와 실제 서버 적용 |
| staging OCR 키 선택 사항으로 변경                      | 테스트 폰 설치·카메라/공유/인증 복귀 인수           |

키·비밀번호·Expo 인증 코드를 채팅에 보내지 않는다. 플랫폼 로그인은 직접 수행하고, 공개 설정은 로컬 환경 파일이나 EAS 콘솔에 넣는다.

## 최소 외부 준비

1. 루트 터미널에서 `npm run eas:login`으로 로그인한다. 현재 최초 확인 결과는 `Not logged in`이었다.
2. 기존 owner `rupang`, EAS project ID `3b23b462-262c-4b64-aff2-5fb03280e6b5`에 접근 가능한지 확인한다. 새 프로젝트 ID를 임의 발급하지 않는다.
3. Supabase 테스트 프로젝트를 만들고 SQL 6개·프로필 트리거·RLS·private Storage를 적용한다. 최소 한 소셜 제공자를 연결해 실제 가입을 확인한다.
4. 휴대폰에서 접근 가능한 HTTPS API와 테스트 웹을 연결한다. `localhost`는 사용할 수 없다. 초대 링크와 웹 OAuth 복귀 주소는 실제 테스트 웹 주소를 사용한다.
5. EAS 프로젝트의 `preview` 환경에 다음 공개 값 4개를 등록한다.

| 값                                  | 대상                                     |
| ----------------------------------- | ---------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`          | 실제 테스트 Supabase URL                 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`     | 같은 프로젝트의 anon/publishable 공개 키 |
| `EXPO_PUBLIC_API_URL`               | 휴대폰에서 접근 가능한 HTTPS API origin  |
| `EXPO_PUBLIC_AUTH_WEB_REDIRECT_URL` | 테스트 웹 origin + `/auth/callback`      |

OAuth 제공자 callback은 Supabase가 안내한 `/auth/v1/callback` 주소다. Supabase Redirect URLs에는 실제 웹 복귀 주소와 `travelapp://auth/callback`을 등록한다. [서비스 설정](APP_SERVICES_SETUP.md), [제공자 설정](SOCIAL_AUTH_SETUP.md).

## 로컬 준비 명령

`.env.mvp.example`을 참고해 루트 `.env.mvp`에 공개 값을 입력한다. 기존 파일은 덮어쓰지 않는다. 이 파일은 Git에서 제외된다. EAS preview 설정은 별도로 등록해야 한다.

```powershell
Copy-Item -LiteralPath .env.mvp.example -Destination .env.mvp
npm run mvp:check
npm run mvp:prepare
```

- `mvp:check`: 실제 공개 값 4개의 형식과 HTTPS·복귀 주소·공개 키 종류를 검사한다. 스토어 계정, Cloudflare 프로젝트명, OCR 키는 요구하지 않는다. 원격 프로젝트 존재·실제 인증 성공을 확인하는 검사는 아니다.
- `mvp:prepare`: 공개 설정 검사를 통과한 뒤 Android export와 Hermes 컴파일을 수행한다. 결과는 `apps/mobile/.release/android`다. APK 서명·EAS 업로드는 수행하지 않는다.
- `mvp:bundle:android`: 설정 없는 상태에서도 코드 컴파일만 진단하는 명령이다. 성공해도 기능 테스트 가능한 실제 서버 연결을 보장하지 않는다.
- EAS `preview`의 post-install hook도 공개 설정을 검사한다. 설정이 없으면 Gradle APK 작업을 계속하지 않는다. 다른 EAS 프로필은 이 MVP hook의 검사 대상에서 제외한다.

## APK 생성·다운로드·설치

공개 환경과 프로젝트 접근을 확인한 뒤 루트에서 실행한다.

```powershell
npm run mobile:build:apk
```

이 명령은 `apps/mobile`의 EAS `preview` 프로필로 실제 Android 클라우드 빌드를 시작한다. `distribution: internal`, `buildType: apk`, preview 환경, 자동 빌드 번호 증가를 사용한다. 개발 서버가 필요한 development client 빌드가 아니다. EAS 서버에서 로컬 개발 .env를 읽지 않도록 `EXPO_NO_DOTENV=1`을 설정했다.

1. CLI에서 프로젝트와 keystore를 확인한다. 기존 설치 앱이 있다면 서명 키의 일치 여부를 확인한다.
2. 빌드 링크에서 결과가 `Finished`인지 확인한다. 실패 시 해당 로그로 원인을 수정한다.
3. Android 휴대폰에서 빌드 링크의 APK를 내려받아 설치한다. 설치 앱 출처 허용이 필요한 경우 사용할 다운로드 앱의 설정을 확인한다.
4. 실제 폰에서 아래 순서로 확인한다. 빌드 번호·링크·기기·미검증 기능을 [체크리스트](BUILD_CHECKLIST.md)에 기록한다.

| 확인                         | 기대 결과                             |
| ---------------------------- | ------------------------------------- |
| 설치/시작/재실행             | 크래시 없이 실행, 로그인 세션 복원    |
| 실제 로그인/취소/로그아웃    | 가입 UUID 유지, 가짜 로그인 없음      |
| 여행→일정→사진→비용 저장     | 재실행/다른 기기에서도 서버 기록 조회 |
| A 초대→B 참여                | 복귀 후 명시적 수락, 뷰어 쓰기 거부   |
| 카메라/사진 권한 거부와 허용 | 재시도 가능, JPG/PNG만 업로드         |
| 영수증 확인·수동 입력        | 실제 금액/일정 연결, 중복 저장 없음   |
| 완료 여행 공개·철회          | 선택 자료만 공개, 영수증 원본 비공개  |

## 보안 점검과 현재 제한

Android export/Hermes 컴파일과 Expo native config introspection은 통과했다. config 평가에서 package·travelapp 스킴·마이크 권한 제거와 Camera 라이브러리 선언을 확인했다. 실제 합쳐진 APK manifest와 설치 동작은 EAS 빌드 후 검증한다. 로컬 prebuild는 공식 템플릿으로 재시도했지만 생성 단계에서 종료 코드 1로 중단되어 완료를 확인하지 못했다. Expo doctor의 온라인 스키마 조회도 TLS 오류로 미완료다. 이 결과를 네이티브 APK 빌드 성공으로 취급하지 않는다.

SDK 호환 패치 후에도 audit 보고는 31건(high 19, moderate 12)이다. 다음은 현재 의존 경로와 인수 판단이며 취약점 제거 완료를 뜻하지 않는다.

| 패키지                 | 확인한 경로와 조치                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decode-uri-component` | Expo Router→query-string 경로. 수정 버전 0.5.0은 ESM이며 기존 query-string 7은 CommonJS require를 사용한다. 강제 override 대신 Android 외부 링크를 Router 파싱 전에 길이 16KiB 및 정상 퍼센트 인코딩으로 제한했다. 웹 입력 전체와 모든 중첩 디코딩 경로의 위험을 제거한 것은 아니다. |
| `braces`               | Expo/Metro의 파일 패턴 처리 경로. 현재 advisory에 수정 버전 없음. 미검증 override나 외부 입력을 받는 빌드 서버 변경은 하지 않았다.                                                                                                                                                   |
| `node-forge`           | Expo CLI/코드 서명 도구 경로. 현재 advisory에 수정 버전 없음. 앱 코드·Worker에서 직접 사용하지 않는다. 경로 확인을 전체 공급망 안전 검증으로 간주하지 않는다.                                                                                                                        |
| `uuid`                 | xcode의 프로젝트 생성 경로에서 v4 호출 확인. advisory 대상의 v3/v5/v6 외부 버퍼 사용과 구분했다. iOS 네이티브 인수는 이번 Android 범위 밖이다.                                                                                                                                       |

[decode-uri-component advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

실제 Supabase·소셜 제공자·스캔 정확도·설치 앱 동작은 아직 인수하지 않았다. 계정 삭제·정책·스토어 정보 작성은 이번 APK 생성 조건에 포함하지 않는다. 테스트용 데이터와 지정한 테스트 계정을 사용하고, 운영 공개 전 준비는 [배포 문서](DEPLOYMENT.md)에 남긴다.

공식 참고: [EAS 모노레포](https://docs.expo.dev/build-reference/build-with-monorepos/), [APK 내부 배포](https://docs.expo.dev/build/internal-distribution/), [EAS 환경](https://docs.expo.dev/eas/environment-variables/), [빌드 hook](https://docs.expo.dev/build-reference/npm-hooks/).
