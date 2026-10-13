import {chromium,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
const base=process.argv[2]??'https://capstone-pwa-dev.fly.dev';
const browser=await chromium.launch({channel:'chrome',headless:true});
let observedPage;
try {
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:-33.8731,longitude:151.2065,accuracy:5}});
 await context.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');let frame=0;
   const paint=()=>{ctx.fillStyle=frame++%2?'#164c79':'#4088b0';ctx.fillRect(0,0,640,360);ctx.fillStyle='#fff';ctx.fillText(`Dev smoke camera ${frame}`,20,40);};paint();setInterval(paint,50);return canvas.captureStream(20);
  };
 });
 const page=await context.newPage(),errors=[];observedPage=page;page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(/Google Maps JavaScript API error/.test(message.text()))errors.push('Google Maps JavaScript API reported an error.');});
 page.on('requestfailed',request=>{if(new URL(request.url()).origin===new URL(base).origin)console.log('REQUEST FAILED:',new URL(request.url()).pathname,request.failure()?.errorText);});
 const health=await context.request.get(`${base}/healthz`);expect(health.ok()).toBe(true);expect((await health.json()).ready).toBe(true);
 const deployedWorker=await(await context.request.get(`${base}/sw.js`)).text();const localWorker=await readFile('dist/sw.js','utf8');expect(deployedWorker).toBe(localWorker);
 await page.goto(base);expect(await page.evaluate(()=>isSecureContext)).toBe(true);await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/dev-home.png'});
 console.log('PASS: HTTPS, health, exact deployed build and new Home.');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Guidance speech speed',exact:false}).click();await expect(page.getByRole('radio')).toHaveCount(7);await page.getByRole('radio',{name:'80',exact:false}).check();await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Guidance speech speed',exact:false}).click();await expect(page.getByRole('radio',{name:'80',exact:false})).toBeChecked();await page.getByRole('button',{name:'‹ Back',exact:true}).click();await page.getByRole('button',{name:'Obstacles and landmarks',exact:false}).click();await page.getByRole('button',{name:'Types to announce',exact:false}).click();await expect(page.getByRole('switch')).toHaveCount(20);
 console.log('PASS: dedicated settings, seven speech levels, persistence and twenty capability rows.');
 await page.reload();await page.getByRole('button',{name:'Route guidance',exact:true}).click();await page.getByRole('button',{name:'Search destination',exact:true}).click();await page.getByLabel('Place name or address',{exact:true}).fill('Sydney Town Hall');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:/^1\. /}).click({timeout:30000});await page.getByRole('button',{name:'Confirm place and review route',exact:true}).click();await expect(page.getByRole('button',{name:'Start journey',exact:true})).toBeVisible({timeout:30000});await page.screenshot({path:'artifacts/dev-route.png'});await page.getByRole('button',{name:'Start journey',exact:true}).click();
 await page.getByRole('button',{name:'More controls',exact:true}).click();await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible({timeout:20000});await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 console.log('PASS: live Places search, walking-route review, journey start/pause/resume.');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'End journey',exact:true}).click();
 await page.getByRole('button',{name:'Allow camera',exact:true}).click();await expect.poll(async()=>{await page.getByRole('button',{name:'Start camera assistance',exact:true}).click();return page.getByRole('button',{name:'I’m crossing',exact:true}).count();},{timeout:45000,intervals:[1000]}).toBe(1);
 await expect.poll(async()=>Number(await page.locator('canvas[data-camera-renderer]').getAttribute('data-rendered-frames'))).toBeGreaterThan(0);console.log('PASS: deployed detector, model download and actual synthetic camera rendering.');
 await page.getByRole('button',{name:'End walk',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End walk',exact:true}).click();await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
 const capabilities=await(await context.request.get(`${base}/api/product/capabilities`)).json();console.log(`INFO: accounts=${capabilities.accounts}, photoQuestions=${capabilities.photoQuestions}.`);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});await context.setOffline(true);await page.reload();await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();await page.getByRole('button',{name:'More tools',exact:true}).click();await page.getByRole('button',{name:'My Routes',exact:true}).click();await expect(page.getByRole('button',{name:'Create My Route',exact:true})).toBeVisible();expect(errors).toEqual([]);console.log('PASS: End walk, offline reload/local tools and no uncaught browser errors.');
} catch(error) {if(observedPage){await observedPage.screenshot({path:'artifacts/dev-smoke-failure.png'});console.error((await observedPage.locator('body').innerText()).slice(0,5000));}throw error;} finally {await browser.close();}
