import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import { colors } from '@/constants/theme';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeStyles as s } from './homeStyles';

type MenuState = [boolean, Dispatch<SetStateAction<boolean>>];
type HeaderProps = { signedIn: boolean; ready: boolean };

// 홈 상단의 브랜드와 실제 여행 메뉴를 한 줄에 배치한다.
export default function HomeHeader(props: HeaderProps) {
  // 메뉴의 열림 상태는 이 헤더 안에서만 관리한다.
  return <HeaderContent {...props} menu={useState(false)} />;
}

// 로고는 왼쪽에, 로그인과 원형 메뉴 버튼은 오른쪽에 표시한다.
function HeaderContent({
  signedIn,
  ready,
  menu: [open, setOpen],
}: HeaderProps & { menu: MenuState }) {
  // 기존 로그인 경로를 유지하면서 메뉴 열기와 닫기만 연결한다.
  return (
    <>
      <View style={s.topBar}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="TripPrint"
          style={s.brandHeader}
        >
          <View style={s.brandSymbolFrame}>
            <Image
              accessible={false}
              source={require('../../../assets/brand/tripprint-v1/TripPrint_symbol-coral-clean_1024x1024.png')}
              style={s.brandSymbol}
            />
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={s.brandTitle}>
            Trip<Text style={s.brandAccent}>Print</Text>
          </Text>
        </View>
        <View style={s.topRightActions}>
          {!signedIn && ready && (
            <Link href="/login" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="로그인"
                style={s.login}
              >
                <Text style={s.linkText}>로그인</Text>
              </Pressable>
            </Link>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메뉴 열기"
            accessibilityState={{ expanded: open, disabled: !ready }}
            disabled={!ready}
            style={s.iconButton}
            onPress={() => {
              // 인증 초기화 후 홈 메뉴를 펼친다.
              return setOpen(true);
            }}
          >
            <Ionicons name="menu-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <HeaderMenu
        visible={open}
        onClose={() => {
          // 닫기·뒤로가기·메뉴 이동 시 열린 메뉴를 정리한다.
          return setOpen(false);
        }}
      />
    </>
  );
}

// 화면 오른쪽 위에 기존 여행 기능으로 이동하는 메뉴를 제공한다.
function HeaderMenu({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  // 바깥 영역 또는 Android 뒤로가기로도 메뉴를 닫을 수 있다.
  return (
    <ActionSheet title="여행 메뉴" visible={visible} onClose={onClose}>
      <MenuLink
        label="초대 링크로 참여"
        icon="people-outline"
        href="/invite"
        onClose={onClose}
      />
      <MenuLink
        label="장소 가져오기"
        icon="map-outline"
        href="/import-place"
        onClose={onClose}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="메뉴 닫기"
        style={s.menuItem}
        onPress={onClose}
      >
        <Text style={s.linkText}>닫기</Text>
      </Pressable>
    </ActionSheet>
  );
}

// 선택한 기존 화면으로 이동하면서 메뉴만 닫는다.
function MenuLink({
  label,
  icon,
  href,
  onClose,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  onClose: () => void;
}) {
  // 실제 라우팅은 Link에 맡기고 버튼에는 이름과 닫기 동작을 제공한다.
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={s.menuItem}
        onPress={onClose}
      >
        <Ionicons name={icon} size={20} color={colors.muted} />
        <Text style={[s.linkText, s.menuLabel]}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </Link>
  );
}
