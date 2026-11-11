import { randomBytes, randomUUID } from 'node:crypto';
import { makeVariedTask } from './tasks-v3.js';
import { makeEventTask } from './event-tasks.js';
import { STAGES, stageInfo, mathStageGoals, modeGoalList, modeProgress, lifeIndex, HAZARD_INFO } from './modes-v2.js';
import { makeReviewQuestions, reviewPublicQuestions, gradeReview } from './review.js';
import { makeAdventure, techBuildBonus, publicAdventure } from './adventure.js';
import { TEAM_GAMES, startTeamGame, playTeamGame, publicTeamGame, tickTeamGame } from './team-games.js';

export const MAX_PLAYERS = 5;
export const PI = 3.14;
export const TASK_KINDS = ['forest', 'orbit', 'crater', 'power'];
export const FORMULAS = [
  { id: 'area', text: 'π × 半徑 × 半徑' },
  { id: 'circumference', text: '2 × π × 半徑（或 π × 直徑）' },
  { id: 'ring', text: '大圓面積 − 小圓面積' },
  { id: 'reverseArea', text: '圓面積 ÷ π = 半徑 × 半徑' },
  { id: 'reverseCirc', text: '圓周長 ÷ (2 × π) = 半徑' }
];
export const KIND_INFO = {
  forest: { title: '生態造林', emoji: '🌳', color: '#3fe5aa', resource: '氧氣' },
  orbit: { title: '星環防衛', emoji: '🛰️', color: '#8faeff', resource: '防禦' },
  crater: { title: '地形修復', emoji: '🛠️', color: '#ffc36d', resource: '穩定度' },
  power: { title: '能源建設', emoji: '⚡', color: '#ffe18a', resource: '能源' }
};
const choice = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = n => String(round2(n));
const safeStr = v => String(v ?? '').trim();

export function cleanName(name) {
  return safeStr(name).replace(/[<>\\]/g, '').replace(/\s+/g, ' ').slice(0, 16);
}

export function goalForCount(n, durationMinutes = 40) {
  // V1.5：數學只是四大玩法之一；降低答題數，改由探索、接水管和科技研究共同通關。
  const perPlayer = durationMinutes >= 40 ? 4 : durationMinutes >= 25 ? 3 : 2;
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

export function makeTask(kind = 'forest', difficulty = 'standard', rng = Math.random, excludeVariant = null, recentQuestions = []) {
  // 題型之外也比對完整題幹，避免同一玩家短時間內反覆遇到相同題目。
  let task=null;
  for(let attempt=0;attempt<28;attempt++){
    task=makeVariedTask(kind,difficulty,rng,excludeVariant);
    const fingerprint=kind+':'+task.question;
    if(!recentQuestions.includes(fingerprint))break;
  }
  recentQuestions.push(kind+':'+task.question);
  if(recentQuestions.length>32)recentQuestions.splice(0,recentQuestions.length-32);
  return task;
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

// 事件發生當下就對星球產生可見、可計算的衝擊；失敗後會留下待修復異常。
const IMPACTS = { meteor: { stability: -12 }, flare: { energy: -14 }, rain: { water: 10, stability: -7 }, alien: { energy: -9 } };
for (const [id, event] of Object.entries(EVENTS)) {
  event.impact = IMPACTS[id];
  event.repairKind = HAZARD_INFO[id].repairKind;
  event.description += ` 即時影響：${Object.entries(IMPACTS[id]).map(([k,v]) => `${({stability:'穩定度',energy:'能源',water:'水資源'})[k]} ${v > 0 ? '+' : ''}${v}`).join('，')}。未解除會留下持續異常。`;
}

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
    eventsEnabled: false, difficulty: 'standard', stage: 1, stageChallengesResolved: 0, stageHistory: [], players: [], history: [], structures: [],
    hazards: [], eventsWon: 0, tickCount: 0, lastEventVariants: {},
    event: null, eventIndex: 0, lastEventId: null, eventCountdown: 110, startingPlayers: 0,
    requiredBuildings: 4, resources: { oxygen: 20, water: 30, energy: 25, stability: 70 },
    completed: { forest: 0, orbit: 0, crater: 0, power: 0 }, adventure:makeAdventure(), teamGame:null, teamGamesCompleted:{1:0,2:0,3:0}, result: null
  };
}

