for (const form of document.querySelectorAll('form[data-confirm]')) {
  form.addEventListener('submit', event => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
}
const format = new Intl.DateTimeFormat('th-TH', { timeZone:'Asia/Bangkok', dateStyle:'medium', timeStyle:'short' });
for (const node of document.querySelectorAll('time')) {
  const date = node.dataset.epoch ? new Date(Number(node.dataset.epoch)) : new Date(node.dataset.utc.replace(' ','T') + 'Z');
  if (!Number.isNaN(date.getTime())) node.textContent = format.format(date);
}
