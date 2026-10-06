import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

// 이미지 생성 결과와 컨셉을 참고해 편집 가능한 공통 심볼을 정의한다.
const mark = `<g transform="translate(90 100) scale(.85)"><path fill-rule="evenodd" d="M460 250C380 250 320 308 320 382C320 480 460 630 460 630C460 630 600 480 600 382C600 308 540 250 460 250ZM460 330A52 52 0 1 1 460 434A52 52 0 1 1 460 330Z"/><path d="M315 555C170 595 167 711 380 702C560 694 696 580 768 438" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round" stroke-dasharray="66 30"/><path d="M804 282Q817 269 830 282Q837 291 828 301L787 341L806 390Q810 398 801 403L793 407Q785 411 780 403L755 368L729 394L729 413Q729 423 721 423L713 423Q706 423 706 415L704 396L685 394Q677 394 677 387L677 380Q677 372 685 372L706 372L734 345L697 321Q689 315 693 307L698 301Q703 293 712 297L759 314Z"/></g>`;
const root = 'apps/mobile/assets/brand/tripprint-v1';
// 브랜드·용도·실제 출력 크기를 파일명 하나로 연결한다.
function assetName(asset) {
  // 확장자를 제외한 표준 이름을 모든 출력과 미리보기에 공유한다.
  return `TripPrint_${asset.name}_${asset.width}x${asset.height}`;
}
const poppins = readFileSync(`${root}/fonts/Poppins-Bold.ttf`).toString(
  'base64',
);
const pretendard = readFileSync(
  `${root}/fonts/PretendardVariable.woff2`,
).toString('base64');
const fonts = `<style>@font-face{font-family:TripPoppins;src:url(data:font/ttf;base64,${poppins})} @font-face{font-family:TripPretendard;src:url(data:font/woff2;base64,${pretendard})}text{font-family:TripPoppins,sans-serif;font-weight:700}.ko{font-family:TripPretendard,sans-serif;font-weight:700}</style>`;

// 한 SVG 문서에 고정된 크기와 접근 가능한 이름을 연결한다.
function svg(width, height, content) {
  // 실제 벡터를 렌더링하므로 기존 PNG를 자르거나 크기 변경하지 않는다.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="TripPrint 트립프린트">${content}</svg>`;
}

// 공통 심볼의 색만 바꾸고 형태와 내부 여백은 유지한다.
function symbol(color) {
  // 모든 변형이 같은 경로를 사용해 모양이 달라지지 않게 한다.
  return `<g fill="${color}" color="${color}">${mark}</g>`;
}

// 이름과 한글 부제를 같은 글꼴 및 색 규칙으로 배치한다.
function wordmark(
  x,
  y,
  size,
  color = '#203247',
  printColor = '#FF6B57',
  anchor = 'start',
) {
  // 브랜드명은 생성 이미지 대신 정확한 텍스트로 작성한다.
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}">Trip<tspan fill="${printColor}">Print</tspan></text><text class="ko" x="${x}" y="${y + size * 0.7}" text-anchor="${anchor}" font-size="${size * 0.34}" fill="${color}">트립프린트</text>`;
}

// 기능용 아이콘을 같은 네이비 색상과 2px 선 규격으로 그린다.
function uiIcon(content) {
  // 작은 기능 아이콘은 코랄 장식과 구분해 정보 가독성을 유지한다.
  return `<g transform="scale(${256 / 24})" fill="none" stroke="#203247" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</g>`;
}

