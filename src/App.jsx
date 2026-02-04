import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// --- DATA STATIS ---

const ROOM_LIST = [
  'K1B1', 'K1B2', 'K2B1', 'K2B2', 'K3B1', 'K3B2', 'K4B1', 'K4B2', 'K5B1', 'K5B2',
  'K6B1', 'K6B2', 'K7B1', 'K8B1', 'K9B1', 'K10B1', 'K10B2', 'K11B1',
  'K12B1', 'K13B1', 'K13B2', 'K14B1', 'K15B1', 'K15B2'
];


const DEFAULT_DPJP_DATA = [
    { name: 'dr. Delvi, Sp.PD', waNumber: '6281283812875' },
    { name: 'dr. Susilo, Sp.PD', waNumber: '6282119395835' },
    { name: 'dr. Dian Ekowati, Sp.PD', waNumber: '6281210680279' },
    { name: 'dr. Priyo, Sp.PD', waNumber: '62811220364' },
    { name: 'dr. Risa, Sp.PD', waNumber: '6281316198500' },
    { name: 'dr. Evan, Sp.P', waNumber: '6281210100626' },
    { name: 'dr. Evi, Sp.JP', waNumber: '628112223938' },
    { name: 'dr. Iman, Sp.JP', waNumber: '6281395546887' },
    { name: 'dr. Murti, Sp.S', waNumber: '6281383315383' },
    { name: 'dr. Zuhaira, Sp.S', waNumber: '6282121992620' },
    { name: 'dr. Ganda, Sp.N', waNumber: '6282121759729' },
    { name: 'dr. Agam, Sp.B', waNumber: '6282218321999' },
    { name: 'dr. Daniel, Sp.B', waNumber: '6281398906655' },
    { name: 'dr. Irwan, Sp.B', waNumber: '6285721483198' },
    { name: 'dr. Eka, Sp.OT', waNumber: '6281380733477' },
    { name: 'dr. Gamal, Sp.OT', waNumber: '6281312208478' },
    { name: 'dr. Andre, Sp.BS', waNumber: '6287822462203' },
    { name: 'dr. Joko, Sp.U', waNumber: '6281322819326' },
    { name: 'dr. Huda, Sp.OG', waNumber: '628112294881' },
    { name: 'dr. Sella, Sp.OG', waNumber: '6282226862504' },
    { name: 'dr. Sri Siswanti, Sp.Kk', waNumber: '6281227153161' },
    { name: 'dr. Dian Maifara, Sp.BM', waNumber: '62811119879' },
];

const initialDpjpProfiles = DEFAULT_DPJP_DATA;

const LAB_CHECKS = [
    'Darah Rutin', 'HJL', 'Masa Pendarahan (BT/CT)', 'CA125', 'PT/APTT/INR',
    'GDS', 'GDP/2JPP', 'HbA1c', 'TSH/FT4', 'Procalcitonin', 'Ferritin', 'D-Dimer',
    'Ureum/Creatinin', 'SGOT/SGPT', 'Albumin/Globulin', 'Bilirubin Total/Direk',
    'Elektrolit (Na/K/Cl)', 'Calsium', 'Analisa Gas Darah (AGD)', 'Lactate', 'IgG//igM Cikungunya',
    'Hemokultur', 'Darah Tepi', 'LED', 'PCR Covid-19', 'Swab Antigen', 'Rapid Test Covid-19',
    'Sero Dengue (NS1)', 'Malaria (Tetesan Darah)', 'Widal Test', 'Fungsi Tiroid Lengkap',
    'Fungsi Hati Lengkap', 'Fungsi Ginjal Lengkap', 'Panel Lipid Lengkap',
    'Profil Lipid (Kolesterol)', 'Asam Urat', 'Sputum', 'CD4', 'igG/igM Dengue', 'igG/igM Leptospirosis',
    'Urin', 'Feses', 'Kultur Darah', 'TCM TB', 'HBsAg/Anti-HBs/Anti-HCV/Anti-HIV',
    'Troponin T/I', 'CK-MB', 'Tubex', 'Titer Widal', 'CRP Kuantitatif', 'ProBNP', 'SADT'
    
];

const RADIOLOGY_CHECKS = [
    'Thorax PA/AP', 'Thorax Lateral', 'BNO 3 Posisi', 'Lumbosacral', 'Cervical', 'Foto Ekstremitas',
    'USG Whole Abdomen', 'USG Upper Abdomen', 'USG Lower Abdomen', 'USG Thorax', 'USG Tiroid', 'USG Ginjal', 'USG Kandung Empedu', 'USG Jantung',
    'CT Scan Kepala Kontras', 'CT Scan Kepala non-Kontras', 'CT Scan Thorax Kontras', 'CT Scan Paru non-Kontras', 'CT Scan Abdomen kontras',
    'CT Scan Abdomen non-kontras', 'CT Scan Vertebra', 'CT Angiography', 'CT Scan Cardiac',
    'MRI Kepala', 'MRI Vertebra', 'MRI Lutut', 'MRI Pelvis',
    'Echocardiography', 'Endoskopi', 'Kolonoskopi', 'Bronkoskopi', 'Angiography Koroner'
];

