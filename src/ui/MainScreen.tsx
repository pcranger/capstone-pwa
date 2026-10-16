import { PedestrianOverlay, pedestrianLabel } from './PedestrianOverlay';
import { pedestrianStatus, PEDESTRIAN_MAX_AGE_MS } from '../perception/pedestrianPolicy';
import { useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '../platform/icons';
import { CameraIndicators } from './CameraIndicators';
import { PedestrianIndicatorTracker } from '../perception/pedestrianIndicator';
import { perceptionMessage } from '../perception/pipelineHealth';
import { nowMs } from '../core/geometry';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from './ScaledText';
import { CameraSurface } from '../camera/CameraSurface';
import { AssistMode } from '../crossing/crossingEngine';
import { Side } from '../crossing/hazardMonitor';
import { SignalPhase } from '../signal/signalPhaseTracker';
import { InterfaceMode } from '../settings/settings';
import { controller } from '../state/controller';
import { useStore } from '../state/store';
import { S } from '../strings';
import { TextButton } from './components';
import { DetectionOverlay } from './Overlays';
import { Colors, useType } from './theme';

/** One full-screen camera surface. UI overlays never resize the camera or its box coordinate space. */
export function MainScreen({ height, topInset = 0, bottomInset = 0, hidden = false, hasPermission, canRequestPermission, requestPermission }: {
  height?: number; topInset?: number; bottomInset?: number; hidden?: boolean; hasPermission: boolean; canRequestPermission: boolean; requestPermission: () => unknown;
}) {
  const type = useType();
  const window = useWindowDimensions();
  const settings = useStore(controller.settings);
  const ui = useStore(controller.ui);
  const pedestrian = useStore(controller.pedestrian);
  const model = useStore(controller.model);
  const camera = useStore(controller.cameraStatus);
  const pipeline=useStore(controller.pipeline);
  const journey = useStore(controller.journey.state);
  const [attempt, setAttempt] = useState(0);
  const indicator = useRef(new PedestrianIndicatorTracker());
  const [description, setDescription] = useState('');
  const [, tick] = useState(0);
  const lastTap = useRef(0);
  const onCameraTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 420) {
      lastTap.current = 0;
      controller.toggleVoiceFromGesture();
    } else lastTap.current = now;
  };
  useEffect(() => { const timer = setInterval(() => tick(v => v + 1), 1_000); return () => clearInterval(timer); }, []);
  const developer = settings.interfaceMode === InterfaceMode.DEVELOPER;
  const assistOn = ui.snapshot.mode !== AssistMode.IDLE;
  const fresh = camera === 'running' && controller.hasRecentFrame;
  const routeOnly = journey.phase === 'walking' && !journey.crossing;
  const signal = ui.snapshot.signal;
  const hazard = fresh ? ui.snapshot.hazards[0] : null;
  const signalIndicator = indicator.current.update(pedestrian, nowMs(), fresh);
  const pedestrianFresh = fresh && nowMs() - pedestrian.timestampMs <= PEDESTRIAN_MAX_AGE_MS;
  let status = !assistOn ? '' : routeOnly ? 'Watching nearby traffic.' : 'No pedestrian signal verified.';
  if (assistOn && !routeOnly && fresh && signal.phase !== SignalPhase.UNKNOWN) {
    status = !signal.trusted ? 'Signal colour is unverified.' : {
      [SignalPhase.UNKNOWN]: 'No pedestrian signal verified.',
      [SignalPhase.WALK]: signal.freshWalk ? 'Walk signal just appeared.' : 'Walk signal observed; start time unknown.',
      [SignalPhase.WALK_FLASHING]: 'Walk signal is flashing.',
      [SignalPhase.DONT_WALK]: 'Don’t-walk signal observed.',
      [SignalPhase.DONT_WALK_FLASHING]: 'Don’t-walk signal is flashing.',
    }[signal.phase];
  }
  if (assistOn && !routeOnly) status = pedestrianStatus(pedestrian, nowMs(), ui.snapshot.mode === AssistMode.CROSSING);
  if (hazard && assistOn) status = S.hazardBanner(hazard.side === Side.LEFT ? S.sideLeft : hazard.side === Side.RIGHT ? S.sideRight : S.sideAhead);
  let unavailable: string | null = null;
  if (!hasPermission) unavailable = 'Camera permission needed.';
  else if (model.kind !== 'ready') unavailable = model.kind === 'loading' ? 'Loading detection…' : 'Detection unavailable. Open Help to check camera permissions and try again.';
  else if (camera !== 'running' || !fresh) unavailable = perceptionMessage(camera,fresh,pipeline,nowMs());
  else if (assistOn && ui.frameBrightness < 0.04) unavailable = 'Camera blocked or too dark. Check the lens.';
  else if (assistOn && ui.frameBrightness < 0.12) unavailable = 'Too dark. Improve the camera view.';
  const pitch = ui.snapshot.pitchDeg;
  const posture = fresh && assistOn && pitch !== null ? pitch < -35 ? 'Raise phone. Point the camera ahead.' : pitch > 50 ? 'Lower phone. Point the camera ahead.' : null : null;
  const message = unavailable ?? (hazard && assistOn ? status : posture ?? status);
  const icon = unavailable ? 'videocam-off' : hazard && assistOn ? 'warning' : posture ? 'screen-rotation' : assistOn ? 'visibility' : 'pause-circle-outline';
  const describe = () => {
    const side = (x: number) => x < 0.38 ? 'left' : x > 0.62 ? 'right' : 'centre';
    const observations = pedestrianFresh ? pedestrian.observations.map(o => `${pedestrianLabel(o)}, ${side(o.box.centerX)} of the camera image.`) : [];
    const objects = fresh ? ui.snapshot.tracks.map(t => `${t.category.toLowerCase().replaceAll('_', ' ')}, ${side(t.box.centerX)} of the camera image.`) : [];
    setDescription(`Camera snapshot at ${new Date().toLocaleTimeString()}. ${message} ${fresh ? [...observations, ...objects].join(' ') || 'No supported objects identified in this snapshot.' : 'No current image observations are available.'} Image position is not a distance or a clear-path assessment.`);
  };

  return <View style={[styles.panel, height === undefined ? StyleSheet.absoluteFill : { height }]}
    pointerEvents="box-none" accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <View style={StyleSheet.absoluteFill} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {hasPermission && <CameraSurface key={attempt} showPreview={settings.showPreview} active={!hidden} resizeMode="cover" style={StyleSheet.absoluteFill} />}
      {pedestrianFresh && settings.showPreview && <PedestrianOverlay scene={pedestrian} frameAspect={ui.frameAspect} />}
      {developer && fresh && settings.showPreview && settings.showOverlay &&
        <DetectionOverlay carsOnly snapshot={ui.snapshot} frameAspect={ui.frameAspect} resizeMode="cover" visibility={settings} />}
    </View>
    <Pressable accessible={false} pointerEvents="box-only" style={StyleSheet.absoluteFill} onPress={onCameraTap} />
    <div className="cw-camera-toolbar" style={{top:topInset+8}}>
      <button className="cw-camera-icon-button" aria-label="Describe camera view" aria-expanded={!!description} onClick={describe}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg>
      </button>
      {developer && <CameraIndicators tracks={ui.snapshot.tracks} fresh={fresh} signal={signalIndicator}/>}
    </div>
    {(message || description || !settings.showPreview || pedestrian.error) && <ScrollView testID="camera-notification" style={[styles.status, { top: topInset + 60, maxHeight: Math.max(80, Math.min(120, window.height - topInset - bottomInset - 160)) }]}
      contentContainerStyle={{ padding: 8, gap: 6 }}>
      {!!message && <View accessible accessibilityLabel={message} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MaterialIcons name={icon} size={18} color={unavailable || posture || hazard ? '#FFD87A' : '#80DEEA'} />
        <Text aria-live="polite" aria-atomic={true} style={[type.labelMedium, { flex: 1 }, (unavailable || posture) && { color: '#FFD87A' }]}>{message}</Text>
      </View>}
      {ui.snapshot.mode === AssistMode.CROSSING && !['walking', 'paused'].includes(journey.phase) &&
        <Text style={type.bodyMedium}>{S.crossingFinishHint}</Text>}
      {!settings.showPreview && <Text style={type.bodyMedium}>Preview hidden.</Text>}
      {!hasPermission && <TextButton label={canRequestPermission ? 'Allow camera' : 'Open app settings'}
        onPress={() => { if (canRequestPermission) void requestPermission(); else void Linking.openSettings(); }} />}
      {hasPermission && camera === 'unavailable' &&
        <TextButton label="Retry camera" onPress={() => setAttempt(a => a + 1)} />}
      {pedestrian.error && camera === 'running' && <TextButton label="Retry pedestrian detection" onPress={() => controller.retryPedestrianDetection()} />}
      {!!description && <>
        <button className="cw-camera-dismiss" aria-label="Dismiss camera description" onClick={()=>setDescription('')}>×</button>
        <Text aria-live="polite" aria-atomic={true} style={type.labelMedium}>{description}</Text>
      </>}
      {!developer && journey.phase === 'walking' && journey.route && <Text style={type.bodyMedium}>
        {journey.crossing ? 'Crossing assistance' : journey.route.steps[journey.stepIndex]?.instruction}
      </Text>}


    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#000' },
  status: { position: 'absolute', left: 12, right: 12, backgroundColor: Colors.Glass, borderRadius: 12 },
});
