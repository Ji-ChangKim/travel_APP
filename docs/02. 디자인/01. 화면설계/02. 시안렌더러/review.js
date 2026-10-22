import { groups, pageByKey, pages } from './catalog.mjs';
import {
  currentPlace,
  previewSnapshot,
  publicSnapshot,
  state,
} from './model.mjs';
import { action, button, escapeText, icon, tripTitle } from './components.mjs';
import { views } from './screens.mjs';
import { exceptionView, popupContents, popups } from './states.mjs';
import { designSystem } from './design-system.mjs';
import { brand } from './brand-data.mjs';

const forms = new Set([
  'create',
  'period',
  'changePeriod',
  'metadata',
  'editor',
  'dayEditor',
  'flightEditor',
  'flightSearch',
  'expenseEditor',
  'receipt',
  'stay',
  'import',
  'profile',
  'onboarding',
  'email',
  'signup',
  'recordEditor',
]);
const topPages = ['home', 'trips', 'discover', 'footprints', 'my'];
const writeBack = {
  editor: 'schedule',
  dayEditor: 'schedule',
  flightEditor: 'flight',
  expenseEditor: 'cost',
  receipt: 'cost',
  stay: 'flight',
  metadata: 'schedule',
  profile: 'my',
  recordEditor: 'diary',
  onboarding: 'authReturn',
  period: 'create',
  changePeriod: 'periodImpact',
  create: 'createReview',
  createReview: 'schedule',
  flightSearch: 'flightEmpty',
  import: 'candidate',
  signup: 'onboarding',
  email: 'authReturn',
};
const references = {
  home: ['Wanderlog', 'TripIt'],
  trips: ['Wanderlog'],
  discover: ['Tripadvisor', 'Wanderlog'],
  footprints: ['Polarsteps'],
  my: ['Polarsteps'],
  auth: ['TripIt'],
  system: ['Wanderlog', 'Polarsteps'],
  exception: ['TripIt', 'TravelSpend'],
  popup: ['Polarsteps', 'Wanderlog'],
};
const urls = {
  Wanderlog:
    'https://play.google.com/store/apps/details?id=com.wanderlog.android',
  TripIt: 'https://play.google.com/store/apps/details?id=com.tripit',
  Polarsteps: 'https://play.google.com/store/apps/details?id=com.polarsteps',
  Tripadvisor:
    'https://play.google.com/store/apps/details?id=com.tripadvisor.tripadvisor',
  TravelSpend:
    'https://play.google.com/store/apps/details?id=tech.jonas.travelbudget',
};
const photoData = new Map();
let livePhotos = false;
let popupReturnFocus = null;
let closeTimer = null;

// 제품 밖 검토 도구에만 시안 동작의 한계를 알린다.
function feedback(message) {
  // 실제 서비스 저장 완료·인증 성공을 가장하지 않는다.
  return (document.getElementById('demo-feedback').textContent = message);
}

// 작성값을 여행·DAY·장소별로 나눠 보존한다.
function draftKey(screen = state.screen) {
  // 다른 날짜나 다른 장소의 입력을 같은 폼으로 복원하지 않는다.
  return `${screen}:${state.tripId}:${state.day}:${state.placeId}:${state.adding ? 'new' : 'edit'}`;
}

// 현재 입력을 메모리에만 담고 민감한 비밀번호는 제외한다.
function captureDraft() {
  // 서버·로컬스토리지·디스크에 작성 중 입력을 저장하지 않는다.
  return (state.drafts[draftKey()] = Object.fromEntries(
    [...document.querySelectorAll('#phone-scroll [name]')]
      .filter((input) => {
        // 비밀번호는 화면 복원용 자료로 복사하지 않는다.
        return input.type !== 'password';
      })
      .map((input) => {
        // 체크박스와 일반 입력을 구분한다.
        return [
          input.name,
          input.type === 'checkbox' ? input.checked : input.value,
        ];
      }),
  ));
}

// 닫았다 돌아온 폼에 같은 맥락의 작성값만 복원한다.
function restoreDraft() {
  // 선택 공유는 메모리 모델을 직접 읽으므로 폼 복원으로 덮지 않는다.
  return (
    forms.has(state.screen) &&
    Object.entries(state.drafts[draftKey()] || {}).forEach(([name, value]) => {
      // 이름은 코드에서 정한 필드명이며 임의 선택자를 조합하지 않는다.
      const input = [...document.querySelectorAll('#phone-scroll [name]')].find(
        (input) => {
          // 동일한 입력 이름을 찾는다.
          return input.name === name;
        },
      );
      if (input)
        return input.type === 'checkbox'
          ? (input.checked = value)
          : (input.value = value);
    })
  );
}

// 검토 목록은 상위 영역과 하위 화면을 접어서 탐색한다.
function menu() {
  // 번호·한글명 검색은 파일명과 같은 원본 목록에서 계산한다.
  const query = document.getElementById('catalog-query').value;
  return groups
    .map(([key, label]) => {
      // 선택한 영역은 현재 위치를 잃지 않게 펼쳐 둔다.
      return `<details ${pageByKey(state.screen).group === key || query ? 'open' : ''}><summary>${label} <span>${
        pages.filter((page) => {
          // 해당 영역의 제작 화면 수를 표시한다.
          return page.group === key;
        }).length
      }</span></summary>${pages
        .filter((page) => {
          // 검토 도구 검색은 제품 검색과 분리한다.
          return page.group === key && page.file.includes(query);
        })
        .map((page) => {
          // 페이지 번호는 제품 화면 안에 넣지 않는다.
          return `<button data-go="${page.key}" data-catalog aria-current="${page.key === state.screen ? 'page' : 'false'}"><small>${String(page.number).padStart(3, '0')}</small>${page.name.replaceAll('_', ' · ')}</button>`;
        })
        .join('')}</details>`;
    })
    .join('');
}

