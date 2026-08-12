import { useState } from 'react';
import Donut from '../components/Donut.jsx';
import LegendRows from '../components/LegendRows.jsx';
import { fmt, pct, PAL } from '../lib/format.js';
import { S, NATLBL, NATKEYS, PAYERS, val, natVal, payVal, payOK, kids1, kids2, inflation } from '../lib/budget.js';

const lbl = c => S.lbl[c] || c;

/* ---------- one explorable donut (year view) ---------- */
function YearExplorer({ year, setYear }) {
  const [path, setPath] = useState([]);
  const [view, setView] = useState('split');
  const [focus, setFocus] = useState(null);
  const node = path.length ? path[path.length - 1] : null;
  const leaf = node && node.length === 6;
  const conso = node ? val(node, year) : val('TOT', year);

  let slices;
  if (view === 'pay') {
    slices = PAYERS.map(([k, l, col]) => ({ c: 'pay:' + k, l, col, v: payVal(node || 'TOT', k, year) || 0, drill: false }))
      .filter(s => s.v > 0.001);
  } else if (view === 'nat') {
    slices = NATKEYS.map(k => ({ c: 'nat:' + k, l: NATLBL[k], v: natVal(node || 'TOT', k, year) || 0, drill: false }))
      .sort((a, b) => b.v - a.v).map((s, i) => ({ ...s, col: PAL[i % PAL.length] }))
      .filter(s => s.v > 0.0005);
  } else {
    const ks = node ? kids2(node) : kids1();
    slices = ks.map(c => ({ c, l: lbl(c), v: val(c, year) || 0 }))
      .sort((a, b) => b.v - a.v).map((s, i) => ({ ...s, col: PAL[i % PAL.length] }))
      .filter(s => s.v > 0.0005);
  }
  const total = view === 'pay' ? slices.reduce((a, s) => a + s.v, 0) : conso;
  const gap = view === 'pay' ? total - conso : 0;

  const drill = s => {
    if (view !== 'split') return;
    if (s.c.length === 4) { setPath(p => [...p, s.c]); }
    else if (s.c.length === 6) { setPath(p => [...p, s.c]); setView('nat'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <label style={{ color: 'var(--muted)', fontSize: 12 }}>Année affichée</label>
        <select value={year} onChange={e => {
          const y = +e.target.value; setYear(y);
          if (view === 'pay' && !payOK(y)) setView(leaf ? 'nat' : 'split');
        }}>
          {[...S.years].reverse().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {!payOK(year) && <span style={{ color: 'var(--muted)', fontSize: 12 }}>(vue « qui paie » indisponible avant 2009)</span>}
      </div>
      <div className="kpis">
        <Kpi v={`${fmt(val('TOT', year))} Md€`} l={`dépense publique totale ${year}`} n="toutes administrations, consolidée" />
        <Kpi v={`${fmt(val('GF10', year))} Md€`} l="protection sociale" n={`${pct(val('GF10', year), val('TOT', year))} du total — première fonction`} />
        <Kpi v={`${fmt(val('GF0107', year))} Md€`} l="charge de la dette" n="« opérations concernant la dette publique »" />
        {payOK(year)
          ? <Kpi v={pct(payVal('TOT', 'asso', year), PAYERS.reduce((a, [k]) => a + (payVal('TOT', k, year) || 0), 0))}
              l="payés par la Sécurité sociale" n={`${fmt(payVal('TOT', 'asso', year))} Md€`} />
          : <Kpi v="n.d." l="ventilation par payeur" n="disponible à partir de 2009" />}
      </div>
      <div className="crumbs">
        <button className={'crumb' + (path.length ? '' : ' cur')} onClick={() => { setPath([]); setView('split'); }}>
          France {year} — {fmt(val('TOT', year))} Md€
        </button>
        {path.map((c, i) => (
          <span key={c} style={{ display: 'contents' }}>
            <span className="sep">›</span>
            <button className={'crumb' + (i === path.length - 1 && view === 'split' ? ' cur' : '')}
              onClick={() => { setPath(path.slice(0, i + 1)); setView('split'); }}>{lbl(c)}</button>
          </span>
        ))}
        {view === 'nat' && <><span className="sep">›</span><span className="crumb cur">Par nature</span></>}
        {view === 'pay' && <><span className="sep">›</span><span className="crumb cur">Qui paie ?</span></>}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button className="btn" aria-pressed={view === 'split'} disabled={leaf}
            onClick={() => setView('split')}>Répartition</button>
          <button className="btn" aria-pressed={view === 'nat'} onClick={() => setView('nat')}>Nature</button>
          <button className="btn" aria-pressed={view === 'pay'} disabled={!payOK(year)}
            onClick={() => setView('pay')}>Qui paie ?</button>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <Donut slices={slices} total={total}
            center={{
              v: `${fmt(total)} Md€`,
              l: view === 'pay' ? `Payeurs — ${node ? lbl(node).slice(0, 30) : 'total'}`
                : view === 'nat' ? `Par nature — ${node ? lbl(node).slice(0, 28) : 'total'}`
                : node ? lbl(node).slice(0, 38) : 'Dépense publique totale',
              s: node ? `${pct(conso, val('TOT', year))} du total` : String(year),
            }}
            focus={focus} onFocus={setFocus} onSlice={drill}
            renderTip={s => [
              `${fmt(s.v)} Md€`,
              view === 'pay' ? `${pct(s.v, total)} des payeurs de ce poste`
                : `${pct(s.v, total)} de ce niveau · ${pct(s.v, val('TOT', year))} de la dépense publique ${year}`,
            ]} />
        </div>
        <div className="card">
          <LegendRows slices={slices} total={total} focus={focus} onFocus={setFocus} onSlice={drill}
            subFor={s => view === 'split' && s.c.length === 4 ? 'cliquer pour détailler' : null} />
          <div className="hint">
            {view === 'pay'
              ? `Répartition entre payeurs.${Math.abs(gap) / conso > 0.005
                  ? ` Note : la somme des payeurs (${fmt(total)} Md€) dépasse le total consolidé (${fmt(conso)} Md€) — avant 2019, l'INSEE ne neutralise pas tous les transferts entre administrations ; les % sont calculés sur la somme des payeurs.` : ''}`
              : view === 'nat'
              ? 'Nature économique de la dépense : salaires, prestations, investissement… décomposable à chaque niveau.'
              : path.length === 0 ? 'Niveau 1 — les dix grandes fonctions (COFOG). Cliquez pour détailler.'
              : path.length === 1 ? 'Niveau 2 — sous-fonctions. Un clic de plus décompose par nature.'
              : 'Niveau 3 — décomposition par nature. Fil d’Ariane pour remonter.'}
          </div>
        </div>
      </div>
    </div>
  );
}

const Kpi = ({ v, l, n }) => (
  <div className="kpi"><div className="v">{v}</div><div className="l">{l}</div><div className="n">{n}</div></div>
);

/* ---------- diff tab with its own drill-down ---------- */
function Diff({ yA, yB }) {
  const [mode, setMode] = useState('part');
  const [dpath, setDpath] = useState([]);
  const y0 = Math.min(yA, yB), y1 = Math.max(yA, yB);
  const infl = inflation(y0, y1);
  const node = dpath.length ? dpath[dpath.length - 1] : null;

  const dChildren = n => !n
    ? kids1().map(c => ({ c, l: lbl(c), drill: true }))
    : n.length === 4 ? kids2(n).map(c => ({ c, l: lbl(c), drill: true }))
    : NATKEYS.map(k => ({ c: `NAT|${n}|${k}`, l: NATLBL[k], drill: false }));
  const dVal = (c, y) => c.startsWith('NAT|')
    ? (natVal(c.split('|')[1], c.split('|')[2], y) || 0) : (val(c, y) || 0);

  const t0 = node ? dVal(node, y0) : val('TOT', y0);
  const t1 = node ? dVal(node, y1) : val('TOT', y1);
  const T0 = val('TOT', y0), T1 = val('TOT', y1);
  const g = (t1 / t0 - 1) * 100, real = ((t1 / t0) / (1 + infl / 100) - 1) * 100;

  if (y0 === y1) return <div className="warnbox">Sélectionnez deux années différentes sur les onglets A et B.</div>;

  const F = dChildren(node).map(k => {
    const v0 = dVal(k.c, y0), v1 = dVal(k.c, y1);
    return {
      ...k, v0, v1, d: v1 - v0,
      g: v0 > 0 ? (v1 / v0 - 1) * 100 : (v1 > 0 ? Infinity : 0),
      gr: v0 > 0 ? ((v1 / v0) / (1 + infl / 100) - 1) * 100 : (v1 > 0 ? Infinity : 0),
      p0: t0 ? v0 / t0 * 100 : 0, p1: t1 ? v1 / t1 * 100 : 0,
      dp: (t1 ? v1 / t1 * 100 : 0) - (t0 ? v0 / t0 * 100 : 0),
    };
  }).filter(r => r.v0 > 0.005 || r.v1 > 0.005);
  const gain = [...F].sort((a, b) => b.dp - a.dp)[0];
  const loss = [...F].sort((a, b) => a.dp - b.dp)[0];
  const ctx = node ? lbl(node) : null;
  const lvl = !node ? 'fonctions' : node.length === 4 ? 'sous-fonctions' : 'natures de dépense';

  const rows = F.map(r => mode === 'part'
    ? { ...r, x: r.dp, lab: `${r.dp >= 0 ? '+' : ''}${r.dp.toFixed(1).replace('.', ',')} pt`, sub: `${r.p0.toFixed(1).replace('.', ',')} % → ${r.p1.toFixed(1).replace('.', ',')} %` }
    : mode === 'reel'
    ? { ...r, x: isFinite(r.gr) ? r.gr : 100, lab: isFinite(r.gr) ? `${r.gr >= 0 ? '+' : ''}${r.gr.toFixed(0)} %` : 'nouveau', sub: `${r.d >= 0 ? '+' : ''}${fmt(r.d)} Md€ courants` }
    : { ...r, x: isFinite(r.g) ? r.g : 100, lab: isFinite(r.g) ? `${r.g >= 0 ? '+' : ''}${r.g.toFixed(0)} %` : 'nouveau', sub: `${r.d >= 0 ? '+' : ''}${fmt(r.d)} Md€` })
    .sort((a, b) => b.x - a.x);
  const minX = Math.min(0, ...rows.map(r => r.x));
  const maxX = Math.max(mode === 'nominal' ? infl : 0, ...rows.map(r => r.x));
  const range = (maxX - minX) || 1, z = (-minX) / range * 100;

  /* movers one level deeper */
  let mov = [];
  if (!node) {
    kids1().forEach(gf => kids2(gf).forEach(c => {
      const v0 = val(c, y0), v1 = val(c, y1);
      if (v0 != null && v1 != null && (v0 > 0.3 || v1 > 0.3))
        mov.push({ l: lbl(c), p0: v0 / t0 * 100, p1: v1 / t1 * 100, dp: v1 / t1 * 100 - v0 / t0 * 100, d: v1 - v0 });
    }));
  } else if (node.length === 4) {
    kids2(node).forEach(sc => NATKEYS.forEach(k => {
      const v0 = natVal(sc, k, y0) || 0, v1 = natVal(sc, k, y1) || 0;
      if (v0 > 0.3 || v1 > 0.3)
        mov.push({ l: `${lbl(sc).slice(0, 34)} — ${NATLBL[k].toLowerCase()}`, p0: v0 / t0 * 100, p1: v1 / t1 * 100, dp: v1 / t1 * 100 - v0 / t0 * 100, d: v1 - v0 });
    }));
  }
  mov.sort((a, b) => Math.abs(b.dp) - Math.abs(a.dp));

  const gains = F.filter(r => r.dp > 0.05).sort((a, b) => b.dp - a.dp);
  const losses = F.filter(r => r.dp < -0.05).sort((a, b) => a.dp - b.dp);
  const falseCut = losses.find(r => isFinite(r.gr) && r.gr > 0);

  return (
    <div>
      <div className="crumbs">
        <button className={'crumb' + (dpath.length ? '' : ' cur')} onClick={() => setDpath([])}>Toute la dépense publique</button>
        {dpath.map((c, i) => (
          <span key={c} style={{ display: 'contents' }}>
            <span className="sep">›</span>
            <button className={'crumb' + (i === dpath.length - 1 ? ' cur' : '')}
              onClick={() => setDpath(dpath.slice(0, i + 1))}>{lbl(c)}</button>
          </span>
        ))}
        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>cliquez sur le nom d’une ligne pour descendre</span>
      </div>
      <div className="kpis">
        <Kpi v={`${t1 - t0 >= 0 ? '+' : ''}${fmt(t1 - t0)} Md€`}
          l={`${ctx ? ctx.toLowerCase() : 'dépense totale'} : ${t1 >= t0 ? 'hausse' : 'baisse'}`}
          n={`${fmt(t0)} (${y0}) → ${fmt(t1)} Md€ (${y1}), ${g >= 0 ? '+' : ''}${g.toFixed(1).replace('.', ',')} % nominal`} />
        <Kpi v={`${real >= 0 ? '+' : ''}${real.toFixed(1).replace('.', ',')} %`} l="en volume (hors inflation)"
          n={`inflation IPC cumulée ${y0}-${y1} : +${infl.toFixed(1).replace('.', ',')} %`} />
        {node
          ? <Kpi v={`${(t0 / T0 * 100).toFixed(1).replace('.', ',')} % → ${(t1 / T1 * 100).toFixed(1).replace('.', ',')} %`}
              l="poids dans la dépense publique totale" n={`part de « ${ctx} » dans le total France`} />
          : gain && <Kpi v={`+${gain.dp.toFixed(1).replace('.', ',')} pt`} l={gain.l.toLowerCase()}
              n={`plus forte hausse de part : ${gain.p0.toFixed(1).replace('.', ',')} % → ${gain.p1.toFixed(1).replace('.', ',')} %`} />}
        {loss && <Kpi v={`${(node ? gain : loss).dp >= 0 ? '+' : ''}${(node ? gain : loss).dp.toFixed(1).replace('.', ',')} pt`}
          l={(node ? gain : loss).l.toLowerCase()}
          n={`${node ? 'plus forte hausse de part interne' : 'plus forte baisse de part'} : ${(node ? gain : loss).p0.toFixed(1).replace('.', ',')} % → ${(node ? gain : loss).p1.toFixed(1).replace('.', ',')} %`} />}
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>
            {mode === 'part' ? `Déformation de la structure interne, ${y0} → ${y1} — ${lvl}, en points de part ${node ? `de « ${ctx} »` : 'du total'}`
              : mode === 'reel' ? `Évolution en volume, ${y0} → ${y1} — ${lvl} (déflaté IPC +${infl.toFixed(1).replace('.', ',')} %)`
              : `Évolution nominale, ${y0} → ${y1} — ${lvl} (euros courants)`}
          </h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['part', 'Points de part'], ['reel', 'Volume (hors inflation)'], ['nominal', 'Nominal']].map(([m, l]) => (
              <button key={m} className="btn" aria-pressed={mode === m} onClick={() => setMode(m)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map(r => {
            const w = Math.abs(r.x) / range * 100, left = r.x >= 0 ? z : z - w;
            return (
              <div key={r.c} style={{ display: 'grid', gridTemplateColumns: '210px 1fr 132px', gap: 12, alignItems: 'center', fontSize: 13 }}>
                <div title={r.l} onClick={() => r.drill && setDpath(p => [...p, r.c])}
                  style={{
                    textAlign: 'right', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: r.drill ? 'pointer' : 'default',
                    textDecoration: r.drill ? 'underline dotted' : 'none', textUnderlineOffset: 3,
                  }}>{r.l}</div>
                <div style={{ position: 'relative', height: 18, background: 'var(--surface-2)', borderRadius: 4 }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'var(--grid)', left: `${z}%` }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 4, left: `${left}%`, width: `${w}%`, background: r.x < 0 ? 'var(--neg)' : 'var(--accent)' }} />
                  {mode === 'nominal' && <div style={{ position: 'absolute', top: -4, bottom: -4, width: 2, background: 'var(--warn)', left: `${z + infl / range * 100}%` }} />}
                </div>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {r.lab} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({r.sub})</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hint">
          {mode === 'part' ? 'Somme nulle par construction à l’intérieur de ce niveau. Une part qui baisse peut monter en volume — basculez sur « Volume » pour vérifier.'
            : mode === 'reel' ? 'L’effort réel : à gauche de zéro, baisse une fois l’inflation retirée.'
            : `Le trait orange marque l’inflation cumulée (+${infl.toFixed(1).replace('.', ',')} %) : en deçà, hausse apparente mais baisse réelle.`}
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        {mov.length > 0 && (
          <div className="card">
            <h2>{node ? `Plus fortes variations (sous-fonction × nature, part de « ${ctx} »)` : 'Plus fortes déformations (sous-fonctions, part du total)'}</h2>
            <table className="data">
              <thead><tr><th>Poste</th><th>part {y0}</th><th>part {y1}</th><th>Δ part</th><th>Δ Md€</th></tr></thead>
              <tbody>
                {mov.slice(0, 12).map((m, i) => (
                  <tr key={i}>
                    <td>{m.l}</td>
                    <td>{m.p0.toFixed(1).replace('.', ',')} %</td>
                    <td>{m.p1.toFixed(1).replace('.', ',')} %</td>
                    <td className={m.dp >= 0 ? 'pos' : 'negv'}>{m.dp >= 0 ? '+' : ''}{m.dp.toFixed(2).replace('.', ',')} pt</td>
                    <td className={m.d >= 0 ? 'pos' : 'negv'}>{m.d >= 0 ? '+' : ''}{fmt(m.d)} Md€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          <h2>Lecture factuelle</h2>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 10px' }}><strong style={{ color: 'var(--ink)' }}>Parts en hausse{node ? ` (au sein de « ${ctx} »)` : ''}</strong> — {
              gains.length ? gains.slice(0, 3).map(r => `${r.l.toLowerCase()} (+${r.dp.toFixed(1).replace('.', ',')} pt)`).join(', ') + '.' : 'aucune.'}</p>
            <p style={{ margin: '0 0 10px' }}><strong style={{ color: 'var(--ink)' }}>Parts en baisse</strong> — {
              losses.length ? losses.slice(0, 3).map(r => `${r.l.toLowerCase()} (${r.dp.toFixed(1).replace('.', ',')} pt)`).join(', ') + '.' : 'aucune.'}</p>
            <p style={{ margin: 0 }}>{falseCut
              ? <><strong style={{ color: 'var(--ink)' }}>Piège de la part</strong> — {falseCut.l.toLowerCase()} perd {Math.abs(falseCut.dp).toFixed(1).replace('.', ',')} pt mais progresse de {falseCut.gr >= 0 ? '+' : ''}{falseCut.gr.toFixed(0)} % en volume : baisse relative, pas coupe.</>
              : <><strong style={{ color: 'var(--ink)' }}>Cohérence</strong> — ici, les baisses de part sont aussi des baisses en volume.</>}</p>
          </div>
        </div>
      </div>
      <div className="warnbox">
        <strong>Précautions d’interprétation :</strong> ① le périmètre est l’ensemble des administrations
        publiques — l’État n’en pilote directement qu’une partie ; ② une partie des écarts reflète
        l’inflation, la démographie et les chocs exogènes (2008, Covid, énergie), pas seulement des choix
        politiques ; ③ la dépense d’une année exécute en partie des budgets votés antérieurement ;
        ④ la correction d’inflation utilise l’IPC INSEE (moyennes annuelles) — un ordre de grandeur.
      </div>
    </div>
  );
}

export default function Budget() {
  const [tab, setTab] = useState('A');
  const [yA, setYA] = useState(2016);
  const [yB, setYB] = useState(2024);
  return (
    <div>
      <h1>Où va l’argent public ? — France, 1995-2024</h1>
      <p className="sub">Dépenses réelles (exécution) de l’ensemble des administrations publiques, consolidées,
        par fonction (COFOG). Choisissez une année sur les onglets A et B, l’onglet Comparaison analyse l’écart.</p>
      <div className="tabs" style={{ marginTop: 16 }}>
        <button className="tab" aria-selected={tab === 'A'} onClick={() => setTab('A')}>Année A — {yA}</button>
        <button className="tab" aria-selected={tab === 'B'} onClick={() => setTab('B')}>Année B — {yB}</button>
        <button className="tab" aria-selected={tab === 'diff'} onClick={() => setTab('diff')}>
          Comparaison {Math.min(yA, yB)} → {Math.max(yA, yB)}</button>
      </div>
      {tab === 'A' && <YearExplorer year={yA} setYear={setYA} />}
      {tab === 'B' && <YearExplorer year={yB} setYear={setYB} />}
      {tab === 'diff' && <Diff yA={yA} yB={yB} />}
    </div>
  );
}
