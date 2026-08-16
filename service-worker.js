const CACHE='ftbm-v0.9.6-sync-alpha';
const OFFLINE_PAGE='./index.html';
const CRITICAL_ASSETS=[
  OFFLINE_PAGE,
  './styles.css?v=0.9.6',
  './sync.js?v=0.9.6',
  './app.js?v=0.9.6',
  './assets/home/homepage.jpeg',
  './assets/guides/oral-ties-guide.png',
  './assets/guides/oral-dysfunction-screening-tool.jpeg',
  './assets/visual-guides/autism-can-look-different.webp',
  './assets/visual-guides/behavior-is-communication.webp',
  './assets/visual-guides/child-ssi-money.webp',
  './assets/visual-guides/communication-growth.webp',
  './assets/visual-guides/distress-at-home.webp',
  './assets/visual-guides/distress-unsafe.webp',
  './assets/visual-guides/nurture-confidence.webp',
  './assets/visual-guides/sensory-differences.webp',
  './assets/visual-guides/sensory-inputs-regulation.webp',
  './assets/visual-guides/sensory-regulation-strategies.webp',
  './assets/visual-guides/stimming-examples.webp',
  './assets/visual-guides/supporting-autistic-children.webp',
  './assets/visual-guides/supporting-emotional-regulation.webp',
  './assets/visual-guides/things-autistic-children-want-known.webp',
  './assets/visual-guides/understanding-autistic-meltdowns.webp',
  './assets/visual-guides/waiting-taking-turns.webp'
];
const OPTIONAL_ASSETS=[
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache=>{
        await Promise.all(CRITICAL_ASSETS.map(asset=>cache.add(new Request(asset,{cache:'reload'}))));
        await Promise.allSettled(OPTIONAL_ASSETS.map(asset=>cache.add(new Request(asset,{cache:'reload'}))));
      })
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('ftbm-v')&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(
      caches.open(CACHE).then(async cache=>{
        const cached=await cache.match(OFFLINE_PAGE);
        const network=fetch(event.request,{cache:'no-store'}).then(response=>{
          if(response&&response.ok)cache.put(OFFLINE_PAGE,response.clone());
          return response;
        });
        if(cached){
          event.waitUntil(network.catch(()=>undefined));
          return cached;
        }
        return network.catch(()=>new Response('More than Measured is unavailable offline until it has completed its first online load.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}));
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached)return cached;
      return fetch(event.request).then(response=>{
        if(!response||!response.ok)return response;
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      });
    })
  );
});
