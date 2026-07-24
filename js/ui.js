function renderApp() {
  const race = getNextRace();
  const pct = getWeeklyPercent();
  const logs = appData.logs.slice(0, 3);
  const weeklyReport = getWeeklyReport();
  const tenK = appData.records.tenK || "1:02:17";
  const gap = Math.max(0, reportTimeToSeconds(tenK) - reportTimeToSeconds("59:59"));
  const gapMin = Math.floor(gap / 60);
  const gapSec = String(gap % 60).padStart(2, "0");
  const progress = Math.max(8, Math.min(100, Math.round((3600 / Math.max(3600, reportTimeToSeconds(tenK))) * 100)));

  document.getElementById("app").innerHTML = `
    <header class="v2-topbar">
      <div><small>${greeting()}</small><h1>Sub60</h1></div>
      <button class="v2-icon-button" type="button" aria-label="설정">•••</button>
    </header>

    <section class="hero v2-hero">
      <div class="v2-hero-copy">
        <span>10K 59:59까지</span>
        <strong>${gapMin}분 ${gapSec}초</strong>
        <p>PB ${tenK} · 목표까지 꾸준히 가는 중</p>
      </div>
      <div class="v2-ring" style="--value:${progress}"><b>${progress}%</b><small>진행</small></div>
      <div class="v2-progress"><i style="width:${progress}%"></i></div>
    </section>

    <section class="v2-section">
      <div class="v2-section-title"><div><small>TODAY</small><h2>오늘의 러닝</h2></div><span class="v2-pill">추천</span></div>
      <article class="v2-workout-card">
        <div class="v2-workout-icon">R</div>
        <div class="v2-workout-main"><strong>Easy Run</strong><p>회복을 지키면서 편안하게 달려요</p></div>
        <div class="v2-workout-numbers"><b>5–6 km</b><span>7'20"–7'45"</span></div>
      </article>
    </section>

    <section class="v2-section">
      <div class="v2-section-title"><h2>이번 주</h2><span>${weeklyReport.period}</span></div>
      <div class="v2-stat-grid">
        <div><small>거리</small><strong>${weeklyReport.distance}</strong><span>${pct}% 달성</span></div>
        <div><small>러닝</small><strong>${weeklyReport.count}</strong><span>꾸준함 유지</span></div>
        <div><small>평균 페이스</small><strong>${weeklyReport.averagePace}</strong><span>최근 기록 기준</span></div>
      </div>
      <div class="track"><i style="width:${pct}%"></i></div>
    </section>

    <section class="v2-section">
      <div class="v2-section-title"><h2>최근 러닝</h2><button type="button" class="v2-text-button">전체보기</button></div>
      <div class="v2-run-list">
        ${logs.length ? logs.map((log, index) => `
          <article class="v2-run-item">
            <div class="v2-run-date"><b>${new Date(log.date).getDate()}</b><span>${new Intl.DateTimeFormat('en-US',{month:'short'}).format(new Date(log.date))}</span></div>
            <div class="v2-run-primary"><strong>${Number(log.distance).toFixed(2)} km</strong><span>${logDate(log.date)}</span></div>
            <div class="v2-run-secondary"><b>${log.pace}</b><span>${log.time}</span></div>
            ${index === 0 ? '<button class="v2-analysis-button" type="button">AI 분석</button>' : ''}
          </article>`).join('') : '<p class="muted">아직 저장된 기록이 없습니다.</p>'}
      </div>
    </section>

    <section class="v2-section v2-coach-card">
      <div class="v2-section-title"><div><small>AI COACH</small><h2>이번 주 코칭</h2></div><span class="v2-status">GOOD</span></div>
      <p>${weeklyReport.summary}</p>
      <div class="v2-coach-points"><span>✓ 회복 우선</span><span>✓ 주 1회 품질훈련</span><span>✓ 거리 급증 금지</span></div>
    </section>

    <section class="v2-section v2-race-card">
      <div><small>NEXT RACE</small><h2>${race.name}</h2><p>${race.date} · 목표 ${race.target}</p></div>
      <strong>${dday(race.date)}</strong>
    </section>

    <section class="v2-section v2-entry-card">
      <div class="v2-section-title"><h2>러닝 기록 추가</h2><span>Garmin 캡처 또는 직접 입력</span></div>
      <label class="capture-button" for="garminCapture">Garmin 캡처 가져오기</label>
      <input id="garminCapture" class="capture-input" type="file" accept="image/*">
      <div id="capturePreviewBox" class="capture-preview hidden">
        <img id="capturePreviewImage" alt="선택한 Garmin 캡처 미리보기">
        <button id="analyzeCapture" class="ocr-button" type="button">Garmin 읽기</button>
        <div id="ocrStatus" class="ocr-status hidden"><span id="ocrStatusText">준비 중...</span><div class="ocr-progress"><i id="ocrProgressBar"></i></div></div>
        <button id="removeCapture" class="secondary-button" type="button">사진 삭제</button>
      </div>
      <div class="v2-input-row">
        <label><span>거리 (km)</span><input id="distance" type="number" inputmode="decimal" step="0.01" placeholder="5.10"></label>
        <label><span>시간</span><input id="time" type="text" inputmode="numeric" maxlength="6" placeholder="4037"></label>
      </div>
      <div class="preview"><div><span>시간</span><b id="timePreview">-</b></div><div><span>평균 페이스</span><b id="pacePreview">-</b></div></div>
      <button id="saveRun">러닝 저장</button>
    </section>
  `;
}