const assets = [
  {
    name: 'symbol-coral-clean',
    width: 1024,
    height: 1024,
    content: symbol('#FF6B57'),
  },
  {
    name: 'symbol-white',
    width: 1024,
    height: 1024,
    content: symbol('#FFFFFF'),
  },
  {
    name: 'symbol-navy',
    width: 1024,
    height: 1024,
    content: symbol('#203247'),
  },
  {
    name: 'app-icon',
    width: 1024,
    height: 1024,
    content: `<rect width="1024" height="1024" fill="#FF6B57"/>${symbol('#FFFFFF')}`,
  },
  {
    name: 'play-store-icon',
    width: 512,
    height: 512,
    content: `<rect width="512" height="512" fill="#FF6B57"/><g transform="scale(.5)">${symbol('#FFFFFF')}</g>`,
  },
  {
    name: 'android-foreground',
    width: 1024,
    height: 1024,
    content: symbol('#FFFFFF'),
  },
  {
    name: 'android-monochrome',
    width: 1024,
    height: 1024,
    content: symbol('#FFFFFF'),
  },
  {
    name: 'splash-symbol',
    width: 1024,
    height: 1024,
    content: symbol('#FF6B57'),
  },
  {
    name: 'favicon-32',
    width: 32,
    height: 32,
    content:
      '<path fill="#FF6B57" fill-rule="evenodd" d="M16 2C9 2 4 7 4 13C4 20 16 30 16 30C16 30 28 20 28 13C28 7 23 2 16 2ZM16 8A5 5 0 1 1 16 18A5 5 0 1 1 16 8Z"/>',
  },
  {
    name: 'favicon-64',
    width: 64,
    height: 64,
    content:
      '<g transform="scale(2)"><path fill="#FF6B57" fill-rule="evenodd" d="M16 2C9 2 4 7 4 13C4 20 16 30 16 30C16 30 28 20 28 13C28 7 23 2 16 2ZM16 8A5 5 0 1 1 16 18A5 5 0 1 1 16 8Z"/></g>',
  },
  {
    name: 'logo-horizontal',
    width: 1024,
    height: 320,
    content: `${fonts}<g transform="translate(-70 -65) scale(.44)">${symbol('#FF6B57')}</g>${wordmark(320, 160, 104)}`,
  },
  {
    name: 'logo-horizontal-white',
    width: 1024,
    height: 320,
    content: `${fonts}<g transform="translate(-70 -65) scale(.44)">${symbol('#FFFFFF')}</g>${wordmark(320, 160, 104, '#FFFFFF', '#FFFFFF')}`,
  },
  {
    name: 'logo-horizontal-navy',
    width: 1024,
    height: 320,
    content: `${fonts}<g transform="translate(-70 -65) scale(.44)">${symbol('#203247')}</g>${wordmark(320, 160, 104, '#203247', '#203247')}`,
  },
  {
    name: 'monogram-tp',
    width: 512,
    height: 512,
    content: `${fonts}<text x="256" y="325" text-anchor="middle" font-size="220" fill="#203247">T<tspan fill="#FF6B57">P</tspan></text>`,
  },
  {
    name: 'ui-place',
    width: 256,
    height: 256,
    content: uiIcon(
      '<path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/>',
    ),
  },
  {
    name: 'ui-route',
    width: 256,
    height: 256,
    content: uiIcon(
      '<circle cx="4" cy="19" r="2"/><circle cx="20" cy="5" r="2"/><path d="M6 19h3c9 0-3-14 7-14h2" stroke-dasharray="2 3"/>',
    ),
  },
  {
    name: 'ui-camera',
    width: 256,
    height: 256,
    content: uiIcon(
      '<path d="M8 6l2-3h4l2 3h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
    ),
  },
  {
    name: 'ui-record',
    width: 256,
    height: 256,
    content: uiIcon(
      '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
    ),
  },
  {
    name: 'ui-map',
    width: 256,
    height: 256,
    content: uiIcon(
      '<path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/>',
    ),
  },
  {
    name: 'ui-flight',
    width: 256,
    height: 256,
    content: uiIcon(
      '<path d="m21 3-7 7-8-3-3 3 8 5-4 4-3-1-2 2 4 2 2 4 2-2-1-3 4-4 5 8 3-3-3-8 7-7Z" transform="translate(1 -1) scale(.85)"/>',
    ),
  },
  {
    name: 'logo-stacked',
    width: 768,
    height: 768,
    content: `${fonts}<g transform="translate(35 -45) scale(.68)">${symbol('#FF6B57')}</g>${wordmark(384, 548, 100, '#203247', '#FF6B57', 'middle')}`,
  },
  {
    name: 'splash-portrait',
    width: 1080,
    height: 1920,
    content: `${fonts}<rect width="1080" height="1920" fill="#FFF9F3"/><g transform="translate(104 350) scale(.85)">${symbol('#FF6B57')}</g>${wordmark(540, 1090, 102, '#203247', '#FF6B57', 'middle')}<text class="ko" x="540" y="1300" font-size="36" text-anchor="middle" fill="#203247">여행의 발자취를 남기다.</text><text x="540" y="1640" font-size="28" text-anchor="middle" fill="#203247">Leave your TripPrint.</text>`,
  },
];

