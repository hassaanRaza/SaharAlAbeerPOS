export const switchTabs = () => {
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const name = t.getAttribute('data-tab');
      document.querySelectorAll('[data-panel]').forEach(p => p.style.display = (p.getAttribute('data-panel') === name) ? 'block' : 'none');
    };
  });
};

export const modal = {
  el: document.getElementById('prodModal'),
  open() { this.el.style.display = 'grid'; },
  close() { this.el.style.display = 'none'; }
};
document.getElementById('prodClose').onclick = () => modal.close();
document.getElementById('prodCancel').onclick = () => modal.close();
document.getElementById('prodModal').addEventListener('click', e => { if (e.target.id === 'prodModal') modal.close(); });
