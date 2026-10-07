import { OTP_LENGTH, isCompleteOtp, sanitizeOtpInput } from '@crok/shared';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

type Props = {
  email: string;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
};

/** Saisie du code à 6 chiffres reçu par email (R-32). */
export function OtpCodeForm({ email, busy, error, onSubmit, onResend, onChangeEmail }: Props) {
  const { colors, radii, spacing } = useTheme();
  const [code, setCode] = useState('');
  const complete = isCompleteOtp(code);

  function handleChange(raw: string) {
    const next = sanitizeOtpInput(raw);
    setCode(next);
    // Validation automatique dès le 6e chiffre (saisie ou collage depuis l'email).
    if (isCompleteOtp(next) && next !== code && !busy) onSubmit(next);
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="title">Entre ton code</Text>
      <Text>
        On vient d’envoyer un code à {OTP_LENGTH} chiffres à{' '}
        <Text variant="bodyStrong">{email}</Text>.
      </Text>
      <TextInput
        testID="otp-input"
        accessibilityLabel={`Code à ${OTP_LENGTH} chiffres`}
        value={code}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH + 2}
        autoFocus
        editable={!busy}
        style={[
          styles.input,
          {
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            color: colors.text,
          },
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" color="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label="Valider"
        block
        onPress={() => onSubmit(code)}
        disabled={!complete}
        loading={busy}
      />
      <Button label="Renvoyer un code" variant="ghost" block onPress={onResend} disabled={busy} />
      <Button
        label="Changer d’adresse"
        variant="ghost"
        block
        onPress={onChangeEmail}
        disabled={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 56,
    borderWidth: 1,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
  },
});
