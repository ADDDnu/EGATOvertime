
// EGAT OT v18.6 — Auto-reset toggle, Clear button, Default monthly quota
const VERSION='18.6';
const AUTH_KEY='ot_manual_auth_v1';
const DB_KEY='ot_manual_v1';
const PIN_KEY='ot_pin';

if(!location.pathname.endsWith('/login.html') && localStorage.getItem(AUTH_KEY)!=='ok'){
  location.href='login.html?v='+VERSION;
}

const db={ // persisted state
  load(){
    try{const d=JSON.parse(localStorage.getItem(DB_KEY))||{entries:{},defRate:0,quotas:{},settings:{}};
      d.entries=d.entries||{}; d.quotas=d.quotas||{}; d.settings=d.settings||{};
      if(typeof d.settings.autoReset==='undefined') d.settings.autoReset=true;
      if(typeof d.settings.defaultMonthlyQuota==='undefined') d.settings.defaultMonthlyQuota=30; // 30h default
      d.defRate=Number(d.defRate||0); return d;
    }catch{ return {entries:{},defRate:0,quotas:{},settings:{autoReset:true,defaultMonthlyQuota:30}}; }
  },
  save(d){ localStorage.setItem(DB_KEY, JSON.stringify(d)); },
  upsert(date,entry){ const d=db.load(); d.entries[date]=entry; db.save(d); },
  remove(date){ const d=db.load(); delete d.entries[date]; db.save(d); },
  setQuota(monthKey,hours){ const d=db.load(); d.quotas[monthKey]=Number(hours)||0; db.save(d); },
  getQuota(monthKey){ const d=db.load(); const q=d.quotas?.[monthKey]; return (q && q>0) ? q : Number(d.settings?.defaultMonthlyQuota||0); },
  getSettings(){ return db.load().settings; },
  setSettings(s){ const d=db.load(); d.settings={...d.settings, ...s}; db.save(d); }
};

const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const fmtMonth=(y,m)=>new Date(y,m-1,1).toLocaleDateString('th-TH',{year:'numeric',month:'long'});
const monthKeyOf=(y,m)=>`${y}-${pad(m)}`;
const thb=n=>'฿'+Number(n||0).toFixed(2);

let state={year:new Date().getFullYear(),month:new Date().getMonth()+1};
let dailyChart=null, monthlyChart=null;

function renderDashboard(){
  const data=db.load();
  const key=monthKeyOf(state.year,state.month);
  const rows=Object.entries(data.entries).filter(([d])=>d.startsWith(key)).map(([date,v])=>{
    const rate=+v.rate||+data.defRate||0;
    const h1=+v.h1||0,h15=+v.h15||0,h2=+v.h2||0,h3=+v.h3||0;
    const hours=h1+h15+h2+h3;
    const money=h1*rate+h15*rate*1.5+h2*rate*2+h3*rate*3;
    return {date,h1,h15,h2,h3,hours,money};
  });

  const sumH=rows.reduce((s,r)=>s+r.hours,0);
  const sumM=rows.reduce((s,r)=>s+r.money,0);
  const quota=db.getQuota(key);
  const left=Math.max(0,quota-sumH);
  const pct=quota>0?Math.min(100,Math.round(sumH/quota*100)):0;

  $('#quota-hours').textContent=quota.toFixed(1);
  $('#quota-default').textContent=(db.getSettings().defaultMonthlyQuota||0).toFixed(1);
  $('#quota-used').textContent=sumH.toFixed(1);
  $('#quota-left').textContent=left.toFixed(1);
  $('#quota-progress').style.width=pct+'%';
  $('#label-month').textContent=fmtMonth(state.year,state.month);
  $('#sum-month-hours').textContent=sumH.toFixed(2)+' ชม.';
  $('#sum-month-money').textContent=thb(sumM);

  const list=$('#quick-list'); list.innerHTML='';
  rows.forEach(r=>{
    const el=document.createElement('div'); el.className='item';
    el.innerHTML=`<div><b>${r.date}</b><div class="muted">1×:${r.h1}  1.5×:${r.h15}  2×:${r.h2}  3×:${r.h3}</div></div>
    <div><span class="pill">${r.hours.toFixed(2)} ชม.</span><span class="pill money">${thb(r.money)}</span></div>`;
    list.appendChild(el);
  });

  renderDailyChart(state.year,state.month);
  renderCalendarSummary(state.year,state.month);
}

