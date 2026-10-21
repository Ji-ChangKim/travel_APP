import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { inspectNavigationSource } from './navigation-guard/inspect.mjs';
import { structuralRoutes, headerKinds } from './navigation-guard/rules.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(repository, 'apps/mobile/src');

// 생성물·외부 패키지 없이 앱 소스와 신규 라우트까지 매번 새로 수집한다.
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.tsx?$/.test(entry.name)
        ? [file]
        : [];
  });
}

// 정책 누락과 오래된 정책을 모두 실패 처리한다.
export function inspectRoutePolicies(routes, policies, hasHeader) {
  const findings = [];
  const registered = new Set();
  const paths = new Set();
  for (const policy of policies) {
    const file = 'app/' + policy.file;
    if (registered.has(policy.file) || !routes.includes(policy.file))
      findings.push({
        file,
        line: 1,
        rule: '중복되거나 실제 라우트가 없는 탐색 정책',
      });
    registered.add(policy.file);
    if (
      !headerKinds.has(policy.header) ||
      typeof policy.title !== 'string' ||
      typeof policy.gnb !== 'boolean'
    )
      findings.push({
        file,
        line: 1,
        rule: '헤더 유형·제목·GNB 정책이 유효하지 않음',
      });
    if (policy.path && paths.has(policy.path))
      findings.push({ file, line: 1, rule: '중복된 탐색 경로 정책' });
    if (policy.path) paths.add(policy.path);
    if (policy.file !== 'index.tsx' && policy.file !== '+not-found.tsx') {
      const expectedPath =
        '/' +
        policy.file
          .replace(/\([^/]+\)\//g, '')
          .replace(/\.tsx?$/, '')
          .replace(/(^|\/)index$/, '')
          .replace(/\[([^\]]+)\]/g, ':$1');
      if (policy.path !== expectedPath)
        findings.push({
          file,
          line: 1,
          rule: '정책 경로와 실제 파일 라우트가 다름',
        });
    }
    if (policy.gnb !== policy.file.startsWith('(tabs)/'))
      findings.push({
        file,
        line: 1,
        rule: '최상위 탭과 상세·작성의 GNB 표시 정책이 다름',
      });
    if (policy.header === 'launch' && policy.file !== 'index.tsx')
      findings.push({
        file,
        line: 1,
        rule: '시작 BI 외 페이지에서 헤더를 생략할 수 없음',
      });
    if (
      policy.header !== 'launch' &&
      !hasHeader(
        file,
        policy.header === 'brand' ? 'HomeHeader' : 'ScreenHeader',
      )
    )
      findings.push({
        file,
        line: 1,
        rule: '화면에서 공통 헤더로 연결되는 실행 의존성이 없음',
      });
  }
  for (const file of routes) {
    if (!registered.has(file))
      findings.push({
        file: 'app/' + file,
        line: 1,
        rule: '신규 페이지의 헤더·GNB 정책 누락',
      });
  }
  return findings;
}

// 별칭·재내보내기를 지나 실제 공통 컴포넌트의 선언을 확인한다.
function componentResolver(checker, original) {
  return (node) => {
    // 검사 구문과 프로그램 구문의 위치를 대응시켜 같은 심벌을 읽는다.
    let actual;
    function find(candidate) {
      if (
        candidate.pos === node.pos &&
        candidate.end === node.end &&
        candidate.kind === node.kind
      )
        actual = candidate;
      if (!actual && candidate.pos <= node.pos && candidate.end >= node.end)
        ts.forEachChild(candidate, find);
    }
    find(original);
    let symbol =
      actual &&
      checker.getSymbolAtLocation(
        ts.isPropertyAccessExpression(actual) ? actual.name : actual,
      );
    if (symbol?.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration || symbol?.declarations?.[0];
    const owner =
      declaration &&
      path.basename(declaration.getSourceFile().fileName, '.tsx');
    return declaration?.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    ) &&
      owner &&
      [
        'ScreenHeader',
        'ScreenTitle',
        'HeaderAction',
        'HeaderActions',
        'HomeHeader',
        'RecoveryHeader',
        'GlobalNavigation',
      ].includes(owner)
      ? owner
      : declaration?.name?.getText(declaration.getSourceFile());
  };
}

// 실행 import·재내보내기·동적 import·require로 화면 연결 가능성을 추적한다.
function runtimeDependencies(source, options, files) {
  const dependencies = new Set();
  function add(specifier) {
    if (!specifier || !ts.isStringLiteral(specifier)) return;
    const resolved = ts.resolveModuleName(
      specifier.text,
      source.fileName,
      options,
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    if (resolved && files.has(path.resolve(resolved)))
      dependencies.add(path.resolve(resolved));
  }
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      !(
        !node.importClause?.name &&
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.every(
          (item) => item.isTypeOnly,
        )
      )
    )
      add(node.moduleSpecifier);
    if (ts.isExportDeclaration(node) && !node.isTypeOnly)
      add(node.moduleSpecifier);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === 'require')
    )
      add(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return dependencies;
}

// 실제 저장소와 정책을 함께 확인하며 앱 소스는 변경하지 않는다.
export function auditNavigation() {
  const files = sourceFiles(sourceRoot);
  const config = ts.readConfigFile(
    path.join(repository, 'tsconfig.json'),
    ts.sys.readFile,
  );
  const options = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    repository,
  ).options;
  const program = ts.createProgram(files, options);
  const checker = program.getTypeChecker();
  const paths = new Set(files.map((file) => path.resolve(file)));
  const graph = new Map();
  const findings = [];
  const sites = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    const relative = path.relative(sourceRoot, file).replaceAll('\\', '/');
    const result = inspectNavigationSource(
      relative,
      source.text,
      componentResolver(checker, source),
    );
    findings.push(...result.findings);
    sites.push(...result.sites);
    graph.set(path.resolve(file), runtimeDependencies(source, options, paths));
  }
  function hasHeader(file, name) {
    const pending = [path.resolve(sourceRoot, file)];
    const seen = new Set();
    while (pending.length) {
      const current = pending.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      const relative = path.relative(sourceRoot, current).replaceAll('\\', '/');
      if (sites.some((site) => site.file === relative && site.name === name))
        return true;
      pending.push(...(graph.get(current) || []));
    }
    return false;
  }
  const routes = files
    .map((file) =>
      path.relative(path.join(sourceRoot, 'app'), file).replaceAll('\\', '/'),
    )
    .filter((file) => !file.startsWith('../') && !structuralRoutes.has(file));
  const policies = JSON.parse(
    fs.readFileSync(
      path.join(sourceRoot, 'components/screenNavigationPolicy.json'),
      'utf8',
    ),
  );
  findings.push(...inspectRoutePolicies(routes, policies, hasHeader));
  if (sites.filter((site) => site.name === 'GlobalNavigation').length !== 1)
    findings.push({
      file: 'app/_layout.tsx',
      line: 1,
      rule: '앱 전체 GNB 렌더링은 정확히 1곳이어야 함',
    });
  return { files: files.length, routes: routes.length, findings };
}

function main() {
  const result = auditNavigation();
  console.info(
    `헤더·GNB 경계 검사: ${result.files}개 소스, ${result.routes}개 화면, 위반 ${result.findings.length}건`,
  );
  for (const finding of result.findings)
    console.error(`${finding.file}:${finding.line} ${finding.rule}`);
  process.exitCode = result.findings.length ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  main();
