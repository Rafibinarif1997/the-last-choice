const DATA = {
  17: {
    id:17, seed:"MEMORY", start:"UNKNOWN", questions:[
      {q:"What should this artifact remember?", a:[
        ["A","A forgotten place","A place no map remembers."],
        ["B","A human","Someone whose name disappeared."],
        ["C","A lost object","Something that should still exist."]
      ]},
      {q:"Where did the memory survive?", a:[
        ["A","Under the city","Buried beneath something ordinary."],
        ["B","Inside a photograph","A picture with no photographer."],
        ["C","In a dream","A memory that feels borrowed."]
      ]},
      {q:"What did it lose?", a:[
        ["A","Its name","Nobody can call it anymore."],
        ["B","Its way home","The return path is gone."],
        ["C","Its reflection","Even mirrors refuse it."]
      ]},
      {q:"Who discovers it?", a:[
        ["A","A stranger","They were never looking for it."],
        ["B","Its previous owner","The past catches up."],
        ["C","Nobody","Some things remain undiscovered."]
      ]},
      {q:"What should remain after everything else is gone?", a:[
        ["A","The memory","One final fragment survives."],
        ["B","The choice","The decision becomes the artifact."],
        ["C","Nothing","The story chooses silence."]
      ]}
    ]
  },
  23: {
    id:23, seed:"ECHO", start:"SILENT", questions:[
      {q:"What created the first echo?", a:[["A","A bell","One sound, forever delayed."],["B","A door","Something opened once."],["C","A voice","A sentence nobody finished."]]},
      {q:"Where does it live?", a:[["A","A tunnel","Darkness keeps the sound."],["B","An empty room","The walls remember."],["C","The ocean","The echo became a pulse."]]},
      {q:"What changes?", a:[["A","Its shape","The echo becomes visible."],["B","Its meaning","The same sound tells a new story."],["C","Its owner","It no longer belongs to anyone."]]},
      {q:"What calls it back?", a:[["A","Silence","Nothing is louder."],["B","A heartbeat","Something alive remains."],["C","A second echo","The past answers itself."]]},
      {q:"What is the final sound?", a:[["A","Hello","A beginning disguised as an ending."],["B","Goodbye","The door finally closes."],["C","Nothing","The archive goes quiet."]]}
    ]
  },
  41: {
    id:41, seed:"RELIC", start:"UNCLAIMED", questions:[
      {q:"What kind of relic is this?", a:[["A","A key","It opens something that no longer exists."],["B","A coin","Its other side was erased."],["C","A photograph","The subject is missing."]]},
      {q:"What is its origin?", a:[["A","A vanished city","Its coordinates are impossible."],["B","A private collection","The collector never existed."],["C","An unknown era","The dates disagree."]]},
      {q:"What damaged it?", a:[["A","Time","Every mark has a story."],["B","A fire","Part of the past became ash."],["C","A choice","Someone deliberately changed it."]]},
      {q:"What does it want?", a:[["A","To be found","The archive is not enough."],["B","To be forgotten","Some histories hurt."],["C","To be copied","One version should survive."]]},
      {q:"What remains?", a:[["A","The relic","It survives the story."],["B","The story","The object disappears."],["C","The mystery","No answer is the final answer."]]}
    ]
  }
};

