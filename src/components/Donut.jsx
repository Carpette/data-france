import { useState } from 'react';
import { pct } from '../lib/format.js';

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/**
 * slices: [{c,l,v,col,drill?}] — total: denominator — center: {v,l,s}
 * onSlice(slice), focus/onFocus for legend sync, renderTip(slice)=>string[]
 */
export default function Donut({ slices, total, center, onSlice, focus, onFocus, renderTip }) {
  const [tip, setTip] = useState(null);
  const cx = 280, cy = 280, r0 = 118, r1 = 232;
  let a = -Math.PI / 2;
  const segs = slices.map(s => {
    const a0 = a, a1 = a + Math.max(s.v / total * 2 * Math.PI, 0.004);
    a = a1;
    return { ...s, a0, a1 };
  });
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 560 560" role="img" style={{ display: 'block', width: '100%', height: 'auto' }}>
        {segs.map(s => (
          <path key={s.c} d={arc(cx, cy, r0, r1, s.a0, s.a1)} fill={s.col}
            style={{
              cursor: s.drill === false ? 'default' : 'pointer',
              stroke: 'var(--surface)', strokeWidth: 2, transition: 'opacity .12s',
              opacity: focus && focus !== s.c ? 0.35 : 1,
            }}
            onMouseEnter={() => onFocus?.(s.c)}
            onMouseLeave={() => { onFocus?.(null); setTip(null); }}
            onMouseMove={e => setTip({ s, x: e.clientX, y: e.clientY })}
            onClick={() => onSlice?.(s)} />
        ))}
        {segs.filter(s => (s.a1 - s.a0) > 0.35).map(s => {
          const mid = (s.a0 + s.a1) / 2, lr = (r0 + r1) / 2;
          return (
            <text key={'t' + s.c} x={cx + lr * Math.cos(mid)} y={cy + lr * Math.sin(mid)}
              textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 13, fontWeight: 600, fill: '#fff', pointerEvents: 'none' }}>
              {pct(s.v, total)}
            </text>
          );
        })}
        <text x={cx} y={cy - 10} textAnchor="middle"
          style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-.02em', fill: 'var(--ink)' }}>{center.v}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontSize: 12.5, fill: 'var(--muted)' }}>{center.l}</text>
        {center.s && <text x={cx} y={cy + 38} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink-2)' }}>{center.s}</text>}
      </svg>
      {tip && renderTip && (
        <div style={{
          position: 'fixed', left: Math.min(tip.x + 16, window.innerWidth - 280), top: tip.y + 14,
          zIndex: 50, pointerEvents: 'none', background: 'var(--surface-2)',
          border: '1px solid var(--hair)', borderRadius: 10, padding: '11px 13px', maxWidth: 300,
          boxShadow: '0 8px 28px rgba(0,0,0,.35)',
        }}>
          <div style={{ fontWeight: 640, fontSize: 13.5 }}>{tip.s.l}</div>
          {renderTip(tip.s).map((line, i) => (
            <div key={i} style={i === 0
              ? { fontSize: 21, fontWeight: 650, margin: '3px 0 1px' }
              : { color: 'var(--muted)', fontSize: 12 }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
