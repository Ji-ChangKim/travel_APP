import React, { useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Text from '@/components/AppText';
import PlacePhoto from './PlacePhoto';
import TravelRoute from './TravelRoute';
import PlanDescription from './PlanDescription';
import type {
  TimelinePlanModel,
  TimelineScheduleItem,
  TimelineDayGroup,
} from './timelinePlanTypes';
import {
  timelinePlanStyles as s,
  timelineColors as c,
} from './timelinePlanStyles';

interface PlanDetailTimelineViewProps {
  data: TimelinePlanModel;
  onExecuteCta?: () => void;
  onPrint?: () => void;
  onAddSchedule?: (dayNumber: number) => void;
  onAddTransport?: (dayNumber: number) => void;
  bottomAction?: React.ReactNode;
  preview?: { tripId: string; userId: string };
  embedded?: boolean;
  extraContent?: React.ReactNode;
  showTitle?: boolean;
}

// 저장된 DB 계획 데이터를 기반으로 세부 일정 타임라인을 동적으로 렌더링한다.
export default function PlanDetailTimelineView({
  data,
  onExecuteCta,
  onPrint,
  onAddSchedule,
  onAddTransport,
  bottomAction,
  preview,
  embedded = false,
  extraContent,
  showTitle = true,
}: PlanDetailTimelineViewProps) {
  // 선택된 DAY 탭 상태를 관리하며 기본값은 첫 번째 일차다.
  const [selectedDayTab, setSelectedDayTab] = useState<number | 'summary'>(
    data.days[0]?.dayNumber || 1,
  );

  // 현재 선택된 DAY 데이터 묶음을 읽는다.
  const currentDayGroup =
    data.days.find((d) => d.dayNumber === selectedDayTab) || data.days[0];

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 여행 요약 헤더 배너 */}
        <TripHeaderBanner data={data} showTitle={showTitle} />

        {/* 2. 가로 스티키 DAY 탭 선택 바 */}
        <DayTabSelector
          days={data.days}
          selectedTab={selectedDayTab}
          onSelectTab={setSelectedDayTab}
        />

        {/* 요약 뷰 또는 일차별 타임라인 뷰 분기 */}
        {selectedDayTab === 'summary' ? (
          <PlanSummaryOverview days={data.days} />
        ) : currentDayGroup ? (
          <>
            {/* 3. DAY 서브 바 & 통계 */}
            <DaySectionBar dayGroup={currentDayGroup} />

            {/* 4. 수직 타임라인 피드 */}
            <TimelineFlowSection
              key={`${data.id}:${data.revision || ''}:${currentDayGroup.dayNumber}`}
              mode={data.mode}
              schedules={currentDayGroup.schedules}
              travelLegs={currentDayGroup.travelLegs}
              photoSource={
                preview
                  ? { preview }
                  : { postId: data.mode === 'my' ? undefined : data.id }
              }
            />

            {/* 5. 빠른 액션 버튼 2열 */}
            <QuickActionButtons
              mode={data.mode}
              dayNumber={currentDayGroup.dayNumber}
              onAddSchedule={onAddSchedule}
              onAddTransport={onAddTransport}
            />

            {/* 6. 동선 요약 & 미니 맵 */}
            <RouteSummaryMiniMap dayGroup={currentDayGroup} />

            {/* 7. 플래너 팁 박스 */}
            <PlannerTipsBox
              title={data.tipsTitle}
              description={data.tipsDescription}
            />
          </>
        ) : null}
        {extraContent}
      </ScrollView>

      {/* 8. 하단 플로팅 실행 바 */}
      {!embedded &&
        (bottomAction || (
          <BottomFloatingBar
            ctaLabel={data.executionCtaLabel}
            onPressCta={onExecuteCta}
            onPressPrint={onPrint}
          />
        ))}
    </View>
  );
}

// 1. 여행 요약 헤더 배너 렌더러
function TripHeaderBanner({
  data,
  showTitle,
}: {
  data: TimelinePlanModel;
  showTitle: boolean;
}) {
  // 국가 및 도시 정보를 연결 문자열로 포맷팅한다.
  const destinationText = [data.country, data.city].filter(Boolean).join(' & ');

  return (
    <View style={s.banner}>
      <View style={s.bannerBadgeRow}>
        <View style={s.stepBadge}>
          <View style={s.stepDot} />
          <Text style={s.stepBadgeText}>{data.badgeStepText}</Text>
        </View>
        <Text style={s.durationBadgeText}>{data.badgeDurationText}</Text>
      </View>

      {showTitle && (
        <Text accessibilityRole="header" style={s.bannerTitle}>
          {data.title}
        </Text>
      )}

      <View style={s.metaRow}>
        <MaterialIcons name="date-range" size={16} color={c.primary} />
        <Text style={s.metaText}>{data.periodText}</Text>
        <Text style={s.metaDot}>•</Text>
        <Text style={[s.metaText, s.metaHighlight]}>{destinationText}</Text>
      </View>

      <Text style={s.bannerDescription}>{data.guideDescription}</Text>
    </View>
  );
}

