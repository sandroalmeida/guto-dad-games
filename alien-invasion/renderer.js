import { WORLD, WEAPONS, SHIPS, hash, at, allSlots, isInTunnel, clamp } from './logic.js';

const INK = '#45364f';
const TAU = Math.PI * 2;
function ellipse(c, x, y, rx, ry, color, stroke, width = 2) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = color; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function rect(c, x, y, w, h, r, fill, stroke, width = 2) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function line(c, points, color, width = 2) { c.beginPath(); c.moveTo(...points[0]); for (const p of points.slice(1)) c.lineTo(...p); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function polygon(c, points, color, stroke, width = 2) { c.beginPath(); c.moveTo(...points[0]); for (const p of points.slice(1)) c.lineTo(...p); c.closePath(); c.fillStyle = color; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); } }
function glow(c, x, y, r, color) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ellipse(c, x, y, r, r, g); }
function path(c, route) { c.beginPath(); c.moveTo(route.points[0].x, route.points[0].y); for (const p of route.points.slice(1)) c.lineTo(p.x, p.y); }
function text(c, str, x, y, size = 15, color = INK, align = 'center') { c.font = `800 ${size}px "Trebuchet MS", sans-serif`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(str, x, y); }

export function drawWeapon(c, type, x, y, angle = -Math.PI / 2, scale = 1, ammo = 1, recoil = 0, t = 0) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  ellipse(c, 3, 10, 27, 18, '#4c37504a');
  ellipse(c, 0, 4, 25, 20, '#867588', INK, 2.5);
  ellipse(c, 0, 0, 24, 19, '#e4dbbe', INK, 2.5);
  for (const a of [0, 2.1, 4.2]) ellipse(c, Math.cos(a) * 19, Math.sin(a) * 14, 2.3, 2.3, '#786b7d');
  if (type === 'bomb') {
    const g = c.createRadialGradient(-6, -10, 2, 0, 0, 22); g.addColorStop(0, '#cbb9e1'); g.addColorStop(.6, '#8b729d'); g.addColorStop(1, '#554d6a');
    ellipse(c, 0, -4, 18, 20, g, INK, 2.5);
    rect(c, -19, -8, 38, 8, 3, '#f2c86c', INK, 1.5);
    for (let i = -12; i < 17; i += 9) line(c, [[i,-7],[i-4,-1]], '#7c5265', 3);
    rect(c, -7, -26, 14, 8, 3, '#7d8d7c', INK);
    line(c, [[1,-26],[1,-33],[9,-37],[13,-31]], '#56475e', 3);
    ellipse(c, 13, -31, 3.5, 3.5, Math.sin(t * 6) > 0 ? '#ffdd8b' : '#d59762');
    ellipse(c, 0, -4, 4, 4, '#f9f0b0', '#786056', 1);
  } else {
    c.rotate(angle + Math.PI / 2); c.translate(0, recoil * 5);
    const color = WEAPONS[type].color;
    rect(c, -17, -17, 34, 31, 9, '#536666', INK, 2.5);
    rect(c, -14, -19, 28, 27, 7, color, INK, 2.5);
    rect(c, -9, -13, 18, 12, 3, '#f7e4b8', '#74666d', 1.5);
    if (type === 'sniper') {
      rect(c, -5, -53, 10, 41, 3, '#566977', INK, 2);
      rect(c, -7, -53, 14, 8, 2, '#b3b8af', INK, 2);
      rect(c, 6, -31, 7, 21, 3, '#87657e', INK, 1.5);
      ellipse(c, 9.5, -31, 3, 3, '#96e5d5');
      for (let i = 0; i < 3; i++) line(c, [[-5,-34+i*5],[5,-34+i*5]], '#a0b1ad', 1.5);
    } else if (type === 'blaster') {
      const g = c.createLinearGradient(-14,0,14,0); g.addColorStop(0, '#a95560'); g.addColorStop(.45, '#f5aa80'); g.addColorStop(1, '#bd6970');
      rect(c, -13, -45, 26, 36, 6, g, INK, 2.5);
      rect(c, -16, -47, 32, 10, 3, '#718e89', INK, 2);
      ellipse(c, 0, -47, 12, 5, '#354c5e', INK, 1.5);
      ellipse(c, 0, -47, 7, 2.5, '#fbd78a');
      line(c, [[-19,-25],[-19,2]], '#e5c385', 4); line(c, [[19,-25],[19,2]], '#e5c385', 4);
      rect(c, -7, 8, 14, 10, 3, '#8c626e', INK);
    } else {
      for (const dx of [-8,8]) {
        rect(c, dx-4, -39, 8, 27, 2, '#728e99', INK, 2);
        rect(c, dx-5, -42, 10, 7, 2, '#a4d5c8', INK, 1.5);
      }
      rect(c, -6, -29, 12, 24, 3, '#88c4b6', INK, 1.5);
      for (let i = 0; i < 3; i++) line(c, [[-4,-22+i*5],[4,-22+i*5]], '#d9f1c0', 2);
      ellipse(c, 0, 0, 5, 5, '#b5e2c5', INK, 1.5);
    }
  }
  c.restore();
  if (ammo < 1) {
    c.save(); c.translate(x, y); c.scale(scale, scale); c.beginPath(); c.arc(0, 0, 31, -.5*Math.PI, -.5*Math.PI+TAU*ammo); c.strokeStyle=ammo<.25?'#de775e':'#559b8e';c.lineWidth=4;c.lineCap='round';c.stroke();c.restore();
  }
}

