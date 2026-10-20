import {
  currentDay,
  currentPlace,
  currentTrip,
  state,
  tripPhase,
} from './model.mjs';

// 입력값과 예시 문자열을 실행할 수 없는 HTML로 바꾼다.
export function escapeText(value = '') {
  // 작은따옴표와 큰따옴표를 포함해 속성 삽입도 막는다.
  return String(value).replace(/[&<>"']/g, (char) => {
    // 예약 문자만 안전한 엔티티로 바꾼다.
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char];
  });
}

const iconNames = {
  back: 'arrow-left-outline',
  plus: 'plus-outline',
  home: 'home-outline',
  trip: 'calendar-outline',
  search: 'search-outline',
  record: 'journal-outline',
  user: 'user-outline',
  pin: 'map-pin-outline',
  plane: 'flight-outline',
  camera: 'camera-outline',
  more: 'ellipsis-outline',
  map: 'map-outline',
  share: 'share-outline',
  error: 'warning-outline',
  check: 'success-outline',
  receipt: 'receipt-scan-outline',
  close: 'close-outline',
  next: 'chevron-right-outline',
  settings: 'sliders-outline',
  info: 'info-outline',
  refresh: 'refresh-outline',
};

// 기존 매니페스트에서 제공한 원본 아이콘만 사용한다.
export function icon(name) {
  // 런타임 SVG를 임의로 다시 그리지 않고 원본 파일을 연결한다.
  return ['back', 'more', 'close', 'next'].includes(name)
    ? `<span class="ui-icon platform-icon" aria-hidden="true">${{ back: '←', more: '⋯', close: '×', next: '→' }[name]}</span>`
    : `<img class="ui-icon" src="assets/icons/icon-${iconNames[name] || name}.svg" alt="" aria-hidden="true"/>`;
}

// 화면 이동 버튼은 반드시 정의된 목적지를 명시한다.
export function button(label, target, style = '', extra = '') {
  // 주요 행동과 보조 행동은 같은 크기 체계로 구분한다.
  return `<button class="button ${style}" data-go="${target}" ${extra}>${escapeText(label)}</button>`;
}

// 주요 행동을 눌렀을 때만 시안 모델을 갱신한다.
export function action(label, command, style = '', extra = '') {
  // 실제 API 요청이나 가짜 서버 성공 알림은 만들지 않는다.
  return `<button class="button ${style}" data-action="${command}" ${extra}>${escapeText(label)}</button>`;
}

// 제목과 실제 여행 기간을 공통 형식으로 읽는다.
export function tripTitle() {
  // 전체 제목은 말줄임 없이 사용자 글자 배율로 표시한다.
  return escapeText(
    state.long
      ? '오사카의 골목과 바다를 함께 걷는 우리 가족의 3박 4일 여행'
      : currentTrip().title,
  );
}

// 기간 미정도 완료 여행과 같은 형식 계약에서 구분한다.
export function dateRange(trip = currentTrip()) {
  // 숫자 구분 기호는 현행 규격을 유지한다.
  return trip.start ? `${trip.start} – ${trip.end}` : '날짜 미정';
}

// 선택 배경만 달라지고 버튼의 너비·굵기는 바뀌지 않는다.
export function days(available = [1, 2, 3, 4]) {
  // DAY 탐색에는 체크·체크용 빈 공간을 만들지 않는다.
  return `<nav class="days" aria-label="여행 날짜">${available
    .map((day) => {
      // 버튼 의미에 맞게 눌림 상태를 읽는다.
      return `<button data-day="${day}" aria-pressed="${day === state.day}">DAY ${day}</button>`;
    })
    .join('')}</nav>`;
}

// 같은 여행의 일정·지도·비용만 핵심 작업으로 둔다.
export function tripTabs(selected) {
  // 사진·동행 등 관리 행동은 상단 더보기에서 연다.
  return `<nav class="tabs" aria-label="여행 작업">${[
    ['schedule', '일정'],
    ['map', '지도'],
    ['cost', '비용'],
  ]
    .map(([key, label]) => {
      // 탐색 버튼은 tab 역할을 흉내 내지 않고 현재 페이지를 표시한다.
      return `<button data-go="${key}" aria-current="${selected === key ? 'page' : 'false'}">${label}</button>`;
    })
    .join('')}</nav>`;
}

// 값이 있는 실제 화면 라벨을 입력과 연결한다.
export function field(label, name, value = '', type = 'text', extra = '') {
  // input type과 속성은 코드가 정한 값만 허용한다.
  return `<label class="field">${escapeText(label)}<input name="${name}" type="${type}" value="${escapeText(value)}" ${extra}/></label>`;
}

// 장문 설명은 읽기용 본문과 같은 글꼴로 작성한다.
export function textarea(label, name, value = '', extra = '') {
  // 원문 줄바꿈을 입력 필드에 그대로 보존한다.
  return `<label class="field">${escapeText(label)}<textarea name="${name}" ${extra}>${escapeText(value)}</textarea></label>`;
}

