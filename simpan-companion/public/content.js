// ===== PANEL MENGAMBANG SIMPAN =====
(function () {
  if (window.top !== window) return;
  if (document.getElementById('simpan-float-root')) return;

  const FAB = 48;
  const MARGIN = 12;
  const POS_KEY = 'simpanFabPos';
  const IDLE_OPACITY = 0.35;

  const host = document.createElement('div');
  host.id = 'simpan-float-root';
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  const logoUrl = chrome.runtime.getURL('logo2.png');
  shadow.innerHTML = `
    <style>
      .fab{position:fixed;width:${FAB}px;height:${FAB}px;border-radius:50%;border:1px solid #c7d2fe;background:#fff;padding:0;
           display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:grab;
           opacity:${IDLE_OPACITY};transition:opacity .2s ease,transform .15s ease;touch-action:none;
           user-select:none;-webkit-user-select:none}
      .fab.awake{opacity:1}
      .fab.dragging{cursor:grabbing;transform:scale(1.08)}
      .fab img{width:30px;height:30px;pointer-events:none;-webkit-user-drag:none}
      .panel{display:none;position:fixed;background:#fff;border:2px solid #4f46e5;border-radius:12px;
             overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.35)}
      .panel.open{display:block}
      iframe{width:100%;height:100%;border:0}
    </style>
    <button class="fab" title="SIMPAN Companion (geser untuk memindahkan)"><img src="${logoUrl}" alt="SIMPAN" draggable="false"></button>
    <div class="panel"><iframe></iframe></div>`;

  const fab = shadow.querySelector('.fab');
  const panel = shadow.querySelector('.panel');
  const frame = shadow.querySelector('iframe');

  let pos = { x: 0, y: 0 };
  let hovering = false, dragging = false, touchAwake = false, touchTimer = null;
  let activeId = null, startX = 0, startY = 0, origX = 0, origY = 0, moved = false;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  const clampPos = (p) => ({
    x: clamp(p.x, 4, window.innerWidth - FAB - 4),
    y: clamp(p.y, 4, window.innerHeight - FAB - 4)
  });

  const refreshAwake = () => {
    fab.classList.toggle('awake', hovering || dragging || touchAwake || panel.classList.contains('open'));
  };

  const placePanel = () => {
    const w = Math.min(420, window.innerWidth * 0.96);
    const h = Math.min(window.innerHeight * 0.8, 720);
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
    const alignRight = pos.x + FAB / 2 > window.innerWidth / 2;
    const left = alignRight ? pos.x + FAB - w : pos.x;
    let top = pos.y - h - 10;
    if (top < 8) top = pos.y + FAB + 10;
    panel.style.left = clamp(left, 8, window.innerWidth - w - 8) + 'px';
    panel.style.top = clamp(top, 8, window.innerHeight - h - 8) + 'px';
  };

  const applyPos = () => {
    fab.style.left = pos.x + 'px';
    fab.style.top = pos.y + 'px';
    if (panel.classList.contains('open')) placePanel();
  };

  const togglePanel = () => {
    if (!frame.src) frame.src = chrome.runtime.getURL('index.html');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) placePanel();
    refreshAwake();
  };

  const savePos = () => {
    try {
      chrome.storage.local.set({ [POS_KEY]: { x: pos.x / window.innerWidth, y: pos.y / window.innerHeight } });
    } catch (e) {}
  };

  fab.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') { hovering = true; refreshAwake(); }
  });
  fab.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') { hovering = false; refreshAwake(); }
  });

  fab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    activeId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    origX = pos.x; origY = pos.y; moved = false;
    try { fab.setPointerCapture(e.pointerId); } catch (err) {}
    if (e.pointerType === 'touch') { touchAwake = true; clearTimeout(touchTimer); refreshAwake(); }
  });

  fab.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true; dragging = true;
    fab.classList.add('dragging');
    pos = clampPos({ x: origX + dx, y: origY + dy });
    applyPos();
    refreshAwake();
  });

  const endPointer = (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    try { fab.releasePointerCapture(e.pointerId); } catch (err) {}
    fab.classList.remove('dragging');
    dragging = false;
    if (e.pointerType === 'touch') {
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => { touchAwake = false; refreshAwake(); }, 2000);
    }
    if (moved) savePos();
    else if (e.type === 'pointerup') togglePanel();
    refreshAwake();
  };
  fab.addEventListener('pointerup', endPointer);
  fab.addEventListener('pointercancel', endPointer);

  fab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
  });

  window.addEventListener('resize', () => { pos = clampPos(pos); applyPos(); });

  pos = clampPos({ x: window.innerWidth - FAB - MARGIN, y: window.innerHeight - FAB - MARGIN });
  applyPos();
  refreshAwake();
  try {
    chrome.storage.local.get(POS_KEY, (res) => {
      const s = res && res[POS_KEY];
      if (s && typeof s.x === 'number' && typeof s.y === 'number') {
        pos = clampPos({ x: s.x * window.innerWidth, y: s.y * window.innerHeight });
        applyPos();
      }
    });
  } catch (e) {}

  (document.body || document.documentElement).appendChild(host);
})();
// ===== AKHIR PANEL MENGAMBANG =====

// ============================================================================
// 🌵 SIMPAN KAKTUS (SIMPAN Kaka Asisten Ecalyptus)
// ============================================================================
let STOP_ROBOT_FLAG = false;
let LAPORAN = [];
let RM_TERKUNCI = '';

const WARD_ROOMS = {
  'MELATI': ['K1KM', 'K1P', 'K2KM', 'K2P', 'K3KM', 'K3P', 'K4KM', 'K4P', 'K5KM', 'K5P', 'K6KM', 'K6P', 'K7', 'K8', 'K9', 'K10KM', 'K10P', 'K11', 'K12', 'K13KM', 'K13P', 'K14', 'K15KM', 'K15P'],
  'DAHLIA': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  'TERATAI': ['K1A', 'K1B', 'K2A', 'K2B', 'K2C', 'K2D', 'K3A', 'K3B', 'K3C', 'K3D', 'K4A', 'K4B', 'K5A', 'K5B', 'K5C', 'K5D', 'K6A', 'K6B', 'K6C', 'K6D', 'K7A', 'K7B'],
  'ANYELIR': ['K1A', 'K1B', 'K1C', 'K1D', 'K2A', 'K2B', 'K2C', 'K2D', 'K3A', 'K3B', 'K3C', 'K3D', 'K4A', 'K4B', 'K4C', 'K4D', 'K5A', 'K5B', 'K5C', 'K5D', 'K6A', 'K6B', 'K6C', 'K6D', 'ISO-A', 'ISO-B'],
  'ANGGREK': ['K1A', 'K1B', 'K2A', 'K2B', 'K3A', 'K3B', 'K4A', 'K4B', 'K5A', 'K5B', 'K6A', 'K6B', 'K7A', 'K7B', 'K8A', 'K8B', 'K9A', 'K9B', 'K10A', 'K10B', 'ISO-A', 'ISO-B']
};

const jeda = (ms) => new Promise(res => setTimeout(res, ms));
const jedaMs = jeda;
const catat = (teks) => { LAPORAN.push(teks); try { kaktusLaporSingkat(teks); } catch (e) { /* dialog belum ada */ } };

function cekStop() {
  if (STOP_ROBOT_FLAG) throw new Error("ROBOT_STOPPED_BY_USER");
}

async function tunggu(fn, timeout = 8000, langkah = 120) {
  const mulai = Date.now();
  while (Date.now() - mulai < timeout) {
    cekStop();
    let v = null;
    try { v = fn(); } catch (e) { v = null; }
    if (v) return v;
    await jeda(langkah);
  }
  return null;
}

const tampak = (el) => !!el && el.getClientRects().length > 0;
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const cleanBedKey = (val) => (val || '').replace(/[\s•·\-_]/g, '').toUpperCase();

function cariTeks(teks, selector = 'button, label, span, div, a, p, h6, li', lingkup = document) {
  const t = norm(teks);
  const semua = Array.from(lingkup.querySelectorAll(selector));
  const cocok = semua.filter(el => tampak(el) && norm(el.textContent) === t);
  return cocok.find(el => !cocok.some(o => o !== el && el.contains(o))) || null;
}
const targetKlik = (el) => el.closest('button, label, [role="button"], a') || el;

async function klikTeks(teks, opsi = {}) {
  const el = await tunggu(() => cariTeks(teks, opsi.selector), opsi.timeout || 8000);
  if (!el) return null;
  targetKlik(el).click();
  return el;
}

function tombolAktif(el) {
  const b = el.closest('button') || el;
  return !(b.disabled || b.getAttribute('aria-disabled') === 'true' || /disabled/i.test(b.className || ''));
}

function ketikKeInputReact(el, nilai) {
  if (!el) return false;
  el.focus();
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, String(nilai)); else el.value = String(nilai);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.blur();
  return String(el.value) === String(nilai);
}

function ketikSungguh(el, nilai) {
  if (!el) return false;
  const teks = String(nilai);
  try {
    el.focus();
    el.setSelectionRange(0, (el.value || '').length);
    if (el.value) document.execCommand('delete');
    for (const ch of teks) {
      const enter = ch === '\n';
      const kunci = enter ? 'Enter' : ch;
      const opsi = { key: kunci, code: enter ? 'Enter' : '', bubbles: true, cancelable: true, composed: true };
      el.dispatchEvent(new KeyboardEvent('keydown', opsi));
      document.execCommand('insertText', false, enter ? '\n' : ch);
      el.dispatchEvent(new KeyboardEvent('keyup', opsi));
    }
  } catch (e) {}
  if (el.value !== teks) ketikKeInputReact(el, teks);
  return el.value === teks;
}

function klikOpsiBerdasarkanJudul(teksJudul, teksOpsi, urutan = 0) {
  const kandidat = Array.from(document.querySelectorAll('h6, p, span, div, label'))
    .filter(el => el.children.length === 0 && norm(el.textContent).includes(norm(teksJudul)));
  const judul = kandidat[urutan];
  if (!judul) return false;
  let wadah = judul.parentElement;
  for (let i = 0; i < 6 && wadah; i++) {
    const opsi = Array.from(wadah.querySelectorAll('label, button, span'))
      .find(l => norm(l.textContent) === norm(teksOpsi) || norm(l.textContent).includes(norm(teksOpsi)));
    if (opsi) { opsi.click(); return true; }
    wadah = wadah.parentElement;
  }
  return false;
}

function pilihRadio(teks) {
  const lbl = Array.from(document.querySelectorAll('label')).find(l => tampak(l) && norm(l.textContent) === norm(teks));
  if (!lbl) return false;
  const input = lbl.querySelector('input[type="radio"]') || (lbl.htmlFor && document.getElementById(lbl.htmlFor));
  lbl.click();
  if (input && !input.checked) input.click();
  return input ? !!input.checked : true;
}

// ---------------------------------------------------------------------------
// IDENTITAS PASIEN & VALIDASI SIMPAN
// ---------------------------------------------------------------------------
function bacaRmDiHalaman() {
  const m = (document.body?.innerText || '').match(/No\.?\s*RM\s*[:\s]*(\d{5,10})/i);
  return m ? m[1] : '';
}
const rmBersih = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');

function kunciPasien(config) {
  if (!/\/patient\/|activity-patient|signature-recorder/.test(location.hash)) {
    throw new Error('IDENTITAS: layar bukan halaman pasien. Buka dulu pasiennya di Ecalyptus.');
  }
  const rm = bacaRmDiHalaman();
  if (!rm) throw new Error('IDENTITAS: nomor RM tidak terbaca di layar, Kaktus berhenti.');
  if (config && config.rmTarget && rmBersih(config.rmTarget) !== rmBersih(rm)) {
    throw new Error(`IDENTITAS: layar menampilkan RM ...${rm.slice(-4)}, bukan pasien target.`);
  }
  RM_TERKUNCI = rm;
  return rm;
}

function pastikanPasienSama() {
  const rm = bacaRmDiHalaman();
  if (rm && RM_TERKUNCI && rm !== RM_TERKUNCI) {
    throw new Error('IDENTITAS: pasien di layar berubah di tengah proses, penyimpanan dibatalkan.');
  }
}

function shiftDariJam(d = new Date()) {
  const h = d.getHours();
  if (h >= 8 && h < 14) return 'pagi';
  if (h >= 14 && h < 21) return 'siang';
  return 'malam';
}
const tentukanShift = (config) => (['pagi', 'siang', 'malam'].includes(config?.shift) ? config.shift : shiftDariJam());

const teksHalaman = () => document.body?.innerText || '';
const sedangKirim = () => /submit+ing data/i.test(teksHalaman());
const sudahSukses = () => /submit data success/i.test(teksHalaman());

function petunjukWajib() {
  const hasil = new Set();
  for (const el of document.querySelectorAll('p, span, label, div, small')) {
    if (!tampak(el) || el.children.length > 0) continue;
    const t = (el.textContent || '').trim();
    if (!t || t.length > 80) continue;
    const warna = getComputedStyle(el).color;
    const merah = /^rgb\((2[0-5]\d|1[89]\d),\s*(\d{1,2}|1[0-2]\d),\s*(\d{1,2}|1[0-2]\d)\)$/.test(warna);
    if (/wajib|harus diisi|required|belum diisi|tidak boleh kosong/i.test(t) || merah || /\*\s*$/.test(t)) hasil.add(t);
  }
  return Array.from(hasil).slice(0, 6);
}

async function simpanSekali(teksTombol) {
  const el = await tunggu(() => cariTeks(teksTombol, 'button, span'), 8000);
  if (!el) throw new Error(`Tombol "${teksTombol}" tidak ditemukan.`);
  const aktif = await tunggu(() => tombolAktif(el), 6000);
  if (!aktif) {
    const hint = petunjukWajib();
    throw new Error(`Tombol "${teksTombol}" tetap nonaktif.${hint.length ? ' Petunjuk: ' + hint.join(' | ') : ''}`);
  }

  pastikanPasienSama();
  for (let percobaan = 1; percobaan <= 2; percobaan++) {
    targetKlik(el).click();
    const terpicu = await tunggu(() => sedangKirim() || sudahSukses() || !document.contains(el) || !tampak(el) || !tombolAktif(el), 4000, 80);
    if (terpicu) break;
    if (percobaan === 2) throw new Error(`Klik "${teksTombol}" tidak menghasilkan respons.`);
    catat(`Klik "${teksTombol}" belum merespons, mengulang sekali.`);
  }
  const sukses = await tunggu(() => sudahSukses(), 20000, 100);
  if (!sukses) throw new Error(`Tidak ada pesan "Submit data success!" setelah "${teksTombol}".`);
  await tunggu(() => !sudahSukses() && !sedangKirim(), 10000, 150);
  return true;
}

// ---------------------------------------------------------------------------
// SKALA NYERI (0..10)
// ---------------------------------------------------------------------------
function cariWadahSkala() {
  const wadah = Array.from(document.querySelectorAll('div, ul, span')).filter(el => {
    const anak = Array.from(el.children);
    if (anak.length < 10) return false;
    const teks = anak.map(a => norm(a.textContent));
    for (let i = 0; i + 11 <= teks.length; i++) {
      if (teks.slice(i, i + 11).every((t, k) => t === String(k))) return true;
    }
    for (let i = 0; i + 10 <= teks.length; i++) {
      if (teks.slice(i, i + 10).every((t, k) => t === String(k + 1))) return true;
    }
    return false;
  });
  return wadah.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0] || null;
}

async function klikSkalaNyeri(n) {
  const w = await tunggu(cariWadahSkala, 5000);
  if (!w) return false;
  const sel = Array.from(w.children).find(a => norm(a.textContent) === String(n));
  if (!sel) return false;
  sel.click();
  const dalam = sel.querySelector('button, span, div');
  if (dalam && dalam.children.length === 0) dalam.click();
  const ok = await tunggu(() => new RegExp(`skor\\s*:?\\s*${n}\\b`, 'i').test(teksHalaman()), 2000);
  if (!ok) catat(`Skala nyeri ${n} sudah diklik tapi "Skor : ${n}" tidak terlihat.`);
  return true;
}

// ---------------------------------------------------------------------------
// TTV PINTAR (Prioritas 0 Manual -> Prioritas 1 O SIMPAN -> Prioritas 2 Geser ±1-2 EWS)
// ---------------------------------------------------------------------------
function geserPoin(nilaiAwal, minSelisih = 1, maxSelisih = 2, batasBawah = null, batasAtas = null) {
  const n = parseInt(nilaiAwal, 10);
  if (isNaN(n)) return String(nilaiAwal);
  const selisih = Math.floor(Math.random() * (maxSelisih - minSelisih + 1)) + minSelisih;
  const arah = Math.random() < 0.5 ? 1 : -1;
  let hasil = n + (selisih * arah);
  if (batasBawah !== null && hasil < batasBawah) hasil = n + selisih;
  if (batasAtas !== null && hasil > batasAtas) hasil = n - selisih;
  return String(hasil);
}

function geserSuhu(suhuAwal) {
  const s = parseFloat(String(suhuAwal).replace(',', '.'));
  if (isNaN(s)) return '36.6';
  if (s < 36.0) return '36.5';
  const arah = Math.random() < 0.5 ? 0.1 : -0.1;
  let hasil = +(s + arah).toFixed(1);
  if (hasil < 36.2) hasil = +(s + 0.1).toFixed(1);
  if (hasil > 37.2 && s <= 37.2) hasil = +(s - 0.1).toFixed(1);
  return hasil.toFixed(1);
}

