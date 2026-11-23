import { mascot } from './format.js';
import { t } from './i18n.js';
export function mountMascot(button) {
  button.innerHTML = mascot();
  let drag = null, position = null;
  try { position = JSON.parse(localStorage.getItem('janus-mascot-position') || 'null'); } catch {}
  function place(x, y) {
    const box = button.getBoundingClientRect();
    position = {x: Math.max(10, Math.min(innerWidth - box.width - 10, x)), y: Math.max(10, Math.min(innerHeight - box.height - 10, y))};
    button.style.left = `${position.x}px`; button.style.top = `${position.y}px`;
    button.style.right = 'auto'; button.style.bottom = 'auto';
  }
  function remember() { try { localStorage.setItem('janus-mascot-position', JSON.stringify(position)); } catch {} }
  function label() { button.setAttribute('aria-label', t('Drag to move. You can also use the arrow keys.', '拖动可以移动，也可以使用方向键。')); }
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) place(position.x, position.y);
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    const box = button.getBoundingClientRect(); drag = {id: event.pointerId, dx: event.clientX - box.left, dy: event.clientY - box.top};
    button.setPointerCapture(event.pointerId); button.classList.add('is-dragging'); event.preventDefault();
  });
  button.addEventListener('pointermove', event => { if (drag?.id === event.pointerId) place(event.clientX - drag.dx, event.clientY - drag.dy); });
  function release() { if (!drag) return; drag = null; button.classList.remove('is-dragging'); remember(); }
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
  button.addEventListener('keydown', event => {
    const moves = {ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16]};
    if (!moves[event.key]) return;
    event.preventDefault(); const box = button.getBoundingClientRect(), [dx, dy] = moves[event.key]; place(box.left + dx, box.top + dy); remember();
  });
  window.addEventListener('resize', () => { if (position) place(position.x, position.y); });
  window.addEventListener('janus:language', label); label();
}
