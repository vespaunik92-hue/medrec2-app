import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
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
    enableIndexedDbPersistence 
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

const DEFAULT_JAGA_LINK = 'https://chat.whatsapp.com/IWNKTqRb0GAJnvRP4WiS2J?mode=hqrc'; 

const DEFAULT_DPJP_DATA = [
    { name: 'dr. Delvi, Sp.PD', waNumber: '6281283812875' },
    { name: 'dr. Susilo, Sp.PD', waNumber: '6282119395835' },
    { name: 'dr. Dian Ekowati, Sp.PD', waNumber: '6281210680279' },
    { name: 'dr. Priyo, Sp.PD', waNumber: '62811220364' },
    { name: 'dr. Risa, Sp.PD', waNumber: '6281316198500' },
    { name: 'dr. Evan, Sp.P', waNumber: '6281210100626' }
];

const initialDpjpProfiles = DEFAULT_DPJP_DATA;

const LAB_CHECKS = [
    'Darah Rutin', 'Darah Lengkap', 'Masa Pendarahan (BT/CT)', 'PT/APTT/INR',
    'GDS', 'GDP/2JPP', 'HbA1c', 'TSH/FT4', 'Procalcitonin', 'Ferritin', 'D-Dimer',
    'Ureum/Creatinin', 'SGOT/SGPT', 'Albumin/Globulin', 'Bilirubin Total/Direk',
    'Elektrolit (Na/K/Cl)', 'Analisa Gas Darah (AGD)', 'Lactate',
    'Profil Lipid (Kolesterol)', 'Asam Urat',
    'Urinalisis', 'Kultur Darah/Urin', 'TCM TB', 'HBsAg/Anti-HBs/Anti-HCV/Anti-HIV',
    'Troponin T/I', 'CK-MB', 'Titer Widal', 'CRP Kuantitatif', 'ProBNP'
];

const RADIOLOGY_CHECKS = [
    'Thorax PA/AP', 'Thorax Lateral', 'BNO Abdomen', 'Lumbosacral', 'Cervical', 'Foto Ekstremitas',
    'USG Whole Abdomen', 'USG Upper Abdomen', 'USG Lower Abdomen', 'USG Thorax', 'USG Tiroid', 'USG Ginjal', 'USG Kandung Empedu',
    'CT Scan Kepala Polos', 'CT Scan Thorax', 'CT Scan Abdomen', 'CT Scan Vertebra', 'CT Angiography',
    'MRI Kepala', 'MRI Vertebra', 'MRI Lutut', 'MRI Pelvis',
    'Echocardiography', 'Endoskopi', 'Kolonoskopi', 'Bronkoskopi', 'Angiography Koroner'
];

const PROCEDURES = [
    'Pasang Infus', 'Pasang Kateter', 'Pasang NGT', 'Nebulizer', 'Oksigenasi', 'Pemasangan Ventilator',
    'EKG', 'Ganti Balutan', 'Suction', 'Injeksi Extra', 'Syringe Pump', 'Transfusi Darah', 'Transfusi Leukosit', 'Hemodialisa (HD)', 
    'Rawat Luka', 'Angkat Jahitan', 'Spooling Kateter', 'Bladder Training', 'Biopsi Sumsum Tulang',
    'Parasintesis', 'Torakosintesis', 'Pungsi Lumbal', 'Aspirasi Sendi'
];

