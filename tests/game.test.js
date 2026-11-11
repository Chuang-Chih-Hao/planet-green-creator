import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayer,createRoom,makeTask,buildResult,goalForCount,triggerEvent,solveEvent,failEvent,
  publicState,tick,startRoom,FORMULAS,resetRoom,finishRoom,submitReview,checkWin
} from '../server/game.js';
import { TASK_VARIANTS,TASK_SCENARIOS,CONCEPT_VARIANTS } from '../server/tasks-v3.js';
import { EVENT_VARIANTS } from '../server/event-tasks.js';
import { modeGoalList } from '../server/modes-v2.js';
import { exploreSector,chooseDecision,rotatePipe,purchaseTech,isPipelineSolved,explorationTarget,makePipeline } from '../server/adventure.js';

function roomWith(n=1){
 const room=createRoom('TEST99');
 const players=Array.from({length:n},(_,i)=>addPlayer(room,'學生'+(i+1)));
 return {room,players};
}
function correctTask(room,p,kind){
 p.selectedKind=kind;p.task=makeTask(kind,'advanced',Math.random,null,p.recentQuestions);p.lastAnswerAt=0;
 return buildResult(room,p,{taskId:p.task.id,formula:p.task.formula,answer:p.task.answer,unit:p.task.unit});
}

