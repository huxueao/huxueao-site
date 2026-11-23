import { createGame, mulligan } from './engine.js';

// A separate practice match. Moving existing cards preserves deck sizes and IDs.
export function createTutorialState() {
  const state=createGame({faction:'gold',opponent:'gem',seed:2471,first:0}), p=state.players[0];
  if(!p.hand.some(c=>c.card==='worker')) {
    const index=p.deck.findIndex(c=>c.card==='worker');
    [p.hand[0],p.deck[index]]=[p.deck[index],p.hand[0]];
  }
  const next=['copper','iron','silver'].map(id=>{
    const index=state.mine.findIndex(c=>c.card===id);return state.mine.splice(index,1)[0];
  });
  state.mine.push(...next.reverse());
  return mulligan(state,[]);
}
