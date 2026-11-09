import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import paths from '../shared/repository-paths.cjs';

const root = paths.repositoryRoot;
const entry = '/docs/998. 일일 업무 보고서/index.html';
const fonts = new Set([
  '/apps/mobile/assets/fonts/line-seed/line-seed-ko-regular.ttf',
  '/apps/mobile/assets/fonts/line-seed/line-seed-ko-bold.ttf',
  '/apps/mobile/assets/brand/tripprint-v1/fonts/Poppins-Bold.ttf',
]);
// 보고서와 사용한 글꼴만 제공한다. 프로젝트의 설정·키·다른 파일은 노출하지 않는다.
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') {
      response.writeHead(302, { Location: encodeURI(entry) });
      response.end();
      return;
    }
    const isReport =
      /^\/docs\/998\. 일일 업무 보고서\/\d{2}\.\d{2}\.\d{2}\/[^/\\]+\.md$/.test(
        pathname,
      );
    if (pathname !== entry && !fonts.has(pathname) && !isReport) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const file = resolve(root, '.' + pathname);
    if (relative(root, file).startsWith('..')) {
      response.writeHead(403);
      response.end();
      return;
    }
    const content = await readFile(file);
    response.writeHead(200, {
      'Content-Type': fonts.has(pathname)
        ? 'font/ttf'
        : isReport
          ? 'text/plain; charset=utf-8'
          : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(8930, '127.0.0.1', () => {
  console.log('일일 보고서 미리보기: http://127.0.0.1:8930');
});
