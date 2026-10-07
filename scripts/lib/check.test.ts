import { describe, expect, it } from 'vitest';

import { checkContent, formatIssue } from './check';
import type { Issue, SourceFile } from './check';

const RECIPE = `slug: riz-saute
title: Riz sauté
servings_base: 2
total_min: 30
active_min: 15
cost_cents_per_serving: 85
equipment: [plaques]
ingredients:
  - name: riz
    quantity: 150
    unit: g
  - name: sel
    unit: au_gout
steps:
  - text: Fais cuire le riz dans l'eau salée.
    timer_sec: 600
`;

function recipe(path: string, source: string): SourceFile {
  return { path: `content/recipes/${path}`, source };
}

function check(...files: SourceFile[]): Issue[] {
  return checkContent({ recipes: files, challenges: [] }).issues;
}

describe('checkContent : recettes', () => {
  it('ne signale rien sur une recette correcte', () => {
    const result = checkContent({ recipes: [recipe('riz-saute.yaml', RECIPE)], challenges: [] });
    expect(result.issues).toEqual([]);
    expect(result.recipes[0]?.recipe.slug).toBe('riz-saute');
  });

  it('situe une unité inconnue sur sa ligne', () => {
    const issues = check(recipe('riz-saute.yaml', RECIPE.replace('unit: g', 'unit: kilo')));
    expect(issues).toEqual([
      expect.objectContaining({ severity: 'erreur', line: 11, field: 'ingredients n°1 › unit' }),
    ]);
    expect(issues[0]?.message).toMatch(/unité inconnue.*« kilo »/);
  });

  it('situe un champ inconnu sur la ligne de la clé et propose les champs possibles', () => {
    const issues = check(
      recipe(
        'riz-saute.yaml',
        RECIPE.replace('    unit: g', '    unit: g\n    categorie: epicerie'),
      ),
    );
    expect(issues[0]).toMatchObject({ line: 12, severity: 'erreur' });
    expect(issues[0]?.message).toMatch(/« categorie ».*category/);
  });

  it('explique la virgule décimale', () => {
    const issues = check(
      recipe('riz-saute.yaml', RECIPE.replace('quantity: 150', 'quantity: 0,5')),
    );
    expect(issues[0]).toMatchObject({ line: 10 });
    expect(issues[0]?.message).toMatch(/utilise un point \(0\.5\)/);
  });

  it('signale un champ obligatoire manquant', () => {
    const issues = check(recipe('riz-saute.yaml', RECIPE.replace('total_min: 30\n', '')));
    expect(issues[0]?.message).toMatch(/ajoute une ligne « total_min: … »/);
  });

  it('signale une erreur de syntaxe YAML avec sa ligne', () => {
    const issues = check(
      recipe('riz-saute.yaml', RECIPE.replace('  - name: sel', '\t- name: sel')),
    );
    expect(issues[0]).toMatchObject({ severity: 'erreur', line: 12 });
    expect(issues[0]?.message).toMatch(/^YAML illisible : tabulation/);
  });

  it('signale un champ écrit deux fois', () => {
    const issues = check(
      recipe('riz-saute.yaml', RECIPE.replace('title: Riz sauté', 'title: Riz sauté\ntitle: Riz')),
    );
    expect(issues[0]).toMatchObject({ line: 3 });
    expect(issues[0]?.message).toMatch(/deux fois/);
  });

  it('signale un fichier vide', () => {
    expect(check(recipe('vide.yaml', '# rien\n'))[0]?.message).toBe('fichier vide');
  });

  describe('avertissements', () => {
    it('coût par portion au-dessus de 2,50 €', () => {
      const issues = check(
        recipe(
          'riz-saute.yaml',
          RECIPE.replace('cost_cents_per_serving: 85', 'cost_cents_per_serving: 260'),
        ),
      );
      expect(issues).toEqual([expect.objectContaining({ severity: 'avertissement', line: 6 })]);
      expect(issues[0]?.message).toMatch(/2,60 €/);
    });

    it('pas d’avertissement à 2,50 € pile', () => {
      expect(
        check(
          recipe(
            'riz-saute.yaml',
            RECIPE.replace('cost_cents_per_serving: 85', 'cost_cents_per_serving: 250'),
          ),
        ),
      ).toEqual([]);
    });

    it('minuteur plus long que la durée totale', () => {
      const issues = check(
        recipe('riz-saute.yaml', RECIPE.replace('timer_sec: 600', 'timer_sec: 1900')),
      );
      expect(issues).toEqual([
        expect.objectContaining({
          severity: 'avertissement',
          line: 16,
          field: 'steps n°1 › timer_sec',
        }),
      ]);
    });

    it('temps actif plus long que la durée totale', () => {
      const issues = check(
        recipe('riz-saute.yaml', RECIPE.replace('active_min: 15', 'active_min: 45')),
      );
      expect(issues).toEqual([expect.objectContaining({ severity: 'avertissement', line: 5 })]);
    });

    it('slug différent du nom de fichier', () => {
      const issues = check(recipe('riz.yaml', RECIPE));
      expect(issues).toEqual([
        expect.objectContaining({ severity: 'avertissement', line: 1, field: 'slug' }),
      ]);
      expect(issues[0]?.message).toMatch(/riz-saute\.yaml/);
    });

    it('ingrédient en double', () => {
      const issues = check(recipe('riz-saute.yaml', RECIPE.replace('name: sel', 'name: Riz')));
      expect(issues).toEqual([expect.objectContaining({ severity: 'avertissement', line: 12 })]);
    });

    it('étapes parlant du four sans four dans equipment', () => {
      const issues = check(
        recipe(
          'riz-saute.yaml',
          RECIPE.replace("Fais cuire le riz dans l'eau salée.", 'Enfourne au four 10 minutes.'),
        ),
      );
      expect(issues).toEqual([
        expect.objectContaining({ severity: 'avertissement', field: 'equipment' }),
      ]);
    });

    it('photo de couverture absente de content/covers', () => {
      const result = checkContent(
        { recipes: [recipe('riz-saute.yaml', `${RECIPE}cover: riz-saute.jpg\n`)], challenges: [] },
        { coverExists: () => false },
      );
      expect(result.issues).toEqual([
        expect.objectContaining({ severity: 'avertissement', field: 'cover' }),
      ]);
    });
  });

  it('refuse deux recettes avec le même slug (erreur : la publication en écraserait une)', () => {
    const issues = check(recipe('riz-saute.yaml', RECIPE), recipe('riz-saute-2.yaml', RECIPE));
    expect(issues.filter((issue) => issue.severity === 'erreur')).toEqual([
      expect.objectContaining({ file: 'content/recipes/riz-saute-2.yaml', line: 1, field: 'slug' }),
    ]);
  });

  it('vérifie les modèles (_modele.yaml) sans contrôle de nom ni de doublon', () => {
    const result = checkContent({
      recipes: [recipe('riz-saute.yaml', RECIPE), recipe('_modele.yaml', RECIPE)],
      challenges: [],
    });
    expect(result.issues).toEqual([]);
    expect(result.recipes.map((r) => r.template)).toEqual([false, true]);
  });
});

