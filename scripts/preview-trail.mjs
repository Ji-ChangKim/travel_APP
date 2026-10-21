import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 브라우저 검증은 웹 빌드 폴더만 로컬에서 제공한다.
const root = process.env.TRIPPRINT_PREVIEW_DIR
  ? path.resolve(process.env.TRIPPRINT_PREVIEW_DIR)
  : fileURLToPath(new URL('../apps/mobile/dist/', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

// 정적 라우트를 실제 export 파일로 변환한다.
function requestedFile(url) {
  // URL 원문을 셸이나 임의 외부 파일 읽기로 전달하지 않는다.
  return safeCandidate(
    path.resolve(
      root,
      `.${decodeURIComponent(new URL(url ?? '/', 'http://localhost').pathname === '/' ? '/index.html' : new URL(url ?? '/', 'http://localhost').pathname)}`,
    ),
  );
}

// 웹 빌드 폴더 밖의 요청을 거부한다.
function safeCandidate(candidate) {
  // 상위 경로로 벗어난 파일은 제공하지 않는다.
  return path.relative(root, candidate).startsWith('..') ||
    path.isAbsolute(path.relative(root, candidate))
    ? null
    : existingFile(candidate);
}

// 확장자 없는 Expo 라우트는 HTML로 읽는다.
function existingFile(candidate) {
  // 파일만 선택하며 디렉터리 목록은 제공하지 않는다.
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : fs.existsSync(`${candidate}.html`)
      ? `${candidate}.html`
      : templateFile(candidate);
}

// 앱의 최상위 상세 주소만 존재하는 Expo 템플릿에 연결한다.
function templateFile(candidate) {
  // /public/community 같은 API 주소를 앱 화면으로 오인하지 않는다.
  const route = path.relative(root, candidate).replaceAll('\\', '/');
  const file = /^(?:trips|diary|record)\/[0-9a-f-]{36}$/.test(route)
    ? path.join(path.dirname(candidate), '[id].html')
    : /^community\/[0-9a-f-]{36}$/.test(route)
      ? path.join(path.dirname(candidate), '[postId].html')
      : '';
  return file && fs.existsSync(file) && fs.statSync(file).isFile()
    ? file
    : null;
}

// 정적 응답 또는 찾을 수 없음 상태를 반환한다.
function respond(response, file) {
  // 원본 저장소·환경 파일은 노출하지 않는다.
  return file
    ? streamFile(response, file, 200)
    : fs.existsSync(path.join(root, '404.html')) ||
        fs.existsSync(path.join(root, '+not-found.html'))
      ? streamFile(
          response,
          path.join(
            root,
            fs.existsSync(path.join(root, '404.html'))
              ? '404.html'
              : '+not-found.html',
          ),
          404,
        )
      : response.writeHead(404).end('Not found');
}

// 조회 뒤 파일이 없어져도 서버 전체를 종료하지 않고 해당 응답만 끝낸다.
function streamFile(response, file, status) {
  // 파일 원문이나 내부 경로를 오류 응답에 포함하지 않는다.
  return fs
    .createReadStream(file)
    .once('error', () => {
      // 이미 본문을 보냈다면 연결만 닫고, 아니면 찾을 수 없음으로 끝낸다.
      return response.headersSent
        ? response.destroy()
        : response.writeHead(404).end('Not found');
    })
    .pipe(
      response.writeHead(status, {
        'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
      }),
    );
}

// 잘못된 URL 인코딩은 요청 오류로 처리한다.
function handle(request, response) {
  // 요청마다 정적 파일 하나만 제공한다.
  try {
    return respond(response, requestedFile(request.url));
  } catch {
    return response.writeHead(400).end('Bad request');
  }
}

// 개발 PC 내부에서만 테스트 페이지를 제공한다.
http
  .createServer(handle)
  .listen(Number(process.env.TRIPPRINT_PREVIEW_PORT || 8788), '127.0.0.1');
