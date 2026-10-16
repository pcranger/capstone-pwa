import {chromium,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.argv[2]??'https://capstone-pwa.fly.dev',baseline=process.argv.includes('--baseline');
const prefix=baseline?'baseline-dev':'release-main';
const browser=await chromium.launch({channel:'chrome',headless:true});
let page;
try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:-34.4274,longitude:150.8887,accuracy:5}});
 await context.addInitScript(()=>{
  Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});
  Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted',addEventListener(){},removeEventListener(){}})},configurable:true});
  if(window.DeviceOrientationEvent)Object.defineProperty(window.DeviceOrientationEvent,'requestPermission',{value:undefined,configurable:true});
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');let frame=0;
   const draw=()=>{ctx.fillStyle=frame++%2?'#164c79':'#4088b0';ctx.fillRect(0,0,640,360);requestAnimationFrame(draw);};draw();return canvas.captureStream(20);
  };
 });
 page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Google Maps JavaScript API error/.test(m.text()))errors.push('Google Maps configuration error');});
 const sw=await(await context.request.get(base+'/sw.js')).text();
 if(baseline){const record=JSON.parse(await readFile('artifacts/dev-baseline.json','utf8'));expect(sw).toContain('capstone-pwa-'+record.revision);}
 else expect(sw).toBe(await readFile('dist/sw.js','utf8'));
 expect((await context.request.get(base+'/healthz')).ok()).toBe(true);
 await page.goto(base);await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 if(baseline){
  await expect(page.getByRole('heading',{name:'Set up permissions',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Enable all available permissions',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue to CrossWise',exact:true}).click();
 }else{
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
  await expect(page.getByRole('region',{name:'Set up permissions',exact:true})).toHaveCount(0);
 }
 await expect(page.getByRole('button',{name:baseline?'Stroll':'Road crossing',exact:true})).toBeVisible();
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/${prefix}-home.png`});
 const route=async()=>{
  await page.getByRole('button',{name:'Route guidance',exact:true}).click();await page.getByRole('button',{name:'Search destination',exact:true}).click();
  await page.getByLabel('Place name or address',{exact:true}).fill('Wollongong Hospital NSW');await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.getByRole('button',{name:/^1\. Wollongong Hospital/}).click({timeout:30000});
  await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start journey',exact:true})).toBeVisible({timeout:30000});
 };
 await route();
 if(!baseline){
  const map=page.locator('[data-map-zoom]');
  await expect(map).toHaveAttribute('data-map-zoom','17');
  await map.scrollIntoViewIfNeeded();
  await expect.poll(()=>map.locator('img').evaluateAll(images=>images.some(image=>image.complete&&image.naturalWidth>=256)),{timeout:30000}).toBe(true);
  // Allow Google to composite the loaded tiles before capturing the visual check.
  await page.waitForTimeout(2000);
  await map.screenshot({path:`artifacts/${prefix}-hospital-map.png`});
 }
 await page.screenshot({path:`artifacts/${prefix}-hospital-route.png`});
 console.log(`PASS ${prefix}: exact build, first-open permissions, Hospital walking route and map.`);
 if(!baseline){
  await page.reload();await context.setGeolocation({latitude:-33.8731,longitude:151.2065,accuracy:5});await route();
  await expect(page.getByText(/Some mapped sections have no written turn instructions/)).toBeVisible();
  await page.getByText('Review all instructions',{exact:true}).click();await expect(page.getByText(/No written turn instruction supplied/).first()).toBeVisible();
  console.log('PASS main: long Hospital route keeps provider geometry and labels missing instructions.');
  await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('switch',{name:'Developer camera view',exact:false}).check();await page.getByRole('button',{name:'‹ Back',exact:true}).click();
  await page.getByRole('button',{name:'Road crossing',exact:true}).click();
  await expect(page.getByTestId('camera-indicators')).toBeVisible();
  await expect(page.getByRole('button',{name:'Open diagnostics',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Allow camera',exact:true}).click();
  await expect.poll(async()=>Number(await page.locator('canvas[data-camera-renderer]').getAttribute('data-rendered-frames')),{timeout:45000}).toBeGreaterThan(0);
  await expect(page.getByTestId('camera-notification')).toHaveCount(0,{timeout:30000});
  await expect(page.getByTestId('camera-indicators')).toHaveText(/^[\d—]+$/);
  expect((await page.getByTestId('camera-indicators').boundingBox()).height).toBeLessThanOrEqual(40);
  await page.screenshot({path:`artifacts/${prefix}-crossing.png`});
  await page.getByRole('button',{name:'Home',exact:true}).click();
 }
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);await page.reload();await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
 expect(errors).toEqual([]);console.log(`PASS ${prefix}: offline reload and no uncaught or map-configuration errors.`);
}catch(error){if(page)await page.screenshot({path:`artifacts/${prefix}-failure.png`});throw error;}finally{await browser.close();}
