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
      detectSessionInUrl: false,
      storageKey: 'iron-cell-arena-auth-v2'
    }
  }
);

const els = {
  authScreen: document.querySelector('#authScreen'),
  startScreen: document.querySelector('#startScreen'),
  lobbyScreen: document.querySelector('#lobbyScreen'),
  garageScreen: document.querySelector('#garageScreen'),
  username: document.querySelector('#usernameInput'),
  password: document.querySelector('#passwordInput'),
  login: document.querySelector('#loginBtn'),
  signup: document.querySelector('#signupBtn'),
  logout: document.querySelector('#lobbyLogoutBtn'),
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
  multiPullButtons: Array.from(document.querySelectorAll('[data-pull-count]')),
  gachaMessage: document.querySelector('#gachaMessage'),
  garageLobby: document.querySelector('#garageLobbyBtn'),
  garageBackLobby: document.querySelector('#garageBackLobbyBtn'),
  lobbyBattle: document.querySelector('#lobbyBattleBtn'),
  lobbyArsenal: document.querySelector('#lobbyArsenalBtn'),
  backLobby: document.querySelector('#backLobbyBtn'),
  lobbyUsername: document.querySelector('#lobbyUsername'),
  lobbyGemText: document.querySelector('#lobbyGemText'),
  lobbyCannonName: document.querySelector('#lobbyCannonName'),
  lobbyCannonRarity: document.querySelector('#lobbyCannonRarity'),
  lobbyCannonDesc: document.querySelector('#lobbyCannonDesc'),
  lobbyMiniCannon: document.querySelector('#lobbyMiniCannon'),
  lobbyBestLevel: document.querySelector('#lobbyBestLevel'),
  lobbyBestScore: document.querySelector('#lobbyBestScore'),
  lobbyBestKills: document.querySelector('#lobbyBestKills'),
  pilotName: document.querySelector('#nameInput'),
  lobbyAdmin: document.querySelector('#lobbyAdminBtn'),
  adminScreen: document.querySelector('#adminScreen'),
  adminBack: document.querySelector('#adminBackBtn'),
  adminMessage: document.querySelector('#adminMessage'),
  adminUsername: document.querySelector('#adminUsernameInput'),
  adminSearch: document.querySelector('#adminSearchBtn'),
  adminSearchResults: document.querySelector('#adminSearchResults'),
  adminAccountCount: document.querySelector('#adminAccountCount'),
  adminTarget: document.querySelector('#adminTargetCard'),
  adminGemAmount: document.querySelector('#adminGemAmount'),
  adminCannonGrid: document.querySelector('#adminCannonGrid'),
  adminRecentUsers: document.querySelector('#adminRecentUsers'),
  adminRefresh: document.querySelector('#adminRefreshBtn')
};

