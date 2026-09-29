import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function createMap(el) {
  const map = L.map(el, { worldCopyJump: true }).setView([30, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  const layer = L.layerGroup().addTo(map);

  return {
    show(a, b) {
      layer.clearLayers();
      const styles = getComputedStyle(document.documentElement);
      const colorA = styles.getPropertyValue('--city-a').trim();
      const colorB = styles.getPropertyValue('--city-b').trim();
      const muted = styles.getPropertyValue('--line').trim();
      const points = [];

      if (a) {
        // Meridian through city A: the ideal line for city B to sit on.
        L.polyline([[-85, a.lon], [85, a.lon]], { color: muted, weight: 1.5, dashArray: '6 6' })
          .bindTooltip(`Meridian ${a.lon.toFixed(2)}°`)
          .addTo(layer);
        L.circleMarker([a.lat, a.lon], { radius: 8, color: colorA, fillColor: colorA, fillOpacity: 0.9 })
          .bindTooltip(`A: ${a.name}`, { permanent: true, direction: 'right', offset: [10, 0] })
          .addTo(layer);
        points.push([a.lat, a.lon]);
      }
      if (b) {
        L.circleMarker([b.lat, b.lon], { radius: 8, color: colorB, fillColor: colorB, fillOpacity: 0.9 })
          .bindTooltip(`B: ${b.name}`, { permanent: true, direction: 'right', offset: [10, 0] })
          .addTo(layer);
        points.push([b.lat, b.lon]);
      }
      if (a && b) {
        L.polyline(points, { color: colorB, weight: 2 }).addTo(layer);
        map.fitBounds(points, { padding: [60, 60], maxZoom: 7, animate: false });
      } else if (points.length) {
        map.setView(points[0], 5, { animate: false });
      }
    },
  };
}
