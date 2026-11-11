import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePlanetEcology, planetMapSummary } from '../client/planet-renderer.js';

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
