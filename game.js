(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const ui={level:document.querySelector('#levelText'),score:document.querySelector('#scoreText'),xp:document.querySelector('#xpBar'),points:document.querySelector('#pointText'),upgrades:document.querySelector('#upgradeList'),upgradePanel:document.querySelector('#upgradePanel'),startScreen:document.querySelector('#startScreen'),deathScreen:document.querySelector('#deathScreen'),startBtn:document.querySelector('#startBtn'),respawnBtn:document.querySelector('#respawnBtn'),leaveBattleBtn:document.querySelector('#leaveBattleBtn'),nameInput:document.querySelector('#nameInput'),deathLevel:document.querySelector('#deathLevel'),deathScore:document.querySelector('#deathScore'),deathKills:document.querySelector('#deathKills'),deathGems:document.querySelector('#deathGems'),classPanel:document.querySelector('#classPanel'),classChoices:document.querySelector('#classChoices'),onlineCount:document.querySelector('#onlineCount'),networkStatus:document.querySelector('#networkStatus'),skillHud:document.querySelector('#skillHud'),skillBtn:document.querySelector('#skillBtn'),skillName:document.querySelector('#skillName'),skillCooldown:document.querySelector('#skillCooldown'),skillFill:document.querySelector('#skillFill'),skill2Btn:document.querySelector('#skill2Btn'),skill2Name:document.querySelector('#skill2Name'),skill2Cooldown:document.querySelector('#skill2Cooldown'),skill2Fill:document.querySelector('#skill2Fill'),skill3Btn:document.querySelector('#skill3Btn'),skill3Name:document.querySelector('#skill3Name'),skill3Cooldown:document.querySelector('#skill3Cooldown'),skill3Fill:document.querySelector('#skill3Fill')};
const TAU=Math.PI*2,WORLD=12600,GRID=56;
const NORMAL_SHAPE_TARGET=95;
const CENTRAL_PENTAGON_TARGET=220;
const CENTRAL_PENTAGON_RADIUS=1400;
const WORLD_SNAPSHOT_INTERVAL=300;
const INITIAL_NORMAL_SHAPES=28;
const INITIAL_CENTRAL_PENTAGONS=12;
const NORMAL_SPAWN_INTERVAL=.45;
const CENTRAL_SPAWN_INTERVAL=.11;
let running=false,paused=false,last=performance.now(),camera={x:0,y:0},shapes=[],bullets=[],particles=[],combatFx=[],skillZones=[],shake=0,classUpgradeShown=false,player;
const remotePlayers=new Map();
let onlineChannel=null,onlineReady=false,onlineSelfId='',lastStateSend=0,networkSerial=0,lastRunAutosave=0,runSaveBusy=false,normalSpawnTimer=0,centralSpawnTimer=0;
let worldHostId='',worldSnapshotSeq=0,lastWorldSnapshotSend=0,lastWorldSnapshotReceive=0,shapeSerial=0;
const processedDamageIds=new Set();
const input={keys:new Set(),mouseX:innerWidth/2,mouseY:innerHeight/2,firing:false,moveX:0,moveY:0,mobileAimActive:false};

const CANNON_FAMILY=Object.freeze({
  standard:'standard',scout:'standard',bastion:'standard',
  rapid:'rapid',dual:'rapid',needle:'rapid',
  spread:'spread',burst:'spread',crystal:'spread',
  piercer:'piercer',laser:'piercer',drill:'piercer',
  plasma:'plasma',thunder:'plasma',inferno:'rocket',
  rocket:'rocket',titan:'rocket',phantom:'piercer',
  ring:'ring',chrono:'ring',void:'nova',
  nova:'nova',comet:'nova',stellar:'nova',
  error:'error',glitch:'error',zero:'error'
});
function cannonFamily(id){return CANNON_FAMILY[id]||'standard'}


const CANNON_SKILLS=Object.freeze({
  standard:{name:'코어 포격',cooldown:12,color:'#69c8ff'},
  scout:{name:'스피드 발리',cooldown:11,color:'#65d8ff'},
  bastion:{name:'수호 포격',cooldown:15,color:'#91b6d9'},

  rapid:{name:'탄환 폭주',cooldown:13,color:'#70f3a0'},
  dual:{name:'듀얼 러시',cooldown:12,color:'#79f0bf'},
  needle:{name:'니들 레인',cooldown:13,color:'#b5ff89'},

  spread:{name:'산탄 폭풍',cooldown:15,color:'#6ff3ff'},
  burst:{name:'버스트 웨이브',cooldown:14,color:'#58e6ef'},
  crystal:{name:'크리스탈 노바',cooldown:15,color:'#a5f7ff'},

  piercer:{name:'레일 브레이커',cooldown:16,color:'#c09aff'},
  laser:{name:'트리플 레이',cooldown:16,color:'#e0b7ff'},
  drill:{name:'오버 드릴',cooldown:18,color:'#b58aff'},

  plasma:{name:'전류 폭주',cooldown:18,color:'#65ecff'},
  thunder:{name:'썬더 서클',cooldown:19,color:'#fff06f'},
  inferno:{name:'헬파이어',cooldown:20,color:'#ff794f'},

  rocket:{name:'미사일 폭격',cooldown:21,color:'#ff9b4a'},
  titan:{name:'타이탄 포화',cooldown:22,color:'#ffb05e'},
  phantom:{name:'팬텀 스트라이크',cooldown:18,color:'#b9a4ff'},

  ring:{name:'차원 절단',cooldown:20,color:'#c09aff'},
  chrono:{name:'크로노 서클',cooldown:18,color:'#9edcff'},
  void:{name:'보이드 싱크',cooldown:22,color:'#9f77ff'},

  nova:{name:'초신성',cooldown:24,color:'#74efff'},
  comet:{name:'코멧 스톰',cooldown:22,color:'#67dfff'},
  stellar:{name:'스텔라 버스트',cooldown:26,color:'#d6f7ff'},

  error:{name:'ERROR 검기',cooldown:27,color:'#7dff48'},
  glitch:{name:'PACKET STORM',cooldown:25,color:'#ff4be1'},
  zero:{name:'ZERO BEAM',cooldown:30,color:'#f0f0f0'}
});
const CANNON_SKILLS_2=Object.freeze({
  rocket:{name:'강철 요새',cooldown:28,color:'#ffc06a',kind:'fortress'},
  titan:{name:'타이탄 장갑',cooldown:30,color:'#ffd083',kind:'fortress'},
  phantom:{name:'페이즈 워프',cooldown:18,color:'#c9b8ff',kind:'warp'},

  ring:{name:'공간 도약',cooldown:16,color:'#e2caff',kind:'warp'},
  chrono:{name:'타임 스킵',cooldown:18,color:'#a7e8ff',kind:'warp'},
  void:{name:'보이드 필드',cooldown:28,color:'#9a7cff',kind:'gravity'},

  nova:{name:'중력 특이점',cooldown:30,color:'#8fa8ff',kind:'gravity'},
  comet:{name:'혜성 도약',cooldown:20,color:'#69e6ff',kind:'warp'},
  stellar:{name:'성광 장막',cooldown:32,color:'#e6fbff',kind:'fortress'},

  error:{name:'GLITCH DRIVE',cooldown:34,color:'#ff46dc',kind:'overclock'},
  glitch:{name:'DESYNC',cooldown:30,color:'#ff50e7',kind:'overclock'},
  zero:{name:'ZERO SHIFT',cooldown:24,color:'#ffffff',kind:'warp'}
});
const ERROR_T_SKILL=Object.freeze({name:'GLITCH BLADE',cooldown:7,color:'#73ff45'});
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
  zero:{body:'#0b0b0d',edge:'#e8f3ff',glow:'#ffffff'}
});