// --- COMPONENTS: LOGIN PAGE (REBRANDED) ---
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validasi sederhana
    if(username && password) {
        onLogin();
    } else {
        alert("Mohon isi username dan password");
    }
  };

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden max-h-[600px]">
        
        {/* Left Side: Visual/Branding */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-800 p-10 text-white flex flex-col justify-center relative">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/medical-icons.png')]"></div>
            <div className="relative z-10">
                <h1 className="text-4xl font-extrabold mb-2 tracking-tight">MedRec Assistant</h1>
                <p className="text-blue-100 text-sm mb-8">Aplikasi Bantu Operan Jaga & Manajemen Pasien</p>
                <div className="space-y-3 text-xs font-medium text-blue-200">
                    <div className="flex items-center"><span className="mr-2">✓</span> SOAP / APOS Record</div>
                    <div className="flex items-center"><span className="mr-2">✓</span> Real-time Collaboration</div>
                    <div className="flex items-center"><span className="mr-2">✓</span> Auto-Print Formatting (A5)</div>
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

// --- Lapor WA Confirmation Modal ---
const LaporConfirmationModal = ({ onLaporDpjp, onLaporJaga, onCancel, patientName }) => {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-green-100">
                <h3 className="text-sm font-bold text-green-800 mb-3 border-b pb-1">Lapor Pasien {patientName}</h3>
                <p className="text-sm mb-4">Pilih ke siapa Anda akan mengirim Laporan SOAP/APOS ini:</p>
                <div className="flex justify-between space-x-2">
                    <button onClick={onLaporDpjp} className="flex-1 px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold shadow-md">
                        Lapor DPJP Utama
                    </button>
                    <button onClick={onLaporJaga} className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 font-bold shadow-md">
                        Lapor Dr. Jaga (Grup)
                    </button>
                </div>
                <button onClick={onCancel} className="mt-3 w-full px-3 py-1 text-xs border rounded hover:bg-gray-100 text-gray-500">Batal</button>
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
                                {labs.length > 0 && <div className="flex items-start"><span className="font-bold w-16 flex-shrink-0 text-[10px] uppercase pt-0.5">Laboratorium</span><span className="flex-1">: {labs.join(', ')}</span></div>}
                                {rads.length > 0 && <div className="flex items-start"><span className="font-bold w-16 flex-shrink-0 text-[10px] uppercase pt-0.5">Radiologi</span><span className="flex-1">: {rads.join(', ')}</span></div>}
                                {tms.length > 0 && <div className="flex items-start"><span className="font-bold w-16 flex-shrink-0 text-[10px] uppercase pt-0.5">Tindakan</span><span className="flex-1">: {tms.join(', ')}</span></div>}
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

// --- UI COMPONENTS BARU (PETA & TABEL) ---

const RoomMap = ({ roomList, activeRecords, onSelectRoom, onEditRoom, roomFilter }) => {
    const filteredRoomList = roomList.filter(room => roomFilter.includes(room));
    const emptyCount = roomList.length - activeRecords.length;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
        <div className="bg-indigo-50 p-2 border-b border-indigo-100 flex justify-between items-center">
             <h2 className="text-xs font-bold text-indigo-800 uppercase">Peta Kamar <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-800 rounded text-[9px] border border-green-200">Sisa: {emptyCount}</span></h2>
             <div className="flex space-x-2 text-[9px]">
                <span className="flex items-center"><span className="w-2 h-2 bg-green-200 border border-green-500 mr-1 rounded-full"></span> Kosong</span>
                <span className="flex items-center"><span className="w-2 h-2 bg-red-200 border border-red-500 mr-1 rounded-full"></span> Terisi</span>
            </div>
        </div>
       
        <div className="p-2 overflow-y-auto">
             <div className="grid grid-cols-4 gap-2">
                {filteredRoomList.map(room => {
                    const patient = activeRecords.find(r => r.roomNumber === room);
                    const isOccupied = !!patient;
                    const displayName = patient ? (patient.name.split(' ')[0] + (patient.name.length > 8 ? '...' : '')) : '';
                    const displayDr = patient ? (patient.dpjpName.split(',')[0].replace('dr. ', 'dr. ')) : '';

                    return (
                    <div 
                        key={room} 
                        className={`p-1 text-center rounded border transition flex flex-col items-center justify-center min-h-[50px] ${
                            isOccupied 
                            ? 'bg-red-50 border-red-200 text-red-900 shadow-sm cursor-pointer hover:bg-red-100 hover:border-red-400' 
                            : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100 hover:border-green-400 cursor-pointer'
                        }`}
                        onClick={() => isOccupied ? onEditRoom(patient) : onSelectRoom(room)} 
                    >
                        <div className="text-[10px] font-bold">{room}</div>
                        {isOccupied && (
                            <>
                                <div className="text-[9px] font-medium leading-tight mt-0.5 truncate w-full px-1 bg-white/50 rounded">{displayName}</div>
                                <div className="text-[7px] text-gray-500 leading-tight truncate w-full">{displayDr}</div>
                            </>
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

// --- Helper untuk Memformat Planning (Warna-Warni Otomatis) ---
const renderPlanningCell = (text) => {
    if (!text) return '-';
    
    return text.split('\n').map((line, idx) => {
        const lower = line.toLowerCase().trim();
        if (!lower) return null;

        // Default Style (Polos)
        let containerStyle = "mb-1 block w-fit max-w-full";
        let textStyle = "text-gray-800";

        // 1. Deteksi LAB (Kuning)
        if (lower.includes('lab') || lower.includes('darah') || lower.includes('urine') || lower.includes('cek')) {
            containerStyle = "mb-1 bg-yellow-100 border border-yellow-200 px-2 py-0.5 rounded w-fit max-w-full";
            textStyle = "text-yellow-900 font-medium";
        } 
        // 2. Deteksi RADIOLOGI (Biru)
        else if (lower.includes('rad') || lower.includes('rontgen') || lower.includes('ct ') || lower.includes('usg') || lower.includes('foto')) {
            containerStyle = "mb-1 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded w-fit max-w-full";
            textStyle = "text-blue-900 font-medium";
        } 
        // 3. Deteksi TERAPI/OBAT (Hijau)
        else if (lower.includes('terapi') || lower.includes('rx') || lower.includes('obat') || lower.includes('inj') || lower.includes('infus') || lower.includes('drip')) {
            containerStyle = "mb-1 bg-green-100 border border-green-200 px-2 py-0.5 rounded w-fit max-w-full";
            textStyle = "text-green-900 font-medium";
        } 
        // 4. Deteksi LACAK/PENTING (Merah Berdenyut)
        else if (lower.includes('lacak') || lower.includes('konsul') || lower.includes('plan') || lower.includes('pro')) {
            containerStyle = "mb-1 bg-red-100 border border-red-200 px-2 py-0.5 rounded w-fit max-w-full animate-pulse";
            textStyle = "text-red-900 font-bold";
        }

        return (
            <div key={idx} className={containerStyle}>
                <span className={textStyle}>{line}</span>
            </div>
        );
    });
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

const PatientTable = ({ records, onEdit, onPrint, onShowLaporModal, onDischarge, onBulkPrint }) => {
    if (records.length === 0) {
        return <div className="text-center p-10 text-gray-400 italic text-sm bg-white h-full border rounded">Belum ada pasien aktif yang sesuai dengan filter.</div>;
    }

    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
    }, [records]);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="bg-indigo-50 p-2 border-b border-indigo-100 flex justify-between items-center">
                <h2 className="text-xs font-bold text-indigo-800 uppercase">Daftar Pasien Aktif ({records.length})</h2>
                {/* TOMBOL CETAK BANYAK PINDAH KE SINI */}
                <button 
                    onClick={onBulkPrint}
                    className="text-[9px] px-2 py-1 bg-white border border-indigo-200 text-indigo-700 rounded font-bold hover:bg-indigo-100 shadow-sm flex items-center transition"
                    title="Cetak Semua Pasien Aktif"
                >
                    <span className="mr-1">🖨️</span> Cetak Banyak
                </button>
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


// --- LOGIC UTAMA ---

const MedicalRecordApp = ({ db, userId, appId, isOnline, onLogout }) => {
  const [records, setRecords] = useState([]);
  const [activeRecords, setActiveRecords] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  
  // State untuk Data Dinamis (Setelan)
  const [dpjpProfiles, setDpjpProfiles] = useState(initialDpjpProfiles.map(p => ({...p, name: p.name})));
  // Menggunakan DEFAULT_JAGA_LINK sebagai nilai awal
  const [jagaGroupLink, setJagaGroupLink] = useState(DEFAULT_JAGA_LINK);
  
  const [lastHistoryRecord, setLastHistoryRecord] = useState(null);

  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  
  // State Print
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false); // New Bulk Print State

  const [showInputModal, setShowInputModal] = useState(false);
  const [recordForLapor, setRecordForLapor] = useState(null);

  const [dpjpFilter, setDpjpFilter] = useState(''); 
  const [roomFilterModalOpen, setRoomFilterModalOpen] = useState(false);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState(ROOM_LIST);
  
  const [showRaber1, setShowRaber1] = useState(false);
  const [showRaber2, setShowRaber2] = useState(false);
  const [showTtvModal, setShowTtvModal] = useState(false);
  
  const [confirmDetails, setConfirmDetails] = useState({ isOpen: false, message: '', title: '', action: () => {} });
  const openConfirm = (title, message, action) => { setConfirmDetails({ isOpen: true, title, message, action }); };
  const closeConfirm = () => { setConfirmDetails({ isOpen: false, message: '', title: '', action: () => {} }); };
  
  const [formData, setFormData] = useState({
    roomNumber: '', name: '', dpjpName: '', raberName: '', raber2Name: '',
    subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
  });

  const [newDpjpName, setNewDpjpName] = useState('');
  const [newDpjpWa, setNewDpjpWa] = useState('');

  
  const filteredActiveRecords = useMemo(() => {
    return activeRecords.filter(rec => {
        const matchesDpjp = !dpjpFilter || rec.dpjpName === dpjpFilter;
        const matchesRoom = selectedRoomFilter.includes(rec.roomNumber);
        return matchesDpjp && matchesRoom;
    });
  }, [activeRecords, dpjpFilter, selectedRoomFilter]);

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

  useEffect(() => {
    // Logic for finding the last history record based on name and room (if discharged)
      if (formData.roomNumber && formData.name) {
          // Find the most recent discharged record matching name and room
          const found = records
            .filter(r => 
              r.roomNumber === formData.roomNumber && 
              r.name.trim().toLowerCase() === formData.name.trim().toLowerCase() &&
              r.id !== currentRecordId && r.isDischarged
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          setLastHistoryRecord(found || null);
      } else {
          setLastHistoryRecord(null);
      }
  }, [formData.roomNumber, formData.name, records, currentRecordId]);

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
      
      if (!formData.name || !formData.roomNumber || !formData.dpjpName) {
          alert('Mohon lengkapi data wajib (Nama, Kamar, DPJP) sebelum menyimpan.');
          return;
      }
      
      const isRoomOccupied = occupiedRooms.includes(formData.roomNumber) && 
                              (!isEditing || (isEditing && formData.roomNumber !== activeRecords.find(r => r.id === currentRecordId)?.roomNumber));
      
      if (!isEditing && isRoomOccupied) {
          alert(`Kamar ${formData.roomNumber} sudah terisi. Mohon pilih kamar lain atau edit pasien yang sudah ada.`);
          return;
      } else if (isEditing && isRoomOccupied) {
           // This case should be handled by checking if the NEW room is occupied by someone else
           const existingOccupant = activeRecords.find(r => r.roomNumber === formData.roomNumber && r.id !== currentRecordId);
           if (existingOccupant) {
               alert(`Kamar ${formData.roomNumber} sudah terisi oleh pasien ${existingOccupant.name}. Mohon pilih kamar lain.`);
               return;
           }
      }


      setLoading(true);
      const ref = getCollectionRef();
      try {
          const data = { ...formData, updatedAt: Timestamp.now() };
          if (!isEditing) data.createdAt = Timestamp.now();

          if (isEditing && currentRecordId) await updateDoc(doc(ref, currentRecordId), data);
          else await addDoc(ref, data);
          
          resetForm();
          setShowInputModal(false);
          console.log("Data berhasil disimpan.");
      } catch (err) { 
          console.error("Kesalahan saat menyimpan data:", err); 
      } 
      finally { 
          setTimeout(() => setLoading(false), 100); 
      }
  };

  const handleEdit = (rec) => {
      setFormData({
          roomNumber: rec.roomNumber, name: rec.name, dpjpName: rec.dpjpName,
          raberName: rec.raberName || '', raber2Name: rec.raber2Name || '',
          subjective: rec.subjective, objective: rec.objective,
          analysis: rec.analysis, planning: rec.planning, isDischarged: rec.isDischarged || false
      });
      setCurrentRecordId(rec.id);
      setIsEditing(true);
      setShowRaber1(!!rec.raberName);
      setShowRaber2(!!rec.raber2Name);
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
  
  const handleLapor = (rec, type) => {
      let numberOrLink;
      if (type === 'DPJP') {
          numberOrLink = dpjpProfiles.find(p => p.name === rec.dpjpName)?.waNumber;
          if (!numberOrLink) { alert("Nomor WA DPJP kosong! Harap isi di menu Setelan."); return; }
          numberOrLink = numberOrLink.replace(/\D/g,'');
      } else { 
          numberOrLink = jagaGroupLink;
          if (!numberOrLink) { alert("Link Grup Jaga kosong! Harap isi di menu Setelan."); return; }
      }

      const header = `Izin Lapor Pasien a.n\n${rec.name}\n${type === 'Jaga' ? 'DPJP: '+rec.dpjpName : ''}`;
      const text = `${header}\n\nS: \n${rec.subjective || '-'}\n\nO: \n${rec.objective || '-'}\n\nA: \n${rec.analysis || '-'}\n\nP: \n${rec.planning || '-'}\n\n\n Mohon advis, \nTerimakasih`;
      
      const url = numberOrLink.includes('chat.whatsapp.com') 
          ? numberOrLink 
          : `https://wa.me/${numberOrLink}?text=${encodeURIComponent(text)}`;
      
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      
      alert(`Teks laporan (${type}) telah disalin ke Clipboard.\n\nSilakan 'Tempel' (Paste) di WhatsApp setelah halaman terbuka.`);
      window.open(url, '_blank');
      setRecordForLapor(null); 
  };

  const handleExportExcel = () => {
      if (!records || records.length === 0) {
          alert("Tidak ada data untuk diexport.");
          return;
      }

      // 1. Buat Header CSV
      const headers = [
          "No", "Tanggal Masuk", "Jam Masuk", "Nama Pasien", "Kamar", 
          "DPJP", "Raber 1", "Raber 2", "Status Pulang",
          "Analisa (A)", "Planning (P)"
      ];

      // 2. Buat Rows Data
      const rows = records.map((r, index) => {
          const date = r.createdAt.toLocaleDateString('id-ID');
          const time = r.createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          
          // Helper untuk escape tanda kutip (") agar CSV tidak rusak
          const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;

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
              escape(r.analysis),
              escape(r.planning)
          ].join(",");
      });

      // 3. Gabungkan Header dan Rows
      const csvContent = [headers.join(","), ...rows].join("\n");

      // 4. Trigger Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Data_Pasien_Medrec_${new Date().toLocaleDateString('id-ID')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const stats = useMemo(() => {
      const s = {
          total: records.length,
          active: activeRecords.length,
          discharged: records.filter(r => r.isDischarged).length,
          monthly: {},
          labCount: 0,
          radCount: 0,
          procCount: 0,
          detailLab: {}, 
          detailRad: {},
          // New: Stats for DPJP Summary (moved from Dashboard)
          dpjpCounts: {},
          raberCount: 0,
          emptyCount: ROOM_LIST.length - activeRecords.length
      };
      
      // Calculate DPJP Stats based on ACTIVE records only
      const raberSet = new Set();
      activeRecords.forEach(rec => {
          s.dpjpCounts[rec.dpjpName] = (s.dpjpCounts[rec.dpjpName] || 0) + 1;
          if (rec.raberName || rec.raber2Name) raberSet.add(rec.id);
      });
      s.raberCount = raberSet.size;

      // Existing General Stats Logic
      records.forEach(r => {
          const m = r.createdAt.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
          if (!s.monthly[m]) s.monthly[m] = { total: 0, lab: 0, rad: 0, proc: 0, discharged: 0 };
          s.monthly[m].total++;
          if (r.isDischarged) s.monthly[m].discharged++;

          // Parse Planning untuk statistik rinci
          const p = (r.planning || '');
          const pLower = p.toLowerCase();
          
          if (pLower.includes('lab')) { s.labCount++; s.monthly[m].lab++; }
          if (pLower.includes('rad') || pLower.includes('rontgen') || pLower.includes('usg')) { s.radCount++; s.monthly[m].rad++; }
          if (pLower.includes('tindakan') || pLower.includes('pasang') || pLower.includes('trfs')) { s.procCount++; s.monthly[m].proc++; }

          // Logic Detail Hitungan (Lab & Rad)
          const lines = p.split('\n');
          lines.forEach(line => {
              const trimmed = line.trim();
              if (!trimmed) return;

              if (trimmed.startsWith('Lab. R/')) {
                  const item = trimmed.replace('Lab. R/', '').trim();
                  s.detailLab[item] = (s.detailLab[item] || 0) + 1;
              } else if (trimmed.startsWith('Rad. R/')) {
                  const item = trimmed.replace('Rad. R/', '').trim();
                  s.detailRad[item] = (s.detailRad[item] || 0) + 1;
              }
          });
      });
      return s;
  }, [records, activeRecords]);

  const renderHome = () => {
    const dpjpOptions = ['Semua DPJP', ...dpjpProfiles.map(p => p.name)].sort();
    
    const handleToggleRoomFilter = (room) => {
        setSelectedRoomFilter(prev => 
            prev.includes(room) ? prev.filter(r => r !== room) : [...prev, room]
        );
    };
    
    const handleSelectAllRooms = (shouldSelect) => () => {
        setSelectedRoomFilter(shouldSelect ? ROOM_LIST : []);
    };
    
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
                 />
            </div>
            
            {roomFilterModalOpen && (
                <RoomFilterModal
                    roomList={ROOM_LIST}
                    selectedRooms={selectedRoomFilter}
                    onToggleRoom={handleToggleRoomFilter}
                    onSave={() => setRoomFilterModalOpen(false)}
                    onSelectAll={handleSelectAllRooms}
                />
            )}
            
             {recordForLapor && (
                <LaporConfirmationModal
                    patientName={recordForLapor.name}
                    onLaporDpjp={() => handleLapor(recordForLapor, 'DPJP')}
                    onLaporJaga={() => handleLapor(recordForLapor, 'Jaga')}
                    onCancel={() => setRecordForLapor(null)}
                />
            )}
        </div>
    );
  };

  const renderInputModal = () => {
      if (!showInputModal) return null;

      // Filter available rooms: only empty rooms, or the current room if editing
      const availableRooms = ROOM_LIST
        .filter(r => !occupiedRooms.includes(r) || (isEditing && r === formData.roomNumber))
        .sort();
      
      const dpjpOptions = dpjpProfiles.map(p => p.name).sort();
      
      const commonLab = ['Darah Rutin', 'GDS', 'Ureum/Creatinin'];
      const commonRad = ['Thorax PA/AP', 'USG Whole Abdomen'];
      const commonProc = ['Pasang Infus', 'Ganti Balutan', 'Trfs Albumin', 'Trfs PRC'];
      
      // Gabungkan Lab dan Rad untuk fitur Lacak di Objektif
      const lacakOptions = [...LAB_CHECKS, ...RADIOLOGY_CHECKS].sort();

      const isFormReady = formData.name && formData.roomNumber && formData.dpjpName;

      return (
          <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-hidden">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                  <div className="p-3 border-b flex justify-between items-center bg-indigo-600 text-white rounded-t-lg">
                      <h2 className="font-bold text-sm">{isEditing ? `Edit Data Pasien ${formData.name}` : 'Input Pasien Baru'}</h2>
                      <button onClick={() => { setShowInputModal(false); resetForm(); }} className="text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center font-bold">✕</button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto flex-1">
                      <form onSubmit={handleSubmit} id="mainForm">
                          <div className="flex space-x-2 mb-2">
                              <div className="w-1/3">
                                  <CustomSelect 
                                      label="No. Kamar" 
                                      value={formData.roomNumber} 
                                      onChange={(e) => setFormData(p => ({...p, roomNumber: e.target.value}))} 
                                      options={availableRooms} 
                                      placeholder="Pilih..." 
                                      required 
                                  />
                              </div>
                              <div className="w-2/3">
                                  {/* PERUBAHAN 1: Menghapus disabled={isEditing} agar nama selalu bisa diedit */}
                                  <CustomInput label="Nama Pasien" name="name" value={formData.name} onChange={handleInputChange} required />
                              </div>
                          </div>

                          <div className="mb-2">
                              <div className="flex space-x-2 mb-1">
                                  <div className="w-1/2">
                                      <CustomSelect label="DPJP Utama" value={formData.dpjpName} onChange={(e) => setFormData(p => ({...p, dpjpName: e.target.value}))} options={dpjpOptions} placeholder="Cari..." required />
                                  </div>
                                  <div className="w-1/2">
                                      {showRaber1 ? (
                                          <CustomSelect label="Raber 1" value={formData.raberName} onChange={(e) => setFormData(p => ({...p, raberName: e.target.value}))} options={dpjpOptions} placeholder="Cari..." />
                                      ) : (
                                          <button type="button" onClick={() => setShowRaber1(true)} className="text-[10px] mt-6 text-blue-600 underline">+ Raber 1</button>
                                      )}
                                  </div>
                              </div>
                              {showRaber1 && (
                                  <div className="flex space-x-2">
                                      <div className="w-1/2"></div>
                                      <div className="w-1/2">
                                          {showRaber2 ? (
                                              <CustomSelect label="Raber 2" value={formData.raber2Name} onChange={(e) => setFormData(p => ({...p, raber2Name: e.target.value}))} options={dpjpOptions} placeholder="Cari..." />
                                          ) : (
                                              <button type="button" onClick={() => setShowRaber2(true)} className="text-[10px] text-blue-600 underline">+ Raber 2</button>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>

                          <div className="space-y-1 mt-4">
                              <CustomTextArea label="S (Subjektif)" name="subjective" value={formData.subjective} onChange={handleInputChange} 
                                  onPullData={lastHistoryRecord ? () => pullDataForField('subjective') : null} pullLabel="Salin S Lalu" />
                              
                              <CustomTextArea label="O (Objektif)" name="objective" value={formData.objective} onChange={handleInputChange} 
                                  onPullData={lastHistoryRecord ? () => pullDataForField('objective') : null} pullLabel="Salin O Lalu"
                                  extraButtons={<button type="button" onClick={() => setShowTtvModal(true)} className="text-[9px] bg-green-100 text-green-700 px-2 rounded border border-green-300 hover:bg-green-200 font-bold">+ TTV & GCS</button>} 
                              >
                                  {/* PERUBAHAN 2: Menambahkan Searchbar Lacak Hasil di bagian O */}
                                  <div className="mt-1 bg-yellow-50 p-2 rounded border border-yellow-200">
                                       <TagSelector 
                                          label="Lacak Hasil (Otomatis Tambah 'Lacak...')" 
                                          options={lacakOptions} 
                                          placeholder="Cari Lab/Rad (cth: CT Scan, Darah Rutin)..."
                                          category="Lacak"
                                          onSelect={(_, item) => appendText('objective', `Lacak ${item}`)}
                                       />
                                  </div>
                              </CustomTextArea>

                              <CustomTextArea label="A (Analisa)" name="analysis" value={formData.analysis} onChange={handleInputChange} 
                                  onPullData={lastHistoryRecord ? () => pullDataForField('analysis') : null} pullLabel="Salin A Lalu" />

                              <CustomTextArea label="P (Planning)" name="planning" value={formData.planning} onChange={handleInputChange} 
                                  onPullData={lastHistoryRecord ? () => pullDataForField('planning') : null} pullLabel="Salin P Lalu">
                                  
                                  <div className="mt-1 flex flex-wrap gap-1 bg-gray-50 p-2 rounded border border-gray-200">
                                    <h4 className="w-full text-[10px] font-bold text-gray-700 uppercase mb-1">Quick Tag Planning:</h4>
                                    
                                    {/* Updated Quick Tags */}
                                    <QuickActionButton label="Koreksi KCL" className="text-orange-600 border-orange-200" onClick={() => appendText('planning', 'on Koreksi KCL ... meq dlm NaCl ... cc')} />
                                    <QuickActionButton label="Insulin" className="text-purple-600 border-purple-200" onClick={() => appendText('planning', 'on Insulin ... ui/jam')} />
                                    <QuickActionButton label="Nicardipin" className="text-orange-600 border-orange-200" onClick={() => appendText('planning', 'on Nicardipin ... mcg/kgBB/menit')} />
                                    <QuickActionButton label="Norepinefrin" className="text-red-600 border-red-200" onClick={() => appendText('planning', 'on Norepinefrin ... mcg/kgBB/menit')} />
                                    
                                    {/* 3 Way & 2 Line */}
                                    <QuickActionButton label="3 Way" className="text-blue-600 border-blue-200" onClick={() => appendText('planning', 'Way 1: ...\nWay 2: ...')} />
                                    <QuickActionButton label="2 Line" className="text-blue-600 border-blue-200" onClick={() => appendText('planning', 'Line 1: ...\nLine 2: ...')} />
                                  </div>

                                  <div className="mt-2 p-2 bg-white border border-gray-200 rounded shadow-inner">
                                      <div className="grid grid-cols-3 gap-2 mb-2">
                                          <TagSelector label="LAB" options={LAB_CHECKS} onSelect={appendPlanning} category="Lab" />
                                          <TagSelector label="RAD" options={RADIOLOGY_CHECKS} onSelect={appendPlanning} category="Rad" />
                                          <TagSelector label="TINDAKAN" options={PROCEDURES} onSelect={appendPlanning} category="Med" />
                                      </div>
                                      <div className="flex flex-wrap items-center pt-2 border-t border-gray-100">
                                        <h4 className="w-full text-[9px] font-bold text-gray-700 uppercase mb-1">Pilihan Cepat:</h4>
                                        {commonLab.map(item => <button key={item} type="button" onClick={() => appendPlanning('Lab', item)} className="text-[9px] px-1 border bg-red-50 text-red-700 mr-1 mb-1 rounded hover:bg-red-100">Lab R/{item}</button>)}
                                        {commonRad.map(item => <button key={item} type="button" onClick={() => appendPlanning('Rad', item)} className="text-[9px] px-1 border bg-blue-50 text-blue-700 mr-1 mb-1 rounded hover:bg-blue-100">Rad R/{item}</button>)}
                                        {commonProc.map(item => <button key={item} type="button" onClick={() => appendPlanning('Med', item)} className="text-[9px] px-1 border bg-green-50 text-green-700 mr-1 mb-1 rounded hover:bg-green-100">Tind. {item}</button>)}
                                      </div>
                                  </div>
                              </CustomTextArea>
                          </div>
                      </form>
                  </div>

                  <div className="p-3 border-t bg-gray-50 flex justify-end space-x-2 rounded-b-lg">
                      <button onClick={() => { setShowInputModal(false); resetForm(); }} className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800">Batal</button>
                      <button 
                          onClick={handleSubmit}
                          disabled={loading || !isFormReady} 
                          className={`px-6 py-2 rounded text-xs font-bold text-white shadow-md transition ${loading || !isFormReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                      >
                          {loading ? 'Menyimpan...' : 'Simpan Data'}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
        <div className="bg-white shadow-sm p-3 sticky top-0 z-40 border-b flex justify-between items-center max-w-7xl mx-auto">
            <h1 className="font-extrabold text-indigo-800">MEDREC V3 (SHARED)</h1>
            <div className={`text-xs font-bold px-3 py-1 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="flex space-x-1 items-center">
                <TabButton label="Beranda" currentView={view} name="home" onClick={() => setView('home')} />
                <TabButton label="Stats" currentView={view} name="stats" onClick={() => setView('stats')} />
                <TabButton label="Setelan" currentView={view} name="settings" onClick={() => setView('settings')} />
                <button onClick={() => setShowInputModal(true)} className="py-2 px-4 text-xs font-bold border-b-2 transition text-white border-green-600 bg-green-600 hover:bg-green-700 rounded shadow-md mr-2">
                    + Pasien Baru
                </button>
                {/* Tombol Logout Baru */}
                <button onClick={onLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-full border border-red-200 transition" title="Keluar">
                    <span className="text-lg">🚪</span>
                </button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 lg:h-[calc(100vh-64px)]">
            {view === 'home' && renderHome()}
            {view === 'stats' && (
                <div className="bg-white p-6 rounded shadow space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-lg text-indigo-800">Dashboard Statistik</h2>
                        <button 
                            onClick={handleExportExcel}
                            className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 flex items-center shadow-sm"
                        >
                            <span className="mr-2">📊</span> Download Excel (.csv)
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard title="Total Pasien" value={stats.total} color="indigo" />
                        <StatCard title="Dirawat" value={stats.active} color="blue" />
                        <StatCard title="Pulang" value={stats.discharged} color="red" />
                        <StatCard title="Tindakan Medis" value={stats.procCount} subtext="Pasien" color="yellow" />
                    </div>

                    {/* NEW: STATISTIK RUANGAN & DPJP (Moved from Home) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-indigo-50 p-4 rounded border border-indigo-100">
                            <h3 className="font-bold text-indigo-800 border-b border-indigo-200 pb-2 mb-2">Statistik Okupansi & DPJP</h3>
                            
                            <div className="flex justify-between items-center mb-3 bg-white p-2 rounded border border-indigo-100 shadow-sm">
                                <span className="font-bold text-gray-700 text-xs uppercase">Sisa Bed Kosong</span>
                                <span className="font-extrabold text-lg text-green-600">{stats.emptyCount}</span>
                            </div>

                            <div className="flex justify-between items-center mb-3 bg-white p-2 rounded border border-indigo-100 shadow-sm">
                                <span className="font-bold text-gray-700 text-xs uppercase">Pasien Rawat Bersama</span>
                                <span className="font-extrabold text-lg text-yellow-600">{stats.raberCount}</span>
                            </div>

                            <h4 className="font-bold text-gray-600 mb-1 mt-2 text-[10px] uppercase">Pasien Aktif per DPJP</h4>
                            <div className="max-h-40 overflow-y-auto bg-white rounded border border-gray-200">
                                <ul className="divide-y divide-gray-100">
                                    {Object.entries(stats.dpjpCounts).map(([name, count]) => (
                                        <li key={name} className="flex justify-between p-2 text-xs hover:bg-gray-50">
                                            <span className="truncate pr-2">{name}</span>
                                            <span className="font-bold bg-indigo-100 text-indigo-700 px-2 rounded-full">{count}</span>
                                        </li>
                                    ))}
                                    {Object.keys(stats.dpjpCounts).length === 0 && <li className="p-2 text-gray-400 italic text-xs text-center">Belum ada pasien aktif.</li>}
                                </ul>
                            </div>
                        </div>

                        {/* REKAP BULANAN */}
                        <div>
                            <h3 className="font-bold text-gray-700 border-b pb-2 mb-2">Rekapitulasi Bulanan</h3>
                            <div className="overflow-x-auto bg-white border rounded">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-gray-600"><tr><th className="p-2">Bulan</th><th>Pasien Baru</th><th>Pulang</th><th>Lab</th><th>Rad</th><th>Tindakan</th></tr></thead>
                                    <tbody className="divide-y">
                                        {Object.entries(stats.monthly).map(([m, d]) => (
                                            <tr key={m} className="hover:bg-gray-50"><td className="p-2 font-bold">{m}</td><td>{d.total}</td><td>{d.discharged}</td><td>{d.lab}</td><td>{d.rad}</td><td>{d.proc}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* DETAIL LAB & RAD */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-sm uppercase">Detail Pemeriksaan Lab</h3>
                            <div className="bg-red-50 rounded border border-red-100 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-red-100 text-red-800">
                                        <tr><th className="p-2 text-left">Nama Pemeriksaan</th><th className="p-2 text-right">Jumlah</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-100">
                                        {Object.entries(stats.detailLab).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                                            <tr key={name}><td className="p-2">{name}</td><td className="p-2 text-right font-bold">{count}</td></tr>
                                        ))}
                                        {Object.keys(stats.detailLab).length === 0 && <tr><td colSpan="2" className="p-3 text-center italic text-gray-500">Belum ada data lab.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-sm uppercase">Detail Pemeriksaan Radiologi</h3>
                             <div className="bg-blue-50 rounded border border-blue-100 max-h-60 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-blue-100 text-blue-800">
                                        <tr><th className="p-2 text-left">Nama Pemeriksaan</th><th className="p-2 text-right">Jumlah</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-100">
                                        {Object.entries(stats.detailRad).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                                            <tr key={name}><td className="p-2">{name}</td><td className="p-2 text-right font-bold">{count}</td></tr>
                                        ))}
                                        {Object.keys(stats.detailRad).length === 0 && <tr><td colSpan="2" className="p-3 text-center italic text-gray-500">Belum ada data radiologi.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {view === 'settings' && (
                <div className="bg-white p-6 rounded shadow max-w-xl mx-auto">
                    <h2 className="font-bold text-lg mb-4 text-indigo-800 border-b pb-2">Setelan Aplikasi (Shared)</h2>
                    <p className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded mb-4 border border-yellow-200">
                        Perhatian: Perubahan setelan di sini akan berlaku untuk semua pengguna (Dokter/Perawat) yang membuka aplikasi ini.
                    </p>
                    
                    <div className="mb-6">
                        <h3 className="text-sm font-bold mb-2 text-gray-700">Link Komunikasi Jaga</h3>
                        <label className="block text-xs font-bold mb-1 text-gray-500">Link WA Grup Jaga (Wajib diisi untuk Lapor Jaga)</label>
                        <input type="text" value={jagaGroupLink} onChange={(e) => {setJagaGroupLink(e.target.value); saveConfig(undefined, e.target.value);}} className="w-full border p-2 rounded text-sm" placeholder="https://chat.whatsapp.com/..." />
                    </div>
                    
                    <div className="mb-6 border-t pt-4">
                        <h3 className="text-sm font-bold mb-2 text-gray-700">Tambah DPJP Baru</h3>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Nama Lengkap & Gelar (cth: dr. Ahmad, Sp.P)" value={newDpjpName} onChange={e=>setNewDpjpName(e.target.value)} className="border p-2 w-2/3 rounded text-sm"/>
                            <input type="text" placeholder="No WA (628...)" value={newDpjpWa} onChange={e=>setNewDpjpWa(e.target.value)} className="border p-2 w-1/3 rounded text-sm"/>
                        </div>
                        <button onClick={handleAddDpjp} className="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 transition">Tambahkan</button>
                    </div>
                    
                    <div className="border-t pt-4">
                        <h3 className="text-sm font-bold mb-2 text-gray-700">Daftar DPJP ({dpjpProfiles.length})</h3>
                        <ul className="text-xs divide-y">
                            {dpjpProfiles.map((p,i) => (
                                <li key={i} className="py-2 flex justify-between items-center">
                                    <div className="flex-1">
                                        <span className="font-bold block">{p.name}</span>
                                        <span className="text-gray-500">{p.waNumber || 'No WA belum diisi'}</span>
                                    </div>
                                    <button onClick={() => handleRemoveDpjp(p.name)} className="text-red-500 hover:text-red-700 text-sm ml-4" title="Hapus DPJP">✕</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>

        {renderInputModal()}
        {showTtvModal && <TtvModal onClose={() => setShowTtvModal(false)} onSave={(txt) => { appendText('objective', txt); setShowTtvModal(false); }} />}
        
        {/* Modals for Print */}
        {selectedRecordForPrint && <PrintView record={selectedRecordForPrint} closePrint={() => setSelectedRecordForPrint(null)} />}
        {showBulkPrint && <BulkPrintView records={filteredActiveRecords} onClose={() => setShowBulkPrint(false)} />}
        
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
// -------------------------

const App = () => {
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  // NEW: State untuk Gate Login
  const [hasLoginPassed, setHasLoginPassed] = useState(false);

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
      
      enableIndexedDbPersistence(firestoreInstance)
        .then(() => {
            setIsOfflineReady(true);
            setDb(firestoreInstance);
        })
        .catch((err) => {
            console.warn("Firestore Persistence error:", err.code);
            setIsOfflineReady(true); // Proceed even if persistence fails
            setDb(firestoreInstance);
        });

const initAuth = async () => {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Auth failed", e);
    }
};
initAuth();

      const unsubscribe = onAuthStateChanged(auth, (u) => { 
        setUserId(u ? u.uid : null); 
        setIsAuthReady(true); 
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

  // NEW: Gate Login Check
  if (!hasLoginPassed) {
      return <LoginPage onLogin={() => setHasLoginPassed(true)} />;
  }

  if (!isAuthReady || !db || !isOfflineReady) 
    return <div className="flex h-screen items-center justify-center text-indigo-600 font-bold animate-pulse">Memuat Aplikasi dan Menyiapkan Mode Offline (Shared)...</div>;
    
  return <MedicalRecordApp db={db} userId={userId} appId={firebaseConfig.appId} isOnline={isOnline} onLogout={() => setHasLoginPassed(false)} />;
};

export default App;