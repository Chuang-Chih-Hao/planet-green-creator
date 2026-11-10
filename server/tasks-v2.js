import { randomUUID } from 'node:crypto';

// 題目數值刻意選用整數半徑、易於辨識的直徑，以及多為整數／一位小數的結果。
const PI = 3.14;
const pick = (items, rng) => items[Math.min(items.length - 1, Math.floor(Math.max(0, rng()) * items.length))];
const number = n => Number(n.toFixed(2));
const fmt = n => String(number(n));
const make = (kind, variant, title, question, answer, formula, unit, steps, hint, context) => ({
  id: randomUUID(), kind, variant, title, question, answer: number(answer), formula, unit, steps, hint, context, pi: PI
});

export const TASK_VARIANTS = {
  forest: ['radiusArea', 'diameterArea', 'reverseArea', 'newForest', 'biggerForest'],
  orbit: ['radiusLoop', 'diameterLoop', 'orbitHeight', 'twoLaps', 'reverseLoop'],
  crater: ['ringRadius', 'ringDiameter', 'ringWidth', 'ringRoad', 'ringDifference']
};

export function makeVariedTask(kind = 'forest', difficulty = 'standard', rng = Math.random, excludeVariant = null) {
  if (!TASK_VARIANTS[kind]) throw new Error('無效的任務類型');
  const maximum = difficulty === 'basic' ? 3 : difficulty === 'advanced' ? 5 : 4;
  const eligible = TASK_VARIANTS[kind].slice(0, maximum);
  const variants = eligible.filter(v => v !== excludeVariant);
  const variant = pick(variants.length ? variants : eligible, rng);
  const radii = difficulty === 'advanced' ? [5, 10, 15, 20, 25] : [5, 10, 15, 20];
  let t;
  if (kind === 'forest') {
    if (variant === 'radiusArea') {
      const r = pick(radii, rng), area = PI * r ** 2;
      t = make(kind, variant, '計算森林面積', `生態工程師規劃半徑 ${r} 公里的圓形森林。這片森林的面積是多少平方公里？`, area, 'area', 'km²', [`3.14 × ${r} × ${r}`, `= ${fmt(area)} 平方公里`], '半徑要乘兩次，最後記得使用平方單位。', '森林面積決定氧氣生產範圍。');
    } else if (variant === 'diameterArea') {
      const d = pick([10, 20, 30, 40], rng), r = d / 2, area = PI * r ** 2;
      t = make(kind, variant, '由直徑求森林面積', `衛星掃描顯示新森林的直徑是 ${d} 公里，森林面積是多少平方公里？`, area, 'area', 'km²', [`半徑 = ${d} ÷ 2 = ${r} 公里`, `3.14 × ${r} × ${r} = ${fmt(area)} 平方公里`], '題目給直徑，先除以 2 才是半徑。', '先判讀尺寸，再設置植樹範圍。');
    } else if (variant === 'reverseArea') {
      const r = pick(radii, rng), area = PI * r ** 2;
      t = make(kind, variant, '由面積反求半徑', `森林管理站需要 ${fmt(area)} 平方公里的圓形造林區。造林機應設定半徑幾公里？`, r, 'reverseArea', 'km', [`半徑 × 半徑 = ${fmt(area)} ÷ 3.14 = ${r * r}`, `${r} × ${r} = ${r * r}，所以半徑 = ${r} 公里`], '先用面積除以 3.14，得到「半徑 × 半徑」。', '從目標面積推算造林機半徑。');
    } else if (variant === 'newForest') {
      const [oldR, newR] = pick([[5,10],[10,15],[10,20],[15,20]], rng), area = PI * (newR ** 2 - oldR ** 2);
      t = make(kind, variant, '擴建森林面積', `原本森林半徑 ${oldR} 公里，要向外擴大到半徑 ${newR} 公里。新增的綠地有多少平方公里？`, area, 'ring', 'km²', [`大圓 − 小圓 = 3.14 × (${newR} × ${newR} − ${oldR} × ${oldR})`, `= ${fmt(area)} 平方公里`], '只計算「新增的外圈」，原有森林不能重算。', '將成長的森林外環加入氧氣系統。');
    } else {
      const [a,b] = pick([[5,10],[10,20],[10,15]], rng), diff = PI * (b ** 2 - a ** 2);
      t = make(kind, variant, '比較兩座森林', `甲森林半徑 ${a} 公里，乙森林半徑 ${b} 公里。乙森林比甲森林多多少平方公里？`, diff, 'ring', 'km²', [`面積差 = 3.14 × (${b} × ${b} − ${a} × ${a})`, `= ${fmt(diff)} 平方公里`], '兩個森林分別算面積，再做大減小。', '比較綠化方案的土地效益。');
    }
  } else if (kind === 'orbit') {
    if (variant === 'radiusLoop') {
      const r = pick(radii, rng), c = 2 * PI * r;
      t = make(kind, variant, '衛星繞行一周', `防護衛星的圓形巡航軌道半徑是 ${r} 公里。繞行一圈要飛多少公里？`, c, 'circumference', 'km', [`2 × 3.14 × ${r} = ${fmt(c)} 公里`], '用圓周長 = 2 × π × 半徑。', '正確算出巡航路程才能布署衛星。');
    } else if (variant === 'diameterLoop') {
      const d = pick([10,20,30,40], rng), c = PI * d;
      t = make(kind, variant, '用直徑求星環長度', `星環軌道的直徑是 ${d} 公里。要安裝多少公里長的環形導線？`, c, 'circumference', 'km', [`3.14 × ${d} = ${fmt(c)} 公里`], '知道直徑，可直接用 π × 直徑。', '製造星環所需的環形導線。');
    } else if (variant === 'orbitHeight') {
      const [r,h] = pick([[5,5],[10,5],[10,10],[15,5]], rng), orbitalR = r + h, c = 2 * PI * orbitalR;
      t = make(kind, variant, '計算高空軌道', `星球半徑 ${r} 公里，軌道離地表 ${h} 公里。衛星完整繞行一圈有多長？`, c, 'circumference', 'km', [`軌道半徑 = ${r} + ${h} = ${orbitalR}`, `2 × 3.14 × ${orbitalR} = ${fmt(c)} 公里`], '軌道半徑是從星球中心量起，別忘記加上離地高度。', '確定衛星的外圍巡航長度。');
    } else if (variant === 'twoLaps') {
      const [r,laps] = pick([[5,2],[10,2],[10,3],[15,2]],rng), c = 2 * PI * r * laps;
      t = make(kind, variant, '多圈巡航任務', `巡航半徑 ${r} 公里的衛星必須繞行 ${laps} 圈，總飛行距離是多少公里？`, c, 'circumference', 'km', [`一圈 = 2 × 3.14 × ${r} = ${fmt(2 * PI * r)}`, `${laps} 圈 = ${fmt(2 * PI * r)} × ${laps} = ${fmt(c)} 公里`], '先求一圈的周長，再乘上圈數。', '估算衛星巡航的總電力消耗。');
    } else {
      const r = pick([5,10,15,20],rng), c = 2 * PI * r;
      t = make(kind, variant, '由周長反求軌道半徑', `導航站測得星環周長是 ${fmt(c)} 公里。這條圓形軌道的半徑是多少公里？`, r, 'reverseCirc', 'km', [`半徑 = ${fmt(c)} ÷ (2 × 3.14)`, `= ${r} 公里`], '將圓周長除以「2 × 3.14」。', '算出半徑才能正確定位衛星。');
    }
  } else {
    if (variant === 'ringRadius') {
      const [outer,inner] = pick([[10,5],[15,5],[20,10],[25,15]],rng), area = PI * (outer ** 2 - inner ** 2);
      t = make(kind, variant, '修復環形隕石坑', `隕石坑外圈半徑 ${outer} 公里，保留區半徑 ${inner} 公里。需要修復多少平方公里的圓環？`, area, 'ring', 'km²', [`3.14 × (${outer}² − ${inner}²)`, `= ${fmt(area)} 平方公里`], '大圓面積減小圓面積，不能把半徑差直接平方。', '填補環狀地表裂縫。');
    } else if (variant === 'ringDiameter') {
      const [od,id] = pick([[20,10],[30,10],[40,20],[50,30]],rng), outer=od/2, inner=id/2, area=PI*(outer**2-inner**2);
      t = make(kind, variant, '由直徑修復圓環', `受損外圈直徑 ${od} 公里，內圈直徑 ${id} 公里。環狀受損面積有多少平方公里？`, area, 'ring', 'km²', [`外半徑 ${od} ÷ 2 = ${outer}；內半徑 ${id} ÷ 2 = ${inner}`, `3.14 × (${outer}² − ${inner}²) = ${fmt(area)} 平方公里`], '直徑要先各自除以 2。', '定位雙層圓形損壞區。');
    } else if (variant === 'ringWidth') {
      const [inner,width] = pick([[5,5],[10,5],[10,10],[15,5]],rng), outer=inner+width, area=PI*(outer**2-inner**2);
      t = make(kind, variant, '鋪設環形修復帶', `核心保護區半徑 ${inner} 公里，外面要鋪寬 ${width} 公里的環形修復帶。要鋪多少平方公里？`, area, 'ring', 'km²', [`外半徑 = ${inner} + ${width} = ${outer}`, `3.14 × (${outer}² − ${inner}²) = ${fmt(area)} 平方公里`], '先算出大圓半徑：內半徑＋環帶寬。', '為生命核心鋪設保護帶。');
    } else if (variant === 'ringRoad') {
      const [outer,inner] = pick([[15,5],[20,10],[25,15]],rng), area=PI*(outer**2-inner**2);
      t = make(kind, variant, '規劃環形道路', `要在半徑 ${outer} 公里的圓形地形裡，保留中央半徑 ${inner} 公里的湖泊。道路可用面積是多少平方公里？`, area, 'ring', 'km²', [`道路面積 = 3.14 × ${outer}² − 3.14 × ${inner}²`, `= ${fmt(area)} 平方公里`], '地形可用面積不是大圓全部，而是大圓減掉湖泊。', '讓星球交通繞過保護水域。');
    } else {
      const [big,small] = pick([[1256,314],[706.5,78.5],[1962.5,706.5]],rng);
      t = make(kind, variant, '已知面積求修復量', `修復工程的外圓面積是 ${fmt(big)} 平方公里，中央不可施工區為 ${fmt(small)} 平方公里。實際可修復面積是多少？`, big-small, 'ring', 'km²', [`${fmt(big)} − ${fmt(small)} = ${fmt(big-small)} 平方公里`], '外圓面積減內圓面積。', '用現有探測資料估算施工量。');
    }
  }
  return { ...t, difficulty };
}
