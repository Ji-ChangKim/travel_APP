import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Cloudflare Workers 환경에서 실행되는 Hono 애플리케이션 인스턴스를 생성한다.
const app = new Hono();

// CORS 미들웨어를 설정한다.
app.use('/*', cors());

// 서버 상태 확인용 헬스체크 엔드포인트를 제공한다.
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 외부 장소 검색 API를 대행 호출하는 엔드포인트를 정의한다.
app.get('/api/places/search', async (c) => {
  const query = c.req.query('q') || '';
  return c.json({
    query,
    results: [
      {
        name: `${query} 명소`,
        address: `대한민국 ${query} 중심가`,
        latitude: 37.5665,
        longitude: 126.978,
        category: 'sightseeing',
      },
    ],
  });
});

// 여행 공유를 위한 고유 난수 토큰 링크를 발급하는 엔드포인트를 정의한다.
app.post('/api/share/link', async (c) => {
  const body = await c.req.json<{ tripId: string }>();
  const token = `share_${Math.random().toString(36).substring(2, 10)}`;
  return c.json({
    tripId: body.tripId,
    token,
    shareUrl: `https://wherego.app/share/${token}`,
  });
});

// 영수증 이미지 분석 및 OCR 텍스트 추출 스텁 엔드포인트를 정의한다.
app.post('/api/receipt/ocr', async (c) => {
  return c.json({
    merchantName: '현지 식당',
    transactionDate: new Date().toISOString().slice(0, 10),
    totalAmount: 32000,
    extractedItems: ['메인 요리', '음료'],
  });
});

export default app;
