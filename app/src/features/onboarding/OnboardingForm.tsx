import { PSEUDO_MAX_LENGTH, pseudoErrorMessage, validatePseudo } from '@crok/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCompleteOnboarding, useDebouncedValue, usePseudoAvailability } from './api';
import { AvatarPicker } from './AvatarPicker';
import { checkOnboarding, type PseudoAvailability } from './onboardingForm';
import { onboardingErrorMessage } from '@/features/auth/errors';
import { Button } from '@/components/Button';

/** Onboarding (R-32) : pseudo unique, avatar parmi 12, case 18+ obligatoire. */
export function OnboardingForm() {
  const [pseudo, setPseudo] = useState('');
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);

  const validation = validatePseudo(pseudo);
  const debounced = useDebouncedValue(validation.ok ? validation.pseudo : null, 400);
  const availabilityQuery = usePseudoAvailability(debounced);
  const complete = useCompleteOnboarding();

  let availability: PseudoAvailability = 'unknown';
  if (validation.ok) {
    if (debounced !== validation.pseudo || availabilityQuery.isFetching) availability = 'checking';
    else if (availabilityQuery.data === true) availability = 'available';
    else if (availabilityQuery.data === false) availability = 'taken';
  }

  const check = checkOnboarding({ pseudo, avatarId, adultConfirmed }, availability);

  let pseudoHint: { text: string; tone: 'error' | 'ok' | 'info' } | null = null;
  if (pseudo.length > 0 && !validation.ok) {
    pseudoHint = { text: pseudoErrorMessage(validation.error), tone: 'error' };
  } else if (availability === 'taken') {
    pseudoHint = { text: 'Ce pseudo est déjà pris. Choisis-en un autre.', tone: 'error' };
  } else if (availability === 'checking') {
    pseudoHint = { text: 'Vérification…', tone: 'info' };
  } else if (availability === 'available') {
    pseudoHint = { text: 'Disponible !', tone: 'ok' };
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Crée ton profil</Text>

      <Text style={styles.section}>Ton pseudo</Text>
      <TextInput
        testID="pseudo-input"
        accessibilityLabel="Pseudo"
        value={pseudo}
        onChangeText={(text) => {
          setPseudo(text);
          complete.reset();
        }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={PSEUDO_MAX_LENGTH + 5}
        placeholder="3 à 20 caractères"
        style={styles.input}
      />
      {pseudoHint ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.hint,
            pseudoHint.tone === 'error' && styles.error,
            pseudoHint.tone === 'ok' && styles.ok,
          ]}
        >
          {pseudoHint.text}
        </Text>
      ) : null}

      <Text style={styles.section}>Ton avatar</Text>
      <AvatarPicker value={avatarId} onChange={setAvatarId} />

      <Pressable
        testID="adult-checkbox"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: adultConfirmed }}
        accessibilityLabel="J’ai 18 ans ou plus"
        onPress={() => setAdultConfirmed((v) => !v)}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, adultConfirmed && styles.checkboxChecked]}>
          {adultConfirmed ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.checkboxLabel}>J’ai 18 ans ou plus</Text>
      </Pressable>
      {!adultConfirmed ? (
        <Text style={styles.hint}>CROK est réservé aux personnes majeures.</Text>
      ) : null}

      {complete.isError ? (
        <Text accessibilityRole="alert" style={[styles.hint, styles.error]}>
          {onboardingErrorMessage(complete.error)}
        </Text>
      ) : null}

      <Button
        label="C’est parti"
        disabled={!check.canSubmit}
        busy={complete.isPending}
        onPress={() => {
          if (check.canSubmit) complete.mutate({ pseudo: check.pseudo, avatarId: check.avatarId });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  section: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
  },
  hint: { fontSize: 15, color: '#555' },
  error: { color: '#B00020' },
  ok: { color: '#1B7F3B' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, marginTop: 8 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  checkmark: { color: '#fff', fontSize: 18, fontWeight: '700' },
  checkboxLabel: { fontSize: 17 },
});
