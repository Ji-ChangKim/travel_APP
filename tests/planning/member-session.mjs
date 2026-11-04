import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { apiOrigin, webOrigin } from './runtime.mjs';

// 외부 Google 인증 대신 로컬 API가 실제 발급한 세션을 복원한다. 사용자·응답은 꾸미지 않는다.
export async function signInPlanningMember(page, member, mode = 'sign-in') {
  const response = await page.request.post(
    `${apiOrigin}/api/auth/${mode}/email`,
    {
      headers: { Origin: webOrigin },
      data: {
        email: member.email,
        password: member.password,
        ...(mode === 'sign-up' ? { name: member.name } : {}),
      },
    },
  );
  assert.ok(response.ok(), `검수 계정 인증 HTTP ${response.status()}`);
  const token = response.headers()['set-auth-token'];
  assert.ok(token, '실제 API 세션 발급을 확인합니다.');
  await page.evaluate((value) => {
    localStorage.setItem('wherego.cloud.session.v1', value);
  }, token);
  let sessionResponse = await reloadSession(page);
  if (sessionResponse.status() === 429) {
    const retryHeader = sessionResponse.headers()['x-retry-after'];
    const retrySeconds = Number(retryHeader);
    assert.ok(
      /^\d+$/.test(retryHeader || '') &&
        Number.isInteger(retrySeconds) &&
        retrySeconds >= 1 &&
        retrySeconds <= 60,
      '인증 제한 응답에는 1~60초의 대기 시간이 있어야 합니다.',
    );
    // 빠른 전체 검수가 실제 제한에 닿으면 서버가 정한 시간 뒤 한 번만 재조회한다.
    await page.waitForTimeout(retrySeconds * 1000);
    sessionResponse = await reloadSession(page);
  }
  assert.equal(
    sessionResponse.status(),
    200,
    `검수 계정 세션 확인 HTTP ${sessionResponse.status()}`,
  );
  await expect(
    page.getByRole('button', { name: '이어서 시작하기', exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole('button', { name: '이어서 시작하기', exact: true })
    .click();
  return token;
}

async function reloadSession(page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url() === `${apiOrigin}/api/auth/get-session` &&
        candidate.request().method() === 'GET',
    ),
    page.reload(),
  ]);
  return response;
}
