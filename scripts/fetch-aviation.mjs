#!/usr/bin/env node
/**
 * Collecte aviation privée (GitHub Actions — côté serveur, pas de CORS).
 * Écrit :
 *  - src/data/aviation-live.json : dernier instantané avec positions
 *  - src/data/aviation-30j.json  : jours d'activité par immatriculation (30 j glissants)
 * Requêtes espacées (l'API 429 en cas de rafale). Aucune identification de propriétaire.
 */
import { readFile, writeFile } from 'node:fs/promises';

const TYPES = [
  ['GLF6','Gulfstream G650'],['GLF5','Gulfstream G550'],['GA6C','Gulfstream G600'],
  ['GL7T','Global 7500'],['GLEX','Global Express'],['GL5T','Global 5000'],
  ['FA8X','Falcon 8X'],['FA7X','Falcon 7X'],['F2TH','Falcon 2000'],['F900','Falcon 900'],
  ['CL35','Challenger 350'],['CL60','Challenger 600'],['C750','Citation X'],
  ['C68A','Citation Latitude'],['C700','Citation Longitude'],['C56X','Citation XLS'],
  ['E55P','Phenom 300'],['E545','Legacy 450/500'],['PC24','Pilatus PC-24'],
];
const LIVE = new URL('../src/data/aviation-live.json', import.meta.url);
const HIST = new URL('../src/data/aviation-30j.json', import.meta.url);
const today = new Date().toISOString().slice(0, 10);

const ac = [];
for (const [code, label] of TYPES) {
  try {
    const r = await fetch(`https://api.adsb.lol/v2/type/${code}`, { headers: { 'user-agent': 'data-france-collect (observatoire open data)' } });
    if (r.ok) {
      for (const a of (await r.json()).ac || []) {
        ac.push({
          hex: a.hex, r: a.r || null, t: code, label,
          flight: a.flight ? String(a.flight).trim() : null,
          lat: a.lat ?? null, lon: a.lon ?? null,
          alt: a.alt_baro ?? null, gs: a.gs ?? null, track: a.track ?? null,
        });
      }
    } else console.warn(code, r.status);
  } catch (e) { console.warn(code, e.message); }
  await new Promise(res => setTimeout(res, 1500)); // politesse anti-429
}
await writeFile(LIVE, JSON.stringify({ ts: new Date().toISOString(), ac }));

let db = { days: {} };
try { db = JSON.parse(await readFile(HIST, 'utf8')); } catch { /* premier run */ }
const seen = db.days[today] || {};
for (const a of ac) {
  const reg = a.r || a.hex;
  if (reg) seen[reg] = { t: a.t, n: (seen[reg]?.n || 0) + 1 }; // n = passages captés ce jour
}
db.days[today] = seen;
/* Nombre de collectes réellement exécutées chaque jour : GitHub saute des crons
   (parfois massivement), la page pondère donc chaque passage par 24 h ÷ collectes
   du jour au lieu de supposer une cadence fixe de 30 min. */
db.runs = db.runs || {};
db.runs[today] = (db.runs[today] || 0) + 1;
const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
for (const d of Object.keys(db.days)) if (d < cutoff) delete db.days[d];
for (const d of Object.keys(db.runs)) if (d < cutoff) delete db.runs[d];
const agg = {};
for (const day of Object.values(db.days))
  for (const [reg, info] of Object.entries(day)) {
    agg[reg] = agg[reg] || { days: 0, snaps: 0, type: info.t };
    agg[reg].days += 1;
    agg[reg].snaps += info.n || 1; // rétro-compatible avec les données déjà collectées
  }
db.top = Object.entries(agg)
  .sort((a, b) => b[1].snaps - a[1].snaps || b[1].days - a[1].days)
  .slice(0, 100).map(([reg, v]) => ({ reg, ...v }));
db.updated = today;
await writeFile(HIST, JSON.stringify(db));
console.log(`✓ ${ac.length} appareils dans l'instantané, ${db.top.length} au top 30 j`);
