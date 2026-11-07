# Android 개발 실행 안내

이 문서는 로컬 환경에서 Android 에뮬레이터 및 디버그 앱으로 TripPrint를 실행하고 점검하는 절차를 정의합니다.

---

## 1. 사전 요구사항

- **Node.js**: 22.13 이상(22 LTS, `.nvmrc` 22.17.0) 또는 24.3 이상, **npm**: `npm ci` 기준
- **Android Studio**: Android SDK 및 에뮬레이터(AVD) 설치, 최초 1회 TripPrint debug 빌드 설치

---

## 2. 실행 절차

1. **원클릭 통합 실행 (Windows)**:
   - 저장소 루트의 `start-android.cmd`를 실행하면 로컬 API 서버(`apps/api`), Expo 개발 서버(`apps/mobile`), Android 에뮬레이터를 순서대로 기동하고 앱을 엽니다.
2. **수동 개별 실행**:
   - 의존성 설치: `npm ci`
   - 로컬 API 서버 실행: `npm run api:dev`
   - 모바일·웹 개발 서버 실행: `npm start` 또는 `npm run web`
3. **코드 수정 후 필수 검사**:
   - `npm run check`: 디자인 토큰 명도 대비, 문서 링크, 리소스, 아키텍처·네비게이션 경계, TypeScript 타입, ESLint, Prettier 통합 검증
   - `npm run test:auth`: 인증·오류·멱등성·디자인 계약 단위 테스트 실행

## 3. 에뮬레이터에서 한글 입력

프로필과 도시 검색 등 모든 입력란에서 영문만 입력된다면 Gboard의 언어 등록부터 확인합니다. 앱 표시 언어와 키보드 입력 언어는 별도 설정입니다.

1. Android 설정에서 `System → Keyboard → On-screen keyboard → Gboard → Languages`를 엽니다. Android 버전에 따라 `Keyboard apps` 아래에 Gboard가 표시될 수 있습니다.
2. `Add keyboard → Korean(한국어) → 두벌식 → Done`으로 추가합니다. 기존 영문 키보드는 유지합니다.
3. PC 키보드 연결 시 화면 키보드가 숨겨지면 `Physical keyboard → Use on-screen keyboard`를 켭니다. 개발 에뮬레이터에서는 `show_ime_with_hard_keyboard=1`에 해당합니다.
4. 앱 입력란에서 지구본 또는 길게 누른 스페이스로 한국어를 선택합니다. 한국어의 물리 키보드 설정에서 Right Alt 전환을 사용하는 경우, PC 한/영 키와 에뮬레이터 내부 입력 전환을 구분합니다.
5. 화면 키보드에서 `ㅎ → 하 → 한`을 조합하고 삭제·중간 수정도 확인합니다. 붙여넣기로 완성형 한글이 보이는 것만으로 조합 입력 검사를 통과했다고 기록하지 않습니다.

한국어를 선택해도 입력이 사라지거나 글자가 보이지 않으면 입력값 보존과 글꼴 표시를 각각 재현합니다. 앱의 길이 검증을 없애거나 글꼴을 임의 교체해 문제를 피하지 않습니다.