function ekstrakTtvDariObjektif(teksO = '') {
  const t = String(teksO || '');
  if (!t.trim()) return {};
  const hasil = {};

  const tdLabel = t.match(/(?:TD|Tensi|Tekanan\s*Darah|BP)\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (tdLabel) {
    hasil.sistolik = tdLabel[1];
    hasil.diastolik = tdLabel[2];
  } else {
    const tdPolos = t.match(/(?<![\/\-\.\d])(9\d|[12]\d{2})\s*\/\s*([4-9]\d|1[0-2]\d)(?![\/\-\.\d])\s*(?:mmhg)?/i);
    if (tdPolos) {
      hasil.sistolik = tdPolos[1];
      hasil.diastolik = tdPolos[2];
    }
  }

  const hrMatch = t.match(/(?:\bN\b|\bNadi\b|\bHR\b|\bHeart\s*Rate\b)\s*[:=]?\s*(\d{2,3})(?!\s*[\/]\d)/i);
  if (hrMatch) hasil.hr = hrMatch[1];

  const suhuMatch = t.match(/(?:\bS\b|\bSuhu\b|\bTemp\b|\bT\b)\s*[:=]?\s*(3[5-9]|4[01])(?:[.,](\d))?/i)
    || t.match(/\b(3[5-9][.,]\d|40[.,]\d)\s*°?\s*C\b/i);
  if (suhuMatch) {
    hasil.suhu = suhuMatch[2] !== undefined
      ? `${suhuMatch[1]}.${suhuMatch[2]}`
      : String(suhuMatch[1]).replace(',', '.');
  }

  const rrMatch = t.match(/(?:\bRR\b|\bRr\b|\bResp(?:irasi)?\b|\bFrekuensi\s*Nafas\b)\s*[:=]?\s*(\d{1,2})\b/i);
  if (rrMatch) hasil.rr = rrMatch[1];

  const spo2Match = t.match(/(?:\bSpO2\b|\bSaO2\b|\bSaturasi\b|\bSat\b)\s*[:=]?\s*(\d{2,3})\s*%?/i)
    || t.match(/\b(9[4-9]|100)\s*%/);
  if (spo2Match) hasil.spo2 = spo2Match[1];

  return hasil;
}

function bacaTabelGrafikEws() {
  const hasil = {};
  let bagian = null;
  for (const tr of document.querySelectorAll('table tr')) {
    const teksBaris = tr.innerText || tr.textContent || '';
    if (/RR\s*\/\s*M/i.test(teksBaris)) bagian = 'rr';
    else if (/SPO2/i.test(teksBaris)) bagian = 'spo2';
    else if (/Air\s*atau\s*Oxygen/i.test(teksBaris)) bagian = 'oksigen';
    else if (/Tekanan\s*Darah/i.test(teksBaris)) bagian = 'sistolik';
    else if (/HR\s*\/\s*M/i.test(teksBaris)) bagian = 'hr';
    else if (/Kesadaran/i.test(teksBaris)) bagian = 'kesadaran';
    else if (/Suhu/i.test(teksBaris)) bagian = 'suhu';

    if (!bagian || ['oksigen', 'kesadaran'].includes(bagian)) continue;
    const selAngka = Array.from(tr.querySelectorAll('td'))
      .map(td => (td.innerText || td.textContent || '').trim())
      .filter(v => /^\d{1,3}(?:[.,]\d)?$/.test(v));
    if (selAngka.length > 0) hasil[bagian] = selAngka[selAngka.length - 1].replace(',', '.');
  }
  return hasil;
}

function bacaTtvDiLayarEcal() {
  const t = teksHalaman();
  const d = {};
  const td = t.match(/Tekanan\s*darah[\s\n:]*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (td) { d.sistolik = td[1]; d.diastolik = td[2]; }
  const hr = t.match(/Detak\s*jantung[\s\n:]*(\d{2,3})/i);
  if (hr) d.hr = hr[1];
  const rr = t.match(/Frekuensi\s*pernafasan[\s\n:]*(\d{1,2})/i);
  if (rr) d.rr = rr[1];
  const suhu = t.match(/Suhu(?:\s*Badan)?[\s\n:]*(\d{2}(?:[.,]\d)?)\s*°?C?/i);
  if (suhu) d.suhu = suhu[1].replace(',', '.');
  const spo2 = t.match(/SpO2[\s\n:]*(\d{2,3})/i);
  if (spo2) d.spo2 = spo2[1];
  return { ...bacaTabelGrafikEws(), ...d };
}

async function bacaTtv(config) {
  const p = config || {};
  const manual = {};
  ['rr', 'spo2', 'sistolik', 'diastolik', 'hr', 'suhu'].forEach(k => {
    const v = String(p[k] ?? '').trim();
    if (v) manual[k] = v.replace(',', '.');
  });

  const dariO = ekstrakTtvDariObjektif(p.companionSoap?.objective || '');
  const kunciTtv = ['rr', 'spo2', 'sistolik', 'diastolik', 'hr', 'suhu'];
  const sumberO = [];
  const sumberEcal = [];

  let dariEcal = bacaTtvDiLayarEcal();
  if (kunciTtv.some(k => !manual[k] && !dariEcal[k])) {
    const btnLewati = cariTeks('Lewati', 'button, span');
    if (btnLewati) {
      targetKlik(btnLewati).click();
      await tunggu(() => Object.keys(bacaTabelGrafikEws()).length > 0, 2500);
      dariEcal = { ...bacaTabelGrafikEws(), ...bacaTtvDiLayarEcal(), ...dariEcal };
      await bukaTab('Early Warning System (EWS)', () => cariTeks('Simpan dan Selesai', 'button, span'));
    }
  }

  const tdSama = dariO.sistolik && dariEcal.sistolik &&
    String(dariO.sistolik) === String(dariEcal.sistolik) &&
    (!dariO.diastolik || !dariEcal.diastolik || String(dariO.diastolik) === String(dariEcal.diastolik));
  const hrSama = dariO.hr && dariEcal.hr && String(dariO.hr) === String(dariEcal.hr);
  const oMasihDataShiftLama = Boolean(tdSama && (!dariO.hr || hrSama));

  const cadangan = { rr: '20', spo2: '98', sistolik: '122', diastolik: '78', hr: '84', suhu: '36.6' };
  const final = {};

  for (const k of kunciTtv) {
    if (manual[k]) {
      final[k] = manual[k];
      continue;
    }

    const valO = dariO[k];
    const valEcal = dariEcal[k];
    const samaDenganEcal = valO && valEcal && String(valO).replace(',', '.') === String(valEcal).replace(',', '.');

    if (valO && !samaDenganEcal && !oMasihDataShiftLama) {
      final[k] = valO;
      sumberO.push(`${k.toUpperCase()}:${final[k]}`);
    } else {
      const patokan = valEcal || valO || cadangan[k];
      if (k === 'sistolik') final[k] = geserPoin(patokan, 1, 2, 95, 175);
      else if (k === 'diastolik') final[k] = geserPoin(patokan, 1, 2, 60, 105);
      else if (k === 'hr') final[k] = geserPoin(patokan, 1, 2, 60, 105);
      else if (k === 'suhu') final[k] = geserSuhu(patokan);
      else if (k === 'spo2') final[k] = geserPoin(patokan, 1, 1, 97, 99);
      else if (k === 'rr') final[k] = String(patokan || '20');
      sumberEcal.push(`${k.toUpperCase()}:${patokan}->${final[k]}`);
    }
  }

  if (sumberO.length) catat(`TTV dari O: ${sumberO.join(', ')}`);
  if (sumberEcal.length) catat(`TTV ±1-2: ${sumberEcal.join(', ')}`);
  return final;
}

function inputUntukLabel(teksLabel) {
  const t = norm(teksLabel);
  const labels = Array.from(document.querySelectorAll('label, span, p, div'))
    .filter(el => el.children.length === 0 && tampak(el) && norm(el.textContent).replace(/\s*°c$/, '') === t.replace(/\s*°c$/, ''));
  for (const lb of labels) {
    let w = lb.parentElement;
    for (let i = 0; i < 4 && w; i++, w = w.parentElement) {
      const ins = Array.from(w.querySelectorAll('input, textarea')).filter(x => !['radio', 'checkbox', 'hidden'].includes(x.type) && tampak(x));
      const sesudah = ins.find(x => lb.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (sesudah) return sesudah;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 🧠 OTAK KLINIS SIMPAN KAKTUS: PENENTU 1 DIAGNOSA SDKI TERKUAT
// ---------------------------------------------------------------------------
const KAMUS_SDKI = [
  {
    kode: 'D.0001',
    nama: 'Bersihan jalan napas tidak efektif',
    skor: (ctx) => {
      let p = 0;
      const sesak = /\b(sesak|dispnea|dyspnea|engap|napas berat)\b/i.test(ctx.semua);
      const sekret = /\b(batuk|dahak|sputum|lendir|ronkhi|ronki|wheezing|mengi|slem)\b/i.test(ctx.semua);
      const nebu = /\b(nebu|nebulizer|combivent|farbivent|pulmicort|flutison|nac\b|asetilsistein|acetylcysteine|salbutamol|aminofilin)\b/i.test(ctx.semua);
      const dxParu = /\b(pneumonia|cap\b|tb\b|tuberkulosis|asma|asthma|ppok|copd|bronkitis|bronkopneumonia)\b/i.test(ctx.ap);
      if (sesak && (sekret || nebu || dxParu)) p += 10;
      else if (sekret) p += 6;
      if (dxParu) p += 4;
      if (nebu) p += 4;
      if (ctx.num.rr >= 22 || (ctx.num.spo2 > 0 && ctx.num.spo2 < 95)) p += 2;
      return p;
    }
  },
  {
    kode: 'D.0005',
    nama: 'Pola napas tidak efektif',
    skor: (ctx) => {
      let p = 0;
      const sesak = /\b(sesak|dispnea|dyspnea|engap|napas pendek|orthopnea|takipnea)\b/i.test(ctx.semua);
      const sekret = /\b(batuk|dahak|sputum|ronkhi|ronki|wheezing|nebu|combivent|farbivent|pulmicort)\b/i.test(ctx.semua);
      if (sesak && !sekret) p += 10;
      else if (sesak) p += 4;
      if (ctx.num.rr >= 24 || (ctx.num.spo2 > 0 && ctx.num.spo2 < 95)) p += 5;
      if (/\b(oksigen|o2\b|nasal kanul|nrm\b|efusi pleura)\b/i.test(ctx.semua)) p += 3;
      return p;
    }
  },
  {
    kode: 'D.0149',
    nama: 'Termoregulasi tidak efektif',
    skor: (ctx) => {
      let p = 0;
      const fluktuasi = /\b(menggigil|naik turun|panas dingin|fluktuatif|kadang panas|kadang demam|hipotermi|sepsis)\b/i.test(ctx.semua);
      const demamAkralDingin = /\b(demam|panas|febris)\b/i.test(ctx.semua) && /\b(akral dingin|menggigil)\b/i.test(ctx.semua);
      if (fluktuasi || demamAkralDingin) p += 11;
      if (ctx.num.suhu > 0 && ctx.num.suhu < 36.0) p += 9;
      if (fluktuasi && ctx.num.suhu >= 37.5) p += 4;
      return p;
    }
  },
  {
    kode: 'D.0130',
    nama: 'Hipertermia',
    skor: (ctx) => {
      let p = 0;
      if (/\b(demam|panas|badan hangat|febris|hipertermi|hipertermia|dhf\b|df\b|dengue|typhoid|tifoid)\b/i.test(ctx.semua)) p += 8;
      if (ctx.num.suhu >= 37.6) p += 9;
      if (/\b(paracetamol|parasetamol|pct\b|sanmol|tamoliv|kompres)\b/i.test(ctx.p) && /\b(demam|panas|febris)\b/i.test(ctx.semua)) p += 3;
      return p;
    }
  },
  {
    kode: 'D.0077',
    nama: 'Nyeri akut',
    skor: (ctx) => {
      let p = 0;
      if (/\b(nyeri|sakit perut|sakit kepala|perih|mulas|melilit|kolik|nyut|pegal|linu|cephalalgia|abdominal pain|chest pain|low back pain|lbp)\b/i.test(ctx.s + ' ' + ctx.a)) p += 8;
      if (/\b(ketorolac|ketorolak|toradol|farpain|deksketoprofen|dexketoprofen|ketesse|tramadol|analgetik)\b/i.test(ctx.p)) p += 4;
      if (/\b(kolik|dyspepsia|dispepsia|gastritis|appendisitis|batu|fraktur|post op|hernia|isk\b)\b/i.test(ctx.a)) p += 3;
      return p;
    }
  },
  {
    kode: 'D.0027',
    nama: 'Ketidakstabilan kadar glukosa darah',
    skor: (ctx) => {
      let p = 0;
      if (/\b(dm\b|diabetes|hiperglikemi|hipoglikemi|kad\b|ketoasidosis)\b/i.test(ctx.a)) p += 9;
      if (ctx.num.gds >= 200 || (ctx.num.gds > 0 && ctx.num.gds < 70)) p += 8;
      if (/\b(novorapid|sansulin|lantus|levemir|apidra|ezelin|insulin|glimepirid|metformin)\b/i.test(ctx.p)) p += 4;
      return p;
    }
  },
  {
    kode: 'D.0016',
    nama: 'Risiko perfusi renal tidak efektif',
    skor: (ctx) => {
      let p = 0;
      if (/\b(ckd|chd|gagal ginjal|aki\b|ackd|on hd|hemodialisa|hemodialisis|cuci darah|azotemia|uremik)\b/i.test(ctx.semua)) p += 11;
      if (ctx.num.cr >= 1.8 || ctx.num.ur >= 60) p += 6;
      return p;
    }
  },
  {
    kode: 'D.0023',
    nama: 'Hipovolemia',
    skor: (ctx) => {
      let p = 0;
      if (/\b(transfusi|tranfusi|prc\b|whole blood|wb\b)\b/i.test(ctx.semua)) p += 10;
      if (/\b(dehidrasi|perdarahan|melena|hematemesis|hipovolemik|kurang cairan|syok)\b/i.test(ctx.semua)) p += 8;
      if (ctx.num.hb > 0 && ctx.num.hb < 8) p += 6;
      if (ctx.num.sis > 0 && ctx.num.sis < 90) p += 5;
      return p;
    }
  },
  {
    kode: 'D.0009',
    nama: 'Perfusi perifer tidak efektif',
    skor: (ctx) => {
      let p = 0;
      if (/\b(anemia|anemis|pucat|konjungtiva anemis|crt\s*>\s*2)\b/i.test(ctx.semua)) p += 8;
      if (/\b(lemas|letih|lesu|malaise|cepat lelah|badan lemas)\b/i.test(ctx.s + ' ' + ctx.a)) p += 5;
      if (ctx.num.hb > 0 && ctx.num.hb < 10) p += 8;
      return p;
    }
  },
  {
    kode: 'D.0020',
    nama: 'Diare',
    skor: (ctx) => {
      let p = 0;
      if (/\b(diare|bab cair|mencret|gea\b|gastroenteritis|disentri|kolitis)\b/i.test(ctx.semua)) p += 11;
      if (/\b(new diatabs|attapulgite|zinc|zink|oralit|loperamid)\b/i.test(ctx.p)) p += 5;
      return p;
    }
  },
  {
    kode: 'D.0076',
    nama: 'Nausea',
    skor: (ctx) => {
      let p = 0;
      if (/\b(mual|muntah|vomitus|enek|nausea|tidak nafsu makan)\b/i.test(ctx.s + ' ' + ctx.a)) p += 7;
      if (/\b(ondansetron|narfoz|invomit|metoclopramid|domperidon)\b/i.test(ctx.p)) p += 3;
      return p;
    }
  },
  {
    kode: 'D.0022',
    nama: 'Hipervolemia',
    skor: (ctx) => {
      let p = 0;
      if (/\b(edema|udem|bengkak|ascites|asites|overload|alo\b|chf\b|gagal jantung)\b/i.test(ctx.semua)) p += 7;
      if (/\b(furosemid|furosemide|lasix|farsix|spironolakton)\b/i.test(ctx.p) && /\b(sesak|edema|bengkak|ckd|chf)\b/i.test(ctx.semua)) p += 6;
      return p;
    }
  },
  {
    kode: 'D.0017',
    nama: 'Risiko perfusi serebral tidak efektif',
    skor: (ctx) => {
      let p = 0;
      if (/\b(stroke|snh\b|sh\b|hemiparesis|pelo|hipertensi urgensi|hipertensi emergensi|penurunan kesadaran|vertigo)\b/i.test(ctx.semua)) p += 10;
      if (ctx.num.sis >= 170) p += 6;
      return p;
    }
  }
];

function tentukanDiagnosaSdki(data = {}, fallbackPerawatA = '') {
  const s = String(data.subjective || '').toLowerCase();
  const o = String(data.objective || '').toLowerCase();
  const a = String(data.analysis || '').toLowerCase();
  const p = String(`${data.planning || ''} ${data.prescription || ''}`).toLowerCase();
  const semua = `${s} ${o} ${a} ${p}`;

  const ttv = ekstrakTtvDariObjektif(o);
  const ambilAngka = (re) => { const m = o.match(re); return m ? parseFloat(m[1].replace(',', '.')) : 0; };
  const num = {
    sis: parseFloat(ttv.sistolik || 0),
    rr: parseFloat(ttv.rr || 0),
    spo2: parseFloat(ttv.spo2 || 0),
    suhu: parseFloat(ttv.suhu || 0),
    hb: ambilAngka(/\b(?:hb|hemoglobin)\b[\s:=-]*(\d+(?:[.,]\d+)?)/i),
    gds: ambilAngka(/\b(?:gds|gula darah sewaktu)\b[\s:=-]*(\d+(?:[.,]\d+)?)/i),
    ur: ambilAngka(/\b(?:ur|ureum)\b[\s:=-]*(\d+(?:[.,]\d+)?)/i),
    cr: ambilAngka(/\b(?:cr|kreatinin)\b[\s:=-]*(\d+(?:[.,]\d+)?)/i)
  };

  const ctx = { s, o, a, p, semua, ap: `${a} ${p}`, num };
  const hasil = KAMUS_SDKI
    .map(d => ({ kode: d.kode, nama: d.nama, skor: d.skor(ctx) }))
    .filter(d => d.skor > 0)
    .sort((x, y) => y.skor - x.skor);

  if (hasil.length > 0) {
    return { utama: hasil[0].nama, kode: hasil[0].kode, skor: hasil[0].skor, sumber: 'SDKI Kaktus', kandidat: hasil.slice(0, 3) };
  }
  const cadangan = String(fallbackPerawatA || '').trim() || 'Nyeri akut';
  return { utama: cadangan, kode: '', skor: 0, sumber: fallbackPerawatA ? 'CPPT Perawat' : 'Default', kandidat: KAMUS_SDKI.slice(0, 3).map(x => ({ kode: x.kode, nama: x.nama, skor: 1 })) };
}

// ---------------------------------------------------------------------------
// 1. ASESMEN RUTIN & PASIEN BARU
// ---------------------------------------------------------------------------
async function bukaTab(namaTab, penandaHalaman) {
  const ok = await klikTeks(namaTab, { timeout: 8000 });
  if (!ok) throw new Error(`Tab "${namaTab}" tidak ditemukan.`);
  const siap = await tunggu(penandaHalaman, 8000);
  if (!siap) throw new Error(`Halaman "${namaTab}" tidak termuat.`);
}

async function langkah(nama, fn) {
  try {
    await fn();
    catat(`OK: ${nama}`);
    return true;
  } catch (e) {
    if (e.message === 'ROBOT_STOPPED_BY_USER' || e.message.startsWith('IDENTITAS')) throw e;
    catat(`GAGAL: ${nama} (${e.message})`);
    return false;
  }
}

// Sapu bersih radio kosong (termasuk KDRT, zat adiktif, ide bunuh diri, penurunan BB, Barthel, Geriatri)
function sapuBersihRadioDefault() {
  const grup = new Map();
  document.querySelectorAll('input[type="radio"]').forEach(inp => {
    if (!inp.name || !tampak(inp.closest('label') || inp)) return;
    if (!grup.has(inp.name)) grup.set(inp.name, []);
    grup.get(inp.name).push(inp);
  });

  let diisi = 0;
  const prioritasOpsi = [
    'hidup bersama keluarga',
    'tidak ada hambatan',
    'mampu dan mau',
    'mampu memahami',
    'tidak ada',
    'tidak',
    'normal',
    'mandiri',
    'pasrah',
    'memerlukan sedikit bantuan',
    'berjalan dengan bantuan satu orang',
    'baik'
  ];

  grup.forEach(list => {
    if (list.some(i => i.checked)) return;
    const teksList = list.map(i => norm((i.closest('label') || i.parentElement)?.textContent));
    for (const target of prioritasOpsi) {
      const idx = teksList.findIndex(t => t === target || (target.length >= 6 && t.startsWith(target)));
      if (idx >= 0) {
        const l = list[idx].closest('label') || list[idx];
        l.click();
        if (!list[idx].checked) list[idx].click();
        diisi++;
        break;
      }
    }
  });
  return diisi;
}

function centangCheckboxTeks(daftarKata = []) {
  let jml = 0;
  document.querySelectorAll('label').forEach(lbl => {
    if (!tampak(lbl)) return;
    const t = norm(lbl.textContent);
    const cb = lbl.querySelector('input[type="checkbox"]') || (lbl.htmlFor && document.getElementById(lbl.htmlFor));
    if (!cb || cb.type !== 'checkbox' || cb.checked) return;
    if (daftarKata.some(k => t === norm(k) || t.includes(norm(k)))) {
      lbl.click();
      if (!cb.checked) cb.click();
      jml++;
    }
  });
  return jml;
}

// Gambar tanda tangan otomatis pada <canvas> modal Ecalyptus (menggunakan ttdPerawat PNG atau goresan estetis)
async function isiTandaTanganCanvas(dataUrlPng = '') {
  // Tanpa TTD tersimpan, robot TIDAK menggambar apa pun (tidak ada coretan pengganti): tanda tangan manual.
  if (!dataUrlPng || !/^data:image\//i.test(dataUrlPng)) { catat('Catatan: TTD perawat belum tersimpan di SIMPAN, kolom TTD Pemberi tidak diisi (tanda tangan manual).'); return false; }
  // Hanya tombol pertama = Pemberi Informasi/Edukasi (Penerima/Saksi selalu manual)
  const btnBukaTtd = Array.from(document.querySelectorAll('button, span')).find(el => tampak(el) && /^masukkan\s*tanda\s*tangan$/i.test(norm(el.textContent)))
    || Array.from(document.querySelectorAll('button, span')).find(el => tampak(el) && /^edit\s*tanda\s*tangan$/i.test(norm(el.textContent)));
  if (btnBukaTtd) {
    targetKlik(btnBukaTtd).click();
    await jeda(400);
  }

  const canvas = await tunggu(() => Array.from(document.querySelectorAll('canvas')).find(tampak), 5000);
  if (!canvas) return false;

  const ctx = canvas.getContext('2d');
  const w = canvas.width || 300, h = canvas.height || 150;

  if (dataUrlPng && /^data:image\//i.test(dataUrlPng)) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 10, 10, w - 20, h - 20); resolve(); };
      img.onerror = resolve;
      img.src = dataUrlPng;
    });
  }

  // Simulasikan goresan pointer/mouse asli di atas canvas agar state signature-pad React mendeteksi perubahan
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.3, cy = rect.top + rect.height * 0.55;
  const titik = [
    [cx, cy], [cx + 25, cy - 22], [cx + 50, cy + 12], [cx + 80, cy - 18], [cx + 115, cy + 5]
  ];

  const kirimEvt = (tipe, x, y) => {
    canvas.dispatchEvent(new PointerEvent(tipe, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, buttons: tipe === 'pointerup' ? 0 : 1 }));
    const mTipe = tipe.replace('pointer', 'mouse');
    canvas.dispatchEvent(new MouseEvent(mTipe, { bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: tipe === 'pointerup' ? 0 : 1 }));
  };

  kirimEvt('pointerdown', titik[0][0], titik[0][1]);
  for (const [x, y] of titik.slice(1)) {
    await jeda(25);
    kirimEvt('pointermove', x, y);
  }
  await jeda(25);
  kirimEvt('pointerup', titik[titik.length - 1][0], titik[titik.length - 1][1]);
  await jeda(250);

  const dlg = canvas.closest('div[role="dialog"]') || document;
  const btnSimpanModal = Array.from(dlg.querySelectorAll('button, span'))
    .find(el => tampak(el) && /^simpan$/i.test(norm(el.textContent)));
  if (btnSimpanModal && dlg !== document) {
    targetKlik(btnSimpanModal).click();
    await jeda(400);
  }
  return true;
}

async function jalankanModulAsesmen(config) {
  cekStop();
  kunciPasien(config);
  if (!location.hash.includes('/patient/assessment')) {
    const ok = await klikTeks('Asesmen Awal');
    if (!ok) throw new Error('Menu "Asesmen Awal" tidak ditemukan.');
    await tunggu(() => location.hash.includes('/patient/assessment'), 8000);
  }

  // A. NYERI (Pasien baru otomatis skala 2 bila config.isPasienBaru aktif; pasien lama mengikuti config.nyeri)
  await langkah('Asesmen Nyeri', async () => {
    await bukaTab('Asesmen Nyeri', () => cariTeks('Simpan Assessment Nyeri', 'button, span'));
    const modeNyeri = config.isPasienBaru ? 'ya' : (config.nyeri || 'tidak');
    if (modeNyeri === 'tidak') {
      if (!klikOpsiBerdasarkanJudul('Nyeri', 'Tidak')) throw new Error('opsi "Tidak" tidak ditemukan');
    } else {
      if (!klikOpsiBerdasarkanJudul('Nyeri', 'Ya')) throw new Error('opsi "Ya" tidak ditemukan');
      await jeda(300);
      klikOpsiBerdasarkanJudul('Kondisi', 'Sadar');
      if (!await klikSkalaNyeri(config.skalaNyeri || '2')) throw new Error('skala nyeri tidak ditemukan (tolong 🔍 Rekam halaman Asesmen Nyeri setelah memilih "Ya", lalu kirim ke Claude)');
      klikOpsiBerdasarkanJudul('Frekuensi Nyeri', 'Hilang Timbul');
      klikOpsiBerdasarkanJudul('Menjalar', 'Tidak');
      klikOpsiBerdasarkanJudul('Kualitas Nyeri', 'Nyeri tumpul');
      klikOpsiBerdasarkanJudul('Tindak lanjut', 'Intervensi');
    }
    await simpanSekali('Simpan Assessment Nyeri');
  });

  // B. JATUH
  await langkah('Asesmen Jatuh', async () => {
    const tabJatuh = await tunggu(() => {
      const c = Array.from(document.querySelectorAll('div, span, p, a, li, button')).filter(el => tampak(el) && /^asesmen jatuh/i.test(norm(el.textContent)) && norm(el.textContent).length < 60);
      return c.find(el => !c.some(o => o !== el && el.contains(o))) || null;
    }, 8000);
    if (!tabJatuh) throw new Error('tab "Asesmen Jatuh …" tidak ditemukan');
    const namaTab = tabJatuh.textContent.trim();
    catat(`Jenis asesmen jatuh: ${namaTab}`);
    targetKlik(tabJatuh).click();
    const cariSimpan = () => Array.from(document.querySelectorAll('button, span')).find(el => tampak(el) && /^simpan\s+assess?ment/i.test(norm(el.textContent)) && !/nyeri/i.test(el.textContent));
    if (!await tunggu(cariSimpan, 8000)) throw new Error(`form "${namaTab}" tidak termuat`);

    const iv = cariTeks('Terapi intravena', 'label, span');
    if (iv) {
      const cb = (iv.closest('label') || iv.parentElement)?.querySelector('input[type="checkbox"]');
      if (!cb || !cb.checked) targetKlik(iv).click();
    }
    const sudah = Array.from(document.querySelectorAll('label')).filter(l => tampak(l) && norm(l.textContent) === 'sudah');
    sudah.forEach(l => {
      const r = l.querySelector('input[type="radio"]');
      if (!r || !r.checked) l.click();
    });
    if (!sudah.length) throw new Error('pilihan "Sudah" tidak ditemukan');

    if (/geriatri/i.test(namaTab) && config.jatuhGeriatriBawaan !== false) {
      const nDiisi = sapuBersihRadioDefault();
      if (nDiisi) catat(`Geriatri: ${nDiisi} opsi bawaan diisi.`);
      await jeda(250);
    }

    const tombolSimpan = cariSimpan();
    await simpanSekali(tombolSimpan.textContent.trim());
  });

  // C. EWS
  await langkah('EWS', async () => {
    await bukaTab('Early Warning System (EWS)', () => cariTeks('Simpan dan Selesai', 'button, span'));
    const ttv = await bacaTtv(config);

    const peta = [['RR/MENIT', ttv.rr], ['SPO2', ttv.spo2], ['Sistole', ttv.sistolik], ['Diastole', ttv.diastolik], ['HR/MENIT', ttv.hr], ['Suhu °C', ttv.suhu]];
    let semuaOk = true;
    for (const [lbl, val] of peta) {
      const inp = await tunggu(() => inputUntukLabel(lbl), 4000);
      if (!inp || !ketikKeInputReact(inp, val)) { semuaOk = false; catat(`Kolom "${lbl}" tidak terisi.`); }
    }
    if (!semuaOk) throw new Error('ada kolom EWS yang tidak terisi, tidak disimpan');

    if (!pilihRadio(config.oksigen === 'oxygen' ? 'oxygen' : 'air')) throw new Error('pilihan oxygen/air gagal');
    if (!pilihRadio(config.kesadaran === 'cvpu' ? 'cvpu' : 'alert')) throw new Error('pilihan alert/cvpu gagal');
    await simpanSekali('Simpan dan Selesai');
  });
}

// ===========================================================================
// 🌵 MESIN FORM KAKTUS — disusun dari struktur form Ecalyptus hasil rekaman
// (Asesmen Awal, Discharge Planning, Checklist Orientasi, Edukasi Terintegrasi).
// Prinsip: hanya mengisi kolom yang dikenal PERSIS (nama kolom / label); pertanyaan
// yang artinya belum diketahui TIDAK ditebak, melainkan ditanyakan lewat percakapan
// Kaktus (jawaban boleh diingat). Blok TTV tidak disentuh.
// ===========================================================================
const KAKTUS_PROFIL_BAWAAN = { agama: 'Islam', pendidikan: 'SMA', bahasa: 'Indonesia', tinggal: 'Rumah pribadi', penerima: 'Pasien', estimasiHari: 3 };
const kfBaca = (k, bawaan) => { try { return JSON.parse(localStorage.getItem(k)) || bawaan; } catch (e) { return bawaan; } };
const kfTulis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* tanpa penyimpanan */ } };
const kfProfil = () => ({ ...KAKTUS_PROFIL_BAWAAN, ...kfBaca('kaktusProfil', {}) });

const kfWadah = (inp) => inp.closest('label') || (inp.id && document.querySelector(`label[for="${CSS.escape(inp.id)}"]`)) || inp;
const kfLabelInput = (inp) => {
  const l = inp.closest('label') || (inp.id && document.querySelector(`label[for="${CSS.escape(inp.id)}"]`));
  return norm((l || inp.parentElement || inp).textContent);
};
const kfInputTampak = (tipe, nama) => Array.from(document.querySelectorAll(`input[type="${tipe}"]${nama ? `[name="${nama}"]` : ''}`)).filter(i => tampak(kfWadah(i)));

function kfKlik(inp, mau = true) {
  if (!inp) return false;
  if (inp.checked === mau) return true;
  kfWadah(inp).click();
  if (inp.checked !== mau) inp.click();
  return inp.checked === mau;
}
// Pilih opsi pada grup ber-nama. Label dicocokkan persis (besar/kecil huruf diabaikan), atau diawali.
function kfPilih(nama, label) {
  const lab = norm(label);
  const kand = Array.from(document.querySelectorAll(`input[name="${nama}"]`)).filter(i => tampak(kfWadah(i)));
  return kfKlik(kand.find(i => kfLabelInput(i) === lab) || kand.find(i => kfLabelInput(i).startsWith(lab)), true);
}
const kfAdaTerpilih = (nama) => Array.from(document.querySelectorAll(`input[name="${nama}"]`)).some(i => i.checked);
// Pilih berdasarkan label di seluruh halaman — hanya bila labelnya UNIK (kalau ganda, tidak ditebak)
function kfPilihLabel(label, tipe = 'radio') {
  const lab = norm(label);
  const kand = kfInputTampak(tipe).filter(i => kfLabelInput(i) === lab);
  return kand.length === 1 ? kfKlik(kand[0], true) : false;
}
function kfCentangSemua(kecuali = []) {
  const ex = new Set(kecuali.map(norm));
  let n = 0;
  kfInputTampak('checkbox').forEach(cb => { if (!ex.has(kfLabelInput(cb)) && !cb.checked && kfKlik(cb, true)) n++; });
  return n;
}
function kfIsiTeks(nama, nilai) {
  const el = Array.from(document.querySelectorAll(`[name="${nama}"]`)).find(e => tampak(e));
  if (!el) return false;
  if ((el.value || '').trim()) return true;     // tidak menimpa isian yang sudah ada
  ketikKeInputReact(el, String(nilai));
  return (el.value || '') === String(nilai);
}

// ---------------------------------------------------------------------------
// ASESMEN AWAL KEPERAWATAN — hanya kolom keperawatan; bagian MEDIS (dokter), GCS, perfusi,
// kulit/muskuloskeletal dan riwayat penyakit TIDAK diisi robot (penilaian klinis perawat/dokter).
// ---------------------------------------------------------------------------
function kfIsiAsesmenAwal(config, profil) {
  const t = { ok: 0, gagal: [] };
  const radio = (nama, label) => {
    if (!document.querySelector(`input[name="${nama}"]`)) { t.gagal.push(`${nama} (kolom tidak ada)`); return; }
    if (kfAdaTerpilih(nama)) return;
    (kfPilih(nama, label) ? t.ok++ : t.gagal.push(`${nama}=${label}`));
  };
  const cek = (nama, label) => {
    if (!document.querySelector(`input[name="${nama}"]`)) { t.gagal.push(`${nama} (kolom tidak ada)`); return; }
    if (kfAdaTerpilih(nama)) return;
    (kfPilih(nama, label) ? t.ok++ : t.gagal.push(`${nama}=${label}`));
  };
  radio('kesulitan_bernafas', 'Tidak');
  radio('kesadaran', 'Normal');
  radio('penurunan_berat_badan', 'Tidak terjadi penurunan berat badan');
  radio('mengalami_asupan_makan', 'Tidak');
  // Permintaan Abi: KDRT, zat adiktif, ide bunuh diri → langsung "Tidak"
  radio('mengalami_kekerasan_dan_atau_kdrt', 'Tidak');
  radio('melakukan_kekerasan_dan_atau_kdrt', 'Tidak');
  radio('memakai_zat_adiktif', 'Tidak');
  radio('ide_bunuhdiri', 'Tidak');
  radio('hubungan_pasien_dengan_anggota_keluarga', 'Baik');
  radio('tempat_tinggal', profil.tinggal);
  ['mobilisasi', 'berpakaian', 'personal', 'makan_minum', 'toileting'].forEach(n => radio(n, 'Mandiri'));
  radio('gangguan_fungsional', 'Tidak Ada');
  radio('skrining_resiko_jatuh', 'Tidak');
  radio('skrining_nyeri', 'Ya');             // selaras dengan Asesmen Nyeri pasien baru (skala 2)
  radio('resiko_sosial', 'Tidak ada');
  radio('dampak_hospitalisasi', 'Pasrah');
  cek('masalah_perkemihan', 'Tidak ada');
  cek('masalah_defeksi', 'Tidak ada');
  cek('alat_bantu', 'Tidak ada');
  if (config.masalahKeperawatan) (kfIsiTeks('masalah_keperawatan', config.masalahKeperawatan) ? t.ok++ : t.gagal.push('masalah_keperawatan'));
  // TTV: HANYA angka nyata hasil bacaan CPPT dokter (tidak dikarang, tidak digeser).
  const v = config.ttvAsesmenAwal || {};
  [['tekanan_darah_sistole', v.sistolik], ['tekanan_darah_diastole', v.diastolik], ['nadi', v.hr], ['suhu', v.suhu], ['pernafasan', v.rr], ['perfungsi_spo2', v.spo2]]
    .forEach(([nm, val]) => { if (val) (kfIsiTeks(nm, String(val).replace(',', '.')) ? t.ok++ : t.gagal.push(nm)); });
  return t;
}

// Pemilih tanggal Material-UI (dialog kalender + tombol OK): klik hari target lalu OK
async function kfIsiTanggalPicker(inp, tambahHari) {
  const hariIni = new Date(), tgt = new Date(); tgt.setDate(tgt.getDate() + tambahHari);
  try { inp.scrollIntoView({ block: 'center' }); } catch (e) {}
  inp.click(); inp.focus();
  const dlg = await tunggu(() => Array.from(document.querySelectorAll('[role="dialog"], .MuiDialog-root, [class*="PickersModal"], .MuiPopover-root')).find(tampak), 3500);
  if (!dlg) return false;
  if (tgt.getMonth() !== hariIni.getMonth()) {
    const sw = dlg.querySelector('[class*="switchHeader"]');
    const bs = sw ? Array.from(sw.querySelectorAll('button')) : [];
    if (bs.length >= 2) { bs[bs.length - 1].click(); await jeda(500); }
  }
  const hari = Array.from(dlg.querySelectorAll('button')).filter(b => tampak(b) && norm(b.textContent) === String(tgt.getDate()) && !b.disabled && !/hidden|outside/i.test(String(b.className)));
  if (!hari.length) return false;
  hari[0].click(); await jeda(450);
  for (let k = 0; k < 3; k++) {
    const ok = Array.from(dlg.querySelectorAll('button')).find(b => tampak(b) && /^ok$/i.test(norm(b.textContent)));
    if (!ok) break;
    ok.click(); await jeda(550);
    if (!tampak(dlg)) break;
  }
  return !!(inp.value || '').trim();
}

// ---------------------------------------------------------------------------
// DISCHARGE PLANNING — 11 pasang radio Ya/Tidak tanpa nama (no.3 berupa centang).
// Dipetakan menurut URUTAN dan hanya dipakai bila bentuknya persis 22 radio Ya,Tidak,Ya,Tidak…
// ---------------------------------------------------------------------------
function kfIsiDischarge() {
  const t = { ok: 0, gagal: [] };
  const rd = kfInputTampak('radio').filter(i => !i.name);
  const bentukBenar = rd.length === 22 && rd.every((r, i) => kfLabelInput(r) === (i % 2 ? 'tidak' : 'ya'));
  if (!bentukBenar) {
    t.gagal.push(`bentuk form tak sesuai rekaman (${rd.length} pilihan Ya/Tidak, seharusnya 22) — radio tidak diisi`);
  } else {
    // urutan pasangan: no.1,2,4,5,6,7,8,9,10,11,12 → "Ya" hanya untuk no.4 (ada yang membantu) & no.11 (perlu edukasi)
    const YA = new Set([2, 9]);
    for (let p = 0; p < 11; p++) (kfKlik(rd[p * 2 + (YA.has(p) ? 0 : 1)], true) ? t.ok++ : t.gagal.push(`pertanyaan ke-${p + 1}`));
  }
  ['Minum Obat', 'Transportasi'].forEach(l => (kfPilihLabel(l, 'checkbox') ? t.ok++ : t.gagal.push('centang ' + l)));
  return t;
}

// ---------------------------------------------------------------------------
// CHECKLIST ORIENTASI & EDUKASI TERINTEGRASI — label unik; sisanya ditanyakan.
// ---------------------------------------------------------------------------
function kfIsiChecklist(profil) {
  const t = { ok: 0, gagal: [] };
  (kfPilihLabel(profil.penerima, 'checkbox') ? t.ok++ : t.gagal.push('penerima ' + profil.penerima));
  t.ok += kfCentangSemua(['Pasien', 'Keluarga', 'Lain-lain', 'Tidak bisa dilakukan']);   // semua butir orientasi
  return t;
}
function kfIsiEdukasi(profil) {
  const t = { ok: 0, gagal: [] };
  const lab = (l, tipe = 'radio') => { if (kfLabelSudah(l, tipe)) return; (kfPilihLabel(l, tipe) ? t.ok++ : t.gagal.push(l)); };
  lab(profil.pendidikan); lab(profil.agama); lab(profil.bahasa);
  lab('Aktif'); lab('Mampu dan mau');
  lab(profil.penerima === 'Keluarga' ? 'Wali/Keluarga' : 'Pasien');
  // Hambatan: hanya "Tidak Ada Hambatan"
  lab('Tidak Ada Hambatan', 'checkbox');
  // Topik edukasi (tanpa ASI/PMK/IMD yang khusus ibu-bayi) + metode + evaluasi
  const TOPIK = ['Cara cuci tangan yang aman', 'Penggunaan obat yang aman', 'Penggunaan alat medis yang aman', 'Potensi interaksi obat dan obat–makanan', 'Pedoman nutrisi', 'Manajemen nyeri', 'Teknik rehabilitasi',
    'Kondisi kesehatan, diagnosis pasti dan penatalaksanaan', 'Perkiraan biaya/jaminan', 'Hasil perawatan yang diharapkan termasuk kemungkinan yang tidak diharapkan', 'Proses pemberian informed consent', 'Bahaya merokok',
    'Hak dan Kewajiban Pasien', 'Peraturan/ Tata tertib RS', 'Peran keluarga dalam asuhan', 'Perkiraan biaya jaminan', 'Penjelasan', 'Diskusi', 'Brosur/ Lembar balik', 'Mampu menjelaskan kembali'];
  TOPIK.forEach(l => lab(l, 'checkbox'));
  // Label panjang dicocokkan lewat awalan
  kfInputTampak('checkbox').forEach(cb => {
    const l = kfLabelInput(cb);
    if (!cb.checked && (l.startsWith('kondisi kesehatan, diagnosis') || l.startsWith('hasil perawatan yang diharapkan') || l.startsWith('informasi jenis pelayanan')) && kfKlik(cb, true)) t.ok++;
  });
  (kfIsiTeks('keterangan_edukasi_yang_diberikan', 'Edukasi hak dan kewajiban pasien, tata tertib RS, peran keluarga, jenis pelayanan dan biaya/jaminan') ? t.ok++ : t.gagal.push('keterangan edukasi'));
  (kfIsiTeks('tanggapan_keluarga_atau_pasien', 'Pasien/keluarga mengerti') ? t.ok++ : t.gagal.push('tanggapan'));
  return t;
}
function kfLabelSudah(l, tipe) { const lb = norm(l); return kfInputTampak(tipe).some(i => i.checked && kfLabelInput(i) === lb); }

// Grup radio TANPA nama yang belum terpilih → daftar pertanyaan untuk ditanyakan ke pengguna
function kfGrupBelumTerjawab(abaikan = []) {
  const radios = kfInputTampak('radio').filter(i => !i.name);
  const peta = new Map();
  radios.forEach(r => {
    let a = kfWadah(r).parentElement;
    while (a && a.querySelectorAll('input[type="radio"]').length < 2 && a.parentElement) a = a.parentElement;
    if (!peta.has(a)) peta.set(a, []);
    peta.get(a).push(r);
  });
  const hasil = [];
  peta.forEach(list => {
    let cur = [], lab = new Set();
    list.forEach(r => { const l = kfLabelInput(r); if (lab.has(l)) { hasil.push(cur); cur = []; lab = new Set(); } cur.push(r); lab.add(l); });
    if (cur.length) hasil.push(cur);
  });
  return hasil.filter(g => g.length && !g.some(i => i.checked) && !abaikan.some(a => g.some(i => kfLabelInput(i) === norm(a))));
}
function kfTeksDekat(grup) {
  const opsi = new Set(grup.map(kfLabelInput));
  let el = kfWadah(grup[0]);
  for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
    let p = el.previousElementSibling;
    while (p) {
      const t = (p.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length >= 4 && t.length <= 200 && !opsi.has(norm(t))) return t;
      p = p.previousElementSibling;
    }
  }
  return '';
}
// Jawaban yang pernah diajarkan dipakai; sisanya TIDAK ditanyakan (Kaktus jalan terus) — didaftar untuk laporan akhir
let KF_SISA = [];
async function kfTanyaSisa(konteks, abaikan = []) {
  const simpan = kfBaca('kaktusJawab', {});
  let dipakai = 0, dilewati = 0;
  for (const g of kfGrupBelumTerjawab(abaikan)) {
    const teks = kfTeksDekat(g) || '(teks pertanyaan tidak terbaca)';
    const labelAsli = g.map(i => (kfWadah(i).textContent || '').trim());
    const kunci = norm(konteks + '|' + teks + '|' + g.map(kfLabelInput).join('/'));
    const tersimpan = simpan[kunci] && g.find(i => kfLabelInput(i) === norm(simpan[kunci]));
    if (tersimpan && kfKlik(tersimpan, true)) { dipakai++; continue; }
    dilewati++; KF_SISA.push({ konteks, teks, opsi: labelAsli });
  }
  return { dipakai, ditanya: 0, dilewati };
}
function kfLapor(nama, t, sisa) {
  const info = sisa ? `${sisa.dipakai ? `, ${sisa.dipakai} jawaban ingatan dipakai` : ''}${sisa.ditanya ? `, ${sisa.ditanya} dijawab lewat percakapan` : ''}` : '';
  catat(`${t.gagal.length || (sisa && sisa.dilewati) ? 'Catatan' : 'OK'}: ${nama}: ${t.ok} kolom terisi${info}${t.gagal.length ? '; TIDAK terisi: ' + t.gagal.join(', ') : ''}${sisa && sisa.dilewati ? `; ${sisa.dilewati} pertanyaan dilewati (isi manual)` : ''}.`);
}

// ---------------------------------------------------------------------------
// 🆕 ESTAFET LENGKAP PASIEN BARU (6 FORM SESUAI VIDEO & ECALFORM.ZIP)
// ---------------------------------------------------------------------------
async function jalankanAlurPasienBaru(config) {
  cekStop();
  kunciPasien(config);

  // Intip CPPT Dokter / IGD terlebih dahulu untuk menentukan 1 Diagnosa SDKI Terkuat & TTV Awal
  let diagnosaPasienBaru = (config.masalahKeperawatan || '').trim();
  let ttvDokter = {};
  await langkah('Intip CPPT Dokter/IGD', async () => {
    if (!location.hash.includes('/activity-patient')) {
      const btnIsi = Array.from(document.querySelectorAll('button, span, a'))
        .find(el => tampak(el) && /isi\s*soapie|cppt/i.test((el.textContent || '').trim()));
      if (btnIsi) targetKlik(btnIsi).click();
      else location.hash = '#/activity-patient';
      await tunggu(() => location.hash.includes('/activity-patient'), 6000);
    }
    const tab = await tunggu(() => cariTeks('CPPT', 'button, span, p'), 4000);
    if (tab) {
      targetKlik(tab).click();
      await tunggu(() => bacaCpptEntri().length > 0, 5000);
      const entri = bacaCpptEntri();
      const dok = terbaru(entri);
      if (dok) {
        const sdki = tentukanDiagnosaSdki({ subjective: dok.s, objective: dok.o, analysis: dok.a, planning: dok.p });
        if (!diagnosaPasienBaru) diagnosaPasienBaru = sdki.utama;
        ttvDokter = ekstrakTtvDariObjektif(dok.o);
        config.companionSoap = {
          subjective: dok.s || config.companionSoap?.subjective || '',
          objective: dok.o || config.companionSoap?.objective || '',
          analysis: dok.a || config.companionSoap?.analysis || '',
          planning: dok.p || config.companionSoap?.planning || ''
        };
      }
    }
  });
  if (!diagnosaPasienBaru) diagnosaPasienBaru = 'Nyeri akut';
  catat(`Masalah Keperawatan Pasien Baru: ${diagnosaPasienBaru}`);
  if (config.kamarTujuan) await langkah('0b. Simpan pasien ke SIMPAN (CPPT dokter, Lab, Radiologi)', () => kaktusTangkapKeSimpan(config.kamarTujuan));

  // 1. ASESMEN AWAL KEPERAWATAN (nama kolom dari rekaman form; bagian MEDIS tidak disentuh)
  const profilKf = kfProfil();
  await langkah('1. Asesmen Awal Keperawatan', async () => {
    if (!location.hash.includes('/patient/assessment')) {
      const ok = await klikTeks('Asesmen Awal');
      if (!ok) location.hash = '#/patient/assessment';
      await tunggu(() => location.hash.includes('/patient/assessment'), 8000);
    }
    const tabKep = cariTeks('Asesmen Keperawatan', 'button, span, div, a');
    if (tabKep) { targetKlik(tabKep).click(); await jeda(500); }
    await tunggu(() => document.querySelector('input[name="kesulitan_bernafas"]'), 6000);

    const t = kfIsiAsesmenAwal({ ...config, masalahKeperawatan: diagnosaPasienBaru, ttvAsesmenAwal: ttvDokter }, profilKf);
    kfLapor('Asesmen Awal Keperawatan', t);
    await jeda(300);

    const btnSimpan = cariTeks('Simpan dan Selesai', 'button, span') || cariTeks('Simpan', 'button, span');
    if (btnSimpan && tombolAktif(btnSimpan)) await simpanSekali(btnSimpan.textContent.trim());
    else catat('Catatan: Asesmen Awal belum disimpan: tombol Simpan belum aktif (ada kolom wajib yang kosong, mis. GCS/TTV/riwayat penyakit). Lengkapi lalu simpan manual.');
  });

  // 2. NYERI (SKALA 2), RISIKO JATUH & EWS
  await jalankanModulAsesmen({ ...config, isPasienBaru: true, skalaNyeri: '2', ...ttvDokter });

  // 3. DISCHARGE PLANNING
  await langkah('3. Discharge Planning', async () => {
    const tabDp = await tunggu(() => cariTeks('Discharge Planning', 'button, span, div, a'), 5000);
    if (!tabDp) throw new Error('Tab Discharge Planning tidak ditemukan');
    targetKlik(tabDp).click();
    await tunggu(() => document.querySelector('input[name="tgl_rencana_est"]'), 6000);
    await jeda(400);

    const teksSebelum = new Set(Array.from(document.querySelectorAll('input[type="text"], textarea')).filter(tampak));
    const t = kfIsiDischarge();
    await jeda(400);
    // Kolom isian yang BARU muncul setelah memilih "Ya" (mis. siapa yang membantu) — urutan isian milik Abi
    const TeksIsianDp = ['tidak kerja', 'dijemput', 'keluarga', 'edukasi minum obat'];
    const baru = Array.from(document.querySelectorAll('input[type="text"], textarea')).filter(el => tampak(el) && !teksSebelum.has(el) && !(el.value || '').trim());
    baru.forEach((inp, idx) => { if (TeksIsianDp[idx]) { ketikKeInputReact(inp, TeksIsianDp[idx]); t.ok++; } });
    kfLapor('Discharge Planning', t);

    // Estimasi tanggal pulang (wajib): pilih lewat kalender, hari ini + estimasiHari (bawaan 3), bisa kamu ubah
    const tgl = document.querySelector('input[name="tgl_rencana_est"]');
    if (tgl && !(tgl.value || '').trim()) {
      const okTgl = await kfIsiTanggalPicker(tgl, profilKf.estimasiHari || 3).catch(() => false);
      catat(okTgl ? `OK: Estimasi pulang terisi ${tgl.value} (hari ini +${profilKf.estimasiHari || 3}; ubah bila perlu)` : 'Catatan: Estimasi Tanggal Pemulangan gagal diisi otomatis, Discharge Planning tidak disimpan (isi tanggal lalu Simpan).');
    }
    const btnSimpanDp = cariTeks('Simpan', 'button, span');
    if (tgl && (tgl.value || '').trim() && btnSimpanDp && tombolAktif(btnSimpanDp)) await simpanSekali(btnSimpanDp.textContent.trim());
    else if (tgl && (tgl.value || '').trim()) catat('Catatan: Discharge Planning belum disimpan: tombol Simpan belum aktif.');
  });

  // 4. TRANSFER PASIEN — hanya klik "Terima Pasien" (tidak menyimpan form transfer lain)
  await langkah('4. Transfer Pasien', async () => {
    const menuTrf = cariTeks('Transfer Pasien', 'a, span, div, li');
    if (menuTrf) targetKlik(menuTrf).click();
    else location.hash = '#/patient/patient-transfer';
    await tunggu(() => location.hash.includes('/patient/patient-transfer'), 6000);
    await jeda(800);
    const btnTerima = Array.from(document.querySelectorAll('button, span')).find(el => tampak(el) && /^terima\s*pasien$/i.test(norm(el.textContent)));
    if (!btnTerima) { catat('Catatan: Tombol "Terima Pasien" tidak ada di halaman Transfer (pasien mungkin bukan transfer antar ruangan / sudah diterima). Dilewati.'); return; }
    if (!tombolAktif(btnTerima)) { catat('Catatan: Tombol "Terima Pasien" belum aktif. Dilewati.'); return; }
    await simpanSekali(btnTerima.textContent.trim());
  });

  // 5. CHECKLIST ORIENTASI PASIEN BARU + TTD Pemberi (#/signature-recorder/checklist)
  await langkah('5. Checklist Orientasi + TTD', async () => {
    location.hash = '#/signature-recorder/checklist';
    await tunggu(() => location.hash.includes('/signature-recorder/checklist'), 6000);
    await tunggu(() => kfInputTampak('checkbox').length > 5, 6000);
    await jeda(500);
    const t = kfIsiChecklist(profilKf);
    const sisa = await kfTanyaSisa('Checklist Orientasi');
    kfLapor('Checklist Orientasi', t, sisa);
    await isiTandaTanganCanvas(config.ttdPerawat || '');
    const btnSimpan = cariTeks('Simpan', 'button, span');
    if (btnSimpan && tombolAktif(btnSimpan)) await simpanSekali(btnSimpan.textContent.trim());
    else catat('Catatan: Checklist Orientasi belum disimpan: tombol Simpan belum aktif (mungkin TTD/penerima belum lengkap).');
  });

  // 6. EDUKASI TERINTEGRASI + TTD Pemberi (#/signature-recorder/record-daily)
  await langkah('6. Edukasi Terintegrasi + TTD', async () => {
    location.hash = '#/signature-recorder/record-daily';
    await tunggu(() => location.hash.includes('/signature-recorder/record-daily'), 6000);
    await tunggu(() => kfInputTampak('checkbox').length > 10, 6000);
    await jeda(500);
    const t = kfIsiEdukasi(profilKf);
    const sisa = await kfTanyaSisa('Edukasi Terintegrasi', ['Diagnosis kompleks & / problem prone', 'Permasalahan pemulangan kompleks']);
    kfLapor('Edukasi Terintegrasi', t, sisa);
    await isiTandaTanganCanvas(config.ttdPerawat || '');
    const btnSimpanEdu = cariTeks('Simpan', 'button, span');
    if (btnSimpanEdu && tombolAktif(btnSimpanEdu)) await simpanSekali(btnSimpanEdu.textContent.trim());
    else catat('Catatan: Edukasi belum disimpan: tombol Simpan belum aktif (mungkin "Pilih Tindakan"/tanggal edukasi/TTD belum lengkap).');
  });

  // 7. Buka halaman CPPT & Draft SOAPIE agar siap disedot ke SIMPAN & Cetak E-OA
  await jalankanModulSoapie(config);
}

// ---------------------------------------------------------------------------
// 2. OBAT (KAMUS SINONIM + SINKRON JAM DOSIS CPO SIMPAN)
// ---------------------------------------------------------------------------
function bacaTanggalHeader() {
  const baris1 = document.querySelector('table thead tr');
  if (!baris1) return [];
  const hasil = [];
  let kolom = 0;
  Array.from(baris1.querySelectorAll(':scope > th')).forEach(th => {
    const span = parseInt(th.getAttribute('colspan') || '1', 10);
    const m = th.textContent.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) hasil.push({ tgl: new Date(+m[3], +m[2] - 1, +m[1]), kolom0: kolom, span });
    if (!th.getAttribute('rowspan')) kolom += span;
  });
  return hasil;
}

