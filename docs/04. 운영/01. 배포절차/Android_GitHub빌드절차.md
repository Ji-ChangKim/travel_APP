# Android GitHub 빌드 절차

이 문서는 Android 내부 테스트 및 출시용 AAB/APK 산출물을 생성하는 버전 관리·빌드 절차를 정의합니다.

---

## 1. 버전 번호 관리 (`ver.text`)

- 앱의 `versionCode`와 `versionName`은 저장소 루트의 `ver.text`를 단일 기준으로 읽습니다.
- 새 Android 빌드를 생성하기 전에 이미 업로드된 `versionCode`와 중복되지 않도록 `ver.text` 값을 갱신합니다.

---

## 2. 빌드 실행 및 산출물 확인

1. **사전 검사**:
   - `npm run check` 및 `npm run test:release`를 실행해 네이티브 설정, Gradle 연결, 리소스 경로에 오류가 없는지 확인합니다.
2. **GitHub Actions 워크플로 실행 (`.github/workflows/play-internal.yml`)**:
   - 대상 브랜치(`main`), 산출물 형식(`aab` 또는 `apk`), Play Console 자동 제출 여부(`submit_play`)를 지정해 실행합니다.
3. **로컬 산출물 경로**:
   - 로컬 Android 빌드 시 기본 산출물 위치는 `outputs/android/`이며 소스 트리와 분리해 관리합니다.
