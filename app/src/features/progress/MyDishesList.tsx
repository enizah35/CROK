import { formatParisDay } from '@crok/shared';
import { View } from 'react-native';

import type { MyDish } from './api';
import { EmptyState, Pepin, Text, useTheme } from '@/ui';

type Props = {
  dishes: MyDish[];
  /** Année en cours (heure serveur), pour n'afficher l'année que si elle diffère. */
  currentYear?: number;
  onBrowseRecipes?: () => void;
};

/** Visuel de remplacement : les photos (URL signées) arrivent en phase 2. Décoratif. */
function DishThumbnail() {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="dish-photo-placeholder"
      style={{
        width: 56,
        height: 56,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Pepin etat="fier" taille={40} />
    </View>
  );
}

/** Historique de mes plats : recette, jour (Paris) et « compté » tel que décidé par le serveur. */
export function MyDishesList({ dishes, currentYear, onBrowseRecipes }: Props) {
  const { colors, radii, spacing } = useTheme();

  if (dishes.length === 0) {
    return (
      <EmptyState
        testID="my-dishes-empty"
        title="Pas encore de plat"
        message="Ton premier plat apparaîtra ici, avec sa date."
        {...(onBrowseRecipes
          ? { actionLabel: 'Choisir une recette', onAction: onBrowseRecipes }
          : {})}
      />
    );
  }

  return (
    <View testID="my-dishes-list" style={{ gap: spacing.sm }}>
      {dishes.map((dish) => {
        const title = dish.recipe?.title ?? 'Recette retirée';
        const day = formatParisDay(dish.day_paris, currentYear);
        const status = dish.counted ? 'Compté' : 'Hors compteur';
        return (
          <View
            key={dish.id}
            testID={`my-dish-${dish.id}`}
            accessible
            accessibilityLabel={`${title}, ${day}, ${status}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.sm,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.surface,
            }}
          >
            <DishThumbnail />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="bodyStrong" numberOfLines={2}>
                {title}
              </Text>
              <Text variant="caption" color="textMuted">
                {day}
              </Text>
            </View>
            <Text variant="label" color={dish.counted ? 'secondary' : 'textMuted'}>
              {status}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