export function addPlayer(room, nickname) {
  const name = cleanName(nickname);
  if (!name) throw new Error('請輸入 1～16 個字的暱稱');
  if (room.players.length >= MAX_PLAYERS) throw new Error('房間已滿（最多 5 位學生）');
  if (room.players.some(p => p.name === name)) throw new Error('這個暱稱已有人使用');
  const player = {
    id: randomUUID(), token: randomUUID() + randomUUID(), name, connected: true,
    joinedAt: Date.now(), selectedKind: 'forest', task: makeTask('forest', room.difficulty), lastVariants: {}, recentQuestions: [], reviewQuestions: null, review: null,
    answered: 0, correct: 0, hints: 0, mistakes: { formula: 0, value: 0, unit: 0 },
    lastAnswerAt: 0, hintUsed: false, stars: 0
  };
  if (room.phase==='finished') player.reviewQuestions=makeReviewQuestions();
  room.players.push(player);
  return player;
}

export function startRoom(room) {
  if (room.phase !== 'lobby') throw new Error('目前無法開始');
  if (!room.players.length) throw new Error('至少需要 1 位學生才能開始');
  room.phase = 'playing'; room.paused = false; room.pausedAt=null;
  room.stage = 1; room.stageChallengesResolved = 0; room.stageHistory=[];room.adventure=makeAdventure();room.teamGame=null;room.teamGamesCompleted={1:0,2:0,3:0};
  room.startingPlayers = room.players.length;
  room.requiredBuildings = goalForCount(room.startingPlayers, room.durationMinutes);
  room.remainingSeconds = room.durationMinutes * 60;
  room.eventCountdown = 110;
  for (const player of room.players) {
    player.recentQuestions=[]; player.reviewQuestions=null; player.review=null;
    player.task = makeTask(player.selectedKind, room.difficulty, Math.random, player.lastVariants[player.selectedKind], player.recentQuestions);
    player.lastVariants[player.selectedKind] = player.task.variant;
  }
  log(room, 'system', `任務啟動：先完成一段數學建設，再由全隊合作完成不同類型小遊戲；三關各有兩種操作遊戲，最終累計 ${room.requiredBuildings} 項工程。`);
}

export function log(room, type, message, extra = {}) {
  room.history.unshift({ id: randomUUID(), at: Date.now(), type, message, ...extra });
  if (room.history.length > 120) room.history.length = 120;
}


function diagnoseMistake(task, reason, value) {
  if(reason==='unit') return task.unit==='km²'
    ? '數值已經正確！題目問「面積」，請選平方公里 km²；公里 km 是長度的單位。'
    : '數值已經正確！題目問「半徑、直徑或路程」，請選公里 km，不是平方公里。';
  if(reason==='formula'){
    const explain={
      ring:'這題需要比較兩個圓形區域（或圓環），先釐清要扣除哪個圓。',
      area:'這題要計算圓形區域的面積，半徑需要乘自己；注意題目有沒有多個區域。',
      circumference:'這題問一圈的長度或環線路程，不是面積；若有多圈還須再乘圈數。',
      reverseArea:'這題已知面積，要先以面積除以 3.14，得到半徑平方，再找出半徑。',
      reverseCirc:'這題已知周長，要用周長反推半徑；如果問直徑，記得再乘 2。'
    };
    return '公式選擇不符合題意。'+(explain[task.formula]||'先判斷題目要算長度還是面積。');
  }
  if((task.formula==='area'||task.formula==='ring') && Math.abs(value*4-task.answer)<.05)
    return '你的結果大約只有正確面積的四分之一；可能把直徑當半徑，或忘記半徑變化造成面積平方變化。';
  if(task.formula==='circumference' && Math.abs(value*2-task.answer)<.05)
    return '結果約少了一半，可能把半徑直接當直徑，少乘了一個 2。';
  if(task.formula==='reverseArea')
    return '反推面積時，先用面積 ÷ 3.14 找出半徑平方，再找哪個數字乘自己會得到它；留意題目問半徑或直徑。';
  if(task.variant && /ring|crater|inner|road|width|lake|damaged|repair/i.test(task.variant))
    return '這題有內外兩個圓，請確認大圓減小圓；不能把半徑先相減再平方。'+(task.hint||'');
  if(task.variant && /diameter/i.test(task.variant))
    return '請重新檢查直徑和半徑：直徑是半徑的 2 倍。'+(task.hint||'');
  return '公式與單位正確，但數值仍不對。'+(task.hint||'請檢查半徑、直徑與計算步驟。');
}

