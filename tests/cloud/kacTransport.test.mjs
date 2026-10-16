import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { buildSync } from '../../apps/api/node_modules/esbuild/lib/main.js';
import {
  Miniflare,
  convertV4MiniflareOptions,
} from '../../apps/api/node_modules/miniflare/dist/src/index.js';

let mf;
let redirect = false;
const calls = [];
const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/kac-rs901-live.json', import.meta.url),
    'utf8',
  ),
);

// Node fetch 모의 대신 실제 Worker에서 공급자 요청 옵션까지 실행한다.
before(async () => {
  // 제품 어댑터를 메모리에 묶고 검수용 API를 원격에 배포하지 않는다.
  const bundle = buildSync({
    stdin: {
      contents: `import {lookupKacFlights} from './apps/api/src/kacFlights';
        // 실제 fetch의 옵션 처리를 workerd에서 검증한다.
        export default {async fetch(request) {
          // 원본 어댑터의 결과만 확인하며 DB·회원 정보는 사용하지 않는다.
          try {return Response.json(await lookupKacFlights(fetch,'fixture+key/=',{number:'RS901',date:'2026-10-14'}));}
          catch {return Response.json({error:'FLIGHT_UNAVAILABLE'},{status:503});}
        }};`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*'],
    write: false,
  });
  const options = convertV4MiniflareOptions({
    workers: [
      {
        name: 'kac-transport',
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-10-02',
        compatibilityFlags: ['nodejs_compat'],
      },
    ],
  });
  options.workers[0].dev = {
    outboundService: {
      type: 'fetcher',
      handler: (request) => {
        // 외부 공공데이터 경계만 대체하고 임의 호스트 호출은 거부한다.
        calls.push({
          hostname: new URL(request.url).hostname,
          redirect: request.redirect,
        });
        assert.equal(new URL(request.url).hostname, 'apis.data.go.kr');
        return redirect
          ? Response.redirect('https://untrusted.example/info', 302)
          : Response.json(fixture);
      },
    },
  };
  mf = new Miniflare(options);
  await mf.ready;
});

// 로컬 Worker 자원만 닫으며 외부 상태를 변경하지 않는다.
after(async () => {
  // 실패한 검사에서도 workerd 프로세스를 남기지 않는다.
  return mf?.dispose();
});

test('KAC 실제 Worker fetch는 정상200을 수신하고 국내선 양쪽 계획시각을 결합한다', async () => {
  // redirect:error를 다시 넣으면 이 검사는 공급자 호출 전에 실패한다.
  const response = await mf.dispatchFetch('https://worker.test/');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.candidates[0].departure, 'GMP');
  assert.equal(result.candidates[0].arrival, 'CJU');
  assert.equal(result.candidates[0].arrivalTime, '07:15');
  // Miniflare 경계가 재구성한 Request의 redirect 값 대신 실제 호출 성공을 확인한다.
  return assert.ok(calls.length > 0);
});

test('KAC 리다이렉트 응답은 다른 호스트로 키를 보내지 않고503으로 거부한다', async () => {
  // 허용하지 않은 주소로 인증키가 재전송되지 않아야 한다.
  redirect = true;
  const beforeCalls = calls.length;
  const response = await mf.dispatchFetch('https://worker.test/');
  assert.equal(response.status, 503);
  return assert.equal(calls.length - beforeCalls, 1);
});
