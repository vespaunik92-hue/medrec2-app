import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    query, 
    onSnapshot, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc,
    setDoc,
    getDoc, 
    Timestamp, 
    orderBy, 
    getDocs,
    where,
} from 'firebase/firestore';

// --- Global Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCL9PYpOe3pJOaoEfZLw9mymIrC6LtMJWE",
  authDomain: "e-ontang-anting.firebaseapp.com",
  projectId: "e-ontang-anting",
  storageBucket: "e-ontang-anting.firebasestorage.app",
  messagingSenderId: "1097108054720",
  appId: "1:1097108054720:web:a53efbaf9882d5086d0325"
};
const appID = firebaseConfig.appId;

// --- DATA STATIS ---

const ROOM_LIST = [
  'K1B1', 'K1B2', 'K2B1', 'K2B2', 'K3B1', 'K3B2', 'K4B1', 'K4B2', 'K5B1',
  'K6B1', 'K6B2', 'K7B1', 'K8B1', 'K9B1', 'K10B1', 'K10B2', 'K11B1', 'K11B2',
  'K12B1', 'K13B1', 'K13B2', 'K14B1', 'K15B1', 'K15B2'
];

const DEFAULT_JAGA_LINK = '6285133343824'; 

const DEFAULT_DPJP_DATA = [
    { name: 'dr. Delvi, Sp.PD', waNumber: '6281283812875' },
    { name: 'dr. Susilo, Sp.PD', waNumber: '6282119395835' },
    { name: 'dr. Dian Ekowati, Sp.PD', waNumber: '6281210680279' },
    { name: 'dr. Priyo, Sp.PD', waNumber: '62811220364' },
    { name: 'dr. Risa, Sp.PD', waNumber: '6281316198500' },
    { name: 'dr. Evan, Sp.P', waNumber: '6281210100626' },
];

const initialDpjpProfiles = DEFAULT_DPJP_DATA;

const LAB_CHECKS = [
    'Darah Rutin', 'Darah Lengkap', 'Masa Pendarahan (BT/CT)', 'PT/APTT/INR',
    'GDS', 'GDP/2JPP', 'HbA1c', 'TSH/FT4', 'Procalcitonin', 'Ferritin', 'D-Dimer',
    'Ureum/Creatinin', 'SGOT/SGPT', 'Albumin/Globulin', 'Bilirubin Total/Direk',
    'Elektrolit (Na/K/Cl)', 'Calsium', 'Analisa Gas Darah (AGD)', 'Lactate',
    'Profil Lipid (Kolesterol)', 'Asam Urat',
    'Urin', 'Feses', 'Kultur Darah', 'TCM TB', 'HBsAg/Anti-HBs/Anti-HCV/Anti-HIV',
    'Troponin T/I', 'CK-MB', 'Tubex', 'Titer Widal', 'CRP Kuantitatif', 'ProBNP'
];

const RADIOLOGY_CHECKS = [
    'Thorax PA/AP', 'Thorax Lateral', 'BNO 3 Posisi', 'Lumbosacral', 'Cervical', 'Foto Ekstremitas',
    'USG Whole Abdomen', 'USG Upper Abdomen', 'USG Lower Abdomen', 'USG Thorax', 'USG Tiroid', 'USG Ginjal', 'USG Kandung Empedu',
    'CT Scan Kepala Kontras', 'CT Scan Kepala non-Kontras', 'CT Scan Thorax', 'CT Scan Abdomen kontras', 'CT Scan Abdomen non-kontras', 'CT Scan Vertebra', 'CT Angiography',
    'MRI Kepala', 'MRI Vertebra', 'MRI Lutut', 'MRI Pelvis',
    'Echocardiography', 'Endoskopi', 'Kolonoskopi', 'Bronkoskopi', 'Angiography Koroner'
];

const PROCEDURES = [
    'Pasang Infus', 'Pasang Kateter', 'Pasang NGT', 'Nebulizer', 'Oksigenasi', 'Pemasangan Ventilator',
    'EKG', 'Ganti Balutan', 'Suction', 'Injeksi Extra', 'Syringe Pump', 'Trnfs PRC', 'Trnfs TC', 'Hemodialisa (HD)', 
    'Rawat Luka', 'Angkat Jahitan', 'Spooling Kateter', 'Bladder Training', 'Biopsi Sumsum Tulang',
    'Parasintesis', 'Torakosintesis', 'Pungsi Efusi Pleura', 'Pungsi Ascites', 'Pungsi Lumbal', 'Aspirasi Sendi'
];
const MEDICATIONS = [
    'Koreksi KCL', 'Koreksi Meylon', 'Koreksi CaGluconas', 'Drip Insulin', 'Drip Lasix', 'Drip Nicardipine', 'Drip Norepinephrine',
    'Drip Amiodarone', 'Drip Fentanyl', 'Injeksi Extra Lasix', 
    '3 Way', '2 Line Infus', 'Trnfs Albumin', 'Drip Heparin', 'Drip Dopamine', 'Drip Dobutamine', 'Drip Epinephrine'
];
// --- GABUNGAN UNTUK SMART SEARCH PLANNING ---
// Format: { label: 'Nama Item', type: 'Lab/Rad/Med/Rx' }
const ALL_PLANNING_OPTIONS = [
    ...LAB_CHECKS.map(i => ({ label: i, type: 'Lab' })),
    ...RADIOLOGY_CHECKS.map(i => ({ label: i, type: 'Rad' })),
    ...PROCEDURES.map(i => ({ label: i, type: 'Med' })), // Tindakan Medis
    ...MEDICATIONS.map(i => ({ label: i, type: 'Rx' })) // Obat/Therapy Khusus
].sort((a, b) => a.label.localeCompare(b.label));

// --- COMPONENTS: LOGIN PAGE (REBRANDED) ---
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
        alert("Mohon isi Email/Nama Pengguna dan Password.");
        return;
    }

    const auth = getAuth();
    // Inisiasi Firestore dari aplikasi auth, karena db belum di-pass ke LoginPage
    const db = getFirestore(auth.app); 
    let loginEmail = username; 

    try {
        // --- 1. Cek apakah input adalah Nama Pengguna (tanpa @) ---
        if (!username.includes('@')) {
            
            // --- Pencarian Nama Pengguna di Firestore ---
            // Cari dokumen di koleksi userProfiles di mana field 'username' == input pengguna
            const userRef = collection(db, 'userProfiles'); 
            const q = query(userRef, where('username', '==', username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // Jika username tidak ditemukan di Firestore
                alert(`Login Gagal: Nama Pengguna "${username}" tidak terdaftar.`);
                return;
            }

            // Jika ditemukan, ambil email yang terkait
            const userData = querySnapshot.docs[0].data();
            loginEmail = userData.email; 
        }
        
        // --- 2. Lakukan Otentikasi Firebase menggunakan EMAIL yang telah diproses ---
        await signInWithEmailAndPassword(auth, loginEmail, password); 
        
    } catch (error) {
        console.error("Login Error:", error);
        let pesan = "Login Gagal. Cek koneksi atau coba lagi.";
        
        // Pesan error spesifik dari Firebase
        if (error.code === 'auth/wrong-password') pesan = "Password salah.";
        if (error.code === 'auth/user-not-found') pesan = "Email tidak terdaftar.";
        if (error.code === 'auth/invalid-credential') pesan = "Email atau Password salah.";
        
        alert(pesan);
    }
  };

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden max-h-[600px]">
        
        {/* Left Side: Visual/Branding */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-800 p-10 text-white flex flex-col justify-center relative">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/medical-icons.png')]"></div>
            <div className="relative z-10">
                
                {/* LOGO WRAPPER: w-fit agar lebar mengikuti teks terpanjang, items-center agar E- di tengah */}
                <div className="flex flex-col items-center w-fit mb-6">
                    <h1 className="text-4xl font-extrabold tracking-tight leading-none">E-</h1>
                    <h1 className="text-4xl font-extrabold tracking-tight leading-none">Ontang-Anting</h1>
                </div>

                <p className="text-blue-100 text-sm mb-8">Aplikasi Bantu Operan Jaga & Manajemen Pasien</p>
                <div className="space-y-3 text-xs font-medium text-blue-200">
                    <div className="flex items-center"><span className="mr-2">✓</span> SOAP Record</div>
                    <div className="flex items-center"><span className="mr-2">✓</span> Real-time Collaboration</div>
                    <div className="flex items-center"><span className="mr-2">✓</span> Print Formatting</div>
                </div>
            </div>
            <div className="mt-10 text-[10px] text-blue-300">
                &copy; 2025 Creative Workflow Tools
            </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-10 bg-white flex flex-col justify-center">
            <div className="mb-6 text-center md:text-left">
                <h2 className="text-2xl font-bold text-gray-800">Selamat Datang</h2>
                <p className="text-gray-500 text-sm">Silakan login untuk memulai sesi jaga.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Username</label>
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-gray-50"
                        placeholder="Nama Pengguna"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Password</label>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-gray-50"
                            placeholder="Kata Sandi"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                        >
                            {showPassword ? 'Sembunyikan' : 'Lihat'}
                        </button>
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition shadow-lg mt-4 flex justify-center items-center group"
                >
                    Masuk Aplikasi <span className="ml-2 group-hover:translate-x-1 transition">→</span>
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

// --- UTILS: PRINT HANDLER ---
const handlePrintWindow = (elementId, title) => {
    const content = document.getElementById(elementId);
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) {
        alert("Pop-up diblokir. Mohon izinkan pop-up.");
        return;
    }

    const html = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                body { 
                    background-color: white; 
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact;
                    font-size: 11pt;
                }
                @media print {
                    @page { 
                        size: A5 portrait; 
                        margin: 0.5cm;
                    }
                    body { margin: 0; }
                    .no-print { display: none !important; }
                    .print-break { page-break-after: always; }
                    #print-container { width: 100%; max-width: 148mm; }
                }
            </style>
        </head>
        <body>
            <div id="print-container">
                ${content.innerHTML}
            </div>
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                    }, 800);
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};


// --- COMPONENTS UI (DEFINED GLOBALLY) ---

const CustomInput = ({ label, name, type = 'text', required = false, value, onChange, disabled, className = '', placeholder }) => (
  <div className={`mb-2 ${className}`}>
    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full p-2 text-sm border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-100"
    />
  </div>
);

const CustomTextArea = ({ label, name, value, onChange, children, extraButtons, onPullData, pullLabel }) => (
  <div className="mb-3 border p-2 rounded bg-white relative group hover:border-indigo-300 transition">
    <div className="flex justify-between items-center mb-1">
        <div className="flex items-center">
            <label className="block text-[10px] font-bold text-gray-700 uppercase bg-gray-100 px-2 py-0.5 rounded mr-2">
                {label}
            </label>
            {onPullData && (
                <button 
                    type="button" 
                    onClick={onPullData}
                    className="text-[9px] flex items-center text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition"
                    title="Salin data dari catatan terakhir pasien ini"
                >
                    <span className="mr-1">↺</span> {pullLabel || 'Tarik Data'}
                </button>
            )}
        </div>
        <div className="flex space-x-1">
            {extraButtons}
        </div>
    </div>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      rows="3"
      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition resize-y font-mono leading-tight"
    />
    {children}
  </div>
);