// 화면별 헤더 제목을 정확한 대상 데이터로 읽는다.
function header(key = state.screen) {
  // 일반 하위 화면은 이동 바와 제목을 분리하고 공개 상세만 제목을 옆에 둔다.
  const page = pageByKey(key);
  const label = ['public', 'preview', 'publicRecord'].includes(key)
    ? state.long
      ? tripTitle()
      : escapeText(publicSnapshot().title)
    : key === 'publicPlace'
      ? escapeText(
          publicSnapshot().places.find((place) => {
            // 공개 사본 제목이 개인 원본 수정에 따라 바뀌지 않게 한다.
            return place.id === state.placeId;
          })?.name || '장소 설명',
        )
      : ['schedule', 'diary', 'map', 'cost'].includes(key)
        ? tripTitle()
        : ['place', 'candidate'].includes(key)
          ? escapeText(currentPlace().name)
          : escapeText(page.title);
  return key === 'home'
    ? '<img class="brand" src="assets/logo.svg" alt="TripPrint"/>'
    : key === 'startup'
      ? ''
      : topPages.includes(key) || key === 'system'
        ? `<h1>${label}</h1>${key === 'trips' ? `<button class="icon-button" data-go="create" aria-label="새 여행 만들기">${icon('plus')}</button>` : ''}`
        : ['public', 'preview', 'publicRecord', 'publicPlace'].includes(key)
          ? `<div class="inline-title"><button class="icon-button" data-back aria-label="이전 화면">${icon('back')}</button><h1>${label}</h1></div>`
          : `<div class="navigation-bar"><button class="icon-button" data-back aria-label="이전 화면">${icon('back')}</button>${['schedule', 'map', 'cost'].includes(key) ? `<button class="icon-button" data-go="tripMenu" aria-label="여행 관리 메뉴">${icon('more')}</button>` : ''}</div><h1>${label}</h1>`;
}

// 각 화면에 실제 문맥과 맞는 하단 행동 하나만 둔다.
function footer(key = state.screen) {
  // 공개 읽기와 기존 일정 읽기에 장소 추가를 제안하지 않는다.
  return topPages.includes(key)
    ? `<nav class="bottom-nav" aria-label="주요 메뉴">${[
        ['home', '홈', 'home'],
        ['trips', '내 여행', 'trip'],
        ['discover', '발견', 'compass-outline'],
        ['footprints', '발자국', 'record'],
        ['my', 'MY', 'user'],
      ]
        .map(([target, label, name]) => {
          // 선택 메뉴는 원본 filled 자산과 배경·밑줄을 함께 사용한다.
          return `<button data-go="${target}" aria-current="${target === key ? 'page' : 'false'}">${icon(target === key && ['home', 'record', 'user'].includes(name) ? `${name === 'record' ? 'journal' : name}-filled` : name)}<span>${label}</span></button>`;
        })
        .join('')}</nav>`
    : key === 'schedule'
      ? `<div class="phone-footer">${button('일정 추가', 'search', 'primary')}</div>`
      : ['candidate', 'guidePlace'].includes(key)
        ? `<div class="phone-footer">${button('이 장소 추가', 'editor', 'primary', 'data-add-place')}</div>`
        : key === 'place'
          ? `<div class="phone-footer">${button('일정 수정', 'editor', 'primary')}</div>`
          : key === 'publicPlace'
            ? `<div class="phone-footer">${action('보던 일정으로 돌아가기', 'back')}</div>`
            : key === 'share'
              ? `<div class="phone-footer">${button(`미리보기 · 일정 ${state.selected.length}개`, 'preview', 'primary', state.selected.length ? '' : 'disabled')}</div>`
              : key === 'preview'
                ? `<div class="phone-footer">${button('확인하고 공개', 'publishConfirm', 'primary', state.selected.length ? '' : 'disabled')}</div>`
                : key === 'createReview'
                  ? `<div class="phone-footer">${action('여행 만들기', 'save', 'primary')}</div>`
                  : forms.has(key)
                    ? `<div class="phone-footer">${key === 'create' && state.undated ? button('날짜 정하기', 'period', 'primary') : action({ create: '다음', flightSearch: '항공편 조회', import: '장소 확인', email: '로그인', signup: '다음', onboarding: '시작하기', receipt: '확인한 지출 저장' }[key] || '저장', 'save', 'primary')}</div>`
                    : key === 'reorder'
                      ? `<div class="phone-footer">${action('이 순서 사용', 'saveOrder', 'primary')}</div>`
                      : key === 'styles'
                        ? `<div class="phone-footer">${button('선택 완료', 'profile', 'primary')}</div>`
                        : key === 'city'
                          ? `<div class="phone-footer">${action('입력한 도시 사용', 'chooseCity', 'primary')}</div>`
                          : key === 'location'
                            ? `<div class="phone-footer">${button('이 장소로 돌아가기', 'editor', 'primary')}</div>`
                            : key === 'invite'
                              ? `<div class="phone-footer">${action('이 여행에 참여', 'inviteJoin', 'primary')}</div>`
                              : '';
}

