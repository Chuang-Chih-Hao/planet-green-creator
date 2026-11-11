import { createScratchpad } from './scratchpad.js';
import { teamGameHTML,updateTeamClocks,animatePulseCursor } from './team-ui.js';
const root = document.getElementById('app');
const toastRoot = document.getElementById('toast-root');
const SESSION_KEY = 'planet-green-creator-session-v1';
const FORMULAS = [
  ['area', 'π × 半徑 × 半徑'],
  ['circumference', '2 × π × 半徑（或 π × 直徑）'],
  ['ring', '大圓面積 − 小圓面積'],
  ['reverseArea', '圓面積 ÷ π = 半徑 × 半徑'],
  ['reverseCirc', '圓周長 ÷ (2 × π) = 半徑']
];
const KINDS = {
  forest: { name: '森林', emoji: '🌳', tag: '生態工程', color: 'var(--mint)' },
  orbit: { name: '星環', emoji: '🛰️', tag: '軌道防衛', color: 'var(--blue)' },
  crater: { name: '修復', emoji: '🛠️', tag: '地形工程', color: 'var(--amber)' },
  power: { name: '能源', emoji: '⚡', tag: '太陽能工程', color: 'var(--amber)' }
};
const EVENT_NAMES = { meteor: '☄️ 隕石', flare: '☀️ 風暴', rain: '🌧️ 生命雨', alien: '🛸 外星船' };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const formatTime = n => `${String(Math.floor(Math.max(0, n ?? 0) / 60)).padStart(2, '0')}:${String(Math.max(0, n ?? 0) % 60).padStart(2, '0')}`;
const $ = selector => document.querySelector(selector);
let savedSession = null;
try { savedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { /* ignore */ }
let state = null;
let stream = null;
let joinMode = 'create';
let feedback = null;
let eventFeedback = null;
let hintText = '';
let loading = false;
let connectionLive = false;
const drafts = new Map();
const teacherReveals = new Map(); // 教師按按鈕才載入，永不放進 SSE 共用狀態。
let currentTaskId = null;
let currentEventId = null;
let workTab='build';
const reviewDraft = {};
const scratchpad = createScratchpad(() => state);

function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast ${error ? 'error' : ''}`;
  node.textContent = message;
  toastRoot.append(node);
  setTimeout(() => node.remove(), 4200);
}

async function post(endpoint, body) {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('伺服器沒有回應，請檢查網路連線'); }
  if (!response.ok) throw new Error(payload.error || '操作失敗');
  return payload;
}

function applyState(next) {
  if (!next) return;
  if (state?.ownTask?.id !== next.ownTask?.id) {
    if (currentTaskId && next.ownTask?.id !== currentTaskId) hintText = '';
    currentTaskId = next.ownTask?.id;
  }
  if (state?.event?.startedAt !== next.event?.startedAt || state?.event?.id !== next.event?.id) {
    eventFeedback = null;
    currentEventId = next.event?.id ?? null;
  }
  if(state?.stage && next.stage>state.stage) toast(`🎉 通過第 ${state.stage} 關！進入「${next.stageInfo?.title||'新關卡'}」`);
  if(state?.teamGame?.id!==next.teamGame?.id&&next.teamGame)toast('🎮 合作挑戰開始：'+next.teamGame.title);
  if(state?.phase==='finished'&&next.phase==='lobby') for(const key of Object.keys(reviewDraft))delete reviewDraft[key];
  state = next;
  document.title = `${next.code} · 星球綠化造物主`;
  render();
  scratchpad.refresh();
}

function attachStream() {
  if (!savedSession?.token) return;
  if (stream) stream.close();
  connectionLive = false;
  stream = new EventSource(`/api/stream?token=${encodeURIComponent(savedSession.token)}`);
  stream.addEventListener('open', () => { connectionLive = true; updateLive(); });
  stream.addEventListener('state', event => {
    try { applyState(JSON.parse(event.data)); } catch (error) { console.error(error); }
  });
  stream.addEventListener('clock', event => {
    if (!state) return;
    const clock = JSON.parse(event.data);
    state.remainingSeconds = clock.remainingSeconds;
    state.eventCountdown = clock.eventCountdown;
    if (state.event && clock.eventSecondsLeft !== null) state.event.secondsLeft = clock.eventSecondsLeft;
    updateClocks();
  });
  stream.addEventListener('kicked', event => {
    let text = '你已離開房間';
    try { text = JSON.parse(event.data).message; } catch { /* ignore */ }
    logout(); toast(text, true);
  });
  stream.addEventListener('error', () => { connectionLive = false; updateLive(); });
}
function updateClocks() {
  if (!state) return;
  for (const node of document.querySelectorAll('[data-clock]')) node.textContent = formatTime(state.remainingSeconds);
  for (const node of document.querySelectorAll('[data-event-seconds]')) node.textContent = `${state.event?.secondsLeft ?? 0}s`;
  for (const node of document.querySelectorAll('[data-event-countdown]')) node.textContent = formatTime(state.eventCountdown);
  for (const node of document.querySelectorAll('[data-adventure-timer]')) { const due=(node.dataset.adventureTimer==='scan'?state.adventure?.nextScanAt:state.adventure?.nextPipeAt)||0;const sec=Math.max(0,Math.ceil((due-Date.now())/1000));node.textContent=sec?sec+' 秒':'準備就緒'; }
  for (const node of document.querySelectorAll('[data-explore-index]')) node.disabled=state.paused||state.phase!=='playing'||Date.now()<(state.adventure?.nextScanAt||0)||Boolean(state.adventure?.decision)||Boolean(state.adventure?.sectors?.[Number(node.dataset.exploreIndex)]?.revealed);
  for (const node of document.querySelectorAll('[data-pipe-index]')) node.disabled=state.paused||state.phase!=='playing'||Date.now()<(state.adventure?.nextPipeAt||0);
  updateTeamClocks(state);
}
function updateLive() {
  for (const node of document.querySelectorAll('[data-connection]')) {
    node.innerHTML = `<span class="online-dot ${connectionLive ? '' : 'off'}"></span> ${connectionLive ? '連線正常' : '重新連線中'}`;
  }
}

async function auth(mode, form) {
  if (loading) return;
  loading = true;
  const name = form.querySelector('[name=name]').value.trim();
  const code = form.querySelector('[name=code]')?.value?.trim() || '';
  try {
    const response = await post(mode === 'create' ? 'create' : 'join', { name, code });
    savedSession = { token: response.token, code: response.state.code, role: response.state.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(savedSession));
    feedback = null; eventFeedback = null; hintText = '';
    applyState(response.state);
    attachStream();
    toast(mode === 'create' ? '房間建立成功！請分享房間代碼。' : '已成功登陸星球！');
  } catch (error) { toast(error.message, true); }
  finally { loading = false; }
}
async function resume() {
  if (!savedSession?.token) return render();
  try {
    const response = await fetch(`/api/state?token=${encodeURIComponent(savedSession.token)}`);
    if (!response.ok) throw new Error('session expired');
    applyState((await response.json()).state);
    attachStream();
  } catch { logout(false); }
}
function logout(renderNow = true) {
  if (stream) stream.close();
  stream = null;
  savedSession = null;
  state = null;
  feedback = null;
  eventFeedback = null;
  hintText = '';
  for(const key of Object.keys(reviewDraft))delete reviewDraft[key];
  localStorage.removeItem(SESSION_KEY);
  document.title = '星球綠化造物主｜小六數學多人協作遊戲';
  if (renderNow) render();
}
async function action(name, extra = {}) {
  if (loading || !savedSession) return;
  loading = true;
  try {
    const response = await post('action', { token: savedSession.token, action: name, ...extra });
    if (name === 'revealReview') {teacherReveals.set('review:'+extra.playerId,response.feedback);render();return;}
    if (name === 'revealAnswer') {
      teacherReveals.set(extra.scope === 'event' ? `event:${state?.event?.startedAt}` : extra.taskId, response.feedback);
      render();
      return;
    }
    if (name === 'submitReview') toast('📘 回顧已提交，可查看每題計算說明。');
    if (name === 'answer' || name === 'hint') {
      if (name === 'hint') hintText = response.feedback?.hint || '';
      else feedback = response.feedback;
    }
    if (name === 'eventAnswer') eventFeedback = response.feedback;
    if (name === 'selectTask' || name === 'reset' || name === 'start') {
      feedback = null; eventFeedback = null; hintText = '';
      if (name === 'reset') {teacherReveals.clear();workTab='build';}
    }
    applyState(response.state);
    if (name === 'answer' && response.feedback?.correct) toast('✨ 建造完成，星球又成長了！');
    else if (name === 'eventAnswer' && response.feedback?.correct) toast('🎉 宇宙事件解除！全隊獲得獎勵');
    else if (name === 'answer' && response.feedback && !response.feedback.correct) toast('答案未通過，可再試一次', true);
    else if(['teamMove','skipTeamGame'].includes(name)&&response.feedback?.message)toast(response.feedback.message);
  } catch (error) { toast(error.message, true); }
  finally { loading = false; }
}

function renderWelcome() {
  return `<div class="container welcome">
    <header class="site-header"><div class="brand"><span class="brand-icon">🌍</span><span><div class="brand-title">星球綠化造物主</div><div class="brand-sub">PLANET MAKER · MATH LAB</div></span></div><span class="small-pill"><span class="online-dot"></span> 小六圓周長 × 圓面積</span></header>
    <section class="welcome-grid">
      <div class="hero-content">
        <span class="hero-kicker">✦ 五人以內的合作養成冒險</span>
        <h1>用數學，<br />讓一顆星球<br /><em>重新長出生命。</em></h1>
        <p class="welcome-lead">先以數學幫星球建設，接著與隊友依序玩記憶接力、光能校準、合作接水管、救援車導航、隕石攔截及星圖拼圖。每一段完成後才會進入下一關。</p>
        <div class="hero-highlights"><span>👥 1–5 人自動平衡</span><span>📐 圓周長 × 圓面積</span><span>🎮 六種合作操作小遊戲</span><span>🎓 教師專屬控制台</span></div>
        <div class="welcome-planet-wrap">${planetWorld([], 2)}</div>
      </div>
      <div class="welcome-card card">
        <div class="eyebrow">MISSION CONTROL</div>
        <h2 style="margin-top:8px">準備登陸星球？</h2>
        <p>老師建立房間，學生輸入房間代碼即可加入。無需註冊帳號。</p>
        <div class="tab-row" role="tablist" aria-label="加入模式"><button class="tab ${joinMode === 'create' ? 'active' : ''}" data-tab="create" type="button">👩‍🏫 我是房主</button><button class="tab ${joinMode === 'join' ? 'active' : ''}" data-tab="join" type="button">🚀 我是學生</button></div>
        <form id="auth-form" data-auth="${joinMode}">
          <div class="field"><label for="nickname">${joinMode === 'create' ? '房主顯示名稱' : '你的探險家暱稱'}</label><input required maxlength="16" class="text-input" id="nickname" name="name" placeholder="${joinMode === 'create' ? '例如：數學老師' : '例如：星球工程師小明'}" autocomplete="nickname" /></div>
          ${joinMode === 'join' ? '<div class="field"><label for="room-code-input">6 碼房間代碼</label><input required minlength="6" maxlength="6" class="text-input" id="room-code-input" name="code" placeholder="例如：K8P4YQ" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.17em" /></div>' : ''}
          <button class="btn full" type="submit" style="margin-top:12px">${joinMode === 'create' ? '✦ 建立我的星球房間' : '🚀 登陸並加入團隊'}</button>
        </form>
        <div class="example">${joinMode === 'create' ? '建立成功會顯示房間代碼。可先邀請 1～5 位學生，再按「開始任務」。房主不占學生名額。' : '請向老師索取 6 碼房間代碼。即使只有 1～4 名同學，遊戲也會自動依人數調整建造目標。'}</div>
      </div>
    </section><div class="welcome-footer"><span>◈ 圓周率固定 3.14</span><span>◈ 不需安裝軟體</span><span>◈ 支援手機、平板、電腦</span><span>◈ 全隊同一顆星球</span></div>
  </div>`;
}

function planetWorld(structures = [], stage = 0) {
  const demo = stage >= 2 && structures.length === 0 ? [
    {kind:'forest',x:33,y:28,owner:'預覽'}, {kind:'forest',x:63,y:48,owner:'預覽'},
    {kind:'power',x:47,y:69,owner:'預覽'}, {kind:'orbit',x:76,y:45,owner:'預覽'}
  ] : [];
  const visible = structures.length ? structures.slice(-35) : demo;
  const structuresArt = {forest:'🌳', orbit:'🛰️', crater:'🚜', power:'☀️'};
  return `<div class="planet-world planet-stage-${stage}">
    <div class="star-spark one"></div><div class="star-spark two"></div><div class="star-spark three"></div>
    <div class="orbit-line"></div><div class="orbit-line two"></div><div class="orbit-dot"></div><div class="orbit-dot second"></div>
    <div class="planet-glow"></div><div class="planet-atmosphere"></div>
    <div class="planet-sphere">
      <div class="planet-core-shading"></div>
      <div class="planet-surface continent-a"></div><div class="planet-surface continent-b"></div><div class="planet-surface continent-c"></div>
      <div class="planet-ocean-shine"></div><div class="planet-cloud cloud-a"></div><div class="planet-cloud cloud-b"></div>
      <div class="planet-grid"></div>
      ${visible.map((b,i)=>`<span class="planet-building ${b.kind}" title="${escapeHTML(b.owner)} 的${KINDS[b.kind]?.name||'建築'}" style="left:${Number(b.x)||45}%;top:${Number(b.y)||50}%;--structure-delay:${(i%6)*.33}s"><span class="structure-base"></span><span class="structure-icon">${structuresArt[b.kind]||'✨'}</span><span class="structure-effect"></span></span>`).join('')}
    </div>
    ${stage>=2?'<div class="planet-biosignal bio-one">✦</div><div class="planet-biosignal bio-two">✧</div>':''}
    ${stage>=3?'<div class="planet-biosignal bio-three">🦋</div><div class="planet-biosignal bio-four">🌸</div>':''}
    <div class="planet-moon"></div>
  </div>`;
}
function resourcesPanel(s) {
  const resources = [['oxygen','🌱','氧氣','mint'],['water','💧','水資源','blue'],['energy','⚡','能源','amber'],['stability','🛡️','星球穩定度','violet']];
  const need = Math.max(1, Math.ceil(s.requiredBuildings/6));
  const made = s.completed.power || 0;
  const powerBar = `<div class="power-goal"><div class="resource-row"><strong>⚡ 能源建設進度</strong><strong>${made} / ${need} 座</strong></div><div class="bar"><div class="bar-fill amber" style="width:${Math.min(100, Math.round(made/need*100))}%"></div></div><p class="footnote">四種工程都必須完成；能源站能提升能源存量，三關完成後可啟動生命核心。</p></div>`;
  return `<section class="side-card card"><div class="section-head"><h2>🧬 星球生命指標</h2><span class="tag">即時同步</span></div>${resources.map(([key,icon,name,color])=>`<div class="resource-row"><div class="resource-left"><span class="resource-icon">${icon}</span><span class="resource-label">${name}</span></div><span class="resource-value">${s.resources[key]} / 100</span></div><div class="bar"><div class="bar-fill ${color}" style="width:${s.resources[key]}%"></div></div>`).join('')}${powerBar}${s.hazards?.length ? `<div class="hazard-notice"><strong>⚠️ 星球異常 ${s.hazards.length} 項</strong>${s.hazards.map(h=>`<p>${h.emoji} ${escapeHTML(h.notice)}（${h.status === 'active' ? '事件中' : '待修復'}）</p>`).join('')}</div>` : ''}</section>`;
}
function goalsPanel(s) {
  const checked = g => `<div class="goal-item ${g.met ? 'done' : ''}"><span class="check">${g.met ? '✓' : '○'}</span>${escapeHTML(g.text)}</div>`;
  const stages=(s.stages||[]).map(st=>`<div class="stage-step ${st.id<s.stage?'done':st.id===s.stage?'active':''}"><span class="stage-bubble">${st.id<s.stage?'✓':st.emoji}</span><div><strong>第 ${st.id} 關：${escapeHTML(st.title)}</strong><small>${escapeHTML(st.subtitle)}</small></div></div>`).join('');
  const guide='<div class="goal-kind-guide"><p>先從上面的四種建造按鈕選任務；每答對一題，會建立對應的設施並增加資源。</p><div class="goal-kind-grid">'
 +'<span>🌳 <b>森林</b><small>主要增加氧氣</small></span>'
 +'<span>⚡ <b>能源</b><small>主要增加能源</small></span>'
 +'<span>🛠️ <b>修復</b><small>改善水資源／穩定度</small></span>'
 +'<span>🛰️ <b>星環</b><small>提高防護與能源</small></span></div></div>';
  return `<section class="side-card card"><div class="section-head"><h2>🎯 本關任務（對照四種建造）</h2><span class="tag blue">${s.progress}%</span></div><div class="stage-steps">${stages}</div><div class="bar" style="height:11px"><div class="bar-fill" style="width:${s.progress}%"></div></div><div class="stage-problem"><strong>${escapeHTML(s.stageInfo?.title||'任務')}</strong><p>${escapeHTML(s.stageInfo?.problem||'完成數學建造任務')}</p></div>${guide}${s.eventsEnabled&&s.phase==='playing'?`<p class="footnote">☄️ 下次隨機宇宙事件：<strong data-event-countdown>${formatTime(s.eventCountdown)}</strong>${s.teamGame?'（合作遊戲中不打斷，結束後觸發）':''}</p>`:''}<div class="goal-list">${(s.goals||[]).map(checked).join('')}</div><div class="divider"></div><p class="footnote">請看四種建造的對照說明，再完成下方未打勾的目標。數學目標全部完成後，會自動開始本關合作小遊戲。</p></section>`;
}
function playersPanel(s) {
  return `<section class="side-card card"><div class="section-head"><h2>👨‍🚀 探險隊成員</h2><span class="tag blue">${s.players.length} / ${s.maxPlayers} 人</span></div><div class="player-list">${s.players.length ? s.players.map(p => `<div class="player-row"><span class="avatar ${p.id === s.myId ? 'me' : ''}">${escapeHTML(p.name.slice(0, 1))}</span><div class="player-info"><div class="player-name"><span class="online-dot ${p.connected ? '' : 'off'}" style="width:6px;height:6px;flex:none"></span>${escapeHTML(p.name)}${p.id === s.myId ? ' <small style="color:#58e7ad">(你)</small>' : ''}</div><div class="player-sub">${KINDS[p.selectedKind]?.emoji ?? '🚀'} ${KINDS[p.selectedKind]?.name ?? '探索中'} · ${p.correct} 題正確</div></div><span class="rank">★ ${p.stars}</span>${s.role === 'host' && (s.phase === 'lobby' || (s.phase === 'playing' && !p.connected)) ? `<button class="mini-btn" data-action="removePlayer" data-player-id="${p.id}" title="移除學生">×</button>` : ''}</div>`).join('') : '<div class="empty-state">等待探險家加入...<br/>可分享右上方房間代碼。</div>'}</div></section>`;
}
function historyPanel(s) {
  const symbol = { build: '🌱', event: '☄️', success: '✨', warning: '⚠️', wrong: '✏️', join: '🚀', victory: '🏆', system: '📡', stage:'🌍', review:'📝',explore:'🧭',pipe:'💧',decision:'🤝',research:'🔬' };
  return `<section class="side-card card"><div class="section-head"><h2>📡 宇宙任務日誌</h2></div><div class="log-list">${s.history.length ? s.history.slice(0, 7).map(h => `<div class="log-entry"><span class="log-icon">${symbol[h.type] || '📌'}</span><div><strong>${escapeHTML(h.message)}</strong><div class="log-time">${new Date(h.at).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'})}</div></div></div>`).join('') : '<div class="empty-state">還沒有冒險紀錄。<br/>完成建造後會顯示於此。</div>'}</div></section>`;
}

function planetPanel(s) {
  const stage = s.result?.win ? 3 : s.stage >= 3 ? 2 : s.stage === 2 ? 1 : 0;
  const currentEvent = s.event;
  return `<section class="stage-panel">
    <div class="planet-scene ${currentEvent ? `event-${currentEvent.style}` : ''} ${(s.hazards||[]).map(h=>`hazard-${h.id}`).join(' ')} ${s.phase === 'finished' && s.result?.win ? 'finish-scene' : ''}">
      <div class="scene-title"><h2>🌏 希望之星 · 第 ${s.stage} 關 ${escapeHTML(s.stageInfo?.title||'星球冒險')}</h2><p>PLANET ECOSYSTEM LIVE VIEW</p></div>
      <div class="scene-time">⏱ <span data-clock>${formatTime(s.remainingSeconds)}</span></div>
      ${planetWorld(s.structures, stage)}
      ${(s.hazards||[]).map((h,i)=>`<span class="hazard-visual hazard-visual-${escapeHTML(h.id)}" style="--hazard-index:${i}" title="${escapeHTML(h.notice)}">${h.emoji}</span>`).join('')}
      ${currentEvent ? `<span class="scene-event-emoji">${currentEvent.emoji}</span><div class="event-scene-label">${currentEvent.emoji} ${escapeHTML(currentEvent.name)} · <span data-event-seconds>${currentEvent.secondsLeft}s</span></div>` : ''}
      ${s.paused ? '<div class="scene-paused"><div><div style="font-size:42px">⏸️</div><h3>任務暫停中</h3><p>等待房主恢復</p></div></div>' : ''}
      ${s.phase === 'finished' ? `<div class="finish-ribbon"><div class="big">${s.result?.win ? '🏆' : '📘'}</div><h2>${escapeHTML(s.result?.title || '本局結束')}</h2><p>${escapeHTML(s.result?.description || '')}</p></div>` : ''}
      <div class="scene-scan">${currentEvent ? escapeHTML(currentEvent.description) : s.hazards?.length ? `⚠️ ${escapeHTML(s.hazards[0].notice)}` : `✦ ${escapeHTML(s.stageInfo?.problem||'完成當前建造與生態目標，即可進入下一關。')}`}</div>
      <div class="scene-index">生態開發進度<br/><strong style="font-size:19px;color:#8ff1c9">${s.progress}%</strong><div class="life-index-label">🌱 星球生命指數 ${s.lifeIndex ?? 0} / 100</div></div>
      <div class="scene-footer"><div style="width:${s.progress}%"></div></div>
    </div>
    <div class="mini-stats"><div class="mini-stat card"><div class="stat-number">${s.buildingsTotal}</div><div class="stat-label">已建設設施</div></div><div class="mini-stat card"><div class="stat-number">${s.players.length}</div><div class="stat-label">探險家人數</div></div><div class="mini-stat card"><div class="stat-number">${Object.values(s.completed).filter(Boolean).length}<span style="color:#819ab6;font-size:15px">/4</span></div><div class="stat-label">工程種類</div></div></div>
    <div class="card scene-caption"><div><strong style="font-size:13px">🌌 ${s.phase === 'lobby' ? '航行準備中' : s.phase === 'finished' ? '任務結算' : s.teamGame ? '全隊合作小遊戲中' : s.event ? '宇宙危機處理中' : '正在建設星球'}</strong><p>${s.phase === 'lobby' ? '邀請學生登陸，再由房主開始任務。' : s.phase === 'finished' ? '可以檢查解題成果，並開啟新一局。' : s.event ? '所有學生都可以嘗試事件解答，正確一人即全隊成功。' : '數學建造到一個段落，就會全隊一起操作不同的小遊戲；輪流操作、彼此討論才能進入下一關。'}</p></div><div class="badge-big">${s.event ? s.event.emoji : '🪐'}</div></div>
  </section>`;
}

function feedbackHTML(fb, isEvent = false) {
  if (!fb) return '';
  const cl = fb.correct ? 'success' : fb.reason==='missingUnit' ? 'info' : 'error';
  return `<div class="feedback ${cl}" role="status"><strong>${fb.correct ? '✨ 答對了！' : fb.reason==='missingUnit' ? '📏 還沒有選擇單位' : '🧠 再想一想'}</strong>${escapeHTML(fb.message || '')}${fb.correct && fb.steps ? `<ol>${fb.steps.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ol>` : ''}${fb.correct && fb.stars ? `<div style="margin-top:7px">獲得 ⭐ ${fb.stars} 星能點數${isEvent ? '（全隊共享事件獎勵）' : ''}</div>` : ''}</div>`;
}
function quizHTML(task,draft={}) {
  const estimation=task.context?.startsWith('估算任務');
  const title=task.type==='trueFalse'?'① 判斷是非':estimation?'① 用估算選出最接近的答案':'① 選出最適合的答案';
  return '<div class="math-formula quiz-panel"><label>'+title+'</label><div class="quiz-choices">'
    +(task.choices||[]).map(opt=>'<label class="quiz-choice"><input type="radio" name="answer" value="'+escapeHTML(opt.value)+'" '+(draft.answer===opt.value?'checked':'')+'/><span>'+escapeHTML(opt.label)+'</span></label>').join('')
    +'</div><p class="footnote">'+(estimation?'先用 π ≈ 3 粗估，不必精算小數；正確值會最接近其中一個選項。':'觀念題不需要選公式或單位。')+'</p></div>';
}
function formulaHTML(name, current = '') {
  return `<div class="math-formula"><label>① 選擇正確公式</label><div class="option-group">${FORMULAS.map(([id, text]) => `<label class="formula-option"><input type="radio" name="formula" value="${id}" ${current === id ? 'checked' : ''}/>${escapeHTML(text)}</label>`).join('')}</div></div>`;
}
function answerFields(draft = {}, event = false) {
  return `<div class="math-formula"><label>② 填寫計算結果與單位</label><div class="answer-row"><input class="text-input" inputmode="decimal" name="answer" data-draft="${event ? 'event' : 'task'}" placeholder="輸入數字，例如 314" value="${escapeHTML(draft.answer || '')}" required autocomplete="off"/><select class="select-input" name="unit" data-draft="${event ? 'event' : 'task'}"><option value="" ${!draft.unit ? 'selected' : ''}>選單位</option><option value="km" ${draft.unit === 'km' ? 'selected' : ''}>公里 km</option><option value="km²" ${draft.unit === 'km²' ? 'selected' : ''}>平方公里 km²</option></select></div></div>`;
}
function eventPanel(s) {
  const e = s.event;
  if (!e) return '';
  const key = `event:${e.startedAt}`;
  const draft = drafts.get(key) || {};
  return `<section class="card event-card"><div class="section-head"><h2>${e.emoji} ${escapeHTML(e.name)}</h2><span class="tag amber">剩餘 <span data-event-seconds>${e.secondsLeft}s</span></span></div><p class="event-description">${escapeHTML(e.description)}</p><div class="event-question">${escapeHTML(e.question)}</div>${s.role === 'student' && s.phase === 'playing' ? `<form id="event-answer-form" data-draft-key="${key}">${formulaHTML('event', draft.formula)}${answerFields(draft, true)}<button class="btn full" type="submit" ${s.paused ? 'disabled' : ''}>🛡️ 回答事件挑戰</button></form><div class="help-row"><span>💡 提示：${escapeHTML(e.hint)}</span><button type="button" class="mini-btn" data-action="scratch" data-scratch="event">✏️ 計算紙</button></div>` : `<div class="feedback info"><strong>📖 教師說明</strong>${escapeHTML(e.hint)}<br/>${teacherAnswerCard(`event:${e.startedAt}`, {scope:'event'}, s)}</div>`}${feedbackHTML(eventFeedback, true)}</section>`;
}
function teacherAnswerCard(key, params, s) {
  const detail = teacherReveals.get(key);
  return `<div class="teacher-answer-tools"><button type="button" class="mini-btn" data-action="${detail ? 'hideAnswer' : 'revealAnswer'}" data-answer-key="${escapeHTML(key)}" ${params.scope ? 'data-scope="event"' : `data-player-id="${escapeHTML(params.playerId)}" data-task-id="${escapeHTML(params.taskId)}"`}>${detail ? '🙈 隱藏答案' : '🔒 顯示答案（教師限定）'}</button>${detail ? `<div class="teacher-answer">${detail.type&&detail.type!=='number'?`<strong>正確選項：</strong>${escapeHTML(detail.answerLabel||detail.answer)}`:`<strong>公式：</strong>${escapeHTML(FORMULAS.find(x=>x[0]===detail.formula)?.[1]||detail.formula)}<br/><strong>答案：</strong>${escapeHTML(detail.answer)} ${escapeHTML(detail.unit)}`}<ol>${(detail.steps||[]).map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ol></div>` : '<span class="safe-note">目前答案隱藏，適合投影。</span>'}</div>`;
}
function teacherLiveTasks(s) {
  return `<section class="card host-card"><div class="section-head"><h2>🧑‍🏫 學生即時題目</h2><span class="tag blue">即時同步</span></div><p class="footnote">每位學生目前正在作答的題目都會顯示；解答預設不提供，老師需要時再按鈕揭露。投影前請先隱藏答案。</p><div class="live-task-list">${s.players.map(p => `<article class="live-task"><div class="live-task-head"><strong>${escapeHTML(p.name)}</strong><span class="tag">${KINDS[p.task?.kind]?.emoji||'🚀'} ${escapeHTML(p.task?.title||'待命')}</span></div><p>${escapeHTML(p.task?.question||'尚未分派題目')}</p>${p.task?.choices ? `<p class="footnote">選項：${p.task.choices.map(c=>escapeHTML(c.value+'. '+c.label)).join('　')}</p>` : ''}${p.task ? teacherAnswerCard(p.task.id,{playerId:p.id,taskId:p.task.id},s) : ''}</article>`).join('') || '<p class="empty-state">尚無學生加入</p>'}</div></section>`;
}
function reviewPanel(s) {
  const rev=s.ownReview;
  const score=s.players.find(p=>p.id===s.myId);
  const summary=`<section class="card waiting review-summary"><div class="big">${s.result?.win?'🏆':'📘'}</div><h2>星球冒險結算與數學回顧</h2><p>${escapeHTML(s.result?.description||'')}<br/>本局答對 ${score?.correct||0} 道建造題，獲得 ${score?.stars||0} 星能點。</p></section>`;
  if(!rev)return summary;
  if(rev.submitted){
    return summary+`<section class="card review-card"><div class="section-head"><h2>✅ 我的課後回顧</h2><span class="tag blue">${rev.result?.correct||0} / ${rev.result?.total||3} 題</span></div><p class="footnote">依照你的答案列出計算說明。答錯也能學會正確方法。</p>${(rev.result?.results||[]).map((q,i)=>`<article class="review-result ${q.correct?'correct':'incorrect'}"><strong>第 ${i+1} 題：${q.correct?'答對':'需要複習'}</strong><p>${escapeHTML(q.question)}</p><small>你的答案：${escapeHTML(q.submitted||'未作答')}　正確答案：${q.answer} ${escapeHTML(q.unit)}</small><p>${escapeHTML(q.explanation)}</p></article>`).join('')}<div class="review-reflection"><strong>你的學習回饋</strong><p>${escapeHTML(rev.result?.reflection||'尚未填寫反思')}</p></div></section>`;
  }
  return summary+`<section class="card review-card"><div class="section-head"><h2>📝 課後數學回顧</h2><span class="tag blue">3 道複習題</span></div><p class="footnote">回答三題並回想本次最困難的部分；提交後可以看到每題的解法。這份回饋會傳給老師。</p><form id="review-form">${rev.questions.map((q,i)=>`<div class="review-question"><label for="review-${q.id}"><strong>第 ${i+1} 題</strong> ${escapeHTML(q.question)}</label><div class="review-answer"><input id="review-${q.id}" class="text-input" inputmode="decimal" name="review-${q.id}" placeholder="填寫計算結果" value="${escapeHTML(reviewDraft['review-'+q.id]||'')}" required autocomplete="off"/><span>${escapeHTML(q.unit)}</span></div></div>`).join('')}<div class="field"><label for="review-confidence">今天對圓周長與圓面積的掌握程度</label><select id="review-confidence" class="select-input" name="confidence"><option value="understand" ${reviewDraft.confidence==='understand'?'selected':''}>我大致會了</option><option value="partial" ${!reviewDraft.confidence||reviewDraft.confidence==='partial'?'selected':''}>我還有部分不確定</option><option value="review" ${reviewDraft.confidence==='review'?'selected':''}>我需要再練習</option></select></div><div class="field"><label for="review-reflection">今天最難的題目是什麼？你是怎麼想的？</label><textarea id="review-reflection" name="reflection" class="text-input review-textarea" maxlength="300" rows="3" placeholder="例如：我常忘記面積要用半徑乘半徑...">${escapeHTML(reviewDraft.reflection||'')}</textarea></div><button class="btn full" type="submit">📩 提交並查看詳解</button></form></section>`;
}
function reviewDetailHTML(p) {
  const key='review:'+p.id;
  const detail=teacherReveals.get(key);
  const button='<button class="mini-btn" type="button" data-action="'+(detail?'hideReview':'revealReview')+'" data-player-id="'+escapeHTML(p.id)+'">'+(detail?'🙈 隱藏回顧答案':'🔎 查看回顧答題詳情')+'</button>';
  if(!detail)return '<div class="review-reveal">'+button+'</div>';
  return '<div class="review-reveal">'+button
    +(detail.results||[]).map((q,i)=>'<div class="review-teacher-question '+(q.correct?'correct':'incorrect')+'"><strong>第 '+(i+1)+' 題：'+(q.correct?'✅ 答對':'❌ 答錯')+'</strong><p>'+escapeHTML(q.question)+'</p><p>學生作答：'+escapeHTML(q.submitted||'未作答')+'；正確答案：'+escapeHTML(q.answer)+' '+escapeHTML(q.unit)+'</p><small>'+escapeHTML(q.explanation)+'</small></div>').join('')
    +'</div>';
}
function teacherReviewPanel(s) {
  if(s.phase!=='finished')return '';
  const finished=s.players.filter(p=>p.reviewSubmitted).length;
  return '<section class="card host-card"><div class="section-head"><h2>📝 課後回顧與學生回饋</h2><span class="tag blue">'+finished+'/'+s.players.length+' 已提交</span></div>'
    +'<p class="footnote">每位學生的正確與錯誤題目預設隱藏，老師按「查看回顧答題詳情」才顯示，適合分享畫面。</p><div class="review-teacher-list">'
    +s.players.map(p=>'<article class="review-teacher-row"><strong>'+escapeHTML(p.name)+'</strong><span>'+(p.reviewSubmitted?'回顧答對 '+p.reviewScore+'/3':'尚未提交')+'</span>'
      +(p.reviewSubmitted?'<p>掌握程度：'+(p.reviewConfidence==='understand'?'大致會了':p.reviewConfidence==='review'?'需要再練習':'部分不確定')+'</p><p>反思：'+escapeHTML(p.reviewReflection||'未填寫')+'</p>'+reviewDetailHTML(p):'')
      +'</article>').join('')+'</div></section>';
}
function workNavigation() {
 const tabs=[['build','📐','數學建造'],['explore','🧭','探索地圖'],['pipes','💧','接水管'],['tech','🔬','科技基地']];
 return '<nav class="work-tabs" aria-label="選擇冒險玩法">'+tabs.map(([id,emoji,label])=>'<button type="button" class="work-tab '+(workTab===id?'selected':'')+'" data-action="workTab" data-work-tab="'+id+'">'+emoji+' <span>'+label+'</span></button>').join('')+'</nav>';
}
function adventureSummary(s){
 const a=s.adventure;if(!a)return '';
 return '<section class="card adventure-overview"><div class="section-head"><h2>🧭 探險隊共同進度</h2><span class="tag blue">第 '+s.stage+' 關</span></div><div class="adventure-stats"><span>🧭 探索 '+a.discovered+'/16</span><span>💧 管線 '+a.pipeRepairs+' 次</span><span>🧪 材料 '+a.materials+'</span><span>🔬 科技 '+a.upgrades.length+'/4</span></div>'+(a.lastAction?'<p class="adventure-latest">✨ '+escapeHTML(a.lastAction)+'</p>':'')+'</section>';
}
function explorePanel(s){
 const a=s.adventure;if(!a)return '';
 const decision=a.decision?'<div class="planet-decision"><h3>'+escapeHTML(a.decision.title)+'</h3><p>'+escapeHTML(a.decision.story)+'</p><div class="decision-options">'+a.decision.options.map(opt=>'<button type="button" data-action="decision" data-choice="'+opt.id+'" '+(s.paused?'disabled':'')+'><strong>'+escapeHTML(opt.label)+'</strong><small>'+escapeHTML(opt.description)+'</small></button>').join('')+'</div><p class="footnote">由一位學生代表全隊作決定，資源會即時改變。</p></div>':'';
 const cells=a.sectors.map(sec=>'<button type="button" class="sector-tile '+(sec.revealed?'revealed':'fog')+'" data-action="explore" data-explore-index="'+sec.index+'" '+(sec.revealed||s.paused||a.decision||Date.now()<a.nextScanAt?'disabled':'')+' aria-label="第'+(sec.index+1)+'區：'+escapeHTML(sec.title)+'"><span>'+sec.icon+'</span><strong>'+escapeHTML(sec.title)+'</strong>'+(sec.by?'<small>'+escapeHTML(sec.by)+'</small>':'')+'</button>').join('');
 return '<section class="card adventure-card"><div class="section-head"><h2>🧭 探索未知大陸</h2><span class="tag blue">'+a.discovered+'/16 格</span></div><p>點擊未探索的地圖區域，尋找水脈、礦物、植物與能源。每次需要 2 能源，全隊共用探測器。</p><p class="footnote">探測器冷卻：<strong data-adventure-timer="scan"></strong></p>'+decision+'<div class="sector-grid">'+cells+'</div>'+(a.lastDiscovery?'<div class="explore-discovery"><strong>'+a.lastDiscovery.icon+' '+escapeHTML(a.lastDiscovery.title)+'</strong><p>'+escapeHTML(a.lastDiscovery.description)+'</p><small>'+escapeHTML(a.lastDiscovery.by)+' 獲得材料 +'+a.lastDiscovery.material+'</small></div>':'')+'</section>';
}
function pipePanel(s){
 const a=s.adventure;if(!a)return '';
 if(s.stage<2)return '<section class="card adventure-card"><h2>🔒 管線修復尚未解鎖</h2><p>完成第一關後，就可以開始旋轉水管的小遊戲。</p></section>';
 const tiles=a.pipe.cells.map((c,i)=>'<button type="button" class="pipe-tile '+(c.flowing?'flowing':'')+'" data-action="pipeRotate" data-pipe-index="'+i+'" '+(s.paused||Date.now()<a.nextPipeAt?'disabled':'')+' aria-label="旋轉第'+(Math.floor(i/3)+1)+'列第'+(i%3+1)+'欄水管"><span class="pipe-center"></span>'+c.ports.map(dir=>'<span class="pipe-arm pipe-'+dir.toLowerCase()+'"></span>').join('')+'</button>').join('');
 return '<section class="card adventure-card"><div class="section-head"><h2>💧 合作接通水循環</h2><span class="tag blue">修復 '+a.pipeRepairs+' 次</span></div><p>點水管方格可以順時針旋轉 90 度。讓水從<strong>左上角的左側入口</strong>一路接到<strong>右下角的右側出口</strong>，所有學生能看到同一張水管圖。</p><div class="pipeline-shell"><span class="pipe-endpoint start">💧 起點 →</span><div class="pipe-grid">'+tiles+'</div><span class="pipe-endpoint end">→ 🌿 終點</span></div><p class="footnote">接通需 3 能源，獎勵水資源 +9、穩定度 +4。再次修復：<strong data-adventure-timer="pipe"></strong>；亮藍色代表已流到的位置。</p></section>';
}
function techPanel(s){
 const a=s.adventure;if(!a)return '';
 return '<section class="card adventure-card"><div class="section-head"><h2>🔬 合作研究基地</h2><span class="tag blue">材料 '+a.materials+'</span></div><p>探索取得材料，團隊討論要先研究哪一種升級。升級後會立即增加資源，並持續強化對應工程。</p><div class="research-list">'+a.techs.map(t=>'<article class="research-item '+(t.owned?'owned':'')+'"><div class="research-icon">'+t.icon+'</div><div class="research-detail"><strong>'+escapeHTML(t.title)+'</strong><small>'+escapeHTML(t.description)+'</small></div><button type="button" class="mini-btn" data-action="research" data-tech-id="'+t.id+'" '+(t.owned||s.paused||a.materials<t.cost?'disabled':'')+'>'+(t.owned?'✓ 已升級':'🧪 '+t.cost+' 材料')+'</button></article>').join('')+'</div></section>';
}
function studentPanel(s) {
  if (s.phase === 'lobby') return `<section class="card waiting"><div class="big">🚀</div><h2>準備就緒，等待房主</h2><p>你已成功加入 <strong>${escapeHTML(s.code)}</strong> 房間！<br/>老師開始後，可以選擇森林、星環、地形修復或能源工程。<br/>不同人數會採不同的完成目標。</p></section>`;
  if (s.phase === 'finished') return reviewPanel(s);
  if (s.teamGame) return '<section class="card waiting"><div class="big">🤝</div><h2>全隊合作小遊戲</h2><p>請在上方大型遊戲區輪流操作並討論。目前暫停數學建造，完成小遊戲才會開放下一段。</p></section>';
  const t = s.ownTask;
  if (!t) return `<div class="card waiting">請稍候，正在產生新任務...</div>`;
  const draft = drafts.get(`task:${t.id}`) || {};
  const buildingMarkup=`<section class="card task-card"><div class="section-head"><h2>📐 數學建造任務</h2><span class="tag blue">π ≈ 3（估算）</span></div><div class="task-tabs">${Object.entries(KINDS).map(([k, inf]) => `<button class="task-tab ${t.kind === k ? 'active' : ''}" data-action="selectTask" data-kind="${k}" ${s.paused ? 'disabled' : ''}><span class="emoji">${inf.emoji}</span>${inf.name}</button>`).join('')}</div>
    <div class="question-box"><div class="question-title">${KINDS[t.kind]?.emoji} ${escapeHTML(t.title)}</div><p class="question-text">${escapeHTML(t.question)}</p><div class="question-context">${escapeHTML(t.context)}</div></div>
    <div class="math-caption">✦ 計算題用 π ≈ 3 粗估，從四個答案選出最接近的一個；觀念題直接判斷。</div>
    <form id="task-answer-form" data-draft-key="task:${t.id}">${t.type==='choice'||t.type==='trueFalse'?quizHTML(t,draft):formulaHTML('task',draft.formula)+answerFields(draft)}<div class="help-row"><span>難度：${s.difficulty === 'basic' ? '基礎' : s.difficulty === 'advanced' ? '挑戰' : '標準'}</span><div class="task-helpers"><button class="mini-btn" type="button" data-action="hint">💡 公式提示</button><button class="mini-btn" type="button" data-action="scratch" data-scratch="task">✏️ 計算紙</button></div></div>${hintText ? `<div class="feedback info"><strong>💡 建造提示</strong>${escapeHTML(hintText)}</div>` : ''}<div class="task-actions"><button class="btn full" type="submit" ${s.paused ? 'disabled' : ''}>✨ 確認建造</button></div></form>
    ${feedbackHTML(feedback)}</section>`;
  return `<section class="card role-intro"><span class="icon">👨‍🚀</span><div><h2>第 ${s.stage} 關・數學建設</h2><p>先與隊友完成這段數學建設，系統就會自動開啟合作遊戲，不需要選活動。</p></div><span class="tag">階段建造</span></section>`
    +eventPanel(s)+buildingMarkup;
}
function teacherSettingsPanel(s) {
  return `<section class="card host-card"><div class="section-head"><h2>🎛️ 教師控制台</h2><span class="tag">房主專屬</span></div><div class="config-grid"><div class="field"><label>題目難度</label><select class="select-input" data-setting="difficulty"><option value="basic" ${s.difficulty === 'basic' ? 'selected' : ''}>基礎</option><option value="standard" ${s.difficulty === 'standard' ? 'selected' : ''}>標準</option><option value="advanced" ${s.difficulty === 'advanced' ? 'selected' : ''}>挑戰</option></select></div><div class="field"><label>每局時間</label><select class="select-input" data-setting="durationMinutes" ${s.phase !== 'lobby' ? 'disabled' : ''}>${[15, 25, 30].map(x => `<option value="${x}" ${s.durationMinutes === x ? 'selected' : ''}>${x} 分鐘</option>`).join('')}</select></div></div><div class="stage-setting-note">🎯 每一段數學目標完成後，會自動開啟兩款不同操作的合作遊戲。全隊成功後才進入下一段數學關卡。</div><label class="toggle-row"><input type="checkbox" data-setting="eventsEnabled" ${s.eventsEnabled ? 'checked' : ''}/>啟用自動宇宙事件（每 3 分鐘隨機一種，合作遊戲中會延後觸發）</label>
    <div class="action-grid">${s.phase === 'lobby' ? `<button class="btn" data-action="start" ${s.players.length < 1 ? 'disabled' : ''}>▶ 開始任務</button>` : s.phase === 'playing' ? `<button class="btn secondary" data-action="pause">${s.paused ? '▶ 恢復' : '⏸ 暫停'}</button>` : `<button class="btn" data-action="reset">↺ 開啟新局</button>`}${s.phase === 'playing' ? '<button class="btn warn" data-action="finish">⏹ 結束本局</button>' : `<button class="btn secondary" data-action="copy">📋 複製房號</button>`}</div>
    <div class="divider"></div><div class="section-head"><h2>☄️ 宇宙事件演示</h2><span class="tag blue">手動觸發</span></div><div class="event-grid">${Object.entries(EVENT_NAMES).map(([key, name]) => `<button class="event-button" data-action="event" data-event-id="${key}" ${s.phase !== 'playing' || s.paused || s.event || s.teamGame ? 'disabled' : ''}>${name}</button>`).join('')}</div>${s.event ? `<button style="margin-top:11px" class="btn secondary slim full" data-action="skipEvent">⏭ 略過事件（保留初始衝擊）</button>` : ''}
    ${s.teamGame ? '<button class="btn secondary slim full" data-action="skipTeamGame">⏭ 教師略過目前合作小遊戲</button>' : ''}<div class="host-notice" style="margin-top:14px">💡 <strong>小組平衡：</strong>本局 ${s.startingPlayers || s.players.length || 1} 人，累計 <strong>${s.requiredBuildings}</strong> 項數學工程，並依序完成六款操作型合作小遊戲。教師可視課堂節奏略過一款。事件發生時就會影響星球；失敗後需完成對應工程清除異常。</div></section>`;
}
function teacherReport(s) {
  return `<section class="card host-card"><div class="section-head"><h2>📊 學生作答統計</h2><button class="mini-btn" data-action="export">⬇ CSV</button></div><table class="class-table"><thead><tr><th>學生</th><th class="num">答對 / 作答</th><th class="num">提示</th><th class="num">錯誤</th></tr></thead><tbody>${s.players.map(p => `<tr><td>${escapeHTML(p.name)}</td><td class="num">${p.correct} / ${p.answered}</td><td class="num">${p.hints ?? 0}</td><td class="num">${Object.values(p.mistakes || {}).reduce((a, b) => a + b, 0)}</td></tr>`).join('') || '<tr><td colspan="4">尚無學生</td></tr>'}</tbody></table><p class="footnote">錯誤統計包含公式錯誤、計算錯誤、單位錯誤；下載 CSV 可查看明細。</p></section>`;
}
function hostPanel(s) {
  return `<section class="card role-intro"><span class="icon">👩‍🏫</span><div><h2>${escapeHTML(s.hostName)}的指揮中心</h2><p>房主不占學生名額，可管理教學節奏與宇宙事件。</p></div></section>${eventPanel(s)}${teacherSettingsPanel(s)}${teacherLiveTasks(s)}${teacherReport(s)}${teacherReviewPanel(s)}${s.phase === 'lobby' ? `<section class="card waiting"><div class="big">🪐</div><h2>等待探險家登陸</h2><p>目前 ${s.players.length} 人進入房間。<br/>最少 1 人就能開始；沒有固定職業分工。<br/>任務開啟前可以自由調整難度與時間。</p><div class="room-badge">${escapeHTML(s.code)}</div></section>` : ''}`;
}
function renderGame(s) {
  return `<div class="container"><header class="site-header"><div class="brand"><span class="brand-icon">🌍</span><span><div class="brand-title">星球綠化造物主</div><div class="brand-sub">PLANET MAKER · MATH LAB</div></span></div><div class="header-right"><span class="small-pill" data-connection><span class="online-dot ${connectionLive ? '' : 'off'}"></span> ${connectionLive ? '連線正常' : '連線中'}</span><button class="ghost-btn" data-action="leave">↩ 離開房間</button></div></header>
    <div class="game-top"><div><div class="eyebrow">${s.role === 'host' ? 'MISSION COMMAND · 房主視角' : 'EXPLORER MODE · 學生視角'}</div><div class="room-title">${s.phase === 'finished' ? '星球任務成果' : '打造我們的綠色星球'}</div></div><div class="top-actions"><span class="small-pill">房間 <strong class="room-code">${escapeHTML(s.code)}</strong></span><button class="mini-btn" data-action="copy" aria-label="複製房間代碼">⧉ 複製</button><span class="small-pill">👥 ${s.players.length}/${s.maxPlayers} 學生</span><span class="tag ${s.paused ? 'amber' : s.phase === 'playing' ? '' : 'blue'}">${s.paused ? '已暫停' : s.phase === 'lobby' ? '等待開始' : s.phase === 'playing' ? '進行中' : '已結束'}</span></div></div>
    ${s.teamGame?teamGameHTML(s):''}<main class="game-layout"><aside class="sidebar">${resourcesPanel(s)}${goalsPanel(s)}${playersPanel(s)}${historyPanel(s)}</aside>${planetPanel(s)}<aside class="work-panel">${s.role === 'host' ? hostPanel(s) : studentPanel(s)}<div class="rule-card"><strong>📚 數學規則</strong><ul><li>統一採用圓周率 π = 3.14。</li><li>周長是長度（km），面積是平方單位（km²）。</li><li>每人都能完成四種工程，並可同時作答。</li><li>事件答對一人就能幫助全隊；提示不影響通關。</li></ul></div></aside></main><footer class="footer">星球綠化造物主 v1.8 · 小學六年級數學課堂合作遊戲 · 本版進度僅保存在運行中的伺服器記憶體</footer></div>`;
}
function captureFocus() {
  const active = document.activeElement;
  if (!active || !active.matches('input,select')) return null;
  return { name: active.name, type: active.type, value: active.value, index: [...document.querySelectorAll(`[name="${CSS.escape(active.name)}"]`)].indexOf(active), start: active.selectionStart, end: active.selectionEnd };
}
function restoreFocus(meta) {
  if (!meta) return;
  const sameName = [...document.querySelectorAll(`[name="${CSS.escape(meta.name)}"]`)];
  const target = sameName[meta.index];
  if (!target) return;
  try { target.focus({ preventScroll: true }); if (target.setSelectionRange && meta.start != null) target.setSelectionRange(meta.start, meta.end); } catch { /* input type may not support selection */ }
}
function render() {
  const focused = captureFocus();
  root.innerHTML = state ? renderGame(state) : renderWelcome();
  if (state) { updateLive(); updateClocks(); }
  restoreFocus(focused);
}
function exportCSV(s) {
  const lines = [['暱稱','答題總數','正確數','使用提示','公式錯誤','計算錯誤','單位錯誤','星能分數','回顧分數','掌握程度','學習反思'], ...s.players.map(p => [p.name, p.answered, p.correct, p.hints, p.mistakes?.formula || 0, p.mistakes?.value || 0, p.mistakes?.unit || 0, p.stars, p.reviewSubmitted ? p.reviewScore+'/3':'尚未提交', p.reviewConfidence||'', p.reviewReflection||''])];
  lines.push([]);
  lines.push(['時間','事件類型','紀錄','學生','題目類型','錯誤類型','答案','單位','解題步驟']);
  for (const h of [...s.history].reverse()) lines.push([new Date(h.at).toLocaleString('zh-TW'), h.type, h.message, h.player ?? '', h.kind ?? h.event ?? '', h.reason ?? '', h.answer ?? '', h.unit ?? '', h.steps?.join(' / ') ?? '']);
  const csv = '\ufeff' + lines.map(items => items.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `星球綠化_學習紀錄_${s.code}.csv`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
  toast('已匯出課堂學習紀錄');
}

root.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.id === 'auth-form') return auth(form.dataset.auth, form);
  if (form.id === 'review-form') { const answers={}; for(const q of state.ownReview?.questions||[]) answers[q.id]=form.querySelector(`[name="review-${q.id}"]`)?.value||'';return action('submitReview',{answers,reflection:form.querySelector('[name="reflection"]')?.value||'',confidence:form.querySelector('[name="confidence"]')?.value||'partial'}); }
  if (form.id === 'task-answer-form') {
    if (state?.ownTask?.type==='choice'||state?.ownTask?.type==='trueFalse') {
      const chosen=form.querySelector('[name=answer]:checked')?.value || '';
      if(!chosen){feedback={correct:false,reason:'missingChoice',message:'請先選擇一個選項。'};render();return;}
      return action('answer',{taskId:state.ownTask.id,answer:chosen});
    }
    const formula = form.querySelector('[name=formula]:checked')?.value ?? '';
    const answer = form.querySelector('[name=answer]').value;
    const unit = form.querySelector('[name=unit]').value;
    const taskId = state?.ownTask?.id;
    if (!formula) return toast('請先選擇計算公式', true);
    if (!unit) { feedback={reason:'missingUnit',correct:false,message:'請先選擇單位：公里 km 或平方公里 km²。尚未計入答錯。'};render();return; }
    return action('answer', { taskId, formula, answer, unit });
  }
  if (form.id === 'event-answer-form') {
    const formula = form.querySelector('[name=formula]:checked')?.value ?? '';
    const answer = form.querySelector('[name=answer]').value;
    const unit = form.querySelector('[name=unit]').value;
    if (!formula) return toast('請先選擇事件計算公式', true);
    if (!unit) { eventFeedback={reason:'missingUnit',correct:false,message:'請先選擇單位：公里 km 或平方公里 km²。尚未計入答錯。'};render();return; }
    return action('eventAnswer', { formula, answer, unit });
  }
});
root.addEventListener('input', event => {
  const el = event.target;
  if(el.closest('#review-form')){reviewDraft[el.name]=el.value;return;}
  const form = el.closest('[data-draft-key]');
  if (!form) return;
  const key = form.dataset.draftKey;
  const draft = drafts.get(key) || {};
  if (el.name) draft[el.name] = el.value;
  drafts.set(key, draft);
});
root.addEventListener('change', event => {
  const el = event.target;
  if(el.closest('#review-form')) reviewDraft[el.name]=el.value;
  const form = el.closest('[data-draft-key]');
  if (form) {
    const draft = drafts.get(form.dataset.draftKey) || {};
    if (el.name) draft[el.name] = el.value;
    drafts.set(form.dataset.draftKey, draft);
  }
  if (el.dataset.setting && state?.role === 'host') {
    const key = el.dataset.setting;
    action('settings', { [key]: el.type === 'checkbox' ? el.checked : el.value });
  }
});
root.addEventListener('click', async event => {
  const tab = event.target.closest('[data-tab]');
  if (tab) { joinMode = tab.dataset.tab; render(); return; }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const name = button.dataset.action;
  if (name === 'copy') {
    try { await navigator.clipboard.writeText(state.code); toast(`已複製房間代碼：${state.code}`); }
    catch { toast(`房間代碼：${state.code}（請手動複製）`); }
    return;
  }
  if (name === 'leave') {
    const message = state?.role === 'host' ? '確定返回首頁？離開後將失去目前房主憑證，建議先結束本局並匯出成績。' : '確定離開房間？你的學生席位將釋出，下次可使用房間代碼重新加入。';
    if (!confirm(message)) return;
    if (state?.role === 'student') {
      try { await post('action', { token: savedSession.token, action: 'leave' }); }
      catch (e) { toast(e.message, true); }
    }
    logout(); return;
  }
  if (name === 'export') return exportCSV(state);
  if (name === 'teamMove') return action('teamMove',{gameId:button.dataset.teamGame,move:button.dataset.teamMove,index:button.dataset.teamIndex===undefined?undefined:Number(button.dataset.teamIndex)});
  if (name === 'skipTeamGame') {if(!confirm('確定略過這款小遊戲嗎？不發放完成獎勵。'))return;return action('skipTeamGame');}
  if (name === 'scratch') return scratchpad.open(button.dataset.scratch);
  if (name === 'hideReview') {teacherReveals.delete('review:'+button.dataset.playerId);render();return;}
  if (name === 'revealReview') return action('revealReview',{playerId:button.dataset.playerId});
  if (name === 'hideAnswer') { teacherReveals.delete(button.dataset.answerKey); render(); return; }
  if (name === 'revealAnswer') return action('revealAnswer', button.dataset.scope === 'event' ? {scope:'event'} : {playerId:button.dataset.playerId,taskId:button.dataset.taskId});
  if (name === 'reset' && !confirm('確定重設本局？原有建築和作答統計將會清空。')) return;
  if (name === 'finish' && !confirm('確定結束本局？')) return;
  if (name === 'removePlayer' && !confirm('確定將這位學生移出房間？')) return;
  if (name === 'selectTask') return action(name, { kind: button.dataset.kind });
  if (name === 'event') return action(name, { eventId: button.dataset.eventId });
  if (name === 'removePlayer') return action(name, { playerId: button.dataset.playerId });
  return action(name);
});

function animateTeamGame(){
 if(state?.teamGame?.kind==='pulse')animatePulseCursor(state);
 requestAnimationFrame(animateTeamGame);
}
requestAnimationFrame(animateTeamGame);
render();
resume();
