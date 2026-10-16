import { Store } from '../state/store';
export const PRODUCT_PREFERENCES_KEY='crosswise_product_preferences_v1';
export const OBJECT_TYPES=[['person','Person'],['bicycle','Bicycle'],['car','Car'],['truck','Truck'],['tactile_paving','Tactile paving'],['white_line','White road line'],['guardrail','Guardrail'],['crosswalk','Crosswalk'],['pedestrian_red','Red pedestrian signal'],['pedestrian_green','Green pedestrian signal'],['curb','Curb'],['shrubs','Shrubs'],['street_tree','Street trees'],['vending_machine','Vending machine'],['bollard','Bollard / vehicle barrier'],['pole','Pole / utility pole'],['fence','Fence'],['postbox','Postbox'],['wall','Wall'],['traffic_cone','Traffic cone']] as const;
export const SUPPORTED_OBJECTS=new Set<string>(['person','bicycle','car','truck']);
export const SPEECH_LEVELS=[40,50,55,60,70,80,90] as const;
export const SPEECH_RATES=[.6,.75,.85,1,1.2,1.5,1.8] as const;
export interface ProductPreferences{version:1;autoStroll:boolean;objectRange:'front'|'sides';objects:Record<string,boolean>;readerFriendly:boolean;textSize:'system'|'large'|'extra';mono:boolean;termsVersion:string|null}
export function defaultProductPreferences():ProductPreferences{return {version:1,autoStroll:false,objectRange:'front',objects:Object.fromEntries(OBJECT_TYPES.map(([id])=>[id,SUPPORTED_OBJECTS.has(id)])),readerFriendly:true,textSize:'system',mono:false,termsVersion:null};}
export function validateProductPreferences(value:unknown):ProductPreferences{
  const d=defaultProductPreferences();if(!value||typeof value!=='object')return d;const p=value as Partial<ProductPreferences>;
  if(p.version!==1)return d;
  return {...d,autoStroll:p.autoStroll===true,objectRange:p.objectRange==='sides'?'sides':'front',readerFriendly:p.readerFriendly!==false,mono:p.mono===true,textSize:p.textSize==='large'||p.textSize==='extra'?p.textSize:'system',termsVersion:typeof p.termsVersion==='string'?p.termsVersion:null,
    objects:Object.fromEntries(OBJECT_TYPES.map(([id])=>[id,SUPPORTED_OBJECTS.has(id)&&typeof p.objects?.[id]==='boolean'?p.objects[id]:d.objects[id]]))};
}
function load(){try{return validateProductPreferences(JSON.parse(localStorage.getItem(PRODUCT_PREFERENCES_KEY)??'null'));}catch{return defaultProductPreferences();}}
export const productPreferences=new Store<ProductPreferences>(load());
export function updateProductPreferences(change:(p:ProductPreferences)=>ProductPreferences){const next=validateProductPreferences(change(productPreferences.value));localStorage.setItem(PRODUCT_PREFERENCES_KEY,JSON.stringify(next));productPreferences.set(next);}
export function reloadProductPreferences(){productPreferences.set(load());}
export function speechLevelFor(rate:number){let best=0;SPEECH_RATES.forEach((v,i)=>{if(Math.abs(v-rate)<Math.abs(SPEECH_RATES[best]-rate))best=i;});return SPEECH_LEVELS[best];}