const CANNONS=Object.freeze({
  // 기본 등급 — 모든 계정 무료
  standard:{
    id:'standard',name:'기본포',rarity:'starter',rarityLabel:'기본',chance:0,
    desc:'균형 잡힌 기본 단발포입니다.',
    passive:'평타 · 정밀 코어: 5번째 탄이 1.7배 피해 + 2회 관통',
    skill:'Q 궤도 포격 · 조준 지점에 1.25초 후 대형 포격 낙하'
  },
  scout:{
    id:'scout',name:'스카우트',rarity:'starter',rarityLabel:'기본',chance:0,
    desc:'가볍고 빠른 기동형 탱크입니다.',
    passive:'평타 · 더블 탭: 4번째 사격마다 2발을 빠르게 발사',
    skill:'Q 그래플 훅 · 650거리 케이블을 꽂고 경로를 베며 목표 지점으로 끌려감'
  },
  bastion:{
    id:'bastion',name:'바스티온',rarity:'starter',rarityLabel:'기본',chance:0,
    desc:'느리지만 강한 중장갑 포격형 탱크입니다.',
    passive:'평타 · 철갑 코어: 6번째 탄이 2.2배 피해 + 3회 관통',
    skill:'Q 방벽 전개 · 5초간 적 탄환을 막는 에너지 벽'
  },

  // 일반 61.5% / 3캐릭터
  rapid:{
    id:'rapid',name:'기관포',rarity:'common',rarityLabel:'일반',chance:20.5,
    desc:'작은 탄환을 매우 빠르게 연속 발사합니다.',
    passive:'평타 · 가속 탄띠: 8번째 사격마다 3발 동시 가속탄',
    skill:'Q 오버드라이브 · 2.8초간 자동 초고속 난사'
  },
  dual:{
    id:'dual',name:'듀얼 캐논',rarity:'common',rarityLabel:'일반',chance:20.5,
    desc:'양쪽 포신에서 두 발을 동시에 발사합니다.',
    passive:'평타 · 트윈 링크: 기본 2발, 7번째 사격은 4발',
    skill:'Q 트윈 드론 · 6초간 회전 드론 2기가 자동 사격'
  },
  needle:{
    id:'needle',name:'니들러',rarity:'common',rarityLabel:'일반',chance:20.5,
    desc:'작고 매우 빠른 침형 탄환을 사용합니다.',
    passive:'평타 · 니들 코어: 6번째 탄이 강화되어 4회 관통',
    skill:'Q 하푼 스파이크 · 820거리 초장침으로 적을 꿰고 자신 쪽으로 강하게 끌어당김'
  },

  // 희귀 25.63% / 3캐릭터
  spread:{
    id:'spread',name:'산탄포',rarity:'rare',rarityLabel:'희귀',chance:8.543333,
    desc:'한 번에 5개의 산탄을 넓게 퍼뜨립니다.',
    passive:'평타 · 파편 확산: 명중 시 좌우 2차 파편 생성',
    skill:'Q 충격 산탄 · 전방 대형 산탄 폭풍 + 적을 밀고 자신도 강하게 뒤로 반동'
  },
  burst:{
    id:'burst',name:'버스트 캐논',rarity:'rare',rarityLabel:'희귀',chance:8.543333,
    desc:'좁은 범위에 3연발 탄막을 집중합니다.',
    passive:'평타 · 버스트 3연사: 매 사격 3발, 5번째는 5발',
    skill:'Q 리바운드 코어 · 목표 지점에 시한 코어를 던져 폭발 후 원반탄 16발 방사'
  },
  crystal:{
    id:'crystal',name:'크리스탈 샷',rarity:'rare',rarityLabel:'희귀',chance:8.543334,
    desc:'결정 파편처럼 넓게 갈라지는 탄환을 사용합니다.',
    passive:'평타 · 결정 분산: 4번째 사격마다 7갈래 파편',
    skill:'Q 프리즘 게이트 · 7초간 게이트를 통과한 내 크리스탈탄을 3갈래로 굴절·복제'
  },

  // 에픽 10.255% / 3캐릭터
  piercer:{
    id:'piercer',name:'관통포',rarity:'epic',rarityLabel:'에픽',chance:3.418333,
    desc:'길쭉한 철갑탄이 여러 적을 연속 관통합니다.',
    passive:'평타 · 관통 가속: 관통할수록 공격력 8%·탄속 4% 증가',
    skill:'Q 레일 스나이프 · 화면을 가르는 즉발 초장거리 관통선'
  },
  laser:{
    id:'laser',name:'레이저 랜서',rarity:'epic',rarityLabel:'에픽',chance:3.418333,
    desc:'초고속 레일 레이저로 일직선을 압박합니다.',
    passive:'평타 · 삼중 증폭: 3번째 레일탄이 1.75배 강화',
    skill:'Q 레이저 스윕 · 2초 동안 전방을 훑는 회전 레이저'
  },
  drill:{
    id:'drill',name:'드릴 캐논',rarity:'epic',rarityLabel:'에픽',chance:3.418334,
    desc:'느리지만 강력한 드릴탄이 적을 깊게 관통합니다.',
    passive:'평타 · 회전 드릴: 기본 8회 관통, 4번째 탄은 초대형 드릴',
    skill:'Q 터널 브레이커 · 오래 남아 모든 것을 관통하는 거대 드릴'
  },

  // 전설 2% / 3캐릭터
  plasma:{
    id:'plasma',name:'플라즈마포',rarity:'legendary',rarityLabel:'전설',chance:.666667,
    desc:'플라즈마 구체와 전기 연결선으로 공격합니다.',
    passive:'평타 · 연쇄 방전: 명중 시 주변 최대 2명에게 45% 번개 피해',
    skill:'Q 플라즈마 케이지 · 전기 육각 감옥의 테두리가 지속 감전'
  },
  thunder:{
    id:'thunder',name:'썬더 코어',rarity:'legendary',rarityLabel:'전설',chance:.666667,
    desc:'강한 전류가 담긴 플라즈마 코어를 발사합니다.',
    passive:'평타 · 삼중 번개: 4번째 사격마다 플라즈마 3발 + 최대 3연쇄',
    skill:'Q 뇌운 폭격 · 목표 영역에 5초간 뇌운 생성, 계속 위치를 바꾸며 번개 낙하'
  },
  inferno:{
    id:'inferno',name:'인페르노',rarity:'legendary',rarityLabel:'전설',chance:.666666,
    desc:'고열 화염탄이 폭발하고 불길을 남깁니다.',
    passive:'평타 · 화염 포화: 5번째 사격마다 소이탄 3발',
    skill:'Q 화염 장벽 · 5초간 긴 불의 벽 생성'
  },

  // 신화 .5% / 3캐릭터
  rocket:{
    id:'rocket',name:'로켓포',rarity:'mythic',rarityLabel:'신화',chance:.166667,
    desc:'중장갑 로켓이 넓은 폭발 피해를 줍니다.',
    passive:'평타 · 소이 폭발: 폭발 지점에 2.4초 화염 지대',
    skill:'Q 미사일 레인 · 넓은 목표 지역에 5초간 경고표시 후 미사일이 연속 낙하',
    skill2:'R IRON DOME · 6초 중장갑 돔 + 피해 70% 감소 + 체력 12% 회복'
  },
  titan:{
    id:'titan',name:'타이탄',rarity:'mythic',rarityLabel:'신화',chance:.166667,
    desc:'거대한 중포와 높은 방어력을 가진 중전차입니다.',
    passive:'평타 · 중포 코어: 대형 폭발탄, 4번째는 쌍포격',
    skill:'Q 대지 절단 · 전방 760거리를 따라 6개의 지면 균열이 순차 폭발',
    skill2:'R 공성 변환 · 8초 포대 변신, 공격력/연사 강화 + 자동 중포 사격'
  },
  phantom:{
    id:'phantom',name:'팬텀',rarity:'mythic',rarityLabel:'신화',chance:.166666,
    desc:'순간 이동과 고속 레일탄을 사용하는 암살형 탱크입니다.',
    passive:'평타 · 팬텀 레일: 5번째 사격마다 3발 레일탄',
    skill:'Q 암살 표식 · 조준 지점으로 순간이동하고 출발/도착 위치에 5초 표식 생성 · 5초 안에 Q 재사용 시 출발 표식으로 귀환하며 두 표식 동시 폭발',
    skill2:'R SPECTER CLOAK · 5초 은신 · 다른 플레이어 화면과 미니맵에서 사라짐 · 무적 효과 없음'
  },

  // 시크릿 .1% / 3캐릭터
  ring:{
    id:'ring',name:'링 캐논',rarity:'secret',rarityLabel:'시크릿',chance:.033334,
    desc:'차원 에너지 링이 적들을 연속 관통합니다.',
    passive:'평타 · 회귀 링: 멀리 날아간 링이 사용자에게 되돌아옴',
    skill:'Q 게이트 리피터 · 6초간 포탈 생성, 내가 쏜 링 평타를 포탈에서도 한 번 더 복제',
    skill2:'R RING PARRY · 5.8초 회전 방어링, 적 탄환을 반격 링으로 되돌림'
  },
  chrono:{
    id:'chrono',name:'크로노',rarity:'secret',rarityLabel:'시크릿',chance:.033333,
    desc:'시간 링을 겹쳐 쏘며 빠르게 위치를 바꿉니다.',
    passive:'평타 · 타임 듀오: 3번째 사격마다 회귀 링 2발',
    skill:'Q 시간 정지 · 영역 안 적/탄환을 4.5초간 극도로 감속',
    skill2:'R REWIND 4s · 약 4초 전 위치/체력/속도로 되감기 + 시간 잔상'
  },
  void:{
    id:'void',name:'보이드',rarity:'secret',rarityLabel:'시크릿',chance:.033333,
    desc:'공간을 압축하는 보이드 탄환과 중력장을 사용합니다.',
    passive:'평타 · 보이드 펄스: 4번째 사격마다 3개의 폭발성 보이드탄',
    skill:'Q 보이드 싱크 · 지속 중력장으로 적을 중심에 끌어당김',
    skill2:'R ANTI-MATTER · 6.6초 자신 주변 반중력장, 적/도형/탄환을 바깥으로 밀어냄'
  },

  // 갤럭시 .01% / 3캐릭터
  nova:{
    id:'nova',name:'노바 캐논',rarity:'galaxy',rarityLabel:'갤럭시',chance:.003334,
    desc:'별 모양 노바탄이 관통과 폭발을 동시에 일으킵니다.',
    passive:'평타 · 성운 분열: 첫 명중 시 작은 별 파편 4개 생성',
    skill:'Q 초신성 핵 · 2.3초 충전 뒤 초대형 폭발',
    skill2:'R ORBITAL FIVE · 7초간 공격 위성 5기가 플레이어 주위를 공전'
  },
  comet:{
    id:'comet',name:'코멧',rarity:'galaxy',rarityLabel:'갤럭시',chance:.003333,
    desc:'고속 혜성탄으로 전장을 가로지르는 기동형 탱크입니다.',
    passive:'평타 · 혜성 꼬리: 5번째 사격마다 노바탄 3발',
    skill:'Q 혜성 돌파 · 장거리 돌진하며 피해 궤적을 남김',
    skill2:'R METEOR SHOWER · 이동하지 않고 지정 지역에 6.2초간 혜성 연속 낙하'
  },
  stellar:{
    id:'stellar',name:'스텔라',rarity:'galaxy',rarityLabel:'갤럭시',chance:.003333,
    desc:'별빛을 폭발시키는 광역 제압형 탱크입니다.',
    passive:'평타 · 쌍성: 기본 2발, 6번째 사격은 5발 성탄',
    skill:'Q 별자리 결계 · 8초 대형 삼각 결계 · 즉시 15% 회복 + 내부 지속 회복 강화 + 적 지속 피해 강화',
    skill2:'R SECOND STAR · 12초 동안 죽음 1회 예약 · 시전 즉시 30% 회복 · 사망 시 체력 75% 부활 + 4초 무적 + 부활 충격파'
  },

  // ERROR .005% / 3캐릭터
  error:{
    id:'error',name:'ERROR 캐논',rarity:'error',rarityLabel:'ERROR',chance:.001667,
    desc:'불안정한 글리치 에너지와 ERROR 검을 사용하는 최고 등급 탱크입니다.',
    passive:'평타 · T 검 모드에서는 검만 휘두름 · R 버프 중에만 평타마다 ERROR 검기 추가',
    skill:'Q 이중 스킬 · 검 모드 OFF: SYSTEM CRASH 24발 · 검 모드 ON: 최대 5초 차징 ERROR 검기',
    skill2:'R GLITCH DRIVE · 15초 이동속도 증가 + 검 평타마다 검기 + 강화 중 R로 3초마다 도약',
    skill3:'T GLITCH BLADE · 7초 쿨 · 돌진하며 ERROR 검을 휘두르고 검 모드 ON/OFF'
  },
  glitch:{
    id:'glitch',name:'GLITCH-13',rarity:'error',rarityLabel:'ERROR',chance:.001667,
    desc:'분열되는 글리치탄으로 화면을 뒤덮는 ERROR 개체입니다.',
    passive:'평타 · 패킷 분열: 기본 2발, 6번째 사격은 7발 글리치탄',
    skill:'Q MIRROR ERROR · 6개 분신 위치에서 동시에 패킷탄 발사',
    skill2:'R DATA WARP · 900거리 순간 전송 + 이동 경로에 6개의 지연 글리치 폭발'
  },
  zero:{
    id:'zero',name:'ZERO',rarity:'error',rarityLabel:'ERROR',chance:.001666,
    desc:'극단적인 단발 화력과 공간 삭제 능력을 가진 ERROR 개체입니다.',
    passive:'평타 · ZERO CORE: 강한 관통탄, 4번째 사격은 3중 NULL 탄',
    skill:'Q ZERO LINE · 초장거리 즉발 삭제 광선 + 적 탄환 제거',
    skill2:'R ABSOLUTE ZERO · 4초간 대영역 적/탄환을 거의 정지'
  }
});
window.IronCellCannons=CANNONS;

