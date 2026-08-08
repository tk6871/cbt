(function () {
  'use strict';

  const input = document.getElementById('calculatorInput');
  const resultNode = document.getElementById('calculatorResult');
  const angleStatus = document.getElementById('angleStatus');
  const shiftStatus = document.getElementById('shiftStatus');
  const alphaStatus = document.getElementById('alphaStatus');
  const memoryStatus = document.getElementById('memoryStatus');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const visualStyleButton = document.querySelector('[data-action="visual-style"]');
  const VISUAL_STYLE_KEY = 'unified-cbt-visual-style';
  const DYNAMIC_UI_KEY = 'unified-cbt-dynamic-ui';
  let angleMode = 'deg';
  let shift = false;
  let alpha = false;
  let answer = 0;
  let memory = 0;
  let history = [];
  let fractionMode = false;

  function applyVisualStyle(style = localStorage.getItem(VISUAL_STYLE_KEY)) {
    const normalized = style === 'simpsons' || style === 'sunjae' ? style : 'default';
    document.documentElement.dataset.visualStyle = normalized;
    if (visualStyleButton) {
      visualStyleButton.textContent = normalized === 'default' ? '🍩' : normalized === 'simpsons' ? '☂' : 'CBT';
      visualStyleButton.title = normalized === 'default'
        ? '심슨 계산기로 바꾸기'
        : normalized === 'simpsons'
          ? '선재 업고 튀어 계산기로 바꾸기'
          : '기본 CBT 계산기로 바꾸기';
    }
  }

  function applyDynamicUiPreference(value = localStorage.getItem(DYNAMIC_UI_KEY)) {
    document.documentElement.dataset.dynamicUi = value === 'false' ? 'off' : 'on';
  }

  function switchVisualStyle() {
    const current = document.documentElement.dataset.visualStyle;
    const next = current === 'default' ? 'simpsons' : current === 'simpsons' ? 'sunjae' : 'default';
    localStorage.setItem(VISUAL_STYLE_KEY, next);
    if (document.documentElement.dataset.dynamicUi !== 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyVisualStyle(next);
      return;
    }
    document.documentElement.classList.add('calculator-style-leaving');
    window.setTimeout(() => {
      applyVisualStyle(next);
      document.documentElement.classList.remove('calculator-style-leaving');
      document.documentElement.classList.add('calculator-style-entering');
      window.setTimeout(() => document.documentElement.classList.remove('calculator-style-entering'), 360);
    }, 180);
  }

  function setModifier(type, enabled) {
    if (type === 'shift') {
      shift = enabled;
      shiftStatus.classList.toggle('on', shift);
      document.querySelector('[data-action="shift"]')?.classList.toggle('active', shift);
    } else {
      alpha = enabled;
      alphaStatus.classList.toggle('on', alpha);
      document.querySelector('[data-action="alpha"]')?.classList.toggle('active', alpha);
    }
  }

  function insert(value) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(value, start, end, 'end');
    input.focus();
  }

  function angleInput(value) {
    return angleMode === 'rad' ? value : window.math.unit(value, 'deg');
  }

  function angleOutput(value) {
    return angleMode === 'rad' ? value : window.math.unit(value, 'rad').toNumber('deg');
  }

  function scope() {
    const values = new Map();
    values.set('sin', (value) => window.math.sin(angleInput(value)));
    values.set('cos', (value) => window.math.cos(angleInput(value)));
    values.set('tan', (value) => window.math.tan(angleInput(value)));
    values.set('asin', (value) => angleOutput(window.math.asin(value)));
    values.set('acos', (value) => angleOutput(window.math.acos(value)));
    values.set('atan', (value) => angleOutput(window.math.atan(value)));
    values.set('log', (value) => window.math.log10(value));
    values.set('ln', (value) => window.math.log(value));
    values.set('neg', (value) => window.math.unaryMinus(value));
    values.set('ans', answer);
    values.set('M', memory);
    return values;
  }

  function format(value) {
    if (fractionMode && typeof value === 'number' && Number.isFinite(value)) {
      try { return window.math.fraction(value).toFraction(true); } catch (error) {}
    }
    return window.math.format(value, { precision: 14 });
  }

  function evaluate() {
    const expression = input.value.trim().replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
    if (!expression) return;
    try {
      const value = window.math.evaluate(expression, scope());
      answer = value;
      const rendered = format(value);
      resultNode.textContent = rendered;
      resultNode.classList.remove('error');
      history.unshift({ expression: input.value, result: rendered });
      history = history.slice(0, 20);
      renderHistory();
    } catch (error) {
      resultNode.textContent = 'Math ERROR';
      resultNode.classList.add('error');
    }
  }

  function clearAll() {
    input.value = '';
    resultNode.textContent = '0';
    resultNode.classList.remove('error');
    setModifier('shift', false);
    setModifier('alpha', false);
    input.focus();
  }

  function backspace() {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) input.setRangeText('', start, end, 'end');
    else if (start > 0) input.setRangeText('', start - 1, start, 'end');
    input.focus();
  }

  function moveCaret(direction) {
    const current = input.selectionStart ?? input.value.length;
    const next = direction === 'left' || direction === 'up' ? Math.max(0, current - 1) : Math.min(input.value.length, current + 1);
    input.setSelectionRange(next, next);
    input.focus();
  }

  function renderHistory() {
    historyList.innerHTML = history.length
      ? history.map((item, index) => `<li data-history="${index}">${escapeHtml(item.expression)} = <b>${escapeHtml(item.result)}</b></li>`).join('')
      : '<li>아직 계산 기록이 없습니다.</li>';
  }

  function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const historyItem = event.target.closest('[data-history]');
    if (historyItem) {
      input.value = history[Number(historyItem.dataset.history)]?.expression || '';
      historyPanel.hidden = true;
      input.focus();
      return;
    }
    if (!button) return;
    const action = button.dataset.action;
    if (button.dataset.value != null) {
      const value = shift && button.dataset.shift != null ? button.dataset.shift : button.dataset.value;
      insert(value);
      setModifier('shift', false);
      setModifier('alpha', false);
      return;
    }
    if (action === 'shift') setModifier('shift', !shift);
    else if (action === 'alpha') setModifier('alpha', !alpha);
    else if (action === 'angle') {
      angleMode = angleMode === 'deg' ? 'rad' : 'deg';
      angleStatus.textContent = angleMode.toUpperCase();
      input.focus();
    } else if (action === 'clear') clearAll();
    else if (action === 'backspace') backspace();
    else if (action === 'equals') evaluate();
    else if (action === 'caret-left' || action === 'caret-up' || action === 'caret-right' || action === 'caret-down') moveCaret(action.replace('caret-', ''));
    else if (action === 'memory-recall') {
      if (shift) {
        const numeric = Number(answer);
        if (Number.isFinite(numeric)) memory = numeric;
        memoryStatus.classList.toggle('on', memory !== 0);
        setModifier('shift', false);
      } else insert('M');
    }
    else if (action === 'memory-add') {
      const numeric = Number(answer);
      if (Number.isFinite(numeric)) memory += shift ? -numeric : numeric;
      memoryStatus.classList.toggle('on', memory !== 0);
      setModifier('shift', false);
    } else if (action === 'memory-clear') {
      memory = 0;
      memoryStatus.classList.remove('on');
    } else if (action === 'fraction-toggle') {
      fractionMode = !fractionMode;
      if (answer !== 0) resultNode.textContent = format(answer);
    } else if (action === 'history') {
      historyPanel.hidden = !historyPanel.hidden;
      renderHistory();
    } else if (action === 'history-clear') {
      history = [];
      renderHistory();
    } else if (action === 'visual-style') {
      switchVisualStyle();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      evaluate();
    } else if (event.key === 'Escape') {
      clearAll();
    } else if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      input.value = history[0].expression;
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === VISUAL_STYLE_KEY) applyVisualStyle(event.newValue);
    if (event.key === DYNAMIC_UI_KEY) applyDynamicUiPreference(event.newValue);
  });
  applyDynamicUiPreference();
  applyVisualStyle();
  input.focus();
})();
