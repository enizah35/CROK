import { AVATAR_IDS } from '@crok/shared';
import { StyleSheet, View } from 'react-native';

import { Avatar, useTheme } from '@/ui';

type Props = { value: number | null; onChange: (avatarId: number) => void };

/** Choix de l'avatar parmi 12 (R-32), avec les avatars du kit UI. */
export function AvatarPicker({ value, onChange }: Props) {
  const { spacing } = useTheme();
  return (
    <View
      style={[styles.grid, { gap: spacing.md }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Avatar"
    >
      {AVATAR_IDS.map((id) => (
        <Avatar
          key={id}
          id={id}
          size={56}
          testID={`avatar-${id}`}
          selected={id === value}
          onPress={() => onChange(id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
