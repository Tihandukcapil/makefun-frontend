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
  return u?`<img crossorigin="anonymous" class="${cls||'avatar'}" src="${esc(avatarUrl(u))}" alt="" loading="lazy" onerror="this.style.display='none'">`:'';
}

/** Fallback avatar: initial in a coloured disc when the profile has no image. */
export function initialAvatar(name,cls){
  const ch=esc((name||'?').trim().charAt(0).toUpperCase());
  return`<span class="${cls||'avatar'} initial" aria-hidden="true">${ch}</span>`;
}

/** Short wallet form: 3kSD…5dEEm. */
export function shortWallet(a){
  return a&&a.length>10?a.slice(0,4)+'…'+a.slice(-5):(a||'');
}

/** Urgency of a deadline: '' calm, 'soon' <48h, 'hot' <24h. */
export function urgency(iso){
  const ms=new Date(iso).getTime()-Date.now();
  if(!(ms>0))return'ended';
  if(ms<24*3600000)return'hot';
  if(ms<48*3600000)return'soon';
  return'';
}

/** Safe markdown: escape first, then headings, bold, code, lists, paragraphs. */
export function renderMarkdown(md){
  const lines=esc(md||'').split('\n');
  let out='',list=false,pre=false;
  const close=()=>{if(list){out+='</ul>';list=false;}};
  for(const raw of lines){
    if(raw.trim().startsWith('```')){close();pre=!pre;out+=pre?'<pre><code>':'</code></pre>';continue;}
    if(pre){out+=raw+'\n';continue;}
    const line=raw.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/`([^`]+)`/g,'<code>$1</code>');
    if(/^###\s+/.test(line)){close();out+=`<h3>${line.slice(4)}</h3>`;}
    else if(/^##\s+/.test(line)){close();out+=`<h2>${line.slice(3)}</h2>`;}
    else if(/^#\s+/.test(line)){close();out+=`<h2>${line.slice(2)}</h2>`;}
    else if(/^[-*]\s+/.test(line)){if(!list){out+='<ul>';list=true;}out+=`<li>${line.slice(2)}</li>`;}
    else if(/^\d+[.)]\s+/.test(line)){if(!list){out+='<ul>';list=true;}out+=`<li>${line.replace(/^\d+[.)]\s+/,'')}</li>`;}
    else if(line.trim()){close();out+=`<p>${line}</p>`;}
    else close();
  }
  close();
  if(pre)out+='</code></pre>';
  return out;
}

/** Rewards table with the LIVE pot (rewardsNow) when the API gives it. */
export function renderRewards(b){
  const now=Array.isArray(b.rewardsNow)?b.rewardsNow:null;
  const rows=now?now.map(r=>`<tr class="${r.place<=3?'r'+r.place:''}"><td><span class="rank-chip">${r.place}</span></td><td class="num">${money(r.amountUsd)}</td><td class="muted num">$${Number(r.baseUsd).toFixed(2)} prize + $${Number(r.feeShareUsd).toFixed(2)} fees</td></tr>`).join('')
    :Object.entries(b.rewards||{}).map(([p,v])=>`<tr class="${+p<=3?'r'+p:''}"><td><span class="rank-chip">${esc(p)}</span></td><td class="num">${money(v)}</td><td></td></tr>`).join('');
  if(!rows)return'';
  return`<h2>Rewards · live pot ${potOf(b)}</h2><table><thead><tr><th>Place</th><th class="num">Pays now</th><th class="num">Split</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** One board card: big live pot, fee, urgency-coloured time left, entries. */
export function boardRow(b){
  const open=isOpen(b);
  const urg=urgency(b.deadline);
  const leftCls=urg==='hot'?'left':urg==='soon'?'left soon':'left';
  const fee=b.feeUsd===undefined?'':(b.feeUsd!=null?money(b.feeUsd)+' entry fee':'Free entry');
  return`<li data-slug="${esc(b.slug)}" class="${open?'':'closed'}">
  <a class="t" href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a>
  <div class="row"><span class="pot" data-pot="${esc(b.slug)}">${money(b.potUsd??b.rewardAmount)}</span>
  <span class="fee" data-fee="${esc(b.slug)}">${fee}</span></div>
  <div class="row"><span class="${leftCls}" data-tl="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
  <span class="entries">${b.submissionCount.toLocaleString('en-US')} entries</span>
  <span class="pill ${open?'':'closed'}">${open?'Open':'Closed'}</span></div>
  <div class="cat">${esc(b.category||'')} · ${esc((b.skills||[]).slice(0,3).join(' · '))}</div>
  <div class="foot"><a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a>
  <a href="#/bounty/${esc(b.slug)}">Details →</a></div></li>`;
}

let boardItems=[],boardSort='deadline',boardFilter='';

