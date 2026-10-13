import type { WalkingRoute,PlaceCandidate } from '../nav/navigation';
import { distanceMeters,type AuthoredRoute } from './local/routes';
/** Preserve user-authored geometry. Never replace an unmapped route with a provider shortcut. */
export function authoredJourney(route:AuthoredRoute):{destination:PlaceCandidate;route:WalkingRoute}{
 const points=route.waypoints.map(p=>({latitude:p.latitude,longitude:p.longitude}));const last=route.waypoints.at(-1)!;
 return {destination:{id:`authored:${route.id}`,name:route.name,address:'User-authored route',point:points.at(-1)!,endpoint:'coordinate'},route:{destination:route.name,destinationAddress:last.label,points,
  steps:route.waypoints.slice(1).map((p,i)=>({instruction:`Continue to ${p.label}.${p.note?` ${p.note}`:''}`,distanceMeters:distanceMeters(points[i],points[i+1]),points:[points[i],points[i+1]],maneuver:'STRAIGHT'})),
  distanceMeters:points.reduce((n,p,i)=>n+(i?distanceMeters(points[i-1],p):0),0),durationSeconds:0,warnings:['User-authored route. Paths and access have not been verified. Follow the reviewed waypoints; no automatic rerouting is supplied.']}};
}
