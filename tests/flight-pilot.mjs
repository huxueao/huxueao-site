// Test-only feedback controller. Every action is one separate press/release.
import {GRAVITY,FLAP_SPEED,CLIMB_SPEED,COLLISION_WIDTH,RADIUS} from '../public/flight/model.js';
export function wantsFlap(s){
  let index=Math.min(s.score,s.course.length-1);
  if(s.course[index].x-s.distance+COLLISION_WIDTH/2+RADIUS<s.bird.x)index=Math.min(index+1,s.course.length-1);
  const g=s.course[index];
  const boost=Math.max(-CLIMB_SPEED,Math.min(s.bird.vy,0)-FLAP_SPEED);
  return s.bird.y-boost*boost/(2*GRAVITY)>=g.center-5&&s.flapFlash<.05;
}
