import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectNavigationSource } from '../../scripts/navigation-guard/inspect.mjs';
import { inspectRoutePolicies } from '../../scripts/check-navigation-boundaries.mjs';

function violations(text, file = 'features/example/ExampleScreen.tsx') {
  // 제품 파일을 바꾸지 않고 규칙을 위반한 후보 구문만 검사한다.
  return inspectNavigationSource(file, text).findings;
}

test('별칭·네임스페이스의 style과 JSX spread도 차단한다', () => {
  for (const text of [
    `import H from '@/components/ScreenHeader'; const Page = () => <H title="여행" style={{height: 20}} />`,
    `import * as UI from '@/components'; const Page = () => <UI.HomeHeader {...props} />`,
    `import { ScreenTitle as T } from '@/components'; const Page = () => <T fontFamily="bad">여행</T>`,
  ])
    assert.ok(violations(text).length > 0);
});

test('헤더 전체·우측 JSX와 제목 글꼴을 임의로 전달할 수 없다', () => {
  for (const text of [
    `type Props = {header?: ReactNode}`,
    `type Props = {right?: React.ReactElement}`,
    `const Page = () => <ScreenHeader right={<Text>별도 디자인</Text>} />`,
    `const Page = () => <ScreenTitle style={{fontSize: 12}}>여행</ScreenTitle>`,
  ])
    assert.ok(violations(text).length > 0);
});

test('GNB 중복·네이티브 스타일 덮어쓰기와 장식용 래퍼를 막는다', () => {
  for (const text of [
    `import Nav from '@/components/GlobalNavigation'; const Page = () => <Nav />`,
    `const options = {headerShown: true, headerStyle: {height: 20}}`,
    `const Page = () => <View style={s.header}><ScreenHeader title="여행" /></View>`,
    `const s = StyleSheet.create({headerTitle: {fontSize: 15}})`,
    `function CustomHeader() {return <Text>복제 제목</Text>}`,
    `const Page = () => <ScreenHeader inset={false} title="여행" />`,
    `router.setOptions({header: () => <View />})`,
  ])
    assert.ok(violations(text).length > 0);
});

test('공통 레이아웃에서 기본 헤더·탭 바를 다시 켤 수 없다', () => {
  assert.ok(
    violations('const Root = () => <Stack />', 'app/_layout.tsx').length > 0,
  );
  assert.ok(
    violations(
      'const options = {headerShown: false}; const Layout = () => <Tabs tabBar={() => <View />} />',
      'app/(tabs)/_layout.tsx',
    ).length > 0,
  );
  assert.deepEqual(
    violations(
      'const options = {headerShown: false}; const Layout = () => <Tabs tabBar={() => null} />',
      'app/(tabs)/_layout.tsx',
    ),
    [],
  );
});

test('공통 헤더가 페이지 스타일에 다시 의존할 수 없다', () => {
  assert.ok(
    violations(
      `import {styles} from '@/features/workspace/homeStyles'`,
      'components/HomeHeader.tsx',
    ).length > 0,
  );
});

test('본문 카드 제목과 승인된 행동 조립은 허용한다', () => {
  assert.deepEqual(
    violations(
      `function MyHeader(){return <ScreenHeader title="여행" actions={[{icon:'search', label:'여행 검색', onPress: search}]} />}`,
    ),
    [],
  );
  assert.deepEqual(
    violations(
      `const s = StyleSheet.create({header: {gap: 8}})`,
      'features/workspace/FlightCard.tsx',
    ),
    [],
  );
  assert.deepEqual(
    violations(
      `const Page = () => <ScreenTitle grow>긴 여행 이름</ScreenTitle>`,
    ),
    [],
  );
  assert.deepEqual(
    violations(
      `const options = {headerShown: false}; const Root = () => <GlobalNavigation />`,
      'app/_layout.tsx',
    ),
    [],
  );
});

const policy = {
  file: '(tabs)/my.tsx',
  path: '/my',
  header: 'root',
  title: 'MY',
  gnb: true,
};
test('신규·삭제 라우트의 정책 누락과 오래된 정책을 잡는다', () => {
  assert.ok(inspectRoutePolicies(['new-page.tsx'], [], () => true).length > 0);
  assert.ok(inspectRoutePolicies([], [policy], () => true).length > 0);
});

test('공통 헤더 미연결·경로 불일치·잘못된 GNB와 생략 예외를 잡는다', () => {
  for (const candidate of [
    { ...policy, path: '/wrong' },
    { ...policy, gnb: false },
    { ...policy, header: 'launch' },
    { ...policy, header: 'custom' },
  ])
    assert.ok(
      inspectRoutePolicies([policy.file], [candidate], () => true).length > 0,
    );
  assert.ok(
    inspectRoutePolicies([policy.file], [policy], () => false).length > 0,
  );
  assert.ok(
    inspectRoutePolicies([policy.file], [policy, policy], () => true).length >
      0,
  );
  assert.deepEqual(
    inspectRoutePolicies([policy.file], [policy], () => true),
    [],
  );
});
