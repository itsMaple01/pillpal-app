import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated, useWindowDimensions,
} from 'react-native';
import { useEffect, useRef } from 'react';

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutModal({ visible, onConfirm, onCancel }: Props) {
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1,    useNativeDriver: true, damping: 18, stiffness: 260 }),
        Animated.timing(opacity, { toValue: 1,    useNativeDriver: true, duration: 180 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale,   { toValue: 0.88, useNativeDriver: true, duration: 140 }),
        Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 140 }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />

        {/* Card */}
        <Animated.View style={[s.card, { opacity, transform: [{ scale }] }]}>

          {/* Icon + text row */}
          <View style={s.topRow}>
            <View style={s.iconCircle}>
              <Text style={s.iconEmoji}>🚪</Text>
            </View>
            <View style={s.topText}>
              <Text style={s.title}>Log out of PillPal?</Text>
              <Text style={s.sub}>You will be returned to the{'\n'}login screen.</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.btnCancel} onPress={onCancel} activeOpacity={0.75}>
              <Text style={s.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnLogout} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={s.btnLogoutText}>Log out</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 16,
    gap: 0,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 18,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fce4ec',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  topText: { flex: 1, paddingTop: 2 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 14,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnCancel: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  btnCancelText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  btnLogout: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fce4ec',
    borderWidth: 1.5,
    borderColor: '#f8bbd0',
  },
  btnLogoutText: {
    fontSize: 14,
    color: '#c62828',
    fontWeight: '700',
  },
});