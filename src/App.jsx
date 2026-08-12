import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Canicule from './pages/Canicule.jsx';
import Budget from './pages/Budget.jsx';
import Marches from './pages/Marches.jsx';

const linkStyle = ({ isActive }) => ({
  padding: '8px 14px', borderRadius: 9, textDecoration: 'none', fontSize: 13.5,
  color: isActive ? 'var(--page)' : 'var(--ink-2)',
  background: isActive ? 'var(--ink)' : 'transparent', fontWeight: isActive ? 620 : 400,
});

export default function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 22px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <NavLink to="/" style={{ textDecoration: 'none', color: 'var(--ink)', fontWeight: 700, fontSize: 17, letterSpacing: '-.02em' }}>
          data-france
        </NavLink>
        <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <NavLink to="/canicule" style={linkStyle}>Canicule</NavLink>
          <NavLink to="/budget" style={linkStyle}>Dépense publique</NavLink>
          <NavLink to="/marches" style={linkStyle}>Marchés publics</NavLink>
        </nav>
        <button className="btn" style={{ marginLeft: 'auto' }}
          onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
        </button>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/canicule" element={<Canicule />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/marches" element={<Marches />} />
      </Routes>
      <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--hair)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
        Données publiques : INSEE (comptes nationaux, COFOG), Santé publique France (ODISSE),
        ODRÉ, data.economie.gouv.fr (DECP). Ce site est un observatoire indépendant ;
        les précautions d'interprétation propres à chaque jeu de données sont rappelées sur chaque page.
      </footer>
    </div>
  );
}
