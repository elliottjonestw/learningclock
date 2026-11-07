const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../dist/clock.js'), 'utf8');

function loadClock({ storedLanguage = null, storedNumberPosition = null, storedSettings = null, browserLanguage = 'en-US', browserLanguages = [browserLanguage], storageBlocked = false, speechAvailable = true, voices = [] } = {}) {
  const nodes = new Map();
  function element() {
    return {
      checked: true, textContent: '', attributes: {}, children: [], style: {}, dataset: {}, listeners: {},
      setAttribute(name, value) { this.attributes[name] = String(value); },
      append(child) { this.children.push(child); },
      replaceChildren(...children) { this.children = children; },
      cloneNode() { return { ...element(), attributes: { ...this.attributes }, textContent: this.textContent }; },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      click() { this.listeners.click?.({ target: this }); },
    };
  }
  const node = key => {
    if (!nodes.has(key)) {
      const value = element();
      if (key === 'show-second') value.checked = false;
      nodes.set(key, value);
    }
    return nodes.get(key);
  };
  const languageButtons = ['en', 'zh-Hant'].map(language => {
    const button = element(); button.dataset.language = language; return button;
  });
  const labels = ['current', 'random', 'showHands', 'hour', 'minute', 'numberPosition', 'numberStart', 'numberMiddle', 'second', 'minuteMotion', 'minuteJumps', 'minuteSmooth', 'timeHour', 'timeMinute', 'applyTime', 'customTimeHint'].map(key => {
    const label = element(); label.dataset.i18n = key; return label;
  });
  const callbacks = {};
  const clock = { hours: 15, minutes: 30, seconds: 0, now: 0 };
  const storage = { value: storedLanguage, position: storedNumberPosition, settings: storedSettings };
  const speech = { utterances: [], cancellations: 0 };
  const browserWindow = speechAvailable ? {
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: {
      getVoices: () => voices,
      speak: utterance => { speech.utterances.push(utterance); },
      cancel: () => { speech.cancellations++; },
      addEventListener: (event, callback) => { speech[event] = callback; },
    },
  } : {};
  const document = {
    documentElement: {}, hidden: false,
    getElementById: node,
    createElementNS: element,
    createElement: tag => tag === 'canvas' ? ({ getContext: () => ({ measureText: () => ({ actualBoundingBoxLeft: 20, actualBoundingBoxRight: 20, actualBoundingBoxAscent: 35, actualBoundingBoxDescent: 1 }) }) }) : element(),
    querySelector: node,
    querySelectorAll: selector => {
      if (selector === '[data-language]') return languageButtons;
      if (selector.startsWith('#hour-labels text')) {
        const hours = node('hour-labels').children.filter((_, index) => index % 2 === 1);
        return selector.includes(',') ? [...hours, ...node('minute-labels').children.filter(item => item.attributes.class === 'circled-minute')] : hours;
      }
      return labels;
    },
    addEventListener: (event, callback) => { callbacks[event] = callback; },
  };
  const context = vm.createContext({
    document,
    window: browserWindow,
    navigator: { language: browserLanguage, languages: browserLanguages },
    getComputedStyle: () => ({ fontWeight: '650', fontSize: '48px', fontFamily: 'system-ui' }),
    Date: class { static now() { return clock.now; } getHours() { return clock.hours; } getMinutes() { return clock.minutes; } getSeconds() { return clock.seconds; } },
    // Every random click selects the following minute, covering every possible time.
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    localStorage: {
      getItem(key) { if (storageBlocked) throw Error('blocked'); return key === 'clock-language' ? storage.value : key === 'clock-number-position' ? storage.position : storage.settings; },
      setItem(key, value) { if (storageBlocked) throw Error('blocked'); if (key === 'clock-language') storage.value = value; else if (key === 'clock-number-position') storage.position = value; else storage.settings = value; },
    },
    setInterval: callback => { callbacks.tick = callback; },
  });
  vm.runInContext(source, context);
  const angle = id => Number(node(id).attributes.transform.match(/rotate\(([\d.]+)/)[1]);
  return { node, clock, document, labels, languageButtons, storage, callbacks, angle, speech };
}

function submitTime(app, hour, minute) {
  app.node('custom-hour').value = String(hour);
  app.node('custom-minute').value = String(minute);
  let prevented = false;
  app.node('custom-time-form').listeners.submit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
}

test('color sections begin at the hour markers and cover the following five minutes', () => {
  const app = loadClock({ storedNumberPosition: 'start' });
  const sectors = app.node('sectors').children;
  assert.equal(sectors.length, 12);
  // The red section starts directly above the center, at minute zero.
  assert.ok(sectors[0].attributes.d.startsWith('M350,59 '));
  // The yellow three-o’clock section starts directly to the right, at minute 15.
  assert.ok(sectors[3].attributes.d.startsWith('M641,350 '));
  // Hour-number positions remain at 12, 3, 6, and 9 on the face.
  const labels = app.node('hour-labels').children.filter((_, index) => index % 2 === 1);
  assert.equal(labels[0].attributes.x, '350');
  assert.equal(labels[0].attributes.y, '114');
  assert.equal(labels[3].attributes.x, '586');
  assert.equal(labels[3].attributes.y, '350');
});

test('both hands agree with the selected time through a complete 12-hour cycle', () => {
  const app = loadClock();
  assert.equal(app.angle('hour-hand'), 105); // 3:30, halfway between 3 and 4.
  assert.equal(app.angle('minute-hand'), 180);
  for (let step = 1; step <= 720; step++) {
    app.node('random-button').click();
    const selected = (210 + step) % 720;
    const hour = Math.floor(selected / 60);
    const minute = selected % 60;
    assert.equal(app.node('clock-description').textContent, `The time is ${hour || 12}:${String(minute).padStart(2, '0')}. Hour and minute hands are shown.`);
    assert.equal(app.angle('minute-hand'), minute * 6);
    assert.equal(app.angle('hour-hand'), hour * 30 + minute * 0.5);
  }
  app.clock.hours = 23;
  app.clock.minutes = 59;
  app.node('current-button').click();
  assert.equal(app.angle('hour-hand'), 359.5);
  assert.equal(app.angle('minute-hand'), 354);
  app.clock.hours = 0;
  app.clock.minutes = 0;
  app.callbacks.tick();
  assert.equal(app.angle('hour-hand'), 0);
  assert.equal(app.angle('minute-hand'), 0);
});

test('paused random time stays still until current time is selected', () => {
  const app = loadClock();
  app.node('running-button').click();
  app.node('random-button').click();
  const original = app.node('clock-description').textContent;
  app.clock.hours = 8;
  app.clock.minutes = 45;
  app.clock.now += 12000;
  app.callbacks.tick();
  app.callbacks.visibilitychange();
  assert.equal(app.node('clock-description').textContent, original);
  app.node('current-button').click();
  assert.equal(app.angle('hour-hand'), 262.5);
  assert.equal(app.angle('minute-hand'), 270);
});

test('language switch translates the controls and preserves time and visibility', () => {
  const app = loadClock();
  app.node('random-button').click();
  const original = app.angle('hour-hand');
  const input = app.node('show-hour'); input.checked = false;
  input.listeners.change({ target: input });
  app.languageButtons[1].click();
  assert.equal(app.document.documentElement.lang, 'zh-Hant');
  assert.equal(app.document.title, '學習時鐘');
  assert.deepEqual(app.labels.map(label => label.textContent), ['設為目前時間', '設為隨機時間', '顯示指針', '時針', '分針', '數字位置', '區段起點', '區段中央', '秒針', '分針走法', '跳動', '平滑移動', '時', '分', '設定時間', '請選擇 1 到 12 時。設定時間後，時鐘會暫停。']);
  assert.equal(app.languageButtons[1].attributes['aria-pressed'], 'true');
  assert.equal(app.node('hour-hand').style.display, 'none');
  assert.equal(app.angle('hour-hand'), original);
  assert.equal(app.node('clock-description').textContent, '彩色學習時鐘。 只顯示分針。');
  assert.equal(app.storage.value, 'zh-Hant');
  app.languageButtons[0].click();
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(app.labels[0].textContent, 'Set to current time');
});

test('saved language loads and blocked storage does not prevent startup', () => {
  assert.equal(loadClock({ storedLanguage: 'zh-Hant' }).document.documentElement.lang, 'zh-Hant');
  assert.equal(loadClock({ storedLanguage: 'invalid' }).document.documentElement.lang, 'en');
  assert.equal(loadClock({ storageBlocked: true }).document.documentElement.lang, 'en');
});

test('seconds hand is off by default, ticks when enabled, and stays still in practice mode', () => {
  const app = loadClock();
  const toggle = app.node('show-second');
  assert.equal(toggle.checked, false);
  assert.equal(app.node('second-hand').style.display, 'none');
  toggle.checked = true;
  toggle.listeners.change({ target: toggle });
  assert.equal(app.node('second-hand').style.display, '');
  app.clock.seconds = 45;
  app.callbacks.tick();
  assert.equal(app.angle('second-hand'), 270);
  assert.equal(app.angle('minute-hand'), 180);
  assert.equal(app.angle('hour-hand'), 105.375);
  assert.match(app.node('clock-description').textContent, /3:30:45/);
  app.clock.hours = 0; app.clock.minutes = 0; app.clock.seconds = 0;
  app.callbacks.tick();
  assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), [0, 0, 0]);
  app.node('random-button').click();
  app.node('running-button').click();
  const frozen = ['hour-hand', 'minute-hand', 'second-hand'].map(app.angle);
  app.clock.seconds = 15;
  app.clock.now += 15000;
  app.callbacks.tick();
  assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), frozen);
  app.node('current-button').click();
  assert.equal(app.angle('second-hand'), 90);
  app.languageButtons[1].click();
  assert.match(app.node('clock-description').textContent, /15 秒/);
  toggle.checked = false;
  toggle.listeners.change({ target: toggle });
  assert.equal(app.node('second-hand').style.display, 'none');
  assert.equal(loadClock().node('show-second').checked, false);
});

