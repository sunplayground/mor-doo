import { Env } from './types';

export function getWebAppHtml(env: Env): string {
  const liffId = env.LIFF_ID || 'REPLACE_WITH_YOUR_LIFF_ID';
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>พี่ดาว — หมอดู AI</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>
tailwind.config={theme:{extend:{fontFamily:{sans:['Sarabun','sans-serif']}}}}
</script>
<style>
*{scrollbar-width:none}
*::-webkit-scrollbar{display:none}
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:200;opacity:0;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.drawer-overlay.active{opacity:1;pointer-events:auto}
body.drawer-open #wrapper{filter:brightness(.6) saturate(.7);transition:filter .3s}
body.drawer-open{overflow:hidden;background:#e4e4e7}
.drawer-sheet{position:fixed;bottom:0;left:50%;transform:translateX(-50%) translateY(100%);width:100%;max-width:420px;max-height:90vh;background:#fff;border-radius:16px 16px 0 0;z-index:201;transition:transform .3s cubic-bezier(.32,.72,0,1);overflow:hidden;display:flex;flex-direction:column}
.drawer-sheet.active{transform:translateX(-50%) translateY(0)}
.drawer-handle{width:40px;height:4px;background:#d4d4d8;border-radius:2px;margin:12px auto}
.drawer-body{overflow-y:auto;padding:0 20px 32px;flex:1}
</style>
</head>
<body class="bg-zinc-50 font-sans text-zinc-900 flex justify-center min-h-screen">
<div id="wrapper" class="w-full max-w-[420px] min-h-screen bg-white relative overflow-x-hidden">
<div id="app"></div>
<nav id="bottomNav" class="fixed bottom-0 w-full max-w-[420px] flex justify-around py-2 pb-5 bg-white border-t border-zinc-100 z-50">
  <button class="nav-item flex flex-col items-center gap-0.5 text-[10px] font-medium text-zinc-400 cursor-pointer bg-transparent border-none p-1 rounded-lg transition-colors" data-nav="today" onclick="navigate('today')"><i data-lucide="sun" class="w-5 h-5"></i>TODAY</button>
  <button class="nav-item flex flex-col items-center gap-0.5 text-[10px] font-medium text-zinc-400 cursor-pointer bg-transparent border-none p-1 rounded-lg transition-colors" data-nav="timing" onclick="navigate('timing')"><i data-lucide="clock" class="w-5 h-5"></i>TIMING</button>
  <button class="nav-item flex flex-col items-center gap-0.5 text-[10px] font-medium text-zinc-400 cursor-pointer bg-transparent border-none p-1 rounded-lg transition-colors" data-nav="ask" onclick="navigate('ask')"><i data-lucide="message-circle" class="w-5 h-5"></i>ASK</button>
  <button class="nav-item flex flex-col items-center gap-0.5 text-[10px] font-medium text-zinc-400 cursor-pointer bg-transparent border-none p-1 rounded-lg transition-colors" data-nav="friends" onclick="navigate('friends')"><i data-lucide="heart-handshake" class="w-5 h-5"></i>FRIENDS</button>
</nav>
</div>

<div class="drawer-overlay" id="drawerOverlay" onclick="if(event.target===this)closeDrawer()">
  <div class="drawer-sheet" id="drawerSheet" onclick="event.stopPropagation()">
    <div class="drawer-handle"></div>
    <div class="drawer-body" id="drawerBody"></div>
  </div>
</div>

<script>
const API='';
let userId=localStorage.getItem('mor_doo_userId')||'';
let userName=localStorage.getItem('mor_doo_userName')||'';
let userPic=localStorage.getItem('mor_doo_userPic')||'';
let isOnboarded=localStorage.getItem('mor_doo_onboarded')==='1';
let chatHistory=[];
let idToken=localStorage.getItem('mor_doo_idToken')||'';
let currentScreen='splash';
let activeResultId=null;
let pollAbort=false;
let drawerContext=null;

function $(id){return document.getElementById(id)}
function showScreen(html){
  drawerContext=null;
  $('drawerOverlay').classList.remove('active');
  $('drawerSheet').classList.remove('active');
  $('app').innerHTML=html;
  updateNav();
  if(typeof lucide!=='undefined')lucide.createIcons();
}
function updateNav(){
  document.querySelectorAll('.nav-item').forEach(n=>{
    n.classList.toggle('text-zinc-400',n.dataset.nav!==currentScreen);
    n.classList.toggle('text-zinc-900',n.dataset.nav===currentScreen);
    n.classList.toggle('font-semibold',n.dataset.nav===currentScreen);
  });
}
function esc(t){if(!t)return '';return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

const SPINNER_HTML='<div class="text-center py-8"><div class="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-3"></div><p class="text-sm text-zinc-500">พี่ดาวกำลังทำนาย...</p></div>';

function openDrawer(html){
  const ctx=currentScreen;
  drawerContext=ctx;
  const ov=$('drawerOverlay');
  const sh=$('drawerSheet');
  $('drawerBody').innerHTML=html;
  ov.classList.add('active');
  sh.classList.add('active');
  document.body.classList.add('drawer-open');
  if(typeof lucide!=='undefined')lucide.createIcons();
}
function updateDrawer(html){
  if(drawerContext!==currentScreen)return;
  $('drawerBody').innerHTML=html;
  if(typeof lucide!=='undefined')lucide.createIcons();
}
function closeDrawer(){
  drawerContext=null;
  $('drawerOverlay').classList.remove('active');
  $('drawerSheet').classList.remove('active');
  document.body.classList.remove('drawer-open');
}
function isDrawerActive(){return drawerContext!==null&&drawerContext===currentScreen}

async function api(path,body=null,method='POST'){
  const opts={method,headers:{'Content-Type':'application/json','X-User-Id':userId}};
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(API+path,opts);
  return res.json();
}

function navigate(screen){
  pollAbort=true;activeResultId=null;drawerContext=null;
  currentScreen=screen;
  closeDrawer();
  switch(screen){
    case 'today': renderToday(); break;
    case 'timing': renderTiming(); break;
    case 'ask': renderAsk(); break;
    case 'friends': renderFriends(); break;
    default: renderSplash();
  }
}

// ===================== SPLASH & AUTH =====================

function renderSplash(){
  currentScreen='splash';
  showScreen(\`<div class="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center px-8">
    <div class="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-lg mb-4">
      <i data-lucide="sparkles" class="w-8 h-8 text-white"></i>
    </div>
    <h1 class="text-2xl font-bold text-zinc-900">พี่ดาว</h1>
    <p class="text-sm text-zinc-500 mt-2 max-w-[280px]">หมอดู AI ส่วนตัว ที่รู้จักคุณดีที่สุด</p>
    <div class="flex flex-col gap-3 w-[280px] mt-8">
      <button class="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#06C755] text-white font-semibold text-base" onclick="loginWithLINE()"><i data-lucide="message-circle" class="w-5 h-5"></i> เข้าสู่ระบบด้วย LINE</button>
      <button class="w-full py-3 rounded-xl border border-zinc-200 text-zinc-600 font-semibold text-base" onclick="skipLogin()">ใช้โดยไม่ล็อกอิน</button>
    </div>
    <p class="text-[11px] text-zinc-400 mt-4">ล็อกอินเพื่อบันทึกข้อมูลส่วนตัวและดวงชะตา</p>
  </div>\`);
}

function renderOnboarding(step){
  currentScreen='onboarding';
  const steps=['name','birthday','birthtime','phone'];
  const current=step||0;
  const dots=steps.map((_,i)=>'<div class="w-2 h-2 rounded-full '+(i<current?'bg-zinc-900':i===current?'bg-zinc-500':'bg-zinc-200')+'"></div>').join('');
  let form='';
  if(current===0) form='<div class="flex flex-col gap-4 mt-4"><div><label class="text-sm text-zinc-500 font-medium">ชื่อ-นามสกุล</label><input id="ob-name" placeholder="ชื่อ นามสกุล" class="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div><button class="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-base" onclick="onboardNext(0)">ถัดไป</button></div>';
  else if(current===1) form='<div class="flex flex-col gap-4 mt-4"><div class="flex gap-3"><div class="flex-1"><label class="text-sm text-zinc-500 font-medium">วัน</label><input id="ob-day" type="number" min="1" max="31" placeholder="DD" class="w-full mt-1 px-3 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div><div class="flex-1"><label class="text-sm text-zinc-500 font-medium">เดือน</label><input id="ob-month" type="number" min="1" max="12" placeholder="MM" class="w-full mt-1 px-3 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div><div class="flex-1"><label class="text-sm text-zinc-500 font-medium">ปี (ค.ศ.)</label><input id="ob-year" type="number" min="1940" max="2010" placeholder="YYYY" class="w-full mt-1 px-3 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div></div><button class="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-base" onclick="onboardNext(1)">ถัดไป</button></div>';
  else if(current===2) form='<div class="flex flex-col gap-4 mt-4"><div><label class="text-sm text-zinc-500 font-medium">เวลาเกิด</label><input id="ob-time" placeholder="เช่น 14:30 หรือ ไม่ระบุ" class="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div><button class="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-base" onclick="onboardNext(2)">ถัดไป</button></div>';
  else if(current===3) form='<div class="flex flex-col gap-4 mt-4"><div><label class="text-sm text-zinc-500 font-medium">เบอร์โทรศัพท์</label><input id="ob-phone" type="tel" placeholder="เช่น 081-234-5678" class="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div><button class="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-base" onclick="onboardNext(3)">เสร็จสิ้น</button></div>';
  showScreen('<div class="px-6 pt-8"><div class="flex gap-2 justify-center">'+dots+'</div><h2 class="text-center text-lg font-semibold text-zinc-900 mt-6">'+['คุณชื่ออะไรคะ?','วันเกิดของคุณ?','เกิดเวลากี่โมงคะ?','เบอร์โทรศัพท์?'][current]+'</h2><p class="text-center text-sm text-zinc-500 mt-2">'+['กรอกชื่อ-นามสกุล','วัน/เดือน/ปีเกิด (ปี ค.ศ.)','ถ้าจำไม่ได้ พิมพ์ "ไม่ระบุ"','สำหรับการติดต่อและบริการพิเศษ'][current]+'</p>'+form+'</div>');
}

let obData={};
async function onboardNext(step){
  if(step===0){const name=$('ob-name').value.trim();if(!name){alert('กรุณากรอกชื่อ');return}obData.name=name;renderOnboarding(1)}
  else if(step===1){const d=$('ob-day').value,m=$('ob-month').value,y=$('ob-year').value;if(!d||!m||!y){alert('กรุณากรอกให้ครบ');return}obData.birthdate=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');renderOnboarding(2)}
  else if(step===2){obData.birthtime=$('ob-time').value.trim()||'ไม่ระบุ';renderOnboarding(3)}
  else if(step===3){obData.phone=$('ob-phone').value.trim();if(!obData.phone){alert('กรุณากรอกเบอร์โทร');return}await submitOnboarding()}
}

async function submitOnboarding(){
  showScreen('<div class="flex items-center justify-center min-h-screen"><div class="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div>');
  try{
    const res=await api('/api/auth/onboard',{userId:userId||undefined,...obData});
    if(res.success){userId=res.userId||userId;localStorage.setItem('mor_doo_userId',userId);localStorage.setItem('mor_doo_userName',obData.name);localStorage.setItem('mor_doo_onboarded','1');isOnboarded=true;userName=obData.name;navigate('today')}
    else{alert(res.error||'Error');renderOnboarding(3)}
  }catch(e){alert(e.message);renderOnboarding(3)}
}

async function loginWithLINE(){
  if(typeof liff==='undefined'){alert('กรุณาเปิดผ่าน LINE app หรือลิงก์ LIFF เท่านั้นค่ะ');return}
  try{
    await liff.init({liffId:'${liffId}',withLoginOnExternalBrowser:true});
    if(!liff.isLoggedIn()&&!liff.isInClient()){liff.login();return}
    const profile=await liff.getProfile();const ctx=liff.getContext();const lineUserId=ctx?.userId||profile.userId;
    if(!lineUserId){throw new Error('Cannot get LINE user ID')}
    showScreen('<div class="flex items-center justify-center min-h-screen"><div class="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div>');
    const res=await api('/api/auth/line-login',{lineUserId,displayName:profile.displayName,pictureUrl:profile.pictureUrl||''});
    if(res.userId){userId=res.userId;userName=res.user?.name||profile.displayName;userPic=res.user?.pictureUrl||profile.pictureUrl||'';localStorage.setItem('mor_doo_userId',userId);localStorage.setItem('mor_doo_userName',userName);localStorage.setItem('mor_doo_userPic',userPic)}
    if(res.onboarded){isOnboarded=true;localStorage.setItem('mor_doo_onboarded','1');navigate('today')}else{renderOnboarding(0)}
  }catch(e){console.error(e);showScreen('<div class="flex flex-col items-center justify-center min-h-screen text-center px-8"><h2 class="text-lg font-semibold">เกิดข้อผิดพลาด</h2><p class="text-sm text-zinc-500 mt-2">'+esc(e.message)+'</p><button class="mt-4 px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600" onclick="renderSplash()">ลองใหม่</button></div>')}
}

function skipLogin(){idToken='';renderOnboarding(0)}

// ===================== TAB 1: TODAY =====================

async function renderToday(){
  currentScreen='today';
  const dayNames=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  const now=new Date();
  const dateStr='วัน'+dayNames[now.getDay()]+'ที่ '+now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
  const avatarHtml=userPic?'<img src="'+esc(userPic)+'" class="w-9 h-9 rounded-full object-cover border-2 border-zinc-200" onerror="this.style.display=\\'none\\'">':'<div class="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center"><i data-lucide="sparkles" class="w-4 h-4 text-white"></i></div>';

  showScreen(\`<div class="px-5 pt-6 pb-24">
    <div class="flex items-center gap-3 mb-5">
      <div>\${avatarHtml}</div>
      <div>
        <p class="text-xs text-zinc-400">\${dateStr}</p>
        <h1 class="text-xl font-bold text-zinc-900">สวัสดีค่ะ \${userName||'คุณ'}</h1>
      </div>
      <button class="ml-auto p-2 rounded-lg border border-zinc-100" onclick="openProfile()"><i data-lucide="user" class="w-4 h-4 text-zinc-400"></i></button>
    </div>
    <div id="today-content"><div class="flex items-center justify-center py-12"><div class="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div></div>
  </div>\`);

  try{
    const res=await api('/api/feature/today',null,'GET');
    if(res.headline){
      $('today-content').innerHTML=renderTodayStructured(res,dateStr);
    } else if(res.result){
      $('today-content').innerHTML=renderTodayFallback(res.result,dateStr);
    } else {
      const fallback=await api('/api/feature/daily-reading',{});
      $('today-content').innerHTML=renderTodayFallback(fallback.result||fallback.error||'ไม่สามารถโหลดดวงได้',dateStr);
    }
  }catch(e){
    try{
      const fallback=await api('/api/feature/daily-reading',{});
      $('today-content').innerHTML=renderTodayFallback(fallback.result||fallback.error||'ไม่สามารถโหลดดวงได้',dateStr);
    }catch(e2){
      $('today-content').innerHTML='<p class="text-zinc-400 text-center py-8">เกิดข้อผิดพลาด ลองใหม่นะคะ</p>';
    }
  }
  if(typeof lucide!=='undefined')lucide.createIcons();
}

function renderTodayFallback(dailyText,dateStr){
  return '<div class="space-y-4"><div class="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 cursor-pointer active:scale-[0.98] transition-transform" onclick="quickFeature(\\'daily-reading\\')"><div class="flex items-center gap-2 mb-1"><i data-lucide="sparkles" class="w-4 h-4 text-zinc-300"></i><span class="font-semibold text-white">ดวงประจำวัน</span></div><p class="text-sm text-zinc-300 line-clamp-4">'+esc(dailyText.substring(0,250))+'</p><p class="text-xs text-zinc-500 mt-2">แตะเพื่อดูเต็ม</p></div>'+renderTodayBottom()+'</div>';
}

function renderTodayStructured(data,dateStr){
  const headline=data.headline||'';
  const chips=data.chips;
  const monthTheme=data.monthTheme||'';
  const yearTheme=data.yearTheme||'';
  const cycles=data.cycles||[];
  const insight=data.insight;

  let html='<div class="space-y-4">';

  html+='<div class="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 cursor-pointer active:scale-[0.98] transition-transform" onclick="quickFeature(\\'daily-reading\\')">';
  html+='<div class="flex items-center gap-2 mb-1"><i data-lucide="sparkles" class="w-4 h-4 text-zinc-300"></i><span class="font-semibold text-white">ดวงวันนี้</span></div>';
  html+='<p class="text-sm text-zinc-200 leading-relaxed font-medium">'+esc(headline)+'</p>';
  if(chips){
    html+='<div class="flex flex-wrap gap-1.5 mt-2">';
    if(chips.color)html+='<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium">'+esc(chips.color)+'</span>';
    if(chips.number)html+='<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium">'+esc(chips.number)+'</span>';
    if(chips.goldenTime)html+='<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-200 text-xs font-medium">เวลาทอง '+esc(chips.goldenTime)+'</span>';
    html+='</div>';
  }
  html+='<p class="text-xs text-zinc-500 mt-2">แตะเพื่อดูเต็ม</p></div>';

  if(monthTheme||yearTheme){
    html+='<div class="rounded-2xl border border-zinc-100 bg-white p-4">';
    html+='<div class="border-l-3 border-zinc-900 pl-3 mb-3"><div class="font-semibold text-zinc-900">'+esc(monthTheme||'เดือนนี้ COMPASS')+'</div><div class="text-xs text-zinc-500">'+esc(yearTheme||'ดูดวงสัปดาห์เพื่อดูธีมเต็มๆ')+'</div></div>';
    html+='<button class="w-full py-2 rounded-lg bg-zinc-100 text-zinc-700 font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform" onclick="quickFeature(\\'weekly-reading\\')"><i data-lucide="moon" class="w-3.5 h-3.5"></i> ดูดวงสัปดาห์</button></div>';
  }

  html+='<div><p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">CYCLES</p><div class="rounded-2xl border border-zinc-100 bg-white p-4 space-y-3">';
  if(cycles.length>0){
    cycles.forEach(function(c){
      const statusClass=c.status==='active'?'bg-zinc-900 text-white':c.status==='upcoming'?'bg-zinc-200 text-zinc-700':'bg-zinc-100 text-zinc-400';
      const dotClass=c.status==='active'?'bg-white':c.status==='upcoming'?'bg-zinc-400':'bg-zinc-300';
      html+='<div class="flex items-center gap-3"><div class="w-2.5 h-2.5 rounded-full '+dotClass+'"></div><div class="flex-1"><div class="text-sm font-medium text-zinc-900">'+esc(c.name)+'</div><div class="text-xs text-zinc-500">'+esc(c.dates)+'</div></div><span class="text-[11px] px-2 py-0.5 rounded-full font-semibold '+statusClass+'">'+(c.status==='active'?'ACTIVE':c.status==='upcoming'?'UPCOMING':'WINDING')+'</span></div>';
    });
  } else {
    html+='<div class="flex items-center gap-3"><div class="w-2.5 h-2.5 rounded-full bg-zinc-900"></div><div class="flex-1"><div class="text-sm font-medium text-zinc-900">ดูดวงประจำวัน</div><div class="text-xs text-zinc-500">อัปเดตทุกวัน</div></div><span class="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-zinc-900 text-white">ACTIVE</span></div>';
  }
  html+='<div class="flex gap-2 mt-3"><button class="flex-1 py-2 rounded-lg bg-zinc-900 text-white font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.98]" onclick="quickFeature(\\'birth-chart\\')"><i data-lucide="scan" class="w-3.5 h-3.5"></i> ผูกดวง</button><button class="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.98]" onclick="quickFeature(\\'bad-year\\')"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> ปีชง</button></div></div></div>';

  if(insight){
    html+='<div><p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">AI INSIGHT</p><div class="rounded-2xl border border-zinc-100 bg-white p-4 space-y-2">';
    if(insight.must)html+='<div class="p-3 rounded-xl bg-zinc-50 border border-zinc-200"><div class="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">สิ่งที่ต้องทำ</div><p class="text-sm text-zinc-800">'+esc(insight.must)+'</p></div>';
    if(insight.watch)html+='<div class="p-3 rounded-xl bg-zinc-50 border border-zinc-200"><div class="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">สิ่งที่ต้องระวัง</div><p class="text-sm text-zinc-800">'+esc(insight.watch)+'</p></div>';
    if(insight.hidden)html+='<div class="p-3 rounded-xl bg-zinc-50 border border-zinc-200"><div class="text-[11px] font-semibold text-zinc-900 uppercase tracking-wider mb-1">โอกาสซ่อนอยู่</div><p class="text-sm text-zinc-800">'+esc(insight.hidden)+'</p></div>';
    html+='</div></div>';
  }

  html+='</div>';
  return html;
}

function renderTodayBottom(){
  return '<div class="space-y-4 mt-4"><p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">CYCLES</p><div class="rounded-2xl border border-zinc-100 bg-white p-4"><div class="flex items-center gap-3"><div class="w-2.5 h-2.5 rounded-full bg-zinc-900"></div><div class="flex-1"><div class="text-sm font-medium text-zinc-900">ดูดวงประจำวัน</div><div class="text-xs text-zinc-500">อัปเดตทุกวัน</div></div><span class="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-zinc-900 text-white">ACTIVE</span></div><div class="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-100"><div class="w-2.5 h-2.5 rounded-full bg-zinc-400"></div><div class="flex-1"><div class="text-sm font-medium text-zinc-900">ตรวจปีชง</div><div class="text-xs text-zinc-500">ตรวจว่าปีนี้ชงไหม</div></div><span class="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-zinc-200 text-zinc-700">CHECK</span></div><div class="flex gap-2 mt-3"><button class="flex-1 py-2 rounded-lg bg-zinc-900 text-white font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.98]" onclick="quickFeature(\\'birth-chart\\')"><i data-lucide="scan" class="w-3.5 h-3.5"></i> ผูกดวง</button><button class="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.98]" onclick="quickFeature(\\'bad-year\\')"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> ปีชง</button></div></div></div>';
}

// ===================== TAB 2: TIMING =====================

async function renderTiming(){
  currentScreen='timing';
  const actions=[
    {icon:'phone',name:'โทรหาคนสำคัญ',id:'call'},
    {icon:'send',name:'ส่งข้อความสำคัญ',id:'text'},
    {icon:'file-signature',name:'เซ็นสัญญา',id:'sign'},
    {icon:'presentation',name:'พรีเซนต์',id:'present'},
    {icon:'credit-card',name:'ตัดสินใจซื้อใหญ่',id:'buy'},
    {icon:'x-circle',name:'ปฏิเสธคน',id:'reject'}
  ];
  showScreen(\`<div class="px-5 pt-6 pb-24">
    <div class="mb-5">
      <h1 class="text-xl font-bold text-zinc-900 flex items-center gap-2"><i data-lucide="clock" class="w-5 h-5 text-zinc-900"></i> TIMING</h1>
      <p class="text-sm text-zinc-500 mt-1">เวลาดีที่สุดสำหรับสิ่งที่คุณจะทำ</p>
    </div>
    <p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">RIGHT NOW</p>
    <p class="text-sm text-zinc-500 mb-3">แตะเพื่อเช็คว่าเวลานี้เหมาะไหม</p>
    <div class="grid grid-cols-2 gap-3">
      \${actions.map(a=>'<div class="rounded-xl border border-zinc-100 bg-white p-4 cursor-pointer active:scale-[0.97] transition-transform text-center" onclick="checkRightNow(\\''+a.id+'\\')"><div class="flex justify-center"><i data-lucide="'+a.icon+'" class="w-6 h-6 text-zinc-700"></i></div><span class="text-sm font-medium text-zinc-900 mt-2 block">'+a.name+'</span></div>').join('')}
    </div>
    <p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-6">วันดีสัปดาห์นี้</p>
    <div class="rounded-2xl border border-zinc-100 bg-white p-4">
      <div id="timing-week"><div class="flex items-center justify-center py-6"><div class="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div></div>
    </div>
    <p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-6">ฤกษ์ยาม</p>
    <div class="rounded-2xl border border-zinc-100 bg-white p-4 cursor-pointer active:scale-[0.98] transition-transform" onclick="quickFeature('auspicious-time')">
      <div class="flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4 text-zinc-700"></i><span class="font-semibold text-zinc-900">หาฤกษ์สำหรับสัปดาห์นี้</span></div>
      <p class="text-sm text-zinc-500 mt-1">วันและเวลาที่ดีที่สุด</p>
    </div>
  </div>\`);
  loadTimingWeek();
}

async function loadTimingWeek(){
  const el=$('timing-week');
  if(!el)return;
  try{
    const res=await api('/api/feature/auspicious-time',{});
    if(res.result){el.innerHTML='<p class="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">'+esc(res.result)+'</p>';if(typeof lucide!=='undefined')lucide.createIcons();}
    else{el.innerHTML='<p class="text-zinc-400 text-sm">ไม่สามารถโหลดข้อมูลได้</p>';}
  }catch(e){el.innerHTML='<p class="text-zinc-400 text-sm">ลองใหม่อีกครั้ง</p>';}
}

const DRAWER_ICONS={call:'phone',text:'send',sign:'file-signature',present:'presentation',buy:'credit-card',reject:'x-circle'};

async function checkRightNow(actionId,regenerate){
  const actionNames={call:'โทรหาคนสำคัญ',text:'ส่งข้อความสำคัญ',sign:'เซ็นสัญญา',present:'พรีเซนต์/ประชุม',buy:'ตัดสินใจซื้อใหญ่',reject:'ปฏิเสธคน'};
  const actionName=actionNames[actionId]||actionId;
  if(regenerate){
    updateDrawer(SPINNER_HTML.replace('พี่ดาวกำลังทำนาย','พี่ดาวกำลังดูฤกษ์'));
  } else {
    openDrawer(SPINNER_HTML.replace('พี่ดาวกำลังทำนาย','พี่ดาวกำลังดูฤกษ์'));
  }
  try{
    const body={action:actionId};
    if(regenerate)body._regenerate=true;
    const res=await api('/api/feature/timing/right-now',body);
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,'timing-right-now',actionName);
    } else if(res.result){
      renderDrawerResult(actionId,actionName,res.result,!!res.cached);
    } else {
      renderDrawerResult(actionId,actionName,'เกิดข้อผิดพลาด ลองใหม่',false);
    }
  }catch(e){if(isDrawerActive())renderDrawerResult(actionId,actionName,'เกิดข้อผิดพลาด: '+e.message,false);}
}

function renderDrawerResult(actionId,actionName,result,cached){
  const icon=DRAWER_ICONS[actionId]||'clock';
  const cacheBadge=cached?'<span class="text-[11px] text-zinc-400 ml-2">(ดวงวันนี้)</span>':'';
  updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-2"><i data-lucide="'+icon+'" class="w-5 h-5 text-zinc-900"></i><h3 class="font-semibold text-zinc-900">'+esc(actionName)+cacheBadge+'</h3></div><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">'+esc(result)+'</div><div class="flex gap-2 mt-4"><button class="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5" onclick="checkRightNow(\\''+actionId+'\\',true)"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> ทำนายใหม่</button><button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
}

// ===================== TAB 3: ASK =====================

function renderAsk(){
  currentScreen='ask';
  showScreen(\`<div class="px-5 pt-6 pb-24">
    <div class="mb-4">
      <h1 class="text-xl font-bold text-zinc-900 flex items-center gap-2"><i data-lucide="message-circle" class="w-5 h-5 text-zinc-900"></i> ASK</h1>
      <p class="text-sm text-zinc-500 mt-1">ถามอะไรก็ได้ พี่ดาวตอบทุกข้อ</p>
    </div>
    <div class="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 cursor-pointer active:scale-[0.98] transition-transform mb-4" onclick="loadTak()">
      <div class="flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4 text-zinc-300"></i><span class="font-semibold text-white text-sm">ทัก (Tak) — ข้อความจากพี่ดาววันนี้</span></div>
      <p class="text-xs text-zinc-400 mt-1">แตะเพื่อดูทักของวันนี้</p>
    </div>
    <div class="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
      <div class="px-4 py-3 border-b border-zinc-100 text-center"><p class="text-sm text-zinc-500">ถามเรื่องดวงชะตา ความรัก การงาน หรืออะไรก็ได้</p></div>
      <div class="grid grid-cols-2 gap-2 p-3">
        <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="askQuick('ความรักเป็นยังไง')"><i data-lucide="heart" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-sm font-medium text-zinc-900 mt-1 block">ความรัก</span></div>
        <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="askQuick('การงานเป็นยังไง')"><i data-lucide="briefcase" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-sm font-medium text-zinc-900 mt-1 block">การงาน</span></div>
        <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="askQuick('การเงินเป็นยังไง')"><i data-lucide="coins" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-sm font-medium text-zinc-900 mt-1 block">การเงิน</span></div>
        <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="askQuick('สุขภาพเป็นยังไง')"><i data-lucide="heart-pulse" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-sm font-medium text-zinc-900 mt-1 block">สุขภาพ</span></div>
      </div>
    </div>
    <div class="mt-4">
      <div class="flex items-center justify-between mb-2"><h3 class="text-sm font-semibold text-zinc-900">คุยกับพี่ดาว</h3><button class="text-xs text-zinc-500 font-medium flex items-center gap-1" onclick="openFullChat()"><i data-lucide="maximize-2" class="w-3 h-3"></i> แชทเต็ม</button></div>
      <div class="flex gap-2"><input id="ask-input" placeholder="พิมพ์คำถาม..." class="flex-1 px-4 py-2.5 rounded-full border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400" onkeydown="if(event.key==='Enter')askQuestion()"><button class="px-4 py-2.5 rounded-full bg-zinc-900 text-white font-semibold text-sm" onclick="askQuestion()">ถาม</button></div>
    </div>
  </div>\`);
  updateNav();
}

function askQuick(question){$('ask-input').value=question;askQuestion();}

async function askQuestion(){
  const input=$('ask-input');
  if(!input)return;
  const text=input.value.trim();
  if(!text)return;
  input.value='';
  openDrawer(SPINNER_HTML.replace('พี่ดาวกำลังทำนาย','พี่ดาวกำลังตอบ'));
  try{
    const quotaRes=await api('/api/feature/quota',null,'GET');
    if(!isDrawerActive())return;
    if(quotaRes.used>=quotaRes.limit){
      updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-zinc-900">ขออภัยค่ะ</h3><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed">ข้อความวันนี้ใช้หมดแล้ว — กลับมาใหม่พรุ่งนี้นะคะ</div><div class="flex gap-2 mt-4"><button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
      return;
    }
    const res=await api('/api/feature/chat',{message:text});
    if(!isDrawerActive())return;
    renderDrawerText('คำตอบ',res.result||res.error||'เกิดข้อผิดพลาด');
  }catch(e){
    if(isDrawerActive())renderDrawerText('คำตอบ','เกิดข้อผิดพลาด: '+e.message);
  }
}

function renderDrawerText(title,text){
  updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-zinc-900">'+esc(title)+'</h3><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">'+esc(text)+'</div><div class="flex gap-2 mt-4"><button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
}

async function loadTak(regenerate){
  if(regenerate){
    updateDrawer(SPINNER_HTML.replace('พี่ดาวกำลังทำนาย','กำลังโหลดทัก...'));
  } else {
    openDrawer(SPINNER_HTML.replace('พี่ดาวกำลังทำนาย','กำลังโหลดทัก...'));
  }
  try{
    const body=regenerate?{_regenerate:true}:{};
    const res=await api('/api/feature/tak',body,'POST');
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,'tak','ทัก (Tak)');
    } else {
      renderDrawerResult2('tak','ทัก (Tak)',res.result||'ไม่มีข้อความวันนี้',!!res.cached);
    }
  }catch(e){
    if(isDrawerActive())renderDrawerResult2('tak','ทัก (Tak)','เกิดข้อผิดพลาด ลองใหม่',false);
  }
}

function renderDrawerResult2(feature,title,result,cached){
  if(!isDrawerActive())return;
  const iconMap={tak:'sparkles','daily-reading':'sun','weekly-reading':'moon','birth-chart':'scan','bad-year':'alert-triangle','auspicious-time':'calendar',compatibility:'heart-handshake'};
  const icon=iconMap[feature]||'sparkles';
  const cacheBadge=cached?'<span class="text-[11px] text-zinc-400 ml-2">(ดวงวันนี้)</span>':'';
  const cacheableFeatures=['daily-reading','weekly-reading','birth-chart','bad-year','auspicious-time','timing-right-now','tak','compatibility'];
  const showRegen=cacheableFeatures.includes(feature);
  let regenBtn='';
  if(showRegen){
    if(feature==='tak'){
      regenBtn='<button class="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5" onclick="loadTak(true)"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> ทำนายใหม่</button>';
    } else {
      regenBtn='<button class="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5" onclick="quickFeature(\\''+feature+'\\',true)"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> ทำนายใหม่</button>';
    }
  }
  updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-2"><i data-lucide="'+icon+'" class="w-5 h-5 text-zinc-900"></i><h3 class="font-semibold text-zinc-900">'+esc(title)+cacheBadge+'</h3></div><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">'+esc(result)+'</div><div class="flex gap-2 mt-4">'+regenBtn+'<button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
}

async function openFullChat(){
  currentScreen='ask';
  showScreen(\`<div class="px-5 pt-4 pb-24">
    <div class="flex flex-col h-[calc(100vh-180px)]">
      <div class="flex-1 overflow-y-auto py-2 flex flex-col gap-3" id="chat-msgs">
        <div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-zinc-100 text-zinc-900 text-sm leading-relaxed rounded-bl-sm border border-zinc-200">สวัสดีค่ะ วันนี้อยากรู้อะไร ถามพี่ดาวได้เลยค่ะ!</div>
      </div>
      <div class="flex gap-2 py-2 border-t border-zinc-100">
        <input id="chat-input" placeholder="พิมพ์ข้อความ..." class="flex-1 px-4 py-2.5 rounded-full border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400" onkeydown="if(event.key==='Enter')sendChat()">
        <button class="px-4 py-2.5 rounded-full bg-zinc-900 text-white font-semibold text-sm" onclick="sendChat()">ส่ง</button>
        <button class="px-3 py-2.5 rounded-full border border-zinc-200 text-zinc-400" onclick="clearChatHistory()" title="ล้างแชท"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    </div>
  </div>\`);
  updateNav();
  if(chatHistory.length>0){
    const msgs=$('chat-msgs');
    const start=Math.max(0,chatHistory.length-MAX_CHAT_MESSAGES);
    for(let i=start;i<chatHistory.length;i++){
      msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed '+(chatHistory[i].role==='user'?'bg-zinc-900 text-white rounded-br-sm':'bg-zinc-100 text-zinc-900 rounded-bl-sm border border-zinc-200')+'">'+esc(chatHistory[i].content)+'</div>';
    }
  } else {
    try{
      const res=await api('/api/feature/chat-history',null,'GET');
      if(res.messages&&res.messages.length>0){
        chatHistory=res.messages.slice(-MAX_CHAT_MESSAGES);
        const msgs=$('chat-msgs');
        msgs.innerHTML='';
        chatHistory.forEach(m=>{
          msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed '+(m.role==='user'?'bg-zinc-900 text-white rounded-br-sm':'bg-zinc-100 text-zinc-900 rounded-bl-sm border border-zinc-200')+'">'+esc(m.content)+'</div>';
        });
      }
    }catch(e){}
  }
  scrollChat();
  if(typeof lucide!=='undefined')lucide.createIcons();
}

const MAX_CHAT_MESSAGES=100;

function clearChatHistory(){if(confirm('ล้างประวัติแชท?')){chatHistory=[];openFullChat();}}

function scrollChat(){setTimeout(()=>{const el=$('chat-msgs');if(el)el.scrollTop=el.scrollHeight},50)}

async function sendChat(){
  const input=$('chat-input');
  const text=input.value.trim();
  if(!text)return;
  input.value='';
  chatHistory.push({role:'user',content:text});
  const msgs=$('chat-msgs');
  msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-zinc-900 text-white text-sm leading-relaxed rounded-br-sm">'+esc(text)+'</div>';
  msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-zinc-100 text-zinc-500 text-sm rounded-bl-sm border border-zinc-200" id="typing">พี่ดาวกำลังคิด...<span class="inline-block animate-pulse">.</span><span class="inline-block animate-pulse" style="animation-delay:.2s">.</span><span class="inline-block animate-pulse" style="animation-delay:.4s">.</span></div>';
  scrollChat();
  try{
    const res=await api('/api/feature/chat',{message:text});
    const typing=$('typing');if(typing)typing.remove();
    chatHistory.push({role:'ai',content:res.result||res.error||'Error'});
    while(chatHistory.length>MAX_CHAT_MESSAGES)chatHistory.shift();
    msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-zinc-100 text-zinc-900 text-sm leading-relaxed rounded-bl-sm border border-zinc-200">'+esc(res.result||res.error||'เกิดข้อผิดพลาด')+'</div>';
  }catch(e){
    const typing=$('typing');if(typing)typing.remove();
    msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-zinc-100 text-red-500 text-sm rounded-bl-sm border border-zinc-200">เกิดข้อผิดพลาด ลองใหม่นะคะ</div>';
  }
  scrollChat();
}

// ===================== TAB 4: FRIENDS =====================

function renderFriends(){
  currentScreen='friends';
  showScreen(\`<div class="px-5 pt-6 pb-24">
    <div class="mb-5">
      <h1 class="text-xl font-bold text-zinc-900 flex items-center gap-2"><i data-lucide="heart-handshake" class="w-5 h-5 text-zinc-900"></i> FRIENDS</h1>
      <p class="text-sm text-zinc-500 mt-1">ดูดวงคู่ เช็คความเข้ากัน</p>
    </div>
    <div class="flex bg-zinc-100 rounded-xl p-1 mb-5"><button class="flex-1 py-2 rounded-lg text-sm font-semibold text-center cursor-pointer bg-white text-zinc-900 shadow-sm" id="mode-friend" onclick="setFriendsMode('friend')">เพื่อน</button><button class="flex-1 py-2 rounded-lg text-sm font-semibold text-center cursor-pointer text-zinc-500" id="mode-soulmate" onclick="setFriendsMode('soulmate')">คนรู้ใจ</button></div>
    <div class="rounded-2xl border border-zinc-100 bg-white p-4">
      <h3 class="font-semibold text-zinc-900 flex items-center gap-2 mb-1"><i data-lucide="scan" class="w-4 h-4 text-zinc-700"></i> เปรียบเทียบดวงชะตา</h3>
      <p class="text-sm text-zinc-500 mb-3">ใส่วันเกิดของอีกคนเพื่อดูความเข้ากัน</p>
      <div class="flex flex-col gap-3">
        <div><label class="text-sm text-zinc-500 font-medium">วันเกิดอีกคน (DD/MM/YYYY)</label><input id="friend-dob" placeholder="เช่น 15/03/1998" class="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400"></div>
        <button class="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-base" onclick="checkCompatibility()">เช็คความเข้ากัน</button>
      </div>
    </div>
    <p class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 mt-6">ฟีเจอร์เพิ่มเติม</p>
    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-zinc-100 bg-white p-4 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="quickFeature('birth-chart')"><div class="flex justify-center"><i data-lucide="scan" class="w-6 h-6 text-zinc-700"></i></div><span class="text-sm font-medium text-zinc-900 mt-2 block">ผูกดวงตัวเอง</span></div>
      <div class="rounded-xl border border-zinc-100 bg-white p-4 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="askQuick('เข้ากันไหมกับคนเกิดวันไหน')"><div class="flex justify-center"><i data-lucide="heart" class="w-6 h-6 text-zinc-700"></i></div><span class="text-sm font-medium text-zinc-900 mt-2 block">ดวงคู่แบบถาม</span></div>
    </div>
  </div>\`);
  updateNav();
}

function setFriendsMode(mode){
  $('mode-friend').classList.toggle('bg-white',mode==='friend');
  $('mode-friend').classList.toggle('shadow-sm',mode==='friend');
  $('mode-friend').classList.toggle('text-zinc-900',mode==='friend');
  $('mode-friend').classList.toggle('text-zinc-500',mode!=='friend');
  $('mode-soulmate').classList.toggle('bg-white',mode==='soulmate');
  $('mode-soulmate').classList.toggle('shadow-sm',mode==='soulmate');
  $('mode-soulmate').classList.toggle('text-zinc-900',mode==='soulmate');
  $('mode-soulmate').classList.toggle('text-zinc-500',mode!=='soulmate');
}

async function checkCompatibility(){
  const dobInput=$('friend-dob');
  if(!dobInput)return;
  const dob=dobInput.value.trim();
  if(!dob){alert('กรุณาใส่วันเกิด');return}
  openDrawer(SPINNER_HTML.replace('พี่ดาวกำลังทำนาย','กำลังเช็คดวงคู่'));
  try{
    const body={otherBirthDate:dob};
    const res=await api('/api/feature/compatibility',body);
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,'compatibility','FRIENDS: ดวงคู่');
    } else if(res.result){
      renderDrawerResult2('compatibility','FRIENDS: ดวงคู่',res.result,!!res.cached);
    } else {
      renderDrawerResult2('compatibility','FRIENDS: ดวงคู่',res.error||'ไม่มีผลลัพธ์',false);
    }
  }catch(e){if(isDrawerActive())renderDrawerResult2('compatibility','FRIENDS','เกิดข้อผิดพลาด: '+e.message,false)}
}

// ===================== PROFILE (YOU) =====================

function openProfile(){
  currentScreen='you';
  const panel=$('drawerBody');
  const avatarHtml=userPic?'<img src="'+esc(userPic)+'" class="w-16 h-16 rounded-full object-cover border-2 border-zinc-200" onerror="this.style.display=\\'none\\'">':'<div class="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center"><i data-lucide="sparkles" class="w-7 h-7 text-white"></i></div>';
  panel.innerHTML=\`<div class="px-4 pt-2 pb-8">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-bold text-zinc-900">YOU</h2>
      <button class="text-sm text-zinc-500 font-medium" onclick="closeDrawer()">ปิด</button>
    </div>
    <div class="text-center mb-5">
      <div class="flex justify-center mb-2">\${avatarHtml}</div>
      <h2 class="font-bold text-zinc-900">\${esc(userName||'User')}</h2>
      <p class="text-xs text-zinc-500">โปรไฟล์ดวงชะตา</p>
    </div>
    <div class="space-y-3">
      <div class="rounded-2xl border border-zinc-100 bg-white p-4">
        <h3 class="font-semibold text-zinc-900 flex items-center gap-2 mb-2"><i data-lucide="scan" class="w-4 h-4 text-zinc-700"></i> ดวงชะตา</h3>
        <p class="text-sm text-zinc-500 mb-3">ดูแผนภูมิดวงชะตาแบบเต็ม</p>
        <button class="w-full py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm" onclick="closeDrawer();quickFeature('birth-chart')">ดูผูกดวง</button>
      </div>
      <div class="rounded-2xl border border-zinc-100 bg-white p-4">
        <h3 class="font-semibold text-zinc-900 flex items-center gap-2 mb-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-zinc-700"></i> ปีชง</h3>
        <p class="text-sm text-zinc-500 mb-3">ตรวจสอบว่าปีนี้ชงไหม</p>
        <button class="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium text-sm" onclick="closeDrawer();quickFeature('bad-year')">ตรวจปีชง</button>
      </div>
      <div class="rounded-2xl border border-zinc-100 bg-white p-4">
        <h3 class="font-semibold text-zinc-900 flex items-center gap-2 mb-2"><i data-lucide="file-text" class="w-4 h-4 text-zinc-700"></i> Memory</h3>
        <p class="text-sm text-zinc-500 mb-3">ข้อมูลที่พี่ดาวจำได้เกี่ยวกับคุณ</p>
        <button class="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium text-sm" onclick="viewMemoryProfile()">ดู Memory</button>
      </div>
      <div class="rounded-2xl border border-zinc-200 bg-white p-4">
        <h3 class="font-semibold text-zinc-900 flex items-center gap-2 mb-3"><i data-lucide="gem" class="w-4 h-4 text-zinc-700"></i> ฟีเจอร์เพิ่มเติม</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="closeDrawer();quickFeature('tarot')"><i data-lucide="layers" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-xs font-medium text-zinc-900 mt-1 block">ไพ่ทาโร่</span></div>
          <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="closeDrawer();quickFeatureWithInput('dream','เล่าฝันที่เห็นมา...')"><i data-lucide="cloud-lightning" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-xs font-medium text-zinc-900 mt-1 block">ทำนายฝัน</span></div>
          <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="closeDrawer();quickFeatureWithInput('phone-number','ใส่เบอร์โทร...')"><i data-lucide="smartphone" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-xs font-medium text-zinc-900 mt-1 block">เบอร์มงคล</span></div>
          <div class="rounded-xl border border-zinc-100 p-3 text-center cursor-pointer active:scale-[0.97] transition-transform" onclick="closeDrawer();quickFeatureWithInput('name-analysis','ใส่ชื่อที่ต้องการวิเคราะห์...')"><i data-lucide="pen-line" class="w-5 h-5 text-zinc-700 mx-auto"></i><span class="text-xs font-medium text-zinc-900 mt-1 block">ชื่อมงคล</span></div>
        </div>
      </div>
      <button class="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-500 font-medium text-sm flex items-center justify-center gap-1.5" onclick="if(confirm('ต้องการล็อกเอาท์?')){localStorage.clear();userId='';userName='';userPic='';idToken='';isOnboarded=false;closeDrawer();renderSplash()}"><i data-lucide="log-out" class="w-4 h-4"></i> ล็อกเอาท์</button>
    </div>
  </div>\`;
  openDrawer(panel.innerHTML);
}

function closeProfile(){$('drawerOverlay').classList.remove('active');$('drawerSheet').classList.remove('active');}

async function viewMemoryProfile(){
  closeDrawer();
  showScreen('<div class="flex items-center justify-center min-h-screen"><div class="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div>');
  try{
    const res=await api('/api/auth/me',null,'GET');
    navigate('today');
    setTimeout(()=>{
      openDrawer('<div class="px-4 pt-2 pb-8"><div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold text-zinc-900 flex items-center gap-2"><i data-lucide="file-text" class="w-5 h-5 text-zinc-700"></i> Memory</h2><button class="text-sm text-zinc-500 font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">'+esc(res.memory||'ยังไม่มีข้อมูล')+'</div></div>');
    },100);
  }catch(e){navigate('today')}
}

// ===================== SHARED: QUICK FEATURE (now uses drawer) =====================

async function quickFeature(feature,regenerating,actionId){
  if(regenerating){
    updateDrawer(SPINNER_HTML);
  } else {
    openDrawer(SPINNER_HTML);
  }
  try{
    const body=regenerating?{_regenerate:true}:{};
    if(actionId)body.action=actionId;
    const res=await api('/api/feature/'+feature,body);
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,feature);
    } else if(res.error){
      renderDrawerResult2(feature,'เกิดข้อผิดพลาด',res.error,false);
    } else {
      renderDrawerResult2(feature,feature,res.result||'ไม่มีผลลัพธ์',!!res.cached);
    }
  }catch(e){if(isDrawerActive())renderDrawerResult2(feature,'เกิดข้อผิดพลาด','ลองใหม่นะคะ: '+e.message,false)}
}

async function pollForResult(resultId,feature,title){
  activeResultId=resultId;
  pollAbort=false;
  const maxAttempts=60;
  for(let i=0;i<maxAttempts;i++){
    await new Promise(r=>setTimeout(r,2000));
    if(pollAbort||activeResultId!==resultId)return;
    try{
      const res=await api('/api/feature/result/'+resultId,null,'GET');
      if(pollAbort||activeResultId!==resultId)return;
      if(!isDrawerActive())return;
      if(res.status==='completed'){
        activeResultId=null;
        renderDrawerResult2(feature,title||feature,res.result||'ไม่มีผลลัพธ์',false);
        return;
      } else if(res.status==='failed'){
        activeResultId=null;
        renderDrawerResult2(feature,title||feature,'เกิดข้อผิดพลาด: '+(res.error||'โปรดลองใหม่'),false);
        return;
      }
    }catch(e){}
  }
  if(!pollAbort&&activeResultId===resultId&&isDrawerActive()){
    activeResultId=null;
    renderDrawerResult2(feature,title||feature,'ใช้เวลานานกว่าปกติ ลองกลับมาดูผลในภายหลังนะคะ',false);
  }
}

function quickFeatureWithInput(feature,placeholder){
  showScreen('<div class="px-5 pt-6 pb-24"><div class="flex items-center gap-3 mb-4"><button class="p-1 rounded-lg border border-zinc-200" onclick="navigate(\\'today\\')"><i data-lucide="arrow-left" class="w-5 h-5 text-zinc-500"></i></button><h2 class="text-lg font-semibold text-zinc-900">'+feature+'</h2></div><p class="text-sm text-zinc-500 mb-4">'+placeholder+'</p><div class="flex flex-col gap-3"><div><textarea id="feat-input" placeholder="'+placeholder+'" rows="3" class="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-base focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 resize-vertical"></textarea></div><button class="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold text-base" onclick="submitFeatureInput(\\''+feature+'\\')">ทำนายเลย</button></div></div>');
}

async function submitFeatureInput(feature){
  const input=$('feat-input');
  const text=input?input.value.trim():'';
  if(!text){alert('กรุณาใส่ข้อมูล');return}
  openDrawer(SPINNER_HTML);
  try{
    const body=feature==='friend-chart'?{message:text,otherBirthDate:text}:{message:text};
    const res=await api('/api/feature/'+feature,body);
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,feature);
    } else if(res.error){
      renderDrawerResult2(feature,'เกิดข้อผิดพลาด',res.error,false);
    } else {
      renderDrawerResult2(feature,res.result||'ไม่มีผลลัพธ์',!!res.cached);
    }
  }catch(e){if(isDrawerActive())renderDrawerResult2(feature,'เกิดข้อผิดพลาด',e.message,false)}
}

function showResult(feature,title,result,cached){
  const cacheableFeatures=['daily-reading','weekly-reading','birth-chart','bad-year','auspicious-time','timing-right-now','compatibility','tak'];
  const showRegen=cacheableFeatures.includes(feature);
  const cacheBadge=cached?'<span class="text-[11px] text-zinc-400 ml-2">(ดวงวันนี้)</span>':'';
  showScreen(\`<div class="px-5 pt-6 pb-24">
    <div class="flex items-center gap-3 mb-4">
      <button class="p-1 rounded-lg border border-zinc-200" onclick="navigate('today')"><i data-lucide="arrow-left" class="w-5 h-5 text-zinc-500"></i></button>
      <h2 class="text-lg font-semibold text-zinc-900">\${title||feature}\${cacheBadge}</h2>
    </div>
    <div class="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">\${esc(result)}</div>
    <div class="flex gap-2 mt-3">
      <button class="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-500 text-sm" onclick="this.classList.add('bg-zinc-200','text-zinc-700');this.classList.remove('text-zinc-500')">ตรงมาก</button>
      <button class="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-500 text-sm" onclick="this.classList.add('bg-zinc-200','text-zinc-700');this.classList.remove('text-zinc-500')">ไม่ค่อยตรง</button>
      <button class="flex-1 py-2 rounded-lg border border-zinc-200 text-zinc-500 text-sm" onclick="this.classList.add('bg-zinc-300','text-zinc-800');this.classList.remove('text-zinc-500')">งง</button>
    </div>
    <div class="flex gap-2 mt-3">
      \${showRegen?'<button class="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5" onclick="quickFeature(\\''+feature+'\\',true)"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> ทำนายใหม่</button>':''}
      <button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="navigate('today')">กลับหน้าหลัก</button>
    </div>
  </div>\`);
}

async function init(){
  if(userId&&isOnboarded){
    try{
      const me=await api('/api/auth/me',null,'GET');
      if(me){
        if(me.name)userName=me.name;
        if(me.picture_url)userPic=me.picture_url;
        localStorage.setItem('mor_doo_userName',userName||'');
        localStorage.setItem('mor_doo_userPic',userPic||'');
      }
    }catch(e){}
    navigate('today');
  }
  else{renderSplash()}
}
init();
</script>
</body>
</html>`;
}