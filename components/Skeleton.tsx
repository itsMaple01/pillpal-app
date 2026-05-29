import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle } from 'react-native';
import { theme } from '@/lib/theme';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        s.box,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonMedCard() {
  return (
    <View style={s.card}>
      <SkeletonBox height={18} width="55%" />
      <SkeletonBox height={12} width="80%" style={{ marginTop: 10 }} />
      <SkeletonBox height={12} width="40%" style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonPatientRow() {
  return (
    <View style={[s.card, s.row]}>
      <SkeletonBox width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox height={16} width="50%" />
        <SkeletonBox height={12} width="70%" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: theme.border },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
