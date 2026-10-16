import { PRESENTER_TOOLS } from '../product/demoScope';
import { useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '../platform/icons';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { focusElement } from '../product/focus';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './ScaledText';
import { AssistMode, UserCommand } from '../crossing/crossingEngine';
import { WALKING_WARNING } from '../nav/navigation';
import { InterfaceMode } from '../settings/settings';
import { controller } from '../state/controller';
import { useStore } from '../state/store';
import { S } from '../strings';
import { BigButton, IconPill, TextButton } from './components';
import { MainScreen } from './MainScreen';
import { MapPanel } from './MapPanel';
import { Colors, useType } from './theme';
import { VoiceControl, VoiceStatus } from './VoiceControl';

/** Two views; neither map interaction nor the keyboard resizes the camera. */
export function JourneyScreen({ onSettings, onOpenRouteGuidance, hidden, hasPermission, canRequestPermission, requestPermission }: {
  onSettings: () => void; hidden: boolean;
  onOpenRouteGuidance: (placeId?: string) => void;
  hasPermission: boolean; canRequestPermission: boolean; requestPermission: () => unknown;
}) {
  const type = useType();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useStore(controller.settings);
  const journey = useStore(controller.journey.state);
  const { mapOpen, expanded } = useStore(controller.presentation);
  const planner = useStore(controller.planner.state);
  const setMapOpen = (value: boolean) => { if (value) controller.openMap(); else controller.closeMap(); };
  const setExpanded = (value: boolean) => controller.presentation.update(s => ({ ...s, expanded: value }));
  const [height, setHeight] = useState(window.height - 90);
  const [headerHeight, setHeaderHeight] = useState(52);
  const [dockHeight, setDockHeight] = useState(114);
  const [keyboard, setKeyboard] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(200);
  const active = journey.phase === 'walking' || journey.phase === 'paused';
  const available = Math.max(120, height - keyboard - 56);
  const requestedHeight = Math.min(available, expanded || keyboard ? height * 0.76 : Math.max(190, height * 0.3));
  const previousMapOpen = useRef(mapOpen);
  useEffect(() => {
    const changed = previousMapOpen.current !== mapOpen;
    previousMapOpen.current = mapOpen;
    if (hidden || !changed) return;
    const frame = requestAnimationFrame(() => focusElement(document.querySelector<HTMLElement>(mapOpen
      ? '[data-testid="walking-map-title"]' : '[data-testid="show-walking-map"]')));
    return () => cancelAnimationFrame(frame);
  }, [mapOpen, hidden]);
  const closeMap = () => { Keyboard.dismiss(); setMapOpen(false); };
  const openRouteGuidance = (placeId?: string) => { controller.stopVoice(); onOpenRouteGuidance(placeId); };
  const collapse = () => { Keyboard.dismiss(); setExpanded(false); };
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillChangeFrame', e => setKeyboard(Math.max(0, window.height - e.endCoordinates.screenY - insets.bottom)));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, [window.height, insets.bottom]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hidden || !mapOpen || document.querySelector('dialog[open]')) return false;
      if (keyboard || expanded) { if (keyboard) Keyboard.dismiss(); controller.presentation.update(s => ({ ...s, expanded: false })); }
      else controller.closeMap();
      return true;
    });
    return () => listener.remove();
  }, [mapOpen, hidden, keyboard, expanded]);
  return <View style={styles.root} onLayout={event => setHeight(event.nativeEvent.layout.height)}
    accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <MainScreen hasPermission={hasPermission} canRequestPermission={canRequestPermission} requestPermission={requestPermission}
      topInset={headerHeight} bottomInset={dockHeight} hidden={mapOpen || hidden} />
    <View style={[styles.header, mapOpen && { opacity: 0 }]} pointerEvents={mapOpen ? 'none' : 'auto'}
      accessibilityElementsHidden={mapOpen} importantForAccessibility={mapOpen ? 'no-hide-descendants' : 'auto'}
      onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
      <Text testID="walking-heading" style={[type.titleMedium, { flex: 1 }]} maxFontSizeMultiplier={1.3} accessibilityRole="header">
        {PRESENTER_TOOLS && settings.interfaceMode === InterfaceMode.DEVELOPER ? 'CrossWise · Developer' : 'CrossWise'}
      </Text>
      <VoiceControl onHelp={onSettings} />
      <IconPill icon="settings" label="Settings" onPress={onSettings} />
      </View>
      <VoiceStatus onHelp={onSettings} />
    </View>
    <View testID="full-map" style={[StyleSheet.absoluteFill, {backgroundColor:Colors.Background}, !mapOpen && { opacity: 0 }]}
      pointerEvents={mapOpen ? 'auto' : 'none'} accessibilityElementsHidden={!mapOpen}
      importantForAccessibility={mapOpen ? 'auto' : 'no-hide-descendants'} accessibilityViewIsModal={mapOpen}
      onAccessibilityEscape={closeMap}>
      <h2 data-testid="walking-map-title" className="cw-sr-only" tabIndex={-1}>Walking map and route</h2>
      <MapPanel height={height} fullScreen toolsHidden={expanded || keyboard > 0} bottomInset={sheetHeight + keyboard + 12} onInteract={() => { controller.stopVoice(); collapse(); }} preview={(!active || planner.replacing) ? planner : undefined}
        onCandidate={place => openRouteGuidance(place.id)}
        onPlaceId={id => openRouteGuidance(id)} />
      <View style={[styles.sheet, { height: requestedHeight, bottom: keyboard }]}
        onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}>
        <VoiceStatus onHelp={onSettings} />
        <Pressable style={styles.sheetHandle} accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse walking panel' : 'Expand walking panel'}
          accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); }}>
          <MaterialIcons name={expanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'} size={26} color={Colors.Accent} />
        </Pressable>
        <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
          <RouteSummary onDestination={() => openRouteGuidance()} />
          <JourneyControls stacked={window.fontScale > 1.3} />
          {active && <TextButton label="Change destination" onPress={() => openRouteGuidance()} />}
        </ScrollView>
      </View>
      <View style={[styles.exitMap, { bottom: sheetHeight + keyboard + 12 }]}>
        <VoiceControl onHelp={onSettings} />
        <IconPill icon="fullscreen-exit" label="Close full-screen map" onPress={closeMap} />
      </View>
    </View>
    <View style={[styles.dock, mapOpen && { opacity: 0 }]} pointerEvents={mapOpen ? 'none' : 'auto'}
      accessibilityElementsHidden={mapOpen} importantForAccessibility={mapOpen ? 'no-hide-descendants' : 'auto'}
      onLayout={event => setDockHeight(event.nativeEvent.layout.height)}>
      <ScrollView style={{ maxHeight: height * 0.3 }}>{active && <RouteSummary onDestination={() => openRouteGuidance()} />}<JourneyControls stacked={window.fontScale > 1.3} compact={PRESENTER_TOOLS && settings.interfaceMode === InterfaceMode.USER} /></ScrollView>
      <Pressable testID="show-walking-map" accessibilityRole="button" accessibilityLabel="Show map" accessibilityState={{ expanded: mapOpen }}
        onPress={() => setMapOpen(true)} style={styles.mapToggle}>
        <MaterialIcons name="keyboard-arrow-up" size={28} color={Colors.OnSurface} />
      </Pressable>
    </View>
  </View>;
}

