// ===== PANEL MENGAMBANG SIMPAN =====
(function () {
  if (window.top !== window) return;
  if (document.getElementById('simpan-float-root')) return;

  const FAB = 48;            // diameter tombol (px)
  const MARGIN = 12;         // jarak default dari tepi layar
  const POS_KEY = 'simpanFabPos';
  const IDLE_OPACITY = 0.35; // transparansi saat didiamkan

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

  let pos = { x: 0, y: 0 };                 // posisi kiri-atas tombol
  let hovering = false, dragging = false, touchAwake = false, touchTimer = null;
  let activeId = null, startX = 0, startY = 0, origX = 0, origY = 0, moved = false;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  const clampPos = (p) => ({
    x: clamp(p.x, 4, window.innerWidth - FAB - 4),
    y: clamp(p.y, 4, window.innerHeight - FAB - 4)
  });

  // Tombol tebal saat disentuh/ditunjuk kursor, digeser, atau panel terbuka
  const refreshAwake = () => {
    fab.classList.toggle('awake', hovering || dragging || touchAwake || panel.classList.contains('open'));
  };

  // Panel muncul di dekat tombol (di atas bila muat, kalau tidak di bawah)
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

  // Posisi disimpan sebagai proporsi layar, jadi tetap wajar di ukuran layar berbeda
  const savePos = () => {
    try {
      chrome.storage.local.set({ [POS_KEY]: { x: pos.x / window.innerWidth, y: pos.y / window.innerHeight } });
    } catch (e) { /* tanpa izin storage: posisi tidak diingat */ }
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
    try { fab.setPointerCapture(e.pointerId); } catch (err) { }
    if (e.pointerType === 'touch') { touchAwake = true; clearTimeout(touchTimer); refreshAwake(); }
  });

  fab.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 5) return;  // di bawah 5px dianggap klik
    moved = true; dragging = true;
    fab.classList.add('dragging');
    pos = clampPos({ x: origX + dx, y: origY + dy });
    applyPos();
    refreshAwake();
  });

  const endPointer = (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    try { fab.releasePointerCapture(e.pointerId); } catch (err) { }
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

  // Akses keyboard (Enter/Spasi)
  fab.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); }
  });

  window.addEventListener('resize', () => { pos = clampPos(pos); applyPos(); });

  // Posisi awal: pojok kanan bawah, lalu pakai posisi tersimpan bila ada
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
  } catch (e) { /* tanpa izin storage */ }

  (document.body || document.documentElement).appendChild(host);
})();
// ===== AKHIR PANEL MENGAMBANG =====

// ============================================================================
// ROBOT AUTO-ECALYPTUS v2  (berbasis aturan, tanpa AI)
// Prinsip: menunggu elemen (bukan jeda tetap), simpan SATU kali, cek identitas
// pasien, TTV hanya dari nilai nyata (tidak pernah diacak/dikarang), semua
// kegagalan dicatat ke laporan dan tidak diam-diam diabaikan.
// ============================================================================
let STOP_ROBOT_FLAG = false;
let LAPORAN = [];
let RM_TERKUNCI = '';

const jeda = (ms) => new Promise(res => setTimeout(res, ms));
const catat = (teks) => { LAPORAN.push(teks); };

function cekStop() {
  if (STOP_ROBOT_FLAG) throw new Error("ROBOT_STOPPED_BY_USER");
}

// Tunggu sampai fn() bernilai benar. Kembalikan nilainya, atau null jika habis waktu.
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

// Cari elemen yang tampak dengan teks persis sama (huruf besar/kecil diabaikan)
function cariTeks(teks, selector = 'button, label, span, div, a, p, h6, li', lingkup = document) {
  const t = norm(teks);
  const semua = Array.from(lingkup.querySelectorAll(selector));
  const cocok = semua.filter(el => tampak(el) && norm(el.textContent) === t);
  // Pilih elemen PALING DALAM: pembungkus luar sering tidak punya pendengar klik
  return cocok.find(el => !cocok.some(o => o !== el && el.contains(o))) || null;
}
const targetKlik = (el) => el.closest('button, label, [role="button"], a') || el;

async function klikTeks(teks, opsi = {}) {
  const el = await tunggu(() => cariTeks(teks, opsi.selector), opsi.timeout || 8000);
  if (!el) return null;
  targetKlik(el).click();
  return el;
}

// Tombol aktif? (Ecalyptus mengabukan tombol Simpan sebelum form lengkap)
function tombolAktif(el) {
  const b = el.closest('button') || el;
  return !(b.disabled || b.getAttribute('aria-disabled') === 'true' || /disabled/i.test(b.className || ''));
}

// Ketik ke input React (menembus virtual DOM)
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

// Mengetik seperti pengguna sungguhan: fokus, pilih semua, lalu insertText (peristiwa input
// dibuat browser sendiri, jadi framework form ikut memperbarui state-nya).
// Cadangan: pengisi nilai biasa. Mengembalikan true bila nilai akhirnya sama.
function ketikSungguh(el, nilai) {
  if (!el) return false;
  const teks = String(nilai);
  try {
    el.focus();
    el.setSelectionRange(0, (el.value || '').length);
    document.execCommand('insertText', false, teks);
  } catch (e) { /* lanjut ke cadangan */ }
  if (el.value !== teks) ketikKeInputReact(el, teks);
  return el.value === teks;
}

// Klik opsi (radio/label) di bawah sebuah judul pertanyaan
function klikOpsiBerdasarkanJudul(teksJudul, teksOpsi, urutan = 0) {
  const kandidat = Array.from(document.querySelectorAll('h6, p, span, div, label'))
    .filter(el => el.children.length === 0 && norm(el.textContent).includes(norm(teksJudul)));
  const judul = kandidat[urutan];
  if (!judul) return false;
  let wadah = judul.parentElement;
  for (let i = 0; i < 5 && wadah; i++) {
    const opsi = Array.from(wadah.querySelectorAll('label, button, span'))
      .find(l => norm(l.textContent) === norm(teksOpsi));
    if (opsi) { opsi.click(); return true; }
    wadah = wadah.parentElement;
  }
  return false;
}

// Klik radio berdasarkan labelnya dan pastikan benar-benar terpilih
function pilihRadio(teks) {
  const lbl = Array.from(document.querySelectorAll('label')).find(l => tampak(l) && norm(l.textContent) === norm(teks));
  if (!lbl) return false;
  const input = lbl.querySelector('input[type="radio"]') || (lbl.htmlFor && document.getElementById(lbl.htmlFor));
  lbl.click();
  if (input && !input.checked) input.click();
  return input ? !!input.checked : true;
}

