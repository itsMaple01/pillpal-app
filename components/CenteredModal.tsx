import {
  Modal, View, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, type ViewStyle,
} from 'react-native';

const GREEN = '#2d7a3a';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  scrollable?: boolean;
  contentStyle?: ViewStyle;
}

/** Centered popup modal (matches PillPal medication / link dialogs). */
export default function CenteredModal({
  visible,
  onClose,
  children,
  maxWidth = 440,
  scrollable = true,
  contentStyle,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.card, { maxWidth }, contentStyle]}>
          <View style={styles.accent} />
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollInner}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 35, 18, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '88%',
    shadowColor: '#0d2815',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
  },
  accent: {
    height: 4,
    backgroundColor: GREEN,
  },
  scrollInner: {
    paddingBottom: 8,
  },
});
