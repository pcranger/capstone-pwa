import { test, expect } from './fixtures';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

test.describe('real pedestrian model and OCR reference checks', () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true }); });
    await page.goto('/'); await page.getByRole('button', { name: 'Agree and continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'CrossWise', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await page.getByText('Check a reference image', { exact: true }).click();
  });
  for (const fixture of ['street-green', 'countdown', 'button', 'close-green']) test(`${fixture} image uses real local inference and displays bounding boxes`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.text().includes('Pedestrian detector failed') || m.text().includes('Pedestrian worker error')) console.log(m.text()); });
    page.on('requestfailed', r => console.log('Failed request:', r.url(), r.failure()?.errorText));
    await page.getByLabel('Pedestrian reference image', { exact: true }).setInputFiles(resolve(`tests/fixtures/pedestrian/${fixture}.png`));
    await expect(page.getByRole('status')).toHaveText(/Image check complete\.|Pedestrian detection unavailable\.|No supported pedestrian/, { timeout: 90000 });
    await expect(page.getByRole('status')).toHaveText('Image check complete.');
    const result = page.getByTestId('pedestrian-image-result');
    const imageBounds = await result.locator('img').boundingBox(), resultBounds = await result.boundingBox();
    expect(imageBounds!.width).toBeCloseTo(resultBounds!.width, 0); expect(imageBounds!.height).toBeCloseTo(resultBounds!.height, 0);
    if (fixture === 'street-green' || fixture === 'close-green') { await expect(result).toContainText('Green pedestrian'); await expect(result).not.toContainText('Red pedestrian'); await expect(result).not.toContainText('Countdown'); }
    if (fixture === 'countdown') { await expect(result).toContainText('Countdown · 21s'); await expect(result).toContainText('Red pedestrian'); await expect(result).toContainText('Green pedestrian'); }
    if (fixture === 'button') { await expect(result).toContainText('Possible crossing button'); await expect(result).toContainText('Possible press surface'); }
    const boxes = await result.locator('[data-testid^="pedestrian-box-"]').count(); expect(boxes).toBeGreaterThan(0);
    for (const label of await result.getByTestId('pedestrian-box-label').all()) {
      const bounds = await label.boundingBox();
      expect(bounds!.width).toBeCloseTo(Math.min(260, resultBounds!.width - 6), 0);
      expect(bounds!.x).toBeGreaterThanOrEqual(resultBounds!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(resultBounds!.x + resultBounds!.width + 1);
    }
    if (fixture === 'street-green' || fixture === 'countdown') {
      const target = fixture === 'street-green' ? [540 / 1080, 337 / 721] : [880 / 1740, 350 / 1040];
      const box = await (fixture === 'street-green' ? result.getByTestId('pedestrian-box-signal').first() : result.getByTestId('pedestrian-box-countdown').first()).boundingBox();
      const x = resultBounds!.x + target[0] * resultBounds!.width, y = resultBounds!.y + target[1] * resultBounds!.height;
      expect(x).toBeGreaterThan(box!.x); expect(x).toBeLessThan(box!.x + box!.width);
      expect(y).toBeGreaterThan(box!.y); expect(y).toBeLessThan(box!.y + box!.height);
    }
    await mkdir('artifacts/pedestrian', { recursive: true });
    await result.screenshot({ path: `artifacts/pedestrian/${fixture}-${info.project.name}.png` });
    const coordinates = await result.locator('[data-testid^="pedestrian-box-"]').evaluateAll(elements => elements.map(e => ({ kind:e.getAttribute('data-testid'), label:e.textContent, x:(e as HTMLElement).offsetLeft, y:(e as HTMLElement).offsetTop, width:(e as HTMLElement).offsetWidth, height:(e as HTMLElement).offsetHeight })));
    await writeFile(`artifacts/pedestrian/${fixture}-${info.project.name}.json`, JSON.stringify({ fixture, browser: info.project.name, boxes, coordinates, text: await page.locator('details[open]').innerText(), errors }, null, 2));
    expect(errors).toEqual([]);
  });
  test('cached detector and countdown reader work offline', async ({ page, context }) => {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once:true })); });
    await context.setOffline(true);
    await page.getByLabel('Pedestrian reference image', { exact:true }).setInputFiles(resolve('tests/fixtures/pedestrian/countdown.png'));
    await expect(page.getByRole('status')).toHaveText('Image check complete.', { timeout:90000 });
    await expect(page.getByTestId('pedestrian-image-result')).toContainText('Countdown · 21s');
  });
  test('live camera shows pedestrian boxes, blocks start, and preserves an existing crossing across camera loss', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Synthetic captureStream unsupported in this runner; physical iPhone camera remains to be verified.');
    const source = `data:image/png;base64,${(await readFile('tests/fixtures/pedestrian/street-green.png')).toString('base64')}`;
    await page.addInitScript(imageSource => {
      navigator.mediaDevices.getUserMedia = async () => {
        const image = new Image(); image.src = imageSource; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 721;
        const context = canvas.getContext('2d')!;
        const draw = () => { context.drawImage(image,0,0,canvas.width,canvas.height); requestAnimationFrame(draw); }; draw();
        return canvas.captureStream(10);
      };
    }, source);
    await page.reload();
    await page.getByRole('button', { name:'Road crossing',exact:true }).click();
    await page.getByRole('button', { name:'Allow camera',exact:true }).click();
    await expect.poll(async () => { await page.getByRole('button', {name:'Start camera assistance',exact:true}).click(); return page.getByRole('button', {name:'Start crossing',exact:true}).count(); }, {timeout:45000,intervals:[1000]}).toBe(1);
    await expect(page.getByTestId('pedestrian-box-signal').first()).toBeVisible({timeout:45000});
    await mkdir('artifacts/pedestrian', { recursive:true });
    await page.screenshot({path:`artifacts/pedestrian/live-${test.info().project.name}.png`});
    await expect(page.getByRole('button', {name:'Start crossing',exact:true})).toBeDisabled();
    await page.getByRole('button', {name:'Already in the road — get assistance',exact:true}).click();
    await expect(page.getByRole('button', {name:'I’m on the footpath',exact:true})).toBeVisible();
    await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.getByTestId('pedestrian-overlay')).toHaveCount(0);
    await expect(page.getByRole('button', {name:'I’m on the footpath',exact:true})).toBeVisible();
  });
  test('reported red signal survives delayed live results and clears on camera loss',async({page,browserName})=>{
    test.skip(browserName==='webkit','Synthetic captureStream is unavailable in this runner.');
    const source=`data:image/jpeg;base64,${(await readFile('tests/fixtures/pedestrian/reported-red-screen.jpg')).toString('base64')}`;
    await page.addInitScript(imageSource=>{
      const OriginalWorker=window.Worker;
      window.Worker=class extends OriginalWorker {
        set onmessage(handler:((this:Worker,event:MessageEvent)=>unknown)|null){super.onmessage=handler?event=>{if(event.data?.type==='result')setTimeout(()=>handler.call(this,event),1500);else handler.call(this,event);}:null;}
      };
      navigator.mediaDevices.getUserMedia=async()=>{
        const image=new Image();image.src=imageSource;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;
        const draw=()=>{ctx.drawImage(image,0,0);requestAnimationFrame(draw);};draw();return canvas.captureStream(10);
      };
    },source);
    await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('switch',{name:'Developer camera view',exact:false}).check();await page.getByRole('button',{name:'‹ Back',exact:true}).click();
    await expect(page.getByText('Plan your route. Stay informed at the crossing.',{exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Road crossing',exact:true}).click();await page.getByRole('button',{name:'Allow camera',exact:true}).click();
    await expect(page.getByTestId('pedestrian-indicator')).toHaveAttribute('data-signal','red',{timeout:45000});
    await page.screenshot({path:`artifacts/pedestrian/delayed-red-${test.info().project.name}.png`});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.getByTestId('pedestrian-indicator')).toHaveAttribute('data-signal','grey');
    await expect(page.getByTestId('pedestrian-overlay')).toHaveCount(0);
  });
  test.describe('model download recovery', () => {
    test.use({serviceWorkers:'block'});
    test('failed pedestrian model can be retried through the image checker', async ({ page }) => {
      await page.route('**/pedestrian/pedestrian-yolov5.onnx.gz', route => route.fulfill({status:503,body:'Unavailable'}));
      await page.getByLabel('Pedestrian reference image', {exact:true}).setInputFiles(resolve('tests/fixtures/pedestrian/street-green.png'));
      await expect(page.getByRole('status')).toHaveText('Pedestrian detection unavailable.', {timeout:45000});
      await page.unroute('**/pedestrian/pedestrian-yolov5.onnx.gz');
      await page.getByLabel('Pedestrian reference image', {exact:true}).setInputFiles(resolve('tests/fixtures/pedestrian/street-green.png'));
      await expect(page.getByRole('status')).toHaveText('Image check complete.', {timeout:45000});
      await expect(page.getByTestId('pedestrian-image-result')).toContainText('Green pedestrian');
    });
  });
});
