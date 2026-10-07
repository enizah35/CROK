import { OTP_LENGTH, isCompleteOtp, sanitizeOtpInput } from '@crok/shared';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';

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
  const [code, setCode] = useState('');
  const complete = isCompleteOtp(code);

  function handleChange(raw: string) {
    const next = sanitizeOtpInput(raw);
    setCode(next);
    // Validation automatique dès le 6e chiffre (saisie ou collage depuis l'email).
    if (isCompleteOtp(next) && next !== code && !busy) onSubmit(next);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Entre ton code</Text>
      <Text style={styles.text}>
        On vient d’envoyer un code à {OTP_LENGTH} chiffres à{' '}
        <Text style={styles.bold}>{email}</Text>.
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
        style={styles.input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button label="Valider" onPress={() => onSubmit(code)} disabled={!complete} busy={busy} />
      <Button label="Renvoyer un code" variant="link" onPress={onResend} disabled={busy} />
      <Button label="Changer d’adresse" variant="link" onPress={onChangeEmail} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  text: { fontSize: 16, color: '#333' },
  bold: { fontWeight: '600' },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { color: '#B00020', fontSize: 15 },
});