export function drawShip(c, e, time, displayScale = 1) {
  const spec = SHIPS[e.type], r = spec.size / 23 * displayScale;
  c.save(); c.translate(e.x, e.y); c.rotate(e.angle - Math.PI / 2); c.scale(r, r);
  const bob = Math.sin(time * 3 + e.phase) * 1.7;
  ellipse(c, 4, 11, e.type === 'cruiser' ? 31 : 26, 15, '#4f3f4a35'); c.translate(0,bob);
  const exhaust = 8 + Math.sin(time * 29 + e.phase) * 3;
  for (const x of [-14, 14]) { glow(c, x, -22, 15, '#b5edf279'); ellipse(c,x,-22-exhaust/2,4,exhaust,'#8cd1c0aa');ellipse(c,x,-23,2,5,'#e3f6c4'); }
  if (e.type === 'dart') {
    polygon(c, [[0,32],[-12,10],[-26,-16],[-13,-13],[-6,-28],[6,-28],[13,-13],[26,-16],[12,10]], '#859daf', INK, 2.3);
    polygon(c, [[0,31],[-9,-13],[0,-23],[9,-13]], '#b7cede', '#5a657c', 1.5);
    polygon(c, [[-14,0],[-24,-13],[-14,-10]], '#dc826b');polygon(c, [[14,0],[24,-13],[14,-10]], '#dc826b');
    ellipse(c,0,-4,7,13,'#4a766e',INK,1.5);ellipse(c,-1,-7,4,6,'#a9d49b');
    line(c,[[0,10],[0,22]],'#eed4a0',2);
  } else {
    const armored=e.type==='cruiser';
    for (const x of [-23,23]) { rect(c,x-5,-16,10,32,4,armored?'#8a718c':'#b2bb78',INK,1.8);ellipse(c,x,12,3,4,'#f1bf79',INK,1); }
    const body=c.createLinearGradient(0,-24,0,25);body.addColorStop(0,armored?'#bea1c8':'#c7d79b');body.addColorStop(.48,armored?'#8f7ca7':'#8faa70');body.addColorStop(1,armored?'#5b526e':'#577964');
    ellipse(c,0,2,31,21,'#52635f',INK,2.5);ellipse(c,0,-2,30,20,body,INK,2.3);
    ellipse(c,0,-4,23,15,armored?'#a595b6':'#c6cfa0','#64726b',1.5);
    if(armored){for(const side of[-1,1])polygon(c,[[side*11,-18],[side*25,-12],[side*25,9],[side*14,14]],'#9589a6','#64556e',1.5);}
    for(const a of[.25,1.1,2.05,2.9]){const x=Math.cos(a)*25,y=Math.sin(a)*14+1;ellipse(c,x,y,3.2,2.2,'#fae2a3','#637366',1);}
    const dome=c.createRadialGradient(-5,-13,1,0,-7,15);dome.addColorStop(0,'#d2f0d2');dome.addColorStop(.55,'#8aba9f');dome.addColorStop(1,'#4f8783');
    ellipse(c,0,-9,14,13,dome,INK,2);
    // Alien pilot: forehead, enormous eyes, slit mouth, a reflected dome highlight.
    ellipse(c,0,-8,8,9,armored?'#c8d08e':'#bedc87');
    for(const x of[-3.5,3.5]){c.save();c.translate(x,-8);c.rotate(x<0?-.2:.2);ellipse(c,0,0,2.4,3.6,'#344e53');ellipse(c,-.6,-1, .7,.9,'#f2f5cc');c.restore();}
    line(c,[[-2,-1],[2,-1]],'#63805c',1);
    c.beginPath();c.ellipse(-4,-13,6,3,-.7,Math.PI,TAU);c.strokeStyle='#f3fbe6c9';c.lineWidth=2;c.stroke();
    line(c,[[0,-23],[0,-30]],'#565570',1.6);ellipse(c,0,-31,2.4,2.4,armored?'#edb76f':'#d2efb1',INK,1);
    if(armored){for(const x of[-18,18]){rect(c,x-4,12,8,15,2,'#5e586b',INK,1.5);ellipse(c,x,26,3,2,'#e5b68c');}}
  }
  if(e.hit>0){c.globalAlpha=e.hit/.13*.45;ellipse(c,0,-2,33,23,'#fff5c8');c.globalAlpha=1;}
  c.restore();
  if(e.hp<e.maxHp){const bw=SHIPS[e.type].size*2;rect(c,e.x-bw/2,e.y+spec.size+15,bw,4,2,'#6f617454');rect(c,e.x-bw/2,e.y+spec.size+15,bw*Math.max(0,e.hp/e.maxHp),4,2,e.hp/e.maxHp<.3?'#dd8168':'#729e72');}
}

