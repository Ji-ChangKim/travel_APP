import type { QueryClient } from '@tanstack/react-query';

// 계정이 바뀌면 개인 조회만 비우고 이미 성공한 기기·앱 점검은 유지한다.
export function clearAccountQueries(client: QueryClient): void {
  client.removeQueries({
    predicate: (query) =>
      !(
        query.queryKey[0] === 'startup' &&
        ['local', 'common', 'play', 'policy'].includes(
          String(query.queryKey[1]),
        )
      ),
  });
}