// 표준 화면·예외·디자인 시스템을 하나의 목록에서 렌더링한다.
function content(page) {
  // 누락한 렌더러를 빈 페이지로 숨기지 않는다.
  return page.key === 'system'
    ? designSystem()
    : page.view === 'exception'
      ? exceptionView(page.key)
      : views[page.view]();
}

// 원본 자료의 저작자·라이선스를 임의 값으로 만들지 않는다.
function guideCredits() {
  // 사진 출처는 실제 번들 오사카 사진 정보와 일치한다.
  const credit = brand.credits.osaka;
  return `<section class="stack"><h3>오사카 사진</h3><p>${escapeText(credit.author)}</p><p>${escapeText(credit.license)}</p><p class="meta">${escapeText(credit.changes)}</p><a href="${credit.sourceUrl}" target="_blank" rel="noreferrer">원본 사진 정보 ↗</a><a href="${credit.licenseUrl}" target="_blank" rel="noreferrer">라이선스 ↗</a></section><section class="stack"><h3>도시 소개</h3><p>오사카 관광국 안내를 참고해 한국어로 정리했어요.</p><a href="https://osaka-info.jp/" target="_blank" rel="noreferrer">관광 안내 원문 ↗</a><p class="meta">원문 사이트의 이용 조건이 적용돼요.</p></section>`;
}

// 제품 밖에는 상하위 관계·작성 위치·구현 범위를 적는다.
function notes(page) {
  // 디자인 컴펌과 실서비스 인수를 구분한다.
  document.getElementById('screen-caption').textContent = page.file;
  document.getElementById('rationale-title').textContent = page.name.replaceAll(
    '_',
    ' · ',
  );
  document.getElementById('rationale').textContent =
    `${page.parent ? `상위: ${pageByKey(page.parent).file} → ` : '최상위 → '}${page.file}. 뒤로가기는 열었던 화면의 DAY·스크롤·입력 맥락으로 돌아갑니다.`;
  document.getElementById('contract').textContent = [
    'share',
    'preview',
    'public',
    'publicPlace',
    'publishConfirm',
  ].includes(page.key)
    ? 'DAY 소개는 day.plan, 장소 설명·팁은 schedule.planContent.description. 선택한 일정·일반 사진·통화별 합계만 공개 사본으로 투영하며 개인 메모·예약·동행·영수증은 제외합니다.'
    : forms.has(page.key)
      ? '원래 여행·DAY·장소 입력을 유지합니다. 저장/충돌/재조회는 기존 API 계약을 사용하며 이 제작본은 메모리 반영만 확인합니다.'
      : page.group === 'popup'
        ? '확인/선택/원문 읽기를 구분합니다. 배경 잠금, 초점 이동·복귀, Escape, 긴 본문 스크롤과 안전한 취소 행동을 공통 적용합니다.'
        : '기존 기능과 원본 ID를 보존합니다. 하단 전역 탐색은 다섯 최상위 화면에만, 여행 상세의 일정/지도/비용과 나머지 관리는 별도로 둡니다.';
  document.getElementById('scope').textContent =
    page.group === 'exception'
      ? '원인별 복구 화면 · 실제 실패 인수는 별도'
      : page.group === 'popup'
        ? '표준 팝업 제작본 · 서버 명령 미실행'
        : '전체 화면 디자인 · 기능 구현/출시 승인과 구분';
  document.getElementById('references').innerHTML = (
    references[page.group] || references.trips
  )
    .map((name) => {
      // 역기획 출처는 공식 등록 자료로 연결한다.
      return `<a href="${urls[name]}" target="_blank" rel="noreferrer">${name} ↗</a>`;
    })
    .join('');
  document.getElementById('page-file').href =
    `../01. 페이지시안/${page.file}.html`;
  document.getElementById('page-status').textContent =
    page.key === 'map'
      ? '지도 바탕은 위치 도식입니다. Google 타일·도로 경로를 흉내 내지 않습니다. 정상 핀/선택/목록 UI를 검토하고 설치본의 실제 지도는 별도 인수합니다.'
      : ['public', 'publicPlace', 'candidate', 'search'].includes(page.key)
        ? '장소 사진 기본값은 대체 슬롯입니다. 실제 Google 사진 조회를 켜면 기존 공개 사진 API를 읽기 전용으로 조회합니다. 사진·URL은 디스크에 저장하지 않습니다.'
        : '현재 제작본은 사용자 최종 검토 전입니다. 미지원 P2 복제는 주요 버튼에서 제외했습니다.';
}

// 팝업을 닫으면 배경의 접근성과 원래 초점을 복원한다.
function closePopup() {
  // 다른 페이지를 새로 생성하지 않고 이전 원본 화면을 복원한다.
  return closeMotion(() => {
    // 닫힌 뒤에만 배경의 원래 버튼으로 초점을 돌린다.
    const focus = popupReturnFocus;
    back();
    return focus && document.querySelector(focus)?.focus();
  });
}

