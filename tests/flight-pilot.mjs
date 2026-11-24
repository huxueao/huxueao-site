// Test-only feedback controller: its only action is holding/releasing lift.
export function wantsLift(s){
  const g=s.course[Math.min(s.score,s.course.length-1)],error=s.bird.y-g.center;
  const desired=Math.max(-330,Math.min(250,-error*6));return s.bird.vy>desired;
}
