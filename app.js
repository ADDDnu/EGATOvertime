var STORAGE_KEY = "otcAppData_v1";

var appData = null;
var currentMonth = new Date(); // ใช้ year/month
var pendingRecord = null;

// ========== SMALL HELPERS ==========

function pad2(num) {
  var n = Number(num);
  if (isNaN(n)) return "00";
  return n < 10 ? "0" + n : String(n);
}

function keyFromDate(date) {
  var y = date.getFullYear();
  var m = pad2(date.getMonth() + 1);
  var d = pad2(date.getDate());
  return y + "-" + m + "-" + d;
}

function keyToDisplay(key) {
  var parts = key.split("-");
  if (parts.length !== 3) return key;
  var y = parts[0];
  var m = parts[1];
  var d = parts[2];
  return pad2(d) + "-" + pad2(m) + "-" + y;
}

function displayToKey(displayStr) {
  if (!displayStr) return "";
  var parts = displayStr.split("-");
  if (parts.length !== 3) return "";
  var d = pad2(parts[0]);
  var m = pad2(parts[1]);
  var y = parts[2];
  if (!y || isNaN(Number(d)) || isNaN(Number(m)) || isNaN(Number(y))) return "";
  return y + "-" + m + "-" + d;
}

function keyToDate(key) {
  var parts = key.split("-");
  if (parts.length !== 3) return null;
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var d = Number(parts[2]);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatHours(num) {
  if (!num) return "0";
  var fixed = num.toFixed(2);
  if (fixed.slice(-2) === "00") {
    return String(parseInt(fixed, 10));
  }
  return fixed;
}

function formatMoney(num) {
  return Math.round(num || 0).toLocaleString("th-TH");
}

function getThaiMonthName(index) {
  var names = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม"
  ];
  return names[index] || "";
}

// ========== DATA HELPERS ==========

function getDefaultData() {
  return {
    user: { name: "", pin: "" },
    settings: { quotaHours: 30, baseRate: 0 },
    records: {} // key: YYYY-MM-DD -> {h1,h15,h2,h3}
  };
}

function loadData() {
  var raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    raw = null;
  }
  if (!raw) {
    appData = getDefaultData();
    return;
  }
  try {
    var parsed = JSON.parse(raw);
    appData = getDefaultData();
    if (parsed.user) appData.user = parsed.user;
    if (parsed.settings) appData.settings = parsed.settings;
    if (parsed.records) appData.records = parsed.records;
  } catch (e2) {
    console.error("Invalid stored data, reset.", e2);
    appData = getDefaultData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error("Cannot save data", e);
  }
}

function resetAllData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
  appData = getDefaultData();
}

// ========== STATS HELPERS ==========

function getMonthStats(year, monthIndex) {
  var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  var daily = [];
  var i;
  for (i = 0; i < daysInMonth; i++) {
    daily.push({ rawHours: 0, weightedHours: 0, money: 0 });
  }

  var baseRate = Number(appData.settings.baseRate || 0);

  for (var key in appData.records) {
    if (!appData.records.hasOwnProperty(key)) continue;
    var d = keyToDate(key);
    if (!d) continue;
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      var rec = appData.records[key];
      var h1 = Number(rec.h1 || 0);
      var h15 = Number(rec.h15 || 0);
      var h2 = Number(rec.h2 || 0);
      var h3 = Number(rec.h3 || 0);
      var raw = h1 + h15 + h2 + h3;
      var weighted = h1 * 1 + h15 * 1.5 + h2 * 2 + h3 * 3;
      var money = weighted * baseRate;

      var idx = d.getDate() - 1;
      daily[idx].rawHours += raw;
      daily[idx].weightedHours += weighted;
      daily[idx].money += money;
    }
  }

  var totalRaw = 0;
  var totalWeighted = 0;
  var totalMoney = 0;
  for (i = 0; i < daily.length; i++) {
    totalRaw += daily[i].rawHours;
    totalWeighted += daily[i].weightedHours;
    totalMoney += daily[i].money;
  }

  return { daily: daily, totalRaw: totalRaw, totalWeighted: totalWeighted, totalMoney: totalMoney };
}

