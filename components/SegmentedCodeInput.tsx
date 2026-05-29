import { useRef } from 'react';
import { View, TextInput, StyleSheet, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { theme } from '@/lib/theme';

const LENGTH = 6;

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export default function SegmentedCodeInput({ value, onChange }: Props) {
  const refs = useRef<(TextInput | null)[]>([]);
  const chars = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  const setAt = (index: number, char: string) => {
    const next = chars.map((c, i) => (i === index ? char : c === ' ' ? '' : c));
    onChange(next.join('').replace(/\s/g, '').toUpperCase());
  };

  const onKey = (index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && !chars[index]?.trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={s.row}>
      {Array.from({ length: LENGTH }).map((_, i) => (
        <TextInput
          key={i}
          ref={r => { refs.current[i] = r; }}
          style={s.box}
          value={chars[i]?.trim() ? chars[i] : ''}
          onChangeText={t => {
            const c = t.slice(-1).toUpperCase();
            if (!c) {
              setAt(i, '');
              return;
            }
            setAt(i, c);
            if (i < LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyPress={e => onKey(i, e)}
          maxLength={1}
          autoCapitalize="characters"
          keyboardType="default"
          textAlign="center"
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  box: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.greenMuted,
    backgroundColor: theme.bg,
    fontSize: 22,
    fontWeight: '800',
    color: theme.greenDark,
  },
});