const CustomSelect = ({ label, value, onChange, options, placeholder, disabled, required, className = '' }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (!value) setSearchTerm('');
    }, [value]);

    const handleSelect = (opt) => {
        onChange({ target: { value: opt } }); 
        setSearchTerm('');
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        if (!isOpen) setIsOpen(true);
    };

    const displayValue = isOpen ? searchTerm : (value || '');

    return (
        <div className={`mb-2 relative ${className}`} ref={wrapperRef}>
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input 
                    type="text"
                    className={`w-full p-2 text-sm border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none ${disabled ? 'bg-gray-100' : 'bg-white'}`}
                    placeholder={placeholder}
                    value={displayValue}
                    onChange={handleInputChange}
                    onClick={() => !disabled && setIsOpen(true)}
                    disabled={disabled}
                    required={required}
                />
                <span className="absolute right-2 top-2 text-gray-400 text-xs pointer-events-none">▼</span>
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full bg-white border border-gray-300 mt-1 max-h-48 overflow-y-auto shadow-lg rounded text-sm">
                    {filteredOptions.map(opt => (
                        <div 
                            key={opt} 
                            className="p-2 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0"
                            onClick={() => handleSelect(opt)}
                        >
                            {opt}
                        </div>
                    ))}
                    
                    {filteredOptions.length === 0 && (
                        <div className="p-2 text-gray-400 text-xs italic">Tidak ada di daftar.</div>
                    )}
                    
                    {searchTerm && !filteredOptions.includes(searchTerm) && (
                         <div 
                            className="p-2 bg-indigo-50 text-indigo-700 font-bold cursor-pointer border-t"
                            onClick={() => handleSelect(searchTerm)}
                        >
                            Gunakan "{searchTerm}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const TabButton = ({ label, currentView, onClick, name }) => (
    <button
      onClick={onClick}
      className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
        currentView === name
          ? 'text-indigo-700 border-indigo-600 bg-white'
          : 'text-gray-500 border-transparent hover:text-indigo-500'
      }`}
    >
      {label}
    </button>
);

const QuickActionButton = ({ label, onClick, className, title }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={`text-[10px] font-medium bg-white border px-2 py-1 rounded hover:shadow-sm transition mr-1 mb-1 ${className}`}
    >
        {label}
    </button>
);

// --- KOMPONEN BARU: FILTER KAMAR DROPDOWN (ANTI-RIBET) ---
const RoomFilterDropdown = ({ allRooms, selectedRooms, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null); // Tambah useRef untuk klik luar

    const toggleRoom = (room) => {
        if (selectedRooms.includes(room)) {
            onChange(selectedRooms.filter(r => r !== room));
        } else {
            onChange([...selectedRooms, room]);
        }
    };

    const toggleAll = () => {
        if (selectedRooms.length === allRooms.length) onChange([]); // Hapus Semua
        else onChange(allRooms); // Pilih Semua
    };

    // Logic penutup saat klik di luar dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {/* Tombol Pemicu */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 px-2 rounded flex justify-between items-center hover:bg-indigo-50 transition"
            >
                <span>{selectedRooms.length === allRooms.length ? 'Semua Kamar Tampil' : `${selectedRooms.length} Kamar Dipilih`}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Menu Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-300 shadow-xl rounded-lg mt-1 z-50 p-2">
                    <div className="flex justify-between border-b pb-1 mb-2">
                        <button onClick={toggleAll} className="text-[10px] font-bold text-blue-600 hover:underline">
                            {selectedRooms.length === allRooms.length ? 'Uncheck All' : 'Check All'}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="text-[10px] text-red-500 hover:underline">Tutup</button>
                    </div>
                    
                    {/* Grid Kamar */}
                    <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {allRooms.map(room => (
                            <button
                                key={room}
                                onClick={() => toggleRoom(room)}
                                className={`text-[9px] py-1 rounded border transition ${
                                    selectedRooms.includes(room)
                                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                                }`}
                            >
                                {room}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
// -------------------------------------------------------------------

const StatCard = ({ title, value, subtext, color }) => (
    <div className={`bg-white p-4 rounded-lg shadow-md border-l-4 border-${color}-500`}>
        <div className="text-sm font-medium text-gray-500">{title}</div>
        <div className="text-2xl font-extrabold text-${color}-700 mt-1">{value}</div>
        {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
    </div>
);

// --- MODAL TTV & GCS Calculator ---
const TtvModal = ({ onClose, onSave }) => {
    const [ttv, setTtv] = useState({ td: '', n: '', s: '', rr: '', spo2: '' });
    const [gcs, setGcs] = useState({ e: 4, v: 5, m: 6 });

    const totalGcs = gcs.e + gcs.v + gcs.m;
    
    // Simple interpretation logic
    const getGcsInterp = (score) => {
        if (score >= 14) return 'Compos Mentis';
        if (score >= 12) return 'Apatis';
        if (score >= 10) return 'Delirium';
        if (score >= 7) return 'Somnolen';
        if (score >= 5) return 'Sopor';
        if (score === 4) return 'Semi-coma';
        return 'Coma';
    };

    const handleSave = () => {
        const gcsString = `GCS E${gcs.e}V${gcs.v}M${gcs.m} (${totalGcs}) - ${getGcsInterp(totalGcs)}`;
        const formatted = `TD ${ttv.td} mmHg, \nN ${ttv.n} x/m, \nS ${ttv.s} C, \nRR ${ttv.rr} x/m, \nSpO2 ${ttv.spo2}%, \n${gcsString}`;
        onSave(formatted);
    };

    const GcsOption = ({ label, val, current, onChange }) => (
        <button 
            type="button"
            onClick={() => onChange(val)}
            className={`flex-1 text-[9px] py-1 border border-r-0 last:border-r first:rounded-l last:rounded-r ${current === val ? 'bg-indigo-600 text-white font-bold' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
        >
            {label} ({val})
        </button>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4 border-2 border-green-100">
                <h3 className="text-sm font-bold text-green-800 mb-3 border-b pb-1">Input Tanda Vital & GCS</h3>
                
                {/* TTV Inputs */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <CustomInput label="TD (mmHg)" value={ttv.td} onChange={e => setTtv({...ttv, td: e.target.value})} placeholder="120/80" />
                    <CustomInput label="Nadi (x/m)" value={ttv.n} onChange={e => setTtv({...ttv, n: e.target.value})} placeholder="80" />
                    <CustomInput label="Suhu (C)" value={ttv.s} onChange={e => setTtv({...ttv, s: e.target.value})} placeholder="36.5" />
                    <CustomInput label="RR (x/m)" value={ttv.rr} onChange={e => setTtv({...ttv, rr: e.target.value})} placeholder="20" />
                    <CustomInput label="SpO2 (%)" value={ttv.spo2} onChange={e => setTtv({...ttv, spo2: e.target.value})} placeholder="98" />
                </div>

                {/* GCS Calculator */}
                <div className="bg-indigo-50 p-2 rounded border border-indigo-100 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-indigo-800">Kalkulator GCS</span>
                        <span className="text-xs font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded shadow-sm border border-indigo-200">
                            Total: {totalGcs} ({getGcsInterp(totalGcs)})
                        </span>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex items-center">
                            <span className="w-4 text-[10px] font-bold">E</span>
                            <div className="flex flex-1 ml-1">
                                {[4,3,2,1].map(v => <GcsOption key={v} label={v===4?'Spont':v===3?'Sound':v===2?'Pain':'None'} val={v} current={gcs.e} onChange={(val) => setGcs({...gcs, e: val})} />)}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="w-4 text-[10px] font-bold">V</span>
                            <div className="flex flex-1 ml-1">
                                {[5,4,3,2,1].map(v => <GcsOption key={v} label={v===5?'Orient':v===4?'Conf':v===3?'Word':v===2?'Sound':'None'} val={v} current={gcs.v} onChange={(val) => setGcs({...gcs, v: val})} />)}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="w-4 text-[10px] font-bold">M</span>
                            <div className="flex flex-1 ml-1">
                                {[6,5,4,3,2,1].map(v => <GcsOption key={v} label={v===6?'Obey':v===5?'Loc':v===4?'Flex':v===3?'Abn':v===2?'Ext':'None'} val={v} current={gcs.m} onChange={(val) => setGcs({...gcs, m: val})} />)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-3 py-1 text-xs border rounded hover:bg-gray-100">Batal</button>
                    <button onClick={handleSave} className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-bold">Simpan ke O</button>
                </div>
            </div>
        </div>
    );
};

// --- Confirmation Modal ---
const ConfirmationModal = ({ message, onConfirm, onCancel, title, children }) => {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-red-100">
                <h3 className="text-sm font-bold text-red-800 mb-3 border-b pb-1">{title}</h3>
                <p className="text-sm mb-4">{message}</p>
                {children}
                <div className="flex justify-end space-x-2">
                    <button onClick={onCancel} className="px-3 py-1 text-xs border rounded hover:bg-gray-100">Batal</button>
                    <button onClick={onConfirm} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-bold">Konfirmasi</button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL LAPOR WA (UPDATE: TOMBOL FORWARD) ---
const LaporConfirmationModal = ({ onLaporDpjp, onLaporJaga, onCancel, patientName, dpjpNumber }) => {
    // Helper format nomor
    const formatPhone = (raw) => raw ? '+' + String(raw).replace(/\D/g, '') : '-';

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-green-100">
                <h3 className="text-sm font-bold text-green-800 mb-3 border-b pb-1">Lapor Pasien: {patientName}</h3>
                <p className="text-xs text-gray-600 mb-3">Pilih tujuan pengiriman laporan:</p>
                
                <div className="flex flex-col gap-2">
                    {/* TOMBOL 1: KE DPJP (Otomatis nomor dari database) */}
                    <div className="w-full">
                        <button onClick={onLaporDpjp} disabled={!dpjpNumber} className={`w-full px-3 py-2 text-xs ${dpjpNumber ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} rounded font-bold shadow-sm flex justify-between items-center`}>
                            <span>Ke DPJP Utama</span>
                            <span>🚀</span>
                        </button>
                        <div className="text-[9px] text-gray-400 text-right mt-0.5">{dpjpNumber ? formatPhone(dpjpNumber) : 'No. HP Kosong'}</div>
                    </div>

                    {/* TOMBOL 2: KE SIAPA SAJA / FORWARD (Jaga/Raber/Grup) */}
                    <div className="w-full relative">
                        <div className="absolute -top-2 -right-1 bg-yellow-300 text-[8px] font-bold px-1 rounded text-black animate-pulse">BARU</div>
                        <button onClick={() => onLaporJaga()} className="w-full px-3 py-2 text-xs bg-green-600 text-white hover:bg-green-700 rounded font-bold shadow-sm flex justify-between items-center">
                            <span>Ke Dr. Jaga / Raber / Grup</span>
                            <span>⏩</span>
                        </button>
                        <div className="text-[9px] text-gray-400 text-right mt-0.5 italic">Pilih kontak sendiri di WA (Forward)</div>
                    </div>
                </div>

                <button onClick={onCancel} className="mt-4 w-full px-3 py-1.5 text-xs border rounded hover:bg-gray-100 text-gray-600 font-bold">Batal</button>
            </div>
        </div>
    );
};

// --- Tag Selector ---
const TagSelector = ({ label, options, onSelect, category, placeholder }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 15);

    const handleSelect = (opt) => {
        onSelect(category, opt);
        setSearchTerm('');
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const inputStyle = "w-full p-1 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 outline-none";
    
    const isSearchable = searchTerm.length >= 1; 

    return (
        <div className="relative mb-2" ref={wrapperRef}>
            <label className="block text-[9px] font-bold text-gray-700 uppercase mb-0.5">{label}</label>
            <input
                type="text"
                className={inputStyle}
                placeholder={placeholder || `Ketik min. 3 huruf...`}
                value={searchTerm}
                onChange={e => {
                    setSearchTerm(e.target.value);
                    if (e.target.value.length >= 1) setIsOpen(true);
                }}
                onFocus={() => {
                    if (searchTerm.length >= 1) setIsOpen(true);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredOptions.length > 0 && isOpen) {
                        e.preventDefault();
                        handleSelect(filteredOptions[0]);
                    }
                }}
            />

            {isOpen && searchTerm.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-gray-300 mt-1 max-h-48 overflow-y-auto shadow-lg rounded text-xs">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, index) => (
                            <div
                                key={index}
                                className="p-1.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0"
                                onClick={() => handleSelect(opt)}
                            >
                                {opt}
                            </div>
                        ))
                    ) : (
                        <div className="p-1.5 text-gray-400 italic">"{searchTerm}" tidak ditemukan.</div>
                    )}
                    
                    {searchTerm && !filteredOptions.includes(searchTerm) && (
                         <div 
                            className="p-1.5 bg-green-50 text-green-700 font-bold cursor-pointer border-t text-xs"
                            onClick={() => handleSelect(searchTerm)}
                        >
                            + Tambah manual: "{searchTerm}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- PRINT LAYOUT & COMPONENTS ---

const PrintLayout = ({ record }) => {
    if (!record) return null;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const { others, labs, rads, tms } = useMemo(() => {
        if (!record.planning) return { others: [], labs: [], rads: [], tms: [] };
        const lines = record.planning.split('\n');
        const res = { others: [], labs: [], rads: [], tms: [] };
        lines.forEach(line => {
            const t = line.trim();
            if(!t) return;
            if(t.startsWith('Lab. R/')) res.labs.push(t.replace('Lab. R/', '').trim());
            else if(t.startsWith('Rad. R/')) res.rads.push(t.replace('Rad. R/', '').trim());
            else if(t.startsWith('TM.')) res.tms.push(t.replace('TM.', '').trim());
            else res.others.push(line);
        });
        return res;
    }, [record.planning]);

    return (
        <div className="bg-white p-0 text-xs font-sans leading-snug text-black h-full">
            {/* Compact Header */}
            <div className="flex justify-between items-start border-b border-black pb-1 mb-2">
                <div>
                    <div className="font-bold text-lg uppercase tracking-wide">{record.name} <span className="text-xs font-normal border border-black px-1 ml-2">Km. {record.roomNumber}</span></div>
                    <div className="text-[10px] mt-0.5 font-bold">DPJP: {record.dpjpName}</div>
                    {(record.raberName || record.raber2Name) && (
                        <div className="text-[9px] text-gray-600">Raber: {[record.raberName, record.raber2Name].filter(Boolean).join(', ')}</div>
                    )}
                </div>
                <div className="text-right">
                    <div className="font-bold text-xs">{dateString}</div>
                </div>
            </div>

            {/* 2 Column Grid Layout */}
            <div className="grid grid-cols-2 gap-3">
                
                {/* Left Column: A (Top) & P (Bottom) */}
                <div className="space-y-3 border-r border-gray-200 pr-2 min-h-[400px] flex flex-col">
                    <div className="flex-1">
                        <div className="font-bold underline mb-0.5 bg-gray-100 print:bg-transparent inline-block px-1">A (ANALISA)</div>
                        <div className="whitespace-pre-wrap font-sans mb-3">{record.analysis || '-'}</div>
                    </div>

                    <div className="flex-1 border-t border-dashed border-gray-300 pt-2 mt-1">
                        <div className="font-bold underline mb-0.5 bg-gray-100 print:bg-transparent inline-block px-1">P (PLANNING)</div>
                        <div className="font-sans text-xs">
                            {others.length > 0 && (
                                <div className="whitespace-pre-wrap mb-2 leading-relaxed">
                                    {others.join('\n')}
                                </div>
                            )}
                            <div className="space-y-1 mt-1">
                                {labs.length > 0 && <div className="flex items-start"><span className="font-bold w-16 flex-shrink-0 text-[10px] uppercase pt-0.5">Lab.</span><span className="flex-1">: {labs.join(', ')}</span></div>}
                                {rads.length > 0 && <div className="flex items-start"><span className="font-bold w-16 flex-shrink-0 text-[10px] uppercase pt-0.5">Rad.</span><span className="flex-1">: {rads.join(', ')}</span></div>}
                                {tms.length > 0 && <div className="flex items-start"><span className="font-bold w-16 flex-shrink-0 text-[10px] uppercase pt-0.5">Tndkn.</span><span className="flex-1">: {tms.join(', ')}</span></div>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: O (Top) & S (Bottom) */}
                <div className="space-y-3 flex flex-col">
                    <div className="flex-1">
                        <div className="font-bold underline mb-0.5 bg-gray-100 print:bg-transparent inline-block px-1">O (OBJEKTIF)</div>
                        <div className="mb-2 font-mono text-[10px] grid grid-cols-2 gap-x-2 gap-y-1 text-gray-400 print:text-black border p-1 rounded bg-gray-50 print:bg-white print:border-none">
                            <div>TD : ____</div><div>N  : ____</div><div>S  : ____</div><div>RR : ____</div><div>SpO2: ___</div><div>GCS : ___</div>
                        </div>
                        <div className="whitespace-pre-wrap font-sans">{record.objective || '-'}</div>
                    </div>

                    <div className="flex-1 border-t border-dashed border-gray-300 pt-2 mt-1">
                        <div className="font-bold underline mb-0.5 bg-gray-100 print:bg-transparent inline-block px-1">S (SUBJEKTIF)</div>
                        <div className="whitespace-pre-wrap font-sans mb-3">{record.subjective || '-'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PrintView = ({ record, closePrint }) => {
  const onPrint = () => {
      handlePrintWindow('printable-area', `Cetak APOS - ${record.name}`);
  };

  return (
    <div className="fixed inset-0 bg-white z-[80] p-0 overflow-y-auto">
      {/* Header Controls */}
      <div className="p-4 bg-gray-100 flex justify-between items-center no-print sticky top-0 border-b shadow-sm">
        <h1 className="font-bold text-gray-700">Preview Cetak (APOS)</h1>
        <div className="space-x-2">
            <button 
                onClick={onPrint} 
                className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 flex items-center inline-flex"
            >
                <span className="mr-2">🖨️</span> Cetak Sekarang (A5)
            </button>
            <button onClick={closePrint} className="px-4 py-2 bg-red-500 text-white rounded text-sm font-bold">Tutup</button>
        </div>
      </div>

      <div id="printable-area" className="p-4">
          <PrintLayout record={record} />
      </div>
    </div>
  );
};

const BulkPrintView = ({ records, onClose }) => {
    const onPrint = () => {
        handlePrintWindow('bulk-printable-area', 'Cetak Banyak - APOS');
    };

    return (
        <div className="fixed inset-0 bg-white z-[90] overflow-y-auto">
            <div className="p-4 bg-indigo-50 flex justify-between items-center no-print sticky top-0 border-b shadow-sm z-50">
                <div>
                    <h1 className="font-bold text-indigo-900">Cetak Banyak (Batch Print)</h1>
                    <p className="text-xs text-gray-600">Total: {records.length} Pasien. Gunakan opsi "Pages" di dialog print browser untuk memilih halaman.</p>
                </div>
                <div className="space-x-2">
                    <button 
                        onClick={onPrint} 
                        className="px-6 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow hover:bg-indigo-700 flex items-center inline-flex"
                    >
                        <span className="mr-2">🖨️</span> Cetak Semua (A5)
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded text-sm font-bold">Tutup</button>
                </div>
            </div>

            <div id="bulk-printable-area" className="p-4 bg-gray-50">
                {records.map((rec, index) => (
                    <div key={rec.id} className="print-page bg-white shadow mb-8 mx-auto print-break">
                         {/* Visual separator for screen view only */}
                        <div className="no-print bg-gray-200 text-gray-500 text-[10px] p-1 text-center font-bold uppercase mb-2">
                            Halaman {index + 1}: {rec.name}
                        </div>
                        <PrintLayout record={rec} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- LOGIKA WARNA KAMAR CANGGIH ---

// Daftar Kamar Single Bed (Bed Sendiri)
const SINGLE_BED_ROOMS = ['K5B1', 'K7B1', 'K8B1', 'K9B1', 'K12B1', 'K14B1']; 
// (Catatan: Saya asumsikan penamaan di database pakai B1 semua untuk single, sesuaikan jika beda)

const detectGender = (name) => {
    if (!name) return 'unknown';
    const lower = name.toLowerCase();
    if (lower.includes('tn.') || lower.includes('tn ') || lower.includes('sdr') || lower.includes('lm')) return 'male';
    if (lower.includes('ny.') || lower.includes('ny ') || lower.includes('nn') || lower.includes('pr')) return 'female';
    return 'unknown';
};

// --- LOGIKA WARNA KAMAR (UPDATE: SUPPORT WAITING LIST) ---
const getRoomColorStatus = (roomName, activeRecords, waitingList = []) => {
    // 1. Cek apakah kamar ini TERISI di Dashboard?
    const patient = activeRecords.find(r => r.roomNumber === roomName);
    if (patient) return { color: 'red', status: 'Terisi', patient }; // Merah (Prioritas Utama)

    // 2. Jika Kosong, cek apakah ada BOOKING di Waiting List?
    const booking = waitingList.find(w => w.plannedRoom === roomName);
    if (booking) return { color: 'yellow', status: 'Booked', booking }; // Kuning (Booking)

    // 3. Jika benar-benar kosong, cek tipe kamar (Single Bed)
    if (SINGLE_BED_ROOMS.includes(roomName)) {
        return { color: 'green', status: 'Kosong' };
    }

    // 4. Logika Double Bed (Cek Tetangga Lk/Pr)
    const roomCode = roomName.split('B')[0]; 
    const bedCode = roomName.split('B')[1];
    const neighborBed = bedCode === '1' ? '2' : '1';
    const neighborRoomName = `${roomCode}B${neighborBed}`;
    
    const neighbor = activeRecords.find(r => r.roomNumber === neighborRoomName);
    if (neighbor) {
        if (neighbor.gender === 'L') return { color: 'orange', status: 'Sisa Lk' };
        if (neighbor.gender === 'P') return { color: 'purple', status: 'Sisa Pr' };
    }

    return { color: 'green', status: 'Kosong' };
};

// --- UI Peta Kamar (Update: Support Warna Booking Waiting List) ---
const RoomMap = ({ roomList, activeRecords, onSelectRoom, onEditRoom, roomFilter, waitingList = [] }) => {
    const filteredRoomList = roomList.filter(room => roomFilter.includes(room));
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
        <div className="p-2 overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-4 gap-2">
                {filteredRoomList.map(room => {
                    // 1. Cek Status Penghuni (Merah/Hijau/Ungu/Oren)
                    const { color, patient, booking } = getRoomColorStatus(room, activeRecords, waitingList);
                    
                    // 2. Cek Status Booking (Waiting List)
                    const isOccupied = !!patient;   
                    const isBooked = !!booking;
                    const displayName = patient ? (patient.name.split(' ')[0] + (patient.name.length > 8 ? '...' : '')) : room;
                    const displayDr = patient ? (patient.dpjpName.split(',')[0]) : '';

                    // 3. Tentukan Warna Akhir
                    let colorClass = "";
                    let statusText = "";

                    if (isOccupied) {
                        // Kalo terisi, tetap Merah (Status Booking kalah prioritas)
                        colorClass = "bg-red-50 border-red-300 text-red-900 hover:bg-red-100";
                        statusText = "Terisi";
                    } else if (isBooked) {
                        // KOSONG TAPI ADA BOOKING -> Kuning Emas
                        colorClass = "bg-yellow-100 border-yellow-400 text-yellow-900 hover:bg-yellow-200 ring-1 ring-yellow-300 animate-pulse";
                        statusText = `Booked: ${booking.name.split(' ')[0]}`;
                    } else if (color === 'orange') {
                        colorClass = "bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100";
                        statusText = "Sisa Lk";
                    } else if (color === 'purple') {
                        colorClass = "bg-purple-50 border-purple-300 text-purple-800 hover:bg-purple-100";
                        statusText = "Sisa Pr";
                    } else {
                        colorClass = "bg-green-50 border-green-200 text-green-800 hover:bg-green-100";
                        statusText = "Kosong";
                    }

                    return (
                    <div 
                        key={room} 
                        className={`p-1 text-center rounded border transition flex flex-col items-center justify-center min-h-[50px] cursor-pointer shadow-sm relative ${colorClass}`}
                        onClick={() => isOccupied ? onEditRoom(patient) : onSelectRoom(room)} 
                    >
                        {/* Indikator Booking (Icon Kecil di Pojok) */}
                        {!isOccupied && isBooked && (
                            <span className="absolute top-0 right-0 text-[8px] bg-yellow-400 text-white px-1 rounded-bl">WL</span>
                        )}

                        <div className="text-[10px] font-bold">{room}</div>
                        
                        {isOccupied ? (
                            <>
                                <div className="text-[9px] font-medium leading-tight mt-0.5 truncate w-full px-1 bg-white/50 rounded">{displayName}</div>
                                <div className="text-[7px] opacity-70 leading-tight truncate w-full">{displayDr}</div>
                            </>
                        ) : (
                            <div className={`text-[8px] mt-1 truncate w-full px-1 ${isBooked ? 'font-bold text-yellow-800' : 'opacity-50'}`}>
                                {statusText}
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
             {filteredRoomList.length === 0 && (
                 <div className="text-center p-4 text-xs text-gray-400 italic">Tidak ada kamar yang ditampilkan. Cek Filter Kamar.</div>
             )}
        </div>
      </div>
    );
};

// --- HELPER UNTUK MEMISAHKAN PLANNING (DITAMBAH Th. UNTUK TERAPI) ---
const parsePlanning = (text) => {
    // Tambah 'rxs' untuk menampung Terapi/Obat
    if (!text) return { labs: [], rads: [], tms: [], rxs: [], others: [] }; 
    
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const res = { labs: [], rads: [], tms: [], rxs: [], others: [] }; // Tambah rxs
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('Lab. R/')) res.labs.push(trimmed.replace('Lab. R/', '').trim());
        else if (trimmed.startsWith('Rad. R/')) res.rads.push(trimmed.replace('Rad. R/', '').trim());
        else if (trimmed.startsWith('TM.')) res.tms.push(trimmed.replace('TM.', '').trim());
        else if (trimmed.startsWith('Th.')) res.rxs.push(trimmed.replace('Th.', '').trim()); // TANGKAP TERAPI/OBAT
        else res.others.push(line);
    });
    return res;
};

// --- KODE BARU UNTUK renderPlanningCell (DITAMBAH WARNA UNGU) ---
const renderPlanningCell = (text) => {
    if (!text) return '-';
    
    // Panggil fungsi pemisah data baru (ambil rxs)
    const { labs, rads, tms, rxs, others } = parsePlanning(text);
    
    // Fungsi untuk membuat label kategori
    const renderCategory = (title, items, color) => {
        if (items.length === 0) return null;
        
        const finalColor = color; // Langsung pakai warna dari argumen

        // Tailwind colors: red, blue, green, purple
        const style = `block mb-1 px-2 py-0.5 rounded w-fit max-w-full text-xs font-medium border border-${finalColor}-200 bg-${finalColor}-100 text-${finalColor}-900`;
        const itemList = items.join('; '); 

        return (
            <div key={title} className={style}>
                <span className="font-bold mr-1">{title}:</span>
                {itemList}
            </div>
        );
    };

    // Tampilan Planning yang sudah dirapikan
    return (
        <div className="space-y-1">
            {renderCategory('Lab', labs, 'red')}     
            {renderCategory('Rad', rads, 'blue')}    
            {renderCategory('Tndkn', tms, 'green')}  
            {renderCategory('Terapi', rxs, 'purple')} {/* INI WARNA UNGU UNTUK TERAPI/OBAT */}
            {others.map((line, idx) => (
                <div key={`other-${idx}`} className="text-xs text-gray-700 whitespace-pre-wrap">{line}</div>
            ))}
        </div>
    );
};

// --- Helper Baru: Format Objektif dengan Balon Lacak ---
const renderObjectiveCell = (text) => {
    if (!text) return '-';
    const lines = text.split('\n');
    return (
        <div className="text-xs text-gray-800 whitespace-pre-wrap font-sans">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                // Jika baris diawali kata "Lacak" (case-insensitive), jadikan balon
                if (trimmed.toLowerCase().startsWith('lacak')) {
                    return (
                        <div key={idx} className="bg-orange-100 text-orange-900 border border-orange-300 px-2 py-1.5 rounded-lg mb-1 font-bold inline-block w-full shadow-sm animate-pulse">
                            <span className="mr-1">⚠️</span> {trimmed}
                        </div>
                    );
                }
                // Jika bukan, tampilkan teks biasa
                return <div key={idx}>{line}</div>;
            })}
        </div>
    );
};

const PatientTable = ({ records, onEdit, onPrint, onShowLaporModal, onDischarge, onBulkPrint, searchTerm, onSearchChange, handleExportExcel }) => {
    if (records.length === 0 && !searchTerm) {
        return <div className="text-center p-10 text-gray-400 italic text-sm bg-white h-full border rounded">Belum ada pasien aktif yang sesuai dengan filter.</div>;
    }

    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));
    }, [records]);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            
            {/* HEADER TABEL BARU (ADA SEARCH BAR DI TENGAH) */}
            <div className="bg-indigo-50 p-2 border-b border-indigo-100 flex justify-between items-center gap-3">
                
                {/* 1. JUDUL (Kiri) */}
                <h2 className="text-xs font-bold text-indigo-800 uppercase whitespace-nowrap">
                    Daftar Pasien ({records.length})
                </h2>

                {/* 2. SEARCH BAR (Tengah - Flexible) */}
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-8 pr-3 py-1 text-xs border border-indigo-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 transition bg-white text-indigo-900 placeholder-indigo-300"
                            placeholder="🔍 Cari nama pasien, Dokter, atau diagnosa..."
                        />
                        <span className="absolute left-2.5 top-1 text-[10px] text-indigo-400"></span>
                    </div>
                </div>

                {/* 3. TOMBOL AKSI (Kanan) */}
                <div className="flex space-x-2 flex-shrink-0"> 
                    {/* TOMBOL EXPORT BARU */}
                    <button
                        onClick={handleExportExcel}
                        className="text-[9px] px-3 py-1 bg-white border border-green-200 text-green-700 rounded-full font-bold hover:bg-green-600 hover:text-white shadow-sm flex items-center transition whitespace-nowrap"
                        title="Download Data Pasien Aktif ke Excel/CSV"
                    >
                        <span className="mr-1">⬇️</span> Export Excel
                    </button>
                    
                    {/* TOMBOL CETAK BANYAK LAMA */}
                    <button 
                        onClick={onBulkPrint}
                        className="text-[9px] px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-full font-bold hover:bg-indigo-600 hover:text-white shadow-sm flex items-center transition whitespace-nowrap"
                        title="Cetak Semua Pasien Aktif"
                    >
                        <span className="mr-1">🖨️</span> Cetak Banyak
                    </button>
                </div>
            </div>
            <div className="overflow-auto flex-1">
                <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-2 border border-gray-300 w-[15%] text-left">Identitas</th>
                            <th className="p-2 border border-gray-300 w-[15%] text-left">S (Subjektif)</th>
                            <th className="p-2 border border-gray-300 w-[15%] text-left">O (Objektif)</th>
                            <th className="p-2 border border-gray-300 w-[15%] text-left">A (Analisa)</th>
                            <th className="p-2 border border-gray-300 w-[25%] text-left">P (Planning)</th>
                            <th className="p-2 border border-gray-300 w-[15%] text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRecords.map((rec, index) => (
                            <tr key={rec.id} className={index % 2 === 0 ? 'bg-white hover:bg-indigo-50' : 'bg-gray-50 hover:bg-indigo-50'}>
                                <td className="p-2 border border-gray-300 align-top">
                                    <div className="font-bold text-sm text-indigo-900">{rec.name}</div>
                                    <div className="font-bold bg-yellow-100 inline-block px-1 rounded text-[10px] mt-1 border border-yellow-200">{rec.roomNumber}</div>
                                    <div className="mt-1 text-gray-600 italic text-[10px]">{rec.dpjpName.split(',')[0]}</div>
                                    {rec.raberName && <div className="text-[9px] text-blue-600">+ {rec.raberName}</div>}
                                </td>
                                <td className="p-2 border border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.subjective || '-'}</td>
                                <td className="p-2 border border-gray-300 align-top">
                                    {renderObjectiveCell(rec.objective)}
                                </td>
                                <td className="p-2 border border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.analysis || '-'}</td>
                                <td className="p-2 border border-gray-300 align-top">
                                    {renderPlanningCell(rec.planning)}
                                </td>
                                <td className="p-2 border border-gray-300 align-middle">
                                    <div className="grid grid-cols-2 gap-1">
                                        <button onClick={() => onEdit(rec)} className="flex flex-col items-center justify-center p-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 border border-yellow-300" title="Edit Data"><span className="text-sm">✏️</span><span className="text-[8px] font-bold">Edit</span></button>
                                        <button onClick={() => onPrint(rec)} className="flex flex-col items-center justify-center p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300" title="Cetak"><span className="text-sm">🖨️</span><span className="text-[8px] font-bold">Cetak</span></button>
                                        <button onClick={() => onShowLaporModal(rec)} className="flex flex-col items-center justify-center p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300" title="Lapor WA"><span className="text-sm">📱</span><span className="text-[8px] font-bold">Lapor</span></button>
                                        <button onClick={() => onDischarge(rec.id, rec.name)} className="flex flex-col items-center justify-center p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300" title="Pulangkan"><span className="text-sm">🚪</span><span className="text-[8px] font-bold">Plg</span></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Filter Modals ---
const RoomFilterModal = ({ roomList, selectedRooms, onToggleRoom, onSave, onSelectAll }) => {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4 border-2 border-indigo-100">
                <h3 className="text-sm font-bold text-indigo-800 mb-3 border-b pb-1">Filter Kamar (Multi-Select)</h3>
                <div className="flex justify-between mb-3 text-xs">
                    <button onClick={onSelectAll(true)} className="text-blue-600 hover:underline">Pilih Semua</button>
                    <button onClick={onSelectAll(false)} className="text-red-600 hover:underline">Bersihkan</button>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-2">
                    {roomList.map(room => (
                        <div key={room} className="flex items-center">
                            <input 
                                type="checkbox" 
                                id={`room-${room}`} 
                                checked={selectedRooms.includes(room)} 
                                onChange={() => onToggleRoom(room)}
                                className="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                            />
                            <label htmlFor={`room-${room}`} className="ml-2 text-xs font-medium text-gray-700">{room}</label>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={onSave} className="px-4 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold">Terapkan Filter</button>
                </div>
            </div>
        </div>
    );
};

// --- HELPER: LOGIKA SALAM DOKTER (TOLERANSI) ---
const getDoctorGreeting = (drName) => {
    const name = (drName || '').toLowerCase();
    
    // Daftar Dokter Non-Muslim (Akan menggunakan Selamat Pagi/Siang/Sore/Malam)
    const nonMuslimDoctors = [
        'dian ekowati', 
        'martin', 
        'irwan'
    ];

    const isNonMuslim = nonMuslimDoctors.some(n => name.includes(n));

    if (isNonMuslim) {
        const h = new Date().getHours();
        if (h >= 4 && h < 10) return "Selamat Pagi";
        if (h >= 10 && h < 15) return "Selamat Siang";
        if (h >= 15 && h < 18) return "Selamat Sore";
        return "Selamat Malam";
    } else {
        return "Assalamualaikum";
    }
};

// --- GENERATOR LAPORAN DINAS (FINAL: EMOJI UNICODE & FILTER DPJP) ---
const generateShiftReport = (activeRecords, records, waitingList, dpjpProfiles) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + (currentMinute / 60);

    // 1. LOGIKA SHIFT (Batas Lapor 08.00)
    let shift = '';
    let reportDate = new Date(now);
    let shiftStart = new Date(now);
    let shiftEnd = new Date(now);

    if (currentTime >= 8.0 && currentTime < 15.5) {
        shift = 'Pagi';
        shiftStart.setHours(7, 30, 0, 0); shiftEnd.setHours(14, 0, 0, 0);
    } 
    else if (currentTime >= 15.5 && currentTime < 22.5) {
        shift = 'Sore';
        shiftStart.setHours(14, 0, 0, 0); shiftEnd.setHours(21, 0, 0, 0);
    } 
    else {
        shift = 'Malam';
        if (currentTime >= 22.5) {
            shiftStart.setHours(21, 0, 0, 0); shiftEnd.setDate(shiftEnd.getDate() + 1); shiftEnd.setHours(7, 30, 0, 0);
        } else {
            reportDate.setDate(reportDate.getDate() - 1);
            shiftStart.setDate(shiftStart.getDate() - 1); shiftStart.setHours(21, 0, 0, 0);
            shiftEnd.setHours(7, 30, 0, 0);
        }
    }
    const dateStr = reportDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // 2. EMOJI "HARDCODED" (UNICODE ESCAPE) - DIJAMIN AMAN
    // Ini adalah kode asli emoji, browser tidak akan salah baca
    const snow = '\u2744\uFE0F';      // ❄️
    const rs = '\uD83C\uDFE5';        // 🏥
    const woman = '\uD83D\uDC69';     // 👩
    const man = '\uD83D\uDC68';       // 👨

    // 3. STATISTIK DASAR
    const totalBed = 24;
    const activeCount = activeRecords.length;
    
    // 4. HITUNG KAMAR KOSONG & GENDER
    let emptyCount = 0; let emptyMale = 0; let emptyFemale = 0; let emptyIso = 0;
    const occupiedRooms = activeRecords.map(r => r.roomNumber);
    const isoRooms = ['K14B1', 'K15B1', 'K15B2'];
    const allRooms = ['K1B1', 'K1B2', 'K2B1', 'K2B2', 'K3B1', 'K3B2', 'K4B1', 'K4B2', 'K5B1', 'K6B1', 'K6B2', 'K7B1', 'K8B1', 'K9B1', 'K10B1', 'K10B2', 'K11B1', 'K11B2', 'K12B1', 'K13B1', 'K13B2', 'K14B1', 'K15B1', 'K15B2'];

    allRooms.forEach(room => {
        if (!occupiedRooms.includes(room)) {
            if (isoRooms.includes(room)) emptyIso++;
            else {
                emptyCount++;
                const roomCode = room.split('B')[0];
                const bedCode = room.split('B')[1];
                const neighborBed = bedCode === '1' ? '2' : '1';
                const neighborRec = activeRecords.find(r => r.roomNumber === `${roomCode}B${neighborBed}`);
                if (neighborRec) {
                    if (neighborRec.gender === 'L') emptyMale++;
                    else if (neighborRec.gender === 'P') emptyFemale++;
                }
            }
        }
    });

    // 5. STATISTIK PERGERAKAN
    const newPatientCount = activeRecords.filter(r => { if(!r.createdAt) return false; const t = r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000) : r.createdAt; return t >= shiftStart && t <= shiftEnd; }).length;
    const dischargedCount = records.filter(r => { if(!r.isDischarged || !r.updatedAt) return false; const t = r.updatedAt.seconds ? new Date(r.updatedAt.seconds * 1000) : r.updatedAt; return t >= shiftStart && t <= shiftEnd; }).length;
    const blplCount = activeRecords.filter(r => (r.planning && r.planning.toLowerCase().includes('blpl')) || (r.planning && r.planning.toLowerCase().includes('pulang')) || (r.planning && r.planning.toLowerCase().includes('aps'))).length;

    // --- 6. FILTER DPJP (YANG 0 PASIEN HILANG) ---
    const activeDpjpList = dpjpProfiles
        .map(dr => {
            const count = activeRecords.filter(r => r.dpjpName === dr.name).length;
            return { name: dr.name, count };
        })
        .filter(item => item.count > 0) // <-- Pastikan ini jalan
        .sort((a, b) => b.count - a.count);

    const dpjpStats = activeDpjpList.length > 0 
        ? activeDpjpList.map(d => `${d.name.padEnd(20, ' ')} : ${d.count}`).join('\n')
        : '-';

    // 7. RABER & LAINNYA
    const raberGroups = {};
    activeRecords.forEach(r => {
        const add = (dr, patient) => { if(!dr) return; if(!raberGroups[dr]) raberGroups[dr] = []; raberGroups[dr].push(patient); };
        add(r.raberName, r.name); add(r.raber2Name, r.name);
    });
    const raberText = Object.keys(raberGroups).map(dr => `${dr} (${raberGroups[dr].join(', ')})`).join('\n');
    
    const dhfPatients = activeRecords.filter(r => { const txt = (r.analysis + r.planning + r.diagnosis || '').toLowerCase(); return txt.includes('dhf') || txt.includes('dengue') || txt.includes('dbd'); }).map(r => r.name).join(', ');
    
    const pesananText = waitingList.map(w => {
        const diag = w.diagnosis || '-'; const asal = w.originRoom || 'IGD'; const kls = w.insuranceClass || '-';
        return `${w.plannedRoom}: ${w.name} / ${diag} / ${asal} / ${kls}`;
    }).join('\n') || '-';

    // --- TEMPLATE TEKS WA ---
    const text = `Assalamu'alaikum wr.wb.
*Laporan Dinas ${shift}*
Tanggal : ${dateStr}

${snow}${rs} *Ruang Melati* ${rs}${snow}

Kapasitas bed          : ${totalBed}
Jumlah pasien          : ${activeCount}
Jumlah pasien virtual : -
Total pasien keseluruhan : ${activeCount}

Kamar Kosong : ${emptyCount} bed
${woman}      : ${emptyFemale} Bed
${man}      : ${emptyMale} Bed

Kamar Kosong Isolasi  : ${emptyIso}
${woman}      : - bed
${man}      : - bed

Pasien Sudah Pulang        : ${dischargedCount > 0 ? dischargedCount : '-'}
Pasien Rencana Pulang    : ${blplCount > 0 ? blplCount : '-'}
Pasien Pindah Ruangan    : -
Pasien Pulang Paksa         : -
Pasien Meninggal              : -
Pasien Rujuk                      : -
Pasien Baru                        : ${newPatientCount > 0 ? newPatientCount : '-'}

*DPJP :*
${dpjpStats}

*Raber*:
${raberText || '-'}

*Pasien DHF*:
${dhfPatients || '-'}

*Pesanan*:
${pesananText}

*Sampah* : _Clear_

*Perawat jaga* :  orang

Wassalamu'alaikum Wr. Wb`;

    return encodeURIComponent(text);
};

const DigitalClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="flex flex-col items-end leading-none select-none">
            <div className="text-lg font-mono font-bold text-indigo-900">
                {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-[9px] text-gray-500 uppercase font-bold">
                {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
        </div>
    );
};

// --- LOGIC UTAMA ---
const MedicalRecordApp = ({ db, userId, appId, isOnline, onLogout, userRole }) => {
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRecords, setActiveRecords] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [waitingList, setWaitingList] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [quickTtvTarget, setQuickTtvTarget] = useState(null);
  
  // --- MONITORING DAFTAR TUNGGU SECARA REAL-TIME ---
  useEffect(() => {
    if (!db || !appId) return;

    // 1. Arahkan ke koleksi waitingList
    const wlRef = collection(db, `artifacts/${appId}/public/data/waitingList`);
    
    // 2. Urutkan berdasarkan waktu daftar (asc = yang duluan daftar di atas)
    const q = query(wlRef, orderBy('createdAt', 'asc')); 
    
    // 3. Fungsi onSnapshot untuk update otomatis saat ada data masuk/hapus
    const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data() 
        }));
        setWaitingList(list); // Ini yang bikin List Antrean (0) berubah jadi (1), (2), dst.
        console.log("Waiting list updated:", list.length);
    }, (err) => {
        console.error("Gagal sinkronisasi Waiting List:", err);
    });

    return () => unsub(); // Putus koneksi saat pindah menu
  }, [db, appId]);

  // State untuk Data Dinamis (Setelan)
  const [dpjpProfiles, setDpjpProfiles] = useState(initialDpjpProfiles.map(p => ({...p, name: p.name})));
  // Menggunakan DEFAULT_JAGA_LINK sebagai nilai awal
  const [jagaGroupLink, setJagaGroupLink] = useState(DEFAULT_JAGA_LINK);
  
  const [historyLogs, setHistoryLogs] = useState([]); // Ganti jadi Array

  const [view, setView] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  
  // State Print
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false); // New Bulk Print State

  const [showInputModal, setShowInputModal] = useState(false);
  const [recordForLapor, setRecordForLapor] = useState(null);

  const [dpjpFilter, setDpjpFilter] = useState(''); 
  const [selectedRoomFilter, setSelectedRoomFilter] = useState(ROOM_LIST);
  
  const [showRaber1, setShowRaber1] = useState(false);
  const [showRaber2, setShowRaber2] = useState(false);
  const [showTtvModal, setShowTtvModal] = useState(false);
  
  const [confirmDetails, setConfirmDetails] = useState({ isOpen: false, message: '', title: '', action: () => {} });
  const openConfirm = (title, message, action) => { setConfirmDetails({ isOpen: true, title, message, action }); };
  const closeConfirm = () => { setConfirmDetails({ isOpen: false, message: '', title: '', action: () => {} }); };
  
  const [formData, setFormData] = useState({
  roomNumber: '', name: '', gender: '', 
  dpjpName: '', raberName: '', raber2Name: '',
  subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
});

  const [newDpjpName, setNewDpjpName] = useState('');
  const [newDpjpWa, setNewDpjpWa] = useState('');

  
  const filteredActiveRecords = useMemo(() => {
    return activeRecords.filter(rec => {
        const matchesDpjp = !dpjpFilter || rec.dpjpName === dpjpFilter;
        const matchesRoom = selectedRoomFilter.includes(rec.roomNumber);
        const matchesSearch = !searchTerm || rec.name.toLowerCase().includes(searchTerm.toLowerCase());       
        return matchesDpjp && matchesRoom && matchesSearch;
    });
}, [activeRecords, dpjpFilter, selectedRoomFilter, searchTerm]); 

  // --- LOGIC DATABASE BARU (SHARED) ---
  const getCollectionRef = useCallback(() => {
    // MENGUBAH PATH KE PUBLIC DATA AGAR SHARING BISA TERJADI
    if (db) return collection(db, `artifacts/${appId}/public/data/medicalRecords`);
    return null;
  }, [db, appId]);
  
  // --- LOGIC SETELAN DI DATABASE (PERSISTENT) ---
  const getConfigRef = useCallback(() => {
      if (db) return doc(db, `artifacts/${appId}/public/data/settings`, 'mainConfig');
      return null;
  }, [db, appId]);

  // 1. Load Settings from Firestore
  useEffect(() => {
      if (!userId) return; // FIX: Guard clause added
      const ref = getConfigRef();
      if (!ref) return;

      const unsubscribe = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const data = snap.data();
              if (data.dpjpProfiles && Array.isArray(data.dpjpProfiles)) {
                  setDpjpProfiles(data.dpjpProfiles);
              }
              if (data.jagaGroupLink) {
                  setJagaGroupLink(data.jagaGroupLink);
              }
          } else {
              // First time init: save defaults
              setDoc(ref, { 
                  dpjpProfiles: initialDpjpProfiles,
                  jagaGroupLink: DEFAULT_JAGA_LINK 
              }).catch(err => console.error("Init settings error:", err));
          }
      }, (err) => console.error("Settings Load Error:", err));

      return () => unsubscribe();
  }, [getConfigRef, userId]); // FIX: userId dependency added

  // 2. Save Settings to Firestore
  const saveConfig = async (newProfiles, newLink) => {
      const ref = getConfigRef();
      if (!ref) return;
      
      const payload = {};
      if (newProfiles !== undefined) payload.dpjpProfiles = newProfiles;
      if (newLink !== undefined) payload.jagaGroupLink = newLink;
      
      try {
          await setDoc(ref, payload, { merge: true });
          console.log("Settings saved to cloud.");
      } catch(e) {
          console.error("Save config error:", e);
          alert("Gagal menyimpan setelan ke cloud. Cek koneksi.");
      }
  };

  const handleAddDpjp = () => {
      if (!newDpjpName.trim()) return;
      const existing = dpjpProfiles.some(p => p.name.toLowerCase() === newDpjpName.trim().toLowerCase());
      if (existing) {
          alert("Nama DPJP ini sudah ada!");
          return;
      }
      const newProfile = { name: newDpjpName.trim(), waNumber: newDpjpWa.trim().replace(/\D/g, '') }; 
      const updated = [...dpjpProfiles, newProfile].sort((a,b) => a.name.localeCompare(b.name));
      // Save directly to cloud triggers the onSnapshot update
      saveConfig(updated);
      setNewDpjpName(''); setNewDpjpWa('');
  };
  
  const handleRemoveDpjp = (name) => {
      const updated = dpjpProfiles.filter(p => p.name !== name).sort((a,b) => a.name.localeCompare(b.name));
      saveConfig(updated);
  };


  useEffect(() => {
    if (!userId) return; // FIX: Guard clause added
    const ref = getCollectionRef();
    if (!ref) return;

    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
          const docData = d.data();
          return { 
              id: d.id, ...docData, 
              createdAt: docData.createdAt?.toDate() || new Date(),
              updatedAt: docData.updatedAt?.toDate() || null
          };
      });
      setRecords(data);
      const active = data.filter(r => !r.isDischarged);
      setActiveRecords(active);
      setOccupiedRooms(active.map(r => r.roomNumber));
    }, (err) => console.error("Firestore Error:", err));
    
    return () => unsubscribe();
  }, [getCollectionRef, userId]); // FIX: userId dependency added

 
  const pullDataForField = (field) => {
      if (!lastHistoryRecord) return;
      const val = lastHistoryRecord[field];
      if (val) setFormData(p => ({ ...p, [field]: val }));
      else console.log(`Data ${field} kosong di history.`);
  };

  const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(p => ({ ...p, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      roomNumber: '', name: '', dpjpName: '', raberName: '', raber2Name: '',
      subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
    });
    setIsEditing(false);
    setShowRaber1(false); setShowRaber2(false);
    setCurrentRecordId(null);
  };

  // Diperbarui: handleSelectRoom hanya untuk kamar KOSONG
  const handleSelectRoom = (roomNumber) => {
      resetForm();
      setFormData(p => ({ ...p, roomNumber }));
      setShowInputModal(true); 
  };
  
  // Fungsi baru untuk dipanggil dari RoomMap ketika kamar TERISI diklik
  const handleEditRoom = (patientRecord) => {
      handleEdit(patientRecord);
  };

  const appendText = (field, text) => {
      setFormData(p => ({ ...p, [field]: p[field] ? p[field] + '\n' + text : text }));
  };

  const appendPlanning = (category, item) => {
      let prefix = '';
      if (category === 'Lab') prefix = 'Lab. R/ ';
      else if (category === 'Rad') prefix = 'Rad. R/ ';
      else if (category === 'Med') prefix = 'TM. ';
      
      setFormData(p => ({ 
          ...p, 
          planning: p.planning ? p.planning + `\n${prefix}${item}` : `${prefix}${item}` 
      }));
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validasi Input Wajib
      if (!formData.name || !formData.roomNumber || !formData.dpjpName) {
          alert('Mohon lengkapi data wajib (Nama, Kamar, DPJP) sebelum menyimpan.');
          return;
      }
      
      // Validasi Kamar Terisi (Agar tidak menimpa pasien lain)
      const isRoomOccupied = occupiedRooms.includes(formData.roomNumber) && 
                              (!isEditing || (isEditing && formData.roomNumber !== activeRecords.find(r => r.id === currentRecordId)?.roomNumber));
      
      if (!isEditing && isRoomOccupied) {
          alert(`Kamar ${formData.roomNumber} sudah terisi. Pilih kamar lain.`);
          return;
      } else if (isEditing && isRoomOccupied) {
           const existingOccupant = activeRecords.find(r => r.roomNumber === formData.roomNumber && r.id !== currentRecordId);
           if (existingOccupant) {
               alert(`Kamar ${formData.roomNumber} sudah terisi oleh ${existingOccupant.name}.`);
               return;
           }
      }

      setLoading(true);
      const ref = getCollectionRef();
      try {
          const now = Timestamp.now();
          const data = { ...formData, updatedAt: now };
          if (!isEditing) data.createdAt = now;

          let recordId = currentRecordId;

          // 1. SIMPAN/UPDATE DATA UTAMA (Agar Dashboard Berubah)
          if (isEditing && currentRecordId) {
              await updateDoc(doc(ref, currentRecordId), data);
          } else {
              const newDoc = await addDoc(ref, data);
              recordId = newDoc.id;
          }
          
          // 2. REKAM JEJAK RIWAYAT (PENTING BUAT 7 HARI)
          // Kita buat salinan ke sub-folder 'notes' biar riwayatnya abadi
          if (db && appId && recordId) {
              const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${recordId}/notes`);
              await addDoc(notesRef, {
                  ...formData,
                  createdAt: now,
                  noteType: 'daily_update'
              });
          }

          resetForm();
          setShowInputModal(false);
          console.log("Data berhasil disimpan & riwayat tercatat.");
      } catch (err) { 
          console.error("Kesalahan saat menyimpan:", err); 
          alert("Gagal menyimpan. Cek koneksi internet.");
      } 
      finally { 
          setTimeout(() => setLoading(false), 100); 
      }
  };

// --- FUNGSI SUNTIK TTV (JALUR VIP) ---
const handleSaveQuickTtv = async (ttvString) => {
    if (!quickTtvTarget || !db) return;

    setLoading(true);
    try {
        const ref = doc(db, `artifacts/${appId}/public/data/medicalRecords`, quickTtvTarget.id);

        // 1. Ambil data O yang lama biar ga hilang
        const oldObjective = quickTtvTarget.objective || '';

        // 2. Gabungkan: TTV Baru ditaruh paling ATAS biar terbaca di tabel
        // Tambahkan Jam input biar jelas
        const timeStr = new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        const newEntry = `[${timeStr}] ${ttvString}`;
        const finalObjective = newEntry + '\n' + oldObjective;

        // 3. Update HANYA kolom Objective & UpdatedAt (S, A, P AMAN!)
        await updateDoc(ref, {
            objective: finalObjective,
            updatedAt: Timestamp.now()
        });

        // 4. (Opsional) Catat di riwayat sub-collection juga
        const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${quickTtvTarget.id}/notes`);
        await addDoc(notesRef, {
            ...quickTtvTarget, // Copy data lain
            objective: finalObjective, // Update O nya
            noteType: 'ttv_update',
            createdAt: Timestamp.now()
        });

        console.log("TTV berhasil disuntikkan!");
        setQuickTtvTarget(null); // Tutup modal
        setShowTtvModal(false);  // Pastikan modal tutup

    } catch (e) {
        console.error("Gagal update TTV:", e);
        alert("Gagal menyimpan TTV.");
    } finally {
        setLoading(false);
    }
};

  // --- FUNGSI LOGIKA WAITING LIST (DITARUH DI ATAS handleEdit) ---
  // 1. Tambah Antrean
  const handleAddWaiting = async (data) => {
    try {
        // Path koleksi harus sesuai dengan struktur Firebase kamu
        const wlRef = collection(db, `artifacts/${appId}/public/data/waitingList`);
        await addDoc(wlRef, {
            ...data, 
            createdAt: Timestamp.now() 
        });
        console.log("Antrean berhasil dicatat ke Firebase");
    } catch (e) { 
        console.error("Gagal catat antrean:", e);
        alert("Gagal catat antrean: " + e.message); 
    }
};

  // 2. Hapus Antrean
  const handleDeleteWaiting = async (id) => {
      if(!window.confirm("Hapus antrean ini?")) return;
      try {
          await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, id));
      } catch (e) { alert("Gagal hapus: " + e.message); }
  };

  // 3. Pindah ke Kamar (Check-In)
  const handleMoveToRoom = async (waitRec) => {
      // Cek apakah kamar tujuan KOSONG?
      const isOccupied = activeRecords.some(r => r.roomNumber === waitRec.plannedRoom);
      if (isOccupied) {
          alert(`GAGAL: Kamar ${waitRec.plannedRoom} masih TERISI! Kosongkan dulu sebelum memasukkan pasien.`);
          return;
      }

      if(!window.confirm(`Masukkan ${waitRec.name} ke kamar ${waitRec.plannedRoom} sekarang?`)) return;
      
      try {
          setLoading(true);
          // Buat record baru di Dashboard
          await addDoc(getCollectionRef(), {
              name: waitRec.name,
              roomNumber: waitRec.plannedRoom,
              dpjpName: 'dr. Belum Dipilih', // Default sementara
              gender: '', 
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              isDischarged: false,
              planning: waitRec.diagnosis ? `Diagnosa Awal: ${waitRec.diagnosis}` : ''
          });

          // Hapus dari Waiting List (karena sudah masuk kamar)
          await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, waitRec.id));
          
          alert("Berhasil check-in! Silakan lengkapi data di dashboard.");
          setView('dashboard'); 
      } catch (e) {
          console.error(e);
          alert("Error saat check-in.");
      } finally {
          setLoading(false);
      }
  };

