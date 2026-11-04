// 공통 헤더의 공개 계약은 페이지에서 모양을 전달하지 못하도록 제한한다.
export const componentProps = {
  ScreenHeader: [
    'title',
    'backLabel',
    'onBack',
    'disabled',
    'actions',
    'inset',
    'inlineTitle',
  ],
  ScreenTitle: ['children', 'grow'],
  HeaderAction: ['key', 'icon', 'label', 'onPress', 'disabled', 'expanded'],
  HeaderActions: ['actions', 'disabled'],
  HomeHeader: ['signedIn', 'ready', 'variant'],
  RecoveryHeader: ['path', 'onBack'],
  GlobalNavigation: [],
};

export const commonFiles = new Set([
  ...Object.keys(componentProps).map((name) => `components/${name}.tsx`),
  ...Object.keys(componentProps).map(
    (name) => `components/navigation/${name}.tsx`,
  ),
  'components/homeHeaderStyles.ts',
  'components/navigation/homeHeaderStyles.ts',
]);

// 본문 카드·섹션의 기존 header 이름은 상단바 복제와 구분한다.
export const sectionHeaderFiles = new Set([
  'features/workspace/FlightCard.tsx',
  'features/workspace/planning/ui/FlightCard.tsx',
  'features/workspace/FlightLookupCandidateCard.tsx',
  'features/workspace/planning/ui/FlightLookupCandidateCard.tsx',
  'features/workspace/HomeGuide.tsx',
  'features/workspace/home/ui/HomeGuide.tsx',
  'features/workspace/homeExploreStyles.ts',
  'features/workspace/home/styles/homeExploreStyles.ts',
  'features/workspace/HomeRecommendation.tsx',
  'features/workspace/home/ui/HomeRecommendation.tsx',
  'components/DesignButton.tsx',
  'components/ui/DesignButton.tsx',
]);

export const rootLayout = 'app/_layout.tsx';
export const structuralRoutes = new Set([
  '_layout.tsx',
  '(tabs)/_layout.tsx',
  '+native-intent.tsx',
]);
export const headerKinds = new Set([
  'launch',
  'entry',
  'brand',
  'root',
  'task',
  'personal',
  'inline',
]);
export const nativeOverrides = new Set([
  'header',
  'headerStyle',
  'headerTitleStyle',
  'headerLeft',
  'headerRight',
  'headerTitle',
  'tabBarStyle',
  'tabBarButton',
]);
