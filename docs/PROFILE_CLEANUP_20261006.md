# 사용자 화면의 DB 코드 기능 제거

2026-10-06. 일반 사용자에게 DB 코드를 표시·수정하게 하고 XOR/Base64 처리를 안전한 암호화라고 안내한 구성을 제거했다. 해당 고정 값은 현재 프로젝트 코드에서 서버 인증이나 DB 접속에 연결되지 않았으며, 로컬 저장·마이페이지 표시에만 사용됐다. 실제 서버 인증은 Worker의 AUTH_SECRET과 서버 세션으로 처리한다.

- `apps/mobile/src/app/(tabs)/my.tsx`: 코드 표시·공개·입력·복원·검증 버튼과 모달, 관련 상태·함수·스타일 삭제. 개발용 백엔드 구조 표시와 실제 요청 없이 성공을 안내하던 Supabase 동기화 기능 삭제. 프로필 편집·앱 버전·로그아웃은 유지.
- `apps/mobile/src/services/securityService.ts`, `src/services/securityService.ts`: 고정 코드와 내장 솔트, XOR/Base64 저장·복호화 모듈 및 이전 경로 재수출 삭제.
- `apps/mobile/src/services/legacyStorage.ts`, `features/auth/AuthBridge.tsx`: 앱 시작 시 이전 `wherego_encrypted_db_code` 항목만 삭제. 값을 읽거나 복호화하지 않으며 로그인 토큰과 여행 기록을 삭제하지 않음. 저장소 접근 실패는 인증 복원을 막지 않고 다음 시작에 재시도.
- `scripts/release-artifact-checks.mjs`, `tests/release/artifacts.test.mjs`: 개발용 DB 코드 UI·상수와 서버 비밀 변수 이름이 웹 배포 청크에 포함되면 검사 실패.
- `tests/web/workspace.spec.ts`: 이전 저장 항목 정리, 로그인 토큰 유지, 사용자 화면에서 개발용 정보 제거, 프로필 편집 유지 회귀 검사 추가.
- `docs/DB_DICTIONARY.txt`: 로컬 객체 폐기 명세 갱신. 서버 DB 테이블·컬럼 변경 없음.
- `apps/mobile/public/release.json`: 웹 식별자를 `test-1-profile-cleanup`으로 변경.

검증: `npm run check` 전체 통과, `npm run test:release` 20/20 통과, `npm run test:workspace:web` 9/9 통과. 웹 번들에서 이전 고정 코드와 내장 솔트가 제외되고 현재 공개 API 주소가 포함되는 것을 확인했다. 실제 MVP 공개 설정으로 Android Hermes 번들도 생성했다. 기존 Git 이력과 이미 만들어진 APK 자체를 변경한 것은 아니며, Android 설치 앱에는 최신 소스로 새 APK를 빌드해 설치해야 반영된다.

배포 대상은 기존 스테이징 웹 https://wherego-staging.pages.dev 이다. API·D1·R2 구성은 변경하지 않는다. 공개 배포 파일 해시와 실제 브라우저 마이페이지 확인 결과는 `.release/profile-cleanup/verification.json`에 기록한다. 화면 갤러리도 수정된 UI로 갱신한다.
