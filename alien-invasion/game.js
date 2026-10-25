import { WORLD, WEAPONS, SHIPS, PREP_SECONDS, SUPPLY_SECONDS, createGame, stepGame, placeWeapon, allSlots, nextSupply, clamp, distance } from './logic.js';
import { Renderer, drawWeapon } from './renderer.js';

const $ = s => document.querySelector(s);
const canvas = $('#game'), renderer = new Renderer(canvas), weaponNames = Object.keys(WEAPONS);
const ui = {
  time: $('#time'), threat: $('#threat'), kills: $('#kills'), best: $('#best'), pause: $('#pause'), sound: $('#sound'),
  supplyTime: $('#supply-time'), supplyProgress: $('#supply-progress'), supplyNext: $('#supply-next'),
  countdown: $('#countdown'), countdownNumber: $('#countdown-number'), notice: $('#notice'),
  pads: $('#pad-controls'), menu: $('#menu-screen'), paused: $('#paused-screen'), over: $('#over-screen'), guide: $('#guide-screen'),
  cards: [...document.querySelectorAll('[data-weapon]')], boardHint: $('#board-hint'),
};
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(`alienInvasion.${key}`)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(`alienInvasion.${key}`, JSON.stringify(value)); } catch { /* A private browser can still play. */ } }
let best = read('best', 0); if (!Number.isFinite(best) || best < 0) best = 0;
let muted = read('muted', false), mode = 'menu', state = createGame(12625), selected = 'sniper';
let sceneTime = 0, lastFrame = performance.now(), accumulator = 0, noticeTime = 0, padKey = '', refresh = 0, previousMode = 'menu';
let hover = null, keyboardPad = null, effects = [], particles = [], lastCountdown = 0, lastAlarm = -10;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

