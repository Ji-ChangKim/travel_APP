import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WorkspaceSchedule } from '@wherego/domain';
import AppModal from '@/components/ui/AppModal';
import ActionSheet from '@/components/ui/ActionSheet';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import DesignButton from '@/components/ui/DesignButton';
import TripIcon from '@/components/icons/TripIcon';
import Text from '@/components/ui/AppText';
import { colors } from '@/constants/theme';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import { schedulesForDay } from '../model/schedulePresentation';
import { scheduleDirectionsUrl } from '../model/scheduleOrder';
import { schedulePageStyles as s } from '../styles/schedulePageStyles';
import SchedulePlaceCard from '../ui/SchedulePlaceCard';
import type { Props } from './TripTimeline';

// 선택한 DAY의 타임라인 헤더와 빈 상태 카드·장소 카드 목록·상세 시트를 표시한다.
export default function DaySchedule(props: Props) {
  useLocale();
  const items = schedulesForDay(props.snapshot.itinerary, props.day.id);
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
        </View>
        <View style={s.countBadge}>
          <Text style={s.count}>{t('장소 {p0}개', { p0: items.length })}</Text>
        </View>
      </View>
      {!items.length && (
        <View style={s.empty} testID="schedule-empty">
          <View style={s.icon} aria-hidden>
            <TripIcon name="map-pin-duotone" size={30} color={colors.primary} />
          </View>
          <Text style={s.title}>{t('아직 등록된 장소가 없어요.')}</Text>
          <Text style={s.emptyText}>
            {props.canCreate
              ? t('DAY {p0}에 방문할 첫 장소를 추가해 보세요.', {
                p0: props.day.dayNumber,
              })
              : t('등록한 장소는 여기에서 확인할 수 있어요.')}
          </Text>
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
                <DesignButton
                  label={t('일정 수정')}
                  disabled={props.disabled}
                  onPress={() => {
                    // 상세 모달을 닫고 선택한 일정의 수정 모달을 연다.
                    setDetailId('');
                    props.onEdit(detail);
                  }}
                />
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </AppModal>
    </View>
  );
}
