'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';
// The color at 12 o'clock starts a rainbow that runs clockwise around the face.
const palette = ['#cb5c52','#d68b47','#d6ad47','#dfcd5b','#a6bc69','#699b75','#79aeb7','#5d95b7','#686d9e','#9a7da6','#bd92b0','#dca1aa'];
const ink = ['#a94037','#a85e2a','#a47e26','#a59b32','#789344','#487b56','#4b828e','#3e7395','#505580','#7d6088','#a16f91','#b57882'];

function point(radius, degrees) {
  const angle = degrees * Math.PI / 180;
  return [350 + radius * Math.sin(angle), 350 - radius * Math.cos(angle)];
}

function svgElement(tag, attributes, text) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text !== undefined) element.textContent = text;
  return element;
}

function ringSector(start, end, inner, outer) {
  const a = point(outer, start), b = point(outer, end), c = point(inner, end), d = point(inner, start);
  return `M${a} A${outer} ${outer} 0 0 1 ${b} L${c} A${inner} ${inner} 0 0 0 ${d} Z`;
}

function drawFace() {
  const sectors = document.getElementById('sectors');
  const ticks = document.getElementById('ticks');
  const minuteLabels = document.getElementById('minute-labels');
  const hourLabels = document.getElementById('hour-labels');
  const innerLabels = document.getElementById('inner-labels');

  for (let hour = 0; hour < 12; hour++) {
    const angle = hour * 30;
    // Each color covers the five minutes after its hour marker (12: 0–5).
    sectors.append(svgElement('path', { d: ringSector(angle, angle + 30, 184, 291), fill: palette[hour], stroke: '#f8f0df', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    const [x, y] = point(236, angle);
    hourLabels.append(svgElement('circle', { cx: x, cy: y, r: 35, fill: '#fff9eb' }));
    hourLabels.append(svgElement('text', { class: 'hour-digit', x, y, fill: ink[hour], 'font-size': 48, 'font-weight': 650 }, hour || 12));
  }

  for (let minute = 0; minute < 60; minute++) {
    const angle = minute * 6;
    const isFive = minute % 5 === 0;
    const [x1, y1] = point(isFive ? 275 : 280, angle);
    const [x2, y2] = point(289, angle);
    ticks.append(svgElement('line', { x1, y1, x2, y2, stroke: '#fff7e2', 'stroke-width': isFive ? 2.6 : 1.8, 'stroke-linecap': 'round', opacity: .9 }));
    const [x, y] = point(311, angle);
    if (isFive) minuteLabels.append(svgElement('circle', { cx: x, cy: y, r: 13, fill: palette[minute / 5] }));
    minuteLabels.append(svgElement('text', { class: isFive ? 'circled-minute' : 'minute-digit', x, y: isFive ? y : y + .3, fill: isFive ? '#fffbee' : '#635f50', 'font-size': isFive ? 17 : 16, 'font-weight': isFive ? 600 : 450 }, minute));
    const [dx, dy] = point(169, angle);
    innerLabels.append(svgElement('circle', { cx: dx, cy: dy, r: 1.9, fill: '#8b826c' }));
  }
}

const translations = {
  en: {
    title: 'Learning clock', language: 'Language', current: 'Set to current time',
    random: 'Set to random time', showHands: 'Show hands', hour: 'Hour hand', minute: 'Minute hand',
    second: 'Seconds hand', handsShown: names => `Shown hands: ${names.join(', ')}.`,
    runClock: 'Run clock', running: 'Clock running', paused: 'Clock paused',
    readTime: 'Read time aloud', reading: 'Reading…', speechUnsupported: 'Reading aloud is unavailable in this browser.',
    voice: 'Voice', automaticVoice: 'Automatic',
    speechFailed: 'Could not read the time aloud. Please try again or check your device’s speech voices.',
    numberPosition: 'Hour numbers', numberStart: 'Start of section', numberMiddle: 'Middle of section',
    minuteMotion: 'Minute hand', minuteJumps: 'Jumps', minuteSmooth: 'Smooth',
    both: 'Hour and minute hands are shown.', hourOnly: 'Only the hour hand is shown.',
    minuteOnly: 'Only the minute hand is shown.', neither: 'Both hands are hidden.',
    face: 'A colorful learning clock.', time: (hour, minute, second) => `The time is ${hour}:${minute}${second === null ? '' : `:${second}`}.`,
  },
  'zh-Hant': {
    title: '學習時鐘', language: '語言', current: '設為目前時間',
    random: '設為隨機時間', showHands: '顯示指針', hour: '時針', minute: '分針',
    second: '秒針', handsShown: names => `顯示指針：${names.join('、')}。`,
    runClock: '啟用時鐘走動', running: '時鐘走動中', paused: '時鐘已暫停',
    readTime: '朗讀時間', reading: '朗讀中…', speechUnsupported: '此瀏覽器不支援語音朗讀。',
    voice: '朗讀聲音', automaticVoice: '自動選擇',
    speechFailed: '無法朗讀時間。請再試一次，或檢查裝置的語音設定。',
    numberPosition: '數字位置', numberStart: '區段起點', numberMiddle: '區段中央',
    minuteMotion: '分針走法', minuteJumps: '跳動', minuteSmooth: '平滑移動',
    both: '顯示時針和分針。', hourOnly: '只顯示時針。', minuteOnly: '只顯示分針。',
    neither: '時針和分針皆已隱藏。', face: '彩色學習時鐘。',
    time: (hour, minute, second) => `現在是 ${hour} 點 ${Number(minute)} 分${second === null ? '' : ` ${Number(second)} 秒`}。`,
  },
};
const browserLanguage = navigator.language || navigator.languages?.[0] || 'en';
let language = /^(zh|cmn|yue)(?:[-_]|$)/i.test(browserLanguage) ? 'zh-Hant' : 'en';
let numberPosition = 'middle';
try {
  const savedLanguage = localStorage.getItem('clock-language');
  if (Object.hasOwn(translations, savedLanguage)) language = savedLanguage;
  const savedPosition = localStorage.getItem('clock-number-position');
  if (savedPosition === 'middle' || savedPosition === 'start') numberPosition = savedPosition;
} catch { /* The clock also works when browser storage is unavailable. */ }

let savedSettings = {};
try {
  const stored = JSON.parse(localStorage.getItem('clock-settings'));
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) savedSettings = stored;
} catch { /* Ignore unavailable storage or invalid saved settings. */ }
const voiceChoices = {
  en: typeof savedSettings.voices?.en === 'string' ? savedSettings.voices.en : '',
  'zh-Hant': typeof savedSettings.voices?.['zh-Hant'] === 'string' ? savedSettings.voices['zh-Hant'] : '',
};
let minuteMotion = savedSettings.minuteMotion === 'smooth' ? 'smooth' : 'jumps';
document.getElementById('minute-motion').value = minuteMotion;
document.getElementById('minute-motion').addEventListener('change', event => {
  minuteMotion = event.target.value === 'smooth' ? 'smooth' : 'jumps';
  saveSettings();
  updateHands();
});
for (const [id, key] of [['show-hour', 'hour'], ['show-minute', 'minute'], ['show-second', 'second']]) {
  if (typeof savedSettings[key] === 'boolean') document.getElementById(id).checked = savedSettings[key];
}

function saveSettings() {
  const settings = {
    hour: document.getElementById('show-hour').checked,
    minute: document.getElementById('show-minute').checked,
    second: document.getElementById('show-second').checked,
    running,
    voices: voiceChoices,
    minuteMotion,
  };
  try { localStorage.setItem('clock-settings', JSON.stringify(settings)); } catch { /* Optional preferences. */ }
}

function centerClockNumbers() {
  const context = document.createElement('canvas').getContext('2d');
  context.textAlign = 'center';
  // Center the visible ink rather than the font's spacing around each digit.
  for (const label of document.querySelectorAll('#hour-labels text, #minute-labels .circled-minute')) {
    const font = getComputedStyle(label);
    context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
    const metrics = context.measureText(label.textContent);
    label.setAttribute('dx', (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2);
    label.setAttribute('dy', (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
  }
}

function syncMinuteNumberMask() {
  const digits = Array.from(document.querySelectorAll('#hour-labels text'), label => {
    const digit = label.cloneNode(true);
    digit.setAttribute('fill', 'black');
    // Only the printed digit shapes reduce the minute hand's opacity to 45%.
    digit.setAttribute('opacity', '0.55');
    return digit;
  });
  document.getElementById('minute-mask-digits').replaceChildren(...digits);
}

function setNumberPosition(position) {
  numberPosition = position === 'start' ? 'start' : 'middle';
  const labels = document.getElementById('hour-labels').children;
  for (let hour = 0; hour < 12; hour++) {
    const [x, y] = point(236, hour * 30 + (numberPosition === 'middle' ? 15 : 0));
    labels[hour * 2].setAttribute('cx', x);
    labels[hour * 2].setAttribute('cy', y);
    labels[hour * 2 + 1].setAttribute('x', x);
    labels[hour * 2 + 1].setAttribute('y', y);
  }
  document.getElementById('number-position').value = numberPosition;
  syncMinuteNumberMask();
  try { localStorage.setItem('clock-number-position', numberPosition); } catch { /* Optional preference. */ }
}

document.getElementById('number-position').addEventListener('change', event => {
  setNumberPosition(event.target.value);
});

function syncCurrentTime() {
  const now = new Date();
  displayedMinutes = (now.getHours() % 12) * 60 + now.getMinutes();
  displayedSeconds = now.getSeconds();
}

let live = true;
let running = typeof savedSettings.running === 'boolean' ? savedSettings.running : true;
// All hands use the same snapshot, including across minute/hour boundaries.
let displayedMinutes = 0;
let displayedSeconds = 0;
let practiceAnchorMilliseconds = 0;
let practiceAnchorSeconds = 0;
syncCurrentTime();
const hourHand = document.getElementById('hour-hand');
const minuteHand = document.getElementById('minute-hand');
const secondHand = document.getElementById('second-hand');
const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let speechError = speechSupported ? '' : 'speechUnsupported';
let activeSpeech = null;

const normalizeVoiceLanguage = tag => tag.toLowerCase().replaceAll('_', '-');
const voiceKey = voice => voice.voiceURI || `${voice.name || ''}|${voice.lang}`;

function matchingVoices() {
  if (!speechSupported) return [];
  const isChinese = language === 'zh-Hant';
  const preferred = isChinese ? 'zh-tw' : 'en-us';
  return window.speechSynthesis.getVoices().filter(voice => {
    const tag = normalizeVoiceLanguage(voice.lang);
    // Chinese mode reads Mandarin, so do not choose Cantonese/Hong Kong voices.
    return isChinese ? /^(zh|cmn)(-|$)/.test(tag) && !/(^|-)hk(-|$)/.test(tag) : /^en(-|$)/.test(tag);
  }).map((voice, index) => {
    const name = `${voice.name || ''} ${voice.voiceURI || ''}`;
    const tag = normalizeVoiceLanguage(voice.lang);
    let score = tag === preferred ? 40 : isChinese && /hant/.test(tag) ? 35 : 20;
    // These are name-based preferences, not a quality flag provided by the API.
    if (/premium|natural|neural/i.test(name)) score += 300;
    else if (/enhanced/i.test(name)) score += 250;
    else if (/google/i.test(name)) score += 200;
    if (/\b(samantha|meijia|mei-jia|tingting|ting-ting|daniel|karen|serena|moira|tessa|rishi)\b/i.test(name)) score += 80;
    if (/\b(eddy|flo|fred|grandma|grandpa|junior|kathy|ralph|reed|rocko|sandy|shelley)\b/i.test(name)) score -= 100;
    if (/albert|bad news|bahh|bells|boing|bubbles|cellos|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox/i.test(name)) score -= 1000;
    return { voice, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.voice);
}

function updateVoiceOptions() {
  const select = document.getElementById('voice-choice');
  const voices = matchingVoices();
  const automatic = document.createElement('option');
  automatic.value = '';
  automatic.textContent = translations[language].automaticVoice + (voices[0] ? ` — ${voices[0].name || voices[0].lang}` : '');
  const options = voices.map(voice => {
    const option = document.createElement('option');
    option.value = voiceKey(voice);
    option.textContent = `${voice.name || voice.lang} (${voice.lang})`;
    return option;
  });
  select.replaceChildren(automatic, ...options);
  select.value = voices.some(voice => voiceKey(voice) === voiceChoices[language]) ? voiceChoices[language] : '';
  select.disabled = !speechSupported || voices.length === 0;
  document.getElementById('voice-label').textContent = translations[language].voice;
}

document.getElementById('voice-choice').addEventListener('change', event => {
  voiceChoices[language] = event.target.value;
  saveSettings();
  if (speechSupported) {
    activeSpeech = null;
    window.speechSynthesis.cancel();
    speechError = '';
    updateSpeechControl();
  }
});
if (speechSupported) window.speechSynthesis.addEventListener?.('voiceschanged', updateVoiceOptions);

function spokenNumber(number, isChinese) {
  if (isChinese) {
    const digits = '零一二三四五六七八九';
    if (number < 10) return digits[number];
    const tens = Math.floor(number / 10);
    return `${tens === 1 ? '' : digits[tens]}十${number % 10 ? digits[number % 10] : ''}`;
  }
  const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  if (number < 20) return small[number];
  return `${['', '', 'twenty', 'thirty', 'forty', 'fifty'][Math.floor(number / 10)]}${number % 10 ? ` ${small[number % 10]}` : ''}`;
}

function spokenTime() {
  const hour = Math.floor(displayedMinutes / 60) || 12;
  const minute = displayedMinutes % 60;
  const includeSeconds = document.getElementById('show-second').checked;
  const isChinese = language === 'zh-Hant';
  const number = value => spokenNumber(value, isChinese);
  if (isChinese) {
    const hourText = hour === 2 ? '兩' : number(hour);
    if (!includeSeconds && minute === 0) return `${hourText}點整。`;
    return `${hourText}點${number(minute)}分${includeSeconds ? `${number(displayedSeconds)}秒` : ''}。`;
  }
  const minuteText = minute === 0 ? "o'clock" : `${minute < 10 ? 'oh ' : ''}${number(minute)}`;
  return `${number(hour)} ${minuteText}${includeSeconds ? ` and ${number(displayedSeconds)} ${displayedSeconds === 1 ? 'second' : 'seconds'}` : ''}.`;
}

function updateSpeechControl() {
  document.getElementById('read-button').disabled = !speechSupported;
  document.getElementById('read-button').setAttribute('aria-busy', String(activeSpeech !== null));
  document.getElementById('read-label').textContent = translations[language][activeSpeech ? 'reading' : 'readTime'];
  document.getElementById('speech-status').textContent = speechError ? translations[language][speechError] : '';
}

document.getElementById('read-button').addEventListener('click', () => {
  if (!speechSupported) return;
  // Refresh running clocks before taking the spoken snapshot; paused clocks hold their time.
  tickClock();
  speechError = '';
  updateSpeechControl();
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(spokenTime());
  activeSpeech = utterance;
  utterance.lang = language === 'zh-Hant' ? 'zh-TW' : 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  const voices = matchingVoices();
  const voice = voices.find(item => voiceKey(item) === voiceChoices[language]) || voices[0];
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.onend = () => {
    if (activeSpeech === utterance) {
      activeSpeech = null;
      updateSpeechControl();
    }
  };
  utterance.onerror = event => {
    if (activeSpeech !== utterance) return;
    activeSpeech = null;
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      speechError = 'speechFailed';
    }
    updateSpeechControl();
  };
  try {
    updateSpeechControl();
    window.speechSynthesis.speak(utterance);
  } catch {
    activeSpeech = null;
    speechError = 'speechFailed';
    updateSpeechControl();
  }
});

function anchorPracticeTime() {
  practiceAnchorMilliseconds = Date.now();
  practiceAnchorSeconds = displayedMinutes * 60 + displayedSeconds;
}

function tickClock() {
  if (!running) return;
  if (live) {
    syncCurrentTime();
  } else {
    const elapsed = Math.max(0, Math.floor((Date.now() - practiceAnchorMilliseconds) / 1000));
    const totalSeconds = (practiceAnchorSeconds + elapsed) % (12 * 60 * 60);
    displayedMinutes = Math.floor(totalSeconds / 60);
    displayedSeconds = totalSeconds % 60;
  }
  updateHands();
}

function updateHands() {
  const hours = Math.floor(displayedMinutes / 60);
  const minutes = displayedMinutes % 60;
  // At 3:30 this places the hour hand halfway from 3 to 4 (105°).
  hourHand.setAttribute('transform', `rotate(${(displayedMinutes + displayedSeconds / 60) / 2} 350 350)`);
  const minuteAngle = (minutes + (minuteMotion === 'smooth' ? displayedSeconds / 60 : 0)) * 6;
  minuteHand.setAttribute('transform', `rotate(${minuteAngle} 350 350)`);
  secondHand.setAttribute('transform', `rotate(${displayedSeconds * 6} 350 350)`);
  const description = document.getElementById('clock-description');
  const hourVisible = document.getElementById('show-hour').checked;
  const minuteVisible = document.getElementById('show-minute').checked;
  const secondVisible = document.getElementById('show-second').checked;
  hourHand.style.display = hourVisible ? '' : 'none';
  minuteHand.style.display = minuteVisible ? '' : 'none';
  secondHand.style.display = secondVisible ? '' : 'none';
  const text = translations[language];
  document.getElementById('running-button').setAttribute('aria-checked', String(running));
  document.getElementById('running-button').setAttribute('aria-label', text.runClock);
  document.getElementById('running-label').textContent = running ? text.running : text.paused;
  const visibleDescription = secondVisible
    ? text.handsShown([hourVisible && text.hour, minuteVisible && text.minute, text.second].filter(Boolean))
    : hourVisible && minuteVisible ? text.both : hourVisible ? text.hourOnly : minuteVisible ? text.minuteOnly : text.neither;
  // Do not reveal a hidden hand's answer through the accessible clock label.
  description.textContent = hourVisible && minuteVisible
    ? `${text.time(hours || 12, String(minutes).padStart(2, '0'), secondVisible ? String(displayedSeconds).padStart(2, '0') : null)} ${visibleDescription}`
    : `${text.face} ${visibleDescription}`;
}

function setLanguage(nextLanguage) {
  if (nextLanguage !== language && speechSupported) {
    activeSpeech = null;
    window.speechSynthesis.cancel();
    speechError = '';
  }
  language = nextLanguage;
  const text = translations[language];
  document.documentElement.lang = language;
  document.title = text.title;
  document.querySelector('.clock-section').setAttribute('aria-label', text.title);
  document.getElementById('clock-title').textContent = text.title;
  document.querySelector('.language-switch').setAttribute('aria-label', text.language);
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = text[element.dataset.i18n];
  });
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  try { localStorage.setItem('clock-language', language); } catch { /* Optional preference. */ }
  updateSpeechControl();
  updateVoiceOptions();
  updateHands();
}

document.querySelectorAll('[data-language]').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.language));
});

document.getElementById('current-button').addEventListener('click', () => {
  live = true;
  syncCurrentTime();
  updateHands();
});

document.getElementById('random-button').addEventListener('click', () => {
  // Pick any other minute on the 12-hour face, so every click changes the time.
  displayedMinutes = (displayedMinutes + 1 + Math.floor(Math.random() * 719)) % 720;
  displayedSeconds = Math.floor(Math.random() * 60);
  live = false;
  anchorPracticeTime();
  updateHands();
});

document.getElementById('running-button').addEventListener('click', () => {
  if (running) tickClock();
  running = !running;
  // Resume from the displayed time without catching up the paused interval.
  live = false;
  anchorPracticeTime();
  saveSettings();
  updateHands();
});

for (const [id, hand] of [['show-hour', hourHand], ['show-minute', minuteHand], ['show-second', secondHand]]) {
  document.getElementById(id).addEventListener('change', event => {
    hand.style.display = event.target.checked ? '' : 'none';
    saveSettings();
    updateHands();
  });
}

drawFace();
centerClockNumbers();
setNumberPosition(numberPosition);
setLanguage(language);
saveSettings();
setInterval(tickClock, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tickClock();
});
