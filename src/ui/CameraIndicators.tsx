import type { TrackView } from '../crossing/crossingEngine';
import { ObjectCategory } from '../perception/detection';
import type { PedestrianIndicator } from '../perception/pedestrianIndicator';
export function CameraIndicators({tracks,fresh,signal}:{tracks:TrackView[];fresh:boolean;signal:PedestrianIndicator}){
 const cars=fresh?tracks.filter(t=>t.category===ObjectCategory.CAR).length:null;
 const label=`${signal.label}${signal.seconds===null?'':`. Countdown ${signal.seconds} seconds`}. Observation only; crossing safety is unverified.`;
 return <div className="cw-camera-indicators" data-testid="camera-indicators">
  <div className="cw-indicator" role="img" aria-label={cars===null?'Car count unavailable':`${cars} cars detected`}>
   <svg aria-hidden="true" viewBox="0 0 32 32"><path d="M5 14l3-7h16l3 7M5 14h22v11H5zM9 25v3m14-3v3M9 18h3m8 0h3"/></svg>
   <strong aria-hidden="true">{cars??'—'}</strong>
  </div>
  <div className={`cw-indicator cw-signal-${signal.color}`} role="img" aria-label={label} data-testid="pedestrian-indicator" data-signal={signal.color}>
   <svg aria-hidden="true" viewBox="0 0 32 32"><circle cx="18" cy="5" r="3"/><path d="M14 13l4-4 3 7 5 2M18 10l-3 10 6 9M15 20l-7 8M14 13l-6 5"/></svg>
   <strong aria-hidden="true">{signal.seconds??'—'}</strong>
  </div>
 </div>;
}
