import { useLocalSearchParams } from 'expo-router';

import { PhotoScreen } from '@/features/dishes';

/** Photo du plat après la dernière étape du mode cuisine : `/cook/photo?session=<id>`. */
export default function CookPhotoRoute() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  return <PhotoScreen sessionId={typeof session === 'string' ? session : undefined} />;
}
