import { useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import Text from '@/components/AppText';
import type { TripDestination } from '@wherego/domain';
import { tripDestinationSchema } from '@wherego/validation';
import { DestinationFields } from './TravelInputs';
import { countryDefaults } from './countries';
import { cityTimezones } from './destinationCatalog';
import { Field, Action } from './ui';
import { styles } from './workspaceStyles';

// 도시 선택·시간대 편집은 같은 폼 값에 남겨 이탈·실패 보호를 공유한다.
export default function DestinationCollection({
  items,
  values,
  onChange,
  onItemsChange,
  disabled,
  canRemove = () => true,
  maxItems = 20,
}: {
  items: TripDestination[];
  values: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  onItemsChange: (items: TripDestination[]) => void;
  canRemove?: (id: string) => boolean;
  maxItems?: number;
}) {
  // 입력 중인 도시와 저장된 도시 목록은 같은 초안 안에서 관리한다.
  const [error, setError] = useState('');
  const country = values.destinationCountry || '';
  const city = values.destinationCity || '';
  function add(): void {
    // 완성된 도시만 추가하고 기존 도시 ID를 재사용하지 않는다.
    if (disabled || items.length >= maxItems) return;
    const item = tripDestinationSchema.safeParse({
      id: Crypto.randomUUID(),
      country,
      city,
      timezone: cityTimezones[city] || countryDefaults(country).timezone,
    });
    if (
      !item.success ||
      items.some(
        (other) =>
          other.country === item.data.country && other.city === item.data.city,
      )
    ) {
      setError(
        '나라와 도시를 선택해 주세요. 같은 도시는 한 번만 추가할 수 있어요.',
      );
      return;
    }
    onItemsChange([...items, item.data]);
    onChange('destinationCountry', '');
    onChange('destinationCity', '');
    setError('');
  }
  return (
    <View style={{ gap: 16 }}>
      {items.map((item, index) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.title}>여행 도시 {index + 1}</Text>
          {(['country', 'city', 'timezone'] as const).map((key) => (
            <Field
              key={key}
              label={`${index + 1}번째 ${key === 'country' ? '나라' : key === 'city' ? '도시' : '현지 시간대'}`}
              value={item[key]}
              disabled={disabled}
              onChange={(value) => {
                // ID와 DAY 연결은 유지하며 사용자가 바꾼 속성만 갱신한다.
                return onItemsChange(
                  items.map((other) =>
                    other.id === item.id
                      ? {
                          ...other,
                          [key]: value,
                          ...(key === 'country'
                            ? {
                                city: '',
                                timezone: countryDefaults(value).timezone,
                              }
                            : {}),
                        }
                      : other,
                  ),
                );
              }}
            />
          ))}
          <Action
            label={`${item.city || index + 1} 도시 삭제`}
            disabled={disabled || !canRemove(item.id)}
            onPress={() =>
              onItemsChange(items.filter((other) => other.id !== item.id))
            }
          />
          {!canRemove(item.id) && (
            <Text style={styles.subtitle}>
              DAY에 배정한 도시는 여행지를 바꾼 뒤 삭제할 수 있어요.
            </Text>
          )}
        </View>
      ))}
      <DestinationFields
        values={{ country, city }}
        onChange={(key, value) => {
          if (disabled) return;
          onChange(
            key === 'country' ? 'destinationCountry' : 'destinationCity',
            value,
          );
          if (key === 'country') onChange('destinationCity', '');
        }}
      />
      <Action
        label="여행 도시 추가"
        disabled={disabled || items.length >= maxItems}
        onPress={add}
      />
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