export function buildResult(room, player, submitted) {
  if (room.phase !== 'playing' || room.paused) throw new Error('遊戲尚未開始或已暫停');
  if (room.result) throw new Error('本局已結束');
  if (room.teamGame) throw new Error('現在是全隊合作小遊戲時間，完成後才能繼續數學建造');
  const task = player.task;
  if (!task || task.id !== submitted.taskId) throw new Error('題目已更新，請重新作答');
  const quiz = task.type === 'choice' || task.type === 'trueFalse';
  const raw = safeStr(submitted.answer);
  const now = Date.now();
  if (now - player.lastAnswerAt < 450) throw new Error('作答太頻繁，請稍後再試');
  if (quiz) {
    if (!task.choices?.some(x => x.value === raw)) return {correct:false, reason:'missingChoice', message:'請先選擇一個選項，再送出答案。', taskId:task.id};
    player.lastAnswerAt = now;
    player.answered++;
    if (raw !== String(task.answer)) {
      player.mistakes.value++;
      const estimation=task.context?.startsWith('估算任務');
      log(room, 'wrong', `${player.name} 在「${task.title}」${estimation?'估算選項':'觀念判斷'}尚未正確`, {player:player.name,kind:task.kind,reason:estimation?'estimate':'concept'});
      return {correct:false,reason:estimation?'estimate':'concept',message:(estimation?'估算可以不用精算：':'觀念再檢查一下：')+task.hint,taskId:task.id};
    }
  } else {
    const formula = safeStr(submitted.formula);
    const unit = safeStr(submitted.unit);
    const value = Number(raw);
    if (!raw || raw.length > 20 || !Number.isFinite(value)) throw new Error('請輸入有效數字');
    if (!unit) return {correct:false,reason:'missingUnit',message:'請先選擇單位：長度使用 km，面積使用 km²。這不是計算錯誤，選好單位後再提交。',taskId:task.id};
    player.lastAnswerAt = now;
    const isFormula = formula === task.formula;
    const isValue = Math.abs(value - task.answer) <= .015;
    const isUnit = unit === task.unit;
    player.answered++;
    if (!isFormula || !isValue || !isUnit) {
      const reason = !isFormula ? 'formula' : !isValue ? 'value' : 'unit';
      player.mistakes[reason]++;
      const hint = diagnoseMistake(task,reason,value);
      log(room, 'wrong', `${player.name} 在「${task.title}」嘗試作答`, {player:player.name,kind:task.kind,reason});
      return {correct:false,reason,message:hint,taskId:task.id};
    }
  }
  player.correct++;
  const earned = player.hintUsed ? 8 : 12;
  player.stars += earned;
  const changes = {
    forest: { oxygen: 8, water: -3 },
    orbit: { energy: 5, stability: 4 },
    crater: { energy: -2, water: 7, stability: 6 },
    power: { energy: 14, water: -1, stability: 2 }
  };
  adjustResources(room.resources, changes[task.kind]);
  adjustResources(room.resources,techBuildBonus(room,task.kind));
  // 異常會持續削減資源，直到對應工程被完成；即使事件倒數已結束仍有效。
  for (const hazard of room.hazards) {
    const effect = HAZARD_INFO[hazard.id];
    adjustResources(room.resources, { [effect.effectKey]: -effect.loss });
  }
  const repaired = room.hazards.filter(h => h.status === 'lingering' && HAZARD_INFO[h.id].repairKind === task.kind);
  for (const hazard of repaired) {
    adjustResources(room.resources, HAZARD_INFO[hazard.id].repairBonus);
    log(room, 'success', `${player.name} 的工程修復了「${hazard.name}」留下的異常。`);
    if (room.stage===3) room.stageChallengesResolved++;
  }
  room.hazards = room.hazards.filter(h => !repaired.includes(h));
  room.completed[task.kind]++;
  const structure = {
    id: randomUUID(), kind: task.kind, owner: player.name, x: 12 + Math.random() * 76,
    y: 15 + Math.random() * 65, angle: Math.floor(Math.random() * 360), at: Date.now()
  };
  room.structures.push(structure);
  log(room, 'build', `${player.name} 完成「${task.title}」，星球新增${KIND_INFO[task.kind].title}！`, { player: player.name, kind: task.kind, answer: task.answer, unit: task.unit, steps: task.steps });
  player.task = makeTask(player.selectedKind, room.difficulty, Math.random, task.variant, player.recentQuestions);
  player.hintUsed = false;
  const finished = checkWin(room);
  return { correct: true, message: '建造成功！', stars: earned, steps: task.steps, answer: task.answer, unit: task.unit, kind: task.kind, finished };
}

