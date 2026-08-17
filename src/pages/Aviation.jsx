import { useState } from 'react';
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
const regLinks = r => {
  if (!r) return [];
  const L = [];
  if (r.startsWith('N')) L.push(['Registre FAA (US)', `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${r}`]);
  if (r.startsWith('F-')) L.push(['Registre DGAC (FR)', 'https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html']);
  if (r.startsWith('G-')) L.push(['Registre CAA (UK)', 'https://siteapps.caa.co.uk/g-info/']);
  L.push(['Planespotters', `https://www.planespotters.net/search?q=${encodeURIComponent(r)}`]);
  return L;
};
const age = ts => {
  if (!ts) return null;
  const m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  return m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`;
};

export default function Aviation() {
  const [tab, setTab] = useState('live');
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
                    <span><strong>{a.r || a.hex}</strong> <span style={{ color: 'var(--muted)' }}>· {a.label || a.t}</span></span>
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

      {tab === 'top' && (
        <div className="card">
          <h2>Immatriculations les plus vues en vol (fenêtre 30 jours)</h2>
          {!(HIST.top || []).length && <p className="hint">Vide pour l’instant — se remplit au fil des
            collectes automatiques (2 passages/jour) ; comptez quelques jours pour un classement parlant.</p>}
          <table className="data">
            <thead><tr><th>#</th><th>Immatriculation</th><th>Type</th><th>Jours vus en vol</th><th>Registres</th></tr></thead>
            <tbody>
              {(HIST.top || []).map((t, i) => (
                <tr key={t.reg}>
                  <td>{i + 1}</td><td style={{ fontWeight: 600 }}>{t.reg}</td>
                  <td>{TYPE_LABELS[t.type] || t.type}</td><td>{t.days}</td>
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
