import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { entryHref } from '@/features/auth/accountStatus';
import { useAccountStatus } from '@/features/auth/useAccountStatus';
import { isSupabaseConfigured } from '@/lib/supabase';

/** Aiguillage selon l'état du compte (garde de navigation, R-32). */
export default function Index() {
  const { status, retry } = useAccountStatus();

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Configuration manquante</Text>
        <Text style={styles.text}>
          Copie .env.example dans app/.env.local et renseigne EXPO_PUBLIC_SUPABASE_URL et
          EXPO_PUBLIC_SUPABASE_ANON_KEY, puis relance l’app.
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Impossible de charger ton profil</Text>
        <Text style={styles.text}>Vérifie ta connexion et réessaie.</Text>
        <Button label="Réessayer" onPress={retry} />
      </View>
    );
  }

  const href = entryHref(status);
  if (href === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" accessibilityLabel="Chargement" />
      </View>
    );
  }
  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  text: { fontSize: 16, color: '#555', textAlign: 'center' },
});