function prepareReviews(room) {
  for(const player of room.players) if(!player.reviewQuestions) player.reviewQuestions=makeReviewQuestions();
}
export function submitReview(room,player,body) {
  if(room.phase!=='finished')throw new Error('本局結束後才能提交課後回顧');
  if(player.review)throw new Error('你已提交本局回顧');
  player.reviewQuestions ||= makeReviewQuestions();
  player.review=gradeReview(player.reviewQuestions,body.answers,body.reflection,body.confidence);
  log(room,'review',`${player.name} 已完成課後數學回顧（${player.review.correct}/${player.review.total}）`,{player:player.name});
  return {correct:player.review.correct,total:player.review.total};
}
export function completeTeamGame(room,player,body) {
 const result=playTeamGame(room,player,body);
 if(!result.completed)return result;
 if(!room.teamGame)throw new Error('合作小遊戲已結束');
 const previous=room.teamGame;
 room.teamGame=null;
 room.teamGamesCompleted[room.stage]=(room.teamGamesCompleted[room.stage]||0)+1;
 adjustResources(room.resources,result.reward);
 log(room,'team',player.name+' 協助全隊完成「'+previous.title+'」！', {player:player.name,game:previous.kind});
 checkWin(room);
 return result;
}
export function skipTeamGame(room) {
 if(!room.teamGame)throw new Error('目前沒有需要略過的合作遊戲');
 const game=room.teamGame;
 room.teamGame=null;
 room.teamGamesCompleted[room.stage]=(room.teamGamesCompleted[room.stage]||0)+1;
 log(room,'system','教師略過合作遊戲「'+game.title+'」，不額外發放完成獎勵。');
 checkWin(room);
 return {message:'已略過 '+game.title};
}
export function checkWin(room) {
 if(room.phase!=='playing'||!room.players.length||room.event||room.paused)return false;
 if(room.teamGame)return false;
 if(!mathStageGoals(room).every(g=>g.met))return false;
 if((room.teamGamesCompleted[room.stage]||0)<TEAM_GAMES[room.stage].length){
   const g=startTeamGame(room);
   log(room,'team','🎮 進入全隊合作小遊戲 '+g.index+'/'+g.total+'：「'+g.title+'」。請輪流操作、討論。');
   return false;
 }
 if(room.stage<3){
   const prior=stageInfo(room);
   room.stageHistory.push({stage:room.stage,title:prior.title,finishedAt:Date.now()});
   room.stage++;
   const next=stageInfo(room);
   log(room,'stage','🎉 完成「'+prior.title+'」的數學建造與兩個合作小遊戲，進入第 '+room.stage+' 關「'+next.title+'」！');
   if(room.stage===2){
     adjustResources(room.resources,{water:-8});
     log(room,'warning','💧 新關卡危機：乾旱讓水資源減少 8，需要完成地形工程並合作修復水管。');
   }
   if(room.stage===3){
     log(room,'warning','🛡️ 最終關卡：完成數學建造後，大家要合作攔截隕石及修復星圖。');
   }
   return false;
 }
 room.phase='finished';room.paused=false;room.teamGame=null;
 room.result={win:true,title:'生命核心啟動成功！',description:'全隊依序完成三段數學建設與六款合作小遊戲，星球恢復生機。請完成課後數學回顧。'};
 room.stageHistory.push({stage:3,title:stageInfo(room).title,finishedAt:Date.now()});
 prepareReviews(room);
 log(room,'victory','🌍 全隊完成三關數學與六款合作挑戰，進入課後數學回顧！');
 return true;
}

