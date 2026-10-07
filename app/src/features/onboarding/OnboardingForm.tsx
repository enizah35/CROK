import { PSEUDO_MAX_LENGTH, pseudoErrorMessage, validatePseudo } from '@crok/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useCompleteOnboarding, useDebouncedValue, usePseudoAvailability } from './api';
import { AvatarPicker } from './AvatarPicker';
import { checkOnboarding, type PseudoAvailability } from './onboardingForm';
import { onboardingErrorMessage } from '@/features/auth/errors';
import { Button, Text, useTheme } from '@/ui';

/** Onboarding (R-32) : pseudo unique, avatar parmi 12, case 18+ obligatoire. */
export function OnboardingForm() {
  const { colors, radii, spacing, typography } = useTheme();
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

  let pseudoHint: { text: string; color: 'danger' | 'secondary' | 'textMuted' } | null = null;
  if (pseudo.length > 0 && !validation.ok) {
    pseudoHint = { text: pseudoErrorMessage(validation.error), color: 'danger' };
  } else if (availability === 'taken') {
    pseudoHint = { text: 'Ce pseudo est déjà pris. Choisis-en un autre.', color: 'danger' };
  } else if (availability === 'checking') {
    pseudoHint = { text: 'Vérification…', color: 'textMuted' };
  } else if (availability === 'available') {
    pseudoHint = { text: 'Disponible !', color: 'secondary' };
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { padding: spacing.xl, gap: spacing.md }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="title">Crée ton profil</Text>

      <Text variant="subtitle">Ton pseudo</Text>
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
        placeholderTextColor={colors.textMuted}
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
      {pseudoHint ? (
        <Text accessibilityLiveRegion="polite" color={pseudoHint.color}>
          {pseudoHint.text}
        </Text>
      ) : null}

      <Text variant="subtitle">Ton avatar</Text>
      <AvatarPicker value={avatarId} onChange={setAvatarId} />

      <Pressable
        testID="adult-checkbox"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: adultConfirmed }}
        accessibilityLabel="J’ai 18 ans ou plus"
        onPress={() => setAdultConfirmed((v) => !v)}
        style={[styles.checkboxRow, { gap: spacing.md, marginTop: spacing.sm }]}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            adultConfirmed && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
        >
          {adultConfirmed ? (
            <Text variant="bodyStrong" color="onPrimary">
              ✓
            </Text>
          ) : null}
        </View>
        <Text>J’ai 18 ans ou plus</Text>
      </Pressable>
      {!adultConfirmed ? (
        <Text color="textMuted">CROK est réservé aux personnes majeures.</Text>
      ) : null}

      {complete.isError ? (
        <Text accessibilityRole="alert" color="danger">
          {onboardingErrorMessage(complete.error)}
        </Text>
      ) : null}

      <Button
        label="C’est parti"
        block
        disabled={!check.canSubmit}
        loading={complete.isPending}
        onPress={() => {
          if (check.canSubmit) complete.mutate({ pseudo: check.pseudo, avatarId: check.avatarId });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  input: { minHeight: 48, borderWidth: 1 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
