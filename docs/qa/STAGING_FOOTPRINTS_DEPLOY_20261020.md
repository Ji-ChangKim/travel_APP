# 발자국 검색창·GNB staging 배포 확인

배포·검수일: 2026-10-20. 사용자의 staging 배포 요청에 따라 검증한 웹 산출물을 기존 `tripprint-staging` Pages 프로젝트에 배포했다.

## 결과

실제 주소 https://tripprint-staging.pages.dev/footprints 에서 상단 독립 검색창이 삭제되고, 비로그인 상태에도 홈·내 여행·여행 만들기·발자국·MY 다섯 메뉴가 같은 순서로 표시되는 것을 확인했다. 조건 칩과 공유 안내는 유지됐다. 새로고침 후에도 동일하며 실제 북큐슈 일정과 업로드한 온천 표지가 정상 조회됐다.

## 배포 대상과 입력

| 항목              | 값                                                                 |
| ----------------- | ------------------------------------------------------------------ |
| Pages 프로젝트    | `tripprint-staging`                                                |
| 기본 주소         | `https://tripprint-staging.pages.dev`                              |
| 기본 배포 분기    | `main`                                                             |
| 새 배포 ID        | `06e101c0-1d83-495a-953d-9bc2bffa2fe2`                             |
| 새 배포 고유 주소 | `https://06e101c0.tripprint-staging.pages.dev`                     |
| 이전 배포 ID      | `fcb010c9-d6a3-4f3a-a0d7-ef8170074356`                             |
| 실제 API          | `https://tripprint-api-staging.gametps.workers.dev`                |
| 업로드 디렉터리   | `apps/mobile/.release/staging-footprints-20261020`                 |
| 소스 해시         | `350199ba8d079c8bec5c8e8978362ebe5c12a72c1352e614a4eaeaa6f1798c81` |
| 정적 산출물 해시  | `67bb69135dddb878042f24216997ebe2702959fc10756aa811d0461aee90c7f3` |

Cloudflare 메타데이터의 `Production`은 staging 프로젝트의 기본 분기 배포를 뜻한다. 별도의 운영 프로젝트를 배포하지 않았다. 현재 작업 폴더의 수정 사항을 포함해 직접 업로드했으며 Git 커밋·푸시나 병합을 실행하지 않았다.

실제 staging 공개 환경 파일로 새 웹 번들을 만들었다. 직전 로컬 검수 번들은 검수 서버 주소가 포함돼 업로드에 사용하지 않았다. 소스565파일의 빌드 전후·배포 후 해시가 일치했다. 정적 파일98개에서 필수 진입점·404·보안 헤더·동적 주소 rewrite를 확인하고 검수 설정·서버 비밀 식별자·서명 파일·환경 파일이 포함되지 않았는지 검사했다. 실제 배포된 엔트리 JavaScript의 내용 해시도 업로드 후보와 일치했다.

## 실제 웹 검수

응답 대체와 로컬 프록시 없이 Chrome으로 staging 기본 주소를 직접 열어3/3건 통과했다. 브라우저는 비로그인 상태이며 새 배포 고유 주소가 아니라 사용자가 접속하는 기본 서비스 주소를 기준으로 했다.

- 너비320·390·430에서 독립 검색 입력과 실행 버튼이 없고 다섯 메뉴가 화면 안에 표시됐다. 발자국 선택 표시와 순서도 확인했다.
- 실제 API의 공개 일정·표지 URL 조회가200으로 응답했다. 북큐슈 카드의 가이드 하루와 실제 온천 표지 로딩을 확인했다.
- 새로고침 후 검색창 삭제·다섯 메뉴가 유지됐다. 실제 JavaScript를 다운로드해 업로드 산출물과 해시를 대조했다.
- 내 여행 클릭은 `/login?next=plans`, MY 클릭은 기존 `/login`으로 이동했다. 메뉴 표시 때문에 비공개 데이터를 공개하지 않았다.
- 기존 북큐슈 공개 상세 `/community/dac90238-8825-4359-93b1-bd43c946f757`의 직접 접근과 새로고침 후 DAY1 표시가 유지됐다.

실제 캡처320·390·430을 열어 검토했다. 기본 글꼴에서 다섯 메뉴가 모두 보이며320에서는 조건 칩의 가로 스크롤과 공유 안내 줄바꿈이 유지된다. 이번에는 글꼴·브랜드·카드 보조 정보까지 원본 시안과 완전히 같다고 판정하지 않는다. 큰 글꼴·빈 목록·오류 상태의 직전 로컬 검수7/7과 코드 검사 통과 근거는 `FOOTPRINTS_NAVIGATION_FIX_20261020.md`에 있다. 이번 배포에서 제품 소스를 추가 변경하지 않았다.

## 기록

| 기록                              | 위치                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| 배포 로그                         | `outputs/staging-footprints-20261020/deploy.log`                                        |
| 배포 전후 메타데이터              | `outputs/staging-footprints-20261020/deployments-before.json`, `deployments-after.json` |
| 산출물 검사·파일별 해시           | `outputs/staging-footprints-20261020/artifact-manifest.json`                            |
| 소스 해시                         | `outputs/staging-footprints-20261020/source-before.json`, `source-after.json`           |
| 실제 웹 검사 결과                 | `outputs/staging-footprints-20261020/live-results.json`, `live-browser.log`             |
| 실제 응답 상태·배포 스크립트 일치 | `outputs/staging-footprints-20261020/live-evidence.json`                                |
| 실제 화면390                      | `outputs/staging-footprints-20261020/live-390.png`                                      |
| 실제 화면320·430                  | `outputs/staging-footprints-20261020/live-320.png`, `live-430.png`                      |
| 공개 상세 새로고침                | `outputs/staging-footprints-20261020/public-plan-reload.png`                            |

화면·소스 기준은 `docs/design/DESIGN.md`, `design-tokens.json`, `SCREEN_HEADER_SPEC.md`, `FOOTPRINTS_PUBLIC_FEED_SPEC.md`의 최신 지시를 따랐다. Cloudflare Pages의 기존 main 분기 직접 업로드 절차와 설치된 Wrangler4.146.0 명령 도움말을 확인했다. 공식 명령 문서: https://developers.cloudflare.com/workers/wrangler/commands/pages/ .

이번 작업은 staging 웹 배포와 공개 조회 검수다. API Worker 배포·DB 쓰기·신규 계정 생성·키 변경·기존 게시물 변경·Android/iOS 빌드는 실행하지 않았다. Android 설치본은 이번 웹 배포로 갱신되지 않는다.
