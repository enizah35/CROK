import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingForm } from '@/features/onboarding/OnboardingForm';

export default function BienvenueScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <OnboardingForm />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
});
