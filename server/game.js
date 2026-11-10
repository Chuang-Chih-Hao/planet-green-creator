import { randomBytes, randomUUID } from 'node:crypto';

export const MAX_PLAYERS = 5;
export const PI = 3.14;
export const TASK_KINDS = ['forest', 'orbit', 'crater'];
export const FORMULAS = [
  { id: 'area', text: 'π × 半徑 × 半徑' },
  { id: 'circumference', text: '2 × π × 半徑（或 π × 直徑）' },
  { id: 'ring', text: '大圓面積 − 小圓面積' },
  { id: 'reverse', text: '面積 ÷ π，再找半徑' }
];
export const KIND_INFO = {
  forest: { title: '生態造林', emoji: '🌳', color: '#3fe5aa', resource: '氧氣' },
  orbit: { title: '星環防衛', emoji: '🛰️', color: '#8faeff', resource: '防禦' },
  crater: { title: '地形修復', emoji: '🛠️', color: '#ffc36d', resource: '穩定度' }
};
const choice = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = n => String(round2(n));
const safeStr = v => String(v ?? '').trim();

export function cleanName(name) {
  return safeStr(name).replace(/[<>\\]/g, '').replace(/\s+/g, ' ').slice(0, 16);
}

export function goalForCount(n, durationMinutes = 40) {
  // 每人平均工作量相同；40 分鐘完整局需要 5 項/人，25 分鐘 3 項/人，15 分鐘 2 項/人。
  const perPlayer = durationMinutes >= 40 ? 5 : durationMinutes >= 25 ? 3 : 2;
  return Math.max(4, perPlayer * Math.min(MAX_PLAYERS, Math.max(1, n)));
}

export function newCode(existing = new Set()) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = randomBytes(6);
    const code = [...bytes].map(b => alphabet[b % alphabet.length]).join('');
    if (!existing.has(code)) return code;
  }
  throw new Error('無法建立房間代碼');
}

export function makeTask(kind = 'forest', difficulty = 'standard', rng = Math.random) {
  if (!TASK_KINDS.includes(kind)) throw new Error('無效的任務類型');
  const advanced = difficulty === 'advanced';
  const standard = difficulty !== 'basic';
  let question, answer, formula, unit, steps, hint, title, context;
  if (kind === 'forest') {
    const reverse = standard && rng() < (advanced ? .55 : .35);
    if (reverse) {
      const radius = choice([4, 5, 6, 8, 10], rng);
      const area = round2(PI * radius * radius);
      question = `造林區需要 ${fmt(area)} 平方公里的森林。圓形造林機的半徑應設定為幾公里？`;
      answer = radius; formula = 'reverse'; unit = 'km';
      steps = [`圓面積 = 3.14 × 半徑 × 半徑`, `半徑 × 半徑 = ${fmt(area)} ÷ 3.14 = ${radius * radius}`, `半徑 = ${radius} 公里`];
      hint = '先把面積除以 3.14，再找哪個數乘自己等於商。';
      title = '逆推造林半徑';
    } else {
      const radius = choice(advanced ? [7, 9, 11, 12] : [3, 4, 5, 6, 8, 10], rng);
      question = `新森林規劃成半徑 ${radius} 公里的圓形區域。需要規劃幾平方公里？`;
      answer = round2(PI * radius * radius); formula = 'area'; unit = 'km²';
      steps = [`圓面積 = 3.14 × ${radius} × ${radius}`, `= ${fmt(answer)} 平方公里`];
      hint = '用圓面積公式，注意半徑必須乘兩次。';
      title = '啟動森林培育機';
    }
    context = '計算正確，造林機才能在星球上種下森林。';
  } else if (kind === 'orbit') {
    const diameter = standard && rng() < (advanced ? .35 : .25);
    if (diameter) {
      const d = choice([10, 12, 14, 16, 18], rng);
      question = `防禦衛星要沿著直徑 ${d} 公里的圓形軌道飛行一圈，軌道全長是多少公里？`;
      answer = round2(PI * d); formula = 'circumference'; unit = 'km';
      steps = [`圓周長 = 3.14 × 直徑`, `= 3.14 × ${d} = ${fmt(answer)} 公里`];
      hint = '題目給的是直徑，可直接用 π × 直徑。';
      title = '部署巡航衛星';
    } else {
      const r = choice(advanced ? [7, 9, 11] : [4, 5, 6, 8, 10], rng);
      const gap = choice(advanced ? [3, 4] : [2, 3], rng);
      const orbitalRadius = r + gap;
      question = `星球半徑是 ${r} 公里，衛星軌道距離地表 ${gap} 公里。衛星繞行一周需要飛行幾公里？`;
      answer = round2(2 * PI * orbitalRadius); formula = 'circumference'; unit = 'km';
      steps = [`軌道半徑 = ${r} + ${gap} = ${orbitalRadius} 公里`, `圓周長 = 2 × 3.14 × ${orbitalRadius}`, `= ${fmt(answer)} 公里`];
      hint = '軌道半徑是「星球半徑＋離地高度」，不是只用離地高度。';
      title = '建置星環軌道';
    }
    context = '軌道總長度正確，衛星才能穩定巡航。';
  } else {
    const pairs = advanced ? [[12, 7], [13, 9], [14, 8], [11, 6]] : [[8, 5], [9, 6], [10, 6], [7, 3], [12, 10]];
    const [outer, inner] = choice(pairs, rng);
    question = `隕石坑外圈半徑 ${outer} 公里，中央保留區半徑 ${inner} 公里。兩圓之間的環狀區域需要修復幾平方公里？`;
    answer = round2(PI * (outer ** 2 - inner ** 2)); formula = 'ring'; unit = 'km²';
    steps = [`圓環面積 = 大圓面積 − 小圓面積`, `= 3.14 × (${outer} × ${outer} − ${inner} × ${inner})`, `= ${fmt(answer)} 平方公里`];
    hint = '不是把兩個半徑相減後直接平方；要先算大圓與小圓的面積差。';
    title = '修復環形隕石坑';
    context = '算出需要填補的面積，才能修復星球地表。';
  }
  return {
    id: randomUUID(), kind, title, question, context, formula, unit, answer, hint, steps,
    difficulty, pi: PI
  };
}

