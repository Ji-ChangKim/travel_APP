import {
  currentDay,
  currentPlace,
  currentTrip,
  initialDays,
  publicSnapshot,
  state,
  trips,
  tripPhase,
} from './model.mjs';
import {
  action,
  button,
  card,
  check,
  dateRange,
  dayIntro,
  days,
  escapeText,
  field,
  haru,
  icon,
  placeCard,
  placeFields,
  placePhoto,
  select,
  textarea,
  tripCard,
  tripTabs,
  tripTitle,
} from './components.mjs';

// 홈은 큰 표지를 반복하기보다 다음에 할 일 한 건을 먼저 제시한다.
function home() {
  // 대표 여행의 ID·날짜·다음 일정은 같은 원본을 읽는다.
  return `<section class="tight"><p class="meta">다음 여행을 준비해요</p><h2>오사카에서 보낼 나흘</h2></section><section class="card compact-trip"><img src="assets/osaka.jpg" alt="오사카 여행 표지"/><div><span class="tag soft">${tripPhase(trips[0])}</span><h3>${escapeText(trips[0].title)}</h3><p class="meta">${dateRange(trips[0])}</p></div></section><section class="next-brief"><p class="meta">다음 일정 · DAY 1 · 11월 10일 · 시간 미정</p><h2>하나마루켄</h2><p>난바에서 첫 식사를 시작해요.</p>${button('계획 계속하기', 'schedule', 'primary', 'data-trip="osaka-plan" data-place="p1"')}</section><div class="quick-grid"><button class="quick" data-go="flight">${icon('plane')}항공·예약 확인</button><button class="quick" data-go="create">${icon('plus')}새 여행 만들기</button></div><section class="stack"><h2>여행 준비에 도움이 돼요</h2><p>가고 싶은 장소를 살펴보고 여행 속도에 맞춰 골라보세요.</p>${button('오사카 도시 가이드', 'guide', 'quiet')}${button('다른 여행자의 계획 보기', 'discover', 'quiet')}</section>`;
}

// 전체 원본은 검색·상태별 건수·목록으로 관리한다.
function tripList() {
  // 각 필터는 동일한 날짜 판별 결과로 계산한다.
  const matches = trips.filter((trip) => {
    // 검색 결과가 없을 때 원본이 없는 상태와 구분한다.
    return (
      `${trip.title} ${trip.city} ${trip.country}`.includes(state.query) &&
      (state.tripFilter === '전체' || tripPhase(trip) === state.tripFilter)
    );
  });
  return `${field('내 여행 검색', 'tripQuery', state.query, 'search', 'placeholder="여행 이름·도시·나라"')}<div class="days" aria-label="여행 상태">${[
    '전체',
    '준비 중',
    '여행 예정',
    '여행 중',
    '여행 완료',
  ]
    .map((filter) => {
      // 필터의 선택 크기를 고정한다.
      return `<button data-filter="${filter}" aria-pressed="${state.tripFilter === filter}">${filter} ${
        trips.filter((trip) => {
          // 건수는 전체 원본 기준이며 검색 결과 수와 구분한다.
          return filter === '전체' || tripPhase(trip) === filter;
        }).length
      }</button>`;
    })
    .join('')}</div><p class="meta">검색 결과 ${matches.length}개</p>${
    matches.length
      ? matches
          .map((trip, index) => {
            // 첫 번째 보이는 카드에만 주요 행동을 둔다.
            return tripCard(trip, index === 0);
          })
          .join('')
      : card(
          '조건에 맞는 여행이 없어요',
          '<p>여행 이름이나 상태를 바꿔 찾아보세요.</p>',
          action('검색 조건 지우기', 'clearFilters'),
        )
  }`;
}

// 여행 만들기는 나라·도시·기간을 독립 선택으로 보여준다.
function create() {
  // 날짜 미정 생성은 현행 API가 지원한다고 약속하지 않는다.
  return `<div class="step-label"><span class="tag soft">1 / 2</span><p class="meta">여행의 기본 정보</p></div>${field('여행 이름', 'tripName', '오사카 3박 4일 여행', 'text', 'maxlength="50" required')}<div class="stack">${button(`나라 · ${state.country}`, 'country')}${button(`도시 · ${state.city || '선택 안 함'}`, 'city')}${button('기간 · 2026-11-10 – 2026-11-13', 'period')}${check('날짜는 나중에 정할게요', 'undated', state.undated)}</div>${state.undated ? card('날짜를 정하면 DAY 일정을 만들 수 있어요', '<p class="meta">여행지를 먼저 고르고 기간을 이어서 정해 주세요.</p>', button('기간 정하기', 'period', 'quiet')) : ''}${card('항공권은 나중에 추가해도 돼요', '<p class="meta">여행을 만든 뒤 장소와 예약을 차근차근 채워요.</p>')}`;
}

// 나라와 도시를 별도 화면에서 선택한다.
function country() {
  // 나라를 바꾸면 이전 도시 선택을 해제한다.
  return `${field('나라 검색', 'countryQuery', '', 'search', 'placeholder="나라 이름"')}<div class="option-list">${[
    '일본',
    '대한민국',
    '대만',
    '태국',
  ]
    .map((name) => {
      // 선택 결과는 만들기 화면의 여행지 상태로 복귀한다.
      return `<button class="option" data-country="${name}" aria-pressed="${state.country === name}">${name}${state.country === name ? '<span>선택됨</span>' : ''}</button>`;
    })
    .join('')}</div><p class="meta">나라를 바꾸면 도시를 다시 골라요.</p>`;
}

// 선택한 나라에 속하는 도시만 제공한다.
function city() {
  // 미지원 도시도 사용자가 직접 이름을 입력할 수 있게 한다.
  return `<p class="meta">${escapeText(state.country)}</p>${field('도시 검색 또는 직접 입력', 'cityName', state.city, 'search', 'placeholder="도시 이름"')}<div class="option-list">${(
    {
      일본: ['오사카', '도쿄', '후쿠오카', '와카야마'],
      대한민국: ['서울', '제주', '부산'],
      대만: ['타이베이'],
      태국: ['방콕'],
    }[state.country] || []
  )
    .map((name) => {
      // 나라 변경 전 도시를 계속 선택한 것처럼 표시하지 않는다.
      return `<button class="option" data-city="${name}" aria-pressed="${state.city === name}">${name}</button>`;
    })
    .join('')}</div>`;
}

