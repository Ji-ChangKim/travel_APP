import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { pages } from './catalog.mjs';
import { sourcePlan } from './plan-source.mjs';

const root = new URL('./', import.meta.url);
const iconManifest = JSON.parse(
  readFileSync(
    new URL(
      '../../../apps/mobile/assets/icons/tripprint/icon-manifest.json',
      root,
    ),
    'utf8',
  ),
);
const files = [
  ['/', './index.html', 'text/html; charset=utf-8'],
  ...[
    'index.html',
    'review.css',
    'review.js',
    'catalog.mjs',
    'model.mjs',
    'components.mjs',
    'screens.mjs',
    'states.mjs',
    'design-system.mjs',
    'brand-data.mjs',
    'plan-source.mjs',
  ].map((file) => {
    // 검토 화면 모듈만 허용한다.
    return [
      `/${file}`,
      `./${file}`,
      file.endsWith('html')
        ? 'text/html; charset=utf-8'
        : file.endsWith('css')
          ? 'text/css; charset=utf-8'
          : 'application/javascript; charset=utf-8',
    ];
  }),
  ['/report.txt', '../APP_REDESIGN_REVIEW.txt', 'text/plain; charset=utf-8'],
  [
    '/design-system.txt',
    '../PAGE_DESIGN_SYSTEM.txt',
    'text/plain; charset=utf-8',
  ],
  ['/popup-spec.txt', '../POPUP_SPEC.txt', 'text/plain; charset=utf-8'],
  ['/page-index.txt', '../pages/PAGE_INDEX.txt', 'text/plain; charset=utf-8'],
  ['/ui-review.txt', '../PAGE_UI_LEAD_REVIEW.txt', 'text/plain; charset=utf-8'],
  ['/page-manifest.json', '../pages/PAGE_MANIFEST.json', 'application/json'],
  [
    '/pages/ALL_PAGES.html',
    '../pages/ALL_PAGES.html',
    'text/html; charset=utf-8',
  ],
  [
    '/assets/osaka.jpg',
    '../../../apps/mobile/assets/destinations/osaka.jpg',
    'image/jpeg',
  ],
  [
    '/assets/logo.svg',
    '../../../apps/mobile/assets/brand/tripprint-v1/TripPrint_logo-horizontal_1024x320.svg',
    'image/svg+xml',
  ],
  [
    '/assets/app-icon.png',
    '../../../apps/mobile/assets/brand/tripprint-v1/TripPrint_app-icon_1024x1024.png',
    'image/png',
  ],
  [
    '/assets/PretendardVariable.woff2',
    '../../../apps/mobile/assets/brand/tripprint-v1/fonts/PretendardVariable.woff2',
    'font/woff2',
  ],
  ...[
    ['empty', 'TripPrint_Haru_empty_1024x1536.png'],
    ['error', 'TripPrint_Haru_error_1024x1536.png'],
    ['loading', 'TripPrint_Haru_loading_1233x1275.png'],
  ].map(([key, file]) => {
    // 하루는 기존 원본의 비율과 색을 유지한다.
    return [
      `/assets/haru-${key}.png`,
      `../../../apps/mobile/assets/brand/haru-v1/${file}`,
      'image/png',
    ];
  }),
  ...iconManifest.icons.map((item) => {
    // 매니페스트에 있는 원본 아이콘만 제공한다.
    return [
      `/assets/icons/${item.file}`,
      `../../../apps/mobile/assets/icons/tripprint/${item.file}`,
      'image/svg+xml',
    ];
  }),
  ...pages.map((page) => {
    // 요청 경로로 임의 파일을 읽지 않고 미리 등록된 페이지를 제공한다.
    return [
      `/pages/${page.file}.html`,
      `../pages/${page.file}.html`,
      'text/html; charset=utf-8',
    ];
  }),
  ...pages
    .filter((page) => {
      // 아직 촬영하지 않은 화면은 빈 파일로 제공하지 않는다.
      return existsSync(
        new URL(`../../../outputs/page-design/captures/${page.file}.png`, root),
      );
    })
    .map((page) => {
      // 캡처도 제작 목록에 등록한 파일만 제공한다.
      return [
        `/captures/${page.file}.png`,
        `../../../outputs/page-design/captures/${page.file}.png`,
        'image/png',
      ];
    }),
];
const routes = new Map(
  files.flatMap(([route, file, type]) => {
    // 루트 진입과 번호별 페이지의 base 경로를 모두 지원한다.
    return [
      [route, { file: new URL(file, root), type }],
      ...(route.startsWith('/pages/')
        ? []
        : [[`/review${route}`, { file: new URL(file, root), type }]]),
    ];
  }),
);

// 지정한 검토 파일 또는 명확한 찾을 수 없음 응답만 보낸다.
function respond(response, file, headOnly) {
  // 알 수 없는 경로도 서버를 종료하지 않고404로 끝낸다.
  return file && existsSync(file.file)
    ? response
        .writeHead(200, {
          'Content-Type': file.type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .end(headOnly ? undefined : readFileSync(file.file))
    : response
        .writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('Not found');
}

// 알려진 공개 계획의 장소 사진만 읽기 전용으로 중계한다.
async function publicPhoto(id, response) {
  // API 키·인증·쓰기 경로를 받거나 임의 공급자 URL을 열지 않는다.
  const place = sourcePlan.places.find((place) => {
    // 공개된 원문 목록에 포함된 장소만 허용한다.
    return place.id === id;
  });
  if (!place) return respond(response, null);
  try {
    const upstream = await fetch(
      `https://tripprint-api-staging.gametps.workers.dev/public/community/${sourcePlan.publicId}/places/${place.sourceId}/photo`,
      { signal: AbortSignal.timeout(20000), redirect: 'error' },
    );
    const data = await upstream.text();
    return response
      .writeHead(upstream.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      .end(
        data.length <= 32768 ? data : '{"error":{"code":"PHOTO_UNAVAILABLE"}}',
      );
  } catch {
    // 원문 URL·공급자 오류·비밀값을 로그에 남기지 않는다.
    return response
      .writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      .end('{"error":{"code":"PHOTO_UNAVAILABLE"}}');
  }
}

// 로컬 파일 목록과 명시적인 공개 사진 읽기만 허용한다.
function handle(request, response) {
  // 브라우저의 POST·계정 쓰기·배포 요청은 받지 않는다.
  const pathname = decodeURIComponent(
    new URL(request.url, 'http://127.0.0.1').pathname,
  );
  return !['GET', 'HEAD'].includes(request.method)
    ? response.writeHead(405, { Allow: 'GET, HEAD' }).end()
    : /^\/(?:review\/)?photos\/p\d+$/.test(pathname) && request.method === 'GET'
      ? publicPhoto(pathname.split('/').at(-1), response)
      : respond(response, routes.get(pathname), request.method === 'HEAD');
}

// 실제 앱 배포 주소와 구분해 디자인 검토 주소를 안내한다.
function ready() {
  // 번호별 전체 페이지를 같은 서버에서 연다.
  return console.log(
    `전체 ${pages.length}개 디자인 화면: http://127.0.0.1:${process.env.TRIPPRINT_REVIEW_PORT || 8837}/`,
  );
}

http
  .createServer(handle)
  .listen(
    Number(process.env.TRIPPRINT_REVIEW_PORT || 8837),
    '127.0.0.1',
    ready,
  );
