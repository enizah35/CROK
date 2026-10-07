import { Redirect } from 'expo-router';

// Aiguillage provisoire : la redirection vers (auth) ou (onboarding) arrive avec la tâche 0.4.
export default function Index() {
  return <Redirect href="/recettes" />;
}
