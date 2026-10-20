import Text from '@/components/AppText';
import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { FoundationClientError, requestFoundation } from '@wherego/api-client';
import {
  flightLookupQuerySchema,
  flightLookupResponseSchema,
} from '@wherego/validation';
import { serverOptions } from './service';
import { Action, Field } from './ui';
import { styles } from './workspaceStyles';

import { FlightExtraFields } from './FlightManualFields';
import FlightLookupCandidateCard from './FlightLookupCandidateCard';
import FlightRoutePreview from './FlightRoutePreview';
import { useFormScope } from './InputFeedback';
import {
  flightLookupValues,
  type FlightLookupCandidate,
  type FlightLookupResult,
} from './flightLookupModel';

type Props = {
  userId: string;
  date: string;
  values: Record<string, string>;
  disabled?: boolean;
  timeKey: 'flightTime' | 'timeSlot';
  onChange: (key: string, value: string) => void;
};

// 여행 생성·일정 추가 모두 편명과 선택한 출발일을 기준으로 조회한다.
export default function FlightLookup(props: Props) {
  // 공항·시각은 조회 후 확인하거나 사용자가 직접 입력을 선택할 때 펼친다.
  const [manual, setManual] = useState(false);
  const fields = useFormScope().feedback.fields;
  // 숨겨진 항공편 입력에 오류가 있으면 같은 렌더에서 수정란을 표시한다.
  const editing =
    manual ||
    Object.keys(fields).some((name) => {
      // 항공편 오류 외의 다른 입력은 펼침 상태를 바꾸지 않는다.
      return /공항 코드|시각 \(|터미널|소요시간|수하물|좌석 등급|항공기/.test(
        name,
      );
    });
  // 실제로 조회하지 않은 기본 공항이나 항공편을 표시하지 않는다.
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.label}>
        출발일 · {props.date || '여행 날짜를 먼저 선택해 주세요'}
      </Text>
      <Field
        label="항공 편명 (예: KE123)"
        value={props.values.flightNumber || ''}
        onChange={(value) => {
          // 편명 입력 시 조회 요청을 자동 실행하지 않는다.
          return props.onChange(
            'flightNumber',
            value.replace(/\s/g, '').toUpperCase(),
          );
        }}
      />
      <LookupResults
        key={`${props.userId}:${props.date}:${props.values.flightNumber}`}
        {...props}
        onSelect={(item) => {
          // 선택한 구간만 채우고 입력칸은 수정할 때만 펼친다.
          return void (Object.entries(
            flightLookupValues(item, props.values, props.timeKey),
          ).forEach(([key, value]) => {
            // 기존 폼의 함수형 갱신으로 항목을 하나씩 반영한다.
            return props.onChange(key, value);
          }),
          setManual(false));
        }}
      />
      {!editing && props.values.flightArrival && (
        <View style={styles.card}>
          <Text style={styles.label}>선택한 항공편</Text>
          <FlightRoutePreview
            departure={props.values.flightDeparture || ''}
            arrival={props.values.flightArrival}
            departureTime={props.values[props.timeKey]}
            arrivalTime={props.values.flightArrivalTime}
            arrivalDate={
              props.values.flightArrivalDate &&
              props.values.flightArrivalDate !== props.date
                ? props.values.flightArrivalDate
                : undefined
            }
          />
          <Text style={styles.subtitle}>
            각 공항 현지 시각 · 항공권과 비교해 확인해 주세요.
          </Text>
        </View>
      )}
      <Action
        label={
          editing
            ? '항공편 상세 접기'
            : props.values.flightArrival
              ? '항공편 정보 수정'
              : '직접 입력하기'
        }
        disabled={props.disabled}
        onPress={() => {
          // 조회에 실패해도 입력값을 지우지 않고 직접 수정할 수 있게 한다.
          return setManual(!editing);
        }}
      />
      {editing && (
        <View style={{ gap: 12 }}>
          <Text style={styles.subtitle}>
            항공권과 비교해 확인해 주세요. 터미널과 운항 시각은 바뀔 수 있어요.
          </Text>
          {Object.entries({
            flightDeparture: '출발 공항 코드',
            flightArrival: '도착 공항 코드',
            [props.timeKey]:
              props.timeKey === 'flightTime'
                ? '출발 시각 (선택, HH:mm)'
                : '출발 시각 (현지, HH:mm)',
          }).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={props.values[key] || ''}
              onChange={(value) => {
                // 공항 코드는 대문자로 통일하고 시각 문자열은 그대로 보존한다.
                return void (setManual(true),
                props.onChange(
                  key,
                  key.startsWith('flight') && key !== 'flightTime'
                    ? value.trim().toUpperCase()
                    : value,
                ));
              }}
            />
          ))}
          <FlightExtraFields
            values={props.values}
            onChange={(key, value) => {
              // 오류를 고치는 동안 상세 입력을 펼쳐 둔다.
              return void (setManual(true), props.onChange(key, value));
            }}
          />
        </View>
      )}
    </View>
  );
}

