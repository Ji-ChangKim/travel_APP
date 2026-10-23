import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDiscovery } from '../../apps/api/src/features/discovery/discovery';

// 공개 공급자에 실제 읽기 요청만 보내고 결과를 로컬 증거로 남긴다.
function verifyDiscovery(): Promise<void> {
  // 테스트용 통계를 실제 응답으로 위장하지 않는다.
  return fetchDiscovery(fetch).then((data) => {
    // 비밀이나 사용자 정보가 없는 공개 응답만 저장한다.
    return mkdir('.release', { recursive: true })
      .then(() => {
        // 실제 조회 시각과 도시별 통계·라이선스를 재확인할 수 있게 한다.
        return writeFile(
          '.release/discovery-live.json',
          JSON.stringify(data, null, 2),
        );
      })
      .then(() => {
        // 긴 원문 대신 연결 여부와 데이터 범위만 출력한다.
        return console.log(
          JSON.stringify({
            period: data.period,
            cities: data.cities.length,
            photos: data.cities.filter((city) => {
              // 저작자·라이선스를 확인한 사진만 집계한다.
              return Boolean(city.image);
            }).length,
            statisticsAvailable: data.statisticsAvailable,
            mostRead: data.mostRead,
            rising: data.rising,
          }),
        );
      });
  });
}

// 원격 DB나 앱 배포는 실행하지 않는다.
verifyDiscovery().catch(() => {
  // 공급자 오류 본문 대신 재실행 가능한 실패만 표시한다.
  return (console.error('공개 여행지 API 검증 실패'), (process.exitCode = 1));
});