function bacaBarisObat() {
  const tanggal = bacaTanggalHeader();
  return Array.from(document.querySelectorAll('table tbody tr')).map(tr => {
    const tds = Array.from(tr.querySelectorAll(':scope > td'));
    if (tds.length < 5) return null;
    const spans = Array.from(tds[0].querySelectorAll('span')).map(s => s.textContent.trim()).filter(Boolean);
    const nama = spans[0] || '';
    const aturan = spans[1] || '';
    const m = aturan.match(/^(\d+)\s*x\s*\d/i);
    const riwayat = [];
    tds.slice(1).forEach((td, c) => {
      const jam = (td.innerText || td.textContent || '').match(/(\d{1,2})[:.](\d{2})/);
      if (!jam) return;
      const t = tanggal.find(x => c >= x.kolom0 && c < x.kolom0 + x.span);
      if (!t) return;
      const geser = (c - t.kolom0) % 4 === 3 && +jam[1] < 12 ? 1 : 0;
      riwayat.push(new Date(t.tgl.getFullYear(), t.tgl.getMonth(), t.tgl.getDate() + geser, +jam[1], +jam[2]));
    });
    return {
      tr, nama, aturan,
      frekuensi: m ? parseInt(m[1], 10) : null,
      riwayat,
      terisi: riwayat.length,
      plus: tds[0].querySelector('button')
    };
  }).filter(b => b && b.nama);
}

