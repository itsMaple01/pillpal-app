import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { theme } from '@/lib/theme';
import type { TutorialStep } from '@/lib/tutorial';

interface Props {
  visible: boolean;
  steps: TutorialStep[];
  index: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function TutorialOverlay({ visible, steps, index, onNext, onSkip }: Props) {
  const step = steps[index];
  if (!step) return null;
  const last = index >= steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.kicker}>Quick tour · {index + 1}/{steps.length}</Text>
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.body}>{step.body}</Text>
          <View style={s.actions}>
            <TouchableOpacity onPress={onSkip}>
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
    backgroundColor: 'rgba(20,40,28,0.72)',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 22,
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
