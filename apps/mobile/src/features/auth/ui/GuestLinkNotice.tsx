import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import CenteredNoticeModal from '@/components/ui/CenteredNoticeModal';
import DesignButton from '@/components/ui/DesignButton';
import Text from '@/components/ui/AppText';
import { t } from '@/features/localization/translate';
import { useLocale } from '@/features/localization/localeState';
import {
  localGuestTrips,
  importGuestTrip,
  linkedGuestTrip,
  linkedGuestTarget,
} from '@/services/guestImportService';
import { useTripStore } from '@/stores/useTripStore';
import { completedDestination } from '../model/destination';
import { profileSetupStyles as s } from '../styles/profileSetupStyles';
import { authReturn, authReturnPath } from '../model/authReturn';

export default function GuestLinkNotice({
  next,
  destination,
  tripId,
}: {
  next?: string;
  destination?: string;
  tripId?: string;
}) {
  useLocale();
  const router = useRouter();
  const context = useLocalSearchParams<Record<string, string>>();
  const client = useQueryClient();
  const account = useTripStore((state) => state.currentUser?.id);
  const [local, setLocal] =
    useState<Awaited<ReturnType<typeof localGuestTrips>>>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<
    Record<string, 'confirmed' | 'failed'>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    void localGuestTrips()
      .then((value) => {
        if (active.current) {
          setLocal(value);
          if (value) {
            setSelected(value.document.trips.map((item) => item.trip.id));
          }
        }
      })
      .catch(() => {
        if (active.current)
          setError('이 기기의 여행을 불러오지 못했어요. 다시 시도해 주세요.');
      });
    return () => {
      active.current = false;
    };
  }, [account]);
  async function continueToTarget() {
    const serverTrip =
      account && tripId ? await linkedGuestTrip(account, tripId) : null;
    if (
      tripId &&
      local?.document.trips.some((item) => item.trip.id === tripId) &&
      !serverTrip
    ) {
      setError('이 작업을 이어가려면 해당 여행을 계정에 연결해 주세요.');
      return;
    }
    const targetRef =
      account && tripId
        ? await linkedGuestTarget(account, tripId, context.targetRef)
        : context.targetRef;
    const target = await completedDestination(
      next,
      destination,
      serverTrip || tripId,
      true,
      authReturn(next, destination, tripId, { ...context, targetRef }),
    );
    if (active.current && useTripStore.getState().currentUser?.id === account)
      router.replace(target);
  }
  async function connect() {
    if (lock.current || !account || !local) return;
    lock.current = true;
    setBusy(true);
    setError('');
    let failed = false;
    try {
      for (const trip of local.document.trips.filter((item) =>
        selected.includes(item.trip.id),
      )) {
        if (
          !active.current ||
          useTripStore.getState().currentUser?.id !== account
        )
          return;
        try {
          await importGuestTrip(account, local.document, trip);
          if (active.current)
            setResults((previous) => ({
              ...previous,
              [trip.trip.id]: 'confirmed',
            }));
        } catch {
          failed = true;
          if (active.current)
            setResults((previous) => ({
              ...previous,
              [trip.trip.id]: 'failed',
            }));
        }
      }
      client.invalidateQueries({ queryKey: ['trips'] });
      if (failed)
        setError(
          '연결하지 못한 여행이 있어요. 이 기기의 원본은 그대로예요. 다시 시도해 주세요.',
        );
      else await continueToTarget();
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function cancel() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await useTripStore
        .getState()
        .loginAsGuest(
          Platform.OS === 'ios'
            ? 'ios'
            : Platform.OS === 'android'
              ? 'android'
              : 'web',
        );
      if (active.current)
        router.replace(
          authReturnPath(authReturn(next, destination, tripId, context)),
        );
    } catch {
      if (active.current)
        setError('이 기기의 여행으로 돌아가지 못했어요. 다시 시도해 주세요.');
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <CenteredNoticeModal
      visible
      title={t('이 기기의 여행을 계정에 연결할까요?')}
      paragraphs={[
        t('선택한 여행만 계정에 보관해요. 이 기기의 원본은 그대로 남아요.'),
        t('연결할 계정: {nickname}', {
          nickname: useTripStore((state) => state.currentUser?.nickname) || '',
        }),
      ]}
    >
      <View style={s.choices}>
        {local?.document.trips.map((item) => (
          <View key={item.trip.id} style={s.field}>
            <DesignButton
              label={item.trip.title}
              disabled={busy || results[item.trip.id] === 'confirmed'}
              onPress={() =>
                setSelected((value) =>
                  value.includes(item.trip.id)
                    ? value.filter((id) => id !== item.trip.id)
                    : [...value, item.trip.id],
                )
              }
              variant={
                selected.includes(item.trip.id) ? 'primary' : 'secondary'
              }
            />
            <Text style={s.body}>
              {results[item.trip.id] === 'confirmed'
                ? t('연결 완료')
                : results[item.trip.id] === 'failed'
                  ? t('연결 실패 · 다시 시도해 주세요')
                  : selected.includes(item.trip.id)
                    ? t('선택됨')
                    : t('선택 안 함')}
            </Text>
          </View>
        ))}
        {error && (
          <Text style={s.error} accessibilityRole="alert">
            {t(error)}
          </Text>
        )}
        <DesignButton
          label={t('선택한 여행 연결')}
          variant="primary"
          loading={busy}
          disabled={busy || selected.length === 0}
          onPress={() => void connect()}
        />
        <DesignButton
          label={t(
            tripId &&
              local?.document.trips.some((item) => item.trip.id === tripId)
              ? '홈으로 이동'
              : '연결하지 않고 계속',
          )}
          disabled={busy}
          onPress={() =>
            tripId &&
            local?.document.trips.some((item) => item.trip.id === tripId)
              ? router.replace('/(tabs)')
              : void continueToTarget()
          }
        />
        <DesignButton
          label={t('게스트 여행으로 돌아가기')}
          disabled={busy}
          onPress={() => void cancel()}
        />
      </View>
    </CenteredNoticeModal>
  );
}
