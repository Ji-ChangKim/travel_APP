// 여행 만들기(1.a~1.c)와 여행 일정·가계부(2.a~2.b.ii)의 사용자 전환·행동 지표를 수집한다.
export type WorkspaceAnalyticsEventName =
  | 'trip_create_hub_view'
  | 'trip_create_recommended_click'
  | 'trip_create_constraint_popup_shown'
  | 'trip_create_completed'
  | 'destination_search_query'
  | 'destination_country_filter_select'
  | 'destination_direct_input_used'
  | 'period_mode_selected'
  | 'period_duration_distribution'
  | 'period_limit_exceeded'
  | 'trip_invite_shared'
  | 'trip_day_tab_switch'
  | 'flight_lookup_executed'
  | 'flight_schedule_saved'
  | 'schedule_place_search_select'
  | 'schedule_added_by_type'
  | 'receipt_capture_started'
  | 'receipt_scan_accuracy'
  | 'receipt_amount_mode'
  | 'expense_dashboard_viewed'
  | 'expense_category_filter_click'
  | 'expense_saved'
  | 'expense_schedule_linked_rate';

export type WorkspaceAnalyticsEvent = {
  name: WorkspaceAnalyticsEventName;
  payload: Record<string, string | number | boolean>;
  timestamp: string;
};

const MAX_RECENT_EVENTS = 200;
const recentEvents: WorkspaceAnalyticsEvent[] = [];

// 화면별 전환·사용 지표를 메모리 링 버퍼에 기록하여 QA 및 대시보드 수집기에서 조회할 수 있게 한다.
export function trackWorkspaceEvent(
  name: WorkspaceAnalyticsEventName,
  payload: Record<string, string | number | boolean> = {},
): void {
  const entry: WorkspaceAnalyticsEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };
  recentEvents.push(entry);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }
}

// 최근 기록된 지표 이벤트 스냅샷을 반환한다.
export function getRecentWorkspaceEvents(): readonly WorkspaceAnalyticsEvent[] {
  return recentEvents;
}
