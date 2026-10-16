import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import type { EngineSnapshot } from '../crossing/crossingEngine';
import { isVehicle, ObjectCategory } from '../perception/detection';
import {useType} from './theme';
import { type VehicleVisibility, visibleVehicle } from './vehicleVisibility';
import { containRect, coverRect } from './previewGeometry';

function useLayout(): [{ width: number; height: number }, (e: LayoutChangeEvent) => void] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return [size, (e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })];
}

function colorOf(category: ObjectCategory): string {
  switch (category) {
    case ObjectCategory.PED_WALK:
      return '#00E676';
    case ObjectCategory.PED_DONT_WALK:
      return '#FF5252';
    case ObjectCategory.TRAFFIC_LIGHT:
    case ObjectCategory.PED_COUNTDOWN:
      return '#FFD600';
    case ObjectCategory.CROSSWALK:
      return '#FFFFFF';
    case ObjectCategory.PERSON:
      return '#E040FB';
    default:
      return isVehicle(category) ? '#00E5FF' : '#9E9E9E';
  }
}

/** Draws tracked objects over the center-cropped preview (same crop as the preview's "cover"). */
export function DetectionOverlay({ snapshot, frameAspect, resizeMode = 'cover', visibility, carsOnly = false }: {
  snapshot: EngineSnapshot; frameAspect: number; resizeMode?: 'cover' | 'contain'; visibility?:VehicleVisibility; carsOnly?:boolean;
}) {
  const type = useType();
  const [size, onLayout] = useLayout();
  const rect = size.width > 0 ? (resizeMode === 'contain' ? containRect : coverRect)(size.width, size.height, frameAspect) : null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout} accessibilityElementsHidden>
      {rect &&
        snapshot.tracks.filter(t => (!carsOnly || t.category === ObjectCategory.CAR) && visibleVehicle(t,visibility)).map((t) => (
          <View
            key={t.id}
            style={{
              position: 'absolute',
              left: rect.x + t.box.left * rect.width,
              top: rect.y + t.box.top * rect.height,
              width: t.box.width * rect.width,
              height: t.box.height * rect.height,
              borderWidth: t.isPrimarySignal ? 4 : 2,
              borderColor: t.motion === 'MOVING' ? '#FF5252' : t.motion === 'STATIONARY' ? '#69DB92' : '#FFD600',
            }}
          >
            <Text style={[type.labelMedium, { backgroundColor: '#071318E8', color: colorOf(t.category), alignSelf: 'flex-start', paddingHorizontal: 3 }]}>
              #{t.id} {t.motion ?? 'VEHICLE'} {t.direction === 'LEFT_TO_RIGHT' ? '→' : t.direction === 'RIGHT_TO_LEFT' ? '←' : ''}
            </Text>
          </View>
        ))}
    </View>
  );
}

export function SegmentationOverlay(_props:{mask:unknown;frameAspect:number;resizeMode:string}){return null;}
