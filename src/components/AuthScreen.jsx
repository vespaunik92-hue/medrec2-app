import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
import { ChevronLeft } from 'lucide-react';

export const AuthScreen = ({ db, appId, onLoginSuccess, initialDpjpProfiles, firebaseConfig }) => {
    const [authView, setAuthView] = useState('LOGIN'); 
    const [loginForm, setLoginForm] = useState({ id: '', pass: '' });
    const [regForm, setRegForm] = useState({
        fullname: '', id: '', pass: '', role: 'Pelaksana',
        rsSelect: '', newRsName: '',
        wardSelect: '', newWardName: '',
        bedCount: 20, layout: '2baris', bedFormat: 'K1'
    });

    const [publicHospitals, setPublicHospitals] = useState({
        'RSUD BAYU ASIH': ['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK']
    });

    // Radar pemindai Rumah Sakit dari Database
    useEffect(() => {
        if (!db) return;
        const fetchHospitals = async () => {
            try {
                const snap = await getDocs(collection(db, 'users'));
                const hw = { 'RSUD BAYU ASIH': new Set(['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK']) };
                snap.docs.forEach(d => {
                    const data = d.data();
                    if (data.hospital && data.ward) {
                        const h = data.hospital.toUpperCase();
                        const w = data.ward.toUpperCase();
                        if (!hw[h]) hw[h] = new Set();
                        hw[h].add(w);
                    }
                });
                const result = {};
                Object.keys(hw).forEach(k => { result[k] = Array.from(hw[k]).sort(); });
                setPublicHospitals(result);
            } catch (e) {
                console.log("Radar RS Public error:", e);
            }
        };
        fetchHospitals();
    }, [db]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!db) return alert("Database belum siap. Coba refresh halaman.");

        try {
            const targetId = loginForm.id.toLowerCase().trim();
            const userSnap = await getDoc(doc(db, 'users', targetId));

            if (userSnap.exists()) {
                const userData = userSnap.data();
                if (userData.pass === loginForm.pass) {
                    if (userData.status === 'pending') {
                        return alert("Mohon maaf, akun Anda masih berstatus PENDING. Minta Karu / Admin ruangan Anda untuk mengaktifkannya.");
                    }

                    const userWithWard = {
                        ...userData,
                        ward: userData.ward || 'MELATI',
                        hospital: userData.hospital || 'RSUD Bayu Asih'
                    };
                    onLoginSuccess(userWithWard);
                } else {
                    alert('Password salah!');
                }
            } else {
                alert('Username tidak ditemukan di Database!');
            }
        } catch (error) {
            alert("Terjadi kesalahan koneksi. Cek internet.");
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!db) return alert("Database belum siap. Cek koneksi!");

        const finalRsName = (regForm.rsSelect === 'BUAT_BARU' ? regForm.newRsName.trim() : regForm.rsSelect).toUpperCase();
        const finalWardName = (regForm.wardSelect === 'BUAT_BARU' ? regForm.newWardName.trim() : regForm.wardSelect).toUpperCase();

        if (!finalRsName || !finalWardName) return alert("Rumah Sakit and Ruangan wajib diisi!");
        const targetId = regForm.id.toLowerCase().trim().replace(/\s+/g, '_');

        try {
            const userSnap = await getDoc(doc(db, 'users', targetId));
            if (userSnap.exists()) {
                return alert(`Username "${targetId}" sudah dipakai! Silakan pilih username lain.`);
            }

            const isFounder = regForm.wardSelect === 'BUAT_BARU';
            const finalRole = isFounder ? 'karu' : regForm.role;

            const newUser = {
                id: targetId,
                name: regForm.fullname.trim(),
                pass: regForm.pass,
                role: finalRole,
                hospital: finalRsName,
                ward: finalWardName,
                status: 'pending',
                createdAt: Timestamp.now()
            };

            await setDoc(doc(db, 'users', targetId), newUser);

            if (isFounder) {
                const count = regForm.bedCount || 20;
                const format = regForm.bedFormat || 'K1';
                const layout = regForm.layout || '2baris';
                const rooms = [];
                for (let i = 1; i <= count; i++) {
                    if (format === 'K1') rooms.push(`K${i}`);
                    else if (format === '1A') rooms.push(`${Math.ceil(i / 2)}${i % 2 === 1 ? 'A' : 'B'}`);
                    else rooms.push(`${i}`);
                }

                let left = [], right = [];
                if (layout === '1baris') {
                    left = rooms;
                } else {
                    const mid = Math.ceil(rooms.length / 2);
                    left = rooms.slice(0, mid);
                    right = rooms.slice(mid);
                }
                const newWardConfig = { roomList: rooms, leftRooms: left, rightRooms: right, name: finalWardName };
                const safeHospName = finalRsName.replace(/\s+/g, '_').toUpperCase();
                const safeAppId = appId || firebaseConfig?.appId;
                const configRef = doc(db, `artifacts/${safeAppId}/public/data/settings_${safeHospName}`, 'mainConfig');

                const snap = await getDoc(configRef);
                let existingWards = snap.exists() && snap.data().wards ? snap.data().wards : {};
                existingWards[finalWardName] = newWardConfig;

                await setDoc(configRef, {
                    wards: existingWards,
                    ...(snap.exists() ? {} : {
                        dpjpProfiles: finalRsName === 'RSUD BAYU ASIH' ? initialDpjpProfiles : [],
                        masterLabs: [], masterRads: [], masterProcedures: [], masterMedications: []
                    })
                }, { merge: true });
            }

            alert(`Pendaftaran Berhasil diajukan! 📝\n\nAkun Anda berstatus PENDING.\nSilakan hubungi Admin Pusat (Abi) / Karu ruangan untuk meminta persetujuan ACC sebelum Login.`);
            setAuthView('LOGIN');
            setRegForm({
                fullname: '', id: '', pass: '', role: 'Pelaksana',
                rsSelect: '', newRsName: '', wardSelect: '', newWardName: '',
                bedCount: 20, layout: '2baris', bedFormat: 'K1'
            });
        } catch (error) {
            alert("Terjadi kesalahan saat mendaftar. Cek koneksi internet.");
        }
    };

    const availableHospitals = Object.keys(publicHospitals);
    const availableWards = regForm.rsSelect && publicHospitals[regForm.rsSelect] ? publicHospitals[regForm.rsSelect] : [];

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 relative max-h-[95vh] overflow-y-auto custom-scrollbar transition-all duration-300">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-600"></div>
                
                {/* HEADER LOGO */}
                <div className="text-center mb-5 mt-0 flex flex-col items-center animate-in zoom-in-95 duration-500">
                    <img src="/logo1.png" alt="Logo SIMPAN" className="h-24 md:h-28 object-contain drop-shadow-md mb-1.5" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 border-t border-slate-100 pt-2 w-4/5 mx-auto">
                        Sistem Manajemen Operan Abi Nugroho
                    </p>
                </div>

                {/* TAMPILAN LOGIN */}
                {authView === 'LOGIN' ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <form onSubmit={handleLogin} className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Username</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">👤</span>
                                    <input 
                                        type="text" 
                                        placeholder="Ketik username..." 
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium shadow-inner" 
                                        value={loginForm.id} 
                                        onChange={e => setLoginForm({ ...loginForm, id: e.target.value })} 
                                        required 
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400">🔒</span>
                                    <input 
                                        type="password" 
                                        placeholder="••••••" 
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium shadow-inner" 
                                        value={loginForm.pass} 
                                        onChange={e => setLoginForm({ ...loginForm, pass: e.target.value })} 
                                        required 
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex items-center justify-center gap-2 mt-2">
                                <span>🚀</span> Masuk
                            </button>
                        </form>
                        <div className="mt-4 border-t border-slate-100 pt-3 text-center flex flex-col items-center">
                            <p className="text-[11px] text-slate-500 mb-1.5">Belum punya akun?{' '}
                                <button 
                                    type="button" 
                                    onClick={() => setAuthView('REGISTER')} 
                                    className="text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-5 py-1.5 rounded-lg transition-colors border border-indigo-100 w-fit"
                                >
                                    Daftar di sini
                                </button>
                            </p>
                        </div>
                    </div>
                ) : (
                    /* TAMPILAN REGISTER */
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-1.5">
                            <button type="button" onClick={() => setAuthView('LOGIN')} className="text-slate-400 hover:text-indigo-600 transition" title="Kembali">
                                <ChevronLeft size={18}/>
                            </button>
                            <h3 className="font-black text-indigo-900 text-sm uppercase">Pendaftaran Akun Baru</h3>
                        </div>
                        <form onSubmit={handleRegister} className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nama Lengkap</label><input type="text" placeholder="Mis: Ns. Abi" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium" value={regForm.fullname} onChange={e => setRegForm({ ...regForm, fullname: e.target.value })} required /></div>
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Username Baru</label><input type="text" placeholder="Mis: abi.ns" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium" value={regForm.id} onChange={e => setRegForm({ ...regForm, id: e.target.value })} required /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Password</label><input type="password" placeholder="••••••" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono" value={regForm.pass} onChange={e => setRegForm({ ...regForm, pass: e.target.value })} required /></div>
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
                                        <option value="BUAT_BARU" className="font-bold text-indigo-600">+ Buat RS Baru...</option>
                                    </select>
                                    {regForm.rsSelect === 'BUAT_BARU' && (
                                        <div className="mt-1.5"><input type="text" placeholder="Ketik Nama Rumah Sakit Baru..." className="w-full p-1.5 border border-indigo-300 rounded bg-indigo-50/30 text-xs outline-none uppercase font-bold" value={regForm.newRsName} onChange={e => setRegForm({ ...regForm, newRsName: e.target.value })} required /></div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ruangan</label>
                                    <select className="w-full p-1.5 border rounded bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.wardSelect} onChange={e => setRegForm({ ...regForm, wardSelect: e.target.value })} disabled={!regForm.rsSelect} required>
                                        <option value="">- Pilih Ruangan -</option>
                                        {availableWards.map(w => <option key={w} value={w}>{w}</option>)}
                                        <option value="BUAT_BARU" className="font-bold text-indigo-600">+ Buat Ruangan Baru...</option>
                                    </select>
                                </div>
                                {regForm.wardSelect === 'BUAT_BARU' && (
                                    <div className="p-2 border border-indigo-200 bg-indigo-50 rounded-lg space-y-1.5 mt-1.5">
                                        <h4 className="text-[10px] font-black text-indigo-900 border-b border-indigo-100 pb-1">⚙️ Setup Denah Ruangan Baru</h4>
                                        <input type="text" placeholder="Nama Ruangan Baru..." className="w-full p-1.5 border rounded text-xs uppercase font-bold" value={regForm.newWardName} onChange={e => setRegForm({ ...regForm, newWardName: e.target.value })} required />
                                        <div className="grid grid-cols-3 gap-2">
                                            <div><label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Total Bed</label><input type="number" min="1" max="100" className="w-full p-1.5 border rounded text-xs text-center font-bold" value={regForm.bedCount} onChange={e => setRegForm({ ...regForm, bedCount: parseInt(e.target.value) })} /></div>
                                            <div className="col-span-2">
                                                <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Format Bed</label>
                                                <select className="w-full p-1.5 border rounded text-xs bg-white font-medium" value={regForm.bedFormat} onChange={e => setRegForm({ ...regForm, bedFormat: e.target.value })}>
                                                    <option value="K1">Awalan "K" (K1, K2)</option>
                                                    <option value="1">Angka Saja (1, 2, 3)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <select className="w-full p-1.5 border rounded text-xs bg-white font-medium" value={regForm.layout} onChange={e => setRegForm({ ...regForm, layout: e.target.value })}>
                                            <option value="2baris">2 Baris (Sisi Kiri & Kanan)</option>
                                            <option value="1baris">1 Baris Berjejer</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold text-sm mt-3 hover:bg-emerald-700 transition">Daftar Sekarang 🚀</button>
                        </form>
                    </div>
                )}

                {/* BOTTOM APPRESIASI & FOOTER */}
                <div className="text-center mt-4 pt-3 border-t border-slate-100 flex flex-col items-center">
                    <a
                        href="https://trakteer.id/481nugroho"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold transition-colors inline-flex items-center gap-1 hover:underline pb-0.5"
                    >
                        ✨ Traktir Kopi?
                    </a>
                    <p className="text-[9px] text-slate-400">© 2026 SIMPAN - E-Ontang-Anting</p>
                </div>
            </div>
        </div>
    );
};