test('running toggle defaults on, advances random times, pauses and resumes without jumping', () => {
  const app = loadClock();
  const button = app.node('running-button');
  assert.equal(button.attributes['aria-checked'], 'true');
  assert.equal(app.node('running-label').textContent, 'Clock running');
  app.node('random-button').click(); // 3:31:00
  app.clock.now += 75000;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 192); // 3:32:15, fixed to minute 32.
  assert.equal(app.angle('second-hand'), 90);
  button.click();
  assert.equal(button.attributes['aria-checked'], 'false');
  assert.equal(app.node('running-label').textContent, 'Clock paused');
  app.clock.now += 90000;
  app.callbacks.tick();
  app.callbacks.visibilitychange();
  assert.equal(app.angle('minute-hand'), 192);
  app.languageButtons[1].click();
  assert.equal(app.node('running-label').textContent, '時鐘已暫停');
  button.click();
  assert.equal(button.attributes['aria-checked'], 'true');
  assert.equal(app.angle('minute-hand'), 192);
  app.clock.now += 1000;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 192);
  assert.equal(app.angle('second-hand'), 96);
});

test('inner ring has no 24-hour labels and all circled minute digits are centered', () => {
  const app = loadClock();
  const inner = app.node('inner-labels').children;
  assert.equal(inner.length, 60);
  assert.ok(inner.every(item => item.textContent === ''));
  const labels = app.node('minute-labels').children;
  const circled = labels.filter(item => item.attributes.class === 'circled-minute');
  assert.equal(circled.length, 12);
  for (const label of circled) {
    const circle = labels[labels.indexOf(label) - 1];
    assert.equal(label.attributes.x, circle.attributes.cx);
    assert.equal(label.attributes.y, circle.attributes.cy);
    assert.ok(Number.isFinite(Number(label.attributes.dx)));
    assert.ok(Number.isFinite(Number(label.attributes.dy)));
  }
});

