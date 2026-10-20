import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app';
import { accounts } from './database';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_test',
  ALLOWED_ORIGINS: '',
};
const shortUrl = 'https://maps.app.goo.gl/fixture';
const blocked = [
  'https://169.254.169.254/maps/a',
  'https://2130706433/maps/a',
  'https://0x7f000001/maps/a',
  'https://[::1]/maps/a',
  'https://[::ffff:127.0.0.1]/maps/a',
  'https://localhost/maps/a',
  'https://www.google.com./maps/a',
  'https://www.google.com.evil.test/maps/a',
  'https://www.google.com@evil.test/maps/a',
  'https://evil.test@www.google.com/maps/a',
  'https://www.google.com:444/maps/a',
  'https://maps.app.goo.gl/a/b',
  'https://www.google.com/maps/../../url?q=https://evil.test',
  'http://maps.app.goo.gl/fixture',
  'file:///etc/passwd',
];

// 외부 요청을 격리해 실제 인증·검증 경계와 접속 목적지를 확인한다.
function isolatedFetcher(
  calls: Request[],
  location: string | null,
  unavailable = false,
): typeof fetch {
  // 내부망을 실제 호출하지 않고 외부 공급자 응답만 제어한다.
  return async (input, init) => {
    // 전체 요청을 기록하되 결과 보고에는 자격 증명을 쓰지 않는다.
    const request = new Request(input, init);
    calls.push(request);
    if (request.url.includes('/auth/v1/user'))
      return Response.json({
        id: accounts.owner,
        is_anonymous: false,
        aud: 'authenticated',
      });
    if (unavailable) throw new Error('PRIVATE_PROVIDER_ERROR');
    return new Response(null, {
      status: location ? 302 : 200,
      headers: location ? { Location: location } : {},
    });
  };
}

// 사용자 인증 헤더와 쿠키가 있는 실제 가져오기 API를 실행한다.
async function request(text: string, fetcher: typeof fetch): Promise<Response> {
  // 공급자 요청에 복사되면 안 되는 표식을 요청 헤더에 포함한다.
  return createApp(fetcher).request(
    `/api/v1/places/import?text=${encodeURIComponent(text)}`,
    {
      headers: {
        Authorization: 'Bearer fixture-token',
        Cookie: 'private-session=fixture',
        'X-Goog-Api-Key': 'private-key-fixture',
      },
    },
    env,
  );
}

test('SSRF: IP 표기 우회·IPv6·사용자 정보·호스트 혼동·경로 탈출을 접속 전에 차단한다', async () => {
  // 각 요청은 인증 공급자 한 번 외에 어떤 주소에도 접속하면 안 된다.
  for (const text of blocked) {
    const calls: Request[] = [];
    const response = await request(text, isolatedFetcher(calls, null));
    assert.deepEqual([response.status, calls.length], [422, 1], text);
  }
});

test('SSRF: 단축 링크의 모든 redirect 목적지를 재검증하고 내부망·외부 호스트를 차단한다', async () => {
  // 허용된 시작 호스트가 임의 목적지로 보내도 두 번째 접속을 허용하지 않는다.
  for (const location of [
    ...blocked,
    '//169.254.169.254/latest',
    '/../../secret/private',
  ]) {
    const calls: Request[] = [];
    const response = await request(shortUrl, isolatedFetcher(calls, location));
    assert.deepEqual([response.status, calls.length], [422, 2], location);
    assert.equal(calls[1]?.url, shortUrl);
  }
});

test('SSRF: 정상 목적지·단축 링크 순환에서도 HEAD와 manual, 공통 시간 제한, 비밀 헤더 분리를 유지한다', async () => {
  // 정상 공유 후보 반환과 순환 종료 양쪽에서 같은 외부 접속 정책을 검사한다.
  for (const loop of [false, true]) {
    const calls: Request[] = [];
    const response = await request(
      shortUrl,
      isolatedFetcher(
        calls,
        loop ? '/fixture' : 'https://www.google.com/maps/search/?query=Osaka',
      ),
    );
    assert.equal(response.status, loop ? 422 : 200);
    const external = calls.slice(1);
    assert.equal(external.length, loop ? 4 : 1);
    for (const value of external) {
      assert.equal(value.method, 'HEAD');
      assert.equal(value.redirect, 'manual');
      assert.equal(value.signal.aborted, false);
      assert.deepEqual([...value.headers.keys()], []);
    }
  }
});

test('SSRF: 공급자 실패·Location 누락은 원문·비밀 헤더를 노출하지 않는 공개 오류로 반환한다', async () => {
  // 내부 예외나 공급자 응답을 사용자의 오류 본문으로 전달하지 않는다.
  for (const unavailable of [false, true]) {
    const calls: Request[] = [];
    const response = await request(
      shortUrl,
      isolatedFetcher(calls, null, unavailable),
    );
    assert.equal(response.status, unavailable ? 503 : 422);
    const body = await response.text();
    assert.equal(
      /PRIVATE_PROVIDER_ERROR|private-session|private-key/.test(body),
      false,
    );
    assert.equal(calls.length, 2);
  }
});
