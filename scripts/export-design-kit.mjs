import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFile = 'docs/design/sources/stitch-icon-library.html';
const destination = 'apps/mobile/assets/icons/tripprint';
const formatOptions = await resolveConfig(
  path.join(root, 'docs/design/icon-catalog.html'),
);
const groupNames = {
  navigation: '탐색',
  category: '여행 분류',
  action: '동작',
  utility: '도구',
  status: '상태',
};
const names = [
  'home',
  'compass',
  'plus',
  'journal',
  'user',
  'restaurant',
  'cafe',
  'bar',
  'grocery',
  'flight',
  'metro',
  'bus',
  'taxi',
  'hotel',
  'guesthouse',
  'landmark',
  'museum',
  'shopping',
  'activity',
  'receipt-scan',
  'share',
  'filter',
  'checklist',
  'search',
  'lock',
  'bookmark',
  'calendar',
  'clock',
  'sun',
  'rain',
  'navigation',
  'tag',
  'heart',
  'ticket',
  'luggage',
  'route',
  'bell',
  'sliders',
  'refresh',
  'map-pin',
  'star',
];
const labels = [
  '홈',
  '탐색',
  '추가',
  '여행 기록',
  '내 정보',
  '식당',
  '카페',
  '바',
  '마트',
  '항공편',
  '지하철',
  '버스',
  '택시',
  '호텔',
  '게스트하우스',
  '관광명소',
  '박물관',
  '쇼핑',
  '액티비티',
  '영수증 스캔',
  '공유',
  '필터',
  '준비물',
  '검색',
  '비공개',
  '북마크',
  '달력',
  '시각',
  '맑음',
  '비',
  '길 안내',
  '분류',
  '좋아요',
  '티켓',
  '짐',
  '동선',
  '알림',
  '세부 설정',
  '새로고침',
  '장소',
  '별점',
];

function hash(value) {
  // 원본과 내보낸 파일의 변경 여부를 해시로 식별한다.
  return crypto.createHash('sha256').update(value).digest('hex');
}

function group(index) {
  // 원본 카드 순서를 의미별 탐색 그룹에 대응한다.
  return index < 5
    ? 'navigation'
    : index < 19
      ? 'category'
      : index < 25
        ? 'action'
        : 'utility';
}

function resolveVariant(index, variant, svg) {
  // 선택 상태와 색상 이름 대신 실제 벡터 표현을 이름에 기록한다.
  return index === 1 && variant === 1
    ? 'duotone'
    : variant === 1 || /^<svg[^>]*fill="currentColor"/.test(svg)
      ? 'filled'
      : /#ff6b57/i.test(svg)
        ? 'duotone'
        : 'outline';
}

function xmlEscape(value) {
  // 카탈로그의 텍스트가 HTML 코드로 해석되지 않게 한다.
  return value.replace(/[&<>"']/g, (character) => {
    // 특수 문자를 표준 엔티티로 바꾼다.
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character];
  });
}

function makeEntry(item, name, label, variant, section, locator) {
  // 하나의 벡터와 재추적 가능한 원본 위치를 묶는다.
  return {
    id: `${name}-${variant}`,
    name,
    label,
    variant,
    group: section,
    file: `icon-${name}-${variant}.svg`,
    source: { file: sourceFile, locator, label: item.label },
    sourceBounds: item.bounds,
    svg: item.svg,
  };
}

function svgContent(entry) {
  // 경계 밖 원본만 동일 비율로 축소하고 경로 좌표는 보존한다.
  return entry.svg.replace(
    /<svg([^>]*)>([\s\S]*)<\/svg>/,
    (_match, attributes, children) => {
      // 원본 경계에 맞춰 잘림 방지 변환을 선택한다.
      return `<svg${attributes}>${boundedChildren(entry, children)}</svg>\n`;
    },
  );
}

function boundedChildren(entry, children) {
  // 원본에서 캔버스를 벗어나는 항공편 등은 안전한 내부 영역에 맞춘다.
  return entry.sourceBounds &&
    (entry.sourceBounds.x < 1 ||
      entry.sourceBounds.y < 1 ||
      entry.sourceBounds.x + entry.sourceBounds.width > 23 ||
      entry.sourceBounds.y + entry.sourceBounds.height > 23)
    ? `<g stroke-width="${2 / (20 / Math.max(entry.sourceBounds.width, entry.sourceBounds.height))}" transform="translate(12 12) scale(${20 / Math.max(entry.sourceBounds.width, entry.sourceBounds.height)}) translate(${-entry.sourceBounds.x - entry.sourceBounds.width / 2} ${-entry.sourceBounds.y - entry.sourceBounds.height / 2})">${children}</g>`
    : children;
}

