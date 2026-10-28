import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const $ = id => document.getElementById(id);
const SWORD_COLORS = [0x4df5ff, 0xff704f, 0x83d8ff, 0xe58aff, 0x9cff63, 0xffd963, 0xa88aff];
const SWORD_NAMES = ['PULSE','EMBER','GLACIER','NOVA','TOXIC','PRISM','ECLIPSE'];
let scene, camera, renderer, clock, player, swordRig, worldGroup;
let running = false, paused = false, mode = 'practice', mapType = 'yard', swordIndex = 0;
let score = 0, hp = 100, yaw = 0, pitch = 0, lastSwing = 0, swingUntil = 0, toastUntil = 0;
let velocity = new THREE.Vector3(), keys = {}, targets = [], remotes = new Map(), socket = null, myId = null;
const joy = {x:0, y:0};

init();
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8bb7c8);
  scene.fog = new THREE.Fog(0x8bb7c8, 38, 110);
  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 180);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.body.prepend(renderer.domElement);
  clock = new THREE.Clock();
  scene.add(new THREE.HemisphereLight(0xcceeff, 0x293940, 2.0));
  const sun = new THREE.DirectionalLight(0xffefda, 2.8);
  sun.position.set(-18, 30, 12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  player = makeOperator(); scene.add(player);
  swordRig = new THREE.Group(); swordRig.position.set(.39, 1.16, -.34); player.add(swordRig); makeSword(0);
  bindUI(); addEventListener('resize', onResize); animate();
}
function material(color, roughness=.75, metalness=.06, emissive=0, intensity=0) {
  return new THREE.MeshStandardMaterial({color, roughness, metalness, emissive, emissiveIntensity:intensity});
}
function box(parent, x,y,z, w,h,d, mat, shadow=true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); m.position.set(x,y,z); m.castShadow=shadow; m.receiveShadow=true; parent.add(m); return m;
}
function cylinder(parent,x,y,z,rTop,rBot,height,mat,segments=12) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBot,height,segments),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
}
function makeOperator() {
  const g = new THREE.Group();
  const suit=material(0x243440,.62,.26), dark=material(0x101b24,.55,.32), trim=material(0x5ce9f4,.4,.35,0x145a6a,.7), visor=material(0x9cfcff,.2,.65,0x4dd8ff,1.25);
  cylinder(g,0,1.02,0,.25,.28,.46,suit,10);
  box(g,0,1.28,0,.56,.48,.31,suit); box(g,0,1.27,-.17,.36,.33,.08,dark);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.22,14,12),dark);head.position.y=1.69;head.castShadow=true;g.add(head);
  box(g,0,1.68,-.194,.29,.105,.045,visor,false);
  box(g,0,1.02,-.176,.27,.11,.055,trim,false);
  box(g,0,1.31,.20,.3,.42,.15,dark);
  for(let i=0;i<3;i++)box(g,0,1.36+i*.09,.283,.19,.03,.02,trim,false);
  for(const x of [-.34,.34]) {
    cylinder(g,x,1.15,0,.095,.105,.42,suit,8).rotation.z=x<0?-.12:.12;
    cylinder(g,x,.91,0,.105,.10,.12,dark,8);
    cylinder(g,x*.53,.57,0,.115,.14,.58,dark,8);
    box(g,x*.53,.24,-.04,.22,.12,.34,suit);
  }
  return g;
}
function makeSword(i) {
  if (!swordRig) return;
  swordRig.clear();
  const color=SWORD_COLORS[i], grip=material(0x17232d,.3,.7), steel=material(0x8299a3,.25,.8), emitter=material(0x12232b,.32,.75), glow=material(color,.2,.24,color,2.7);
  cylinder(swordRig,0,-.015,0,.047,.052,.31,grip,10).rotation.x=Math.PI/2;
  cylinder(swordRig,0,-.17,0,.05,.05,.05,steel,10).rotation.x=Math.PI/2;
  box(swordRig,0,.012,0,.25,.055,.07,steel);
  cylinder(swordRig,0,.075,0,.075,.068,.12,emitter,10).rotation.x=Math.PI/2;
  const blade=new THREE.Mesh(new THREE.CylinderGeometry(.025,.05,1.06,10),glow);blade.position.y=.60;blade.castShadow=true;swordRig.add(blade);
  const aura=new THREE.Mesh(new THREE.CylinderGeometry(.075,.105,1.04,10,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));aura.position.y=.60;swordRig.add(aura);
  for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.08+j*.024,.009,6,18),glow);ring.position.y=.075;ring.rotation.x=Math.PI/2;swordRig.add(ring);}
  swordIndex=i; updateWeaponUI();
}
function floor(size,color) { const f=new THREE.Mesh(new THREE.PlaneGeometry(size,size),material(color,1,0));f.rotation.x=-Math.PI/2;f.receiveShadow=true;worldGroup.add(f); }
function building(x,z,w,h,d,color,roof=0x394d55){
  box(worldGroup,x,h/2,z,w,h,d,material(color,.88,.03));box(worldGroup,x,h+.04,z,w+.12,.12,d+.12,material(roof,.8,.08));
  const win=material(0x8de4ee,.3,.1,0x236a7a,.5);
  for(let xx=-w/2+.38;xx<w/2-.1;xx+=.72)box(worldGroup,x+xx,h*.61,z-d/2-.014,.24,.29,.025,win,false);
  box(worldGroup,x,h*.31,z-d/2-.035,.34,.65,.05,material(0x5b5148),false);
}
function addTargets(){
  for(let i=0;i<10;i++){
    const g=new THREE.Group(),a=i*2.4,r=9+(i%3)*7;
    cylinder(g,0,.68,0,.065,.065,1.36,material(0x293d46),8);
    const col=SWORD_COLORS[i%7],ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.075,8,22),material(col,.25,.2,col,1.5));ring.position.y=1.55;ring.rotation.x=Math.PI/2;g.add(ring);
    const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.20,1),material(0xe7ffff,.2,.1,col,2));core.position.y=1.55;g.add(core);
    g.position.set(Math.cos(a)*r,0,Math.sin(a)*r);g.userData={hit:false,phase:i*.9};worldGroup.add(g);targets.push(g);
  }
}
function makeYard(){
  scene.background.set(0x91b6c4);scene.fog.color.set(0x91b6c4);floor(130,0x4c5a59);
  const lane=material(0xb3c0b4), fence=material(0x71807a), rust=material(0x9d5d3d), teal=material(0x376b78), hazard=material(0xe4bd62);
  for(let a=-45;a<=45;a+=10){box(worldGroup,0,.014,a,100,.02,.075,lane,false);box(worldGroup,a,.015,0,.075,.02,100,lane,false);}
  for(let a=-40;a<=40;a+=4){box(worldGroup,a,1.5,-42,.12,3,.12,fence);box(worldGroup,a,1.5,42,.12,3,.12,fence);box(worldGroup,a,2.96,-42,3.8,.1,.1,rust);box(worldGroup,a,2.96,42,3.8,.1,.1,rust);box(worldGroup,-42,1.5,a,.12,3,.12,fence);box(worldGroup,42,1.5,a,.12,3,.12,fence);}
  for(const [x,z,c] of [[-14,-13,rust],[13,-15,teal],[-18,16,teal],[19,14,rust]]){
    box(worldGroup,x,1.35,z,8,2.7,2.65,material(c,.6,.25));
    for(let k=-3.4;k<=3.4;k+=.55)box(worldGroup,x+k,1.35,z-1.34,.045,2.35,.03,material(0x263b42),false);
    box(worldGroup,x,2.74,z,8.15,.09,2.75,material(0x344a52));
  }
  for(let i=0;i<11;i++){const x=(i%5-2)*13+(Math.random()-.5)*2,z=(Math.floor(i/5)-1)*15;box(worldGroup,x,.72,z,2.4,1.44,2.4,i%2?material(0x9e5839):material(0x305a65));box(worldGroup,x,.16,z-1.23,1.25,.22,.04,hazard,false);}
  box(worldGroup,0,.32,0,8,.64,8,material(0x657b7b));box(worldGroup,0,.68,0,7.3,.08,7.3,material(0x293f48));
  for(let i=0;i<8;i++){const a=i*Math.PI/4;box(worldGroup,Math.cos(a)*3.7,1.05,Math.sin(a)*3.7,.12,.62,.12,material(0x53d8e5));}
  for(const [x,z] of [[-30,-30],[30,-30],[-30,30],[30,30]]){cylinder(worldGroup,x,2.8,z,.13,.13,5.6,material(0x354a50));const l=new THREE.PointLight(0xb5faff,1.1,13);l.position.set(x,5.2,z);worldGroup.add(l);}
  addTargets();
}
function makeTown(){
  scene.background.set(0x8bb6d2);scene.fog.color.set(0x8bb6d2);floor(130,0x8e9185);
  const asphalt=material(0x404b51), curb=material(0xc2bca9), line=material(0xe9dfb7);
  box(worldGroup,0,.02,0,15,.03,120,asphalt,false);box(worldGroup,0,.04,0,.09,.02,120,line,false);box(worldGroup,0,.025,0,120,.03,12,asphalt,false);
  for(let z=-49;z<50;z+=7)box(worldGroup,0,.05,z,9,.02,2.3,line,false);
  box(worldGroup,-9.3,.12,0,2.3,.22,120,curb,false);box(worldGroup,9.3,.12,0,2.3,.22,120,curb,false);box(worldGroup,0,.12,-7.3,120,.22,2.3,curb,false);box(worldGroup,0,.12,7.3,120,.22,2.3,curb,false);
  const colors=[0xd7b58d,0xb9c7c0,0xc47d67,0x9eafc4,0xe0d5b7,0xa9b99e];
  for(const side of [-1,1])for(let col=-2;col<=2;col++){
    const x=col*18+(Math.random()-.5)*1.2,z=side*(18+Math.abs(col)*2),w=10+(Math.abs(col)%2)*2,d=9,h=4.5+(Math.abs(col)%3)*1.2;
    building(x,z,w,h,d,colors[Math.abs(col+side*2)%colors.length],0x465861);
    cylinder(worldGroup,x+w*.25,h+.33,z,.52,.52,.65,material(0x687e83),12);box(worldGroup,x-w*.22,h+.2,z,.9,.38,.8,material(0x697a7e));
  }
  for(const [x,z] of [[-14,-25],[14,-25],[-14,25],[14,25],[-28,0],[28,0]]){
    cylinder(worldGroup,x,1.25,z,.22,.3,2.5,material(0x6e4b32),8);
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.35,1),material(0x477f63));crown.position.set(x,3.1,z);crown.castShadow=true;worldGroup.add(crown);
    const crown2=new THREE.Mesh(new THREE.IcosahedronGeometry(.85,1),material(0x5e9b72));crown2.position.set(x+.5,3.35,z+.2);worldGroup.add(crown2);
  }
  for(const [x,z,c] of [[-5,-26,0x4a9ba4],[5,26,0xd7a75c],[-24,-5,0xc16e5a],[24,5,0x527eaa]]){
    box(worldGroup,x,.48,z,2,.6,3.3,material(c,.4,.23));box(worldGroup,x,.86,z-.18,1.5,.43,1.6,material(0x85abb8,.25,.2));
    for(const dx of [-.72,.72])for(const dz of [-1,1])cylinder(worldGroup,x+dx,.22,z+dz,.25,.25,.13,material(0x171d20),12).rotation.x=Math.PI/2;
  }
  for(const [x,z] of [[-5,-18],[5,18],[-24,12],[24,-12]]){box(worldGroup,x,.43,z,2,.1,.5,material(0x87664b));box(worldGroup,x,.7,z-.18,2,.43,.1,material(0x87664b));}
  addTargets();
}
function cleanWorld(){
  while(worldGroup.children.length){const o=worldGroup.children.pop();worldGroup.remove(o);o.traverse?.(n=>{n.geometry?.dispose();if(n.material){if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material.dispose();}});}
  targets=[];for(const p of remotes.values()){scene.remove(p);p.traverse(n=>{n.geometry?.dispose();if(n.material){if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material.dispose();}});}remotes.clear();
}
function buildWorld(type){cleanWorld();mapType=type;if(type==='town')makeTown();else makeYard();player.position.set(0,0,7);yaw=0;pitch=0;velocity.set(0,0,0);$('mapName').textContent=type==='town'?'LITTLE TOWN':'RUSTYARD';}
function makeRemote(data){
  const g=makeOperator();const sw=new THREE.Group();sw.position.set(.39,1.16,-.34);g.add(sw);
  const col=SWORD_COLORS[data.sword||0],glow=material(col,.2,.2,col,2.5);cylinder(sw,0,-.015,0,.045,.05,.3,material(0x17232d),10).rotation.x=Math.PI/2;
  const blade=new THREE.Mesh(new THREE.CylinderGeometry(.025,.05,1.06,8),glow);blade.position.y=.6;sw.add(blade);g.position.set(data.x||0,0,data.z||0);g.rotation.y=data.rot||0;scene.add(g);return g;
}
function bindUI(){
  document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.mode;$('onlineFields').classList.toggle('hidden',mode!=='online');$('startBtn').innerHTML=(mode==='online'?'JOIN ONLINE ROOM':'START TRAINING')+' <span>→</span>'; }));
  $('swordSelect').addEventListener('change',e=>makeSword(Number(e.target.value)));
  $('startBtn').addEventListener('click',startGame);$('pauseBtn').addEventListener('click',pauseGame);
  $('resumeBtn').addEventListener('click',()=>{paused=false;$('pauseOverlay').classList.add('hidden');});
  $('backBtn').addEventListener('click',()=>{running=false;paused=false;$('pauseOverlay').classList.add('hidden');$('menu').classList.remove('hidden');$('controls').style.display='none';if(socket){socket.disconnect();socket=null;}});
  addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Space')swing();if(/^Digit[1-7]$/.test(e.code)){makeSword(Number(e.code.slice(-1))-1);$('swordSelect').value=swordIndex;}if(e.code==='Escape')pauseGame();});
  addEventListener('keyup',e=>keys[e.code]=false);
  renderer.domElement.addEventListener('click',()=>{if(running&&!paused&&innerWidth>650)renderer.domElement.requestPointerLock?.();});
  addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement&&running&&!paused){yaw-=e.movementX*.0023;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0018,-.7,.7);}});
  renderer.domElement.addEventListener('pointerdown',e=>{if(running&&!paused&&e.pointerType==='mouse')swing();});
  $('mobileSwing').addEventListener('pointerdown',e=>{e.preventDefault();swing();});setupJoystick();setupTouchLook();setupWeaponWheel();
}
function setupWeaponWheel(){const w=$('weaponWheel');w.innerHTML='';for(let i=0;i<7;i++){const b=document.createElement('button');b.className='weapon-chip'+(i===swordIndex?' active':'');b.innerHTML=`${i+1}<span>${SWORD_NAMES[i].slice(0,3)}</span>`;b.addEventListener('click',()=>{makeSword(i);$('swordSelect').value=i;});w.appendChild(b);}}
function updateWeaponUI(){const w=$('weaponWheel');if(w)[...w.children].forEach((b,i)=>b.classList.toggle('active',i===swordIndex));}
function setupJoystick(){const base=$('joystick'),stick=$('stick');let active=false,cx=0,cy=0;base.addEventListener('pointerdown',e=>{active=true;base.setPointerCapture(e.pointerId);const r=base.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;move(e);});base.addEventListener('pointermove',e=>{if(active)move(e);});const stop=()=>{active=false;joy.x=joy.y=0;stick.style.transform='translate(0,0)';};base.addEventListener('pointerup',stop);base.addEventListener('pointercancel',stop);function move(e){const dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),s=len>34?34/len:1;joy.x=dx*s/34;joy.y=dy*s/34;stick.style.transform=`translate(${dx*s}px,${dy*s}px)`;}}
function setupTouchLook(){const a=$('mobileLook');let id=null,last=null;a.addEventListener('pointerdown',e=>{if(!running||paused)return;id=e.pointerId;last={x:e.clientX,y:e.clientY};a.setPointerCapture(e.pointerId);});a.addEventListener('pointermove',e=>{if(e.pointerId!==id||!last)return;yaw-=(e.clientX-last.x)*.008;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-last.y)*.006,-.7,.7);last={x:e.clientX,y:e.clientY};});const stop=e=>{if(e.pointerId===id){id=null;last=null;}};a.addEventListener('pointerup',stop);a.addEventListener('pointercancel',stop);}
function startGame(){
  if(running)return;mode=document.querySelector('.mode.active').dataset.mode;mapType=$('mapSelect').value;makeSword(Number($('swordSelect').value)||0);buildWorld(mapType);score=0;hp=100;updateStats();
  $('menu').classList.add('hidden');$('pauseOverlay').classList.add('hidden');$('controls').style.display='block';$('modeBadge').textContent=mode==='practice'?'PRACTICE':'MULTIPLAYER';$('statusText').textContent=mode==='practice'?'Targets + training bots ready':'Connecting to room…';running=true;paused=false;
  if(mode==='online')connectOnline();else{if(socket){socket.disconnect();socket=null;}spawnBots();}
  if(innerWidth>650)renderer.domElement.requestPointerLock?.();
}
function connectOnline(){
  const code=($('roomCode').value||'STAR7').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10)||'STAR7';$('roomLabel').textContent=code;
  if(!window.io){$('statusText').textContent='Socket client unavailable';return;}
  socket=window.io(location.origin,{transports:['websocket','polling']});
  socket.on('connect',()=>socket.emit('joinRoom',{code,name:$('callsign').value||'Operator',map:mapType}));
  socket.on('roomJoined',d=>{myId=d.id;d.players.forEach(p=>{if(p.id!==myId)upsertRemote(p);});$('statusText').textContent='Connected · room '+code;});
  socket.on('playerJoined',p=>{upsertRemote(p);showToast((p.name||'Operator')+' JOINED');});socket.on('playerState',upsertRemote);
  socket.on('playerLeft',id=>{const p=remotes.get(id);if(p){scene.remove(p);remotes.delete(id);}});
  socket.on('swing',d=>{const p=remotes.get(d.id);if(p){p.userData.swingAt=performance.now();}});
  socket.on('connect_error',()=>{ $('statusText').textContent='Server connection failed · deploy Node server';showToast('SERVER CONNECTION FAILED');});
}
function upsertRemote(d){let p=remotes.get(d.id);if(!p){p=makeRemote(d);remotes.set(d.id,p);}p.userData.tx=d.x;p.userData.tz=d.z;p.userData.tr=d.rot;p.userData.name=d.name;}
function spawnBots(){for(let i=0;i<3;i++){const b=makeRemote({x:(i-1)*5,z:-8-i*3,sword:i%7});b.userData.bot=true;b.userData.phase=i*2.1;b.userData.hp=100;remotes.set('bot'+i,b);}}
function swing(){
  if(!running||paused)return;const now=performance.now();if(now-lastSwing<400)return;lastSwing=now;swingUntil=now+250;swordRig.rotation.x=-.95;swordRig.rotation.z=-.55;if(socket?.connected)socket.emit('swing',{sword:swordIndex});
  let hit=false;const facing=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw));
  for(const t of targets){if(t.userData.hit)continue;const dist=t.position.distanceTo(player.position),to=t.position.clone().sub(player.position).setY(0).normalize();if(dist<4.5&&facing.dot(to)>.05){t.userData.hit=true;t.scale.setScalar(.001);score++;hit=true;showToast('TARGET TAGGED +1');setTimeout(()=>respawnTarget(t),1300);break;}}
  if(!hit)for(const [id,p] of remotes){if(!p.userData.bot)continue;const dist=p.position.distanceTo(player.position),to=p.position.clone().sub(player.position).setY(0).normalize();if(dist<3.5&&facing.dot(to)>.2){p.userData.hp=(p.userData.hp||100)-35;showToast('BOT TAGGED');hit=true;if(p.userData.hp<=0){score++;p.userData.hp=100;p.position.set((Math.random()-.5)*23,0,-10-Math.random()*12);}break;}}
  if(!hit&&mode==='practice')$('statusText').textContent='Miss · get closer and face the target';updateStats();
}
function respawnTarget(t){t.userData.hit=false;t.scale.setScalar(1);t.position.x=(Math.random()-.5)*34;t.position.z=(Math.random()-.5)*34;}
function showToast(s){$('toast').textContent=s;toastUntil=performance.now()+1200;}
function updateStats(){$('score').textContent=String(score).padStart(2,'0');$('hpText').textContent=hp;$('hpFill').style.width=hp+'%';}
function pauseGame(){if(!running)return;paused=!paused;$('pauseOverlay').classList.toggle('hidden',!paused);if(paused&&document.pointerLockElement)document.exitPointerLock();else if(!paused&&innerWidth>650)renderer.domElement.requestPointerLock?.();}
function onResize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));}
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();
  if(running&&!paused){
    const forwardAxis=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y,sideAxis=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x;
    const speed=(keys.ShiftLeft?8.2:6),forward=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
    const move=forward.multiplyScalar(forwardAxis).add(right.multiplyScalar(sideAxis));if(move.length()>1)move.normalize();velocity.lerp(move.multiplyScalar(speed),Math.min(1,dt*10));player.position.addScaledVector(velocity,dt);player.position.x=THREE.MathUtils.clamp(player.position.x,-39,39);player.position.z=THREE.MathUtils.clamp(player.position.z,-39,39);player.rotation.y=yaw;
    camera.position.set(player.position.x,player.position.y+1.57,player.position.z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
    if(now>swingUntil){swordRig.rotation.x=THREE.MathUtils.damp(swordRig.rotation.x,0,12,dt);swordRig.rotation.z=THREE.MathUtils.damp(swordRig.rotation.z,0,12,dt);}
    for(const t of targets)if(!t.userData.hit){if(t.children[1])t.children[1].rotation.y+=dt*1.3;t.position.y=.04+Math.sin(now*.0015+t.userData.phase)*.08;}
    for(const [id,p] of remotes){if(p.userData.bot){const ph=now*.00045+p.userData.phase;p.position.x=Math.sin(ph)*10+(Number(id.slice(-1))||0)*2;p.position.z=-8-Math.cos(ph)*8;p.rotation.y=Math.atan2(player.position.x-p.position.x,-(player.position.z-p.position.z));}else{p.position.x=THREE.MathUtils.damp(p.position.x,p.userData.tx||0,9,dt);p.position.z=THREE.MathUtils.damp(p.position.z,p.userData.tz||0,9,dt);p.rotation.y=p.userData.tr||0;}}
    if(socket?.connected)socket.emit('state',{x:player.position.x,z:player.position.z,rot:yaw,sword:swordIndex,map:mapType});
    $('statusText').textContent=mode==='practice'?`Practice range · ${targets.filter(t=>!t.userData.hit).length} targets active`:(socket?.connected?`Online room · ${remotes.size} other operators`:'Connecting to room…');
  }
  if(now>toastUntil)$('toast').textContent='';renderer.render(scene,camera);
}
