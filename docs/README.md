# TripPrint 현행 문서

기준일: 2026-10-16. 같은 주제의 현행 파일만 갱신합니다. 현재 작업은 Google Play 내부 테스트용 빌드 생성 전까지이며 최종 기기 테스트는 새 설치본에서 진행합니다.

## 먼저 읽을 문서

- [현재 개발·검수 상태](CURRENT_STATUS.txt)
- [화면 피드백과 날짜·상태·동선 계약](SCREEN_REVIEW.txt)
- [현재 상세 화면·CTA·빈 일정 개편](HARU_WORKSPACE_REFACTOR_20261016.txt)
- [최신 화면별 상세기능정의서 v3 원본](<2. planning/TripPrint_화면별_상세기능정의서_v3_20261014.docx>)
- [고객 여행 기록 완주 점검·개선 요청](qa/CUSTOMER_JOURNEY_REVIEW.txt)
- [실제 서버 등록·저장·재로그인 검증](qa/STAGING_CUSTOMER_JOURNEY.txt)
- [오사카 여행계획 등록·공유 검증](qa/COMMUNITY_PLAN_PUBLISH.txt)
- [Google 장소 썸네일·무료 한도 검증](qa/GOOGLE_PLACE_PHOTOS.txt)
- [빌드 직전 인계](PLAY_INTERNAL_PREBUILD.txt)
- [Play 내부 테스트 기기 검수표](qa/DEVICE_ACCEPTANCE.txt)
- [문서 정리 결과](DOCUMENT_CLEANUP.txt)

사용자 확정 사항과 화면 보완 계약을 먼저 적용합니다. 원본 기능정의서의 보완 전 요구를 현재 구현 완료 여부로 해석하지 않습니다. 과거 검수 캡처는 촬영 당시 참고 자료입니다.

## 계약과 운영

- [DB·도메인 객체 사전](DB_DICTIONARY.txt)
- [API 계약](planning/API_CONTRACT.md), [현재 앱 서버 계약](planning/APP_SERVER_API.md)
- [개발 환경](DEVELOPMENT_SETUP.md), [배포 절차](DEPLOYMENT.md)
- [GitHub Android 빌드](ANDROID_GITHUB_BUILD.md), [Google Play 내부 테스트](GOOGLE_PLAY_INTERNAL_TEST.md)
- [인증·온보딩](AUTH_ONBOARDING.md), [소셜 인증 설정](SOCIAL_AUTH_SETUP.md)
- [서비스 연결](APP_SERVICES_SETUP.md), [지도 설정](GOOGLE_MAPS_SETUP.md)
- [오류 코드](ERROR_CODE_SPEC.md), [권한 안내](APP_PERMISSIONS_20261013.txt)

## 기획과 디자인

- [기획 문서 안내](planning/README.md), [제품 PRD](0.PRD/TripPrint_신사업계획서_및_PRD.md)
- [전략 기획](전략기획서/README.md)
- [현재 디자인 시스템](design/DESIGN.md), [앱에서 참조하는 디자인 토큰](design/design-tokens.json)
- [화면 헤더 규격과 큰 글자 검수](design/SCREEN_HEADER_SPEC.md)
- [홈·온보딩 보완 명세](1.uiux/HOME_ONBOARDING_SCREEN_SPEC.md), [일정 명세](1.uiux/ITINERARY_SCHEDULE_SCREEN_SPEC.md)
- [기준 캡처 목록](1.uiux/SCREENSHOT_INDEX.txt), [캡처 메타데이터](1.uiux/SCREENSHOT_MANIFEST.json)
- [사진·자료 출처](RESOURCE_CREDITS.txt)

앱이 직접 읽는 디자인 JSON, 기능정의서 원본, 출처·이용 조건, 서로 다른 화면 상태의 기준 이미지는 유지합니다. 바이트가 같은 이미지 사본은 한 파일로 통합하며 캡처 목록에서 같은 파일을 참조합니다. 보안 키 폴더는 일반 문서 목록과 정리 대상에 포함하지 않습니다.

2026-10-16 헤더 개편으로 오래된 웹 캡처 154장은 현재 검수 캡처로 교체했습니다. 현재 이미지와 보존한 Android 참고 자료는 캡처 목록에서 구분하며, [이미지 삭제 내역](1.uiux/IMAGE_CLEANUP_LOG.txt)을 함께 남깁니다.
