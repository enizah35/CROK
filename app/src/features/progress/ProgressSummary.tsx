import {
  daysLeftInWeek,
  daysLeftLabel,
  formatXp,
  parseServerInstant,
  pepinEtatFromProgress,
  streakLabel,
  todayDishesLabel,
  type MyProgress,
} from '@crok/shared';
import { StyleSheet, View } from 'react-native';

import { Card, Pepin, ProgressPill, Text, useTheme } from '@/ui';

type Props = { progress: MyProgress };

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} : ${value}`}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="bodyStrong" testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Progression telle que renvoyée par `get_my_progress()` : chaque valeur est affichée telle
 * quelle (R-08, R-15). Seuls l'état de Pépin (R-30) et les jours restants (R-01) en sont
 * dérivés, à partir de l'heure serveur.
 */
export function ProgressSummary({ progress }: Props) {
  const { spacing } = useTheme();
  const etat = pepinEtatFromProgress(progress);
  const daysLeft = daysLeftInWeek(parseServerInstant(progress.server_now));

  return (
    <Card testID="progress-summary" style={{ gap: spacing.lg }}>
      <View style={[styles.row, { gap: spacing.lg }]}>
        <Pepin etat={etat} taille={88} />
        <View style={[styles.grow, { gap: spacing.xs }]}>
          <Text variant="caption" color="textMuted">
            XP totale
          </Text>
          <Text variant="title" testID="progress-lifetime-xp">
            {formatXp(progress.lifetime_xp)}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="subtitle">Ma semaine</Text>
        <View style={[styles.row, { gap: spacing.md }]}>
          <ProgressPill
            count={progress.week_dishes_count}
            goal={progress.goal}
            testID="progress-week-pill"
          />
          <Text color="textMuted" testID="progress-week-xp">
            {`+${formatXp(progress.week_xp)}`}
          </Text>
        </View>
        <Text color="textMuted" testID="progress-days-left">
          {daysLeftLabel(daysLeft)}
        </Text>
      </View>

      <View style={[styles.row, { gap: spacing.lg }]}>
        <Stat label="Série" value={streakLabel(progress.streak)} testID="progress-streak" />
        <Stat
          label="Aujourd’hui"
          value={todayDishesLabel(progress.today_dishes_count)}
          testID="progress-today"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  grow: { flex: 1 },
  stat: { flex: 1 },
});
