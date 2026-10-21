import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, Timestamp, deleteField } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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

    // 🛡️ PERBAIKAN KEAMANAN: Membaca daftar RS & Bangsal dari 1 dokumen direktori khusus
    // (TIDAK LAGI mengunduh seluruh koleksi 'users' yang berisi password)
    useEffect(() => {
        if (!db) return;
        const fetchHospitals = async () => {
            try {
                const dirRef = doc(db, 'settings', 'hospitalsDirectory');
                const snap = await getDoc(dirRef);
                const hw = { 'RSUD BAYU ASIH': new Set(['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK']) };

                if (snap.exists()) {
                    const data = snap.data().hospitals || {};
                    Object.keys(data).forEach(h => {
                        const upperH = h.toUpperCase();
                        if (!hw[upperH]) hw[upperH] = new Set();
                        if (Array.isArray(data[h])) {
                            data[h].forEach(w => hw[upperH].add(String(w).toUpperCase()));
                        }
                    });
                }

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
            const rawId = loginForm.id.toLowerCase().trim();
            const normalizedId = rawId.replace(/\s+/g, '_');
            const cleanPass = loginForm.pass.trim();
            const dummyEmail = `${normalizedId}@simpan.local`; 
            const auth = getAuth();

            // 💡 TRIK FIREBASE: Akali aturan minimal 6 karakter
            // Jika password perawat kurang dari 6 huruf, tambahkan ekor rahasia "_simpan"
            const firebaseSafePass = cleanPass.length >= 6 ? cleanPass : cleanPass + "_simpan";

            let isAuthSuccess = false;
            let finalUserId = normalizedId;

            try {
                // 1. Coba login langsung pakai brankas baru (Firebase Auth) dengan password aman
                await signInWithEmailAndPassword(auth, dummyEmail, firebaseSafePass);
                isAuthSuccess = true;
            } catch (authError) {
                // 2. Jika gagal (akun lama belum dimigrasi), cek database Firestore lama
                let userSnap = await getDoc(doc(db, 'users', normalizedId));
                
                // Fallback untuk akun lama yang terlanjur memakai spasi
                if (!userSnap.exists() && rawId !== normalizedId) {
                    userSnap = await getDoc(doc(db, 'users', rawId));
                    if (userSnap.exists()) finalUserId = rawId;
                }

                // 3. Verifikasi password lama (mencocokkan dengan password asli yang diketik)
                if (userSnap.exists() && userSnap.data().pass === cleanPass) {
                    try {
                        // 🚀 MIGRASI SENYAP: Daftarkan ke Firebase Auth!
                        await createUserWithEmailAndPassword(auth, dummyEmail, firebaseSafePass);
                        isAuthSuccess = true;

                        // 🗑️ Hapus password telanjang dari Firestore
                        await updateDoc(doc(db, 'users', finalUserId), {
                            pass: deleteField()
                        });
                    } catch (createError) {
                        // Tangkap error jika gagal bikin akun agar tidak lari ke pesan "Koneksi"
                        console.error("Gagal migrasi:", createError);
                        return alert("Gagal migrasi akun: " + createError.message);
                    }
                }
            }

            // Jika gagal di kedua sistem, tolak aksesnya
            if (!isAuthSuccess) {
                return alert('Username atau password salah!');
            }

            // 4. Tarik data profil pengguna dari Firestore
            const finalUserSnap = await getDoc(doc(db, 'users', finalUserId));
            if (!finalUserSnap.exists()) {
                return alert('Data profil tidak ditemukan!');
            }

            const userData = finalUserSnap.data();
            if (userData.status === 'pending') {
                await auth.signOut();
                return alert("Mohon maaf, akun Anda masih berstatus PENDING. Minta Karu / Admin ruangan Anda untuk mengaktifkannya.");
            }

            const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(userData.role);
            const userWithWard = {
                ...userData,
                id: finalUserId,
                ward: isDoctor ? 'ALL' : (userData.ward || 'MELATI'),
                hospital: userData.hospital || 'RSUD Bayu Asih'
            };
            onLoginSuccess(userWithWard);
        } catch (error) {
            console.error("Login Error System:", error);
            // Menampilkan pesan error asli agar mudah dilacak jika terjadi masalah lain
            alert("Sistem Error: " + error.message);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!db) return alert("Database belum siap. Cek koneksi!");

        const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(regForm.role);
        const finalRsName = (regForm.rsSelect === 'BUAT_BARU' ? regForm.newRsName.trim() : regForm.rsSelect).toUpperCase();
        const finalWardName = isDoctor ? 'ALL' : (regForm.wardSelect === 'BUAT_BARU' ? regForm.newWardName.trim() : regForm.wardSelect).toUpperCase();

        if (!finalRsName || (!isDoctor && !finalWardName)) return alert("Rumah Sakit dan Ruangan wajib diisi!");
        
        const rawId = regForm.id.toLowerCase().trim();
        const targetId = rawId.replace(/\s+/g, '_');
        const cleanPass = regForm.pass.trim();

        try {
            const userSnap = await getDoc(doc(db, 'users', targetId));
            if (userSnap.exists()) {
                return alert(`Username "${targetId}" sudah dipakai! Silakan pilih username lain.`);
            }

            const safeHospName = finalRsName.replace(/\s+/g, '_').toUpperCase();
            const safeAppId = appId || firebaseConfig?.appId;
            const configRef = doc(db, `artifacts/${safeAppId}/public/data/settings_${safeHospName}`, 'mainConfig');

            const isTryingCreateWard = !isDoctor && regForm.wardSelect === 'BUAT_BARU';
            let existingWards = {};
            let configSnap = null;

            if (isTryingCreateWard) {
                configSnap = await getDoc(configRef);
                existingWards = configSnap.exists() && configSnap.data().wards ? configSnap.data().wards : {};

                // 🛡️ CEGAH PENIMPAAN BANGSAL LAMA & KLAIM KARU SEMBARANGAN
                const wardAlreadyExists = Boolean(
                    existingWards[finalWardName] ||
                    (publicHospitals[finalRsName] && publicHospitals[finalRsName].includes(finalWardName))
                );
                if (wardAlreadyExists) {
                    return alert(`Ruangan "${finalWardName}" sudah terdaftar di ${finalRsName}! Silakan pilih ruangan tersebut dari daftar dropdown (bukan "+ Buat Ruangan Baru").`);
                }
            }

            // 🚀 PERUBAHAN AUTH: Daftarkan langsung ke Brankas Firebase Auth
            const auth = getAuth();
            const dummyEmail = `${targetId}@simpan.local`;
            // 💡 TRIK FIREBASE: Akali aturan minimal 6 karakter untuk pendaftar baru
            const firebaseSafePass = cleanPass.length >= 6 ? cleanPass : cleanPass + "_simpan";

            try {
                // Buat akun di Firebase Auth
                await createUserWithEmailAndPassword(auth, dummyEmail, firebaseSafePass);
                
                // PENTING: Firebase Auth otomatis meloginkan user baru. Kita harus sign-out 
                // secara paksa karena status akunnya masih 'pending' menunggu di-ACC.
                await auth.signOut(); 
            } catch (authError) {
                console.error("Gagal buat akun Auth:", authError);
                return alert("Gagal mendaftarkan keamanan akun: " + authError.message);
            }

            const isFounder = isTryingCreateWard;
            const finalRole = isFounder ? 'karu' : regForm.role;

            // 🛡️ PERUBAHAN FIRESTORE: Kolom 'pass' TIDAK LAGI disimpan ke dalam Firestore!
            const newUser = {
                id: targetId,
                name: regForm.fullname.trim(),
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
                existingWards[finalWardName] = newWardConfig;

                await setDoc(configRef, {
                    wards: existingWards,
                    ...(configSnap && configSnap.exists() ? {} : {
                        dpjpProfiles: finalRsName === 'RSUD BAYU ASIH' ? initialDpjpProfiles : [],
                        masterLabs: [], masterRads: [], masterProcedures: [], masterMedications: []
                    })
                }, { merge: true });
            }

            // Simpan nama RS & Bangsal ke direktori publik (tanpa data sensitif)
            if (!isDoctor && finalWardName && finalWardName !== 'ALL') {
                const updatedWards = Array.from(new Set([...(publicHospitals[finalRsName] || []), finalWardName])).sort();
                await setDoc(doc(db, 'settings', 'hospitalsDirectory'), {
                    hospitals: {
                        ...publicHospitals,
                        [finalRsName]: updatedWards
                    }
                }, { merge: true }).catch(() => {});
            }

            alert(`Pendaftaran Berhasil diajukan! 📝\n\nAkun Anda berstatus PENDING.\nSilakan hubungi Admin Pusat (Ns. Abi Nugroho, S.Kep.) / Karu untuk meminta persetujuan ACC sebelum Login.`);
            setAuthView('LOGIN');
            setRegForm({
                fullname: '', id: '', pass: '', role: 'Pelaksana',
                rsSelect: '', newRsName: '', wardSelect: '', newWardName: '',
                bedCount: 20, layout: '2baris', bedFormat: 'K1'
            });
        } catch (error) {
            console.error("Register Error:", error);
            alert("Terjadi kesalahan saat mendaftar. Cek koneksi internet.");
        }
    };

    const availableHospitals = Object.keys(publicHospitals);
    const availableWards = regForm.rsSelect && publicHospitals[regForm.rsSelect] ? publicHospitals[regForm.rsSelect] : [];
    const isDoctorRole = ['DPJP', 'Dokter_Jaga'].includes(regForm.role);

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
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nama Lengkap</label><input type="text" placeholder="Mis: dr. Risa / dr. Jaga" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium" value={regForm.fullname} onChange={e => setRegForm({ ...regForm, fullname: e.target.value })} required /></div>
                                <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Username Baru</label><input type="text" placeholder="Mis: dr.risa / dr.jaga" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium" value={regForm.id} onChange={e => setRegForm({ ...regForm, id: e.target.value })} required /></div>
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

                                {!isDoctorRole ? (
                                    <>
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
                                    </>
                                ) : (
                                    <div className="p-2.5 border border-indigo-200 bg-indigo-50/80 rounded-lg text-indigo-900 text-[10px] font-medium flex items-center gap-2 mt-1">
                                        <span className="text-lg">🩺</span>
                                        <div>
                                            <div className="font-bold text-indigo-950">
                                                Akses {regForm.role === 'DPJP' ? 'Dokter DPJP' : 'Dokter Jaga'} (Mobile)
                                            </div>
                                            <div className="text-[9px] text-indigo-700">
                                                Dapat memantau dan visite seluruh pasien rawat inap lintas bangsal.
                                            </div>
                                        </div>
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