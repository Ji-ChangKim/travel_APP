import { rejectRequest } from './errors';

const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
const pngRenderingChunks = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'iCCP',
  'sBIT',
  'bKGD',
  'acTL',
  'fcTL',
  'fdAT',
]);

// 공개할 이미지에서 픽셀·색상·방향 외의 메타정보를 제거한다.
export function publicImage(bytes: Uint8Array): Uint8Array {
  // 지원 형식과 상한을 다시 검사해 기존 저장 파일에도 같은 정책을 적용한다.
  return !bytes.length || bytes.length > 4194304
    ? rejectRequest('PAYLOAD_TOO_LARGE')
    : pngHeader.every((byte, index) => {
          // PNG 전체 시그니처를 대조한다.
          return bytes[index] === byte;
        })
      ? publicPng(bytes)
      : bytes[0] === 255 && bytes[1] === 216
        ? publicJpeg(bytes)
        : rejectRequest('VALIDATION_FAILED');
}

// PNG의 렌더링 청크만 남기고 텍스트·EXIF·알 수 없는 부가 정보를 버린다.
function publicPng(bytes: Uint8Array): Uint8Array {
  // 압축 픽셀은 해제하거나 재인코딩하지 않아 이미지 품질과 메모리 사용을 유지한다.
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let header = false;
  let pixels = false;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset);
    const end = offset + size + 12;
    if (end > bytes.length) return rejectRequest('VALIDATION_FAILED');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!header && (type !== 'IHDR' || size !== 13))
      return rejectRequest('VALIDATION_FAILED');
    header = true;
    pixels ||= type === 'IDAT';
    if (pngRenderingChunks.has(type)) parts.push(bytes.subarray(offset, end));
    if (type === 'eXIf') {
      const orientation = exifOrientation(bytes.subarray(offset + 8, end - 4));
      if (orientation) parts.push(orientationChunk(orientation));
    }
    if (type === 'IEND')
      return pixels && size === 0
        ? concatenate(parts)
        : rejectRequest('VALIDATION_FAILED');
    offset = end;
  }
  return rejectRequest('VALIDATION_FAILED');
}

// JPEG 부가 세그먼트를 제거하고 여러 스캔 사이의 메타정보도 검사한다.
function publicJpeg(bytes: Uint8Array): Uint8Array {
  // JPEG 픽셀과 ICC·Adobe 색상 세그먼트 및 필요한 방향 값만 보존한다.
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    const start = offset;
    if (bytes[offset++] !== 255) return rejectRequest('VALIDATION_FAILED');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217)
      return concatenate([...parts, bytes.subarray(start, offset)]);
    if (marker === undefined || marker === 0 || marker === 216)
      return rejectRequest('VALIDATION_FAILED');
    if (offset + 2 > bytes.length) return rejectRequest('VALIDATION_FAILED');
    const size = bytes[offset]! * 256 + bytes[offset + 1]!;
    const end = offset + size;
    if (size < 2 || end > bytes.length)
      return rejectRequest('VALIDATION_FAILED');
    const payload = bytes.subarray(offset + 2, end);
    if (marker === 225 && startsWith(payload, 'Exif\0\0')) {
      const orientation = exifOrientation(payload.subarray(6));
      if (orientation)
        parts.push(
          concatenate([
            new Uint8Array([255, 225, 0, 34]),
            new TextEncoder().encode('Exif\0\0'),
            orientationTiff(orientation),
          ]),
        );
    } else if (
      marker < 224 ||
      (marker === 224 && startsWith(payload, 'JFIF\0')) ||
      (marker === 226 && startsWith(payload, 'ICC_PROFILE\0')) ||
      (marker === 238 && startsWith(payload, 'Adobe'))
    )
      parts.push(bytes.subarray(start, end));
    offset = end;
    if (marker === 218) {
      const scanEnd = jpegScanEnd(bytes, offset);
      parts.push(bytes.subarray(offset, scanEnd));
      offset = scanEnd;
    }
  }
  return rejectRequest('VALIDATION_FAILED');
}

// JPEG 압축 스트림에서 바이트 스터핑과 재시작 표식을 건너뛴다.
function jpegScanEnd(bytes: Uint8Array, start: number): number {
  // 스캔 이후 APP/COM 세그먼트를 그대로 공개하는 우회를 막는다.
  for (let offset = start; offset < bytes.length - 1; offset++) {
    if (bytes[offset] !== 255) continue;
    const next = bytes[offset + 1]!;
    if (next === 0 || (next >= 208 && next <= 215)) {
      offset++;
      continue;
    }
    if (next !== 255) return offset;
  }
  return bytes.length;
}

// EXIF에서 방향 태그만 읽고 주소·GPS·촬영자 포인터는 따라가지 않는다.
function exifOrientation(bytes: Uint8Array): number | undefined {
  // TIFF의 길이와 형식을 확인한 뒤 최대 한 디렉터리만 검사한다.
  if (bytes.length < 8) return undefined;
  const little = bytes[0] === 73 && bytes[1] === 73;
  if (!little && !(bytes[0] === 77 && bytes[1] === 77)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(2, little) !== 42) return undefined;
  const offset = view.getUint32(4, little);
  if (offset < 8 || offset + 2 > bytes.length) return undefined;
  const count = view.getUint16(offset, little);
  for (
    let entry = offset + 2;
    entry + 12 <= bytes.length && entry < offset + 2 + count * 12;
    entry += 12
  ) {
    if (
      view.getUint16(entry, little) !== 274 ||
      view.getUint16(entry + 2, little) !== 3 ||
      view.getUint32(entry + 4, little) !== 1
    )
      continue;
    const orientation = view.getUint16(entry + 8, little);
    return orientation >= 1 && orientation <= 8 ? orientation : undefined;
  }
  return undefined;
}

// 개인정보가 없는 방향 태그 하나의 TIFF 디렉터리를 만든다.
function orientationTiff(orientation: number): Uint8Array {
  // 원본 EXIF를 복사하지 않고 허용한 SHORT 태그만 새로 기록한다.
  return new Uint8Array([
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

// PNG 방향 청크에 표준 체크섬을 붙인다.
function orientationChunk(orientation: number): Uint8Array {
  // PNG의 eXIf에도 방향 외 개인정보가 섞이지 않게 한다.
  const body = concatenate([
    new TextEncoder().encode('eXIf'),
    orientationTiff(orientation),
  ]);
  const result = new Uint8Array(body.length + 8);
  result.set(body, 4);
  const view = new DataView(result.buffer);
  view.setUint32(0, body.length - 4);
  view.setUint32(result.length - 4, crc32(body));
  return result;
}

// PNG 청크의 CRC32를 계산한다.
function crc32(bytes: Uint8Array): number {
  // 방향 청크만 새로 만들며 원본 픽셀 청크는 변경하지 않는다.
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// 세그먼트 식별자를 바이트로 대조한다.
function startsWith(bytes: Uint8Array, text: string): boolean {
  // 임의 문자열을 HTML이나 외부 주소로 해석하지 않는다.
  return [...text].every((char, index) => {
    // ASCII 시그니처만 비교한다.
    return bytes[index] === char.charCodeAt(0);
  });
}

// 허용한 세그먼트들을 상한 내 한 버퍼로 결합한다.
function concatenate(parts: Uint8Array[]): Uint8Array {
  // 픽셀의 값과 순서를 유지하고 공개할 바이트만 복사한다.
  const result = new Uint8Array(
    parts.reduce((sum, part) => {
      // 검증된 부분의 길이만 합산한다.
      return sum + part.length;
    }, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
