import {
  View, Text, TouchableOpacity, StyleSheet, Modal, PanResponder, Dimensions,
} from 'react-native';
import { useMemo, useRef } from 'react';
import AppIcon from '@/components/AppIcon';
import type { ComponentProps } from 'react';
import { theme } from '@/lib/theme';
import type { NavTutorialStep } from '@/lib/tutorial';

type IonName = ComponentProps<typeof AppIcon>['name'];

export interface TabHighlight {
  key: string;
  icon: IonName;
  label?: string;
}

interface Props {
  visible: boolean;
  steps: NavTutorialStep[];
  index: number;
  tabs: TabHighlight[];
  activeTab: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const DIM = 'rgba(20,40,28,0.82)';

export default function NavTutorialOverlay({
  visible,
  steps,
  index,
  tabs,
  activeTab,
  onNext,
  onBack,
  onSkip,
}: Props) {
  const step = steps[index];
  const highlightKey = step?.tab ?? activeTab;
  const highlightIdx = tabs.findIndex(t => t.key === highlightKey);
  const first = index === 0;
  const last = index >= steps.length - 1;
  const { width: screenWidth } = Dimensions.get('window');
  const tabWidth = screenWidth / Math.max(tabs.length, 1);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dy) < 30,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) onNext();
        else if (g.dx > 40 && !first) onBack();
      },
    }),
  ).current;

  const arrowLeft = useMemo(() => {
    if (highlightIdx < 0) return '50%';
    const pct = ((highlightIdx + 0.5) / tabs.length) * 100;
    return `${pct}%`;
  }, [highlightIdx, tabs.length]);

  if (!step) return null;

  const highlightLeft = highlightIdx >= 0 ? highlightIdx * tabWidth + 4 : 0;
  const highlightWidth = tabWidth - 8;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.root} {...pan.panHandlers}>
        {/* Dim everything above the tab bar */}
        <View style={s.upperDim} />

        {/* Tab bar row: inactive slots dimmed, active slot cut out (bright) */}
        <View style={s.tabBarRow}>
          {tabs.map((tab, idx) => {
            const active = tab.key === highlightKey;
            return (
              <View key={tab.key} style={[s.tabSlot, { width: tabWidth }]}>
                {!active && <View style={s.tabDim} pointerEvents="none" />}
                <View style={[s.tabContent, active && s.tabContentActive]}>
                  {active && (
                    <View style={s.spotlightRing}>
                      <AppIcon name="chevron-up" size={14} color={theme.green} />
                    </View>
                  )}
                  <AppIcon
                    name={tab.icon}
                    size={26}
                    color={active ? theme.green : theme.textMuted}
                  />
                  {!!tab.label && (
                    <Text style={[s.tabLabel, active && s.tabLabelActive]} numberOfLines={1}>
                      {tab.label}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Side dim strips flanking the spotlight tab (covers tab bar margins) */}
        {highlightIdx >= 0 && (
          <>
            {highlightLeft > 0 && (
              <View style={[s.tabSideDim, { left: 0, width: highlightLeft, bottom: 0 }]} pointerEvents="none" />
            )}
            <View
              style={[s.tabSideDim, {
                left: highlightLeft + highlightWidth,
                width: screenWidth - highlightLeft - highlightWidth,
                bottom: 0,
              }]}
              pointerEvents="none"
            />
          </>
        )}

        <View style={[s.arrowDown, { left: arrowLeft as `${number}%` }]}>
          <AppIcon name="arrow-down" size={22} color={theme.green} />
        </View>

        <View style={s.card}>
          <Text style={s.kicker}>Quick tour · {index + 1}/{steps.length}</Text>
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.body}>{step.body}</Text>
          <Text style={s.swipeHint}>Swipe left for next · Swipe right to go back</Text>
          <View style={s.actions}>
            <TouchableOpacity onPress={onSkip} hitSlop={12}>
              <Text style={s.skip}>Skip</Text>
            </TouchableOpacity>
            <View style={s.navBtns}>
              {!first && (
                <TouchableOpacity style={s.backBtn} onPress={onBack}>
                  <AppIcon name="arrow-back" size={18} color={theme.green} />
                  <Text style={s.backText}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.nextBtn} onPress={onNext}>
                <Text style={s.nextText}>{last ? 'Got it' : 'Next'}</Text>
                {!last && <AppIcon name="arrow-forward" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const TAB_BAR_H = 72;

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  upperDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIM,
    bottom: TAB_BAR_H + 220,
  },
  tabBarRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    borderBottomWidth: 0,
    minHeight: TAB_BAR_H,
    zIndex: 2,
  },
  tabSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
  },
  tabDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIM,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  tabContent: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    zIndex: 1,
  },
  tabContentActive: {
    backgroundColor: theme.greenLight,
    borderWidth: 2,
    borderColor: theme.green,
    shadowColor: theme.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  spotlightRing: { marginBottom: 2 },
  tabSideDim: {
    position: 'absolute',
    height: TAB_BAR_H,
    backgroundColor: DIM,
    zIndex: 1,
  },
  tabLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  tabLabelActive: { color: theme.green, fontWeight: '700' },
  arrowDown: {
    position: 'absolute',
    bottom: TAB_BAR_H + 200,
    marginLeft: -11,
    zIndex: 3,
  },
  card: {
    backgroundColor: theme.surface,
    padding: 22,
    paddingBottom: 36,
    zIndex: 2,
  },
  kicker: { fontSize: 12, fontWeight: '700', color: theme.textMuted, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 10 },
  body: { fontSize: 16, lineHeight: 24, color: theme.textSecondary, marginBottom: 10 },
  swipeHint: { fontSize: 12, color: theme.textMuted, marginBottom: 16, fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontSize: 15, fontWeight: '600', color: theme.textMuted },
  navBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  backText: { fontSize: 15, fontWeight: '700', color: theme.green },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.green,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