// 동작을 줄이거나 배경일 때는 즉시 닫고 그 외에는150ms 전환한다.
function closeMotion(done) {
  // 다른 화면으로 이동하면 이전 닫기 완료가 새 화면을 덮지 않는다.
  if (
    document.hidden ||
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.getElementById('device').classList.contains('reduce-motion')
  )
    return done();
  if (closeTimer) clearTimeout(closeTimer);
  document.getElementById('device').classList.add('closing');
  closeTimer = setTimeout(() => {
    // 애니메이션이 끝난 화면의 종료만 확정한다.
    closeTimer = null;
    document.getElementById('device').classList.remove('closing');
    return done();
  }, 150);
}

// 보기 전용 여행에서는 원본을 바꾸는 행동과 입력을 숨기거나 잠근다.
function applyReadOnly(page) {
  // 화면 이동 후에도 현재 여행의 읽기 권한을 유지한다.
  if (
    state.role !== 'viewer' ||
    page.key === 'trips' ||
    !['trips', 'exception', 'popup'].includes(page.group)
  )
    return;
  const writeTargets = new Set([
    'editor',
    'dayEditor',
    'reorder',
    'search',
    'import',
    'share',
    'metadata',
    'changePeriod',
    'flightEditor',
    'flightSearch',
    'stay',
    'expenseEditor',
    'capture',
    'recordEditor',
    'photoMethod',
    'inviteCreate',
    'memberRole',
    'memberRemove',
  ]);
  document.querySelectorAll('#device [data-go]').forEach((button) => {
    // 읽기 가능한 예약·사진·준비물·동행 진입은 남긴다.
    if (writeTargets.has(button.dataset.go)) button.remove();
  });
  document
    .querySelectorAll(
      '#phone-scroll input, #phone-scroll textarea, #phone-scroll select, #phone-scroll [data-action]',
    )
    .forEach((input) => {
      // 보기 전용 입력을 활성 폼처럼 제공하지 않는다.
      input.disabled = true;
    });
  if (!document.querySelector('#phone-footer button'))
    document.getElementById('phone-footer').innerHTML = '';
}

// 팝업 내부에 초기 초점을 두고 배경 입력을 막는다.
function focusPopup() {
  // 확인 팝업은 위험한 확정보다 취소에 먼저 초점을 둔다.
  document.getElementById('phone-header').inert = true;
  document.getElementById('phone-scroll').inert = true;
  document.getElementById('phone-footer').inert = true;
  return document
    .querySelector('[data-close-popup]')
    ?.focus({ preventScroll: true });
}

// 선택 화면을 헤더·내용·하단 행동·팝업으로 함께 갱신한다.
function render() {
  // 제품 통신 없이 메모리의 같은 원본을 읽는다.
  const page = pageByKey(state.screen);
  const base = page.kind === 'popup' ? pageByKey(page.parent) : page;
  document.getElementById('screen-menu').innerHTML = menu();
  document.getElementById('phone-header').inert = false;
  document.getElementById('phone-scroll').inert = false;
  document.getElementById('phone-footer').inert = false;
  document.getElementById('phone-header').innerHTML = header(
    page.kind === 'exception' ? page.parent : base.key,
  );
  document.getElementById('phone-scroll').innerHTML =
    `<form id="screen-form">${content(base)}</form>`;
  document.getElementById('phone-footer').innerHTML = footer(
    page.kind === 'exception'
      ? topPages.includes(page.parent)
        ? page.parent
        : page.key
      : base.key,
  );
  document.getElementById('popup-host').innerHTML =
    page.kind === 'popup'
      ? `<div class="popup-overlay"><section role="dialog" aria-modal="true" aria-labelledby="popup-title" aria-describedby="popup-description" class="popup-panel ${popups[page.key].type}">${popupContents(page.key)}</section></div>`
      : '';
  if (page.key === 'guideSource')
    document.getElementById('city-source-details').innerHTML = guideCredits();
  if (page.key === 'photoSource') showPhotoCredits();
  document
    .getElementById('device')
    .classList.toggle('startup-device', page.key === 'startup');
  document.getElementById('device').classList.toggle('large-text', state.large);
  restoreDraft();
  applyReadOnly(page);
  notes(page);
  if (page.kind === 'popup') focusPopup();
  return hydratePhotos();
}

// 이전 화면의 원래 여행·DAY·스크롤 위치로 돌아간다.
function back() {
  // 직접 연 파일에서는 정의한 상위 페이지를 사용한다.
  const saved = state.history.pop();
  state.screen = saved?.screen || pageByKey(state.screen).parent || 'home';
  state.tripId = saved?.tripId || state.tripId;
  state.day = saved?.day || state.day;
  state.placeId = saved?.placeId || state.placeId;
  document.getElementById('device').classList.remove('detail-enter');
  render();
  document.getElementById('phone-scroll').scrollTop = saved?.scroll || 0;
  return updateUrl();
}

