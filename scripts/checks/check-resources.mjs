import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { repositoryPath } from '../shared/repository-paths.cjs';

const mediaExtension = /\.(?:png|jpe?g|webp|gif|svg|ttf|otf|woff2?|mp4)$/i;

function filesIn(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(root, entry.name);
    // 링크를 따라가 저장소 밖의 파일을 읽지 않는다.
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function inspectResources(root) {
  const errors = [];
  const assetRoot = resolve(root, 'apps/mobile/assets');
  const sourceRoot = resolve(root, 'apps/mobile/src');
  const label = (file) => relative(root, file).split(sep).join('/');
  let references = 0;
  let fonts = 0;
  let mirrors = 0;
  function checkReference(file, value, directory = false) {
    const target = resolve(dirname(file), value);
    references += 1;
    if (target !== assetRoot && !target.startsWith(assetRoot + sep)) {
      errors.push(
        `${label(file)}: 앱 리소스는 apps/mobile/assets 안에 둡니다.`,
      );
    } else if (
      !existsSync(target) ||
      (directory ? !statSync(target).isDirectory() : !statSync(target).isFile())
    ) {
      errors.push(`${label(file)}: 리소스 경로를 찾을 수 없습니다: ${value}`);
    }
  }
  const configs = new Map([
    [resolve(root, 'apps/mobile/app.config.ts'), './assets/'],
    [resolve(root, 'app.config.ts'), './apps/mobile/assets/'],
  ]);
  const sources = [
    ...filesIn(sourceRoot).filter((file) => /\.tsx?$/.test(file)),
    ...[...configs.keys()].filter(existsSync),
  ];
  for (const file of sources) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const arg = node.arguments[0];
        const literal =
          arg &&
          (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg));
        if (
          literal &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'require' &&
          arg.text.startsWith('.') &&
          mediaExtension.test(arg.text)
        )
          checkReference(file, arg.text);
        if (
          literal &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.getText(source) === 'require.context'
        )
          checkReference(file, arg.text, true);
      }
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.startsWith('.') &&
        mediaExtension.test(node.moduleSpecifier.text)
      )
        checkReference(file, node.moduleSpecifier.text);
      if (
        configs.has(file) &&
        ts.isStringLiteral(node) &&
        node.text.startsWith(configs.get(file))
      )
        checkReference(file, node.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const manifest of filesIn(resolve(assetRoot, 'fonts')).filter((file) =>
    file.endsWith('font-manifest.json'),
  )) {
    try {
      const data = JSON.parse(readFileSync(manifest, 'utf8'));
      const folder = dirname(manifest);
      const local = (name) =>
        typeof name === 'string' &&
        name.length > 0 &&
        !/[\\/]/.test(name) &&
        name !== '..';
      if (
        !local(data.licenseFile) ||
        !existsSync(resolve(folder, data.licenseFile))
      )
        errors.push(`${label(manifest)}: 라이선스 파일을 확인해 주세요.`);
      const registered = new Set();
      for (const item of data.files) {
        if (!local(item.filename)) {
          errors.push(`${label(manifest)}: 글꼴 파일명이 올바르지 않습니다.`);
          continue;
        }
        registered.add(item.filename);
        const font = resolve(folder, item.filename);
        fonts += 1;
        if (!existsSync(font))
          errors.push(`${label(manifest)}: 글꼴 누락 ${item.filename}`);
        else if (
          statSync(font).size !== item.bytes ||
          digest(font) !== item.sha256
        )
          errors.push(
            `${label(manifest)}: 글꼴 크기·해시 불일치 ${item.filename}`,
          );
      }
      for (const font of filesIn(folder).filter(
        (file) =>
          dirname(file) === folder && /\.(?:otf|ttf|woff2?)$/.test(file),
      )) {
        if (!registered.has(relative(folder, font)))
          errors.push(
            `${label(manifest)}: 등록하지 않은 글꼴 ${relative(folder, font)}`,
          );
      }
    } catch {
      errors.push(`${label(manifest)}: 글꼴 명세 형식을 확인해 주세요.`);
    }
  }
  // 공개 URL용 사진은 앱 사진과 다른 원본일 수 있어 자체 명세로 검증한다.
  const publicRoot = resolve(root, 'apps/mobile/public/assets/destinations');
  const publicFiles = filesIn(publicRoot).filter((file) =>
    mediaExtension.test(file),
  );
  if (publicFiles.length || existsSync(resolve(publicRoot, 'manifest.json'))) {
    try {
      const data = JSON.parse(
        readFileSync(resolve(publicRoot, 'manifest.json'), 'utf8'),
      );
      const registered = new Set();
      for (const item of data.files) {
        if (typeof item.filename !== 'string' || /[\\/]/.test(item.filename))
          throw new Error('filename');
        const file = resolve(publicRoot, item.filename);
        registered.add(file);
        mirrors += 1;
        if (
          !existsSync(file) ||
          statSync(file).size !== item.bytes ||
          digest(file) !== item.sha256
        )
          errors.push(`${label(file)}: 공개 리소스 크기·해시 불일치`);
        if (!item.sourceUrl || !item.license)
          errors.push(`${label(file)}: 출처·이용 조건을 기록해 주세요.`);
      }
      for (const file of publicFiles)
        if (!registered.has(file))
          errors.push(`${label(file)}: 공개 리소스 명세에 등록해 주세요.`);
    } catch {
      errors.push(`${label(publicRoot)}: 공개 리소스 명세를 확인해 주세요.`);
    }
  }
  return { errors, references, fonts, mirrors };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = inspectResources(repositoryPath());
  for (const error of result.errors) console.error(error);
  console.info(
    `리소스 검사: 참조 ${result.references}개, 글꼴 ${result.fonts}개, 공개 이미지 ${result.mirrors}개, 오류 ${result.errors.length}개`,
  );
  process.exitCode = result.errors.length ? 1 : 0;
}
