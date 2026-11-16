// make.fun frontend — hash router. First load is only this file, api.js and
// style.css; the four views load lazily after first paint via a literal import().
// Routes: #/ board · #/bounty/<slug> · #/bounty/<slug>/leaderboard · #/u/<handle>
// window.__shotReady is false while a route loads, true once its data is on screen.
import {fetchCompetitions,fetchBounty,fetchLeaderboard,fetchProfile,requestCount,timeLeft} from './api.js';

const app=document.getElementById('app');
const statusEl=document.getElementById('status');

/** Live header line: how many API requests this session made, and freshness. */
export function updateStatus(note){if(statusEl)statusEl.textContent=`Live board · cached · ${requestCount()} requests · ${note||'updated just now'}`;}

/** Re-render every time-left label in place, without rebuilding the page. */
export function tickTimeLeft(){document.querySelectorAll('[data-tl]').forEach(el=>{el.textContent=timeLeft(el.getAttribute('data-tl'));});}

/** Mark a route ready for screenshots once its data is on screen. */
export function shotReady(){window.__shotReady=true;updateStatus();}

/** Split the hash into a route: board, bounty, leaderboard or profile. */
export function parseRoute(){
  const seg=(location.hash||'#/').replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  if(seg[0]==='bounty'&&seg[1])return{view:seg[2]==='leaderboard'?'leaderboard':'bounty',slug:seg[1]};
  if(seg[0]==='u'&&seg[1])return{view:'profile',handle:seg[1]};
  return{view:'board'};
}

/** Load the route's data, hand it to the lazy view, then flag the shot ready. */
export async function render(){
  window.__shotReady=false;
  const r=parseRoute();
  const views=await import('./views.js');
  app.innerHTML='<p class="loading">Loading live data from make.fun…</p>';
  try{
    if(r.view==='board'){
      document.title='make.fun bounties — live board';
      const d=await fetchCompetitions();
      views.renderBoard(app,d);
      await Promise.race([views.enrichBoard(d),new Promise(s=>setTimeout(s,9000))]);
    }else if(r.view==='bounty'){
      const b=await fetchBounty(r.slug);
      document.title=`${b.title} · make.fun`;
      views.renderBounty(app,b);
    }else if(r.view==='leaderboard'){
      const [b,lb]=await Promise.all([fetchBounty(r.slug),fetchLeaderboard(r.slug)]);
      document.title=`${b.title} leaderboard · make.fun`;
      views.renderLeaderboard(app,b,lb);
    }else{
      const p=await fetchProfile(r.handle);
      document.title=`${p.display_name||p.handle} · make.fun`;
      views.renderProfile(app,p);
    }
  }catch(e){
    app.innerHTML='<p class="error">Could not load live data from make.fun. Check the connection, then <a href="#/">back to the board</a>.</p>';
  }
  window.scrollTo(0,0);
  shotReady();
}

setInterval(tickTimeLeft,30000);
window.addEventListener('hashchange',render);
render();
