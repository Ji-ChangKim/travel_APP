import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pages, groups } from './catalog.mjs';

const root = new URL('./', import.meta.url);
const pageRoot = new URL('../01. 페이지시안/', root);
const icons = JSON.parse(
  readFileSync(
    new URL(
      '../../../../apps/mobile/assets/icons/tripprint/icon-manifest.json',
      root,
    ),
    'utf8',
  ),
);
const credits = JSON.parse(
  readFileSync(
    new URL('../../../../apps/mobile/assets/destinations/credits.json', root),
    'utf8',
  ),
);
const tokens = JSON.parse(
  readFileSync(new URL('../../00. 공통규격/design-tokens.json', root), 'utf8'),
);
const template = readFileSync(new URL('./index.html', root), 'utf8');

// 원본 자산의 값과 목록을 검토 화면에 전달한다.
function writeBrandData() {
  // 코드와 기준 파일의 해시를 함께 남겨 임의 값으로 대체했는지 확인한다.
  return writeFileSync(
    new URL('./brand-data.mjs', root),
    `// 기존 원본 매니페스트에서 생성한다. 원본 자산을 수정하지 않는다.\nexport const brand = ${JSON.stringify(
      {
        icons: icons.icons.map((item) => {
          // UI 이름과 실제 파일의 연결만 사용한다.
          return { id: item.id, file: item.file, label: item.label };
        }),
        credits,
        tokens,
        tokenHash: createHash('sha256')
          .update(JSON.stringify(tokens))
          .digest('hex'),
      },
      null,
      2,
    )};\n`,
  );
}

// 사용자 원문에서 실제 공개된 내용만 예시에 보존한다.
function writeSamplePlan() {
  // 이미 정리한 예시가 있으면 검수 출력에 다시 의존하지 않는다.
  if (existsSync(new URL('./plan-source.mjs', root))) return;
  const source = JSON.parse(
    readFileSync(
      new URL(
        '../../../../outputs/community-osaka/actual-published-plan.json',
        root,
      ),
      'utf8',
    ),
  );
  return writeFileSync(
    new URL('./plan-source.mjs', root),
    `// 사용자가 제공해 공개한 오사카 여행계획의 DAY·장소 설명을 보존한다. 날짜·비용·항공은 디자인 예시다.\nexport const sourcePlan = ${JSON.stringify(
      {
        title: source.title,
        publicId: source.id,
        days: source.snapshot.days,
        places: source.snapshot.itinerary.map((item, index) => {
          // 작성자 계정·인증·비공개 메모는 예시 파일에 넣지 않는다.
          return {
            id: `p${index + 1}`,
            sourceId: item.id,
            day: item.dayNumber,
            name: item.title,
            description: item.planContent?.description || '',
            choiceGroup: item.planContent?.choiceGroup || '',
            choiceKind: item.planContent?.choiceKind || '',
            choiceLabel: item.planContent?.choiceLabel || '',
            time: item.timeSlot || '',
            address: item.address || '',
            area: '일본 · 오사카',
            tip: '',
            type: item.type,
            memo: '',
            duration: '',
          };
        }),
      },
      null,
      2,
    )};\n`,
  );
}

// 화면마다 직접 열 수 있는 Num_페이지명 파일을 생성한다.
function writePage(page) {
  // 공통 렌더러를 공유하되 진입 화면을 파일 안에 명시한다.
  return writeFileSync(
    new URL(`${page.file}.html`, pageRoot),
    template
      .replace('<head>', '<head>\n    <base href="./" />')
      .replace('<body>', `<body data-screen="${page.key}">`)
      .replace(
        '<title>TripPrint 전체 개편 · 사용자 검토안</title>',
        `<title>${page.file} · TripPrint</title>`,
      ),
  );
}

// 제작 목록과 상하위 관계를 사용자·검수 도구가 같은 값으로 읽는다.
function writeCatalog() {
  // 문서 파일명과 캡처 파일명을 하나의 목록에서 만든다.
  return writeFileSync(
    new URL('../01. 페이지시안/PAGE_MANIFEST.json', root),
    `${JSON.stringify({ version: '2026-10-19-page-design-1', status: 'design-review', pageCount: pages.length, groups, pages }, null, 2)}\n`,
  );
}

