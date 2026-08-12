import { useEffect, useState } from 'react';
import { eur } from '../lib/format.js';
import {
  searchMarches, aggregate, sampleRecord, resolveNames, resolveCompany,
  FIELDS, SEARCH_FIELDS, DATASET, OUTLIER,
} from '../lib/decp.js';
import ReportButton from '../components/ReportButton.jsx';

const get = (rec, key) => rec[FIELDS[key]] ?? null;
const Name = ({ id, names }) => {
  if (!id || String(id) === 'CDL') return <span>n.c.</span>;
  const n = names[id];
  return <span title={`SIRET ${id}`}>{n === undefined ? '…' : (n || `SIRET ${id}`)}</span>;
};

const SORTS = [
  [`${FIELDS.montant} desc`, 'Montant décroissant'],
  [`${FIELDS.montant} asc`, 'Montant croissant'],
  [`${FIELDS.dateNotification} desc`, 'Plus récents'],
  [`${FIELDS.dateNotification} asc`, 'Plus anciens'],
];

export default function Marches() {
  const [q, setQ] = useState('');
  const [field, setField] = useState('all');
  const [orderBy, setOrderBy] = useState(SORTS[0][0]);
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [noOutliers, setNoOutliers] = useState(true);

  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(null);
  const [tops, setTops] = useState(null);
  const [names, setNames] = useState({});
  const [interp, setInterp] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [sel, setSel] = useState(null);

  const run = async (over = {}) => {
    setLoading(true); setErr(null); setSel(null); setInterp(null);
    const opts = {
      q, field, orderBy, montantMin, montantMax, yearFrom, yearTo,
      excludeOutliers: noOutliers, ...over,
    };
    try {
      // nom d'entreprise → SIREN si champ acheteur/titulaire
      if ((opts.field === 'titulaire' || opts.field === 'acheteur')
          && opts.q && !/^\d{9,14}$/.test(opts.q.trim())) {
        const c = await resolveCompany(opts.q);
        if (c) {
          opts.resolved = c;
          setInterp(`« ${opts.q} » interprété comme ${c.nom || 'SIREN ' + c.siren} (SIREN ${c.siren})`);
        } else {
          setInterp(`« ${opts.q} » : entreprise introuvable dans l'annuaire — repli sur la recherche plein-texte.`);
        }
      }
      const [res, agg] = await Promise.all([
        searchMarches(opts),
        aggregate(opts).catch(() => null),
      ]);
      const results = res.results || [];
      setRows(results); setTotal(res.total_count ?? null);
      setTops(agg?.results || null);
      const ids = [
        ...results.map(r => get(r, 'acheteurId')),
        ...results.map(r => get(r, 'titulaireId')),
        ...(agg?.results || []).map(t => t[FIELDS.titulaireId]),
      ];
      resolveNames(ids).then(n => setNames(prev => ({ ...prev, ...n })));
    } catch (e) {
      setErr(String(e.message || e));
      try { const s = await sampleRecord(); setSchema(Object.keys(s.results?.[0] || {})); } catch { /* réseau HS */ }
    } finally { setLoading(false); }
  };
  useEffect(() => { run(); }, []); // premier chargement

  const placeholder = {
    all: 'Rechercher dans tous les champs…',
    objet: 'Ex. : vidéosurveillance, cantine scolaire, logiciel…',
    titulaire: 'Ex. : Thales, ou un SIREN/SIRET (901 234 567…)',
    acheteur: 'Ex. : ville de Lyon, ou un SIREN/SIRET',
    cpv: 'Ex. : 64212 (téléphonie mobile), 45 (travaux)…',
    lieu: 'Ex. : 69123 (Lyon), 34500…',
    procedure: 'Ex. : appel d’offres, procédure adaptée, sans publicité…',
  }[field];

  return (
    <div>
      <h1>Marchés publics — qui est payé, par qui, pour quoi ?</h1>
      <p className="sub">Base DECP (données essentielles de la commande publique), interrogée en direct sur
        data.economie.gouv.fr. La base ne publie que les SIRET : les raisons sociales sont résolues à la
        volée — et un nom saisi dans « Titulaire » ou « Acheteur » est traduit en SIREN avant la recherche.</p>

      <form className="card" style={{ margin: '18px 0 8px', display: 'flex', flexDirection: 'column', gap: 10 }}
        onSubmit={e => { e.preventDefault(); run(); }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={field} onChange={e => setField(e.target.value)} style={{ minWidth: 210 }}>
            {SEARCH_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
            style={{ flex: 1, minWidth: 240 }} />
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Recherche…' : 'Rechercher'}</button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: 'var(--ink-2)' }}>
          <span>Montant</span>
          <input type="text" value={montantMin} onChange={e => setMontantMin(e.target.value)} placeholder="min €" style={{ width: 90 }} />
          <input type="text" value={montantMax} onChange={e => setMontantMax(e.target.value)} placeholder="max €" style={{ width: 90 }} />
          <span>Notifié entre</span>
          <input type="text" value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="2018" style={{ width: 64 }} />
          <span>et</span>
          <input type="text" value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="2026" style={{ width: 64 }} />
          <span>Tri</span>
          <select value={orderBy} onChange={e => { setOrderBy(e.target.value); run({ orderBy: e.target.value }); }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={noOutliers}
              onChange={e => { setNoOutliers(e.target.checked); run({ excludeOutliers: e.target.checked }); }} />
            masquer les montants aberrants (≥ {eur(OUTLIER)})
          </label>
        </div>
      </form>

      {interp && <p className="hint" style={{ marginBottom: 8 }}>⤷ {interp}</p>}
      {err && (
        <div className="warnbox">
          <strong>L’API n’a pas répondu comme attendu</strong> ({err}).{' '}
          {schema
            ? <>Champs réellement disponibles : <code style={{ fontSize: 12 }}>{schema.join(', ')}</code> — ajuster
                <code> FIELDS</code> dans <code>src/lib/decp.js</code>.</>
            : 'Vérifiez la connexion réseau, ou que le dataset existe toujours : ' + DATASET}
        </div>
      )}
      {total != null && !err && (
        <p className="hint" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>{total.toLocaleString('fr-FR')} marchés correspondants —
            affichage des 20 premiers ({SORTS.find(([v]) => v === orderBy)?.[1].toLowerCase()}).</span>
          <ReportButton context={`recherche « ${q} » (champ ${field}), ${total} résultats`} />
        </p>
      )}

      <div className="grid2">
        <div className="card">
          <h2>Marchés</h2>
          {rows && rows.length === 0 && <p className="hint">Aucun résultat — élargissez les critères.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(rows || []).map((r, i) => (
              <div key={i} className="card" style={{ padding: '12px 14px', cursor: 'pointer', background: sel === i ? 'var(--surface-2)' : 'var(--surface)' }}
                onClick={() => setSel(sel === i ? null : i)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{get(r, 'objet') || '(objet non renseigné)'}</div>
                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{eur(get(r, 'montant'))}</div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                  <Name id={get(r, 'acheteurId')} names={names} />
                  {' → '}
                  <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}><Name id={get(r, 'titulaireId')} names={names} /></span>
                  {get(r, 'dateNotification') ? ` · notifié ${get(r, 'dateNotification')}` : ''}
                  {get(r, 'procedure') ? ` · ${get(r, 'procedure')}` : ''}
                </div>
                {sel === i && (
                  <table className="data" style={{ marginTop: 10 }}>
                    <tbody>
                      {Object.entries(r).filter(([, v]) => v != null && v !== '' && v !== 'CDL').map(([k, v]) => (
                        <tr key={k}><td style={{ color: 'var(--muted)' }}>{k}</td>
                          <td style={{ textAlign: 'left', wordBreak: 'break-word' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Top titulaires sur cette recherche</h2>
          {!tops && <p className="hint">Agrégation indisponible.</p>}
          {tops && (
            <table className="data">
              <thead><tr><th>Titulaire (SIRET résolu)</th><th>Marchés</th><th>Total</th></tr></thead>
              <tbody>
                {tops.map((t, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }} title="Rechercher tous les marchés de ce titulaire"
                    onClick={() => {
                      const id = t[FIELDS.titulaireId];
                      if (id && /^\d{9,14}$/.test(String(id))) {
                        setField('titulaire'); setQ(String(id));
                        run({ field: 'titulaire', q: String(id) });
                      }
                    }}>
                    <td><Name id={t[FIELDS.titulaireId]} names={names} /></td>
                    <td>{t.n}</td>
                    <td>{eur(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="warnbox" style={{ marginTop: 16 }}>
            <strong>Limites connues de la base DECP :</strong> déclarative (trous et erreurs de saisie),
            doublons possibles entre canaux de collecte, montants notifiés (engagements, pas paiements),
            seuil de publication. La recherche « Titulaire » par nom passe par l'annuaire des entreprises :
            elle prend la meilleure correspondance (affichée sous le formulaire) — vérifiez que c'est bien
            l'entité voulue, les grands groupes ont de nombreuses filiales au SIREN distinct.
          </div>
        </div>
      </div>
    </div>
  );
}
