// 每次宇宙事件即使類型相同，也抽取不同的數學題型與整潔數值。
import { randomUUID } from 'node:crypto';
const PI=3.14;
const pick=(a,rng)=>a[Math.min(a.length-1,Math.max(0,Math.floor(rng()*a.length)))];
const fmt=n=>String(Number(n.toFixed(1)));
const area=r=>PI*r*r;
const mk=(variant,question,answer,formula,unit,steps,hint)=>({id:randomUUID(),variant,question,answer:Number(answer.toFixed(1)),formula,unit,steps,hint});
export const EVENT_VARIANTS={
  meteor:['ring','diameters','width','double','core'],
  flare:['orbitHeight','diameter','doubleLoop','reverse','shieldArea'],
  rain:['circle','diameter','reverse','double','rainRing'],
  alien:['perimeter','reverse','landing','loops','navigationRing']
};
export function makeEventTask(id,rng=Math.random,exclude=null) {
  const all=EVENT_VARIANTS[id]; if(!all) throw new Error('未知的宇宙事件');
  const variant=pick(all.filter(v=>v!==exclude).length?all.filter(v=>v!==exclude):all,rng);
  const r=5;
  if(id==='meteor'){
    const outer=r+5;
    if(variant==='ring') {
      const answer=area(outer)-area(r);
      return mk(variant,'隕石坑外半徑 '+outer+' km、內半徑 '+r+' km，待修復圓環面積是多少km²？',answer,'ring','km²',['3.14 × ('+outer+'² - '+r+'²) = '+fmt(answer)],'大圓面積減小圓面積，注意兩個半徑要分別平方。');
    }
    if(variant==='diameters'){
      const a=area(outer)-area(r);
      return mk(variant,'隕石坑外直徑 '+2*outer+' km、內直徑 '+2*r+' km，環狀破壞面積是多少km²？',a,'ring','km²',['外半徑 '+outer+'；內半徑 '+r,'面積差 = '+fmt(a)],'直徑要先除以 2，再用圓環面積公式。');
    }
    if(variant==='width'){
      const a=area(outer)-area(r);
      return mk(variant,'隕石擊中核心半徑 '+r+' km的區域，外圍又裂開寬 5 km的環帶。受損環帶面積是多少km²？',a,'ring','km²',['外半徑 = '+r+' + 5 = '+outer,'圓環面積 = '+fmt(a)],'環帶外半徑要將原本半徑加上寬度。');
    }
    if(variant==='double'){
      const a=2*area(r);
      return mk(variant,'兩個相同的圓形隕石坑，半徑都是 '+r+' km，修復總面積是多少km²？',a,'area','km²',['單一坑面積＝'+fmt(area(r)),'兩個合計＝'+fmt(a)],'先求一個圓形面積，再乘上 2。');
    }
    return mk(variant,'隕石坑外半徑 '+outer+' km，受損圓環面積 '+fmt(area(outer)-area(r))+' km²，安全核心半徑幾km？',r,'ring','km',['內圓面積 = '+fmt(area(outer))+' - '+fmt(area(outer)-area(r))+' = '+fmt(area(r)),'反推內圓半徑 = '+r],'先扣除受損圓環面積，得到安全核心的圓面積。');
  }
  if(id==='flare'){
    if(variant==='orbitHeight'){
      const a=2*PI*(r+5);
      return mk(variant,'星球半徑 '+r+' km，防護軌道離地表 5 km，防護衛星繞一圈多少km？',a,'circumference','km',['軌道半徑 = '+r+' + 5 = '+(r+5),'周長 = '+fmt(a)],'先將距離地表的高度加進半徑。');
    }
    if(variant==='diameter'){
      const a=2*PI*r;
      return mk(variant,'風暴來襲，防護罩直徑 '+2*r+' km，周圍護盾導線總長多少km？',a,'circumference','km',['3.14 × '+2*r+' = '+fmt(a)],'已知直徑，可用直徑直接乘圓周率。');
    }
    if(variant==='doubleLoop'){
      const a=4*PI*r;
      return mk(variant,'雙層巡航衛星沿半徑 '+r+' km軌道各飛一圈，合計飛行多少km？',a,'circumference','km',['一圈 = '+fmt(2*PI*r),'兩圈 = '+fmt(a)],'把一圈周長乘上 2。');
    }
    if(variant==='reverse'){
      const a=2*PI*r;
      return mk(variant,'太陽風暴將影響周長 '+fmt(a)+' km的防護圓軌道。求半徑多少km？',r,'reverseCirc','km',['半徑 = '+fmt(a)+' ÷ (2 × 3.14) = '+r],'周長反求半徑，除以 2π。');
    }
    return mk(variant,'抗風暴護盾覆蓋半徑 '+r+' km的圓形區域，覆蓋面積是多少km²？',area(r),'area','km²',['3.14 × '+r+' × '+r+' = '+fmt(area(r))],'這題求護盾覆蓋面積，不是圓周長。');
  }
  if(id==='rain'){
    if(variant==='circle'){
      return mk(variant,'集水罩是半徑 '+r+' km的圓形區域，能接住雨的面積是多少km²？',area(r),'area','km²',['3.14 × '+r+' × '+r+' = '+fmt(area(r))],'面積是半徑平方乘上 3.14。');
    }
    if(variant==='diameter'){
      return mk(variant,'新集水區直徑 '+2*r+' km，能收集星際雨的面積是多少km²？',area(r),'area','km²',['半徑 = '+r,'面積 = '+fmt(area(r))],'已知的是直徑，先求半徑。');
    }
    if(variant==='reverse'){
      return mk(variant,'星際水循環需要 '+fmt(area(r))+' km²的圓形集水場，應設半徑多少km？',r,'reverseArea','km',['半徑平方 = '+fmt(area(r))+' ÷ 3.14 = '+r*r,'半徑 = '+r],'先用面積除以圓周率，再找出半徑。');
    }
    if(variant==='double'){
      return mk(variant,'兩個半徑 '+r+' km的集水池一起收雨，總面積是多少km²？',2*area(r),'area','km²',['一池 = '+fmt(area(r)),'兩池 = '+fmt(2*area(r))],'兩座集水池，要將單座圓面積乘 2。');
    }
    const outer=r+5,a=area(outer)-area(r);
    return mk(variant,'集水環帶內半徑 '+r+' km，向外寬 5 km，收雨的環形面積多少km²？',a,'ring','km²',['外半徑 = '+(r+5),'圓環面積 = '+fmt(a)],'環狀收集區需要算大圓減小圓。');
  }
  if(variant==='perimeter'){
    return mk(variant,'外星船繞直徑 '+2*r+' km的星環一圈，飛行距離多少km？',2*PI*r,'circumference','km',['3.14 × '+2*r+' = '+fmt(2*PI*r)],'已給直徑，直接用圓周長公式。');
  }
  if(variant==='reverse'){
    return mk(variant,'外星導航軌道的周長是 '+fmt(2*PI*r)+' km，半徑是多少km？',r,'reverseCirc','km',['半徑 = '+fmt(2*PI*r)+' ÷ (2 × 3.14) = '+r],'用周長除以 2π 求半徑。');
  }
  if(variant==='landing'){
    return mk(variant,'外星船的圓形降落區半徑 '+r+' km，面積是多少km²？',area(r),'area','km²',['3.14 × '+r+' × '+r+' = '+fmt(area(r))],'求降落區面積，半徑要乘兩次。');
  }
  if(variant==='loops'){
    return mk(variant,'外星探測船沿半徑 '+r+' km的軌道連飛 3 圈，總長多少km？',6*PI*r,'circumference','km',['一圈 = '+fmt(2*PI*r),'三圈 = '+fmt(6*PI*r)],'先算一圈，再乘 3。');
  }
  const outer=r+5,a=area(outer)-area(r);
  return mk(variant,'外星基地需要半徑 '+outer+' km的圓形平台，中央半徑 '+r+' km不可施工。剩餘可建面積多少km²？',a,'ring','km²',['3.14 × ('+outer+'² - '+r+'²) = '+fmt(a)],'外圓面積扣掉中央保留的內圓。');
}
