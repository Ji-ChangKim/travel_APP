import Text from '@/components/AppText';
import { colors, typography, radii } from '@/constants/theme';
import DesignButton from '@/components/DesignButton';
import DesignInput from '@/components/DesignInput';
import { Image, StyleSheet, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { FormAnchor, focusFormInput, useFormScope } from './InputFeedback';
import { getServerMediaUrl, foundationQueryKey } from '@wherego/api-client';
import { serverOptions } from './service';

// 폼과 읽기 화면에 공통 버튼을 표시한다.
export function Action({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  variant = 'secondary',
  selected = false,
  allowWhileLocked = false,
  loading = false,
  size,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  selected?: boolean;
  allowWhileLocked?: boolean;
  loading?: boolean;
  size?: 'default' | 'chip' | 'icon' | 'day';
}) {
  // 처리 중 중복 클릭을 실제 disabled 상태로 차단한다.
  return (
    <DesignButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={
        (useFormScope().locked && !allowWhileLocked && !loading) || disabled
      }
      variant={variant}
      selected={selected}
      loading={loading}
      size={size}
    />
  );
}
// 접근성 이름을 가진 입력 필드 하나를 표시한다.
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  placeholder,
  inputMode = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric';
}) {
  // 화면의 라벨과 테스트·스크린리더 이름을 일치시킨다.
  return (
    <BoundField
      label={label}
      value={value}
      onChange={onChange}
      multiline={multiline}
      placeholder={placeholder}
      inputMode={inputMode}
      disabled={useFormScope().locked || disabled}
      input={useRef<TextInput>(null)}
    />
  );
}

// 입력값과 오류 표시를 같은 초점 대상에 연결한다.
function BoundField({
  label,
  value,
  onChange,
  multiline,
  disabled,
  input,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline: boolean;
  disabled: boolean;
  input: React.RefObject<TextInput | null>;
  placeholder?: string;
  inputMode: 'text' | 'numeric';
}) {
  // 저장 중에는 실제 입력창도 편집할 수 없게 한다.
  return (
    <FormAnchor
      name={label}
      focus={() => {
        /* 오류 이동 시에만 입력 참조를 읽는다. */ return focusFormInput(input);
      }}
    >
      <Text style={styles.label}>{label}</Text>
      <DesignInput
        inputRef={input}
        editable={!disabled}
        accessibilityState={{ disabled }}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        inputMode={inputMode}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && { minHeight: 90 }]}
        autoCapitalize="none"
      />
    </FormAnchor>
  );
}
// 서버 권한이 적용된 사진 하나를 표시한다.
export function ServerPhoto({
  userId,
  tripId,
  mediaId,
}: {
  userId: string;
  tripId: string;
  mediaId: string;
}) {
  // 계정·여행·사진이 바뀌면 이전 원본의 표시 실패 상태도 분리한다.
  return (
    <PrivatePhoto
      key={`${userId}:${tripId}:${mediaId}`}
      userId={userId}
      tripId={tripId}
      mediaId={mediaId}
    />
  );
}

// 원본 조회와 이미지 다운로드 실패를 같은 화면에서 복구한다.
function PrivatePhoto({
  userId,
  tripId,
  mediaId,
}: {
  userId: string;
  tripId: string;
  mediaId: string;
}) {
  // 사진별 다운로드 상태와 접근 주소 조회를 표시 컴포넌트에 전달한다.
  return (
    <PhotoView
      attempt={useState(0)}
      failedUrl={useState('')}
      query={usePrivatePhotoQuery(userId, tripId, mediaId)}
    />
  );
}

// 현재 계정과 여행에 속한 사진 접근 주소 하나를 조회한다.
function usePrivatePhotoQuery(userId: string, tripId: string, mediaId: string) {
  // 서명 URL은 60초 접근 권한이며 자동 재조회한다.
  return useQuery({
    queryKey: foundationQueryKey(userId, `media:${tripId}`, mediaId),
    queryFn: () => {
      // 현재 계정의 세션으로만 파일을 조회한다.
      return serverOptions(userId).then((options) => {
        // 파일 ID를 서버에 확인받는다.
        return getServerMediaUrl(options, tripId, mediaId);
      });
    },
    staleTime: 30000,
    refetchInterval: 45000,
    retry: 1,
  });
}

// 실제 이미지의 다운로드 상태와 한 장의 재시도 행동을 표시한다.
function PhotoView({
  attempt: [attempt, setAttempt],
  failedUrl: [failedUrl, setFailedUrl],
  query,
}: {
  attempt: [number, Dispatch<SetStateAction<number>>];
  failedUrl: [string, Dispatch<SetStateAction<string>>];
  query: ReturnType<typeof usePrivatePhotoQuery>;
}) {
  // 실패는 빈 성공 이미지 대신 명시적으로 안내한다.
  return query.data && failedUrl !== query.data ? (
    <Image
      key={`${attempt}:${query.data}`}
      source={{ uri: query.data }}
      style={{ height: 180, width: '100%', borderRadius: 14 }}
      accessibilityLabel="여행에 등록한 사진"
      onError={() => {
        // 접근 주소 조회 성공과 실제 이미지 다운로드 성공을 구분한다.
        return setFailedUrl(query.data || '');
      }}
    />
  ) : (
    <View style={{ gap: 8 }}>
      <Text
        accessibilityRole={query.isError || failedUrl ? 'alert' : undefined}
      >
        {query.isError || failedUrl
          ? '사진을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
          : '사진을 불러오는 중입니다.'}
      </Text>
      {(query.isError || failedUrl) && (
        <Action
          label={
            query.isFetching ? '사진을 다시 불러오는 중…' : '사진 다시 불러오기'
          }
          disabled={query.isFetching}
          onPress={() => {
            // 같은 URL도 새 이미지로 요청하고 최신 접근 주소를 함께 확인한다.
            return void (setFailedUrl(''),
            setAttempt((previous) => {
              // 다른 사진의 상태와 분리해 이번 이미지 요청만 교체한다.
              return previous + 1;
            }),
            query.refetch());
          }}
        />
      )}
    </View>
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 20,
    gap: 16,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    fontSize: typography.headlineLarge.size,
    lineHeight: typography.headlineLarge.lineHeight,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: typography.headlineSmall.size,
    lineHeight: typography.headlineSmall.lineHeight,
    fontWeight: '600',
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  button: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.selectedSurface,
    borderColor: colors.border,
  },
  quietButton: { backgroundColor: 'transparent', borderColor: 'transparent' },
  buttonText: { fontWeight: '600', color: colors.text },
  primaryButtonText: { color: colors.textLight },
  dangerButtonText: { color: colors.danger },
  label: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.input,
    padding: 12,
    fontSize: typography.bodyMedium.size,
    lineHeight: typography.bodyMedium.lineHeight,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  error: { color: colors.danger, lineHeight: 22 },
  badge: {
    padding: 8,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    color: colors.muted,
  },
  modal: { flex: 1, backgroundColor: colors.background },
});
