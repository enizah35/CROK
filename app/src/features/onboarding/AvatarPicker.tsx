import { AVATAR_IDS } from '@crok/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Avatars provisoires numérotés : les visuels arrivent avec la tâche 0.5.
const COLORS = [
  '#F4A261',
  '#E76F51',
  '#2A9D8F',
  '#E9C46A',
  '#8AB17D',
  '#6D597A',
  '#B56576',
  '#457B9D',
  '#F28482',
  '#84A59D',
  '#9C6644',
  '#5E60CE',
];

type Props = { value: number | null; onChange: (avatarId: number) => void };

export function AvatarPicker({ value, onChange }: Props) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Avatar">
      {AVATAR_IDS.map((id, index) => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            testID={`avatar-${id}`}
            accessibilityRole="radio"
            accessibilityLabel={`Avatar ${id}`}
            accessibilityState={{ selected, checked: selected }}
            onPress={() => onChange(id)}
            style={[
              styles.avatar,
              { backgroundColor: COLORS[index] ?? '#ccc' },
              selected && styles.selected,
            ]}
          >
            <Text style={styles.label}>{id}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selected: { borderColor: '#1d1d1d' },
  label: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
