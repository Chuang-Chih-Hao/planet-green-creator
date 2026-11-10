import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_PLAYERS, TASK_KINDS, goalForCount, createRoom, addPlayer, newCode, publicState,
  makeTask, startRoom, buildResult, triggerEvent, solveEvent, log,
  resetRoom, finishRoom, tick, checkWin, submitReview
} from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '../client');
const rooms = new Map();
const sessions = new Map();
const listeners = new Map();
const PORT = Number(process.env.PORT || 3000);

class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new HttpError('資料長度超過限制', 413);
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new HttpError('請傳送有效的 JSON'); }
}

function lookup(token) {
  const session = sessions.get(token);
  if (!session) throw new HttpError('登入已失效，請重新加入房間', 401);
  const room = rooms.get(session.roomCode);
  if (!room) { sessions.delete(token); throw new HttpError('房間已不存在', 404); }
  if (session.role === 'student' && !room.players.some(p => p.token === token)) {
    sessions.delete(token); throw new HttpError('你已離開房間', 401);
  }
  room.updatedAt = Date.now();
  return { ...session, room, player: session.role === 'student' ? room.players.find(p => p.token === token) : null };
}

function requireHost(session) {
  if (session.role !== 'host') throw new HttpError('這項操作只有房主能執行', 403);
}
function requireStudent(session) {
  if (session.role !== 'student') throw new HttpError('這項操作只有學生能執行', 403);
}

