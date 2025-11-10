// EGAT OT — app.js (safe syntax)
var DB_KEY = 'ot_manual_v1';

function dbLoad() {
  try {
    var d = JSON.parse(localStorage.getItem(DB_KEY)) || {};
    d.entries  = d.entries  || {};
    d.defRate  = Number(d.defRate || 0);
    d.quotas   = d.quotas   || {};
    d.settings = d.settings || {};
    if (typeof d.settings.autoReset === 'undefined') d.settings.autoReset = true;
    if (typeof d.settings.defaultMonthlyQuota === 'undefined') d.settings.defaultMonthlyQuota = 30;
    return d;
  } catch(e) {
    return { entries:{}, defRate:0, quotas:{}, settings:{ autoReset:true, defaultMonthlyQuota:30 } };
  }
}
function dbSave(d){ localStorage.setItem(DB_KEY, JSON.stringify(d)); }
function dbUpsert(date,entry){ var d=dbLoad(); d.entries[date]=entry; dbSave(d); }
function dbRemove(date){ var d=dbLoad(); delete d.entries[date]; dbSave(d); }
function dbSetQuota(k,h){ var d=dbLoad(); d.quotas[k]=Number(h)||0; dbSave(d); }
function dbGetQuota(k){ var d=dbLoad(); var q=d.quotas[k]; return (q && q>0) ? q : Number(d.settings.defaultMonthlyQuota||0); }
function dbGetSettings(){ return dbLoad().settings; }
function dbSetSettings(s){ var d=dbLoad(); for (var k in s){ d.settings[k]=s[k]; } dbSave(d); }

function $(s){ return document.querySelector(s); }
function pad(n){ return String(n).padStart(2,'0'); }
function ymd(d){ return [d.getFullYear(), pad(d.getMonth()+1), pad(d.getDate())].join('-'); }
function fmtMonth(y,m){ return new Date(y,m-1,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'}); }
function monthKeyOf(y,m){ return y+'-'+pad(m); }
function thb(n){ return '฿'+Number(n||0).toFixed(2); }

var state = { year:(new Date()).getFullYear(), month:(new Date()).getMonth()+1 };
var dailyChart = null, monthlyChart = null;

function renderDashboard(){
  var data=dbLoad();
  var key=monthKeyOf(state.year,state.month);
  var rows=[], k, i;

  for (k in data.entries){
    if (k.indexOf(key)===0){
      var v=data.entries[k];
      var rate=+v.rate||+data.defRate||0;
      var h1=+v.h1||0, h15=+v.h15||0, h2=+v.h2||0, h3=+v.h3||0;
      rows.push({
        date:k, h1:h1, h15:h15, h2:h2, h3:h3,
        hours:h1+h15+h2+h3,
        money:h1*rate + h15*rate*1.5 + h2*rate*2 + h3*rate*3
      });
    }
  }

  var sumH=0, sumM=0;
  for (i=0;i<rows.length;i++){ sumH+=rows[i].hours; sumM+=rows[i].money; }

  var quota=dbGetQuota(key);
  var left=Math.max(0, quota - sumH);
  var pct = quota>0 ? Math.min(100, Math.round(sumH/quota*100)) : 0;

  $('#quota-hours').textContent   = quota.toFixed(1);
  $('#quota-default').textContent = (dbGetSettings().defaultMonthlyQuota||0).toFixed(1);
  $('#quota-used').textContent    = sumH.toFixed(1);
  $('#quota-left').textContent    = left.toFixed(1);
  $('#quota-progress').style.width= pct + '%';
  $('#label-month').textContent   = fmtMonth(state.year,state.month);
  $('#sum-month-hours').textContent= sumH.toFixed(2) + ' ชม.';
  $('#sum-month-money').textContent= thb(sumM);

  var list=$('#quick-list'); list.innerHTML='';
  for (i=0;i<rows.length;i++){
    var r=rows[i];
    var el=document.createElement('div'); el.className='item';
    el.innerHTML =
      '<div><b>'+r.date+'</b><div class="muted">1×:'+r.h1+'  1.5×:'+r.h15+'  2×:'+r.h2+'  3×:'+r.h3+'</div></div>'+
      '<div><span class="pill">'+r.hours.toFixed(2)+' ชม.</span><span class="pill money">'+thb(r.money)+'</span></div>';
    list.appendChild(el);
  }

  renderDailyChart(state.year,state.month);
  renderCalendarSummary(state.year,state.month);
}

function renderDailyChart(year,month){
  var data=dbLoad();
  var days=new Date(year,month,0).getDate();
  var money=new Array(days);
  var i; for (i=0;i<days;i++){ money[i]=0; }

  for (var date in data.entries){
    var sp=date.split('-'); var y=+sp[0], m=+sp[1], d=+sp[2];
    if (y===year && m===month){
      var v=data.entries[date]; var rate=+v.rate||+data.defRate||0;
      money[d-1]+= (+v.h1||0)*rate + (+v.h15||0)*rate*1.5 + (+v.h2||0)*rate*2 + (+v.h3||0)*rate*3;
    }
  }

  if (dailyChart){ dailyChart.destroy(); dailyChart=null; }
  var c=document.getElementById('dailyChart'); if(!c) return;
  var ctx=c.getContext('2d');

  var maxValue=0; for (i=0;i<money.length;i++){ if(money[i]>maxValue) maxValue=money[i]; }

  new Chart(ctx,{
    type:'bar',
    data:{
      labels: money.map(function(_,i){return String(i+1);}),
      datasets:[{
        data:money,
        backgroundColor: money.map(function(v){ return v===maxValue?'rgba(255,215,0,0.9)':'rgba(68,91,212,0.8)'; }),
        borderColor:'rgba(255,255,255,0.85)', borderWidth:1, borderRadius:4
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return '฿'+Number(c.raw).toLocaleString('th-TH',{minimumFractionDigits:2}); } } } },
      scales:{
        x:{ ticks:{color:'#fff', font:{size:10}}, grid:{color:'rgba(255,255,255,0.05)'} },
        y:{ beginAtZero:true, ticks:{ color:'#fff', callback:function(v){ return '฿'+v.toLocaleString('th-TH'); }, stepSize:Math.ceil((maxValue||1)/5)||500 }, grid:{ color:'rgba(255,255,255,0.1)' }, suggestedMax: maxValue>0?maxValue*1.2:1000 }
      }
    }
  });
}

