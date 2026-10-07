import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'link';
};

/** Bouton provisoire (le kit UI arrive avec la tâche 0.5). Zone tactile d'au moins 48 px. */
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
}: Props) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'primary' ? styles.primary : styles.link,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#C0392B'} />
      ) : (
        <Text style={variant === 'primary' ? styles.primaryLabel : styles.linkLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0392B',
  },
  link: {
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  primaryLabel: { color: '#fff', fontSize: 17, fontWeight: '600' },
  linkLabel: { color: '#C0392B', fontSize: 16, fontWeight: '500' },
});
