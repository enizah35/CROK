import { useLocalSearchParams } from 'expo-router';

import { CookScreen } from '@/features/cook/CookScreen';

export default function CookSessionRoute() {
  const { session } = useLocalSearchParams<{ session: string }>();
  return <CookScreen sessionId={session ?? ''} />;
}
