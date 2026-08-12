import S from '../data/budget-series.json';
import NAT from '../data/budget-natures.json';

export { S, NAT };
export const NATLBL = {
  D1: 'Rémunérations des personnels', P2: 'Fonctionnement courant',
  D62: 'Prestations sociales en espèces', D632: 'Prestations en nature (remboursements, délégations)',
  D3: 'Subventions', D4: 'Intérêts et revenus de la propriété', D7: 'Autres transferts courants',
  D9: 'Transferts en capital', P5L: 'Investissement direct', OED: 'Impôts et taxes payés',
};
export const NATKEYS = Object.keys(NATLBL);
export const PAYERS = [
  ['etat', 'État', '#2a78d6'], ['odac', 'ODAC (opérateurs de l’État)', '#4a3aa7'],
  ['apul', 'Collectivités locales', '#1baf7a'], ['asso', 'Sécurité sociale', '#eb6834'],
];
const iy = y => S.years.indexOf(y);
export const val = (c, y) => { const a = S.v[c]; return a ? a[iy(y)] : null; };
export const natVal = (code, k, y) => { const a = (NAT[code] || {})[k]; return a ? a[iy(y)] : null; };
export const payVal = (code, k, y) => {
  const p = S.pay[code]; if (!p || !p[k]) return null;
  const i = S.payYears.indexOf(y); return i < 0 ? null : p[k][i];
};
export const payOK = y => S.payYears.includes(y);
export const kids1 = () => Object.keys(S.v).filter(c => c.length === 4 && c.startsWith('GF'));
export const kids2 = gf => Object.keys(S.v).filter(c => c.length === 6 && c.startsWith(gf));
export function inflation(y0, y1) {
  let f = 1;
  for (let y = y0 + 1; y <= y1; y++) f *= 1 + (S.ipc[y] || 0) / 100;
  return (f - 1) * 100;
}