export function triggerEvent(room, selectedId) {
  if (room.phase !== 'playing' || room.paused || room.event || room.teamGame) throw new Error('目前無法觸發新事件');
  const ids = Object.keys(EVENTS);
  const options = ids.filter(item => item !== room.lastEventId);
  const id = selectedId && ids.includes(selectedId) ? selectedId : choice(options.length ? options : ids);
  const event = EVENTS[id];
  room.eventIndex++; room.lastEventId = id;
  const task = makeEventTask(id,Math.random,room.lastEventVariants[id]);
  room.lastEventVariants[id] = task.variant;
  room.eventCountdown = 120;
  const hazardId = randomUUID();
  adjustResources(room.resources, event.impact);
  room.hazards.push({ key: hazardId, id, name: event.name, emoji: event.emoji, status: 'active', ...HAZARD_INFO[id] });
  room.event = { id, hazardId, task, secondsLeft: 90, startedAt: Date.now(), attempts: 0 };
  log(room, 'event', `${event.emoji} 宇宙事件：${event.name}！星球已遭受衝擊，請立即解題！`);
  return id;
}

export function solveEvent(room, player, submitted) {
  if (room.phase !== 'playing' || room.paused || !room.event) throw new Error('事件已結束');
  const def = EVENTS[room.event.id];
  const task = room.event.task;
  const raw = safeStr(submitted.answer);
  const value = Number(raw);
  if (!raw || raw.length > 20 || !Number.isFinite(value)) throw new Error('請填入正確的數字格式');
  const now = Date.now();
  if (now - player.lastAnswerAt < 450) throw new Error('作答太頻繁，請稍後再試');
  const formula = safeStr(submitted.formula), unit = safeStr(submitted.unit);
  if (!unit) return { correct:false,reason:'missingUnit',message:'請先選擇單位（km 或 km²），這不是計算錯誤。' };
  player.lastAnswerAt = now;
  const correct = formula === task.formula && unit === task.unit && Math.abs(value - task.answer) <= .015;
  player.answered++;
  room.event.attempts++;
  if (!correct) {
    const reason = formula !== task.formula ? 'formula' : unit !== task.unit ? 'unit' : 'value';
    player.mistakes[reason]++;
    log(room, 'wrong', `${player.name} 挑戰「${def.name}」尚未成功`, { player: player.name, reason, event: def.name });
    return { correct: false, reason, message: diagnoseMistake(task,reason,value) };
  }
  player.correct++;
  player.stars += 15;
  adjustResources(room.resources, def.reward);
  room.hazards = room.hazards.filter(h => h.key !== room.event.hazardId);
  room.eventsWon++;
  if(room.stage===3)room.stageChallengesResolved++;
  room.event = null;
  checkWin(room);
  log(room, 'success', `${player.name} 解決「${def.name}」，全隊獲得補給！`, { player: player.name, event: def.name, answer: task.answer, unit: task.unit, steps: task.steps });
  return { correct: true, message: `事件解除！${def.name} 挑戰成功`, stars: 15, steps: task.steps, answer: task.answer, unit: task.unit };
}

export function failEvent(room) {
  if (!room.event) return;
  const def = EVENTS[room.event.id];
  // 小組與單人模式受到相同的輕度影響，避免人數少時更難完成任務。
  adjustResources(room.resources, def.penalty);
  const hazard = room.hazards.find(h => h.key === room.event.hazardId);
  if (hazard) hazard.status = 'lingering';
  log(room, 'warning', `${def.name} 未解除，星球留下異常！完成${KIND_INFO[def.repairKind].title}可修復。`, { event: def.name });
  room.event = null;
}

export function finishRoom(room, reason = '老師已結束本局') {
  if (room.phase === 'finished') return;
  room.phase = 'finished'; room.event = null; room.teamGame=null; room.paused = false;
  room.result = { win: false, title: '星球探索告一段落', description: reason+' 現在可以完成課後數學回顧。' };
  prepareReviews(room);
  log(room, 'system', reason);
}

export function resetRoom(room) {
  room.phase = 'lobby'; room.paused = false; room.pausedAt=null; room.remainingSeconds = room.durationMinutes * 60;
  room.event = null; room.teamGame=null; room.teamGamesCompleted={1:0,2:0,3:0}; room.eventIndex = 0; room.lastEventId = null; room.eventCountdown = 110;
  room.hazards = []; room.eventsWon = 0; room.tickCount = 0; room.lastEventVariants = {}; room.stage=1; room.stageHistory=[];room.stageChallengesResolved=0;
  room.structures = []; room.completed = { forest: 0, orbit: 0, crater: 0, power: 0 }; room.adventure=makeAdventure();
  room.resources = { oxygen: 20, water: 30, energy: 25, stability: 70 };
  room.result = null; room.startingPlayers = 0; room.requiredBuildings = goalForCount(room.players.length, room.durationMinutes);
  room.history = [];
  for (const p of room.players) {
    p.selectedKind = 'forest'; p.recentQuestions=[]; p.task = makeTask('forest', room.difficulty, Math.random, null, p.recentQuestions); p.lastVariants = {};p.reviewQuestions=null;p.review=null; 
    p.answered = 0; p.correct = 0; p.hints = 0; p.stars = 0;
    p.lastAnswerAt = 0; p.hintUsed = false; p.mistakes = { formula: 0, value: 0, unit: 0 };
  }
  log(room, 'system', '老師已重設本局，準備下一場星球任務。');
}

