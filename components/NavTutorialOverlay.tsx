import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
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
  onSkip: () => void;
}

export default function NavTutorialOverlay({
  visible,
  steps,
  index,
  tabs,
  activeTab,
  onNext,
  onSkip,
}: Props) {
  const step = steps[index];
  if (!step) return null;
  const last = index >= steps.length - 1;
  const highlightKey = step.tab ?? activeTab;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.tabBar}>
          {tabs.map(tab => {
            const active = tab.key === highlightKey;
            return (
              <View key={tab.key} style={[s.tabSlot, active && s.tabSlotActive]}>
                <AppIcon name={tab.icon} size={26} color={active ? theme.green : theme.textMuted} />
                {active && <View style={s.indicator} />}
                {!!tab.label && (
                  <Text style={[s.tabLabel, active && s.tabLabelActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={s.card}>
          <Text style={s.kicker}>Quick tour · {index + 1}/{steps.length}</Text>
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.body}>{step.body}</Text>
          <View style={s.actions}>
            <TouchableOpacity onPress={onSkip} hitSlop={12}>
              <Text style={s.skip}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={onNext}>
              <Text style={s.nextText}>{last ? 'Got it' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,40,28,0.78)',
    justifyContent: 'flex-end',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: theme.border,
    borderBottomWidth: 0,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  tabSlotActive: {
    backgroundColor: theme.greenLight,
  },
  indicator: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.green,
    marginTop: 4,
  },
  tabLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  tabLabelActive: { color: theme.green, fontWeight: '700' },
  card: {
    backgroundColor: theme.surface,
    padding: 22,
    paddingBottom: 36,
  },
  kicker: { fontSize: 12, fontWeight: '700', color: theme.textMuted, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 10 },
  body: { fontSize: 16, lineHeight: 24, color: theme.textSecondary, marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontSize: 15, fontWeight: '600', color: theme.textMuted },
  nextBtn: {
    backgroundColor: theme.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
