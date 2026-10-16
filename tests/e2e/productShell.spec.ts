import {test,expect,type Page} from './fixtures';
async function home(page:Page){await page.goto('/');await page.getByRole('button',{name:'Agree and continue',exact:true}).click();await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();}
async function settings(page:Page){await page.getByRole('button',{name:'Settings',exact:true}).click();}
async function back(page:Page){await page.getByRole('button',{name:'‹ Back',exact:true}).click();}
async function returningUser(page:Page){await page.addInitScript(()=>{
 localStorage.setItem('crosswise_product_preferences_v1',JSON.stringify({version:1,termsVersion:'2026-10-13'}));
 localStorage.setItem('crosswise_permission_setup_v1','done');
});}
test.beforeEach(async({page},testInfo)=>{await page.addInitScript(({mockSpeech})=>{
 (window as unknown as {cameraRequests:number}).cameraRequests=0;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{(window as unknown as {cameraRequests:number}).cameraRequests++;throw new DOMException('Denied','NotAllowedError');}}});
 if(mockSpeech)Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});
},{mockSpeech:!testInfo.titlePath.includes('startup offline English recognition')});});
test.describe('startup offline English recognition',()=>{
 test('installed recognition opens Home without reinstalling',async({page})=>{
  await returningUser(page);
  await page.addInitScript(()=>{
   const calls={available:0,install:0};Object.defineProperty(window,'__speechPackCalls',{value:calls});
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class {
    static async available(){calls.available++;return 'available';}
    static async install(){calls.install++;return true;}
   }});
  });
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {__speechPackCalls:{available:number;install:number}}).__speechPackCalls)).toEqual({available:1,install:0});
 });
 test('download starts on open, reports indeterminate progress, then fades to Home',async({page})=>{
  await returningUser(page);
  await page.addInitScript(()=>{
   const state:{available:number;install:number;installed:boolean;finish:()=>void}={available:0,install:0,installed:false,finish:()=>{}};
   Object.defineProperty(window,'__speechPackState',{value:state});
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class {
    static async available(){state.available++;return state.installed?'available':'downloadable';}
    static install(){state.install++;return new Promise<boolean>(resolve=>{state.finish=()=>{state.installed=true;resolve(true);};});}
   }});
  });
  await page.goto('/');
  const startup=page.getByRole('region',{name:'Preparing offline voice'});
  await expect(startup).toBeVisible();
  await expect(startup.getByRole('status')).toHaveText('Downloading offline English recognition…');
  await expect(startup.getByRole('progressbar')).toBeVisible();
  await expect(startup.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow',/\d/);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {__speechPackState:{install:number}}).__speechPackState.install)).toBe(1);
  await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toHaveCount(0);
  expect(await startup.evaluate(element=>getComputedStyle(element).transitionDuration)).not.toBe('0s');
  await page.evaluate(()=>{
   const state=window as unknown as {__startupFaded:boolean};state.__startupFaded=false;
   const element=document.querySelector('.cw-speech-startup');
   if(!element)return;
   const observer=new MutationObserver(()=>{if(element.classList.contains('cw-speech-startup-leaving')){state.__startupFaded=true;observer.disconnect();}});
   observer.observe(element,{attributes:true,attributeFilter:['class']});
  });
  await page.evaluate(()=>(window as unknown as {__speechPackState:{finish:()=>void}}).__speechPackState.finish());
  await expect(startup).toHaveCount(0);
  expect(await page.evaluate(()=>(window as unknown as {__startupFaded:boolean}).__startupFaded)).toBe(true);
  await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
 });
 test('failed automatic download can be retried from a tap',async({page})=>{
  await returningUser(page);
  await page.addInitScript(()=>{
   const state={attempts:0,installed:false};Object.defineProperty(window,'__speechPackState',{value:state});
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class {
    static async available(){return state.installed?'available':'downloadable';}
    static async install(){state.attempts++;if(state.attempts===1)throw new Error('Network unavailable');state.installed=true;return true;}
   }});
  });
  await page.goto('/');
  const startup=page.getByRole('region',{name:'Preparing offline voice'});
  await expect(startup.getByRole('button',{name:'Retry download',exact:true})).toBeVisible();
  await startup.getByRole('button',{name:'Retry download',exact:true}).click();
  await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {__speechPackState:{attempts:number}}).__speechPackState.attempts)).toBe(2);
 });
 test('failed download can be skipped to use walking features',async({page})=>{
  await returningUser(page);
  await page.addInitScript(()=>{
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class {
    static async available(){return 'downloadable';}
    static async install(){throw new Error('Network unavailable');}
   }});
  });
  await page.goto('/');
  const startup=page.getByRole('region',{name:'Preparing offline voice'});
  await expect(startup.getByRole('button',{name:'Retry download',exact:true})).toBeVisible();
  await startup.getByRole('button',{name:'Continue to CrossWise',exact:true}).click();
  await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
 });
 test('automatic permission prompts wait until voice preparation has finished',async({page})=>{
  await returningUser(page);
  await page.addInitScript(()=>{
   const pack={installed:false,finish:()=>{}};Object.defineProperty(window,'__speechPackState',{value:pack});
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class {
    static async available(){return pack.installed?'available':'downloadable';}
    static install(){return new Promise<boolean>(resolve=>{pack.finish=()=>{pack.installed=true;resolve(true);};});}
   }});
   const calls={camera:0,microphone:0,location:0,motion:0,stops:0};Object.defineProperty(window,'__permissionCalls',{value:calls});
   Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async(constraints:MediaStreamConstraints)=>{
    const kind=constraints.video?'video':'audio';if(kind==='video')calls.camera++;else calls.microphone++;
    const track={kind,readyState:'live',addEventListener(){},stop(){this.readyState='ended';calls.stops++;}};
    return {getTracks:()=>[track],getVideoTracks:()=>kind==='video'?[track]:[],getAudioTracks:()=>kind==='audio'?[track]:[]};
   }}});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success:(position:unknown)=>void)=>{
    calls.location++;success({coords:{latitude:-33.87,longitude:151.2,accuracy:5},timestamp:Date.now()});
   }}});
   Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {static async requestPermission(){calls.motion++;return 'granted';}}});
  });
  await page.goto('/');
  const startup=page.getByRole('region',{name:'Preparing offline voice'});
  await expect(startup.getByRole('status')).toHaveText('Downloading offline English recognition…');
  expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:Record<string,number>}).__permissionCalls)).toEqual({camera:0,microphone:0,location:0,motion:0,stops:0});
  await page.evaluate(()=>(window as unknown as {__speechPackState:{finish:()=>void}}).__speechPackState.finish());
  await expect(startup).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:Record<string,number>}).__permissionCalls)).toEqual({camera:1,microphone:1,location:1,motion:1,stops:2});
 });
 test('unsupported recognition continues to first-open Welcome',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Welcome to CrossWise',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 });
});
test('first-open setup automatically requests permissions and reuses Agree for motion',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
  const calls={camera:0,location:0,microphone:0,motion:0,stops:0,motionFromAgree:false};
  Object.defineProperty(window,'__permissionCalls',{value:calls});
  let agreeEvent:Event|null=null;
  document.addEventListener('click',event=>{
   agreeEvent=event.isTrusted&&(event.target as HTMLElement).closest('button')?.textContent==='Agree and continue'?event:null;
  },true);
  const getUserMedia:typeof navigator.mediaDevices.getUserMedia=async constraints=>{
   const kind=constraints?.video?'video':'audio';
   if(kind==='video')calls.camera++;else calls.microphone++;
   const track={kind,readyState:'live',addEventListener(){},stop(){this.readyState='ended';calls.stops++;}};
   return {getTracks:()=>[track],getVideoTracks:()=>kind==='video'?[track]:[],getAudioTracks:()=>kind==='audio'?[track]:[]} as unknown as MediaStream;
  };
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success:(position:unknown)=>void)=>{calls.location++;success({coords:{latitude:-33.87,longitude:151.2,accuracy:5},timestamp:Date.now()});}}});
  Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {static requestPermission(){calls.motion++;calls.motionFromAgree=!!agreeEvent&&agreeEvent.eventPhase!==Event.NONE;return new Promise<string>(resolve=>{Object.defineProperty(window,'__finishMotion',{configurable:true,value:()=>resolve('granted')});});}}});
 });
 await page.goto('/');
 await expect(page.getByRole('button',{name:'‹ Back',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 const setup=page.getByRole('region',{name:'Set up permissions',exact:true});
 await expect(setup).toBeVisible();
 await expect(setup.getByRole('heading',{name:'Set up permissions',exact:true})).toBeFocused();
 await page.keyboard.press('Tab');
 await expect(setup.getByRole('button',{name:'Continue to CrossWise',exact:true})).toBeFocused();
 for(const label of ['Allowed. Camera is off until you start walking.','Allowed. Location is used only when a walking feature needs it.','Allowed. Microphone is off until you use voice.'])await expect(setup.getByText(label,{exact:true})).toBeVisible();
 await expect(setup.getByRole('button',{name:'Continue to CrossWise',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:Record<string,number|boolean>}).__permissionCalls)).toEqual({camera:1,location:1,microphone:1,motion:1,stops:2,motionFromAgree:true});
 await page.evaluate(()=>(window as unknown as {__finishMotion:()=>void}).__finishMotion());
 await expect(setup).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
});