// 기간 입력과 달력 선택을 같은 날짜 필드로 보여준다.
function period() {
  // 축소 확인 전에는 원본 DAY나 연결 기록을 지우지 않는다.
  return `<p>여행의 시작일과 마지막 날을 골라주세요.</p>${field('시작일', 'startDate', currentTrip().start || '2026-11-10', 'date')}${field('종료일', 'endDate', currentTrip().end || '2026-11-13', 'date')}${button('달력으로 선택', 'calendar', 'quiet')}${card('날짜에 맞춰 DAY를 나눠요', '<p class="meta">기간을 줄이면 빠지는 날짜의 일정·사진·지출을 먼저 확인해요.</p>')}`;
}

// 생성 확인은 항공권을 필수로 만들지 않는다.
function createReview() {
  // 확인 화면은 실제 생성 성공 화면과 구분한다.
  return `<span class="tag soft">2 / 2 · 내용 확인</span>${card('오사카 3박 4일 여행', '<p>일본 · 오사카</p><p class="meta">2026-11-10 – 2026-11-13 · 4일</p>')}<section class="stack"><h2>이제 장소를 정리해요</h2><p>DAY별로 가고 싶은 곳을 추가하고, 항공권이나 숙소는 필요할 때 입력해요.</p></section>${button('기본 정보 수정', 'create', 'quiet')}`;
}

// 선택한 날짜의 시간·순서·소개를 원본에서 읽는다.
function schedule() {
  // 여행 상세에서만 원본 관리 메뉴와 세 작업을 함께 유지한다.
  return `<p class="meta">${tripPhase(currentTrip())} · ${dateRange()}</p>${tripTabs('schedule')}${days()}${dayIntro()}<div class="spread"><h2>DAY ${state.day} 일정</h2>${button('순서 편집', 'reorder', 'quiet inline')}</div>${state.places
    .filter((place) => {
      // DAY ID에 대응하는 원본 장소만 읽는다.
      return place.day === state.day;
    })
    .map((place, index) => {
      // 개인 읽기 상세는 별도 추가 버튼을 갖지 않는다.
      return placeCard(place, index);
    })
    .join('')}`;
}

// 지도 정상 배치는 선택 핀·장소 카드·목록 복귀를 함께 보여준다.
function map() {
  // 배경은 도로 지도가 아닌 명시적인 위치 도식이며 Google 타일로 가장하지 않는다.
  const places = state.places.filter((place) => {
    // 핀과 카드는 현재 DAY의 원본만 읽는다.
    return place.day === state.day;
  });
  const selected =
    places.find((place) => {
      // 다른 DAY의 카드가 남지 않게 한다.
      return place.id === state.placeId;
    }) || places[0];
  return `${tripTabs('map')}${days()}<p class="meta">번호는 방문 순서예요. 연결선은 실제 이동 경로와 다를 수 있어요.</p><div class="map-layout" aria-label="선택 날짜의 장소 위치 도식"><svg class="route-diagram" viewBox="0 0 320 260" role="img" aria-label="장소의 상대 위치 도식"><path d="M48 65L260 65L260 195L48 195" stroke="#203247" stroke-width="2" fill="none" stroke-dasharray="6 5"/></svg>${places
    .map((place, index) => {
      // 핀은 터치 영역을 확보하고 선택 상태를 읽는다.
      return `<button class="map-pin" style="left:${15 + (index % 4) * 23}%;top:${index < 4 ? 26 : 74}%" data-pin="${place.id}" aria-pressed="${selected?.id === place.id}" aria-label="${index + 1}번 ${escapeText(place.name)} 선택">${index + 1}</button>`;
    })
    .join(
      '',
    )}</div>${selected ? card(selected.name, `<p class="meta">${escapeText(selected.area)}</p>`, button('장소 설명·팁', 'place', 'quiet', `data-place="${selected.id}"`)) : '<p>이날 등록한 장소가 없어요.</p>'}<div class="quick-grid">${state.role !== 'viewer' ? button('현재 위치', 'location') : ''}${button('장소 목록', 'schedule')}</div>`;
}

// 검색은 후보의 출처·주소를 확인한 뒤 추가로 연결한다.
function search() {
  // 예시 검색 결과라는 안내는 제품 밖 검토 도구에 유지한다.
  return `<p class="meta">${escapeText(currentTrip().city)} · DAY ${state.day}에 추가</p>${field('장소명 또는 주소', 'placeQuery', '', 'search', 'placeholder="장소명 또는 주소"')}<p class="meta">주소를 확인하고 여행에 추가해 주세요.</p>${card('오사카 성', `<div class="row">${placePhoto(state.places[8])}<p class="meta">일본 오사카시 주오구</p></div>`, button('장소 확인', 'candidate', '', 'data-place="p9"'))}${button('장소 직접 입력', 'editor', 'quiet')}${button('Google Maps 링크로 가져오기', 'import', 'quiet')}`;
}

