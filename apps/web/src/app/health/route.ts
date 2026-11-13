export const dynamic = 'force-dynamic';

// 웹 프로세스의 응답만 확인하며 회원·DB·외부 서비스의 준비 상태는 반환하지 않는다.
export function GET() {
  return Response.json(
    { service: 'tripprint-web', status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
