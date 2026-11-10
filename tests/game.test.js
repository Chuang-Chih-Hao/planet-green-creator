import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayer, createRoom, makeTask, buildResult, checkWin, goalForCount,
  triggerEvent, solveEvent, failEvent, publicState, tick
} from '../server/game.js';

function roomWith(n) {
  const room = createRoom('TEST99');
  const players = Array.from({ length: n }, (_, i) => addPlayer(room, `學生${i + 1}`));
  return { room, players };
}
function correctTask(room, player, kind) {
  player.selectedKind = kind;
  player.task = makeTask(kind, 'basic', () => 0.12);
  return buildResult(room, player, {
    taskId: player.task.id, answer: String(player.task.answer),
    unit: player.task.unit, formula: player.task.formula
  });
}

test('1–5 人及課程長度決定每人平均建造量，4 人與 5 人不同', () => {
  assert.equal(goalForCount(1, 40), 5);
  assert.equal(goalForCount(2, 40), 10);
  assert.equal(goalForCount(3, 40), 15);
  assert.equal(goalForCount(4, 40), 20);
  assert.equal(goalForCount(5, 40), 25);
  assert.equal(goalForCount(999, 40), 25);
  assert.equal(goalForCount(4, 25), 12);
  assert.equal(goalForCount(4, 15), 8);
});

test('造林、衛星及圓環題的正確公式、數值、單位', () => {
  const forest = makeTask('forest', 'basic', () => 0);
  assert.equal(forest.unit, 'km²');
  assert.equal(forest.formula, 'area');
  assert.ok(Math.abs(forest.answer - 3.14 * 3 * 3) < 1e-9);
  const orbit = makeTask('orbit', 'basic', () => 0);
  assert.equal(orbit.unit, 'km');
  assert.equal(orbit.formula, 'circumference');
  assert.equal(orbit.answer, 2 * 3.14 * (4 + 2));
  const crater = makeTask('crater', 'basic', () => 0);
  assert.ok(Math.abs(crater.answer - 3.14 * (8**2 - 5**2)) < 1e-9);
  assert.equal(crater.formula, 'ring');
});

test('反求半徑不能把結果當平方公里', () => {
  const t = makeTask('forest', 'standard', () => 0.1);
  assert.equal(t.formula, 'reverse');
  assert.equal(t.unit, 'km');
  assert.equal(t.answer, 4);
});

test('錯誤公式或單位不建造，正確答案建立設施並增加資源', () => {
  const { room, players: [p] } = roomWith(1);
  room.phase = 'playing';
  room.requiredBuildings = 4;
  p.task = makeTask('forest', 'basic', () => 0);
  let got = buildResult(room, p, { taskId: p.task.id, answer: p.task.answer, formula: 'ring', unit: 'km²' });
  assert.equal(got.reason, 'formula');
  assert.equal(room.structures.length, 0);
  p.lastAnswerAt = 0;
  got = buildResult(room, p, { taskId: p.task.id, answer: p.task.answer, formula: 'area', unit: 'km' });
  assert.equal(got.reason, 'unit');
  assert.equal(room.structures.length, 0);
  p.lastAnswerAt = 0;
  got = buildResult(room, p, { taskId: p.task.id, answer: p.task.answer, formula: 'area', unit: 'km²' });
  assert.equal(got.correct, true);
  assert.equal(room.structures.length, 1);
  assert.equal(room.resources.oxygen, 36);
  assert.equal(p.correct, 1);
  assert.equal(p.answered, 3);
});

test('四人 15 分鐘局完成 8 項建造且三類工程齊全即可獲勝', () => {
  const { room, players } = roomWith(4);
  room.phase = 'playing';
  room.startingPlayers = 4;
  room.durationMinutes = 15;
  room.requiredBuildings = goalForCount(4, 15);
  for (let i = 0; i < 8; i++) {
    const kind = ['forest', 'orbit', 'crater'][i % 3];
    const p = players[i % 4];
    p.lastAnswerAt = 0;
    const result = correctTask(room, p, kind);
    assert.equal(result.correct, true);
  }
  assert.equal(room.phase, 'finished');
  assert.equal(room.result.win, true);
  assert.equal(room.structures.length, 8);
});

test('宇宙事件可由任一學生解決，錯誤不會立即結束', () => {
  const { room, players: [p] } = roomWith(1);
  room.phase = 'playing';
  triggerEvent(room, 'meteor');
  let got = solveEvent(room, p, { formula: 'area', answer: 125.6, unit: 'km²' });
  assert.equal(got.correct, false);
  assert.equal(room.event.id, 'meteor');
  p.lastAnswerAt = 0;
  got = solveEvent(room, p, { formula: 'ring', answer: 125.6, unit: 'km²' });
  assert.equal(got.correct, true);
  assert.equal(room.event, null);
  assert.equal(room.resources.stability, 93);
});

test('事件倒數結束只小幅扣資源，且暫停時不扣時間', () => {
  const { room } = roomWith(2);
  room.phase = 'playing';
  triggerEvent(room, 'flare');
  room.event.secondsLeft = 1;
  room.paused = true;
  const before = room.remainingSeconds;
  tick(room);
  assert.equal(room.remainingSeconds, before);
  assert.ok(room.event);
  room.paused = false;
  tick(room);
  assert.equal(room.event, null);
  assert.equal(room.resources.energy, 14);
});

test('學生公開資料不能看到尚未解的正確答案，房主看到全員統計', () => {
  const { room, players: [p] } = roomWith(1);
  const student = publicState(room, p.token);
  assert.ok(student.ownTask.id);
  assert.equal(student.ownTask.answer, undefined);
  assert.equal(student.ownTask.steps, undefined);
  assert.equal(student.players[0].mistakes, undefined);
  room.phase = 'playing';
  triggerEvent(room, 'meteor');
  assert.equal(publicState(room, p.token).event.answer, undefined);
  assert.equal(publicState(room, room.hostToken).event.answer, 125.6);
  const teacher = publicState(room, room.hostToken);
  assert.equal(teacher.ownTask, null);
  assert.deepEqual(teacher.players[0].mistakes, { formula: 0, value: 0, unit: 0 });
});