const PROCEDURES = [
    'Pasang Infus', 'Pasang Kateter', 'Pasang NGT', 'Nebulizer', 'Oksigenasi', 'Pemasangan Ventilator',
    'EKG', 'Ganti Balutan', 'Suction', 'Injeksi Extra', 'Syringe Pump', 'Hemodialisa (HD)', 
    'Rawat Luka', 'Angkat Jahitan', 'Spooling NGT', 'Spooling Kateter', 'Bladder Training', 'Biopsi Sumsum Tulang',
    'Parasintesis', 'Torakosintesis', 'Pungsi Efusi Pleura', 'Pungsi Ascites', 'Pungsi Lumbal', 'Aspirasi Sendi',
    'Nefrostomi', 'Trakeostomi', 'Debridemen', 'Monitor UOP'
];
const MEDICATIONS = [
    'Koreksi KCL  mEq +  500 ml/8 Jam,  siklus on ke', 'Koreksi Meylon  mEq + Ns  100 ml/j', 'Koreksi CaGluconas  gr + D5 100ml', 'Bolus Novorapid 10 iu + D40 2 flash',
    'Drip Insulin/Novorapid  iu/j', 'Drip Lasix  cc/j', 'Drip Nicardipine  mcg, Kec.  cc/j, Bb  kg', 'Drip Norepinephrine  mcg, Kec.  cc/j, Bb  kg',
    'Drip Amiodarone', 'Drip Fentanyl', 'Injeksi Extra Lasix', 'Trnfs  PRC, on ke , post ke , premed: , Postmed:', 'Trnfs  TC, on ke , post ke , premed: , Postmed:',
    '3 Way', '2 Line Infus', 'Trnfs Albumin', 'Drip Heparin', 'Drip Dopamine  mcg, Kec.  cc/j, Bb  kg', 'Drip Dobutamine  mcg, Kec.  cc/j, Bb  kg', 'Drip Epinephrine  mcg, Kec.  cc/j, Bb  kg'
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
const LoginPage = () => {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row md:overflow-hidden md:max-h-[600px] h-auto">
        
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
        <div className="w-full md:w-1/2 p-6 md:p-10 bg-white flex flex-col justify-center">
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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

// --- COMPONENT PRINT LAYOUT (VERSI FINAL: AUTO-COMPACT / P NAIK KE ATAS) ---
const PrintLayout = ({ record }) => {
    if (!record) return null;

    // Helper Tanggal Besok
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'numeric', year: 'numeric'
    });

    // Helper Memilah Isi Planning
    const { others, labs, rads, tms, rxs } = useMemo(() => {
        if (!record.planning) return { others: [], labs: [], rads: [], tms: [], rxs: [] };
        
        // GUNAKAN HELPER parsePlanning YANG SUDAH KITA BUAT DI GLOBAL
        // (Pastikan fungsi parsePlanning ada di atas komponen ini di App.jsx)
        return parsePlanning(record.planning);
    }, [record.planning]);

    const hasSubjective = record.subjective && record.subjective !== '-' && record.subjective.trim() !== '';

    // --- UPDATE 1: HIGHLIGHT (BLPL/PUASA) JADI text-xs (12px) ---
    const renderHighlightedOthers = (textArray) => {
        return textArray.map((line, idx) => {
            const lower = line.toLowerCase();
            
            // 1. KELOMPOK HORE (BLPL)
            const dischargeKeywords = ['blpl', 'rblpl', 'pulang', 'boleh pulang', 'aps'];
            if (dischargeKeywords.some(k => lower.includes(k))) {
                return (
                    // GANTI text-[10px] JADI text-xs
                    <div key={idx} className="font-bold border border-black bg-gray-100 px-1 py-0.5 my-1 rounded text-black text-xs leading-tight w-fit">
                        🎉 {line.toUpperCase()}
                    </div>
                );
            }

            // 2. KELOMPOK WASPADA (PUASA/LAB/KONSUL)
            const alertKeywords = [
                'lab', 'radiologi', 'rontgen', 'usg', 'ct-scan', 'mri', 
                'cek darah', 'konsul', 'puasa', 'operasi', 'cito', 'hd', 'hemodialisa'
            ];
            
            if (alertKeywords.some(k => lower.includes(k))) {
                return (
                    // GANTI text-[10px] JADI text-xs
                    <div key={idx} className="font-bold border border-black bg-gray-100 px-1 py-0.5 my-1 rounded text-black text-xs leading-tight w-fit">
                        ⚠️ {line.toUpperCase()}
                    </div>
                );
            }

            return <div key={idx} className="my-0.5">{line}</div>;
        });
    };

    return (
        // Container Utama Print
        <div className="bg-white p-0 text-sm font-sans leading-snug text-black h-full flex flex-col">
            
            {/* Header: DPJP & Raber */}
            <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2 shrink-0">
                <div className="flex-1">
                    <div className="font-bold text-lg uppercase tracking-wide flex items-center gap-2">
                        <span className="text-sm font-bold border-2 border-black px-2 py-0.5"> 
                            {record.roomNumber ? record.roomNumber.split('B')[0] : ''}
                        </span>
                        <span>{record.name}</span>
                    </div>
                    <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-4">
                        <span className="font-bold">DPJP: {record.dpjpName}</span>
                        {(record.raberName || record.raber2Name) && (
                            <span className="text-gray-600 font-medium italic">
                                Raber: {[record.raberName, record.raber2Name].filter(Boolean).join(', ')}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold text-xs">{dateString}</div>
                </div>
            </div>

            {/* Layout Grid Dua Kolom */}
            {/* Pakai 'items-stretch' agar garis tengah (border-r) selalu full height sampai bawah */}
            <div className="grid grid-cols-2 gap-4 flex-1 items-stretch">
                
                {/* --- KOLOM KIRI: A & P (LOGIKA BARU: TIDAK ADA FLEX-1) --- */}
                <div className="border-r-2 border-gray-300 pr-2 flex flex-col">
                    
                    {/* BAGIAN A (ANALISA) - Height: Auto (Seperlunya) */}
                    <div className="mb-2">
                        <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">A (ANALISA)</div>
                        <div className="whitespace-pre-wrap font-sans mb-1 pl-1">{record.analysis || '-'}</div>
                    </div>

                    {/* BAGIAN P (PLANNING) - Langsung Menempel di Bawah A */}
                    {/* Menggunakan border-t dashed sebagai pemisah */}
                    <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-1">
                        <div className="font-bold underline mb-2 bg-gray-100 inline-block px-1 text-xs">P (PLANNING)</div>
                        
                        <div className="font-sans pl-1">
                            {/* 1. Teks Manual (Yang akan di-Highlight) */}
                            {others.length > 0 && (
                                <div className="mb-3 leading-relaxed whitespace-pre-wrap">
                                    {renderHighlightedOthers(others)}
                                </div>
                            )}

                            {/* 2. Item Smart Planning - VERSI FIX FONT SIZE (text-xs) */}
                            {(labs.length > 0 || rads.length > 0 || tms.length > 0 || rxs.length > 0) && (
                                // HAPUS text-[10px] di container ini
                                <div className="space-y-1 mt-2 border-t border-dotted border-gray-400 pt-2 text-xs"> 
                                    
                                    {/* LAB */}
                                    {labs.length > 0 && (
                                        // Hapus text-[10px], biarkan mewarisi text-xs dari container
                                        <div className="flex items-start bg-gray-100 border border-black px-1 py-0.5 rounded w-fit max-w-full leading-tight">
                                            <span className="font-bold w-10 flex-shrink-0 uppercase">Lab.</span>
                                            <span className="flex-1 font-bold underline">: {labs.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* RAD */}
                                    {rads.length > 0 && (
                                        <div className="flex items-start bg-gray-100 border border-black px-1 py-0.5 rounded w-fit max-w-full leading-tight">
                                            <span className="font-bold w-10 flex-shrink-0 uppercase">Rad.</span>
                                            <span className="flex-1 font-bold underline">: {rads.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* TNDKN */}
                                    {tms.length > 0 && (
                                        <div className="flex items-start bg-gray-100 border border-black px-1 py-0.5 rounded w-fit max-w-full leading-tight">
                                            <span className="font-bold w-12 flex-shrink-0 uppercase">Tndkn.</span>
                                            <span className="flex-1">: {tms.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* TERAPI */}
                                    {rxs.length > 0 && (
                                        <div className="flex items-start bg-gray-100 border border-black px-1 py-0.5 rounded w-fit max-w-full leading-tight">
                                            <span className="font-bold w-12 flex-shrink-0 uppercase">Terapi.</span>
                                            <span className="flex-1">: {rxs.join(', ')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SPACER: Mendorong konten ke atas, menyisakan ruang kosong di bawah untuk tulisan tangan */}
                    <div className="flex-1"></div>
                </div>

                {/* --- KOLOM KANAN: O & S --- */}
                <div className="flex flex-col">
                    {/* BAGIAN O (OBJEKTIF) */}
                    <div className="mb-2">
                        <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">O (OBJEKTIF)</div>
                        {/* Kotak TTV yang Rapi */}
                        <div className="mb-2 font-mono text-sm border border-black p-1.5 rounded bg-white leading-snug">
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>TD : ____</div>
                                <div>N  : ____</div>
                                <div>S  : ____</div>
                                <div>RR : ____</div>
                                <div>SpO2: ___</div>
                                <div>GCS : ___</div>
                            </div>
                        </div>
                        <div className="whitespace-pre-wrap font-sans pl-1">{record.objective || '-'}</div>
                    </div>

                    {/* BAGIAN S (SUBJEKTIF) - Jika Ada */}
                    {hasSubjective && (
                        <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-1">
                            <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">S (SUBJEKTIF)</div>
                            <div className="whitespace-pre-wrap font-sans mb-3 pl-1">{record.subjective}</div>
                        </div>
                    )}
                    
                    {/* SPACER KANAN */}
                    <div className="flex-1"></div>
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
    // POIN 2: Urutkan berdasarkan kamar sebelum ditampilkan di preview
    const sortedToPrint = useMemo(() => {
        return [...records].sort((a, b) => 
            a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [records]);

    const onPrint = () => {
        handlePrintWindow('bulk-printable-area', 'Cetak Banyak - APOS');
    };

    return (
        // POIN 3: z-[150] agar melayang di atas header utama (z-100)
        <div className="fixed inset-0 bg-white z-[150] overflow-y-auto">
            <div className="p-4 bg-indigo-50 flex justify-between items-center no-print sticky top-0 z-50 border-b shadow-sm">
                <div>
                    <h1 className="font-bold text-indigo-900">Cetak Banyak ({sortedToPrint.length} Pasien)</h1>
                    <p className="text-[10px] text-gray-500 italic">*Urutan otomatis berdasarkan nomor kamar</p>
                </div>
                <div className="space-x-2">
                    <button onClick={onPrint} className="px-6 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow hover:bg-indigo-700 flex items-center inline-flex transition">
                        <span className="mr-2">🖨️</span> Cetak A5
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded text-sm font-bold hover:bg-gray-600 transition">Tutup</button>
                </div>
            </div>

            <div id="bulk-printable-area" className="p-4 bg-gray-50">
                {sortedToPrint.map((rec, index) => (
                    <div key={rec.id} className="print-page bg-white shadow mb-8 mx-auto print-break">
                        <div className="no-print bg-gray-200 text-gray-500 text-[10px] p-1 text-center font-bold uppercase mb-2">
                            Halaman {index + 1}: {rec.roomNumber} - {rec.name}
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
const SINGLE_BED_ROOMS = ['K7B1', 'K8B1', 'K9B1', 'K11B1', 'K12B1', 'K14B1']; 
// (Catatan: Saya asumsikan penamaan di database pakai B1 semua untuk single, sesuaikan jika beda)


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
        if (neighbor.gender === 'L') return { color: 'sky', status: 'Sisa Lk' };
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
                    } else if (color === 'sky') {
                        colorClass = "bg-sky-50 border-sky-300 text-sky-800 hover:bg-sky-100";
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

// --- UPDATE: RENDER PLANNING CELL (FIX: STATIC CLASSES AGAR TERBACA TAILWIND) ---
const renderPlanningCell = (text) => {
    if (!text) return '-';
    
    // Ambil data hasil parsing
    const { labs, rads, tms, rxs, others } = parsePlanning(text);
    
    // Fungsi Helper Tampilan Per Item
    const renderItem = (title, items, bgClass, borderClass, textClass) => {
        if (items.length === 0) return null;
        
        const itemList = items.join('; '); 

        // Class disusun manual, bukan pakai rumus ${}, agar terbaca oleh Tailwind Compiler
        return (
            <div key={title} className={`block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm ${bgClass} ${borderClass} ${textClass}`}>
                <span className="mr-1 uppercase">{title}:</span>
                {itemList}
            </div>
        );
    };

    return (
        <div className="space-y-1">
            {/* 1. LAB: Merah (Tetap) */}
            {renderItem('Lab', labs, 'bg-red-100', 'border-red-300', 'text-red-500 animate-pulse')}
            
            {/* 2. RAD: blue */}
            {renderItem('Rad', rads, 'bg-blue-100', 'border-blue-400', 'text-blue-500')}
            
            {/* 3. TINDAKAN: Emerald (Hijau Zamrud) */}
            {renderItem('Tndkn', tms, 'bg-emerald-100', 'border-emerald-400', 'text-emerald-500')}
            
            {/* 4. TERAPI: Fuchsia (Ungu Pink Cerah) */}
            {renderItem('Terapi', rxs, 'bg-fuchsia-200', 'border-fuchsia-400', 'text-fuchsia-500')}
            
            {/* 5. Lain-lain (UPDATE: DETEKSI BLPL/RBLPL) */}
            {others.map((line, idx) => {
                // Deteksi Kata Kunci Pulang
                const isDischarge = line.match(/\b(blpl|rblpl|boleh pulang|rencana pulang|pulang|aps)\b/i);
                
                if (isDischarge) {
                    // STYLE BARU: WARNA HITAM, TEKS PUTIH
                    return (
                        <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-extrabold border shadow-sm bg-black border-black text-white">
                            🎉 {line.toUpperCase()}
                        </div>
                    );
                }
                
                // Tampilan teks biasa
                return <div key={`other-${idx}`} className="text-xs text-gray-700 whitespace-pre-wrap">{line}</div>;
            })}
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

// --- PATIENT TABLE FINAL (DENGAN MODE CHECKLIST PULANG MASAL) ---
const PatientTable = ({ records, onEdit, onPrint, onShowLaporModal, onDischarge, roomSortOrder, onPrintTTV, onQuickTtv, onBulkDischarge }) => {
    
    const [viewMode, setViewMode] = useState('soap');
    
    // --- LOGIKA SELEKSI (CHECKBOX) ---
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    // Reset seleksi saat mode checkbox dimatikan
    useEffect(() => { if (!isSelectionMode) setSelectedIds([]); }, [isSelectionMode]);

    // Fungsi Pilih Semua
    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(records.map(r => r.id));
        else setSelectedIds([]);
    };

    // Fungsi Pilih Satu Baris
    const handleSelectRow = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    // Fungsi Eksekusi Pulang Masal
    const executeBulkDischarge = () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Yakin ingin memulangkan ${selectedIds.length} pasien terpilih? Status kamar akan menjadi KOSONG.`)) {
            onBulkDischarge(selectedIds);
            setIsSelectionMode(false); // Keluar mode seleksi setelah sukses
        }
    };

    // Logika Sortir (Tetap Sama)
    const sortedRecords = useMemo(() => {
        if (roomSortOrder && roomSortOrder.length > 0 && roomSortOrder.length < 24) {
            return [...records].sort((a, b) => {
                const indexA = roomSortOrder.indexOf(a.roomNumber);
                const indexB = roomSortOrder.indexOf(b.roomNumber);
                return indexA - indexB;
            });
        }
        return [...records].sort((a, b) => 
            a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [records, roomSortOrder]);

    // Helpers Tampilan (Tetap Sama)
    const getPreparationAlert = (planningText) => {
        if (!planningText) return null;
        const text = planningText.toLowerCase();
        const alerts = [];
        if (text.includes('gdp') || text.includes('2jpp') || text.includes('profil lipid') || text.includes('asam urat') || text.includes('ct') || text.includes('upper')) alerts.push('PUASA');
        if (text.includes('whole')) alerts.push('PUASA & KKP');
        if (text.includes('lower')) alerts.push('KKP Saja');
        if (alerts.length === 0) return null;
        return (
            <div className="flex flex-wrap gap-1 mb-1">
                {alerts.map((alert, idx) => (
                    <span key={idx} className="bg-red-100 text-red-700 border border-red-200 text-[9px] font-extrabold px-1 rounded whitespace-nowrap">⚠️ {alert}</span>
                ))}
            </div>
        );
    };

    const renderTtvPlanning = (planningText) => {
        if (!planningText) return '-';
        const { labs, rads } = parsePlanning(planningText);
        if (labs.length === 0 && rads.length === 0) return <span className="text-gray-300">-</span>;
        return (
            <div className="text-[10px] leading-tight space-y-1">
                {labs.length > 0 && <div className="text-red-700 font-medium"><span className="font-bold text-[9px] bg-red-50 border border-red-100 px-1 rounded mr-1">LAB</span>{labs.join(', ')}</div>}
                {rads.length > 0 && <div className="text-blue-700 font-medium"><span className="font-bold text-[9px] bg-blue-50 border border-blue-100 px-1 rounded mr-1">RAD</span>{rads.join(', ')}</div>}
            </div>
        );
    };

    const getTtvValue = (text, key) => {
        if (!text) return ''; 
        const lines = text.split('\n');
        const regex = new RegExp(`${key}\\s*[:=]?\\s*([0-9\\.,\\/]+)`, 'i');
        const foundLine = lines.find(l => regex.test(l));
        return foundLine ? foundLine.match(regex)[1] : '';
    };

    if (records.length === 0) return <div className="text-center p-10 text-gray-400 italic text-sm bg-white h-full border rounded">Data tidak ditemukan sesuai filter.</div>;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            
            {/* HEADER: TOMBOL CHECKLIST & SWITCHER */}
            <div className="flex border-b bg-gray-50 p-1 gap-2 items-center justify-between flex-shrink-0">
                {isSelectionMode ? (
                    /* TAMPILAN SAAT MODE CHECKLIST AKTIF */
                    <div className="flex gap-2 flex-1 items-center px-2 animate-in fade-in slide-in-from-left-5 duration-300 bg-red-50 rounded py-1">
                        <button onClick={() => setIsSelectionMode(false)} className="text-gray-500 hover:text-gray-700 font-bold text-xs border px-3 py-1 bg-white rounded hover:bg-gray-100 transition">
                            Batal
                        </button>
                        <div className="text-xs font-bold text-red-800 bg-red-100 px-2 py-1 rounded border border-red-200">
                            {selectedIds.length} Dipilih
                        </div>
                        <button 
                            onClick={executeBulkDischarge}
                            disabled={selectedIds.length === 0}
                            className={`px-4 py-1 text-xs font-bold text-white rounded shadow-sm transition flex items-center gap-1 ${selectedIds.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'}`}
                        >
                            <span>🚪</span> PULANGKAN {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                        </button>
                    </div>
                ) : (
                    /* TAMPILAN NORMAL */
                    <div className="flex gap-1 flex-1">
                        <button onClick={() => setIsSelectionMode(true)} className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-[10px] font-bold rounded hover:bg-indigo-50 transition shadow-sm whitespace-nowrap mr-2 flex items-center gap-1">
                            <span>☑️</span> Pilih Banyak
                        </button>
                        <button onClick={() => setViewMode('soap')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'soap' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📝 Mode SOAP</button>
                        <button onClick={() => setViewMode('ttv')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'ttv' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📊 Mode TTV</button>
                    </div>
                )}
                
                {/* Tombol Print TTV (Hanya muncul jika TIDAK sedang checklist) */}
                {viewMode === 'ttv' && !isSelectionMode && (
                    <button onClick={onPrintTTV} className="px-3 py-1.5 bg-white border border-green-600 text-green-700 text-[10px] font-bold rounded hover:bg-green-50 transition shadow-sm whitespace-nowrap">🖨️ Cetak Lembar TTV</button>
                )}
            </div>

            <div id="ttv-table-area" className="overflow-auto flex-1 custom-scrollbar">
                <table className={`w-full text-xs border-collapse table-fixed ${viewMode === 'ttv' ? 'min-w-[1000px]' : 'min-w-[1000px]'}`}>
                    <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm h-9">
                        <tr>
                            {/* KOLOM IDENTITAS + CHECKBOX HEADER */}
                            <th className="p-2 border border-gray-300 w-[160px] text-left sticky left-0 bg-gray-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                {isSelectionMode ? (
                                    <div className="flex items-center gap-2 pl-1 bg-white border border-indigo-200 rounded px-1 py-0.5">
                                        <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === records.length && records.length > 0} className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"/>
                                        <span className="text-[10px] text-indigo-800 font-bold">Pilih Semua</span>
                                    </div>
                                ) : 'Identitas'}
                            </th>
                            
                            {viewMode === 'soap' ? (
                                <>
                                    <th className="p-2 border border-gray-300 w-[200px] text-left">S (Subjektif)</th>
                                    <th className="p-2 border border-gray-300 w-[200px] text-left">O (Objektif)</th>
                                    <th className="p-2 border border-gray-300 w-[200px] text-left">A (Analisa)</th>
                                    <th className="p-2 border border-gray-300 w-[250px] text-left">P (Planning)</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-1 border border-gray-300 w-[60px] text-center bg-white">TD</th>
                                    <th className="p-1 border border-gray-300 w-[50px] text-center bg-white">Nadi</th>
                                    <th className="p-1 border border-gray-300 w-[50px] text-center bg-white">Suhu</th>
                                    <th className="p-1 border border-gray-300 w-[50px] text-center bg-white">RR</th>
                                    <th className="p-1 border border-gray-300 w-[50px] text-center bg-white">SpO2</th>
                                    <th className="p-2 border border-gray-300 w-[250px] text-left bg-gray-50 text-gray-800 font-bold">⚠️ Rencana / Persiapan</th>
                                </>
                            )}
                            <th className="p-2 border border-gray-300 w-[120px] text-center no-print">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRecords.map((rec, index) => (
                            <tr 
                                key={rec.id} 
                                // LOGIKA KLIK: Jika Mode Seleksi -> Centang Baris. Jika Normal -> Edit Pasien.
                                onClick={() => isSelectionMode ? handleSelectRow(rec.id) : onEdit(rec)} 
                                className={`cursor-pointer transition-colors border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${selectedIds.includes(rec.id) ? '!bg-indigo-100 border-indigo-200' : 'hover:bg-indigo-50/50'}`}
                            >
                                {/* IDENTITAS + CHECKBOX BARIS */}
                                <td className="p-2 border-r border-gray-300 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-inherit">
                                    <div className="flex items-start gap-2">
                                        {isSelectionMode && (
                                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedIds.includes(rec.id)} onChange={() => handleSelectRow(rec.id)} className="w-3.5 h-3.5 cursor-pointer accent-indigo-600" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-indigo-900 truncate">{rec.name}</div>
                                                <div className="flex gap-1 mt-1">
                                                    <span className="font-bold bg-yellow-100 px-1 rounded text-[10px] border border-yellow-200">{rec.roomNumber}</span>
                                                    <span className="bg-gray-100 px-1 rounded text-[9px] text-gray-500 border">{rec.gender}</span>
                                                </div>

                                                {/* DPJP UTAMA */}
                                                <div className="mt-1 text-gray-600 italic text-[10px] truncate font-medium">
                                                    Dr: {rec.dpjpName.split(',')[0]}
                                                </div>

                                                {/* DOKTER RABER (DITAMPILKAN JIKA ADA) */}
                                                {(rec.raberName || rec.raber2Name) && (
                                                    <div className="mt-0.5 text-blue-600 font-bold text-[9px] leading-tight">
                                                        <span className="text-gray-400 font-normal">Rb: </span>
                                                        {[rec.raberName, rec.raber2Name].filter(Boolean).map(name => name.split(',')[0]).join(', ')}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </td>

                                {/* KONTEN SOAP / TTV (SAMA SEPERTI SEBELUMNYA) */}
                                {viewMode === 'soap' ? (
                                    <>
                                        <td className="p-2 border-r border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.subjective || '-'}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">{renderObjectiveCell(rec.objective)}</td>
                                        <td className="p-2 border-r border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.analysis || '-'}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">{renderPlanningCell(rec.planning)}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-2 border-r border-gray-300 align-middle text-center font-mono font-bold">{getTtvValue(rec.objective, 'TD')}</td>
                                        <td className="p-2 border-r border-gray-300 align-middle text-center font-mono">{getTtvValue(rec.objective, 'N')}</td>
                                        <td className="p-2 border-r border-gray-300 align-middle text-center font-mono">{getTtvValue(rec.objective, 'S')}</td>
                                        <td className="p-2 border-r border-gray-300 align-middle text-center font-mono">{getTtvValue(rec.objective, 'RR')}</td>
                                        <td className="p-2 border-r border-gray-300 align-middle text-center font-mono">{getTtvValue(rec.objective, 'SpO2')}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">
                                            {getPreparationAlert(rec.planning)}
                                            {renderTtvPlanning(rec.planning)}
                                        </td>
                                    </>
                                )}
                                
                                {/* KOLOM AKSI (NON-PRINT) */}
                                <td className="p-2 border-r border-gray-300 align-middle no-print" onClick={(e) => e.stopPropagation()}>
                                    {viewMode === 'soap' ? (
                                        <div className="grid grid-cols-2 gap-1">
                                            <button onClick={() => onEdit(rec)} className="flex flex-col items-center justify-center p-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 border border-yellow-300" title="Edit"><span className="text-sm">✏️</span><span className="text-[8px] font-bold">Edit</span></button>
                                            <button onClick={() => onPrint(rec)} className="flex flex-col items-center justify-center p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300" title="Cetak"><span className="text-sm">🖨️</span><span className="text-[8px] font-bold">Cetak</span></button>
                                            <button onClick={() => onShowLaporModal(rec)} className="flex flex-col items-center justify-center p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300" title="Lapor WA"><span className="text-sm">📱</span><span className="text-[8px] font-bold">Lapor</span></button>
                                            <button onClick={() => onDischarge(rec.id, rec.name)} className="flex flex-col items-center justify-center p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300" title="Pulang"><span className="text-sm">🚪</span><span className="text-[8px] font-bold">Plg</span></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => onQuickTtv(rec)} className="w-full h-full py-2 bg-green-100 text-green-700 rounded border border-green-300 hover:bg-green-200 text-[10px] font-bold shadow-sm flex items-center justify-center" title="Isi TTV Cepat">+ Input TTV</button>
                                    )}
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
    const allRooms = ROOM_LIST;

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
                {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
  
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);    
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

  
  // --- UPDATE PENCARIAN (Menambahkan Pencarian Nama Dokter) ---
  const filteredActiveRecords = useMemo(() => {
    return activeRecords.filter(rec => {
        // 1. Filter Dropdown (DPJP & Ruangan)
        const matchesDpjp = !dpjpFilter || rec.dpjpName === dpjpFilter;
        // Logic ruangan: Jika pilih "Semua", true. Jika tidak, cek apakah ruangan ada di list yg dipilih.
        const matchesRoom = selectedRoomFilter.length === ROOM_LIST.length || selectedRoomFilter.includes(rec.roomNumber);
        
        // 2. Filter Search Text (Nama Pasien, Diagnosa/Analisa, DAN NAMA DOKTER)
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            rec.name.toLowerCase().includes(term) || 
            (rec.analysis && rec.analysis.toLowerCase().includes(term)) ||
            (rec.dpjpName && rec.dpjpName.toLowerCase().includes(term)); // <--- INI TAMBAHANNYA

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

  // 1. Load Settings from Firestore (VERSI AMAN ANTI-HILANG)
  useEffect(() => {
      if (!userId) return; 
      const ref = getConfigRef();
      if (!ref) return;

      // KUNCI DULU SAAT AWAL MEMUAT (Biar gak bisa edit)
      setIsSettingsLoaded(false);

      const unsubscribe = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const data = snap.data();
              if (data.dpjpProfiles && Array.isArray(data.dpjpProfiles)) {
                  setDpjpProfiles(data.dpjpProfiles);
              }              
              // ✅ SUKSES: Data Cloud sudah masuk, baru kita buka gemboknya!
              setIsSettingsLoaded(true);
              console.log("Settings loaded from Cloud.");
          } else {
              // Jika dokumen belum ada di Cloud (Aplikasi baru pertama kali dipakai)
              // Kita buatkan dokumen baru pakai data default
              setDoc(ref, { 
                  dpjpProfiles: initialDpjpProfiles,                  
              }).catch(err => console.error("Init settings error:", err));
              
              setIsSettingsLoaded(true);
          }
      }, (err) => {
          console.error("Settings Load Error:", err);
          // ❌ GAGAL LOAD: Biarkan terkunci, jangan kasih user ngedit!
          // Biar user sadar kalau data yang tampil itu cuma data default (palsu)
          setIsSettingsLoaded(false);
      });

      return () => unsubscribe();
  }, [getConfigRef, userId]);

  // Baris ini sangat penting agar dropdown di form input mengikuti data dari Cloud
const dpjpOptions = useMemo(() => dpjpProfiles.map(p => p.name), [dpjpProfiles]);

  // 2. Save Settings to Firestore
  const saveConfig = async (newProfiles, newLink) => {
      const ref = getConfigRef();
      if (!ref) return;
      
      const payload = {};
      if (newProfiles !== undefined) payload.dpjpProfiles = newProfiles;     
            try {
          await setDoc(ref, payload, { merge: true });
          console.log("Settings saved to cloud.");
      } catch(e) {
          console.error("Save config error:", e);
          alert("Gagal menyimpan setelan ke cloud. Cek koneksi.");
      }
  };

  // --- FUNGSI TAMBAH DPJP (VERSI AMAN DENGAN SAFETY LOCK) ---
  const handleAddDpjp = async () => {
      // 🔒 1. CEK GEMBOK PENGAMAN DULU
      // Jika data Cloud belum berhasil ditarik, tolak aksi ini!
      if (!isSettingsLoaded) {
          alert("⛔ PENGAMAN AKTIF: Data belum termuat sempurna dari Cloud!\n\nJangan menambah data dulu agar data lama tidak tertimpa.\nCek koneksi internet, lalu Refresh browser.");
          return;
      }

      if (!newDpjpName.trim()) {
          alert("Nama DPJP tidak boleh kosong!");
          return;
      }

      // 2. Cek apakah nama sudah ada
      const existing = dpjpProfiles.some(p => p.name.toLowerCase() === newDpjpName.trim().toLowerCase());
      if (existing) {
          alert("Nama DPJP ini sudah ada!");
          return;
      }

      // 3. Format nomor WA
      let rawNumber = newDpjpWa.trim().replace(/\D/g, ''); 
      if (rawNumber.startsWith('0')) {
          rawNumber = '62' + rawNumber.slice(1); 
      }

      // 4. Gabung & Urutkan
      const newProfile = { 
          name: newDpjpName.trim(), 
          waNumber: rawNumber 
      };
      const updated = [...dpjpProfiles, newProfile].sort((a,b) => a.name.localeCompare(b.name));

      // 5. Simpan ke Cloud
      try {
          await saveConfig(updated);
          setNewDpjpName(''); 
          setNewDpjpWa('');
          console.log("Berhasil tambah dokter ke Cloud");
      } catch (err) {
          alert("Gagal menyimpan ke Cloud. Cek koneksi.");
      }
  };

  // --- FUNGSI HAPUS DPJP (VERSI AMAN DENGAN SAFETY LOCK) ---
  const handleRemoveDpjp = async (name) => {
      // 🔒 1. CEK GEMBOK PENGAMAN DULU
      if (!isSettingsLoaded) {
          alert("⛔ PENGAMAN AKTIF: Data belum termuat sempurna dari Cloud!\n\nTunggu sampai indikator merah hilang baru bisa menghapus.");
          return;
      }

      if (window.confirm(`Hapus ${name} dari daftar?`)) {
          const updated = dpjpProfiles.filter(p => p.name !== name).sort((a,b) => a.name.localeCompare(b.name));
          await saveConfig(updated);
      }
  };
    // --- MONITORING DATA UTAMA SECARA REAL-TIME ---
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

 
  // --- FUNGSI SALIN CERDAS (Langkah B) ---
const pullDataForField = (field) => {
    // 1. Cek apakah riwayat berhasil ditarik
    if (!historyLogs || historyLogs.length === 0) {
        alert("Belum ada riwayat catatan sebelumnya untuk pasien ini.");
        return;
    }

    // 2. LOGIKA PENCARIAN MUNDUR (Smart Search)
    // Cari data pertama di history yang kolom 'field'-nya TIDAK KOSONG.
    // Jadi kalau log terbaru kosong, dia otomatis cari ke log sebelumnya.
    const foundLog = historyLogs.find(log => log[field] && log[field].trim().length > 0);
    
    if (foundLog) {
        const val = foundLog[field];
        
        // 3. Masukkan data ke Form
        setFormData(prev => ({ ...prev, [field]: val }));
        
        // 4. Efek Visual (Ubah teks tombol jadi "Sukses!" selama 1 detik)
        const btn = document.activeElement;
        if(btn && btn.tagName === 'BUTTON') { 
            const originalText = btn.innerText;
            btn.innerText = "✅ Sukses!";
            setTimeout(() => btn.innerText = originalText, 1000);
        }
    } else {
        alert(`Data ${field.toUpperCase()} tidak ditemukan di seluruh riwayat pasien ini.`);
    }
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
  // 4. FUNGSI UPDATE KAMAR WAITING LIST (FITUR EDIT PENSIL) ---
  const updateWaitingListRoom = async (itemId, newRoom) => {
      // 1. Update Tampilan Layar (Biar cepat)
      const updatedList = waitingList.map(item => 
          item.id === itemId ? { ...item, plannedRoom: newRoom } : item
      );
      setWaitingList(updatedList);
      
      // 2. Simpan Permanen ke Firebase
      try {
          const itemRef = doc(db, `artifacts/${appId}/public/data/waitingList`, itemId);
          await updateDoc(itemRef, { plannedRoom: newRoom });
          console.log("Sukses ganti kamar antrean");
      } catch(e) { 
          console.error("Gagal update WL:", e); 
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
           
           // PERBAIKAN: Pakai await biar data selesai diambil dulu baru lanjut
           const snapshot = await getDocs(q);
           
           const logs = snapshot.docs.map(doc => ({
               ...doc.data(),
               // PERBAIKAN: Konversi Timestamp Firebase ke Date Object standar JS
               updatedAt: doc.data().createdAt?.seconds ? new Date(doc.data().createdAt.seconds * 1000) : new Date()
           }));

           // LOGIKA PINTAR ANTI-DUPLIKAT:
           if (logs.length > 0) {
               // Jika sudah ada arsip notes, pakai itu
               setHistoryLogs(logs);
           } else {
               // Jika kosong, pinjam data Dashboard (rec) biar riwayat gak kosong
               setHistoryLogs([rec]);
           }
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
      const header = `Dokter Izin Lapor Pasien \na.n ${rec.name} ${dpjpInfo}`;
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

  // --- FUNGSI PULANG MASAL (MULTIPLE DISCHARGE) ---
const handleBulkDischarge = async (ids) => {
    setLoading(true);
    try {
        const ref = getCollectionRef();
        // Gunakan Promise.all untuk mengeksekusi banyak update sekaligus (Paralel)
        const updatePromises = ids.map(id => 
            updateDoc(doc(ref, id), { 
                isDischarged: true, 
                updatedAt: Timestamp.now() 
            })
        );
        
        await Promise.all(updatePromises);
        alert(`Sukses! ${ids.length} pasien telah dipulangkan.`);
    } catch (e) {
        console.error("Bulk Discharge Error:", e);
        alert("Gagal memproses pulang masal. Cek koneksi.");
    } finally {
        setLoading(false);
    }
};

    // --- UPDATE: HANDLE PRINT TTV (FIX: A4 PORTRAIT, FIT 1 PAGE) ---
    const handlePrintTTV = () => {
        const element = document.getElementById('ttv-table-area');
        if (!element) {
            alert("Tabel tidak ditemukan.");
            return;
        }

        const content = element.innerHTML;
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Lembar Observasi TTV</title>
                <style>
                    @page { 
                        size: A4 portrait; 
                        margin: 5mm; /* Margin tipis 5mm */
                    }
                    
                    body { 
                        font-family: Arial, sans-serif; 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        padding: 0;
                        margin: 0;
                        /* INI RAHASIANYA AGAR MUAT 1 HALAMAN */
                        zoom: 0.85; 
                    }

                    table { 
                        width: 100% !important; 
                        min-width: 0 !important;
                        border-collapse: collapse; 
                        font-size: 9pt; 
                    }

                    th, td { 
                        border: 1px solid black; 
                        padding: 2px 3px; /* Padding diperketat */
                        vertical-align: middle; 
                        line-height: 1.2; /* Spasi antar baris teks dirapatkan */
                    }

                    th { 
                        background-color: #f0f0f0 !important; 
                        text-align: center; 
                        font-weight: bold;
                        height: 25px;
                        font-size: 8pt;
                    }
                    
                    /* Rata Tengah untuk Kolom TTV (Kolom ke 2 s/d 6) */
                    td:nth-child(2), td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6) {
                        text-align: center; 
                        font-family: 'Courier New', monospace;
                        font-weight: bold;
                        width: 45px; 
                    }

                    /* Kolom Identitas (Lebar Pas) */
                    td:nth-child(1) { width: 140px; }
                    
                    /* Kolom Persiapan (Biar teks panjang ngebungkus rapi) */
                    td:nth-child(7) { font-size: 8pt; }

                    /* HILANGKAN KOLOM AKSI */
                    .no-print { display: none !important; }
                    
                    /* Judul */
                    h3 { margin: 5px 0 2px 0; font-size: 14pt; }
                    .date-print { margin-bottom: 5px; font-size: 8pt; color: #555; }
                </style>
            </head>
            <body>
                <div style="text-align: center;">
                    <h3 style="text-transform: uppercase; font-weight: bold;">Lembar Observasi Tanda Vital & Rencana Harian</h3>
                    <div class="date-print">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
                </div>
                
                ${content}
                
                <script>
                    setTimeout(() => { window.print(); window.close(); }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };  
    // --- FUNGSI CETAK CPO (FINAL: HEADER LENGKAP + PAGINATION) ---
const handlePrintCPO = (record) => {
    if (!record) return;

    // 1. Logic Pemotongan Kamar (Misal: K1B1 -> K1)
    const rawRoom = record.roomNumber || '';
    // Ambil karakter sebelum huruf 'B' (misal K1B1 jadi K1)
    // Kalau tidak ada huruf B, tampilkan apa adanya.
    const cleanRoom = rawRoom.includes('B') ? rawRoom.split('B')[0] : rawRoom;

    // 2. Ekstrak Obat (VERSI FINAL: FILTER LAB/RAD AGAR TIDAK MASUK CPO)
    const extractMeds = (text) => {
        if (!text) return [];
        const lines = text.split('\n');
        const meds = [];

        lines.forEach(line => {
            let cleanLine = line.trim();
            // 1. Bersihkan bullet point/strip
            cleanLine = cleanLine.replace(/^[-•*]\s*/, '');

            const lower = cleanLine.toLowerCase();

            // --- FILTER PENTING: JANGAN MASUKKAN LAB/RAD KE CPO ---
            if (
                !cleanLine ||
                cleanLine.length < 3 ||
                cleanLine.includes('-- TERAPI OBAT --') || // Header pemisah
                lower.includes('rencana:') ||              // Header Rencana
                lower.startsWith('lab') ||                 // Filter "Lab. R/ ..."
                lower.startsWith('rad') ||                 // Filter "Rad. R/ ..."
                lower.startsWith('cek') ||                 // Filter "Cek GDS..."
                lower.startsWith('kontrol') ||             // Filter "Kontrol..."
                lower.startsWith('tindakan') ||            // Filter "Tindakan..." (Opsional)
                lower.startsWith('tm.')                    // Filter "TM." (Tindakan Medis)
            ) return; // Langsung skip, jangan diproses!

            // --- STRATEGI 1: CEK POLA SMART PASTE (KURUNG) ---
            const bracketMatch = cleanLine.match(/^(.*?)\s*\(([^)]+)\)$/);
            if (bracketMatch) {
                meds.push({ 
                    nama: bracketMatch[1].trim(), 
                    dosis: bracketMatch[2].trim() 
                });
                return; 
            }

            // --- STRATEGI 2: CEK POLA DOSIS MANUAL (REGEX SAKTI) ---
            const dosageRegex = new RegExp(
                "(" + 
                "\\d+\\s*[xX]\\s*[\\d\\.,]+.*|" +           // 3x1
                "\\d+\\s*(?:mg|gr|mcg|iu|tpm|cc|ml|L|tetes|ampul|vial|kolf|flash|sachet|tab|cap).*|" + // 500mg
                "\\b(?:asnet|k\\/p|prn|stop|aff|drip|bolus)\\b.*|" +  // Kata kunci
                "(?:\\/|per)\\s*\\d+\\s*(?:jam|j|menit|m|hari).*" +   // per 12 jam
                ")", "i"
            );
            
            const manualMatch = cleanLine.match(dosageRegex);

            if (manualMatch) {
                const splitIndex = manualMatch.index;
                
                // Pastikan nama obatnya valid (panjang > 2 huruf)
                if (splitIndex > 2) {
                    const namaObat = cleanLine.substring(0, splitIndex).trim(); 
                    const dosisObat = cleanLine.substring(splitIndex).trim();   

                    meds.push({ nama: namaObat, dosis: dosisObat });
                    return;
                }
            }

            // --- STRATEGI 3: FALLBACK ---
            // Hanya masukkan jika ada kata kunci obat (inj, infus, dll)
            const drugKeywords = ['inj', 'tab', 'cap', 'infus', 'drip', 'bolus', 'supp', 'nebu', 'obat', 'syr', 'puyer'];
            if (drugKeywords.some(k => lower.includes(k))) {
                meds.push({ nama: cleanLine, dosis: '' });
            }
        });
        
        return meds;
    };

    const fullMedList = extractMeds(record.planning);

    // --- LOGIKA PAGINATION ---
    const MAX_ROWS = 7; 
    const pages = [];
    for (let i = 0; i < fullMedList.length; i += MAX_ROWS) {
        pages.push(fullMedList.slice(i, i + MAX_ROWS));
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    
    // 3. HTML SYSTEM
    const htmlContent = `
        <html>
        <head>
            <title>Print CPO - ${record.name}</title>
            <style>
                @page { size: 330mm 215mm; margin: 0; }
                
                body { 
                    margin: 0; padding: 0; 
                    font-family: 'Courier New', Courier, monospace; 
                    font-size: 10pt; 
                    font-weight: bold; 
                    -webkit-print-color-adjust: exact;
                }

                .page-container {
                    position: relative;
                    width: 330mm;
                    height: 215mm;
                    overflow: hidden;
                    page-break-after: always;
                }
                .page-container:last-child { page-break-after: auto; }

                /* Background Image */
                .scan-background {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    z-index: -1;
                    opacity: 0.4;
                }
                @media print { .scan-background { display: none !important; } }

                /* --- HEADER KIRI (RUANGAN & DPJP) --- */
                .header-ruangan {
                    position: absolute;
                    top: 47mm;      
                    left: 13mm;      
                    width: 35mm;    
                    text-align: center;
                    font-size: 9pt;
                    line-height: 1.4;
                }

                .header-dpjp {
                    position: absolute;
                    top: 50mm;      
                    left: 50mm;     
                    width: 100mm;
                    text-align: left;
                    font-size: 10pt;
                }

                /* --- NAMA PASIEN --- */
                .patient-box {
                    position: absolute;
                    top: 14mm; right: 15mm; width: 90mm;   
                    font-size: 10pt; text-align: left; line-height: 1.5; 
                }

                /* --- UPDATE: OBAT (WRAP TEXT) --- */
                .med-row {
                    position: absolute;
                    left: 51mm;  /* Tetap 51mm */
                    width: 150mm; /* Tetap 150mm */
                    
                    /* PERUBAHAN: Agar teks bisa turun ke bawah */
                    min-height: 8mm; /* Bukan height mati, tapi minimal 8mm */
                    display: flex;
                    align-items: flex-start; /* Rata atas (supaya rapi kalau 2 baris) */
                    padding-top: 1mm; /* Jarak dikit dari garis atas */
                }
                
                .col-nama { 
                    width: 38mm; /* Tetap 38mm */
                    
                    /* PERUBAHAN: Izinkan turun baris */
                    white-space: normal;       
                    word-wrap: break-word;     
                    line-height: 1.1;          
                    font-size: 9pt;            
                }
                
                .col-dosis { 
                    position: absolute;
                    left: 40mm; /* Tetap 40mm */
                    width: 35mm; /* Tetap 35mm */
                    
                    text-align: left;
                    padding-left: 2mm;
                    padding-top: 0.5mm; /* Penyesuaian karena col-nama pakai flex-start */
                }

            </style>
        </head>
        <body>
            ${pages.map((pageMeds, pageIndex) => `
                <div class="page-container">
                    
                    <img src="/cpo-overlay.png" class="scan-background" alt="Mal CPO">

                    <div class="header-ruangan">
                        <div>MELATI</div>
                        <div style="font-size: 12pt; margin-top: 2mm;">${cleanRoom}</div>
                    </div>

                    <div class="header-dpjp">
                        ${record.dpjpName || '-'}
                    </div>

                    <div class="patient-box">
                        <div style="padding-left: 70mm; margin-top: 2mm;">
                            ${record.name.substring(0,25)}
                        </div> 
                    </div>

                    ${pageMeds.map((obat, idx) => {                        
                        const startY = 78; 
                        const rowHeight = 18; 
                        const currentTop = startY + (idx * rowHeight);
                        
                        // --- LOGIKA ENTER DOSIS OTOMATIS ---
                        let displayDosis = obat.dosis;
                        
                        // Cari spasi sebelum kata kunci (iv, tab, cap, po, im, sc, supp)
                        // Lalu ganti spasi itu dengan <br> agar turun baris
                        // Contoh: "1x10mg tab PO" -> "1x10mg<br>tab PO"
                        if (displayDosis) {
                            displayDosis = displayDosis.replace(
                                /\s+(iv|im|sc|po|oral|tab|cap|supp|drip|bolus|k\/p)\b/gi, 
                                '<br>$1'
                            );
                        }

                        return `
                        <div class="med-row" style="top: ${currentTop}mm;">
                            <div class="col-nama">${obat.nama}</div>
                            
                            <div class="col-dosis">${displayDosis}</div>
                        </div>
                        `;
                    }).join('')}

                    ${pages.length > 1 ? `
                        <div style="position:absolute; bottom:5mm; right:5mm; font-size:8pt;">
                            Hal ${pageIndex + 1}/${pages.length}
                        </div>
                    ` : ''}

                </div>
            `).join('')}

            <script>
                setTimeout(() => { window.print(); }, 1500);
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

  // --- TAMPILAN DASHBOARD (V3.3 FINAL - LAYOUT BERSIH TANPA FILTER) ---
const renderDashboard = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">
            
            {/* KOLOM KIRI: HANYA PETA KAMAR (Lebar 5/12) */}
            <div className="lg:col-span-6 flex flex-col h-[calc(100vh-140px)]">
                
                {/* WADAH PETA KAMAR */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                    
                    {/* Header Peta Kamar (Pengganti Filter) */}
                    <div className="flex justify-between items-center px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🗺️</span>
                            <div>
                                <h3 className="text-xs font-bold text-indigo-900 uppercase">Denah Kamar</h3>
                                <p className="text-[9px] text-gray-500">
                                    {/* Indikator Filter Aktif */}
                                    {dpjpFilter || selectedRoomFilter.length !== ROOM_LIST.length 
                                        ? `Filter Aktif: ${dpjpFilter || 'Kamar Tertentu'}` 
                                        : 'Menampilkan Semua Kamar'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Area Peta (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                        <RoomMap 
                            roomList={ROOM_LIST} 
                            activeRecords={filteredActiveRecords} 
                            onSelectRoom={handleSelectRoom} 
                            onEditRoom={handleEditRoom}
                            roomFilter={selectedRoomFilter} // JANGAN DIHAPUS: Tetap konek ke filter global
                            waitingList={waitingList}
                        />
                    </div>
                </div>
            </div>

            {/* KOLOM KANAN: Statistik & Waiting List (Lebar 7/12) - TETAP UTUH */}
            <div className="lg:col-span-6 h-[calc(100vh-140px)] overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                
                {/* 1. WAITING LIST */}
                <div className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden">
                    <div className="bg-indigo-600 px-3 py-2 text-white flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold uppercase tracking-tight">📋 Waiting List</span>
                            <span className="bg-indigo-500 px-2 py-0.5 rounded-full text-[10px] font-mono">{waitingList.length}</span>
                        </div>
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
                    <div className="flex flex-col items-center justify-center bg-sky-100 border border-sky-300 text-sky-900 rounded p-2 shadow-sm">
                        <span className="text-[9px] font-bold uppercase">SISA LK</span>
                        <span className="text-xl font-extrabold">{stats.emptyMale}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-purple-100 border border-purple-300 text-purple-900 rounded p-2 shadow-sm">
                        <span className="text-[9px] font-bold uppercase">SISA PR</span>
                        <span className="text-xl font-extrabold">{stats.emptyFemale}</span>
                    </div>
                </div>

                {/* 3. PASIEN AKTIF PER DPJP */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                    <h3 className="font-bold text-gray-700 border-b pb-2 mb-3 text-xs uppercase">Pasien Aktif per DPJP</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(stats.dpjpCounts).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                            <div key={name} className="flex justify-between items-center text-[10px] p-2 bg-gray-50 rounded border border-gray-100 hover:bg-indigo-50 transition group">
                                <span className="truncate pr-1 font-medium text-gray-700">{name}</span>
                                <div className="flex items-center space-x-1">
                                    <span className="font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full min-w-[20px] text-center">{count}</span>
                                    <button 
                                        onClick={() => handleReportDpjpCount(name, count)}
                                        className="text-[9px] bg-green-100 text-green-700 border border-green-200 p-1 rounded-full hover:bg-green-600 hover:text-white transition opacity-80 group-hover:opacity-100"
                                        title={`Lapor jumlah ke ${name}`}
                                    >
                                        📱
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. RAWAT BERSAMA */}
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

                {/* 5. REKAPITULASI BULANAN */}
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

                <div className="h-10"></div>
            </div>
        </div>
    );
};


  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
        {/* --- HEADER (REVISI: HAMBURGER MENU + FITUR BARU) --- */}
        <div className="bg-white shadow-sm px-4 h-16 sticky top-0 z-[80] border-b flex justify-between items-center max-w-7xl mx-auto">
            
            {/* LOGO KIRI (Bisa Diklik Kembali ke Dashboard) */}
            <div 
                onClick={() => setView('dashboard')} 
                className="flex flex-col items-center justify-center leading-none text-indigo-800 select-none cursor-pointer hover:opacity-80 transition"
            >
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
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-60 animate-in fade-in slide-in-from-top-2">
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
            <div className={`fixed top-16 left-0 bottom-0 w-full md:w-[400px] z-[60] bg-white transition-transform duration-300 ease-in-out shadow-2xl border-r ${
                showWaitingModal ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <WaitingListInputPanel 
                    show={showWaitingModal}
                    onClose={() => setShowWaitingModal(false)}
                    onAdd={handleAddWaiting}
                    availableRooms={ROOM_LIST}
                    occupiedRooms={occupiedRooms}
                    waitingList={waitingList}
                    onUpdateRoom={updateWaitingListRoom}
                />
            </div>

            {/* 2. KOLOM KIRI (DASHBOARD / LIST) - SELALU FULL (NO RESIZE) */}
            <div className="w-full h-full flex flex-col overflow-hidden">
                <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                    
                    {/* VIEW 1: DASHBOARD */}
                    {view === 'dashboard' && renderDashboard()}
                    
                    {/* VIEW 2: DAFTAR PASIEN (FIX: DROPDOWN TIDAK TERTUTUP) */}
                    {view === 'patient-list' && (
                        <div className="h-full flex flex-col bg-gray-50">
                            
                            {/* --- HEADER UTAMA (BUMPPED Z-INDEX KE z-40) --- */}
                            <div className="p-3 bg-white border-b shadow-sm sticky top-0 z-40 flex-shrink-0 space-y-2">
                                
                                {/* Baris Atas: Judul & Tombol Aksi */}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-lg text-indigo-800">📂 Daftar Pasien</h2>
                                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                            {filteredActiveRecords.length} Pasien
                                        </span>
                                    </div>

                                    <div className="flex space-x-1">
                                        <button 
                                            onClick={handleExportExcel}
                                            className="text-[10px] px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-600 hover:text-white transition flex items-center shadow-sm"
                                        >
                                            Excel
                                        </button>
                                        <button 
                                            onClick={() => setShowBulkPrint(true)}
                                            className="text-[10px] px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition flex items-center shadow-sm"
                                        >
                                            🖨️ Cetak Banyak
                                        </button>
                                    </div>
                                </div>

                                {/* Baris Bawah: Input & Filter */}
                                <div className="flex flex-col md:flex-row gap-2">
                                    
                                    {/* FILTER KAMAR (Wrapper z-50 untuk memastikan menu melayang) */}
                                    <div className="w-full md:w-48 relative z-50">
                                        <RoomFilterDropdown 
                                            allRooms={ROOM_LIST}
                                            selectedRooms={selectedRoomFilter}
                                            onChange={setSelectedRoomFilter} 
                                        />
                                    </div>

                                    {/* FILTER DOKTER */}
                                    <div className="w-full md:w-48">
                                        <select 
                                            value={dpjpFilter} 
                                            onChange={(e) => setDpjpFilter(e.target.value)} 
                                            className="w-full p-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 font-medium h-[32px]"
                                        >
                                            <option value="">Semua Dokter (DPJP)</option>
                                            {dpjpOptions.map((opt, idx) => (
                                                <option key={idx} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* SEARCH BAR TUNGGAL */}
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                                        <input 
                                            type="text" 
                                            placeholder="Cari Nama / Diagnosa / Dokter..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 transition h-[32px]"
                                        />
                                        {searchTerm && (
                                            <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-red-500 font-bold text-xs">✕</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* TABEL PASIEN (z-index biarkan 10 agar tetap di bawah dropdown) */}
                            <div className="flex-1 overflow-hidden relative z-0">
                                <PatientTable 
                                    records={filteredActiveRecords} 
                                    onEdit={handleEdit} 
                                    onPrint={(r) => { setSelectedRecordForPrint(r); }} 
                                    onShowLaporModal={setRecordForLapor} 
                                    onDischarge={handleDischarge}
                                    onBulkPrint={() => setShowBulkPrint(true)} 
                                    roomSortOrder={selectedRoomFilter}
                                    onPrintTTV={handlePrintTTV}
                                    onQuickTtv={(rec) => {
                                        setQuickTtvTarget(rec);
                                        setShowTtvModal(true);
                                    }}
                                    onBulkDischarge={handleBulkDischarge}
                                />
                            </div>
                        </div>
                    )}
                                        
                    {/* VIEW 3: SETELAN (REVISI: TABEL DITAMPILKAN KEMBALI) */}
                    {view === 'settings' && (
                        <div className="bg-white p-6 rounded shadow h-full overflow-y-auto">
                            <h2 className="font-bold text-lg mb-4 text-indigo-800 border-b pb-2">Pengaturan Aplikasi</h2>
                            
                            {/* INDIKATOR MERAH PENGAMAN */}
                            {!isSettingsLoaded && (
                                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm animate-pulse">
                                    <p className="font-bold text-sm">⚠️ KONEKSI TIDAK STABIL / LOADING DATA</p>
                                    <p className="text-xs">
                                        Sistem sedang mengambil data dokter dari Cloud. Tombol Tambah/Hapus 
                                        <strong> DIKUNCI SEMENTARA</strong> untuk mencegah data hilang/tertimpa.
                                        <br/>Silakan tunggu atau Refresh jika macet.
                                    </p>
                                </div>
                            )}

                            <div className={`mb-6 ${!isSettingsLoaded ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <h3 className="font-bold text-gray-700 mb-2">Daftar DPJP & Nomor WA</h3>
                                
                                {/* Input Tambah Dokter */}
                                <div className="flex space-x-2 mb-3">
                                    <input 
                                        type="text" 
                                        placeholder="Nama Dokter" 
                                        value={newDpjpName} 
                                        onChange={(e) => setNewDpjpName(e.target.value)} 
                                        className="border p-2 rounded text-xs w-1/2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Nomor WA (08xxx)" 
                                        value={newDpjpWa} 
                                        onChange={(e) => setNewDpjpWa(e.target.value)} 
                                        className="border p-2 rounded text-xs w-1/3 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    />
                                    <button 
                                        onClick={handleAddDpjp} 
                                        disabled={!isSettingsLoaded}
                                        className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 transition disabled:bg-gray-400"
                                    >
                                        + Tambah
                                    </button>
                                </div>

                                {/* TABEL DAFTAR DOKTER (Ini yang tadi hilang) */}
                                <div className="border rounded overflow-hidden bg-white shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 text-xs text-gray-600 border-b">
                                                <th className="p-2 border-r font-bold uppercase">Nama Dokter</th>
                                                <th className="p-2 border-r font-bold uppercase">No. WA (System)</th>
                                                <th className="p-2 text-center font-bold uppercase">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dpjpProfiles && dpjpProfiles.length > 0 ? (
                                                dpjpProfiles.map((p, idx) => (
                                                    <tr key={idx} className="border-b text-xs hover:bg-indigo-50 transition">
                                                        <td className="p-2 border-r font-medium text-gray-800">{p.name}</td>
                                                        <td className="p-2 border-r text-gray-500 font-mono">{p.waNumber}</td>
                                                        <td className="p-2 text-center">
                                                            <button 
                                                                onClick={() => handleRemoveDpjp(p.name)}
                                                                disabled={!isSettingsLoaded}
                                                                className="text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition text-[10px] disabled:text-gray-400 disabled:border-gray-200"
                                                                title="Hapus Dokter"
                                                            >
                                                                🗑️ Hapus
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="p-6 text-center text-gray-400 italic bg-gray-50">
                                                        Belum ada data dokter. Silakan tambah data baru.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <p className="text-[10px] text-gray-400 mt-2 italic">
                                    * Nomor WA otomatis diubah ke format 628xx untuk keperluan link WhatsApp.
                                </p>
                            </div>                                                       
                        </div>
                    )}
                </div>
            </div>

            {/* 3. PANEL INPUT SOAP (OVERLAY KANAN) */}
            {showInputModal && (
                <div className="fixed top-16 right-0 bottom-0 w-full md:w-[500px] z-[60] bg-white shadow-2xl border-l transition-all duration-300 flex flex-col">
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
                        dpjpProfiles={dpjpProfiles}
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
                        onPrintCPO={() => handlePrintCPO({ ...formData, id: currentRecordId })}
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
// --- PANEL INPUT WAITING LIST (FINAL: HEADER BUTTON + EDIT KAMAR) ---
const WaitingListInputPanel = ({ show, onClose, onAdd, availableRooms, occupiedRooms = [], waitingList = [], onUpdateRoom }) => {
    
    // State Form Input
    const [form, setForm] = useState({ 
        name: '', plannedRoom: '', originRoom: '', 
        insuranceClass: '', waNumber: '', diagnosis: '' 
    });

    // State Edit Kamar (Pensil)
    const [editingId, setEditingId] = useState(null);
    const [tempRoom, setTempRoom] = useState('');

    if (!show) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name || !form.plannedRoom) return alert("Nama dan Rencana Kamar wajib diisi!");
        onAdd(form);
        setForm({ name: '', plannedRoom: '', originRoom: '', insuranceClass: '', waNumber: '', diagnosis: '' });
        onClose(); // Opsional: Mau langsung tutup atau tetap buka? (Default tutup)
    };

    // Fungsi Mulai Edit
    const startEditing = (item) => {
        setEditingId(item.id);
        setTempRoom(item.plannedRoom);
    };

    // Fungsi Simpan Edit
    const saveEditing = () => {
        if (onUpdateRoom && tempRoom) {
            onUpdateRoom(editingId, tempRoom);
        }
        setEditingId(null);
    };

    return (
        <div className="flex flex-col h-full bg-white shadow-2xl border-r border-indigo-200 relative">
            
            {/* 1. HEADER (TOMBOL SIMPAN DI ATAS) */}
            <div className="p-3 bg-indigo-700 text-white flex justify-between items-center shadow-md z-10">
                <div>
                    <h3 className="font-bold text-sm">📝 Input Antrean</h3>
                    <p className="text-[10px] opacity-80">Isi data pasien inden</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSubmit} className="px-3 py-1.5 text-[10px] bg-white text-indigo-700 font-bold rounded shadow hover:bg-indigo-50 transition flex items-center">
                        💾 Simpan
                    </button>
                    <button onClick={onClose} className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg">✕</button>
                </div>
            </div>

            {/* 2. AREA TENGAH (FORM + TABEL) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 flex flex-col">
                
                {/* A. FORM INPUT */}
                <div className="p-4 space-y-3 bg-white border-b border-gray-200 mb-2 shadow-sm">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Kamar</label>
                        <select className="w-full p-2 text-xs border border-gray-300 rounded bg-white outline-none font-bold focus:ring-2 focus:ring-indigo-500" value={form.plannedRoom} onChange={e => setForm({...form, plannedRoom: e.target.value})}>
                            <option value="">- Pilih Kamar -</option>
                            {availableRooms.map(r => {
                                const isOccupied = occupiedRooms.includes(r);
                                const isBooked = waitingList.some(w => w.plannedRoom === r);
                                let emoji = '🟢'; let className = 'text-green-700 font-bold';
                                if (isOccupied) { emoji = '🔴'; className = 'text-red-600 font-bold'; } 
                                else if (isBooked) { emoji = '🟡'; className = 'text-yellow-700 font-bold'; }
                                return <option key={r} value={r} className={className}>{emoji} {r} {isOccupied ? '(Terisi)' : isBooked ? '(Antre)' : '(Kosong)'}</option>;
                            })}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Pasien</label><input type="text" className="w-full p-2 text-xs border rounded outline-none" placeholder="Nama..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Asal</label><input type="text" className="w-full p-2 text-xs border rounded outline-none" placeholder="IGD/Poli..." value={form.originRoom} onChange={e => setForm({...form, originRoom: e.target.value})} /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kelas</label>
                            <select className="w-full p-2 text-xs border rounded outline-none bg-white" value={form.insuranceClass} onChange={e => setForm({...form, insuranceClass: e.target.value})}>
                                <option value="">- Pilih -</option><option value="BPJS Kls 1">BPJS Kls 1</option><option value="BPJS Kls 2">BPJS Kls 2</option><option value="BPJS Kls 3">BPJS Kls 3</option><option value="Umum/Asuransi">Umum/Asuransi</option>
                            </select>
                        </div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">No. HP</label><input type="text" className="w-full p-2 text-xs border rounded outline-none" placeholder="08xxx..." value={form.waNumber} onChange={e => setForm({...form, waNumber: e.target.value})} /></div>
                    </div>
                    <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Diagnosa</label><textarea rows="2" className="w-full p-2 text-xs border rounded outline-none resize-none" placeholder="Diagnosa..." value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})}></textarea></div>
                </div>

                {/* B. TABEL ANTREAN (DENGAN FITUR EDIT KAMAR) */}
                <div className="p-2">
                    <h3 className="px-2 mb-1 text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Daftar Antrean ({waitingList.length})</h3>
                    {waitingList.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 italic text-xs border-2 border-dashed border-gray-200 rounded">Belum ada pasien antre.</div>
                    ) : (
                        <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-indigo-50 border-b border-indigo-100 text-[10px] uppercase text-indigo-600 font-bold">
                                    <tr>
                                        <th className="p-2">Target Kamar</th>
                                        <th className="p-2">Pasien</th>
                                        <th className="p-2 text-center">Asal</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {waitingList.map((item) => (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50 group">
                                            
                                            {/* KOLOM TARGET (BISA DIEDIT) */}
                                            <td className="p-2 font-bold text-indigo-700 w-[130px]">
                                                {editingId === item.id ? (
                                                    <div className="flex items-center gap-1 animate-in zoom-in-95 duration-100">
                                                        <select 
                                                            className="w-full p-1 text-[10px] border border-indigo-300 rounded bg-white focus:ring-1 focus:ring-indigo-500" 
                                                            value={tempRoom} 
                                                            onChange={e => setTempRoom(e.target.value)}
                                                            autoFocus
                                                        >
                                                            {availableRooms.map(r => (
                                                                <option key={r} value={r}>{r}</option>
                                                            ))}
                                                        </select>
                                                        <button onClick={saveEditing} className="bg-green-100 text-green-700 hover:bg-green-200 p-1 rounded border border-green-300" title="Simpan">✅</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center group">
                                                        <span>{item.plannedRoom}</span>
                                                        <button 
                                                            onClick={() => startEditing(item)} 
                                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition p-1"
                                                            title="Ganti Kamar"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-2">
                                                <div className="font-bold text-gray-800">{item.name}</div>
                                                <div className="text-[9px] text-gray-400 truncate max-w-[100px]">{item.diagnosis || '-'}</div>
                                            </td>
                                            <td className="p-2 text-center text-gray-500 text-[10px]">
                                                {item.originRoom || 'IGD'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
// --- INPUT SIDE PANEL (VERSI SUPER: SHORTCUTS + SMART LAB V10) ---
const InputSidePanel = ({
    showInputModal, setShowInputModal, handleSubmit, formData, handleInputChange,
    resetForm, isEditing, currentRecordId, availableRooms, dpjpOptions,
    showRaber1, setShowRaber1, showRaber2, setShowRaber2, historyLogs,
    pullDataForField, setShowTtvModal, appendText, handleDischarge, setSelectedRecordForPrint,
    setRecordForLapor, isFormReady, loading, ALL_PLANNING_OPTIONS, handleDeleteRecord, onPrintCPO
}) => {
    
    // 1. STATE & REF
    const [showSmartPaste, setShowSmartPaste] = useState(false);
    const [rawPasteData, setRawPasteData] = useState('');
    const scrollRef = useRef(null); 
    const [showLabModal, setShowLabModal] = useState(false); 
    const [rawLabData, setRawLabData] = useState('');
    const [showLabTrend, setShowLabTrend] = useState(false);
    const [labTrends, setLabTrends] = useState({});
    const [showRadModal, setShowRadModal] = useState(false);
    const [rawRadData, setRawRadData] = useState('');

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [currentRecordId, showInputModal]);

    // --- [FITUR BARU] KEYBOARD SHORTCUTS (CTRL+S, CTRL+P, ESC) ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 1. Tombol ESC = Tutup Panel
            if (e.key === 'Escape') {
                if (showSmartPaste || showLabModal || showRadModal || showLabTrend) return; // Biarkan modal kecil tutup duluan
                setShowInputModal(false);
                resetForm();
            }

            // 2. CTRL + S = Simpan Data
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); 
                if (isFormReady && !loading) {
                    handleSubmit(e);
                }
            }

            // 3. CTRL + ENTER = Simpan Data (Alternatif)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (isFormReady && !loading) {
                    handleSubmit(e);
                }
            }

            // 4. CTRL + P = Print SOAP
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault(); 
                if (formData && formData.name) {
                    setSelectedRecordForPrint(formData);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [formData, isFormReady, loading, handleSubmit, setSelectedRecordForPrint, showSmartPaste, showLabModal, showRadModal, showLabTrend]);

    if (!showInputModal) return null;
    
    // DATA LACAK LENGKAP
    const lacakOptions = [
        ...LAB_CHECKS,
        ...RADIOLOGY_CHECKS,
        ...MEDICATIONS,
        ...PROCEDURES,
    ];

    // --- HELPER STRINGS ---
    const toTitleCase = (str) => str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
    const cleanCase = (str) => { if (!str) return ''; return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase()); };

    // --- SMART PASTE V5 (APPEND MODE: GAK NIMPA DATA LAMA) ---
    const handleProcessSmartPaste = () => {
        if (!rawPasteData.trim()) return;

        // Helper: Bersihkan Teks
        const cleanCase = (str) => { if (!str) return ''; return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase()); };

        // Helper Penting: GABUNGKAN TEKS (LAMA + BARU)
        const appendText = (fieldName, newText) => {
            if (!newText || !newText.trim()) return; // Kalau kosong gak usah diproses
            
            const currentText = formData[fieldName] || ''; // Ambil teks yang sudah ada
            
            // Kalau kolom masih kosong, langsung isi.
            if (!currentText.trim()) {
                handleInputChange({ target: { name: fieldName, value: newText.trim() } });
            } 
            // Kalau sudah ada isinya, tambahkan di bawahnya (kasih jarak 2 Enter)
            else {
                handleInputChange({ target: { name: fieldName, value: `${currentText.trim()}\n\n${newText.trim()}` } });
            }
        };

        let text = rawPasteData;
        
        // Bersihkan Header Ecalyptus umum
        let cleanText = text
            .replace(/Tanda Vital/gi, '')
            .replace(/Angka/gi, '')
            .replace(/Catatan/gi, ''); 

        // --- SKENARIO 1: CEK HEADER STANDAR (S/O/A/P) ---
        const sMatch = cleanText.match(/Subjektif([\s\S]*?)(?=Objektif|$)/i);
        const oMatch = cleanText.match(/Objektif([\s\S]*?)(?=Assesmen|Asesmen|$)/i);
        const aMatch = cleanText.match(/(?:Assesmen|Asesmen)([\s\S]*?)(?=Rencana|$)/i);
        const pMatch = cleanText.match(/Rencana([\s\S]*)/i);

        if (sMatch || oMatch || aMatch || pMatch) {
            // Gunakan Helper 'appendText' biar gak nimpa
            if (sMatch && sMatch[1]) appendText('subjective', cleanCase(sMatch[1].trim()));
            if (oMatch && oMatch[1]) appendText('objective', cleanCase(oMatch[1].trim()));
            if (aMatch && aMatch[1]) appendText('analysis', cleanCase(aMatch[1].trim()));
            
            // P (Planning) diproses khusus
            if (pMatch && pMatch[1]) processPlanningText(pMatch[1]);
            
        } else {
            // --- SKENARIO 2: DETEKTIF (TANPA HEADER) ---
            let sLines = [], oLines = [], aLines = [], pLines = [];
            const lines = cleanText.split('\n');
            const keywords = {
                S: ['mengeluh', 'keluhan', 'riwayat', 'datang', 'mual', 'muntah', 'pusing', 'nyeri', 'demam', 'batuk', 'sesak', 'bab', 'bak'],
                O: ['lacak', 'mmhg', 'gcs', 'nadi', 'suhu', 'rr', 'spo2', 'td', 'compos', 'mentis', 'apatis', 'somnolen', 'sopor', 'coma', 'akral', 'crt', 'thorax', 'usg', 'rontgen', 'foto', 'ct scan', 'mri', 'kesan', 'kesimpulan'],
                A: ['diagnosa', 'diagnosis', 'susp', 'dd', 'post op', 'post'],
                P: ['rencana', 'terapi', 'instruksi', 'infus', 'inj', 'tab', 'cap', 'drip', 'diet', 'monitor', 'nebu', 'inhalasi', 'o2', 'lpm', 'tpm', 'ml/jam', 'cc/jam', 'pro', 'konsul', 'rawat', 'pulang', 'kontrol', 'x1', 'x 1']
            };

            lines.forEach(line => {
                const lower = line.toLowerCase().trim();
                if (!lower) return;
                if (keywords.P.some(k => lower.includes(k)) || /\d+\s*x\s*\d+/.test(lower) || /\d+\s*mg/.test(lower) || /\d+\s*gr/.test(lower)) { pLines.push(line); }
                else if (keywords.A.some(k => lower.includes(k))) { aLines.push(line); }
                else if (keywords.O.some(k => lower.includes(k))) { oLines.push(line); }
                else if (keywords.S.some(k => lower.includes(k))) { sLines.push(line); }
                else {
                    if (pLines.length > 0 && sLines.length === 0 && oLines.length === 0 && aLines.length === 0) { pLines.push(line); } 
                    else { pLines.push(line); }
                }
            });

            // Gunakan Helper 'appendText'
            if (sLines.length > 0) appendText('subjective', cleanCase(sLines.join('\n')));
            if (oLines.length > 0) appendText('objective', cleanCase(oLines.join('\n')));
            if (aLines.length > 0) appendText('analysis', cleanCase(aLines.join('\n')));
            if (pLines.length > 0) processPlanningText(pLines.join('\n'));
        }

        setShowSmartPaste(false); setRawPasteData('');
    };

    // --- PROSES PLANNING (UPDATE: APPEND MODE) ---
    const processPlanningText = (rawText) => {
        const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
        const cleanCase = (str) => { if (!str) return ''; return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase()); };

        let finalPlanning = [];
        let prescriptionList = [];
        const lines = rawText.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const lowerLine = trimmed.toLowerCase();
            if (lowerLine.match(/nama obat|nama resep|aturan pakai|cara penggunaan|no\. resep|^resep -|^-$|^_$/)) return;

            let isMedicine = false;
            let drugName = '';
            let dosage = '';
            
            // LOGIKA DETEKSI OBAT (Sama seperti sebelumnya)
            const tableMatch = trimmed.match(/(\d+)\s*dd\s*(\d+)/i);
            const manualMatch = trimmed.match(/(.*?)\s+(\d+\s*[xX]\s*[\d\.,]+.*)/);
            const infusMatch = trimmed.match(/(.*?)\s+(\d+\s*(?:tpm|cc\/jam|ml\/jam|tetes))/i);
            const nebuMatch = trimmed.match(/(?:nebu|inhalasi|uap)\s+(.*)/i);
            const freqMatch = trimmed.match(/(.*?)\s+(\/\s*\d+\s*(?:jam|j)|k\/p|prn)/i);

            if (tableMatch) {
                if (index > 0) {
                    let prevLine = lines[index - 1].trim().replace(/Nama Obat|No\. Resep|-/gi, '').trim();
                    if (prevLine.length > 2) { drugName = prevLine; dosage = `${tableMatch[1]}x${tableMatch[2]}`; isMedicine = true; }
                }
            } 
            else if (manualMatch) { drugName = manualMatch[1].trim(); dosage = manualMatch[2].trim().replace(/\s*[xX]\s*/, 'x'); if (drugName.length > 2) isMedicine = true; }
            else if (infusMatch) { drugName = infusMatch[1].trim(); dosage = infusMatch[2].trim(); if (!drugName) drugName = "Cairan Infus"; isMedicine = true; }
            else if (nebuMatch) { drugName = "Nebu " + nebuMatch[1].trim(); dosage = "Sesuai Jadwal"; isMedicine = true; }
            else if (freqMatch) { drugName = freqMatch[1].trim(); dosage = freqMatch[2].trim(); if (drugName.length > 2) isMedicine = true; }

            if (isMedicine) { prescriptionList.push(`• ${toTitleCase(drugName)} (${dosage})`); } 
            else { 
                const nextLine = lines[index + 1] || '';
                if (!nextLine.match(/(\d+)\s*dd\s*(\d+)/i)) { finalPlanning.push(cleanCase(trimmed)); }
            }
        });

        let resultP = finalPlanning.join('\n').trim();
        if (prescriptionList.length > 0) { resultP += `\n\n-- TERAPI OBAT (DARI ECAL) --\n${prescriptionList.join('\n')}`; }

        // --- INI BAGIAN KUNCINYA (APPEND) ---
        const currentP = formData.planning || '';
        if (currentP.trim()) {
            // Kalau sudah ada catatan operan, tambahkan di bawahnya
            handleInputChange({ target: { name: 'planning', value: `${currentP.trim()}\n\n${resultP}` } });
        } else {
            // Kalau kosong, langsung isi
            handleInputChange({ target: { name: 'planning', value: resultP } });
        }
    };

    // --- [UPDATE V10] SMART LAB: FULL TEXT PARSER & HEADER CLEANER ---
    const processLabData = () => {
        if (!rawLabData) return;
        
        // 1. KAMUS MANUAL (Lengkap)
        const manualDictionary = [
            { key: 'Hb', reg: /(?:Hemoglobin|Hb)/i },
            { key: 'Leu', reg: /(?:Leukosit|Leu|WBC)/i },
            { key: 'Trmbsit', reg: /(?:Trombosit|Plt|Platelet|Trmbsit)/i },
            { key: 'Ht', reg: /(?:Hematokrit|Ht|HCT)/i },
            { key: 'Na', reg: /(?:Natrium|\bNa\b|Sodium)/i },
            { key: 'K', reg: /(?:Kalium|\bK\b|Potassium)/i },
            { key: 'Cl', reg: /(?:Clorida|Chloride|\bCl\b|Klorida)/i },
            { key: 'GDS', reg: /(?:Gula Darah Sewaktu|GDS|Glukosa Sewaktu|Kadar Gula)/i },
            { key: 'GDP', reg: /(?:Gula Darah Puasa|GDP|Glukosa Puasa)/i },
            { key: 'HbA1c', reg: /(?:HbA1c|Haemoglobin A1c)/i },
            { key: 'Ur', reg: /(?:Ureum|Ur|Urea)/i },
            { key: 'Cr', reg: /(?:Kreatinin|Creatinin|\bCr\b)/i },
            { key: 'Alb', reg: /(?:Albumin|Alb)/i },
            { key: 'SGOT', reg: /(?:SGOT|AST|Aspartate)/i },
            { key: 'SGPT', reg: /(?:SGPT|ALT|Alanine)/i },
            { key: 'Bil.Tot', reg: /(?:Bilirubin Total)/i },
            { key: 'Bil.Dir', reg: /(?:Bilirubin Direct|Direk)/i },
            { key: 'Bil.Ind', reg: /(?:Bilirubin Indirect|Indirek)/i },
            { key: 'PT', reg: /\bPT\b/i },
            { key: 'INR', reg: /INR/i },
            { key: 'APTT', reg: /APTT/i },
            { key: 'Trop-I', reg: /(?:Troponin I|Trop I)/i },
            { key: 'Trop-T', reg: /(?:Troponin T|Trop T)/i },
            { key: 'CK-MB', reg: /CK-MB/i },
            { key: 'D-Dimer', reg: /D-Dimer/i },
            { key: 'LED', reg: /(?:Laju Endap|LED|ESR)/i },
            { key: 'CRP', reg: /CRP/i },
            { key: 'Procal', reg: /(?:Procalcitonin|PCT)/i },
            { key: 'Ferritin', reg: /Ferritin/i },
            { key: 'Ca', reg: /(?:Calsium|Kalsium|\bCa\b)/i },
            { key: 'Mg', reg: /(?:Magnesium|\bMg\b)/i },
            { key: 'Sputum', reg: /Sputum|BTA/i },
            { key: 'TCM', reg: /TCM|GeneXpert|MTB/i },
            { key: 'Ag', reg: /(?:Antigen|Swab Ag)/i },
            { key: 'PCR', reg: /PCR/i },
            { key: 'BT', reg: /(?:Bleeding Time|Masa Perdarahan|\bBT\b)/i },
            { key: 'CT', reg: /(?:Clotting Time|Masa Pembekuan|\bCT\b)/i },
            // V10: Gram, Kultur, HIV
            { key: 'Gram', reg: /Gram|Pewarnaan/i }, 
            { key: 'CD4', reg: /CD4/i },
            { key: 'Kultur', reg: /Kultur|Culture/i },
            { key: 'HIV', reg: /HIV|Anti-HIV/i },
            { key: 'HBsAg', reg: /HBsAg/i },
            { key: 'Anti-HCV', reg: /Anti-HCV|HCV/i },
        ];

        // 2. TES YANG HASILNYA KALIMAT PANJANG (DESCRIPTIVE)
        const descriptiveTests = ['Sputum', 'TCM', 'Gram', 'Kultur', 'Ag', 'PCR', 'HIV', 'HBsAg', 'HCV'];

        // 3. KAMUS GLOBAL
        const globalSources = [...(typeof LAB_CHECKS !== 'undefined' ? LAB_CHECKS : []), ...(typeof RADIOLOGY_CHECKS !== 'undefined' ? RADIOLOGY_CHECKS : [])];
        const dynamicDictionary = globalSources.flatMap(item => {
            return item.split(/[\/,]/).map(part => {
                let cleanKey = part.replace(/\(.*\)/, '').trim();
                if (!cleanKey || cleanKey.length < 2) return null;
                const escapedKey = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return { key: cleanKey, reg: new RegExp(escapedKey, 'i') };
            }).filter(Boolean);
        });

        const combinedDictionary = [...manualDictionary, ...dynamicDictionary];
        let results = [];
        let pendingName = null; 

        // 4. PROSES BARIS DEMI BARIS
        const lines = rawLabData.split('\n').map(l => l.trim()).filter(l => l);

        lines.forEach(line => {
            // A. BERSIHKAN SAMPAH HEADER ECALYPTUS (V10 FIX)
            if (/Mikrobiologi|Kimia|Hematologi|Imuno|Rincian Tindakan|Satuan|Nilai Rujukan|Status|Riwayat/i.test(line)) {
                return; 
            }

            let cleanLine = line
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/(High|Low|\(H\)|\(L\)|\*|mg\/dL|mmol\/L|g\/dL|u\/L|%)/gi, '') 
                .replace(/Normal|Rujukan|Nilai/gi, '') 
                .trim();

            if (!cleanLine) return;

            // B. DETEKSI NAMA TES
            let foundKey = null;
            let usedKeyString = ''; 

            for (let item of combinedDictionary) {
                if (item.reg.test(cleanLine)) { 
                    foundKey = item.key; 
                    const match = cleanLine.match(item.reg);
                    if(match) usedKeyString = match[0];
                    break; 
                }
            }
            
            // Mode Belajar (Generic)
            if (!foundKey) {
                const isGarbage = /satuan|hasil|metode|keterangan|pemeriksaan|analisa|dokter|tanda tangan|verifikasi/i.test(cleanLine);
                const isResultKeyword = /(?:Positif|Negatif|Reaktif|Non|Detected|Tidak|Resistan|Sensitif|Sensitive|Resistance|Terlampir|Ditemukan)/i.test(cleanLine);
                const hasNumber = /\d/.test(cleanLine);
                
                if (!hasNumber && !isGarbage && !isResultKeyword && cleanLine.length < 35 && cleanLine.length > 2) {
                    foundKey = cleanLine; 
                    usedKeyString = cleanLine;
                }
            }

            // --- FUNGSI PENCARI NILAI (V10: DESCRIPTIVE FULL TEXT) ---
            const findValue = (text, keyName) => {
                // KASUS 1: TES DESKRIPTIF (Gram, Sputum, dll)
                if (keyName && descriptiveTests.some(dt => keyName.includes(dt))) {
                    const descVal = text.replace(/[:]/g, '').trim(); 
                    if (descVal.match(/dengan Reagen/i) && descVal.length < 20) return null; 
                    if (descVal.length < 2) return null; 
                    return descVal; // KEMBALIKAN SEMUA TEKS SISA
                }

                // KASUS 2: TES BIASA
                const numMatch = text.match(/(\d{1,5}(?:[\.,']\d+)?)/);
                const isRange = /-|–|<|>/.test(text); 
                const isDate = /\/|:/.test(text); 
                if (numMatch && !isRange && !isDate) return numMatch[0];

                const textMatch = text.match(/(?:Non[- ]?Reaktif|Positif|Negatif|Reaktif|Non|Detected|Tidak|Resistan|Sensitif|Sensitive|Resistance|Terlampir|\+\+\+|\+\+|\+)/i);
                if (textMatch) return textMatch[0];

                return null;
            };

            if (foundKey) {
                pendingName = foundKey;
                let textWithoutKey = cleanLine.replace(usedKeyString, '').trim(); 
                const val = findValue(textWithoutKey, foundKey);
                
                if (val) {
                    results.push(`${pendingName} ${val}`);
                    pendingName = null; 
                }
            }
            else if (pendingName) {
                const val = findValue(cleanLine, pendingName);
                if (val) {
                    results.push(`${pendingName} ${val}`);
                    pendingName = null; 
                }
            }
        });

        if (results.length > 0) {
            const uniqueResults = [...new Set(results)];
            const finalString = "Lab:\n" + uniqueResults.join('\n');
            appendText('objective', finalString);
        } else {
             if (confirm("Format tidak terbaca otomatis. Tempel teks mentah saja?")) {
                 appendText('objective', "Lab (Raw):\n" + rawLabData);
             }
        }

        setRawLabData('');
        setShowLabModal(false);
    };

    const processRadData = () => {
        if (!rawRadData.trim()) return;
        let cleanText = rawRadData.trim();
        appendText('objective', `Rad:\n${cleanText}`);
        setRawRadData(''); setShowRadModal(false);
    };

    // --- ANALISA TREN LAB ---
    const analyzeLabTrends = () => {
        const currentData = { objective: formData.objective, updatedAt: new Date() };
        const allLogs = [...historyLogs].reverse(); 
        allLogs.push(currentData); 

        const trends = { 'Hb': [], 'Leu': [], 'Plt': [], 'Ht': [], 'GDS': [], 'Na': [], 'K': [], 'Cl': [], 'Alb': [], 'Cr': [], 'Ur': [] };
        const patterns = {
            'Hb': /(?:Hb|Hemoglobin)[\s:.-]*(\d+(?:\.\d+)?)/i,
            'Leu': /(?:Leu|Leukosit)[\s:.-]*(\d{1,3}(?:\.?\d{3})*)/i,
            'Plt': /(?:Plt|Trombosit|Trombo)[\s:.-]*(\d{1,3}(?:\.?\d{3})*)/i,
            'Ht': /(?:Ht|Hematokrit)[\s:.-]*(\d+(?:\.\d+)?)/i,
            'GDS': /(?:GDS|Gula Darah)[\s:.-]*(\d{2,3})/i,
            'Na': /(?:Na|Natrium)[\s:.-]*(\d{2,3})/i,
            'K': /(?:K|Kalium)[\s:.-]*(\d+(?:\.\d+)?)/i,
            'Cl': /(?:Cl|Clorida)[\s:.-]*(\d{2,3})/i,
            'Ur': /(?:Ur|Ureum)[\s:.-]*(\d{2,3})/i,
            'Cr': /(?:Cr|Kreatinin)[\s:.-]*(\d+(?:\.\d+)?)/i,
            'Alb': /(?:Alb|Albumin)[\s:.-]*(\d+(?:\.\d+)?)/i,
        };

        allLogs.forEach(log => {
            if (!log.objective) return;
            const text = log.objective;
            const dateObj = log.updatedAt && log.updatedAt.seconds ? new Date(log.updatedAt.seconds * 1000) : (log.updatedAt || new Date());
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric' });

            Object.keys(patterns).forEach(key => {
                const match = text.match(patterns[key]);
                if (match) { trends[key].push({ date: dateStr, val: match[1] }); }
            });
        });
        setLabTrends(trends); setShowLabTrend(!showLabTrend);
    };

    const insertTrendToO = (key) => {
        const data = labTrends[key];
        if (!data || data.length === 0) return;
        const lastItems = data.slice(-4);
        const todayObj = new Date();
        const todayStr = todayObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric' });
        const valueChain = lastItems.map(d => {
            const dateLabel = d.date === todayStr ? 'Hari ini' : d.date;
            return `${d.val} (${dateLabel})`;
        }).join(' -> ');
        appendText('objective', `${key}: ${valueChain}`);
    };

    const handleQuickAction = (action) => {
        const tempRec = { 
            ...formData, id: currentRecordId || 'temp', roomNumber: formData.roomNumber, name: formData.name, dpjpName: formData.dpjpName
        };
        if (action === 'print') setSelectedRecordForPrint(tempRec);
        if (action === 'lapor') setRecordForLapor(tempRec);
        if (action === 'discharge') handleDischarge(currentRecordId, formData.name);
    };

    const handleClearSoap = () => {
        if(window.confirm("Kosongkan semua kolom SOAP untuk operan baru?")) {
            handleInputChange({ target: { name: 'subjective', value: '' } });
            handleInputChange({ target: { name: 'objective', value: '' } });
            handleInputChange({ target: { name: 'analysis', value: '' } });
            handleInputChange({ target: { name: 'planning', value: '' } });
        }
    };

    const priorityDocs = ["dr. Delvi, Sp.PD", "dr. Dian Ekowati, Sp.PD", "dr. Evan, Sp.P", "dr. Priyo, Sp.PD", "dr. Risa, Sp.PD", "dr. Susilo, Sp.PD"];
    const sortedDpjpOptions = [...(dpjpOptions || [])].sort((a, b) => {
        const idxA = priorityDocs.indexOf(a);
        const idxB = priorityDocs.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.toString().localeCompare(b.toString());
    });

    // --- RENDER UTAMA ---
    return (
        <div className="h-full bg-white border-l border-gray-300 flex flex-col shadow-xl relative overflow-hidden">
            
            {/* A. HEADER BARU */}
            <div className="px-3 py-2 border-b flex justify-between items-center bg-gray-50 shadow-sm z-20 flex-shrink-0 relative">
                <div className="leading-tight overflow-hidden mr-2">
                    <h2 className="font-bold text-xs text-gray-800 truncate max-w-[150px]">
                        {isEditing ? formData.name : 'Pasien Baru'}
                    </h2>
                    <p className="text-[9px] text-gray-500 font-bold">{formData.roomNumber || 'Pilih Kamar'}</p>
                </div>
                
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isEditing && (
                        <>
                            {/* TOMBOL OBAT (CPO) */}
                            <button type="button" onClick={onPrintCPO} className="p-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] shadow-sm hover:bg-blue-200 ml-1" title="Cetak CPO (Obat)">💊</button>
                            <button type="button" onClick={() => handleQuickAction('lapor')} className="p-1.5 bg-green-100 text-green-700 border border-green-200 rounded text-[10px] shadow-sm hover:bg-green-200" title="Draft Lapor">📱</button>
                            <button type="button" onClick={() => handleQuickAction('print')} className="p-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] shadow-sm hover:bg-gray-200" title="Print (Ctrl+P)">🖨️</button>                            
                            <button type="button" onClick={() => handleQuickAction('discharge')} className="p-1.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] shadow-sm hover:bg-red-100" title="Pulangkan">🚪</button>                            
                            
                            {handleDeleteRecord && (
                                <button type="button" onClick={() => handleDeleteRecord(currentRecordId, formData.name)} className="p-1.5 bg-red-600 text-white border border-red-700 rounded text-[10px] shadow-sm hover:bg-red-800 ml-1" title="Hapus Data Permanen">🗑️</button>
                            )}
                            <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>
                        </>
                    )}
                    
                    <button 
                        onClick={handleSubmit} 
                        disabled={loading || !isFormReady} 
                        className={`p-1.5 rounded text-white shadow-sm transition flex items-center justify-center ${loading || !isFormReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        title="Simpan Data (Ctrl+S)"
                    >
                        {loading ? '...' : '💾'}
                    </button>

                    <button onClick={() => { setShowInputModal(false); resetForm(); }} className="p-1.5 bg-white text-gray-400 border border-gray-200 rounded hover:bg-red-50 hover:text-red-500 transition shadow-sm" title="Tutup (Esc)">
                        ✕
                    </button>
                </div>
            </div>
            
            {/* B. AREA SCROLL FORM */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-gray-50/50 relative z-0">
                <div className="p-4">
                    {/* 1. Form Identitas */}
                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-3">
                        <form onSubmit={handleSubmit} id="mainForm">
                            <div className="flex space-x-2 mb-2">
                                <div className="w-[25%]"><CustomSelect label="Km" value={formData.roomNumber} onChange={(e) => handleInputChange({ target: { name: 'roomNumber', value: e.target.value } })} options={availableRooms} /></div>
                                <div className="w-[25%]">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Gender *</label>
                                    <select className="w-full p-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white" value={formData.gender} onChange={(e) => handleInputChange({ target: { name: 'gender', value: e.target.value } })} required>
                                        <option value="" disabled>-</option><option value="L">Lk</option><option value="P">Pr</option>
                                    </select>
                                </div>
                                <div className="w-[50%]"><CustomInput label="Nama Pasien" name="name" value={formData.name} onChange={handleInputChange} /></div>
                            </div>

                            <div className="mb-2">
                                <div className="flex space-x-2 mb-1">
                                    <CustomSelect label="DPJP Utama" value={formData.dpjpName} onChange={(e) => handleInputChange({ target: { name: 'dpjpName', value: e.target.value } })} options={sortedDpjpOptions} />
                                    <div className="w-1/2">
                                        {showRaber1 ? (
                                            <div className="relative"><CustomSelect label="Raber 1" value={formData.raberName} onChange={(e) => handleInputChange({ target: { name: 'raberName', value: e.target.value } })} options={dpjpOptions} /><button type="button" onClick={() => { setShowRaber1(false); handleInputChange({ target: { name: 'raberName', value: '' } }); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition">✕</button></div>
                                        ) : (<button type="button" onClick={() => setShowRaber1(true)} className="text-[10px] mt-6 text-blue-600 underline font-bold hover:text-blue-800 transition">+ Tambah Raber 1</button>)}
                                    </div>
                                </div>
                                {showRaber1 && (
                                    <div className="flex space-x-2"><div className="w-1/2"></div><div className="w-1/2">{showRaber2 ? (<div className="relative"><CustomSelect label="Raber 2" value={formData.raber2Name} onChange={(e) => handleInputChange({ target: { name: 'raber2Name', value: e.target.value } })} options={dpjpOptions} /><button type="button" onClick={() => { setShowRaber2(false); handleInputChange({ target: { name: 'raber2Name', value: '' } }); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition">✕</button></div>) : (<button type="button" onClick={() => setShowRaber2(true)} className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition">+ Tambah Raber 2</button>)}</div></div>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* 2. SOAP Fields */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1 mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Catatan SOAP Hari Ini</span>
                            <div className="flex gap-1">                                
                                <button type="button" onClick={() => setShowSmartPaste(true)} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded border border-indigo-700 hover:bg-indigo-700 transition font-bold shadow-sm flex items-center animate-pulse">
                                    ⚡ Paste
                                </button>
                                <button type="button" onClick={handleClearSoap} className="text-[9px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm">
                                    🗑️ Reset
                                </button>
                            </div>
                        </div>

                        {/* PANEL TREN LAB (AKAN MUNCUL JIKA DIKLIK) */}
                        {showLabTrend && (
                            <div className="mb-2 bg-orange-50 border border-orange-200 rounded-lg p-2 animate-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2 border-b border-orange-200 pb-1">
                                    <h4 className="text-[10px] font-bold text-orange-800 uppercase">Riwayat Hasil Lab (Auto-Detect)</h4>
                                    <button onClick={() => setShowLabTrend(false)} className="text-orange-400 hover:text-orange-600 font-bold text-xs">✕</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.keys(labTrends).map(key => {
                                        const items = labTrends[key];
                                        if (items.length < 2) return null;
                                        const lastItems = items.slice(-4); 
                                        const displayStr = lastItems.map(i => i.val).join(' → ');
                                        return (
                                            <button 
                                                key={key} type="button" onClick={() => insertTrendToO(key)}
                                                className="col-span-3 text-left bg-white border border-orange-100 p-2 rounded hover:bg-orange-100 transition group flex flex-col shadow-sm"
                                            >
                                                <div className="flex justify-between w-full">
                                                    <span className="font-bold text-[10px] text-gray-700">{key}</span>
                                                    <span className="text-[9px] text-green-600 font-bold opacity-0 group-hover:opacity-100">+ Masukkan</span>
                                                </div>
                                                <div className="text-[10px] font-mono text-indigo-900 mt-1 truncate w-full">{displayStr}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <CustomTextArea label="S (Subjektif)" name="subjective" value={formData.subjective} onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('subjective') : null} pullLabel="Salin S Lalu" />
                        
                        <CustomTextArea label="O (Objektif)" name="objective" value={formData.objective} onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('objective') : null} pullLabel="Salin O Lalu"
                            extraButtons={
                                <div className="flex gap-1">
                                    <button type="button" onClick={analyzeLabTrends} className={`text-[9px] px-2 py-0.5 rounded border font-bold shadow-sm transition ${showLabTrend ? 'bg-orange-600 text-white border-orange-700' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}>📈 Tren</button>
                                    <button type="button" onClick={() => setShowLabModal(true)} className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition font-bold shadow-sm">🧪 Lab</button>
                                    <button type="button" onClick={() => setShowRadModal(true)} className="text-[9px] bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-100 transition font-bold shadow-sm">☢️ Rad</button>
                                    <button type="button" onClick={() => setShowTtvModal(true)} className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 hover:bg-green-100 transition font-bold shadow-sm">+ TTV</button>
                                </div>
                            } 
                        >
                            <div className="mb-1"><TagSelector label="" options={lacakOptions} placeholder="Lacak Lab/Rad..." category="Lacak" onSelect={(_, item) => appendText('objective', `Lacak/Lapor ${item}`)} /></div>
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

                {/* 3. RIWAYAT */}
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
                                        <button type="button" onClick={() => setRecordForLapor(log)} className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded text-[9px] font-bold hover:bg-green-200 flex items-center transition">📱 WA</button>
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

            {/* MODAL-MODAL PENDUKUNG */}
            {/* Modal Smart Paste */}
            {showSmartPaste && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl border-2 border-indigo-500 p-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">⚡ Smart Paste Ecalyptus</h3>
                            <button onClick={() => setShowSmartPaste(false)} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>
                        <div className="text-[10px] text-gray-600 mb-2 bg-blue-50 p-2 rounded border border-blue-100">1. Di Ecalyptus, Blok dari <b>"Subjektif"</b> s/d <b>Akhir Tabel Obat</b>.<br/>2. Copy (Ctrl+C).<br/>3. Paste di kotak bawah ini.</div>
                        <textarea className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none mb-3" placeholder="Paste teks Ecalyptus di sini..." value={rawPasteData} onChange={(e) => setRawPasteData(e.target.value)} autoFocus />
                        <div className="flex gap-2"><button onClick={() => setShowSmartPaste(false)} className="flex-1 py-2 text-xs border rounded hover:bg-gray-100">Batal</button><button onClick={handleProcessSmartPaste} className="flex-1 py-2 text-xs bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-md">Proses & Masukkan 🚀</button></div>
                    </div>
                </div>
            )}
            {/* Modal Lab */}
            {showLabModal && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl border-2 border-blue-500 p-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">🧪 Paste Hasil Lab</h3><button onClick={() => setShowLabModal(false)} className="text-gray-400 hover:text-red-500">✕</button></div>
                        <div className="text-[10px] text-gray-600 mb-2 bg-blue-50 p-2 rounded border border-blue-100">Paste hasil lab mentah (GDS, Elektrolit, dll) di bawah.</div>
                        <textarea className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none mb-3" placeholder="Contoh Paste:&#10;Gula Darah Sewaktu 199 High&#10;Natrium 137..." value={rawLabData} onChange={(e) => setRawLabData(e.target.value)} autoFocus />
                        <div className="flex gap-2"><button onClick={() => setShowLabModal(false)} className="flex-1 py-2 text-xs border rounded hover:bg-gray-100">Batal</button><button onClick={processLabData} className="flex-1 py-2 text-xs bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-md">Proses ke O ⬇️</button></div>
                    </div>
                </div>
            )}
            {/* Modal Radiologi */}
            {showRadModal && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl border-2 border-gray-500 p-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">☢️ Input Radiologi</h3><button onClick={() => setShowRadModal(false)} className="text-gray-400 hover:text-red-500">✕</button></div>
                        <div className="text-[10px] text-gray-600 mb-2 bg-gray-50 p-2 rounded border border-gray-100">Paste bagian <b>"KESAN"</b> atau <b>"KESIMPULAN"</b> saja.</div>
                        <textarea className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono focus:ring-2 focus:ring-gray-500 outline-none mb-3" placeholder="Contoh:&#10;Cor tak membesar..." value={rawRadData} onChange={(e) => setRawRadData(e.target.value)} autoFocus />
                        <div className="flex gap-2"><button onClick={() => setShowRadModal(false)} className="flex-1 py-2 text-xs border rounded hover:bg-gray-100">Batal</button><button onClick={processRadData} className="flex-1 py-2 text-xs bg-gray-700 text-white font-bold rounded hover:bg-gray-800 shadow-md">Masukkan ke O ⬇️</button></div>
                    </div>
                </div>
            )}
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