test('the final missing microphone is requested automatically and closes setup',async({page})=>{
 await page.addInitScript(()=>{
  const calls={camera:0,microphone:0,stops:0};Object.defineProperty(window,'__permissionCalls',{value:calls});
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async({name}:{name:string})=>({state:name==='microphone'?'prompt':'granted'})}});
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:(constraints:MediaStreamConstraints)=>{
   if(constraints.video)calls.camera++;else calls.microphone++;
   return new Promise<MediaStream>(resolve=>{
    Object.defineProperty(window,'__finishMicrophone',{value:()=>{
     const track={stop(){calls.stops++;}};
     resolve({getTracks:()=>[track],getAudioTracks:()=>[track]} as unknown as MediaStream);
    }});
   });
  }}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 const setup=page.getByRole('region',{name:'Set up permissions',exact:true});
 await expect(setup.getByText('Already allowed',{exact:true})).toHaveCount(2);
 await expect(setup.getByRole('button',{name:'Allow motion',exact:true})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {__permissionCalls:{microphone:number}}).__permissionCalls.microphone)).toBe(1);
 await page.evaluate(()=>(window as unknown as {__finishMicrophone:()=>void}).__finishMicrophone());
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:Record<string,number>}).__permissionCalls)).toEqual({camera:0,microphone:1,stops:1});
 await page.goBack();
 await expect(page.getByRole('heading',{name:'Welcome to CrossWise',exact:true})).toBeFocused();
 await expect(setup).toHaveCount(0);
});

