/*
 * NBB Health Dashboard — Dynamic date / gestational-age engine
 *
 * Single source of truth: LMP (Last Menstrual Period).
 * Everything else (gestational age, trimester, EDD, days remaining, progress bar,
 * timeline "passed" markers, current-milestone highlight, and the "Last updated"
 * footer) is computed on page load from LMP + today's date.
 *
 * To roll this forward to a future pregnancy, change LMP_ISO below — nothing else.
 */
(function () {
  'use strict';

  // ——— CONFIG ——————————————————————————————————————————————
  const LMP_ISO = '2025-10-20';   // Last Menstrual Period
  const TERM_DAYS = 280;          // 40 weeks

  // ——— HELPERS ——————————————————————————————————————————————
  const MS_DAY = 86400000;

  function atMidnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateShort(d) {
    // e.g. "20 Apr 2026"
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateLong(d) {
    // e.g. "20 April 2026"
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function ordinal(n) {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
  }

  function ordinalWord(n) {
    return n === 1 ? 'First' : n === 2 ? 'Second' : n === 3 ? 'Third' : ('#' + n);
  }

  // Parse a timeline-date string like "20 Oct 2025" or "04 Dec 2025 (6w3d)"
  // or "21 December 2025 — 8 weeks 1 day". Returns a Date or null.
  function parseTimelineDate(text) {
    const t = (text || '').trim();
    // Try "DD Mon YYYY" first, then "DD Month YYYY"
    const re = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/;
    const m = t.match(re);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const monthStr = m[2].slice(0, 3).toLowerCase();
    const year = parseInt(m[3], 10);
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const mo = months[monthStr];
    if (mo === undefined) return null;
    return new Date(year, mo, day);
  }

  // Parse a milestone-week label like "Weeks 26-28" → {start:26, end:28}
  // "Weeks 37-40" → {start:37, end:40}
  // "Postpartum" → null
  function parseMilestoneWeeks(text) {
    const t = (text || '').trim();
    const m = t.match(/Weeks?\s+(\d{1,2})\s*[–\-]\s*(\d{1,2})/i);
    if (!m) return null;
    return { start: parseInt(m[1], 10), end: parseInt(m[2], 10) };
  }

  // ——— CORE CALCULATIONS ———————————————————————————————————————
  const lmp = atMidnight(parseISO(LMP_ISO));
  const today = atMidnight(new Date());
  const edd = new Date(lmp.getTime() + TERM_DAYS * MS_DAY);

  const daysSinceLMP = Math.max(0, Math.floor((today - lmp) / MS_DAY));
  const gestWeeks = Math.floor(daysSinceLMP / 7);
  const gestDays = daysSinceLMP % 7;
  const totalPregnancyWeeks = 40;
  const displayWeeks = Math.min(gestWeeks, 42); // cap at 42w for display safety

  let trimester;
  if (gestWeeks < 13) trimester = 1;
  else if (gestWeeks < 28) trimester = 2;
  else trimester = 3;

  const daysUntilEDD = Math.max(0, Math.floor((edd - today) / MS_DAY));
  const weeksUntilEDD = Math.floor(daysUntilEDD / 7);
  const progressPct = Math.max(0, Math.min(100, (gestWeeks / totalPregnancyWeeks) * 100));

  // Human-friendly strings
  const gaShort   = displayWeeks + ' weeks';                                 // "26 weeks"
  const gaWD      = displayWeeks + 'w ' + gestDays + 'd';                    // "26w 0d"
  const gaApprox  = '~' + displayWeeks + ' weeks';                           // "~26 weeks"
  const trimName  = ordinalWord(trimester) + ' Trimester';                   // "Second Trimester"
  const trimShort = ordinal(trimester) + ' Trimester';                       // "2nd Trimester"
  const progressText  = displayWeeks + '/' + totalPregnancyWeeks;            // "26/40"
  const weeksRemaining = '~' + weeksUntilEDD + ' weeks remaining';
  const todayShort = formatDateShort(today);
  const todayLong  = formatDateLong(today);
  const eddShort   = formatDateShort(edd);

  // Nutrition-page heading: "Daily Nutrition Targets (2nd Trimester, 26 Weeks)"
  const nutritionHeading = 'Daily Nutrition Targets (' + trimShort + ', ' + displayWeeks + ' Weeks)';

  // Badge: "🤰 26 weeks pregnant"
  const badgeWeeks = '🤰 ' + displayWeeks + ' weeks pregnant';

  // ——— APPLIERS ——————————————————————————————————————————————
  const MAP = {
    'ga-approx':        gaApprox,
    'ga-short':         gaShort,
    'ga-wd':            gaWD,
    'trimester-name':   trimName,
    'trimester-short':  trimShort,
    'days-remaining':   String(daysUntilEDD),
    'weeks-remaining':  weeksRemaining,
    'progress-text':    progressText,
    'badge-weeks-pregnant': badgeWeeks,
    'nutrition-heading': nutritionHeading,
    'today-short':      todayShort,
    'today-long':       todayLong,
    'edd-short':        eddShort
  };

  function applyTextTokens(root) {
    root.querySelectorAll('[data-dyn]').forEach(function (el) {
      const key = el.getAttribute('data-dyn');
      if (Object.prototype.hasOwnProperty.call(MAP, key)) {
        el.textContent = MAP[key];
      }
    });
  }

  function applyProgressFill(root) {
    const bar = root.querySelector('[data-dyn-progress]');
    if (!bar) return;
    bar.style.width = progressPct.toFixed(1) + '%';
    bar.textContent = progressText;
  }

  function applyTrimesterChecks(root) {
    // For each element marked data-dyn-trimester="1|2|3", append " ✓" if that
    // trimester is complete. Preserves inner HTML (e.g. <strong>, <br>).
    const completed = { 1: gestWeeks >= 13, 2: gestWeeks >= 28, 3: gestWeeks >= 40 };
    root.querySelectorAll('[data-dyn-trimester]').forEach(function (el) {
      const n = parseInt(el.getAttribute('data-dyn-trimester'), 10);
      let checkEl = el.querySelector('.dyn-check');
      if (!checkEl) {
        checkEl = document.createElement('span');
        checkEl.className = 'dyn-check';
        el.appendChild(checkEl);
      }
      checkEl.textContent = completed[n] ? ' ✓' : '';
      el.classList.toggle('current-trimester', n === trimester);
    });
  }

  function applyTimelinePassed(root) {
    // Scan every .timeline-item, read its .timeline-date text, and set the
    // .timeline-marker's .passed class based on whether the date is <= today.
    root.querySelectorAll('.timeline-item').forEach(function (item) {
      const dateEl = item.querySelector('.timeline-date');
      const marker = item.querySelector('.timeline-marker');
      if (!dateEl || !marker) return;
      const d = parseTimelineDate(dateEl.textContent);
      if (!d) return;
      const isPassed = atMidnight(d) <= today;
      marker.classList.toggle('passed', isPassed);
    });
  }

  function applyCurrentMilestone(root) {
    root.querySelectorAll('.milestone-card').forEach(function (card) {
      const labelEl = card.querySelector('.milestone-week');
      if (!labelEl) return;
      const range = parseMilestoneWeeks(labelEl.textContent);
      if (!range) return;
      // Inclusive on start, exclusive on end so boundary weeks (e.g. 28) belong
      // to the forward-looking window only.
      if (gestWeeks >= range.start && gestWeeks < range.end) {
        card.classList.add('current');
      } else {
        card.classList.remove('current');
      }
    });
  }

  function applyFooter(root) {
    // Any footer paragraph tagged data-dyn-last-updated gets its "Last updated: ..."
    // segment rewritten to today. Preserves surrounding text.
    root.querySelectorAll('[data-dyn-last-updated]').forEach(function (el) {
      const fmt = el.getAttribute('data-dyn-last-updated') === 'long' ? todayLong : todayShort;
      // Replace any "Last updated: <something>" up to next pipe/<br>/end
      el.innerHTML = el.innerHTML.replace(
        /Last updated:\s*[^|<]+/i,
        'Last updated: ' + fmt + ' '
      );
    });
  }

  // Inject default styling for .milestone-card.current if the host page
  // doesn't already define it.
  function injectCurrentMilestoneStyle() {
    if (document.getElementById('dyn-milestone-style')) return;
    const css = '.milestone-card.current{border-left-color:#EA4335!important;background:linear-gradient(135deg,#FFF7F5 0%,#FFFFFF 100%);box-shadow:0 4px 16px rgba(234,67,53,0.18);position:relative}' +
                '.milestone-card.current::before{content:"YOU ARE HERE";position:absolute;top:-10px;right:16px;background:#EA4335;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:3px 10px;border-radius:10px}';
    const style = document.createElement('style');
    style.id = 'dyn-milestone-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ——— RUN ———————————————————————————————————————————————
  function run() {
    const root = document;
    injectCurrentMilestoneStyle();
    applyTextTokens(root);
    applyProgressFill(root);
    applyTrimesterChecks(root);
    applyTimelinePassed(root);
    applyCurrentMilestone(root);
    applyFooter(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  // Expose for debugging in console
  window.NBB_DYN = {
    lmp: lmp, today: today, edd: edd,
    gestWeeks: gestWeeks, gestDays: gestDays,
    trimester: trimester, daysUntilEDD: daysUntilEDD,
    progressPct: progressPct, map: MAP
  };
})();
