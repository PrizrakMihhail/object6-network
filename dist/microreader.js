(()=>{
 const slides=[1,2,3,4].map(n=>({src:`assets/microreader/clipping-${n}.png`,title:`ВЫРЕЗКА ${n}`,caption:`АРХИВНАЯ КОПИЯ // ЛИСТ ${String(n).padStart(2,'0')}`}));
 const dialog=document.getElementById('microreaderDialog'),machine=dialog.querySelector('.microreader-machine'),image=document.getElementById('clippingImage'),title=document.getElementById('clippingTitle'),caption=document.getElementById('clippingCaption'),counter=document.getElementById('clippingCounter'),dots=document.getElementById('clippingDots'),lampStatus=document.getElementById('lampStatus'),openButton=document.getElementById('microreaderButton'),closeButton=document.getElementById('closeMicroreader'),previous=document.getElementById('previousClipping'),next=document.getElementById('nextClipping');
 let current=0,failureTimer=null,restoreTimer=null;
 dots.innerHTML=slides.map((_,i)=>`<button type="button" aria-label="Открыть вырезку ${i+1}" data-slide="${i}"></button>`).join('');
 function show(index){current=(index+slides.length)%slides.length;const slide=slides[current];image.src=slide.src;image.alt=`Газетная вырезка ${current+1} из ${slides.length}`;title.textContent=slide.title;caption.textContent=slide.caption;counter.textContent=`${String(current+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;dots.querySelectorAll('button').forEach((dot,i)=>{dot.classList.toggle('active',i===current);dot.setAttribute('aria-current',i===current?'true':'false')})}
 function setLamp(stable){machine.classList.toggle('lamp-failure',!stable);lampStatus.innerHTML=`<i></i> ЛАМПА: ${stable?'СТАБИЛЬНО':'НЕ СТАБИЛЬНО'}`}
 function stopLampCycle(){clearTimeout(failureTimer);clearTimeout(restoreTimer);failureTimer=restoreTimer=null;setLamp(true)}
 function scheduleFailure(){clearTimeout(failureTimer);failureTimer=setTimeout(()=>{if(!dialog.open)return;setLamp(false);restoreTimer=setTimeout(()=>{setLamp(true);scheduleFailure()},2000)},10000+Math.random()*10000)}
 function open(){show(current);dialog.showModal();scheduleFailure();closeButton.focus()}
 function close(){dialog.close();openButton.focus()}
 openButton.addEventListener('click',open);closeButton.addEventListener('click',close);previous.addEventListener('click',()=>show(current-1));next.addEventListener('click',()=>show(current+1));dots.addEventListener('click',e=>{const dot=e.target.closest('[data-slide]');if(dot)show(Number(dot.dataset.slide))});
 dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
 dialog.addEventListener('close',stopLampCycle);
 dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(current-1)}else if(e.key==='ArrowRight'){e.preventDefault();show(current+1)}else if(e.key==='Home'){e.preventDefault();show(0)}else if(e.key==='End'){e.preventDefault();show(slides.length-1)}});
 show(0);
})();