test('number-position setting moves only the large hour labels and persists separately from language', () => {
  const app = loadClock();
  app.node('random-button').click();
  const beforeHands = [app.angle('hour-hand'), app.angle('minute-hand')];
  const beforeSectors = app.node('sectors').children.map(node => node.attributes.d);
  const beforeInnerLabels = JSON.stringify(app.node('inner-labels').children);
  const labels = app.node('hour-labels').children;
  const setting = app.node('number-position');
  setting.value = 'middle';
  setting.listeners.change({ target: setting });
  // 12 sits at 15 degrees clockwise from the top, in the center of the red section.
  assert.ok(Math.abs(Number(labels[0].attributes.cx) - 411.0812946441949) < 0.00001);
  assert.ok(Math.abs(Number(labels[0].attributes.cy) - 122.0415049957799) < 0.00001);
  assert.equal(labels[1].attributes.x, labels[0].attributes.cx);
  assert.deepEqual([app.angle('hour-hand'), app.angle('minute-hand')], beforeHands);
  assert.deepEqual(app.node('sectors').children.map(node => node.attributes.d), beforeSectors);
  assert.equal(JSON.stringify(app.node('inner-labels').children), beforeInnerLabels);
  assert.equal(app.storage.position, 'middle');
  app.languageButtons[1].click();
  assert.equal(setting.value, 'middle');
  assert.equal(app.storage.position, 'middle');
  assert.equal(app.storage.value, 'zh-Hant');
  setting.value = 'start';
  setting.listeners.change({ target: setting });
  assert.equal(labels[0].attributes.cx, '350');
  assert.equal(labels[0].attributes.cy, '114');
  assert.equal(app.storage.position, 'start');
  assert.equal(loadClock({ storedNumberPosition: 'middle' }).node('number-position').value, 'middle');
  assert.equal(loadClock({ storedNumberPosition: 'start' }).node('number-position').value, 'start');
  assert.equal(loadClock({ storedNumberPosition: 'invalid' }).node('number-position').value, 'middle');
  assert.equal(loadClock().node('number-position').value, 'middle');
});

