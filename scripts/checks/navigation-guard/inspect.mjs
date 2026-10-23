import ts from 'typescript';
import {
  commonFiles,
  componentProps,
  nativeOverrides,
  rootLayout,
  sectionHeaderFiles,
} from './rules.mjs';

// 별칭으로 가져온 공통 요소도 같은 이름으로 검사한다.
function importedComponent(source, tag) {
  const local = tag.getText(source);
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const clause = statement.importClause;
    const moduleName = statement.moduleSpecifier.text
      .split('/')
      .at(-1)
      ?.replace(/\.tsx?$/, '');
    if (clause?.name?.text === local && componentProps[moduleName])
      return moduleName;
    if (
      clause?.namedBindings &&
      ts.isNamespaceImport(clause.namedBindings) &&
      local.startsWith(clause.namedBindings.name.text + '.')
    )
      return local.split('.').at(-1);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      const imported = clause.namedBindings.elements.find(
        (item) => item.name.text === local,
      );
      if (imported) return (imported.propertyName || imported.name).text;
    }
  }
  return local;
}

// View 하나로 헤더만 감싼 페이지 전용 장식을 찾는다.
function decoratedWrapper(node, source, component) {
  if (
    !ts.isJsxElement(node) ||
    node.openingElement.tagName.getText(source) !== 'View'
  )
    return false;
  if (
    !node.openingElement.attributes.properties.some(
      (attr) => ts.isJsxAttribute(attr) && attr.name.text === 'style',
    )
  )
    return false;
  const children = node.children.filter(
    (child) => !ts.isJsxText(child) || child.text.trim(),
  );
  return (
    children.length === 1 &&
    (ts.isJsxElement(children[0]) || ts.isJsxSelfClosingElement(children[0])) &&
    ['ScreenHeader', 'HomeHeader', 'GlobalNavigation'].includes(
      component(
        ts.isJsxElement(children[0])
          ? children[0].openingElement.tagName
          : children[0].tagName,
      ),
    )
  );
}

