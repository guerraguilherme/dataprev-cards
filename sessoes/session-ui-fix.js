(() => {
  'use strict';

  document.addEventListener('click', event => {
    const button = event.target.closest('.session-open-btn');
    if (!button) return;

    setTimeout(() => {
      try {
        if (typeof render === 'function') render();
      } catch (error) {
        console.warn('Atualização da sessão:', error);
      }
    }, 0);
  });
})();