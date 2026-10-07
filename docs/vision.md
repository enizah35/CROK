# CROK v2 : vision produit et marché

Mission `2026-10-07-crok-v2-vision`, fusion par le Chef des rapports des agents `product-vision` et `chercheur`. Aucune spec antérieure utilisée.

## En une phrase
**CROK, le jeu entre potes de la cuisine pas chère.** L'app te guide pas à pas pour sortir un vrai plat, même avec deux plaques et un micro-ondes, puis tu le montres tel quel à tes potes. Une mascotte et des défis hebdomadaires entre amis te donnent envie de recommencer.

**Promesse :** « Même si tu n'as jamais cuisiné, ce soir tu sors un plat que tu es fier de montrer. »

**CROK n'est pas** un réseau d'influenceurs, une base de 50 000 recettes, ni un concours du plus beau plat.

## Pourquoi il y a une place
- **Personne ne combine les quatre briques** (guidage pas à pas, photo authentique, gamification, défis entre amis), et personne ne vise la France ni les jeunes adultes.
  - Jow : budget et panier en supermarché, mais rien de social ni de ludique, et pensé pour les familles.
  - Marmiton, 750g : catalogue et publicité, pas de guidage ni de progression.
  - Cookidoo : la référence du guidage, mais il faut un Thermomix.
  - Linecook (US, financée en mars 2026), Potluck Club (US), BeMeal (UK) : social entre amis, mais sans guidage ni angle budget, et minuscules.
