import { useEffect, useState } from 'react';
import { eur } from '../lib/format.js';
import { searchMarches, aggregate, sampleRecord, resolveNames, FIELDS, DATASET, OUTLIER } from '../lib/decp.js';

const get = (rec, key) => rec[FIELDS[key]] ?? null;
const Name = ({ id, names }) => {
  if (!id || String(id) === 'CDL') return <span>n.c.</span>;
  const n = names[id];
  return <span title={`SIRET ${id}`}>{n === undefined ? '…' : (n || `SIRET ${id}`)}</span>;
};

export default function Marches() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(null);
  const [tops, setTops] = useState(null);
  const [names, setNames] = useState({});
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [sel, setSel] = useState(null);
  const [noOutliers, setNoOutliers] = useState(true);

  const run = async (query, excl = noOutliers) => {
    setLoading(true); setErr(null); setSel(null);
    try {
      const [res, agg] = await Promise.all([
        searchMarches({ q: query, excludeOutliers: excl }),
        aggregate({ q: query, excludeOutliers: excl }).catch(() => null),
      ]);
      const results = res.results || [];
      setRows(results); setTotal(res.total_count ?? null);
      setTops(agg?.results || null);
      // résolution asynchrone des noms (acheteurs + titulaires + top)
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
  useEffect(() => { run(''); }, []);

  return (
    <div>
      <h1>Marchés publics — qui est payé, par qui, pour quoi ?</h1>
      <p className="sub">Base DECP (données essentielles de la commande publique), interrogée en direct sur
        data.economie.gouv.fr. La base ne publie que les SIRET : les raisons sociales sont résolues à la
        volée via l’API Recherche d’entreprises (État). C’est le niveau de détail le plus fin légalement
        public ; les factures elles-mêmes ne le sont pas.</p>
      <form style={{ display: 'flex', gap: 8, margin: '18px 0 8px' }}
        onSubmit={e => { e.preventDefault(); run(q); }}>
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher : un objet (« vidéosurveillance »), un SIRET, une commune…"
          style={{ flex: 1 }} />
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Recherche…' : 'Rechercher'}</button>
      </form>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--ink-2)', fontSize: 12.5, marginBottom: 12 }}>
        <input type="checkbox" checked={noOutliers}
          onChange={e => { setNoOutliers(e.target.checked); run(q, e.target.checked); }} />
        masquer les montants aberrants (≥ {eur(OUTLIER)} — quasi toujours des erreurs de saisie)
      </label>
      {err && (
        <div className="warnbox">
          <strong>L’API n’a pas répondu comme attendu</strong> ({err}).{' '}
          {schema
            ? <>Champs réellement disponibles : <code style={{ fontSize: 12 }}>{schema.join(', ')}</code> — ajuster
                la constante <code>FIELDS</code> dans <code>src/lib/decp.js</code>.</>
            : 'Vérifiez la connexion réseau, ou que le dataset existe toujours : ' + DATASET}
        </div>
      )}
      {total != null && !err && (
        <p className="hint" style={{ marginBottom: 12 }}>{total.toLocaleString('fr-FR')} marchés correspondants —
          affichage des 20 plus gros montants.</p>
      )}
      <div className="grid2">
        <div className="card">
          <h2>Marchés (tri : montant décroissant)</h2>
          {rows && rows.length === 0 && <p className="hint">Aucun résultat.</p>}
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
                  <tr key={i}>
                    <td><Name id={t[FIELDS.titulaireId]} names={names} /></td>
                    <td>{t.n}</td>
                    <td>{eur(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="warnbox" style={{ marginTop: 16 }}>
            <strong>Limites connues de la base DECP :</strong> déclarative (trous et erreurs de saisie —
            d’où le filtre montants aberrants), doublons possibles entre canaux de collecte, montants
            notifiés (engagements, pas paiements), seuil de publication. Les groupements n’affichent ici
            que le premier titulaire ; le détail complet (co-titulaires, sous-traitance, avenants) est
            dans la fiche dépliable de chaque marché.
          </div>
        </div>
      </div>
    </div>
  );
}
