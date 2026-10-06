# WHEREGO MVP 구현 보고

2026-10-06 사용자 요구: 로그인 → 여행 등록 → 친구와 공유 → 지도·일정·사진·비용 기록 → 종료 후 발자국 → 여행 커뮤니티.

## 구현 범위

| 요구                  | 구현과 확인 방법                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인                | 기존 Google·카카오·Apple OAuth에 이메일 회원가입/비밀번호 로그인을 추가. 이메일 확인 대기는 실제 로그인과 구분. AuthBridge로 세션 복원·계정별 캐시 분리.                                       |
| 여행 등록             | 기존 제목·국가·도시·기간·항공편 등록 및 DAY 생성 사용. 출국 항공편은 여행 생성에서 등록하고 귀국 항공·이동·숙소·맛집·관광 일정은 일정 추가에서 기록. 항공권 예약·실시간 운항 조회 기능은 없음. |
| 친구 공유             | 기존 서버 초대 링크·편집자/뷰어·역할 변경·제거·만료·초대 취소 흐름 유지. 로그인 전 초대를 보관하고 인증 후 확인 참여.                                                                          |
| 일정과 금액·음식 사진 | 일정별 직접 사진 촬영 버튼 추가. 기존 날짜별 일정·비공개 사진·지출·영수증 흐름 유지. 영수증 인식 초안을 확인 저장하면 일정·실제 비용에 연결. OCR 미설정 시 사진을 보며 직접 입력.              |
| Google Maps           | 기존 Places 검색·장소 ID 연결·Google Maps 열기에 공유 장소 가져오기 추가. 지도 내부의 임베디드 지도·경로 최적화 기능은 현재 없음.                                                              |
| 발자국                | 완료된 여행의 날짜별 일정·음식 구매 기록·연결 사진·실제 비용·공통 비용·미연결 사진을 새 다이어리에서 읽기. 원본에 자동으로 공개 권한을 부여하지 않음.                                          |
| 커뮤니티              | 기존 종료 여행의 제목·본문·사용자가 선택한 일정·사진·비용 게시, 피드·신고·차단·게시 철회 사용. 영수증 원본과 개인 메모는 공개하지 않음.                                                        |
| Google 즐겨찾기 공유  | Android 텍스트 공유 수신과 모든 플랫폼 링크 붙여넣기 → 로그인 → 여행 선택/생성 → 후보 확인 → 일정 저장. 목록 전체 동기화는 아래 별도 기획 항목.                                                |

## 변경한 파일과 동작

- `apps/mobile/src/features/auth/EmailAuth.tsx`, `email.ts`, `services/authService.ts`, `app/login.tsx`: 이메일 입력·가입 검증·확인 대기·실패 재시도·실제 SDK 인증. 모달 종료 후 비밀번호 입력은 해제하며 작은 화면에서도 로그인 화면을 스크롤할 수 있다.
- `apps/mobile/src/app/index.tsx`: 웹 여행 허브 새로고침·앱 재실행 시 SDK 세션 복원을 기다린 뒤 여행 허브 또는 로그인으로 이동. 로그인된 사용자도 무조건 로그인 화면으로 보내던 시작 경로를 수정했다.
- `packages/validation/src/mapsShare.ts`, `apps/api/src/mapsShare.ts`, `apps/api/src/app.ts`: 공유문에서 링크 하나 추출, Google 주소 허용 목록, 단축 주소 HEAD 해석, 인증 필수 API. 사용자 JWT·쿠키·API 키를 외부 링크에 전달하지 않는다.
- `features/workspace/mapsShare.ts`, `ImportPlaceScreen.tsx`, `SharedPlaceInput.tsx`, `PlaceSearch.tsx`, `PlanEditor.tsx`, `forms.ts`, `WorkspaceScreen.tsx`, `useSharedSchedule.ts`, `app/import-place.tsx`: 로그인 동안 공유 후보 보관, 여행 선택·생성·날짜별 일정 확인. 임시 공유 원문은 일정 저장 계약에서 제외한다. 해제된 화면의 복원 결과를 무시하며 인증 복귀 시 가져오기 화면을 중복 쌓지 않는다. 일정 카드에서 사진 촬영을 해당 일정에 연결한다.
- `app/+native-intent.tsx`, `app/auth/callback.tsx`, 양쪽 `app.config.ts`: Android Google Maps 공유 시트와 인증 복귀 경로 연결. 새 앱 바이너리 빌드가 필요하다. 기존 설치 APK에 JavaScript만 갱신해도 공유 대상으로 표시되지 않는다.
- `features/workspace/DiaryScreen.tsx`, `diary.ts`, `FootprintsScreen.tsx`, `app/diary/[id].tsx`: 종료 여행의 비공개 다이어리. 통화별 합계를 정수 센트로 계산하며 실제 비용만 포함한다.
- `apps/mobile/public/_redirects`, `scripts/preview-trail.mjs`: 다이어리 UUID 직접 접근·새로고침 지원.
- 루트 `package.json`: `npm start`, `npm run android/ios/web`가 현재 MVP가 있는 `apps/mobile`을 실행하도록 정리. 이전 `src` 화면으로 진입하는 혼선을 제거했다.
- `tests/auth`, `apps/api/test/maps-share.test.ts`, `tests/web/workspace.spec.ts`: 이메일 검증·실제 SDK 요청·세션 복원·공유 링크 접근 경계·단축 주소 순환·일정 확인 저장·다이어리 합계·직접 재조회 검증.
- `docs/DB_DICTIONARY.txt`: 이메일 입력·공유 후보·임시 상태·다이어리 조회 객체 명세 추가. 기존 테이블·마이그레이션 변경 없음.

