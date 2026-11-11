import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePlanetEcology, planetMapSummary, craterProfile, craterReliefColor } from '../client/planet-renderer.js';

const barren={
 stage:1,
 resources:{oxygen:20,water:30,energy:25,stability:70},
 completed:{forest:0,crater:0,power:0,orbit:0},
 hazards:[],result:null
};
const green={
 stage:3,
 resources:{oxygen:88,water:90,energy:83,stability:91},
 completed:{forest:4,crater:3,power:3,orbit:2},
 hazards:[],result:{win:true}
};
test('初始荒蕪星球不會預先長滿森林、海洋與發光電站',()=>{
 const s=derivePlanetEcology(barren);
 assert.equal(s.forest,0);
 assert.equal(s.ocean,0);
 assert.equal(s.power,0);
 assert.equal(s.repair,0);
 const atlas=planetMapSummary(barren);
 assert.equal(atlas.forest,0);
 assert.equal(atlas.energy,0);
 assert.ok(atlas.rock>atlas.water,'初始應以乾裂岩地為主');
});
test('建造森林、修復水環境和能源會真的改變星球地貌比例',()=>{
 const initial=planetMapSummary(barren);
 const mature=planetMapSummary(green);
 const values=derivePlanetEcology(green);
 assert.ok(values.forest>.5&&values.ocean>.5&&values.power>.5&&values.repair>.5);
 assert.ok(mature.forest>initial.forest,'森林建造後球體應長出林地');
 assert.ok(mature.water>initial.water,'海洋湖泊面積應擴大');
 assert.ok(mature.energy>initial.energy,'能源設施應變成地貌發光區');
 assert.ok(initial.rock>mature.rock,'乾裂裸岩應因生態復甦減少');
 assert.ok(new Set(mature.quarters).size>=3,'星球不同經度不可是一模一樣的圖案');
});
test('傷害會降低地貌復甦程度；新視覺完全由前端資源生成',()=>{
 const healthy=derivePlanetEcology(green);
 const damaged=derivePlanetEcology({...green,hazards:[{id:'meteor'},{id:'flare'}],result:null});
 assert.ok(damaged.repair<healthy.repair);
 assert.ok(damaged.forest<healthy.forest);
 assert.ok(damaged.ocean<healthy.ocean);
 const app=readFileSync(new URL('../client/app.js',import.meta.url),'utf8');
 assert.match(app,/planet-terrain-canvas/);
 assert.match(app,/planetWorld\(s\)/);
 assert.doesNotMatch(app,/class="planet-building/,'不得恢復貼在星球上的建築 emoji');
 const renderer=readFileSync(new URL('../client/planet-renderer.js',import.meta.url),'utf8');
 assert.match(renderer,/cherry/);
 assert.match(renderer,/whale/);
 assert.match(renderer,/aurora/);
 assert.match(renderer,/energyPulse/);
 assert.match(renderer,/cherryStrength/,'櫻花季應改變森林像素而非只增加貼圖');
 assert.match(renderer,/if\(energy>\.17\)cl=3/,'能源亮區應能供脈衝事件辨識');
 assert.match(renderer,/prefers-reduced-motion/);
});


test('V1.9.1 撞擊坑是柔和凹陷盆地，不是只有一圈黑色圓線',()=>{
 const crater=[1.22,.28,.15,5],base=[163,117,96];
 const center=craterReliefColor(base,1.22,.28,crater,1,.51);
 const rim=craterReliefColor(base,1.22+.14,.28,crater,1,.51);
 const distant=craterReliefColor(base,1.22+.6,.28,crater,1,.51);
 assert.ok(center[0]<base[0]-20,'坑底整片應有可感知陰影');
 assert.ok(center[1]<base[1]-12,'坑底不應維持與坑外完全同色');
 assert.notDeepEqual(rim,base,'坑壁應有抬升岩層，不是空心圓');
 assert.deepEqual(distant,base,'坑外不應出現無限延伸的黑線');
});
test('坑壁有方向性陰影，非完美同心圓；修復後漸漸淡化',()=>{
 const crater=[1.22,.28,.15,5],base=[163,117,96];
 const upper=craterReliefColor(base,1.22-.03,.28+.08,crater,1,.51);
 const lower=craterReliefColor(base,1.22+.03,.28-.08,crater,1,.51);
 assert.ok(Math.abs(upper[0]-lower[0])>5,'凹洞內壁需有受光方向差異');
 const east=craterProfile(1.22+.15,.28,crater);
 const north=craterProfile(1.22,.28+.15,crater);
 assert.ok(Math.abs(east.radial-north.radial)>.04,'坑緣不能是相同半徑的工整圓形');
 const initial=craterReliefColor(base,1.22,.28,crater,1,.51);
 const repaired=craterReliefColor(base,1.22,.28,crater,.06,.51);
 const diff=c=>Math.abs(c[0]-base[0])+Math.abs(c[1]-base[1])+Math.abs(c[2]-base[2]);
 assert.ok(diff(repaired)<diff(initial)*.15,'修復工程應明顯淡化坑洞');
 assert.deepEqual(craterReliefColor(base,1.22,.28,crater,0),base);
});