function renderCalendarSummary(year,month){
  var data=dbLoad();
  var days=new Date(year,month,0).getDate();
  var firstDay=new Date(year,month-1,1).getDay();
  var daily=new Array(days);
  var i; for (i=0;i<days;i++){ daily[i]=0; }

  for (var date in data.entries){
    var sp=date.split('-'); var y=+sp[0], m=+sp[1], d=+sp[2];
    if (y===year && m===month){
      daily[d-1] = (+data.entries[date].h1||0) + (+data.entries[date].h15||0) + (+data.entries[date].h2||0) + (+data.entries[date].h3||0);
    }
  }

  var wrap=document.getElementById('calendar-summary'); wrap.innerHTML='';
  for (i=0;i<firstDay;i++){ var e=document.createElement('div'); e.className='day-cell off'; wrap.appendChild(e); }

  for (i=0;i<daily.length;i++){
    var h=daily[i], cls='none';
    if (h>0 && h<=2) cls='low';
    else if (h>2 && h<=4) cls='mid';
    else if (h>4) cls='high';
    var el=document.createElement('div'); el.className='day-cell '+cls;
    el.innerHTML='<div class="day-hour">'+(h>0?h.toFixed(1):'-')+'</div><div class="day-number">'+(i+1)+'</div>';
    wrap.appendChild(el);
  }
}

// ===== Inputs / Settings =====
document.addEventListener('gesturestart', function(e){ e.preventDefault(); }, false);

