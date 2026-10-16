import type { PedestrianScene } from './pedestrianTypes';
import { PEDESTRIAN_MAX_AGE_MS } from './pedestrianPolicy';
export type PedestrianIndicator = {color:'grey'|'red'|'green'|'yellow';label:string;seconds:number|null};
const unknown = (): PedestrianIndicator => ({color:'grey',label:'Pedestrian light not detected',seconds:null});
/** Display-only blink estimate from repeated observations of one pedestrian symbol.
 * Generic vehicle-light phases are deliberately excluded. This never authorises crossing.
 */
export class PedestrianIndicatorTracker {
  private phase: 'GREEN'|'RED'|null=null;
  private position:{x:number;y:number}|null=null;
  private transitions:{at:number;on:boolean}[]=[];
  private lastTimestamp=-Infinity;
  private lastSeen=-Infinity;
  reset(){this.phase=null;this.position=null;this.transitions=[];this.lastTimestamp=-Infinity;this.lastSeen=-Infinity;}
  update(scene:PedestrianScene,now:number,cameraFresh:boolean):PedestrianIndicator {
    if(!cameraFresh||scene.error||now<scene.timestampMs||now-scene.timestampMs>PEDESTRIAN_MAX_AGE_MS){this.reset();return unknown();}
    const signals=scene.observations.filter(o=>o.kind==='signal');
    const timers=scene.observations.filter(o=>o.kind==='countdown');
    const values=timers.map(o=>o.seconds);
    const seconds=values.length&&values.every(v=>Number.isInteger(v)&&v!>=0&&v!<=99)&&new Set(values).size===1?values[0]!:null;
    if(signals.length>1||signals.some(o=>o.phase==='UNKNOWN')){this.reset();return {...unknown(),label:'Pedestrian light unclear',seconds};}
    const signal=signals[0];
    if(scene.timestampMs!==this.lastTimestamp){
      if(scene.timestampMs-this.lastTimestamp>700)this.transitions=[];
      if(signal){
        if(this.phase!==signal.phase||this.position&&Math.hypot(signal.box.centerX-this.position.x,signal.box.centerY-this.position.y)>.12)this.transitions=[];
        this.phase=signal.phase as 'GREEN'|'RED';this.position={x:signal.box.centerX,y:signal.box.centerY};this.lastSeen=scene.timestampMs;
      }
      const on=!!signal;
      if(this.transitions.at(-1)?.on!==on)this.transitions.push({at:scene.timestampMs,on});
      this.transitions=this.transitions.filter(t=>scene.timestampMs-t.at<=3000);
      this.lastTimestamp=scene.timestampMs;
    }
    const intervals=this.transitions.slice(1).map((t,i)=>t.at-this.transitions[i].at);
    const blinking=intervals.length>=4&&intervals.every(ms=>ms>=150&&ms<=900)&&now-this.lastSeen<=900;
    if(blinking)return {color:'yellow',label:'Possible blinking pedestrian light',seconds};
    if(!signal)return {...unknown(),seconds};
    return {color:signal.phase==='RED'?'red':'green',label:`${signal.phase==='RED'?'Red':'Green'} pedestrian light observed`,seconds};
  }
}
