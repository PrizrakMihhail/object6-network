const links = [...document.querySelectorAll('.lab-nav a')];

function updateCurrentSection() {
  const current = links.find(link => link.hash === location.hash) ?? links[0];
  for (const link of links) {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

updateCurrentSection();
window.addEventListener('hashchange', updateCurrentSection);
