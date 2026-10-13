import { describe, expect, it } from 'vitest';
import { BoxF } from '../../src/core/geometry';
import { lampColour, readSevenSegment, symbolRegions, type PixelImage } from '../../src/perception/pedestrianVision';

function digitImage(text: string): PixelImage {
  const width = text.length * 45, height = 70, data = new Uint8ClampedArray(width * height * 4);
  const masks = ['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
  const rects = [[8,0,32,9],[27,5,36,29],[27,36,36,63],[8,59,32,68],[3,36,12,63],[3,5,12,29],[8,29,32,38]];
  [...text].forEach((digit, index) => [...masks[Number(digit)]].forEach((on, segment) => {
    if (on === '0') return;
    const [l,t,r,b] = rects[segment];
    for (let y=t;y<b;y++) for(let x=l;x<r;x++) { const p=(y*width+x+index*45)*4;data[p]=255;data[p+1]=180;data[p+3]=255; }
  }));
  return { width,height,data };
}
describe('pedestrian pixel checks', () => {
  it('separates the amber timer from green and the blue button plate', () => {
    expect(lampColour(255,180,0)).toBe('AMBER'); expect(lampColour(0,240,120)).toBe('GREEN'); expect(lampColour(100,150,255)).toBe('BLUE');
  });
  it.each(['2','3','5','6','8','9'])('reads seven-segment %s without general OCR', digit => {
    const image=digitImage(digit);
    const digits=[{box:new BoxF(3/45,0,36/45,68/70),colour:'AMBER' as const,pixels:100}];
    expect(readSevenSegment(image,digits)).toBe(Number(digit));
  });
  it('does not identify a circular green vehicle lamp as a pedestrian figure', () => {
    const image:PixelImage={width:40,height:40,data:new Uint8ClampedArray(40*40*4)};
    expect(symbolRegions(image,[{box:new BoxF(.1,.1,.9,.9),colour:'GREEN',pixels:200}])).toEqual([]);
  });
});