function greeting(){const h=new Date().getHours(); if(h<12)return `좋은 아침이에요, ${appData.user.name}`; if(h<18)return `오늘도 힘내요, ${appData.user.name}`; return `오늘도 수고했어요, ${appData.user.name}`;}
function startDay(date){return new Date(date.getFullYear(),date.getMonth(),date.getDate());}
function getNextRace(){const today=startDay(new Date());return appData.races.map(r=>({...r,parsedDate:new Date(`${r.date}T00:00:00`)})).filter(r=>startDay(r.parsedDate)>=today).sort((a,b)=>a.parsedDate-b.parsedDate)[0]||appData.races[appData.races.length-1];}
function dday(dateString){const target=startDay(new Date(`${dateString}T00:00:00`));const today=startDay(new Date());const diff=Math.ceil((target-today)/86400000);if(diff>0)return `D-${diff}`;if(diff===0)return 'D-DAY';return '완료';}
function getWeeklyPercent(){if(!appData.weekly.goal)return 0;return Math.min(100,Math.round(appData.weekly.current/appData.weekly.goal*100));}
function getWeeklyReport(){const currentRange=getWeekRangeByOffset(0);const previousRange=getWeekRangeByOffset(-1);const currentLogs=logsInRange(currentRange.start,currentRange.end);const previousLogs=logsInRange(previousRange.start,previousRange.end);const currentDistance=totalDistance(currentLogs);const previousDistance=totalDistance(previousLogs);const longestDistance=currentLogs.reduce((m,l)=>Math.max(m,Number(l.distance)||0),0);return{period:formatWeekPeriod(currentRange.start,currentRange.end),distance:`${currentDistance.toFixed(1)} km`,count:`${currentLogs.length}회`,averagePace:getAveragePace(currentLogs),longest:currentLogs.length?`${longestDistance.toFixed(1)} km`:'-',summary:getWeeklySummary({currentLogs,currentDistance,previousDistance,longestDistance})};}
function getWeekRangeByOffset(offset){const now=new Date();const day=now.getDay();const mondayOffset=day===0?-6:1-day;const start=new Date(now);start.setDate(now.getDate()+mondayOffset+offset*7);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(start.getDate()+7);return{start,end};}
function logsInRange(start,end){return appData.logs.filter(log=>{const d=new Date(log.date);return d>=start&&d<end;});}
function totalDistance(logs){return round(logs.reduce((s,l)=>s+Number(l.distance||0),0));}
function getAveragePace(logs){const valid=logs.filter(l=>Number(l.distance)>0&&validReportTime(l.time));if(!valid.length)return '-';const d=valid.reduce((s,l)=>s+Number(l.distance),0);const t=valid.reduce((s,l)=>s+reportTimeToSeconds(l.time),0);const p=Math.round(t/d);return `${Math.floor(p/60)}'${String(p%60).padStart(2,'0')}\"/km`;}
function validReportTime(time){const p=String(time||'').split(':').map(Number);return p.length>=2&&p.length<=3&&!p.some(Number.isNaN)&&p.every((v,i)=>i===0?v>=0:v>=0&&v<60);}
function reportTimeToSeconds(time){const p=String(time).split(':').map(Number);if(p.length===2)return p[0]*60+p[1];if(p.length===3)return p[0]*3600+p[1]*60+p[2];return 0;}
function getWeeklySummary({currentLogs,currentDistance,previousDistance,longestDistance}){if(!currentLogs.length)return '이번 주 첫 러닝은 짧은 이지런으로 가볍게 시작해요.';const goal=Number(appData.weekly.goal)||0;const achievement=goal?Math.round(currentDistance/goal*100):0;if(achievement>=100)return `주간 목표를 달성했어요. 다음 러닝은 회복 강도로 조절해 주세요.`;if(previousDistance>0&&currentDistance>previousDistance*1.2)return '지난주보다 거리가 많이 늘었어요. 이번 주는 회복과 부상 예방을 우선해요.';if(currentLogs.length>=3)return `이번 주 ${currentLogs.length}회 러닝으로 흐름이 좋아요. 남은 거리는 편안하게 나누어 채워요.`;return `현재 주간 목표의 ${achievement}%예요. 무리하지 않고 한 번씩 이어가면 충분해요.`;}
function formatWeekPeriod(start,end){const last=new Date(end);last.setDate(end.getDate()-1);const f=new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric'});return `${f.format(start)} – ${f.format(last)}`;}
function coach(){const r=Math.max(0,appData.weekly.goal-appData.weekly.current);return r===0?'이번 주 목표를 달성했습니다.':'이번 주 목표까지 '+r.toFixed(1)+'km 남았습니다.';}
function logDate(value){return new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date(value));}
