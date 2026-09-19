/* Server signatures authorize access; the clock tracks elapsed time, never adds it.
   Browsers have no trusted clock across shutdown. Rollback detection is best effort,
   not protection against someone modifying the browser and all of its storage. */
window.MTMOffline = (() => {
  const storageKey='mtm-offline-pass-v1';
  let current=null;
  const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
  const encoder=new TextEncoder();
  async function sessionHash(s){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(s.token)));}
  async function decode(pass,s){
    if(!pass||!window.MTM_OFFLINE_PUBLIC_KEY)return null;
    const key=await crypto.subtle.importKey('jwk',window.MTM_OFFLINE_PUBLIC_KEY,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes(pass.signature),encoder.encode(pass.payload)))return null;
    const p=JSON.parse(new TextDecoder().decode(bytes(pass.payload))),v=p.entitlement;
    if(p.version!==1||!Number.isFinite(p.issuedAt)||!Number.isFinite(p.expiresAt)||p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>30*86400000||
      !v?.enforced||!v.access||v.userId!==s.user?.id||v.householdId!==s.householdId||p.sessionHash!==await sessionHash(s)||
      (v.role==='babysitter'&&p.sharedProfileId!==s.sharedProfileId))return null;
    return p;
  }
  function clear(){current=null;try{localStorage.removeItem(storageKey);}catch{}}
  function persist(){try{if(current)localStorage.setItem(storageKey,JSON.stringify(current.saved));}catch{}}
  function advance(){
    if(!current)return false;
    const wall=Date.now(),tick=performance.now(),c=current,s=c.saved;
    // Allow a small clock correction, but never subtract elapsed time.
    if(wall<s.wall-120000){clear();return false;}
    s.elapsed+=Math.max(0,wall-s.wall,tick-c.tick);s.wall=Math.max(s.wall,wall);c.tick=tick;
    if(c.payload.issuedAt+s.elapsed>=c.payload.expiresAt){clear();return false;}
    persist();return true;
  }
  async function accept(pass,s){
    clear();
    try{
      const payload=await decode(pass,s);if(!payload)return;
      current={payload,tick:performance.now(),saved:{pass,serverUrl:s.serverUrl,wall:Date.now(),elapsed:0}};persist();
    }catch{clear();}
  }
  async function read(s){
    try{
      if(!current){
        const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
        if(!saved||saved.serverUrl!==s.serverUrl||!Number.isFinite(saved.wall)||!Number.isFinite(saved.elapsed)||saved.elapsed<0)return null;
        const payload=await decode(saved.pass,s);if(!payload){clear();return null;}
        current={payload,saved,tick:performance.now()};
      }
      if(current.saved.serverUrl!==s.serverUrl||current.payload.entitlement.userId!==s.user?.id||current.payload.entitlement.householdId!==s.householdId||
        current.payload.sessionHash!==await sessionHash(s)||(current.payload.entitlement.role==='babysitter'&&current.payload.sharedProfileId!==s.sharedProfileId))return null;
      if(!advance())return null;
      return {...current.payload.entitlement,canRestore:false,trialEligible:false,checkoutAvailable:false,offline:true,offlineExpiresAt:new Date(current.payload.expiresAt).toISOString()};
    }catch{clear();return null;}
  }
  setInterval(advance,15000);
  window.addEventListener('pagehide',advance);
  document.addEventListener('visibilitychange',advance);
  return {accept,read,clear};
})();
