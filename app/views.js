// make.fun frontend — the four views on live public API data.
// main.js hands each view its fetched data; this file only renders it.
// All numbers come from make.fun's API; nothing here is hard-coded.
import { esc, money, date, timeLeft, potOf, feeOf, isOpen, fetchCompetitions } from './api.js';

const URGENT_MS = 24 * 3600 * 1000;
const SOON_MS = 48 * 3600 * 1000;

/** A percent from a micro value: 951972 -> '95.20%'. */
function pct(v) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return `${(n / 10000).toFixed(2)}%`;
}

/** Bytes as '914.5 KB' / '2.1 MB'. */
function kb(v) {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}

/** A short wallet address: 3kSD…dEEm. */
function shortAddr(a) {
  const s = String(a || '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/** Avatar: the letter sits underneath the image; a broken image just reveals it. */
function avatar(handle, image) {
  const letter = esc(String(handle || '?').slice(0, 1).toUpperCase());
  const img = image ? `<img src="${esc(image)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="avatar-wrap" aria-hidden="true">${letter}${img}</span>`;
}

/** A deadline label, red when under 24h. */
function leftLabel(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  const label = timeLeft(iso);
  return ms > 0 && ms < URGENT_MS ? `<span class="urgent">${esc(label)}</span>` : esc(label);
}

/** Format one leaderboard cell by its column key. */
function cellValue(col, entry) {
  const raw = entry.values?.[col.key] ?? entry.display?.[col.key];
  if (raw === undefined || raw === null) return '—';
  if (col.key === 'bytes') return kb(raw);
  if (col.key.startsWith('judge')) return pct(raw);
  if (col.key === 'valid') return String(raw);
  const n = Number(raw);
  return isFinite(n) ? n.toLocaleString('en-US') : esc(String(raw));
}

/** Format a profile solution's score by its column. */
function scoreValue(score) {
  if (!score) return '—';
  const key = score.column?.key || '';
  const raw = score.display ?? score.value;
  if (raw === undefined || raw === null) return '—';
  if (key.includes('judge') || key.includes('win_rate')) return pct(raw);
  if (key.includes('pnl') || key.includes('usdc') || key.includes('usd')) {
    const n = Number(raw);
    return isFinite(n) ? money(n / 1000000) : esc(String(raw));
  }
  if (key === 'bytes') return kb(raw);
  const n = Number(raw);
  return isFinite(n) ? n.toLocaleString('en-US') : esc(String(raw));
}

// ---------------------------------------------------------------- board

/** The live board: hero stats, filter + sort, and a card per open bounty. */
export function renderBoard(app, data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalPot = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const closingSoon = items.filter((b) => {
    const ms = new Date(b.deadline).getTime() - Date.now();
    return ms > 0 && ms < SOON_MS;
  }).length;
  const categories = [...new Set(items.map((b) => b.category).filter(Boolean))].sort();
  app.innerHTML = `
    <div class="hero">
      <h1>Live bounties <span class="accent">on make.fun</span></h1>
      <p class="lede">Every open bounty, its live pot and its deadline — straight from make.fun's public API. Pick one, build the best entry, get paid.</p>
      <div class="stats">
        <div class="stat"><b class="green js-total-pot">${money(totalPot)}</b><span>total live pot</span></div>
        <div class="stat"><b class="js-open-count">${items.length}</b><span>open bounties</span></div>
        <div class="stat"><b class="${closingSoon ? 'red' : ''} js-soon-count">${closingSoon}</b><span>closing within 48h</span></div>
      </div>
      <div class="toolbar">
        <input type="search" id="q" placeholder="Search bounties…" aria-label="Search bounties">
        <select id="cat" aria-label="Filter by category">
          <option value="">All categories</option>
          ${categories.map((c) => `<option>${esc(c)}</option>`).join('')}
        </select>
        <select id="sort" aria-label="Sort bounties">
          <option value="pot">Biggest pot</option>
          <option value="deadline">Closing soonest</option>
          <option value="entries">Most entries</option>
        </select>
      </div>
    </div>
    <div class="grid" id="grid"></div>
    <p class="muted small js-count"></p>`;
  const grid = app.querySelector('#grid');
  const countEl = app.querySelector('.js-count');
  const q = app.querySelector('#q');
  const cat = app.querySelector('#cat');
  const sort = app.querySelector('#sort');

  function card(b) {
    const fee = feeOf(b);
    const entries = b.submissionCount ?? b.submissions?.length ?? 0;
    return `<article class="card" data-slug="${esc(b.slug)}">
      <h2><a href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a></h2>
      <p class="meta">${esc(b.category || '')}${b.sponsor?.name ? ` · by ${esc(b.sponsor.name)}` : ''}</p>
      ${b.summary ? `<p class="desc">${esc(b.summary)}</p>` : ''}
      <div class="pot-row">
        <span class="pot js-pot">${potOf(b)}</span>
        <span class="fee js-fee ${fee ? '' : 'free'}">${fee ? `fee ${fee}` : 'no entry fee'}</span>
      </div>
      <div class="card-foot">
        <span><b class="js-entries">${Number(entries).toLocaleString('en-US')}</b> entries</span>
        <span data-tl="${esc(b.deadline)}">${leftLabel(b.deadline)}</span>
      </div>
      <div class="chips">${(b.skills || []).slice(0, 4).map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
      <div class="card-links">
        <a href="#/bounty/${esc(b.slug)}">Bounty →</a>
        <a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a>
      </div>
    </article>`;
  }

  function draw() {
    const needle = q.value.trim().toLowerCase();
    let list = items.filter((b) => {
      if (cat.value && b.category !== cat.value) return false;
      if (!needle) return true;
      return `${b.title} ${b.slug} ${b.category || ''} ${(b.skills || []).join(' ')}`.toLowerCase().includes(needle);
    });
    if (sort.value === 'deadline') list.sort((a, b2) => new Date(a.deadline) - new Date(b2.deadline));
    else if (sort.value === 'entries') list.sort((a, b2) => (b2.submissionCount ?? 0) - (a.submissionCount ?? 0));
    else list.sort((a, b2) => Number(b2.potUsd ?? b2.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
    grid.innerHTML = list.map(card).join('') || '<p class="muted">No bounties match that filter.</p>';
    countEl.textContent = `Showing ${list.length} of ${items.length} open bounties · live from make.fun`;
  }
  q.addEventListener('input', draw);
  cat.addEventListener('change', draw);
  sort.addEventListener('change', draw);
  draw();
}

/** Re-fetch the board and patch each card's pot, fee and entries in place. */
export async function enrichBoard() {
  try {
    const data = await fetchCompetitions();
    const items = Array.isArray(data?.items) ? data.items : [];
    const totalPot = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
    const totalEl = document.querySelector('.js-total-pot');
    if (totalEl) totalEl.textContent = money(totalPot);
    const openEl = document.querySelector('.js-open-count');
    if (openEl) openEl.textContent = String(items.length);
    for (const b of items) {
      const cardEl = document.querySelector(`.card[data-slug="${CSS.escape(b.slug)}"]`);
      if (!cardEl) continue;
      const potEl = cardEl.querySelector('.js-pot');
      if (potEl) potEl.textContent = potOf(b);
      const feeEl = cardEl.querySelector('.js-fee');
      const fee = feeOf(b);
      if (feeEl) {
        feeEl.textContent = fee ? `fee ${fee}` : 'no entry fee';
        feeEl.classList.toggle('free', !fee);
      }
      const entriesEl = cardEl.querySelector('.js-entries');
      if (entriesEl) entriesEl.textContent = Number(b.submissionCount ?? 0).toLocaleString('en-US');
    }
  } catch (e) {
    /* The first render already shows live data; a failed refresh leaves it as is. */
  }
}

// ---------------------------------------------------------------- bounty

/** One bounty: hero, stat boxes, skills, description, live rewards, latest entries. */
export function renderBounty(app, b) {
  const rewards = Array.isArray(b.rewardsNow) ? b.rewardsNow : [];
  const entries = Array.isArray(b.submissions) ? b.submissions.slice(0, 10) : [];
  const base = Number(b.rewardAmount ?? 0);
  const fees = Number(b.entryFeesUsd ?? 0);
  const rankKey = b.leaderboard?.rankKey || 'judge';
  const scoreOf = (s) => {
    if (s.score === undefined || s.score === null) return '—';
    if (String(rankKey).includes('judge')) return pct(s.score);
    const n = Number(s.score);
    return isFinite(n) ? n.toLocaleString('en-US') : esc(String(s.score));
  };
  app.innerHTML = `
    <div class="hero">
      <p class="meta muted small"><a href="#/">Board</a> · ${esc(b.category || '')}${b.sponsor?.name ? ` · by ${esc(b.sponsor.name)}` : ''}</p>
      <h1>${esc(b.title)}</h1>
      <p class="lede">${esc(b.summary || b.description || '')}</p>
      <div class="stats">
        <div class="stat"><b class="green">${potOf(b)}</b><span>live pot</span></div>
        <div class="stat"><b>${money(base)}</b><span>base reward</span></div>
        <div class="stat"><b class="amber">${money(fees)}</b><span>entry fees in pot</span></div>
        <div class="stat"><b>${Number(b.entryFeePayers ?? 0).toLocaleString('en-US')}</b><span>fee payers</span></div>
        <div class="stat"><b>${Number(b.submissionCount ?? 0).toLocaleString('en-US')}</b><span>entries</span></div>
        <div class="stat"><b class="${new Date(b.deadline).getTime() - Date.now() < URGENT_MS ? 'red' : ''}">${esc(date(b.deadline))}</b><span data-tl="${esc(b.deadline)}">${leftLabel(b.deadline)}</span></div>
      </div>
      <div class="chips">${(b.skills || []).map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
    </div>
    <section>
      <h2>About this bounty</h2>
      <p class="muted">${esc(b.description || '')}</p>
      <p><a href="#/bounty/${esc(b.slug)}/leaderboard">See the leaderboard →</a></p>
    </section>
    ${rewards.length ? `<section>
      <h2>Rewards right now</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
        <tbody>${rewards.map((r) => `<tr><td>#${esc(r.place)}</td><td class="num">${money(r.baseUsd)}</td><td class="num">${money(r.feeShareUsd)}</td><td class="num"><b>${money(r.amountUsd)}</b></td></tr>`).join('')}</tbody>
      </table></div>
    </section>` : ''}
    ${entries.length ? `<section>
      <h2>Latest entries</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Entry</th><th>Hunter</th><th>Status</th><th class="num">Score</th></tr></thead>
        <tbody>${entries.map((s) => `<tr>
          <td class="entry-cell">${esc(s.title || s.id || '')}</td>
          <td>${avatar(s.hunter, null)}${esc(s.hunter || '')}</td>
          <td>${esc(s.status || '')}</td>
          <td class="num">${scoreOf(s)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>` : ''}`;
}

// ---------------------------------------------------------------- leaderboard

/** A bounty's leaderboard: podium for the top 3, then the ranked table. */
export function renderLeaderboard(app, b, lb) {
  const columns = (lb.columns || []).filter((c) => !c.hidden);
  const entries = (lb.entries || []).filter((e) => e.ranked !== false).slice(0, 100);
  const top = entries.slice(0, 3);
  const rankKey = lb.rank_key || 'judge';
  app.innerHTML = `
    <div class="hero">
      <p class="meta muted small"><a href="#/">Board</a> · <a href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a></p>
      <h1>${esc(b.title)} <span class="accent">leaderboard</span></h1>
      <p class="lede">${entries.length} ranked entries · ranked by ${esc(rankKey)} · live from make.fun</p>
    </div>
    ${top.length ? `<div class="podium">${top.map((e, i) => `
      <div class="place ${i === 0 ? 'first' : i === 1 ? 'second' : 'third'}">
        <span class="rank-badge rank-${i + 1}">${e.rank}</span>
        <div class="handle">${avatar(e.handle, e.image)}<a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a></div>
        <div class="score">${cellValue({ key: rankKey }, e)}</div>
        <div class="sub">${esc((e.title || '').slice(0, 80))}</div>
      </div>`).join('')}</div>` : ''}
    <section class="lb">
      <div class="table-wrap"><table>
        <thead><tr><th class="num">#</th><th>Entry</th>${columns.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead>
        <tbody>${entries.map((e) => `<tr>
          <td class="num"><b>${e.rank}</b></td>
          <td class="entry-cell">${avatar(e.handle, e.image)}<a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a><br><span class="muted small">${esc((e.title || '').slice(0, 90))}</span></td>
          ${columns.map((c) => `<td class="num">${cellValue(c, e)}</td>`).join('')}
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">Showing ${entries.length} of ${(lb.entries || []).length} entries · ${(lb.entries || []).length > 100 ? 'top 100 only' : 'all entries'}</p>
    </section>`;
}

// ---------------------------------------------------------------- profile

/** A public profile: record, wallet, and every entered solution. */
export function renderProfile(app, p) {
  const r = p.record || {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const wallet = p.wallet?.address || '';
  app.innerHTML = `
    <div class="hero">
      <h1>${avatar(p.handle, p.image || p.avatar)}${esc(p.display_name || p.handle)}</h1>
      <p class="lede">${esc(p.bio || '')}${p.joined_at ? ` · on make.fun since ${esc(date(p.joined_at))}` : ''}</p>
      <div class="stats">
        <div class="stat"><b>${Number(r.competitions_entered ?? 0)}</b><span>entered</span></div>
        <div class="stat"><b>${Number(r.competitions_placed ?? 0)}</b><span>placed</span></div>
        <div class="stat"><b>${Number(r.competitions_won ?? 0)}</b><span>won</span></div>
        <div class="stat"><b>${r.best_placement ? `#${Number(r.best_placement).toLocaleString('en-US')}` : '—'}</b><span>best placement</span></div>
        <div class="stat"><b class="green">${money(r.prize_usd ?? 0)}</b><span>prize money</span></div>
      </div>
      ${wallet ? `<p class="muted">Wallet ${p.wallet?.explorer_url ? `<a href="${esc(p.wallet.explorer_url)}">${esc(shortAddr(wallet))}</a>` : esc(shortAddr(wallet))}</p>` : ''}
    </div>
    <section>
      <h2>Entries (${solutions.length})</h2>
      ${solutions.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Competition</th><th>Entry</th><th class="num">Score</th><th>Place</th><th class="num">Prize</th><th>Entered</th></tr></thead>
        <tbody>${solutions.map((s) => `<tr>
          <td><a href="#/bounty/${esc(s.competition?.slug || '')}">${esc(s.competition?.title || s.competition?.slug || '')}</a></td>
          <td class="entry-cell">${esc(s.title || '')}</td>
          <td class="num">${scoreValue(s.score)}${s.score?.column?.title ? `<br><span class="muted small">${esc(s.score.column.title)}</span>` : ''}</td>
          <td>${s.placement ? `#${esc(s.placement)}` : '—'}</td>
          <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
          <td class="num">${s.entered_at ? esc(date(s.entered_at)) : '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No entries yet.</p>'}
    </section>`;
}
