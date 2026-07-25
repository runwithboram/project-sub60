function renderApp() {
  const race = getNextRace();
  const pct = getWeeklyPercent();
  const logs = appData.logs.slice(0, 5);
  const weeklyReport = getWeeklyReport();

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

    <section class="card weekly-report">
      <header class="weekly-report-header">
        <div>
          <h2>주간 리포트</h2>
          <small>${weeklyReport.period}</small>
        </div>

        <span class="weekly-change ${weeklyReport.changeClass}">
          ${weeklyReport.changeText}
        </span>
      </header>

      <div class="weekly-report-grid">
        <div>
          <span>주간 거리</span>
          <b>${weeklyReport.distance}</b>
        </div>

        <div>
          <span>러닝 횟수</span>
          <b>${weeklyReport.count}</b>
        </div>

        <div>
          <span>평균 페이스</span>
          <b>${weeklyReport.averagePace}</b>
        </div>

        <div>
          <span>최장 거리</span>
          <b>${weeklyReport.longest}</b>
        </div>
      </div>

      <div class="weekly-coach">
        <span>Coach Summary</span>
        <p>${weeklyReport.summary}</p>
      </div>
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

function getWeeklyReport() {
  const currentRange = getWeekRangeByOffset(0);
  const previousRange = getWeekRangeByOffset(-1);

  const currentLogs = logsInRange(currentRange.start, currentRange.end);
  const previousLogs = logsInRange(previousRange.start, previousRange.end);

  const currentDistance = totalDistance(currentLogs);
  const previousDistance = totalDistance(previousLogs);
  const longestDistance = currentLogs.reduce(
    (max, log) => Math.max(max, Number(log.distance) || 0),
    0
  );

  const delta = round(currentDistance - previousDistance);
  const changeText = getWeeklyChangeText(delta, previousDistance);
  const changeClass =
    delta > 0 ? "is-up" :
    delta < 0 ? "is-down" :
    "is-same";

  return {
    period: formatWeekPeriod(currentRange.start, currentRange.end),
    distance: `${currentDistance.toFixed(1)} km`,
    count: `${currentLogs.length}회`,
    averagePace: getAveragePace(currentLogs),
    longest: currentLogs.length
      ? `${longestDistance.toFixed(1)} km`
      : "-",
    changeText,
    changeClass,
    summary: getWeeklySummary({
      currentLogs,
      currentDistance,
      previousDistance,
      longestDistance
    })
  };
}

function getWeekRangeByOffset(offset) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset + offset * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function logsInRange(start, end) {
  return appData.logs.filter(log => {
    const date = new Date(log.date);
    return date >= start && date < end;
  });
}

function totalDistance(logs) {
  return round(
    logs.reduce(
      (sum, log) => sum + Number(log.distance || 0),
      0
    )
  );
}

function getAveragePace(logs) {
  const validLogs = logs.filter(log => {
    const distance = Number(log.distance);
    return distance > 0 && validReportTime(log.time);
  });

  if (!validLogs.length) return "-";

  const distance = validLogs.reduce(
    (sum, log) => sum + Number(log.distance),
    0
  );

  const totalSeconds = validLogs.reduce(
    (sum, log) => sum + reportTimeToSeconds(log.time),
    0
  );

  if (distance <= 0 || totalSeconds <= 0) return "-";

  const paceSeconds = Math.round(totalSeconds / distance);
  const minutes = Math.floor(paceSeconds / 60);
  const secondsPart = String(paceSeconds % 60).padStart(2, "0");

  return `${minutes}'${secondsPart}"/km`;
}

function validReportTime(time) {
  const parts = String(time || "").split(":").map(Number);

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some(Number.isNaN)
  ) {
    return false;
  }

  return parts.every((value, index) => {
    if (index === 0) return value >= 0;
    return value >= 0 && value < 60;
  });
}

function reportTimeToSeconds(time) {
  const parts = String(time).split(":").map(Number);

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function getWeeklyChangeText(delta, previousDistance) {
  if (previousDistance === 0) {
    return delta > 0 ? "이번 주 시작" : "기록 대기";
  }

  if (delta > 0) return `지난주보다 +${delta.toFixed(1)} km`;
  if (delta < 0) return `지난주보다 ${delta.toFixed(1)} km`;

  return "지난주와 동일";
}

function getWeeklySummary({
  currentLogs,
  currentDistance,
  previousDistance,
  longestDistance
}) {
  if (!currentLogs.length) {
    return "이번 주 첫 러닝을 기록해 보세요. 짧은 이지런부터 시작해도 충분합니다.";
  }

  const goal = Number(appData.weekly.goal) || 0;
  const achievement = goal > 0
    ? Math.round((currentDistance / goal) * 100)
    : 0;

  if (achievement >= 100) {
    return `주간 목표를 달성했습니다. 총 ${currentLogs.length}회 달렸고, 최장 거리는 ${longestDistance.toFixed(1)}km입니다. 다음 러닝은 회복 강도로 조절하세요.`;
  }

  if (previousDistance > 0 && currentDistance > previousDistance * 1.2) {
    return `지난주보다 거리가 크게 늘었습니다. 현재 ${achievement}% 달성 중이므로 다음 운동은 강도보다 회복과 부상 예방을 우선하세요.`;
  }

  if (currentLogs.length >= 3) {
    return `이번 주 ${currentLogs.length}회 러닝으로 꾸준함이 좋습니다. 목표까지 ${Math.max(0, goal - currentDistance).toFixed(1)}km 남았습니다.`;
  }

  return `현재 ${achievement}% 달성했습니다. 목표까지 ${Math.max(0, goal - currentDistance).toFixed(1)}km 남았으니 무리하지 않고 나누어 채우세요.`;
}

function formatWeekPeriod(start, end) {
  const lastDay = new Date(end);
  lastDay.setDate(end.getDate() - 1);

  const formatter = new Intl.DateTimeFormat(
    "ko-KR",
    {
      month: "numeric",
      day: "numeric"
    }
  );

  return `${formatter.format(start)} – ${formatter.format(lastDay)}`;
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
