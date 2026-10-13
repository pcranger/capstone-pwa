import { Priority, type Cue } from '../feedback/cue';
import { cueText } from '../strings';

export interface Announcement{text:string;priority:number;key:string;expiresAt:number}
interface Pending extends Announcement{resolve:(ok:boolean)=>void}
/** Keep urgent observations separate from ordinary status words, including in one engine frame. */
export function engineAnnouncements(cues: Cue[], now: number, minimumPriority = 0): Announcement[] {
  return cues.flatMap(cue => {
    if (cue.kind !== 'speak' && cue.kind !== 'speakText') return [];
    const text = cueText(cue); if (!text) return [];
    const priority = Math.max(minimumPriority,
      cue.priority === Priority.CRITICAL ? 100 : cue.priority === Priority.HIGH ? 90 : cue.priority === Priority.NORMAL ? 60 : 40);
    const hazard = cue.priority === Priority.CRITICAL || cue.kind === 'speak' && cue.phrase.startsWith('VEHICLE_');
    return [{ text, priority, key: `engine:${priority}:${text}`, expiresAt: now + (hazard ? 2000 : 5000) }];
  }).sort((a, b) => b.priority - a.priority);
}
/** One bounded, priority-aware queue. Expired descriptions never replay after urgent cues. */
export class AnnouncementScheduler{
  private active:Pending|null=null;private waiting:Pending[]=[];private generation=0;
  constructor(private speak:(text:string)=>Promise<boolean>,private stop:()=>void,private now=Date.now){}
  enqueue(event:Announcement):Promise<boolean>{
    if(!event.text||event.expiresAt<=this.now())return Promise.resolve(false);
    if(this.active?.key===event.key||this.waiting.some(p=>p.key===event.key))return Promise.resolve(false);
    return new Promise(resolve=>{
      const p={...event,resolve};
      if(this.active&&event.priority>this.active.priority){this.generation++;this.active.resolve(false);this.active=null;this.stop();}
      this.waiting.push(p);this.waiting.sort((a,b)=>b.priority-a.priority);
      if(this.waiting.length>8)this.waiting.pop()?.resolve(false);
      this.pump();
    });
  }
  private pump(){if(this.active)return;let p:Pending|undefined;while((p=this.waiting.shift())){if(p.expiresAt>this.now())break;p.resolve(false);p=undefined;}if(!p)return;this.active=p;const g=++this.generation;
    void this.speak(p.text).catch(()=>false).then(ok=>{if(g!==this.generation)return;p.resolve(ok);this.active=null;this.pump();});}
  cancel(){this.generation++;this.active?.resolve(false);this.active=null;this.waiting.forEach(p=>p.resolve(false));this.waiting=[];this.stop();}
  cancelPrefix(prefix:string){
    this.waiting=this.waiting.filter(p=>{if(!p.key.startsWith(prefix))return true;p.resolve(false);return false;});
    if(this.active?.key.startsWith(prefix)){this.generation++;this.active.resolve(false);this.active=null;this.stop();this.pump();}
  }
  cancelBelow(priority:number){
    this.waiting=this.waiting.filter(p=>{if(p.priority>=priority)return true;p.resolve(false);return false;});
    if(this.active&&this.active.priority<priority){this.generation++;this.active.resolve(false);this.active=null;this.stop();this.pump();}
  }
}
export class ObjectAnnouncementFilter{
  private last=new Map<string,number>();private recent=Number.NEGATIVE_INFINITY;
  choose(predictions:{class:string;bbox:[number,number,number,number];score:number}[],width:number,options:{objectRange:'front'|'sides';objects:Record<string,boolean>},now:number):string|null{
    if(now-this.recent<2000)return null;
    const eligible=predictions.filter(p=>options.objects[p.class]&&width>0&&(options.objectRange==='sides'||((p.bbox[0]+p.bbox[2]/2)/width>=.25&&(p.bbox[0]+p.bbox[2]/2)/width<=.75))&&now-(this.last.get(p.class)??Number.NEGATIVE_INFINITY)>=8000).sort((a,b)=>b.score-a.score);
    const p=eligible[0];if(!p)return null;this.recent=now;this.last.set(p.class,now);return p.class;
  }
  reset(){this.last.clear();this.recent=Number.NEGATIVE_INFINITY;}
}
