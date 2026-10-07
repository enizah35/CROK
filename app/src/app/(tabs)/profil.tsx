import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { supabase } from '@/lib/supabase';

export default function ProfilScreen() {
  const queryClient = useQueryClient();
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
    <View style={styles.container}>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.task}>À venir : tâche 1.5</Text>
      <Button label="Se déconnecter" onPress={() => void signOut()} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '600' },
  task: { color: '#555' },
});
