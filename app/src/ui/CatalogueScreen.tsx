import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Pepin, PEPIN_ETATS, type PepinEtat } from './Pepin';
import { ProgressPill } from './ProgressPill';
import { Screen } from './Screen';
import { Text } from './Text';
import { ThemeProvider, useTheme } from './theme';
import { AVATAR_COUNT, type ColorScheme, type TypographyVariant } from './tokens';

const noop = () => undefined;

const variants: TypographyVariant[] = [
  'display',
  'title',
  'subtitle',
  'body',
  'bodyStrong',
  'label',
  'caption',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md, marginBottom: spacing.xxl }}>
      <Text variant="title">{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  const { spacing } = useTheme();
  return <View style={[styles.row, { gap: spacing.sm }]}>{children}</View>;
}

function Swatches() {
  const { colors, spacing, radii } = useTheme();
  return (
    <Row>
      {Object.entries(colors).map(([name, value]) => (
        <View key={name} style={{ width: 96, gap: spacing.xs }}>
          <View
            style={{
              height: 40,
              borderRadius: radii.sm,
              backgroundColor: value,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          />
          <Text variant="caption">{name}</Text>
          <Text variant="caption" color="textMuted">
            {value}
          </Text>
        </View>
      ))}
    </Row>
  );
}

function CatalogueContent({
  forced,
  onScheme,
}: {
  forced: ColorScheme | null;
  onScheme: (s: ColorScheme | null) => void;
}) {
  const { scheme } = useTheme();
  const [filters, setFilters] = useState({ rapide: true, micro: false, four: false });
  const [avatar, setAvatar] = useState(3);
  const [loading, setLoading] = useState(false);

  const pressLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <Screen scroll>
      <Section title="Catalogue du kit UI">
        <Text color="textMuted">
          {`Écran de développement (tâche 0.5). Mode actuel : ${scheme === 'dark' ? 'sombre' : 'clair'}.`}
        </Text>
        <Row>
          <Chip label="Système" selected={forced === null} onPress={() => onScheme(null)} />
          <Chip label="Clair" selected={forced === 'light'} onPress={() => onScheme('light')} />
          <Chip label="Sombre" selected={forced === 'dark'} onPress={() => onScheme('dark')} />
        </Row>
      </Section>

      <Section title="Pépin">
        <Row>
          {PEPIN_ETATS.map((etat: PepinEtat) => (
            <View key={etat} style={styles.center}>
              <Pepin etat={etat} taille={96} />
              <Text variant="caption">{etat}</Text>
            </View>
          ))}
        </Row>
      </Section>

      <Section title="Couleurs">
        <Swatches />
      </Section>

      <Section title="Texte">
        {variants.map((v) => (
          <Text key={v} variant={v}>
            {`${v} : On sort un plat ce soir`}
          </Text>
        ))}
        <Text color="textMuted">textMuted : texte secondaire</Text>
        <Text color="primary">primary : texte d’action</Text>
        <Text color="secondary">secondary : réussite</Text>
        <Text color="danger">danger : erreur</Text>
      </Section>

      <Section title="Boutons">
        <Row>
          <Button label="Je cuisine" onPress={noop} />
          <Button label="Voir la recette" variant="secondary" onPress={noop} />
          <Button label="Plus tard" variant="ghost" onPress={noop} />
        </Row>
        <Row>
          <Button label="Envoi…" loading={loading} onPress={pressLoading} />
          <Button label="Charger 1,5 s" variant="secondary" onPress={pressLoading} />
        </Row>
        <Row>
          <Button label="Désactivé" disabled onPress={noop} />
          <Button label="Désactivé" variant="secondary" disabled onPress={noop} />
          <Button label="Désactivé" variant="ghost" disabled onPress={noop} />
        </Row>
        <Button label="Bouton pleine largeur" block onPress={noop} />
      </Section>

      <Section title="Filtres (Chip)">
        <Row>
          <Chip
            label="Moins de 20 min"
            selected={filters.rapide}
            onPress={() => setFilters((f) => ({ ...f, rapide: !f.rapide }))}
          />
          <Chip
            label="Micro-ondes"
            selected={filters.micro}
            onPress={() => setFilters((f) => ({ ...f, micro: !f.micro }))}
          />
          <Chip
            label="Four"
            selected={filters.four}
            onPress={() => setFilters((f) => ({ ...f, four: !f.four }))}
          />
          <Chip label="Indisponible" selected={false} disabled onPress={noop} />
        </Row>
      </Section>

      <Section title="Série (ProgressPill)">
        <Row>
          {[0, 1, 2, 3, 4].map((n) => (
            <ProgressPill key={n} count={n} />
          ))}
        </Row>
      </Section>

      <Section title="Avatars">
        <Row>
          {Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1).map((id) => (
            <Avatar key={id} id={id} selected={avatar === id} onPress={() => setAvatar(id)} />
          ))}
        </Row>
        <Row>
          <Avatar id={avatar} size={32} />
          <Avatar id={avatar} size={64} />
          <Avatar id={avatar} size={96} />
        </Row>
      </Section>

      <Section title="Cartes">
        <Card>
          <Text variant="subtitle">Pâtes au thon</Text>
          <Text color="textMuted">20 min · 1,80 € la portion · plaques</Text>
        </Card>
        <Card onPress={noop} accessibilityLabel="Ouvrir la recette Omelette express">
          <Text variant="subtitle">Omelette express (cliquable)</Text>
          <Text color="textMuted">10 min · 0,90 € la portion · plaques</Text>
        </Card>
      </Section>

      <Section title="État vide">
        <Card>
          <EmptyState
            title="Pas encore de plat cette semaine"
            message="Choisis une recette, Pépin t’accompagne."
            pepin="affame"
            actionLabel="Voir les recettes"
            onAction={noop}
          />
        </Card>
      </Section>

      <Section title="Erreur">
        <Card>
          <ErrorState onRetry={noop} />
        </Card>
      </Section>
    </Screen>
  );
}

/** Catalogue de développement : tous les composants du kit et les 6 états de Pépin. */
export function CatalogueScreen() {
  const [forced, setForced] = useState<ColorScheme | null>(null);
  return (
    <ThemeProvider scheme={forced}>
      <CatalogueContent forced={forced} onScheme={setForced} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
  },
});
