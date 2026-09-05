(() => {
'use strict';

const SUPABASE_URL = 'https://gomwkcqkslaoypdbebid.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iuGd7i15GSv3nszxJhQt0Q_OkNbGbm7';

const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const els = {
  authScreen: document.querySelector('#authScreen'),
  startScreen: document.querySelector('#startScreen'),
  garageScreen: document.querySelector('#garageScreen'),
  username: document.querySelector('#usernameInput'),
  password: document.querySelector('#passwordInput'),
  login: document.querySelector('#loginBtn'),
  signup: document.querySelector('#signupBtn'),
  logout: document.querySelector('#logoutBtn'),
  message: document.querySelector('#authMessage'),
  accountUsername: document.querySelector('#accountUsername'),
  bestLevel: document.querySelector('#bestLevelText'),
  bestScore: document.querySelector('#bestScoreText'),
  bestKills: document.querySelector('#bestKillsText'),
  gemText: document.querySelector('#gemText'),
  equippedCannonName: document.querySelector('#equippedCannonName'),
  equippedCannonRarity: document.querySelector('#equippedCannonRarity'),
  equippedCannonDesc: document.querySelector('#equippedCannonDesc'),
  deployCannonName: document.querySelector('#deployCannonName'),
  deployCannonDesc: document.querySelector('#deployCannonDesc'),
  miniCannon: document.querySelector('#miniCannon'),
  collection: document.querySelector('#cannonCollection'),
  cannonCount: document.querySelector('#cannonCountText'),
  pullCannon: document.querySelector('#pullCannonBtn'),
  gachaMessage: document.querySelector('#gachaMessage'),
  garageBattle: document.querySelector('#garageBattleBtn'),
  backGarage: document.querySelector('#backGarageBtn'),
  pilotName: document.querySelector('#nameInput')
};

const CANNONS=Object.freeze({
  standard:{id:'standard',name:'기본포',rarity:'starter',rarityLabel:'STARTER',desc:'균형 잡힌 기본 단발포입니다.'},
  rapid:{id:'rapid',name:'기관포',rarity:'common',rarityLabel:'COMMON',desc:'작은 탄환을 매우 빠르게 연속 발사합니다.'},
  spread:{id:'spread',name:'산탄포',rarity:'common',rarityLabel:'COMMON',desc:'한 번에 5개의 산탄을 넓게 퍼뜨립니다.'},
  piercer:{id:'piercer',name:'관통포',rarity:'rare',rarityLabel:'RARE',desc:'길쭉한 철갑탄이 여러 적을 연속 관통합니다.'},
  plasma:{id:'plasma',name:'플라즈마포',rarity:'rare',rarityLabel:'RARE',desc:'큰 에너지 구체가 명중 지점에 범위 피해를 줍니다.'},
  rocket:{id:'rocket',name:'로켓포',rarity:'epic',rarityLabel:'EPIC',desc:'느리지만 강력한 로켓이 넓은 폭발 피해를 줍니다.'},
  ring:{id:'ring',name:'링 캐논',rarity:'legendary',rarityLabel:'LEGENDARY',desc:'에너지 링이 적들을 연속으로 꿰뚫으며 공격합니다.'}
});
window.IronCellCannons=CANNONS;

let currentUser = null;
let currentUsername = '';
let profile = null;
let authBusy = false;

function normalizeUsername(value){
  return String(value || '').trim().toLowerCase();
}
function usernameToInternalEmail(username){
  return `${username}@players.example.com`;
}
function usernameFromUser(user){
  const meta = normalizeUsername(user?.user_metadata?.username);
  if(meta) return meta;
  return normalizeUsername(String(user?.email || '').split('@')[0]);
}
function setMessage(text='', type=''){
  if(!els.message) return;
  els.message.textContent = text;
  els.message.className = `auth-message ${type}`.trim();
}
function setBusy(busy){
  authBusy = !!busy;
  if(els.login) els.login.disabled = authBusy;
  if(els.signup) els.signup.disabled = authBusy;
}
function validUsername(username){
  return /^[a-z0-9_]{3,20}$/.test(username);
}
function escapePilotName(value){
  const trimmed = String(value || '').trim();
  return (trimmed || currentUsername || 'PLAYER').slice(0,14);
}

async function ensureProfile(){
  if(!currentUser) return null;

  const {data, error} = await client
    .from('iron_cell_profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if(error){
    console.error('Iron Cell profile load failed:', error);
    throw error;
  }

  if(data){
    profile = data;
    return profile;
  }

  const initial = {
    user_id: currentUser.id,
    pilot_name: (currentUsername || 'PLAYER').slice(0,14),
    best_level: 1,
    best_score: 0,
    best_kills: 0,
    total_runs: 0,
    total_kills: 0
  };

  const {data:created, error:createError} = await client
    .from('iron_cell_profiles')
    .insert(initial)
    .select('*')
    .single();

  if(createError){
    // Another device can create the row at almost the same time.
    const {data:retry, error:retryError} = await client
      .from('iron_cell_profiles')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();
    if(retryError) throw createError;
    profile = retry;
    return profile;
  }

  profile = created;
  return profile;
}

function ownedCannons(){
  const raw=profile?.owned_cannons;
  if(Array.isArray(raw))return raw;
  if(typeof raw==='string'){try{const p=JSON.parse(raw);if(Array.isArray(p))return p}catch(_){}}
  return ['standard'];
}
function currentCannon(){const id=String(profile?.equipped_cannon||'standard');return CANNONS[id]||CANNONS.standard}
function setGachaMessage(text='',type=''){if(!els.gachaMessage)return;els.gachaMessage.textContent=text;els.gachaMessage.className=`gacha-message ${type}`.trim()}
function renderCannonGarage(){
  if(!profile)return;
  const owned=new Set(ownedCannons());owned.add('standard');const equipped=currentCannon();
  if(els.equippedCannonName)els.equippedCannonName.textContent=equipped.name;
  if(els.equippedCannonDesc)els.equippedCannonDesc.textContent=equipped.desc;
  if(els.deployCannonName)els.deployCannonName.textContent=equipped.name;
  if(els.deployCannonDesc)els.deployCannonDesc.textContent=equipped.desc;
  if(els.equippedCannonRarity){els.equippedCannonRarity.textContent=equipped.rarityLabel;els.equippedCannonRarity.className=`rarity ${equipped.rarity}`}
  if(els.miniCannon)els.miniCannon.className=`mini-cannon cannon-${equipped.id}`;
  if(els.cannonCount)els.cannonCount.textContent=`${owned.size} / ${Object.keys(CANNONS).length}`;
  if(els.pullCannon){els.pullCannon.disabled=Number(profile.gems||0)<100;els.pullCannon.textContent=Number(profile.gems||0)>=100?'대포 뽑기':'보석 부족'}
  if(els.collection){
    els.collection.innerHTML=Object.values(CANNONS).map(c=>{const own=owned.has(c.id),eq=equipped.id===c.id;return `<button type="button" class="cannon-card ${own?'':'locked'} ${eq?'equipped':''}" data-cannon="${c.id}" ${own?'':'disabled'}><div class="cannon-card-head"><strong>${c.name}</strong><span class="rarity ${c.rarity}">${c.rarityLabel}</span></div><p>${own?c.desc:'아직 획득하지 않은 대포입니다.'}</p><div class="equip-label">${eq?'장착 중':own?'눌러서 장착':'미보유'}</div></button>`}).join('');
    els.collection.querySelectorAll('.cannon-card:not(.locked)').forEach(b=>b.addEventListener('click',()=>void equipCannon(b.dataset.cannon)));
  }
}
function renderProfile(){
  if(!profile||!currentUser)return;
  if(els.accountUsername)els.accountUsername.textContent=currentUsername||'PLAYER';
  if(els.bestLevel)els.bestLevel.textContent=Number(profile.best_level||1).toLocaleString();
  if(els.bestScore)els.bestScore.textContent=Number(profile.best_score||0).toLocaleString();
  if(els.bestKills)els.bestKills.textContent=Number(profile.best_kills||0).toLocaleString();
  if(els.gemText)els.gemText.textContent=Number(profile.gems||0).toLocaleString();
  if(els.pilotName&&!els.pilotName.dataset.userEdited)els.pilotName.value=escapePilotName(profile.pilot_name||currentUsername);
  renderCannonGarage();
}

function hideGameMenus(){els.startScreen?.classList.remove('show');els.garageScreen?.classList.remove('show')}
function showAuth(){hideGameMenus();els.authScreen?.classList.add('show')}
function showGarage(){els.authScreen?.classList.remove('show');els.startScreen?.classList.remove('show');els.garageScreen?.classList.add('show');renderProfile()}
function showDeploy(){els.garageScreen?.classList.remove('show');els.authScreen?.classList.remove('show');els.startScreen?.classList.add('show');renderProfile()}
function showMenu(){showGarage()}

async function pullCannon(){
  if(authBusy||!currentUser)return;
  if(Number(profile?.gems||0)<100){setGachaMessage('보석이 100개 필요합니다.','error');return}
  setBusy(true);setGachaMessage('대포 캡슐을 개봉하는 중...');
  try{
    const {data,error}=await client.rpc('iron_cell_pull_cannon_v1');if(error)throw error;
    const cannon=CANNONS[data?.cannon]||CANNONS.standard;
    profile.gems=Number(data?.gems||0);profile.owned_cannons=data?.owned_cannons||profile.owned_cannons;renderProfile();
    setGachaMessage(`${data?.is_new?'새 대포 획득!':'중복 대포!'} ${cannon.name}`,cannon.rarity==='legendary'?'legendary':'good');
  }catch(error){console.error(error);setGachaMessage(String(error?.message||'').includes('not_enough_gems')?'보석이 부족합니다.':'뽑기에 실패했습니다.','error')}
  finally{setBusy(false);renderProfile()}
}
async function equipCannon(cannonId){
  if(authBusy||!currentUser)return;const cannon=CANNONS[cannonId];if(!cannon)return;
  try{const {data,error}=await client.rpc('iron_cell_equip_cannon_v1',{p_cannon:cannonId});if(error)throw error;profile=data||profile;renderProfile();setGachaMessage(`${cannon.name} 장착 완료`,'good')}
  catch(error){console.error(error);setGachaMessage('대포 장착에 실패했습니다.','error')}
}

async function enterSession(user){
  currentUser = user;
  currentUsername = usernameFromUser(user);
  setMessage('계정 데이터를 불러오는 중...', 'busy');
  await ensureProfile();
  renderProfile();
  setMessage('');
  showMenu();
}

async function signup(){
  if(authBusy) return;
  const username = normalizeUsername(els.username?.value);
  const password = String(els.password?.value || '');

  if(!validUsername(username)){
    setMessage('아이디는 영문 소문자, 숫자, 밑줄로 3~20자 입력하세요.', 'error');
    return;
  }
  if(password.length < 6){
    setMessage('비밀번호는 6자 이상이어야 합니다.', 'error');
    return;
  }

  setBusy(true);
  setMessage('계정을 만드는 중...', 'busy');

  try{
    const {data, error} = await client.auth.signUp({
      email: usernameToInternalEmail(username),
      password,
      options: { data: { username } }
    });

    if(error){
      const msg = String(error.message || '').toLowerCase();
      if(msg.includes('already') || msg.includes('registered')){
        setMessage('이미 사용 중인 아이디입니다.', 'error');
      }else{
        setMessage(`회원가입 실패: ${error.message}`, 'error');
      }
      return;
    }

    if(!data?.session || !data?.user){
      setMessage('가입은 되었지만 자동 로그인이 되지 않았습니다. Supabase 이메일 확인 설정을 확인하세요.', 'error');
      return;
    }

    await enterSession(data.user);
  }catch(error){
    console.error(error);
    setMessage('회원가입 중 오류가 발생했습니다.', 'error');
  }finally{
    setBusy(false);
  }
}

async function login(){
  if(authBusy) return;
  const username = normalizeUsername(els.username?.value);
  const password = String(els.password?.value || '');

  if(!username || !password){
    setMessage('아이디와 비밀번호를 입력하세요.', 'error');
    return;
  }
  if(!validUsername(username)){
    setMessage('아이디 형식을 확인하세요.', 'error');
    return;
  }

  setBusy(true);
  setMessage('로그인 중...', 'busy');

  try{
    const {data, error} = await client.auth.signInWithPassword({
      email: usernameToInternalEmail(username),
      password
    });

    if(error || !data?.user){
      setMessage('아이디 또는 비밀번호를 확인하세요.', 'error');
      return;
    }

    await enterSession(data.user);
  }catch(error){
    console.error(error);
    setMessage('로그인 중 오류가 발생했습니다.', 'error');
  }finally{
    setBusy(false);
  }
}

async function logout(){
  if(authBusy) return;
  setBusy(true);
  try{
    window.IronCellGame?.stopForLogout?.();
    await client.auth.signOut();
    currentUser = null;
    currentUsername = '';
    profile = null;
    if(els.password) els.password.value = '';
    if(els.pilotName) delete els.pilotName.dataset.userEdited;
    showAuth();
    setMessage('로그아웃되었습니다.', 'good');
  }finally{
    setBusy(false);
  }
}

async function savePilotName(name){
  if(!currentUser) return;
  const pilotName = escapePilotName(name);
  if(profile) profile.pilot_name = pilotName;

  const {error} = await client
    .from('iron_cell_profiles')
    .update({
      pilot_name: pilotName,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', currentUser.id);

  if(error) console.warn('Pilot name save failed:', error);
}

async function finishRun(run){
  if(!currentUser || !run) return profile;

  const pilotName = escapePilotName(run.pilotName || els.pilotName?.value);

  const {data, error} = await client.rpc('iron_cell_finish_run_v1', {
    p_pilot_name: pilotName,
    p_level: Math.max(1, Math.floor(Number(run.level || 1))),
    p_score: Math.max(0, Math.floor(Number(run.score || 0))),
    p_kills: Math.max(0, Math.floor(Number(run.kills || 0)))
  });

  if(error){
    console.error('Run save failed:', error);
    return profile;
  }

  profile = Array.isArray(data) ? (data[0] || profile) : (data || profile);
  renderProfile();
  return profile;
}

async function refreshProfile(){
  if(!currentUser) return null;
  await ensureProfile();
  renderProfile();
  return profile;
}

async function boot(){
  showAuth();
  setMessage('저장된 로그인을 확인하는 중...', 'busy');

  try{
    const {data, error} = await client.auth.getSession();
    if(error) console.warn(error);

    if(data?.session?.user){
      await enterSession(data.session.user);
    }else{
      setMessage('');
      showAuth();
    }
  }catch(error){
    console.error(error);
    setMessage('자동 로그인 확인에 실패했습니다. 직접 로그인해 주세요.', 'error');
    showAuth();
  }
}

els.login?.addEventListener('click', login);
els.signup?.addEventListener('click', signup);
els.logout?.addEventListener('click', logout);
els.pullCannon?.addEventListener('click',()=>void pullCannon());
els.garageBattle?.addEventListener('click',showDeploy);
els.backGarage?.addEventListener('click',showGarage);

els.password?.addEventListener('keydown', event => {
  if(event.key === 'Enter') login();
});
els.username?.addEventListener('keydown', event => {
  if(event.key === 'Enter') els.password?.focus();
});
els.pilotName?.addEventListener('input', () => {
  els.pilotName.dataset.userEdited = '1';
});
els.pilotName?.addEventListener('change', () => {
  void savePilotName(els.pilotName.value);
});

window.addEventListener('focus', () => {
  if(currentUser) void refreshProfile();
});

window.IronCellAuth = {
  client,
  get user(){ return currentUser; },
  get username(){ return currentUsername; },
  get profile(){ return profile; },
  login,
  signup,
  logout,
  finishRun,
  savePilotName,
  refreshProfile,
  showGarage,
  showDeploy,
  pullCannon,
  equipCannon,
  getCannon(){return currentCannon();}
};

void boot();
})();
