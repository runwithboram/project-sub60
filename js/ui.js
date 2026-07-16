function renderApp(){
 const race=getNextRace(), pct=getWeeklyPercent(), logs=appData.logs.slice(0,5);
 document.getElementById("app").innerHTML=`
 <section class="hero">
  <span>${greeting()}, ${appData.user.name}</span>
  <h1>Road to SUB60</h1>
  <div class="heroRow"><div><b>${dday(race.date)}</b><small>${race.name}</small></div><em>${appData.user.goal}</em></div>
 </section>

 <section class="card">
  <label>거리 (km)<input id="distance" type="number" inputmode="decimal" step="0.01" placeholder="예: 8.2"></label>
  <label>시간<input id="time" type="text" inputmode="numeric" maxlength="6" placeholder="예: 5120"></label>
  <div class="preview"><div><span>시간</span><b id="timePreview">-</b></div><div><span>평균 페이스</span><b id="pacePreview">-</b></div></div>
  <button id="saveRun">저장하기</button>
 </section>

 <section class="card">
  <header><h2>이번 주</h2><b>${appData.weekly.current.toFixed(1)} / ${appData.weekly.goal} km</b></header>
  <div class="track"><i style="width:${pct}%"></i></div><small>${pct}% 달성</small>
 </section>

 <section class="card"><h2>최근 운동</h2>
  ${logs.length?`<div class="logs">${logs.map(log=>`<article><div><b>${Number(log.distance).toFixed(2)} km</b><small>${logDate(log.date)}</small></div><div><b>${log.time}</b><small>${log.pace}</small></div></article>`).join("")}</div>`:`<p class="muted">아직 저장된 기록이 없습니다.</p>`}
 </section>

 <section class="metrics">
  <div><span>10K PB</span><b>${appData.records.tenK}</b></div>
  <div><span>Half PB</span><b>${appData.records.half}</b></div>
  <div><span>VO₂max</span><b>${appData.records.vo2max}</b></div>
  <div><span>다음 목표</span><b>${race.target}</b></div>
 </section>

 <section class="card"><h2>Coach</h2><p>${coach()}</p></section>`;
}

function greeting(){const h=new Date().getHours();return h<12?"☀️ Good Morning":h<18?"🌤 Good Afternoon":"🌙 Good Evening";}
function startDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function getNextRace(){const t=startDay(new Date());return appData.races.map(r=>({...r,d:new Date(r.date+"T00:00:00")})).filter(r=>startDay(r.d)>=t).sort((a,b)=>a.d-b.d)[0]||appData.races.at(-1);}
function dday(s){const n=Math.ceil((startDay(new Date(s+"T00:00:00"))-startDay(new Date()))/86400000);return n>0?`D-${n}`:n===0?"D-DAY":"완료";}
function getWeeklyPercent(){return appData.weekly.goal?Math.min(100,Math.round(appData.weekly.current/appData.weekly.goal*100)):0;}
function coach(){const r=Math.max(0,appData.weekly.goal-appData.weekly.current);return r===0?"이번 주 목표를 달성했습니다. 다음 운동은 회복을 우선하세요.":`이번 주 목표까지 ${r.toFixed(1)}km 남았습니다.`;}
function logDate(v){return new Intl.DateTimeFormat("ko-KR",{month:"numeric",day:"numeric",weekday:"short"}).format(new Date(v));}
