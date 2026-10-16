import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import LoginButton from './LoginButton';
import { loginStyles as styles, loginTheme } from './loginStyles';

type BirthDateProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
};

// 생일 입력에 플랫폼에서 제공하는 실제 달력 선택기를 연결한다.
export default function BirthDateInput(props: BirthDateProps) {
  // 날짜 선택기를 닫을 때 작성 중인 다른 프로필 항목은 유지한다.
  return <BirthDateField {...props} openState={useState(false)} />;
}

// 선택한 날짜를 시간대 변환 없이 저장할 문자열로 만든다.
function calendarDate(date: Date): string {
  // 자정의 UTC 변환으로 생일이 하루 바뀌는 것을 막는다.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 웹 달력과 모바일 기본 달력을 동일한 생일 값에 연결한다.
function BirthDateField({
  value,
  disabled,
  onChange,
  openState: [open, setOpen],
}: BirthDateProps & {
  openState: [boolean, Dispatch<SetStateAction<boolean>>];
}) {
  // 선택 취소는 기존 날짜를 보존하며 미래 날짜 선택은 막는다.
  return (
    <View style={styles.field}>
      <Text style={styles.label}>생년월일 (선택)</Text>
      <Text style={styles.fieldHint}>
        입력하지 않아도 여행을 시작할 수 있어요.
      </Text>
      {Platform.OS === 'web' ? (
        <input
          aria-label="생년월일 (YYYY-MM-DD)"
          type="date"
          min="1900-01-01"
          value={value}
          max={calendarDate(new Date())}
          disabled={disabled}
          onChange={(event) => {
            // 브라우저 달력에서 확정한 날짜만 입력값으로 보낸다.
            return onChange(event.target.value);
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minWidth: 0,
            minHeight: 50,
            padding: 14,
            border: `1px solid ${loginTheme.border}`,
            borderRadius: 14,
            backgroundColor: colors.surface,
            color: loginTheme.text,
            fontFamily: 'inherit',
            fontSize: 15,
            colorScheme: 'light',
          }}
        />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="생년월일 선택"
            accessibilityState={{ disabled, expanded: open }}
            disabled={disabled}
            onPress={() => {
              // 모바일 기본 생일 선택기를 연다.
              return setOpen(true);
            }}
            style={[
              styles.input,
              styles.progressHeading,
              disabled && styles.disabled,
            ]}
          >
            <Text style={{ color: value ? loginTheme.text : loginTheme.muted }}>
              {value || '생일 선택 (선택 사항)'}
            </Text>
            <Ionicons
              name="calendar-outline"
              size={19}
              color={loginTheme.secondary}
            />
          </Pressable>
          {open && !disabled ? (
            <DateTimePicker
              value={new Date(`${value || '1995-01-01'}T12:00:00`)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              maximumDate={new Date()}
              minimumDate={new Date('1900-01-01T12:00:00')}
              onChange={(event, date) => {
                // Android는 선택 즉시 닫고 iOS는 완료 버튼까지 달력을 유지한다.
                return void (setOpen(
                  Platform.OS === 'ios' && event.type !== 'dismissed',
                ),
                event.type === 'set' && date
                  ? onChange(calendarDate(date))
                  : undefined);
              }}
            />
          ) : null}
          {open && !disabled && Platform.OS === 'ios' ? (
            <LoginButton
              label="날짜 선택 완료"
              onPress={() => {
                // 확정한 날짜를 유지하며 펼쳐진 달력만 닫는다.
                return setOpen(false);
              }}
            />
          ) : null}
        </>
      )}
      {value ? (
        <LoginButton
          label="생년월일 지우기"
          disabled={disabled}
          onPress={() => {
            // 선택한 생일을 지워도 다른 프로필 입력은 유지한다.
            return void (setOpen(false), onChange(''));
          }}
        />
      ) : null}
    </View>
  );
}
