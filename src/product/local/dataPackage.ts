import { validateBackup, type BackupData } from './backup';
import { LOCAL_TOOLS_KEY, validateLocalToolsData, type LocalToolsData } from './routes';
import { RECORDER_SETTINGS_KEY, validateRecorderSettings, type RecorderSettings } from './recorder';

export function mergedLocalTools(current: LocalToolsData, incoming: LocalToolsData, replace: boolean): LocalToolsData {
  return validateLocalToolsData(replace ? incoming : { version: 1,
    routes: [...current.routes, ...incoming.routes.filter(r => !current.routes.some(c => c.id === r.id))],
    areas: [...current.areas, ...incoming.areas.filter(a => !current.areas.some(c => c.id === a.id))],
  });
}
/** A single global restore transaction includes the reviewed local merge, never duplicate unreviewed sections. */
export function combinedLocalBackup(extra: unknown, localTools: LocalToolsData, settings: RecorderSettings | null): BackupData {
  const backup = validateBackup(extra);
  const records = backup.records.filter(r => r.key !== LOCAL_TOOLS_KEY && r.key !== RECORDER_SETTINGS_KEY);
  records.push({ key: LOCAL_TOOLS_KEY, value: JSON.stringify(validateLocalToolsData(localTools)) });
  if (settings) records.push({ key: RECORDER_SETTINGS_KEY, value: JSON.stringify(validateRecorderSettings(settings)) });
  return validateBackup({ ...backup, records });
}