let currentUser = null;
let currentUsername = '';
let profile = null;
let authBusy = false;
let adminEnabled = false;
let adminTargetUsername = '';
let adminTargetData = null;
let adminSearchTimer = 0;
let adminSearchSeq = 0;

function setAdminButtonVisible(visible){
  const show=visible===true;
  if(!els.lobbyAdmin)return;

  els.lobbyAdmin.hidden=!show;
  els.lobbyAdmin.classList.toggle('hidden',!show);
  els.lobbyAdmin.setAttribute('aria-hidden',show?'false':'true');

  if(show){
    els.lobbyAdmin.style.removeProperty('display');
  }else{
    els.lobbyAdmin.style.display='none';
  }
}

function setAdminPanelOpen(open){
  const show=open===true && adminEnabled===true;
  if(!els.adminScreen)return;

  els.adminScreen.classList.toggle('show',show);
  els.adminScreen.hidden=!show;
  els.adminScreen.setAttribute('aria-hidden',show?'false':'true');

  if(show){
    els.adminScreen.style.removeProperty('display');
  }else{
    els.adminScreen.style.display='none';
  }
}

function lockAdminUi(){
  adminEnabled=false;
  adminTargetUsername='';
  adminTargetData=null;
  setAdminButtonVisible(false);
  setAdminPanelOpen(false);
}

function normalizeUsername(value){
  return String(value || '').trim().toLowerCase();
}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g,ch=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[ch]);
}
const IRON_CELL_EMAIL_DOMAIN = 'players.example.com';
const IRON_CELL_EMAIL_PREFIX = 'ic_';
const IRON_CELL_NAMESPACE = 'iron-cell-arena';

