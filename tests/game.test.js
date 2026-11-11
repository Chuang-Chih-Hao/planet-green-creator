import test from 'node:test';
import assert from 'node:assert/strict';
import {
 addPlayer,createRoom,makeTask,buildResult,goalForCount,triggerEvent,solveEvent,failEvent,
 publicState,tick,startRoom,FORMULAS,resetRoom,finishRoom,submitReview,
 checkWin,completeTeamGame,skipTeamGame
} from '../server/game.js';
import { TASK_VARIANTS,TASK_SCENARIOS,CONCEPT_VARIANTS } from '../server/tasks-v3.js';
import { EVENT_VARIANTS } from '../server/event-tasks.js';
import { mathStageGoals } from '../server/modes-v2.js';
import { TEAM_GAMES,startTeamGame,playTeamGame,publicTeamGame,tickTeamGame } from '../server/team-games.js';

const roomWith=(n=1)=>{
 const room=createRoom('TEST99');
 const players=Array.from({length:n},(_,i)=>addPlayer(room,'學生'+(i+1)));
 return {room,players};
};
function math(room,p,kind){
 p.selectedKind=kind;p.task=makeTask(kind,'advanced',Math.random,null,p.recentQuestions);
 p.lastAnswerAt=0;const t=p.task;
 const value=(t.type==='choice'||t.type==='trueFalse')?{answer:t.answer}:{answer:t.answer,formula:t.formula,unit:t.unit};
 return buildResult(room,p,{taskId:t.id,...value});
}
function move(room,p,params={}){
 const g=room.teamGame;
 assert.ok(g,'合作小遊戲應存在');
 return completeTeamGame(room,p,{gameId:g.id,...params});
}
function solveMemory(room,p){
 const g=room.teamGame;assert.equal(g.kind,'memory');
 g.hidden=true;
 for(const pad of g.sequence){if(room.teamGame!==g)break;move(room,p,{index:pad});}
 assert.notEqual(room.teamGame,g);
}
function solvePulse(room,p){
 const g=room.teamGame;assert.equal(g.kind,'pulse');
 for(let i=0;i<g.goal;i++){
  assert.equal(room.teamGame,g);
  g.startedAt=Date.now()-Math.round(g.cycleMs*.4);
  g.lastPressedAt=0;
  move(room,p,{move:'charge'});
 }
 assert.notEqual(room.teamGame,g);
}
const dirs=['N','E','S','W'];
const ports=c=>(c.kind==='straight'?['N','S']:['N','E']).map(d=>dirs[(dirs.indexOf(d)+c.rotation)%4]);
const linkDir=(a,b)=>b-a===1?'E':b-a===-1?'W':b-a===3?'S':'N';
function solvePipe(room,p){
 const g=room.teamGame;assert.equal(g.kind,'pipe');
 const path=[...g.pipe.solution];
 for(let j=0;j<path.length&&room.teamGame===g;j++){
  const index=path[j],required=[j===0?'W':linkDir(index,path[j-1]),j===path.length-1?'E':linkDir(index,path[j+1])];
  for(let turn=0;turn<4&&room.teamGame===g&&!required.every(d=>ports(g.pipe.cells[index]).includes(d));turn++){
   move(room,p,{index});
  }
 }
 assert.notEqual(room.teamGame,g,'管線必須有解法');
}
function findRoverPath(map){
 const queue=[0],parents=new Map([[0,null]]);
 for(let i=0;i<queue.length;i++){
  const a=queue[i];
  if(a===24)break;
  for(const [dir,diff] of [['N',-5],['S',5],['E',1],['W',-1]]){
   const b=a+diff;
   if(b<0||b>24||(dir==='E'&&a%5===4)||(dir==='W'&&a%5===0)||map[b]==='wall'||parents.has(b))continue;
   parents.set(b,{prev:a,dir});queue.push(b);
  }
 }
 assert.ok(parents.has(24),'救援迷宮必須可到達目的地');
 const path=[];let cursor=24;
 while(cursor!==0){const p=parents.get(cursor);path.push(p.dir);cursor=p.prev;}
 return path.reverse();
}
function solveRover(room,p){
 const g=room.teamGame;assert.equal(g.kind,'rover');
 for(const dir of findRoverPath(g.map))move(room,p,{move:dir});
 assert.notEqual(room.teamGame,g);
}
function solveDefense(room,p){
 const g=room.teamGame;assert.equal(g.kind,'defense');
 for(let i=0;i<g.goal;i++){g.deadlineAt=Date.now()+10000;move(room,p,{index:g.lane});}
 assert.notEqual(room.teamGame,g);
}
function solveMosaic(room,p){
 const g=room.teamGame;assert.equal(g.kind,'mosaic');
 g.tiles=[1,2,3,4,5,6,7,0,8];
 move(room,p,{index:8});
 assert.notEqual(room.teamGame,g);
}
test('一至五人所需數學工程比舊版少，且六款合作遊戲分布三關',()=>{
 assert.equal(goalForCount(1,40),4);
 assert.equal(goalForCount(4,40),16);
 assert.equal(goalForCount(5,40),20);
 assert.equal(goalForCount(4,25),12);
 assert.equal(goalForCount(4,15),8);
 assert.deepEqual(TEAM_GAMES,{1:['memory','pulse'],2:['pipe','rover'],3:['defense','mosaic']});
});
test('四類工程保持數值題、觀念題、是非題及一位小數',()=>{
 for(const kind of ['forest','orbit','crater','power']){
  assert.equal(TASK_VARIANTS[kind].length,10);assert.equal(CONCEPT_VARIANTS[kind].length,2);
  assert.ok(TASK_SCENARIOS[kind].length>=8);
  for(let i=0;i<10;i++){
   const t=makeTask(kind,'advanced',()=>(i+.01)/12);
   assert.ok(Number.isFinite(t.answer)&&t.answer>0&&t.answer<=314);
   assert.ok(Math.abs(t.answer*10-Math.round(t.answer*10))<1e-7);
  }
 }
 assert.ok(FORMULAS.some(f=>f.id==='reverseArea'&&f.text.includes('面積 ÷ π')));
});
test('漏選單位不扣分；觀念題不必選公式和單位',()=>{
 const {room,players:[p]}=roomWith();startRoom(room);
 p.task=makeTask('forest','advanced',()=>0);
 let t=p.task,prev=p.answered;
 let res=buildResult(room,p,{taskId:t.id,answer:t.answer,formula:t.formula,unit:''});
 assert.equal(res.reason,'missingUnit');assert.equal(p.answered,prev);
 res=buildResult(room,p,{taskId:t.id,answer:t.answer,formula:t.formula,unit:t.unit});
 assert.equal(res.correct,true);
 p.lastAnswerAt=0;p.task=makeTask('power','advanced',()=>10.05/12);t=p.task;
 assert.equal(t.type,'choice');
 const other=t.choices.find(x=>x.value!==t.answer);
 res=buildResult(room,p,{taskId:t.id,answer:other.value});
 assert.equal(res.reason,'concept');
 p.lastAnswerAt=0;
 res=buildResult(room,p,{taskId:t.id,answer:t.answer});
 assert.equal(res.correct,true);
});
test('第一關數學完成後立刻自動開始記憶接力，建造被鎖定',()=>{
 const {room,players:[p]}=roomWith();room.durationMinutes=15;startRoom(room);
 math(room,p,'forest');math(room,p,'power');
 assert.ok(room.teamGame,'完成數學階段後應自動進入合作小遊戲');
 assert.equal(room.stage,1);
 assert.equal(room.teamGame.kind,'memory');
 assert.equal(publicState(room,p.token).teamGame.kind,'memory');
 assert.throws(()=>math(room,p,'forest'),/合作小遊戲/);
 assert.ok(mathStageGoals(room).every(x=>x.met));
 solveMemory(room,p);
 assert.equal(room.teamGame.kind,'pulse');
 solvePulse(room,p);
 assert.equal(room.stage,2);assert.equal(room.teamGame,null);
 assert.equal(room.teamGamesCompleted[1],2);
});
test('記憶遊戲預覽結束後不可讀到隱藏的正確順序',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';
 startTeamGame(room);
 const before=publicState(room,p.token).teamGame;
 assert.equal(before.sequence.length,room.teamGame.sequence.length);
 room.teamGame.revealUntil=Date.now()-1;
 assert.equal(tickTeamGame(room),true);
 const after=publicState(room,p.token).teamGame;
 assert.equal(after.sequence,null);assert.equal(after.hidden,true);
});
test('多人輪流操作：不是指定同學不可搶先作答，逾時可代替',()=>{
 const {room,players:[p1,p2]}=roomWith(2);room.phase='playing';
 startTeamGame(room);room.teamGame.hidden=true;
 const g=room.teamGame;
 assert.throws(()=>playTeamGame(room,p2,{gameId:g.id,index:g.sequence[0]}),/輪到/);
 const hit=playTeamGame(room,p1,{gameId:g.id,index:g.sequence[0]});
 assert.equal(hit.completed,false);
 assert.equal(g.turnIndex,1);
 assert.throws(()=>playTeamGame(room,p1,{gameId:g.id,index:g.sequence[1]}),/輪到/);
 g.turnAt=Date.now()-13000;
 assert.doesNotThrow(()=>playTeamGame(room,p1,{gameId:g.id,index:g.sequence[1]}));
});
test('第二關水管與迷宮兩種玩法不同，無需數學選項即可操作',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';room.stage=2;
 startTeamGame(room);assert.equal(room.teamGame.kind,'pipe');
 assert.equal(publicState(room,p.token).teamGame.cells.length,9);
 assert.equal(publicState(room,p.token).teamGame.pipe?.solution,undefined);
 // 避免全局進度意外改變，直接保持算術目標未完成。
 solvePipe(room,p);assert.equal(room.teamGame,null);
 startTeamGame(room);assert.equal(room.teamGame.kind,'rover');
 solveRover(room,p);assert.equal(room.teamGame,null);
 assert.equal(room.teamGamesCompleted[2],2);
});
test('第三關攔截動態倒數與星圖滑塊可完成',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';room.stage=3;
 startTeamGame(room);assert.equal(room.teamGame.kind,'defense');
 room.teamGame.deadlineAt=Date.now()-1;
 const stability=room.resources.stability;
 tickTeamGame(room);
 assert.equal(room.resources.stability,stability-2);
 solveDefense(room,p);
 assert.equal(room.teamGame,null);
 startTeamGame(room);assert.equal(room.teamGame.kind,'mosaic');
 assert.equal(publicState(room,p.token).teamGame.tiles.length,9);
 solveMosaic(room,p);
 assert.equal(room.teamGamesCompleted[3],2);
});
test('三關全部通過後自動進入回顧，保留老師資料隱藏',()=>{
 const {room,players:[p]}=roomWith();room.durationMinutes=15;startRoom(room);
 math(room,p,'forest');math(room,p,'power');
 assert.ok(room.teamGame);
 solveMemory(room,p);solvePulse(room,p);
 assert.equal(room.stage,2);
 math(room,p,'crater');
 assert.equal(room.teamGame.kind,'pipe');solvePipe(room,p);solveRover(room,p);
 assert.equal(room.stage,3);assert.equal(room.teamGame,null);
 math(room,p,'orbit');
 assert.equal(room.teamGame.kind,'defense');
 solveDefense(room,p);solveMosaic(room,p);
 assert.equal(room.phase,'finished');assert.equal(room.result.win,true);
 assert.equal(publicState(room,p.token).progress,100);
 assert.equal(publicState(room,p.token).ownReview.questions.length,3);
 const teacher=publicState(room,room.hostToken);
 assert.equal(teacher.players[0].task.answer,undefined);
});
test('教師略過單款遊戲不會加資源獎勵',()=>{
 const {room,players:[p]}=roomWith();room.durationMinutes=15;startRoom(room);
 math(room,p,'forest');math(room,p,'power');
 assert.ok(room.teamGame);
 const before=room.resources.oxygen;
 const r=skipTeamGame(room);
 assert.match(r.message,/已略過/);
 assert.equal(room.resources.oxygen,before);
 assert.equal(room.teamGamesCompleted[1],1);
 assert.equal(room.teamGame.kind,'pulse');
});
test('事件仍保留教師手動題目與災後修復功能',()=>{
 const {room,players:[p]}=roomWith();room.phase='playing';
 triggerEvent(room,'meteor');const task=room.event.task;
 assert.equal(publicState(room,p.token).event.answer,undefined);
 const bad=solveEvent(room,p,{formula:task.formula,answer:task.answer,unit:''});
 assert.equal(bad.reason,'missingUnit');
 const win=solveEvent(room,p,{formula:task.formula,answer:task.answer,unit:task.unit});
 assert.equal(win.correct,true);
 triggerEvent(room,'flare');failEvent(room);
 assert.equal(room.hazards.at(-1).status,'lingering');
 const result=math(room,p,'power');
 assert.equal(result.correct,true);
 assert.equal(room.hazards.filter(x=>x.id==='flare').length,0);
});
test('結束後課後複習與反思由老師查看，不洩漏其他學生資料',()=>{
 const {room,players:[p1,p2]}=roomWith(2);
 finishRoom(room);
 const qs=publicState(room,p1.token).ownReview.questions;
 assert.equal(qs.length,3);assert.equal(qs[0].answer,undefined);
 const answers=Object.fromEntries(p1.reviewQuestions.map(q=>[q.id,q.answer]));
 assert.equal(submitReview(room,p1,{answers,reflection:'我學會圓環面積',confidence:'understand'}).correct,3);
 assert.equal(publicState(room,p2.token).players[0].reviewReflection,undefined);
 assert.equal(publicState(room,room.hostToken).players[0].reviewScore,3);
 resetRoom(room);
 assert.equal(room.stage,1);
 assert.equal(publicState(room,p1.token).progress,0);
});
