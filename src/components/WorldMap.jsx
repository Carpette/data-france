import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Carte mondiale générique (Leaflet + OpenStreetMap).
 * markers: [{ lat, lon, icon (emoji), rot?, size?, html (tooltip) }]
 * nightAt: date ISO — dessine la zone de nuit (terminateur solaire) à cet instant.
 */

/* Position subsolaire (déclinaison + longitude) — validée contre les éphémérides. */
function sunPosition(date) {
  const rad = Math.PI / 180;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const RA = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const GMST = (280.46061837 + 360.98564736629 * n) % 360;
  let lng = (RA / rad) - GMST;
  lng = ((lng % 360) + 540) % 360 - 180;
  return { decl, lng };
}

/* Polygone de la nuit : latitude du terminateur pour chaque longitude,
   refermé sur le pôle opposé au soleil. */
function nightPolygon(date) {
  const rad = Math.PI / 180;
  const { decl, lng } = sunPosition(date);
  const pts = [];
  for (let lo = -180; lo <= 180; lo += 2) {
    const ha = (lo - lng) * rad;
    const lat = Math.atan(-Math.cos(ha) / Math.tan(decl)) / rad;
    pts.push([lat, lo]);
  }
  const pole = decl > 0 ? -90 : 90;
  pts.push([pole, 180], [pole, -180]);
  return pts;
}

export default function WorldMap({ markers, height = 440, nightAt = null }) {
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
    if (nightAt) {
      if (!mapRef.current._nightLayer) {
        mapRef.current._nightLayer = L.layerGroup().addTo(mapRef.current);
      }
      const nl = mapRef.current._nightLayer;
      nl.clearLayers();
      L.polygon(nightPolygon(new Date(nightAt)), {
        stroke: false, fillColor: '#0b1030', fillOpacity: 0.22, interactive: false,
      }).addTo(nl);
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
