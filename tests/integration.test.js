import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
async function post(path, body) {
  const res = await fetch(`${base}/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await res.json();
  return { status: res.status, ...payload };
}

test('首頁、health 與靜態檔案可提供', async () => {
  for (const path of ['/', '/app.js', '/scratchpad.js', '/style.css', '/favicon.svg', '/api/health']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, `${path} should exist`);
  }
});

test('房主建立房間、4 名學生加入、開始遊戲、同步答題，且第五人仍可加入', async () => {
  const create = await post('create', { name: '老師' });
  assert.equal(create.status, 200);
  assert.equal(create.state.role, 'host');
  const code = create.state.code;
  const hostToken = create.token;
  const students = [];
  for (let i = 0; i < 4; i++) {
    const res = await post('join', { name: `學生${i+1}`, code });
    assert.equal(res.status, 200);
    students.push(res);
  }
  const start = await post('action', { token: hostToken, action: 'start' });
  assert.equal(start.state.startingPlayers, 4);
  assert.equal(start.state.requiredBuildings, 32);
  assert.equal(start.state.phase, 'playing');
  const late = await post('join', { name: '補位同學', code });
  assert.equal(late.status, 200);
  const full = await post('join', { name: '第六位學生', code });
  assert.equal(full.status, 400);
  // 教師查看正在作答的即時題目，答案須另外驗證權限、明確按鈕索取。
  const hostBefore = await fetch(`${base}/api/state?token=${hostToken}`).then(r=>r.json());
  assert.equal(hostBefore.state.players[0].task.answer, undefined);
  assert.ok(hostBefore.state.players[0].task.question);
  const reveal = await post('action', {token:hostToken, action:'revealAnswer', playerId:hostBefore.state.players[0].id,taskId:hostBefore.state.players[0].task.id});
  assert.equal(reveal.status,200);
  assert.ok(Number.isFinite(reveal.feedback.answer));
  const studentToken = students[0].token;
  const deniedReveal = await post('action', {token:studentToken, action:'revealAnswer',playerId:hostBefore.state.players[0].id});
  assert.equal(deniedReveal.status,403);
  const stateRes = await fetch(`${base}/api/state?token=${encodeURIComponent(studentToken)}`);
  const studentState = (await stateRes.json()).state;
  assert.equal(studentState.role, 'student');
  const task = studentState.ownTask;
  // 答案僅於伺服器驗算：這裡從題目建立測試策略，無法透過 API 拿到答案。
  const select = await post('action', { token: studentToken, action: 'selectTask', kind: 'forest' });
  assert.equal(select.status, 200);
  assert.equal(select.state.ownTask.kind, 'forest');
  const denied = await post('action', { token: studentToken, action: 'pause' });
  assert.equal(denied.status, 403);
  const event = await post('action', { token: hostToken, action: 'event', eventId: 'alien' });
  assert.equal(event.state.event.id, 'alien');
  const eventKey = await post('action', { token:hostToken, action:'revealAnswer', scope:'event' });
  assert.equal(eventKey.status,200);
  const eventDone = await post('action', { token: studentToken, action: 'eventAnswer', formula: eventKey.feedback.formula, answer: eventKey.feedback.answer, unit: eventKey.feedback.unit });
  assert.equal(eventDone.feedback.correct, true);
  assert.equal(eventDone.state.event, null);
  assert.equal(eventDone.state.resources.energy, 29);
  const ending = await post('action', { token: hostToken, action: 'finish' });
  assert.equal(ending.state.phase, 'finished');
  const reset = await post('action', { token: hostToken, action: 'reset' });
  assert.equal(reset.state.phase, 'lobby');
  assert.equal(reset.state.players.length, 5);
  assert.equal(reset.state.progress,0);
  assert.equal(reset.state.resources.energy,25);
});

test('SSE 訂閱可收到房間更新，供多人即時同步', async () => {
  const created = await post('create', { name: '連線測試房主' });
  const token = created.token;
  const controller = new AbortController();
  const res = await fetch(`${base}/api/stream?token=${encodeURIComponent(token)}`, { signal: controller.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const reader = res.body.getReader();
  let buffer = '';
  try {
    const initial = await reader.read();
    buffer += new TextDecoder().decode(initial.value || new Uint8Array());
    assert.match(buffer, /event: state/);
    const joined = await post('join', { name: '即時同步學生', code: created.state.code });
    assert.equal(joined.status, 200);
    const start = Date.now();
    while (!buffer.includes('即時同步學生') && Date.now() - start < 2_000) {
      const part = await reader.read();
      if (part.done) break;
      buffer += new TextDecoder().decode(part.value);
    }
    assert.match(buffer, /即時同步學生/);
  } finally {
    controller.abort();
  }
});

test('四人局有人正式離開後會降為三人目標，原暱稱可以再加入', async () => {
  const created = await post('create', { name: '離房測試老師' });
  const students = [];
  for (let i = 1; i <= 4; i++) students.push(await post('join', { code: created.state.code, name: `試玩學生${i}` }));
  const begin = await post('action', { token: created.token, action: 'start' });
  assert.equal(begin.state.requiredBuildings, 32);
  const left = await post('action', { token: students[0].token, action: 'leave' });
  assert.equal(left.status, 200);
  assert.equal(left.left, true);
  const hostState = await fetch(`${base}/api/state?token=${created.token}`).then(r => r.json());
  assert.equal(hostState.state.players.length, 3);
  assert.equal(hostState.state.requiredBuildings, 24);
  const rejoin = await post('join', { code: created.state.code, name: '試玩學生1' });
  assert.equal(rejoin.status, 200);
  assert.equal(rejoin.state.players.length, 4);
  assert.equal(rejoin.state.requiredBuildings, 24, '遲到玩家加入不應提高既有目標');
});


test('房主可設定三種遊戲模式，開始後不能變更，且僅教師能查看事件答案',async()=>{
 const created=await post('create',{name:'模式老師'});
 const host=created.token;
 const options=await post('action',{token:host,action:'settings',gameMode:'survival'});
 assert.equal(options.state.gameMode,'survival');
 assert.equal(options.state.eventsEnabled,true);
 const joined=await post('join',{name:'測試學生',code:created.state.code});
 await post('action',{token:host,action:'start'});
 const event=await post('action',{token:host,action:'event',eventId:'meteor'});
 assert.ok(event.state.hazards.length>0);
 assert.equal(event.state.event.answer,undefined);
 const denied=await post('action',{token:joined.token,action:'revealAnswer',scope:'event'});
 assert.equal(denied.status,403);
 const answer=await post('action',{token:host,action:'revealAnswer',scope:'event'});
 assert.equal(answer.status,200);
 assert.ok(Number.isFinite(answer.feedback.answer));
 assert.ok(['ring','area','reverseArea','reverseCirc','circumference'].includes(answer.feedback.formula));
 const modeLocked=await post('action',{token:host,action:'settings',gameMode:'growth'});
 assert.equal(modeLocked.state.gameMode,'survival');
 const skipped=await post('action',{token:host,action:'skipEvent'});
 assert.equal(skipped.state.hazards.length,0);
 assert.equal(skipped.state.resources.stability,58,'略過保留已造成的衝擊');
});