export const EVENTS = {
  meteor: {
    name: '隕石墜落', emoji: '☄️', style: 'meteor',
    description: '隕石撞出環狀坑洞！全隊必須算出修復面積，否則星球穩定度將降低。',
    question: '隕石坑外圈半徑 7 公里，核心半徑 3 公里。需要修補的圓環面積是多少平方公里？',
    answer: 125.6, formula: 'ring', unit: 'km²',
    steps: ['3.14 × (7 × 7 − 3 × 3)', '= 3.14 × 40 = 125.6 平方公里'],
    hint: '先算兩個圓的面積，再相減。', reward: { stability: 13, energy: 7 }, penalty: { stability: -10 }
  },
  flare: {
    name: '太陽風暴', emoji: '☀️', style: 'flare',
    description: '高能粒子正在接近！算出防護軌道長度，才能及時啟動護盾。',
    question: '星球半徑 8 公里，防護軌道距離地表 2 公里。軌道一圈長多少公里？',
    answer: 62.8, formula: 'circumference', unit: 'km',
    steps: ['軌道半徑 = 8 + 2 = 10 公里', '2 × 3.14 × 10 = 62.8 公里'],
    hint: '先把 2 公里的離地高度加進半徑。', reward: { stability: 8, energy: 12 }, penalty: { energy: -10 }
  },
  rain: {
    name: '星際生命之雨', emoji: '🌧️', style: 'rain',
    description: '宇宙雲層帶來珍貴水分！算出收集面積，就能把資源留在星球。',
    question: '水分收集罩覆蓋半徑 6 公里的圓形區域。面積是多少平方公里？',
    answer: 113.04, formula: 'area', unit: 'km²',
    steps: ['3.14 × 6 × 6', '= 113.04 平方公里'],
    hint: '圓面積 = 3.14 × 半徑 × 半徑。', reward: { water: 20, oxygen: 6 }, penalty: { water: -5 }
  },
  alien: {
    name: '外星探測船', emoji: '🛸', style: 'alien',
    description: '友善的外星探測船想測試星球導航！正確計算可獲得科技補給。',
    question: '導航軌道的直徑是 18 公里。探測船飛行一圈的路程有多少公里？',
    answer: 56.52, formula: 'circumference', unit: 'km',
    steps: ['3.14 × 直徑', '= 3.14 × 18 = 56.52 公里'],
    hint: '題目給的是直徑，直接用圓周率乘直徑。', reward: { energy: 13, water: 9 }, penalty: { energy: -5 }
  }
};

