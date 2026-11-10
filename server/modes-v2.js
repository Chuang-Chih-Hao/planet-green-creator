// V1.3：關卡按順序推進，不再由教師選擇不同模式。
export const STAGES = [
  { id:1, title:'荒土甦醒', emoji:'🌱', subtitle:'建立第一片森林與能源基地', problem:'荒蕪星球缺少氧氣與電力，必須先啟動造林及發電。' },
  { id:2, title:'水土復育', emoji:'💧', subtitle:'修復乾旱、建立穩定的水循環', problem:'第一階段開發造成水資源下降！必須修復地形、建設水循環。' },
  { id:3, title:'文明守護', emoji:'🛡️', subtitle:'建立星環、抵禦太陽風暴', problem:'外太空偵測到太陽風暴，全隊需要解決危機並維持四大資源。' }
];
export const STAGE_COUNT = STAGES.length;
export const stageInfo = room => STAGES[Math.max(0,Math.min(STAGE_COUNT-1,(room.stage||1)-1))];
export const GAME_MODES = {}; // 舊版相容性匯出，不再用於設定／通關。

export function stageGoalList(room) {
  const c=room.completed, r=room.resources, n=room.requiredBuildings;
  const stage=room.stage||1, total=room.structures.length;
  if(stage===1) {
    const need=Math.max(2,Math.ceil(n/3));
    return [
      {id:'buildings',text:'完成至少 '+need+' 項初期工程（目前 '+total+'）',met:total>=need},
      {id:'forest',text:'至少建立 1 片森林（目前 '+c.forest+'）',met:c.forest>=1},
      {id:'power',text:'至少建立 1 座能源站（目前 '+c.power+'）',met:c.power>=1},
      {id:'oxygen',text:'氧氣達到 26（目前 '+r.oxygen+'）',met:r.oxygen>=26},
      {id:'energy',text:'能源達到 34（目前 '+r.energy+'）',met:r.energy>=34},
      {id:'hazards',text:'解決當前宇宙異常（目前 '+room.hazards.length+'）',met:room.hazards.length===0}
    ];
  }
  if(stage===2) {
    const need=Math.max(3,Math.ceil(n*.65));
    return [
      {id:'buildings',text:'累計完成至少 '+need+' 項工程（目前 '+total+'）',met:total>=need},
      {id:'crater',text:'完成 1 項以上地形修復（目前 '+c.crater+'）',met:c.crater>=1},
      {id:'water',text:'修復水循環，水資源達到 25（目前 '+r.water+'）',met:r.water>=25},
      {id:'stability',text:'星球穩定度達到 50（目前 '+r.stability+'）',met:r.stability>=50},
      {id:'hazards',text:'解除尚未修復的異常（目前 '+room.hazards.length+'）',met:room.hazards.length===0}
    ];
  }
  const requiredPower=Math.max(1,Math.ceil(n/6));
  return [
    {id:'buildings',text:'全隊完成 '+n+' 項工程（目前 '+total+'）',met:total>=n},
    {id:'variety',text:'四種工程各至少完成 1 項',met:['forest','orbit','crater','power'].every(k=>c[k]>=1)},
    {id:'power',text:'能源站累計完成 '+requiredPower+' 項（目前 '+c.power+'）',met:c.power>=requiredPower},
    {id:'orbit',text:'建成至少 1 座星環防護工程（目前 '+c.orbit+'）',met:c.orbit>=1},
    {id:'challenge',text:'解決 1 次後期危機（已完成 '+(room.stageChallengesResolved||0)+' 次）',met:(room.stageChallengesResolved||0)>=1},
    {id:'oxygen',text:'氧氣 ≥ 30（目前 '+r.oxygen+'）',met:r.oxygen>=30},
    {id:'water',text:'水資源 ≥ 25（目前 '+r.water+'）',met:r.water>=25},
    {id:'energy',text:'能源 ≥ 45（目前 '+r.energy+'）',met:r.energy>=45},
    {id:'stability',text:'穩定度 ≥ 55（目前 '+r.stability+'）',met:r.stability>=55},
    {id:'hazards',text:'修復全部宇宙異常（目前 '+room.hazards.length+'）',met:room.hazards.length===0}
  ];
}
export const modeGoalList=stageGoalList;
export function modeProgress(room) {
  if(room.result?.win) return 100;
  if(!room.structures.length) return 0;
  const goals=stageGoalList(room);
  const buildings=goals.find(x=>x.id==='buildings');
  const count=(room.stage||1)===1?Math.max(2,Math.ceil(room.requiredBuildings/3))
    :(room.stage||1)===2?Math.max(3,Math.ceil(room.requiredBuildings*.65)):room.requiredBuildings;
  const ratio=Math.min(1,room.structures.length/Math.max(1,count));
  const rest=goals.filter(g=>g!==buildings);
  const local=ratio*.6+rest.filter(g=>g.met).length/Math.max(1,rest.length)*.4;
  return Math.min(99,Math.round((((room.stage||1)-1)+local)/STAGE_COUNT*100));
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
