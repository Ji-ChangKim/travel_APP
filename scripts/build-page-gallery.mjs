import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const output = resolve('outputs/TripPrint-pages');
const manifest = JSON.parse(
  readFileSync(join(output, 'manifest.json'), 'utf8'),
);

// 미리보기에서도 서비스의 다음 행동만 안내한다.
const screenCopy = {
  'receipt-capture': [
    '영수증 한 장으로 기록해요',
    '촬영 방법을 확인하고 카메라 또는 앨범으로 영수증을 가져오세요.',
  ],
  'receipt-confirm': [
    '영수증 정보가 맞나요?',
    '장소·결제 일시·메뉴·금액을 확인하고, 틀린 내용만 수정하세요.',
  ],
  'receipt-photo-choice': [
    '사진도 함께 보관할까요?',
    '사진도 보관하거나 정보만 저장할 수 있어요. 커뮤니티에는 원본을 공개하지 않아요.',
  ],
  'receipt-info-only': [
    '정보만 남긴 여행 기록',
    '원본 사진 없이도 장소·메뉴·결제 일시·실제 지출을 다시 볼 수 있어요.',
  ],
  'first-visit-home': [
    '어디로 떠나볼까요?',
    '가고 싶은 도시를 고르고 나만의 여행을 시작해 보세요.',
  ],
  login: [
    '여행을 이어가기',
    '로그인하고 여행을 저장하세요. 친구와 함께 계획할 수 있어요.',
  ],
  'email-login': ['이메일로 로그인', '나의 여행을 이어서 계획하고 기록하세요.'],
  signup: ['TripPrint 시작하기', '함께 세운 계획이 나만의 발자국이 됩니다.'],
  'my-trips': ['내 여행', '다가오는 여행을 준비하고 다녀온 여행을 돌아보세요.'],
  loading: [
    '여행을 불러오는 중',
    '잠시만 기다려 주세요. 나의 여행을 열고 있어요.',
  ],
  'haru-loading': [
    '하루와 여행을 여는 중',
    '여행을 이어갈 수 있도록 잠시 기다려 주세요.',
  ],
  'new-trip': [
    '새 여행 시작하기',
    '여행 이름과 목적지를 정하고 첫 일정을 만들어 보세요.',
  ],
  'new-trip-dates': [
    '언제 떠나볼까요?',
    '여행 날짜와 항공편을 한곳에 모아두세요.',
  ],
  'trip-detail': [
    '날짜별 여행 일정',
    '오늘의 장소와 이동, 먹고 싶은 메뉴를 함께 살펴보세요.',
  ],
  'schedule-editor': [
    '가고 싶은 장소 추가',
    '장소를 찾아 일정에 넣거나 Google Maps의 공유 링크를 가져오세요.',
  ],
  'expense-editor': [
    '여행 비용 남기기',
    '언제 어디에서 썼는지 남기고 여행 비용을 확인하세요.',
  ],
  'trip-status': [
    '여행 정보',
    '계획한 여행을 확인하고 다녀온 순간을 발자국으로 남기세요.',
  ],
  'trip-period': [
    '여행 날짜 바꾸기',
    '변경된 날짜에 맞춰 여행을 다시 계획해 보세요.',
  ],
  'trip-costs': [
    '여행 비용 한눈에',
    '예상 비용과 실제로 쓴 금액을 통화별로 살펴보세요.',
  ],
  'trip-media': [
    '사진과 영수증',
    '여행의 사진과 결제 내역을 날짜별로 모아보세요.',
  ],
  'receipt-scan-error': [
    '영수증을 다시 읽어볼까요?',
    '다시 스캔하거나 글자가 선명한 사진을 선택해 주세요.',
  ],
  'trip-checklist': [
    '떠나기 전 준비물',
    '챙긴 물건은 체크하고 남은 준비물을 확인하세요.',
  ],
  'trip-companions': [
    '친구와 함께하는 여행',
    '친구를 초대하고 함께 일정을 준비하세요.',
  ],
  'publish-editor': [
    '여행 이야기 공유',
    '나누고 싶은 일정과 사진, 비용을 골라 발자국을 공개하세요.',
  ],
  footprints: [
    '나의 발자국',
    '다녀온 여행을 모아 나만의 이야기를 완성해 보세요.',
  ],
  diary: [
    '여행 다이어리',
    '날짜별 장소와 메뉴, 사진과 비용으로 여행을 돌아보세요.',
  ],
  community: [
    '다른 여행자의 발자국',
    '먼저 다녀온 여행자의 기록에서 다음 여행의 힌트를 찾아보세요.',
  ],
  'community-report': [
    '게시글 신고',
    '불편한 게시글의 신고 이유를 알려주세요.',
  ],
  'my-profile': ['마이페이지', '나의 프로필과 여행 기록을 살펴보세요.'],
  'profile-editor': [
    '나를 소개하기',
    '닉네임과 소개를 바꾸고 여행 취향을 알려주세요.',
  ],
  invite: ['함께 떠나볼까요?', '친구가 보낸 링크로 여행에 참여해 보세요.'],
  'maps-import': [
    '저장한 장소 가져오기',
    'Google Maps에서 공유한 장소를 내 여행 일정에 담으세요.',
  ],
  'local-records': [
    '이전에 남긴 여행',
    '이 기기에 남겨둔 여행을 다시 살펴보세요.',
  ],
  'haru-error': [
    '하루와 다시 찾아보기',
    '불러오지 못한 여행을 다시 확인해 보세요.',
  ],
  'haru-empty': [
    '첫 발자국을 남겨볼까요?',
    '가고 싶은 곳부터 정하고 나만의 여행을 시작해 보세요.',
  ],
  'haru-not-found': [
    '여행길로 돌아가기',
    '하루와 함께 홈으로 돌아가 여행을 이어가세요.',
  ],
  'auth-callback': [
    '로그인 다시하기',
    '로그인 화면으로 돌아가 이메일로 여행을 이어가세요.',
  ],
  'receipt-loading': [
    '하루가 영수증을 읽고 있어요',
    '사진 속 장소와 메뉴, 날짜와 금액을 찾고 있어요.',
  ],
  'receipt-editor': [
    '영수증에서 찾은 여행',
    '사진에서 읽은 장소와 날짜, 메뉴와 금액을 확인해 주세요.',
  ],
  'receipt-items': [
    '어떤 메뉴를 먹었나요?',
    '영수증에서 읽은 메뉴와 가격을 확인하고 바꿀 수 있어요.',
  ],
  'receipt-registered': [
    '여행에 남겼어요',
    '방문한 장소와 결제 내역이 해당 날짜의 기록에 담겼어요.',
  ],
  'receipt-saved': [
    '사진과 함께 남긴 기록',
    '영수증 사진과 주소, 메뉴를 함께 살펴보세요.',
  ],
  'receipt-cost': [
    '영수증으로 남긴 지출',
    '여행에서 실제로 쓴 금액을 확인하세요.',
  ],
};
function copy(item, index) {
  // 구현 상태나 내부 경로 대신 화면에 맞는 고객 안내를 선택한다.
  return (
    screenCopy[item.key]?.[index] ||
    (index === 0 ? item.title : '나의 여행을 이어서 살펴보세요.')
  );
}
function escape(value) {
  // 화면 설명을 HTML 문자로만 표시한다.
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
function card(item, index) {
  // 실제 캡처 한 장을 이름·경로·설명과 함께 표시한다.
  return `<article><div class="card-head"><span class="number">${String(index + 1).padStart(2, '0')}</span><h2>${escape(copy(item, 0))}</h2></div><a href="#${item.key}" aria-label="${escape(copy(item, 0))} 확대"><img src="${item.file}" alt="${escape(copy(item, 0))} 실제 화면" loading="lazy"></a><div class="card-foot"><p>${escape(copy(item, 1))}</p></div></article>`;
}
function lightbox(item) {
  // 서버 호출 없이 원본 캡처를 크게 확인하는 확대 보기를 제공한다.
  return `<div class="lightbox" id="${item.key}"><a class="backdrop" href="#screens" aria-label="확대 닫기"></a><div class="expanded"><header><b>${escape(copy(item, 0))}</b><a href="#screens">닫기 ✕</a></header><img src="${item.file}" alt="${escape(copy(item, 0))} 확대 화면"></div></div>`;
}
function html(items, overview = false) {
  // 제품을 바꾸지 않고 현재 구현 화면을 비교하는 정적 갤러리를 생성한다.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TripPrint · 전체 페이지 미리보기</title><style>
*{box-sizing:border-box}body{margin:0;background:#FFF9F3;color:#203247;font-family:"Malgun Gothic",sans-serif}main{max-width:1400px;margin:auto;padding:48px 36px}.brand{font-weight:900;font-size:30px;letter-spacing:-1px}.brand span{color:#FF6B57}.eyebrow{font-size:12px;letter-spacing:2px;margin-top:32px;color:#C84432;font-weight:700}h1{font-size:34px;margin:12px 0 16px;letter-spacing:-1.5px}.lead{font-size:15px;line-height:1.8;color:#677584;max-width:850px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 34px}.chips span{border:1px solid #E8DDD3;border-radius:30px;padding:8px 14px;font-size:12px;background:#fff}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}article{background:#fff;border:1px solid #E8DDD3;border-radius:18px;overflow:hidden;box-shadow:0 5px 16px #20324706}.card-head{display:flex;gap:10px;align-items:center;padding:18px 14px;border-bottom:1px solid #F0E8E0}h2{font-size:14px;margin:0}.number{font-size:12px;color:#C84432;font-weight:700}article img{width:100%;height:auto;display:block}article>a{display:block;padding:12px;background:#F7F0E9}.card-foot{padding:14px;min-height:85px}code{font-size:10px;word-break:break-all;color:#9B604F}.card-foot p{font-size:11px;line-height:1.6;color:#768390;margin:8px 0 0}.footer{font-size:12px;line-height:1.9;color:#768390;margin-top:36px}.lightbox{display:none;position:fixed;inset:0;z-index:20;align-items:center;justify-content:center}.lightbox:target{display:flex}.backdrop{position:absolute;inset:0;background:#142232dd}.expanded{position:relative;background:white;border-radius:16px;padding:14px;max-height:95vh;overflow:auto}.expanded header{display:flex;gap:24px;justify-content:space-between;font-size:13px;margin:4px 0 14px}.expanded header a{color:#C84432}.expanded img{width:min(390px,80vw);display:block}a{color:inherit}.overview main{padding:36px}.overview .grid{gap:18px}.overview .card-foot{min-height:63px}.overview article>a{padding:8px}.overview h1{font-size:30px}.overview .chips{margin-bottom:28px}@media(max-width:950px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){main{padding:28px 18px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}h1{font-size:27px}.card-head{padding:12px 10px}h2{font-size:12px}}@media(max-width:420px){.grid{grid-template-columns:1fr}}
</style></head><body class="${overview ? 'overview' : ''}"><main><div class="brand">Trip<span>Print</span></div><div class="eyebrow">LEAVE YOUR TRIPPRINT</div><h1>${overview ? '여행의 모든 순간을 TripPrint에' : 'TripPrint 화면 둘러보기'}</h1><p class="lead">여행 계획부터 사진과 비용 기록, 발자국 공유까지. 화면을 눌러 자세히 살펴보세요.</p><div class="chips"><span>여행 계획</span><span>친구와 함께</span><span>사진·영수증</span><span>발자국 공유</span></div><div class="grid" id="screens">${items.map(card).join('')}</div><p class="footer">가고 싶은 곳을 계획하고, 다녀온 순간을 기록하세요. 나만의 발자국이 다음 여행의 길잡이가 됩니다.</p></main>${items.map(lightbox).join('')}</body></html>`;
}
const overviewKeys = [
  'first-visit-home',
  'login',
  'my-trips',
  'new-trip',
  'trip-detail',
  'footprints',
  'diary',
  'community',
  'my-profile',
  'invite',
  'maps-import',
  'local-records',
];
const overviewShots = overviewKeys.map((key) => {
  // 모든 주요 사용자 페이지가 한 장의 개요에 포함되어야 한다.
  return manifest.shots.find((item) => item.key === key);
});
if (
  !manifest.completed ||
  manifest.errors.length ||
  overviewShots.some((item) => {
    // 캡처 누락이나 화면 오류가 있는 갤러리를 완료 처리하지 않는다.
    return !item;
  })
)
  throw new Error('갤러리 캡처 누락 또는 실행 오류');
writeFileSync(join(output, 'index.html'), html(manifest.shots));
writeFileSync(join(output, 'overview.html'), html(overviewShots, true));
console.info(
  `주요 페이지 12종 및 전체 화면 ${manifest.shots.length}개 갤러리 생성`,
);

// 영수증 촬영부터 정보 확인과 저장 결과까지 한곳에서 살펴본다.
writeFileSync(
  join(output, 'receipt.html'),
  html(
    [
      'receipt-capture',
      'receipt-loading',
      'receipt-editor',
      'receipt-items',
      'receipt-confirm',
      'receipt-photo-choice',
      'receipt-registered',
      'receipt-info-only',
      'receipt-saved',
      'receipt-cost',
    ].map((key) => {
      // 촬영·두 가지 확인 질문·보관 선택별 결과를 사용자 순서로 정렬한다.
      return manifest.shots.find((item) => {
        // 해당 단계의 실제 앱 캡처 한 장을 선택한다.
        return item.key === key;
      });
    }),
  ).replaceAll('TripPrint 화면 둘러보기', '영수증 한 장으로 남기는 여행'),
);

// 하루 상태 화면만 별도의 비교 페이지로 제공한다.
writeFileSync(
  join(output, 'haru.html'),
  html(
    manifest.shots.filter((item) => {
      // 주요 세 포즈가 보이는 실제 앱 화면만 선택한다.
      return ['haru-loading', 'haru-error', 'haru-empty'].includes(item.key);
    }),
  )
    .replace('TripPrint 화면 둘러보기', '하루와 함께하는 TripPrint')
    .replace('LEAVE YOUR TRIPPRINT', 'HARU · YOUR TRAVEL COMPANION')
    .replace('.grid{display:grid;', '.grid{display:grid;')
    .replace('repeat(4,minmax(0,1fr))', 'repeat(3,minmax(0,1fr))'),
);
