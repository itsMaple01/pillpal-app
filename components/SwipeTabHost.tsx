import { useRef, useState, useCallback, ReactNode } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
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
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(() => Math.max(0, tabs.findIndex(t => t.key === activeTab)));

  const goTo = useCallback((i: number, tab: T) => {
    setIndex(i);
    onTabChange(tab);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  }, [width, onTabChange]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i >= 0 && i < tabs.length && tabs[i].key !== activeTab) {
      setIndex(i);
      onTabChange(tabs[i].key);
    }
  };

  return (
    <View style={s.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={s.pager}
      >
        {children.map((child, i) => (
          <View key={tabs[i]?.key ?? i} style={{ width, flex: 1 }}>
            {child}
          </View>
        ))}
      </ScrollView>

      <View style={[s.bar, { paddingBottom: bottomInset }]}>
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
    paddingTop: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 6,
  },
  tabLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  tabLabelActive: { color: theme.green, fontWeight: '700' },
});
