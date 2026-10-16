import Text from '@/components/AppText';
import { View } from 'react-native';
import { Action, styles } from './ui';
import FlightRoutePreview from './FlightRoutePreview';
import type { FlightSlot, TripFlight } from './tripFlightModel';

// 출발편과 도착편의 빈 슬롯을 기본으로 표시하고 추가편은 실제 등록한 것만 나열한다.
export default function TripFlightList({
  items,
  onEdit,
  onRemove,
}: {
  items: TripFlight[];
  onEdit: (slot: FlightSlot) => void;
  onRemove: (index: number) => void;
}) {
  // 빈 슬롯은 실제 항공권이나 예시 운항편으로 표시하지 않는다.
  return (
    <View style={{ gap: 16 }}>
      {(['outbound', 'inbound'] as const).map((role) => {
        // 기본 두 구간은 각각 독립된 입력 페이지로 연결한다.
        const index = items.findIndex((item) => item.role === role);
        return (
          <FlightSlotCard
            key={role}
            label={role === 'outbound' ? '출발 항공편' : '도착 항공편'}
            item={items[index]}
            disabled={index < 0 && items.length >= 30}
            onEdit={() => {
              // 기존 구간이면 수정, 빈 구간이면 새 등록을 시작한다.
              return onEdit({ role, index: index < 0 ? null : index });
            }}
            onRemove={() => {
              // 명시적으로 선택한 구간 한 개만 목록에서 뺀다.
              return onRemove(index);
            }}
          />
        );
      })}
      {items.map((item, index) =>
        item.role === 'additional' ? (
          <FlightSlotCard
            key={index}
            label="추가 항공편"
            item={item}
            onEdit={() => {
              // 추가 구간의 원래 순서를 유지하며 수정한다.
              return onEdit({ role: 'additional', index });
            }}
            onRemove={() => {
              // 다른 항공편은 그대로 유지한다.
              return onRemove(index);
            }}
          />
        ) : null,
      )}
      <Action
        label="추가 항공권 등록"
        disabled={items.length >= 30}
        onPress={() => {
          // 여행 중 국내선 등 별도 구간을 새 항공편으로 등록한다.
          return onEdit({ role: 'additional', index: null });
        }}
      />
    </View>
  );
}

// 등록 구간과 예정시각·터미널만 목록 카드에 보여준다.
function FlightSlotCard({
  label,
  item,
  onEdit,
  onRemove,
  disabled = false,
}: {
  label: string;
  item?: TripFlight;
  onEdit: () => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  // 입력 페이지를 완료한 구간만 실제 정보 카드로 표시한다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{label}</Text>
      {item ? (
        <>
          <Text style={styles.label}>
            {item.number} · {item.date}
          </Text>
          <FlightRoutePreview
            departure={item.departure}
            arrival={item.arrival}
            departureTime={item.time}
            arrivalTime={item.arrivalTime}
            arrivalDate={
              item.arrivalDate !== item.date ? item.arrivalDate : undefined
            }
          />
          <Text style={styles.subtitle}>
            출발 터미널 · {item.departureTerminal || '정보 없음'}
          </Text>
          <Text style={styles.subtitle}>
            도착 터미널 · {item.arrivalTerminal || '정보 없음'}
          </Text>
          <View style={styles.row}>
            <Action label={`${label} 변경`} onPress={onEdit} />
            <Action
              label={`${label} 삭제`}
              variant="quiet"
              onPress={onRemove}
            />
          </View>
        </>
      ) : (
        <Action
          label={`${label} 추가하기`}
          disabled={disabled}
          onPress={onEdit}
        />
      )}
    </View>
  );
}
