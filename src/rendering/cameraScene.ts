import {WebGPURenderer, Scene, OrthographicCamera, PlaneGeometry, MeshBasicMaterial, Mesh, VideoTexture, CanvasTexture, type Texture, SRGBColorSpace} from 'three/webgpu';
import {needsCanvasVideoTexture} from '../platform/videoOrientation';

/** Flat camera scene: identical cover crop to the native preview, no added visual elements. */
export async function createCameraScene(video:HTMLVideoElement,host:HTMLElement){
 const renderer=new WebGPURenderer({antialias:false,alpha:false});
 try{await renderer.init();}catch(error){renderer.dispose();throw error;}
 const canonical=needsCanvasVideoTexture();
 const staging=canonical?document.createElement('canvas'):null;
 const stagingContext=staging?.getContext('2d');
 if(staging&&!stagingContext){renderer.dispose();throw new Error('Camera frame normalization unavailable.');}
 const canvas=renderer.domElement;
 canvas.dataset.cameraSource=canonical?'oriented-canvas':'video';
 canvas.setAttribute('aria-hidden','true');canvas.dataset.cameraRenderer=('isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend)?'three-webgpu':'three-webgl';
 Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const scene=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,0.1,10);camera.position.z=1;
 const geometry=new PlaneGeometry(2,2),material=new MeshBasicMaterial({toneMapped:false});
 const plane=new Mesh(geometry,material);scene.add(plane);
 let texture:Texture|null=null,sourceWidth=0,sourceHeight=0,disposed=false,enabled=true,last=0,frames=0,failed=false;
 const resize=()=>{
  const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
  renderer.setSize(width,height,false);
  const ratio=(video.videoWidth||width)/(video.videoHeight||height)/(width/height);
  plane.scale.set(Math.max(1,ratio),Math.max(1,1/ratio),1);
 };
 const observer=new ResizeObserver(resize);observer.observe(host);host.appendChild(canvas);resize();
 renderer.setAnimationLoop(time=>{
  if(disposed||!enabled||document.hidden||video.readyState<2||time-last<33)return;
  last=time;
  if(video.videoWidth!==sourceWidth||video.videoHeight!==sourceHeight){
   texture?.dispose();
   if(staging){
    const scale=Math.min(1,720/Math.min(video.videoWidth,video.videoHeight));
    staging.width=Math.round(video.videoWidth*scale);staging.height=Math.round(video.videoHeight*scale);
    texture=new CanvasTexture(staging);texture.generateMipmaps=false;
   }else texture=new VideoTexture(video);
   texture.colorSpace=SRGBColorSpace;
   material.map=texture;material.needsUpdate=true;sourceWidth=video.videoWidth;sourceHeight=video.videoHeight;resize();
  }
  try{
   // Canvas drawImage applies video orientation before WebGPU imports the pixels.
   if(staging&&stagingContext&&texture){stagingContext.drawImage(video,0,0,staging.width,staging.height);texture.needsUpdate=true;}
   renderer.render(scene,camera);canvas.dataset.renderedFrames=String(++frames);video.style.opacity='0';}
  catch{failed=true;canvas.style.display='none';video.style.opacity=enabled?'1':'0';renderer.setAnimationLoop(null);}
 });
 return {
  setVisible(value:boolean){enabled=value;canvas.style.visibility=value?'visible':'hidden';video.style.opacity=value&&(frames===0||failed)?'1':'0';},
  dispose(){disposed=true;observer.disconnect();renderer.setAnimationLoop(null);texture?.dispose();material.dispose();geometry.dispose();renderer.dispose();canvas.remove();},
 };
}
