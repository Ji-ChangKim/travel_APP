import http from 'node:http';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const asset = 'apps/mobile/assets/';
const files = [
  ['docs/design/headers/index.html', 'text/html; charset=utf-8'],
  ['docs/design/headers/headers.css', 'text/css; charset=utf-8'],
  ['docs/design/SCREEN_HEADER_SPEC.md', 'text/plain; charset=utf-8'],
  ['docs/design/RESOURCE_INDEX.md', 'text/plain; charset=utf-8'],
  [asset + 'fonts/pretendard-regular.otf', 'font/otf'],
  [asset + 'fonts/pretendard-semibold.otf', 'font/otf'],
  [asset + 'fonts/pretendard-bold.otf', 'font/otf'],
  [asset + 'brand/tripprint-v1/fonts/Poppins-Bold.ttf', 'font/ttf'],
  [
    asset + 'brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png',
    'image/png',
  ],
  [
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf',
    'font/ttf',
  ],
];
const routes = new Map(
  files.map(([path, type]) => {
    // 문서와 검토에 필요한 공개 자산 경로만 등록한다.
    return ['/' + path, { file: new URL(path, root), type }];
  }),
);
routes.set('/', routes.get('/docs/design/headers/index.html'));
routes.set('/headers.css', routes.get('/docs/design/headers/headers.css'));

// 등록된 시각 규격 파일만 응답하며 임의 파일·API를 노출하지 않는다.
function respond(request, response) {
  // 읽기 메서드와 허용된 경로만 처리한다.
  const file = ['GET', 'HEAD'].includes(request.method)
    ? routes.get(new URL(request.url, 'http://127.0.0.1').pathname)
    : undefined;
  return file
    ? response
        .writeHead(200, {
          'Content-Type': file.type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .end(request.method === 'HEAD' ? undefined : readFileSync(file.file))
    : response.writeHead(404).end('Not found');
}

// 헤더 시안은 로컬 인터페이스에서만 열고 빌드·배포를 시작하지 않는다.
http
  .createServer(respond)
  .listen(
    Number(process.env.TRIPPRINT_HEADER_PREVIEW_PORT || 8831),
    '127.0.0.1',
    () => {
      // 열어 볼 주소만 출력하고 인증·환경 변수 원문은 기록하지 않는다.
      process.stdout.write(
        'Header preview: http://127.0.0.1:' +
          (process.env.TRIPPRINT_HEADER_PREVIEW_PORT || 8831) +
          '/docs/design/headers/index.html\n',
      );
    },
  );
