import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
  Animated,
} from 'react-native';
import AppIcon from '@/components/AppIcon';
import type { ComponentProps } from 'react';
import { theme } from '@/lib/theme';

type IonName = ComponentProps<typeof AppIcon>['name'];

export interface TabDef<T extends string> {
  key: T;
  icon: IonName;
  label?: string;
}

interface Props<T extends string> {
  tabs: TabDef<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  children: ReactNode[];
  bottomInset?: number;
  iconOnly?: boolean;
}

export default function SwipeTabHost<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  children,
  bottomInset = 10,
  iconOnly = true,
}: Props<T>) {
  const width = Dimensions.get('window').width;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const suppressEndUntil = useRef(0);
  const programmaticRef = useRef(false);
  const pagerIndexRef = useRef(Math.max(0, tabs.findIndex(t => t.key === activeTab)));

  const [index, setIndex] = useState(pagerIndexRef.current);

  const tabCount = tabs.length;
  const tabWidth = width / tabCount;
  const barWidth = tabWidth * 0.55;

  const scrollToIndex = useCallback((i: number, animated: boolean) => {
    programmaticRef.current = true;
    suppressEndUntil.current = Date.now() + 520;
    pagerIndexRef.current = i;
    scrollRef.current?.scrollTo({ x: i * width, animated });
    setTimeout(() => {
      programmaticRef.current = false;
    }, animated ? 520 : 50);
  }, [width]);

  const goTo = useCallback((i: number, tab: T) => {
    if (i < 0 || i >= tabs.length) return;
    if (i === pagerIndexRef.current && tab === activeTab) return;
    setIndex(i);
    pagerIndexRef.current = i;
    onTabChange(tab);
    scrollToIndex(i, true);
  }, [activeTab, onTabChange, scrollToIndex, tabs.length]);

  // Sync pager when parent changes tab (menu shortcuts, tutorial)
  useEffect(() => {
    const i = tabs.findIndex(t => t.key === activeTab);
    if (i < 0 || i === pagerIndexRef.current) return;
    setIndex(i);
    scrollToIndex(i, false);
  }, [activeTab, scrollToIndex, tabs]);

  const settleScroll = (x: number) => {
    if (programmaticRef.current || Date.now() < suppressEndUntil.current) return;
    const i = Math.round(x / width);
    if (i < 0 || i >= tabs.length) return;
    pagerIndexRef.current = i;
    setIndex(i);
    if (tabs[i].key !== activeTab) {
      onTabChange(tabs[i].key);
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    settleScroll(e.nativeEvent.contentOffset.x);
  };

  // Stretching indicator: widens between tabs while swiping
  const stretchInput: number[] = [];
  const stretchLeft: number[] = [];
  const stretchWidth: number[] = [];

  for (let i = 0; i < tabCount; i++) {
    const center = i * tabWidth + tabWidth / 2;
    const left = center - barWidth / 2;
    stretchInput.push(i * width);
    stretchLeft.push(left);
    stretchWidth.push(barWidth);

    if (i < tabCount - 1) {
      const mid = (i + 0.5) * width;
      const spanLeft = center - tabWidth / 2;
      stretchInput.push(mid);
      stretchLeft.push(spanLeft);
      stretchWidth.push(tabWidth);
    }
  }

  const indicatorLeft = scrollX.interpolate({
    inputRange: stretchInput,
    outputRange: stretchLeft,
    extrapolate: 'clamp',
  });

  const indicatorWidth = scrollX.interpolate({
    inputRange: stretchInput,
    outputRange: stretchWidth,
    extrapolate: 'clamp',
  });

  return (
    <View style={s.root}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        style={s.pager}
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
      >
        {children.map((child, i) => (
          <View key={tabs[i]?.key ?? i} style={{ width, flex: 1 }}>
            {child}
          </View>
        ))}
      </Animated.ScrollView>

      <View style={[s.bar, { paddingBottom: bottomInset }]}>
        <Animated.View
          style={[
            s.indicator,
            { width: indicatorWidth, left: indicatorLeft },
          ]}
        />
        {tabs.map((tab, i) => {
          const active = tab.key === activeTab || i === index;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabBtn}
              onPress={() => goTo(i, tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label ?? tab.key}
            >
              <AppIcon name={tab.icon} size={26} color={active ? theme.green : theme.textMuted} />
              {!iconOnly && tab.label && (
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.green,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 8,
  },
  tabLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  tabLabelActive: { color: theme.green, fontWeight: '700' },
});
