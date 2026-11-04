import assert from 'node:assert/strict';

// 현재 표시 월에서 실제 달력 버튼으로 이동해 출발일·도착일을 고른다.
export async function pickCalendarDate(page, date) {
  const current = await page
    .getByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ })
    .first()
    .getAttribute('aria-label');
  const monthNumber = (value) =>
    Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  const delta = monthNumber(date) - monthNumber(current);
  assert.ok(Math.abs(delta) <= 120, '검수 날짜는 표시 월의 10년 이내입니다.');
  for (let index = 0; index < Math.abs(delta); index += 1)
    await page
      .getByRole('button', {
        name: delta > 0 ? '다음 달' : '이전 달',
        exact: true,
      })
      .click();
  await page.getByRole('button', { name: date, exact: true }).click();
}
