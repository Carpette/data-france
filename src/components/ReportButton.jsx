import { useLocation } from 'react-router-dom';

const REPO = 'https://github.com/Carpette/data-france';

/** Bouton « Signaler une erreur » : ouvre une issue GitHub pré-remplie
 *  avec la page courante, l'URL complète et l'environnement du visiteur. */
export default function ReportButton({ context = '' }) {
  const loc = useLocation();
  const open = () => {
    const body = [
      '### Contexte (pré-rempli)',
      `- Page : \`${loc.pathname}\``,
      `- URL : ${window.location.href}`,
      context ? `- État : ${context}` : null,
      `- Navigateur : ${navigator.userAgent}`,
      `- Date : ${new Date().toISOString()}`,
      '',
      '### Ce qui ne va pas',
      '_Décrivez le problème ici (chiffre faux, affichage cassé…) — une capture d’écran aide._',
    ].filter(Boolean).join('\n');
    const url = `${REPO}/issues/new?title=${encodeURIComponent('[Signalement] ')}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  };
  return (
    <button className="btn" onClick={open} title="Ouvre un ticket GitHub pré-rempli (compte GitHub requis)">
      Signaler une erreur
    </button>
  );
}
