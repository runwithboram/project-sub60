document.addEventListener(
  "DOMContentLoaded",
  () => {
    load();
    recalcWeek();
    renderApp();
    bind();
  }
);

let selectedCaptureUrl = null;

function bind() {
  const distanceInput =
    document.getElementById("distance");

  const timeInput =
    document.getElementById("time");

  const saveButton =
    document.getElementById("saveRun");

  const captureInput =
    document.getElementById("garminCapture");

  const removeCaptureButton =
    document.getElementById("removeCapture");

  distanceInput?.addEventListener(
    "input",
    preview
  );

  timeInput?.addEventListener(
    "input",
    () => {
      timeInput.value =
        timeInput.value
          .replace(/\D/g, "")
          .slice(0, 6);

      preview();
    }
  );

  saveButton?.addEventListener(
    "click",
    saveWorkout
  );

  captureInput?.addEventListener(
    "change",
    handleCaptureSelection
  );

  removeCaptureButton?.addEventListener(
    "click",
    clearCapturePreview
  );
}

function handleCaptureSelection(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일을 선택해 주세요.");
    event.target.value = "";
    return;
  }

  if (selectedCaptureUrl) {
    URL.revokeObjectURL(selectedCaptureUrl);
  }

  selectedCaptureUrl =
    URL.createObjectURL(file);

  const previewBox =
    document.getElementById("capturePreviewBox");

  const previewImage =
    document.getElementById("capturePreviewImage");

  previewImage.src = selectedCaptureUrl;
  previewBox.classList.remove("hidden");
}

function clearCapturePreview() {
  const captureInput =
    document.getElementById("garminCapture");

  const previewBox =
    document.getElementById("capturePreviewBox");

  const previewImage =
    document.getElementById("capturePreviewImage");

  if (selectedCaptureUrl) {
    URL.revokeObjectURL(selectedCaptureUrl);
    selectedCaptureUrl = null;
  }

  if (captureInput) {
    captureInput.value = "";
  }

  if (previewImage) {
    previewImage.removeAttribute("src");
  }

  previewBox?.classList.add("hidden");
}

function preview() {
  const distance =
    Number.parseFloat(
      document.getElementById("distance")?.value
      || "0"
    );

  const formattedTime =
    formatTime(
      document.getElementById("time")?.value
      || ""
    );

  document
    .getElementById("timePreview")
    .textContent =
      formattedTime || "-";

  document
    .getElementById("pacePreview")
    .textContent =
      distance > 0
      && validTime(formattedTime)
        ? pace(distance, formattedTime)
        : "-";
}

function saveWorkout() {
  const distanceInput =
    document.getElementById("distance");

  const timeInput =
    document.getElementById("time");

  const distance =
    Number.parseFloat(
      distanceInput?.value || "0"
    );

  const formattedTime =
    formatTime(
      timeInput?.value || ""
    );

  if (
    !Number.isFinite(distance)
    || distance <= 0
  ) {
    alert("거리를 입력해 주세요.");
    distanceInput?.focus();
    return;
  }

  if (!validTime(formattedTime)) {
    alert(
      "시간을 숫자로 입력해 주세요. 예: 5120 → 51:20"
    );

    timeInput?.focus();
    return;
  }

  const log = {
    id: Date.now(),
    date: new Date().toISOString(),
    distance: round(distance),
    time: formattedTime,
    pace: pace(
      distance,
      formattedTime
    )
  };

  appData.logs.unshift(log);

  recalcWeek();
  save();
  renderApp();
  bind();

  alert(
    `저장 완료\n`
    + `${log.distance}km · `
    + `${log.time} · `
    + `${log.pace}`
  );
}

function formatTime(input) {
  const numbers =
    String(input || "")
      .replace(/\D/g, "")
      .slice(0, 6);

  if (!numbers) return "";

  if (numbers.length <= 2) {
    return `0:${numbers.padStart(2, "0")}`;
  }

  if (numbers.length <= 4) {
    return (
      `${Number(numbers.slice(0, -2))}`
      + `:${numbers.slice(-2)}`
    );
  }

  return (
    `${Number(numbers.slice(0, -4))}`
    + `:${numbers.slice(-4, -2)}`
    + `:${numbers.slice(-2)}`
  );
}

function validTime(time) {
  const parts =
    String(time)
      .split(":")
      .map(Number);

  if (parts.some(Number.isNaN)) {
    return false;
  }

  if (parts.length === 2) {
    return (
      parts[0] >= 0
      && parts[1] >= 0
      && parts[1] < 60
    );
  }

  return (
    parts.length === 3
    && parts[0] >= 0
    && parts[1] >= 0
    && parts[1] < 60
    && parts[2] >= 0
    && parts[2] < 60
  );
}

function seconds(time) {
  const parts =
    time.split(":").map(Number);

  if (parts.length === 2) {
    return (
      parts[0] * 60
      + parts[1]
    );
  }

  return (
    parts[0] * 3600
    + parts[1] * 60
    + parts[2]
  );
}

function pace(distance, time) {
  const paceSeconds =
    Math.round(
      seconds(time) / distance
    );

  const minutes =
    Math.floor(paceSeconds / 60);

  return (
    `${minutes}'`
    + `${String(paceSeconds % 60).padStart(2, "0")}`
    + `"/km`
  );
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  const start = new Date(now);

  start.setDate(
    now.getDate() + offset
  );

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(
    start.getDate() + 7
  );

  return {
    start,
    end
  };
}

function recalcWeek() {
  const {
    start,
    end
  } = weekRange();

  appData.weekly.current =
    round(
      appData.logs
        .filter(log => {
          const date =
            new Date(log.date);

          return (
            date >= start
            && date < end
          );
        })
        .reduce(
          (sum, log) =>
            sum
            + Number(log.distance || 0),
          0
        )
    );
}

function round(value) {
  return (
    Math.round(
      (value + Number.EPSILON)
      * 100
    )
    / 100
  );
}

function save() {
  localStorage.setItem(
    "roadToSub60_v1",
    JSON.stringify(appData)
  );
}

function load() {
  const saved =
    localStorage.getItem(
      "roadToSub60_v1"
    );

  if (!saved) return;

  try {
    const parsed =
      JSON.parse(saved);

    appData.user = {
      ...appData.user,
      ...(parsed.user || {})
    };

    appData.weekly = {
      ...appData.weekly,
      ...(parsed.weekly || {})
    };

    appData.records = {
      ...appData.records,
      ...(parsed.records || {})
    };

    appData.races =
      Array.isArray(parsed.races)
        ? parsed.races
        : appData.races;

    appData.logs =
      Array.isArray(parsed.logs)
        ? parsed.logs
        : [];
  } catch (error) {
    localStorage.removeItem(
      "roadToSub60_v1"
    );
  }
}