function drawCrystal(c,x,y,s,seed){
  c.save();c.translate(x,y);c.scale(s,s);ellipse(c,3,10,22,9,'#6d598e35');
  const colors=seed>.45?['#b0cbd1','#7d9eb5','#d6e4df']:['#d7b4ca','#a77fbb','#f0d5d5'];
  for(const [dx,h,w]of[[-12,21,9],[0,36,12],[13,25,9]]){polygon(c,[[dx-w,7],[dx-w*.7,-h*.6],[dx,-h],[dx+w,-h*.6],[dx+w,6],[dx,11]],colors[0],'#82719a',1);polygon(c,[[dx,-h],[dx+w,-h*.6],[dx+w,6],[dx,11]],colors[1]);line(c,[[dx-w*.4,-h*.5],[dx,-h+6]],colors[2],2);}
  c.restore();
}
function drawHouse(c,time,breached){
  const x=WORLD.homeX,y=WORLD.homeY;
  c.save();c.translate(x,y);
  ellipse(c,0,18,119,37,'#7e82715c');ellipse(c,0,11,111,31,'#a8b18b','#79876f',2);
  for(const side of[-1,1]){for(let i=0;i<4;i++){const xx=side*(63+i*12);rect(c,xx-3,-4,6,27,2,'#f0ddad','#bda887',1);}line(c,[[side*59,4],[side*103,4]],'#ddcba5',4);}
  rect(c,-51,-43,102,69,4,'#ead8a4',INK,2.5);
  rect(c,39,-62,14,24,2,'#b67c6f',INK,2);
  for(let i=0;i<3;i++)line(c,[[-49,-26+i*16],[49,-26+i*16]],'#cbb88d',1);
  polygon(c,[[-65,-40],[0,-92],[65,-40],[56,-31],[0,-76],[-55,-31]],'#a75c62',INK,2.5);
  polygon(c,[[-61,-42],[0,-89],[61,-42],[0,-51]],'#df8c73',INK,2);
  for(let i=1;i<=4;i++)line(c,[[-55+i*12,-40-i*8],[52-i*12,-40-i*8]],'#bd6c65',1.3);
  rect(c,-13,-8,26,38,4,'#6b9290',INK,2);rect(c,-8,-4,16,17,2,'#e7dab0','#55706d',1);ellipse(c,6,18,2,2,'#e8d5a1');
  for(const xx of[-33,33]){if(!breached)glow(c,xx,-12,29,'#ffdd7a44');rect(c,xx-10,-24,20,23,3,breached?'#747c89':'#ffdf86',INK,2);line(c,[[xx,-23],[xx,-2]],'#806b68',2);line(c,[[xx-9,-12],[xx+9,-12]],'#806b68',2);rect(c,xx-13,0,26,5,1,'#bf8b73',INK,1);}
  rect(c,-23,29,46,6,2,'#ddc6a1','#aa8f8a',1);
  for(const xx of[-50,50]){rect(c,xx-6,14,12,12,2,'#c8876d','#8d6f74',1);for(let i=0;i<3;i++){line(c,[[xx,14],[xx+(i-1)*6,3-i*3]],'#719779',2);ellipse(c,xx+(i-1)*6,3-i*3,4,3,'#d0b3cf');}}
  line(c,[[-23,-69],[-29,-106],[-46,-108]],'#7a7787',2);ellipse(c,-30,-106,3,3,'#e8cd8e');
  for(let i=0;i<3;i++){const t=(time*.2+i*.33)%1;c.globalAlpha=(1-t)*.25;ellipse(c,46+Math.sin(t*4)*10,-71-t*39,5+t*12,4+t*8,'#f2e5d9');}c.globalAlpha=1;
  c.restore();
}