function usernameToInternalEmail(username){
  return `${IRON_CELL_EMAIL_PREFIX}${username}@${IRON_CELL_EMAIL_DOMAIN}`;
}
function isIronCellUser(user){
  const email = String(user?.email || '').trim().toLowerCase();
  const namespace = String(user?.user_metadata?.game_namespace || '').trim().toLowerCase();
  return namespace === IRON_CELL_NAMESPACE
    || /^ic_[a-z0-9_]{3,20}@players\.example\.com$/.test(email);
}
async function ensureActiveIronCellSession(){
  let session = null;
  try{
    const first = await client.auth.getSession();
    session = first?.data?.session || null;

    if(!session?.user){
      const refreshed = await client.auth.refreshSession();
      session = refreshed?.data?.session || null;
    }

    if(!session?.user){
      const err = new Error('iron_cell_session_required');
      err.code = 'iron_cell_session_required';
      throw err;
    }

    if(!isIronCellUser(session.user)){
      const err = new Error('iron_cell_account_required');
      err.code = 'iron_cell_account_required';
      throw err;
    }

    currentUser = session.user;
    currentUsername = usernameFromUser(session.user);
    return session;
  }catch(error){
    throw error;
  }
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
    console.error('sworder VS tank profile load failed:', error);
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
  if(els.multiPullButtons?.length){
    const gems=Number(profile.gems||0);
    for(const button of els.multiPullButtons){
      const count=Math.max(1,Number(button.dataset.pullCount||1));
      const cost=count*100;
      button.disabled=authBusy||gems<cost;
      button.classList.toggle('unaffordable',gems<cost);
      button.title=gems<cost?`보석이 ${(cost-gems).toLocaleString()}개 부족합니다`:`${count.toLocaleString()}회 뽑기`;
    }
  }
  if(els.collection){
    els.collection.innerHTML=Object.values(CANNONS).map(c=>{
      const own=owned.has(c.id),eq=equipped.id===c.id;
      const chance=c.id==='standard'?'기본 지급':`뽑기 ${c.chance}%`;
      return `<button type="button" class="cannon-card rarity-card-${c.rarity} ${own?'':'locked'} ${eq?'equipped':''}" data-cannon="${c.id}" ${own?'':'disabled'}>
        <div class="cannon-card-head"><strong>${c.name}</strong><span class="rarity ${c.rarity}">${c.rarityLabel}</span></div>
        <small class="cannon-chance">${chance}</small>
        <p>${own?c.desc:'아직 획득하지 않은 대포입니다.'}</p>${own&&c.passive?`<div class="cannon-passive-line">● ${c.passive}</div>`:''}${own&&c.skill?`<div class="cannon-skill-line">⚡ ${c.skill}</div>`:''}${own&&c.skill2?`<div class="cannon-skill-line second">◆ ${c.skill2}</div>`:''}${own&&c.skill3?`<div class="cannon-skill-line third">✦ ${c.skill3}</div>`:''}
        <div class="equip-label">${eq?'장착 중':own?'눌러서 장착':'미보유'}</div>
      </button>`;
    }).join('');
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

  const equipped=currentCannon();
  if(els.lobbyUsername)els.lobbyUsername.textContent=currentUsername||'PLAYER';
  if(els.lobbyGemText)els.lobbyGemText.textContent=Number(profile.gems||0).toLocaleString();
  if(els.lobbyBestLevel)els.lobbyBestLevel.textContent=Number(profile.best_level||1).toLocaleString();
  if(els.lobbyBestScore)els.lobbyBestScore.textContent=Number(profile.best_score||0).toLocaleString();
  if(els.lobbyBestKills)els.lobbyBestKills.textContent=Number(profile.best_kills||0).toLocaleString();
  if(els.lobbyCannonName)els.lobbyCannonName.textContent=equipped.name;
  if(els.lobbyCannonDesc)els.lobbyCannonDesc.textContent=equipped.desc;
  if(els.lobbyCannonRarity){
    els.lobbyCannonRarity.textContent=equipped.rarityLabel;
    els.lobbyCannonRarity.className=`rarity ${equipped.rarity}`;
  }
  if(els.lobbyMiniCannon)els.lobbyMiniCannon.className=`mini-cannon cannon-${equipped.id}`;

  renderCannonGarage();
}


function setAdminMessage(text='',type=''){
  if(!els.adminMessage)return;
  els.adminMessage.textContent=text;
  els.adminMessage.className=`admin-message ${type}`.trim();
}
function adminFriendlyError(error){
  const msg=String(error?.message||error||'').toLowerCase();
  if(msg.includes('admin_required'))return '관리자 권한이 없습니다.';
  if(msg.includes('user_not_found'))return '해당 sworder VS tank 계정을 찾지 못했습니다.';
  if(msg.includes('invalid_username'))return '아이디 형식을 확인하세요.';
  if(msg.includes('cannot_remove_standard')||msg.includes('cannot_remove_starter'))return '기본 등급 캐릭터는 회수할 수 없습니다.';
  if(msg.includes('admin_request_timeout'))return '서버 응답이 지연되고 있습니다. 다시 시도해 주세요.';
  return String(error?.message||error||'서버 요청 실패');
}
function renderAdminCannons(){
  if(!els.adminCannonGrid)return;
  els.adminCannonGrid.innerHTML=Object.values(CANNONS).map(c=>`
    <div class="admin-cannon-item">
      <strong><span class="rarity ${c.rarity}">${c.rarityLabel}</span> ${c.name}</strong>
      <div class="admin-cannon-buttons">
        <button type="button" data-admin-cannon="${c.id}" data-admin-owned="true">지급</button>
        <button type="button" data-admin-cannon="${c.id}" data-admin-owned="false">회수</button>
      </div>
    </div>
  `).join('');
}
function renderAdminTarget(data){
  adminTargetData=data||null;
  if(!els.adminTarget)return;
  if(!data){
    els.adminTarget.className='admin-target-card empty';
    els.adminTarget.textContent='검색할 계정 아이디를 입력하세요.';
    return;
  }
  const p=data.profile||{};
  const owned=Array.isArray(p.owned_cannons)?p.owned_cannons:[];
  els.adminTarget.className='admin-target-card';
  els.adminTarget.innerHTML=`
    <div class="admin-target-stat"><small>아이디</small><b>${escapeHtml(data.username||'-')}</b></div>
    <div class="admin-target-stat"><small>보석</small><b>${Number(p.gems||0).toLocaleString()}</b></div>
    <div class="admin-target-stat"><small>최고 점수</small><b>${Number(p.best_score||0).toLocaleString()}</b></div>
    <div class="admin-target-stat"><small>최고 LV</small><b>${Number(p.best_level||1).toLocaleString()}</b></div>
    <div class="admin-target-stat"><small>총 전투</small><b>${Number(p.total_runs||0).toLocaleString()}</b></div>
    <div class="admin-target-stat"><small>총 처치</small><b>${Number(p.total_kills||0).toLocaleString()}</b></div>
    <div class="admin-target-stat"><small>장착 대포</small><b>${escapeHtml(CANNONS[p.equipped_cannon]?.name||p.equipped_cannon||'기본포')}</b></div>
    <div class="admin-target-stat"><small>보유 대포</small><b>${owned.length.toLocaleString()}종</b></div>
  `;
}
async function refreshAdminAccess(){
  // Fail closed first: ordinary accounts never briefly see the admin UI.
  setAdminButtonVisible(false);
  setAdminPanelOpen(false);

  if(!currentUser){
    adminEnabled=false;
    return false;
  }

  let lastError=null;

  for(let attempt=0;attempt<2;attempt++){
    try{
      await ensureActiveIronCellSession();

      const response=await withAdminTimeout(
        client.rpc('iron_cell_admin_is_admin'),
        6000
      );

      if(response.error)throw response.error;

      adminEnabled=response.data===true;

      if(adminEnabled){
        setAdminButtonVisible(true);
        return true;
      }

      // Authenticated but not an admin: keep everything completely hidden.
      lockAdminUi();
      return false;

    }catch(error){
      lastError=error;
      console.warn(`Admin access check attempt ${attempt+1} failed:`,error);

      if(attempt===0){
        try{
          await client.auth.refreshSession();
          const session=await ensureActiveIronCellSession();
          currentUser=session.user;
          currentUsername=usernameFromUser(session.user);
        }catch(refreshError){
          lastError=refreshError;
        }
      }
    }
  }

  console.warn('Admin access check failed after retry:',lastError);
  lockAdminUi();
  return false;
}

function withAdminTimeout(promiseLike,ms=4500){
  let timer=0;
  const timeout=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const error=new Error('admin_request_timeout');
      error.code='admin_request_timeout';
      reject(error);
    },ms);
  });
  return Promise.race([Promise.resolve(promiseLike),timeout]).finally(()=>clearTimeout(timer));
}
async function ensureAdminSession(){
  await ensureActiveIronCellSession();

  const allowed=adminEnabled===true
    ? true
    : await refreshAdminAccess();

  if(!allowed){
    lockAdminUi();
    const error=new Error('admin_required');
    error.code='admin_required';
    throw error;
  }
}
async function loadAdminProfilesByIds(ids){
  const list=[...new Set((ids||[]).filter(Boolean))];
  if(!list.length)return new Map();

  const response=await withAdminTimeout(
    client
      .from('iron_cell_profiles')
      .select('user_id,gems,best_level,best_score,best_kills,total_runs,total_kills,equipped_cannon,owned_cannons,pilot_name')
      .in('user_id',list),
    4500
  );
  if(response.error)throw response.error;

  return new Map((response.data||[]).map(row=>[String(row.user_id),row]));
}
async function loadAdminDirectoryDirect(query='',limit=30){
  await ensureAdminSession();

  const q=String(query||'').trim().toLowerCase();
  let request=client
    .from('iron_cell_accounts')
    .select('username,user_id,created_at',{count:'exact'})
    .order('created_at',{ascending:false})
    .limit(Math.max(1,Math.min(Number(limit)||30,100)));

  if(q)request=request.ilike('username',`${q}%`);

  const response=await withAdminTimeout(request,4500);
  if(response.error)throw response.error;

  const accounts=Array.isArray(response.data)?response.data:[];
  let profiles=new Map();
  try{
    profiles=await loadAdminProfilesByIds(accounts.map(row=>row.user_id));
  }catch(error){
    // The account list itself is more important than optional stats.
    console.warn('Admin profile merge skipped:',error);
  }

  return {
    total:q?null:Math.max(0,Number(response.count||accounts.length)),
    users:accounts.map(row=>({
      username:String(row.username||''),
      user_id:String(row.user_id||''),
      created_at:row.created_at||null,
      ...(profiles.get(String(row.user_id))||{})
    }))
  };
}
async function adminLookupDirect(username){
  await ensureAdminSession();

  const accountResponse=await withAdminTimeout(
    client
      .from('iron_cell_accounts')
      .select('username,user_id,created_at')
      .eq('username',username)
      .maybeSingle(),
    4500
  );
  if(accountResponse.error)throw accountResponse.error;
  if(!accountResponse.data){
    const error=new Error('user_not_found');
    error.code='user_not_found';
    throw error;
  }

  const userId=String(accountResponse.data.user_id||'');
  const profileResponse=await withAdminTimeout(
    client
      .from('iron_cell_profiles')
      .select('*')
      .eq('user_id',userId)
      .maybeSingle(),
    4500
  );
  if(profileResponse.error)throw profileResponse.error;

  return {
    username:String(accountResponse.data.username||username),
    user_id:userId,
    created_at:accountResponse.data.created_at||null,
    profile:profileResponse.data||null
  };
}