function pushEvent(res, event, data) {
  if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function broadcast(room) {
  const connected = listeners.get(room.code);
  if (!connected) return;
  for (const client of connected) {
    try { pushEvent(client.res, 'state', publicState(room, client.token)); }
    catch { client.res.end(); connected.delete(client); }
  }
}
function clock(room) {
  const connected = listeners.get(room.code);
  if (!connected) return;
  for (const client of connected) pushEvent(client.res, 'clock', { remainingSeconds: room.remainingSeconds, eventSecondsLeft: room.event?.secondsLeft ?? null, eventCountdown: room.eventCountdown });
}

async function api(req, res, pathname, searchParams) {
  if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'planet-green-creator', rooms: rooms.size });
  if (pathname === '/api/create' && req.method === 'POST') {
    if (rooms.size >= 150) throw new HttpError('目前房間數已達上限，請稍後再試', 503);
    const body = await readBody(req);
    const code = newCode(new Set(rooms.keys()));
    const room = createRoom(code, body.name);
    rooms.set(code, room);
    sessions.set(room.hostToken, { roomCode: code, role: 'host' });
    return json(res, 200, { token: room.hostToken, state: publicState(room, room.hostToken) });
  }
  if (pathname === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    const code = String(body.code ?? '').toUpperCase().replace(/\s/g, '');
    const room = rooms.get(code);
    if (!room) throw new HttpError('找不到房間，請檢查 6 碼代碼', 404);
    let player;
    try { player = addPlayer(room, body.name); } catch (e) { throw new HttpError(e.message); }
    sessions.set(player.token, { roomCode: room.code, role: 'student' });
    if (room.phase === 'lobby') room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
    log(room, 'join', `${player.name} 登陸星球！`);
    broadcast(room);
    return json(res, 200, { token: player.token, state: publicState(room, player.token) });
  }
  if (pathname === '/api/state' && req.method === 'GET') {
    const token = searchParams.get('token') ?? '';
    const session = lookup(token);
    if (session.player && !session.player.connected) {
      session.player.connected = true;
      broadcast(session.room);
    }
    return json(res, 200, { state: publicState(session.room, token) });
  }
  if (pathname === '/api/stream' && req.method === 'GET') {
    const token = searchParams.get('token') ?? '';
    const { room, player } = lookup(token);
    if (player) player.connected = true;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no'
    });
    res.write(': connected\n\n');
    const client = { token, res };
    if (!listeners.has(room.code)) listeners.set(room.code, new Set());
    listeners.get(room.code).add(client);
    pushEvent(res, 'state', publicState(room, token));
    broadcast(room);
    const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(': heartbeat\n\n'); }, 22_000);
    res.on('close', () => {
      clearInterval(heartbeat);
      const list = listeners.get(room.code);
      list?.delete(client);
      if (list?.size === 0) listeners.delete(room.code);
      if (player) {
        const hasOtherConnection = [...(list ?? [])].some(c => c.token === token);
        if (!hasOtherConnection) { player.connected = false; broadcast(room); }
      }
    });
    return;
  }
  if (pathname === '/api/action' && req.method === 'POST') {
    const body = await readBody(req);
    const session = lookup(body.token);
    const room = session.room;
    const action = String(body.action ?? '');
    let feedback = null;
    if (action === 'revealAnswer') {
      requireHost(session);
      let task;
      if (body.scope === 'event') {
        if (!room.event) throw new HttpError('目前沒有事件題目');
        task = room.event.task; // 每場隨機題目的答案只回傳給房主
      } else {
        const player = room.players.find(p => p.id === body.playerId);
        if (!player?.task || (body.taskId && body.taskId !== player.task.id)) throw new HttpError('題目已更新，請重新查看');
        task = player.task;
      }
      // 只回傳給發出請求的教師，不儲存到共用狀態、日誌或 SSE。
      return json(res, 200, { ok:true, feedback:{ answer:task.answer, formula:task.formula, unit:task.unit, steps:task.steps, taskId:task.id ?? null } });
    }
    if (action === 'leave') {
      requireStudent(session);
      const idx = room.players.findIndex(p => p.token === body.token);
      if (idx >= 0) room.players.splice(idx, 1);
      sessions.delete(body.token);
      log(room, 'system', `${session.player.name} 已離開星球。`);
      if (room.phase === 'playing') {
        room.startingPlayers = room.players.length;
        room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
        checkWin(room);
      } else if (room.phase === 'lobby') room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
      const connected = listeners.get(room.code);
      for (const client of connected ?? []) {
        if (client.token === body.token) { pushEvent(client.res, 'kicked', { message: '你已離開房間' }); client.res.end(); connected.delete(client); }
      }
      broadcast(room);
      return json(res, 200, { ok: true, left: true });
    }
    if (action === 'start') {
      requireHost(session);
      try { startRoom(room); } catch (e) { throw new HttpError(e.message); }
    } else if (action === 'pause') {
      requireHost(session);
      if (room.phase !== 'playing') throw new HttpError('遊戲尚未開始');
      room.paused = !room.paused;
      log(room, 'system', room.paused ? '老師已暫停時間與事件。' : '老師已恢復任務。');
    } else if (action === 'settings') {
      requireHost(session);
      if (['basic', 'standard', 'advanced'].includes(body.difficulty)) room.difficulty = body.difficulty;
      if (typeof body.eventsEnabled === 'boolean') room.eventsEnabled = body.eventsEnabled;
      if (room.phase === 'lobby' && [15, 25, 40].includes(Number(body.durationMinutes))) {
        room.durationMinutes = Number(body.durationMinutes);
        room.remainingSeconds = room.durationMinutes * 60;
        room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
      }
    } else if (action === 'event') {
      requireHost(session);
      try { triggerEvent(room, body.eventId); } catch (e) { throw new HttpError(e.message); }
    } else if (action === 'skipEvent') {
      requireHost(session);
      if (!room.event) throw new HttpError('目前沒有進行中的事件');
      const hazardId = room.event.hazardId;
      room.hazards = room.hazards.filter(h => h.key !== hazardId);
      log(room, 'system', '老師已略過事件：移除當次異常，但已發生的初始資源衝擊仍保留。');
      room.event = null;
      room.eventCountdown = 110;
      // 教師明確略過劇情危機視為教學管理特例，避免自動事件關閉後卡關。
      if(room.stage===3){room.stageChallengesResolved++;checkWin(room);}
    } else if (action === 'finish') {
      requireHost(session);
      finishRoom(room);
    } else if (action === 'reset') {
      requireHost(session);
      resetRoom(room);
    } else if (action === 'removePlayer') {
      requireHost(session);
      if (room.phase === 'playing') {
        const target = room.players.find(p => p.id === body.playerId);
        if (target?.connected) throw new HttpError('進行中只能移除離線學生');
      }
      const i = room.players.findIndex(p => p.id === body.playerId);
      if (i < 0) throw new HttpError('找不到這位學生');
      const [removed] = room.players.splice(i, 1);
      const clients = listeners.get(room.code);
      for (const client of clients ?? []) {
        if (client.token === removed.token) {
          pushEvent(client.res, 'kicked', { message: '房主已將你移出房間' });
          client.res.end(); clients.delete(client);
        }
      }
      sessions.delete(removed.token);
      room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
      if (room.phase === 'playing') { room.startingPlayers = room.players.length; checkWin(room); }
      log(room, 'system', `${removed.name} 已退出房間，已重新平衡建造目標。`);
    } else if (action === 'selectTask') {
      requireStudent(session);
      if (room.phase !== 'playing' || room.paused) throw new HttpError('請等候老師開始或恢復遊戲');
      if (!TASK_KINDS.includes(body.kind)) throw new HttpError('無效的建造類型');
      session.player.selectedKind = body.kind;
      session.player.task = makeTask(body.kind, room.difficulty, Math.random, session.player.lastVariants?.[body.kind], session.player.recentQuestions);
      session.player.lastVariants ??= {};
      session.player.lastVariants[body.kind] = session.player.task.variant;
      session.player.hintUsed = false;
    } else if (action === 'hint') {
      requireStudent(session);
      if (room.phase !== 'playing' || room.paused) throw new HttpError('遊戲暫停中');
      if (!session.player.hintUsed) session.player.hints++;
      session.player.hintUsed = true;
      feedback = { hint: session.player.task?.hint };
    } else if (action === 'answer') {
      requireStudent(session);
      try { feedback = buildResult(room, session.player, body); }
      catch (e) { throw new HttpError(e.message); }
    } else if (action === 'eventAnswer') {
      requireStudent(session);
      try { feedback = solveEvent(room, session.player, body); }
      catch (e) { throw new HttpError(e.message); }
    } else if (action === 'submitReview') {
      requireStudent(session);
      try { feedback = submitReview(room, session.player, body); }
      catch (e) { throw new HttpError(e.message); }
    } else throw new HttpError('不支援的操作');
    broadcast(room);
    return json(res, 200, { ok: true, feedback, state: publicState(room, body.token) });
  }
  throw new HttpError('找不到 API 路徑', 404);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
};
function staticFile(req, res, pathname) {
  if (req.method !== 'GET') return json(res, 405, { error: '不支援的 HTTP 方法' });
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.resolve(WEB_DIR, '.' + safePath);
  if (!fullPath.startsWith(WEB_DIR + path.sep)) return json(res, 403, { error: '禁止存取' });
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return json(res, 404, { error: '找不到檔案' });
  res.writeHead(200, { 'content-type': contentTypes[path.extname(fullPath)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
  fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url.pathname, url.searchParams);
    return staticFile(req, res, url.pathname);
  } catch (error) {
    if (res.headersSent) { res.end(); return; }
    json(res, error.status || 500, { error: error.status ? error.message : '伺服器發生問題，請重試。' });
    if (!error.status) console.error('[server]', error);
  }
});

const timer = setInterval(() => {
  for (const room of rooms.values()) {
    const oldEvent = room.event?.id, oldPhase = room.phase;
    tick(room);
    if (room.phase === 'playing' || room.phase !== oldPhase) clock(room);
    if (oldEvent !== room.event?.id || room.phase !== oldPhase) broadcast(room);
    if (Date.now() - room.updatedAt > 6 * 60 * 60 * 1000) {
      for (const player of room.players) sessions.delete(player.token);
      sessions.delete(room.hostToken);
      rooms.delete(room.code);
      const clients = listeners.get(room.code);
      for (const client of clients ?? []) client.res.end();
      listeners.delete(room.code);
    }
  }
}, 1_000);
timer.unref();

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => console.log(`🌍 星球綠化造物主運行中：http://localhost:${PORT}`));
}
export { server, rooms, sessions };
