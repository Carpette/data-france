#!/usr/bin/env node
/**
 * Collecte nocturne aviation privée (GitHub Actions).
 * Interroge api.adsb.lol par type d'appareil, accumule un compteur d'activité
 * par immatriculation dans src/data/aviation-30j.json (fenêtre glissante 30 jours).
 * Aucune identification de propriétaire : immatriculations et types uniquement.
 */
import { readFile, writeFile } from 'node:fs/promises';

const TYPES = ['GLF6','GLF5','GA6C','GL7T','GLEX','GL5T','FA8X','FA7X','F2TH','F900',
  'CL35','CL60','C750','C68A','C700','C56X','E55P','E545','PC24'];
const OUT = new URL('../src/data/aviation-30j.json', import.meta.url);
const today = new Date().toISOString().slice(0, 10);

let db = { days: {} };
try { db = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* premier run */ }

const seen = {};
for (const t of TYPES) {
  try {
    const r = await fetch(`https://api.adsb.lol/v2/type/${t}`, { headers: { 'user-agent': 'data-france-collect' } });
    if (!r.ok) continue;
    for (const a of (await r.json()).ac || []) {
      const reg = a.r || a.hex;
      if (reg) seen[reg] = { t, hex: a.hex };
    }
    await new Promise(res => setTimeout(res, 800));
  } catch (e) { console.warn(t, e.message); }
}
db.days[today] = seen;
// fenêtre glissante 30 jours
const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
for (const d of Object.keys(db.days)) if (d < cutoff) delete db.days[d];
// agrégat : jours d'activité par immatriculation
const agg = {};
for (const day of Object.values(db.days))
  for (const [reg, info] of Object.entries(day)) {
    agg[reg] = agg[reg] || { days: 0, type: info.t };
    agg[reg].days += 1;
  }
db.top = Object.entries(agg).sort((a, b) => b[1].days - a[1].days).slice(0, 100)
  .map(([reg, v]) => ({ reg, ...v }));
db.updated = today;
await writeFile(OUT, JSON.stringify(db));
console.log(`aviation-30j.json ✓ ${Object.keys(seen).length} appareils vus aujourd'hui, ${Object.keys(db.days).length} jours en fenêtre`);