// 공개 읽기·내 일정·검색 후보는 같은 내용과 다른 행동을 갖는다.
function place() {
  // 공개 읽기에는 개인 메모나 편집·추가를 표시하지 않는다.
  if (
    ['publicPlace', 'photoSource'].includes(state.screen) &&
    state.publicationWithdrawn
  )
    return card(
      '공개가 중단된 여행이에요',
      '<p>다른 여행자의 계획을 살펴보세요.</p>',
      button('다른 여행 찾기', 'discover'),
    );
  const item = ['publicPlace', 'photoSource'].includes(state.screen)
    ? publicSnapshot().places.find((place) => {
        // 공개 사본에 포함된 장소만 읽는다.
        return place.id === state.placeId;
      })
    : currentPlace();
  return item
    ? `<div class="place-detail-top" data-place-card="${item.id}">${placePhoto(item)}<div class="tight"><p class="meta">${escapeText(item.area)}</p><span class="tag soft">DAY ${item.day} · ${escapeText(item.time || '시간 미정')}</span></div></div>${item.choiceGroup ? card(item.choiceKind === 'backup' ? '대체 장소' : '선택 후보', `<p>${escapeText(item.choiceLabel || '후보 중 한 곳을 골라요')}</p>`) : ''}<section class="stack"><h2>장소 설명·방문 팁</h2><p class="meta">여행자가 적은 설명이에요. 방문 전 운영시간과 가격을 확인해 주세요.</p><p class="preserve">${escapeText(item.description)}</p>${item.tip ? `<h3>방문 팁</h3><p>${escapeText(item.tip)}</p>` : ''}</section>${['publicPlace', 'photoSource'].includes(state.screen) ? button('사진 정보', 'photoSource', 'quiet') : ''}${state.screen === 'place' ? card('개인 메모', `<p class="meta">${escapeText(item.memo || '아직 작성한 메모가 없어요.')}</p><p class="meta">커뮤니티에는 공개하지 않아요.</p>`) : ''}`
    : card(
        '이 장소는 공개되어 있지 않아요',
        '<p>공개된 일정 목록으로 돌아가 주세요.</p>',
        button('공개 일정 보기', 'public'),
      );
}

// 기존 일정 입력의 필드를 빠짐없이 유지한다.
function editor() {
  // 별도 팁 DB 필드 없이 계획 설명 안에 함께 작성한다.
  return `<p class="meta">${tripTitle()} · DAY ${state.day}</p>${select(
    'DAY',
    'day',
    [1, 2, 3, 4].map((day) => {
      // 저장 시 선택 DAY를 원본 일정과 함께 보존한다.
      return [String(day), `DAY ${day}`];
    }),
    String(state.day),
  )}${select(
    '일정 종류',
    'type',
    [
      ['PLACE', '장소'],
      ['TRANSPORT', '이동'],
      ['STAY', '숙소'],
      ['RESERVATION', '예약'],
      ['TODO', '할 일'],
      ['MEMO', '메모'],
    ],
    currentPlace().type,
  )}${field('방문 시각 · 선택', 'time', currentPlace().time, 'time')}${button('시간 선택', 'time', 'quiet')}${placeFields()}${button('지도에서 위치 확인', 'location')}${field('머무를 시간(분) · 선택', 'duration', currentPlace().duration, 'number', 'min="1" max="1440"')}${field('선택지 안내 · 선택', 'choiceLabel', currentPlace().choiceLabel || '')}${select(
    '후보 구분',
    'choiceKind',
    [
      ['', '일반 장소'],
      ['choice', '선택 후보'],
      ['backup', '대체 장소'],
    ],
    currentPlace().choiceKind,
  )}${select('추가 위치', 'position', ['이날 마지막', '현재 장소 다음'])}`;
}

// 하루 소개의 원본 필드를 별도 폼으로 편집한다.
function dayEditor() {
  // 소개를 비워도 장소 일정은 유지한다.
  return `<p class="meta">DAY ${state.day} · 선택한 날짜의 소개</p>${field('이날 제목 · 선택', 'dayTitle', currentDay().title, 'text', 'maxlength="200"')}${textarea('이날 소개 · 선택', 'dayIntro', currentDay().intro, 'maxlength="2000"')}<p class="meta">이날의 장소를 선택해 공유하면 이 소개도 함께 공개돼요.</p>`;
}

// 현재 위치를 강제하지 않고 수동 검색을 함께 제공한다.
function location() {
  // 이 시안에서 실제 권한 요청이나 GPS 조회를 실행하지 않는다.
  return `${field('장소명 또는 주소', 'addressQuery', currentPlace().address)}${button('주소로 장소 찾기', 'search')}${button('현재 위치로 찾기', 'locationReturn', 'quiet')}${card('선택한 장소', `<h3>${escapeText(currentPlace().name)}</h3><p class="meta">${escapeText(currentPlace().address)}</p>`)}<p class="meta">현재 위치를 사용하지 않고도 주소를 직접 정할 수 있어요.</p>`;
}

// 순서 변경은 명시적 이동 행동으로도 조작할 수 있다.
function reorder() {
  // 끌기만 요구하지 않아 키보드와 화면 읽기에서도 바꿀 수 있다.
  return `<p class="meta">DAY ${state.day} · 저장 전에는 원래 순서를 유지해요.</p>${state.places
    .filter((item) => {
      // 선택 날짜의 장소만 순서를 바꾼다.
      return item.day === state.day;
    })
    .map((item, index) => {
      // 번호·장소명·위아래 행동을 같은 카드에서 읽는다.
      return card(
        `${index + 1}. ${item.name}`,
        `<div class="row">${action('위로', 'moveUp', '', `data-place="${item.id}" ${index === 0 ? 'disabled' : ''}`)}${action('아래로', 'moveDown', '', `data-place="${item.id}"`)}</div>`,
      );
    })
    .join('')}`;
}

// 외부 지도 링크는 확인한 뒤 일반 일정 작성으로 이어진다.
function importPlace() {
  // 서버가 링크 내용을 자동 저장한 것처럼 표시하지 않는다.
  return `<p>Google Maps에서 복사한 장소 링크를 넣어주세요.</p>${field('장소 링크', 'mapsUrl', '', 'url', 'placeholder="https://maps.google.com/…"')}<p class="meta">이름과 주소를 확인한 뒤 DAY ${state.day}에 추가해요.</p>${button('링크 없이 직접 입력', 'editor', 'quiet')}`;
}

