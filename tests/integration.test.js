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
  for (const path of ['/', '/app.js', '/style.css', '/favicon.svg', '/api/health']) {
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
  assert.equal(start.state.requiredBuildings, 20);
  assert.equal(start.state.phase, 'playing');
  const late = await post('join', { name: '補位同學', code });
  assert.equal(late.status, 200);
  const full = await post('join', { name: '第六位學生', code });
  assert.equal(full.status, 400);
  const studentToken = students[0].token;
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
  const eventDone = await post('action', { token: studentToken, action: 'eventAnswer', formula: 'circumference', answer: '56.52', unit: 'km' });
  assert.equal(eventDone.feedback.correct, true);
  assert.equal(eventDone.state.event, null);
  assert.equal(eventDone.state.resources.energy, 37);
  const ending = await post('action', { token: hostToken, action: 'finish' });
  assert.equal(ending.state.phase, 'finished');
  const reset = await post('action', { token: hostToken, action: 'reset' });
  assert.equal(reset.state.phase, 'lobby');
  assert.equal(reset.state.players.length, 5);
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
  assert.equal(begin.state.requiredBuildings, 20);
  const left = await post('action', { token: students[0].token, action: 'leave' });
  assert.equal(left.status, 200);
  assert.equal(left.left, true);
  const hostState = await fetch(`${base}/api/state?token=${created.token}`).then(r => r.json());
  assert.equal(hostState.state.players.length, 3);
  assert.equal(hostState.state.requiredBuildings, 15);
  const rejoin = await post('join', { code: created.state.code, name: '試玩學生1' });
  assert.equal(rejoin.status, 200);
  assert.equal(rejoin.state.players.length, 4);
  assert.equal(rejoin.state.requiredBuildings, 15, '遲到玩家加入不應提高既有目標');
});