## Google 북마크 후속 기획

MVP는 **저장 목록에서 장소 하나를 공유해 일정으로 가져오기**를 제공한다. Google 로그인만으로 개인 Google Maps 저장 목록 전체를 읽을 수 있다고 가정하지 않는다. 단축 URL 형식은 공급자 변경·기기별 공유 방식에 따라 해석되지 않을 수 있으므로 장소 이름 검색과 직접 입력을 함께 제공한다. [Maps URLs 공식 문서](https://developers.google.com/maps/documentation/urls/get-started).

전체 목록 연동을 진행할 때는 실제 공개 목록 링크의 지원 여부, 장소 선택/중복 처리, 여행 날짜 배치, 수정 시 동기화 기준, 사용자 동의와 Google 제공 인터페이스를 먼저 확인한다. iOS 공유 확장과 대량 가져오기는 별도 실기기 검증 후 확장한다. Expo의 현재 수신 기능은 experimental이며 iOS 확장은 이번 Android MVP에서 활성화하지 않았다. [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/).

## 실행과 실서비스 연결

```powershell
npm start
npm run web
npm run api:dev
```

실제 로그인·서버 저장에는 `apps/mobile/.env`의 Supabase 공개 URL/공개 키/API URL과 적용된 Supabase 마이그레이션, Worker 구성이 필요하다. 이메일 로그인은 Supabase Email provider를 활성화하고 확인 메일 발송 설정을 준비한다. 확인 설정이 활성화된 가입 응답은 `session=null`일 수 있으며 사용자에게 이메일 확인 후 로그인을 안내한다. [Supabase 이메일 인증](https://supabase.com/docs/guides/auth/passwords), [가입 응답](https://supabase.com/docs/reference/javascript/auth-signup).

사용자가 기존 저장소 경로 `J:\개인 프로젝트\App\travel_APP`를 지정했다. 이 경로에서 개발·검증을 수행했다. Supabase/Google Cloud 클라우드 프로젝트 연결값은 아직 전달되지 않았다. 기존 로컬 설정이 없는 것을 확인하고 예제에서 `apps/mobile/.env`, `apps/api/.dev.vars`를 준비했다. 두 파일은 Git에서 제외되며 다시 확인한 현재 값도 예제·빈 값이다. 실제 프로젝트 값으로 교체해야 실서비스 인증·지도 검색·자동 영수증 인식이 작동한다.

지도 검색에는 Worker의 `GOOGLE_PLACES_API_KEY`, 자동 영수증 인식에는 `GOOGLE_VISION_API_KEY`를 연결한다. 단순 공유 URL 후보 확인에는 Google API 키가 필요하지 않지만 이후 이름 검색·장소 상세 조회에는 Places 키가 필요하다. 관리자 키·비밀번호·서버 비밀 키를 앱 공개 설정과 Git에 넣지 않는다.

[실서비스 연결 절차](APP_SERVICES_SETUP.md)와 [Android APK 빌드](MVP_ANDROID_BUILD.md)를 따른다. 실제 외부 계정 설정, 운영 배포, 제공자 인증·실제 OCR 정확도·Android 공유 시트 실기기 인수·Play Store 제출은 코드/HTTP fixture 검증과 별도다.

## 검증 결과

- `npm run check`: TypeScript 엄격 검사·ESLint 경고 0·Prettier 통과.
- `npm run test:auth`: 16/16 통과. 인증 설정·입력 검증·콜백·공유 수신·다이어리 비용 계산 확인.
- `npm run test:foundation`: 52/52 통과. API·실제 SQL 마이그레이션·권한·영수증·커뮤니티·공유 링크 접근 경계 확인.
- `npm run test:release`: 12/12 통과. 설정과 Android 네이티브 의존성 연결 확인.
- `npm run test:workspace:web`: 8/8 통과. 가입 확인 대기·이메일 로그인 실패/재시도·새로고침 세션 복원·지도 공유부터 새 여행/일정 저장·영수증/다이어리/커뮤니티·항공편·초대 뷰어 권한을 실제 Chrome UI와 격리된 HTTP fixture로 확인. 테스트 후 일반 웹 export를 복원한다.
- `npm run api:build`: staging dry-run 번들 통과. 원격 배포하지 않았다.
- `npm run mvp:bundle:android`: Android Hermes export 통과. APK 생성·기기 설치 증거가 아니다.

Windows 샌드박스의 로컬 소켓·네이티브 모듈 경로 조회 제한 때문에 브라우저/네이티브 연결 검증은 승인된 일반 실행에서 수행했다. Android export와 Wrangler 로그는 프로젝트 내부 임시 경로를 사용했다. 실제 프로젝트 값 연결과 실기기 인수는 아직 수행하지 않았다.