// 2. 가로 DAY 탭 선택 바 렌더러
function DayTabSelector({
  days,
  selectedTab,
  onSelectTab,
}: {
  days: TimelineDayGroup[];
  selectedTab: number | 'summary';
  onSelectTab: (tab: number | 'summary') => void;
}) {
  return (
    <View style={s.dayTabContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.dayTabRow}>
          {days.map((day) => {
            const isSelected = selectedTab === day.dayNumber;
            return (
              <Pressable
                key={day.id}
                onPress={() => onSelectTab(day.dayNumber)}
                style={[s.dayTab, isSelected && s.dayTabActive]}
                accessibilityRole="tab"
                accessibilityLabel={`DAY ${day.dayNumber}`}
                aria-selected={isSelected}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[s.dayTabText, isSelected && s.dayTabTextActive]}>
                  {day.tabLabel}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => onSelectTab('summary')}
            style={[
              s.dayTab,
              s.dayTabSummary,
              selectedTab === 'summary' && s.dayTabActive,
            ]}
            accessibilityRole="tab"
            aria-selected={selectedTab === 'summary'}
            accessibilityState={{ selected: selectedTab === 'summary' }}
          >
            <Text
              style={[
                s.dayTabText,
                s.dayTabTextSummary,
                selectedTab === 'summary' && s.dayTabTextActive,
              ]}
            >
              전체 요약
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// 3. DAY 서브 바 & 통계 렌더러
function DaySectionBar({ dayGroup }: { dayGroup: TimelineDayGroup }) {
  return (
    <View style={s.subBar}>
      <View style={s.subBarLeft}>
        <View style={s.subBarNumberBadge}>
          <Text style={s.subBarNumberText}>{dayGroup.dayNumber}</Text>
        </View>
        <View style={s.subBarTitleContainer}>
          <Text style={s.subBarTitle}>{dayGroup.planTitle}</Text>
          {dayGroup.city ? (
            <Text style={s.subBarSubtitle}>{dayGroup.city}</Text>
          ) : null}
          <Text style={s.subBarSubtitle}>{dayGroup.planConcept}</Text>
        </View>
      </View>
      <View style={s.countBadge}>
        <Text style={s.countBadgeText}>일정 {dayGroup.schedules.length}개</Text>
      </View>
    </View>
  );
}

// 4. 수직 타임라인 피드 렌더러
function TimelineFlowSection({
  schedules,
  travelLegs,
  mode,
  photoSource,
}: {
  schedules: TimelineScheduleItem[];
  travelLegs?: TimelineDayGroup['travelLegs'];
  mode: TimelinePlanModel['mode'];
  photoSource?: {
    postId?: string;
    preview?: { tripId: string; userId: string };
  };
}) {
  return (
    <View style={s.timelineContainer}>
      <View pointerEvents="none" style={s.verticalRail} />
      {schedules.map((item, index) => (
        <View key={item.id}>
          <TimelineCardItem
            item={item}
            index={index}
            mode={mode}
            photoSource={photoSource}
          />
          {travelLegs
            ?.filter((leg) => leg.fromScheduleId === item.id)
            .map((leg) =>
              photoSource?.preview || photoSource?.postId ? (
                <TravelRoute
                  key={leg.toScheduleId}
                  source={
                    photoSource.preview
                      ? { preview: photoSource.preview }
                      : { postId: photoSource.postId! }
                  }
                  leg={leg}
                />
              ) : null,
            )}
        </View>
      ))}
    </View>
  );
}

// 타임라인 단일 카드 아이템 렌더러
function TimelineCardItem({
  item,
  index,
  mode,
  photoSource,
}: {
  item: TimelineScheduleItem;
  index: number;
  mode: TimelinePlanModel['mode'];
  photoSource?: {
    postId?: string;
    preview?: { tripId: string; userId: string };
  };
}) {
  // 일정 유형에 부합하는 마커 아이콘을 결정한다.
  const iconName = resolveTimelineIcon(item);

  // 모드별 팁/메모 헤더 명칭과 아이콘을 결정한다.
  const memoTitle =
    mode === 'curated'
      ? '에디터 코스 팁'
      : mode === 'footprint'
        ? '여행자 꿀팁 후기'
        : '여행 메모';
  const memoIcon: keyof typeof MaterialIcons.glyphMap =
    mode === 'curated'
      ? 'tips-and-updates'
      : mode === 'footprint'
        ? 'bookmark-added'
        : 'edit-note';

  return (
    <View style={s.itemRow}>
      {/* 노드 마커 */}
      <View
        style={[s.nodeMarker, item.type === 'PLACE' && s.nodeMarkerHighlight]}
      >
        <MaterialIcons
          name={iconName}
          size={18}
          color={item.type === 'PLACE' ? c.primary : c.ink}
        />
      </View>

      {/* 카드 바디 */}
      <View style={s.cardBody}>
        {photoSource &&
        (photoSource.postId || photoSource.preview) &&
        ['PLACE', 'STAY', 'RESERVATION'].includes(item.type) ? (
          <PlacePhoto
            {...photoSource}
            scheduleId={item.id}
            title={item.title}
          />
        ) : null}
        <View style={s.cardTopRow}>
          <View style={s.itemTypeBadge}>
            <Text style={s.itemTypeBadgeText}>
              {item.badgeLabel || '방문 장소'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {item.costInfo ? (
              <Text
                style={[
                  s.timeSlotText,
                  { color: c.primary, fontWeight: '700' },
                ]}
              >
                {item.costInfo.currency} {item.costInfo.amount}
              </Text>
            ) : null}
            {item.timeSlot ? (
              <Text style={s.timeSlotText}>{item.timeSlot}</Text>
            ) : null}
          </View>
        </View>

        <Text style={s.itemTitle}>{item.title}</Text>
        {item.address ? (
          <Text style={s.itemSubtitle} numberOfLines={2}>
            {item.address}
          </Text>
        ) : null}
        <PlanDescription
          title={item.title}
          content={item.planContent}
          address={item.address}
        />

        {/* 항공편 전용 부가 안내 */}
        {item.flightInfo ? (
          <View style={s.transitRow}>
            <MaterialIcons name="flight" size={14} color={c.primary} />
            <Text style={s.transitText}>
              {item.flightInfo.carrier}
              {item.flightInfo.statusText
                ? ` · ${item.flightInfo.statusText}`
                : ''}
            </Text>
          </View>
        ) : null}

        {/* 여행자/에디터 메모 박스 */}
        {item.memo ? (
          <View style={s.memoBox}>
            <View style={s.memoHeader}>
              <MaterialIcons name={memoIcon} size={15} color={c.primary} />
              <Text style={s.memoHeaderText}>{memoTitle}</Text>
            </View>
            <Text style={s.memoBodyText}>{item.memo}</Text>
          </View>
        ) : null}

        {/* 이동 안내 */}
        {item.transitInfo ? (
          <View style={s.transitRow}>
            <MaterialIcons name="directions-walk" size={14} color={c.primary} />
            <Text style={s.transitText}>{item.transitInfo}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// 5. 빠른 액션 버튼 2열 렌더러
function QuickActionButtons({
  mode,
  dayNumber,
  onAddSchedule,
  onAddTransport,
}: {
  mode: TimelinePlanModel['mode'];
  dayNumber: number;
  onAddSchedule?: (day: number) => void;
  onAddTransport?: (day: number) => void;
}) {
  // 연결된 행동이 없으면 실행할 수 없는 버튼을 표시하지 않는다.
  if (!onAddSchedule && !onAddTransport) return null;
  // 모드별로 적합한 액션 텍스트를 구성한다.
  const isMy = mode === 'my';
  const leftLabel = isMy ? '+ 장소/일정 추가' : '+ 관심 장소 스크랩';
  const rightLabel = isMy ? '+ 이동수단/메모' : '+ 여행 메모 복사';

  return (
    <View style={s.quickActionsContainer}>
      <View style={s.quickActionsGrid}>
        {onAddSchedule && (
          <Pressable
            style={s.quickActionButton}
            onPress={() => onAddSchedule?.(dayNumber)}
          >
            <MaterialIcons
              name={isMy ? 'add-location-alt' : 'bookmark-border'}
              size={18}
              color={c.primary}
            />
            <Text style={s.quickActionText}>{leftLabel}</Text>
          </Pressable>
        )}
        {onAddTransport && (
          <Pressable
            style={s.quickActionButton}
            onPress={() => onAddTransport?.(dayNumber)}
          >
            <MaterialIcons
              name={isMy ? 'commute' : 'content-copy'}
              size={18}
              color={c.muted}
            />
            <Text style={s.quickActionText}>{rightLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// 6. 동선 요약 & 미니 지도 렌더러
function RouteSummaryMiniMap({ dayGroup }: { dayGroup: TimelineDayGroup }) {
  const summary = dayGroup.routeSummary;
  if (!summary) return null;

  return (
    <View style={s.routeSummaryCard}>
      <View style={s.routeHeaderRow}>
        <Text style={s.routeTitle}>
          DAY {dayGroup.dayNumber} 이동 동선 요약
        </Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>방문 장소</Text>
          <Text style={s.statValue}>{summary.placeCount}곳</Text>
        </View>
        {summary.distanceKm !== undefined && (
          <View style={s.statBox}>
            <Text style={s.statLabel}>예상 도보</Text>
            <Text style={s.statValue}>{summary.distanceKm} km</Text>
          </View>
        )}
        {summary.durationText && (
          <View style={s.statBox}>
            <Text style={s.statLabel}>예상 소요</Text>
            <Text style={s.statValue}>{summary.durationText}</Text>
          </View>
        )}
      </View>

      <Text style={s.itemSubtitle}>{summary.routePathText}</Text>
    </View>
  );
}

// 7. 플래너 팁 박스 렌더러
function PlannerTipsBox({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  // 원본에 작성하지 않은 추천·검증 팁을 만들어 표시하지 않는다.
  if (!description) return null;
  return (
    <View style={s.tipsBox}>
      <MaterialIcons name="tips-and-updates" size={22} color={c.primary} />
      <View style={s.tipsContent}>
        <Text style={s.tipsTitle}>{title || 'TripPrint 플래너 팁'}</Text>
        <Text style={s.tipsDescription}>{description}</Text>
      </View>
    </View>
  );
}

// 8. 전체 요약 종합 뷰 렌더러
function PlanSummaryOverview({ days }: { days: TimelineDayGroup[] }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
      <Text style={s.routeTitle}>전체 여정 한눈에 보기</Text>
      {days.map((day) => (
        <View key={day.id} style={s.routeSummaryCard}>
          <Text style={s.itemTitle}>
            DAY {day.dayNumber} · {day.planTitle}
          </Text>
          <Text style={s.itemSubtitle}>{day.planConcept}</Text>
          <View style={{ gap: 6, marginTop: 4 }}>
            {day.schedules.slice(0, 3).map((item) => (
              <Text key={item.id} style={s.memoBodyText}>
                • {item.title} {item.timeSlot ? `(${item.timeSlot})` : ''}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// 9. 하단 플로팅 실행 바 렌더러
function BottomFloatingBar({
  ctaLabel,
  onPressCta,
  onPressPrint,
}: {
  ctaLabel: string;
  onPressCta?: () => void;
  onPressPrint?: () => void;
}) {
  return (
    <View style={s.bottomExecutionBar}>
      {onPressPrint && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="일정 공유 및 인쇄"
          onPress={onPressPrint}
          style={s.printButton}
        >
          <Ionicons name="print-outline" size={22} color={c.ink} />
        </Pressable>
      )}
      {onPressCta && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={onPressCta}
          style={s.ctaButton}
        >
          <Text style={s.ctaButtonText}>{ctaLabel}</Text>
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

// 스케줄 항목의 유형에 따라 적합한 Material 아이콘 이름을 반환한다.
function resolveTimelineIcon(
  item: TimelineScheduleItem,
): keyof typeof MaterialIcons.glyphMap {
  if (
    item.flightInfo ||
    item.title.includes('항공') ||
    item.title.includes('공항')
  ) {
    return 'flight-takeoff';
  }
  if (
    item.type === 'TRANSPORT' ||
    item.title.includes('열차') ||
    item.title.includes('지하철')
  ) {
    return 'directions-subway';
  }
  if (
    item.type === 'STAY' ||
    item.title.includes('호텔') ||
    item.title.includes('숙소') ||
    item.title.includes('체크인')
  ) {
    return 'hotel';
  }
  if (
    item.title.includes('카페') ||
    item.title.includes('다도') ||
    item.title.includes('커피')
  ) {
    return 'local-cafe';
  }
  return 'photo-camera';
}
