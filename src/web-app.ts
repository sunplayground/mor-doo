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
let userTier=localStorage.getItem('mor_doo_userTier')||'free';
function isPremium(){return userTier==='premium';}
let chatHistory=[];
let idToken=localStorage.getItem('mor_doo_idToken')||'';
let currentScreen='splash';
let activeResultId=null;
let pollAbort=false;
let drawerContext=null;
let _todayData=null;

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

function md(text){
  if(!text)return'';
  let t=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  t=t.replace(/^### (.+)$/gm,'<h3 class="text-sm font-bold text-zinc-900 mt-3 mb-1">$1</h3>');
  t=t.replace(/^## (.+)$/gm,'<h2 class="text-base font-bold text-zinc-900 mt-4 mb-1">$1</h2>');
  t=t.replace(/^# (.+)$/gm,'<h1 class="text-lg font-bold text-zinc-900 mt-4 mb-2">$1</h1>');
  t=t.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g,'<strong><em>$1</em></strong>');
  t=t.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
  t=t.replace(/\\*(.+?)\\*/g,'<em>$1</em>');
  t=t.replace(/^---+$/gm,'<hr class="border-zinc-200 my-3">');
  t=t.replace(/((?:^[ \\t]*[-*] .+\\n?)+)/gm,function(block){
    const items=block.trim().split('\\n').map(function(line){
      return '<li class="ml-4 list-disc text-zinc-700">'+line.replace(/^[ \\t]*[-*] /,'')+'</li>';
    });
    return '<ul class="space-y-0.5 my-2">'+items.join('')+'</ul>';
  });
  t=t.replace(/((?:^[ \\t]*\\d+\\. .+\\n?)+)/gm,function(block){
    const items=block.trim().split('\\n').map(function(line){
      return '<li class="ml-4 list-decimal text-zinc-700">'+line.replace(/^[ \\t]*\\d+\\. /,'')+'</li>';
    });
    return '<ol class="space-y-0.5 my-2">'+items.join('')+'</ol>';
  });
  t=t.replace(/\\n\\n+/g,'</p><p class="mt-2">');
  t='<p>'+t+'</p>';
  t=t.replace(/\\n/g,'<br>');
  t=t.replace(/<p[^>]*><\\/p>/g,'');
  return t;
}

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
    if(res.userId){userId=res.userId;userName=res.user?.name||profile.displayName;userPic=res.user?.pictureUrl||profile.pictureUrl||'';userTier=res.tier||'free';localStorage.setItem('mor_doo_userId',userId);localStorage.setItem('mor_doo_userName',userName);localStorage.setItem('mor_doo_userPic',userPic);localStorage.setItem('mor_doo_userTier',userTier)}
    if(res.onboarded){isOnboarded=true;localStorage.setItem('mor_doo_onboarded','1');navigate('today')}else{renderOnboarding(0)}
  }catch(e){console.error(e);showScreen('<div class="flex flex-col items-center justify-center min-h-screen text-center px-8"><h2 class="text-lg font-semibold">เกิดข้อผิดพลาด</h2><p class="text-sm text-zinc-500 mt-2">'+esc(e.message)+'</p><button class="mt-4 px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600" onclick="renderSplash()">ลองใหม่</button></div>')}
}

function skipLogin(){idToken='';renderOnboarding(0)}

// ===================== TAB 1: TODAY =====================

