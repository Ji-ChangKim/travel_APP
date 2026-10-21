import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

// 검수 서버에 사용할 빈 로컬 포트를 운영 서버와 분리한다.
function availablePort() {
  // 예약용 소켓을 닫은 뒤 자식 프로세스가 해당 포트를 사용한다.
  return new Promise((resolve, reject) => {
    // 준비 실패를 검사 성공으로 처리하지 않는다.
    const server = createServer()
      .once('error', reject)
      .listen(0, '127.0.0.1', () => {
        // 운영체제가 배정한 포트 번호만 가져온다.
        const { port } = server.address();
        server.close(() => {
          // 예약 소켓이 닫힌 뒤에만 포트를 반환한다.
          resolve(port);
        });
      });
  });
}

// 로컬 검수 서버가 실제 응답할 때까지 제한된 횟수만 확인한다.
async function waitForPreview(url) {
  // 서버 시작 지연을 외부 네트워크 재시도로 처리하지 않는다.
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      // 이 검사에서 생성한 로컬 주소에만 연결한다.
      if ((await fetch(url)).ok) return;
    } catch {
      // 자식 프로세스의 초기 바인딩 대기만 허용한다.
    }
    await setTimeout(50);
  }
  assert.fail('로컬 검수 서버 시작 실패');
}

test('검수 서버는 앱 상세만 연결하고 없는 공개 API 요청 뒤에도 계속 응답한다', async (t) => {
  // 실제 앱·DB·이전 검수 자료를 덮어쓰지 않는 임시 폴더를 사용한다.
  const folder = mkdtempSync(join(tmpdir(), 'tripprint-preview-'));
  mkdirSync(join(folder, 'community'));
  mkdirSync(join(folder, 'record'));
  const names = [
    'index.html',
    '+not-found.html',
    'community/[postId].html',
    'record/[id].html',
  ];
  for (const name of names) writeFileSync(join(folder, name), name);
  const port = await availablePort();
  const child = spawn(process.execPath, ['scripts/preview-trail.mjs'], {
    env: {
      ...process.env,
      TRIPPRINT_PREVIEW_DIR: folder,
      TRIPPRINT_PREVIEW_PORT: String(port),
    },
    stdio: 'ignore',
    windowsHide: true,
  });
  t.after(() => {
    // 이 검사에서 만든 자식 프로세스와 정확한 단일 파일만 정리한다.
    child.kill();
    for (const name of names) unlinkSync(join(folder, name));
    rmdirSync(join(folder, 'community'));
    rmdirSync(join(folder, 'record'));
    rmdirSync(folder);
  });
  const base = `http://127.0.0.1:${port}`;
  const id = '00000000-0000-4000-8000-000000000001';
  await waitForPreview(base);
  assert.equal(
    await (await fetch(`${base}/community/${id}`)).text(),
    'community/[postId].html',
  );
  assert.equal(
    await (await fetch(`${base}/record/${id}`)).text(),
    'record/[id].html',
  );
  assert.equal((await fetch(`${base}/public/community/${id}`)).status, 404);
  assert.equal((await fetch(`${base}/trips/${id}`)).status, 404);
  assert.equal((await fetch(base)).status, 200);
});