const clamp = n => Math.max(0, Math.min(100, n));

export function adjustResources(resources, effect) {
  for (const [key, amount] of Object.entries(effect)) {
    resources[key] = clamp((resources[key] ?? 0) + amount);
  }
}

export function createRoom(code, hostName = '老師', options = {}) {
  return {
    code, hostName: cleanName(hostName) || '老師', hostToken: randomUUID() + randomUUID(),
    createdAt: Date.now(), updatedAt: Date.now(), phase: 'lobby', paused: false,
    durationMinutes: options.durationMinutes || 40, remainingSeconds: (options.durationMinutes || 40) * 60,
    eventsEnabled: true, difficulty: 'standard', players: [], history: [], structures: [],
    event: null, eventIndex: 0, lastEventId: null, eventCountdown: 110, startingPlayers: 0,
    requiredBuildings: 4, resources: { oxygen: 20, water: 20, energy: 24, stability: 80 },
    completed: { forest: 0, orbit: 0, crater: 0 }, result: null
  };
}

export function addPlayer(room, nickname) {
  const name = cleanName(nickname);
  if (!name) throw new Error('請輸入 1～16 個字的暱稱');
  if (room.players.length >= MAX_PLAYERS) throw new Error('房間已滿（最多 5 位學生）');
  if (room.players.some(p => p.name === name)) throw new Error('這個暱稱已有人使用');
  const player = {
    id: randomUUID(), token: randomUUID() + randomUUID(), name, connected: true,
    joinedAt: Date.now(), selectedKind: 'forest', task: makeTask('forest', room.difficulty),
    answered: 0, correct: 0, hints: 0, mistakes: { formula: 0, value: 0, unit: 0 },
    lastAnswerAt: 0, hintUsed: false, stars: 0
  };
  room.players.push(player);
  return player;
}

export function startRoom(room) {
  if (room.phase !== 'lobby') throw new Error('目前無法開始');
  if (!room.players.length) throw new Error('至少需要 1 位學生才能開始');
  room.phase = 'playing'; room.paused = false;
  room.startingPlayers = room.players.length;
  room.requiredBuildings = goalForCount(room.startingPlayers, room.durationMinutes);
  room.remainingSeconds = room.durationMinutes * 60;
  room.eventCountdown = 110;
  for (const player of room.players) player.task = makeTask(player.selectedKind, room.difficulty);
  log(room, 'system', `任務啟動：${room.startingPlayers} 人模式，需完成 ${room.requiredBuildings} 項建造並涵蓋三類工程。`);
}

export function log(room, type, message, extra = {}) {
  room.history.unshift({ id: randomUUID(), at: Date.now(), type, message, ...extra });
  if (room.history.length > 120) room.history.length = 120;
}