async function callAdminPanelV4(query='',limit=30,exact=null){
  await ensureAdminSession();
  const args={
    p_query:String(query||''),
    p_limit:Math.max(1,Math.min(Number(limit)||30,100)),
    p_exact:exact?String(exact):null
  };

  let lastError=null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await withAdminTimeout(client.rpc('iron_cell_admin_panel_v4',args),8000);
      if(!response.error&&response.data?.ok!==false)return response.data||{};
      lastError=response.error||new Error('admin_panel_invalid_response');
    }catch(error){
      lastError=error;
    }

    // One forced auth refresh protects the admin page from stale browser sessions.
    if(attempt===0){
      try{await client.auth.refreshSession()}catch(_){}
      await ensureActiveIronCellSession();
      await refreshAdminAccess();
    }
  }

  throw lastError||new Error('admin_panel_failed');
}
async function loadAdminDirectoryFallback(query='',limit=30){
  // Fallback 1: direct admin RLS table read. Supports contains search.
  try{
    await ensureAdminSession();
    const q=String(query||'').trim().toLowerCase();
    let request=client
      .from('iron_cell_accounts')
      .select('username,user_id,created_at',{count:'exact'})
      .order('created_at',{ascending:false})
      .limit(Math.max(1,Math.min(Number(limit)||30,100)));
    if(q)request=request.ilike('username',`%${q}%`);
    const result=await withAdminTimeout(request,6000);
    if(result.error)throw result.error;
    const accounts=Array.isArray(result.data)?result.data:[];
    let profiles=new Map();
    try{profiles=await loadAdminProfilesByIds(accounts.map(row=>row.user_id))}catch(_){}
    return{
      total:Math.max(0,Number(result.count||accounts.length)),
      users:accounts.map(row=>({
        ...row,
        ...(profiles.get(String(row.user_id))||{})
      }))
    };
  }catch(error){
    console.warn('Admin direct fallback failed:',error);
  }

  // Fallback 2: previous stable v3 RPC.
  const response=await withAdminTimeout(client.rpc('iron_cell_admin_panel_v3',{
    p_query:String(query||''),p_limit:Math.max(1,Math.min(Number(limit)||30,100)),p_exact:null
  }),6000);
  if(response.error)throw response.error;
  return{
    total:Math.max(0,Number(response.data?.total||0)),
    users:Array.isArray(response.data?.users)?response.data.users:[]
  };
}

