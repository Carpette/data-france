import { useEffect, useState } from 'react';
import ReportButton from '../components/ReportButton.jsx';
import WorldMap from '../components/WorldMap.jsx';

/**
 * Aviation privée — vue « en vol maintenant » via l'API communautaire adsb.lol
 * (GET https://api.adsb.lol/v2/type/{ICAO} → { ac: [{hex, r, t, flight, lat, lon,
 * alt_baro, gs, ...}] }). Nous affichons immatriculations et liens vers les
 * registres publics — l'outil, pas l'identification.
 */
const TYPES = [
  ['GLF6', 'Gulfstream G650'], ['GLF5', 'Gulfstream G550'], ['GA6C', 'Gulfstream G600'],
  ['GL7T', 'Global 7500'], ['GLEX', 'Global Express'], ['GL5T', 'Global 5000'],
  ['FA8X', 'Falcon 8X'], ['FA7X', 'Falcon 7X'], ['F2TH', 'Falcon 2000'], ['F900', 'Falcon 900'],
  ['CL35', 'Challenger 350'], ['CL60', 'Challenger 600'], ['C750', 'Citation X'],
  ['C68A', 'Citation Latitude'], ['C700', 'Citation Longitude'], ['C56X', 'Citation XLS'],
  ['E55P', 'Phenom 300'], ['E545', 'Legacy 450/500'], ['PC24', 'Pilatus PC-24'],
];
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const regLinks = r => {
  if (!r) return [];
  const L = [];
  if (r.startsWith('N')) L.push(['Registre FAA (US)', `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${r}`]);
  if (r.startsWith('F-')) L.push(['Registre DGAC (FR)', 'https://immat.aviation-civile.gouv.fr/immat/servlet/aeronef_liste.html']);
  if (r.startsWith('G-')) L.push(['Registre CAA (UK)', `https://siteapps.caa.co.uk/g-info/`]);
  L.push(['Planespotters', `https://www.planespotters.net/search?q=${encodeURIComponent(r)}`]);
  L.push(['adsbdb', `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(r)}`]);
  return L;
};

export default function Aviation() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ts, setTs] = useState(null);

  const run = async () => {
    setLoading(true); setErr(null);
    try {
      const out = [];
      // petits lots séquentiels pour rester poli avec l'API communautaire
      for (let i = 0; i < TYPES.length; i += 4) {
        const batch = await Promise.all(TYPES.slice(i, i + 4).map(async ([code, label]) => {
          try {
            const r = await fetch(`https://api.adsb.lol/v2/type/${code}`);
            if (!r.ok) return [];
            const j = await r.json();
            return (j.ac || []).map(a => ({ ...a, typeLabel: label, typeCode: code }));
          } catch { return []; }
        }));
        out.push(...batch.flat());
      }
      out.sort((a, b) => (b.alt_baro || 0) - (a.alt_baro || 0));
      setRows(out); setTs(new Date().toLocaleTimeString('fr-FR'));
      if (!out.length) setErr('aucun appareil renvoyé — API indisponible ou filtrée sur ce réseau');
    } catch (e) { setErr(String(e.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { run(); }, []);

  const byType = {};
  (rows || []).forEach(a => { byType[a.typeLabel] = (byType[a.typeLabel] || 0) + 1; });

  return (
    <div>
      <h1>Jets privés — en vol en ce moment</h1>
      <p className="sub">Photographie en temps réel des jets d’affaires captés par le réseau
        communautaire ADS-B (adsb.lol), sur {TYPES.length} types d’appareils. Chaque ligne donne
        l’immatriculation et des liens vers les registres publics : nous fournissons l’outil,
        pas l’identification des propriétaires.</p>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Interrogation…' : 'Actualiser'}</button>
        {ts && <span className="hint" style={{ margin: 0 }}>instantané de {ts} · {(rows || []).length} appareils en vol</span>}
        <div style={{ marginLeft: 'auto' }}><ReportButton context={`aviation, ${(rows || []).length} appareils`} /></div>
      </div>
      {err && <div className="warnbox"><strong>Collecte incomplète</strong> — {err}.</div>}
      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Carte — survolez un appareil (orienté selon son cap)</h2>
        <WorldMap markers={(rows || []).map(a => ({
          lat: a.lat, lon: a.lon,
          icon: '✈️', rot: ((a.track ?? a.true_heading ?? 45) - 45), size: 20,
          html: `<strong>${esc(a.r || a.hex)}</strong> · ${esc(a.typeLabel)}` +
            `<br/>${a.alt_baro ? Math.round(a.alt_baro * 0.3048).toLocaleString('fr-FR') + ' m' : 'altitude n.c.'}` +
            `${a.gs ? ' · ' + Math.round(a.gs * 1.852) + ' km/h' : ''}` +
            `${a.flight ? '<br/>vol ' + esc(String(a.flight).trim()) : ''}`,
        }))} />
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Appareils en vol (tri : altitude)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 640, overflow: 'auto' }}>
            {(rows || []).map((a, i) => (
              <div key={a.hex + i} style={{ borderBottom: '1px solid var(--grid)', padding: '8px 4px', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong>{a.r || a.hex}</strong> <span style={{ color: 'var(--muted)' }}>· {a.typeLabel}</span></span>
                  <span style={{ color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {a.alt_baro ? `${Math.round(a.alt_baro * 0.3048).toLocaleString('fr-FR')} m` : 'au sol ?'}
                    {a.gs ? ` · ${Math.round(a.gs * 1.852)} km/h` : ''}
                  </span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.flight && <span>vol {String(a.flight).trim()}</span>}
                  {a.lat != null && <a target="_blank" rel="noopener"
                    href={`https://globe.adsb.lol/?icao=${a.hex}`}>suivre sur la carte</a>}
                  {regLinks(a.r).map(([l, u]) => <a key={l} href={u} target="_blank" rel="noopener">{l}</a>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>En vol par type d’appareil</h2>
          <table className="data">
            <thead><tr><th>Type</th><th>En vol</th></tr></thead>
            <tbody>
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <tr key={t}><td>{t}</td><td>{n}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="warnbox" style={{ marginTop: 16 }}>
            <strong>Méthode et limites :</strong> instantané du réseau ADS-B communautaire — couverture
            partielle (océans et zones sans récepteurs invisibles), certains appareils volent en
            transpondeur anonymisé (programme PIA américain), et une immatriculation identifie un
            appareil, pas une personne : la plupart des jets sont détenus via des sociétés de gestion
            et loués à des clients variés. Ordre de grandeur d’émissions : un jet d’affaires émet
            ~2 à 6 t de CO₂ par heure de vol, 10 à 30 fois plus par passager qu’un vol commercial.
            Les agrégats sur 30 jours (appareils les plus actifs) arriveront via la collecte nocturne.
          </div>
        </div>
      </div>
    </div>
  );
}
