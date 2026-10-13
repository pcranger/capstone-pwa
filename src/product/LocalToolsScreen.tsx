import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Page, Action, ConfirmDialog, useProductBack } from './ProductPage';
import { useStore } from '../state/store';
import { controller } from '../state/controller';
import { searchPlaces, usableFix, type GeoPoint, type LocationFix, type PlaceCandidate } from '../nav/navigation';
import { services } from '../config/services';
import { localToolsRepository, localId, duplicateRoute, parseLocalToolsFile, routeLength, validateWaypoint, validateRoute,
  type AuthoredRoute, type AuthoredWaypoint, type AreaPack, type LocalToolsData } from './local/routes';
import { recorderSettings, saveRecorderSettings, reloadRecorderSettings, DEFAULT_RECORDER_SETTINGS, walkingRecorder, recordingMime, validateRecorderSettings, type RecorderSettings } from './local/recorder';
import { recordingStorage, type RecordingMeta } from './local/recordingStore';
import { combinedLocalBackup, mergedLocalTools } from './local/dataPackage';
import { validateBackup } from './local/backup';

type CoordinatePlace = GeoPoint & { name: string };
export interface LocalToolsScreenProps {
  tool: 'routes' | 'recordings' | 'data' | 'areas'; onBack: () => void;
  onNavigateCoordinate?: (point: GeoPoint, name: string) => void;
  onStartAuthoredRoute?: (route: AuthoredRoute) => void | Promise<void>;
  availablePlaces?: CoordinatePlace[];
  extraExport?: () => unknown; onExtraImport?: (value: unknown) => void | Promise<void>; onExtraReset?: () => void | Promise<void>;
  dataMutationBlocked?: boolean;
}
const inputStyle: CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, margin: '8px 0 16px', borderRadius: 8, border: '1px solid #90bed9', background: '#101d29', color: '#fff', font: 'inherit', minHeight: 48 };
const cardStyle: CSSProperties = { padding: '16px 0', borderBottom: '1px solid #4c6376' };
const actionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 };
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <div style={{ marginTop: 12 }}><label htmlFor={id}>{label}</label>{isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}</div>;
}
function Message({ children, error = false }: { children: ReactNode; error?: boolean }) { return <p role={error ? 'alert' : 'status'} style={{ color: error ? '#ffb4ab' : '#bce5ff', overflowWrap: 'anywhere' }}>{children}</p>; }
function Bytes({ value }: { value: number }) { return <>{value >= 1e9 ? `${(value / 1e9).toFixed(2)} GB` : `${(value / 1e6).toFixed(1)} MB`}</>; }
const seconds = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function jsonDownload(value: unknown, filename: string): void { download(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), filename); }
const fileName = (name: string): string => name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 70) || 'crosswise';
const clipName = (meta: RecordingMeta): string => `CrossWise_${new Date(meta.startedAt).toISOString().replace(/[:.]/g, '-')}.${meta.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
function currentLocation(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable. Enter coordinates instead.')); return; }
    navigator.geolocation.getCurrentPosition(p => {
      const fix = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp };
      if (!usableFix(fix, Date.now())) { reject(new Error('A fresh location accurate to 25 metres is needed. Retry in an open area or enter the point manually.')); return; }
      resolve(fix);
    }, () => reject(new Error('Could not get your location. Check location permission or enter coordinates.')), { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
  });
}

export function LocalToolsScreen(props: LocalToolsScreenProps) {
  useEffect(() => { localToolsRepository.load(); }, []);
  const state = useStore(localToolsRepository.state);
  if (state.status !== 'ready') return <Page title="Local tools" onBack={props.onBack}>
    <Message error={state.status === 'error'}>{state.error ?? 'Loading local data…'}</Message>
    <Action onClick={() => localToolsRepository.load()}>Retry loading</Action>
    {state.status === 'error' && <Action secondary onClick={() => jsonDownload({ originalData: localToolsRepository.originalExport() }, 'CrossWise_recovery.json')}>Export original data</Action>}
  </Page>;
  if (props.tool === 'routes') return <RoutesScreen {...props} />;
  if (props.tool === 'recordings') return <RecordingsScreen onBack={props.onBack} />;
  if (props.tool === 'areas') return <AreasScreen {...props} />;
  return <DataScreen {...props} />;
}

function RoutesScreen(props: LocalToolsScreenProps) {
  const { data } = useStore(localToolsRepository.state);
  const [page, setPage] = useState<'list' | 'editor' | 'preview' | 'follow' | 'import'>('list');
  const [selected, setSelected] = useState<AuthoredRoute | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const run = (action: () => void) => { try { action(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.'); } };
  const back = () => { setPage('list'); setSelected(null); setConfirm(false); setError(''); };
  useProductBack(page === 'preview', back);
  const newRoute = () => { setSelected({ id: localId(), name: '', waypoints: [], updatedAt: Date.now() }); setPage('editor'); };
  if (page === 'editor' && selected) return <RouteEditor route={selected} onBack={back} availablePlaces={props.availablePlaces}
    onSave={route => { localToolsRepository.saveRoute(route); setSelected(route); setNotice('My Route saved.'); setPage('preview'); }} />;
  if (page === 'follow' && selected) return <AuthoredFollower route={selected} onBack={() => setPage('preview')} />;
  if (page === 'import') return <ImportPage onBack={back} onImported={() => { setNotice('Route data imported.'); back(); }} />;
  if (page === 'preview' && selected) return <Page title="Route preview" onBack={back}>
    <h2>{selected.name}</h2><p>{selected.waypoints.length} waypoints · {(routeLength(selected) / 1000).toFixed(2)} km straight-line segment length.</p>
    <p>This is a user-authored path. Coordinates and notes do not establish a walkable connection, safe crossing, entrance access or absence of stairs. Review the route with someone familiar with the area.</p>
    <ol>{selected.waypoints.map(point => <li key={point.id} style={cardStyle}><strong>{point.label}</strong><p>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</p>{point.note && <p>Spoken note: {point.note}</p>}</li>)}</ol>
    {notice && <Message>{notice}</Message>}{error && <Message error>{error}</Message>}
    <div style={actionsStyle}><Action onClick={() => { setError(''); if (props.onStartAuthoredRoute) void Promise.resolve(props.onStartAuthoredRoute(structuredClone(selected))).catch(e => setError(e instanceof Error ? e.message : 'Route could not start.')); else setPage('follow'); }}>Start My Route</Action>
      <Action secondary onClick={() => setPage('editor')}>Edit My Route</Action>
      <Action secondary onClick={() => { setSelected(duplicateRoute(selected)); setPage('editor'); }}>Duplicate route</Action>
      <Action secondary onClick={() => { setSelected(duplicateRoute(selected, true)); setNotice('Review reversed point order. Directional notes have been cleared because they may be wrong in reverse.'); setPage('editor'); }}>Reverse into new draft</Action>
      <Action secondary onClick={() => jsonDownload({ version: 1, routes: [selected], areas: [] }, `${fileName(selected.name)}.json`)}>Export route</Action>
      <Action danger onClick={() => setConfirm(true)}>Delete route</Action></div>
    {confirm && <ConfirmDialog title="Delete route?" danger confirmLabel="Confirm delete route" onCancel={() => setConfirm(false)} onConfirm={() => run(() => { localToolsRepository.removeRoute(selected.id); setNotice('Route deleted.'); back(); })}><p>Delete “{selected.name}”? Saved places and any active journey remain separate.</p></ConfirmDialog>}
  </Page>;
  return <Page title="My Routes" onBack={props.onBack}>
    <p>Create reusable walks using your own ordered points and spoken notes. Routes stay on this device until you export them.</p>
    <div style={actionsStyle}><Action onClick={newRoute}>Create My Route</Action><Action secondary onClick={() => setPage('import')}>Import routes</Action></div>
    {notice && <Message>{notice}</Message>}{error && <Message error>{error}</Message>}
    {!data.routes.length && <p>No My Routes yet. Create a route with at least two distinct locations.</p>}
    {data.routes.map(route => <article key={route.id} style={cardStyle}><h2>{route.name}</h2><p>{route.waypoints[0].label} to {route.waypoints.at(-1)!.label} · {route.waypoints.length} points</p>
      <Action onClick={() => { setSelected(structuredClone(route)); setPage('preview'); setNotice(''); }}>Open {route.name}</Action></article>)}
  </Page>;
}

function RouteEditor({ route, onBack, onSave, availablePlaces = [] }: { route: AuthoredRoute; onBack: () => void; onSave: (route: AuthoredRoute) => void; availablePlaces?: CoordinatePlace[] }) {
  const [draft, setDraft] = useState(() => structuredClone(route));
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [discard, setDiscard] = useState(false);
  const [editing, setEditing] = useState<AuthoredWaypoint | null>(null); const [adding, setAdding] = useState(false);
  const [undo, setUndo] = useState<AuthoredWaypoint[] | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(route);
  const leave = () => dirty ? setDiscard(true) : onBack();
  useProductBack(!adding && !editing, leave);
  const changePoints = (points: AuthoredWaypoint[]) => { setUndo(draft.waypoints); setDraft(d => ({ ...d, waypoints: points })); };
  const save = () => { try { const valid = validateRoute({ ...draft, updatedAt: Date.now() }); onSave(valid); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save route.'); } };
  if (adding || editing) return <WaypointEditor point={editing} availablePlaces={availablePlaces} onBack={() => { setAdding(false); setEditing(null); }} onSave={point => {
    changePoints(editing ? draft.waypoints.map(p => p.id === point.id ? point : p) : [...draft.waypoints, point]); setAdding(false); setEditing(null); setNotice('Waypoint added or updated. Save the route to keep changes.');
  }} />;
  return <Page title="Edit My Route" onBack={leave}>
    <Field label="Route name"><input style={inputStyle} value={draft.name} maxLength={160} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></Field>
    <p>Place points in walking order. Use entrances and known pedestrian paths. This editor does not generate a verified walking path.</p>
    {error && <Message error>{error}</Message>}{notice && <Message>{notice}</Message>}
    <ol>{draft.waypoints.map((point, index) => <li key={point.id} style={cardStyle}><strong>{point.label}</strong><p>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</p><p>{point.note}</p>
      <div style={actionsStyle}><Action secondary onClick={() => setEditing(point)}>Edit {point.label}</Action>
        <Action secondary disabled={index === 0} onClick={() => { const points = [...draft.waypoints]; [points[index - 1], points[index]] = [points[index], points[index - 1]]; changePoints(points); }}>Move {point.label} up</Action>
        <Action secondary disabled={index === draft.waypoints.length - 1} onClick={() => { const points = [...draft.waypoints]; [points[index], points[index + 1]] = [points[index + 1], points[index]]; changePoints(points); }}>Move {point.label} down</Action>
        <Action danger onClick={() => changePoints(draft.waypoints.filter(p => p.id !== point.id))}>Remove {point.label}</Action></div></li>)}</ol>
    <div style={actionsStyle}><Action disabled={draft.waypoints.length >= 100} onClick={() => setAdding(true)}>Add waypoint</Action>
      {undo && <Action secondary onClick={() => { setDraft(d => ({ ...d, waypoints: undo })); setUndo(null); }}>Undo waypoint change</Action>}
      <Action onClick={save}>Save My Route</Action><Action secondary onClick={leave}>Cancel editing</Action></div>
    {discard && <ConfirmDialog title="Discard route changes?" danger confirmLabel="Discard changes" onConfirm={onBack} onCancel={() => setDiscard(false)}><p>Unsaved route changes will be lost.</p></ConfirmDialog>}
  </Page>;
}

function WaypointEditor({ point, onBack, onSave, availablePlaces = [] }: { point: AuthoredWaypoint | null; onBack: () => void; onSave: (point: AuthoredWaypoint) => void; availablePlaces?: CoordinatePlace[] }) {
  const [label, setLabel] = useState(point?.label ?? ''); const [latitude, setLatitude] = useState(point ? String(point.latitude) : '');
  const [longitude, setLongitude] = useState(point ? String(point.longitude) : ''); const [note, setNote] = useState(point?.note ?? '');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty = label !== (point?.label ?? '') || latitude !== (point ? String(point.latitude) : '') || longitude !== (point ? String(point.longitude) : '') || note !== (point?.note ?? '');
  const leave = () => dirty ? setDiscard(true) : onBack();
  useProductBack(true, leave);
  const [query, setQuery] = useState(''); const [results, setResults] = useState<PlaceCandidate[]>([]);
  const abort = useRef<AbortController | null>(null); const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; abort.current?.abort(); }, []);
  const pick = (p: GeoPoint & { name?: string }) => { setLatitude(p.latitude.toFixed(6)); setLongitude(p.longitude.toFixed(6)); if (p.name) setLabel(p.name); setNotice('Coordinate chosen. Review the point and name before saving.'); setResults([]); };
  const locate = async () => { setBusy(true); setError(''); try { const fix = await currentLocation(); if (mounted.current) { pick(fix); setNotice(`Current location chosen. Reported accuracy ${Math.round(fix.accuracy!)} metres.`); } } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Location unavailable.'); } finally { if (mounted.current) setBusy(false); } };
  const search = async () => {
    if (!query.trim()) { setError('Enter a place name or address.'); return; }
    abort.current?.abort(); const request = new AbortController(); abort.current = request; setBusy(true); setError('');
    try { const places = await searchPlaces(query, null, services.mapsRestApiKey, request.signal); if (mounted.current && !request.signal.aborted) setResults(places); }
    catch (e) { if (mounted.current && !request.signal.aborted) setError(e instanceof Error ? e.message : 'Search unavailable.'); }
    finally { if (mounted.current && !request.signal.aborted) setBusy(false); }
  };
  const save = () => { try {
    if (!latitude.trim() || !longitude.trim()) throw new Error('Enter both latitude and longitude.');
    onSave(validateWaypoint({ id: point?.id ?? localId(), label, latitude: Number(latitude), longitude: Number(longitude), note }));
  } catch (e) { setError(e instanceof Error ? e.message : 'Invalid waypoint.'); } };
  return <Page title={point ? 'Edit waypoint' : 'Add waypoint'} onBack={leave}>
    <Field label="Waypoint name"><input style={inputStyle} value={label} maxLength={160} onChange={e => setLabel(e.target.value)} /></Field>
    <Field label="Latitude"><input style={inputStyle} inputMode="decimal" value={latitude} onChange={e => setLatitude(e.target.value)} /></Field>
    <Field label="Longitude"><input style={inputStyle} inputMode="decimal" value={longitude} onChange={e => setLongitude(e.target.value)} /></Field>
    <Field label="Spoken note (optional)"><textarea style={inputStyle} value={note} maxLength={1000} rows={3} onChange={e => setNote(e.target.value)} /></Field>
    <Action secondary disabled={busy} onClick={() => { void locate(); }}>Use current location for waypoint</Action>
    {!!availablePlaces.length && <Field label="Choose a saved place"><select style={inputStyle} defaultValue="" onChange={e => { const p = availablePlaces[Number(e.target.value)]; if (p) pick(p); }}>
      <option value="" disabled>Choose a saved place</option>{availablePlaces.map((p, i) => <option key={i} value={i}>{p.name}</option>)}</select></Field>}
    <Field label="Search a place or address"><input style={inputStyle} value={query} maxLength={240} onChange={e => setQuery(e.target.value)} /></Field>
    <Action secondary disabled={busy} onClick={() => { void search(); }}>Search waypoint</Action>
    {!!results.length && <section aria-label="Waypoint search results"><p>Google Maps</p>{results.map(p => <article key={p.id} style={cardStyle}><p>{p.name} · {p.address}</p><Action secondary onClick={() => pick({ ...p.point, name: p.name })}>Choose {p.name}</Action></article>)}</section>}
    {busy && <Message>Getting location or searching…</Message>}{notice && <Message>{notice}</Message>}{error && <Message error>{error}</Message>}
    <div style={actionsStyle}><Action onClick={save}>Save waypoint</Action><Action secondary onClick={leave}>Cancel waypoint</Action></div>
    {discard && <ConfirmDialog title="Discard waypoint changes?" danger confirmLabel="Discard waypoint changes" onConfirm={onBack} onCancel={() => setDiscard(false)}><p>Unsaved waypoint values will be lost.</p></ConfirmDialog>}
  </Page>;
}

function AuthoredFollower({ route, onBack }: { route: AuthoredRoute; onBack: () => void }) {
  const [index, setIndex] = useState(0); const [fix, setFix] = useState<LocationFix | null>(null); const [error, setError] = useState('');
  const [paused, setPaused] = useState(false); const [ready, setReady] = useState(false); const [complete, setComplete] = useState(false); const [clock, setClock] = useState(Date.now());
  useProductBack(true, onBack);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!navigator.geolocation || paused) return;
    const watch = navigator.geolocation.watchPosition(p => { setFix({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }); setError(''); }, () => { setFix(null); setError('Location unavailable. Progress is paused; retry location permission.'); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [paused]);
  const current = route.waypoints[index]; const fresh = !!fix && usableFix(fix, clock);
  const distance = fix ? routeLength({ ...route, waypoints: [{ id: 'fix', label: '', note: '', ...fix }, current] }) : null;
  const startDistance = fix ? routeLength({ ...route, waypoints: [{ id: 'fix', label: '', note: '', ...fix }, route.waypoints[0]] }) : null;
  return <Page title="Follow My Route" onBack={onBack}>
    <h2>{route.name}</h2><p>User-authored waypoints. Follow the actual pedestrian path; the direct coordinate bearing is not a safe path instruction.</p>
    {complete && <Message>My Route complete. You can stop or restart at the first waypoint.</Message>}
    {!ready ? <><p>Start near {route.waypoints[0].label}. {startDistance === null ? 'Getting location…' : `${Math.round(startDistance)} metres from first point.`}</p>
      <Action disabled={!fresh || (startDistance ?? Infinity) > 40} onClick={() => { setReady(true); setComplete(false); controller.sayNavigation(`My Route started. First point, ${current.label}. ${current.note}`); }}>Start at first waypoint</Action>
      {fresh && (startDistance ?? 0) > 40 && <Message error>Move within 40 metres of the first waypoint before starting.</Message>}</> : <>
        <p aria-live="polite">Waypoint {index + 1} of {route.waypoints.length}: {current.label}</p><p>{current.note}</p>
        <p>{fresh && distance !== null ? `${Math.round(distance)} metres in a straight line. Accuracy ${Math.round(fix!.accuracy!)} metres.` : 'Waiting for a fresh, accurate location.'}</p>
        <div style={actionsStyle}><Action secondary onClick={() => setPaused(v => !v)}>{paused ? 'Resume My Route' : 'Pause My Route'}</Action>
          <Action secondary onClick={() => controller.sayNavigation(`${current.label}. ${current.note}`)}>Read waypoint note</Action>
          <Action disabled={paused || !fresh || (distance ?? Infinity) > 25} onClick={() => {
            if (index < route.waypoints.length - 1) { const next = route.waypoints[index + 1]; setIndex(index + 1); controller.sayNavigation(`Waypoint reached. Next, ${next.label}. ${next.note}`); }
            else { controller.sayNavigation('My Route complete.'); setReady(false); setComplete(true); setIndex(0); }
          }}>{index === route.waypoints.length - 1 ? 'Finish My Route at this point' : 'Confirm waypoint reached'}</Action></div></>}
    {error && <Message error>{error}</Message>}<Action secondary onClick={onBack}>Stop My Route</Action>
  </Page>;
}

function RecordingsScreen({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState<'control' | 'settings' | 'library'>('control');
  const settings = useStore(recorderSettings); const state = useStore(walkingRecorder.state); const camera = useStore(controller.cameraStatus);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [discard, setDiscard] = useState(false);
  const preview = useRef<HTMLVideoElement>(null); const stream = controller.getCameraStream();
  useProductBack(page === 'settings', () => setPage('control'));
  useEffect(() => {
    const video = preview.current;
    if (video && stream) { video.srcObject = stream; void video.play().catch(() => undefined); }
    return () => { if (video) video.srcObject = null; };
  }, [stream, page]);
  const run = async (action: () => void | Promise<void>) => { setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Recording action failed.'); } };
  if (page === 'settings') return <RecorderSettingsPage onBack={() => setPage('control')} />;
  if (page === 'library') return <RecordingLibrary onBack={() => setPage('control')} />;
  const active = ['starting', 'recording', 'paused', 'finalizing'].includes(state.status);
  return <Page title="Walking recorder" onBack={onBack}>
    <p>Video stays on this device. Recording shares the Stroll camera. Leaving this menu keeps an active recording running; locking the device or hiding the app finalizes an interrupted clip.</p>
    {stream && <video ref={preview} autoPlay muted playsInline aria-label="Shared recording camera preview" style={{ width: '100%', maxHeight: '30vh', background: '#000' }} />}
    <p role="status">Recorder: {state.status}. Camera: {camera}. Elapsed {seconds(state.elapsedMs)}. {state.audio ? 'Microphone audio included.' : 'Silent video.'} {state.protected ? 'Current clip protected.' : ''}</p>
    <p>{state.clipsSaved} clips saved in this session · <Bytes value={state.bytesSaved} />. Format: {state.mimeType || (recordingMime() === null ? 'Unavailable' : recordingMime() || 'Browser default')}.</p>
    {(state.error || error) && <Message error>{error || state.error}</Message>}{notice && <Message>{notice}</Message>}
    <div style={actionsStyle}>
      {!controller.getCameraStream() && !active && <Action secondary onClick={() => { void run(async () => { await controller.requestCamera(); setNotice(controller.getCameraStream() ? 'Camera is ready for recording.' : 'Camera unavailable. Check camera permission.'); }); }}>Enable shared camera</Action>}
      <Action disabled={active || !settings.enabled || !!state.unsaved || recordingMime() === null} onClick={() => { void run(() => walkingRecorder.start(controller.getCameraStream())); }}>Start recording</Action>
      <Action secondary disabled={!['recording', 'paused'].includes(state.status)} onClick={() => state.status === 'paused' ? walkingRecorder.resume() : walkingRecorder.pause()}>{state.status === 'paused' ? 'Resume recording' : 'Pause recording'}</Action>
      <Action disabled={!active || state.status === 'finalizing'} onClick={() => { void run(async () => { await walkingRecorder.stop(); if (!walkingRecorder.state.value.unsaved) setNotice('Recording stopped. Finalized clips are in the library.'); }); }}>Stop and save recording</Action>
      <Action secondary disabled={!['recording', 'paused'].includes(state.status)} onClick={() => walkingRecorder.protectCurrent()}>{state.protected ? 'Unprotect current clip' : 'Protect current clip'}</Action>
      <Action secondary onClick={() => setPage('settings')}>Recorder settings</Action><Action secondary onClick={() => setPage('library')}>Recording library</Action></div>
    {!settings.enabled && <p>Enable recording in Recorder settings before starting.</p>}
    {recordingMime() === null && <Message>Video recording is unavailable in this browser. Saved recordings remain available in the library. Use a browser with MediaRecorder support to create clips.</Message>}
    {state.unsaved && <section style={cardStyle}><h2>Unsaved clip recovery</h2><p>This clip is held in memory and will be lost if the app closes. Export it or free storage and retry saving.</p>
      <div style={actionsStyle}><Action onClick={() => download(state.unsaved!.blob, clipName(state.unsaved!.meta))}>Export unsaved clip</Action>
        <Action secondary onClick={() => { void run(() => walkingRecorder.retryUnsaved()); }}>Retry saving clip</Action><Action danger onClick={() => setDiscard(true)}>Discard unsaved clip</Action></div>
      {discard && <ConfirmDialog title="Discard unsaved clip?" danger confirmLabel="Confirm discard clip" onConfirm={() => { walkingRecorder.discardUnsaved(); setDiscard(false); }} onCancel={() => setDiscard(false)}><p>The only unsaved copy will be lost.</p></ConfirmDialog>}
    </section>}
  </Page>;
}

function RecorderSettingsPage({ onBack }: { onBack: () => void }) {
  const settings = useStore(recorderSettings); const state = useStore(walkingRecorder.state); const [error, setError] = useState('');
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null); const [persisted, setPersisted] = useState<boolean | null>(null);
  const active = !['idle', 'error'].includes(state.status);
  useEffect(() => { void navigator.storage?.estimate?.().then(setEstimate).catch(() => undefined); void navigator.storage?.persisted?.().then(setPersisted).catch(() => undefined); }, []);
  const set = (change: Partial<RecorderSettings>) => { try { saveRecorderSettings({ ...settings, ...change }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Settings could not save.'); } };
  return <Page title="Recorder settings" onBack={onBack}>
    <p>Five-minute clips and 50 rolling clips match the reference behavior. The browser selects its supported MP4 or WebM format. Automatic retention removes the oldest unprotected clips only.</p>
    {active && <Message>Stop recording to change recorder settings. Route pause does not pause the recorder.</Message>}
    <Field label="Enable walking recorder"><input type="checkbox" checked={settings.enabled} disabled={active} onChange={e => set({ enabled: e.target.checked })} /></Field>
    <Field label="Auto-start with Stroll"><input type="checkbox" checked={settings.autoStart} disabled={active || !settings.enabled} onChange={e => set({ autoStart: e.target.checked })} /></Field>
    <Field label="Include microphone audio"><input type="checkbox" checked={settings.includeAudio} disabled={active} onChange={e => set({ includeAudio: e.target.checked })} /></Field>
    <Field label="Clip duration"><select style={inputStyle} value={settings.clipMinutes} disabled={active} onChange={e => set({ clipMinutes: Number(e.target.value) })}><option value={1}>1 minute</option><option value={3}>3 minutes</option><option value={5}>5 minutes</option></select></Field>
    <Field label="Maximum rolling clips"><select style={inputStyle} value={settings.maxClips} disabled={active} onChange={e => set({ maxClips: Number(e.target.value) })}>{[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>{n} clips</option>)}</select></Field>
    <Field label="Recording byte limit"><select style={inputStyle} value={settings.maxBytes} disabled={active} onChange={e => set({ maxBytes: Number(e.target.value) })}>{[100_000_000, 500_000_000, 1_000_000_000, 2_500_000_000, 5_000_000_000].map(n => <option key={n} value={n}>{n / 1e9} GB</option>)}</select></Field>
    <p>Actual format support: {recordingMime() === null ? 'No supported video recording API' : recordingMime() || 'Browser default format'}. Audio permission is requested only when you start with audio enabled. Denial leaves silent video.</p>
    <p>Device storage: {estimate ? <><Bytes value={estimate.usage ?? 0} /> used of <Bytes value={estimate.quota ?? 0} /> available browser quota.</> : 'Storage estimate unavailable.'}</p>
    <p>Persistent storage: {persisted === null ? 'Unknown' : persisted ? 'Granted' : 'Not granted; browser may remove local data under storage pressure.'}</p>
    <Action secondary disabled={!navigator.storage?.persist} onClick={() => { void navigator.storage?.persist?.().then(setPersisted).catch(() => setError('Persistent storage could not be requested.')); }}>Request persistent storage</Action>
    {error && <Message error>{error}</Message>}
  </Page>;
}

function RecordingLibrary({ onBack }: { onBack: () => void }) {
  const recorder = useStore(walkingRecorder.state); const [clips, setClips] = useState<RecordingMeta[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [selected, setSelected] = useState<string[]>([]);
  const [onlyProtected, setOnlyProtected] = useState(false); const [play, setPlay] = useState<RecordingMeta | null>(null); const [confirm, setConfirm] = useState<string[] | null>(null);
  const refresh = async () => { try { setClips(await recordingStorage.list()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Recording library unavailable.'); } finally { setLoading(false); } };
  useProductBack(true, () => { if (play) { setPlay(null); void refresh(); } else onBack(); });
  useEffect(() => { void refresh(); }, [recorder.clipsSaved]);
  const run = async (action: () => Promise<void>) => { try { await action(); setError(''); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Recording action failed.'); } };
  const exportClips = async (ids: string[]) => { for (const id of ids) {
    const clip = clips.find(c => c.id === id), blob = await recordingStorage.getBlob(id);
    if (!clip || !blob) throw new Error('A selected clip no longer exists. Refresh the library.');
    download(blob, clipName(clip));
  } setNotice('Download requested. Your browser may ask to allow multiple downloads.'); };
  if (play) return <PlaybackPage clip={play} onBack={() => { setPlay(null); void refresh(); }} />;
  const visible = clips.filter(c => !onlyProtected || c.protected);
  return <Page title="Recording library" onBack={onBack}>
    <p>{clips.length} clips · <Bytes value={clips.reduce((n, c) => n + c.bytes, 0)} />. Videos stay on this device; export important clips before clearing browser data.</p>
    <Field label="Show protected clips only"><input type="checkbox" checked={onlyProtected} onChange={e => setOnlyProtected(e.target.checked)} /></Field>
    <div style={actionsStyle}><Action secondary onClick={() => { void refresh(); }}>Refresh library</Action>
      <Action secondary disabled={!selected.length} onClick={() => { void run(() => exportClips(selected)); }}>Export selected clips</Action>
      <Action danger disabled={!selected.length} onClick={() => setConfirm(selected)}>Delete selected clips</Action>
      <Action danger disabled={!clips.length || !['idle', 'error'].includes(recorder.status)} onClick={() => setConfirm(clips.map(c => c.id))}>Delete all recordings</Action></div>
    {!['idle', 'error'].includes(recorder.status) && <p>Stop recording before deleting the entire library. You can export or delete selected finalized clips while recording.</p>}
    {loading && <Message>Loading recordings…</Message>}{error && <Message error>{error}</Message>}{notice && <Message>{notice}</Message>}
    {!loading && !visible.length && <p>{onlyProtected ? 'No protected clips.' : 'No saved recordings. Start a recording using the shared Stroll camera.'}</p>}
    {visible.map(clip => <article style={cardStyle} key={clip.id}>
      <Field label={`Select recording ${new Date(clip.startedAt).toLocaleString()}`}><input type="checkbox" checked={selected.includes(clip.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, clip.id] : ids.filter(id => id !== clip.id))} /></Field>
      <h2>{new Date(clip.startedAt).toLocaleString()}</h2><p>{seconds(clip.durationMs)} · <Bytes value={clip.bytes} /> · {clip.audio ? 'Audio' : 'Silent'}{clip.protected ? ' · Protected' : ''}{clip.interrupted ? ' · Interrupted session' : ''}</p>
      <div style={actionsStyle}><Action onClick={() => setPlay(clip)}>Play recording {new Date(clip.startedAt).toLocaleTimeString()}</Action>
        <Action secondary onClick={() => { void run(() => recordingStorage.protect(clip.id, !clip.protected)); }}>{clip.protected ? 'Unprotect' : 'Protect'} recording {new Date(clip.startedAt).toLocaleTimeString()}</Action>
        <Action secondary onClick={() => { void run(() => exportClips([clip.id])); }}>Export recording {new Date(clip.startedAt).toLocaleTimeString()}</Action></div>
    </article>)}
    {confirm && <ConfirmDialog title={`Delete ${confirm.length} recordings?`} danger confirmLabel="Confirm delete recordings" onCancel={() => setConfirm(null)} onConfirm={() => { void run(async () => { await recordingStorage.remove(confirm, true); setSelected([]); setConfirm(null); setNotice('Selected recordings deleted.'); }); }}><p>{clips.some(c => confirm.includes(c.id) && c.protected) ? 'This selection includes protected clips. They will also be permanently deleted.' : 'The selected local videos will be permanently deleted.'} Export them first if needed.</p></ConfirmDialog>}
  </Page>;
}

function PlaybackPage({ clip, onBack }: { clip: RecordingMeta; onBack: () => void }) {
  const [url, setUrl] = useState(''); const [error, setError] = useState(''); const [protectedClip, setProtected] = useState(clip.protected); const [confirm, setConfirm] = useState(false);
  useEffect(() => { let live = true, objectUrl = ''; void recordingStorage.getBlob(clip.id).then(blob => {
    if (!live) return; if (!blob) throw new Error('Recording no longer exists. Return to the library.');
    objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
  }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Playback unavailable.'); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [clip.id]);
  const run = async (action: () => Promise<void>) => { try { await action(); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Recording action failed.'); } };
  return <Page title="Playback" onBack={onBack}>
    <p>{new Date(clip.startedAt).toLocaleString()} · {seconds(clip.durationMs)} · <Bytes value={clip.bytes} /> · {clip.mimeType}. {clip.audio ? 'Microphone audio included.' : 'Silent video.'}</p>
    {clip.interrupted && <p>This recording ended during a camera or app interruption. Playback availability depends on the recovered video data.</p>}
    {url && <video aria-label="Recorded walking video" controls playsInline src={url} style={{ width: '100%', maxHeight: '50vh', background: '#000' }} onError={() => setError('This browser could not play this format. Export the file and try another video player.')} />}
    {error && <Message error>{error}</Message>}
    <div style={actionsStyle}><Action secondary onClick={() => { void run(async () => { await recordingStorage.protect(clip.id, !protectedClip); setProtected(!protectedClip); }); }}>{protectedClip ? 'Unprotect clip' : 'Protect clip'}</Action>
      <Action onClick={() => { void run(async () => { const blob = await recordingStorage.getBlob(clip.id); if (!blob) throw new Error('Recording no longer exists.'); download(blob, clipName(clip)); }); }}>Export video file</Action>
      <Action danger onClick={() => setConfirm(true)}>Delete this clip</Action></div>
    {confirm && <ConfirmDialog title="Delete this clip?" danger confirmLabel="Confirm delete clip" onCancel={() => setConfirm(false)} onConfirm={() => { void run(async () => { await recordingStorage.remove([clip.id], true); onBack(); }); }}><p>Delete this {protectedClip ? 'protected ' : ''}clip permanently?</p></ConfirmDialog>}
  </Page>;
}

function ImportPage({ onBack, onImported, onExtraImport, dataMutationBlocked = false }: { onBack: () => void; onImported: () => void; onExtraImport?: LocalToolsScreenProps['onExtraImport']; dataMutationBlocked?: boolean }) {
  const current = useStore(localToolsRepository.state).data;
  const mutationBlocked = useRef(dataMutationBlocked); mutationBlocked.current = dataMutationBlocked;
  useProductBack(true, onBack);
  const [preview, setPreview] = useState<LocalToolsData | null>(null); const [extra, setExtra] = useState<unknown>(undefined);
  const [settings, setSettings] = useState<RecorderSettings | null>(null); const [replace, setReplace] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const read = async (file?: File) => {
    setPreview(null); setExtra(undefined); setSettings(null); setError(''); if (!file) return;
    try {
      if (dataMutationBlocked) throw new Error('End navigation and finish crossing before restoring local data.');
      if (file.size > 2_000_000) throw new Error('Maximum import size is 2 MB. Video files are imported through their own library, not a data backup.');
      const raw = await file.text(), parsed: unknown = JSON.parse(raw), wrapper = parsed as Record<string, unknown>;
      if (wrapper?.kind === 'crosswise-local-backup') {
        if (wrapper.version !== 1) throw new Error('Unsupported backup version.');
        const local = parseLocalToolsFile(JSON.stringify(wrapper.localTools));
        const restoredSettings = wrapper.recorderSettings ? validateRecorderSettings(wrapper.recorderSettings) : null;
        const additional = wrapper.extra === undefined ? undefined : validateBackup(wrapper.extra);
        setPreview(local); setSettings(restoredSettings); setExtra(additional);
      } else setPreview(parseLocalToolsFile(raw));
    } catch (e) { setError(e instanceof Error ? e.message : 'Data file could not be read.'); }
  };
  const apply = async () => {
    if (!preview) return; setBusy(true); setError('');
    try {
      if (mutationBlocked.current) throw new Error('End navigation and finish crossing before restoring local data.');
      const combined = mergedLocalTools(current, preview, replace);
      if (settings && !['idle', 'error'].includes(walkingRecorder.state.value.status)) throw new Error('Stop recording before restoring recorder settings.');
      if (extra !== undefined && !onExtraImport) throw new Error('This screen can import routes and areas only. Use Data management for a full backup.');
      if (extra !== undefined) {
        await onExtraImport?.(combinedLocalBackup(extra, combined, settings));
        // The root callback has atomically restored all reviewed sections and refreshed its stores.
        localToolsRepository.load(); reloadRecorderSettings(); onImported(); return;
      }
      if (mutationBlocked.current) throw new Error('Navigation is active. Local route data was not restored.');
      localToolsRepository.importData(preview, replace); if (settings) saveRecorderSettings(settings); onImported();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  };
  return <Page title="Import CrossWise data" onBack={onBack}>
    <p>Choose a CrossWise JSON export. Import validates identifiers, coordinates and limits. Video files, account credentials and provider map content are not included.</p>
    <Field label="CrossWise JSON file"><input style={inputStyle} type="file" accept=".json,application/json" onChange={e => { void read(e.target.files?.[0]); }} /></Field>
    {preview && <><h2>Import preview</h2><p>{preview.routes.length} routes and {preview.areas.length} special-area packs. {preview.routes.filter(r => current.routes.some(c => c.id === r.id)).length} route identifier conflicts. {preview.areas.filter(a => current.areas.some(c => c.id === a.id)).length} pack identifier conflicts.</p>
      <p>Merge keeps existing records when identifiers conflict. Replacement removes the current route and area lists and replaces them with this file.</p>
      <Field label="Replace all routes and area packs instead of merging"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /></Field>
      {settings && <p>Recorder settings will also be restored.</p>}{extra !== undefined && <p>This backup includes additional application data.</p>}
      <Action disabled={busy || dataMutationBlocked} onClick={() => { void apply(); }}>{replace ? 'Confirm replacement import' : 'Import and merge data'}</Action></>}
    {dataMutationBlocked && <Message>End navigation and finish crossing before restoring local data.</Message>}
    {busy && <Message>Importing data…</Message>}{error && <Message error>{error}</Message>}
  </Page>;
}

function DataScreen(props: LocalToolsScreenProps) {
  const data = useStore(localToolsRepository.state).data; const recorder = useStore(walkingRecorder.state); const [page, setPage] = useState<'data' | 'import'>('data');
  const mutationBlocked = useRef(props.dataMutationBlocked); mutationBlocked.current = props.dataMutationBlocked;
  const [clips, setClips] = useState<RecordingMeta[]>([]); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'routes' | 'areas' | 'recordings' | 'settings' | 'all' | null>(null); const [typed, setTyped] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void recordingStorage.list().then(setClips).catch(() => undefined); }, [recorder.clipsSaved]);
  if (page === 'import') return <ImportPage onBack={() => setPage('data')} onExtraImport={props.onExtraImport} dataMutationBlocked={props.dataMutationBlocked} onImported={() => { setPage('data'); setNotice('Validated data imported.'); }} />;
  const active = !['idle', 'error'].includes(recorder.status);
  const reset = async () => {
    if (!confirm) return; setBusy(true); setError('');
    try {
      if (mutationBlocked.current) throw new Error('End navigation and finish crossing before deleting or resetting local data.');
      await walkingRecorder.stop();
      if (mutationBlocked.current) throw new Error('Navigation is active. Local data was not deleted.');
      if (confirm === 'recordings' || confirm === 'all') { const items = await recordingStorage.list(); await recordingStorage.remove(items.map(c => c.id), true); setClips([]); walkingRecorder.discardUnsaved(); }
      if (confirm === 'all') { await props.onExtraReset?.(); localToolsRepository.reset(); saveRecorderSettings(DEFAULT_RECORDER_SETTINGS); }
      if (confirm === 'routes') localToolsRepository.importData({ ...data, routes: [] }, true);
      if (confirm === 'areas') localToolsRepository.importData({ ...data, areas: [] }, true);
      if (confirm === 'settings') saveRecorderSettings(DEFAULT_RECORDER_SETTINGS);
      setNotice('Selected local data deleted or reset. Cloud data is separate.'); setConfirm(null); setTyped('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Some data could not be reset. Review the remaining data before retrying.'); }
    finally { setBusy(false); }
  };
  return <Page title="Data management" onBack={props.onBack}>
    <p>Local authored routes: {data.routes.length}. Area packs: {data.areas.length}. Route and area data: <Bytes value={new Blob([JSON.stringify(data)]).size} />.</p>
    <p>Recordings: {clips.length} · <Bytes value={clips.reduce((sum, clip) => sum + clip.bytes, 0)} />. Video exports are separate from the JSON backup.</p>
    <p>JSON exports contain your user-authored data and selected settings. They may reveal your Home and walking locations. Save them somewhere you choose.</p>
    {active && <Message>A recording is active. Data deletion first stops and finalizes it.</Message>}
    {props.dataMutationBlocked && <Message>End navigation and finish crossing before importing, deleting or resetting local data. Export remains available.</Message>}
    {error && <Message error>{error}</Message>}{notice && <Message>{notice}</Message>}
    <div style={actionsStyle}><Action onClick={() => { try { jsonDownload({ kind: 'crosswise-local-backup', version: 1, exportedAt: Date.now(), localTools: data, recorderSettings: recorderSettings.value,
      recordingManifest: clips, ...(props.extraExport ? { extra: props.extraExport() } : {}) }, 'CrossWise_backup.json'); setNotice('Backup download requested. Videos require separate export.'); } catch { setError('Backup could not be prepared.'); } }}>Export local backup</Action>
      <Action secondary disabled={active || props.dataMutationBlocked} onClick={() => setPage('import')}>Import local backup</Action>
      <Action danger disabled={props.dataMutationBlocked} onClick={() => setConfirm('routes')}>Delete all My Routes</Action><Action danger disabled={props.dataMutationBlocked} onClick={() => setConfirm('areas')}>Remove all area packs</Action>
      <Action danger disabled={props.dataMutationBlocked} onClick={() => setConfirm('recordings')}>Delete all local recordings</Action><Action secondary disabled={props.dataMutationBlocked} onClick={() => setConfirm('settings')}>Reset recorder settings</Action>
      <Action danger disabled={props.dataMutationBlocked} onClick={() => setConfirm('all')}>Delete all local application data</Action></div>
    {confirm && <ConfirmDialog title={`Confirm ${confirm === 'all' ? 'all local application data deletion' : `${confirm} deletion or reset`}`} danger confirmLabel="Confirm local deletion" onCancel={() => { if (!busy) { setConfirm(null); setTyped(''); } }} onConfirm={() => { if (typed === 'DELETE' && !busy) void reset(); else setError('Type DELETE before confirming local deletion.'); }}>
      <p>{confirm === 'all' || confirm === 'recordings' ? 'Protected recordings are included. This cannot be undone. ' : ''}Type DELETE to confirm the named scope. Cloud data will remain separate.</p>
      <Field label="Type DELETE"><input style={inputStyle} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" /></Field>
      {busy && <Message>Deleting the selected local data…</Message>}{typed !== 'DELETE' && <p>Deletion remains blocked until you type DELETE.</p>}</ConfirmDialog>}
  </Page>;
}

function AreasScreen(props: LocalToolsScreenProps) {
  const data = useStore(localToolsRepository.state).data; const [selected, setSelected] = useState<AreaPack | null>(null);
  const [route, setRoute] = useState<AuthoredRoute | null>(null); const [following, setFollowing] = useState(false); const [edit, setEdit] = useState(false); const [importing, setImporting] = useState(false);
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState(false);
  useProductBack(!edit && !importing && !following && (!!selected || !!route), () => { if (route) setRoute(null); else { setSelected(null); setConfirm(false); setError(''); } });
  if (importing) return <ImportPage onBack={() => setImporting(false)} onImported={() => setImporting(false)} />;
  if (route && following) return <AuthoredFollower route={route} onBack={() => setFollowing(false)} />;
  if (route) return <Page title="Area route" onBack={() => setRoute(null)}><h2>{route.name}</h2><p>User-authored route in {selected?.name}.</p><ol>{route.waypoints.map(p => <li key={p.id} style={cardStyle}><strong>{p.label}</strong><p>{p.note}</p><p>{p.latitude}, {p.longitude}</p></li>)}</ol>
    <Action onClick={() => { if (props.onStartAuthoredRoute) void Promise.resolve(props.onStartAuthoredRoute(structuredClone(route))).catch(e => setError(e instanceof Error ? e.message : 'Route could not start.')); else setFollowing(true); }}>Start area route</Action>
    <Action secondary onClick={() => { try { localToolsRepository.saveRoute(duplicateRoute(route)); setError('A copy was added to My Routes.'); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save route.'); } }}>Copy to My Routes</Action>{error && <Message>{error}</Message>}</Page>;
  if (edit) return <AreaEditor pack={selected} onBack={() => setEdit(false)} onSave={pack => { localToolsRepository.saveArea(pack); setSelected(pack); setEdit(false); }} />;
  if (selected) return <Page title="Special-area pack" onBack={() => { setSelected(null); setConfirm(false); setError(''); }}>
    <h2>{selected.name}</h2><p>Region: {selected.region}. Version: {selected.version}. Updated {new Date(selected.updatedAt).toLocaleDateString()}.</p>
    <p>Source: {selected.source}. Installed locally; authored notes are available offline. No verified official Expo navigation content is bundled.</p>
    <h2>Routes</h2>{!selected.routes.length && <p>No routes in this pack.</p>}{selected.routes.map(r => <article key={r.id} style={cardStyle}><p>{r.name} · {r.waypoints.length} points</p><Action secondary onClick={() => setRoute(r)}>Open area route {r.name}</Action></article>)}
    <h2>Landmarks</h2>{!selected.landmarks.length && <p>No landmarks in this pack.</p>}{selected.landmarks.map(p => <article key={p.id} style={cardStyle}><h3>{p.label}</h3><p>{p.note}</p><p>{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</p>
      {props.onNavigateCoordinate && <Action secondary onClick={() => props.onNavigateCoordinate!(p, p.label)}>Route to {p.label}</Action>}</article>)}
    <div style={actionsStyle}><Action secondary onClick={() => setEdit(true)}>Edit or update pack</Action>
      <Action secondary onClick={() => jsonDownload({ version: 1, routes: [], areas: [selected] }, `${fileName(selected.name)}_area.json`)}>Export area pack</Action><Action danger onClick={() => setConfirm(true)}>Remove area pack</Action></div>
    {confirm && <ConfirmDialog title="Remove area pack?" danger confirmLabel="Confirm remove pack" onCancel={() => setConfirm(false)} onConfirm={() => { try { localToolsRepository.removeArea(selected.id); setSelected(null); setConfirm(false); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove pack.'); } }}><p>Remove {selected.name}? Copies saved in My Routes remain.</p></ConfirmDialog>}
    {error && <Message error>{error}</Message>}
  </Page>;
  return <Page title="Special-area content" onBack={props.onBack}>
    <p>Install or author a campus/park pilot pack with named routes and landmarks. Review source, version and coverage before walking. CrossWise does not include Eye Navi's official Expo content.</p>
    <div style={actionsStyle}><Action onClick={() => { setSelected(null); setEdit(true); }}>Create pilot area pack</Action><Action secondary onClick={() => setImporting(true)}>Install area pack from file</Action></div>
    {!data.areas.length && <p>No area packs installed.</p>}{data.areas.map(pack => <article key={pack.id} style={cardStyle}><h2>{pack.name}</h2><p>{pack.region} · {pack.version} · {pack.routes.length} routes · {pack.landmarks.length} landmarks</p><Action onClick={() => setSelected(pack)}>Open {pack.name}</Action></article>)}
  </Page>;
}

function AreaEditor({ pack, onBack, onSave }: { pack: AreaPack | null; onBack: () => void; onSave: (pack: AreaPack) => void }) {
  const routes = useStore(localToolsRepository.state).data.routes;
  const initial = useRef<AreaPack>(pack ? structuredClone(pack) : { id: localId(), name: '', region: '', source: 'User-authored pilot', version: '1', updatedAt: Date.now(), routes: [], landmarks: [] });
  const [draft, setDraft] = useState<AreaPack>(() => structuredClone(initial.current));
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<AuthoredWaypoint | null>(null); const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false); const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current);
  const leave = () => dirty ? setDiscard(true) : onBack();
  useProductBack(!adding && !editing, leave);
  if (adding || editing) return <WaypointEditor point={editing} onBack={() => { setAdding(false); setEditing(null); }} onSave={point => { setDraft(d => ({ ...d, landmarks: editing ? d.landmarks.map(p => p.id === point.id ? point : p) : [...d.landmarks, point] })); setAdding(false); setEditing(null); }} />;
  return <Page title="Edit area pack" onBack={leave}>
    <Field label="Area name"><input style={inputStyle} value={draft.name} maxLength={160} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></Field>
    <Field label="Region"><input style={inputStyle} value={draft.region} maxLength={160} onChange={e => setDraft(d => ({ ...d, region: e.target.value }))} /></Field>
    <Field label="Source and coverage notes"><textarea style={inputStyle} value={draft.source} maxLength={500} onChange={e => setDraft(d => ({ ...d, source: e.target.value }))} /></Field>
    <Field label="Pack version"><input style={inputStyle} value={draft.version} maxLength={80} onChange={e => setDraft(d => ({ ...d, version: e.target.value }))} /></Field>
    <h2>Include My Routes</h2>{!routes.length && <p>Create a My Route first to include it, or add landmarks below.</p>}
    {routes.map(route => <Field key={route.id} label={route.name}><input type="checkbox" checked={draft.routes.some(r => r.id === route.id)} onChange={e => setDraft(d => ({ ...d, routes: e.target.checked ? [...d.routes, structuredClone(route)] : d.routes.filter(r => r.id !== route.id) }))} /></Field>)}
    {draft.routes.filter(r => !routes.some(s => s.id === r.id)).map(route => <Field key={route.id} label={`${route.name} (pack route)`}><input type="checkbox" checked onChange={() => setDraft(d => ({ ...d, routes: d.routes.filter(r => r.id !== route.id) }))} /></Field>)}
    <h2>Landmarks</h2>{draft.landmarks.map(p => <article key={p.id} style={cardStyle}><p>{p.label}: {p.note}</p><Action secondary onClick={() => setEditing(p)}>Edit landmark {p.label}</Action><Action danger onClick={() => setDraft(d => ({ ...d, landmarks: d.landmarks.filter(q => q.id !== p.id) }))}>Remove landmark {p.label}</Action></article>)}
    <div style={actionsStyle}><Action secondary onClick={() => setAdding(true)}>Add area landmark</Action><Action onClick={() => { try { if (!draft.routes.length && !draft.landmarks.length) throw new Error('Add at least one route or landmark to this pack.'); onSave({ ...draft, updatedAt: Date.now() }); } catch (e) { setError(e instanceof Error ? e.message : 'Pack could not be saved.'); } }}>Save area pack</Action><Action secondary onClick={leave}>Cancel area editing</Action></div>
    {error && <Message error>{error}</Message>}
    {discard && <ConfirmDialog title="Discard area changes?" danger confirmLabel="Discard area changes" onConfirm={onBack} onCancel={() => setDiscard(false)}><p>Unsaved area-pack changes will be lost.</p></ConfirmDialog>}
  </Page>;
}
