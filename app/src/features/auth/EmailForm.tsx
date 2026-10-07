import { isPlausibleEmail } from '@crok/shared';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';

type Props = {
  initialEmail: string;
  busy: boolean;
  error: string | null;
  onSubmit: (email: string) => void;
};

export function EmailForm({ initialEmail, busy, error, onSubmit }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const valid = isPlausibleEmail(email);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue sur CROK</Text>
      <Text style={styles.text}>
        Entre ton email : on t’envoie un code à 6 chiffres, pas besoin de mot de passe.
      </Text>
      <TextInput
        testID="email-input"
        accessibilityLabel="Adresse email"
        value={email}
        onChangeText={setEmail}
        placeholder="toi@exemple.fr"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
        onSubmitEditing={() => valid && onSubmit(email)}
        style={styles.input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button
        label="Recevoir mon code"
        onPress={() => onSubmit(email)}
        disabled={!valid}
        busy={busy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  text: { fontSize: 16, color: '#333' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  error: { color: '#B00020', fontSize: 15 },
});
