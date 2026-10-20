import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const tokens = JSON.parse(
  readFileSync(path.join(root, 'docs/design/design-tokens.json'), 'utf8'),
);
const c = tokens.color;
const ledger = JSON.parse(
  readFileSync(path.join(root, 'docs/design/ledger-tokens.json'), 'utf8'),
).color;

// sRGB 원색을 선형 상대 휘도로 변환하며 계산 중 반올림하지 않는다.
function luminance(hex) {
  // 6자리 색상만 허용해 잘못된 토큰을 통과시키지 않는다.
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`잘못된 색상 토큰: ${hex}`);
  return hex
    .slice(1)
    .match(/../g)
    .reduce((sum, part, index) => {
      // WCAG의 채널 감마와 휘도 가중치를 적용한다.
      const value = parseInt(part, 16) / 255;
      return (
        sum +
        (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
          [0.2126, 0.7152, 0.0722][index]
      );
    }, 0);
}

// 실제 토큰 조합을 계산하고 기준과 반올림 전 값을 비교한다.
function pair(role, foreground, background, minimum, kind = 'text') {
  // 표시용 소수점 수와 통과 판정을 분리한다.
  const first = luminance(foreground);
  const second = luminance(background);
  const ratio =
    (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  return {
    role,
    kind,
    foreground,
    background,
    ratio,
    minimum,
    passes: ratio >= minimum,
  };
}

const checks = [];
const surfaces = {
  ...c.surface,
  selection: c.selection.surface,
  success: c.status.successSurface,
  warning: c.status.warningSurface,
  error: c.status.errorSurface,
  info: c.status.infoSurface,
};
for (const [name, background] of Object.entries(surfaces)) {
  for (const foreground of ['primary', 'secondary', 'link'])
    checks.push(
      pair(`text.${foreground}/${name}`, c.text[foreground], background, 4.5),
    );
}
for (const [name, foreground, background] of [
  ['primary', c.action.foreground, c.action.primary],
  ['pressed', c.action.pressedForeground, c.action.pressed],
  ['disabled', c.action.disabledText, c.action.disabledSurface],
  ['selection', c.selection.text, c.selection.surface],
  [
    'control.primary',
    tokens.control.primary.foreground,
    tokens.control.primary.background,
  ],
  [
    'control.highContrast',
    tokens.control.primaryHighContrast.foreground,
    tokens.control.primaryHighContrast.background,
  ],
  [
    'control.disabled',
    tokens.control.disabled.foreground,
    tokens.control.disabled.background,
  ],
  [
    'control.daySelected',
    tokens.control.daySelected.foreground,
    tokens.control.daySelected.background,
  ],
])
  checks.push(pair(`action.${name}`, foreground, background, 4.5));
for (const name of ['success', 'warning', 'error', 'info'])
  checks.push(
    pair(
      `status.${name}`,
      c.status[`${name}Text`] || c.status[name],
      c.status[`${name}Surface`],
      4.5,
    ),
  );
for (const name of ['canvas', 'card', 'low']) {
  checks.push(
    pair(`boundary/${name}`, c.border.strong, c.surface[name], 3, 'non-text'),
  );
  checks.push(
    pair(`focus/${name}`, c.border.focus, c.surface[name], 3, 'non-text'),
  );
}
checks.push(
  pair('focus/primary', c.border.focus, c.action.primary, 3, 'non-text'),
);

for (const background of ['canvas', 'surface', 'soft', 'selected', 'private']) {
  for (const foreground of ['ink', 'muted', 'accent'])
    checks.push(
      pair(
        `ledger.${foreground}/${background}`,
        ledger[foreground],
        ledger[background],
        4.5,
      ),
    );
  checks.push(
    pair(
      `ledger.focus/${background}`,
      ledger.ink,
      ledger[background],
      3,
      'non-text',
    ),
  );
}
checks.push(
  pair('ledger.primary', ledger.surface, ledger.accent, 4.5),
  pair('ledger.selected', ledger.surface, ledger.navy, 4.5),
  pair('ledger.private', ledger.privateText, ledger.private, 4.5),
);

const failures = checks.filter((item) => {
  // 실패한 조합만 차단 결과에 남긴다.
  return !item.passes;
});
const report = {
  standard: tokens.accessibility.standard,
  target: tokens.accessibility.level,
  textMinimum: 4.5,
  nonTextMinimum: 3,
  checks,
  failures,
  scope:
    '의미별 단색 토큰 조합. 실제 화면·입력·사진 위 글자·키보드·화면 읽기는 별도 검수한다.',
};
const output = path.join(root, 'outputs/haru-wcag-aa');
mkdirSync(output, { recursive: true });
writeFileSync(
  path.join(output, 'contrast-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
for (const item of checks.filter((item) => {
  // 대표 색상과 실패 항목만 콘솔에 간결하게 표시한다.
  return (
    [
      'text.primary/canvas',
      'text.secondary/canvas',
      'action.primary',
      'action.disabled',
    ].includes(item.role) || !item.passes
  );
}))
  console.log(
    `${item.role}: ${item.ratio.toFixed(2)}:1 (기준 ${item.minimum}:1)`,
  );
console.log(
  `WCAG AA 토큰 검사: ${checks.length - failures.length}/${checks.length} 통과`,
);
if (failures.length) process.exitCode = 1;
