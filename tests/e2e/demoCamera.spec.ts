import {test,expect,type Page} from './fixtures';
test.beforeEach(async({page,browserName})=>{
 test.skip(browserName==='webkit','Synthetic captureStream is unavailable in this runner; physical iPhone camera verification remains required.');
 await page.addInitScript(()=>{Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});});
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{const source=document.createElement('canvas');source.width=640;source.height=360;const context=source.getContext('2d')!;let frame=0;const draw=()=>{context.fillStyle=frame++%2?'#4088b0':'#164c79';context.fillRect(0,0,640,360);requestAnimationFrame(draw);};draw();return source.captureStream(20);};});
 await page.goto('/');await page.getByRole('button',{name:'Agree and continue',exact:true}).click();
 await expect(page.getByRole('heading',{name:'CrossWise',exact:true})).toBeFocused();
});
async function camera(page:Page){await page.getByRole('button',{name:'Road crossing',exact:true}).click();await page.getByRole('button',{name:'Allow camera',exact:true}).click();await expect.poll(async()=>{await page.getByRole('button',{name:'Start camera assistance',exact:true}).click();return page.getByRole('button',{name:'Start crossing',exact:true}).count();},{timeout:45000,intervals:[1000]}).toBe(1);await expect.poll(async()=>Number(await page.locator('canvas[data-camera-renderer]').getAttribute('data-rendered-frames'))).toBeGreaterThan(0);}

test('idle camera stays unobstructed with compact icon counters and dismissible descriptions',async({page},info)=>{
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('switch',{name:'Developer camera view',exact:false}).check();
 await page.getByRole('button',{name:'‹ Back',exact:true}).click();
 await page.getByRole('button',{name:'Road crossing',exact:true}).click();
 await page.getByRole('button',{name:'Allow camera',exact:true}).click();
 await expect.poll(async()=>Number(await page.locator('canvas[data-camera-renderer]').getAttribute('data-rendered-frames')),{timeout:45000}).toBeGreaterThan(0);
 await expect(page.getByTestId('camera-notification')).toHaveCount(0,{timeout:30000});
 await expect(page.getByText('Camera assistance is off.',{exact:true})).toHaveCount(0);
 const indicators=page.getByTestId('camera-indicators');
 await expect(indicators).toHaveText(/^[\d—]+$/);
 expect((await indicators.boundingBox())!.height).toBeLessThanOrEqual(40);
 await page.screenshot({path:`artifacts/compact-camera-${info.project.name}.png`});
 await page.getByRole('button',{name:'Describe camera view',exact:true}).click();
 await expect(page.getByText(/^Camera snapshot at/)).toBeVisible();
 expect((await page.getByTestId('camera-notification').boundingBox())!.height).toBeLessThanOrEqual(120);
 await page.getByRole('button',{name:'Dismiss camera description',exact:true}).click();
 await expect(page.getByTestId('camera-notification')).toHaveCount(0);
});

test('camera description announces a snapshot and excludes observations after camera stops',async({page})=>{
 await camera(page);
 const describe=page.getByRole('button',{name:'Describe camera view',exact:true});
 await describe.click();
 const snapshot=page.getByText(/^Camera snapshot at/);
 await expect(snapshot).toHaveAttribute('aria-live','polite');
 await expect(snapshot).toContainText('Image position is not a distance or a clear-path assessment.');
 await expect(snapshot).not.toContainText('No current image observations are available.');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.srcObject===null)).toBe(true);
 await describe.click();
 await expect(snapshot).toContainText('No current image observations are available.');
});
test('demo live detector keeps crossing across settings and blocks ending before footpath confirmation',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await camera(page);await page.getByRole('button',{name:'Already in the road — get assistance',exact:true}).click();const video=await page.locator('video').evaluateHandle(v=>v);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Feedback and voice',exact:false}).click();await page.getByRole('switch',{name:'Mono audio',exact:true}).check();await page.getByRole('button',{name:'‹ Back',exact:true}).click();await page.getByRole('button',{name:'‹ Back',exact:true}).click();expect(await page.locator('video').evaluate((v,original)=>v===original,video)).toBe(true);await expect(page.getByRole('button',{name:'I’m on the footpath',exact:true})).toBeVisible();await page.getByRole('button',{name:'End walk',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End walk',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Confirm the far footpath');await page.getByRole('button',{name:'I’m on the footpath',exact:true}).click();await page.getByRole('button',{name:'End walk',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'End walk',exact:true}).click();await expect(page.getByRole('button',{name:'Road crossing',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
test('demo backgrounding releases camera but preserves unfinished crossing',async({page})=>{
 await camera(page);await page.getByRole('button',{name:'Already in the road — get assistance',exact:true}).click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});expect(await page.locator('video').evaluate((v:HTMLVideoElement)=>v.srcObject)).toBeNull();await expect(page.getByRole('button',{name:'I’m on the footpath',exact:true})).toBeVisible();await page.getByRole('button',{name:'I’m on the footpath',exact:true}).click();await expect(page.getByRole('button',{name:'I’m on the footpath',exact:true})).toHaveCount(0);
});
test('demo offline reload retains local model inference and help',async({page,context})=>{
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});await context.setOffline(true);await page.reload();await camera(page);await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('heading',{name:'Start a walk',exact:true})).toBeVisible();
});
test.describe('demo model failure recovery',()=>{
 test.use({serviceWorkers:'block'});
 test('failed download releases camera and retry restores real inference',async({page})=>{
 await page.route('**/models/model.json',r=>r.fulfill({status:503,body:'Unavailable'}));await page.getByRole('button',{name:'Road crossing',exact:true}).click();await page.getByRole('button',{name:'Allow camera',exact:true}).click();await expect(page.getByRole('button',{name:'Retry camera',exact:true})).toBeVisible({timeout:30000});expect(await page.locator('video').evaluate((v:HTMLVideoElement)=>v.srcObject)).toBeNull();await page.unroute('**/models/model.json');await page.getByRole('button',{name:'Retry camera',exact:true}).click();await expect.poll(async()=>{await page.getByRole('button',{name:'Start camera assistance',exact:true}).click();return page.getByRole('button',{name:'Start crossing',exact:true}).count();},{timeout:45000,intervals:[1000]}).toBe(1);
 });
});