// 실제 선택 가능한 값만 공통 선택 입력에 표시한다.
export function select(label, name, options, selected = '') {
  // 표시 이름과 제출 값을 분리해 통화·일정 ID를 보존한다.
  return `<label class="field">${escapeText(label)}<select name="${name}">${options
    .map((option) => {
      // 문자열과 값/이름 쌍을 같은 형식으로 표시한다.
      return `<option value="${escapeText(Array.isArray(option) ? option[0] : option)}" ${(Array.isArray(option) ? option[0] : option) === selected ? 'selected' : ''}>${escapeText(Array.isArray(option) ? option[1] : option)}</option>`;
    })
    .join('')}</select></label>`;
}

// 모든 다중 선택은 라벨 전체를 누를 수 있게 한다.
export function check(label, name, checked = false, extra = '') {
  // 체크의 의미는 DAY 탐색과 별도로 유지한다.
  return `<label class="check-item"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${extra}/><span>${escapeText(label)}</span></label>`;
}

// 간결한 요약 카드와 다음 행동을 공통 구조로 표시한다.
export function card(heading, body, actions = '', className = '') {
  // 제목 위계와 본문 간격은 카드 토큰을 따른다.
  return `<section class="card ${className}"><h3>${escapeText(heading)}</h3>${body}${actions}</section>`;
}

// 하루는 안내를 돕는 장식으로만 사용한다.
export function haru(kind = 'empty') {
  // 화면 읽기는 상태 문구를 읽고 캐릭터는 중복해서 읽지 않는다.
  return `<img class="haru" src="assets/haru-${kind}.png" alt="" aria-hidden="true"/>`;
}

// 사진 없는 장소에 다른 장소의 사진을 붙이지 않는다.
export function placePhoto(place) {
  // 사진 출처 계약은 원본 아이콘·고정 슬롯과 분리한다.
  return `<span class="thumb thumb-placeholder" aria-label="장소 사진 없음">${icon('camera')}</span>`;
}

// 방문 순서·시각·장소·공개 설명의 위계를 유지한다.
export function placeCard(place, index, context = 'private') {
  // 공개 상세·후보 확인·개인 읽기의 목적지를 구분한다.
  return `<article class="place" data-place-card="${place.id}"><div class="rail"><span class="number">${index + 1}</span></div><div class="card"><p class="meta time">${escapeText(place.time || '시간 미정')}${place.choiceGroup ? ` · ${escapeText(place.choiceKind === 'backup' ? '대체 장소' : '선택 후보')}` : ''}</p><div class="place-title"><div class="tight"><h3>${escapeText(place.name)}</h3><p class="meta">${escapeText(place.area)}</p></div>${placePhoto(place)}</div>${place.choiceGroup ? `<p class="meta">${escapeText(place.choiceLabel || '후보 중 한 곳을 골라요')}</p>` : ''}${button('설명·팁 보기', context === 'public' ? 'publicPlace' : 'place', 'quiet', `data-place="${place.id}"`)}</div></article>`;
}

// 카드 뱃지·설명·버튼은 하나의 상태 결과에서 나온다.
export function tripCard(trip, primary = false) {
  // 예정과 완료의 서로 다른 예시 여행을 같은 ID로 연결하지 않는다.
  const phase = tripPhase(trip);
  return `<article class="card cover-card"><img class="hero" src="assets/osaka.jpg" alt="오사카 여행 표지"/><div class="card-body"><span class="tag soft">${phase}</span><h2>${escapeText(trip.title)}</h2><p class="meta">${escapeText(trip.country)}${trip.city ? ` · ${escapeText(trip.city)}` : ''}</p><p class="meta">${dateRange(trip)}</p><p class="meta">${phase === '여행 완료' ? '다녀온 장소와 기록을 다시 꺼내보세요.' : phase === '여행 중' ? '오늘의 일정과 예약을 확인해요.' : '가고 싶은 장소를 차근차근 정리해요.'}</p>${button(phase === '여행 완료' ? '기록 보러가기' : '계획 계속하기', phase === '여행 완료' ? 'diary' : 'schedule', primary ? 'primary' : 'quiet', `data-trip="${trip.id}"`)}</div></article>`;
}

// 현재 DAY 소개는 편집·개인 읽기·공개 읽기에서 같은 데이터를 사용한다.
export function dayIntro(day = currentDay(), editable = true) {
  // 빈 소개는 큰 빈 공간으로 남기지 않는다.
  return `<section class="day-intro"><h3>DAY ${state.day}${day?.title ? ` · ${escapeText(day.title)}` : ''}</h3>${day?.intro ? `<p>${escapeText(day.intro)}</p>` : ''}${editable ? button('이날 소개 편집', 'dayEditor', 'quiet') : ''}</section>`;
}

// 선택한 장소의 기본 설명을 편집 폼에 재사용한다.
export function placeFields() {
  // 개인 메모와 공개용 설명은 서로 다른 라벨·필드를 유지한다.
  return `${field('장소 이름', 'name', currentPlace().name, 'text', 'maxlength="100" required')}${field('주소', 'address', currentPlace().address)}${textarea('장소 설명·방문 팁', 'description', `${currentPlace().description}${currentPlace().tip ? `\n\n방문 팁\n${currentPlace().tip}` : ''}`, 'maxlength="4000"')}<p class="meta">선택해 공유한 일정의 설명과 팁만 공개돼요.</p>${textarea('개인 메모', 'memo', currentPlace().memo, 'maxlength="300"')}<p class="meta">개인 메모는 커뮤니티에 공개하지 않아요.</p>`;
}
