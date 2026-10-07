import { View } from 'react-native';

import { Pepin, useTheme } from '@/ui';

type Props = {
  /** Chemin de la photo dans le stockage. Pas encore alimenté (`cover_path` toujours null). */
  coverPath: string | null;
  height?: number;
};

/**
 * Couverture d'une recette. Tant que les photos de couverture ne sont pas publiées, on montre
 * un visuel de remplacement : Pépin sur fond crème. Décoratif, ignoré des lecteurs d'écran.
 */
export function RecipeCover({ coverPath: _coverPath, height = 120 }: Props) {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="recipe-cover-placeholder"
      style={{
        height,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pepin etat="neutre" taille={Math.round(height * 0.6)} />
    </View>
  );
}
