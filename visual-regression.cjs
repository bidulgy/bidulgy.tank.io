const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(__dirname + '/game.js', 'utf8');
const authSource = fs.readFileSync(__dirname + '/auth.js', 'utf8');
const unlockSql = fs.readFileSync(__dirname + '/singularity_unlock.sql', 'utf8');
const gojoRewardSql = fs.readFileSync(__dirname + '/gojo_reward_fix.sql', 'utf8');
const bossSql = fs.readFileSync(__dirname + '/amalgam_boss_v606.sql', 'utf8');
const rewardSql = fs.readFileSync(__dirname + '/run_reward_v608.sql', 'utf8');
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
  section('function evolutionShotsFromBase(', 'function drawEvolutionChassis('),
  section('function drawVariantProjectile(', 'function drawUniqueProjectile('),
  section('function drawProjectileEnergy(', 'function drawBullets('),
  section('function skillAimSpec(', 'function aimPal('),
  section('function aimPal(', 'function drawAimGuides('),
  section('function skillRuneColor(', 'function drawSkillZones('),
  section('function centralPentagonPoint(', 'function minDistanceToActiveAnchors(')
].join('\n'), context);
context.player = {errorSwordMode:false,overclockUntil:0};
context.performance = {now:() => 1000};
context.phantomPreviewDistance = () => 700;
context.gojoAimPoint = () => [6450,6300];