const statsDef=[['maxHealth','최대 체력'],['regen','체력 회복'],['bulletDamage','탄환 피해'],['bulletSpeed','탄환 속도'],['reload','연사 속도'],['moveSpeed','이동 속도']];
function defaultPlayer(){return{x:WORLD/2,y:WORLD/2,vx:0,vy:0,r:27,angle:0,hp:120,maxHp:120,regenTimer:0,level:1,xp:0,xpNeed:42,score:0,kills:0,points:0,fireCd:0,basicShotCount:0,name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',runId:'',skillCd:0,skillMax:0,skillReadyAt:0,skill2Cd:0,skill2Max:0,skill2ReadyAt:0,skill3Cd:0,skill3Max:0,skill3ReadyAt:0,errorQCharging:false,errorQChargeStartAt:0,fortressUntil:0,overclockUntil:0,errorDashReadyAt:0,errorSwordMode:false,swordSwingStartedAt:0,swordSwingUntil:0,swordSwingDir:1,swordSwingPower:0,phaseUntil:0,shapeContactCd:0,stats:{maxHealth:0,regen:0,bulletDamage:0,bulletSpeed:0,reload:0,moveSpeed:0}}}
function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',resize);resize();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy}function norm(dx,dy){const d=Math.hypot(dx,dy)||1;return[dx/d,dy/d]}
function colorForShape(t){return t==='square'?'#f7c843':t==='triangle'?'#e86464':'#6b8df2'}function edgeForShape(t){return t==='square'?'#b99320':t==='triangle'?'#a83f42':'#425cb2'}
function spawnShape(type=null){
  const t=type||(Math.random()<.57?'square':Math.random()<.78?'triangle':'pentagon');
  const c=t==='square'?{r:20,hp:36,xp:12,sides:4}:t==='triangle'?{r:24,hp:58,xp:22,sides:3}:{r:34,hp:145,xp:56,sides:5};
  shapes.push({
    id:makeShapeId(),
    type:t,x:rand(100,WORLD-100),y:rand(100,WORLD-100),
    r:c.r,hp:c.hp,maxHp:c.hp,xp:c.xp,sides:c.sides,
    angle:rand(0,TAU),spin:rand(-.35,.35),vx:0,vy:0,
    centralCluster:false,spawnAge:0
  });
}
function spawnCentralPentagon(){
  // 큰 맵에 맞춰 오각형 군집을 훨씬 넓게 퍼뜨린다.
  // 지수 1.18로 바꿔 중앙 과밀을 줄이고 바깥쪽에도 고르게 생성한다.
  const a=rand(0,TAU);
  const radius=Math.pow(Math.random(),1.18)*CENTRAL_PENTAGON_RADIUS;
  const jitter=rand(-28,28);
  let x=clamp(WORLD/2+Math.cos(a)*(radius+jitter),70,WORLD-70);
  let y=clamp(WORLD/2+Math.sin(a)*(radius+jitter),70,WORLD-70);
  if(player?.alive){
    const dx=x-player.x,dy=y-player.y,d=Math.hypot(dx,dy);
    if(d<125){
      const push=(125-d)+rand(20,65),n=d||1;
      x=clamp(x+dx/n*push,70,WORLD-70);
      y=clamp(y+dy/n*push,70,WORLD-70);
    }
  }
  shapes.push({
    id:makeShapeId(),
    type:'pentagon',
    x,y,r:34,hp:145,maxHp:145,xp:56,sides:5,
    angle:rand(0,TAU),spin:rand(-.42,.42),vx:0,vy:0,
    centralCluster:true,spawnAge:0
  });
}
function populate(){
  shapes=[];bullets=[];particles=[];combatFx=[];skillZones=[];
  normalSpawnTimer=0;
  centralSpawnTimer=0;
  for(let i=0;i<INITIAL_NORMAL_SHAPES;i++)spawnShape();
  for(let i=0;i<INITIAL_CENTRAL_PENTAGONS;i++)spawnCentralPentagon();
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
    centralCluster:s.centralCluster===true,
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
    s.centralCluster=raw.centralCluster===true;
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
  if(amount<=0)return s.hp<=0;
  s.hp-=amount;
  if(pushX)s.vx=(s.vx||0)+pushX;
  if(pushY)s.vy=(s.vy||0)+pushY;
  reportShapeDamage(s,amount,pushX,pushY);
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
  s.hp-=amount;
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
      name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',fortress:false,overclock:false,swordMode:false,swordSwingStartedAt:0,swordSwingUntil:0,swordSwingDir:1,swordSwingPower:0,lastSeen:performance.now()
    };
    remotePlayers.set(id,r);
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
  r.alive=payload.alive!==false;
  r.lastSeen=performance.now();
}
function angleLerp(a,b,t){
  let d=((b-a+Math.PI)%(TAU))-Math.PI;
  if(d<-Math.PI)d+=TAU;
  return a+d*t;
}
function updateRemotePlayers(dt){
  const now=performance.now();
  for(const [id,r] of remotePlayers){
    if(now-r.lastSeen>4500){remotePlayers.delete(id);continue}
    const t=Math.min(1,dt*11);
    r.x+=(r.tx-r.x)*t;
    r.y+=(r.ty-r.y)*t;
    r.angle=angleLerp(r.angle,r.targetAngle,Math.min(1,dt*14));
  }
}
function localNetworkState(){
  if(!player)return null;
  return {
    id:onlineSelfId,
    x:player.x,y:player.y,angle:player.angle,
    hp:player.hp,maxHp:player.maxHp,
    level:player.level,score:player.score,kills:player.kills,
    name:player.name,cannonType:player.cannonType||'standard',
    classType:player.classType||'basic',alive:!!player.alive,
    fortress:performance.now()<(player.fortressUntil||0),overclock:performance.now()<(player.overclockUntil||0),swordMode:player.cannonType==='error'&&player.errorSwordMode===true
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
  if(!force&&now-lastStateSend<80)return;
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
    basicAttack:b.basicAttack===true,special:b.special||'',fragment:b.fragment===true,returned:b.returned===true
  });
}
function broadcastShotSync(b){
  if(!b||!onlineReady||b.networkRemote||!b.netId)return;
  sendOnline('shotSync',{
    netId:b.netId,ownerId:onlineSelfId,sentAt:Date.now(),
    x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,life:b.life,
    pierce:b.pierce||1,returned:b.returned===true,special:b.special||''
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
  const shotAngle=Math.atan2(vy,vx);
  spawnAttackFx(String(payload.cannon||'standard'),startX,startY,shotAngle,true);
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
function receiveDamage(payload){
  if(!running||!player?.alive)return;
  if(String(payload?.targetId||'')!==onlineSelfId)return;
  const eventId=String(payload?.id||'');
  if(eventId&&processedDamageIds.has(eventId))return;
  if(eventId){
    processedDamageIds.add(eventId);
    if(processedDamageIds.size>240){
      const first=processedDamageIds.values().next().value;
      processedDamageIds.delete(first);
    }
  }
  let amount=Math.max(0,Math.min(5000,Number(payload?.amount)||0));
  if(!amount)return;
  const now=performance.now();
  if(now<(player.phaseUntil||0))return;
  if(now<(player.fortressUntil||0))amount*=.30;
  player.hp-=amount;
  player.regenTimer=0;
  burst(player.x,player.y,'#ff8a8a',5);
  shake=Math.max(shake,5);
  if(player.hp<=0)killPlayer(String(payload?.sourceId||''));
  broadcastLocalState(true);
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
async function disconnectOnlineArena(){
  onlineReady=false;
  updateOnlineCount();
  remotePlayers.clear();
  worldHostId='';lastWorldSnapshotReceive=0;lastWorldSnapshotSend=0;
  const ch=onlineChannel;
  onlineChannel=null;
  if(ch){
    try{await window.IronCellAuth?.client?.removeChannel(ch)}catch(_){}
  }
}
async function connectOnlineArena(){
  if(onlineReady&&onlineChannel)return true;
  const client=window.IronCellAuth?.client;
  const user=window.IronCellAuth?.user;
  if(!client||!user){
    setNetworkStatus('error','로그인이 필요합니다');
    return false;
  }

  await disconnectOnlineArena();
  onlineSelfId=String(user.id);
  setNetworkStatus('connecting','온라인 서버 연결 중...');
  remotePlayers.clear();

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
  ch.on('broadcast',{event:'kill'},({payload})=>receiveKill(payload));
  ch.on('broadcast',{event:'skill'},({payload})=>receiveRemoteSkill(payload));
  ch.on('broadcast',{event:'worldSnapshot'},({payload})=>applyWorldSnapshot(payload));
  ch.on('broadcast',{event:'worldRequest'},({payload})=>{
    if(isWorldHost()&&(!payload?.hostId||String(payload.hostId)===onlineSelfId))sendWorldSnapshot(true);
  });
  ch.on('broadcast',{event:'shapeDamage'},({payload})=>receiveShapeDamage(payload));
  ch.on('broadcast',{event:'shapeImpulse'},({payload})=>receiveShapeImpulse(payload));
  ch.on('presence',{event:'sync'},()=>{updateOnlineCount();electWorldHost()});
  ch.on('presence',{event:'join'},()=>{updateOnlineCount();setTimeout(()=>electWorldHost(),0)});
  ch.on('presence',{event:'leave'},({key})=>{
    if(key)remotePlayers.delete(String(key));
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
      if(settled)return;
      if(status==='SUBSCRIBED'){
        settled=true;
        clearTimeout(timer);
        onlineReady=true;
        try{
          await ch.track({
            user_id:onlineSelfId,
            username:window.IronCellAuth?.username||'PLAYER',
            joined_at:new Date().toISOString()
          });
        }catch(_){}
        updateOnlineCount();
        electWorldHost(true);
        setNetworkStatus('online','온라인 서버 연결됨');
        broadcastLocalState(true);
        resolve(true);
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        settled=true;
        clearTimeout(timer);
        onlineReady=false;
        setNetworkStatus('error','온라인 서버 연결 실패');
        resolve(false);
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

  const now=performance.now();
  if(now<(player.fortressUntil||0)){move*=.70}
  if(now<(player.overclockUntil||0)){move*=1.85}

  return{damage,bulletSpeed,reload:Math.max(.05,reload),move};
}

function spawnCombatFx(type,x,y,opts={}){
  combatFx.push({
    type,x,y,angle:opts.angle||0,color:opts.color||'#fff',
    life:opts.life||.35,maxLife:opts.life||.35,
    radius:opts.radius||38,size:opts.size||1,
    ownerId:opts.ownerId||'',cannon:opts.cannon||''
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
    error:['errorMuzzle','#76ff43',.32,55]
  };
  const f=types[cannonFamily(cannon)]||types.standard;
  spawnCombatFx(f[0],x,y,{angle,color:f[1],life:f[2],radius:f[3],cannon});
}
function receiveRemoteSkill(payload){
  if(!payload||String(payload.ownerId||'')===onlineSelfId)return;
  const cannon=String(payload.cannon||'');
  const x=safeRemoteNumber(payload.x),y=safeRemoteNumber(payload.y);
  const angle=safeRemoteNumber(payload.angle);
  const slot=Math.floor(safeRemoteNumber(payload.slot,1));

  if(slot===3&&cannon==='error'){
    const tx=safeRemoteNumber(payload.targetX,x),ty=safeRemoteNumber(payload.targetY,y);
    const mode=String(payload.mode||'toggle');
    const remote=remotePlayers.get(String(payload.ownerId||''));
    const swingDir=safeRemoteNumber(payload.swingDir,0);

    if(mode==='basicSwing'){
      spawnCombatFx('errorSwordSwing',x,y,{angle,color:'#72ff43',life:.38,radius:182,cannon:'error'});
      if(remote)triggerErrorSwordSwing(remote,1,.34,swingDir);
    }else{
      spawnCombatFx('errorSwordDash',x,y,{angle,color:'#72ff43',life:.55,radius:Math.hypot(tx-x,ty-y)||360,cannon:'error'});
      spawnCombatFx('errorSwordSwing',tx,ty,{angle,color:'#72ff43',life:.50,radius:242,cannon:'error'});
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
        spawnCombatFx('skill2-error',x,y,{angle,color:def.color,life:.60,radius:92,cannon});
        spawnCombatFx('skill2-error',tx,ty,{angle,color:def.color,life:.72,radius:108,cannon});
        for(let i=1;i<=5;i++){
          const k=i/6;
          spawnCombatFx('errorDashTrace',x+(tx-x)*k,y+(ty-y)*k,{angle,color:def.color,life:.34+i*.025,radius:48,cannon});
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
    x,y,{angle,color,life:1.15,radius:cannon==='nova'?390:190,cannon}
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

  if(opts.shape)b.shape=opts.shape;
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
  }else{
    player.skill3Cd=0;
  }
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
  const ready=cd<=.001;
  const errorCharging=cannon==='error'&&player.errorQCharging===true;
  const chargeSec=errorCharging?clamp((Date.now()-(player.errorQChargeStartAt||Date.now()))/1000,0,5):0;

  if(ui.skillName){
    ui.skillName.textContent=errorCharging
      ? 'ERROR 검기 · CHARGE'
      : (cannon==='error'?(player.errorSwordMode?'ERROR 검기':'SYSTEM CRASH'):def.name);
  }
  if(ui.skillCooldown){
    ui.skillCooldown.textContent=errorCharging
      ? `차징 ${chargeSec.toFixed(1)} / 5.0s`
      : (ready?'READY':`${cd.toFixed(1)}s`);
  }
  if(ui.skillFill){
    ui.skillFill.style.width=errorCharging
      ? `${clamp(chargeSec/5*100,0,100)}%`
      : `${clamp((1-cd/max)*100,0,100)}%`;
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
      const ready2=cd2<=.001;
      if(ui.skill2Name)ui.skill2Name.textContent=def2.name;
      if(ui.skill2Cooldown)ui.skill2Cooldown.textContent=ready2?'READY':`${cd2.toFixed(1)}s`;
      if(ui.skill2Fill)ui.skill2Fill.style.width=`${clamp((1-cd2/max2)*100,0,100)}%`;
      if(ui.skill2Btn){
        ui.skill2Btn.disabled=!ready2;
        ui.skill2Btn.className=`skill-button skill2-button cannon-${cannon} ${ready2?'ready':'cooling'}`;
      }
    }
  }

  const showThird=cannon==='error';
  ui.skill3Btn?.classList.toggle('hidden',!showThird);
  if(showThird){
    const cd3=Math.max(0,player.skill3Cd||0),ready3=cd3<=.001;
    if(ui.skill3Name)ui.skill3Name.textContent=player.errorSwordMode?'검 모드 ON':'GLITCH BLADE';
    if(ui.skill3Cooldown)ui.skill3Cooldown.textContent=ready3?(player.errorSwordMode?'T · 검 모드 해제':'T · 검 모드 전환'):`${cd3.toFixed(1)}s`;
    if(ui.skill3Fill)ui.skill3Fill.style.width=`${clamp((1-cd3/ERROR_T_SKILL.cooldown)*100,0,100)}%`;
    if(ui.skill3Btn){
      ui.skill3Btn.disabled=!ready3;
      ui.skill3Btn.className=`skill-button skill3-button cannon-error ${player.errorSwordMode?'sword-on ':''}${ready3?'ready':'cooling'}`;
    }
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
  if(!running||paused||!player?.alive||player.cannonType!=='error')return;
  refreshRealTimeSkillCooldowns();
  if(player.skill3Cd>0)return;
  if(player.errorQCharging)cancelErrorQCharge();

  const now=performance.now(),wallNow=Date.now(),a=player.angle,p=playerParams();
  const ox=player.x,oy=player.y;
  player.skill3Cd=ERROR_T_SKILL.cooldown;
  player.skill3Max=ERROR_T_SKILL.cooldown;
  player.skill3ReadyAt=wallNow+ERROR_T_SKILL.cooldown*1000;
  player.errorSwordMode=!player.errorSwordMode;

  // T는 ON/OFF 어느 쪽이든 전방 돌진 + 검 베기를 수행한다.
  const distance=360;
  const tx=clamp(ox+Math.cos(a)*distance,player.r+10,WORLD-player.r-10);
  const ty=clamp(oy+Math.sin(a)*distance,player.r+10,WORLD-player.r-10);
  player.phaseUntil=now+420;

  spawnCombatFx('errorSwordDash',ox,oy,{angle:a,color:'#72ff43',life:.55,radius:distance,cannon:'error'});
  for(let k=1;k<=5;k++){
    const t=k/6;
    spawnCombatFx('errorDashTrace',ox+(tx-ox)*t,oy+(ty-oy)*t,{angle:a,color:'#72ff43',life:.30+k*.025,radius:45,cannon:'error'});
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

function activateSkill(errorChargeRatio=0){
  if(!running||paused||!player?.alive)return;
  const cannon=player.cannonType||'standard',def=CANNON_SKILLS[cannon];
  refreshRealTimeSkillCooldowns();
  if(!def||player.skillCd>0)return;

  player.skillCd=def.cooldown;player.skillMax=def.cooldown;
  player.skillReadyAt=Date.now()+def.cooldown*1000;

  const p=playerParams(),a=player.angle;
  const errorSwordQ=cannon==='error'&&player.errorSwordMode===true;

  sendOnline('skill',{
    ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a,
    charge:errorSwordQ?clamp(Number(errorChargeRatio)||0,0,1):0,
    mode:cannon==='error'?(errorSwordQ?'sword':'gun'):''
  });

  spawnCombatFx(
    cannon==='error'?(errorSwordQ?'errorSwordCast':'skill-error'):`skill-${cannon}`,
    player.x,player.y,{angle:a,color:def.color,life:1.15,radius:['nova','stellar'].includes(cannon)?410:190,cannon}
  );

  if(cannon==='standard'){
    const b=skillProjectile(cannon,a,{damageMul:3.2,speedMul:1.08,life:2.45,pierce:4,r:13,special:'coreBarrage'});
    spawnAttackFx(cannon,b.x,b.y,a);burst(player.x+Math.cos(a)*42,player.y+Math.sin(a)*42,'#8bddff',18);shake=Math.max(shake,7);

  }else if(cannon==='scout'){
    for(let i=-3;i<=3;i++)skillProjectile(cannon,a+i*.035,{damageMul:.78,speedMul:1.55,life:1.65,pierce:2,r:6});
    burst(player.x+Math.cos(a)*38,player.y+Math.sin(a)*38,'#74e8ff',20);shake=Math.max(shake,5);

  }else if(cannon==='bastion'){
    skillAreaDamage(player.x,player.y,250,p.damage*2.2,'#a8cae6');
    player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.10);
    const b=skillProjectile(cannon,a,{damageMul:3.0,speedMul:.90,life:2.5,pierce:6,r:15,special:'bastionQ'});
    spawnAttackFx(cannon,b.x,b.y,a);burst(player.x,player.y,'#b7d4e8',24);shake=Math.max(shake,9);

  }else if(cannon==='rapid'){
    for(let i=0;i<15;i++)skillProjectile(cannon,a+(i-7)*.018+rand(-.012,.012),{damageMul:.43,speedMul:1.55,life:1.55,pierce:1,r:4});
    burst(player.x+Math.cos(a)*38,player.y+Math.sin(a)*38,'#79f7a7',22);shake=Math.max(shake,5);

  }else if(cannon==='dual'){
    for(let i=0;i<24;i++)skillProjectile(cannon,a+(i-11.5)*.012+rand(-.008,.008),{damageMul:.34,speedMul:1.58,life:1.55,pierce:1,r:4});
    burst(player.x+Math.cos(a)*38,player.y+Math.sin(a)*38,'#7affd3',26);shake=Math.max(shake,6);

  }else if(cannon==='needle'){
    for(let i=0;i<14;i++)skillProjectile(cannon,a+(i-6.5)*.017,{damageMul:.58,speedMul:1.70,life:2.0,pierce:5,r:4,shape:'rail'});
    burst(player.x+Math.cos(a)*42,player.y+Math.sin(a)*42,'#c9ff82',22);shake=Math.max(shake,6);

  }else if(cannon==='spread'){
    for(let i=0;i<25;i++){const t=i/24-.5;skillProjectile(cannon,a+t*1.18+rand(-.025,.025),{damageMul:.30,speedMul:1.02,life:1.15,pierce:1,r:4})}
    burst(player.x+Math.cos(a)*34,player.y+Math.sin(a)*34,'#7ff7ff',28);shake=Math.max(shake,7);

  }else if(cannon==='burst'){
    for(let i=0;i<21;i++){const t=i/20-.5;skillProjectile(cannon,a+t*.82+rand(-.018,.018),{damageMul:.36,speedMul:1.10,life:1.35,pierce:1,r:5})}
    burst(player.x+Math.cos(a)*35,player.y+Math.sin(a)*35,'#63e8f2',26);shake=Math.max(shake,7);

  }else if(cannon==='crystal'){
    for(let i=0;i<18;i++)skillProjectile(cannon,i*TAU/18,{damageMul:.48,speedMul:1.18,life:1.55,pierce:2,r:6});
    burst(player.x,player.y,'#c7fbff',32);shake=Math.max(shake,8);

  }else if(cannon==='piercer'){
    const b=skillProjectile(cannon,a,{damageMul:4.1,speedMul:1.75,life:2.75,pierce:16,r:10,special:'railBreaker'});
    spawnAttackFx(cannon,b.x,b.y,a);burst(player.x+Math.cos(a)*44,player.y+Math.sin(a)*44,'#d6bdff',20);shake=Math.max(shake,10);

  }else if(cannon==='laser'){
    for(const off of [-.035,0,.035])skillProjectile(cannon,a+off,{damageMul:1.75,speedMul:1.90,life:2.55,pierce:12,r:8,shape:'rail'});
    burst(player.x+Math.cos(a)*45,player.y+Math.sin(a)*45,'#ebc4ff',24);shake=Math.max(shake,10);

  }else if(cannon==='drill'){
    const b=skillProjectile(cannon,a,{damageMul:6.5,speedMul:1.24,life:3.0,pierce:26,r:14,shape:'rail',special:'overDrill'});
    spawnAttackFx(cannon,b.x,b.y,a);burst(player.x+Math.cos(a)*46,player.y+Math.sin(a)*46,'#b59aff',28);shake=Math.max(shake,14);

  }else if(cannon==='plasma'){
    for(let i=0;i<8;i++)skillProjectile(cannon,i*TAU/8,{damageMul:.82,speedMul:.62,life:3.25,splashRadius:82});
    burst(player.x,player.y,'#75f4ff',24);shake=Math.max(shake,7);

  }else if(cannon==='thunder'){
    for(let i=0;i<12;i++)skillProjectile(cannon,i*TAU/12,{damageMul:.70,speedMul:.72,life:3.15,splashRadius:74});
    skillAreaDamage(player.x,player.y,180,p.damage*1.6,'#fff279');
    burst(player.x,player.y,'#fff27a',34);shake=Math.max(shake,10);

  }else if(cannon==='inferno'){
    for(let i=-4;i<=4;i++)skillProjectile(cannon,a+i*.12,{damageMul:.82,speedMul:.82,life:2.65,splashRadius:132});
    burst(player.x+Math.cos(a)*30,player.y+Math.sin(a)*30,'#ff704b',34);shake=Math.max(shake,12);

  }else if(cannon==='rocket'){
    for(let i=-5;i<=5;i++)skillProjectile(cannon,a+i*.13,{damageMul:.82,speedMul:.88,life:2.55,splashRadius:126});
    burst(player.x,player.y,'#ffae5d',24);shake=Math.max(shake,10);

  }else if(cannon==='titan'){
    for(let i=0;i<12;i++)skillProjectile(cannon,i*TAU/12,{damageMul:.72,speedMul:.74,life:2.8,splashRadius:142,r:11});
    skillAreaDamage(player.x,player.y,210,p.damage*1.8,'#ffc17a');
    burst(player.x,player.y,'#ffc17a',38);shake=Math.max(shake,14);

  }else if(cannon==='phantom'){
    const ox=player.x,oy=player.y;
    player.x=clamp(player.x+Math.cos(a)*360,player.r+10,WORLD-player.r-10);
    player.y=clamp(player.y+Math.sin(a)*360,player.r+10,WORLD-player.r-10);
    player.phaseUntil=performance.now()+450;
    for(let i=-4;i<=4;i++)skillProjectile(cannon,a+i*.035,{damageMul:.62,speedMul:1.65,life:2.1,pierce:7,r:6,shape:'rail'});
    spawnCombatFx('skill2-ring',ox,oy,{angle:a,color:def.color,life:.45,radius:70,cannon});
    spawnCombatFx('skill2-ring',player.x,player.y,{angle:a,color:def.color,life:.45,radius:70,cannon});
    broadcastLocalState(true);burst(player.x,player.y,'#cabdff',24);shake=Math.max(shake,8);

  }else if(cannon==='ring'){
    for(let i=0;i<16;i++)skillProjectile(cannon,i*TAU/16,{damageMul:1.05,speedMul:1.08,life:2.35,pierce:14});
    burst(player.x,player.y,'#c8a8ff',28);shake=Math.max(shake,8);

  }else if(cannon==='chrono'){
    for(let i=0;i<20;i++)skillProjectile(cannon,i*TAU/20,{damageMul:.78,speedMul:1.28,life:2.45,pierce:12});
    burst(player.x,player.y,'#a8ebff',34);shake=Math.max(shake,9);

  }else if(cannon==='void'){
    const tx=clamp(player.x+Math.cos(a)*420,120,WORLD-120);
    const ty=clamp(player.y+Math.sin(a)*420,120,WORLD-120);
    skillZones.push({type:'gravity',x:tx,y:ty,radius:245,life:3.5,maxLife:3.5,damage:p.damage*.19,tick:0,ownerId:onlineSelfId,networkRemote:false});
    for(let i=0;i<8;i++)skillProjectile(cannon,i*TAU/8,{damageMul:.48,speedMul:.90,life:2.2,pierce:4,splashRadius:72});
    sendOnline('skill',{ownerId:onlineSelfId,cannon,x:player.x,y:player.y,targetX:tx,targetY:ty,angle:a});
    burst(tx,ty,'#9d7cff',30);shake=Math.max(shake,9);

  }else if(cannon==='nova'){
    skillAreaDamage(player.x,player.y,390,p.damage*4.3,'#7cf3ff');
    for(let i=0;i<12;i++)skillProjectile(cannon,i*TAU/12,{damageMul:.78,speedMul:.90,life:2.4,pierce:5,splashRadius:72});
    burst(player.x,player.y,'#8ff6ff',38);shake=Math.max(shake,15);

  }else if(cannon==='comet'){
    for(let i=0;i<19;i++){const t=i/18-.5;skillProjectile(cannon,a+t*.92,{damageMul:.46,speedMul:1.48,life:2.1,pierce:4,splashRadius:55})}
    burst(player.x+Math.cos(a)*36,player.y+Math.sin(a)*36,'#6beaff',34);shake=Math.max(shake,10);

  }else if(cannon==='stellar'){
    skillAreaDamage(player.x,player.y,430,p.damage*3.8,'#e4fbff');
    for(let i=0;i<16;i++)skillProjectile(cannon,i*TAU/16,{damageMul:.66,speedMul:1.0,life:2.5,pierce:5,splashRadius:74});
    burst(player.x,player.y,'#e7fbff',44);shake=Math.max(shake,16);

  }else if(cannon==='error'){
    if(!player.errorSwordMode){
      skillAreaDamage(player.x,player.y,245,p.damage*2.8,'#79ff47');
      for(let i=0;i<24;i++)skillProjectile(cannon,i*TAU/24+rand(-.035,.035),{damageMul:.65,speedMul:1.25,life:2.5,pierce:16,splashRadius:94});
      burst(player.x,player.y,'#79ff47',44);burst(player.x,player.y,'#ff46e8',20);shake=Math.max(shake,17);
    }else{
      const charge=clamp(Number(errorChargeRatio)||0,0,1);
      const baseScale=2.60,bladeScale=baseScale*(1+2*charge);
      const damageMul=4.8*(1+.50*charge),pierce=Math.round(28+12*charge),life=2.85+.45*charge;
      errorSwordArcDamage(player.x,player.y,a,p.damage*(1.8+.8*charge),155+55*charge,.74);
      const blade=spawnErrorSwordWave(a,damageMul,{speedMul:1.30,life,pierce,scale:bladeScale,special:'errorQBlade'});
      blade.charge=charge;spawnAttackFx('error',blade.x,blade.y,a);
      spawnCombatFx('errorSwordSwing',player.x,player.y,{angle:a,color:'#72ff43',life:.50+.18*charge,radius:165+90*charge,cannon:'error'});
      burst(player.x+Math.cos(a)*45,player.y+Math.sin(a)*45,'#72ff43',24+Math.round(18*charge));
      burst(player.x+Math.cos(a)*45,player.y+Math.sin(a)*45,'#ff42df',18+Math.round(14*charge));
      if(charge>.95)burst(player.x+Math.cos(a)*45,player.y+Math.sin(a)*45,'#42eaff',28);
      shake=Math.max(shake,14+8*charge);
    }

  }else if(cannon==='glitch'){
    skillAreaDamage(player.x,player.y,205,p.damage*2.0,'#ff45df');
    for(let i=0;i<36;i++)skillProjectile(cannon,i*TAU/36+rand(-.025,.025),{damageMul:.50,speedMul:1.30,life:2.35,pierce:15,r:8});
    burst(player.x,player.y,'#ff42df',48);burst(player.x,player.y,'#42eaff',20);shake=Math.max(shake,18);

  }else if(cannon==='zero'){
    const b=skillProjectile(cannon,a,{damageMul:9.0,speedMul:1.42,life:3.3,pierce:40,r:20,shape:'error',special:'zeroBeam'});
    b.r=20;spawnAttackFx(cannon,b.x,b.y,a);
    skillAreaDamage(player.x,player.y,180,p.damage*2.2,'#f1f5ff');
    burst(player.x+Math.cos(a)*48,player.y+Math.sin(a)*48,'#ffffff',42);shake=Math.max(shake,20);
  }

  updateSkillHud();
}

function activateSkill2(){
  if(!running||paused||!player?.alive)return;
  const cannon=player.cannonType||'standard',def=CANNON_SKILLS_2[cannon];
  if(!def)return;

  refreshRealTimeSkillCooldowns();
  const now=performance.now(),wallNow=Date.now(),a=player.angle,p=playerParams();
  const ox=player.x,oy=player.y;

  // ERROR 본체만 R 버프 중 3초 도약 기능을 갖는다.
  if(cannon==='error'&&now<(player.overclockUntil||0)){
    if(wallNow<(player.errorDashReadyAt||0))return;
    const dashDistance=460;
    const tx=clamp(player.x+Math.cos(a)*dashDistance,player.r+10,WORLD-player.r-10);
    const ty=clamp(player.y+Math.sin(a)*dashDistance,player.r+10,WORLD-player.r-10);
    player.errorDashReadyAt=wallNow+3000;player.phaseUntil=now+380;
    spawnCombatFx('skill2-error',ox,oy,{angle:a,color:def.color,life:.60,radius:92,cannon});
    for(let i=1;i<=5;i++){const k=i/6;spawnCombatFx('errorDashTrace',ox+(tx-ox)*k,oy+(ty-oy)*k,{angle:a,color:def.color,life:.34+i*.025,radius:48,cannon})}
    player.x=tx;player.y=ty;player.vx=Math.cos(a)*120;player.vy=Math.sin(a)*120;
    spawnCombatFx('skill2-error',tx,ty,{angle:a,color:def.color,life:.72,radius:108,cannon});
    burst(ox,oy,'#72ff43',14);burst(tx,ty,'#42eaff',18);shake=Math.max(shake,5);
    sendOnline('skill',{slot:2,mode:'dash',ownerId:onlineSelfId,cannon,x:ox,y:oy,targetX:tx,targetY:ty,angle:a});
    camera.x=player.x-innerWidth/2;camera.y=player.y-innerHeight/2;broadcastLocalState(true);updateSkillHud();return;
  }

  if(player.skill2Cd>0)return;
  player.skill2Cd=def.cooldown;player.skill2Max=def.cooldown;player.skill2ReadyAt=wallNow+def.cooldown*1000;

  if(cannon==='rocket'){
    player.fortressUntil=now+6000;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.12);
    sendOnline('skill',{slot:2,ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a});
    spawnCombatFx('skill2-rocket',player.x,player.y,{angle:a,color:def.color,life:1.1,radius:115,cannon});burst(player.x,player.y,'#ffc16d',24);shake=Math.max(shake,5);broadcastLocalState(true);

  }else if(cannon==='titan'){
    player.fortressUntil=now+8000;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.18);
    sendOnline('skill',{slot:2,ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a});
    spawnCombatFx('skill2-rocket',player.x,player.y,{angle:a,color:def.color,life:1.25,radius:145,cannon});burst(player.x,player.y,'#ffd083',34);shake=Math.max(shake,7);broadcastLocalState(true);

  }else if(cannon==='stellar'){
    player.fortressUntil=now+6000;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.25);
    sendOnline('skill',{slot:2,ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a});
    spawnCombatFx('skill2-rocket',player.x,player.y,{angle:a,color:def.color,life:1.2,radius:135,cannon});burst(player.x,player.y,'#e9fbff',38);shake=Math.max(shake,6);broadcastLocalState(true);

  }else if(['ring','phantom','chrono','comet','zero'].includes(cannon)){
    const distance=cannon==='ring'?720:cannon==='phantom'?900:cannon==='chrono'?560:cannon==='comet'?1100:1200;
    const tx=clamp(player.x+Math.cos(a)*distance,player.r+10,WORLD-player.r-10);
    const ty=clamp(player.y+Math.sin(a)*distance,player.r+10,WORLD-player.r-10);
    player.phaseUntil=now+(cannon==='zero'?1200:cannon==='chrono'?1000:cannon==='phantom'?900:700);
    spawnCombatFx('skill2-ring',ox,oy,{angle:a,color:def.color,life:.85,radius:100,cannon});
    player.x=tx;player.y=ty;player.vx=0;player.vy=0;
    spawnCombatFx('skill2-ring',tx,ty,{angle:a,color:def.color,life:.85,radius:100,cannon});
    if(cannon==='chrono'&&player.skillReadyAt){
      player.skillReadyAt=Math.max(Date.now(),player.skillReadyAt-5000);
      refreshRealTimeSkillCooldowns();
    }
    if(cannon==='comet'){
      for(let i=0;i<8;i++)skillProjectile(cannon,i*TAU/8,{damageMul:.48,speedMul:1.18,life:1.8,pierce:3,splashRadius:50});
    }
    burst(ox,oy,def.color,18);burst(tx,ty,def.color,24);
    sendOnline('skill',{slot:2,ownerId:onlineSelfId,cannon,x:ox,y:oy,targetX:tx,targetY:ty,angle:a});
    camera.x=player.x-innerWidth/2;camera.y=player.y-innerHeight/2;broadcastLocalState(true);

  }else if(['nova','void'].includes(cannon)){
    const targetDistance=cannon==='void'?470:520;
    const radius=cannon==='void'?400:330;
    const life=cannon==='void'?6:5.5;
    const tx=clamp(player.x+Math.cos(a)*targetDistance,120,WORLD-120);
    const ty=clamp(player.y+Math.sin(a)*targetDistance,120,WORLD-120);
    skillZones.push({type:'gravity',x:tx,y:ty,radius,life,maxLife:life,damage:p.damage*(cannon==='void'?.30:.26),tick:0,ownerId:onlineSelfId,networkRemote:false});
    sendOnline('skill',{slot:2,ownerId:onlineSelfId,cannon,x:player.x,y:player.y,targetX:tx,targetY:ty,angle:a,radius,life});
    spawnCombatFx('skill2-nova',tx,ty,{angle:a,color:def.color,life:1.0,radius:cannon==='void'?145:125,cannon});burst(tx,ty,def.color,30);shake=Math.max(shake,7);

  }else if(cannon==='error'){
    player.overclockUntil=now+15000;player.errorDashReadyAt=wallNow;
    sendOnline('skill',{slot:2,mode:'boost',ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a});
    spawnCombatFx('skill2-error',player.x,player.y,{angle:a,color:def.color,life:1.15,radius:155,cannon});
    burst(player.x,player.y,'#74ff45',30);burst(player.x,player.y,'#ff42dc',24);burst(player.x,player.y,'#42eaff',16);shake=Math.max(shake,8);broadcastLocalState(true);

  }else if(cannon==='glitch'){
    player.overclockUntil=now+12000;
    sendOnline('skill',{slot:2,mode:'boost',ownerId:onlineSelfId,cannon,x:player.x,y:player.y,angle:a});
    spawnCombatFx('skill2-error',player.x,player.y,{angle:a,color:def.color,life:1.1,radius:150,cannon});
    burst(player.x,player.y,'#ff42df',34);burst(player.x,player.y,'#42eaff',18);shake=Math.max(shake,7);broadcastLocalState(true);
  }

  updateSkillHud();
}

function spawnPassiveBullet(opts){
  const a=opts.angle,speed=opts.speed;
  const b={x:opts.x,y:opts.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:opts.r||4,damage:opts.damage,life:opts.life||.7,owner:player,ownerId:onlineSelfId,team:'player',cannon:opts.cannon,shape:opts.shape||'round',pierce:opts.pierce||1,splashRadius:opts.splashRadius||0,basicAttack:false,special:opts.special||'',fragment:opts.fragment===true,hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()};
  bullets.push(b);broadcastShot(b);return b;
}
function spawnSpreadFragments(parent,x,y){
  if(parent.fragment||parent.shrapnelDone)return;parent.shrapnelDone=true;
  const base=Math.atan2(parent.vy,parent.vx),speed=Math.max(280,Math.hypot(parent.vx,parent.vy)*.82);
  for(const off of [-.42,.42])spawnPassiveBullet({x,y,angle:base+off,speed,damage:parent.damage*.28,life:.60,r:3,cannon:'spread',shape:'pellet',special:'shrapnel',fragment:true});
  spawnCombatFx('spreadShardBurst',x,y,{angle:base,color:'#74f5ff',life:.30,radius:35,cannon:'spread'});
}
function spawnNovaFragments(parent,x,y){
  if(parent.fragment||parent.novaSplit)return;parent.novaSplit=true;
  const speed=Math.max(320,Math.hypot(parent.vx,parent.vy)*.74);
  for(let k=0;k<4;k++)spawnPassiveBullet({x,y,angle:k*TAU/4+Math.PI/4,speed,damage:parent.damage*.30,life:.78,r:5,cannon:'nova',shape:'nova',special:'novaFragment',fragment:true});
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
  if(!b.basicAttack||b.shape!=='ring'||b.returned||b.life>.82)return;
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

  let shots=[{angle:a,side:0,damageMul:1,special:''}];

  if(cannon==='standard'&&shotNo%5===0)shots=[{angle:a,side:0,damageMul:1.70,special:'precision'}];
  else if(cannon==='scout'&&shotNo%4===0)shots=[{angle:a-.055,side:-3,damageMul:.88,special:'scoutDouble'},{angle:a+.055,side:3,damageMul:.88,special:'scoutDouble'}];
  else if(cannon==='bastion'&&shotNo%6===0)shots=[{angle:a,side:0,damageMul:2.20,special:'bastionCore'}];

  else if(cannon==='rapid'&&shotNo%8===0)shots=[{angle:a-.045,side:-3,damageMul:.58,special:'acceleratedBurst'},{angle:a,side:0,damageMul:.58,special:'acceleratedBurst'},{angle:a+.045,side:3,damageMul:.58,special:'acceleratedBurst'}];
  else if(cannon==='dual'){
    shots=shotNo%7===0
      ?[-.06,-.02,.02,.06].map((v,i)=>({angle:a+v,side:(i-1.5)*4,damageMul:.45,special:'dualBurst'}))
      :[{angle:a-.018,side:-5,damageMul:.68,special:'dual'},{angle:a+.018,side:5,damageMul:.68,special:'dual'}];
  }else if(cannon==='needle'&&shotNo%6===0)shots=[{angle:a,side:0,damageMul:1.55,special:'needleCore'}];

  else if(cannon==='spread')shots=[-.25,-.125,0,.125,.25].map(v=>({angle:a+v,side:0,damageMul:1,special:'shrapnelCarrier'}));
  else if(cannon==='burst')shots=(shotNo%5===0?[-.16,-.08,0,.08,.16]:[-.08,0,.08]).map(v=>({angle:a+v,side:0,damageMul:shotNo%5===0?.55:.72,special:'burst'}));
  else if(cannon==='crystal')shots=(shotNo%4===0?[-.30,-.20,-.10,0,.10,.20,.30]:[-.16,0,.16]).map(v=>({angle:a+v,side:0,damageMul:shotNo%4===0?.42:.65,special:'crystal'}));

  else if(cannon==='laser'&&shotNo%3===0)shots=[{angle:a,side:0,damageMul:1.75,special:'laserCore'}];
  else if(cannon==='drill')shots=[{angle:a,side:0,damageMul:shotNo%4===0?2.20:1.05,special:shotNo%4===0?'drillCore':'drill'}];

  else if(cannon==='thunder'&&shotNo%4===0)shots=[-.09,0,.09].map(v=>({angle:a+v,side:0,damageMul:.72,special:'thunderTriple'}));
  else if(cannon==='inferno'&&shotNo%5===0)shots=[-.14,0,.14].map(v=>({angle:a+v,side:0,damageMul:.68,special:'infernoTriple'}));

  else if(cannon==='titan'&&shotNo%4===0)shots=[{angle:a-.05,side:-4,damageMul:.80,special:'titanTwin'},{angle:a+.05,side:4,damageMul:.80,special:'titanTwin'}];
  else if(cannon==='phantom'&&shotNo%5===0)shots=[-.06,0,.06].map(v=>({angle:a+v,side:0,damageMul:.65,special:'phantomTriple'}));

  else if(cannon==='chrono'&&shotNo%3===0)shots=[{angle:a-.05,side:-4,damageMul:.72,special:'chronoTwin'},{angle:a+.05,side:4,damageMul:.72,special:'chronoTwin'}];
  else if(cannon==='void'&&shotNo%4===0)shots=[-.10,0,.10].map(v=>({angle:a+v,side:0,damageMul:.65,special:'voidPulse'}));

  else if(cannon==='nova')shots=[-.10,0,.10].map(v=>({angle:a+v,side:0,damageMul:.78,special:'nebulaCarrier'}));
  else if(cannon==='comet'&&shotNo%5===0)shots=[-.09,0,.09].map(v=>({angle:a+v,side:0,damageMul:.70,special:'cometTriple'}));
  else if(cannon==='stellar')shots=(shotNo%6===0?[-.16,-.08,0,.08,.16]:[-.07,.07]).map(v=>({angle:a+v,side:0,damageMul:shotNo%6===0?.42:.66,special:'stellar'}));

  else if(cannon==='error'&&shotNo%5===0)shots=[
    {angle:a-.18,side:-8,damageMul:.55,special:'nullEcho'},
    {angle:a-.09,side:-4,damageMul:.72,special:'nullEcho'},
    {angle:a,side:0,damageMul:1.65,special:'nullCore'},
    {angle:a+.09,side:4,damageMul:.72,special:'nullEcho'},
    {angle:a+.18,side:8,damageMul:.55,special:'nullEcho'}
  ];
  else if(cannon==='glitch')shots=(shotNo%6===0?[-.18,-.12,-.06,0,.06,.12,.18]:[-.04,.04]).map(v=>({angle:a+v,side:0,damageMul:shotNo%6===0?.35:.62,special:'glitchPacket'}));
  else if(cannon==='zero'&&shotNo%4===0)shots=[{angle:a-.06,side:-5,damageMul:.62,special:'zeroEcho'},{angle:a,side:0,damageMul:1.20,special:'zeroCore'},{angle:a+.06,side:5,damageMul:.62,special:'zeroEcho'}];

  for(const shot of shots){
    const sa=shot.angle,px=-Math.sin(sa)*shot.side,py=Math.cos(sa)*shot.side;
    const b={
      x:e.x+Math.cos(sa)*(e.r+18)+px,y:e.y+Math.sin(sa)*(e.r+18)+py,
      vx:Math.cos(sa)*p.bulletSpeed+e.vx*.18,vy:Math.sin(sa)*p.bulletSpeed+e.vy*.18,
      r:6,damage:p.damage*shot.damageMul,life:1.65,
      owner:e,ownerId:onlineSelfId,team:'player',cannon,shape:'round',
      pierce:1,splashRadius:0,basicAttack:true,special:shot.special||'',fragment:false,
      hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
    };

    if(family==='standard'){b.r=6;b.life=1.65;b.shape='round'}
    else if(family==='rapid'){b.r=4;b.life=1.35;b.shape='capsule'}
    else if(family==='spread'){b.r=4;b.life=.95;b.shape='pellet'}
    else if(family==='piercer'){b.r=5;b.life=1.75;b.shape='rail';b.pierce=4}
    else if(family==='plasma'){b.r=13;b.life=2.15;b.shape='plasma';b.splashRadius=72}
    else if(family==='rocket'){b.r=8;b.life=2.15;b.shape='rocket';b.splashRadius=112}
    else if(family==='ring'){b.r=12;b.life=1.85;b.shape='ring';b.pierce=8}
    else if(family==='nova'){b.r=10;b.life=1.90;b.shape='nova';b.pierce=3;b.splashRadius=46}
    else if(family==='error'){b.r=9;b.life=2.30;b.shape='error';b.pierce=16;b.splashRadius=0}

    if(cannon==='standard'&&shot.special==='precision'){b.r=8;b.life=1.95;b.pierce=2}
    if(cannon==='bastion'&&shot.special==='bastionCore'){b.r=10;b.life=2.1;b.pierce=3}
    if(cannon==='needle'){b.r=3;if(shot.special==='needleCore'){b.shape='rail';b.r=4;b.life=1.75;b.pierce=4}}
    if(cannon==='piercer'){b.special='penetrationAccel'}
    if(cannon==='laser'){b.pierce=6;if(shot.special==='laserCore'){b.r=7;b.pierce=10;b.life=2.0}}
    if(cannon==='drill'){b.r=shot.special==='drillCore'?11:8;b.pierce=shot.special==='drillCore'?16:8;b.life=shot.special==='drillCore'?2.25:1.95}
    if(cannon==='plasma')b.special='chainDischarge';
    if(cannon==='thunder'){b.splashRadius=62;b.special='thunderArc'}
    if(cannon==='rocket')b.special='incendiary';
    if(cannon==='inferno'){b.splashRadius=100;b.special='incendiary'}
    if(cannon==='titan'){b.r=11;b.splashRadius=138;b.life=2.50}
    if(cannon==='phantom'){b.r=5;b.shape='rail';b.pierce=6;b.life=1.85}
    if(cannon==='ring')b.special='returnRing';
    if(cannon==='chrono'){b.pierce=9;b.life=2.0;b.special='returnRing'}
    if(cannon==='void'){b.splashRadius=72;b.pierce=4}
    if(cannon==='nova'){b.splashRadius=46}
    if(cannon==='comet'){b.life=2.05;b.splashRadius=52;b.pierce=4}
    if(cannon==='stellar'){b.splashRadius=58;b.pierce=4}
    if(cannon==='error'){
      if(shot.special==='nullCore'){b.r=13;b.life=2.65;b.pierce=24;b.vx*=1.10;b.vy*=1.10}
      else if(shot.special==='nullEcho'){b.r=8;b.life=2.35;b.pierce=18;b.vx*=1.05;b.vy*=1.05}
    }
    if(cannon==='glitch'){b.r=8;b.pierce=14;b.life=2.15}
    if(cannon==='zero'){
      b.r=shot.special==='zeroCore'?13:10;b.pierce=shot.special==='zeroCore'?26:20;b.life=2.5;
      if(shot.special==='zeroCore'){b.vx*=1.12;b.vy*=1.12}
    }

    bullets.push(b);broadcastShot(b);spawnAttackFx(cannon,b.x,b.y,sa);
  }

  const recoil=
    cannon==='titan'?30:cannon==='zero'?30:
    family==='rocket'?22:family==='error'?27:family==='nova'?17:family==='piercer'?15:12;
  e.vx-=Math.cos(a)*recoil;e.vy-=Math.sin(a)*recoil;
}
function burst(x,y,color,count=8){for(let i=0;i<count;i++){const a=rand(0,TAU),sp=rand(45,180);particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.28,.7),color,r:rand(2,5)})}}
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

  player.hp-=damage;
  player.regenTimer=0;
  player.shapeContactCd=.34;
  burst(player.x,player.y,hitShape.centralCluster?'#8ca6ff':colorForShape(hitShape.type),7);
  shake=Math.max(shake,4);

  if(player.hp<=0)killPlayer('');
}

function updatePlayer(dt){if(!player.alive)return;refreshRealTimeSkillCooldowns();player.shapeContactCd=Math.max(0,(player.shapeContactCd||0)-dt);const p=playerParams();let mx=input.moveX,my=input.moveY;if(input.keys.has('KeyA')||input.keys.has('ArrowLeft'))mx-=1;if(input.keys.has('KeyD')||input.keys.has('ArrowRight'))mx+=1;if(input.keys.has('KeyW')||input.keys.has('ArrowUp'))my-=1;if(input.keys.has('KeyS')||input.keys.has('ArrowDown'))my+=1;if(mx||my){[mx,my]=norm(mx,my);player.vx+=mx*p.move*dt*5.2;player.vy+=my*p.move*dt*5.2}player.angle=Math.atan2(camera.y+input.mouseY-player.y,camera.x+input.mouseX-player.x);let sp=Math.hypot(player.vx,player.vy);if(sp>p.move){player.vx=player.vx/sp*p.move;player.vy=player.vy/sp*p.move}player.x=clamp(player.x+player.vx*dt,player.r,WORLD-player.r);player.y=clamp(player.y+player.vy*dt,player.r,WORLD-player.r);player.vx*=Math.pow(.0006,dt);player.vy*=Math.pow(.0006,dt);player.fireCd=Math.max(0,player.fireCd-dt);if(input.firing||input.keys.has('Space'))fire(player);handleShapeContact();if(player.hp<player.maxHp){player.regenTimer+=dt;if(player.regenTimer>3.8)player.hp=Math.min(player.maxHp,player.hp+(1.4+player.stats.regen*1.1)*dt)}else player.regenTimer=0}
function updateShapes(dt){
  const host=isWorldHost();
  for(const s of shapes){
    s.spawnAge=(s.spawnAge||0)+dt;
    s.angle+=s.spin*dt;
    s.x=clamp(s.x+s.vx*dt,s.r,WORLD-s.r);
    s.y=clamp(s.y+s.vy*dt,s.r,WORLD-s.r);
    s.vx*=Math.pow(.05,dt);
    s.vy*=Math.pow(.05,dt);

    // 군집 복귀/월드 생성은 한 명의 월드 호스트만 계산한다.
    if(host&&s.centralCluster){
      const dx=WORLD/2-s.x,dy=WORLD/2-s.y,d=Math.hypot(dx,dy)||1;
      if(d>CENTRAL_PENTAGON_RADIUS*1.18){
        s.vx+=dx/d*22*dt;
        s.vy+=dy/d*22*dt;
      }
    }
  }

  if(!host)return;

  let normalCount=0,centralCount=0;
  for(const s of shapes){
    if(s.centralCluster)centralCount++;
    else normalCount++;
  }

  normalSpawnTimer-=dt;
  centralSpawnTimer-=dt;

  if(normalCount<NORMAL_SHAPE_TARGET&&normalSpawnTimer<=0){
    spawnShape();
    normalSpawnTimer=NORMAL_SPAWN_INTERVAL;
  }

  if(centralCount<CENTRAL_PENTAGON_TARGET&&centralSpawnTimer<=0){
    spawnCentralPentagon();
    centralSpawnTimer=CENTRAL_SPAWN_INTERVAL;
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
  if(b.shape!=='plasma'||b.networkRemote||b.owner!==player||!player?.alive)return;
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

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.life-=dt;
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
          }else if(b.basicAttack&&b.cannon==='error'){
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
  for(let zi=skillZones.length-1;zi>=0;zi--){
    const z=skillZones[zi];z.life-=dt;if(z.life<=0){skillZones.splice(zi,1);continue}if(z.networkRemote)continue;
    z.tick-=dt;const doTick=z.tick<=0;if(doTick)z.tick=z.type==='burn'?.25:.22;
    for(let i=shapes.length-1;i>=0;i--){
      const s=shapes[i],dx=z.x-s.x,dy=z.y-s.y,d=Math.hypot(dx,dy)||1;if(d>z.radius)continue;
      if(z.type==='gravity'){
        const force=(1-d/z.radius)*820;
        s.vx+=dx/d*force*dt;s.vy+=dy/d*force*dt;
        if(doTick&&onlineReady&&!isWorldHost()&&s.id){
          sendOnline('shapeImpulse',{
            hostId:worldHostId,shapeId:String(s.id),sourceId:onlineSelfId,
            dvx:dx/d*force*.18,dvy:dy/d*force*.18
          });
        }
      }
      if(doTick){applyShapeDamage(s,z.damage);burst(s.x,s.y,z.type==='burn'?'#ff9a42':'#8da9ff',z.type==='burn'?3:2);if(s.hp<=0){gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),10);shapes.splice(i,1)}}
    }
    if(doTick)for(const enemy of remotePlayers.values()){if(!enemy.alive)continue;const dx=z.x-enemy.x,dy=z.y-enemy.y;if(dx*dx+dy*dy<=z.radius*z.radius)sendDamage(enemy.id,z.damage*(z.type==='burn'?1:.75))}
  }
}
function cameraUpdate(){const tx=player.x-innerWidth/2,ty=player.y-innerHeight/2;camera.x+=(tx-camera.x)*.12;camera.y+=(ty-camera.y)*.12;camera.x=clamp(camera.x,0,Math.max(0,WORLD-innerWidth));camera.y=clamp(camera.y,0,Math.max(0,WORLD-innerHeight))}
const worldToScreen=(x,y)=>[x-camera.x,y-camera.y];
function drawGrid(){ctx.fillStyle='#152235';ctx.fillRect(0,0,innerWidth,innerHeight);const sx=-(camera.x%GRID),sy=-(camera.y%GRID);ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1;ctx.beginPath();for(let x=sx;x<innerWidth;x+=GRID){ctx.moveTo(x,0);ctx.lineTo(x,innerHeight)}for(let y=sy;y<innerHeight;y+=GRID){ctx.moveTo(0,y);ctx.lineTo(innerWidth,y)}ctx.stroke()}
function polygon(x,y,r,sides,a){ctx.beginPath();for(let i=0;i<sides;i++){const q=a+i*TAU/sides,px=x+Math.cos(q)*r,py=y+Math.sin(q)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath()}
function drawShape(s){const[x,y]=worldToScreen(s.x,s.y);if(x<-80||y<-80||x>innerWidth+80||y>innerHeight+80)return;const spawnP=clamp((s.spawnAge||0)/.34,0,1),ease=1-Math.pow(1-spawnP,3),rr=s.r*(.35+.65*ease);ctx.save();ctx.globalAlpha=.28+.72*ease;ctx.shadowColor=s.centralCluster?'rgba(90,130,255,.34)':'rgba(0,0,0,.25)';ctx.shadowBlur=s.centralCluster?14:10;ctx.shadowOffsetY=4;polygon(x,y,rr,s.sides,s.angle);ctx.fillStyle=colorForShape(s.type);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=edgeForShape(s.type);ctx.lineWidth=5;ctx.stroke();if(s.hp<s.maxHp){const w=s.r*1.6;ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-w/2,y+s.r+8,w,4);ctx.fillStyle='#7ee787';ctx.fillRect(x-w/2,y+s.r+8,w*(s.hp/s.maxHp),4)}ctx.restore()}
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
  const family=cannonFamily(cannon);
  ctx.fillStyle='#6f7f90';ctx.strokeStyle='#45515f';ctx.lineWidth=4;
  if(family==='rapid'){ctx.beginPath();ctx.roundRect(r*.22,-5,r+28,10,3);ctx.fill();ctx.stroke();ctx.fillStyle='#9aa9b8';for(let i=0;i<3;i++)ctx.fillRect(r+2+i*7,-2,4,4)}
  else if(family==='spread'){ctx.beginPath();ctx.moveTo(r*.20,-9);ctx.lineTo(r+32,-16);ctx.lineTo(r+32,16);ctx.lineTo(r*.20,9);ctx.closePath();ctx.fill();ctx.stroke()}
  else if(family==='piercer'){ctx.beginPath();ctx.roundRect(r*.18,-4,r+42,8,2);ctx.fill();ctx.stroke();ctx.strokeStyle='#9baabb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r*.35,-9);ctx.lineTo(r+34,-9);ctx.moveTo(r*.35,9);ctx.lineTo(r+34,9);ctx.stroke()}
  else if(family==='plasma'){ctx.beginPath();ctx.roundRect(r*.18,-11,r+25,22,7);ctx.fill();ctx.stroke();ctx.fillStyle='#73e9ff';ctx.shadowColor='#73e9ff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(r+26,0,7,0,TAU);ctx.fill();ctx.shadowBlur=0}
  else if(family==='rocket'){ctx.fillStyle='#657686';ctx.beginPath();ctx.roundRect(r*.10,-15,r+24,30,5);ctx.fill();ctx.stroke();ctx.fillStyle='#303b48';ctx.fillRect(r+10,-9,17,18)}
  else if(family==='ring'){ctx.beginPath();ctx.roundRect(r*.20,-6,r+27,12,3);ctx.fill();ctx.stroke();ctx.strokeStyle='#bca6ff';ctx.lineWidth=5;ctx.shadowColor='#9d78ff';ctx.shadowBlur=9;ctx.beginPath();ctx.arc(r+31,0,13,0,TAU);ctx.stroke();ctx.shadowBlur=0}
  else if(family==='nova'){ctx.fillStyle='#4d5787';ctx.strokeStyle='#2e365b';ctx.beginPath();ctx.roundRect(r*.18,-10,r+30,20,6);ctx.fill();ctx.stroke();ctx.strokeStyle='#7cf5ff';ctx.lineWidth=4;ctx.shadowColor='#7cf5ff';ctx.shadowBlur=12;for(const sy of [-8,0,8]){ctx.beginPath();ctx.moveTo(r+12,sy*.55);ctx.lineTo(r+34,sy);ctx.stroke()}ctx.shadowBlur=0}
  else if(family==='error'){ctx.fillStyle='#101114';ctx.strokeStyle=cannon==='zero'?'#f4f7ff':cannon==='glitch'?'#ff45df':'#79ff3b';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(r*.12,-12,r+38,24,3);ctx.fill();ctx.stroke();ctx.fillStyle='#ff3bef';ctx.fillRect(r+8,-7,7,5);ctx.fillStyle='#45f6ff';ctx.fillRect(r+19,2,12,4);ctx.fillStyle='#79ff3b';ctx.fillRect(r+34,-4,9,8)}
  else{ctx.beginPath();ctx.roundRect(r*.22,-7,r+23,14,4);ctx.fill();ctx.stroke()}
  drawCharacterMark(cannon,r);
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

function drawTank(e){
  if(!e.alive)return;
  const[x,y]=worldToScreen(e.x,e.y);
  if(x<-110||y<-110||x>innerWidth+110||y>innerHeight+110)return;
  const isP=e===player,cannon=e.cannonType||'standard',family=cannonFamily(cannon),theme=TANK_THEMES[cannon]||TANK_THEMES.standard,r=e.r;
  const teamColor=isP?'#5cc0ff':'#ff646d',t=performance.now()*.001;

  ctx.save();ctx.translate(x,y);ctx.rotate(e.angle);

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

  // ERROR 검 모드에서는 포신 대신 ERROR 검을 든다.
  if(swordModeActive)drawErrorSword(e,r,t);else drawPlayerCannon(cannon,r);

  ctx.shadowColor=theme.glow;ctx.shadowBlur=family==='standard'?7:13;
  ctx.fillStyle=theme.body;ctx.strokeStyle=theme.edge;ctx.lineWidth=5;

  if(family==='piercer'){
    polygon(0,0,r,6,Math.PI/6);ctx.fill();ctx.stroke();
  }else if(family==='rocket'){
    ctx.beginPath();ctx.roundRect(-r*.92,-r*.78,r*1.84,r*1.56,9);ctx.fill();ctx.stroke();
    ctx.fillStyle='#34414d';ctx.fillRect(-r-9,-r*.72,10,r*1.44);ctx.fillRect(r-1,-r*.72,10,r*1.44);
  }else if(family==='error'){
    ctx.fillStyle='#101315';ctx.strokeStyle=cannon==='zero'?'#f2f7ff':cannon==='glitch'?'#ff45df':'#71ff3d';
    ctx.beginPath();ctx.rect(-r*.82,-r*.82,r*1.64,r*1.64);ctx.fill();ctx.stroke();
  }else{
    ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();
  }
  ctx.shadowBlur=0;

  // Unique armor language for every cannon.
  if(family==='standard'){
    ctx.strokeStyle='rgba(220,242,255,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*.63,0,TAU);ctx.stroke();
  }else if(family==='rapid'){
    ctx.fillStyle='#d9ffe6';
    for(let i=0;i<6;i++){const q=i*TAU/6;ctx.beginPath();ctx.arc(Math.cos(q)*r*.67,Math.sin(q)*r*.67,3,0,TAU);ctx.fill()}
    ctx.strokeStyle='#b8ffd0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.48,0,TAU);ctx.stroke();
  }else if(family==='spread'){
    ctx.fillStyle='#9bf8ff';
    ctx.beginPath();ctx.moveTo(-r*.85,-r*.35);ctx.lineTo(-r-10,-r*.82);ctx.lineTo(-r*.25,-r*.62);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-r*.85,r*.35);ctx.lineTo(-r-10,r*.82);ctx.lineTo(-r*.25,r*.62);ctx.closePath();ctx.fill();
  }else if(family==='piercer'){
    ctx.strokeStyle='#dac7ff';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-r*.55,0);ctx.lineTo(r*.55,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-r*.55);ctx.lineTo(0,r*.55);ctx.stroke();
  }else if(family==='plasma'){
    ctx.strokeStyle=`rgba(112,244,255,${.55+.3*Math.sin(t*5)})`;ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,r*.70,t, t+Math.PI*1.35);ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,r*.48,-t*1.4,-t*1.4+Math.PI);ctx.stroke();
    ctx.fillStyle='#c9fdff';ctx.shadowColor='#70f4ff';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(0,0,7,0,TAU);ctx.fill();ctx.shadowBlur=0;
  }else if(family==='rocket'){
    ctx.fillStyle='#ffb064';
    for(const sy of [-1,1]){ctx.beginPath();ctx.arc(-r*.55,sy*r*.42,5,0,TAU);ctx.fill()}
    ctx.fillStyle='#232c36';ctx.beginPath();ctx.arc(0,0,r*.36,0,TAU);ctx.fill();
  }else if(family==='ring'){
    ctx.strokeStyle='#d7c4ff';ctx.lineWidth=3;ctx.shadowColor='#bb94ff';ctx.shadowBlur=10;
    ctx.beginPath();ctx.ellipse(0,0,r*.82,r*.34,t,0,TAU);ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,0,r*.82,r*.34,t+Math.PI/2,0,TAU);ctx.stroke();ctx.shadowBlur=0;
  }else if(family==='nova'){
    ctx.fillStyle='#9ff8ff';ctx.shadowColor='#6aeeff';ctx.shadowBlur=10;
    for(let i=0;i<5;i++){const q=t+i*TAU/5;const px=Math.cos(q)*r*.68,py=Math.sin(q)*r*.68;ctx.beginPath();ctx.arc(px,py,3.3,0,TAU);ctx.fill()}
    ctx.beginPath();for(let i=0;i<10;i++){const rr=i%2?r*.16:r*.34,q=-Math.PI/2+i*Math.PI/5;i?ctx.lineTo(Math.cos(q)*rr,Math.sin(q)*rr):ctx.moveTo(Math.cos(q)*rr,Math.sin(q)*rr)}ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  }else if(family==='error'){
    ctx.fillStyle='#ff42df';ctx.fillRect(-r*.62,-r*.48,10,5);
    ctx.fillStyle='#45eaff';ctx.fillRect(r*.08,-r*.12,14,5);
    ctx.fillStyle='#79ff42';ctx.fillRect(-r*.12,r*.38,12,5);
    ctx.strokeStyle='rgba(255,50,220,.7)';ctx.lineWidth=2;ctx.strokeRect(-r*.82+rand(-2,2),-r*.82,r*1.64,r*1.64);
    ctx.strokeStyle='rgba(50,235,255,.6)';ctx.strokeRect(-r*.82+rand(-2,2),-r*.82,r*1.64,r*1.64);
  }

  drawVariantArmor(cannon,r,t);

  // Shared central turret cap.
  ctx.fillStyle=family==='error'?'#080909':'rgba(235,248,255,.22)';
  ctx.beginPath();ctx.arc(0,0,r*.28,0,TAU);ctx.fill();
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
  for(const b of bullets){
    if(b.shape!=='plasma'||b.life<=0)continue;
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
    const[x,y]=worldToScreen(z.x,z.y),p=clamp(z.life/z.maxLife,0,1);ctx.save();ctx.translate(x,y);ctx.globalAlpha=Math.min(1,p*1.3);
    if(z.type==='gravity'){
      ctx.strokeStyle='rgba(132,159,255,.75)';ctx.lineWidth=3;ctx.shadowColor='#829dff';ctx.shadowBlur=16;
      for(let i=0;i<4;i++){const rr=z.radius*(.18+i*.19)+Math.sin(t*3+i)*8;ctx.beginPath();ctx.arc(0,0,rr,t*(i%2?-.8:.8)+i,TAU+t*(i%2?-.8:.8)+i);ctx.stroke()}
      ctx.fillStyle='rgba(30,38,92,.22)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.fillStyle='#dbe3ff';ctx.shadowBlur=22;ctx.beginPath();ctx.arc(0,0,12+Math.sin(t*8)*3,0,TAU);ctx.fill();
    }else if(z.type==='burn'){
      ctx.fillStyle='rgba(255,90,25,.13)';ctx.beginPath();ctx.arc(0,0,z.radius,0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,155,58,.70)';ctx.lineWidth=3;ctx.shadowColor='#ff7b2f';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(0,0,z.radius*(.92+.04*Math.sin(t*7)),0,TAU);ctx.stroke();
      for(let k=0;k<14;k++){const q=k*TAU/14+t*(k%2?1.1:-.8),rr=z.radius*(.18+(k%5)*.15),fx=Math.cos(q)*rr,fy=Math.sin(q)*rr,h=8+10*(.5+.5*Math.sin(t*9+k));ctx.fillStyle=k%3===0?'rgba(255,218,93,.82)':'rgba(255,98,35,.74)';ctx.beginPath();ctx.moveTo(fx-4,fy+4);ctx.quadraticCurveTo(fx,fy-h,fx+4,fy+4);ctx.closePath();ctx.fill()}
    }
    ctx.restore();
  }
}
function drawCombatEffects(){
  for(const f of combatFx){
    const[x,y]=worldToScreen(f.x,f.y),p=clamp(f.life/f.maxLife,0,1),q=1-p;
    ctx.save();ctx.translate(x,y);ctx.rotate(f.angle);ctx.globalAlpha=Math.min(1,p*1.35);
    if(f.type==='muzzle'){
      ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-f.radius*.35,-6);ctx.lineTo(-f.radius,0);ctx.lineTo(-f.radius*.35,6);ctx.closePath();ctx.fill();
    }else if(f.type==='rapid'){
      ctx.strokeStyle=f.color;ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-4,i*5-5);ctx.lineTo(-f.radius*(.4+q*.6),i*5-5);ctx.stroke()}
    }else if(f.type==='spread'){
      ctx.fillStyle=f.color;ctx.globalAlpha*=.42;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,f.radius*(.4+q*.6),Math.PI-.52,Math.PI+.52);ctx.closePath();ctx.fill();
    }else if(f.type==='rail'){
      ctx.shadowColor=f.color;ctx.shadowBlur=10;ctx.strokeStyle=f.color;ctx.lineWidth=4*(1-q)+1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-f.radius*(.5+q),0);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='plasmaMuzzle'){
      ctx.shadowColor=f.color;ctx.shadowBlur=15;ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,f.radius*(.3+q*.7),0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='rocketMuzzle'){
      ctx.fillStyle='#ffb05c';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-f.radius*(.6+q*.7),-10*p);ctx.lineTo(-f.radius*(.35+q*.5),0);ctx.lineTo(-f.radius*(.6+q*.7),10*p);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(220,230,238,.32)';ctx.beginPath();ctx.arc(-f.radius*q,0,12+q*14,0,TAU);ctx.fill();
    }else if(f.type==='ringMuzzle'){
      ctx.strokeStyle=f.color;ctx.lineWidth=5*p+1;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(-f.radius*q*.6,0,8+q*f.radius*.55,0,TAU);ctx.stroke();ctx.shadowBlur=0;
    }else if(f.type==='novaMuzzle'){
      ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.shadowColor=f.color;ctx.shadowBlur=13;
      for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*f.radius*q,Math.sin(a)*f.radius*q);ctx.stroke()}ctx.shadowBlur=0;
    }else if(f.type==='errorMuzzle'){
      ctx.fillStyle='#76ff43';ctx.fillRect(-f.radius*q,-10,18,5);ctx.fillStyle='#ff3fe2';ctx.fillRect(-f.radius*q*.65,2,25,5);ctx.fillStyle='#42eaff';ctx.fillRect(-f.radius*q*.85,10,13,4);
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

function drawBullets(){
  const time=performance.now()*.001;
  for(const b of bullets){
    const[x,y]=worldToScreen(b.x,b.y);
    const a=Math.atan2(b.vy,b.vx);
    const phase=b.x*.013+b.y*.017+time*5;
    ctx.save();ctx.translate(x,y);ctx.rotate(a);

    // STANDARD — blue energy slug
    if(b.shape==='round'){
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
function drawParticles(){for(const p of particles){const[x,y]=worldToScreen(p.x,p.y);ctx.globalAlpha=clamp(p.life/.7,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,p.r,0,TAU);ctx.fill()}ctx.globalAlpha=1}
function drawBoundary(){const[x,y]=worldToScreen(0,0);ctx.strokeStyle='rgba(255,95,95,.35)';ctx.lineWidth=8;ctx.strokeRect(x,y,WORLD,WORLD)}
function drawMinimap(){
  const size=108,pad=15,x=innerWidth-size-pad,y=innerHeight-size-pad;
  ctx.fillStyle='rgba(5,12,22,.56)';ctx.fillRect(x,y,size,size);
  ctx.strokeStyle='rgba(255,255,255,.13)';ctx.strokeRect(x,y,size,size);
  ctx.fillStyle='#5baaff';ctx.beginPath();ctx.arc(x+player.x/WORLD*size,y+player.y/WORLD*size,3,0,TAU);ctx.fill();
  ctx.fillStyle='rgba(255,110,110,.88)';
  for(const r of remotePlayers.values()){
    if(!r.alive)continue;
    ctx.beginPath();ctx.arc(x+r.x/WORLD*size,y+r.y/WORLD*size,2.2,0,TAU);ctx.fill();
  }
}
function drawMobileAimGuide(){
  if(!running||!player?.alive||!input.mobileAimActive)return;
  const[px,py]=worldToScreen(player.x,player.y);
  const a=Math.atan2(input.mouseY-py,input.mouseX-px);
  const cannon=player.cannonType||'standard';
  const range=cannon==='piercer'?610:cannon==='rocket'?455:cannon==='spread'?355:(cannon==='error'&&player.errorSwordMode)?390:500;
  const halfWidth=cannon==='spread'?54:cannon==='rocket'?30:(cannon==='error'&&player.errorSwordMode)?40:23;
  const sx=px+Math.cos(a)*(player.r+22),sy=py+Math.sin(a)*(player.r+22);
  const ex=px+Math.cos(a)*range,ey=py+Math.sin(a)*range;
  const nx=-Math.sin(a),ny=Math.cos(a);

  ctx.save();
  // 브롤스타즈식으로 방향 전체가 보이는 반투명 공격 레인.
  const grad=ctx.createLinearGradient(sx,sy,ex,ey);
  grad.addColorStop(0,'rgba(215,248,255,.30)');
  grad.addColorStop(.72,'rgba(125,220,255,.18)');
  grad.addColorStop(1,'rgba(100,205,255,.08)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(sx+nx*halfWidth*.55,sy+ny*halfWidth*.55);
  ctx.lineTo(ex+nx*halfWidth,ey+ny*halfWidth);
  ctx.arc(ex,ey,halfWidth,a+Math.PI/2,a-Math.PI/2,false);
  ctx.lineTo(sx-nx*halfWidth*.55,sy-ny*halfWidth*.55);
  ctx.closePath();ctx.fill();

  ctx.strokeStyle='rgba(225,251,255,.72)';ctx.lineWidth=2.2;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(sx+nx*halfWidth*.55,sy+ny*halfWidth*.55);ctx.lineTo(ex+nx*halfWidth,ey+ny*halfWidth);ctx.stroke();
  ctx.beginPath();ctx.moveTo(sx-nx*halfWidth*.55,sy-ny*halfWidth*.55);ctx.lineTo(ex-nx*halfWidth,ey-ny*halfWidth);ctx.stroke();

  ctx.fillStyle='rgba(93,208,255,.16)';ctx.strokeStyle='rgba(235,253,255,.94)';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(ex,ey,halfWidth*.72,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.92)';ctx.beginPath();ctx.arc(ex,ey,4,0,TAU);ctx.fill();
  ctx.restore();
}
function update(dt){
  updatePlayer(dt);
  updateRemotePlayers(dt);
  updateShapes(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateCombatFx(dt);
  updateSkillZones(dt);
  updateSkillHud();
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
  ctx.save();
  if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake*=.86}
  drawGrid();drawBoundary();shapes.forEach(drawShape);drawPlasmaTethers();drawSkillZones();drawCombatEffects();drawBullets();
  remotePlayers.forEach(drawTank);drawTank(player);drawParticles();
  ctx.restore();
  drawMobileAimGuide();
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
if(ui.skillBtn){
  ui.skillBtn.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();
    if(player?.cannonType==='error'){
      if(player.errorSwordMode)startErrorQCharge();
      else activateSkill();
    }else activateSkill();
  });
  const releaseQ=e=>{
    e.preventDefault();e.stopPropagation();
    if(player?.cannonType==='error')releaseErrorQCharge();
  };
  ui.skillBtn.addEventListener('pointerup',releaseQ);
  ui.skillBtn.addEventListener('pointercancel',e=>{
    e.preventDefault();e.stopPropagation();
    if(player?.cannonType==='error')releaseErrorQCharge();
  });
  ui.skillBtn.addEventListener('contextmenu',e=>e.preventDefault());
}
if(ui.skill2Btn)ui.skill2Btn.onclick=e=>{e.preventDefault();e.stopPropagation();activateSkill2()};
if(ui.skill3Btn)ui.skill3Btn.onclick=e=>{e.preventDefault();e.stopPropagation();activateSkill3()};
ui.leaveBattleBtn.onclick=()=>void leaveBattleToLobby();ui.respawnBtn.onclick=()=>{ui.deathScreen.classList.remove('show');running=false;void disconnectOnlineArena();window.IronCellAuth?.showLobby?.();};
function isEditableInputTarget(target){
  if(!(target instanceof Element))return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}
addEventListener('keydown',e=>{
  if(isEditableInputTarget(e.target))return;
  input.keys.add(e.code);
  if(e.code==='KeyQ'&&!e.repeat){
    if(player?.cannonType==='error'){
      if(player.errorSwordMode)startErrorQCharge();
      else activateSkill();
    }else activateSkill();
    e.preventDefault()
  }
  if(e.code==='KeyR'&&!e.repeat){activateSkill2();e.preventDefault()}
  if(e.code==='KeyT'&&!e.repeat){activateSkill3();e.preventDefault()}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()
});
addEventListener('keyup',e=>{
  if(isEditableInputTarget(e.target))return;
  input.keys.delete(e.code);
  if(e.code==='KeyQ'&&player?.cannonType==='error'){
    releaseErrorQCharge();
    e.preventDefault();
  }
});addEventListener('mousemove',e=>{input.mouseX=e.clientX;input.mouseY=e.clientY});addEventListener('mousedown',e=>{if(e.button===0)input.firing=true});addEventListener('mouseup',e=>{if(e.button===0)input.firing=false});addEventListener('blur',()=>{input.firing=false;input.mobileAimActive=false;input.keys.clear();if(player?.errorQCharging)cancelErrorQCharge()});
const moveZone=document.querySelector('#mobileMove'),knob=moveZone.querySelector('.stick-knob');let moveTouch=null;function moveTouchUpdate(t){const r=moveZone.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const max=42,d=Math.hypot(dx,dy)||1;if(d>max){dx=dx/d*max;dy=dy/d*max}input.moveX=dx/max;input.moveY=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}moveZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];moveTouch=t.identifier;moveTouchUpdate(t);e.preventDefault()},{passive:false});moveZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===moveTouch)moveTouchUpdate(t);e.preventDefault()},{passive:false});function endMove(e){for(const t of e.changedTouches)if(t.identifier===moveTouch){moveTouch=null;input.moveX=0;input.moveY=0;knob.style.transform='none'}}moveZone.addEventListener('touchend',endMove,{passive:false});moveZone.addEventListener('touchcancel',endMove,{passive:false});
const aimZone=document.querySelector('#mobileAim');let aimTouch=null;function aimUpdate(t){input.mouseX=t.clientX;input.mouseY=t.clientY;input.firing=true;input.mobileAimActive=true;aimZone.classList.add('aiming')}aimZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];aimTouch=t.identifier;aimUpdate(t);e.preventDefault()},{passive:false});aimZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===aimTouch)aimUpdate(t);e.preventDefault()},{passive:false});function endAim(e){for(const t of e.changedTouches)if(t.identifier===aimTouch){aimTouch=null;input.firing=false;input.mobileAimActive=false;aimZone.classList.remove('aiming')}}aimZone.addEventListener('touchend',endAim,{passive:false});aimZone.addEventListener('touchcancel',endAim,{passive:false});

window.IronCellGame = {
  stopForLogout(){
    running=false;
    paused=false;
    input.firing=false;
    input.keys.clear();
    if(player?.errorQCharging)cancelErrorQCharge();
    ui.deathScreen.classList.remove('show');
    ui.skillHud?.classList.add('hidden');ui.skill2Btn?.classList.add('hidden');ui.skill3Btn?.classList.add('hidden');
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
