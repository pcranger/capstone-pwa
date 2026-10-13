// Build-time opt-in; never enabled by a URL or saved user preference.
export const PRESENTER_TOOLS = import.meta.env.VITE_PRESENTER_TOOLS === 'true';
export const DEMO_SPEEDS = [{label:'Slow',rate:0.75},{label:'Normal',rate:1},{label:'Fast',rate:1.5}] as const;
export function demoSpeedFor(rate:number){return DEMO_SPEEDS.reduce((best,item)=>Math.abs(item.rate-rate)<Math.abs(best.rate-rate)?item:best);}
