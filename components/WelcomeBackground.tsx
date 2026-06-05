import { View, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

/** Soft background blobs for welcome + auth screens (no ring around logo). */
export default function WelcomeBackground() {
  return (
    <>
      <View style={s.blobTop} />
      <View style={s.blobMid} />
      <View style={s.blobBottom} />
    </>
  );
}

const s = StyleSheet.create({
  blobTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.greenLight,
    opacity: 0.85,
  },
  blobMid: {
    position: 'absolute',
    top: '38%',
    left: -90,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(45, 122, 58, 0.08)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: 80,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.greenLight,
    opacity: 0.6,
  },
});
