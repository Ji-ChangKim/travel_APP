import { brand } from './brand-data.mjs';
import {
  action,
  button,
  card,
  check,
  field,
  haru,
  icon,
  select,
  textarea,
} from './components.mjs';

// 현행 토큰·원본 아이콘·하루·반응 상태를 한 화면에서 대조한다.
export function designSystem() {
  // 화면 수치를 새로 추정하지 않고 현재 공통 규격을 보여준다.
  return `<section class="stack"><p class="meta">TripPrint · Page Design System</p><h2>하루와 함께하는 여행 노트</h2><p>계획을 만들고, 여행 중 확인하고, 남길 내용을 직접 골라요.</p></section><section class="stack"><h2>색과 읽기</h2><div class="swatch-grid">${[
    ['navy', '#203247', '본문'],
    ['coral', '#FF6B57', '주 행동'],
    ['canvas', '#FFF9F3', '화면'],
    ['secondary', '#596574', '보조'],
    ['link', '#A43E31', '링크'],
  ]
    .map(([key, value, label]) => {
      // 밝은 색 위 작은 흰 글자를 샘플로 만들지 않는다.
      return `<div class="swatch"><span style="background:${value}"></span><strong>${label}</strong><p class="meta">${value}</p><p class="meta">${key}</p></div>`;
    })
    .join(
      '',
    )}</div></section><section class="type-samples"><h2>제목 26 / 36</h2><h3>장소명 18 / 26</h3><p>본문 16 / 26 · 한글과 숫자 모두 Pretendard</p><p class="meta">보조 14 / 22 · 하단 메뉴만 13 / 20</p><p class="meta">화면 여백20 · 카드 안16 · 묶음12 · 섹션24</p></section><section class="stack"><h2>버튼과 상태</h2>${action('주요 행동 · 기본', 'sample', 'primary')}${action('보조 행동', 'sample')}${action('위험한 행동', 'sample', 'danger')}${action('처리 중 · 잠금', 'sample', '', 'disabled aria-busy="true"')}${action('키보드 초점', 'sample', 'focus-sample')}${button('진한 링크 행동', 'schedule', 'quiet')}</section><section class="stack"><h2>입력과 선택</h2>${field('라벨이 있는 입력', 'systemInput', '', 'text', 'placeholder="입력 예시"')}${field('오류가 있는 입력', 'systemError', '', 'text', 'aria-invalid="true" aria-describedby="sample-error"')}<p id="sample-error" class="field-error">여행 이름을 입력해 주세요.</p>${select('선택 입력', 'systemSelect', ['JPY · 일본 엔', 'KRW · 한국 원', 'USD · 미국 달러'])}${textarea('장문 설명', 'systemDescription', '원문 줄바꿈과 글자 배율을 유지해요.')}${check('다중 선택 · 라벨 전체 터치', 'systemCheck', true)}<div class="days"><button aria-pressed="true" data-day="1">DAY 1</button><button aria-pressed="false" data-day="2">DAY 2</button></div></section>${card('일반 카드 · 모서리16', '<p>장소와 설명, 다음 행동을 한 묶음으로 읽어요.</p>')}<section class="stack"><h2>브랜드 자산</h2><img class="brand" src="assets/logo.svg" alt="TripPrint"/>${haru('empty')}<p class="meta">하루는 빈 화면·오류 복구·첫 시작에 사용해요. 기록과 비용 숫자를 가리지 않아요.</p></section><section class="stack"><h2>공식 아이콘 ${brand.icons.length}개</h2><p class="meta">24px · 원본 선2px · 원본 예외2.5px</p><div class="icon-catalog">${brand.icons
    .map((item) => {
      // 원본 파일의 도형과 색을 다시 그리지 않는다.
      return `<div><img class="ui-icon" src="assets/icons/${item.file}" alt=""/><p class="meta">${item.label}</p></div>`;
    })
    .join(
      '',
    )}</div></section><section class="stack"><h2>팝업·예외</h2>${button('확인 팝업', 'leave')}${button('선택 시트', 'tripMenu')}${button('원문 상세 · 우→좌', 'place')}${button('빈 화면', 'emptyHome')}${button('오류와 복구', 'saveError')}${button('위치 권한', 'locationDenied')}</section><section class="stack"><h2>접근성과 전환</h2><p>터치48 이상 · 주요 버튼52 · 입력48 · 초점선2</p><p>오른쪽 진입200ms · 닫기150ms. 동작 줄이기와 백그라운드에서는 즉시 전환해요.</p><p>팝업은 배경을 잠그고, 닫으면 열었던 버튼으로 초점을 돌려요.</p>${icon('info')}</section>`;
}
