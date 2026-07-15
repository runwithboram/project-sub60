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

    const timeInput =
    document.getElementById("time").value;

const time =
    formatTime(timeInput);

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

function formatTime(input) {

    const numbers = input.replace(/\D/g, "");

    if (numbers.length <= 2) {
        return numbers;
    }

    if (numbers.length <= 4) {

        const min = numbers.slice(0, numbers.length - 2);
        const sec = numbers.slice(-2);

        return `${parseInt(min,10)}:${sec}`;
    }

    const hour = numbers.slice(0, numbers.length - 4);
    const min = numbers.slice(-4, -2);
    const sec = numbers.slice(-2);

    return `${parseInt(hour,10)}:${min}:${sec}`;
}
