import {chromium,webkit,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

const base=process.argv[2]??'https://capstone-pwa.fly.dev';
const expectedWorker=await readFile('dist/sw.js','utf8');
await mkdir('artifacts',{recursive:true});

async function checkContinue(page){
 const setup=page.getByRole('region',{name:'Set up permissions',exact:true});
 await expect(setup.getByRole('heading',{name:'Set up permissions',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');
 const next=setup.getByRole('button',{name:'Continue to CrossWise',exact:true});
 await expect(next).toBeFocused();
 const [nextBounds,enableBounds]=await Promise.all([
  next.boundingBox(),setup.getByRole('button',{name:'Enable all available permissions',exact:true}).boundingBox(),
 ]);
 expect(nextBounds).not.toBeNull();expect(enableBounds).not.toBeNull();
 expect(nextBounds.y).toBeGreaterThanOrEqual(0);
 expect(nextBounds.y+nextBounds.height).toBeLessThanOrEqual(page.viewportSize().height);
 expect(nextBounds.y+nextBounds.height).toBeLessThanOrEqual(enableBounds.y);
 return {setup,next};
}

for(const [engineName,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(engineName==='chromium'?{channel:'chrome'}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const worker=await context.request.get(`${base}/sw.js`);
  expect(worker.ok()).toBe(true);expect(await worker.text()).toBe(expectedWorker);
  const health=await context.request.get(`${base}/healthz`);
  expect(health.ok()).toBe(true);expect((await health.json()).ready).toBe(true);
  await context.addInitScript(()=>{
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
   const calls={camera:0,microphone:0,location:0,motion:0,stops:0,motionFromAgree:false};
   Object.defineProperty(window,'__permissionCalls',{value:calls});
   let agreeEvent=null;
   document.addEventListener('click',event=>{
    agreeEvent=event.isTrusted&&event.target.closest('button')?.textContent==='Agree and continue'?event:null;
   },true);
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async constraints=>{
    const kind=constraints?.video?'video':'audio';calls[kind==='video'?'camera':'microphone']++;
    const track={kind,stop(){calls.stops++;}};
    return {getTracks:()=>[track],getVideoTracks:()=>kind==='video'?[track]:[],getAudioTracks:()=>kind==='audio'?[track]:[]};
   }}});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:success=>{
    calls.location++;success({coords:{latitude:-34.4274,longitude:150.8887,accuracy:5},timestamp:Date.now()});
   }}});
   Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {
    static requestPermission(){calls.motion++;calls.motionFromAgree=!!agreeEvent&&agreeEvent.eventPhase!==Event.NONE;return new Promise(resolve=>{window.__finishMotion=()=>resolve('granted');});}
   }});
  });
  const page=await context.newPage();
  await page.goto(base);await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
  const {setup}=await checkContinue(page);
  for(const text of ['Allowed. Camera is off until you start walking.','Allowed. Location is used only when a walking feature needs it.','Allowed. Microphone is off until you use voice.']){
   await expect(setup.getByText(text,{exact:true})).toBeVisible();
  }
  await expect(setup).toBeVisible();
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toHaveCount(0);
  await page.screenshot({path:`artifacts/permission-setup-${engineName}.png`});
  await page.evaluate(()=>window.__finishMotion());
  await expect(setup).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>window.__permissionCalls)).toEqual({camera:1,microphone:1,location:1,motion:1,stops:2,motionFromAgree:true});
  await context.close();

  const deniedContext=await browser.newContext({viewport:{width:390,height:844}});
  await deniedContext.addInitScript(()=>{
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});
   Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'denied'})}});
   window.__deniedPermissionRequests=0;
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__deniedPermissionRequests++;throw new DOMException('Denied','NotAllowedError');}}});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:()=>{window.__deniedPermissionRequests++;}}});
   Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {}});
  });
  const deniedPage=await deniedContext.newPage();
  await deniedPage.goto(base);await deniedPage.getByRole('button',{name:'Agree and continue',exact:true}).click();
  const denied=await checkContinue(deniedPage);
  await expect(denied.setup.getByText('Blocked in browser settings. Enable access there, then retry.',{exact:true})).toHaveCount(3);
  expect(await deniedPage.evaluate(()=>window.__deniedPermissionRequests)).toBe(0);
  await deniedPage.keyboard.press('Enter');
  await expect(denied.setup).toHaveCount(0);
  await expect(deniedPage.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
  await deniedContext.close();

  for(const needsGesture of [false,true]){
   const returningContext=await browser.newContext({viewport:{width:390,height:844}});
   await returningContext.addInitScript(({needsGesture})=>{
    localStorage.setItem('crosswise_product_preferences_v1',JSON.stringify({version:1,termsVersion:'2026-10-13'}));
    localStorage.setItem('crosswise_permission_setup_v1','done');
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'granted'})}});
    const calls={media:0,location:0,motion:0};Object.defineProperty(window,'__permissionCalls',{value:calls});
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{
     calls.media++;throw new Error('Granted media must not be requested during setup');
    }}});
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:()=>{calls.location++;}}});
    let trustedClick=null;
    document.addEventListener('click',event=>{trustedClick=event.isTrusted?event:null;},true);
    Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {
     static requestPermission(){
      calls.motion++;
      return !needsGesture||(trustedClick&&trustedClick.eventPhase!==Event.NONE)
       ?Promise.resolve('granted')
       :Promise.reject(new DOMException('A user gesture is required','NotAllowedError'));
     }
    }});
   },{needsGesture});
   const returningPage=await returningContext.newPage();
   await returningPage.goto(base);
   const returningSetup=returningPage.getByRole('region',{name:'Set up permissions',exact:true});
   if(needsGesture){
    await expect(returningSetup.getByText('Tap Allow motion to finish setup.',{exact:true})).toBeVisible();
    expect(await returningPage.evaluate(()=>window.__permissionCalls)).toEqual({media:0,location:0,motion:1});
    await returningSetup.getByRole('button',{name:'Allow motion',exact:true}).click();
   }
   await expect(returningPage.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
   await expect(returningSetup).toHaveCount(0);
   expect(await returningPage.evaluate(()=>window.__permissionCalls)).toEqual({media:0,location:0,motion:needsGesture?2:1});
   await returningContext.close();
  }
  console.log(`PASS ${engineName}: exact release, automatic permission requests, Agree gesture for motion, top keyboard access, automatic completion, denied-permission exit, returning grants and one-tap motion fallback.`);
 }finally{await browser.close();}
}
