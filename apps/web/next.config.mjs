import repositoryPaths from '../../scripts/shared/repository-paths.cjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // 공통 패키지를 같은 저장소에서 읽으며 앱별 잠금 파일은 만들지 않는다.
  outputFileTracingRoot: repositoryPaths.repositoryRoot,
  turbopack: { root: repositoryPaths.repositoryRoot },
};

export default nextConfig;
