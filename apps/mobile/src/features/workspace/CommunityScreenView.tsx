import ActionSheet from '@/components/ActionSheet';
import Text from '@/components/AppText';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '@/components/ScreenHeader';
import HomeHeader from '@/components/HomeHeader';
import { Action } from './ui';
import PublicFeedCard from './PublicFeedCard';
import PublicFeedControls from './PublicFeedControls';
import type { CommunityFeedViewProps } from './communityFeedTypes';
import { publicFeedStyles as s } from './publicFeedStyles';
import { onGnbScroll } from '@/components/navigationScroll';

// 최신 발자국 시안을 실제 공개 목록·검색·안전 행동에 연결한다.
export function renderDiscoveryContent(props: CommunityFeedViewProps) {
  // 개인 원본이나 시안 예시 배열을 목록에 섞지 않는다.
  const {
    title,
    posts,
    query,
    busy,
    block,
    setBlock,
    moderation,
    notice,
    error,
  } = props;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      {props.headerVariant === 'public-brand' ? (
        <HomeHeader
          signedIn={Boolean(props.userId)}
          ready
          variant="public-feed"
        />
      ) : (
        <ScreenHeader title={title || '여행 커뮤니티'} />
      )}
      <FlatList
        accessibilityLabel={`${title} 공개 일정`}
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        onScroll={onGnbScroll}
        scrollEventThrottle={16}
        data={posts}
        keyExtractor={(post) => {
          /* 게시물 ID로 카드 수명을 유지한다. */ return post.id;
        }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={false}
        ListHeaderComponent={<PublicFeedControls {...props} />}
        renderItem={({ item }) => {
          /* 같은 요약과 안전 행동을 전달한다. */ return (
            <PublicFeedCard {...props} post={item} />
          );
        }}
        ListFooterComponent={
          <View style={s.sheet}>
            {query.hasNextPage ? (
              <Action
                label="여행 더 보기"
                loading={query.isFetchingNextPage}
                onPress={() => {
                  /* 같은 조건의 다음 페이지를 읽는다. */ return void query.fetchNextPage();
                }}
              />
            ) : null}
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={s.meta}>
                {notice}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={s.link}>
                {error}
              </Text>
            ) : null}
          </View>
        }
      />
      <ActionSheet
        visible={Boolean(block)}
        variant="confirm"
        title="이 작성자를 차단할까요?"
        onClose={() => {
          /* 요청 중 중복 조작을 막는다. */ return busy
            ? undefined
            : setBlock(null);
        }}
      >
        <Text>‘{block?.name}’의 공개 여행을 내 목록에서 숨겨요.</Text>
        <Action
          label="차단하지 않기"
          disabled={busy}
          onPress={() => {
            /* 원래 목록으로 돌아간다. */ return setBlock(null);
          }}
        />
        <Action
          label="작성자 차단"
          variant="danger"
          disabled={busy}
          onPress={() => {
            /* 확인한 작성자만 실제 차단한다. */ return block
              ? void (moderation('/community/blocks', { userId: block.id }),
                setBlock(null))
              : undefined;
          }}
        />
      </ActionSheet>
    </SafeAreaView>
  );
}
