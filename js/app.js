document.addEventListener("DOMContentLoaded", () => {

    renderApp();

    initEvents();

});

function initEvents(){

    const startBtn=document.getElementById("startBtn");

    const logForm=document.getElementById("logForm");

    startBtn.addEventListener("click",()=>{

        logForm.classList.toggle("hidden");

    });

}
