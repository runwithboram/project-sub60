document.addEventListener("DOMContentLoaded", () => {
  load();
  recalcWeek();
  renderApp();
  bind();
});

let selectedCaptureUrl = null;
let selectedCaptureFile = null;
let isAnalyzing = false;

function bind() {
  const distanceInput = document.getElementById("distance");
  const timeInput = document.getElementById("time");
  const saveButton = document.getElementById("saveRun");
  const captureInput = document.getElementById("garminCapture");
  const removeCaptureButton = document.getElementById("removeCapture");
  const analyzeButton = document.getElementById("analyzeCapture");

  distanceInput?.addEventListener("input", preview);

  timeInput?.addEventListener("input", () => {
    timeInput.value = timeInput.value.replace(/\D/g, "").slice(0, 6);
    preview();
  });

  saveButton?.addEventListener("click", saveWorkout);
  captureInput?.addEventListener("change", handleCaptureSelection);
  removeCaptureButton?.addEventListener("click", clearCapturePreview);
  analyzeButton?.addEventListener("click", analyzeGarminCapture);
}

function handleCaptureSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("이미지 파일을 선택해 주세요.");
    event.target.value = "";
    return;
  }

  selectedCaptureFile = file;

  if (selectedCaptureUrl) {
    URL.revokeObjectURL(selectedCaptureUrl);
  }

  selectedCaptureUrl = URL.createObjectURL(file);

  const previewBox = document.getElementById("capturePreviewBox");
  const previewImage = document.getElementById("capturePreviewImage");

  if (previewImage) previewImage.src = selectedCaptureUrl;
  previewBox?.classList.remove("hidden");

  updateOcrStatus("Garmin 읽기를 눌러 주세요.", 0, false);
}

async function analyzeGarminCapture() {
  if (isAnalyzing) return;

  if (!selectedCaptureFile) {
    alert("Garmin 요약 이미지를 먼저 선택해 주세요.");
    return;
  }

  try {
    await ensureTesseractLoaded();
  } catch (error) {
    alert("OCR 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
    return;
  }

  const analyzeButton = document.getElementById("analyzeCapture");
  isAnalyzing = true;

  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Garmin 읽는 중...";
  }

  let worker = null;

  try {
    updateOcrStatus("Garmin 요약 화면 확인 중...", 5, true);

    const image = await loadImageFile(selectedCaptureFile);

    if (!isGarminSummaryRatio(image)) {
      throw new Error(
        "Garmin 요약 화면 전체가 보이는 가로형 이미지를 선택해 주세요."
      );
    }

    const regions = createGarminSummaryRegions(image);

    worker = await Tesseract.createWorker("eng", 1, {
      logger(message) {
        if (message.status === "recognizing text") {
          updateOcrStatus(
            `숫자 읽는 중... ${Math.round((message.progress || 0) * 100)}%`,
            15 + Math.round((message.progress || 0) * 75),
            true
          );
        }
      }
    });

    await worker.setParameters({
      tessedit_pageseg_mode: "7",
      tessedit_char_whitelist: "0123456789.:",
      preserve_interword_spaces: "0"
    });

    const rawResults = {};

    for (let index = 0; index < regions.length; index += 1) {
      const region = regions[index];

      updateOcrStatus(
        `${region.label} 읽는 중...`,
        15 + Math.round((index / regions.length) * 70),
        true
      );

      const result = await worker.recognize(region.image);
      rawResults[region.key] = (result.data.text || "").trim();
    }

    const extracted = {
      distance: parseDistance(rawResults.distance),
      time: parseWorkoutTime(rawResults.time),
      avgHeartRate: parseHeartRate(rawResults.heartRate)
    };

    console.log("Garmin OCR 원문", rawResults);
    console.log("Garmin 추출 결과", extracted);

    applyExtractedData(extracted);

    const resultLines = [];
    if (extracted.distance !== null) {
      resultLines.push(`거리 ${extracted.distance}km`);
    }
    if (extracted.time) {
      resultLines.push(`총 시간 ${extracted.time}`);
    }
    if (extracted.avgHeartRate !== null) {
      resultLines.push(`평균 심박 ${extracted.avgHeartRate}bpm`);
    }

    if (extracted.distance === null || !extracted.time) {
      updateOcrStatus("일부 값을 읽지 못했습니다.", 100, true);

      alert(
        `인식 결과\n\n${resultLines.join("\n") || "인식된 값이 없습니다."}\n\n` +
        "거리와 시간을 직접 확인해 주세요."
      );
      return;
    }

    updateOcrStatus("Garmin 데이터 인식 완료", 100, true);

    alert(
      `Garmin 읽기 완료\n\n${resultLines.join("\n")}\n\n` +
      "저장하기 전에 입력값을 확인해 주세요."
    );
  } catch (error) {
    console.error(error);
    updateOcrStatus("인식 실패", 0, true);
    alert(error.message || "Garmin 화면을 읽지 못했습니다.");
  } finally {
    if (worker) {
      await worker.terminate();
    }

    isAnalyzing = false;

    if (analyzeButton) {
      analyzeButton.disabled = false;
      analyzeButton.textContent = "Garmin 읽기";
    }
  }
}