// 예약 목록은 항공 조회와 직접 입력을 모두 제공한다.
function flight() {
  // 숙소 입력을 일반 장소 설명 폼으로 잘못 연결하지 않는다.
  return `${card('가는 항공편', '<p class="meta">출발일은 항공권에서 확인해 주세요 · 각 공항 현지 시각</p><div class="flight-leg"><div><strong>ICN</strong><p>09:00</p></div><span aria-hidden="true">→</span><div><strong>KIX</strong><p>10:50</p></div></div>', button('항공권 수정', 'flightEditor', 'quiet'))}${button('항공편 조회', 'flightSearch')}${button('항공권 직접 입력', 'flightEditor', 'quiet')}${card('숙소', '<p class="meta">체크인과 주소를 일정에 함께 정리해요.</p>', button('숙소 일정 추가', 'stay'))}<p class="meta">예약번호와 개인 메모는 공유하지 않아요.</p>`;
}

// 항공편 조회 실패를 수동 입력의 막다른 길로 만들지 않는다.
function flightSearch() {
  // 예시 값은 실제 공급자 조회 결과로 표시하지 않는다.
  return `${field('항공편 번호', 'flightNumber', '', 'text', 'placeholder="항공권에 적힌 편명"')}${field('출발 날짜', 'flightDate', currentTrip().start || '2026-11-10', 'date')}${card('조회가 안 되는 항공편도 입력할 수 있어요', '<p class="meta">항공권에 적힌 공항과 현지 시각을 확인해 주세요.</p>', button('직접 입력', 'flightEditor', 'quiet'))}`;
}

// 출도착의 현지 날짜를 별도로 입력한다.
function flightEditor() {
  // 국제선 날짜 경계도 한 날짜 입력으로 합치지 않는다.
  return `${field('항공편 번호', 'flightNumber', 'KE721')}${field('출발 공항', 'origin', 'ICN · 인천')}${field('도착 공항', 'destination', 'KIX · 간사이')}${field('출발일', 'departDate', currentTrip().start || '2026-11-10', 'date')}${field('출발 시각', 'departTime', '09:00', 'time')}${field('도착일', 'arriveDate', currentTrip().start || '2026-11-10', 'date')}${field('도착 시각', 'arriveTime', '10:50', 'time')}<p class="meta">각 공항의 현지 날짜와 시각을 입력해 주세요.</p>${field('예약번호 · 선택', 'booking', '')}<p class="meta">예약번호는 커뮤니티에 공개하지 않아요.</p>`;
}

// 숙소는 STAY 일정의 주소·날짜·메모로 정리한다.
function stay() {
  // 현재 계약에 없는 숙박 예약 자동 연동을 약속하지 않는다.
  return `${field('숙소 이름', 'stayName', '', 'text', 'placeholder="예약한 숙소 이름"')}${field('주소', 'stayAddress', '')}${field('체크인 날짜', 'stayDate', currentTrip().start || '2026-11-10', 'date')}${field('체크인 시각 · 선택', 'stayTime', '15:00', 'time')}${textarea('개인 메모', 'stayMemo', '', 'placeholder="체크인 방법이나 예약 정보를 적어주세요"')}<p class="meta">숙소의 개인 메모와 예약 정보는 공유하지 않아요.</p>`;
}

// 통화별 합계와 실제·예상 분리를 유지한다.
function cost() {
  // 다른 통화는 환율이 없는 상태에서 더하지 않는다.
  return `${tripTabs('cost')}<div class="days">${['실제 지출', '예상 비용']
    .map((mode) => {
      // 선택은 로컬 예시 데이터의 목록을 실제로 바꾼다.
      return `<button data-cost="${mode}" aria-pressed="${state.costMode === mode}">${mode}</button>`;
    })
    .join(
      '',
    )}</div>${card(state.costMode, `<p class="money">JPY ${state.costMode === '실제 지출' ? '2,400' : '8,000'}</p><p class="meta">통화별 합계예요.</p>`)}<div class="quick-grid">${button('영수증 등록', 'capture')}${button('금액 직접 입력', 'expenseEditor')}</div><section class="stack"><h2>등록한 내역</h2>${card(state.costMode === '실제 지출' ? '점심 식사' : '테마파크 예산', `<p class="meta">DAY ${state.day} · ${state.costMode === '실제 지출' ? 'JPY 2,400 · 영수증' : 'JPY 8,000 · 직접 입력'}</p>`, button('내역 확인', 'expenseDetail', 'quiet'))}</section>`;
}

// 지출은 실제/예상·통화·연결 일정의 선택을 유지한다.
function expenseEditor() {
  // 달러도 현행 지원 통화 목록에서 누락하지 않는다.
  return `${field('지출 이름', 'expenseName', '점심 식사', 'text', 'maxlength="100" required')}${field('금액', 'amount', '2400', 'text', 'inputmode="decimal" required')}${select(
    '통화',
    'currency',
    [
      ['JPY', 'JPY · 일본 엔'],
      ['KRW', 'KRW · 한국 원'],
      ['USD', 'USD · 미국 달러'],
    ],
    'JPY',
  )}${select('비용 구분', 'actual', ['실제 지출', '예상 비용'], '실제 지출')}${select('분류', 'category', ['식비', '교통', '숙소', '활동', '쇼핑', '기타'])}${select(
    '연결할 일정',
    'expenseSchedule',
    [
      ['', '일정 없이 저장'],
      [currentPlace().id, `DAY ${state.day} · ${currentPlace().name}`],
    ],
  )}`;
}

// 상세에서 수정·삭제와 실제 연결 일정을 확인한다.
function expenseDetail() {
  // 지출 원본과 공개 비용 합계의 차이를 설명한다.
  return `${card('점심 식사', '<p class="money">JPY 2,400</p><p class="meta">실제 지출 · 식비 · 영수증 확인</p>')}${card('연결한 일정', `<p>DAY ${state.day} · ${escapeText(currentPlace().name)}</p>`, button('일정 보기', 'place', 'quiet'))}${button('영수증 원본 확인', 'receiptPhoto')}${button('지출 수정', 'expenseEditor', 'quiet')}`;
}

