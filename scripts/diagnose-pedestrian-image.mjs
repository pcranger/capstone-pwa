import {chromium,webkit,expect} from '@playwright/test';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
const input=process.argv[2];
const expectedPhase=process.argv[5];
const base=process.argv[3]??'https://capstone-pwa.fly.dev',folder=process.argv[4]??'artifacts/pedestrian/current-report';
await mkdir(folder,{recursive:true});
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true,...(name==='chromium'?{channel:'chrome'}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  if(expectedPhase){expect(await(await context.request.get(base+'/sw.js')).text()).toBe(await readFile('dist/sw.js','utf8'));expect((await context.request.get(base+'/healthz')).ok()).toBe(true);}
  await context.addInitScript(()=>{
   Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});
   Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted'})},configurable:true});
   if(window.DeviceOrientationEvent)Object.defineProperty(window.DeviceOrientationEvent,'requestPermission',{value:undefined,configurable:true});
   localStorage.setItem('crosswise_product_preferences_v1',JSON.stringify({version:1,termsVersion:'2026-10-13'}));
   window.__pedestrianMeasurements=[];
   const OriginalWorker=window.Worker;
   window.Worker=class extends OriginalWorker{
    constructor(...args){super(...args);this.sent=performance.now();this.addEventListener('message',e=>{if(['ready','result','error'].includes(e.data?.type))window.__pedestrianMeasurements.push({elapsedMs:performance.now()-this.sent,message:e.data});});}
    postMessage(message,...args){this.sent=performance.now();return super.postMessage(message,...args);}
   };
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);await page.goto(base);
  console.log(`${name}: opened ${base}`);
  if(expectedPhase){await expect(page.getByRole('heading',{name:'Preparing offline voice',exact:true})).toBeHidden();await expect(page.getByRole('button',{name:'Road crossing',exact:true})).toBeVisible();await expect(page.getByText('Plan your route. Stay informed at the crossing.',{exact:true})).toHaveCount(0);await page.screenshot({path:`${folder}/home-${name}.png`});}
  await page.getByRole('button',{name:'Help',exact:true}).click();await page.getByText('Check a reference image',{exact:true}).click();
  await page.getByLabel('Pedestrian reference image',{exact:true}).setInputFiles(input);
  await expect(page.getByRole('status')).toHaveText(/Image check complete\.|No supported pedestrian|Pedestrian detection unavailable/,{timeout:90000});
  const measurements=await page.evaluate(()=>window.__pedestrianMeasurements);
  const report={name,status:await page.getByRole('status').innerText(),measurements};
  await writeFile(`${folder}/${name}.json`,JSON.stringify(report,null,2));
  await page.getByTestId('pedestrian-image-result').screenshot({path:`${folder}/${name}.png`});
  if(expectedPhase)expect(measurements.flatMap(m=>m.message.observations??[]).some(o=>o.kind==='signal'&&o.phase===expectedPhase)).toBe(true);
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
