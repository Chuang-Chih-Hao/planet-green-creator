// V1.7: estimation-focused four-choice math tasks with varied numbers and believable distractors.
import { randomUUID } from 'node:crypto';

const PI=3.14;
const pick=(items,rng)=>items[Math.min(items.length-1,Math.max(0,Math.floor(rng()*items.length)))];
const fmt=n=>String(Number(n.toFixed(1)));
const area=r=>PI*r*r;
const circ=r=>2*PI*r;
const radiusOptions=[4,5,6,7,8,9,10,12,14];
const shortOptions=[3,4,5,6,7,8,9,10];
const length=n=>String(n)+' 公里';
const surface=n=>String(n)+' 平方公里';
const sq=(r)=>r+' × '+r;
const areaMethod=(r)=>'3 × '+sq(r)+' ≈ '+fmt(3*r*r);
const circMethod=(r)=>'2 × 3 × '+r+' ≈ '+fmt(6*r);

const contexts={
 forest:['森林','綠化區','植物保護區','造林基地','原生林'],
 orbit:['衛星軌道','防護星環','巡航路線','環形雷達','導航圈'],
 crater:['修復區','隕石坑','水土復育帶','坑洞','環形裂縫'],
 power:['能源站','太陽能場','發電基地','光能採集區','儲能圈']
};
function specification(kind,variantIndex,rng){
 const r=pick(radiusOptions,rng),s=pick(shortOptions,rng);
 const inside=pick([3,4,5,6,7],rng);
 const outer=inside+pick([3,4,5,6,7],rng);
 const another=pick([4,5,6,7,8,9,10,12,14].filter(v=>v!==r),rng);
 const n=pick([2,3],rng);
 const noun=pick(contexts[kind],rng);
 const ringArea=area(outer)-area(inside);
 const ringEstimate=3*(outer*outer-inside*inside);
 const spec=(title,question,exact,unit,reason,hint,method)=>({title,question,exact,unit,reason,hint,method});
 if(kind==='forest'){
  switch(variantIndex){
   case 0:return spec('估算森林面積',noun+'的半徑為 '+r+' 公里，面積大約是多少？',area(r),'km²',areaMethod(r),'用 π 約等於 3，半徑要乘兩次。','area');
   case 1:return spec('由直徑估算面積',noun+'的直徑為 '+(2*r)+' 公里，面積大約是多少？',area(r),'km²','直徑先除以 2，半徑 '+r+'，再算 '+areaMethod(r),'先把直徑除以 2。','area');
   case 2:return spec('由面積估算半徑',noun+'的面積大約是 '+fmt(3*r*r)+' 平方公里，半徑大約是幾公里？',r,'km',fmt(3*r*r)+' ÷ 3 ≈ '+r*r+'，所以半徑約 '+r,'先把面積除以 3，再找接近的平方數。','radius');
   case 3:return spec('森林擴建',noun+'原半徑 '+inside+' 公里，擴建至 '+outer+' 公里。新增面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'新增的是外環，不是擴建後的全部面積。','ring');
   case 4:return spec('比較森林面積','甲森林半徑 '+another+' 公里，乙森林半徑 '+r+' 公里。兩者面積差大約多少？',Math.abs(area(r)-area(another)),'km²','3 × |'+r+'²－'+another+'²| ≈ '+fmt(3*Math.abs(r*r-another*another)),'面積差先各算半徑平方，再做相減。','ring');
   case 5:return spec('多座造林基地','有 '+n+' 片半徑 '+s+' 公里的圓形森林，總面積大約是多少？',n*area(s),'km²',n+' × '+areaMethod(s)+' ≈ '+fmt(3*n*s*s),'算出一片森林的面積，再乘片數。','area');
   case 6:return spec('森林環帶',noun+'要保留半徑 '+inside+' 公里的湖泊，外圈半徑 '+outer+' 公里。可栽種面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'環帶面積＝大圓面積－小圓面積。','ring');
   case 7:return spec('森林防護圍籬',noun+'半徑 '+s+' 公里，需要沿邊緣設圍籬。一圈約多少公里？',circ(s),'km',circMethod(s),'圍籬是一圈長度，應算周長。','circ');
   case 8:return spec('半圓造林',noun+'半徑 '+r+' 公里，只開發一半面積。造林面積約多少？',area(r)/2,'km²',areaMethod(r)+'，再除以 2 ≈ '+fmt(1.5*r*r),'半圓面積是整個圓的一半。','area');
   default:return spec('反推森林直徑',noun+'的面積大約是 '+fmt(3*r*r)+' 平方公里，直徑大約幾公里？',2*r,'km','先求半徑約 '+r+'，直徑 ≈ '+(2*r),'由面積估算半徑，再乘 2。','radius');
  }
 }
 if(kind==='orbit'){
  switch(variantIndex){
   case 0:return spec('估算衛星軌道',noun+'半徑 '+r+' 公里，繞行一圈大約多長？',circ(r),'km',circMethod(r),'周長約等於 6 × 半徑。','circ');
   case 1:return spec('從直徑估算軌道',noun+'直徑 '+(2*r)+' 公里，一圈約多少公里？',circ(r),'km','3 × '+(2*r)+' ≈ '+(6*r),'周長≈3×直徑。','circ');
   case 2:return spec('從周長反求半徑',noun+'的周長大約 '+(6*r)+' 公里，半徑約是多少？',r,'km',(6*r)+' ÷ 6 ≈ '+r,'周長約等於 6 倍半徑。','radius');
   case 3:return spec('多圈衛星巡航','衛星沿半徑 '+s+' 公里的軌道繞 '+n+' 圈，總飛行距離約多少？',circ(s)*n,'km',n+' × '+circMethod(s)+' ≈ '+(n*6*s),'先求一圈周長，再乘圈數。','circ');
   case 4:return spec('加高衛星軌道','星球半徑 '+inside+' 公里，衛星離地面 '+s+' 公里，軌道一圈約多長？',circ(inside+s),'km','軌道半徑 '+inside+'＋'+s+'＝'+(inside+s)+'，再乘 6 ≈ '+(6*(inside+s)),'先加上離地高度，才能得到軌道半徑。','circ');
   case 5:return spec('雙衛星巡航','兩顆衛星各繞半徑 '+s+' 公里的軌道一圈，合計距離約多少？',2*circ(s),'km','2 × ('+circMethod(s)+') ≈ '+(12*s),'先估算一圈周長，再乘 2。','circ');
   case 6:return spec('比較兩個軌道','外軌道半徑 '+outer+' 公里、內軌道半徑 '+inside+' 公里，兩個周長約差多少？',circ(outer)-circ(inside),'km','6 × ('+outer+'－'+inside+') ≈ '+(6*(outer-inside)),'周長差≈6×半徑差。','circ');
   case 7:return spec('反求軌道直徑',noun+'一圈約 '+(6*r)+' 公里，直徑大約多長？',2*r,'km','半徑約 '+(6*r)+'÷6＝'+r+'，直徑約 '+(2*r),'由周長推半徑，再乘 2。','radius');
   case 8:return spec('多艘巡航艇',n+' 艘巡航艇各繞半徑 '+s+' 公里的軌道一圈，總路程約多少？',n*circ(s),'km',n+' × 6 × '+s+' ≈ '+(6*n*s),'每艘一圈的路程要乘飛船數量。','circ');
   default:return spec('星環擴張',noun+'半徑由 '+inside+' 公里增加到 '+outer+' 公里，新軌道一圈約多長？',circ(outer),'km','6 × '+outer+' ≈ '+(6*outer),'求的是擴張後的新周長。','circ');
  }
 }
 if(kind==='crater'){
  switch(variantIndex){
   case 0:return spec('圓環修復',noun+'外半徑 '+outer+' 公里、內半徑 '+inside+' 公里。圓環面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'圓環就是大圓減小圓。','ring');
   case 1:return spec('從直徑估算圓環',noun+'外直徑 '+(2*outer)+' 公里、內直徑 '+(2*inside)+' 公里。環形面積約多少？',ringArea,'km²','半徑先除以 2，再算 3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'先把直徑換成半徑。','ring');
   case 2:return spec('環帶寬度',noun+'內半徑 '+inside+' 公里，向外修復寬 '+(outer-inside)+' 公里的環帶。面積約多少？',ringArea,'km²','外半徑 '+outer+'，3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'外半徑＝內半徑＋環帶寬度。','ring');
   case 3:return spec('兩座隕石坑','有 '+n+' 個半徑 '+s+' 公里的圓形坑，需要填平，總面積約多少？',n*area(s),'km²',n+' × 3 × '+s+'² ≈ '+(3*n*s*s),'先算單一圓形坑的面積，再乘坑數。','area');
   case 4:return spec('估算安全內圈',noun+'外半徑 '+outer+' 公里，外圈修復約 '+fmt(3*(outer*outer-inside*inside))+' 平方公里。內圈安全區半徑約幾公里？',inside,'km','外圓約 '+(3*outer*outer)+'，扣環帶後內圓約 '+(3*inside*inside)+'，半徑約 '+inside,'先求內圓面積，再用平方數反求半徑。','radius');
   case 5:return spec('修補圓形坑',noun+'直徑 '+(2*r)+' 公里，整片坑洞面積約多少？',area(r),'km²',areaMethod(r),'直徑先除以 2 得到半徑。','area');
   case 6:return spec('半圓修復區',noun+'半徑 '+r+' 公里，只有半圓需要修補，面積約多少？',area(r)/2,'km²',areaMethod(r)+'，再除以 2 ≈ '+fmt(1.5*r*r),'半圓面積是整個圓的一半。','area');
   case 7:return spec('圓形護欄',noun+'半徑 '+s+' 公里，沿邊緣設置護欄，長度大約多少？',circ(s),'km',circMethod(s),'求圍一圈的長度要用周長。','circ');
   case 8:return spec('受損比例',noun+'外半徑 '+outer+' 公里，內半徑 '+inside+' 公里。受損外環面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'大圓減內圈就是受損外環。','ring');
   default:return spec('兩塊修復區差異','兩個圓形修復區半徑分別是 '+r+' 和 '+another+' 公里，面積約差多少？',Math.abs(area(r)-area(another)),'km²','3 × |'+r+'²－'+another+'²| ≈ '+fmt(3*Math.abs(r*r-another*another)),'比較兩個面積相差多少。','ring');
  }
 }
 switch(variantIndex){
  case 0:return spec('能源場面積',noun+'半徑 '+r+' 公里，面積約多少平方公里？',area(r),'km²',areaMethod(r),'求圓面積要用半徑平方。','area');
  case 1:return spec('從直徑求能源場',noun+'直徑 '+(2*r)+' 公里，可以鋪設的面積約多少？',area(r),'km²',areaMethod(r),'直徑先除以 2。','area');
  case 2:return spec('反推能源場半徑',noun+'面積約 '+(3*r*r)+' 平方公里，半徑約幾公里？',r,'km',(3*r*r)+' ÷ 3＝'+r*r+'，半徑約 '+r,'面積÷3 得到半徑平方。','radius');
  case 3:return spec('能源環形採集',noun+'外半徑 '+outer+' 公里，保留內半徑 '+inside+' 公里的核心區。採集面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'圓環＝外圓減內圓。','ring');
  case 4:return spec('能源擴建',noun+'半徑從 '+inside+' 公里擴大到 '+outer+' 公里，增加面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'只求新增外圈面積。','ring');
  case 5:return spec('輸電線總長',noun+'半徑 '+s+' 公里，需要沿邊緣鋪一圈電線。長度約多少？',circ(s),'km',circMethod(s),'電線圍一圈求周長。','circ');
  case 6:return spec('多座太陽能場',n+' 座半徑 '+s+' 公里的圓形能源站，合計面積約多少？',n*area(s),'km²',n+' × 3 × '+s+'² ≈ '+(3*n*s*s),'一座面積乘座數。','area');
  case 7:return spec('由面積反推直徑',noun+'面積大約是 '+(3*r*r)+' 平方公里，直徑約幾公里？',2*r,'km','半徑 '+r+'，直徑約 '+(2*r),'先由面積求半徑，再乘 2。','radius');
  case 8:return spec('半圓能源場',noun+'半徑 '+r+' 公里，只有半圓鋪設發電板，面積約多少？',area(r)/2,'km²',areaMethod(r)+'，再除以 2 ≈ '+fmt(1.5*r*r),'只鋪一半圓面積。','area');
  default:return spec('外圍採集圈',noun+'內圈半徑 '+inside+' 公里，向外加寬 '+(outer-inside)+' 公里。新增面積約多少？',ringArea,'km²','3 × ('+outer+'²－'+inside+'²) ≈ '+ringEstimate,'先算外半徑，再以大圓減小圓。','ring');
 }
}

function estimateOptions(exact,unit,method,rng){
 const step=method==='radius'?1:Math.abs(exact)<25?2:Math.abs(exact)<130?5:10;
 const closest=Math.max(step,Math.round(exact/step)*step);
 const gap=Math.max(step*3,Math.ceil(Math.max(exact,10)*.22/step)*step);
 const options=[closest];
 for(const offset of [-2,-1,1,2,3]){
  const candidate=closest+gap*offset;
  if(candidate>0&&!options.includes(candidate))options.push(candidate);
  if(options.length===4)break;
 }
 if(options.length<4)throw new Error('無法產生四個不同選項');
 for(let i=options.length-1;i>0;i--){
  const j=Math.floor(rng()*(i+1));
  [options[i],options[j]]=[options[j],options[i]];
 }
 const letters=['A','B','C','D'];
 return {answer:letters[options.indexOf(closest)],
  choices:options.map((value,i)=>({value:letters[i],label:fmt(value)+' '+unit})),estimate:closest};
}
export function makeEstimationTask(kind,variant,difficulty='standard',rng=Math.random,variantIndex=0){
 const s=specification(kind,variantIndex,rng);
 const opts=estimateOptions(s.exact,s.unit,s.method,rng);
 const explanations=[
  '把 π ≈ 3 代入，可得 '+s.reason+'。',
  '最接近的估算答案是 '+fmt(opts.estimate)+' '+s.unit+'；正確估算選項為 '+opts.answer+'。'
 ];
 return {
  id:randomUUID(),kind,variant,title:s.title,
  question:s.question+'（請用 π ≈ 3 估算，選出最接近的答案。）',
  type:'choice',answer:opts.answer,choices:opts.choices,
  formula:null,unit:null,steps:explanations,
  hint:s.hint+' 不必精算小數，請排除差距明顯的選項。',
  context:'估算任務：先判斷數量級，從四個選項選出最接近的值。',
  pi:PI,difficulty
 };
}