export function buildResult(room, player, submitted) {
  if (room.phase !== 'playing' || room.paused) throw new Error('遊戲尚未開始或已暫停');
  if (room.result) throw new Error('本局已結束');
  const task = player.task;
  if (!task || task.id !== submitted.taskId) throw new Error('題目已更新，請重新作答');
  const formula = safeStr(submitted.formula);
  const unit = safeStr(submitted.unit);
  const raw = safeStr(submitted.answer);
  const value = Number(raw);
  const now = Date.now();
  if (now - player.lastAnswerAt < 450) throw new Error('作答太頻繁，請稍後再試');
  player.lastAnswerAt = now;
  if (!raw || raw.length > 20 || !Number.isFinite(value)) throw new Error('請輸入有效數字');
  const isFormula = formula === task.formula;
  const isValue = Math.abs(value - task.answer) <= 0.015;
  const isUnit = unit === task.unit;
  player.answered++;
  if (!isFormula || !isValue || !isUnit) {
    const reason = !isFormula ? 'formula' : !isValue ? 'value' : 'unit';
    player.mistakes[reason]++;
    const hint = reason === 'formula' ? '公式選擇不正確，請檢查題意。' : reason === 'unit' ? '數字正確，但長度與面積的單位不同。' : '數值不正確，請檢查半徑、直徑與運算。';
    log(room, 'wrong', `${player.name} 在「${task.title}」嘗試作答`, { player: player.name, kind: task.kind, reason });
    return { correct: false, reason, message: hint, taskId: task.id };
  }
  player.correct++;
  const earned = player.hintUsed ? 8 : 12;
  player.stars += earned;
  const changes = {
    forest: { oxygen: 16, water: -3 },
    orbit: { energy: -4, stability: 8 },
    crater: { energy: -3, water: 7, stability: 10 }
  };
  adjustResources(room.resources, changes[task.kind]);
  room.completed[task.kind]++;
  const structure = {
    id: randomUUID(), kind: task.kind, owner: player.name, x: 12 + Math.random() * 76,
    y: 15 + Math.random() * 65, angle: Math.floor(Math.random() * 360), at: Date.now()
  };
  room.structures.push(structure);
  log(room, 'build', `${player.name} 完成「${task.title}」，星球新增${KIND_INFO[task.kind].title}！`, { player: player.name, kind: task.kind, answer: task.answer, unit: task.unit, steps: task.steps });
  player.task = makeTask(player.selectedKind, room.difficulty);
  player.hintUsed = false;
  const finished = checkWin(room);
  return { correct: true, message: '建造成功！', stars: earned, steps: task.steps, answer: task.answer, unit: task.unit, kind: task.kind, finished };
}

export function checkWin(room) {
  const count = room.structures.length;
  const diversified = TASK_KINDS.every(kind => room.completed[kind] > 0);
  if (room.phase === 'playing' && room.players.length > 0 && count >= room.requiredBuildings && diversified) {
    room.phase = 'finished'; room.paused = false; room.event = null;
    room.result = { win: true, title: '生命核心啟動成功！', description: '團隊完成三種工程，荒蕪星球已轉變為生態家園。' };
    log(room, 'victory', '🌍 全隊成功綠化星球，生命核心已啟動！');
    return true;
  }
  return false;
}

export function triggerEvent(room, selectedId) {
  if (room.phase !== 'playing' || room.paused || room.event) throw new Error('目前無法觸發新事件');
  const ids = Object.keys(EVENTS);
  const options = ids.filter(item => item !== room.lastEventId);
  const id = selectedId && ids.includes(selectedId) ? selectedId : choice(options.length ? options : ids);
  const event = EVENTS[id];
  room.eventIndex++; room.lastEventId = id;
  room.eventCountdown = 120;
  room.event = { id, secondsLeft: 90, startedAt: Date.now(), attempts: 0 };
  log(room, 'event', `${event.emoji} 宇宙事件：${event.name}！全隊一起解題！`);
  return id;
}

export function solveEvent(room, player, submitted) {
  if (room.phase !== 'playing' || room.paused || !room.event) throw new Error('事件已結束');
  const def = EVENTS[room.event.id];
  const raw = safeStr(submitted.answer);
  const value = Number(raw);
  if (!raw || raw.length > 20 || !Number.isFinite(value)) throw new Error('請填入正確的數字格式');
  const now = Date.now();
  if (now - player.lastAnswerAt < 450) throw new Error('作答太頻繁，請稍後再試');
  player.lastAnswerAt = now;
  const formula = safeStr(submitted.formula), unit = safeStr(submitted.unit);
  const correct = formula === def.formula && unit === def.unit && Math.abs(value - def.answer) <= .015;
  player.answered++;
  room.event.attempts++;
  if (!correct) {
    const reason = formula !== def.formula ? 'formula' : unit !== def.unit ? 'unit' : 'value';
    player.mistakes[reason]++;
    log(room, 'wrong', `${player.name} 挑戰「${def.name}」尚未成功`, { player: player.name, reason, event: def.name });
    return { correct: false, message: reason === 'unit' ? '單位不正確，請確認是公里還是平方公里。' : reason === 'formula' ? '先選對公式再計算。' : '答案尚未正確，全隊可以繼續嘗試。' };
  }
  player.correct++;
  player.stars += 15;
  adjustResources(room.resources, def.reward);
  room.event = null;
  log(room, 'success', `${player.name} 解決「${def.name}」，全隊獲得補給！`, { player: player.name, event: def.name, answer: def.answer, unit: def.unit, steps: def.steps });
  return { correct: true, message: `事件解除！${def.name} 挑戰成功`, stars: 15, steps: def.steps, answer: def.answer, unit: def.unit };
}

