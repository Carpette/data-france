import React, { useEffect, useMemo, useState } from 'react';
import ReportButton from '../components/ReportButton.jsx';
import WorldMap from '../components/WorldMap.jsx';
import LIVE from '../data/aviation-live.json';
import HIST from '../data/aviation-30j.json';

/**
 * Les API ADS-B (adsb.lol…) n'envoient pas d'en-têtes CORS : impossible de les
 * interroger depuis le navigateur. La collecte se fait donc côté serveur
 * (GitHub Action, scripts/fetch-aviation.mjs) qui commite un instantané —
 * chaque commit redéclenche le déploiement, la page est donc reconstruite
 * avec les données fraîches.
 */
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const TYPE_LABELS = {
  GLF6: 'Gulfstream G650', GLF5: 'Gulfstream G550', GA6C: 'Gulfstream G600',
  GL7T: 'Global 7500', GLEX: 'Global Express', GL5T: 'Global 5000',
  FA8X: 'Falcon 8X', FA7X: 'Falcon 7X', F2TH: 'Falcon 2000', F900: 'Falcon 900',
  CL35: 'Challenger 350', CL60: 'Challenger 600', C750: 'Citation X',
  C68A: 'Citation Latitude', C700: 'Citation Longitude', C56X: 'Citation XLS',
  E55P: 'Phenom 300', E545: 'Legacy 450/500', PC24: 'Pilatus PC-24',
};
/* Estimation d'heures de vol : 1 passage capté ≈ 30 min (cadence de collecte). */
const SNAP_H = 0.5;
/* Ordres de grandeur d'émissions par classe (t CO₂/heure de vol, kérosène ~3,16 kg CO₂/kg brûlé). */
const CO2_RATE = {
  GLF6: 3.9, GLF5: 3.6, GA6C: 3.7, GL7T: 4.0, GLEX: 3.8, GL5T: 3.6,
  FA8X: 3.2, FA7X: 3.1, F900: 2.9, F2TH: 2.6, CL60: 2.8, CL35: 2.4,
  C750: 2.6, C700: 2.0, C68A: 1.8, C56X: 1.7, E545: 1.7, E55P: 1.4, PC24: 1.3,
};
/* Préfixes d'immatriculation → pavillon (les plus longs d'abord). ⚑ = pavillon de complaisance notoire. */
const NAT = [
  ['VP-B','Bermudes ⚑'],['VQ-B','Bermudes ⚑'],['CS-','Portugal'],['C-','Canada'],
  ['M-','Île de Man ⚑'],['MM','Italie (militaire)'],['T7-','Saint-Marin ⚑'],['P4-','Aruba ⚑'],
  ['9H-','Malte ⚑'],['F-','France'],['G-','Royaume-Uni'],['D-','Allemagne'],['I-','Italie'],
  ['EC-','Espagne'],['PH-','Pays-Bas'],['OO-','Belgique'],['LX-','Luxembourg'],['HB-','Suisse'],
  ['OE-','Autriche'],['OY-','Danemark'],['SE-','Suède'],['LN-','Norvège'],['EI-','Irlande'],
  ['SP-','Pologne'],['OK-','Tchéquie'],['TC-','Turquie'],['SX-','Grèce'],['5B-','Chypre'],
  ['A6-','Émirats'],['A7-','Qatar'],['HZ-','Arabie saoudite'],['4X-','Israël'],
  ['JA','Japon'],['VH-','Australie'],['VT-','Inde'],['ZS-','Afrique du Sud'],
  ['PR-','Brésil'],['PP-','Brésil'],['PS-','Brésil'],['XA-','Mexique'],['XB-','Mexique'],
  ['B-','Chine/Taïwan'],['RA-','Russie'],['N','États-Unis'],
];
const natOf = reg => {
  if (!reg) return 'Inconnu';
  for (const [p, c] of NAT) if (reg.startsWith(p)) return c;
  return 'Autre / militaire';
};
const fmtH = h => h >= 100 ? Math.round(h).toLocaleString('fr-FR') : (Math.round(h * 10) / 10).toLocaleString('fr-FR');
const regLinks = r => {
  if (!r) return [];
  const L = [];
  if (r.startsWith('N')) L.push(['Registre FAA (US)', `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${r}`]);
  if (r.startsWith('F-')) L.push(['Registre DGAC (FR)', 'https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html']);
  if (r.startsWith('G-')) L.push(['Registre CAA (UK)', 'https://siteapps.caa.co.uk/g-info/']);
  L.push(['Planespotters', `https://www.planespotters.net/search?q=${encodeURIComponent(r)}`]);
  return L;
};
/* Favoris — stockés uniquement dans le navigateur (localStorage), jamais transmis. */
const FAV_KEY = 'df-favoris-aviation';
const readFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; }
};
function useFavorites() {
  const [favs, setFavs] = useState(readFavs);
  useEffect(() => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch { /* stockage plein/privé */ }
  }, [favs]);
  const has = reg => favs.some(f => f.reg === reg);
  const toggle = (reg, meta = {}) => setFavs(f =>
    f.some(x => x.reg === reg) ? f.filter(x => x.reg !== reg)
      : [...f, { reg, ...meta, addedAt: new Date().toISOString().slice(0, 10) }]);
  const nameOf = reg => favs.find(f => f.reg === reg)?.name || null;
  const rename = (reg, name) => setFavs(f => f.map(x =>
    x.reg === reg ? { ...x, name: (name || '').trim() || undefined } : x));
  return { favs, has, toggle, nameOf, rename };
}
const Star = ({ on, onClick }) => (
  <button onClick={e => { e.stopPropagation(); onClick(); }}
    title={on ? 'Retirer des favoris' : 'Ajouter aux favoris (stocké dans votre navigateur uniquement)'}
    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px',
      color: on ? '#eda100' : 'var(--muted)' }}>
    {on ? '★' : '☆'}
  </button>
);
/* Surnom d'un favori — affichage à côté de l'immatriculation. */
const Nick = ({ name }) => name
  ? <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400 }}> « {name} »</span>
  : null;
