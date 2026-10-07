import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import { Button, Screen, Text, useTheme } from '@/ui';

export default function ProfilScreen() {
  const queryClient = useQueryClient();
  const { spacing } = useTheme();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    // scope 'local' : ferme la session de ce téléphone ; elle est effacée du trousseau même
    // si le serveur ne répond pas.
    await supabase.auth.signOut({ scope: 'local' });
    queryClient.clear();
    setBusy(false);
  }

  return (
    <Screen contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
      <Text variant="title">Profil</Text>
      <Text color="textMuted">À venir : tâche 1.5</Text>
      <Button label="Se déconnecter" onPress={() => void signOut()} loading={busy} />
    </Screen>
  );
}
