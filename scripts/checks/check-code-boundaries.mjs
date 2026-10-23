import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repository = fileURLToPath(new URL('../../', import.meta.url));
// 관광청 이용 조건과 함께 등록한 공용 정적 자산은 백엔드 기본 주소와 구분한다.
const approvedStaticAssets = new Map([
  [
    'apps/api/src/features/discovery/discoveryAssets.ts',
    new Set([
      'https://tripprint-staging.pages.dev/assets/destinations/taipei-101-tourism.jpg',
    ]),
  ],
]);
const views = new Set([
  'WorkspaceView.tsx',
  'PrivatePhotoView.tsx',
  'ui.tsx',
  'RecordEditorScreenView.tsx',
  'MyAccountView.tsx',
  'CommunityScreenView.tsx',
  'FlightTicketEditorView.tsx',
  'LedgerDiaryView.tsx',
  'PlanEditorView.tsx',
  'PlanEditorOptions.tsx',
  'PublicFeedControls.tsx',
  'PublicFeedFilters.tsx',
  'PublishFlow.tsx',
  'PublishSummary.tsx',
  'PublishSelectionView.tsx',
  'ReceiptReviewView.tsx',
  'ScheduleEditorView.tsx',
  'ScheduleLocationView.tsx',
  'TripPlanningFlowView.tsx',
  'TripTimelineView.tsx',
  'WorkspaceSections.tsx',
  'WorkspaceDialogs.tsx',
]);
const controllers = new Set([
  'useWorkspaceController.ts',
  'useWorkspaceEditorState.ts',
  'useWorkspaceNavigationState.ts',
  'usePublishNavigation.ts',
  'useWorkspaceOperations.ts',
  'usePrivatePhoto.ts',
  'useRecordEditorController.ts',
  'useMyAccountController.ts',
  'useDiscoveryController.ts',
  'useFlightTicketController.ts',
  'useScheduleLocationController.ts',
  'useStartupController.ts',
]);
// 요청 행동은 기기·통신 기능을 사용할 수 있지만 화면과 스타일을 소유하지 않는다.
const workflows = new Set([
  'tripQueries.ts',
  'useCommunityImport.ts',
  'workspaceSaveSession.ts',
  'workspaceCommands.ts',
  'workspaceFormActions.ts',
  'workspaceMediaActions.ts',
  'workspaceChecklistActions.ts',
  'workspaceEditorActions.ts',
  'useWorkspaceData.ts',
  'recordPersistence.ts',
  'profileEditorActions.ts',
  'profileLogoutActions.ts',
  'publicPlanShare.ts',
  'usePublishedPlanShare.ts',
]);
const pureModels = new Set([
  'sessionTokenStorage.ts',
  'formCommands.ts',
  'workspaceModelCore.ts',
  'workspaceSchedules.ts',
  'userFacingError.ts',
  'workspaceFailure.ts',
  'workspaceDrafts.ts',
  'recordFailure.ts',
  'saveRecovery.ts',
  'imagePreparation.ts',
  'destinationCatalog.ts',
  'ledgerActionAppearance.ts',
  'workspaceScreenActions.ts',
  'scheduleCopy.ts',
  'publicPlanLink.ts',
  'recordDetails.ts',
]);
const styles = new Set([
  'workspaceStyles.ts',
  'ledgerTheme.ts',
  'ledgerShellStyles.ts',
  'myAccountStyles.ts',
  'tripTimelineStyles.ts',
]);

// 타입 전용 참조는 실행 의존성이 아니므로 계층 검사에서 제외한다.
function runtimeImport(node) {
  // import type과 모든 이름에 type이 붙은 참조를 구분한다.
  return (
    !node.importClause?.isTypeOnly &&
    !(
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      !node.importClause.name &&
      node.importClause.namedBindings.elements.every((item) => {
        // 혼합 import의 실제 실행 이름만 검사한다.
        return item.isTypeOnly;
      })
    )
  );
}