function renderDailyChart(year,month){
  const data=db.load();
  const days=new Date(year,month,0).getDate();
  const money=Array(days).fill(0);
  for(const [date,v] of Object.entries(data.entries)){
    const [y,m,d]=date.split('-').map(Number);
    if(y===year&&m===month){
      const rate=+v.rate||+data.defRate||0;
      money[d-1]+= (+v.h1||0)*rate + (+v.h15||0)*rate*1.5 + (+v.h2||0)*rate*2 + (+v.h3||0)*rate*3;
    }
  }
  if(dailyChart){ dailyChart.destroy(); dailyChart=null; }
  const c=document.getElementById('dailyChart'); if(!c) return;
  const ctx=c.getContext('2d');
  const maxValue=Math.max(...money,0);
  dailyChart=new Chart(ctx,{type:'bar',data:{labels:money.map((_,i)=>String(i+1)),datasets:[{data:money,backgroundColor:money.map(v=>v===maxValue?'rgba(255,215,0,0.9)':'rgba(68,91,212,0.8)'),borderColor:'rgba(255,255,255,0.85)',borderWidth:1,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'฿'+Number(c.raw).toLocaleString('th-TH',{minimumFractionDigits:2})}}},
      scales:{x:{ticks:{color:'#fff',font:{size:10}},grid:{color:'rgba(255,255,255,0.05)'}},y:{beginAtZero:true,ticks:{color:'#fff',callback:v=>'฿'+v.toLocaleString('th-TH'),stepSize:Math.ceil(maxValue/5)||500},grid:{color:'rgba(255,255,255,0.1)'} ,suggestedMax:maxValue>0?maxValue*1.2:1000}},
      animation:{duration:500,easing:'easeOutQuart'}});
}

function renderCalendarSummary(year,month){
  const data=db.load();
  const days=new Date(year,month,0).getDate();
  const firstDay=new Date(year,month-1,1).getDay();
  const daily=Array(days).fill(0);
  for(const [date,v] of Object.entries(data.entries)){
    const [y,m,d]=date.split('-').map(Number);
    if(y===year&&m===month) daily[d-1]=(+v.h1||0)+(+v.h15||0)+(+v.h2||0)+(+v.h3||0);
  }
  const wrap=document.getElementById('calendar-summary'); wrap.innerHTML='';
  for(let i=0;i<firstDay;i++){ const e=document.createElement('div'); e.className='day-cell off'; wrap.appendChild(e); }
  daily.forEach((h,i)=>{
    let cls='none'; if(h>0&&h<=2) cls='low'; else if(h>2&&h<=4) cls='mid'; else if(h>4) cls='high';
    const el=document.createElement('div'); el.className=`day-cell ${cls}`;
    el.innerHTML=`<div class="day-hour">${h>0?h.toFixed(1):'-'}</div><div class="day-number">${i+1}</div>`;
    wrap.appendChild(el);
  });
}

