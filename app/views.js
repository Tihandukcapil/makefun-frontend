// The four surfaces, lazy-loaded after first paint. Every API string is escaped
// before it reaches HTML; markdown is rendered by a tiny safe renderer, never
// raw innerHTML of API text. Lists update in place, never by rebuilding the page.
import {esc,money,date,timeLeft,potOf,feeOf,isOpen,fetchBounty,requestCount} from './api.js';

/** An avatar URL from the API: relative paths live on make.fun. */
export function avatarUrl(u){
  if(!u)return'';
  return u.startsWith('/')?'https://make.fun'+u:u;
}

/** <img> with crossorigin set before src (avatars send same-origin CORP). */
export function avatarImg(u,cls){
  return u?`<img crossorigin="anonymous" class="${cls||'avatar'}" src="${esc(avatarUrl(u))}" alt="" loading="lazy">`:'';
}

/** Short wallet form: 3kSD…5dEEm. */
export function shortWallet(a){
  return a&&a.length>10?a.slice(0,4)+'…'+a.slice(-5):(a||'');
}

/** Safe markdown: escape first, then headings, bold, lists, paragraphs. */
export function renderMarkdown(md){
  const lines=esc(md||'').split('\n');
  let out='',list=false;
  const close=()=>{if(list){out+='</ul>';list=false;}};
  for(const raw of lines){
    const line=raw.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    if(/^###\s+/.test(line)){close();out+=`<h3>${line.slice(4)}</h3>`;}
    else if(/^##\s+/.test(line)){close();out+=`<h2>${line.slice(3)}</h2>`;}
    else if(/^#\s+/.test(line)){close();out+=`<h2>${line.slice(2)}</h2>`;}
    else if(/^[-*]\s+/.test(line)){if(!list){out+='<ul>';list=true;}out+=`<li>${line.slice(2)}</li>`;}
    else if(/^\d+[.)]\s+/.test(line)){if(!list){out+='<ul>';list=true;}out+=`<li>${line.replace(/^\d+[.)]\s+/,'')}</li>`;}
    else if(line.trim()){close();out+=`<p>${line}</p>`;}
    else close();
  }
  close();
  return out;
}

/** Rewards table with the LIVE pot (rewardsNow) when the API gives it. */
export function renderRewards(b){
  const now=Array.isArray(b.rewardsNow)?b.rewardsNow:null;
  const rows=now?now.map(r=>`<tr><td>#${r.place}</td><td class="num">${money(r.amountUsd)}</td><td class="muted num">$${Number(r.baseUsd).toFixed(2)} prize + $${Number(r.feeShareUsd).toFixed(2)} fees</td></tr>`).join('')
    :Object.entries(b.rewards||{}).map(([p,v])=>`<tr><td>#${esc(p)}</td><td class="num">${money(v)}</td><td></td></tr>`).join('');
  if(!rows)return'';
  return`<h2>Rewards · live pot ${potOf(b)}</h2><table><tr><th>Place</th><th class="num">Pays now</th><th class="num">Split</th></tr>${rows}</table>`;
}

/** One board row: reward, live pot + fee slots filled in by enrichBoard. */
export function boardRow(b){
  const open=isOpen(b);
  return`<li data-slug="${esc(b.slug)}" class="${open?'':'closed'}">
  <a class="t" href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a>
  <div class="meta"><span class="pot" data-pot="${esc(b.slug)}">${money(b.potUsd??b.rewardAmount)}</span>
  <span class="fee" data-fee="${esc(b.slug)}">${b.feeUsd===undefined?'':(b.feeUsd!=null?money(b.feeUsd)+' fee':'Free entry')}</span>
  <span class="left" data-tl="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
  <span>${b.submissionCount} entries</span>
  <span class="pill ${open?'':'closed'}">${open?'Open':'Closed'}</span></div>
  <div class="cat">${esc(b.category||'')} · ${esc((b.skills||[]).slice(0,3).join(', '))}</div>
  <div class="meta"><a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard</a></div></li>`;
}

let boardItems=[],boardSort='deadline',boardFilter='';

/** Board list only (toolbar stays put): filter + sort, no page rebuild. */
export function renderBoardList(){
  const q=boardFilter.toLowerCase();
  let items=boardItems.filter(b=>!q||b.title.toLowerCase().includes(q)||(b.category||'').toLowerCase().includes(q));
  const by={pot:(a,b)=>(b.potUsd??b.rewardAmount)-(a.potUsd??a.rewardAmount),deadline:(a,b)=>new Date(a.deadline)-new Date(b.deadline),reward:(a,b)=>b.rewardAmount-a.rewardAmount,entries:(a,b)=>b.submissionCount-a.submissionCount};
  items=[...items].sort(by[boardSort]||by.deadline);
  const soon=items.filter(b=>isOpen(b)&&new Date(b.deadline)-Date.now()<48*3600000);
  const open=items.filter(b=>isOpen(b)&&new Date(b.deadline)-Date.now()>=48*3600000);
  const closed=items.filter(b=>!isOpen(b));
  const sec=(t,arr)=>arr.length?`<h2>${t} (${arr.length})</h2><ul class="board">${arr.map(boardRow).join('')}</ul>`:'';
  const list=document.getElementById('board-list');
  if(list)list.innerHTML=sec('Closing soon',soon)+sec('Open',open)+sec('Closed',closed)||'<p class="muted">No bounties match that filter.</p>';
}

/** The bounty board: filter + sort toolbar, sections, live-pot enrichment. */
export function renderBoard(app,data){
  boardItems=data.items||[];
  app.innerHTML=`<h1>Open bounties <span class="muted">(${boardItems.length} live)</span></h1>
  <p class="muted">Live board · cached · reward shows the live pot once loaded · time left ticks every 30s.</p>
  <div class="toolbar"><input id="q" type="search" placeholder="Filter bounties…" aria-label="Filter bounties" value="${esc(boardFilter)}">
  <select id="sort" aria-label="Sort bounties">
  <option value="deadline">Soonest first</option><option value="pot">Biggest pot</option>
  <option value="reward">Biggest reward</option><option value="entries">Most entries</option></select></div>
  <div id="board-list"></div>
  <p class="muted" id="board-foot"></p>`;
  const sort=document.getElementById('sort');sort.value=boardSort;
  sort.addEventListener('change',()=>{boardSort=sort.value;renderBoardList();});
  document.getElementById('q').addEventListener('input',e=>{boardFilter=e.target.value;renderBoardList();});
  renderBoardList();
}

/** Fill each visible row's live pot + entry fee from detail fetches, in place. */
export async function enrichBoard(data){
  const items=(data.items||[]).slice(0,24);
  let i=0;
  const run=async()=>{
    while(i<items.length){
      const b=items[i++];
      try{
        const d=await fetchBounty(b.slug);
        b.potUsd=d.potUsd??d.rewardAmount;
        b.feeUsd=d.entryFeeUsd??null;
        const pot=document.querySelector(`[data-pot="${CSS.escape(b.slug)}"]`);
        if(pot)pot.textContent=potOf(d);
        const fee=document.querySelector(`[data-fee="${CSS.escape(b.slug)}"]`);
        if(fee)fee.textContent=feeOf(d)?`${feeOf(d)} fee`:'Free entry';
      }catch(e){/* keep the list reward; one failed detail must not break the board */}
    }
  };
  await Promise.all([run(),run(),run(),run()]);
  renderBoardList(); // re-sort with the live pots now known (filter + sort kept)
  const foot=document.getElementById('board-foot');
  if(foot)foot.textContent=`${requestCount()} requests this session · answers cached + revalidated · updated just now`;
}

/** A bounty's page: summary, live pot, fee, dates, rewards, safe description. */
export function renderBounty(app,b){
  const open=isOpen(b);
  app.innerHTML=`<p><a href="#/">← All bounties</a> · <a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a></p>
  <h1>${esc(b.title)}</h1>
  <p><span class="pill ${open?'':'closed'}">${open?'Open — takes entries':'Closed'}</span> ${esc(b.category||'')} · by ${esc(b.sponsor&&b.sponsor.name||'make.fun')}</p>
  <p class="big">Live pot <span class="pot">${potOf(b)}</span> ${feeOf(b)?`<span class="fee">· ${feeOf(b)} entry fee</span>`:'<span class="fee">· Free entry</span>'}</p>
  <dl><dt>Reward</dt><dd>${money(b.rewardAmount)}${b.entryFeesUsd?` + ${money(b.entryFeesUsd)} from entry fees`:''}</dd>
  <dt>Deadline</dt><dd>${date(b.deadline)} (<span data-tl="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>)</dd>
  ${b.publishedAt?`<dt>Opened</dt><dd>${date(b.publishedAt)}</dd>`:''}
  <dt>Entries</dt><dd>${b.submissionCount}</dd>
  ${b.skills?`<dt>Skills</dt><dd>${esc(b.skills.join(', '))}</dd>`:''}</dl>
  ${b.summary?`<p>${esc(b.summary)}</p>`:''}
  ${renderRewards(b)}
  <h2>Description</h2><div class="desc">${renderMarkdown(b.description||'')}</div>`;
}

/** A leaderboard cell: judge rates are micros → %, bytes → KB, else as given. */
export function leaderCell(key,v,display){
  const n=Number(v);
  if(key.indexOf('judge')===0&&isFinite(n)&&n>1000)return`${(n/10000).toFixed(2)}%`;
  if(key==='bytes'&&isFinite(n))return`${(n/1024).toFixed(1)} KB`;
  return esc(display??v??'—');
}

/** A bounty's leaderboard: generic columns, 50 rows a page, top 3 highlighted. */
export function renderLeaderboard(app,b,lb){
  const cols=(lb.columns||[]).filter(c=>!c.hidden);
  const entries=lb.entries||[];
  let shown=50;
  const page=()=>{
    const rows=entries.slice(0,shown).map(e=>`<tr class="${e.rank<=3?'r'+e.rank:''}"><td>${e.rank}</td>
    <td>${avatarImg(e.image)}<a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a><br><span class="muted">${esc(e.title||'')}</span></td>
    ${cols.map(c=>`<td class="num">${leaderCell(c.key,e.values&&e.values[c.key],e.display&&e.display[c.key])}</td>`).join('')}</tr>`).join('');
    return`<table><tr><th>#</th><th>Entry</th>${cols.map(c=>`<th class="num">${esc(c.title)}</th>`).join('')}</tr>${rows}</table>
    ${shown<entries.length?`<button class="more" id="more">Show more (${entries.length-shown} left)</button>`:`<p class="muted">All ${entries.length} entries shown.</p>`}`;
  };
  app.innerHTML=`<p><a href="#/bounty/${esc(b.slug)}">← ${esc(b.title)}</a></p>
  <h1>${esc(b.title)} — leaderboard</h1>
  <p class="muted">${entries.length} entries · live pot ${potOf(b)} · ${b.submissionCount} submissions</p>
  <div id="lb">${page()}</div>`;
  const more=document.getElementById('more');
  if(more)more.addEventListener('click',()=>{shown+=50;document.getElementById('lb').innerHTML=page();
    const m=document.getElementById('more');
    if(m)m.addEventListener('click',()=>{shown+=50;document.getElementById('lb').innerHTML=page();});
  });
}

/** An account's public profile: header, record stats, solutions table. */
export function renderProfile(app,p){
  const r=p.record||{};
  const sols=p.solutions||[];
  const rows=sols.map(s=>`<tr><td><a href="#/bounty/${esc(s.competition.slug)}">${esc(s.competition.title)}</a></td>
  <td>${esc(s.competition.status||'')}</td><td data-tl="${esc(s.competition.deadline||'')}">${s.competition.deadline?timeLeft(s.competition.deadline):'—'}</td>
  <td class="num">${s.placement??'—'}</td><td class="num">${s.prize_usd!=null?money(s.prize_usd):'—'}</td>
  <td class="num">${esc(s.score&&s.score.display||'')}</td></tr>`).join('');
  app.innerHTML=`<h1>${avatarImg(p.image||p.avatar,'avatar big')}${esc(p.display_name||p.handle)} <span class="muted">@${esc(p.handle)}</span></h1>
  ${p.bio?`<p>${esc(p.bio)}</p>`:''}
  <p class="muted">${p.wallet&&p.wallet.address?`Wallet ${esc(shortWallet(p.wallet.address))} · `:''}Joined ${p.joined_at?date(p.joined_at):'—'}</p>
  <div class="stats">
  <div><b>${r.competitions_entered??0}</b><span>Entered</span></div>
  <div><b>${r.competitions_placed??0}</b><span>Placed</span></div>
  <div><b>${r.competitions_won??0}</b><span>Won</span></div>
  <div><b>#${r.best_placement??'—'}</b><span>Best placement</span></div>
  <div><b>${money(r.prize_usd||0)}</b><span>Prize money</span></div></div>
  <h2>Solutions (${sols.length})</h2>
  ${rows?`<table><tr><th>Bounty</th><th>Status</th><th>Time left</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th></tr>${rows}</table>`:'<p class="muted">No solutions yet.</p>'}`;
}
