(() => {
  const oldRender = window.renderApp;
  if (typeof oldRender !== 'function') return;

  window.renderApp = function renderSub60V2() {
    oldRender();
    requestAnimationFrame(() => {
      applyBrand();
      enhanceHome();
      enhanceBalance();
    });
  };

  function applyBrand() {
    document.title = 'Sub60';
    document.querySelectorAll('.hero h1').forEach(el => { el.textContent = 'Sub60'; });
  }

  function enhanceHome() {
    const panel = document.getElementById('bbRunningPanel') || document.getElementById('app');
    if (!panel) return;

    const recent = [...panel.querySelectorAll('section.card')]
      .find(card => card.querySelector('h2')?.textContent.trim() === '최근 운동');
    recent?.classList.add('sub60-recent-card');

    mountRaceCalendar(panel);
    mountWeeklyStatus(panel);
    mountAchievement(panel);
  }

  function mountRaceCalendar(panel) {
    if (panel.querySelector('#sub60RaceCalendar')) return;
    const races = Array.isArray(window.appData?.races) ? window.appData.races : [];
    const today = startOfDay(new Date());
    const future = races
      .map(race => ({ ...race, dateObj: new Date(`${race.date}T00:00:00`) }))
      .filter(race => !Number.isNaN(race.dateObj.getTime()) && race.dateObj >= today)
      .sort((a,b) => a.dateObj - b.dateObj);
    if (!future.length) return;

    const card = document.createElement('section');
    card.id = 'sub60RaceCalendar';
    card.className = 'card sub60-race-card sub60-pop';
    card.innerHTML = `
      <div class="sub60-section-head">
        <div><h2>Race Calendar</h2><small>하반기 10K 레이스</small></div>
        <small>${future.length} races</small>
      </div>
      <div class="sub60-race-list">
        ${future.map((race, index) => {
          const days = Math.ceil((race.dateObj - today) / 86400000);
          const cls = `${index === 0 ? 'is-next' : ''} ${days <= 7 ? 'is-week' : ''}`.trim();
          return `<div class="sub60-race-item ${cls}">
            <i aria-hidden="true"></i>
            <div><b>${escapeHtml(race.name)}</b><small>${formatDate(race.dateObj)} · 목표 ${escapeHtml(race.target || '59:59')}</small></div>
            <strong>${days === 0 ? 'D-DAY' : `D-${days}`}</strong>
          </div>`;
        }).join('')}
      </div>`;

    const hero = panel.querySelector('.hero');
    const todayCard = panel.querySelector('#bbTodayRunCard');
    (todayCard || hero)?.insertAdjacentElement('afterend', card);
  }

  function mountWeeklyStatus(panel) {
    if (panel.querySelector('#sub60WeekStatus')) return;
    const logs = Array.isArray(window.appData?.logs) ? window.appData.logs : [];
    const start = startOfWeek(new Date());
    const weekLogs = logs.filter(log => new Date(log.date) >= start);
    const distance = weekLogs.reduce((sum, log) => sum + Number(log.distance || 0), 0);
    const goal = Number(window.appData?.weekly?.goal || 25);
    const pct = Math.max(0, Math.min(100, goal ? Math.round(distance / goal * 100) : 0));

    const card = document.createElement('section');
    card.id = 'sub60WeekStatus';
    card.className = 'card sub60-pop';
    card.innerHTML = `
      <div class="sub60-section-head"><div><h2>이번 주</h2><small>훈련 흐름을 한눈에</small></div></div>
      <div class="sub60-week-status">
        <div class="sub60-week-ring" style="--week-pct:${pct}%"><b>${pct}%</b></div>
        <div class="sub60-week-copy"><b>${weekLogs.length}회 완료</b><small>${goal > distance ? `목표까지 ${(goal-distance).toFixed(1)}km` : '주간 목표 달성'}</small></div>
        <div class="sub60-week-distance"><b>${distance.toFixed(1)}km</b><small>/ ${goal}km</small></div>
      </div>`;

    const race = panel.querySelector('#sub60RaceCalendar');
    race?.insertAdjacentElement('afterend', card);
  }

  function mountAchievement(panel) {
    const recent = panel.querySelector('.sub60-recent-card');
    if (!recent || recent.querySelector('.sub60-achievement')) return;
    const logs = Array.isArray(window.appData?.logs) ? window.appData.logs : [];
    if (!logs.length) return;
    const newest = logs[0];
    let message = '';
    if (Number(newest.distance) >= 10) message = '🏅 최근 러닝에서 10K를 완주했어요.';
    else if (logs.length >= 10) message = `🔥 러닝 기록 ${logs.length}개를 쌓았어요.`;
    else if (Number(newest.distance) >= 5) message = '✓ 최근 러닝 5K 이상 완료';
    if (!message) return;
    recent.insertAdjacentHTML('beforeend', `<div class="sub60-achievement">${message}</div>`);
  }

  function enhanceBalance() {
    const panel = document.getElementById('bbBalancePanel');
    if (!panel || panel.dataset.v2Enhanced === 'true') return;
    panel.dataset.v2Enhanced = 'true';

    const hero = panel.querySelector('.bb-hero');
    const titlebar = document.createElement('div');
    titlebar.className = 'bb-balance-titlebar';
    titlebar.innerHTML = '<b>Body Balance</b><button class="bb-balance-add" type="button" aria-label="인바디 기록 추가">＋</button>';
    hero?.before(titlebar);

    const shortcut = panel.querySelector('#bbGoToInput');
    const input = panel.querySelector('#bbInputSection');
    if (input && shortcut) {
      input.classList.remove('is-open');
      const openInput = () => {
        input.classList.toggle('is-open');
        if (input.classList.contains('is-open')) input.scrollIntoView({ behavior:'smooth', block:'start' });
      };
      titlebar.querySelector('.bb-balance-add')?.addEventListener('click', openInput);
      shortcut.addEventListener('click', openInput);
      panel.appendChild(shortcut);
    }
  }

  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function startOfWeek(date) {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  }
  function formatDate(date) { return `${date.getMonth()+1}.${date.getDate()}`; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
})();