mkdirSync(root, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const manifest = [];
for (const asset of assets) {
  // 각 벡터를 원래 지정한 출력 크기로 렌더링하여 PNG를 만든다.
  const source = svg(asset.width, asset.height, asset.content);
  writeFileSync(`${root}/${assetName(asset)}.svg`, source);
  await page.setViewportSize({ width: asset.width, height: asset.height });
  await page.setContent(
    `<html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${source}</body></html>`,
  );
  await page.evaluate(() => {
    // 글꼴 로딩 완료 전에 대체 글꼴로 내보내지 않는다.
    return document.fonts.ready;
  });
  await page.screenshot({
    path: `${root}/${assetName(asset)}.png`,
    omitBackground: true,
  });
  manifest.push({
    name: asset.name,
    png: `${assetName(asset)}.png`,
    svg: `${assetName(asset)}.svg`,
    width: asset.width,
    height: asset.height,
    pngSha256: createHash('sha256')
      .update(readFileSync(`${root}/${assetName(asset)}.png`))
      .digest('hex'),
  });
}
await browser.close();
writeFileSync(
  `${root}/manifest.json`,
  `${JSON.stringify({ brand: 'TripPrint', revision: 'v2', method: 'imagegen reference + editable native SVG + browser PNG export', assets: manifest }, null, 2)}\n`,
);
writeFileSync(
  `${root}/preview.html`,
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TripPrint 브랜드 자산 v2</title><style>@font-face{font-family:Brand;src:url(fonts/PretendardVariable.woff2)}*{box-sizing:border-box}body{margin:0;padding:40px;background:#FFF9F3;color:#203247;font-family:Brand,sans-serif}h1{margin:0 0 8px}p{line-height:1.6}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.card{padding:16px;border-radius:20px;background:white;border:1px solid #eedfd2}.art{height:220px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:repeating-conic-gradient(#f5efe8 0% 25%,#fff 0% 50%) 50%/20px 20px}.inverse{background:#203247}.art img{max-width:100%;max-height:100%;object-fit:contain}.label{font-weight:700;margin-top:12px}.size{font-size:13px;margin-top:4px}.loader{display:flex;align-items:center;gap:32px;margin:24px 0 32px;padding:24px;background:white;border-radius:20px}.loader img{width:120px;height:120px}.dots{display:flex;gap:8px;margin-top:14px}.dot{width:8px;height:8px;border-radius:50%;background:#C84432;animation:pulse 1.2s infinite}.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}@keyframes pulse{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}@media(prefers-reduced-motion:reduce){.dot{animation:none;opacity:1}}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}body{padding:20px}}</style></head><body><h1>TripPrint · 트립프린트</h1><p>브랜드 자산 v2 — 공통 심볼에서 파생한 ${assets.length}종 PNG·SVG. 앱 아이콘과 네이티브 시작 화면용 심볼, 편집 로고를 분리했습니다.</p><section class="loader" aria-label="로딩 화면 동작 예시"><img src="TripPrint_symbol-coral-clean_1024x1024.png" alt="TripPrint 여행 심볼"><div><strong>여행을 준비하고 있어요</strong><div class="dots" role="progressbar" aria-label="준비 중"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><p>로딩은 진행 중 상태만 표시하며 가짜 완료율을 표시하지 않습니다.</p></div></section><div class="grid">${assets
    .map((asset) => {
      // 실제 저장된 PNG와 크기를 같은 카드에서 보여준다.
      return `<section class="card"><div class="art ${/white|foreground|monochrome/.test(asset.name) ? 'inverse' : ''}"><img src="${assetName(asset)}.png" alt="${asset.name}"></div><div class="label">${asset.name}</div><div class="size">${asset.width} × ${asset.height} · <a href="${assetName(asset)}.svg">SVG</a> / <a href="${assetName(asset)}.png">PNG</a></div></section>`;
    })
    .join('')}</div></body></html>`,
);
console.info(`TripPrint ${assets.length}종 SVG·PNG 자산 생성 완료`);
