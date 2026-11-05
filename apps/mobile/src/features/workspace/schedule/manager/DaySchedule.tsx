import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSchedule, WorkspaceSnapshot } from '@wherego/domain';
import AppModal from '@/components/ui/AppModal';
import ActionSheet from '@/components/ui/ActionSheet';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import DesignButton from '@/components/ui/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { getLocale, useLocale } from '@/features/localization/localeState';
import { schedulesForDay } from '../model/schedulePresentation';
import { scheduleDirectionsUrl } from '../model/scheduleOrder';
import { schedulePageStyles as s } from '../styles/schedulePageStyles';
import SchedulePlaceCard from '../ui/SchedulePlaceCard';
import type { Props } from './TripTimeline';

// 날짜 문자열(YYYY-MM-DD)을 섹션 헤더 우측의 월 일 요일(예: 11월 15일 일요일) 형식으로 변환한다.
function formatFullDayDate(date: string): string {
  // 기기 시간대 영향을 받지 않도록 UTC 정오 시각 기준으로 포맷한다.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

// 여행 스냅샷의 시작일·종료일로 N박 M일 문자열을 계산한다.
function formatTripDurationLabel(snapshot: WorkspaceSnapshot): string {
  const { startDate, endDate } = snapshot.trip;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
  ) {
    const count = Math.max(1, snapshot.days.length);
    return count > 1
      ? t('{p0}박 {p1}일', { p0: count - 1, p1: count })
      : t('당일치기');
  }
  const totalDays = Math.max(
    1,
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1,
  );
  const nights = totalDays - 1;
  return nights > 0
    ? t('{p0}박 {p1}일', { p0: nights, p1: totalDays })
    : t('당일치기');
}

// 목적지 도시에 맞는 추천 검색 키워드 칩 3종을 반환한다.
function quickKeywordsForDestination(city: string): {
  emoji: string;
  label: string;
  query: string;
}[] {
  // 도쿄 여행은 시안의 대표 키워드 3종을 우선 노출한다.
  if (/도쿄|tokyo/i.test(city)) {
    return [
      {
        emoji: '☕️',
        label: t('키요스미 시라카와 카페'),
        query: t('키요스미 시라카와 카페'),
      },
      {
        emoji: '🍜',
        label: t('시부야 라멘 맛집'),
        query: t('시부야 라멘 맛집'),
      },
      {
        emoji: '🗼',
        label: t('롯폰기 힐즈 전망대'),
        query: t('롯폰기 힐즈 전망대'),
      },
    ];
  }
  return [
    {
      emoji: '☕️',
      label: t('{p0} 감성 카페', { p0: city }),
      query: t('{p0} 감성 카페', { p0: city }),
    },
    {
      emoji: '🍜',
      label: t('{p0} 로컬 맛집', { p0: city }),
      query: t('{p0} 로컬 맛집', { p0: city }),
    },
    {
      emoji: '🗼',
      label: t('{p0} 대표 명소', { p0: city }),
      query: t('{p0} 대표 명소', { p0: city }),
    },
  ];
}

