import { useEffect, useRef, useState } from 'react';
import MapView, { Marker, Polyline } from '../platform/maps';
import { nativeMapConfigured } from '../config/services';
import type { GeoPoint } from '../nav/navigation';
import { Action } from './ProductPage';
export function PlaceMap({ point, title, onChange, route, markers }: { point: GeoPoint; title: string; onChange?: (point: GeoPoint) => void; route?: GeoPoint[]; markers?: {point:GeoPoint;title:string;onSelect?:()=>void}[] }) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const multipleMarkers = (markers?.length ?? 0) > 1;
  const focusLatitude = markers?.length === 1 ? markers[0].point.latitude : point.latitude;
  const focusLongitude = markers?.length === 1 ? markers[0].point.longitude : point.longitude;
  useEffect(() => {
    if (ready) map.current?.animateToRegion({ latitude: focusLatitude, longitude: focusLongitude }, 0);
  }, [ready, multipleMarkers, focusLatitude, focusLongitude]);
  if (!nativeMapConfigured) return <p className="cw-help">Map display unavailable. Coordinates and the entrance editor remain available.</p>;
  return <>
    <div className="cw-place-map" style={{ position: 'relative', height: 240 }} aria-label={`Map of ${title}`}>
      <MapView ref={map} initialRegion={point} onMapReady={() => setReady(true)} onMapLoaded={() => {}} onPanDrag={() => {}} onPress={() => {}} onPoiClick={() => {}} onRegionChangeComplete={() => {}} accessibilityLabel={`Map of ${title}. The location and route are also available as text.`}>
        {markers ? markers.map((m,i)=><Marker key={i} coordinate={m.point} title={m.title} onPress={m.onSelect}/>) : <Marker coordinate={point} title={title} draggable={!!onChange} onDragEnd={onChange} />}
        {route && <Polyline coordinates={route} strokeColor="#1464C0" strokeWidth={5} />}
      </MapView>
    </div>
    {(!!route?.length || multipleMarkers) && <div className="cw-actions"><Action secondary onClick={() => map.current?.animateToRegion(point, 0)}>Focus destination</Action>{!!route?.length && <Action secondary onClick={() => map.current?.fitToCoordinates(route, {})}>Show whole route</Action>}{multipleMarkers&&<Action secondary onClick={()=>map.current?.fitToCoordinates(markers!.map(m=>m.point),{})}>Show all places</Action>}</div>}
  </>;
}
