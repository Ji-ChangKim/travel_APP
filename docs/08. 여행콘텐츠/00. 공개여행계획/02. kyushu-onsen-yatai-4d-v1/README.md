# 북큐슈 초겨울 온천·야타이 추천 일정

작성 기준일: 2026-10-20. 사용자 제공 원안은 original.txt에 보존했다. CSV와 candidate.json은 등록 자료이고, 실제 DB 등록 결과는 registration.json과 최종 검수 기록에서 확인한다.

- 등록 위치: 홈의 공개 일정 카드와 발자국 공개 목록. 같은 게시물 ID를 사용한다.
- 게시자: 가이드 하루. 회원 ID는 현행 UUID 계약을 따른다. 요청한 1번은 별도 게시자 관리번호이며 실제 user.id=1을 뜻하지 않는다.
- 기간: 2026-12-10~12-13, Asia/Tokyo, 4DAY. 날짜는 추천 예시이며 예약된 항공편을 뜻하지 않는다.
- 구성: DAY별 6·6·7·4개, 총23개 항목. 야타이·실내 주점과 야경·박물관의 선택 관계를 포함하므로 23곳을 모두 순서대로 방문하는 코스가 아니다.
- 공개: kind=plan, includeCosts=false. 개인 여행의 완료 상태를 바꾸지 않는다.
- 표지: 사용자가 제공한 cover.png. 사진의 온천 이름을 우레시노 등 특정 장소로 단정하지 않는다.

trips.csv·days.csv·schedules.csv·sources.csv·photos.csv는 앞서 만든 가이드의 열 순서를 따른다. 쉼표가 인용되지 않았던 출처 메모4건을 복구했다. schedules의 열 순서와 sources의 필드 이름을 맞췄고, 사진 설명문을 데이터 행으로 취급하지 않았다. 원안의 API 예시에 빠져 있던 schedule.save의 id는 등록 담당이 생성한다.

## 원안에서 보완한 내용

| 항목                          | 원안                   | 보완                                                         | 확인 근거                                                                                |
| ----------------------------- | ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 데지마 일반 입장료            | 520엔                  | 1,100엔                                                      | https://nagasakidejima.jp/                                                               |
| 구라바엔 일반 입장료          | 620엔                  | 1,300엔                                                      | https://glover-garden.jp/guide/                                                          |
| 이나사야마 로프웨이 일반 왕복 | 1,250엔                | 1,900엔                                                      | https://inasayama.info/260401_kaitei/                                                    |
| 우레시노 숙박 입욕세          | 150엔                  | 250엔                                                        | https://www.city.ureshino.lg.jp/site/_19427.html?blockId=935655&classId=9&dbMode=article |
| 박물관 대체 방문              | 17:30부터90분          | 16:00부터90분, 오후에 대체 결정                              | https://www.nmhc.jp/guide/                                                               |
| 귀국일 시장 점심              | 일요일 야나기바시 시장 | 하카타역 식당가, 다른 요일에는 영업 점포 확인 후 시장 선택   | https://www.jrhakatacity.com/gourmet/                                                    |
| 귀국일 주류 매장              | 일요일 휴무인 본점     | 같은 브랜드 하카타역점                                       | https://sumiyoshi-sake.jp/company-info/                                                  |
| 한국 입국 주류 한도           | 2병·2L·400달러         | 병 수 제한 삭제, 합계2L·400달러                              | https://m.customs.go.kr/tms/html/mos/psnr/MOS4001004S.do                                 |
| 주류 기내 반입                | 모두 불가              | 용기·도수·구매 장소·항공사·보안 규정에 따라 확인             | https://www.fukuoka-airport.jp/                                                          |
| 국제선 공항 이동              | 총15분·20분            | 총시간 확정값 제거, 연결버스·대기·항공사 마감 시간 별도 고려 | https://www.fukuoka-airport.jp/flight/transit/index.html?intDom=dom                      |
| 열차명                        | 릴리 카모메            | 릴레이 카모메                                                | https://www.jrkyushu.co.jp/korean/railpass/railpass.html                                 |

원안에 적힌 모든 verified를 독립 검증 완료로 바꾸지 않았다. sources.csv의 verified는 해당 메모 범위만 확인했다는 뜻이다. author_claimed는 원안 작성자의 확인 주장으로 남겼다. 특정 미래 열차·행사·식당의 영업과 실제 예약, 좌표는 확정하지 않았다. 상세 변경값은 corrections.json에서 대조할 수 있다.

## 등록 상태와 재확인

validation.json은 실제 저장·공개 스키마와 변환 모델을 실행한 로컬 결과다. candidate.json에 있는 UUID는 이 검증에서 만든 값이며 서버 DAY ID로 교체해야 한다. 실제 등록이 끝나면 registration.json에 서버 여행·게시물 ID와 독립 재조회 결과를 남긴다.

사용자 명시 승인 후 현재 앱이 연결된 staging 서버에 계정·여행·공개 게시물과 첨부 썸네일을 등록했다. 서버 여행 ID는 `930ee12c-fc87-49b5-a5f7-72a626049f70`, 게시물 ID는 `dac90238-8825-4359-93b1-bd43c946f757`이다. 회원 ID는 `64ee1a3b-504f-46cb-b762-24c3e9fb4ebf`이며 관리번호1은 로컬 게시자 메타데이터로 기록했다. `user.id=1` 또는 DB에 관리번호 컬럼을 추가한 것은 아니다.

비인증 공개 재조회에서 DAY별 주제·23개 제목·주소·시각·설명·선택지와 표지 픽셀이 등록 원문과 일치했다. 홈 조회의 첫3개에 포함되며 북큐슈 검색에도 한 번 나타난다. 새 발자국 화면 코드는 로컬 앱에서 검수했고, 설치된 앱에는 새 빌드가 필요하다. 원격 웹 배포·AAB 생성·Git 커밋·푸시는 실행하지 않았다.