function akhirShift(now, shift) {
  const d = new Date(now);
  const akhir = shift === 'pagi' ? 14 : shift === 'siang' ? 21 : 8;
  d.setHours(akhir, 0, 0, 0);
  if (shift === 'malam' && now.getHours() >= 21) d.setDate(d.getDate() + 1);
  return d;
}
const jamStr = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const KAMUS_OBAT = [
  ['asam traneksamat', 'kalnex', 'plasminex', 'tranexamic'],
  ['paracetamol', 'parasetamol', 'pct', 'sanmol', 'pamol', 'fasgo', 'tamoliv', 'ottopan'],
  ['asetilsistein', 'acetylcysteine', 'en-asetilsistein', 'n-acetylcysteine', 'nasetil', 'nac', 'fluimucil'],
  ['ondansetron', 'narfoz', 'invomit', 'ondan', 'vometron', 'trovensis'],
  ['ketorolac', 'ketorolak', 'toradol', 'keto', 'farpain', 'remopain'],
  ['deksketoprofen', 'dexketoprofen', 'ketesse', 'tordex'],
  ['mecobalamin', 'mekobalamin', 'kalmeco', 'methycobal'],
  ['ceftriaxone', 'seftriakson', 'ceftri', 'seftri', 'broadced', 'terfacef'],
  ['cefotaxime', 'sefotaksim', 'cefotaxim', 'kalfoxim'],
  ['ceftazidime', 'seftazidim', 'fortum'],
  ['cefixime', 'sefiksim', 'cefspan', 'sporetik'],
  ['ciprofloxacin', 'siprofloksasin', 'cipro', 'sipro', 'baquinor'],
  ['levofloxacin', 'levofloksasin', 'cravit', 'levo'],
  ['metronidazole', 'metronidazol', 'flagyl', 'metro'],
  ['sukralfat', 'sucralfate', 'epicral', 'inpepsa', 'epsacral'],
  ['furosemid', 'furosemide', 'lasix', 'farsix', 'roxemid'],
  ['omeprazole', 'omeprazol', 'ome', 'pumpitor', 'inhipump', 'ozid'],
  ['pantoprazole', 'pantoprazol', 'panto', 'pantopump', 'vomizole'],
  ['lansoprazole', 'lansoprazol', 'lanso', 'prosogan'],
  ['ranitidin', 'ranitidine', 'acran', 'ratinal'],
  ['amlodipin', 'amlodipine', 'amlo', 'tensivask', 'norvask'],
  ['kandesartan', 'candesartan', 'blopress', 'canderin'],
  ['natrium bikarbonat', 'sodium bicarbonate', 'bicarbonate', 'meylon', 'nabic', 'bicnat'],
  ['fitomenadion', 'vitamin k', 'vit k', 'phytomenadione', 'vitadion'],
  ['combivent', 'farbivent'],
  ['pulmicort', 'budesonide', 'budesonid', 'flutison'],
];

function grupObatDariNama(nama) {
  const tok = String(nama || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const padded = ` ${tok.join(' ')} `;
  const ketemu = new Set();
  KAMUS_OBAT.forEach((grup, idx) => {
    for (const a of grup) {
      const al = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!al) continue;
      if (padded.includes(` ${al} `)) { ketemu.add(idx); break; }
      if (!al.includes(' ') && al.length >= 6 && tok.some(x => x.startsWith(al))) { ketemu.add(idx); break; }
    }
  });
  return ketemu;
}

const POLA_INSULIN = /(?:insulin|sansulin|lantus|levemir|novorapid|novomix|humalog|humulin|mixtard|actrapid|apidra|toujeo|tresiba|basaglar|ezelin)/i;
function jenisInsulin(nama = '') {
  const t = String(nama).toLowerCase();
  if (!POLA_INSULIN.test(t)) return undefined;
  if (/\b(needle|jarum|spuit|syringe)\b/.test(t)) return null;
  if (/glargine|lantus|toujeo|basaglar|\blog[\s\-]?g\b|sansulin[\s\-]*log|ezelin/.test(t)) return 'glargine';
  if (/levemir|detemir/.test(t)) return 'detemir';
  if (/novorapid|aspart/.test(t) && !/novomix/.test(t)) return 'aspart';
  if (/apidra|glulisine/.test(t)) return 'glulisine';
  if (/humalog|lispro/.test(t)) return 'lispro';
  if (/actrapid/.test(t)) return 'actrapid';
  if (/sansulin[\s\-]*rapid/.test(t)) return 'sansulin-rapid';
  return null;
}

function cocokNamaObatCpo(namaEcal = '', daftarCpo = []) {
  if (!Array.isArray(daftarCpo) || !daftarCpo.length) return false;
  const jE = jenisInsulin(namaEcal);
  if (jE !== undefined) return !!jE && daftarCpo.some(m => jenisInsulin(m) === jE);
  if (daftarCpo.some(m => { const jc = jenisInsulin(m); return jc !== undefined && POLA_INSULIN.test(String(namaEcal)); })) return false;

  const gE = grupObatDariNama(namaEcal);
  if (gE.size && daftarCpo.some(m => { const gC = grupObatDariNama(m); for (const g of gE) if (gC.has(g)) return true; return false; })) return true;

  const bersihkan = (s) => String(s).toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:ivfd|inj|injeksi|serb|lar|inf|tab|tablet|kaps|kapsul|syr|sirup|po|iv|im|sc|drip|nebu|otsuka|sanbe|vial|amp|fls)\b/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|gr|g|mcg|ml|iu|tpm|x)\b/g, ' ')
    .replace(/[^a-z]/g, '')
    .trim();

  const kEcal = bersihkan(namaEcal);
  if (kEcal.length < 3) return false;

  const normEjaan = (s) => s.replace(/^sef/, 'cef').replace(/^sipro/, 'cipro').replace(/kson$/, 'xone').replace(/ksim$/, 'xime');
  const e1 = normEjaan(kEcal);

  return daftarCpo.some(medCpo => {
    const kCpo = bersihkan(medCpo);
    if (kCpo.length < 3) return false;
    const c1 = normEjaan(kCpo);
    if (Math.min(kEcal.length, kCpo.length) < 5) return kEcal === kCpo;
    return kEcal.includes(kCpo) || kCpo.includes(kEcal) || e1.includes(c1) || c1.includes(e1);
  });
}

function putuskanObat(baris, now, shift, toleransiJam, cpoCheckedMeds = []) {
  const sudahDiCpo = cocokNamaObatCpo(baris.nama, cpoCheckedMeds);

  if (baris.riwayat.length > 0) {
    const terakhir = new Date(Math.max(...baris.riwayat.map(d => d.getTime())));
    const selisihJam = (now.getTime() - terakhir.getTime()) / 3600000;
    if (selisihJam >= 0 && selisihJam < 3) {
      return { isi: false, alasan: `sudah tercatat baru saja di Ecal (${jamStr(terakhir)})` };
    }
  }

  if (sudahDiCpo) {
    return { isi: true, info: `sinkron ceklis CPO SIMPAN (shift ${shift})` };
  }

  if (baris.frekuensi == null || baris.frekuensi < 1) return { isi: false, alasan: `aturan "${baris.aturan}" tidak terbaca (mungkin PRN)` };
  if (!baris.riwayat.length) return { isi: false, alasan: 'belum ada riwayat di Ecal & belum dicentang di CPO SIMPAN' };
  const terakhir = new Date(Math.max(...baris.riwayat.map(d => d.getTime())));
  const selang = (24 / baris.frekuensi) * 3600 * 1000;
  const berikut = new Date(terakhir.getTime() + selang);
  const batas = new Date(Math.min(now.getTime() + toleransiJam * 3600 * 1000, akhirShift(now, shift).getTime()));
  if (berikut.getTime() > batas.getTime()) return { isi: false, alasan: `belum waktunya (terakhir ${jamStr(terakhir)}, berikut ±${jamStr(berikut)})` };
  const telat = (now.getTime() - berikut.getTime()) / 3600000;
  if (telat > toleransiJam) return { isi: false, alasan: `TERLAMBAT ${telat.toFixed(1)} jam dari jadwal (terakhir ${jamStr(terakhir)}, jadwal ±${jamStr(berikut)}), cek manual` };
  return { isi: true, info: `terakhir ${jamStr(terakhir)}, jadwal berikut ±${jamStr(berikut)}` };
}

function dosisCpoUntukObat(namaEcal, config) {
  const out = [];
  (config.cpoCheckedDetail || []).forEach(d => {
    if (!cocokNamaObatCpo(namaEcal, [d.nama])) return;
    (d.doses || []).forEach(x => out.push(x));
  });
  return out;
}

function tanggalNyataDosis(x) {
  const [y, m, d] = String(x.tgl || '').split('-').map(Number);
  const mm = String(x.jam || '').match(/(\d{1,2})[:.](\d{2})/);
  const jam = mm ? +mm[1] : 0, mnt = mm ? +mm[2] : 0;
  const geser = (x.slot === 'jam_06' || x.slot === 'jam_24') && jam < 12 ? 1 : 0;
  return new Date(y, (m || 1) - 1, (d || 1) + geser, jam, mnt);
}

