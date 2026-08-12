import { useEffect, useState } from 'react';
import { eur } from '../lib/format.js';
import { searchMarches, aggregate, sampleRecord, FIELDS, DATASET } from '../lib/decp.js';

const get = (rec, key) => rec[FIELDS[key]] ?? rec[key] ?? null;

export default function Marches() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(null);
  const [tops, setTops] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [sel, setSel] = useState(null);

  const run = async (query) => {
    setLoading(true); setErr(null); setSel(null);
    try {
      const [res, agg] = await Promise.all([
        searchMarches({ q: query }),
        aggregate({ groupBy: FIELDS.titulaireNom, q: query }).catch(() => null),
      ]);
      setRows(res.results || []);
      setTotal(res.total_count ?? null);
      setTops(agg?.results || null);
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
        data.economie.gouv.fr — chaque marché attribué : acheteur, titulaire, montant, objet. C’est le niveau
        de détail le plus fin légalement public ; les factures elles-mêmes ne le sont pas.</p>
      <form style={{ display: 'flex', gap: 8, margin: '18px 0' }}
        onSubmit={e => { e.preventDefault(); run(q); }}>
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Rechercher : un acheteur (« ville de Lyon »), un fournisseur, un objet (« vidéosurveillance »)…"
          style={{ flex: 1 }} />
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Recherche…' : 'Rechercher'}</button>
      </form>
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
                  {get(r, 'acheteurNom') || 'acheteur n.c.'} → <span style={{ color: 'var(--ink-2)' }}>{get(r, 'titulaireNom') || 'titulaire n.c.'}</span>
                  {get(r, 'dateNotification') ? ` · notifié ${get(r, 'dateNotification')}` : ''}
                </div>
                {sel === i && (
                  <table className="data" style={{ marginTop: 10 }}>
                    <tbody>
                      {Object.entries(r).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
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
          <h2>Top fournisseurs sur cette recherche</h2>
          {!tops && <p className="hint">Agrégation indisponible (voir schéma).</p>}
          {tops && (
            <table className="data">
              <thead><tr><th>Fournisseur</th><th>Marchés</th><th>Total</th></tr></thead>
              <tbody>
                {tops.map((t, i) => (
                  <tr key={i}>
                    <td>{t[FIELDS.titulaireNom] || '(non renseigné)'}</td>
                    <td>{t.n}</td>
                    <td>{eur(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="warnbox" style={{ marginTop: 16 }}>
            <strong>Limites connues de la base DECP :</strong> déclarative (des acheteurs omettent ou
            saisissent mal), doublons possibles entre canaux de collecte, montants parfois notifiés
            (prévisionnels) et non payés, seuil de publication (les petits achats n’y figurent pas).
            Un montant DECP n’est pas une preuve de paiement — c’est un engagement contractuel public.
          </div>
        </div>
      </div>
    </div>
  );
}
