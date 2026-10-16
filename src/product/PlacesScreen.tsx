import { useEffect, useRef, useState } from 'react';
import { Page, Action, Row, Notice, ConfirmDialog, useProductBack } from './ProductPage';
import { PlaceMap } from './PlaceMap';
import { currentLocation } from './location';
import { controller } from '../state/controller';
import { useStore } from '../state/store';
import { DESTINATION_CAPACITY, type SavedPlace } from '../nav/savedPlaces';
import { searchPlaces, placeDetails, walkingRoute, validPoint, displayableFix, distanceMeters, WALKING_WARNING, type GeoPoint, type LocationFix, type PlaceCandidate } from '../nav/navigation';
import { compassDirection } from '../nav/nearby';
import { ROUTE_PREFERENCES, routePreference, setRoutePreference, supportsPreference, type RoutePreference } from '../nav/routePreferences';
import { services } from '../config/services';

type View = 'list' | 'home' | 'search' | 'review' | 'detail' | 'location' | 'name' | 'edit' | 'route' | 'ack';
type Intent = 'navigate' | 'save' | 'home';
const coordinateText = (p: GeoPoint) => `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
const placeName = (p: SavedPlace) => p.alias || p.queryLabel || (p.role === 'home' ? 'Home' : 'Saved destination');

export function PlacesScreen({ onBack, onWalk, intent = 'navigate', onMyRoutes, onOpenTools }: { onBack: () => void; onWalk: (place: PlaceCandidate) => void; intent?: 'navigate' | 'manage' | 'home'; onMyRoutes?:()=>void; onOpenTools?:()=>void }) {
  const repo = controller.savedPlaces;
  const saved = useStore(repo.state), planner = useStore(controller.planner.state), preference = useStore(routePreference);
  const initialSelected = intent === 'navigate' && planner.page === 'place' ? planner.selected : null;
  const initialEntry = initialSelected ? saved.items.find(p => p.placeId === initialSelected.id) : undefined;
  const [view, setView] = useState<View>(intent === 'home' ? 'home' : initialSelected ? initialEntry ? 'detail' : 'review' : 'list');
  const [flow, setFlow] = useState<Intent>(intent === 'home' || initialEntry?.role === 'home' ? 'home' : intent === 'manage' ? 'save' : 'navigate');
  const [query, setQuery] = useState(''), [results, setResults] = useState<PlaceCandidate[]>([]);
  const [searchStatus, setSearchStatus] = useState(''), [entranceStatus, setEntranceStatus] = useState('');
  const [searchOrigin,setSearchOrigin] = useState<LocationFix|null>(null), [capturedAt,setCapturedAt] = useState<number|null>(null);
  const [selected, setSelected] = useState<PlaceCandidate | null>(initialSelected && initialEntry ? { ...initialSelected, name: placeName(initialEntry) } : initialSelected), [entryId, setEntryId] = useState<string | null>(initialEntry?.placeId ?? null);
  const [alias, setAlias] = useState(initialEntry ? placeName(initialEntry) : initialSelected?.name ?? ''), [lat, setLat] = useState(''), [lng, setLng] = useState(''), [increment, setIncrement] = useState(5);
  const [originalPoint, setOriginalPoint] = useState<GeoPoint | null>(null), [accuracy, setAccuracy] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [all, setAll] = useState(false), [sort, setSort] = useState<'recent' | 'name'>(() => { try { return localStorage.getItem('crosswise_places_sort') === 'name' ? 'name' : 'recent'; } catch { return 'recent'; } });
  const [searchForEntrance,setSearchForEntrance] = useState(false), [showSavedMap,setShowSavedMap] = useState(false);
  const [exitRequested,setExitRequested] = useState(false); const exitHandled=useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false), [confirmReplace, setConfirmReplace] = useState<(() => void) | null>(null), [discard, setDiscard] = useState<(() => void) | null>(null);
  const request = useRef<AbortController | null>(null), generation = useRef(0), mounted = useRef(true);
  const home = saved.items.find(p => p.role === 'home');
  const entry = saved.items.find(p => p.placeId === entryId);
  const point = lat.trim() && lng.trim() ? { latitude: Number(lat), longitude: Number(lng) } : null;
  const validDraft = point !== null && validPoint(point);
  const destinations = saved.items.filter(p => p.role !== 'home');
  const ordered = sort === 'name' ? [...destinations].sort((a, b) => placeName(a).localeCompare(placeName(b))) : destinations;

  useEffect(() => { if (repo.state.value.status === 'loading') void repo.load(); return () => { mounted.current = false; ++generation.current; request.current?.abort(); }; }, [repo]);
  const go = (next: View) => { ++generation.current; request.current?.abort(); setBusy(false); setError(''); setView(next); };
  const base = () => go(intent === 'home' ? 'home' : 'list');
  const back = () => {
    if (busy) { ++generation.current; request.current?.abort(); setBusy(false); setSearchStatus('Search canceled.'); controller.planner.cancel(); return; }
    const leave = () => {
      if (view === 'home' && intent !== 'home') go('list');
      else if (view === 'list' || view === 'home') { if(planner.replacing)controller.cancelPlanning(); onBack(); }
      else if (view === 'route') { controller.planner.cancel(); go(entryId ? 'detail' : selected ? 'review' : 'list'); }
      else if (view === 'edit' || view === 'name') go(entryId ? 'detail' : flow === 'home' ? 'home' : 'list');
      else if (view === 'search' && searchForEntrance) go('edit');
      else if (view === 'review') go(results.length ? 'search' : 'list'); else base();
    };
    if ((view === 'edit' || view === 'name') && (alias.trim() || lat.trim() || lng.trim())) setDiscard(() => leave); else leave();
  };
  useProductBack(!exitRequested && (busy || view !== (intent === 'home' ? 'home' : 'list')), back);
  useEffect(()=>{if(exitRequested&&!exitHandled.current){exitHandled.current=true;onBack();}},[exitRequested,onBack]);
  const run = async <T,>(operation: (signal: AbortSignal) => Promise<T>, done: (result: T) => void) => {
    const id = ++generation.current; request.current?.abort(); request.current = new AbortController(); setBusy(true); setError('');
    try { const result = await operation(request.current.signal); if (mounted.current && generation.current === id) done(result); }
    catch (e) { if (mounted.current && generation.current === id) setError(e instanceof Error ? e.message : 'Could not complete the request. Try again.'); }
    finally { if (mounted.current && generation.current === id) setBusy(false); }
  };
  const acknowledge = (text: string) => { setMessage(text); setView('ack'); setError(''); };
  const openSearch = (next: Intent) => { setSearchStatus(''); setSearchForEntrance(false); setFlow(next); setEntryId(null); setSelected(null); setResults([]); go('search'); };
  const search = () => {
    if (!query.trim()) { setError('Enter a place name or address.'); return; }
    setResults([]);setSearchStatus('Checking your location and searching destinations…');
    void run(async signal => {
      let from:LocationFix|null=null;
      try { from=await currentLocation(signal,{allowApproximate:true}); }
      catch { if(signal.aborted)throw new Error('Search canceled.');const fix=controller.journey.location.value;const cached=fix&&displayableFix(fix,Date.now())?fix:searchOrigin;from=cached&&displayableFix(cached,Date.now())?cached:null; }
      return {from,places:await searchPlaces(query,from,services.mapsRestApiKey,signal)};
    }, ({from,places}) => {setSearchOrigin(from);setResults(places);setSearchStatus(`${places.length} destinations found. ${from?'Closest first by straight-line distance from your estimated location.':'Location unavailable. Results use Google relevance; allow location to sort closest first.'}`);});
  };
  const resolve = (record: SavedPlace) => {
    setEntryId(record.placeId); setFlow(record.role === 'home' ? 'home' : 'navigate');
    void run(async signal => repo.getCandidate(record.placeId) ?? await placeDetails(record.placeId, services.mapsRestApiKey, signal), place => {
      setSelected({ ...place, name: record.alias || place.name }); setAlias(placeName(record)); setView('detail');
    });
  };
  const coordinates = (p: GeoPoint | null) => { setLat(p ? String(p.latitude) : ''); setLng(p ? String(p.longitude) : ''); };
  const capture = (next: Intent) => {
    setFlow(next); setEntryId(null); setSelected(null); setAccuracy(null);
    void run(signal => currentLocation(signal), fix => { coordinates(fix); setOriginalPoint(fix); setAccuracy(fix.accuracy); setCapturedAt(fix.timestamp); setAlias(next === 'home' ? 'Home' : `Destination ${destinations.length + 1}`); setView('location'); });
  };
  const manual = (next: Intent) => { setFlow(next); setEntryId(null); setSelected(null); setOriginalPoint(null); coordinates(null); setAlias(next === 'home' ? 'Home' : ''); setAccuracy(null); go('edit'); };
  const edit = () => { if (!selected) return; coordinates(selected.point); setOriginalPoint(selected.point); setAlias(entry ? placeName(entry) : selected.name); setAccuracy(null); go('edit'); };
  const saveDraft = () => {
    if (!alias.trim()) { setError('Enter a destination name.'); return; }
    if (!validDraft) { setError('Enter a latitude between −90 and 90, and a longitude between −180 and 180.'); return; }
    const commit = () => { void run(async () => repo.saveCoordinate(point!, alias, flow === 'home' ? 'home' : 'destination', entryId ?? undefined), id => { setEntryId(id); acknowledge(entryId ? 'Location updated.' : flow === 'home' ? 'Home registered.' : 'Destination registered.'); }); };
    if (flow === 'home' && home && home.placeId !== entryId) setConfirmReplace(() => commit); else commit();
  };
  const saveProvider = () => {
    if (!selected || selected.unavailableReason) return;
    const commit = () => { void run(async () => {
      if (flow === 'home') return repo.saveProviderHome(selected.id, alias || 'Home');
      await repo.save(selected.id, undefined, alias || selected.name); return selected.id;
    }, id => { setEntryId(id); acknowledge(flow === 'home' ? 'Home registered.' : 'Destination registered.'); }); };
    if (flow === 'home' && home && home.placeId !== selected.id) setConfirmReplace(() => commit); else commit();
  };
  const prepare = async () => {
    if (!selected || selected.unavailableReason) return;
    controller.planner.select(selected); go('route'); await controller.planner.confirm(selected.id);
  };
  const fallback = () => {
    if (!selected) return;
    void run(async signal => { const fix = await currentLocation(signal); controller.journey.location.set(fix); return walkingRoute(fix, selected, services.mapsRestApiKey, signal, { allowStandardFallback: true, preference }); }, route => controller.planner.review(selected, route));
  };
  const start = async (confirmed = false) => { if (!selected) return; const destination = selected; if (await controller.startPlannedJourney(confirmed)) onWalk(destination); };
  const nudge = (north: number, east: number) => {
    if (!validDraft) { setError('Enter coordinates before moving the entrance.'); return; }
    const latitude = point!.latitude + north * increment / 111_320;
    const longitude = point!.longitude + east * increment / (111_320 * Math.max(0.01, Math.cos(point!.latitude * Math.PI / 180)));
    const next = { latitude, longitude }; if (validPoint(next)) { coordinates(next); setEntranceStatus(`Moved ${increment} metres ${north > 0 ? 'north' : north < 0 ? 'south' : east > 0 ? 'east' : 'west'}. Entrance coordinates: ${coordinateText(next)}.`); }
  };
  const title = ({ list: intent === 'manage' ? 'Destinations' : 'Route guidance', home: 'Home', search: flow === 'home' ? 'Home address' : 'Search destination', review: 'Confirm place', detail: entry?.role === 'home' ? 'Home detail' : 'Destination detail', location:'Current location', name: 'Name destination', edit: 'Edit entrance location', route: 'Route review', ack: 'Saved changes' })[view];
  return <Page title={title} onBack={back}>
    {(saved.status === 'loading' || busy || planner.busy && view === 'route') && <Notice>{planner.busy === 'routing' && view === 'route' ? 'Finding walking routes…' : busy ? 'Working…' : 'Loading saved destinations…'}</Notice>}
    {(error || (view === 'route' ? planner.error : saved.error)) && <Notice error>{error || (view === 'route' ? planner.error : saved.error)}</Notice>}
    {saved.status === 'error' && <Action onClick={() => { void repo.load(); }}>Retry saved places</Action>}
    {busy && <Action secondary onClick={() => { ++generation.current; request.current?.abort(); setBusy(false); }}>Cancel request</Action>}
    {planner.replacing && <><Notice>Original journey paused. Cancel the destination change to keep its route.</Notice><Action secondary onClick={() => {controller.cancelPlanning();request.current?.abort();setExitRequested(true);}}>Cancel destination change</Action></>}
    {view === 'home' && <>
      <Notice>{home ? `${placeName(home)} is registered.` : 'Home is not registered.'}</Notice>
      {home && <><Row label="Confirm Home" detail={home.point ? coordinateText(home.point) : 'Saved provider place'} onClick={() => resolve(home)} /><Row label="Edit Home" onClick={() => { setEntryId(home.placeId); setFlow('home'); void run(async signal => repo.getCandidate(home.placeId) ?? await placeDetails(home.placeId, services.mapsRestApiKey, signal), p => { setSelected(p); coordinates(p.point); setOriginalPoint(p.point); setAlias(placeName(home)); setView('edit'); }); }} /><Row label="Delete Home" onClick={() => { setEntryId(home.placeId); setConfirmDelete(true); }} /></>}
      <Action disabled={busy || saved.status !== 'ready'} onClick={() => capture('home')}>Register current location</Action>
      <Action secondary disabled={busy} onClick={() => openSearch('home')}>Register by address</Action>
      <details><summary>Advanced location editing</summary><Action secondary onClick={() => manual('home')}>Enter Home coordinates</Action></details>
    </>}
    {view === 'list' && <>
      <p>{destinations.length} of {DESTINATION_CAPACITY} destinations · Home has a separate slot.</p>
      {intent==='navigate' && <div className="cw-actions">{onOpenTools&&<Action secondary onClick={onOpenTools}>Toolbox</Action>}{onMyRoutes&&<Action secondary onClick={onMyRoutes}>My Routes</Action>}</div>}
      {home ? <Row label={`Home — ${placeName(home)}`} detail="Confirm destination before starting" onClick={() => resolve(home)} /> : <Row label="Register Home" detail="Set your home entrance" onClick={() => go('home')} />}
      <Action disabled={busy} onClick={() => openSearch(intent === 'manage' ? 'save' : 'navigate')}>{intent === 'manage' ? 'Search and register' : 'Search destination'}</Action>
      <Action secondary disabled={busy || saved.status !== 'ready' || destinations.length >= DESTINATION_CAPACITY} onClick={() => capture('save')}>Register current location</Action>
      <details><summary>Advanced location editing</summary><Action secondary onClick={() => manual('save')}>Enter destination coordinates</Action></details>
      <label className="cw-field">Sort destinations<select value={sort} onChange={e => { const next = e.target.value as 'recent' | 'name'; try { localStorage.setItem('crosswise_places_sort', next); setSort(next); } catch { setError('Could not save the sorting preference.'); } }}><option value="recent">Recently saved</option><option value="name">Name</option></select></label>
      <h2>{all ? 'All destinations' : 'Recently saved'}</h2>
      {!!destinations.length && <Action secondary onClick={() => setShowSavedMap(v => !v)}>{showSavedMap ? 'Show saved destination list' : 'Show saved locations on map'}</Action>}
      {showSavedMap && <>{destinations.some(p => p.point) ? <PlaceMap point={destinations.find(p => p.point)!.point!} title="Saved entrances" markers={destinations.flatMap(p => p.point ? [{point:p.point,title:placeName(p),onSelect:()=>resolve(p)}] : [])} /> : <Notice>No user coordinates saved. Open a provider place to refresh its map location.</Notice>}<p>Map shows saved user entrances. Provider places refresh when opened. The complete destination list remains available below.</p></>}
      {!destinations.length && <Notice>No destinations registered. Search a place or register your current location.</Notice>}
      {(all ? ordered : ordered.slice(0, 3)).map(p => <Row key={p.placeId} label={placeName(p)} detail={p.point ? `User location · ${coordinateText(p.point)}` : 'Saved place · open to refresh details'} disabled={busy} onClick={() => resolve(p)} />)}
      {destinations.length > 3 && <Action secondary onClick={() => setAll(v => !v)}>{all ? 'Show recent three' : `All ${destinations.length} destinations`}</Action>}
    </>}
    {view === 'search' && <>
      <p role="status" aria-atomic="true">{error ? '' : searchStatus}</p>
      <form onSubmit={e => { e.preventDefault(); search(); }}><label className="cw-field">{flow === 'home' ? 'Home address' : 'Place name or address'}<input value={query} onChange={e => setQuery(e.target.value)} maxLength={240} autoComplete="street-address" /></label><button className="cw-action" type="submit" disabled={busy || !query.trim()}>Search</button><Action secondary onClick={() => { setQuery(''); setResults([]); setSearchStatus(''); }}>Clear</Action></form>
      {!results.length && !busy && <p>Include a street or suburb to distinguish places with similar names.</p>}
      <Action secondary disabled={busy} onClick={() => { void run(signal => currentLocation(signal,{allowApproximate:true}), fix => {setSearchOrigin(fix);setResults([]);setSearchStatus('Location updated. Search again for the closest results.');}); }}>Use current location for search</Action>
      {searchOrigin && <p>Search near {coordinateText(searchOrigin)} · accuracy about {Math.round(searchOrigin.accuracy??0)} metres. Distances are straight-line estimates, not walking distances.</p>}
      {!!results.length&&!searchForEntrance&&<PlaceMap point={results[0].point} title="Destination search results" markers={results.map(p=>({point:p.point,title:p.name,onSelect:()=>{setSelected(p);setEntryId(null);setAlias(flow==='home'?'Home':p.name);go('review');}}))}/>}
      {results.map((p, i) => <Row key={p.id} label={`${i + 1}. ${p.name}`} detail={`${p.address}${searchOrigin ? ` · ${Math.round(distanceMeters(searchOrigin,p.point))} metres ${compassDirection(searchOrigin,p.point)}` : ''}`} onClick={() => { if (searchForEntrance) { coordinates(p.point); setSearchForEntrance(false); go('edit'); } else { setSelected(p); setEntryId(null); setAlias(flow === 'home' ? 'Home' : p.name); go('review'); } }} />)}
      {!!results.length && <p>Google Maps</p>}
    </>}
    {view === 'location' && validDraft && <>
      <p>Captured location: {coordinateText(point!)}. Accuracy about {accuracy === null ? 'unknown' : Math.round(accuracy)} metres{capturedAt ? `, measured at ${new Date(capturedAt).toLocaleTimeString()}` : ''}.</p>
      <p>Check that this is the entrance you want to save. The coordinate stays fixed while you choose a name.</p>
      <PlaceMap point={point!} title={flow === 'home' ? 'Home draft' : 'Destination draft'} />
      <Action onClick={() => go('name')}>Use this location</Action><Action secondary disabled={busy} onClick={() => capture(flow)}>Retry location</Action><Action secondary onClick={() => go('edit')}>Adjust entrance</Action><Action secondary onClick={() => openSearch(flow)}>Search address instead</Action>
    </>}
    {(view === 'review' || view === 'detail') && selected && <>
      <h2>{entry ? placeName(entry) : selected.name}</h2><p>{selected.address}</p><p>{selected.endpoint === 'coordinate' ? 'User-selected entrance' : 'Provider location; entrance has not been verified'} · {coordinateText(selected.point)}</p>
      <PlaceMap point={selected.point} title={selected.name} />
      {selected.unavailableReason && <Notice error>{selected.unavailableReason}</Notice>}
      <Action disabled={busy || !!selected.unavailableReason} onClick={() => { void prepare(); }}>Confirm place and review route</Action>
      {!entry && <><label className="cw-field">{flow === 'home' ? 'Home name' : 'Saved name'}<input value={alias} onChange={e => setAlias(e.target.value)} maxLength={160} /></label><Action secondary disabled={busy || saved.status !== 'ready' || !!selected.unavailableReason || !alias.trim()} onClick={saveProvider}>{flow === 'home' ? 'Register as Home' : 'Register destination'}</Action><Action secondary onClick={() => go('search')}>Choose again</Action></>}
      {entry && <><Action secondary onClick={() => { setAlias(placeName(entry)); go('name'); }}>Rename</Action><Action secondary onClick={edit}>Edit location</Action><Action danger onClick={() => setConfirmDelete(true)}>{entry.role === 'home' ? 'Delete Home' : 'Delete destination'}</Action><p>Updated {new Date(entry.updatedAt ?? entry.savedAt).toLocaleString()}</p></>}
      {selected.endpoint !== 'coordinate' && <p>Google Maps</p>}
    </>}
    {view === 'name' && <>
      <label className="cw-field">Destination name<input value={alias} onChange={e => setAlias(e.target.value)} maxLength={160} /></label>
      {!entry && validDraft && <p>Frozen location: {coordinateText(point!)}{accuracy === null ? '' : ` · accuracy about ${Math.round(accuracy)} metres`}</p>}
      <Action disabled={busy || !alias.trim()} onClick={() => { if (entry) void run(async () => repo.rename(entry.placeId, alias), () => acknowledge('Destination renamed.')); else saveDraft(); }}>Save name</Action>
    </>}
    {view === 'edit' && <>
      <p>Choose the public entrance. Moving this pin changes your saved endpoint and does not change the provider's business record.</p>
      <label className="cw-field">Destination name<input value={alias} onChange={e => setAlias(e.target.value)} maxLength={160} /></label>
      <label className="cw-field">Latitude<input inputMode="decimal" type="number" step="any" min={-90} max={90} value={lat} onChange={e => setLat(e.target.value)} /></label>
      <label className="cw-field">Longitude<input inputMode="decimal" type="number" step="any" min={-180} max={180} value={lng} onChange={e => setLng(e.target.value)} /></label>
      {validDraft && <PlaceMap point={point!} title={alias || 'Entrance'} onChange={coordinates} />}
      <label className="cw-field">Move distance<select value={increment} onChange={e => setIncrement(Number(e.target.value))}>{[1,5,10].map(n => <option key={n} value={n}>{n} metres</option>)}</select></label>
      <div className="cw-actions">{[['North',1,0],['South',-1,0],['East',0,1],['West',0,-1]].map(([name,n,e]) => <Action key={name} secondary disabled={!validDraft} onClick={() => nudge(Number(n),Number(e))}>Move {name}</Action>)}</div>
      <p role="status" aria-atomic="true">{entranceStatus}</p>
      <Action secondary disabled={busy} onClick={() => { void run(signal => currentLocation(signal), fix => { coordinates(fix); setAccuracy(fix.accuracy); }); }}>Use current location</Action>
      <Action secondary onClick={() => { setQuery(''); setResults([]); setSearchForEntrance(true); go('search'); }}>Search address instead</Action>
      <Action secondary disabled={!originalPoint} onClick={() => coordinates(originalPoint)}>Reset location</Action>
      {accuracy !== null && <p>GPS accuracy about {Math.round(accuracy)} metres. Decimal precision does not establish accuracy.</p>}
      <Action disabled={busy || !validDraft || !alias.trim() || saved.status !== 'ready'} onClick={saveDraft}>Confirm location</Action>
    </>}
    {view === 'route' && selected && <>
      <h2>{selected.name}</h2>
      {controller.journey.location.value && <p>Origin accuracy about {Math.round(controller.journey.location.value.accuracy ?? 0)} metres. Start rechecks your current location.</p>}
      <fieldset><legend>Route preference</legend>{ROUTE_PREFERENCES.filter(p=>p.supported).map(p => <label key={p.id} className="cw-radio"><input type="radio" name="route-preference" checked={preference === p.id} onChange={() => { try { setRoutePreference(p.id as RoutePreference); void prepare(); } catch { setError('Could not save route preference.'); } }} />{p.label}{p.supported ? '' : ' — standard fallback required'}</label>)}</fieldset>
      {!supportsPreference(preference) && !planner.route && <Notice>This provider cannot verify stairs, covered paths or paths near main roads. A standard route does not apply this preference.</Notice>}
      {!supportsPreference(preference) && !planner.route && <Action disabled={busy} onClick={fallback}>Use standard route</Action>}
      {planner.route && <>
        <p role="status" aria-atomic="true">Route ready. {Math.round(planner.route.distanceMeters)} metres · About {Math.max(1,Math.round(planner.route.durationSeconds / 60))} minutes</p>
        <p>Requested: {ROUTE_PREFERENCES.find(p => p.id === planner.route?.requestedPreference)?.label ?? 'Standard walking route'}. Applied: {planner.route.appliedPreference === 'standard' ? 'Standard route; requested preference unavailable' : `${ROUTE_PREFERENCES.find(p => p.id === planner.route?.appliedPreference)?.label ?? 'Standard'} of available routes`}.</p>
        <PlaceMap point={selected.point} title={selected.name} route={planner.route.points} />
        {!!planner.route.alternatives?.length && <fieldset><legend>Available routes</legend>{[planner.route,...planner.route.alternatives].map((r,i, routes) => <Action key={i} secondary={i !== 0} onClick={() => controller.planner.review(selected,{...r,alternatives:routes.filter((_,j) => i !== j).map(({ alternatives: _alternatives, ...rest }) => rest)})}>Route {i + 1}: {Math.round(r.distanceMeters)} metres, {Math.round(r.durationSeconds/60)} minutes{i === 0 ? ' · selected' : ''}</Action>)}</fieldset>}
        <p>{WALKING_WARNING}</p>{planner.route.warnings.map((w,i) => <p key={i}>{w}</p>)}
        <details><summary>Review all instructions</summary><ol>{planner.route.steps.map((step,i) => <li key={i}>{step.instruction}</li>)}</ol></details>
        {planner.awaitingLongTrip ? <><Notice>This journey is over 1 kilometre. Review the route and your surroundings before proceeding.</Notice><Action disabled={!!planner.busy} onClick={() => { void start(true); }}>Yes, start this longer journey</Action><Action secondary onClick={() => controller.planner.cancel()}>No, cancel start</Action></> : <Action disabled={!!planner.busy || busy} onClick={() => { void start(); }}>Start journey</Action>}
      </>}
      {!planner.route && !planner.busy && supportsPreference(preference) && <Action onClick={() => { void prepare(); }}>Retry route</Action>}
    </>}
    {view === 'ack' && <><Notice>{message}</Notice><Action onClick={base}>OK</Action></>}
    {saved.undo && !confirmDelete && <Action secondary disabled={saved.busy} onClick={() => { void run(async () => repo.undo(), () => acknowledge('Saved place restored.')); }}>Undo delete {placeName(saved.undo)}</Action>}
    {(view === 'search' || selected?.endpoint !== 'coordinate' && (view === 'detail' || view === 'review' || view === 'route')) && <p className="cw-help"><a href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noreferrer">Google Maps terms</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a></p>}
    {confirmDelete && <ConfirmDialog title={`Delete ${entry ? placeName(entry) : 'Home'}?`} confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={() => { const id = entryId; setConfirmDelete(false); if (id) void run(async () => repo.remove(id), () => { setEntryId(null); setSelected(null); acknowledge('Saved place deleted.'); }); }}><p>The active journey keeps its destination. You can undo this deletion.</p></ConfirmDialog>}
    {confirmReplace && <ConfirmDialog title="Replace Home?" confirmLabel="Replace Home" onCancel={() => setConfirmReplace(null)} onConfirm={() => { const commit = confirmReplace; setConfirmReplace(null); commit(); }}><p>Replace {home ? placeName(home) : 'the registered Home'} with {alias || 'this location'}?</p></ConfirmDialog>}
    {discard && <ConfirmDialog title="Discard this draft?" confirmLabel="Discard" onCancel={() => setDiscard(null)} onConfirm={() => { const leave = discard; setDiscard(null); leave(); }}><p>Your previously saved destination remains unchanged.</p></ConfirmDialog>}
  </Page>;
}