function dosisMilikSaya(by, config) {
  if (!config.hanyaDosisSaya || !config.perawat || !by) return true;
  const a = String(by).toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = String(config.perawat).toLowerCase().replace(/[^a-z0-9]/g, '');
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

async function aturWaktuDiberikan(dlg, hhmm) {
  const semuaInput = Array.from(dlg.querySelectorAll('input')).filter(i => !['radio', 'checkbox', 'hidden'].includes(i.type));
  const el = semuaInput.find(i => /^\d{1,2}[:.]\d{2}$/.test((i.value || '').trim()))
    || semuaInput.find(i => /waktu|time/i.test(`${i.getAttribute('aria-label') || ''}${i.name || ''}${i.id || ''}`));
  if (!el) return { ok: false, alasan: 'kolom Waktu Diberikan tidak ditemukan' };
  const norm5 = (s) => { const m = String(s || '').trim().match(/^(\d{1,2})[:.](\d{2})$/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
  const sama = () => norm5(el.value) === hhmm;
  if (sama()) return { ok: true };
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  el.focus(); await jedaMs(80);
  if (setter) setter.call(el, hhmm);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await jedaMs(250);
  if (!sama()) {
    el.focus(); el.select();
    try { document.execCommand('insertText', false, hhmm); } catch (e) {}
    await jedaMs(250);
  }
  el.blur(); await jedaMs(250);
  return sama() ? { ok: true } : { ok: false, alasan: `nilai akhir "${el.value}"` };
}

async function tutupPopupObat() {
  document.querySelector('div[role="dialog"] svg[data-icon="times"]')?.parentElement?.click();
  await tunggu(() => !document.querySelector('div[role="dialog"]'), 3000);
}

async function catatSatuDosis(baris, jam, config, kep) {
  const b0 = bacaBarisObat().find(x => x.nama === baris.nama) || baris;
  if (!b0.plus) { catat(`Obat dilewati: ${baris.nama} (tombol + tidak ada)`); return false; }
  pastikanPasienSama();
  b0.plus.scrollIntoView({ block: 'center' });
  b0.plus.click();
  const dlg = await tunggu(() => document.querySelector('div[role="dialog"] input[name="position"]') && document.querySelector('div[role="dialog"]'), 6000);
  if (!dlg) { catat(`GAGAL: pop-up obat tidak terbuka untuk ${baris.nama}`); return false; }

  const namaDlg = norm(dlg.querySelector('p')?.nextElementSibling?.textContent || dlg.textContent);
  if (!namaDlg.includes(norm(baris.nama))) {
    catat(`GAGAL: nama di pop-up tidak sama dengan baris (${baris.nama}), dibatalkan`);
    await tutupPopupObat();
    return false;
  }

  dlg.querySelector('input[name="position"][value="given"]').click();
  await jedaMs(200);

  if (jam) {
    const w = await aturWaktuDiberikan(dlg, jam);
    if (!w.ok) {
      if (config.obatBolehJamSekarang) {
        catat(`Catatan: ⚠️ ${baris.nama}: jam ${jam} gagal diatur (${w.alasan}), disimpan dengan jam sekarang`);
      } else {
        catat(`GAGAL: ${baris.nama}: jam ${jam} tidak bisa diatur (${w.alasan}). TIDAK disimpan, isi manual.`);
        await tutupPopupObat();
        return false;
      }
    }
  } else if (/^sinkron ceklis CPO/.test(kep.info || '')) {
    catat(`Catatan: ⚠️ ${baris.nama}: jam pemberian tidak ada di CPO SIMPAN, dicatat dengan jam sekarang`);
  }

  const tombol = await tunggu(() => {
    const t = cariTeks('Simpan pemberian', 'button span', dlg);
    const b = t && t.closest('button');
    return b && !b.disabled ? b : null;
  }, 5000);
  if (!tombol) { catat(`GAGAL: tombol Simpan pemberian tidak aktif untuk ${baris.nama}`); await tutupPopupObat(); return false; }

  pastikanPasienSama();
  tombol.click();
  const tertutup = await tunggu(() => !document.querySelector('div[role="dialog"]'), 15000);
  if (!tertutup) { catat(`GAGAL: pop-up tidak menutup setelah simpan (${baris.nama}), cek manual`); throw new Error('Obat berhenti: pop-up macet, cek layar.'); }
  await tunggu(() => !sedangKirim(), 10000);
  const sesudah = await tunggu(() => { const b = bacaBarisObat().find(x => x.nama === baris.nama); return b && b.terisi > b0.terisi ? b : null; }, 10000);
  if (!sesudah) { catat(`GAGAL: ${baris.nama} disimpan tapi sel di tabel belum terisi, cek manual`); return false; }
  if (jam && !sesudah.riwayat.some(r => jamStr(r) === jam)) {
    catat(`Catatan: ⚠️ ${baris.nama}: tersimpan, tetapi jam di tabel Ecalyptus tidak terbaca ${jam}, cek manual`);
  }
  catat(`OK: obat ${baris.nama} dicatat diberikan${jam ? ' jam ' + jam : ''} (${kep.info})`);
  return true;
}

async function jalankanModulObat(config) {
  cekStop();
  kunciPasien(config);
  const simpan = config.obatSimpan !== false;
  const kecuali = String(config.obatKecuali || '').split(',').map(s => norm(s)).filter(Boolean);
  const cpoCheckedMeds = Array.isArray(config.cpoCheckedMeds) ? config.cpoCheckedMeds : [];

  if (!location.hash.includes('/patient/drug-administration')) {
    const ok = await klikTeks('Pemberian Obat');
    if (!ok) throw new Error('Menu "Pemberian Obat" tidak ditemukan.');
  }
  const siap = await tunggu(() => bacaBarisObat().length > 0, 10000);
  if (!siap) throw new Error('Tabel obat tidak termuat atau kosong.');

  if (cpoCheckedMeds.length > 0) {
    catat(`CPO SIMPAN (${cpoCheckedMeds.length} obat tercentang): ${cpoCheckedMeds.join(', ')}`);
  }

  const selesai = new Set();
  let jumlah = 0;
  for (let putaran = 0; putaran < 40; putaran++) {
    cekStop();
    const baris = bacaBarisObat().find(b => !selesai.has(b.nama));
    if (!baris) break;
    selesai.add(baris.nama);

    const lewati = (alasan) => catat(`Obat dilewati: ${baris.nama} (${alasan})`);
    if (kecuali.some(k => norm(baris.nama).includes(k) || norm(baris.aturan).includes(k))) { lewati('masuk daftar kecuali'); continue; }
    const tol = Number.isFinite(+config.obatToleransiJam) && config.obatToleransiJam !== '' ? +config.obatToleransiJam : 2;
    const kep = putuskanObat(baris, new Date(), tentukanShift(config), tol, cpoCheckedMeds);
    if (!kep.isi) { lewati(kep.alasan); continue; }
    if (!baris.plus) { lewati('tombol + tidak ada'); continue; }

    if (!simpan) { catat(`SIMULASI akan diberikan: ${baris.nama} ${baris.aturan} (${kep.info})`); continue; }

    let rencana = [{ jam: null }];
    if (/^sinkron ceklis CPO/.test(kep.info || '') && Array.isArray(config.cpoCheckedDetail) && config.cpoCheckedDetail.length) {
      const now = new Date();
      const kandidat = []; const lewatCatatan = [];
      const jamTerpakai = new Set();
      for (const x of dosisCpoUntukObat(baris.nama, config)) {
        if (!dosisMilikSaya(x.by, config)) continue;
        if (!x.jam) { if (!kandidat.some(k => !k.jam)) kandidat.push({ jam: null }); continue; }
        const dt = tanggalNyataDosis(x);
        if (dt.toDateString() !== now.toDateString()) { lewatCatatan.push(`${x.jam} (${x.tgl}) bukan hari ini, isi manual`); continue; }
        if (dt.getTime() > now.getTime() + 5 * 60000) { lewatCatatan.push(`${x.jam} masih di depan jam sekarang`); continue; }
        if (baris.riwayat.some(r => Math.abs(r.getTime() - dt.getTime()) <= 60 * 60000)) continue;
        const js = jamStr(dt);
        if (jamTerpakai.has(js)) { lewatCatatan.push(`2 dosis dicentang di jam sama ${js}, hanya 1 dicatat`); continue; }
        jamTerpakai.add(js);
        kandidat.push({ jam: js });
      }
      lewatCatatan.forEach(c => catat(`Catatan: ⚠️ ${baris.nama}: ${c}`));
      if (!kandidat.length) { lewati('dosis CPO sudah ada di Ecalyptus / bukan ceklismu / bukan hari ini'); continue; }
      kandidat.sort((p, q) => String(p.jam || '').localeCompare(String(q.jam || '')));
      rencana = kandidat;
    }
    for (const dosis of rencana) {
      cekStop();
      const ok = await catatSatuDosis(baris, dosis.jam, config, kep);
      if (ok) jumlah++;
    }
  }
  catat(simpan ? `Obat: ${jumlah} dicatat.` : 'Obat: mode SIMULASI, tidak ada yang disimpan.');
  return jumlah;
}

// ---------------------------------------------------------------------------
// 3. SOAPIE (DENGAN DIAGNOSA SDKI TERKUAT UNTUK SEMUA PASIEN)
// ---------------------------------------------------------------------------
const OBJEKTIF_BAKU = 'Kes CM, GCS 15\nmata ca +/+ si -/-\nThorax vbs +/+ rh-/- wh -/-\nCor BJ S1S2\nAbd supel timpani bu +\nExt akral hangat +/+ CRT <2" edem -/- nadi kuat +/+';
const PLAN_BAKU = 'Setelah dilakukan asuhan keperawatan diharapkan keluhan berkurang: ';
const TEMPLATE_SOAP = {
  pagi: {
    o: OBJEKTIF_BAKU,
    p: PLAN_BAKU,
    i: ['Jam 07.30 melakukan operan dengan dinas malam', 'Jam 08.00 operan keliling ke ruangan pasien', 'Jam 08.15 mengidentifikasi ulang keluhan pasien', 'Jam 08.30 Mengatur pasien semi fowler', 'Jam 09.00 memberikan oksigen 3 -5 lpm', 'Jam 09.30 memberikan sample darah ke ruang lab', 'Jam 10.00 menyiapkan therapi sesuai intruksi dari dokter', 'Jam 10.30 mendampingi dokter visite', 'Jam 11.00 Melakukan pemeriksaan TTV dan k/u pasien', 'Jam 12.00 memberikan therapi sesuai instruksi dari dokter', 'Jam 13.00 Melakukan dokumentasi asuhan keperawatan', 'Jam 14.00 melakukan operan dengan dinas siang'].join('\n'),
  },
  siang: {
    o: OBJEKTIF_BAKU,
    p: PLAN_BAKU,
    i: ['Jam 14.00 melakukan operan dengan dinas pagi', 'Jam 14.20 operan keliling ke ruangan pasien', 'Jam 15.00 mengidentifikasi ulang keluhan pasien', 'Jam 15.30 Mengatur pasien semi fowler', 'Jam 15.40 memberikan oksigen 3 -5 lpm', 'Jam 16.00 menyiapkan therapi sesuai intruksi dari dokter', 'Jam 17.35 Melakukan pemeriksaan TTV dan k/u pasien', 'Jam 17.40 memberikan therapi sesuai instruksi dari dokter', 'Jam 19.00 mengganti cairan infus', 'Jam 20.30 Melakukan dokumentasi asuhan keperawatan', 'Jam 21.00 melakukan operan dengan dinas malam'].join('\n'),
  },
  malam: {
    o: OBJEKTIF_BAKU,
    p: PLAN_BAKU,
    i: ['21:00 melakukan operan dines', '21:10 mengkaji ulang keluhan pasien', '22:00 mempertahankan posisi semifowler', '23:00 menyiapkan therapy sesuai advis dokter', '24:00 menganjurkan istirahat yang cukup memberikan terapi sesuai advis', '05:30 mengobservasi ttv dan k/u pasien,', '06:00 memberikan therapy & mengambil sampel darah sesuai advis dokter,', '06:30 menganjurkan mobilisasi', '07:00 melakukan dokumentasi asuhan keperawatan', '07:30 melakukan operan dines'].join('\n'),
  },
};

function bacaCpptEntri() {
  const peta = { subjektif: 's', objektif: 'o', assesmen: 'a', asesmen: 'a', rencana: 'p', implementasi: 'i' };
  const out = []; let cur = null, sec = null;
  for (const el of document.querySelectorAll('p, h6, span, div')) {
    if (!tampak(el) || el.children.length > 0) continue;
    const raw = (el.textContent || '').trim();
    const t = norm(raw);
    if (!t) continue;

    if (/^tanggal input/.test(t)) {
      cur = { tgl: null, header: '', s: '', o: '', a: '', p: '', i: '' };
      out.push(cur); sec = null; continue;
    }
    if (!cur) continue;

    if (!cur.tgl) {
      const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2})[:.](\d{2})/);
      if (m) { cur.tgl = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]); continue; }
    }

    if (peta[t]) { sec = peta[t]; continue; }

    if (!sec) cur.header += ' ' + raw;
    else if (sec !== 'i') cur[sec] += (cur[sec] ? '\n' : '') + raw;
  }
  return out.filter(e => e.tgl || e.s || e.a);
}
const terbaru = (arr) => arr.slice().sort((x, y) => y.tgl - x.tgl)[0] || null;

async function jalankanModulSoapie(config) {
  cekStop();
  kunciPasien(config);
  const shift = tentukanShift(config);
  const label = `shift ${shift}`;

  if (!location.hash.includes('/activity-patient')) {
    const btnIsi = Array.from(document.querySelectorAll('button, span, a'))
      .find(el => tampak(el) && /isi\s*soapie/i.test((el.textContent || '').trim()));
    if (btnIsi) targetKlik(btnIsi).click();
    else location.hash = '#/activity-patient';
    await tunggu(() => location.hash.includes('/activity-patient'), 8000);
  }

  const kolom = () => {
    const ta = Array.from(document.querySelectorAll('textarea')).filter(tampak);
    return ta.length === 5 ? { s: ta[0], o: ta[1], a: ta[2], p: ta[3], i: ta[4] } : null;
  };
  const siap = await tunggu(() => kolom() && cariTeks('Simpan SOAP', 'button, span'), 8000);
  if (!siap) throw new Error('SOAPIE: halaman Isi SOAP tidak terbaca.');

  const k0 = kolom();
  if (!config.soapTimpa && (k0.o.value.trim() || k0.p.value.trim() || k0.i.value.trim())) {
    catat('DILEWATI: kolom O/P/I sudah terisi, SOAP tidak ditimpa.');
    return 'dilewati';
  }

  let sDokter = '', oDokter = '', aDokter = '', pDokter = '', sPerawat = '', aPerawat = '';
  if (config.cpptSA !== false) {
    await langkah('Baca CPPT untuk S dan A (SDKI)', async () => {
      const tab = await tunggu(() => cariTeks('CPPT', 'button, span, p') || Array.from(document.querySelectorAll('button')).find(b => tampak(b) && /^cppt\b/.test(norm(b.textContent))), 5000);
      if (!tab) throw new Error('tab CPPT tidak ditemukan');
      targetKlik(tab).click();
      const ada = await tunggu(() => bacaCpptEntri().length > 0, 8000);
      if (!ada) throw new Error('entri CPPT tidak muncul');
      const entri = bacaCpptEntri();

      const isDokter = (e) => /\bdr\.?\b|dokter|dpjp|\bsp\.[a-z]/i.test(e.header);
      const dokter = terbaru(entri.filter(e => isDokter(e) && (e.s.trim() || e.a.trim() || e.p.trim())));
      const perawatA = terbaru(entri.filter(e => !isDokter(e) && e.a.trim()));
      const perawatS = terbaru(entri.filter(e => !isDokter(e) && e.s.trim()));

      if (dokter) {
        sDokter = dokter.s.split('\n').map(x => x.trim()).find(Boolean) || '';
        oDokter = dokter.o.trim();
        aDokter = dokter.a.trim();
        pDokter = dokter.p.trim();
      }
      if (perawatS) sPerawat = perawatS.s.split('\n').map(x => x.trim()).find(Boolean) || '';
      if (perawatA) aPerawat = perawatA.a.trim();
    });
  }

  // Hitung 1 Diagnosa Keperawatan SDKI Terkuat untuk Semua Pasien
  const sdki = tentukanDiagnosaSdki({
    subjective: `${sDokter || sPerawat}\n${config.companionSoap?.subjective || ''}`,
    objective: `${oDokter}\n${config.companionSoap?.objective || ''}`,
    analysis: `${aDokter}\n${config.companionSoap?.analysis || ''}`,
    planning: `${pDokter}\n${config.companionSoap?.planning || ''}`
  }, aPerawat);

  catat(`Diagnosa A (${sdki.sumber}): ${sdki.utama}`);

  const kk = kolom();
  const rencanaK = String(config.companionSoap?.planning || '').trim();
  const tplK = TEMPLATE_SOAP[shift];
  const pK = rencanaK ? `${tplK.p}\n\nAdvis dokter:\n${rencanaK}` : tplK.p;
  const sK = sDokter || sPerawat || (config.pakaiSoapCompanion && config.companionSoap?.subjective) || '';
  const items = [
    { nama: 'S', teks: kk && kk.s.value.trim() ? '' : sK, alasan: kk && kk.s.value.trim() ? 'sudah terisi' : 'tidak ada di CPPT' },
    { nama: 'O', teks: tplK.o },
    { nama: 'A', teks: kk && kk.a.value.trim() ? '' : sdki.utama, alasan: kk && kk.a.value.trim() ? 'sudah terisi' : 'kosong' },
    { nama: 'P', teks: pK },
    { nama: 'I', teks: tplK.i },
  ];
  return await isiSoapDanSimpan(items, kolom, config, label);
}

// ---------------------------------------------------------------------------
// NAVIGASI ANTREAN & DAFTAR PASIEN ECALYPTUS
// ---------------------------------------------------------------------------
const KUNCI_SELESAI = () => 'simpanRobotSelesai_' + new Date().toISOString().slice(0, 10);
function bacaSelesai() { try { return JSON.parse(sessionStorage.getItem(KUNCI_SELESAI()) || '[]'); } catch (e) { return []; } }
function tulisSelesai(arr) { try { sessionStorage.setItem(KUNCI_SELESAI(), JSON.stringify(arr)); } catch (e) {} }

function bacaKartu() {
  return Array.from(document.querySelectorAll('a[href="/patient/patient"]')).filter(tampak).map(a => {
    const t = a.innerText || '';
    const rm = (t.match(/NO\.?\s*RM\s*(\d{5,10})/i) || [])[1] || '';
    const baris = t.split('\n').map(s => s.trim()).filter(Boolean);
    const iTgl = baris.findIndex(s => /^TGL\s*REG/i.test(s));
    const ruang = iTgl >= 0 ? (baris[iTgl + 1] || '') : '';
    const nama = baris.find(s => s.length > 2 && !/^(?:NO\.?\s*RM|TGL\s*REG|SUDAH|BELUM|DPJP|dr\.|\d)/i.test(s)) || ('RM ' + rm);
    const status = /sudah\s*dilayani/i.test(t) ? 'sudah' : /belum\s*dilayani/i.test(t) ? 'belum' : '';
    return { a, rm, nama, ruang: norm(ruang), status };
  }).filter(k => k.rm);
}

function bacaPager() {
  const kiri = document.querySelector('svg[data-icon="chevron-left"]');
  const wadah = kiri && kiri.closest('div');
  if (!wadah) return null;
  const angka = Array.from(wadah.querySelectorAll('h6')).filter(h => /^\d+$/.test(h.textContent.trim()));
  if (!angka.length) return null;
  const aktif = angka.find(h => /cursor:\s*default/i.test(h.getAttribute('style') || ''));
  return { angka, aktif: aktif ? parseInt(aktif.textContent, 10) : 1 };
}

async function keHalamanDaftar(n) {
  const p = bacaPager();
  if (!p) return n === 1;
  if (p.aktif === n) return true;
  const h = p.angka.find(x => parseInt(x.textContent, 10) === n);
  if (!h) return false;
  const rmAwal = bacaKartu()[0]?.rm;
  h.click();
  return !!(await tunggu(() => { const q = bacaPager(); return q && q.aktif === n && bacaKartu()[0]?.rm !== rmAwal; }, 8000));
}

async function bukaPasienDariDaftar(rm, halaman) {
  if (!await keHalamanDaftar(halaman)) throw new Error('ANTREAN: gagal kembali ke halaman daftar.');
  const k = bacaKartu().find(x => rmBersih(x.rm) === rmBersih(rm));
  if (!k) throw new Error('ANTREAN: kartu pasien tidak ditemukan lagi di daftar.');
  k.a.click();
  const ok = await tunggu(() => /\/patient\/|activity-patient/.test(location.hash) && rmBersih(bacaRmDiHalaman()) === rmBersih(rm), 12000);
  if (!ok) throw new Error('ANTREAN: halaman pasien tidak terbuka dengan RM yang diharapkan.');
}

async function kembaliKeDaftar() {
  if (!await klikTeks('Halaman Utama', { timeout: 6000 })) throw new Error('ANTREAN: menu "Halaman Utama" tidak ditemukan.');
  await tunggu(() => bacaKartu().length > 0 || bacaPager(), 12000);
  if (!bacaKartu().length && bacaPager()) await keHalamanDaftar(1);
  const ok = await tunggu(() => bacaKartu().length > 0, 12000);
  if (!ok) throw new Error('ANTREAN: daftar tidak tampil setelah kembali ke Halaman Utama.');
}

async function jalankanPasienRm(config) {
  const rm = String(config.rmTarget || '').trim();
  if (!rm) throw new Error('PASIEN_RM: RM target kosong.');
  const kode = '…' + rm.slice(-4);
  if (!bacaKartu().length) await kembaliKeDaftar();
  await tunggu(() => bacaKartu().length > 0 || bacaPager(), 10000);
  if (!bacaKartu().length && bacaPager()) await keHalamanDaftar(1);
  const siap = await tunggu(() => bacaKartu().length > 0, 10000);
  if (!siap) throw new Error('ANTREAN: daftar pasien tidak tampil di Halaman Utama.');
  const pager = bacaPager();
  const jumlah = pager ? Math.max(...pager.angka.map(h => parseInt(h.textContent, 10))) : 1;
  let ketemu = null;
  for (let h = 1; h <= Math.min(jumlah, 8) && !ketemu; h++) {
    if (!await keHalamanDaftar(h)) { if (h > 1) break; throw new Error('ANTREAN: gagal membuka halaman 1 daftar.'); }
    const k = bacaKartu().find(x => rmBersih(x.rm) === rmBersih(rm));
    if (k) ketemu = { k, h };
  }
  if (!ketemu) {
    await keHalamanDaftar(1).catch(() => {});
    catat(`TIDAK_DITEMUKAN: pasien ${kode} tidak ada di daftar yang sedang tampil.`);
    return 0;
  }

  catat(`=== Pasien ${kode} ===`);
  await bukaPasienDariDaftar(ketemu.k.rm, ketemu.h);
  const cfgP = { ...config, rmTarget: ketemu.k.rm };
  const m = config.modul || { asesmen: true };
  if (!m.asesmen && !m.obat && !m.soapie) catat('Catatan: tidak ada modul yang dipilih.');
  if (m.asesmen) await jalankanModulAsesmen(cfgP);
  if (m.obat) await langkah('Sapu Obat', () => jalankanModulObat(cfgP));
  if (m.soapie) {
    const st = await jalankanModulSoapie(cfgP);
    if (st === 'tersimpan') {
      catat('OK: SOAPIE tersimpan otomatis, lanjut pasien berikutnya.');
    } else if (st === 'dilewati') {
      catat('Catatan: SOAP dilewati (kolom sudah terisi), lanjut pasien berikutnya.');
    } else {
      catat('Menunggu Anda klik "Simpan SOAP" untuk lanjut ke pasien berikutnya...');
      const tersimpan = await tunggu(() => sudahSukses(), 180000, 250);
      if (tersimpan) {
        await tunggu(() => !sudahSukses() && !sedangKirim(), 10000, 150);
        catat('OK: SOAPIE tersimpan, lanjut pasien berikutnya.');
      } else {
        catat('Catatan: ⚠️ SOAP belum disimpan dalam 3 menit, lanjut pasien berikutnya.');
      }
    }
  }
  await kembaliKeDaftar();
  return 1;
}

async function jalankanRobot(mode, config) {
  LAPORAN = [];
  config = config || {};
  catat(`Shift: ${tentukanShift(config)}`);
  if (mode === 'PASIEN_RM') { await jalankanPasienRm(config); return LAPORAN.slice(); }
  if (mode === 'PASIEN_BARU') { await jalankanAlurPasienBaru(config); return LAPORAN.slice(); }
  if (mode === 'ASESMEN' || mode === 'FULL') await jalankanModulAsesmen(config);
  if (mode === 'OBAT' || mode === 'FULL') await jalankanModulObat(config);
  if (mode === 'SOAPIE' || mode === 'FULL') await jalankanModulSoapie(config);
  return LAPORAN.slice();
}

// ---------------------------------------------------------------------------
// TEMPEL AMAN REACT 16 UNTUK SOAPIE
// ---------------------------------------------------------------------------
let ASISTEN_DRAFT = null;
function tampilkanKartuSoap(items, ambilKolom) {
  ASISTEN_DRAFT = { items, ambilKolom };
  pastikanAsisten();
  asistenRenderDraft();
}

