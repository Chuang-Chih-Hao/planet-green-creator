import test from 'node:test';
import assert from 'node:assert/strict';
import {
 addPlayer, createRoom, makeTask, buildResult, goalForCount, triggerEvent, solveEvent,
 failEvent, publicState, tick, startRoom, FORMULAS, resetRoom
} from '../server/game.js';
import { TASK_VARIANTS } from '../server/tasks-v3.js';
import { EVENT_VARIANTS } from '../server/event-tasks.js';
import { modeGoalList } from '../server/modes-v2.js';

function roomWith(n) {
 const room=createRoom('TEST99');
 const players=Array.from({length:n},(_,i)=>addPlayer(room,'學生'+(i+1)));
 return {room,players};
}
function correctTask(room,p,kind,rng=()=>0){
 p.selectedKind=kind;p.task=makeTask(kind,'advanced',rng);p.lastAnswerAt=0;
 return buildResult(room,p,{taskId:p.task.id,answer:p.task.answer,formula:p.task.formula,unit:p.task.unit});
}

test('1–5 位學生的建造目標依時間調整，不要求剛好五人',()=>{
 assert.equal(goalForCount(1,40),8);
 assert.equal(goalForCount(4,40),32);
 assert.equal(goalForCount(5,40),40);
 assert.equal(goalForCount(4,25),20);
 assert.equal(goalForCount(4,15),12);
});