export function tick(room) {
  if (room.phase !== 'playing' || room.paused) return false;
  room.remainingSeconds = Math.max(0, room.remainingSeconds - 1);
  room.tickCount++;
  if (room.stage === 3 && room.tickCount % 45 === 0) {
    adjustResources(room.resources, { water: -1, energy: -1 });
    log(room, 'warning', '文明守護：維生系統每 45 秒消耗 1 水資源與 1 能源。');
  }
  tickTeamGame(room);
  if (room.event) {
    room.event.secondsLeft--;
    if (room.event.secondsLeft <= 0) failEvent(room);
  } else if (room.eventsEnabled && !room.teamGame) {
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
  const event = room.event ? { ...eventDefinition, ...room.event, ...room.event.task, id: room.event.id } : null;
  if (event) { delete event.answer; delete event.steps; delete event.task; } // 教師必須主動按「顯示答案」，預設分享畫面不洩漏。
  const students = room.players.map(p => ({
    id: p.id, name: p.name, connected: p.connected, correct: p.correct, answered: p.answered,
    stars: p.stars, selectedKind: p.selectedKind, hints: isHost ? p.hints : undefined,
    reviewSubmitted:!!p.review,reviewScore:isHost&&p.review? p.review.correct:undefined,
    reviewReflection:isHost&&p.review?p.review.reflection:undefined,reviewConfidence:isHost&&p.review?p.review.confidence:undefined,
    mistakes: isHost ? p.mistakes : undefined,
    task: isHost && p.task ? { id: p.task.id, title: p.task.title, question: p.task.question, variant: p.task.variant, kind: p.task.kind, choices: p.task.choices?.map(c=>({value:c.value,label:c.label})) } : undefined
  }));
  return {
    code: room.code, hostName: room.hostName, role: isHost ? 'host' : 'student',
    myId: me?.id ?? null, phase: room.phase, paused: room.paused, pausedAt:room.pausedAt||null,
    durationMinutes: room.durationMinutes, remainingSeconds: room.remainingSeconds,
    difficulty: room.difficulty, eventsEnabled: room.eventsEnabled, stage:room.stage,
    stageCount:STAGES.length,stageInfo:stageInfo(room),stageHistory:room.stageHistory,
    stages:STAGES.map(({id,title,emoji,subtitle})=>({id,title,emoji,subtitle})),
    goals: modeGoalList(room), eventsWon: room.eventsWon,stageChallengesResolved:room.stageChallengesResolved,
    hazards: room.hazards.map(h => ({ id:h.id, name:h.name, emoji:h.emoji, notice:h.notice, status:h.status, repairKind:h.repairKind })),
    players: students, maxPlayers: MAX_PLAYERS, startingPlayers: room.startingPlayers,
    requiredBuildings: room.requiredBuildings, resources: room.resources,
    completed: room.completed, structures: room.structures, buildingsTotal: total,
    adventure:publicAdventure(room),
    teamGame:publicTeamGame(room,me),teamGamesCompleted:room.teamGamesCompleted,
    allKindsComplete: diversified, progress: modeProgress(room), lifeIndex: lifeIndex(room),
    event, eventCountdown: room.eventCountdown, result: room.result,
    history: room.history.slice(0, isHost ? 100 : 14),
    ownTask: me?.task ? { ...me.task, answer: undefined, steps: undefined } : null,
    ownHints: me?.hints ?? 0,
    ownReview:me && room.phase==='finished'?{questions:reviewPublicQuestions(me.reviewQuestions||[]),submitted:!!me.review,result:me.review||null}:null,
    teacherNote: '數學估算：π 約等於 3，從四個答案中選出最接近的值；觀念／是非題直接判斷。'
  };
}
