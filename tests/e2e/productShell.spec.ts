import {test,expect,type Page} from '@playwright/test';
async function home(page:Page){await page.goto('/');await page.getByRole('button',{name:'Agree and continue',exact:true}).click();}
async function settings(page:Page){await page.getByRole('button',{name:'Settings',exact:true}).click();}
async function back(page:Page){await page.getByRole('button',{name:'‹ Back',exact:true}).click();}
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  (window as unknown as {cameraRequests:number}).cameraRequests=0;
  navigator.mediaDevices.getUserMedia=async()=>{(window as unknown as {cameraRequests:number}).cameraRequests++;throw new DOMException('Denied','NotAllowedError');};
 });
});
test('new Home explains use, requests no camera, and reaches all main functions',async({page},info)=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Welcome to CrossWise',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Read use information',exact:true}).click();await expect(page.getByRole('heading',{name:'Using CrossWise',exact:true})).toBeVisible();await back(page);
 await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
 await page.screenshot({path:`artifacts/crosswise-home-${info.project.name}.png`});
 expect(await page.evaluate(()=>(window as unknown as {cameraRequests:number}).cameraRequests)).toBe(0);
 await settings(page);await expect(page.getByRole('button',{name:'Nearby facilities',exact:false})).toBeVisible();await back(page);
 await page.getByRole('button',{name:'More tools',exact:true}).click();await expect(page.getByRole('button',{name:'My Routes',exact:true})).toBeVisible();await back(page);
 await page.reload();await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeVisible();
});
test('seven speech levels, route preference and display size persist after reload',async({page})=>{
 await home(page);await settings(page);await page.getByRole('button',{name:'Guidance speech speed',exact:false}).click();
 await expect(page.getByRole('radio')).toHaveCount(7);await page.getByRole('radio',{name:'90',exact:false}).check();
 await page.getByRole('button',{name:'Preview message',exact:true}).click();await page.getByRole('button',{name:'Stop preview',exact:true}).click();await back(page);
 await page.getByRole('button',{name:'Route preference',exact:false}).click();await expect(page.getByRole('radio')).toHaveCount(5);await page.getByRole('radio',{name:'Covered paths',exact:false}).check();await back(page);
 await page.getByRole('button',{name:'Display and accessibility',exact:false}).click();await page.getByRole('radio',{name:'Extra large',exact:true}).check();
 await page.reload();await settings(page);await page.getByRole('button',{name:'Guidance speech speed',exact:false}).click();await expect(page.getByRole('radio',{name:'90',exact:false})).toBeChecked();await back(page);
 await page.getByRole('button',{name:'Route preference',exact:false}).click();await expect(page.getByRole('radio',{name:'Covered paths',exact:false})).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('all twenty object categories show capabilities and bulk controls preserve unsupported states',async({page})=>{
 await home(page);await settings(page);await page.getByRole('button',{name:'Obstacles and landmarks',exact:false}).click();
 await page.getByRole('radio',{name:'Front and sides',exact:true}).check();await page.getByRole('button',{name:'Types to announce',exact:false}).click();
 await expect(page.getByRole('switch')).toHaveCount(20);
 expect(await page.getByRole('switch').evaluateAll(items=>items.filter(item=>(item as HTMLInputElement).disabled).length)).toBe(16);
 await page.getByRole('button',{name:'All off',exact:true}).click();expect(await page.getByRole('switch').evaluateAll(items=>items.filter(item=>(item as HTMLInputElement).checked).length)).toBe(0);
 await page.getByRole('button',{name:'All on',exact:true}).click();expect(await page.getByRole('switch').evaluateAll(items=>items.filter(item=>(item as HTMLInputElement).checked).length)).toBe(4);
 await page.getByRole('button',{name:'Preview Tactile paving',exact:true}).click();
 await page.goBack();await expect(page.getByRole('heading',{name:'Obstacles and landmarks',exact:true})).toBeVisible();
 await expect(page.getByRole('radio',{name:'Front and sides',exact:true})).toBeChecked();
});
test('small display and extra-large text wrap across Home, settings and tools',async({page},info)=>{
 await page.setViewportSize({width:320,height:720});await home(page);await settings(page);
 await page.getByRole('button',{name:'Display and accessibility',exact:false}).click();await page.getByRole('radio',{name:'Extra large',exact:true}).check();await back(page);
 for(const label of ['Feedback and voice','Guidance speech speed','Route preference','Obstacles and landmarks','Permissions and service status']){
  await page.getByRole('button',{name:label,exact:false}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await back(page);
 }
 await back(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/product-home-${info.project.name}.png`,fullPage:true});
});
test('Stroll keeps camera denial recoverable and End walk returns to Home',async({page})=>{
 await home(page);await page.getByRole('button',{name:'Stroll',exact:true}).click();
 await expect(page.getByRole('button',{name:'Start nearby announcements',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Feedback and voice',exact:false}).click();
 await page.getByRole('switch',{name:'Mono audio',exact:true}).check();await back(page);await back(page);
 await page.getByRole('button',{name:'End walk',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'End walk',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'End walk',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End walk',exact:true}).click();
 await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
});
test('changing startup preference applies on reload and never reopens an ended walk',async({page})=>{
 await home(page);await settings(page);await page.getByRole('button',{name:'Startup',exact:false}).click();
 await page.getByRole('switch',{name:'Start Stroll at launch',exact:true}).check();
 await page.getByRole('button',{name:'Test Stroll startup',exact:true}).click();
 await page.getByRole('button',{name:'End walk',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End walk',exact:true}).click();
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'More tools',exact:true}).click();await expect(page.getByRole('heading',{name:'More tools',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Start nearby announcements',exact:true})).toBeVisible();
});
test('leaving an authored route awaiting GPS cancels the late start before data changes',async({page})=>{
 await home(page);
 // Install this fixture in the loaded page. The Windows WebKit runner can
 // discard navigator overrides and early storage writes during navigation.
 await page.evaluate(()=>{
  localStorage.setItem('crosswise_local_tools_v1',JSON.stringify({version:1,routes:[{id:'slow',name:'Slow GPS route',updatedAt:1,waypoints:[{id:'a',label:'Gate',latitude:-33.86,longitude:151.2,note:''},{id:'b',label:'Library',latitude:-33.8601,longitude:151.2001,note:''}]}],areas:[]}));
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success:PositionCallback)=>{(window as unknown as {releaseGPS:()=>void}).releaseGPS=()=>success({coords:{latitude:-33.86,longitude:151.2,accuracy:5,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()} as GeolocationPosition);},watchPosition:()=>1,clearWatch:()=>{}}});
 });
 await page.getByRole('button',{name:'More tools',exact:true}).click();await page.getByRole('button',{name:'My Routes',exact:true}).click();
 await page.getByRole('button',{name:'Open Slow GPS route',exact:true}).click();await page.getByRole('button',{name:'Start My Route',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>typeof (window as unknown as {releaseGPS?:()=>void}).releaseGPS)).toBe('function');
 await back(page);await back(page);await page.getByRole('button',{name:'Data management',exact:true}).click();
 await expect(page.getByRole('button',{name:'Delete all local application data',exact:true})).toBeEnabled();
 await page.evaluate(()=>(window as unknown as {releaseGPS:()=>void}).releaseGPS());
 await expect(page.getByRole('heading',{name:'Data management',exact:true})).toBeVisible();await back(page);await back(page);
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Return to walk:/})).toHaveCount(0);
});