// 선택한 DAY의 타임라인 헤더와 빈 상태 카드·장소 카드 목록·상세 시트를 표시한다.
export default function DaySchedule(props: Props) {
  useLocale();
  const items = schedulesForDay(props.snapshot.itinerary, props.day.id);
  const destinationName =
    props.snapshot.trip.city || props.snapshot.trip.country || t('여행지');
  const durationLabel = formatTripDurationLabel(props.snapshot);
  const keywords = quickKeywordsForDestination(destinationName);
  const [detailId, setDetailId] = useState('');
  const [menuId, setMenuId] = useState('');
  const [moveId, setMoveId] = useState('');
  const [targetDay, setTargetDay] = useState(props.day.id);
  const [notice, setNotice] = useState('');
  const detail = items.find((item) => {
    // 현재 상세 모달로 열려 있는 일정을 찾는다.
    return item.id === detailId;
  });
  const menu = items.find((item) => {
    // 현재 관리 시트로 열려 있는 일정을 찾는다.
    return item.id === menuId;
  });
  const moving = items.find((item) => {
    // 다른 DAY로 이동 중인 일정을 찾는다.
    return item.id === moveId;
  });

  // 선택한 장소의 주소·좌표로 외부 지도 길찾기 링크를 연다.
  async function directions(item: WorkspaceSchedule) {
    const url = scheduleDirectionsUrl(item);
    if (!url) {
      setNotice(t('위치 정보가 없어요. 일정 수정에서 주소를 입력해 주세요.'));
      setDetailId(item.id);
      return;
    }
    try {
      // 웹 지도 링크는 지도 앱이 없어도 같은 목적지로 열 수 있다.
      await Linking.openURL(url);
    } catch {
      setNotice(t('지도를 열지 못했어요. 길찾기를 다시 눌러 주세요.'));
    }
  }

  return (
    <View style={s.section}>
      <View style={s.headingRow} testID="schedule-timeline-header">
        <View style={s.headingLeft}>
          <View
            style={s.timelineDot}
            testID="schedule-timeline-dot"
            aria-hidden
          />
          <Text accessibilityRole="header" style={s.heading}>
            {t('DAY {p0} 일정', { p0: props.day.dayNumber })}
          </Text>
          <Text style={s.placeCountText} testID="schedule-place-count">
            {t('{p0}개 장소', { p0: items.length })}
          </Text>
        </View>
        <View style={s.dateBadgeRow} testID="schedule-timeline-date">
          <TripIcon name="clock-outline" size={14} color={colors.muted} />
          <Text style={s.dateText}>
            {formatFullDayDate(props.day.tripDate)}
          </Text>
        </View>
      </View>
      {!items.length && (
        <View style={s.empty} testID="schedule-empty">
          <Text style={s.title}>{t('아직 등록된 일정이 없어요')}</Text>
          <Text style={s.emptyText}>
            {props.canCreate
              ? t(
                  '가고 싶은 {p0} 명소, 카페, 맛집을 검색하거나\n영수증 사진으로 빠르게 일정을 채워보세요!',
                  { p0: destinationName },
                )
              : t('등록한 장소는 여기에서 확인할 수 있어요.')}
          </Text>
          {props.canCreate && (
            <>
              <View style={s.keywordSection} testID="schedule-empty-keywords">
                <Text style={s.keywordHeader}>
                  {t('추천 키워드로 바로 찾기')}
                </Text>
                <View style={s.keywordChipRow}>
                  {keywords.map((chip, index) => (
                    <Pressable
                      key={chip.label}
                      testID={`schedule-keyword-chip-${index + 1}`}
                      accessibilityRole="button"
                      accessibilityLabel={chip.label}
                      disabled={props.disabled}
                      onPress={() => {
                        // 추천 키워드로 장소 제목이 미리 채워진 일정 추가 모달을 연다.
                        if (props.onSelectCategory) {
                          props.onSelectCategory({
                            emoji: chip.emoji,
                            label: chip.label,
                            type: 'PLACE',
                            query: chip.query,
                          });
                          return;
                        }
                        props.onAdd();
                      }}
                      style={({ pressed }) => [
                        s.keywordChip,
                        pressed && s.pressed,
                      ]}
                    >
                      <Text style={s.keywordEmoji} aria-hidden>
                        {chip.emoji}
                      </Text>
                      <Text style={s.keywordChipText}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={s.guideLinksCol} testID="schedule-empty-guides">
                <Pressable
                  testID="schedule-empty-template"
                  accessibilityRole="button"
                  accessibilityLabel={t('추천 코스 불러오기')}
                  disabled={props.disabled}
                  onPress={() => {
                    // 목적지 추천 템플릿(추천 코스) 선택 시트를 연다.
                    return props.onCourse();
                  }}
                  style={({ pressed }) => [
                    s.templateLink,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={s.templateLinkText}>
                    {t('추천 {p0} {p1} 템플릿 불러오기', {
                      p0: destinationName,
                      p1: durationLabel,
                    })}
                  </Text>
                  <Text style={s.templateChevron} aria-hidden>
                    ›
                  </Text>
                </Pressable>
                <Pressable
                  testID="schedule-empty-search-guide"
                  accessibilityRole="button"
                  accessibilityLabel={t('장소 검색으로 추가')}
                  disabled={props.disabled}
                  onPress={() => {
                    // 선택한 DAY의 장소 검색 작성 모달을 즉시 연다.
                    return props.onAdd();
                  }}
                  style={({ pressed }) => [
                    s.secondaryGuideLink,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={s.secondaryGuideText}>
                    {t('직접 장소 검색으로 채우기')}
                  </Text>
                  <Text style={s.secondaryGuideChevron} aria-hidden>
                    ›
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}
      {items.map((item, index) => (
        <SchedulePlaceCard
          key={item.id}
          item={item}
          index={index}
          last={index === items.length - 1}
          selected={props.selectedScheduleId === item.id}
          editable={props.canCreate}
          disabled={props.disabled}
          expenses={props.snapshot.expenses.filter(
            (expense) => expense.scheduleId === item.id,
          )}
          photos={props.snapshot.media.filter(
            (media) =>
              media.scheduleId === item.id && media.purpose === 'photo',
          )}
          onOpen={() => {
            // 선택한 장소의 상세 모달을 열고 이전 안내 문구를 지운다.
            setNotice('');
            setDetailId(item.id);
            props.onSelectSchedule?.(item.id);
          }}
          onMore={() => {
            // 선택한 장소의 수정·이동·삭제 관리 시트를 연다.
            setNotice('');
            setMenuId(item.id);
          }}
          onDirections={() => {
            // 선택한 장소로 바로 길찾기를 실행한다.
            void directions(item);
          }}
          onExpense={() => {
            // 해당 장소에서 사용한 식비·입장료 등 비용 기록 시트를 연다.
            props.onExpense(item);
          }}
          onPhoto={() => {
            // 해당 장소에서 찍은 사진을 앨범에서 선택해 공유·첨부한다.
            props.onPhoto(item);
          }}
        />
      ))}
      {notice && !detail ? (
        <Text accessibilityRole="alert" style={s.error}>
          {notice}
        </Text>
      ) : null}
      <ActionSheet
        visible={Boolean(menu)}
        title={menu?.title || t('일정 관리')}
        onClose={() => {
          // 관리 시트를 닫는다.
          return setMenuId('');
        }}
      >
        {menu && (
          <>
            <DesignButton
              label={t('일정 수정')}
              disabled={props.disabled}
              onPress={() => {
                // 관리 시트를 닫고 선택한 일정 수정 폼을 연다.
                setMenuId('');
                props.onEdit(menu);
              }}
            />
            <DesignButton
              label={t('사용 비용 기록')}
              disabled={props.disabled}
              onPress={() => {
                // 관리 시트를 닫고 해당 장소의 사용 비용 입력창을 연다.
                setMenuId('');
                props.onExpense(menu);
              }}
            />
            <DesignButton
              label={t('찍은 사진 추가')}
              disabled={props.disabled}
              onPress={() => {
                // 관리 시트를 닫고 해당 장소에 사진을 첨부한다.
                setMenuId('');
                props.onPhoto(menu);
              }}
            />
            <DesignButton
              label={t('다른 DAY로 이동')}
              disabled={props.disabled || props.snapshot.days.length < 2}
              onPress={() => {
                // 이동할 대상 DAY 선택 시트로 전환한다.
                setMenuId('');
                setTargetDay(props.day.id);
                setMoveId(menu.id);
              }}
            />
            <DesignButton
              label={t('일정 삭제')}
              disabled={props.disabled}
              onPress={() => {
                // 관리 시트를 닫고 삭제 확인 절차를 시작한다.
                setMenuId('');
                props.onDelete(menu);
              }}
            />
          </>
        )}
      </ActionSheet>
      <ActionSheet
        visible={Boolean(moving)}
        title={t('다른 DAY로 이동')}
        onClose={() => {
          // 저장 대기 중이 아닐 때만 DAY 이동 시트를 닫는다.
          if (!props.busy && !props.pending) setMoveId('');
        }}
      >
        {moving && (
          <>
            <Text style={s.body}>{moving.title}</Text>
            <Text style={s.meta}>
              {t(
                '선택한 DAY의 마지막 순서로 옮겨요. 예정 시간과 메모는 유지돼요.',
              )}
            </Text>
            {props.snapshot.days.map((day) => (
              <DesignButton
                key={day.id}
                label={`DAY ${day.dayNumber} · ${day.tripDate}`}
                selected={targetDay === day.id}
                disabled={props.disabled}
                onPress={() => {
                  // 이동할 목표 DAY를 선택한다.
                  return setTargetDay(day.id);
                }}
              />
            ))}
            <DesignButton
              label={t('이동 확인')}
              variant="primary"
              disabled={props.disabled || targetDay === props.day.id}
              onPress={() => {
                // 선택한 목표 DAY로 일정 이동 명령을 실행한다.
                return props.onMove?.(moving, targetDay, () => {
                  // 이동이 완료되면 시트를 닫는다.
                  return setMoveId('');
                });
              }}
            />
            {props.error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {props.error}
              </Text>
            ) : null}
            {props.pending && !props.busy && (
              <DesignButton
                label={t('다시 저장하기')}
                onPress={() => {
                  // 보류된 이동 명령을 같은 멱등 키로 다시 전송한다.
                  return props.onRetry?.();
                }}
              />
            )}
            {props.error && !props.busy && (
              <DesignButton
                label={t('최신 내용 불러오기')}
                onPress={() => {
                  // 버전 충돌 시 서버의 최신 여행 스냅샷을 다시 불러온다.
                  return props.onReload?.();
                }}
              />
            )}
          </>
        )}
      </ActionSheet>
      <AppModal
        native
        visible={Boolean(detail)}
        accessibilityLabel={t('일정 상세')}
        onRequestClose={() => {
          // 상세 모달을 닫는다.
          return setDetailId('');
        }}
      >
        {detail && (
          <SafeAreaView style={s.page}>
            <ScreenHeader
              title={t('일정 상세')}
              onBack={() => {
                // 상단 뒤로가기 버튼으로 상세 모달을 닫는다.
                return setDetailId('');
              }}
            />
            <ScrollView contentContainerStyle={s.content}>
              <View style={s.card}>
                <View style={s.row}>
                  <View style={s.timePill}>
                    <TripIcon
                      name="clock-outline"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={s.timeText}>
                      DAY {props.day.dayNumber} · {props.day.tripDate} ·{' '}
                      {detail.timeSlot || t('시간 미정')}
                    </Text>
                  </View>
                </View>
                <Text style={s.heading}>{detail.title}</Text>
                {detail.address ? (
                  <View style={s.addressRow}>
                    <TripIcon
                      name="map-pin-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={s.body}>{detail.address}</Text>
                  </View>
                ) : null}
                {detail.memo ? (
                  <View style={s.memoBox}>
                    <Text style={s.body}>{detail.memo}</Text>
                  </View>
                ) : null}
              </View>
              {notice ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {notice}
                </Text>
              ) : null}
              <DesignButton
                label={t('길찾기')}
                onPress={() => {
                  // 상세 화면에서 외부 지도 길찾기를 실행한다.
                  void directions(detail);
                }}
              />
              {props.canCreate && (
                <>
                  <DesignButton
                    label={t('사용 비용 기록')}
                    disabled={props.disabled}
                    onPress={() => {
                      // 상세 모달을 닫고 해당 장소의 비용 기록 창을 연다.
                      setDetailId('');
                      props.onExpense(detail);
                    }}
                  />
                  <DesignButton
                    label={t('찍은 사진 추가')}
                    disabled={props.disabled}
                    onPress={() => {
                      // 상세 모달을 닫고 해당 장소에 사진을 첨부한다.
                      setDetailId('');
                      props.onPhoto(detail);
                    }}
                  />
                  <DesignButton
                    label={t('일정 수정')}
                    disabled={props.disabled}
                    onPress={() => {
                      // 상세 모달을 닫고 선택한 일정의 수정 모달을 연다.
                      setDetailId('');
                      props.onEdit(detail);
                    }}
                  />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </AppModal>
    </View>
  );
}
