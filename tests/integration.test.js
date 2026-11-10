import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
after(()=>server.close());
async function post(endpoint,body){
 const response=await fetch(base+'/api/'+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 return {status:response.status,...await response.json()};
}
async function state(token){return (await (await fetch(base+'/api/state?token='+encodeURIComponent(token))).json()).state;}
async function doTask(host,student,kind){
 const chosen=await post('action',{token:student,action:'selectTask',kind});
 assert.equal(chosen.status,200);
 const p=(await state(host)).players.find(p=>p.id===chosen.state.myId);
 const reveal=await post('action',{token:host,action:'revealAnswer',playerId:p.id,taskId:p.task.id});
 assert.equal(reveal.status,200);
 return post('action',{token:student,action:'answer',taskId:p.task.id,formula:reveal.feedback.formula,answer:reveal.feedback.answer,unit:reveal.feedback.unit});
}
test('首頁、星球動畫前端、個人計算紙與 health 端點可載入',async()=>{
 for(const path of ['/','/app.js','/scratchpad.js','/style.css','/favicon.svg','/api/health']){
  const res=await fetch(base+path);assert.equal(res.status,200,path);
 }
});
test('教師一房可帶四人或五人、第五人後無法加入更多；不再提供模式選單',async()=>{
 const created=await post('create',{name:'數學老師'}),students=[];
 assert.equal(created.status,200);
 for(let i=0;i<4;i++) students.push(await post('join',{name:'學生'+i,code:created.state.code}));
 const began=await post('action',{token:created.token,action:'start'});
 assert.equal(began.state.startingPlayers,4);
 assert.equal(began.state.stage,1);
 assert.equal(began.state.requiredBuildings,32);
 const fifth=await post('join',{name:'補位',code:created.state.code});
 assert.equal(fifth.status,200);
 assert.equal((await post('join',{name:'第六位',code:created.state.code})).status,400);
 const settings=await post('action',{token:created.token,action:'settings',gameMode:'survival'});
 assert.equal(settings.state.gameMode,undefined);
 assert.equal(settings.state.stage,1);
 assert.equal((await post('action',{token:students[0].token,action:'pause'})).status,403);
});
test('漏選單位會提供專門提醒，不算答錯；教師可以選擇顯示答案',async()=>{
 const host=await post('create',{name:'單位測試教師'});
 const student=await post('join',{name:'小明',code:host.state.code});
 await post('action',{token:host.token,action:'start'});
 const t=(await state(student.token)).ownTask;
 assert.equal(t.answer,undefined);
 const hostInfo=(await state(host.token)).players[0];
 assert.equal(hostInfo.task.answer,undefined);
 const denied=await post('action',{token:student.token,action:'revealAnswer',playerId:hostInfo.id});
 assert.equal(denied.status,403);
 const revealed=await post('action',{token:host.token,action:'revealAnswer',playerId:hostInfo.id,taskId:t.id});
 assert.equal(revealed.status,200);
 const missing=await post('action',{token:student.token,action:'answer',taskId:t.id,formula:revealed.feedback.formula,answer:revealed.feedback.answer,unit:''});
 assert.equal(missing.feedback.reason,'missingUnit');
 assert.match(missing.feedback.message,/單位/);
 assert.equal(missing.state.players[0].answered,0);
 const done=await post('action',{token:student.token,action:'answer',taskId:t.id,formula:revealed.feedback.formula,answer:revealed.feedback.answer,unit:revealed.feedback.unit});
 assert.equal(done.feedback.correct,true);
 assert.equal(done.state.players[0].answered,1);
});
test('單人也能連續通過前兩關，第三關有劇情危機；事件答案只有老師能揭露',async()=>{
 const h=await post('create',{name:'闖關教師'}),p=await post('join',{name:'玩家',code:h.state.code});
 await post('action',{token:h.token,action:'settings',durationMinutes:15,eventsEnabled:false});
 await post('action',{token:h.token,action:'start'});
 let result=await doTask(h.token,p.token,'forest');assert.equal(result.state.stage,1);
 result=await doTask(h.token,p.token,'power');assert.equal(result.state.stage,2);
 result=await doTask(h.token,p.token,'crater');
 assert.equal(result.state.stage,3);
 assert.equal(result.state.event.id,'flare');
 assert.equal(result.state.event.answer,undefined);
 const no=await post('action',{token:p.token,action:'revealAnswer',scope:'event'});
 assert.equal(no.status,403);
 const answer=await post('action',{token:h.token,action:'revealAnswer',scope:'event'});
 assert.equal(answer.status,200);
 const eventDone=await post('action',{token:p.token,action:'eventAnswer',formula:answer.feedback.formula,answer:answer.feedback.answer,unit:answer.feedback.unit});
 assert.equal(eventDone.feedback.correct,true);
 assert.equal(eventDone.state.stageChallengesResolved,1);
});
test('結束後可完成三道數學複習，教師收到成績和文字回饋並可重開',async()=>{
 const h=await post('create',{name:'課後老師'}),p=await post('join',{name:'學生',code:h.state.code});
 await post('action',{token:h.token,action:'start'});
 assert.equal((await post('action',{token:p.token,action:'submitReview',answers:{}})).status,400,'未結束時不能提交');
 const end=await post('action',{token:h.token,action:'finish'});
 assert.equal(end.state.phase,'finished');
 const review=(await state(p.token)).ownReview;
 assert.equal(review.questions.length,3);assert.equal(review.questions[0].answer,undefined);
 const answers=Object.fromEntries(review.questions.map(q=>[q.id,'0']));
 const submit=await post('action',{token:p.token,action:'submitReview',answers,confidence:'review',reflection:'我還需要練習圓環面積'});
 assert.equal(submit.status,200);
 assert.equal(submit.state.ownReview.submitted,true);
 assert.equal(submit.state.ownReview.result.total,3);
 assert.ok(submit.state.ownReview.result.results[0].explanation);
 const teacher=await state(h.token);
 assert.equal(teacher.players[0].reviewSubmitted,true);
 assert.match(teacher.players[0].reviewReflection,/圓環面積/);
 const reset=await post('action',{token:h.token,action:'reset'});
 assert.equal(reset.state.stage,1);
 assert.equal(reset.state.progress,0);
});
test('SSE 房間狀態會即時同步學生加入',async()=>{
 const h=await post('create',{name:'同步老師'});
 const ctrl=new AbortController();
 const res=await fetch(base+'/api/stream?token='+encodeURIComponent(h.token),{signal:ctrl.signal});
 const reader=res.body.getReader();
 let textValue='';
 try{
  const read=await reader.read();textValue+=new TextDecoder().decode(read.value||new Uint8Array());
  assert.match(textValue,/event: state/);
  await post('join',{name:'即時玩家',code:h.state.code});
  const started=Date.now();
  while(!textValue.includes('即時玩家')&&Date.now()-started<1500){
   const next=await reader.read();if(next.done)break;
   textValue+=new TextDecoder().decode(next.value);
  }
  assert.match(textValue,/即時玩家/);
 }finally{ctrl.abort();}
});