// 사진과 영수증은 공개 가능한 원본이 다르다.
function media() {
  // 영수증 원본은 일반 사진의 공유 선택에 넣지 않는다.
  return `${card('여행 사진', '<img class="hero" src="assets/osaka.jpg" alt="오사카 여행 사진"/><p class="meta">일반 사진은 직접 선택해 공유할 수 있어요.</p>', button('사진 보기', 'photo', 'quiet'))}${card('영수증', '<p>점심 식사 · JPY 2,400</p><p class="meta">영수증 원본과 품목은 공개하지 않아요.</p>', button('영수증 확인', 'receipt', 'quiet'))}${button('영수증 등록', 'capture')}`;
}

// 카메라와 앨범을 선택한 뒤 확인 단계로 이어진다.
function capture() {
  // 웹 시안에서 카메라가 촬영한 것처럼 가짜 영상은 만들지 않는다.
  return `${haru('empty')}<section class="stack"><h2>영수증을 기록해요</h2><p>상호·날짜·총액이 잘 보이도록 사진을 준비해 주세요.</p>${button('촬영·앨범에서 선택', 'photoMethod')}${button('금액 직접 입력', 'expenseEditor', 'quiet')}</section>`;
}

// 원본 사진·추출 초안·품목 합계·확정 지출을 구분한다.
function receipt() {
  // OCR 초안을 확정 전 비용 합계에 넣지 않는다.
  return `<p>사진과 금액을 확인한 뒤 저장해 주세요.</p>${button('영수증 원본 확대', 'receiptPhoto')}${field('상호', 'merchant', '점심 식사')}${field('거래일', 'transactionDate', currentTrip().start || '2026-11-10', 'date')}${select('통화', 'receiptCurrency', ['JPY', 'KRW', 'USD'], 'JPY')}${field('총액', 'receiptAmount', '2400', 'text', 'inputmode="decimal"')}<section class="card"><h3>읽어온 품목</h3><div class="list-row"><span>라멘 2개</span><strong>JPY 2,000</strong></div><div class="list-row"><span>음료 2개</span><strong>JPY 400</strong></div><p class="meta">품목 합계 JPY 2,400 · 총액과 같아요.</p></section>${select(
    '연결할 일정',
    'receiptSchedule',
    [
      [currentPlace().id, `DAY ${state.day} · ${currentPlace().name}`],
      ['', '일정 없이 저장'],
    ],
  )}${check('확인 후 영수증 사진 보관', 'keepReceipt', true)}<p class="meta">영수증 원본과 품목은 커뮤니티에 공개하지 않아요.</p>`;
}

// 영수증 원본을 초안과 대조할 수 있는 별도 화면을 제공한다.
function receiptPhoto() {
  // 검토용 영수증 예시를 실제 촬영·인식의 증거로 쓰지 않는다.
  return `<figure class="receipt-paper"><h2>お食事</h2><p>${escapeText(currentTrip().start || '날짜 미정')} 12:20</p><hr/><p>ラーメン ×2 <strong>2,000</strong></p><p>ドリンク ×2 <strong>400</strong></p><hr/><h3>合計 JPY 2,400</h3><p>ありがとうございました</p></figure><p class="meta">원본과 총액·통화가 같은지 확인해 주세요.</p>${button('확인 내용으로 돌아가기', 'receipt', 'quiet')}`;
}

// 일반 사진 상세는 영수증 상세와 분리한다.
function photo() {
  // 공개 선택은 별도 단계에서 사용자가 결정한다.
  return `<img class="hero" src="assets/osaka.jpg" alt="오사카 성을 담은 여행 사진"/>${card('여행에 보관한 사진', '<p class="meta">일반 사진 · DAY 2</p><p>공유할 때 이 사진을 직접 고를 수 있어요.</p>')}${button('공개할 항목 선택', 'share', 'quiet')}`;
}

// 준비물은 실제 체크 의미를 유지한다.
function checklist() {
  // DAY 탐색의 채움 선택과 완료 체크를 구분한다.
  return `<p class="meta">${state.checks.length} / 4개 준비했어요</p><progress max="4" value="${state.checks.length}" aria-label="준비물 완료 비율"></progress>${[
    '여권',
    '항공권 확인',
    '숙소 주소',
    '충전기',
  ]
    .map((name) => {
      // 체크박스 라벨 전체를 눌러 완료를 바꾼다.
      return check(
        name,
        'checklist',
        state.checks.includes(name),
        `data-item="${name}"`,
      );
    })
    .join(
      '',
    )}${field('준비물 추가', 'newChecklist', '', 'text', 'placeholder="챙길 물건이나 할 일"')}${action('목록에 추가', 'addChecklist')}`;
}

// 동행 역할과 소유자 전용 관리를 같은 화면에서 구분한다.
function members() {
  // 실제 서버 권한 검증을 생략하는 디자인으로 해석하지 않는다.
  if (state.role === 'viewer')
    return `${card('동행자 · 나', '<span class="tag">보기만 가능</span><p class="meta">일정과 기록을 읽을 수 있어요.</p>')}${card('여행자', '<span class="tag soft">여행 만든 사람</span><p class="meta">수정이 필요하면 여행을 만든 사람에게 요청해 주세요.</p>')}`;
  return `${card('여행자 · 나', '<span class="tag soft">여행 만든 사람</span><p class="meta">초대와 권한을 관리할 수 있어요.</p>')}${card('동행자', '<span class="tag">편집 가능</span>', `${button('권한 변경', 'memberRole', 'quiet')}${button('참여 해제', 'memberRemove', 'quiet')}`)}${button('초대 링크 만들기', 'inviteCreate')}${button('초대 링크로 참여', 'invite', 'quiet')}`;
}

// 초대 링크는 참여할 여행과 권한부터 확인한다.
function invite() {
  // 참여 완료처럼 보이는 자동 성공 알림을 만들지 않는다.
  return `${card(currentTrip().title, `<p class="meta">${dateRange()}</p><p>편집 가능한 동행자로 초대받았어요.</p>`)}<p>참여하면 여행 일정과 공유된 기록을 함께 볼 수 있어요.</p>${field('초대 링크', 'inviteLink', '', 'url', 'placeholder="받은 초대 링크"')}`;
}

