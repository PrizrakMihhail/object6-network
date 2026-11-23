(()=>{
 const slides=window.MICROREADER_SLIDES||[];
 const dialog=document.getElementById('microreaderDialog'),machine=dialog.querySelector('.microreader-machine'),image=document.getElementById('clippingImage'),title=document.getElementById('clippingTitle'),caption=document.getElementById('clippingCaption'),counter=document.getElementById('clippingCounter'),dots=document.getElementById('clippingDots'),lampStatus=document.getElementById('lampStatus'),openButton=document.getElementById('microreaderButton'),closeButton=document.getElementById('closeMicroreader'),previous=document.getElementById('previousClipping'),next=document.getElementById('nextClipping');
 let current=0,failureTimer=null,restoreTimer=null;
 dots.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Открыть вырезку ${i+1}" data-slide="${i}"></button>`).join('');
 function show(index){if(!slides.length){image.hidden=true;title.textContent='АРХИВ ПУСТ';caption.textContent='НЕТ ГАЗЕТНЫХ ВЫРЕЗОК';counter.textContent='00 / 00';previous.disabled=next.disabled=true;return}current=(index+slides.length)%slides.length;const slide=slides[current];image.src=slide.src;image.alt=`${slide.title}. Газетная вырезка ${current+1} из ${slides.length}`;title.textContent=slide.title;caption.textContent=slide.caption;counter.textContent=`${String(current+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;dots.querySelectorAll('button').forEach((dot,i)=>{dot.classList.toggle('active',i===current);dot.setAttribute('aria-current',i===current?'true':'false')})}
 function setLamp(stable){machine.classList.toggle('lamp-failure',!stable);machine.classList.toggle('lamp-recovery',stable&&dialog.open);lampStatus.innerHTML=`<i></i> ЛАМПА: ${stable?'СТАБИЛЬНО':'НЕ СТАБИЛЬНО'}`}
 function stopLampCycle(){clearTimeout(failureTimer);clearTimeout(restoreTimer);failureTimer=restoreTimer=null;setLamp(true)}
 function scheduleFailure(){clearTimeout(failureTimer);failureTimer=setTimeout(()=>{if(!dialog.open)return;setLamp(false);restoreTimer=setTimeout(()=>{setLamp(true);scheduleFailure()},2000)},10000+Math.random()*10000)}
 function open(){show(current);dialog.showModal();scheduleFailure();closeButton.focus()}
 function close(){dialog.close();openButton.focus()}
 openButton.addEventListener('click',open);closeButton.addEventListener('click',close);previous.addEventListener('click',()=>show(current-1));next.addEventListener('click',()=>show(current+1));dots.addEventListener('click',e=>{const dot=e.target.closest('[data-slide]');if(dot)show(Number(dot.dataset.slide))});
 dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
 dialog.addEventListener('close',stopLampCycle);
 image.addEventListener('animationend',()=>{if(machine.classList.contains('lamp-recovery'))machine.classList.remove('lamp-recovery')});
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(current-1)}else if(e.key==='ArrowRight'){e.preventDefault();show(current+1)}else if(e.key==='Home'){e.preventDefault();show(0)}else if(e.key==='End'){e.preventDefault();show(slides.length-1)}});
 show(0);
})();
