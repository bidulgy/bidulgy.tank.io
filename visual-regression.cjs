const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/game.js', 'utf8');
const section = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `missing source section: ${start}`);
  return source.slice(a, b);
};
const context = vm.createContext({ TAU: Math.PI * 2 });
vm.runInContext([
  section('const PROJECTILE_SHAPE=', 'function projectileShapeForCannon'),
  section('const CANNON_SKILLS=', 'const CANNON_SKILLS_2='),
  section('const CANNON_SKILLS_2=', 'const ERROR_T_SKILL='),
  section('const TANK_THEMES=', '// V5.61: Diep.io-style evolution tree.'),
  section('const DIEP_EVOLUTION_INFO=', 'const DIEP_EVOLUTION_CHILDREN='),
  section('function evolutionBarrelSpecs(', 'function evolutionHasNoBasicGun('),
  section('function evolutionVolleySpecs(', 'function evolutionShotsFromBase('),
  section('function drawVariantProjectile(', 'function drawUniqueProjectile('),
  section('function skillAimSpec(', 'function aimPal('),
  section('function aimPal(', 'function drawAimGuides('),
  section('function skillRuneColor(', 'function drawSkillZones('),
  section('function centralPentagonPoint(', 'function minDistanceToActiveAnchors(')
].join('\n'), context);
context.player = {errorSwordMode:false,overclockUntil:0};
context.performance = {now:() => 1000};
context.phantomPreviewDistance = () => 700;

