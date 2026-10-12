import React, { createContext, useContext, useEffect, useRef } from "react";
import { services } from "../config/services";
import type { GeoPoint } from "../nav/navigation";
import type { ViewStyle } from "react-native";
export const PROVIDER_GOOGLE = "google";
const MapContext = createContext<google.maps.Map | null>(null);
let loader: Promise<void> | null = null;
function load() {
  return (loader ??= new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(services.mapsBrowserKey)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Map unavailable."));
    document.head.appendChild(script);
  }));
}
const point = (p: GeoPoint) => ({ lat: p.latitude, lng: p.longitude });
interface Props {
  children?: React.ReactNode;
  style?: ViewStyle;
  provider?: string;
  initialRegion: GeoPoint & { latitudeDelta?: number; longitudeDelta?: number };
  userInterfaceStyle?: string;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  showsCompass?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  mapPadding?: { top: number; bottom: number; left: number; right: number };
  showsMyLocationButton?: boolean;
  showsUserLocation?: boolean;
  toolbarEnabled?: boolean;
  onMapReady: () => void;
  onMapLoaded: () => void;
  onPanDrag: () => void;
  onPress: (event: { nativeEvent: { action: string } }) => void;
  onPoiClick: (event: { nativeEvent: { placeId: string } }) => void;
  onRegionChangeComplete: (
    _region: unknown,
    details: { isGesture: boolean },
  ) => void;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: string;
}
export default class MapView extends React.Component<
  Props,
  { map: google.maps.Map | null }
> {
  state = { map: null as google.maps.Map | null };
  private div = React.createRef<HTMLDivElement>();
  private alive = true;
  componentDidMount() {
    void load()
      .then(() => {
        if (!this.alive || !this.div.current) return;
        const map = new google.maps.Map(this.div.current, {
          center: point(this.props.initialRegion),
          zoom: 2,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: true,
        });
        this.setState({ map });
        this.props.onMapReady();
        google.maps.event.addListenerOnce(
          map,
          "tilesloaded",
          this.props.onMapLoaded,
        );
        map.addListener("dragstart", this.props.onPanDrag);
        map.addListener("click", (e: google.maps.IconMouseEvent) => {
          if (e.placeId) {
            e.stop();
            this.props.onPoiClick({ nativeEvent: { placeId: e.placeId } });
          } else this.props.onPress({ nativeEvent: { action: "press" } });
        });
      })
      .catch(() => {});
  }
  componentWillUnmount() {
    this.alive = false;
    if (this.state.map)
      google.maps.event.clearInstanceListeners(this.state.map);
  }
  animateToRegion(
    p: GeoPoint & { latitudeDelta?: number; longitudeDelta?: number },
    _ms: number,
  ) {
    this.state.map?.panTo(point(p));
    this.state.map?.setZoom(17);
  }
  animateCamera(config: { heading: number; pitch: number }) {
    this.state.map?.setHeading(config.heading);
    this.state.map?.setTilt(config.pitch);
  }
  fitToCoordinates(points: GeoPoint[], options: { edgePadding?: google.maps.Padding; animated?: boolean }) {
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(point(p)));
    const edge = options.edgePadding;
    const padding = this.props.mapPadding;
    this.state.map?.fitBounds(bounds, {
      top: (edge?.top ?? 40) + (padding?.top ?? 0),
      right: (edge?.right ?? 40) + (padding?.right ?? 0),
      bottom: edge?.bottom ?? 40,
      left: (edge?.left ?? 40) + (padding?.left ?? 0),
    });
  }
  render() {
    return (
      <>
        <div
          ref={this.div}
          aria-hidden={this.props.accessibilityElementsHidden}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: this.props.mapPadding?.bottom ?? 0 }}
        />
        <MapContext.Provider value={this.state.map}>
          {this.props.children}
        </MapContext.Provider>
      </>
    );
  }
}
export function Marker({
  coordinate,
  title,
  description,
  onPress,
  pinColor,
}: {
  coordinate: GeoPoint;
  title?: string;
  description?: string;
  onPress?: () => void;
  pinColor?: string;
}) {
  const map = useContext(MapContext),
    callback = useRef(onPress);
  callback.current = onPress;
  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({
      map,
      position: point(coordinate),
      title,
      icon: pinColor
        ? {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: pinColor,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          }
        : undefined,
    });
    marker.addListener("click", () => callback.current?.());
    return () => {
      marker.setMap(null);
    };
  }, [
    map,
    coordinate.latitude,
    coordinate.longitude,
    title,
    description,
    pinColor,
  ]);
  return null;
}
export function Polyline({
  coordinates,
  strokeColor,
  strokeWidth,
}: {
  coordinates: GeoPoint[];
  strokeColor: string;
  strokeWidth: number;
}) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map) return;
    const line = new google.maps.Polyline({
      map,
      path: coordinates.map(point),
      strokeColor,
      strokeWeight: strokeWidth,
    });
    return () => line.setMap(null);
  }, [map, coordinates, strokeColor, strokeWidth]);
  return null;
}
export function Circle({
  center,
  radius,
  fillColor,
  strokeColor,
}: {
  center: GeoPoint;
  radius: number;
  fillColor: string;
  strokeColor: string;
}) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map) return;
    const c = new google.maps.Circle({
      map,
      center: point(center),
      radius,
      fillColor,
      strokeColor,
      fillOpacity: 0.14,
    });
    return () => c.setMap(null);
  }, [map, center, radius, fillColor, strokeColor]);
  return null;
}
