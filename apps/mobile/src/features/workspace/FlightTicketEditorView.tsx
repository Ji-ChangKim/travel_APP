import Text from '@/components/AppText';
import ScreenHeader from '@/components/ScreenHeader';
import { type Dispatch, type SetStateAction } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FlightTicketManualInput from './FlightTicketManualInput';
import { TicketSearch } from './FlightTicketSearch';
import { DateField } from './TravelInputs';
import { ticketManualValues } from './flightTicketDraft';
import { selectedTripFlight } from './tripFlightModel';
import { Action, Field } from './ui';
import { styles } from './workspaceStyles';

import type { Props } from './FlightTicketEditor';
// renderFlightEditor이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderFlightEditorProps = {
  props: Props;
  code: string;
  digits: string;
  airline: string;
  date: string;
  selected: {
    number: string;
    departure: string;
    arrival: string;
    time: string;
    date: string;
    role: 'outbound' | 'inbound' | 'additional';
    departureTerminal?: string | undefined;
    arrivalTerminal?: string | undefined;
    arrivalTime?: string | undefined;
    arrivalDate?: string | undefined;
    durationMinutes?: number | undefined;
    baggageKg?: number | undefined;
    cabin?: string | undefined;
    aircraftType?: string | undefined;
    aircraftRegistration?: string | undefined;
  } | null;
  manual: boolean;
  values: Record<string, string>;
  issue: string;
  finish: () => void;
  setDate: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<
    SetStateAction<{
      number: string;
      departure: string;
      arrival: string;
      time: string;
      date: string;
      role: 'outbound' | 'inbound' | 'additional';
      departureTerminal?: string | undefined;
      arrivalTerminal?: string | undefined;
      arrivalTime?: string | undefined;
      arrivalDate?: string | undefined;
      durationMinutes?: number | undefined;
      baggageKg?: number | undefined;
      cabin?: string | undefined;
      aircraftType?: string | undefined;
      aircraftRegistration?: string | undefined;
    } | null>
  >;
  setCode: Dispatch<SetStateAction<string>>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  setAirline: Dispatch<SetStateAction<string>>;
  match: { code: string; name: string } | undefined;
  setDigits: Dispatch<SetStateAction<string>>;
  setManual: Dispatch<SetStateAction<boolean>>;
};

// 선택한 항공권의 입력과 완료 행동을 배치한다.
export function renderFlightEditor({
  props,
  code,
  digits,
  airline,
  date,
  selected,
  manual,
  values,
  issue,
  finish,
  setDate,
  setSelected,
  setCode,
  setValues,
  setAirline,
  match,
  setDigits,
  setManual,
}: RenderFlightEditorProps) {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <SafeAreaView style={styles.modal}>
      <ScreenHeader
        title="항공권 입력"
        backLabel="항공편 목록으로 돌아가기"
        onBack={() => {
          // 확정하지 않은 입력은 해당 슬롯의 초안으로만 보존한다.
          return props.onBack({
            code,
            digits,
            airline,
            date,
            selected,
            manual,
            values,
          });
        }}
        disabled={props.locked}
        right={
          <Action
            label="완료"
            size="header"
            variant="quiet"
            disabled={props.locked || (manual ? Boolean(issue) : !selected)}
            onPress={finish}
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
        {!manual &&
          renderFlightIdentity({
            code,
            props,
            setCode,
            setValues,
            digits,
            setAirline,
            setSelected,
            match,
            airline,
            setDigits,
          })}
        {!manual && (
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
              return candidate
                ? void (setSelected(
                    selectedTripFlight(candidate, props.slot.role),
                  ),
                  setValues(
                    ticketManualValues(
                      selectedTripFlight(candidate, props.slot.role),
                    ),
                  ))
                : setSelected(null);
            }}
          />
        )}
        <Action
          label={manual ? '항공편 조회로 돌아가기' : '항공권 직접 입력'}
          disabled={props.locked}
          onPress={() => {
            // 조회 실패 후에도 이전 수동 입력을 보존하며 방식만 바꾼다.
            return manual
              ? setManual(false)
              : void (setValues((previous) => ({
                  ...previous,
                  flightNumber: previous.flightNumber || `${code}${digits}`,
                })),
                setManual(true));
          }}
        />
        {manual && (
          <FlightTicketManualInput
            values={values}
            disabled={props.locked}
            onChange={(key, value) => {
              // 직접 입력 필드 한 개만 수정한다.
              return void (setValues((previous) => ({
                ...previous,
                [key]: value,
              })),
              setSelected(null));
            }}
          />
        )}
        {manual && issue ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {issue}
          </Text>
        ) : null}
        {!manual && selected ? (
          <Text style={styles.label}>
            선택한 항공편 · {selected.number} {selected.departure} →{' '}
            {selected.arrival}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
// renderFlightIdentity이 읽는 값과 실행 가능한 행동의 계약이다.
type RenderFlightIdentityProps = {
  code: string;
  props: Props;
  setCode: Dispatch<SetStateAction<string>>;
  setValues: Dispatch<SetStateAction<Record<string, string>>>;
  digits: string;
  setAirline: Dispatch<SetStateAction<string>>;
  setSelected: Dispatch<
    SetStateAction<{
      number: string;
      departure: string;
      arrival: string;
      time: string;
      date: string;
      role: 'outbound' | 'inbound' | 'additional';
      departureTerminal?: string | undefined;
      arrivalTerminal?: string | undefined;
      arrivalTime?: string | undefined;
      arrivalDate?: string | undefined;
      durationMinutes?: number | undefined;
      baggageKg?: number | undefined;
      cabin?: string | undefined;
      aircraftType?: string | undefined;
      aircraftRegistration?: string | undefined;
    } | null>
  >;
  match: { code: string; name: string } | undefined;
  airline: string;
  setDigits: Dispatch<SetStateAction<string>>;
};

// 항공사와 편명 입력을 표시한다.
export function renderFlightIdentity({
  code,
  props,
  setCode,
  setValues,
  digits,
  setAirline,
  setSelected,
  match,
  airline,
  setDigits,
}: RenderFlightIdentityProps): import('react').ReactNode {
  // 전달받은 값과 행동을 기존 화면 규격으로 표시한다.

  return (
    <View style={styles.card}>
      <Field
        label="항공사 코드"
        placeholder="예: KE"
        value={code}
        disabled={props.locked}
        onChange={(value) => {
          // 항공사 코드 변경 후에는 항공사와 구간을 다시 선택한다.
          const next = value
            .replace(/[^A-Z0-9]/gi, '')
            .toUpperCase()
            .slice(0, 2);
          return void (setCode(next),
          setValues((previous) => ({
            ...previous,
            flightNumber: `${next}${digits}`,
          })),
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
          const next = value
            .toUpperCase()
            .replace(/[^0-9A-Z]/g, '')
            .slice(0, 5);
          return void (setDigits(next),
          setValues((previous) => ({
            ...previous,
            flightNumber: `${code}${next}`,
          })),
          setSelected(null));
        }}
      />
      <Text style={styles.subtitle}>
        항공사를 선택하고 항공권의 번호 3~4자리를 입력해 주세요.
      </Text>
    </View>
  );
}
