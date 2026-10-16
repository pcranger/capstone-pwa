import { useEffect, useRef, useState } from 'react';
import { Page, Action, Row, Notice, useProductBack } from './ProductPage';
import { PlaceMap } from './PlaceMap';
import { currentLocation } from './location';
import { useStore } from '../state/store';
import { controller } from '../state/controller';
import { nearbySettings, setNearbySettings, DEMO_NEARBY_GENRES, demoNearbySettings, nearbyPlaces, type NearbyPlace } from '../nav/nearby';
const demoGenres=DEMO_NEARBY_GENRES;
import type { PlaceCandidate } from '../nav/navigation';

export function NearbyScreen({ onBack, onNavigate, initialView = 'list' }: { onBack: () => void; onNavigate?: (place: PlaceCandidate) => void; initialView?: 'list' | 'settings' }) {
  const storedSettings = useStore(nearbySettings);
  const settings = demoNearbySettings(storedSettings);
  const saved = useStore(controller.savedPlaces.state);
  const [view, setView] = useState<'list' | 'settings' | 'detail'>(initialView);
  const [places, setPlaces] = useState<NearbyPlace[]>([]), [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState(''), [checkedAt, setCheckedAt] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null), generation = useRef(0);
  const settingsKey = JSON.stringify(settings);
  const refresh = async () => {
    const id = ++generation.current; request.current?.abort(); request.current = new AbortController(); setBusy(true); setError(''); setPlaces([]);
    try {
      if (!settings.radius || !settings.enabled.length) { setCheckedAt(null); return; }
      const fix = await currentLocation(request.current.signal);
      const found = await nearbyPlaces(fix, settings, request.current.signal);
      if (id === generation.current) { setPlaces(found); setCheckedAt(Date.now()); }
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : 'Nearby search unavailable. Try again.'); }
    finally { if (id === generation.current) setBusy(false); }
  };
  useEffect(() => { ++generation.current; request.current?.abort(); setBusy(false); setPlaces([]); setCheckedAt(null); }, [settingsKey]);
  useEffect(() => () => { ++generation.current; request.current?.abort(); }, []);
  const update = (patch: Parameters<typeof setNearbySettings>[0]) => { try { setNearbySettings({enabled:settings.enabled,...patch}); if(patch.radius===0)controller.stopVoice(); setError(''); } catch { setError('Could not save nearby settings. Your previous choices are unchanged.'); } };
  const back = () => { if (view === 'detail') setView('list'); else if (view === 'settings' && initialView !== 'settings') setView('list'); else if(view === 'list' && initialView === 'settings')setView('settings'); else onBack(); };
  useProductBack(view !== initialView, back);
  const read = () => {
    controller.stopVoice();
    if (!places.length) { controller.sayNavigation('No nearby facilities in the current results. Refresh to search.',80); return; }
    controller.sayNavigation(places.map(p => `${p.name}, ${Math.round(p.distance)} metres ${p.direction}.`).join(' '),80);
  };
  return <Page title={view === 'detail' ? selected?.name ?? 'Nearby place' : view === 'settings' ? 'Nearby facilities' : 'Nearby places'} onBack={back}>
    {error && <Notice error>{error}</Notice>}
    {status && <Notice>{status}</Notice>}
    {view === 'settings' && <>
      <fieldset><legend>Announcement and search radius</legend>{[...new Set([0,50,100,200,settings.radius])].sort((a,b)=>a-b).map(radius => <label className="cw-radio" key={radius}><input type="radio" name="nearby-radius" checked={radius === settings.radius} onChange={() => update({ radius })} />{radius ? `${radius} metres` : 'None — stop nearby searches'}</label>)}</fieldset>
      <p>This is a straight-line radius. Provider results are limited and may omit facilities. Results use compass directions, not directions relative to your body.</p>
      <h2>Categories</h2>{demoGenres.map(g=><label className="cw-switch" key={g.id}><span>{g.label}</span><input type="checkbox" role="switch" checked={g.children.some(c=>settings.enabled.includes(c.id))} onChange={e=>{const ids=g.children.filter(c=>c.types.length).map(c=>c.id);const retained=settings.enabled.filter(id=>demoGenres.some(group=>group.children.some(c=>c.id===id))&&!ids.includes(id));update({enabled:e.target.checked?[...retained,...ids]:retained});}}/></label>)}

      <Action onClick={() => setView('list')}>View nearby places</Action>
    </>}
    {view === 'list' && <>
      <Notice>{!settings.radius ? 'Nearby facilities are off. Choose a radius to search.' : !settings.enabled.length ? 'All facility categories are off.' : `Search within ${settings.radius} metres. Location is requested only when you refresh.`}</Notice>
      <Action disabled={busy || !settings.radius || !settings.enabled.length} onClick={() => { void refresh(); }}>{busy ? 'Finding nearby facilities…' : 'Refresh nearby places'}</Action>
      {busy && <Action secondary onClick={() => { ++generation.current; request.current?.abort(); setBusy(false); }}>Cancel search</Action>}
      <Action secondary onClick={() => setView('settings')}>Radius and categories</Action>
      {!!places.length && <><Action secondary onClick={read}>Read nearby places</Action><Action secondary onClick={() => controller.stopVoice()}>Stop reading</Action></>}
      <p role="status" aria-atomic="true">{busy ? 'Finding nearby facilities…' : checkedAt ? `${places.length} nearby places found. Results checked ${new Date(checkedAt).toLocaleTimeString()}. Up to 20 provider results; distances are straight line.` : ''}</p>
      {checkedAt && !places.length && <Notice>No matching facilities found in this radius. Increase the radius or change categories.</Notice>}
      {places.map((p,i) => <Row key={p.id} label={`${i + 1}. ${p.name}`} detail={`${Math.round(p.distance)} metres ${p.direction} · ${p.address}`} onClick={() => { setSelected(p); setView('detail'); }} />)}
      {!!places.length && <p>Google Maps</p>}
    </>}
    {view === 'detail' && selected && <>
      <p>{selected.address}</p><p>{Math.round(selected.distance)} metres {selected.direction} from the location at search time. Walking distance may differ.</p><PlaceMap point={selected.point} title={selected.name} />
      <Action onClick={() => controller.sayNavigation(`${selected.name}. ${Math.round(selected.distance)} metres ${selected.direction}. ${selected.address}`,80)}>Read details</Action>
      {onNavigate && <Action secondary onClick={() => onNavigate(selected)}>Review walking route</Action>}
      <Action secondary disabled={saved.status !== 'ready' || saved.busy} onClick={() => { setStatus(''); void controller.savedPlaces.save(selected.id,undefined,selected.name).then(result => { setError(''); setStatus(result === 'already' ? 'This destination is already registered.' : 'Destination registered.'); }).catch(e => setError(e instanceof Error ? e.message : 'Could not save destination.')); }}>Save destination</Action>
      <p>Google Maps</p>
    </>}
    {(places.length > 0 || view === 'detail') && <p><a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noreferrer">Google Maps terms</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a></p>}
  </Page>;
}
