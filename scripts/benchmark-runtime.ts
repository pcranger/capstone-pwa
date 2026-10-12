import * as tf from '@tensorflow/tfjs-core';
import * as coco from '@tensorflow-models/coco-ssd';
import {loadBrowserDetector} from '../src/perception/browserDetector';
import {createCameraScene} from '../src/rendering/cameraScene';

const percentile=(values:number[],fraction:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))]??0;
const sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
export async function benchmark(mode:'baseline'|'webgl'|'webgpu'|'cpu',seconds=20){
 const video=document.createElement('video');video.src='/benchmark-input.mp4';video.muted=true;video.playsInline=true;video.loop=true;
 await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(new Error('Video could not be decoded.'));});
 const input={width:video.videoWidth,height:video.videoHeight,durationSeconds:video.duration};
 const canvas=document.createElement('canvas'),gray=document.createElement('canvas');gray.width=160;gray.height=120;
 const ctx=canvas.getContext('2d')!,gctx=gray.getContext('2d',{willReadFrequently:true})!;
 const start=performance.now();
 let detector:Awaited<ReturnType<typeof loadBrowserDetector>>|coco.ObjectDetection;
 if(mode==='baseline'){await tf.setBackend('webgl');await tf.ready();detector=await coco.load({base:'lite_mobilenet_v2',modelUrl:new URL('/models/model.json',location.href).href});}
 else detector=await loadBrowserDetector(mode!=='cpu',[mode]);
 const loadMs=performance.now()-start;
 const host=document.createElement('div');Object.assign(host.style,{position:'fixed',inset:'0',width:'390px',height:'844px'});document.body.appendChild(host);
 let scene:Awaited<ReturnType<typeof createCameraScene>>|undefined;
 if(mode!=='baseline')scene=await createCameraScene(video,host);
 else {host.appendChild(video);Object.assign(video.style,{width:'100%',height:'100%',objectFit:'cover'});}
 const aspect=input.width/input.height;
 canvas.width=mode==='baseline'?input.width:aspect>=1?Math.round(300*aspect):300;
 canvas.height=mode==='baseline'?input.height:aspect>=1?300:Math.round(300/aspect);
 const samples=[];
 await video.play();
 for(let i=0;i<8;i++){
  const time=Math.min(input.durationSeconds-.1,(i+.5)*input.durationSeconds/8);
  await new Promise<void>(resolve=>{video.onseeked=()=>resolve();video.currentTime=time;});
  await new Promise<void>(resolve=>video.requestVideoFrameCallback(()=>resolve()));
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const boxes=await detector.detect(canvas,20,.5);
  samples.push({time,capturedTime:video.currentTime,objects:boxes.map(p=>({label:p.class,score:p.score,box:p.bbox.map((n,j)=>n/(j%2?canvas.height:canvas.width))}))});
  if(i===4){
   const display=document.createElement('canvas');display.width=input.width;display.height=input.height;const d=display.getContext('2d')!;d.drawImage(video,0,0);d.lineWidth=4;d.font='24px sans-serif';d.strokeStyle='#00e5ff';d.fillStyle='#00e5ff';
   for(const p of boxes){const b=p.bbox.map((n,j)=>n*(j%2?input.height/canvas.height:input.width/canvas.width));d.strokeRect(...b as [number,number,number,number]);d.fillText(`${p.class} ${(p.score*100).toFixed(0)}%`,b[0],Math.max(26,b[1]-8));}
   host.dataset.sampleImage=display.toDataURL('image/png');
  }
 }
 video.currentTime=0;await video.play();
 const inference:number[]=[],processing:number[]=[],cycle:number[]=[],counts:number[]=[];
 const begun=performance.now();let previous=begun;const tensorsBefore=tf.memory().numTensors;
 while(performance.now()-begun<seconds*1000){
  await new Promise<void>(r=>video.requestVideoFrameCallback(()=>r()));
  const frame=performance.now();
  // Baseline resizes and copies the full frame on every iteration, as the deployed version did.
  if(mode==='baseline'){canvas.width=input.width;canvas.height=input.height;}
  ctx.drawImage(video,0,0,canvas.width,canvas.height);gctx.drawImage(canvas,0,0,160,120);
  const pixels=gctx.getImageData(0,0,160,120).data;let brightness=0;for(let i=0;i<pixels.length;i+=4)brightness+=pixels[i]*77+pixels[i+1]*150+pixels[i+2]*29;
  const infer=performance.now(),boxes=await detector.detect(canvas,20,.5);inference.push(performance.now()-infer);processing.push(performance.now()-frame);counts.push(boxes.filter(p=>['car','truck','bus','motorcycle','bicycle'].includes(p.class)).length);
  if(!Number.isFinite(brightness))throw new Error('Invalid frame.');
  cycle.push(performance.now()-previous);previous=performance.now();
  if(mode==='baseline')await sleep(150);
 }
 const elapsed=performance.now()-begun,tensorsAfter=tf.memory().numTensors;
 const result={mode,backend:tf.getBackend(),input,detectorInput:{width:canvas.width,height:canvas.height},loadMs,frames:inference.length,elapsedMs:elapsed,fps:inference.length*1000/elapsed,inferenceMedianMs:percentile(inference,.5),inferenceP95Ms:percentile(inference,.95),processingMedianMs:percentile(processing,.5),processingP95Ms:percentile(processing,.95),cycleP95Ms:percentile(cycle,.95),framesOver250Ms:processing.filter(t=>t>250).length,framesOver2500Ms:processing.filter(t=>t>2500).length,framesWithVehicles:counts.filter(n=>n>0).length,meanVehicles:counts.reduce((a,b)=>a+b,0)/counts.length,tensorsBefore,tensorsAfter,renderer:host.querySelector('canvas[data-camera-renderer]')?.getAttribute('data-camera-renderer')??'native-video',renderedFrames:host.querySelector('canvas[data-camera-renderer]')?.getAttribute('data-rendered-frames'),samples,sampleImage:host.dataset.sampleImage};
 video.pause();scene?.dispose();detector.dispose();host.remove();video.remove();return result;
}