// ---------------------------------------------------------------------------
// IDENTITAS PASIEN
// ---------------------------------------------------------------------------
function bacaRmDiHalaman() {
  const m = (document.body?.innerText || '').match(/No\.?\s*RM\s*[:\s]*(\d{5,10})/i);
  return m ? m[1] : '';
}
// Panggil di awal tiap modul: kunci RM yang sedang terbuka. Jika config.rmTarget
// diisi dan tidak cocok dengan layar, robot berhenti sebelum menyentuh apa pun.
const rmBersih = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
function kunciPasien(config) {
  if (!/\/patient\/|activity-patient/.test(location.hash)) {
    throw new Error('IDENTITAS: layar bukan halaman pasien (mungkin Beranda). Buka dulu pasiennya di Ecalyptus (mis. Asesmen Awal), lalu jalankan robot.');
  }
  const rm = bacaRmDiHalaman();
  if (!rm) throw new Error('IDENTITAS: nomor RM tidak terbaca di layar, robot tidak jalan.');
  if (config && config.rmTarget && rmBersih(config.rmTarget) !== rmBersih(rm)) {
    throw new Error(`IDENTITAS: layar menampilkan RM berakhiran ...${rm.slice(-4)}, bukan pasien target. Robot berhenti.`);
  }
  RM_TERKUNCI = rm;
  return rm;
}
// Dipanggil tepat sebelum setiap SIMPAN
function pastikanPasienSama() {
  const rm = bacaRmDiHalaman();
  if (rm !== RM_TERKUNCI) throw new Error('IDENTITAS: pasien di layar berubah di tengah proses, penyimpanan dibatalkan.');
}

// ---------------------------------------------------------------------------
// SHIFT (pagi 08-14, siang 14-21, malam 21-08)
// ---------------------------------------------------------------------------
function shiftDariJam(d = new Date()) {
  const h = d.getHours();
  if (h >= 8 && h < 14) return 'pagi';
  if (h >= 14 && h < 21) return 'siang';
  return 'malam';
}
const tentukanShift = (config) => (['pagi', 'siang', 'malam'].includes(config?.shift) ? config.shift : shiftDariJam());

// ---------------------------------------------------------------------------
// SIMPAN SATU KALI + TUNGGU "Submit data success!"
// Klik kedua hanya terjadi bila klik pertama terbukti tidak memicu apa pun.
// ---------------------------------------------------------------------------
const teksHalaman = () => document.body?.innerText || '';
const sedangKirim = () => /submit+ing data/i.test(teksHalaman());
const sudahSukses = () => /submit data success/i.test(teksHalaman());

// Petunjuk di layar mengapa form belum lengkap (teks merah / kata wajib / tanda bintang)
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
  if (!aktif) { const hint = petunjukWajib(); throw new Error(`Tombol "${teksTombol}" tetap nonaktif (form belum lengkap).${hint.length ? ' Petunjuk di layar: ' + hint.join(' | ') : ''}`); }

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
  await tunggu(() => !sudahSukses() && !sedangKirim(), 10000, 150); // pesan menghilang
  return true;
}

