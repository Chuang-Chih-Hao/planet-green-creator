// V1.6: six sequential, shared-control cooperative minigames.
// No question-answer choices or stand-alone activity menus are required.
import { randomUUID } from 'node:crypto';
import { makePipeline, isPipelineSolved } from './adventure.js';

export const TEAM_GAMES={
  1:['memory','pulse'],
  2:['pipe','rover'],
  3:['defense','mosaic']
};
const INFO={
  memory:{title:'🌱 生命核心・線索接力',hint:'每人只會看到自己負責的 2 個位置線索。持有第 N 格線索的同學口頭告訴操作員符號，操作員再按下對應節點。'},
  pulse:{title:'⚡ 光能共振・節奏校準',hint:'觀察正在移動的能量光標。每次輪到一位隊友，光標進入綠區時按下充能。'},
  pipe:{title:'💧 修復水道・旋轉水管',hint:'合作轉動水管，把左上入口連到右下出口，讓水循環恢復。'},
  rover:{title:'🚜 救援車・迷宮導航',hint:'每人輪流控制救援車方向，避開障礙，抵達星球另一端的基地。'},
  defense:{title:'☄️ 隕石攔截・聯手防護',hint:'看清隕石會落在哪條航道，輪流點擊相同航道的護盾，在倒數結束前攔截。'},
  mosaic:{title:'🪐 星圖修復・滑動拼圖',hint:'點擊空格旁邊的星圖碎片，把 1 到 8 依序排好，完成星球防護圖。'}
};
const PADS=[
 {icon:'🌱',name:'生態'},
 {icon:'⚡',name:'能源'},
 {icon:'💧',name:'水源'},
 {icon:'🛰️',name:'防護'}
];
const DIRS=['N','E','S','W'],OPP={N:'S',E:'W',S:'N',W:'E'},OFFSET={N:-3,E:1,S:3,W:-1};
const rewards={
 memory:{oxygen:8,energy:3},pulse:{energy:9},pipe:{water:14,stability:5},
 rover:{water:6,stability:6},defense:{stability:12,energy:4},mosaic:{oxygen:6,stability:10}
};
const now=()=>Date.now(),rand=max=>Math.floor(Math.random()*max);
function member(room,g){
 if(!room.players.length)return null;
 return room.players[g.turnIndex%room.players.length];
}
function who(room,g,player){
 const selected=member(room,g);
 return !selected ||selected.id===player.id || !selected.connected || now()-g.turnAt>12000;
}
function ports(c){
 return (c.kind==='straight'?['N','S']:['N','E']).map(d=>DIRS[(DIRS.indexOf(d)+c.rotation)%4]);
}
function pipeFlow(pipe){
 const flow=new Set();
 if(!ports(pipe.cells[0]).includes('W'))return flow;
 const q=[0];flow.add(0);
 for(let k=0;k<q.length;k++){
  const i=q[k];
  for(const dir of ports(pipe.cells[i])){
   if(i===0&&dir==='W')continue;
   const j=i+OFFSET[dir];
   if(j<0||j>=9||(dir==='W'&&i%3===0)||(dir==='E'&&i%3===2))continue;
   if(ports(pipe.cells[j]).includes(OPP[dir])&&!flow.has(j)){flow.add(j);q.push(j);}
  }
 }
 return flow;
}
const ROVER_MAPS=[
 {path:[0,1,2,7,12,13,14,19,24],extra:[6,11,21]},
 {path:[0,5,10,11,12,13,14,19,24],extra:[1,6,18]},
 {path:[0,1,6,11,12,17,22,23,24],extra:[2,7,13]}
];
function roverMap(){
 const candidate=ROVER_MAPS[rand(ROVER_MAPS.length)];
 const open=new Set([...candidate.path,...candidate.extra]);
 return Array.from({length:25},(_,i)=>open.has(i)?'open':'wall');
}
function slideNeighbors(i){
 const result=[];
 if(i>=3)result.push(i-3);
 if(i<=5)result.push(i+3);
 if(i%3>0)result.push(i-1);
 if(i%3<2)result.push(i+1);
 return result;
}
function mosaicTiles(){
 const tiles=[1,2,3,4,5,6,7,8,0];
 let previous=-1;
 for(let k=0;k<16;k++){
  const hole=tiles.indexOf(0);
  const opts=slideNeighbors(hole).filter(i=>i!==previous);
  const next=opts[rand(opts.length)];
  [tiles[hole],tiles[next]]=[tiles[next],tiles[hole]];
  previous=hole;
 }
 return tiles;
}
export function startTeamGame(room){
 const index=room.teamGamesCompleted?.[room.stage]??0;
 const kind=TEAM_GAMES[room.stage]?.[index];
 if(!kind)return null;
 const at=now();
 const g={id:randomUUID(),kind,stage:room.stage,index:index+1,total:TEAM_GAMES[room.stage].length,
  title:INFO[kind].title,description:INFO[kind].hint,startedAt:at,turnIndex:0,turnAt:at,
  moves:0,contributors:{},message:'全隊合作開始！',version:1};
 if(kind==='memory'){
  // At least two players: exactly two clues per player, with the operator and clue holder deliberately different.
  // Solo classroom testing uses four clues held by the only player.
  const n=Math.max(1,room.players.length);
  const total=n===1?4:n*2;
  g.sequence=Array.from({length:total},()=>rand(4));
  g.clues=g.sequence.map((pad,index)=>({
   position:index+1,pad,ownerId:room.players[(index+1)%n].id
  }));
  g.step=0;g.hidden=true;g.mistakes=0;
 }
 if(kind==='pulse'){
  g.charges=0;g.goal=Math.max(5,room.players.length+2);g.cycleMs=9000;
  g.targetRange=[0.28,0.65];g.lastPressedAt=0;
 }
 if(kind==='pipe')g.pipe=makePipeline(1);
 if(kind==='rover'){g.map=roverMap();g.rover=0;g.goal=24;}
 if(kind==='defense'){
  g.lane=rand(3);g.hits=0;g.goal=Math.max(6,room.players.length+2);
  g.deadlineAt=at+13000;g.misses=0;
 }
 if(kind==='mosaic'){g.tiles=mosaicTiles();g.goal=8;}
 room.teamGame=g;
 return g;
}
function advance(g,player){
 g.moves++;
 g.contributors[player.id]=(g.contributors[player.id]||0)+1;
 g.turnIndex++;
 g.turnAt=now();
 g.version++;
}
function finished(g){return {completed:true,kind:g.kind,title:g.title,reward:rewards[g.kind],message:'🎉 '+g.title+'：全隊合作成功！'};}
function reject(message){return {completed:false,message};}
function play(room,player,body) {
 const g=room.teamGame;
 const op=String(body.move??'');
 if(g.kind==='memory'){
  const pad=Number(body.index);
  if(!Number.isInteger(pad)||pad<0||pad>3)throw new Error('請點擊四個能量節點其中之一');
  if(pad!==g.sequence[g.step]){
   g.mistakes++;g.version++;
   const holder=room.players.find(p=>p.id===g.clues[g.step].ownerId);
   return reject('這不是第 '+(g.step+1)+' 格的符號。請 '+(holder?.name||'線索持有人')+' 再讀出自己畫面上的第 '+(g.step+1)+' 格線索。');
  }
  g.step++;advance(g,player);
  if(g.step>=g.sequence.length)return finished(g);
  const next=room.players.find(p=>p.id===g.clues[g.step].ownerId);
  return reject('✅ 第 '+g.step+' 格完成！請 '+(next?.name||'隊友')+' 念出第 '+(g.step+1)+' 格的線索，由輪到的人操作。');
 }
 if(g.kind==='pulse'){
  if(op!=='charge')throw new Error('請在亮區按下充能');
  if(now()-g.lastPressedAt<500)return reject('請觀察光標的下一次移動。');
  g.lastPressedAt=now();
  const pos=((now()-g.startedAt)%g.cycleMs)/g.cycleMs;
  if(pos<g.targetRange[0]||pos>g.targetRange[1]){
   g.version++;
   return reject('還沒有對準綠色區域，請觀察光標再試。');
  }
  g.charges++;advance(g,player);
  if(g.charges>=g.goal)return finished(g);
  return reject('⚡ 成功充能 '+g.charges+'/'+g.goal+'！輪到下一位。');
 }
 if(g.kind==='pipe'){
  const index=Number(body.index);
  if(!Number.isInteger(index)||index<0||index>=9)throw new Error('無效的水管位置');
  g.pipe.cells[index].rotation=(g.pipe.cells[index].rotation+1)%4;
  advance(g,player);
  if(isPipelineSolved(g.pipe))return finished(g);
  return reject('💧 水管已旋轉，請全隊觀察能否接通。');
 }
 if(g.kind==='rover'){
  if(!DIRS.includes(op))throw new Error('請選擇上下左右方向');
  const from=g.rover,to=from+({N:-5,E:1,S:5,W:-1}[op]);
  if(to<0||to>=25||(op==='W'&&from%5===0)||(op==='E'&&from%5===4)||g.map[to]==='wall')
   return reject('🚧 前面有障礙或邊界，請討論另一條路線。');
  g.rover=to;advance(g,player);
  if(g.rover===g.goal)return finished(g);
  return reject('🚜 救援車已前進，下一位隊友繼續導航。');
 }
 if(g.kind==='defense'){
  const lane=Number(body.index);
  if(!Number.isInteger(lane)||lane<0||lane>2)throw new Error('請選擇三條航道其中一條');
  if(now()>g.deadlineAt)return reject('時間到了，請觀察下一顆隕石。');
  if(lane!==g.lane){
   room.resources.stability=Math.max(0,room.resources.stability-1);
   g.version++;return reject('☄️ 護盾方向不對，請快速找到正確航道！');
  }
  g.hits++;advance(g,player);
  if(g.hits>=g.goal)return finished(g);
  g.lane=rand(3);g.deadlineAt=now()+13000;
  return reject('🛡️ 攔截成功！下一顆隕石已經接近。');
 }
 if(g.kind==='mosaic'){
  const index=Number(body.index);
  if(!Number.isInteger(index)||index<0||index>=9)throw new Error('請點擊有效的星圖碎片');
  const empty=g.tiles.indexOf(0);
  if(!slideNeighbors(empty).includes(index))return reject('只能把空白格旁邊的星圖碎片滑進空格。');
  [g.tiles[empty],g.tiles[index]]=[g.tiles[index],g.tiles[empty]];
  advance(g,player);
  if(g.tiles.every((n,i)=>n===(i===8?0:i+1)))return finished(g);
  return reject('🪐 星圖碎片已移動，請一起完成 1～8 的排列。');
 }
 throw new Error('不支援的小遊戲');
}
export function playTeamGame(room,player,body={}){
 if(room.phase!=='playing'||room.paused)throw new Error('遊戲尚未開始或已暫停');
 const g=room.teamGame;
 if(!g)throw new Error('目前不是合作小遊戲階段');
 if(body.gameId!==g.id)throw new Error('合作遊戲已更新，請重試');
 if(!who(room,g,player))throw new Error('目前輪到 '+member(room,g).name+' 操作，請用口頭協助隊友');
 const response=play(room,player,body);
 g.message=response.message;
 g.version++;
 if(response.completed)g.contributors[player.id]=(g.contributors[player.id]||0)+0;
 return response;
}
export function tickTeamGame(room){
 const g=room.teamGame;
 if(!g||room.paused||room.phase!=='playing')return false;
 if(g.kind==='defense'&&now()>=g.deadlineAt){
  g.misses++;
  room.resources.stability=Math.max(0,room.resources.stability-2);
  g.lane=rand(3);g.deadlineAt=now()+13000;g.turnIndex++;g.turnAt=now();
  g.message='⚠️ 一顆隕石擊中護盾！穩定度 -2，下一位隊友準備攔截。';
  g.version++;return true;
 }
 return false;
}
export function shiftTeamGameTime(room,delta){
 const g=room.teamGame;
 if(!g||delta<=0)return;
 g.startedAt+=delta;g.turnAt+=delta;
 if(g.revealUntil)g.revealUntil+=delta;
 if(g.deadlineAt)g.deadlineAt+=delta;
}
export function publicTeamGame(room,viewer){
 const g=room.teamGame;
 if(!g)return null;
 const current=member(room,g);
 const me=viewer&&viewer.id===current?.id;
 const canPlay=!!viewer&&who(room,g,viewer);
 const base={id:g.id,kind:g.kind,title:g.title,description:g.description,stage:g.stage,
  index:g.index,total:g.total,moves:g.moves,message:g.message,contributors:g.contributors,
  turnName:current?.name||'探險家',turnPlayerId:current?.id||null,myTurn:canPlay,
  turnAt:g.turnAt,teammates:room.players.map(p=>({id:p.id,name:p.name,acted:!!g.contributors[p.id]}))};
 if(g.kind==='memory'){
  const holder=room.players.find(p=>p.id===g.clues[g.step]?.ownerId);
  return {...base,step:g.step,length:g.sequence.length,hidden:true,
   sequence:null,
   clueHolderName:holder?.name||null,
   myClues:viewer?g.clues.filter(c=>c.ownerId===viewer.id).map(c=>({
      position:c.position,pad:c.pad,icon:PADS[c.pad].icon,name:PADS[c.pad].name
   })):[],
   pads:PADS,mistakes:g.mistakes};
 }
 if(g.kind==='pulse')return {...base,charges:g.charges,goal:g.goal,cycleMs:g.cycleMs,
  startedAt:g.startedAt,targetRange:g.targetRange};
 if(g.kind==='pipe'){
  const flowing=pipeFlow(g.pipe);
  return {...base,cells:g.pipe.cells.map((c,i)=>({kind:c.kind,ports:ports(c),flowing:flowing.has(i)}))};
 }
 if(g.kind==='rover')return {...base,map:g.map,position:g.rover,goal:g.goal};
 if(g.kind==='defense')return {...base,lane:g.lane,hits:g.hits,goal:g.goal,
  deadlineAt:g.deadlineAt,misses:g.misses};
 if(g.kind==='mosaic')return {...base,tiles:g.tiles};
 return base;
}
