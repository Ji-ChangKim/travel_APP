import Modal from '@/components/AppModal';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useAppAccessibility } from '@/features/accessibility/appAccessibility';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { FormAnchor, useFormScope } from './InputFeedback';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Action } from './ui';
import { styles } from './workspaceStyles';

import DestinationPicker from './DestinationPicker';

// 현지 달력 날짜를 UTC 변환 없이 문자열로 만든다.
function dateText(date: Date): string {
  // 날짜 선택기에서 시차로 날짜가 바뀌지 않게 한다.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 모바일 달력 또는 웹 날짜 컨트롤로 날짜 하나를 선택한다.
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  minimumDate?: string;
  maximumDate?: string;
}) {
  // 취소는 기존 값을 유지한다.
  const [open, setOpen] = useState(false);
  const locked = useFormScope().locked;
  const input = useRef<HTMLInputElement>(null);
  const { fontScale } = useAppAccessibility();
  // 플랫폼에 맞는 달력만 표시한다.
  return (
    <FormAnchor
      name={label}
      focus={() => {
        /* 웹 날짜 입력이나 모바일 달력을 바로 선택할 수 있게 한다. */ return locked
          ? undefined
          : Platform.OS === 'web'
            ? input.current?.focus()
            : setOpen(true);
      }}
    >
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web' ? (
        <input
          ref={input}
          disabled={locked}
          aria-label={label}
          type={mode}
          value={value}
          min={minimumDate || undefined}
          max={maximumDate || undefined}
          onClick={(event) => {
            // 입력 영역을 눌러도 브라우저 달력 선택기가 열린다.
            event.currentTarget.showPicker?.();
          }}
          onChange={(event) => {
            // 브라우저가 선택한 달력 날짜만 전달한다.
            onChange(event.target.value);
          }}
          style={{
            padding: 14,
            fontSize: 16 * fontScale,
            lineHeight: `${26 * fontScale}px`,
            fontFamily: 'TripPrintRegular',
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 12,
            minHeight: 48,
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            outlineColor: colors.focus,
            outlineOffset: 2,
            backgroundColor: locked ? colors.disabledSurface : colors.surface,
            color: colors.text,
          }}
        />
      ) : (
        <>
          <Action
            label={value || `${label} 선택`}
            onPress={() => {
              // 날짜 선택기를 연다.
              setOpen(true);
            }}
          />
          {open && !locked && (
            <DateTimePicker
              value={
                value
                  ? new Date(
                      mode === 'date'
                        ? `${value}T12:00:00`
                        : `2000-01-01T${value}:00`,
                    )
                  : new Date()
              }
              mode={mode}
              display={
                mode === 'date'
                  ? Platform.OS === 'ios'
                    ? 'inline'
                    : 'calendar'
                  : 'default'
              }
              minimumDate={
                minimumDate ? new Date(`${minimumDate}T00:00:00`) : undefined
              }
              maximumDate={
                maximumDate ? new Date(`${maximumDate}T23:59:59`) : undefined
              }
              onChange={(event, date) => {
                // 닫은 뒤 확정된 날짜만 입력에 반영한다.
                setOpen(Platform.OS === 'ios' && event.type !== 'dismissed');
                if (event.type === 'set' && date)
                  onChange(
                    mode === 'date'
                      ? dateText(date)
                      : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
                  );
              }}
            />
          )}
          {open && !locked && Platform.OS === 'ios' && (
            <Action
              label="날짜 선택 완료"
              onPress={() => {
                // iOS 달력의 표시만 닫는다.
                setOpen(false);
              }}
            />
          )}
        </>
      )}
    </FormAnchor>
  );
}

// 나라와 도시는 각각 독립된 모달에서 선택한다.
export function DestinationFields(props: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  // 선택창 종류만 보관하고 검색 중인 이름은 폼에 반영하지 않는다.
  return (
    <DestinationContent
      {...props}
      pickerState={useState<'country' | 'city' | null>(null)}
    />
  );
}

// 선택값을 적용하고 선택창을 닫는다.
function DestinationContent({
  values,
  onChange,
  pickerState: [picker, setPicker],
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  pickerState: [
    'country' | 'city' | null,
    Dispatch<SetStateAction<'country' | 'city' | null>>,
  ];
}) {
  // 나라와 도시는 한 줄에서 같은 너비로 배치하고 나라 선택 후 도시를 활성화한다.
  return (
    <View style={styles.card}>
      <Text style={styles.title}>여행지 선택</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View testID="trip-country" style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text style={styles.label}>나라</Text>
          <FormAnchor name="나라">
            <Action
              label={values.country || '나라 선택'}
              onPress={() => {
                /* 나라 선택창을 연다. */ return setPicker('country');
              }}
            />
          </FormAnchor>
        </View>
        <View testID="trip-city" style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text style={styles.label}>도시</Text>
          <FormAnchor name="도시">
            <Action
              label={values.city || '도시 선택'}
              disabled={!values.country?.trim()}
              onPress={() => {
                /* 선택 국가의 도시 선택창을 연다. */ return setPicker('city');
              }}
            />
          </FormAnchor>
        </View>
      </View>
      <Modal
        native
        visible={Boolean(picker)}
        animationType="slide"
        accessibilityLabel={picker === 'city' ? '도시 선택' : '나라 선택'}
        onRequestClose={() => {
          // 시스템 뒤로에서도 선택 전 값을 유지한다.
          setPicker(null);
        }}
      >
        {picker && (
          <DestinationPicker
            key={picker}
            kind={picker}
            country={values.country || ''}
            onClose={() => {
              /* 취소하면 이전 여행지를 유지한다. */ return setPicker(null);
            }}
            onSelect={(value) => {
              /* 선택한 여행지 필드만 적용한 뒤 모달을 닫는다. */ return (
                onChange(picker, value),
                setPicker(null)
              );
            }}
          />
        )}
      </Modal>
    </View>
  );
}