// ---------------------------------------------------------------------------
// SKALA NYERI: kunci ke wadah yang anak-anaknya berurutan 0..10
// ---------------------------------------------------------------------------
function cariWadahSkala() {
  const wadah = Array.from(document.querySelectorAll('div, ul, span')).filter(el => {
    const anak = Array.from(el.children);
    if (anak.length < 11) return false;
    const teks = anak.map(a => norm(a.textContent));
    for (let i = 0; i + 11 <= teks.length; i++) {
      if (teks.slice(i, i + 11).every((t, k) => t === String(k))) return true;
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
  if (!ok) catat(`Skala nyeri ${n} sudah diklik tapi "Skor : ${n}" tidak terlihat. Mohon cek.`);
  return true;
}

// ---------------------------------------------------------------------------
// TTV: hanya nilai nyata. Prioritas: isian panel (6 kolom lengkap) -> teks halaman.
// ---------------------------------------------------------------------------
function bacaTtv(config) {
  const p = config || {};
  const manual = ['rr', 'spo2', 'sistolik', 'diastolik', 'hr', 'suhu'].map(k => String(p[k] ?? '').trim());
  if (manual.every(Boolean)) {
    const [rr, spo2, sistolik, diastolik, hr, suhu] = manual;
    return { rr, spo2, sistolik, diastolik, hr, suhu };
  }
  if (p.autoTtv === false) return null;
  const t = teksHalaman();
  const td = t.match(/Tekanan\s*darah[\s\n:]*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  const hr = t.match(/Detak\s*jantung[\s\n:]*(\d{2,3})/i);
  const rr = t.match(/Frekuensi\s*pernafasan[\s\n:]*(\d{1,2})/i);
  const suhu = t.match(/Suhu[\s\n:]*(\d{2}(?:[.,]\d)?)/i);
  const spo2 = t.match(/SpO2[\s\n:]*(\d{2,3})/i);
  if (!(td && hr && rr && suhu && spo2)) return null;
  return { rr: rr[1], spo2: spo2[1], sistolik: td[1], diastolik: td[2], hr: hr[1], suhu: suhu[1].replace(',', '.') };
}

// Cari input berdasarkan teks labelnya (input pertama SETELAH label di wadah terdekat)
function inputUntukLabel(teksLabel) {
  const t = norm(teksLabel);
  const labels = Array.from(document.querySelectorAll('label, span, p, div'))
    .filter(el => el.children.length === 0 && tampak(el) && norm(el.textContent).replace(/\s*°c$/, '') === t.replace(/\s*°c$/, ''));
  for (const lb of labels) {
    let w = lb.parentElement;
    for (let i = 0; i < 3 && w; i++, w = w.parentElement) {
      const ins = Array.from(w.querySelectorAll('input')).filter(x => !['radio', 'checkbox'].includes(x.type) && tampak(x));
      const sesudah = ins.find(x => lb.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (sesudah) return sesudah;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. ASESMEN: NYERI -> JATUH -> EWS
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

// Geriatri: jawaban faktor risiko bawaan pilihan pengguna (hanya untuk pertanyaan yang BELUM dijawab):
// semua Ya/Tidak = Tidak; transfer = "Memerlukan sedikit bantuan"; mobilitas = "Berjalan dengan bantuan satu orang".
// Jawaban yang sudah terpilih tidak diubah.
function isiJawabanGeriatriBawaan() {
  const grup = new Map();
  document.querySelectorAll('input[type="radio"]').forEach(inp => {
    if (!inp.name || !tampak(inp.closest('label') || inp)) return;
    if (!grup.has(inp.name)) grup.set(inp.name, []);
    grup.get(inp.name).push(inp);
  });
  let tidak = 0, transfer = 0, mobilitas = 0, tidakDikenal = 0;
  grup.forEach(list => {
    if (list.some(i => i.checked)) return;
    const teks = list.map(i => norm((i.closest('label') || i.parentElement)?.textContent));
    const klik = (idx) => { const l = list[idx].closest('label') || list[idx]; l.click(); if (!list[idx].checked) list[idx].click(); };
    const iTidak = teks.findIndex(t => t === 'tidak');
    const iTransfer = teks.findIndex(t => t.startsWith('memerlukan sedikit bantuan'));
    const iMobil = teks.findIndex(t => t.startsWith('berjalan dengan bantuan satu orang'));
    if (iTidak >= 0 && teks.includes('ya')) { klik(iTidak); tidak++; }
    else if (iTransfer >= 0) { klik(iTransfer); transfer++; }
    else if (iMobil >= 0) { klik(iMobil); mobilitas++; }
    else tidakDikenal++;
  });
  return { tidak, transfer, mobilitas, tidakDikenal };
}

async function jalankanModulAsesmen(config) {
  cekStop();
  kunciPasien(config);
  if (!location.hash.includes('/patient/assessment')) {
    const ok = await klikTeks('Asesmen Awal');
    if (!ok) throw new Error('Menu "Asesmen Awal" tidak ditemukan.');
    await tunggu(() => location.hash.includes('/patient/assessment'), 8000);
  }

  // A. NYERI (bawaan "Tidak"; cabang "Ya" seperti sebelumnya)
  await langkah('Asesmen Nyeri', async () => {
    await bukaTab('Asesmen Nyeri', () => cariTeks('Simpan Assessment Nyeri', 'button, span'));
    if ((config.nyeri || 'tidak') === 'tidak') {
      if (!klikOpsiBerdasarkanJudul('Nyeri', 'Tidak')) throw new Error('opsi "Tidak" tidak ditemukan');
    } else {
      if (!klikOpsiBerdasarkanJudul('Nyeri', 'Ya')) throw new Error('opsi "Ya" tidak ditemukan');
      await jeda(300);
      klikOpsiBerdasarkanJudul('Kondisi', 'Sadar');
      if (!await klikSkalaNyeri(config.skalaNyeri || '2')) throw new Error('skala nyeri tidak ditemukan');
      klikOpsiBerdasarkanJudul('Frekuensi Nyeri', 'Hilang Timbul');
      klikOpsiBerdasarkanJudul('Menjalar', 'Tidak');
      klikOpsiBerdasarkanJudul('Kualitas Nyeri', 'Nyeri tumpul');
      klikOpsiBerdasarkanJudul('Tindak lanjut', 'Intervensi');
    }
    await simpanSekali('Simpan Assessment Nyeri');
  });

  // B. JATUH: tab menyesuaikan usia (Dewasa / Geriatri / lainnya). Intervensi standar semua "Sudah".
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
    if (!await tunggu(cariSimpan, 8000)) throw new Error(`form "${namaTab}" tidak termuat (tombol simpan tidak ada)`);

    const iv = cariTeks('Terapi intravena', 'label, span');
    if (iv) {
      const cb = (iv.closest('label') || iv.parentElement)?.querySelector('input[type="checkbox"]');
      if (!cb || !cb.checked) targetKlik(iv).click();
    } else if (/dewasa/i.test(namaTab)) {
      catat('Catatan: "Terapi intravena" tidak ditemukan di form jatuh.');
    }
    const sudah = Array.from(document.querySelectorAll('label')).filter(l => tampak(l) && norm(l.textContent) === 'sudah');
    sudah.forEach(l => {
      const r = l.querySelector('input[type="radio"]');
      if (!r || !r.checked) l.click();
    });
    if (!sudah.length) throw new Error('pilihan "Sudah" tidak ditemukan');

    // Geriatri: isi jawaban bawaan untuk pertanyaan yang belum dijawab (pilihan pengguna)
    if (/geriatri/i.test(namaTab) && config.jatuhGeriatriBawaan !== false) {
      const h = isiJawabanGeriatriBawaan();
      if (h.tidak + h.transfer + h.mobilitas) catat(`Geriatri: jawaban bawaan diisi (Tidak ${h.tidak}x, transfer ${h.transfer}x, mobilitas ${h.mobilitas}x). Mohon dicek.`);
      if (h.tidakDikenal) catat(`Catatan: ${h.tidakDikenal} pertanyaan jatuh belum dijawab dan tidak dikenali robot.`);
      await jeda(300);
    }
    {
      const teks2 = teksHalaman();
      const skor = (teks2.match(/Total\s*Score\s*:?\s*(\d+)/i) || [])[1];
      const kat = (teks2.match(/Risiko\s+(Rendah|Sedang|Tinggi)\s*\((R[RST])\)/i) || [])[0];
      if (skor !== undefined) catat(`Skor jatuh ${skor}${kat ? ' / ' + kat : ''} (mohon dicek)`);
    }

    const tombolSimpan = cariSimpan();
    await simpanSekali(tombolSimpan.textContent.trim());
  });

  // C. EWS (oksigen + alert; angka hanya dari nilai nyata)
  await langkah('EWS', async () => {
    await bukaTab('Early Warning System (EWS)', () => cariTeks('Simpan dan Selesai', 'button, span'));
    const ttv = bacaTtv(config);
    if (!ttv) throw new Error('TTV tidak terbaca dan tidak diisi di panel. EWS dilewati, TIDAK ada angka yang dikarang.');

    const peta = [['RR/MENIT', ttv.rr], ['SPO2', ttv.spo2], ['Sistole', ttv.sistolik], ['Diastole', ttv.diastolik], ['HR/MENIT', ttv.hr], ['Suhu °C', ttv.suhu]];
    let semuaOk = true;
    for (const [lbl, val] of peta) {
      const inp = await tunggu(() => inputUntukLabel(lbl), 4000);
      if (!inp || !ketikKeInputReact(inp, val)) { semuaOk = false; catat(`Kolom "${lbl}" tidak terisi.`); }
    }
    if (!semuaOk) throw new Error('ada kolom EWS yang tidak terisi, tidak disimpan');

    if (!pilihRadio(config.oksigen === 'air' ? 'air' : 'oxygen')) throw new Error('pilihan oxygen/air gagal');
    if (!pilihRadio(config.kesadaran === 'cvpu' ? 'cvpu' : 'alert')) throw new Error('pilihan alert/cvpu gagal');
    await simpanSekali('Simpan dan Selesai');
  });
}

// ---------------------------------------------------------------------------
// 2. OBAT (tabel: nama obat + 4 kolom Pagi/Siang/Sore/Malam; tombol + per baris)
// Aturan keselamatan:
//  - baris dilewati bila jumlah sel terisi hari ini sudah >= frekuensi (3x1 -> maks 3)
//  - baris dilewati bila namanya cocok dengan config.obatKecuali (mis. "insulin, prn")
//  - nama obat di pop-up harus sama dengan nama di baris, kalau beda -> batal
//  - jam TIDAK diubah: dipakai jam bawaan pop-up (jam saat dicatat)
//  - config.obatSimpan !== true -> hanya SIMULASI (melaporkan, tidak menyimpan)
// ---------------------------------------------------------------------------
const adaJam = (el) => /\d{1,2}[:.]\d{2}/.test((el?.innerText || el?.textContent || '').trim());

// Tabel obat: kolom pertama = nama obat; lalu tiap tanggal (header colspan=4) punya Pagi/Siang/Sore/Malam.
// Jam yang sudah dicatat tampil sebagai teks HH:MM di sel. Kolom Malam (19:00-04:00) memuat jam dini hari
// (00:00-11:59) yang sebenarnya jatuh pada tanggal berikutnya.
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
      const geser = (c - t.kolom0) % 4 === 3 && +jam[1] < 12 ? 1 : 0; // Malam: dini hari = hari berikutnya
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

// Akhir shift (pagi 08-14, siang 14-21, malam 21-08) sebagai Date
function akhirShift(now, shift) {
  const d = new Date(now);
  const akhir = shift === 'pagi' ? 14 : shift === 'siang' ? 21 : 8;
  d.setHours(akhir, 0, 0, 0);
  if (shift === 'malam' && now.getHours() >= 21) d.setDate(d.getDate() + 1);
  return d;
}
const jamStr = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Keputusan per obat berdasarkan RIWAYAT di tabel: jadwal berikut = pemberian terakhir + 24/N jam.
// Diisi bila jadwal berikut jatuh sebelum min(sekarang + toleransi, akhir shift-mu).
function putuskanObat(baris, now, shift, toleransiJam) {
  if (baris.frekuensi == null || baris.frekuensi < 1) return { isi: false, alasan: `aturan "${baris.aturan}" tidak terbaca (mungkin PRN)` };
  if (!baris.riwayat.length) return { isi: false, alasan: 'belum ada riwayat pemberian di tabel, cek manual' };
  const terakhir = new Date(Math.max(...baris.riwayat.map(d => d.getTime())));
  const selang = (24 / baris.frekuensi) * 3600 * 1000;
  const berikut = new Date(terakhir.getTime() + selang);
  const batas = new Date(Math.min(now.getTime() + toleransiJam * 3600 * 1000, akhirShift(now, shift).getTime()));
  if (berikut.getTime() > batas.getTime()) return { isi: false, alasan: `belum waktunya (terakhir ${jamStr(terakhir)}, berikut ±${jamStr(berikut)})` };
  const telat = (now.getTime() - berikut.getTime()) / 3600000;
  if (telat > toleransiJam) return { isi: false, alasan: `TERLAMBAT ${telat.toFixed(1)} jam dari jadwal (terakhir ${jamStr(terakhir)}, jadwal ±${jamStr(berikut)}), mungkin terlewat shift sebelumnya, cek manual` };
  return { isi: true, info: `terakhir ${jamStr(terakhir)}, jadwal berikut ±${jamStr(berikut)}` };
}

async function jalankanModulObat(config) {
  cekStop();
  kunciPasien(config);
  const simpan = config.obatSimpan === true;
  const kecuali = String(config.obatKecuali || '').split(',').map(s => norm(s)).filter(Boolean);

  if (!location.hash.includes('/patient/drug-administration')) {
    const ok = await klikTeks('Pemberian Obat');
    if (!ok) throw new Error('Menu "Pemberian Obat" tidak ditemukan.');
  }
  const siap = await tunggu(() => bacaBarisObat().length > 0, 10000);
  if (!siap) throw new Error('Tabel obat tidak termuat atau kosong.');

  const selesai = new Set();
  let jumlah = 0;
  for (let putaran = 0; putaran < 40; putaran++) {
    cekStop();
    const baris = bacaBarisObat().find(b => !selesai.has(b.nama));
    if (!baris) break;
    selesai.add(b_nama(baris));

    const lewati = (alasan) => catat(`Obat dilewati: ${baris.nama} (${alasan})`);
    if (kecuali.some(k => norm(baris.nama).includes(k) || norm(baris.aturan).includes(k))) { lewati('masuk daftar kecuali'); continue; }
    const kep = putuskanObat(baris, new Date(), tentukanShift(config), Number.isFinite(+config.obatToleransiJam) && config.obatToleransiJam !== '' ? +config.obatToleransiJam : 2);
    if (!kep.isi) { lewati(kep.alasan); continue; }
    if (!baris.plus) { lewati('tombol + tidak ada'); continue; }

    if (!simpan) { catat(`SIMULASI akan diberikan: ${baris.nama} ${baris.aturan} (${kep.info})`); continue; }

    pastikanPasienSama();
    baris.plus.scrollIntoView({ block: 'center' });
    baris.plus.click();
    const dlg = await tunggu(() => document.querySelector('div[role="dialog"] input[name="position"]') && document.querySelector('div[role="dialog"]'), 6000);
    if (!dlg) { catat(`GAGAL: pop-up obat tidak terbuka untuk ${baris.nama}`); continue; }

    const namaDlg = norm(dlg.querySelector('p')?.nextElementSibling?.textContent || dlg.textContent);
    if (!namaDlg.includes(norm(baris.nama))) {
      catat(`GAGAL: nama di pop-up tidak sama dengan baris (${baris.nama}), dibatalkan`);
      document.querySelector('div[role="dialog"] svg[data-icon="times"]')?.parentElement?.click();
      await tunggu(() => !document.querySelector('div[role="dialog"]'), 3000);
      continue;
    }

    const radio = dlg.querySelector('input[name="position"][value="given"]');
    radio.click();
    const tombol = await tunggu(() => {
      const t = cariTeks('Simpan pemberian', 'button span', dlg);
      const b = t && t.closest('button');
      return b && !b.disabled ? b : null;
    }, 5000);
    if (!tombol) { catat(`GAGAL: tombol Simpan pemberian tidak aktif untuk ${baris.nama}`); continue; }

    pastikanPasienSama();
    tombol.click();
    const tertutup = await tunggu(() => !document.querySelector('div[role="dialog"]'), 15000);
    if (!tertutup) { catat(`GAGAL: pop-up tidak menutup setelah simpan (${baris.nama}), cek manual`); throw new Error('Obat berhenti: pop-up macet, cek layar.'); }
    await tunggu(() => !sedangKirim(), 10000);
    const sesudah = await tunggu(() => { const b = bacaBarisObat().find(x => x.nama === baris.nama); return b && b.terisi > baris.terisi ? b : null; }, 10000);
    if (sesudah) { jumlah++; catat(`OK: obat ${baris.nama} dicatat diberikan`); }
    else catat(`GAGAL: ${baris.nama} disimpan tapi sel di tabel belum terisi, cek manual`);
  }
  catat(simpan ? `Obat: ${jumlah} dicatat.` : 'Obat: mode SIMULASI, tidak ada yang disimpan.');
  return jumlah;
}
const b_nama = (b) => b.nama;

// ---------------------------------------------------------------------------
// KAMUS TEMPLATE SOAP PER SHIFT (milik robot; isi O/P/I)
// Sumber: template pengguna. Daftar obat spesifik pasien TIDAK dimasukkan,
// pengguna melengkapinya manual saat review.
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

// ---------------------------------------------------------------------------
// BACA CPPT (panel kanan, tab CPPT): hanya MEMBACA teks, tidak mengklik tombol salin.
// Struktur: <p>Tanggal Input N</p><p>tgl</p><p>noreg</p> ... <p>Pelaksana</p><p>nama</p><p>peran</p>
// lalu <h6>Subjektif|Objektif|Assesmen|Rencana|Implementasi</h6> dan teks di <p> sesudahnya.
// ---------------------------------------------------------------------------
function bacaCpptEntri() {
  const peta = { subjektif: 's', objektif: 'o', assesmen: 'a', rencana: 'p', implementasi: 'i' };
  const out = []; let cur = null, sec = null, tunggu = null;
  for (const el of document.querySelectorAll('p, h6')) {
    if (!tampak(el)) continue;
    const t = norm(el.textContent);
    if (el.tagName === 'H6') { if (cur) sec = peta[t] || null; continue; }
    if (/^tanggal input/.test(t)) { cur = { tgl: null, nama: '', peran: '', s: '', o: '', a: '', p: '', i: '' }; out.push(cur); sec = null; tunggu = 'tgl'; continue; }
    if (!cur) continue;
    if (tunggu === 'tgl') { const m = el.textContent.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})/); if (m) cur.tgl = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]); tunggu = null; continue; }
    if (t === 'pelaksana' && !sec) { tunggu = 'nama'; continue; }
    if (tunggu === 'nama') { cur.nama = el.textContent.trim(); tunggu = 'peran'; continue; }
    if (tunggu === 'peran') { cur.peran = norm(el.textContent); tunggu = null; continue; }
    if (sec && sec !== 'i') cur[sec] += (cur[sec] ? '\n' : '') + el.innerText.trim();
  }
  return out.filter(e => e.tgl);
}
const terbaru = (arr) => arr.slice().sort((x, y) => y.tgl - x.tgl)[0] || null;

// ---------------------------------------------------------------------------
// 3. SOAPIE (draft saja secara bawaan)
// ---------------------------------------------------------------------------
async function jalankanModulSoapie(config) {
  cekStop();
  kunciPasien(config);
  const shift = tentukanShift(config);
  const label = `shift ${shift}`;

  // Halaman Isi SOAP: 5 kolom teks berurutan S, O, A, P, I + tombol "Simpan SOAP"
  const kolom = () => {
    const ta = Array.from(document.querySelectorAll('textarea')).filter(tampak);
    return ta.length === 5 ? { s: ta[0], o: ta[1], a: ta[2], p: ta[3], i: ta[4] } : null;
  };
  const siap = await tunggu(() => kolom() && cariTeks('Simpan SOAP', 'button, span'), 8000);
  if (!siap) throw new Error('SOAPIE: halaman Isi SOAP tidak terbaca (butuh 5 kolom + tombol Simpan SOAP). Buka halaman SOAP pasien dulu.');

  // Jangan menimpa pekerjaan yang sudah ada
  const k0 = kolom();
  if (!config.soapTimpa && (k0.o.value.trim() || k0.p.value.trim() || k0.i.value.trim())) {
    catat('DILEWATI: kolom O/P/I sudah terisi, SOAP tidak ditimpa.');
    return;
  }

  // --- TAHAP 1: KUMPULKAN DATA DULU (klik tab CPPT di sini, SEBELUM mengisi apa pun,
  // karena form Ecalyptus tampak memuat ulang dan menghapus isian saat tab diklik) ---
  let sDokter = '', aPerawat = '';
  if (config.cpptSA !== false) {
    await langkah('Baca CPPT untuk S dan A', async () => {
      const tab = await tunggu(() => cariTeks('CPPT', 'button, span, p') || Array.from(document.querySelectorAll('button')).find(b => tampak(b) && /^cppt\b/.test(norm(b.textContent))), 5000);
      if (!tab) throw new Error('tab CPPT tidak ditemukan');
      targetKlik(tab).click();
      const ada = await tunggu(() => bacaCpptEntri().length > 0, 8000);
      if (!ada) throw new Error('entri CPPT tidak muncul');
      const entri = bacaCpptEntri();
      const dokter = terbaru(entri.filter(e => /dokter|dpjp/.test(e.peran) && e.s.trim()));
      const perawat = terbaru(entri.filter(e => /perawat|ners/.test(e.peran) && e.a.trim()));
      if (dokter) sDokter = dokter.s.split('\n').map(x => x.trim()).find(Boolean) || '';
      else catat('Catatan: CPPT dokter dengan Subjektif tidak ditemukan.');
      if (perawat) aPerawat = perawat.a.trim();
      else catat('Catatan: CPPT perawat dengan Assesmen tidak ditemukan.');
    });
  }

  // --- TAHAP 2: TUNGGU FORM TENANG, lalu isi semua kolom tanpa klik apa pun sesudahnya ---
  await tunggu(() => { const el = cariTeks('Simpan SOAP', 'button, span'); return el && tombolAktif(el); }, 8000);
  await jeda(1500);
  cekStop();
  pastikanPasienSama();

  const k = kolom();
  if (!k) throw new Error('SOAPIE: kolom SOAP hilang setelah membaca CPPT.');
  const rencana = String(config.companionSoap?.planning || '').trim();
  const tpl = TEMPLATE_SOAP[shift];
  const p = rencana ? `${tpl.p}\n\nAdvis dokter:\n${rencana}` : tpl.p;
  const rencanaIsi = [['O', k.o, tpl.o], ['P', k.p, p], ['I', k.i, tpl.i]];
  if (!k.s.value.trim() && sDokter) rencanaIsi.unshift(['S', k.s, sDokter]);
  else if (!k.s.value.trim() && config.pakaiSoapCompanion && config.companionSoap?.subjective) rencanaIsi.unshift(['S', k.s, config.companionSoap.subjective]);
  // A: hanya bila kosong (Ecalyptus sering mengisinya sendiri dari "Asesmen Keperawatan")
  if (!k.a.value.trim() && aPerawat) rencanaIsi.push(['A', k.a, aPerawat]);

  await langkah(`Isi template ${label} dan S/A`, async () => {
    // Satu kolom pada satu waktu, dengan jeda agar form sempat menggambar ulang di antaranya
    // (mengisi semua kolom sekaligus membuat form menimpa kolom lain dengan salinan lama).
    for (const [, el, teks] of rencanaIsi) {
      cekStop();
      if (!ketikSungguh(el, teks)) throw new Error('kolom tidak menerima isian, cek manual');
      await jeda(700);
      try { el.blur(); } catch (e) { /* abaikan */ }
      await jeda(400);
    }
    // Uji sentuh: meniru klik pengguna pada kolom (pemicu isian hilang di rekaman 8 Nov)
    const kt = kolom();
    if (kt) { kt.o.focus(); await jeda(300); kt.o.blur(); }
    // Uji ketahanan dua kali: bila Ecalyptus memuat ulang form, isian yang hilang akan terlihat
    for (const tunda of [1500, 2500]) {
      await jeda(tunda);
      const kk = kolom();
      const hilang = kk ? rencanaIsi.filter(([n, , teks]) => kk[n.toLowerCase()].value !== teks).map(([n]) => n) : ['semua'];
      if (hilang.length) throw new Error(`isian kolom ${hilang.join(', ')} hilang setelah ${tunda} ms (form memuat ulang), tidak disimpan`);
    }
  });
  if (!sDokter) catat('Catatan: kolom S belum terisi dari CPPT dokter, isi manual bila perlu.');
  const kAkhir = kolom();
  if (kAkhir && !kAkhir.a.value.trim()) catat('Catatan: kolom A masih kosong, isi manual (Asesmen Keperawatan).');

  const simpan = cariTeks('Simpan SOAP', 'button, span');
  if (!simpan) { catat('Catatan: tombol "Simpan SOAP" tidak ditemukan.'); return; }
  const btn = targetKlik(simpan);
  // PENYIMPANAN OTOMATIS SOAP DIMATIKAN SEMENTARA (bukti video 8 Nov 2026): isian robot tampil di layar
  // tetapi belum tercatat di data form Ecalyptus, sehingga SOAP yang tersimpan hanya berisi kolom A.
  // Aktifkan lagi hanya setelah terbukti aman, dengan menaruh config.soapSimpanAman = true.
  if (config.autoSubmitSoap && config.soapSimpanAman === true) {
    await langkah('Simpan SOAP', () => simpanSekali('Simpan SOAP'));
  } else {
    if (config.autoSubmitSoap) catat('Catatan: penyimpanan otomatis SOAP dimatikan sementara (isian robot belum tercatat di form). Simpan manual setelah mengetik ulang/menyunting.');
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.style.outline = '4px solid #10b981';
    btn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.8)';
    catat('Draft SOAP siap direview. "Simpan SOAP" TIDAK diklik (tombol diberi garis hijau).');
  }
}