function formatAdminDate(value){
  if(!value)return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return d.toLocaleString('ko-KR',{
    month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'
  });
}
function hideAdminSearchResults(){
  if(!els.adminSearchResults)return;
  els.adminSearchResults.classList.add('hidden');
  els.adminSearchResults.innerHTML='';
}
function renderAdminSearchResults(rows,query){
  if(!els.adminSearchResults)return;
  const list=Array.isArray(rows)?rows:[];
  if(!query){
    hideAdminSearchResults();
    return;
  }

  els.adminSearchResults.classList.remove('hidden');
  els.adminSearchResults.innerHTML=list.length?list.map(row=>`
    <button class="admin-search-result" type="button" data-admin-user="${escapeHtml(row?.username||'')}">
      <span>
        <strong>${escapeHtml(row?.username||'-')}</strong>
        <small>LV ${Math.max(1,Number(row?.best_level||1))} · SCORE ${Math.max(0,Number(row?.best_score||0)).toLocaleString()}</small>
      </span>
      <b>◆ ${Math.max(0,Number(row?.gems||0)).toLocaleString()}</b>
    </button>
  `).join(''):`<div class="admin-search-empty">"${escapeHtml(query)}"가 포함된 sworder VS tank 계정이 없습니다.</div>`;
}
async function loadAdminDirectory(query='',limit=30){
  if(!adminEnabled)return {total:0,users:[]};
  try{
    const data=await callAdminPanelV4(query,limit,null);
    let users=Array.isArray(data?.users)?data.users:[];

    // v4 currently guarantees fresh recent accounts. For contains-search convenience,
    // use the direct RLS fallback if the server prefix result is empty.
    if(query&&users.length===0){
      const fallback=await loadAdminDirectoryFallback(query,limit);
      if(fallback.users.length)return fallback;
    }
    return{total:Math.max(0,Number(data?.total||0)),users};
  }catch(error){
    console.warn('Admin v4 directory failed, using fallback:',error);
    return await loadAdminDirectoryFallback(query,limit);
  }
}
async function searchAdminDirectory(queryValue=els.adminUsername?.value){
  if(!adminEnabled)return;
  const query=normalizeUsername(queryValue);
  const seq=++adminSearchSeq;

  if(!query){
    hideAdminSearchResults();
    return;
  }
  if(!/^[a-z0-9_]{1,20}$/.test(query)){
    renderAdminSearchResults([],query);
    return;
  }

  try{
    const result=await loadAdminDirectory(query,12);
    if(seq!==adminSearchSeq)return;
    renderAdminSearchResults(result.users,query);
    if(els.adminAccountCount&&Number.isFinite(result.total)){
      els.adminAccountCount.textContent=`총 ${result.total.toLocaleString()}개`;
    }
  }catch(error){
    if(seq!==adminSearchSeq)return;
    console.warn('Fast admin directory search failed:',error);
    if(els.adminSearchResults){
      els.adminSearchResults.classList.remove('hidden');
      els.adminSearchResults.innerHTML=`<div class="admin-search-empty">${escapeHtml(adminFriendlyError(error))}</div>`;
    }
  }
}
function scheduleAdminDirectorySearch(){
  clearTimeout(adminSearchTimer);
  adminSearchTimer=setTimeout(()=>void searchAdminDirectory(),120);
}

