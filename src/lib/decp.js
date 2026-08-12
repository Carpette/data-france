/**
 * Accès à la base DECP (données essentielles de la commande publique)
 * via l'API Opendatasoft Explore v2.1 de data.economie.gouv.fr.
 *
 * ⚠ SCHÉMA À VALIDER : les noms de champs ci-dessous (FIELDS) correspondent au
 * schéma attendu du dataset `decp-2022-marches-valides`. Si l'API renvoie
 * d'autres noms, ajuster UNIQUEMENT cette constante — tout le reste s'adapte.
 * Pour inspecter le schéma réel :
 *   https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp-2022-marches-valides/records?limit=1
 */
export const BASE = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets';
export const DATASET = 'decp-2022-marches-valides';

export const FIELDS = {
  objet: 'objet',
  montant: 'montant',
  dateNotification: 'datenotification',
  acheteurNom: 'acheteur_nom',
  acheteurId: 'acheteur_id',
  titulaireNom: 'titulaire_denominationsociale',
  titulaireId: 'titulaire_id',
  procedure: 'procedure',
  nature: 'nature',
  codeCPV: 'codecpv',
  dureeMois: 'dureemois',
};

async function ods(path, params) {
  const url = `${BASE}/${DATASET}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status} — ${url}`);
  return r.json();
}

/** Recherche plein-texte + tri, renvoie {total_count, results} */
export function searchMarches({ q = '', orderBy = `${FIELDS.montant} desc`, limit = 20, offset = 0, where = '' }) {
  const params = { limit, offset, order_by: orderBy };
  const w = [];
  if (q) w.push(`search("${q.replace(/"/g, '')}")`);
  if (where) w.push(where);
  if (w.length) params.where = w.join(' AND ');
  return ods('records', params);
}

/** Agrégation par facette (ex. top fournisseurs) */
export function aggregate({ groupBy, q = '', limit = 15 }) {
  const params = {
    group_by: groupBy,
    select: `${groupBy}, count(*) as n, sum(${FIELDS.montant}) as total`,
    order_by: 'total desc', limit,
  };
  if (q) params.where = `search("${q.replace(/"/g, '')}")`;
  return ods('records', params);
}

/** Un enregistrement brut, pour l'explorateur de schéma */
export function sampleRecord() {
  return ods('records', { limit: 1 });
}
