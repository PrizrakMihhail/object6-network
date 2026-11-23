(()=>{
 const widget=document.querySelector('.terminal-status'),bar=widget?.querySelector('.meter span'),status=widget?.querySelector('b'),top=document.querySelector('.system-line');
 if(!widget||!bar||!status)return;
 const indicator=status.querySelector('i');
 const label=document.createElement('span');label.textContent=' СТАБИЛЬНО';status.replaceChildren(indicator,label);
 let timer;
 function update(){
  const level=50+Math.random()*46,unstable=level<66;
  bar.style.width=level.toFixed(1)+'%';
  widget.classList.toggle('signal-unstable',unstable);top?.classList.toggle('signal-unstable',unstable);
  label.textContent=unstable?' НЕ СТАБИЛЬНО':' СТАБИЛЬНО';
  bar.parentElement.setAttribute('aria-label',`Уровень соединения: ${Math.round(level)}%, ${unstable?'не стабильно':'стабильно'}`);
  timer=setTimeout(update,2500+Math.random()*4500);
 }
 function resume(){clearTimeout(timer);if(!document.hidden)update()}
 document.addEventListener('visibilitychange',resume);resume();
})();
