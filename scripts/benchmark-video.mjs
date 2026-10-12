import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const source=process.argv[2];if(!source)throw new Error('Pass the local test video path.');
const video=await readFile(source),base=process.env.BENCHMARK_BASE_URL??'http://localhost:4175';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
const results=process.env.BENCHMARK_MODES?JSON.parse(await readFile('artifacts/benchmark/results.json','utf8')):[];await mkdir('artifacts/benchmark',{recursive:true});
try{
 for(const mode of (process.env.BENCHMARK_MODES?.split(',')??['baseline','webgl','webgpu'])){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
  const warnings=[];page.on('console',m=>{if(m.type()==='error'||m.type()==='warn')warnings.push(m.text())});page.on('pageerror',e=>warnings.push(e.message));
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Benchmark uses a local video.','NotAllowedError')};});
  await page.route('**/benchmark-input.mp4',r=>{
   const match=r.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
   if(!match)return r.fulfill({contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'},body:video});
   const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),video.length-1):video.length-1;
   return r.fulfill({status:206,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${video.length}`},body:video.subarray(start,end+1)});
  });
  await page.goto(base);await page.waitForTimeout(1500);
  const hardware=await page.evaluate(async()=>{const adapter=await navigator.gpu?.requestAdapter();return {userAgent:navigator.userAgent,gpu:!!navigator.gpu,adapter:adapter?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter}:null}});
  console.log(`Running ${mode} benchmark…`);
  const result=await page.evaluate(async mode=>{const {benchmark}=await import('/scripts/benchmark-runtime.ts');return benchmark(mode,20)},mode);
  if(result.sampleImage){await writeFile(`artifacts/benchmark/${mode}-detections.png`,Buffer.from(result.sampleImage.split(',')[1],'base64'));delete result.sampleImage;}
  results.push({...result,hardware,warnings});await writeFile('artifacts/benchmark/results.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify({mode,backend:result.backend,fps:result.fps,medianMs:result.inferenceMedianMs,p95Ms:result.inferenceP95Ms,framesWithVehicles:result.framesWithVehicles,frames:result.frames,tensorGrowth:result.tensorsAfter-result.tensorsBefore}));
  await context.close();
 }
}finally{await browser.close();}
