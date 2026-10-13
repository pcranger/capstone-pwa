import {describe,it,expect} from 'vitest';
import {AnnouncementScheduler,ObjectAnnouncementFilter,engineAnnouncements} from '../../src/product/announcementScheduler';
import {Cues,Phrase,Priority} from '../../src/feedback/cue';
describe('announcement scheduling',()=>{
 it('preempts ordinary speech for urgent events and drops expired waiting speech',async()=>{let now=0;const spoken:string[]=[];const finish:Array<(ok:boolean)=>void>=[];const q=new AnnouncementScheduler(t=>{spoken.push(t);return new Promise(r=>finish.push(r));},()=>{},()=>now);
  const first=q.enqueue({text:'person',priority:40,key:'person',expiresAt:10});const old=q.enqueue({text:'shop',priority:30,key:'shop',expiresAt:2});const urgent=q.enqueue({text:'warning',priority:100,key:'warning',expiresAt:100});expect(await first).toBe(false);expect(spoken).toEqual(['person','warning']);now=5;finish[1](true);expect(await urgent).toBe(true);expect(await old).toBe(false);
 });
 it('deduplicates and cancellation resolves every pending request',async()=>{const q=new AnnouncementScheduler(()=>new Promise(()=>{}),()=>{},()=>0);const p=q.enqueue({text:'a',priority:1,key:'a',expiresAt:20});expect(await q.enqueue({text:'a',priority:1,key:'a',expiresAt:20})).toBe(false);q.cancel();expect(await p).toBe(false);});
 it('stopping preview cancels ordinary speech without interrupting a critical crossing warning',async()=>{
  let finish:(ok:boolean)=>void=()=>{};let stops=0;const spoken:string[]=[];
  const q=new AnnouncementScheduler(text=>{spoken.push(text);return new Promise(resolve=>{finish=resolve;});},()=>{stops++;},()=>0);
  const critical=q.enqueue({text:'critical',priority:100,key:'critical',expiresAt:100});const preview=q.enqueue({text:'preview',priority:80,key:'preview',expiresAt:100});
  q.cancelBelow(100);expect(await preview).toBe(false);expect(stops).toBe(0);expect(spoken).toEqual(['critical']);finish(true);expect(await critical).toBe(true);
 });
 it('filters side objects and applies global and class cooldowns',()=>{const f=new ObjectAnnouncementFilter();const p={class:'person',bbox:[0,0,10,10] as [number,number,number,number],score:.9};expect(f.choose([p],100,{objectRange:'front',objects:{person:true}},0)).toBeNull();expect(f.choose([p],100,{objectRange:'sides',objects:{person:true}},0)).toBe('person');expect(f.choose([p],100,{objectRange:'sides',objects:{person:true}},3000)).toBeNull();expect(f.choose([p],100,{objectRange:'sides',objects:{person:true}},9000)).toBe('person');});
 it('preserves engine cue priorities and never merges a critical vehicle warning with ordinary speech',()=>{
  const events=engineAnnouncements([Cues.speakText('Ordinary status.',Priority.NORMAL),Cues.speak(Phrase.VEHICLE_CLOSE_LEFT,Priority.CRITICAL),Cues.speakText('Scan instruction.',Priority.HIGH)],1000);
  expect(events.map(e=>e.priority)).toEqual([100,90,60]);expect(events[0].text).not.toContain('Ordinary');expect(events[0].expiresAt).toBe(3000);expect(events[2].expiresAt).toBe(6000);
  expect(engineAnnouncements([Cues.speakText('Explicit repeat.',Priority.NORMAL)],0,80)[0].priority).toBe(80);
 });
 it('critical engine warnings interrupt status, and delayed vehicle observations expire instead of replaying',async()=>{
  let now=0,stopCount=0;const spoken:string[]=[];const finish:Array<(ok:boolean)=>void>=[];
  const queue=new AnnouncementScheduler(text=>{spoken.push(text);return new Promise(resolve=>finish.push(resolve));},()=>{stopCount++;},()=>now);
  const status=queue.enqueue(engineAnnouncements([Cues.speakText('Normal status.',Priority.NORMAL)],now)[0]);
  const urgent=queue.enqueue(engineAnnouncements([Cues.speak(Phrase.VEHICLE_CLOSE_LEFT,Priority.CRITICAL)],now)[0]);
  const stale=queue.enqueue(engineAnnouncements([Cues.speak(Phrase.VEHICLE_RIGHT,Priority.HIGH)],now)[0]);
  expect(await status).toBe(false);expect(stopCount).toBe(1);expect(spoken).toHaveLength(2);now=2500;finish[1](true);expect(await urgent).toBe(true);expect(await stale).toBe(false);expect(spoken).toHaveLength(2);
 });
});
