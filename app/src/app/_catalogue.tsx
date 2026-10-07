import { Redirect } from 'expo-router';

import { CatalogueScreen } from '@/ui/CatalogueScreen';

// Route de développement : /_catalogue. Hors mode dev, renvoie à l'accueil.
export default function CatalogueRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <CatalogueScreen />;
}
