import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Kotak "Tanda tangan saya": digambar sekali, disimpan di Firestore koleksi `signatures/{uid Firebase Auth}`.
// Aturan Rules: hanya pemilik akun yang boleh membaca/menulis. Dipakai Asisten Ecalyptus (Companion).
export default function TandaTanganSaya({ db }) {
  const kanvas = useRef(null);
  const menggambar = useRef(false);
  const [tersimpan, setTersimpan] = useState(null);   // data URL PNG yang sudah tersimpan
  const [adaGambar, setAdaGambar] = useState(false);
  const [mode, setMode] = useState('memuat');         // memuat | lihat | gambar
  const [pesan, setPesan] = useState('');

  const uid = () => getAuth().currentUser?.uid || null;

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const u = uid();
        if (!u) { setMode('gambar'); return; }
        const snap = await getDoc(doc(db, 'signatures', u));
        if (batal) return;
        if (snap.exists() && snap.data().png) { setTersimpan(snap.data().png); setMode('lihat'); }
        else setMode('gambar');
      } catch (e) { if (!batal) { setPesan('Gagal memuat: ' + e.message); setMode('gambar'); } }
    })();
    return () => { batal = true; };
  }, [db]);

  const titik = (e) => {
    const c = kanvas.current; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const mulai = (e) => {
    e.preventDefault(); menggambar.current = true;
    const ctx = kanvas.current.getContext('2d'); const p = titik(e);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    try { kanvas.current.setPointerCapture(e.pointerId); } catch (x) { /* abaikan */ }
  };
  const gerak = (e) => {
    if (!menggambar.current) return; e.preventDefault();
    const ctx = kanvas.current.getContext('2d'); const p = titik(e);
    ctx.lineTo(p.x, p.y); ctx.stroke(); setAdaGambar(true);
  };
  const selesai = () => { menggambar.current = false; };
  const bersihkan = () => {
    const c = kanvas.current; if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setAdaGambar(false);
  };

  const simpan = async () => {
    const u = uid();
    if (!u) return setPesan('Sesi login habis, login ulang dulu.');
    if (!adaGambar) return setPesan('Gambar tanda tangan dulu.');
    const png = kanvas.current.toDataURL('image/png');
    if (png.length > 300000) return setPesan('Gambar terlalu besar, coba lebih sederhana.');
    try {
      await setDoc(doc(db, 'signatures', u), { png, updatedAt: Date.now() });
      setTersimpan(png); setMode('lihat'); setPesan('Tersimpan ✓');
    } catch (e) { setPesan('Gagal menyimpan: ' + e.message); }
  };
  const hapus = async () => {
    const u = uid(); if (!u) return;
    if (!window.confirm('Hapus tanda tangan tersimpan?')) return;
    try { await deleteDoc(doc(db, 'signatures', u)); setTersimpan(null); setMode('gambar'); setPesan('Dihapus.'); }
    catch (e) { setPesan('Gagal menghapus: ' + e.message); }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200">
      <label className="block font-bold text-slate-500 uppercase text-xs">Tanda Tangan Saya (untuk Asisten Ecalyptus)</label>
      {mode === 'memuat' && <div className="text-[11px] text-slate-400">Memuat…</div>}
      {mode === 'lihat' && (
        <div className="space-y-2">
          <div className="bg-white border border-slate-300 rounded p-2"><img src={tersimpan} alt="Tanda tangan" className="h-16 mx-auto" /></div>
          <div className="flex gap-2">
            <button onClick={() => { setMode('gambar'); setAdaGambar(false); setPesan(''); }} className="flex-1 bg-slate-200 hover:bg-slate-300 py-1.5 rounded font-bold text-xs">Ganti</button>
            <button onClick={hapus} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-1.5 rounded font-bold text-xs">Hapus</button>
          </div>
        </div>
      )}
      {mode === 'gambar' && (
        <div className="space-y-2">
          <canvas ref={kanvas} width={480} height={180}
            onPointerDown={mulai} onPointerMove={gerak} onPointerUp={selesai} onPointerLeave={selesai} onPointerCancel={selesai}
            style={{ touchAction: 'none', width: '100%', height: 'auto', background: '#fff', border: '1px dashed #94a3b8', borderRadius: 6, cursor: 'crosshair' }} />
          <div className="flex gap-2">
            <button onClick={bersihkan} className="flex-1 bg-slate-200 hover:bg-slate-300 py-1.5 rounded font-bold text-xs">Ulangi</button>
            <button onClick={simpan} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded font-bold text-xs">Simpan Tanda Tangan</button>
            {tersimpan && <button onClick={() => setMode('lihat')} className="bg-slate-100 px-2 rounded text-xs">Batal</button>}
          </div>
        </div>
      )}
      {pesan && <div className="text-[11px] text-slate-500">{pesan}</div>}
    </div>
  );
}
