import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { useEffect, useRef } from 'react';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';

const GREEN = '#2d7a3a';
const GREEN_LIGHT = '#e8f5e9';

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
      <Animated.View style={[s.backdrop, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />

        <Animated.View style={[s.card, { opacity, transform: [{ scale }] }]}>
          <View style={s.accentBar} />
          <View style={s.cardInner}>
            <View style={s.topRow}>
              <AppLogo size={44} />
              <View style={s.topText}>
                <Text style={s.brand}>GabayRa</Text>
                <Text style={s.title}>Sign out?</Text>
                <Text style={s.sub}>You will return to the login screen.</Text>
              </View>
            </View>

            <View style={s.actions}>
              <TouchableOpacity style={s.btnCancel} onPress={onCancel} activeOpacity={0.75}>
                <Text style={s.btnCancelText}>Stay signed in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnLogout} onPress={onConfirm} activeOpacity={0.8}>
                <Text style={s.btnLogoutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#fff',
    borderRadius: 22,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#0d2815',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  accentBar: {
    height: 5,
    backgroundColor: GREEN,
  },
  cardInner: {
    paddingTop: 20,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 22,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(45, 122, 58, 0.2)',
  },
  iconEmoji: { fontSize: 24 },
  topText: { flex: 1, paddingTop: 2 },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#142018',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: '#6a736e',
    marginTop: 8,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#dfe8df',
    backgroundColor: '#f7faf7',
    alignItems: 'center',
  },
  btnCancelText: {
    fontSize: 14,
    color: '#3d4a40',
    fontWeight: '700',
  },
  btnLogout: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    shadowColor: GREEN,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnLogoutText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '800',
  },
});