async function tempelSemuaKolom(items, ambilKolom, percobaan = 2, ujiSilang = true) {
  const tunda = (ms) => new Promise(r => setTimeout(r, ms));
  const lapor = [];
  try { window.focus(); } catch (e) {}
  const lepasFokus = async () => {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) { a.blur(); await tunda(150); }
  };
  const salin = async (teks) => {
    try { await navigator.clipboard.writeText(teks); return true; } catch (e) {}
    try {
      const t = document.createElement('textarea');
      t.value = teks; t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove();
      return ok;
    } catch (e) { return false; }
  };
  const komit = async (el) => {
    let nyata = false;
    const dengar = () => { nyata = true; };
    el.addEventListener('blur', dengar, { once: true });
    el.blur();
    await tunda(30);
    el.removeEventListener('blur', dengar);
    if (!nyata) {
      el.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
      el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }
    return nyata ? 'nyata' : 'sintetis';
  };
  for (const it of items) {
    if (!it.teks) continue;
    cekStop();
    const cat = { nama: it.nama, tempel: '-', blur: '-', bertahan: '-', alasan: '' };
    for (let n = 0; n < percobaan; n++) {
      try {
        cekStop();
        await lepasFokus();
        const tersalin = await salin(it.teks);
        let k = ambilKolom(); let el = k && k[it.nama.toLowerCase()];
        if (!el) { cat.alasan = 'kolom hilang'; break; }
        el.focus(); await tunda(80);
        el.setSelectionRange(0, (el.value || '').length);
        let tertempel = false;
        try { tertempel = document.execCommand('paste'); } catch (e) {}
        if (!tertempel || el.value !== it.teks) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(el, it.teks);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: it.teks }));
          cat.tempel = tersalin ? 'cadangan(input)' : 'cadangan(tanpa salin)';
        } else cat.tempel = 'paste';
        await tunda(250);
        k = ambilKolom(); el = (k && k[it.nama.toLowerCase()]) || el;
        cat.blur = await komit(el);
        await tunda(350);
        k = ambilKolom(); const cek = k && k[it.nama.toLowerCase()];
        cat.bertahan = cek && cek.value === it.teks ? 'ya' : 'tidak';
        if (cat.bertahan === 'ya') { cat.alasan = ''; break; }
        cat.alasan = `isi ${(cek && cek.value || '').length}/${it.teks.length}`;
      } catch (e) {
        if (e.message === 'ROBOT_STOPPED_BY_USER') throw e;
        cat.alasan = 'galat: ' + (e.message || e);
      }
      await tunda(400);
    }
    lapor.push(cat);
  }
  let bertahanSemua = lapor.length > 0 && lapor.every(c => c.bertahan === 'ya');
  if (ujiSilang) try {
    const k = ambilKolom();
    const pertama = k && (k.s || Object.values(k)[0]);
    if (pertama) { pertama.focus(); await tunda(150); pertama.blur(); await tunda(300); }
    const k2 = ambilKolom();
    for (const it of items) {
      if (!it.teks) continue;
      const e2 = k2 && k2[it.nama.toLowerCase()];
      const c = lapor.find(x => x.nama === it.nama);
      if (!e2 || e2.value !== it.teks) { bertahanSemua = false; if (c) c.bertahan = 'hilang setelah uji'; }
    }
  } catch (e) {}
  await tunda(200);
  const btn = cariTeks('Simpan SOAP', 'button, span');
  const simpanAktif = !!(btn && tombolAktif(btn));
  const rinci = lapor.map(c => `${c.nama}: ${c.tempel}/blur ${c.blur}/bertahan ${c.bertahan}${c.alasan ? ' (' + c.alasan + ')' : ''}`).join(' | ');
  return { lapor, bertahanSemua, simpanAktif, rinci, aman: bertahanSemua && simpanAktif };
}

async function isiSoapDanSimpan(items, kolom, config, label) {
  tampilkanKartuSoap(items, kolom);
  let hasil = await tempelSemuaKolom(items, kolom, 2);
  // Pemulihan: kolom yang hilang/berubah ditempel ulang SAJA (tanpa uji silang), maksimal 2 putaran
  const hilangSekarang = () => {
    const k = kolom();
    return items.filter(it => it.teks && !(k && k[it.nama.toLowerCase()] && k[it.nama.toLowerCase()].value === it.teks));
  };
  let putaran = 0;
  while (!hasil.aman && putaran < 2) {
    putaran++;
    const hilang = hilangSekarang();
    if (hilang.length) {
      catat(`Catatan: SOAP (${label}) kolom ${hilang.map(h => h.nama.toUpperCase()).join(', ')} hilang, ditempel ulang (putaran ${putaran}).`);
      const h2 = await tempelSemuaKolom(hilang, kolom, 2, false);
      hasil.rinci = h2.rinci;
    } else await jeda(900);   // semua kolom utuh; tunggu tombol Simpan aktif
    const b = cariTeks('Simpan SOAP', 'button, span');
    hasil.simpanAktif = !!(b && tombolAktif(b));
    hasil.bertahanSemua = hilangSekarang().length === 0;
    hasil.aman = hasil.bertahanSemua && hasil.simpanAktif;
  }
  const tandai = () => {
    const b = cariTeks('Simpan SOAP', 'button, span');
    if (b) { const t = targetKlik(b); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.style.outline = '4px solid #10b981'; t.style.boxShadow = '0 0 20px rgba(16,185,129,.8)'; }
  };
  if (!hasil.aman) {
    const hilang = hilangSekarang();
    const sebab = hilang.length ? `kolom ${hilang.map(h => h.nama.toUpperCase()).join(', ')} kosong/berubah setelah ${putaran} kali tempel ulang` : 'tombol Simpan SOAP masih abu-abu';
    catat(`Catatan: ⚠️ SOAP (${label}) TIDAK disimpan otomatis: ${sebab}. Tempel manual dari kartu Draft lalu klik Simpan SOAP. [SOAP-ROBOT ${hasil.rinci}]`);
    tandai();
    return 'manual';
  }
  if (!config.autoSubmitSoap) {
    catat(`Draft SOAP (${label}) tertempel. Simpan SOAP tidak diklik (mode manual).`);
    tandai();
    return 'manual';
  }
  pastikanPasienSama();
  const ok = await langkah('Simpan SOAP', () => simpanSekali('Simpan SOAP'));
  if (ok) return 'tersimpan';
  tandai();
  return 'manual';
}

// ============================================================================
// 🌵 DIALOG ASISTEN MENGAMBANG: SIMPAN KAKTUS (#simpan-ecal-assistant)
// ============================================================================
const ASISTEN = {
  cache: null, running: false,
  modul: { asesmen: true, obat: true, soapie: false },
  hasil: [],
  pasienBaruList: [],
  total: 0, kini: '', host: null, root: null
};

function simpanKePanel(pesan) {
  try { chrome.runtime.sendMessage(pesan, () => { void chrome.runtime.lastError; }); } catch (e) {}
}

function dapatkanKamarKosong() {
  const c = ASISTEN.cache;
  const ward = (c && c.ward) || 'MELATI';
  const semuaKamar = WARD_ROOMS[ward] || WARD_ROOMS['MELATI'];
  const terisi = new Set(((c && c.allPatients) || []).map(p => cleanBedKey(p.bed)));
  return semuaKamar.filter(k => !terisi.has(cleanBedKey(k)));
}

function pastikanAsisten() {
  if (ASISTEN.host && document.contains(ASISTEN.host)) return ASISTEN.host;
  const host = document.createElement('div');
  host.id = 'simpan-ecal-assistant';
  host.style.cssText = 'position:fixed;right:16px;top:70px;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'open' });
  const css = `
  *{box-sizing:border-box}.w{font:12px system-ui,sans-serif;width:355px;max-height:88vh;overflow:auto;background:#0f172a;color:#e2e8f0;border:1.5px solid #10b981;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.45)}
  .h{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;cursor:move;font-weight:800;background:linear-gradient(90deg,#064e3b,#115e59);border-radius:12px 12px 0 0;user-select:none;position:sticky;top:0;z-index:2}
  .h button{background:transparent;color:#a7f3d0;border:0;cursor:pointer;font-size:14px;padding:0 5px}
  .b{padding:8px 10px;display:flex;flex-direction:column;gap:7px}
  .pill{display:flex;gap:5px}.pill button{flex:1;border:1px solid #475569;background:#1e293b;color:#cbd5e1;border-radius:999px;padding:5px 4px;font-weight:700;cursor:pointer;font-size:11px}
  .pill button.on{background:#065f46;border-color:#10b981;color:#d1fae5}
  .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.row label{display:flex;gap:4px;align-items:center;font-size:11px;color:#cbd5e1}
  select,input[type=text]{background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 5px;font-size:11px}
  input[type=text]{width:52px}
  details{border:1px solid #334155;border-radius:8px;padding:5px 7px;background:#111c33}summary{cursor:pointer;font-weight:700;font-size:11px;color:#93c5fd}
  .go{display:flex;gap:6px}.go button{flex:1;border:0;border-radius:8px;padding:8px 4px;font-weight:800;cursor:pointer;color:#fff;font-size:11.5px}
  .g1{background:#0ea5e9}.g2{background:#16a34a}.gnew{background:#d97706;width:100%;border:0;border-radius:8px;padding:7px;color:#fff;font-weight:800;cursor:pointer;font-size:11.5px}
  .stop{background:#dc2626;width:100%;border:0;border-radius:8px;padding:7px;color:#fff;font-weight:800;cursor:pointer}
  button[disabled]{opacity:.45;cursor:default}
  .st{background:#020617;border:1px solid #334155;border-radius:8px;padding:6px 8px;font-size:11px;color:#a7f3d0;min-height:28px}
  .stat{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.stat div{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:5px;text-align:center;font-weight:800;font-size:11px}
  .mas{font-size:11px;line-height:1.35;padding:3px 0;border-bottom:1px dashed #334155;color:#fde68a}.mas.x{color:#fecaca}
  .chip{display:inline-block;background:#064e3b;color:#a7f3d0;border-radius:999px;padding:2px 7px;margin:2px 3px 0 0;font-size:10px;cursor:pointer}
  .dr{display:flex;gap:6px;align-items:center;padding:4px 0;border-top:1px solid #1e293b}.dr b{width:14px;color:#38bdf8}.dr span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1}
  .dr button{background:#0ea5e9;color:#fff;border:0;border-radius:6px;padding:3px 7px;font-weight:700;cursor:pointer;font-size:10px}
  .small{font-size:10px;color:#94a3b8}.ttv{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}.ttv input{width:100%}
  .chat{display:none;flex-direction:column;gap:5px;max-height:300px;overflow:auto;background:#020617;border:1px solid #166534;border-radius:8px;padding:6px}
  .cb{white-space:pre-wrap;font-size:11.5px;line-height:1.4;padding:5px 8px;border-radius:10px;max-width:94%}
  .cb.k{background:#064e3b;color:#d1fae5;align-self:flex-start}.cb.u{background:#1d4ed8;color:#fff;align-self:flex-end}
  .cb.l{background:transparent;color:#a7f3d0;padding:1px 4px;font-size:11px}.cb.l.x{color:#fecaca}.cb.l.w{color:#fde68a}
  .cb.opsi{display:flex;flex-wrap:wrap;gap:4px;background:transparent;padding:0;max-width:100%}
  .cb.opsi button{border:1px solid #10b981;background:#0f172a;color:#d1fae5;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer}
  .cb.opsi.lunas{opacity:.45}.cb.opsi .ketik{width:100%;flex:1}.cb.opsi .go1{background:#10b981;color:#022c22}.cb.opsi .ing{width:100%;font-size:10px;color:#94a3b8;display:flex;gap:4px;align-items:center}
  .newbox{background:#1e293b;border:1px solid #f59e0b;border-radius:8px;padding:7px;display:none;flex-direction:column;gap:6px}`;

  root.innerHTML = `<style>${css}</style>
  <div class="w" id="w">
    <div class="h" id="hd"><span>🧕 SIMPAN Kaktus (Kaka Asisten Ecalyptus)</span><span><button id="min" title="Kecilkan">—</button><button id="tutup" title="Tutup">✕</button></span></div>
    <div class="b" id="bd">
      <div class="small" id="info"></div>
      <div class="pill"><button data-m="asesmen">🩺 EWS</button><button data-m="obat">💊 Obat CPO</button><button data-m="soapie">📝 SOAP</button></div>
      <div class="row">
        <label>Shift <select id="shift"><option value="pagi">Pagi</option><option value="siang">Siang</option><option value="malam">Malam</option></select></label>
        <label><input type="checkbox" id="auto" checked>⚡ Simpan SOAP</label>
        <button id="muat" title="Muat ulang data dari SIMPAN" style="margin-left:auto;background:#334155;color:#e2e8f0;border:0;border-radius:6px;padding:3px 7px;cursor:pointer">🔄</button>
      </div>
      <details><summary>⚙️ Opsi</summary>
        <div class="row" style="margin-top:6px"><label>Nyeri Rutin <select id="nyeri"><option value="tidak">Tidak nyeri</option><option value="ya">Skala 2</option></select></label></div>
        <div class="row"><label><input type="checkbox" id="pakaiS">Ambil S-O-A dari Companion</label></div>
        <div class="row"><label><input type="checkbox" id="timpa">Timpa SOAP yang sudah terisi</label></div>
        <div class="row"><label><input type="checkbox" id="hanyaSaya" checked>Obat: hanya dosis CPO yang saya ceklis</label></div>
        <div class="row"><label><input type="checkbox" id="jamSkr">Obat: bila jam gagal diatur, tetap simpan jam sekarang</label></div>
        <div class="row"><button id="rekam" style="background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">🔍 Rekam struktur form halaman ini</button></div>
        <div class="row"><label><input type="checkbox" id="autoTtv" checked>Auto TTV (O SIMPAN / Geser ±1-2 EWS)</label></div>
        <div class="ttv" id="ttvBox" style="display:none">
          <input type="text" id="t_sistolik" placeholder="Sis"><input type="text" id="t_diastolik" placeholder="Dia"><input type="text" id="t_hr" placeholder="HR">
          <input type="text" id="t_suhu" placeholder="Suhu"><input type="text" id="t_rr" placeholder="RR"><input type="text" id="t_spo2" placeholder="SpO2">
        </div>
      </details>
      <div class="go"><button class="g1" id="ini">▶️ Pasien Ini</button><button class="g2" id="semua">⏩ Semua Bed (0)</button></div>
      <button class="gnew" id="btnLacakBaru">🆕 Lacak & Terima Pasien Baru</button>
      <div class="chat" id="chat"></div>

      <div class="newbox" id="boxPasienBaru">
        <div style="font-weight:800;color:#fcd34d;display:flex;justify-content:space-between;align-items:center">
          <span>🆕 Penerimaan Pasien Baru</span>
          <button id="tutupBaru" style="background:transparent;border:0;color:#cbd5e1;cursor:pointer">✕</button>
        </div>
        <div class="row"><label style="width:100%">Pasien: <select id="selPasienBaru" style="flex:1"></select></label></div>
        <div class="row"><label style="width:100%">Simpan ke Kamar Kosong: <select id="selKamarKosong" style="flex:1"></select></label></div>
        <div class="row"><label style="width:100%">Diagnosa SDKI: <input type="text" id="inpSdkiBaru" style="flex:1;width:auto" placeholder="Otomatis dari CPPT Dokter..."></label></div>
        <div id="saranSdkiChips"></div>
        <button id="eksekusiPasienBaru" style="background:#10b981;color:#022c22;border:0;border-radius:7px;padding:7px;font-weight:900;cursor:pointer">🚀 Kerjakan 6 Form Pasien Baru</button>
      </div>

      <button class="stop" id="stop" style="display:none">🛑 Hentikan Kaktus</button>
      <div class="st" id="status">Siap.</div>
      <div class="stat"><div id="s1">📊 0 / 0</div><div id="s2">✅ 0 Beres</div><div id="s3">⚠️ 0 Cek</div></div>
      <div id="masalah"></div>
      <details id="beresBox" style="display:none"><summary id="beresSum"></summary><div id="beresIsi"></div></details>
      <details id="draftBox"><summary>📋 Draft SOAP Terakhir (Salin Manual)</summary><div id="draftIsi" class="small">Belum ada draft.</div></details>
    </div>
  </div>`;

  document.body.appendChild(host);
  ASISTEN.host = host; ASISTEN.root = root;
  const $ = (id) => root.getElementById(id);

  let dx = 0, dy = 0, drag = false;
  $('hd').addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = true; const r = host.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top;
    $('hd').setPointerCapture(e.pointerId);
  });
  $('hd').addEventListener('pointermove', (e) => {
    if (!drag) return;
    host.style.left = Math.max(0, e.clientX - dx) + 'px'; host.style.top = Math.max(0, e.clientY - dy) + 'px'; host.style.right = 'auto';
  });
  $('hd').addEventListener('pointerup', () => { drag = false; });
  $('min').onclick = () => { const b = $('bd'); b.style.display = b.style.display === 'none' ? '' : 'none'; };
  $('tutup').onclick = () => { if (ASISTEN.running) STOP_ROBOT_FLAG = true; host.remove(); ASISTEN.host = null; ASISTEN.root = null; };

  root.querySelectorAll('.pill button').forEach(b => {
    b.onclick = () => { ASISTEN.modul[b.dataset.m] = !ASISTEN.modul[b.dataset.m]; asistenRender(); };
  });
  $('autoTtv').onchange = () => { $('ttvBox').style.display = $('autoTtv').checked ? 'none' : 'grid'; };
  $('muat').onclick = () => asistenMintaData();
  $('rekam').onclick = () => asistenRekamForm();
  $('stop').onclick = () => { STOP_ROBOT_FLAG = true; kaktusBatalTanya(); $('status').textContent = '🛑 Menghentikan setelah langkah ini...'; };
  $('ini').onclick = () => asistenJalankan('ini');
  $('semua').onclick = () => asistenJalankan('semua');

  // Lacak Pasien Baru & Kamar Kosong
  $('btnLacakBaru').onclick = () => kaktusPasienBaru();
  $('tutupBaru').onclick = () => { $('boxPasienBaru').style.display = 'none'; };
  $('selKamarKosong').onchange = (e) => {
    if (e.target.value) simpanKePanel({ action: 'ROBOT_SWITCH_BED', bed: e.target.value });
  };
  $('eksekusiPasienBaru').onclick = () => asistenEksekusiPasienBaru();

  asistenRender();
  return host;
}

const kfNamaInti = (s) => norm(String(s || '').replace(/\b(?:ny|tn|an|by|nn|sdr|sdri)\b\.?/gi, '')).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

async function bacaKartuDuaTab() {
  const semua = [];
  const tab = (re) => Array.from(document.querySelectorAll('button, div[role="tab"], span')).find(el => tampak(el) && re.test(el.textContent || '') && (el.textContent || '').length < 40);
  const tabBelum = tab(/pasien\s+belum\s+dilayani/i), tabSudah = tab(/pasien\s+telah\s+dilayani/i);
  const baca = async (namaTab) => {
    const pager = bacaPager();
    const jumlah = pager ? Math.min(6, Math.max(...pager.angka.map(h => parseInt(h.textContent, 10)))) : 1;
    for (let h = 1; h <= jumlah; h++) {
      if (h > 1 && !await keHalamanDaftar(h)) break;
      bacaKartu().forEach(k => { if (!semua.some(x => rmBersih(x.rm) === rmBersih(k.rm))) semua.push({ ...k, tab: namaTab, halaman: h }); });
    }
    if (jumlah > 1) await keHalamanDaftar(1).catch(() => {});
  };
  for (const [nm, el] of [['belum', tabBelum], ['sudah', tabSudah]]) {
    if (el) { targetKlik(el).click(); await jeda(1400); }
    await baca(nm);
  }
  if (tabBelum) { targetKlik(tabBelum).click(); await jeda(600); }
  return semua;
}

// Cocokkan RM (utama) / nama dengan SIMPAN. Yang tidak ada di SIMPAN = pasien baru.
async function kaktusKumpulkanKandidat() {
  const c = ASISTEN.cache || { allPatients: [] };
  const rmS = new Set(), namaS = new Set();
  (c.allPatients || []).forEach(p => { const r = rmBersih(p.rm); if (r) rmS.add(r); const n = kfNamaInti(p.name); if (n) namaS.add(n); });
  const sudahAda = (rm, nama) => { const r = rmBersih(rm); return (r && rmS.has(r)) || (nama && namaS.has(kfNamaInti(nama))); };
  const kandidat = [];
  const rmAktif = bacaRmDiHalaman();
  if (rmAktif && /\/patient\/|activity-patient|signature-recorder/.test(location.hash) && !sudahAda(rmAktif, '')) {
    kandidat.push({ rm: rmAktif, nama: `Pasien yang sedang terbuka (RM ${rmAktif})`, tab: '', halaman: 0 });
  }
  if (!kandidat.length) {
    if (!bacaKartu().length) {
      await klikTeks('Halaman Utama', { timeout: 5000 });
      await tunggu(() => bacaKartu().length > 0 || bacaPager(), 10000);
    }
    const kartu = await bacaKartuDuaTab();
    kartu.forEach(k => { if (!sudahAda(k.rm, k.nama)) kandidat.push({ rm: k.rm, nama: `${k.nama} (RM ${k.rm})`, tab: k.tab, halaman: k.halaman }); });
    ASISTEN.jumlahKartu = kartu.length;
  }
  return kandidat;
}

async function kaktusBukaKandidat(rm) {
  if (rmBersih(bacaRmDiHalaman()) === rmBersih(rm) && /\/patient\/|activity-patient/.test(location.hash)) return;
  if (!bacaKartu().length) { await klikTeks('Halaman Utama', { timeout: 6000 }); await tunggu(() => bacaKartu().length > 0 || bacaPager(), 10000); }
  const tab = (re) => Array.from(document.querySelectorAll('button, div[role="tab"], span')).find(el => tampak(el) && re.test(el.textContent || '') && (el.textContent || '').length < 40);
  for (const re of [/pasien\s+belum\s+dilayani/i, /pasien\s+telah\s+dilayani/i]) {
    const t = tab(re); if (t) { targetKlik(t).click(); await jeda(1300); }
    const pager = bacaPager();
    const jumlah = pager ? Math.min(6, Math.max(...pager.angka.map(h => parseInt(h.textContent, 10)))) : 1;
    for (let h = 1; h <= jumlah; h++) {
      if (!await keHalamanDaftar(h)) break;
      const k = bacaKartu().find(x => rmBersih(x.rm) === rmBersih(rm));
      if (k) {
        k.a.click();
        const ok = await tunggu(() => /\/patient\/|activity-patient/.test(location.hash) && rmBersih(bacaRmDiHalaman()) === rmBersih(rm), 12000);
        if (!ok) throw new Error('halaman pasien tidak terbuka dengan RM yang diharapkan.');
        return;
      }
    }
  }
  throw new Error(`pasien RM ${rm} tidak ditemukan di daftar Beranda.`);
}

