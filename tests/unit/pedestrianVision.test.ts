import { describe, expect, it } from 'vitest';
import { BoxF } from '../../src/core/geometry';
import { isCountdownDisplay, lampColour, readSevenSegment, symbolRegions, verifyPedestrianSymbol, type PixelImage } from '../../src/perception/pedestrianVision';

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

describe('illuminated symbol verification', () => {
  const blank = (): PixelImage => ({width:100,height:130,data:new Uint8ClampedArray(100*130*4)});
  function paint(image:PixelImage,test:(x:number,y:number)=>boolean,colour:[number,number,number]){
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(test(x,y)){const p=(y*image.width+x)*4;image.data.set([...colour,255],p);}
  }
  const whole = new BoxF(0,0,1,1);
  it.each(['GREEN','RED'] as const)('accepts a %s figure with a head, torso and separated legs',phase=>{
    const image=blank();
    paint(image,(x,y)=>x>=45&&x<55&&y>=15&&y<25||x>=38&&x<62&&y>=28&&y<60||x>=25&&x<75&&y>=35&&y<45||y>=60&&y<100&&(x>=38&&x<47||x>=55&&x<64),phase==='GREEN'?[0,240,100]:[240,0,0]);
    expect(verifyPedestrianSymbol(image,whole,phase).accepted).toBe(true);
  });
  it.each(['GREEN','RED'] as const)('rejects a round %s vehicle lamp inside a tall housing box',phase=>{
    const image=blank();paint(image,(x,y)=>(x-50)**2+(y-90)**2<20**2,phase==='GREEN'?[0,240,100]:[240,0,0]);
    expect(verifyPedestrianSymbol(image,whole,phase)).toMatchObject({accepted:false,reason:'round-or-wide-lamp'});
  });
  it.each(['GREEN','RED'] as const)('rejects an upright %s arrow with a shaft instead of two legs',phase=>{
    const image=blank();paint(image,(x,y)=>y>=15&&y<45&&Math.abs(x-50)<y-14||y>=40&&y<110&&x>=44&&x<56,phase==='RED'?[240,0,0]:[0,240,100]);
    expect(verifyPedestrianSymbol(image,whole,phase).accepted).toBe(false);
  });
  it.each(['GREEN','RED'] as const)('rejects an elliptical %s vehicle lamp even when its height exceeds its width',phase=>{
    const image=blank();paint(image,(x,y)=>(x-50)**2/12**2+(y-65)**2/30**2<1,phase==='RED'?[240,0,0]:[0,240,100]);
    expect(verifyPedestrianSymbol(image,whole,phase).accepted).toBe(false);
  });
  it('does not turn an unresolved colour into a verified signal',()=>{
    expect(verifyPedestrianSymbol(blank(),whole,'UNKNOWN').accepted).toBe(false);
  });
  it('checks the bottom foot rows of a small standing pedestrian symbol',()=>{
    const image=blank();
    paint(image,(x,y)=>y>=10&&y<15&&x>=44&&x<50||y>=15&&y<32&&x>=40&&x<53||y>=32&&y<34&&(x>=40&&x<45||x>=48&&x<53),[240,0,0]);
    expect(verifyPedestrianSymbol(image,whole,'RED')).toMatchObject({accepted:true,reason:'pedestrian-silhouette',splitRows:2});
  });
  it('retains one genuine bottom-row gap in small red standing figures but not green',()=>{
    const image=blank();
    paint(image,(x,y)=>y>=10&&y<15&&x>=44&&x<50||y>=15&&y<32&&x>=40&&x<53||y>=32&&y<34&&(x>=40&&x<45||x>=48&&x<53),[240,0,0]);
    paint(image,(x,y)=>y===32&&x>=45&&x<48,[240,0,0]);
    expect(verifyPedestrianSymbol(image,whole,'RED')).toMatchObject({accepted:true,reason:'pedestrian-silhouette',splitRows:1});
    const green=blank();for(let i=0;i<image.data.length;i+=4)if(image.data[i])green.data.set([0,240,100,255],i);
    expect(verifyPedestrianSymbol(green,whole,'GREEN').accepted).toBe(false);
  });
  it('retains a blurred tiny red upright figure but does not apply that exception to green',()=>{
    const image=blank();
    const figure=(x:number,y:number)=>y>=10&&y<12&&x>=41&&x<43||y>=12&&y<19&&x>=40&&x<44;
    paint(image,figure,[240,0,0]);
    expect(verifyPedestrianSymbol(image,whole,'RED')).toMatchObject({accepted:true,reason:'coarse-red-silhouette'});
    const green=blank();paint(green,figure,[0,240,100]);
    expect(verifyPedestrianSymbol(green,whole,'GREEN').accepted).toBe(false);
  });
  it('requires dark non-digit pixels inside a countdown panel',()=>{
    const image:PixelImage={width:120,height:120,data:new Uint8ClampedArray(120*120*4)},digit=digitImage('2');
    for(let y=0;y<digit.height;y++)for(let x=0;x<digit.width;x++)image.data.set(digit.data.slice((y*digit.width+x)*4,(y*digit.width+x)*4+4),((y+25)*120+x+35)*4);
    const box=new BoxF(38/120,25/120,71/120,93/120);
    expect(isCountdownDisplay(image,box)).toBe(true);
    paint(image,(x,y)=>x>=38&&x<71&&y>=25&&y<93&&lampColour(image.data[(y*120+x)*4],image.data[(y*120+x)*4+1],image.data[(y*120+x)*4+2])!=='AMBER',[100,145,100]);
    expect(isCountdownDisplay(image,box)).toBe(false);
  });
});