// StyleSheet의 속성 이름만 확인하며 업무 데이터의 header 필드에는 관여하지 않는다.
function isNavigationStyle(node, file, source) {
  if (
    !ts.isPropertyAssignment(node) ||
    !ts.isObjectLiteralExpression(node.parent)
  )
    return false;
  const call = node.parent.parent;
  if (
    !ts.isCallExpression(call) ||
    !/\.create$/.test(call.expression.getText(source))
  )
    return false;
  const key = node.name.getText(source).replace(/^['"]|['"]$/g, '');
  return (
    /^(topBar|brandTitle|headerTitle|navigationTitle|screenHeader|bottomNav\w*|gnb\w*|tabBar\w*)$/i.test(
      key,
    ) ||
    (key === 'header' && !sectionHeaderFiles.has(file))
  );
}

// 헤더라는 이름의 새 표현 컴포넌트도 공통 요소를 조립해야 한다.
function composesCommonHeader(node, component) {
  let found = false;
  function visit(child) {
    if (
      (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) &&
      ['ScreenHeader', 'HomeHeader', 'RecoveryHeader'].includes(
        component(child.tagName),
      )
    )
      found = true;
    ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

// 새 페이지의 스타일 주입·복제·네이티브 덮어쓰기를 소스 단계에서 차단한다.
export function inspectNavigationSource(file, text, resolveComponent) {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const component = (tag) =>
    resolveComponent?.(tag, source) || importedComponent(source, tag);
  const findings = [];
  const sites = [];
  let nativeHeaderHidden = false;
  let nativeTabBarHidden = false;
  const owner = commonFiles.has(file);
  function add(node, rule) {
    findings.push({
      file,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      rule,
    });
  }
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = component(node.tagName);
      const allowed = componentProps[name];
      if (allowed) {
        sites.push({ name, file });
        if (name === 'GlobalNavigation' && file !== rootLayout)
          add(node, 'GNB는 루트 레이아웃에서만 렌더링');
        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr))
            add(attr, '공통 헤더·GNB의 JSX spread 금지');
          else if (!allowed.includes(attr.name.text))
            add(attr, `${name}에 허용하지 않은 속성: ${attr.name.text}`);
        }
      }
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        const value = attr.initializer;
        if (
          name === 'ScreenHeader' &&
          attr.name.text === 'inset' &&
          value &&
          !(
            ts.isJsxExpression(value) &&
            value.expression?.kind === ts.SyntaxKind.TrueKeyword
          ) &&
          ![
            'features/workspace/DestinationPicker.tsx',
            'features/profile/MyAccountView.tsx',
          ].includes(file)
        )
          add(attr, 'inset 생략은 부모 여백을 확인한 기존 시트에서만 허용');
        if (attr.name.text === 'tabBar') {
          const expression =
            value && ts.isJsxExpression(value) ? value.expression : undefined;
          nativeTabBarHidden = Boolean(
            expression &&
            ts.isArrowFunction(expression) &&
            (expression.body.kind === ts.SyntaxKind.NullKeyword ||
              (ts.isBlock(expression.body) &&
                expression.body.statements.length === 1 &&
                ts.isReturnStatement(expression.body.statements[0]) &&
                expression.body.statements[0].expression?.kind ===
                  ts.SyntaxKind.NullKeyword)),
          );
          if (!nativeTabBarHidden)
            add(attr, '기본 탭 바 대신 페이지별 GNB를 만들 수 없음');
        }
        if (
          attr.name.text === 'testID' &&
          value &&
          ts.isStringLiteral(value) &&
          /^(screen-header|brand-header|global-navigation|footprints-feed-header)$/.test(
            value.text,
          ) &&
          !owner
        )
          add(attr, '공통 헤더·GNB 식별자를 페이지에서 복제할 수 없음');
        if (
          ['headerShown', 'tabBar'].includes(attr.name.text) &&
          !file.endsWith('/_layout.tsx')
        )
          add(attr, '페이지의 네이티브 헤더·탭 바 덮어쓰기 금지');
      }
    }
    if (!owner && decoratedWrapper(node, source, component))
      add(node, '헤더만 감싼 페이지 전용 스타일 금지');
    if (!owner && isNavigationStyle(node, file, source))
      add(node, '페이지 전용 헤더·GNB 스타일 정의 금지');
    if (
      !owner &&
      (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) &&
      /^[A-Z].*(?:Header|GNB|BottomNavigation|BottomNav)$/.test(
        node.name?.getText(source) || '',
      ) &&
      !composesCommonHeader(node, component)
    )
      add(node, '페이지 헤더·GNB 복제 대신 공통 요소를 조립해야 함');
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source).replace(/^['"]|['"]$/g, '');
      if (
        name === 'headerShown' &&
        node.initializer.kind === ts.SyntaxKind.FalseKeyword
      )
        nativeHeaderHidden = true;
      if (
        name === 'header' &&
        (ts.isArrowFunction(node.initializer) ||
          ts.isFunctionExpression(node.initializer)) &&
        !owner
      )
        add(node, '네이티브 옵션에서 페이지 전용 헤더를 렌더링할 수 없음');
      if (nativeOverrides.has(name) && !owner && name !== 'header')
        add(node, '페이지의 네이티브 탐색 스타일 덮어쓰기 금지');
      if (
        name === 'headerShown' &&
        (!file.endsWith('/_layout.tsx') ||
          node.initializer.kind !== ts.SyntaxKind.FalseKeyword)
      )
        add(node, '네이티브 기본 헤더는 공통 레이아웃에서만 숨김');
    }
    if (
      ts.isPropertySignature(node) &&
      ['header', 'right'].includes(node.name.getText(source)) &&
      /ReactNode|ReactElement/.test(node.type?.getText(source) || '')
    )
      add(node, '페이지 계약으로 임의 헤더 JSX를 전달할 수 없음');
    if (
      owner &&
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /(?:Styles$|\/homeTheme$|\/publicFeedStyles$)/.test(
        node.moduleSpecifier.text,
      ) &&
      !node.moduleSpecifier.text.startsWith('./')
    )
      add(node, '공통 헤더에서 페이지 스타일을 참조할 수 없음');
    if (
      ts.isCallExpression(node) &&
      /(?:^|\.)createElement$/.test(node.expression.getText(source)) &&
      node.arguments[0] &&
      componentProps[component(node.arguments[0])]
    )
      add(node, '공통 탐색 요소는 검사 가능한 JSX로만 조립');
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (
    ['app/_layout.tsx', 'app/(tabs)/_layout.tsx'].includes(file) &&
    !nativeHeaderHidden
  )
    add(source, '공통 레이아웃의 네이티브 헤더 숨김 정책 누락');
  if (file === 'app/(tabs)/_layout.tsx' && !nativeTabBarHidden)
    add(source, '기본 탭 바 숨김 정책 누락');
  return { findings, sites };
}