async function asistenLacakPasienBaru() {
  const r = ASISTEN.root; if (!r) return;
  const $ = (id) => r.getElementById(id);
  asistenStatus('🔎 Mencocokkan pasien Ecalyptus dengan SIMPAN (RM/nama)…');
  const kandidat = await kaktusKumpulkanKandidat();
  ASISTEN.pasienBaruList = kandidat;
  $('selPasienBaru').innerHTML = kandidat.length ? kandidat.map(k => `<option value="${k.rm}">${k.nama}</option>`).join('') : `<option value="">-- tidak ada pasien baru --</option>`;
  const kosong = dapatkanKamarKosong();
  $('selKamarKosong').innerHTML = kosong.length ? kosong.map(k => `<option value="${k}">🟢 Kamar ${k} (Kosong)</option>`).join('') : `<option value="">⚠️ Semua kamar terisi di SIMPAN</option>`;
  asistenStatus(`🆕 ${kandidat.length} pasien belum ada di SIMPAN • ${kosong.length} kamar kosong.`);
}

// --- Tangkap CPPT dokter + Lab + Radiologi ke Companion lalu SIMPAN ke Firestore (butuh Companion terbaru) ---
function kirimKePanelTunggu(pesan, batas = 25000) {
  return new Promise((res) => {
    let beres = false;
    const t = setTimeout(() => { if (!beres) { beres = true; res(null); } }, batas);
    try { chrome.runtime.sendMessage(pesan, (r) => { void chrome.runtime.lastError; if (!beres) { beres = true; clearTimeout(t); res(r || null); } }); }
    catch (e) { clearTimeout(t); res(null); }
  });
}
async function kaktusTangkapKeSimpan(kamar) {
  if (kamar) { await kirimKePanelTunggu({ action: 'ROBOT_SWITCH_BED', bed: kamar }, 5000); await jeda(1500); }
  const ambil = async () => { const r = await kirimKePanelTunggu({ action: 'KAKTUS_AMBIL' }); await jeda(1600); return r; };
  const rC = await ambil();
  if (!rC) { catat('Catatan: Companion belum menjawab (pasang App.jsx Companion terbaru, muat ulang panel). Data belum masuk SIMPAN — ambil manual.'); return; }
  catat(rC.success ? `OK: CPPT diambil (${rC.sumber || 'sumber tidak terbaca'})${rC.bukanDpjp ? ' — ⚠️ bukan entri DPJP, cek di Companion' : ''}` : 'Catatan: CPPT gagal diambil ke Companion.');

  const bukaTabInfo = async (nama, siapRe) => {
    if (!await klikTeks(nama, { timeout: 4000 })) return false;
    return !!(await tunggu(() => siapRe.test(teksHalaman()), 7000));
  };
  // Lab
  if (await bukaTabInfo('Patologi Klinik', /Dokter\s*Verifikator\s*Hasil|Nilai\s*Rujukan/i)) {
    const r = await ambil();
    catat(r && r.isLab ? 'OK: Hasil Lab diambil' : 'Catatan: halaman Lab terbuka tapi tidak ada hasil terbaca.');
  } else catat('Catatan: tidak ada hasil Lab yang tampil (atau belum ada hasil). Dilewati.');
  // Radiologi (hasil bisa perlu dibuka dulu)
  await klikTeks('Radiologi', { timeout: 4000 });
  let siapRad = await tunggu(() => /Hasil\s*Pemeriksaan/i.test(teksHalaman()) && /PACS|Sp\.Rad/i.test(teksHalaman()), 4000);
  if (!siapRad) {
    const lihat = Array.from(document.querySelectorAll('button, a, span')).find(el => tampak(el) && /^(lihat\s*hasil|hasil|lihat|detail)$/i.test(norm(el.textContent)) && !el.closest('[id="simpan-ecal-assistant"]'));
    if (lihat) { targetKlik(lihat).click(); siapRad = await tunggu(() => /Hasil\s*Pemeriksaan/i.test(teksHalaman()) && /PACS|Sp\.Rad/i.test(teksHalaman()), 5000); }
  }
  if (siapRad) { const r = await ambil(); catat(r && r.isRad ? 'OK: Hasil Radiologi diambil' : 'Catatan: halaman Radiologi terbuka tapi kesan tidak terbaca.'); }
  else catat('Catatan: hasil Radiologi tidak terbuka otomatis (mungkin belum ada). Dilewati.');

  await jeda(800);
  const rs = await kirimKePanelTunggu({ action: 'KAKTUS_SIMPAN' }, 30000);
  catat(rs && rs.success ? `OK: Pasien tersimpan ke SIMPAN${kamar ? ' (kamar ' + kamar + ')' : ''}` : `Catatan: Pasien BELUM tersimpan ke SIMPAN (${(rs && rs.alasan) || 'Companion tidak merespons'}). Simpan manual dari Companion.`);
}

async function asistenEksekusiPasienBaru() {
  if (ASISTEN.running) return;
  const r = ASISTEN.root; if (!r) return;
  const $ = (id) => r.getElementById(id);
  const rmTarget = $('selPasienBaru').value || bacaRmDiHalaman();
  const kamarTujuan = $('selKamarKosong').value;
  const masalahKeperawatan = $('inpSdkiBaru').value.trim();

  if (!rmTarget) {
    asistenStatus('⚠️ Pilih pasien atau buka halaman pasien baru terlebih dahulu.');
    return;
  }
  if (kamarTujuan) {
    simpanKePanel({ action: 'ROBOT_SWITCH_BED', bed: kamarTujuan });
  }

  ASISTEN.running = true; STOP_ROBOT_FLAG = false;
  ASISTEN.total = 1; ASISTEN.hasil = []; LAPORAN = [];
  asistenRender();
  asistenStatus(`⏳ Mengerjakan 6 form pasien baru RM ${rmTarget} -> Kamar ${kamarTujuan || '-'}...`);

  let galat = '';
  try {
    KF_SISA = [];
    await kaktusBukaKandidat(rmTarget);
    const cfg = {
      ...asistenAmbilConfig(),
      rmTarget, kamarTujuan,
      masalahKeperawatan,
      ttdPerawat: (ASISTEN.cache && ASISTEN.cache.ttdPerawat) || ''
    };
    await jalankanAlurPasienBaru(cfg);
  } catch (e) {
    galat = e.message === 'ROBOT_STOPPED_BY_USER' ? 'Dihentikan pengguna' : e.message;
  } finally {
    const v = nilaiLaporan(LAPORAN, galat);
    ASISTEN.hasil.push({ bed: kamarTujuan || 'BARU', nama: `RM ${rmTarget}`, ...v });
    ASISTEN.running = false;
    asistenRender();
    if (ASISTEN.chatAktif && KF_SISA.length) kaktusBicara('Pertanyaan form yang belum kuketahui jawabannya (dibiarkan kosong, isi manual / kirim daftar ini ke Claude agar jadi bawaan):\n' + KF_SISA.map(q => `• [${q.konteks}] ${q.teks} → ${q.opsi.join(' / ')}`).join('\n'), 'k');
    if (ASISTEN.chatAktif) kaktusBicara(galat ? `Berhenti: ${galat}` : (v.status === 'beres' ? 'Selesai! Semua langkah beres. 🎉 Berikutnya: panel Companion → ⚡ Ambil Data Ecal → 💾 Simpan.' : `Selesai, tapi ada yang perlu kamu cek: ${v.alasan}. Daftar ⚠️ di atas menunjukkan kolomnya.`));
    asistenStatus(galat ? `⚠️ Selesai dengan catatan: ${galat}` : `✅ 6 Form Pasien Baru selesai! Klik "⚡ Ambil Data Ecal" -> "💾 Simpan" -> "🖨️ EOA" di panel Companion.`);
  }
}

// ============================================================================
// 💬 PERCAKAPAN KAKTUS — gelembung chat + tombol jawaban di dialog asisten.
// ============================================================================
function kaktusBicara(teks, jenis = 'k') {
  const r = ASISTEN.root; const box = r && r.getElementById('chat'); if (!box) return null;
  box.style.display = 'flex';
  const d = document.createElement('div');
  d.className = 'cb ' + jenis;
  d.textContent = teks;
  box.appendChild(d);
  while (box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
  return d;
}
function kaktusBatalTanya() {
  if (ASISTEN.tanyaAktif) { const t = ASISTEN.tanyaAktif; ASISTEN.tanyaAktif = null; t.selesai(null); }
}
// Tanya pengguna dengan tombol pilihan. opsi: array label. Hasil: {indeks, label, ingat} atau null (dihentikan/tanpa dialog).
function kaktusTanya(teks, opsi, { ingat = false, ketik = false, placeholder = '' } = {}) {
  const r = ASISTEN.root; const box = r && r.getElementById('chat');
  if (!box) return Promise.resolve(null);
  return new Promise((resolve) => {
    kaktusBicara(teks, 'k');
    const wadah = document.createElement('div'); wadah.className = 'cb opsi';
    let cekIngat = null, inpKetik = null;
    const selesai = (hasil) => {
      wadah.querySelectorAll('button,input').forEach(e => { e.disabled = true; });
      wadah.classList.add('lunas');
      if (hasil) kaktusBicara(hasil.label, 'u');
      resolve(hasil);
    };
    if (ketik) {
      inpKetik = document.createElement('input'); inpKetik.type = 'text'; inpKetik.placeholder = placeholder; inpKetik.className = 'ketik';
      const ok = document.createElement('button'); ok.textContent = 'Pakai'; ok.className = 'go1';
      const pakai = () => { const v = inpKetik.value.trim(); if (v) { ASISTEN.tanyaAktif = null; selesai({ indeks: -1, label: v, ingat: false, ketik: v }); } };
      ok.onclick = pakai; inpKetik.onkeydown = (e) => { if (e.key === 'Enter') pakai(); };
      wadah.appendChild(inpKetik); wadah.appendChild(ok);
    }
    opsi.forEach((lab, i) => {
      const b = document.createElement('button'); b.textContent = lab;
      b.onclick = () => { ASISTEN.tanyaAktif = null; selesai({ indeks: i, label: lab, ingat: !!(cekIngat && cekIngat.checked) }); };
      wadah.appendChild(b);
    });
    if (ingat) {
      const l = document.createElement('label'); l.className = 'ing';
      cekIngat = document.createElement('input'); cekIngat.type = 'checkbox'; cekIngat.checked = true;
      l.appendChild(cekIngat); l.appendChild(document.createTextNode(' Ingat jawabanku untuk pasien berikutnya'));
      wadah.appendChild(l);
    }
    box.appendChild(wadah); box.scrollTop = box.scrollHeight;
    ASISTEN.tanyaAktif = { selesai };
  });
}
// Laporan langkah ringkas dari catat() → gelembung (hanya saat percakapan aktif)
function kaktusLaporSingkat(teks) {
  if (!ASISTEN.chatAktif || !ASISTEN.root) return;
  const t = String(teks);
  if (/^OK:/.test(t)) kaktusBicara('✅ ' + t.replace(/^OK:\s*/, ''), 'l');
  else if (/^GAGAL:/.test(t)) kaktusBicara('❌ ' + t.replace(/^GAGAL:\s*/, ''), 'l x');
  else if (/^Catatan:/.test(t)) kaktusBicara('⚠️ ' + t.replace(/^Catatan:\s*/, '').replace(/^⚠️\s*/, ''), 'l w');
}

async function kaktusPasienBaru() {
  if (ASISTEN.running || ASISTEN.chatAktif) return;
  const r = ASISTEN.root; if (!r) return;
  const $ = (id) => r.getElementById(id);
  ASISTEN.chatAktif = true;
  try {
    $('chat').innerHTML = '';
    if (!ASISTEN.cache) { asistenMintaData(); kaktusBicara('Halo! Kuambil dulu data SIMPAN dari panel Companion… (kalau tak ada respons, buka panel samping SIMPAN & login, lalu ketuk 🆕 lagi)'); await jeda(1500); }
    await asistenLacakPasienBaru();
    $('boxPasienBaru').style.display = 'none';
    const daftar = ASISTEN.pasienBaruList || [];
    if (!daftar.length) {
      kaktusBicara(`Semua pasien yang tampil di Ecalyptus${ASISTEN.jumlahKartu ? ' (' + ASISTEN.jumlahKartu + ' kartu, kedua tab)' : ''} sudah ada di SIMPAN (dicocokkan lewat RM/nama). Kalau pasien barunya belum muncul di Beranda, buka halaman pasiennya lalu ketuk 🆕 lagi.`);
      return;
    }
    // 1. Pasien
    let pasien;
    if (daftar.length === 1) {
      const j = await kaktusTanya(`Halo! Kutemukan 1 pasien yang belum ada di SIMPAN:\n${daftar[0].nama}\nBenar ini yang mau diterima?`, ['Ya, benar', 'Bukan, batal']);
      if (!j || j.indeks !== 0) { kaktusBicara('Oke, dibatalkan. Ketuk 🆕 lagi kapan saja.'); return; }
      pasien = daftar[0];
    } else {
      const j = await kaktusTanya(`Halo! Kutemukan ${daftar.length} pasien yang belum ada di SIMPAN. Yang mana?`, [...daftar.map(d => d.nama).slice(0, 8), 'Batal']);
      if (!j || j.indeks >= Math.min(daftar.length, 8)) { kaktusBicara('Oke, dibatalkan.'); return; }
      pasien = daftar[j.indeks];
    }
    $('selPasienBaru').value = pasien.rm;
    // 2. Kamar kosong
    const kosong = dapatkanKamarKosong();
    let kamar = '';
    if (!kosong.length) {
      const j = await kaktusTanya('Semua kamar di SIMPAN sedang terisi, jadi tidak ada kamar kosong untuk dipilih. Lanjut tanpa menentukan kamar?', ['Lanjut tanpa kamar', 'Batal']);
      if (!j || j.indeks !== 0) { kaktusBicara('Oke, dibatalkan.'); return; }
    } else {
      const j = await kaktusTanya(`Pasien ini akan kusimpan di kamar mana? Kamar yang kosong di SIMPAN (${kosong.length}):`, [...kosong.slice(0, 12), 'Batal']);
      if (!j || j.indeks >= Math.min(kosong.length, 12)) { kaktusBicara('Oke, dibatalkan.'); return; }
      kamar = kosong[j.indeks];
    }
    if (kamar) $('selKamarKosong').value = kamar;
    $('inpSdkiBaru').value = '';   // diagnosa otomatis dari CPPT dokter
    // 4. Tanda tangan perawat (tersimpan per akun di SIMPAN → Profil → Tanda Tangan Saya)
    let adaTtd = !!(ASISTEN.cache && ASISTEN.cache.ttdPerawat);
    while (!adaTtd) {
      const j = await kaktusTanya('Tanda tangan perawat-mu belum tersimpan di SIMPAN (Profil → Tanda Tangan Saya). Tanpa itu, kolom TTD Pemberi tidak kuisi — kamu tanda tangan sendiri nanti. Bagaimana?', ['Sudah kuatur, muat ulang', 'Lanjut tanpa TTD', 'Batal']);
      if (!j || j.indeks === 2) { kaktusBicara('Oke, dibatalkan.'); return; }
      if (j.indeks === 1) break;
      asistenMintaData(); await jeda(2500);
      adaTtd = !!(ASISTEN.cache && ASISTEN.cache.ttdPerawat);
      kaktusBicara(adaTtd ? 'TTD-mu sudah terbaca ✓' : 'Masih belum terbaca. Pastikan sudah menekan Simpan di SIMPAN dan panel Companion aktif.');
    }
    // 5. Ringkasan + konfirmasi
    const ringkas = [
      `Siap! Ringkasanku:`,
      `• Pasien: ${pasien.nama}`,
      `• Kamar di SIMPAN: ${kamar || '(tidak ditentukan)'}`,
      `• Diagnosa: otomatis dari CPPT dokter`,
      `• TTD perawat: ${adaTtd ? 'dipakai (sebagai Pemberi)' : 'tidak dipakai — kamu tanda tangan manual'}`,
      `Alur: simpan pasien ke SIMPAN (CPPT dokter, Lab, Radiologi) → Asesmen Awal → Nyeri/Jatuh/EWS → Discharge → Transfer → Checklist → Edukasi. Setelah Mulai, kamu bebas mengerjakan hal lain; aku tidak akan bertanya lagi. Yang tak bisa kuisi kulaporkan di akhir.`
    ].join('\n');
    const jk = await kaktusTanya(ringkas, ['🚀 Mulai', 'Batal']);
    if (!jk || jk.indeks !== 0) { kaktusBicara('Oke, dibatalkan. Tidak ada yang diubah.'); return; }
    kaktusBicara('Siap, mulai bekerja. Jangan buka/ganti halaman Ecalyptus sampai aku selesai ya. 🌵');
    await asistenEksekusiPasienBaru();
  } finally {
    ASISTEN.chatAktif = false;
  }
}

function asistenRender() {
  const root = ASISTEN.root; if (!root) return;
  const $ = (id) => root.getElementById(id);
  root.querySelectorAll('.pill button').forEach(b => {
    const on = ASISTEN.modul[b.dataset.m];
    b.classList.toggle('on', !!on);
    const nama = { asesmen: '🩺 EWS', obat: '💊 Obat CPO', soapie: '📝 SOAP' }[b.dataset.m];
    b.textContent = (on ? '✅ ' : '⬜ ') + nama;
  });
  const c = ASISTEN.cache;
  const n = c ? (c.allPatients || []).length : 0;
  const kosong = dapatkanKamarKosong();
  $('semua').textContent = `⏩ Semua Bed (${n})`;
  $('info').textContent = c ? `Ruang ${c.ward} • ${n} terisi • ${kosong.length} kamar kosong` : 'Data SIMPAN belum diterima. Tekan 🔄 atau buka panel Companion.';
  const sh = $('shift'); if (c && c.shift && !ASISTEN.shiftSet) { sh.value = c.shift; }
  $('ini').disabled = ASISTEN.running; $('semua').disabled = ASISTEN.running || n === 0;
  $('stop').style.display = ASISTEN.running ? '' : 'none';
  const hasil = ASISTEN.hasil;
  const beres = hasil.filter(h => h.status === 'beres'), cek = hasil.filter(h => h.status !== 'beres');
  $('s1').textContent = `📊 ${hasil.length} / ${ASISTEN.total}`;
  $('s2').textContent = `✅ ${beres.length} Beres`;
  $('s3').textContent = `⚠️ ${cek.length} Cek`;
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  $('masalah').innerHTML = cek.map(h => `<div class="mas ${h.status === 'gagal' ? 'x' : ''}">${h.status === 'gagal' ? '❌' : '⚠️'} [${esc(h.bed)}] • ${esc(h.nama)} — ${esc(h.alasan)}</div>`).join('');
  const bb = $('beresBox');
  bb.style.display = beres.length ? '' : 'none';
  $('beresSum').textContent = `▾ Lihat ${beres.length} pasien yang ✅ Beres`;
  $('beresIsi').innerHTML = beres.map(h => `<span class="chip">✓ ${esc(h.bed)} • ${esc(h.nama)}</span>`).join('');
}

function asistenStatus(t) { const r = ASISTEN.root; if (r) r.getElementById('status').textContent = t; }

function asistenRenderDraft() {
  const r = ASISTEN.root; if (!r || !ASISTEN_DRAFT) return;
  const box = r.getElementById('draftIsi'); box.innerHTML = '';
  for (const it of ASISTEN_DRAFT.items) {
    const baris = document.createElement('div'); baris.className = 'dr';
    const ringkas = it.teks ? it.teks.replace(/\s+/g, ' ').slice(0, 40) : (it.alasan || 'kosong');
    const b = document.createElement('b'); b.textContent = it.nama;
    const s = document.createElement('span'); s.textContent = ringkas; s.title = it.teks || '';
    const t = document.createElement('button'); t.textContent = it.teks ? 'Salin' : '-'; t.disabled = !it.teks;
    t.onclick = async () => {
      try { await navigator.clipboard.writeText(it.teks); } catch (e) { const x = document.createElement('textarea'); x.value = it.teks; document.body.appendChild(x); x.select(); document.execCommand('copy'); x.remove(); }
      const k = ASISTEN_DRAFT.ambilKolom(); const el = k && k[it.nama.toLowerCase()];
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
      t.textContent = '✓ Ctrl+V';
    };
    baris.append(b, s, t); box.appendChild(baris);
  }
}

function asistenRekamForm() {
  const host = ASISTEN.host;
  const rapi = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const labelDari = (el) => {
    let t = '';
    if (el.id) { try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) t = l.textContent; } catch (e) {} }
    if (!t) { const l = el.closest('label'); if (l) t = l.textContent; }
    if (!t) t = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    if (!t) {
      let p = el.parentElement;
      for (let i = 0; i < 4 && p && !t; i++, p = p.parentElement) t = (p.previousElementSibling && p.previousElementSibling.textContent) || '';
    }
    return rapi(t);
  };
  const out = {
    url: location.hash,
    judul: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend')).filter(h => !host.contains(h)).map(h => rapi(h.textContent)).filter(Boolean).slice(0, 60),
    kontrol: [], tombol: []
  };
  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (host.contains(el) || el.type === 'hidden') return;
    const k = { jenis: el.tagName.toLowerCase() + (el.type ? ':' + el.type : ''), nama: el.name || '', id: el.id || '', label: labelDari(el), tampak: tampak(el) };
    if (['radio', 'checkbox'].includes(el.type)) { k.nilai = el.value; k.tercentang = el.checked; }
    if (el.tagName === 'SELECT') k.pilihan = Array.from(el.options).map(o => rapi(o.text)).slice(0, 40);
    out.kontrol.push(k);
  });
  out.tombol = Array.from(document.querySelectorAll('button')).filter(b => !host.contains(b) && tampak(b)).map(b => rapi(b.textContent)).filter(Boolean).slice(0, 60);
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ecal-form_' + (location.hash || 'x').replace(/[^a-z0-9]+/gi, '_').slice(0, 60) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  asistenStatus(`📥 Struktur form disimpan: ${out.kontrol.length} kolom, ${out.tombol.length} tombol.`);
}