function refreshQuotaField(){
  var inDate=document.getElementById('in-date');
  var date=(inDate && inDate.value) ? inDate.value : ymd(new Date());
  var sp=date.split('-'); var y=+sp[0], m=+sp[1];
  var key=monthKeyOf(y,m); var d=dbLoad();
  var explicit=d.quotas[key];
  var el=document.getElementById('month-quota');
  if (el) el.value=(explicit && explicit>0) ? explicit : '';
}
var elDate=document.getElementById('in-date'); if (elDate){ elDate.addEventListener('change', refreshQuotaField); }

var elQuota=document.getElementById('month-quota');
if (elQuota){
  elQuota.addEventListener('change', function(){
    var date=(document.getElementById('in-date').value || ymd(new Date()));
    var sp=date.split('-'); var y=+sp[0], m=+sp[1];
    var v=parseFloat(document.getElementById('month-quota').value || '0');
    var key=monthKeyOf(y,m);
    if (v>0) dbSetQuota(key,v);
    else { var d=dbLoad(); delete d.quotas[key]; dbSave(d); }
    renderDashboard();
  });
}

function clearInputsToToday(){
  var ids=['h1','h15','h2','h3']; var i;
  for (i=0;i<ids.length;i++){ var e=document.getElementById(ids[i]); if(e) e.value=0; }
  var d=document.getElementById('in-date'); if (d) d.value=ymd(new Date());
  refreshQuotaField();
}
var btnClear=document.getElementById('btn-clear'); if (btnClear) btnClear.addEventListener('click', clearInputsToToday);

var btnSave=document.getElementById('btn-save');
if (btnSave){
  btnSave.addEventListener('click', function(){
    var date=document.getElementById('in-date').value || ymd(new Date());
    var rate=parseFloat(document.getElementById('in-rate').value || '0') || 0;
    var h1=+document.getElementById('h1').value || 0;
    var h15=+document.getElementById('h15').value || 0;
    var h2=+document.getElementById('h2').value || 0;
    var h3=+document.getElementById('h3').value || 0;

    if (rate<=0){ alert('⚠️ กรุณาไปตั้งค่าอัตราค่าจ้างที่หน้า ตั้งค่า'); return; }

    var sp=date.split('-'); var y=+sp[0], m=+sp[1]; var key=monthKeyOf(y,m);
    var quota=dbGetQuota(key); var data=dbLoad(); var monthHours=0; var dkey;
    for (dkey in data.entries){
      if (dkey.indexOf(key)===0){
        var vv=data.entries[dkey];
        monthHours+=(+vv.h1||0)+(+vv.h15||0)+(+vv.h2||0)+(+vv.h3||0);
      }
    }
    var add=h1+h15+h2+h3;
    var projected=monthHours+add;
    if (quota>0 && projected>quota){
      var ok=confirm('ชั่วโมงรวมเดือนนี้จะเป็น '+projected.toFixed(2)+' ชม. เกินโควตา '+quota.toFixed(1)+' ชม. ต้องการบันทึกต่อหรือไม่?');
      if (!ok) return;
    }
    var ok2=confirm('ยืนยันบันทึก OT วันที่ '+date+'\\n1×:'+h1+' 1.5×:'+h15+' 2×:'+h2+' 3×:'+h3);
    if (!ok2) return;

    dbUpsert(date,{rate:rate,h1:h1,h15:h15,h2:h2,h3:h3});
    alert('✅ บันทึกสำเร็จ!');
    if (dbGetSettings().autoReset) clearInputsToToday();
    renderDashboard();
  });
}

var btnDel=document.getElementById('btn-delete');
if (btnDel){
  btnDel.addEventListener('click', function(){
    var date=document.getElementById('in-date').value;
    if (!date){ alert('เลือกวันที่ก่อนลบ'); return; }
    if (confirm('ต้องการลบข้อมูลวันที่ '+date+' ?')){ dbRemove(date); renderDashboard(); }
  });
}

