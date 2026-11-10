import { randomUUID } from 'node:crypto';
import { makeVariedTask as oldTask, TASK_VARIANTS as OLD } from './tasks-v2.js';

const PI = 3.14;
const round = n => Number(n.toFixed(1));
const choose = (arr, rng) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(rng() * arr.length)))];
const extra = {
  forest: ['forestPairs','forestInner','reverseDiameter','forestHalf','forestLost'],
  orbit: ['threeLaps','circDifference','reverseDiameter','twinSatellites','orbitRing'],
  crater: ['twoCraters','ringReverseInner','damagedHalf','circleRepair','ringWithLake'],
  power: ['solarArea','solarDiameter','solarRadius','solarRing','solarExpansion','energyWire','twoArrays','collectorCircle','solarPerimeter','innerPanel']
};
export const TASK_VARIANTS = {
  forest: [...OLD.forest, ...extra.forest],
  orbit: [...OLD.orbit, ...extra.orbit],
  crater: [...OLD.crater, ...extra.crater],
  power: [...extra.power]
};
const mk = (kind,variant,title,question,answer,formula,unit,steps,hint,context,difficulty) =>
  ({id:randomUUID(), kind, variant, title, question, answer:round(answer), formula, unit, steps, hint, context, pi:PI, difficulty});
const area = r => PI*r*r;
const fmt = n => String(round(n));
// 多版本情境與數值同時變化，不只是把同一句話的數字換掉。
export const TASK_SCENARIOS = {
 forest: ['🌿 氧氣研究站傳來新計畫：','🌳 造林機正在規劃植樹區：','🪴 生態團隊收到新任務：','🦋 生命保育區準備擴充：','🌱 植物培育員提出需求：','🏞️ 生態地圖標記了新區域：','🛰️ 軌道測繪發現一片綠地：','💚 星球氧氣中心提出方案：'],
 orbit: ['🛰️ 衛星導航站發出指令：','📡 星環雷達正在測量：','🛡️ 防護總部準備升級：','🚀 巡航隊規劃新航線：','🌌 外太空巡邏站通知：','🔭 太空望遠鏡讀到新數據：','☄️ 防隕石系統要求測試：','🪐 星環工程隊提交設計：'],
 crater: ['⛰️ 地質探測器回報：','🛠️ 修復機器人準備施工：','🌋 地面出現新的裂縫：','💧 防洪工程師提出計畫：','🧱 星球土木團隊正在測量：','☄️ 隕石坑監測中心發現：','🏗️ 工程車前往修補區：','📐 測繪站送來最新圖紙：'],
 power: ['⚡ 能源控制中心通知：','☀️ 太陽能站規劃新場域：','🔋 能源儲存庫需要補充：','💡 電力工程師提交計畫：','🏭 發電基地準備擴建：','🧲 能量收集器開始運作：','🛰️ 衛星測得最佳發電區：','🌞 光能實驗室準備施工：']
};
const CONCEPT_BANK = {"forest":[{"variant":"conceptForest","type":"choice","title":"圓面積觀念","question":"半徑變成原來的 2 倍，圓形森林面積會變成多少倍？","choices":["2 倍","4 倍","8 倍"],"answer":"B","hint":"半徑在面積公式裡乘了自己。","steps":["圓面積是 π×r×r，半徑加倍會使面積變成四倍。"]},{"variant":"trueForest","type":"trueFalse","title":"森林是非題","question":"一片圓形森林直徑 10 公里，半徑就是 5 公里。","answer":"true","hint":"直徑是半徑的兩倍。","steps":["直徑 10÷2＝5 公里，因此正確。"]}],"orbit":[{"variant":"conceptOrbit","type":"choice","title":"軌道觀念","question":"衛星圓形軌道的半徑變 2 倍，一圈長度會變成多少倍？","choices":["2 倍","4 倍","不變"],"answer":"A","hint":"周長和半徑成正比。","steps":["圓周長＝2πr，半徑變成兩倍，周長也變兩倍。"]},{"variant":"trueOrbit","type":"trueFalse","title":"軌道是非題","question":"已知直徑，可以使用「3.14×直徑」來計算圓周長。","answer":"true","hint":"回想圓周長和直徑的關係。","steps":["圓周長＝πd，因此正確。"]}],"crater":[{"variant":"conceptCrater","type":"choice","title":"圓環觀念","question":"計算中間有洞的圓環面積，應使用什麼方法？","choices":["大圓面積減小圓面積","外半徑減內半徑","兩個圓周長相加"],"answer":"A","hint":"內圈是不可施工的部分。","steps":["圓環面積＝大圓面積－小圓面積。"]},{"variant":"trueCrater","type":"trueFalse","title":"圓環是非題","question":"圓環面積可以直接使用 3.14×(外半徑－內半徑)² 計算。","answer":"false","hint":"兩個圓應先各自平方。","steps":["圓環面積應為 π×(R²－r²)，所以這句話錯誤。"]}],"power":[{"variant":"conceptPower","type":"choice","title":"能源觀念","question":"求圓形能源場的鋪設面積，應使用哪個公式？","choices":["π×半徑²","2π×半徑","π×直徑"],"answer":"A","hint":"題目問的是平面面積。","steps":["鋪設面積＝π×半徑×半徑。"]},{"variant":"truePower","type":"trueFalse","title":"能源是非題","question":"圓形能源場面積是 78.5 平方公里時，可以反推半徑是 5 公里。","answer":"true","hint":"用面積除以 3.14。","steps":["78.5÷3.14＝25，5×5＝25，因此半徑是 5 公里。"]}]};
export const CONCEPT_VARIANTS = Object.fromEntries(Object.entries(CONCEPT_BANK).map(([k,items])=>[k,items.map(x=>x.variant)]));
const decorate=(task,rng)=>({...task,question:choose(TASK_SCENARIOS[task.kind],rng)+' '+task.question});

