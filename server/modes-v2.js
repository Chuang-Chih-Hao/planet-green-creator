export const GAME_MODES = {
  growth: { title: '生命復育', description: '擴張森林、培育氧氣與水循環；達到環境條件才能進入生命時代。' },
  balance: { title: '生態平衡', description: '除了建造，也要平衡氧氣、水、能源、穩定度四種指標。' },
  survival: { title: '危機守護', description: '抵禦宇宙事件並修復地表異常；必須成功處理足夠危機。' }
};

export function modeGoalList(room) {
  const r=room.resources, c=room.completed, n=room.requiredBuildings;
  const goals = [
    { id:'buildings', text:`完成 ${n} 項工程（目前 ${room.structures.length}）`, met:room.structures.length>=n },
    { id:'variety', text:'森林、星環、地形修復都至少 1 項', met:c.forest>0 && c.orbit>0 && c.crater>0 }
  ];
  if (room.gameMode==='balance') {
    for (const [key,title,min] of [['oxygen','氧氣',50],['water','水資源',35],['energy','能源',45],['stability','星球穩定度',65]]) {
      goals.push({id:key, text:`${title} ≥ ${min}（目前 ${r[key]}）`, met:r[key]>=min});
    }
  } else if (room.gameMode==='survival') {
    const required = Math.max(1, Math.ceil(n/12));
    goals.push({id:'eventsWon', text:`成功解除 ${required} 次宇宙事件（目前 ${room.eventsWon||0}）`, met:(room.eventsWon||0)>=required});
    goals.push({id:'stability',text:`星球穩定度 ≥ 60（目前 ${r.stability}）`,met:r.stability>=60});
  } else {
    const required = Math.max(2,Math.ceil(n*.3));
    goals.push({id:'forest',text:`培育 ${required} 片森林（目前 ${c.forest}）`,met:c.forest>=required});
    goals.push({id:'oxygen',text:`氧氣 ≥ 50（目前 ${r.oxygen}）`,met:r.oxygen>=50});
    goals.push({id:'water',text:`水資源 ≥ 25（目前 ${r.water}）`,met:r.water>=25});
  }
  goals.push({id:'hazards',text:`清除全部星球異常（目前 ${room.hazards?.length||0} 項）`,met:!room.hazards?.length});
  return goals;
}

export function modeProgress(room) {
  if (room.result?.win) return 100;
  const goals=modeGoalList(room);
  const rest=goals.filter(g=>g.id!=='buildings');
  const structures=Math.min(1,room.structures.length/Math.max(1,room.requiredBuildings));
  // 最高 99%，未完成生態／危機條件不會只靠蓋建築進入生命時代。
  return Math.min(99,Math.round(structures*60+rest.filter(g=>g.met).length/rest.length*40));
}

export const HAZARD_INFO = {
  meteor: {repairKind:'crater',effectKey:'stability',loss:3,notice:'地表裂痕：每次建造再損失 3 穩定度，需完成地形修復。',repairBonus:{stability:8}},
  flare: {repairKind:'orbit',effectKey:'energy',loss:3,notice:'太陽干擾：每次建造再損失 3 能源，需完成星環工程。',repairBonus:{energy:8}},
  rain: {repairKind:'forest',effectKey:'oxygen',loss:3,notice:'積水異常：每次建造再損失 3 氧氣，需完成森林工程。',repairBonus:{oxygen:8}},
  alien: {repairKind:'orbit',effectKey:'energy',loss:2,notice:'訊號干擾：每次建造再損失 2 能源，需完成星環工程。',repairBonus:{energy:7}}
};
