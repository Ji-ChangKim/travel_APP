import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as s } from '../workspace/homeStyles';
import { currentLocationUrl } from './permissionModel';
import { openPermissionGuide } from './permissionService';
import { useCurrentLocation } from './useCurrentLocation';
import LocationFeedback from './LocationFeedback';

// 네이티브 홈에서 권한 재설정과 실제 현재 위치 지도를 제공한다.
export default function PermissionTools() {
  // 웹 홈에는 운영체제 권한 도구를 표시하지 않는다.
  return Platform.OS === 'web' ? null : <NativeTools />;
}

// 일정 편집과 같은 일회 위치 서비스로 외부 지도를 연다.
function NativeTools() {
  // 같은 위치 결과로 외부 지도를 반복 실행하지 않는다.
  const current = useCurrentLocation(true);
  const opened = useRef<typeof current.result>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    // 숨겨진 화면이나 이전 요청의 결과는 외부 앱을 열지 않는다.
    const result = current.result;
    const url =
      result?.status === 'located'
        ? currentLocationUrl(result.fix.coordinate)
        : undefined;
    return !url || opened.current === result || !current.isActive()
      ? undefined
      : void ((opened.current = result),
        Linking.openURL(url).catch(() => {
          // 외부 지도 실패도 현재 요청과 화면에만 안내한다.
          return opened.current === result && current.isActive()
            ? setError('지도를 열지 못했어요. 다시 시도해 주세요.')
            : undefined;
        }));
  });
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="현재 위치 지도에서 보기"
        disabled={current.busy}
        accessibilityState={{ disabled: current.busy }}
        style={s.linkRow}
        onPress={() => {
          // 위치는 보관하지 않고 이번 지도 열기에서만 사용한다.
          return void ((opened.current = undefined),
          setError(''),
          current.locate());
        }}
      >
        <Ionicons name="locate-outline" size={20} color={colors.muted} />
        <Text style={[s.linkText, s.linkCopy]} numberOfLines={1}>
          {current.busy ? '현재 위치 확인 중…' : '현재 위치 지도에서 보기'}
        </Text>
      </Pressable>
      <LocationFeedback
        manual={false}
        result={current.result}
        onSettings={current.settings}
        disabled={current.busy}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.selected, padding: 12 }}
        >
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="앱 권한 설정"
        style={s.linkRow}
        onPress={openPermissionGuide}
      >
        <Ionicons name="options-outline" size={20} color={colors.muted} />
        <Text style={[s.linkText, s.linkCopy]} numberOfLines={1}>
          앱 권한 설정
        </Text>
      </Pressable>
    </>
  );
}