function scanTo(room,p,target) {
  for(let i=room.adventure.discovered;i<target;i++){
    room.adventure.nextScanAt=0;
    const idx=room.adventure.sectors.find(x=>!x.revealed).index;
    exploreSector(room,p,idx);
    if(room.adventure.decision)chooseDecision(room,p,room.adventure.decision.options[0].id);
    checkWin(room);
  }
}
const dirs=['N','E','S','W'],op={N:'S',E:'W',S:'N',W:'E'};
const linkDir=(a,b)=>b-a===1?'E':b-a===-1?'W':b-a===3?'S':'N';
const ports=cell=>(cell.kind==='straight'?['N','S']:['N','E']).map(dir=>dirs[(dirs.indexOf(dir)+cell.rotation)%4]);
function repairPipe(room,p){
  const before=room.adventure.pipeRepairs;
  const path=[...room.adventure.pipe.solution];
  for(let j=0;j<path.length;j++){
    const i=path[j],needs=[j===0?'W':linkDir(i,path[j-1]),j===path.length-1?'E':linkDir(i,path[j+1])];
    for(let turn=0;turn<4&&!needs.every(d=>ports(room.adventure.pipe.cells[i]).includes(d));turn++){
      room.adventure.nextPipeAt=0;
      rotatePipe(room,p,i);
      if(room.adventure.pipeRepairs>before){checkWin(room);return;}
    }
  }
  assert.equal(room.adventure.pipeRepairs,before+1,'旋轉水管必須可完成');
  checkWin(room);
}
test('目標隨 1 到 5 人、時長調整，不需滿五人',()=>{
 assert.equal(goalForCount(1,40),4);assert.equal(goalForCount(4,40),16);
 assert.equal(goalForCount(5,40),20);assert.equal(goalForCount(4,25),12);assert.equal(goalForCount(4,15),8);
});
test('四大工程維持十種計算題型，另加觀念題及是非題',()=>{
 for(const kind of ['forest','orbit','crater','power']){
   assert.equal(TASK_VARIANTS[kind].length,10);
   assert.equal(CONCEPT_VARIANTS[kind].length,2);
   assert.ok(TASK_SCENARIOS[kind].length>=8);
   for(let i=0;i<10;i++){
     const t=makeTask(kind,'advanced',()=> (i+.01)/12);
     assert.equal(t.variant,TASK_VARIANTS[kind][i]);
     assert.ok(Number.isFinite(t.answer)&&t.answer>0&&t.answer<=314);
     assert.ok(Math.abs(t.answer*10-Math.round(t.answer*10))<1e-7,kind+' 的答案應最多一位小數');
     assert.match(t.question,/公里|平方公里/);
   }
   const concept=makeTask(kind,'advanced',()=> 10.05/12);
   const tf=makeTask(kind,'advanced',()=> 11.05/12);
   assert.equal(concept.type,'choice');
   assert.equal(tf.type,'trueFalse');
   assert.equal(concept.choices.length,3);
   assert.equal(tf.choices.length,2);
 }
});
test('觀念題和是非題不用公式或單位，答對仍可建造',()=>{
 const {room,players:[p]}=roomWith();startRoom(room);
 for(const slot of [10.05/12,11.05/12]){
   p.task=makeTask('power','advanced',()=>slot);
   assert.ok(['choice','trueFalse'].includes(p.task.type));
   const before=p.answered;
   const missing=buildResult(room,p,{taskId:p.task.id,answer:''});
   assert.equal(missing.reason,'missingChoice');
   assert.equal(p.answered,before);
   const other=p.task.choices.find(x=>x.value!==p.task.answer);
   const wrong=buildResult(room,p,{taskId:p.task.id,answer:other.value});
   assert.equal(wrong.reason,'concept');
   assert.match(wrong.message,/觀念/);
   p.lastAnswerAt=0;
   const correct=buildResult(room,p,{taskId:p.task.id,answer:p.task.answer});
   assert.equal(correct.correct,true);
   p.lastAnswerAt=0;
 }
 assert.equal(room.completed.power,2);
});
test('題目避開最近做過的完整題幹，同型題數值不固定',()=>{
 let seed=10391;
 const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const kind of ['forest','orbit','crater','power']){
  const recent=[];const encountered=[];
  for(let i=0;i<26;i++){
    const t=makeTask(kind,'advanced',rng,null,recent);
    encountered.push(t.question);
  }
  assert.ok(new Set(encountered).size>=25,kind+' 近期題目應盡量不重複');
 }
 const x=makeTask('forest','advanced',()=>0),y=makeTask('forest','advanced',()=>.19);
 assert.notEqual(x.variant,y.variant);
});
test('空白單位僅提醒選單位，不列入答錯或提交次數',()=>{
 const {room,players:[p]}=roomWith();startRoom(room);
 p.task=makeTask('forest','advanced',()=>0);
 const t=p.task,prev=p.answered;
 const res=buildResult(room,p,{taskId:t.id,formula:t.formula,answer:t.answer,unit:''});
 assert.equal(res.reason,'missingUnit');assert.match(res.message,/請先選擇單位/);
 assert.equal(p.answered,prev);assert.deepEqual(p.mistakes,{formula:0,value:0,unit:0});
 assert.equal(p.lastAnswerAt,0);
 const done=buildResult(room,p,{taskId:t.id,formula:t.formula,answer:t.answer,unit:t.unit});
 assert.equal(done.correct,true);
});
test('公式、計算錯誤仍有具體診斷且不誤建造',()=>{
 const {room,players:[p]}=roomWith();startRoom(room);p.task=makeTask('forest','advanced',()=>0);const t=p.task;
 const wrong=buildResult(room,p,{taskId:t.id,formula:'ring',answer:t.answer,unit:t.unit});
 assert.equal(wrong.reason,'formula');assert.match(wrong.message,/公式/);
 p.lastAnswerAt=0;
 const wrong2=buildResult(room,p,{taskId:t.id,formula:t.formula,answer:t.answer/4,unit:t.unit});
 assert.equal(wrong2.reason,'value');assert.match(wrong2.message,/四分之一|半徑|直徑/);
 assert.equal(room.structures.length,0);
});
test('三關闖關需探索、科技與接水管，不是只答題',()=>{
 const {room,players:[p]}=roomWith();room.durationMinutes=15;startRoom(room);
 assert.equal(room.stage,1);assert.equal(publicState(room,room.hostToken).progress,0);
 correctTask(room,p,'forest');correctTask(room,p,'power');
 assert.equal(room.stage,1,'光解數學題不能進第二關');
 scanTo(room,p,explorationTarget(room,1));
 assert.equal(room.stage,2);
 scanTo(room,p,explorationTarget(room,2));
 purchaseTech(room,p,'battery');checkWin(room);
 correctTask(room,p,'crater');
 assert.equal(room.stage,2,'沒有水管任務不可以通關');
 repairPipe(room,p);
 assert.equal(room.stage,3);assert.equal(room.event.id,'flare');
 assert.ok(room.adventure.decisionsResolved>=1);
});
test('第三關需探索與合作活動，完成後進入課後回顧',()=>{
 const {room,players:[p]}=roomWith();room.durationMinutes=15;room.eventsEnabled=false;startRoom(room);
 correctTask(room,p,'forest');correctTask(room,p,'power');scanTo(room,p,2);
 assert.equal(room.stage,2);
 scanTo(room,p,4);purchaseTech(room,p,'battery');correctTask(room,p,'crater');repairPipe(room,p);
 assert.equal(room.stage,3);
 const e=room.event.task;p.lastAnswerAt=0;
 const missing=solveEvent(room,p,{formula:e.formula,answer:e.answer,unit:''});
 assert.equal(missing.reason,'missingUnit');
 const solved=solveEvent(room,p,{formula:e.formula,answer:e.answer,unit:e.unit});
 assert.equal(solved.correct,true);
 scanTo(room,p,explorationTarget(room,3));
 purchaseTech(room,p,'nursery');checkWin(room);
 repairPipe(room,p);
 assert.ok(room.adventure.pipeRepairs>=2);
 assert.ok(room.adventure.upgrades.length>=2);
 for(let i=0;i<28&&room.phase==='playing';i++)correctTask(room,p,['orbit','forest','crater','power'][i%4]);
 assert.equal(room.phase,'finished');assert.equal(room.result.win,true);
 assert.equal(publicState(room,p.token).progress,100);
 assert.equal(publicState(room,p.token).ownReview.questions.length,3);
});
test('探索地圖保密、科技花材料且能真正改善星球',()=>{
 const {room,players:[p]}=roomWith();startRoom(room);
 const visible=publicState(room,p.token).adventure;
 assert.equal(visible.sectors.length,16);
 assert.ok(visible.sectors.every(x=>!x.revealed&&x.title==='未探索區域'&&x.type===undefined));
 scanTo(room,p,4);
 const a=publicState(room,p.token).adventure;
 assert.equal(a.discovered,4);assert.ok(a.materials>=4);
 const before=room.resources.energy;
 purchaseTech(room,p,'battery');
 assert.ok(room.resources.energy>=before+6);
 assert.ok(room.adventure.upgrades.includes('battery'));
 assert.throws(()=>purchaseTech(room,p,'battery'),/已經研究/);
});
test('接水管拼圖有可行解，完成後補水並產生下一組',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';room.stage=2;
 const before=room.resources.water;
 const initial=publicState(room,p.token).adventure.pipe;
 assert.equal(initial.cells.length,9);
 assert.equal(initial.solution,undefined,'不可洩漏管線解法');
 repairPipe(room,p);
 assert.equal(room.adventure.pipeRepairs,1);
 assert.equal(room.resources.water,before+9);
 assert.equal(room.adventure.pipe.round,2);
});
test('各階段即使事件失敗，也能由對應工程修復',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';room.stage=3;
 triggerEvent(room,'meteor');assert.equal(room.hazards.length,1);
 room.event.secondsLeft=1;tick(room);
 assert.equal(room.event,null);assert.equal(room.hazards[0].status,'lingering');
 correctTask(room,p,'crater');
 assert.equal(room.hazards.length,0);assert.equal(room.stageChallengesResolved,1);
});
test('教師可看目前學生題目但不會拿到答案，學生看不到其他人的題目',()=>{
 const {room,players:[p1,p2]}=roomWith(2);
 const teacher=publicState(room,room.hostToken);
 assert.equal(teacher.players[0].task.question,p1.task.question);
 assert.equal(teacher.players[0].task.answer,undefined);
 assert.equal(publicState(room,p1.token).players[1].task,undefined);
 assert.equal(publicState(room,p1.token).ownTask.answer,undefined);
});
test('宇宙事件不同題型不連續重複且答案隱藏',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';
 for(const k of Object.keys(EVENT_VARIANTS)){
  triggerEvent(room,k);
  const first=room.event.task.variant;
  const state=publicState(room,p.token);
  assert.equal(state.event.answer,undefined);
  failEvent(room);
  triggerEvent(room,k);
  assert.notEqual(room.event.task.variant,first);
  failEvent(room);
 }
});
test('課後三道複習與反思：只回傳給本人與老師統計，不洩漏給其他學生',()=>{
 const {room,players:[p1,p2]}=roomWith(2);
 finishRoom(room);
 const one=publicState(room,p1.token);
 assert.equal(one.ownReview.questions.length,3);
 assert.equal(one.ownReview.questions[0].answer,undefined);
 const answers=Object.fromEntries(p1.reviewQuestions.map(q=>[q.id,q.answer]));
 const submitted=submitReview(room,p1,{answers,confidence:'understand',reflection:'圓環要大圓減小圓'});
 assert.equal(submitted.correct,3);
 const personal=publicState(room,p1.token);
 assert.equal(personal.ownReview.result.results.length,3);
 const other=publicState(room,p2.token);
 assert.equal(other.players[0].reviewReflection,undefined);
 const teacher=publicState(room,room.hostToken);
 assert.equal(teacher.players[0].reviewScore,3);
 assert.match(teacher.players[0].reviewReflection,/圓環/);
 assert.throws(()=>submitReview(room,p1,{answers}),/已提交/);
 resetRoom(room);
 assert.equal(publicState(room,p1.token).progress,0);
 assert.equal(room.stage,1);
});
test('圓面積除以 π 求半徑公式仍可使用',()=>{
 assert.ok(FORMULAS.some(f=>f.id==='reverseArea'&&f.text.includes('面積 ÷ π')));
 assert.ok(FORMULAS.some(f=>f.id==='reverseCirc'));
});
