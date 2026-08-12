import { fmt, pct } from '../lib/format.js';

export default function LegendRows({ slices, total, focus, onFocus, onSlice, unit = 'Md€', subFor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 560, overflow: 'auto' }}>
      {slices.map(s => (
        <div key={s.c}
          onMouseEnter={() => onFocus?.(s.c)} onMouseLeave={() => onFocus?.(null)}
          onClick={() => onSlice?.(s)}
          style={{
            display: 'grid', gridTemplateColumns: '14px 1fr 82px 52px', gap: 10, alignItems: 'center',
            padding: '8px 10px', borderRadius: 9, fontSize: 13,
            cursor: s.drill === false ? 'default' : 'pointer',
            opacity: focus && focus !== s.c ? 0.4 : 1,
            background: focus === s.c ? 'var(--surface-2)' : 'transparent',
          }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: s.col }} />
          <div style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.l}
            {subFor?.(s) && <span style={{ display: 'block', color: 'var(--muted)', fontSize: 11.5 }}>{subFor(s)}</span>}
          </div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(s.v)} {unit}</div>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>{pct(s.v, total)}</div>
        </div>
      ))}
    </div>
  );
}