// ===== Navbar: Safari/PC safe =====
function activateTabFromEvent(e){
  if (e.type!=='click') e.preventDefault();
  var t=e.target; while (t && !t.classList.contains('tab')) t=t.parentNode;
  if (!t) return;

  var tabs=document.querySelectorAll('#footer-tabs .tab'); var i;
  for (i=0;i<tabs.length;i++) tabs[i].classList.remove('active');
  t.classList.add('active');

  var secs=document.querySelectorAll('section'); var j;
  for (j=0;j<secs.length;j++) secs[j].classList.remove('active');

  var view=t.getAttribute('data-view');
  var target=document.getElementById('view-'+view);
  if (target) target.classList.add('active');

  if (view==='dashboard') renderDashboard();
  if (view==='report'){ var yr=new Date().getFullYear(); renderMonthlyChart(yr); renderYearSummary(yr); }
  if (view==='record') refreshQuotaField();
}
var footer=document.getElementById('footer-tabs');
if (footer){
  footer.addEventListener('pointerup', activateTabFromEvent, {passive:false});
  footer.addEventListener('touchend', activateTabFromEvent, {passive:false});
  footer.addEventListener('click',     activateTabFromEvent, {passive:false});
}

// ===== Year aggregates =====
function renderYearSummary(y){
  var data=dbLoad(); var hours=0, money=0;
  for (var date in data.entries){
    var yr=+date.split('-')[0];
    if (yr===y){
      var v=data.entries[date];
      var rate=+v.rate||+data.defRate||0;
      var h1=+v.h1||0, h15=+v.h15||0, h2=+v.h2||0, h3=+v.h3||0;
      hours += h1+h15+h2+h3;
      money += h1*rate + h15*rate*1.5 + h2*rate*2 + h3*rate*3;
    }
  }
  var e1=document.getElementById('sum-year-hours'); if (e1) e1.textContent=hours.toFixed(2)+' ชม.';
  var e2=document.getElementById('sum-year-money'); if (e2) e2.textContent=thb(money);
}
function renderMonthlyChart(y){
  var data=dbLoad(); var monthly=new Array(12); var i; for (i=0;i<12;i++) monthly[i]=0;
  for (var date in data.entries){
    var sp=date.split('-'); var yr=+sp[0], m=+sp[1];
    if (yr===y){
      var v=data.entries[date]; var rate=+v.rate||+data.defRate||0;
      monthly[m-1]+= (+v.h1||0)*rate + (+v.h15||0)*rate*1.5 + (+v.h2||0)*rate*2 + (+v.h3||0)*rate*3;
    }
  }
  if (monthlyChart){ monthlyChart.destroy(); monthlyChart=null; }
  var c=document.getElementById('monthlyChart'); if (!c) return;
  monthlyChart = new Chart(c.getContext('2d'), {
    type:'bar',
    data:{ labels:['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],
           datasets:[{ data:monthly, backgroundColor:'rgba(255,206,86,.7)', borderColor:'rgba(255,255,255,0.85)', borderWidth:1 }] },
    options:{ responsive:true, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return '฿'+c.formattedValue; } } } },
              scales:{ x:{ ticks:{color:'#fff'}, grid:{color:'#444'} }, y:{ ticks:{color:'#fff'}, grid:{color:'#333'} } } }
  });
}

// ===== Init =====
function initUI(){
  var dInput=document.getElementById('in-date'); if (dInput && !dInput.value) dInput.value=ymd(new Date());
  var data=dbLoad();
  var rateInput=document.getElementById('in-rate');
  if (rateInput){
    rateInput.readOnly=true;
    if (data.defRate>0) rateInput.value=Number(data.defRate).toFixed(2);
    else rateInput.placeholder='กรุณาไปตั้งค่าอัตราค่าจ้างที่หน้า ตั้งค่า';
  }
  refreshQuotaField();
  var s=dbGetSettings();
  var t=document.getElementById('auto-reset-toggle');
  var q=document.getElementById('default-monthly-quota');
  if (t) t.checked=!!s.autoReset;
  if (q) q.value=s.defaultMonthlyQuota||30;

  renderDashboard();

  if ('serviceWorker' in navigator){
    try { navigator.serviceWorker.register('./sw.js'); } catch(e){}
  }
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', initUI);
else initUI();
