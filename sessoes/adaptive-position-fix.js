(() => {
  'use strict';

  function positionAdaptiveHelp() {
    const help = document.getElementById('adaptiveDepth');
    const firstExercise = document.querySelector('#studyBody .exercise');
    if (help && firstExercise && help.nextElementSibling !== firstExercise) {
      firstExercise.parentElement.insertBefore(help, firstExercise);
    }
  }

  const observer = new MutationObserver(positionAdaptiveHelp);
  observer.observe(document.documentElement, {subtree:true, childList:true});
  document.addEventListener('DOMContentLoaded', positionAdaptiveHelp);
  setInterval(positionAdaptiveHelp, 500);
})();