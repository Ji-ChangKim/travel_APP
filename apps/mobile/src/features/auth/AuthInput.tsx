import Text from '@/components/AppText';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, View } from 'react-native';
import DesignInput from '@/components/DesignInput';
import { Ionicons } from '@expo/vector-icons';
import { loginStyles as styles, loginTheme } from './loginStyles';

type InputProps = {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  secret?: boolean;
  email?: boolean;
  newPassword?: boolean;
  maxLength?: number;
  disabled: boolean;
  onChange: (value: string) => void;
};

// 이메일·닉네임·비밀번호 입력의 색상과 간격을 인증 화면에 맞춘다.
export default function AuthInput(props: InputProps) {
  // 비밀번호 표시 여부는 입력란이 사라질 때 함께 초기화한다.
  return <InputField {...props} visibility={useState(false)} />;
}

// 비밀번호 숨김과 자동 완성을 유지한 입력란 하나를 표시한다.
function InputField({
  label,
  value,
  placeholder,
  hint,
  secret = false,
  email = false,
  newPassword = false,
  maxLength,
  disabled,
  onChange,
  visibility: [visible, setVisible],
}: InputProps & { visibility: [boolean, Dispatch<SetStateAction<boolean>>] }) {
  // 비밀번호를 별도 저장하지 않고 화면 표시 방식만 전환한다.
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <DesignInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={loginTheme.muted}
          secureTextEntry={secret && !visible}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={email ? 'email-address' : 'default'}
          autoComplete={
            email
              ? 'email'
              : secret
                ? newPassword
                  ? 'new-password'
                  : 'current-password'
                : 'nickname'
          }
          maxLength={maxLength}
          editable={!disabled}
          style={[styles.input, styles.growInput]}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} ${visible ? '숨기기' : '보기'}`}
            accessibilityState={{ disabled, expanded: visible }}
            disabled={disabled}
            onPress={() => {
              // 입력값을 바꾸지 않고 비밀번호 표시 여부만 바꾼다.
              return setVisible(!visible);
            }}
            style={styles.passwordToggle}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={21}
              color={loginTheme.secondary}
            />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}
