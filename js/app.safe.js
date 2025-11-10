// EGAT Overtime v18.7.3
console.log('EGAT Overtime v18.7.3 loaded');

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
      const v = tab.getAttribute('data-view');
      document.getElementById('view-' + v).classList.add('active');
    });
  });
});
