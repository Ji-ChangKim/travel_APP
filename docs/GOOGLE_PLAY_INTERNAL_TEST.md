# TripPrint Google 로그인과 내부 테스트

기준일: 2026-10-20. 개발 측은 로그인·인증 복귀 구현과 빌드 전 검사를 준비했습니다. 사용자가 직접 빌드한 뒤 Play 내부 테스트에서 게스트·Google 로그인을 확인합니다. 실제 Google 성공 로그인이나 새 설치본 검수를 완료한 상태로 표시하지 않습니다.

**설정과 실행 순서는 [내부 테스트 AAB 빌드 안내](ANDROID_GITHUB_BUILD.md)를 따릅니다.** 기본 경로는 GitHub Actions의 `Android Play Internal`에서 `main`·`aab`·`submit_play=false`·`draft`로 파일을 만든 뒤 Play Console에 직접 업로드하는 방식입니다. 현재 `versionCode=9`이며 이미 사용한 번호라면 `ver.text`를 수정하고 푸시해야 합니다.

## 인증 연결 기준

| 구분                   | 값                                                                           |
| ---------------------- | ---------------------------------------------------------------------------- |
| Android 패키지         | `com.tripprint.app`                                                          |
| API                    | `https://tripprint-api-staging.gametps.workers.dev`                          |
| Google OAuth 서버 콜백 | `https://tripprint-api-staging.gametps.workers.dev/api/auth/callback/google` |
| 웹 복귀                | `https://tripprint-staging.pages.dev/auth/callback`                          |
| Android 앱 복귀        | `travelapp://auth/callback`                                                  |

Google 서버 콜백과 앱 복귀 주소는 역할이 다릅니다. `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`·`AUTH_SECRET`은 서버 인증 설정에서 유지하며 서버 Secret 원문을 앱에 넣지 않습니다. Stitch MCP 키도 앱 배포 설정과 무관합니다.

OAuth 앱이 테스트 상태이면 로그인할 계정을 Google OAuth 테스트 사용자에 등록합니다. Play 내부 테스터 목록과는 별개입니다. 서버의 Google 사용 가능 표시·PKCE·state·일회용 교환 검사만으로 실제 사용자 로그인 성공을 판단하지 않습니다.

## 설치 후 확인

1. 게스트로 여행·일정을 만들고 앱 재실행 후 같은 기기 기록이 복원되는지 확인합니다.
2. 여행 만들기 또는 상세에서 Google 로그인을 진행하고 같은 목적과 여행 ID로 돌아오는지 확인합니다.
3. 신규 회원은 닉네임 등 필요한 프로필을 저장합니다. 생년월일은 선택이며 비워도 온보딩을 완료할 수 있어야 합니다. 기존 회원 정보는 유지합니다.
4. 회원 여행·DAY 소개·장소 설명·개인 메모를 저장하고 재로그인 후 서버에서 같은 내용을 확인합니다.
5. 선택 공개·미리보기·실제 링크를 비교하고 비공개 메모·영수증·인증 정보가 제외되는지 확인합니다.
6. 인증 취소·백그라운드 복귀·로그아웃·계정 전환에서 중복 처리나 이전 계정 정보 노출이 없는지 확인합니다.

게스트 여행은 기기에 남으며 Google 로그인만으로 서버에 자동 업로드되지 않습니다. 이전 기기 여행과 회원 여행을 구분하고, 같은 기기에서 게스트를 다시 선택하면 기존 기록을 이어갈 수 있어야 합니다.

현재 구현·검사와 남은 조건은 [보안 후속 보고](qa/SECURITY_P0_FOLLOWUP.txt), 설치본 결과는 [DEVICE_ACCEPTANCE.txt의 AUTH 항목](qa/DEVICE_ACCEPTANCE.txt)에 기록합니다. 비밀번호·토큰·인증 코드·키 원문은 검수 자료에 넣지 않습니다. AAB 생성과 Play 등록·실제 설치·인증 성공은 각각 확인합니다.