test('read-aloud uses the selected language, device voice, and displayed time', () => {
  const english = { lang: 'en-US', localService: true };
  const chinese = { lang: 'zh-TW', localService: true };
  const app = loadClock({ voices: [english, { lang: 'zh-CN' }, chinese] });
  app.node('running-button').click();
  app.clock.hours = 8; // Wall time differs from the paused clock.
  app.node('read-button').click();
  let utterance = app.speech.utterances.at(-1);
  assert.equal(utterance.text, 'three thirty.');
  assert.equal(utterance.lang, 'en-US');
  assert.equal(utterance.voice, english);
  assert.equal(app.node('read-label').textContent, 'Reading…');
  utterance.onend();
  assert.equal(app.node('read-label').textContent, 'Read time aloud');
  app.languageButtons[1].click();
  assert.equal(app.node('read-label').textContent, '朗讀時間');
  app.node('read-button').click();
  utterance = app.speech.utterances.at(-1);
  assert.equal(utterance.text, '三點三十分。');
  assert.equal(utterance.lang, 'zh-TW');
  assert.equal(utterance.voice, chinese);
  const canceledBeforeRepeat = app.speech.cancellations;
  app.node('read-button').click();
  assert.equal(app.speech.cancellations, canceledBeforeRepeat + 1);
  app.node('random-button').click();
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, '三點三十一分。');
});

test('speech formats whole hours, small minutes, seconds and refreshes running clocks', () => {
  const app = loadClock();
  app.clock.hours = 0; app.clock.minutes = 0;
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, "twelve o'clock.");
  app.clock.hours = 14; app.clock.minutes = 5; app.clock.seconds = 1;
  app.node('show-second').checked = true;
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, 'two oh five and one second.');
  app.languageButtons[1].click();
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, '兩點五分一秒。');
  app.node('show-second').checked = false;
  app.clock.minutes = 0;
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, '兩點整。');
});

test('speech handles unsupported browsers and voice failures without breaking the clock', () => {
  const unsupported = loadClock({ speechAvailable: false });
  assert.equal(unsupported.node('read-button').disabled, true);
  assert.equal(unsupported.node('speech-status').textContent, 'Reading aloud is unavailable in this browser.');
  unsupported.languageButtons[1].click();
  assert.equal(unsupported.node('speech-status').textContent, '此瀏覽器不支援語音朗讀。');
  const app = loadClock();
  app.node('read-button').click();
  app.speech.utterances.at(-1).onerror({ error: 'voice-unavailable' });
  assert.match(app.node('speech-status').textContent, /Could not read/);
  assert.equal(app.node('read-label').textContent, 'Read time aloud');
  app.node('read-button').click();
  assert.equal(app.node('speech-status').textContent, '');
});

