import { useMemo, useState } from 'react';
import geo from '../data/departements.geojson?raw';
import JOURS from '../data/canicule-jours.json';
import SEV from '../data/canicule-severite.json';
import T30 from '../data/canicule-t30.json';
import SEUILS from '../data/canicule-seuils.json';

const GEO = JSON.parse(geo);
const DS = {
  jours: { d: JOURS, y0: 2004, y1: 2025, unit: 'jours', title: 'Nombre de jours de canicule',
    what: 'Un jour est compté lorsque les indicateurs biométéorologiques du département dépassent ses seuils d’alerte (Santé publique France).' },
  sev: { d: SEV, y0: 2004, y1: 2025, unit: 'pts', title: 'Sévérité cumulée des canicules',
    what: 'La sévérité cumule, jour après jour, l’ampleur du dépassement des seuils : elle pondère la durée par l’intensité.' },
  t30: { d: T30, y0: 2018, y1: 2026, unit: 'jours', title: 'Jours avec TMax ≥ 30 °C',
    what: 'Jours où la TMax moyenne du département atteint 30 °C (ODRÉ, janv. 2018 → juin 2026 — 2026 partielle ; moyenne de stations : les pics locaux sont lissés).' },
  seuils: { static: true, unit: '°C', title: 'Seuils d’alerte',
    what: 'Les conditions de passage en alerte, propres à chaque département : il faut 3 jours et 3 nuits consécutifs au-dessus des DEUX seuils (température moyenne de jour ET de nuit). Carte colorée par seuil de jour.' },
};
const NAMES = JOURS.names;

/* Lambert conformal conic projection, fitted once */
function makeProj(features) {
  const R = 6371, d = Math.PI / 180, p1 = 44 * d, p2 = 49 * d, p0 = 46.5 * d, l0 = 3 * d;
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) /
    Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const F = Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), n) / n;
  const r0 = R * F / Math.pow(Math.tan(Math.PI / 4 + p0 / 2), n);
  const raw = (lon, lat) => {
    const rr = R * F / Math.pow(Math.tan(Math.PI / 4 + lat * d / 2), n);
    const th = n * (lon * d - l0);
    return [rr * Math.sin(th), rr * Math.cos(th) - r0];
  };
  let xn = 1e9, xx = -1e9, yn = 1e9, yx = -1e9;
  const walk = (c, f) => { if (typeof c[0] === 'number') f(c); else c.forEach(x => walk(x, f)); };
  features.forEach(ft => walk(ft.geometry.coordinates, c => {
    const p = raw(c[0], c[1]);
    if (p[0] < xn) xn = p[0]; if (p[0] > xx) xx = p[0];
    if (p[1] < yn) yn = p[1]; if (p[1] > yx) yx = p[1];
  }));
  const W = 620, H = 600, pad = 14;
  const s = Math.min((W - 2 * pad) / (xx - xn), (H - 2 * pad) / (yx - yn));
  const ox = (W - (xx - xn) * s) / 2 - xn * s, oy = (H - (yx - yn) * s) / 2 - yn * s;
  return (lon, lat) => { const p = raw(lon, lat); return [p[0] * s + ox, p[1] * s + oy]; };
}

const RAMP_L = ['#fde3cc', '#fac59b', '#f4a06a', '#e87840', '#cc5223', '#993312'];
const RAMP_D = ['#3d1e0f', '#6b3115', '#a0461c', '#d06327', '#ec8f45', '#f8bd80'];
const fmtv = v => v >= 10 ? Math.round(v).toLocaleString('fr-FR') : (Math.round(v * 10) / 10).toLocaleString('fr-FR');

