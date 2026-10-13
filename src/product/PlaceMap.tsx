import { useRef } from 'react';
import MapView, { Marker, Polyline } from '../platform/maps';
import { nativeMapConfigured } from '../config/services';
import type { GeoPoint } from '../nav/navigation';
export function PlaceMap({ point, title, onChange, route, markers }: { point: GeoPoint; title: string; onChange?: (point: GeoPoint) => void; route?: GeoPoint[]; markers?: {point:GeoPoint;title:string;onSelect?:()=>void}[] }) {
  const map = useRef<MapView>(null);
  if (!nativeMapConfigured) return <p className="cw-help">Map display unavailable. Coordinates and the entrance editor remain available.</p>;
  return <div className="cw-place-map" style={{ position: 'relative', height: 240 }} aria-label={`Map of ${title}`}>
    <MapView ref={map} initialRegion={point} onMapReady={() => { if (route?.length) map.current?.fitToCoordinates(route, {}); else if(markers?.length) map.current?.fitToCoordinates(markers.map(m=>m.point),{}); else map.current?.animateToRegion(point, 0); }} onMapLoaded={() => {}} onPanDrag={() => {}} onPress={() => {}} onPoiClick={() => {}} onRegionChangeComplete={() => {}} accessibilityElementsHidden>
      {markers ? markers.map((m,i)=><Marker key={i} coordinate={m.point} title={m.title} onPress={m.onSelect}/>) : <Marker coordinate={point} title={title} draggable={!!onChange} onDragEnd={onChange} />}
      {route && <Polyline coordinates={route} strokeColor="#1464C0" strokeWidth={5} />}
    </MapView>
  </div>;
}
