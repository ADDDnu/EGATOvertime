(function(){
  var PINKEY='ot_pin', SESSION='ot_session_auth_v1';
  function $(s){return document.querySelector(s);}
  if(!localStorage.getItem(PINKEY)) localStorage.setItem(PINKEY,'000000');
  $('#loginBtn').addEventListener('click',function(){
    var p=($('#pin').value||'').trim();
    if(p===localStorage.getItem(PINKEY)){
      sessionStorage.setItem(SESSION,'ok');
      location.href='index.html?v=1813';
    }else{ alert('PIN ไม่ถูกต้อง'); }
  });
  $('#changePin').addEventListener('click',function(){
    var cur=prompt('ใส่ PIN ปัจจุบัน'); if(cur===null)return;
    if(cur!==localStorage.getItem(PINKEY)) return alert('PIN ปัจจุบันไม่ถูกต้อง');
    var np=prompt('ใส่ PIN ใหม่ 6 หลัก'); if(np===null)return;
    if(!/^\d{6}$/.test(np)) return alert('ต้องเป็นตัวเลข 6 หลัก');
    localStorage.setItem(PINKEY,np); alert('บันทึก PIN ใหม่แล้ว');
  });
  $('#resetPin').addEventListener('click',function(){
    if(!confirm('รีเซ็ต PIN = 000000 ?')) return;
    localStorage.setItem(PINKEY,'000000'); alert('รีเซ็ตแล้ว');
  });
  $('#clearAll').addEventListener('click',function(){
    if(!confirm('ล้างข้อมูลทั้งหมดใน localStorage ?')) return;
    localStorage.clear(); alert('ล้างแล้ว');
  });
})();