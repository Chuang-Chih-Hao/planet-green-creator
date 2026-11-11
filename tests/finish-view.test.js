import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../client/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../client/style.css',import.meta.url),'utf8');
const start=source.indexOf('function planetPanel(s) {');
const end=source.indexOf('\nfunction feedbackHTML',start);
assert.ok(start>=0&&end>start,'Missing planetPanel');
const planetPanel=new Function('planetWorld','escapeHTML','formatTime',source.slice(start,end)+';return planetPanel;')(
 ()=>'<div class="planet-world">VISIBLE PLANET</div>',
 v=>String(v??''),()=> '00:00');
const fixture=(phase,win)=>({
 phase,stage:3,stageInfo:{title:'文明守護',problem:'完成任務'},
 result:{win,title:win?'生命核心啟動成功！':'本局結束',description:'全隊完成任務'},
 hazards:[],event:null,paused:false,progress:100,lifeIndex:100,
 buildingsTotal:12,players:[{name:'學生'}],completed:{forest:3,crater:3,power:3,orbit:3}
});
for(const win of [true,false]){
 test('結束成果卡位於星球場景外：'+(win?'成功':'未通關'),()=>{
  const html=planetPanel(fixture('finished',win));
  const planet=html.indexOf('VISIBLE PLANET');
  const sceneFooter=html.indexOf('<div class="scene-footer">');
  const summary=html.indexOf('<section class="card finish-summary"');
  const statistics=html.indexOf('<div class="mini-stats">');
  assert.ok(planet>=0&&sceneFooter>planet&&summary>sceneFooter&&statistics>summary);
  assert.ok(html.slice(0,summary).trimEnd().endsWith('</div>'),'Scene must close before summary');
  assert.doesNotMatch(html,/finish-ribbon/);
  assert.match(html,win?/生命核心啟動成功！/:/本局結束/);
 });
}
test('遊戲中不顯示成果卡，舊絕對定位浮層已移除',()=>{
 const html=planetPanel(fixture('playing',false));
 assert.doesNotMatch(html,/finish-summary|finish-ribbon/);
 assert.doesNotMatch(css,/\.finish-ribbon\s*\{/);
 assert.match(css,/\.finish-summary\s*\{/);
});