test('known denied permissions do not retry automatically and Continue stays accessible',async({page})=>{
 await returningUser(page);
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'denied'})}});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:()=>{throw new Error('Denied location must not be requested automatically');}}});
 });
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Set up permissions',exact:true})).toBeFocused();
 await expect(page.getByText('Blocked in browser settings. Enable access there, then retry.')).toHaveCount(3);
 await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'Continue to CrossWise',exact:true})).toBeFocused();
 await page.evaluate(async()=>{for(let frame=0;frame<4;frame++)await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));});
 expect(await page.evaluate(()=>(window as unknown as {cameraRequests:number}).cameraRequests)).toBe(0);
 await page.getByRole('button',{name:'Continue to CrossWise',exact:true}).click();
 await expect(page.getByRole('button',{name:'Road crossing',exact:true})).toBeVisible();
});

test('returning users with an existing motion grant reach Home without another tap',async({page})=>{
 await returningUser(page);
 await page.addInitScript(()=>{
  const calls={motion:0,location:0};Object.defineProperty(window,'__permissionCalls',{value:calls});
  Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {static async requestPermission(){calls.motion++;return 'granted';}}});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:()=>{calls.location++;}}});
 });
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:Record<string,number>}).__permissionCalls)).toEqual({motion:1,location:0});
 expect(await page.evaluate(()=>(window as unknown as {cameraRequests:number}).cameraRequests)).toBe(0);
 await settings(page);await back(page);
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:{motion:number}}).__permissionCalls.motion)).toBe(1);
});

test('iPhone-style motion permission needs only one tap after automatic requests',async({page})=>{
 await returningUser(page);
 await page.addInitScript(()=>{
  let trustedClick:Event|null=null;
  document.addEventListener('click',event=>{trustedClick=event.isTrusted?event:null;},true);
  const calls={motion:0};Object.defineProperty(window,'__permissionCalls',{value:calls});
  Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class {static requestPermission(){
   calls.motion++;
   return trustedClick&&trustedClick.eventPhase!==Event.NONE?Promise.resolve('granted'):Promise.reject(new DOMException('A user gesture is required','NotAllowedError'));
  }}});
 });
 await page.goto('/');
 const setup=page.getByRole('region',{name:'Set up permissions',exact:true});
 await expect(setup.getByText('Tap Allow motion to finish setup.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:{motion:number}}).__permissionCalls.motion)).toBe(1);
 await setup.getByRole('button',{name:'Allow motion',exact:true}).click();
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:{motion:number}}).__permissionCalls.motion)).toBe(2);
 expect(await page.evaluate(()=>(window as unknown as {cameraRequests:number}).cameraRequests)).toBe(0);
});

