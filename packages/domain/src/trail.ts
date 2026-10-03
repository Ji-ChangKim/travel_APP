// 영수증으로 계획을 구체화하는 기기 저장 콘텐츠 모델을 정의한다.
export interface TrailFlight {
  id: string;
  direction: 'outbound' | 'return';
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  arrivalAt: string;
  source: 'user-confirmed';
}

// 장소를 정한 계획과 실제 결제 기록을 ID로 연결한다.
export interface TrailPlan {
  id: string;
  date: string;
  time: string;
  title: string;
  address: string;
  memo: string;
}

// 원본 첨부와 사용자가 확인한 구매 상세를 보존한다.
export interface TrailReceipt {
  id: string;
  planId: string;
  merchant: string;
  date: string;
  time: string;
  amount: string;
  currency: 'KRW' | 'JPY' | 'USD';
  details: string;
  note: string;
  attachment: { name: string; uri: string; mimeType: string };
  createdAt: string;
}

// 항공 기준·일정·영수증을 하나의 콘텐츠로 묶는다.
export interface TrailJourney {
  id: string;
  sourceTripId?: string;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  flights: TrailFlight[];
  plans: TrailPlan[];
  receipts: TrailReceipt[];
}
