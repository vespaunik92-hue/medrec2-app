import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { ChevronLeft } from 'lucide-react';

const USERNAME_RE = /^[a-z0-9._-]{2,40}$/;
const toAuthPass = (p) => (p.length >= 6 ? p : p + '_simpan');
const ROLE_MAP = { Karu: 'karu' };
const EMPTY_REG = { fullname: '', id: '', pass: '', role: 'Pelaksana', rsSelect: '', wardSelect: '' };

export const AuthScreen = ({ db, onLoginSuccess }) => {
    const [authView, setAuthView] = useState('LOGIN');
    const [busy, setBusy] = useState(false);
    const [loginForm, setLoginForm] = useState({ id: '', pass: '' });
    const [regForm, setRegForm] = useState(EMPTY_REG);
    const [publicHospitals, setPublicHospitals] = useState({
        'RSUD BAYU ASIH': ['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK']
    });

    // Daftar RS & Bangsal dibaca dari 1 dokumen direktori publik (bukan koleksi users)
    useEffect(() => {
        if (!db) return;
        const fetchHospitals = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'hospitalsDirectory'));
                const hw = { 'RSUD BAYU ASIH': new Set(['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK']) };
                if (snap.exists()) {
                    const data = snap.data().hospitals || {};
                    Object.keys(data).forEach(h => {
                        const upperH = h.toUpperCase();
                        if (!hw[upperH]) hw[upperH] = new Set();
                        if (Array.isArray(data[h])) data[h].forEach(w => hw[upperH].add(String(w).toUpperCase()));
                    });
                }
                const result = {};
                Object.keys(hw).forEach(k => { result[k] = Array.from(hw[k]).sort(); });
                setPublicHospitals(result);
            } catch (e) {
                console.log('Radar RS Public error:', e);
            }
        };
        fetchHospitals();
    }, [db]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!db || busy) return;
        const id = loginForm.id.toLowerCase().trim().replace(/\s+/g, '_');
        const pass = loginForm.pass.trim();
        if (!id || !pass) return;

        setBusy(true);
        const auth = getAuth();
        try {
            await signInWithEmailAndPassword(auth, `${id}@simpan.local`, toAuthPass(pass));
        } catch (err) {
            setBusy(false);
            if (err.code === 'auth/network-request-failed') return alert('Koneksi bermasalah. Periksa internet lalu coba lagi.');
            if (err.code === 'auth/too-many-requests') return alert('Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.');
            return alert('Username atau password salah!');
        }

        try {
            const snap = await getDoc(doc(db, 'users', id));
            if (!snap.exists()) {
                await auth.signOut();
                return alert('Data profil tidak ditemukan! Hubungi admin.');
            }
            const userData = snap.data();
            if (userData.status === 'pending') {
                await auth.signOut();
                return alert('Mohon maaf, akun Anda masih berstatus PENDING. Minta Karu / Admin ruangan Anda untuk mengaktifkannya.');
            }
            const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(userData.role);
            onLoginSuccess({
                ...userData,
                id,
                ward: isDoctor ? 'ALL' : (userData.ward || 'MELATI'),
                hospital: userData.hospital || 'RSUD Bayu Asih'
            });
        } catch (err) {
            console.error('Login profile error:', err);
            await auth.signOut().catch(() => {});
            alert('Gagal memuat profil: ' + err.message);
        } finally {
            setBusy(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!db || busy) return;

        const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(regForm.role);
        const hospital = String(regForm.rsSelect || '').toUpperCase();
        const ward = isDoctor ? 'ALL' : String(regForm.wardSelect || '').toUpperCase();
        if (!hospital || (!isDoctor && !ward)) return alert('Rumah Sakit dan Ruangan wajib dipilih!');

        const id = regForm.id.toLowerCase().trim().replace(/\s+/g, '_');
        const pass = regForm.pass.trim();
        const name = regForm.fullname.trim();
        if (!name) return alert('Nama lengkap wajib diisi.');
        if (!USERNAME_RE.test(id)) return alert('Username hanya boleh huruf kecil, angka, titik, strip, dan garis bawah (2-40 karakter).');
        if (pass.length < 8) return alert('Password minimal 8 karakter.');

        setBusy(true);
        const auth = getAuth();
        let created = null;
        try {
            const cred = await createUserWithEmailAndPassword(auth, `${id}@simpan.local`, toAuthPass(pass));
            created = cred.user;

            await setDoc(doc(db, 'users', id), {
                id,
                name,
                role: ROLE_MAP[regForm.role] || regForm.role,
                hospital,
                ward,
                status: 'pending',
                createdAt: Timestamp.now()
            });
            created = null; // berhasil, jangan di-rollback
            await auth.signOut();

            alert('Pendaftaran Berhasil diajukan! 📝\n\nAkun Anda berstatus PENDING.\nSilakan hubungi Admin Pusat (Ns. Abi Nugroho, S.Kep.) / Karu untuk meminta persetujuan ACC sebelum Login.');
            setAuthView('LOGIN');
            setRegForm(EMPTY_REG);
        } catch (err) {
            if (created) await created.delete().catch(() => {});
            await auth.signOut().catch(() => {});
            if (err.code === 'auth/email-already-in-use') alert(`Username "${id}" sudah dipakai! Silakan pilih username lain.`);
            else if (err.code === 'auth/network-request-failed') alert('Koneksi bermasalah. Periksa internet lalu coba lagi.');
            else { console.error('Register Error:', err); alert('Terjadi kesalahan saat mendaftar. Coba lagi.'); }
        } finally {
            setBusy(false);
        }
    };

    const availableHospitals = Object.keys(publicHospitals);
    const availableWards = regForm.rsSelect && publicHospitals[regForm.rsSelect] ? publicHospitals[regForm.rsSelect] : [];
    const isDoctorRole = ['DPJP', 'Dokter_Jaga'].includes(regForm.role);

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 relative max-h-[95vh] overflow-y-auto custom-scrollbar transition-all duration-300">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-600"></div>

                <div className="text-center mb-5 mt-0 flex flex-col items-center animate-in zoom-in-95 duration-500">
                    <img src="/logo1.png" alt="Logo SIMPAN" className="h-24 md:h-28 object-contain drop-shadow-md mb-1.5" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 border-t border-slate-100 pt-2 w-4/5 mx-auto">
                        Sistem Manajemen Operan Abi Nugroho
                    </p>
                </div>

                {authView === 'LOGIN' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <form onSubmit={handleLogin} className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Username</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">👤</span>
                                    <input type="text" placeholder="Ketik username..." className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium shadow-inner" value={loginForm.id} onChange={e => setLoginForm({ ...loginForm, id: e.target.value })} required autoFocus />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">🔒</span>
                                    <input type="password" placeholder="••••••" className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium shadow-inner" value={loginForm.pass} onChange={e => setLoginForm({ ...loginForm, pass: e.target.value })} required />
                                </div>
                            </div>
                            <button type="submit" disabled={busy} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
                                <span>🚀</span> {busy ? 'Memproses...' : 'Masuk'}
                            </button>
                        </form>
                        <div className="mt-4 border-t border-slate-100 pt-3 text-center flex flex-col items-center">
                            <p className="text-[11px] text-slate-500 mb-1.5">Belum punya akun?{' '}
                                <button type="button" onClick={() => setAuthView('REGISTER')} className="text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-5 py-1.5 rounded-lg transition-colors border border-indigo-100 w-fit">
                                    Daftar di sini
                                </button>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-1.5">
                            <button type="button" onClick={() => setAuthView('LOGIN')} className="text-slate-400 hover:text-indigo-600 transition" title="Kembali">
                                <ChevronLeft size={18} />
                            </button>
                            <h3 className="font-black text-indigo-900 text-sm uppercase">Pendaftaran Akun Baru</h3>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nama Lengkap</label><input type="text" placeholder="Mis: dr. Risa / dr. Jaga" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium" value={regForm.fullname} onChange={e => setRegForm({ ...regForm, fullname: e.target.value })} required /></div>
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Username Baru</label><input type="text" placeholder="Mis: dr.risa / dr.jaga" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium" value={regForm.id} onChange={e => setRegForm({ ...regForm, id: e.target.value })} required /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Password</label><input type="password" placeholder="Min. 8 karakter" minLength={8} className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={regForm.pass} onChange={e => setRegForm({ ...regForm, pass: e.target.value })} required /></div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Role / Jabatan</label>
                                    <select className="w-full p-1.5 border rounded bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-800" value={regForm.role} onChange={e => setRegForm({ ...regForm, role: e.target.value })}>
                                        <option value="Pelaksana">Perawat Pelaksana</option>
                                        <option value="Karu">Kepala Ruangan (Karu)</option>
                                        <option value="PPJA">Perawat - PPJA</option>
                                        <option value="Dokter_Jaga">Dokter Jaga</option>
                                        <option value="DPJP">Dokter DPJP</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-2.5 border border-slate-200 bg-slate-50/50 rounded-lg space-y-2 mt-2">
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Rumah Sakit</label>
                                    <select className="w-full p-1.5 border rounded bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.rsSelect} onChange={e => setRegForm({ ...regForm, rsSelect: e.target.value, wardSelect: '' })} required>
                                        <option value="">- Pilih Rumah Sakit -</option>
                                        {availableHospitals.map(rs => <option key={rs} value={rs}>{rs}</option>)}
                                    </select>
                                </div>

                                {!isDoctorRole ? (
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ruangan</label>
                                        <select className="w-full p-1.5 border rounded bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.wardSelect} onChange={e => setRegForm({ ...regForm, wardSelect: e.target.value })} disabled={!regForm.rsSelect} required>
                                            <option value="">- Pilih Ruangan -</option>
                                            {availableWards.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="p-2.5 border border-indigo-200 bg-indigo-50/80 rounded-lg text-indigo-900 text-[10px] font-medium flex items-center gap-2 mt-1">
                                        <span className="text-lg">🩺</span>
                                        <div>
                                            <div className="font-bold text-indigo-950">Akses {regForm.role === 'DPJP' ? 'Dokter DPJP' : 'Dokter Jaga'} (Mobile)</div>
                                            <div className="text-[9px] text-indigo-700">Dapat memantau dan visite seluruh pasien rawat inap lintas bangsal.</div>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[9px] text-slate-400">Rumah sakit atau ruangan belum terdaftar? Hubungi admin pusat untuk didaftarkan.</p>
                            </div>
                            <button type="submit" disabled={busy} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold text-sm mt-3 hover:bg-emerald-700 transition disabled:opacity-60">
                                {busy ? 'Memproses...' : 'Daftar Sekarang 🚀'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="text-center mt-4 pt-3 border-t border-slate-100 flex flex-col items-center">
                    <a href="https://trakteer.id/481nugroho" target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold transition-colors inline-flex items-center gap-1 hover:underline pb-0.5">
                        ✨ Traktir Kopi?
                    </a>
                    <p className="text-[9px] text-slate-400">© 2026 SIMPAN - E-Ontang-Anting</p>
                </div>
            </div>
        </div>
    );
};