function getYearStats(year) {
  var months = [];
  var m;
  for (m = 0; m < 12; m++) {
    months.push(getMonthStats(year, m));
  }
  return months;
}

// ========== UI UPDATERS ==========

function updateLoginGreeting() {
  var el = document.getElementById("loginGreeting");
  if (!el) return;
  if (appData.user && appData.user.name) {
    el.textContent = "สวัสดี " + appData.user.name;
  } else {
    el.textContent = "สวัสดี ผู้ใช้ใหม่";
  }
}

function updateHeaderUsername() {
  var el = document.getElementById("headerUsername");
  if (!el) return;
  el.textContent = appData.user && appData.user.name ? appData.user.name : "";
}

function renderDashboard() {
  var year = currentMonth.getFullYear();
  var monthIndex = currentMonth.getMonth();
  var stats = getMonthStats(year, monthIndex);

  var monthLabel = document.getElementById("currentMonthLabel");
  if (monthLabel) {
    monthLabel.textContent = getThaiMonthName(monthIndex) + " " + (year + 543);
  }

  var dashHours = document.getElementById("dashTotalHours");
  var dashMoney = document.getElementById("dashTotalMoney");
  if (dashHours) dashHours.textContent = formatHours(stats.totalRaw);
  if (dashMoney) dashMoney.textContent = formatMoney(stats.totalMoney);

  var quota = Number(appData.settings.quotaHours || 0);
  var used = stats.totalRaw;
  var quotaLabel = document.getElementById("quotaUsedLabel");
  if (quotaLabel) {
    quotaLabel.textContent = formatHours(used) + " / " + formatHours(quota);
  }
  var quotaFill = document.getElementById("quotaFill");
  if (quotaFill) {
    var ratio = quota > 0 ? Math.min(used / quota, 1) : 0;
    quotaFill.style.width = (ratio * 100) + "%";
  }

  renderDailyBarChart(stats);
  renderCalendar(stats);
}

function renderDailyBarChart(stats) {
  var container = document.getElementById("dailyBarChart");
  if (!container) return;
  container.innerHTML = "";

  var max = 0;
  var i;
  for (i = 0; i < stats.daily.length; i++) {
    if (stats.daily[i].rawHours > max) max = stats.daily[i].rawHours;
  }

  if (max === 0) {
    var msg = document.createElement("div");
    msg.style.fontSize = "0.8rem";
    msg.style.color = "#888";
    msg.textContent = "ยังไม่มีข้อมูลในเดือนนี้";
    container.appendChild(msg);
    return;
  }

  // กำหนดจำนวนเส้นแกน Y ประมาณ 4 เส้น
  var steps = 4;
  var stepValue = Math.max(1, Math.ceil(max / steps));
  var topValue = stepValue * steps;

  // สร้างโครงกราฟ: แกน Y + ส่วนแท่งกราฟ
  var yAxis = document.createElement("div");
  yAxis.className = "y-axis";

  for (i = steps; i >= 0; i--) {
    var tick = document.createElement("div");
    tick.className = "y-tick";
    tick.textContent = formatHours(i * stepValue);
    yAxis.appendChild(tick);
  }

  var barsContainer = document.createElement("div");
  barsContainer.className = "bar-chart-bars";

  for (i = 0; i < stats.daily.length; i++) {
    var d = stats.daily[i];
    var wrapper = document.createElement("div");
    wrapper.className = "bar-wrapper";

    var bar = document.createElement("div");
    bar.className = "bar";
    var heightPercent = (d.rawHours / topValue) * 100;
    bar.style.height = heightPercent + "%";

    var label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = i + 1;

    wrapper.appendChild(bar);
    wrapper.appendChild(label);
    barsContainer.appendChild(wrapper);
  }

  container.appendChild(yAxis);
  container.appendChild(barsContainer);
}

