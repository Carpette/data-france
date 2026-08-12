#!/usr/bin/env node
/**
 * Pré-calcul des données embarquées du site.
 * Exécuté par GitHub Actions (réseau ouvert) — le conteneur de dev peut ne pas
 * avoir accès aux portails ; dans ce cas les JSON existants sont conservés.
 *
 * Sources :
 *  - Canicule (jours + sévérité) : ODISSE / Santé publique France
 *  - Température TMax : ODRÉ (temperature-quotidienne-departementale)
 * Le budget COFOG (INSEE xlsx) est mis à jour manuellement : l'INSEE publie
 * une fois par an, sans URL stable de téléchargement direct.
 */
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../src/data/', import.meta.url);

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'data-france-build' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function odisse(datasetId) {
  // Export complet JSON du dataset ODISSE (Opendatasoft)
  return fetchJson(`https://odisse.santepubliquefrance.fr/api/explore/v2.1/catalog/datasets/${datasetId}/exports/json`);
}

function aggregate(rows, { yearKey, valueKey, codeKey, nameKey }) {
  const tot = {}, per = {}, names = {};
  for (const r of rows) {
    const c = r[codeKey], y = String(r[yearKey]), v = Number(r[valueKey]) || 0;
    if (!c) continue;
    tot[c] = (tot[c] || 0) + v;
    (per[c] ||= {})[y] = Math.round(v * 10) / 10;
    if (nameKey) names[c] = r[nameKey];
  }
  for (const c in tot) tot[c] = Math.round(tot[c] * 10) / 10;
  return { names, tot, per };
}

try {
  const jours = await odisse('canicules-nombres-de-jours-de-canicule-departement');
  const out = aggregate(jours, {
    yearKey: 'annee', valueKey: 'nombre_de_jours_de_canicule',
    codeKey: 'departement_code', nameKey: 'departement',
  });
  await writeFile(new URL('canicule-jours.json', OUT), JSON.stringify(out));
  console.log('canicule-jours.json ✓', Object.keys(out.tot).length, 'départements');

  const sev = await odisse('canicules-severite-departement');
  const outS = aggregate(sev, {
    yearKey: 'annee', valueKey: 'severite', codeKey: 'departement_code',
  });
  await writeFile(new URL('canicule-severite.json', OUT), JSON.stringify({ tot: outS.tot, per: outS.per }));
  console.log('canicule-severite.json ✓');
} catch (e) {
  console.warn('⚠ rafraîchissement impossible, JSON existants conservés :', e.message);
  process.exitCode = 0; // non bloquant
}