test('first-session language follows Chinese browser languages and saved choices take priority', () => {
  for (const browserLanguage of ['zh', 'zh-TW', 'zh-CN', 'zh-HK', 'zh-Hans-CN', 'zh-Hant', 'ZH_tw', 'yue-HK', 'cmn-TW']) {
    assert.equal(loadClock({ browserLanguage }).document.documentElement.lang, 'zh-Hant');
  }
  for (const browserLanguage of ['en-US', 'fr-FR', 'ja-JP', 'de-DE']) {
    assert.equal(loadClock({ browserLanguage }).document.documentElement.lang, 'en');
  }
  assert.equal(loadClock({ browserLanguage: '', browserLanguages: ['zh-TW'] }).document.documentElement.lang, 'zh-Hant');
  assert.equal(loadClock({ browserLanguage: 'zh-CN', storedLanguage: 'en' }).document.documentElement.lang, 'en');
  assert.equal(loadClock({ browserLanguage: 'en-US', storedLanguage: 'zh-Hant' }).document.documentElement.lang, 'zh-Hant');
  assert.equal(loadClock({ browserLanguage: 'zh-TW', storageBlocked: true }).document.documentElement.lang, 'zh-Hant');
});

test('settings persist across sessions, including hidden hands, seconds and paused mode', () => {
  const first = loadClock();
  for (const [id, checked] of [['show-hour', false], ['show-minute', false], ['show-second', true]]) {
    const input = first.node(id); input.checked = checked;
    input.listeners.change({ target: input });
  }
  first.node('running-button').click();
  first.languageButtons[1].click();
  first.node('number-position').value = 'start';
  first.node('number-position').listeners.change({ target: first.node('number-position') });
  const next = loadClock({
    storedLanguage: first.storage.value,
    storedNumberPosition: first.storage.position,
    storedSettings: first.storage.settings,
  });
  assert.equal(next.document.documentElement.lang, 'zh-Hant');
  assert.equal(next.node('number-position').value, 'start');
  assert.equal(next.node('show-hour').checked, false);
  assert.equal(next.node('hour-hand').style.display, 'none');
  assert.equal(next.node('show-minute').checked, false);
  assert.equal(next.node('minute-hand').style.display, 'none');
  assert.equal(next.node('show-second').checked, true);
  assert.equal(next.node('second-hand').style.display, '');
  assert.equal(next.node('running-button').attributes['aria-checked'], 'false');
  next.clock.now += 6000;
  next.clock.seconds = 6;
  next.callbacks.tick();
  assert.equal(next.angle('second-hand'), 0);
  for (const storedSettings of ['invalid JSON', 'null', '[]', '{"hour":"false","running":0}']) {
    const app = loadClock({ storedSettings });
    assert.equal(app.node('show-hour').checked, true);
    assert.equal(app.node('show-second').checked, false);
    assert.equal(app.node('running-button').attributes['aria-checked'], 'true');
  }
});

test('automatic speech prefers enhanced and Google voices over the first basic system voice', () => {
  const basicEnglish = { lang: 'en-US', name: 'Basic English', localService: true };
  const googleEnglish = { lang: 'en-US', name: 'Google US English', localService: false };
  const basicChinese = { lang: 'zh-TW', name: 'Mei-Jia', localService: true };
  const googleChinese = { lang: 'zh-TW', name: 'Google 國語（臺灣）', localService: false };
  const enhancedEnglish = { lang: 'en-GB', name: 'Serena (Enhanced)', localService: true };
  const cantonese = { lang: 'zh-HK', name: 'Google Cantonese' };
  const voices = [basicEnglish, googleEnglish, basicChinese, cantonese, googleChinese];
  const app = loadClock({ voices });
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).voice, googleEnglish);
  assert.equal(app.speech.utterances.at(-1).rate, 1);
  assert.equal(app.speech.utterances.at(-1).pitch, 1);
  app.languageButtons[1].click();
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).voice, googleChinese);
  assert.ok(!app.node('voice-choice').children.some(option => option.textContent.includes('Cantonese')));
  voices.push(enhancedEnglish);
  app.languageButtons[0].click();
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).voice, enhancedEnglish);
  assert.equal(app.speech.utterances.at(-1).lang, 'en-GB');
});

