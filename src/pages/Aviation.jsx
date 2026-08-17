import { useEffect, useState } from 'react';
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
  return { favs, has, toggle };
}
const Star = ({ on, onClick }) => (
  <button onClick={e => { e.stopPropagation(); onClick(); }}
    title={on ? 'Retirer des favoris' : 'Ajouter aux favoris (stocké dans votre navigateur uniquement)'}
    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '0 4px',
      color: on ? '#eda100' : 'var(--muted)' }}>
    {on ? '★' : '☆'}
  </button>
);
const age = ts => {
  if (!ts) return null;
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  return m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`;
};

export default function Aviation() {
  const [tab, setTab] = useState('live');
  const { favs, has, toggle } = useFavorites();
  const rows = LIVE.ac || [];
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
          <h2>Carte — survolez un appareil (orienté selon son cap)</h2>
          <WorldMap markers={rows.map(a => ({
            lat: a.lat, lon: a.lon,
            icon: '✈️', rot: ((a.track ?? 45) - 45), size: 20,
            html: `<strong>${esc(a.r || a.hex)}</strong> · ${esc(a.label || a.t)}` +
              `<br/>${a.alt ? Math.round(a.alt * 0.3048).toLocaleString('fr-FR') + ' m' : 'altitude n.c.'}` +
              `${a.gs ? ' · ' + Math.round(a.gs * 1.852) + ' km/h' : ''}` +
              `${a.flight ? '<br/>vol ' + esc(a.flight) : ''}`,
          }))} />
        </div>
        <div className="grid2">
          <div className="card">
            <h2>Appareils ({rows.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 640, overflow: 'auto' }}>
              {rows.map((a, i) => (
                <div key={a.hex + i} style={{ borderBottom: '1px solid var(--grid)', padding: '8px 4px', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span><Star on={has(a.r || a.hex)} onClick={() => toggle(a.r || a.hex, { hex: a.hex, type: a.t })} />
                      <strong>{a.r || a.hex}</strong> <span style={{ color: 'var(--muted)' }}>· {a.label || a.t}</span></span>
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

      {tab === 'favs' && (
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
                    <td style={{ fontWeight: 600 }}>{f.reg}</td>
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
          <p className="hint">Vos favoris sont stockés uniquement dans ce navigateur (localStorage) —
            rien n’est transmis au site ni à quiconque. Le statut se rafraîchit à chaque nouvel
            instantané collecté.</p>
        </div>
      )}

      {tab === 'stats' && (() => {
        const top = HIST.top || [];
        const hoursOf = t => (t.snaps ?? t.days) * SNAP_H;
        const co2Of = t => hoursOf(t) * (CO2_RATE[t.type] || 2.5);
        const totH = top.reduce((a, t) => a + hoursOf(t), 0);
        const totC = top.reduce((a, t) => a + co2Of(t), 0);
        const byNat = {}, byType = {};
        top.forEach(t => {
          const n = natOf(t.reg);
          byNat[n] = byNat[n] || { n: 0, h: 0, c: 0 };
          byNat[n].n += 1; byNat[n].h += hoursOf(t); byNat[n].c += co2Of(t);
          const ty = TYPE_LABELS[t.type] || t.type;
          byType[ty] = byType[ty] || { n: 0, h: 0, c: 0 };
          byType[ty].n += 1; byType[ty].h += hoursOf(t); byType[ty].c += co2Of(t);
        });
        const flagged = Object.entries(byNat).filter(([k]) => k.includes('⚑'));
        const pctFlag = top.length ? Math.round(flagged.reduce((a, [, v]) => a + v.n, 0) / top.length * 100) : 0;
        return (
          <div>
            <div className="kpis">
              <div className="kpi"><div className="v">{top.length}</div>
                <div className="l">appareils au top 100 (30 j)</div>
                <div className="n">parmi les jets captés par la collecte</div></div>
              <div className="kpi"><div className="v">{fmtH(totH)} h</div>
                <div className="l">heures de vol estimées (top 100)</div>
                <div className="n">instantanés × 30 min</div></div>
              <div className="kpi"><div className="v">{fmtH(totC)} t</div>
                <div className="l">CO₂ estimé (top 100, 30 j)</div>
                <div className="n">≈ {Math.round(totC / 9).toLocaleString('fr-FR')} années d’émissions d’un Français moyen (9 t/an)</div></div>
              <div className="kpi"><div className="v">{pctFlag} %</div>
                <div className="l">sous pavillon de complaisance ⚑</div>
                <div className="n">Île de Man, Malte, Bermudes, Saint-Marin, Aruba</div></div>
            </div>
            {!top.length && <div className="warnbox">Statistiques vides pour l’instant — elles se
              construisent sur le classement 30 jours, donc au fil des collectes automatiques.</div>}
            <div className="grid2">
              <div className="card">
                <h2>Par pavillon (préfixe d’immatriculation)</h2>
                <table className="data">
                  <thead><tr><th>Pavillon</th><th>Appareils</th><th>Heures est.</th><th>CO₂ est. (t)</th></tr></thead>
                  <tbody>
                    {Object.entries(byNat).sort((a, b) => b[1].c - a[1].c).map(([k, v]) => (
                      <tr key={k}><td>{k}</td><td>{v.n}</td><td>{fmtH(v.h)}</td><td>{fmtH(v.c)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="hint">⚑ = pavillons de complaisance notoires de l’aviation d’affaires
                  (fiscalité, opacité de propriété). Le pavillon indique où l’appareil est immatriculé,
                  pas la nationalité de ses occupants.</p>
              </div>
              <div className="card">
                <h2>Par type d’appareil</h2>
                <table className="data">
                  <thead><tr><th>Type</th><th>Appareils</th><th>Heures est.</th><th>CO₂ est. (t)</th></tr></thead>
                  <tbody>
                    {Object.entries(byType).sort((a, b) => b[1].c - a[1].c).map(([k, v]) => (
                      <tr key={k}><td>{k}</td><td>{v.n}</td><td>{fmtH(v.h)}</td><td>{fmtH(v.c)}</td></tr>
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
                  <td style={{ fontWeight: 600 }}><Star on={has(t.reg)} onClick={() => toggle(t.reg, { type: t.type })} /> {t.reg}</td>
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
