(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const ui={level:document.querySelector('#levelText'),score:document.querySelector('#scoreText'),xp:document.querySelector('#xpBar'),points:document.querySelector('#pointText'),upgrades:document.querySelector('#upgradeList'),upgradePanel:document.querySelector('#upgradePanel'),startScreen:document.querySelector('#startScreen'),deathScreen:document.querySelector('#deathScreen'),startBtn:document.querySelector('#startBtn'),respawnBtn:document.querySelector('#respawnBtn'),leaveBattleBtn:document.querySelector('#leaveBattleBtn'),nameInput:document.querySelector('#nameInput'),deathLevel:document.querySelector('#deathLevel'),deathScore:document.querySelector('#deathScore'),deathKills:document.querySelector('#deathKills'),deathGems:document.querySelector('#deathGems'),classPanel:document.querySelector('#classPanel'),classChoices:document.querySelector('#classChoices'),onlineCount:document.querySelector('#onlineCount'),networkStatus:document.querySelector('#networkStatus'),skillHud:document.querySelector('#skillHud'),skillBtn:document.querySelector('#skillBtn'),skillName:document.querySelector('#skillName'),skillCooldown:document.querySelector('#skillCooldown'),skillFill:document.querySelector('#skillFill'),skill2Btn:document.querySelector('#skill2Btn'),skill2Name:document.querySelector('#skill2Name'),skill2Cooldown:document.querySelector('#skill2Cooldown'),skill2Fill:document.querySelector('#skill2Fill'),skill3Btn:document.querySelector('#skill3Btn'),skill3Name:document.querySelector('#skill3Name'),skill3Cooldown:document.querySelector('#skill3Cooldown'),skill3Fill:document.querySelector('#skill3Fill'),skill4Btn:document.querySelector('#skill4Btn'),skill4Name:document.querySelector('#skill4Name'),skill4Cooldown:document.querySelector('#skill4Cooldown'),skill4Fill:document.querySelector('#skill4Fill')};
const TAU=Math.PI*2,WORLD=12600,GRID=56;
// V5.34: 9배 맵에 맞춘 적 밀도/스폰 강화.
const NORMAL_SHAPE_TARGET=220;
const NORMAL_SHAPE_HARD_CAP=260;
const WORLD_SNAPSHOT_INTERVAL=650;

const INITIAL_NORMAL_SHAPES=110;

const NORMAL_SPAWN_INTERVAL=.10;
const NORMAL_SPAWN_BATCH=4;

// 플레이어가 맵 구석/외곽으로 이동해도 주변이 비지 않도록 최소 밀도를 유지한다.
const LOCAL_SHAPE_RADIUS=1650;
const LOCAL_SHAPE_MIN=34;
const LOCAL_SHAPE_SPAWN_MIN_DISTANCE=430;
const LOCAL_SHAPE_SPAWN_MAX_DISTANCE=1350;
const LOCAL_SHAPE_RECYCLE_DISTANCE=3000;
const LOCAL_REBALANCE_INTERVAL=.28;
const LOCAL_REBALANCE_BATCH=4;
let running=false,paused=false,last=performance.now(),camera={x:0,y:0},shapes=[],bullets=[],particles=[],combatFx=[],skillZones=[],shake=0,classUpgradeShown=false,player,playerHistory=[];
const remotePlayers=new Map();
let onlineChannel=null,onlineReady=false,onlineSelfId='',lastStateSend=0,networkSerial=0,lastRunAutosave=0,runSaveBusy=false,normalSpawnTimer=0;
let onlineReconnectTimer=0,onlineReconnectBusy=false,lastNetworkStateReceive=0;
let localStateSeq=0,lastSkillHudFrameUpdate=0;
const cachedPresenceIds=new Set();
const REMOTE_STATE_INTERVAL=110;
const REMOTE_PLAYER_STALE_MS=45000;
const REMOTE_PLAYER_ABSENT_GRACE_MS=30000;
const MAX_PARTICLES=360;
const MAX_COMBAT_FX=170;
const MAX_BULLETS=650;
const MAX_SKILL_ZONES=120;
let localRebalanceTimer=0,normalSpawnAnchorCursor=0;
let worldHostId='',worldSnapshotSeq=0,lastWorldSnapshotSend=0,lastWorldSnapshotReceive=0,shapeSerial=0;
const processedDamageIds=new Set();
const input={keys:new Set(),mouseX:innerWidth/2,mouseY:innerHeight/2,firing:false,moveX:0,moveY:0,mobileAimActive:false};
const heldSkillAim={active:false,slot:0,source:'',pointerId:null,startX:0,startY:0,angle:null,distance:null,moved:false};

const CANNON_FAMILY=Object.freeze({
  standard:'standard',scout:'standard',bastion:'standard',
  rapid:'rapid',dual:'rapid',needle:'rapid',
  spread:'spread',burst:'spread',crystal:'spread',
  piercer:'piercer',laser:'piercer',drill:'piercer',
  plasma:'plasma',thunder:'plasma',inferno:'rocket',
  rocket:'rocket',titan:'rocket',phantom:'piercer',
  ring:'ring',chrono:'ring',void:'nova',
  nova:'nova',comet:'nova',stellar:'nova',
  error:'error',glitch:'error',zero:'error',deku:'deku'
});
function cannonFamily(id){return CANNON_FAMILY[id]||'standard'}

const PROJECTILE_SHAPE=Object.freeze({
  standard:'standardSlug', scout:'scoutArrow', bastion:'bastionShell',
  rapid:'rapidTracer', dual:'dualPulse', needle:'needleDart',
  spread:'spreadShard', burst:'burstDisc', crystal:'crystalShard',
  piercer:'piercerLance', laser:'laserRay', drill:'drillBit',
  plasma:'plasmaOrb', thunder:'thunderOrb', inferno:'infernoBall',
  rocket:'rocketMissile', titan:'titanShell', phantom:'phantomBolt',
  ring:'dimensionRing', chrono:'chronoRing', void:'voidOrb',
  nova:'novaStar', comet:'cometCore', stellar:'stellarStar',
  error:'errorBlock', glitch:'glitchPacket', zero:'zeroCore', deku:'dekuAirForce'
});
function projectileShapeForCannon(cannon){return PROJECTILE_SHAPE[cannon]||'standardSlug'}



const CANNON_SKILLS=Object.freeze({
  standard:{name:'궤도 포격',cooldown:14,color:'#69c8ff'},
  scout:{name:'그래플 훅',cooldown:12,color:'#65d8ff'},
  bastion:{name:'방벽 전개',cooldown:18,color:'#91b6d9'},
  rapid:{name:'오버드라이브',cooldown:16,color:'#70f3a0'},
  dual:{name:'트윈 드론',cooldown:18,color:'#79f0bf'},
  needle:{name:'하푼 스파이크',cooldown:17,color:'#b5ff89'},
  spread:{name:'충격 산탄',cooldown:15,color:'#6ff3ff'},
  burst:{name:'리바운드 코어',cooldown:16,color:'#58e6ef'},
  crystal:{name:'프리즘 게이트',cooldown:18,color:'#a5f7ff'},
  piercer:{name:'레일 스나이프',cooldown:17,color:'#c09aff'},
  laser:{name:'레이저 스윕',cooldown:20,color:'#e0b7ff'},
  drill:{name:'터널 브레이커',cooldown:19,color:'#b58aff'},
  plasma:{name:'플라즈마 케이지',cooldown:20,color:'#65ecff'},
  thunder:{name:'뇌운 폭격',cooldown:18,color:'#fff06f'},
  inferno:{name:'화염 장벽',cooldown:21,color:'#ff794f'},
  rocket:{name:'미사일 레인',cooldown:21,color:'#ff9b4a'},
  titan:{name:'대지 절단',cooldown:23,color:'#ffb05e'},
  phantom:{name:'암살 표식',cooldown:19,color:'#b9a4ff'},
  ring:{name:'게이트 리피터',cooldown:20,color:'#c09aff'},
  chrono:{name:'시간 정지',cooldown:22,color:'#9edcff'},
  void:{name:'보이드 싱크',cooldown:23,color:'#9f77ff'},
  nova:{name:'초신성 핵',cooldown:25,color:'#74efff'},
  comet:{name:'혜성 돌파',cooldown:20,color:'#67dfff'},
  stellar:{name:'별자리 결계',cooldown:26,color:'#d6f7ff'},
  error:{name:'ERROR 검기',cooldown:27,color:'#7dff48'},
  glitch:{name:'MIRROR ERROR',cooldown:24,color:'#ff4be1'},
  zero:{name:'ZERO LINE',cooldown:30,color:'#f0f0f0'},
  deku:{name:'연막',cooldown:18,color:'#9dff78'}
});
const CANNON_SKILLS_2=Object.freeze({
  rocket:{name:'IRON DOME',cooldown:28,color:'#ffc06a',kind:'fortress'},
  titan:{name:'공성 변환',cooldown:31,color:'#ffd083',kind:'siege'},
  phantom:{name:'SPECTER CLOAK',cooldown:26,color:'#c9b8ff',kind:'cloak'},
  ring:{name:'RING PARRY',cooldown:22,color:'#e2caff',kind:'parry'},
  chrono:{name:'REWIND 4s',cooldown:28,color:'#a7e8ff',kind:'rewind'},
  void:{name:'ANTI-MATTER',cooldown:31,color:'#9a7cff',kind:'repulse'},
  nova:{name:'ORBITAL FIVE',cooldown:30,color:'#8fa8ff',kind:'starOrbit'},
  comet:{name:'METEOR SHOWER',cooldown:27,color:'#69e6ff',kind:'meteorShower'},
  stellar:{name:'SECOND STAR',cooldown:30,color:'#e6fbff',kind:'resurrection'},
  error:{name:'GLITCH DRIVE',cooldown:34,color:'#ff46dc',kind:'overclock'},
  glitch:{name:'DATA WARP',cooldown:30,color:'#ff50e7',kind:'dataWarp'},
  zero:{name:'ABSOLUTE ZERO',cooldown:30,color:'#ffffff',kind:'freeze'},
  deku:{name:'검은 채찍',cooldown:16,color:'#9dff78',kind:'blackwhip'}
});
const ERROR_T_SKILL=Object.freeze({name:'GLITCH BLADE',cooldown:7,color:'#73ff45'});
const DEKU_T_SKILL=Object.freeze({name:'발경',cooldown:20,color:'#baff70'});
const DEKU_Y_SKILL=Object.freeze({name:'변속',cooldown:32,color:'#e7ff76'});
const TANK_THEMES=Object.freeze({
  standard:{body:'#55a7ff',edge:'#2868ad',glow:'#68b8ff'},
  scout:{body:'#39bfe7',edge:'#19708b',glow:'#77ecff'},
  bastion:{body:'#7189a4',edge:'#394b60',glow:'#b2d3ed'},

  rapid:{body:'#62c985',edge:'#2e8050',glow:'#85f2a8'},
  dual:{body:'#45b991',edge:'#246b58',glow:'#76ffd1'},
  needle:{body:'#9bcc58',edge:'#5d7b2e',glow:'#c8ff79'},

  spread:{body:'#4fc9d6',edge:'#237784',glow:'#75eff8'},
  burst:{body:'#3eb1c0',edge:'#24636d',glow:'#6be9f5'},
  crystal:{body:'#77dce8',edge:'#3a8291',glow:'#c4fbff'},

  piercer:{body:'#9a71e8',edge:'#5d3e9a',glow:'#c39cff'},
  laser:{body:'#bc76e8',edge:'#70419d',glow:'#e4b3ff'},
  drill:{body:'#7654c8',edge:'#43317c',glow:'#a98dff'},

  plasma:{body:'#248fba',edge:'#12566f',glow:'#68f2ff'},
  thunder:{body:'#7396b3',edge:'#3d596c',glow:'#fff176'},
  inferno:{body:'#c84c35',edge:'#7b271d',glow:'#ff7850'},

  rocket:{body:'#c85c46',edge:'#793126',glow:'#ff9f52'},
  titan:{body:'#9b6652',edge:'#59382c',glow:'#ffc178'},
  phantom:{body:'#68599e',edge:'#3b315f',glow:'#c7b6ff'},

  ring:{body:'#8663d6',edge:'#4f348d',glow:'#c8aaff'},
  chrono:{body:'#527fc4',edge:'#304d7a',glow:'#a6e8ff'},
  void:{body:'#4c396f',edge:'#271d3a',glow:'#9b78ff'},

  nova:{body:'#4656a9',edge:'#26316e',glow:'#73ecff'},
  comet:{body:'#326f9f',edge:'#1d405f',glow:'#6de9ff'},
  stellar:{body:'#7182bb',edge:'#3c4a79',glow:'#e5fbff'},

  error:{body:'#151719',edge:'#70ff3f',glow:'#7cff45'},
  glitch:{body:'#19141e',edge:'#ff3edc',glow:'#ff64e7'},
  zero:{body:'#0b0b0d',edge:'#e8f3ff',glow:'#ffffff'},
  deku:{body:'#1f8257',edge:'#0c4435',glow:'#baff70'}
});

const statsDef=[['maxHealth','최대 체력'],['regen','체력 회복'],['bulletDamage','탄환 피해'],['bulletSpeed','탄환 속도'],['reload','연사 속도'],['moveSpeed','이동 속도']];
function defaultPlayer(){return{x:WORLD/2,y:WORLD/2,vx:0,vy:0,r:27,angle:0,hp:120,maxHp:120,regenTimer:0,level:1,xp:0,xpNeed:42,score:0,kills:0,points:0,fireCd:0,basicShotCount:0,name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',runId:'',skillCd:0,skillMax:0,skillReadyAt:0,skill2Cd:0,skill2Max:0,skill2ReadyAt:0,skill3Cd:0,skill3Max:0,skill3ReadyAt:0,skill4Cd:0,skill4Max:0,skill4ReadyAt:0,errorQCharging:false,errorQChargeStartAt:0,fortressUntil:0,overclockUntil:0,errorDashReadyAt:0,errorSwordMode:false,siegeUntil:0,stellarReviveUntil:0,stellarReviveReady:false,phantomMarkActive:false,phantomMarkUntil:0,phantomMarkOriginX:0,phantomMarkOriginY:0,phantomMarkDestX:0,phantomMarkDestY:0,cloakUntil:0,dekuSmokeUntil:0,dekuFaJinUntil:0,dekuGearshiftUntil:0,dekuWhipChainRemaining:0,dekuWhipChainUntil:0,stunUntil:0,swordSwingStartedAt:0,swordSwingUntil:0,swordSwingDir:1,swordSwingPower:0,phaseUntil:0,shapeContactCd:0,stats:{maxHealth:0,regen:0,bulletDamage:0,bulletSpeed:0,reload:0,moveSpeed:0}}}
function resize(){
  const mobileLike=innerWidth<900||matchMedia('(pointer:coarse)').matches;
  const dpr=Math.min(mobileLike?1.25:1.5,devicePixelRatio||1);
  canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);
  canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)
}addEventListener('resize',resize);resize();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy}function norm(dx,dy){const d=Math.hypot(dx,dy)||1;return[dx/d,dy/d]}
function colorForShape(t){return t==='square'?'#f7c843':t==='triangle'?'#e86464':'#6b8df2'}function edgeForShape(t){return t==='square'?'#b99320':t==='triangle'?'#a83f42':'#425cb2'}
function activeShapeSpawnAnchors(){
  const anchors=[];
  if(player?.alive&&Number.isFinite(player.x)&&Number.isFinite(player.y)){
    anchors.push({x:player.x,y:player.y,id:onlineSelfId||'local'});
  }
  for(const e of remotePlayers.values()){
    if(!e?.alive||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
    anchors.push({x:e.x,y:e.y,id:String(e.id||e.name||anchors.length)});
  }
  return anchors;
}
function randomGlobalShapePoint(){
  // 전역 스폰 중 일부는 외곽 벨트/코너에 의도적으로 배치한다.
  if(Math.random()<.42){
    const edgeDepth=1850;
    const side=Math.floor(Math.random()*4);
    if(side===0)return{x:rand(100,edgeDepth),y:rand(100,WORLD-100)};
    if(side===1)return{x:rand(WORLD-edgeDepth,WORLD-100),y:rand(100,WORLD-100)};
    if(side===2)return{x:rand(100,WORLD-100),y:rand(100,edgeDepth)};
    return{x:rand(100,WORLD-100),y:rand(WORLD-edgeDepth,WORLD-100)};
  }
  return{x:rand(100,WORLD-100),y:rand(100,WORLD-100)};
}
function localShapePoint(anchor){
  for(let attempt=0;attempt<18;attempt++){
    const a=rand(0,TAU);
    const d=rand(LOCAL_SHAPE_SPAWN_MIN_DISTANCE,LOCAL_SHAPE_SPAWN_MAX_DISTANCE);
    const x=anchor.x+Math.cos(a)*d,y=anchor.y+Math.sin(a)*d;
    if(x>=90&&x<=WORLD-90&&y>=90&&y<=WORLD-90)return{x,y};
  }

  // 모서리에서는 가능한 내부 방향이 적으므로 사각 범위 fallback.
  return{
    x:clamp(anchor.x+rand(-LOCAL_SHAPE_SPAWN_MAX_DISTANCE,LOCAL_SHAPE_SPAWN_MAX_DISTANCE),90,WORLD-90),
    y:clamp(anchor.y+rand(-LOCAL_SHAPE_SPAWN_MAX_DISTANCE,LOCAL_SHAPE_SPAWN_MAX_DISTANCE),90,WORLD-90)
  };
}
function chooseNormalSpawnPoint(preferLocal=true,forcedAnchor=null){
  if(forcedAnchor)return localShapePoint(forcedAnchor);

  const anchors=activeShapeSpawnAnchors();
  if(preferLocal&&anchors.length&&Math.random()<.78){
    const anchor=anchors[normalSpawnAnchorCursor++%anchors.length];
    return localShapePoint(anchor);
  }
  return randomGlobalShapePoint();
}
function spawnShape(type=null,preferLocal=true,forcedAnchor=null){
  const t=type||(Math.random()<.57?'square':Math.random()<.78?'triangle':'pentagon');
  const c=t==='square'?{r:20,hp:36,xp:12,sides:4}:t==='triangle'?{r:24,hp:58,xp:22,sides:3}:{r:34,hp:145,xp:56,sides:5};
  const pos=chooseNormalSpawnPoint(preferLocal,forcedAnchor);
  const shape={
    id:makeShapeId(),
    type:t,x:pos.x,y:pos.y,
    r:c.r,hp:c.hp,maxHp:c.hp,xp:c.xp,sides:c.sides,
    angle:rand(0,TAU),spin:rand(-.35,.35),vx:0,vy:0,
    spawnAge:0
  };
  shapes.push(shape);
  return shape;
}

function minDistanceToActiveAnchors(shape,anchors){
  let best=Infinity;
  for(const a of anchors){
    const d=Math.hypot(shape.x-a.x,shape.y-a.y);
    if(d<best)best=d;
  }
  return best;
}
function recycleFarNormalShape(anchor,anchors){
  let candidate=null,bestDistance=LOCAL_SHAPE_RECYCLE_DISTANCE;
  for(const s of shapes){
    const d=minDistanceToActiveAnchors(s,anchors);
    if(d>bestDistance){
      bestDistance=d;
      candidate=s;
    }
  }
  if(!candidate)return false;

  const pos=localShapePoint(anchor);
  const type=Math.random()<.57?'square':Math.random()<.78?'triangle':'pentagon';
  const c=type==='square'?{r:20,hp:36,xp:12,sides:4}:type==='triangle'?{r:24,hp:58,xp:22,sides:3}:{r:34,hp:145,xp:56,sides:5};

  candidate.type=type;
  candidate.x=pos.x;candidate.y=pos.y;
  candidate.r=c.r;candidate.hp=c.hp;candidate.maxHp=c.hp;candidate.xp=c.xp;candidate.sides=c.sides;
  candidate.angle=rand(0,TAU);candidate.spin=rand(-.35,.35);
  candidate.vx=0;candidate.vy=0;candidate.spawnAge=0;
  return true;
}
function ensureLocalShapeDensity(){
  const anchors=activeShapeSpawnAnchors();
  if(!anchors.length)return;

  let normalCount=shapes.length;

  const radius2=LOCAL_SHAPE_RADIUS*LOCAL_SHAPE_RADIUS;
  for(const anchor of anchors){
    let nearby=0;
    for(const s of shapes){
      const dx=s.x-anchor.x,dy=s.y-anchor.y;
      if(dx*dx+dy*dy<=radius2)nearby++;
    }

    let need=Math.min(LOCAL_REBALANCE_BATCH,Math.max(0,LOCAL_SHAPE_MIN-nearby));
    while(need-->0){
      // 우선 아무 플레이어에게도 보이지 않을 만큼 먼 도형을 재활용한다.
      if(recycleFarNormalShape(anchor,anchors))continue;

      // 재활용 대상이 없으면 hard cap까지 추가 스폰한다.
      if(normalCount<NORMAL_SHAPE_HARD_CAP){
        spawnShape(null,true,anchor);
        normalCount++;
      }else{
        break;
      }
    }
  }
}

function populate(){
  shapes=[];bullets=[];particles=[];combatFx=[];skillZones=[];playerHistory=[];
  normalSpawnTimer=0;
  localRebalanceTimer=0;
  normalSpawnAnchorCursor=0;

  // V5.44: 중앙 전용 오각형 군집 없음.
  // 삼각형/사각형/오각형 모두 동일한 일반 스폰 규칙을 사용한다.
  for(let i=0;i<INITIAL_NORMAL_SHAPES;i++)spawnShape(null,i%2===0);
}

function setNetworkStatus(state,text){
  if(ui.networkStatus){
    ui.networkStatus.className=`network-status ${state||''}`.trim();
    ui.networkStatus.innerHTML=`<span></span>${text||''}`;
  }
}
function updateOnlineCount(){
  if(!ui.onlineCount)return;
  let count=onlineReady?1:0;
  try{
    const presence=onlineChannel?.presenceState?.()||{};
    const ids=new Set();
    for(const entries of Object.values(presence)){
      for(const p of entries||[]){
        const id=String(p?.user_id||p?.presence_ref||'');
        if(id)ids.add(id);
      }
    }
    if(ids.size)count=ids.size;
  }catch(_){}
  ui.onlineCount.textContent=String(Math.max(0,count));
}
function safeRemoteNumber(v,fallback=0){
  v=Number(v);
  return Number.isFinite(v)?v:fallback;
}

function makeShapeId(){
  const owner=worldHostId||onlineSelfId||'local';
  return `${owner}:${Date.now().toString(36)}:${(++shapeSerial).toString(36)}`;
}
function getPresencePlayerIds(){
  const ids=new Set();
  if(onlineReady&&onlineSelfId)ids.add(onlineSelfId);
  try{
    const presence=onlineChannel?.presenceState?.()||{};
    for(const entries of Object.values(presence)){
      for(const p of entries||[]){
        const id=String(p?.user_id||p?.presence_ref||'');
        if(id)ids.add(id);
      }
    }
  }catch(_){}
  for(const id of remotePlayers.keys())if(id)ids.add(id);
  return [...ids].sort();
}
function refreshPresenceCache(){
  cachedPresenceIds.clear();
  for(const id of getPresencePlayerIds())cachedPresenceIds.add(id);
  if(onlineSelfId)cachedPresenceIds.add(onlineSelfId);
}

function isWorldHost(){
  if(!onlineReady)return true;
  return !worldHostId||worldHostId===onlineSelfId;
}
function electWorldHost(force=false){
  const ids=getPresencePlayerIds();
  const next=ids[0]||onlineSelfId||'';
  const changed=next!==worldHostId;
  worldHostId=next;
  if(changed||force){
    if(isWorldHost()){
      for(const s of shapes)if(!s.id)s.id=makeShapeId();
      lastWorldSnapshotSend=0;
      if(running)sendWorldSnapshot(true);
    }else if(running){
      sendOnline('worldRequest',{requesterId:onlineSelfId,hostId:worldHostId});
    }
  }
  return worldHostId;
}
function serializeShape(s){
  return {
    id:String(s.id||''),
    type:String(s.type||'square'),
    x:s.x,y:s.y,vx:s.vx||0,vy:s.vy||0,
    r:s.r,hp:s.hp,maxHp:s.maxHp,xp:s.xp,sides:s.sides,
    angle:s.angle,spin:s.spin,
    // V5.44 compatibility field: central clusters were removed.
    centralCluster:false,
    spawnAge:s.spawnAge||0
  };
}
function sendWorldSnapshot(force=false){
  if(!onlineReady||!running||!isWorldHost())return;
  const now=performance.now();
  if(!force&&now-lastWorldSnapshotSend<WORLD_SNAPSHOT_INTERVAL)return;
  lastWorldSnapshotSend=now;
  sendOnline('worldSnapshot',{
    hostId:onlineSelfId,
    seq:++worldSnapshotSeq,
    sentAt:Date.now(),
    worldSize:WORLD,
    shapes:shapes.map(serializeShape)
  });
}
function applyWorldSnapshot(payload){
  if(!payload||String(payload.hostId||'')===onlineSelfId)return;
  const hostId=String(payload.hostId||'');
  if(!hostId)return;
  if(worldHostId&&hostId!==worldHostId)return;
  if(!worldHostId)worldHostId=hostId;
  const incoming=Array.isArray(payload.shapes)?payload.shapes:[];
  const old=new Map(shapes.filter(s=>s?.id).map(s=>[String(s.id),s]));
  const next=[];
  for(const raw of incoming){
    const id=String(raw?.id||'');
    if(!id)continue;
    const s=old.get(id)||{};
    s.id=id;
    s.type=String(raw.type||s.type||'square');
    s.x=clamp(safeRemoteNumber(raw.x,s.x||WORLD/2),0,WORLD);
    s.y=clamp(safeRemoteNumber(raw.y,s.y||WORLD/2),0,WORLD);
    s.vx=safeRemoteNumber(raw.vx,0);s.vy=safeRemoteNumber(raw.vy,0);
    s.r=Math.max(8,safeRemoteNumber(raw.r,s.r||20));
    s.hp=Math.max(0,safeRemoteNumber(raw.hp,s.hp||1));
    s.maxHp=Math.max(1,safeRemoteNumber(raw.maxHp,s.maxHp||s.hp||1));
    s.xp=Math.max(0,safeRemoteNumber(raw.xp,s.xp||0));
    s.sides=Math.max(3,Math.floor(safeRemoteNumber(raw.sides,s.sides||4)));
    s.angle=safeRemoteNumber(raw.angle,s.angle||0);
    s.spin=safeRemoteNumber(raw.spin,s.spin||0);
    // Older clients may still send this field, but V5.44 never keeps a central cluster.
    s.centralCluster=false;
    s.spawnAge=Math.max(0,safeRemoteNumber(raw.spawnAge,s.spawnAge||0));
    next.push(s);
  }
  shapes=next;
  lastWorldSnapshotReceive=performance.now();
}
function reportShapeDamage(s,amount,pushX=0,pushY=0){
  if(!s||!Number.isFinite(Number(amount))||Number(amount)<=0)return;
  if(onlineReady&&!isWorldHost()&&s.id){
    sendOnline('shapeDamage',{
      hostId:worldHostId,shapeId:String(s.id),sourceId:onlineSelfId,
      amount:Math.max(0,Number(amount)||0),
      pushX:Number(pushX)||0,pushY:Number(pushY)||0
    });
  }
}
function applyShapeDamage(s,amount,pushX=0,pushY=0){
  if(!s)return false;
  amount=Math.max(0,Number(amount)||0);
  const before=Math.max(0,Number(s.hp)||0);
  if(amount<=0){
    s.hp=before;
    return s.hp<=0;
  }

  // V5.38: enemy HP can never become negative.
  s.hp=Math.max(0,before-amount);

  if(pushX)s.vx=(s.vx||0)+pushX;
  if(pushY)s.vy=(s.vy||0)+pushY;
  reportShapeDamage(s,Math.min(amount,before),pushX,pushY);
  return s.hp<=0;
}
function reportShapeImpulse(s,dvx,dvy){
  if(!s)return;
  s.vx=(s.vx||0)+(Number(dvx)||0);
  s.vy=(s.vy||0)+(Number(dvy)||0);
  if(onlineReady&&!isWorldHost()&&s.id){
    sendOnline('shapeImpulse',{
      hostId:worldHostId,shapeId:String(s.id),sourceId:onlineSelfId,
      dvx:Number(dvx)||0,dvy:Number(dvy)||0
    });
  }
}
function receiveShapeDamage(payload){
  if(!isWorldHost()||String(payload?.hostId||'')!==onlineSelfId)return;
  const id=String(payload?.shapeId||'');
  const s=shapes.find(v=>String(v?.id||'')===id);
  if(!s)return;
  const amount=Math.max(0,Math.min(100000,safeRemoteNumber(payload.amount,0)));
  if(amount<=0)return;
  s.hp=Math.max(0,(Number(s.hp)||0)-amount);
  s.vx+=(safeRemoteNumber(payload.pushX,0));
  s.vy+=(safeRemoteNumber(payload.pushY,0));
  if(s.hp<=0){
    const idx=shapes.indexOf(s);
    if(idx>=0)shapes.splice(idx,1);
  }
  lastWorldSnapshotSend=0;
}
function receiveShapeImpulse(payload){
  if(!isWorldHost()||String(payload?.hostId||'')!==onlineSelfId)return;
  const id=String(payload?.shapeId||'');
  const s=shapes.find(v=>String(v?.id||'')===id);
  if(!s)return;
  s.vx+=clamp(safeRemoteNumber(payload.dvx,0),-500,500);
  s.vy+=clamp(safeRemoteNumber(payload.dvy,0),-500,500);
  lastWorldSnapshotSend=0;
}
function maintainWorldSync(){
  if(!onlineReady||!running)return;
  if(!worldHostId)electWorldHost();
  if(isWorldHost()){
    sendWorldSnapshot(false);
  }else if(performance.now()-lastWorldSnapshotReceive>1800){
    sendOnline('worldRequest',{requesterId:onlineSelfId,hostId:worldHostId});
    lastWorldSnapshotReceive=performance.now()-1000;
  }
}
function upsertRemotePlayer(payload){
  const id=String(payload?.id||'');
  if(!id||id===onlineSelfId)return;
  let r=remotePlayers.get(id);
  if(!r){
    r={
      id,isRemote:true,x:safeRemoteNumber(payload.x,WORLD/2),y:safeRemoteNumber(payload.y,WORLD/2),
      tx:safeRemoteNumber(payload.x,WORLD/2),ty:safeRemoteNumber(payload.y,WORLD/2),
      angle:safeRemoteNumber(payload.angle,0),targetAngle:safeRemoteNumber(payload.angle,0),
      vx:0,vy:0,r:27,hp:120,maxHp:120,level:1,score:0,kills:0,
      name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',fortress:false,overclock:false,swordMode:false,cloaked:false,cloakUntilWall:0,dekuSmokeUntilWall:0,dekuFaJin:false,dekuGearshift:false,swordSwingStartedAt:0,swordSwingUntil:0,swordSwingDir:1,swordSwingPower:0,lastSeen:performance.now(),presenceMissingSince:0,lastStateSeq:0,lastStateWall:0
    };
    remotePlayers.set(id,r);
  }
  const incomingSeq=Math.max(0,Math.floor(safeRemoteNumber(payload.stateSeq,0)));
  const incomingWall=Math.max(0,safeRemoteNumber(payload.sentAt,0));

  // 새로고침/재접속하면 stateSeq가 다시 낮아질 수 있다.
  // 따라서 세션을 넘어서도 단조 증가하는 sentAt(Date.now)을 우선한다.
  if(incomingWall&&r.lastStateWall&&incomingWall<r.lastStateWall-250)return;
  if(!incomingWall&&incomingSeq&&r.lastStateSeq&&incomingSeq<r.lastStateSeq)return;

  if(incomingWall>=r.lastStateWall){
    r.lastStateWall=incomingWall;
    r.lastStateSeq=incomingSeq;
  }else if(!incomingWall&&incomingSeq){
    r.lastStateSeq=incomingSeq;
  }
  r.tx=clamp(safeRemoteNumber(payload.x,r.tx),0,WORLD);
  r.ty=clamp(safeRemoteNumber(payload.y,r.ty),0,WORLD);
  r.targetAngle=safeRemoteNumber(payload.angle,r.targetAngle);
  r.hp=Math.max(0,safeRemoteNumber(payload.hp,r.hp));
  r.maxHp=Math.max(1,safeRemoteNumber(payload.maxHp,r.maxHp));
  r.level=Math.max(1,Math.floor(safeRemoteNumber(payload.level,r.level)));
  r.score=Math.max(0,Math.floor(safeRemoteNumber(payload.score,r.score)));
  r.kills=Math.max(0,Math.floor(safeRemoteNumber(payload.kills,r.kills)));
  r.name=String(payload.name||r.name||'PLAYER').slice(0,14);
  r.cannonType=String(payload.cannonType||r.cannonType||'standard');
  r.classType=String(payload.classType||r.classType||'basic');
  r.fortress=payload.fortress===true;
  r.overclock=payload.overclock===true;
  r.swordMode=payload.swordMode===true;
  const incomingCloakUntil=Math.max(0,safeRemoteNumber(payload.cloakUntilWall,0));
  r.cloakUntilWall=incomingCloakUntil||(payload.cloaked===true?Date.now()+5500:0);
  r.cloaked=payload.cloaked===true&&Date.now()<r.cloakUntilWall;
  r.dekuSmokeUntilWall=Math.max(0,safeRemoteNumber(payload.dekuSmokeUntilWall,0));
  r.dekuFaJin=payload.dekuFaJin===true;r.dekuGearshift=payload.dekuGearshift===true;
  r.alive=payload.alive!==false;
  r.lastSeen=performance.now();
  r.presenceMissingSince=0;
  lastNetworkStateReceive=performance.now();
}
function angleLerp(a,b,t){
  let d=((b-a+Math.PI)%(TAU))-Math.PI;
  if(d<-Math.PI)d+=TAU;
  return a+d*t;
}
function updateRemotePlayers(dt){
  const now=performance.now();
  for(const [id,r] of remotePlayers){
    const age=now-(r.lastSeen||0);
    const isPresent=cachedPresenceIds.has(id);
    if(isPresent)r.presenceMissingSince=0;
    else if(!r.presenceMissingSince)r.presenceMissingSince=now;
    const absentFor=r.presenceMissingSince?now-r.presenceMissingSince:0;
    if(onlineReady&&age>REMOTE_PLAYER_STALE_MS&&!isPresent&&absentFor>REMOTE_PLAYER_ABSENT_GRACE_MS){remotePlayers.delete(id);continue}
    if(r.cloaked&&r.cloakUntilWall&&Date.now()>=r.cloakUntilWall){r.cloaked=false;r.cloakUntilWall=0}
    const smooth=age>3500?3.2:10,t=Math.min(1,dt*smooth);
    r.x+=(r.tx-r.x)*t;r.y+=(r.ty-r.y)*t;
    r.angle=angleLerp(r.angle,r.targetAngle,Math.min(1,dt*(age>3500?4.5:12)));
  }
}
function localNetworkState(){
  if(!player)return null;
  return {
    id:onlineSelfId,stateSeq:++localStateSeq,sentAt:Date.now(),
    x:player.x,y:player.y,angle:player.angle,
    hp:player.hp,maxHp:player.maxHp,
    level:player.level,score:player.score,kills:player.kills,
    name:player.name,cannonType:player.cannonType||'standard',
    classType:player.classType||'basic',alive:!!player.alive,
    fortress:performance.now()<(player.fortressUntil||0),
    overclock:performance.now()<(player.overclockUntil||0),
    cloaked:performance.now()<(player.cloakUntil||0),
    cloakUntilWall:performance.now()<(player.cloakUntil||0)?Date.now()+Math.max(0,(player.cloakUntil||0)-performance.now()):0,
    dekuSmokeUntilWall:performance.now()<(player.dekuSmokeUntil||0)?Date.now()+Math.max(0,(player.dekuSmokeUntil||0)-performance.now()):0,
    dekuFaJin:performance.now()<(player.dekuFaJinUntil||0),dekuGearshift:performance.now()<(player.dekuGearshiftUntil||0),
    swordMode:player.cannonType==='error'&&player.errorSwordMode===true
  };
}
function sendOnline(event,payload){
  if(!onlineReady||!onlineChannel)return;
  try{
    const result=onlineChannel.send({type:'broadcast',event,payload});
    if(result&&typeof result.catch==='function')void result.catch(()=>{});
  }catch(error){
    // Realtime disconnects or Supabase maintenance must never stop the local battle loop.
    console.warn('Realtime send skipped:',error);
  }
}
function broadcastLocalState(force=false){
  if(!onlineReady||!player)return;
  const now=performance.now();
  if(!force&&now-lastStateSend<REMOTE_STATE_INTERVAL)return;
  lastStateSend=now;
  const state=localNetworkState();
  if(state)sendOnline('state',state);
}
function broadcastShot(b){
  if(!b||!onlineReady)return;
  if(!b.netId)b.netId=`${onlineSelfId}:${++networkSerial}`;
  sendOnline('shot',{
    id:b.netId,netId:b.netId,
    ownerId:onlineSelfId,sentAt:Date.now(),
    x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,life:b.life,damage:b.damage||0,
    cannon:b.cannon,shape:b.shape,pierce:b.pierce||1,splashRadius:b.splashRadius||0,
    basicAttack:b.basicAttack===true,special:b.special||'',fragment:b.fragment===true,returned:b.returned===true,
    curve:Number(b.curve)||0,motionSeed:Number(b.motionSeed)||0,motionAge:Number(b.motionAge)||0
  });
}
function broadcastShotSync(b){
  if(!b||!onlineReady||b.networkRemote||!b.netId)return;
  sendOnline('shotSync',{
    netId:b.netId,ownerId:onlineSelfId,sentAt:Date.now(),
    x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,life:b.life,
    pierce:b.pierce||1,returned:b.returned===true,special:b.special||'',
    curve:Number(b.curve)||0,motionSeed:Number(b.motionSeed)||0,motionAge:Number(b.motionAge)||0
  });
}
function broadcastShotEnd(b){
  if(!b||!onlineReady||b.networkRemote||!b.netId)return;
  sendOnline('shotEnd',{netId:b.netId,ownerId:onlineSelfId});
}
function findNetworkBullet(ownerId,netId){
  return bullets.find(b=>b.networkRemote&&b.ownerId===String(ownerId||'')&&b.netId===String(netId||''));
}
function addRemoteShot(payload){
  if(!payload||String(payload.ownerId||'')===onlineSelfId)return;
  const vx=safeRemoteNumber(payload.vx),vy=safeRemoteNumber(payload.vy);
  const sentAt=safeRemoteNumber(payload.sentAt,Date.now());
  const age=clamp((Date.now()-sentAt)/1000,0,.45);
  const startX=safeRemoteNumber(payload.x),startY=safeRemoteNumber(payload.y);
  const shotAngle=fxAngleFromVector(vx,vy,safeRemoteNumber(payload.angle,0));
  const remoteCannon=String(payload.cannon||'standard');
  spawnAttackFx(remoteCannon,startX,startY,shotAngle,true);
  if(remoteCannon==='deku'&&String(payload.special||'').startsWith('faJin')){
    spawnCombatFx('dekuFaJinAttack',startX,startY,{angle:shotAngle,color:'#69f5ee',life:.38,radius:String(payload.special||'').includes('Detroit')?105:76,cannon:'deku',variant:'faJin'});
  }
  if(bullets.length>=MAX_BULLETS){
    const drop=bullets.findIndex(v=>v.networkRemote===true);
    if(drop>=0)bullets.splice(drop,1);
    else bullets.shift();
  }
  bullets.push({
    netId:String(payload.netId||payload.id||''),
    x:startX+vx*age,y:startY+vy*age,
    vx,vy,
    r:Math.max(2,safeRemoteNumber(payload.r,6)),
    damage:Math.max(0,safeRemoteNumber(payload.damage,0)),
    life:Math.max(.05,safeRemoteNumber(payload.life,1.3)-age),
    owner:null,ownerId:String(payload.ownerId||''),
    team:'remote',networkRemote:true,
    cannon:String(payload.cannon||'standard'),
    shape:String(payload.shape||'round'),
    pierce:Math.max(1,safeRemoteNumber(payload.pierce,1)),
    splashRadius:Math.max(0,safeRemoteNumber(payload.splashRadius,0)),
    basicAttack:payload.basicAttack===true,special:String(payload.special||''),fragment:payload.fragment===true,returned:payload.returned===true,
    curve:safeRemoteNumber(payload.curve,0),motionSeed:safeRemoteNumber(payload.motionSeed,0),motionAge:Math.max(0,safeRemoteNumber(payload.motionAge,0)+age),
    hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
  });
}
function receiveShotSync(payload){
  if(!payload||String(payload.ownerId||'')===onlineSelfId)return;
  const b=findNetworkBullet(payload.ownerId,payload.netId);
  if(!b)return;
  const vx=safeRemoteNumber(payload.vx,b.vx),vy=safeRemoteNumber(payload.vy,b.vy);
  const age=clamp((Date.now()-safeRemoteNumber(payload.sentAt,Date.now()))/1000,0,.35);
  b.x=safeRemoteNumber(payload.x,b.x)+vx*age;
  b.y=safeRemoteNumber(payload.y,b.y)+vy*age;
  b.vx=vx;b.vy=vy;
  b.r=Math.max(2,safeRemoteNumber(payload.r,b.r));
  b.life=Math.max(.03,safeRemoteNumber(payload.life,b.life)-age);
  b.pierce=Math.max(1,safeRemoteNumber(payload.pierce,b.pierce||1));
  b.returned=payload.returned===true;
  b.special=String(payload.special||b.special||'');
  b.curve=safeRemoteNumber(payload.curve,b.curve||0);
  b.motionSeed=safeRemoteNumber(payload.motionSeed,b.motionSeed||0);
  b.motionAge=Math.max(0,safeRemoteNumber(payload.motionAge,b.motionAge||0)+age);
}
function receiveShotEnd(payload){
  if(!payload||String(payload.ownerId||'')===onlineSelfId)return;
  const ownerId=String(payload.ownerId||''),netId=String(payload.netId||'');
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(b.networkRemote&&b.ownerId===ownerId&&b.netId===netId){
      bullets.splice(i,1);
      break;
    }
  }
}
function sendDamage(targetId,amount){
  if(!targetId||!onlineReady)return;
  const damage=Math.max(0,Math.min(5000,Number(amount)||0));
  if(damage<=0)return;
  sendOnline('damage',{
    id:`${onlineSelfId}:${Date.now()}:${++networkSerial}`,
    targetId:String(targetId),sourceId:onlineSelfId,
    amount:damage,sourceLevel:player?.level||1
  });
}
function sendStatus(targetId,type,durationMs){if(!targetId||!onlineReady)return;sendOnline('status',{id:`status:${onlineSelfId}:${Date.now()}:${++networkSerial}`,targetId:String(targetId),sourceId:onlineSelfId,type:String(type||''),durationMs:clamp(Number(durationMs)||0,0,5000)})}
function receiveStatus(payload){if(!running||!player?.alive||String(payload?.targetId||'')!==onlineSelfId)return;const d=clamp(Number(payload?.durationMs)||0,0,5000);if(String(payload?.type||'')==='stun'&&d>0){player.stunUntil=Math.max(player.stunUntil||0,performance.now()+d);player.vx=0;player.vy=0;input.firing=false;spawnCombatFx('dekuStun',player.x,player.y,{angle:0,color:'#a7ff70',life:d/1000,radius:55,cannon:'deku'})}}

function applyIncomingPlayerDamage(amount,sourceId='',eventId=''){
  if(!running||!player?.alive)return false;

  eventId=String(eventId||'');
  if(eventId&&processedDamageIds.has(eventId))return false;
  if(eventId){
    processedDamageIds.add(eventId);
    if(processedDamageIds.size>320){
      const first=processedDamageIds.values().next().value;
      processedDamageIds.delete(first);
    }
  }

  amount=Math.max(0,Math.min(5000,Number(amount)||0));
  if(amount<=0)return false;

  const now=performance.now();

  // 영구 무적 방지: 정상 phase는 최대 4초 수준이므로 비정상 미래값은 해제.
  if((player.phaseUntil||0)>now+5000)player.phaseUntil=0;
  if(now<(player.phaseUntil||0))return false;

  if(now<(player.fortressUntil||0))amount*=.30;

  const before=Math.max(0,Math.min(player.maxHp,Number(player.hp)||0));
  player.hp=Math.max(0,before-amount);
  player.regenTimer=0;

  if(player.hp<before){
    burst(player.x,player.y,'#ff8a8a',4);
    shake=Math.max(shake,4);
  }

  if(player.hp<=0&&!tryStellarRevive())killPlayer(String(sourceId||''));
  broadcastLocalState(true);
  return player.hp<before;
}
function receiveDamage(payload){
  if(String(payload?.targetId||'')!==onlineSelfId)return;
  applyIncomingPlayerDamage(payload?.amount,String(payload?.sourceId||''),String(payload?.id||''));
}
function tankKillXp(victimLevel){
  // 상대 탱크 레벨이 높을수록 EXP가 가파르게 증가한다.
  // 비정상 패킷으로 과도한 EXP를 얻지 못하도록 계산 레벨은 1~100으로 제한.
  const level=clamp(Math.floor(Number(victimLevel)||1),1,100);
  return Math.floor(50 + level*20 + level*level*.5);
}
function receiveKill(payload){
  if(!player?.alive)return;
  if(String(payload?.killerId||'')!==onlineSelfId)return;
  player.kills++;

  const victimLevel=clamp(Math.floor(Number(payload?.victimLevel||1)),1,100);
  const earnedXp=tankKillXp(victimLevel);
  gainXp(earnedXp);
}
function clearOnlineReconnectTimer(){
  if(onlineReconnectTimer){
    clearTimeout(onlineReconnectTimer);
    onlineReconnectTimer=0;
  }
}
function scheduleOnlineReconnect(reason='connection_lost'){
  if(!running||onlineReconnectBusy||onlineReconnectTimer)return;
  if(!window.IronCellAuth?.user)return;

  onlineReady=false;
  setNetworkStatus('connecting','온라인 연결 복구 중...');

  onlineReconnectTimer=setTimeout(async()=>{
    onlineReconnectTimer=0;
    if(!running||onlineReconnectBusy)return;

    onlineReconnectBusy=true;
    try{
      await disconnectOnlineArena(false);
      const ok=await connectOnlineArena(true);
      if(ok){
        broadcastLocalState(true);
        setNetworkStatus('online','온라인 서버 재연결됨');
      }else{
        setNetworkStatus('error','온라인 재연결 실패 · 다시 시도 중');
      }
    }catch(error){
      console.warn('Online reconnect failed:',reason,error);
    }finally{
      onlineReconnectBusy=false;
      if(running&&!onlineReady)scheduleOnlineReconnect('retry');
    }
  },1200);
}

async function disconnectOnlineArena(clearRemotes=true){
  if(!onlineReconnectBusy)clearOnlineReconnectTimer();
  onlineReady=false;
  updateOnlineCount();
  if(clearRemotes)remotePlayers.clear();
  cachedPresenceIds.clear();
  worldHostId='';lastWorldSnapshotReceive=0;lastWorldSnapshotSend=0;
  const ch=onlineChannel;
  onlineChannel=null;
  if(ch){
    try{await window.IronCellAuth?.client?.removeChannel(ch)}catch(_){}
  }
}
async function connectOnlineArena(preserveRemotes=false){
  if(onlineReady&&onlineChannel)return true;
  const client=window.IronCellAuth?.client;
  const user=window.IronCellAuth?.user;
  if(!client||!user){
    setNetworkStatus('error','로그인이 필요합니다');
    return false;
  }

  await disconnectOnlineArena(!preserveRemotes);
  onlineSelfId=String(user.id);
  setNetworkStatus('connecting','온라인 서버 연결 중...');
  if(!preserveRemotes)remotePlayers.clear();

  const ch=client.channel('iron-cell-arena-global-v1',{
    config:{
      broadcast:{self:false,ack:false},
      presence:{key:onlineSelfId}
    }
  });
  onlineChannel=ch;

  ch.on('broadcast',{event:'state'},({payload})=>upsertRemotePlayer(payload));
  ch.on('broadcast',{event:'shot'},({payload})=>addRemoteShot(payload));
  ch.on('broadcast',{event:'shotSync'},({payload})=>receiveShotSync(payload));
  ch.on('broadcast',{event:'shotEnd'},({payload})=>receiveShotEnd(payload));
  ch.on('broadcast',{event:'damage'},({payload})=>receiveDamage(payload));
  ch.on('broadcast',{event:'status'},({payload})=>receiveStatus(payload));
  ch.on('broadcast',{event:'kill'},({payload})=>receiveKill(payload));
  ch.on('broadcast',{event:'skill'},({payload})=>receiveRemoteSkill(payload));
  ch.on('broadcast',{event:'worldSnapshot'},({payload})=>applyWorldSnapshot(payload));
  ch.on('broadcast',{event:'worldRequest'},({payload})=>{
    if(isWorldHost()&&(!payload?.hostId||String(payload.hostId)===onlineSelfId))sendWorldSnapshot(true);
  });
  ch.on('broadcast',{event:'shapeDamage'},({payload})=>receiveShapeDamage(payload));
  ch.on('broadcast',{event:'shapeImpulse'},({payload})=>receiveShapeImpulse(payload));
  ch.on('presence',{event:'sync'},()=>{refreshPresenceCache();updateOnlineCount();electWorldHost()});
  ch.on('presence',{event:'join'},()=>{refreshPresenceCache();updateOnlineCount();setTimeout(()=>electWorldHost(),0)});
  ch.on('presence',{event:'leave'},({key})=>{
    if(key){
      const r=remotePlayers.get(String(key));
      if(r&&!r.presenceMissingSince)r.presenceMissingSince=performance.now();
    }
    refreshPresenceCache();
    updateOnlineCount();
    setTimeout(()=>electWorldHost(true),0);
  });

  return await new Promise(resolve=>{
    let settled=false;
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      setNetworkStatus('error','온라인 서버 연결 실패');
      resolve(false);
    },7000);

    ch.subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        clearTimeout(timer);
        onlineReady=true;
        clearOnlineReconnectTimer();
        try{
          await ch.track({
            user_id:onlineSelfId,
            username:window.IronCellAuth?.username||'PLAYER',
            joined_at:new Date().toISOString()
          });
        }catch(_){}
        refreshPresenceCache();
        updateOnlineCount();
        electWorldHost(true);
        setNetworkStatus('online','온라인 서버 연결됨');
        broadcastLocalState(true);
        if(!settled){
          settled=true;
          resolve(true);
        }
        return;
      }

      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        onlineReady=false;
        updateOnlineCount();
        if(!settled){
          settled=true;
          clearTimeout(timer);
          setNetworkStatus('error','온라인 서버 연결 실패');
          resolve(false);
        }else if(running){
          scheduleOnlineReconnect(status);
        }
      }
    });
  });
}

const xpNeed=l=>Math.round(40+l*18+l*l*2.2);
function gainXp(a){if(!player.alive)return;player.xp+=a;player.score+=Math.round(a*3);while(player.xp>=player.xpNeed){player.xp-=player.xpNeed;player.level++;player.points++;player.xpNeed=xpNeed(player.level);if(player.level===15&&!classUpgradeShown)showClassUpgrade()}updateUI()}
function updateUI(){ui.level.textContent=player.level;ui.score.textContent=player.score.toLocaleString();ui.xp.style.width=`${clamp(player.xp/player.xpNeed*100,0,100)}%`;ui.points.textContent=player.points;ui.upgradePanel.classList.toggle('has-points',player.points>0);renderUpgrades()}
function renderUpgrades(){ui.upgrades.innerHTML=statsDef.map(([k,l])=>{const n=player.stats[k]||0;return`<div class="stat"><span class="stat-name">${l}</span><span class="stat-bars">${Array.from({length:7},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</span><button type="button" data-stat="${k}" ${player.points<=0||n>=7?'disabled':''}>+</button></div>`}).join('');ui.upgrades.querySelectorAll('[data-stat]').forEach(b=>b.onclick=()=>upgrade(b.dataset.stat))}
function upgrade(k){if(player.points<=0||player.stats[k]>=7)return;player.points--;player.stats[k]++;if(k==='maxHealth'){const old=player.maxHp;player.maxHp=120+player.stats.maxHealth*18;player.hp+=player.maxHp-old}updateUI()}
function showClassUpgrade(){
  classUpgradeShown=true;paused=true;
  const cs=[{id:'assault',name:'돌격 튜닝',desc:'피해량과 이동 속도가 조금 증가합니다.'},{id:'precision',name:'정밀 튜닝',desc:'피해량과 탄속이 증가하지만 연사가 조금 느려집니다.'},{id:'overdrive',name:'과급 튜닝',desc:'연사력이 크게 증가하지만 탄환 피해가 조금 감소합니다.'}];
  ui.classChoices.innerHTML=cs.map(c=>`<button class="class-choice" data-class="${c.id}"><strong>${c.name}</strong><span>${c.desc}</span></button>`).join('');
  ui.classPanel.classList.remove('hidden');ui.classChoices.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{player.classType=b.dataset.class;ui.classPanel.classList.add('hidden');paused=false});
}
function playerParams(){
  const s=player.stats;
  let damage=17+s.bulletDamage*4,bulletSpeed=610+s.bulletSpeed*55,reload=.34-s.reload*.03,move=245+s.moveSpeed*15;
  if(player.classType==='assault'){damage*=1.15;move*=1.08}
  if(player.classType==='precision'){damage*=1.25;bulletSpeed*=1.15;reload*=1.10}
  if(player.classType==='overdrive'){damage*=.90;reload*=.78}

  const cannon=player.cannonType||'standard';

  if(cannon==='rapid'){damage*=.48;bulletSpeed*=1.06;reload*=.36}
  else if(cannon==='spread'){damage*=.50;bulletSpeed*=.90;reload*=1.30}
  else if(cannon==='piercer'){damage*=1.15;bulletSpeed*=1.42;reload*=1.48}
  else if(cannon==='plasma'){damage*=1.35;bulletSpeed*=.72;reload*=1.62}
  else if(cannon==='rocket'){damage*=2.15;bulletSpeed*=.60;reload*=2.20}
  else if(cannon==='ring'){damage*=.86;bulletSpeed*=1.05;reload*=1.15}
  else if(cannon==='nova'){damage*=1.20;bulletSpeed*=.92;reload*=1.42}
  else if(cannon==='error'){damage*=2.55;bulletSpeed*=1.60;reload*=1.75}

  else if(cannon==='scout'){damage*=.86;bulletSpeed*=1.22;reload*=.78;move*=1.12}
  else if(cannon==='bastion'){damage*=1.38;bulletSpeed*=.86;reload*=1.42;move*=.90}

  else if(cannon==='dual'){damage*=.52;bulletSpeed*=1.08;reload*=.52}
  else if(cannon==='needle'){damage*=.62;bulletSpeed*=1.35;reload*=.56;move*=1.05}

  else if(cannon==='burst'){damage*=.56;bulletSpeed*=.96;reload*=1.05}
  else if(cannon==='crystal'){damage*=.50;bulletSpeed*=1.02;reload*=1.17}

  else if(cannon==='laser'){damage*=1.08;bulletSpeed*=1.62;reload*=1.36}
  else if(cannon==='drill'){damage*=1.55;bulletSpeed*=1.16;reload*=1.78;move*=.94}

  else if(cannon==='thunder'){damage*=1.20;bulletSpeed*=.78;reload*=1.45}
  else if(cannon==='inferno'){damage*=1.68;bulletSpeed*=.68;reload*=1.72}

  else if(cannon==='titan'){damage*=2.48;bulletSpeed*=.55;reload*=2.42;move*=.84}
  else if(cannon==='phantom'){damage*=1.34;bulletSpeed*=1.66;reload*=1.25;move*=1.16}

  else if(cannon==='chrono'){damage*=.94;bulletSpeed*=1.14;reload*=1.06;move*=1.06}
  else if(cannon==='void'){damage*=1.36;bulletSpeed*=.86;reload*=1.50}

  else if(cannon==='comet'){damage*=1.16;bulletSpeed*=1.26;reload*=1.16;move*=1.10}
  else if(cannon==='stellar'){damage*=1.36;bulletSpeed*=.91;reload*=1.52}

  else if(cannon==='glitch'){damage*=2.10;bulletSpeed*=1.52;reload*=1.38;move*=1.05}
  else if(cannon==='zero'){damage*=3.05;bulletSpeed*=1.16;reload*=2.05;move*=.93}
  else if(cannon==='deku'){damage*=1.72;bulletSpeed*=1.34;reload*=.88;move*=1.18}

  const now=performance.now();
  if(now<(player.fortressUntil||0)){move*=.70}
  if(now<(player.overclockUntil||0)){move*=1.85}
  if(now<(player.siegeUntil||0)){damage*=1.55;reload*=.48;bulletSpeed*=1.12;move*=.34}
  if(cannon==='deku'){
    if(now<(player.dekuFaJinUntil||0))move*=1.95;
    if(now<(player.dekuGearshiftUntil||0)){damage*=1.25;bulletSpeed*=1.62;reload*=.44;move*=1.35}
  }else{
    // V5.47: 캐릭터 변경/상태 잔존으로 스카우트 등에 데쿠 버프가 넘어가는 것을 차단.
    player.dekuFaJinUntil=0;
    player.dekuGearshiftUntil=0;
    player.dekuSmokeUntil=0;
    player.dekuWhipChainRemaining=0;
    player.dekuWhipChainUntil=0;
    player.skill4Cd=0;
    player.skill4ReadyAt=0;
  }
  if(now<(player.stunUntil||0))move=0;

  return{damage,bulletSpeed,reload:Math.max(.05,reload),move};
}

function normalizeFxAngle(angle){
  const a=Number(angle);
  if(!Number.isFinite(a))return 0;
  return Math.atan2(Math.sin(a),Math.cos(a));
}
function fxAngleFromVector(vx,vy,fallback=0){
  vx=Number(vx)||0;vy=Number(vy)||0;
  return Math.hypot(vx,vy)>.001?Math.atan2(vy,vx):normalizeFxAngle(fallback);
}
function fxAngleToTarget(x,y,tx,ty,fallback=0){
  const dx=(Number(tx)||0)-(Number(x)||0),dy=(Number(ty)||0)-(Number(y)||0);
  return Math.hypot(dx,dy)>.001?Math.atan2(dy,dx):normalizeFxAngle(fallback);
}
function spawnCombatFx(type,x,y,opts={}){
  if(combatFx.length>=MAX_COMBAT_FX){
    combatFx.splice(0,Math.max(1,combatFx.length-MAX_COMBAT_FX+1));
  }
  combatFx.push({
    type,x,y,angle:normalizeFxAngle(opts.angle),color:opts.color||'#fff',
    life:opts.life||.35,maxLife:opts.life||.35,
    radius:opts.radius||38,size:opts.size||1,
    ownerId:opts.ownerId||'',cannon:opts.cannon||'',variant:opts.variant||''
  });
}
function spawnAttackFx(cannon,x,y,angle,remote=false){
  const types={
    standard:['muzzle','#70bdff',.18,25],
    rapid:['rapid','#83f5a8',.12,18],
    spread:['spread','#6ff4ff',.20,33],
    piercer:['rail','#c6a8ff',.22,58],
    plasma:['plasmaMuzzle','#6ff3ff',.30,42],
    rocket:['rocketMuzzle','#ff9b4a',.35,48],
    ring:['ringMuzzle','#c6a3ff',.28,42],
    nova:['novaMuzzle','#75efff',.34,52],
    error:['errorMuzzle','#76ff43',.32,55],
    deku:['dekuMuzzle','#baff70',.24,58]
  };
  const f=types[cannonFamily(cannon)]||types.standard;
  let fxAngle=normalizeFxAngle(angle);

  // V5.47: 예외 없이 +X 방향 = 실제 공격 진행 방향.
  // 로켓도 사용자가 보는 공격 이펙트 방향을 탄환 방향과 동일하게 맞춘다.
  spawnCombatFx(f[0],x,y,{angle:fxAngle,color:f[1],life:f[2],radius:f[3],cannon});
}
function receiveRemoteSkill(payload){
  if(!payload||String(payload.ownerId||'')===onlineSelfId)return;
  const cannon=String(payload.cannon||'');
  const x=safeRemoteNumber(payload.x),y=safeRemoteNumber(payload.y);
  const angle=safeRemoteNumber(payload.angle);
  const slot=Math.floor(safeRemoteNumber(payload.slot,1));
  const packetTargetX=safeRemoteNumber(payload.targetX,x);
  const packetTargetY=safeRemoteNumber(payload.targetY,y);
  const travelAngle=fxAngleToTarget(x,y,packetTargetX,packetTargetY,angle);

  const skillType=String(payload.skillType||'');
  if(skillType){
    const tx=safeRemoteNumber(payload.targetX,x),ty=safeRemoteNumber(payload.targetY,y);
    const radius=Math.max(20,safeRemoteNumber(payload.radius,180));
    const life=Math.max(.2,safeRemoteNumber(payload.life,2));
    if(cannon==='deku'){
      if(skillType==='dekuSmoke'){skillZones.push({type:'dekuSmoke',x:tx,y:ty,radius,life,maxLife:life,damage:0,tick:0,angle:0,length:0,width:0,ownerId:String(payload.ownerId||''),networkRemote:true,pulses:0,interval:.4,data:{}});return}
      if(skillType==='dekuBlackwhip'){
        const whipAngle=fxAngleToTarget(x,y,tx,ty,safeRemoteNumber(payload.zoneAngle,angle));
        spawnCombatFx('dekuBlackwhip',x,y,{angle:whipAngle,color:'#52e7ea',life:1.25,radius:safeRemoteNumber(payload.length,760),cannon:'deku',variant:payload.faJinBoost===true?'faJin':''});
        if(payload.recoilDash===true){
          const dashX=safeRemoteNumber(payload.dashX,x),dashY=safeRemoteNumber(payload.dashY,y),dashLength=Math.hypot(dashX-x,dashY-y);
          spawnCombatFx('dekuWhipElasticDash',x,y,{angle:fxAngleToTarget(x,y,dashX,dashY,whipAngle),color:'#5cf6e8',life:.52,radius:dashLength,cannon:'deku',variant:payload.faJinBoost===true?'faJin':''});
          const remote=remotePlayers.get(String(payload.ownerId||''));if(remote){remote.x=remote.tx=dashX;remote.y=remote.ty=dashY}
        }
        return
      }
      if(skillType==='dekuFaJin'){spawnCombatFx('dekuFaJin',x,y,{angle,color:'#baff70',life:1.35,radius:185,cannon:'deku'});return}
      if(skillType==='dekuGearshift'){spawnCombatFx('dekuGearshift',x,y,{angle,color:'#80efff',life:1.55,radius:220,cannon:'deku'});return}
    }
    if(cannon==='phantom'&&skillType==='phantomMarks'){
      const ox=safeRemoteNumber(payload.originX,x),oy=safeRemoteNumber(payload.originY,y),dx=safeRemoteNumber(payload.destX,tx),dy=safeRemoteNumber(payload.destY,ty),ownerId=String(payload.ownerId||'');
      skillZones.push({type:'phantomAssassinMark',x:ox,y:oy,radius,life,maxLife:life,damage:0,tick:0,angle:0,length:0,width:0,ownerId,networkRemote:true,pulses:0,interval:.4,data:{mark:'origin'}});
      skillZones.push({type:'phantomAssassinMark',x:dx,y:dy,radius,life,maxLife:life,damage:0,tick:0,angle:0,length:0,width:0,ownerId,networkRemote:true,pulses:0,interval:.4,data:{mark:'destination'}});
      const remote=remotePlayers.get(ownerId);if(remote){remote.x=remote.tx=dx;remote.y=remote.ty=dy}
      spawnCombatFx('phantomTeleportTrace',ox,oy,{angle:Math.atan2(dy-oy,dx-ox),color:'#cabdff',life:.55,radius:Math.hypot(dx-ox,dy-oy),cannon:'phantom'});return;
    }
    if(cannon==='phantom'&&skillType==='phantomMarkDetonate'){
      const ox=safeRemoteNumber(payload.originX,x),oy=safeRemoteNumber(payload.originY,y),dx=safeRemoteNumber(payload.destX,tx),dy=safeRemoteNumber(payload.destY,ty),ownerId=String(payload.ownerId||'');
      for(let j=skillZones.length-1;j>=0;j--)if(skillZones[j].networkRemote&&skillZones[j].ownerId===ownerId&&skillZones[j].type==='phantomAssassinMark')skillZones.splice(j,1);
      spawnCombatFx('phantomMarkBurst',ox,oy,{angle:0,color:'#cabdff',life:.72,radius:190,cannon:'phantom'});spawnCombatFx('phantomMarkBurst',dx,dy,{angle:0,color:'#cabdff',life:.72,radius:190,cannon:'phantom'});
      const remote=remotePlayers.get(ownerId);if(remote){remote.x=remote.tx=ox;remote.y=remote.ty=oy}return;
    }
    const zoneTypes=new Set(['artillery','barrier','rapidOverdrive','twinDrones','burstBomb','crystalPrism','laserSweep','plasmaCage','thunderStorm','flameWall','missileRain','earthFissure','ringGate','timeField','gravity','supernovaCore','cometTrail','constellation','secondStar','starOrbit','absoluteZero','ironDome','siegeAura','ringParry','rewindEcho','antiMatter','cometShower','glitchDriveAura','glitchWarpTrail']);
    if(zoneTypes.has(skillType)){
      skillZones.push({type:skillType,x:tx,y:ty,radius,life,maxLife:life,damage:0,tick:0,angle:fxAngleToTarget(x,y,tx,ty,safeRemoteNumber(payload.zoneAngle,angle)),length:safeRemoteNumber(payload.length,0),width:safeRemoteNumber(payload.width,0),ownerId:String(payload.ownerId||''),networkRemote:true,pulses:0,interval:.4,data:{}});
    }else{
      spawnCombatFx('uniqueSkill',tx,ty,{angle:travelAngle,color:CANNON_SKILLS[cannon]?.color||'#fff',life:.85,radius:Math.max(90,radius),cannon});
    }
    return;
  }

  if(slot===3&&cannon==='error'){
    const tx=safeRemoteNumber(payload.targetX,x),ty=safeRemoteNumber(payload.targetY,y);
    const mode=String(payload.mode||'toggle');
    const remote=remotePlayers.get(String(payload.ownerId||''));
    const swingDir=safeRemoteNumber(payload.swingDir,0);

    if(mode==='basicSwing'){
      spawnCombatFx('errorSwordSwing',x,y,{angle:remote?.targetAngle??remote?.angle??angle,color:'#72ff43',life:.38,radius:182,cannon:'error'});
      if(remote)triggerErrorSwordSwing(remote,1,.34,swingDir);
    }else{
      const dashAngle=fxAngleToTarget(x,y,tx,ty,angle);
      spawnCombatFx('errorSwordDash',x,y,{angle:dashAngle,color:'#72ff43',life:.55,radius:Math.hypot(tx-x,ty-y)||360,cannon:'error'});
      spawnCombatFx('errorSwordSwing',tx,ty,{angle:dashAngle,color:'#72ff43',life:.50,radius:242,cannon:'error'});
      if(remote)triggerErrorSwordSwing(remote,1.35,.46,swingDir);
    }
    if(remote)remote.swordMode=payload.swordMode===true;
    return;
  }

  if(slot===2){
    const def=CANNON_SKILLS_2[cannon];
    if(!def)return;

    if(['rocket','titan','stellar'].includes(cannon)){
      spawnCombatFx('skill2-rocket',x,y,{angle,color:def.color,life:1.1,radius:cannon==='titan'?145:115,cannon});
    }else if(['ring','phantom','chrono','comet','zero'].includes(cannon)){
      const tx=safeRemoteNumber(payload.targetX,x),ty=safeRemoteNumber(payload.targetY,y);
      spawnCombatFx('skill2-ring',x,y,{angle,color:def.color,life:.85,radius:100,cannon});
      spawnCombatFx('skill2-ring',tx,ty,{angle,color:def.color,life:.85,radius:100,cannon});
    }else if(['nova','void'].includes(cannon)){
      const tx=safeRemoteNumber(payload.targetX,x),ty=safeRemoteNumber(payload.targetY,y);
      skillZones.push({
        type:'gravity',x:tx,y:ty,
        radius:safeRemoteNumber(payload.radius,cannon==='void'?400:330),
        life:safeRemoteNumber(payload.life,cannon==='void'?6:5.5),
        maxLife:safeRemoteNumber(payload.life,cannon==='void'?6:5.5),
        damage:0,tick:0,ownerId:String(payload.ownerId||''),networkRemote:true
      });
    }else if(cannon==='error'){
      if(String(payload.mode||'')==='dash'){
        const tx=safeRemoteNumber(payload.targetX,x),ty=safeRemoteNumber(payload.targetY,y);
        const dashAngle=fxAngleToTarget(x,y,tx,ty,angle);
        spawnCombatFx('skill2-error',x,y,{angle:dashAngle,color:def.color,life:.60,radius:92,cannon});
        spawnCombatFx('skill2-error',tx,ty,{angle:dashAngle,color:def.color,life:.72,radius:108,cannon});
        for(let i=1;i<=5;i++){
          const k=i/6;
          spawnCombatFx('errorDashTrace',x+(tx-x)*k,y+(ty-y)*k,{angle:dashAngle,color:def.color,life:.34+i*.025,radius:48,cannon});
        }
      }else{
        spawnCombatFx('skill2-error',x,y,{angle,color:def.color,life:1.0,radius:135,cannon});
      }
    }else if(cannon==='glitch'){
      spawnCombatFx('skill2-error',x,y,{angle,color:def.color,life:1.0,radius:150,cannon});
    }
    return;
  }

  const color=CANNON_SKILLS[cannon]?.color||'#fff';
  const errorMode=String(payload.mode||'');
  spawnCombatFx(
    cannon==='error'?(errorMode==='sword'?'errorSwordCast':'skill-error'):`skill-${cannon}`,
    x,y,{angle:travelAngle,color,life:1.15,radius:cannon==='nova'?390:190,cannon}
  );
}
function skillProjectile(cannon,angle,opts={}){
  const p=playerParams(),family=cannonFamily(cannon);
  const speed=p.bulletSpeed*(opts.speedMul||1);
  const b={
    x:player.x+Math.cos(angle)*(player.r+20),y:player.y+Math.sin(angle)*(player.r+20),
    vx:Math.cos(angle)*speed+player.vx*.10,vy:Math.sin(angle)*speed+player.vy*.10,
    r:6,damage:p.damage*(opts.damageMul||1),life:opts.life||1.8,
    owner:player,ownerId:onlineSelfId,team:'player',cannon,shape:'round',
    pierce:opts.pierce||1,splashRadius:opts.splashRadius||0,
    hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
  };

  if(family==='standard'){b.r=opts.r||9;b.shape='round';b.pierce=opts.pierce||2;b.life=opts.life||2.0}
  else if(family==='rapid'){b.r=opts.r||4;b.shape='capsule';b.pierce=opts.pierce||1;b.life=opts.life||1.5}
  else if(family==='spread'){b.r=opts.r||4;b.shape='pellet';b.pierce=opts.pierce||1;b.life=opts.life||1.2}
  else if(family==='piercer'){b.r=opts.r||7;b.shape='rail';b.pierce=opts.pierce||10;b.life=opts.life||2.2}
  else if(family==='plasma'){b.r=opts.r||13;b.shape='plasma';b.splashRadius=opts.splashRadius||76;b.life=opts.life||3.0}
  else if(family==='rocket'){b.r=opts.r||8;b.shape='rocket';b.splashRadius=opts.splashRadius||118;b.life=opts.life||2.4}
  else if(family==='ring'){b.r=opts.r||12;b.shape='ring';b.pierce=opts.pierce||10;b.life=opts.life||2.1}
  else if(family==='nova'){b.r=opts.r||10;b.shape='nova';b.pierce=opts.pierce||4;b.splashRadius=opts.splashRadius||60;b.life=opts.life||2.1}
  else if(family==='error'){b.r=opts.r||9;b.shape='error';b.pierce=opts.pierce||14;b.splashRadius=opts.splashRadius||0;b.life=opts.life||2.2}

  b.shape=opts.shape||projectileShapeForCannon(cannon);
  if(opts.r)b.r=opts.r;
  if(opts.pierce)b.pierce=opts.pierce;
  if(opts.splashRadius!==undefined)b.splashRadius=opts.splashRadius;
  if(opts.special)b.special=opts.special;

  bullets.push(b);broadcastShot(b);
  return b;
}
function skillAreaDamage(x,y,radius,damage,color){
  const r2=radius*radius;
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    const scale=.35+.65*(1-Math.sqrt(d2)/radius);
    applyShapeDamage(s,damage*scale);
    burst(s.x,s.y,color,4);
    if(s.hp<=0){
      gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),11);shapes.splice(i,1);
    }
  }
  for(const enemy of remotePlayers.values()){
    if(!enemy.alive)continue;
    const dx=enemy.x-x,dy=enemy.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    const scale=.35+.65*(1-Math.sqrt(d2)/radius);
    sendDamage(enemy.id,damage*scale);
  }
}
function refreshRealTimeSkillCooldowns(){
  if(!player)return;
  const now=Date.now();
  const perfNow=performance.now();
  if((player.dekuWhipChainUntil||0)>0&&perfNow>=(player.dekuWhipChainUntil||0)){
    player.dekuWhipChainRemaining=0;
    player.dekuWhipChainUntil=0;
  }

  if(player.skillReadyAt){
    player.skillCd=Math.max(0,(player.skillReadyAt-now)/1000);
    if(player.skillCd<=0){player.skillCd=0;player.skillReadyAt=0}
  }else{
    player.skillCd=0;
  }

  if(player.skill2ReadyAt){
    player.skill2Cd=Math.max(0,(player.skill2ReadyAt-now)/1000);
    if(player.skill2Cd<=0){player.skill2Cd=0;player.skill2ReadyAt=0}
  }else{
    player.skill2Cd=0;
  }

  if(player.skill3ReadyAt){
    player.skill3Cd=Math.max(0,(player.skill3ReadyAt-now)/1000);
    if(player.skill3Cd<=0){player.skill3Cd=0;player.skill3ReadyAt=0}
  }else{player.skill3Cd=0}
  if(player.skill4ReadyAt){
    player.skill4Cd=Math.max(0,(player.skill4ReadyAt-now)/1000);
    if(player.skill4Cd<=0){player.skill4Cd=0;player.skill4ReadyAt=0}
  }else{player.skill4Cd=0}
}

function setFourthSkillVisible(visible){
  if(!ui.skill4Btn)return;
  const show=visible===true;
  ui.skill4Btn.hidden=!show;
  ui.skill4Btn.disabled=!show;
  ui.skill4Btn.classList.toggle('hidden',!show);
  if(show)ui.skill4Btn.style.removeProperty('display');
  else ui.skill4Btn.style.display='none';
}
function updateSkillHud(){
  refreshRealTimeSkillCooldowns();
  const cannon=player?.cannonType||'';
  const def=CANNON_SKILLS[cannon];
  const def2=CANNON_SKILLS_2[cannon];
  const visible=!!(running&&player?.alive&&def);
  ui.skillHud?.classList.toggle('hidden',!visible);
  if(!visible)return;

  const cd=Math.max(0,player.skillCd||0);
  const max=Math.max(.01,player.skillMax||def.cooldown);
  const phantomReturn=cannon==='phantom'&&phantomMarkCanReturn();
  const ready=cd<=.001||phantomReturn;
  const errorCharging=cannon==='error'&&player.errorQCharging===true;
  const chargeSec=errorCharging?clamp((Date.now()-(player.errorQChargeStartAt||Date.now()))/1000,0,5):0;

  if(ui.skillName){
    ui.skillName.textContent=errorCharging
      ? 'ERROR 검기 · CHARGE'
      : (phantomReturn?'암살 표식 · RETURN':(cannon==='error'?(player.errorSwordMode?'ERROR 검기':'SYSTEM CRASH'):def.name));
  }
  if(ui.skillCooldown){
    const phantomLeft=phantomReturn?Math.max(0,((player.phantomMarkUntil||0)-performance.now())/1000):0;
    ui.skillCooldown.textContent=errorCharging
      ? `차징 ${chargeSec.toFixed(1)} / 5.0s`
      : (phantomReturn?`귀환 ${phantomLeft.toFixed(1)}s`:(ready?'READY':`${cd.toFixed(1)}s`));
  }
  if(ui.skillFill){
    ui.skillFill.style.width=errorCharging
      ? `${clamp(chargeSec/5*100,0,100)}%`
      : (phantomReturn?`${clamp(phantomLeft/5*100,0,100)}%`:`${clamp((1-cd/max)*100,0,100)}%`);
  }
  if(ui.skillBtn){
    ui.skillBtn.disabled=errorCharging?false:!ready;
    ui.skillBtn.className=`skill-button cannon-${cannon} ${errorCharging?'charging':(ready?'ready':'cooling')}`;
  }

  const showSecond=!!def2;
  ui.skill2Btn?.classList.toggle('hidden',!showSecond);
  if(showSecond){
    const nowPerf=performance.now();
    const errorBoostActive=cannon==='error'&&nowPerf<(player.overclockUntil||0);

    if(errorBoostActive){
      const buffLeft=Math.max(0,((player.overclockUntil||0)-nowPerf)/1000);
      const dashCd=Math.max(0,((player.errorDashReadyAt||0)-Date.now())/1000);
      const dashReady=dashCd<=.001;

      if(ui.skill2Name)ui.skill2Name.textContent='OVERCLOCK · DASH';
      if(ui.skill2Cooldown){
        ui.skill2Cooldown.textContent=dashReady
          ? `버프 ${buffLeft.toFixed(1)}s · 도약 READY`
          : `버프 ${buffLeft.toFixed(1)}s · 도약 ${dashCd.toFixed(1)}s`;
      }
      if(ui.skill2Fill)ui.skill2Fill.style.width=`${clamp((1-dashCd/3)*100,0,100)}%`;
      if(ui.skill2Btn){
        ui.skill2Btn.disabled=!dashReady;
        ui.skill2Btn.className=`skill-button skill2-button cannon-error ${dashReady?'ready':'cooling'}`;
      }
    }else{
      const cd2=Math.max(0,player.skill2Cd||0);
      const max2=Math.max(.01,player.skill2Max||def2.cooldown);
      const whipChainActive=cannon==='deku'&&(player.dekuWhipChainRemaining||0)>0&&nowPerf<(player.dekuWhipChainUntil||0);
      const ready2=cd2<=.001||whipChainActive;
      if(ui.skill2Name)ui.skill2Name.textContent=cannon==='deku'?'검은 채찍':def2.name;
      if(ui.skill2Cooldown){
        ui.skill2Cooldown.textContent=whipChainActive
          ? `연속 ${player.dekuWhipChainRemaining}회 · READY`
          : (ready2?'READY':`${cd2.toFixed(1)}s`);
      }
      if(ui.skill2Fill)ui.skill2Fill.style.width=whipChainActive?'100%':`${clamp((1-cd2/max2)*100,0,100)}%`;
      if(ui.skill2Btn){
        ui.skill2Btn.disabled=!ready2;
        ui.skill2Btn.className=`skill-button skill2-button cannon-${cannon} ${ready2?'ready':'cooling'}`;
      }
    }
  }

  const showThird=cannon==='error'||cannon==='deku';ui.skill3Btn?.classList.toggle('hidden',!showThird);
  if(showThird){const cd3=Math.max(0,player.skill3Cd||0),ready3=cd3<=.001,def3=cannon==='deku'?DEKU_T_SKILL:ERROR_T_SKILL;if(ui.skill3Name)ui.skill3Name.textContent=cannon==='deku'?'발경':(player.errorSwordMode?'검 모드 ON':'GLITCH BLADE');if(ui.skill3Cooldown)ui.skill3Cooldown.textContent=ready3?(cannon==='deku'?'T · READY':(player.errorSwordMode?'T · 검 모드 해제':'T · 검 모드 전환')):`${cd3.toFixed(1)}s`;if(ui.skill3Fill)ui.skill3Fill.style.width=`${clamp((1-cd3/def3.cooldown)*100,0,100)}%`;if(ui.skill3Btn){ui.skill3Btn.disabled=!ready3;ui.skill3Btn.className=`skill-button skill3-button cannon-${cannon} ${cannon==='error'&&player.errorSwordMode?'sword-on ':''}${ready3?'ready':'cooling'}`}}
  const showFourth=cannon==='deku';setFourthSkillVisible(showFourth);
  if(showFourth){
    const cd4=Math.max(0,player.skill4Cd||0),ready4=cd4<=.001;
    if(ui.skill4Name)ui.skill4Name.textContent='변속';
    if(ui.skill4Cooldown)ui.skill4Cooldown.textContent=ready4?'Y · READY':`${cd4.toFixed(1)}s`;
    if(ui.skill4Fill)ui.skill4Fill.style.width=`${clamp((1-cd4/DEKU_Y_SKILL.cooldown)*100,0,100)}%`;
    if(ui.skill4Btn){ui.skill4Btn.disabled=!ready4;ui.skill4Btn.className=`skill-button skill4-button cannon-deku ${ready4?'ready':'cooling'}`;ui.skill4Btn.hidden=false;ui.skill4Btn.style.removeProperty('display')}
  }else{
    player.dekuGearshiftUntil=0;player.skill4Cd=0;player.skill4ReadyAt=0;
    if(ui.skill4Name)ui.skill4Name.textContent='';
    if(ui.skill4Cooldown)ui.skill4Cooldown.textContent='';
    if(ui.skill4Fill)ui.skill4Fill.style.width='0%';
    setFourthSkillVisible(false);
  }
}

function angleDifference(a,b){
  let d=(a-b+Math.PI)%TAU-Math.PI;
  if(d<-Math.PI)d+=TAU;
  return d;
}

function triggerErrorSwordSwing(entity,power=1,duration=.32,forcedDir=0){
  if(!entity)return 1;
  const now=performance.now();
  let dir=Number(forcedDir)||0;
  if(!dir){
    dir=(entity.swordSwingDir||1)*-1;
  }
  dir=dir<0?-1:1;
  entity.swordSwingDir=dir;
  entity.swordSwingStartedAt=now;
  entity.swordSwingUntil=now+Math.max(.18,Number(duration)||.32)*1000;
  entity.swordSwingPower=Math.max(.5,Number(power)||1);
  return dir;
}
function getErrorSwordSwingPose(entity){
  const now=performance.now();
  const start=Number(entity?.swordSwingStartedAt)||0;
  const end=Number(entity?.swordSwingUntil)||0;
  const dir=(Number(entity?.swordSwingDir)||1)<0?-1:1;
  const power=Math.max(.5,Number(entity?.swordSwingPower)||1);

  if(start>0&&end>start&&now<end){
    const u=clamp((now-start)/(end-start),0,1);
    // Fast opening, strong follow-through and a small settle at the end.
    const eased=u<.72
      ? 1-Math.pow(1-u/.72,3)
      : 1-.07*Math.sin((u-.72)/.28*Math.PI);
    const amplitude=1.18+Math.min(.34,(power-1)*.42);
    const from=-amplitude*dir;
    const to=amplitude*dir;
    return {
      active:true,
      angle:from+(to-from)*eased,
      scale:1+.10*Math.sin(Math.PI*u)*Math.min(1.4,power),
      progress:u,
      dir,
      power
    };
  }

  return {
    active:false,
    angle:-.10+Math.sin(performance.now()*.004)*.035,
    scale:1,
    progress:1,
    dir,
    power:1
  };
}

function errorSwordArcDamage(x,y,angle,damage,range=135,halfAngle=.82){
  const r2=range*range;
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    const aa=Math.atan2(dy,dx);
    if(Math.abs(angleDifference(aa,angle))>halfAngle)continue;
    const d=Math.sqrt(d2)||1,scale=.55+.45*(1-d/range);
    applyShapeDamage(s,damage*scale,Math.cos(angle)*120*scale,Math.sin(angle)*120*scale);
    burst(s.x,s.y,Math.random()<.5?'#72ff43':'#ff42df',4);
    if(s.hp<=0){gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),11);shapes.splice(i,1)}
  }
  for(const enemy of remotePlayers.values()){
    if(!enemy.alive)continue;
    const dx=enemy.x-x,dy=enemy.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    if(Math.abs(angleDifference(Math.atan2(dy,dx),angle))>halfAngle)continue;
    const d=Math.sqrt(d2)||1,scale=.55+.45*(1-d/range);
    sendDamage(enemy.id,damage*scale);
  }
}
function spawnErrorSwordWave(angle,damageMul=1,opts={}){
  const p=playerParams(),speed=p.bulletSpeed*(opts.speedMul||1.0),scale=opts.scale||1;
  const b={
    x:player.x+Math.cos(angle)*(player.r+30),y:player.y+Math.sin(angle)*(player.r+30),
    vx:Math.cos(angle)*speed+player.vx*.08,vy:Math.sin(angle)*speed+player.vy*.08,
    r:14*scale,damage:p.damage*damageMul,life:opts.life||1.75,
    owner:player,ownerId:onlineSelfId,team:'player',cannon:'error',shape:'errorSwordWave',
    pierce:opts.pierce||12,splashRadius:0,basicAttack:opts.basicAttack===true,
    special:opts.special||'errorSwordWave',fragment:false,
    hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
  };
  bullets.push(b);broadcastShot(b);
  return b;
}
function activateSkill3(){
  if(!running||paused||!player?.alive)return;const cannon=player.cannonType||'standard';if(cannon!=='error'&&cannon!=='deku')return;
  refreshRealTimeSkillCooldowns();if(player.skill3Cd>0)return;const now=performance.now(),wallNow=Date.now(),a=player.angle,p=playerParams();
  if(cannon==='deku'){player.skill3Cd=DEKU_T_SKILL.cooldown;player.skill3Max=DEKU_T_SKILL.cooldown;player.skill3ReadyAt=wallNow+DEKU_T_SKILL.cooldown*1000;player.dekuFaJinUntil=now+7000;player.vx+=Math.cos(a)*190;player.vy+=Math.sin(a)*190;spawnCombatFx('dekuFaJin',player.x,player.y,{angle:a,color:'#baff70',life:1.35,radius:185,cannon:'deku'});burst(player.x,player.y,'#baff70',28);sendUniqueSkill(cannon,'dekuFaJin',{radius:185,life:1.35});broadcastLocalState(true);updateSkillHud();return}
  if(player.errorQCharging)cancelErrorQCharge();const ox=player.x,oy=player.y;
  player.skill3Cd=ERROR_T_SKILL.cooldown;
  player.skill3Max=ERROR_T_SKILL.cooldown;
  player.skill3ReadyAt=wallNow+ERROR_T_SKILL.cooldown*1000;
  player.errorSwordMode=!player.errorSwordMode;

  // T는 ON/OFF 어느 쪽이든 전방 돌진 + 검 베기를 수행한다.
  const distance=360;
  const tx=clamp(ox+Math.cos(a)*distance,player.r+10,WORLD-player.r-10);
  const ty=clamp(oy+Math.sin(a)*distance,player.r+10,WORLD-player.r-10);
  player.phaseUntil=now+420;

  spawnCombatFx('errorSwordDash',ox,oy,{angle:fxAngleToTarget(ox,oy,tx,ty,a),color:'#72ff43',life:.55,radius:Math.hypot(tx-ox,ty-oy),cannon:'error'});
  for(let k=1;k<=5;k++){
    const t=k/6;
    spawnCombatFx('errorDashTrace',ox+(tx-ox)*t,oy+(ty-oy)*t,{angle:fxAngleToTarget(ox,oy,tx,ty,a),color:'#72ff43',life:.30+k*.025,radius:45,cannon:'error'});
  }

  player.x=tx;player.y=ty;player.vx=Math.cos(a)*150;player.vy=Math.sin(a)*150;
  const swingDir=triggerErrorSwordSwing(player,1.35,.46);
  // T 돌진 베기는 일반 평타보다 훨씬 넓은 범위를 휩쓴다.
  errorSwordArcDamage(player.x,player.y,a,p.damage*3.0,235,1.28);
  spawnCombatFx('errorSwordSwing',player.x,player.y,{
    angle:a,color:'#72ff43',life:.50,radius:242,cannon:'error'
  });
  burst(player.x,player.y,'#72ff43',24);burst(player.x,player.y,'#ff42df',19);burst(player.x,player.y,'#42eaff',13);
  shake=Math.max(shake,10);

  sendOnline('skill',{
    slot:3,mode:'toggle',ownerId:onlineSelfId,cannon:'error',
    x:ox,y:oy,targetX:tx,targetY:ty,angle:a,swordMode:player.errorSwordMode,swingDir
  });
  broadcastLocalState(true);
  camera.x=player.x-innerWidth/2;camera.y=player.y-innerHeight/2;
  updateSkillHud();
}



function activateSkill4(){
  if(!running||paused||!player?.alive||player.cannonType!=='deku')return;refreshRealTimeSkillCooldowns();if(player.skill4Cd>0)return;
  const now=performance.now(),wallNow=Date.now();player.skill4Cd=DEKU_Y_SKILL.cooldown;player.skill4Max=DEKU_Y_SKILL.cooldown;player.skill4ReadyAt=wallNow+DEKU_Y_SKILL.cooldown*1000;player.dekuGearshiftUntil=now+7000;
  spawnCombatFx('dekuGearshift',player.x,player.y,{angle:player.angle,color:'#80efff',life:1.55,radius:220,cannon:'deku'});burst(player.x,player.y,'#bffcff',32);sendUniqueSkill('deku','dekuGearshift',{radius:220,life:1.55});broadcastLocalState(true);updateSkillHud();
}


function skillSlotReady(slot){
  if(!running||paused||!player?.alive)return false;
  refreshRealTimeSkillCooldowns();
  const cannon=player.cannonType||'standard';
  if(slot===4&&cannon!=='deku')return false;
  if(slot===1){if(cannon==='phantom'&&phantomMarkCanReturn())return true;return !!CANNON_SKILLS[cannon]&&(player.skillCd||0)<=.001;}
  if(slot===2){
    if(!CANNON_SKILLS_2[cannon])return false;
    if(cannon==='error'&&performance.now()<(player.overclockUntil||0))return Date.now()>=(player.errorDashReadyAt||0);
    if(cannon==='deku'&&(player.dekuWhipChainRemaining||0)>0&&performance.now()<(player.dekuWhipChainUntil||0))return true;
    return (player.skill2Cd||0)<=.001;
  }
  if(slot===3)return (cannon==='error'||cannon==='deku')&&(player.skill3Cd||0)<=.001;
  if(slot===4)return cannon==='deku'&&(player.skill4Cd||0)<=.001;
  return false;
}
function phantomVisibleTeleportRange(){
  return clamp(Math.hypot(innerWidth*.5,innerHeight*.5)-85,300,1150);
}
function phantomMarkCanReturn(){
  return !!(player?.phantomMarkActive&&performance.now()<(player.phantomMarkUntil||0));
}
function phantomAimTarget(){
  const maxRange=phantomVisibleTeleportRange();
  let angle=player?.angle||0,distance=maxRange;
  if(heldSkillAim.active&&heldSkillAim.source==='button'&&heldSkillAim.moved&&Number.isFinite(heldSkillAim.angle)){
    angle=heldSkillAim.angle;
    distance=clamp(Number(heldSkillAim.distance)||0,0,maxRange);
  }else{
    const wx=camera.x+input.mouseX,wy=camera.y+input.mouseY;
    const dx=wx-player.x,dy=wy-player.y,d=Math.hypot(dx,dy);
    if(d>.001){angle=Math.atan2(dy,dx);distance=Math.min(d,maxRange)}else distance=0;
  }
  return{x:clamp(player.x+Math.cos(angle)*distance,80,WORLD-80),y:clamp(player.y+Math.sin(angle)*distance,80,WORLD-80),angle,distance};
}
function phantomPreviewDistance(){
  if(phantomMarkCanReturn())return Math.hypot(player.x-player.phantomMarkOriginX,player.y-player.phantomMarkOriginY);
  return phantomAimTarget().distance;
}
function beginHeldSkillAim(slot,source='keyboard',event=null){
  if(heldSkillAim.active||!skillSlotReady(slot))return false;
  heldSkillAim.active=true;heldSkillAim.slot=slot;heldSkillAim.source=source;
  heldSkillAim.pointerId=event?.pointerId??null;heldSkillAim.startX=Number(event?.clientX)||0;heldSkillAim.startY=Number(event?.clientY)||0;
  heldSkillAim.angle=source==='button'?(player?.angle||0):null;heldSkillAim.distance=null;heldSkillAim.moved=false;
  if(slot===1&&player?.cannonType==='error'&&player.errorSwordMode)startErrorQCharge();
  return true;
}
function updateHeldSkillAim(event){
  if(!heldSkillAim.active||heldSkillAim.source!=='button')return;
  const dx=event.clientX-heldSkillAim.startX,dy=event.clientY-heldSkillAim.startY,d=Math.hypot(dx,dy);
  if(d>=8){
    heldSkillAim.angle=Math.atan2(dy,dx);heldSkillAim.moved=true;
    if(player?.cannonType==='phantom'&&heldSkillAim.slot===1&&!phantomMarkCanReturn())heldSkillAim.distance=clamp(d/145*phantomVisibleTeleportRange(),0,phantomVisibleTeleportRange());
    if(player)player.angle=heldSkillAim.angle;
  }
}
function cancelHeldSkillAim(){
  if(player?.errorQCharging)cancelErrorQCharge();
  heldSkillAim.active=false;heldSkillAim.slot=0;heldSkillAim.source='';heldSkillAim.pointerId=null;heldSkillAim.angle=null;heldSkillAim.distance=null;heldSkillAim.moved=false;
}
function releaseHeldSkillAim(slot=heldSkillAim.slot){
  if(!heldSkillAim.active||heldSkillAim.slot!==slot)return false;
  const cannon=player?.cannonType||'standard';
  const phantomTarget=(slot===1&&cannon==='phantom'&&!phantomMarkCanReturn())?phantomAimTarget():null;
  if(player&&Number.isFinite(heldSkillAim.angle))player.angle=heldSkillAim.angle;
  heldSkillAim.active=false;heldSkillAim.slot=0;heldSkillAim.source='';heldSkillAim.pointerId=null;heldSkillAim.angle=null;heldSkillAim.distance=null;heldSkillAim.moved=false;
  if(slot===1){if(cannon==='error'&&player?.errorSwordMode&&player?.errorQCharging)return releaseErrorQCharge();activateSkill(0,phantomTarget);return true}
  if(slot===2){activateSkill2();return true}
  if(slot===3){activateSkill3();return true}
  if(slot===4){activateSkill4();return true}
  return false;
}
function skillAimPoint(distance=520){
  const a=player.angle;
  return [
    clamp(player.x+Math.cos(a)*distance,80,WORLD-80),
    clamp(player.y+Math.sin(a)*distance,80,WORLD-80)
  ];
}
function pointToLineInfo(px,py,x1,y1,x2,y2){
  const vx=x2-x1,vy=y2-y1,l2=vx*vx+vy*vy||1;
  const t=clamp(((px-x1)*vx+(py-y1)*vy)/l2,0,1);
  const x=x1+vx*t,y=y1+vy*t,dx=px-x,dy=py-y;
  return {d2:dx*dx+dy*dy,t,x,y};
}
function damageSkillLine(x,y,angle,length,width,damage,color,push=0){
  const x2=x+Math.cos(angle)*length,y2=y+Math.sin(angle)*length,w2=width*width;
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],hit=pointToLineInfo(s.x,s.y,x,y,x2,y2);
    if(hit.d2>(width+s.r)*(width+s.r))continue;
    const scale=.72+.28*hit.t;
    const px=push?Math.cos(angle)*push:0,py=push?Math.sin(angle)*push:0;
    applyShapeDamage(s,damage*scale,px,py);burst(s.x,s.y,color,5);
    if(s.hp<=0){gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),10);shapes.splice(i,1)}
  }
  for(const enemy of remotePlayers.values()){
    if(!enemy.alive)continue;
    const hit=pointToLineInfo(enemy.x,enemy.y,x,y,x2,y2);
    if(hit.d2>(width+(enemy.r||27))**2)continue;
    sendDamage(enemy.id,damage*(.72+.28*hit.t));
  }
}
function damageSkillCone(x,y,angle,range,halfAngle,damage,color,push=0){
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],dx=s.x-x,dy=s.y-y,d=Math.hypot(dx,dy)||1;if(d>range+s.r)continue;
    if(Math.abs(angleDifference(Math.atan2(dy,dx),angle))>halfAngle)continue;
    const scale=.45+.55*(1-d/range),px=Math.cos(angle)*push*scale,py=Math.sin(angle)*push*scale;
    applyShapeDamage(s,damage*scale,px,py);burst(s.x,s.y,color,5);
    if(s.hp<=0){gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),10);shapes.splice(i,1)}
  }
  for(const enemy of remotePlayers.values()){
    if(!enemy.alive)continue;const dx=enemy.x-x,dy=enemy.y-y,d=Math.hypot(dx,dy)||1;if(d>range)continue;
    if(Math.abs(angleDifference(Math.atan2(dy,dx),angle))>halfAngle)continue;sendDamage(enemy.id,damage*(.45+.55*(1-d/range)));
  }
}
function spawnSkillProjectileAt(cannon,x,y,angle,opts={}){
  const p=playerParams(),speed=p.bulletSpeed*(opts.speedMul||1);
  const b={
    x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:opts.r||7,
    damage:p.damage*(opts.damageMul||1),life:opts.life||2,
    owner:player,ownerId:onlineSelfId,team:'player',cannon,shape:opts.shape||projectileShapeForCannon(cannon),
    pierce:opts.pierce||1,splashRadius:opts.splashRadius||0,basicAttack:false,special:opts.special||'',fragment:false,
    curve:Number(opts.curve)||0,motionSeed:Number(opts.motionSeed)||Math.random()*TAU,motionAge:0,
    hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
  };
  bullets.push(b);broadcastShot(b);return b;
}
function nearestSkillTarget(x,y,maxRange=700){
  let best=null,bestD2=maxRange*maxRange;
  for(const s of shapes){const dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best={x:s.x,y:s.y,kind:'shape',obj:s}}}
  for(const e of remotePlayers.values()){if(!e.alive)continue;const dx=e.x-x,dy=e.y-y,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best={x:e.x,y:e.y,kind:'player',obj:e}}}
  return best;
}
function chainLightningSkill(x,y,damage,maxJumps=9,range=360){
  const hitShapes=new Set(),hitPlayers=new Set();let cx=x,cy=y;
  for(let jump=0;jump<maxJumps;jump++){
    let best=null,bestD2=range*range;
    for(const s of shapes){if(hitShapes.has(s))continue;const dx=s.x-cx,dy=s.y-cy,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best={type:'shape',obj:s,x:s.x,y:s.y}}}
    for(const e of remotePlayers.values()){if(!e.alive||hitPlayers.has(e.id))continue;const dx=e.x-cx,dy=e.y-cy,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best={type:'player',obj:e,x:e.x,y:e.y}}}
    if(!best)break;
    spawnCombatFx('lightningLink',cx,cy,{angle:Math.atan2(best.y-cy,best.x-cx),color:'#fff37a',life:.24,radius:Math.sqrt(bestD2)});
    if(best.type==='shape'){hitShapes.add(best.obj);applyShapeDamage(best.obj,damage*Math.pow(.82,jump));burst(best.x,best.y,'#fff37a',8)}
    else{hitPlayers.add(best.obj.id);sendDamage(best.obj.id,damage*Math.pow(.82,jump));burst(best.x,best.y,'#fff37a',8)}
    cx=best.x;cy=best.y;
  }
}
function addSkillZone(type,opts={}){
  const life=Number(opts.life)||3;
  const z={type,x:opts.x??player.x,y:opts.y??player.y,radius:opts.radius||120,life,maxLife:life,damage:opts.damage||0,tick:opts.tick??0,
    angle:opts.angle||0,length:opts.length||0,width:opts.width||0,ownerId:onlineSelfId,networkRemote:opts.networkRemote===true,
    pulses:opts.pulses||0,interval:opts.interval||.4,triggered:false,data:opts.data||{},originX:opts.originX,originY:opts.originY};
  if(skillZones.length>=MAX_SKILL_ZONES)skillZones.splice(0,Math.max(1,skillZones.length-MAX_SKILL_ZONES+1));skillZones.push(z);return z;
}

function pointInTriangle(px,py,ax,ay,bx,by,cx,cy){
  const v0x=cx-ax,v0y=cy-ay,v1x=bx-ax,v1y=by-ay,v2x=px-ax,v2y=py-ay;
  const dot00=v0x*v0x+v0y*v0y,dot01=v0x*v1x+v0y*v1y,dot02=v0x*v2x+v0y*v2y;
  const dot11=v1x*v1x+v1y*v1y,dot12=v1x*v2x+v1y*v2y;
  const inv=1/Math.max(.000001,dot00*dot11-dot01*dot01);
  const u=(dot11*dot02-dot01*dot12)*inv,v=(dot00*dot12-dot01*dot02)*inv;
  return u>=0&&v>=0&&u+v<=1;
}
function tryStellarRevive(){
  if(!player?.stellarReviveReady)return false;
  const now=performance.now();
  if(now>(player.stellarReviveUntil||0)){
    player.stellarReviveReady=false;
    return false;
  }
  player.stellarReviveReady=false;
  player.stellarReviveUntil=0;
  player.hp=Math.max(1,player.maxHp*.75);
  player.phaseUntil=now+4000;
  player.vx=0;player.vy=0;

  // Buffed SECOND STAR: revive itself also clears the immediate area.
  skillAreaDamage(player.x,player.y,320,playerParams().damage*3.0,'#e8ffff');
  for(const s of shapes){
    const dx=s.x-player.x,dy=s.y-player.y,d=Math.hypot(dx,dy)||1;
    if(d<320)reportShapeImpulse(s,dx/d*260,dy/d*260);
  }

  burst(player.x,player.y,'#ffffff',70);
  burst(player.x,player.y,'#80ecff',48);
  spawnCombatFx('stellarRevive',player.x,player.y,{angle:0,color:'#ffffff',life:1.9,radius:330,cannon:'stellar'});
  broadcastLocalState(true);
  return true;
}

function sendUniqueSkill(cannon,skillType,extra={}){
  sendOnline('skill',{ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:player.angle,skillType,...extra});
}

function startErrorQCharge(){
  if(!running||paused||!player?.alive||player.cannonType!=='error'||!player.errorSwordMode)return false;
  refreshRealTimeSkillCooldowns();
  if(player.skillCd>0||player.errorQCharging)return false;
  player.errorQCharging=true;
  player.errorQChargeStartAt=Date.now();
  updateSkillHud();
  return true;
}
function cancelErrorQCharge(){
  if(!player)return;
  player.errorQCharging=false;
  player.errorQChargeStartAt=0;
  updateSkillHud();
}
function releaseErrorQCharge(){
  if(!player?.errorQCharging)return false;
  const heldMs=Math.max(0,Date.now()-(player.errorQChargeStartAt||Date.now()));
  const ratio=clamp(heldMs/5000,0,1);
  player.errorQCharging=false;
  player.errorQChargeStartAt=0;
  activateSkill(ratio);
  return true;
}

function clearLocalPhantomMarks(){
  for(let i=skillZones.length-1;i>=0;i--){const z=skillZones[i];if(z.type==='phantomAssassinMark'&&!z.networkRemote&&z.ownerId===onlineSelfId)skillZones.splice(i,1)}
}
function clearPhantomMarkState(removeZones=true){
  if(!player)return;
  player.phantomMarkActive=false;player.phantomMarkUntil=0;
  if(removeZones)clearLocalPhantomMarks();
  updateSkillHud();
}
function updatePhantomMarkState(){
  if(!player?.phantomMarkActive)return;
  if(player.cannonType!=='phantom'||performance.now()>=(player.phantomMarkUntil||0))clearPhantomMarkState(true);
}
function detonatePhantomMarks(){
  if(!phantomMarkCanReturn())return false;
  const p=playerParams(),ox=player.phantomMarkOriginX,oy=player.phantomMarkOriginY,dx=player.phantomMarkDestX,dy=player.phantomMarkDestY;
  skillAreaDamage(ox,oy,165,p.damage*3.25,'#cabdff');
  skillAreaDamage(dx,dy,165,p.damage*3.25,'#cabdff');
  burst(ox,oy,'#cabdff',34);burst(dx,dy,'#cabdff',34);
  spawnCombatFx('phantomMarkBurst',ox,oy,{angle:0,color:'#cabdff',life:.72,radius:190,cannon:'phantom'});
  spawnCombatFx('phantomMarkBurst',dx,dy,{angle:0,color:'#cabdff',life:.72,radius:190,cannon:'phantom'});
  player.x=clamp(ox,player.r,WORLD-player.r);player.y=clamp(oy,player.r,WORLD-player.r);player.vx=0;player.vy=0;
  sendUniqueSkill('phantom','phantomMarkDetonate',{originX:ox,originY:oy,destX:dx,destY:dy,targetX:ox,targetY:oy,radius:165});
  clearPhantomMarkState(true);broadcastLocalState(true);return true;
}

function activateSkill(errorChargeRatio=0,aimOverride=null){
  if(!running||paused||!player?.alive)return;
  const cannon=player.cannonType||'standard',def=CANNON_SKILLS[cannon];
  if(cannon==='phantom'&&phantomMarkCanReturn()){detonatePhantomMarks();return;}
  refreshRealTimeSkillCooldowns();if(!def||player.skillCd>0)return;
  player.skillCd=def.cooldown;player.skillMax=def.cooldown;player.skillReadyAt=Date.now()+def.cooldown*1000;
  const p=playerParams(),a=player.angle,now=performance.now();

  if(cannon==='standard'){
    const[tx,ty]=skillAimPoint(650);addSkillZone('artillery',{x:tx,y:ty,radius:310,life:1.25,damage:p.damage*5.8});
    sendUniqueSkill(cannon,'artillery',{targetX:tx,targetY:ty,radius:310,life:1.25});

  }else if(cannon==='scout'){
    const ox=player.x,oy=player.y,[tx,ty]=skillAimPoint(650),len=Math.hypot(tx-ox,ty-oy),aa=Math.atan2(ty-oy,tx-ox);
    damageSkillLine(ox,oy,aa,len,28,p.damage*2.0,'#75edff',70);
    spawnCombatFx('grappleCable',ox,oy,{angle:aa,color:def.color,life:.62,radius:len,cannon});
    player.x=tx;player.y=ty;player.phaseUntil=now+360;player.vx=Math.cos(aa)*250;player.vy=Math.sin(aa)*250;
    skillAreaDamage(tx,ty,80,p.damage*.9,'#75edff');broadcastLocalState(true);
    sendUniqueSkill(cannon,'grappleCable',{targetX:tx,targetY:ty,zoneAngle:aa,length:len,radius:80});

  }else if(cannon==='bastion'){
    const[tx,ty]=skillAimPoint(220);addSkillZone('barrier',{x:tx,y:ty,angle:a,length:330,width:34,radius:180,life:5.0});
    sendUniqueSkill(cannon,'barrier',{targetX:tx,targetY:ty,zoneAngle:a,length:330,width:34,radius:180,life:5});

  }else if(cannon==='rapid'){
    addSkillZone('rapidOverdrive',{x:player.x,y:player.y,radius:80,life:2.8,tick:0,data:{next:0}});
    sendUniqueSkill(cannon,'rapidOverdrive',{targetX:player.x,targetY:player.y,radius:80,life:2.8});

  }else if(cannon==='dual'){
    addSkillZone('twinDrones',{x:player.x,y:player.y,radius:115,life:6.2,tick:0,data:{next:0}});
    sendUniqueSkill(cannon,'twinDrones',{targetX:player.x,targetY:player.y,radius:115,life:6.2});

  }else if(cannon==='needle'){
    const length=820,x2=player.x+Math.cos(a)*length,y2=player.y+Math.sin(a)*length;
    damageSkillLine(player.x,player.y,a,length,24,p.damage*3.7,'#d2ff8b',0);
    for(const s of shapes){
      const hit=pointToLineInfo(s.x,s.y,player.x,player.y,x2,y2);
      if(hit.d2>(24+s.r)*(24+s.r))continue;
      const dx=player.x-s.x,dy=player.y-s.y,d=Math.hypot(dx,dy)||1;
      reportShapeImpulse(s,dx/d*360,dy/d*360);
    }
    spawnCombatFx('harpoonCable',player.x,player.y,{angle:a,color:def.color,life:.72,radius:length,cannon});
    sendUniqueSkill(cannon,'harpoonCable',{targetX:x2,targetY:y2,zoneAngle:a,length,radius:24});

  }else if(cannon==='spread'){
    damageSkillCone(player.x,player.y,a,500,.78,p.damage*4.2,'#7ff7ff',520);
    player.vx-=Math.cos(a)*380;player.vy-=Math.sin(a)*380;
    spawnCombatFx('shotgunBlast',player.x,player.y,{angle:a,color:def.color,life:.72,radius:500,cannon});shake=Math.max(shake,16);
    sendUniqueSkill(cannon,'shotgunBlast',{targetX:player.x+Math.cos(a)*350,targetY:player.y+Math.sin(a)*350,radius:500});

  }else if(cannon==='burst'){
    const[tx,ty]=skillAimPoint(520);
    addSkillZone('burstBomb',{x:tx,y:ty,radius:170,life:1.25,damage:p.damage*2.0,data:{detonateAt:.10}});
    sendUniqueSkill(cannon,'burstBomb',{targetX:tx,targetY:ty,radius:170,life:1.25});

  }else if(cannon==='crystal'){
    const[tx,ty]=skillAimPoint(360);
    addSkillZone('crystalPrism',{x:tx,y:ty,radius:118,life:7.0,damage:0,tick:0,data:{seen:new Set()}});
    sendUniqueSkill(cannon,'crystalPrism',{targetX:tx,targetY:ty,radius:118,life:7});

  }else if(cannon==='piercer'){
    damageSkillLine(player.x,player.y,a,1050,34,p.damage*6.2,'#d6bdff',110);spawnCombatFx('rail',player.x,player.y,{angle:a,color:def.color,life:.42,radius:1050,cannon});shake=Math.max(shake,15);
    sendUniqueSkill(cannon,'railSnipe',{targetX:player.x+Math.cos(a)*1050,targetY:player.y+Math.sin(a)*1050,radius:34});

  }else if(cannon==='laser'){
    addSkillZone('laserSweep',{x:player.x,y:player.y,radius:720,life:2.0,damage:p.damage*.72,angle:a-.85,data:{start:a-.85,span:1.70,next:0}});
    sendUniqueSkill(cannon,'laserSweep',{targetX:player.x,targetY:player.y,zoneAngle:a-.85,radius:720,life:2});

  }else if(cannon==='drill'){
    const b=spawnSkillProjectileAt(cannon,player.x+Math.cos(a)*40,player.y+Math.sin(a)*40,a,{damageMul:7.4,speedMul:.72,life:4.0,pierce:34,r:19,shape:'drillBit',special:'tunnelBreaker'});b.curve=1;shake=Math.max(shake,16);
    sendUniqueSkill(cannon,'tunnelBreaker',{targetX:b.x,targetY:b.y,radius:90});

  }else if(cannon==='plasma'){
    const[tx,ty]=skillAimPoint(430);addSkillZone('plasmaCage',{x:tx,y:ty,radius:245,life:4.8,damage:p.damage*.48,tick:0,data:{next:0}});
    sendUniqueSkill(cannon,'plasmaCage',{targetX:tx,targetY:ty,radius:245,life:4.8});

  }else if(cannon==='thunder'){
    const[tx,ty]=skillAimPoint(520);
    addSkillZone('thunderStorm',{x:tx,y:ty,radius:300,life:5.0,damage:p.damage*1.65,tick:0,data:{next:.10,strikes:0}});
    sendUniqueSkill(cannon,'thunderStorm',{targetX:tx,targetY:ty,radius:300,life:5});

  }else if(cannon==='inferno'){
    const[tx,ty]=skillAimPoint(360);addSkillZone('flameWall',{x:tx,y:ty,angle:a+Math.PI/2,length:560,width:92,radius:300,life:5.2,damage:p.damage*.42,tick:0});
    sendUniqueSkill(cannon,'flameWall',{targetX:tx,targetY:ty,zoneAngle:a+Math.PI/2,length:560,width:92,radius:300,life:5.2});

  }else if(cannon==='rocket'){
    const[tx,ty]=skillAimPoint(540);
    addSkillZone('missileRain',{x:tx,y:ty,radius:330,life:5.0,damage:p.damage*2.15,tick:0,data:{next:.15,count:0}});
    sendUniqueSkill(cannon,'missileRain',{targetX:tx,targetY:ty,radius:330,life:5});

  }else if(cannon==='titan'){
    addSkillZone('earthFissure',{x:player.x,y:player.y,angle:a,length:760,width:110,radius:380,life:1.8,damage:p.damage*2.0,pulses:6,interval:.20,data:{next:0,index:0}});
    shake=Math.max(shake,18);
    sendUniqueSkill(cannon,'earthFissure',{targetX:player.x+Math.cos(a)*380,targetY:player.y+Math.sin(a)*380,zoneAngle:a,length:760,width:110,radius:380,life:1.8});

  }else if(cannon==='phantom'){
    const ox=player.x,oy=player.y,target=aimOverride||phantomAimTarget(),tx=target.x,ty=target.y;
    player.phantomMarkActive=true;player.phantomMarkUntil=now+5000;
    player.phantomMarkOriginX=ox;player.phantomMarkOriginY=oy;player.phantomMarkDestX=tx;player.phantomMarkDestY=ty;
    addSkillZone('phantomAssassinMark',{x:ox,y:oy,radius:150,life:5,damage:0,data:{mark:'origin'}});
    addSkillZone('phantomAssassinMark',{x:tx,y:ty,radius:150,life:5,damage:0,data:{mark:'destination'}});
    spawnCombatFx('phantomTeleportTrace',ox,oy,{angle:Math.atan2(ty-oy,tx-ox),color:'#cabdff',life:.55,radius:Math.hypot(tx-ox,ty-oy),cannon:'phantom'});
    player.x=tx;player.y=ty;player.vx=0;player.vy=0;broadcastLocalState(true);
    sendUniqueSkill(cannon,'phantomMarks',{originX:ox,originY:oy,destX:tx,destY:ty,targetX:tx,targetY:ty,radius:150,life:5});
    updateSkillHud();

  }else if(cannon==='ring'){
    const[tx,ty]=skillAimPoint(460);
    addSkillZone('ringGate',{x:tx,y:ty,radius:92,life:6.0,damage:0,tick:0,data:{seen:new Set()}});
    sendUniqueSkill(cannon,'ringGate',{targetX:tx,targetY:ty,radius:92,life:6});

  }else if(cannon==='chrono'){
    const[tx,ty]=skillAimPoint(440);addSkillZone('timeField',{x:tx,y:ty,radius:310,life:4.5,damage:0,tick:0});
    sendUniqueSkill(cannon,'timeField',{targetX:tx,targetY:ty,radius:310,life:4.5});

  }else if(cannon==='void'){
    const[tx,ty]=skillAimPoint(500);addSkillZone('gravity',{x:tx,y:ty,radius:300,life:4.2,damage:p.damage*.20,tick:0});
    sendUniqueSkill(cannon,'gravity',{targetX:tx,targetY:ty,radius:300,life:4.2});

  }else if(cannon==='nova'){
    const[tx,ty]=skillAimPoint(520);addSkillZone('supernovaCore',{x:tx,y:ty,radius:420,life:2.3,damage:p.damage*7.0,data:{detonateAt:.18}});
    sendUniqueSkill(cannon,'supernovaCore',{targetX:tx,targetY:ty,radius:420,life:2.3});

  }else if(cannon==='comet'){
    const ox=player.x,oy=player.y,[tx,ty]=skillAimPoint(850),length=Math.hypot(tx-ox,ty-oy),aa=Math.atan2(ty-oy,tx-ox);player.x=tx;player.y=ty;player.phaseUntil=now+480;addSkillZone('cometTrail',{x:(ox+tx)/2,y:(oy+ty)/2,angle:aa,length,width:100,radius:length/2,life:4.0,damage:p.damage*.42,tick:0});skillAreaDamage(tx,ty,150,p.damage*2.0,'#72ecff');broadcastLocalState(true);
    sendUniqueSkill(cannon,'cometTrail',{targetX:(ox+tx)/2,targetY:(oy+ty)/2,zoneAngle:aa,length,width:100,radius:length/2,life:4});

  }else if(cannon==='stellar'){
    const[tx,ty]=skillAimPoint(360);
    player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.15);
    addSkillZone('constellation',{
      x:tx,y:ty,radius:340,life:8.0,
      damage:p.damage*.55,tick:0,
      data:{heal:player.maxHp*.04}
    });
    burst(tx,ty,'#e8ffff',30);
    sendUniqueSkill(cannon,'constellation',{targetX:tx,targetY:ty,radius:340,life:8});

  }else if(cannon==='deku'){
    player.dekuSmokeUntil=now+5000;addSkillZone('dekuSmoke',{x:player.x,y:player.y,radius:330,life:5,damage:0,tick:0});burst(player.x,player.y,'#cbd8cc',18);sendUniqueSkill(cannon,'dekuSmoke',{targetX:player.x,targetY:player.y,radius:330,life:5});broadcastLocalState(true);
  }else if(cannon==='error'){
    const errorSwordQ=player.errorSwordMode===true;sendOnline('skill',{ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a,charge:errorSwordQ?clamp(Number(errorChargeRatio)||0,0,1):0,mode:errorSwordQ?'sword':'gun'});
    if(!errorSwordQ){skillAreaDamage(player.x,player.y,245,p.damage*2.8,'#79ff47');for(let i=0;i<24;i++)skillProjectile(cannon,i*TAU/24+rand(-.035,.035),{damageMul:.65,speedMul:1.25,life:2.5,pierce:16,splashRadius:94});burst(player.x,player.y,'#79ff47',44);shake=Math.max(shake,17)}
    else{const charge=clamp(Number(errorChargeRatio)||0,0,1),bladeScale=2.60*(1+2*charge);errorSwordArcDamage(player.x,player.y,a,p.damage*(1.8+.8*charge),155+55*charge,.74);const blade=spawnErrorSwordWave(a,4.8*(1+.5*charge),{speedMul:1.30,life:2.85+.45*charge,pierce:Math.round(28+12*charge),scale:bladeScale,special:'errorQBlade'});blade.charge=charge;spawnCombatFx('errorSwordSwing',player.x,player.y,{angle:a,color:'#72ff43',life:.50+.18*charge,radius:165+90*charge,cannon:'error'});shake=Math.max(shake,14+8*charge)}

  }else if(cannon==='glitch'){
    const[tx,ty]=skillAimPoint(560);for(let i=0;i<6;i++){const q=i*TAU/6,r=150,x=player.x+Math.cos(q)*r,y=player.y+Math.sin(q)*r,aa=Math.atan2(ty-y,tx-x);for(let k=-1;k<=1;k++)spawnSkillProjectileAt(cannon,x,y,aa+k*.05,{damageMul:.52,speedMul:1.28,life:2.4,pierce:12,r:7,special:'mirrorPacket'})}burst(player.x,player.y,'#ff42df',38);
    sendUniqueSkill(cannon,'mirrorError',{targetX:tx,targetY:ty,radius:150});

  }else if(cannon==='zero'){
    damageSkillLine(player.x,player.y,a,1250,72,p.damage*9.5,'#ffffff',0);for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(b.team!=='remote')continue;const hit=pointToLineInfo(b.x,b.y,player.x,player.y,player.x+Math.cos(a)*1250,player.y+Math.sin(a)*1250);if(hit.d2<72*72)bullets.splice(i,1)}spawnCombatFx('rail',player.x,player.y,{angle:a,color:'#fff',life:.55,radius:1250,cannon});shake=Math.max(shake,22);
    sendUniqueSkill(cannon,'zeroLine',{targetX:player.x+Math.cos(a)*1250,targetY:player.y+Math.sin(a)*1250,radius:72});
  }
  updateSkillHud();
}
function activateSkill2(){
  if(!running||paused||!player?.alive)return;
  const cannon=player.cannonType||'standard',def=CANNON_SKILLS_2[cannon];if(!def)return;
  refreshRealTimeSkillCooldowns();const now=performance.now(),wallNow=Date.now(),a=player.angle,p=playerParams();

  if(cannon==='error'&&now<(player.overclockUntil||0)){
    if(wallNow<(player.errorDashReadyAt||0))return;const ox=player.x,oy=player.y,[tx,ty]=skillAimPoint(460);player.errorDashReadyAt=wallNow+3000;player.phaseUntil=now+380;player.x=tx;player.y=ty;spawnCombatFx('errorDashTrace',ox,oy,{angle:fxAngleToTarget(ox,oy,tx,ty,a),color:def.color,life:.5,radius:Math.hypot(tx-ox,ty-oy),cannon});sendOnline('skill',{slot:2,mode:'dash',ownerId:onlineSelfId,cannon,x:ox,y:oy,targetX:tx,targetY:ty,angle:a});broadcastLocalState(true);updateSkillHud();return;
  }
  const dekuWhipChainCast=cannon==='deku'&&(player.dekuWhipChainRemaining||0)>0&&now<(player.dekuWhipChainUntil||0);
  if(player.skill2Cd>0&&!dekuWhipChainCast)return;
  if(!dekuWhipChainCast){player.skill2Cd=def.cooldown;player.skill2Max=def.cooldown;player.skill2ReadyAt=wallNow+def.cooldown*1000}

  if(cannon==='rocket'){
    player.fortressUntil=now+6000;
    player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.12);
    addSkillZone('ironDome',{x:player.x,y:player.y,radius:148,life:6.0,damage:0,tick:0});
    sendUniqueSkill(cannon,'ironDome',{targetX:player.x,targetY:player.y,radius:148,life:6});
    broadcastLocalState(true);

  }else if(cannon==='titan'){
    player.siegeUntil=now+8000;player.vx=0;player.vy=0;
    addSkillZone('siegeAura',{x:player.x,y:player.y,radius:132,life:8,damage:p.damage*.72,tick:0,data:{next:.15}});
    sendUniqueSkill(cannon,'siegeAura',{targetX:player.x,targetY:player.y,radius:132,life:8});

  }else if(cannon==='phantom'){
    player.cloakUntil=now+5000;
    addSkillZone('specterCloak',{x:player.x,y:player.y,radius:105,life:5,damage:0,tick:0,data:{next:0}});
    spawnCombatFx('cloakBurst',player.x,player.y,{angle:0,color:def.color,life:.60,radius:115,cannon:'phantom'});
    sendUniqueSkill(cannon,'specterCloakCast',{targetX:player.x,targetY:player.y,radius:105,life:.6});
    broadcastLocalState(true);

  }else if(cannon==='ring'){
    addSkillZone('ringParry',{x:player.x,y:player.y,radius:175,life:5.8,damage:p.damage*.82,tick:0});
    sendUniqueSkill(cannon,'ringParry',{targetX:player.x,targetY:player.y,radius:175,life:5.8});

  }else if(cannon==='chrono'){
    const old=getRewindState(4000);
    if(old){
      const ox=player.x,oy=player.y;
      player.x=old.x;player.y=old.y;
      player.hp=Math.max(player.hp,Math.min(player.maxHp,old.hp));
      player.vx=old.vx;player.vy=old.vy;player.phaseUntil=now+700;
      addSkillZone('rewindEcho',{x:ox,y:oy,radius:185,life:1.25,damage:0});
      spawnCombatFx('rewindBurst',ox,oy,{angle:Math.atan2(player.y-oy,player.x-ox),color:def.color,life:.75,radius:Math.hypot(player.x-ox,player.y-oy),cannon});
      broadcastLocalState(true);
    }
    sendUniqueSkill(cannon,'rewindEcho',{targetX:player.x,targetY:player.y,radius:185,life:1.25});

  }else if(cannon==='void'){
    addSkillZone('antiMatter',{x:player.x,y:player.y,radius:430,life:6.6,damage:p.damage*.24,tick:0});
    sendUniqueSkill(cannon,'antiMatter',{targetX:player.x,targetY:player.y,radius:430,life:6.6});

  }else if(cannon==='nova'){
    addSkillZone('starOrbit',{x:player.x,y:player.y,radius:185,life:7,damage:p.damage*.52,tick:0,data:{next:0}});
    spawnCombatFx('orbitalIgnition',player.x,player.y,{angle:0,color:def.color,life:.8,radius:250,cannon});
    sendUniqueSkill(cannon,'starOrbit',{targetX:player.x,targetY:player.y,radius:185,life:7});

  }else if(cannon==='comet'){
    const[tx,ty]=skillAimPoint(620);
    addSkillZone('cometShower',{x:tx,y:ty,radius:370,life:6.2,damage:p.damage*2.05,tick:0,data:{next:.12}});
    sendUniqueSkill(cannon,'cometShower',{targetX:tx,targetY:ty,radius:370,life:6.2});

  }else if(cannon==='stellar'){
    player.stellarReviveUntil=now+12000;player.stellarReviveReady=true;
    player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.30);
    addSkillZone('secondStar',{x:player.x,y:player.y,radius:145,life:12.0,damage:0,tick:0});
    burst(player.x,player.y,'#ffffff',26);
    sendUniqueSkill(cannon,'secondStar',{targetX:player.x,targetY:player.y,radius:145,life:12});

  }else if(cannon==='error'){
    player.overclockUntil=now+15000;player.errorDashReadyAt=wallNow;
    addSkillZone('glitchDriveAura',{x:player.x,y:player.y,radius:125,life:15,damage:0,tick:0});
    sendOnline('skill',{slot:2,mode:'boost',ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a});
    sendUniqueSkill(cannon,'glitchDriveAura',{targetX:player.x,targetY:player.y,radius:125,life:15});
    broadcastLocalState(true);

  }else if(cannon==='glitch'){
    const ox=player.x,oy=player.y,[tx,ty]=skillAimPoint(900),aa=Math.atan2(ty-oy,tx-ox),length=Math.hypot(tx-ox,ty-oy);
    player.x=tx;player.y=ty;player.phaseUntil=now+520;player.vx=0;player.vy=0;
    addSkillZone('glitchWarpTrail',{x:ox,y:oy,angle:aa,length,width:96,radius:length/2,life:1.8,damage:p.damage*1.75,pulses:6,interval:.17,data:{next:.18,index:0}});
    sendOnline('skill',{ownerId:onlineSelfId,cannon,x:ox,y:oy,angle:aa,skillType:'glitchWarpTrail',targetX:ox,targetY:oy,zoneAngle:aa,length,width:96,radius:length/2,life:1.8});
    spawnCombatFx('dataWarp',ox,oy,{angle:fxAngleToTarget(ox,oy,tx,ty,aa),color:def.color,life:.72,radius:Math.hypot(tx-ox,ty-oy),cannon});
    broadcastLocalState(true);

  }else if(cannon==='zero'){
    addSkillZone('absoluteZero',{x:player.x,y:player.y,radius:560,life:4.3,damage:p.damage*.16,tick:0});sendUniqueSkill(cannon,'absoluteZero',{targetX:player.x,targetY:player.y,radius:560,life:4.3});
  }else if(cannon==='deku'){
    const faJinBoost=now<(player.dekuFaJinUntil||0);
    const ox=player.x,oy=player.y;
    const length=760,width=faJinBoost?46:38,x2=ox+Math.cos(a)*length,y2=oy+Math.sin(a)*length;
    damageSkillLine(ox,oy,a,length,width,p.damage*2.25,faJinBoost?'#65f4ee':'#52e7ea',55);
    for(const s of shapes){const h=pointToLineInfo(s.x,s.y,ox,oy,x2,y2);if(h.d2<=(width+s.r)*(width+s.r)){s.stunUntil=now+1700;s.vx=0;s.vy=0}}

    // V5.51: Blackwhip only breaks its combo when it actually catches another player.
    let hitPlayer=false;
    for(const enemy of remotePlayers.values()){
      if(!enemy.alive)continue;
      const h=pointToLineInfo(enemy.x,enemy.y,ox,oy,x2,y2);
      if(h.d2>(width+enemy.r)*(width+enemy.r))continue;
      hitPlayer=true;
      sendStatus(enemy.id,'stun',1700);
    }

    spawnCombatFx('dekuBlackwhip',ox,oy,{angle:fxAngleToTarget(ox,oy,x2,y2,a),color:'#52e7ea',life:1.25,radius:Math.hypot(x2-ox,y2-oy),cannon:'deku',variant:faJinBoost?'faJin':''});
    if(faJinBoost)spawnCombatFx('dekuFaJinAttack',ox,oy,{angle:a,color:'#69f5ee',life:.48,radius:135,cannon:'deku',variant:'blackwhip'});

    let recoilDash=false,dashX=ox,dashY=oy;
    if(hitPlayer){
      player.dekuWhipChainRemaining=0;
      player.dekuWhipChainUntil=0;
    }else{
      // First miss opens two extra casts; every later miss consumes one, for 3 casts total.
      const remainingAfter=dekuWhipChainCast?Math.max(0,(player.dekuWhipChainRemaining||0)-1):2;
      player.dekuWhipChainRemaining=remainingAfter;
      player.dekuWhipChainUntil=remainingAfter>0?now+2200:0;

      // The unstuck whip snaps Deku forward like an elastic slingshot rather than a plain teleport.
      const dashDistance=faJinBoost?330:270;
      dashX=clamp(ox+Math.cos(a)*dashDistance,player.r+10,WORLD-player.r-10);
      dashY=clamp(oy+Math.sin(a)*dashDistance,player.r+10,WORLD-player.r-10);
      const actualDash=Math.hypot(dashX-ox,dashY-oy);
      if(actualDash>4){
        recoilDash=true;
        player.phaseUntil=now+300;
        player.x=dashX;player.y=dashY;
        player.vx=Math.cos(a)*p.move*.92;player.vy=Math.sin(a)*p.move*.92;
        spawnCombatFx('dekuWhipElasticDash',ox,oy,{angle:a,color:'#5cf6e8',life:.52,radius:actualDash,cannon:'deku',variant:faJinBoost?'faJin':''});
        burst(ox,oy,faJinBoost?'#a5ff72':'#63f5e9',faJinBoost?22:15);
        broadcastLocalState(true);
      }
    }

    sendUniqueSkill(cannon,'dekuBlackwhip',{x:ox,y:oy,targetX:x2,targetY:y2,zoneAngle:a,length,width,radius:width,life:1.25,faJinBoost,hitPlayer,recoilDash,dashX,dashY,chainRemaining:player.dekuWhipChainRemaining||0});
  }
  updateSkillHud();
}
function spawnPassiveBullet(opts){
  const a=opts.angle,speed=opts.speed;
  const b={x:opts.x,y:opts.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:opts.r||4,damage:opts.damage,life:opts.life||.7,owner:player,ownerId:onlineSelfId,team:'player',cannon:opts.cannon,shape:opts.shape||projectileShapeForCannon(opts.cannon),pierce:opts.pierce||1,splashRadius:opts.splashRadius||0,basicAttack:false,special:opts.special||'',fragment:opts.fragment===true,hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()};
  bullets.push(b);broadcastShot(b);return b;
}
function spawnSpreadFragments(parent,x,y){
  if(parent.fragment||parent.shrapnelDone)return;parent.shrapnelDone=true;
  const base=Math.atan2(parent.vy,parent.vx),speed=Math.max(280,Math.hypot(parent.vx,parent.vy)*.82);
  for(const off of [-.42,.42])spawnPassiveBullet({x,y,angle:base+off,speed,damage:parent.damage*.28,life:.60,r:3,cannon:'spread',shape:'spreadShard',special:'shrapnel',fragment:true});
  spawnCombatFx('spreadShardBurst',x,y,{angle:base,color:'#74f5ff',life:.30,radius:35,cannon:'spread'});
}
function spawnNovaFragments(parent,x,y){
  if(parent.fragment||parent.novaSplit)return;parent.novaSplit=true;
  const speed=Math.max(320,Math.hypot(parent.vx,parent.vy)*.74);
  for(let k=0;k<4;k++)spawnPassiveBullet({x,y,angle:k*TAU/4+Math.PI/4,speed,damage:parent.damage*.30,life:.78,r:5,cannon:'nova',shape:'novaStar',special:'novaFragment',fragment:true});
  spawnCombatFx('novaFragmentBurst',x,y,{angle:0,color:'#84f5ff',life:.42,radius:50,cannon:'nova'});
}
function chainPlasmaBasicHit(parent,x,y,primaryShape=null,primaryPlayerId=''){
  if(!parent.basicAttack||parent.plasmaChainDone)return;parent.plasmaChainDone=true;
  const range=parent.cannon==='thunder'?330:280,range2=range*range,candidates=[];
  for(const s of shapes){if(s===primaryShape||s.hp<=0)continue;const dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;if(d2<=range2)candidates.push({kind:'shape',target:s,d2})}
  for(const enemy of remotePlayers.values()){if(!enemy.alive||enemy.id===primaryPlayerId)continue;const dx=enemy.x-x,dy=enemy.y-y,d2=dx*dx+dy*dy;if(d2<=range2)candidates.push({kind:'player',target:enemy,d2})}
  candidates.sort((a,b)=>a.d2-b.d2);
  for(const c of candidates.slice(0,parent.cannon==='thunder'?3:2)){
    const tx=c.target.x,ty=c.target.y,damage=parent.damage*(parent.cannon==='thunder'?.40:.45);
    combatFx.push({type:'chainArc',x,y,x2:tx,y2:ty,angle:0,color:'#84f8ff',life:.28,maxLife:.28,radius:0,size:1,ownerId:onlineSelfId,cannon:'plasma'});
    if(c.kind==='shape'){applyShapeDamage(c.target,damage);burst(tx,ty,'#89f8ff',5);if(c.target.hp<=0){const idx=shapes.indexOf(c.target);if(idx>=0){gainXp(c.target.xp);burst(tx,ty,colorForShape(c.target.type),10);shapes.splice(idx,1)}}}
    else{sendDamage(c.target.id,damage);burst(tx,ty,'#89f8ff',5)}
  }
}
function createRocketBurnZone(parent,x,y){
  if(!parent.basicAttack||parent.burnSpawned)return;parent.burnSpawned=true;
  skillZones.push({type:'burn',x,y,radius:105,life:2.4,maxLife:2.4,damage:parent.damage*.13,tick:0,ownerId:onlineSelfId,networkRemote:false});
}
function maybeReturnRingBullet(b){
  if(!b.basicAttack||!['ring','chrono'].includes(b.cannon)||b.returned||b.life>.82)return;
  const owner=b.networkRemote?remotePlayers.get(b.ownerId):player;if(!owner||owner.alive===false)return;
  const dx=owner.x-b.x,dy=owner.y-b.y,[nx,ny]=norm(dx,dy),speed=Math.max(280,Math.hypot(b.vx,b.vy));
  b.vx=nx*speed;b.vy=ny*speed;b.returned=true;b.life+=1.20;b.pierce=Math.max(b.pierce||1,4);b.hitTargets=new Set();b.hitIds=new Set();
  if(!b.networkRemote)broadcastShotSync(b);
  spawnCombatFx('ringReturn',b.x,b.y,{angle:Math.atan2(b.vy,b.vx),color:'#dfceff',life:.45,radius:46,cannon:'ring'});
}


function errorGlitchImpact(parent,x,y,primaryShape=null,primaryPlayerId=''){
  if(!parent.basicAttack||cannonFamily(parent.cannon)!=='error')return;

  const isCore=parent.special==='nullCore';
  const isEcho=parent.special==='nullEcho';
  const radius=isCore?120:isEcho?92:80;
  const base=parent.damage*(isCore?.55:isEcho?.34:.29);
  const r2=radius*radius;

  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
    if(s===primaryShape||s.hp<=0)continue;
    const dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    const d=Math.sqrt(d2)||1;
    const falloff=.38+.62*(1-d/radius);
    applyShapeDamage(s,base*falloff,dx/d*55*falloff,dy/d*55*falloff);
    if(Math.random()<.28)burst(s.x,s.y,Math.random()<.5?'#72ff43':'#ff42df',2);
    if(s.hp<=0){
      if(parent.owner===player)gainXp(s.xp);
      burst(s.x,s.y,colorForShape(s.type),10);
      shapes.splice(i,1);
    }
  }

  for(const enemy of remotePlayers.values()){
    if(!enemy.alive||enemy.id===primaryPlayerId)continue;
    const dx=enemy.x-x,dy=enemy.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    const falloff=.38+.62*(1-Math.sqrt(d2)/radius);
    sendDamage(enemy.id,base*falloff);
  }

  spawnCombatFx('errorImpact',x,y,{
    angle:Math.atan2(parent.vy,parent.vx),
    color:isCore?'#ffffff':'#72ff43',
    life:isCore?.48:.32,
    radius,
    cannon:'error'
  });
  burst(x,y,'#72ff43',isCore?9:4);
  burst(x,y,'#ff42df',isCore?7:3);
  if(isCore)burst(x,y,'#42eaff',5);
}

function fire(e){
  if(e!==player||e.fireCd>0)return;
  const a=e.angle,p=playerParams();e.fireCd=p.reload;
  const cannon=e.cannonType||'standard',family=cannonFamily(cannon);
  e.basicShotCount=(e.basicShotCount||0)+1;const shotNo=e.basicShotCount;

  if(cannon==='error'&&e.errorSwordMode){
    e.fireCd=Math.max(.18,p.reload*.88);
    const swingDir=triggerErrorSwordSwing(e,1,.34);
    errorSwordArcDamage(e.x,e.y,a,p.damage*1.30,175,1.15);
    spawnCombatFx('errorSwordSwing',e.x,e.y,{angle:a,color:'#72ff43',life:.38,radius:182,cannon:'error'});
    const rBoostActive=performance.now()<(e.overclockUntil||0);
    if(rBoostActive)spawnErrorSwordWave(a,.68,{speedMul:1.14,life:1.50,pierce:10,scale:2.0,basicAttack:true,special:'errorRBasicBlade'});
    sendOnline('skill',{slot:3,mode:'basicSwing',ownerId:onlineSelfId,cannon:'error',x:e.x,y:e.y,targetX:e.x,targetY:e.y,angle:a,swordMode:true,rBlade:rBoostActive,swingDir});
    e.vx-=Math.cos(a)*10;e.vy-=Math.sin(a)*10;return;
  }

  let shots=[];

  // 기본 등급
  if(cannon==='standard'){
    shots=[{angle:a,side:0,curve:0,damageMul:shotNo%5===0?1.70:1,special:shotNo%5===0?'precision':''}];
  }else if(cannon==='scout'){
    const side=shotNo%2?-8:8;
    shots=shotNo%4===0
      ?[{angle:a-.05,side:-7,curve:-1,damageMul:.84,special:'scoutDouble'},{angle:a+.05,side:7,curve:1,damageMul:.84,special:'scoutDouble'}]
      :[{angle:a,side,curve:side<0?-1:1,damageMul:1,special:'scoutWeave'}];
  }else if(cannon==='bastion'){
    shots=[{angle:a,side:0,curve:0,damageMul:shotNo%6===0?2.20:1,special:shotNo%6===0?'bastionCore':'bastionHeavy'}];

  // 일반
  }else if(cannon==='rapid'){
    const jitter=Math.sin(shotNo*2.71)*.026;
    shots=shotNo%8===0
      ?[-.045,0,.045].map((v,i)=>({angle:a+v,side:(i-1)*3,curve:i-1,damageMul:.58,special:'acceleratedBurst'}))
      :[{angle:a+jitter,side:0,curve:Math.sin(shotNo),damageMul:1,special:'rapidJitter'}];
  }else if(cannon==='dual'){
    shots=shotNo%7===0
      ?[-.07,-.025,.025,.07].map((v,i)=>({angle:a+v,side:(i-1.5)*5,curve:i<2?-1:1,damageMul:.45,special:'dualBurst'}))
      :[{angle:a-.012,side:-7,curve:-1,damageMul:.68,special:'dualLeft'},{angle:a+.012,side:7,curve:1,damageMul:.68,special:'dualRight'}];
  }else if(cannon==='needle'){
    shots=[{angle:a,side:(shotNo%3-1)*2,curve:0,damageMul:shotNo%6===0?1.55:1,special:shotNo%6===0?'needleCore':'needleAccel'}];

  // 희귀
  }else if(cannon==='spread'){
    shots=[-.25,-.125,0,.125,.25].map(v=>({angle:a+v,side:0,curve:Math.sign(v),damageMul:1,special:'shrapnelCarrier'}));
  }else if(cannon==='burst'){
    const arr=shotNo%5===0?[-.17,-.085,0,.085,.17]:[-.075,0,.075];
    shots=arr.map((v,i)=>({angle:a+v,side:0,curve:i%2?-1:1,damageMul:shotNo%5===0?.55:.72,special:'burstDisc'}));
  }else if(cannon==='crystal'){
    const arr=shotNo%4===0?[-.30,-.20,-.10,0,.10,.20,.30]:[-.15,0,.15];
    shots=arr.map((v,i)=>({angle:a+v,side:0,curve:i<(arr.length/2)?-1:1,damageMul:shotNo%4===0?.42:.65,special:'crystalCurve'}));

  // 에픽
  }else if(cannon==='piercer'){
    shots=[{angle:a,side:0,curve:0,damageMul:1,special:'penetrationAccel'}];
  }else if(cannon==='laser'){
    shots=shotNo%3===0
      ?[{angle:a,side:0,curve:0,damageMul:1.75,special:'laserCore'}]
      :[{angle:a,side:-5,curve:0,damageMul:.58,special:'laserTwin'},{angle:a,side:5,curve:0,damageMul:.58,special:'laserTwin'}];
  }else if(cannon==='drill'){
    shots=[{angle:a,side:0,curve:shotNo%2?-1:1,damageMul:shotNo%4===0?2.20:1.05,special:shotNo%4===0?'drillCore':'drillSpin'}];

  // 전설
  }else if(cannon==='plasma'){
    shots=[{angle:a,side:0,curve:0,damageMul:1,special:'chainDischarge'}];
  }else if(cannon==='thunder'){
    const arr=shotNo%4===0?[-.10,0,.10]:[-.045,.045];
    shots=arr.map((v,i)=>({angle:a+v,side:0,curve:i%2?-1:1,damageMul:shotNo%4===0?.72:.64,special:'thunderArc'}));
  }else if(cannon==='inferno'){
    shots=shotNo%5===0
      ?[-.15,0,.15].map((v,i)=>({angle:a+v,side:0,curve:i-1,damageMul:.68,special:'infernoTriple'}))
      :[{angle:a,side:0,curve:shotNo%2?-1:1,damageMul:1,special:'incendiary'}];

  // 신화
  }else if(cannon==='rocket'){
    shots=[{angle:a,side:0,curve:0,damageMul:1,special:'incendiary'}];
  }else if(cannon==='titan'){
    const side=shotNo%2?-9:9;
    shots=shotNo%4===0
      ?[{angle:a-.025,side:-9,curve:0,damageMul:.80,special:'titanTwin'},{angle:a+.025,side:9,curve:0,damageMul:.80,special:'titanTwin'}]
      :[{angle:a,side,curve:0,damageMul:1,special:'titanAlternating'}];
  }else if(cannon==='phantom'){
    shots=shotNo%5===0
      ?[-.07,0,.07].map((v,i)=>({angle:a+v,side:0,curve:i-1,damageMul:.65,special:'phantomTriple'}))
      :[{angle:a,side:0,curve:shotNo%2?-1:1,damageMul:1,special:'phantomWave'}];

  // 시크릿
  }else if(cannon==='ring'){
    shots=[{angle:a,side:0,curve:0,damageMul:1,special:'returnRing'}];
  }else if(cannon==='chrono'){
    const arr=shotNo%3===0?[-.07,0,.07]:[-.04,.04];
    shots=arr.map((v,i)=>({angle:a+v,side:(i-(arr.length-1)/2)*4,curve:i<(arr.length/2)?-1:1,damageMul:shotNo%3===0?.56:.72,special:'chronoCurve'}));
  }else if(cannon==='void'){
    shots=[{angle:a,side:0,curve:0,damageMul:shotNo%4===0?1.35:1,special:shotNo%4===0?'voidPulse':'voidGravity'}];

  // 갤럭시
  }else if(cannon==='nova'){
    shots=[-.10,0,.10].map(v=>({angle:a+v,side:0,curve:Math.sign(v),damageMul:.78,special:'nebulaCarrier'}));
  }else if(cannon==='comet'){
    shots=shotNo%5===0
      ?[-.10,0,.10].map((v,i)=>({angle:a+v,side:0,curve:i-1,damageMul:.70,special:'cometTriple'}))
      :[{angle:a,side:0,curve:0,damageMul:1,special:'cometAccel'}];
  }else if(cannon==='stellar'){
    const arr=shotNo%6===0?[-.16,-.08,0,.08,.16]:[-.055,.055];
    shots=arr.map((v,i)=>({angle:a+v,side:0,curve:i<(arr.length/2)?-1:1,damageMul:shotNo%6===0?.42:.66,special:'stellarWave'}));

  // ERROR
  }else if(cannon==='error'){
    shots=shotNo%5===0?[
      {angle:a-.18,side:-8,curve:-1,damageMul:.55,special:'nullEcho'},
      {angle:a-.09,side:-4,curve:-1,damageMul:.72,special:'nullEcho'},
      {angle:a,side:0,curve:0,damageMul:1.65,special:'nullCore'},
      {angle:a+.09,side:4,curve:1,damageMul:.72,special:'nullEcho'},
      {angle:a+.18,side:8,curve:1,damageMul:.55,special:'nullEcho'}
    ]:[{angle:a,side:0,curve:shotNo%2?-1:1,damageMul:1,special:'errorGlitch'}];
  }else if(cannon==='glitch'){
    const arr=shotNo%6===0?[-.18,-.12,-.06,0,.06,.12,.18]:[-.045,.045];
    shots=arr.map((v,i)=>({angle:a+v,side:0,curve:i%2?-1:1,damageMul:shotNo%6===0?.35:.62,special:'glitchPacket'}));
  }else if(cannon==='zero'){
    shots=shotNo%4===0
      ?[{angle:a-.055,side:-5,curve:0,damageMul:.62,special:'zeroEcho'},{angle:a,side:0,curve:0,damageMul:1.20,special:'zeroCore'},{angle:a+.055,side:5,curve:0,damageMul:.62,special:'zeroEcho'}]
      :[{angle:a,side:0,curve:0,damageMul:1,special:'zeroStraight'}];  }else if(cannon==='deku'){
    const faJinBoost=performance.now()<(e.dekuFaJinUntil||0);
    const smash=shotNo%5===0;
    shots=[{angle:a,side:0,curve:0,damageMul:smash?2.40:1,special:faJinBoost?(smash?'faJinDetroitAirSmash':'faJinAirForce'):(smash?'detroitAirSmash':'airForce')}];
  }

  for(let shotIndex=0;shotIndex<shots.length;shotIndex++){
    const shot=shots[shotIndex];
    const sa=shot.angle,px=-Math.sin(sa)*shot.side,py=Math.cos(sa)*shot.side;
    const b={
      x:e.x+Math.cos(sa)*(e.r+18)+px,y:e.y+Math.sin(sa)*(e.r+18)+py,
      vx:Math.cos(sa)*p.bulletSpeed+e.vx*.18,vy:Math.sin(sa)*p.bulletSpeed+e.vy*.18,
      r:6,damage:p.damage*shot.damageMul,life:1.65,
      owner:e,ownerId:onlineSelfId,team:'player',cannon,shape:projectileShapeForCannon(cannon),
      pierce:1,splashRadius:0,basicAttack:true,special:shot.special||'',fragment:false,
      curve:Number(shot.curve)||0,motionSeed:(shotNo*1.731+shotIndex*2.317+cannon.length*.713)%TAU,motionAge:0,
      hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
    };

    // 캐릭터별 탄환 물리값
    if(cannon==='standard'){b.r=6;b.life=1.65}
    else if(cannon==='scout'){b.r=5;b.life=1.55;b.vx*=1.08;b.vy*=1.08}
    else if(cannon==='bastion'){b.r=10;b.life=2.15;b.pierce=shot.special==='bastionCore'?3:1;b.splashRadius=shot.special==='bastionCore'?52:28}
    else if(cannon==='rapid'){b.r=3.5;b.life=1.28}
    else if(cannon==='dual'){b.r=5;b.life=1.42}
    else if(cannon==='needle'){b.r=3;b.life=1.65;b.pierce=shot.special==='needleCore'?4:2}
    else if(cannon==='spread'){b.r=4;b.life=.95}
    else if(cannon==='burst'){b.r=5;b.life=1.18}
    else if(cannon==='crystal'){b.r=5;b.life=1.20;b.pierce=2}
    else if(cannon==='piercer'){b.r=5;b.life=1.78;b.pierce=4}
    else if(cannon==='laser'){b.r=4;b.life=1.50;b.pierce=shot.special==='laserCore'?10:5}
    else if(cannon==='drill'){b.r=shot.special==='drillCore'?11:8;b.life=shot.special==='drillCore'?2.25:1.95;b.pierce=shot.special==='drillCore'?16:8}
    else if(cannon==='plasma'){b.r=13;b.life=2.15;b.splashRadius=72}
    else if(cannon==='thunder'){b.r=10;b.life=2.05;b.splashRadius=62}
    else if(cannon==='inferno'){b.r=10;b.life=2.12;b.splashRadius=100}
    else if(cannon==='rocket'){b.r=8;b.life=2.22;b.splashRadius=112}
    else if(cannon==='titan'){b.r=12;b.life=2.55;b.splashRadius=138}
    else if(cannon==='phantom'){b.r=6;b.life=1.90;b.pierce=6}
    else if(cannon==='ring'){b.r=12;b.life=1.85;b.pierce=8}
    else if(cannon==='chrono'){b.r=10;b.life=2.0;b.pierce=9}
    else if(cannon==='void'){b.r=12;b.life=2.10;b.pierce=4;b.splashRadius=72}
    else if(cannon==='nova'){b.r=10;b.life=1.90;b.pierce=3;b.splashRadius=46}
    else if(cannon==='comet'){b.r=8;b.life=2.08;b.pierce=4;b.splashRadius=52}
    else if(cannon==='stellar'){b.r=9;b.life=2.02;b.pierce=4;b.splashRadius=58}
    else if(cannon==='error'){
      b.r=9;b.life=2.30;b.pierce=16;
      if(shot.special==='nullCore'){b.r=13;b.life=2.65;b.pierce=24;b.vx*=1.10;b.vy*=1.10}
      else if(shot.special==='nullEcho'){b.r=8;b.life=2.35;b.pierce=18;b.vx*=1.05;b.vy*=1.05}
    }
    else if(cannon==='glitch'){b.r=8;b.life=2.15;b.pierce=14}
    else if(cannon==='zero'){b.r=shot.special==='zeroCore'?13:10;b.life=2.5;b.pierce=shot.special==='zeroCore'?26:20;if(shot.special==='zeroCore'){b.vx*=1.12;b.vy*=1.12}}
    else if(cannon==='deku'){const smash=String(shot.special||'').includes('DetroitAirSmash')||shot.special==='detroitAirSmash';b.r=smash?12:7;b.life=1.75;b.pierce=smash?8:3;b.splashRadius=smash?95:28;if(smash){b.vx*=1.18;b.vy*=1.18}}

    if(bullets.length>=MAX_BULLETS)bullets.shift();bullets.push(b);broadcastShot(b);spawnAttackFx(cannon,b.x,b.y,fxAngleFromVector(b.vx,b.vy,sa));
    if(cannon==='deku'&&String(b.special||'').startsWith('faJin'))spawnCombatFx('dekuFaJinAttack',b.x,b.y,{angle:fxAngleFromVector(b.vx,b.vy,sa),color:'#69f5ee',life:.38,radius:String(b.special||'').includes('Detroit')?105:76,cannon:'deku',variant:'faJin'});
  }

  const recoil={
    standard:12,scout:7,bastion:24,rapid:5,dual:8,needle:6,
    spread:13,burst:10,crystal:11,piercer:15,laser:10,drill:20,
    plasma:16,thunder:13,inferno:18,rocket:22,titan:30,phantom:9,
    ring:13,chrono:10,void:17,nova:17,comet:10,stellar:16,
    error:27,glitch:18,zero:30,deku:14
  }[cannon]||12;
  e.vx-=Math.cos(a)*recoil;e.vy-=Math.sin(a)*recoil;
}
function burst(x,y,color,count=8){
  if(particles.length>=MAX_PARTICLES)return;
  const budget=MAX_PARTICLES-particles.length;
  count=Math.min(count,budget,renderPressure>=2?Math.ceil(count*.28):renderPressure>=1?Math.ceil(count*.48):particles.length>260?Math.ceil(count*.62):count);
  for(let i=0;i<count;i++){
    const a=rand(0,TAU),sp=rand(45,180);
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.28,.7),color,r:rand(2,5)});
  }
}
function applySplashDamage(b,x,y){
  if(!b.splashRadius||b.team!=='player')return;
  if(b.basicAttack&&['rocket','inferno'].includes(b.cannon))createRocketBurnZone(b,x,y);
  const radius=b.splashRadius,r2=radius*radius,base=b.damage*(b.cannon==='rocket'?.72:.58);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;if(d2>r2)continue;
    const scale=1-Math.sqrt(d2)/radius;
    const[nx,ny]=norm(dx||1,dy||0);
    applyShapeDamage(s,base*(.35+.65*scale),nx*110*scale,ny*110*scale);
    if(s.hp<=0){
      if(b.owner===player)gainXp(s.xp);
      burst(s.x,s.y,colorForShape(s.type),10);
      shapes.splice(i,1);
    }
  }
  for(const enemy of remotePlayers.values()){
    if(!enemy.alive)continue;
    const dx=enemy.x-x,dy=enemy.y-y,d2=dx*dx+dy*dy;
    if(d2>r2)continue;
    const scale=1-Math.sqrt(d2)/radius;
    sendDamage(enemy.id,base*(.35+.65*scale));
  }
  burst(x,y,b.cannon==='rocket'?'#ffb55f':'#69e6ff',b.cannon==='rocket'?22:14);
  shake=Math.max(shake,b.cannon==='rocket'?8:4);
}

function shapeContactDamage(s){
  if(s.centralCluster)return 15;
  if(s.type==='pentagon')return 12;
  if(s.type==='triangle')return 8;
  return 5;
}
function handleShapeContact(){
  if(!player?.alive)return;
  const now=performance.now();
  let hitShape=null,hitDamage=0;

  for(const s of shapes){
    const dx=player.x-s.x,dy=player.y-s.y;
    const minDist=player.r+s.r;
    const d2=dx*dx+dy*dy;
    if(d2>=minDist*minDist)continue;

    const d=Math.sqrt(d2)||.001;
    const nx=dx/d,ny=dy/d;
    const overlap=minDist-d;

    // 겹쳐진 탱크와 도형을 분리하고 충돌감을 준다.
    player.x=clamp(player.x+nx*overlap*.58,player.r,WORLD-player.r);
    player.y=clamp(player.y+ny*overlap*.58,player.r,WORLD-player.r);
    player.vx+=nx*72;
    player.vy+=ny*72;
    reportShapeImpulse(s,-nx*95,-ny*95);

    const dmg=shapeContactDamage(s);
    if(dmg>hitDamage){
      hitDamage=dmg;
      hitShape=s;
    }
  }

  // 중앙의 많은 오각형과 동시에 겹쳐도 한 프레임에 피해가 수십 번 중첩되지 않게 한다.
  if(!hitShape||player.shapeContactCd>0)return;
  if(now<(player.phaseUntil||0))return;

  let damage=hitDamage;
  if(now<(player.fortressUntil||0))damage*=.30;

  player.hp=Math.max(0,Math.max(0,Number(player.hp)||0)-damage);
  player.regenTimer=0;
  player.shapeContactCd=.34;
  burst(player.x,player.y,hitShape.centralCluster?'#8ca6ff':colorForShape(hitShape.type),7);
  shake=Math.max(shake,4);

  if(player.hp<=0&&!tryStellarRevive())killPlayer('');
}


function recordPlayerHistory(){
  if(!player?.alive)return;
  const now=performance.now();
  const lastItem=playerHistory[playerHistory.length-1];
  if(lastItem&&now-lastItem.t<160)return;
  playerHistory.push({t:now,x:player.x,y:player.y,hp:player.hp,vx:player.vx,vy:player.vy});
  while(playerHistory.length&&now-playerHistory[0].t>6500)playerHistory.shift();
}
function getRewindState(msAgo=4000){
  if(!playerHistory.length)return null;
  const target=performance.now()-msAgo;
  let best=playerHistory[0];
  for(const item of playerHistory){if(Math.abs(item.t-target)<Math.abs(best.t-target))best=item}
  return best;
}

function updatePlayer(dt){if(!player.alive)return;refreshRealTimeSkillCooldowns();player.shapeContactCd=Math.max(0,(player.shapeContactCd||0)-dt);const p=playerParams(),stunned=performance.now()<(player.stunUntil||0);let mx=stunned?0:input.moveX,my=stunned?0:input.moveY;if(input.keys.has('KeyA')||input.keys.has('ArrowLeft'))mx-=1;if(input.keys.has('KeyD')||input.keys.has('ArrowRight'))mx+=1;if(input.keys.has('KeyW')||input.keys.has('ArrowUp'))my-=1;if(input.keys.has('KeyS')||input.keys.has('ArrowDown'))my+=1;if(mx||my){[mx,my]=norm(mx,my);player.vx+=mx*p.move*dt*5.2;player.vy+=my*p.move*dt*5.2}const normalAimAngle=Math.atan2(camera.y+input.mouseY-player.y,camera.x+input.mouseX-player.x);
player.angle=heldSkillAim.active&&Number.isFinite(heldSkillAim.angle)?heldSkillAim.angle:normalAimAngle;let sp=Math.hypot(player.vx,player.vy);if(sp>p.move){player.vx=player.vx/sp*p.move;player.vy=player.vy/sp*p.move}player.x=clamp(player.x+player.vx*dt,player.r,WORLD-player.r);player.y=clamp(player.y+player.vy*dt,player.r,WORLD-player.r);player.vx*=Math.pow(.0006,dt);player.vy*=Math.pow(.0006,dt);player.fireCd=Math.max(0,player.fireCd-dt);if(!stunned&&(input.firing||input.keys.has('Space')))fire(player);handleShapeContact();if(player.hp<player.maxHp){player.regenTimer+=dt;if(player.regenTimer>3.8)player.hp=Math.min(player.maxHp,player.hp+(1.4+player.stats.regen*1.1)*dt)}else player.regenTimer=0}recordPlayerHistory()
function updateShapes(dt){
  const host=isWorldHost();

  for(const s of shapes){
    s.spawnAge=(s.spawnAge||0)+dt;
    if((s.stunUntil||0)>performance.now()){s.vx=0;s.vy=0;continue}
    s.angle+=s.spin*dt;
    s.x=clamp(s.x+s.vx*dt,s.r,WORLD-s.r);
    s.y=clamp(s.y+s.vy*dt,s.r,WORLD-s.r);
    s.vx*=Math.pow(.05,dt);
    s.vy*=Math.pow(.05,dt);

    // V5.44: 이전 버전에서 넘겨받은 중앙 군집 표시가 있으면
    // 새 호스트가 한 번만 일반 월드 위치로 풀어준다.
    if(host&&s.centralCluster){
      const pos=chooseNormalSpawnPoint(false);
      s.x=pos.x;
      s.y=pos.y;
      s.vx=0;
      s.vy=0;
      s.centralCluster=false;
      s.spawnAge=0;
    }
  }

  if(!host)return;

  const normalCount=shapes.length;

  normalSpawnTimer-=dt;
  localRebalanceTimer-=dt;

  if(normalCount<NORMAL_SHAPE_TARGET&&normalSpawnTimer<=0){
    const amount=Math.min(NORMAL_SPAWN_BATCH,NORMAL_SHAPE_TARGET-normalCount);
    for(let i=0;i<amount;i++)spawnShape();
    normalSpawnTimer=NORMAL_SPAWN_INTERVAL;
  }

  // 중앙도 다른 지역과 동일하다.
  // 플레이어 위치 주변 밀도 보정 외에는 특정 좌표에 별도 스폰을 하지 않는다.
  if(localRebalanceTimer<=0){
    ensureLocalShapeDensity();
    localRebalanceTimer=LOCAL_REBALANCE_INTERVAL;
  }
}
function makeRunId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
function currentRunSnapshot(){
  if(!player?.runId)return null;
  return {
    runId:player.runId,
    pilotName:player.name,
    level:player.level,
    score:player.score,
    kills:player.kills
  };
}
async function saveCurrentRun(finish=false){
  const snap=currentRunSnapshot();
  if(!snap)return null;
  if(runSaveBusy&&!finish)return null;
  runSaveBusy=true;
  try{
    const fn=finish?window.IronCellAuth?.finishRun:window.IronCellAuth?.saveRunProgress;
    return await fn?.(snap);
  }catch(err){
    console.warn('Run reward save failed:',err);
    return null;
  }finally{
    runSaveBusy=false;
  }
}
async function leaveBattleToLobby(){
  if(!running){
    window.IronCellAuth?.showLobby?.();
    return;
  }

  const wasAlive=!!player?.alive;
  running=false;
  input.firing=false;
  input.mobileAimActive=false;
  cancelHeldSkillAim();
  input.keys.clear();

  if(ui.leaveBattleBtn){
    ui.leaveBattleBtn.disabled=true;
    ui.leaveBattleBtn.textContent='정산 중...';
  }

  // 서버 정산 성공을 확인한 뒤에만 실제로 전투방을 나간다.
  // 일시적인 통신 지연이 있으면 최대 3회 재시도한다.
  let saved=null;
  for(let attempt=0;attempt<3;attempt++){
    saved=await saveCurrentRun(true);
    if(saved && !saved.error)break;
    await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }

  if(!saved || saved.error){
    running=true;
    if(player)player.alive=wasAlive;
    if(ui.leaveBattleBtn){
      ui.leaveBattleBtn.disabled=false;
      ui.leaveBattleBtn.textContent='나가기';
    }

    const raw=String(saved?.error?.message||saved?.error?.code||'unknown_error');
    let reason='서버 정산 오류';
    const lower=raw.toLowerCase();
    if(lower.includes('iron_cell_account_required')||lower.includes('account_required')){
      reason='sworder VS tank 전용 계정으로 다시 로그인하거나 회원가입해 주세요.';
    }else if(lower.includes('session')||lower.includes('jwt')||lower.includes('not_authenticated')){
      reason='로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
    }else if(lower.includes('fetch')||lower.includes('network')){
      reason='서버 연결에 실패했습니다.';
    }

    alert(`점수 정산에 실패했습니다.\n${reason}\n\n오류: ${raw}`);
    return;
  }

  if(player?.alive){
    player.alive=false;
    broadcastLocalState(true);
  }

  await disconnectOnlineArena();
  window.IronCellAuth?.showLobby?.();

  if(ui.leaveBattleBtn){
    ui.leaveBattleBtn.disabled=false;
    ui.leaveBattleBtn.textContent='나가기';
  }
}
function killPlayer(killerId=''){
  if(!player.alive)return;
  player.alive=false;
  player.hp=0;
  broadcastLocalState(true);
  if(killerId){
    sendOnline('kill',{
      killerId:String(killerId),
      victimId:onlineSelfId,
      victimLevel:player.level,
      victimName:player.name
    });
  }
  ui.deathLevel.textContent=player.level;
  ui.deathScore.textContent=player.score.toLocaleString();
  ui.deathKills.textContent=player.kills;
  if(ui.deathGems)ui.deathGems.textContent=(player.score*2).toLocaleString();
  ui.deathScreen.classList.add('show');
  void saveCurrentRun(true);
}

function pointSegmentDistanceSq(px,py,ax,ay,bx,by){
  const abx=bx-ax,aby=by-ay,apx=px-ax,apy=py-ay;
  const len2=abx*abx+aby*aby;
  if(len2<=.0001)return apx*apx+apy*apy;
  const t=clamp((apx*abx+apy*aby)/len2,0,1);
  const qx=ax+abx*t,qy=ay+aby*t,dx=px-qx,dy=py-qy;
  return dx*dx+dy*dy;
}
function plasmaTetherOwner(b){
  if(b.owner===player)return player;
  const id=String(b.ownerId||'');
  return id?remotePlayers.get(id)||null:null;
}
function plasmaTetherStart(owner){
  const a=Number.isFinite(owner?.angle)?owner.angle:0;
  const r=Number.isFinite(owner?.r)?owner.r:27;
  return [owner.x+Math.cos(a)*(r+17),owner.y+Math.sin(a)*(r+17)];
}
function updatePlasmaTetherDamage(b,now){
  if(!['plasma','thunder'].includes(b.cannon)||b.networkRemote||b.owner!==player||!player?.alive)return;
  const [ax,ay]=plasmaTetherStart(player),bx=b.x,by=b.y;
  const lineRadius=9;
  const tickMs=180;
  const damage=Math.max(1,b.damage*.22);
  b.tetherHits ||= new Map();

  // Neutral shapes can also be electrocuted by touching the live cable.
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
    const rr=s.r+lineRadius;
    if(pointSegmentDistanceSq(s.x,s.y,ax,ay,bx,by)>rr*rr)continue;
    const key=`shape:${s.id||i}`;
    const lastHit=b.tetherHits.get(key)||0;
    if(now-lastHit<tickMs)continue;
    b.tetherHits.set(key,now);
    applyShapeDamage(s,damage);
    burst(s.x,s.y,'#86f5ff',3);
    if(s.hp<=0){
      gainXp(s.xp);
      burst(s.x,s.y,colorForShape(s.type),10);
      shapes.splice(i,1);
    }
  }

  // PvP damage is decided by the shooter's client, like the normal projectile hit.
  for(const enemy of remotePlayers.values()){
    if(!enemy.alive)continue;
    const rr=(enemy.r||27)+lineRadius;
    if(pointSegmentDistanceSq(enemy.x,enemy.y,ax,ay,bx,by)>rr*rr)continue;
    const key=`player:${enemy.id}`;
    const lastHit=b.tetherHits.get(key)||0;
    if(now-lastHit<tickMs)continue;
    b.tetherHits.set(key,now);
    sendDamage(enemy.id,damage);
    burst(enemy.x,enemy.y,'#87f5ff',4);
  }
}


function bendProjectileVelocity(b,radians){
  if(!radians)return;
  const c=Math.cos(radians),s=Math.sin(radians),vx=b.vx,vy=b.vy;
  b.vx=vx*c-vy*s;b.vy=vx*s+vy*c;
}
function applyUniqueProjectileMotion(b,dt){
  if(!b)return;
  b.motionAge=(Number(b.motionAge)||0)+dt;
  const t=b.motionAge,seed=Number(b.motionSeed)||0;
  const speed=Math.max(1,Math.hypot(b.vx,b.vy));
  const nx=-b.vy/speed,ny=b.vx/speed;
  const curve=Number(b.curve)||0;

  switch(b.cannon){
    case 'standard': break; // 완전 직선 기준탄
    case 'scout': { // 좌우로 날렵하게 흔들리는 화살탄
      const f=Math.sin(t*15+seed)*70;
      b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'bastion': { // 묵직한 포탄: 비행하며 약간 감속
      const k=Math.max(.985,1-.09*dt);b.vx*=k;b.vy*=k;break;
    }
    case 'rapid': { // 기관포: 작은 고주파 진동
      const f=Math.sin(t*32+seed)*32;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'dual': { // 양 포신 탄환이 서로 바깥쪽으로 갈라짐
      bendProjectileVelocity(b,curve*.16*dt);break;
    }
    case 'needle': { // 니들: 계속 가속
      const k=1+.34*dt;b.vx*=k;b.vy*=k;break;
    }
    case 'spread': { // 산탄: 멀어질수록 살짝 퍼짐
      bendProjectileVelocity(b,curve*.28*dt);break;
    }
    case 'burst': { // 버스트 원반: 부드러운 S자
      const f=Math.sin(t*11+seed)*48;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'crystal': { // 결정탄: 일정 방향으로 휘어짐
      bendProjectileVelocity(b,(curve||1)*.20*dt);break;
    }
    case 'piercer': break; // 관통 시 가속은 충돌 루틴에서 처리
    case 'laser': break;   // 완전 직선 초고속 2연장 레이저
    case 'drill': { // 드릴: 나선형 흔들림
      const f=Math.sin(t*18+seed)*85;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'plasma': { // 플라즈마: 느린 맥동 궤도
      const f=Math.sin(t*7+seed)*28;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'thunder': { // 번개구체: 강한 지그재그
      const f=Math.sin(t*26+seed)*145;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'inferno': { // 화염탄: 불꽃처럼 흔들림
      const f=Math.sin(t*9+seed)*58;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'rocket': { // 미사일: 계속 가속
      const k=1+.28*dt;b.vx*=k;b.vy*=k;break;
    }
    case 'titan': break; // 중포탄은 무겁고 곧게
    case 'phantom': { // 팬텀: 위상 S자 이동
      const f=Math.sin(t*13+seed)*105;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'ring': break; // 후반부 사용자에게 귀환
    case 'chrono': { // 시간링: 좌/우 반대 곡선
      bendProjectileVelocity(b,(curve||1)*.42*dt);break;
    }
    case 'void': { // 보이드: 이동 중 주변 도형을 끌어당김
      if(!b.networkRemote&&b.basicAttack){
        b.voidPullTick=(b.voidPullTick||0)-dt;
        if(b.voidPullTick<=0){
          b.voidPullTick=.12;
          for(const s of shapes){
            const dx=b.x-s.x,dy=b.y-s.y,d2=dx*dx+dy*dy;
            if(d2>165*165||d2<16)continue;
            const d=Math.sqrt(d2),force=(1-d/165)*42;
            reportShapeImpulse(s,dx/d*force,dy/d*force);
          }
        }
      }
      break;
    }
    case 'nova': break; // 명중 시 별 파편 분열
    case 'comet': { // 혜성: 비행할수록 강하게 가속
      const k=1+.52*dt;b.vx*=k;b.vy*=k;break;
    }
    case 'stellar': { // 별빛 쌍성: 서로 물결치듯 이동
      const f=Math.sin(t*8+seed)*52*(curve||1);b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'error': { // ERROR: 작은 RGB 글리치 흔들림
      const f=Math.sin(t*21+seed)*92;b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'glitch': { // GLITCH-13: 가장 불규칙한 패킷 지그재그
      const f=(Math.sin(t*29+seed)+Math.sin(t*17+seed*1.7))*.5*175;
      b.vx+=nx*f*dt;b.vy+=ny*f*dt;break;
    }
    case 'zero': { // ZERO: 궤도 흔들림 없는 강제 직선
      break;
    }
  }
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.life-=dt;
    applyUniqueProjectileMotion(b,dt);
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    maybeReturnRingBullet(b);
    if(b.life<=0||b.x<0||b.y<0||b.x>WORLD||b.y>WORLD){
      if(!b.networkRemote)broadcastShotEnd(b);
      bullets.splice(i,1);continue;
    }

    if(b.shape==='plasma')updatePlasmaTetherDamage(b,performance.now());

    // Other players' bullets are visual replicas.
    // The shooter's client sends authoritative hit messages.
    if(b.networkRemote)continue;

    let remove=false;

    for(let j=shapes.length-1;j>=0&&!remove;j--){
      const s=shapes[j];
      if(b.hitTargets?.has(s))continue;
      const rr=b.r+s.r;
      if((b.x-s.x)**2+(b.y-s.y)**2<rr*rr){
        b.hitTargets?.add(s);
        const[nx,ny]=norm(b.vx,b.vy);
        applyShapeDamage(s,b.damage,nx*75,ny*75);
        burst(b.x,b.y,colorForShape(s.type),3);
        if(b.basicAttack&&b.cannon==='spread')spawnSpreadFragments(b,b.x,b.y);
        if(b.basicAttack&&b.cannon==='nova')spawnNovaFragments(b,b.x,b.y);
        if(b.basicAttack&&['plasma','thunder'].includes(b.cannon))chainPlasmaBasicHit(b,b.x,b.y,s,'');
        if(b.basicAttack&&cannonFamily(b.cannon)==='error')errorGlitchImpact(b,b.x,b.y,s,'');
        if(s.hp<=0){
          if(b.owner===player)gainXp(s.xp);
          shapes.splice(j,1);
          burst(s.x,s.y,colorForShape(s.type),10);
        }
        if(b.splashRadius){
          applySplashDamage(b,b.x,b.y);remove=true;
        }else if((b.pierce||1)>1){
          b.pierce--;
          if(b.basicAttack&&b.cannon==='piercer'){
            b.damage*=1.08;b.vx*=1.04;b.vy*=1.04;
            broadcastShotSync(b);
            spawnCombatFx('pierceAccel',b.x,b.y,{angle:Math.atan2(b.vy,b.vx),color:'#c8a8ff',life:.24,radius:28,cannon:'piercer'});
          }else if(b.basicAttack&&cannonFamily(b.cannon)==='error'){
            b.damage*=1.04;b.vx*=1.02;b.vy*=1.02;
            broadcastShotSync(b);
            spawnCombatFx('errorPierce',b.x,b.y,{angle:Math.atan2(b.vy,b.vx),color:'#72ff43',life:.20,radius:30,cannon:'error'});
          }else b.damage*=.88;
        }else remove=true;
      }
    }

    if(!remove&&b.team==='player'){
      for(const enemy of remotePlayers.values()){
        if(!enemy.alive||b.hitIds?.has(enemy.id))continue;
        const rr=b.r+(enemy.r||27);
        if((b.x-enemy.x)**2+(b.y-enemy.y)**2<rr*rr){
          b.hitIds?.add(enemy.id);
          sendDamage(enemy.id,b.damage);
          burst(b.x,b.y,'#ff8a8a',4);
          if(b.basicAttack&&b.cannon==='spread')spawnSpreadFragments(b,b.x,b.y);
          if(b.basicAttack&&b.cannon==='nova')spawnNovaFragments(b,b.x,b.y);
          if(b.basicAttack&&['plasma','thunder'].includes(b.cannon))chainPlasmaBasicHit(b,b.x,b.y,null,enemy.id);
          if(b.basicAttack&&cannonFamily(b.cannon)==='error')errorGlitchImpact(b,b.x,b.y,null,enemy.id);
          if(b.splashRadius){
            applySplashDamage(b,b.x,b.y);remove=true;
          }else if((b.pierce||1)>1){
            b.pierce--;
            if(b.basicAttack&&b.cannon==='piercer'){
            b.damage*=1.08;b.vx*=1.04;b.vy*=1.04;
            broadcastShotSync(b);
            spawnCombatFx('pierceAccel',b.x,b.y,{angle:Math.atan2(b.vy,b.vx),color:'#c8a8ff',life:.24,radius:28,cannon:'piercer'});
          }else if(b.basicAttack&&b.cannon==='error'){
            b.damage*=1.04;b.vx*=1.02;b.vy*=1.02;
            broadcastShotSync(b);
            spawnCombatFx('errorPierce',b.x,b.y,{angle:Math.atan2(b.vy,b.vx),color:'#72ff43',life:.20,radius:30,cannon:'error'});
          }else b.damage*=.88;
          }else remove=true;
          break;
        }
      }
    }

    if(remove){if(!b.networkRemote)broadcastShotEnd(b);bullets.splice(i,1)}
  }
}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.04,dt);p.vy*=Math.pow(.04,dt)}}
function updateCombatFx(dt){for(let i=combatFx.length-1;i>=0;i--){combatFx[i].life-=dt;if(combatFx[i].life<=0)combatFx.splice(i,1)}}
function updateSkillZones(dt){
  const now=performance.now();
  for(let zi=skillZones.length-1;zi>=0;zi--){
    const z=skillZones[zi];z.life-=dt;
    if(z.life<=0){skillZones.splice(zi,1);continue}
    if(z.networkRemote)continue;
    const elapsed=z.maxLife-z.life;

    if(z.type==='artillery'){
      if(!z.triggered&&z.life<.15){z.triggered=true;skillAreaDamage(z.x,z.y,z.radius,z.damage,'#8fd5ff');burst(z.x,z.y,'#dff7ff',40);shake=Math.max(shake,15)}
      continue;
    }
    if(z.type==='burstBomb'){
      if(!z.triggered&&z.life<(z.data.detonateAt||.10)){
        z.triggered=true;
        skillAreaDamage(z.x,z.y,z.radius,z.damage,'#67efff');
        for(let k=0;k<16;k++){
          spawnSkillProjectileAt('burst',z.x,z.y,k*TAU/16,{damageMul:.48,speedMul:1.18,life:1.55,pierce:2,r:6,shape:'burstDisc',special:'burstBombShard',curve:k%2?-1:1});
        }
        burst(z.x,z.y,'#9dfaff',38);shake=Math.max(shake,13);
      }
      continue;
    }
    if(z.type==='crystalPrism'){
      z.data.seen=z.data.seen||new Set();
      for(const b of [...bullets]){
        if(b.networkRemote||b.team!=='player'||b.cannon!=='crystal'||b.fragment||b.prismClone)continue;
        const d2=(b.x-z.x)**2+(b.y-z.y)**2;
        if(d2>z.radius*z.radius||z.data.seen.has(b))continue;
        z.data.seen.add(b);b.prismSplit=true;
        const aa=Math.atan2(b.vy,b.vx),speed=Math.hypot(b.vx,b.vy);
        for(const off of [-.30,.30]){
          const c=spawnPassiveBullet({x:z.x,y:z.y,angle:aa+off,speed:speed*1.05,damage:b.damage*.72,life:Math.max(.6,b.life),r:5,cannon:'crystal',shape:'crystalShard',special:'prismClone',fragment:true});
          c.prismClone=true;c.curve=off<0?-1:1;
        }
        spawnCombatFx('prismFlash',z.x,z.y,{angle:aa,color:'#c9fbff',life:.35,radius:90,cannon:'crystal'});
      }
      continue;
    }
    if(z.type==='thunderStorm'){
      z.data.next=(z.data.next||0)-dt;
      if(z.data.next<=0){
        z.data.next=.38;z.data.strikes=(z.data.strikes||0)+1;
        let tx=z.x+rand(-z.radius*.85,z.radius*.85),ty=z.y+rand(-z.radius*.85,z.radius*.85),target=null,best=150*150;
        for(const s of shapes){const d2=(s.x-tx)**2+(s.y-ty)**2;if(d2<best&&Math.hypot(s.x-z.x,s.y-z.y)<z.radius){best=d2;target=s}}
        if(target){tx=target.x;ty=target.y;applyShapeDamage(target,z.damage);if(target.hp<=0){gainXp(target.xp)}}
        for(const e of remotePlayers.values()){if(!e.alive)continue;if((e.x-tx)**2+(e.y-ty)**2<75*75)sendDamage(e.id,z.damage*.85)}
        spawnCombatFx('skyLightning',tx,ty-260,{angle:Math.PI/2,color:'#fff36f',life:.34,radius:260,cannon:'thunder'});
        burst(tx,ty,'#fff37a',15);
      }
      continue;
    }
    if(z.type==='missileRain'){
      z.data.next=(z.data.next||0)-dt;
      if(z.data.next<=0){
        z.data.next=.32;z.data.count=(z.data.count||0)+1;
        const q=Math.random()*TAU,rr=Math.sqrt(Math.random())*z.radius*.88,mx=z.x+Math.cos(q)*rr,my=z.y+Math.sin(q)*rr;
        addSkillZone('missileMarker',{x:mx,y:my,radius:78,life:.48,damage:z.damage,data:{detonateAt:.08}});
      }
      continue;
    }
    if(z.type==='missileMarker'){
      if(!z.triggered&&z.life<(z.data.detonateAt||.08)){
        z.triggered=true;skillAreaDamage(z.x,z.y,z.radius,z.damage,'#ff9b4a');burst(z.x,z.y,'#ffb35c',20);shake=Math.max(shake,5);
      }
      continue;
    }
    if(z.type==='earthFissure'){
      z.data.next=(z.data.next||0)-dt;
      if((z.data.index||0)<(z.pulses||6)&&z.data.next<=0){
        const idx=z.data.index||0;z.data.index=idx+1;z.data.next=z.interval;
        const d=(idx+1)*z.length/(z.pulses||6),fx=z.x+Math.cos(z.angle)*d,fy=z.y+Math.sin(z.angle)*d;
        skillAreaDamage(fx,fy,z.width,z.damage*(1+.08*idx),'#ffc17a');
        for(const s of shapes){const dd=Math.hypot(s.x-fx,s.y-fy)||1;if(dd<z.width*1.15)reportShapeImpulse(s,Math.cos(z.angle)*190,Math.sin(z.angle)*190)}
        burst(fx,fy,'#ffc17a',22);
      }
      continue;
    }
    if(z.type==='ringGate'){
      z.data.seen=z.data.seen||new Set();
      for(const b of [...bullets]){
        if(b.networkRemote||b.team!=='player'||b.cannon!=='ring'||!b.basicAttack||b.gateClone||z.data.seen.has(b))continue;
        z.data.seen.add(b);
        const aa=Math.atan2(b.vy,b.vx),speed=Math.hypot(b.vx,b.vy);
        const c=spawnSkillProjectileAt('ring',z.x,z.y,aa,{damageMul:.72,speedMul:speed/Math.max(1,playerParams().bulletSpeed),life:Math.max(1,b.life),pierce:7,r:11,shape:'dimensionRing',special:'gateClone'});
        c.gateClone=true;
        spawnCombatFx('portalPulse',z.x,z.y,{angle:aa,color:'#d9c3ff',life:.30,radius:90,cannon:'ring'});
      }
      continue;
    }
    if(z.type==='constellation'){
      z.tick=(z.tick||0)-dt;
      if(z.tick<=0){
        z.tick=.25;
        const r=z.radius,ax=z.x,ay=z.y-r,bx=z.x-r*.866,by=z.y+r*.5,cx=z.x+r*.866,cy=z.y+r*.5;
        if(pointInTriangle(player.x,player.y,ax,ay,bx,by,cx,cy))player.hp=Math.min(player.maxHp,player.hp+(z.data.heal||player.maxHp*.02));
        for(let i=shapes.length-1;i>=0;i--){const s=shapes[i];if(!pointInTriangle(s.x,s.y,ax,ay,bx,by,cx,cy))continue;applyShapeDamage(s,z.damage);burst(s.x,s.y,'#e8ffff',3);if(s.hp<=0){gainXp(s.xp);shapes.splice(i,1)}}
        for(const e of remotePlayers.values()){if(e.alive&&pointInTriangle(e.x,e.y,ax,ay,bx,by,cx,cy))sendDamage(e.id,z.damage*.75)}
      }
      continue;
    }
    if(z.type==='secondStar'){
      z.x=player.x;z.y=player.y;
      if(!player.stellarReviveReady||performance.now()>(player.stellarReviveUntil||0))z.life=.01;
      continue;
    }
    if(z.type==='barrier'){
      const nx=-Math.sin(z.angle),ny=Math.cos(z.angle),half=z.length/2;
      for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(b.team!=='remote')continue;const relx=b.x-z.x,rely=b.y-z.y,along=relx*nx+rely*ny,depth=relx*Math.cos(z.angle)+rely*Math.sin(z.angle);if(Math.abs(along)<=half&&Math.abs(depth)<=z.width){bullets.splice(i,1);burst(b.x,b.y,'#b9ddff',5)}}
      continue;
    }
    if(z.type==='rapidOverdrive'){
      z.x=player.x;z.y=player.y;z.data.next=(z.data.next||0)-dt;
      if(z.data.next<=0){z.data.next=.075;spawnSkillProjectileAt('rapid',player.x+Math.cos(player.angle)*35,player.y+Math.sin(player.angle)*35,player.angle+rand(-.025,.025),{damageMul:.33,speedMul:1.55,life:1.2,r:3})}
      continue;
    }
    if(z.type==='twinDrones'){
      z.x=player.x;z.y=player.y;z.data.next=(z.data.next||0)-dt;
      if(z.data.next<=0){z.data.next=.36;const target=nearestSkillTarget(player.x,player.y,780);for(const side of [-1,1]){const q=now*.0018*side+side*Math.PI/2,x=player.x+Math.cos(q)*z.radius,y=player.y+Math.sin(q)*z.radius,aa=target?Math.atan2(target.y-y,target.x-x):player.angle;spawnSkillProjectileAt('dual',x,y,aa,{damageMul:.48,speedMul:1.18,life:1.8,r:5,curve:side})}}
      continue;
    }
    if(z.type==='needleMine'||z.type==='crystalMine'){
      const armed=elapsed>(z.data.armedAt||.6);if(!armed)continue;let trigger=z.life<.35;
      if(!trigger){for(const s of shapes){if((s.x-z.x)**2+(s.y-z.y)**2<(z.radius+s.r)**2){trigger=true;break}}}
      if(trigger&&!z.triggered){z.triggered=true;skillAreaDamage(z.x,z.y,z.type==='crystalMine'?115:85,z.damage,z.type==='crystalMine'?'#c9fbff':'#c8ff79');burst(z.x,z.y,z.type==='crystalMine'?'#c9fbff':'#c8ff79',18);z.life=.05}
      continue;
    }
    if(z.type==='pulseBurst'||z.type==='quake'){
      z.data.next=(z.data.next||0)-dt;if((z.data.index||0)<(z.pulses||3)&&z.data.next<=0){const idx=z.data.index||0;z.data.index=idx+1;z.data.next=z.interval;const radius=(z.type==='quake'?140:110)+(idx*(z.type==='quake'?95:75));skillAreaDamage(z.x,z.y,radius,z.damage*(1+.12*idx),z.type==='quake'?'#ffc17a':'#66efff');if(z.type==='quake'){for(const s of shapes){const dx=s.x-z.x,dy=s.y-z.y,d=Math.hypot(dx,dy)||1;if(d<radius)reportShapeImpulse(s,dx/d*140,dy/d*140)}}burst(z.x,z.y,z.type==='quake'?'#ffc17a':'#66efff',18)}
      continue;
    }
    if(z.type==='laserSweep'){
      z.x=player.x;z.y=player.y;z.data.next=(z.data.next||0)-dt;if(z.data.next<=0){z.data.next=.085;const q=clamp(elapsed/z.maxLife,0,1),aa=(z.data.start||0)+(z.data.span||1.7)*q;z.angle=aa;damageSkillLine(z.x,z.y,aa,z.radius,18,z.damage,'#efc9ff');}
      continue;
    }
    if(z.type==='plasmaCage'){
      z.tick=(z.tick||0)-dt;if(z.tick<=0){z.tick=.22;for(const s of shapes){const d=Math.hypot(s.x-z.x,s.y-z.y);if(d<z.radius&&d>z.radius*.58)applyShapeDamage(s,z.damage)}for(const e of remotePlayers.values()){if(!e.alive)continue;const d=Math.hypot(e.x-z.x,e.y-z.y);if(d<z.radius&&d>z.radius*.58)sendDamage(e.id,z.damage*.8)}}
      continue;
    }
    if(z.type==='flameWall'||z.type==='cometTrail'){
      z.tick=(z.tick||0)-dt;if(z.tick<=0){z.tick=.20;const x1=z.x-Math.cos(z.angle)*z.length/2,y1=z.y-Math.sin(z.angle)*z.length/2;damageSkillLine(x1,y1,z.angle,z.length,z.width/2,z.damage,z.type==='flameWall'?'#ff7048':'#73efff')}
      continue;
    }
    if(z.type==='phantomAssassinMark'){
      continue;
    }
    if(z.type==='orbitRing'||z.type==='starOrbit'){
      z.x=player.x;z.y=player.y;z.tick=(z.tick||0)-dt;if(z.tick<=0){z.tick=.16;const count=z.type==='starOrbit'?5:3;for(let k=0;k<count;k++){const q=now*.003*(k%2?1:-1)+k*TAU/count,ox=z.x+Math.cos(q)*z.radius,oy=z.y+Math.sin(q)*z.radius;skillAreaDamage(ox,oy,z.type==='starOrbit'?48:58,z.damage,z.type==='starOrbit'?'#8eefff':'#cfb3ff')}}continue;
    }
    if(z.type==='timeField'){
      for(const s of shapes){const dx=s.x-z.x,dy=s.y-z.y;if(dx*dx+dy*dy<=z.radius*z.radius){const ovx=s.vx,ovy=s.vy;s.vx*=Math.pow(.10,dt);s.vy*=Math.pow(.10,dt);if(Math.hypot(ovx-s.vx,ovy-s.vy)>3)reportShapeImpulse(s,s.vx-ovx,s.vy-ovy)}}
      for(const b of bullets){if(b.team==='remote'&&(b.x-z.x)**2+(b.y-z.y)**2<=z.radius*z.radius){b.vx*=Math.pow(.05,dt);b.vy*=Math.pow(.05,dt)}}continue;
    }
    if(z.type==='supernovaCore'){
      if(!z.triggered&&z.life<(z.data.detonateAt||.18)){z.triggered=true;skillAreaDamage(z.x,z.y,z.radius,z.damage,'#d9ffff');burst(z.x,z.y,'#ffffff',60);shake=Math.max(shake,22)}continue;
    }
    if(z.type==='sanctuary'){
      z.tick=(z.tick||0)-dt;if(z.tick<=0){z.tick=.32;if(Math.hypot(player.x-z.x,player.y-z.y)<=z.radius)player.hp=Math.min(player.maxHp,player.hp+(z.data.heal||player.maxHp*.02));skillAreaDamage(z.x,z.y,z.radius,z.damage,'#e7fbff')}continue;
    }
    if(z.type==='returnPortal'){
      if(!z.triggered&&z.life<(z.data.returnAt||.15)){z.triggered=true;if(Number.isFinite(z.originX)&&Number.isFinite(z.originY)){player.x=z.originX;player.y=z.originY;player.phaseUntil=now+500;broadcastLocalState(true)}}continue;
    }
    if(z.type==='cloneStorm'){
      z.x=player.x;z.y=player.y;z.data.next=(z.data.next||0)-dt;if(z.data.next<=0){z.data.next=.55;const target=nearestSkillTarget(player.x,player.y,800);for(let k=0;k<4;k++){const q=k*TAU/4+now*.001,x=player.x+Math.cos(q)*z.radius,y=player.y+Math.sin(q)*z.radius,aa=target?Math.atan2(target.y-y,target.x-x):player.angle;spawnSkillProjectileAt('glitch',x,y,aa,{damageMul:.38,speedMul:1.25,life:2.1,pierce:9,r:7,curve:k%2?-1:1})}}continue;
    }
    if(z.type==='absoluteZero'){
      z.tick=(z.tick||0)-dt;if(z.tick<=0){z.tick=.24;for(const s of shapes){const dx=s.x-z.x,dy=s.y-z.y;if(dx*dx+dy*dy<=z.radius*z.radius){reportShapeImpulse(s,-(s.vx||0)*.85,-(s.vy||0)*.85);applyShapeDamage(s,z.damage)}}for(const b of bullets){if(b.team==='remote'&&(b.x-z.x)**2+(b.y-z.y)**2<=z.radius*z.radius){b.vx*=.08;b.vy*=.08}}}continue;
    }
    if(z.type==='ironDome'){z.x=player.x;z.y=player.y;continue}
    if(z.type==='siegeAura'){
      z.x=player.x;z.y=player.y;z.data.next=(z.data.next||0)-dt;
      if(z.data.next<=0){
        z.data.next=.68;
        spawnSkillProjectileAt('titan',player.x+Math.cos(player.angle)*40,player.y+Math.sin(player.angle)*40,player.angle,{damageMul:.72,speedMul:.78,life:2.4,pierce:2,splashRadius:120,r:12,shape:'titanShell',special:'siegeAuto'});
        shake=Math.max(shake,3);
      }
      continue;
    }
    if(z.type==='specterCloak'){
      z.x=player.x;z.y=player.y;z.data.next=(z.data.next||0)-dt;
      if(performance.now()>=(player.cloakUntil||0)){z.life=.01;continue}
      if(z.data.next<=0){
        z.data.next=.18;
        spawnCombatFx('phantomAfterimage',player.x,player.y,{angle:player.angle,color:'#c9b8ff',life:.48,radius:72,cannon:'phantom'});
      }
      continue;
    }
    if(z.type==='ringParry'){
      z.x=player.x;z.y=player.y;z.tick=(z.tick||0)-dt;
      if(z.tick<=0){
        z.tick=.10;
        for(let i=bullets.length-1;i>=0;i--){
          const b=bullets[i];if(b.team!=='remote')continue;
          const dx=b.x-z.x,dy=b.y-z.y,d=Math.hypot(dx,dy);
          if(d>z.radius||d<z.radius*.42)continue;
          const speed=Math.max(360,Math.hypot(b.vx,b.vy)),aa=Math.atan2(-b.vy,-b.vx);
          bullets.splice(i,1);
          spawnPassiveBullet({x:b.x,y:b.y,angle:aa,speed,damage:playerParams().damage*.75,life:1.8,r:10,cannon:'ring',shape:'dimensionRing',special:'parryCounter',fragment:true,pierce:5});
          spawnCombatFx('ringParryFlash',b.x,b.y,{angle:aa,color:'#e4d3ff',life:.28,radius:55,cannon:'ring'});
        }
      }
      continue;
    }
    if(z.type==='rewindEcho'){continue}
    if(z.type==='antiMatter'){
      z.x=player.x;z.y=player.y;z.tick=(z.tick||0)-dt;
      if(z.tick<=0){
        z.tick=.16;

        // V5.38: iterate backwards so dead shapes are removed on the same tick.
        for(let i=shapes.length-1;i>=0;i--){
          const s=shapes[i];
          const dx=s.x-z.x,dy=s.y-z.y,d=Math.hypot(dx,dy)||1;
          if(d>z.radius)continue;

          const force=(1-d/z.radius)*330;
          reportShapeImpulse(s,dx/d*force,dy/d*force);

          if(applyShapeDamage(s,z.damage)){
            gainXp(s.xp);
            burst(s.x,s.y,colorForShape(s.type),10);
            shapes.splice(i,1);
          }
        }

        for(const b of bullets){
          if(b.team!=='remote')continue;
          const dx=b.x-z.x,dy=b.y-z.y,d=Math.hypot(dx,dy)||1;if(d>z.radius)continue;
          const force=(1-d/z.radius)*520;b.vx+=dx/d*force;b.vy+=dy/d*force;
        }
        for(const e of remotePlayers.values()){
          if(e.alive&&Math.hypot(e.x-z.x,e.y-z.y)<=z.radius)sendDamage(e.id,z.damage*.55);
        }
      }
      continue;
    }
    if(z.type==='cometShower'){
      z.data.next=(z.data.next||0)-dt;
      if(z.data.next<=0){
        z.data.next=.42;
        const aa=Math.random()*TAU,rr=Math.sqrt(Math.random())*z.radius*.86,ix=z.x+Math.cos(aa)*rr,iy=z.y+Math.sin(aa)*rr;
        skillAreaDamage(ix,iy,105,z.damage,'#7cefff');
        spawnCombatFx('cometImpact',ix-240,iy-240,{angle:Math.PI/4,color:'#76efff',life:.52,radius:340,cannon:'comet'});
        burst(ix,iy,'#9df8ff',22);
      }
      continue;
    }
    if(z.type==='glitchDriveAura'){z.x=player.x;z.y=player.y;if(performance.now()>(player.overclockUntil||0))z.life=.01;continue}
    if(z.type==='glitchWarpTrail'){
      z.data.next=(z.data.next||0)-dt;
      if((z.data.index||0)<(z.pulses||6)&&z.data.next<=0){
        const idx=z.data.index||0;z.data.index=idx+1;z.data.next=z.interval;
        const d=(idx+1)*z.length/(z.pulses||6),gx=z.x+Math.cos(z.angle)*d,gy=z.y+Math.sin(z.angle)*d;
        skillAreaDamage(gx,gy,z.width,z.damage*(1+.05*idx),idx%2?'#ff42df':'#42eaff');
        burst(gx,gy,idx%2?'#ff42df':'#42eaff',20);
      }
      continue;
    }

    // Existing gravity / burn zones.
    z.tick=(z.tick||0)-dt;const doTick=z.tick<=0;if(doTick)z.tick=z.type==='burn'?.25:.22;
    for(let i=shapes.length-1;i>=0;i--){const s=shapes[i],dx=z.x-s.x,dy=z.y-s.y,d=Math.hypot(dx,dy)||1;if(d>z.radius)continue;if(z.type==='gravity'){const force=(1-d/z.radius)*820;s.vx+=dx/d*force*dt;s.vy+=dy/d*force*dt;if(doTick&&onlineReady&&!isWorldHost()&&s.id)sendOnline('shapeImpulse',{hostId:worldHostId,shapeId:String(s.id),sourceId:onlineSelfId,dvx:dx/d*force*.18,dvy:dy/d*force*.18})}if(doTick){applyShapeDamage(s,z.damage);burst(s.x,s.y,z.type==='burn'?'#ff9a42':'#8da9ff',z.type==='burn'?3:2);if(s.hp<=0){gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),10);shapes.splice(i,1)}}}
    if(doTick)for(const enemy of remotePlayers.values()){if(!enemy.alive)continue;const dx=z.x-enemy.x,dy=z.y-enemy.y;if(dx*dx+dy*dy<=z.radius*z.radius)sendDamage(enemy.id,z.damage*(z.type==='burn'?1:.75))}
  }
}
function cameraUpdate(){const tx=player.x-innerWidth/2,ty=player.y-innerHeight/2;camera.x+=(tx-camera.x)*.12;camera.y+=(ty-camera.y)*.12;camera.x=clamp(camera.x,0,Math.max(0,WORLD-innerWidth));camera.y=clamp(camera.y,0,Math.max(0,WORLD-innerHeight))}
const worldToScreen=(x,y)=>[x-camera.x,y-camera.y];
function drawGrid(){ctx.fillStyle='#152235';ctx.fillRect(0,0,innerWidth,innerHeight);const sx=-(camera.x%GRID),sy=-(camera.y%GRID);ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1;ctx.beginPath();for(let x=sx;x<innerWidth;x+=GRID){ctx.moveTo(x,0);ctx.lineTo(x,innerHeight)}for(let y=sy;y<innerHeight;y+=GRID){ctx.moveTo(0,y);ctx.lineTo(innerWidth,y)}ctx.stroke()}
function polygon(x,y,r,sides,a){ctx.beginPath();for(let i=0;i<sides;i++){const q=a+i*TAU/sides,px=x+Math.cos(q)*r,py=y+Math.sin(q)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath()}
let renderPressure=0;
function updateRenderPressure(){
  const load=bullets.length+particles.length*.70+combatFx.length*1.6+skillZones.length*2.2;
  renderPressure=load>820?2:load>480?1:0;
}
function screenVisibleWorld(x,y,pad=100){
  const sx=x-camera.x,sy=y-camera.y;
  return sx>=-pad&&sy>=-pad&&sx<=innerWidth+pad&&sy<=innerHeight+pad;
}
function segmentMayTouchScreen(x1,y1,x2,y2,pad=120){
  const ax=x1-camera.x,ay=y1-camera.y,bx=x2-camera.x,by=y2-camera.y;
  if(ax<-pad&&bx<-pad)return false;
  if(ay<-pad&&by<-pad)return false;
  if(ax>innerWidth+pad&&bx>innerWidth+pad)return false;
  if(ay>innerHeight+pad&&by>innerHeight+pad)return false;
  return true;
}
function drawShape(s){const[x,y]=worldToScreen(s.x,s.y);if(x<-80||y<-80||x>innerWidth+80||y>innerHeight+80)return;const spawnP=clamp((s.spawnAge||0)/.34,0,1),ease=1-Math.pow(1-spawnP,3),rr=s.r*(.35+.65*ease);ctx.save();ctx.globalAlpha=.28+.72*ease;ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=renderPressure?0:10;ctx.shadowOffsetY=renderPressure?0:4;polygon(x,y,rr,s.sides,s.angle);ctx.fillStyle=colorForShape(s.type);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=edgeForShape(s.type);ctx.lineWidth=5;ctx.stroke();if(s.hp<s.maxHp){const w=s.r*1.6;ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-w/2,y+s.r+8,w,4);ctx.fillStyle='#7ee787';ctx.fillRect(x-w/2,y+s.r+8,w*(s.hp/s.maxHp),4)}ctx.restore()}
function drawCharacterMark(cannon,r){
  const marks={
    scout:['chevron','#bdf7ff'],bastion:['shield','#d8ecff'],
    dual:['double','#9dffe0'],needle:['needle','#d9ff9c'],
    burst:['bars','#8ff5ff'],crystal:['diamond','#d7fdff'],
    laser:['cross','#f1d2ff'],drill:['spiral','#c3adff'],
    thunder:['bolt','#fff59b'],inferno:['flame','#ffad79'],
    titan:['shield','#ffd399'],phantom:['diamond','#dfd4ff'],
    chrono:['clock','#c8f3ff'],void:['void','#b8a0ff'],
    comet:['tail','#9ef2ff'],stellar:['star','#ffffff'],
    glitch:['glitch','#ff70ea'],zero:['zero','#ffffff']
  };
  const m=marks[cannon];if(!m)return;
  const[kind,color]=m;ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.5;ctx.shadowColor=color;ctx.shadowBlur=8;
  if(kind==='chevron'){ctx.beginPath();ctx.moveTo(r*.1,-11);ctx.lineTo(r+22,0);ctx.lineTo(r*.1,11);ctx.stroke()}
  else if(kind==='shield'){ctx.beginPath();ctx.moveTo(r*.15,-12);ctx.lineTo(r+20,-8);ctx.lineTo(r+24,0);ctx.lineTo(r+20,8);ctx.lineTo(r*.15,12);ctx.stroke()}
  else if(kind==='double'){ctx.fillRect(r+13,-12,12,4);ctx.fillRect(r+13,8,12,4)}
  else if(kind==='needle'){ctx.beginPath();ctx.moveTo(r+6,-8);ctx.lineTo(r+31,0);ctx.lineTo(r+6,8);ctx.stroke()}
  else if(kind==='bars'){for(const y of [-10,0,10])ctx.fillRect(r+8,y-1,22,2)}
  else if(kind==='diamond'){ctx.beginPath();ctx.moveTo(r+13,-10);ctx.lineTo(r+25,0);ctx.lineTo(r+13,10);ctx.lineTo(r+2,0);ctx.closePath();ctx.stroke()}
  else if(kind==='cross'){ctx.beginPath();ctx.moveTo(r+5,-10);ctx.lineTo(r+5,10);ctx.moveTo(r-5,0);ctx.lineTo(r+18,0);ctx.stroke()}
  else if(kind==='spiral'){ctx.beginPath();for(let i=0;i<18;i++){const q=i*.7,rr=i*.75;const x=r+8+Math.cos(q)*rr,y=Math.sin(q)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
  else if(kind==='bolt'){ctx.beginPath();ctx.moveTo(r+4,-12);ctx.lineTo(r+15,-2);ctx.lineTo(r+8,2);ctx.lineTo(r+22,12);ctx.stroke()}
  else if(kind==='flame'){ctx.beginPath();ctx.moveTo(r+5,10);ctx.quadraticCurveTo(r+22,0,r+8,-12);ctx.quadraticCurveTo(r+30,0,r+5,10);ctx.stroke()}
  else if(kind==='clock'){ctx.beginPath();ctx.arc(r+12,0,10,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(r+12,0);ctx.lineTo(r+12,-6);ctx.moveTo(r+12,0);ctx.lineTo(r+17,3);ctx.stroke()}
  else if(kind==='void'){ctx.beginPath();ctx.arc(r+14,0,10,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(r+14,0,4,0,TAU);ctx.fill()}
  else if(kind==='tail'){ctx.beginPath();ctx.moveTo(r+4,-8);ctx.quadraticCurveTo(r+34,0,r+4,8);ctx.stroke()}
  else if(kind==='star'){ctx.beginPath();for(let i=0;i<10;i++){const rr=i%2?5:11,q=-Math.PI/2+i*Math.PI/5,x=r+12+Math.cos(q)*rr,y=Math.sin(q)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.stroke()}
  else if(kind==='glitch'){ctx.fillRect(r+3,-10,15,3);ctx.fillRect(r+11,-2,18,3);ctx.fillRect(r+1,7,22,3)}
  else if(kind==='zero'){ctx.beginPath();ctx.arc(r+12,0,10,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(r+5,7);ctx.lineTo(r+19,-7);ctx.stroke()}
  ctx.restore();
}

function drawPlayerCannon(cannon,r){
  const theme=TANK_THEMES[cannon]||TANK_THEMES.standard;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor=theme.glow;ctx.shadowBlur=8;

  const barrel=(x,y,w,h,fill='#697987',stroke='#3c4955',radius=3)=>{
    ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();ctx.stroke();
  };
  const line=(x1,y1,x2,y2,color=theme.glow,width=3)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};

  switch(cannon){
    case 'standard':
      barrel(r*.15,-7,r+28,14);ctx.fillStyle='#a8dfff';ctx.fillRect(r+15,-4,14,8);break;
    case 'scout':
      barrel(r*.05,-4,r+46,8,'#547e94','#2d5064',2);line(r+15,-12,r+51,0,'#8ef4ff',3);line(r+15,12,r+51,0,'#8ef4ff',3);break;
    case 'bastion':
      barrel(r*.02,-14,r+35,28,'#667687','#344353',5);barrel(r+16,-7,31,14,'#93a8b8','#4d6070',2);ctx.strokeStyle='#d4eaff';ctx.lineWidth=3;ctx.strokeRect(r+2,-18,25,36);break;
    case 'rapid':
      for(const yy of [-8,0,8])barrel(r*.18,yy-3,r+32,6,'#5e8070','#315444',2);ctx.fillStyle='#a4ffc2';for(const yy of [-8,0,8])ctx.fillRect(r+23,yy-2,13,4);break;
    case 'dual':
      barrel(r*.12,-13,r+37,9,'#4f7a6b','#275142',3);barrel(r*.12,4,r+37,9,'#4f7a6b','#275142',3);ctx.fillStyle='#a9ffe0';ctx.fillRect(r+27,-11,11,5);ctx.fillRect(r+27,6,11,5);break;
    case 'needle':
      barrel(r*.15,-3,r+26,6,'#778c57','#4b6230',2);ctx.fillStyle='#d8ff8f';ctx.beginPath();ctx.moveTo(r+58,0);ctx.lineTo(r+23,-4);ctx.lineTo(r+23,4);ctx.closePath();ctx.fill();break;
    case 'spread':
      ctx.fillStyle='#577e88';ctx.strokeStyle='#2b535d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r*.05,-12);ctx.lineTo(r+43,-25);ctx.lineTo(r+43,25);ctx.lineTo(r*.05,12);ctx.closePath();ctx.fill();ctx.stroke();for(const yy of [-16,-8,0,8,16])line(r+22,yy*.65,r+47,yy,'#9bf8ff',3);break;
    case 'burst':
      for(const yy of [-10,0,10])barrel(r*.12,yy-4,r+24,8,'#447682','#23525d',3);ctx.strokeStyle='#90f6ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(r+22,0,17,-1.1,1.1);ctx.stroke();break;
    case 'crystal':
      barrel(r*.12,-8,r+25,16,'#47768a','#295166',3);ctx.fillStyle='#c9fcff';ctx.strokeStyle='#77cce5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r+48,0);ctx.lineTo(r+20,-13);ctx.lineTo(r+7,0);ctx.lineTo(r+20,13);ctx.closePath();ctx.fill();ctx.stroke();break;
    case 'piercer':
      barrel(r*.05,-4,r+61,8,'#60537f','#332b4a',2);line(r+2,-11,r+54,-11,'#d7c5ff',3);line(r+2,11,r+54,11,'#d7c5ff',3);break;
    case 'laser':
      barrel(r*.10,-10,r+49,7,'#734e88','#42294e',2);barrel(r*.10,3,r+49,7,'#734e88','#42294e',2);line(r+12,-6,r+58,-6,'#f0c7ff',2);line(r+12,6,r+58,6,'#f0c7ff',2);break;
    case 'drill':
      barrel(r*.08,-9,r+28,18,'#5a4779','#34284a',4);ctx.strokeStyle='#c6acff';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<18;i++){const x=r+15+i*2.5,amp=10*(1-i/20),y=Math.sin(i*1.4)*amp;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.fillStyle='#e4dbff';ctx.beginPath();ctx.moveTo(r+65,0);ctx.lineTo(r+45,-8);ctx.lineTo(r+45,8);ctx.closePath();ctx.fill();break;
    case 'plasma':
      barrel(r*.08,-11,r+27,22,'#315f76','#173b4d',7);ctx.strokeStyle='#75f5ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(r+26,0,15,0,TAU);ctx.stroke();ctx.fillStyle='#d9ffff';ctx.beginPath();ctx.arc(r+42,0,7,0,TAU);ctx.fill();break;
    case 'thunder':
      barrel(r*.08,-8,r+25,16,'#596b7b','#31424f',4);line(r+12,-16,r+27,-3,'#fff07a',3);line(r+27,-3,r+18,3,'#fff07a',3);line(r+18,3,r+39,15,'#fff07a',3);ctx.fillStyle='#fff6a2';ctx.beginPath();ctx.arc(r+41,0,7,0,TAU);ctx.fill();break;
    case 'inferno':
      barrel(r*.08,-12,r+29,24,'#6f4c45','#452823',6);ctx.fillStyle='#ffad63';ctx.beginPath();ctx.moveTo(r+49,0);ctx.lineTo(r+25,-16);ctx.lineTo(r+29,-5);ctx.lineTo(r+14,0);ctx.lineTo(r+29,5);ctx.lineTo(r+25,16);ctx.closePath();ctx.fill();break;
    case 'rocket':
      barrel(r*.02,-16,r+25,32,'#5f6b74','#333d45',5);for(const yy of [-9,9]){ctx.fillStyle='#262f37';ctx.fillRect(r+10,yy-5,25,10);ctx.fillStyle='#ff9d55';ctx.beginPath();ctx.arc(r+37,yy,4,0,TAU);ctx.fill()}break;
    case 'titan':
      barrel(-2,-18,r+50,36,'#695f5a','#38302c',5);barrel(r+18,-10,40,20,'#8c786a','#4e4139',3);ctx.strokeStyle='#ffd49a';ctx.lineWidth=4;ctx.strokeRect(r+4,-22,28,44);break;
    case 'phantom':
      ctx.globalAlpha=.72;barrel(r*.10,-3,r+55,6,'#766aa0','#42375f',3);ctx.strokeStyle='#d8d0ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(r+12,0,18,-1.15,1.15);ctx.stroke();ctx.globalAlpha=1;break;
    case 'ring':
      barrel(r*.10,-5,r+27,10,'#66578a','#392d55',3);ctx.strokeStyle='#ddcaff';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(r+35,0,20,11,0,0,TAU);ctx.stroke();ctx.beginPath();ctx.ellipse(r+35,0,10,21,0,0,TAU);ctx.stroke();break;
    case 'chrono':
      barrel(r*.09,-6,r+31,12,'#526c93','#2d3e5f',3);ctx.strokeStyle='#bdeeff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r+31,0,15,0,TAU);ctx.stroke();line(r+31,0,r+31,-10,'#eaffff',2);line(r+31,0,r+39,5,'#eaffff',2);break;
    case 'void':
      ctx.fillStyle='#20172f';ctx.strokeStyle='#a483ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(r*.05,-15);ctx.lineTo(r+44,-6);ctx.lineTo(r+57,0);ctx.lineTo(r+44,6);ctx.lineTo(r*.05,15);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#040309';ctx.beginPath();ctx.arc(r+43,0,10,0,TAU);ctx.fill();break;
    case 'nova':
      barrel(r*.10,-8,r+28,16,'#4b5787','#2a345d',4);ctx.strokeStyle='#8df6ff';ctx.lineWidth=3;for(let k=0;k<5;k++){const q=k*TAU/5;line(r+38,0,r+38+Math.cos(q)*17,Math.sin(q)*17,'#8df6ff',2)}ctx.fillStyle='#eaffff';ctx.beginPath();ctx.arc(r+39,0,6,0,TAU);ctx.fill();break;
    case 'comet':
      barrel(r*.08,-5,r+42,10,'#3a6c89','#21445a',3);ctx.fillStyle='#9cf5ff';ctx.beginPath();ctx.moveTo(r+58,0);ctx.lineTo(r+28,-9);ctx.lineTo(r+35,0);ctx.lineTo(r+28,9);ctx.closePath();ctx.fill();line(r-4,-14,r+27,0,'rgba(110,235,255,.7)',3);line(r-4,14,r+27,0,'rgba(110,235,255,.7)',3);break;
    case 'stellar':
      barrel(r*.08,-7,r+30,14,'#6775a4','#39446e',4);ctx.fillStyle='#ffffff';ctx.strokeStyle='#aeeeff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r+48,0);ctx.lineTo(r+31,-11);ctx.lineTo(r+20,0);ctx.lineTo(r+31,11);ctx.closePath();ctx.fill();ctx.stroke();for(const yy of [-17,17])line(r+4,yy,r+26,yy*.35,'#dfffff',2);break;
    case 'deku':
      barrel(r*.08,-7,r+39,14,'#174b36','#0b3128',5);ctx.strokeStyle='#baff70';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r+11,-13);ctx.lineTo(r+24,-4);ctx.lineTo(r+17,3);ctx.lineTo(r+37,13);ctx.stroke();break;
    case 'error':
      barrel(r*.03,-12,r+44,24,'#090a0c','#72ff43',2);ctx.strokeStyle='#ff42df';ctx.lineWidth=2;ctx.strokeRect(r+8,-15,28,6);ctx.strokeStyle='#42eaff';ctx.strokeRect(r+15,8,34,5);break;
    case 'glitch':
      ctx.fillStyle='#0b0a0e';ctx.strokeStyle='#ff42df';ctx.lineWidth=3;ctx.fillRect(r*.04,-15,r+24,10);ctx.strokeRect(r*.04,-15,r+24,10);ctx.strokeStyle='#42eaff';ctx.fillRect(r*.16,5,r+37,9);ctx.strokeRect(r*.16,5,r+37,9);ctx.fillStyle='#72ff43';ctx.fillRect(r+22,-3,18,6);break;
    case 'zero':
      barrel(r*.02,-13,r+50,26,'#050506','#f1f7ff',1);ctx.strokeStyle='#ffffff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(r+7,-18);ctx.lineTo(r+53,0);ctx.lineTo(r+7,18);ctx.stroke();ctx.fillStyle='#000';ctx.beginPath();ctx.arc(r+51,0,8,0,TAU);ctx.fill();ctx.stroke();break;
  }
  ctx.shadowBlur=0;ctx.restore();
}
function drawErrorSword(e,r,t){
  const pose=getErrorSwordSwingPose(e);
  ctx.save();
  ctx.rotate(pose.angle);
  ctx.scale(pose.scale,pose.scale);

  // During the swing, draw short RGB after-image trails behind the actual blade.
  if(pose.active){
    const trailAlpha=.18*(1-pose.progress*.45);
    for(let k=3;k>=1;k--){
      const back=-pose.dir*k*.095;
      ctx.save();
      ctx.rotate(back);
      ctx.globalAlpha=trailAlpha*(1-k*.12);
      ctx.strokeStyle=k%2?'#ff42df':'#42eaff';
      ctx.lineWidth=4;
      ctx.beginPath();
      ctx.moveTo(r*.15,0);
      ctx.lineTo(r+98,0);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.shadowColor='#72ff43';ctx.shadowBlur=20;
  ctx.fillStyle='#0b0d10';ctx.strokeStyle='#72ff43';ctx.lineWidth=3.5;

  // Blade is slightly longer so the visual matches the enlarged hit range.
  ctx.beginPath();
  ctx.moveTo(r*.10,-7);
  ctx.lineTo(r+76,-5);
  ctx.lineTo(r+102,0);
  ctx.lineTo(r+76,5);
  ctx.lineTo(r*.10,7);
  ctx.closePath();ctx.fill();ctx.stroke();

  ctx.strokeStyle='#ff42df';ctx.lineWidth=2.3;
  ctx.beginPath();ctx.moveTo(r+5,-9);ctx.lineTo(r+88,-7);ctx.stroke();

  ctx.strokeStyle='#42eaff';
  ctx.beginPath();ctx.moveTo(r+8,9);ctx.lineTo(r+86,7);ctx.stroke();

  ctx.fillStyle='#dfffff';
  ctx.fillRect(r+71,-2,23,4);

  ctx.shadowBlur=0;
  ctx.fillStyle='#24272c';
  ctx.fillRect(r*.04,-13,11,26);
  ctx.restore();
}


function drawVariantArmor(cannon,r,t){
  const variants={
    scout:['dots',5],bastion:['plate',4],dual:['dots',4],needle:['spike',6],
    burst:['plate',3],crystal:['gem',4],laser:['line',4],drill:['spike',8],
    thunder:['orb',6],inferno:['spike',5],titan:['plate',6],phantom:['orb',4],
    chrono:['orb',8],void:['ring',3],comet:['line',5],stellar:['gem',5],
    glitch:['glitch',5],zero:['ring',2]
  };
  const v=variants[cannon];if(!v)return;
  const[kind,count]=v;
  const theme=TANK_THEMES[cannon]||TANK_THEMES.standard;
  ctx.save();ctx.strokeStyle=theme.glow;ctx.fillStyle=theme.glow;ctx.lineWidth=2.2;ctx.globalAlpha=.82;
  if(kind==='dots'||kind==='orb'||kind==='gem'||kind==='spike'){
    for(let i=0;i<count;i++){
      const q=t*(kind==='orb'?.8:.2)+i*TAU/count,rr=r*.68,x=Math.cos(q)*rr,y=Math.sin(q)*rr;
      if(kind==='dots'){ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill()}
      else if(kind==='orb'){ctx.beginPath();ctx.arc(x,y,4,0,TAU);ctx.stroke()}
      else if(kind==='gem'){ctx.save();ctx.translate(x,y);ctx.rotate(q);ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(4,0);ctx.lineTo(0,5);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.restore()}
      else{ctx.beginPath();ctx.moveTo(Math.cos(q)*r*.65,Math.sin(q)*r*.65);ctx.lineTo(Math.cos(q)*(r+8),Math.sin(q)*(r+8));ctx.stroke()}
    }
  }else if(kind==='plate'){
    for(let i=0;i<count;i++){const q=i*TAU/count;ctx.save();ctx.rotate(q);ctx.strokeRect(r*.48,-5,12,10);ctx.restore()}
  }else if(kind==='line'){
    for(let i=0;i<count;i++){const q=i*TAU/count+t*.12;ctx.beginPath();ctx.moveTo(Math.cos(q)*r*.25,Math.sin(q)*r*.25);ctx.lineTo(Math.cos(q)*r*.78,Math.sin(q)*r*.78);ctx.stroke()}
  }else if(kind==='ring'){
    for(let i=0;i<count;i++){ctx.beginPath();ctx.ellipse(0,0,r*(.35+i*.15),r*(.12+i*.05),t*(i%2?-.8:.8)+i,0,TAU);ctx.stroke()}
  }else if(kind==='glitch'){
    for(let i=0;i<count;i++)ctx.fillRect(rand(-r*.6,r*.6),rand(-r*.6,r*.6),rand(5,12),2);
  }
  ctx.restore();
}


function drawUniqueTankBody(cannon,r,t,theme){
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowColor=theme.glow;ctx.shadowBlur=11;
  const plate=(x,y,w,h,rad=6,fill=theme.body,stroke=theme.edge)=>{ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x,y,w,h,rad);ctx.fill();ctx.stroke()};
  const dot=(q,rr,size,color=theme.glow)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(Math.cos(q)*rr,Math.sin(q)*rr,size,0,TAU);ctx.fill()};
  const spoke=(q,r1,r2,color=theme.glow,w=3)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(Math.cos(q)*r1,Math.sin(q)*r1);ctx.lineTo(Math.cos(q)*r2,Math.sin(q)*r2);ctx.stroke()};

  // 모든 캐릭터는 하나의 둥근 중심 몸체를 유지한다. 차이는 장갑/링/핀/문양에서 만든다.
  ctx.fillStyle=theme.body;ctx.strokeStyle=theme.edge;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.68,0,TAU);ctx.stroke();

  switch(cannon){
    case 'standard': ctx.strokeStyle=theme.glow;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.48,0,TAU);ctx.stroke();break;
    case 'scout':
      ctx.fillStyle=theme.glow;for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(-r*.35,s*r*.55);ctx.lineTo(-r*1.10,s*r*.88);ctx.lineTo(-r*.80,s*r*.20);ctx.closePath();ctx.fill()}spoke(0,r*.35,r*.88,theme.glow,3);break;
    case 'bastion':
      plate(-r*.48,-r*1.13,r*.96,r*.28,7);plate(-r*.48,r*.85,r*.96,r*.28,7);plate(-r*1.13,-r*.48,r*.28,r*.96,7);ctx.strokeStyle=theme.glow;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*.78,-.75,.75);ctx.stroke();break;
    case 'rapid': for(let k=0;k<8;k++)dot(k*TAU/8,r*.76,4);ctx.strokeStyle=theme.glow;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.48,t*2,t*2+Math.PI*1.3);ctx.stroke();break;
    case 'dual':
      ctx.strokeStyle=theme.glow;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-r*.24,r*.47,Math.PI*.15,Math.PI*.85);ctx.stroke();ctx.beginPath();ctx.arc(0,r*.24,r*.47,-Math.PI*.85,-Math.PI*.15);ctx.stroke();plate(-r*.18,-r*.95,r*.36,r*.22,5);plate(-r*.18,r*.73,r*.36,r*.22,5);break;
    case 'needle': for(let k=0;k<4;k++)spoke(k*TAU/4,r*.72,r*1.16,'#d8ff8f',3);ctx.fillStyle='#d8ff8f';ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();break;
    case 'spread': for(let k=-2;k<=2;k++)spoke(k*.25,r*.52,r*1.08,theme.glow,4);ctx.strokeStyle=theme.glow;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.52,-.65,.65);ctx.stroke();break;
    case 'burst': for(let k=0;k<3;k++)dot(t*1.4+k*TAU/3,r*.78,6);ctx.strokeStyle=theme.glow;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.44,0,TAU);ctx.stroke();break;
    case 'crystal': ctx.strokeStyle='#d8ffff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-r*.72);ctx.lineTo(r*.58,0);ctx.lineTo(0,r*.72);ctx.lineTo(-r*.58,0);ctx.closePath();ctx.stroke();for(let k=0;k<4;k++)dot(k*TAU/4,r*.88,3);break;
    case 'piercer': ctx.strokeStyle=theme.glow;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r*.55,-r*.48);ctx.lineTo(r*.58,0);ctx.lineTo(-r*.55,r*.48);ctx.stroke();spoke(Math.PI,r*.70,r*1.06,theme.glow,3);break;
    case 'laser': for(let k=0;k<4;k++)spoke(k*TAU/4,r*.52,r*1.08,'#efcaff',3);ctx.strokeStyle='#efcaff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.38,0,TAU);ctx.stroke();break;
    case 'drill': for(let k=0;k<10;k++)dot(k*TAU/10,r*.91,3.5);ctx.strokeStyle=theme.glow;ctx.lineWidth=3;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,r*(.30+k*.17),t*(k%2?-.8:.8),t*(k%2?-.8:.8)+Math.PI*1.25);ctx.stroke()}break;
    case 'plasma': ctx.strokeStyle='#8ef7ff';ctx.lineWidth=3;for(let k=0;k<2;k++){ctx.beginPath();ctx.ellipse(0,0,r*(1.05+k*.12),r*(.30+k*.08),t*(k?-.8:.8)+k,0,TAU);ctx.stroke()}ctx.fillStyle='#e9ffff';ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.fill();break;
    case 'thunder': for(let k=0;k<6;k++)spoke(k*TAU/6,r*.58,r*1.05,'#fff278',3);ctx.strokeStyle='#fff278';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-r*.20,-r*.55);ctx.lineTo(r*.12,-r*.05);ctx.lineTo(-r*.04,-r*.05);ctx.lineTo(r*.25,r*.55);ctx.stroke();break;
    case 'inferno': ctx.fillStyle='#ff9c55';for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(-r*.45,s*r*.45);ctx.quadraticCurveTo(-r*1.08,s*r*.75,-r*.82,s*r*.12);ctx.quadraticCurveTo(-r*.60,s*r*.22,-r*.45,s*r*.45);ctx.fill()}ctx.strokeStyle='#ffd0a2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.48,-1.0,1.0);ctx.stroke();break;
    case 'rocket': plate(-r*1.12,-r*.66,r*.25,r*1.32,7,'#303942','#20272e');plate(r*.87,-r*.66,r*.25,r*1.32,7,'#303942','#20272e');for(const y of [-r*.36,r*.36])dot(Math.atan2(y,-r*.15),r*.40,4,'#ffae66');break;
    case 'titan': plate(-r*.72,-r*1.08,r*1.44,r*.25,7,'#74685f','#3d3732');plate(-r*.72,r*.83,r*1.44,r*.25,7,'#74685f','#3d3732');plate(-r*1.08,-r*.55,r*.25,r*1.10,7,'#5c554f','#36312e');ctx.strokeStyle='#ffd49a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*.72,-.8,.8);ctx.stroke();break;
    case 'phantom': ctx.globalAlpha=.75;ctx.strokeStyle='#e2d9ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(-r*.12,0,r*.60,-1.15,1.15);ctx.stroke();ctx.globalAlpha=1;for(let k=0;k<3;k++)dot(Math.PI+(k-1)*.42,r*.88,3,'#d4c7ff');break;
    case 'ring': ctx.strokeStyle='#decaff';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,r*1.18,r*.34,t,0,TAU);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,r*1.18,r*.34,t+Math.PI/2,0,TAU);ctx.stroke();break;
    case 'chrono': ctx.strokeStyle='#c8f3ff';ctx.lineWidth=3;for(let k=0;k<12;k++)spoke(k*TAU/12,r*.72,r*.93,'#c8f3ff',2);ctx.beginPath();ctx.arc(0,0,r*.52,0,TAU);ctx.stroke();spoke(-Math.PI/2,0,r*.39,'#efffff',3);spoke(.45,0,r*.32,'#efffff',3);break;
    case 'void': ctx.fillStyle='#06050a';ctx.beginPath();ctx.arc(0,0,r*.38,0,TAU);ctx.fill();ctx.strokeStyle='#af91ff';ctx.lineWidth=3;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,r*(.75+k*.13),r*(.22+k*.05),-t*(.55+k*.15)+k,0,TAU);ctx.stroke()}break;
    case 'nova': for(let k=0;k<5;k++)dot(t*.7+k*TAU/5,r*.96,4,'#b3fbff');ctx.strokeStyle='#dfffff';ctx.lineWidth=3;for(let k=0;k<5;k++)spoke(-Math.PI/2+k*TAU/5,r*.28,r*.60,'#dfffff',2);break;
    case 'comet': ctx.strokeStyle='#a2f6ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r*.35,-r*.24);ctx.lineTo(-r*1.18,0);ctx.lineTo(-r*.35,r*.24);ctx.stroke();ctx.fillStyle='#dfffff';ctx.beginPath();ctx.moveTo(r*.52,0);ctx.lineTo(r*.05,-r*.26);ctx.lineTo(r*.05,r*.26);ctx.closePath();ctx.fill();break;
    case 'stellar': for(let k=0;k<3;k++)dot(-Math.PI/2+k*TAU/3,r*.82,6,'#ffffff');ctx.strokeStyle='#eaffff';ctx.lineWidth=3;ctx.beginPath();for(let k=0;k<3;k++){const q=-Math.PI/2+k*TAU/3,x=Math.cos(q)*r*.82,y=Math.sin(q)*r*.82;k?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.stroke();break;
    case 'deku': ctx.strokeStyle='#caff70';ctx.lineWidth=3;for(let k=0;k<4;k++){const q=-.7+k*TAU/4;ctx.beginPath();ctx.moveTo(Math.cos(q)*r*.55,Math.sin(q)*r*.55);ctx.lineTo(Math.cos(q+.16)*r*1.04,Math.sin(q+.16)*r*1.04);ctx.stroke()}break;
    case 'error': ctx.strokeStyle='#72ff43';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*.86,.1,1.4);ctx.stroke();ctx.strokeStyle='#ff42df';ctx.beginPath();ctx.arc(Math.sin(t*13)*3,0,r*.92,2.0,3.35);ctx.stroke();ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.arc(0,Math.cos(t*11)*3,r*.78,4.0,5.55);ctx.stroke();break;
    case 'glitch': ctx.strokeStyle='#ff42df';ctx.lineWidth=4;ctx.setLineDash([10,6]);ctx.beginPath();ctx.arc(0,0,r*.92,t,t+Math.PI*1.05);ctx.stroke();ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.arc(0,0,r*.77,-t,-t+Math.PI*.92);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#72ff43';ctx.fillRect(r*.15,-3,r*.46,6);break;
    case 'zero': ctx.strokeStyle='#ffffff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*.60,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(-r*.43,r*.43);ctx.lineTo(r*.43,-r*.43);ctx.stroke();ctx.fillStyle='#050506';ctx.beginPath();ctx.arc(0,0,r*.22,0,TAU);ctx.fill();break;
  }
  ctx.shadowBlur=0;ctx.restore();
}
function drawTank(e){
  if(!e.alive)return;const isP=e===player;
  const cloakActive=isP?performance.now()<(e.cloakUntil||0):(e.cloaked===true&&(!e.cloakUntilWall||Date.now()<e.cloakUntilWall));
  const dekuSmokeActive=(e.cannonType||'')==='deku'&&(isP?performance.now()<(e.dekuSmokeUntil||0):Date.now()<(e.dekuSmokeUntilWall||0));
  if(!isP&&(cloakActive||dekuSmokeActive))return;
  const[x,y]=worldToScreen(e.x,e.y);
  if(x<-165||y<-165||x>innerWidth+165||y>innerHeight+165)return;
  const cannon=e.cannonType||'standard',family=cannonFamily(cannon),theme=TANK_THEMES[cannon]||TANK_THEMES.standard,r=e.r;
  const teamColor=isP?'#5cc0ff':'#ff646d',t=performance.now()*.001;

  ctx.save();ctx.translate(x,y);ctx.rotate(e.angle);if(isP&&cloakActive)ctx.globalAlpha=.30;if(isP&&dekuSmokeActive)ctx.globalAlpha=.42;

  // Team recognition ring stays blue/red even though each cannon has its own armor color.
  ctx.strokeStyle=teamColor;ctx.globalAlpha=.78;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(0,0,r+6,0,TAU);ctx.stroke();ctx.globalAlpha=1;

  const fortressActive=isP?performance.now()<(e.fortressUntil||0):!!e.fortress;
  const overclockActive=isP?performance.now()<(e.overclockUntil||0):!!e.overclock;
  const swordModeActive=cannon==='error'&&(isP?!!e.errorSwordMode:!!e.swordMode);
  if(fortressActive){
    ctx.strokeStyle='rgba(255,196,104,.92)';ctx.lineWidth=5;ctx.shadowColor='#ffc568';ctx.shadowBlur=14;
    ctx.beginPath();ctx.arc(0,0,r+13+Math.sin(t*6)*2,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    for(let i=0;i<6;i++){const q=i*TAU/6+t*.25;ctx.fillStyle='rgba(255,216,151,.75)';ctx.beginPath();ctx.arc(Math.cos(q)*(r+13),Math.sin(q)*(r+13),3,0,TAU);ctx.fill()}
  }
  if(overclockActive){
    ctx.strokeStyle='rgba(117,255,66,.88)';ctx.lineWidth=2;
    ctx.strokeRect(-r-9+Math.sin(t*21)*3,-r-9,(r+9)*2,(r+9)*2);
    ctx.strokeStyle='rgba(255,63,223,.65)';
    ctx.strokeRect(-r-6+Math.cos(t*17)*4,-r-11,(r+8)*2,(r+10)*2);
  }

  const dekuFaJinActive=cannon==='deku'&&(isP?performance.now()<(e.dekuFaJinUntil||0):e.dekuFaJin===true);
  const dekuGearshiftActive=cannon==='deku'&&(isP?performance.now()<(e.dekuGearshiftUntil||0):e.dekuGearshift===true);
  if(dekuFaJinActive){
    ctx.save();ctx.rotate(-e.angle);ctx.shadowColor='#8cff68';ctx.shadowBlur=24;ctx.strokeStyle='rgba(171,255,119,.98)';ctx.lineWidth=3.8;ctx.globalAlpha=.96;
    for(let k=0;k<7;k++){const aa=k*TAU/7+t*2.5,rr1=r+7+(k%2)*4,rr2=r+23+7*Math.sin(t*7+k);ctx.beginPath();ctx.moveTo(Math.cos(aa)*rr1,Math.sin(aa)*rr1);ctx.lineTo(Math.cos(aa+.16)*((rr1+rr2)*.55),Math.sin(aa+.16)*((rr1+rr2)*.55));ctx.lineTo(Math.cos(aa-.04)*rr2,Math.sin(aa-.04)*rr2);ctx.stroke()}ctx.shadowBlur=0;ctx.restore();
  }
  if(dekuGearshiftActive){
    ctx.save();ctx.shadowColor='#77edff';ctx.shadowBlur=22;ctx.strokeStyle='rgba(174,250,255,.96)';ctx.lineWidth=3.4;ctx.globalAlpha=.96;
    for(let k=-3;k<=3;k++){const yy=k*9+Math.sin(t*13+k)*3;ctx.beginPath();ctx.moveTo(-r-50-Math.abs(k)*8,yy);ctx.lineTo(-r-9,yy*.55);ctx.stroke()}
    ctx.strokeStyle='rgba(205,255,255,.74)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,r+15+Math.sin(t*10)*3,(r+15)*.45,t*1.8,0,TAU);ctx.stroke();ctx.shadowBlur=0;ctx.restore();
  }

  // ERROR 검 모드에서는 포신 대신 ERROR 검을 든다.
  if(swordModeActive)drawErrorSword(e,r,t);else drawPlayerCannon(cannon,r);

  drawUniqueTankBody(cannon,r,t,theme);

  ctx.restore();

  if(e.hp<e.maxHp||!isP){
    const w=r*2;ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(x-w/2,y+r+10,w,5);
    ctx.fillStyle='#6be28a';ctx.fillRect(x-w/2,y+r+10,w*clamp(e.hp/e.maxHp,0,1),5)
  }
  ctx.fillStyle='rgba(255,255,255,.90)';ctx.font='700 11px system-ui';ctx.textAlign='center';
  ctx.fillText(e.name,x,y-r-15);
}
function drawPlasmaLightningPath(ax,ay,bx,by,alpha=1){
  const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
  if(len<4)return;
  const nx=-dy/len,ny=dx/len;
  const segments=Math.max(7,Math.min(18,Math.floor(len/42)));
  const pts=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    let jitter=0;
    if(i!==0&&i!==segments){
      const envelope=Math.sin(Math.PI*t);
      jitter=(Math.random()-.5)*22*envelope;
    }
    pts.push([ax+dx*t+nx*jitter,ay+dy*t+ny*jitter]);
  }

  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowColor=`rgba(83,229,255,${.75*alpha})`;
  ctx.shadowBlur=17;
  ctx.strokeStyle=`rgba(63,190,255,${.20*alpha})`;
  ctx.lineWidth=10;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.stroke();

  ctx.shadowBlur=9;
  ctx.strokeStyle=`rgba(112,239,255,${.80*alpha})`;
  ctx.lineWidth=3.4;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.stroke();

  ctx.shadowBlur=0;
  ctx.strokeStyle=`rgba(235,255,255,${.93*alpha})`;
  ctx.lineWidth=1.05;
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  ctx.stroke();

  // Small side-arcs make the cable look electrically unstable.
  if(len>90){
    ctx.strokeStyle=`rgba(124,231,255,${.46*alpha})`;ctx.lineWidth=1.2;
    for(let k=2;k<pts.length-2;k+=4){
      const p=pts[k],branch=10+Math.random()*15,side=Math.random()<.5?-1:1;
      ctx.beginPath();ctx.moveTo(p[0],p[1]);
      ctx.lineTo(p[0]+nx*branch*side+dx/len*7,p[1]+ny*branch*side+dy/len*7);ctx.stroke();
    }
  }
  ctx.restore();
}
function drawPlasmaTethers(){
  let tetherIndex=0;
  for(const b of bullets){
    if(!['plasma','thunder'].includes(b.cannon)||b.life<=0)continue;
    if(renderPressure>=2&&((tetherIndex++)&1))continue;
    const owner=plasmaTetherOwner(b);
    if(!owner||!owner.alive)continue;
    const [sx,sy]=plasmaTetherStart(owner);
    const [ax,ay]=worldToScreen(sx,sy),[bx,by]=worldToScreen(b.x,b.y);
    if((ax<-180&&bx<-180)||(ay<-180&&by<-180)||(ax>innerWidth+180&&bx>innerWidth+180)||(ay>innerHeight+180&&by>innerHeight+180))continue;
    const pulse=.78+.22*Math.sin(performance.now()*.022+(b.x+b.y)*.01);
    drawPlasmaLightningPath(ax,ay,bx,by,pulse);
  }
}


function drawSkillZones(){
  const t=performance.now()*.001;
  for(const z of skillZones){
    const extent=Math.max(100,Number(z.radius)||0,Number(z.length)||0);
    if(!screenVisibleWorld(z.x,z.y,Math.min(1400,extent+100)))continue;
    const[x,y]=worldToScreen(z.x,z.y),p=clamp(z.life/z.maxLife,0,1),q=1-p;ctx.save();ctx.translate(x,y);ctx.globalAlpha=Math.min(1,p*1.3);
    if(z.type==='burstBomb'){
      const pulse=.75+.25*Math.sin(t*12);ctx.shadowColor='#65ecff';ctx.shadowBlur=20;ctx.strokeStyle='#8df6ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,z.radius*(.35+.1*pulse),0,TAU);ctx.stroke();for(let k=0;k<8;k++){const aa=k*TAU/8+t*2;ctx.beginPath();ctx.moveTo(Math.cos(aa)*28,Math.sin(aa)*28);ctx.lineTo(Math.cos(aa)*z.radius*.55,Math.sin(aa)*z.radius*.55);ctx.stroke()}ctx.shadowBlur=0;
    }else if(z.type==='crystalPrism'){
      ctx.rotate(t*.6);ctx.shadowColor='#c8fbff';ctx.shadowBlur=20;ctx.strokeStyle='#dfffff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-z.radius);ctx.lineTo(z.radius*.866,z.radius*.5);ctx.lineTo(-z.radius*.866,z.radius*.5);ctx.closePath();ctx.stroke();ctx.globalAlpha*=.35;ctx.fillStyle='#72d9ff';ctx.fill();ctx.globalAlpha=1;ctx.shadowBlur=0;
    }else if(z.type==='thunderStorm'){
      ctx.fillStyle='rgba(80,95,115,.28)';for(let k=0;k<6;k++){const aa=k*TAU/6+t*.14,rr=z.radius*(.25+(k%3)*.12);ctx.beginPath();ctx.arc(Math.cos(aa)*rr,Math.sin(aa)*rr*.45,60,0,TAU);ctx.fill()}ctx.strokeStyle='#fff47c';ctx.lineWidth=3;ctx.setLineDash([8,9]);ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.stroke();ctx.setLineDash([]);
    }else if(z.type==='missileRain'){
      ctx.fillStyle='rgba(255,120,60,.07)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='#ff9e55';ctx.lineWidth=3;ctx.setLineDash([6,10]);ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.stroke();ctx.setLineDash([]);
    }else if(z.type==='earthFissure'){
      ctx.rotate(z.angle);ctx.strokeStyle='#ffc17a';ctx.lineWidth=8;ctx.shadowColor='#ff9b4a';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(0,0);for(let k=1;k<=8;k++){const xx=z.length*k/8,yy=(k%2?1:-1)*18;ctx.lineTo(xx,yy)}ctx.stroke();ctx.shadowBlur=0;
    }else if(z.type==='ringGate'){
      ctx.rotate(t*1.8);ctx.shadowColor='#c8aaff';ctx.shadowBlur=22;ctx.strokeStyle='#e6d8ff';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,z.radius,z.radius*.36,0,0,TAU);ctx.stroke();ctx.strokeStyle='#8d65e8';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,z.radius*.68,z.radius*.22,Math.PI/2,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(z.type==='constellation'){
      const rr=z.radius,pts=[[0,-rr],[-rr*.866,rr*.5],[rr*.866,rr*.5]];ctx.strokeStyle='#edffff';ctx.shadowColor='#b8f4ff';ctx.shadowBlur=18;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[1]);ctx.lineTo(...pts[2]);ctx.closePath();ctx.stroke();for(const pt of pts){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pt[0],pt[1],9+Math.sin(t*5)*2,0,TAU);ctx.fill()}ctx.globalAlpha*=.12;ctx.fillStyle='#b8f4ff';ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[1]);ctx.lineTo(...pts[2]);ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.shadowBlur=0;
    }else if(z.type==='secondStar'){
      ctx.rotate(t*.7);ctx.strokeStyle='#ffffff';ctx.shadowColor='#b9f6ff';ctx.shadowBlur=24;ctx.lineWidth=4;for(let k=0;k<8;k++){const aa=k*TAU/8;ctx.beginPath();ctx.moveTo(Math.cos(aa)*25,Math.sin(aa)*25);ctx.lineTo(Math.cos(aa)*z.radius,Math.sin(aa)*z.radius);ctx.stroke()}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,13,0,TAU);ctx.fill();ctx.shadowBlur=0;
    }else if(z.type==='ironDome'){
      ctx.rotate(t*.35);ctx.strokeStyle='#ffd08b';ctx.shadowColor='#ffbd60';ctx.shadowBlur=18;ctx.lineWidth=5;for(let k=0;k<6;k++){const aa=k*TAU/6;ctx.beginPath();ctx.arc(0,0,z.radius,aa+.10,aa+.72);ctx.stroke()}for(let k=0;k<4;k++){const aa=k*TAU/4-t*.8;ctx.save();ctx.translate(Math.cos(aa)*z.radius*.78,Math.sin(aa)*z.radius*.78);ctx.rotate(aa);ctx.fillStyle='#725743';ctx.fillRect(-18,-8,36,16);ctx.strokeStyle='#ffe0ad';ctx.strokeRect(-18,-8,36,16);ctx.restore()}ctx.shadowBlur=0;
    }else if(z.type==='ringParry'){
      ctx.rotate(t*2.8);ctx.strokeStyle='#eee2ff';ctx.shadowColor='#c39dff';ctx.shadowBlur=20;ctx.lineWidth=7;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,z.radius*(.55+k*.18),z.radius*(.20+k*.05),k*Math.PI/3,0,TAU);ctx.stroke()}ctx.shadowBlur=0;
    }else if(z.type==='rewindEcho'){
      ctx.strokeStyle='#c8f4ff';ctx.lineWidth=3;ctx.setLineDash([4,8]);for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(0,0,z.radius*(.25+k*.18)*(1-q*.35),-t-k,t+k+Math.PI);ctx.stroke()}ctx.setLineDash([]);
    }else if(z.type==='antiMatter'){
      ctx.fillStyle='rgba(118,75,200,.10)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='#b493ff';ctx.lineWidth=4;for(let k=0;k<8;k++){const aa=k*TAU/8+t*.6;ctx.beginPath();ctx.moveTo(Math.cos(aa)*z.radius*.22,Math.sin(aa)*z.radius*.22);ctx.lineTo(Math.cos(aa)*z.radius,Math.sin(aa)*z.radius);ctx.stroke()}ctx.strokeStyle='#f0e8ff';ctx.beginPath();ctx.arc(0,0,z.radius*.18,0,TAU);ctx.stroke();
    }else if(z.type==='cometShower'){
      ctx.fillStyle='rgba(90,225,255,.06)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='#7cefff';ctx.lineWidth=3;ctx.setLineDash([16,10]);ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.stroke();ctx.setLineDash([]);
    }else if(z.type==='glitchDriveAura'){
      ctx.strokeStyle='#72ff43';ctx.lineWidth=3;ctx.strokeRect(-z.radius*.7,-z.radius*.7,z.radius*1.4,z.radius*1.4);ctx.strokeStyle='#ff42df';ctx.strokeRect(-z.radius*.7+Math.sin(t*18)*7,-z.radius*.7-5,z.radius*1.4,z.radius*1.4);ctx.strokeStyle='#42eaff';for(let k=0;k<5;k++){const yy=-z.radius*.6+k*z.radius*.3;ctx.beginPath();ctx.moveTo(-z.radius,yy);ctx.lineTo(z.radius,yy+Math.sin(t*15+k)*8);ctx.stroke()}
    }else if(z.type==='glitchWarpTrail'){
      ctx.rotate(z.angle);ctx.strokeStyle='#ff42df';ctx.lineWidth=5;ctx.setLineDash([18,8]);ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(z.length,7);ctx.stroke();ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(z.length,-7);ctx.stroke();ctx.setLineDash([]);
    }else if(z.type==='dekuSmoke'){
      // Deku Smokescreen: layered, rolling grey-white smoke instead of a flat circle.
      const smokeCount=renderPressure>=2?7:renderPressure>=1?10:15;
      const breathe=.94+.06*Math.sin(t*1.7+z.x*.002);
      ctx.globalAlpha*=.94;
      ctx.fillStyle='rgba(75,88,82,.30)';ctx.beginPath();ctx.arc(0,0,z.radius*breathe,0,TAU);ctx.fill();
      for(let k=0;k<smokeCount;k++){
        const seed=k*2.399+z.x*.0007+z.y*.0011;
        const aa=seed+t*(k%2?-.075:.065);
        const rr=z.radius*(.12+.72*((k*37)%smokeCount)/Math.max(1,smokeCount-1));
        const drift=Math.sin(t*.8+seed)*z.radius*.055;
        const bx=Math.cos(aa)*rr+Math.cos(seed*1.7)*drift;
        const by=Math.sin(aa)*rr*.78+Math.sin(seed*1.3)*drift;
        const br=z.radius*(.16+.08*(.5+.5*Math.sin(seed*3.1)))*(1+.10*Math.sin(t*1.4+seed));
        const g=ctx.createRadialGradient(bx-br*.22,by-br*.20,br*.08,bx,by,br);
        g.addColorStop(0,'rgba(242,248,243,.48)');g.addColorStop(.46,'rgba(184,198,189,.38)');g.addColorStop(1,'rgba(92,106,98,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(bx,by,br,0,TAU);ctx.fill();
      }
      ctx.strokeStyle='rgba(221,232,225,.34)';ctx.lineWidth=2.2;ctx.setLineDash([18,13]);ctx.beginPath();ctx.arc(0,0,z.radius*(.96+.025*Math.sin(t*2)),0,TAU);ctx.stroke();ctx.setLineDash([]);
    }else if(z.type==='artillery'){
      ctx.strokeStyle='#8ed6ff';ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.beginPath();ctx.arc(0,0,z.radius*(.82+.18*q),0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(25,0);ctx.moveTo(0,-25);ctx.lineTo(0,25);ctx.stroke();
    }else if(z.type==='barrier'){
      ctx.rotate(z.angle);ctx.fillStyle='rgba(150,210,255,.18)';ctx.strokeStyle='#bde6ff';ctx.lineWidth=4;ctx.shadowColor='#75cfff';ctx.shadowBlur=16;ctx.fillRect(-z.width,-z.length/2,z.width*2,z.length);ctx.strokeRect(-z.width,-z.length/2,z.width*2,z.length);ctx.shadowBlur=0;
    }else if(z.type==='rapidOverdrive'){
      ctx.strokeStyle='#75f2a2';ctx.lineWidth=3;for(let k=0;k<8;k++){const a=k*TAU/8+t*4;ctx.beginPath();ctx.moveTo(Math.cos(a)*28,Math.sin(a)*28);ctx.lineTo(Math.cos(a)*72,Math.sin(a)*72);ctx.stroke()}
    }else if(z.type==='twinDrones'){
      for(const s of [-1,1]){const a=t*2.0*s+s*Math.PI/2;ctx.fillStyle='#a2ffe2';ctx.beginPath();ctx.arc(Math.cos(a)*z.radius,Math.sin(a)*z.radius,11,0,TAU);ctx.fill()}
    }else if(z.type==='needleMine'||z.type==='crystalMine'){
      ctx.rotate(t*(z.type==='crystalMine'?1.8:.8));ctx.strokeStyle=z.type==='crystalMine'?'#c9fbff':'#caff86';ctx.lineWidth=2.5;const n=z.type==='crystalMine'?6:4;for(let k=0;k<n;k++){const a=k*TAU/n;ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);ctx.lineTo(Math.cos(a)*z.radius,Math.sin(a)*z.radius);ctx.stroke()}
    }else if(z.type==='pulseBurst'||z.type==='quake'){
      ctx.strokeStyle=z.type==='quake'?'#ffc17a':'#70edff';ctx.lineWidth=5*p+1;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,(45+k*70)*(1+q*.5),0,TAU);ctx.stroke()}
    }else if(z.type==='laserSweep'){
      ctx.rotate(z.angle);ctx.strokeStyle='#f1d2ff';ctx.shadowColor='#d78dff';ctx.shadowBlur=20;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(z.radius,0);ctx.stroke();ctx.shadowBlur=0;
    }else if(z.type==='plasmaCage'){
      ctx.strokeStyle='#6ff2ff';ctx.lineWidth=3;ctx.shadowColor='#6ff2ff';ctx.shadowBlur=16;for(let k=0;k<6;k++){const a=k*TAU/6+t*.4,b=(k+1)*TAU/6+t*.4;ctx.beginPath();ctx.moveTo(Math.cos(a)*z.radius,Math.sin(a)*z.radius);ctx.lineTo(Math.cos(b)*z.radius,Math.sin(b)*z.radius);ctx.stroke()}ctx.shadowBlur=0;
    }else if(z.type==='flameWall'||z.type==='cometTrail'){
      ctx.rotate(z.angle);ctx.fillStyle=z.type==='flameWall'?'rgba(255,95,35,.20)':'rgba(82,229,255,.18)';ctx.strokeStyle=z.type==='flameWall'?'#ff814b':'#79efff';ctx.lineWidth=4;ctx.fillRect(-z.length/2,-z.width/2,z.length,z.width);ctx.strokeRect(-z.length/2,-z.width/2,z.length,z.width);
    }else if(z.type==='phantomAssassinMark'){
      const pulse=.82+.18*Math.sin(t*8);ctx.strokeStyle='#d6c9ff';ctx.shadowColor='#a58cff';ctx.shadowBlur=18;ctx.lineWidth=4;ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(0,0,z.radius*(.88+.05*pulse),0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.rotate(t*.45);for(let k=0;k<4;k++){const aa=k*TAU/4;ctx.beginPath();ctx.moveTo(Math.cos(aa)*z.radius*.30,Math.sin(aa)*z.radius*.30);ctx.lineTo(Math.cos(aa)*z.radius*.76,Math.sin(aa)*z.radius*.76);ctx.stroke()}ctx.fillStyle='rgba(210,196,255,.12)';ctx.beginPath();ctx.arc(0,0,z.radius*.55,0,TAU);ctx.fill();ctx.shadowBlur=0;
    }else if(z.type==='orbitRing'||z.type==='starOrbit'){
      const count=z.type==='starOrbit'?5:3;ctx.strokeStyle=z.type==='starOrbit'?'#88efff':'#d3b7ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.stroke();for(let k=0;k<count;k++){const a=t*3*(k%2?1:-1)+k*TAU/count,ox=Math.cos(a)*z.radius,oy=Math.sin(a)*z.radius;ctx.fillStyle=z.type==='starOrbit'?'#ecffff':'#e6d8ff';ctx.beginPath();ctx.arc(ox,oy,z.type==='starOrbit'?9:12,0,TAU);ctx.fill()}
    }else if(z.type==='timeField'){
      ctx.fillStyle='rgba(130,225,255,.08)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='#b9f2ff';ctx.lineWidth=3;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,z.radius*(.38+k*.25),t*(k%2?-.6:.6),t*(k%2?-.6:.6)+Math.PI*1.45);ctx.stroke()}ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-45);ctx.moveTo(0,0);ctx.lineTo(32,15);ctx.stroke();
    }else if(z.type==='supernovaCore'){
      const rr=24+q*z.radius*.55;ctx.shadowColor='#eaffff';ctx.shadowBlur=28;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(0,0,rr*.18,0,TAU);ctx.fill();ctx.strokeStyle='#82efff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,rr,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(z.type==='sanctuary'){
      ctx.fillStyle='rgba(225,250,255,.08)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='#e9ffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.stroke();for(let k=0;k<8;k++){const a=k*TAU/8+t*.2;ctx.fillStyle='#fff';ctx.fillRect(Math.cos(a)*z.radius*.75-2,Math.sin(a)*z.radius*.75-2,4,4)}
    }else if(z.type==='returnPortal'){
      ctx.strokeStyle='#dcc5ff';ctx.lineWidth=6;ctx.shadowColor='#b68cff';ctx.shadowBlur=20;ctx.beginPath();ctx.ellipse(0,0,z.radius,z.radius*.34,t*1.5,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(z.type==='cloneStorm'){
      for(let k=0;k<4;k++){const a=k*TAU/4+t*.7,ox=Math.cos(a)*z.radius,oy=Math.sin(a)*z.radius;ctx.fillStyle=k%2?'#ff4be1':'#54eaff';ctx.globalAlpha=.45+.25*Math.sin(t*8+k);ctx.fillRect(ox-12,oy-10,24,20)}ctx.globalAlpha=1;
    }else if(z.type==='absoluteZero'){
      ctx.fillStyle='rgba(230,245,255,.05)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;for(let k=0;k<12;k++){const a=k*TAU/12;ctx.beginPath();ctx.moveTo(Math.cos(a)*40,Math.sin(a)*40);ctx.lineTo(Math.cos(a)*z.radius,Math.sin(a)*z.radius);ctx.stroke()}
    }else if(z.type==='siegeAura'){
      ctx.strokeStyle='#ffd083';ctx.shadowColor='#ff9d4e';ctx.shadowBlur=16;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.stroke();for(let k=0;k<4;k++){const aa=k*TAU/4;ctx.save();ctx.rotate(aa);ctx.fillStyle='#7f6148';ctx.fillRect(z.radius*.45,-12,z.radius*.62,24);ctx.strokeStyle='#ffd49a';ctx.strokeRect(z.radius*.45,-12,z.radius*.62,24);ctx.restore()}ctx.beginPath();ctx.moveTo(-z.radius,0);ctx.lineTo(z.radius,0);ctx.moveTo(0,-z.radius);ctx.lineTo(0,z.radius);ctx.stroke();ctx.shadowBlur=0;
    }else if(z.type==='specterCloak'){
      ctx.globalAlpha*=.45;ctx.strokeStyle='#e5dcff';ctx.lineWidth=2;for(let k=0;k<5;k++){const off=k*13+Math.sin(t*5+k)*5;ctx.beginPath();ctx.ellipse(-off,0,z.radius*(.35+k*.07),z.radius*.55,0,0,TAU);ctx.stroke()}ctx.globalAlpha=1;
    }else if(z.type==='gravity'){
      ctx.strokeStyle='rgba(132,159,255,.75)';ctx.lineWidth=3;ctx.shadowColor='#829dff';ctx.shadowBlur=16;for(let i=0;i<4;i++){const rr=z.radius*(.18+i*.19)+Math.sin(t*3+i)*8;ctx.beginPath();ctx.arc(0,0,rr,t*(i%2?-.8:.8)+i,TAU+t*(i%2?-.8:.8)+i);ctx.stroke()}ctx.fillStyle='rgba(30,38,92,.22)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.shadowBlur=0;
    }else if(z.type==='burn'){
      ctx.fillStyle='rgba(255,90,25,.13)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,155,58,.70)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,z.radius*(.92+.04*Math.sin(t*7)),0,TAU);ctx.stroke();
    }
    ctx.restore();
  }
}
function drawCombatEffects(layer='base'){
  const t=performance.now()*.001;
  for(const f of combatFx){
    const isDekuFx=f.cannon==='deku'||String(f.type||'').startsWith('deku');
    if(layer==='base'&&isDekuFx)continue;
    if(layer==='deku'&&!isDekuFx)continue;
    if(f.type==='chainArc'){
      if(!segmentMayTouchScreen(f.x,f.y,f.x2,f.y2,150))continue;
    }else{
      const extent=Math.min(1400,Math.max(100,Number(f.radius)||0)+100);
      if(!screenVisibleWorld(f.x,f.y,extent))continue;
    }
    const[x,y]=worldToScreen(f.x,f.y),p=clamp(f.life/f.maxLife,0,1),q=1-p;
    ctx.save();ctx.translate(x,y);ctx.rotate(f.angle);ctx.globalAlpha=Math.min(1,p*1.35);
    if(f.type==='phantomTeleportTrace'){
      ctx.strokeStyle='#d4c8ff';ctx.shadowColor='#aa91ff';ctx.shadowBlur=16;ctx.lineWidth=5*p+1;ctx.setLineDash([12,8]);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*q,0);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;
    }else if(f.type==='phantomMarkBurst'){
      ctx.strokeStyle='#e0d6ff';ctx.shadowColor='#a88cff';ctx.shadowBlur=22;ctx.lineWidth=5*p+1;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,f.radius*q*(.45+k*.24),0,TAU);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='cloakBurst'){
      ctx.globalAlpha*=p*.75;ctx.strokeStyle='#e6deff';ctx.lineWidth=3;for(let k=0;k<5;k++){ctx.beginPath();ctx.arc(0,0,f.radius*q*(.35+k*.16),t+k,t+k+Math.PI*1.2);ctx.stroke()}
    }else if(f.type==='rewindBurst'){
      ctx.strokeStyle='#bdf3ff';ctx.shadowColor='#8deaff';ctx.shadowBlur=18;ctx.lineWidth=4*p+1;ctx.setLineDash([9,8]);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*q,0);ctx.stroke();ctx.setLineDash([]);for(let k=0;k<4;k++){ctx.beginPath();ctx.arc(0,0,25+k*18,Math.PI*q,TAU*Math.max(.15,q));ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='orbitalIgnition'){
      ctx.strokeStyle='#a8f6ff';ctx.shadowColor='#79eaff';ctx.shadowBlur=20;ctx.lineWidth=4;for(let k=0;k<5;k++){const aa=k*TAU/5+q*2,rr=f.radius*q*.7;ctx.beginPath();ctx.arc(Math.cos(aa)*rr,Math.sin(aa)*rr,9+q*8,0,TAU);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='phantomAfterimage'){
      ctx.globalAlpha*=p*.45;ctx.strokeStyle='#ded5ff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(-f.radius*q*.35,0,22,31,0,0,TAU);ctx.stroke();
    }else if(f.type==='ringParryFlash'){
      ctx.strokeStyle='#eadcff';ctx.shadowColor='#c79cff';ctx.shadowBlur=16;ctx.lineWidth=5*p+1;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,f.radius*q*(.5+k*.25),f.radius*q*(.18+k*.08),k,0,TAU);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='cometImpact'){
      ctx.strokeStyle='#a5f8ff';ctx.shadowColor='#72eaff';ctx.shadowBlur=18;ctx.lineWidth=8*p+2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*q,f.radius*q);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='dataWarp'){
      ctx.strokeStyle='#ff42df';ctx.lineWidth=7*p+1;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(f.radius*q,9);ctx.stroke();ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(f.radius*q,-9);ctx.stroke();
    }else if(f.type==='grappleCable'||f.type==='harpoonCable'){
      ctx.strokeStyle=f.type==='grappleCable'?'#8ff3ff':'#d6ff8c';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=15;ctx.lineWidth=f.type==='grappleCable'?5:4;ctx.setLineDash(f.type==='grappleCable'?[12,7]:[]);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius,0);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(f.radius,0);ctx.lineTo(f.radius-22,-10);ctx.lineTo(f.radius-22,10);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    }else if(f.type==='shotgunBlast'){
      ctx.fillStyle='rgba(105,242,255,.22)';ctx.strokeStyle='#9af9ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,f.radius*q,-.78,.78);ctx.closePath();ctx.fill();ctx.stroke();
    }else if(f.type==='prismFlash'){
      ctx.rotate(q*2);ctx.strokeStyle='#e5ffff';ctx.lineWidth=4;ctx.shadowColor='#b8f9ff';ctx.shadowBlur=16;ctx.beginPath();ctx.moveTo(0,-f.radius*q);ctx.lineTo(f.radius*q*.866,f.radius*q*.5);ctx.lineTo(-f.radius*q*.866,f.radius*q*.5);ctx.closePath();ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='portalPulse'){
      ctx.rotate(q*3);ctx.strokeStyle='#ddc7ff';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,f.radius*q,f.radius*q*.3,0,0,TAU);ctx.stroke();
    }else if(f.type==='skyLightning'){
      ctx.strokeStyle='#fff36f';ctx.lineWidth=5*p+1;ctx.shadowColor='#fff36f';ctx.shadowBlur=18;ctx.beginPath();ctx.moveTo(0,0);for(let k=1;k<=8;k++){const yy=f.radius*k/8,xx=k===8?0:(k%2?14:-13);ctx.lineTo(xx,yy)}ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='stellarRevive'){
      ctx.strokeStyle='#ffffff';ctx.lineWidth=6*p+1;ctx.shadowColor='#b9f6ff';ctx.shadowBlur=24;for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,f.radius*q*(.35+k*.22),0,TAU);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='uniqueSkill'){
      ctx.strokeStyle=f.color;ctx.lineWidth=5*p+1;ctx.shadowColor=f.color;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(0,0,f.radius*q*.45,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*q,0);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='lightningLink'){
      ctx.strokeStyle=f.color;ctx.lineWidth=3*p+1;ctx.shadowColor=f.color;ctx.shadowBlur=14;ctx.beginPath();let px=0,py=0;ctx.moveTo(0,0);for(let k=1;k<=7;k++){const tt=k/7,xx=f.radius*tt,yy=(k===7?0:Math.sin(k*8+f.x*.01)*12*p);ctx.lineTo(xx,yy);px=xx;py=yy}ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='muzzle'){
      ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*.35,-6);ctx.lineTo(f.radius,0);ctx.lineTo(f.radius*.35,6);ctx.closePath();ctx.fill();
    }else if(f.type==='rapid'){
      ctx.strokeStyle=f.color;ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(4,i*5-5);ctx.lineTo(f.radius*(.4+q*.6),i*5-5);ctx.stroke()}
    }else if(f.type==='spread'){
      ctx.fillStyle=f.color;ctx.globalAlpha*=.42;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,f.radius*(.4+q*.6),-.52,.52);ctx.closePath();ctx.fill();
    }else if(f.type==='rail'){
      ctx.shadowColor=f.color;ctx.shadowBlur=10;ctx.strokeStyle=f.color;ctx.lineWidth=4*(1-q)+1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*(.5+q),0);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='plasmaMuzzle'){
      ctx.shadowColor=f.color;ctx.shadowBlur=15;ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,f.radius*(.3+q*.7),0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='rocketMuzzle'){
      ctx.fillStyle='#ffb05c';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*(.6+q*.7),-10*p);ctx.lineTo(f.radius*(.35+q*.5),0);ctx.lineTo(f.radius*(.6+q*.7),10*p);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(220,230,238,.32)';ctx.beginPath();ctx.arc(f.radius*q,0,12+q*14,0,TAU);ctx.fill();
    }else if(f.type==='ringMuzzle'){
      ctx.strokeStyle=f.color;ctx.lineWidth=5*p+1;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(f.radius*q*.6,0,8+q*f.radius*.55,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='novaMuzzle'){
      ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.shadowColor=f.color;ctx.shadowBlur=13;
      for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*f.radius*q,Math.sin(a)*f.radius*q);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='errorMuzzle'){
      ctx.fillStyle='#76ff43';ctx.fillRect(f.radius*q-18,-10,18,5);ctx.fillStyle='#ff3fe2';ctx.fillRect(f.radius*q*.65-25,2,25,5);ctx.fillStyle='#42eaff';ctx.fillRect(f.radius*q*.85-13,10,13,4);
    }else if(f.type==='dekuMuzzle'){
      // AIR FORCE finger-flick shock: compressed wind rings with OFA green sparks.
      const push=f.radius*(.38+q*.78);
      ctx.globalAlpha*=.86;
      ctx.strokeStyle='rgba(239,255,250,.94)';ctx.shadowColor='#9fffc1';ctx.shadowBlur=14;ctx.lineWidth=4*p+1;
      ctx.beginPath();ctx.ellipse(push,0,12+q*18,7+q*9,0,0,TAU);ctx.stroke();
      ctx.strokeStyle='rgba(145,255,189,.72)';ctx.lineWidth=2.4;
      for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(2,k*7);ctx.quadraticCurveTo(push*.55,k*12,push+20,k*5);ctx.stroke()}
      ctx.shadowBlur=0;
    }else if(f.type==='dekuBlackwhip'){
      // V5.52: high-detail Blackwhip. Normal mode keeps a dark organic ribbon with teal energy.
      // Fa Jin mode becomes a separate black chain form with a red luminous rim and red kinetic sparks.
      const len=Math.max(70,f.radius),boost=f.variant==='faJin',grow=.84+.16*Math.sin(q*Math.PI);
      ctx.lineJoin='round';ctx.lineCap='round';
      if(boost){
        const reach=len*grow;
        const linkCount=renderPressure>=2?12:renderPressure>=1?16:22;
        const chains=renderPressure>=2?2:3;
        // Broad blood-red aura under the chains.
        ctx.shadowColor='#ff2738';ctx.shadowBlur=32;ctx.strokeStyle='rgba(255,36,55,.22)';ctx.lineWidth=26;
        for(let strand=0;strand<chains;strand++){
          const centered=strand-(chains-1)/2,sy=centered*20,ey=centered*34+Math.sin(t*4.2+strand*2.1)*15;
          const cy=centered*8+Math.sin(t*3.1+strand*1.7)*38;
          ctx.beginPath();ctx.moveTo(0,sy);ctx.quadraticCurveTo(reach*.48,cy,reach,ey);ctx.stroke();
        }
        ctx.shadowBlur=0;

        for(let strand=0;strand<chains;strand++){
          const centered=strand-(chains-1)/2,sy=centered*20,ey=centered*34+Math.sin(t*4.2+strand*2.1)*15;
          const cx=reach*.48,cy=centered*8+Math.sin(t*3.1+strand*1.7)*38;
          // Black core cable keeps the links visually connected.
          ctx.strokeStyle='rgba(2,2,4,.98)';ctx.lineWidth=strand===1||chains===2?15:12;ctx.shadowColor='#b70019';ctx.shadowBlur=14;
          ctx.beginPath();ctx.moveTo(0,sy);ctx.quadraticCurveTo(cx,cy,reach,ey);ctx.stroke();ctx.shadowBlur=0;

          for(let i=0;i<linkCount;i++){
            const u=(i+.36)/(linkCount+.15),v=1-u;
            const x=2*v*u*cx+u*u*reach;
            const y=v*v*sy+2*v*u*cy+u*u*ey;
            const dx=2*v*cx+2*u*(reach-cx);
            const dy=2*v*(cy-sy)+2*u*(ey-cy);
            const tangent=Math.atan2(dy,dx);
            const big=(strand===Math.floor(chains/2));
            const lw=(big?19:15)*(1+.07*Math.sin(i*2.7+t*7));
            const lh=(big?9.3:7.4);
            ctx.save();ctx.translate(x,y);ctx.rotate(tangent+(i%2?Math.PI*.50:-Math.PI*.50));
            // Outer red glow/rim.
            ctx.shadowColor='#ff1d35';ctx.shadowBlur=20;ctx.strokeStyle='rgba(255,31,49,.99)';ctx.lineWidth=5.2;
            ctx.fillStyle='rgba(1,1,3,.99)';ctx.beginPath();ctx.ellipse(0,0,lw,lh,0,0,TAU);ctx.fill();ctx.stroke();
            // Inner hole makes every element read as an actual chain link.
            ctx.shadowBlur=8;ctx.strokeStyle='rgba(118,0,17,.92)';ctx.lineWidth=2.2;ctx.beginPath();ctx.ellipse(0,0,lw*.56,lh*.44,0,0,TAU);ctx.stroke();
            // Razor-red specular edge.
            ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,116,125,.82)';ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(0,0,lw*.80,-2.70,-.42);ctx.stroke();
            ctx.restore();
          }
        }

        // Red fracture sparks around the Fa Jin chain.
        ctx.shadowColor='#ff263d';ctx.shadowBlur=19;ctx.strokeStyle='rgba(255,42,59,.98)';ctx.lineWidth=2.7;
        const sparks=renderPressure>=2?7:12;
        for(let k=0;k<sparks;k++){
          const u=(k+1)/(sparks+1),xx=reach*u,yy=Math.sin(u*21+t*5+k)*28;
          ctx.beginPath();ctx.moveTo(xx-17,yy);ctx.lineTo(xx-7,yy+(k%2?-13:13));ctx.lineTo(xx+2,yy-4);ctx.lineTo(xx+15,yy+(k%3?8:-10));ctx.stroke();
        }
        // Heavy hooked chain head.
        ctx.save();ctx.translate(reach+5,Math.sin(t*4.2)*10);ctx.rotate(.10*Math.sin(t*5));
        ctx.shadowColor='#ff1d35';ctx.shadowBlur=26;ctx.fillStyle='rgba(2,2,4,.99)';ctx.strokeStyle='#ff263b';ctx.lineWidth=5;
        ctx.beginPath();ctx.moveTo(28,0);ctx.lineTo(2,-18);ctx.lineTo(-12,-8);ctx.lineTo(3,0);ctx.lineTo(-12,9);ctx.lineTo(2,19);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
        ctx.shadowBlur=0;
      }else{
        // Normal Blackwhip: layered organic black tendrils with a bright teal rim and inner highlights.
        const strands=5;
        for(let strand=0;strand<strands;strand++){
          const centered=strand-(strands-1)/2;
          const baseY=centered*12,endY=centered*24+Math.sin(t*3.2+strand*2.15+f.x*.003)*15;
          const reach=len*(1-Math.abs(centered)*.034)*grow;
          const half=18+(strand%2?6:2);
          ctx.beginPath();ctx.moveTo(-5,baseY*.12-half*.22);ctx.quadraticCurveTo(reach*.30,baseY-half*1.18,reach*.70,endY-half*.58);ctx.lineTo(reach+19,endY);ctx.quadraticCurveTo(reach*.69,endY+half*.60,reach*.25,baseY+half*1.10);ctx.closePath();
          ctx.shadowColor='#39ecf0';ctx.shadowBlur=28;ctx.fillStyle='rgba(2,7,11,.99)';ctx.fill();ctx.strokeStyle='rgba(66,237,241,.99)';ctx.lineWidth=5;ctx.stroke();ctx.shadowBlur=0;
          ctx.strokeStyle='rgba(181,255,253,.52)';ctx.lineWidth=1.45;ctx.beginPath();ctx.moveTo(12,baseY*.20);ctx.quadraticCurveTo(reach*.47,baseY-half*.58,reach*.91,endY-2);ctx.stroke();
        }
        // Small cyan electrical fractures on the organic whip.
        ctx.shadowColor='#51f7f1';ctx.shadowBlur=13;ctx.strokeStyle='rgba(89,247,241,.88)';ctx.lineWidth=2.1;
        for(let k=1;k<=8;k++){
          const u=k/9,xx=len*u,yy=Math.sin(u*19+t*4.5)*19;
          ctx.beginPath();ctx.moveTo(xx-13,yy);ctx.lineTo(xx-4,yy-(k%2?10:-10));ctx.lineTo(xx+6,yy+4);ctx.lineTo(xx+14,yy-(k%3?3:-6));ctx.stroke();
        }
        ctx.shadowBlur=0;
      }
      ctx.lineCap='butt';ctx.lineJoin='miter';
    }else if(f.type==='dekuWhipElasticDash'){
      // V5.51: elastic snap-back dash after Blackwhip misses every player.
      const len=Math.max(20,f.radius),boost=f.variant==='faJin',head=len*(.30+.70*q);
      ctx.lineCap='round';ctx.shadowColor=boost?'#ff233b':'#5ef5eb';ctx.shadowBlur=boost?30:21;
      ctx.strokeStyle=boost?'rgba(255,42,59,.98)':'rgba(92,246,235,.94)';ctx.lineWidth=boost?8:5.5;
      ctx.beginPath();ctx.moveTo(-10,0);ctx.quadraticCurveTo(head*.28,Math.sin(q*Math.PI)*24,head,0);ctx.stroke();
      ctx.strokeStyle='rgba(228,255,253,.94)';ctx.lineWidth=2.6;
      for(let k=-2;k<=2;k++){const yy=k*9;ctx.beginPath();ctx.moveTo(-35-Math.abs(k)*10,yy);ctx.lineTo(head*.42,yy*.38);ctx.stroke()}
      ctx.strokeStyle=boost?'rgba(3,2,4,.98)':'rgba(5,16,22,.92)';ctx.lineWidth=boost?12:8;
      ctx.beginPath();ctx.moveTo(-4,-5);ctx.quadraticCurveTo(head*.45,-22,head*.78,-4);ctx.stroke();
      if(boost){ctx.strokeStyle='rgba(255,45,61,.95)';ctx.lineWidth=2.4;for(let k=1;k<=6;k++){const xx=head*k/7,yy=Math.sin(k*2.4+t*5)*10;ctx.beginPath();ctx.moveTo(xx-8,yy);ctx.lineTo(xx,yy+(k%2?-8:8));ctx.lineTo(xx+8,yy-2);ctx.stroke()}}
      ctx.shadowBlur=0;ctx.lineCap='butt';
    }else if(f.type==='dekuFaJinAttack'){
      // Any Deku attack released while Fa Jin is active gets a distinct kinetic-discharge flash.
      const rr=f.radius*(.28+.72*q);
      ctx.shadowColor='#62f5e8';ctx.shadowBlur=22;ctx.strokeStyle='rgba(215,255,252,.96)';ctx.lineWidth=4*p+1;
      ctx.beginPath();ctx.ellipse(rr*.20,0,rr*.60,rr*.23,0,0,TAU);ctx.stroke();
      ctx.strokeStyle='rgba(91,241,229,.90)';ctx.lineWidth=3;
      for(let k=-2;k<=2;k++){const yy=k*8;ctx.beginPath();ctx.moveTo(-18,yy);ctx.lineTo(rr*.38,yy+(k%2?8:-8));ctx.lineTo(rr*.90,yy*.22);ctx.stroke()}
      ctx.strokeStyle='rgba(166,255,110,.92)';ctx.lineWidth=2.3;
      for(let k=0;k<5;k++){const aa=-.55+k*.27;ctx.beginPath();ctx.moveTo(8,Math.sin(k)*7);ctx.lineTo(rr*.48,Math.sin(aa)*rr*.32);ctx.lineTo(rr*.90,Math.sin(aa+.16)*rr*.42);ctx.stroke()}
      ctx.shadowBlur=0;
    }else if(f.type==='dekuFaJin'){
      // Fa Jin release: stored kinetic energy bursts outward in green lightning and impact rings.
      ctx.rotate(-f.angle); // keep the circular discharge stable on screen
      const rr=f.radius*(.30+.70*q);
      ctx.shadowColor='#8cff67';ctx.shadowBlur=22;ctx.strokeStyle='rgba(210,255,186,.95)';ctx.lineWidth=5*p+1;
      for(let k=0;k<3;k++){ctx.beginPath();ctx.arc(0,0,rr*(.50+k*.23),0,TAU);ctx.stroke()}
      ctx.strokeStyle='#83ff63';ctx.lineWidth=3.2;
      for(let k=0;k<9;k++){
        const aa=k*TAU/9+t*.9,inner=22+6*Math.sin(t*6+k),outer=rr*(.80+.18*Math.sin(k*3.1));
        const mx=Math.cos(aa+.14)*((inner+outer)*.55),my=Math.sin(aa+.14)*((inner+outer)*.55);
        ctx.beginPath();ctx.moveTo(Math.cos(aa)*inner,Math.sin(aa)*inner);ctx.lineTo(mx,my);ctx.lineTo(Math.cos(aa-.06)*outer,Math.sin(aa-.06)*outer);ctx.stroke();
      }
      ctx.globalAlpha*=.35;ctx.fillStyle='#baff70';ctx.beginPath();ctx.arc(0,0,rr*.56,0,TAU);ctx.fill();ctx.shadowBlur=0;
    }else if(f.type==='dekuGearshift'){
      // Gearshift: blue-white acceleration rings + green OFA electricity and long speed cuts.
      const rr=f.radius*(.38+.62*q);ctx.shadowColor='#6feeff';ctx.shadowBlur=24;
      ctx.strokeStyle='rgba(205,252,255,.95)';ctx.lineWidth=5*p+1;
      for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(0,0,rr*(.55+k*.20),rr*(.22+k*.07),k*.45+q*1.6,0,TAU);ctx.stroke()}
      ctx.strokeStyle='#70e8ff';ctx.lineWidth=3;
      for(let k=-3;k<=3;k++){const yy=k*12;ctx.beginPath();ctx.moveTo(-rr*(.9+.08*Math.abs(k)),yy);ctx.lineTo(rr*.78,yy*.40);ctx.stroke()}
      ctx.strokeStyle='#9dff70';ctx.lineWidth=2.4;
      for(let k=0;k<6;k++){const aa=k*TAU/6+t*1.8;ctx.beginPath();ctx.moveTo(Math.cos(aa)*24,Math.sin(aa)*24);ctx.lineTo(Math.cos(aa+.12)*rr*.70,Math.sin(aa+.12)*rr*.70);ctx.lineTo(Math.cos(aa-.05)*rr*.92,Math.sin(aa-.05)*rr*.92);ctx.stroke()}
      ctx.shadowBlur=0;
    }else if(f.type==='dekuStun'){
      ctx.rotate(-f.angle);ctx.strokeStyle='#a7ff70';ctx.shadowColor='#8aff5f';ctx.shadowBlur=16;ctx.lineWidth=3;
      for(let k=0;k<6;k++){const aa=k*TAU/6+t*2.4;ctx.beginPath();ctx.moveTo(Math.cos(aa)*26,Math.sin(aa)*26);ctx.lineTo(Math.cos(aa+.18)*f.radius*.72,Math.sin(aa+.18)*f.radius*.72);ctx.lineTo(Math.cos(aa-.08)*f.radius,Math.sin(aa-.08)*f.radius);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='skill2-rocket'){
      ctx.strokeStyle='#ffc16c';ctx.lineWidth=7*p+1;ctx.shadowColor='#ffc16c';ctx.shadowBlur=16;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,f.radius*q*(.55+i*.18),0,TAU);ctx.stroke()}
      ctx.shadowBlur=0;
    }else if(f.type==='skill2-ring'){
      ctx.strokeStyle='#dfc8ff';ctx.lineWidth=7*p+1;ctx.shadowColor='#c49bff';ctx.shadowBlur=18;
      ctx.beginPath();ctx.ellipse(0,0,f.radius*q,f.radius*q*.34,0,0,TAU);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,0,f.radius*q*.72,f.radius*q*.22,Math.PI/2,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='skill2-nova'){
      ctx.strokeStyle='#9db1ff';ctx.lineWidth=5*p+1;ctx.shadowColor='#859fff';ctx.shadowBlur=18;
      for(let i=0;i<8;i++){const a=i*TAU/8+q;ctx.beginPath();ctx.moveTo(Math.cos(a)*f.radius*.2,Math.sin(a)*f.radius*.2);ctx.lineTo(Math.cos(a)*f.radius*q,Math.sin(a)*f.radius*q);ctx.stroke()}
      ctx.shadowBlur=0;
    }else if(f.type==='spreadShardBurst'){
      ctx.strokeStyle='#7bf6ff';ctx.lineWidth=2.5;for(const off of [-.42,.42]){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(off)*f.radius*q,Math.sin(off)*f.radius*q);ctx.stroke()}
    }else if(f.type==='novaFragmentBurst'){
      ctx.strokeStyle='#8bf5ff';ctx.lineWidth=2;ctx.shadowColor='#8bf5ff';ctx.shadowBlur=10;for(let i=0;i<4;i++){const aa=i*TAU/4+Math.PI/4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(aa)*f.radius*q,Math.sin(aa)*f.radius*q);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='pierceAccel'){
      ctx.strokeStyle='#d2baff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,f.radius*q,0,TAU);ctx.stroke();
    }else if(f.type==='ringReturn'){
      ctx.strokeStyle='#e3d4ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,f.radius*q,Math.PI*.65,Math.PI*1.35);ctx.stroke();
    }else if(f.type==='chainArc'){
      const[x2,y2]=worldToScreen(f.x2,f.y2);ctx.restore();ctx.save();ctx.globalAlpha=Math.min(1,p*1.4);ctx.strokeStyle='#8af7ff';ctx.lineWidth=3;ctx.shadowColor='#6cf4ff';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(x,y);const mx=(x+x2)/2+rand(-18,18),my=(y+y2)/2+rand(-18,18);ctx.lineTo(mx,my);ctx.lineTo(x2,y2);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='errorSwordSwing'){
      // Wide slash trail matching the enlarged melee cone.
      ctx.shadowColor='#72ff43';ctx.shadowBlur=23;
      ctx.lineCap='round';

      ctx.strokeStyle='#72ff43';ctx.lineWidth=13*p+3;
      ctx.beginPath();ctx.arc(0,0,f.radius*(.46+.46*q),-1.34,1.34);ctx.stroke();

      ctx.strokeStyle='#ff42df';ctx.lineWidth=7*p+1;
      ctx.beginPath();ctx.arc(5,0,f.radius*(.51+.43*q),-1.27,1.27);ctx.stroke();

      ctx.strokeStyle='#42eaff';ctx.lineWidth=3.3;
      ctx.beginPath();ctx.arc(-4,0,f.radius*(.41+.51*q),-1.40,1.40);ctx.stroke();

      ctx.globalAlpha*=.48;
      ctx.strokeStyle='#eaffff';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,f.radius*(.56+.38*q),-1.18,1.18);ctx.stroke();

      ctx.shadowBlur=0;ctx.lineCap='butt';
    }else if(f.type==='errorSwordCast'){
      ctx.shadowColor='#72ff43';ctx.shadowBlur=22;
      ctx.strokeStyle='#72ff43';ctx.lineWidth=8*p+2;
      ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(f.radius*q,0);ctx.stroke();
      ctx.strokeStyle='#ff42df';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,-10);ctx.lineTo(f.radius*q*.85,-5);ctx.stroke();
      ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.moveTo(-15,10);ctx.lineTo(f.radius*q*.85,5);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='errorSwordDash'){
      ctx.globalAlpha*=.75;
      ctx.strokeStyle='#72ff43';ctx.lineWidth=8*p+2;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(f.radius*q,-8);ctx.stroke();
      ctx.strokeStyle='#ff42df';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(f.radius*q*.92,0);ctx.stroke();
      ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(f.radius*q*.82,8);ctx.stroke();
    }else if(f.type==='errorImpact'){
      const pulse=.55+.45*Math.sin(performance.now()*.035+f.x*.02);
      ctx.globalAlpha*=pulse;
      ctx.strokeStyle='#72ff43';ctx.lineWidth=4*p+1;
      ctx.beginPath();ctx.arc(0,0,f.radius*q*.55,0,TAU);ctx.stroke();
      ctx.strokeStyle='#ff42df';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(rand(-5,5),rand(-5,5),f.radius*q*.38,0,TAU);ctx.stroke();
      ctx.strokeStyle='#42eaff';ctx.lineWidth=2;
      for(let k=0;k<4;k++){
        const yy=(k-1.5)*8+rand(-2,2);
        ctx.beginPath();ctx.moveTo(-f.radius*q*.45,yy);ctx.lineTo(f.radius*q*.45,yy+rand(-5,5));ctx.stroke();
      }
    }else if(f.type==='errorPierce'){
      ctx.strokeStyle='#72ff43';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(0,0,f.radius*q,0,TAU);ctx.stroke();
      ctx.strokeStyle='#ff42df';
      ctx.beginPath();ctx.moveTo(-f.radius*q,0);ctx.lineTo(f.radius*q,0);ctx.stroke();
    }else if(f.type==='errorDashTrace'){
      const flicker=.55+.45*Math.sin(performance.now()*.04+f.x*.03);
      ctx.globalAlpha*=flicker;
      ctx.strokeStyle='#72ff43';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(-f.radius*.75,0);ctx.lineTo(f.radius*.45,0);ctx.stroke();
      ctx.strokeStyle='#ff42df';ctx.beginPath();ctx.moveTo(-f.radius*.55,-6);ctx.lineTo(f.radius*.30,-6);ctx.stroke();
      ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.moveTo(-f.radius*.65,6);ctx.lineTo(f.radius*.40,6);ctx.stroke();
      ctx.fillStyle='#0b0d0e';ctx.fillRect(-7,-7,14,14);
      ctx.strokeStyle='#72ff43';ctx.strokeRect(-7+Math.sin(performance.now()*.03)*2,-7,14,14);
    }else if(f.type==='skill2-error'){
      ctx.strokeStyle='#72ff43';ctx.lineWidth=4;ctx.strokeRect(-f.radius*q*.55,-f.radius*q*.55,f.radius*q*1.1,f.radius*q*1.1);
      ctx.strokeStyle='#ff42df';ctx.strokeRect(-f.radius*q*.42+8,-f.radius*q*.58,f.radius*q*.84,f.radius*q*1.16);
      ctx.fillStyle='#47eaff';for(let i=0;i<6;i++)ctx.fillRect(rand(-f.radius*q,f.radius*q),rand(-f.radius*q,f.radius*q),rand(8,24),4);
    }else if(f.type.startsWith('skill-')){
      const cannon=f.type.slice(6);
      if(cannon==='standard'){
        ctx.shadowColor='#69c8ff';ctx.shadowBlur=16;
        ctx.strokeStyle='#c9f1ff';ctx.lineWidth=6*p+1;
        ctx.beginPath();ctx.arc(0,0,f.radius*q*.62,0,TAU);ctx.stroke();
        ctx.strokeStyle='#5ebdff';ctx.lineWidth=3;
        for(let i=0;i<4;i++){const aa=i*TAU/4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(aa)*f.radius*q,Math.sin(aa)*f.radius*q);ctx.stroke()}
        ctx.shadowBlur=0;
      }else if(cannon==='rapid'){
        ctx.strokeStyle='#73f5a3';ctx.lineWidth=3;
        for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(-f.radius*q*.25,i*6);ctx.lineTo(f.radius*q*(.55+Math.abs(i)*.05),i*6);ctx.stroke()}
      }else if(cannon==='spread'){
        ctx.strokeStyle='#78f6ff';ctx.lineWidth=2.5;
        for(let i=-5;i<=5;i++){
          const aa=i*.10;
          ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(aa)*f.radius*q,Math.sin(aa)*f.radius*q);ctx.stroke();
        }
      }else if(cannon==='piercer'){
        ctx.shadowColor='#c4a2ff';ctx.shadowBlur=18;
        ctx.strokeStyle='#eadfff';ctx.lineWidth=7*p+1;
        ctx.beginPath();ctx.moveTo(-f.radius*q,0);ctx.lineTo(f.radius*q,0);ctx.stroke();
        ctx.strokeStyle='#9e70ee';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-f.radius*q,-10);ctx.lineTo(f.radius*q,0);ctx.lineTo(-f.radius*q,10);ctx.stroke();
        ctx.shadowBlur=0;
      }else if(cannon==='plasma'){
        ctx.strokeStyle='#70f4ff';ctx.lineWidth=5*p+1;for(let i=0;i<8;i++){const a=i*TAU/8+tickerAngle();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*f.radius*q,Math.sin(a)*f.radius*q);ctx.stroke()}
      }else if(cannon==='rocket'){
        ctx.strokeStyle='#ff9b4a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,f.radius*q,Math.PI*1.2,Math.PI*1.8);ctx.stroke();
      }else if(cannon==='ring'){
        ctx.strokeStyle='#c6a2ff';ctx.lineWidth=6*p+1;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,f.radius*q*(.35+i*.22),0,TAU);ctx.stroke()}
      }else if(cannon==='nova'){
        ctx.shadowColor='#74efff';ctx.shadowBlur=24;ctx.strokeStyle='#b7fbff';ctx.lineWidth=9*p+1;ctx.beginPath();ctx.arc(0,0,f.radius*q,0,TAU);ctx.stroke();ctx.shadowBlur=0;
      }else if(cannon==='error'){
        ctx.strokeStyle='#76ff43';ctx.lineWidth=3;ctx.strokeRect(-f.radius*q*.5,-f.radius*q*.5,f.radius*q,f.radius*q);
        ctx.strokeStyle='#ff3fe2';ctx.strokeRect(-f.radius*q*.48+6,-f.radius*q*.52,f.radius*q*.96,f.radius*q*1.04);
      }
    }
    ctx.restore();
  }
}
function tickerAngle(){return performance.now()*.003}


function drawUniqueProjectile(b,time,phase){
  const shape=b.shape;
  const playerColor=b.team==='player';
  const pulse=1+.10*Math.sin(time*8+(b.motionSeed||0));

  if(shape==='standardSlug'){
    ctx.shadowColor='#55c9ff';ctx.shadowBlur=13;ctx.fillStyle='#e8fbff';ctx.strokeStyle='#3c91cf';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(0,0,b.r+2,b.r*.72,0,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#55cfff';ctx.beginPath();ctx.arc(3,0,b.r*.42,0,TAU);ctx.fill();ctx.shadowBlur=0;return true;
  }
  if(shape==='scoutArrow'){
    ctx.shadowColor='#6cecff';ctx.shadowBlur=12;ctx.fillStyle='#dfffff';ctx.strokeStyle='#48cde7';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-5,-7);ctx.lineTo(-1,0);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(105,234,255,.55)';ctx.beginPath();ctx.moveTo(-28,0);ctx.lineTo(-5,0);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='bastionShell'){
    ctx.shadowColor='#a8c8df';ctx.shadowBlur=10;ctx.fillStyle='#71869a';ctx.strokeStyle='#d9e9f4';ctx.lineWidth=2;
    ctx.beginPath();for(let k=0;k<6;k++){const q=k*TAU/6,x=Math.cos(q)*11,y=Math.sin(q)*8;k?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#263442';ctx.fillRect(-5,-3,10,6);return true;
  }
  if(shape==='rapidTracer'){
    ctx.shadowColor='#70f3a0';ctx.shadowBlur=10;ctx.fillStyle='#dffff0';ctx.fillRect(-8,-3,17,6);ctx.fillStyle='#64e892';ctx.fillRect(2,-2,8,4);
    ctx.globalAlpha=.45;ctx.fillStyle='#70f3a0';for(let y of [-7,0,7])ctx.fillRect(-31,y-1,20,2);ctx.globalAlpha=1;ctx.shadowBlur=0;return true;
  }
  if(shape==='dualPulse'){
    ctx.shadowColor='#77ffd3';ctx.shadowBlur=13;ctx.fillStyle='#eafff7';
    ctx.beginPath();ctx.arc(3,-5,5,0,TAU);ctx.arc(3,5,5,0,TAU);ctx.fill();ctx.strokeStyle='#47c99e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,-5);ctx.lineTo(3,-5);ctx.moveTo(-8,5);ctx.lineTo(3,5);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='needleDart'){
    ctx.shadowColor='#c6ff76';ctx.shadowBlur=9;ctx.strokeStyle='#ecffd1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-19,0);ctx.lineTo(17,0);ctx.stroke();ctx.fillStyle='#a9e65d';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(6,-3);ctx.lineTo(6,3);ctx.closePath();ctx.fill();ctx.shadowBlur=0;return true;
  }
  if(shape==='spreadShard'){
    ctx.shadowColor='#71f4ff';ctx.shadowBlur=10;ctx.fillStyle='#9cfaff';ctx.strokeStyle='#3baab6';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-7,-7);ctx.lineTo(-2,0);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='burstDisc'){
    ctx.rotate(time*7+(b.motionSeed||0));ctx.shadowColor='#61eafa';ctx.shadowBlur=12;ctx.strokeStyle='#d5feff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.stroke();ctx.strokeStyle='#45b9c8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.moveTo(0,-10);ctx.lineTo(0,10);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='crystalShard'){
    ctx.rotate(time*3);ctx.shadowColor='#bcf9ff';ctx.shadowBlur=15;const g=ctx.createLinearGradient(-8,-8,9,9);g.addColorStop(0,'#4fa6c6');g.addColorStop(.5,'#c8fdff');g.addColorStop(1,'#7cbbff');ctx.fillStyle=g;ctx.strokeStyle='#e9ffff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(0,-9);ctx.lineTo(-10,0);ctx.lineTo(0,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='piercerLance'){
    ctx.globalAlpha=.25;ctx.fillStyle='#b780ff';ctx.fillRect(-52,-2,38,4);ctx.globalAlpha=1;ctx.shadowColor='#b98aff';ctx.shadowBlur=16;ctx.fillStyle='#d9c7ff';ctx.strokeStyle='#8355cf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(21,0);ctx.lineTo(2,-5);ctx.lineTo(-17,-3);ctx.lineTo(-23,0);ctx.lineTo(-17,3);ctx.lineTo(2,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='laserRay'){
    ctx.shadowColor='#e1a8ff';ctx.shadowBlur=18;ctx.fillStyle='#fff';ctx.fillRect(-28,-2,54,4);ctx.globalAlpha=.55;ctx.fillStyle='#bd72ff';ctx.fillRect(-44,-5,60,2);ctx.fillRect(-44,3,60,2);ctx.globalAlpha=1;ctx.shadowBlur=0;return true;
  }
  if(shape==='drillBit'){
    ctx.rotate(time*10+(b.motionSeed||0));ctx.shadowColor='#a889ff';ctx.shadowBlur=13;ctx.strokeStyle='#e6dcff';ctx.lineWidth=2.2;
    for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(16,0);ctx.quadraticCurveTo(0,-10+k*7,-15,0);ctx.stroke();ctx.rotate(TAU/3)}ctx.fillStyle='#7752bf';ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();ctx.shadowBlur=0;return true;
  }
  if(shape==='plasmaOrb'){
    ctx.shadowColor='#62ebff';ctx.shadowBlur=24;const g=ctx.createRadialGradient(-4,-4,1,0,0,15*pulse);g.addColorStop(0,'#fff');g.addColorStop(.35,'#a9ffff');g.addColorStop(1,'#2778cf');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,14*pulse,0,TAU);ctx.fill();ctx.strokeStyle='#d7ffff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,19,7,time*3,0,TAU);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='thunderOrb'){
    ctx.shadowColor='#fff36e';ctx.shadowBlur=22;ctx.fillStyle='#fff9a8';ctx.beginPath();ctx.arc(0,0,10*pulse,0,TAU);ctx.fill();ctx.strokeStyle='#5fe7ff';ctx.lineWidth=2.5;
    for(let k=0;k<4;k++){const q=k*TAU/4+time*2;ctx.beginPath();ctx.moveTo(Math.cos(q)*8,Math.sin(q)*8);ctx.lineTo(Math.cos(q+.23)*18,Math.sin(q+.23)*18);ctx.lineTo(Math.cos(q-.12)*13,Math.sin(q-.12)*13);ctx.stroke()}ctx.shadowBlur=0;return true;
  }
  if(shape==='infernoBall'){
    ctx.shadowColor='#ff6538';ctx.shadowBlur=22;ctx.fillStyle='#ffcf5a';ctx.beginPath();ctx.arc(3,0,9*pulse,0,TAU);ctx.fill();ctx.fillStyle='#ff633b';ctx.beginPath();ctx.moveTo(-4,-8);ctx.quadraticCurveTo(-30,0,-7,8);ctx.quadraticCurveTo(-18,0,-4,-8);ctx.fill();ctx.shadowBlur=0;return true;
  }
  if(shape==='rocketMissile'){
    ctx.shadowColor='#ff8d3a';ctx.shadowBlur=10;ctx.fillStyle='#e7ecef';ctx.strokeStyle='#59636c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(17,0);ctx.quadraticCurveTo(8,-8,-8,-7);ctx.lineTo(-13,-4);ctx.lineTo(-13,4);ctx.lineTo(-8,7);ctx.quadraticCurveTo(8,8,17,0);ctx.fill();ctx.stroke();ctx.fillStyle='#ff8b38';ctx.beginPath();ctx.moveTo(-12,-4);ctx.lineTo(-29,0);ctx.lineTo(-12,4);ctx.fill();ctx.shadowBlur=0;return true;
  }
  if(shape==='titanShell'){
    ctx.shadowColor='#ffbf76';ctx.shadowBlur=15;ctx.fillStyle='#6d625c';ctx.strokeStyle='#ffd7a6';ctx.lineWidth=2.5;ctx.fillRect(-11,-10,22,20);ctx.strokeRect(-11,-10,22,20);ctx.fillStyle='#ff9c47';ctx.fillRect(4,-6,8,12);ctx.strokeStyle='#2e2926';ctx.beginPath();ctx.moveTo(-7,-7);ctx.lineTo(7,7);ctx.moveTo(-7,7);ctx.lineTo(7,-7);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='phantomBolt'){
    ctx.globalAlpha=.72;ctx.shadowColor='#c7b6ff';ctx.shadowBlur=18;ctx.strokeStyle='#e9e2ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(-4,0,13,-1.0,1.0);ctx.stroke();ctx.strokeStyle='#8b76d8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(1,0,17,-.9,.9);ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;return true;
  }
  if(shape==='dimensionRing'){
    ctx.shadowColor='#b58cff';ctx.shadowBlur=17;ctx.strokeStyle='#e1d4ff';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,13,9,time*2.6,0,TAU);ctx.stroke();ctx.strokeStyle='#8f61e7';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,8,14,-time*3.1,0,TAU);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='chronoRing'){
    ctx.rotate(time*2);ctx.shadowColor='#a7e9ff';ctx.shadowBlur=17;ctx.strokeStyle='#dff9ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,12,0,TAU);ctx.stroke();ctx.strokeStyle='#69bce7';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-9);ctx.moveTo(0,0);ctx.lineTo(7,4);ctx.stroke();for(let k=0;k<4;k++){const q=k*TAU/4;ctx.fillStyle='#dfffff';ctx.fillRect(Math.cos(q)*12-1,Math.sin(q)*12-1,2,2)}ctx.shadowBlur=0;return true;
  }
  if(shape==='voidOrb'){
    ctx.shadowColor='#9a70ff';ctx.shadowBlur=23;ctx.fillStyle='#08070c';ctx.beginPath();ctx.arc(0,0,12*pulse,0,TAU);ctx.fill();ctx.strokeStyle='#ad8aff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,20,7,time*2.2,0,TAU);ctx.stroke();ctx.strokeStyle='#5a3b8d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,16,0,TAU);ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='novaStar'){
    ctx.rotate(time*2.8);ctx.shadowColor='#73efff';ctx.shadowBlur=19;ctx.fillStyle='#eaffff';ctx.strokeStyle='#58aeea';ctx.lineWidth=1.8;ctx.beginPath();for(let k=0;k<10;k++){const rr=k%2?5:13,q=-Math.PI/2+k*Math.PI/5,x=Math.cos(q)*rr,y=Math.sin(q)*rr;k?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='cometCore'){
    ctx.shadowColor='#68eaff';ctx.shadowBlur=18;ctx.fillStyle='#e9ffff';ctx.beginPath();ctx.arc(7,0,7,0,TAU);ctx.fill();const g=ctx.createLinearGradient(-46,0,2,0);g.addColorStop(0,'rgba(70,220,255,0)');g.addColorStop(1,'rgba(86,235,255,.9)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-48,-8);ctx.lineTo(4,-4);ctx.lineTo(4,4);ctx.lineTo(-48,8);ctx.closePath();ctx.fill();ctx.shadowBlur=0;return true;
  }
  if(shape==='stellarStar'){
    ctx.rotate(time*4+(b.motionSeed||0));ctx.shadowColor='#f0ffff';ctx.shadowBlur=21;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(4,4);ctx.lineTo(0,15);ctx.lineTo(-4,4);ctx.lineTo(-15,0);ctx.lineTo(-4,-4);ctx.lineTo(0,-15);ctx.lineTo(4,-4);ctx.closePath();ctx.fill();ctx.strokeStyle='#9edfff';ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;return true;
  }
  if(shape==='dekuAirForce'){
    const special=String(b.special||''),faJin=special.startsWith('faJin');
    const smash=special.includes('DetroitAirSmash')||special==='detroitAirSmash',size=smash?1.55:1;
    // AIR FORCE: compressed wind. During Fa Jin it becomes a denser cyan/green kinetic shock.
    ctx.globalAlpha=.90;ctx.shadowColor=faJin?'#63f5e9':(smash?'#d8ffb0':'#c8fff0');ctx.shadowBlur=faJin?(smash?28:20):(smash?20:10);
    ctx.strokeStyle=faJin?'rgba(220,255,255,.98)':'rgba(244,255,251,.95)';ctx.lineWidth=smash?4.5:2.8;
    ctx.beginPath();ctx.arc(2,0,(smash?15:9)*pulse,-1.18,1.18);ctx.stroke();
    ctx.strokeStyle=faJin?'rgba(80,239,230,.88)':(smash?'rgba(174,255,111,.78)':'rgba(151,255,210,.65)');ctx.lineWidth=faJin?(smash?4:2.6):(smash?3:1.8);
    for(let k=-1;k<=1;k++){const yy=k*(smash?8:5);ctx.beginPath();ctx.moveTo(-34*size,yy);ctx.quadraticCurveTo(-9*size,yy*1.4,10*size,yy*.45);ctx.stroke()}
    if(faJin){
      ctx.strokeStyle='rgba(160,255,113,.92)';ctx.lineWidth=2.2;
      for(let k=-2;k<=2;k++){const yy=k*5;ctx.beginPath();ctx.moveTo(-28*size,yy);ctx.lineTo(-14*size,yy+(k%2?7:-7));ctx.lineTo(4*size,yy*.3);ctx.stroke()}
    }
    if(smash){ctx.globalAlpha=.34;ctx.fillStyle=faJin?'#64f1e8':'#baff70';ctx.beginPath();ctx.moveTo(-8,-15);ctx.lineTo(30,0);ctx.lineTo(-8,15);ctx.closePath();ctx.fill()}
    ctx.globalAlpha=1;ctx.shadowBlur=0;return true
  }
  if(shape==='errorBlock'){
    const gl=Math.sin(phase*4)>0?2:-2;ctx.shadowColor='#72ff45';ctx.shadowBlur=13;ctx.fillStyle='#070808';ctx.fillRect(-11,-9,22,18);ctx.lineWidth=2.5;ctx.strokeStyle='#72ff45';ctx.strokeRect(-11+gl,-9,22,18);ctx.strokeStyle='#ff3bea';ctx.strokeRect(-11-gl,-8,22,17);ctx.strokeStyle='#42eaff';ctx.strokeRect(-10,-9+gl,21,18);ctx.shadowBlur=0;return true;
  }
  if(shape==='glitchPacket'){
    const gl=Math.sin(phase*7)*5;ctx.globalAlpha=.85;ctx.fillStyle='#ff42df';ctx.fillRect(-14+gl,-8,14,5);ctx.fillStyle='#42eaff';ctx.fillRect(-7-gl,0,18,5);ctx.fillStyle='#72ff43';ctx.fillRect(-18,7,11,3);ctx.globalAlpha=1;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.strokeRect(-9+gl*.3,-6,18,12);return true;
  }
  if(shape==='zeroCore'){
    ctx.shadowColor='#ffffff';ctx.shadowBlur=23;ctx.fillStyle='#050506';ctx.beginPath();ctx.arc(0,0,13*pulse,0,TAU);ctx.fill();ctx.strokeStyle='#f4f7ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,13*pulse,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(-8,8);ctx.lineTo(8,-8);ctx.stroke();ctx.globalAlpha=.45;ctx.fillStyle='#fff';ctx.fillRect(-37,-1,22,2);ctx.globalAlpha=1;ctx.shadowBlur=0;return true;
  }
  return false;
}

function drawBullets(){
  const time=performance.now()*.001;
  let remoteVisualIndex=0;
  for(const b of bullets){
    if(!screenVisibleWorld(b.x,b.y,190))continue;
    if(b.networkRemote&&renderPressure>=2&&((remoteVisualIndex++)&1))continue;
    const[x,y]=worldToScreen(b.x,b.y);
    const a=fxAngleFromVector(b.vx,b.vy,0);
    const phase=b.x*.013+b.y*.017+time*5;
    ctx.save();ctx.translate(x,y);ctx.rotate(a);

    if(drawUniqueProjectile(b,time,phase)){
      // 27개 캐릭터의 고유 탄환은 위 전용 렌더러에서 처리.
    }

    // Legacy/passive projectile fallback
    else if(b.shape==='round'){
      ctx.globalAlpha=.20;
      const trail=ctx.createLinearGradient(-34,0,1,0);
      trail.addColorStop(0,'rgba(70,180,255,0)');
      trail.addColorStop(1,b.team==='player'?'rgba(91,207,255,.95)':'rgba(255,105,115,.95)');
      ctx.fillStyle=trail;
      ctx.beginPath();ctx.moveTo(-34,-5);ctx.lineTo(1,-3);ctx.lineTo(1,3);ctx.lineTo(-34,5);ctx.closePath();ctx.fill();
      ctx.globalAlpha=1;
      ctx.shadowColor=b.team==='player'?'#55c9ff':'#ff6674';ctx.shadowBlur=13;
      ctx.fillStyle=b.team==='player'?'#e5fbff':'#ffe5e8';
      ctx.strokeStyle=b.team==='player'?'#388cca':'#c84652';ctx.lineWidth=2.3;
      ctx.beginPath();ctx.ellipse(0,0,b.r+2,b.r*.72,0,0,TAU);ctx.fill();ctx.stroke();
      ctx.fillStyle=b.team==='player'?'#54cfff':'#ff6674';
      ctx.beginPath();ctx.ellipse(2,0,b.r*.52,b.r*.34,0,0,TAU);ctx.fill();
      ctx.shadowBlur=0;
    }

    // RAPID — green high-speed tracer
    else if(b.shape==='capsule'){
      ctx.globalAlpha=.24;ctx.fillStyle='#55f59a';
      ctx.fillRect(-36,-5,25,1.4);ctx.fillRect(-31,0,22,1.3);ctx.fillRect(-39,5,28,1.2);
      ctx.globalAlpha=1;ctx.shadowColor='#56ff9c';ctx.shadowBlur=11;
      const gr=ctx.createLinearGradient(-12,0,11,0);
      gr.addColorStop(0,'#226b45');gr.addColorStop(.38,'#5be895');gr.addColorStop(.72,'#a9ffd0');gr.addColorStop(1,'#ffffff');
      ctx.fillStyle=gr;ctx.strokeStyle='#245e40';ctx.lineWidth=1.7;
      ctx.beginPath();ctx.roundRect(-12,-3.2,24,6.4,3.2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#f2fff7';ctx.fillRect(5,-1,6,2);ctx.shadowBlur=0;
    }

    // SPREAD — cyan crystal shard
    else if(b.shape==='pellet'){
      ctx.rotate(Math.sin(phase)*.18);
      ctx.globalAlpha=.22;ctx.fillStyle='#55f1ff';
      ctx.beginPath();ctx.moveTo(-26,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();
      ctx.globalAlpha=1;ctx.shadowColor='#55efff';ctx.shadowBlur=10;
      const shard=ctx.createLinearGradient(-8,-6,9,5);
      shard.addColorStop(0,'#2e8f9e');shard.addColorStop(.45,'#7af6ff');shard.addColorStop(1,'#efffff');
      ctx.fillStyle=shard;ctx.strokeStyle='#276e79';ctx.lineWidth=1.7;
      ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-1,-7);ctx.lineTo(-9,-1);ctx.lineTo(-3,7);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(6,-1);ctx.lineTo(-2,-4);ctx.stroke();ctx.shadowBlur=0;
    }

    // PIERCER — purple rail lance
    else if(b.shape==='rail'){
      ctx.globalAlpha=.20;
      const tail=ctx.createLinearGradient(-62,0,-4,0);
      tail.addColorStop(0,'rgba(163,95,255,0)');tail.addColorStop(1,'rgba(194,149,255,.9)');
      ctx.fillStyle=tail;ctx.fillRect(-62,-3,58,6);ctx.globalAlpha=1;
      ctx.shadowColor='#b782ff';ctx.shadowBlur=17;
      ctx.fillStyle='#9366dc';ctx.strokeStyle='#e8d8ff';ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(5,-4.5);ctx.lineTo(-14,-3.2);ctx.lineTo(-21,0);ctx.lineTo(-14,3.2);ctx.lineTo(5,4.5);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-13,-1.2);ctx.lineTo(-13,1.2);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(205,172,255,.7)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(5,-4);ctx.moveTo(-9,8);ctx.lineTo(5,4);ctx.stroke();ctx.shadowBlur=0;
    }

    // PLASMA — electric orb with orbiting arcs/electrons
    else if(b.shape==='plasma'){
      const pulse=1+.11*Math.sin(time*9+(b.x+b.y)*.015);
      ctx.shadowColor='#61eaff';ctx.shadowBlur=26;
      const gr=ctx.createRadialGradient(-5,-5,1,0,0,15*pulse);
      gr.addColorStop(0,'#fff');gr.addColorStop(.18,'#d8ffff');gr.addColorStop(.47,'#63eaff');gr.addColorStop(.78,'#337ddd');gr.addColorStop(1,'rgba(29,41,145,.5)');
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,14*pulse,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(203,255,255,.9)';ctx.lineWidth=2;
      for(let k=0;k<3;k++){
        const rot=time*(k%2?3.4:-2.7)+k*2.1;
        ctx.beginPath();ctx.ellipse(0,0,19*pulse,7+k*2,rot,0,TAU);ctx.stroke();
      }
      ctx.fillStyle='#fff';
      for(let k=0;k<4;k++){
        const q=time*(2.5+k*.3)+k*TAU/4;
        ctx.beginPath();ctx.arc(Math.cos(q)*20*pulse,Math.sin(q)*10,2,0,TAU);ctx.fill();
      }
      ctx.shadowBlur=0;
    }

    // ROCKET — metal missile with fins, warning band, flame and smoke
    else if(b.shape==='rocket'){
      ctx.globalAlpha=.20;ctx.fillStyle='rgba(205,220,230,.65)';
      ctx.beginPath();ctx.arc(-31,Math.sin(phase)*4,10,0,TAU);ctx.fill();
      ctx.beginPath();ctx.arc(-45,-Math.cos(phase)*5,13,0,TAU);ctx.fill();ctx.globalAlpha=1;
      ctx.shadowColor='#ff8a2c';ctx.shadowBlur=13;ctx.fillStyle='#ff8a2c';
      ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-29,0);ctx.lineTo(-11,4);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffd75f';ctx.beginPath();ctx.moveTo(-11,-2);ctx.lineTo(-21,0);ctx.lineTo(-11,2);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
      const metal=ctx.createLinearGradient(-11,-8,14,8);
      metal.addColorStop(0,'#5b6873');metal.addColorStop(.38,'#e5ebef');metal.addColorStop(.7,'#98a5af');metal.addColorStop(1,'#56616b');
      ctx.fillStyle=metal;ctx.strokeStyle='#3f4851';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(15,0);ctx.quadraticCurveTo(9,-8,2,-8);ctx.lineTo(-11,-6);ctx.lineTo(-11,6);ctx.lineTo(2,8);ctx.quadraticCurveTo(9,8,15,0);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#d84a39';ctx.fillRect(-1,-7,5,14);
      ctx.fillStyle='#2e3841';
      ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(-15,-12);ctx.lineTo(-5,-7);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(-7,5);ctx.lineTo(-15,12);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();
    }

    // RING — double rotating dimensional rings
    else if(b.shape==='ring'){
      ctx.globalAlpha=.15;ctx.strokeStyle='#b28dff';ctx.lineWidth=8;
      ctx.beginPath();ctx.ellipse(-19,0,14,7,0,0,TAU);ctx.stroke();ctx.globalAlpha=1;
      ctx.shadowColor='#ae86ff';ctx.shadowBlur=18;
      ctx.strokeStyle='#dfd0ff';ctx.lineWidth=4.5;ctx.beginPath();ctx.ellipse(0,0,13,9,time*2.8,0,TAU);ctx.stroke();
      ctx.strokeStyle='#8c60ec';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,8,14,-time*3.2,0,TAU);ctx.stroke();
      ctx.fillStyle='#fff';
      for(let k=0;k<4;k++){
        const q=time*4+k*TAU/4;
        ctx.beginPath();ctx.arc(Math.cos(q)*13,Math.sin(q)*8,1.8,0,TAU);ctx.fill();
      }
      ctx.shadowBlur=0;
    }

    // NOVA — rotating star core with comet tail and satellites
    else if(b.shape==='nova'){
      ctx.globalAlpha=.19;
      const trail=ctx.createLinearGradient(-43,0,-3,0);
      trail.addColorStop(0,'rgba(91,222,255,0)');trail.addColorStop(1,'rgba(106,240,255,.92)');
      ctx.fillStyle=trail;ctx.beginPath();ctx.moveTo(-44,-8);ctx.lineTo(-2,-3);ctx.lineTo(-2,3);ctx.lineTo(-44,8);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      ctx.rotate(time*2.5);ctx.shadowColor='#70f3ff';ctx.shadowBlur=20;
      const star=ctx.createRadialGradient(0,0,1,0,0,13);
      star.addColorStop(0,'#fff');star.addColorStop(.34,'#d9fdff');star.addColorStop(1,'#54a7ff');
      ctx.fillStyle=star;ctx.strokeStyle='#bef9ff';ctx.lineWidth=1.8;
      ctx.beginPath();
      for(let k=0;k<10;k++){
        const rr=k%2===0?13:5.2,aa=-Math.PI/2+k*Math.PI/5;
        const px=Math.cos(aa)*rr,py=Math.sin(aa)*rr;
        k?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#fff';
      for(let k=0;k<3;k++){
        const q=-time*5+k*TAU/3;
        ctx.beginPath();ctx.arc(Math.cos(q)*17,Math.sin(q)*10,1.7,0,TAU);ctx.fill();
      }
      ctx.shadowBlur=0;
    }

    // ERROR SWORD WAVE — 검의 궤적이 그대로 날아가는 RGB 초승달
    else if(b.shape==='errorSwordWave'){
      // b.r is network-synced, so charged Q size also matches on remote clients.
      const sc=Math.max(.45,(Number(b.r)||14)/14);
      const big=b.special==='errorQBlade';
      ctx.shadowColor='#72ff43';ctx.shadowBlur=(big?24:16)*Math.min(2.4,Math.sqrt(sc));
      ctx.globalAlpha=.26;
      ctx.strokeStyle='#42eaff';ctx.lineWidth=(big?10:7)*Math.min(2.1,Math.sqrt(sc));
      ctx.beginPath();ctx.arc(-5*sc,0,24*sc,-1.05,1.05);ctx.stroke();
      ctx.globalAlpha=1;
      ctx.strokeStyle='#72ff43';ctx.lineWidth=(big?6:4.5)*Math.min(2.1,Math.sqrt(sc));
      ctx.beginPath();ctx.arc(0,0,27*sc,-1.08,1.08);ctx.stroke();
      ctx.strokeStyle='#ff42df';ctx.lineWidth=(big?3.2:2.2)*Math.min(2,Math.sqrt(sc));
      ctx.beginPath();ctx.arc(4*sc,0,31*sc,-1.02,1.02);ctx.stroke();
      ctx.fillStyle='#f2ffff';
      ctx.beginPath();ctx.moveTo(22*sc,-5*sc);ctx.lineTo(36*sc,0);ctx.lineTo(22*sc,5*sc);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.35;
      ctx.fillStyle='#72ff43';ctx.fillRect(-48*sc,-2*sc,35*sc,3*sc);
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }

    // ERROR — RGB channel-split glitch block with pixel debris
    else if(b.shape==='error'){
      const glitch=Math.sin(phase*4)>0?2.4:-2.4;
      ctx.globalAlpha=.22;
      ctx.fillStyle='#72ff45';ctx.fillRect(-35,glitch,25,3);
      ctx.fillStyle='#ff3bea';ctx.fillRect(-30,-5-glitch,19,3);
      ctx.fillStyle='#42eaff';ctx.fillRect(-40,7,30,2);ctx.globalAlpha=1;
      ctx.shadowColor='#72ff45';ctx.shadowBlur=13;ctx.fillStyle='#070808';ctx.fillRect(-11,-9,22,18);
      ctx.lineWidth=2.5;
      ctx.strokeStyle='#72ff45';ctx.strokeRect(-11+glitch,-9,22,18);
      ctx.strokeStyle='rgba(255,59,234,.86)';ctx.strokeRect(-11-glitch,-8,22,17);
      ctx.strokeStyle='rgba(66,234,255,.82)';ctx.strokeRect(-10,-9+glitch,21,18);
      ctx.fillStyle='#72ff45';ctx.fillRect(-7,-5,7,3);
      ctx.fillStyle='#ff3bea';ctx.fillRect(0,-1,8,4);
      ctx.fillStyle='#42eaff';ctx.fillRect(-5,4,10,3);
      ctx.globalAlpha=.74;
      for(let k=0;k<4;k++){
        const px=-18-Math.abs(Math.sin(phase+k))*18;
        const py=((k*7+Math.floor(time*20))%17)-8;
        ctx.fillStyle=k%3===0?'#72ff45':k%3===1?'#ff3bea':'#42eaff';
        ctx.fillRect(px,py,4+k*2,2);
      }
      ctx.globalAlpha=1;ctx.shadowBlur=0;
    }

    if(b.special==='precision'){ctx.shadowColor='#ffffff';ctx.shadowBlur=18;ctx.strokeStyle='rgba(220,250,255,.95)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,b.r+7+Math.sin(time*10)*2,0,TAU);ctx.stroke();ctx.shadowBlur=0}
    else if(b.special==='acceleratedBurst'){ctx.strokeStyle='rgba(115,255,170,.78)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-28,-7);ctx.lineTo(-5,-7);ctx.moveTo(-28,7);ctx.lineTo(-5,7);ctx.stroke()}
    else if(b.special==='nullCore'){
      const rr=18+Math.sin(time*12)*3;
      ctx.globalAlpha=.95;ctx.shadowColor='#ffffff';ctx.shadowBlur=20;
      ctx.strokeStyle='#72ff43';ctx.lineWidth=3;ctx.strokeRect(-rr,-rr,rr*2,rr*2);
      ctx.strokeStyle='#ff42df';ctx.lineWidth=2;ctx.strokeRect(-rr+5,-rr-3,rr*2-2,rr*2+4);
      ctx.strokeStyle='#42eaff';ctx.beginPath();ctx.arc(0,0,rr*.72,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(b.special==='nullEcho'){
      ctx.globalAlpha=.78;ctx.strokeStyle='#ff45e2';ctx.lineWidth=2;ctx.strokeRect(-14,-11,26,22);
      ctx.strokeStyle='#72ff43';ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(-5,0);ctx.stroke();
    }
    else if(b.special==='novaFragment'){ctx.globalAlpha=.8;ctx.strokeStyle='#bffcff';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.stroke()}
    else if(b.special==='shrapnel'){ctx.globalAlpha=.8;ctx.fillStyle='#eaffff';ctx.beginPath();ctx.arc(0,0,2,0,TAU);ctx.fill()}
    ctx.restore();
  }
}
function drawParticles(){
  let i=0;
  for(const p of particles){
    if(!screenVisibleWorld(p.x,p.y,50))continue;
    if(renderPressure>=1&&((i++)%(renderPressure>=2?3:2)))continue;
    const[x,y]=worldToScreen(p.x,p.y);
    ctx.globalAlpha=clamp(p.life/.7,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,p.r,0,TAU);ctx.fill()
  }
  ctx.globalAlpha=1
}
function drawBoundary(){const[x,y]=worldToScreen(0,0);ctx.strokeStyle='rgba(255,95,95,.35)';ctx.lineWidth=8;ctx.strokeRect(x,y,WORLD,WORLD)}
function drawMinimap(){
  const size=108,pad=15,x=innerWidth-size-pad,y=innerHeight-size-pad;
  ctx.fillStyle='rgba(5,12,22,.56)';ctx.fillRect(x,y,size,size);
  ctx.strokeStyle='rgba(255,255,255,.13)';ctx.strokeRect(x,y,size,size);
  ctx.fillStyle='#5baaff';ctx.beginPath();ctx.arc(x+player.x/WORLD*size,y+player.y/WORLD*size,3,0,TAU);ctx.fill();
  ctx.fillStyle='rgba(255,110,110,.88)';
  for(const r of remotePlayers.values()){
    if(!r.alive||r.cloaked||(r.cannonType==='deku'&&Date.now()<(r.dekuSmokeUntilWall||0)))continue;
    ctx.beginPath();ctx.arc(x+r.x/WORLD*size,y+r.y/WORLD*size,2.2,0,TAU);ctx.fill();
  }
}
function basicAimSpec(cannon){
  const p=playerParams();
  const life={standard:1.65,scout:1.55,bastion:2.15,rapid:1.28,dual:1.42,needle:1.65,spread:.95,burst:1.18,crystal:1.20,piercer:1.78,laser:1.50,drill:1.95,plasma:2.15,thunder:2.05,inferno:2.12,rocket:2.22,titan:2.55,phantom:1.90,ring:1.85,chrono:2.0,void:2.10,nova:1.90,comet:2.08,stellar:2.02,error:2.30,glitch:2.15,zero:2.50,deku:1.75}[cannon]||1.65;
  const cone={spread:.25,burst:.17,crystal:.30,thunder:.10,chrono:.07,nova:.10,stellar:.16,glitch:.18};
  if(cannon==='error'&&player.errorSwordMode)return{type:'cone',range:235,half:1.15};
  return cone[cannon]?{type:'cone',range:clamp(p.bulletSpeed*life,380,1750),half:cone[cannon]}:{type:'lane',range:clamp(p.bulletSpeed*life,380,1750),width:{bastion:34,dual:32,needle:15,piercer:20,laser:16,drill:29,plasma:34,inferno:38,rocket:38,titan:46,ring:34,void:38,error:38,zero:42,deku:24}[cannon]||24};
}
function skillAimSpec(cannon,slot){
  if(slot===1){
    if(cannon==='error'){
      if(player.errorSwordMode){const c=player.errorQCharging?clamp((Date.now()-(player.errorQChargeStartAt||Date.now()))/5000,0,1):0;return{type:'blade',distance:900+c*420,width:62+c*48,arcRadius:155+55*c,half:.74}}
      return{type:'self',radius:245};
    }
    return{
      standard:{type:'target',distance:650,radius:310},scout:{type:'dash',distance:650,width:28,end:80},bastion:{type:'wall',distance:220,length:330,width:34},rapid:{type:'self',radius:80},dual:{type:'self',radius:115},needle:{type:'line',distance:820,width:24},spread:{type:'cone',distance:500,half:.78},burst:{type:'target',distance:520,radius:170},crystal:{type:'target',distance:360,radius:118},piercer:{type:'line',distance:1050,width:34},laser:{type:'cone',distance:720,half:.85},drill:{type:'line',distance:1050,width:58},plasma:{type:'target',distance:430,radius:245},thunder:{type:'target',distance:520,radius:300},inferno:{type:'wall',distance:360,length:560,width:92},rocket:{type:'target',distance:540,radius:330},titan:{type:'line',distance:760,width:110},phantom:{type:'dash',distance:phantomPreviewDistance(),width:42,end:150},ring:{type:'target',distance:460,radius:92},chrono:{type:'target',distance:440,radius:310},void:{type:'target',distance:500,radius:300},nova:{type:'target',distance:520,radius:420},comet:{type:'dash',distance:850,width:100,end:150},stellar:{type:'triangle',distance:360,radius:340},deku:{type:'self',radius:330},glitch:{type:'target',distance:560,radius:150},zero:{type:'line',distance:1250,width:72}
    }[cannon]||null;
  }
  if(slot===2){
    if(cannon==='error'&&performance.now()<(player.overclockUntil||0))return{type:'dash',distance:460,width:55,end:92};
    return{rocket:{type:'self',radius:148},titan:{type:'self',radius:132},phantom:{type:'self',radius:105},ring:{type:'self',radius:175},chrono:{type:'self',radius:185},void:{type:'self',radius:430},nova:{type:'self',radius:185},comet:{type:'target',distance:620,radius:370},stellar:{type:'self',radius:145},error:{type:'self',radius:125},glitch:{type:'dash',distance:900,width:96,end:96},zero:{type:'self',radius:560},deku:{type:'line',distance:760,width:34}}[cannon]||null;
  }
  if(slot===3){if(cannon==='error')return{type:'dash',distance:360,width:80,end:235};if(cannon==='deku')return{type:'self',radius:140}}
  if(slot===4&&cannon==='deku')return{type:'self',radius:170};
  return null;
}
function aimPal(slot){return slot===1?['rgba(90,235,175,.16)','rgba(185,255,224,.92)']:slot===2?['rgba(255,195,70,.15)','rgba(255,238,175,.95)']:slot===3?['rgba(255,75,220,.14)','rgba(255,195,245,.95)']:slot===4?['rgba(205,255,83,.15)','rgba(236,255,170,.96)']:['rgba(90,205,255,.14)','rgba(235,253,255,.92)']}
function aimLane(px,py,a,d,w,pal){const sx=px+Math.cos(a)*(player.r+20),sy=py+Math.sin(a)*(player.r+20),ex=px+Math.cos(a)*d,ey=py+Math.sin(a)*d,nx=-Math.sin(a),ny=Math.cos(a);ctx.fillStyle=pal[0];ctx.strokeStyle=pal[1];ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx+nx*w*.55,sy+ny*w*.55);ctx.lineTo(ex+nx*w,ey+ny*w);ctx.arc(ex,ey,w,a+Math.PI/2,a-Math.PI/2,false);ctx.lineTo(sx-nx*w*.55,sy-ny*w*.55);ctx.closePath();ctx.fill();ctx.stroke()}
function aimCone(px,py,a,d,h,pal){ctx.fillStyle=pal[0];ctx.strokeStyle=pal[1];ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(px,py);ctx.arc(px,py,d,a-h,a+h);ctx.closePath();ctx.fill();ctx.stroke()}
function aimTarget(px,py,a,d,r,pal){const x=px+Math.cos(a)*d,y=py+Math.sin(a)*d;ctx.fillStyle=pal[0];ctx.strokeStyle=pal[1];ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([])}
function drawBasicAimGuide(){if(!running||!player?.alive||heldSkillAim.active||!(input.mobileAimActive||input.firing||input.keys.has('Space')))return;const[px,py]=worldToScreen(player.x,player.y),s=basicAimSpec(player.cannonType||'standard'),p=aimPal(0);ctx.save();s.type==='cone'?aimCone(px,py,player.angle,s.range,s.half,p):aimLane(px,py,player.angle,s.range,s.width,p);ctx.restore()}
function drawSkillAimGuide(){
  if(!running||!player?.alive||!heldSkillAim.active)return;const cannon=player.cannonType||'standard',[px,py]=worldToScreen(player.x,player.y),a=Number.isFinite(heldSkillAim.angle)?heldSkillAim.angle:player.angle,p=aimPal(heldSkillAim.slot);
  if(cannon==='phantom'&&heldSkillAim.slot===1&&phantomMarkCanReturn()){
    const[ox,oy]=worldToScreen(player.phantomMarkOriginX,player.phantomMarkOriginY),[dx,dy]=worldToScreen(player.phantomMarkDestX,player.phantomMarkDestY);ctx.save();ctx.fillStyle=p[0];ctx.strokeStyle=p[1];ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(ox,oy);ctx.stroke();ctx.setLineDash([]);for(const pt of [[ox,oy],[dx,dy]]){ctx.beginPath();ctx.arc(pt[0],pt[1],150,0,TAU);ctx.fill();ctx.stroke()}ctx.restore();return;
  }
  const s=skillAimSpec(cannon,heldSkillAim.slot);if(!s)return;ctx.save();
  if(s.type==='self'){ctx.fillStyle=p[0];ctx.strokeStyle=p[1];ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,s.radius,0,TAU);ctx.fill();ctx.stroke()}
  else if(s.type==='target')aimTarget(px,py,a,s.distance,s.radius,p);
  else if(s.type==='line')aimLane(px,py,a,s.distance,s.width,p);
  else if(s.type==='dash'){aimLane(px,py,a,s.distance,s.width,p);const x=px+Math.cos(a)*s.distance,y=py+Math.sin(a)*s.distance;ctx.fillStyle=p[0];ctx.strokeStyle=p[1];ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,s.end,0,TAU);ctx.fill();ctx.stroke()}
  else if(s.type==='cone')aimCone(px,py,a,s.distance,s.half,p);
  else if(s.type==='wall'){const x=px+Math.cos(a)*s.distance,y=py+Math.sin(a)*s.distance,wa=a+Math.PI/2,dx=Math.cos(wa)*s.length/2,dy=Math.sin(wa)*s.length/2,nx=-Math.sin(wa)*s.width/2,ny=Math.cos(wa)*s.width/2;ctx.fillStyle=p[0];ctx.strokeStyle=p[1];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-dx+nx,y-dy+ny);ctx.lineTo(x+dx+nx,y+dy+ny);ctx.lineTo(x+dx-nx,y+dy-ny);ctx.lineTo(x-dx-nx,y-dy-ny);ctx.closePath();ctx.fill();ctx.stroke()}
  else if(s.type==='triangle'){const x=px+Math.cos(a)*s.distance,y=py+Math.sin(a)*s.distance;ctx.fillStyle=p[0];ctx.strokeStyle=p[1];ctx.lineWidth=3;ctx.beginPath();for(let k=0;k<3;k++){const q=-Math.PI/2+k*TAU/3,xx=x+Math.cos(q)*s.radius,yy=y+Math.sin(q)*s.radius;k?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.closePath();ctx.fill();ctx.stroke()}
  else if(s.type==='blade'){aimLane(px,py,a,s.distance,s.width,p);aimCone(px,py,a,s.arcRadius,s.half,p)}
  ctx.restore();
}
function drawAimGuides(){drawBasicAimGuide();drawSkillAimGuide();}
function update(dt){
  if(heldSkillAim.active&&heldSkillAim.slot===4&&player?.cannonType!=='deku')cancelHeldSkillAim();
  updatePlayer(dt);
  updateRemotePlayers(dt);
  updateShapes(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateCombatFx(dt);
  updateSkillZones(dt);
  updatePhantomMarkState();
  const hudNow=performance.now();
  if(hudNow-lastSkillHudFrameUpdate>90){lastSkillHudFrameUpdate=hudNow;updateSkillHud()}
  cameraUpdate();
  broadcastLocalState();
  maintainWorldSync();

  // 진행 중에도 주기적으로 누적 점수를 서버에 정산한다.
  // 브라우저를 갑자기 닫더라도 최근 점수까지 최대한 보존된다.
  const now=performance.now();
  if(player?.alive&&now-lastRunAutosave>=8000){
    lastRunAutosave=now;
    void saveCurrentRun(false);
  }
}
function render(){
  updateRenderPressure();
  ctx.save();
  if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake*=.86}
  drawGrid();drawBoundary();shapes.forEach(drawShape);drawPlasmaTethers();drawSkillZones();drawCombatEffects('base');drawBullets();
  remotePlayers.forEach(drawTank);drawTank(player);drawParticles();
  // V5.50: Deku VFX is deliberately rendered last so Blackwhip/Fa Jin/Gearshift cannot be hidden by tanks or bullets.
  drawCombatEffects('deku');
  ctx.restore();
  drawAimGuides();
  drawMinimap();
}
let lastFrameErrorLog=0;
function logFrameRecovery(kind,error){
  const wallNow=Date.now();
  if(wallNow-lastFrameErrorLog>1000){
    lastFrameErrorLog=wallNow;
    console.error(`Battle ${kind} recovered from error:`,error);
  }
}
function frame(now){
  const dt=Math.min(.032,(now-last)/1000||0);
  last=now;

  // Update and render are deliberately isolated. A gameplay/network bug must not blank the canvas.
  if(running&&!paused){
    try{update(dt)}catch(error){logFrameRecovery('update',error)}
  }
  try{render()}catch(error){logFrameRecovery('render',error)}

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(()=>{
  if(running&&player?.alive&&onlineReady)broadcastLocalState(true);
},1100);

async function startGame(){
  if(!window.IronCellAuth?.user){window.IronCellAuth?.logout?.();return}
  const originalText=ui.startBtn.textContent;
  ui.startBtn.disabled=true;
  ui.startBtn.textContent='온라인 서버 연결 중...';
  setNetworkStatus('connecting','온라인 서버 연결 중...');

  const connected=await connectOnlineArena();
  if(!connected){
    ui.startBtn.disabled=false;
    ui.startBtn.textContent=originalText;
    return;
  }

  player=defaultPlayer();
  player.runId=makeRunId();
  lastRunAutosave=performance.now();
  runSaveBusy=false;
  player.name=(ui.nameInput.value.trim()||window.IronCellAuth.username||'PLAYER').slice(0,14);
  player.cannonType=window.IronCellAuth.getCannon?.()?.id||'standard';
  // Online players do not all spawn on exactly the same point.
  player.x=rand(420,WORLD-420);
  player.y=rand(420,WORLD-420);
  void window.IronCellAuth.savePilotName(player.name);

  classUpgradeShown=false;
  populate();
  camera.x=player.x-innerWidth/2;camera.y=player.y-innerHeight/2;
  running=true;paused=false;
  electWorldHost(true);
  if(isWorldHost())sendWorldSnapshot(true);
  else sendOnline('worldRequest',{requesterId:onlineSelfId,hostId:worldHostId});
  ui.startScreen.classList.remove('show');
  document.querySelector('#garageScreen')?.classList.remove('show');
  ui.deathScreen.classList.remove('show');
  ui.startBtn.disabled=false;ui.startBtn.textContent=originalText;
  updateUI();
  updateSkillHud();
  broadcastLocalState(true);
}
ui.startBtn.onclick=()=>void startGame();
function bindHeldSkillButton(button,slot){
  if(!button)return;
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!beginHeldSkillAim(slot,'button',e))return;try{button.setPointerCapture(e.pointerId)}catch(_){}});
  button.addEventListener('pointermove',e=>{if(!heldSkillAim.active||heldSkillAim.pointerId!==e.pointerId)return;e.preventDefault();e.stopPropagation();updateHeldSkillAim(e)});
  button.addEventListener('pointerup',e=>{if(!heldSkillAim.active||heldSkillAim.pointerId!==e.pointerId)return;e.preventDefault();e.stopPropagation();try{button.releasePointerCapture(e.pointerId)}catch(_){}releaseHeldSkillAim(slot)});
  button.addEventListener('pointercancel',e=>{if(heldSkillAim.pointerId!==e.pointerId)return;e.preventDefault();e.stopPropagation();cancelHeldSkillAim()});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHeldSkillButton(ui.skillBtn,1);bindHeldSkillButton(ui.skill2Btn,2);bindHeldSkillButton(ui.skill3Btn,3);bindHeldSkillButton(ui.skill4Btn,4);
ui.leaveBattleBtn.onclick=()=>void leaveBattleToLobby();ui.respawnBtn.onclick=()=>{ui.deathScreen.classList.remove('show');running=false;void disconnectOnlineArena();window.IronCellAuth?.showLobby?.();};
function isEditableInputTarget(target){
  if(!(target instanceof Element))return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}
addEventListener('keydown',e=>{
  if(isEditableInputTarget(e.target))return;input.keys.add(e.code);
  if(e.code==='KeyQ'&&!e.repeat){beginHeldSkillAim(1,'keyboard');e.preventDefault()}
  if(e.code==='KeyR'&&!e.repeat){beginHeldSkillAim(2,'keyboard');e.preventDefault()}
  if(e.code==='KeyT'&&!e.repeat){beginHeldSkillAim(3,'keyboard');e.preventDefault()}
  if(e.code==='KeyY'&&!e.repeat){beginHeldSkillAim(4,'keyboard');e.preventDefault()}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()
});
addEventListener('keyup',e=>{
  if(isEditableInputTarget(e.target))return;input.keys.delete(e.code);
  if(e.code==='KeyQ'){if(heldSkillAim.active&&heldSkillAim.slot===1)releaseHeldSkillAim(1);else if(player?.errorQCharging)releaseErrorQCharge();e.preventDefault()}
  if(e.code==='KeyR'){if(heldSkillAim.active&&heldSkillAim.slot===2)releaseHeldSkillAim(2);e.preventDefault()}
  if(e.code==='KeyT'){if(heldSkillAim.active&&heldSkillAim.slot===3)releaseHeldSkillAim(3);e.preventDefault()}
  if(e.code==='KeyY'){if(heldSkillAim.active&&heldSkillAim.slot===4)releaseHeldSkillAim(4);e.preventDefault()}
});addEventListener('mousemove',e=>{input.mouseX=e.clientX;input.mouseY=e.clientY});addEventListener('mousedown',e=>{if(e.button===0)input.firing=true});addEventListener('mouseup',e=>{if(e.button===0)input.firing=false});addEventListener('blur',()=>{input.firing=false;input.mobileAimActive=false;input.keys.clear();cancelHeldSkillAim();if(player?.errorQCharging)cancelErrorQCharge()});
const moveZone=document.querySelector('#mobileMove'),knob=moveZone.querySelector('.stick-knob');let moveTouch=null;function moveTouchUpdate(t){const r=moveZone.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const max=42,d=Math.hypot(dx,dy)||1;if(d>max){dx=dx/d*max;dy=dy/d*max}input.moveX=dx/max;input.moveY=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}moveZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];moveTouch=t.identifier;moveTouchUpdate(t);e.preventDefault()},{passive:false});moveZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===moveTouch)moveTouchUpdate(t);e.preventDefault()},{passive:false});function endMove(e){for(const t of e.changedTouches)if(t.identifier===moveTouch){moveTouch=null;input.moveX=0;input.moveY=0;knob.style.transform='none'}}moveZone.addEventListener('touchend',endMove,{passive:false});moveZone.addEventListener('touchcancel',endMove,{passive:false});
const aimZone=document.querySelector('#mobileAim');let aimTouch=null;function aimUpdate(t){input.mouseX=t.clientX;input.mouseY=t.clientY;input.firing=true;input.mobileAimActive=true;aimZone.classList.add('aiming')}aimZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];aimTouch=t.identifier;aimUpdate(t);e.preventDefault()},{passive:false});aimZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===aimTouch)aimUpdate(t);e.preventDefault()},{passive:false});function endAim(e){for(const t of e.changedTouches)if(t.identifier===aimTouch){aimTouch=null;input.firing=false;input.mobileAimActive=false;aimZone.classList.remove('aiming')}}aimZone.addEventListener('touchend',endAim,{passive:false});aimZone.addEventListener('touchcancel',endAim,{passive:false});

window.IronCellGame = {
  stopForLogout(){
    running=false;
    paused=false;
    input.firing=false;
    input.mobileAimActive=false;
    cancelHeldSkillAim();
    input.keys.clear();
    if(player?.errorQCharging)cancelErrorQCharge();
    ui.deathScreen.classList.remove('show');
    ui.skillHud?.classList.add('hidden');ui.skill2Btn?.classList.add('hidden');ui.skill3Btn?.classList.add('hidden');ui.skill4Btn?.classList.add('hidden');
    ui.classPanel.classList.add('hidden');
    ui.startScreen.classList.remove('show');
    document.querySelector('#garageScreen')?.classList.remove('show');
    document.querySelector('#lobbyScreen')?.classList.remove('show');
    void disconnectOnlineArena();
  }
};

window.addEventListener('pagehide',()=>{
  if(running&&player?.runId)void saveCurrentRun(false);
  void disconnectOnlineArena();
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&running&&player?.alive)void saveCurrentRun(false);
  if(!document.hidden){
    refreshRealTimeSkillCooldowns();
    updateSkillHud();
  }
});
window.addEventListener('focus',()=>{
  refreshRealTimeSkillCooldowns();
  updateSkillHud();
});
player=defaultPlayer();populate();updateUI();
})();
