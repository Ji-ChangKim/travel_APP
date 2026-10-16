import CityGuideScreen from '@/features/workspace/CityGuideScreen';
import { discoveryDestinations } from '@wherego/domain';

// 웹에서도 도시 상세 주소를 새로 열거나 새로고침할 수 있게 미리 생성한다.
export function generateStaticParams() {
  // 카탈로그에 등록된 도시만 정적 공개 페이지로 내보낸다.
  return discoveryDestinations.map((city) => {
    // 도시 키 하나를 해당 페이지의 경로 매개변수로 전달한다.
    return { key: city.key };
  });
}

// 도시별 여행 가이드를 독립된 경로에 연결한다.
export default function DestinationDetailPage() {
  // 도시 키 검증과 공개 탐색 동작은 가이드 화면에서 처리한다.
  return <CityGuideScreen />;
}