// 공개 탐색은 글 작성보다 여행 조건과 계획 읽기를 우선한다.
function discover() {
  // 인기·평점·좋아요 수를 예시 수치로 만들지 않는다.
  const matches =
    (!state.discoverQuery ||
      '오사카 일본 여행'.includes(state.discoverQuery)) &&
    state.discoverDays !== '3일 이하';
  return `${field('여행계획 검색', 'discoverQuery', state.discoverQuery || '', 'search', 'placeholder="도시나 여행 이름"')}<div class="quick-grid">${select('공개 유형', 'discoverKind', ['전체', '여행계획', '여행기록'], state.discoverKind || '전체')}${select('여행 일수', 'discoverDays', ['전체', '4일', '3일 이하'], state.discoverDays || '전체')}</div>${matches ? card('오사카 3박 4일 여행', '<img class="hero" src="assets/osaka.jpg" alt="오사카 여행 표지"/><p class="meta">일본 · 오사카 · 4일 · 여행자</p><p>DAY별 장소와 설명·팁을 살펴보세요.</p>', button(state.discoverKind === '여행기록' ? '여행기록 보기' : '여행계획 보기', state.discoverKind === '여행기록' ? 'publicRecord' : 'public', 'quiet')) : card('조건에 맞는 여행이 없어요', '<p>도시나 여행 일수를 바꿔 찾아보세요.</p>')}${button('오사카 도시 가이드', 'guide', 'quiet')}`;
}

// 공개 미리보기와 읽기는 동일한 선택 사본을 렌더링한다.
function publicPlan() {
  // 선택하지 않은 DAY와 장소는 미리보기에서 보이지 않는다.
  if (state.publicationWithdrawn && state.screen !== 'preview')
    return card(
      '공개가 중단된 여행이에요',
      '<p>다른 여행자의 계획을 살펴보세요.</p>',
      button('다른 여행 찾기', 'discover'),
    );
  const snapshot = publicSnapshot();
  const available = [
    ...new Set(
      snapshot.places.map((item) => {
        // 원래 DAY 번호를 다시 매기지 않는다.
        return item.day;
      }),
    ),
  ];
  const day = snapshot.days.find((item) => {
    // 공개 소개도 같은 DAY 원본에서 투영한 값이다.
    return item.id === `day-${state.day}`;
  });
  return `<div class="tight"><p class="meta">일본 · 오사카 · ${state.screen === 'publicRecord' || snapshot.kind === 'record' ? '여행기록' : '여행계획'} · 공개 ${available.length}일</p><p class="meta">여행자 · 선택한 내용만 공개</p></div>${available.length ? days(available) : ''}${day ? dayIntro(day, false) : ''}${
    snapshot.places
      .filter((item) => {
        // 다른 날의 장소가 섞이지 않는다.
        return item.day === state.day;
      })
      .map((item, index) => {
        // 공개 읽기에서는 편집·추가 행동을 숨긴다.
        return placeCard(item, index, 'public');
      })
      .join('') ||
    (state.screen === 'preview'
      ? card(
          '선택한 일정이 없어요',
          '<p>공개할 일정을 먼저 골라주세요.</p>',
          button('선택 화면으로', 'share'),
        )
      : card(
          '공개된 일정이 없어요',
          '<p>다른 여행자의 계획을 살펴보세요.</p>',
          button('다른 여행 찾기', 'discover'),
        ))
  }${snapshot.photos.length ? '<img class="hero" src="assets/osaka.jpg" alt="선택해 공개한 여행 사진"/>' : ''}${snapshot.costs.length ? card('공개한 실제 지출 합계', '<p>JPY 2,400</p><p class="meta">영수증 원본과 품목은 공개하지 않아요.</p>') : ''}${state.screen === 'preview' ? '<p class="meta">이 화면의 일정·사진·합계만 공개돼요.</p>' : `${button('공개 내용 신고', 'report', 'quiet')}${button('작성자 차단', 'block', 'quiet')}`}`;
}

// 공개 기록도 원본에서 선택한 일정·일반 사진으로 구성한다.
function publicRecord() {
  // 장문 블로그를 별도로 작성하는 기능으로 바꾸지 않는다.
  return publicPlan();
}

// 도시 가이드는 출처와 실제 소개를 함께 읽는다.
function guide() {
  // 통계 순위나 현재 영업 여부를 추정해 만들지 않는다.
  return `<img class="hero" src="assets/osaka.jpg" alt="오사카 도시 풍경"/><section class="stack"><h2>오사카를 천천히 둘러봐요</h2><p>역사와 번화가, 시장을 여행 속도에 맞춰 골라보세요.</p>${button('가이드 출처', 'guideSource', 'quiet')}</section>${card('오사카 성 주변', '<p class="meta">역사와 공원 산책</p>', button('장소 살펴보기', 'guidePlace', 'quiet'))}${button('내 일정의 장소 검색', 'search')}`;
}

// 가이드의 장소는 확인 후 일반 일정 작성으로 이어진다.
function guidePlace() {
  // 추천 코스를 자동 일괄 저장하거나 좌표를 만들어내지 않는다.
  return `<h2>오사카 성 주변</h2><img class="hero" src="assets/osaka.jpg" alt="오사카 성 주변 풍경"/><p>공원 산책과 역사 여행을 함께 계획해 보세요.</p><p class="meta">주소와 방문 조건은 장소 검색에서 확인해 주세요.</p>${button('장소 검색으로 확인', 'search')}${button('가이드 출처', 'guideSource', 'quiet')}`;
}

// 완료 원본은 제목·기간·연결된 상세가 모두 같은 ID를 읽는다.
function footprints() {
  // 미래 여행을 완료 카드로 재표시하지 않는다.
  return `<p>다녀온 여행을 다시 꺼내보세요.</p>${tripCard(trips[1], true)}${button('다녀온 여행 기록하기', 'create', 'quiet')}`;
}

