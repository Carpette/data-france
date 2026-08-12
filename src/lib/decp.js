/**
 * Accès à la base DECP via l'API Opendatasoft Explore v2.1 de data.economie.gouv.fr.
 * Schéma validé le 11/08/2026 : identifiants SIRET uniquement (acheteur_id,
 * titulaire_id_1..3), pas de raisons sociales — résolues via l'API Recherche
 * d'entreprises (DINUM), qui sert aussi à traduire un NOM saisi en SIREN.
 */
export const BASE = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets';
export const DATASET = 'decp-2022-marches-valides';

export const FIELDS = {
  objet: 'objet',
  montant: 'montant',
  dateNotification: 'datenotification',
  acheteurId: 'acheteur_id',
  titulaireId: 'titulaire_id_1',
  titulaireId2: 'titulaire_id_2',
  titulaireId3: 'titulaire_id_3',
  procedure: 'procedure',
  nature: 'nature',
  codeCPV: 'codecpv',
  dureeMois: 'dureemois',
  lieuCode: 'lieuexecution_code',
  source: 'source',
};

/** Champs proposés dans le sélecteur de recherche. */
export const SEARCH_FIELDS = [
  { key: 'all', label: 'Tous les champs' },
  { key: 'objet', label: 'Objet du marché' },
  { key: 'titulaire', label: 'Titulaire (nom ou SIREN/SIRET)' },
  { key: 'acheteur', label: 'Acheteur (nom ou SIREN/SIRET)' },
  { key: 'cpv', label: 'Code CPV (préfixe)' },
  { key: 'lieu', label: 'Lieu d’exécution (code commune/CP)' },
  { key: 'procedure', label: 'Procédure' },
];

export const OUTLIER = 1e9;

const esc = s => String(s).replace(/"/g, '').trim();

/**
 * Construit la clause where ODSQL.
 * `resolved` : {siren} quand un nom d'entreprise a été traduit en SIREN.
 */
export function buildWhere({ q = '', field = 'all', resolved = null,
  montantMin = null, montantMax = null, yearFrom = null, yearTo = null,
  excludeOutliers = true }) {
  const w = [];
  const term = esc(q);
  if (term) {
    // NB : en ODSQL (Opendatasoft), le joker de `like` est `*` — pas `%`.
    if (field === 'objet') w.push(`${FIELDS.objet} like "${term}"`);
    else if (field === 'procedure') w.push(`${FIELDS.procedure} like "${term}"`);
    else if (field === 'cpv') w.push(`${FIELDS.codeCPV} like "${term}*"`);
    else if (field === 'lieu') w.push(`${FIELDS.lieuCode} like "${term}*"`);
    else if (field === 'titulaire' || field === 'acheteur') {
      const id = resolved?.siren || (/^\d{9,14}$/.test(term) ? term : null);
      if (id) {
        const pat = `${id}*`;
        if (field === 'acheteur') w.push(`${FIELDS.acheteurId} like "${pat}"`);
        else w.push(`(${FIELDS.titulaireId} like "${pat}" OR ${FIELDS.titulaireId2} like "${pat}" OR ${FIELDS.titulaireId3} like "${pat}")`);
      } else {
        w.push(`search("${term}")`); // repli : nom non résolu
      }
    } else w.push(`search("${term}")`);
  }
  if (excludeOutliers) w.push(`${FIELDS.montant} < ${OUTLIER}`);
  if (montantMin) w.push(`${FIELDS.montant} >= ${Number(montantMin)}`);
  if (montantMax) w.push(`${FIELDS.montant} <= ${Number(montantMax)}`);
  if (yearFrom) w.push(`${FIELDS.dateNotification} >= date'${Number(yearFrom)}-01-01'`);
  if (yearTo) w.push(`${FIELDS.dateNotification} <= date'${Number(yearTo)}-12-31'`);
  return w.join(' AND ');
}

async function ods(path, params) {
  const url = `${BASE}/${DATASET}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url);
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).message || ''; } catch { /* — */ }
    throw new Error(`API ${r.status}${detail ? ` — ${detail}` : ''}`);
  }
  return r.json();
}

export function searchMarches(opts) {
  const params = {
    limit: opts.limit ?? 20, offset: opts.offset ?? 0,
    order_by: opts.orderBy ?? `${FIELDS.montant} desc`,
  };
  const where = buildWhere(opts);
  if (where) params.where = where;
  return ods('records', params);
}

export function aggregate(opts) {
  const groupBy = opts.groupBy ?? FIELDS.titulaireId;
  const params = {
    group_by: groupBy,
    select: `${groupBy}, count(*) as n, sum(${FIELDS.montant}) as total`,
    order_by: 'total desc', limit: opts.limit ?? 12,
  };
  const where = buildWhere(opts);
  if (where) params.where = where;
  return ods('records', params);
}

export function sampleRecord() {
  return ods('records', { limit: 1 });
}

/* ---------- API Recherche d'entreprises (DINUM) ---------- */
const nameCache = new Map();

/**
 * Nom → liste de candidats {siren, nom, activite}, pour laisser l'utilisateur
 * choisir (la « meilleure correspondance » automatique se trompe : « cap gemini »
 * renvoie un comité d'entreprise avant CAPGEMINI). Si le nom contient des
 * espaces, la variante collée est aussi interrogée et fusionnée.
 */
export async function companyCandidates(query, limit = 6) {
  const term = esc(query);
  if (!term || /^\d{9,14}$/.test(term)) return [];
  const variants = [term];
  if (term.includes(' ')) variants.push(term.replace(/\s+/g, ''));
  const seen = new Set(); const out = [];
  for (const v of variants) {
    try {
      const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(v)}&page=1&per_page=${limit}`);
      if (!r.ok) continue;
      for (const e of (await r.json()).results || []) {
        if (seen.has(e.siren)) continue;
        seen.add(e.siren);
        out.push({
          siren: e.siren,
          nom: e.nom_raison_sociale || e.nom_complet,
          activite: e.libelle_activite_principale || e.activite_principale || '',
        });
      }
    } catch { /* variante suivante */ }
  }
  // les sociétés à gros effectif d'abord : heuristique simple, l'API classe déjà par pertinence
  return out.slice(0, limit * 2);
}

/** Nom ou identifiant → {siren, nom} (meilleure correspondance), ou null. */
export async function resolveCompany(query) {
  const term = esc(query);
  if (!term) return null;
  if (/^\d{9,14}$/.test(term)) return { siren: term.slice(0, 9), nom: null };
  const c = await companyCandidates(term, 1);
  return c[0] ? { siren: c[0].siren, nom: c[0].nom } : null;
}

/** Résout une liste de SIRET/SIREN en noms, avec cache et rate-limit. */
export async function resolveNames(ids) {
  const uniq = [...new Set(ids.filter(id => id && /^\d{9,14}$/.test(String(id))))]
    .filter(id => !nameCache.has(id));
  for (let i = 0; i < uniq.length; i += 5) {
    await Promise.all(uniq.slice(i, i + 5).map(async id => {
      try {
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${id}&page=1&per_page=1`);
        if (!r.ok) throw new Error(r.status);
        const e = (await r.json()).results?.[0];
        nameCache.set(id, e ? (e.nom_raison_sociale || e.nom_complet || null) : null);
      } catch { nameCache.set(id, null); }
    }));
    if (i + 5 < uniq.length) await new Promise(res => setTimeout(res, 900));
  }
  return Object.fromEntries(ids.map(id => [id, nameCache.get(id) ?? null]));
}
