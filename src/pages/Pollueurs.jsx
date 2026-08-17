import { useEffect, useState } from 'react';
import ReportButton from '../components/ReportButton.jsx';
import WorldMap from '../components/WorldMap.jsx';

/**
 * Climate TRACE API v6 — schéma vérifié le 12/08/2026 :
 * GET /v6/assets?countries=FRA&sectors=power&limit=60
 * → { assets: [{ Id, Name, Country, Sector, AssetType,
 *      EmissionsSummary: {Gas:'co2e_100yr', EmissionsQuantity, Activity, Capacity, ...}
 *        (objet, ou tableau avec une entrée par gaz),
 *      Owners: [{CompanyName}], Centroid: {Geometry:[lon,lat]} }] }
 */
const summaryOf = a => {
  const es = a.EmissionsSummary;
  if (!es) return null;
  if (Array.isArray(es)) return es.find(e => e.Gas === 'co2e_100yr') || es[0] || null;
  return es;
};
const qtyOf = a => summaryOf(a)?.EmissionsQuantity ?? null;
const CT = 'https://api.climatetrace.org/v6';
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const SECTOR_ICON = {
  power: '⚡', 'fossil-fuel-operations': '🛢️', manufacturing: '🏭',
  'mineral-extraction': '⛏️', waste: '🗑️', agriculture: '🌾',
  transportation: '🚢', buildings: '🏢', 'fluorinated-gases': '🧪',
};
const SECTORS = [
  ['power', 'Électricité'], ['fossil-fuel-operations', 'Pétrole & gaz'],
  ['manufacturing', 'Industrie manufacturière'], ['mineral-extraction', 'Mines & extraction'],
  ['transportation', 'Transports'], ['waste', 'Déchets'], ['agriculture', 'Agriculture'],
  ['buildings', 'Bâtiments'], ['fluorinated-gases', 'Gaz fluorés'],
];
const COUNTRIES = [
  ['', 'Monde entier'], ['FRA', 'France'], ['CHN', 'Chine'], ['USA', 'États-Unis'],
  ['IND', 'Inde'], ['RUS', 'Russie'], ['DEU', 'Allemagne'], ['POL', 'Pologne'],
  ['GBR', 'Royaume-Uni'], ['SAU', 'Arabie saoudite'], ['QAT', 'Qatar'], ['TKM', 'Turkménistan'],
];
const fmtT = t => t == null ? '—'
  : t >= 1e9 ? (t / 1e9).toFixed(2).replace('.', ',') + ' Gt'
  : t >= 1e6 ? (t / 1e6).toFixed(1).replace('.', ',') + ' Mt'
  : t >= 1e3 ? Math.round(t / 1e3).toLocaleString('fr-FR') + ' kt'
  : Math.round(t).toLocaleString('fr-FR') + ' t';

