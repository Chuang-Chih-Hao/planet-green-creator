// V1.6: full-width shared minigame UI, automatically presented between math segments.
const h = v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const disabled=(s,g)=>s.paused||s.role!=='student'||!g.myTurn;
function actionButton(s,g,text,opts={}) {
 const props=' data-action="teamMove" data-team-game="'+h(g.id)+'"';
 const move=opts.move?' data-team-move="'+h(opts.move)+'"':'';
 const index=Number.isInteger(opts.index)?' data-team-index="'+opts.index+'"':'';
 const off=disabled(s,g)||opts.off;
 const staticOff=opts.off?' data-team-static-off="true"':'';
 return '<button type="button" class="'+(opts.cls||'coop-button')+'"'+props+move+index+staticOff+(off?' disabled':'')+'>'+text+'</button>';
}
function body(s,g){
 if(g.kind==='memory'){
  const total=g.length,step=g.step+1;
  const preview='<div class="coop-memory-sequence" aria-label="全隊合作序列進度">'
   +Array.from({length:total},(_,i)=>'<span class="'+(i<g.step?'passed':i===g.step?'current':'')+'" title="第'+(i+1)+'格">'+(i<g.step?'✓':i===g.step?'➤':'?')+'</span>').join('')+'</div>';
  const mine=g.myClues||[];
  const clueCards=mine.length?mine.map(c=>'<div class="coop-private-clue"><span class="coop-clue-index">第 '+c.position+' 格</span><strong>'+c.icon+' '+h(c.name)+'</strong></div>').join(''):'<p class="coop-no-clue">老師的畫面不顯示答案。請學生在各自畫面查看所持線索。</p>';
  const solo=g.teammates.length===1;
  const guide=solo?'單人練習：你能看到所有位置的線索，照著順序逐格完成。'
    :'每位學生只會看到自己負責的兩張線索。<strong>不要盲猜！</strong>持有線索的同學必須先口頭告訴操作員，再由輪到的人點選。';
  return '<div class="coop-instructions"><strong>🌱 線索接力：大家拼出完整順序</strong><p>① 查看自己的「私人線索」　② 由掌握第 '+step+' 格的人念出符號　③ 輪到的人在下方按相同符號</p><p>'+guide+'</p></div>'
    +'<div class="coop-memory-guide"><div><span>目前做到</span><strong>第 '+step+' / '+total+' 格</strong></div><div><span>這一格線索在誰手上？</span><strong>'+h(g.clueHolderName||'隊友')+'</strong></div><div><span>誰負責點選？</span><strong>'+h(g.turnName)+'</strong></div></div>'
    +preview
    +'<div class="coop-personal-clues"><div class="coop-clue-heading"><strong>🔐 '+(s.role==='student'?'只有你看得到的線索':'學生各自持有線索')+'</strong><small>每一格都有確定答案，請把資訊說給隊友聽</small></div><div class="coop-private-cards">'+clueCards+'</div></div>'
    +'<p class="coop-meter">已完成 '+g.step+' 格／共 '+total+' 格 · 目前猜錯 '+g.mistakes+' 次（可以重試，不扣資源）</p>'
    +'<div class="coop-pads">'+g.pads.map((p,i)=>actionButton(s,g,'<span>'+p.icon+'</span><strong>'+h(p.name)+'</strong>',{index:i,cls:'coop-pad pad-'+i})).join('')+'</div>';
 }
 if(g.kind==='pulse'){
  const left=Math.round(g.targetRange[0]*100),width=Math.round((g.targetRange[1]-g.targetRange[0])*100);
  return '<div class="coop-instructions"><strong>🎯 光標進入綠區時點擊充能</strong><p>每位隊友輪流抓準時機。按得太早或太晚不會成功，可以再等下一圈。</p></div>'
  +'<div class="coop-charge-count"><strong>⚡ '+g.charges+' / '+g.goal+'</strong><span>能量成功鎖定次數</span></div>'
  +'<div class="coop-pulse-track"><div class="coop-pulse-target" style="left:'+left+'%;width:'+width+'%"></div><div class="coop-pulse-cursor" data-pulse-cursor></div></div>'
  +'<div class="coop-pulse-axis"><span>起點</span><span>綠色區間＝正確時機</span><span>終點</span></div>'
  +actionButton(s,g,'⚡ 光標到綠區，立即充能',{move:'charge',cls:'coop-pulse-button'});
 }
 if(g.kind==='pipe'){
  const tiles=g.cells.map((c,i)=>actionButton(s,g,'<span class="pipe-center"></span>'+c.ports.map(d=>'<span class="pipe-arm pipe-'+d.toLowerCase()+'"></span>').join(''),{index:i,cls:'pipe-tile '+(c.flowing?'flowing':'')})).join('');
  return '<div class="coop-instructions"><strong>💧 全隊輪流旋轉水管</strong><p>讓水從左上角左側流入，再從右下角右側流出。已接通的水道會亮起藍光。</p></div>'
   +'<div class="pipeline-shell coop-pipeline"><span class="pipe-endpoint start">💧 入口 →</span><div class="pipe-grid">'+tiles+'</div><span class="pipe-endpoint end">→ 🌱 出口</span></div>'
   +'<p class="coop-meter">全隊已旋轉 '+g.moves+' 次 · 請觀察水流方向，再交給下一位。</p>';
 }
 if(g.kind==='rover'){
  const tiles=g.map.map((v,i)=>'<div class="coop-maze-cell '+(v==='wall'?'wall':'open')+(i===g.position?' rover':'')+(i===g.goal?' destination':'')+'">'
   +(i===g.position?'🚜':i===g.goal?'🏠':v==='wall'?'🪨':'')+'</div>').join('');
  return '<div class="coop-instructions"><strong>🚜 救援車需要大家共同導航</strong><p>左上角出發，移動至右下角基地，碰到岩石要換路。每一次移動交給不同隊友操作。</p></div>'
   +'<div class="coop-maze-grid">'+tiles+'</div><div class="coop-direction-pad">'
   +actionButton(s,g,'↑',{move:'N',cls:'coop-direction up'})
   +'<div>'+actionButton(s,g,'←',{move:'W',cls:'coop-direction'})
   +actionButton(s,g,'↓',{move:'S',cls:'coop-direction'})
   +actionButton(s,g,'→',{move:'E',cls:'coop-direction'})+'</div></div>'
   +'<p class="coop-meter">已移動 '+g.moves+' 步 · 一起規劃救援車路線</p>';
 }
 if(g.kind==='defense'){
  const labels=['左側','中央','右側'];
  const lanes=labels.map((label,i)=>actionButton(s,g,'<span class="coop-lane-title">'+label+'航道</span>'
    +(i===g.lane?'<span class="coop-meteor">☄️</span>':'<span class="coop-lane-space">✦</span>')
    +'<span class="coop-shield">🛡️ 點擊防護</span>',{index:i,cls:'coop-lane '+(i===g.lane?'threat':'')})).join('');
  return '<div class="coop-instructions"><strong>☄️ 觀察隕石位置，快速選對護盾</strong><p>一位隊友負責操作、其他人找方向；未攔截會讓穩定度下降，但可以繼續努力。</p></div>'
   +'<div class="coop-defense-stats"><span>攔截 '+g.hits+' / '+g.goal+'</span><span>下一次撞擊：<strong data-defense-clock></strong></span><span>漏接 '+g.misses+' 次</span></div>'
   +'<div class="coop-lanes">'+lanes+'</div>';
 }
 if(g.kind==='mosaic'){
  const empty=g.tiles.indexOf(0);
  const neighbors=[empty-3,empty+3,...(empty%3?[empty-1]:[]),...(empty%3!==2?[empty+1]:[])].filter(i=>i>=0&&i<9);
  const tiles=g.tiles.map((tile,i)=>tile===0?'<div class="coop-mosaic-tile empty" aria-label="空白格"></div>'
   :actionButton(s,g,'<span>✦</span><strong>'+tile+'</strong>',{index:i,cls:'coop-mosaic-tile '+(neighbors.includes(i)?'movable':'locked'),off:!neighbors.includes(i)})).join('');
  return '<div class="coop-instructions"><strong>🪐 團隊共同修復星圖</strong><p>輪流點擊空白格旁的碎片，把數字依序排成 1、2、3／4、5、6／7、8、空白。</p></div>'
   +'<div class="coop-mosaic-grid">'+tiles+'</div><p class="coop-meter">已滑動 '+g.moves+' 次 · 請和隊友討論下一步</p>';
 }
 return '';
}
export function teamGameHTML(s){
 const g=s.teamGame;
 if(!g)return '';
 const control=s.role==='host'?'老師正在觀看全隊操作':g.myTurn?'輪到你操作！':'輪到 '+h(g.turnName)+' 操作，請用口頭協助';
 const collaborators=g.teammates.map(p=>'<span class="coop-member '+(p.id===g.turnPlayerId?'active':'')+' '+(p.acted?'acted':'')+'">'+(p.acted?'✓ ':'👨‍🚀 ')+h(p.name)+'</span>').join('');
 return '<section class="coop-card card" aria-label="全隊合作小遊戲"><div class="coop-top"><div><span class="coop-eyebrow">TEAM MISSION · 第 '+g.stage+' 關 · 小遊戲 '+g.index+'/'+g.total+'</span><h2>'+h(g.title)+'</h2><p>'+h(g.description)+'</p></div><span class="coop-status">🤝 全隊合作中</span></div>'
  +'<div class="coop-teammates">'+collaborators+'</div>'
  +'<div class="coop-turn '+(g.myTurn?'your-turn':'')+'">'+control+(s.paused?' · ⏸️ 已暫停':'')+'<small>若輪到的同學離線或超過 12 秒未操作，其他隊友可以協助。</small></div>'
  +'<div class="coop-playfield">'+body(s,g)+'</div><div class="coop-feedback" role="status">'+h(g.message||'請全隊互相提醒並依序完成操作。')+'</div>'
  +'</section>';
}
export function updateTeamClocks(s){
 if(!s?.teamGame)return;
 const g=s.teamGame,time=s.paused&&s.pausedAt?s.pausedAt:Date.now();
 if(s.role==='student'&&!s.paused){
   const canPlay=g.myTurn||time-g.turnAt>12000;
   document.querySelectorAll('[data-action="teamMove"]').forEach(node=>{node.disabled=!canPlay||node.dataset.teamStaticOff==='true';});
 }
 if(g.kind==='memory'){
  const remaining=Math.max(0,Math.ceil((g.revealUntil-time)/1000));
  document.querySelectorAll('[data-memory-clock]').forEach(n=>n.textContent=remaining+' 秒');
 }
 if(g.kind==='pulse'){
  const phase=((time-g.startedAt)%g.cycleMs+g.cycleMs)%g.cycleMs/g.cycleMs;
  document.querySelectorAll('[data-pulse-cursor]').forEach(n=>n.style.left=(phase*100)+'%');
 }
 if(g.kind==='defense'){
  const remaining=Math.max(0,Math.ceil((g.deadlineAt-time)/1000));
  document.querySelectorAll('[data-defense-clock]').forEach(n=>n.textContent=remaining+' 秒');
 }
}
