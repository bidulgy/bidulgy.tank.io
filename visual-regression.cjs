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
  section('const AMALGAM_SKILLS=', 'const TANK_THEMES='),
  section('const TANK_THEMES=', '// V5.61: Diep.io-style evolution tree.'),
  section('const DIEP_EVOLUTION_INFO=', 'const DIEP_EVOLUTION_CHILDREN='),
  section('function evolutionBarrelSpecs(', 'function evolutionHasNoBasicGun('),
  section('function evolutionVolleySpecs(', 'function evolutionShotsFromBase('),
  section('function evolutionShotsFromBase(', 'function drawEvolutionChassis('),
  section('function drawVariantProjectile(', 'function drawUniqueProjectile('),
  section('function drawProjectileEnergy(', 'function drawBullets('),
  section('function amalgamSkillAimSpec(', 'function aimPal('),
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
assert.equal(vm.runInContext('Object.keys(AMALGAM_SKILLS).length',context),15,'Amalgam needs fifteen draftable skills');
assert.equal(vm.runInContext('Object.values(AMALGAM_SKILLS).every((_,i,a)=>true)&&Object.values(AMALGAM_SKILLS).filter(s=>s.rarity==="common").length',context),3,'Amalgam needs three common skills');
for(const rarity of ['rare','epic','legendary','mythic'])assert.equal(vm.runInContext(`Object.values(AMALGAM_SKILLS).filter(s=>s.rarity===${JSON.stringify(rarity)}).length`,context),3,`Amalgam needs three ${rarity} skills`);
assert.equal(vm.runInContext('AMALGAM_RARITY_POWER.mythic > AMALGAM_RARITY_POWER.legendary && AMALGAM_RARITY_POWER.legendary > AMALGAM_RARITY_POWER.epic && AMALGAM_RARITY_POWER.epic > AMALGAM_RARITY_POWER.rare && AMALGAM_RARITY_POWER.rare > AMALGAM_RARITY_POWER.common',context),true,'Amalgam skill power must rise at every rarity');
assert(source.includes("if(player?.cannonType==='amalgam'){hideEvolutionPanel();return}"),'Amalgam must never open evolution choices');
assert(source.includes('while((isAmalgam||player.level<45)'), 'Amalgam must have no level cap');
assert(source.includes('if(isAmalgam)queueAmalgamDraft(player.level)'), 'Amalgam must draft a skill on level milestones');
assert(source.includes("if(level<3||level%3!==0)return"),'Amalgam drafts must occur every three levels');
assert(source.includes("!['deku','amalgam'].includes(player?.cannonType)"),'Amalgam Y aiming must not be cancelled by the Deku-only legacy guard');
assert(source.includes("e.stopImmediatePropagation();castAmalgamSkill(3)"),'Amalgam G must activate directly from the keyboard');
assert(source.includes("if(cannon==='amalgam')return amalgamSkillAimSpec(slot)"),'Every Amalgam skill slot must use its own aim preview');
context.player.amalgamSkills=['shardVolley','gravityWell','thunderLance','worldSever'];
assert.deepEqual([1,2,3,4].map(slot=>vm.runInContext(`skillAimSpec('amalgam',${slot}).type`,context)),['self','autoTarget','target','line'],'Amalgam Q/R/T/G need active aim previews matching their mechanics');
assert(source.includes("b.team='player';b.owner=player")&&source.includes("b.vx*=-1.35"),'Inertia Reversal must return hostile bullets instead of spawning a radial attack');
assert(source.includes('player.amalgamAnchor={x:player.x,y:player.y,hp:player.hp}')&&source.includes('player.x=anchor.x;player.y=anchor.y'),'Return Anchor must be a two-stage saved-position skill');
assert(source.includes('for(let i=0;i<4;i++)if(i!==slot)player.amalgamSkillReadyAt[i]=0'),'Overload Trade must reset the other equipped skills');
assert(source.includes('const old=getRewindState(4000)'),'Amalgam Time Reversal must restore recorded state');
assert(source.includes("if(player?.cannonType==='amalgam'){castAmalgamSkill(slot-1);return}"),'Amalgam HUD buttons must cast immediately without relying on pointer release');
assert(source.includes("player.amalgamDraftQueue.shift();player.amalgamDraftChoices=[];renderAmalgamDraft()"),'Cancelling a draft must dismiss exactly one queued skill choice');
assert(source.includes("f.type==='amalgamSkyLance'")&&source.includes("drawElectricArc(topX,topY,0,tipY"),'Thunder Lance must descend from a perspective height with a physical weapon');
assert(source.includes("f.type==='amalgamWorldBlade'")&&source.includes("ctx.rotate(swing)"),'World Sever must render an actual swinging blade');
assert(source.includes("const motif=(CANNON_VISUAL_INDEX[f.cannon]??0)%6"),'Generic skill effects must split into cannon-specific motion families');
assert(!source.includes("f.type==='uniqueSkill'){\n      ctx.strokeStyle=f.color;ctx.lineWidth=5*p+1"),'The old circle-and-cross-line skill effect must stay removed');
assert(source.includes("e.code==='KeyG'||String(e.key||'').toLowerCase()==='g'"),'Desktop Amalgam fourth skill must use G');
assert(source.includes('function suppressBasicAttack(ms=460)')&&source.includes('skillBlockingFire'),'Skill activation must suppress basic and Auto 5 fire');
assert(source.includes("canvas.getContext('2d',{alpha:false,desynchronized:true})"),'Canvas should request the low-latency opaque rendering path');
assert(source.includes('frameWorkMs>27')&&source.includes('frameWorkMs>18'),'Render pressure must detect expensive frames even with few effects');
assert(source.includes("['Q','R','T','G'][i]"),'Amalgam HUD must label the fourth skill as G');
assert(source.includes("keys=['Q','R','T','G']"),'Amalgam replacement choices must label the fourth slot as G');
assert(source.includes("if(player?.cannonType==='amalgam'){castAmalgamSkill(slot-1);return}"),'Mobile Amalgam skill buttons must cast on pointer down');
context.player.amalgamSkills=['repairPulse','frostNova','sentryRing','genesisShield'];
assert.deepEqual([1,2,3,4].map(slot=>vm.runInContext(`skillAimSpec('amalgam',${slot})`,context)),[null,null,null,null],'Defensive Amalgam skills must not display attack hitbox previews');
assert(source.includes("f.type==='amalgamShield'")&&source.includes('const rank=AMALGAM_RARITY_ORDER[f.variant]'),'Defensive skills need physical shields scaled by rarity');
assert(source.includes("f.type==='amalgamSkillSig'")&&source.includes("s==='chronoBreak'")&&source.includes("s==='genesisShield'"),'Amalgam skills need distinct silhouettes instead of a shared recolored effect');
assert(source.includes("f.type==='amalgamFrostStop'")&&source.includes("spawnAmalgamShield(def,2.4)"),'Reflective Gauntlet must use its restored plate shield while Absolute Stop remains distinct');
assert(source.includes("f.type==='amalgamRepairArmor'")&&source.includes("f.type==='amalgamPhoenixAegis'")&&source.includes("f.type==='amalgamGenesisCitadel'"),'Other defensive skills must use unique armor, phoenix and citadel forms');
assert(source.includes("special:'amalgamThrownLance'")&&source.includes("special:'amalgamFlyingBlade'"),'Lance and sword skills need multi-projectile ranged weapon attacks');
assert(source.includes('function drawAmalgamLanceModel(')&&source.includes('function drawAmalgamBladeModel('),'Amalgam weapon skills need reusable detailed weapon models');
assert(source.includes("drawAmalgamLanceModel(205,1.08,'#fff176')")&&source.includes("drawAmalgamBladeModel(len,1.12,'#8fdcff')"),'Held and falling weapons must render the detailed forged models');
assert(source.includes('playerHistory=playerHistory.filter(item=>item.t<=old.t)')&&source.includes('camera.x=player.x-innerWidth/2'),'Time Reversal must restore history and camera at the rewound position');
assert(data.themes.includes('gojo'),'Gojo needs a dedicated tank theme');
assert(authSource.includes("id:'gojo',name:'고죠',rarity:'singularity'"),'Gojo must be Singularity');
assert(authSource.includes("c.id==='gojo'?'한 전투 생존 30분 해금 · 뽑기 제외'"),'Gojo must not appear as a gacha drop');
assert(unlockSql.includes("'deku','sniper','bloodlust','gojo'"),'equipping Gojo must be server supported');
assert.equal(vm.runInContext("DIEP_EVOLUTION_INFO.quadTank.mods.damage ?? 1",context),1,'Quad evolution must not lower base damage');
assert.equal(vm.runInContext("evolutionVolleySpecs('quadTank',27,1).length",context),4,'Quad must keep four firing directions');
assert.equal(vm.runInContext("evolutionVolleySpecs('quadTank',27,1).every(shot => shot.damageScale === 1)",context),true,'Quad bullets must retain full damage');
assert.equal(vm.runInContext("evolutionVolleySpecs('twin',27,1).length",context),2,'Twin must fire both barrels together');
assert.equal(vm.runInContext("evolutionVolleySpecs('twin',27,1).map(shot => shot.side).join(',')",context),'-10,10','Twin shots must originate from opposite barrels');
assert.equal(vm.runInContext("evolutionVolleySpecs('triplet',27,1).length",context),3,'Triplet must fire all three barrels together');
assert.equal(vm.runInContext("evolutionVolleySpecs('triplet',27,1).map(shot => shot.side).join(',')",context),'-8,0,8','Triplet shots must originate from all three firing lanes');
assert.equal(vm.runInContext("evolutionVolleySpecs('machineGun',27,1).length",context),1,'Machine Gun normal cycles must fire one scattered round');
assert.equal(vm.runInContext("evolutionVolleySpecs('machineGun',27,3).length",context),5,'Machine Gun burst cycles must spawn five rounds together');
assert.equal(vm.runInContext("evolutionVolleySpecs('machineGun',27,3).map(shot => shot.a).join(',')",context),'-0.16,-0.08,0,0.08,0.16','Machine Gun burst must form one symmetric spread fan');
assert(source.includes("e.code==='KeyE'&&player?.cannonType==='gojo'"),'Gojo Aka must use E');
assert(source.includes('return tryGojoPurple()'),'simultaneous Q+E must trigger Purple');
assert.equal(vm.runInContext("skillAimSpec('gojo',1).type",context),'target','Ao needs an area preview');
assert.equal(vm.runInContext("skillAimSpec('gojo',2).type",context),'target','Aka needs an area preview');
const traces = new Set();
const variantTraces = new Set();
for (const id of data.themes) {
  assert(data.shapes.includes(id), `${id} missing projectile shape`);
  assert(data.skills.includes(id), `${id} missing skill`);
  if(id==='amalgam')context.player.amalgamSkills=['shardVolley','gravityWell','thunderLance','worldSever'];
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
assert(authSource.includes("client.rpc('iron_cell_equip_cannon_v3'")&&authSource.includes("equipped_cannon_not_saved"),'Cannon equip must use the verified V3 RPC and confirm persistence');
assert(authSource.includes("client.rpc('iron_cell_admin_set_cannon_v3'"),'admin grants must use the verified singularity-aware V3 RPC');
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
twinDraws.length=0;twinOffsets.length=0;
vm.runInContext("drawEvolutionChassis({classType:'machineGun',cannonType:'scout'},27)",twinContext);
assert.equal(twinDraws.length,0,'Machine Gun must use its dedicated evolved barrel silhouette');
const machineGunVolley=vm.runInContext("evolutionShotsFromBase('machineGun',27,3,{angle:0,side:0,damageMul:1},0)",context);
assert.equal(machineGunVolley.length,5,'Machine Gun spread bullets must be created in one firing call');
assert.deepEqual(Array.from(machineGunVolley,v=>v.angle),[-.16,-.08,0,.08,.16],'Machine Gun projectile angles must match the visible fan');
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
  if(id==='amalgam')context.player.amalgamSkills=['shardVolley','gravityWell','thunderLance','worldSever'];
  for (const slot of [1,...(data.secondSkills.includes(id)?[2]:[])]) {
    context.heldSkillAim={active:true,slot,angle:0};
    const before=previewTrace.length;
    vm.runInContext('drawSkillAimGuide()',context);
    assert(previewTrace.length>before,`${id} slot ${slot} rendered no range guide`);
  }
}
console.log(`Coverage OK: ${data.themes.length} cannons, ${data.evolutions.length} evolution bodies, 200 central pentagons, Auto 5 tracking`);
