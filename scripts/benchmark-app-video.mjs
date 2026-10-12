import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const body=await readFile(process.argv[2]);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/benchmark-input.mp4',r=>{
   const match=r.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
   if(!match)return r.fulfill({contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'},body:body});
   const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),body.length-1):body.length-1;
   return r.fulfill({status:206,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`},body:body.subarray(start,end+1)});
  });
 await page.addInitScript(()=>{
  localStorage.setItem('crosswise_settings',JSON.stringify({interfaceMode:'DEVELOPER',speech:false,tones:false,haptics:false}));
  navigator.mediaDevices.getUserMedia=async()=>{
   const source=document.createElement('video');source.src='/benchmark-input.mp4';source.muted=true;source.playsInline=true;source.loop=true;
   await source.play();return source.captureStream();
  };
 });
 await page.goto('http://localhost:4174');
 await page.getByRole('button',{name:'Open diagnostics',exact:true}).click();
 await expect(page.getByText(/COCO-SSD · TensorFlow.js webgpu/)).toBeVisible({timeout:45000});
 await page.getByRole('button',{name:'Start camera assistance',exact:true}).click();
 await expect(page.getByRole('button',{name:'I’m crossing',exact:true})).toBeVisible();
 const samples=[];
 for(let i=0;i<20;i++){
  samples.push(await page.locator('[data-testid="developer-telemetry"]').innerText());
  await page.waitForTimeout(1000);
 }
 const readings=samples.map(text=>{const match=text.match(/(\d+) FPS · (\d+) ms/);return match?{fps:Number(match[1]),inferenceMs:Number(match[2]),tracks:Number(text.match(/TRACKS · (\d+)/)?.[1]??0)}:null}).filter(Boolean);
 await page.screenshot({path:'artifacts/benchmark/app-phone.png'});
 const result={seconds:20,readings,errors,renderer:await page.locator('canvas[data-camera-renderer]').getAttribute('data-camera-renderer'),renderedFrames:Number(await page.locator('canvas[data-camera-renderer]').getAttribute('data-rendered-frames'))};
 expect(errors).toEqual([]);expect(readings.length).toBeGreaterThan(15);expect(result.renderedFrames).toBeGreaterThan(0);
 await writeFile('artifacts/benchmark/app-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
