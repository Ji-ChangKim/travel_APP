import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { homeStyles as s } from './homeStyles';
import PermissionTools from '../permissions/PermissionTools';

// 부가 기능은 여행을 시작하는 화면을 가리지 않도록 접어서 제공한다.
export default function HomeTools() {
  // 도구를 펼치는 선택은 현재 홈 화면에만 유지한다.
  return <ToolsContent expanded={useState(false)} />;
}

// 하단 탭과 겹치지 않는 초대·장소 가져오기 도구만 표시한다.
function ToolsContent({
  expanded: [open, setOpen],
}: {
  expanded: [boolean, Dispatch<SetStateAction<boolean>>];
}) {
  // 접힌 상태에는 설명 대신 도구를 여는 버튼 하나만 제공한다.
  return (
    <View style={s.tools}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="여행 도구"
        accessibilityState={{ expanded: open }}
        style={s.sectionHeader}
        onPress={() => {
          // 한 번 누를 때마다 부가 기능의 표시 상태만 전환한다.
          return setOpen(!open);
        }}
      >
        <Text style={s.linkText}>여행 도구</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.muted}
        />
      </Pressable>
      {open && (
        <View>
          <PermissionTools />
          <ToolLink
            label="초대 링크로 참여"
            icon="people-outline"
            path="/invite"
          />
          <ToolLink
            label="Google Maps 장소 가져오기"
            icon="map-outline"
            path="/import-place"
          />
        </View>
      )}
    </View>
  );
}

// 실제 화면으로 연결되는 도구를 한 줄 버튼으로 표시한다.
function ToolLink({
  label,
  icon,
  path,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href;
}) {
  // 내비게이션 동작은 선택한 도구의 경로 하나에만 연결한다.
  return (
    <ToolButton label={label} icon={icon} path={path} router={useRouter()} />
  );
}

// 도구 버튼의 이름·아이콘·이동 동작을 함께 제공한다.
function ToolButton({
  label,
  icon,
  path,
  router,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href;
  router: ReturnType<typeof useRouter>;
}) {
  // 보조 설명을 반복하지 않고 버튼 이름으로 이동 결과를 알린다.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.linkRow}
      onPress={() => {
        // 사용자가 선택한 기존 도구 화면을 연다.
        return router.push(path);
      }}
    >
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={[s.linkText, s.linkCopy]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}