describe('checkContent : défis', () => {
  const challenge = (source: string, path = 'content/challenges/2026-10-12.yaml'): SourceFile => ({
    path,
    source,
  });
  const CHALLENGE = `week_start: 2026-10-12
title: Semaine du riz
description: Cuisine un plat à base de riz cette semaine.
eligible_recipes: [riz-saute]
badge_code: roi_du_riz
`;

  it('accepte un défi qui cite une recette existante', () => {
    const result = checkContent({
      recipes: [recipe('riz-saute.yaml', RECIPE)],
      challenges: [challenge(CHALLENGE)],
    });
    expect(result.issues).toEqual([]);
    expect(result.challenges[0]?.challenge.bonus_xp).toBe(50);
  });

  it('signale une recette éligible inconnue', () => {
    const result = checkContent({ recipes: [], challenges: [challenge(CHALLENGE)] });
    expect(result.issues).toEqual([expect.objectContaining({ severity: 'erreur', line: 4 })]);
  });

  it('signale deux défis la même semaine et un week_start qui n’est pas un lundi', () => {
    const result = checkContent({
      recipes: [recipe('riz-saute.yaml', RECIPE)],
      challenges: [
        challenge(CHALLENGE),
        challenge(CHALLENGE, 'content/challenges/bis.yaml'),
        challenge(
          CHALLENGE.replace('2026-10-12', '2026-10-14'),
          'content/challenges/mercredi.yaml',
        ),
      ],
    });
    expect(result.issues.map((issue) => [issue.file, issue.line])).toEqual([
      ['content/challenges/bis.yaml', 1],
      ['content/challenges/mercredi.yaml', 1],
    ]);
  });
});

describe('formatIssue', () => {
  it('produit fichier:ligne:colonne cliquable', () => {
    expect(
      formatIssue({
        file: 'content/recipes/a.yaml',
        line: 3,
        column: 7,
        severity: 'erreur',
        field: 'title',
        message: 'trop court',
      }),
    ).toBe('content/recipes/a.yaml:3:7  erreur  title : trop court');
  });
});
