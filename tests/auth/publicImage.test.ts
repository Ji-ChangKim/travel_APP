import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { publicImage } from '../../apps/api/src/publicImage';

const jpeg = readFileSync(
  new URL('../../apps/mobile/assets/destinations/osaka.jpg', import.meta.url),
);

// 소유한 검수 이미지에만 개인정보 표식의 JPEG 세그먼트를 붙인다.
function segment(marker: number, payload: Uint8Array): Buffer {
  // 픽셀 압축 데이터는 수정하지 않고 메타정보 경계만 만든다.
  const header = Buffer.from([255, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

// 개인정보 없는 방향 TIFF를 검수 표식과 함께 구성한다.
function orientationExif(orientation: number): Buffer {
  // GPS 원문은 제거되고 방향만 남는지 확인할 입력이다.
  return Buffer.from([
    73,
    73,
    42,
    0,
    8,
    0,
    0,
    0,
    1,
    0,
    18,
    1,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

test('공개 JPEG은 EXIF·XMP·IPTC·주석·마지막 스캔 이후 메타정보를 지우고 방향을 보존한다', () => {
  // 실제 앱 JPEG 자산의 압축 픽셀을 재인코딩하지 않는지 대조한다.
  const baseline = Buffer.from(publicImage(jpeg));
  for (let orientation = 1; orientation <= 8; orientation++) {
    const minimal = segment(
      225,
      Buffer.concat([Buffer.from('Exif\0\0'), orientationExif(orientation)]),
    );
    const privateExif = segment(
      225,
      Buffer.concat([
        Buffer.from('Exif\0\0'),
        orientationExif(orientation),
        Buffer.from('GPS_PRIVATE_OWNER'),
      ]),
    );
    const source = Buffer.concat([
      jpeg.subarray(0, 2),
      privateExif,
      segment(225, Buffer.from('XMP_PRIVATE_OWNER')),
      segment(237, Buffer.from('IPTC_PRIVATE_OWNER')),
      jpeg.subarray(2, -2),
      segment(254, Buffer.from('COMMENT_PRIVATE_OWNER')),
      jpeg.subarray(-2),
    ]);
    const result = Buffer.from(publicImage(source));
    assert.equal(result.includes(Buffer.from('PRIVATE_OWNER')), false);
    assert.deepEqual(
      result,
      Buffer.concat([baseline.subarray(0, 2), minimal, baseline.subarray(2)]),
    );
    assert.deepEqual(Buffer.from(publicImage(result)), result);
  }
});

test('기존 8개 JPEG 자산의 공개 변환은 정상 형식을 유지하고 반복해도 같은 결과다', () => {
  // 출처 이미지나 색상 데이터를 임의의 더미로 바꾸지 않는다.
  for (const city of [
    'osaka',
    'tokyo',
    'nagoya',
    'taipei',
    'singapore',
    'shanghai',
    'danang',
    'bangkok',
  ]) {
    const image = readFileSync(
      new URL(
        `../../apps/mobile/assets/destinations/${city}.jpg`,
        import.meta.url,
      ),
    );
    const result = Buffer.from(publicImage(image));
    assert.equal(result[0], 255);
    assert.equal(result[1], 216);
    assert.deepEqual([...result.subarray(-2)], [255, 217]);
    assert.deepEqual(Buffer.from(publicImage(result)), result);
    assert.ok(result.length <= image.length);
  }
});

test('잘린 이미지·잘못된 청크 길이·4MiB 초과는 공개 변환 전에 거부한다', () => {
  // 손상 데이터를 성공 이미지나 오류 원문으로 공개하지 않는다.
  for (const image of [
    new Uint8Array(),
    new Uint8Array(4194305),
    new Uint8Array([255, 216, 255, 225, 255, 255]),
    new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 255, 255, 255, 255, 73, 72, 68, 82, 0, 0,
      0, 0,
    ]),
  ])
    assert.throws(() => publicImage(image));
});
