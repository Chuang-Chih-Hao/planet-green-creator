// 個人計算紙僅存在瀏覽器，不會透過 SSE、API 或教師投影分享。
export function createScratchpad(getState) {
  const layer=document.createElement('div');
  layer.className='scratch-overlay';
  layer.hidden=true;
  layer.innerHTML='<section class="scratch-dialog" role="dialog" aria-modal="true" aria-label="數學計算紙">'
    +'<div class="scratch-head"><div><strong>✏️ 數學計算紙</strong><p>用滑鼠、觸控筆或手指書寫；計算紙只保留在你的裝置。</p></div><button type="button" class="scratch-close" data-scratch-tool="close" aria-label="關閉計算紙">×</button></div>'
    +'<div class="scratch-question"><span>📌 當前題目</span><p data-scratch-question></p></div>'
    +'<div class="scratch-tools"><button type="button" data-scratch-tool="pen" class="selected">🖊️ 畫筆</button><button type="button" data-scratch-tool="eraser">🧽 橡皮擦</button><button type="button" data-scratch-tool="clear">🗑️ 清空</button><span>單位提醒：長度 km · 面積 km²</span></div>'
    +'<canvas class="scratch-canvas" width="1000" height="560" aria-label="可手寫的空白計算紙"></canvas>'
    +'<div class="scratch-footer"><span>寫完可關閉計算紙再回題目作答</span><button type="button" data-scratch-tool="close" class="scratch-done">返回題目</button></div>'
    +'</section>';
  document.body.append(layer);
  const canvas=layer.querySelector('canvas');
  const ctx=canvas.getContext('2d');
  const question=layer.querySelector('[data-scratch-question]');
  let activeMode='task',activeKey='',drawing=false,eraser=false;
  function current() {
    const s=getState();
    if(activeMode==='event' && s?.event)
      return {key:'event:'+s.event.startedAt,question:s.event.question};
    if(activeMode==='event') return null;
    const t=s?.ownTask;
    return t?{key:'task:'+t.id,question:t.question}:null;
  }
  function refresh() {
    if(layer.hidden)return;
    const t=current();
    if(!t){close();return;}
    question.textContent=t.question;
    if(t.key!==activeKey){activeKey=t.key;ctx.clearRect(0,0,canvas.width,canvas.height);}
  }
  function open(mode='task'){
    activeMode=mode==='event'?'event':'task';
    layer.hidden=false;
    refresh();
    layer.querySelector('.scratch-close').focus();
  }
  function close(){layer.hidden=true;drawing=false;}
  function position(e){
    const box=canvas.getBoundingClientRect();
    return {x:(e.clientX-box.left)*canvas.width/box.width,y:(e.clientY-box.top)*canvas.height/box.height};
  }
  function start(e){
    if(e.button!==0 && e.pointerType==='mouse')return;
    e.preventDefault();
    drawing=true;
    canvas.setPointerCapture(e.pointerId);
    const p=position(e);
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.lineWidth=eraser?40:4;
    ctx.strokeStyle=eraser?'#ffffff':'#223653';
    ctx.globalCompositeOperation=eraser?'destination-out':'source-over';
    ctx.lineTo(p.x+.15,p.y+.15);
    ctx.stroke();
  }
  function move(e){
    if(!drawing)return;
    e.preventDefault();
    const p=position(e);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
  }
  function end(){drawing=false;ctx.closePath();ctx.globalCompositeOperation='source-over';}
  canvas.addEventListener('pointerdown',start);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',end);
  canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('lostpointercapture',end);
  layer.addEventListener('click',e=>{
    if(e.target===layer){close();return;}
    const b=e.target.closest('[data-scratch-tool]');
    if(!b)return;
    const type=b.dataset.scratchTool;
    if(type==='close')return close();
    if(type==='clear'){ctx.clearRect(0,0,canvas.width,canvas.height);return;}
    if(type==='pen'||type==='eraser'){
      eraser=type==='eraser';
      for(const item of layer.querySelectorAll('[data-scratch-tool]'))item.classList.toggle('selected',item.dataset.scratchTool===type);
    }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!layer.hidden)close();});
  return {open,refresh,close};
}