- **La cible a un vrai besoin.** Chez les 15-24 ans, seuls 10 % connaissent plus de 10 recettes (Harris pour Bercy, 2024). 79 % des 18-24 ans commandent parfois par flemme, et pour eux le micro-ondes passe avant le four (OpinionWay, 2025). 83 % des 18-24 ans surveillent leurs dépenses alimentaires (Toluna-Harris pour Nestlé, 2025).
- **Les leçons de BeReal et Duolingo pointent dans le même sens.** La contrainte quotidienne a épuisé BeReal (environ 15 M d'utilisateurs actifs par jour en 2022, environ 6 M au printemps 2023). Les séries de Duolingo marchent, mais on ne cuisine pas tous les jours. D'où un **rythme hebdomadaire**.

Sources en fin de document.

## Personas
1. **Léa, 20 ans, étudiante en studio.** Budget serré, deux plaques, pas de four. Déclencheur : 19 h, frigo à moitié vide.
2. **Malik, 24 ans, jeune actif en coloc.** Commande trop souvent et culpabilise. Déclencheur : le plat d'un pote dans son fil.
3. **Inès, 18 ans, vient de quitter ses parents.** N'a jamais cuisiné seule, a peur de rater. Déclencheur : la mascotte ou le défi de son groupe.

## North Star
**Plats cuisinés et partagés par semaine** : une recette terminée en mode guidé, avec la photo du plat publiée.
Elle mesure à la fois la valeur (on a cuisiné) et le moteur de croissance (les potes voient le plat). À côté, on suit la rétention : part des utilisateurs qui cuisinent au moins une fois par semaine pendant 4 semaines d'affilée.

## Boucle principale
1. **Déclencheur** : un rappel de la mascotte à l'heure choisie, un plat d'ami dans le fil, ou le défi de la semaine.
2. **Action** : choisir une recette filtrée par temps, budget et ustensiles, puis la cuisiner en mode guidé (une étape par écran, portions ajustées, minuteurs).
3. **Récompense** : à la dernière étape, l'appareil photo s'ouvre dans l'app, sans galerie ni filtre (le « moment BeReal »). XP, série et réaction de la mascotte.
4. **Partage** : la photo brute part dans le fil de ses amis uniquement, qui réagissent par emoji.
5. **Retour** : réactions, classement hebdomadaire entre amis, défi suivant.

## Arbitrages entre les inspirations
- **BeReal contre recette de 40 min** : on garde l'authenticité, pas l'heure imposée. Le moment BeReal, c'est la fin de la recette.
- **Compétition contre débutants** : on classe sur la régularité (plats terminés, XP), jamais sur la beauté ou la difficulté. Une recette facile compte autant qu'une difficile.
- **Marmiton contre Thermomix** : petit catalogue choisi à la main, entièrement au format guidé. Pas de recettes d'utilisateurs au MVP.
- **Série quotidienne contre vraie vie** : série **hebdomadaire** (par exemple 3 plats par semaine).
- **Compétition contre triche** : enjeux faibles, cercle d'amis seulement, photo prise dans l'app, aucune récompense matérielle.
- **Réseau social contre démarrage à froid** : l'app est utile en solo (recettes, mascotte, XP), invitations par lien ou code, défi de la semaine commun à tous.
- **Mascotte motivante contre harcelante** : un seul rappel par jour, jamais de honte.

## Périmètre
**MVP**
- Inscription, pseudo et avatar.
- Amis par lien ou code d'invitation (pas de compte public).
- Environ 30 recettes pas chères (objectif moins de 2,50 € la portion), filtrables par temps, budget et ustensiles (plaques seules, four, micro-ondes).
- Fiche recette avec portions ajustables.
- Mode cuisine guidé : une étape par écran, minuteurs, écran qui reste allumé.
- Photo obligatoire en fin de recette, prise dans l'app.
- Fil des amis avec réactions emoji.
- XP, série hebdomadaire, classement hebdomadaire entre amis remis à zéro le lundi.
- Défi de la semaine avec badge.
- Mascotte : quelques états fixes et des messages contextuels.
- Un rappel quotidien réglable et désactivable.

**V2** : ligues entre inconnus, duels entre amis avec vote, commentaires, liste de courses, gel de série, badges et niveaux, favoris et historique, créneau commun « Crok du soir », mascotte animée.

**Plus tard** : recettes d'utilisateurs avec modération, vidéos, suggestions à partir du frigo, planning de repas, profils publics, panier envoyé aux enseignes et défis sponsorisés.

## Mascotte et ton
Tutoiement, humour, phrases courtes. On célèbre chaque plat terminé, même raté (« Brûlé ? Ça compte quand même »). On ne culpabilise jamais et on ne se moque jamais d'une photo.

**Décision de Hugo (2026-10-07) : la mascotte est une tomate.** Nom et personnalité à définir, dans le respect des règles de ton ci-dessus.

## Monétisation (après validation de la rétention)
Gratuit au MVP. Ensuite : commission des enseignes sur le panier d'ingrédients (modèle de Jow), défis sponsorisés par des marques, et éventuellement un premium léger (défis exclusifs, mascotte personnalisée). Un abonnement payant d'entrée est risqué pour une cible qui compte chaque euro.

## Risques principaux
1. **Démarrage à froid et lassitude** : une app sociale vide ne vaut rien, et les mécaniques s'usent.
2. **Concurrence** : Jow peut ajouter du social ; Linecook est financée et peut arriver en Europe ; TikTok reste l'inspiration gratuite.
3. **Monétisation fragile et coût du contenu** : produire des recettes guidées de qualité coûte cher.

## Hypothèses à tester vite
1. Les jeunes vont au bout d'une recette guidée de 20 à 40 min. Test : 5 à 10 personnes observées avec un prototype.
2. Montrer son plat brut à ses potes motive plutôt que gêne. Test : un groupe d'amis avec la règle « photo à la fin » pendant 2 semaines.
3. Série et classement hebdomadaires font revenir. Test : rétention sur 4 semaines en bêta fermée.
4. L'app est utile en solo. Test : comparer la rétention avec et sans ami invité.
5. 30 recettes suffisent pour un mois.
6. La mascotte tomate fait revenir sans agacer. Test : montrer des messages de rappel à une dizaine de personnes.

## Questions au fondateur (défaut proposé)
1. **Cible au lancement** : étudiants de 18 à 25 ans en France, seuls ou en coloc. *Validé par Hugo.*
2. **Âge minimum** : 18 ans, pour éviter la gestion des mineurs.
3. **Qui écrit les recettes** : Hugo, environ 30 recettes au format guidé. *Validé par Hugo.*
4. **Visibilité des photos** : amis uniquement.
5. **Photo obligatoire pour valider un plat** : oui pour l'XP et la série ; sans photo, la recette est terminée mais ne compte pas.
6. **Rythme de la série** : 3 plats par semaine.
7. **Récompense des compétitions** : rien de matériel (classement, badge, mascotte).
8. **Mascotte** : une tomate. *Décidé par Hugo.*
9. **Monétisation au MVP** : aucune.
10. **Lancement** : bêta fermée avec 3 à 5 groupes d'amis.

## Sources principales (agent chercheur)
- Cible : [OpinionWay pour Aviva, 2025](https://www.opinion-way.com/wp-content/uploads/2025/06/OpinionWay-pour-Aviva-Les-Francais-et-leur-rapport-a-la-cuisine-Juin-2025.pdf), [Harris pour Bercy, via Yahoo](https://fr.news.yahoo.com/jeunes-cuisinent-moins-reste-population-183000713.html), [Toluna-Harris pour Nestlé, 2025](https://www.nestle.fr/precarite-alimentaire-des-jeunes-septembre-2025)
- Jow : [Futura-Sciences, 2025](https://www.futura-sciences.com/tech/actualites/jeunes-pousses-240-portion-20-minutes-preparation-voici-appli-revolutionne-tous-vos-repas-118896/), [levée de 20 M$](https://jow.fr/pages/misc/frances-leading-e-recipe-and-grocery-app-jow-raises-20m-series-a-to-take-on-us-food-habits)
- Nouvelles apps : [Linecook](https://insider.fitt.co/linecook-debuts-social-cooking-app/), [Potluck Club](https://potluckclub.app/), [BeMeal](https://play.google.com/store/apps/details?id=com.bemeal.app&hl=en_US)
- Duolingo : [résultats T2 2026](https://www.globenewswire.com/fr/news-release/2026/08/05/3339653/0/en/duolingo-reports-second-quarter-2026-results.html) ; BeReal : [Wikipedia](https://en.wikipedia.org/wiki/BeReal), [iPhoneSoft, 2025](https://iphonesoft.fr/2025/12/29/bereal-reseau-social-francais-vise-rentabilite-2027)
- Limites : chiffres Marmiton de 2022, prix Cookidoo de source tierce, aucune étude française sur ce qui motive les jeunes à cuisiner.
