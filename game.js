(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const ui={level:document.querySelector('#levelText'),score:document.querySelector('#scoreText'),xp:document.querySelector('#xpBar'),points:document.querySelector('#pointText'),upgrades:document.querySelector('#upgradeList'),upgradePanel:document.querySelector('#upgradePanel'),startScreen:document.querySelector('#startScreen'),deathScreen:document.querySelector('#deathScreen'),startBtn:document.querySelector('#startBtn'),respawnBtn:document.querySelector('#respawnBtn'),leaveBattleBtn:document.querySelector('#leaveBattleBtn'),nameInput:document.querySelector('#nameInput'),deathLevel:document.querySelector('#deathLevel'),deathScore:document.querySelector('#deathScore'),deathKills:document.querySelector('#deathKills'),deathGems:document.querySelector('#deathGems'),classPanel:document.querySelector('#classPanel'),classChoices:document.querySelector('#classChoices'),onlineCount:document.querySelector('#onlineCount'),networkStatus:document.querySelector('#networkStatus')};
const TAU=Math.PI*2,WORLD=4200,GRID=56;
const NORMAL_SHAPE_TARGET=95;
const CENTRAL_PENTAGON_TARGET=220;
const CENTRAL_PENTAGON_RADIUS=430;
let running=false,paused=false,last=performance.now(),camera={x:0,y:0},shapes=[],bullets=[],particles=[],shake=0,classUpgradeShown=false,player;
const remotePlayers=new Map();
let onlineChannel=null,onlineReady=false,onlineSelfId='',lastStateSend=0,networkSerial=0,lastRunAutosave=0,runSaveBusy=false;
const processedDamageIds=new Set();
const input={keys:new Set(),mouseX:innerWidth/2,mouseY:innerHeight/2,firing:false,moveX:0,moveY:0,mobileAimActive:false};
const statsDef=[['maxHealth','최대 체력'],['regen','체력 회복'],['bulletDamage','탄환 피해'],['bulletSpeed','탄환 속도'],['reload','연사 속도'],['moveSpeed','이동 속도']];
function defaultPlayer(){return{x:WORLD/2,y:WORLD/2,vx:0,vy:0,r:27,angle:0,hp:120,maxHp:120,regenTimer:0,level:1,xp:0,xpNeed:42,score:0,kills:0,points:0,fireCd:0,name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',runId:'',stats:{maxHealth:0,regen:0,bulletDamage:0,bulletSpeed:0,reload:0,moveSpeed:0}}}
function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',resize);resize();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy}function norm(dx,dy){const d=Math.hypot(dx,dy)||1;return[dx/d,dy/d]}
function colorForShape(t){return t==='square'?'#f7c843':t==='triangle'?'#e86464':'#6b8df2'}function edgeForShape(t){return t==='square'?'#b99320':t==='triangle'?'#a83f42':'#425cb2'}
function spawnShape(type=null){
  const t=type||(Math.random()<.57?'square':Math.random()<.78?'triangle':'pentagon');
  const c=t==='square'?{r:20,hp:36,xp:12,sides:4}:t==='triangle'?{r:24,hp:58,xp:22,sides:3}:{r:34,hp:145,xp:56,sides:5};
  shapes.push({
    type:t,x:rand(100,WORLD-100),y:rand(100,WORLD-100),
    r:c.r,hp:c.hp,maxHp:c.hp,xp:c.xp,sides:c.sides,
    angle:rand(0,TAU),spin:rand(-.35,.35),vx:0,vy:0,
    centralCluster:false
  });
}
function spawnCentralPentagon(){
  // 중앙일수록 더 빽빽하도록 반지름을 편향시킨다.
  const a=rand(0,TAU);
  const radius=Math.pow(Math.random(),1.85)*CENTRAL_PENTAGON_RADIUS;
  const jitter=rand(-12,12);
  const x=clamp(WORLD/2+Math.cos(a)*(radius+jitter),70,WORLD-70);
  const y=clamp(WORLD/2+Math.sin(a)*(radius+jitter),70,WORLD-70);
  shapes.push({
    type:'pentagon',
    x,y,r:34,hp:145,maxHp:145,xp:56,sides:5,
    angle:rand(0,TAU),spin:rand(-.42,.42),vx:0,vy:0,
    centralCluster:true
  });
}
function populate(){
  shapes=[];bullets=[];particles=[];
  for(let i=0;i<NORMAL_SHAPE_TARGET;i++)spawnShape();
  for(let i=0;i<CENTRAL_PENTAGON_TARGET;i++)spawnCentralPentagon();
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
      name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',lastSeen:performance.now()
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
    classType:player.classType||'basic',alive:!!player.alive
  };
}
function sendOnline(event,payload){
  if(!onlineReady||!onlineChannel)return;
  void onlineChannel.send({type:'broadcast',event,payload}).catch(()=>{});
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
  sendOnline('shot',{
    id:`${onlineSelfId}:${++networkSerial}`,
    ownerId:onlineSelfId,
    x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,life:b.life,
    cannon:b.cannon,shape:b.shape,pierce:b.pierce||1,splashRadius:b.splashRadius||0
  });
}
function addRemoteShot(payload){
  if(!payload||String(payload.ownerId||'')===onlineSelfId)return;
  bullets.push({
    x:safeRemoteNumber(payload.x),y:safeRemoteNumber(payload.y),
    vx:safeRemoteNumber(payload.vx),vy:safeRemoteNumber(payload.vy),
    r:Math.max(2,safeRemoteNumber(payload.r,6)),
    damage:0,life:Math.max(.05,safeRemoteNumber(payload.life,1.3)),
    owner:null,ownerId:String(payload.ownerId||''),
    team:'remote',networkRemote:true,
    cannon:String(payload.cannon||'standard'),
    shape:String(payload.shape||'round'),
    pierce:1,splashRadius:0,hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
  });
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
  const amount=Math.max(0,Math.min(5000,Number(payload?.amount)||0));
  if(!amount)return;
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
  ch.on('broadcast',{event:'damage'},({payload})=>receiveDamage(payload));
  ch.on('broadcast',{event:'kill'},({payload})=>receiveKill(payload));
  ch.on('presence',{event:'sync'},()=>updateOnlineCount());
  ch.on('presence',{event:'join'},()=>updateOnlineCount());
  ch.on('presence',{event:'leave'},({key})=>{
    if(key)remotePlayers.delete(String(key));
    updateOnlineCount();
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
  const s=player.stats;let damage=17+s.bulletDamage*4,bulletSpeed=610+s.bulletSpeed*55,reload=.34-s.reload*.03,move=245+s.moveSpeed*15;
  if(player.classType==='assault'){damage*=1.15;move*=1.08}
  if(player.classType==='precision'){damage*=1.25;bulletSpeed*=1.15;reload*=1.10}
  if(player.classType==='overdrive'){damage*=.90;reload*=.78}
  const cannon=player.cannonType||'standard';
  if(cannon==='rapid'){damage*=.48;bulletSpeed*=1.06;reload*=.36}
  if(cannon==='spread'){damage*=.50;bulletSpeed*=.90;reload*=1.30}
  if(cannon==='piercer'){damage*=1.15;bulletSpeed*=1.42;reload*=1.48}
  if(cannon==='plasma'){damage*=1.35;bulletSpeed*=.72;reload*=1.62}
  if(cannon==='rocket'){damage*=2.15;bulletSpeed*=.60;reload*=2.20}
  if(cannon==='ring'){damage*=.86;bulletSpeed*=1.05;reload*=1.15}
  if(cannon==='nova'){damage*=1.20;bulletSpeed*=.92;reload*=1.42}
  if(cannon==='error'){damage*=2.55;bulletSpeed*=1.60;reload*=1.75}
  return{damage,bulletSpeed,reload:Math.max(.07,reload),move};
}
function fire(e){
  if(e!==player||e.fireCd>0)return;
  const a=e.angle,p=playerParams();e.fireCd=p.reload;
  const cannon=e.cannonType||'standard';
  let shots=[{angle:a,side:0,damageMul:1}];
  if(cannon==='spread')shots=[-.25,-.125,0,.125,.25].map(v=>({angle:a+v,side:0,damageMul:1}));
  if(cannon==='nova')shots=[-.10,0,.10].map(v=>({angle:a+v,side:0,damageMul:.78}));
  if(cannon==='error')shots=[{angle:a,side:0,damageMul:1}];
  for(const shot of shots){
    const sa=shot.angle,px=-Math.sin(sa)*shot.side,py=Math.cos(sa)*shot.side;
    const b={
      x:e.x+Math.cos(sa)*(e.r+18)+px,y:e.y+Math.sin(sa)*(e.r+18)+py,
      vx:Math.cos(sa)*p.bulletSpeed+e.vx*.18,vy:Math.sin(sa)*p.bulletSpeed+e.vy*.18,
      r:6,damage:p.damage*shot.damageMul,life:1.65,owner:e,ownerId:onlineSelfId,
      team:'player',cannon,shape:'round',pierce:1,splashRadius:0,
      hitTargets:new Set(),hitIds:new Set(),tetherHits:new Map()
    };
    if(cannon==='rapid'){b.r=4;b.life=1.35;b.shape='capsule'}
    if(cannon==='spread'){b.r=4;b.life=.95;b.shape='pellet'}
    if(cannon==='piercer'){b.r=5;b.life=1.75;b.shape='rail';b.pierce=4}
    if(cannon==='plasma'){b.r=13;b.life=2.15;b.shape='plasma';b.splashRadius=72}
    if(cannon==='rocket'){b.r=8;b.life=2.15;b.shape='rocket';b.splashRadius=112}
    if(cannon==='ring'){b.r=12;b.life=1.85;b.shape='ring';b.pierce=8}
    if(cannon==='nova'){b.r=10;b.life=1.90;b.shape='nova';b.pierce=3;b.splashRadius=46}
    if(cannon==='error'){b.r=9;b.life=2.05;b.shape='error';b.pierce=12;b.splashRadius=82}
    bullets.push(b);
    broadcastShot(b);
  }
  const recoil=cannon==='rocket'?22:cannon==='error'?27:cannon==='nova'?17:12;
  e.vx-=Math.cos(a)*recoil;
  e.vy-=Math.sin(a)*recoil;
}
function burst(x,y,color,count=8){for(let i=0;i<count;i++){const a=rand(0,TAU),sp=rand(45,180);particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.28,.7),color,r:rand(2,5)})}}
function applySplashDamage(b,x,y){
  if(!b.splashRadius||b.team!=='player')return;
  const radius=b.splashRadius,r2=radius*radius,base=b.damage*(b.cannon==='rocket'?.72:.58);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;if(d2>r2)continue;
    const scale=1-Math.sqrt(d2)/radius;
    s.hp-=base*(.35+.65*scale);
    const[nx,ny]=norm(dx||1,dy||0);s.vx+=nx*110*scale;s.vy+=ny*110*scale;
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
function updatePlayer(dt){if(!player.alive)return;const p=playerParams();let mx=input.moveX,my=input.moveY;if(input.keys.has('KeyA')||input.keys.has('ArrowLeft'))mx-=1;if(input.keys.has('KeyD')||input.keys.has('ArrowRight'))mx+=1;if(input.keys.has('KeyW')||input.keys.has('ArrowUp'))my-=1;if(input.keys.has('KeyS')||input.keys.has('ArrowDown'))my+=1;if(mx||my){[mx,my]=norm(mx,my);player.vx+=mx*p.move*dt*5.2;player.vy+=my*p.move*dt*5.2}player.angle=Math.atan2(camera.y+input.mouseY-player.y,camera.x+input.mouseX-player.x);let sp=Math.hypot(player.vx,player.vy);if(sp>p.move){player.vx=player.vx/sp*p.move;player.vy=player.vy/sp*p.move}player.x=clamp(player.x+player.vx*dt,player.r,WORLD-player.r);player.y=clamp(player.y+player.vy*dt,player.r,WORLD-player.r);player.vx*=Math.pow(.0006,dt);player.vy*=Math.pow(.0006,dt);player.fireCd=Math.max(0,player.fireCd-dt);if(input.firing||input.keys.has('Space'))fire(player);if(player.hp<player.maxHp){player.regenTimer+=dt;if(player.regenTimer>3.8)player.hp=Math.min(player.maxHp,player.hp+(1.4+player.stats.regen*1.1)*dt)}else player.regenTimer=0}
function updateShapes(dt){
  for(const s of shapes){
    s.angle+=s.spin*dt;
    s.x=clamp(s.x+s.vx*dt,s.r,WORLD-s.r);
    s.y=clamp(s.y+s.vy*dt,s.r,WORLD-s.r);
    s.vx*=Math.pow(.05,dt);
    s.vy*=Math.pow(.05,dt);

    // 중앙 무리 오각형은 충격으로 너무 멀리 흩어지지 않게 천천히 중앙으로 복귀한다.
    if(s.centralCluster){
      const dx=WORLD/2-s.x,dy=WORLD/2-s.y,d=Math.hypot(dx,dy)||1;
      if(d>CENTRAL_PENTAGON_RADIUS*1.12){
        s.vx+=dx/d*26*dt;
        s.vy+=dy/d*26*dt;
      }
    }
  }

  let normalCount=0,centralCount=0;
  for(const s of shapes){
    if(s.centralCluster)centralCount++;
    else normalCount++;
  }
  while(normalCount<NORMAL_SHAPE_TARGET){spawnShape();normalCount++}
  while(centralCount<CENTRAL_PENTAGON_TARGET){spawnCentralPentagon();centralCount++}
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
    alert('점수 정산에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 나가기를 눌러주세요.');
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
  if(ui.deathGems)ui.deathGems.textContent=(player.score*5).toLocaleString();
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
    s.hp-=damage;
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
    if(b.life<=0||b.x<0||b.y<0||b.x>WORLD||b.y>WORLD){
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
        s.hp-=b.damage;
        const[nx,ny]=norm(b.vx,b.vy);s.vx+=nx*75;s.vy+=ny*75;
        burst(b.x,b.y,colorForShape(s.type),3);
        if(s.hp<=0){
          if(b.owner===player)gainXp(s.xp);
          shapes.splice(j,1);
          burst(s.x,s.y,colorForShape(s.type),10);
        }
        if(b.splashRadius){
          applySplashDamage(b,b.x,b.y);remove=true;
        }else if((b.pierce||1)>1){
          b.pierce--;b.damage*=.88;
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
          if(b.splashRadius){
            applySplashDamage(b,b.x,b.y);remove=true;
          }else if((b.pierce||1)>1){
            b.pierce--;b.damage*=.88;
          }else remove=true;
          break;
        }
      }
    }

    if(remove)bullets.splice(i,1);
  }
}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.04,dt);p.vy*=Math.pow(.04,dt)}}
function cameraUpdate(){const tx=player.x-innerWidth/2,ty=player.y-innerHeight/2;camera.x+=(tx-camera.x)*.12;camera.y+=(ty-camera.y)*.12;camera.x=clamp(camera.x,0,Math.max(0,WORLD-innerWidth));camera.y=clamp(camera.y,0,Math.max(0,WORLD-innerHeight))}
const worldToScreen=(x,y)=>[x-camera.x,y-camera.y];
function drawGrid(){ctx.fillStyle='#152235';ctx.fillRect(0,0,innerWidth,innerHeight);const sx=-(camera.x%GRID),sy=-(camera.y%GRID);ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1;ctx.beginPath();for(let x=sx;x<innerWidth;x+=GRID){ctx.moveTo(x,0);ctx.lineTo(x,innerHeight)}for(let y=sy;y<innerHeight;y+=GRID){ctx.moveTo(0,y);ctx.lineTo(innerWidth,y)}ctx.stroke()}
function polygon(x,y,r,sides,a){ctx.beginPath();for(let i=0;i<sides;i++){const q=a+i*TAU/sides,px=x+Math.cos(q)*r,py=y+Math.sin(q)*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath()}
function drawShape(s){const[x,y]=worldToScreen(s.x,s.y);if(x<-80||y<-80||x>innerWidth+80||y>innerHeight+80)return;ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=10;ctx.shadowOffsetY=4;polygon(x,y,s.r,s.sides,s.angle);ctx.fillStyle=colorForShape(s.type);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=edgeForShape(s.type);ctx.lineWidth=5;ctx.stroke();if(s.hp<s.maxHp){const w=s.r*1.6;ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-w/2,y+s.r+8,w,4);ctx.fillStyle='#7ee787';ctx.fillRect(x-w/2,y+s.r+8,w*(s.hp/s.maxHp),4)}ctx.restore()}
function drawPlayerCannon(cannon,r){
  ctx.fillStyle='#6f7f90';ctx.strokeStyle='#45515f';ctx.lineWidth=4;
  if(cannon==='rapid'){ctx.beginPath();ctx.roundRect(r*.22,-5,r+28,10,3);ctx.fill();ctx.stroke();ctx.fillStyle='#9aa9b8';for(let i=0;i<3;i++)ctx.fillRect(r+2+i*7,-2,4,4)}
  else if(cannon==='spread'){ctx.beginPath();ctx.moveTo(r*.20,-9);ctx.lineTo(r+32,-16);ctx.lineTo(r+32,16);ctx.lineTo(r*.20,9);ctx.closePath();ctx.fill();ctx.stroke()}
  else if(cannon==='piercer'){ctx.beginPath();ctx.roundRect(r*.18,-4,r+42,8,2);ctx.fill();ctx.stroke();ctx.strokeStyle='#9baabb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r*.35,-9);ctx.lineTo(r+34,-9);ctx.moveTo(r*.35,9);ctx.lineTo(r+34,9);ctx.stroke()}
  else if(cannon==='plasma'){ctx.beginPath();ctx.roundRect(r*.18,-11,r+25,22,7);ctx.fill();ctx.stroke();ctx.fillStyle='#73e9ff';ctx.shadowColor='#73e9ff';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(r+26,0,7,0,TAU);ctx.fill();ctx.shadowBlur=0}
  else if(cannon==='rocket'){ctx.fillStyle='#657686';ctx.beginPath();ctx.roundRect(r*.10,-15,r+24,30,5);ctx.fill();ctx.stroke();ctx.fillStyle='#303b48';ctx.fillRect(r+10,-9,17,18)}
  else if(cannon==='ring'){ctx.beginPath();ctx.roundRect(r*.20,-6,r+27,12,3);ctx.fill();ctx.stroke();ctx.strokeStyle='#bca6ff';ctx.lineWidth=5;ctx.shadowColor='#9d78ff';ctx.shadowBlur=9;ctx.beginPath();ctx.arc(r+31,0,13,0,TAU);ctx.stroke();ctx.shadowBlur=0}
  else if(cannon==='nova'){
    ctx.fillStyle='#4d5787';ctx.strokeStyle='#2e365b';ctx.beginPath();ctx.roundRect(r*.18,-10,r+30,20,6);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#7cf5ff';ctx.lineWidth=4;ctx.shadowColor='#7cf5ff';ctx.shadowBlur=12;
    for(const sy of [-8,0,8]){ctx.beginPath();ctx.moveTo(r+12,sy*.55);ctx.lineTo(r+34,sy);ctx.stroke()}
    ctx.shadowBlur=0;
  }
  else if(cannon==='error'){
    ctx.fillStyle='#101114';ctx.strokeStyle='#79ff3b';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(r*.12,-12,r+38,24,3);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ff3bef';ctx.fillRect(r+8,-7,7,5);ctx.fillStyle='#45f6ff';ctx.fillRect(r+19,2,12,4);ctx.fillStyle='#79ff3b';ctx.fillRect(r+34,-4,9,8);
  }
  else{ctx.beginPath();ctx.roundRect(r*.22,-7,r+23,14,4);ctx.fill();ctx.stroke()}
}
function drawTank(e){
  if(!e.alive)return;const[x,y]=worldToScreen(e.x,e.y);if(x<-100||y<-100||x>innerWidth+100||y>innerHeight+100)return;
  const isP=e===player,body=isP?'#55a7ff':'#f06464',edge=isP?'#2b6fbe':'#a73f45',r=e.r;
  ctx.save();ctx.translate(x,y);ctx.rotate(e.angle);
  drawPlayerCannon(e.cannonType||'standard',r);
  ctx.shadowColor='rgba(0,0,0,.30)';ctx.shadowBlur=12;ctx.shadowOffsetY=5;ctx.fillStyle=body;ctx.strokeStyle=edge;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,.11)';ctx.beginPath();ctx.arc(-r*.18,-r*.22,r*.36,0,TAU);ctx.fill();ctx.restore();
  if(e.hp<e.maxHp||!isP){const w=r*2;ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(x-w/2,y+r+10,w,5);ctx.fillStyle='#6be28a';ctx.fillRect(x-w/2,y+r+10,w*clamp(e.hp/e.maxHp,0,1),5)}
  ctx.fillStyle='rgba(255,255,255,.87)';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText(e.name,x,y-r-13);
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

function drawBullets(){
  for(const b of bullets){
    const[x,y]=worldToScreen(b.x,b.y),a=Math.atan2(b.vy,b.vx);ctx.save();ctx.translate(x,y);ctx.rotate(a);
    if(b.shape==='capsule'){ctx.fillStyle='#8ed0ff';ctx.strokeStyle='#467aa7';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-7,-3,14,6,3);ctx.fill();ctx.stroke()}
    else if(b.shape==='pellet'){ctx.fillStyle='#ffd777';ctx.strokeStyle='#b18432';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.stroke()}
    else if(b.shape==='rail'){ctx.fillStyle='#e6f3ff';ctx.strokeStyle='#6aa3d6';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-11,-3,22,6,2);ctx.fill();ctx.stroke();ctx.fillStyle='#75c9ff';ctx.fillRect(-7,-1,14,2)}
    else if(b.shape==='plasma'){
      const pulse=1+.10*Math.sin(performance.now()*.026+(b.x+b.y)*.015);
      ctx.shadowColor='#61eaff';ctx.shadowBlur=22;
      const gr=ctx.createRadialGradient(-4,-4,1,0,0,14*pulse);gr.addColorStop(0,'#fff');gr.addColorStop(.23,'#b8fbff');gr.addColorStop(.55,'#62ddff');gr.addColorStop(1,'#2758c6');
      ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,13*pulse,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(180,250,255,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,17*pulse,0,TAU);ctx.stroke();
      ctx.strokeStyle='rgba(94,194,255,.40)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,21*pulse,0,TAU);ctx.stroke();ctx.shadowBlur=0
    }
    else if(b.shape==='rocket'){ctx.fillStyle='#d9e1e8';ctx.strokeStyle='#637180';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(3,-6);ctx.lineTo(-8,-5);ctx.lineTo(-8,5);ctx.lineTo(3,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ff9f43';ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-15,0);ctx.lineTo(-8,3);ctx.closePath();ctx.fill()}
    else if(b.shape==='ring'){ctx.shadowColor='#a988ff';ctx.shadowBlur=10;ctx.strokeStyle='#c9b6ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.stroke()}
    else if(b.shape==='nova'){
      ctx.shadowColor='#70f3ff';ctx.shadowBlur=15;ctx.fillStyle='#d9fbff';ctx.strokeStyle='#62bbff';ctx.lineWidth=2;
      ctx.beginPath();
      for(let k=0;k<10;k++){const rr=k%2===0?11:5,aa=-Math.PI/2+k*Math.PI/5;const px=Math.cos(aa)*rr,py=Math.sin(aa)*rr;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}
      ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    }
    else if(b.shape==='error'){
      ctx.shadowColor='#72ff45';ctx.shadowBlur=12;ctx.fillStyle='#111';ctx.strokeStyle='#72ff45';ctx.lineWidth=3;
      ctx.fillRect(-10,-8,20,16);ctx.strokeRect(-10,-8,20,16);
      ctx.fillStyle='#ff3bea';ctx.fillRect(-7,-5,8,4);ctx.fillStyle='#42eaff';ctx.fillRect(1,1,7,4);ctx.shadowBlur=0;
    }
    else{ctx.fillStyle=b.team==='player'?'#78bdff':'#ff7b7b';ctx.strokeStyle=b.team==='player'?'#3c77b4':'#ad4549';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,b.r,0,TAU);ctx.fill();ctx.stroke()}
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
  const [px,py]=worldToScreen(player.x,player.y);
  const tx=input.mouseX,ty=input.mouseY;
  const a=Math.atan2(ty-py,tx-px);
  const sx=px+Math.cos(a)*(player.r+18);
  const sy=py+Math.sin(a)*(player.r+18);

  ctx.save();
  ctx.lineCap='round';
  ctx.setLineDash([10,8]);
  ctx.lineWidth=2;
  const grad=ctx.createLinearGradient(sx,sy,tx,ty);
  grad.addColorStop(0,'rgba(105,205,255,.85)');
  grad.addColorStop(1,'rgba(105,205,255,.18)');
  ctx.strokeStyle=grad;
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(tx,ty);ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle='rgba(133,225,255,.92)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(tx,ty,15,0,TAU);ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx-22,ty);ctx.lineTo(tx-8,ty);
  ctx.moveTo(tx+8,ty);ctx.lineTo(tx+22,ty);
  ctx.moveTo(tx,ty-22);ctx.lineTo(tx,ty-8);
  ctx.moveTo(tx,ty+8);ctx.lineTo(tx,ty+22);
  ctx.stroke();
  ctx.restore();
}
function update(dt){
  updatePlayer(dt);
  updateRemotePlayers(dt);
  updateShapes(dt);
  updateBullets(dt);
  updateParticles(dt);
  cameraUpdate();
  broadcastLocalState();

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
  drawGrid();drawBoundary();shapes.forEach(drawShape);drawPlasmaTethers();drawBullets();
  remotePlayers.forEach(drawTank);drawTank(player);drawParticles();
  ctx.restore();
  drawMobileAimGuide();
  drawMinimap();
}
function frame(now){const dt=Math.min(.032,(now-last)/1000||0);last=now;if(running&&!paused)update(dt);render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
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
  ui.startScreen.classList.remove('show');
  document.querySelector('#garageScreen')?.classList.remove('show');
  ui.deathScreen.classList.remove('show');
  ui.startBtn.disabled=false;ui.startBtn.textContent=originalText;
  updateUI();
  broadcastLocalState(true);
}
ui.startBtn.onclick=()=>void startGame();ui.leaveBattleBtn.onclick=()=>void leaveBattleToLobby();ui.respawnBtn.onclick=()=>{ui.deathScreen.classList.remove('show');running=false;void disconnectOnlineArena();window.IronCellAuth?.showLobby?.();};
addEventListener('keydown',e=>{input.keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});addEventListener('keyup',e=>input.keys.delete(e.code));addEventListener('mousemove',e=>{input.mouseX=e.clientX;input.mouseY=e.clientY});addEventListener('mousedown',e=>{if(e.button===0)input.firing=true});addEventListener('mouseup',e=>{if(e.button===0)input.firing=false});addEventListener('blur',()=>{input.firing=false;input.mobileAimActive=false;input.keys.clear()});
const moveZone=document.querySelector('#mobileMove'),knob=moveZone.querySelector('.stick-knob');let moveTouch=null;function moveTouchUpdate(t){const r=moveZone.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const max=42,d=Math.hypot(dx,dy)||1;if(d>max){dx=dx/d*max;dy=dy/d*max}input.moveX=dx/max;input.moveY=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}moveZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];moveTouch=t.identifier;moveTouchUpdate(t);e.preventDefault()},{passive:false});moveZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===moveTouch)moveTouchUpdate(t);e.preventDefault()},{passive:false});function endMove(e){for(const t of e.changedTouches)if(t.identifier===moveTouch){moveTouch=null;input.moveX=0;input.moveY=0;knob.style.transform='none'}}moveZone.addEventListener('touchend',endMove,{passive:false});moveZone.addEventListener('touchcancel',endMove,{passive:false});
const aimZone=document.querySelector('#mobileAim');let aimTouch=null;function aimUpdate(t){input.mouseX=t.clientX;input.mouseY=t.clientY;input.firing=true;input.mobileAimActive=true}aimZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];aimTouch=t.identifier;aimUpdate(t);e.preventDefault()},{passive:false});aimZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===aimTouch)aimUpdate(t);e.preventDefault()},{passive:false});function endAim(e){for(const t of e.changedTouches)if(t.identifier===aimTouch){aimTouch=null;input.firing=false;input.mobileAimActive=false}}aimZone.addEventListener('touchend',endAim,{passive:false});aimZone.addEventListener('touchcancel',endAim,{passive:false});

window.IronCellGame = {
  stopForLogout(){
    running=false;
    paused=false;
    input.firing=false;
    input.keys.clear();
    ui.deathScreen.classList.remove('show');
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
});
player=defaultPlayer();populate();updateUI();
})();
