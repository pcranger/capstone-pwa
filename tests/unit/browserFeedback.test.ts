import {afterEach,expect,test,vi} from 'vitest';
import {Feedback} from '../../src/browser';
import {notesFor,renderTone} from '../../src/feedback/toneSynth';
import {ToneKind} from '../../src/feedback/cue';
afterEach(()=>vi.unstubAllGlobals());
test('cancelling speech settles a voice turn immediately instead of waiting for a missing browser end event',async()=>{
 class Utterance {lang='';rate=1;onend:(()=>void)|null=null;onerror:(()=>void)|null=null;constructor(public text:string){}}
 const speak=vi.fn();vi.stubGlobal('window',{speechSynthesis:{cancel:vi.fn(),speak}});vi.stubGlobal('SpeechSynthesisUtterance',Utterance);vi.stubGlobal('navigator',{vibrate:vi.fn()});
 const feedback=new Feedback({speech:true,tones:false,haptics:false,speechRate:0.85});const pending=feedback.sayAndWait('Listening.');expect(speak.mock.calls[0][0].rate).toBe(0.85);feedback.cancel();await expect(pending).resolves.toBe(false);
});
test('all native practice earcons have distinct notes and equal-power stereo panning',()=>{
 const vocab=new Set<string>();for(const kind of Object.values(ToneKind)){
  vocab.add(JSON.stringify(notesFor(kind)[0]));
  const power=(pan:number)=>{const [left,right]=renderTone(kind,pan,48000);return left.reduce((sum,l,i)=>sum+l*l+right[i]*right[i],0);};
  expect(power(-1)).toBeCloseTo(power(0),3);expect(power(1)).toBeCloseTo(power(0),3);
 }expect(vocab.size).toBe(Object.values(ToneKind).length);
});
