// V1.6：三段數學建造交替六款全隊同步、不同機制的小遊戲。
export const STAGES = [
  { id:1, title:'荒土甦醒', emoji:'🌱', subtitle:'建立第一片森林與能源基地', problem:'荒蕪星球缺少氧氣與電力，必須先啟動造林及發電。' },
  { id:2, title:'水土復育', emoji:'💧', subtitle:'修復乾旱、建立穩定的水循環', problem:'第一階段開發造成水資源下降！必須修復地形、建設水循環。' },
  { id:3, title:'文明守護', emoji:'🛡️', subtitle:'建立星環、共同攔截隕石與修復星圖', problem:'隕石群正在逼近！完成數學防護工程後，大家要合作攔截隕石並修復星圖。' }
];
export const STAGE_COUNT = STAGES.length;
export const stageInfo = room => STAGES[Math.max(0,Math.min(STAGE_COUNT-1,(room.stage||1)-1))];
export const GAME_MODES = {}; // 舊版相容性匯出，不再用於設定／通關。

import { TEAM_GAMES } from './team-games.js';
export function mathStageGoals(room) {
  const c=room.completed,r=room.resources,n=room.requiredBuildings;
  const total=room.structures.length,stage=room.stage||1;
  const safe=()=>({id:'hazards',text:'修復尚未解除的環境異常（'+room.hazards.length+' 項）',met:room.hazards.length===0});
  if(stage===1){
    const need=Math.max(2,Math.ceil(n/3));
    return [
     {id:'buildings',text:'完成 '+need+' 項第一階段數學建設（目前 '+total+'）',met:total>=need},
     {id:'forest',text:'建立至少 1 座森林',met:c.forest>=1},
     {id:'power',text:'建立至少 1 座能源站',met:c.power>=1},
     {id:'oxygen',text:'氧氣至少 26（目前 '+r.oxygen+'）',met:r.oxygen>=26},
     {id:'energy',text:'能源至少 34（目前 '+r.energy+'）',met:r.energy>=34},
     safe()
    ];
  }
  if(stage===2){
    const need=Math.max(3,Math.ceil(n*.65));
    return [
     {id:'buildings',text:'累計完成 '+need+' 項數學建設（目前 '+total+'）',met:total>=need},
     {id:'crater',text:'完成至少 1 項地形修復',met:c.crater>=1},
     {id:'water',text:'修復水資源至 25（目前 '+r.water+'）',met:r.water>=25},
     {id:'stability',text:'穩定度至少 50（目前 '+r.stability+'）',met:r.stability>=50},
     safe()
    ];
  }
  const need=Math.max(1,Math.ceil(n/6));
  return [
   {id:'buildings',text:'累計完成 '+n+' 項數學建設（目前 '+total+'）',met:total>=n},
   {id:'variety',text:'森林、能源、修復與星環工程均已建立',met:['forest','power','crater','orbit'].every(k=>c[k]>=1)},
   {id:'power',text:'能源站至少 '+need+' 項（目前 '+c.power+'）',met:c.power>=need},
   {id:'oxygen',text:'氧氣 ≥ 30（目前 '+r.oxygen+'）',met:r.oxygen>=30},
   {id:'water',text:'水資源 ≥ 25（目前 '+r.water+'）',met:r.water>=25},
   {id:'energy',text:'能源 ≥ 45（目前 '+r.energy+'）',met:r.energy>=45},
   {id:'stability',text:'穩定度 ≥ 55（目前 '+r.stability+'）',met:r.stability>=55},
   safe()
  ];
}
export function stageGoalList(room) {
 const goals=mathStageGoals(room);
 const done=room.teamGamesCompleted?.[room.stage]||0,total=TEAM_GAMES[room.stage].length;
 goals.push({id:'team',text:'與隊友依序完成 '+total+' 個合作小遊戲（目前 '+done+'/'+total+'）',met:done>=total});
 const labels={
  buildings:'📐 四種建造合計',forest:'🌳 森林',power:'⚡ 能源',
  crater:'🛠️ 修復',orbit:'🛰️ 星環',variety:'🌳⚡🛠️🛰️ 各建一次',
  oxygen:'🌳 森林補充氧氣',water:'🛠️ 修復補充水資源',
  energy:'⚡ 能源補充電力',stability:'🛠️ 修復 / 🛰️ 星環提升穩定度',
  hazards:'☄️ 事件受損後，依異常提示建設對應工程',team:'🎮 階段合作小遊戲'
 };
 return goals.map(goal=>({...goal,text:(labels[goal.id]||'📋 本關目標')+'：'+goal.text}));
}
export const modeGoalList=stageGoalList;
export function modeProgress(room) {
 if(room.result?.win)return 100;
 if(!room.structures.length)return 0;
 const stage=room.stage||1,goals=stageGoalList(room);
 const maths=goals.filter(g=>g.id!=='team');
 const mathRatio=maths.filter(g=>g.met).length/Math.max(1,maths.length);
 const gameRatio=(room.teamGamesCompleted?.[stage]||0)/2;
 const partial=mathRatio*.55+gameRatio*.45;
 return Math.min(99,Math.round(((stage-1)+partial)/3*100));
}
export function lifeIndex(room) {
  if(room.result?.win) return 100;
  if(!room.structures.length)return 0;
  const stage=room.stage||1;
  const avg=['oxygen','water','energy','stability'].reduce((s,k)=>s+room.resources[k],0)/4;
  const baseline=(stage-1)*31;
  return Math.min(stage===1?30:stage===2?64:98,Math.max(1,Math.round(baseline+avg*.20+room.structures.length/Math.max(1,room.requiredBuildings)*17)));
}
export const HAZARD_INFO = {
  meteor: {repairKind:'crater',effectKey:'stability',loss:3,notice:'地表裂痕：每次建造再損失 3 穩定度，需完成地形修復。',repairBonus:{stability:8}},
  flare: {repairKind:'power',effectKey:'energy',loss:3,notice:'太陽干擾：每次建造再損失 3 能源，需完成能源工程。',repairBonus:{energy:10}},
  rain: {repairKind:'forest',effectKey:'oxygen',loss:3,notice:'積水異常：每次建造再損失 3 氧氣，需完成森林工程。',repairBonus:{oxygen:8}},
  alien: {repairKind:'orbit',effectKey:'energy',loss:2,notice:'訊號干擾：每次建造再損失 2 能源，需完成星環工程。',repairBonus:{energy:7}}
};