// 조회 요청의 수명은 편명·날짜·계정 하나에만 연결한다.
function LookupResults(
  props: Props & { onSelect: (item: FlightLookupCandidate) => void },
) {
  // 입력 변경으로 컴포넌트가 교체되면 이전 조회를 취소한다.
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FlightLookupResult | null>(null);
  const [chosen, setChosen] = useState(false);
  useEffect(() => {
    // 닫힌 폼이나 다른 날짜의 늦은 응답을 입력에 반영하지 않는다.
    return () => controller.current?.abort();
  }, []);
  // 조회만 실행하고 결과 선택 전에는 폼을 변경하지 않는다.
  function lookup(): void {
    // 버튼 연타는 요청 시작 전에 차단한다.
    return controller.current && !controller.current.signal.aborted
      ? undefined
      : startLookup();
  }
  // 유효한 입력과 서버 세션으로 한 번의 조회 흐름을 시작한다.
  function startLookup(): void {
    // 출발일 누락도 서버 과금 전에 안내한다.
    return flightLookupQuerySchema.safeParse({
      number: props.values.flightNumber,
      date: props.date,
    }).success
      ? runLookup(new AbortController())
      : setError('편명과 출발일을 확인해 주세요. 예: KE123');
  }
  // 요청 상태를 초기화한 뒤 응답을 검증해 현재 화면에만 표시한다.
  function runLookup(active: AbortController): void {
    // 직접 입력 중인 내용은 실패·취소·조회 완료로 덮어쓰지 않는다.
    return void ((controller.current = active),
    setBusy(true),
    setError(''),
    setResult(null),
    setChosen(false),
    serverOptions(props.userId)
      .then((options) => {
        // 인증이 늦게 끝나도 이미 닫힌 화면에서는 외부 요청을 시작하지 않는다.
        return active.signal.aborted
          ? Promise.reject(new Error('ABORTED'))
          : requestFoundation(
              options,
              `/flights/lookup?${new URLSearchParams({ number: props.values.flightNumber || '', date: props.date })}`,
              { signal: active.signal },
            );
      })
      .then((response) => {
        // 취소된 요청은 새 화면에 조회 후보를 표시하지 않는다.
        return active.signal.aborted
          ? undefined
          : setResult(flightLookupResponseSchema.parse(response.data));
      })
      .catch((failure: unknown) => {
        // 내부 설정·공급자 메시지 대신 재시도와 직접 입력 방법을 안내한다.
        return active.signal.aborted
          ? undefined
          : setError(
              failure instanceof FoundationClientError && failure.status === 429
                ? '조회가 잠시 많아졌어요. 잠시 후 다시 찾거나 직접 입력해 주세요.'
                : '항공편을 불러오지 못했어요. 다시 찾거나 직접 입력해 주세요.',
            );
      })
      .finally(() => {
        // 종료된 요청만 재조회할 수 있도록 잠금을 해제한다.
        return active.signal.aborted
          ? undefined
          : void ((controller.current = null), setBusy(false));
      }));
  }
  // 후보는 여러 구간일 때도 자동으로 첫 항목을 확정하지 않는다.
  return (
    <View style={{ gap: 12 }}>
      <Action
        label={busy ? '항공편 찾는 중…' : '항공편 찾기'}
        variant="primary"
        disabled={
          busy ||
          props.disabled ||
          !props.date ||
          !props.values.flightNumber?.trim()
        }
        onPress={lookup}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {result && !chosen && (
        <>
          <Text style={styles.subtitle}>
            {result.candidates.length
              ? '항공권과 같은 구간을 선택해 주세요.'
              : '해당 출발일의 항공편을 찾지 못했어요. 날짜와 편명을 확인하거나 직접 입력해 주세요.'}
          </Text>
          {result.candidates.map((item, index) => (
            <FlightLookupCandidateCard
              key={`${item.departure}:${item.arrival}:${item.departureTime}:${index}`}
              item={item}
              disabled={props.disabled}
              onSelect={() => {
                // 명시적인 구간 선택만 기존 폼 값을 바꾼다.
                return void (props.onSelect(item), setChosen(true));
              }}
            />
          ))}
        </>
      )}
      {result?.notice ? (
        <Text style={styles.subtitle}>{result.notice}</Text>
      ) : null}
      {result && (
        <Action
          label={`항공편 정보: ${result.source} · ${result.checkedAt.slice(0, 10)} 조회`}
          variant="quiet"
          onPress={() => {
            // 조회 출처는 실제 공급자 웹사이트로 연결한다.
            return void Linking.openURL(
              result.source === '한국공항공사'
                ? 'https://www.data.go.kr/data/15158519/openapi.do'
                : 'https://aerodatabox.com/',
            ).catch(() => {
              // 출처 페이지도 다시 열 수 있게 실패를 안내한다.
              return setError('출처 페이지를 열지 못했어요. 다시 눌러 주세요.');
            });
          }}
        />
      )}
    </View>
  );
}
