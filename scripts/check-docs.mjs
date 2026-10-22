import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// 비공개 폴더에서는 이름 규칙만 확인하고 파일 내용은 읽지 않는다.
export function checkDocumentation(projectRoot) {
  const docs = resolve(projectRoot, 'docs');
  const problems = [];
  let documents = 0;
  let links = 0;

  function inspect(folder, privateArea = false) {
    const entries = readdirSync(folder, { withFileTypes: true });
    const numbers = new Set();
    for (const entry of entries) {
      const full = resolve(folder, entry.name);
      if (entry.isSymbolicLink()) {
        problems.push(
          `${relative(projectRoot, full)}: 문서 폴더의 링크는 허용하지 않습니다.`,
        );
        continue;
      }
      if (entry.isDirectory()) {
        const number = entry.name.match(/^(\d{2})\. .+$/)?.[1];
        if (!number || numbers.has(number)) {
          problems.push(
            `${relative(projectRoot, folder)}: 폴더 번호가 없거나 중복됩니다.`,
          );
        }
        numbers.add(number);
        const deletionArea = entry.name === '99. 삭제필요';
        if (
          number === '99' &&
          entry.name !== '99. 아카이브' &&
          !(deletionArea && folder.split(sep).at(-1) === '99. 아카이브')
        ) {
          problems.push(
            `${relative(projectRoot, folder)}: 99는 아카이브와 그 안의 삭제필요 폴더만 사용합니다.`,
          );
        }
        inspect(full, privateArea || entry.name === '98. keys');
      } else if (!privateArea && entry.name.endsWith('.md')) {
        documents += 1;
        // 코드 예시 안의 Markdown은 실제 이동 링크로 판단하지 않는다.
        const text = readFileSync(full, 'utf8').replace(
          /^(```|~~~)[\s\S]*?^\1.*$/gm,
          '',
        );
        for (const match of text.matchAll(
          /!?\[[^\]\n]*\]\((<[^>\n]+>|[^)\n]+)\)/g,
        )) {
          const value = match[1].startsWith('<')
            ? match[1].slice(1, -1)
            : match[1].replace(/\s+["'][^"']*["']$/, '');
          const target = value.split(/[?#]/)[0];
          if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
          links += 1;
          let decoded;
          try {
            decoded = decodeURIComponent(target);
          } catch {
            problems.push(
              `${relative(projectRoot, full)}: 잘못 인코딩된 링크 ${target}`,
            );
            continue;
          }
          const destination = resolve(dirname(full), decoded);
          const location = relative(projectRoot, destination);
          if (
            isAbsolute(location) ||
            location === '..' ||
            location.startsWith('..' + sep)
          ) {
            problems.push(
              `${relative(projectRoot, full)}: 프로젝트 밖으로 연결되는 로컬 링크 ${target}`,
            );
          } else if (!existsSync(destination)) {
            problems.push(
              `${relative(projectRoot, full)}: 없는 대상 ${target}`,
            );
          }
        }
      }
    }
  }

  inspect(docs);
  return { documents, links, problems };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = checkDocumentation(root);
  for (const problem of result.problems) process.stderr.write(problem + '\n');
  process.stdout.write(
    `문서 ${result.documents}개·링크 ${result.links}개 검사, 오류 ${result.problems.length}개\n`,
  );
  process.exitCode = result.problems.length ? 1 : 0;
}
