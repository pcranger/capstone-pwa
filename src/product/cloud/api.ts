import { validateLocalToolsData } from '../local/routes';
import { validateRecorderSettings } from '../local/recorder';
import { parseSavedPlacesV2 } from '../../nav/savedPlaces';
import { validateNearbySettings } from '../../nav/nearby';
import { validateProductPreferences } from '../preferences';
export interface ProductCapabilities { accounts: boolean; photoQuestions: boolean; photoLimit: number; foregroundSharing: boolean; backgroundSharing: boolean; insurance: boolean; payments: boolean; headsetActions: boolean; storageError: boolean; model: string | null }
export interface Account { id: string; email: string; createdAt: number }
export interface AccountStatus { user: Account; photoUsed: number; photoLimit: number }
export interface SavedPhotoAnswer { id:string;question:string;answer:string;createdAt:number }
export interface SharedPosition { latitude: number; longitude: number; accuracy: number; observedAt: number; receivedAt: number; sequence: number }
export interface SharedCheckIn { id: string; message: string; createdAt: number; position: SharedPosition | null }
export interface ShareSession { id: string; label: string; ownerId: string; owner: boolean; ownerEmail: string; expiresAt: number; revokedAt: number | null; viewerCount: number; position: SharedPosition | null; checkIns: SharedCheckIn[]; invite: string | null }
export interface BackupData { version: 1; createdAt: number; records: { key: string; value: string }[] }
export interface CloudBackup { ownerId: string; revision: number; updatedAt: number; data: BackupData }
export class ProductServiceError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function productRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch('/api/product' + path, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(path === '/questions' ? 60000 : 15000) }); }
  catch { throw new ProductServiceError('The service could not be reached. Check your connection and try again.', 0); }
  let data: { error?: string };
  try { data = await response.json(); } catch { throw new ProductServiceError('This server does not provide CrossWise product services. Local tools are still available.', response.status); }
  if (!response.ok) throw new ProductServiceError(data.error ?? 'The service could not complete this request.', response.status);
  return data as T;
}