/** Board hero numbers: total live pot, open bounties, closing soon. */
export function boardHero(){
  const open=boardItems.filter(isOpen);
  const total=open.reduce((s,b)=>s+Number(b.potUsd??b.rewardAmount??0),0);
  const soon=open.filter(b=>new Date(b.deadline)-Date.now()<48*3600000).length;
  const totalEl=document.getElementById('hero-pot');
  if(totalEl)totalEl.textContent=money(total);
  const openEl=document.getElementById('hero-open');
  if(openEl)openEl.textContent=String(open.length);
  const soonEl=document.getElementById('hero-soon');
  if(soonEl)soonEl.textContent=String(soon);
}

/** Board list only (toolbar stays put): filter + sort, no page rebuild. */
export function renderBoardList(){
  const q=boardFilter.toLowerCase();
  let items=boardItems.filter(b=>!q||b.title.toLowerCase().includes(q)||(b.category||'').toLowerCase().includes(q));
  const by={pot:(a,b)=>(b.potUsd??b.rewardAmount)-(a.potUsd??a.rewardAmount),deadline:(a,b)=>new Date(a.deadline)-new Date(b.deadline),reward:(a,b)=>b.rewardAmount-a.rewardAmount,entries:(a,b)=>b.submissionCount-a.submissionCount};
  items=[...items].sort(by[boardSort]||by.deadline);
  const soon=items.filter(b=>isOpen(b)&&new Date(b.deadline)-Date.now()<48*3600000);
  const open=items.filter(b=>isOpen(b)&&new Date(b.deadline)-Date.now()>=48*3600000);
  const closed=items.filter(b=>!isOpen(b));
  const sec=(t,arr)=>arr.length?`<h2>${t} · ${arr.length}</h2><ul class="board">${arr.map(boardRow).join('')}</ul>`:'';
  const list=document.getElementById('board-list');
  if(list)list.innerHTML=sec('Closing soon',soon)+sec('Open',open)+sec('Closed',closed)||'<p class="empty">No bounties match that filter.</p>';
  boardHero();
}

/** The bounty board: hero stats, filter + sort toolbar, sections, live-pot enrichment. */
export function renderBoard(app,data){
  boardItems=data.items||[];
  app.innerHTML=`<h1>Live bounty board</h1>
  <p class="lede">Every open bounty on make.fun, with its live pot, entry fee and time left — read straight from the public API, no sign-in.</p>
  <div class="hero">
    <div class="stat"><span>Total live pot</span><b class="green" id="hero-pot">—</b><small>across all open bounties</small></div>
    <div class="stat"><span>Open bounties</span><b id="hero-open">—</b><small>accepting entries now</small></div>
    <div class="stat"><span>Closing soon</span><b class="amber" id="hero-soon">—</b><small>under 48 hours left</small></div>
  </div>
  <div class="toolbar"><input id="q" type="search" placeholder="Filter bounties…" aria-label="Filter bounties" value="${esc(boardFilter)}">
  <select id="sort" aria-label="Sort bounties">
  <option value="deadline">Soonest first</option><option value="pot">Biggest pot</option>
  <option value="reward">Biggest reward</option><option value="entries">Most entries</option></select></div>
  <div id="board-list"></div>
  <p class="small" id="board-foot"></p>`;
  const sort=document.getElementById('sort');sort.value=boardSort;
  sort.addEventListener('change',()=>{boardSort=sort.value;renderBoardList();});
  document.getElementById('q').addEventListener('input',e=>{boardFilter=e.target.value;renderBoardList();});
  renderBoardList();
}

/** Fill each visible card's live pot + entry fee from detail fetches, in place. */
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
        if(fee)fee.textContent=feeOf(d)?`${feeOf(d)} entry fee`:'Free entry';
      }catch(e){/* keep the list reward; one failed detail must not break the board */}
    }
  };
  await Promise.all([run(),run(),run(),run()]);
  renderBoardList(); // re-sort with the live pots now known (filter + sort kept)
  const foot=document.getElementById('board-foot');
  if(foot)foot.textContent=`${requestCount()} requests this session · answers cached + revalidated · updated just now`;
}