test('a delayed camera stream is stopped after continuing past setup',async({page})=>{
 await returningUser(page);
 await page.addInitScript(()=>{
  const calls={camera:0,stops:0};Object.defineProperty(window,'__permissionCalls',{value:calls});
  Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async({name}:{name:string})=>({state:name==='camera'?'prompt':'granted'})}});
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{
   calls.camera++;
   return new Promise<MediaStream>(resolve=>{Object.defineProperty(window,'__finishCamera',{value:()=>{
    const track={kind:'video',readyState:'live',addEventListener(){},stop(){this.readyState='ended';calls.stops++;}};
    resolve({getTracks:()=>[track],getVideoTracks:()=>[track],getAudioTracks:()=>[]} as unknown as MediaStream);
   }});});
  }}});
 });
 await page.goto('/');
 const setup=page.getByRole('region',{name:'Set up permissions',exact:true});
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {__permissionCalls:{camera:number}}).__permissionCalls.camera)).toBe(1);
 await setup.getByRole('button',{name:'Continue to CrossWise',exact:true}).click();
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 await page.evaluate(()=>(window as unknown as {__finishCamera:()=>void}).__finishCamera());
 await expect.poll(()=>page.evaluate(()=>(window as unknown as {__permissionCalls:{stops:number}}).__permissionCalls.stops)).toBe(1);
 await expect(setup).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>(window as unknown as {__permissionCalls:{camera:number}}).__permissionCalls.camera)).toBe(1);
});

