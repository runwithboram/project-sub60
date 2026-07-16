document.addEventListener("DOMContentLoaded",()=>{load();recalcWeek();renderApp();bind();});

function bind(){
 const d=document.getElementById("distance"),t=document.getElementById("time"),s=document.getElementById("saveRun");
 d?.addEventListener("input",preview);
 t?.addEventListener("input",()=>{t.value=t.value.replace(/\D/g,"").slice(0,6);preview();});
 s?.addEventListener("click",saveWorkout);
}
function preview(){
 const d=Number.parseFloat(document.getElementById("distance")?.value||"0");
 const f=formatTime(document.getElementById("time")?.value||"");
 document.getElementById("timePreview").textContent=f||"-";
 document.getElementById("pacePreview").textContent=d>0&&validTime(f)?pace(d,f):"-";
}
function saveWorkout(){
 const di=document.getElementById("distance"),ti=document.getElementById("time");
 const d=Number.parseFloat(di?.value||"0"),f=formatTime(ti?.value||"");
 if(!Number.isFinite(d)||d<=0){alert("거리를 입력해 주세요.");di?.focus();return;}
 if(!validTime(f)){alert("시간을 숫자로 입력해 주세요. 예: 5120 → 51:20");ti?.focus();return;}
 const log={id:Date.now(),date:new Date().toISOString(),distance:round(d),time:f,pace:pace(d,f)};
 appData.logs.unshift(log);recalcWeek();save();renderApp();bind();
 alert(`저장 완료\n${log.distance}km · ${log.time} · ${log.pace}`);
}
function formatTime(x){
 const n=String(x||"").replace(/\D/g,"").slice(0,6); if(!n)return"";
 if(n.length<=2)return`0:${n.padStart(2,"0")}`;
 if(n.length<=4)return`${Number(n.slice(0,-2))}:${n.slice(-2)}`;
 return`${Number(n.slice(0,-4))}:${n.slice(-4,-2)}:${n.slice(-2)}`;
}
function validTime(t){const p=String(t).split(":").map(Number);if(p.some(Number.isNaN))return false;return p.length===2?p[0]>=0&&p[1]>=0&&p[1]<60:p.length===3&&p[0]>=0&&p[1]>=0&&p[1]<60&&p[2]>=0&&p[2]<60;}
function seconds(t){const p=t.split(":").map(Number);return p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];}
function pace(d,t){const s=Math.round(seconds(t)/d),m=Math.floor(s/60);return`${m}'${String(s%60).padStart(2,"0")}"/km`;}
function weekRange(){const n=new Date(),day=n.getDay(),o=day===0?-6:1-day,s=new Date(n);s.setDate(n.getDate()+o);s.setHours(0,0,0,0);const e=new Date(s);e.setDate(s.getDate()+7);return{start:s,end:e};}
function recalcWeek(){const{start,end}=weekRange();appData.weekly.current=round(appData.logs.filter(l=>{const d=new Date(l.date);return d>=start&&d<end;}).reduce((a,l)=>a+Number(l.distance||0),0));}
function round(v){return Math.round((v+Number.EPSILON)*100)/100;}
function save(){localStorage.setItem("roadToSub60_v1",JSON.stringify(appData));}
function load(){const s=localStorage.getItem("roadToSub60_v1");if(!s)return;try{const p=JSON.parse(s);appData.user={...appData.user,...(p.user||{})};appData.weekly={...appData.weekly,...(p.weekly||{})};appData.records={...appData.records,...(p.records||{})};appData.races=Array.isArray(p.races)?p.races:appData.races;appData.logs=Array.isArray(p.logs)?p.logs:[];}catch(e){localStorage.removeItem("roadToSub60_v1");}}
