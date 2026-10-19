const { chromium } = require('playwright');
const base = process.env.TEST_BASE || 'https://miraculoushub.co.uk';
const routes=['/','/episodes.html','/monthly-animes.html','/watch.html?season=6&episode=26','/season7.html','/app.html'];
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let failures=0;
 for(const route of routes){
   const page=await browser.newPage({ignoreHTTPSErrors:false});
   const errors=[],failedRequests=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',req=>{if(req.url().startsWith(base))failedRequests.push(req.url()+' '+(req.failure()?.errorText||''));});
   let status='no response',title='',head='';
   try{
     const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:25000});
     status=response?.status()||'none';
     await page.waitForTimeout(3000);
     title=await page.title();
     head=await page.locator('h1').first().textContent({timeout:2000}).catch(()=>'');
     const bad=typeof status==='number'&&status>=400;
     const critical=errors.filter(e=>!/Failed to fetch|network|quota|permission|CORS|Firebase|adsbygoogle|ResizeObserver/i.test(e));
     if(bad||critical.length){failures++;} 
     console.log(JSON.stringify({route,status,title,head,errors:errors.slice(0,8),failedRequests:failedRequests.slice(0,8)}));
   }catch(e){failures++;console.log(JSON.stringify({route,status,title,head,fatal:e.message,errors}));}
   await page.close();
 }
 await browser.close();
 if(failures){console.error(failures+' failed browser smoke checks');process.exitCode=1;}
})();
