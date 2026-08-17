import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Carte mondiale générique (Leaflet + OpenStreetMap).
 * markers: [{ lat, lon, icon (emoji), rot?, size?, html (tooltip) }]
 */
export default function WorldMap({ markers, height = 440 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current && ref.current) {
      mapRef.current = L.map(ref.current, { worldCopyJump: true }).setView([30, 5], 2);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(mapRef.current);
      layerRef.current = L.layerGroup().addTo(mapRef.current);
    }
    const lg = layerRef.current;
    if (!lg) return;
    lg.clearLayers();
    const pts = [];
    (markers || []).forEach(m => {
      if (m.lat == null || m.lon == null) return;
      pts.push([m.lat, m.lon]);
      const icon = L.divIcon({
        className: '',
        html: `<div style="font-size:${m.size || 20}px;line-height:1;transform:rotate(${m.rot || 0}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));cursor:pointer">${m.icon}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      L.marker([m.lat, m.lon], { icon }).addTo(lg)
        .bindTooltip(m.html, { direction: 'auto', offset: [14, 0], opacity: 0.97 });
    });
    if (pts.length) mapRef.current.fitBounds(pts, { padding: [30, 30], maxZoom: 6 });
  }, [markers]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} style={{ height, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }} />;
}