// 화면 이동 이력에는 날짜와 장소 맥락도 보존한다.
function navigate(key, options = {}) {
  // 검토 목록의 직접 이동과 고객의 실제 동선을 구분한다.
  if (!pageByKey(key)) throw new Error(`정의되지 않은 화면: ${key}`);
  if (closeTimer) clearTimeout(closeTimer);
  document.getElementById('device').classList.remove('closing');
  if (forms.has(state.screen)) captureDraft();
  state.history.push({
    screen: state.screen,
    tripId: state.tripId,
    day: state.day,
    placeId: state.placeId,
    scroll: document.getElementById('phone-scroll').scrollTop,
  });
  if (options.trip) state.tripId = options.trip;
  if (options.trip || options.catalog) state.role = 'owner';
  if (key === 'forbidden') state.role = 'viewer';
  if (options.place) state.placeId = options.place;
  if (
    options.catalog &&
    ['diary', 'recordEditor', 'footprints', 'publicRecord'].includes(key)
  )
    state.tripId = 'osaka-record';
  if (key === 'publicPlace')
    state.publicContext = state.screen === 'preview' ? 'preview' : 'public';
  if (key === 'photoMethod')
    state.photoMode = ['recordEditor', 'photo', 'media'].includes(state.screen)
      ? 'photo'
      : 'receipt';
  if (options.add) state.adding = true;
  else if (
    key !== 'editor' &&
    !['time', 'location', 'currency', 'leave'].includes(key)
  )
    state.adding = false;
  popupReturnFocus =
    pageByKey(key).kind === 'popup'
      ? `${options.catalog ? '#screen-menu' : '#device'} [data-go="${key}"]`
      : popupReturnFocus;
  state.screen = key;
  if (
    ['preview', 'public', 'publicRecord'].includes(key) &&
    !publicSnapshot().places.some((place) => {
      // 선택 해제한 DAY를 보고 빈 미리보기를 표시하지 않는다.
      return place.day === state.day;
    })
  )
    state.day = publicSnapshot().places[0]?.day || 1;
  render();
  document.getElementById('phone-scroll').scrollTop = 0;
  updateUrl();
  document
    .getElementById('device')
    .classList.toggle(
      'detail-enter',
      ['place', 'publicPlace', 'candidate'].includes(key),
    );
  return feedback(
    '디자인 예시 안에서 이동했습니다. 실제 서비스 데이터는 변경하지 않았습니다.',
  );
}

// 현재 화면을 URL로 다시 직접 열 수 있게 한다.
function updateUrl() {
  // 페이지 URL에 입력값이나 인증 정보를 포함하지 않는다.
  return history.replaceState(
    null,
    '',
    `${location.pathname}${location.search}#${state.screen}`,
  );
}

// 입력 폼의 기본 검증을 저장 전에 적용한다.
function formValues() {
  // 필수값·날짜·형식 오류를 해당 입력과 연결한다.
  return document.getElementById('screen-form').reportValidity()
    ? Object.fromEntries(new FormData(document.getElementById('screen-form')))
    : null;
}

// 화면의 메모리 반영만 수행하고 서버 성공을 가장하지 않는다.
function save() {
  // 폼 입력은 기존 필드의 역할에 맞춰 반영한다.
  const values = formValues();
  if (!values) return;
  captureDraft();
  if (state.screen === 'dayEditor')
    state.days[state.day - 1] = {
      ...state.days[state.day - 1],
      title: values.dayTitle,
      intro: values.dayIntro,
    };
  if (state.screen === 'editor') {
    const updated = {
      ...currentPlace(),
      name: values.name,
      day: Number(values.day),
      time: values.time,
      type: values.type,
      description: values.description,
      tip: '',
      memo: values.memo,
      address: values.address,
      choiceGroup:
        currentPlace().choiceGroup ||
        (values.choiceLabel ? 'local-choice' : ''),
      choiceLabel: values.choiceLabel,
      choiceKind: values.choiceKind,
      duration: values.duration,
    };
    if (state.adding)
      state.places.push({ ...updated, id: `local-${state.places.length + 1}` });
    else
      state.places[
        state.places.findIndex((item) => {
          // 같은 이름이 아닌 실제 선택 ID를 갱신한다.
          return item.id === state.placeId;
        })
      ] = updated;
    state.day = updated.day;
  }
  if (
    ['profile', 'onboarding'].includes(state.screen) &&
    (new TextEncoder().encode(values.nickname).length < 2 ||
      new TextEncoder().encode(values.nickname).length > 20)
  ) {
    document
      .querySelector('[name="nickname"]')
      .setCustomValidity('닉네임은 공백 포함 2~20바이트로 입력해 주세요.');
    return document.querySelector('[name="nickname"]').reportValidity();
  }
  if (state.screen === 'signup' && values.password !== values.passwordConfirm) {
    document
      .querySelector('[name="passwordConfirm"]')
      .setCustomValidity('비밀번호가 서로 달라요. 다시 확인해 주세요.');
    return document.querySelector('[name="passwordConfirm"]').reportValidity();
  }
  navigate(writeBack[state.screen] || 'schedule');
  return feedback(
    '작성값을 디자인 예시에만 반영했습니다. 실제 서버 저장 요청은 보내지 않았습니다.',
  );
}

