import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDay, buildName } from '../../scripts/export-android-build.mjs';

// 한국 자정에는 UTC 날짜와 달라도 한국 날짜를 사용한다.
test('Android 산출물 날짜는 한국 시간 기준이다', () => {
  assert.equal(buildDay(new Date('2026-10-11T15:01:00Z')), '261012');
});

// APK와 AAB는 같은 실행 번호를 공유한다.
test('같은 실행은 같은 번호를 사용한다', () => {
  assert.equal(
    buildName(
      'TripPrint',
      '261012',
      'run',
      { run: 'TripPrint_261012_Ver07' },
      [],
    ),
    'TripPrint_261012_Ver07',
  );
});

// 두 확장자 중 하나라도 있으면 다음 번호를 사용한다.
test('기존 APK와 AAB의 파일명을 덮어쓰지 않는다', () => {
  assert.equal(
    buildName('TripPrint', '261012', 'new', {}, [
      'TripPrint_261012_Ver00.aab',
      'TripPrint_261012_Ver01.apk',
    ]),
    'TripPrint_261012_Ver02',
  );
});

// 제한된 파일명 범위를 넘어가면 기존 파일을 보호한다.
test('Ver99까지 사용하면 덮어쓰기 없이 중단한다', () => {
  assert.throws(
    () =>
      buildName(
        'TripPrint',
        '261012',
        'new',
        {},
        Array.from(
          { length: 100 },
          (_, n) => `TripPrint_261012_Ver${String(n).padStart(2, '0')}.apk`,
        ),
      ),
    /모두 사용/,
  );
});

// 실제 임시 산출물을 복사하고 같은 실행의 두 확장자 및 재빌드 번호를 검사한다.
test('APK·AAB 복사와 새 빌드 번호 예약이 실제 파일에서 동작한다', async () => {
  const { mkdtempSync, readFileSync, writeFileSync, rmSync } =
    await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, basename } = await import('node:path');
  const { exportBuild } =
    await import('../../scripts/export-android-build.mjs');
  const folder = mkdtempSync(join(tmpdir(), 'tripprint-export-'));
  try {
    writeFileSync(join(folder, 'app.apk'), 'apk fixture');
    writeFileSync(join(folder, 'app.aab'), 'aab fixture');
    const apk = exportBuild(
      join(folder, 'app.apk'),
      'run-release',
      join(folder, 'output'),
    );
    const aab = exportBuild(
      join(folder, 'app.aab'),
      'run-release',
      join(folder, 'output'),
    );
    assert.equal(
      basename(apk).replace('.apk', ''),
      basename(aab).replace('.aab', ''),
    );
    assert.equal(readFileSync(apk, 'utf8'), 'apk fixture');
    assert.match(
      exportBuild(
        join(folder, 'app.apk'),
        'next-release',
        join(folder, 'output'),
      ),
      /Ver01.apk$/,
    );
    assert.throws(
      () =>
        exportBuild(
          join(folder, 'app.apk'),
          'run-release',
          join(folder, 'output'),
        ),
      /덮어쓸/,
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
// 파일을 정리해도 예약했던 번호를 새 빌드에 다시 쓰지 않는다.
test('삭제된 산출물의 빌드 번호도 다시 사용하지 않는다', () => {
  assert.equal(
    buildName(
      'TripPrint',
      '261012',
      'new',
      { old: 'TripPrint_261012_Ver00' },
      [],
    ),
    'TripPrint_261012_Ver01',
  );
});
