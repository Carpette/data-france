/**
 * Accès à la base DECP via l'API Opendatasoft de data.economie.gouv.fr.
 * Schéma validé le 11/08/2026 sur un enregistrement réel : le dataset ne
 * contient PAS de raisons sociales, seulement des identifiants SIRET
 * (acheteur_id, titulaire_id_1..3). Les noms sont résolus à la volée via
 * l'API publique Recherche d'entreprises (annuaire-entreprises / DINUM).
 */
export const BASE = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets';
export const DATASET = 'decp-2022-marches-valides';

export const FIELDS = {
  objet: 'objet',
  montant: 'montant',
  dateNotification: 'datenotification',
  acheteurId: 'acheteur_id',
  titulaireId: 'titulaire_id_1',
  procedure: 'procedure',
  nature: 'nature',
  codeCPV: 'codecpv',
  dureeMois: 'dureemois',
  lieuCode: 'lieuexecution_code',
  source: 'source',
};

async function ods(path, params) {
  const url = `${BASE}/${DATASET}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status} — ${url}`);
  return r.json();
}

/** Montants ≥ 1 Md€ : quasi toujours des erreurs de saisie (base déclarative). */
export const OUTLIER = 1e9;

export function searchMarches({ q = '', orderBy = `${FIELDS.montant} desc`, limit = 20, offset = 0, excludeOutliers = true }) {
  const params = { limit, offset, order_by: orderBy };
  const w = [];
  if (q) w.push(`search("${q.replace(/"/g, '')}")`);
  if (excludeOutliers) w.push(`${FIELDS.montant} < ${OUTLIER}`);
  if (w.length) params.where = w.join(' AND ');
  return ods('records', params);
}

export function aggregate({ groupBy = FIELDS.titulaireId, q = '', limit = 12, excludeOutliers = true }) {
  const params = {
    group_by: groupBy,
    select: `${groupBy}, count(*) as n, sum(${FIELDS.montant}) as total`,
    order_by: 'total desc', limit,
  };
  const w = [];
  if (q) w.push(`search("${q.replace(/"/g, '')}")`);
  if (excludeOutliers) w.push(`${FIELDS.montant} < ${OUTLIER}`);
  if (w.length) params.where = w.join(' AND ');
  return ods('records', params);
}

export function sampleRecord() {
  return ods('records', { limit: 1 });
}

/* ---------- Résolution SIRET/SIREN → raison sociale ---------- */
const nameCache = new Map();

/** Résout une liste de SIRET en noms, avec cache et limitation de débit. */
export async function resolveNames(ids) {
  const uniq = [...new Set(ids.filter(id => id && /^\d{9,14}$/.test(String(id))))]
    .filter(id => !nameCache.has(id));
  // l'API accepte q=<siret> ; ~7 req/s max → petits lots séquentiels
  for (let i = 0; i < uniq.length; i += 5) {
    await Promise.all(uniq.slice(i, i + 5).map(async id => {
      try {
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${id}&page=1&per_page=1`);
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        const e = j.results?.[0];
        nameCache.set(id, e ? (e.nom_raison_sociale || e.nom_complet || null) : null);
      } catch { nameCache.set(id, null); }
    }));
    if (i + 5 < uniq.length) await new Promise(res => setTimeout(res, 900));
  }
  return Object.fromEntries(ids.map(id => [id, nameCache.get(id) ?? null]));
}
