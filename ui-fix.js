// ui-fix.js — fallback event delegation for main UI buttons
(function(){
  function safeCall(fnName, ...args) {
    try {
      const fn = window[fnName];
      if (typeof fn === 'function') return fn(...args);
    } catch(e) {
      console.warn('safeCall failed', fnName, e);
    }
  }

  function getSelectedLevel() {
    // prefer gameState.selectedStartLevel if exists
    try {
      if (window.gameState && window.gameState.selectedStartLevel) return window.gameState.selectedStartLevel;
    } catch(e){}
    const active = document.querySelector('.level-btn.active');
    if (active) return parseInt(active.getAttribute('data-level')) || 1;
    return 1;
  }

  document.addEventListener('click', function(e){
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.id;

    if (id === 'btn-play') {
      // show instructions screen (original handler)
      safeCall('initAudio');
      safeCall('showScreen', 'screen-instructions');
    }
    else if (id === 'btn-quick-play') {
      safeCall('initAudio');
      safeCall('showScreen', 'screen-gameplay');
      const sel = getSelectedLevel();
      // attempt to call initNewGame with level
      safeCall('initNewGame', sel);
    }
    else if (id === 'btn-instructions') {
      safeCall('initAudio');
      safeCall('showScreen', 'screen-instructions');
    }
    else if (id === 'btn-leaderboard') {
      safeCall('initAudio');
      safeCall('renderLeaderboardView');
      safeCall('showScreen', 'screen-leaderboard');
    }
    else if (id === 'btn-exit') {
      const narr = document.getElementById('narrator-text');
      if (narr) narr.innerText = "Thanks for playing MathRush! Refresh the browser to run again.";
    }
    else if (id === 'btn-start-game') {
      safeCall('initAudio');
      safeCall('showScreen', 'screen-gameplay');
      const sel = getSelectedLevel();
      safeCall('initNewGame', sel);
    }
    else if (id === 'btn-back-to-menu-from-inst' || id === 'btn-back-to-menu-from-leaderboard' || id === 'btn-menu-end') {
      safeCall('showScreen', 'screen-main-menu');
    }
    else if (id === 'btn-play-again') {
      safeCall('showScreen', 'screen-gameplay');
      safeCall('initNewGame', 1);
    }
  }, {capture: false});
})();
