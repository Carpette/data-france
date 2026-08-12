import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Canicule from './pages/Canicule.jsx';
import Budget from './pages/Budget.jsx';
import Marches from './pages/Marches.jsx';
import ReportButton from './components/ReportButton.jsx';

const linkStyle = ({ isActive }) => ({
  padding: '8px 14px', borderRadius: 9, textDecoration: 'none', fontSize: 13.5,
  color: isActive ? 'var(--page)' : 'var(--ink-2)',
  background: isActive ? 'var(--ink)' : 'transparent', fontWeight: isActive ? 620 : 400,
});

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

export default function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [unicorn, setUnicorn] = useState(false);
  const [toast, setToast] = useState(null);
  const buf = useRef([]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.unicorn = unicorn ? 'true' : 'false'; }, [unicorn]);
  useEffect(() => {
    const onKey = e => {
      buf.current.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      buf.current = buf.current.slice(-KONAMI.length);
      if (KONAMI.every((k, i) => buf.current[i] === k)) {
        buf.current = [];
        setUnicorn(u => {
          const next = !u;
          setToast(next ? '🦄 Mode licorne activé — même code pour revenir au sérieux'
                        : '📊 Retour au mode sérieux');
          setTimeout(() => setToast(null), 3200);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 22px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <NavLink to="/" className="brand" style={{ textDecoration: 'none', color: 'var(--ink)', fontWeight: 700, fontSize: 17, letterSpacing: '-.02em' }}>
          {unicorn ? '🦄 data-licorne' : 'data-france'}
        </NavLink>
        <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <NavLink to="/canicule" style={linkStyle}>Canicule</NavLink>
          <NavLink to="/budget" style={linkStyle}>Dépense publique</NavLink>
          <NavLink to="/marches" style={linkStyle}>Marchés publics</NavLink>
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <ReportButton />
          <button className="btn"
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/canicule" element={<Canicule />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/marches" element={<Marches />} />
      </Routes>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          background: 'var(--ink)', color: 'var(--page)', borderRadius: 12, padding: '10px 18px',
          fontSize: 14, fontWeight: 600, boxShadow: '0 8px 28px rgba(0,0,0,.35)',
        }}>{toast}</div>
      )}
      {unicorn && <div className="unicorn-sky" aria-hidden="true">{['🦄','🌈','⭐','🦄','✨','🌈','🦄'].map((c, i) =>
        <span key={i} style={{ animationDelay: `${i * 1.7}s`, left: `${(i * 13 + 5) % 92}%` }}>{c}</span>)}</div>}
      {unicorn && <img className="unicorn-cameo" alt="" aria-hidden="true"
        src={`${import.meta.env.BASE_URL}licorne.gif`} />}
      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--hair)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
        Données publiques : INSEE (comptes nationaux, COFOG), Santé publique France (ODISSE),
        ODRÉ, data.economie.gouv.fr (DECP). Ce site est un observatoire indépendant ;
        les précautions d'interprétation propres à chaque jeu de données sont rappelées sur chaque page.
        Une erreur ? <a href="https://github.com/Carpette/data-france/issues/new/choose" target="_blank" rel="noopener">Ouvrez un ticket</a> —
        le bouton « Signaler une erreur » pré-remplit le contexte pour vous.
      </footer>
    </div>
  );
}
