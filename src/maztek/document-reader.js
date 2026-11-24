const reader = document.getElementById('labDocument');
const title = document.getElementById('labDocumentTitle');
const frame = reader.querySelector('iframe');

for (const link of document.querySelectorAll('[data-lab-document]')) {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    title.textContent = link.dataset.labDocument;
    frame.title = title.textContent;
    frame.src = link.href;
    reader.showModal();
  });
}

reader.addEventListener('close', () => frame.removeAttribute('src'));
