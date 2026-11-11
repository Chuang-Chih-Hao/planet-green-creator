// 課後數學回顧題不透過 SSE 洩漏答案，僅提交後回傳給本人。
const PI=3.14;
const fmt=n=>String(Number(n.toFixed(1)));
const choose=a=>a[Math.floor(Math.random()*a.length)];
export function makeReviewQuestions(){
  const r1=5,r2=choose([2.5,5,7.5]),outer=10,inner=5;
  return [
    {id:'area',question:'森林半徑為 '+r1+' km，圓形森林面積是多少km²？',answer:Number((PI*r1*r1).toFixed(1)),unit:'km²',explanation:'圓面積 = 3.14 × '+r1+' × '+r1+' = '+fmt(PI*r1*r1)+' km²。'},
    {id:'circ',question:'衛星圓形軌道的直徑是 '+2*r2+' km，一圈的長度是多少km？',answer:Number((2*PI*r2).toFixed(1)),unit:'km',explanation:'直徑 '+2*r2+' km，圓周長 = 3.14 × '+2*r2+' = '+fmt(2*PI*r2)+' km。'},
    {id:'ring',question:'隕石坑外半徑 '+outer+' km，安全內圈半徑 '+inner+' km，受損圓環面積是多少km²？',answer:Number((PI*(outer*outer-inner*inner)).toFixed(1)),unit:'km²',explanation:'圓環面積 = 3.14 × ('+outer+'² - '+inner+'²) = '+fmt(PI*(outer*outer-inner*inner))+' km²。'}
  ];
}
export function reviewPublicQuestions(items=[]) {
  return items.map(({id,question,unit})=>({id,question,unit}));
}
export function gradeReview(questions,submitted={},reflection='',confidence=''){
  const clean=s=>String(s??'').replace(/[<>]/g,'').trim().slice(0,300);
  const results=questions.map(q=>{
    const raw=String(submitted[q.id]??'').trim();
    const value=Number(raw);
    const correct=raw!==''&&Number.isFinite(value)&&Math.abs(value-q.answer)<=.015;
    return {id:q.id,question:q.question,submitted:raw,correct,answer:q.answer,unit:q.unit,explanation:q.explanation};
  });
  return {
    submittedAt:Date.now(),correct:results.filter(x=>x.correct).length,total:results.length,
    results,reflection:clean(reflection),confidence:['understand','partial','review'].includes(confidence)?confidence:'partial'
  };
}
