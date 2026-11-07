import { tsImport } from 'tsx/esm/api';

const { cloudAuth } = await tsImport(
  '../../apps/api/src/features/auth/cloudAuth.ts',
  import.meta.url,
);

// 닫힌 신규 가입 HTTP 경로를 열지 않고, 기존 이메일 자료를 실제 SDK로 준비한다.
export async function seedLegacyAccount(mf, body) {
  const response = await cloudAuth(await mf.getBindings()).api.signUpEmail({
    asResponse: true,
    body,
  });
  const headers = new Headers(response.headers);
  const cookie = headers.get('set-cookie')?.split(';')[0];
  if (cookie)
    headers.set(
      'set-auth-token',
      decodeURIComponent(cookie.split('=').slice(1).join('=')),
    );
  return new Response(await response.text(), {
    status: response.status,
    headers,
  });
}
