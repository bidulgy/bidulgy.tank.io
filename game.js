(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const ui={level:document.querySelector('#levelText'),score:document.querySelector('#scoreText'),xp:document.querySelector('#xpBar'),points:document.querySelector('#pointText'),upgrades:document.querySelector('#upgradeList'),upgradePanel:document.querySelector('#upgradePanel'),startScreen:document.querySelector('#startScreen'),deathScreen:document.querySelector('#deathScreen'),startBtn:document.querySelector('#startBtn'),respawnBtn:document.querySelector('#respawnBtn'),pauseBtn:document.querySelector('#pauseBtn'),nameInput:document.querySelector('#nameInput'),deathLevel:document.querySelector('#deathLevel'),deathScore:document.querySelector('#deathScore'),deathKills:document.querySelector('#deathKills'),deathGems:document.querySelector('#deathGems'),classPanel:document.querySelector('#classPanel'),classChoices:document.querySelector('#classChoices')};
const TAU=Math.PI*2,WORLD=4200,GRID=56;let running=false,paused=false,last=performance.now(),camera={x:0,y:0},shapes=[],bullets=[],bots=[],particles=[],shake=0,classUpgradeShown=false,player;
const input={keys:new Set(),mouseX:innerWidth/2,mouseY:innerHeight/2,firing:false,moveX:0,moveY:0};
const statsDef=[['maxHealth','최대 체력'],['regen','체력 회복'],['bulletDamage','탄환 피해'],['bulletSpeed','탄환 속도'],['reload','연사 속도'],['moveSpeed','이동 속도']];
function defaultPlayer(){return{x:WORLD/2,y:WORLD/2,vx:0,vy:0,r:27,angle:0,hp:120,maxHp:120,regenTimer:0,level:1,xp:0,xpNeed:42,score:0,kills:0,points:0,fireCd:0,name:'PLAYER',alive:true,classType:'basic',cannonType:'standard',stats:{maxHealth:0,regen:0,bulletDamage:0,bulletSpeed:0,reload:0,moveSpeed:0}}}
function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',resize);resize();
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy}function norm(dx,dy){const d=Math.hypot(dx,dy)||1;return[dx/d,dy/d]}
function colorForShape(t){return t==='square'?'#f7c843':t==='triangle'?'#e86464':'#6b8df2'}function edgeForShape(t){return t==='square'?'#b99320':t==='triangle'?'#a83f42':'#425cb2'}
function spawnShape(type=null){const t=type||(Math.random()<.57?'square':Math.random()<.78?'triangle':'pentagon');const c=t==='square'?{r:20,hp:36,xp:12,sides:4}:t==='triangle'?{r:24,hp:58,xp:22,sides:3}:{r:34,hp:145,xp:56,sides:5};shapes.push({type:t,x:rand(100,WORLD-100),y:rand(100,WORLD-100),r:c.r,hp:c.hp,maxHp:c.hp,xp:c.xp,sides:c.sides,angle:rand(0,TAU),spin:rand(-.35,.35),vx:0,vy:0})}
function botBuild(level){const scale=1+level*.045;return{x:rand(180,WORLD-180),y:rand(180,WORLD-180),vx:0,vy:0,r:26,angle:rand(0,TAU),hp:95*scale,maxHp:95*scale,level,fireCd:rand(.1,.9),name:'BOT-'+Math.floor(rand(10,99)),score:0,alive:true,targetTimer:0,target:null,classType:Math.random()<.2?'twin':'basic'}}
function populate(){shapes=[];bullets=[];bots=[];particles=[];for(let i=0;i<95;i++)spawnShape();for(let i=0;i<8;i++)bots.push(botBuild(Math.floor(rand(1,10))))}
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
  return{damage,bulletSpeed,reload:Math.max(.07,reload),move};
}
function fire(e){
  if(e.fireCd>0)return;
  const a=e.angle,isP=e===player,p=isP?playerParams():{damage:12+e.level*1.8,bulletSpeed:520,reload:.52};e.fireCd=p.reload;
  const cannon=isP?(e.cannonType||'standard'):'standard';
  let shots=[{angle:a,side:0,damageMul:1}];
  if(isP&&cannon==='spread')shots=[-.25,-.125,0,.125,.25].map(v=>({angle:a+v,side:0,damageMul:1}));
  else if(!isP&&e.classType==='twin')shots=[{angle:a,side:-7,damageMul:.72},{angle:a,side:7,damageMul:.72}];
  for(const shot of shots){
    const sa=shot.angle,px=-Math.sin(sa)*shot.side,py=Math.cos(sa)*shot.side;
    const b={x:e.x+Math.cos(sa)*(e.r+18)+px,y:e.y+Math.sin(sa)*(e.r+18)+py,vx:Math.cos(sa)*p.bulletSpeed+e.vx*.18,vy:Math.sin(sa)*p.bulletSpeed+e.vy*.18,r:6,damage:p.damage*shot.damageMul,life:1.65,owner:e,team:isP?'player':'bot',cannon,shape:'round',pierce:1,splashRadius:0,hitTargets:new Set()};
    if(isP&&cannon==='rapid'){b.r=4;b.life=1.35;b.shape='capsule'}
    if(isP&&cannon==='spread'){b.r=4;b.life=.95;b.shape='pellet'}
    if(isP&&cannon==='piercer'){b.r=5;b.life=1.75;b.shape='rail';b.pierce=4}
    if(isP&&cannon==='plasma'){b.r=11;b.life=1.65;b.shape='plasma';b.splashRadius=72}
    if(isP&&cannon==='rocket'){b.r=8;b.life=2.15;b.shape='rocket';b.splashRadius=112}
    if(isP&&cannon==='ring'){b.r=12;b.life=1.85;b.shape='ring';b.pierce=8}
    bullets.push(b);
  }
  e.vx-=Math.cos(a)*(cannon==='rocket'?22:12);e.vy-=Math.sin(a)*(cannon==='rocket'?22:12);
}
function burst(x,y,color,count=8){for(let i=0;i<count;i++){const a=rand(0,TAU),sp=rand(45,180);particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.28,.7),color,r:rand(2,5)})}}
function damageEntity(e,a,source){e.hp-=a;if(e.hp<=0&&e.alive!==false){e.alive=false;burst(e.x,e.y,source===player?'#78baff':'#ff8a8a',18);if(source===player){player.kills++;gainXp(e.level*18+34)}}}
function applySplashDamage(b,x,y){
  if(!b.splashRadius||b.team!=='player')return;
  const radius=b.splashRadius,r2=radius*radius,base=b.damage*(b.cannon==='rocket'?.72:.58);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i],dx=s.x-x,dy=s.y-y,d2=dx*dx+dy*dy;if(d2>r2)continue;
    const scale=1-Math.sqrt(d2)/radius;s.hp-=base*(.35+.65*scale);const[nx,ny]=norm(dx||1,dy||0);s.vx+=nx*110*scale;s.vy+=ny*110*scale;
    if(s.hp<=0){if(b.owner===player)gainXp(s.xp);burst(s.x,s.y,colorForShape(s.type),10);shapes.splice(i,1)}
  }
  for(const enemy of bots){if(!enemy.alive)continue;const dx=enemy.x-x,dy=enemy.y-y,d2=dx*dx+dy*dy;if(d2>r2)continue;const scale=1-Math.sqrt(d2)/radius;damageEntity(enemy,base*(.35+.65*scale),b.owner)}
  burst(x,y,b.cannon==='rocket'?'#ffb55f':'#69e6ff',b.cannon==='rocket'?22:14);shake=Math.max(shake,b.cannon==='rocket'?8:4);
}
function updatePlayer(dt){if(!player.alive)return;const p=playerParams();let mx=input.moveX,my=input.moveY;if(input.keys.has('KeyA')||input.keys.has('ArrowLeft'))mx-=1;if(input.keys.has('KeyD')||input.keys.has('ArrowRight'))mx+=1;if(input.keys.has('KeyW')||input.keys.has('ArrowUp'))my-=1;if(input.keys.has('KeyS')||input.keys.has('ArrowDown'))my+=1;if(mx||my){[mx,my]=norm(mx,my);player.vx+=mx*p.move*dt*5.2;player.vy+=my*p.move*dt*5.2}player.angle=Math.atan2(camera.y+input.mouseY-player.y,camera.x+input.mouseX-player.x);let sp=Math.hypot(player.vx,player.vy);if(sp>p.move){player.vx=player.vx/sp*p.move;player.vy=player.vy/sp*p.move}player.x=clamp(player.x+player.vx*dt,player.r,WORLD-player.r);player.y=clamp(player.y+player.vy*dt,player.r,WORLD-player.r);player.vx*=Math.pow(.0006,dt);player.vy*=Math.pow(.0006,dt);player.fireCd=Math.max(0,player.fireCd-dt);if(input.firing||input.keys.has('Space'))fire(player);if(player.hp<player.maxHp){player.regenTimer+=dt;if(player.regenTimer>3.8)player.hp=Math.min(player.maxHp,player.hp+(1.4+player.stats.regen*1.1)*dt)}else player.regenTimer=0}
function updateBots(dt){for(const b of bots){if(!b.alive)continue;b.fireCd=Math.max(0,b.fireCd-dt);b.targetTimer-=dt;if(b.targetTimer<=0){b.targetTimer=rand(.45,1.2);let best=null,bd=Infinity;for(const c of [player,...bots.filter(o=>o!==b&&o.alive),...shapes]){if(!c||c.alive===false)continue;const d=dist2(b,c);if(d<bd){bd=d;best=c}}b.target=best}const t=b.target;if(t){const dx=t.x-b.x,dy=t.y-b.y,d=Math.hypot(dx,dy)||1;b.angle=Math.atan2(dy,dx);const desired=d>430?1:d<210?-.55:.2;b.vx+=dx/d*150*desired*dt*3.5;b.vy+=dy/d*150*desired*dt*3.5;b.vx+=-dy/d*Math.sin(performance.now()*.001+b.x)*28*dt;b.vy+=dx/d*Math.sin(performance.now()*.001+b.y)*28*dt;if(d<720)fire(b)}let sp=Math.hypot(b.vx,b.vy),max=175;if(sp>max){b.vx=b.vx/sp*max;b.vy=b.vy/sp*max}b.x=clamp(b.x+b.vx*dt,b.r,WORLD-b.r);b.y=clamp(b.y+b.vy*dt,b.r,WORLD-b.r);b.vx*=Math.pow(.002,dt);b.vy*=Math.pow(.002,dt)}if(bots.filter(b=>b.alive).length<8&&Math.random()<dt*.6)bots.push(botBuild(Math.max(1,Math.floor(player.level*rand(.55,1.25)))));if(bots.length>20)bots=bots.filter(b=>b.alive).slice(-12)}
function updateShapes(dt){for(const s of shapes){s.angle+=s.spin*dt;s.x=clamp(s.x+s.vx*dt,s.r,WORLD-s.r);s.y=clamp(s.y+s.vy*dt,s.r,WORLD-s.r);s.vx*=Math.pow(.05,dt);s.vy*=Math.pow(.05,dt)}while(shapes.length<95)spawnShape()}
function killPlayer(){
  if(!player.alive)return;player.alive=false;
  ui.deathLevel.textContent=player.level;ui.deathScore.textContent=player.score.toLocaleString();ui.deathKills.textContent=player.kills;
  if(ui.deathGems)ui.deathGems.textContent=(player.score*10).toLocaleString();
  ui.deathScreen.classList.add('show');
  void window.IronCellAuth?.finishRun?.({pilotName:player.name,level:player.level,score:player.score,kills:player.kills});
}
function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.life<=0||b.x<0||b.y<0||b.x>WORLD||b.y>WORLD){bullets.splice(i,1);continue}
    let remove=false;
    for(let j=shapes.length-1;j>=0&&!remove;j--){
      const s=shapes[j];if(b.hitTargets?.has(s))continue;const rr=b.r+s.r;
      if((b.x-s.x)**2+(b.y-s.y)**2<rr*rr){
        b.hitTargets?.add(s);s.hp-=b.damage;const[nx,ny]=norm(b.vx,b.vy);s.vx+=nx*75;s.vy+=ny*75;burst(b.x,b.y,colorForShape(s.type),3);
        if(s.hp<=0){if(b.owner===player)gainXp(s.xp);shapes.splice(j,1);burst(s.x,s.y,colorForShape(s.type),10)}
        if(b.splashRadius){applySplashDamage(b,b.x,b.y);remove=true}else if((b.pierce||1)>1){b.pierce--;b.damage*=.88}else remove=true;
      }
    }
    if(!remove&&b.team==='bot'&&player.alive){
      const rr=b.r+player.r;if((b.x-player.x)**2+(b.y-player.y)**2<rr*rr){player.hp-=b.damage;player.regenTimer=0;burst(b.x,b.y,'#7bb9ff',4);shake=Math.max(shake,5);if(player.hp<=0)killPlayer();remove=true}
    }else if(!remove&&b.team==='player'){
      for(const e of bots){
        if(!e.alive||b.hitTargets?.has(e))continue;const rr=b.r+e.r;
        if((b.x-e.x)**2+(b.y-e.y)**2<rr*rr){
          b.hitTargets?.add(e);damageEntity(e,b.damage,player);burst(b.x,b.y,'#ff8a8a',4);
          if(b.splashRadius){applySplashDamage(b,b.x,b.y);remove=true}else if((b.pierce||1)>1){b.pierce--;b.damage*=.88}else remove=true;break;
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
  else{ctx.beginPath();ctx.roundRect(r*.22,-7,r+23,14,4);ctx.fill();ctx.stroke()}
}
function drawTank(e){
  if(!e.alive)return;const[x,y]=worldToScreen(e.x,e.y);if(x<-100||y<-100||x>innerWidth+100||y>innerHeight+100)return;
  const isP=e===player,body=isP?'#55a7ff':'#f06464',edge=isP?'#2b6fbe':'#a73f45',r=e.r;
  ctx.save();ctx.translate(x,y);ctx.rotate(e.angle);
  if(isP)drawPlayerCannon(e.cannonType||'standard',r);
  else for(const side of e.classType==='twin'?[-7,7]:[0]){ctx.fillStyle='#6f7f90';ctx.strokeStyle='#45515f';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(r*.22,side-7,r+23,14,4);ctx.fill();ctx.stroke()}
  ctx.shadowColor='rgba(0,0,0,.30)';ctx.shadowBlur=12;ctx.shadowOffsetY=5;ctx.fillStyle=body;ctx.strokeStyle=edge;ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,.11)';ctx.beginPath();ctx.arc(-r*.18,-r*.22,r*.36,0,TAU);ctx.fill();ctx.restore();
  if(e.hp<e.maxHp||!isP){const w=r*2;ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(x-w/2,y+r+10,w,5);ctx.fillStyle='#6be28a';ctx.fillRect(x-w/2,y+r+10,w*clamp(e.hp/e.maxHp,0,1),5)}
  ctx.fillStyle='rgba(255,255,255,.87)';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText(e.name,x,y-r-13);
}
function drawBullets(){
  for(const b of bullets){
    const[x,y]=worldToScreen(b.x,b.y),a=Math.atan2(b.vy,b.vx);ctx.save();ctx.translate(x,y);ctx.rotate(a);
    if(b.shape==='capsule'){ctx.fillStyle='#8ed0ff';ctx.strokeStyle='#467aa7';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-7,-3,14,6,3);ctx.fill();ctx.stroke()}
    else if(b.shape==='pellet'){ctx.fillStyle='#ffd777';ctx.strokeStyle='#b18432';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-4);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.stroke()}
    else if(b.shape==='rail'){ctx.fillStyle='#e6f3ff';ctx.strokeStyle='#6aa3d6';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-11,-3,22,6,2);ctx.fill();ctx.stroke();ctx.fillStyle='#75c9ff';ctx.fillRect(-7,-1,14,2)}
    else if(b.shape==='plasma'){ctx.shadowColor='#6be7ff';ctx.shadowBlur=14;const gr=ctx.createRadialGradient(-3,-3,1,0,0,12);gr.addColorStop(0,'#fff');gr.addColorStop(.28,'#8bf1ff');gr.addColorStop(1,'#3479d0');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.fill();ctx.shadowBlur=0}
    else if(b.shape==='rocket'){ctx.fillStyle='#d9e1e8';ctx.strokeStyle='#637180';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(3,-6);ctx.lineTo(-8,-5);ctx.lineTo(-8,5);ctx.lineTo(3,6);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ff9f43';ctx.beginPath();ctx.moveTo(-8,-3);ctx.lineTo(-15,0);ctx.lineTo(-8,3);ctx.closePath();ctx.fill()}
    else if(b.shape==='ring'){ctx.shadowColor='#a988ff';ctx.shadowBlur=10;ctx.strokeStyle='#c9b6ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.stroke()}
    else{ctx.fillStyle=b.team==='player'?'#78bdff':'#ff7b7b';ctx.strokeStyle=b.team==='player'?'#3c77b4':'#ad4549';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,b.r,0,TAU);ctx.fill();ctx.stroke()}
    ctx.restore();
  }
}
function drawParticles(){for(const p of particles){const[x,y]=worldToScreen(p.x,p.y);ctx.globalAlpha=clamp(p.life/.7,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,p.r,0,TAU);ctx.fill()}ctx.globalAlpha=1}
function drawBoundary(){const[x,y]=worldToScreen(0,0);ctx.strokeStyle='rgba(255,95,95,.35)';ctx.lineWidth=8;ctx.strokeRect(x,y,WORLD,WORLD)}
function drawMinimap(){const size=108,pad=15,x=innerWidth-size-pad,y=innerHeight-size-pad;ctx.fillStyle='rgba(5,12,22,.56)';ctx.fillRect(x,y,size,size);ctx.strokeStyle='rgba(255,255,255,.13)';ctx.strokeRect(x,y,size,size);ctx.fillStyle='#5baaff';ctx.beginPath();ctx.arc(x+player.x/WORLD*size,y+player.y/WORLD*size,3,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,110,110,.8)';for(const b of bots)if(b.alive)ctx.fillRect(x+b.x/WORLD*size-1,y+b.y/WORLD*size-1,2,2)}
function update(dt){updatePlayer(dt);updateBots(dt);updateShapes(dt);updateBullets(dt);updateParticles(dt);cameraUpdate()}
function render(){ctx.save();if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake));shake*=.86}drawGrid();drawBoundary();shapes.forEach(drawShape);drawBullets();bots.forEach(drawTank);drawTank(player);drawParticles();ctx.restore();drawMinimap()}
function frame(now){const dt=Math.min(.032,(now-last)/1000||0);last=now;if(running&&!paused)update(dt);render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
function startGame(){
  if(!window.IronCellAuth?.user){window.IronCellAuth?.logout?.();return}
  player=defaultPlayer();player.name=(ui.nameInput.value.trim()||window.IronCellAuth.username||'PLAYER').slice(0,14);
  player.cannonType=window.IronCellAuth.getCannon?.()?.id||'standard';void window.IronCellAuth.savePilotName(player.name);
  classUpgradeShown=false;populate();camera.x=player.x-innerWidth/2;camera.y=player.y-innerHeight/2;running=true;paused=false;
  ui.startScreen.classList.remove('show');document.querySelector('#garageScreen')?.classList.remove('show');ui.deathScreen.classList.remove('show');updateUI();
}
ui.startBtn.onclick=startGame;ui.respawnBtn.onclick=()=>{ui.deathScreen.classList.remove('show');running=false;window.IronCellAuth?.showGarage?.();};ui.pauseBtn.onclick=()=>{if(!running||!player.alive)return;paused=!paused;ui.pauseBtn.textContent=paused?'▶':'Ⅱ'};
addEventListener('keydown',e=>{input.keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});addEventListener('keyup',e=>input.keys.delete(e.code));addEventListener('mousemove',e=>{input.mouseX=e.clientX;input.mouseY=e.clientY});addEventListener('mousedown',e=>{if(e.button===0)input.firing=true});addEventListener('mouseup',e=>{if(e.button===0)input.firing=false});addEventListener('blur',()=>{input.firing=false;input.keys.clear()});
const moveZone=document.querySelector('#mobileMove'),knob=moveZone.querySelector('.stick-knob');let moveTouch=null;function moveTouchUpdate(t){const r=moveZone.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=t.clientX-cx,dy=t.clientY-cy;const max=42,d=Math.hypot(dx,dy)||1;if(d>max){dx=dx/d*max;dy=dy/d*max}input.moveX=dx/max;input.moveY=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}moveZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];moveTouch=t.identifier;moveTouchUpdate(t);e.preventDefault()},{passive:false});moveZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===moveTouch)moveTouchUpdate(t);e.preventDefault()},{passive:false});function endMove(e){for(const t of e.changedTouches)if(t.identifier===moveTouch){moveTouch=null;input.moveX=0;input.moveY=0;knob.style.transform='none'}}moveZone.addEventListener('touchend',endMove,{passive:false});moveZone.addEventListener('touchcancel',endMove,{passive:false});
const aimZone=document.querySelector('#mobileAim');let aimTouch=null;function aimUpdate(t){input.mouseX=t.clientX;input.mouseY=t.clientY;input.firing=true}aimZone.addEventListener('touchstart',e=>{const t=e.changedTouches[0];aimTouch=t.identifier;aimUpdate(t);e.preventDefault()},{passive:false});aimZone.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===aimTouch)aimUpdate(t);e.preventDefault()},{passive:false});function endAim(e){for(const t of e.changedTouches)if(t.identifier===aimTouch){aimTouch=null;input.firing=false}}aimZone.addEventListener('touchend',endAim,{passive:false});aimZone.addEventListener('touchcancel',endAim,{passive:false});

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
  }
};

player=defaultPlayer();populate();updateUI();
})();