async function adminLookup(usernameValue=els.adminUsername?.value){
  if(!adminEnabled)return;
  const username=normalizeUsername(usernameValue);

  if(!username){
    setAdminMessage('검색할 계정 아이디를 입력하세요.','error');
    hideAdminSearchResults();
    return;
  }

  // V5.42: 1~2글자는 정확검색 오류가 아니라 후보검색으로 처리.
  if(/^[a-z0-9_]{1,2}$/.test(username)){
    setAdminMessage(`"${username}" 포함 계정을 검색했습니다.`,'good');
    await searchAdminDirectory(username);
    return;
  }

  if(!validUsername(username)){
    setAdminMessage('아이디는 영문 소문자, 숫자, 밑줄로 1~20자 검색할 수 있습니다.','error');
    renderAdminSearchResults([],username);
    return;
  }

  setAdminMessage(`${username} 계정 검색 중...`,'busy');
  try{
    let payload=null;
    try{payload=await callAdminPanelV4(username,20,username)}catch(error){
      console.warn('Admin exact v4 failed:',error);
    }

    let data=payload?.exact||null;
    let candidates=Array.isArray(payload?.users)?payload.users:[];

    // If exact v4 is unavailable for any reason, direct lookup is still allowed only to admin.
    if(!data){
      try{data=await adminLookupDirect(username)}catch(_){}
    }
    if(!candidates.length){
      try{candidates=(await loadAdminDirectoryFallback(username,20)).users}catch(_){}
    }

    if(!data){
      renderAdminSearchResults(candidates,username);
      setAdminMessage(candidates.length?'정확히 일치하는 계정은 없습니다. 아래 후보를 선택하세요.':'해당 계정을 찾지 못했습니다.','error');
      return;
    }

    adminTargetUsername=username;
    if(els.adminUsername)els.adminUsername.value=username;
    renderAdminTarget(data);
    hideAdminSearchResults();
    setAdminMessage(`${username} 계정을 불러왔습니다.`,'good');
  }catch(error){
    setAdminMessage(adminFriendlyError(error),'error');
  }
}
async function adminChangeGems(mode){
  if(!adminEnabled||!adminTargetUsername){
    setAdminMessage('먼저 관리할 계정을 검색하세요.','error');return;
  }
  const amount=Math.max(0,Math.floor(Number(els.adminGemAmount?.value||0)));
  if(!Number.isFinite(amount)){
    setAdminMessage('보석 수량을 확인하세요.','error');return;
  }
  setAdminMessage('보석 정보를 변경하는 중...','busy');
  const {data,error}=await client.rpc('iron_cell_admin_change_gems',{
    p_username:adminTargetUsername,p_mode:mode,p_amount:amount
  });
  if(error){setAdminMessage(adminFriendlyError(error),'error');return}
  renderAdminTarget({username:adminTargetUsername,profile:data?.profile||{}});
  setAdminMessage(`보석 변경 완료 · ${Number(data?.profile?.gems||0).toLocaleString()}개`,'good');
  void loadAdminRecentUsers();
  if(adminTargetUsername===currentUsername)await refreshProfile();
}
async function adminSetCannon(cannon,owned){
  if(!adminEnabled||!adminTargetUsername){
    setAdminMessage('먼저 관리할 계정을 검색하세요.','error');return;
  }
  setAdminMessage(`${CANNONS[cannon]?.name||cannon} ${owned?'지급':'회수'} 중...`,'busy');
  const {data,error}=await client.rpc('iron_cell_admin_set_cannon',{
    p_username:adminTargetUsername,p_cannon:cannon,p_owned:owned
  });
  if(error){setAdminMessage(adminFriendlyError(error),'error');return}
  renderAdminTarget({username:adminTargetUsername,profile:data?.profile||{}});
  setAdminMessage(`${CANNONS[cannon]?.name||cannon} ${owned?'지급':'회수'} 완료`,'good');
  if(adminTargetUsername===currentUsername)await refreshProfile();
}
async function loadAdminRecentUsers(){
  if(!adminEnabled||!els.adminRecentUsers)return;

  els.adminRecentUsers.innerHTML=
    '<div class="admin-message busy">최근 가입 계정을 불러오는 중...</div>';
  if(els.adminAccountCount)els.adminAccountCount.textContent='불러오는 중…';

  try{
    const result=await loadAdminDirectory('',30);
    const rows=Array.isArray(result?.users)?result.users:[];
    const total=Number.isFinite(Number(result?.total))
      ? Number(result.total)
      : rows.length;

    if(els.adminAccountCount)
      els.adminAccountCount.textContent=`총 ${total.toLocaleString()}개`;

    const html=rows.map(row=>{
      const username=escapeHtml(row?.username||'-');
      const userAttr=escapeHtml(row?.username||'');
      const level=Math.max(1,Number(row?.best_level||1));
      const score=Math.max(0,Number(row?.best_score||0));
      const gems=Math.max(0,Number(row?.gems||0));
      const joined=escapeHtml(formatAdminDate(row?.created_at));

      return `
        <button class="admin-recent-user" type="button" data-admin-user="${userAttr}">
          <span>
            <strong>${username}</strong>
            <small>LV ${level} · SCORE ${score.toLocaleString()}</small>
            <time>${joined} 가입</time>
          </span>
          <b>◆ ${gems.toLocaleString()}</b>
        </button>`;
    }).join('');

    els.adminRecentUsers.innerHTML=html ||
      '<div class="admin-message">현재 sworder VS tank 독립계정이 없습니다.</div>';

    return rows;
  }catch(error){
    console.error('Recent admin account load failed:',error);
    if(els.adminAccountCount)els.adminAccountCount.textContent='불러오기 실패';

    // Do not depend on another potentially failing renderer in the catch path.
    const safeMessage=String(adminFriendlyError(error)||'최근 가입 계정 조회 실패')
      .replace(/[&<>"']/g,ch=>({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      })[ch]);

    els.adminRecentUsers.innerHTML=
      `<div class="admin-message error">${safeMessage}</div>`;
    return [];
  }
}
async function showAdmin(){
  // Never trust the visible button alone. Re-check server permission on entry.
  setAdminPanelOpen(false);

  const allowed=await refreshAdminAccess();
  if(!allowed){
    setAdminMessage('관리자 권한이 없습니다.','error');
    showLobby();
    return;
  }

  els.authScreen?.classList.remove('show');
  els.startScreen?.classList.remove('show');
  els.garageScreen?.classList.remove('show');
  els.lobbyScreen?.classList.remove('show');

  setAdminPanelOpen(true);

  renderAdminCannons();
  setAdminMessage('관리자 권한 확인 완료 · 계정 목록 연결 중...','busy');

  try{
    const recentRows=await loadAdminRecentUsers();

    const visibleCount=
      els.adminRecentUsers?.querySelectorAll?.('[data-admin-user]')?.length||0;
    const totalText=String(els.adminAccountCount?.textContent||'').trim();

    if(totalText==='불러오기 실패'){
      setAdminMessage('관리자 권한은 정상이나 최근 가입 계정 조회에 실패했습니다. 새로고침을 눌러 다시 시도하세요.','error');
    }else{
      setAdminMessage(
        visibleCount
          ? `관리자 연결 정상 · 최근 ${visibleCount}개 표시 · ${totalText}`
          : `관리자 연결 정상 · ${totalText}`,
        'good'
      );
    }
  }catch(error){
    setAdminMessage(adminFriendlyError(error),'error');
  }
}

function hideGameMenus(){
  els.startScreen?.classList.remove('show');
  els.garageScreen?.classList.remove('show');
  els.lobbyScreen?.classList.remove('show');
  setAdminPanelOpen(false);
}
function showAuth(){
  hideGameMenus();
  els.authScreen?.classList.add('show');
}
function showLobby(){
  els.authScreen?.classList.remove('show');
  els.startScreen?.classList.remove('show');
  els.garageScreen?.classList.remove('show');
  setAdminPanelOpen(false);
  setAdminButtonVisible(false);
  els.lobbyScreen?.classList.add('show');
  renderProfile();
  void refreshAdminAccess();
}
function showGarage(){
  els.authScreen?.classList.remove('show');
  els.startScreen?.classList.remove('show');
  els.lobbyScreen?.classList.remove('show');
  setAdminPanelOpen(false);
  els.garageScreen?.classList.add('show');
  renderProfile();
}
function showDeploy(){
  els.garageScreen?.classList.remove('show');
  els.lobbyScreen?.classList.remove('show');
  els.authScreen?.classList.remove('show');
  setAdminPanelOpen(false);
  els.startScreen?.classList.add('show');
  renderProfile();
}
function showMenu(){showLobby()}

function pullResultSummary(data){
  const counts=data?.counts||{};
  const order=['error','nova','ring','rocket','plasma','piercer','spread','rapid'];
  const parts=[];
  for(const id of order){
    const n=Number(counts[id]||0);
    if(n>0){
      const c=CANNONS[id];
      parts.push(`${c?.rarityLabel||id} ${n.toLocaleString()}개`);
    }
  }
  const newIds=Array.isArray(data?.new_cannons)?data.new_cannons:[];
  const newText=newIds.length
    ? ` · 신규 ${newIds.map(id=>CANNONS[id]?.name||id).join(', ')}`
    : '';
  return `${Number(data?.count||0).toLocaleString()}회 결과 · ${parts.join(' · ')}${newText}`;
}

async function pullCannons(count=1){
  if(authBusy){
    setGachaMessage('잠시 후 다시 눌러주세요.','error');
    return;
  }
  if(!currentUser){
    setGachaMessage('로그인이 필요합니다.','error');
    return;
  }
  count=Math.floor(Number(count||1));
  const allowed=new Set([1,5,10,50,100,500,1000]);
  if(!allowed.has(count))return;

  const cost=count*100;
  let gems=Number(profile?.gems||0);

  // If the local wallet is stale, refresh once before blocking the pull.
  if(gems<cost){
    try{
      await refreshProfile();
      gems=Number(profile?.gems||0);
    }catch(_){}
  }

  if(gems<cost){
    setGachaMessage(`보석이 ${cost.toLocaleString()}개 필요합니다. (현재 ${gems.toLocaleString()}개)`,'error');
    return;
  }

  setBusy(true);
  renderProfile();
  setGachaMessage(`${count.toLocaleString()}회 뽑는 중...`);

  try{
    const {data,error}=await client.rpc('iron_cell_pull_cannons_v2',{p_count:count});
    if(error)throw error;

    profile.gems=Number(data?.gems||0);
    profile.owned_cannons=data?.owned_cannons||profile.owned_cannons;
    renderProfile();

    const rarest=String(data?.rarest||'common');
    setGachaMessage(pullResultSummary(data),`rarity-${rarest}`);
  }catch(error){
    console.error(error);
    const message=String(error?.message||'');
    const friendly =
      message.includes('not_enough_gems')
        ? '보석이 부족합니다.'
        : message.includes('invalid_pull_count')
          ? '지원하지 않는 뽑기 횟수입니다.'
          : message.includes('not_authenticated')
            ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
            : `뽑기 오류: ${message || '서버 요청 실패'}`;
    setGachaMessage(friendly,'error');
  }finally{
    setBusy(false);
    renderProfile();
  }
}
async function equipCannon(cannonId){
  if(authBusy||!currentUser)return;const cannon=CANNONS[cannonId];if(!cannon)return;
  try{const {data,error}=await client.rpc('iron_cell_equip_cannon_v1',{p_cannon:cannonId});if(error)throw error;profile=data||profile;renderProfile();setGachaMessage(`${cannon.name} 장착 완료`,'good')}
  catch(error){console.error(error);setGachaMessage('대포 장착에 실패했습니다.','error')}
}

async function enterSession(user){
  if(!isIronCellUser(user)){
    try{ await client.auth.signOut({scope:'local'}); }catch(_){}
    currentUser = null;
    currentUsername = '';
    profile = null;
    showAuth();
    setMessage('이 계정은 sworder VS tank 전용 계정이 아닙니다. 회원가입 버튼으로 새 sworder VS tank 계정을 만들어 주세요.', 'error');
    return false;
  }

  currentUser = user;
  currentUsername = usernameFromUser(user);
  lockAdminUi();
  setMessage('sworder VS tank 계정 데이터를 불러오는 중...', 'busy');
  await ensureProfile();
  renderProfile();
  setMessage('');
  showMenu();
  return true;
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
  setMessage('sworder VS tank 전용 계정을 만드는 중...', 'busy');

  try{
    const {data, error} = await client.auth.signUp({
      email: usernameToInternalEmail(username),
      password,
      options: { data: { username, game_namespace: IRON_CELL_NAMESPACE } }
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
      setMessage('sworder VS tank 아이디 또는 비밀번호를 확인하세요. 처음이라면 회원가입을 먼저 해주세요.', 'error');
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
    lockAdminUi();
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

async function saveRun(run, finish=false){
  if(!run) return {profile,awarded_gems:0,awarded_score:0,error:{message:'invalid_run'}};

  const pilotName = escapePilotName(run.pilotName || els.pilotName?.value);
  const runId = String(run.runId || '').slice(0,80);
  if(!runId) return {profile,awarded_gems:0,awarded_score:0,error:{message:'invalid_run_id'}};

  const args = {
    p_run_id: runId,
    p_pilot_name: pilotName,
    p_level: Math.max(1, Math.floor(Number(run.level || 1))),
    p_score: Math.max(0, Math.floor(Number(run.score || 0))),
    p_kills: Math.max(0, Math.floor(Number(run.kills || 0))),
    p_finish: !!finish
  };

  try{
    await ensureActiveIronCellSession();

    let response = await client.rpc('iron_cell_save_run_v2', args);

    // Background tab / sleeping laptop can leave an expired access token.
    // Refresh once and retry instead of falsely reporting an internet error.
    if(response.error){
      const msg = String(response.error.message || '').toLowerCase();
      const authLike =
        msg.includes('jwt') ||
        msg.includes('not_authenticated') ||
        msg.includes('account_required') ||
        msg.includes('session');

      if(authLike){
        try{
          await client.auth.refreshSession();
          await ensureActiveIronCellSession();
          response = await client.rpc('iron_cell_save_run_v2', args);
        }catch(_){}
      }
    }

    const {data, error} = response;
    if(error){
      console.error('Run save failed:', error);
      return {profile,awarded_gems:0,awarded_score:0,error};
    }

    const result = data || {};
    if(result.profile) profile = result.profile;
    renderProfile();
    return result;
  }catch(error){
    console.error('Run save/session failed:', error);
    return {profile,awarded_gems:0,awarded_score:0,error};
  }
}
async function finishRun(run){
  return saveRun(run,true);
}

async function saveRunProgress(run){
  return saveRun(run,false);
}

async function refreshProfile(){
  if(!currentUser) return null;
  await ensureProfile();
  renderProfile();
  return profile;
}

async function boot(){
  lockAdminUi();
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
document.addEventListener('click', event => {
  const target=event.target instanceof Element?event.target:null;
  const gemButton=target?.closest?.('[data-admin-gem]');
  const cannonButton=target?.closest?.('[data-admin-cannon]');
  const userButton=target?.closest?.('[data-admin-user]');

  if(gemButton){
    event.preventDefault();event.stopPropagation();
    void adminChangeGems(String(gemButton.dataset.adminGem||''));
    return;
  }
  if(cannonButton){
    event.preventDefault();event.stopPropagation();
    void adminSetCannon(
      String(cannonButton.dataset.adminCannon||''),
      String(cannonButton.dataset.adminOwned||'')==='true'
    );
    return;
  }
  if(userButton){
    event.preventDefault();event.stopPropagation();
    hideAdminSearchResults();
    void adminLookup(String(userButton.dataset.adminUser||''));
  }
},true);

// Gacha buttons use delegated events so both the new multi-pull UI
// and an older cached/single-button index.html continue to work.
document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest?.('[data-pull-count], #pullCannonBtn');
  if(!button) return;

  event.preventDefault();
  event.stopPropagation();

  const count = button.id === 'pullCannonBtn'
    ? 1
    : Number(button.dataset.pullCount || 1);

  void pullCannons(count);
}, true);
els.garageLobby?.addEventListener('click',showLobby);
els.garageBackLobby?.addEventListener('click',showLobby);
els.lobbyBattle?.addEventListener('click',showDeploy);
els.lobbyArsenal?.addEventListener('click',showGarage);
els.lobbyAdmin?.addEventListener('click',event=>{
  event.preventDefault();
  if(!adminEnabled){
    setAdminButtonVisible(false);
    return;
  }
  void showAdmin();
});
els.adminBack?.addEventListener('click',showLobby);
els.adminSearch?.addEventListener('click',()=>void adminLookup());
els.adminRefresh?.addEventListener('click',()=>void loadAdminRecentUsers());
els.backLobby?.addEventListener('click',showLobby);

els.password?.addEventListener('keydown', event => {
  if(event.key === 'Enter') login();
});
els.adminUsername?.addEventListener('input',scheduleAdminDirectorySearch);
els.adminUsername?.addEventListener('focus',()=>{
  if(els.adminUsername?.value) scheduleAdminDirectorySearch();
});
els.adminUsername?.addEventListener('keydown', event => {
  if(event.key === 'Enter'){
    event.preventDefault();
    void adminLookup();
  }else if(event.key === 'Escape'){
    hideAdminSearchResults();
  }
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
  saveRunProgress,
  savePilotName,
  refreshProfile,
  showLobby,
  showGarage,
  showDeploy,
  pullCannons,
  equipCannon,
  getCannon(){return currentCannon();}
};

void boot();
})();