test('main build developer view has car and pedestrian indicators without diagnostic popup',async({page},info)=>{
 await returningUser(page);await page.goto('/');await expect(page.getByRole('button',{name:'Road crossing',exact:true})).toBeVisible();await page.screenshot({path:`artifacts/redesign-home-${info.project.name}.png`});await settings(page);
 await page.getByRole('switch',{name:'Developer camera view',exact:false}).check();
 await back(page);await page.getByRole('button',{name:'Road crossing',exact:true}).click();
 await expect(page.getByRole('img',{name:'Car count unavailable',exact:true})).toBeVisible();
 await expect(page.getByTestId('pedestrian-indicator')).toHaveAttribute('data-signal','grey');
 await expect(page.getByRole('button',{name:'Open diagnostics',exact:true})).toHaveCount(0);
 await expect(page.getByTestId('developer-telemetry')).toHaveCount(0);
 await page.screenshot({path:`artifacts/redesign-crossing-${info.project.name}.png`});
});
test('demo Home is focused, requests no camera and reaches help and navigation',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Read use information',exact:true}).click();await expect(page.getByRole('heading',{name:'Using CrossWise',exact:true})).toBeVisible();await back(page);await page.getByRole('button',{name:'Agree and continue',exact:true}).click();await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
 for(const name of ['Route guidance','Road crossing','Settings','Help'])await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('button')).toHaveCount(4);await expect(page.locator('body')).not.toContainText(/Research access|Insurance|Account|Backup/);expect(await page.evaluate(()=>(window as unknown as {cameraRequests:number}).cameraRequests)).toBe(0);
 await page.screenshot({path:`artifacts/demo-home-${info.project.name}.png`});await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('heading',{name:'Start a walk',exact:true})).toBeVisible();await back(page);await page.getByRole('button',{name:'Route guidance',exact:true}).click();await expect(page.getByRole('button',{name:'My Routes',exact:true})).toHaveCount(0);
});
test('supported speech presets and route preferences persist with large text',async({page})=>{
 await home(page);await settings(page);await page.getByRole('button',{name:'Guidance speech speed',exact:false}).click();await expect(page.getByRole('radio')).toHaveCount(3);await page.getByRole('radio',{name:'Fast',exact:false}).check();await page.getByRole('button',{name:'Preview message',exact:true}).click();await page.getByRole('button',{name:'Stop preview',exact:true}).click();await back(page);
 await page.getByRole('button',{name:'Route preference',exact:false}).click();await expect(page.getByRole('radio')).toHaveCount(2);await page.getByRole('radio',{name:'Shortest time',exact:false}).check();await back(page);await page.getByRole('button',{name:'Display and accessibility',exact:false}).click();await page.getByRole('radio',{name:'Extra large',exact:true}).check();await page.reload();await settings(page);await page.getByRole('button',{name:'Guidance speech speed',exact:false}).click();await expect(page.getByRole('radio',{name:'Fast',exact:false})).toBeChecked();await back(page);await page.getByRole('button',{name:'Route preference',exact:false}).click();await expect(page.getByRole('radio',{name:'Shortest time',exact:false})).toBeChecked();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('only supported object switches are offered and bulk controls work',async({page})=>{
 await home(page);await settings(page);await page.getByRole('button',{name:'Obstacles and landmarks',exact:false}).click();await page.getByRole('radio',{name:'Front and sides',exact:true}).check();await page.getByRole('button',{name:'Types to announce',exact:false}).click();await expect(page.getByRole('switch')).toHaveCount(4);for(const name of ['Person','Bicycle','Car','Truck'])await expect(page.getByRole('switch',{name:name+' Supported',exact:true})).toBeEnabled();await page.getByRole('button',{name:'All off',exact:true}).click();expect(await page.getByRole('switch').evaluateAll(items=>items.filter(item=>(item as HTMLInputElement).checked).length)).toBe(0);await page.getByRole('button',{name:'All on',exact:true}).click();expect(await page.getByRole('switch').evaluateAll(items=>items.filter(item=>(item as HTMLInputElement).checked).length)).toBe(4);await page.goBack();await expect(page.getByRole('radio',{name:'Front and sides',exact:true})).toBeChecked();
});
test('extra large display wraps settings on a narrow phone',async({page})=>{
 await page.setViewportSize({width:320,height:720});await home(page);await settings(page);await page.getByRole('button',{name:'Display and accessibility',exact:false}).click();await page.getByRole('radio',{name:'Extra large',exact:true}).check();await back(page);for(const name of ['Feedback and voice','Guidance speech speed','Route preference','Obstacles and landmarks','Permissions and service status']){await page.getByRole('button',{name,exact:false}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await back(page);}await back(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Road crossing, tool Back and End walk remain recoverable without camera permission',async({page})=>{
 await home(page);await page.getByRole('button',{name:'Road crossing',exact:true}).click();await expect(page.getByRole('button',{name:'Allow camera',exact:true})).toBeVisible();await page.getByRole('button',{name:'Tools',exact:true}).click();await expect(page.getByRole('button',{name:'Start nearby announcements',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start nearby announcements',exact:true}).click();await expect(page.getByRole('button',{name:'Stop nearby announcements',exact:true})).toBeVisible();await page.goBack();await expect(page.getByRole('navigation',{name:'Walking tools'})).toBeVisible();await page.getByRole('button',{name:'End walk',exact:true}).click();await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'End walk',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End walk',exact:true}).click();await expect(page.getByRole('button',{name:'Route guidance',exact:true})).toBeVisible();
});
test('legacy auto-start and recorder settings cannot start camera or recording in demo',async({page})=>{
 await home(page);await page.evaluate(()=>{localStorage.setItem('crosswise_product_preferences_v1',JSON.stringify({version:1,autoStroll:true,termsVersion:'2026-10-13'}));localStorage.setItem('crosswise_recorder_settings_v1',JSON.stringify({enabled:true,autoStart:true,includeAudio:true,clipMinutes:1,maxClips:5,maxBytes:10000000}));});await page.reload();await expect(page.getByRole('button',{name:'Road crossing',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as unknown as {cameraRequests:number}).cameraRequests)).toBe(0);await settings(page);await expect(page.getByRole('button',{name:/Startup|record|Account|Monitoring|Advanced|Presenter/i})).toHaveCount(0);
});
test('help and audio tests have no cloud or unsupported capability links',async({page})=>{
 await home(page);await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('button',{name:/Account|Backup|Insurance|Research access|Direction check|Object voice practice/})).toHaveCount(0);await page.getByRole('button',{name:'Test audio',exact:true}).click();for(const name of ['Test left','Test centre','Test right','Test speech'])await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('status')).toContainText(/Right audio test\.|Audio unavailable\. Check your device volume and browser audio permissions\./);await back(page);await page.getByRole('button',{name:'Privacy and local data',exact:true}).click();await expect(page.getByText('The demo does not upload camera images or share your live location with other users.',{exact:false})).toBeVisible();
});
