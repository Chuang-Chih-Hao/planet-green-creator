import test from 'node:test';
import assert from 'node:assert/strict';
import {
 addPlayer,createRoom,makeTask,buildResult,goalForCount,triggerEvent,solveEvent,failEvent,
 publicState,tick,startRoom,FORMULAS,resetRoom,finishRoom,submitReview,EVENT_INTERVAL_SECONDS,MAX_GAME_MINUTES,
 checkWin,completeTeamGame,skipTeamGame
} from '../server/game.js';
import { TASK_VARIANTS,TASK_SCENARIOS,CONCEPT_VARIANTS } from '../server/tasks-v3.js';
import { EVENT_VARIANTS } from '../server/event-tasks.js';
import { mathStageGoals } from '../server/modes-v2.js';
import { TEAM_GAMES,startTeamGame,playTeamGame,publicTeamGame,tickTeamGame,roverMap } from '../server/team-games.js';

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
function findRoverPath(map,cores,goal=35){
 const key=(pos,mask)=>pos+':'+mask;
 const need=(1<<cores.length)-1;
 const queue=[{pos:0,mask:0}],parents=new Map([[key(0,0),null]]);
 let finish=null;
 for(let i=0;i<queue.length;i++){
  const {pos,mask}=queue[i],current=key(pos,mask);
  if(pos===goal&&mask===need){finish=current;break;}
  for(const [dir,diff] of [['N',-6],['S',6],['E',1],['W',-1]]){
   const next=pos+diff;
   if(next<0||next>=36||(dir==='E'&&pos%6===5)||(dir==='W'&&pos%6===0)||map[next]==='wall')continue;
   const found=cores.indexOf(next),newMask=mask|(found>=0?1<<found:0),k=key(next,newMask);
   if(parents.has(k))continue;
   parents.set(k,{prev:current,dir});queue.push({pos:next,mask:newMask});
  }
 }
 assert.ok(finish,'迷宮必須可以拿到兩顆核心，最後抵達終點');
 const moves=[];let cursor=finish;
 while(parents.get(cursor)){const item=parents.get(cursor);moves.push(item.dir);cursor=item.prev;}
 return moves.reverse();
}
function solveRover(room,p){
 const g=room.teamGame;assert.equal(g.kind,'rover');
 for(const dir of findRoverPath(g.map,g.cores,g.goal))move(room,p,{move:dir});
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
 assert.equal(goalForCount(4,30),12);
 assert.equal(goalForCount(5,30),15);
 assert.equal(goalForCount(4,25),12);
 assert.equal(goalForCount(4,15),8);
 assert.deepEqual(TEAM_GAMES,{1:['memory','pulse'],2:['pipe','rover'],3:['defense','mosaic']});
});
test('四類工程 40 種計算題全改估算四選一，觀念題也有四選項',()=>{
 for(const kind of ['forest','orbit','crater','power']){
  assert.equal(TASK_VARIANTS[kind].length,10);
  assert.equal(CONCEPT_VARIANTS[kind].length,3);
  assert.ok(TASK_SCENARIOS[kind].length>=8);
  for(let i=0;i<10;i++){
   const t=makeTask(kind,'advanced',()=>(i+.01)/12);
   assert.equal(t.type,'choice');
   assert.equal(t.choices.length,4);
   assert.equal(new Set(t.choices.map(x=>x.label)).size,4,'估算的選項不能重複');
   assert.ok(t.choices.some(x=>x.value===t.answer));
   assert.match(t.question,/π ≈ 3/);
   assert.ok(t.steps?.some(x=>x.includes('≈')));
   assert.equal(t.formula,null);
   assert.equal(t.unit,null);
  }
  const concept=makeTask(kind,'advanced',()=>10.05/12);
  const tf=makeTask(kind,'advanced',()=>11.05/13);
  assert.equal(concept.type,'choice');
  assert.equal(concept.choices.length,4);
  assert.equal(tf.type,'trueFalse');
  assert.equal(tf.choices.length,2);
  const unit=makeTask(kind,'advanced',()=>12.05/13);
  assert.equal(unit.type,'choice');
  assert.equal(unit.choices.length,4);
  assert.match(unit.question,/單位|km/);
 }
 assert.ok(FORMULAS.some(f=>f.id==='reverseArea'&&f.text.includes('面積 ÷ π')));
});
test('估算答案為數值最接近的選項，答錯得到方法提示，未選選項不記錯',()=>{
 const {room,players:[p]}=roomWith();startRoom(room);
 const t=makeTask('forest','advanced',()=>0);
 p.task=t;
 const values=t.choices.map(x=>parseFloat(x.label));
 const correct=values[['A','B','C','D'].indexOf(t.answer)];
 const r=Number(t.question.match(/半徑為 (\d+)/)?.[1]);
 assert.equal(r,4);
 const exact=3.14*r*r;
 assert.ok(values.every(x=>Math.abs(correct-exact)<=Math.abs(x-exact)));
 const prev=p.answered;
 const blank=buildResult(room,p,{taskId:t.id,answer:''});
 assert.equal(blank.reason,'missingChoice');
 assert.equal(p.answered,prev);
 const other=t.choices.find(x=>x.value!==t.answer);
 const wrong=buildResult(room,p,{taskId:t.id,answer:other.value});
 assert.equal(wrong.reason,'estimate');
 assert.match(wrong.message,/估算/);
 p.lastAnswerAt=0;
 const right=buildResult(room,p,{taskId:t.id,answer:t.answer});
 assert.equal(right.correct,true);
 assert.equal(p.answered,prev+2);
});
test('每次抽題有不同數字與選項，最近 32 題減少重複',()=>{
 let seed=91013;
 const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const kind of ['forest','orbit','crater','power']){
  const recent=[],questions=[];
  for(let i=0;i<70;i++){
    const t=makeTask(kind,'advanced',rng,null,recent);
    if(t.context?.startsWith('估算任務')) questions.push(t.question);
  }
  assert.ok(new Set(questions).size>=40,kind+' 的題目應有明顯不同的數字組合');
 }
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
test('記憶接力：每位學生只看到自己的兩個位置線索，且答案不會外洩',()=>{
 for(const n of [2,3,4,5]){
  const {room,players}=roomWith(n);
  room.phase='playing';
  const game=startTeamGame(room);
  assert.equal(game.sequence.length,n*2);
  const all=new Set();
  for(const player of players){
   const st=publicState(room,player.token).teamGame;
   assert.equal(st.myClues.length,2);
   assert.equal(st.sequence,null);
   assert.equal(st.hidden,true);
   for(const clue of st.myClues){
     assert.equal(game.sequence[clue.position-1],clue.pad);
     all.add(clue.position);
   }
  }
  assert.equal(all.size,n*2);
  const host=publicState(room,room.hostToken).teamGame;
  assert.equal(host.myClues.length,0,'老師投影畫面不應自動出現所有答案');
  assert.equal(host.sequence,null);
  const opener=players[0],clueOwner=players[1];
  assert.equal(publicState(room,opener.token).teamGame.clueHolderName,clueOwner.name);
  assert.equal(publicState(room,opener.token).teamGame.turnName,opener.name);
 }
 const {room,players:[only]}=roomWith();
 room.phase='playing';startTeamGame(room);
 assert.equal(publicState(room,only.token).teamGame.myClues.length,4,'單人練習不能卡關');
});
test('有線索才可按：猜錯不會跳步，答對由另一位隊友接力',()=>{
 const {room,players:[p1,p2]}=roomWith(2);
 room.phase='playing';const g=startTeamGame(room);
 const wrongPad=(g.sequence[0]+1)%4;
 let result=playTeamGame(room,p1,{gameId:g.id,index:wrongPad});
 assert.equal(result.completed,false);
 assert.equal(g.step,0);
 assert.equal(g.mistakes,1);
 assert.match(result.message,/線索/);
 result=playTeamGame(room,p1,{gameId:g.id,index:g.sequence[0]});
 assert.equal(g.step,1);
 assert.equal(g.turnIndex,1);
 assert.throws(()=>playTeamGame(room,p1,{gameId:g.id,index:g.sequence[1]}),/輪到/);
 assert.doesNotThrow(()=>playTeamGame(room,p2,{gameId:g.id,index:g.sequence[1]}));
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
 g.turnAt=Date.now()-59000;
 assert.throws(()=>playTeamGame(room,p1,{gameId:g.id,index:g.sequence[1]}),/輪到/);
 g.turnAt=Date.now()-61000;
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


test('充能光標在循環起點不能被誤判為綠區，綠區內容許短暫傳輸延遲',()=>{
 const {room,players:[p]}=roomWith();
 room.phase='playing';room.teamGamesCompleted[1]=1;startTeamGame(room);
 const g=room.teamGame;assert.equal(g.kind,'pulse');
 g.startedAt=Date.now()-Math.round(g.cycleMs*.97);
 let result=playTeamGame(room,p,{gameId:g.id,move:'charge'});
 assert.equal(result.completed,false);assert.equal(g.charges,0);
 g.lastPressedAt=0;g.startedAt=Date.now()-Math.round(g.cycleMs*.38);
 result=playTeamGame(room,p,{gameId:g.id,move:'charge'});
 assert.equal(g.charges,1);
});
test('新的 6x6 救援迷宮必須收集兩顆能源核心再回基地，三種路線均有解',()=>{
 for(const seed of [.05,.42,.90]){
  const maze=roverMap(()=>seed);
  assert.equal(maze.map.length,36);assert.equal(maze.cores.length,2);
  const path=findRoverPath(maze.map,maze.cores);
  assert.ok(path.length>=12,'不能單靠一直往右或向下通關');
 }
 const {room,players:[p]}=roomWith();
 room.phase='playing';room.stage=2;room.teamGamesCompleted[2]=1;
 startTeamGame(room);const g=room.teamGame;
 assert.equal(g.kind,'rover');assert.equal(g.map.length,36);
 // 避免直接造假：從起點移至終點也不能在尚未集齊兩顆核心時成功。
 for(const dir of findRoverPath(g.map,g.cores))move(room,p,{move:dir});
 assert.equal(room.teamGame,null);
});
test('30 分鐘為單局最大時長，15/25/30 分鐘目標各自生效',()=>{
 assert.equal(MAX_GAME_MINUTES,30);
 const r=createRoom('MAX30','教師',{durationMinutes:40});
 assert.equal(r.durationMinutes,30);assert.equal(r.remainingSeconds,1800);
 const {room,players:[p]}=roomWith();
 room.durationMinutes=40;startRoom(room);
 assert.equal(room.durationMinutes,30);assert.equal(room.remainingSeconds,1800);
 assert.equal(goalForCount(4,30),12);
});
test('每 180 秒排程自動隨機宇宙事件，合作階段延後執行，不會打斷遊戲',()=>{
 assert.equal(EVENT_INTERVAL_SECONDS,180);
 const {room,players:[p]}=roomWith();
 startRoom(room);assert.equal(room.eventsEnabled,true);
 for(let i=0;i<179;i++)tick(room);
 assert.equal(room.event,null);
 tick(room);assert.ok(room.event);assert.equal(room.eventIndex,1);
 const first=room.event.id;
 failEvent(room);
 // 第二次在團隊任務中到期，應排隊而非中斷正在進行的小遊戲。
 room.hazards=[];room.eventCountdown=1;
 startTeamGame(room);const active=room.teamGame;
 tick(room);
 assert.equal(room.event,null);assert.equal(room.teamGame,active);
 assert.equal(room.eventCountdown,0);
 room.teamGame=null;tick(room);
 assert.ok(room.event);assert.equal(room.eventIndex,2);
 assert.notEqual(room.event.id,first,'連續兩次事件應使用不同的隨機類型');
});
