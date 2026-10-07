import {
  BUDGET_OPTIONS,
  EMPTY_FILTERS,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  TIME_OPTIONS,
  countActiveFilters,
  formatEuros,
  tagLabel,
  toggleThreshold,
  toggleValue,
  type RecipeFilters,
} from '@crok/shared';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chip, Text, useTheme } from '@/ui';

type Props = {
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
  /** Tags présents dans le catalogue. */
  tags: readonly string[];
};

function budgetLabel(cents: number): string {
  return cents % 100 === 0 ? `${cents / 100}\u00a0€` : formatEuros(cents);
}

function FilterRow({ title, children }: { title: string; children: ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" color="textMuted">
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Filtres combinables du catalogue : temps, budget, ustensiles, envies (tags). */
export function RecipeFiltersBar({ filters, onChange, tags }: Props) {
  const { spacing } = useTheme();
  const active = countActiveFilters(filters);

  return (
    <View style={{ gap: spacing.md }}>
      <FilterRow title="Temps total">
        {TIME_OPTIONS.map((minutes) => (
          <Chip
            key={minutes}
            label={`${minutes}\u00a0min max`}
            accessibilityLabel={`${minutes} minutes maximum`}
            selected={filters.maxTotalMin === minutes}
            onPress={() =>
              onChange({ ...filters, maxTotalMin: toggleThreshold(filters.maxTotalMin, minutes) })
            }
          />
        ))}
      </FilterRow>

      <FilterRow title="Budget par portion">
        {BUDGET_OPTIONS.map((cents) => (
          <Chip
            key={cents}
            label={`${budgetLabel(cents)} max`}
            accessibilityLabel={`${budgetLabel(cents)} maximum par portion`}
            selected={filters.maxCostCents === cents}
            onPress={() =>
              onChange({ ...filters, maxCostCents: toggleThreshold(filters.maxCostCents, cents) })
            }
          />
        ))}
      </FilterRow>

      <FilterRow title="Ce que j’ai dans ma cuisine">
        {EQUIPMENT.map((item) => (
          <Chip
            key={item}
            label={EQUIPMENT_LABELS[item]}
            selected={filters.equipment.includes(item)}
            onPress={() =>
              onChange({ ...filters, equipment: toggleValue(filters.equipment, item) })
            }
          />
        ))}
      </FilterRow>

      {tags.length > 0 ? (
        <FilterRow title="Envies">
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tagLabel(tag)}
              selected={filters.tags.includes(tag)}
              onPress={() => onChange({ ...filters, tags: toggleValue(filters.tags, tag) })}
            />
          ))}
        </FilterRow>
      ) : null}

      {active > 0 ? (
        <Button
          variant="ghost"
          label={active === 1 ? 'Effacer le filtre' : `Effacer les ${active} filtres`}
          onPress={() => onChange(EMPTY_FILTERS)}
        />
      ) : null}
    </View>
  );
}