// 사진 응답은 메모리에서만 읽고 URL을 파일로 보관하지 않는다.
async function hydratePhotos() {
  // 사용자가 읽기 전용 실제 사진 확인을 켠 경우에만 요청한다.
  if (!livePhotos) return;
  return Promise.all(
    [...document.querySelectorAll('[data-place-card]')].map(async (element) => {
      // 같은 장소를 다시 렌더링해도 같은 검토 세션에서 중복 조회하지 않는다.
      const id = element.dataset.placeCard;
      if (!photoData.has(id))
        photoData.set(
          id,
          fetch(`photos/${id}`)
            .then((response) => {
              // 공급자 오류는 다른 장소 사진으로 대체하지 않는다.
              return response.json().then((result) => {
                // 한도·사진 없음·통신 실패를 같은 빈 사진으로 숨기지 않는다.
                return { ...result, status: response.status };
              });
            })
            .catch(() => {
              // 실패한 요청의 원문·키를 화면에 넣지 않는다.
              return { status: 0 };
            }),
        );
      const result = await photoData.get(id);
      const data = result?.data;
      if (!element.isConnected) return;
      if (!data?.imageUrl) return photoFailure(element, id, result?.status);
      const image = document.createElement('img');
      image.className = 'thumb';
      image.alt = 'Google Maps에 등록된 장소 사진';
      image.src = data.imageUrl;
      image.referrerPolicy = 'no-referrer';
      const original = document.createElement('a');
      original.href = data.sourceUrl;
      original.target = '_blank';
      original.rel = 'noreferrer';
      original.className = 'photo-thumb-link';
      original.setAttribute('aria-label', 'Google Maps 원본 사진 열기');
      original.append(image);
      element.querySelector('.thumb')?.replaceWith(original);
      image.addEventListener('error', () => {
        // 늦은 이미지 실패를 닫힌 화면에 적용하지 않는다.
        if (!element.isConnected) return;
        original.remove();
        return photoFailure(element, id, 0);
      });
      element.dataset.photoState = 'ready';
      const link = document.createElement('a');
      link.className = 'photo-credit';
      link.textContent = 'Google Maps';
      link.href = data.sourceUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      return (element.querySelector('.card') || element).append(link);
    }),
  );
}

// 사진 없음·일시 실패·한도 응답에 서로 다른 복구를 표시한다.
function photoFailure(element, id, status) {
  // 다른 장소의 사진이나 성공 상태로 바꾸지 않는다.
  element.dataset.photoState =
    status === 200 || status === 404
      ? 'empty'
      : status === 429
        ? 'limited'
        : 'error';
  const notice = document.createElement('div');
  notice.className = 'photo-failure';
  notice.innerHTML = `<p class="meta">${status === 200 || status === 404 ? '등록된 사진이 없어요.' : status === 429 ? '사진 요청이 많아요. 잠시 후 다시 불러와 주세요.' : '사진을 불러오지 못했어요.'}</p>${status === 200 || status === 404 ? '' : `<button class="button quiet" data-retry-photo="${id}">사진 다시 불러오기</button>`}`;
  return (element.querySelector('.card') || element).append(notice);
}

// 실제 사진 응답의 저작자·원본만 정보 시트에 표시한다.
async function showPhotoCredits() {
  // 사진을 조회하지 않았으면 원본 링크나 저작자를 만들어내지 않는다.
  const data = (await photoData.get(state.placeId))?.data;
  if (!data) return;
  const host = document.getElementById('place-photo-credits');
  if (!host) return;
  return (host.innerHTML = `<p>Google Maps</p>${data.authors
    .map((author) => {
      // 응답의 표시 이름과 제공자 링크를 안전하게 연결한다.
      return `<p>${author.url ? `<a href="${escapeText(author.url)}" target="_blank" rel="noreferrer">${escapeText(author.name)}</a>` : escapeText(author.name)}</p>`;
    })
    .join(
      '',
    )}<a href="${escapeText(data.sourceUrl)}" target="_blank" rel="noreferrer">원본 사진 보기 ↗</a>`);
}

// 단일 명령의 UI 동작을 명시적으로 분배한다.
function runAction(command) {
  // 각 기능은 책임이 나뉜 작은 처리 함수로 전달한다.
  return (
    {
      save,
      back: returnToOrigin,
      publish: publishPreview,
      withdraw: withdrawPreview,
      clearFilters,
      chooseCity,
      saveOrder,
      moveUp: movePlace,
      moveDown: movePlace,
      choosePeriod: returnToParent,
      chooseTime,
      discardDraft,
      deleteSchedule: returnToParent,
    }[command] || showExternalScope
  )();
}

// 공개 확정 때만 선택 내용을 별도 사본으로 고정한다.
function publishPreview() {
  // 선택0건에서는 공개 완료로 진행하지 않는다.
  if (!state.selected.length) return;
  state.publication = structuredClone(previewSnapshot());
  state.publicationWithdrawn = false;
  navigate('published');
  return feedback(
    '선택한 내용의 공개 예시를 만들었습니다. 실제 서버에는 게시하지 않았습니다.',
  );
}

// 공개 중단 예시에서도 개인 원본은 지우지 않는다.
function withdrawPreview() {
  // 공개 사본과 개인 원본 삭제를 구분한다.
  state.publicationWithdrawn = true;
  navigate('publications');
  return feedback(
    '공개 중단 화면 예시입니다. 실제 공개 데이터는 변경하지 않았습니다.',
  );
}

// 검색 조건만 초기화한다.
function clearFilters() {
  // 여행 원본은 삭제하지 않는다.
  state.query = '';
  state.tripFilter = '전체';
  return render();
}

// 입력한 도시는 선택한 나라와 함께 복귀 화면에 전달한다.
function chooseCity() {
  // 도시 미입력을 다른 나라의 도시로 채우지 않는다.
  state.city = document.querySelector('[name="cityName"]').value;
  return back();
}

// 순서 편집의 디자인 예시를 원래 DAY로 되돌린다.
function saveOrder() {
  // 실제 순서 저장 API를 보낸 것처럼 표시하지 않는다.
  return navigate('schedule');
}

// 순서 변경 행동의 실제 처리 범위를 안내한다.
function movePlace() {
  // 실행하지 않은 처리를 성공으로 안내하지 않는다.
  return feedback(
    '순서 버튼 배치를 확인할 수 있습니다. 실제 순서 변경은 앱의 기존 기능에서 검증합니다.',
  );
}

