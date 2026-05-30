import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { useEffect, useRef } from 'react';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import { theme } from '@/lib/theme';

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutModal({ visible, onConfirm, onCancel }: Props) {
  const scale   = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 260 }),
        Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 180 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale,   { toValue: 0.92, useNativeDriver: true, duration: 140 }),
        Animated.timing(opacity, { toValue: 0, useNativeDriver: true, duration: 140 }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[s.backdrop, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />

        <Animated.View style={[s.card, { opacity, transform: [{ scale }] }]}>
          <View style={s.iconWrap}>
            <AppLogo size={56} />
          </View>

          <Text style={s.title}>Sign out?</Text>
          <Text style={s.sub}>You&apos;ll return to the welcome screen. Your data stays saved on your account.</Text>

          <View style={s.actions}>
            <TouchableOpacity style={s.btnCancel} onPress={onCancel} activeOpacity={0.75}>
              <Text style={s.btnCancelText}>Stay signed in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnLogout} onPress={onConfirm} activeOpacity={0.8}>
              <AppIcon name="log-out-outline" size={18} color="#fff" />
              <Text style={s.btnLogoutText}>Sign out</Text>
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
    backgroundColor: 'rgba(15, 40, 22, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#0d2815',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  iconWrap: { marginBottom: 14 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 10,
    lineHeight: 21,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.bg,
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: '700',
  },
  btnLogout: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLogoutText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },
});
