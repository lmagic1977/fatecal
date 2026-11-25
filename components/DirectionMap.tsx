'use client';

// Map around the user's location with the day's lucky directions (green) and the sha direction (red) drawn as wedges.
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Lang } from '@/lib/i18n';

const BEARING: Record<string, number> = { 北: 0, 正北: 0, 东北: 45, 东: 90, 正东: 90, 东南: 135, 南: 180, 正南: 180, 西南: 225, 西: 270, 正西: 270, 西北: 315 };

export interface MapDir { raw: string; label: string; dir: string }

// point at distance d (meters) and bearing b (degrees) from lat/lng
function dest(lat: number, lng: number, b: number, d: number): [number, number] {
  const R = 6371000, br = (b * Math.PI) / 180, p1 = (lat * Math.PI) / 180, l1 = (lng * Math.PI) / 180, a = d / R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(a) + Math.cos(p1) * Math.sin(a) * Math.cos(br));
  const l2 = l1 + Math.atan2(Math.sin(br) * Math.sin(a) * Math.cos(p1), Math.cos(a) - Math.sin(p1) * Math.sin(p2));
  return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
}
function wedge(lat: number, lng: number, center: number, width: number, r: number): [number, number][] {
  const pts: [number, number][] = [[lat, lng]];
  for (let b = center - width / 2; b <= center + width / 2 + 0.01; b += 3) pts.push(dest(lat, lng, b, r));
  pts.push([lat, lng]);
  return pts;
}

export default function DirectionMap({ lang, lucky, sha, shaLabel }: { lang: Lang; lucky: MapDir[]; sha: string; shaLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'ask' | 'locating' | 'ok' | 'denied'>('ask');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const L3 = (en: string, zh: string, es: string) => (lang === 'zh' ? zh : lang === 'es' ? es : en);

  function locate() {
    if (!navigator.geolocation) { setState('denied'); return; }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setState('ok'); },
      () => setState('denied'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }

  useEffect(() => {
    if (state !== 'ok' || !pos || !box.current) return;
    let map: any;
    let gone = false;
    import('leaflet').then((L) => {
      if (gone || !box.current) return;
      map = L.map(box.current, { zoomControl: false, attributionControl: true }).setView([pos.lat, pos.lng], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const R = 1600;
      // sha: a whole quarter (90°); lucky gods: one of eight directions (45°)
      const sb = BEARING[sha];
      if (sb !== undefined) {
        L.polygon(wedge(pos.lat, pos.lng, sb, 90, R), { color: '#E0525B', weight: 1, fillColor: '#E0525B', fillOpacity: 0.22 }).addTo(map);
        L.marker(dest(pos.lat, pos.lng, sb, R * 0.6), { icon: L.divIcon({ className: 'dirpin', html: '' }), interactive: false }).addTo(map)
          .bindTooltip(`⚠️ ${shaLabel}`, { permanent: true, direction: 'center', className: 'dirtip bad' });
      }
      const groups = new Map<number, string[]>();
      for (const d of lucky) { const b = BEARING[d.raw]; if (b === undefined) continue; groups.set(b, [...(groups.get(b) ?? []), d.label]); }
      for (const [b, labels] of groups) {
        L.polygon(wedge(pos.lat, pos.lng, b, 45, R), { color: '#2E9E6A', weight: 1, fillColor: '#3BB57B', fillOpacity: 0.28 }).addTo(map);
        const at = dest(pos.lat, pos.lng, b, R * 0.62);
        L.marker(at, { icon: L.divIcon({ className: 'dirpin', html: '' }), interactive: false }).addTo(map).bindTooltip(`✨ ${labels.join(' · ')}`, { permanent: true, direction: 'center', className: 'dirtip good' });
      }
      // N/E/S/W letters at the edge
      const NESW = lang === 'zh' ? ['北', '东', '南', '西'] : lang === 'es' ? ['N', 'E', 'S', 'O'] : ['N', 'E', 'S', 'W'];
      NESW.forEach((t, i) => L.marker(dest(pos.lat, pos.lng, i * 90, R * 1.18), { icon: L.divIcon({ className: 'dirpin', html: '' }), interactive: false }).addTo(map).bindTooltip(t, { permanent: true, direction: 'center', className: 'dirtip nesw' }));
      L.circleMarker([pos.lat, pos.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#5B5BF0', fillOpacity: 1 }).addTo(map).bindTooltip(L3('You', '你在这里', 'Tú'), { direction: 'top', offset: [0, -6] });
      map.fitBounds(L.latLng(pos.lat, pos.lng).toBounds(R * 2.6));
    });
    return () => { gone = true; map?.remove(); };
  }, [state, pos, lucky, sha, shaLabel, lang]);

  if (state !== 'ok') {
    return (
      <div className="dirmap-ask">
        <p className="small">{L3('See the lucky directions around where you are, on a map.', '在地图上看看你附近哪个方向吉、哪个方向要避开。', 'Mira en un mapa las direcciones de suerte a tu alrededor.')}</p>
        <button className="primary" onClick={locate} disabled={state === 'locating'}>
          📍 {state === 'locating' ? L3('Finding you…', '正在定位…', 'Buscando…') : L3('Show on map', '在地图上显示', 'Ver en el mapa')}
        </button>
        {state === 'denied' && <p className="small danger">{L3('Location is off. Allow location for FateCal in Settings and try again.', '定位权限没打开。请在手机「设置」里允许随身吉历使用位置，再试一次。', 'La ubicación está desactivada. Actívala para FateCal en Ajustes.')}</p>}
        <p className="tiny muted">{L3('Your location is only used on this phone to draw the map.', '位置只在这台手机上用来画地图，不会上传。', 'Tu ubicación solo se usa en este teléfono para dibujar el mapa.')}</p>
      </div>
    );
  }
  return (
    <>
      <div ref={box} className="dirmap" />
      <p className="tiny muted">{L3('Green = lucky directions, red = the day’s sha direction. Directions are true north on the map.', '绿色是吉方，红色是煞方。地图上方是正北。', 'Verde = direcciones de suerte; rojo = dirección sha. El norte está arriba.')}</p>
    </>
  );
}
