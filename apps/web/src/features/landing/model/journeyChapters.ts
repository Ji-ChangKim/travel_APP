export const journeyChapters = [
  {
    id: 'before',
    number: '01',
    label: '떠나기 전',
    title: '가고 싶은 곳이,\n나만의 여정이 되도록.',
    description:
      '눈여겨본 장소를 모으고 하루의 흐름을 그려요. 여행을 기다리는 시간부터 이야기가 시작돼요.',
    note: '아침의 산책부터 저녁의 풍경까지',
    image: 'osaka',
    location: 'OSAKA · 오사카',
    caption: '다음에 걷고 싶은 길',
  },
  {
    id: 'during',
    number: '02',
    label: '여행하는 동안',
    title: '계획에 없던 순간도,\n여행의 한 장면으로.',
    description:
      '발길이 닿은 곳, 우연히 발견한 풍경. 계획과 실제로 머문 순간을 구분해 남기는 여행을 그려요.',
    note: '예상 밖의 순간을 위한 빈 페이지',
    image: 'danang',
    location: 'DA NANG · 다낭',
    caption: '잠깐 멈춰 바라본 풍경',
  },
  {
    id: 'after',
    number: '03',
    label: '돌아온 뒤',
    title: '다시 펼쳐 보면,\n그날의 여행이 가까이.',
    description:
      '사진 한 장과 장소, 맛있었던 한 끼를 함께 꺼내 봐요. 남기고 싶은 이야기만 골라 나눠요.',
    note: '여행의 끝에서 시작되는 이야기',
    image: 'tokyo',
    location: 'TOKYO · 도쿄',
    caption: '기억해 두고 싶은 도시',
  },
] as const;