// --- FUNGSI KLIK PASIEN: ISI FORM & TARIK SEMUA RIWAYAT ---
  const handleEdit = async (rec) => {
      // 1. Siapkan Form dengan DATA LAMA (agar tidak hilang)
      setFormData({
          roomNumber: rec.roomNumber, 
          name: rec.name, 
          gender: rec.gender || '', 
          dpjpName: rec.dpjpName,
          raberName: rec.raberName || '', 
          raber2Name: rec.raber2Name || '',
          
          // PERBAIKAN: Ambil data dari 'rec', jangan dikosongkan!
          subjective: rec.subjective || '', 
          objective: rec.objective || '', 
          analysis: rec.analysis || '', 
          planning: rec.planning || '',   
          
          isDischarged: false
      });

      setCurrentRecordId(rec.id);
      setIsEditing(true);
      setShowRaber1(!!rec.raberName);
      setShowRaber2(!!rec.raber2Name);
      
      // 2. TARIK SEMUA RIWAYAT DARI DATABASE (Auto Fetch)
      setHistoryLogs([]); 
      if (db && userId) {
         try {
             const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${rec.id}/notes`);
             const q = query(notesRef, orderBy('createdAt', 'desc')); // Urutkan dari terbaru
             
             getDocs(q).then((snapshot) => {
                 const logs = snapshot.docs.map(doc => ({
                     ...doc.data(),
                     updatedAt: doc.data().createdAt // Fix tanggal Invalid Date sekalian
                 }));

                 // LOGIKA PINTAR ANTI-DUPLIKAT:
                 if (logs.length > 0) {
                     // Jika sudah ada arsip notes (pasien baru/sudah pernah disimpan), 
                     // Pake data logs saja (karena logs[0] sudah pasti data terbaru).
                     setHistoryLogs(logs);
                 } else {
                     // Jika logs KOSONG (pasien lama/belum pernah diedit pakai sistem baru),
                     // Baru kita pinjam data Dashboard (rec) biar riwayat gak kosong melompong.
                     setHistoryLogs([rec]);
                 }
             });
         } catch (e) {
             console.error("Gagal tarik history:", e);
         }
      }

      setShowInputModal(true); 
  };

  const handleDischarge = (id, name) => {
      const dischargeAction = async () => {
          setLoading(true);
          try {
              const ref = getCollectionRef();
              await updateDoc(doc(ref, id), { isDischarged: true, updatedAt: Timestamp.now() });
              console.log(`Pasien ${name} discharged successfully.`);
          } catch (e) { 
              console.error("Discharge Error:", e); 
          } finally {
              setLoading(false);
              closeConfirm();
          }
      };
      
      openConfirm(
          "Konfirmasi Pasien Pulang", 
          `Anda yakin ingin mengeluarkan pasien ${name}? Kamar ${activeRecords.find(r => r.id === id)?.roomNumber} akan dikosongkan.`, 
          dischargeAction
      );
  };  
  
  const handleToggleRoomFilter = (room) => {
        setSelectedRoomFilter(prev => 
            prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]
        );
    };    
    const handleSelectAllRooms = (shouldSelect) => () => {
        setSelectedRoomFilter(shouldSelect ? ROOM_LIST : []);
    };
  
    // Helper: Normalisasi nomor WA untuk digunakan di wa.me
  const normalizePhone = (num) => {
      if (!num) return '';
      const digits = String(num).replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('0')) return '62' + digits.substring(1);
      if (digits.startsWith('8')) return '62' + digits;
      if (digits.startsWith('62')) return digits;
      return digits;
  };
// --- FUNGSI BARU: LAPOR JUMLAH PASIEN KE DPJP ---
  const handleReportDpjpCount = (drName, count) => {
      // 1. Cari Nomor HP Dokter dari Profil
      // Pastikan nama dokter sama persis dengan yang di-input di Setelan
      const profile = dpjpProfiles.find(p => p.name === drName);
      
      // Gunakan normalizePhone yang sudah ada di kodemu
      const phone = normalizePhone(profile?.waNumber);
      
      if (!phone) {
          alert(`Gagal: Nomor WA untuk ${drName} belum disetting. Silakan isi di menu Setelan.`);
          return;
      }

      // 2. Tentukan Salam (Muslim/Non-Muslim)
      const salam = getDoctorGreeting(drName);

      // 3. Susun Pesan
      const text = `${salam} dokter, izin melaporkan jumlah pasien dokter di Melati ada ${count} pasien ya. terimakasih`;

      // 4. Kirim ke WA
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- FUNGSI BARU: LAPOR PASIEN RABER ---
  const handleReportRaber = (drName, patientNames) => {
      // 1. Cari Nomor HP
      const profile = dpjpProfiles.find(p => p.name === drName);
      const phone = normalizePhone(profile?.waNumber);
      
      if (!phone) {
          alert(`Gagal: Nomor WA untuk ${drName} belum disetting.`);
          return;
      }

      // 2. Tentukan Salam
      const salam = getDoctorGreeting(drName);

      // 3. Susun Pesan
      const text = `${salam} dokter, izin mengingatkan ada pasien Raber ya di Melati a.n ${patientNames.join(', ')}. terimakasih`;

      // 4. Kirim ke WA
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const findDpjpProfileByName = (name) => {
      if (!name) return null;
      const lower = name.toLowerCase();
      return dpjpProfiles.find(p => {
          if (!p || !p.name) return false;
          const pn = p.name.toLowerCase();
          return pn === lower || pn.includes(lower) || lower.includes(pn);
      }) || null;
  };

// --- FUNGSI LAPOR WA (UPDATE: SUPPORT FORWARD MODE) ---
  const handleLapor = (rec, type) => {
      // 1. Siapkan Nomor (Hanya jika lapor Personal DPJP)
      let targetNumber = '';
      
      if (type === 'DPJP') {
          const profile = findDpjpProfileByName(rec.dpjpName || '');
          const raw = profile?.waNumber || '';
          targetNumber = normalizePhone(raw); // Fungsi normalizePhone pastikan tetap ada di kode mu
          
          if (!targetNumber) {
              alert(`Nomor WA untuk ${rec.dpjpName} belum disetting. Silakan setting di menu 'Setelan' atau gunakan tombol 'Pilih Kontak Sendiri'.`);
              return;
          }
      } 
      // Jika type === 'Forward' (Jaga/Raber), kita biarkan targetNumber KOSONG.
      // Ini akan memicu WA membuka daftar kontak (Forward style).

      // 2. Susun Pesan
      const { labs, rads, tms, others } = parsePlanning(rec.planning);
      const planningText = [
          ...others.filter(Boolean),
          labs.length > 0 ? `Lab: ${labs.join(', ')}` : null,
          rads.length > 0 ? `Rad: ${rads.join(', ')}` : null,
          tms.length > 0 ? `Tndkn: ${tms.join(', ')}` : null,
      ].filter(Boolean).join('\n');

      const dpjpInfo = type === 'Forward' ? `\nDPJP: ${rec.dpjpName || '-'}` : ''; // Info DPJP muncul kalau Forward
      const header = `Dokter Izin Lapor Pasien \na.n *${rec.name}* ${dpjpInfo}`;
      const text = `${header}\n\n*S:*\n${rec.subjective || '-'}\n\n*O:*\n${rec.objective || '-'}\n\n*A:*\n${rec.analysis || '-'}\n\n*P:*\n${planningText || '-'}\n\nMohon advis,\nTerimakasih`;

      // 3. Buka WA
      // Jika ada nomor -> Chat ke nomor itu
      // Jika TIDAK ada nomor -> Buka menu "Share/Forward" WA
      const baseUrl = targetNumber ? `https://wa.me/${targetNumber}` : `https://wa.me/`;
      const url = `${baseUrl}?text=${encodeURIComponent(text)}`;
      
      const waWindow = window.open(url, '_blank');
      if (!waWindow) alert("Izinkan pop-up untuk membuka WhatsApp.");

      setRecordForLapor(null); // Tutup modal
  };

  const handleExportExcel = () => {
      if (!records || records.length === 0) {
          alert("Tidak ada data untuk diexport.");
          return;
      }
      
      const exportedRecords = records.filter(r => !r.isDischarged); // HANYA export pasien aktif

      // 1. Buat Header CSV (Menambah kolom baru: Lab, Rad, Tindakan)
      const headers = [
          "No", "Tanggal Masuk", "Jam Masuk", "Nama Pasien", "Kamar", 
          "DPJP", "Raber 1", "Raber 2", "Status Pulang",
          "Subjektif (S)", "Objektif (O)", "Analisa (A)", "Planning Lain",
          "LAB", "RADIOLOGI", "TINDAKAN" // <-- KOLOM BARU
      ];

      // Helper untuk escape tanda kutip (") agar CSV tidak rusak
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      
      // 2. Buat Rows Data
      const rows = exportedRecords.map((r, index) => {
          const date = r.createdAt.toLocaleDateString('id-ID');
          const time = r.createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          
          // MENGGUNAKAN FUNGSI BARU UNTUK MEMILAH PLANNING
          const parsedP = parsePlanning(r.planning);
          
          // Menggabungkan item di dalam Planning menjadi satu string (dipisahkan koma)
          const labItems = parsedP.labs.join(', ');
          const radItems = parsedP.rads.join(', ');
          const tmItems = parsedP.tms.join(', ');

          // Planning Lain-lain (yang tidak berawalan Lab/Rad/TM)
          const otherItems = parsedP.others.join('; ');
          
          return [
              index + 1,
              date,
              time,
              escape(r.name),
              escape(r.roomNumber),
              escape(r.dpjpName),
              escape(r.raberName),
              escape(r.raber2Name),
              r.isDischarged ? "Pulang" : "Dirawat",
              escape(r.subjective), // S
              escape(r.objective), // O
              escape(r.analysis), // A
              escape(otherItems), // Planning Lain-lain
              escape(labItems), // LAB (Kolom Baru)
              escape(radItems), // RADIOLOGI (Kolom Baru)
              escape(tmItems)   // TINDAKAN (Kolom Baru)
          ].join(",");
      });

      // 3. Gabungkan Header dan Rows
      const csvContent = [headers.join(","), ...rows].join("\n");

      // 4. Trigger Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Data_Pasien_Aktif_${new Date().toLocaleDateString('id-ID')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const stats = useMemo(() => {
      const s = {
          total: records.length,
          active: activeRecords.length,
          discharged: records.filter(r => r.isDischarged).length,
          monthly: {}, // Format: { 'Des 2025': { active, discharged, lab, rad, tm } }
          dpjpCounts: {}, 
          raberData: {}, // Format: { "Nama Dokter": ["Pasien A", "Pasien B"] }
          emptyCount: 0, emptyMale: 0, emptyFemale: 0
      };

      // 1. Logika Statistik Bed (Warna Legend)
      const occupiedRooms = activeRecords.map(r => r.roomNumber);
      ROOM_LIST.forEach(room => {
          if (!occupiedRooms.includes(room)) {
              const roomCode = room.split('B')[0];
              const bedCode = room.split('B')[1];
              if (!bedCode) s.emptyCount++;
              else {
                  const neighborBed = bedCode === '1' ? '2' : '1';
                  const neighborRec = activeRecords.find(r => r.roomNumber === `${roomCode}B${neighborBed}`);
                  if (!neighborRec) s.emptyCount++;
                  else if (neighborRec.gender === 'L') s.emptyMale++;
                  else if (neighborRec.gender === 'P') s.emptyFemale++;
                  else s.emptyMale++; 
              }
          }
      });

      // 2. Logika Bulanan & Hitung Lab/Rad/TM dari Planning
      records.forEach(r => {
          const m = r.createdAt.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
          if (!s.monthly[m]) s.monthly[m] = { active: 0, discharged: 0, lab: 0, rad: 0, tm: 0 };
          
          if (r.isDischarged) s.monthly[m].discharged++;
          else s.monthly[m].active++;

          if (r.planning) {
             const lines = r.planning.split('\n');
             lines.forEach(line => {
                 const t = line.trim().toLowerCase();
                 if (t.startsWith('lab.')) s.monthly[m].lab++;
                 else if (t.startsWith('rad.')) s.monthly[m].rad++;
                 else if (t.startsWith('tm.')) s.monthly[m].tm++;
             });
          }
      });

      // 3. Logika Raber & DPJP (Hanya Pasien Aktif)
      activeRecords.forEach(rec => {
          s.dpjpCounts[rec.dpjpName] = (s.dpjpCounts[rec.dpjpName] || 0) + 1;
          
          const addRaber = (drName, patientName) => {
              if(!drName) return;
              if(!s.raberData[drName]) s.raberData[drName] = [];
              s.raberData[drName].push(patientName);
          };
          addRaber(rec.raberName, rec.name);
          addRaber(rec.raber2Name, rec.name);
      });

      return s;
  }, [records, activeRecords]);

  // --- TAMPILAN DASHBOARD (V3.2 FINAL - LAYOUT BARU) ---
  const renderDashboard = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">
            
            {/* KOLOM KIRI: Filter & Peta Kamar (Lebar 5/12) */}
            <div className="lg:col-span-6 flex flex-col h-[calc(100vh-140px)]">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-2 flex-shrink-0">
                    <div className="mb-2">
                        <h3 className="text-[10px] font-bold text-gray-700 uppercase mb-1">Filter Kamar</h3>
                        <RoomFilterDropdown 
                            allRooms={ROOM_LIST}
                            selectedRooms={selectedRoomFilter}
                            onChange={setSelectedRoomFilter} 
                        />
                    </div>
                    <CustomSelect 
                        label="Filter DPJP" 
                        value={dpjpFilter} 
                        onChange={(e) => setDpjpFilter(e.target.value === 'Semua DPJP' ? '' : e.target.value)} 
                        options={['Semua DPJP', ...dpjpProfiles.map(p => p.name).sort()]} 
                        placeholder="Semua DPJP..." 
                        className="mb-0 text-xs"
                    />
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                        <RoomMap 
                            roomList={ROOM_LIST} 
                            activeRecords={filteredActiveRecords} 
                            onSelectRoom={handleSelectRoom} 
                            onEditRoom={handleEditRoom}
                            roomFilter={selectedRoomFilter}
                            waitingList={waitingList}
                        />
                    </div>
                </div>
            </div>

            {/* KOLOM KANAN: Konten Utama (Scrollable - Lebar 7/12) */}
            <div className="lg:col-span-6 h-[calc(100vh-140px)] overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                
                {/* 1. WAITING LIST (DASHBOARD VIEW - UPDATE) */}
                <div className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden">
                    <div className="bg-indigo-600 px-3 py-2 text-white flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold uppercase tracking-tight">📋 Waiting List</span>
                            <span className="bg-indigo-500 px-2 py-0.5 rounded-full text-[10px] font-mono">{waitingList.length}</span>
                        </div>
                        {/* TOMBOL TAMBAH DI POJOK KANAN HEADER */}
                        <button 
                            onClick={() => setShowWaitingModal(true)} 
                            className="bg-white text-indigo-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-50 transition shadow-sm flex items-center"
                        >
                            <span className="mr-1 text-sm">+</span> Tambah
                        </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto">
                        {waitingList.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 italic text-xs">Belum ada antrean. Klik <b>+ Tambah</b></div>
                        ) : (
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-gray-50 sticky top-0 border-b z-10">
                                    <tr>
                                        <th className="p-2 text-center w-8">No</th>
                                        <th className="p-2">Target</th>
                                        <th className="p-2">Pasien</th>
                                        <th className="p-2">Asal / Kelas</th>
                                        <th className="p-2 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {waitingList.map((w, idx) => (
                                        <tr key={w.id} className="border-b last:border-0 hover:bg-indigo-50 transition group">
                                            <td className="p-2 text-center font-bold text-gray-400">{idx + 1}</td>
                                            <td className="p-2 font-bold text-indigo-700">{w.plannedRoom}</td>
                                            <td className="p-2">
                                                <div className="font-bold text-gray-800">{w.name}</div>
                                                <div className="text-[9px] text-gray-400 truncate max-w-[120px]">{w.diagnosis}</div>
                                            </td>
                                            <td className="p-2">
                                                <div className="font-bold text-gray-700">{w.originRoom || '-'}</div>
                                                {w.insuranceClass && <div className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded border border-blue-100 w-fit">{w.insuranceClass}</div>}
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleMoveToRoom(w)} className="bg-green-600 text-white px-2 py-1 rounded font-bold text-[9px] hover:bg-green-700">Masuk</button>
                                                <button onClick={() => handleDeleteWaiting(w.id)} className="ml-2 text-red-400 opacity-0 group-hover:opacity-100 transition">🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* 2. LEGEND STATUS BED */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center justify-center bg-green-100 border border-green-300 text-green-900 rounded p-2 shadow-sm">
                        <span className="text-[9px] font-bold uppercase">KOSONG</span>
                        <span className="text-xl font-extrabold">{stats.emptyCount}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-orange-100 border border-orange-300 text-orange-900 rounded p-2 shadow-sm">
                        <span className="text-[9px] font-bold uppercase">SISA LK</span>
                        <span className="text-xl font-extrabold">{stats.emptyMale}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-purple-100 border border-purple-300 text-purple-900 rounded p-2 shadow-sm">
                        <span className="text-[9px] font-bold uppercase">SISA PR</span>
                        <span className="text-xl font-extrabold">{stats.emptyFemale}</span>
                    </div>
                </div>

                {/* 3. PASIEN AKTIF PER DPJP (UPDATE: TOMBOL WA LAPOR JUMLAH) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                    <h3 className="font-bold text-gray-700 border-b pb-2 mb-3 text-xs uppercase">Pasien Aktif per DPJP</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(stats.dpjpCounts).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                            <div key={name} className="flex justify-between items-center text-[10px] p-2 bg-gray-50 rounded border border-gray-100 hover:bg-indigo-50 transition group">
                                <span className="truncate pr-1 font-medium text-gray-700">{name}</span>
                                <div className="flex items-center space-x-1">
                                    <span className="font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full min-w-[20px] text-center">{count}</span>
                                    
                                    {/* TOMBOL WA KECIL (Muncul saat hover di laptop, selalu muncul di HP) */}
                                    <button 
                                        onClick={() => handleReportDpjpCount(name, count)}
                                        className="text-[9px] bg-green-100 text-green-700 border border-green-200 p-1 rounded-full hover:bg-green-600 hover:text-white transition opacity-80 group-hover:opacity-100"
                                        title={`Lapor jumlah ke ${name}`}
                                    >
                                        📞
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. RAWAT BERSAMA (UPDATE: TOMBOL WA PENGINGAT) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                    <h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-xs uppercase flex justify-between items-center">
                        <span>🤝 Rawat Bersama (Konsul)</span>
                        <span className="bg-yellow-100 text-yellow-800 px-2 rounded-full text-[9px] font-bold">{Object.keys(stats.raberData).length} Dokter</span>
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(stats.raberData).length === 0 ? (
                             <div className="text-[10px] text-gray-400 italic text-center py-2">Tidak ada konsulan aktif.</div>
                        ) : (
                            Object.entries(stats.raberData).map(([drName, patients]) => (
                                <div key={drName} className="text-[10px] bg-yellow-50 p-2 rounded border border-yellow-100 flex justify-between items-start group">
                                    <div className="flex-1">
                                        <div className="font-bold text-indigo-800 mb-0.5">{drName}</div>
                                        <div className="text-gray-600 leading-tight">({patients.join(', ')})</div>
                                    </div>
                                    
                                    {/* TOMBOL WA RABER */}
                                    <button 
                                        onClick={() => handleReportRaber(drName, patients)}
                                        className="ml-2 text-[9px] bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded hover:bg-green-600 hover:text-white transition flex items-center opacity-80 group-hover:opacity-100"
                                        title={`Ingatkan ${drName} via WA`}
                                    >
                                        <span>📱</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 5. REKAPITULASI BULANAN (SCROLL PALING BAWAH) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-800 px-3 py-2 text-white text-xs font-bold uppercase flex justify-between items-center">
                        <span>📊 Rekapitulasi Bulanan</span>
                    </div>
                    <table className="w-full text-[10px] text-left">
                        <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                            <tr>
                                <th className="p-2">Bulan</th>
                                <th className="p-2 text-center">Aktif</th>
                                <th className="p-2 text-center">Pulang</th>
                                <th className="p-2 text-center text-red-600">Lab</th>
                                <th className="p-2 text-center text-blue-600">Rad</th>
                                <th className="p-2 text-center text-green-600">TM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(stats.monthly).map(([month, data]) => (
                                <tr key={month} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="p-2 font-bold text-indigo-900">{month}</td>
                                    <td className="p-2 text-center">{data.active}</td>
                                    <td className="p-2 text-center">{data.discharged}</td>
                                    <td className="p-2 text-center font-bold">{data.lab}</td>
                                    <td className="p-2 text-center font-bold">{data.rad}</td>
                                    <td className="p-2 text-center font-bold">{data.tm}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Spasi tambahan di bawah agar nyaman di-scroll */}
                <div className="h-10"></div>
            </div>
        </div>
    );
};

  const renderHome = () => {
  const dpjpOptions = ['Semua DPJP', ...dpjpProfiles.map(p => p.name)].sort();     
   
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
            <div className="lg:col-span-3 flex flex-col h-[calc(100vh-140px)]">
                
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3 flex-shrink-0">
                    <h3 className="text-xs font-bold text-gray-700 uppercase mb-2">Filter</h3>                 
                    <CustomSelect 
                        label="DPJP" 
                        value={dpjpFilter} 
                        onChange={(e) => setDpjpFilter(e.target.value === 'Semua DPJP' ? '' : e.target.value)} 
                        options={dpjpOptions} 
                        placeholder="Pilih DPJP..." 
                        className="mb-0"
                    />
                    <div className="mt-2">
                         <div className="flex justify-between items-center mb-1">
                             <label className="block text-[10px] font-bold text-gray-600 uppercase">Kamar</label>
                         </div>
                         <button 
                            onClick={() => setRoomFilterModalOpen(true)}
                            className="w-full p-2 text-sm border border-gray-300 rounded shadow-sm bg-gray-50 text-gray-600 hover:bg-gray-100 transition flex justify-between items-center"
                         >
                             <span>{selectedRoomFilter.length === ROOM_LIST.length ? 'Semua Kamar' : `${selectedRoomFilter.length} Kamar Dipilih`}</span>
                             <span className="text-xs text-indigo-500 font-bold underline">Ubah</span>
                         </button>
                    </div>
                </div>

                <div className="flex-1 min-h-[40vh] mb-4 overflow-hidden">
                    <RoomMap 
                        roomList={ROOM_LIST} 
                        activeRecords={filteredActiveRecords} 
                        onSelectRoom={handleSelectRoom} 
                        onEditRoom={handleEditRoom}
                        roomFilter={selectedRoomFilter}
                    />
                </div>
                {/* DpjpSummary removed from here */}
            </div>

            <div className="lg:col-span-9 h-[calc(100vh-140px)]">
                 <PatientTable 
                    records={filteredActiveRecords} 
                    onEdit={handleEdit} 
                    onPrint={(r) => { setSelectedRecordForPrint(r); }} 
                    onShowLaporModal={setRecordForLapor} 
                    onDischarge={handleDischarge}
                    onBulkPrint={() => setShowBulkPrint(true)}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    handleExportExcel={handleExportExcel} 
                 />
            </div>                            
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
        {/* --- HEADER (REVISI: HAMBURGER MENU + FITUR BARU) --- */}
        <div className="bg-white shadow-sm px-4 h-16 sticky top-0 z-40 border-b flex justify-between items-center max-w-7xl mx-auto">
            
            {/* LOGO KIRI (Gaya Lama Dipertahankan) */}
            <div className="flex flex-col items-center justify-center leading-none text-indigo-800 select-none cursor-default">
                <span className="text-[12px] font-bold tracking-widest">E-</span>
                <span className="text-sm font-bold tracking-tighter uppercase leading-none">ONTANG</span>
                <span className="text-sm font-bold tracking-tighter uppercase leading-none">ANTING</span>
            </div>
            
            {/* MENU KANAN */}
            <div className="flex items-center space-x-3">
                
                {/* 1. JAM DIGITAL (Fitur Baru - Hidden di HP Kecil) */}
                <div className="hidden md:block border-r pr-3 mr-1">
                    <DigitalClock />
                </div>

                {/* 2. TOMBOL LAPORAN SHIFT (Fitur Baru) */}
                <button 
                    onClick={() => {
                        // Pastikan fungsi generateShiftReport sudah dicopy di luar komponen ini
                        const waLink = generateShiftReport(activeRecords, records, waitingList, dpjpProfiles);
                        window.open(`https://wa.me/?text=${waLink}`, '_blank');
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center border border-indigo-200 transition shadow-sm"
                    title="Buat Laporan Dinas ke WA"
                >
                    <span className="mr-1 text-sm">📢</span> Lap. Shift
                </button>

                {/* 3. STATUS ONLINE (Style Lama) */}
                <div className={`hidden sm:block text-[10px] font-bold px-2 py-1 rounded border ${isOnline ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                </div>

                {/* 4. HAMBURGER MENU (Style Lama) */}
                <div className="relative">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md focus:outline-none border border-gray-200 transition"
                    >
                        {/* Icon Hamburger */}
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="px-4 py-2 border-b border-gray-100 bg-indigo-50/50">
                                <p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">Login Sebagai:</p>
                                <p className="text-sm font-bold text-indigo-800">{userRole ? userRole.toUpperCase() : 'GUEST'}</p>
                            </div>
                            
                            {/* Navigasi */}
                            <button onClick={() => { setView('dashboard'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center hover:bg-indigo-50 ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}>
                                <span className="mr-3">🏠</span> Dashboard
                            </button>
                            <button onClick={() => { setView('patient-list'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center hover:bg-indigo-50 ${view === 'patient-list' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}>
                                <span className="mr-3">📋</span> Daftar Pasien
                            </button>
                            <button onClick={() => { setView('ttvmode'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center hover:bg-indigo-50 ${view === 'ttvmode' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}>
                                <span className="mr-3">📊</span> TTV Mode
                            </button>
                            <button onClick={() => { setView('settings'); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center hover:bg-indigo-50 ${view === 'settings' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}>
                                <span className="mr-3">⚙️</span> Setelan
                            </button>
                            
                            {/* Logout */}
                            <button 
                                onClick={onLogout} 
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center font-bold border-t mt-1"
                            >
                                <span className="mr-3">🚪</span> Keluar (Logout)
                            </button>
                        </div>
                    )}
                </div>

                {/* 5. TOMBOL PASIEN BARU (Tetap ada biar cepat) */}
                <button onClick={() => setShowInputModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded shadow-md text-xs font-bold flex items-center transition">
                    <span className="mr-1 text-sm">+</span> Baru
                </button>

            </div>
        </div>

        {/* --- MAIN LAYOUT (ABSOLUTE OVERLAY MODE) --- */}
        <div className="relative flex flex-row max-w-7xl mx-auto lg:h-[calc(100vh-64px)] overflow-hidden">
            
            {/* 1. PANEL INPUT WAITING LIST (OVERLAY KIRI) */}
            <div className={`absolute top-0 left-0 h-full w-full md:w-[400px] z-[60] bg-white transition-transform duration-300 ease-in-out shadow-2xl border-r ${
                showWaitingModal ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <WaitingListInputPanel 
                    show={showWaitingModal}
                    onClose={() => setShowWaitingModal(false)}
                    onAdd={handleAddWaiting}
                    availableRooms={ROOM_LIST}
                    occupiedRooms={occupiedRooms}
                    waitingList={waitingList}
                />
            </div>

            {/* 2. KOLOM KIRI (DASHBOARD / LIST) - SELALU FULL (NO RESIZE) */}
            <div className="w-full h-full flex flex-col overflow-hidden">
                <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                    
                    {/* VIEW 1: DASHBOARD */}
                    {view === 'dashboard' && renderDashboard()}
                    
                    {/* VIEW 2: DAFTAR PASIEN */}
                    {view === 'patient-list' && (
                        <div className="h-full flex flex-col">
                            <PatientTable 
                                records={filteredActiveRecords} 
                                onEdit={handleEdit} 
                                onPrint={(r) => { setSelectedRecordForPrint(r); }} 
                                onShowLaporModal={setRecordForLapor} 
                                onDischarge={handleDischarge}
                                onBulkPrint={() => setShowBulkPrint(true)} 
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                                handleExportExcel={handleExportExcel}
                            />
                        </div>
                    )}
                    
                    {/* VIEW 3: TTV MODE */}
                    {view === 'ttvmode' && (
                        <TtvModeView 
                            records={filteredActiveRecords} 
                            onEdit={() => {}} 
                            onQuickTtv={(rec) => {
                                setQuickTtvTarget(rec);
                                setShowTtvModal(true);
                            }}
                        />
                    )}

                    {/* VIEW 4: SETELAN */}
                    {view === 'settings' && (
                         <div className="bg-white p-6 rounded shadow h-full overflow-y-auto">
                            <h2 className="font-bold text-lg mb-4 text-indigo-800 border-b pb-2">Pengaturan Aplikasi</h2>
                            <div className="mb-6">
                                <h3 className="font-bold text-gray-700 mb-2">Daftar DPJP & Nomor WA</h3>
                                <div className="flex space-x-2 mb-3">
                                    <input type="text" placeholder="Nama Dokter" value={newDpjpName} onChange={(e) => setNewDpjpName(e.target.value)} className="border p-2 rounded text-xs w-1/2" />
                                    <input type="text" placeholder="Nomor WA (08xxx)" value={newDpjpWa} onChange={(e) => setNewDpjpWa(e.target.value)} className="border p-2 rounded text-xs w-1/3" />
                                    <button onClick={handleAddDpjp} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700">+ Tambah</button>
                                </div>
                                <div className="bg-gray-50 border rounded max-h-60 overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-200 text-gray-700 font-bold sticky top-0"><tr><th className="p-2">Nama DPJP</th><th className="p-2">No. WA</th><th className="p-2 text-center">Aksi</th></tr></thead>
                                        <tbody>
                                            {dpjpProfiles.map((p, idx) => (
                                                <tr key={idx} className="border-b last:border-0 hover:bg-white"><td className="p-2">{p.name}</td><td className="p-2 font-mono text-gray-500">{p.waNumber || '-'}</td><td className="p-2 text-center"><button onClick={() => handleRemoveDpjp(p.name)} className="text-red-500 hover:text-red-700 font-bold">Hapus</button></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                         </div>
                    )}
                </div>
            </div>

            {/* 3. PANEL INPUT SOAP (OVERLAY KANAN) */}
            {showInputModal && (
                <div className="absolute top-0 right-0 h-full w-full md:w-[500px] z-50 bg-white shadow-2xl border-l transition-all duration-300">
                    <InputSidePanel 
                        showInputModal={showInputModal} 
                        setShowInputModal={setShowInputModal}
                        handleSubmit={handleSubmit}
                        formData={formData}
                        handleInputChange={handleInputChange}
                        resetForm={resetForm}
                        isEditing={isEditing}
                        currentRecordId={currentRecordId}
                        occupiedRooms={occupiedRooms}
                        availableRooms={ROOM_LIST.filter(r => !occupiedRooms.includes(r) || (isEditing && r === formData.roomNumber)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))}
                        dpjpOptions={dpjpProfiles.map(p => p.name).sort()}
                        showRaber1={showRaber1} setShowRaber1={setShowRaber1}
                        showRaber2={showRaber2} setShowRaber2={setShowRaber2}
                        historyLogs={historyLogs}
                        pullDataForField={pullDataForField}
                        setShowTtvModal={setShowTtvModal}
                        appendText={appendText}
                        handleDischarge={handleDischarge}
                        setSelectedRecordForPrint={setSelectedRecordForPrint}
                        setRecordForLapor={setRecordForLapor}
                        isFormReady={formData.name && formData.roomNumber && formData.dpjpName}
                        loading={loading}
                        ALL_PLANNING_OPTIONS={ALL_PLANNING_OPTIONS}
                    />
                </div>
            )}
        </div>
        
        {/* --- AREA MODAL-MODAL PENDUKUNG (WAJIB ADA DISINI AGAR TOMBOL BERFUNGSI) --- */}
        
        {/* 1. Modal Lapor WA */}
        {recordForLapor && (
            <LaporConfirmationModal
                patientName={recordForLapor.name}
                // Logika pencarian nomor HP yang aman
                dpjpNumber={dpjpProfiles.find(p => p.name === recordForLapor.dpjpName)?.waNumber}
                jagaNumber={jagaGroupLink || DEFAULT_JAGA_LINK} 
                onLaporDpjp={() => handleLapor(recordForLapor, 'DPJP')}
                onLaporJaga={() => handleLapor(recordForLapor, 'Forward')}
                onCancel={() => setRecordForLapor(null)}
            />
        )}

        {/* 2. Modal Print Satuan */}
        {selectedRecordForPrint && (
            <PrintView 
                record={selectedRecordForPrint} 
                closePrint={() => setSelectedRecordForPrint(null)} 
            />
        )}

        {/* 3. Modal Print Banyak */}
        {showBulkPrint && (
            <BulkPrintView 
                records={filteredActiveRecords} 
                onClose={() => setShowBulkPrint(false)} 
            />
        )}

        {/* 4. Modal TTV (Dual Fungsi: Input Form & Direct Save) */}
    {showTtvModal && (
        <TtvModal 
            onClose={() => {
                setShowTtvModal(false);
                setQuickTtvTarget(null); // Reset target
            }} 
            onSave={(text) => {
                if (quickTtvTarget) {
                    // KASUS 1: Input dari TTV Mode (Jalur Cepat) -> Langsung Simpan DB
                    handleSaveQuickTtv(text);
                } else {
                    // KASUS 2: Input dari Form SOAP (Jalur Biasa) -> Tempel ke Form
                    appendText('objective', text);
                    setShowTtvModal(false);
                }
            }} 
        />
    )}

        {confirmDetails.isOpen && (
            <ConfirmationModal 
                title={confirmDetails.title}
                message={confirmDetails.message}
                onConfirm={confirmDetails.action}
                onCancel={closeConfirm}
            />
        )}
    </div>
  );
};
// --- KOMPONEN WAITING LIST (UPDATE: NOMOR URUT & ASAL RUANGAN) ---
const WaitingListView = ({ waitingList, onAdd, onMoveToRoom, onDelete, availableRooms }) => {
    // Tambah state 'originRoom'
    const [newWait, setNewWait] = useState({ name: '', plannedRoom: '', waNumber: '', diagnosis: '', originRoom: '' });

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newWait.name || !newWait.plannedRoom) return alert("Nama dan Rencana Kamar wajib diisi!");
        onAdd(newWait);
        setNewWait({ name: '', plannedRoom: '', waNumber: '', diagnosis: '', originRoom: '' });
    };

    return (
        <div className="flex flex-col h-full gap-4 p-4">
            {/* 1. FORM INPUT ANTREAN */}
            <div className="bg-white p-4 rounded-lg shadow border border-indigo-100 flex-shrink-0">
                <h3 className="font-bold text-indigo-800 border-b pb-2 mb-3 text-sm">📝 Daftar Tunggu (Inden Kamar)</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Rencana Kamar</label>
                        <select 
                            className="w-full p-2 text-xs border rounded"
                            value={newWait.plannedRoom}
                            onChange={e => setNewWait({...newWait, plannedRoom: e.target.value})}
                        >
                            <option value="">- Pilih -</option>
                            {availableRooms.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Nama Pasien</label>
                        <input type="text" className="w-full p-2 text-xs border rounded" placeholder="Nama..." value={newWait.name} onChange={e => setNewWait({...newWait, name: e.target.value})} />
                    </div>
                    {/* INPUT BARU: ASAL RUANGAN */}
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Asal Ruangan</label>
                        <input type="text" className="w-full p-2 text-xs border rounded" placeholder="IGD / Poli..." value={newWait.originRoom} onChange={e => setNewWait({...newWait, originRoom: e.target.value})} />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">No. HP (Opsional)</label>
                        <input type="text" className="w-full p-2 text-xs border rounded" placeholder="08xxx" value={newWait.waNumber} onChange={e => setNewWait({...newWait, waNumber: e.target.value})} />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500">Diagnosa/Ket</label>
                        <input type="text" className="w-full p-2 text-xs border rounded" placeholder="Ket..." value={newWait.diagnosis} onChange={e => setNewWait({...newWait, diagnosis: e.target.value})} />
                    </div>
                    <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded text-xs hover:bg-indigo-700 shadow h-[34px]">+ Catat</button>
                </form>
            </div>

            {/* 2. TABEL DAFTAR TUNGGU */}
            <div className="bg-white rounded-lg shadow border border-gray-200 flex-1 overflow-hidden flex flex-col">
                <div className="bg-indigo-50 p-2 border-b font-bold text-xs text-indigo-900 flex justify-between">
                    <span>List Antrean ({waitingList.length})</span>
                    <span className="text-[10px] font-normal italic text-gray-500">Klik 'Masuk' jika kamar sudah kosong</span>
                </div>
                <div className="overflow-y-auto p-0 custom-scrollbar flex-1">
                    {waitingList.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 italic text-xs">Tidak ada antrean saat ini.</div>
                    ) : (
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-100 text-gray-600 sticky top-0">
                                <tr>
                                    <th className="p-3 w-10 text-center">No</th> {/* KOLOM NOMOR */}
                                    <th className="p-3">Target</th>
                                    <th className="p-3">Nama Pasien</th>
                                    <th className="p-3">Asal & Kontak</th>
                                    <th className="p-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {waitingList.map((w, idx) => (
                                    <tr key={w.id} className="border-b hover:bg-yellow-50 transition">
                                        <td className="p-3 text-center font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-3 font-bold text-indigo-700 bg-indigo-50/30">{w.plannedRoom}</td>
                                        <td className="p-3 font-medium">{w.name}</td>
                                        <td className="p-3">
                                            <div className="font-bold text-[10px] text-gray-700">{w.originRoom || '-'}</div>
                                            <div className="font-mono text-gray-500 text-[10px]">{w.waNumber || '-'}</div>
                                            <div className="text-[9px] text-gray-400 italic truncate max-w-[150px]">{w.diagnosis}</div>
                                        </td>
                                        <td className="p-3 text-center space-x-2">
                                            <button 
                                                onClick={() => onMoveToRoom(w)}
                                                className="px-3 py-1 bg-green-600 text-white rounded shadow hover:bg-green-700 font-bold"
                                                title="Pindahkan ke Dashboard Utama"
                                            >
                                                Masuk ➡️
                                            </button>
                                            <button 
                                                onClick={() => onDelete(w.id)}
                                                className="px-2 py-1 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
// --- TTV MODE: TABEL FLOWSHEET (ALA EXCEL) ---
const TtvModeView = ({ records, onEdit, onQuickTtv }) => {
    // 1. Urutkan Kamar
    const sortedRecords = [...records].sort((a, b) => 
        a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 2. Fungsi Ekstrak Angka dari String Objektif
    // Contoh: "TD 120/80 mmHg..." -> Diambil "120/80" nya saja
    const extractValue = (text, type) => {
        if (!text) return '-';
        const lower = text.toLowerCase();
        // Regex sederhana untuk menangkap angka setelah kata kunci
        let regex;
        if (type === 'td') regex = /td\s*([0-9\/]+)/i;
        else if (type === 'n') regex = /n\s*([0-9]+)/i;
        else if (type === 's') regex = /s\s*([0-9\.]+)/i;
        else if (type === 'rr') regex = /rr\s*([0-9]+)/i;
        else if (type === 'spo2') regex = /spo2\s*([0-9]+)/i;
        
        const match = lower.match(regex);
        return match ? match[1] : '-';
    };

    // 3. Logic Reminder (Sama seperti sebelumnya)
    const getReminder = (planning = '') => {
        const p = planning.toLowerCase();
        const alerts = [];
        if (p.includes('gds') || p.includes('gdp') || p.includes('2jpp')) alerts.push("PUASA");
        if (p.includes('lipid') || p.includes('kolesterol')) alerts.push("PUASA");
        if (p.includes('kontras') || (p.includes('ct scan') && p.includes('kepala'))) alerts.push("PUASA, ureum kreatinin?");
        if (p.includes('whole abdomen') || p.includes('upper')) alerts.push("PUASA");
        if (p.includes('lower') || p.includes('kandung')) alerts.push("KKP/TAHAN PIPIS");
        return alerts;
    };

    // 4. Fungsi Cetak TTV (Format Lembar Observasi)
    const handlePrintTTV = () => {
        const content = document.getElementById('ttv-table-area').innerHTML;
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        printWindow.document.write(`
            <html>
            <head>
                <title>Lembar Observasi TTV</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
                    th, td { border: 1px solid black; padding: 4px; text-align: left; }
                    th { background-color: #f0f0f0; text-align: center; }
                    .center { text-align: center; }
                    .print-hide { display: none; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h2 class="text-center font-bold text-lg mb-4">LEMBAR OBSERVASI TANDA VITAL & RENCANA HARIAN</h2>
                <div class="text-xs mb-2">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
                ${content}
                <script>window.onload = () => window.print();</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header Toolbar */}
            <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-700 uppercase">📊 Tabel Observasi TTV ({sortedRecords.length} Pasien)</h3>
                <button 
                    onClick={handlePrintTTV}
                    className="flex items-center bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-900 transition shadow-sm"
                >
                    <span className="mr-2">🖨️</span> Cetak Lembar Checklist
                </button>
            </div>

            {/* AREA TABEL UTAMA */}
            <div className="flex-1 overflow-auto p-0" id="ttv-table-area">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-indigo-600 text-white sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border border-indigo-500 w-[5%] text-center">Kamar</th>
                            <th className="p-2 border border-indigo-500 w-[20%]">Nama Pasien</th>
                            <th className="p-2 border border-indigo-500 w-[25%]">⚠️ Rencana / Persiapan</th>
                            {/* KOLOM TTV (Ini yang diminta!) */}
                            <th className="p-2 border border-indigo-500 w-[8%] text-center bg-indigo-700">TD</th>
                            <th className="p-2 border border-indigo-500 w-[6%] text-center bg-indigo-700">Nadi</th>
                            <th className="p-2 border border-indigo-500 w-[6%] text-center bg-indigo-700">Suhu</th>
                            <th className="p-2 border border-indigo-500 w-[6%] text-center bg-indigo-700">RR</th>
                            <th className="p-2 border border-indigo-500 w-[6%] text-center bg-indigo-700">SpO2</th>
                            <th className="p-2 border border-indigo-500 w-[10%] text-center no-print">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-700">
                        {sortedRecords.map((rec, idx) => {
                            const alerts = getReminder(rec.planning);
                            // Ekstrak data real-time dari kolom O
                            const td = extractValue(rec.objective, 'td');
                            const n = extractValue(rec.objective, 'n');
                            const s = extractValue(rec.objective, 's');
                            const rr = extractValue(rec.objective, 'rr');
                            const spo2 = extractValue(rec.objective, 'spo2');

                            return (
                                <tr key={rec.id} className={`border-b hover:bg-yellow-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                    {/* KAMAR */}
                                    <td className="p-2 border border-gray-200 text-center font-bold text-indigo-700">
                                        {rec.roomNumber}
                                    </td>
                                    
                                    {/* NAMA */}
                                    <td className="p-2 border border-gray-200 font-bold">
                                        {rec.name}
                                        <div className="text-[9px] text-gray-500 font-normal">{rec.dpjpName.split(',')[0]}</div>
                                    </td>

                                    {/* RENCANA (REMINDER) */}
                                    <td className="p-2 border border-gray-200">
                                        {alerts.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {alerts.map((a, i) => (
                                                    <span key={i} className="bg-red-100 text-red-700 px-1 rounded text-[9px] font-extrabold border border-red-200 animate-pulse">
                                                        {a}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        <div className="truncate w-48 text-[9px] text-gray-500 italic">
                                            {rec.planning ? rec.planning.replace(/\n/g, ' ') : '-'}
                                        </div>
                                    </td>

                                    {/* KOLOM TTV (Data Dipecah) */}
                                    <td className="p-2 border border-gray-200 text-center font-mono font-bold text-blue-700">{td}</td>
                                    <td className="p-2 border border-gray-200 text-center font-mono">{n}</td>
                                    <td className="p-2 border border-gray-200 text-center font-mono">{s}</td>
                                    <td className="p-2 border border-gray-200 text-center font-mono">{rr}</td>
                                    <td className="p-2 border border-gray-200 text-center font-mono">{spo2}</td>

                                    {/* AKSI (Tombol Input) */}
                                    <td className="p-2 border border-gray-200 text-center no-print">
                                        <button 
                                            onClick={() => onQuickTtv(rec)} 
                                            className="px-2 py-1 bg-green-100 text-green-700 rounded border border-green-300 hover:bg-green-200 text-[10px] font-bold shadow-sm"
                                        >
                                            + Input TTV
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Baris Kosong untuk Print Manual (Opsional) */}
                        <tr className="print-only hidden">
                            <td className="p-4 border"></td><td className="p-4 border"></td><td className="p-4 border"></td>
                            <td className="p-4 border"></td><td className="p-4 border"></td><td className="p-4 border"></td>
                            <td className="p-4 border"></td><td className="p-4 border"></td><td className="p-4 border"></td>
                        </tr>
                    </tbody>
                </table>
                
                {sortedRecords.length === 0 && (
                    <div className="p-10 text-center text-gray-400 italic">Tidak ada pasien aktif.</div>
                )}
            </div>
            
            <div className="p-2 bg-yellow-50 text-[10px] text-yellow-800 text-center border-t border-yellow-200 no-print">
                💡 <b>Tips:</b> Klik tombol "Cetak Lembar Checklist" untuk print tabel kosong dan isi manual saat keliling (Visite).
            </div>
        </div>
    );
};
// --- RUMUS VISUAL TAGS ---
const formatTags = (text) => {
  if (!text) return "-";
  return text.split('\n').map((line, idx) => {
    let style = "block mb-1 "; // Dasar: Tiap baris dikasih jarak dikit
    const lower = line.toLowerCase();

    // Logika Deteksi Warna
    if (lower.includes('lab') || lower.includes('darah') || lower.includes('urine')) {
      style += "bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded w-fit border border-yellow-200"; // Kuning
    } else if (lower.includes('rad') || lower.includes('rontgen') || lower.includes('ct') || lower.includes('usg')) {
      style += "bg-blue-100 text-blue-800 px-2 py-0.5 rounded w-fit border border-blue-200"; // Biru
    } else if (lower.includes('terapi') || lower.includes('rx') || lower.includes('obat') || lower.includes('inj')) {
      style += "bg-green-100 text-green-800 px-2 py-0.5 rounded w-fit border border-green-200"; // Hijau
    } else if (lower.includes('lacak') || lower.includes('konsul') || lower.includes('plan')) {
      style += "bg-red-100 text-red-800 px-2 py-0.5 rounded w-fit font-bold border border-red-200"; // Merah
    }

    return <span key={idx} className={style}>{line}</span>;
  });
};
// --- PANEL INPUT WAITING LIST (REVISI: DENGAN WARNA KAMAR) ---
const WaitingListInputPanel = ({ show, onClose, onAdd, availableRooms, occupiedRooms = [], waitingList = [] }) => {
    if (!show) return null;
    
    const [form, setForm] = useState({ 
        name: '', plannedRoom: '', originRoom: '', 
        insuranceClass: '', waNumber: '', diagnosis: '' 
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name || !form.plannedRoom) return alert("Nama dan Rencana Kamar wajib diisi!");
        onAdd(form);
        // Reset Form
        setForm({ name: '', plannedRoom: '', originRoom: '', insuranceClass: '', waNumber: '', diagnosis: '' });
        onClose();
    };

    return (
        <div className="flex flex-col h-full bg-white shadow-2xl border-r border-indigo-200">
            {/* Header Panel */}
            <div className="p-4 bg-indigo-700 text-white flex justify-between items-center shadow-md">
                <h3 className="font-bold text-sm">📝 Input Antrean Baru</h3>
                <button onClick={onClose} className="text-white hover:bg-white/20 w-6 h-6 rounded-full flex items-center justify-center font-bold">✕</button>
            </div>

            {/* Form Scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Kamar</label>
                    <select 
                        className="w-full p-2 text-xs border rounded bg-indigo-50 outline-none font-bold" 
                        value={form.plannedRoom} 
                        onChange={e => setForm({...form, plannedRoom: e.target.value})}
                    >
                        <option value="">- Pilih Kamar -</option>
                        {availableRooms.map(r => {
                            // LOGIKA CEK STATUS KAMAR
                            const isOccupied = occupiedRooms.includes(r);
                            const isBooked = waitingList.some(w => w.plannedRoom === r);
                            
                            let label = `${r} (Kosong)`;
                            let style = { color: 'green' };

                            if (isOccupied) {
                                label = `${r} (🔴 Terisi)`;
                                style = { color: 'red' };
                            } else if (isBooked) {
                                label = `${r} (🟡 Ada Antrean)`;
                                style = { color: '#b45309' }; // Cokelat/Kuning Gelap
                            }

                            return <option key={r} value={r} style={style}>{label}</option>
                        })}
                    </select>
                    <p className="text-[9px] text-gray-400 mt-1 italic">*Pilih kamar meskipun terisi/antre untuk masuk daftar tunggu.</p>
                </div>
                
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Pasien</label>
                    <input type="text" className="w-full p-2 text-xs border rounded outline-none" placeholder="Nama lengkap..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Asal Ruangan</label>
                        <input type="text" className="w-full p-2 text-xs border rounded outline-none" placeholder="IGD / Poli..." value={form.originRoom} onChange={e => setForm({...form, originRoom: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kelas / BPJS</label>
                        <select className="w-full p-2 text-xs border rounded outline-none" value={form.insuranceClass} onChange={e => setForm({...form, insuranceClass: e.target.value})}>
                            <option value="">- Pilih -</option>
                            <option value="BPJS Kls 1">BPJS Kls 1</option>
                            <option value="BPJS Kls 2">BPJS Kls 2</option>
                            <option value="BPJS Kls 3">BPJS Kls 3</option>
                            <option value="Umum/Asuransi">Umum/Asuransi</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">No. HP / WA</label>
                    <input type="text" className="w-full p-2 text-xs border rounded outline-none" placeholder="08xxx..." value={form.waNumber} onChange={e => setForm({...form, waNumber: e.target.value})} />
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Diagnosa / Ket</label>
                    <textarea rows="3" className="w-full p-2 text-xs border rounded outline-none resize-none" placeholder="Diagnosa medis..." value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})}></textarea>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end space-x-2">
                <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 font-bold hover:bg-gray-200 rounded transition">Batal</button>
                <button onClick={handleSubmit} className="px-6 py-2 text-xs bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700 transition">Simpan Antrean</button>
            </div>
        </div>
    );
};
// --- INPUT SIDE PANEL (VERSI FINAL - DENGAN TOMBOL WA DI RIWAYAT & SIMPAN DI ATAS) ---
const InputSidePanel = ({
    showInputModal, setShowInputModal, handleSubmit, formData, handleInputChange,
    resetForm, isEditing, currentRecordId, occupiedRooms, availableRooms, dpjpOptions,
    showRaber1, setShowRaber1, showRaber2, setShowRaber2, historyLogs,
    pullDataForField, setShowTtvModal, appendText, handleDischarge, setSelectedRecordForPrint,
    setRecordForLapor, isFormReady, loading, ALL_PLANNING_OPTIONS
}) => {
    if (!showInputModal) return null;
    
    const lacakOptions = [...LAB_CHECKS, ...RADIOLOGY_CHECKS].sort();

    // Fungsi Helper Tombol Bawah (Footer)
    const handleQuickAction = (action) => {
        const tempRec = { 
            ...formData, 
            id: currentRecordId || 'temp',
            roomNumber: formData.roomNumber,
            name: formData.name,
            dpjpName: formData.dpjpName
        };

        if (action === 'print') setSelectedRecordForPrint(tempRec);
        if (action === 'lapor') setRecordForLapor(tempRec);
        if (action === 'discharge') handleDischarge(currentRecordId, formData.name);
    };

    return (
        <div className="h-full bg-white border-l border-gray-300 flex flex-col shadow-xl">
            {/* 1. HEADER (REVISI: PUTIH & ADA TOMBOL SIMPAN) */}
            <div className="px-4 py-3 border-b flex justify-between items-center bg-white shadow-sm z-10 flex-shrink-0">
                <div>
                    <h2 className="font-bold text-sm text-gray-800">{isEditing ? `Edit: ${formData.name}` : 'Pasien Baru'}</h2>
                    <p className="text-[10px] text-gray-400">{isEditing ? 'Perbarui data' : 'Input awal'}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {/* TOMBOL SIMPAN UTAMA (PINDAH KESINI) */}
                    <button 
                        onClick={handleSubmit} 
                        disabled={loading || !isFormReady} 
                        className={`px-4 py-1.5 rounded text-xs font-bold text-white shadow-sm transition flex items-center ${loading || !isFormReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        {loading ? '...' : '💾 SIMPAN'}
                    </button>
                    <button onClick={() => { setShowInputModal(false); resetForm(); }} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 flex items-center justify-center font-bold transition">✕</button>
                </div>
            </div>
            
            {/* 2. AREA SCROLL */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-gray-50/50">
                
                {/* A. FORM INPUT (ATAS) */}
                <div className="p-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-3">
                        <form onSubmit={handleSubmit} id="mainForm">
                            
                            {/* Identitas */}
                            <div className="flex space-x-2 mb-2">
                                <div className="w-[25%]"><CustomSelect label="Km" value={formData.roomNumber} onChange={(e) => handleInputChange({ target: { name: 'roomNumber', value: e.target.value } })} options={availableRooms} disabled={isEditing} /></div>
                                <div className="w-[25%]">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Gender *</label>
                                    <select className="w-full p-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white" value={formData.gender} onChange={(e) => handleInputChange({ target: { name: 'gender', value: e.target.value } })} required>
                                        <option value="" disabled>-</option><option value="L">Lk</option><option value="P">Pr</option>
                                    </select>
                                </div>
                                <div className="w-[50%]"><CustomInput label="Nama Pasien" name="name" value={formData.name} onChange={handleInputChange} disabled={isEditing} /></div>
                            </div>

                            {/* DPJP & Raber Section */}
                            <div className="mb-2">
                                <div className="flex space-x-2 mb-1">
                                    {/* DPJP Utama */}
                                    <div className="w-1/2">
                                        <CustomSelect 
                                            label="DPJP Utama" 
                                            value={formData.dpjpName} 
                                            onChange={(e) => handleInputChange({ target: { name: 'dpjpName', value: e.target.value } })} 
                                            options={dpjpOptions} 
                                        />
                                    </div>
                                    
                                    {/* Raber 1 */}
                                    <div className="w-1/2">
                                        {showRaber1 ? (
                                            <div className="relative">
                                                <CustomSelect 
                                                    label="Raber 1" 
                                                    value={formData.raberName} 
                                                    onChange={(e) => handleInputChange({ target: { name: 'raberName', value: e.target.value } })} 
                                                    options={dpjpOptions} 
                                                />
                                                <button type="button" onClick={() => { setShowRaber1(false); handleInputChange({ target: { name: 'raberName', value: '' } }); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition">✕</button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => setShowRaber1(true)} className="text-[10px] mt-6 text-blue-600 underline font-bold hover:text-blue-800 transition">+ Tambah Raber 1</button>
                                        )}
                                    </div>
                                </div>

                                {/* Raber 2 */}
                                {showRaber1 && (
                                    <div className="flex space-x-2">
                                        <div className="w-1/2"></div>
                                        <div className="w-1/2">
                                            {showRaber2 ? (
                                                <div className="relative">
                                                    <CustomSelect label="Raber 2" value={formData.raber2Name} onChange={(e) => handleInputChange({ target: { name: 'raber2Name', value: e.target.value } })} options={dpjpOptions} />
                                                    <button type="button" onClick={() => { setShowRaber2(false); handleInputChange({ target: { name: 'raber2Name', value: '' } }); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition">✕</button>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => setShowRaber2(true)} className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition">+ Tambah Raber 2</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* SOAP Fields */}
                    <div className="space-y-3">
                        <CustomTextArea label="S (Subjektif)" name="subjective" value={formData.subjective} onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('subjective') : null} pullLabel="Salin S Lalu" />
                        
                        <CustomTextArea label="O (Objektif)" name="objective" value={formData.objective} onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('objective') : null} pullLabel="Salin O Lalu"
                            extraButtons={<button type="button" onClick={() => setShowTtvModal(true)} className="text-[9px] bg-green-100 text-green-700 px-2 rounded border border-green-300 font-bold hover:bg-green-200">+ TTV</button>} 
                        >
                            <div className="mb-1">
                                <TagSelector label="" options={lacakOptions} placeholder="Lacak Lab/Rad..." category="Lacak" onSelect={(_, item) => appendText('objective', `Lacak ${item}`)} />
                            </div>
                        </CustomTextArea>

                        <CustomTextArea label="A (Analisa)" name="analysis" value={formData.analysis} onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('analysis') : null} pullLabel="Salin A Lalu" />
                        
                        <CustomTextArea label="P (Planning)" name="planning" value={formData.planning} onChange={handleInputChange}>
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded relative z-0">
                                <TagSelector label="Smart Planning" placeholder="Ketik Lab, Rad, Obat..." options={ALL_PLANNING_OPTIONS.map(o => o.label)} category="SmartPlan"
                                    onSelect={(cat, itemLabel) => {
                                        const found = ALL_PLANNING_OPTIONS.find(o => o.label === itemLabel);
                                        const type = found ? found.type : 'Rx';
                                        let prefix = type === 'Lab' ? 'Lab. R/ ' : type === 'Rad' ? 'Rad. R/ ' : type === 'Med' ? 'TM. ' : 'Th. ';
                                        appendText('planning', `${prefix}${itemLabel}`);
                                    }} 
                                />
                            </div>
                        </CustomTextArea>
                    </div>
                </div>

                {/* B. RIWAYAT (BAWAH) - TETAP ADA TOMBOL WA */}
                <div className="bg-gray-100 border-t border-gray-300 flex-1 flex flex-col min-h-[300px]">
                    <div className="p-3 bg-gray-200 border-b border-gray-300 shadow-inner">
                        <h3 className="text-[10px] font-bold text-gray-600 uppercase flex justify-between items-center">
                            <span>🕒 Riwayat Catatan ({historyLogs.length})</span>
                            <span className="text-[9px] font-normal italic text-gray-500">Scroll untuk melihat yg lama ⬇</span>
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-100">
                        {historyLogs && historyLogs.length > 0 ? (
                            historyLogs.map((log, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-300 text-[11px] shadow-sm relative group hover:border-indigo-300 transition">
                                    <div className="flex justify-between items-center mb-2 border-b pb-1 border-dashed border-gray-200">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">#{historyLogs.length - idx}</span>
                                            <span className="text-[9px] text-gray-400 font-mono">
                                                {log.updatedAt && log.updatedAt.seconds 
                                                    ? new Date(log.updatedAt.seconds * 1000).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                                    : log.updatedAt instanceof Date 
                                                        ? log.updatedAt.toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                                        : 'Baru saja'}
                                            </span>
                                        </div>
                                        {/* TOMBOL WA DI RIWAYAT (DIPERTAHANKAN) */}
                                        <button 
                                            type="button" 
                                            onClick={() => setRecordForLapor(log)} 
                                            className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded text-[9px] font-bold hover:bg-green-200 flex items-center transition"
                                            title="Lapor catatan ini ke WA"
                                        >
                                            <span className="mr-1">📱</span> WA
                                        </button>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">S:</span> <span className="text-gray-700">{log.subjective || '-'}</span></div>
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">O:</span> <span className="text-gray-700">{log.objective || '-'}</span></div>
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">A:</span> <span className="text-gray-700">{log.analysis || '-'}</span></div>
                                        <div className="mt-1">
                                            <div className="flex gap-2 mb-1"><span className="font-bold text-red-600 w-3 shrink-0">P:</span></div>
                                            <div className="pl-5 p-1.5 bg-gray-50 rounded border border-gray-200 text-gray-600 font-mono text-[10px] whitespace-pre-wrap">{log.planning || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400 text-[10px] italic">Belum ada riwayat tercatat...</div>
                        )}
                        <div className="h-10"></div>
                    </div>
                </div>
            </div>

            {/* 3. FOOTER TOMBOL (Draft, Print, Plg - DIPERTAHANKAN) */}
            <div className="p-3 border-t bg-white flex justify-between items-center flex-shrink-0">
                <div className="flex space-x-1">
                    {isEditing && (
                        <>
                            <button type="button" onClick={() => handleQuickAction('lapor')} className="px-3 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded text-[10px] font-bold hover:bg-green-100 transition flex items-center" title="Lapor Draft Saat Ini">
                                <span className="mr-1">📱</span> Draft
                            </button>
                            <button type="button" onClick={() => handleQuickAction('print')} className="px-3 py-1.5 bg-gray-100 text-gray-700 border border-gray-300 rounded text-[10px] font-bold hover:bg-gray-200 transition flex items-center">
                                <span className="mr-1">🖨️</span> Print
                            </button>
                            <button type="button" onClick={() => handleQuickAction('discharge')} className="px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded text-[10px] font-bold hover:bg-red-200 transition flex items-center">
                                <span className="mr-1">🚪</span> Plg
                            </button>
                        </>
                    )}
                </div>
                {/* Tombol Batal tetap di bawah sebagai alternatif */}
                <button onClick={() => { setShowInputModal(false); resetForm(); }} className="px-4 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">Batal</button>
            </div>
        </div>
    );
};

const App = () => {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [userRole, setUserRole] = useState(null);

// --- FUNGSI BARU UNTUK MENGAMBIL ROLE ---
const fetchUserRole = async (userEmail, db) => {
    if (!userEmail || !db) return null;
    
    try {
        const userProfilesRef = collection(db, 'userProfiles');
        // Cari dokumen di mana field 'email' sama dengan email pengguna yang login
        const q = query(userProfilesRef, where('email', '==', userEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Jika profil ditemukan, kembalikan field 'role'
            const userData = querySnapshot.docs[0].data();
            return userData.role || 'user'; // Default ke 'user' jika role tidak ditemukan
        }
        return 'guest'; // Jika profil tidak ditemukan sama sekali
        
    } catch (e) {
        console.error("Error fetching user role:", e);
        return 'guest';
    }
};

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let firestoreInstance;
    try {
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      firestoreInstance = getFirestore(app);
      
      setDb(firestoreInstance);
      setIsOfflineReady(true);

      const unsubscribe = onAuthStateChanged(auth, async (u) => { 
        setUserId(u ? u.uid : null); 
        setIsAuthReady(true);
        if (u) {
            try {
                const userProfilesRef = collection(firestoreInstance, 'userProfiles');
                const q = query(userProfilesRef, where('email', '==', u.email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    setUserRole(userData.role || 'user');
                    console.log("Role loaded:", userData.role);
                } else {
                    setUserRole('guest');
                }
            } catch (e) {
                console.error("Error fetching role:", e);
                setUserRole('guest');
            }
        } else {
            setUserRole(null); 
        }
      }); 

      return () => unsubscribe();

    } catch (e) { 
        console.error("Firebase Initialization Error:", e);
        setIsAuthReady(true); 
    }

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

 // --- GATE LOGIN CHECK YANG BENAR ---
  
  // 1. Jika User BELUM Login (userId kosong), Tampilkan Login Page
  if (!userId) {
      return <LoginPage />;
  }

  // 2. Jika Sedang Loading
  if (!isAuthReady || !db || !isOfflineReady) 
    return <div className="flex h-screen items-center justify-center text-indigo-600 font-bold animate-pulse">Memuat Aplikasi...</div>;
   
  

  // 3. Jika SUDAH Login (userId ada), Buka Aplikasi Utama
  return (
    <MedicalRecordApp 
        db={db} 
        userId={userId} 
        appId={firebaseConfig.appId} 
        isOnline={isOnline} 
        onLogout={() => signOut(getAuth())}
        userRole={userRole} 
    />
  );
};

export default App;