function backdrop(s, extraConnectors){
  const canvas=document.createElement('canvas');canvas.width=WORLD.width;canvas.height=WORLD.height;const c=canvas.getContext('2d');
  const g=c.createLinearGradient(0,0,960,1060);g.addColorStop(0,'#c3b4d3');g.addColorStop(.45,'#d4bfd9');g.addColorStop(1,'#b4b7c9');c.fillStyle=g;c.fillRect(0,0,960,1060);
  // Layers of exposed stone, engraved contour lines, flecks, fossils, and crystalline pockets.
  for(let band=0;band<15;band++){
    const y=band*83-30;c.beginPath();c.moveTo(-20,y);for(let x=0;x<=1040;x+=65)c.lineTo(x,y+Math.sin(x*.007+band*2)*24+hash(band*23+x)*19);c.lineTo(1020,y+57);c.lineTo(-20,y+57);c.closePath();c.fillStyle=band%2?'#997fa414':'#f8e8d71a';c.fill();
    c.beginPath();c.moveTo(-20,y+4);for(let x=0;x<=1040;x+=65)c.lineTo(x,y+Math.sin(x*.007+band*2)*24+hash(band*23+x)*19+4);c.strokeStyle='#826f9320';c.lineWidth=2;c.stroke();
  }
  for(let i=0;i<1000;i++){const x=hash(i*5+13)*960,y=hash(i*11+7)*1060;c.fillStyle=i%3?'#765c8120':'#fff2dc40';ellipse(c,x,y,hash(i+17)*2+.4,hash(i+31)+.4,c.fillStyle);}
  const connectors=[...s.connectors,...extraConnectors];
  // Render connected cuts in passes so the rims do not cross the chamber floors.
  const layers=[{w:100,rx:12,dy:9,color:'#74617f36'},{w:89,rx:8,dy:3,color:'#9b829f'},{w:80,rx:3,dy:0,color:'#b49ab3'},{w:70,rx:0,dy:0,color:'#f1dfb9'}];
  for(const layer of layers){c.save();c.translate(0,layer.dy);c.strokeStyle=layer.color;c.lineWidth=layer.w;c.lineCap='round';c.lineJoin='round';for(const lane of s.lanes){path(c,lane.path);c.stroke();}for(const link of connectors){path(c,link.path);c.stroke();}for(const lane of s.lanes)for(const ch of lane.chambers)ellipse(c,ch.x,ch.y,ch.rx+layer.rx,ch.ry+layer.rx,layer.color);c.restore();}
  for(const lane of s.lanes){
    for(const ch of lane.chambers){const floor=c.createRadialGradient(ch.x-13,ch.y-16,4,ch.x,ch.y,ch.rx);floor.addColorStop(0,'#fff0cc88');floor.addColorStop(1,'#c6ab8133');ellipse(c,ch.x,ch.y,ch.rx-5,ch.ry-5,floor);c.strokeStyle='#bba17c45';c.lineWidth=1;c.beginPath();c.ellipse(ch.x,ch.y,ch.rx-13,ch.ry-13,0,.3,2.8);c.stroke();
      for(const side of[-1,1]){const x=ch.x+side*(ch.rx+3);rect(c,x-4,ch.y-11,8,22,3,'#7e7286','#665875',1);rect(c,x-2,ch.y-7,4,12,1,'#ffe7a1');glow(c,x,ch.y,15,'#ffe7a155');}
      text(c,`${ch.capacity} PADS`,ch.x,ch.y-ch.ry+19,10,'#9d8a73');
    }
    c.save();c.globalAlpha=.35;for(const y of[150,430,785,894]){const p=lane.path.points.reduce((a,b)=>Math.abs(a.y-y)<Math.abs(b.y-y)?a:b);c.save();c.translate(p.x,p.y);line(c,[[-5,-5],[0,0],[5,-5]],'#ae9474',2);c.restore();}c.restore();
    // Airlock mouth, fasteners, hazard strips, and an entrance identifier.
    const x=lane.x;rect(c,x-40,33,80,23,8,'#8a7c92',INK,2);rect(c,x-34,36,68,15,5,'#4f596a',INK,1.5);for(let i=0;i<5;i++)line(c,[[x-28+i*14,37],[x-34+i*14,49]],'#c7b58d',4);for(const side of[-1,1]){ellipse(c,x+side*34,43,2,2,'#d1c7b7');rect(c,x+side*46-3,35,6,14,2,'#a6c2aa','#6c7180',1);}
    text(c,String.fromCharCode(65+lane.id),x,19,14,'#625572');
  }
  for(let i=0;i<100;i++){
    const x=hash(i*23+41)*910+25,y=hash(i*43+21)*880+90;
    if(s.lanes.some(l=>isInTunnel(l,x,y,44))||connectors.some(l=>l.path.points.some(p=>Math.hypot(p.x-x,p.y-y)<75)))continue;
    if(i%3===0)drawCrystal(c,x,y,.55+hash(i)*.5,hash(i+11));
    else if(i%3===1){ellipse(c,x+4,y+4,15,8,'#6c5c7e28');polygon(c,[[x-14,y],[x-7,y-13],[x+7,y-16],[x+16,y-4],[x+8,y+7],[x-5,y+6]],'#b7a4c2','#9d8da9',1);line(c,[[x-7,y-11],[x+3,y-8],[x+7,y+5]],'#d7c5d2',1.5);}
    else{for(let j=0;j<3;j++){const xx=x+j*9;line(c,[[xx,y],[xx,y-12-j*3]],'#859689',2);ellipse(c,xx,y-12-j*3,8,4,'#b3cbb0','#899f94',1);ellipse(c,xx-2,y-14-j*3,2,1,'#eef0ce');}}
  }
  return canvas;
}

