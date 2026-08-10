// ── Tính toán thời gian chờ trung bình và tải theo giờ ───────────────

function parseTimestampMs(ts) {
  if (!ts) return null;
  const ms = Date.parse(String(ts).replace(' ', 'T'));
  return Number.isNaN(ms) ? null : ms;
}

function parseSimMinutes(simTime) {
  if (!simTime) return null;
  const parts = String(simTime).split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function gauss(t, peak, sigma) {
  return Math.exp(-Math.pow(t - peak, 2) / (2 * sigma * sigma));
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

function loadIntensity(minutes) {
  const morning = gauss(minutes, 9 * 60, 70);
  const afternoon = gauss(minutes, 15.5 * 60, 70);
  return Math.min(1, Math.max(morning, afternoon) + 0.08);
}

function formatClock(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

function updateLoadBadge(intensity, minutes) {
  const badge = document.getElementById('loadBadge');
  let cls = 'low', label = 'Thấp điểm';
  if (intensity > 0.65)      { cls = 'peak'; label = 'Cao điểm'; }
  else if (intensity > 0.35) { cls = 'mid';  label = 'Bình thường'; }
  badge.className = 'refresh-tag ' + cls;
  badge.textContent = formatClock(minutes) + ' · ' + label;
}

// Tính avg thời gian chờ: checkin → progress tại từng phòng (dùng giờ giả lập)
function estimateAverageWaitMinutes() {
  const waitDurations = [];
  patients.forEach(p => {
    p.path.forEach(s => {
      if (s.simCheckinMin != null && s.simProgressMin != null && s.simProgressMin >= s.simCheckinMin) {
        waitDurations.push(s.simProgressMin - s.simCheckinMin);
      }
    });
  });

  if (waitDurations.length >= 1) {
    const avg = waitDurations.reduce((sum, d) => sum + d, 0) / waitDurations.length;
    return Math.max(0, Math.round(avg));
  }

  // Fallback heuristic khi chưa có BN nào vào progress
  const waitingCount  = patients.filter(p => p.path.some(s => s.status === 'waiting')  && !p.path.some(s => s.status === 'progress')).length;
  const progressCount = patients.filter(p => p.path.some(s => s.status === 'progress')).length;
  const overloadCount = computeOverload().filter(r => r.overloaded).length;
  const estimate = Math.round(6 + (currentIntensity * 10) + (waitingCount * 1.1) + (progressCount * 0.7) + (overloadCount * 1.8));
  return Math.max(1, estimate);
}

function refreshTimeMetrics() {
  const minutes = getCurrentMinutes();
  currentIntensity = loadIntensity(minutes);
  updateLoadBadge(currentIntensity, minutes);

  const averageWait = estimateAverageWaitMinutes();
  waitHistory.push(averageWait);
  if (waitHistory.length > 16) waitHistory.shift();

  let realSampleCount = 0;
  patients.forEach(p => p.path.forEach(s => {
    if (s.simCheckinMin != null && s.simProgressMin != null) realSampleCount++;
  }));
  const waitLabel = realSampleCount >= 1
    ? `${averageWait} phút (thực tế · ${realSampleCount} lượt)`
    : `${averageWait} phút (ước tính)`;

  document.getElementById('kpiWait').textContent = waitLabel;
  document.getElementById('refreshSecs').textContent = secsSinceRefresh;

  const spark = document.getElementById('waitSpark');
  if (spark) {
    spark.innerHTML = '';
    const max = Math.max(...waitHistory);
    waitHistory.forEach(value => {
      const bar = document.createElement('div');
      bar.style.height = Math.max(3, (value / max) * 32) + 'px';
      spark.appendChild(bar);
    });
  }
}
