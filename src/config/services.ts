export const services = {
  mapsRestApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
  mapsBrowserKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
  mapsProxyEnabled: false,
  geminiApiKey: "",
};
export let nativeMapConfigured=!!services.mapsBrowserKey;
export const googleApplicationHeaders=()=>({});
export async function loadRuntimeConfiguration(){
 let config:{mapsProxyEnabled?:boolean;mapsBrowserKey?:string}|null=null;
 try{const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(response.ok){config=await response.json();try{localStorage.setItem('crosswise_runtime_config',JSON.stringify(config));}catch{/* Storage unavailable. */}}}catch{/* Offline launch uses the last successful public configuration. */}
 if(!config)try{config=JSON.parse(localStorage.getItem('crosswise_runtime_config')??'null');}catch{/* Corrupt settings. */}
 if(config){services.mapsProxyEnabled=config.mapsProxyEnabled===true;services.mapsBrowserKey=typeof config.mapsBrowserKey==='string'?config.mapsBrowserKey:'';services.mapsRestApiKey=services.mapsProxyEnabled?'server':services.mapsBrowserKey;nativeMapConfigured=!!services.mapsBrowserKey;}
}
