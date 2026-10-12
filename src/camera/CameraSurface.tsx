import { useEffect, useRef } from 'react';
import { controller } from '../state/controller';
import type {createCameraScene} from '../rendering/cameraScene';
export function CameraSurface({showPreview,active=true}:{showPreview:boolean;active?:boolean;resizeMode:string;style:unknown}){
 const video=useRef<HTMLVideoElement>(null),host=useRef<HTMLDivElement>(null);
 const scene=useRef<Awaited<ReturnType<typeof createCameraScene>>|null>(null),visible=useRef(showPreview&&active);
 visible.current=showPreview&&active;
 useEffect(()=>{
  let disposed=false;
  const source=video.current!,container=host.current!;
  void controller.attachCamera(source);
  void import('../rendering/cameraScene').then(m=>m.createCameraScene(source,container)).then(value=>{
   if(disposed)value.dispose();else{scene.current=value;value.setVisible(visible.current);}
  }).catch(()=>{/* Unsupported graphics retain the original video preview. */});
  return ()=>{disposed=true;scene.current?.dispose();scene.current=null;controller.detachCamera();};
 },[]);
 useEffect(()=>{scene.current?.setVisible(showPreview&&active);},[showPreview,active]);
 return <div ref={host} style={{position:'absolute',inset:0,overflow:'hidden'}}>
  <video ref={video} playsInline muted aria-label="Camera preview" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:showPreview?1:0}} />
 </div>;
}
