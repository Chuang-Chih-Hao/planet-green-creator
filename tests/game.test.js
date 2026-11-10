import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayer, createRoom, makeTask, buildResult, checkWin, goalForCount,
  triggerEvent, solveEvent, failEvent, publicState, tick, startRoom, FORMULAS
} from '../server/game.js';
import { TASK_VARIANTS } from '../server/tasks-v2.js';
import { modeGoalList } from '../server/modes-v2.js';

function roomWith(n) {
  const room = createRoom('TEST99');
  const players = Array.from({ length: n }, (_, i) => addPlayer(room, `學生${i + 1}`));
  return { room, players };
}
function correctTask(room, player, kind, rng = () => 0) {
  player.selectedKind = kind;
  player.task = makeTask(kind, 'basic', rng);
  player.lastAnswerAt = 0;
  return buildResult(room, player, { taskId:player.task.id, answer:player.task.answer, unit:player.task.unit, formula:player.task.formula });
}

test('依 1–5 人／時長動態平衡：短局 3、標準局 5、長局 8 項每人', () => {
  assert.equal(goalForCount(1,40),8);
  assert.equal(goalForCount(4,40),32);
  assert.equal(goalForCount(5,40),40);
  assert.equal(goalForCount(999,40),40);
  assert.equal(goalForCount(4,25),20);
  assert.equal(goalForCount(4,15),12);
});

test('三種工程各有多種題型，數值整潔且可避免上一題同一題型', () => {
  for (const kind of ['forest','orbit','crater']) {
    const variants = TASK_VARIANTS[kind];
    assert.equal(variants.length,5);
    for (let i=0;i<5;i++) {
      const task=makeTask(kind,'advanced',()=>i/5);
      assert.equal(task.variant,variants[i]);
      assert.ok(Number.isFinite(task.answer));
      assert.equal(task.answer,Number(task.answer.toFixed(1)));
      assert.ok(task.question.length>20);
    }
    const previous=makeTask(kind,'basic',()=>0);
    const next=makeTask(kind,'basic',()=>0,previous.variant);
    assert.notEqual(next.variant,previous.variant);
  }
});

test('反求半徑公式明確呈現面積除以 π 與圓周長反求半徑',()=>{
  const fromArea=makeTask('forest','basic',()=>.7);
  assert.equal(fromArea.formula,'reverseArea');
  assert.equal(fromArea.unit,'km');
  assert.equal(fromArea.answer,15);
  assert.ok(FORMULAS.some(f=>f.id==='reverseArea' && f.text.includes('面積 ÷ π')));
  const fromCirc=makeTask('orbit','advanced',()=>.99);
  assert.equal(fromCirc.formula,'reverseCirc');
  assert.equal(fromCirc.unit,'km');
});

test('公式錯誤、單位錯誤不建造；成功更新資源和下一題',()=>{
  const {room,players:[p]}=roomWith(1);
  room.phase='playing';
  const task=makeTask('forest','basic',()=>0);
  p.task=task;
  let result=buildResult(room,p,{taskId:task.id,answer:task.answer,formula:'ring',unit:task.unit});
  assert.equal(result.reason,'formula');
  p.lastAnswerAt=0;
  result=buildResult(room,p,{taskId:task.id,answer:task.answer,formula:task.formula,unit:'km'});
  assert.equal(result.reason,'unit');
  p.lastAnswerAt=0;
  result=buildResult(room,p,{taskId:task.id,answer:task.answer,formula:task.formula,unit:task.unit});
  assert.equal(result.correct,true);
  assert.equal(room.resources.oxygen,28);
  assert.equal(room.structures.length,1);
  assert.notEqual(p.task.variant,task.variant);
});

test('生命復育不再只靠建築數通關：森林、氧氣、水循環需達標',()=>{
  const {room,players}=roomWith(4);
  room.durationMinutes=15;
  startRoom(room);
  assert.equal(room.requiredBuildings,12);
  for (let i=0;i<12;i++) correctTask(room,players[i%4],i<2?'forest':i<7?'orbit':'crater');
  assert.equal(room.phase,'playing','建築夠了但生態未達標不能過關');
  assert.ok(modeGoalList(room).some(g=>!g.met));
  for(let i=0;i<8 && room.phase==='playing';i++) correctTask(room,players[i%4],i%3===0?'crater':'forest');
  assert.equal(room.phase,'finished');
  assert.equal(room.result.win,true);
  assert.equal(publicState(room,room.hostToken).progress,100);
});

test('生態平衡需要四項資源門檻，危機守護要解除事件',()=>{
  const {room}=roomWith(2);
  room.phase='playing';
  room.gameMode='balance';
  let goals=modeGoalList(room);
  assert.ok(goals.some(g=>g.id==='oxygen' && !g.met));
  assert.ok(goals.some(g=>g.id==='energy' && g.met));
  room.gameMode='survival';
  goals=modeGoalList(room);
  assert.ok(goals.some(g=>g.id==='eventsWon' && !g.met));
});

test('事件立即損害星球、失敗留下異常、工程能修復並回復資源',()=>{
  const {room,players:[p]}=roomWith(1);
  room.phase='playing';
  triggerEvent(room,'meteor');
  assert.equal(room.resources.stability,58);
  assert.equal(room.hazards[0].status,'active');
  const before=room.remainingSeconds;
  room.paused=true;
  room.event.secondsLeft=1;
  tick(room);
  assert.equal(room.remainingSeconds,before);
  room.paused=false;
  tick(room);
  assert.equal(room.event,null);
  assert.equal(room.hazards[0].status,'lingering');
  assert.equal(room.resources.stability,48);
  const result=correctTask(room,p,'crater');
  assert.equal(result.correct,true);
  assert.equal(room.hazards.length,0);
  assert.equal(room.resources.stability,59); // +6 建造 -3 異常 +8 修復
});

test('成功解除事件會消除異常並獲得補給；失敗不直接禁止再次解題',()=>{
  const {room,players:[p]}=roomWith(1);
  room.phase='playing';
  triggerEvent(room,'flare');
  let result=solveEvent(room,p,{formula:'area',answer:62.8,unit:'km'});
  assert.equal(result.correct,false);
  p.lastAnswerAt=0;
  result=solveEvent(room,p,{formula:'circumference',answer:62.8,unit:'km'});
  assert.equal(result.correct,true);
  assert.equal(room.event,null);
  assert.equal(room.hazards.length,0);
  assert.equal(room.eventsWon,1);
  assert.equal(room.resources.energy,53); // 55 - 14 + 12 = 53
});

test('教師狀態可看每人題目但沒有解答；學生無法看到他人的題目',()=>{
  const {room,players:[p]}=roomWith(1);
  const teacher=publicState(room,room.hostToken);
  const student=publicState(room,p.token);
  assert.equal(teacher.players[0].task.question,p.task.question);
  assert.equal(teacher.players[0].task.answer,undefined);
  assert.equal(teacher.players[0].task.formula,undefined);
  assert.equal(student.players[0].task,undefined);
  assert.equal(student.ownTask.answer,undefined);
  room.phase='playing';triggerEvent(room,'meteor');
  assert.equal(publicState(room,room.hostToken).event.answer,undefined);
  assert.equal(publicState(room,p.token).event.answer,undefined);
});
