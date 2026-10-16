import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareImageBytes } from '../../apps/mobile/src/features/workspace/imagePreparation';

test('8MiB PNG는 원본 전체 버퍼 없이 헤더 검사 후 압축한다', async () => {
  // 원본 arrayBuffer 읽기를 실패시켜 압축 이전의 전체 복사를 검출한다.
  const original = new Blob([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    new Uint8Array(8 * 1024 * 1024),
  ]);
  const compressed = new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer;
  original.arrayBuffer = () => {
    // 큰 원본의 전체 복사는 검사 실패다.
    throw new Error('원본 전체 버퍼 생성');
  };
  assert.equal(
    await prepareImageBytes(original, () => {
      // 네이티브 변환기가 반환한 작은 JPG 바이트를 사용한다.
      return Promise.resolve(compressed);
    }),
    compressed,
  );
});

test('지원하지 않는 큰 파일은 압축기를 실행하지 않는다', async () => {
  // MIME 이름을 바꾼 문서를 이미지 처리기로 전달하지 않는다.
  await assert.rejects(
    prepareImageBytes(
      new Blob(['not-an-image', new Uint8Array(5 * 1024 * 1024)]),
      () => {
        // 잘못된 헤더가 압축 호출까지 진행하면 실패다.
        return Promise.reject(new Error('압축 호출됨'));
      },
    ),
    /JPG 또는 PNG/,
  );
});

test('작은 실제 PNG는 변환 없이 원본 바이트를 유지한다', async () => {
  // 작은 사진에 불필요한 품질 손실과 렌더 메모리를 만들지 않는다.
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  assert.deepEqual(
    new Uint8Array(
      await prepareImageBytes(new Blob([bytes]), () => {
        // 4MiB 이하 사진에서 압축이 실행되면 실패다.
        return Promise.reject(new Error('불필요한 압축'));
      }),
    ),
    bytes,
  );
});
