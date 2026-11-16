// make.fun public API: read-only GET, CORS open. Answers are cached in memory
// and revalidated with ETag / If-None-Match (304 keeps the cached body); requests
// in flight for the same path share one fetch, so a view costs few requests.
const API='https://make.fun/api';
const cache=new Map(),inflight=new Map();
let requests=0;

/** Text made safe to put inside HTML. */
export function esc(v){return String(v??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);}

/** A dollar amount as '$1,000' or '$0.50'. */
export function money(v){const n=Number(v);if(!isFinite(n))return'—';return n.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:Number.isInteger(n)?0:2});}

/** An ISO deadline as a short UTC date. */
export function date(iso){try{return`${new Date(iso).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} UTC`;}catch(e){return String(iso||'');}}

/** Time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso){const ms=new Date(iso).getTime()-Date.now();if(!(ms>0))return'ended';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);if(d>0)return`${d}d ${h}h left`;if(h>0)return`${h}h ${m}m left`;return`${m}m left`;}

/** The reward as it stands now: prize plus entry fees paid into the pot. */
export function potOf(b){return money(b.potUsd??b.rewardAmount);}

/** The entry fee, when the bounty charges one. */
export function feeOf(b){return b.entryFeeUsd!=null?money(b.entryFeeUsd):null;}

/** Still taking entries? Decide by the deadline, not the status alone. */
export function isOpen(b){return new Date(b.deadline).getTime()>Date.now();}

/** How many real network requests this session has made. */
export function requestCount(){return requests;}

/** GET with cache + ETag revalidation + in-flight dedupe. Returns parsed JSON. */
export async function fetchCached(path){
  const hit=cache.get(path);
  if(hit&&Date.now()-hit.at<60000)return hit.body;
  if(inflight.has(path))return inflight.get(path);
  const p=(async()=>{
    requests++;
    const res=await fetch(API+path,{headers:hit&&hit.etag?{'If-None-Match':hit.etag}:{}});
    if(res.status===304&&hit){hit.at=Date.now();return hit.body;}
    const body=await res.json();
    cache.set(path,{body,etag:res.headers.get('ETag'),at:Date.now()});
    return body;
  })();
  inflight.set(path,p);
  try{return await p;}finally{inflight.delete(path);}
}

/** The open bounties board (activity=times leaves out per-bounty activity). */
export function fetchCompetitions(){return fetchCached('/competitions?status=open&activity=times');}

/** One bounty, by slug: live pot, entry fee, rewards, dates. */
export function fetchBounty(slug){return fetchCached(`/competitions/${encodeURIComponent(slug)}`);}

/** A bounty's leaderboard: columns + ranked entries, rendered generically. */
export function fetchLeaderboard(slug){return fetchCached(`/competitions/${encodeURIComponent(slug)}/leaderboard`);}

/** An account's public profile: record, solutions, wallet. */
export function fetchProfile(handle){return fetchCached(`/profiles/${encodeURIComponent(handle)}`);}
