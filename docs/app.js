import {shuffle,selectQuestions,formatTime,validateRegistration,resultMessage} from './game.js';
const config=window.TRIVIA_CONFIG;
const demo=config.mode==='demo';
const app=document.querySelector('#app');
const shell=document.querySelector('.phone-shell');
const errorBox=document.querySelector('#error');
let state=null, demoGame=null, timerId, clockStart=0, bank=null, busy=false, rankCache=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const crest='<img class="crest" src="assets/escudo.png" alt="Escudo del Club Atlético Platense">';
const header=`<div class="topbar">${crest}<div class="wordmark">TRIVIA<br>CALAMAR</div></div>`;
const arrow='<span class="arrow" aria-hidden="true">›</span>';
function error(message){errorBox.textContent=message;errorBox.hidden=false;}
function clearError(){errorBox.hidden=true;errorBox.textContent='';}
function render(html,welcome=false){clearInterval(timerId);clearError();shell.classList.toggle('welcome',welcome);app.innerHTML=html;app.focus({preventScroll:true});window.scrollTo(0,0);}
function saveToken(t){try{sessionStorage.setItem('calamar-session',t);}catch{}}
function getToken(){try{return sessionStorage.getItem('calamar-session');}catch{return null;}}
function forgetToken(){try{sessionStorage.removeItem('calamar-session');}catch{}}
async function rpc(name,args={}){
 const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const res=await fetch(`${config.supabaseUrl.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal});
  const data=await res.json();
  if(!res.ok)throw new Error(data.message||'No pudimos conectar con el ranking.');
  return data;
 }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('No pudimos conectar. Revisá tu conexión y volvé a intentar.');throw e;}
 finally{clearTimeout(timeout);}
}
function demoState(){
 const finished=demoGame.index===10;
 const q=demoGame.questions[demoGame.index];
 return {token:'demo',answered:demoGame.index,finished,score:finished?demoGame.score:null,elapsed_ms:Math.round((demoGame.end||performance.now())-demoGame.start),question:q?{id:q.id,text:q.text,options:q.options}:null,registered:false};
}
async function task(fn){if(busy)return;busy=true;clearError();app.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){error(e.message);}finally{busy=false;app.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function home(){
 render(`<img class="hero-crest" src="assets/escudo.png" alt="Escudo de Platense con su estrella"><div class="eyebrow">Noche de Copas</div><h1>TRIVIA<br>CALAMAR</h1><div class="hero-rule"></div><p class="tagline">¿Cuánto sabés del Calamar?</p><p>10 preguntas. Toda tu pasión.</p><button class="primary" id="start">Empezar a jugar ${arrow}</button><p class="small">Sin registro para jugar.<br>El reloj arranca con la primera pregunta.</p>`,true);
 document.querySelector('#start').onclick=()=>task(async()=>{
  if(demo){bank ||= await fetch('questions.json').then(r=>{if(!r.ok)throw Error('No se pudo cargar la trivia.');return r.json();});demoGame={questions:selectQuestions(bank),index:0,score:0,start:performance.now(),end:null};state=demoState();}
  else{state=await rpc('trivia_start');saveToken(state.token);}
  rankCache=null;showState();
 });
}
function showState(){if(state.finished)result();else question();}
function question(){
 const q=state.question;
 render(`${header}<div class="progress" role="progressbar" aria-label="Preguntas respondidas" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${state.answered}"><span style="width:${state.answered*10}%"></span></div><div class="question-meta"><span>Pregunta ${state.answered+1} de 10</span><span class="timer" aria-label="Tiempo transcurrido">${formatTime(state.elapsed_ms)}</span></div><h2>${esc(q.text)}</h2><div class="answers">${shuffle(q.options.map((text,i)=>({text,i}))).map((o,i)=>`<button class="answer" data-choice="${o.i}"><span class="letter" aria-hidden="true">${String.fromCharCode(65+i)}</span><span>${esc(o.text)}</span></button>`).join('')}</div><p class="hint">Elegí una respuesta. ¡El tiempo corre!</p><p class="busy-status" role="status"></p>`);
 clockStart=performance.now()-state.elapsed_ms;
 timerId=setInterval(()=>{const timer=document.querySelector('.timer');if(timer)timer.textContent=formatTime(performance.now()-clockStart);},250);
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>task(async()=>{
  document.querySelector('.busy-status').textContent='Guardando respuesta…';
  try{
   if(demo){const actual=demoGame.questions[demoGame.index];if(Number(b.dataset.choice)===actual.answer)demoGame.score+=10;demoGame.index++;if(demoGame.index===10)demoGame.end=performance.now();state=demoState();}
   else state=await rpc('trivia_answer',{p_token:state.token,p_question_id:q.id,p_choice:Number(b.dataset.choice)});
   showState();
  }finally{const status=document.querySelector('.busy-status');if(status)status.textContent='';}
 }));
}
function result(){
 render(`<div class="center">${crest}<h1>¡Bien jugado!</h1><p class="muted">Tu resultado</p><div class="score">${state.score}</div><div class="score-label">PUNTOS</div><div class="stats"><div class="stat"><b>${state.score/10} de 10</b><span>Aciertos</span></div><div class="stat"><b>${formatTime(state.elapsed_ms)}</b><span>Tiempo</span></div></div><p class="result-message">${resultMessage(state.score)}</p><button class="primary" id="join">${state.registered?'Ver ranking':'Entrar al ranking'} ${arrow}</button><p class="hint">${state.registered?'Tu participación ya quedó registrada.':'Completá tus datos y descubrí tu puesto.'}</p><button class="secondary" id="again">Volver a jugar</button></div>`);
 document.querySelector('#join').onclick=()=>state.registered?task(loadRanking):registration();
 document.querySelector('#again').onclick=restart;
}
function restart(){state=null;rankCache=null;forgetToken();home();}
function registration(){
 render(`<div class="center">${crest}<h1>Sumate al ranking</h1><div class="summary-pill">${state.score} puntos · ${formatTime(state.elapsed_ms)}</div></div>${demo?'<p class="muted">Esta es una prueba. Usá datos ficticios: no se envían ni se guardan.</p>':''}<form id="register"><label class="field">Nombre<input name="first" autocomplete="given-name" minlength="2" maxlength="60" required></label><label class="field">Apellido<input name="last" autocomplete="family-name" minlength="2" maxlength="60" required></label><label class="field">Mail<input name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required></label><p class="notice">El Club Atlético Platense usará tus datos para registrar tu resultado. En el ranking mostraremos tu nombre e inicial del apellido. Los registros de la trivia se eliminarán de la base activa a los 90 días del evento.</p><label class="check"><input name="consent" type="checkbox" required><span>Leí el Aviso de privacidad y autorizo el uso de mis datos y la publicación de mi nombre, inicial del apellido, puntaje y tiempo en el ranking.</span></label><label class="check"><input name="marketing" type="checkbox"><span>Quiero recibir por mail novedades y próximos eventos del club. Es opcional y puedo darme de baja.</span></label><a class="privacy-link" href="privacidad.html" target="_blank" rel="noopener">Leer el Aviso de privacidad ↗</a><button class="primary" type="submit">Guardar y ver ranking ${arrow}</button><p class="hint">Solo la primera partida registrada por mail cuenta.</p></form><button class="secondary" id="back">Volver a mi resultado</button>`);
 document.querySelector('#back').onclick=result;
 document.querySelector('#register').onsubmit=e=>{
  e.preventDefault();const fd=new FormData(e.target);const data={first:fd.get('first').trim(),last:fd.get('last').trim(),email:fd.get('email').trim().toLowerCase(),consent:fd.get('consent')==='on',marketing:fd.get('marketing')==='on'};
  const invalid=validateRegistration(data);if(invalid){error(invalid);return;}
  task(async()=>{
   if(demo){const all=[{id:1,name:'Martín G.',score:100,elapsed_ms:72000},{id:2,name:'Lucía P.',score:100,elapsed_ms:88000},{id:3,name:`${data.first} ${data.last[0].toUpperCase()}.`,score:state.score,elapsed_ms:state.elapsed_ms},{id:4,name:'Paula M.',score:80,elapsed_ms:109000},{id:5,name:'Diego R.',score:70,elapsed_ms:80000}].sort((a,b)=>b.score-a.score||a.elapsed_ms-b.elapsed_ms||a.id-b.id).map((r,i)=>({...r,position:i+1,mine:r.id===3}));rankCache={rows:all,mine:all.find(r=>r.mine),total:5};state.registered=true;ranking();}
   else{const response=await rpc('trivia_register',{p_token:state.token,p_first:data.first,p_last:data.last,p_email:data.email,p_consent:data.consent,p_marketing:data.marketing,p_notice_version:config.privacyVersion});state.registered=true;state.duplicate=response.duplicate;await loadRanking();}
  });
 };
}
async function loadRanking(){if(!demo)rankCache=await rpc('trivia_ranking',{p_token:state.token});ranking();}
function ranking(){
 const mine=rankCache.mine;
 render(`<div class="center">${crest}<h1>Ranking Calamar</h1><p>Noche de Copas</p><p class="muted">Más puntos. Menor tiempo.</p></div>${demo?'<p class="hint">Ranking de ejemplo · Solo visible en esta prueba</p>':''}${state.duplicate?'<p class="rank-summary">Este mail ya tenía una participación. Conservamos el primer resultado registrado.</p>':''}${mine?`<p class="rank-summary">Tu puesto: <b>#${mine.position}</b> de ${rankCache.total} participantes · ${mine.score} puntos</p>`:''}<table class="ranking"><caption class="hint">${rankCache.total>50?'Primeros 50 puestos':'Participantes'}</caption><thead><tr><th scope="col">Jugador</th><th scope="col">Puntos</th><th scope="col">Tiempo</th></tr></thead><tbody>${rankCache.rows.map(r=>`<tr class="${r.mine?'me':''}"><td><span class="position">${r.position}</span>${esc(r.name)}${r.mine?'<span class="you">Vos</span>':''}</td><td>${r.score}</td><td>${formatTime(r.elapsed_ms)}</td></tr>`).join('')}</tbody></table><p class="hint">Desempate por tiempo exacto. Si también coincide, por orden de registro.</p><button class="primary" id="again">Volver a jugar ${arrow}</button><button class="secondary" id="refresh">Actualizar ranking</button>`);
 document.querySelector('#again').onclick=restart;
 document.querySelector('#refresh').onclick=()=>task(loadRanking);
}
async function boot(){
 document.querySelector('#demo-banner').hidden=!demo;
 if(!demo&&(config.mode!=='live'||!config.privacyReady||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)||!config.supabasePublishableKey)){
  render(`<div class="center">${crest}<h1>Estamos preparando la trivia</h1><p>En breve vas a poder jugar. ¡Nos vemos en Noche de Copas!</p></div>`);return;
 }
 if(!demo&&getToken()){
  try{state=await rpc('trivia_resume',{p_token:getToken()});showState();return;}
  catch(e){render(`<div class="center">${crest}<h1>Recuperá tu partida</h1><p>Podés volver a intentar o empezar una nueva.</p><button class="primary" id="retry">Volver a intentar</button><button class="secondary" id="new-game">Empezar de nuevo</button></div>`);error(e.message);document.querySelector('#retry').onclick=()=>task(boot);document.querySelector('#new-game').onclick=restart;return;}
 }
 home();
}
boot();