function renderCalendar(stats) {
  var grid = document.getElementById("calendarGrid");
  if (!grid) return;
  grid.innerHTML = "";

  var year = currentMonth.getFullYear();
  var monthIndex = currentMonth.getMonth();
  var firstDay = new Date(year, monthIndex, 1).getDay(); // 0=อาทิตย์
  var daysInMonth = stats.daily.length;

  var startOffset = firstDay; // เริ่มต้นที่วันอาทิตย์

  var i;
  for (i = 0; i < startOffset; i++) {
    var emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell calendar-cell-empty";
    grid.appendChild(emptyCell);
  }

  for (var day = 1; day <= daysInMonth; day++) {
    var cell = document.createElement("div");
    cell.className = "calendar-cell";

    var idx = day - 1;
    var rawHours = stats.daily[idx].rawHours;

    if (rawHours > 0 && rawHours <= 5) cell.classList.add("cell-low");
    else if (rawHours > 5 && rawHours <= 10) cell.classList.add("cell-medium");
    else if (rawHours > 10) cell.classList.add("cell-high");

    var dateLabel = document.createElement("div");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = day;

    var hoursLabel = document.createElement("div");
    hoursLabel.className = "calendar-hours";
    hoursLabel.textContent = rawHours > 0 ? formatHours(rawHours) : "";

    cell.appendChild(dateLabel);
    cell.appendChild(hoursLabel);

    var key = year + "-" + pad2(monthIndex + 1) + "-" + pad2(day);
    cell.setAttribute("data-key", key);

    cell.addEventListener("click", (function(k) {
      return function () {
        var recordDate = document.getElementById("recordDate");
        if (recordDate) {
          recordDate.value = keyToDisplay(k);
          loadRecordForCurrentDate();
          updateRecordQuota();
        }
        switchTab("record");
      };
    })(key));

    grid.appendChild(cell);
  }
}

function updateRecordQuota() {
  var recordDate = document.getElementById("recordDate");
  var totalEl = document.getElementById("recordQuotaTotal");
  var usedEl = document.getElementById("recordQuotaUsed");
  var remainEl = document.getElementById("recordQuotaRemain");

  if (!recordDate || !totalEl || !usedEl || !remainEl) return;

  var key = displayToKey((recordDate.value || "").trim());
  if (!key) {
    totalEl.textContent = "0";
    usedEl.textContent = "0";
    remainEl.textContent = "0";
    return;
  }

  var d = keyToDate(key);
  if (!d) {
    totalEl.textContent = "0";
    usedEl.textContent = "0";
    remainEl.textContent = "0";
    return;
  }

  var stats = getMonthStats(d.getFullYear(), d.getMonth());
  var quota = Number(appData.settings.quotaHours || 0);
  var used = stats.totalRaw;
  var remain = Math.max(quota - used, 0);

  totalEl.textContent = formatHours(quota);
  usedEl.textContent = formatHours(used);
  remainEl.textContent = formatHours(remain);
}

function loadRecordForCurrentDate() {
  var recordDate = document.getElementById("recordDate");
  if (!recordDate || !recordDate.value) return;

  var key = displayToKey((recordDate.value || "").trim());
  if (!key) return;

  var rec = appData.records[key] || { h1: 0, h15: 0, h2: 0, h3: 0 };

  document.getElementById("hours1x").value = rec.h1 > 0 ? String(rec.h1) : "";
  document.getElementById("hours15x").value = rec.h15 > 0 ? String(rec.h15) : "";
  document.getElementById("hours2x").value = rec.h2 > 0 ? String(rec.h2) : "";
  document.getElementById("hours3x").value = rec.h3 > 0 ? String(rec.h3) : "";
}

