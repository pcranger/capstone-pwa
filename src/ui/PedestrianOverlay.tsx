import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from './ScaledText';
import { coverRect, containRect } from './previewGeometry';
import type { PedestrianScene, PedestrianObservation } from '../perception/pedestrianTypes';

export function pedestrianLabel(o: PedestrianObservation) {
  if (o.kind === 'countdown') return o.seconds == null ? 'Countdown · unreadable' : `Countdown · ${o.seconds}s · do not start`;
  if (o.kind === 'button') return 'Possible crossing button';
  if (o.kind === 'press-surface') return 'Possible press surface';
  return `${o.phase === 'GREEN' ? 'Green pedestrian' : o.phase === 'RED' ? 'Red pedestrian' : 'Signal unclear'}${o.source === 'shape' ? ' · shape estimate' : ''}`;
}
export function PedestrianOverlay({ scene, frameAspect, resizeMode = 'cover' }: { scene: PedestrianScene; frameAspect: number; resizeMode?: 'cover' | 'contain' }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize(e.nativeEvent.layout);
  const rect = size.width ? (resizeMode === 'cover' ? coverRect : containRect)(size.width, size.height, frameAspect) : null;
  return <View testID="pedestrian-overlay" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none" onLayout={onLayout} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {rect && scene.observations.map(o => {
      const left = rect.x + o.box.left * rect.width, top = rect.y + o.box.top * rect.height;
      const labelWidth = Math.min(260, size.width - 6);
      const labelLeft = Math.max(0, Math.min(left, size.width - labelWidth - 6)) - left;
      return <View key={o.id} testID={`pedestrian-box-${o.kind}`} style={{ position: 'absolute', left, top, width: o.box.width * rect.width, height: o.box.height * rect.height, borderWidth: 3, borderColor: o.phase === 'RED' ? '#FF5252' : o.phase === 'GREEN' ? '#00E676' : '#FFD87A' }}>
        <Text testID="pedestrian-box-label" numberOfLines={1} style={{ position: 'absolute', left: labelLeft, top: Math.max(-25, -top), width: labelWidth, minWidth: labelWidth, maxWidth: labelWidth, color: '#FFF', backgroundColor: '#071318E8', fontSize: 13, padding: 2 }}>{pedestrianLabel(o)}</Text>
      </View>;
    })}
  </View>;
}
