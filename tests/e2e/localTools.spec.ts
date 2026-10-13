import { test, expect, type Page } from '@playwright/test';

async function home(page: Page) {
  await page.goto('/');
  const agree = page.getByRole('button', { name: 'Agree and continue', exact: true });
  await expect(agree.or(page.getByRole('heading', { name: 'CrossWise', exact: true }))).toBeVisible();
  if (await agree.isVisible()) await agree.click();
  await expect(page.getByRole('heading', { name: 'CrossWise', exact: true })).toBeVisible();
}
async function tool(page: Page, name: string) {
  await page.getByRole('button', { name: 'More tools', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}
async function addWaypoint(page: Page, label: string, latitude: string, longitude: string, note: string) {
  await page.getByRole('button', { name: 'Add waypoint', exact: true }).click();
  await page.getByLabel('Waypoint name', { exact: true }).fill(label);
  await page.getByLabel('Latitude', { exact: true }).fill(latitude);
  await page.getByLabel('Longitude', { exact: true }).fill(longitude);
  await page.getByLabel('Spoken note (optional)', { exact: true }).fill(note);
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click();
}
async function createRoute(page: Page) {
  await page.getByRole('button', { name: 'Create My Route', exact: true }).click();
  await page.getByLabel('Route name', { exact: true }).fill('Gate to library');
  await addWaypoint(page, 'Pedestrian gate', '-33.86', '151.2', 'Use the pedestrian entrance.');
  await addWaypoint(page, 'Library door', '-33.8601', '151.2001', 'Entrance is on your right.');
  await page.getByRole('button', { name: 'Save My Route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Route preview', exact: true })).toBeVisible();
}

test('local My Routes supports authored points, order, undo, persistence, reverse review and deletion', async ({ page }) => {
  await home(page); await tool(page, 'My Routes'); await createRoute(page);
  await expect(page.getByText('Spoken note: Entrance is on your right.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit My Route', exact: true }).click();
  await page.getByRole('button', { name: 'Move Library door up', exact: true }).click();
  await expect(page.locator('ol li').first()).toContainText('Library door');
  await page.getByRole('button', { name: 'Undo waypoint change', exact: true }).click();
  await expect(page.locator('ol li').first()).toContainText('Pedestrian gate');
  await page.getByRole('button', { name: 'Save My Route', exact: true }).click();
  await page.getByRole('button', { name: 'Reverse into new draft', exact: true }).click();
  await expect(page.locator('ol li').first()).toContainText('Library door');
  await expect(page.getByText('Entrance is on your right.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click();
  // An unchanged reversed draft can return directly; edited drafts require discard confirmation.
  if (await page.getByRole('button', { name: 'Discard changes', exact: true }).isVisible()) await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.reload(); await tool(page, 'My Routes');
  await page.getByRole('button', { name: 'Open Gate to library', exact: true }).click();
  await page.getByRole('button', { name: 'Delete route', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Route preview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete route', exact: true }).click();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete route', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete route', exact: true }).click();
  await expect(page.getByText('No My Routes yet.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('local imports preview valid content, merge collisions and reject malformed coordinates', async ({ page }) => {
  await home(page); await tool(page, 'My Routes');
  await page.getByRole('button', { name: 'Import routes', exact: true }).click();
  const route = { id: 'import-route', name: 'Imported campus walk', updatedAt: 1, waypoints: [
    { id: 'a', label: 'Gate', latitude: -33.86, longitude: 151.2, note: 'Pedestrian entrance' },
    { id: 'b', label: 'Door', latitude: -33.8601, longitude: 151.2001, note: '' },
  ] };
  const file = (value: unknown) => ({ name: 'routes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.getByLabel('CrossWise JSON file', { exact: true }).setInputFiles(file({ version: 1, routes: [{ ...route, waypoints: route.waypoints.map(p => ({ ...p, latitude: 999 })) }], areas: [] }));
  await expect(page.getByRole('alert')).toContainText('valid latitude');
  await expect(page.getByRole('button', { name: 'Import and merge data', exact: true })).toHaveCount(0);
  await page.getByLabel('CrossWise JSON file', { exact: true }).setInputFiles(file({ version: 1, routes: [route], areas: [] }));
  await expect(page.getByRole('heading', { name: 'Import preview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import and merge data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Imported campus walk', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import routes', exact: true }).click();
  await page.getByLabel('CrossWise JSON file', { exact: true }).setInputFiles(file({ version: 1, routes: [{ ...route, name: 'Collision replacement' }], areas: [] }));
  await expect(page.getByText('1 route identifier conflicts.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Import and merge data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Imported campus walk', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Collision replacement', exact: true })).toHaveCount(0);
});

test('local area pack authoring installs landmarks, persists and removes with confirmation', async ({ page }) => {
  await home(page); await tool(page, 'Special areas');
  await page.getByRole('button', { name: 'Create pilot area pack', exact: true }).click();
  await page.getByLabel('Area name', { exact: true }).fill('Campus pilot');
  await page.getByLabel('Region', { exact: true }).fill('Sydney campus');
  await page.getByRole('button', { name: 'Add area landmark', exact: true }).click();
  await page.getByLabel('Waypoint name', { exact: true }).fill('Reception entrance');
  await page.getByLabel('Latitude', { exact: true }).fill('-33.86');
  await page.getByLabel('Longitude', { exact: true }).fill('151.2');
  await page.getByLabel('Spoken note (optional)', { exact: true }).fill('User-reviewed entrance beside pedestrian path.');
  await page.getByRole('button', { name: 'Save waypoint', exact: true }).click();
  await page.getByRole('button', { name: 'Save area pack', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Special-area pack', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reception entrance', exact: true })).toBeVisible();
  await page.reload(); await tool(page, 'Special areas');
  await page.getByRole('button', { name: 'Open Campus pilot', exact: true }).click();
  await page.getByRole('button', { name: 'Remove area pack', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm remove pack', exact: true }).click();
  await expect(page.getByText('No area packs installed.', { exact: true })).toBeVisible();
});

test('local recorder uses actual MediaRecorder, persists playable protected video and exports it', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Real fake-camera capture is configured for Chromium; WebKit capability/error states are tested separately.');
  await page.addInitScript(() => {
    // Supply real animated frames to the browser's real MediaRecorder. This avoids Windows
    // capture-service failures while still testing actual encoding, Blobs and IndexedDB.
    const fixture = { requests: 0 }; (window as unknown as { recordingFixture: typeof fixture }).recordingFixture = fixture;
    navigator.mediaDevices.getUserMedia = async () => {
      fixture.requests++;
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const context = canvas.getContext('2d')!; let frame = 0;
      const paint = () => { context.fillStyle = frame++ % 2 ? '#164c79' : '#4088b0'; context.fillRect(0, 0, 640, 360); context.fillStyle = '#fff'; context.fillText(`Walking video fixture ${frame}`, 20, 40); };
      paint(); setInterval(paint, 50);
      return canvas.captureStream(20);
    };
  });
  await home(page); await tool(page, 'Recordings');
  await page.getByRole('button', { name: 'Recorder settings', exact: true }).click();
  await page.getByLabel('Enable walking recorder', { exact: true }).check();
  await page.getByLabel('Maximum rolling clips', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: '‹ Back', exact: true }).click();
  await page.getByRole('button', { name: 'Enable shared camera', exact: true }).click();
  await expect(page.getByText('Camera is ready for recording.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recorder: recording' })).toBeVisible();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Protect current clip', exact: true }).click();
  await page.getByRole('button', { name: 'Pause recording', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recorder: paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume recording', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recorder: idle' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { recordingFixture: { requests: number } }).recordingFixture.requests)).toBe(1);
  // Finalize six actual clips against a five-clip limit, with the oldest clip protected.
  for (let clip = 0; clip < 5; clip++) {
    await page.getByRole('button', { name: 'Start recording', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Recorder: recording' })).toBeVisible();
    await page.waitForTimeout(350);
    await page.getByRole('button', { name: 'Stop and save recording', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Recorder: idle' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Recording library', exact: true }).click();
  await expect(page.getByText('5 clips ·', { exact: false })).toBeVisible();
  await page.getByLabel('Show protected clips only', { exact: true }).check();
  await expect(page.getByText('· Protected', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Play recording / }).click();
  await expect(page.getByLabel('Recorded walking video', { exact: true })).toBeVisible();
  await expect.poll(() => page.getByLabel('Recorded walking video', { exact: true }).evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export video file', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^CrossWise_.*\.(webm|mp4)$/);
  await page.reload(); await tool(page, 'Recordings'); await page.getByRole('button', { name: 'Recording library', exact: true }).click();
  await expect(page.getByText('· Protected', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Delete all recordings', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('includes protected clips');
  await page.getByRole('button', { name: 'Confirm delete recordings', exact: true }).click();
  await expect(page.getByText('No saved recordings.', { exact: false })).toBeVisible();
});

test('local data deletion requires typed scope and can be canceled with Escape', async ({ page }) => {
  await home(page); await tool(page, 'My Routes'); await createRoute(page);
  await page.reload(); await tool(page, 'Data management');
  await page.getByRole('button', { name: 'Delete all My Routes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm local deletion', exact: true }).click();
  await expect(page.getByText('Type DELETE before confirming local deletion.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Local authored routes: 1.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Delete all My Routes', exact: true }).click();
  await page.getByLabel('Type DELETE', { exact: true }).fill('DELETE');
  await page.getByRole('button', { name: 'Confirm local deletion', exact: true }).click();
  await expect(page.getByText('Local authored routes: 0.', { exact: false })).toBeVisible();
});

test('local browser Back preserves waypoint and route drafts until explicit discard', async ({ page }) => {
  await home(page); await tool(page, 'My Routes');
  await page.getByRole('button', { name: 'Create My Route', exact: true }).click();
  await page.getByLabel('Route name', { exact: true }).fill('Unsaved walk');
  await page.getByRole('button', { name: 'Add waypoint', exact: true }).click();
  await page.getByLabel('Waypoint name', { exact: true }).fill('Unsaved gate');
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('Discard waypoint changes?');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Waypoint name', { exact: true })).toHaveValue('Unsaved gate');
  await page.getByRole('button', { name: 'Cancel waypoint', exact: true }).click();
  await page.getByRole('button', { name: 'Discard waypoint changes', exact: true }).click();
  await expect(page.getByLabel('Route name', { exact: true })).toHaveValue('Unsaved walk');
  await page.goBack();
  await expect(page.getByRole('dialog')).toContainText('Discard route changes?');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Routes', exact: true })).toBeVisible();
});

test('local global data mutation is blocked during an authored navigation journey', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -33.86, longitude: 151.2, accuracy: 5 });
  await page.addInitScript(() => {
    const position = () => ({ coords: { latitude: -33.86, longitude: 151.2, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() }) as GeolocationPosition;
    // Windows WebKit emulates a microsecond timestamp; use the standard millisecond fix.
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (success: PositionCallback) => success(position()),
      watchPosition: (success: PositionCallback) => { success(position()); return 1; }, clearWatch: () => undefined,
    } });
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await home(page); await tool(page, 'My Routes'); await createRoute(page);
  await page.getByRole('button', { name: 'Start My Route', exact: true }).click();
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: 'Data management', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import local backup', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete all My Routes', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete all local application data', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export local backup', exact: true })).toBeEnabled();
});

test('local full backup merge preserves existing routes and commits reviewed global sections', async ({ page }) => {
  await home(page); await tool(page, 'My Routes'); await createRoute(page);
  await page.reload(); await tool(page, 'Data management');
  await page.getByRole('button', { name: 'Import local backup', exact: true }).click();
  const incoming = { version: 1, routes: [{ id: 'backup-new', name: 'Imported backup walk', updatedAt: 1, waypoints: [
    { id: 'p1', label: 'Park gate', latitude: -33.87, longitude: 151.2, note: '' }, { id: 'p2', label: 'Park exit', latitude: -33.8701, longitude: 151.2001, note: '' },
  ] }], areas: [] };
  const recorder = { enabled: false, autoStart: false, includeAudio: false, clipMinutes: 5, maxClips: 50, maxBytes: 2_500_000_000 };
  const backup = { kind: 'crosswise-local-backup', version: 1, exportedAt: Date.now(), localTools: incoming, recorderSettings: recorder,
    extra: { version: 1, createdAt: Date.now(), records: [{ key: 'crosswise_local_tools_v1', value: JSON.stringify(incoming) }, { key: 'crosswise_recorder_settings_v1', value: JSON.stringify({ ...recorder, enabled: true }) }, { key: 'crosswise_route_preference', value: 'time' }] } };
  await page.getByLabel('CrossWise JSON file', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Import and merge data', exact: true }).click();
  await expect(page.getByText('Local authored routes: 2.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('crosswise_route_preference'))).toBe('time');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('crosswise_recorder_settings_v1')!).enabled)).toBe(false);
  await page.reload(); await tool(page, 'My Routes');
  await expect(page.getByRole('button', { name: 'Open Gate to library', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Imported backup walk', exact: true })).toBeVisible();
});

test('local all-data reset clears global preferences and diagnostics as well as owned route data', async ({ page }) => {
  await home(page); await tool(page, 'My Routes'); await createRoute(page);
  await page.evaluate(() => {
    localStorage.setItem('crosswise_route_preference', 'stairs');
    localStorage.setItem('crosswise_csv_sessions', JSON.stringify([{ name: 'test.csv', csv: 'elapsed_ms,mode\n0,IDLE\n' }]));
    localStorage.setItem('crosswise_saved_places_v1', JSON.stringify({ version: 1, items: [{ placeId: 'legacy-test', savedAt: 1, alias: 'Library' }] }));
  });
  await page.reload(); await tool(page, 'Data management');
  await page.getByRole('button', { name: 'Delete all local application data', exact: true }).click();
  await page.getByLabel('Type DELETE', { exact: true }).fill('DELETE');
  await page.getByRole('button', { name: 'Confirm local deletion', exact: true }).click();
  await expect(page.getByText('Local authored routes: 0.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('crosswise_route_preference'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('crosswise_csv_sessions'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('crosswise_saved_places_v1'))).toBeNull();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Welcome to CrossWise', exact: true })).toBeVisible();
});

test('local recorder unsupported capability keeps library accessible without a fake record action', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true }); });
  await home(page); await tool(page, 'Recordings');
  await expect(page.getByText('Video recording is unavailable in this browser.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start recording', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Recording library', exact: true }).click();
  await expect(page.getByText('No saved recordings.', { exact: false })).toBeVisible();
});
