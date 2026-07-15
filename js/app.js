document.addEventListener("DOMContentLoaded", () => {
    loadData();
    renderApp();
    initEvents();
});

function initEvents() {

    const startBtn = document.getElementById("startBtn");

    if (startBtn) {
        startBtn.addEventListener("click", () => {

            const form = document.getElementById("logForm");

            form.classList.toggle("hidden");

        });
    }

    const saveBtn = document.getElementById("saveRun");

    if (saveBtn) {

        saveBtn.addEventListener("click", saveWorkout);

    }

}

function saveWorkout() {

    const distance =
        parseFloat(document.getElementById("distance").value) || 0;

    const time =
        document.getElementById("time").value;

    const pace =
        document.getElementById("pace").value;

    if (distance <= 0) {

        alert("거리를 입력해주세요.");

        return;

    }

    if (!appData.logs) {

        appData.logs = [];

    }

    appData.logs.push({

        date: new Date().toLocaleDateString("ko-KR"),

        distance,

        time,

        pace

    });

    appData.weekly.current += distance;

    saveData();

    renderApp();

    initEvents();

    alert("운동 기록이 저장되었습니다! 🎉");

}

function saveData() {

    localStorage.setItem(

        "roadToSub60",

        JSON.stringify(appData)

    );

}

function loadData() {

    const saved = localStorage.getItem("roadToSub60");

    if (!saved) return;

    const parsed = JSON.parse(saved);

    Object.assign(appData, parsed);

}
