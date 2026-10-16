# TripPrint 기획 문서 안내

현행 화면 요구는 [기능정의서 v3 원본](<../2. planning/TripPrint_화면별_상세기능정의서_v3_20261014.docx>)과 [2026-10-16 화면 보완](../SCREEN_REVIEW.txt)을 함께 읽습니다. 구현·검증·출시 상태는 [현재 상태](../CURRENT_STATUS.txt)에서 확인합니다.

- [API 계약](API_CONTRACT.md)와 [현재 앱 서버 계약](APP_SERVER_API.md)
- [저장 명세](DATA_STORAGE_SPEC.md)와 [최우선 DB·도메인 사전](../DB_DICTIONARY.txt)
- [정책 결정 자료](POLICY_DECISIONS.md): 미확정 정책은 승인·구현 완료로 해석하지 않습니다.
- [여행 생성 흐름](TRIP_CREATION_FLOW_20261015.md)
- [여행 표시·내비게이션·확인 창 정합성](TRIP_PRESENTATION_NAVIGATION_20261016.md)
- [상세 세 허브·CTA·빈 일정 개편](../HARU_WORKSPACE_REFACTOR_20261016.txt)
- [항공 조회 명세](FLIGHT_LOOKUP_SPEC.md), [KAC API 검토](KAC_FLIGHT_API_REVIEW.md), [실제 응답 분석](KAC_FLIGHT_LIVE_ANALYSIS.md)
- [발자국 콘텐츠](TRAIL_CONTENT_SPEC.md)
- [QA 기준](QA_ACCEPTANCE.md), [실제 기기 검수표](../qa/DEVICE_ACCEPTANCE.txt)
- [기획 절차](PLANNING_PROCESS.md)

같은 주제의 초기 MVP 화면/범위와 Word 사본은 제거했습니다. 서로 다른 목적의 현재 계약은 파일명이나 기준일이 다르다는 이유로 삭제하지 않습니다. 상충할 때는 사용자 확정 사항, 화면 보완, DB·API의 실제 계약을 우선합니다.