function ensureTesseractLoaded() {
  if (typeof Tesseract !== "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tesseract-loader="true"]');

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.tesseractLoader = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));

    reader.onload = () => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 열지 못했습니다."));
      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function isGarminSummaryRatio(image) {
  const ratio = image.width / image.height;
  return ratio >= 1.55 && ratio <= 2.15;
}

function createGarminSummaryRegions(image) {
  return [
    {
      key: "distance",
      label: "거리",
      image: cropForOcr(image, 0.025, 0.02, 0.35, 0.20)
    },
    {
      key: "heartRate",
      label: "평균 심박",
      image: cropForOcr(image, 0.025, 0.39, 0.34, 0.17)
    },
    {
      key: "time",
      label: "총 시간",
      image: cropForOcr(image, 0.025, 0.70, 0.34, 0.17)
    }
  ];
}

function cropForOcr(image, xRatio, yRatio, widthRatio, heightRatio) {
  const sourceX = Math.round(image.width * xRatio);
  const sourceY = Math.round(image.height * yRatio);
  const sourceWidth = Math.round(image.width * widthRatio);
  const sourceHeight = Math.round(image.height * heightRatio);

  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth * scale;
  canvas.height = sourceHeight * scale;

  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const gray =
      pixels[index] * 0.299 +
      pixels[index + 1] * 0.587 +
      pixels[index + 2] * 0.114;

    const value = gray >= 105 ? 0 : 255;

    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);

  return canvas;
}

function parseDistance(rawText) {
  const text = String(rawText || "")
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "");

  const match = text.match(/\d{1,2}\.\d{1,2}/);

  if (match) {
    const value = Number.parseFloat(match[0]);
    if (value >= 0.1 && value <= 99.99) return value;
  }

  const digits = text.replace(/\D/g, "");

  if (digits.length === 3) {
    return Number(`${digits[0]}.${digits.slice(1)}`);
  }

  if (digits.length === 4) {
    return Number(`${digits.slice(0, 2)}.${digits.slice(2)}`);
  }

  return null;
}