function renderReport() {
  var select = document.getElementById("reportYearSelect");
  if (!select || !select.value) return;
  var year = Number(select.value);

  var yearStats = getYearStats(year);
  var barContainer = document.getElementById("yearBarChart");
  barContainer.innerHTML = "";

  var max = 0;
  var i;
  for (i = 0; i < yearStats.length; i++) {
    if (yearStats[i].totalRaw > max) max = yearStats[i].totalRaw;
  }

  if (max === 0) {
    var msg = document.createElement("div");
    msg.style.fontSize = "0.8rem";
    msg.style.color = "#888";
    msg.textContent = "ยังไม่มีข้อมูลในปีนี้";
    barContainer.appendChild(msg);
  } else {
    var steps = 4;
    var stepValue = Math.max(1, Math.ceil(max / steps));
    var topValue = stepValue * steps;

    var yAxis = document.createElement("div");
    yAxis.className = "y-axis";

    for (i = steps; i >= 0; i--) {
      var tick = document.createElement("div");
      tick.className = "y-tick";
      tick.textContent = formatHours(i * stepValue);
      yAxis.appendChild(tick);
    }

    var barsContainer = document.createElement("div");
    barsContainer.className = "bar-chart-bars";

    for (i = 0; i < yearStats.length; i++) {
      var m = yearStats[i];
      var wrap = document.createElement("div");
      wrap.className = "bar-wrapper";

      var bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = (m.totalRaw / topValue) * 100 + "%";

      var label = document.createElement("div");
      label.className = "bar-label";
      label.textContent = (i + 1);

      wrap.appendChild(bar);
      wrap.appendChild(label);
      barsContainer.appendChild(wrap);
    }

    barContainer.appendChild(yAxis);
    barContainer.appendChild(barsContainer);
  }

  var tbody = document.getElementById("reportTableBody");
  tbody.innerHTML = "";
  for (i = 0; i < yearStats.length; i++) {
    var ms = yearStats[i];
    var tr = document.createElement("tr");
    var tdMonth = document.createElement("td");
    var tdHours = document.createElement("td");
    var tdMoney = document.createElement("td");

    tdMonth.textContent = getThaiMonthName(i);
    tdHours.textContent = formatHours(ms.totalRaw);
    tdMoney.textContent = formatMoney(ms.totalMoney);

    tr.appendChild(tdMonth);
    tr.appendChild(tdHours);
    tr.appendChild(tdMoney);
    tbody.appendChild(tr);
  }
}

function updateSettingsUI() {
  var quotaInput = document.getElementById("settingQuota");
  var rateInput = document.getElementById("settingBaseRate");
  if (quotaInput) {
    if (appData.settings && appData.settings.quotaHours != null) {
      quotaInput.value = String(appData.settings.quotaHours);
    } else {
      quotaInput.value = "30";
    }
  }
  if (rateInput) {
    if (appData.settings && appData.settings.baseRate != null) {
      rateInput.value = String(appData.settings.baseRate);
    } else {
      rateInput.value = "0";
    }
  }
}

function refreshReportYearOptions() {
  var select = document.getElementById("reportYearSelect");
  if (!select) return;

  var yearsSet = {};
  var currentYear = new Date().getFullYear();
  yearsSet[currentYear] = true;

  for (var key in appData.records) {
    if (!appData.records.hasOwnProperty(key)) continue;
    var d = keyToDate(key);
    if (d) yearsSet[d.getFullYear()] = true;
  }

  var years = [];
  for (var y in yearsSet) {
    if (yearsSet.hasOwnProperty(y)) years.push(Number(y));
  }
  years.sort(function (a, b) { return a - b; });

  var previous = select.value;
  select.innerHTML = "";
  for (var i = 0; i < years.length; i++) {
    var opt = document.createElement("option");
    opt.value = String(years[i]);
    opt.textContent = String(years[i] + 543);
    select.appendChild(opt);
  }

  if (years.indexOf(Number(previous)) !== -1) {
    select.value = previous;
  }
}

