import { useLocalSearchParams } from 'expo-router';

import { LaunchScreen } from '@/features/cook/LaunchScreen';

/** `/cook/lancer?recipeId=…&servings=…` : crée la session (R-03) puis ouvre le mode cuisine. */
export default function CookLaunchRoute() {
  const { recipeId, servings } = useLocalSearchParams<{ recipeId?: string; servings?: string }>();
  return <LaunchScreen recipeId={recipeId} servings={servings} />;
}