// 실제 TypeScript 구문에서 역할 역전과 금지된 기본값을 찾는다.
export function inspectCodeBoundary(file, text) {
  // 숫자·색·정상 외부 링크를 일괄 금지하지 않고 검증한 경계를 적용한다.
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const name = path.basename(file);
  const roleName = name.replace(/\.tsx$/, '.ts');
  const normalized = file.replaceAll('\\', '/');
  const findings = [];
  function add(node, rule) {
    // 원문이나 인증 값을 복사하지 않고 위치와 규칙만 보고한다.
    findings.push({
      file: normalized,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      rule,
    });
  }
  function visit(node) {
    // 실행 import와 실행 구문을 구분해 가짜 양성 결과를 줄인다.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'test' &&
      node.expression.expression.kind ===
        ts.SyntaxKind.RegularExpressionLiteral &&
      node.expression.expression.getText(source) === '/[가-힣]/' &&
      node.arguments[0] &&
      ts.isPropertyAccessExpression(node.arguments[0]) &&
      node.arguments[0].name.text === 'message' &&
      ['error', 'failure'].includes(
        node.arguments[0].expression.getText(source),
      )
    )
      add(node, '한글 포함 여부만으로 미확인 예외 메시지를 표시할 수 없음');
    if (ts.isImportDeclaration(node) && runtimeImport(node)) {
      const dependency = node.moduleSpecifier.text;
      if (
        /\/WorkspaceScreen$|^\.\/WorkspaceScreen$/.test(dependency) &&
        !normalized.startsWith('apps/mobile/src/app/')
      )
        add(node, '화면 모듈을 공통 기능 도우미로 참조할 수 없음');
      if (
        views.has(name) &&
        /api-client|query|\/service$|\/services\/|\/stores\/|expo-crypto/.test(
          dependency,
        )
      )
        add(node, '표현 컴포넌트에 조회·인증·저장·ID 생성 의존성 금지');
      if (
        (pureModels.has(roleName) ||
          normalized.startsWith('packages/api-client/src/')) &&
        /^(react|react-native|expo-router)$|\/components\/|\/stores\/|\/service$|\/DestinationPicker$/.test(
          dependency,
        )
      )
        add(node, '순수 기능 모델에 화면·네이티브 상태 의존성 금지');
      if (
        styles.has(name) &&
        /api-client|query|\/service$|\/services\/|\/stores\//.test(dependency)
      )
        add(node, '스타일 규격에 조회·저장 의존성 금지');
      if (
        controllers.has(roleName) &&
        /\/DestinationPicker$|\/workspaceStyles$|\/ledgerTheme$/.test(
          dependency,
        )
      )
        add(node, '컨트롤러에서 화면을 데이터·스타일 저장소로 참조할 수 없음');
      if (
        workflows.has(roleName) &&
        /\/components\/|\/workspaceStyles$|\/ledgerTheme$|\/LedgerUI$|\/DestinationPicker$/.test(
          dependency,
        )
      )
        add(node, '요청 행동 모듈에 화면·스타일 의존성 금지');
    }
    if (
      (controllers.has(roleName) ||
        workflows.has(roleName) ||
        pureModels.has(roleName)) &&
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
    )
      add(node, '기능 계층에 JSX 렌더링 금지');
    if (
      views.has(name) &&
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'fetch'
    )
      add(node, '표현 컴포넌트의 직접 통신 금지');
    if (
      views.has(name) &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'operation'
    )
      add(node, '표현 컴포넌트에서 서버 명령 본문을 생성할 수 없음');
    if (ts.isIdentifier(node) && /PrototypeScreen$/.test(node.text))
      add(node, '폐기한 프로토타입을 제품 라우트에 포함할 수 없음');
    if (
      ts.isStringLiteralLike(node) &&
      /^https?:\/\/(?:[^/]+\.)?(?:workers\.dev|pages\.dev|api\.wherego\.app)(?:\/|$)/.test(
        node.text,
      ) &&
      !approvedStaticAssets.get(normalized)?.has(node.text)
    )
      add(node, '배포 API·웹 주소를 제품 코드의 고정 기본값으로 둘 수 없음');
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

// 자동 생성 파일을 제외한 실제 앱·서버·공유 패키지 코드만 수집한다.
function sourceFiles(directory) {
  // 파일 이름만 확인하며 환경 변수와 키 폴더를 읽지 않는다.
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    // 패키지가 관리하는 파일과 프로젝트 코드를 섞지 않는다.
    const file = path.join(directory, entry.name);
    return entry.name === 'node_modules'
      ? []
      : entry.isDirectory()
        ? sourceFiles(file)
        : /\.tsx?$/.test(entry.name)
          ? [file]
          : [];
  });
}

// 계층 위반은 검사 실패로, 함수 길이·catch 수는 수동 검토 지표로 보고한다.
export function auditCode() {
  // 자동 지표만으로 함수 책임과 예외 처리의 적합성을 확정하지 않는다.
  const files = ['apps/mobile/src', 'apps/api/src', 'packages'].flatMap(
    (directory) => sourceFiles(path.join(repository, directory)),
  );
  const findings = [];
  const longFunctions = [];
  let catches = 0;
  let anyTypes = 0;
  for (const absolute of files) {
    const file = path.relative(repository, absolute).replaceAll('\\', '/');
    const text = fs.readFileSync(absolute, 'utf8');
    findings.push(...inspectCodeBoundary(file, text));
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
    );
    function count(node) {
      // 수동 검토할 크기·예외·타입 우회를 숫자로 기록한다.
      if (ts.isCatchClause(node)) catches += 1;
      if (node.kind === ts.SyntaxKind.AnyKeyword) anyTypes += 1;
      if (ts.isFunctionLike(node) && node.body) {
        const from =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const lines =
          source.getLineAndCharacterOfPosition(node.end).line + 1 - from;
        if (lines > 200) longFunctions.push({ file, line: from, lines });
      }
      ts.forEachChild(node, count);
    }
    count(source);
  }
  return { files: files.length, findings, longFunctions, catches, anyTypes };
}

// 통합 검사에서는 실제 소스를 확인하고 위반이 있으면 종료 코드를 남긴다.
function main() {
  // 상세 보고는 명시한 프로젝트 출력 경로에만 기록한다.
  const result = auditCode();
  const reportIndex = process.argv.indexOf('--report');
  if (reportIndex >= 0) {
    const report = path.resolve(repository, process.argv[reportIndex + 1]);
    if (!report.startsWith(path.join(repository, 'outputs') + path.sep))
      throw new Error('보고서는 outputs 아래에만 기록합니다.');
    fs.writeFileSync(report, JSON.stringify(result, null, 2));
  }
  console.info(
    `코드 경계 검사: ${result.files}개 파일, 위반 ${result.findings.length}건`,
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
