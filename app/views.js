// make.fun frontend — the four views. All data comes from make.fun's public
// API through api.js (read-only GET, no sign-in). Every string from the API is
// escaped before it reaches the page. Views are called by main.js:
//   renderBoard(app, board) · enrichBoard(board)
//   renderBounty(app, bounty) · renderLeaderboard(app, bounty, leaderboard)
//   renderProfile(app, profile)
import { date, esc, feeOf, fetchCompetitions, isOpen, money, potOf, timeLeft } from './api.js';

/** Under 48h left counts as urgent (red) — the "closing soon" window. */
const URGENT_MS = 48 * 3600 * 1000;
const isUrgent = (iso) => new Date(iso).getTime() - Date.now() < URGENT_MS;

/** A micro-unit score (956066) as "95.61%". */
export function pct(micro) { const n = Number(micro); return Number.isFinite(n) ? `${(n / 10000).toFixed(2)}%` : '—'; }

/** Bytes as "914.5 KB". */
export function kb(bytes) { const n = Number(bytes); return Number.isFinite(n) ? `${(n / 1024).toFixed(1)} KB` : '—'; }

/** An entrant's avatar: their make.fun avatar image over a letter fallback.
    The letter sits underneath, so a broken image just reveals it. */
export function avatar(handle, image, small) {
  const letter = esc((handle || '?').slice(0, 1).toUpperCase());
  const img = image ? `<img class="avatar${small ? ' sm' : ''}" src="https://make.fun${esc(image)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="avatar-wrap${small ? ' sm' : ''}"><span class="avatar-letter">${letter}</span>${img}</span>`;
}

/** One board card. */
export function card(b) {
  const fee = feeOf(b);
  const skills = [b.category, ...(b.skills || []).slice(0, 3)].filter(Boolean).join(' · ');
  return `<article class="card" data-slug="${esc(b.slug)}">
    <h3><a href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a></h3>
    <p class="pot-line"><strong class="pot" data-pot="${esc(b.slug)}">${esc(potOf(b))}</strong>
      <span class="fee" data-fee="${esc(b.slug)}">${fee ? `${esc(fee)} entry fee` : 'Free entry'}</span></p>
    <p class="meta"><span class="tl${isUrgent(b.deadline) ? ' urgent' : ''}" data-tl="${esc(b.deadline)}">${esc(timeLeft(b.deadline))}</span>
      · <span data-entries="${esc(b.slug)}">${Number(b.submissionCount || 0).toLocaleString('en-US')} entries</span>
      <span class="pill open">Open</span></p>
    <p class="skills">${esc(skills)}</p>
    <p class="links"><a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a><a href="#/bounty/${esc(b.slug)}">Details →</a></p>
  </article>`;
}

/** The board: hero stats, filter + sort, and the card grid. */
export function renderBoard(app, data) {
  const items = (data.items || []).filter(isOpen);
  const totalPot = items.reduce((s, b) => s + (Number(b.potUsd ?? b.rewardAmount) || 0), 0);
  const closing = items.filter((b) => isUrgent(b.deadline)).length;
  app.innerHTML = `<h1>Live bounty board</h1>
  <p class="lede">Every open bounty on make.fun, with its live pot, entry fee and time left — read straight from the public API, no sign-in.</p>
  <section class="hero">
    <div class="stat"><span class="stat-label">Total live pot</span><strong class="stat-big pot" id="hero-pot">${money(totalPot)}</strong><span class="stat-sub">across all open bounties</span></div>
    <div class="stat"><span class="stat-label">Open bounties</span><strong class="stat-big" id="hero-open">${items.length}</strong><span class="stat-sub">accepting entries now</span></div>
    <div class="stat"><span class="stat-label">Closing soon</span><strong class="stat-big amber" id="hero-closing">${closing}</strong><span class="stat-sub">under 48 hours left</span></div>
  </section>
  <div class="controls">
    <input id="filter" type="search" placeholder="Filter bounties…" aria-label="Filter bounties">
    <select id="sort" aria-label="Sort bounties">
      <option value="soonest">Soonest first</option>
      <option value="pot">Biggest pot</option>
      <option value="entries">Most entries</option>
    </select>
  </div>
  <h2 id="grid-title"></h2>
  <div class="grid" id="grid"></div>`;
  const grid = app.querySelector('#grid');
  const title = app.querySelector('#grid-title');
  const paint = () => {
    const q = (app.querySelector('#filter').value || '').toLowerCase();
    const mode = app.querySelector('#sort').value;
    let list = items.filter((b) => !q || `${b.title} ${b.category} ${(b.skills || []).join(' ')}`.toLowerCase().includes(q));
    if (mode === 'pot') list = [...list].sort((a, c) => (Number(c.potUsd ?? c.rewardAmount) || 0) - (Number(a.potUsd ?? a.rewardAmount) || 0));
    else if (mode === 'entries') list = [...list].sort((a, c) => (Number(c.submissionCount) || 0) - (Number(a.submissionCount) || 0));
    else list = [...list].sort((a, c) => new Date(a.deadline).getTime() - new Date(c.deadline).getTime());
    title.textContent = mode === 'soonest' ? `Closing soon · ${list.filter((b) => isUrgent(b.deadline)).length} of ${list.length}` : `All bounties · ${list.length}`;
    grid.innerHTML = list.length ? list.map(card).join('') : '<p class="muted">No bounties match that filter.</p>';
  };
  app.querySelector('#filter').addEventListener('input', paint);
  app.querySelector('#sort').addEventListener('change', paint);
  paint();
}

