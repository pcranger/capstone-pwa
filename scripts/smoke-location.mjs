import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const base=process.argv[2]??'https://capstone-pwa.fly.dev';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:-34.4274,longitude:150.8887,accuracy:150}});
 await context.addInitScript(()=>{
  Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});
  Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted'})},configurable:true});
  if(window.DeviceOrientationEvent)Object.defineProperty(window.DeviceOrientationEvent,'requestPermission',{value:undefined,configurable:true});
  localStorage.setItem('crosswise_product_preferences_v1',JSON.stringify({version:1,termsVersion:'2026-10-13'}));
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 expect(await(await context.request.get(base+'/sw.js')).text()).toBe(await readFile('dist/sw.js','utf8'));
 await page.goto(base);await page.getByRole('button',{name:'Route guidance',exact:true}).click();await page.getByRole('button',{name:'Search destination',exact:true}).click();
 await page.getByLabel('Place name or address',{exact:true}).fill('pharmacy');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/maps/search'));
 await page.getByRole('button',{name:'Search',exact:true}).click();
 expect((await response).ok()).toBe(true);
 await expect(page.getByRole('status').filter({hasText:'Closest first'})).toBeVisible();
 const details=await page.locator('.cw-row small').allTextContents();
 const distances=details.map(t=>Number(t.match(/· (\d+) metres/)?.[1]));
 expect(distances.length).toBeGreaterThan(1);expect(distances.every(Number.isFinite)).toBe(true);expect(distances).toEqual([...distances].sort((a,b)=>a-b));
 await page.screenshot({path:'artifacts/closest-search-live.png'});
 await page.reload();await page.getByRole('button',{name:'Road crossing',exact:true}).click();await page.getByRole('button',{name:'Show map',exact:true}).click();await page.getByRole('button',{name:'Locate me',exact:true}).click();
 await expect(page.getByText(/Your estimated position: -34.42740, 150.88870/)).toContainText('Accuracy: about 150 m');
 await expect(page.locator('[data-map-zoom]')).toHaveAttribute('data-map-zoom','17');
 await page.waitForTimeout(2000);await page.screenshot({path:'artifacts/estimated-location-live.png'});
 expect(errors).toEqual([]);console.log('PASS: exact deployed build, real Google pharmacy results closest first, and approximate location with 150 m accuracy on street-level map.');
}finally{await browser.close();}
