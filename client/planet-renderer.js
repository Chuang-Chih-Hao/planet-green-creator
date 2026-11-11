/* V1.9 - procedurally painted, rotating satellite-view cartoon planet.
   No external imagery, assets or icons on the planet surface.
   Terrain is deterministic across viewers; ecological parameters respond to game state.
   Keeps canvas pixel work bounded to ~280x280 at 22 FPS. */
const TAU=Math.PI*2;
const ATLAS_W=512, ATLAS_H=256, GLOBE=280;
const clip=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const wrap=(v,limit)=>((v%limit)+limit)%limit;
const hash=(x,y)=>{let h=Math.imul(x+17,374761393)^Math.imul(y+23,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295};
function noise(u,v,frequency){
 const x=u*frequency,y=v*frequency;
 const ax=Math.floor(x),ay=Math.floor(y),fx=smooth(x-ax),fy=smooth(y-ay);
 const a=lerp(hash(wrap(ax,frequency),ay),hash(wrap(ax+1,frequency),ay),fx);
 const b=lerp(hash(wrap(ax,frequency),ay+1),hash(wrap(ax+1,frequency),ay+1),fx);
 return lerp(a,b,fy);
}
function fractal(u,v){
 return noise(u,v,4)*.48+noise(u,v,8)*.27+noise(u,v,16)*.15+noise(u,v,32)*.10;
}
function distLon(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
const continentalPlates=[
 [-2.62,.25,.55,.62,1.06],[-2.09,-.30,.44,.38,.77],
 [-1.03,.35,.55,.53,1.02],[-.46,-.43,.37,.33,.57],
 [.59,-.20,.48,.53,.91],[1.19,.56,.56,.31,.88],
 [2.39,.03,.38,.33,.58],[2.89,-.59,.46,.36,.74]
];
const craters=[[-2.2,.51,.095],[-1.3,-.13,.13],[-.5,.37,.07],[.42,-.46,.09],[1.22,.28,.15],[2.37,-.13,.12],[2.9,.4,.08],[-2.78,-.6,.07]];
const craterFields=craters.map((crater,index)=>[...crater,index+1]);
const riverRuns=[[-1.18,.28,.85],[.68,-.3,.64],[-2.46,.22,.78],[1.24,.49,.62],[2.41,.02,.64]];
const powerSites=[[-2.46,.18],[-.92,.13],[.65,-.37],[1.13,.34],[2.66,-.20],[.1,.03]];
function elevation(lon,lat,u,v){
 let hills=-.33;
 for(const [cx,cy,rx,ry,amount] of continentalPlates){
  const dx=distLon(lon,cx)*Math.cos(lat*.5)/rx,dy=(lat-cy)/ry;
  hills=Math.max(hills,-.33+amount*Math.exp(-.94*(dx*dx+dy*dy)));
 }
 const n=fractal(u,v);
 return hills+(n-.5)*.33+Math.sin(lon*5+lat*8)*.012;
}
function scenerySignature(p){
 return ['forest','crater','power','orbit'].map(k=>p.completed[k]).join('/')+
    '|'+p.stage+'|'+p.resources.oxygen+'/'+p.resources.water+'/'+p.resources.energy+'/'+p.resources.stability+
    '|'+p.hazards+'|'+p.win;
}
export function derivePlanetEcology(state={},demo=false){
 const resources=state.resources||{},c=state.completed||{};
 const count=k=>Math.max(0,Number(c[k])||0);
 const stage=demo?3:Math.max(1,Number(state.stage)||1);
 const oxygen=demo?80:Number(resources.oxygen??20);
 const water=demo?90:Number(resources.water??30);
 const energy=demo?85:Number(resources.energy??25);
 const stability=demo?85:Number(resources.stability??70);
 const win=demo||Boolean(state.result?.win||state.win);
 const hazards=demo?0:Math.max(0,Array.isArray(state.hazards)?state.hazards.length:Number(state.hazards)||0);
 const forest=clip(count('forest')*.22+(oxygen-20)*.0032+(stage-1)*.10+(win?.18:0))*(1-clip(hazards*.17,0,.85));
 const ocean=clip((water-30)*.007+count('crater')*.23+(stage-1)*.11+(win?.14:0))*(1-clip(hazards*.16,0,.8));
 const power=clip(count('power')*.28+(energy-25)*.0028+(win?.12:0));
 const repair=clip(count('crater')*.22+(stability-70)*.003+(stage-1)*.13+(win?.16:0)-hazards*.09);
 const sky=clip(.12+ocean*.58+forest*.28+repair*.20);
 return {forest,ocean,power,repair,sky,stage,win,hazards,
   resources:{oxygen,water,energy,stability},completed:{forest:count('forest'),crater:count('crater'),power:count('power'),orbit:count('orbit')}};
}
// Soft sculpted impact basins: asymmetric walls, ejecta dust and jagged rims.
// Return a sampled crater rather than a mathematical perfect circle outline.
export function craterProfile(lon,lat,crater){
 const [cx,cy,r,seed=0]=crater;
 const dx=distLon(lon,cx)*Math.cos(lat),dy=lat-cy;
 if(Math.abs(dx)>r*1.75||Math.abs(dy)>r*1.75)return null;
 const angle=Math.atan2(dy,dx);
 const irregular=1+.125*Math.sin(5*angle+seed*1.7)
  +.07*Math.sin(9*angle-seed*2.3)+.045*Math.cos(15*angle+seed*.7);
 const radial=Math.hypot(dx*1.05,dy*.92)/(r*irregular);
 if(radial>1.55)return null;
 // Light is cast from the upper left of the projected satellite view.
 const facing=clip(.5+.5*((-dx*.65+dy*.76)/(Math.hypot(dx,dy)+1e-6)));
 return {radial,facing,angle,irregular};
}
const craterBell=(x,center,width)=>Math.exp(-Math.pow((x-center)/width,2));
export function craterReliefColor(base,lon,lat,crater,damage,grain=.5){
 const profile=craterProfile(lon,lat,crater);
 if(!profile||damage<=0)return base;
 const {radial:d,facing,angle}=profile;
 const strength=clip(damage);
 // Diffuse ejecta and weathered rock blend into the surroundings;
 // no single-pixel black contour is drawn.
 let rgb=base.slice();
 const debris=craterBell(d,1.19,.32)*strength*(.13+.10*grain)
   *(.84+.16*Math.sin(angle*18+crater[3]*3));
 rgb=rgb.map((v,k)=>lerp(v,[186,143,113][k],debris));
 // The entire crater floor sinks and darkens, not merely its perimeter.
 const floor=clip((1.07-d)/.23)*strength;
 const floorNoise=(grain-.5)*17;
 rgb=rgb.map((v,k)=>lerp(v,[108+floorNoise,83+floorNoise,73+floorNoise][k],floor*.52));
 // The inner slope has directional shade: upper-left wall is shadowed,
 // lower-right wall catches sunlight, giving visible concavity.
 const slope=craterBell(d,.80,.23)*strength*.52;
 const innerLight=1-facing;
 const slopeColor=[69+innerLight*92,56+innerLight*71,57+innerLight*51];
 rgb=rgb.map((v,k)=>lerp(v,slopeColor[k],slope));
 // Broad irregular raised rim, sunlit on one side and weathered elsewhere.
 const ridge=craterBell(d,1.015,.17)*strength*.45;
 const rimColor=[107+facing*106,88+facing*79,79+facing*65];
 rgb=rgb.map((v,k)=>lerp(v,rimColor[k],ridge));
 // Directional shallow erosion streaks break any remaining circle symmetry.
 const erosion=craterBell(d,.63,.32)*strength*.065
    *(Math.sin(angle*14+grain*4)*.5+.5);
 rgb=rgb.map((v,k)=>lerp(v,[168,124,98][k],erosion));
 return rgb;
}

function terrainAtlas(p){
 const n=ATLAS_W*ATLAS_H;
 const colors=new Uint8ClampedArray(n*4);
 const classes=new Uint8Array(n);
 const cloud=new Uint8Array(n);
 const level=-.425+p.ocean*.58;
 const riverFade=clip((p.ocean-.10)*2.5)*clip((p.repair+.20)*1.3);
 const damage=clip(1-p.repair*.74-(p.win?.20:0));
 for(let j=0;j<ATLAS_H;j++){
  const lat=(.5-(j+.5)/ATLAS_H)*Math.PI,v=(j+.5)/ATLAS_H;
  const pole=clip((Math.abs(lat)-1.22)*4);
  for(let i=0;i<ATLAS_W;i++){
   const u=(i+.5)/ATLAS_W,lon=(u-.5)*TAU;
   const idx=j*ATLAS_W+i,at=idx*4;
   const n1=fractal(u,v),detail=noise(u,v,32);
   const altitude=elevation(lon,lat,u,v);
   const sea=altitude<level;
   let rgb,cl=0;
   if(sea){
    const deep=clip((level-altitude)*1.7);
    rgb=[lerp(42,12,deep),lerp(118,58,deep),lerp(169,117,deep)];
    if(level-altitude<.022){rgb=[47,139,176];}
    cl=2;
   }else{
    const height=clip((altitude-level)*2.2);
    const n2=noise(u,v,16);
    const fertile=(n1*.66+n2*.34)+(Math.sin(lon*2.8-lat*4)+1)*.045;
    const forestPatch=p.forest>0.02&&fertile>(.83-p.forest*.54) && pole<.6;
    if(forestPatch){
      const lush=clip(p.forest*.8+.18);
      rgb=[lerp(77,23,lush)+detail*16,lerp(112,139,lush)+detail*24,lerp(59,82,lush)+detail*13];
      cl=1;
    }else{
      const restoration=clip(p.forest*.35+p.repair*.15);
      const warm=[lerp(137,173,n1),lerp(93,116,detail),lerp(79,75,n2)];
      const renewed=[117+40*n1,125+46*n2,88+31*detail];
      rgb=warm.map((v,k)=>lerp(v,renewed[k],restoration));
    }
    if(height>.72&&!forestPatch)rgb=rgb.map((c,k)=>lerp(c,[151,145,131][k],(height-.72)*.95));
    if(riverFade>.03&&pole<.5){
      for(const [cx,cy,extent] of riverRuns){
        const d=distLon(lon,cx);
        if(Math.abs(d)<extent*.64){
          const course=cy + Math.sin(d*9+cx*7)*.06 + d*.32;
          const width=(.006+.005*noise(u,v,8))*riverFade;
          if(Math.abs(lat-course)<width){
            rgb=[38,147,193];
            cl=2;
            break;
          }
        }
      }
    }
    if(damage>.025){
      for(const crater of craterFields){
        rgb=craterReliefColor(rgb,lon,lat,crater,damage,detail);
      }
    }
    if(p.power>.045){
      for(const [cx,cy] of powerSites){
        const dx=distLon(lon,cx)*Math.cos(lat),dy=lat-cy,d=Math.hypot(dx,dy);
        const halo=Math.max(0,1-d/.20);
        if(halo>.04){
          const circuitry=Math.max(0,(.013-Math.min(Math.abs(Math.sin(dx*48)),Math.abs(Math.sin(dy*57)))*.18))/.013;
          const energy=clip(p.power*halo*(.25+circuitry*.75));
          rgb=[lerp(rgb[0],88,energy),lerp(rgb[1],215,energy),lerp(rgb[2],220,energy)];
          if(energy>.17)cl=3;
        }
      }
    }
   }
   if(pole>0){
     const snow=pole*clip(p.sky+.2);
     rgb=rgb.map((c,k)=>lerp(c,[191,216,219][k],snow));
   }
   const grain=(detail-.5)*11;
   colors[at]=clip(rgb[0]+grain,0,255);
   colors[at+1]=clip(rgb[1]+grain,0,255);
   colors[at+2]=clip(rgb[2]+grain,0,255);
   colors[at+3]=255;
   classes[idx]=cl;
   cloud[idx]=Math.round(255*clip((noise(u,v,8)*.54+noise(u,v,20)*.30+noise(u,v,40)*.16-.60)*4.1)*p.sky);
  }
 }
 return {colors,classes,cloud};
}
export function planetMapSummary(state={},demo=false){
 const map=terrainAtlas(derivePlanetEcology(state,demo));
 const totals={forest:0,water:0,energy:0,rock:0};
 const quarters=[0,0,0,0],quartCounts=[0,0,0,0];
 for(let i=0;i<map.classes.length;i+=4){
  const biome=map.classes[i];
  totals[biome===1?'forest':biome===2?'water':biome===3?'energy':'rock']++;
  const q=Math.floor((i%ATLAS_W)/(ATLAS_W/4));
  quarters[q]+=map.colors[i*4]+map.colors[i*4+1]*2+map.colors[i*4+2]*3;
  quartCounts[q]++;
 }
 for(let i=0;i<4;i++)quarters[i]=Math.round(quarters[i]/quartCounts[i]);
 return {...totals,quarters};
}
function globeProjection(){
 const pixels=GLOBE*GLOBE,latitudeRow=new Int32Array(pixels),frontLon=new Float32Array(pixels);
 const shade=new Float32Array(pixels),alpha=new Uint8Array(pixels);
 const half=GLOBE/2;
 for(let y=0;y<GLOBE;y++)for(let x=0;x<GLOBE;x++){
  const k=y*GLOBE+x;
  const nx=((x+.5)-half)/(half-1),ny=(half-(y+.5))/(half-1);
  const radius=nx*nx+ny*ny;
  if(radius>=1)continue;
  const nz=Math.sqrt(1-radius);
  const lat=Math.asin(ny);
  latitudeRow[k]=Math.min(ATLAS_H-1,Math.max(0,Math.floor((.5-lat/Math.PI)*ATLAS_H)))*ATLAS_W;
  frontLon[k]=Math.atan2(nx,nz)/TAU;
  shade[k]=clip(.36+.65*Math.max(0,nx*-.46+ny*.42+nz*.82)+Math.pow(nz,3)*.03,.2,1.10);
  alpha[k]=Math.round(255*clip((1-radius)*(half*.75),0,1));
 }
 return {latitudeRow,frontLon,shade,alpha};
}
const projector=globeProjection();
function oceanOrForest(frame,kind){
 // Look for a visible portion of a suitable biome, rather than overlaying icons
 // over an unrelated patch of land.
 const wanted=kind==='cherry'?1:kind==='whale'?2:kind==='energy'?3:0;
 let best=null,score=-Infinity;
 for(let y=80;y<205;y+=9)for(let x=73;x<208;x+=9){
  const k=y*GLOBE+x;
  if(frame.shown[k]!==wanted||projector.alpha[k]<245)continue;
  const distance=((x-140)/130)**2+((y-140)/140)**2;
  const value=(kind==='whale'?y*.006:0)-distance+(Math.sin(x*7+y*11)+1)*.03;
  if(value>score){best=[x,y];score=value;}
 }
 return best;
}
function bloom(ctx,x,y,phase){
 ctx.save();ctx.translate(x,y);
 const sway=Math.sin(phase*1.4)*5;
 ctx.strokeStyle='#8b5a75';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,18);ctx.lineTo(sway,-4);ctx.stroke();
 for(let i=0;i<13;i++){
  const a=i*2.4,r=8+Math.sqrt(i)*5,px=Math.cos(a)*r+sway,py=Math.sin(a)*r-11;
  ctx.fillStyle=i%3?'#ffbedb':'#f1a0c5';ctx.globalAlpha=.72+.22*Math.sin(phase*2+i);
  ctx.beginPath();ctx.arc(px,py,7,0,TAU);ctx.fill();
 }
 for(let i=0;i<8;i++){
  const px=Math.sin(i*4.5+phase*.85)*30,py=14-((phase*22+i*14)%65);
  ctx.fillStyle='#ffd3e7';ctx.globalAlpha=.7;
  ctx.beginPath();ctx.ellipse(px,py,3,1.4,i*.7,0,TAU);ctx.fill();
 }
 ctx.restore();
}
function whale(ctx,x,y,phase){
 const jump=Math.sin(Math.PI*clip(phase))*.95;
 ctx.save();ctx.translate(x,y-jump*27);ctx.rotate(-.32+jump*.30);
 ctx.globalAlpha=.93;
 ctx.fillStyle='#3d809c';ctx.beginPath();ctx.moveTo(-24,11);
 ctx.bezierCurveTo(-29,-12,-2,-28,23,-5);ctx.bezierCurveTo(12,18,-10,22,-24,11);ctx.fill();
 ctx.fillStyle='#9de0dc';ctx.beginPath();ctx.ellipse(-2,11,13,4,.08,0,TAU);ctx.fill();
 ctx.strokeStyle='#3d809c';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(21,-5);ctx.lineTo(31,-17);ctx.stroke();
 ctx.fillStyle='#4c94ad';ctx.beginPath();ctx.moveTo(29,-16);ctx.lineTo(41,-26);ctx.lineTo(37,-13);ctx.lineTo(30,-12);ctx.lineTo(19,-19);ctx.lineTo(29,-16);ctx.fill();
 ctx.fillStyle='#162f4e';ctx.beginPath();ctx.arc(-12,-2,1.6,0,TAU);ctx.fill();
 ctx.restore();
 ctx.save();ctx.strokeStyle='#dcf9ff';ctx.lineWidth=2;ctx.globalAlpha=.65;
 for(let i=0;i<5;i++){
  const dist=12+i*5;
  ctx.beginPath();ctx.arc(x,y+12,dist,Math.PI*.12,Math.PI*.88);ctx.stroke();
 }
 ctx.restore();
}
function aurora(ctx,time){
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let n=0;n<5;n++){
  ctx.beginPath();ctx.moveTo(16,75+n*10);
  ctx.bezierCurveTo(65,-15+n*8,167,115-n*20,261,55+n*7);
  ctx.strokeStyle=n%2?'rgba(92,229,209,.26)':'rgba(152,140,246,.27)';
  ctx.lineWidth=6+n*3;ctx.shadowBlur=20;ctx.shadowColor='#64f0d8';
  ctx.globalAlpha=.44+.15*Math.sin(time*1.4+n);ctx.stroke();
 }
 ctx.restore();
}
function energyPulse(ctx,x,y,time){
 ctx.save();
 ctx.strokeStyle='rgba(127,248,237,.75)';ctx.lineWidth=3;
 ctx.shadowBlur=17;ctx.shadowColor='#5bfff2';
 for(let i=0;i<3;i++){
  const radius=(time*18+i*20)%70;
  ctx.globalAlpha=.8*(1-radius/80);
  ctx.beginPath();ctx.ellipse(x,y,radius,radius*.54,0,0,TAU);ctx.stroke();
 }
 ctx.restore();
}
function drawSpecial(ctx,frame,scene,time){
 if(!scene.event||time>scene.event.until)return;
 const kind=scene.event.kind;
 if(kind==='aurora'){aurora(ctx,time/1000);return;}
 const point=oceanOrForest(frame,kind);
 if(!point)return;
 const progress=clip((time-scene.event.started)/(scene.event.until-scene.event.started));
 if(kind==='cherry')bloom(ctx,point[0],point[1],time/1000);
 if(kind==='whale')whale(ctx,point[0],point[1],progress);
 if(kind==='energy')energyPulse(ctx,point[0],point[1],time/1000);
}
function eligibleEffects(p){const result=[];if(p.forest>.15)result.push('cherry');if(p.ocean>.22)result.push('whale');if(p.power>.20)result.push('energy');if(p.sky>.50)result.push('aurora');return result;}
function makeScene(canvas,p,signature,demo){
 const ctx=canvas.getContext('2d',{alpha:true});
 if(!ctx)return null;
 canvas.width=GLOBE;canvas.height=GLOBE;
 return {canvas,ctx,p,signature,demo,atlas:terrainAtlas(p),
   image:ctx.createImageData(GLOBE,GLOBE),shown:new Uint8Array(GLOBE*GLOBE),
   nextEvent:performance.now()+18000+Math.random()*15000,event:null};
}
const records=new WeakMap();
let currentState=null,lastTick=0,animated=false,frameNumber=0;
let startClock=0;
function updateScene(canvas,state){
 const demo=canvas.dataset.planetCanvas==='preview';
 const p=derivePlanetEcology(demo?{}:state||{},demo);
 const signature=scenerySignature(p);
 let scene=records.get(canvas);
 if(!scene||scene.signature!==signature){
  scene=makeScene(canvas,p,signature,demo);
  if(scene)records.set(canvas,scene);
 }
 return scene;
}
function paint(scene,clock,reduced){
 const {ctx,image,atlas,shown,p}=scene,output=image.data;
 const yaw=reduced?-.24:((clock-startClock)/90000)*TAU-.4;
 const spin=yaw/TAU;
 const cloudsShift=(reduced?0:(clock-startClock)/150000)%1;
 const pixels=GLOBE*GLOBE;
 const cherry=scene.event?.kind==='cherry'&&clock<scene.event.until;
 const cherryStrength=cherry?clip(Math.min((clock-scene.event.started)/700,(scene.event.until-clock)/900))*.72:0;
 for(let k=0;k<pixels;k++){
  const a=projector.alpha[k],out=k*4;
  if(!a){output[out+3]=0;shown[k]=255;continue;}
  const u=wrap(projector.frontLon[k]+spin+.5,1);
  const x=Math.floor(u*ATLAS_W);
  const index=projector.latitudeRow[k]+x,src=index*4;
  const cloudX=Math.floor(wrap(projector.frontLon[k]+cloudsShift+.5,1)*ATLAS_W);
  const cp=atlas.cloud[projector.latitudeRow[k]+cloudX]/255*.66;
  const light=projector.shade[k];
  for(let channel=0;channel<3;channel++){
   const surface=atlas.colors[src+channel];
   const cloudy=lerp(surface,[211,230,236][channel],cp);
   output[out+channel]=Math.min(255,cloudy*light);
  }
  if(cherryStrength&&atlas.classes[index]===1){
   // A cherry season recolors whole forest clusters, not just a floating sticker.
   const pinkNoise=Math.sin(x*.12+projector.latitudeRow[k]*.0004)+Math.cos(x*.065+projector.latitudeRow[k]*.0016);
   if(pinkNoise>-.36){
    output[out]=lerp(output[out],247,cherryStrength);
    output[out+1]=lerp(output[out+1],160,cherryStrength);
    output[out+2]=lerp(output[out+2],208,cherryStrength);
   }
  }
  output[out+3]=a;
  shown[k]=atlas.classes[index];
 }
 ctx.clearRect(0,0,GLOBE,GLOBE);
 ctx.putImageData(image,0,0);
 // Transparent atmospheric rim and specular highlight follow the visible sphere.
 const aura=ctx.createRadialGradient(112,95,42,140,140,142);
 aura.addColorStop(0,'rgba(239,255,253,.10)');
 aura.addColorStop(.73,'rgba(245,255,254,0)');
 aura.addColorStop(.95,'rgba(72,192,227,.05)');
 aura.addColorStop(1,'rgba(125,221,241,.29)');
 ctx.save();ctx.beginPath();ctx.arc(140,140,139,0,TAU);ctx.clip();
 ctx.fillStyle=aura;ctx.fillRect(0,0,GLOBE,GLOBE);
 if(!reduced)drawSpecial(ctx,scene,scene,clock);
 ctx.restore();
}
function frame(timestamp){
 if(!animated)return;
 requestAnimationFrame(frame);
 if(!document.hidden && timestamp-lastTick>44){
  lastTick=timestamp;frameNumber++;
  document.querySelectorAll('canvas[data-planet-canvas]').forEach(canvas=>{
   const scene=updateScene(canvas,currentState);
   if(!scene)return;
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(!reduced && timestamp>=scene.nextEvent){
    const possible=eligibleEffects(scene.p);
    if(possible.length){
     const kind=possible[Math.floor(Math.random()*possible.length)];
     scene.event={kind,started:timestamp,until:timestamp+6500+Math.random()*4500};
    }
    scene.nextEvent=timestamp+24000+Math.random()*22000;
   }
   paint(scene,timestamp,reduced);
  });
 }
}
export function setPlanetEcologyState(state){currentState=state;}
export function startPlanetRenderer(){
 if(animated)return;
 animated=true;
 startClock=performance.now();
 requestAnimationFrame(frame);
}
