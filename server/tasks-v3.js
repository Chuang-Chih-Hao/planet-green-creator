import { randomUUID } from 'node:crypto';
import { TASK_VARIANTS as OLD } from './tasks-v2.js';
import { makeEstimationTask } from './estimation-tasks.js';

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
    const choices=quiz.type==='trueFalse'?[{value:'true',label:'正確（○）'},{value:'false',label:'錯誤（×）'}]:[...quiz.choices,({'forest':'16 倍','orbit':'3 倍','crater':'兩個圓面積相加','power':'π × 半徑'})[kind]].map((label,i)=>({value:['A','B','C','D'][i],label}));
    return decorate({id:randomUUID(),kind,variant,title:quiz.title,question:quiz.question,answer:quiz.answer,type:quiz.type,choices,formula:null,unit:null,steps:quiz.steps,hint:quiz.hint,context:'答對觀念題也能完成一項建設。',pi:PI,difficulty},rng);
  }
  return makeEstimationTask(kind,variant,difficulty,rng,all.indexOf(variant));
}
