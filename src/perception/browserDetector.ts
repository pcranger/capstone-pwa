import * as tf from '@tensorflow/tfjs-core';
import {loadGraphModel, type GraphModel} from '@tensorflow/tfjs-converter';
import {CLASSES} from '@tensorflow-models/coco-ssd/dist/classes';
import type {DetectedObject} from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-cpu';
import '@tensorflow/tfjs-backend-webgl';
import {needsCanvasVideoTexture} from '../platform/videoOrientation';

export interface Candidate {index:number; score:number; category:number; box:number[]}
/** Same class-agnostic suppression policy as the bundled COCO wrapper, without GPU dataSync. */
export function selectDetections(scores:ArrayLike<number>,boxes:ArrayLike<number>,classCount:number,threshold:number,max:number):Candidate[]{
 const candidates:Candidate[]=[];
 for(let i=0;i<scores.length/classCount;i++){
  let score=-Infinity,category=0;
  for(let c=0;c<classCount;c++)if(scores[i*classCount+c]>score){score=scores[i*classCount+c];category=c+1;}
  if(score>=threshold)candidates.push({index:i,score,category,box:Array.from({length:4},(_,j)=>boxes[i*4+j])});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const selected:Candidate[]=[];
 for(const candidate of candidates){
  if(selected.some(other=>{
   const a=candidate.box,b=other.box;
   const overlap=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
   const union=Math.max(0,a[2]-a[0])*Math.max(0,a[3]-a[1])+Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1])-overlap;
   return union>0&&overlap/union>threshold;
  }))continue;
  selected.push(candidate);if(selected.length>=max)break;
 }
 return selected;
}

export class BrowserDetector {
 constructor(private graph:GraphModel,public readonly backend:string){}
 async detect(input:HTMLCanvasElement,max=20,threshold=0.5):Promise<DetectedObject[]>{
  const batch=tf.tidy(()=>tf.expandDims(tf.browser.fromPixels(input),0));
  let outputs:tf.Tensor[]=[];
  try{
   outputs=await this.graph.executeAsync(batch) as tf.Tensor[];
   const [scores,boxes]=await Promise.all(outputs.map(t=>t.data()));
   return selectDetections(scores,boxes,outputs[0].shape[2]!,threshold,max).map(p=>({
    class:CLASSES[p.category]?.displayName??'unknown',score:p.score,
    bbox:[p.box[1]*input.width,p.box[0]*input.height,(p.box[3]-p.box[1])*input.width,(p.box[2]-p.box[0])*input.height],
   }));
  }finally{batch.dispose();tf.dispose(outputs);}
 }
 dispose(){this.graph.dispose();}
}
export async function loadBrowserDetector(useGpu:boolean, requestedBackends?:string[]):Promise<BrowserDetector>{
 const backends=requestedBackends??(useGpu?['webgpu','webgl','cpu']:['cpu']);
 for(const backend of backends){
  let graph:GraphModel|undefined;
  try{
   if(backend==='webgpu'){
    if(!navigator.gpu)continue;
    await import('@tensorflow/tfjs-backend-webgpu');
    if(needsCanvasVideoTexture())tf.env().set('WEBGPU_IMPORT_EXTERNAL_TEXTURE',false);
   }
   if(!await tf.setBackend(backend))continue;
   await tf.ready();
   graph=await loadGraphModel(new URL('models/model.json',document.baseURI).href);
   const detector=new BrowserDetector(graph,backend);
   const warmup=document.createElement('canvas');warmup.width=300;warmup.height=300;
   warmup.getContext('2d')!.fillRect(0,0,300,300);
   await detector.detect(warmup);
   return detector;
  }catch(error){console.warn(`Detection backend ${backend} unavailable.`,error instanceof Error?error.message:'Initialization failed.');graph?.dispose();}
 }
 throw new Error('Detection unavailable. Retry camera.');
}
