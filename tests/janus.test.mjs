import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutorialState} from '../public/game/tutorial.js';
import {act,legalActions,score,createGame,mulligan,observation} from '../public/game/engine.js';
import {chooseAction} from '../public/game/ai.js';
import {card,mineral,faction,logText} from '../public/game/catalog.js';
import {CARDS,MINERALS} from '../public/game/cards.js';
import {setLanguage} from '../public/i18n.js';

test('practice uses legal game actions and teaches collection, energy, readiness, and combat',()=>{
  let s=createTutorialState();assert.equal(s.active,0);assert.equal(s.field[0].card,'copper');
  assert.equal(s.mine.length+s.field.length+s.waste.length,30);
  s=act(s,{type:'pick',target:s.field[0].id});assert.equal(score(s.players[0]),1);assert.equal(s.players[0].energy,2);
  const worker=s.players[0].hand.find(c=>c.card==='worker');s=act(s,{type:'play',card:worker.id,target:null});assert.equal(s.players[0].energy,0);assert.ok(s.players[0].units[0].sick);
  assert.ok(!legalActions(s).some(a=>a.type==='assist'));s=act(s,{type:'end'});assert.equal(s.active,1);s=act(s,{type:'end'});assert.equal(s.active,0);assert.equal(s.players[0].energy,3);assert.ok(!s.players[0].units[0].sick);
  s=act(s,{type:'combat'});s=act(s,{type:'attack',unit:s.players[0].units[0].id,target:null});assert.equal(s.players[1].hp,19);assert.equal(score(s.players[0]),1);
});
test('all playable card text and complete game logs can be shown in Chinese',()=>{
  globalThis.document={documentElement:{lang:'en'}};globalThis.window=new EventTarget();setLanguage('zh');
  try{
    for(const id of Object.keys(CARDS)){assert.match(card(id).name,/[\u3400-\u9fff]/,id);assert.match(card(id).text,/[\u3400-\u9fff]/,id);}
    for(const id of Object.keys(MINERALS))assert.match(mineral(id).name,/[\u3400-\u9fff]/,id);
    for(const f of ['gold','gem','fossil']){
      assert.match(faction(f).passive,/[\u3400-\u9fff]/);
      let s=mulligan(createGame({faction:f,opponent:'fossil',seed:41}),[]),moves=0;
      while(s.stage==='playing'&&moves++<1000){const p=s.pending?.type==='block'?1-s.active:s.active;s=act(s,chooseAction(observation(s,p),legalActions(s,p),p),p);for(const line of s.log)assert.doesNotMatch(logText(line),/[A-Za-z]{3,}/,line);}
      assert.equal(s.stage,'over');
    }
  }finally{setLanguage('en');delete globalThis.document;delete globalThis.window;}
});
