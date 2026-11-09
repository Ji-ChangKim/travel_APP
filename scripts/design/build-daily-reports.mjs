import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import prettier from 'prettier';
import {
  firstReportTable,
  reportSection,
  renderReportMarkdown,
  reportImprovementTables,
} from './daily-report-markdown.mjs';
import paths from '../shared/repository-paths.cjs';

const root = paths.repositoryRoot;
const reportRoot = resolve(root, 'docs/998. 일일 업무 보고서');
const templateRoot = resolve(
  root,
  'docs/02. 디자인/02. 리소스/00. 일일보고서사이트',
);
const reports = [];
for (const entry of await readdir(reportRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !/^\d{2}\.\d{2}\.\d{2}$/.test(entry.name))
    continue;
  const date = `20${entry.name.replaceAll('.', '-')}`;
  const parsed = new Date(date + 'T12:00:00Z');
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new Error('유효하지 않은 보고서 날짜: ' + entry.name);
  const files = (await readdir(join(reportRoot, entry.name))).filter((file) =>
    file.endsWith('.md'),
  );
  if (files.length !== 1)
    throw new Error(
      entry.name + ': 날짜별 원본 Markdown 보고서는 한 개여야 합니다.',
    );
  const markdown = await readFile(
    join(reportRoot, entry.name, files[0]),
    'utf8',
  );
  const work = firstReportTable(
    reportSection(markdown, '완료 내용과 남은 범위'),
  ).map(([area, after, boundary]) => ({
    area,
    after,
    boundary,
    status:
      area === '홈 구성' ? 'review' : area === '게스트' ? 'pending' : 'done',
  }));
  const improvements = reportImprovementTables(markdown);
  const checks = firstReportTable(
    reportSection(markdown, '검증 환경·결과·증거'),
  )
    .filter(([name]) => name.startsWith('npm run '))
    .map(([name, result, evidence]) => ({ name, result, evidence }));
  const next = firstReportTable(
    reportSection(markdown, '남은 작업과 적용 순서'),
  ).map(([title, action, status]) => ({ title, action, status }));
  const originalTitle = /^#\s+(.+)$/m.exec(markdown)?.[1] || '일일 보고서';
  const summary =
    reportSection(markdown, '완료 내용과 남은 범위').trim().split('\n\n')[0] ||
    markdown
      .replace(/^#+\s.*$/gm, '')
      .trim()
      .split('\n\n')[0];
  reports.push({
    id: date,
    date,
    title:
      originalTitle === '일일 통합 작업 보고서'
        ? '앱 기본 구조와 프로필, 여행 일정 개선'
        : originalTitle,
    summary,
    work,
    improvements,
    checks,
    next,
    markdown,
    sourceHref: `${entry.name}/${files[0]}`,
    origin: 'project',
  });
}
reports.sort((a, b) => b.date.localeCompare(a.date));
const tokens = JSON.parse(
  await readFile(
    resolve(root, 'docs/02. 디자인/00. 공통규격/design-tokens.json'),
    'utf8',
  ),
);
const variables = {
  canvas: tokens.color.surface.canvas,
  paper: tokens.color.surface.card,
  low: tokens.color.surface.low,
  raised: tokens.color.surface.raised,
  ink: tokens.color.text.primary,
  muted: tokens.color.text.secondary,
  coral: tokens.color.action.primary,
  coralDark: tokens.color.action.pressed,
  coralSoft: tokens.color.selection.surface,
  border: tokens.color.border.subtle,
  strong: tokens.color.border.strong,
  green: tokens.color.status.success,
  greenSoft: tokens.color.status.successSurface,
  amber: tokens.color.status.warningText,
  amberSoft: tokens.color.status.warningSurface,
  red: tokens.color.status.error,
  redSoft: tokens.color.status.errorSurface,
};
const cssTokens =
  ':root{' +
  Object.entries(variables)
    .map(([key, value]) => `--${key}:${value}`)
    .join(';') +
  '}';
const [template, css, js] = await Promise.all(
  [
    'daily-report-site.html',
    'daily-report-site.css',
    'daily-report-site.js',
  ].map((name) => readFile(join(templateRoot, name), 'utf8')),
);
const [tcScript, tcCss, tcCatalog, tcResults, designScript, designCss] =
  await Promise.all([
    readFile(join(templateRoot, 'daily-report-tc.js'), 'utf8'),
    readFile(join(templateRoot, 'daily-report-tc.css'), 'utf8'),
    readFile(
      resolve(root, 'docs/03. 개발/04. 검증/페이지별_TC_목록.json'),
      'utf8',
    ).then(JSON.parse),
    readFile(join(reportRoot, 'tc-results.json'), 'utf8').then(JSON.parse),
    readFile(join(templateRoot, 'daily-report-designs.js'), 'utf8'),
    readFile(join(templateRoot, 'daily-report-designs.css'), 'utf8'),
  ]);
const ids = new Set();
for (const page of tcCatalog.pages) {
  if (
    !/^P\d{2}$/.test(page.id) ||
    !page.name ||
    !page.condition ||
    !page.cases.length
  )
    throw new Error('TC 페이지 정의를 확인해 주세요.');
  for (const item of page.cases) {
    if (
      !new RegExp(`^TC-${page.id}-\\d{2}$`).test(item.id) ||
      ids.has(item.id) ||
      !item.title ||
      !item.expected ||
      !Array.isArray(item.steps) ||
      !item.steps.length ||
      item.steps.some((step) => typeof step !== 'string' || !step.trim())
    )
      throw new Error('중복되거나 불완전한 TC 정의: ' + item.id);
    ids.add(item.id);
  }
}
if (
  tcCatalog.schemaVersion !== 1 ||
  tcResults.catalogRevision !== tcCatalog.revision
)
  throw new Error('TC 목록과 결과의 버전을 확인해 주세요.');
const data = JSON.stringify({
  version: 1,
  reports,
  tcCatalog,
  tcResults,
}).replace(/</g, '\\u003c');
const output = template
  // 보고서의 달러·백틱 조합도 치환 문법으로 해석하지 않고 그대로 보관한다.
  .replace('/* REPORT_TOKENS */', () => cssTokens)
  .replace('/* REPORT_CSS */', () => css + '\n' + tcCss + '\n' + designCss)
  .replace('/* REPORT_RENDERER */', () => renderReportMarkdown.toString())
  .replace(
    '/* REPORT_SCRIPT */',
    () => designScript + '\n' + tcScript + '\n' + js,
  )
  .replace('REPORT_DATA_JSON', () => data);
const formatOptions = await prettier.resolveConfig(join(root, 'package.json'));
await writeFile(
  join(reportRoot, 'index.html'),
  await prettier.format(output, { ...formatOptions, parser: 'html' }),
  'utf8',
);
console.log(
  `일일 보고서 ${reports.length}일 생성: docs/998. 일일 업무 보고서/index.html`,
);
