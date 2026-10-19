'use strict';
const {app,BrowserWindow,shell,Menu,dialog,session}=require('electron');
const path=require('path');
const SITE='https://miraculoushub.co.uk/';
const HOST='miraculoushub.co.uk';
let win;
function trusted(url){
 try {const u=new URL(url);return u.protocol==='https:'&&(u.hostname===HOST||u.hostname.endsWith('.'+HOST));}
 catch {return false;}
}
function loadHome(){if(win&&!win.isDestroyed())win.loadURL(SITE).catch(()=>{if(win&&!win.isDestroyed())win.loadFile(path.join(__dirname,'offline.html'));});}
function buildWindow(){
 win=new BrowserWindow({width:1250,height:820,minWidth:820,minHeight:540,show:false,
  backgroundColor:'#090a13',title:'MiraculousHub',autoHideMenuBar:true,
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:true}});
 win.once('ready-to-show',()=>win.show());
 win.webContents.setWindowOpenHandler(({url})=>{
   if(trusted(url)){win.loadURL(url);return {action:'deny'};}
   if(/^https:\/\//.test(url))shell.openExternal(url);
   return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{
   if(!trusted(url)){event.preventDefault();if(/^https:\/\//.test(url))shell.openExternal(url);}
 });
 win.webContents.on('did-fail-load',(_event,code,_description,url,isMainFrame)=>{
   if(isMainFrame&&code!==-3&&win&&!win.isDestroyed()&&url!==SITE)
     win.loadFile(path.join(__dirname,'offline.html')).catch(()=>{});
 });
 win.webContents.on('render-process-gone',()=>{
   if(win&&!win.isDestroyed())win.loadFile(path.join(__dirname,'offline.html')).catch(()=>{});
 });
 win.on('unresponsive',()=>{win.setTitle('MiraculousHub — Not responding');});
 win.webContents.on('did-finish-load',()=>win.setTitle('MiraculousHub'));
 win.webContents.session.setPermissionRequestHandler((_contents,permission,callback)=>{
   // Streaming video plays without needing invasive desktop permissions.
   callback(false);
 });
 const menu=Menu.buildFromTemplate([
  {label:'MiraculousHub',submenu:[{label:'Home',click:loadHome},{label:'Reload',accelerator:'CmdOrCtrl+R',click:()=>win.reload()},{label:'Back',accelerator:'Alt+Left',click:()=>{if(win.webContents.canGoBack())win.webContents.goBack();}},{type:'separator'},{role:'quit'}]},
  {label:'View',submenu:[{role:'togglefullscreen'},{role:'zoomIn'},{role:'zoomOut'},{role:'resetZoom'}]}
 ]);Menu.setApplicationMenu(menu);
 loadHome();
}
app.whenReady().then(buildWindow);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)buildWindow();});
