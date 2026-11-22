(()=>{
 const overlay=document.getElementById('connectionOverlay'),status=document.getElementById('connectionStatus'),hint=document.getElementById('audioHint');if(!overlay)return;
 let active=true;
 async function startAudio(){if(!active)return;const ok=await window.TerminalAudio?.dialup();if(ok){hint.textContent='АУДИОКАНАЛ АКТИВЕН';hint.classList.add('ready')}}
 const stages=[[850,'ОЖИДАНИЕ НЕСУЩЕЙ...'],[1750,'УДАЛЁННЫЙ УЗЕЛ ОТВЕЧАЕТ...'],[2850,'СОГЛАСОВАНИЕ ПРОТОКОЛА...'],[4100,'ПРОВЕРКА КАНАЛА...'],[4950,'СОЕДИНЕНИЕ УСТАНОВЛЕНО']];
 stages.forEach(([time,text])=>setTimeout(()=>{if(active)status.textContent=text},time));
 const gesture=()=>startAudio();document.addEventListener('keydown',gesture,{once:true,capture:true});document.addEventListener('pointerdown',gesture,{once:true,capture:true});
 startAudio();setTimeout(()=>{active=false;overlay.classList.add('done');setTimeout(()=>overlay.remove(),450)},5350);
})();
