import { View, TextInput, StyleSheet } from 'react-native';
import AppIcon from '@/components/AppIcon';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: object;
}

/** Stable search input — avoids focus loss from parent re-mounting tab components. */
export default function PatientSearchBar({
  value,
  onChangeText,
  placeholder = 'Search by name, email, ID, or age…',
  style,
}: Props) {
  return (
    <View style={[styles.searchBox, style]}>
      <AppIcon name="search" size={18} color="#888" />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#222' },
});
