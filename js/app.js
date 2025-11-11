(function(){
  var DB_KEY='ot_local_base_v1';
  function dbLoad(){try{var d=JSON.parse(localStorage.getItem(DB_KEY))||{};d.entries=d.entries||{};d.quotas=d.quotas||{};d.settings=d.settings||{defaultMonthlyQuota:30,autoReset:true,defaultHourlyRate:0};if(typeof d.settings.defaultHourlyRate==='undefined') d.settings.defaultHourlyRate=0;return d;}catch(e){return{entries:{},quotas:{},settings:{defaultMonthlyQuota:30,autoReset:true,defaultHourlyRate:0}};}}
  function dbSave(d){localStorage.setItem(DB_KEY, JSON.stringify(d));}
  function $(s){return document.querySelector(s);} function pad(n){return String(n).padStart(2,'0');}
  function ymd(d){return [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join('-');}
  function monthKey(y,m){return y+'-'+pad(m);} function fmtMonth(y,m){return new Date(y,m-1,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'});}
  var state={y:(new Date()).getFullYear(), m:(new Date()).getMonth()+1};
  var dailyChart=null, reportChart=null;
  function onTab(e){ if(e.type!=='click') e.preventDefault(); var t=e.target; while(t&&!t.classList.contains('tab')) t=t.parentNode; if(!t) return;
    document.querySelectorAll('#footer-tabs .tab').forEach(function(x){x.classList.remove('active');}); t.classList.add('active');
    document.querySelectorAll('section').forEach(function(s){s.classList.remove('active');});
    var v=t.getAttribute('data-view'); var tgt=document.getElementById('view-'+v); if(tgt) tgt.classList.add('active');
    if(v==='dashboard') renderDashboard(); if(v==='record'){ ensureRecordDefaults(); refreshRecordHeader(); } if(v==='report') renderReportInit(); }
  var footer=document.getElementById('footer-tabs');
  footer.addEventListener('pointerup',onTab,{passive:false}); footer.addEventListener('touchend',onTab,{passive:false}); footer.addEventListener('click',onTab,{passive:false});
  function daysInMonth(y,m){return new Date(y,m,0).getDate();}
  function firstWeekday(y,m){return new Date(y,m-1,1).getDay();}
  function buildDailyArray(y,m){var d=dbLoad(); var days=daysInMonth(y,m); var arr=new Array(days).fill(0); var prefix=monthKey(y,m);
    for(var k in d.entries){ if(k.indexOf(prefix)===0){ var day=parseInt(k.split('-')[2],10); var v=d.entries[k];
        var sum=(+v.h1||0)+(+v.h15||0)+(+v.h2||0)+(+v.h3||0); if(!isNaN(day)&&day>=1&&day<=days) arr[day-1]=sum; } } return arr; }
  function calcMonthTotals(y,m){var d=dbLoad(); var prefix=monthKey(y,m); var hours=0, money=0;
    for(var k in d.entries){ if(k.indexOf(prefix)===0){ var v=d.entries[k]; var h=(+v.h1||0)+(+v.h15||0)+(+v.h2||0)+(+v.h3||0); hours+=h; var rate=(+v.rate||0); money+=h*rate; } }
    return {hours: Math.round(hours), money: Math.round(money)}; }
  function getMonthlyQuota(y,m){var d=dbLoad(); var q=d.quotas[monthKey(y,m)]; if(q && q>0) return q; return (d.settings && d.settings.defaultMonthlyQuota) ? d.settings.defaultMonthlyQuota : 0;}
  function getHourlyRate(){var d=dbLoad(); return (d.settings && +d.settings.defaultHourlyRate) ? +d.settings.defaultHourlyRate : 0;}
  function renderCalendarView(){var y=state.y, m=state.m; var grid=document.getElementById('cal-grid'); if(!grid) return;
    grid.innerHTML=''; document.getElementById('label-month').textContent=fmtMonth(y,m);
    var days=daysInMonth(y,m), start=firstWeekday(y,m), daily=buildDailyArray(y,m);
    for(var s=0;s<start;s++){ var off=document.createElement('div'); off.className='cal-day off'; grid.appendChild(off); }
    for(var i=1;i<=days;i++){ var hours=daily[i-1]||0; var cell=document.createElement('div'); var cls='cal-day';
      if(hours>5 && hours<=10) cell.style.background='#DAA520'; else if(hours>10 && hours<=20) cell.style.background='#DB7093'; else cell.style.background='#121a48';
      var wd=new Date(y,m-1,i).getDay(); if(wd===0||wd===6) cls+=' weekend';
      cell.className=cls; var display = hours>0 ? String(Math.round(hours)) : '';
      cell.innerHTML='<div class="date">'+i+'</div><div class="hours">'+display+'</div>'; grid.appendChild(cell);} }
  function renderStatsRow(){var totals=calcMonthTotals(state.y,state.m); var hEl=document.getElementById('hoursTotal'); var mEl=document.getElementById('moneyTotal');
    if(hEl) hEl.textContent = String(Math.round(totals.hours)); if(mEl) mEl.textContent = totals.money.toLocaleString('th-TH'); }
  function renderQuotaBar(){var totals=calcMonthTotals(state.y,state.m); var totalQuota=getMonthlyQuota(state.y,state.m);
    var used=totals.hours; var remain = Math.max(0, Math.round(totalQuota - used)); var pct = totalQuota>0 ? Math.min(100, Math.round((used/totalQuota)*100)) : 0;
    var qUsed=document.getElementById('quotaUsed'), qTot=document.getElementById('quotaTotal'), qRem=document.getElementById('quotaRemain'), qFill=document.getElementById('quotaFill'), qWrap=document.getElementById('quotaRemainWrap');
    if(qUsed) qUsed.textContent = String(Math.round(used)); if(qTot) qTot.textContent = String(Math.round(totalQuota)); if(qRem) qRem.textContent = String(remain);
    if(qFill){ qFill.style.width = (totalQuota>0 ? pct : 0)+'%'; qFill.className = (used>totalQuota)? 'quota-over' : ''; }
    if(qWrap) qWrap.style.display = (totalQuota>0 ? '' : 'none'); }
  function renderDailyBarChart(){var ctx=document.getElementById('dailyChart'); if(!ctx) return;
    var data=buildDailyArray(state.y,state.m).map(function(v){return Math.round(v);}); var labels=data.map(function(_,i){return String(i+1);});
    if(dailyChart){ dailyChart.destroy(); dailyChart=null; }
    dailyChart = new Chart(ctx.getContext('2d'), { type:'bar', data:{ labels: labels, datasets:[{ data:data, borderRadius:4, barThickness:8, maxBarThickness:10 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:(ctx)=> ' '+Math.round(ctx.parsed.y)}}}, scales:{ y:{ beginAtZero:true, ticks:{ callback:(v)=> Math.round(v) } } } } }); }
  function renderDashboard(){ renderStatsRow(); renderQuotaBar(); renderDailyBarChart(); renderCalendarView(); }
  var btnPrev=document.getElementById('btn-prev'), btnNext=document.getElementById('btn-next');
  if(btnPrev) btnPrev.addEventListener('click', function(){ state.m--; if(state.m===0){state.m=12; state.y--; } renderDashboard(); });
  if(btnNext) btnNext.addEventListener('click', function(){ state.m++; if(state.m===13){state.m=1; state.y++; } renderDashboard(); });
  function ensureRecordDefaults(){ var di=document.getElementById('in-date'); if(di && !di.value) di.value=ymd(new Date()); }
  function refreshRecordHeader(){ var di=document.getElementById('in-date'); var dt=(di && di.value) ? di.value : ymd(new Date());
    var sp=dt.split('-'); var y=+sp[0], m=+sp[1]; var quota=getMonthlyQuota(y,m); var rate=getHourlyRate();
    var qEl=document.getElementById('rec-quota'); var rEl=document.getElementById('rec-rate'); if(qEl) qEl.textContent=String(Math.round(quota)); if(rEl) rEl.textContent=rate.toLocaleString('th-TH'); }
  function clearHourInputs(){ ['h1','h15','h2','h3'].forEach(function(id){var e=document.getElementById(id); if(e) e.value=0;}); }
  function openModal(html){ document.getElementById('modal-content').innerText=html; document.getElementById('modal-backdrop').hidden=false; document.getElementById('modal').hidden=false; }
  function closeModal(){ document.getElementById('modal-backdrop').hidden=true; document.getElementById('modal').hidden=true; }
  (function(){ ensureRecordDefaults(); refreshRecordHeader(); closeModal(); })();
  var inDate=document.getElementById('in-date'); if(inDate) inDate.addEventListener('change',refreshRecordHeader);
  var btnClear=document.getElementById('btn-clear'); if(btnClear) btnClear.addEventListener('click', clearHourInputs);
  var pendingSave=null;
  var btnSave=document.getElementById('btn-save');
  if(btnSave) btnSave.addEventListener('click', function(){ var dt=(inDate && inDate.value) ? inDate.value : ymd(new Date());
    var h1=+(document.getElementById('h1').value||0)||0, h15=+(document.getElementById('h15').value||0)||0, h2=+(document.getElementById('h2').value||0)||0, h3=+(document.getElementById('h3').value||0)||0;
    var rate=getHourlyRate(); var total=h1+h15+h2+h3; var money=Math.round(total*rate);
    var msg='วันที่: '+dt+'\n\nรายละเอียดชั่วโมง\n • 1×   : '+h1+'\n • 1.5× : '+h15+'\n • 2×   : '+h2+'\n • 3×   : '+h3+'\nรวมชั่วโมง: '+total+'\nค่าแรง/ชม.: '+rate.toLocaleString('th-TH')+'\nรวมเป็นเงิน: '+money.toLocaleString('th-TH')+' บาท';
    pendingSave={dt:dt, data:{rate:rate,h1:h1,h15:h15,h2:h2,h3:h3}}; openModal(msg); });
  document.getElementById('modal-cancel').addEventListener('click', function(){ pendingSave=null; closeModal(); });
  document.getElementById('modal-confirm').addEventListener('click', function(){ if(!pendingSave) return closeModal();
    var db=dbLoad(); db.entries[pendingSave.dt]=pendingSave.data; dbSave(db); clearHourInputs(); renderDashboard(); closeModal(); alert('บันทึกเรียบร้อย'); pendingSave=null; });
  var btnDel=document.getElementById('btn-delete'); if(btnDel) btnDel.addEventListener('click', function(){ var dt=(inDate && inDate.value) ? inDate.value : null;
    if(!dt) return alert('กรุณาเลือกวันที่ก่อน'); if(!confirm('ต้องการลบข้อมูลวันที่ '+dt+' ใช่หรือไม่?')) return;
    var d=dbLoad(); delete d.entries[dt]; dbSave(d); renderDashboard(); alert('ลบแล้ว: '+dt); });
  (function(){ var d=dbLoad(); var defq=document.getElementById('default-monthly-quota'); if(defq) defq.value=d.settings.defaultMonthlyQuota||30;
    var auto=document.getElementById('auto-reset-toggle'); if(auto) auto.checked=!!d.settings.autoReset;
    var defr=document.getElementById('default-hourly-rate'); if(defr) defr.value=d.settings.defaultHourlyRate||0; })();
  var btnSaveDef=document.getElementById('btn-save-default-quota'); if(btnSaveDef) btnSaveDef.addEventListener('click', function(){ var v=parseFloat(document.getElementById('default-monthly-quota').value||'0')||0; var d=dbLoad(); d.settings.defaultMonthlyQuota=(v>0?v:0); dbSave(d); renderDashboard(); alert('บันทึกโควตาเริ่มต้นแล้ว'); });
  var autoT=document.getElementById('auto-reset-toggle'); if(autoT) autoT.addEventListener('change', function(){ var d=dbLoad(); d.settings.autoReset=!!autoT.checked; dbSave(d); });
  var btnSaveRate=document.getElementById('btn-save-default-rate'); if(btnSaveRate) btnSaveRate.addEventListener('click', function(){ var v=parseFloat(document.getElementById('default-hourly-rate').value||'0')||0; var d=dbLoad(); d.settings.defaultHourlyRate=v; dbSave(d); refreshRecordHeader(); alert('บันทึกค่าแรงต่อชั่วโมงเริ่มต้นแล้ว'); });
  var btnExport=document.getElementById('btn-export'); if(btnExport) btnExport.addEventListener('click', function(){ var blob=new Blob([localStorage.getItem(DB_KEY)||'{}'], {type:'application/json'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ot-data.json'; a.click(); });
  var btnImport=document.getElementById('btn-import'); if(btnImport) btnImport.addEventListener('click', function(){ var f=document.getElementById('import-file'); if(!f.files.length) return alert('เลือกไฟล์ก่อน'); var r=new FileReader(); r.onload=function(){ localStorage.setItem(DB_KEY, String(r.result)); renderDashboard(); alert('นำเข้าแล้ว'); }; r.readAsText(f.files[0]); });
  var btnLogout=document.getElementById('btn-logout'); if(btnLogout) btnLogout.addEventListener('click', function(){ sessionStorage.removeItem('ot_session_auth_v1'); location.href='login.html'; });
  function buildYearData(year){ var months=[], hours=[], money=[], sumH=0, sumM=0; for (var m=1; m<=12; m++){ var t=calcMonthTotals(year, m); var h=Math.round(t.hours||0); var mm=Math.round(t.money||0); months.push(m); hours.push(h); money.push(mm); sumH+=h; sumM+=mm; } return { months, hours, money, sumH, sumM }; }
  function renderReport(year){ var y=year || (new Date()).getFullYear(); var data=buildYearData(y);
    var hEl=document.getElementById('report-hours-year'); var mEl=document.getElementById('report-money-year'); if (hEl) hEl.textContent=String(Math.round(data.sumH)); if (mEl) mEl.textContent=data.sumM.toLocaleString('th-TH');
    var ctx=document.getElementById('reportChart'); if (ctx){ if (reportChart){ reportChart.destroy(); reportChart=null; } var labels=data.months.map(function(m){ return String(m); });
      reportChart=new Chart(ctx.getContext('2d'),{ type:'bar', data:{ labels:labels, datasets:[{ data:data.hours, borderRadius:4, barThickness:12, maxBarThickness:14 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:(c)=> ' '+Math.round(c.parsed.y)+' ชม.'}} }, scales:{ y:{ beginAtZero:true, ticks:{ callback:(v)=> Math.round(v) } } } } }); }
    return data; }
  function populateYearOptions(){ var sel=document.getElementById('report-year'); if(!sel) return; var nowY=(new Date()).getFullYear(); var minY=nowY-5, maxY=nowY+1; sel.innerHTML=''; for (var y=maxY; y>=minY; y--){ var opt=document.createElement('option'); opt.value=String(y); opt.textContent=String(y); if (y===nowY) opt.selected=true; sel.appendChild(opt); } }
  function renderReportInit(){ populateYearOptions(); var sel=document.getElementById('report-year'); var currentYear = sel ? parseInt(sel.value,10) : (new Date()).getFullYear(); var yearData = renderReport(currentYear);
    if (sel){ sel.onchange=function(){ yearData = renderReport(parseInt(sel.value,10)); }; }
    var btnPdf=document.getElementById('btn-export-pdf'); if(btnPdf){ btnPdf.onclick=function(){ var y = sel ? parseInt(sel.value,10) : (new Date()).getFullYear(); var d = buildYearData(y);
      var body=[]; for (var m=1; m<=12; m++){ body.push([ String(m).padStart(2,'0'), String(Math.round(d.hours[m-1]||0)), (Math.round(d.money[m-1]||0)).toLocaleString('th-TH') ]); }
      const { jsPDF } = window.jspdf; var doc = new jsPDF({ unit:'pt', format:'a4' }); doc.setFontSize(16); doc.text('รายงาน OT ประจำปี ' + y, 40, 40);
      doc.setFontSize(12); doc.text('ชั่วโมงรวม: ' + Math.round(d.sumH) + '   เงินรวม: ' + d.sumM.toLocaleString('th-TH') + ' บาท', 40, 60);
      doc.autoTable({ head:[['เดือน','จำนวนชั่วโมง','จำนวนเงิน (บาท)']], body: body, startY: 80, styles:{ halign:'center' }, columnStyles:{ 0:{ halign:'center' }, 1:{ halign:'right' }, 2:{ halign:'right' } }, theme:'grid' });
      doc.save('OT_Report_' + y + '.pdf'); }; } }
  function init(){ document.getElementById('modal-backdrop').hidden=true; document.getElementById('modal').hidden=true; renderDashboard(); if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('./sw.js'); }catch(e){} } }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();