// 개인 기록의 읽기는 공개 여부와 별개다.
function diary() {
  // 발자국에서 들어온 여행 ID를 사진·비용·일정에도 유지한다.
  return `<span class="tag soft">${tripPhase(currentTrip())}</span><p class="meta">${dateRange()} · 나와 동행자의 기록</p><img class="hero" src="assets/osaka.jpg" alt="오사카 여행 기록 표지"/><section class="stack"><h2>여행의 순간들</h2><p>방문한 장소와 사진, 비용을 함께 돌아봐요.</p>${button('기록 더하기', 'recordEditor')}${button('날짜별 일정 보기', 'schedule', 'quiet')}${button('사진과 영수증', 'media', 'quiet')}${button('여행 경비', 'cost', 'quiet')}</section>${button('선택해서 공유', 'share', 'quiet')}`;
}

// 기록 더하기는 실제 지원하는 일정 메모와 일반 사진을 연결한다.
function recordEditor() {
  // 새로운 여행 전체 블로그 본문 필드를 만들지 않는다.
  return `<p>기억에 남는 장소를 고르고 메모나 사진을 더해요.</p>${select(
    '기록할 장소',
    'recordPlace',
    state.places.map((place) => {
      // 원본 일정 ID에 연결한다.
      return [place.id, `DAY ${place.day} · ${place.name}`];
    }),
    state.placeId,
  )}${textarea('개인 메모', 'recordMemo', currentPlace().memo, 'maxlength="300"')}<p class="meta">개인 메모는 커뮤니티에 공개하지 않아요.</p>${button('장소 설명·팁도 수정하기', 'editor', 'quiet')}${button('사진 더하기', 'photoMethod')}`;
}

// 일정 단위로 선택한 값이 실제 미리보기 투영에 사용된다.
function share() {
  // 계획/기록의 공개 가능 조건을 따로 안내한다.
  return `${select(
    '공개할 내용',
    'shareKind',
    currentTrip().id === 'osaka-record'
      ? [
          ['plan', '여행계획'],
          ['record', '여행기록'],
        ]
      : [['plan', '여행계획']],
    state.shareKind,
  )}<p>공개할 일정과 사진을 골라주세요.</p>${state.days
    .map((day, index) => {
      // DAY 안내는 일정 선택 그룹을 읽기 쉽게 나눈다.
      return `<section class="card"><h3>DAY ${index + 1} · ${escapeText(day.title)}</h3>${state.places
        .filter((place) => {
          // 해당 DAY의 개별 일정 선택만 표시한다.
          return place.day === index + 1;
        })
        .map((place) => {
          // 체크 해제는 미리보기에서 같은 ID를 제거한다.
          return check(
            place.name,
            'sharePlace',
            state.selected.includes(place.id),
            `data-place="${place.id}"`,
          );
        })
        .join('')}</section>`;
    })
    .join(
      '',
    )}${check('일반 여행 사진 1장', 'sharePhotos', state.selectedPhotos)}${check('실제 지출 합계 · 통화별', 'shareCosts', state.includeCosts)}${card('선택한 내용만 공개돼요', '<p class="meta">개인 메모·동행 정보·예약번호·영수증 원본과 품목은 공개하지 않아요. 내 여행 원본은 그대로 남아요.</p>')}<p class="meta">선택한 일정 ${state.selected.length}개</p>`;
}

// 공개 완료 뒤 공개 읽기와 원본 관리로 갈 수 있다.
function published() {
  // 실제 게시 성공은 외부 시안 안내와 구분한다.
  return `${icon('check')}<h2>선택한 내용의 공개 화면</h2><p>공개한 여행과 내 여행 원본을 각각 확인할 수 있어요.</p>${button('공개된 여행 보기', 'public')}${button('공개한 여행 관리', 'publications', 'quiet')}`;
}

// MY는 계정과 공개 관리를 맡는다.
function my() {
  // 프로필·알림·계정은 다른 목적지로 연결한다.
  return `${card('여행자', '<p class="meta">나의 여행 프로필</p>', button('프로필 편집', 'profile', 'quiet'))}<div class="option-list">${button('공개한 여행 관리', 'publications')}${button('알림 설정', 'notifications')}${button('계정 설정', 'account')}${button('이 기기의 이전 기록', 'local')}</div>`;
}

// 기존 회원의 닉네임을 강제로 바꾸지 않는 입력 계약을 유지한다.
function profile() {
  // 생일은 선택이고 입력하지 않아도 다음으로 갈 수 있다.
  return `${state.screen === 'onboarding' ? haru('empty') : ''}${field('닉네임', 'nickname', '여행자', 'text', 'required')}<p class="meta">공백 포함 2~20바이트로 입력해 주세요.</p>${field('생년월일 · 선택', 'birthday', '', 'date')}${button('여행 스타일 선택', 'styles')}<p class="meta">생년월일을 입력하지 않아도 이용할 수 있어요.</p>`;
}

// 다중 취향 선택은 체크 의미를 유지한다.
function styles() {
  // DAY와 다른 다중 선택이므로 체크박스를 사용한다.
  return `<p>좋아하는 여행을 골라주세요. 나중에 바꿔도 돼요.</p>${[
    '맛집',
    '카페',
    '역사',
    '자연',
    '쇼핑',
    '여유롭게 걷기',
  ]
    .map((name) => {
      // 선택 라벨 전체가 최소 터치 영역을 갖는다.
      return check(name, 'travelStyle');
    })
    .join('')}`;
}

// 설정의 실제 지원 범위를 명시한다.
function notifications() {
  // 패키지가 있다는 이유로 원격 알림이 작동한다고 안내하지 않는다.
  return `<section class="stack"><h2>기기 알림 권한</h2><p>휴대폰 설정에서 TripPrint의 알림 허용 여부를 확인할 수 있어요.</p>${action('알림 설정 열기', 'notificationSettings')}</section><p class="meta">항공편 변경이나 예약 알림은 제공하지 않아요.</p>`;
}

