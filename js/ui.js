function renderApp() {
  const race = getNextRace();
  const pct = getWeeklyPercent();
  const logs = appData.logs.slice(0, 5);

  document.getElementById("app").innerHTML = `
    <section class="hero">
      <span>${greeting()}, ${appData.user.name}</span>

      <h1>Road to SUB60</h1>

      <div class="heroRow">
        <div>
          <b>${dday(race.date)}</b>
          <small>${race.name}</small>
        </div>

        <em>${appData.user.goal}</em>
      </div>
    </section>

    <section class="card">
      <h2>운동 기록</h2>

      <label class="capture-button" for="garminCapture">
        📷 Garmin 캡처 가져오기
      </label>

      <input
        id="garminCapture"
        class="capture-input"
        type="file"
        accept="image/*"
      >

      <div id="capturePreviewBox" class="capture-preview hidden">
        <img
          id="capturePreviewImage"
          alt="선택한 Garmin 캡처 미리보기"
        >
<button
  id="analyzeCapture"
  class="ocr-button"
  type="button"
>
  Garmin 읽기
</button>

<div
  id="ocrStatus"
  class="ocr-status hidden"
>
  <span id="ocrStatusText">
    준비 중...
  </span>

  <div class="ocr-progress">
    <i id="ocrProgressBar"></i>
  </div>
</div>
        <button
          id="removeCapture"
          class="secondary-button"
          type="button"
        >
          사진 삭제
        </button>
      </div>

      <label>
        <span>거리 (km)</span>

        <input
          id="distance"
          type="number"
          inputmode="decimal"
          step="0.01"
          placeholder="예: 8.2"
        >
      </label>

      <label>
        <span>시간</span>

        <input
          id="time"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="예: 5120"
        >
      </label>

      <div class="preview">
        <div>
          <span>시간</span>
          <b id="timePreview">-</b>
        </div>

        <div>
          <span>평균 페이스</span>
          <b id="pacePreview">-</b>
        </div>
      </div>

      <button id="saveRun">
        저장하기
      </button>
    </section>

    <section class="card">
      <header>
        <h2>이번 주</h2>

        <b>
          ${appData.weekly.current.toFixed(1)}
          /
          ${appData.weekly.goal} km
        </b>
      </header>

      <div class="track">
        <i style="width:${pct}%"></i>
      </div>

      <small>${pct}% 달성</small>
    </section>

    <section class="card">
      <h2>최근 운동</h2>

      ${
        logs.length
          ? `
            <div class="logs">
              ${logs.map(log => `
                <article>
                  <div>
                    <b>${Number(log.distance).toFixed(2)} km</b>
                    <small>${logDate(log.date)}</small>
                  </div>

                  <div>
                    <b>${log.time}</b>
                    <small>${log.pace}</small>
                  </div>
                </article>
              `).join("")}
            </div>
          `
          : `
            <p class="muted">
              아직 저장된 기록이 없습니다.
            </p>
          `
      }
    </section>

    <section class="metrics">
      <div>
        <span>10K PB</span>
        <b>${appData.records.tenK}</b>
      </div>

      <div>
        <span>Half PB</span>
        <b>${appData.records.half}</b>
      </div>

      <div>
        <span>VO₂max</span>
        <b>${appData.records.vo2max}</b>
      </div>

      <div>
        <span>다음 목표</span>
        <b>${race.target}</b>
      </div>
    </section>

    <section class="card">
      <h2>Coach</h2>
      <p>${coach()}</p>
    </section>
  `;
}

function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "☀️ Good Morning";
  if (hour < 18) return "🌤 Good Afternoon";

  return "🌙 Good Evening";
}

function startDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function getNextRace() {
  const today = startDay(new Date());

  return (
    appData.races
      .map(race => ({
        ...race,
        parsedDate: new Date(`${race.date}T00:00:00`)
      }))
      .filter(race => startDay(race.parsedDate) >= today)
      .sort((a, b) => a.parsedDate - b.parsedDate)[0]
    || appData.races[appData.races.length - 1]
  );
}

function dday(dateString) {
  const target = startDay(
    new Date(`${dateString}T00:00:00`)
  );

  const today = startDay(new Date());

  const diff = Math.ceil(
    (target - today) / 86400000
  );

  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return "D-DAY";

  return "완료";
}

function getWeeklyPercent() {
  if (!appData.weekly.goal) return 0;

  return Math.min(
    100,
    Math.round(
      appData.weekly.current
      / appData.weekly.goal
      * 100
    )
  );
}

function coach() {
  const remaining = Math.max(
    0,
    appData.weekly.goal - appData.weekly.current
  );

  if (remaining === 0) {
    return "이번 주 목표를 달성했습니다. 다음 운동은 회복을 우선하세요.";
  }

  return `이번 주 목표까지 ${remaining.toFixed(1)}km 남았습니다.`;
}

function logDate(value) {
  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }
  ).format(new Date(value));
}
