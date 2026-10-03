# Android MVP APK 빌드 체크리스트

2026-10-03. 목표는 **Expo EAS에서 APK를 내려받아 Android 실기기로 테스트하는 MVP**다. 스토어 심사·제출·운영 정책 완료는 이번 빌드의 선행 조건이 아니다. 이전 플랫폼 전체 체크리스트를 현재 Android 범위에 맞춰 정리했다. 자세한 절차는 [Android MVP 빌드](MVP_ANDROID_BUILD.md)를 따른다.

## 로컬에서 확인한 준비

- [x] SDK 57 권장 패치 4개를 루트·모바일 워크스페이스에 적용.
- [x] preview 내부 APK 프로필과 preview 환경 설정.
- [x] preview 빌드 번호 자동 증가, EAS의 개발 .env 로딩 제외.
- [x] 실제 공개 값 4개를 검사하는 로컬/EAS preview 검사 추가.
- [x] Android 외부 딥링크의 크기·깨진 인코딩 차단과 회귀 테스트.
- [x] staging OCR 키 없이 영수증 사진 확인·수동 입력 가능하도록 구성.
- [x] Android export 및 Hermes 컴파일 통과. 서명된 APK와는 별도 결과.
- [x] Expo native config introspection에서 앱 식별자·복귀 스킴·마이크 권한 제거와 Camera 라이브러리 선언 확인.
- [x] 변경 후 npm run check 및 인증 11개·설정 10개·SQL/API 37개·브라우저 6개(총 64개) 통과.
- [ ] Android prebuild에서 권한·앱 스킴·플러그인 반영 확인.
- [ ] Expo doctor의 온라인 스키마 검사 완료. 재시도에도 Expo API TLS 오류로 미완료.

## 실제 APK를 시작하려면

- [ ] `npm run eas:login`으로 Expo 계정 로그인. 현재 최초 결과는 Not logged in.
- [ ] owner `rupang` / project ID `3b23b462-262c-4b64-aff2-5fb03280e6b5` 접근 확인.
- [ ] 테스트 Supabase·SQL 6개·RLS·private Storage 적용.
- [ ] 최소 한 소셜 제공자 연결 및 실제 웹 가입 확인. 나머지 제공자는 미검증으로 기록.
- [ ] 휴대폰에서 접근 가능한 HTTPS API와 테스트 웹 연결.
- [ ] Supabase 복귀 allowlist와 제공자 callback 설정.
- [ ] `.env.mvp`와 EAS preview에 실제 공개 설정 4개 등록.
- [ ] `npm run mvp:check`와 `npm run mvp:prepare` 통과.
- [ ] Android package `com.travelapp.mobile`, 기존 서명 또는 EAS keystore 생성 방식 확인.
- [ ] 빌드 소스 버전·담당자·테스트 폰 지정.

OCR 키는 첫 staging 테스트의 필수 항목이 아니다. 미설정 시 수동 입력을 검증하고 자동 OCR은 미검증으로 표시한다. Pages/Worker/Supabase의 실제 연결이 없는 APK는 전체 기능 MVP 인수를 할 수 없다.

## 빌드·다운로드·설치

- [ ] `npm run mobile:build:apk` 실행.
- [ ] EAS 결과 Finished와 APK 다운로드 링크 확인.
- [ ] Android 휴대폰에 APK 설치 및 앱 시작/재실행.
- [ ] 실제 로그인/취소/로그아웃/세션 복원 확인.
- [ ] 여행·일정·사진·지역·비용 저장과 다른 기기 조회.
- [ ] 두 계정으로 초대·복귀·수락·역할 제한 확인.
- [ ] 카메라 권한 거부/허용·영수증 수동 입력·중복 저장 방지 확인.
- [ ] 종료 여행의 공개·철회·신고·차단·영수증 비공개 확인.
- [ ] 미연결 제공자·OCR 및 발견한 오류를 기록.

## 결과 기록

| 항목                     | 현재 기록             |
| ------------------------ | --------------------- |
| 플랫폼 / 프로필          | Android / preview APK |
| 소스 버전 / 빌드 번호    | 미기록                |
| EAS 계정 / 프로젝트 접근 | 미로그인, 접근 미확인 |
| EAS 빌드 / 다운로드 링크 | 미실행                |
| 테스트 기기 / 담당자     | 미정                  |
| 실제 서버 공개 설정      | 미등록                |
| 설치 결과 / 미해결 기능  | 미검증                |

운영 공개와 스토어 제출은 추후 [배포 절차](DEPLOYMENT.md)에서 별도로 확인한다.