// 계정 보호 행동은 구체적인 확인 팝업으로 연결한다.
function account() {
  // 탈퇴와 로그아웃을 같은 확인 문구로 처리하지 않는다.
  return `${card('로그인한 계정', '<p class="meta">개인 정보와 계정 보호를 관리해요.</p>')}${button('프로필 편집', 'profile')}${button('로그아웃', 'logoutConfirm', 'quiet')}${button('회원 탈퇴', 'deleteAccount', 'quiet danger-link')}`;
}

// 공개 사본 관리에서 원본 편집과 철회를 나눈다.
function publications() {
  // 원본을 고쳐도 기존 공개 사본을 자동 갱신하지 않는다.
  return `${card(currentTrip().title, `<span class="tag soft">${state.publicationWithdrawn ? '공개 중단' : '여행계획 공개'}</span><p class="meta">공개한 내용은 내 여행 원본과 별도로 관리돼요.</p>`, `${button('공개 화면 확인', state.publicationWithdrawn ? 'withdrawn' : 'public')}${button('선택 내용 수정', 'share', 'quiet')}${button('공개 철회', 'withdrawConfirm', 'quiet danger-link')}`)}`;
}

// 기기 한정 자료의 공개 범위를 쉬운 말로 안내한다.
function localRecords() {
  // 서버에 동기화한 것처럼 표현하지 않는다.
  return `${haru('empty')}<h2>이 기기에 남아 있는 기록</h2><p>이곳의 이전 기록은 이 기기에서만 볼 수 있어요. 앱 삭제나 기기 변경 전에 필요한 내용을 확인해 주세요.</p>${button('내 여행으로 돌아가기', 'trips', 'quiet')}`;
}

// 시작 화면은 흰 배경 중앙 심볼을 기본으로 유지한다.
function startup() {
  // 미제작 BI 영상을 재생하는 것처럼 가장하지 않는다.
  return '<div class="startup-logo"><img src="assets/app-icon.png" alt="TripPrint"/></div>';
}

// 로그인은 게스트의 공개 읽기를 막지 않는다.
function login() {
  // 인증 버튼은 검토용 연결만 실행한다.
  return `${haru('empty')}<h2>여행의 시작부터 기록까지</h2><p>여행을 저장하고 동행자와 함께 정리해요.</p>${action('Google로 계속하기', 'googleLogin')}${button('이메일로 로그인', 'email')}${button('이메일로 가입', 'signup', 'quiet')}${button('공개 여행 둘러보기', 'discover', 'quiet')}`;
}

// 이메일 인증은 입력 필드와 오류 연결을 제공한다.
function email() {
  // 비밀번호를 제품 밖 메모나 공개 사본에 복사하지 않는다.
  return `${field('이메일', 'email', '', 'email', 'autocomplete="email" required')}${field('비밀번호', 'password', '', 'password', 'autocomplete="current-password" required')}${button('이메일로 가입', 'signup', 'quiet')}`;
}

// 가입은 계정 입력과 프로필 단계를 구분한다.
function signup() {
  // 생일은 프로필 단계의 선택 입력으로 둔다.
  return `${field('이메일', 'email', '', 'email', 'autocomplete="email" required')}${field('비밀번호', 'password', '', 'password', 'autocomplete="new-password" required')}${field('비밀번호 확인', 'passwordConfirm', '', 'password', 'autocomplete="new-password" required')}<p class="meta">입력한 이메일과 비밀번호를 확인한 뒤 다음으로 진행해 주세요.</p>`;
}

// 인증 복귀는 원래 목적지를 표시한다.
function authReturn() {
  // 앱에서는 기존 목적 경로 계약으로 검증할 상태다.
  return `${haru('loading')}<h2>원래 보던 여행으로 돌아가요</h2><p>작성하던 내용과 선택한 날짜를 이어서 확인해 주세요.</p>${button('여행으로 돌아가기', 'schedule')}`;
}

// 시작 점검은 실패를 무한 대기로 바꾸지 않는다.
function startupCheck() {
  // 운영 정책값은 제품 문구로 노출하지 않는다.
  return `${haru('loading')}<h2>여행을 불러오고 있어요</h2><p>오래 걸리면 연결 상태를 확인하고 다시 시도해 주세요.</p>${button('다시 시도', 'home')}`;
}

// 필수 업데이트는 진행 가능한 하나의 행동으로 제시한다.
function update() {
  // 실제 스토어 실행은 시안의 외부 안내에서 구분한다.
  return `${haru('empty')}<h2>새 버전으로 업데이트해 주세요</h2><p>계속 이용하려면 Google Play에서 TripPrint를 업데이트해 주세요.</p>${action('Google Play에서 업데이트', 'playUpdate')}`;
}

// 여행 정보 변경은 기존 입력 필드만 사용한다.
function metadata() {
  // 기간 변경은 별도 영향 확인 화면으로 연결한다.
  return `${field('여행 이름', 'tripName', currentTrip().title, 'text', 'maxlength="50"')}${button(`나라 · ${currentTrip().country}`, 'country')}${button(`도시 · ${currentTrip().city || '미정'}`, 'city')}${button('기간 변경', 'changePeriod')}`;
}

export const views = {
  home,
  trips: tripList,
  create,
  country,
  city,
  period,
  createReview,
  schedule,
  map,
  cost,
  media,
  checklist,
  members,
  metadata,
  search,
  place,
  editor,
  dayEditor,
  location,
  reorder,
  import: importPlace,
  flight,
  flightSearch,
  flightEditor,
  stay,
  expenseEditor,
  expenseDetail,
  capture,
  receipt,
  receiptPhoto,
  photo,
  invite,
  discover,
  public: publicPlan,
  publicRecord,
  guide,
  guidePlace,
  footprints,
  diary,
  recordEditor,
  share,
  published,
  my,
  profile,
  styles,
  notifications,
  account,
  publications,
  local: localRecords,
  startup,
  login,
  email,
  signup,
  authReturn,
  startupCheck,
  update,
};

// 브라우저 진입 시 DAY 소개 기본값의 출처를 확인할 수 있게 내보낸다.
export const dayCount = initialDays.length;