function renderYearSummary(y){
  const data=db.load();
  let hours=0,money=0;
  for(const [date,v] of Object.entries(data.entries)){
    const [yr]=date.split('-').map(Number);
    if(yr===y){
      const rate=+v.rate||+data.defRate||0;
      const h1=+v.h1||0,h15=+v.h15||0,h2=+v.h2||0,h3=+v.h3||0;
      hours+=h1+h15+h2+h3;
      money+=h1*rate+h15*rate*1.5+h2*rate*2+h3*rate*3;
    }
  }
  document.getElementById('sum-year-hours').textContent=hours.toFixed(2)+' ชม.';
  document.getElementById('sum-year-money').textContent=thb(money);
}
function renderMonthlyChart(y){
  const data=db.load(); const monthly=Array(12).fill(0);
  for(const [date,v] of Object.entries(data.entries)){
    const [yr,m]=date.split('-').map(Number);
    if(yr===y){
      const rate=+v.rate||+data.defRate||0;
      monthly[m-1]+= (+v.h1||0)*rate + (+v.h15||0)*rate*1.5 + (+v.h2||0)*rate*2 + (+v.h3||0)*rate*3;
    }
  }
  if(monthlyChart){ monthlyChart.destroy(); monthlyChart=null; }
  const c=document.getElementById('monthlyChart'); if(!c) return;
  monthlyChart=new Chart(c.getContext('2d'),{type:'bar',data:{labels:['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],datasets:[{data:monthly,backgroundColor:'rgba(255,206,86,.7)',borderColor:'rgba(255,255,255,0.85)',borderWidth:1}]},options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'฿'+c.formattedValue}}},scales:{x:{ticks:{color:'#fff'},grid:{color:'#444'}},y:{ticks:{color:'#fff'},grid:{color:'#333'}}}});
}

// ---- Settings ----
document.getElementById('btn-salary-calc')?.addEventListener('click',()=>{
  const s=parseFloat(document.getElementById('salary').value||'0'); if(!s) return alert('กรุณากรอกเงินเดือน');
  const rate=(s/210).toFixed(2);
  document.getElementById('salary-result').textContent='อัตราต่อชั่วโมง = '+rate+' บาท/ชม.';
  document.getElementById('default-rate').value=rate;
});
document.getElementById('btn-save-rate')?.addEventListener('click',()=>{
  const r=parseFloat(document.getElementById('default-rate').value||'0');
  const d=db.load(); d.defRate=r; db.save(d);
  alert('บันทึกค่าเริ่มต้นเรียบร้อย');
});

function initSettingsUI(){
  const s=db.getSettings();
  const t=document.getElementById('auto-reset-toggle');
  const q=document.getElementById('default-monthly-quota');
  if(t) t.checked = !!s.autoReset;
  if(q) q.value = (s.defaultMonthlyQuota||0);
}
document.getElementById('auto-reset-toggle')?.addEventListener('change',(e)=>{
  db.setSettings({autoReset: e.target.checked});
});
document.getElementById('btn-save-default-quota')?.addEventListener('click',()=>{
  const v=parseFloat(document.getElementById('default-monthly-quota').value||'0')||0;
  db.setSettings({defaultMonthlyQuota: v});
  alert('บันทึกโควตาเริ่มต้นรายเดือนเรียบร้อย');
  renderDashboard();
});

document.getElementById('btn-change-pin')?.addEventListener('click',()=>{
  const cur=localStorage.getItem(PIN_KEY)||'000000';
  const oldp=document.getElementById('old-pin').value.trim(), newp=document.getElementById('new-pin').value.trim();
  if(oldp!==cur) return alert('PIN ปัจจุบันไม่ถูกต้อง');
  if(newp.length!==6) return alert('PIN ใหม่ต้องมี 6 หลัก');
  localStorage.setItem(PIN_KEY,newp); alert('เปลี่ยนรหัสเรียบร้อย');
});
document.getElementById('btn-reset-pin')?.addEventListener('click',()=>{
  if(confirm('รีเซ็ต PIN เป็น 000000 ?')){ localStorage.setItem(PIN_KEY,'000000'); alert('รีเซ็ตเรียบร้อย'); }
});
document.getElementById('btn-logout')?.addEventListener('click',()=>{
  if(confirm('ออกจากระบบ?')){ localStorage.removeItem(AUTH_KEY); location.href='login.html?v='+VERSION; }
});
document.getElementById('btn-export')?.addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(db.load(),null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='EGAT_OT_Backup.json'; a.click();
});
document.getElementById('btn-import')?.addEventListener('click',()=>{
  const f=document.getElementById('import-file').files[0]; if(!f) return alert('กรุณาเลือกไฟล์');
  const r=new FileReader(); r.onload=e=>{ try{ db.save(JSON.parse(e.target.result)); alert('นำเข้าข้อมูลเรียบร้อย'); renderDashboard(); }catch{ alert('ไฟล์ไม่ถูกต้อง'); } };
  r.readAsText(f);
});
document.getElementById('btn-update-app')?.addEventListener('click',()=>{
  if(confirm('ล้าง Cache และโหลดใหม่?')){ caches?.keys().then(keys=>keys.forEach(k=>caches.delete(k))).finally(()=>location.reload(true)); }
});

// ---- Record + Quota ----
function refreshQuotaField(){
  const date=document.getElementById('in-date').value || ymd(new Date());
  const [y,m]=date.split('-').map(Number);
  const monthKey=monthKeyOf(y,m);
  const d=db.load();
  const explicit=d.quotas?.[monthKey];
  document.getElementById('month-quota').value = (explicit && explicit>0) ? explicit : '';
}
document.getElementById('in-date')?.addEventListener('change', refreshQuotaField);
document.getElementById('month-quota')?.addEventListener('change',()=>{
  const date=document.getElementById('in-date').value || ymd(new Date());
  const [y,m]=date.split('-').map(Number);
  const v=parseFloat(document.getElementById('month-quota').value||'0');
  const key=monthKeyOf(y,m);
  if(v>0) db.setQuota(key, v);
  else{
    const d=db.load(); delete d.quotas[key]; db.save(d);
  }
  renderDashboard();
});

function clearInputsToToday(){
  document.getElementById('h1').value=0;
  document.getElementById('h15').value=0;
  document.getElementById('h2').value=0;
  document.getElementById('h3').value=0;
  document.getElementById('in-date').value = ymd(new Date());
  refreshQuotaField();
}
document.getElementById('btn-clear')?.addEventListener('click', clearInputsToToday);

document.getElementById('btn-save')?.addEventListener('click',()=>{
  const date=document.getElementById('in-date').value||ymd(new Date());
  const rate=parseFloat(document.getElementById('in-rate').value||'0')||0;
  const h1=+document.getElementById('h1').value||0;
  const h15=+document.getElementById('h15').value||0;
  const h2=+document.getElementById('h2').value||0;
  const h3=+document.getElementById('h3').value||0;
  if(rate<=0){ alert('⚠️ กรุณาไปตั้งค่าอัตราค่าจ้างที่หน้า ตั้งค่า'); return; }

  const [y,m]=date.split('-').map(Number);
  const key=monthKeyOf(y,m); const quota=db.getQuota(key);
  const data=db.load();
  let monthHours=0; for(const [d,v] of Object.entries(data.entries)){ if(d.startsWith(key)) monthHours+=(+v.h1||0)+(+v.h15||0)+(+v.h2||0)+(+v.h3||0); }
  const add=h1+h15+h2+h3; const projected=monthHours+add;
  if(quota>0 && projected>quota){
    if(!confirm(`ชั่วโมงรวมเดือนนี้จะเป็น ${projected.toFixed(2)} ชม. เกินโควตา ${quota.toFixed(1)} ชม. ต้องการบันทึกต่อหรือไม่?`)) return;
  }

  if(!confirm(`ยืนยันบันทึก OT วันที่ ${date}\n1×:${h1} 1.5×:${h15} 2×:${h2} 3×:${h3}`)) return;
  db.upsert(date,{rate,h1,h15,h2,h3});
  alert('✅ บันทึกสำเร็จ!');

  const auto = !!db.getSettings().autoReset;
  if(auto) clearInputsToToday();
  renderDashboard();
});

document.getElementById('btn-delete')?.addEventListener('click',()=>{
  const date=document.getElementById('in-date').value; if(!date) return alert('เลือกวันที่ก่อนลบ');
  if(confirm('ต้องการลบข้อมูลวันที่ '+date+' ?')){ db.remove(date); renderDashboard(); }
});

// ---- Navigation ----
document.getElementById('btn-month-prev')?.addEventListener('click',()=>{ state.month--; if(state.month<1){ state.month=12; state.year--; } renderDashboard(); });
document.getElementById('btn-month-next')?.addEventListener('click',()=>{ state.month++; if(state.month>12){ state.month=1; state.year++; } renderDashboard(); });

// ---- Init ----
function initUI(){
  const dInput=document.getElementById('in-date'); if(dInput && !dInput.value) dInput.value=ymd(new Date());
  const data=db.load(); const rateInput=document.getElementById('in-rate');
  if(rateInput){ rateInput.readOnly=true; if(data.defRate>0) rateInput.value=Number(data.defRate).toFixed(2); else rateInput.placeholder='กรุณาไปตั้งค่าอัตราค่าจ้างที่หน้า ตั้งค่า'; }
  refreshQuotaField();
  initSettingsUI();

  const tabs=document.querySelectorAll('.tab'); const secs=document.querySelectorAll('section');
  tabs.forEach(tab=>{
    tab.addEventListener('click',()=>{
      tabs.forEach(t=>t.classList.remove('active')); tab.classList.add('active');
      secs.forEach(s=>s.classList.remove('active'));
      const target=document.querySelector('#view-'+tab.dataset.view); if(target) target.classList.add('active');
      if(tab.dataset.view==='dashboard') renderDashboard();
      if(tab.dataset.view==='report'){ const y=new Date().getFullYear(); renderYearSummary(y); renderMonthlyChart(y); }
      if(tab.dataset.view==='record') refreshQuotaField();
    });
  });

  document.querySelector('.tab[data-view="dashboard"]')?.classList.add('active');
  document.querySelector('#view-dashboard')?.classList.add('active');
  renderDashboard();

  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v='+VERSION).catch(()=>{});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initUI); else initUI();
