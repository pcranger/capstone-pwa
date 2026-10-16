import {expect,test} from 'vitest';
import {PedestrianIndicatorTracker} from '../../src/perception/pedestrianIndicator';
import type {PedestrianScene} from '../../src/perception/pedestrianTypes';
import {BoxF} from '../../src/core/geometry';
const scene=(t:number,on=true,phase:'RED'|'GREEN'='RED',seconds?:number):PedestrianScene=>({timestampMs:t,error:null,observations:[...(on?[{id:'s',kind:'signal' as const,box:new BoxF(.4,.2,.5,.4),phase,score:.9,source:'pretrained' as const}]:[]),...(seconds===undefined?[]:[{id:'c',kind:'countdown' as const,box:new BoxF(.4,.4,.5,.5),phase:'UNKNOWN' as const,score:.9,source:'ocr' as const,seconds}])]});
test('pedestrian indicator distinguishes red, green, unknown and countdown zero',()=>{
 const tracker=new PedestrianIndicatorTracker();
 expect(tracker.update(scene(100),100,true).color).toBe('red');
 expect(tracker.update(scene(200,true,'GREEN',0),200,true)).toMatchObject({color:'green',seconds:0});
 expect(tracker.update(scene(300,false),300,true).color).toBe('grey');
});
test('yellow requires repeated stable-position on/off observations; one lost frame is not blinking',()=>{
 const tracker=new PedestrianIndicatorTracker();
 for(let i=0;i<4;i++)expect(tracker.update(scene(i*400,i%2===0),i*400,true).color).not.toBe('yellow');
 expect(tracker.update(scene(1600),1600,true).color).toBe('yellow');
 expect(tracker.update(scene(1600),3000,true).color).toBe('red');
 expect(tracker.update(scene(1600),6601,true).color).toBe('grey');
});
test('camera interruption, conflicting signals and unknown countdown discard misleading state',()=>{
 const tracker=new PedestrianIndicatorTracker();
 expect(tracker.update(scene(100,true,'RED',12),100,false)).toMatchObject({color:'grey',seconds:null});
 const conflict=scene(200);conflict.observations.push({...conflict.observations[0],id:'second',phase:'GREEN'});
 expect(tracker.update(conflict,200,true).color).toBe('grey');
 const counts=scene(300,true,'RED',12);counts.observations.push({...counts.observations[1],id:'other',seconds:9});
 expect(tracker.update(counts,300,true).seconds).toBeNull();
});
