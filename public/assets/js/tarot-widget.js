(function () {
  'use strict';

  // FIXED MAPPING: position 1 / 2 / 3 always displays the same card and message.
  const readings = Object.freeze({
    1: {
      card: 'The Sun',
      area: 'LOVE & RELATIONSHIPS',
      headline: 'A Warmer Connection May Be Within Reach',
      subtitle: 'Card 1 · The Sun · A reflection for the coming weeks',
      message: 'The Sun is a symbol of warmth, honesty and renewed energy. Over the next few weeks, an open conversation or a thoughtful gesture may bring more lightness to a relationship. If something has felt distant, notice opportunities to reconnect — without overlooking your own needs. The message is to choose clarity over assumptions and mutual care over chasing certainty.',
      step: 'Ask someone important to you one sincere question, then listen without rushing to respond.',
      affirmation: 'I make space for honest connection, warmth and respect.'
    },
    2: {
      card: 'The Star',
      area: 'YOUR NEAR FUTURE · NEXT 30 DAYS',
      headline: 'A Gentle Shift Toward Hope and Clarity',
      subtitle: 'Card 2 · The Star · Your next-30-days reflection',
      message: 'The Star points to renewal after uncertainty. During the next 30 days, you may begin to see an old concern from a calmer perspective. A reassuring conversation, fresh idea or quiet moment could help you feel more hopeful about what comes next. Progress may be gradual rather than dramatic. Give yourself room to recharge, and pay attention to the possibilities that become visible when you stop forcing an answer.',
      step: 'Write down one hope for the month ahead and take one small, practical step toward it this week.',
      affirmation: 'I can move forward with patience, clarity and renewed confidence.'
    },
    3: {
      card: 'The Chariot',
      area: 'CAREER & PERSONAL GOALS',
      headline: 'Your Next Breakthrough Begins with Focus',
      subtitle: 'Card 3 · The Chariot · A reflection for the coming month',
      message: 'The Chariot represents self-direction, discipline and steady movement. Over the coming month, a work, study or personal goal may benefit from one clear decision. You could feel pulled between competing priorities, but your strength lies in choosing where to invest your energy. Rather than rushing toward a result, build momentum through consistent action and measured choices.',
      step: 'Choose one goal, identify the most important next action and give it a dedicated time this week.',
      affirmation: 'I move toward my goals with purpose, balance and persistence.'
    }
  });

  function initTarotWidget(root) {
    if (!root || root._ivaTarotInitialized) return;
    root._ivaTarotInitialized = true;

    const cards = Array.from(root.querySelectorAll('[data-card]'));
    const panel = root.querySelector('#iva-tarot-reading');
    const hint = root.querySelector('#iva-tarot-hint');
    const instruction = root.querySelector('#iva-tarot-instruction');

    function selectCard(key) {
      const r = readings[key];
      if (!r) return;

      cards.forEach(function (el) {
        const chosen = Number(el.dataset.card) === key;
        el.classList.toggle('is-revealed', chosen);
        el.classList.toggle('is-muted', !chosen);
        el.setAttribute('aria-pressed', String(chosen));
      });

      const content = {
        area: r.area,
        headline: r.headline,
        subtitle: r.subtitle,
        message: r.message,
        step: r.step,
        affirmation: '“' + r.affirmation + '”'
      };

      Object.entries(content).forEach(function ([field, value]) {
        const target = root.querySelector('#iva-tarot-' + field);
        if (target) target.textContent = value;
      });

      if (panel) panel.hidden = false;
      if (hint) hint.textContent = 'Your card is revealed. You can explore another card anytime.';
      if (instruction) instruction.textContent = 'You chose Card ' + key + ': ' + r.card + '.';

      // Dispatch DOM CustomEvent for analytics or custom tracking
      try {
        root.dispatchEvent(new CustomEvent('iva:tarot-card-selected', {
          bubbles: true,
          detail: { position: key, card: r.card, area: r.area }
        }));
      } catch (_) {}

      // Smooth scroll reading into view if partly offscreen
      if (panel && panel.scrollIntoView) {
        setTimeout(function () {
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 320);
      }
    }

    cards.forEach(function (el) {
      el.addEventListener('click', function () {
        selectCard(Number(el.dataset.card));
      });
    });

    const resetBtn = root.querySelector('#iva-tarot-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        cards.forEach(function (el) {
          el.classList.remove('is-revealed', 'is-muted');
          el.setAttribute('aria-pressed', 'false');
        });
        if (panel) panel.hidden = true;
        if (hint) hint.textContent = 'There is no right or wrong choice. Follow your curiosity. ✨';
        if (instruction) instruction.textContent = 'Choose one card below to reveal your message.';
        if (cards[0]) cards[0].focus();
      });
    }
  }

  function run() {
    const widgets = document.querySelectorAll('.iva-tarot');
    widgets.forEach(initTarotWidget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