async function renderToday(){
  currentScreen='today';
  const now=new Date();
  const thaiDate=now.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'});

  showScreen(\`<div class="pb-24">
    <div class="px-5 pt-6 pb-4 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-black text-zinc-900 tracking-tight">TODAY</h1>
        <p class="text-xs text-zinc-400 mt-0.5">\${thaiDate}</p>
      </div>
      <button class="relative p-2 mt-1" onclick="openProfile()">
        <i data-lucide="bell" class="w-5 h-5 text-zinc-500"></i>
        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>
    </div>
    <div id="today-content" class="px-5"><div class="flex items-center justify-center py-16"><div class="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div></div></div>
  </div>\`);

  try{
    const res=await api('/api/feature/today',null,'GET');
    const chips=res.chips||null;
    const [weekRes,actionsRes,timelineRes]=await Promise.all([
      api('/api/feature/week-energy',null,'GET').catch(()=>({week:[]})),
      api('/api/feature/today-actions',null,'GET').catch(()=>({actions:[]})),
      api('/api/feature/day-timeline',chips?{today_chips:chips}:{},'POST').catch(()=>({segments:[],peakStart:'',peakEnd:''})),
    ]);
    // Normalize shapes in case API returns unexpected structure
    if(!actionsRes||!Array.isArray(actionsRes.actions))actionsRes.actions=[];
    if(!weekRes||!Array.isArray(weekRes.week))weekRes.week=[];
    if(res.headline){
      _todayData=res;
      $('today-content').innerHTML=renderTodayStructured(res,weekRes,actionsRes,timelineRes);
    } else if(res.result){
      $('today-content').innerHTML=renderTodayFallback(res.result);
    } else {
      const fallback=await api('/api/feature/daily-reading',{});
      $('today-content').innerHTML=renderTodayFallback(fallback.result||fallback.error||'ไม่สามารถโหลดดวงได้');
    }
  }catch(e){
    try{
      const fallback=await api('/api/feature/daily-reading',{});
      $('today-content').innerHTML=renderTodayFallback(fallback.result||fallback.error||'ไม่สามารถโหลดดวงได้');
    }catch(e2){
      $('today-content').innerHTML='<p class="text-zinc-400 text-center py-8">เกิดข้อผิดพลาด ลองใหม่นะคะ</p>';
    }
  }
  if(typeof lucide!=='undefined')lucide.createIcons();
}

async function quickFeatureFromToday(){
  const chips=_todayData&&_todayData.chips;
  openDrawer(SPINNER_HTML);
  try{
    const body=chips?{today_chips:chips}:{};
    const res=await api('/api/feature/daily-reading',body);
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,'daily-reading');
    } else if(res.error){
      renderDrawerResult2('daily-reading','ดวงวันนี้',res.error,false);
    } else {
      renderDrawerResult2('daily-reading','daily-reading',res.result||'ไม่มีผลลัพธ์',!!res.cached);
    }
  }catch(e){if(isDrawerActive())renderDrawerResult2('daily-reading','ดวงวันนี้','ลองใหม่นะคะ: '+e.message,false)}
}

async function quickFeatureFromCompass(){
  const compass=_todayData&&(_todayData.monthTheme||_todayData.yearTheme)?{monthTheme:_todayData.monthTheme||'',yearTheme:_todayData.yearTheme||''}:null;
  openDrawer(SPINNER_HTML);
  try{
    const body=compass?{compass_context:compass}:{};
    const res=await api('/api/feature/weekly-reading',body);
    if(!isDrawerActive())return;
    if(res.resultId&&res.status==='pending'){
      await pollForResult(res.resultId,'weekly-reading');
    } else if(res.error){
      renderDrawerResult2('weekly-reading','ดวงสัปดาห์',res.error,false);
    } else {
      renderDrawerResult2('weekly-reading','weekly-reading',res.result||'ไม่มีผลลัพธ์',!!res.cached);
    }
  }catch(e){if(isDrawerActive())renderDrawerResult2('weekly-reading','ดวงสัปดาห์','ลองใหม่นะคะ: '+e.message,false)}
}

function renderTodayFallback(dailyText){
  return '<div class="space-y-4"><div class="rounded-2xl bg-zinc-900 p-5 cursor-pointer active:scale-[0.98] transition-transform" onclick="quickFeature(\\'daily-reading\\')"><div class="flex items-center gap-2 mb-2"><i data-lucide="sparkles" class="w-4 h-4 text-zinc-300"></i><span class="font-semibold text-white text-sm">ดวงวันนี้</span></div><p class="text-sm text-zinc-300 leading-relaxed">'+esc(dailyText.substring(0,250))+'</p><p class="text-xs text-zinc-500 mt-3">แตะเพื่อดูเต็ม →</p></div>'+renderTodayCyclesAndInsight(null,[],null)+'</div>';
}

function colorNameToHex(name){
  if(!name)return'#888888';
  const map={'ส้ม':'#FF8C00','แดง':'#E74C3C','ขาว':'#E8E8E8','เงิน':'#BDC3C7','ชมพูเข้ม':'#E91E63','ชมพู':'#F06292','เขียวมรกต':'#1ABC9C','เขียว':'#27AE60','เหลือง':'#F39C12','ทอง':'#D4AC0D','ฟ้าอมเขียว':'#5DADE2','ฟ้า':'#3498DB','น้ำเงิน':'#2980B9','ม่วง':'#8E44AD','ดำ':'#2C3E50'};
  for(const[k,v]of Object.entries(map)){if(name.includes(k))return v;}
  return'#888888';
}

function renderTodayStructured(data,weekData,actionsData,timelineData){
  const headline=data.headline||'';
  const chips=data.chips;
  const monthTheme=data.monthTheme||'';
  const yearTheme=data.yearTheme||'';
  const cycles=data.cycles||[];
  const insight=data.insight;

  let html='<div class="space-y-4">';

  // Hero card — gradient background with moon illustration
  html+='<div style="background:linear-gradient(135deg,#EDE7F6 0%,#E8EAF6 55%,#F3E5F5 100%)" class="rounded-2xl p-5 relative overflow-hidden cursor-pointer active:scale-[0.99] transition-transform" onclick="quickFeatureFromToday()">';
  html+='<div class="absolute top-3 right-4 text-5xl leading-none select-none opacity-90" style="filter:drop-shadow(0 2px 6px rgba(103,58,183,0.18))">🌙</div>';
  html+='<p class="text-[17px] font-bold text-zinc-800 leading-snug pr-14 mb-4">'+esc(headline)+'</p>';
  if(chips){
    html+='<div class="flex gap-2 flex-wrap">';
    if(chips.color){
      const hex=colorNameToHex(chips.color);
      html+='<div class="flex items-center gap-1.5 rounded-xl px-3 py-2" style="background:rgba(255,255,255,0.72);backdrop-filter:blur(8px)">';
      html+='<div class="relative w-3 h-3 flex-shrink-0"><div class="absolute inset-0 rounded-full animate-ping opacity-50" style="background:'+hex+'"></div><div class="relative w-3 h-3 rounded-full" style="background:'+hex+';box-shadow:0 0 0 2px rgba(0,0,0,0.08)"></div></div>';
      html+='<div><p class="text-[9px] text-zinc-400 leading-none mb-0.5">สีมงคล</p><p class="text-xs font-semibold text-zinc-700 leading-none">'+esc(chips.color)+'</p></div></div>';
    }
    if(chips.number){
      html+='<div class="flex items-center gap-1.5 rounded-xl px-3 py-2" style="background:rgba(255,255,255,0.72);backdrop-filter:blur(8px)">';
      html+='<i data-lucide="hash" class="w-3.5 h-3.5 text-zinc-400 flex-shrink-0"></i>';
      html+='<div><p class="text-[9px] text-zinc-400 leading-none mb-0.5">เลขมงคล</p><p class="text-xs font-semibold text-zinc-700 leading-none">'+esc(chips.number)+'</p></div></div>';
    }
    if(chips.goldenTime){
      html+='<div class="flex items-center gap-1.5 rounded-xl px-3 py-2" style="background:rgba(255,255,255,0.72);backdrop-filter:blur(8px)">';
      html+='<i data-lucide="clock" class="w-3.5 h-3.5 text-zinc-400 flex-shrink-0"></i>';
      html+='<div><p class="text-[9px] text-zinc-400 leading-none mb-0.5">เวลามงคล</p><p class="text-xs font-semibold text-zinc-700 leading-none">'+esc(chips.goldenTime)+'</p></div></div>';
    }
    html+='</div>';
  }
  html+='</div>';

  html+=renderWeekStrip(weekData);
  html+=renderTodayActions(actionsData);
  html+=renderDayTimeline(timelineData);
  const compass=(monthTheme||yearTheme)?{monthTheme,yearTheme}:null;
  html+=renderTodayCyclesAndInsight(compass,cycles,insight);
  html+='</div>';
  return html;
}

function renderWeekStrip(weekData){
  const thaiDays=['อา','จ','อ','พ','พฤ','ศ','ส'];
  const now=new Date(Date.now()+7*3600*1000);
  const todayUTC=new Date(now.toISOString().split('T')[0]+'T00:00:00Z');

  // Build lookup from AI data
  const energyMap={};
  if(weekData&&weekData.week){
    weekData.week.forEach(function(e){energyMap[e.date]=e.energy;});
  }

  function dayEnergy(d){
    const dateKey=d.toISOString().split('T')[0];
    const aiEnergy=energyMap[dateKey];
    if(aiEnergy==='good')return{dot:'#22C55E'};
    if(aiEnergy==='moderate')return{dot:'#F59E0B'};
    if(aiEnergy==='challenging')return{dot:'#EF4444'};
    // fallback hash
    const seed=(d.getUTCFullYear()*13+d.getUTCMonth()+1)*31+d.getUTCDate();
    const h=((seed^(seed>>>16))*0x45d9f3b)&0x7fffffff;
    const v=h%10;
    if(v>=7)return{dot:'#EF4444'};
    if(v>=4)return{dot:'#F59E0B'};
    return{dot:'#22C55E'};
  }

  const days=[];
  for(let i=-1;i<=3;i++){
    const d=new Date(todayUTC);
    d.setUTCDate(todayUTC.getUTCDate()+i);
    days.push(d);
  }

  let html='<div class="rounded-2xl bg-white border border-zinc-100 overflow-hidden">';
  html+='<div class="flex items-stretch px-2 pt-3 pb-2 gap-1">';
  days.forEach(function(d,i){
    const isToday=i===1;
    const energy=dayEnergy(d);
    const dayName=thaiDays[d.getUTCDay()];
    const dateNum=d.getUTCDate();
    if(isToday){
      html+='<div class="flex-1 flex flex-col items-center gap-0.5 rounded-2xl py-2.5 px-1" style="background:#312E81">';
      html+='<span class="text-[9px] font-semibold text-indigo-300 leading-none">วันนี้</span>';
      html+='<span class="text-[11px] font-semibold text-indigo-200 leading-none mt-0.5">'+dayName+'</span>';
      html+='<span class="text-xl font-black text-white leading-tight">'+dateNum+'</span>';
      html+='<div class="w-2 h-2 rounded-full mt-0.5" style="background:'+energy.dot+'"></div>';
      html+='</div>';
    } else {
      html+='<div class="flex-1 flex flex-col items-center gap-0.5 rounded-2xl py-2.5 px-1">';
      html+='<span class="text-[9px] leading-none opacity-0">·</span>';
      html+='<span class="text-[11px] font-medium text-zinc-400 leading-none mt-0.5">'+dayName+'</span>';
      html+='<span class="text-xl font-bold text-zinc-700 leading-tight">'+dateNum+'</span>';
      html+='<div class="w-2 h-2 rounded-full mt-0.5" style="background:'+energy.dot+'"></div>';
      html+='</div>';
    }
  });
  html+='</div>';

  // Link row to TIMING
  html+='<div class="mx-3 mb-3 mt-1 flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 cursor-pointer active:scale-[0.98] transition-transform" onclick="navigate(\\'timing\\')">';
  html+='<div class="flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4 text-indigo-500"></i><div><p class="text-xs font-semibold text-zinc-800">เวลาที่ดีวันนี้</p><p class="text-[10px] text-zinc-400">เช็คเวลาที่เหมาะกับแต่ละเรื่อง</p></div></div>';
  html+='<div class="flex items-center gap-1 text-indigo-600 text-xs font-semibold">ไปที่ TIMING<i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></div>';
  html+='</div>';

  html+='</div>';
  return html;
}

function renderTodayActions(actionsData){
  if(!actionsData||!actionsData.actions||actionsData.actions.length===0)return'';
  const actions=actionsData.actions;
  const updatedAt=actionsData.updatedAt||'';
  const top=actions.slice(0,3);

  const energyDot={'good':'#22C55E','moderate':'#F59E0B','bad':'#EF4444'};
  const energyLabel={'good':'ดีมาก','moderate':'ปานกลาง','bad':'ไม่ดี'};
  const energyTextColor={'good':'text-green-600','moderate':'text-amber-500','bad':'text-red-500'};

  let html='<div>';
  html+='<div class="flex items-center justify-between mb-2">';
  html+='<p class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">สิ่งที่ควรทำวันนี้</p>';
  if(updatedAt)html+='<p class="text-[10px] text-zinc-400">อัปเดต '+esc(updatedAt)+'</p>';
  html+='</div>';

  html+='<div class="rounded-2xl border border-zinc-100 bg-white overflow-hidden">';
  top.forEach(function(a,i){
    const dot=energyDot[a.energy]||'#888';
    const label=energyLabel[a.energy]||a.energy;
    const textColor=energyTextColor[a.energy]||'text-zinc-500';
    const border=i>0?'border-t border-zinc-50':'';
    html+='<div class="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-zinc-50 transition-colors '+border+'" onclick="navigate(\\'timing\\')">';
    html+='<div class="w-9 h-9 rounded-xl bg-zinc-50 flex items-center justify-center flex-shrink-0"><i data-lucide="'+esc(a.icon)+'" class="w-4.5 h-4.5 text-zinc-500"></i></div>';
    html+='<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-zinc-900 leading-tight truncate">'+esc(a.name)+'</p><p class="text-[11px] text-zinc-400 leading-tight truncate">'+esc(a.desc)+'</p></div>';
    html+='<div class="flex flex-col items-end gap-0.5 flex-shrink-0">';
    html+='<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full" style="background:'+dot+'"></div><span class="text-[11px] font-semibold '+textColor+'">'+label+'</span></div>';
    html+='<span class="text-[10px] text-zinc-400">'+esc(a.time)+'</span>';
    html+='</div>';
    html+='<i data-lucide="chevron-right" class="w-4 h-4 text-zinc-300 flex-shrink-0"></i>';
    html+='</div>';
  });
  html+='<div class="px-4 py-2.5 border-t border-zinc-50 cursor-pointer active:bg-zinc-50" onclick="navigate(\\'timing\\')">';
  html+='<p class="text-xs font-semibold text-indigo-600 text-center">ดูทั้งหมดใน TIMING ›</p>';
  html+='</div>';
  html+='</div></div>';
  return html;
}

function renderDayTimeline(tl){
  if(!tl||!tl.segments||tl.segments.length===0)return'';

  const levelColor={peak:'#7C3AED',good:'#22C55E',moderate:'#F59E0B',low:'#CBD5E1',caution:'#EF4444'};

  // Build CSS gradient from segments
  function timeToPercent(t){
    const parts=t.split(':');
    return((parseInt(parts[0])*60+parseInt(parts[1]))/(24*60)*100).toFixed(2)+'%';
  }
  const stops=[];
  tl.segments.forEach(function(s){
    const c=levelColor[s.level]||'#CBD5E1';
    stops.push(c+' '+timeToPercent(s.start));
    stops.push(c+' '+timeToPercent(s.end));
  });
  const gradient='linear-gradient(to right,'+stops.join(',')+')';

  // Current time marker position (Bangkok)
  const now=new Date(Date.now()+7*3600*1000);
  const pct=((now.getUTCHours()*60+now.getUTCMinutes())/(24*60)*100).toFixed(2);
  const nowLabel=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});

  const peakLabel=(tl.peakStart&&tl.peakEnd)?'ช่วงพลังดี '+tl.peakStart+' – '+tl.peakEnd:'';

  let html='<div>';
  html+='<div class="flex items-center justify-between mb-2">';
  html+='<div class="flex items-center gap-1.5"><p class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">พลังงานตลอดวัน</p><i data-lucide="info" class="w-3 h-3 text-zinc-300"></i></div>';
  html+='<button class="text-[11px] font-semibold text-indigo-600" onclick="navigate(\\'timing\\')">ดูไทม์ไลน์เต็ม ›</button>';
  html+='</div>';

  html+='<div class="rounded-2xl border border-zinc-100 bg-white p-4">';
  html+='<div class="relative">';
  // Bar
  html+='<div class="h-3 rounded-full overflow-hidden" style="background:'+gradient+'"></div>';
  // Marker
  html+='<div class="absolute top-0 bottom-0 flex flex-col items-center" style="left:'+pct+'%;transform:translateX(-50%)">';
  html+='<div class="w-0.5 h-3 bg-zinc-900 rounded-full"></div>';
  html+='<div class="mt-1 px-2 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-bold whitespace-nowrap">ตอนนี้</div>';
  html+='</div>';
  html+='</div>';
  // X-axis labels
  html+='<div class="flex justify-between mt-5 text-[10px] text-zinc-400">';
  html+='<span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>';
  html+='</div>';
  if(peakLabel){
    html+='<p class="text-xs text-indigo-600 font-semibold mt-2 text-center">'+esc(peakLabel)+'</p>';
  }
  html+='</div></div>';
  return html;
}

function renderTodayCyclesAndInsight(compass,cycles,insight){
  let html='';

  if(compass){
    html+='<div>';
    html+='<p class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">เดือนนี้ · COMPASS</p>';
    html+='<div class="rounded-2xl border border-zinc-100 bg-white p-4 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform" onclick="quickFeatureFromCompass()">';
    html+='<div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl" style="background:linear-gradient(135deg,#7C3AED,#6366F1)">🌤</div>';
    html+='<div class="flex-1 min-w-0">';
    html+='<p class="text-sm font-bold text-zinc-900 leading-snug">'+esc(compass.monthTheme||'')+'</p>';
    if(compass.yearTheme)html+='<p class="text-xs text-zinc-500 mt-0.5 leading-snug">'+esc(compass.yearTheme)+'</p>';
    html+='</div>';
    html+='<i data-lucide="chevron-right" class="w-4 h-4 text-zinc-300 flex-shrink-0"></i>';
    html+='</div></div>';
  }


  if(insight){
    html+='<div>';
    html+='<div class="flex items-center justify-between mb-2">';
    html+='<p class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">AI INSIGHT</p>';
    html+='<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 tracking-wide">พรีเมียม</span>';
    html+='</div>';
    if(isPremium()){
      html+='<div class="rounded-2xl border border-zinc-100 bg-white p-4 space-y-2">';
      if(insight.must)html+='<div class="p-3 rounded-xl bg-zinc-50"><p class="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">สิ่งที่ต้องทำ</p><p class="text-sm text-zinc-800">'+esc(insight.must)+'</p></div>';
      if(insight.watch)html+='<div class="p-3 rounded-xl bg-zinc-50"><p class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">ระวัง</p><p class="text-sm text-zinc-800">'+esc(insight.watch)+'</p></div>';
      if(insight.hidden)html+='<div class="p-3 rounded-xl bg-violet-50"><p class="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">โอกาสซ่อนอยู่</p><p class="text-sm text-zinc-800">'+esc(insight.hidden)+'</p></div>';
      html+='</div>';
    } else {
      const tease=insight.must?(insight.must.substring(0,28)+(insight.must.length>28?'...':'')):'มีคำแนะนำสำหรับคุณวันนี้';
      html+='<div class="rounded-2xl border border-zinc-100 bg-white p-4">';
      html+='<div class="flex items-start gap-3 mb-3">';
      html+='<div class="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><i data-lucide="sparkles" class="w-4 h-4 text-amber-500"></i></div>';
      html+='<div class="flex-1 min-w-0">';
      html+='<p class="text-sm font-semibold text-zinc-800 leading-snug">'+esc(tease)+'</p>';
      html+='<p class="text-xs text-zinc-400 mt-1">เปิด AI Insight เพื่อดูคำแนะนำเฉพาะคุณ</p>';
      html+='</div></div>';
      html+='<button onclick="openPremiumDrawer()" class="w-full py-2.5 rounded-xl bg-zinc-900 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">';
      html+='<i data-lucide="lock" class="w-4 h-4"></i>ดูเพิ่มเติม</button>';
      html+='</div>';
    }
    html+='</div>';
  }

  return html;
}

function openPremiumDrawer(){
  openDrawer(\`<div class="pb-4">
    <div class="flex flex-col items-center text-center pt-4 pb-6">
      <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
        <i data-lucide="sparkles" class="w-7 h-7 text-amber-500"></i>
      </div>
      <h2 class="text-lg font-bold text-zinc-900 mb-1">AI Insight พรีเมียม</h2>
      <p class="text-sm text-zinc-500 leading-relaxed">รับคำแนะนำส่วนตัวจาก AI<br>เฉพาะสำหรับดวงชะตาของคุณ</p>
    </div>
    <div class="space-y-2 mb-6">
      <div class="flex items-center gap-3 p-3 rounded-xl bg-zinc-50">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-amber-500 flex-shrink-0"></i>
        <p class="text-sm text-zinc-700">สิ่งที่ต้องทำวันนี้ — แนะนำเฉพาะคุณ</p>
      </div>
      <div class="flex items-center gap-3 p-3 rounded-xl bg-zinc-50">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-amber-500 flex-shrink-0"></i>
        <p class="text-sm text-zinc-700">จุดที่ต้องระวังวันนี้</p>
      </div>
      <div class="flex items-center gap-3 p-3 rounded-xl bg-violet-50">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-violet-500 flex-shrink-0"></i>
        <p class="text-sm text-zinc-700 font-medium">โอกาสซ่อนอยู่ที่คนอื่นมองไม่เห็น</p>
      </div>
    </div>
    <button onclick="closeDrawer()" class="w-full py-3 rounded-2xl bg-zinc-900 text-white font-semibold text-base active:scale-[0.98] transition-transform">เร็วๆ นี้</button>
    <p class="text-center text-xs text-zinc-400 mt-3">ติดต่อ LINE OA เพื่อสมัครสมาชิก</p>
  </div>\`);
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
    if(res.result){el.innerHTML='<div class="text-sm text-zinc-600 leading-relaxed">'+md(res.result)+'</div>';if(typeof lucide!=='undefined')lucide.createIcons();}
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
  updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-2"><i data-lucide="'+icon+'" class="w-5 h-5 text-zinc-900"></i><h3 class="font-semibold text-zinc-900">'+esc(actionName)+cacheBadge+'</h3></div><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed">'+md(result)+'</div><div class="flex gap-2 mt-4"><button class="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 font-medium text-sm flex items-center justify-center gap-1.5" onclick="checkRightNow(\\''+actionId+'\\',true)"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> ทำนายใหม่</button><button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
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
  updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-zinc-900">'+esc(title)+'</h3><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed">'+md(text)+'</div><div class="flex gap-2 mt-4"><button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
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
  updateDrawer('<div class="px-1 pt-2 pb-2"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-2"><i data-lucide="'+icon+'" class="w-5 h-5 text-zinc-900"></i><h3 class="font-semibold text-zinc-900">'+esc(title)+cacheBadge+'</h3></div><button class="text-zinc-400 text-sm font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed">'+md(result)+'</div><div class="flex gap-2 mt-4">'+regenBtn+'<button class="flex-1 py-2.5 rounded-lg bg-zinc-900 text-white font-medium text-sm" onclick="closeDrawer()">เข้าใจแล้ว</button></div></div>');
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
    msgs.innerHTML+='<div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-zinc-100 text-zinc-900 text-sm leading-relaxed rounded-bl-sm border border-zinc-200">'+md(res.result||res.error||'เกิดข้อผิดพลาด')+'</div>';
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
      openDrawer('<div class="px-4 pt-2 pb-8"><div class="flex justify-between items-center mb-4"><h2 class="text-lg font-bold text-zinc-900 flex items-center gap-2"><i data-lucide="file-text" class="w-5 h-5 text-zinc-700"></i> Memory</h2><button class="text-sm text-zinc-500 font-medium" onclick="closeDrawer()">ปิด</button></div><div class="p-4 rounded-xl bg-zinc-50 text-sm text-zinc-800 leading-relaxed">'+md(res.memory||'ยังไม่มีข้อมูล')+'</div></div>');
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
    if(feature==='daily-reading'&&_todayData&&_todayData.chips)body.today_chips=_todayData.chips;
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
    <div class="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm text-zinc-800 leading-relaxed">\${md(result)}</div>
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
        if(me.tier){userTier=me.tier;localStorage.setItem('mor_doo_userTier',userTier);}
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