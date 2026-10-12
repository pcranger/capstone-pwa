/** iPadOS can advertise itself as a touch-capable Mac. */
export function needsCanvasVideoTexture(platform:Pick<Navigator,'userAgent'|'platform'|'maxTouchPoints'>=navigator){
 return /iPhone|iPad|iPod/.test(platform.userAgent)||(platform.platform==='MacIntel'&&platform.maxTouchPoints>1);
}
