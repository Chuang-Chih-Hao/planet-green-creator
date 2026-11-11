// V1.5 cooperative planet management activities: exploration, pipe routing and research.
// All shared actions are server-authoritative; unrevealed sector contents remain secret.
const CLAMP=n=>Math.max(0,Math.min(100,n));
const gain=(room,changes)=>{
  for(const [key,value] of Object.entries(changes))room.resources[key]=CLAMP((room.resources[key]||0)+value);
};
const pick=(arr,rng=Math.random)=>arr[Math.min(arr.length-1,Math.floor(Math.max(0,rng())*arr.length))];
const now=()=>Date.now();
const sectorTypes=['water','mineral','life','mineral','energy','water','life','anomaly','mineral','water','energy','life','mineral','water','anomaly','life'];
const sectorInfo={
 water:{icon:'💧',title:'地下水脈',description:'偵測到乾淨的地下水，為星球補充水資源。',change:{water:8},material:1},
 mineral:{icon:'🪨',title:'稀有礦藏',description:'找到修復與科技升級所需的材料。',change:{},material:3},
 life:{icon:'🌿',title:'原生植物群',description:'保護原生植物，氧氣供給增加。',change:{oxygen:7},material:1},
 energy:{icon:'☀️',title:'恆星能量井',description:'能量採集器開始工作。',change:{energy:8},material:1},
 anomaly:{icon:'🌀',title:'神祕電磁訊號',description:'探測到異常訊號，回收部分有價值的樣本。',change:{stability:-3},material:2}
};
const decisionTypes=[
 {id:'wildlife',title:'🦋 珍稀生物保護',story:'探測隊找到一片原生物種棲息地。現在應先保護生物，還是採集研究樣本？',
  options:[{id:'protect',label:'🌱 劃設生態保護區',description:'氧氣 +10，水資源 +3',change:{oxygen:10,water:3},material:0},
           {id:'sample',label:'🔬 採集研究樣本',description:'研究材料 +3，氧氣 -2',change:{oxygen:-2},material:3}]},
 {id:'signal',title:'📡 未知訊號',story:'星環雷達收到宇宙訊號。隊伍要花能源解碼，還是先把資源送往水循環？',
  options:[{id:'decode',label:'🛰️ 分配能源解碼',description:'能源 -5，材料 +4',change:{energy:-5},material:4},
           {id:'water',label:'💧 優先維護水循環',description:'水資源 +9，材料 +1',change:{water:9},material:1}]},
 {id:'storm',title:'⚠️ 沙塵暴來襲',story:'星球邊緣出現沙塵暴。小組要強化護盾，還是回收設備以保住能源？',
  options:[{id:'shield',label:'🛡️ 立即啟動護盾',description:'能源 -5，穩定度 +10',change:{energy:-5,stability:10},material:0},
           {id:'salvage',label:'🧰 回收受損設備',description:'材料 +3，穩定度 -4',change:{stability:-4},material:3}]}
];
export const TECHS=[
 {id:'nursery',icon:'🌲',title:'自動育苗基地',description:'每次森林建造額外 +3 氧氣',cost:3,immediate:{oxygen:6},kind:'forest',bonus:{oxygen:3}},
 {id:'battery',icon:'🔋',title:'高效儲能系統',description:'每次能源建造額外 +3 能源',cost:4,immediate:{energy:6},kind:'power',bonus:{energy:3}},
 {id:'shield',icon:'🛡️',title:'軌道防護雷達',description:'每次星環建造額外 +3 穩定度',cost:5,immediate:{stability:8},kind:'orbit',bonus:{stability:3}},
 {id:'filter',icon:'💧',title:'循環淨水系統',description:'每次修復工程額外 +3 水資源',cost:4,immediate:{water:7},kind:'crater',bonus:{water:3}}
];
const DIRS=['N','E','S','W'];
const OPP={N:'S',E:'W',S:'N',W:'E'};
const DX={N:-3,E:1,S:3,W:-1};
const PIPE_PLANS=[
 [0,1,4,7,8],
 [0,3,4,5,8],
 [0,1,2,5,8]
];
const connectors=(kind,rotation)=>{
 const base=kind==='straight'?['N','S']:['N','E'];
 return base.map(d=>DIRS[(DIRS.indexOf(d)+rotation)%4]);
};
function direction(from,to){
 const delta=to-from;
 if(delta===1)return 'E';
 if(delta===-1)return 'W';
 if(delta===3)return 'S';
 if(delta===-3)return 'N';
 throw new Error('Broken pipeline plan');
}
function rotationFor(kind,needs){
 for(let i=0;i<4;i++){
  const c=connectors(kind,i);
  if(c.length===needs.length&&needs.every(p=>c.includes(p)))return i;
 }
 throw new Error('Pipe has no matching rotation');
}
function flowingCells(pipe){
 const flowed=new Set();
 if(!connectors(pipe.cells[0].kind,pipe.cells[0].rotation).includes('W'))return flowed;
 const queue=[0];flowed.add(0);
 for(let i=0;i<queue.length;i++){
  const index=queue[i],cell=pipe.cells[index];
  for(const dir of connectors(cell.kind,cell.rotation)){
   if(index===0&&dir==='W')continue;
   const target=index+DX[dir];
   if(target<0||target>8||(dir==='W'&&index%3===0)||(dir==='E'&&index%3===2))continue;
   if(connectors(pipe.cells[target].kind,pipe.cells[target].rotation).includes(OPP[dir])&&!flowed.has(target)){
    flowed.add(target);queue.push(target);
   }
  }
 }
 return flowed;
}
export function isPipelineSolved(pipe){
 const flowed=flowingCells(pipe);
 return flowed.has(8)&&connectors(pipe.cells[8].kind,pipe.cells[8].rotation).includes('E');
}
export function makePipeline(round=0,rng=Math.random){
 const path=PIPE_PLANS[round%PIPE_PLANS.length];
 const cells=Array.from({length:9},(_,i)=>({kind:i%3===1?'straight':'elbow',rotation:Math.floor(rng()*4)}));
 for(let i=0;i<path.length;i++){
  const prev=path[i-1],next=path[i+1],idx=path[i];
  const needs=[prev==null?'W':direction(idx,prev),next==null?'E':direction(idx,next)];
  const kind=needs.includes(OPP[needs[0]])?'straight':'elbow';
  const targetRotation=rotationFor(kind,needs);
  cells[idx]={kind,rotation:(targetRotation+1+Math.floor(rng()*3))%4};
 }
 const pipe={round:round+1,cells,solution:path,turns:0};
 if(isPipelineSolved(pipe))cells[0].rotation=(cells[0].rotation+1)%4;
 return pipe;
}
function seededSectors(){
 const sectors=sectorTypes.map((type,index)=>({index,type,revealed:false,by:null}));
 // Randomly shuffle the types while retaining 16 distinct map positions.
 for(let i=sectors.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[sectors[i].type,sectors[j].type]=[sectors[j].type,sectors[i].type];}
 return sectors;
}
export function makeAdventure(){
 return {
  sectors:seededSectors(),discovered:0,nextScanAt:0,materials:0,
  decisionsResolved:0,decision:null,
  pipe:makePipeline(),pipeRepairs:0,nextPipeAt:0,
  upgrades:[],lastDiscovery:null,lastAction:null
 };
}
export function explorationTarget(room,stage=room.stage||1){
 const n=Math.max(1,room.startingPlayers||room.players.length);
 if(stage===1)return Math.min(4,Math.max(2,Math.ceil(n*.8)));
 if(stage===2)return Math.min(8,Math.max(4,Math.ceil(n*1.4)));
 return Math.min(14,Math.max(7,Math.ceil(n*2.5)));
}
const checkPlaying=room=>{if(room.phase!=='playing'||room.paused)throw new Error('遊戲尚未開始或正在暫停');};
const actor=(player)=>player?.name||'探險家';
export function exploreSector(room,player,index){
 checkPlaying(room);
 const adv=room.adventure;
 if(!Number.isInteger(index)||index<0||index>=16)throw new Error('請點選有效的地圖區域');
 if(adv.decision)throw new Error('先與隊友共同處理目前的探索抉擇');
 if(now()<adv.nextScanAt)throw new Error('探測器冷卻中，請先安排其他任務');
 const sector=adv.sectors[index];
 if(sector.revealed)throw new Error('這片區域已探索過，請選其他地點');
 if(room.resources.energy<2)throw new Error('能源不足，先完成能源工程');
 gain(room,{energy:-2});
 const info=sectorInfo[sector.type];
 sector.revealed=true;sector.by=actor(player);
 adv.discovered++;adv.materials+=info.material;
 gain(room,info.change);
 adv.nextScanAt=now()+12000; // 12-second team-wide scan interval gives space for other gameplay.
 adv.lastDiscovery={icon:info.icon,title:info.title,description:info.description,by:actor(player),material:info.material,at:now()};
 if([3,7,11].includes(adv.discovered)&&adv.decisionsResolved<3) {
  const decision=decisionTypes[Math.min(2,adv.decisionsResolved)];
  adv.decision={...decision,source:'sector:'+index};
 }
 adv.lastAction=actor(player)+' 探索「'+info.title+'」，獲得 '+info.material+' 研究材料';
 return {message:adv.lastAction,discovery:adv.lastDiscovery};
}
export function chooseDecision(room,player,id){
 checkPlaying(room);
 const adv=room.adventure,decision=adv.decision;
 if(!decision)throw new Error('目前沒有需要決策的事件');
 const opt=decision.options.find(x=>x.id===id);
 if(!opt)throw new Error('請選擇正確的團隊方案');
 gain(room,opt.change);
 adv.materials+=opt.material;
 adv.decisionsResolved++;
 adv.decision=null;
 adv.lastAction=actor(player)+' 決定「'+opt.label+'」';
 return {message:adv.lastAction};
}
export function rotatePipe(room,player,index){
 checkPlaying(room);
 const adv=room.adventure;
 if(room.stage<2)throw new Error('完成第一關後才開放管線修復');
 if(!Number.isInteger(index)||index<0||index>=9)throw new Error('無效的管線位置');
 if(now()<adv.nextPipeAt)throw new Error('管線剛修復完成，請稍後再開始下一次修復');
 const cell=adv.pipe.cells[index];
 cell.rotation=(cell.rotation+1)%4;
 adv.pipe.turns++;
 if(!isPipelineSolved(adv.pipe))return {message:actor(player)+' 正在轉動管線',solved:false};
 if(room.resources.energy<3) {
   // Restore a playable unsolved piece; don't consume energy on a failed completion.
   cell.rotation=(cell.rotation+1)%4;
   throw new Error('管線接通需要 3 能源，請先建設能源設施');
 }
 gain(room,{energy:-3,water:9,stability:4});
 adv.materials+=1;
 adv.pipeRepairs++;
 const round=adv.pipe.round;
 const turns=adv.pipe.turns;
 adv.pipe=makePipeline(adv.pipeRepairs);
 adv.nextPipeAt=now()+15000;
 adv.lastAction=actor(player)+' 接通第 '+round+' 組管線（旋轉 '+turns+' 次）！水資源 +9、穩定度 +4';
 return {message:adv.lastAction,solved:true};
}
export function purchaseTech(room,player,id){
 checkPlaying(room);
 const adv=room.adventure;
 const tech=TECHS.find(x=>x.id===id);
 if(!tech)throw new Error('未知的科技');
 if(adv.upgrades.includes(id))throw new Error('這項科技已經研究完成');
 if(adv.materials<tech.cost)throw new Error('研究材料不足；請先探索地圖');
 adv.materials-=tech.cost;
 adv.upgrades.push(id);
 gain(room,tech.immediate);
 adv.lastAction=actor(player)+' 解鎖科技「'+tech.title+'」！';
 return {message:adv.lastAction};
}
export function techBuildBonus(room,kind){
 const sum={};
 for(const id of room.adventure.upgrades){
  const tech=TECHS.find(x=>x.id===id);
  if(tech?.kind===kind)for(const [key,value] of Object.entries(tech.bonus))sum[key]=(sum[key]||0)+value;
 }
 return sum;
}
export function publicAdventure(room){
 const adv=room.adventure;
 const flow=flowingCells(adv.pipe);
 return {
  discovered:adv.discovered,totalSectors:adv.sectors.length,
  nextScanAt:adv.nextScanAt,materials:adv.materials,decisionsResolved:adv.decisionsResolved,
  decision:adv.decision,
  sectors:adv.sectors.map(s=>{
   const info=s.revealed?sectorInfo[s.type]:null;
   return {index:s.index,revealed:s.revealed,icon:info?.icon??'❔',title:info?.title??'未探索區域',by:s.revealed?s.by:undefined};
  }),
  pipeRepairs:adv.pipeRepairs,nextPipeAt:adv.nextPipeAt,
  pipe:{round:adv.pipe.round,turns:adv.pipe.turns,cells:adv.pipe.cells.map((c,i)=>({
   kind:c.kind,rotation:c.rotation,ports:connectors(c.kind,c.rotation),flowing:flow.has(i)
  }))},
  upgrades:adv.upgrades,
  techs:TECHS.map(t=>({id:t.id,title:t.title,icon:t.icon,cost:t.cost,description:t.description,owned:adv.upgrades.includes(t.id)})),
  lastDiscovery:adv.lastDiscovery,lastAction:adv.lastAction,
  scanTargets:[1,2,3].map(stage=>explorationTarget(room,stage))
 };
}