export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.key='';this.background=null;this.width=0;this.height=0;}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}this.width=r.width;this.height=r.height;}
  worldPoint(clientX,clientY){const r=this.canvas.getBoundingClientRect();return{x:(clientX-r.left)/r.width*WORLD.width,y:(clientY-r.top)/r.height*WORLD.height};}
  draw(s,v){
    this.resize();const c=this.ctx;c.setTransform(this.canvas.width/WORLD.width,0,0,this.canvas.height/WORLD.height,0,0);c.clearRect(0,0,960,1060);
    const inherited=s.enemies.filter(e=>e.connector&&!s.connectors.some(p=>p.path===e.connector.path)).map(e=>e.connector);
    const key=s.lanes.map(l=>`${l.id}:${l.version}`).join('|')+'-'+s.mapCycle+'-'+inherited.map(l=>`${l.from}:${l.to}`).join('|');
    if(key!==this.key){this.background=backdrop(s,inherited);this.key=key;}
    c.drawImage(this.background,0,0);const time=v.time||0;
    if(s.warning?.action==='add'){
      const x=100+s.warning.id*190;c.save();c.setLineDash([9,13]);c.strokeStyle='#85688f8c';c.lineWidth=3;c.beginPath();c.moveTo(x,72);c.bezierCurveTo(x-25,240,x+35,620,x,840);c.stroke();c.setLineDash([]);rect(c,x-60,100,120,54,11,'#f7e8cdeb','#8c7494',2);text(c,'NEW TUNNEL',x,116,12);text(c,`${Math.max(0,Math.ceil(s.warning.at-s.time))}s`,x,139,18);c.restore();
    }
    for(const lane of s.lanes){
      if(lane.retiring){c.save();c.globalAlpha=.16;c.strokeStyle='#9d6b8d';c.lineWidth=68;path(c,lane.path);c.stroke();c.restore();text(c,'DRAINING',lane.x,78,12,'#896178');}
      if(s.time-lane.opened<3&&lane.opened>0)glow(c,lane.x,80,85,`rgba(246,205,116,${(3-s.time+lane.opened)*.13})`);
    }
    const hovered=allSlots(s).find(p=>p.id===v.hover);
    if(hovered&&v.mode==='playing'){
      const spec=WEAPONS[v.selected];const lane=s.lanes.find(l=>l.id===hovered.laneId);c.save();
      // Clip range to connected floor; no promise of shooting through solid rock.
      c.beginPath();for(const p of lane.path.points){c.moveTo(p.x+39,p.y);c.arc(p.x,p.y,39,0,TAU);}for(const ch of lane.chambers){c.moveTo(ch.x+ch.rx,ch.y);c.ellipse(ch.x,ch.y,ch.rx,ch.ry,0,0,TAU);}c.clip();
      ellipse(c,hovered.x,hovered.y,spec.range,spec.range,`${spec.color}25`,`${spec.color}aa`,2);c.restore();
    }
    for(const slot of allSlots(s)){
      if(s.towers.some(t=>t.slotId===slot.id))continue;
      const active=hovered?.id===slot.id,retiring=s.lanes.find(l=>l.id===slot.laneId).retiring;
      const blink=v.mode==='playing'&&!retiring&&s.inventory[v.selected].length>0;
      c.save();c.globalAlpha=retiring?.35:1;
      ellipse(c,slot.x+1,slot.y+4,24,19,'#8c785a30');ellipse(c,slot.x,slot.y,23,19,active?'#fff6d9':'#e6d4ac',active?'#a16a4a':'#b49d79',active?3:2);
      c.setLineDash([3,4]);ellipse(c,slot.x,slot.y,17,13,'#0000',blink?'#a78e6b':'#c0ab8a',1);c.setLineDash([]);
      line(c,[[slot.x-6,slot.y],[slot.x+6,slot.y]],active?'#985c45':'#aa926e',2);line(c,[[slot.x,slot.y-6],[slot.x,slot.y+6]],active?'#985c45':'#aa926e',2);c.restore();
      if(active&&blink){c.save();c.globalAlpha=.65;drawWeapon(c,v.selected,slot.x,slot.y,-Math.PI/2,.8,1,0,time);c.restore();}
    }
    if(!s.over&&s.enemies.some(e=>e.y>840&&!e.dead)){c.save();c.globalAlpha=.2+Math.sin(time*5)*.1;ellipse(c,480,990,135,61,'#e8836555','#c97666',3);c.restore();}
    drawHouse(c,time,s.over);
    for(const t of s.towers)drawWeapon(c,t.type,t.x,t.y,t.angle,1,t.ammo/t.maxAmmo,t.recoil,time);
    for(const enemy of s.enemies)if(enemy.d>=0)drawShip(c,enemy,time);
    if(v.mode==='menu'){
      const lanes=[...s.lanes].sort((a,b)=>a.id-b.id);for(let i=0;i<lanes.length;i++){const p=at(lanes[i].path,90+((time*13+i*210)%400));drawShip(c,{...p,type:i===1?'cruiser':'saucer',hp:1,maxHp:1,hit:0,phase:i*2},time);}
      for(const [i,type]of['sniper','cannon','blaster'].entries()){const slot=lanes[i].slots[0];drawWeapon(c,type,slot.x,slot.y,-1.4,1,1,0,time);}
      // The title illustration brings the pilot and armored hull close enough to inspect.
      c.save();c.globalAlpha=.14;const beam=c.createLinearGradient(680,300,680,630);beam.addColorStop(0,'#d8efb8');beam.addColorStop(1,'transparent');polygon(c,[[622,302],[738,302],[824,630],[542,630]],beam);c.restore();
      drawShip(c,{x:704+Math.sin(time*.45)*9,y:275+Math.cos(time*.55)*10,angle:Math.PI/2-.17,type:'cruiser',hp:1,maxHp:1,hit:0,phase:1},time,2.7);
    }
    for(const p of s.projectiles){c.save();c.translate(p.x,p.y);c.rotate(p.angle+Math.PI/2);glow(c,0,10,24,'#f0b46580');polygon(c,[[-5,7],[0,-15],[5,7]],'#ffe5a5','#b27b62',1.3);polygon(c,[[-3,8],[0,22+Math.sin(time*40)*5],[3,8]],'#ed8b6b');line(c,[[0,10],[0,17]],'#fff3c0',2);c.restore();}
    for(const f of v.effects){const p=f.age/f.life;c.save();
      if(f.type==='shot'){const color=WEAPONS[f.weapon].color;c.globalAlpha=1-p;if(f.weapon==='sniper'){c.shadowColor='#ffe9a0';c.shadowBlur=9;line(c,[[f.x,f.y],[f.tx,f.ty]],'#fff1bb',3);line(c,[[f.x,f.y],[f.tx,f.ty]],color,1.2);}else{const k=Math.min(1,p*1.8),k0=Math.max(0,k-.28);line(c,[[f.x+(f.tx-f.x)*k0,f.y+(f.ty-f.y)*k0],[f.x+(f.tx-f.x)*k,f.y+(f.ty-f.y)*k]],'#82e3ca',4);line(c,[[f.x+(f.tx-f.x)*k0,f.y+(f.ty-f.y)*k0],[f.x+(f.tx-f.x)*k,f.y+(f.ty-f.y)*k]],'#f2ffcf',1.5);}glow(c,f.tx,f.ty,13*(1-p),'#ffe9aa99');}
      else if(f.type==='blast'){c.globalAlpha=(1-p)*.65;const r=f.radius*(.2+p*.8);ellipse(c,f.x,f.y,r,r,'#f4b17722','#e6a16b',3*(1-p)+1);glow(c,f.x,f.y,f.radius*.8*(1-p),'#ffdf9bdd');for(let i=0;i<12;i++){const a=i*TAU/12;line(c,[[f.x+Math.cos(a)*r*.6,f.y+Math.sin(a)*r*.6],[f.x+Math.cos(a)*r*.9,f.y+Math.sin(a)*r*.9]],'#f8deb2',4*(1-p));}}
      else if(f.type==='place'){c.globalAlpha=1-p;ellipse(c,f.x,f.y,25+p*30,20+p*25,'#0000','#7faca0',3);}
      else if(f.type==='spent'){c.globalAlpha=1-p;text(c,'REPLACE',f.x,f.y-30-p*22,12,'#a35e65');}
      else if(f.type==='over'){c.globalAlpha=(1-p)*.3;ellipse(c,480,980,100+p*80,90+p*80,'#93c5b977');}
      c.restore();
    }
    for(const p of v.particles){c.save();c.globalAlpha=clamp(p.life/p.max,0,1);c.translate(p.x,p.y);c.rotate(p.angle);rect(c,-p.size/2,-p.size/2,p.size,p.size*.65,1,p.color);c.restore();}
    // Floating dust and fireflies keep the chamber world alive without obscuring movement.
    for(let i=0;i<16;i++){const x=(hash(i*7+1)*960+Math.sin(time*.3+i)*8),y=(hash(i*13+4)*900+time*3)%950;ellipse(c,x,y,1.4,1.4,`rgba(255,244,194,${.25+Math.sin(time+i)*.18})`);}
  }
}