test('四種工程每類 10 種題型、各有不同公式與整潔數值',()=>{
 for(const kind of ['forest','orbit','crater','power']){
   const variants=TASK_VARIANTS[kind];
   assert.equal(variants.length,10);
   for(let i=0;i<variants.length;i++){
     const t=makeTask(kind,'advanced',()=> (i+.01)/variants.length);
     assert.equal(t.variant,variants[i],kind+' 第 '+i+' 題');
     assert.ok(Number.isFinite(t.answer) && t.answer>=0);
     assert.equal(t.answer,Number(t.answer.toFixed(2)));
     assert.ok(t.question.length>=20);
     assert.ok(['area','circumference','ring','reverseArea','reverseCirc'].includes(t.formula));
   }
   const a=makeTask(kind,'standard',()=>0);
   const b=makeTask(kind,'standard',()=>0,a.variant);
   assert.notEqual(a.variant,b.variant,'不可連續出同一題型');
 }
});
test('可正確選擇圓面積除以 π 反求半徑的公式',()=>{
 assert.ok(FORMULAS.some(f=>f.id==='reverseArea'&&f.text.includes('面積 ÷ π')));
 assert.equal(makeTask('power','advanced',()=>.25).formula,'reverseArea');
 assert.ok(FORMULAS.some(f=>f.id==='reverseCirc'));
});
test('生命開發進度開場和重設後為 0%',()=>{
 const {room,players:[p]}=roomWith(1);
 assert.equal(publicState(room,room.hostToken).progress,0);
 startRoom(room);
 assert.equal(publicState(room,room.hostToken).progress,0);
 correctTask(room,p,'forest');
 assert.ok(publicState(room,room.hostToken).progress>0);
 resetRoom(room);
 assert.equal(publicState(room,room.hostToken).progress,0);
 assert.equal(publicState(room,room.hostToken).lifeIndex,0);
});
test('算錯公式、數字、單位會提供不同的概念性診斷，不會誤建造',()=>{
 const {room,players:[p]}=roomWith(1);room.phase='playing';
 const t=makeTask('forest','advanced',()=>0);p.task=t;
 let a=buildResult(room,p,{taskId:t.id,answer:t.answer,formula:'ring',unit:t.unit});
 assert.equal(a.reason,'formula'); assert.match(a.message,/公式|面積/);
 p.lastAnswerAt=0;
 a=buildResult(room,p,{taskId:t.id,answer:t.answer/4,formula:t.formula,unit:t.unit});
 assert.equal(a.reason,'value');assert.match(a.message,/四分之一|半徑|直徑/);
 p.lastAnswerAt=0;
 a=buildResult(room,p,{taskId:t.id,answer:t.answer,formula:t.formula,unit:'km'});
 assert.equal(a.reason,'unit');assert.match(a.message,/平方公里/);
 assert.equal(room.structures.length,0);
 p.lastAnswerAt=0;
 a=buildResult(room,p,{taskId:t.id,answer:t.answer,formula:t.formula,unit:t.unit});
 assert.equal(a.correct,true);assert.equal(room.structures.length,1);
});
test('能源工程真實提升能源資源，三種模式都要求能源建設與能源達標',()=>{
 const {room,players:[p]}=roomWith(1);
 room.phase='playing';room.requiredBuildings=12;
 assert.equal(room.resources.energy,25);
 const r=correctTask(room,p,'power');assert.equal(r.correct,true);
 assert.equal(room.resources.energy,39);
 for(const mode of ['growth','balance','survival']){
  room.gameMode=mode;
  const goals=modeGoalList(room);
  assert.ok(goals.some(g=>g.id==='power'));
  assert.ok(goals.some(g=>g.id==='energy'));
 }
});
test('四人生命復育需四類工程、能源與生態門檻才能完成',()=>{
 const {room,players}=roomWith(4);room.durationMinutes=15;startRoom(room);
 assert.equal(room.requiredBuildings,12);
 const schedule=['forest','forest','forest','forest','power','power','power','crater','crater','orbit','orbit','orbit'];
 for(let i=0;i<schedule.length;i++)correctTask(room,players[i%4],schedule[i]);
 assert.equal(room.phase,'finished');
 assert.equal(room.result.win,true);
 assert.equal(publicState(room,room.hostToken).progress,100);
});
test('四種宇宙事件各有至少五種題型、重複觸發同事件會切換題型',()=>{
 const {room}=roomWith(1);room.phase='playing';
 for(const id of Object.keys(EVENT_VARIANTS)){
  assert.ok(EVENT_VARIANTS[id].length>=5);
  triggerEvent(room,id);
  const first=room.event.task;
  assert.ok(first.question&&first.answer>=0&&first.formula&&first.unit);
  failEvent(room);
  triggerEvent(room,id);
  assert.notEqual(room.event.task.variant,first.variant);
  failEvent(room);
 }
});
test('宇宙事件的答案由當場題目決定，解答不在學生 SSE 狀態洩漏',()=>{
 const {room,players:[p]}=roomWith(1);room.phase='playing';
 triggerEvent(room,'flare');
 const t=room.event.task;
 const visible=publicState(room,p.token).event;
 assert.equal(visible.question,t.question);
 assert.equal(visible.answer,undefined);
 assert.equal(visible.steps,undefined);
 assert.equal(visible.task,undefined);
 let bad=solveEvent(room,p,{answer:t.answer,formula:'area-wrong',unit:t.unit});
 assert.equal(bad.correct,false);assert.ok(bad.message.length>15);
 p.lastAnswerAt=0;
 const win=solveEvent(room,p,{answer:t.answer,formula:t.formula,unit:t.unit});
 assert.equal(win.correct,true);assert.equal(room.event,null);
 assert.equal(room.eventsWon,1);
});
test('未解決的事件留下持續損害；能源工程能修復風暴異常',()=>{
 const {room,players:[p]}=roomWith(1);room.phase='playing';
 triggerEvent(room,'flare');assert.equal(room.resources.energy,11);
 room.event.secondsLeft=1;room.paused=true;const before=room.remainingSeconds;tick(room);assert.equal(room.remainingSeconds,before);
 room.paused=false;tick(room);assert.equal(room.event,null);
 assert.equal(room.hazards[0].status,'lingering');
 const prev=room.resources.energy;
 correctTask(room,p,'power');
 assert.equal(room.hazards.length,0);
 assert.ok(room.resources.energy>prev);
});
test('教師可看到學生正在做的題目，但不公開任何當前答案',()=>{
 const {room,players:[p]}=roomWith(1);
 assert.equal(publicState(room,room.hostToken).players[0].task.question,p.task.question);
 assert.equal(publicState(room,p.token).players[0].task,undefined);
 assert.equal(publicState(room,p.token).ownTask.answer,undefined);
});