function parseWorkoutTime(rawText) {
  const text = String(rawText || "")
    .replace(/[;,.]/g, ":")
    .replace(/[^0-9:]/g, "");

  const match = text.match(/\d{1,2}:\d{2}(?::\d{2})?/);

  if (match && validTime(match[0])) {
    return match[0];
  }

  const digits = text.replace(/\D/g, "");

  if (digits.length === 4) {
    const value = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    return validTime(value) ? value : null;
  }

  if (digits.length === 5) {
    const value = `${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3)}`;
    return validTime(value) ? value : null;
  }

  if (digits.length === 6) {
    const value = `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
    return validTime(value) ? value : null;
  }

  return null;
}

function parseHeartRate(rawText) {
  const values = String(rawText || "").match(/\d{2,3}/g) || [];

  return (
    values
      .map(Number)
      .find((value) => value >= 70 && value <= 230) ?? null
  );
}

function applyExtractedData(extracted) {
  const distanceInput = document.getElementById("distance");
  const timeInput = document.getElementById("time");

  if (extracted.distance !== null && distanceInput) {
    distanceInput.value = extracted.distance;
  }

  if (extracted.time && timeInput) {
    timeInput.value = extracted.time.replace(/\D/g, "");
  }

  preview();
}

function updateOcrStatus(text, progress, show) {
  const statusBox = document.getElementById("ocrStatus");
  const statusText = document.getElementById("ocrStatusText");
  const progressBar = document.getElementById("ocrProgressBar");

  if (statusText) statusText.textContent = text;

  if (progressBar) {
    progressBar.style.width =
      `${Math.max(0, Math.min(100, Number(progress) || 0))}%`;
  }

  statusBox?.classList.toggle("hidden", !show);
}

function clearCapturePreview() {
  const captureInput = document.getElementById("garminCapture");
  const previewBox = document.getElementById("capturePreviewBox");
  const previewImage = document.getElementById("capturePreviewImage");

  if (selectedCaptureUrl) {
    URL.revokeObjectURL(selectedCaptureUrl);
  }

  selectedCaptureUrl = null;
  selectedCaptureFile = null;

  if (captureInput) captureInput.value = "";
  if (previewImage) previewImage.removeAttribute("src");

  previewBox?.classList.add("hidden");
  updateOcrStatus("", 0, false);
}

function preview() {
  const distance = Number.parseFloat(
    document.getElementById("distance")?.value || "0"
  );

  const formattedTime = formatTime(
    document.getElementById("time")?.value || ""
  );

  const timePreview = document.getElementById("timePreview");
  const pacePreview = document.getElementById("pacePreview");

  if (timePreview) timePreview.textContent = formattedTime || "-";

  if (pacePreview) {
    pacePreview.textContent =
      distance > 0 && validTime(formattedTime)
        ? pace(distance, formattedTime)
        : "-";
  }
}

function saveWorkout() {
  const distanceInput = document.getElementById("distance");
  const timeInput = document.getElementById("time");

  const distance = Number.parseFloat(distanceInput?.value || "0");
  const formattedTime = formatTime(timeInput?.value || "");

  if (!Number.isFinite(distance) || distance <= 0) {
    alert("거리를 입력해 주세요.");
    distanceInput?.focus();
    return;
  }

  if (!validTime(formattedTime)) {
    alert("시간을 숫자로 입력해 주세요. 예: 5120 → 51:20");
    timeInput?.focus();
    return;
  }

  const log = {
    id: Date.now(),
    date: new Date().toISOString(),
    distance: round(distance),
    time: formattedTime,
    pace: pace(distance, formattedTime)
  };

  appData.logs.unshift(log);

  recalcWeek();
  save();
  renderApp();
  bind();

  selectedCaptureUrl = null;
  selectedCaptureFile = null;

  alert(
    `저장 완료\n${log.distance}km · ${log.time} · ${log.pace}`
  );
}

function formatTime(input) {
  const numbers = String(input || "").replace(/\D/g, "").slice(0, 6);

  if (!numbers) return "";

  if (numbers.length <= 2) {
    return `0:${numbers.padStart(2, "0")}`;
  }

  if (numbers.length <= 4) {
    return `${Number(numbers.slice(0, -2))}:${numbers.slice(-2)}`;
  }

  return (
    `${Number(numbers.slice(0, -4))}:` +
    `${numbers.slice(-4, -2)}:` +
    `${numbers.slice(-2)}`
  );
}

function validTime(time) {
  const parts = String(time).split(":").map(Number);

  if (parts.some(Number.isNaN)) return false;

  if (parts.length === 2) {
    return parts[0] >= 0 && parts[1] >= 0 && parts[1] < 60;
  }

  return (
    parts.length === 3 &&
    parts[0] >= 0 &&
    parts[1] >= 0 &&
    parts[1] < 60 &&
    parts[2] >= 0 &&
    parts[2] < 60
  );
}

function seconds(time) {
  const parts = time.split(":").map(Number);

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function pace(distance, time) {
  const paceSeconds = Math.round(seconds(time) / distance);
  const minutes = Math.floor(paceSeconds / 60);

  return (
    `${minutes}'` +
    `${String(paceSeconds % 60).padStart(2, "0")}` +
    `"/km`
  );
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;

  const start = new Date(now);
  start.setDate(now.getDate() + offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function recalcWeek() {
  const { start, end } = weekRange();

  appData.weekly.current = round(
    appData.logs
      .filter((log) => {
        const date = new Date(log.date);
        return date >= start && date < end;
      })
      .reduce(
        (sum, log) => sum + Number(log.distance || 0),
        0
      )
  );
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function save() {
  localStorage.setItem("roadToSub60_v1", JSON.stringify(appData));
}

function load() {
  const saved = localStorage.getItem("roadToSub60_v1");
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);

    appData.user = { ...appData.user, ...(parsed.user || {}) };
    appData.weekly = { ...appData.weekly, ...(parsed.weekly || {}) };
    appData.records = { ...appData.records, ...(parsed.records || {}) };

    appData.races = Array.isArray(parsed.races)
      ? parsed.races
      : appData.races;

    appData.logs = Array.isArray(parsed.logs)
      ? parsed.logs
      : [];
  } catch (error) {
    localStorage.removeItem("roadToSub60_v1");
  }
}
