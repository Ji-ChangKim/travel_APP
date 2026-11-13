# @wherego/web

웹 개발 준비 버전 `0.0.1`이다. Next.js 16.4.6 App Router를 사용한다. React 19.2.3과 저장소의 Node.js 22.17.0·npm 11.5.2를 유지한다.

저장소 루트에서 실행한다.

```powershell
npm ci
npm run web:dev
```

`http://127.0.0.1:3000/health`에서 서버 실행을 확인한다. GET 응답은 `{"service":"tripprint-web","status":"ok"}`다. DB·API·로그인 상태를 검사하는 주소가 아니다. `/`는 여행과 기록을 소개하는 랜딩이다. `/home`은 화면·기능 설계 단계여서 아직 404로 응답한다.

```powershell
npm run check
npm run web:build
npm run test:web:dev
npm run test:web:runtime
npm run web:start
```

`web:start`는 먼저 만든 빌드를 실행한다. 자동 HTTP 검사는 임시 포트에서 서버를 실행하고 종료 후 포트 해제까지 확인한다. 개발·빌드 명령을 동시에 실행하지 않는다. 기존 `npm run web`·`build:web`은 계속 Expo 앱의 웹 미리보기·빌드를 가리킨다.

랜딩에는 소개 구간 이동·여행 장면 전환·움직임 제어·사진 출처가 있다. 서비스 홈·인증·DB 연결·배포 설정은 후속 범위다. 업무 기능을 추가할 때 앱과 같은 API·공통 계약을 사용하며 웹 게스트 계정을 만들지 않는다. 자세한 실행·복구 절차는 [웹 개발 실행 안내](<../../docs/03. 개발/03. 개발환경/웹_개발실행_안내.md>)를 따른다.
