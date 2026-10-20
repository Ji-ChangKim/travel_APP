import Text from '@/components/AppText';
import { FoundationClientError, requestFoundation } from '@wherego/api-client';
import {
  flightLookupQuerySchema,
  flightLookupResponseSchema,
} from '@wherego/validation';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import FlightRoutePreview from './FlightRoutePreview';
import type { FlightLookupCandidate } from './flightLookupModel';
import { serverOptions } from './service';
import { Action } from './ui';
import { styles } from './workspaceStyles';

// 한 편명·날짜의 요청과 취소 수명을 분리한다.
export function TicketSearch({
  userId,
  number,
  enabled,
  date,
  startDate,
  endDate,
  locked,
  onSelect,
}: {
  userId: string;
  number: string;
  enabled: boolean;
  date: string;
  startDate: string;
  endDate: string;
  locked: boolean;
  onSelect: (item: FlightLookupCandidate | null) => void;
}) {
  // 입력 변경과 페이지 이탈 시 늦은 조회 결과를 버린다.
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<FlightLookupCandidate[] | null>(
    null,
  );
  const [chosen, setChosen] = useState('');
  useEffect(() => {
    // 닫힌 항공권 입력 페이지의 응답은 적용하지 않는다.
    return () => controller.current?.abort();
  }, []);
  function lookup(): void {
    // 유효한 날짜·번호와 단일 요청 잠금을 확인한 뒤 조회한다.
    return controller.current || locked
      ? undefined
      : !flightLookupQuerySchema.safeParse({ number, date }).success ||
          date < startDate ||
          date > endDate
        ? setError('항공편 출발일을 여행 기간 안에서 선택해 주세요.')
        : runLookup(new AbortController());
  }
  function runLookup(active: AbortController): void {
    // 서버 인증과 기존 공급자 선택을 그대로 사용하고 실패 원문은 표시하지 않는다.
    return void ((controller.current = active),
    setBusy(true),
    setError(''),
    setCandidates(null),
    setChosen(''),
    onSelect(null),
    serverOptions(userId)
      .then((options) => {
        // 계정 확인 중 페이지가 닫혔다면 외부 조회를 시작하지 않는다.
        return active.signal.aborted
          ? Promise.reject(new Error('ABORTED'))
          : requestFoundation(
              options,
              `/flights/lookup?${new URLSearchParams({ number, date })}`,
              { signal: active.signal },
            );
      })
      .then((response) => {
        // 현재 페이지의 정상 응답만 후보로 표시한다.
        return active.signal.aborted
          ? undefined
          : receiveCandidates(
              flightLookupResponseSchema.parse(response.data).candidates,
            );
      })
      .catch((failure: unknown) => {
        // 조회 실패 시 목록의 기존 항공편을 유지하고 새 완료만 막는다.
        return active.signal.aborted
          ? undefined
          : setError(
              failure instanceof FoundationClientError && failure.status === 429
                ? '조회가 잠시 많아졌어요. 잠시 후 다시 시도해 주세요.'
                : '항공편을 불러오지 못했어요. 잠시 후 다시 조회해 주세요.',
            );
      })
      .finally(() => {
        // 취소된 페이지에는 상태를 갱신하지 않는다.
        return active.signal.aborted
          ? undefined
          : void ((controller.current = null), setBusy(false));
      }));
  }
  // 유일한 후보만 임시 선택하고 실제 목록 반영은 상단 완료에서 수행한다.
  function receiveCandidates(items: FlightLookupCandidate[]): void {
    // 여러 구간은 사용자가 선택하기 전까지 완료를 활성화하지 않는다.
    return void (setCandidates(items),
    items.length === 1 ? (onSelect(items[0]!), setChosen('0')) : undefined);
  }
  return (
    <View style={{ gap: 12 }}>
      <Action
        label={busy ? '조회 중…' : '조회하기'}
        variant="primary"
        disabled={locked || !enabled}
        loading={busy}
        onPress={lookup}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {candidates?.length === 0 ? (
        <Text style={styles.subtitle}>
          해당 날짜의 항공편을 찾지 못했어요. 항공권의 날짜와 편명을 확인한 뒤
          다시 조회해 주세요.
        </Text>
      ) : null}
      {candidates?.map((item, index) => (
        <View
          key={`${item.departure}:${item.arrival}:${index}`}
          style={styles.card}
        >
          <Text style={styles.label}>{item.number}</Text>
          <FlightRoutePreview
            {...item}
            arrivalDate={
              item.arrivalDate !== item.departureDate
                ? item.arrivalDate
                : undefined
            }
          />
          <Text style={styles.subtitle}>
            출발 터미널 · {item.departureTerminal || '정보 없음'}
          </Text>
          <Text style={styles.subtitle}>
            도착 터미널 · {item.arrivalTerminal || '정보 없음'}
          </Text>
          <Action
            label={`${item.departure} → ${item.arrival} ${item.departureTime} 항공편 선택`}
            selected={chosen === `${index}`}
            onPress={() => {
              // 사용자가 확인한 구간만 상단 완료 버튼에 연결한다.
              return void (onSelect(item), setChosen(`${index}`));
            }}
          />
        </View>
      ))}
    </View>
  );
}
