const $=(s)=>document.querySelector(s)
const viewport=$('.viewport')
const seed=$('#seed')
const overlay=document.createElement('canvas')
overlay.id='living-city-canvas'
overlay.setAttribute('aria-label','도시 이동·서비스 시뮬레이션 오버레이')
viewport.appendChild(overlay)
const info=document.createElement('aside')
info.id='object-inspector'
info.className='object-inspector'
info.innerHTML='<div class="inspector-head"><strong>도시 객체</strong><button type="button" aria-label="닫기">×</button></div><div id="inspector-body">도로·역·시설 또는 건물을 선택하세요.</div>'
viewport.appendChild(info)
info.querySelector('button').addEventListener('click',()=>info.classList.remove('open'))

const state={agents:[],pois:[],heat:[],flood:[],selected:null,last:0,phase:0}
function hash(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rngFactory(value){let s=hash(value);return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296)}
function reset(){const r=rngFactory(seed?.value||'city');state.agents=[];state.pois=[];state.heat=[];state.flood=[];for(let i=0;i<54;i++)state.agents.push({type:i%11===0?'train':'car',axis:i%2,x:r(),y:r(),speed:.025+r()*.055,dir:r()>.5?1:-1,lane:r()})
const types=['학교','병원','소방서','경찰서','환승센터','공원'];for(let i=0;i<18;i++)state.pois.push({x:.08+r()*.84,y:.12+r()*.76,type:types[i%types.length],capacity:Math.round(80+r()*920),score:Math.round(62+r()*37)})
for(let y=0;y<10;y++)for(let x=0;x<14;x++){const center=Math.hypot(x/13-.5,y/9-.48);state.heat.push({x,y,v:Math.max(0,1-center*1.7+r()*.35)});state.flood.push({x,y,v:Math.max(0,(y/9)*.45+r()*.5-(x/13-.72)**2)})}}
function resize(){const d=Math.min(devicePixelRatio||1,2),w=viewport.clientWidth,h=viewport.clientHeight;overlay.width=w*d;overlay.height=h*d;overlay.style.width=`${w}px`;overlay.style.height=`${h}px`;overlay.getContext('2d').setTransform(d,0,0,d,0,0)}
function analysis(){return document.querySelector('[data-analysis].active')?.dataset.analysis||'none'}
function roadPoint(agent,t,w,h){const margin=48;if(agent.axis===0)return{x:margin+(w-margin*2)*((agent.x+t*agent.speed*agent.dir+10)%1),y:margin+(h-margin*2)*(Math.round(agent.y*8)/8)};return{x:margin+(w-margin*2)*(Math.round(agent.x*10)/10),y:margin+(h-margin*2)*((agent.y+t*agent.speed*agent.dir+10)%1)}}
function drawGrid(ctx,w,h,kind){const cells=kind==='heat'?state.heat:state.flood,cols=14,rows=10,cw=w/cols,ch=h/rows;for(const c of cells){const a=Math.max(0,Math.min(.42,c.v*.42));ctx.fillStyle=kind==='heat'?`rgba(255,92,46,${a})`:`rgba(52,156,255,${a})`;ctx.fillRect(c.x*cw,c.y*ch,cw+1,ch+1)}}
function draw(ts){const ctx=overlay.getContext('2d'),w=viewport.clientWidth,h=viewport.clientHeight;ctx.clearRect(0,0,w,h);const mode=analysis();if(mode==='heat'||mode==='flood')drawGrid(ctx,w,h,mode);ctx.save();ctx.globalCompositeOperation='screen';for(const a of state.agents){const p=roadPoint(a,ts/1000,w,h);ctx.fillStyle=a.type==='train'?'rgba(126,224,255,.95)':'rgba(255,224,150,.9)';ctx.beginPath();ctx.roundRect(p.x-3,p.y-2,a.type==='train'?15:7,4,2);ctx.fill()}ctx.restore();for(const p of state.pois){const x=p.x*w,y=p.y*h;ctx.strokeStyle='rgba(163,225,255,.72)';ctx.fillStyle='rgba(15,35,48,.88)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.stroke();if(mode==='service'){ctx.strokeStyle='rgba(113,218,167,.22)';ctx.beginPath();ctx.arc(x,y,22+p.score*.18,0,Math.PI*2);ctx.stroke()}}requestAnimationFrame(draw)}
function nearest(x,y){const w=viewport.clientWidth,h=viewport.clientHeight;let best=null,dist=28;for(const p of state.pois){const d=Math.hypot(p.x*w-x,p.y*h-y);if(d<dist){dist=d;best=p}}return best}
overlay.addEventListener('pointerdown',e=>{const r=overlay.getBoundingClientRect(),p=nearest(e.clientX-r.left,e.clientY-r.top);if(!p)return;state.selected=p;info.classList.add('open');$('#inspector-body').innerHTML=`<dl><div><dt>유형</dt><dd>${p.type}</dd></div><div><dt>수용 규모</dt><dd>${p.capacity.toLocaleString('ko-KR')}명</dd></div><div><dt>서비스 점수</dt><dd>${p.score}/100</dd></div><div><dt>운영 상태</dt><dd>${p.score>80?'정상':'주의'}</dd></div></dl>`})
function expose(){window.ProceduralCitySimulation={reset,getSnapshot:()=>({agents:state.agents.length,facilities:state.pois.length,analysis:analysis()}),setAnalysis:(mode)=>document.querySelector(`[data-analysis="${mode}"]`)?.click()};window.dispatchEvent(new CustomEvent('procedural-city:simulation-ready',{detail:window.ProceduralCitySimulation}))}
window.addEventListener('resize',resize)
$('#generate')?.addEventListener('click',()=>setTimeout(reset,320))
$('#random-seed')?.addEventListener('click',()=>setTimeout(reset,160))
resize();reset();expose();requestAnimationFrame(draw)
