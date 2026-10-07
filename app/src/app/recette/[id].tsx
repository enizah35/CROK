import { useLocalSearchParams } from 'expo-router';

import { RecipeDetailScreen } from '@/features/recipes/RecipeDetailScreen';

export default function RecetteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeDetailScreen id={typeof id === 'string' ? id : ''} />;
}
