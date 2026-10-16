// 정확한 이름의 승인 로컬 영상만 빌드에 포함하며 누락해도 Metro 빌드를 막지 않는다.
const videos = require.context(
  '../../../assets/brand/tripprint-v1',
  false,
  /^\.\/tripprint_bi\.mp4$/,
);

// 앱 시작 중 파일 탐색·원격 다운로드 없이 포함 여부만 읽는다.
export const bundledBiVideo: number | null = videos
  .keys()
  .includes('./tripprint_bi.mp4')
  ? videos<number>('./tripprint_bi.mp4')
  : null;
