/* ===================================
   Road to SUB60
   Version 0.2
=================================== */

// ---------------------------
// Race Date
// ---------------------------

const raceDate = new Date("2026-11-15");

// ---------------------------
// D-Day
// ---------------------------

function updateDday(){

    const today = new Date();

    const diff = raceDate - today;

    const days = Math.ceil(
        diff / (1000*60*60*24)
    );

    const target = document.getElementById("dday");

    if(target){

        target.innerHTML = `D-${days}`;

    }

}

updateDday();


// ---------------------------
// Greeting
// ---------------------------

function updateGreeting(){

    const hour = new Date().getHours();

    let text = "Good Evening";

    if(hour < 12){

        text = "☀️ Good Morning";

    }

    else if(hour < 18){

        text = "🌤 Good Afternoon";

    }

    const greeting =
        document.querySelector(".greeting");

    if(greeting){

        greeting.innerHTML = text;

    }

}

updateGreeting();


// ---------------------------
// Mission Button
// ---------------------------

const missionBtn =
document.querySelector(".mission button");

if(missionBtn){

missionBtn.addEventListener("click",()=>{

missionBtn.innerHTML="Completed";

missionBtn.style.background="#47E0A1";

missionBtn.style.color="#07111F";

localStorage.setItem(
"mission",
"done"
);

});

}


// ---------------------------
// Restore Mission
// ---------------------------

if(localStorage.getItem("mission")=="done"){

missionBtn.innerHTML="Completed";

missionBtn.style.background="#47E0A1";

missionBtn.style.color="#07111F";

}


// ---------------------------
// Progress Animation
// ---------------------------

const goalFill =
document.querySelector(".goal-fill");

if(goalFill){

goalFill.animate(

[
{

width:"0%"

},

{

width:"72%"

}

],

{

duration:1200,

fill:"forwards",

easing:"ease"

}

);

}


// ---------------------------
// Fade Cards
// ---------------------------

const cards =
document.querySelectorAll(".card");

cards.forEach((card,index)=>{

card.style.opacity=0;

card.style.transform="translateY(20px)";

setTimeout(()=>{

card.style.transition=".5s";

card.style.opacity=1;

card.style.transform="translateY(0px)";

},index*120);

});


// ---------------------------
// Navigation
// ---------------------------

const navItems =
document.querySelectorAll(".nav-item");

navItems.forEach(item=>{

item.addEventListener("click",()=>{

navItems.forEach(i=>

i.classList.remove("active")

);

item.classList.add("active");

});

});


// ---------------------------
// Dummy Coach
// ---------------------------

const coachMessage = [

"오늘은 회복을 우선하세요.",

"무리하지 말고 페이스를 유지하세요.",

"주말 LSD가 이번 주 핵심입니다.",

"수영은 러닝 회복에 도움이 됩니다.",

"SUB60까지 한 걸음씩 갑니다."

];

const coachBox =
document.querySelector(".coach-message");

if(coachBox){

const random =
Math.floor(
Math.random()*
coachMessage.length
);

coachBox.innerHTML=
coachMessage[random];

}


// ---------------------------
// Console
// ---------------------------

console.log(

"🏃 Road to SUB60 v0.2 Loaded"

);
