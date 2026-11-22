const PASSWORD='CASTLE';
const candidates=['CASTLE','BATTLE','CANDLE','RATTLE','CATTLE','PASTEL','MASTER','DANGER','CARPET','CASKET','FASTER','RASTER'];
const junk=['!','@','#','$','%','^','&','*','-','+','=','?','/','\\',';',':','.'];
let attempts=4,used=new Set(),duds=new Set(),bonusUsed=new Set();
const dump=document.getElementById('memoryDump'),log=document.getElementById('hackLog'),blocks=document.getElementById('attemptBlocks');
function similarity(word){return [...word].filter((c,i)=>c===PASSWORD[i]).length}
function addLog(text,cls=''){const p=document.createElement('p');p.className=cls;p.textContent='> '+text;log.appendChild(p);log.scrollTop=log.scrollHeight}
function wordToken(word){return `<button class="token word${duds.has(word)?' used':''}" data-word="${word}">${word}</button>`}
function build(){dump.innerHTML='';const shuffled=[...candidates].sort(()=>Math.random()-.5);let wi=0;for(let i=0;i<24;i++){const addr=(0xF400+i*12).toString(16).toUpperCase();let stream='';for(let j=0;j<12;){if((i+j)%7===0&&wi<shuffled.length){stream+=wordToken(shuffled[wi++]);j+=6}else if((i+j)%11===0){const pair='('+junk[(i+j)%junk.length]+junk[(i+j+3)%junk.length]+')';stream+=`<button class="token bracket" data-pair="${i}-${j}">${pair}</button>`;j+=4}else{stream+=`<span class="token">${junk[(i*5+j*3)%junk.length]}</span>`;j++}}dump.insertAdjacentHTML('beforeend',`<div class="dump-line"><span class="addr">0x${addr}</span><span>${stream}</span></div>`)}}
function updateAttempts(){blocks.textContent=[0,1,2,3].map(i=>i<attempts?'■':'□').join(' ')}
function choose(word,button){if(used.has(word)||attempts<=0)return;used.add(word);button.classList.add('used');addLog(word);if(word===PASSWORD){addLog('ТОЧНОЕ СОВПАДЕНИЕ','success');addLog('ДОСТУП РАЗРЕШЁН','success');setTimeout(showVault,900);return}attempts--;addLog(`СОВПАДЕНИЕ: ${similarity(word)}/6`,'fail');updateAttempts();if(attempts===0){addLog('ТЕРМИНАЛ ЗАБЛОКИРОВАН','fail');document.querySelectorAll('.word,.bracket').forEach(x=>x.classList.add('used'))}}
function bonus(button,id){if(bonusUsed.has(id)||attempts<=0)return;bonusUsed.add(id);button.classList.add('used');const possible=candidates.filter(x=>x!==PASSWORD&&!used.has(x)&&!duds.has(x));if(attempts<4&&Math.random()>.45){attempts++;updateAttempts();addLog('ПОПЫТКА ВОССТАНОВЛЕНА','success')}else if(possible.length){const dud=possible[Math.floor(Math.random()*possible.length)];duds.add(dud);document.querySelectorAll(`[data-word="${dud}"]`).forEach(x=>x.classList.add('used'));addLog(`ЛОЖНЫЙ ВАРИАНТ УДАЛЁН: ${dud}`,'success')}else addLog('ДАННЫХ НЕТ')}
function bind(){dump.querySelectorAll('.word').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.word,b)));dump.querySelectorAll('.bracket').forEach(b=>b.addEventListener('click',()=>bonus(b,b.dataset.pair)))}
function reset(){attempts=4;used.clear();duds.clear();bonusUsed.clear();log.innerHTML='<p>&gt; НОВЫЙ ДАМП ЗАГРУЖЕН</p>';updateAttempts();build();bind()}
function showVault(){document.getElementById('hackView').classList.add('hidden');document.getElementById('vaultView').classList.remove('hidden');window.scrollTo(0,0)}
const accessDialog=document.getElementById('accessDialog'),choicePanel=document.getElementById('choicePanel'),passwordPanel=document.getElementById('passwordPanel'),passwordInput=document.getElementById('passwordInput'),passwordError=document.getElementById('passwordError');
function openGateway(){document.getElementById('hackView').classList.add('hidden');document.getElementById('vaultView').classList.add('hidden');choicePanel.classList.remove('hidden');passwordPanel.classList.add('hidden');passwordInput.value='';passwordError.textContent='';if(!accessDialog.open)accessDialog.showModal()}
document.getElementById('passwordChoice').addEventListener('click',()=>{choicePanel.classList.add('hidden');passwordPanel.classList.remove('hidden');passwordInput.focus()});
document.getElementById('backChoice').addEventListener('click',()=>{passwordPanel.classList.add('hidden');choicePanel.classList.remove('hidden');passwordError.textContent=''});
document.getElementById('hackChoice').addEventListener('click',()=>{accessDialog.close();document.getElementById('hackView').classList.remove('hidden');reset()});
passwordPanel.addEventListener('submit',e=>{e.preventDefault();if(passwordInput.value.trim().toLowerCase()==='baron'){accessDialog.close();showVault()}else{passwordError.textContent='ОТКАЗ: НЕВЕРНЫЙ ПАРОЛЬ';passwordInput.select()}});
accessDialog.addEventListener('cancel',e=>{e.preventDefault();location.href='fourth.html'});
document.getElementById('restartHack').addEventListener('click',reset);
window.addEventListener('pageshow',openGateway);
