const { chromium } = require('playwright');
const base = 'http://127.0.0.1:8765';
const failures = [];
function check(ok, label, detail = '') {
  if (!ok) failures.push(label + (detail ? ' — ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ' : ' + detail : ''));
}
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const routes = [
    ['index.html', '#upcoming-episodes .home-banner'],
    ['episodes.html', '#episodeGrid'],
    ['watch.html?season=6&episode=26', '#player #video'],
    ['monthly-animes.html', '.anime-library'],
    ['trailer.html', '.trailer-screen'],
    ['season7.html', 'main'],
    ['app.html', 'main'],
    ['death-note.html', 'main'],
    ['attack-on-titan.html', 'main'],
    ['black-clover.html', 'main'],
    ['upload.html', 'main'],
  ];
  for (const [route,selector] of routes) {
    const page = await browser.newPage({viewport:{width:1366,height:850}});
    await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    try {
      const response = await page.goto(base + '/beta2/' + route,{waitUntil:'domcontentloaded',timeout:12000});
      const stem = route.split('?')[0];
      check(response?.status()===200,stem+' HTML 200',String(response?.status()));
      const n=await page.locator('link[rel="stylesheet"][href^="/beta2/style.css"]').count();
      check(n===1,stem+' loads exactly one independent stylesheet',String(n));
      const linked=await page.locator('link[rel="stylesheet"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
      check(!linked.some(s=>/^(styles.css|season7-update.css)|cinema-edition.css|approved-mockup.css/.test(s)),stem+' no obsolete theme links',JSON.stringify(linked));
      const sheet=await page.locator('link[rel="stylesheet"][href^="/beta2/style.css"]').first().evaluate(e=>({loaded:!!e.sheet,rules:e.sheet?.cssRules?.length||0})).catch(()=>({loaded:false,rules:0}));
      check(sheet.loaded && sheet.rules>100,stem+' stylesheet parsed',JSON.stringify(sheet));
      check(await page.locator(selector).count()>0,stem+' core component exists',selector);
    } catch(e){check(false,route+' page render',e.message);}
    await page.close();
  }
  for (const [label,w,h] of [['desktop',1366,850],['iPad landscape',1180,820],['iPad portrait',820,1180],['phone',390,844]]) {
    const page=await browser.newPage({viewport:{width:w,height:h},isMobile:w<=820,hasTouch:w<=820});
    await page.route('**/*', r => new URL(r.request().url()).hostname==='127.0.0.1' ? r.continue() : r.abort());
    try {
      await page.goto(base+'/beta2/index.html',{waitUntil:'domcontentloaded',timeout:12000});
      await page.locator('link[rel="stylesheet"][href^="/beta2/style.css"]').first().evaluate(e=>e.sheet?.cssRules.length);
      // The existing 480ms page-glide animates the whole body +34px on entry.
      // Measure the settled layout, not a transient transform during navigation.
      await page.waitForTimeout(800);
      const state=await page.evaluate(()=>{
        const rect=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,display:cs.display,visible:cs.visibility};};
        const img=document.querySelector('#upcoming-episodes .home-banner .main-poster');
        return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,bar:rect('#upcoming-episodes .home-banner'),timer:rect('#upcoming-episodes .home-timer-panel'),header:rect('.topbar'),poster:{naturalWidth:img?.naturalWidth||0,complete:!!img?.complete},background:getComputedStyle(document.body).backgroundColor,latest:!!document.querySelector('#latestGrid')};
      });
      const b=state.bar,t=state.timer,hd=state.header;
      check(!!b&&b.display!=='none'&&b.h>=240&&b.h<=400,label+' poster size',JSON.stringify(b));
      check(!!b&&b.x>=-2&&b.right<=w+3,label+' poster stays within viewport',JSON.stringify(b));
      check(!!t&&t.display!=='none',label+' countdown panel displayed',JSON.stringify(t));
      check(!!hd&&hd.h>40&&hd.h<110,label+' navigation visible',JSON.stringify(hd));
      check(state.poster.naturalWidth>0,label+' original Season 7 poster loads',JSON.stringify(state.poster));
      check(state.background==='rgb(7, 11, 19)',label+' isolated dark theme applied',state.background);
      check(state.latest,label+' latest episodes section preserved');
      check(state.scroll<=w+5,label+' no page-wide horizontal overflow',state.scroll+' / '+w);
    }catch(e){check(false,label+' layout test',e.message);}
    await page.close();
  }
  await browser.close();
  if(failures.length){console.error('BETA2 SMOKE FAILURES:',failures.join(' | '));process.exitCode=1;}
  else console.log('All Beta2 stylesheet and layout smoke checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
