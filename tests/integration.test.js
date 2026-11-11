import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
after(()=>server.close());
async function post(endpoint,body){
 const response=await fetch(base+'/api/'+endpoint,{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 });
 return {status:response.status,...await response.json()};
}
async function state(token){
 return (await (await fetch(base+'/api/state?token='+encodeURIComponent(token))).json()).state;
}
async function doTask(host,student,kind){
 const choose=await post('action',{token:student,action:'selectTask',kind});
 assert.equal(choose.status,200);
 const p=(await state(host)).players.find(p=>p.id===choose.state.myId);
 const revealed=await post('action',{token:host,action:'revealAnswer',playerId:p.id,taskId:p.task.id});
 assert.equal(revealed.status,200);
 await new Promise(resolve=>setTimeout(resolve,480));
 const fb=revealed.feedback;
 return post('action',{token:student,action:'answer',taskId:p.task.id,answer:fb.answer,formula:fb.formula,unit:fb.unit});
}
test('首頁、共享合作遊戲 UI、數學計算紙與健康檢查可讀取',async()=>{
 for(const path of ['/','/app.js','/team-ui.js','/scratchpad.js','/style.css','/api/health']){
  const response=await fetch(base+path);
  assert.equal(response.status,200,path);
 }
});
test('一房可加入最多五位學生，房主無法代做學生小遊戲',async()=>{
 const host=await post('create',{name:'教室教師'});
 const players=[];
 for(let i=0;i<5;i++){
  const student=await post('join',{name:'學生'+(i+1),code:host.state.code});
  assert.equal(student.status,200);players.push(student);
 }
 assert.equal((await post('join',{name:'第六位',code:host.state.code})).status,400);
 const start=await post('action',{token:host.token,action:'start'});
 assert.equal(start.status,200);assert.equal(start.state.stage,1);assert.equal(start.state.requiredBuildings,20);
 const unauthorized=await post('action',{token:players[0].token,action:'skipTeamGame'});
 assert.equal(unauthorized.status,403);
});
test('數學一個段落後直接進入合作遊戲，不用從活動選單選擇',async()=>{
 const host=await post('create',{name:'闖關教師'});
 const p=await post('join',{name:'學生',code:host.state.code});
 await post('action',{token:host.token,action:'settings',durationMinutes:15,eventsEnabled:false});
 await post('action',{token:host.token,action:'start'});
 let result=await doTask(host.token,p.token,'forest');
 assert.equal(result.status,200);assert.equal(result.state.stage,1);
 result=await doTask(host.token,p.token,'power');
 assert.equal(result.status,200);
 assert.equal(result.state.stage,1,'不可以只靠數學建造進入下一段');
 assert.equal(result.state.teamGame.kind,'memory');
 assert.equal(result.state.teamGame.index,1);
 assert.equal(result.state.teamGame.total,2);
 assert.equal((await post('action',{token:p.token,action:'selectTask',kind:'forest'})).status,400);
 assert.equal((await post('action',{token:host.token,action:'teamMove',gameId:result.state.teamGame.id,index:0})).status,403);
 assert.equal((await post('action',{token:p.token,action:'teamMove',gameId:'old-game',index:0})).status,400);
 assert.equal((await post('action',{token:p.token,action:'explore',index:0})).status,400,'舊工作站選項已停用');
 const first=await post('action',{token:host.token,action:'skipTeamGame'});
 assert.equal(first.status,200);assert.equal(first.state.teamGame.kind,'pulse');
 const second=await post('action',{token:host.token,action:'skipTeamGame'});
 assert.equal(second.status,200);assert.equal(second.state.stage,2);
 assert.equal(second.state.teamGame,null);
 assert.equal(second.state.teamGamesCompleted[1],2);
});
test('合作小遊戲中教師可暫停並恢復、不能觸發事件題目',async()=>{
 const h=await post('create',{name:'節奏控制教師'});
 const p=await post('join',{name:'玩家',code:h.state.code});
 await post('action',{token:h.token,action:'settings',durationMinutes:15});
 await post('action',{token:h.token,action:'start'});
 await doTask(h.token,p.token,'forest');
 await doTask(h.token,p.token,'power');
 const before=await state(h.token);
 assert.equal(before.teamGame.kind,'memory');
 const paused=await post('action',{token:h.token,action:'pause'});
 assert.equal(paused.state.paused,true);
 assert.equal((await post('action',{token:p.token,action:'teamMove',gameId:before.teamGame.id,index:0})).status,400);
 const resumed=await post('action',{token:h.token,action:'pause'});
 assert.equal(resumed.state.paused,false);
 assert.equal((await post('action',{token:h.token,action:'event',eventId:'flare'})).status,400);
});
test('結束後保留三道數學回顧，教師個別揭露詳情，不會流入學生 SSE',async()=>{
 const h=await post('create',{name:'回顧教師'}),p=await post('join',{name:'學生',code:h.state.code});
 await post('action',{token:h.token,action:'start'});
 assert.equal((await post('action',{token:p.token,action:'submitReview',answers:{}})).status,400);
 const end=await post('action',{token:h.token,action:'finish'});
 assert.equal(end.state.phase,'finished');
 const review=(await state(p.token)).ownReview;
 assert.equal(review.questions.length,3);assert.equal(review.questions[0].answer,undefined);
 const answers=Object.fromEntries(review.questions.map(q=>[q.id,'0']));
 const submit=await post('action',{token:p.token,action:'submitReview',answers,reflection:'還要複習圓環',confidence:'review'});
 assert.equal(submit.status,200);
 const teacher=await state(h.token);
 assert.equal(teacher.players[0].reviewSubmitted,true);
 assert.equal(teacher.players[0].reviewResults,undefined);
 assert.equal((await post('action',{token:p.token,action:'revealReview',playerId:teacher.players[0].id})).status,403);
 const details=await post('action',{token:h.token,action:'revealReview',playerId:teacher.players[0].id});
 assert.equal(details.status,200);assert.equal(details.feedback.results.length,3);
 const reset=await post('action',{token:h.token,action:'reset'});
 assert.equal(reset.state.stage,1);assert.equal(reset.state.progress,0);
 assert.equal(reset.state.teamGame,null);
});
test('SSE 會同步房間加入與協作狀態，並保護個人資料',async()=>{
 const h=await post('create',{name:'即時教師'});
 const controller=new AbortController();
 const stream=await fetch(base+'/api/stream?token='+encodeURIComponent(h.token),{signal:controller.signal});
 const reader=stream.body.getReader();
 let message='';
 try {
  const first=await reader.read();
  message+=new TextDecoder().decode(first.value||new Uint8Array());
  assert.match(message,/event: state/);
  await post('join',{name:'連線學生',code:h.state.code});
  const from=Date.now();
  while(!message.includes('連線學生')&&Date.now()-from<1600){
   const next=await reader.read();if(next.done)break;
   message+=new TextDecoder().decode(next.value);
  }
  assert.match(message,/連線學生/);
 } finally {controller.abort();}
});