export default function Pollueurs() {
  const [country, setCountry] = useState('FRA');
  const [sector, setSector] = useState('power');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);

  const run = async (c = country, s = sector) => {
    setLoading(true); setErr(null); setSel(null);
    try {
      const p = new URLSearchParams({ limit: 60, sectors: s });
      if (c) p.set('countries', c);
      const r = await fetch(`${CT}/assets?${p}`);
      if (!r.ok) throw new Error(`API ${r.status}`);
      const j = await r.json();
      const assets = (j.assets || [])
        .filter(a => qtyOf(a) != null)
        .sort((a, b) => qtyOf(b) - qtyOf(a));
      setRows(assets);
      if (!assets.length && (j.assets || []).length)
        setErr('réponse reçue mais structure inattendue — champs du 1er asset : ' + Object.keys(j.assets[0]).join(', '));
    } catch (e) { setErr(String(e.message || e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { run(); }, []);

  return (
    <div>
      <h1>Les plus gros pollueurs — installation par installation</h1>
      <p className="sub">Émissions estimées par site industriel (centrales, mines, usines, champs
        pétroliers…), interrogées en direct sur l’API publique de Climate TRACE — coalition
        scientifique qui croise satellites, capteurs et registres. Nous fournissons l’outil et les
        sources ; l’interprétation vous appartient.</p>
      <div style={{ display: 'flex', gap: 8, margin: '18px 0 14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={country} onChange={e => { setCountry(e.target.value); run(e.target.value, sector); }}>
          {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={sector} onChange={e => { setSector(e.target.value); run(country, e.target.value); }}>
          {SECTORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {loading && <span className="hint" style={{ margin: 0 }}>chargement…</span>}
        <div style={{ marginLeft: 'auto' }}><ReportButton context={`pollueurs ${country}/${sector}`} /></div>
      </div>
      {err && <div className="warnbox"><strong>L’API Climate TRACE n’a pas répondu</strong> ({err}).
        Réessayez, ou vérifiez https://api.climatetrace.org/v6/definitions/sectors dans votre navigateur.</div>}
      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Carte — survolez une installation</h2>
        <WorldMap markers={(rows || []).map((a, i) => ({
          lat: a.Centroid?.Geometry?.[1], lon: a.Centroid?.Geometry?.[0],
          icon: SECTOR_ICON[sector] || '🏭',
          size: i < 5 ? 26 : 19,
          html: `<strong>${esc(a.Name)}</strong><br/>${fmtT(qtyOf(a))} CO₂e/an · ${esc(a.AssetType || a.Sector)}` +
            (a.Owners?.length ? `<br/>Opérateur : ${esc(a.Owners.map(o => o.CompanyName).filter(Boolean).join(', ') || 'n.c.')}` : ''),
        }))} />
      </div>
      <div className="card">
        <h2>Top installations par émissions (t CO₂e/an, dernière année disponible)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(rows || []).map((a, i) => (
            <div key={a.Id} className="card" style={{ padding: '12px 14px', cursor: 'pointer', background: sel === i ? 'var(--surface-2)' : 'var(--surface)' }}
              onClick={() => setSel(sel === i ? null : i)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  <span style={{ color: 'var(--muted)', marginRight: 8 }}>{i + 1}</span>
                  {a.Name || '(sans nom)'}
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {a.Country} · {a.AssetType || a.Sector}</span>
                </div>
                <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtT(qtyOf(a))} CO₂e</div>
              </div>
              {a.Owners?.length > 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                  Opérateur : {a.Owners.map(o => o.CompanyName).filter(Boolean).join(', ') || 'n.c.'}
                </div>
              )}
              {sel === i && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--ink-2)' }} onClick={e => e.stopPropagation()}>
                  {summaryOf(a)?.Capacity != null && <div>Capacité : {Math.round(summaryOf(a).Capacity).toLocaleString('fr-FR')} {summaryOf(a).CapacityUnits || ''}</div>}
                  {summaryOf(a)?.Activity != null && <div>Activité : {Math.round(summaryOf(a).Activity).toLocaleString('fr-FR')} {summaryOf(a).ActivityUnits || ''}</div>}
                  {a.Centroid?.Geometry && (
                    <div>Position : <a target="_blank" rel="noopener"
                      href={`https://www.openstreetmap.org/?mlat=${a.Centroid.Geometry[1]}&mlon=${a.Centroid.Geometry[0]}#map=13/${a.Centroid.Geometry[1]}/${a.Centroid.Geometry[0]}`}>
                      voir sur la carte</a></div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    Sources : <a href={`https://climatetrace.org/inventory?asset=${a.Id}`} target="_blank" rel="noopener">fiche Climate TRACE</a>
                    {a.Country === 'FRA' && <> · <a href="https://www.georisques.gouv.fr/risques/registre-des-emissions-polluantes" target="_blank" rel="noopener">registre officiel IREP (rejets déclarés)</a></>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="warnbox" style={{ marginTop: 16 }}>
          <strong>Lecture :</strong> ce sont des <em>estimations</em> par modèle + satellite (Climate TRACE
          publie ses niveaux de confiance), pas des mesures certifiées ; les registres déclaratifs officiels
          (IREP en France, E-PRTR en Europe) peuvent diverger. Une grosse installation n’est pas forcément
          une installation illégale : la plupart émettent dans le cadre de quotas. L’outil montre où sont
          les volumes ; le jugement, réglementaire ou politique, reste à l’utilisateur.
        </div>
      </div>
    </div>
  );
}
