import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { Text } from './ScaledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermission } from '../platform/cameraPermission';
import { controller } from '../state/controller';
import { useStore } from '../state/store';
import { GuideScreen } from './GuideScreen';
import { JourneyScreen } from './JourneyScreen';
import { PracticeScreen } from './PracticeScreen';
import { SettingsScreen } from './SettingsScreen';
import { Colors, useType } from './theme';

type Panel = 'settings' | 'guide' | 'practice' | null;
export function CrossWiseApp() {
  const type = useType();
  const loaded = useStore(controller.settingsLoaded);
  const notice = useStore(controller.notice);
  const permission = useCameraPermission();
  const [panel, setPanel] = useState<Panel>(null);
  const presentation = useStore(controller.presentation);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel) { setPanel(panel === 'settings' ? null : 'settings'); return true; }
      if (presentation.mapOpen) { controller.closeMap(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [panel, presentation.mapOpen]);
  const replayingHistory = useRef(false);
  useEffect(() => {
    const restore = (event: PopStateEvent) => {
      const route = event.state?.crosswise;
      replayingHistory.current = true;
      setPanel(route?.panel ?? null);
      controller.presentation.set({mapOpen: !!route?.mapOpen, expanded: !!route?.expanded});
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const initialHistory = useRef(true);
  useEffect(() => {
    const state = {crosswise: {panel, ...presentation}};
    if (initialHistory.current) { history.replaceState(state, ''); initialHistory.current = false; }
    else if (!replayingHistory.current) history.pushState(state, '');
    replayingHistory.current = false;
  }, [panel, presentation.mapOpen, presentation.expanded]);
  const close = useCallback(() => history.back(), []);
  const requestedCamera = useRef(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  useEffect(() => {
    if (!loaded || requestedCamera.current) return;
    requestedCamera.current = true;
    void (async () => {
      try { if (!permission.hasPermission && permission.canRequestPermission) await permission.requestPermission(); }
      catch { /* The camera panel keeps its permission/retry control; route entry remains available. */ }
      finally { setPermissionsReady(true); }
    })();
  }, [loaded, permission]);
  useEffect(() => {
    controller.setHomeVisible(loaded && permissionsReady && panel === null);
    return () => controller.setHomeVisible(false);
  }, [loaded, permissionsReady, panel]);
  useEffect(() => {
    if (!notice) return;
    // Spoken failures/confirmations use the feedback coordinator once; visual notices stay quiet.
    const timer = setTimeout(() => controller.clearNotice(), 4_000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!loaded) return <SafeAreaView style={styles.root}><Text style={[type.bodyMedium, { padding: 24 }]}>Starting CrossWise…</Text></SafeAreaView>;
  return <SafeAreaView style={styles.root}>
    <View style={{ flex: 1 }}>
      <JourneyScreen onSettings={() => setPanel('settings')}
        hidden={panel !== null} {...permission} />
      {panel && <View style={[StyleSheet.absoluteFill, styles.root]} accessibilityViewIsModal>
        {panel === 'settings' && <SettingsScreen onBack={close} onOpenGuide={() => setPanel('guide')} onOpenPractice={() => setPanel('practice')} />}
        {panel === 'guide' && <GuideScreen onBack={() => history.back()} />}
        {panel === 'practice' && <PracticeScreen onBack={() => history.back()} />}
      </View>}
    </View>
    {notice && <Text style={[type.bodyMedium, { padding: 12, backgroundColor: Colors.Crossing }]}>{notice}</Text>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.Background } });
