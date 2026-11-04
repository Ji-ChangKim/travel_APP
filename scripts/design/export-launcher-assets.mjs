import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repositoryRoot, repositoryPath } from '../shared/repository-paths.cjs';

const generatorIndex = process.argv.indexOf('--generator');
if (generatorIndex < 0 || !process.argv[generatorIndex + 1])
  throw new Error(
    '--generator로 icon-generator 스킬의 Python 파일을 지정해 주세요.',
  );
const python = process.env.PYTHON || 'python';
const assets = repositoryPath('apps/mobile/assets/brand/tripprint-v1');
const output = repositoryPath('outputs/launcher-icons');

// Windows에서도 스킬의 완료 메시지를 UTF-8로 출력한다.
function runPython(args) {
  const result = spawnSync(python, args, {
    cwd: repositoryRoot,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('설치 아이콘 생성에 실패했습니다.');
}

runPython([
  resolve(process.argv[generatorIndex + 1]),
  resolve(assets, 'tripprint-launcher-source.png'),
  '-o',
  output,
  '--mode',
  'contain',
]);
copyFileSync(
  resolve(output, 'android/custom-1024/ic_launcher.png'),
  resolve(assets, 'tripprint-launcher-icon.png'),
);

// 이번 밝은 심볼 원본만 분리하며 다른 색의 로고에는 재사용하지 않는다.
runPython([
  '-c',
  String.raw`
from pathlib import Path
from PIL import Image, ImageChops
import sys
assets = Path(sys.argv[1])
source = Image.open(assets / 'tripprint-launcher-source.png').convert('RGB')
red, green, blue = source.split()
light = ImageChops.darker(ImageChops.darker(red, green), blue)
mask = light.point(lambda value: max(0, min(255, round((value - 150) * 255 / 105))))
foreground = Image.new('RGBA', source.size, 'white')
foreground.putalpha(mask)
# 원본 전체를 70%로 줄여 심볼을 Android 중앙 안전 원 안에 둔다.
side = round(1024 * 0.70)
foreground = foreground.resize((side, side), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
inset = (1024 - side) // 2
canvas.alpha_composite(foreground, (inset, inset))
canvas.save(assets / 'tripprint-launcher-adaptive.png')
`,
  assets,
]);
