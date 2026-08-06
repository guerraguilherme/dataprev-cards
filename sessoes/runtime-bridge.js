(() => {
  'use strict';

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    try {
      window.catalog = catalog;
      window.session = session;
      window.state = state;
      window.render = render;
      window.renderComplete = renderComplete;

      if (catalog && session && state && typeof render === 'function') {
        clearInterval(timer);
      }
    } catch {}

    if (attempts >= 200) clearInterval(timer);
  }, 25);
})();