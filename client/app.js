const root = document.getElementById('app');
const toastRoot = document.getElementById('toast-root');
const SESSION_KEY = 'planet-green-creator-session-v1';
const FORMULAS = [
  ['area', 'π × 半徑 × 半徑'],
  ['circumference', '2 × π × 半徑（或 π × 直徑）'],
  ['ring', '大圓面積 − 小圓面積'],
  ['reverse', '面積 ÷ π，再找半徑']
];
const KINDS = {
  forest: { name: '森林', emoji: '🌳', tag: '生態工程', color: 'var(--mint)' },
  orbit: { name: '星環', emoji: '🛰️', tag: '軌道防衛', color: 'var(--blue)' },
  crater: { name: '修復', emoji: '🛠️', tag: '地形工程', color: 'var(--amber)' }
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
let currentTaskId = null;
let currentEventId = null;

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
  state = next;
  document.title = `${next.code} · 星球綠化造物主`;
  render();
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
  localStorage.removeItem(SESSION_KEY);
  document.title = '星球綠化造物主｜小六數學多人協作遊戲';
  if (renderNow) render();
}
async function action(name, extra = {}) {
  if (loading || !savedSession) return;
  loading = true;
  try {
    const response = await post('action', { token: savedSession.token, action: name, ...extra });
    if (name === 'answer' || name === 'hint') {
      if (name === 'hint') hintText = response.feedback?.hint || '';
      else feedback = response.feedback;
    }
    if (name === 'eventAnswer') eventFeedback = response.feedback;
    if (name === 'selectTask' || name === 'reset' || name === 'start') {
      feedback = null; eventFeedback = null; hintText = '';
    }
    applyState(response.state);
    if (name === 'answer' && response.feedback?.correct) toast('✨ 建造完成，星球又成長了！');
    else if (name === 'eventAnswer' && response.feedback?.correct) toast('🎉 宇宙事件解除！全隊獲得獎勵');
    else if (name === 'answer' && response.feedback && !response.feedback.correct) toast('答案未通過，可再試一次', true);
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
        <p class="welcome-lead">從荒蕪隕石開始，計算森林面積、建造衛星軌道、修復隕石坑。和同學一起完成任務，抵抗宇宙危機，打造獨一無二的綠色星球。</p>
        <div class="hero-highlights"><span>👥 1–5 人自動平衡</span><span>📐 圓周長 × 圓面積</span><span>☄️ 4 種隨機事件</span><span>🎓 教師專屬控制台</span></div>
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
  const baseTrees = stage >= 2 && structures.length === 0 ? [
    { kind: 'forest', x: 33, y: 24, owner: '預覽' }, { kind: 'forest', x: 62, y: 39, owner: '預覽' },
    { kind: 'forest', x: 48, y: 67, owner: '預覽' }, { kind: 'orbit', x: 78, y: 48, owner: '預覽' }
  ] : [];
  const visible = (structures.length ? structures.slice(-25) : baseTrees);
  return `<div class="planet-world planet-stage-${stage}">
    <div class="orbit-line"></div><div class="orbit-line two"></div><div class="orbit-dot"></div><div class="orbit-dot second"></div><div class="planet-glow"></div>
    <div class="planet-sphere"><div class="planet-grid"></div>${visible.map((b, i) => `<span class="planet-building ${b.kind}" title="${escapeHTML(b.owner)} 的${KINDS[b.kind]?.name ?? '建築'}" style="left:${Number(b.x) || 45}%;top:${Number(b.y) || 50}%;animation-delay:${(i%4)*.1}s">${KINDS[b.kind]?.emoji || '✨'}</span>`).join('')}</div><div class="planet-moon"></div>
  </div>`;
}

function resourcesPanel(s) {
  const resources = [
    ['oxygen', '🌱', '氧氣', 'mint'], ['water', '💧', '水資源', 'blue'],
    ['energy', '⚡', '能源', 'amber'], ['stability', '🛡️', '星球穩定度', 'violet']
  ];
  return `<section class="side-card card"><div class="section-head"><h2>🧬 星球生命指標</h2><span class="tag">即時同步</span></div>${resources.map(([key, icon, name, color]) => `<div class="resource-row"><div class="resource-left"><span class="resource-icon">${icon}</span><span class="resource-label">${name}</span></div><span class="resource-value">${s.resources[key]} / 100</span></div><div class="bar"><div class="bar-fill ${color}" style="width:${s.resources[key]}%"></div></div>`).join('')}</section>`;
}
function goalsPanel(s) {
  const checked = (yes, label) => `<div class="goal-item ${yes ? 'done' : ''}"><span class="check">${yes ? '✓' : '○'}</span>${label}</div>`;
  return `<section class="side-card card"><div class="section-head"><h2>🎯 星球綠化計畫</h2><span class="tag blue">${s.progress}%</span></div><div class="bar" style="height:11px"><div class="bar-fill" style="width:${s.progress}%"></div></div><div class="goal-list">${checked(s.buildingsTotal >= s.requiredBuildings, `累計建造 ${s.buildingsTotal} / ${s.requiredBuildings} 項`)}${checked(s.completed.forest > 0, `森林建造 ≥ 1（目前 ${s.completed.forest}）`)}${checked(s.completed.orbit > 0, `星環建造 ≥ 1（目前 ${s.completed.orbit}）`)}${checked(s.completed.crater > 0, `地形修復 ≥ 1（目前 ${s.completed.crater}）`)}</div><div class="divider"></div><p class="footnote">本局採 ${s.startingPlayers || s.players.length || 1} 人目標設定。所有職業可自由切換，避免缺人時無法完成任務。</p></section>`;
}
function playersPanel(s) {
  return `<section class="side-card card"><div class="section-head"><h2>👨‍🚀 探險隊成員</h2><span class="tag blue">${s.players.length} / ${s.maxPlayers} 人</span></div><div class="player-list">${s.players.length ? s.players.map(p => `<div class="player-row"><span class="avatar ${p.id === s.myId ? 'me' : ''}">${escapeHTML(p.name.slice(0, 1))}</span><div class="player-info"><div class="player-name"><span class="online-dot ${p.connected ? '' : 'off'}" style="width:6px;height:6px;flex:none"></span>${escapeHTML(p.name)}${p.id === s.myId ? ' <small style="color:#58e7ad">(你)</small>' : ''}</div><div class="player-sub">${KINDS[p.selectedKind]?.emoji ?? '🚀'} ${KINDS[p.selectedKind]?.name ?? '探索中'} · ${p.correct} 題正確</div></div><span class="rank">★ ${p.stars}</span>${s.role === 'host' && (s.phase === 'lobby' || (s.phase === 'playing' && !p.connected)) ? `<button class="mini-btn" data-action="removePlayer" data-player-id="${p.id}" title="移除學生">×</button>` : ''}</div>`).join('') : '<div class="empty-state">等待探險家加入...<br/>可分享右上方房間代碼。</div>'}</div></section>`;
}
function historyPanel(s) {
  const symbol = { build: '🌱', event: '☄️', success: '✨', warning: '⚠️', wrong: '✏️', join: '🚀', victory: '🏆', system: '📡' };
  return `<section class="side-card card"><div class="section-head"><h2>📡 宇宙任務日誌</h2></div><div class="log-list">${s.history.length ? s.history.slice(0, 7).map(h => `<div class="log-entry"><span class="log-icon">${symbol[h.type] || '📌'}</span><div><strong>${escapeHTML(h.message)}</strong><div class="log-time">${new Date(h.at).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'})}</div></div></div>`).join('') : '<div class="empty-state">還沒有冒險紀錄。<br/>完成建造後會顯示於此。</div>'}</div></section>`;
}

function planetPanel(s) {
  const stage = s.buildingsTotal >= s.requiredBuildings ? 3 : s.progress >= 65 ? 2 : s.progress >= 25 ? 1 : 0;
  const currentEvent = s.event;
  return `<section class="stage-panel">
    <div class="planet-scene ${currentEvent ? `event-${currentEvent.style}` : ''} ${s.phase === 'finished' && s.result?.win ? 'finish-scene' : ''}">
      <div class="scene-title"><h2>🌏 希望之星 · ${stage === 0 ? '荒蕪時代' : stage === 1 ? '萌芽時代' : stage === 2 ? '綠洲時代' : '生命時代'}</h2><p>PLANET ECOSYSTEM LIVE VIEW</p></div>
      <div class="scene-time">⏱ <span data-clock>${formatTime(s.remainingSeconds)}</span></div>
      ${planetWorld(s.structures, stage)}
      ${currentEvent ? `<span class="scene-event-emoji">${currentEvent.emoji}</span><div class="event-scene-label">${currentEvent.emoji} ${escapeHTML(currentEvent.name)} · <span data-event-seconds>${currentEvent.secondsLeft}s</span></div>` : ''}
      ${s.paused ? '<div class="scene-paused"><div><div style="font-size:42px">⏸️</div><h3>任務暫停中</h3><p>等待房主恢復</p></div></div>' : ''}
      ${s.phase === 'finished' ? `<div class="finish-ribbon"><div class="big">${s.result?.win ? '🏆' : '📘'}</div><h2>${escapeHTML(s.result?.title || '本局結束')}</h2><p>${escapeHTML(s.result?.description || '')}</p></div>` : ''}
      <div class="scene-scan">${currentEvent ? escapeHTML(currentEvent.description) : '✦ 每完成一個數學建造任務，星球就會增加一項設施。'}</div>
      <div class="scene-index">生態開發進度<br/><strong style="font-size:19px;color:#8ff1c9">${s.progress}%</strong></div>
      <div class="scene-footer"><div style="width:${s.progress}%"></div></div>
    </div>
    <div class="mini-stats"><div class="mini-stat card"><div class="stat-number">${s.buildingsTotal}</div><div class="stat-label">已建設設施</div></div><div class="mini-stat card"><div class="stat-number">${s.players.length}</div><div class="stat-label">探險家人數</div></div><div class="mini-stat card"><div class="stat-number">${Object.values(s.completed).filter(Boolean).length}<span style="color:#819ab6;font-size:15px">/3</span></div><div class="stat-label">工程種類</div></div></div>
    <div class="card scene-caption"><div><strong style="font-size:13px">🌌 ${s.phase === 'lobby' ? '航行準備中' : s.phase === 'finished' ? '任務結算' : s.event ? '宇宙危機處理中' : '正在建設星球'}</strong><p>${s.phase === 'lobby' ? '邀請學生登陸，再由房主開始任務。' : s.phase === 'finished' ? '可以檢查解題成果，並開啟新一局。' : s.event ? '所有學生都可以嘗試事件解答，正確一人即全隊成功。' : '不同學生可以同時進行森林、星環、地形修復任務。'}</p></div><div class="badge-big">${s.event ? s.event.emoji : '🪐'}</div></div>
  </section>`;
}

function feedbackHTML(fb, isEvent = false) {
  if (!fb) return '';
  const cl = fb.correct ? 'success' : 'error';
  return `<div class="feedback ${cl}" role="status"><strong>${fb.correct ? '✨ 答對了！' : '🧠 再想一想'}</strong>${escapeHTML(fb.message || '')}${fb.correct && fb.steps ? `<ol>${fb.steps.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ol>` : ''}${fb.correct && fb.stars ? `<div style="margin-top:7px">獲得 ⭐ ${fb.stars} 星能點數${isEvent ? '（全隊共享事件獎勵）' : ''}</div>` : ''}</div>`;
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
  return `<section class="card event-card"><div class="section-head"><h2>${e.emoji} ${escapeHTML(e.name)}</h2><span class="tag amber">剩餘 <span data-event-seconds>${e.secondsLeft}s</span></span></div><p class="event-description">${escapeHTML(e.description)}</p><div class="event-question">${escapeHTML(e.question)}</div>${s.role === 'student' && s.phase === 'playing' ? `<form id="event-answer-form" data-draft-key="${key}">${formulaHTML('event', draft.formula)}${answerFields(draft, true)}<button class="btn full" type="submit" ${s.paused ? 'disabled' : ''}>🛡️ 回答事件挑戰</button></form><div class="help-row"><span>💡 提示：${escapeHTML(e.hint)}</span></div>` : `<div class="feedback info"><strong>📖 教師提示</strong>${escapeHTML(e.hint)}<br/><br/>正確解法：${e.steps.map(escapeHTML).join(' → ')}</div>`}${feedbackHTML(eventFeedback, true)}</section>`;
}
function studentPanel(s) {
  if (s.phase === 'lobby') return `<section class="card waiting"><div class="big">🚀</div><h2>準備就緒，等待房主</h2><p>你已成功加入 <strong>${escapeHTML(s.code)}</strong> 房間！<br/>老師開始後，可以選擇森林、星環或地形修復任務。<br/>不同人數會採不同的完成目標。</p></section>`;
  if (s.phase === 'finished') return `<section class="card waiting"><div class="big">${s.result?.win ? '🏆' : '📘'}</div><h2>本局星球成果</h2><p>${escapeHTML(s.result?.description || '')}<br/>你完成 ${s.players.find(p => p.id === s.myId)?.correct || 0} 道題，獲得 ${s.players.find(p => p.id === s.myId)?.stars || 0} 點星能。<br/>等候老師開啟下一局，或離開房間。</p></section>`;
  const t = s.ownTask;
  if (!t) return `<div class="card waiting">請稍候，正在產生新任務...</div>`;
  const draft = drafts.get(`task:${t.id}`) || {};
  return `<section class="card role-intro"><span class="icon">👨‍🚀</span><div><h2>我的建造工作站</h2><p>三種工程可以自由切換，不受玩家人數限制。</p></div><span class="tag">+ 建造獎勵</span></section>
    ${eventPanel(s)}
    ${!s.event && eventFeedback?.correct ? `<section class="card" style="padding:17px 19px"><div class="section-head"><h2>✅ 上次事件的解題紀錄</h2></div>${feedbackHTML(eventFeedback, true)}</section>` : ''}
    <section class="card task-card"><div class="section-head"><h2>📐 數學建造任務</h2><span class="tag blue">π = 3.14</span></div><div class="task-tabs">${Object.entries(KINDS).map(([k, inf]) => `<button class="task-tab ${t.kind === k ? 'active' : ''}" data-action="selectTask" data-kind="${k}" ${s.paused ? 'disabled' : ''}><span class="emoji">${inf.emoji}</span>${inf.name}</button>`).join('')}</div>
    <div class="question-box"><div class="question-title">${KINDS[t.kind]?.emoji} ${escapeHTML(t.title)}</div><p class="question-text">${escapeHTML(t.question)}</p><div class="question-context">${escapeHTML(t.context)}</div></div>
    <div class="math-caption">✦ 你需要同時選對公式、算對數字及單位，才會完成建造。</div>
    <form id="task-answer-form" data-draft-key="task:${t.id}">${formulaHTML('task', draft.formula)}${answerFields(draft)}<div class="help-row"><span>難度：${s.difficulty === 'basic' ? '基礎' : s.difficulty === 'advanced' ? '挑戰' : '標準'}</span><button class="mini-btn" type="button" data-action="hint">💡 公式提示</button></div>${hintText ? `<div class="feedback info"><strong>💡 建造提示</strong>${escapeHTML(hintText)}</div>` : ''}<div class="task-actions"><button class="btn full" type="submit" ${s.paused ? 'disabled' : ''}>✨ 確認建造</button></div></form>
    ${feedbackHTML(feedback)}</section>`;
}
function teacherSettingsPanel(s) {
  return `<section class="card host-card"><div class="section-head"><h2>🎛️ 教師控制台</h2><span class="tag">房主專屬</span></div><div class="config-grid"><div class="field"><label>題目難度</label><select class="select-input" data-setting="difficulty"><option value="basic" ${s.difficulty === 'basic' ? 'selected' : ''}>基礎</option><option value="standard" ${s.difficulty === 'standard' ? 'selected' : ''}>標準</option><option value="advanced" ${s.difficulty === 'advanced' ? 'selected' : ''}>挑戰</option></select></div><div class="field"><label>每局時間</label><select class="select-input" data-setting="durationMinutes" ${s.phase !== 'lobby' ? 'disabled' : ''}>${[15, 25, 40].map(x => `<option value="${x}" ${s.durationMinutes === x ? 'selected' : ''}>${x} 分鐘</option>`).join('')}</select></div></div><label class="toggle-row"><input type="checkbox" data-setting="eventsEnabled" ${s.eventsEnabled ? 'checked' : ''}/>啟用自動隨機事件（每約 2 分鐘）</label>
    <div class="action-grid">${s.phase === 'lobby' ? `<button class="btn" data-action="start" ${s.players.length < 1 ? 'disabled' : ''}>▶ 開始任務</button>` : s.phase === 'playing' ? `<button class="btn secondary" data-action="pause">${s.paused ? '▶ 恢復' : '⏸ 暫停'}</button>` : `<button class="btn" data-action="reset">↺ 開啟新局</button>`}${s.phase === 'playing' ? '<button class="btn warn" data-action="finish">⏹ 結束本局</button>' : `<button class="btn secondary" data-action="copy">📋 複製房號</button>`}</div>
    <div class="divider"></div><div class="section-head"><h2>☄️ 宇宙事件演示</h2><span class="tag blue">手動觸發</span></div><div class="event-grid">${Object.entries(EVENT_NAMES).map(([key, name]) => `<button class="event-button" data-action="event" data-event-id="${key}" ${s.phase !== 'playing' || s.paused || s.event ? 'disabled' : ''}>${name}</button>`).join('')}</div>${s.event ? `<button style="margin-top:11px" class="btn secondary slim full" data-action="skipEvent">⏭ 略過事件（不扣分）</button>` : ''}
    <div class="host-notice" style="margin-top:14px">💡 <strong>小組平衡：</strong>本局 ${s.startingPlayers || s.players.length || 1} 人，目標建造 <strong>${s.requiredBuildings}</strong> 項並完成三種工程。事件由任一學生答對即可解除，失敗僅輕度扣資源。</div></section>`;
}
function teacherReport(s) {
  return `<section class="card host-card"><div class="section-head"><h2>📊 學生作答統計</h2><button class="mini-btn" data-action="export">⬇ CSV</button></div><table class="class-table"><thead><tr><th>學生</th><th class="num">答對 / 作答</th><th class="num">提示</th><th class="num">錯誤</th></tr></thead><tbody>${s.players.map(p => `<tr><td>${escapeHTML(p.name)}</td><td class="num">${p.correct} / ${p.answered}</td><td class="num">${p.hints ?? 0}</td><td class="num">${Object.values(p.mistakes || {}).reduce((a, b) => a + b, 0)}</td></tr>`).join('') || '<tr><td colspan="4">尚無學生</td></tr>'}</tbody></table><p class="footnote">錯誤統計包含公式錯誤、計算錯誤、單位錯誤；下載 CSV 可查看明細。</p></section>`;
}
function hostPanel(s) {
  return `<section class="card role-intro"><span class="icon">👩‍🏫</span><div><h2>${escapeHTML(s.hostName)}的指揮中心</h2><p>房主不占學生名額，可管理教學節奏與宇宙事件。</p></div></section>${eventPanel(s)}${teacherSettingsPanel(s)}${teacherReport(s)}${s.phase === 'lobby' ? `<section class="card waiting"><div class="big">🪐</div><h2>等待探險家登陸</h2><p>目前 ${s.players.length} 人進入房間。<br/>最少 1 人就能開始；沒有固定職業分工。<br/>任務開啟前可以自由調整難度與時間。</p><div class="room-badge">${escapeHTML(s.code)}</div></section>` : ''}`;
}
function renderGame(s) {
  return `<div class="container"><header class="site-header"><div class="brand"><span class="brand-icon">🌍</span><span><div class="brand-title">星球綠化造物主</div><div class="brand-sub">PLANET MAKER · MATH LAB</div></span></div><div class="header-right"><span class="small-pill" data-connection><span class="online-dot ${connectionLive ? '' : 'off'}"></span> ${connectionLive ? '連線正常' : '連線中'}</span><button class="ghost-btn" data-action="leave">↩ 離開房間</button></div></header>
    <div class="game-top"><div><div class="eyebrow">${s.role === 'host' ? 'MISSION COMMAND · 房主視角' : 'EXPLORER MODE · 學生視角'}</div><div class="room-title">${s.phase === 'finished' ? '星球任務成果' : '打造我們的綠色星球'}</div></div><div class="top-actions"><span class="small-pill">房間 <strong class="room-code">${escapeHTML(s.code)}</strong></span><button class="mini-btn" data-action="copy" aria-label="複製房間代碼">⧉ 複製</button><span class="small-pill">👥 ${s.players.length}/${s.maxPlayers} 學生</span><span class="tag ${s.paused ? 'amber' : s.phase === 'playing' ? '' : 'blue'}">${s.paused ? '已暫停' : s.phase === 'lobby' ? '等待開始' : s.phase === 'playing' ? '進行中' : '已結束'}</span></div></div>
    <main class="game-layout"><aside class="sidebar">${resourcesPanel(s)}${goalsPanel(s)}${playersPanel(s)}${historyPanel(s)}</aside>${planetPanel(s)}<aside class="work-panel">${s.role === 'host' ? hostPanel(s) : studentPanel(s)}<div class="rule-card"><strong>📚 數學規則</strong><ul><li>統一採用圓周率 π = 3.14。</li><li>周長是長度（km），面積是平方單位（km²）。</li><li>每人都能完成三種工程，並可同時作答。</li><li>事件答對一人就能幫助全隊；提示不影響通關。</li></ul></div></aside></main><footer class="footer">星球綠化造物主 v1.0 · 小學六年級數學課堂合作遊戲 · 本版進度僅保存在運行中的伺服器記憶體</footer></div>`;
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
  const lines = [['暱稱','答題總數','正確數','使用提示','公式錯誤','計算錯誤','單位錯誤','星能分數'], ...s.players.map(p => [p.name, p.answered, p.correct, p.hints, p.mistakes?.formula || 0, p.mistakes?.value || 0, p.mistakes?.unit || 0, p.stars])];
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
  if (form.id === 'task-answer-form') {
    const formula = form.querySelector('[name=formula]:checked')?.value ?? '';
    const answer = form.querySelector('[name=answer]').value;
    const unit = form.querySelector('[name=unit]').value;
    const taskId = state?.ownTask?.id;
    if (!formula) return toast('請先選擇計算公式', true);
    return action('answer', { taskId, formula, answer, unit });
  }
  if (form.id === 'event-answer-form') {
    const formula = form.querySelector('[name=formula]:checked')?.value ?? '';
    const answer = form.querySelector('[name=answer]').value;
    const unit = form.querySelector('[name=unit]').value;
    if (!formula) return toast('請先選擇事件計算公式', true);
    return action('eventAnswer', { formula, answer, unit });
  }
});
root.addEventListener('input', event => {
  const el = event.target;
  const form = el.closest('[data-draft-key]');
  if (!form) return;
  const key = form.dataset.draftKey;
  const draft = drafts.get(key) || {};
  if (el.name) draft[el.name] = el.value;
  drafts.set(key, draft);
});
root.addEventListener('change', event => {
  const el = event.target;
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
  if (name === 'reset' && !confirm('確定重設本局？原有建築和作答統計將會清空。')) return;
  if (name === 'finish' && !confirm('確定結束本局？')) return;
  if (name === 'removePlayer' && !confirm('確定將這位學生移出房間？')) return;
  if (name === 'selectTask') return action(name, { kind: button.dataset.kind });
  if (name === 'event') return action(name, { eventId: button.dataset.eventId });
  if (name === 'removePlayer') return action(name, { playerId: button.dataset.playerId });
  return action(name);
});

render();
resume();
