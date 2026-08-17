import { Link } from 'react-router-dom';

const cards = [
  { to: '/canicule', title: 'Canicule par département',
    desc: 'Jours d’alerte, sévérité et jours ≥ 30 °C depuis 2004, carte interactive par département.',
    src: 'Santé publique France · ODRÉ' },
  { to: '/budget', title: 'Où va l’argent public ?',
    desc: 'La dépense publique 1995-2024 : fonctions, sous-fonctions, nature de chaque dépense, qui paie, et comparateur entre deux années.',
    src: 'INSEE, comptes nationaux (COFOG)' },
  { to: '/marches', title: 'Marchés publics — qui est payé ?',
    desc: 'Le niveau le plus fin public : chaque marché attribué, son acheteur, son titulaire et son montant, en interrogeant les données officielles en direct.',
    src: 'DECP · data.economie.gouv.fr' },
  { to: '/pollueurs', title: 'Les plus gros pollueurs',
    desc: 'Émissions estimées installation par installation, dans le monde entier : centrales, mines, usines, champs pétroliers — avec opérateur et localisation.',
    src: 'Climate TRACE (satellites + registres)' },
  { to: '/aviation', title: 'Jets privés en vol',
    desc: 'Photographie temps réel des jets d’affaires captés par le réseau ADS-B, immatriculations et liens vers les registres publics. L’outil, pas l’identification.',
    src: 'adsb.lol · registres FAA/DGAC/CAA' },
];

export default function Home() {
  return (
    <div>
      <h1>Explorer les données publiques françaises</h1>
      <p className="sub">Des agrégats nationaux jusqu’au marché public individuel —
        avec, à chaque niveau, les limites honnêtes de ce que les données permettent de conclure.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginTop: 22 }}>
        {cards.map(c => (
          <Link key={c.to} to={c.to} className="card" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
            <div style={{ fontWeight: 650, fontSize: 16, marginBottom: 6 }}>{c.title}</div>
            <div style={{ color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.55 }}>{c.desc}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>{c.src}</div>
          </Link>
        ))}
      </div>
      <div className="warnbox">
        <strong>Ce que ce site ne montre pas :</strong> les factures et justificatifs de paiement de
        l’État ne sont pas publics (Chorus Pro n’est pas en open data). Le niveau le plus fin
        légalement accessible est le marché public attribué (base DECP) et les subventions votées.
      </div>
    </div>
  );
}