const data = vm.runInContext(`({
  themes: Object.keys(TANK_THEMES),
  shapes: Object.keys(PROJECTILE_SHAPE),
  skills: Object.keys(CANNON_SKILLS),
  secondSkills: Object.keys(CANNON_SKILLS_2),
  evolutions: Object.keys(DIEP_EVOLUTION_INFO),
  barrels: Object.fromEntries(Object.keys(DIEP_EVOLUTION_INFO).map(id => [id, evolutionBarrelSpecs(id, 27)]))
})`, context);
assert.equal(data.themes.length, 48, 'all 48 cannon themes must remain');
assert(data.themes.includes('gojo'),'Gojo needs a dedicated tank theme');
assert(authSource.includes("id:'gojo',name:'고죠',rarity:'singularity'"),'Gojo must be Singularity');
assert(authSource.includes("c.id==='gojo'?'한 전투 생존 30분 해금 · 뽑기 제외'"),'Gojo must not appear as a gacha drop');
assert(unlockSql.includes("'deku','sniper','bloodlust','gojo'"),'equipping Gojo must be server supported');
assert.equal(vm.runInContext("DIEP_EVOLUTION_INFO.quadTank.mods.damage ?? 1",context),1,'Quad evolution must not lower base damage');
assert.equal(vm.runInContext("evolutionVolleySpecs('quadTank',27,1).length",context),4,'Quad must keep four firing directions');
assert.equal(vm.runInContext("evolutionVolleySpecs('quadTank',27,1).every(shot => shot.damageScale === 1)",context),true,'Quad bullets must retain full damage');
assert.equal(vm.runInContext("evolutionVolleySpecs('twin',27,1).length",context),2,'Twin must fire both barrels together');
assert.equal(vm.runInContext("evolutionVolleySpecs('twin',27,1).map(shot => shot.side).join(',')",context),'-10,10','Twin shots must originate from opposite barrels');
assert(source.includes("e.code==='KeyE'&&player?.cannonType==='gojo'"),'Gojo Aka must use E');
assert(source.includes('return tryGojoPurple()'),'simultaneous Q+E must trigger Purple');
assert.equal(vm.runInContext("skillAimSpec('gojo',1).type",context),'target','Ao needs an area preview');
assert.equal(vm.runInContext("skillAimSpec('gojo',2).type",context),'target','Aka needs an area preview');
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
assert(source.includes('drawProjectileEnergy(b,time)'), 'all visible bullets should receive their energy detail');
const energyTrace=[];
context.ctx=new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(...args)=>energyTrace.push([key,...args]),set:(target,key,value)=>(target[key]=value,true)});
context.renderPressure=0;
vm.runInContext("drawProjectileEnergy({cannon:'stellar',r:10,team:'player'},1)",context);
assert(energyTrace.some(entry=>entry[0]==='arc'||entry[0]==='lineTo'),'projectile detail should draw themed geometry');
energyTrace.length=0;context.renderPressure=2;
vm.runInContext("drawProjectileEnergy({cannon:'stellar',r:10,team:'player'},1)",context);
assert.equal(energyTrace.length,0,'dense battles should skip projectile detail');
const runeTrace=[];
context.ctx=new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(...args)=>runeTrace.push([key,...args]),set:(target,key,value)=>(target[key]=value,true)});
context.renderPressure=0;
vm.runInContext("drawSkillRune({type:'thunderStorm',radius:300},1,1)",context);
assert(runeTrace.some(entry=>entry[0]==='lineTo'),'thunder rune needs angular circuit geometry');
const thunderTrace=JSON.stringify(runeTrace);
runeTrace.length=0;
vm.runInContext("drawSkillRune({type:'timeField',radius:300},1,1)",context);
assert.notEqual(JSON.stringify(runeTrace),thunderTrace,'area skills need distinct rune geometry');
runeTrace.length=0;
vm.runInContext("drawSkillRune({type:'dekuSmoke',radius:300},1,1)",context);
assert.equal(runeTrace.length,0,'smoke must not receive a circular overlay');
runeTrace.length=0;
vm.runInContext("drawSkillRune({type:'barrier',radius:180},1,1)",context);
assert.equal(runeTrace.length,0,'physical walls must not receive a magic circle');
assert(source.includes("drawCannonSignature(f.cannon,t+q*2"));
assert(source.includes("spawnCombatFx('gojoInfinityShot'"),'Gojo basic attacks need their own visible cast effect');
assert(authSource.includes("visibleCannons.filter(c=>c.id!=='gojo'||owned.has('gojo'))"),'Gojo must stay hidden until earned');
assert(authSource.includes(".filter(c=>c.id!=='amalgam'||owned.has('amalgam'))"),'Amalgam must be invisible until earned');
assert(authSource.includes('els.adminCannonGrid.innerHTML=displayCannons().map'),'Admins must be able to grant and revoke Amalgam');
assert(authSource.includes("if(currentUser)void refreshProfile().catch"),'Garage must refresh server-side admin grants before rendering choices');
assert(authSource.includes("adminEnabled&&String(currentUsername).toLowerCase()==='bidulgy'"),'Verified owner must retain singularity choices while the profile cache refreshes');
assert(authSource.includes('setAdminButtonVisible(true);\n        renderProfile();'),'Garage must rerender as soon as owner admin verification finishes');
assert(!authSource.includes('const singularityPriority='),'Singularity tanks must remain at the bottom of the garage');
assert(fs.readFileSync(__dirname + '/singularity_selection_v611.sql','utf8').includes('security definer'),'Owned singularity equip RPC must have permission to update the caller profile');
assert(authSource.includes("client.rpc('iron_cell_equip_cannon_v2'")&&authSource.includes("equipped_cannon_not_saved"),'Cannon equip must use the verified V2 RPC and confirm persistence');
assert(authSource.includes("client.rpc('iron_cell_admin_set_cannon_v2'"),'admin grants must use the verified Gojo-aware RPC');
assert(authSource.includes('async function reportGojoDeath(')&&authSource.includes('async function confirmGojoKill('),'Gojo kill attestation client hooks are missing');
assert(source.includes("victimCannon:defeatedCannon")&&source.includes('confirmGojoKill?.'),'Gojo PvP reward handshake is missing');
assert(source.includes('player.survivalSeconds>=1800')&&authSource.includes('function unlockLocalGojo()'),'30-minute survival unlock is missing');
assert(source.includes("addSkillZone('gojoAkaProjectile'")&&source.includes('distanceToWorldEdge(player.x,player.y,a,120)'),'Red and Purple must reach the world boundary');
assert(gojoRewardSql.includes('iron_cell_admin_set_cannon_v2')&&gojoRewardSql.includes('iron_cell_gojo_kill_attestations'),'Gojo reward database migration is incomplete');
assert(source.includes("z.type==='gojoAkaProjectile'")&&source.includes("z.type==='gojoPurpleProjectile'"),'Gojo zones must skip the generic magic circle');
assert(source.includes("addSkillZone('gojoPurpleProjectile'"),'Purple needs a collision-tracked moving projectile');
assert(!source.includes("damageSkillLine(player.x,player.y,a,length,78,p.damage*13"),'Purple must not damage the full path before contact');
assert(source.includes("if(elapsed<charge)continue"),'Purple damage must wait until its merge animation completes');
assert(source.includes("if(slot===1&&player?.cannonType==='gojo')startGojoAoHold()"),'Blue must start while Q is held');
assert(source.includes("const [tx,ty]=gojoAimPoint(480);z.x=tx;z.y=ty"),'Held Blue must follow the cursor');
assert(source.includes('const AMALGAM_BOSS_HP=1000000')&&source.includes('const BOSS_SLOT_MS=30*60*1000'),'Amalgam must use 1M HP and half-hour slots');
assert(source.includes('s.hp=1;')&&source.includes('bossContributions:'),'boss death and host transfer safeguards are missing');
assert(bossSql.includes('v_stones bigint:=greatest(0,least(1000000,v_damage))')&&bossSql.includes('random() < (v_damage::numeric/1000000.0)*0.10'),'boss rewards must scale with contribution');
assert(bossSql.includes('primary key (user_id,boss_slot)'),'boss rewards must be idempotent per player and slot');
assert(rewardSql.match(/v_award:=v_score\*5/g)?.length===2,'finished runs must award five gems per reported EXP/score');
assert(source.includes('(player.score*5).toLocaleString()'),'death reward preview must match the server 1:5 rate');
const twinContext = vm.createContext({TAU:Math.PI*2, TANK_THEMES:{standard:{glow:'#fff'}}, drawPlayerCannon:(cannon,r)=>twinDraws.push([cannon,r]), twinDraws:[]});
const twinDraws = twinContext.twinDraws;
vm.runInContext(section('function evolutionBarrelSpecs(', 'function evolutionHasNoBasicGun(')+section('function drawEvolutionChassis(', 'function drawEvolutionAutoTurretCaps('),twinContext);
twinContext.ctx = new Proxy({globalAlpha:1},{get:(target,key)=>key in target?target[key]:(...args)=>{if(key==='translate')twinOffsets.push(args)},set:(target,key,value)=>(target[key]=value,true)});
const twinOffsets=[];
vm.runInContext("drawEvolutionChassis({classType:'twin',cannonType:'scout'},27)",twinContext);
assert.deepEqual(twinDraws,[['scout',27],['scout',27]],'Twin must retain two copies of the equipped cannon');
assert.deepEqual(twinOffsets,[[0,-10],[0,10]],'Twin visuals must follow both firing lanes');
twinDraws.length=0;twinOffsets.length=0;
vm.runInContext("drawEvolutionChassis({classType:'tripleShot',cannonType:'scout'},27)",twinContext);
assert.deepEqual(twinDraws,[['scout',27],['scout',27],['scout',27]],'Tier 2/3 evolution barrels must retain the equipped cannon appearance');
context.WORLD = 12600;
const central = [];
context.spawnShape = type => { const shape = {type}; central.push(shape); return shape; };
for (let slot=0;slot<200;slot++) vm.runInContext(`spawnCentralPentagon(${slot})`, context);
assert.equal(central.length, 200);
assert.equal(new Set(central.map(s=>s.centralSlot)).size, 200);
for (const s of central) {
  assert.equal(s.type, 'pentagon');
  assert.equal(s.centralCluster, true);
  assert(Math.hypot(s.x-6300,s.y-6300)<610, 'pentagon escaped restored dense central cluster');
}
const auto5Volley=vm.runInContext("evolutionShotsFromBase('auto5',27,1,{angle:0,side:0,damageMul:1,autoAimAngles:[.1,.2,.3,.4,.5],autoAimReady:[true,true,true,true,true]},0)",context);
assert.equal(auto5Volley.length,5,'Auto 5 must fire all five turrets');
assert.deepEqual(Array.from(auto5Volley,v=>v.angle),[.1,.2,.3,.4,.5],'Auto 5 turrets must use tracked target angles');
assert(auto5Volley.every(v=>Number.isFinite(v.evoTurretOffsetX)&&Number.isFinite(v.evoTurretOffsetY)),'Auto 5 bullets must originate at turret mounts');
const auto5AlignedVolley=vm.runInContext("evolutionShotsFromBase('auto5',27,1,{angle:0,side:0,damageMul:1,autoAimAngles:[.1,.2,.3,.4,.5],autoAimReady:[true,false,false,false,false]},0)",context);
assert.equal(auto5AlignedVolley.length,1,'Auto 5 must only fire turrets that have turned onto their target');
assert(source.includes("input.keys.has('Space')||auto5Hunting"),'Auto 5 must fire without manual input while a target exists');
assert(source.includes('angleLerp(current,desired')&&source.includes('updateAuto5Aim(player,dt)'),'Auto 5 turrets must rotate gradually instead of snapping');
assert(source.includes('angles.push(current);ready.push(false)'),'Auto 5 turrets must hold position while no target is nearby');
assert(source.includes("auto5AimAngles:player.classType==='auto5'"),'Auto 5 turret directions must sync to other players');
context.running = true;
context.player = {alive:true,x:6300,y:6300,r:27,angle:0,errorSwordMode:false,overclockUntil:0};
context.worldToScreen = (x,y) => [x-5800,y-5800];
context.phantomMarkCanReturn = () => false;
context.nearestSkillTarget = () => ({x:6450,y:6300});
const previewTrace = [];
context.ctx = new Proxy({}, {
  get(target,key) { if(key==='createRadialGradient'||key==='createLinearGradient')return(...args)=>{previewTrace.push([key,...args]);return{addColorStop:(...stop)=>previewTrace.push(['addColorStop',...stop])}};return key in target ? target[key] : (...args) => previewTrace.push([key,...args]); },
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
console.log(`Coverage OK: ${data.themes.length} cannons, ${data.evolutions.length} evolution bodies, 200 central pentagons, Auto 5 tracking`);