/** Refresh the board's pots, fees and entry counts in place (cached fetch). */
export async function enrichBoard() {
  try {
    const fresh = await fetchCompetitions();
    const bySlug = new Map((fresh.items || []).map((b) => [b.slug, b]));
    document.querySelectorAll('[data-pot]').forEach((el) => {
      const b = bySlug.get(el.getAttribute('data-pot'));
      if (b) el.textContent = potOf(b);
    });
    document.querySelectorAll('[data-fee]').forEach((el) => {
      const b = bySlug.get(el.getAttribute('data-fee'));
      if (b) { const f = feeOf(b); el.textContent = f ? `${f} entry fee` : 'Free entry'; }
    });
    document.querySelectorAll('[data-entries]').forEach((el) => {
      const b = bySlug.get(el.getAttribute('data-entries'));
      if (b) el.textContent = `${Number(b.submissionCount || 0).toLocaleString('en-US')} entries`;
    });
  } catch (e) { /* the board already shows the first fetch; a refresh failure is silent */ }
}

/** One bounty: hero, stat boxes, skills, description, live rewards, entries. */
export function renderBounty(app, b) {
  const fee = feeOf(b);
  const rewards = (b.rewardsNow || []).slice().sort((a, c) => a.place - c.place);
  const entries = (b.submissions || []).slice(0, 10);
  const opened = b.publishedAt ? date(b.publishedAt) : '—';
  app.innerHTML = `<p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a></p>
  <section class="hero-card">
    <p class="pills"><span class="pill open">Open — takes entries</span>${isUrgent(b.deadline) ? '<span class="pill amber">Closing soon</span>' : ''}</p>
    <h1>${esc(b.title)}</h1>
    <p class="sub muted">${esc(b.category || '')} · by ${esc(b.sponsor?.name || 'make.fun')}</p>
    <p class="big-pot">${esc(potOf(b))}</p>
    <p class="pot-sub">Live pot right now${fee ? ` · ${esc(fee)} entry fee` : ' · free entry'} · <span class="tl${isUrgent(b.deadline) ? ' urgent' : ''}" data-tl="${esc(b.deadline)}">${esc(timeLeft(b.deadline))}</span></p>
  </section>
  <section class="stat4">
    <div class="stat"><span class="stat-label">Reward</span><strong class="stat-big">${money(b.rewardAmount)}${Number(b.entryFeesUsd) > 0 ? ` + ${money(b.entryFeesUsd)} fees` : ''}</strong><span class="stat-sub">prize + entry fees paid in</span></div>
    <div class="stat"><span class="stat-label">Deadline</span><strong class="stat-big">${esc(date(b.deadline))}</strong><span class="stat-sub">entries close then</span></div>
    <div class="stat"><span class="stat-label">Entries</span><strong class="stat-big">${Number(b.submissionCount || 0).toLocaleString('en-US')}</strong><span class="stat-sub">submissions so far</span></div>
    <div class="stat"><span class="stat-label">Opened</span><strong class="stat-big">${esc(opened)}</strong><span class="stat-sub">published</span></div>
  </section>
  <p class="chips">${(b.skills || []).map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</p>
  <p class="desc">${esc((b.description || '').slice(0, 700))}</p>
  <h2>Rewards · live pot ${esc(potOf(b))}</h2>
  <table><thead><tr><th>Place</th><th class="num">Pays now</th><th class="num">Split</th></tr></thead><tbody>
  ${rewards.map((r) => `<tr${r.place === 1 ? ' class="first"' : ''}><td><span class="rank-badge${r.place === 1 ? ' gold' : ''}">${r.place}</span></td><td class="num"><strong>${money(r.amountUsd)}</strong></td><td class="num">${money(r.baseUsd)} prize + ${money(r.feeShareUsd)} fees</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No reward split published yet.</td></tr>'}
  </tbody></table>
  <h2>Latest entries · ${Number(b.submissionCount || 0).toLocaleString('en-US')}</h2>
  <ul class="entries-list">${entries.map((s) => `<li><span class="who"><a href="#/u/${esc(s.hunter)}">${esc(s.hunter)}</a></span><span class="what"><a href="#/bounty/${esc(b.slug)}/leaderboard">${esc(s.title || s.id)}</a></span><span class="score">${esc(s.status || '')}</span></li>`).join('') || '<li class="muted">No entries yet.</li>'}</ul>`;
}

/** A leaderboard: podium for the top 3, then the ranked table. */
export function renderLeaderboard(app, b, lb) {
  const entries = lb.entries || [];
  const cols = (lb.columns || []).filter((c) => !c.hidden);
  const key = lb.rank_key || 'judge';
  const cell = (e, c) => {
    const v = e.display?.[c.key];
    if (v == null) return '—';
    if (c.key === 'bytes') return kb(v);
    if (c.key.startsWith('judge')) return pct(v);
    return esc(String(v));
  };
  const podium = entries.slice(0, 3).map((e, i) => `<div class="podium-card rank${i + 1}">
    <p class="place-label">#${i + 1} place</p>${avatar(e.handle, e.image)}
    <p><a class="handle" href="#/u/${esc(e.handle)}">${esc(e.handle)}</a></p>
    <p class="score">${pct(e.display?.[key])}</p>
    <p class="entry-title">${esc(e.title || '')}</p>
  </div>`).join('');
  const rows = entries.slice(0, 100).map((e) => {
    const badge = e.rank === 1 ? 'gold' : e.rank === 2 ? 'silver' : e.rank === 3 ? 'bronze' : '';
    return `<tr${e.rank === 1 ? ' class="top1"' : ''}><td><span class="rank-badge ${badge}">${e.rank}</span></td>
    <td class="entry-cell">${avatar(e.handle, e.image, true)}<a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a><span class="sub">${esc(e.title || '')}</span></td>
    ${cols.map((c) => `<td class="num">${cell(e, c)}</td>`).join('')}</tr>`;
  }).join('');
  app.innerHTML = `<p class="crumbs"><a href="#/bounty/${esc(b.slug)}">← ${esc(b.title)}</a></p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${entries.length.toLocaleString('en-US')} entries · live pot <strong class="pot">${esc(potOf(b))}</strong> · ${Number(b.submissionCount || 0).toLocaleString('en-US')} submissions</p>
  <section class="podium">${podium}</section>
  <table class="lb"><thead><tr><th>#</th><th>Entry</th>${cols.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
  ${entries.length > 100 ? `<p class="small">Showing the top 100 of ${entries.length.toLocaleString('en-US')} entries.</p>` : ''}`;
}

/** A public profile: record, wallet, and the entrant's entries. */
export function renderProfile(app, p) {
  const r = p.record || {};
  const sols = p.solutions || [];
  const score = (s) => {
    if (!s.score) return '—';
    const v = s.score.value ?? s.score.display;
    const k = s.score.column?.key || '';
    if (v == null) return '—';
    if (k.startsWith('judge')) return pct(v);
    if (k === 'net_pnl') return money(Number(v) / 1e6);
    return esc(String(s.score.display ?? v));
  };
  app.innerHTML = `<h1>${esc(p.display_name || p.handle)}</h1>
  <p class="lede">@${esc(p.handle)}${p.joined_at ? ` · member since ${esc(date(p.joined_at))}` : ''}</p>
  ${p.wallet?.address ? `<p class="wallet-line">Wallet <a href="${esc(p.wallet.explorer_url || `https://solscan.io/account/${p.wallet.address}`)}">${esc(p.wallet.address)}</a></p>` : ''}
  <section class="record">
    <div class="stat"><span class="stat-label">Entered</span><strong class="stat-big">${Number(r.competitions_entered || 0)}</strong><span class="stat-sub">bounties</span></div>
    <div class="stat"><span class="stat-label">Placed</span><strong class="stat-big">${Number(r.competitions_placed || 0)}</strong><span class="stat-sub">top finishes</span></div>
    <div class="stat"><span class="stat-label">Won</span><strong class="stat-big">${Number(r.competitions_won || 0)}</strong><span class="stat-sub">bounties</span></div>
    <div class="stat"><span class="stat-label">Best placement</span><strong class="stat-big">${r.best_placement ? `#${Number(r.best_placement).toLocaleString('en-US')}` : '—'}</strong><span class="stat-sub">across all entries</span></div>
    <div class="stat"><span class="stat-label">Prize money</span><strong class="stat-big pot">${money(r.prize_usd)}</strong><span class="stat-sub">won so far</span></div>
  </section>
  <h2>Entries · ${sols.length}</h2>
  <table><thead><tr><th>Competition</th><th>Entry</th><th>Placed</th><th class="num">Prize</th><th class="num">Score</th><th>Entered</th></tr></thead><tbody>
  ${sols.map((s) => `<tr><td><a href="#/bounty/${esc(s.competition?.slug || '')}">${esc(s.competition?.title || s.competition?.slug || '')}</a></td>
    <td>${esc(s.title || s.submission_id || '')}</td>
    <td>${s.placement ? `#${s.placement}` : '—'}</td>
    <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
    <td class="num">${score(s)}</td>
    <td>${s.entered_at ? esc(date(s.entered_at)) : '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No entries yet.</td></tr>'}
  </tbody></table>`;
}
