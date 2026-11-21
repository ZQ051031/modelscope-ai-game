(() => {
  const $ = id => document.getElementById(id);
  const { directions, makeMap, newShift, fogIntent, move, countDeliveries, scoreShift } = MothGame;
  const maps = MothCampaign.map(makeMap);
  const totalDistricts = maps.length;
  const board = $('board');
  const result = $('result');
  const help = $('help');
  const keyboard = new Map([
    ['arrowup', 0], ['w', 0], ['arrowleft', 1], ['a', 1],
    ['arrowdown', 2], ['s', 2], ['arrowright', 3], ['d', 3],
  ]);
  const storage = {
    get(key) {
      try { return localStorage.getItem('mothlight.' + key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem('mothlight.' + key, value); } catch { /* Play still works in private embeds. */ }
    },
  };
  let lang = storage.get('language') === 'en' ? 1 : 0;
  let sound = storage.get('sound') === 'on';
  let best = Number(storage.get('best')) || 0;
  let audioContext;
  let district = 0;
  let state;
  let armed = false;
  let completedScore = 0;
  let cells = [];
  let trail = new Set();

  const t = key => MothCopy[key][lang];
  const map = () => maps[district];
  const format = n => n.toLocaleString(lang ? 'en' : 'zh-CN');
  const index = n => String(n).padStart(2, '0');
  const coordinates = cell => `${String.fromCharCode(65 + cell % map().width)}${Math.floor(cell / map().width) + 1}`;

  function chime(kind) {
    if (!sound || !window.AudioContext) return;
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const tunes = {
      move: [330],
      light: [523, 698],
      mail: [659, 880],
      win: [523, 659, 784, 1047],
      lost: [330, 220, 165],
    };
    tunes[kind].forEach((pitch, i) => {
      const start = audioContext.currentTime + i * .095;
      const note = audioContext.createOscillator();
      const volume = audioContext.createGain();
      note.type = 'sine';
      note.frequency.value = pitch;
      volume.gain.setValueAtTime(.0001, start);
      volume.gain.exponentialRampToValueAtTime(.07, start + .018);
      volume.gain.exponentialRampToValueAtTime(.0001, start + .17);
      note.connect(volume).connect(audioContext.destination);
      note.start(start);
      note.stop(start + .18);
    });
  }

  function buildBoard() {
    board.style.setProperty('--cols', map().width);
    cells = map().tiles.map((tile, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.dataset.cell = index;
      if (tile !== '#') button.addEventListener('click', () => fly(index));
      return button;
    });
    board.replaceChildren(...cells);
  }

  const dpad = directions.map(({ id, symbol }, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dir = id;
    button.dataset.label = id;
    button.textContent = symbol;
    button.addEventListener('click', () => fly(map().links[state.player][i]));
    return button;
  });
  $('dpad').replaceChildren(...dpad);

  function mark(cell, icon) {
    const piece = document.createElement('i');
    piece.className = `mark ${icon}-mark`;
    piece.setAttribute('aria-hidden', 'true');
    if (icon === 'visited') piece.textContent = '✓';
    cell.append(piece);
  }

  function renderBoard(arrived) {
    const currentMap = map();
    const playing = state.phase === 'playing';
    const { next } = fogIntent(currentMap, state, armed);
    const forecast = playing && next !== state.fog ? next : -1;
    const neighbors = currentMap.links[state.player];
    cells.forEach((cell, i) => {
      const wall = currentMap.tiles[i] === '#';
      const isHome = i === currentMap.home;
      const isCourier = i === state.player;
      const isFog = i === state.fog;
      const isForecast = i === forecast;
      const isDecoy = state.decoy?.cell === i;
      const stop = currentMap.stops.indexOf(i);
      const delivered = stop >= 0 && Boolean(state.delivered & (1 << stop));
      const letter = stop >= 0 && !delivered;
      const adjacent = playing && neighbors.includes(i);
      cell.className = [
        'cell', wall && 'wall', adjacent && 'neighbor', trail.has(i) && 'traveled',
        isHome && 'post', letter && 'letter', isForecast && 'forecast', isFog && 'fog',
        isCourier && 'courier', isCourier && isFog && 'caught', isCourier && arrived && 'arrived',
      ].filter(Boolean).join(' ');
      cell.disabled = !adjacent;
      cell.replaceChildren();
      if (isHome) mark(cell, 'home');
      if (letter) mark(cell, 'letter');
      if (delivered) mark(cell, 'visited');
      if (isFog) mark(cell, 'fog');
      if (isCourier) mark(cell, 'courier');
      if (isDecoy) {
        mark(cell, 'lantern');
        const timer = document.createElement('span');
        timer.className = 'decoy-timer';
        timer.textContent = state.decoy.turns;
        timer.setAttribute('aria-hidden', 'true');
        cell.append(timer);
      }
      const notes = [
        wall && t('wall'), isHome && t('post'), letter && t('mail'), delivered && t('stamped'),
        isCourier && t('courier'), isFog && t('fog'), isForecast && t('forecast'),
        isDecoy && `${t('lit')} · ${state.decoy.turns}`,
      ].filter(Boolean);
      cell.setAttribute('aria-label', [coordinates(i), ...(notes.length ? notes : [t('tile')])].join(', '));
    });
    dpad.forEach((button, i) => { button.disabled = !playing || neighbors[i] < 0; });
  }

  function refreshMission(arrived = false) {
    const currentMap = map();
    const details = MothCampaign[district];
    const delivered = countDeliveries(currentMap, state);
    const turns = currentMap.limit - state.turn;
    $('chapter-index').textContent = `${t('chapter')} ${index(district + 1)} / ${index(totalDistricts)}`;
    $('chapter-title').textContent = details.name[lang];
    $('district-note').textContent = details.note[lang];
    $('district-note').parentElement.style.setProperty('--art-position', ['42%', '85%', '28%', '96%'][district]);
    $('turn-number').textContent = index(turns);
    $('turn-number').classList.toggle('low', turns <= 4);
    $('mail-count').textContent = `${delivered} / ${currentMap.stops.length}`;
    $('score').textContent = format(completedScore + scoreShift(currentMap, state));
    $('objective').textContent = t(delivered === currentMap.stops.length ? 'return' : 'goal');
    $('hint').textContent = details.hint[lang];
    $('lantern').disabled = state.lanterns === 0 || state.phase !== 'playing';
    $('lantern').setAttribute('aria-pressed', String(armed));
    $('lantern-label').textContent = t(armed ? 'armed' : 'lantern');
    $('lantern-note').textContent = t(state.lanterns === 0 ? 'lanternSpent' : armed ? 'lanternArmed' : 'lanternTip');
    $('lantern-count').textContent = `×${state.lanterns}`;
    $('progress-markers').replaceChildren(...maps.map((_, i) => {
      const marker = document.createElement('i');
      marker.className = i < district ? 'complete' : i === district ? 'current' : '';
      return marker;
    }));
    renderBoard(arrived);
  }

  function showScore() {
    const won = state.phase === 'won';
    const complete = won && district === totalDistricts - 1;
    const title = won ? (complete ? 'complete' : 'win') : state.reason;
    const points = scoreShift(map(), state);
    $('result-kicker').textContent = MothCampaign[district].name[lang];
    $('result-title').textContent = t(title);
    $('result-detail').textContent = t(title + 'Detail');
    $('result-points').textContent = format(points);
    $('result-total').textContent = format(points + completedScore);
    $('result-primary').textContent = t(won ? (complete ? 'again' : 'next') : 'tryAgain');
    $('result-primary').classList.toggle('next-arrow', won && !complete);
    if (!result.open) {
      result.showModal();
      $('result-primary').focus();
    }
  }

  function updateLanding() {
    $('start').textContent = t(state?.phase === 'playing' ? 'resume' : 'start');
    $('start').classList.add('next-arrow');
    $('best-score').textContent = `${t('record')}  ·  ${format(best)}`;
    $('route-list').replaceChildren(...MothCampaign.map((chapter, i) => {
      const row = document.createElement('li');
      const stamp = document.createElement('span');
      const text = document.createElement('span');
      const name = document.createElement('strong');
      const info = document.createElement('small');
      const parcels = maps[i].stops.length;
      stamp.className = 'stamp';
      stamp.textContent = index(i + 1);
      name.textContent = chapter.name[lang];
      info.textContent = lang ? `${parcels} letters · ${chapter.limit} moves` : `${parcels} 封信 · ${chapter.limit} 步`;
      text.append(name, info);
      row.append(stamp, text);
      return row;
    }));
  }

  function refreshSound() {
    $('sound').textContent = t(sound ? 'audio' : 'mute');
    $('sound').setAttribute('aria-pressed', String(sound));
  }

  function localize() {
    document.documentElement.lang = lang ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-copy]').forEach(node => { node.textContent = t(node.dataset.copy); });
    document.querySelectorAll('[data-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.label)); });
    $('language').textContent = lang ? '中文' : 'English';
    $('language').lang = lang ? 'zh-CN' : 'en';
    refreshSound();
    updateLanding();
    if (state) refreshMission();
  }

  function goHome() {
    const wasPlaying = !$('play').hidden;
    if (result.open) result.close();
    if (state && state.phase !== 'playing') state = null;
    $('play').hidden = true;
    $('landing').hidden = false;
    updateLanding();
    if (wasPlaying) $('start').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function openShift() {
    $('landing').hidden = true;
    $('play').hidden = false;
    refreshMission();
    $('chapter-title').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function startDistrict(i) {
    district = i;
    state = newShift(map());
    armed = false;
    trail = new Set();
    buildBoard();
    openShift();
    $('announcement').textContent = t('districtStart');
  }

  function fly(destination) {
    if (!state || help.open || result.open) return;
    const past = state;
    state = move(map(), state, destination, armed);
    if (state === past) return;
    armed = false;
    trail.add(past.player);
    refreshMission(true);
    const mail = state.delivered !== past.delivered;

    if (state.phase === 'playing') {
      const { next } = fogIntent(map(), state);
      $('announcement').textContent = [
        mail && t('justDelivered'),
        `${t('courier')} ${coordinates(state.player)}.`,
        `${t('forecast')} ${coordinates(next)}.`,
        `${t('turns')} ${map().limit - state.turn}.`,
      ].filter(Boolean).join(' ');
      chime(mail ? 'mail' : state.lanterns < past.lanterns ? 'light' : 'move');
      return;
    }

    if (state.phase === 'won' && district === totalDistricts - 1) {
      best = Math.max(best, completedScore + scoreShift(map(), state));
      storage.set('best', best);
    }
    showScore();
    chime(state.phase === 'won' ? 'win' : 'lost');
  }

  function toggleLantern() {
    if (!state?.lanterns || state.phase !== 'playing') return;
    armed = !armed;
    refreshMission();
    const { next } = fogIntent(map(), state, armed);
    $('announcement').textContent = `${t(armed ? 'armed' : 'lantern')}. ${t('forecast')} ${coordinates(next)}.`;
  }

  $('start').addEventListener('click', () => {
    if (state?.phase === 'playing') openShift();
    else {
      completedScore = 0;
      startDistrict(0);
    }
  });
  for (const id of ['home-button', 'back', 'result-home']) $(id).addEventListener('click', goHome);
  for (const id of ['intro-help', 'play-help']) $(id).addEventListener('click', () => help.showModal());
  $('retry').addEventListener('click', () => startDistrict(district));
  $('lantern').addEventListener('click', toggleLantern);
  $('language').addEventListener('click', () => {
    lang = 1 - lang;
    storage.set('language', lang ? 'en' : 'zh-CN');
    localize();
  });
  $('sound').addEventListener('click', () => {
    sound = !sound;
    storage.set('sound', sound ? 'on' : 'off');
    refreshSound();
    if (sound) chime('light');
  });
  result.addEventListener('cancel', event => { event.preventDefault(); });
  $('result-primary').addEventListener('click', () => {
    result.close();
    if (state.phase === 'lost') startDistrict(district);
    else if (district === totalDistricts - 1) {
      completedScore = 0;
      startDistrict(0);
    } else {
      completedScore += scoreShift(map(), state);
      startDistrict(district + 1);
    }
  });
  window.addEventListener('keydown', event => {
    if ($('play').hidden || help.open || result.open || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (keyboard.has(key)) {
      event.preventDefault();
      if (!event.repeat) fly(map().links[state.player][keyboard.get(key)]);
    } else if (key === 'l' && !event.repeat) {
      event.preventDefault();
      toggleLantern();
    }
  });
  localize();
})();