const data = vm.runInContext(`({
  themes: Object.keys(TANK_THEMES),
  shapes: Object.keys(PROJECTILE_SHAPE),
  skills: Object.keys(CANNON_SKILLS),
  secondSkills: Object.keys(CANNON_SKILLS_2),
  evolutions: Object.keys(DIEP_EVOLUTION_INFO),
  barrels: Object.fromEntries(Object.keys(DIEP_EVOLUTION_INFO).map(id => [id, evolutionBarrelSpecs(id, 27)]))
})`, context);
assert.equal(data.themes.length, 46, 'all 46 cannon themes must remain');
assert.equal(vm.runInContext("DIEP_EVOLUTION_INFO.quadTank.mods.damage ?? 1",context),1,'Quad evolution must not lower base damage');
assert.equal(vm.runInContext("evolutionVolleySpecs('quadTank',27,1).length",context),4,'Quad must keep four firing directions');
assert.equal(vm.runInContext("evolutionVolleySpecs('quadTank',27,1).every(shot => shot.damageScale === 1)",context),true,'Quad bullets must retain full damage');
const traces = new Set();
const variantTraces = new Set();
for (const id of data.themes) {
  assert(data.shapes.includes(id), `${id} missing projectile shape`);
  assert(data.skills.includes(id), `${id} missing skill`);
  const qAim = vm.runInContext(`skillAimSpec(${JSON.stringify(id)},1)`, context);
  assert(qAim && qAim.type, `${id} missing Q skill range preview`);
  if (data.secondSkills.includes(id)) {
    const rAim = vm.runInContext(`skillAimSpec(${JSON.stringify(id)},2)`, context);
    assert(rAim && rAim.type, `${id} missing R skill range preview`);
  }
  const trace = [];
  context.renderPressure = 0;
  context.ctx = new Proxy({globalAlpha: 1}, {
    get(target, key) { return key in target ? target[key] : (...args) => trace.push([key, ...args]); },
    set(target, key, value) { target[key] = value; return true; }
  });
  vm.runInContext(`drawCannonSignature(${JSON.stringify(id)}, 0, 12, 'projectile')`, context);
  const fingerprint = JSON.stringify(trace);
  assert(!traces.has(fingerprint), `${id} reuses another cannon's visual signature`);
  traces.add(fingerprint);
  if (data.themes.indexOf(id) >= 30) {
    trace.length = 0;
    const rendered = vm.runInContext(`drawVariantProjectile({cannon:${JSON.stringify(id)},motionSeed:0}, 1)`, context);
    assert.equal(rendered, true, `${id} missing dedicated projectile`);
    const variant = JSON.stringify(trace);
    assert(!variantTraces.has(variant), `${id} repeats another projectile silhouette`);
    variantTraces.add(variant);
  }
}
for (const id of data.evolutions) {
  if (['basic', 'smasher', 'landmine', 'spike'].includes(id)) continue;
  assert(data.barrels[id].length, `${id} has no visible barrel`);
  for (const spec of data.barrels[id]) {
    if (spec.kind !== 'barrel') continue;
    const end = 27 * (.28 + .74 + .78 * (spec.len || 1)) + 3;
    assert(end > 27 + 8, `${id} barrel is hidden behind the body`);
  }
}
assert(source.includes("drawCannonSignature(b.cannon,time+(b.motionSeed||0)"));
assert(source.includes('drawSkillRune(z,t,p)'), 'active zones should draw runes');
assert(source.includes('const glow=TANK_THEMES[b.cannon]?.glow'), 'bullets should use equipped cannon trail color');
const runeTrace=[];
context.ctx=new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(...args)=>runeTrace.push([key,...args]),set:(target,key,value)=>(target[key]=value,true)});
context.renderPressure=0;
vm.runInContext("drawSkillRune({type:'thunderStorm',radius:300},1,1)",context);
assert(runeTrace.filter(entry=>entry[0]==='arc').length>=3,'area rune needs concentric marks');
runeTrace.length=0;
vm.runInContext("drawSkillRune({type:'dekuSmoke',radius:300},1,1)",context);
assert.equal(runeTrace.length,0,'smoke must not receive a circular overlay');
assert(source.includes("drawCannonSignature(f.cannon,t+q*2"));
const twinContext = vm.createContext({TAU:Math.PI*2, TANK_THEMES:{standard:{glow:'#fff'}}, drawPlayerCannon:(cannon,r)=>twinDraws.push([cannon,r]), twinDraws:[]});
const twinDraws = twinContext.twinDraws;
vm.runInContext(section('function evolutionBarrelSpecs(', 'function evolutionHasNoBasicGun(')+section('function drawEvolutionChassis(', 'function drawEvolutionAutoTurretCaps('),twinContext);
twinContext.ctx = new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(...args)=>{if(key==='translate')twinOffsets.push(args)},set:(target,key,value)=>(target[key]=value,true)});
const twinOffsets=[];
vm.runInContext("drawEvolutionChassis({classType:'twin',cannonType:'scout'},27)",twinContext);
assert.deepEqual(twinDraws,[['scout',27],['scout',27]],'Twin must retain two copies of the equipped cannon');
assert.deepEqual(twinOffsets,[[0,-10],[0,10]],'Twin visuals must follow both firing lanes');
context.WORLD = 12600;
const central = [];
context.spawnShape = type => { const shape = {type}; central.push(shape); return shape; };
for (let slot=0;slot<200;slot++) vm.runInContext(`spawnCentralPentagon(${slot})`, context);
assert.equal(central.length, 200);
assert.equal(new Set(central.map(s=>s.centralSlot)).size, 200);
for (const s of central) {
  assert.equal(s.type, 'pentagon');
  assert.equal(s.centralCluster, true);
  assert(Math.hypot(s.x-6300,s.y-6300)<600, 'pentagon escaped central cluster');
}
context.running = true;
context.player = {alive:true,x:6300,y:6300,r:27,angle:0,errorSwordMode:false,overclockUntil:0};
context.worldToScreen = (x,y) => [x-5800,y-5800];
context.phantomMarkCanReturn = () => false;
context.nearestSkillTarget = () => ({x:6450,y:6300});
const previewTrace = [];
context.ctx = new Proxy({}, {
  get(target,key) { return key in target ? target[key] : (...args) => previewTrace.push([key,...args]); },
  set(target,key,value) { target[key]=value; return true; }
});
for (const id of data.themes) {
  context.player.cannonType=id;
  for (const slot of [1,...(data.secondSkills.includes(id)?[2]:[])]) {
    context.heldSkillAim={active:true,slot,angle:0};
    const before=previewTrace.length;
    vm.runInContext('drawSkillAimGuide()',context);
    assert(previewTrace.length>before,`${id} slot ${slot} rendered no range guide`);
  }
}
console.log(`Coverage OK: ${data.themes.length} cannons, ${data.evolutions.length} evolution bodies, 200 central pentagons`);