export function makeVariedTask(kind='forest', difficulty='standard', rng=Math.random, excludeVariant=null) {
  const all=TASK_VARIANTS[kind];
  if (!all) throw new Error('無效的任務類型');
  const max=difficulty==='basic'?6:difficulty==='advanced'?all.length:8;
  const pool=[...all.slice(0,max),...CONCEPT_VARIANTS[kind]];
  const options=pool.filter(v=>v!==excludeVariant);
  const variant=choose(options.length?options:pool,rng);
  const quiz=CONCEPT_BANK[kind].find(x=>x.variant===variant);
  if(quiz){
    const choices=quiz.type==='trueFalse'?[{value:'true',label:'正確（○）'},{value:'false',label:'錯誤（×）'}]:quiz.choices.map((label,i)=>({value:['A','B','C'][i],label}));
    return decorate({id:randomUUID(),kind,variant,title:quiz.title,question:quiz.question,answer:quiz.answer,type:quiz.type,choices,formula:null,unit:null,steps:quiz.steps,hint:quiz.hint,context:'答對觀念題也能完成一項建設。',pi:PI,difficulty},rng);
  }
  if (kind!=='power' && OLD[kind].includes(variant)) {
    const idx=OLD[kind].indexOf(variant);
    let first=true;
    const forcedVariantThenRandom=()=>{if(first){first=false;return (idx+.01)/OLD[kind].length;}return rng();};
    return decorate({...oldTask(kind,'advanced',forcedVariantThenRandom),difficulty},rng);
  }
  const r=5;
  const r2=choose([10,15,20,25],rng);
  const mkT=(title,q,a,f,u,steps,hint,context='完成這項工程可以改善星球環境。') =>
    decorate(mk(kind,variant,title,q,a,f,u,steps,hint,context,difficulty),rng);
  if(kind==='forest') {
    if(variant==='forestPairs') {
      const n=choose([2,3],rng),a=n*area(r);
      return mkT('多片森林面積', '預計種植 '+n+' 片半徑 '+r+' 公里的圓形森林，總造林面積是多少平方公里？',a,'area','km²',['一片：3.14 × '+r+' × '+r+' = '+fmt(area(r)),n+' 片合計 = '+fmt(a)],'先算一片圓形森林，再乘上森林片數。');
    }
    if(variant==='forestInner') {
      const outer=r+5,inner=r,a=area(outer)-area(inner);
      return mkT('保留湖泊的造林區','半徑 '+outer+' 公里的綠化區中央要留半徑 '+inner+' 公里的湖泊，剩餘可種樹面積是多少平方公里？',a,'ring','km²',['3.14 × ('+outer+'² − '+inner+'²) = '+fmt(a)],'中央保留的湖泊不能種樹，應以大圓面積減小圓面積。');
    }
    if(variant==='reverseDiameter') {
      const d=2*r;
      return mkT('依森林面積求直徑','一片圓形森林面積是 '+fmt(area(r))+' 平方公里，它的直徑是多少公里？',d,'reverseArea','km',['面積 ÷ 3.14 = '+r*r+'，半徑 = '+r,'直徑 = '+r+' × 2 = '+d],'面積除以 3.14 得到半徑平方，求出半徑後還要乘 2。');
    }
    if(variant==='forestHalf') {
      const a=area(10)/2;
      return mkT('半圓形森林','一座半徑 10 公里的圓形公園，其中一半要栽種樹木。森林面積有多少平方公里？',a,'area','km²',['完整面積：3.14 × 10 × 10 = 314','栽種一半：314 ÷ 2 = '+fmt(a)],'先求完整圓的面積，最後除以 2。');
    }
    const big=r+5,a=area(big)-area(r);
    return mkT('補植受損綠地','原本半徑 '+big+' 公里的森林中央有半徑 '+r+' 公里的枯萎區。健康的環形森林面積有多少平方公里？',a,'ring','km²',['大圓面積：'+fmt(area(big)),'大圓減枯萎內圓：'+fmt(area(big))+' − '+fmt(area(r))+' = '+fmt(a)],'先算大圓面積，再減掉枯萎的內圓面積。');
  }
  if(kind==='orbit') {
    if(variant==='threeLaps') {
      const loops=choose([3,4],rng),a=2*PI*r*loops;
      return mkT('巡航多圈總路程','半徑 '+r+' 公里的巡航軌道需要飛 '+loops+' 圈，總路程多少公里？',a,'circumference','km',['一圈：2 × 3.14 × '+r+' = '+fmt(2*PI*r),'總長度：'+fmt(2*PI*r)+' × '+loops+' = '+fmt(a)],'求出一圈的圓周長，乘上圈數。');
    }
    if(variant==='circDifference') {
      const outer=r+5,a=2*PI*(outer-r);
      return mkT('比較兩圈軌道','內軌道半徑 '+r+' 公里、外軌道半徑 '+outer+' 公里，外圈比內圈長多少公里？',a,'circumference','km',['周長差 = 2 × 3.14 × ('+outer+' − '+r+') = '+fmt(a)],'分別算兩個圓周長後相減，或用半徑差乘 2π。');
    }
    if(variant==='reverseDiameter') {
      const d=2*r,a=PI*d;
      return mkT('從周長求衛星直徑','導航站測得衛星軌道周長是 '+fmt(a)+' 公里，這條軌道直徑是多少公里？',d,'reverseCirc','km',['半徑：'+fmt(a)+' ÷ (2 × 3.14) = '+r,'直徑：'+r+' × 2 = '+d],'先由周長求半徑，再乘 2 才是直徑。');
    }
    if(variant==='twinSatellites') {
      const a=2*PI*r*2;
      return mkT('雙衛星巡航','兩顆衛星各自沿半徑 '+r+' 公里的軌道巡航一圈，飛行總路程是多少公里？',a,'circumference','km',['一顆：2 × 3.14 × '+r+' = '+fmt(2*PI*r),'兩顆合計 = '+fmt(a)],'兩顆衛星各飛一圈，計算兩個周長的總和。');
    }
    const outer=r+5,a=2*PI*outer;
    return mkT('防護圈外移','星球防護圈原本半徑 '+r+' 公里，改往外移 5 公里。新防護圈一圈長多少公里？',a,'circumference','km',['新半徑 = '+r+' + 5 = '+outer,'新周長 = 2 × 3.14 × '+outer+' = '+fmt(a)],'求的是新周長，不是增加的長度；先把半徑加 5。');
  }
  if(kind==='crater') {
    if(variant==='twoCraters') {
      const a=2*area(r);
      return mkT('修復兩座圓形坑','有兩個半徑都是 '+r+' 公里的圓形隕石坑。兩坑共需修補多少平方公里？',a,'area','km²',['單座面積：'+fmt(area(r)),'兩座合計：'+fmt(a)],'先算一個圓形坑的面積，再乘 2。');
    }
    if(variant==='ringReverseInner') {
      const outer=r+5, damaged=area(outer)-area(r);
      return mkT('推算安全核心半徑','隕石坑外半徑 '+outer+' 公里，已知損壞圓環面積 '+fmt(damaged)+' 平方公里，未損壞的內圓半徑是多少公里？',r,'ring','km',['完整面積：'+fmt(area(outer)),'內圓面積：'+fmt(area(outer))+' − '+fmt(damaged)+' = '+fmt(area(r)),'內圓半徑 = '+r],'先用大圓面積扣掉受損圓環，再由內圓面積反求半徑。');
    }
    if(variant==='damagedHalf') {
      const a=area(10)/2;
      return mkT('修復半圓裂縫','有一塊半徑 10 公里的半圓形裂縫。修復面積是多少平方公里？',a,'area','km²',['完整圓面積：3.14 × 10 × 10 = 314','半圓面積：314 ÷ 2 = '+fmt(a)],'先算完整圓面積，再除以 2。');
    }
    if(variant==='circleRepair') {
      return mkT('修補圓形撞擊坑','一個圓形隕石坑直徑是 '+2*r+' 公里，坑洞面積是多少平方公里？',area(r),'area','km²',['半徑 = '+2*r+' ÷ 2 = '+r,'面積 = 3.14 × '+r+' × '+r+' = '+fmt(area(r))],'這次不是圓環！題目只有一個圓形坑洞，先將直徑除以 2。');
    }
    const outer=r+5,a=area(outer)-area(r);
    return mkT('湖岸防護工程','圓形湖泊半徑 '+r+' 公里，沿湖岸向外鋪設寬 5 公里的環狀防洪帶。施工面積多少平方公里？',a,'ring','km²',['外半徑 = '+r+' + 5 = '+outer,'圓環 = 3.14 × ('+outer+'² − '+r+'²) = '+fmt(a)],'寬度要加到半徑，不能只用 10 當外半徑。');
  }
  if(variant==='solarArea') {
    return mkT('建造太陽能農場','太陽能板鋪成半徑 '+r+' 公里的圓形區域，總鋪設面積是多少平方公里？',area(r),'area','km²',['3.14 × '+r+' × '+r+' = '+fmt(area(r))],'計算圓形面積，需要半徑乘自己。','鋪設太陽能板後星球能源增加。');
  }
  if(variant==='solarDiameter') {
    return mkT('由直徑求能量場','能量場直徑 '+2*r+' 公里，面積是多少平方公里？',area(r),'area','km²',['半徑 = '+2*r+' ÷ 2 = '+r,'面積 = '+fmt(area(r))],'先把直徑除以 2 才能算面積。');
  }
  if(variant==='solarRadius') {
    return mkT('反推能量場半徑','圓形能源場面積為 '+fmt(area(r))+' 平方公里，半徑應設多少公里？',r,'reverseArea','km',['半徑平方：'+fmt(area(r))+' ÷ 3.14 = '+r*r,'半徑 = '+r],'先算面積 ÷ 3.14，找出平方後的半徑。');
  }
  if(variant==='solarRing') {
    const outer=r+5,a=area(outer)-area(r);
    return mkT('環形太陽能板','核心區半徑 '+r+' 公里，太陽能板鋪到外半徑 '+outer+' 公里，圓環面積是多少平方公里？',a,'ring','km²',['3.14 × ('+outer+'² − '+r+'²) = '+fmt(a)],'內圈不能裝設太陽能板，應算圓環。');
  }
  if(variant==='solarExpansion') {
    const outer=r+5,a=area(outer)-area(r);
    return mkT('擴張能源採集圈','能源場從半徑 '+r+' 公里擴張到 '+outer+' 公里，增加多少平方公里？',a,'ring','km²',['3.14 × ('+outer+'² − '+r+'²) = '+fmt(a)],'算的是新增的外環，不是擴張後全部面積。');
  }
  if(variant==='energyWire') {
    const a=2*PI*r;
    return mkT('鋪設輸電環線','半徑 '+r+' 公里的圓形能源站周圍需要一圈輸電線，長度多少公里？',a,'circumference','km',['2 × 3.14 × '+r+' = '+fmt(a)],'電線圍一圈，算周長而不是面積。');
  }
  if(variant==='twoArrays') {
    const a=2*area(r);
    return mkT('雙座發電站','兩座相同的圓形電站，每座半徑 '+r+' 公里，兩座總面積多少平方公里？',a,'area','km²',['單座面積 = '+fmt(area(r)),'兩座總面積 = '+fmt(a)],'先算一座的面積，再乘兩座。');
  }
  if(variant==='collectorCircle') {
    const d=2*r;
    return mkT('能量罩直徑','能源收集罩的面積是 '+fmt(area(r))+' 平方公里，它的直徑要多少公里？',d,'reverseArea','km',['面積 ÷ 3.14 = '+r*r,'半徑 '+r+'，直徑 '+d],'面積除圓周率後得到半徑平方，最後還要乘 2。');
  }
  if(variant==='solarPerimeter') {
    const a=PI*2*r;
    return mkT('圈出能源保護線','圓形發電區直徑是 '+2*r+' 公里，保護線一圈長多少公里？',a,'circumference','km',['3.14 × '+2*r+' = '+fmt(a)],'題目問一圈長度，可以直接用直徑乘圓周率。');
  }
  const inner=r,outer=r+5,a=area(outer)-area(inner);
  return mkT('能源站環形通道','能源核心半徑 '+inner+' 公里，外面設寬 5 公里環形通道，通道面積多少平方公里？',a,'ring','km²',['外半徑 = '+outer,'3.14 × ('+outer+'² − '+inner+'²) = '+fmt(a)],'核心區不算通道面積，使用大圓減小圓。');
}
