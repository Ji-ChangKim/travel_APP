import { UserFacingError } from '@/services/userFacingError';
// 파일 이름이나 MIME 대신 실제 JPG/PNG 헤더를 확인한다.
export function imageMime(buffer: ArrayBuffer): 'image/jpeg' | 'image/png' {
  // 전체 원본을 읽지 않고 네 바이트 헤더만으로 지원 형식을 판별한다.
  const bytes = new Uint8Array(buffer);
  // 확장자를 바꾼 다른 형식을 이미지 압축기로 전달하지 않는다.
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ? 'image/jpeg'
    : bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      ? 'image/png'
      : (() => {
          // 지원하지 않는 파일도 다시 선택할 수 있는 안내를 제공한다.
          throw new UserFacingError('JPG 또는 PNG 사진을 선택해 주세요.');
        })();
}

// 큰 원본은 JS 전체 버퍼를 만들기 전에 이미지 처리기로 보낸다.
export function prepareImageBytes(
  source: Blob,
  compress: () => Promise<ArrayBuffer>,
  header: () => Promise<ArrayBuffer> = () => {
    // 브라우저 Blob의 slice는 전체 원본을 ArrayBuffer로 복사하지 않는다.
    return source.slice(0, 4).arrayBuffer();
  },
): Promise<ArrayBuffer> {
  // 원본 크기와 시그니처만 확인한 뒤 작은 파일 또는 압축 결과만 읽는다.
  return header().then((header) => {
    // 원본이 문서일 때는 이미지 변환을 시작하지 않는다.
    return imageMime(header) && source.size > 4194304
      ? compress()
      : source.arrayBuffer();
  });
}
