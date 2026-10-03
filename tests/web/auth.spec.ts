import { test, expect } from '@playwright/test';

// 잘못된 콜백은 앱 화면 대신 로그인 복귀 안내를 표시한다.
test('인증 코드 없는 콜백은 오류 안내 후 로그인으로 복귀한다', ({ page }) => {
  // 사용자와 동일하게 실제 콜백 URL을 직접 연다.
  return page
    .goto('/auth/callback')
    .then(() => {
      // 실패 상태에서 로그인 복귀 버튼만 제공한다.
      return expect(
        page.getByRole('button', { name: '로그인으로 돌아가기' }),
      ).toBeVisible();
    })
    .then(() => {
      // 오류 화면에서 사용자가 새 로그인을 시작한다.
      return page.getByRole('button', { name: '로그인으로 돌아가기' }).click();
    })
    .then(() => {
      // 임시 로그인 대신 실제 인증 화면에 남아 있어야 한다.
      return expect(page).toHaveURL(/\/login$/);
    });
});