export function RouteSummary({ onDestination }: { onDestination: () => void }) {
  const type = useType();
  const s = useStore(controller.journey.state);
  const route = s.route;
  const active = s.phase === 'walking' || s.phase === 'paused';
  return <View style={styles.summary}>
    {active && route ? <>
      <Text style={type.labelLarge} accessibilityRole="header" aria-live="polite" aria-atomic={true}>{s.phase === 'paused' ? 'JOURNEY PAUSED' : s.crossing ? 'CROSSING HELP' : `ROUTE · ${s.stepIndex + 1} OF ${route.steps.length}`}</Text>
      <Text style={type.bodyMedium}>To {route.destination}</Text>
      {s.crossing ? <>
        <Text style={type.titleMedium}>Route speech is paused.</Text>
        <Text style={type.bodyMedium}>{S.crossingFinishHint}</Text>
        {s.phase === 'paused' && <Text style={type.bodyMedium}>The crossing is unfinished. Confirm the far footpath before resuming the route.</Text>}
      </> : s.phase === 'paused' ? <Text style={type.bodyLarge}>Guidance is paused. Check your position before resuming.</Text> : <>
        <Text style={type.titleLarge}>{route.steps[s.stepIndex].instruction}</Text>
        <Text style={type.bodyMedium}>{s.remaining !== null ? `About ${s.remaining} metres remaining` :
          s.locationStatus === 'off-route' ? 'Away from this instruction. Check your position from the footpath.' : 'Location unreliable or stale — distance updates paused. Use Locate me on the map to check your position and accuracy.'}</Text>
        <TextButton label={s.stepIndex < route.steps.length - 1 ? 'I completed this instruction' : 'I am at my destination'}
          onPress={() => { if (s.stepIndex < route.steps.length - 1) controller.journey.next(s.stepIndex); else controller.finishJourney(s.stepIndex); }} />
      </>}
    </> : <>
      {s.phase === 'arrived' && <Text style={type.titleMedium}>Journey completed at {route?.destination}.</Text>}
      <BigButton text={route && s.phase !== 'arrived' ? 'Review destination' : 'Choose destination'} multiline
        color={Colors.Crossing} onPress={() => { if (s.phase === 'arrived') controller.journey.end(); onDestination(); }} />
    </>}
    {s.error && <Text style={[type.bodyMedium, { color: '#FFD87A' }]} accessibilityRole="alert">{s.error}</Text>}
    {route && <Text style={type.bodyMedium}>{WALKING_WARNING}</Text>}
  </View>;
}