// ========== TABS ==========

function switchTab(name) {
  var panels = document.querySelectorAll(".tab-panel");
  for (var i = 0; i < panels.length; i++) {
    panels[i].classList.remove("tab-active");
  }
  var buttons = document.querySelectorAll(".tab-button");
  for (i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("tab-button-active");
  }

  var panel = document.getElementById("tab-" + name);
  if (panel) panel.classList.add("tab-active");

  var btn = document.querySelector('.tab-button[data-tab="' + name + '"]');
  if (btn) btn.classList.add("tab-button-active");
}

// ========== MODALS ==========

function openRegisterModal() {
  var overlay = document.getElementById("registerOverlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");

  var regName = document.getElementById("regName");
  var regPin = document.getElementById("regPin");
  if (regName) regName.value = appData.user && appData.user.name ? appData.user.name : "";
  if (regPin) regPin.value = "";
}

function closeRegisterModal() {
  var overlay = document.getElementById("registerOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
}

function openConfirmModal(data) {
  pendingRecord = data;
  var dateSpan = document.getElementById("confirmDate");
  if (dateSpan) dateSpan.textContent = keyToDisplay(data.dateKey);

  document.getElementById("confirm1x").textContent = formatHours(data.h1);
  document.getElementById("confirm15x").textContent = formatHours(data.h15);
  document.getElementById("confirm2x").textContent = formatHours(data.h2);
  document.getElementById("confirm3x").textContent = formatHours(data.h3);
  document.getElementById("confirmTotalHours").textContent = formatHours(data.rawHours);
  document.getElementById("confirmTotalMoney").textContent = formatMoney(data.money);

  var overlay = document.getElementById("confirmOverlay");
  if (overlay) overlay.classList.remove("hidden");
}

function closeConfirmModal() {
  pendingRecord = null;
  var overlay = document.getElementById("confirmOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// ========== EVENT HANDLERS ==========

function setupEventHandlers() {
    // logout
  var logoutBtn = document.getElementById("logoutButton");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      // กลับไปหน้า login โดยไม่ลบข้อมูล
      var loginScreen = document.getElementById("loginScreen");
      var mainScreen = document.getElementById("mainScreen");
      if (mainScreen) mainScreen.classList.add("screen-hidden");
      if (loginScreen) {
        loginScreen.classList.remove("screen-hidden");
        loginScreen.classList.add("screen-active");
      }
      var pinInput = document.getElementById("loginPin");
      if (pinInput) pinInput.value = "";
    });
  }

// login
  document.getElementById("loginButton").addEventListener("click", handleLogin);
  document.getElementById("loginPin").addEventListener("keyup", function (e) {
    if (e.key === "Enter") handleLogin();
  });

  document.getElementById("openRegister").addEventListener("click", function () {
    openRegisterModal();
  });

  document.getElementById("registerCancel").addEventListener("click", function () {
    closeRegisterModal();
  });

  document.getElementById("registerConfirm").addEventListener("click", handleRegister);

  document.getElementById("clearDataButton").addEventListener("click", function () {
    if (confirm("ต้องการล้างข้อมูลทั้งหมด และเริ่มใหม่เหมือนติดตั้งครั้งแรกหรือไม่?")) {
      resetAllData();
      saveData();
      updateLoginGreeting();
      updateHeaderUsername();
      updateSettingsUI();
      refreshReportYearOptions();
      renderDashboard();
      renderReport();
      closeRegisterModal();
      alert("ล้างข้อมูลเรียบร้อยแล้ว");
    }
  });

  // month nav
  document.getElementById("prevMonth").addEventListener("click", function () {
    var d = new Date(currentMonth.getTime());
    d.setMonth(d.getMonth() - 1);
    currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderDashboard();
  });

  document.getElementById("nextMonth").addEventListener("click", function () {
    var d = new Date(currentMonth.getTime());
    d.setMonth(d.getMonth() + 1);
    currentMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderDashboard();
  });

  // tab buttons
  var tabButtons = document.querySelectorAll(".tab-button");
  for (var i = 0; i < tabButtons.length; i++) {
    tabButtons[i].addEventListener("click", function () {
      var tab = this.getAttribute("data-tab");
      switchTab(tab);
      if (tab === "record") updateRecordQuota();
      if (tab === "report") renderReport();
    });
  }

  // record
  document.getElementById("recordDate").addEventListener("change", function () {
    loadRecordForCurrentDate();
    updateRecordQuota();
  });

  document.getElementById("recordClear").addEventListener("click", function () {
    document.getElementById("hours1x").value = "";
    document.getElementById("hours15x").value = "";
    document.getElementById("hours2x").value = "";
    document.getElementById("hours3x").value = "";
  });

  document.getElementById("recordSave").addEventListener("click", handleRecordSave);

  document.getElementById("confirmCancel").addEventListener("click", function () {
    closeConfirmModal();
  });

  document.getElementById("confirmOk").addEventListener("click", function () {
    if (!pendingRecord) {
      closeConfirmModal();
      return;
    }
    var dateKey = pendingRecord.dateKey;
    var h1 = pendingRecord.h1;
    var h15 = pendingRecord.h15;
    var h2 = pendingRecord.h2;
    var h3 = pendingRecord.h3;

    if (h1 === 0 && h15 === 0 && h2 === 0 && h3 === 0) {
      delete appData.records[dateKey];
    } else {
      appData.records[dateKey] = { h1: h1, h15: h15, h2: h2, h3: h3 };
    }
    saveData();
    closeConfirmModal();

    // เคลียร์ค่าฟิลด์ชั่วโมงหลังยืนยัน
    document.getElementById("hours1x").value = "";
    document.getElementById("hours15x").value = "";
    document.getElementById("hours2x").value = "";
    document.getElementById("hours3x").value = "";

    renderDashboard();
    updateRecordQuota();
    refreshReportYearOptions();
    renderReport();
    alert("บันทึกเรียบร้อยแล้ว");
  });

  // report year
  document.getElementById("reportYearSelect").addEventListener("change", function () {
    renderReport();
  });

  // settings save
  document.getElementById("settingQuota").addEventListener("change", function () {
    var val = Number(document.getElementById("settingQuota").value || 0);
    appData.settings.quotaHours = val >= 0 ? val : 0;
    saveData();
    renderDashboard();
    updateRecordQuota();
  });

  document.getElementById("settingBaseRate").addEventListener("change", function () {
    var val = Number(document.getElementById("settingBaseRate").value || 0);
    appData.settings.baseRate = val >= 0 ? val : 0;
    saveData();
    renderDashboard();
    renderReport();
  });

  // backup export
  document.getElementById("exportBackup").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var now = new Date();
    var ts = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate());
    a.href = url;
    a.download = "otc_backup_" + ts + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // backup import
  document.getElementById("importBackup").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var imported = JSON.parse(ev.target.result);
        if (!imported || typeof imported !== "object") throw new Error("invalid");
        appData = getDefaultData();
        if (imported.user) appData.user = imported.user;
        if (imported.settings) appData.settings = imported.settings;
        if (imported.records) appData.records = imported.records;
        saveData();
        updateLoginGreeting();
        updateHeaderUsername();
        updateSettingsUI();
        refreshReportYearOptions();
        renderDashboard();

        var recordDate = document.getElementById("recordDate");
        if (recordDate && !recordDate.value) {
          var todayKey = keyFromDate(new Date());
          recordDate.value = keyToDisplay(todayKey);
        }
        loadRecordForCurrentDate();
        updateRecordQuota();
        renderReport();
        alert("นำเข้าข้อมูลเรียบร้อยแล้ว");
      } catch (err) {
        console.error(err);
        alert("ไฟล์ไม่ถูกต้อง");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  // change password
  document.getElementById("changePasswordBtn").addEventListener("click", function () {
    var oldPw = document.getElementById("oldPassword").value.trim();
    var newPw = document.getElementById("newPassword").value.trim();
    var confirmPw = document.getElementById("confirmNewPassword").value.trim();

    if (!appData.user.pin) {
      alert("ยังไม่มีรหัสผ่าน กรุณาสมัครใช้งานก่อน");
      return;
    }

    if (oldPw !== appData.user.pin) {
      alert("รหัสผ่านเดิมไม่ถูกต้อง");
      return;
    }

    if (!/^[0-9]{6}$/.test(newPw)) {
      alert("รหัสใหม่ต้องเป็นตัวเลข 6 หลัก");
      return;
    }

    if (newPw !== confirmPw) {
      alert("ยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    appData.user.pin = newPw;
    saveData();
    document.getElementById("oldPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmNewPassword").value = "";
    alert("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
  });
}

function handleLogin() {
  var pinInput = document.getElementById("loginPin");
  var pin = (pinInput.value || "").trim();

  if (!appData.user.pin) {
    alert("ยังไม่มีผู้ใช้งาน กรุณากดปุ่ม 'สมัครใช้งาน'");
    return;
  }

  if (pin.length !== 6) {
    alert("กรุณากรอกรหัส 6 หลัก");
    return;
  }

  if (pin !== appData.user.pin) {
    alert("รหัสไม่ถูกต้อง");
    return;
  }

  document.getElementById("loginScreen").classList.add("screen-hidden");
  document.getElementById("loginScreen").classList.remove("screen-active");
  document.getElementById("mainScreen").classList.remove("screen-hidden");
  pinInput.value = "";
}

function handleRegister() {
  var name = document.getElementById("regName").value.trim();
  var pin = document.getElementById("regPin").value.trim();

  if (!name) {
    alert("กรุณากรอกชื่อผู้ใช้งาน");
    return;
  }

  if (!/^[0-9]{6}$/.test(pin)) {
    alert("รหัสเริ่มใช้งานต้องเป็นตัวเลข 6 หลัก");
    return;
  }

  appData.user.name = name;
  appData.user.pin = pin;
  saveData();

  updateLoginGreeting();
  updateHeaderUsername();
  closeRegisterModal();
  alert("สมัครใช้งานสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัส 6 หลัก");
}

function handleRecordSave() {
  var dateInput = document.getElementById("recordDate");
  var displayDate = (dateInput.value || "").trim();
  var dateKey = displayToKey(displayDate);
  if (!dateKey) {
    alert("กรุณาเลือกวันที่ (รูปแบบ dd-mm-yyyy)");
    return;
  }

  var h1 = Number(document.getElementById("hours1x").value || 0);
  var h15 = Number(document.getElementById("hours15x").value || 0);
  var h2 = Number(document.getElementById("hours2x").value || 0);
  var h3 = Number(document.getElementById("hours3x").value || 0);

  var rawHours = h1 + h15 + h2 + h3;
  var weighted = h1 * 1 + h15 * 1.5 + h2 * 2 + h3 * 3;
  var money = weighted * Number(appData.settings.baseRate || 0);

  openConfirmModal({
    dateKey: dateKey,
    h1: h1,
    h15: h15,
    h2: h2,
    h3: h3,
    rawHours: rawHours,
    money: money
  });
}

// ========== INIT ==========

document.addEventListener("DOMContentLoaded", function () {
  loadData();

  currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  var recordDate = document.getElementById("recordDate");
  if (recordDate) {
    var todayKey = keyFromDate(new Date());
    recordDate.value = keyToDisplay(todayKey);
  }

  updateLoginGreeting();
  updateHeaderUsername();
  updateSettingsUI();
  refreshReportYearOptions();
  renderDashboard();
  loadRecordForCurrentDate();
  updateRecordQuota();
  renderReport();

  setupEventHandlers();
});