// Deliberately excludes provider runtime configuration, diagnostics and all video/image data.
export const BACKUP_KEYS = ['crosswise_settings', 'crosswise_product_preferences_v1', 'crosswise_saved_places_v1', 'crosswise_saved_places_v2', 'crosswise_route_preference', 'crosswise_nearby_v1', 'crosswise_local_tools_v1', 'crosswise_recorder_settings_v1'] as const;
interface BackupStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function collectBackup(storage: BackupStorage = localStorage): BackupData {
  const records: BackupData['records'] = [];
  for (const key of BACKUP_KEYS) { const value = storage.getItem(key); if (value !== null) records.push({ key, value }); }
  return validateBackup({ version: 1, createdAt: Date.now(), records });
}
export function validateBackup(value: unknown): BackupData {
  const data = value as BackupData;
  if (!data || data.version !== 1 || !Number.isFinite(data.createdAt) || !Array.isArray(data.records) || data.records.length > BACKUP_KEYS.length) throw new Error('This is not a supported CrossWise backup.');
  const ids = new Set<string>();
  for (const record of data.records) {
    if (!record || !BACKUP_KEYS.includes(record.key as typeof BACKUP_KEYS[number]) || typeof record.value !== 'string' || record.value.length > 500000 || ids.has(record.key)) throw new Error('The backup contains unsupported, duplicate or oversized records.');
    if (record.key === 'crosswise_route_preference') {
      if (!['distance', 'time', 'stairs', 'covered', 'main-roads'].includes(record.value)) throw new Error('The backup has an invalid route preference.');
    } else {
      let item: unknown; try { item = JSON.parse(record.value); } catch { throw new Error('The backup contains damaged data.'); }
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('The backup contains damaged data.');
      validateRecord(record.key, item as Record<string, unknown>);
    }
    ids.add(record.key);
  }
  if (JSON.stringify(data).length > 650000) throw new Error('This backup is too large. Export routes separately.');
  return { version: 1, createdAt: data.createdAt, records: data.records.map(r => ({ key: r.key, value: normalizeSection(r.key, r.value) })) };
}
function normalizeSection(key:string,value:string):string {
  if(key==='crosswise_route_preference')return value;
  const item=JSON.parse(value);
  if(key==='crosswise_local_tools_v1')return JSON.stringify(validateLocalToolsData(item));
  if(key==='crosswise_recorder_settings_v1')return JSON.stringify(validateRecorderSettings(item));
  if(key==='crosswise_saved_places_v2')return JSON.stringify({version:2,items:parseSavedPlacesV2(item)});
  if(key==='crosswise_nearby_v1'){if(!validateNearbySettings(item))throw new Error('Invalid nearby settings backup.');return JSON.stringify({radius:item.radius,enabled:[...new Set(item.enabled)]});}
  if(key==='crosswise_product_preferences_v1')return JSON.stringify(validateProductPreferences(item));
  return value;
}
function validateRecord(key: string, item: Record<string, unknown>): void {
  const invalid = () => { throw new Error(`Invalid ${key.replace('crosswise_', '').replace(/_/g, ' ')} backup section.`); };
  const point = (value: unknown): boolean => { const p = value as { latitude?: number; longitude?: number }; return !!p && typeof p.latitude === 'number' && typeof p.longitude === 'number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180; };
  if(key==='crosswise_local_tools_v1'){validateLocalToolsData(item);return;}
  if(key==='crosswise_recorder_settings_v1'){validateRecorderSettings(item);return;}
  if(key==='crosswise_nearby_v1'){if(!validateNearbySettings(item))invalid();return;}
  if (key.startsWith('crosswise_saved_places_')) {
    if (item.version !== (key.endsWith('v2') ? 2 : 1) || !Array.isArray(item.items) || item.items.length > 1000) invalid();
    const ids = new Set<string>(); let homes = 0;
    for (const entry of item.items as Record<string, unknown>[]) {
      if (!entry || typeof entry.placeId !== 'string' || !entry.placeId || entry.placeId.length > 512 || ids.has(entry.placeId) || typeof entry.savedAt !== 'number' || !Number.isFinite(entry.savedAt) || entry.savedAt < 0 || (entry.alias !== undefined && (typeof entry.alias !== 'string' || entry.alias.length > 160)) || (entry.queryLabel !== undefined && (typeof entry.queryLabel !== 'string' || entry.queryLabel.length > 160)) || (entry.kind !== undefined && !['coordinate', 'provider'].includes(String(entry.kind))) || (entry.role !== undefined && !['home', 'destination'].includes(String(entry.role))) || (entry.point !== undefined && !point(entry.point)) || entry.kind === 'coordinate' && !entry.point || entry.role === 'home' && ++homes > 1) invalid();
      ids.add(entry.placeId as string);
    }
  } else if (key === 'crosswise_nearby_v1') {
    if (![0, 30, 50, 100, 150, 200, 250, 300, 400, 500].includes(Number(item.radius)) || !Array.isArray(item.enabled) || item.enabled.some(id => typeof id !== 'string' || id.length > 100)) invalid();
  } else if (key === 'crosswise_product_preferences_v1') {
    if (item.version !== 1 || typeof item.autoStroll !== 'boolean' || !['front', 'sides'].includes(String(item.objectRange)) || !item.objects || typeof item.objects !== 'object' || Object.values(item.objects).some(v => typeof v !== 'boolean') || typeof item.readerFriendly !== 'boolean' || !['system', 'large', 'extra'].includes(String(item.textSize)) || typeof item.mono !== 'boolean' || item.termsVersion !== null && typeof item.termsVersion !== 'string') invalid();
  } else if (key === 'crosswise_local_tools_v1') {
    if (item.version !== 1 || !Array.isArray(item.routes) || item.routes.length > 100 || !Array.isArray(item.areas) || item.areas.length > 20) invalid();
    const waypoint = (v: Record<string, unknown>) => { if (!point(v) || typeof v.id !== 'string' || typeof v.label !== 'string' || typeof v.note !== 'string' || v.label.length > 160 || v.note.length > 1000) invalid(); };
    const route = (r: Record<string, unknown>) => { if (!r || typeof r.id !== 'string' || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 160 || !Array.isArray(r.waypoints) || r.waypoints.length < 2 || r.waypoints.length > 100 || typeof r.updatedAt !== 'number' || !Number.isFinite(r.updatedAt)) invalid(); (r.waypoints as Record<string, unknown>[]).forEach(waypoint); };
    (item.routes as Record<string, unknown>[]).forEach(route);
    for (const area of item.areas as Record<string, unknown>[]) { if (!area || typeof area.id !== 'string' || typeof area.name !== 'string' || typeof area.region !== 'string' || typeof area.source !== 'string' || typeof area.version !== 'string' || !Array.isArray(area.routes) || !Array.isArray(area.landmarks)) invalid(); (area.routes as Record<string, unknown>[]).forEach(route); (area.landmarks as Record<string, unknown>[]).forEach(waypoint); }
  } else if (key === 'crosswise_recorder_settings_v1') {
    if (typeof item.enabled !== 'boolean' || typeof item.autoStart !== 'boolean' || typeof item.includeAudio !== 'boolean' || ![1, 3, 5].includes(Number(item.clipMinutes)) || !Number.isInteger(item.maxClips) || Number(item.maxClips) < 1 || Number(item.maxClips) > 100 || !Number.isFinite(item.maxBytes) || Number(item.maxBytes) < 10000000 || Number(item.maxBytes) > 10000000000) invalid();
  } else if (key === 'crosswise_settings') {
    const booleans = ['speech', 'tones', 'haptics', 'aimSonar', 'veerGuidance', 'vehicleAlerts', 'autoDetectCrossing', 'useGpu', 'showPreview', 'showOverlay', 'showMovingVehicles', 'showStationaryVehicles', 'logSessions', 'showWarnings', 'showStatusIcons', 'showModelLine', 'geminiEnabled', 'largeStatus', 'acceptedSafetyNotice'];
    for (const [name, value] of Object.entries(item)) {
      if (booleans.includes(name)) { if (typeof value !== 'boolean') invalid(); }
      else if (name === 'speechRate') { if (typeof value !== 'number' || value < 0.6 || value > 2) invalid(); }
      else if (name === 'scoreThreshold') { if (typeof value !== 'number' || value < 0.2 || value > 0.7) invalid(); }
      else if (name === 'interfaceMode') { if (!['USER', 'DEVELOPER'].includes(String(value))) invalid(); }
      else if (name === 'verbosity') { if (!['MINIMAL', 'NORMAL', 'DETAILED', 0, 1, 2].includes(value as string | number)) invalid(); }
      else if (name === 'appFont') { if (!['MODERN', 'CLASSIC', 'HYPERLEGIBLE'].includes(String(value))) invalid(); }
      else if (name === 'customModelPath') { if (value !== null && (typeof value !== 'string' || value.length > 512)) invalid(); }
      else invalid();
    }
  }
}
export function backupChanges(data: BackupData, storage: BackupStorage = localStorage): string[] { return validateBackup(data).records.filter(r => storage.getItem(r.key) !== r.value).map(r => r.key); }
export function restoreBackup(data: BackupData, storage: BackupStorage = localStorage): void {
  const records = validateBackup(data).records, previous = records.map(r => ({ key: r.key, value: storage.getItem(r.key) }));
  try { for (const r of records) storage.setItem(r.key, r.value); }
  catch { for (const r of previous) try { if (r.value === null) storage.removeItem(r.key); else storage.setItem(r.key, r.value); } catch { /* The original values remain in the downloaded pre-restore export. */ } throw new Error('Restore could not finish. Existing values were restored where device storage allowed. Export your data before retrying.'); }
}
export function downloadFile(name: string, data: Blob): void { const url = URL.createObjectURL(data), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export async function imageFile(file: File): Promise<{ image: string; mimeType: string; preview: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4_000_000 || !file.size) throw new Error('Choose a JPEG, PNG or WebP image under 4 MB.');
  const preview = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(file); });
  return { image: preview.slice(preview.indexOf(',') + 1), mimeType: file.type, preview };
}
/** Reuse the sole running camera. Never acquire another media stream for still photos. */
export function captureExistingCamera(): { image: string; mimeType: string; preview: string } {
  const video = Array.from(document.querySelectorAll('video')).find(v => v.readyState >= 2 && v.videoWidth > 0 && v.srcObject);
  if (!video) throw new Error('No active camera frame is available. Start Stroll first, or choose a photo from your device.');
  const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight)), canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d'); if (!context) throw new Error('Photo capture is unavailable in this browser. Choose a photo instead.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height); const preview = canvas.toDataURL('image/jpeg', 0.82);
  return { image: preview.slice(preview.indexOf(',') + 1), mimeType: 'image/jpeg', preview };
}