/* Édition inline du surnom (Entrée = valider, Échap = annuler, vide = retirer). */
function NickEditor({ name, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  if (!editing) return (
    <button onClick={() => { setVal(name || ''); setEditing(true); }}
      title={name ? 'Modifier le surnom' : 'Donner un surnom (stocké dans votre navigateur uniquement)'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
        fontSize: 13, padding: '0 4px' }}>✎</button>
  );
  const save = () => { onSave(val); setEditing(false); };
  return (
    <input autoFocus value={val} onChange={e => setVal(e.target.value)} maxLength={40}
      placeholder="surnom (vide = retirer)"
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      onBlur={save}
      style={{ fontSize: 12.5, padding: '2px 6px', border: '1px solid var(--grid)', borderRadius: 6,
        background: 'transparent', color: 'var(--ink)', width: 160, marginLeft: 6 }} />
  );
}
const age = ts => {
  if (!ts) return null;
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  return m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`;
};

export default function Aviation() {
  const [tab, setTab] = useState('live');
  const [expNat, setExpNat] = useState(null);
  const [expType, setExpType] = useState(null);
  const { favs, has, toggle, nameOf, rename } = useFavorites();
  const rows = LIVE.ac || [];
  const [q, setQ] = useState('');
  /* Index de toutes les immatriculations connues : journal 30 j + instantané en direct. */
  const fleetIndex = useMemo(() => {
    const seen = {};
    Object.values(HIST.days || {}).forEach(day =>
      Object.entries(day).forEach(([reg, info]) => {
        seen[reg] = seen[reg] || { reg, type: info.t, days: 0, snaps: 0 };
        seen[reg].days += 1; seen[reg].snaps += info.n || 1;
      }));
    (LIVE.ac || []).forEach(a => {
      const reg = a.r || a.hex;
      if (reg && !seen[reg]) seen[reg] = { reg, type: a.t, days: 0, snaps: 0, liveOnly: true };
    });
    return Object.values(seen);
  }, []);
  const byType = {};
  rows.forEach(a => { byType[a.label || a.t] = (byType[a.label || a.t] || 0) + 1; });

  return (
    <div>
      <h1>Jets privés — dernier instantané du ciel</h1>
      <p className="sub">Jets d’affaires captés par le réseau communautaire ADS-B (adsb.lol), collectés
        côté serveur plusieurs fois par jour ({Object.keys(TYPE_LABELS).length} types d’appareils).
        Chaque ligne donne l’immatriculation et des liens vers les registres publics : nous fournissons
        l’outil, pas l’identification des propriétaires.</p>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="hint" style={{ margin: 0 }}>
          {LIVE.ts
            ? <>instantané du {new Date(LIVE.ts).toLocaleString('fr-FR')} ({age(LIVE.ts)}) · {rows.length} appareils en vol</>
            : 'aucun instantané encore collecté — la première collecte automatique (GitHub Action) le remplira'}
        </span>
        <div style={{ marginLeft: 'auto' }}><ReportButton context={`aviation, snapshot ${LIVE.ts || 'vide'}`} /></div>
      </div>
      <div className="tabs">
        <button className="tab" aria-selected={tab === 'live'} onClick={() => setTab('live')}>Dernier instantané</button>
        <button className="tab" aria-selected={tab === 'top'} onClick={() => setTab('top')}>
          Les plus actifs (30 jours{HIST.updated ? `, maj ${HIST.updated}` : ''})</button>
        <button className="tab" aria-selected={tab === 'favs'} onClick={() => setTab('favs')}>
          ★ Mes favoris ({favs.length})</button>
        <button className="tab" aria-selected={tab === 'stats'} onClick={() => setTab('stats')}>Statistiques</button>
      </div>

      {tab === 'live' && <>
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Carte — survolez un appareil (orienté selon son cap) · 🌙 zone de nuit au moment de l’instantané</h2>
          <WorldMap nightAt={LIVE.ts} markers={rows.map(a => ({
            lat: a.lat, lon: a.lon,
            icon: '✈️', rot: ((a.track ?? 45) - 45), size: 20,
            html: `<strong>${esc(a.r || a.hex)}</strong> · ${esc(a.label || a.t)}` +
              `<br/>${a.alt ? Math.round(a.alt * 0.3048).toLocaleString('fr-FR') + ' m' : 'altitude n.c.'}` +
              `${a.gs ? ' · ' + Math.round(a.gs * 1.852) + ' km/h' : ''}` +
              `${a.flight ? '<br/>vol ' + esc(a.flight) : ''}`,
          }))} />
          <p className="hint">La zone assombrie est la nuit à l’heure de la collecte : une carte vide
            d’avions sur l’Asie à 16 h de Paris reflète d’abord le fuseau horaire. S’y ajoute un second
            biais, celui de la couverture : le réseau ADS-B communautaire a bien plus de récepteurs en
            Europe et en Amérique du Nord qu’ailleurs.</p>
        </div>
        <div className="grid2">
          <div className="card">
            <h2>Appareils ({rows.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 640, overflow: 'auto' }}>
              {rows.map((a, i) => (
                <div key={a.hex + i} style={{ borderBottom: '1px solid var(--grid)', padding: '8px 4px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span><Star on={has(a.r || a.hex)} onClick={() => toggle(a.r || a.hex, { hex: a.hex, type: a.t })} />
                      <strong>{a.r || a.hex}</strong><Nick name={nameOf(a.r || a.hex)} /> <span style={{ color: 'var(--muted)' }}>· {a.label || a.t}</span></span>
                    <span style={{ color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                      {a.alt ? `${Math.round(a.alt * 0.3048).toLocaleString('fr-FR')} m` : '—'}
                      {a.gs ? ` · ${Math.round(a.gs * 1.852)} km/h` : ''}
                    </span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {a.flight && <span>vol {a.flight}</span>}
                    <a target="_blank" rel="noopener" href={`https://globe.adsb.lol/?icao=${a.hex}`}>suivre sur la carte</a>
                    {regLinks(a.r).map(([l, u]) => <a key={l} href={u} target="_blank" rel="noopener">{l}</a>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Par type d’appareil</h2>
            <table className="data">
              <thead><tr><th>Type</th><th>En vol</th></tr></thead>
              <tbody>
                {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <tr key={t}><td>{t}</td><td>{n}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="warnbox" style={{ marginTop: 16 }}>
              <strong>Méthode et limites :</strong> instantané collecté par GitHub Action (les API ADS-B
              n’autorisent pas les appels directs depuis un navigateur — CORS). Couverture partielle
              (océans invisibles), transpondeurs anonymisés possibles (programme PIA), et une
              immatriculation identifie un appareil — souvent détenu par une société de gestion —
              pas une personne. Ordre de grandeur : un jet d’affaires émet ~2 à 6 t de CO₂ par heure
              de vol, 10 à 30 fois plus par passager qu’un vol commercial.
            </div>
          </div>
        </div>
      </>}

      {tab === 'favs' && (() => {
        const favLive = rows.filter(a => has(a.r || a.hex));
        return (<>
        {favs.length > 0 && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h2>Carte — vos favoris captés au dernier instantané ({favLive.length}/{favs.length}) · 🌙 zone de nuit</h2>
            {favLive.length ? (
              <WorldMap nightAt={LIVE.ts} markers={favLive.map(a => ({
                lat: a.lat, lon: a.lon,
                icon: '✈️', rot: ((a.track ?? 45) - 45), size: 24,
                html: `<strong>★ ${esc(a.r || a.hex)}</strong>` +
                  `${nameOf(a.r || a.hex) ? ' « ' + esc(nameOf(a.r || a.hex)) + ' »' : ''}` +
                  ` · ${esc(a.label || a.t)}` +
                  `<br/>${a.alt ? Math.round(a.alt * 0.3048).toLocaleString('fr-FR') + ' m' : 'altitude n.c.'}` +
                  `${a.gs ? ' · ' + Math.round(a.gs * 1.852) + ' km/h' : ''}` +
                  `${a.flight ? '<br/>vol ' + esc(a.flight) : ''}`,
              }))} />
            ) : (
              <p className="hint">Aucun de vos favoris n’était en vol (ou capté par le réseau) au moment
                du dernier instantané — la carte réapparaîtra dès qu’un favori sera capté.</p>
            )}
          </div>
        )}
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>Rechercher une immatriculation</h2>
          <p className="hint" style={{ marginTop: 0 }}>Cherche dans tout ce que la collecte connaît :
            journal 30 jours complet ({fleetIndex.filter(x => !x.liveOnly).length.toLocaleString('fr-FR')} appareils)
            + dernier instantané — y compris les appareils au sol ou hors top 100. Étoilez un résultat
            pour le suivre, puis donnez-lui un surnom (✎) dans le tableau ci-dessous.</p>
          <input value={q} onChange={e => setQ(e.target.value)} maxLength={12}
            placeholder="ex. F-HXYZ, N123, 9H… (2 caractères min, tirets ignorés)"
            style={{ fontSize: 14, padding: '6px 10px', border: '1px solid var(--grid)', borderRadius: 8,
              background: 'transparent', color: 'var(--ink)', width: 320, maxWidth: '100%' }} />
          {(() => {
            const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            const nq = norm(q);
            if (nq.length < 2) return null;
            const res = fleetIndex.filter(x => norm(x.reg).includes(nq))
              .sort((a, b) => b.snaps - a.snaps);
            return (
              <div style={{ marginTop: 10 }}>
                <p className="hint" style={{ margin: '0 0 6px' }}>{res.length.toLocaleString('fr-FR')} résultat{res.length > 1 ? 's' : ''}
                  {res.length > 40 ? ' — les 40 plus vus affichés, affinez la recherche' : ''}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 220, overflowY: 'auto' }}>
                  {res.slice(0, 40).map(x => (
                    <span key={x.reg} style={{ border: '1px solid var(--hair)', borderRadius: 8,
                      padding: '3px 8px', fontSize: 12.5, background: 'var(--surface)' }}>
                      <Star on={has(x.reg)} onClick={() => toggle(x.reg, { type: x.type })} />
                      <strong>{x.reg}</strong><Nick name={nameOf(x.reg)} />
                      <span style={{ color: 'var(--muted)' }}> · {TYPE_LABELS[x.type] || x.type}
                        {x.liveOnly ? ' · en vol (instantané)' : ` · vu ${x.days} j / ${fmtH(x.snaps * SNAP_H)} h est.`}</span>
                      {' '}<a href={`https://www.planespotters.net/search?q=${encodeURIComponent(x.reg)}`}
                        target="_blank" rel="noopener">fiche</a>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
        <div className="card">
          <h2>Immatriculations suivies</h2>
          {!favs.length && <p className="hint">Aucun favori — cliquez sur ☆ à côté d’une immatriculation
            (instantané ou classement 30 jours) pour la suivre ici.</p>}
          <table className="data">
            <thead><tr><th>Immatriculation</th><th>Type</th><th>Statut (dernier instantané)</th><th>Suivi & registres</th><th></th></tr></thead>
            <tbody>
              {favs.map(f => {
                const live = rows.find(a => (a.r || a.hex) === f.reg);
                return (
                  <tr key={f.reg}>
                    <td style={{ fontWeight: 600 }}>{f.reg}<Nick name={f.name} />
                      <NickEditor name={f.name} onSave={v => rename(f.reg, v)} /></td>
                    <td>{TYPE_LABELS[f.type] || f.type || '—'}</td>
                    <td>{live
                      ? `en vol · ${live.alt ? Math.round(live.alt * 0.3048).toLocaleString('fr-FR') + ' m' : 'alt. n.c.'}${live.gs ? ' · ' + Math.round(live.gs * 1.852) + ' km/h' : ''}`
                      : 'non capté'}</td>
                    <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {(live?.hex || f.hex) && <a target="_blank" rel="noopener"
                        href={`https://globe.adsb.lol/?icao=${live?.hex || f.hex}`}>carte temps réel</a>}
                      {regLinks(f.reg).map(([l, u]) => <a key={l} href={u} target="_blank" rel="noopener">{l}</a>)}
                    </td>
                    <td><Star on onClick={() => toggle(f.reg)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">Vos favoris — et leurs surnoms — sont stockés uniquement dans ce navigateur
            (localStorage), rien n’est transmis au site ni à quiconque. Le statut se rafraîchit à chaque
            nouvel instantané collecté. ✎ pour donner un surnom (Entrée = valider, vide = retirer).</p>
        </div>
        </>);
      })()}

      {tab === 'stats' && (() => {
        /* Statistiques sur TOUS les appareils captés sur 30 j (journal quotidien complet),
           pas seulement le top 100 — qui reste un simple classement. */
        const journal = fleetIndex.filter(x => !x.liveOnly);
        const fleet = journal.length ? journal : (HIST.top || []);
        const hoursOf = t => (t.snaps ?? t.days) * SNAP_H;
        const co2Of = t => hoursOf(t) * (CO2_RATE[t.type] || 2.5);
        const totH = fleet.reduce((a, t) => a + hoursOf(t), 0);
        const totC = fleet.reduce((a, t) => a + co2Of(t), 0);
        const byNat = {}, byType = {};
        fleet.forEach(t => {
          const n = natOf(t.reg);
          byNat[n] = byNat[n] || { n: 0, h: 0, c: 0, regs: [] };
          byNat[n].n += 1; byNat[n].h += hoursOf(t); byNat[n].c += co2Of(t); byNat[n].regs.push(t);
          const ty = TYPE_LABELS[t.type] || t.type;
          byType[ty] = byType[ty] || { n: 0, h: 0, c: 0, nats: {} };
          byType[ty].n += 1; byType[ty].h += hoursOf(t); byType[ty].c += co2Of(t);
          byType[ty].nats[n] = (byType[ty].nats[n] || 0) + 1;
        });
        const flagged = Object.entries(byNat).filter(([k]) => k.includes('⚑'));
        const pctFlag = fleet.length ? Math.round(flagged.reduce((a, [, v]) => a + v.n, 0) / fleet.length * 100) : 0;
        return (
          <div>
            <div className="kpis">
              <div className="kpi"><div className="v">{fleet.length.toLocaleString('fr-FR')}</div>
                <div className="l">appareils distincts captés (30 j)</div>
                <div className="n">toutes les immatriculations vues, pas seulement le top 100</div></div>
              <div className="kpi"><div className="v">{fmtH(totH)} h</div>
                <div className="l">heures de vol estimées (30 j)</div>
                <div className="n">instantanés × 30 min, tous appareils captés</div></div>
              <div className="kpi"><div className="v">{fmtH(totC)} t</div>
                <div className="l">CO₂ estimé (30 j)</div>
                <div className="n">≈ {Math.round(totC / 9).toLocaleString('fr-FR')} années d’émissions d’un Français moyen (9 t/an)</div></div>
              <div className="kpi"><div className="v">{pctFlag} %</div>
                <div className="l">sous pavillon de complaisance ⚑</div>
                <div className="n">Île de Man, Malte, Bermudes, Saint-Marin, Aruba</div></div>
            </div>
            <p className="hint">Périmètre : l’intégralité des immatriculations captées par la collecte
              sur 30 jours glissants ({fleet.length.toLocaleString('fr-FR')} appareils). L’onglet
              « Les plus actifs » reste, lui, un classement limité aux 100 premiers. Un même appareil
              peut être capté plusieurs fois ; « appareils » compte les immatriculations distinctes.</p>
            {!fleet.length && <div className="warnbox">Statistiques vides pour l’instant — elles se
              construisent au fil des collectes automatiques (jusqu’à 30 jours d’historique).</div>}
            <div className="grid2">
              <div className="card">
                <h2>Par pavillon (préfixe d’immatriculation)</h2>
                <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>⚑ = pavillon de complaisance
                  notoire de l’aviation d’affaires (fiscalité avantageuse, opacité de propriété). Le pavillon
                  dit où l’appareil est immatriculé, pas qui vole dedans. Cliquez sur une ligne pour voir
                  les immatriculations.</p>
                <table className="data">
                  <thead><tr><th>Pavillon</th><th>Appareils</th><th>Heures est.</th><th>CO₂ est. (t)</th></tr></thead>
                  <tbody>
                    {Object.entries(byNat).sort((a, b) => b[1].c - a[1].c).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpNat(expNat === k ? null : k)}>
                          <td>{expNat === k ? '▾ ' : '▸ '}{k.replace(' ⚑', '')}
                            {k.includes('⚑') && <span title="Pavillon de complaisance : immatriculation choisie pour la fiscalité et la discrétion" style={{ cursor: 'help' }}> ⚑</span>}</td>
                          <td>{v.n}</td><td>{fmtH(v.h)}</td><td>{fmtH(v.c)}</td>
                        </tr>
                        {expNat === k && (
                          <tr><td colSpan={4} style={{ textAlign: 'left', background: 'var(--surface-2)' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0',
                              maxHeight: 220, overflowY: 'auto' }}>
                              {v.regs.sort((a, b) => (b.snaps ?? b.days) - (a.snaps ?? a.days)).map(t => (
                                <span key={t.reg} style={{ border: '1px solid var(--hair)', borderRadius: 8, padding: '3px 8px', fontSize: 12, background: 'var(--surface)' }}>
                                  <Star on={has(t.reg)} onClick={() => toggle(t.reg, { type: t.type })} />
                                  <a href={`https://www.planespotters.net/search?q=${encodeURIComponent(t.reg)}`}
                                    target="_blank" rel="noopener" style={{ fontWeight: 600 }}>{t.reg}</a><Nick name={nameOf(t.reg)} />
                                  <span style={{ color: 'var(--muted)' }}> · {TYPE_LABELS[t.type] || t.type} · {fmtH(hoursOf(t))} h</span>
                                </span>
                              ))}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h2>Par type d’appareil</h2>
                <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>Cliquez sur une ligne
                  pour voir la répartition par pavillon.</p>
                <table className="data">
                  <thead><tr><th>Type</th><th>Appareils</th><th>Heures est.</th><th>CO₂ est. (t)</th></tr></thead>
                  <tbody>
                    {Object.entries(byType).sort((a, b) => b[1].c - a[1].c).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpType(expType === k ? null : k)}>
                          <td>{expType === k ? '▾ ' : '▸ '}{k}</td>
                          <td>{v.n}</td><td>{fmtH(v.h)}</td><td>{fmtH(v.c)}</td>
                        </tr>
                        {expType === k && (
                          <tr><td colSpan={4} style={{ textAlign: 'left', background: 'var(--surface-2)' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '4px 0' }}>
                              {Object.entries(v.nats).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
                                <span key={n} style={{ border: '1px solid var(--hair)', borderRadius: 8, padding: '3px 8px', fontSize: 12, background: 'var(--surface)' }}>
                                  {n} <strong>{c}</strong>
                                </span>
                              ))}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div className="warnbox" style={{ marginTop: 12 }}>
                  <strong>Méthode (estimations, ±30 %) :</strong> heures = instantanés en vol × 30 min ;
                  CO₂ = heures × taux par classe (1,3 t/h pour un PC-24 à 4 t/h pour un Global 7500,
                  d’après les consommations constructeur et 3,16 kg de CO₂ par kg de kérosène).
                  Sous-estimation structurelle : vols de nuit et sauts courts non captés. Statistiques
                  calculées sur des aéronefs (objets), aucune donnée personnelle.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {tab === 'top' && (
        <div className="card">
          <h2>Immatriculations les plus vues en vol (fenêtre 30 jours)</h2>
          {!(HIST.top || []).length && <p className="hint">Vide pour l’instant — se remplit au fil des
            collectes automatiques ; comptez quelques jours pour un classement parlant.</p>}
          <p className="hint" style={{ marginTop: 0 }}>« Heures de vol estimées » = instantanés en vol ×
            30 min (la cadence de collecte) : capté 5 fois ≈ 2 h 30 de vol. Sous-estime les vols courts
            entre deux collectes et la nuit (pas de collecte). CO₂ : heures × taux par classe d’appareil
            (~1,3 à 4 t/h), ordre de grandeur ±30 %.</p>
          <table className="data">
            <thead><tr><th>#</th><th>Immatriculation</th><th>Type</th><th>Heures de vol est.</th><th>CO₂ est. (t)</th><th>Jours vus</th><th>Registres</th></tr></thead>
            <tbody>
              {(HIST.top || []).map((t, i) => (
                <tr key={t.reg}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}><Star on={has(t.reg)} onClick={() => toggle(t.reg, { type: t.type })} /> {t.reg}<Nick name={nameOf(t.reg)} /></td>
                  <td>{TYPE_LABELS[t.type] || t.type}</td>
                  <td>{fmtH((t.snaps ?? t.days) * SNAP_H)} h</td>
                  <td>{fmtH((t.snaps ?? t.days) * SNAP_H * (CO2_RATE[t.type] || 2.5))}</td>
                  <td>{t.days}</td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {regLinks(t.reg).map(([l, u]) => <a key={l} href={u} target="_blank" rel="noopener">{l}</a>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