export default function Canicule() {
  const [ds, setDs] = useState('jours');
  const [year, setYear] = useState('all');
  const [tip, setTip] = useState(null);
  const [focus, setFocus] = useState(null);

  const cfg = DS[ds];
  const dark = document.documentElement.dataset.theme === 'dark';
  const RAMP = dark ? RAMP_D : RAMP_L;

  const proj = useMemo(() => makeProj(GEO.features), []);
  const paths = useMemo(() => GEO.features.map(ft => {
    const rings = ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.coordinates;
    let dd = '';
    rings.forEach(poly => poly.forEach(ring => {
      ring.forEach((c, i) => { const p = proj(c[0], c[1]); dd += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
      dd += 'Z';
    }));
    return { code: ft.properties.code, d: dd };
  }), [proj]);

  const isStatic = !!cfg.static;
  const codes = Object.keys(isStatic ? SEUILS : cfg.d.tot);
  const value = c => isStatic ? SEUILS[c][0]
    : year === 'all' ? cfg.d.tot[c] : (cfg.d.per[c][year] || 0);
  const years = []; if (!isStatic) for (let y = cfg.y0; y <= cfg.y1; y++) years.push(y);

  const vals = codes.map(value).filter(v => v > 0).sort((a, b) => a - b);
  const max = vals[vals.length - 1] || 1;
  const nice = [.5, 1, 2, 2.5, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100, 120, 150, 200, 250, 300, 400, 500];
  const bk = [max / 12, max / 6, max / 3.4, max / 2.2, max / 1.5]
    .map(t => nice.reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a));
  const classOf = isStatic
    ? v => Math.min(Math.max(v - 31, 0), 5)   /* seuils jour : 31..36 °C → 6 classes */
    : v => { if (v <= 0) return -1; for (let i = 0; i < 5; i++) if (v < bk[i]) return i; return 5; };
  const ranked = [...codes].sort((a, b) => value(b) - value(a));

  return (
    <div>
      <h1>Canicule par département</h1>
      <p className="sub">{cfg.what}</p>
      <div className="tabs" style={{ marginTop: 16 }}>
        {Object.entries(DS).map(([k, c]) => (
          <button key={k} className="tab" aria-selected={ds === k}
            onClick={() => { setDs(k); setYear('all'); }}>{c.title}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, minHeight: 34 }}>
        {!isStatic && <><label style={{ color: 'var(--muted)', fontSize: 12 }}>Période</label>
        <select value={year} onChange={e => setYear(e.target.value === 'all' ? 'all' : +e.target.value)}>
          <option value="all">Cumul {cfg.y0}-{cfg.y1}</option>
          {[...years].reverse().map(y => <option key={y} value={y}>{y}{ds === 't30' && y === 2026 ? ' (jan-juin)' : ''}</option>)}
        </select></>}
        {isStatic && <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          Seuils en vigueur (source : Santé publique France, via canicule-france.fr)</span>}
      </div>
      <div className="grid2">
        <div className="card" style={{ position: 'relative' }}>
          <h2>Carte — {isStatic ? 'seuil d’alerte de jour (°C)' : year === 'all' ? `cumul ${cfg.y0}-${cfg.y1}` : year}</h2>
          <svg viewBox="0 0 620 600" style={{ display: 'block', width: '100%', height: 'auto' }}>
            {paths.map(p => {
              const k = classOf(value(p.code));
              return <path key={p.code} d={p.d}
                fill={k < 0 ? 'var(--surface-2)' : RAMP[k]}
                style={{
                  stroke: 'var(--surface)', strokeWidth: focus === p.code ? 1.6 : 0.7, cursor: 'pointer',
                  opacity: focus && focus !== p.code ? 0.35 : 1,
                }}
                onMouseEnter={() => setFocus(p.code)}
                onMouseLeave={() => { setFocus(null); setTip(null); }}
                onMouseMove={e => setTip({ code: p.code, x: e.clientX, y: e.clientY })} />;
            })}
          </svg>
          <div style={{ display: 'flex', gap: 2, marginTop: 14 }}>
            {RAMP.map((col, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{ height: 12, borderRadius: 2, background: col }} />
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {isStatic ? `${31 + i} °C` : i === 0 ? `< ${fmtv(bk[0])}` : i === 5 ? `≥ ${fmtv(bk[4])}` : `${fmtv(bk[i - 1])}–${fmtv(bk[i])}`}
                </div>
              </div>
            ))}
          </div>
          {tip && (() => {
            const c = tip.code, v = value(c);
            const [sj, sn] = SEUILS[c];
            const mx = isStatic ? 1 : Math.max(...years.map(y => cfg.d.per[c][y] || 0), 1);
            return (
              <div style={{
                position: 'fixed', left: Math.min(tip.x + 16, window.innerWidth - 260), top: tip.y + 14,
                zIndex: 50, pointerEvents: 'none', background: 'var(--surface-2)',
                border: '1px solid var(--hair)', borderRadius: 10, padding: '11px 13px', minWidth: 220,
                boxShadow: '0 8px 28px rgba(0,0,0,.35)',
              }}>
                <div style={{ fontWeight: 640 }}>{NAMES[c]} <span style={{ color: 'var(--muted)' }}>({c})</span></div>
                {isStatic
                  ? <div style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.35 }}>jour ≥ {sj} °C<br />nuit ≥ {sn} °C</div>
                  : <div style={{ fontSize: 22, fontWeight: 650 }}>{fmtv(v)} {cfg.unit}</div>}
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {isStatic ? 'pendant 3 jours et 3 nuits consécutifs'
                    : <>rang {ranked.indexOf(c) + 1}/96 · {year === 'all' ? `cumul ${cfg.y0}-${cfg.y1}` : year}</>}</div>
                <div style={{ color: 'var(--ink-2)', fontSize: 12, marginTop: 6 }}>
                  {isStatic ? null : <>Seuils d’alerte : jour ≥ {sj} °C · nuit ≥ {sn} °C</>}</div>
                {!isStatic && <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 32, marginTop: 8 }}>
                  {years.map(y => (
                    <div key={y} title={String(y)} style={{
                      flex: 1, minHeight: 1, borderRadius: '1px 1px 0 0', background: RAMP[3],
                      height: `${(cfg.d.per[c][y] || 0) / mx * 100}%`,
                    }} />
                  ))}
                </div>}
                {!isStatic && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}>
                  <span>{cfg.y0}</span><span>{cfg.y1}</span>
                </div>}
              </div>
            );
          })()}
        </div>
        <div className="card">
          <h2>{isStatic ? 'Classement — seuils les plus exigeants (jour / nuit)' : 'Classement — 20 départements les plus touchés'}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ranked.slice(0, 20).map((c, i) => {
              const v = value(c), mx = value(ranked[0]) || 1, k = classOf(v);
              return (
                <div key={c}
                  onMouseEnter={() => setFocus(c)} onMouseLeave={() => setFocus(null)}
                  style={{
                    display: 'grid', gridTemplateColumns: '20px 1fr 48px', gap: 8, alignItems: 'center',
                    fontSize: 12.5, cursor: 'default', opacity: focus && focus !== c ? 0.45 : 1,
                  }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>{i + 1}</div>
                  <div>
                    <div style={{ color: 'var(--ink-2)' }}>{NAMES[c]} <span style={{ color: 'var(--muted)' }}>({c})</span></div>
                    <div style={{ height: 9, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${v / mx * 100}%`, background: k < 0 ? 'var(--surface-2)' : RAMP[k] }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {isStatic ? `${SEUILS[c][0]} / ${SEUILS[c][1]}` : fmtv(v)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="warnbox">
        <strong>Lecture :</strong> les seuils d’alerte sont propres à chaque département — le nombre de
        jours mesure la fréquence de l’alerte locale, pas la chaleur absolue. L’onglet « ≥ 30 °C »
        repose sur une moyenne départementale de stations (période 2018-2026, non comparable aux deux
        autres onglets). Les seuils affichés sont ceux du dispositif SACS (percentile 99,5 des températures
        1973-2003, révisés ponctuellement depuis) ; le déclenchement réel de la vigilance intègre aussi
        l’expertise de Météo-France. Sources : Santé publique France (ODISSE, seuils via canicule-france.fr),
        ODRÉ, fond de carte IGN/france-geojson.
      </div>
    </div>
  );
}