// 확인 뒤 안전한 원래 화면으로 돌아간다.
function returnToParent() {
  // 실제 삭제·기간 변경은 서버에 보내지 않는다.
  back();
  return feedback(
    '확인 뒤의 화면 예시입니다. 실제 데이터 삭제·변경은 실행하지 않았습니다.',
  );
}

// 원문 읽기에서 돌아갈 때만 오른쪽 닫기 전환을 사용한다.
function returnToOrigin() {
  // 같은 DAY와 목록 스크롤은 기존 뒤로가기가 복원한다.
  return ['place', 'publicPlace', 'candidate'].includes(state.screen)
    ? closeMotion(back)
    : back();
}

// 나가기를 확정하면 작성 폼을 거쳐 이전 목적지로 빠져나간다.
function discardDraft() {
  // 취소의 계속 작성과 다른 결과를 유지한다.
  return closeMotion(() => {
    // 현재 팝업의 폼 복귀 이력과 작성 화면 이력을 각각 소비한다.
    state.history.pop();
    delete state.drafts[draftKey('editor')];
    const destination = state.history.pop();
    state.screen = destination?.screen || 'schedule';
    render();
    return updateUrl();
  });
}

// 선택 시각을 원래 일정 작성의 임시 입력에 돌려준다.
function chooseTime() {
  // 미정 선택은 빈 시각으로 보존한다.
  state.drafts[draftKey('editor')] = {
    ...(state.drafts[draftKey('editor')] || {}),
    time: document.querySelector('[name="timeUnknown"]').checked
      ? ''
      : document.querySelector('[name="chosenTime"]').value,
  };
  return closePopup();
}

// 인증·촬영 등 외부 환경이 필요한 동작을 구분한다.
function showExternalScope() {
  // 가짜 로그인이나 가상의 인식 성공은 만들지 않는다.
  return feedback(
    '이 작업은 디자인 확인만 합니다. 실제 인증·촬영·설정 변경·서버 처리는 실행하지 않습니다.',
  );
}

// 누른 행동과 목적지를 확인해 처리한다.
function click(event) {
  // 제품 안과 검토 도구의 버튼을 같은 화면 정의로 연결한다.
  const target = event.target.closest('button');
  if (!target) return;
  event.preventDefault();
  if (target.dataset.retryPhoto) {
    photoData.delete(target.dataset.retryPhoto);
    return render();
  }
  if (target.dataset.closePopup !== undefined)
    return target.dataset.cancelTarget
      ? navigate(target.dataset.cancelTarget)
      : closePopup();
  if (target.hasAttribute('data-back'))
    return ['place', 'publicPlace', 'candidate'].includes(state.screen)
      ? closeMotion(back)
      : forms.has(state.screen) && state.drafts[draftKey()]
        ? navigate('leave')
        : back();
  if (target.dataset.go)
    return pageByKey(state.screen).kind === 'popup'
      ? closeMotion(() => {
          // 시트 선택 뒤 닫기 전환이 끝나면 목적 화면을 연다.
          return navigate(target.dataset.go, {
            place: target.dataset.place,
            trip: target.dataset.trip,
            catalog: target.hasAttribute('data-catalog'),
            add: target.hasAttribute('data-add-place'),
          });
        })
      : navigate(target.dataset.go, {
          place: target.dataset.place,
          trip: target.dataset.trip,
          catalog: target.hasAttribute('data-catalog'),
          add: target.hasAttribute('data-add-place'),
        });
  if (target.dataset.action) return runAction(target.dataset.action);
  if (target.dataset.day) {
    state.day = Number(target.dataset.day);
    state.placeId =
      (['public', 'publicRecord', 'preview'].includes(state.screen)
        ? publicSnapshot().places
        : state.places
      ).find((place) => {
        // DAY 전환 뒤에도 이전 날짜의 장소 카드가 남지 않게 한다.
        return place.day === state.day;
      })?.id || state.placeId;
    return render();
  }
  if (target.dataset.pin) {
    state.placeId = target.dataset.pin;
    return render();
  }
  if (target.dataset.filter) {
    state.tripFilter = target.dataset.filter;
    return render();
  }
  if (target.dataset.cost) {
    state.costMode = target.dataset.cost;
    return render();
  }
  if (target.dataset.country) {
    state.country = target.dataset.country;
    state.city = '';
    return back();
  }
  if (target.dataset.city) {
    state.city = target.dataset.city;
    return back();
  }
}

// 입력과 선택을 화면의 메모리 원본에 반영한다.
function input(event) {
  // 검토 도구 검색과 앱 입력을 구분한다.
  const target = event.target;
  if (target.id === 'catalog-query')
    return (document.getElementById('screen-menu').innerHTML = menu());
  if (!target.closest('#phone-scroll')) return;
  if (target.setCustomValidity) target.setCustomValidity('');
  if (target.name === 'tripQuery') {
    state.query = target.value;
    const cursor = target.selectionStart;
    render();
    document.querySelector('[name="tripQuery"]').focus();
    return document
      .querySelector('[name="tripQuery"]')
      .setSelectionRange(cursor, cursor);
  }
  if (target.name === 'discoverQuery') state.discoverQuery = target.value;
  if (forms.has(state.screen)) return captureDraft();
}

