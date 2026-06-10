import { Image, View, StyleSheet, type ViewStyle } from 'react-native';

const logoTile = require('@/assets/gabayra-logo.png');
const logoTransparent = require('@/assets/gabayra-logo-transparent.png');

interface Props {
  size?: number;
  style?: ViewStyle;
  variant?: 'tile' | 'transparent';
}

export default function AppLogo({ size = 44, style, variant = 'tile' }: Props) {
  if (variant === 'transparent') {
    return (
      <Image
        source={logoTransparent}
        style={[{ width: size, height: size }, style]}
        resizeMode="contain"
      />
    );
  }

  const radius = Math.round(size * 0.22);
  const inner = Math.round(size * 0.72);
  const padTop = Math.round(size * 0.1);
  const padBottom = Math.round(size * 0.04);
  return (
    <View style={[s.wrap, { width: size, height: size, borderRadius: radius }, style]}>
      <Image
        source={logoTile}
        style={{ width: inner, height: inner, marginTop: padTop, marginBottom: padBottom }}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