export function failEvent(room) {
  if (!room.event) return;
  const def = EVENTS[room.event.id];
  // 小組與單人模式受到相同的輕度影響，避免人數少時更難完成任務。
  adjustResources(room.resources, def.penalty);
  log(room, 'warning', `${def.name} 時間結束，資源略有損失；建築不會消失。`, { event: def.name });
  room.event = null;
}

export function finishRoom(room, reason = '老師已結束本局') {
  if (room.phase === 'finished') return;
  room.phase = 'finished'; room.event = null; room.paused = false;
  room.result = { win: false, title: '星球探索告一段落', description: reason };
  log(room, 'system', reason);
}

export function resetRoom(room) {
  room.phase = 'lobby'; room.paused = false; room.remainingSeconds = room.durationMinutes * 60;
  room.event = null; room.eventIndex = 0; room.lastEventId = null; room.eventCountdown = 110;
  room.structures = []; room.completed = { forest: 0, orbit: 0, crater: 0 };
  room.resources = { oxygen: 20, water: 20, energy: 24, stability: 80 };
  room.result = null; room.startingPlayers = 0; room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
  room.history = [];
  for (const p of room.players) {
    p.selectedKind = 'forest'; p.task = makeTask('forest', room.difficulty);
    p.answered = 0; p.correct = 0; p.hints = 0; p.stars = 0;
    p.lastAnswerAt = 0; p.hintUsed = false; p.mistakes = { formula: 0, value: 0, unit: 0 };
  }
  log(room, 'system', '老師已重設本局，準備下一場星球任務。');
}

export function tick(room) {
  if (room.phase !== 'playing' || room.paused) return false;
  room.remainingSeconds = Math.max(0, room.remainingSeconds - 1);
  if (room.event) {
    room.event.secondsLeft--;
    if (room.event.secondsLeft <= 0) failEvent(room);
  } else if (room.eventsEnabled) {
    room.eventCountdown--;
    if (room.eventCountdown <= 0) triggerEvent(room);
  }
  if (room.remainingSeconds <= 0) finishRoom(room, '任務時間已結束，可檢討各項數學建造紀錄。');
  return true;
}

export function publicState(room, token) {
  const isHost = token === room.hostToken;
  const me = isHost ? null : room.players.find(p => p.token === token);
  if (!isHost && !me) throw new Error('尚未取得房間權限');
  const total = room.structures.length;
  const diversified = TASK_KINDS.every(kind => room.completed[kind] > 0);
  const eventDefinition = room.event ? EVENTS[room.event.id] : null;
  const event = room.event ? { ...room.event, ...eventDefinition } : null;
  if (event && !isHost) { delete event.answer; delete event.steps; delete event.reward; delete event.penalty; }
  const students = room.players.map(p => ({
    id: p.id, name: p.name, connected: p.connected, correct: p.correct, answered: p.answered,
    stars: p.stars, selectedKind: p.selectedKind, hints: isHost ? p.hints : undefined,
    mistakes: isHost ? p.mistakes : undefined
  }));
  return {
    code: room.code, hostName: room.hostName, role: isHost ? 'host' : 'student',
    myId: me?.id ?? null, phase: room.phase, paused: room.paused,
    durationMinutes: room.durationMinutes, remainingSeconds: room.remainingSeconds,
    difficulty: room.difficulty, eventsEnabled: room.eventsEnabled,
    players: students, maxPlayers: MAX_PLAYERS, startingPlayers: room.startingPlayers,
    requiredBuildings: room.requiredBuildings, resources: room.resources,
    completed: room.completed, structures: room.structures, buildingsTotal: total,
    allKindsComplete: diversified, progress: Math.min(100, Math.round(total / room.requiredBuildings * 100)),
    event, eventCountdown: room.eventCountdown, result: room.result,
    history: room.history.slice(0, isHost ? 100 : 14),
    ownTask: me?.task ? { ...me.task, answer: undefined, steps: undefined } : null,
    ownHints: me?.hints ?? 0,
    teacherNote: '數學規則：π = 3.14；長度 km，面積 km²；數值允許四捨五入的小誤差。'
  };
}
