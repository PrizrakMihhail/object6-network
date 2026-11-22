(()=>{
 const overlay=document.getElementById('connectionOverlay'),status=document.getElementById('connectionStatus'),hint=document.getElementById('audioHint');if(!overlay)return;
 const params=new URLSearchParams(location.search);if(params.get('connect')!=='1'){overlay.remove();return}history.replaceState(null,'',location.pathname+location.hash);
 let active=true;
 async function startAudio(){if(!active)return;const ok=await window.TerminalAudio?.deviceBuzz();if(ok){hint.textContent='СИЛОВОЙ БЛОК АКТИВЕН';hint.classList.add('ready')}}
 const stages=[[850,'ПОДАЧА ПИТАНИЯ...'],[1750,'РАЗГОН ПРИВОДА...'],[2850,'ПРОГРЕВ ТЕРМИНАЛЬНОГО БЛОКА...'],[4100,'СИНХРОНИЗАЦИЯ ЛИНИИ...'],[4950,'ТЕРМИНАЛ ГОТОВ']];
 stages.forEach(([time,text])=>setTimeout(()=>{if(active)status.textContent=text},time));
 const gesture=()=>startAudio();document.addEventListener('keydown',gesture,{once:true,capture:true});document.addEventListener('pointerdown',gesture,{once:true,capture:true});
 startAudio();setTimeout(()=>{active=false;overlay.classList.add('done');setTimeout(()=>overlay.remove(),450)},5350);
})();