test('voice lists refresh after loading and per-language voice choices survive the next session', () => {
  const voices = [];
  const app = loadClock({ voices });
  assert.equal(app.node('voice-choice').disabled, true);
  voices.push({ name: 'Samantha', lang: 'en-US', voiceURI: 'samantha' }, { name: 'Google English', lang: 'en-US', voiceURI: 'google-en' }, { name: 'Mei-Jia', lang: 'zh-TW', voiceURI: 'meijia' });
  app.speech.voiceschanged();
  const picker = app.node('voice-choice');
  assert.equal(picker.disabled, false);
  assert.equal(picker.children.length, 3);
  picker.value = 'samantha'; picker.listeners.change({ target: picker });
  app.languageButtons[1].click();
  picker.value = 'meijia'; picker.listeners.change({ target: picker });
  app.languageButtons[0].click();
  assert.equal(picker.value, 'samantha');
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).voice.name, 'Samantha');
  const next = loadClock({ voices, storedSettings: app.storage.settings });
  assert.equal(next.node('voice-choice').value, 'samantha');
  next.languageButtons[1].click();
  assert.equal(next.node('voice-choice').value, 'meijia');
  next.node('read-button').click();
  assert.equal(next.speech.utterances.at(-1).voice.name, 'Mei-Jia');
});

test('Mac fallback prefers conversational voices over alphabetically earlier character voices', () => {
  const samantha = { name: 'Samantha', lang: 'en-US' };
  const meijia = { name: 'Meijia', lang: 'zh-TW' };
  const voices = [{ name: 'Eddy (English (United States))', lang: 'en-US' }, { name: 'Flo', lang: 'en-US' }, samantha, { name: 'Eddy (Chinese (Taiwan))', lang: 'zh-TW' }, meijia];
  const app = loadClock({ voices });
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).voice, samantha);
  app.languageButtons[1].click();
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).voice, meijia);
});

test('minute hand jumps by default and advances only at a minute boundary', () => {
  const app = loadClock();
  assert.equal(app.node('minute-motion').value, 'jumps');
  for (let seconds = 0; seconds < 60; seconds++) {
    app.clock.seconds = seconds;
    app.callbacks.tick();
    assert.equal(app.angle('minute-hand'), 180);
    assert.equal(app.angle('second-hand'), seconds * 6);
  }
  app.clock.minutes = 31; app.clock.seconds = 0;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 186);
  app.clock.hours = 23; app.clock.minutes = 59; app.clock.seconds = 59;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 354);
  app.clock.hours = 0; app.clock.minutes = 0; app.clock.seconds = 0;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 0);
});

test('smooth minute motion can be selected, stays accurate while paused, and is remembered', () => {
  const app = loadClock();
  app.clock.seconds = 30; app.callbacks.tick();
  const hourAngle = app.angle('hour-hand');
  const secondAngle = app.angle('second-hand');
  app.node('running-button').click();
  const setting = app.node('minute-motion');
  setting.value = 'smooth'; setting.listeners.change({ target: setting });
  assert.equal(app.angle('minute-hand'), 183);
  assert.equal(app.angle('hour-hand'), hourAngle);
  assert.equal(app.angle('second-hand'), secondAngle);
  app.clock.now += 5000; app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 183);
  const next = loadClock({ storedSettings: app.storage.settings });
  assert.equal(next.node('minute-motion').value, 'smooth');
  next.clock.seconds = 30; next.node('current-button').click();
  assert.equal(next.angle('minute-hand'), 183);
  setting.value = 'jumps'; setting.listeners.change({ target: setting });
  assert.equal(app.angle('minute-hand'), 180);
  assert.equal(JSON.parse(app.storage.settings).minuteMotion, 'jumps');
  assert.equal(loadClock({ storedSettings: '{"minuteMotion":"invalid"}' }).node('minute-motion').value, 'jumps');
});

test('custom time sets the hands, pauses for practice, and resumes from the chosen time', () => {
  const app = loadClock();
  submitTime(app, 8, '05');
  assert.equal(app.angle('hour-hand'), 242.5);
  assert.equal(app.angle('minute-hand'), 30);
  assert.equal(app.angle('second-hand'), 0);
  assert.equal(app.node('running-button').attributes['aria-checked'], 'false');
  assert.equal(JSON.parse(app.storage.settings).running, false);
  app.clock.now += 60000;
  app.callbacks.tick();
  app.callbacks.visibilitychange();
  assert.equal(app.angle('minute-hand'), 30);
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, 'eight oh five.');
  app.languageButtons[1].click();
  app.node('read-button').click();
  assert.equal(app.speech.utterances.at(-1).text, '八點五分。');
  app.node('running-button').click();
  app.clock.now += 61000;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 36);
  assert.equal(app.angle('second-hand'), 6);
  app.clock.hours = 14; app.clock.minutes = 20; app.clock.seconds = 0;
  app.node('current-button').click();
  assert.equal(app.angle('hour-hand'), 70);
  assert.equal(app.angle('minute-hand'), 120);
});

