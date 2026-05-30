import { Image, View, StyleSheet, type ViewStyle } from 'react-native';

const logoSource = require('@/assets/gabayra-logo.png');

interface Props {
  size?: number;
  style?: ViewStyle;
}

/** Official GabayRa logo on a white tile. Leave top padding so the figure head is not clipped. */
export default function AppLogo({ size = 44, style }: Props) {
  const radius = Math.round(size * 0.22);
  const inner = Math.round(size * 0.72);
  const padTop = Math.round(size * 0.1);
  const padBottom = Math.round(size * 0.04);
  return (
    <View style={[s.wrap, { width: size, height: size, borderRadius: radius }, style]}>
      <Image
        source={logoSource}
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
