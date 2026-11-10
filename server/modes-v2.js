export const GAME_MODES = {
  growth: { title: '生命復育', description: '森林、供水、能源供給都必須建設完成，才能讓星球孕育生命。' },
  balance: { title: '生態平衡', description: '氧氣、水、能源、穩定度及能源設施全部達標，才算真正可持續。' },
  survival: { title: '危機守護', description: '抗衡宇宙危機，同時確保能源系統持續運作並修復全部異常。' }
};
export function requiredPower(room) {
  return Math.max(1,Math.ceil(room.requiredBuildings/6));
}
export function modeGoalList(room) {
  const r=room.resources, c=room.completed, n=room.requiredBuildings;
  const powerNeed=requiredPower(room);
  const goals=[
    {id:'buildings',text:'完成 '+n+' 項工程（目前 '+room.structures.length+'）',met:room.structures.length>=n},
    {id:'variety',text:'森林、星環、地形修復、能源站都至少完成 1 項',met:['forest','orbit','crater','power'].every(k=>c[k]>0)},
    {id:'power',text:'完成 '+powerNeed+' 座能源工程（目前 '+(c.power||0)+'）',met:(c.power||0)>=powerNeed}
  ];
  if(room.gameMode==='balance'){
    for(const [key,title,min] of [['oxygen','氧氣',50],['water','水資源',35],['energy','能源',55],['stability','星球穩定度',65]]){
      goals.push({id:key,text:title+' ≥ '+min+'（目前 '+r[key]+'）',met:r[key]>=min});
    }
  } else if(room.gameMode==='survival'){
    const need=Math.max(1,Math.ceil(n/12));
    goals.push({id:'eventsWon',text:'成功解除 '+need+' 次宇宙事件（目前 '+(room.eventsWon||0)+'）',met:(room.eventsWon||0)>=need});
    goals.push({id:'stability',text:'星球穩定度 ≥ 60（目前 '+r.stability+'）',met:r.stability>=60});
    goals.push({id:'energy',text:'能源 ≥ 45（目前 '+r.energy+'）',met:r.energy>=45});
  } else {
    const need=Math.max(2,Math.ceil(n*.3));
    goals.push({id:'forest',text:'培育 '+need+' 片森林（目前 '+c.forest+'）',met:c.forest>=need});
    goals.push({id:'oxygen',text:'氧氣 ≥ 50（目前 '+r.oxygen+'）',met:r.oxygen>=50});
    goals.push({id:'water',text:'水資源 ≥ 25（目前 '+r.water+'）',met:r.water>=25});
    goals.push({id:'energy',text:'能源 ≥ 50（目前 '+r.energy+'）',met:r.energy>=50});
  }
  goals.push({id:'hazards',text:'清除全部星球異常（目前 '+(room.hazards?.length||0)+' 項）',met:!room.hazards?.length});
  return goals;
}
export function modeProgress(room) {
  if(room.result?.win) return 100;
  // 不以開局既有資源折算「已開發」百分比：尚未蓋出任何設施就是 0%。
  if(!room.structures.length) return 0;
  const goals=modeGoalList(room);
  const rest=goals.filter(g=>g.id!=='buildings');
  const built=Math.min(1,room.structures.length/Math.max(1,room.requiredBuildings));
  return Math.min(99,Math.round(built*60+rest.filter(g=>g.met).length/rest.length*40));
}
export function lifeIndex(room) {
  if(!room.structures.length) return 0;
  if(room.result?.win) return 100;
  const avg=['oxygen','water','energy','stability'].reduce((sum,key)=>sum+room.resources[key],0)/4;
  const built=Math.min(1,room.structures.length/Math.max(1,room.requiredBuildings));
  return Math.max(0,Math.min(99,Math.round(avg*.50+built*50+modeProgress(room)*.25-13)));
}
export const HAZARD_INFO = {
  meteor: {repairKind:'crater',effectKey:'stability',loss:3,notice:'地表裂痕：每次建造再損失 3 穩定度，需完成地形修復。',repairBonus:{stability:8}},
  flare: {repairKind:'power',effectKey:'energy',loss:3,notice:'太陽干擾：每次建造再損失 3 能源，需完成能源工程。',repairBonus:{energy:10}},
  rain: {repairKind:'forest',effectKey:'oxygen',loss:3,notice:'積水異常：每次建造再損失 3 氧氣，需完成森林工程。',repairBonus:{oxygen:8}},
  alien: {repairKind:'orbit',effectKey:'energy',loss:2,notice:'訊號干擾：每次建造再損失 2 能源，需完成星環工程。',repairBonus:{energy:7}}
};