/** A bounty's page: hero pot, stat tiles, rewards, safe description. */
export function renderBounty(app,b){
  const open=isOpen(b);
  const urg=urgency(b.deadline);
  const leftCls=urg==='hot'?'left':urg==='soon'?'left soon':'left';
  const skills=(b.skills||[]).map(s=>`<span class="chip">${esc(s)}</span>`).join('');
  app.innerHTML=`<p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard →</a></p>
  <div class="bounty-hero">
    <span class="pill ${open?'':'closed'}">${open?'Open — takes entries':'Closed'}</span>
    ${urg==='hot'&&open?'<span class="pill hot">Closing soon</span>':''}
    <h1>${esc(b.title)}</h1>
    <p class="sub">${esc(b.category||'')} · by ${esc(b.sponsor&&b.sponsor.name||'make.fun')}</p>
    <div class="pot">${potOf(b)}</div>
    <p class="sub">Live pot right now · ${feeOf(b)?`${feeOf(b)} entry fee`:'Free entry'} · <span class="${leftCls}" data-tl="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></p>
  </div>
  <div class="kv">
    <div><dt>Reward</dt><dd>${money(b.rewardAmount)}${b.entryFeesUsd?` + ${money(b.entryFeesUsd)} fees`:''}</dd></div>
    <div><dt>Deadline</dt><dd>${date(b.deadline)}</dd></div>
    <div><dt>Entries</dt><dd>${Number(b.submissionCount||0).toLocaleString('en-US')}</dd></div>
    <div><dt>Opened</dt><dd>${b.publishedAt?date(b.publishedAt):'—'}</dd></div>
  </div>
  ${skills?`<div class="tags">${skills}</div>`:''}
  ${b.summary?`<p class="lede" style="margin-top:14px">${esc(b.summary)}</p>`:''}
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

/** A bounty's leaderboard: podium top 3, then a clean table, 50 rows a page. */
export function renderLeaderboard(app,b,lb){
  const cols=(lb.columns||[]).filter(c=>!c.hidden);
  const entries=lb.entries||[];
  const firstCol=cols[0];
  const top3=entries.filter(e=>e.rank<=3);
  const podium=top3.length?`<div class="podium">${top3.map(e=>`<div class="pod p${e.rank}">
    <div class="place">#${e.rank} place</div>
    ${avatarImg(e.image)}
    <div class="who"><a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a></div>
    <div class="score">${firstCol?leaderCell(firstCol.key,e.values&&e.values[firstCol.key],e.display&&e.display[firstCol.key]):''}</div>
    <div class="ttl">${esc(e.title||'')}</div></div>`).join('')}</div>`:'';
  let shown=50;
  const page=()=>{
    const rows=entries.slice(0,shown).map(e=>`<tr class="${e.rank<=3?'r'+e.rank:''}"><td><span class="rank-chip">${e.rank}</span></td>
    <td>${avatarImg(e.image)}<a href="#/u/${esc(e.handle)}">${esc(e.handle)}</a><br><span class="muted">${esc(e.title||'')}</span></td>
    ${cols.map(c=>`<td class="num">${leaderCell(c.key,e.values&&e.values[c.key],e.display&&e.display[c.key])}</td>`).join('')}</tr>`).join('');
    return`<table><thead><tr><th>#</th><th>Entry</th>${cols.map(c=>`<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    ${shown<entries.length?`<button class="more" id="more">Show more (${entries.length-shown} left)</button>`:`<p class="small">All ${entries.length} entries shown.</p>`}`;
  };
  const draw=()=>{
    document.getElementById('lb').innerHTML=page();
    const m=document.getElementById('more');
    if(m)m.addEventListener('click',()=>{shown+=50;draw();});
  };
  app.innerHTML=`<p class="crumbs"><a href="#/bounty/${esc(b.slug)}">← ${esc(b.title)}</a></p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${entries.length} entries · live pot <b style="color:var(--green)">${potOf(b)}</b> · ${Number(b.submissionCount||0).toLocaleString('en-US')} submissions</p>
  ${podium}
  <div id="lb"></div>`;
  draw();
}

/** An account's public profile: header card, record stats, solutions table. */
export function renderProfile(app,p){
  const r=p.record||{};
  const sols=p.solutions||[];
  const rows=sols.map(s=>`<tr><td><a href="#/bounty/${esc(s.competition.slug)}">${esc(s.competition.title)}</a></td>
  <td>${esc(s.competition.status||'')}</td><td data-tl="${esc(s.competition.deadline||'')}">${s.competition.deadline?timeLeft(s.competition.deadline):'—'}</td>
  <td class="num">${s.placement??'—'}</td><td class="num">${s.prize_usd!=null?money(s.prize_usd):'—'}</td>
  <td class="num">${esc(s.score&&s.score.display||'')}</td></tr>`).join('');
  const name=p.display_name||p.handle;
  app.innerHTML=`<div class="profile-head">
  ${p.image||p.avatar?avatarImg(p.image||p.avatar,'avatar big'):initialAvatar(name,'initial')}
  <div class="who"><h1>${esc(name)} <span class="muted" style="font-size:18px">@${esc(p.handle)}</span></h1>
  ${p.bio?`<p>${esc(p.bio)}</p>`:''}
  <p class="small">${p.wallet&&p.wallet.address?`Wallet ${esc(shortWallet(p.wallet.address))} · `:''}Joined ${p.joined_at?date(p.joined_at):'—'}</p></div></div>
  <div class="stats">
  <div><b>${r.competitions_entered??0}</b><span>Entered</span></div>
  <div><b>${r.competitions_placed??0}</b><span>Placed</span></div>
  <div><b>${r.competitions_won??0}</b><span>Won</span></div>
  <div><b>#${r.best_placement??'—'}</b><span>Best placement</span></div>
  <div><b>${money(r.prize_usd||0)}</b><span>Prize money</span></div></div>
  <h2>Solutions (${sols.length})</h2>
  ${rows?`<table><thead><tr><th>Bounty</th><th>Status</th><th>Time left</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th></tr></thead><tbody>${rows}</tbody></table>`:'<p class="empty">No solutions yet.</p>'}`;
}