function iconCard(entry) {
  // 로컬 벡터와 파일명을 같은 카드에서 비교한다.
  return `<article class="icon-card" data-search="${xmlEscape(`${entry.id} ${entry.label} ${entry.source.label}`.toLowerCase())}" data-group="${entry.group}"><div class="icon">${entry.svg}</div><strong>${entry.label}</strong><span>${entry.variant}</span><a href="../../${destination}/${entry.file}" download>${entry.file}</a></article>`;
}

function makeCatalog(entries) {
  // 외부 요청 없이 크기·색상·검색·분류를 확인하는 카탈로그를 만든다.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TripPrint 아이콘 카탈로그</title><style>
  @font-face{font-family:Pretendard;src:url('../../apps/mobile/assets/brand/tripprint-v1/fonts/PretendardVariable.woff2') format('woff2');font-display:swap}
  :root{--icon-size:24px;--icon-color:#203247;color:#203247;background:#fef8f2;font-family:Pretendard,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0}main{max-width:1280px;margin:auto;padding:32px 24px}h1{font-size:32px;letter-spacing:-.03em;margin:8px 0}p{line-height:1.65}.eyebrow{font-size:13px;color:#c84432;font-weight:700}.swatches{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.swatch{background:#fff;border-radius:12px;padding:12px;display:flex;align-items:center;gap:8px}.swatch i{width:24px;height:24px;border-radius:8px;background:var(--swatch)}.controls{display:flex;flex-wrap:wrap;gap:12px;background:#fff;padding:16px;border-radius:16px;position:sticky;top:0;z-index:1;box-shadow:0 4px 20px #2032470d}label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}input,select{min-height:44px;border:1px solid #dfd9d3;border-radius:8px;padding:10px;color:#203247;background:#f8f3ed;font:inherit}input[type=search]{min-width:240px}input:focus-visible,select:focus-visible,a:focus-visible{outline:2px solid #186779;outline-offset:3px}.count{font-size:14px;margin:20px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.icon-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 12px;background:#fff;border-radius:16px;box-shadow:0 2px 10px #2032470a;min-width:0}.icon{height:64px;display:flex;align-items:center;color:var(--icon-color)}.icon svg{width:var(--icon-size);height:var(--icon-size);overflow:visible}.icon-card span{color:#4a5d73;font-size:12px}.icon-card a{font-size:11px;overflow-wrap:anywhere;text-align:center;color:#186779}.icon-card[hidden]{display:none}.note{padding:16px;background:#e9f7fc;border-radius:12px;font-size:13px;margin-top:28px}@media(max-width:430px){main{padding:20px 16px}h1{font-size:26px}.controls{position:static}.controls label{width:100%}input[type=search]{min-width:0;width:100%}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.icon-card{padding:16px 8px}}
  </style></head><body><main><div class="eyebrow">TRIPPRINT · DESIGN RESOURCE v1.0</div><h1>아이콘 모음</h1><p>스티치 원본에서 추출한 벡터를 이름·크기·색상별로 확인합니다.</p><div class="swatches"><div class="swatch"><i style="--swatch:#ff6b57"></i>Trip Coral #FF6B57</div><div class="swatch"><i style="--swatch:#203247"></i>Journey Navy #203247</div><div class="swatch"><i style="--swatch:#fef8f2"></i>Warm Ivory #FEF8F2</div></div><div class="controls"><label>아이콘 검색<input id="search" type="search" placeholder="장소, camera, flight…"></label><label>분류<select id="group"><option value="">전체</option>${Object.entries(
    groupNames,
  )
    .map(([value, label]) => {
      /* 그룹을 선택 항목으로 표시한다. */ return `<option value="${value}">${label}</option>`;
    })
    .join('')}</select></label><label>크기<select id="size">${[
    16, 20, 24, 32, 48,
  ]
    .map((size) => {
      /* 원본의 다섯 크기를 제공한다. */ return `<option ${size === 24 ? 'selected' : ''}>${size}</option>`;
    })
    .join(
      '',
    )}</select></label><label>기본 색상<select id="color"><option value="#203247">네이비</option><option value="#C84432">코랄 텍스트</option><option value="#186779">틸</option><option value="#FF6B57">브랜드 코랄</option></select></label></div><p id="count" class="count" aria-live="polite"></p><div class="grid">${entries.map(iconCard).join('')}</div><p class="note">24×24 기준 · 기본 2px 선 · 원본 FAB/상태 2.5px 예외 유지 · 투톤 포인트 #FF6B57. 일정 화면은 이 자산을 TripIcon으로 불러옵니다.</p></main><script>
  function matches(card){ /* 검색어와 선택 분류가 일치하는 카드만 찾는다. */ return card.dataset.search.includes(document.querySelector('#search').value.trim().toLowerCase()) && (!document.querySelector('#group').value || card.dataset.group === document.querySelector('#group').value); }
  function updateVisibility(){ /* 각 카드의 숨김 상태를 갱신한다. */ return document.querySelectorAll('.icon-card').forEach(card=>{ /* 카드 한 개의 검색 결과를 반영한다. */ return card.hidden=!matches(card); }); }
  function updateCount(){ /* 현재 보이는 아이콘 개수를 알린다. */ return document.querySelector('#count').textContent=document.querySelectorAll('.icon-card:not([hidden])').length+'개 / 전체 ${entries.length}개'; }
  function updateSize(){ /* 선택 크기를 벡터에 적용한다. */ return document.documentElement.style.setProperty('--icon-size',document.querySelector('#size').value+'px'); }
  function updateColor(){ /* 단색 선과 채움의 현재 색을 변경한다. */ return document.documentElement.style.setProperty('--icon-color',document.querySelector('#color').value); }
  document.querySelector('#search').addEventListener('input',()=>{ /* 검색 결과의 표시와 개수를 차례로 갱신한다. */ return (updateVisibility(),updateCount()); });
  document.querySelector('#group').addEventListener('change',()=>{ /* 분류 결과의 표시와 개수를 차례로 갱신한다. */ return (updateVisibility(),updateCount()); });
  document.querySelector('#size').addEventListener('change',updateSize);document.querySelector('#color').addEventListener('change',updateColor);updateCount();
  </script></body></html>`;
}

await fs.mkdir(path.join(root, destination), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.route('**/*', (route) => {
    // 저장한 원본의 CDN 스크립트와 외부 자산 요청은 실행하지 않는다.
    return route.abort();
  });
  const page = await context.newPage();
  await page.setContent(await fs.readFile(path.join(root, sourceFile), 'utf8'));
  const extracted = await page.evaluate(() => {
    // 원본 인라인 벡터만 안전한 독립 SVG로 정리한다.
    return [
      ...document.querySelectorAll(
        '.icon-card,.icon-item,#status-icons > div:last-child > div,#principles svg',
      ),
    ].flatMap((node) => {
      // 원본 카드와 원칙 예시의 SVG를 추출한다.
      return (
        node.tagName.toLowerCase() === 'svg'
          ? [node]
          : [...node.querySelectorAll('svg')]
      ).map((svg, variant) => {
        // 화면 장식 속성을 제외하고 벡터 속성만 보존한다.
        return {
          label: node.textContent.replace(/\s+/g, ' ').trim(),
          variant,
          selector:
            node.tagName.toLowerCase() === 'svg'
              ? 'principles'
              : node.closest('section')?.id,
          bounds: {
            x: svg.getBBox().x,
            y: svg.getBBox().y,
            width: svg.getBBox().width,
            height: svg.getBBox().height,
          },
          svg: cleanVector(svg),
        };
      });
    });

    function cleanVector(svg) {
      // 원본 도형을 복제하여 외부 의존성 없는 SVG로 변환한다.
      return cleanRoot(svg.cloneNode(true));
    }
    function cleanRoot(svg) {
      // 채움 클래스의 의미를 SVG 속성으로 옮기고 표현 클래스를 제거한다.
      return (
        svg.classList.contains('fill-current') &&
          svg.setAttribute('fill', 'currentColor'),
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'),
        svg.setAttribute('width', '24'),
        svg.setAttribute('height', '24'),
        [...svg.querySelectorAll('*'), svg].forEach(cleanNode),
        svg.outerHTML
      );
    }
    function cleanNode(node) {
      // 웹 레이아웃 클래스와 고정 네이비만 제거하고 코랄 포인트는 유지한다.
      return (
        node.removeAttribute('class'),
        node.removeAttribute('style'),
        node.getAttribute('stroke')?.toLowerCase() === '#203247' &&
          node.setAttribute('stroke', 'currentColor'),
        node.getAttribute('fill')?.toLowerCase() === '#203247' &&
          node.setAttribute('fill', 'currentColor'),
        [
          'path',
          'line',
          'polyline',
          'polygon',
          'circle',
          'rect',
          'svg',
        ].includes(node.tagName.toLowerCase()) &&
          node.hasAttribute('stroke') &&
          (node.setAttribute('stroke-linecap', 'round'),
          node.setAttribute('stroke-linejoin', 'round'))
      );
    }
  });
  const cards = extracted.filter((item) => {
    // 카드와 탐색기의 원본 SVG만 대응 목록에 포함한다.
    return item.selector !== 'principles' && item.selector !== 'status-icons';
  });
  let cardIndex = -1;
  const entries = cards.map((item) => {
    // 한 카드의 두 변형은 같은 의미 이름을 사용한다.
    return (
      item.variant === 0 && cardIndex++,
      makeEntry(
        item,
        names[cardIndex],
        labels[cardIndex],
        resolveVariant(cardIndex, item.variant, item.svg),
        group(cardIndex),
        `.icon-card,.icon-item:index(${cardIndex}) svg:index(${item.variant})`,
      )
    );
  });
  const statusNames = ['success', 'warning', 'error', 'info'];
  const statusLabels = ['완료', '주의', '오류', '안내'];
  entries.push(
    ...extracted
      .filter((item) => {
        // 상태 피드백의 네 가지 SVG를 추가한다.
        return item.selector === 'status-icons';
      })
      .map((item, index) => {
        // 상태 색은 런타임 의미 토큰으로 결정한다.
        return makeEntry(
          item,
          statusNames[index],
          statusLabels[index],
          'outline',
          'status',
          `#status-icons svg:index(${index})`,
        );
      }),
  );
  entries.push(
    ...extracted
      .filter((item) => {
        // 아이콘 원칙 예시에서 투톤 핀과 카메라를 찾는다.
        return item.selector === 'principles' && /#ff6b57/i.test(item.svg);
      })
      .map((item, index) => {
        // 원본의 브랜드 포인트 예시를 재사용 자산으로 제공한다.
        return makeEntry(
          item,
          index === 0 ? 'map-pin' : 'camera',
          index === 0 ? '장소' : '카메라',
          'duotone',
          'utility',
          `#principles duotone:index(${index})`,
        );
      }),
  );
  for (const name of ['map', 'camera']) {
    const brandFile = `apps/mobile/assets/brand/tripprint-v1/TripPrint_ui-${name}_256x256.svg`;
    const brand = await fs.readFile(path.join(root, brandFile), 'utf8');
    entries.push({
      id: `${name}-outline`,
      name,
      label: name === 'map' ? '지도' : '카메라',
      variant: 'outline',
      group: 'utility',
      file: `icon-${name}-outline.svg`,
      source: {
        file: brandFile,
        locator: 'svg > g',
        label: '기존 TripPrint 브랜드 SVG',
      },
      sourceBounds: null,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${brand.match(/<g[^>]*>([\s\S]*)<\/g>/)[1]}</svg>`,
    });
  }
  for (const entry of entries) {
    entry.svg = await format(svgContent(entry), {
      ...formatOptions,
      parser: 'html',
    });
    entry.sha256 = hash(entry.svg);
    entry.geometryAdjusted = /<g[\s\S]*?transform=/.test(entry.svg);
    await fs.writeFile(path.join(root, destination, entry.file), entry.svg);
  }
  const manifest = {
    schemaVersion: 1,
    revision: '1.0.0',
    createdAt: '2026-10-14',
    sourceScreen:
      'projects/13238536021221568181/screens/3c4e7db80d9f4dcba7fb58c5f7186c32',
    sourceSha256: hash(await fs.readFile(path.join(root, sourceFile))),
    baseSize: 24,
    strokeWidth: 2,
    sourceStrokeExceptions: 2.5,
    sizes: [16, 20, 24, 32, 48],
    defaultColor: '#203247',
    accentColor: '#FF6B57',
    licenseFile: 'LICENSE.txt',
    icons: entries.map(({ svg, ...entry }) => {
      // 목록에는 벡터를 중복 저장하지 않고 개별 파일과 해시를 기록한다.
      return entry;
    }),
  };
  await fs.writeFile(
    path.join(root, destination, 'icon-manifest.json'),
    await format(JSON.stringify(manifest), {
      ...formatOptions,
      parser: 'json',
    }),
  );
  await fs.writeFile(
    path.join(root, 'docs/design/icon-catalog.html'),
    await format(makeCatalog(entries), { ...formatOptions, parser: 'html' }),
  );
  await fs.mkdir(path.join(root, 'apps/mobile/src/components/icons'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, 'apps/mobile/src/components/icons/tripprint-icons.ts'),
    await format(
      '// 원본 SVG를 앱에 포함하는 생성 파일이다. export-design-kit.mjs로 갱신한다.\nexport const tripprintIcons = ' +
        JSON.stringify(
          Object.fromEntries(
            entries.map((entry) => {
              // 네트워크와 파일 로딩 없이 동일 벡터를 렌더링한다.
              return [entry.id, entry.svg];
            }),
          ),
        ) +
        ' as const;\nexport type TripIconName = keyof typeof tripprintIcons;\n',
      { ...formatOptions, parser: 'typescript' },
    ),
  );
  console.log(
    JSON.stringify({
      icons: entries.length,
      adjusted: entries
        .filter((entry) => {
          // 경계 보정이 필요한 원본만 보고한다.
          return entry.geometryAdjusted;
        })
        .map((entry) => {
          // 검수할 파일명을 반환한다.
          return entry.file;
        }),
    }),
  );
} finally {
  await browser.close();
}