// ---------------------------------------------------------------------------
// ANTREAN: berkeliling daftar pasien Beranda Ecalyptus (kartu <a href="/patient/patient">)
// Filter ruangan + tab "telah dilayani" diatur MANUAL oleh pengguna sebelum mulai.
// Robot hanya membuka kartu yang ruangannya = config.antreanRuang (bawaan "melati")
// dan berstatus "sudah dilayani", dan mencatat RM yang selesai (sessionStorage, per hari).
// ---------------------------------------------------------------------------
const KUNCI_SELESAI = () => 'simpanRobotSelesai_' + new Date().toISOString().slice(0, 10);
function bacaSelesai() { try { return JSON.parse(sessionStorage.getItem(KUNCI_SELESAI()) || '[]'); } catch (e) { return []; } }
function tulisSelesai(arr) { try { sessionStorage.setItem(KUNCI_SELESAI(), JSON.stringify(arr)); } catch (e) { /* tanpa penyimpanan: daftar hanya untuk satu putaran */ } }

function bacaKartu() {
  return Array.from(document.querySelectorAll('a[href="/patient/patient"]')).filter(tampak).map(a => {
    const t = a.innerText || '';
    const rm = (t.match(/NO\.?\s*RM\s*(\d{5,10})/i) || [])[1] || '';
    const baris = t.split('\n').map(s => s.trim()).filter(Boolean);
    const iTgl = baris.findIndex(s => /^TGL\s*REG/i.test(s));
    const ruang = iTgl >= 0 ? (baris[iTgl + 1] || '') : '';
    const status = /sudah\s*dilayani/i.test(t) ? 'sudah' : /belum\s*dilayani/i.test(t) ? 'belum' : '';
    return { a, rm, ruang: norm(ruang), status };
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

function cocokTarget(k, cfg) {
  const ruang = norm(cfg.antreanRuang || 'melati');
  const status = cfg.antreanStatus || 'sudah';
  if (Array.isArray(cfg.antreanRm) && cfg.antreanRm.length && !cfg.antreanRm.map(rmBersih).includes(rmBersih(k.rm))) return false;
  return k.ruang.includes(ruang) && k.status === status;
}

// Cari pasien target berikutnya yang belum selesai; kembalikan {rm, halaman} atau null
async function cariPasienBerikutnya(cfg, selesai) {
  await tunggu(() => bacaKartu().length > 0 || bacaPager(), 10000);
  if (!bacaKartu().length && bacaPager()) await keHalamanDaftar(1);
  const siap = await tunggu(() => bacaKartu().length > 0, 10000);
  if (!siap) throw new Error('ANTREAN: daftar pasien tidak tampil. Buka Halaman Utama, atur filter ruangan dan tab "telah dilayani", lalu ulangi.');
  const pager = bacaPager();
  const jumlah = pager ? Math.max(...pager.angka.map(h => parseInt(h.textContent, 10))) : 1;
  if (jumlah > 8) throw new Error(`ANTREAN: ada ${jumlah} halaman, filter ruangan kemungkinan belum aktif. Atur filter Ruangan dulu.`);
  for (let h = 1; h <= jumlah; h++) {
    if (!await keHalamanDaftar(h)) {
      if (h > 1) { catat(`Info daftar: halaman ${h} tidak bisa dibuka atau kosong, dianggap akhir daftar.`); break; }
      throw new Error('ANTREAN: gagal membuka halaman 1 daftar.');
    }
    if (!bacaKartu().length) break;
    const k = bacaKartu().find(x => cocokTarget(x, cfg) && !selesai.includes(rmBersih(x.rm)));
    if (k) return { rm: k.rm, halaman: h };
  }
  return null;
}

async function bukaPasienDariDaftar(rm, halaman) {
  if (!await keHalamanDaftar(halaman)) throw new Error('ANTREAN: gagal kembali ke halaman daftar.');
  const k = bacaKartu().find(x => x.rm === rm);
  if (!k) throw new Error('ANTREAN: kartu pasien tidak ditemukan lagi di daftar.');
  k.a.click();
  const ok = await tunggu(() => /\/patient\/|activity-patient/.test(location.hash) && bacaRmDiHalaman() === rm, 12000);
  if (!ok) throw new Error('ANTREAN: halaman pasien tidak terbuka dengan RM yang diharapkan.');
}

async function kembaliKeDaftar() {
  if (!await klikTeks('Halaman Utama', { timeout: 6000 })) throw new Error('ANTREAN: menu "Halaman Utama" tidak ditemukan.');
  await tunggu(() => bacaKartu().length > 0 || bacaPager(), 12000);
  if (!bacaKartu().length && bacaPager()) await keHalamanDaftar(1); // daftar sempat tertinggal di halaman kosong
  const ok = await tunggu(() => bacaKartu().length > 0, 12000);
  if (!ok) throw new Error('ANTREAN: daftar tidak tampil setelah kembali ke Halaman Utama.');
}

// semuaPasien=false: satu pasien saja (tombol "Pasien berikutnya")
async function jalankanAntrean(config, semuaPasien) {
  const cfg = config || {};
  if (cfg.antreanUlang) tulisSelesai([]);
  if (!/#\/home|#\/$|^$/.test(location.hash) && !bacaKartu().length) await kembaliKeDaftar();
  const selesai = bacaSelesai();
  let diproses = 0;

  for (let i = 0; i < 40; i++) {
    cekStop();
    const t = await cariPasienBerikutnya(cfg, selesai);
    if (!t) { catat(`Antrean: tidak ada pasien lagi yang cocok (${selesai.length} sudah dikerjakan hari ini).`); break; }
    const kode = '…' + t.rm.slice(-4);
    catat(`=== Pasien ${kode} ===`);
    try {
      await bukaPasienDariDaftar(t.rm, t.halaman);
      const cfgPasien = { ...cfg, rmTarget: t.rm };
      await jalankanModulAsesmen(cfgPasien);
      if (cfg.antreanDenganObat) await jalankanModulObat(cfgPasien);
      selesai.push(rmBersih(t.rm)); tulisSelesai(selesai);
      diproses++;
    } catch (e) {
      if (e.message === 'ROBOT_STOPPED_BY_USER') throw e;
      catat(`GAGAL: pasien ${kode} berhenti (${e.message})`);
      selesai.push(rmBersih(t.rm)); tulisSelesai(selesai); // jangan diulang otomatis
      if (/^IDENTITAS|^ANTREAN/.test(e.message)) { catat('Antrean dihentikan demi keamanan.'); break; }
    }
    await kembaliKeDaftar();
    if (!semuaPasien) break;
  }
  catat(`Antrean: ${diproses} pasien diproses pada putaran ini.`);
  return diproses;
}

// Satu pasien berdasarkan RM (dari SIMPAN): cari di daftar Ecalyptus (semua halaman), buka, kerjakan, kembali.
async function jalankanPasienRm(config) {
  const rm = String(config.rmTarget || '').trim();
  if (!rm) throw new Error('PASIEN_RM: RM target kosong.');
  const kode = '…' + rm.slice(-4);
  if (!bacaKartu().length) await kembaliKeDaftar();
  await tunggu(() => bacaKartu().length > 0 || bacaPager(), 10000);
  if (!bacaKartu().length && bacaPager()) await keHalamanDaftar(1);
  const siap = await tunggu(() => bacaKartu().length > 0, 10000);
  if (!siap) throw new Error('ANTREAN: daftar pasien tidak tampil. Buka Halaman Utama, atur filter ruangan dan tab "telah dilayani".');
  const pager = bacaPager();
  const jumlah = pager ? Math.max(...pager.angka.map(h => parseInt(h.textContent, 10))) : 1;
  let ketemu = null;
  for (let h = 1; h <= Math.min(jumlah, 8) && !ketemu; h++) {
    if (!await keHalamanDaftar(h)) { if (h > 1) break; throw new Error('ANTREAN: gagal membuka halaman 1 daftar.'); }
    const k = bacaKartu().find(x => rmBersih(x.rm) === rmBersih(rm));
    if (k) ketemu = { k, h };
  }
  if (!ketemu) { await keHalamanDaftar(1).catch(() => {}); catat(`TIDAK_DITEMUKAN: pasien ${kode} tidak ada di daftar yang sedang tampil (tab/filter, atau belum dilayani).`); return 0; }
  if (ketemu.k.status === 'belum') { catat(`DILEWATI: pasien ${kode} berstatus "belum dilayani" (pasien baru), tidak diproses.`); return 0; }
  catat(`=== Pasien ${kode} ===`);
  await bukaPasienDariDaftar(ketemu.k.rm, ketemu.h);
  const cfgP = { ...config, rmTarget: ketemu.k.rm };
  const m = config.modul || { asesmen: true };   // modul yang dipilih di panel (bawaan: Asesmen+EWS)
  if (!m.asesmen && !m.obat) catat('Catatan: tidak ada modul yang dipilih (centang Asesmen+EWS dan/atau Sapu Obat).');
  if (m.asesmen) await jalankanModulAsesmen(cfgP);
  if (m.obat) await langkah('Sapu Obat', () => jalankanModulObat(cfgP));
  await kembaliKeDaftar();
  return 1;
}

// ---------------------------------------------------------------------------
// ENTRI: dipakai listener pesan
// ---------------------------------------------------------------------------
async function jalankanRobot(mode, config) {
  LAPORAN = [];
  config = config || {};
  catat(`Shift: ${tentukanShift(config)}`);
  if (mode === 'PASIEN_RM') { await jalankanPasienRm(config); return LAPORAN.slice(); }
  if (mode === 'ANTREAN' || mode === 'ANTREAN_SATU') { await jalankanAntrean(config, mode === 'ANTREAN'); return LAPORAN.slice(); }
  if (mode === 'ASESMEN' || mode === 'FULL') await jalankanModulAsesmen(config);
  if (mode === 'OBAT' || mode === 'FULL') await jalankanModulObat(config);
  if (mode === 'SOAPIE' || mode === 'FULL') await jalankanModulSoapie(config);
  return LAPORAN.slice();
}

// ============================================================================
// LISTENER PESAN DARI APP.JSX (SCRAPE & ROBOT AUTO-ECALYPTUS)
// ============================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 🛑 HENTIKAN ROBOT DARURAT
  if (request.action === "STOP_ECAL_ROBOT") {
    STOP_ROBOT_FLAG = true;
    sendResponse({ success: true, message: "Perintah berhenti dikirim." });
    return true;
  }


  // JALANKAN ROBOT AUTO-ECALYPTUS (v2)
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

      // ====================================================================
      // 1. IDENTITAS PASIEN (KARTU PROFIL KIRI)
      // ====================================================================
      const rmMatch = pageText.match(/(?:No\.?\s*RM|RM)\s*[:\n\r\t]*(\d{6,10})/i);
      const rmNumber = rmMatch ? rmMatch[1].trim() : "";

      let admissionDate = "";
      const regMatch = pageText.match(/(?:Tgl\.?\s*Reg(?:istrasi)?|Tanggal\s*Registrasi)\s*[:\n\r\t]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}(?:[,\s]+[0-9]{1,2}[:.][0-9]{1,2})?)/i);
      if (regMatch) {
        admissionDate = regMatch[1].trim();
      }

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

      // ====================================================================
      // 1b. PILIH ENTRI CPPT DARI DPJP (BUKAN DOKTER JAGA)
      // ====================================================================
      let cpptSource = "";
      let cpptSourceOld = false;
      let cpptEntries = [];
      {
        const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
        const starts = [];
        lines.forEach((l, i) => { if (/^Tanggal\s*Input/i.test(l)) starts.push(i); });

        if (starts.length > 0) {
          const entries = starts.map((s, k) => {
            const chunk = lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length);
            const pel = chunk.findIndex(l => /^Pelaksana/i.test(l));
            let author = "";
            if (pel !== -1) {
              author = chunk.slice(pel + 1, pel + 6)
                .find(l => /\bdr\b|dr\.|Sp\./i.test(l)) || "";
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
            const k = norm(e.author);
            if (k && !seenA.has(k)) {
              seenA.add(k);
              cpptEntries.push({ key: k, label: `${e.author} (${e.specialty || '?'})` });
            }
          });

          let pick = null;
          if (request.authorKey) {
            pick = entries.find(e => norm(e.author) === request.authorKey);
          }
          if (!pick && dpjpName) {
            pick = entries.find(e => e.author && norm(e.author) === norm(dpjpName));
          }
          if (!pick) pick = entries[0];

          if (pick) {
            let chunk = pick.chunk;
            const ins = chunk.findIndex(l => /^Instruksi$/i.test(l));
            if (ins !== -1) chunk = chunk.slice(0, ins);
            lines = chunk;
            cpptSource = `${pick.author || '?'} (${pick.specialty || '?'}) ${pick.dateLine}`.replace(/\s+/g, ' ').trim();
            const isDpjp = dpjpName && norm(pick.author) === norm(dpjpName);
            if (!isDpjp) cpptSourceOld = true;
          }
        }
      }

      // ====================================================================
      // 2. CEK APAKAH SEDANG DI TAB CPPT ATAU TAB LAIN
      // ====================================================================
      let idxSubjektif = -1;
      let idxObjektif = -1;
      let idxAssesmen = -1;
      let idxRencana = -1;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^Subjektif$/i.test(l) && idxSubjektif === -1) idxSubjektif = i;
        else if (/^Objektif$/i.test(l) && idxObjektif === -1) idxObjektif = i;
        else if (/^(?:Assesmen|Asesmen)$/i.test(l) && idxAssesmen === -1) idxAssesmen = i;
        else if (/^(?:Rencana|Resep)$/i.test(l) && idxAssesmen !== -1 && idxRencana === -1) {
          idxRencana = i;
        }
      }

      const isCpptPage = (idxSubjektif !== -1 && idxObjektif !== -1 && idxAssesmen !== -1);

      // ====================================================================
      // 3. DETEKTIF TAB: PATOLOGI KLINIK (HANYA AKTIF JIKA BUKAN TAB CPPT)
      // ====================================================================
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

        if (labItems.length > 0) {
          extractedLab = `Lab${labTime ? ` (${labTime})` : ''}:\n` + labItems.join('\n');
        }
      }

      // ====================================================================
      // 4. DETEKTIF TAB: RADIOLOGI (HANYA AKTIF JIKA BUKAN TAB CPPT)
      // ====================================================================
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
            if (/^(?:Terima\s*kasih|Kesimpulan|PACS|Dokter|Status|Verifikasi|Sp\.Rad)/i.test(l)) {
              break;
            }
            kesanLines.push(l);
          }
        }

        if (kesanLines.length > 0) {
          const cleanKesan = kesanLines
            .map(line => line.replace(/^[-•*]\s*/, ''))
            .filter(Boolean)
            .map(line => `- ${line}`)
            .join('\n');
          extractedRad = `Rad${dateMatch ? ` (${dateMatch[1]})` : ''}:\nKesan:\n${cleanKesan}`;
        }
      }

      // ====================================================================
      // 5. DETEKTIF TAB: CPPT (SUBJEKTIF, OBJEKTIF, ASSESMEN, RENCANA & RESEP)
      // ====================================================================
      let subjective = "", objective = "", analysis = "", planning = "";
      let prescriptionList = [];

      if (isCpptPage) {
        const sLines = lines.slice(idxSubjektif + 1, idxObjektif);
        subjective = sLines.filter(l => !/^(?:Hasil\s*USG|Kesan|Catatan)/i.test(l)).join('\n').trim();

        const oLines = lines.slice(idxObjektif + 1, idxAssesmen)
          .filter(l => !/^(?:Tanda\s*Vital|Angka|Catatan|-)$/i.test(l));
        objective = oLines.join('\n').trim();

        const endAIdx = idxRencana !== -1 ? idxRencana : Math.min(lines.length, idxAssesmen + 5);
        const aLines = lines.slice(idxAssesmen + 1, endAIdx)
          .filter(l => !/^(?:Catatan|Simpan\s*SOAP|Planning|Resep|Rencana)$/i.test(l));
        analysis = aLines.join('\n').trim();

        if (idxRencana !== -1) {
          const pRawLines = [];
          for (let i = idxRencana + 1; i < lines.length; i++) {
            const l = lines[i];
            if (/^(?:Instruksi|Tindakan|ICD9CM|Informasi|Pelaksana|Visite|Tanggal\s*Input|Tanggal\s*SOAP|Riwayat|Evaluasi|Konsul|Rujuk|Subjektif|Objektif|Assesmen|Asesmen|Filter|Simpan\s*SOAP)/i.test(l)) {
              break;
            }
            pRawLines.push(l);
          }

          const tableIndices = new Set();
          for (let i = 0; i < pRawLines.length; i++) {
            const l = pRawLines[i];
            const ddMatch = l.match(/(\d+)\s*dd\s*(\d+(?:[.,]\d+)?)/i);
            if (ddMatch && i > 0) {
              let medNameIdx = i - 1;
              while (medNameIdx >= 0 && (/^[-–—•*_\s]+$/.test(pRawLines[medNameIdx]) || /^(?:Catatan|Aturan|Nama)/i.test(pRawLines[medNameIdx]))) {
                medNameIdx--;
              }
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
          cpptSource, cpptSourceOld, cpptEntries
        }
      });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});