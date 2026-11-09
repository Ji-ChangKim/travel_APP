import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTripStore } from '@/stores/useTripStore';
import { useAuthReady } from './authReadiness';
import { authReturn } from '../model/authReturn';
import {
  authenticatedDestination,
  completedDestination,
} from '../model/destination';

// 과거 프로필 링크도 추가 입력 없이 같은 인증 복귀 규칙으로 처리한다.
export function useDefaultProfileEntry() {
  const router = useRouter();
  const ready = useAuthReady((state) => state.ready);
  const user = useTripStore((state) => state.currentUser);
  const params = useLocalSearchParams<Record<string, string>>();
  const destination = JSON.stringify(
    authReturn(params.next, params.destination, params.tripId, params),
  );
  const [attempt, setAttempt] = useState(0);
  const [failedEntry, setFailedEntry] = useState('');
  const accountId = user?.id;
  const guest = user?.authProvider === 'guest';
  const entryKey = JSON.stringify([accountId, destination, attempt]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const entry = JSON.parse(destination) as ReturnType<typeof authReturn>;
    if (!accountId) {
      router.replace({ pathname: '/login', params: entry });
      return;
    }
    const next = guest
      ? completedDestination(
          entry.next,
          entry.destination,
          entry.tripId,
          false,
          entry,
        )
      : authenticatedDestination(
          entry.next,
          entry.destination,
          entry.tripId,
          entry,
        );
    void next
      .then((target) => {
        if (active && useTripStore.getState().currentUser?.id === accountId)
          router.replace(target);
      })
      .catch(() => {
        if (active && useTripStore.getState().currentUser?.id === accountId)
          setFailedEntry(entryKey);
      });
    return () => {
      active = false;
    };
  }, [ready, accountId, guest, destination, entryKey, router]);

  return {
    error: failedEntry === entryKey,
    retry: () => setAttempt((value) => value + 1),
    back: () => router.replace('/login'),
  };
}
