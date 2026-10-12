import {describe,it,expect} from 'vitest';
import {selectDetections} from '../src/perception/browserDetector';
describe('asynchronous detector postprocessing',()=>{
 it('selects the winning class and filters low-confidence predictions',()=>{
  expect(selectDetections([.2,.8,.1,.3],[0,0,1,1,0,0,.2,.2],2,.5,20)).toEqual([{index:0,score:.8,category:2,box:[0,0,1,1]}]);
 });
 it('suppresses overlapping boxes in score order and retains separate objects',()=>{
  expect(selectDetections([.8,.9,.7],[0,0,.5,.5,0,0,.5,.5,.6,.6,1,1],1,.5,20).map(x=>x.index)).toEqual([1,2]);
 });
 it('limits the number of boxes and safely handles zero-area boxes',()=>{
  expect(selectDetections([.8,.9],[0,0,0,0,.5,.5,.5,.5],1,.5,1).map(x=>x.index)).toEqual([1]);
  expect(selectDetections([],[],1,.5,20)).toEqual([]);
 });
});
