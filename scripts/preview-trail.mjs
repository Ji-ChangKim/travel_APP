import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 브라우저 검증은 웹 빌드 폴더만 로컬에서 제공한다.
const root = fileURLToPath(new URL('../apps/mobile/dist/', import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
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
  return candidate.startsWith(root) ? existingFile(candidate) : null;
}

// 확장자 없는 Expo 라우트는 HTML로 읽는다.
function existingFile(candidate) {
  // 파일만 선택하며 디렉터리 목록은 제공하지 않는다.
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : fs.existsSync(`${candidate}.html`)
      ? `${candidate}.html`
      : /[\\/]trips[\\/][0-9a-f-]{36}$/.test(candidate)
        ? path.join(root, 'trips', '[id].html')
        : null;
}

// 정적 응답 또는 찾을 수 없음 상태를 반환한다.
function respond(response, file) {
  // 원본 저장소·환경 파일은 노출하지 않는다.
  return file
    ? fs.createReadStream(file).pipe(
        response.writeHead(200, {
          'Content-Type':
            mime[path.extname(file)] ?? 'application/octet-stream',
        }),
      )
    : response.writeHead(404).end('Not found');
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
http.createServer(handle).listen(8788, '127.0.0.1');