const KEY="tlc_demo_v1";
let state = JSON.parse(localStorage.getItem(KEY) || "null") || {selected:null, progress:{}};

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function getProgress(id){
  if(!state.progress[id]) state.progress[id]={choices:[], path:[]};
  return state.progress[id];
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function visual(id, choices, large=false){
  const n=choices.length;
  const hue=(id*37+n*29)%360;
  const scale=1+n*.075;
  const rings=Math.min(n+1,6);
  let ringsHtml="";
  for(let i=0;i<rings;i++) ringsHtml+=`<i class="v-ring" style="--r:${110+i*38}px;--d:${7+i*2}s"></i>`;
  return `<div class="generated" style="--h:${hue};--s:${scale}">
    <div class="v-grid"></div>${ringsHtml}
    <div class="v-shard s1"></div><div class="v-shard s2"></div><div class="v-shard s3"></div>
    <div class="v-core"></div><div class="v-eye"></div>
    <span class="v-code">${id.toString().padStart(3,"0")} · ${n}/5</span>
  </div>`;
}

function renderArchive(){
  const grid=document.getElementById("archiveGrid");
  grid.innerHTML=Object.values(DATA).map(x=>{
    const p=getProgress(x.id), done=p.choices.length;
    return `<article class="archive-card" data-id="${x.id}">
      <div class="card-art">${visual(x.id,p.choices)}</div>
      <div class="card-meta"><b>UNKNOWN #${x.id}</b><span>${done===5?"COMPLETE":`CHOICE ${done}/5`}</span></div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".archive-card").forEach(c=>c.onclick=()=>openLab(+c.dataset.id));
}

function openLab(id){
  state.selected=id; save();
  document.getElementById("lab").classList.remove("hidden");
  document.getElementById("final").classList.add("hidden");
  document.getElementById("lab").scrollIntoView({behavior:"smooth",block:"start"});
  renderLab();
}

function renderLab(){
  const id=state.selected, x=DATA[id], p=getProgress(id), done=p.choices.length;
  if(done>=x.questions.length){showFinal();return}
  document.getElementById("labTitle").textContent=`UNKNOWN #${id}`;
  document.getElementById("labSubtitle").textContent=`${x.seed} SEED · ${done} DECISIONS MADE`;
  document.getElementById("stateLabel").textContent=done===0?x.start:"EVOLVED";
  document.getElementById("stateId").textContent=`#${id}`;
  document.getElementById("memoryLabel").textContent=`MEMORY ${done}`;
  document.getElementById("formLabel").textContent=done===0?"UNFINISHED":pathName(p);
  document.getElementById("largeVisual").innerHTML=visual(id,p.choices,true);
  document.getElementById("choiceCounter").textContent=`CHOICE ${String(done+1).padStart(2,"0")} / 05`;
  document.getElementById("pathRarity").textContent=`PATH: ${rarity(p)}`;
  document.getElementById("progressBar").style.width=`${done/5*100}%`;
  document.getElementById("question").textContent=x.questions[done].q;
  document.getElementById("choices").innerHTML=x.questions[done].a.map((a,i)=>`
    <button class="choice" data-index="${i}">
      <span class="letter">${a[0]}</span><span><b>${esc(a[1])}</b><small>${esc(a[2])}</small></span>
    </button>`).join("");
  document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>choose(+b.dataset.index));
  renderHistory();
}

function choose(index){
  const id=state.selected, x=DATA[id], p=getProgress(id), q=x.questions[p.choices.length], a=q.a[index];
  p.choices.push(index); p.path.push(a[1]); save();
  renderLab();
  if(p.choices.length===x.questions.length) setTimeout(showFinal,350);
}

function pathName(p){
  if(!p.path.length) return "UNFINISHED";
  return p.path[p.path.length-1].split(" ").slice(0,2).join(" ").toUpperCase();
}
function rarity(p){
  const code=p.choices.join("");
  if(!code) return "UNSET";
  const counts=[...new Set(p.choices)].length;
  return counts===1?"SINGULAR":counts===2?"RARE PATH":"WILD PATH";
}
function renderHistory(){
  const id=state.selected,p=getProgress(id),x=DATA[id];
  document.getElementById("historyCount").textContent=`${p.choices.length} decision${p.choices.length===1?"":"s"}`;
  document.getElementById("history").innerHTML=p.choices.map((choice,i)=>{
    const q=x.questions[i],a=q.a[choice];
    return `<div class="history-item"><span class="num">0${i+1}</span><p><b>${esc(a[1])}</b><br><small>${esc(q.q)}</small></p><span>${a[0]}</span></div>`;
  }).join("") || `<div class="history-item"><span class="num">--</span><p>No decisions yet.</p><span>∞</span></div>`;
}
function showFinal(){
  const id=state.selected,x=DATA[id],p=getProgress(id);
  document.getElementById("lab").classList.add("hidden");
  document.getElementById("final").classList.remove("hidden");
  document.getElementById("final").scrollIntoView({behavior:"smooth"});
  const last=p.path[4];
  document.getElementById("finalTitle").textContent=finalName(p);
  document.getElementById("finalText").textContent=`UNKNOWN #${id} began as ${x.start.toLowerCase()} and became ${last.toLowerCase()}. Five choices closed five possible worlds. This path is now its story.`;
  document.getElementById("finalStats").innerHTML=`<span>PATH ${p.choices.join("-")}</span><span>5 / 5 DECISIONS</span><span>${rarity(p)}</span>`;
}
function finalName(p){
  const words=p.path.flatMap(v=>v.replace(/[^a-zA-Z ]/g,"").split(" ")).filter(Boolean);
  const a=words[0]||"LAST", b=words[words.length-1]||"CHOICE";
  return `THE ${a.toUpperCase()} THAT ${b.toUpperCase()}`;
}

document.getElementById("backArchive").onclick=()=>{
  document.getElementById("lab").classList.add("hidden");
  document.getElementById("archive").scrollIntoView({behavior:"smooth"});
};
document.getElementById("againBtn").onclick=()=>{
  document.getElementById("final").classList.add("hidden");
  document.getElementById("archive").scrollIntoView({behavior:"smooth"});
  renderArchive();
};
document.getElementById("resetBtn").onclick=()=>{
  if(confirm("Reset all prototype choices?")){localStorage.removeItem(KEY);location.reload();}
};

renderArchive();
