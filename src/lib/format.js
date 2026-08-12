export const fmt = v => {
  const a = Math.abs(v);
  return a >= 100 ? Math.round(v).toLocaleString('fr-FR')
       : a >= 10 ? v.toFixed(1).replace('.', ',')
       : v.toFixed(2).replace('.', ',');
};
export const pct = (v, t) => {
  const p = v / t * 100;
  return p.toFixed(p >= 10 ? 0 : 1).replace('.', ',') + ' %';
};
export const eur = v => v == null ? '—' :
  v >= 1e9 ? (v / 1e9).toFixed(2).replace('.', ',') + ' Md€' :
  v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' M€' :
  v >= 1e3 ? Math.round(v / 1e3).toLocaleString('fr-FR') + ' k€' :
  Math.round(v).toLocaleString('fr-FR') + ' €';
export const PAL = ['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#4a3aa7','#e34948','#0e7a8a','#8a6d3b'];