test('custom time resets seconds, preserves hidden hands, and wraps correctly past twelve', () => {
  const app = loadClock();
  app.node('show-second').checked = true;
  app.clock.seconds = 59;
  app.callbacks.tick();
  submitTime(app, 11, 59);
  assert.equal(app.angle('minute-hand'), 354);
  assert.equal(app.angle('second-hand'), 0);
  app.node('running-button').click();
  app.clock.now += 60000;
  app.callbacks.tick();
  assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), [0, 0, 0]);
  submitTime(app, 12, 0);
  assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), [0, 0, 0]);
  const hourToggle = app.node('show-hour');
  hourToggle.checked = false;
  hourToggle.listeners.change({ target: hourToggle });
  app.node('show-second').checked = false;
  submitTime(app, 1, 0);
  assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), [30, 0, 0]);
  assert.equal(app.node('hour-hand').style.display, 'none');
  assert.equal(app.node('second-hand').style.display, 'none');
  assert.equal(app.node('clock-description').textContent, 'A colorful learning clock. Only the minute hand is shown.');
});

test('invalid custom times leave the displayed time and running state unchanged', () => {
  const app = loadClock();
  app.node('show-second').checked = true;
  const original = ['hour-hand', 'minute-hand', 'second-hand'].map(app.angle);
  for (const values of [
    ['', 0], [0, 0], [13, 0], [1.5, 0], ['abc', 0],
    [1, ''], [1, -1], [1, 60], [1, 1.5],
  ]) {
    submitTime(app, ...values);
    assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), original);
    assert.equal(app.node('running-button').attributes['aria-checked'], 'true');
  }
});


test('each hour number sets that exact hour and pauses in both number positions', () => {
  for (const storedNumberPosition of ['start', 'middle']) {
    const app = loadClock({ storedNumberPosition });
    const labels = app.node('hour-labels').children;
    for (let hour = 0; hour < 12; hour++) {
      app.node('current-button').click();
      const button = labels[hour * 2];
      assert.equal(button.attributes.role, 'button');
      assert.equal(button.attributes.tabindex, '0');
      assert.equal(button.attributes['aria-label'], `Set to ${hour || 12} o’clock`);
      button.click();
      assert.deepEqual(['hour-hand', 'minute-hand', 'second-hand'].map(app.angle), [hour * 30, 0, 0]);
      assert.equal(app.node('custom-hour').value, String(hour || 12));
      assert.equal(app.node('custom-minute').value, '0');
      assert.equal(app.node('running-button').attributes['aria-checked'], 'false');
      app.clock.now += 61000;
      app.callbacks.tick();
      assert.equal(app.angle('hour-hand'), hour * 30);
    }
    app.languageButtons[1].click();
    assert.equal(labels[6].attributes['aria-label'], '設為 3 點整');
    labels[6].click();
    app.node('read-button').click();
    assert.equal(app.speech.utterances.at(-1).text, '三點整。');
  }
});

test('hour numbers support Enter and Space and resume from the selected hour', () => {
  const app = loadClock();
  const labels = app.node('hour-labels').children;
  for (const [hour, key] of [[9, 'Enter'], [12, ' ']]) {
    let prevented = false;
    labels[(hour % 12) * 2].listeners.keydown({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(app.angle('hour-hand'), (hour % 12) * 30);
  }
  labels[6].listeners.keydown({ key: 'Tab', preventDefault() { assert.fail('Tab should navigate normally'); } });
  assert.equal(app.angle('hour-hand'), 0);
  app.node('running-button').click();
  app.clock.now += 60000;
  app.callbacks.tick();
  assert.equal(app.angle('minute-hand'), 6);
  assert.equal(app.angle('hour-hand'), 0.5);
});
