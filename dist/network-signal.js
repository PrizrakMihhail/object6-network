(()=>{
 const widget=document.querySelector('.terminal-status'),bar=widget?.querySelector('.meter span'),status=widget?.querySelector('b'),top=document.querySelector('.system-line');
 if(!widget||!bar||!status)return;
 const indicator=status.querySelector('i'),pingLabel=widget.querySelector('small:last-child');
 const label=document.createElement('span');label.textContent=' СТАБИЛЬНО';status.replaceChildren(indicator,label);
 let timer;
 function update(){
  const level=50+Math.random()*46,unstable=level<66;
  const ping=Math.round(unstable?140+(66-level)*14+Math.random()*35:18+(96-level)*1.7+Math.random()*8);
  if(pingLabel)pingLabel.textContent=`AES-256 / PING ${ping}MS`;
  bar.style.width=level.toFixed(1)+'%';
  widget.classList.toggle('signal-unstable',unstable);top?.classList.toggle('signal-unstable',unstable);
  label.textContent=unstable?' НЕ СТАБИЛЬНО':' СТАБИЛЬНО';
  bar.parentElement.setAttribute('aria-label',`Уровень соединения: ${Math.round(level)}%, ${unstable?'не стабильно':'стабильно'}`);
  timer=setTimeout(update,2500+Math.random()*4500);
 }
 function resume(){clearTimeout(timer);if(!document.hidden)update()}
 document.addEventListener('visibilitychange',resume);resume();
})();