// 숫자 이름으로 정리된 화면의 위치와 현재 상태를 기록한다.
function writeIndex() {
  // 서버 인수·앱 반영이 완료됐다는 문구를 넣지 않는다.
  return writeFileSync(
    new URL('../01. 페이지시안/페이지_목록.txt', root),
    `TripPrint 전체 페이지 디자인 / 2026-10-19\n기준: 전체페이지_디자인규격.txt·팝업_규격.txt·현행 design-tokens.json\n${pages.length}개 디자인 화면. 앱 구현·서버 인수·Play 검수 결과와 구분한다.\n번호는 고정 식별자다. 화면별 HTML과 outputs/page-design/captures의 PNG는 같은 Num_페이지명으로 관리한다.\n\n${groups
      .map(([key, label]) => {
        // 큰 페이지·작은 페이지·예외·팝업을 영역별로 나눠 표시한다.
        return `${label}\n${pages
          .filter((page) => {
            // 현재 영역의 화면만 포함한다.
            return page.group === key;
          })
          .map((page) => {
            // 부모와 복귀 위치를 함께 표시한다.
            return `  ${page.file}.html | ${page.kind} | 상위 ${page.parent || '최상위'} | 디자인 검토안`;
          })
          .join('\n')}`;
      })
      .join('\n\n')}\n`,
  );
}

// 전체 제작 화면을 번호·상하위 관계와 함께 한 번에 비교한다.
function writeGallery() {
  // 작은 이미지는 탐색용 축소판이며 실제 화면 크기를 대체하지 않는다.
  return writeFileSync(
    new URL('../01. 페이지시안/ALL_PAGES.html', root),
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>TripPrint 전체 페이지 디자인</title><style>@font-face{font-family:Pretendard;src:url('00. 리소스/PretendardVariable.woff2')}*{box-sizing:border-box}body{font-family:Pretendard,sans-serif;color:#203247;background:#f5f1ec;margin:0;padding:32px}header{max-width:1440px;margin:auto}h1{font-size:26px;line-height:36px}p,a{font-size:14px;line-height:22px}a{color:#a43e31;text-underline-offset:4px}nav{display:flex;flex-wrap:wrap;gap:8px;padding:16px 0}nav a{padding:12px;background:white;border:1px solid #8a7b70;border-radius:12px;min-height:44px}section{max-width:1440px;margin:32px auto}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:24px}.page{display:block;background:white;padding:12px;border:1px solid #e9e1d8;border-radius:16px;text-decoration:none}.page img{display:block;width:100%;aspect-ratio:390/844;object-fit:contain;background:#fff9f3;border:1px solid #e9e1d8;border-radius:12px}.page strong{display:block;margin-top:12px;font-size:16px;line-height:24px}.page p{color:#596574;margin-bottom:0}a:focus-visible{outline:2px solid #203247;outline-offset:2px}@media(max-width:550px){body{padding:20px}.grid{grid-template-columns:1fr 1fr;gap:12px}.page{padding:8px}}</style></head><body><header><p>TRIPPRINT / WHOLE APP DESIGN / 2026.10.19</p><h1>큰 페이지부터 예외와 팝업까지</h1><p>${pages.length}개 디자인 제작본 · 실제 앱 반영/서버 저장/Play 인수 전 · 축소판은 첫 화면이며 클릭하면 전체 내용을 읽을 수 있습니다.</p><a href="./">상호작용과 글자 확대 검토 ↗</a><nav>${groups
      .map(([key, label]) => {
        // 큰 영역의 위치로 빠르게 이동한다.
        return `<a href="#${key}">${label}</a>`;
      })
      .join('')}</nav></header>${groups
      .map(([key, label]) => {
        // 각 그룹 안에서는 고정 번호 순서로 정렬한다.
        return `<section id="${key}"><h2>${label}</h2><div class="grid">${pages
          .filter((page) => {
            // 다른 그룹의 예외·팝업을 중복 복제하지 않는다.
            return page.group === key;
          })
          .map((page) => {
            // 이미지·HTML·목록의 식별자를 하나로 유지한다.
            return `<a class="page" href="${page.file}.html"><img src="../03. 시안캡처/${page.file}.png" loading="lazy" alt="${page.file} 디자인 화면"/><strong>${page.file}</strong><p>상위 ${page.parent || '최상위'} · ${page.kind}</p></a>`;
          })
          .join('')}</div></section>`;
      })
      .join('')}</body></html>`,
  );
}

mkdirSync(fileURLToPath(pageRoot), { recursive: true });
writeBrandData();
writeSamplePlan();
pages.forEach(writePage);
writeCatalog();
writeIndex();
writeGallery();
console.log(`화면 ${pages.length}개와 번호 목록을 생성했습니다.`);
