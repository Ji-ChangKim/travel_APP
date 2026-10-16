import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoundationClientError, requestFoundation } from '@wherego/api-client';
import {
  flightLookupResponseSchema,
  flightLookupQuerySchema,
} from '@wherego/validation';
import { Action, Field, styles } from './ui';
import { DateField } from './TravelInputs';
import { airlineByCode } from './airlineDirectory';
import { serverOptions } from './service';
import FlightRoutePreview from './FlightRoutePreview';
import type { FlightLookupCandidate } from './flightLookupModel';
import {
  selectedTripFlight,
  type FlightSlot,
  type TripFlight,
} from './tripFlightModel';

type Props = {
  userId: string;
  slot: FlightSlot;
  initial?: TripFlight;
  startDate: string;
  endDate: string;
  locked: boolean;
  onBack: () => void;
  onDone: (flight: TripFlight) => void;
};

// 항공사 선택과 번호 입력을 거쳐 조회한 구간만 목록에 확정한다.
export default function FlightTicketEditor(props: Props) {
  // 완료 전 수정값은 부모의 항공편 목록을 바꾸지 않는다.
  const [code, setCode] = useState(props.initial?.number.slice(0, 2) || '');
  const [digits, setDigits] = useState(props.initial?.number.slice(2) || '');
  const [airline, setAirline] = useState(
    props.initial?.number.slice(0, 2) || '',
  );
  const [date, setDate] = useState(
    props.initial?.date ||
      (props.slot.role === 'inbound' ? props.endDate : props.startDate),
  );
  const [selected, setSelected] = useState<TripFlight | null>(
    props.initial || null,
  );
  const match = airlineByCode(code);
  return (
    <SafeAreaView style={styles.modal}>
      <ScreenHeader
        title="항공권 입력"
        backLabel="항공편 목록으로 돌아가기"
        onBack={props.onBack}
        disabled={props.locked}
        right={
          <Action
            label="완료"
            variant="quiet"
            disabled={!selected || props.locked}
            onPress={() => {
              /* 선택한 구간만 기존 슬롯에 확정한다. */ return selected
                ? props.onDone(selected)
                : undefined;
            }}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: 640, paddingBottom: 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <DateField
          label="항공편 출발일"
          value={date}
          minimumDate={props.startDate}
          maximumDate={props.endDate}
          onChange={(value) => {
            // 날짜 변경은 이전 조회 선택을 무효화한다.
            return void (setDate(value), setSelected(null));
          }}
        />
        <View style={styles.card}>
          <Field
            label="항공사 코드"
            placeholder="예: KE"
            value={code}
            disabled={props.locked}
            onChange={(value) => {
              // 항공사 코드 변경 후에는 항공사와 구간을 다시 선택한다.
              return void (setCode(
                value
                  .replace(/[^A-Z0-9]/gi, '')
                  .toUpperCase()
                  .slice(0, 2),
              ),
              setAirline(''),
              setSelected(null));
            }}
          />
          {match ? (
            <Action
              label={`${match.code} · ${match.name}`}
              selected={airline === match.code}
              onPress={() => {
                // 확인한 항공사를 선택한 뒤 운항 번호를 입력한다.
                return setAirline(match.code);
              }}
            />
          ) : code.length === 2 ? (
            <Text style={styles.subtitle}>
              항공사를 찾지 못했어요. 항공권의 두 자리 코드를 확인해 주세요.
            </Text>
          ) : null}
          <Field
            label="항공편 번호"
            inputMode="numeric"
            placeholder="예: 901"
            value={digits}
            disabled={!airline || props.locked}
            onChange={(value) => {
              // 앞의 0과 실제 운항 접미사를 보존하고 이전 구간 선택은 해제한다.
              return void (setDigits(
                value
                  .toUpperCase()
                  .replace(/[^0-9A-Z]/g, '')
                  .slice(0, 5),
              ),
              setSelected(null));
            }}
          />
          <Text style={styles.subtitle}>
            항공사를 선택하고 항공권의 번호 3~4자리를 입력해 주세요.
          </Text>
        </View>
        <TicketSearch
          key={`${props.userId}:${airline}:${digits}:${date}`}
          userId={props.userId}
          number={`${airline}${digits}`}
          enabled={Boolean(airline && /^\d{3,4}[A-Z]?$/.test(digits))}
          date={date}
          startDate={props.startDate}
          endDate={props.endDate}
          locked={props.locked}
          onSelect={(candidate) => {
            // 공급자가 반환한 실제 출발일·구간만 선택 상태로 보관한다.
            return setSelected(
              candidate ? selectedTripFlight(candidate, props.slot.role) : null,
            );
          }}
        />
        {selected ? (
          <Text style={styles.label}>
            선택한 항공편 · {selected.number} {selected.departure} →{' '}
            {selected.arrival}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// 한 편명·날짜의 요청과 취소 수명을 분리한다.
function TicketSearch({
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