/** These per-frame consumers are separate from the map and the rest of the journey layout. */
export function JourneyControls({ stacked, compact = false }: { stacked: boolean; compact?: boolean }) {
  const type = useType();
  const [expanded, setExpanded] = useState(false);
  const s = useStore(controller.journey.state);
  const { snapshot } = useStore(controller.ui);
  useStore(controller.pedestrian);
  const mode = snapshot.mode;
  const assistOn = mode !== AssistMode.IDLE;
  const paused = s.phase === 'paused';
  const active = s.phase === 'walking' || paused;
  const crossing = mode === AssistMode.CROSSING || (paused && s.crossing);
  const action = crossing ? 'finish' : s.phase === 'walking' && !s.crossing ? 'help' : 'start';
  const label = action === 'finish' ? 'I’m on the footpath' : action === 'help' ? 'Crossing help' : 'Start crossing';
  const button = (text: string, onPress: () => void, color = Colors.SurfaceVariant, enabled = true) =>
    <BigButton text={text} onPress={onPress} multiline color={color} enabled={enabled} style={stacked ? undefined : { flex: 1 }} />;

  if (compact && !expanded) return <View style={styles.footer}>
    {crossing && button(label, () => controller.crossingAction(action), Colors.Crossing, !s.busy)}
    <TextButton label="More controls" onPress={() => setExpanded(true)} />
  </View>;

  return <View style={styles.footer}>
    {compact && <TextButton label="Hide controls" onPress={() => setExpanded(false)} />}
    {!crossing && (assistOn || active) && <TextButton label="Already in the road — get assistance" onPress={() => controller.reportAlreadyCrossing()} />}
    {s.busy === 'starting' && <Text style={type.bodyMedium}>Checking location…</Text>}
    <View style={[styles.controls, stacked && { flexDirection: 'column', alignItems: 'stretch' }]}>
      {(!paused || s.crossing) && (assistOn || active) && button(label, () => controller.crossingAction(action), Colors.Crossing, !s.busy && (assistOn || action === 'finish') && (action !== 'start' || !controller.crossingDecision.blocked))}
      {(assistOn || active) && button('Repeat', () => controller.repeatGuidance(), Colors.SurfaceVariant, assistOn || s.phase === 'walking')}
      {s.phase === 'walking' && button('Pause', () => controller.pauseJourney())}
      {paused && !s.crossing && button('Resume', () => { void controller.startJourney(); }, Colors.Crossing, !s.busy)}
      {paused && button('End journey', () => controller.stopNavigation(), Colors.DontWalk)}
      {!active && button(assistOn ? 'Stop assistance' : 'Start camera assistance',
        () => controller.command(assistOn ? UserCommand.STOP_ASSIST : UserCommand.START_ASSIST, true), assistOn ? Colors.DontWalk : Colors.Crossing)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.Background, overflow: 'hidden' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, backgroundColor: Colors.Glass },
  sheet: { position: 'absolute', left: 0, right: 0, backgroundColor: Colors.Surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHandle: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  exitMap: { position: 'absolute', right: 12 },
  dock: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.Glass },
  mapToggle: { alignSelf: 'center', minWidth: 72, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  footer: { backgroundColor: Colors.Glass, padding: 10, borderTopWidth: 1, borderTopColor: Colors.Hairline, gap: 6 },
  controls: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
});