function asistenMintaData() {
  asistenStatus('🔄 Meminta data dari panel SIMPAN Companion...');
  try {
    chrome.runtime.sendMessage({ action: 'REQUEST_SIMPAN_ROBOT_DATA', shift: ASISTEN.root?.getElementById('shift')?.value || '' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) { asistenStatus('⚠️ Panel Companion tidak merespons. Buka panel samping SIMPAN, login, lalu tekan 🔄.'); return; }
      ASISTEN.cache = res.payload; asistenRender(); asistenStatus('Data SIMPAN dimuat.' + (res.payload && res.payload.ttdPerawat ? ' TTD perawat: tersimpan ✓' : ''));
    });
  } catch (e) { asistenStatus('⚠️ Gagal menghubungi panel: ' + e.message); }
}

function asistenAmbilConfig() {
  const r = ASISTEN.root; const $ = (id) => r.getElementById(id);
  const autoTtv = $('autoTtv').checked;
  const cfg = {
    shift: $('shift').value,
    nyeri: $('nyeri').value, skalaNyeri: '2',
    autoTtv,
    obatSimpan: true,
    autoSubmitSoap: $('auto').checked,
    pakaiSoapCompanion: $('pakaiS').checked,
    soapTimpa: $('timpa').checked,
    hanyaDosisSaya: $('hanyaSaya').checked,
    obatBolehJamSekarang: $('jamSkr').checked,
    perawat: (ASISTEN.cache && ASISTEN.cache.perawat) || '',
    ttdPerawat: (ASISTEN.cache && ASISTEN.cache.ttdPerawat) || '',
    modul: { ...ASISTEN.modul }
  };
  ['rr', 'spo2', 'sistolik', 'diastolik', 'hr', 'suhu'].forEach(k => { cfg[k] = autoTtv ? '' : ($('t_' + k).value || '').trim(); });
  return cfg;
}

function nilaiLaporan(baris, galat) {
  const masalah = baris.filter(l => /^GAGAL|^Catatan|^TIDAK_DITEMUKAN|^DILEWATI|⚠/.test(l));
  if (galat) return { status: 'gagal', alasan: String(galat).slice(0, 110) };
  const g = masalah.find(l => /^GAGAL|^TIDAK_DITEMUKAN/.test(l));
  if (g) return { status: g.startsWith('GAGAL') ? 'gagal' : 'cek', alasan: g.replace(/^GAGAL:\s*/, '').slice(0, 110) };
  if (masalah.length) return { status: 'cek', alasan: masalah[0].replace(/^Catatan:\s*/, '').slice(0, 110) };
  return { status: 'beres', alasan: '' };
}

async function asistenKerjakan(cfgP) {
  const m = cfgP.modul;
  if (!m.asesmen && !m.obat && !m.soapie) { catat('Catatan: tidak ada modul yang dipilih.'); return; }
  if (m.asesmen) await jalankanModulAsesmen(cfgP);
  if (m.obat) await langkah('Sapu Obat', () => jalankanModulObat(cfgP));
  if (m.soapie) await jalankanModulSoapie(cfgP);
}

async function asistenJalankan(mode) {
  if (ASISTEN.running) return;
  const cfg = asistenAmbilConfig();
  ASISTEN.shiftSet = true;
  ASISTEN.running = true; STOP_ROBOT_FLAG = false;
  ASISTEN.hasil = []; ASISTEN.total = 0; LAPORAN = [];
  asistenRender();
  try {
    if (mode === 'ini') {
      ASISTEN.total = 1;
      const rm = bacaRmDiHalaman();
      const c = ASISTEN.cache || { allPatients: [] };
      const pas = (c.allPatients || []).find(p => rmBersih(p.rm) === rmBersih(rm));
      const nama = pas ? pas.name : ('RM …' + String(rm || '').slice(-4));
      asistenStatus(`⏳ [1/1] ${nama}`);
      const mulai = LAPORAN.length; let galat = '';
      try {
        await asistenKerjakan({ ...cfg, rmTarget: rm, cpoCheckedMeds: pas?.cpoCheckedMeds || [], cpoCheckedDetail: pas?.cpoCheckedDetail || [], companionSoap: pas?.companionSoap || {} });
      } catch (e) { if (e.message === 'ROBOT_STOPPED_BY_USER') throw e; galat = e.message; }
      const v = nilaiLaporan(LAPORAN.slice(mulai), galat);
      ASISTEN.hasil.push({ bed: pas?.bed || '-', nama, ...v });
    } else {
      const daftar = ((ASISTEN.cache || {}).allPatients || []);
      ASISTEN.total = daftar.length;
      for (let i = 0; i < daftar.length; i++) {
        cekStop();
        const p = daftar[i];
        const pendek = String(p.name || '').split(/\s+/).slice(0, 2).join(' ');
        asistenStatus(`⏳ [${i + 1}/${daftar.length}] ${p.bed} • ${pendek}`);
        asistenRender();
        simpanKePanel({ action: 'ROBOT_SWITCH_BED', bed: p.bed });
        if (!p.rm) { ASISTEN.hasil.push({ bed: p.bed, nama: pendek, status: 'cek', alasan: 'RM kosong di SIMPAN, dilewati' }); continue; }
        const mulai = LAPORAN.length; let galat = '';
        try {
          await jalankanPasienRm({ ...cfg, rmTarget: p.rm, cpoCheckedMeds: p.cpoCheckedMeds || [], cpoCheckedDetail: p.cpoCheckedDetail || [], companionSoap: p.companionSoap || {} });
        } catch (e) {
          if (e.message === 'ROBOT_STOPPED_BY_USER') throw e;
          galat = e.message;
        }
        const v = nilaiLaporan(LAPORAN.slice(mulai), galat);
        ASISTEN.hasil.push({ bed: p.bed, nama: pendek, ...v });
        asistenRender();
        if (/^IDENTITAS|^ANTREAN/.test(galat)) { asistenStatus('⚠️ Berhenti demi keamanan: ' + galat.slice(0, 120)); break; }
      }
    }
    if (!/Berhenti demi keamanan/.test(ASISTEN.root?.getElementById('status').textContent || '')) asistenStatus('✅ Selesai.');
  } catch (e) {
    asistenStatus(e.message === 'ROBOT_STOPPED_BY_USER' ? '🛑 Kaktus dihentikan.' : '❌ ' + e.message);
  } finally {
    ASISTEN.running = false;
    asistenRender();
  }
}

// ============================================================================
// LISTENER PESAN DARI APP.JSX (SCRAPE & SIMPAN KAKTUS)
// ============================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SYNC_ECAL_ASSISTANT") {
    if (request.payload) ASISTEN.cache = request.payload;
    if (request.openModal) pastikanAsisten();
    if (ASISTEN.root) asistenRender();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "STOP_ECAL_ROBOT") {
    STOP_ROBOT_FLAG = true;
    sendResponse({ success: true, message: "Perintah berhenti dikirim." });
    return true;
  }

  if (request.action === "RUN_ECAL_ROBOT") {
    STOP_ROBOT_FLAG = false;
    const { mode, config } = request;
    (async () => {
      try {
        const laporan = await jalankanRobot(mode, config);
        const gagal = laporan.filter(l => /^GAGAL|^Catatan|belum merespons/.test(l));
        const hasil = laporan.some(l => /^TIDAK_DITEMUKAN/.test(l)) ? 'TIDAK_DITEMUKAN' : laporan.some(l => /^DILEWATI/.test(l)) ? 'DILEWATI' : (gagal.length ? 'ADA_CATATAN' : 'OK');
        sendResponse({
          hasil,
          success: gagal.length === 0,
          message: (gagal.length ? "Selesai dengan catatan:\n" : "Selesai:\n") + laporan.join("\n"),
          error: gagal.length ? laporan.join("\n") : undefined
        });
      } catch (err) {
        const pesan = err.message === "ROBOT_STOPPED_BY_USER" ? "Robot dihentikan oleh pengguna." : err.message;
        sendResponse({ hasil: 'GAGAL', success: false, error: pesan + (LAPORAN.length ? "\n" + LAPORAN.join("\n") : "") });
      }
    })();
    return true;
  }

  // ⚡ FITUR ASLI: SCRAPE DATA ECALYPTUS KE SIMPAN COMPANION
  if (request.action === "SCRAPE_ECALYPTUS") {
    try {
      const pageText = document.body ? (document.body.innerText || "") : "";
      let lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

      const rmMatch = pageText.match(/(?:No\.?\s*RM|RM)\s*[:\n\r\t]*(\d{6,10})/i);
      const rmNumber = rmMatch ? rmMatch[1].trim() : "";

      let admissionDate = "";
      const regMatch = pageText.match(/(?:Tgl\.?\s*Reg(?:istrasi)?|Tanggal\s*Registrasi)\s*[:\n\r\t]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}(?:[,\s]+[0-9]{1,2}[:.][0-9]{1,2})?)/i);
      if (regMatch) admissionDate = regMatch[1].trim();

      let dpjpName = "";
      for (let i = 0; i < lines.length; i++) {
        if (/^DPJP$/i.test(lines[i])) {
          if (lines[i + 1] && /^(?:dr\.|drg\.|dokter)/i.test(lines[i + 1])) {
            dpjpName = lines[i + 1].trim();
            break;
          }
        }
      }
      if (!dpjpName) {
        const dpjpMatch = pageText.match(/(?:^|\n)\s*DPJP\s*[:\n\r\t]+(dr\.?[^\n\r]+)/i);
        if (dpjpMatch) dpjpName = dpjpMatch[1].trim();
      }

      let gender = "L";
      let patientName = "";
      for (let i = 0; i < lines.length; i++) {
        if (/^(?:Perempuan|Laki-laki|Wanita|Pria|♂|♀)/i.test(lines[i])) {
          gender = /Perempuan|Wanita|♀/i.test(lines[i]) ? "P" : "L";
          let nameParts = [];
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            const l = lines[j];
            if (/consent/i.test(l)) { if (nameParts.length) break; else continue; }
            if (/^(?:Informed\s*Consent|Detail\s*Pasien|Pasien\s*lainnya|Sembunyikan|Halaman\s*Utama|Pasien)$/i.test(l)) continue;
            if (/[0-9]/.test(l)) break;
            nameParts.unshift(l);
            if (nameParts.join(' ').length >= 5) break;
          }
          patientName = nameParts.join(' ');
          break;
        }
      }
      patientName = patientName.replace(/General\s*Consent\s*&?/gi, '').replace(/Informed\s*Consent/gi, '').replace(/\b(?:Ny|Tn|An|By|Nn|Sdr|Sdri)\b\.?/gi, '').replace(/\s+/g, ' ').trim();

      let cpptSource = "";
      let cpptSourceOld = false;
      let cpptEntries = [];
      {
        const normKey = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
        const starts = [];
        lines.forEach((l, i) => { if (/^Tanggal\s*Input/i.test(l)) starts.push(i); });

        if (starts.length > 0) {
          const entries = starts.map((s, k) => {
            const chunk = lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length);
            const pel = chunk.findIndex(l => /^Pelaksana/i.test(l));
            let author = "";
            if (pel !== -1) {
              author = chunk.slice(pel + 1, pel + 6).find(l => /\bdr\b|dr\.|Sp\./i.test(l)) || "";
            }
            const dIdx = chunk.findIndex(l => /^Dokter\s*DPJP$/i.test(l));
            const specialty = dIdx !== -1 ? (chunk[dIdx + 1] || "") : "";
            const dateLine = chunk[0] + ' ' + (chunk[1] || '');
            const hasSOAP = chunk.some(l => /^Subjektif$/i.test(l)) && chunk.some(l => /^Objektif$/i.test(l));
            return { chunk, author, specialty, dateLine, hasSOAP };
          }).filter(e => e.hasSOAP);

          cpptEntries = [];
          const seenA = new Set();
          entries.forEach(e => {
            const k = normKey(e.author);
            if (k && !seenA.has(k)) {
              seenA.add(k);
              cpptEntries.push({ key: k, label: `${e.author} (${e.specialty || '?'})` });
            }
          });

          let pick = null;
          if (request.authorKey) pick = entries.find(e => normKey(e.author) === request.authorKey);
          if (!pick && dpjpName) pick = entries.find(e => e.author && normKey(e.author) === normKey(dpjpName));
          if (!pick) pick = entries.find(e => e.author) || entries[0];   // utamakan entri DOKTER, bukan CPPT perawat

          if (pick) {
            let chunk = pick.chunk;
            const ins = chunk.findIndex(l => /^Instruksi$/i.test(l));
            if (ins !== -1) chunk = chunk.slice(0, ins);
            lines = chunk;
            cpptSource = `${pick.author || '?'} (${pick.specialty || '?'}) ${pick.dateLine}`.replace(/\s+/g, ' ').trim();
            const isDpjp = dpjpName && normKey(pick.author) === normKey(dpjpName);
            if (!isDpjp) cpptSourceOld = true;
            if (!pick.author) cpptSourceOld = true;
          }
        }
      }

      let idxSubjektif = -1, idxObjektif = -1, idxAssesmen = -1, idxRencana = -1;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^Subjektif$/i.test(l) && idxSubjektif === -1) idxSubjektif = i;
        else if (/^Objektif$/i.test(l) && idxObjektif === -1) idxObjektif = i;
        else if (/^(?:Assesmen|Asesmen)$/i.test(l) && idxAssesmen === -1) idxAssesmen = i;
        else if (/^(?:Rencana|Resep)$/i.test(l) && idxAssesmen !== -1 && idxRencana === -1) idxRencana = i;
      }

      const isCpptPage = (idxSubjektif !== -1 && idxObjektif !== -1 && idxAssesmen !== -1);

      let extractedLab = "";
      const isActualLabTab = !isCpptPage && (
        /Dokter\s*Verifikator\s*Hasil/i.test(pageText) ||
        (/Nilai\s*Rujukan/i.test(pageText) && /Rincian\s*Tindakan/i.test(pageText))
      );

      if (isActualLabTab) {
        const labItems = [];
        const seen = new Set();
        const labDateMatch = pageText.match(/(?:Patologi\s*Klinik)[\s\S]*?(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}[:.]\d{1,2})/i);
        const labTime = labDateMatch ? labDateMatch[1].trim() : "";

        const normalizeLabName = (name) => {
          const n = name.toLowerCase().replace(/\s+/g, ' ').trim();
          if (/a1c|glikohemoglobin/.test(n)) return 'HbA1c';
          if (/2\s*jam\s*pp|2\s*jpp|post\s*prandial/.test(n)) return '2JPP';
          if (/gula darah puasa|\bgdp\b/.test(n)) return 'GDP';
          if (/gula darah sewaktu|\bgds\b/.test(n)) return 'GDS';
          if (/^hemoglobin\b|^hb\b/.test(n)) return 'Hb';
          if (/hematokrit|^hct\b|^ht\b/.test(n)) return 'Ht';
          if (/^natrium|^na\b/.test(n)) return 'Na';
          if (/^kalium|^k\b/.test(n)) return 'K';
          if (/^klorida|^clorida|^chloride|^cl\b/.test(n)) return 'Cl';
          if (/^kalsium|^calcium|^ca\b/.test(n)) return 'Ca';
          return name;
        };

        const tableRows = document.querySelectorAll('tr');
        tableRows.forEach(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(c => (c.innerText || '').trim());
          if (cells.length >= 2) {
            let tName = cells[0].split('\n')[0].trim();
            let tVal = cells[1].trim();
            if (!tName || /^(?:Rincian|Tindakan|Hasil|Satuan|Nilai|Status|Riwayat|-)$/i.test(tName)) return;
            if (!tVal || tVal === '-' || /^(?:Hasil|Satuan)$/i.test(tVal)) return;
            if (/\d/.test(tVal) || /^(?:Positif|Negatif|Reaktif|Non[- ]?Reaktif)$/i.test(tVal)) {
              tName = normalizeLabName(tName);
              const key = tName.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                labItems.push(`${tName} ${tVal}`);
              }
            }
          }
        });

        if (labItems.length > 0) extractedLab = `Lab${labTime ? ` (${labTime})` : ''}:\n` + labItems.join('\n');
      }

      let extractedRad = "";
      const isActualRadTab = !isCpptPage && (
        /Hasil\s*Pemeriksaan/i.test(pageText) && (/PACS/i.test(pageText) || /Sp\.Rad/i.test(pageText))
      );

      if (isActualRadTab) {
        const dateMatch = pageText.match(/(?:Hasil\s*USG|Radiologi)[\s\S]*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
        let kesanLines = [];
        let startCapture = false;

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/^KESAN\s*[:\n\r\t]*/i.test(l)) {
            startCapture = true;
            const inlineText = l.replace(/^KESAN\s*[:\n\r\t]*/i, '').trim();
            if (inlineText) kesanLines.push(inlineText);
            continue;
          }
          if (startCapture) {
            if (/^(?:Terima\s*kasih|Kesimpulan|PACS|Dokter|Status|Verifikasi|Sp\.Rad)/i.test(l)) break;
            kesanLines.push(l);
          }
        }

        if (kesanLines.length > 0) {
          const cleanKesan = kesanLines.map(line => line.replace(/^[-•*]\s*/, '')).filter(Boolean).map(line => `- ${line}`).join('\n');
          extractedRad = `Rad${dateMatch ? ` (${dateMatch[1]})` : ''}:\nKesan:\n${cleanKesan}`;
        }
      }

      let subjective = "", objective = "", analysis = "", planning = "";
      let prescriptionList = [];

      if (isCpptPage) {
        const sLines = lines.slice(idxSubjektif + 1, idxObjektif);
        subjective = sLines.filter(l => !/^(?:Hasil\s*USG|Kesan|Catatan)/i.test(l)).join('\n').trim();

        const oLines = lines.slice(idxObjektif + 1, idxAssesmen).filter(l => !/^(?:Tanda\s*Vital|Angka|Catatan|-)$/i.test(l));
        objective = oLines.join('\n').trim();

        const endAIdx = idxRencana !== -1 ? idxRencana : Math.min(lines.length, idxAssesmen + 5);
        const aLines = lines.slice(idxAssesmen + 1, endAIdx).filter(l => !/^(?:Catatan|Simpan\s*SOAP|Planning|Resep|Rencana)$/i.test(l));
        analysis = aLines.join('\n').trim();

        if (idxRencana !== -1) {
          const pRawLines = [];
          for (let i = idxRencana + 1; i < lines.length; i++) {
            const l = lines[i];
            if (/^(?:Instruksi|Tindakan|ICD9CM|Informasi|Pelaksana|Visite|Tanggal\s*Input|Tanggal\s*SOAP|Riwayat|Evaluasi|Konsul|Rujuk|Subjektif|Objektif|Assesmen|Asesmen|Filter|Simpan\s*SOAP)/i.test(l)) break;
            pRawLines.push(l);
          }

          const tableIndices = new Set();
          for (let i = 0; i < pRawLines.length; i++) {
            const l = pRawLines[i];
            const ddMatch = l.match(/(\d+)\s*dd\s*(\d+(?:[.,]\d+)?)/i);
            if (ddMatch && i > 0) {
              let medNameIdx = i - 1;
              while (medNameIdx >= 0 && (/^[-–—•*_\s]+$/.test(pRawLines[medNameIdx]) || /^(?:Catatan|Aturan|Nama)/i.test(pRawLines[medNameIdx]))) medNameIdx--;
              if (medNameIdx >= 0) {
                const rawMed = pRawLines[medNameIdx].replace(/^[-–—•*_\s]+/, '').trim();
                if (rawMed.length > 2 && !/^(?:Resep|No\.?\s*Resep|Nama|Aturan|Catatan)/i.test(rawMed)) {
                  prescriptionList.push(`- ${rawMed} (${ddMatch[1]}x${ddMatch[2]})`);
                  tableIndices.add(medNameIdx);
                  tableIndices.add(i);
                  if (i + 1 < pRawLines.length && /^[-–—•*_\s]+$/.test(pRawLines[i + 1])) tableIndices.add(i + 1);
                  if (i + 2 < pRawLines.length && /^[-–—•*_\s]+$/.test(pRawLines[i + 2])) tableIndices.add(i + 2);
                }
              }
            }
          }

          const freePlanningLines = [];
          for (let i = 0; i < pRawLines.length; i++) {
            if (tableIndices.has(i)) continue;
            const l = pRawLines[i].trim();
            if (!l || /^[-–—•*_]+$/.test(l)) continue;
            if (/^(?:Resep|No\.?\s*Resep.*|Nama\s*Resep.*|Nama\s*Obat|Aturan\s*pakai.*|Catatan)$/i.test(l)) continue;
            if (/\d+\s*dd\s*[\d\.,]+/i.test(l)) continue;
            freePlanningLines.push(l);
          }

          planning = freePlanningLines.join('\n').trim();
        }
      }

      sendResponse({
        success: true,
        data: {
          name: patientName,
          rmNumber: rmNumber,
          gender: gender,
          admissionDate: admissionDate,
          dpjpName: dpjpName,
          isLab: Boolean(extractedLab),
          isRad: Boolean(extractedRad),
          labText: extractedLab,
          radText: extractedRad,
          subjective: subjective,
          objective: objective,
          analysis: analysis,
          planning: planning,
          prescription: prescriptionList.join('\n'),
          cpptSource, cpptSourceOld, cpptEntries, bukanDpjp: cpptSourceOld
        }
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});