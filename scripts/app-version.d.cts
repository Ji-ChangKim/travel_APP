// Expo 빌드 설정에서만 사용하는 버전 파일의 반환 계약을 정의한다.
export function readAppVersion(path?: string): {
  versionCode: number;
  versionName: string;
};

// 테스트에서도 빌드와 같은 파일 형식 검증을 사용한다.
export function parseAppVersion(text: string): {
  versionCode: number;
  versionName: string;
};
