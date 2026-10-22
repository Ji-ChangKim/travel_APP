import { sourcePlan } from './plan-source.mjs';

// 공개된 사용자 원문의 DAY 제목과 소개를 그대로 보존한다.
export const initialDays = sourcePlan.days.map((day) => {
  // 디자인 예시 번호와 원본 설명을 함께 읽는다.
  return {
    id: `day-${day.dayNumber}`,
    title: day.planTitle,
    intro: day.planConcept,
  };
});

// 실제 공개된 19개 장소의 원문·선택지를 디자인 데이터에 재사용한다.
export const initialPlaces = sourcePlan.places;
export const trips = [
  {
    id: 'osaka-plan',
    title: sourcePlan.title,
    start: '2026-11-10',
    end: '2026-11-13',
    country: '일본',
    city: '오사카',
  },
  {
    id: 'osaka-record',
    title: '오사카에서 보낸 나흘',
    start: '2026-10-01',
    end: '2026-10-04',
    country: '일본',
    city: '오사카',
  },
  {
    id: 'undated',
    title: '다음 바다 여행',
    start: '',
    end: '',
    country: '일본',
    city: '',
  },
];

// 시작일 당일은 여행 중으로 우선 판정해 예정과 중복되지 않게 한다.
export function tripPhase(trip, today = '2026-10-19') {
  // 예시의 달력 날짜를 고정해 상태·날짜·버튼을 같은 결과로 동기화한다.
  return !trip.start || !trip.end
    ? '준비 중'
    : today > trip.end
      ? '여행 완료'
      : today >= trip.start
        ? '여행 중'
        : (Date.parse(trip.start) - Date.parse(today)) / 86400000 <= 7
          ? '여행 예정'
          : '준비 중';
}

// 고정 검토 데이터와 원본·공개 사본을 브라우저 메모리에서 구분한다.
export const state = {
  role: 'owner',
  screen: 'home',
  tripId: 'osaka-plan',
  day: 1,
  placeId: 'p1',
  large: false,
  long: false,
  width: 390,
  history: [],
  drafts: {},
  days: structuredClone(initialDays),
  places: structuredClone(initialPlaces),
  selected: initialPlaces.map((item) => {
    // 기본 공개 선택은 예시 일정만 사용한다.
    return item.id;
  }),
  selectedPhotos: false,
  includeCosts: false,
  shareKind: 'plan',
  publication: null,
  query: '',
  tripFilter: '전체',
  costMode: '실제 지출',
  country: '일본',
  city: '오사카',
  undated: false,
  checks: ['여권'],
  panel: '일정',
  lastFocus: '',
  publicationWithdrawn: false,
};

// 선택한 여행의 제목·기간을 모든 개인 화면에서 함께 읽는다.
export function currentTrip() {
  // 다른 원본을 열 때도 동일한 여행 ID를 따라간다.
  return (
    trips.find((trip) => {
      // 선택한 원본 한 건만 반환한다.
      return trip.id === state.tripId;
    }) || trips[0]
  );
}

// 날짜별 공개 설명을 같은 원본에서 읽는다.
export function currentDay() {
  // DAY 배열의 물리 순서와 저장 ID를 함께 유지한다.
  return state.days[state.day - 1];
}

// 장소 목록에서 선택한 항목을 읽는다.
export function currentPlace() {
  // 검색 후보와 개인·공개 읽기의 행동은 화면 키로 구분한다.
  return (
    state.places.find((item) => {
      // 같은 이름이라도 다른 ID의 장소와 섞지 않는다.
      return item.id === state.placeId;
    }) || state.places[0]
  );
}

// 공유 미리보기는 선택한 항목과 공개 허용 필드만 투영한다.
export function previewSnapshot() {
  // 비공개 메모·영수증·동행·예약 상세를 사본에 넣지 않는다.
  return {
    title: currentTrip().title,
    tripId: currentTrip().id,
    kind: state.shareKind,
    days: state.days
      .filter((day, index) => {
        // 선택한 일정이 있는 DAY만 공개한다.
        return state.places.some((place) => {
          // 일정 선택 해제가 미리보기에서 즉시 빠진다.
          return state.selected.includes(place.id) && place.day === index + 1;
        });
      })
      .map((day) => {
        // 원본 객체 참조를 공유하지 않아 게시 뒤 편집을 자동 반영하지 않는다.
        return { id: day.id, title: day.title, intro: day.intro };
      }),
    places: state.places
      .filter((place) => {
        // 선택한 일정만 사본으로 읽는다.
        return state.selected.includes(place.id);
      })
      .map(
        ({
          id,
          day,
          name,
          area,
          time,
          description,
          tip,
          choiceGroup,
          choiceKind,
          choiceLabel,
        }) => {
          // 공개 허용 필드만 명시해 개인 메모가 유입되지 않게 한다.
          return {
            id,
            day,
            name,
            area,
            time,
            description,
            tip,
            choiceGroup,
            choiceKind,
            choiceLabel,
          };
        },
      ),
    photos: state.selectedPhotos ? ['osaka-cover'] : [],
    costs: state.includeCosts ? [{ currency: 'JPY', amount: '2400' }] : [],
  };
}

// 공개 읽기는 저장한 사본을 우선하고 미리보기만 최신 선택을 읽는다.
export function publicSnapshot() {
  // 시안에서도 원본 변경과 공개 사본 갱신을 분리한다.
  return state.screen === 'preview' ||
    state.screen === 'publishConfirm' ||
    (['publicPlace', 'photoSource'].includes(state.screen) &&
      state.publicContext === 'preview')
    ? previewSnapshot()
    : state.publicationWithdrawn
      ? {
          title: '공개 여행',
          kind: 'plan',
          days: [],
          places: [],
          photos: [],
          costs: [],
        }
      : state.publication || previewSnapshot();
}
