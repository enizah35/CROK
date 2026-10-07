import { OnboardingForm } from '@/features/onboarding/OnboardingForm';
import { Screen } from '@/ui';

export default function BienvenueScreen() {
  return (
    <Screen padded={false}>
      <OnboardingForm />
    </Screen>
  );
}
