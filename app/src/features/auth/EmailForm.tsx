import { isPlausibleEmail } from '@crok/shared';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

type Props = {
  initialEmail: string;
  busy: boolean;
  error: string | null;
  onSubmit: (email: string) => void;
};

export function EmailForm({ initialEmail, busy, error, onSubmit }: Props) {
  const { colors, radii, spacing, typography } = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const valid = isPlausibleEmail(email);

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="title">Bienvenue sur CROK</Text>
      <Text>Entre ton email : on t’envoie un code à 6 chiffres, pas besoin de mot de passe.</Text>
      <TextInput
        testID="email-input"
        accessibilityLabel="Adresse email"
        value={email}
        onChangeText={setEmail}
        placeholder="toi@exemple.fr"
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        onSubmitEditing={() => valid && onSubmit(email)}
        style={[
          styles.input,
          typography.body,
          {
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: spacing.md,
          },
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" color="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label="Recevoir mon code"
        block
        onPress={() => onSubmit(email)}
        disabled={!valid}
        loading={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 1 },
});
