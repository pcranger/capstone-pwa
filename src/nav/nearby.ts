import { Store } from '../state/store';
import { bearing, distanceMeters, searchNearbyPlaces, usableFix, type GeoPoint, type LocationFix, type PlaceCandidate } from './navigation';
import { services } from '../config/services';
export const NEARBY_RADII = [0, 30, 50, 100, 150, 200, 250, 300, 400, 500] as const;
const child = (id: string, label: string, types: string[]) => ({ id, label, types });
export const NEARBY_GENRES = [
  { id: 'dining', label: 'Dining', children: [child('dining-fast','Fast food',['fast_food_restaurant']),child('dining-family','Family restaurants',['family_restaurant']),child('dining-ramen','Ramen',['ramen_restaurant']),child('dining-other','Other dining',['restaurant','cafe','coffee_shop','bakery'])] },
  { id: 'shopping', label: 'Shopping', children: [child('shopping-convenience','Convenience stores',['convenience_store']),child('shopping-supermarkets','Supermarkets',['supermarket']),child('shopping-centres','Shopping centres',['shopping_mall']),child('shopping-other','Other shops',['store'])] },
  { id: 'transport', label: 'Transport and cars', children: [child('transport-stations','Stations and stops',['train_station','bus_station','bus_stop','subway_station','light_rail_station','tram_stop','ferry_terminal','transit_station']),child('transport-parking','Parking',['parking']),child('transport-fuel','Fuel',['gas_station']),child('transport-services','Vehicle services',['car_repair'])] },
  { id: 'health', label: 'Health', children: [child('health-hospitals','Hospitals',['hospital']),child('health-clinics','Clinics',['doctor']),child('health-pharmacies','Pharmacies',['pharmacy']),child('health-dental','Dental',['dentist'])] },
  { id: 'public', label: 'Public offices', children: [child('public-offices','Government offices',['local_government_office']),child('public-post','Post offices',['post_office']),child('public-police','Police',['police']),child('public-library','Libraries',['library'])] },
  { id: 'finance', label: 'Finance', children: [child('finance-banks','Banks',['bank']),child('finance-atms','ATMs',['atm'])] },
  { id: 'recreation', label: 'Recreation and culture', children: [child('recreation-parks','Parks',['park']),child('recreation-museums','Museums',['museum']),child('recreation-sports','Sports',['sports_complex']),child('recreation-attractions','Visitor attractions',['tourist_attraction'])] },
  { id: 'accommodation', label: 'Accommodation', children: [child('accommodation-hotels','Hotels',['hotel']),child('accommodation-other','Other lodging',['lodging'])] },
  { id: 'everyday', label: 'Everyday services', children: [child('everyday-toilets','Toilets',['public_bathroom']),child('everyday-laundries','Laundries',['laundry']),child('everyday-personal','Personal services',['hair_salon']),child('everyday-other','Other useful places',[])] },
];
export interface NearbySettings { radius: number; enabled: string[] }
export const NEARBY_KEY = 'crosswise_nearby_v1';
const all = NEARBY_GENRES.flatMap(g => g.children);
export function validateNearbySettings(value: unknown): value is NearbySettings {
  const s = value as NearbySettings; return !!s && NEARBY_RADII.includes(s.radius as typeof NEARBY_RADII[number]) && Array.isArray(s.enabled) && s.enabled.every(id => all.some(c => c.id === id));
}
function initial(): NearbySettings {
  try { const s: unknown = JSON.parse(localStorage.getItem(NEARBY_KEY) ?? 'null'); if (validateNearbySettings(s)) return { radius: s.radius, enabled: [...new Set(s.enabled)] }; } catch { /* Local use remains available. */ }
  return { radius: 100, enabled: all.filter(c => c.types.length).map(c => c.id) };
}
export const nearbySettings = new Store<NearbySettings>(initial());
export function reloadNearbySettings(): void { nearbySettings.set(initial()); }
export function setNearbySettings(patch: Partial<NearbySettings>): void {
  const next = { ...nearbySettings.value, ...patch }; if (!validateNearbySettings(next)) throw new Error('Invalid nearby settings.');
  next.enabled = [...new Set(next.enabled)]; localStorage.setItem(NEARBY_KEY, JSON.stringify(next)); nearbySettings.set(next);
}
export interface NearbyPlace extends PlaceCandidate { distance: number; direction: string; types: string[] }
export function compassDirection(from: GeoPoint, to: GeoPoint): string { return ['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(bearing(from, to) / 45) % 8]; }
export function filterNearby(places: (PlaceCandidate & { types: string[] })[], from: GeoPoint, settings: NearbySettings): NearbyPlace[] {
  const enabled = all.filter(c => settings.enabled.includes(c.id)); const seen = new Set<string>();
  return places.flatMap(p => {
    const distance = distanceMeters(from, p.point);
    const matches = enabled.some(c => c.types.some(t => p.types.includes(t)) && !(c.id === 'dining-other' && p.types.some(t => ['fast_food_restaurant','family_restaurant','ramen_restaurant'].includes(t))) && !(c.id === 'accommodation-other' && p.types.includes('hotel')) && !(c.id === 'shopping-other' && p.types.some(t => ['convenience_store','supermarket','shopping_mall'].includes(t))));
    if (seen.has(p.id) || distance > settings.radius || !matches) return [];
    seen.add(p.id); return [{ ...p, distance, direction: compassDirection(from, p.point) }];
  }).sort((a, b) => a.distance - b.distance);
}
export async function nearbyPlaces(fix: LocationFix, settings = nearbySettings.value, signal?: AbortSignal): Promise<NearbyPlace[]> {
  if (!settings.radius || !settings.enabled.length) return [];
  if (!usableFix(fix, Date.now())) throw new Error('Location is not accurate enough. Retry in an open area.');
  const types = [...new Set(all.filter(c => settings.enabled.includes(c.id)).flatMap(c => c.types))];
  if (!types.length) return [];
  if (!services.mapsRestApiKey) throw new Error('Nearby facilities are not configured in this build. Saved places and camera assistance remain available.');
  const places = await searchNearbyPlaces(fix, settings.radius, types, services.mapsRestApiKey, signal);
  return filterNearby(places, fix, settings);
}
/** Foreground walking reader. No timer, background tracking or repeated business announcements. */
export class NearbyReader {
  private last: { point: GeoPoint; at: number; settings: string; success: boolean } | null = null;
  private generation = 0; private request: AbortController | null = null; private announced = new Set<string>();
  constructor(private announce: (text: string) => void, private query = nearbyPlaces, private now = Date.now) {}
  stop(): void { ++this.generation; this.request?.abort(); this.request = null; }
  reset(): void { this.stop(); this.last = null; this.announced.clear(); }
  async update(fix: LocationFix, settings = nearbySettings.value): Promise<NearbyPlace[]> {
    if (!settings.radius || !settings.enabled.length || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) { this.stop(); return []; }
    const key = JSON.stringify(settings), time = this.now();
    if (!usableFix(fix,time)) return [];
    if (this.last && this.last.settings !== key) this.stop();
    if (this.last && time - this.last.at < 30_000) return [];
    if (this.last && this.last.success && this.last.settings === key && distanceMeters(fix, this.last.point) < Math.max(25, settings.radius / 2)) return [];
    this.stop(); const generation = this.generation; this.request = new AbortController(); this.last = { point: fix, at: time, settings: key, success: false };
    const places = await this.query(fix, settings, this.request.signal);
    if (generation !== this.generation) return [];
    this.last.success = true;
    const unread = places.filter(place => !this.announced.has(place.id)).slice(0, 3);
    if (unread.length) {
      for (const place of unread) this.announced.add(place.id);
      this.announce(unread.map(place => `${place.name}, ${Math.round(place.distance)} metres ${place.direction}.`).join(' '));
    }
    return places;
  }
}