// 다중 선택·표시 설정의 변경을 명시적으로 처리한다.
function change(event) {
  // DAY 버튼과 다른 다중 선택의 체크 의미를 유지한다.
  const target = event.target;
  if (target.name === 'discoverKind') state.discoverKind = target.value;
  if (target.name === 'discoverDays') state.discoverDays = target.value;
  if (
    target.closest('#phone-scroll') &&
    ![
      'sharePlace',
      'sharePhotos',
      'shareCosts',
      'shareKind',
      'undated',
      'checklist',
      'discoverKind',
      'discoverDays',
      'discoverQuery',
    ].includes(target.name)
  )
    return;
  if (target.name === 'sharePlace')
    state.selected = target.checked
      ? [...new Set([...state.selected, target.dataset.place])]
      : state.selected.filter((id) => {
          // 선택 해제한 ID만 제거한다.
          return id !== target.dataset.place;
        });
  if (target.name === 'sharePhotos') state.selectedPhotos = target.checked;
  if (target.name === 'shareCosts') state.includeCosts = target.checked;
  if (target.name === 'shareKind') state.shareKind = target.value;
  if (target.name === 'undated') state.undated = target.checked;
  if (target.name === 'checklist')
    state.checks = target.checked
      ? [...state.checks, target.dataset.item]
      : state.checks.filter((item) => {
          // 선택한 준비물의 완료 여부만 바꾼다.
          return item !== target.dataset.item;
        });
  if (target.id === 'review-width') state.width = Number(target.value);
  if (target.id === 'review-large') state.large = target.checked;
  if (target.id === 'review-long') state.long = target.checked;
  if (target.id === 'review-motion')
    document
      .getElementById('device')
      .classList.toggle('reduce-motion', target.checked);
  if (target.id === 'review-photos') livePhotos = target.checked;
  if (target.id === 'review-state' && target.value !== 'normal')
    return navigate(
      target.value === 'empty'
        ? {
            home: 'emptyHome',
            schedule: 'emptySchedule',
            search: 'emptySearch',
            cost: 'emptyCost',
            footprints: 'emptyFootprints',
          }[state.screen] || 'emptyHome'
        : forms.has(state.screen)
          ? 'saveError'
          : 'loadError',
    );
  document
    .getElementById('device')
    .style.setProperty('--phone-width', `${state.width}px`);
  document
    .getElementById('device')
    .style.setProperty('--zoom', state.large ? '2' : '1');
  document.getElementById('screen-size').textContent = `${state.width} × 844`;
  return render();
}

// 팝업의 Escape·Tab과 원래 화면의 뒤로가기를 구분한다.
function keydown(event) {
  // 배경으로 초점이 새지 않도록 팝업 안에서 순환한다.
  if (pageByKey(state.screen).kind !== 'popup') return;
  if (event.key === 'Escape') {
    event.preventDefault();
    return closePopup();
  }
  if (event.key !== 'Tab') return;
  const controls = [
    ...document.querySelectorAll(
      '.popup-panel button:not(:disabled), .popup-panel input, .popup-panel select, .popup-panel textarea, .popup-panel a',
    ),
  ];
  const next =
    controls.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1);
  if (next < 0 || next >= controls.length) {
    event.preventDefault();
    return controls[(next + controls.length) % controls.length]?.focus();
  }
}

// URL과 번호가 있는 파일을 같은 초기 화면으로 처리한다.
function initialize() {
  // 비밀값이나 개인 계정을 URL에서 읽지 않는다.
  const query = new URLSearchParams(location.search);
  state.screen =
    pageByKey(location.hash.slice(1))?.key ||
    pageByKey(query.get('screen'))?.key ||
    document.body.dataset.screen ||
    'home';
  state.role = state.screen === 'forbidden' ? 'viewer' : 'owner';
  state.width = Number(query.get('width')) || 390;
  state.large = query.get('large') === '1';
  state.long = query.get('long') === '1';
  state.day = Math.min(4, Math.max(1, Number(query.get('day')) || 1));
  state.placeId =
    state.places.find((place) => {
      // 번호별 직접 진입에서도 같은 DAY의 첫 장소를 읽는다.
      return place.day === state.day;
    })?.id || 'p1';
  if (
    ['diary', 'recordEditor', 'publicRecord', 'footprints'].includes(
      state.screen,
    )
  )
    state.tripId = 'osaka-record';
  state.publication = structuredClone(previewSnapshot());
  if (query.get('capture') === '1') document.body.classList.add('capture-mode');
  document
    .getElementById('device')
    .style.setProperty('--phone-width', `${state.width}px`);
  document
    .getElementById('device')
    .style.setProperty('--zoom', state.large ? '2' : '1');
  document.getElementById('review-width').value = String(state.width);
  document.getElementById('review-large').checked = state.large;
  document.getElementById('review-long').checked = state.long;
  document.getElementById('screen-size').textContent = `${state.width} × 844`;
  return render();
}

document.addEventListener('click', click);
document.addEventListener('input', input);
document.addEventListener('change', change);
document.addEventListener('keydown', keydown);
document.addEventListener('submit', (event) => {
  // Enter로 폼을 외부 전송하지 않는다.
  event.preventDefault();
  return save();
});
document.addEventListener('visibilitychange', () => {
  // 백그라운드에서는 진행 중인 화면 전환을 남기지 않는다.
  return document
    .getElementById('device')
    .classList.toggle('backgrounded', document.hidden);
});
initialize();
