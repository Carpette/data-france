# data-france

Observatoire personnel des données publiques françaises — canicule, dépense
publique, marchés publics. Site statique (React + Vite), déployable
gratuitement sur GitHub Pages, sans backend.

## Pages

| Page | Contenu | Source | Fraîcheur |
|---|---|---|---|
| **Canicule** | Jours d'alerte, sévérité, jours ≥ 30 °C par département | Santé publique France (ODISSE), ODRÉ | JSON embarqués, rafraîchis par GitHub Action mensuelle |
| **Dépense publique** | COFOG 1995-2024 : fonctions → sous-fonctions → nature, « qui paie », comparateur bi-années à 3 lectures (part / volume / nominal) | INSEE, comptes nationaux base 2020 (tableaux 3.301 & 3.307) | Manuel (publication INSEE annuelle) |
| **Marchés publics** | Recherche et fiches marché : acheteur → titulaire → montant → objet ; top fournisseurs | DECP, data.economie.gouv.fr | **Interrogé en direct par le navigateur** |

## Démarrer

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/
node scripts/build-data.mjs   # rafraîchit les JSON canicule (réseau requis)
```

## Déployer sur GitHub Pages

1. Créer le repo GitHub `data-france` et pousser `main`.
2. Settings → Pages → Source : **GitHub Actions**.
3. Le workflow `deploy.yml` construit et publie à chaque push.

## Architecture des données

- **Embarqué (build)** : agrégats légers (< 600 Ko) dans `src/data/*.json`.
- **Live (runtime)** : le navigateur interroge l'API Opendatasoft de
  data.economie.gouv.fr pour le DECP — aucune clé requise. Les noms de champs
  sont centralisés dans `src/lib/decp.js` (constante `FIELDS`) : si le schéma
  du dataset change, c'est le seul endroit à ajuster.
- **Pré-calcul (CI)** : `data-refresh.yml` exécute `scripts/build-data.mjs`
  chaque mois et commite les JSON mis à jour.

## Limites assumées (affichées dans le site)

- Les **justificatifs de paiement (factures)** ne sont pas publics : le niveau
  le plus fin est le marché attribué (DECP) — un montant DECP est un engagement
  contractuel, pas une preuve de paiement.
- La base DECP est déclarative : trous, doublons et montants prévisionnels.
- COFOG : classement par finalité, pas par ministère ; ventilation par payeur
  cohérente seulement à partir de 2019 (rupture de série INSEE documentée).
- Correction d'inflation par IPC agrégé : ordre de grandeur.

## Données sources (mise à jour manuelle)

Les xlsx INSEE (T_3301/T_3307) et les CSV ODISSE/ODRÉ d'origine ne sont pas
versionnés ; seuls les agrégats JSON le sont. Pour régénérer depuis les
sources : voir `scripts/build-data.mjs`.
