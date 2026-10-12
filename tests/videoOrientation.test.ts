import {describe,it,expect} from 'vitest';
import {needsCanvasVideoTexture} from '../src/platform/videoOrientation';
describe('iOS camera texture normalization',()=>{
 it('uses canvas frames for iPhones and iPads',()=>{
  for(const userAgent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)','Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X)'])expect(needsCanvasVideoTexture({userAgent,platform:'iPhone',maxTouchPoints:5})).toBe(true);
 });
 it('recognizes iPadOS desktop browsing without changing desktop Macs',()=>{
  expect(needsCanvasVideoTexture({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5})).toBe(true);
  expect(needsCanvasVideoTexture({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0})).toBe(false);
 });
 it('keeps direct textures on Android',()=>expect(needsCanvasVideoTexture({userAgent:'Mozilla/5.0 (Linux; Android 16)',platform:'Linux',maxTouchPoints:5})).toBe(false));
});