class Audio {
  constructor() { this.ctx = null; this.master = null; this.nextMusic = 0; this.musicIndex = 0; this.lastLaser = 0; }
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain(); this.master.gain.value = muted ? 0 : .22; this.master.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * .7, this.ctx.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { /* Sound is optional. */ }
  }
  volume() { if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .22, this.ctx.currentTime, .025); }
  tone(freq, duration, kind = 'sine', level = .3, end = freq, delay = 0) {
    if (!this.ctx || muted) return; const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = kind; o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  burst(level = .3, freq = 500, duration = .3) {
    if (!this.ctx || muted) return; const n=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter(),t=this.ctx.currentTime;n.buffer=this.noise;f.type='lowpass';f.frequency.setValueAtTime(freq,t);f.frequency.exponentialRampToValueAtTime(80,t+duration);g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);n.connect(f);f.connect(g);g.connect(this.master);n.start(t);n.stop(t+duration);
  }
  event(e) {
    if (muted || !this.ctx) return;
    if(e.type==='place'){this.tone(210,.11,'triangle',.24,340);this.tone(640,.10,'sine',.12,430,.04);}
    if(e.type==='shot'&&e.weapon==='sniper'){this.tone(950,.18,'sawtooth',.14,85);this.burst(.16,1700,.13);}
    if(e.type==='shot'&&e.weapon==='cannon'&&this.ctx.currentTime-this.lastLaser>.055){this.lastLaser=this.ctx.currentTime;this.tone(1100,.065,'triangle',.16,410);}
    if(e.type==='rocket'){this.burst(.16,1600,.22);this.tone(160,.2,'sawtooth',.12,490);}
    if(e.type==='blast'){this.burst(e.weapon==='bomb'?.9:.48,900,.45);this.tone(85,.3,'sine',.7,28);}
    if(e.type==='kill'){this.burst(.12,1300,.14);this.tone(240,.11,'triangle',.1,80);}
    if(e.type==='supply'||e.type==='map-open'){[440,554,660].forEach((f,i)=>this.tone(f,.25,'sine',.24,f,i*.10));}
    if(e.type==='map-warning'){this.tone(330,.22,'triangle',.25,330);this.tone(440,.22,'triangle',.25,440,.3);}
    if(e.type==='spent')this.tone(250,.1,'triangle',.12,170);
    if(e.type==='over'){[260,220,165,110].forEach((f,i)=>this.tone(f,.6,'triangle',.35,f*.8,i*.17));}
  }
  music() {
    if(!this.ctx||muted||mode!=='playing'||state.prep>0)return;
    const now=this.ctx.currentTime;if(now<this.nextMusic)return;this.nextMusic=now+1.35;
    const notes=[130.81,196,164.81,146.83,130.81,220,196,164.81],f=notes[this.musicIndex++%notes.length];
    this.tone(f,.85,'sine',.06,f);if(this.musicIndex%2)this.tone(f*2,1,'sine',.035,f*2,.16);
  }
}
const audio = new Audio();
function formatTime(t) { return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`; }
function setText(el,value){if(el.textContent!==String(value))el.textContent=value;}
function announce(message){$('#announcement').textContent=message;}
function notice(message,duration=3,warning=false){setText(ui.notice,message);ui.notice.classList.add('visible');ui.notice.classList.toggle('warning',warning);noticeTime=duration;}
function selectWeapon(type){if(!WEAPONS[type])return;selected=type;for(const card of ui.cards){const yes=card.dataset.weapon===type;card.classList.toggle('selected',yes);card.setAttribute('aria-pressed',yes);}$('#weapon-detail').textContent=WEAPONS[type].description;$('#detail-dot').style.background=WEAPONS[type].color;setText($('#toolbox-instruction'),`${WEAPONS[type].name} selected. Tap an empty + pad.`);syncHud();}
function newSeed(){if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}return Date.now()>>>0;}
function start(seed = newSeed()) {
  audio.unlock();state=createGame(seed);mode='playing';accumulator=0;effects=[];particles=[];hover=null;keyboardPad=null;noticeTime=0;ui.notice.classList.remove('visible');lastCountdown=0;lastAlarm=-10;padKey='';
  setText($('#home-status'),'HOME SWEET HOME');ui.boardHint.textContent='Select a weapon, then tap an empty +.';
  selectWeapon(selected);syncScreens();syncPads();syncHud();announce('Place your first defenses. Ships arrive in five seconds.');
}
function pause(value=true){if(value&&mode==='playing'){mode='paused';accumulator=0;hover=null;syncScreens();announce('Game paused.');}else if(!value&&mode==='paused'){audio.unlock();mode='playing';accumulator=0;syncScreens();}}
function toggleSound(){audio.unlock();muted=!muted;store('muted',muted);audio.volume();syncSound();}
function syncSound(){setText($('#sound-label'),muted?'Sound off':'Sound on');ui.sound.setAttribute('aria-label',muted?'Turn sound on':'Mute sound');ui.sound.setAttribute('aria-pressed',String(!muted));}
function openGuide(){if(mode==='guide')return;previousMode=mode;mode='guide';accumulator=0;hover=null;syncScreens();$('#close-guide').focus();}
function closeGuide(){mode=previousMode;accumulator=0;syncScreens();$('#help').focus();}
function syncScreens(){ui.menu.hidden=mode!=='menu';ui.paused.hidden=mode!=='paused';ui.over.hidden=mode!=='over';ui.guide.hidden=mode!=='guide';ui.pause.disabled=!['playing','paused'].includes(mode);ui.pause.setAttribute('aria-label',mode==='paused'?'Resume game':'Pause game');ui.countdown.hidden=mode!=='playing'||state.prep<=0;ui.pads.style.pointerEvents=mode==='playing'?'':'none';for(const b of ui.pads.children)b.disabled=mode!=='playing'||b.dataset.occupied==='true';}
function gameOver(){
  mode='over';accumulator=0;hover=null;const record=state.time>best;if(record){best=state.time;store('best',best);}
  setText($('#final-time'),formatTime(state.time));setText($('#final-kills'),state.kills);setText($('#final-threat'),state.level);
  setText($('#record'),record?'A new family record. Nicely defended.':`Personal best · ${formatTime(best)}`);
  setText($('#over-reason'),`A ${SHIPS[state.breach.ship].name.toLowerCase()} made it down passage ${String.fromCharCode(65+state.breach.laneId)}.`);
  setText($('#course-code'),`INVASION ${state.seed.toString(36).toUpperCase()}`);setText($('#home-status'),'ALIENS AT THE DOOR');setText(ui.boardHint,'A new invasion is one click away.');
  syncScreens();syncHud();$('#again').focus();announce(`Game over. You defended the house for ${formatTime(state.time)} and stopped ${state.kills} ships.`);
}
function syncPads(){
  const slots=allSlots(state),key=slots.map(s=>s.id).join('|');
  if(key!==padKey){
    const oldFocus=document.activeElement?.dataset?.slot;ui.pads.replaceChildren();
    for(const slot of slots){const b=document.createElement('button');b.type='button';b.className='pad';b.dataset.slot=slot.id;b.style.left=`${slot.x/WORLD.width*100}%`;b.style.top=`${slot.y/WORLD.height*100}%`;b.addEventListener('pointerenter',()=>{if(mode==='playing')hover=slot.id;});b.addEventListener('pointerleave',()=>{if(hover===slot.id)hover=null;});b.addEventListener('focus',()=>{if(mode==='playing'){hover=slot.id;keyboardPad=slot.id;}});b.addEventListener('blur',()=>{hover=null;});b.addEventListener('click',event=>{if(event.detail===0)deploy(slot.id);else{const near=closestPad(event.clientX,event.clientY);deploy(near?.id||slot.id);}});ui.pads.append(b);}
    padKey=key;if(oldFocus)ui.pads.querySelector(`[data-slot="${oldFocus}"]`)?.focus();
  }
  for(const b of ui.pads.children){const slot=slots.find(s=>s.id===b.dataset.slot),tower=state.towers.find(t=>t.slotId===slot.id),lane=state.lanes.find(l=>l.id===slot.laneId);b.dataset.occupied=String(Boolean(tower)||lane.retiring);b.disabled=mode!=='playing'||Boolean(tower)||lane.retiring;const label=`Passage ${String.fromCharCode(65+slot.laneId)}, ${slot.chamber<0?'last defense':slot.chamber===0?'upper chamber':'lower chamber'}, pad ${slot.id.split(':').at(-1)}`;b.setAttribute('aria-label',tower?`${label}: ${WEAPONS[tower.type].name}, ${tower.ammo} shots left`:`${label}: place ${WEAPONS[selected].name}`);}
}
function syncHud(){
  setText(ui.time,formatTime(state.time));setText(ui.threat,String(state.level).padStart(2,'0'));setText(ui.kills,state.kills);setText(ui.best,formatTime(best));
  const seconds=Math.ceil(state.supplyIn);if(ui.supplyTime.dataset.seconds!==String(seconds)){ui.supplyTime.innerHTML=`${seconds}<span>s</span>`;ui.supplyTime.dataset.seconds=String(seconds);}
  ui.supplyProgress.style.width=`${(1-state.supplyIn/SUPPLY_SECONDS)*100}%`;setText(ui.supplyNext,nextSupply(state).map(t=>WEAPONS[t].name).join(' + '));
  for(const card of ui.cards){const type=card.dataset.weapon,n=state.inventory[type].length;setText(card.querySelector('[data-count]'),n);card.classList.toggle('empty',!n);card.setAttribute('aria-label',`${WEAPONS[type].name}, ${WEAPONS[type].label}, ${n} available. ${WEAPONS[type].description}`);}
  [...$('#threat-meter').children].forEach((el,i)=>el.classList.toggle('active',i<Math.min(state.level,5)));
  ui.countdown.hidden=state.prep<=0||mode!=='playing';if(state.prep>0){const n=Math.ceil(state.prep);setText(ui.countdownNumber,n);if(n!==lastCountdown&&mode==='playing'){lastCountdown=n;audio.tone(380,.09,'sine',.15,380);}}
  if(state.warning){const action=state.warning.action==='add'?'New passage':state.warning.action==='remove'?'Passage closing':'Tunnel changing';setText(ui.boardHint,`${action} ${String.fromCharCode(65+state.warning.id)} · ${Math.ceil(state.warning.at-state.time)}s`);}
  else if(state.retiring)setText(ui.boardHint,`Passage ${String.fromCharCode(65+state.retiring.id)} draining · tools will return`);
  else if(mode==='playing')setText(ui.boardHint,state.prep>0?'Place defenses before they arrive.':'One ship gets through. Game over.');
  if(mode==='playing'){
    const close=state.enemies.find(e=>e.y>840&&!e.dead);
    setText($('#home-status'),close?'ALIEN NEAR HOME':'HOME SWEET HOME');
    if(close&&state.time-lastAlarm>7){lastAlarm=state.time;notice(`Passage ${String.fromCharCode(65+close.laneId)}: a ship is close to home!`,2.5,true);audio.tone(520,.16,'triangle',.25,520);audio.tone(390,.19,'triangle',.25,390,.2);}
  }
  syncPads();
}
function closestPad(clientX,clientY){const point=renderer.worldPoint(clientX,clientY),r=canvas.getBoundingClientRect();const radius=Math.max(33,23/r.width*WORLD.width);return allSlots(state).filter(p=>!state.towers.some(t=>t.slotId===p.id)&&!state.lanes.find(l=>l.id===p.laneId).retiring).map(p=>({...p,hitDistance:distance(p,point)})).filter(p=>p.hitDistance<radius).sort((a,b)=>a.hitDistance-b.hitDistance)[0];}
function deploy(id){
  if(mode!=='playing')return;audio.unlock();if(!state.inventory[selected].length){notice(`No ${WEAPONS[selected].name.toLowerCase()} left. Supplies in ${Math.ceil(state.supplyIn)}s.`,2);return;}
  const events=[];if(placeWeapon(state,id,selected,events)){handleEvents(events);hover=null;syncHud();}
}
canvas.addEventListener('pointermove',e=>{if(mode==='playing')hover=closestPad(e.clientX,e.clientY)?.id||null;});
canvas.addEventListener('pointerleave',()=>{hover=null;});
canvas.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();const pad=closestPad(e.clientX,e.clientY);if(pad)deploy(pad.id);else notice('Place weapons on an empty + pad.',1.6);});
for(const card of ui.cards)card.addEventListener('click',()=>{selectWeapon(card.dataset.weapon);if(mode==='playing')audio.tone(480,.04,'sine',.08,600);});
$('#start').addEventListener('click',()=>start());$('#again').addEventListener('click',()=>start());$('#retry').addEventListener('click',()=>start(state.seed));$('#resume').addEventListener('click',()=>pause(false));$('#restart-pause').addEventListener('click',()=>start());ui.pause.addEventListener('click',()=>pause(mode==='playing'));ui.sound.addEventListener('click',toggleSound);$('#help').addEventListener('click',openGuide);$('#close-guide').addEventListener('click',closeGuide);
addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(['Digit1','Digit2','Digit3','Digit4','Numpad1','Numpad2','Numpad3','Numpad4'].includes(e.code)){e.preventDefault();selectWeapon(weaponNames[Number(e.code.at(-1))-1]);}
  if(e.code==='KeyM'){e.preventDefault();toggleSound();}
  if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();if(mode==='guide')closeGuide();else pause(mode==='playing');}
  if(e.code==='Enter'||e.code==='NumpadEnter'){if(mode==='menu'||mode==='over'){e.preventDefault();start();}else if(mode==='paused'){e.preventDefault();pause(false);}}
  if(mode==='playing'&&e.code.startsWith('Arrow')){
    e.preventDefault();const available=allSlots(state).filter(p=>!state.towers.some(t=>t.slotId===p.id)&&!state.lanes.find(l=>l.id===p.laneId).retiring),current=allSlots(state).find(p=>p.id===(keyboardPad||hover))||{x:480,y:0};
    const dx=e.code==='ArrowLeft'?-1:e.code==='ArrowRight'?1:0,dy=e.code==='ArrowUp'?-1:e.code==='ArrowDown'?1:0;
    const candidates=available.filter(p=>(p.x-current.x)*dx+(p.y-current.y)*dy>8).sort((a,b)=>{const score=p=>distance(p,current)+Math.abs(dx?(p.y-current.y):(p.x-current.x))*1.8;return score(a)-score(b);});
    const next=candidates[0]||available[0];if(next){keyboardPad=next.id;hover=next.id;ui.pads.querySelector(`[data-slot="${next.id}"]`)?.focus();}
  }
});
addEventListener('blur',()=>{if(mode==='playing')pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause(true);});

function handleEvents(events){
  for(const e of events){
    audio.event(e);
    if(['place','shot','blast','spent','over'].includes(e.type))effects.push({...e,age:0,life:e.type==='shot'?(e.weapon==='sniper'?.19:.15):e.type==='blast'?.65:e.type==='spent'?1.1:.5});
    if(e.type==='kill'){
      const count=reducedMotion?5:e.ship==='cruiser'?20:12;
      for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,speed=40+Math.random()*140,life=.4+Math.random()*.6;particles.push({x:e.x,y:e.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,size:3+Math.random()*6,color:['#8fa17f','#c3ca9f','#eadca7','#897d97'][i%4],angle:a,life,max:life});}
    }
    if(e.type==='begin')notice('Here they come. Keep every passage covered.',3);
    if(e.type==='supply'){
      notice(`Delivery! ${e.weapons.map(t=>WEAPONS[t].name).join(' + ')}`,2.4);
      for(const type of new Set(e.weapons)){const card=ui.cards.find(c=>c.dataset.weapon===type);card.classList.remove('delivered');requestAnimationFrame(()=>card.classList.add('delivered'));}
      announce(`Supplies arrived: ${e.weapons.map(t=>WEAPONS[t].name).join(', ')}.`);
    }
    if(e.type==='map-warning')notice(`${e.action==='add'?'A new passage is opening':e.action==='remove'?'A passage is closing':'The tunnels are shifting'} · 8 seconds`,4,true);
    if(e.type==='map-open')notice(`Passage ${String.fromCharCode(65+e.id)} open! Extra cannon + blaster delivered.`,4,true);
    if(e.type==='map-change')notice(e.action==='morph'?'Tunnel reshaped. Unused ammunition returned.':'Passage closed. Unused ammunition returned.',3,true);
    if(e.type==='threat')announce(`Threat level ${e.level}.`);
    if(e.type==='over')gameOver();
  }
  if(effects.length>140)effects.splice(0,effects.length-140);if(particles.length>350)particles.splice(0,particles.length-350);
}
function frame(now){
  const dt=Math.min(.08,(now-lastFrame)/1000);lastFrame=now;
  if(!['paused','guide'].includes(mode))sceneTime+=reducedMotion?dt*.35:dt;
  if(mode==='playing'){
    accumulator+=dt;let steps=0;while(accumulator>=1/60&&mode==='playing'&&steps++<6){handleEvents(stepGame(state,1/60));accumulator-=1/60;}
    audio.music();
  }
  if(!['paused','guide'].includes(mode)){
    for(const e of effects)e.age+=dt;effects=effects.filter(e=>e.age<e.life);
    for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*2);p.vy=p.vy*Math.exp(-dt*2)+25*dt;p.angle+=dt*2;}particles=particles.filter(p=>p.life>0);
    noticeTime-=dt;if(noticeTime<=0)ui.notice.classList.remove('visible');
  }
  if((refresh+=dt)>.08){refresh=0;syncHud();}
  renderer.draw(state,{mode:mode==='guide'?previousMode:mode,time:sceneTime,selected,hover,effects,particles});requestAnimationFrame(frame);
}
for(const art of document.querySelectorAll('[data-art]')){const c=art.getContext('2d');c.scale(2,2);drawWeapon(c,art.dataset.art,45,42,-.7,.84,1,0,0);}
selectWeapon('sniper');syncScreens();syncSound();syncHud();requestAnimationFrame(frame);
// Useful for local developer inspection; no network, account, or telemetry is involved.
window.__alienInvasion={get state(){return state;},get mode(){return mode;},start,pause};
