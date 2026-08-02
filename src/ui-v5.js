const body=document.body
const viewport=document.querySelector('.viewport')
if(!viewport)throw new Error('Viewport not found')
const stylesheet=document.createElement('link')
stylesheet.rel='stylesheet'
stylesheet.href=new URL('./ui-v5.css',import.meta.url)
document.head.appendChild(stylesheet)
const toolbar=document.createElement('nav')
toolbar.className='v5-toolbar'
toolbar.setAttribute('aria-label','도시 화면 도구')
toolbar.innerHTML=`<div class="v5-brand">Procedural City <small>v2.0 living world</small></div>
<button class="v5-tool" data-v5-toggle="panel" aria-pressed="false">생성</button>
<button class="v5-tool" data-v5-toggle="society" aria-pressed="true">사회</button>
<button class="v5-tool" data-v5-toggle="kpi" aria-pressed="false">지표</button>
<button class="v5-tool" data-v5-toggle="environment" aria-pressed="false">환경</button>
<button class="v5-tool" data-v5-toggle="analysis" aria-pressed="false">분석</button>
<button class="v5-tool" data-v5-toggle="layer" aria-pressed="false">레이어</button>
<button class="v5-tool" data-v5-toggle="map" aria-pressed="false">지도</button>`
viewport.appendChild(toolbar)
const strip=document.createElement('div')
strip.className='v5-mode-strip'
strip.setAttribute('aria-label','도시 보기 모드')
strip.innerHTML=`<button type="button" data-view="world">세계</button><button type="button" data-view="overview" class="active">조감</button><button type="button" data-view="street">가로</button><button type="button" data-view="center">도심</button><button type="button" data-view="reset">초기화</button>`
viewport.appendChild(strip)
const states={panel:'v5-panel-open',society:'v5-society-open',kpi:'v5-kpi-open',environment:'v5-environment-open',analysis:'v5-analysis-open',layer:'v5-layer-open',map:'v5-map-open'}
function closeTransient(except){for(const [key,className] of Object.entries(states)){if(key!==except&&key!=='kpi'&&key!=='environment'&&key!=='society')body.classList.remove(className)}toolbar.querySelectorAll('[data-v5-toggle]').forEach(button=>{const key=button.dataset.v5Toggle;button.setAttribute('aria-pressed',String(body.classList.contains(states[key])))})}
toolbar.addEventListener('click',event=>{const button=event.target.closest('[data-v5-toggle]');if(!button)return;const key=button.dataset.v5Toggle;const className=states[key];const opening=!body.classList.contains(className);if(opening)closeTransient(key);body.classList.toggle(className,opening);button.setAttribute('aria-pressed',String(opening))})
strip.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(!button)return;if(button.dataset.view==='world')window.ProceduralCityV2Renderer?.showWorld();else{window.ProceduralCityV2Renderer?.showSettlement(window.ProceduralCityV2?.getSnapshot?.());document.querySelector(`[data-camera="${button.dataset.view}"]`)?.click()}strip.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button))})
window.addEventListener('procedural-city:v2-view',event=>{const mode=event.detail?.mode;strip.querySelectorAll('button').forEach(item=>item.classList.toggle('active',mode==='world'?item.dataset.view==='world':item.dataset.view==='overview'))})
document.addEventListener('keydown',event=>{if(event.key==='Escape'){Object.values(states).forEach(className=>body.classList.remove(className));toolbar.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed','false'))}})
body.classList.add('v5-environment-open','v5-society-open')
window.ProceduralCityUI={open(name){if(states[name])body.classList.add(states[name])},close(name){if(states[name])body.classList.remove(states[name])},closeAll(){Object.values(states).forEach(className=>body.classList.remove(className))}}
