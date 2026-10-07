import { useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

export default function CookSessionScreen() {
  const { session } = useLocalSearchParams<{ session: string }>();
  return <ScreenPlaceholder title={`Cuisson ${session ?? ''}`.trim()} task="1.2" />;
}
