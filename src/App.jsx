import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore,
    initializeFirestore, 
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
    getDoc,
    limit,
} from 'firebase/firestore';

import Cashflow from './components/Cashflow';
import GudangArsip from './components/GudangArsip';
import { 
    LEFT_ROOMS, RIGHT_ROOMS, ROOM_LIST, 
    DEFAULT_DPJP_DATA, LAB_CHECKS, RADIOLOGY_CHECKS, 
    PROCEDURES, MEDICATIONS, WARD_CONFIG 
} from './constants';
import { LogOut, Wallet, FileText, ChevronLeft } from 'lucide-react';

// --- Global Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCL9PYpOe3pJOaoEfZLw9mymIrC6LtMJWE",
  authDomain: "e-ontang-anting.firebaseapp.com",
  projectId: "e-ontang-anting",
  storageBucket: "e-ontang-anting.firebasestorage.app",
  messagingSenderId: "1097108054720",
  appId: "1:1097108054720:web:a53efbaf9882d5086d0325"
};

const initialDpjpProfiles = DEFAULT_DPJP_DATA;

// --- UTILS: PRINT HANDLER ---
// --- FUNGSI HELPER UNTUK PRINT DI HP/TABLET (ANTI-CRASH) ---
const cetakPWA = (htmlContent, title = 'Cetak') => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<title>${title}</title>` + htmlContent);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 3000);
    }, 800);
};

const handlePrintWindow = (elementId, title) => {
    const content = document.getElementById(elementId);
    if (!content) return;

    const html = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11pt; }
                @media print { @page { size: A5 portrait; margin: 0.5cm; } body { margin: 0; } .no-print { display: none !important; } .print-break { page-break-after: always; } #print-container { width: 100%; max-width: 148mm; } }
            </style>
        </head>
        <body>
            <div id="print-container">${content.innerHTML}</div>
        </body>
        </html>
    `;
    cetakPWA(html, title); // <--- INI YANG BERUBAH
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

const CustomTextArea = ({ label, name, value, onChange, children, extraButtons, onPullData, pullLabel }) => {
    const textareaRef = useRef(null);

    // Fungsi otomatis hitung tinggi berdasarkan isi tulisan
    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset tinggi dulu
            textarea.style.height = textarea.scrollHeight + 'px'; // Setel sesuai tinggi aslinya
        }
    };

    // KUNCI UTAMA: Jalankan fungsi setiap kali 'value' berubah 
    // (Bisa pas loading data pasien masuk, pas ditarik, maupun pas diketik)
    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
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
                ref={textareaRef} // Hubungkan referensi kotak ke mesin pengukur tinggi
                name={name}
                value={value}
                onChange={onChange}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition font-mono leading-tight min-h-[55px] resize-y overflow-hidden"
                placeholder="Ketik di sini..."
            />
            {children}
        </div>
    );
};

// --- COMPONENT CUSTOM SELECT (UPDATE: KEYBOARD NAVIGATION & HIGHLIGHT) ---
const CustomSelect = ({ label, value, onChange, options, placeholder, disabled, required, className = '' }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1); // State untuk kursor keyboard
    const wrapperRef = useRef(null);
    const optionsRef = useRef([]); // Referensi untuk auto-scroll

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        if (!value) setSearchTerm('');
    }, [value]);

    // Reset highlight tiap kali ketik pencarian
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [searchTerm, isOpen]);

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

    // --- LOGIKA NAVIGASI KEYBOARD ---
    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Mentok di item terakhir (termasuk tombol tambah manual jika ada)
            const maxIndex = (searchTerm && !filteredOptions.includes(searchTerm)) ? filteredOptions.length : filteredOptions.length - 1;
            setHighlightedIndex(prev => (prev < maxIndex ? prev + 1 : prev));
        } 
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[highlightedIndex]);
            } else if (highlightedIndex === filteredOptions.length && searchTerm) {
                handleSelect(searchTerm); // Pilih "Gunakan manual"
            } else if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0]); // Default pilih paling atas kalau belum di-highlight
            } else if (searchTerm) {
                handleSelect(searchTerm);
            }
        } 
        else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    // Auto-scroll mengikuti highlight keyboard
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && optionsRef.current[highlightedIndex]) {
            optionsRef.current[highlightedIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [highlightedIndex, isOpen]);

    const displayValue = isOpen ? searchTerm : (value || '');

    return (
        <div className={`mb-2 relative ${className}`} ref={wrapperRef}>
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input 
                    type="text"
                    className={`w-full p-2 text-sm border border-gray-300 rounded shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition ${disabled ? 'bg-gray-100' : 'bg-white'}`}
                    placeholder={placeholder}
                    value={displayValue}
                    onChange={handleInputChange}
                    onClick={() => !disabled && setIsOpen(true)}
                    onKeyDown={handleKeyDown} // MENDENGARKAN KEYBOARD
                    disabled={disabled}
                    required={required}
                    autoComplete="off"
                />
                <span className="absolute right-2 top-2 text-gray-400 text-xs pointer-events-none">▼</span>
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full bg-white border border-gray-300 mt-1 max-h-48 overflow-y-auto shadow-lg rounded text-sm">
                    {filteredOptions.map((opt, index) => (
                        <div 
                            key={opt} 
                            ref={el => optionsRef.current[index] = el} // Referensi untuk scroll
                            className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${
                                highlightedIndex === index ? 'bg-indigo-100 text-indigo-800 font-bold' : 'hover:bg-indigo-50 text-gray-700'
                            }`}
                            onClick={() => handleSelect(opt)}
                            onMouseEnter={() => setHighlightedIndex(index)} // Highlight juga ikut mouse
                        >
                            {opt}
                        </div>
                    ))}
                    
                    {filteredOptions.length === 0 && (
                        <div className="p-2 text-gray-400 text-xs italic">Tidak ada di daftar.</div>
                    )}
                    
                    {searchTerm && !filteredOptions.includes(searchTerm) && (
                         <div 
                            ref={el => optionsRef.current[filteredOptions.length] = el}
                            className={`p-2 text-indigo-700 font-bold cursor-pointer border-t transition-colors ${
                                highlightedIndex === filteredOptions.length ? 'bg-indigo-200' : 'bg-indigo-50 hover:bg-indigo-100'
                            }`}
                            onClick={() => handleSelect(searchTerm)}
                            onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
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
                className="w-full bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 px-2 rounded flex justify-between items-center hover:bg-indigo-50 transition h-[32px] md:h-full"
            >
                <span className="truncate pr-2">{selectedRooms.length === allRooms.length ? 'Semua Kamar Tampil' : `${selectedRooms.length} Kamar Dipilih`}</span>
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
                        {[...allRooms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(room => (
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

// --- KOMPONEN BARU: FILTER DPJP MULTI-SELECT DENGAN SEARCH ---
const DpjpFilterDropdown = ({ allOptions, selectedOptions, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const toggleOption = (opt) => {
        if (selectedOptions.includes(opt)) onChange(selectedOptions.filter(o => o !== opt));
        else onChange([...selectedOptions, opt]);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredList = allOptions.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 px-2 rounded flex justify-between items-center hover:bg-indigo-50 transition h-[32px] md:h-full"
            >
                <span className="truncate pr-2">
                    {selectedOptions.length === 0 ? 'Semua Dokter (DPJP)' : `${selectedOptions.length} Dokter Dipilih`}
                </span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full md:w-64 bg-white border border-gray-300 shadow-xl rounded-lg mt-1 z-[100] p-2">
                    <div className="flex justify-between border-b pb-1 mb-2 items-center">
                        <button onClick={() => onChange([])} className="text-[10px] font-bold text-red-600 hover:underline">Reset</button>
                        <button onClick={() => setIsOpen(false)} className="text-[10px] text-gray-500 hover:underline">Tutup</button>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Ketik cari dokter..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-1.5 border rounded text-[10px] mb-2 outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50"
                    />
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredList.map(opt => (
                            <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-indigo-50 rounded cursor-pointer border border-transparent hover:border-indigo-100 transition">
                                <input 
                                    type="checkbox" 
                                    checked={selectedOptions.includes(opt)} 
                                    onChange={() => toggleOption(opt)}
                                    className="accent-indigo-600 cursor-pointer w-3 h-3"
                                />
                                <span className="text-[10px] text-gray-700 font-bold truncate">{opt}</span>
                            </label>
                        ))}
                        {filteredList.length === 0 && <div className="text-[10px] text-gray-400 text-center py-2 italic">Tidak ditemukan</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

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

// --- MODAL PILIHAN PULANG / PINDAH / MENINGGAL ---
const DischargeModal = ({ patientName, onCancel, onPindah, onPulang, onMeninggal }) => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-red-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-red-800 mb-3 border-b pb-1 uppercase">Keluar: {patientName}</h3>
            <p className="text-[11px] text-gray-600 mb-4">Pilih kategori keluar pasien untuk akurasi laporan:</p>
            <div className="flex flex-col gap-2">
                <button onClick={onPindah} className="w-full px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold shadow-sm flex items-center justify-center gap-2">
                    🏥 Pindah Ruangan
                </button>
                <button onClick={onPulang} className="w-full px-3 py-2 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold shadow-sm flex items-center justify-center gap-2">
                    🏠 Pulang (KRS/BLPL)
                </button>
                <button onClick={onMeninggal} className="w-full px-3 py-2 text-xs bg-gray-800 text-white rounded hover:bg-black font-bold shadow-sm flex items-center justify-center gap-2">
                    💀 Meninggal Dunia
                </button>
            </div>
            <button onClick={onCancel} className="mt-4 w-full px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 font-bold text-center">
                Batal
            </button>
        </div>
    </div>
);

// --- MODAL PILIHAN LAPOR (SHIFT / CS) ---
const LaporModal = ({ onCancel, onLaporShift, onLaporCS }) => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-indigo-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-indigo-800 mb-3 border-b pb-1 uppercase">Pilih Jenis Laporan</h3>
            <div className="flex flex-col gap-2">
                <button onClick={onLaporShift} className="w-full px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold shadow-sm flex items-center justify-center gap-2">
                    📝 Laporan Shift
                </button>
                <button onClick={onLaporCS} className="w-full px-3 py-2 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold shadow-sm flex items-center justify-center gap-2">
                    🧹 Lapor CS (Cleaning Service)
                </button>
            </div>
            <button onClick={onCancel} className="mt-4 w-full px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 font-bold text-center">
                Batal
            </button>
        </div>
    </div>
);

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

// --- COMPONENT TAG SELECTOR (UPDATE: KEYBOARD NAVIGATION & HIGHLIGHT) ---
const TagSelector = ({ label, options, placeholder, onSelect, category }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1); // State untuk highlight keyboard
    const wrapperRef = useRef(null);
    const optionsRef = useRef([]); // Referensi untuk auto-scroll

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Tutup dropdown jika klik di luar area
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Reset highlight tiap kali ketikan berubah
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [searchTerm, isOpen]);

    const handleSelect = (val) => {
        onSelect(category, val);
        setSearchTerm('');
        setIsOpen(false);
    };

    // --- LOGIKA NAVIGASI KEYBOARD ---
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            return;
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            // Mentok di item terakhir (termasuk tombol "+ Tambah manual" jika ada)
            const maxIndex = (searchTerm && !filteredOptions.includes(searchTerm)) ? filteredOptions.length : filteredOptions.length - 1;
            setHighlightedIndex(prev => (prev < maxIndex ? prev + 1 : prev));
        } 
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } 
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (!isOpen) return;
            
            // Eksekusi pilihan berdasarkan posisi highlight
            if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[highlightedIndex]);
            } else if (highlightedIndex === filteredOptions.length && searchTerm) {
                handleSelect(searchTerm); // Pilih tambah manual
            } else if (filteredOptions.length > 0) {
                handleSelect(filteredOptions[0]); // Default pilih yang paling atas
            } else if (searchTerm) {
                handleSelect(searchTerm);
            }
        }
    };

    // Auto-scroll mengikuti highlight
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && optionsRef.current[highlightedIndex]) {
            optionsRef.current[highlightedIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [highlightedIndex, isOpen]);

    return (
        <div className="relative" ref={wrapperRef}>
            {label && <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">{label}</label>}
            <input 
                type="text" 
                className="w-full p-2 border border-blue-200 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none transition" 
                placeholder={placeholder} 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                onClick={() => setIsOpen(true)}
                onKeyDown={handleKeyDown} // PASANG LISTENER KEYBOARD
                autoComplete="off"
            />
            
            {isOpen && (
                <div className="absolute z-50 w-full bg-white border border-gray-300 mt-1 max-h-40 overflow-y-auto shadow-xl rounded-md text-xs">
                    {filteredOptions.map((opt, index) => (
                        <div 
                            key={opt}
                            ref={el => optionsRef.current[index] = el}
                            className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${
                                highlightedIndex === index ? 'bg-indigo-100 text-indigo-800 font-bold' : 'hover:bg-blue-50 text-gray-700'
                            }`}
                            onClick={() => handleSelect(opt)}
                            onMouseEnter={() => setHighlightedIndex(index)} // Highlight juga ikut mouse
                        >
                            {opt}
                        </div>
                    ))}
                    
                    {filteredOptions.length === 0 && !searchTerm && (
                        <div className="p-2 text-gray-400 italic text-center">Ketik untuk mencari...</div>
                    )}
                    
                    {searchTerm && !filteredOptions.includes(searchTerm) && (
                        <div 
                            ref={el => optionsRef.current[filteredOptions.length] = el}
                            className={`p-2 text-green-700 font-bold cursor-pointer transition-colors border-t border-green-100 ${
                                highlightedIndex === filteredOptions.length ? 'bg-green-200' : 'bg-green-50 hover:bg-green-100'
                            }`}
                            onClick={() => handleSelect(searchTerm)}
                            onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
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
            const dischargeKeywords = ['blpl', 'rblpl', 'pulang', 'boleh pulang'];
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
                            {record.roomNumber ? record.roomNumber.replace(/[AB]$/, '') : ''}
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

// --- COMPONENT: DENAH KAMAR (RESPONSIVE: MOBILE, TABLET, LAPTOP) ---
const RoomMap = ({ roomList, leftRooms, rightRooms, activeRecords, onSelectRoom, onEditRoom, roomFilter, waitingList }) => {
    
    // ✨ LOGIKA BARU MOBILE: Selang-seling Kiri & Kanan agar Kolom Kiri = Sisi Kiri, Kolom Kanan = Sisi Kanan
    const mobileRoomList = useMemo(() => {
        const left = leftRooms || LEFT_ROOMS;
        const right = rightRooms || RIGHT_ROOMS;
        const combined = [];
        const maxLength = Math.max(left.length, right.length);
        
        for (let i = 0; i < maxLength; i++) {
            if (i < left.length) combined.push(left[i]);
            if (i < right.length) combined.push(right[i]);
        }
        return combined;
    }, [leftRooms, rightRooms]);

    const renderRoom = (roomNumber) => {
        const record = activeRecords.find(r => r.roomNumber === roomNumber);
        const booked = waitingList?.find(w => w.plannedRoom === roomNumber);
        const isHidden = roomFilter.length !== roomList.length && !roomFilter.includes(roomNumber);

        if (isHidden) return null;

        // Logika Status & Warna Sisa Bed
        let statusText = 'Kosong';
        let statusColor = 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'; 
        
        const match = roomNumber.match(/^(K\d+)([AB])$/);
        if (!record && !booked && match) {
            const roomCode = match[1];
            const neighborBed = match[2] === 'A' ? 'B' : 'A';
            const neighborRoom = `${roomCode}${neighborBed}`;
            const neighborRecord = activeRecords.find(r => r.roomNumber === neighborRoom);
            if (neighborRecord) {
                if (neighborRecord.gender === 'L') {
                    statusText = 'Sisa Lk';
                    statusColor = 'bg-sky-100 border-sky-400 text-sky-800 hover:bg-sky-200';
                } else {
                    statusText = 'Sisa Pr';
                    statusColor = 'bg-purple-100 border-purple-400 text-purple-800 hover:bg-purple-200';
                }
            }
        }

        // 1. RENDER: TERISI (PASIEN)
        if (record) {
            const isMale = record.gender === 'L';
            return (
                <div key={roomNumber} onClick={() => onEditRoom(record)} className={`relative flex flex-col p-1.5 rounded-lg border-2 cursor-pointer shadow-sm transition-all hover:shadow-md ${isMale ? 'bg-blue-200 border-blue-400' : 'bg-rose-100 border-rose-400'}`}>
                    <div className="flex justify-between items-center mb-0.5 border-b border-white/60 pb-0.5">
                        <span className={`font-extrabold text-[11px] ${isMale ? 'text-blue-900' : 'text-rose-900'}`}>{roomNumber}</span>
                        <span className="text-[9px] bg-white/50 rounded px-1">{isMale ? '🚹' : '🚺'}</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                        <span className="font-bold text-xs text-gray-800 leading-none truncate mb-0.5">{record.name}</span>
                        <span className="text-[9px] text-gray-600 font-medium truncate">{record.dpjpName}</span>
                        {(record.raberName || record.raber2Name) && (
                            <span className="text-[7px] bg-yellow-200 text-yellow-800 px-1 rounded w-fit mt-0.5">Raber: {record.raberName || record.raber2Name}</span>
                        )}
                    </div>
                </div>
            );
        }
        
        // 2. RENDER: DIBOOKING (WAITING LIST)
        if (booked) {
            return (
                <div key={roomNumber} className="relative flex flex-col p-1.5 rounded-lg border-2 bg-yellow-50 border-yellow-400 shadow-sm cursor-not-allowed opacity-90 animate-pulse">
                    <div className="flex justify-between items-center mb-0.5 border-b border-yellow-300 pb-0.5">
                        <span className="font-extrabold text-[11px] text-yellow-900">{roomNumber}</span>
                        <span className="text-[9px]">⏳</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <span className="font-bold text-[10px] text-yellow-800 leading-tight">Dipesan a.n</span>
                        <span className="text-[9px] text-yellow-900 font-medium truncate w-full">{booked.name}</span>
                    </div>
                </div>
            );
        }

        // 3. RENDER: KOSONG / SISA BED
        return (
            <div key={roomNumber} onClick={() => onSelectRoom(roomNumber)} className={`relative flex flex-col items-center justify-center p-1 rounded-lg border-2 border-dashed cursor-pointer transition-all ${statusColor}`}>
                <span className="font-extrabold text-[11px] mb-0.5">{roomNumber}</span>
                <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-white/80 shadow-sm">{statusText}</span>
            </div>
        );
    };

    return (
        <div className="flex justify-center w-full px-1 py-1">
            <div className="w-full max-w-5xl">
                {/* MOBILE: Menggunakan susunan mobileRoomList yang sudah dianyam kiri-kanan ✨ */}
                <div className="grid grid-cols-2 gap-1.5 mb-2 md:hidden bg-white p-1.5 rounded-xl shadow-inner border border-gray-100">
                    {mobileRoomList.map(renderRoom)}
                </div>

                {/* DESKTOP/TABLET: Menggunakan data bangsal dinamis bawaan config ✨ */}
                <div className="hidden md:flex w-full gap-2 md:gap-3 bg-white p-1.5 rounded-xl shadow-inner border border-gray-100 justify-center">
                    
                    {/* SISI KIRI: Dinamis (Melati 2 Kolom, Dahlia 1 Kolom) ✨ */}
                    <div className={`grid ${(leftRooms || LEFT_ROOMS).length <= 5 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 w-full`}>
                        {(leftRooms || LEFT_ROOMS).map(renderRoom)}
                    </div>

                    <div className="hidden md:flex flex-col justify-center items-center w-6 bg-gray-100 rounded-full border border-gray-200 shadow-inner relative flex-shrink-0">
                        <div className="absolute top-10 text-gray-300 text-[9px] font-bold tracking-[0.3em]" style={{ writingMode: 'vertical-rl' }}>LORONG</div>
                    </div>

                    {/* SISI KANAN: Dinamis (Melati 2 Kolom, Dahlia 1 Kolom) ✨ */}
                    <div className={`grid ${(rightRooms || RIGHT_ROOMS).length <= 5 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 w-full`}>
                        {(rightRooms || RIGHT_ROOMS).map(renderRoom)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BukuCMTable = ({ records, updateRecord, onPrint, roomList = ROOM_LIST }) => {
    // 1. STATE UNTUK SORTING (Gaya Excel)
    const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'asc' });

    const formatRoom = (room) => room ? room.replace(/[AB]$/, '') : '';

    // 2. FUNGSI UNTUK MENGUBAH SORTING SAAT HEADER DIKLIK
    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            key = 'default'; // Kembali ke urut kamar bawaan
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // 3. LOGIKA PENGURUTAN DATA
    const sortedRooms = useMemo(() => {
        const baseRooms = [...roomList].sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        if (sortConfig.key === 'default') {
            return baseRooms;
        }

        return baseRooms.sort((roomA, roomB) => {
            const recA = records.find(r => r.roomNumber === roomA);
            const recB = records.find(r => r.roomNumber === roomB);

            // Selalu lempar kamar kosong ke bawah saat sorting diaktifkan
            if (!recA && !recB) return 0;
            if (!recA) return 1;
            if (!recB) return -1;

            if (sortConfig.key === 'name') {
                const nameA = (recA.name || '').toLowerCase();
                const nameB = (recB.name || '').toLowerCase();
                if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            } else if (sortConfig.key === 'admissionDate') {
                const dateA = new Date(recA.admissionDate || 0);
                const dateB = new Date(recB.admissionDate || 0);
                // asc = Terlama (tanggal terkecil di atas), desc = Terbaru (tanggal terbesar di atas)
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
    }, [sortConfig, records]);

    // Helper untuk menampilkan Ikon Panah di Header
    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <span className="opacity-30">↕️</span>;
        if (sortConfig.direction === 'asc') return <span>🔼</span>;
        return <span>🔽</span>;
    };

    const formatCustomDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d)) return isoString;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
    };

    const parseCustomDate = (text) => {
        if (!text) return '';
        const match = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})[\s,]+(\d{1,2})[\:\.](\d{1,2})/);
        if (match) {
            let [_, d, m, y, h, min] = match;
            if (y.length === 2) y = '20' + y;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
        }
        return text;
    };

    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); 
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 8); 
        if (v.length > 8) final += ', ' + v.substring(8, 10); 
        if (v.length > 10) final += ':' + v.substring(10, 12); 
        e.target.value = final;
    };

    const hitungLamaRawat = (tanggalMasuk) => {
        if (!tanggalMasuk) return '-';
        const start = new Date(tanggalMasuk);
        if (isNaN(start)) return '?';
        const now = new Date();
        const diffTime = now.getTime() - start.getTime();
        
        if (diffTime < 0) return '0 hr 0 jm';
        
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        return `${diffDays} hr ${diffHours} jm`; 
    };

    const handleInlineSave = (id, field, value) => {
        updateRecord(id, { [field]: value });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center no-print flex-shrink-0">
                <div>
                    <h2 className="font-bold text-emerald-800 flex items-center gap-2 text-sm">📖 Buku Register Ruangan (CM) | 
                        <p className="text-[9px] text-emerald-600">isi tanggal-jam masuk 2 angka, untuk tahun 4 angka, langsung saja tanpa /</p></h2>                    
                </div>
                {/* DROPDOWN DIHAPUS, SISA TOMBOL CETAK SAJA */}
                <button onClick={onPrint} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow hover:bg-emerald-700 transition flex items-center gap-2">
                    🖨️ Cetak Register
                </button>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
                <style>{`
                    .print-text { display: none; }
                    @media print {
                        body * { visibility: hidden; }
                        #buku-cm-print, #buku-cm-print * { visibility: visible; }
                        #buku-cm-print { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none !important; }
                        .print-text { display: block !important; text-align: center; width: 100%; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { 
                            border: 1px solid black !important; padding: 4px; color: black !important; font-size: 11px; text-align: center !important; 
                            position: static !important; box-shadow: none !important; 
                        }
                        th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
                    }
                `}</style>

                <div id="buku-cm-print" className="p-4 pt-0">
                    <table className="w-full text-center border-collapse table-fixed min-w-[900px]">
                        <thead className="bg-gray-100 text-gray-700 text-[10px] uppercase font-bold border-y border-gray-300 sticky top-0 z-40 shadow-sm">
                            <tr>
                                <th className="p-2 border-x border-gray-300 w-[35px] sticky left-0 bg-gray-200 z-50">No</th>
                                
                                {/* HEADER NAMA PASIEN (DIBUAT BISA DIKLIK) */}
                                <th 
                                    className="p-2 border-x border-gray-300 w-[160px] sticky left-[35px] bg-gray-200 z-50 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-gray-300 transition-colors select-none title-attr" 
                                    onClick={() => requestSort('name')}
                                    title="Klik untuk mengurutkan A-Z / Z-A"
                                >
                                    <div className="flex justify-between items-center">
                                        <span>Nama Pasien</span>
                                        <span className="text-[10px]">{getSortIcon('name')}</span>
                                    </div>
                                </th>
                                
                                <th className="p-2 border-x border-gray-300 w-10 bg-gray-100">KMR</th>
                                <th className="p-2 border-x border-gray-300 w-[75px] bg-gray-100">No. RM</th>
                                <th className="p-2 border-x border-gray-300 min-w-[110px] bg-gray-100 text-left">Dokter</th>
                                <th className="p-2 border-x border-gray-300 w-10 bg-gray-100">Kls</th>
                                
                                {/* HEADER TANGGAL MASUK (DIBUAT BISA DIKLIK) */}
                                <th 
                                    className="p-2 border-x border-gray-300 w-[135px] bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    onClick={() => requestSort('admissionDate')}
                                    title="Klik untuk mengurutkan Paling Lama / Paling Baru"
                                >
                                    <div className="flex justify-between items-center">
                                        <span>Tgl Masuk</span>
                                        <span className="text-[10px]">{getSortIcon('admissionDate')}</span>
                                    </div>
                                </th>
                                
                                <th className="p-2 border-x border-gray-300 w-[75px] bg-gray-100">Hr</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y divide-gray-200">
                            {sortedRooms.map((room, index) => {
                                const rec = records.find(r => r.roomNumber === room);
                                
                                return (
                                    <tr key={room} className={`transition-colors ${rec ? 'bg-white hover:bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                        <td className="p-1 border-x border-gray-200 text-gray-400 sticky left-0 bg-inherit z-30">
                                            {index + 1}
                                        </td>
                                        <td className="p-1 px-2 border-x border-gray-200 font-bold text-gray-800 uppercase truncate text-left sticky left-[40px] bg-inherit z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {rec ? rec.name : ''}
                                        </td>
                                        <td className="p-1 border-x border-gray-200 font-bold text-indigo-700">
                                            {formatRoom(room)}
                                        </td>
                                        <td className="p-0.5 border-x border-gray-200 bg-yellow-50/20">
                                            {rec && (
                                                <>
                                                    <input type="text" defaultValue={rec.rmNumber || ''} onBlur={(e) => handleInlineSave(rec.id, 'rmNumber', e.target.value)} className="w-full bg-transparent outline-none text-center font-mono no-print" placeholder="..." />
                                                    <span className="print-text">{rec.rmNumber || ''}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-1 px-2 border-x border-gray-200 leading-tight text-left">
                                            {rec ? (
                                                <>
                                                    <div className="font-bold text-gray-700">{rec.dpjpName}</div>
                                                    {(rec.raberName || rec.raber2Name) && (
                                                        <div className="text-blue-600 font-bold italic text-[9px]">
                                                            Rb: {[rec.raberName, rec.raber2Name].filter(Boolean).map(n => n).join(', ')}
                                                        </div>
                                                    )}
                                                </>
                                            ) : ''}
                                        </td>
                                        <td className="p-0.5 border-x border-gray-200 bg-yellow-50/20">
                                            {rec && (
                                                <>
                                                    <input type="text" defaultValue={rec.bpjsClass || ''} onBlur={(e) => handleInlineSave(rec.id, 'bpjsClass', e.target.value)} className="w-full bg-transparent outline-none text-center no-print" placeholder="..." />
                                                    <span className="print-text">{rec.bpjsClass || ''}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-0.5 border-x border-gray-200 bg-yellow-50/20">
                                            {rec && (
                                                <>
                                                    <input 
                                                        type="text" 
                                                        defaultValue={formatCustomDate(rec.admissionDate)} 
                                                        onChange={handleDateMasking}
                                                        onBlur={(e) => { const pd = parseCustomDate(e.target.value); if (pd !== rec.admissionDate) handleInlineSave(rec.id, 'admissionDate', pd); }} 
                                                        className="w-full bg-transparent outline-none text-center font-mono no-print" 
                                                        placeholder="dd/mm/yy hh:mm" 
                                                    />
                                                    <span className="print-text font-mono">{formatCustomDate(rec.admissionDate) || ''}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-1 border-x border-gray-200 font-bold text-rose-600">
                                            {rec ? hitungLamaRawat(rec.admissionDate) : ''}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
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
            
            {/* ... (Bagian Lab, Rad, Tindakan, Terapi JANGAN DIUBAH) ... */}
            
            {/* 5. Lain-lain (UPDATE DISINI) */}
            {others.map((line, idx) => {
                const lower = line.toLowerCase();

                // A. LOGIKA BLPL (HITAM - SEPERTI YANG SUDAH ADA)
                if (lower.match(/\b(blpl|rblpl|pulang|boleh pulang)\b/)) {
                    return (
                        <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm bg-black text-white">
                            🎉 {line.toUpperCase()}
                        </div>
                    );
                }

                // B. LOGIKA KONSUL (BARU ✨) -> WARNA ORANYE (AMBER)
                // Biar beda sama Rad (Biru) dan Lab (Merah)
                if (lower.match(/\b(lapor|konsul|konsultasi|ts|rawat gabung|alih rawat)\b/)) {
                    return (
                        <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm bg-amber-100 border-amber-400 text-amber-900">
                            👨‍⚕️ {line}
                        </div>
                    );
                }

                // C. LOGIKA PINDAH/TRANSFER (BARU ✨) -> WARNA INDIGO (NILA)
                // Biar kelihatan beda sebagai "Perubahan Ruangan"
                if (lower.match(/\b(pindah|transfer|rujuk|pindah kamar)\b/)) {
                    return (
                        <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm bg-indigo-100 border-indigo-400 text-indigo-900">
                            🏥 {line}
                        </div>
                    );
                }

                // D. DEFAULT (TEKS BIASA)
                return <div key={`other-${idx}`} className="text-xs text-gray-700 whitespace-pre-wrap">{line}</div>;
            })}
        </div>
    );
};

// --- Helper Baru: Format Objektif dengan Balon Lacak Terintegrasi ---
const renderObjectiveCell = (text) => {
    if (!text) return '-';
    const lines = text.split('\n');
    
    // 1. Ambil baris yang mengandung kata "Lacak" (Case-Insensitive)
    const lacakLines = lines.filter(line => line.trim().toLowerCase().startsWith('lacak'));
    
    // 2. Ambil baris sisanya (TTV dan data objektif lainnya)
    const normalLines = lines.filter(line => !line.trim().toLowerCase().startsWith('lacak'));

    let lacakBubble = null;
    if (lacakLines.length > 0) {
        // Ekstrak nama pemeriksaannya saja (menghapus kata "Lacak/Lapor" atau "Lacak")
        const items = lacakLines.map(line => {
            return line
                .replace(/lacak\/lapor\s*/i, '') // Hapus Lacak/Lapor
                .replace(/lacak\s*/i, '')       // Hapus Lacak (jika inputnya cuma 'Lacak Sputum')
                .trim();
        });

        // Gabungkan semua item dengan koma
        const combinedItems = items.join(', ');

        lacakBubble = (
            <div className="bg-orange-100 text-orange-900 border border-orange-300 px-2 py-1.5 rounded-lg mb-2 font-bold inline-block w-full shadow-sm animate-pulse">
                <span className="mr-1">⚠️</span> LACAK/LAPOR: {combinedItems}
            </div>
        );
    }

    return (
        <div className="text-xs text-gray-800 whitespace-pre-wrap font-sans">
            {/* Tampilkan Balon Lacak Terlebih Dahulu Jika Ada */}
            {lacakBubble}
            
            {/* Tampilkan Sisa Teks Objektif (TTV, dll) */}
            {normalLines.map((line, idx) => (
                <div key={idx}>{line}</div>
            ))}
        </div>
    );
};

const renderLacakTtv = (objectiveText) => {
    if (!objectiveText) return <span className="text-gray-300">-</span>;
    const lines = objectiveText.split('\n');
    // Ambil hanya yang depannya 'Lacak'
    const items = lines
        .filter(line => line.trim().toLowerCase().startsWith('lacak'))
        .map(line => line.replace(/lacak\/lapor\s*/i, '').replace(/lacak\s*/i, '').trim());
    
    if (items.length === 0) return <span className="text-gray-300">-</span>;
    
    return (
        <div className="text-[9px] font-bold text-orange-700 leading-tight">
            ⚠️ {items.join(', ')}
        </div>
    );
};

// --- HELPER FUNGSI TANGGAL & LAMA RAWAT UNTUK TTV ---
const formatDateCM = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
};

const parseDateCM = (text) => {
    if (!text) return '';
    const match = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})[\s,]+(\d{1,2})[\:\.](\d{1,2})/);
    if (match) {
        let [_, d, m, y, h, min] = match;
        if (y.length === 2) y = '20' + y;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
    }
    return text;
};

const hitungHariCM = (tanggalMasuk) => {
    if (!tanggalMasuk) return '-';
    const start = new Date(tanggalMasuk);
    if (isNaN(start)) return '?';
    const now = new Date();
    const diffTime = now.getTime() - start.getTime();
    
    if (diffTime < 0) return '0 hr 0 jm';
    
    // Hitung Hari dan Jam
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${diffDays} hr ${diffHours} jm`;
};

// --- PATIENT TABLE FINAL (DENGAN BUKU CM INLINE DI MODE TTV) ---
const PatientTable = ({ records, onEdit, onPrint, onShowLaporModal, onDischarge, roomSortOrder, onPrintTTV, onPrintSOAP, onQuickTtv, onBulkDischarge, updateRecord, onPrintBukuCM, onPrintLabel, roomList=ROOM_LIST }) => {
    
    const [viewMode, setViewMode] = useState('soap');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => { if (!isSelectionMode) setSelectedIds([]); }, [isSelectionMode]);

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(records.map(r => r.id));
        else setSelectedIds([]);
    };

    const handleSelectRow = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const executeBulkDischarge = () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Yakin ingin memulangkan ${selectedIds.length} pasien terpilih? Status kamar akan menjadi KOSONG.`)) {
            onBulkDischarge(selectedIds);
            setIsSelectionMode(false); 
        }
    };

    const sortedRecords = useMemo(() => {
        // 1. CEK SPESIAL: Apakah daftar saat ini HANYA berisi pasien dr. Delvi?
        const isDelviOnly = records.length > 0 && records.every(r => r.dpjpName === 'dr. Delvi, Sp.PD');

        if (isDelviOnly) {
            // Urutan huruf U sesuai request (aku selipkan K12 di antara 11 dan 14 biar gak nyasar jika ada)
            const uShapeBase = ['K6', 'K4', 'K2', 'K1', 'K3', 'K5', 'K7', 'K8', 'K9', 'K11', 'K12', 'K14', 'K15', 'K13', 'K10'];
            
            // Bikin otomatis jadi K6A, K6B, K4A, K4B, dst agar A dan B selalu berdampingan
            const uShapeOrder = uShapeBase.flatMap(k => [`${k}A`, `${k}B`]);

            return [...records].sort((a, b) => {
                let indexA = uShapeOrder.indexOf(a.roomNumber);
                let indexB = uShapeOrder.indexOf(b.roomNumber);
                // Kalau tiba-tiba ada kamar di luar prediksi, lempar ke urutan paling bawah
                if (indexA === -1) indexA = 999;
                if (indexB === -1) indexB = 999;
                return indexA - indexB;
            });
        }

        // 2. Logic Lama: Filter berdasarkan pilihan Dropdown Kamar
        if (roomSortOrder && roomSortOrder.length > 0 && roomSortOrder.length < 24) {
            return [...records].sort((a, b) => {
                const indexA = roomSortOrder.indexOf(a.roomNumber);
                const indexB = roomSortOrder.indexOf(b.roomNumber);
                return indexA - indexB;
            });
        }

        // 3. Logic Default: Berhitung Numerik (1A, 1B, 2A, 2B)
        return [...records].sort((a, b) => 
            a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [records, roomSortOrder]);

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
        // Tarik semua kategori dari parsePlanning
        const { labs, rads, tms, rxs } = parsePlanning(planningText);
        
        // Cek apakah semuanya kosong
        if (labs.length === 0 && rads.length === 0 && tms.length === 0 && rxs.length === 0) {
            return <span className="text-gray-300">-</span>;
        }

        return (
            <div className="text-[10px] leading-tight space-y-1">
                {/* LAB dengan titik dua literal */}
                {labs.length > 0 && (
                    <div className="text-red-700 font-medium">
                        <span className="font-bold text-[9px] bg-red-50 border border-red-100 px-1 rounded mr-1">LAB: </span>
                        {labs.join(', ')}
                    </div>
                )}
                
                {/* RADIOLOGI dengan titik dua literal */}
                {rads.length > 0 && (
                    <div className="text-blue-700 font-medium">
                        <span className="font-bold text-[9px] bg-blue-50 border border-blue-100 px-1 rounded mr-1">RAD: </span>
                        {rads.join(', ')}
                    </div>
                )}

                {/* TINDAKAN (TM) - Tambahan agar konsisten */}
                {tms.length > 0 && (
                    <div className="text-emerald-700 font-medium">
                        <span className="font-bold text-[9px] bg-emerald-50 border border-emerald-100 px-1 rounded mr-1">TM: </span>
                        {tms.join(', ')}
                    </div>
                )}

                {/* TERAPI (TH) - Tambahan agar konsisten */}
                {rxs.length > 0 && (
                    <div className="text-fuchsia-700 font-medium">
                        <span className="font-bold text-[9px] bg-fuchsia-50 border border-fuchsia-100 px-1 rounded mr-1">TH: </span>
                        {rxs.join(', ')}
                    </div>
                )}
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
    // --- SIHIR AUTO-FORMAT TANGGAL (UNTUK MODE TTV) ---
    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); // Ambil angka saja
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 8); // YYYY (4 digit)
        if (v.length > 8) final += ', ' + v.substring(8, 10); // Koma dan Jam
        if (v.length > 10) final += ':' + v.substring(10, 12); // Menit
        e.target.value = final;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            
            <div className="flex border-b bg-gray-50 p-1 gap-2 items-center justify-between flex-shrink-0">
                {isSelectionMode ? (
                    <div className="flex gap-2 flex-1 items-center px-2 animate-in fade-in slide-in-from-left-5 duration-300 bg-red-50 rounded py-1">
                        <button onClick={() => setIsSelectionMode(false)} className="text-gray-500 hover:text-gray-700 font-bold text-xs border px-3 py-1 bg-white rounded hover:bg-gray-100 transition">Batal</button>
                        <div className="text-xs font-bold text-red-800 bg-red-100 px-2 py-1 rounded border border-red-200">{selectedIds.length} Dipilih</div>
                        <button onClick={executeBulkDischarge} disabled={selectedIds.length === 0} className={`px-4 py-1 text-xs font-bold text-white rounded shadow-sm transition flex items-center gap-1 ${selectedIds.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'}`}>
                            <span>🚪</span> PULANGKAN {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                        </button>
                    </div>
                ) : (                    
                    <div className="flex gap-1 flex-1">
                        <button onClick={() => setIsSelectionMode(true)} className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-[10px] font-bold rounded hover:bg-indigo-50 transition shadow-sm whitespace-nowrap mr-2 flex items-center gap-1"><span>☑️</span> Pilih Banyak</button>
                        <button onClick={() => setViewMode('soap')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'soap' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📝 Mode SOAP</button>
                        <button onClick={() => setViewMode('ttv')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'ttv' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📊 Mode TTV</button>
                        <button onClick={() => setViewMode('buku-cm')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'buku-cm' ? 'bg-emerald-600 text-white shadow-sm border-emerald-600' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📖 Buku CM</button>
                    </div>
                )}
                
                {viewMode === 'ttv' && !isSelectionMode && (
                    <button onClick={onPrintTTV} className="px-3 py-1.5 bg-white border border-green-600 text-green-700 text-[10px] font-bold rounded hover:bg-green-50 transition shadow-sm whitespace-nowrap">🖨️ Cetak Lembar TTV</button>
                )}

                {viewMode === 'soap' && !isSelectionMode && (
                    <button onClick={onPrintSOAP} className="px-3 py-1.5 bg-white border border-blue-600 text-blue-700 text-[10px] font-bold rounded hover:bg-blue-50 transition shadow-sm whitespace-nowrap">🖨️ Cetak Lembar SOAP</button>
                )}
            </div>

            {viewMode === 'buku-cm' ? (
                <div className="flex-1 bg-gray-50 overflow-hidden"> {/* Ganti overflow-y-auto jadi overflow-hidden */}
                    <BukuCMTable roomList={roomList} records={sortedRecords} updateRecord={updateRecord} onPrint={onPrintBukuCM} />
                </div>
            ) : (
                <div id="ttv-table-area" className="overflow-auto flex-1 custom-scrollbar">
                    <table className={`w-full text-xs border-collapse table-fixed ${viewMode === 'ttv' ? 'min-w-[1100px]' : 'min-w-[1000px]'}`}>
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm h-9">
                            <tr>
                                <th className="p-2 border border-gray-300 w-[140px] text-left sticky left-0 bg-gray-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px]">
                                    {isSelectionMode ? (
                                        <div className="flex items-center gap-2 pl-1 bg-white border border-indigo-200 rounded px-1 py-0.5">
                                            <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === sortedRecords.length && sortedRecords.length > 0} className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"/>
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
                                        {/* HEADER TAMBAHAN BUKU CM DI TTV */}
                                        <th className="p-1 border border-gray-300 w-[60px] text-center bg-emerald-50 text-[10px]">No.RM</th>
                                        <th className="p-1 border border-gray-300 w-[35px] text-center bg-emerald-50 text-[10px]">Kls</th>
                                        <th className="p-1 border border-gray-300 w-[100px] text-center bg-emerald-50 text-[10px]">Tgl Msk</th>
                                        <th className="p-1 border border-gray-300 w-[60px] text-center bg-emerald-50 text-[10px]">Hari</th>
                                        
                                        {/* HEADER TTV ASLI */}
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">TD</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">Nadi</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">Suhu</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">RR</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">SpO2</th>
                                        {/* KOLOM BARU: LACAK HASIL ✨ */}
                                        <th className="p-1 border border-gray-300 w-[110px] text-center bg-gray-50 text-gray-800 font-bold text-[10px]">⚠️ Lacak Hasil</th>
                                        
                                        <th className="p-2 border border-gray-300 text-left bg-gray-50 text-gray-800 font-bold text-[10px]">⚠️ Rencana / Persiapan</th>
                                    </>
                                )}
                                <th className="p-2 border border-gray-300 w-[120px] text-center no-print text-[10px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewMode === 'soap' ? (
                                // --- MODE SOAP (Hanya Pasien Aktif) ---
                                sortedRecords.map((rec, index) => (
                                    <tr 
                                        key={rec.id} 
                                        onClick={() => isSelectionMode ? handleSelectRow(rec.id) : onEdit(rec)} 
                                        className={`cursor-pointer transition-colors border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${selectedIds.includes(rec.id) ? '!bg-indigo-100 border-indigo-200' : 'hover:bg-indigo-50/50'}`}
                                    >
                                        <td className="p-1.5 border-r border-gray-300 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-inherit">
                                            <div className="flex items-start gap-1">
                                                {isSelectionMode && (
                                                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" checked={selectedIds.includes(rec.id)} onChange={() => handleSelectRow(rec.id)} className="w-3.5 h-3.5 cursor-pointer accent-indigo-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-[11px] text-indigo-900 truncate leading-tight">{rec.name}</div>
                                                    <div className="text-[9px] font-mono text-gray-400">RM: {rec.rmNumber || '-'}</div>
                                                    <div className="flex gap-1 mt-0.5">
                                                        <span className="font-bold bg-yellow-100 px-1 rounded text-[9px] border border-yellow-200">{rec.roomNumber}</span>
                                                        <span className="bg-gray-100 px-1 rounded text-[8px] text-gray-500 border">{rec.gender}</span>
                                                    </div>
                                                    <div className="mt-0.5 text-gray-600 italic text-[9px] truncate font-medium">DPJP: {rec.dpjpName}</div>
                                                    {(rec.raberName || rec.raber2Name) && (
                                                        <div className="mt-0.5 text-blue-600 font-bold text-[9px] leading-tight">
                                                            <span className="text-gray-400 font-normal">Rb: </span>
                                                            {[rec.raberName, rec.raber2Name].filter(Boolean).map(name => name).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2 border-r border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.subjective || '-'}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">{renderObjectiveCell(rec.objective)}</td>
                                        <td className="p-2 border-r border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.analysis || '-'}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">{renderPlanningCell(rec.planning)}</td>
                                        <td className="p-1.5 border-r border-gray-300 align-middle no-print" onClick={(e) => e.stopPropagation()}>
                                            <div className="grid grid-cols-2 gap-1">
                                                <button onClick={() => onEdit(rec)} className="flex flex-col items-center justify-center p-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 border border-yellow-300" title="Edit"><span className="text-sm">✏️</span><span className="text-[8px] font-bold">Edit</span></button>
                                                <button onClick={() => onPrint(rec)} className="flex flex-col items-center justify-center p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300" title="Cetak"><span className="text-sm">🖨️</span><span className="text-[8px] font-bold">Cetak</span></button>
                                                <button onClick={() => onPrintLabel(rec)} className="flex flex-col items-center justify-center p-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 border border-purple-300" title="Label Spuit"><span className="text-sm">🏷️</span><span className="text-[7px] font-bold">Label</span></button>
                                                <button onClick={() => onShowLaporModal(rec)} className="flex flex-col items-center justify-center p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300" title="Lapor WA"><span className="text-sm">📱</span><span className="text-[8px] font-bold">Lapor</span></button>
                                                <button onClick={() => onDischarge(rec.id, rec.name, rec.roomNumber)} className="flex flex-col items-center justify-center p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300" title="Keluar"><span className="text-sm">🚪</span><span className="text-[8px] font-bold">Keluar</span></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                // --- MODE TTV (24 Kamar Kosong & Terisi) ---
                                [...roomList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map((room, index) => {
                                    const rec = records.find(r => r.roomNumber === room && !r.isDischarged);
                                    return (
                                        <tr key={room} className={`transition-colors border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${rec ? 'hover:bg-indigo-50/50 cursor-pointer' : ''}`} onClick={() => rec ? onEdit(rec) : null}>
                                            <td className="p-1.5 border-r border-gray-300 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-inherit">
                                                <div className="flex items-start gap-1">
                                                    <div className="flex-1 min-w-0">
                                                        {rec ? (
                                                            <>
                                                                <div className="font-bold text-[11px] text-indigo-900 truncate leading-tight">{rec.name}</div>
                                                                {/* BARIS "RM: xxx" DIHAPUS DI SINI AGAR LEBIH HEMAT KERTAS SAAT PRINT */}
                                                                <div className="flex gap-1 mt-0.5">
                                                                    <span className="font-bold bg-yellow-100 px-1 rounded text-[9px] border border-yellow-200">{room}</span>
                                                                    <span className="bg-gray-100 px-1 rounded text-[8px] text-gray-500 border">{rec.gender}</span>
                                                                </div>
                                                                <div className="mt-0.5 text-gray-600 italic text-[9px] truncate font-medium">DPJP: {rec.dpjpName}</div>
                                                                {(rec.raberName || rec.raber2Name) && (
                                                                    <div className="mt-0.5 text-blue-600 font-bold text-[9px] leading-tight">
                                                                        <span className="text-gray-400 font-normal">Rb: </span>
                                                                        {[rec.raberName, rec.raber2Name].filter(Boolean).map(name => name).join(', ')}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="font-bold text-[11px] text-gray-300 truncate leading-tight">...</div>
                                                                <div className="flex gap-1 mt-0.5">
                                                                    <span className="font-bold bg-gray-100 px-1 rounded text-[9px] border border-gray-200 text-gray-400">{room}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-1 border-r border-gray-300 align-middle text-center bg-emerald-50/30 hover:bg-yellow-100/50" onClick={(e) => { if(rec) e.stopPropagation(); }}>
                                                {rec ? (
                                                    <>
                                                        <input type="text" defaultValue={rec.rmNumber || ''} onBlur={(e) => updateRecord(rec.id, { rmNumber: e.target.value })} className="w-full bg-transparent outline-none text-center font-mono text-[9px] no-print focus:border-b border-indigo-500" />
                                                        <span className="hidden print:inline text-[9px] font-mono">{rec.rmNumber || ''}</span>
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center bg-emerald-50/30 hover:bg-yellow-100/50" onClick={(e) => { if(rec) e.stopPropagation(); }}>
                                                {rec ? (
                                                    <>
                                                        <input type="text" defaultValue={rec.bpjsClass || ''} onBlur={(e) => updateRecord(rec.id, { bpjsClass: e.target.value })} className="w-full bg-transparent outline-none text-center text-[9px] no-print focus:border-b border-indigo-500" />
                                                        <span className="hidden print:inline text-[8px]">{rec.bpjsClass || ''}</span>
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center bg-emerald-50/30 hover:bg-yellow-100/50" onClick={(e) => { if(rec) e.stopPropagation(); }}>
                                                {rec ? (
                                                    <>
                                                        <input 
                                                            type="text" 
                                                            defaultValue={formatDateCM(rec.admissionDate)} 
                                                            onChange={handleDateMasking} 
                                                            onBlur={(e) => { const pd = parseDateCM(e.target.value); if(pd !== rec.admissionDate) updateRecord(rec.id, { admissionDate: pd }); }} 
                                                            className="w-full bg-transparent outline-none text-center font-mono text-[9px] no-print focus:border-b border-indigo-500" 
                                                            placeholder="dd/mm/yy hh:mm" 
                                                        />
                                                        <span className="hidden print:inline text-[8px] font-mono">{formatDateCM(rec.admissionDate) || ''}</span>
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-bold text-gray-600 text-[10px]">
                                                {rec ? hitungHariCM(rec.admissionDate) : ''}
                                            </td>

                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono font-bold text-[10px]">{rec ? getTtvValue(rec.objective, 'TD') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'N') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'S') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'RR') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'SpO2') : ''}</td>
                                            {/* DATA LACAK HASIL (BARU) ✨ */}
                                            <td className="p-1.5 border-r border-gray-300 align-top">
                                                {rec ? renderLacakTtv(rec.objective) : null}
                                            </td>
                                            <td className="p-1.5 border-r border-gray-300 align-top">
                                                {rec ? (
                                                    <>
                                                        {getPreparationAlert(rec.planning)}
                                                        {renderTtvPlanning(rec.planning)}
                                                    </>
                                                ) : null}
                                            </td>
                                            
                                            <td className="p-1.5 border-r border-gray-300 align-middle no-print" onClick={(e) => e.stopPropagation()}>
                                                {rec ? (
                                                    <button onClick={() => onQuickTtv(rec)} className="w-full h-full py-2 bg-green-100 text-green-700 rounded border border-green-300 hover:bg-green-200 text-[10px] font-bold shadow-sm flex items-center justify-center" title="Isi TTV Cepat">+ Input TTV</button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            
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
const generateShiftReport = (activeRecords, records, waitingList, dpjpProfiles, wardName = 'Melati', roomList=[]) => {
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
    const totalBed = roomList.length || 24;
    const activeCount = activeRecords.length;
    
    // 4. HITUNG KAMAR KOSONG & GENDER
    let emptyCount = 0; let emptyMale = 0; let emptyFemale = 0; 
    let emptyIso = 0; let emptyIsoMale = 0; let emptyIsoFemale = 0;
    const occupiedRooms = activeRecords.map(r => r.roomNumber);
    
    // PERHATIAN: Sesuaikan array isoRooms ini dengan nama kamar isolasimu yang baru
    const isoRooms = ['K14A', 'K15A', 'K15B']; 
    const allRooms = ROOM_LIST;

    allRooms.forEach(room => {
        if (!occupiedRooms.includes(room)) {
            // Cek apakah punya tetangga
            const bedCode = room.slice(-1); // A atau B
            const roomCode = room.slice(0, -1); // K1, K15, dll
            
            let isSisaBed = false;
            let neighborGender = null;

            if (bedCode === 'A' || bedCode === 'B') {
                const neighborBed = bedCode === 'A' ? 'B' : 'A';
                const neighborRoom = `${roomCode}${neighborBed}`;
                
                // Cek apakah tetangga ada di daftar seluruh kamar & terisi?
                if (allRooms.includes(neighborRoom)) {
                    const neighborRec = activeRecords.find(r => r.roomNumber === neighborRoom);
                    if (neighborRec) {
                        isSisaBed = true; // Tandai bahwa ini cuma "Sisa Bed", bukan Kamar Kosong
                        neighborGender = neighborRec.gender;
                    }
                }
            }

            // Alokasikan ke Isolasi atau Umum dengan presisi tinggi
            if (isoRooms.includes(room)) {
                if (isSisaBed) {
                    if (neighborGender === 'L') emptyIsoMale++;
                    else if (neighborGender === 'P') emptyIsoFemale++;
                } else {
                    emptyIso++; // Hanya bertambah kalau tetangganya juga kosong
                }
            } else {
                if (isSisaBed) {
                    if (neighborGender === 'L') emptyMale++;
                    else if (neighborGender === 'P') emptyFemale++;
                } else {
                    emptyCount++; // Hanya bertambah kalau tetangganya juga kosong
                }
            }
        }
    });

    // 5. STATISTIK PERGERAKAN
    const newPatientCount = activeRecords.filter(r => { if(!r.createdAt) return false; const t = r.createdAt.seconds ? new Date(r.createdAt.seconds * 1000) : r.createdAt; return t >= shiftStart && t <= shiftEnd; }).length;
    
    // Ambil data pasien yang keluar pada shift ini
    const dischargedRecords = records.filter(r => { 
        if(!r.isDischarged || !r.updatedAt) return false; 
        const t = r.updatedAt.seconds ? new Date(r.updatedAt.seconds * 1000) : r.updatedAt; 
        return t >= shiftStart && t <= shiftEnd; 
    });

    // PISAHKAN HITUNGAN BERDASARKAN LABEL
    const pulangCount = dischargedRecords.filter(r => r.dischargeType === 'pulang' || !r.dischargeType).length;
    const pindahCount = dischargedRecords.filter(r => r.dischargeType === 'pindah').length;
    const meninggalCount = dischargedRecords.filter(r => r.dischargeType === 'meninggal').length;
    
    // PERBAIKAN BLPL: Menggunakan Regex \b agar kata yang mirip tidak ikut terhitung
    const blplCount = activeRecords.filter(r => {
        if (!r.planning) return false;
        const p = r.planning.toLowerCase();
        // \b memastikan kata tersebut berdiri sendiri. "aps" tidak akan match dengan "capsul"
        return /\b(blpl|pulang|aps)\b/.test(p);
    }).length;

    // --- 6. FILTER DPJP (YANG 0 PASIEN HILANG) ---
    const activeDpjpList = dpjpProfiles
        .map(dr => {
            const count = activeRecords.filter(r => r.dpjpName === dr.name).length;
            return { name: dr.name, count };
        })
        .filter(item => item.count > 0)
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

${snow}${rs} *Ruang ${wardName}* ${rs}${snow}

Kapasitas bed          : ${totalBed}
Jumlah pasien          : ${activeCount}
Jumlah pasien virtual : -
Total pasien keseluruhan : ${activeCount}

Kamar Kosong : ${emptyCount > 0 ? emptyCount + ' bed' : '-'}
${woman}      : ${emptyFemale > 0 ? emptyFemale + ' bed' : '-'}
${man}      : ${emptyMale > 0 ? emptyMale + ' bed' : '-'}

Kamar Kosong Isolasi  : ${emptyIso > 0 ? emptyIso + ' bed' : '-'}
${woman}      : ${emptyIsoFemale > 0 ? emptyIsoFemale + ' bed' : '-'}
${man}      : ${emptyIsoMale > 0 ? emptyIsoMale + ' bed' : '-'}

Pasien Sudah Pulang        : ${pulangCount > 0 ? pulangCount : '-'}
Pasien Rencana Pulang    : ${blplCount > 0 ? blplCount : '-'}
Pasien Pindah Ruangan    : ${pindahCount > 0 ? pindahCount : '-'}
Pasien Pulang Paksa         : -
Pasien Meninggal              : ${meninggalCount > 0 ? meninggalCount : '-'}
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
                {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
        </div>
    );
};

// --- LOGIC UTAMA (MEDICAL RECORD APP - LEVEL 4 COMPLETED) ---
const MedicalRecordApp = ({ 
    db, userId, appId, isOnline, onLogout, 
    currentUser, setAppMode, cashflowRole, onSwitchWard 
}) => {
    // ✨ SUNTIKAN TAHAP 3: MASTER KEY BANGSAL
  const currentWardConfig = WARD_CONFIG[currentUser?.ward || 'MELATI'] || WARD_CONFIG['MELATI'];

    // --- STATE LEVEL 4: MANAJEMEN USER (BARU) ---
  const [allUsers, setAllUsers] = useState([]); // Daftar user (Admin Only)
  const [profileForm, setProfileForm] = useState({ name: '', pass: '' }); // Form Profil Sendiri
  const [adminUserForm, setAdminUserForm] = useState({ id: '', name: '', pass: '', role: 'member', ward: 'MELATI' }); // ✨ Ditambah default ward

  // --- STATE LAMA (TETAP ADA) ---
  const [records, setRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRecords, setActiveRecords] = useState([]);
  const [archivedRecords, setArchivedRecords] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [waitingList, setWaitingList] = useState([]);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [quickTtvTarget, setQuickTtvTarget] = useState(null);
  const [archiveSearch, setArchiveSearch] = useState('');
  
  // State untuk Data Dinamis (Setelan) - dengan localStorage backup
    const [dpjpProfiles, setDpjpProfiles] = useState(() => {
        try { 
            // Coba ambil dari memori browser dulu (jika internet mati/diblokir)
            const localData = JSON.parse(localStorage.getItem('backupDpjp'));
            if (localData && localData.length > 0) return localData;
        } catch (e) {}
        // Jika benar-benar kosong, baru ambil dari constants.js
        return initialDpjpProfiles.map(p => ({...p, name: p.name}));
    });
    // Master data lists (lab, radiologi, tindakan, terapi) -- dapat diubah lewat Setelan
    // Load dari localStorage sebagai fallback jika Firebase lambat/error
    const [masterLabs, setMasterLabs] = useState(() => {
      try { return JSON.parse(localStorage.getItem('masterLabs')) || []; } catch { return []; }
    });
    const [masterRads, setMasterRads] = useState(() => {
      try { return JSON.parse(localStorage.getItem('masterRads')) || []; } catch { return []; }
    });
    const [masterProcedures, setMasterProcedures] = useState(() => {
      try { return JSON.parse(localStorage.getItem('masterProcedures')) || []; } catch { return []; }
    });
    const [masterMedications, setMasterMedications] = useState(() => {
      try { return JSON.parse(localStorage.getItem('masterMedications')) || []; } catch { return []; }
    });
    // Input fields for master data
    const [newMasterLab, setNewMasterLab] = useState('');
    const [newMasterRad, setNewMasterRad] = useState('');
    const [newMasterProcedure, setNewMasterProcedure] = useState('');
    const [newMasterMedication, setNewMasterMedication] = useState('');
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState(null);      

    // Combined planning options (prefer master lists when available)
    const combinedPlanningOptions = useMemo(() => {
            const labs = Array.from(new Set([...(LAB_CHECKS || []), ...masterLabs])).map(i => ({ label: i, type: 'Lab' }));
            const rads = Array.from(new Set([...(RADIOLOGY_CHECKS || []), ...masterRads])).map(i => ({ label: i, type: 'Rad' }));
            const prots = Array.from(new Set([...(PROCEDURES || []), ...masterProcedures])).map(i => ({ label: i, type: 'Med' }));
            const meds = Array.from(new Set([...(MEDICATIONS || []), ...masterMedications])).map(i => ({ label: i, type: 'Rx' }));
            return [...labs, ...rads, ...prots, ...meds].sort((a, b) => a.label.localeCompare(b.label));
    }, [masterLabs, masterRads, masterProcedures, masterMedications]);
  const [historyLogs, setHistoryLogs] = useState([]); 

  const [view, setView] = useState('dashboard'); 
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState(null);
  
  // State Print
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);
  const [showBulkPrint, setShowBulkPrint] = useState(false); 

  const [showInputModal, setShowInputModal] = useState(false);
  const [recordForLapor, setRecordForLapor] = useState(null);
  const [recordForDischarge, setRecordForDischarge] = useState(null);
  const [showLaporModal, setShowLaporModal] = useState(false);

  const [dpjpFilter, setDpjpFilter] = useState([]); 
  const [selectedRoomFilter, setSelectedRoomFilter] = useState(currentWardConfig.roomList);
  
  const [showRaber1, setShowRaber1] = useState(false);
  const [showRaber2, setShowRaber2] = useState(false);
  const [showTtvModal, setShowTtvModal] = useState(false);
  
  
  const [confirmDetails, setConfirmDetails] = useState({ isOpen: false, message: '', title: '', action: () => {} });
  const openConfirm = (title, message, action) => { setConfirmDetails({ isOpen: true, title, message, action }); };
  const closeConfirm = () => { setConfirmDetails({ isOpen: false, message: '', title: '', action: () => {} }); };
  
  const [formData, setFormData] = useState({
    roomNumber: '', name: '', rmNumber: '', gender: '', 
    dpjpName: '', raberName: '', raber2Name: '', admissionDate: '', evidenceImages: [],
    subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
  });

  const [newDpjpName, setNewDpjpName] = useState('');
  const [newDpjpWa, setNewDpjpWa] = useState('');

  // --- [LEVEL 4] LOGIC: USER MONITORING & ACTIONS ---
  
  // 1. Monitor Users (Khusus Admin)
  useEffect(() => {
      if (currentUser?.role !== 'admin' || !db) return;
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('name', 'asc'));
      const unsub = onSnapshot(q, (snap) => {
          setAllUsers(snap.docs.map(d => d.data()));
      });
      return () => unsub();
  }, [db, currentUser]);

  // 2. Init Profile Form (Saat currentUser berubah)
  useEffect(() => {
      if (currentUser) {
          setProfileForm({ name: currentUser.name, pass: currentUser.pass });
      }
  }, [currentUser]);

  // 3. Action: Update Profil Sendiri
  const handleUpdateSelf = async () => {
      if (!profileForm.name || !profileForm.pass) return alert("Nama dan Password tidak boleh kosong!");
      try {
          const userRef = doc(db, 'users', currentUser.id);
          await updateDoc(userRef, { name: profileForm.name, pass: profileForm.pass });
          alert("Profil berhasil diupdate! Silakan login ulang nanti untuk melihat perubahan.");
      } catch (e) { alert("Gagal update: " + e.message); }
  };

  const handleAdminSaveUser = async () => {
      if (!adminUserForm.id || !adminUserForm.name || !adminUserForm.pass) return alert("Semua kolom wajib diisi!");
      const targetId = adminUserForm.id.toLowerCase().trim().replace(/\s+/g, '_');
      try {
          const exists = allUsers.find(u => u.id === targetId);
          if (!exists) {
             await setDoc(doc(db, 'users', targetId), { 
                 ...adminUserForm, 
                 id: targetId, 
                 ward: adminUserForm.ward || 'MELATI', // ✨ Kunci otomatis ruangan saat register
                 createdAt: Timestamp.now() 
             });
             alert(`User baru "${adminUserForm.name}" ditambahkan!`);
          } else {
             await updateDoc(doc(db, 'users', targetId), { 
                 name: adminUserForm.name, 
                 pass: adminUserForm.pass, 
                 role: adminUserForm.role,
                 ward: adminUserForm.ward || 'MELATI' // ✨ Izinkan update mutasi ruangan di sini
             });
             alert(`User "${adminUserForm.name}" diperbarui.`);
          }
          setAdminUserForm({ id: '', name: '', pass: '', role: 'member', ward: 'MELATI' });
      } catch (e) { alert("Error: " + e.message); }
  };

  // 5. Action: Admin Hapus User
  const handleAdminDeleteUser = async (targetId) => {
      if (targetId === currentUser.id) return alert("Tidak bisa menghapus diri sendiri!");
      if (!confirm("Hapus user ini permanen?")) return;
      try {
          await deleteDoc(doc(db, 'users', targetId));
          alert("User dihapus.");
      } catch (e) { alert("Gagal hapus: " + e.message); }
  };

  // --- MONITORING DAFTAR TUNGGU SECARA REAL-TIME ---
  useEffect(() => {
    if (!db || !appId) return;
    const wlRef = collection(db, `artifacts/${appId}/public/data/waitingList`);
    const q = query(wlRef, orderBy('createdAt', 'asc')); 
    const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setWaitingList(list);
    }, (err) => console.error("Gagal sinkronisasi Waiting List:", err));
    return () => unsub();
  }, [db, appId]);

  // --- PENCARIAN & FILTER ---
  const filteredActiveRecords = useMemo(() => {
    return activeRecords.filter(rec => {
        const matchesDpjp = dpjpFilter.length === 0 || dpjpFilter.includes(rec.dpjpName);
        const matchesRoom = selectedRoomFilter.length === ROOM_LIST.length || selectedRoomFilter.includes(rec.roomNumber);
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            rec.name.toLowerCase().includes(term) || 
            (rec.analysis && rec.analysis.toLowerCase().includes(term)) ||
            (rec.dpjpName && rec.dpjpName.toLowerCase().includes(term)) ||
            (rec.rmNumber && rec.rmNumber.includes(term)); 
        return matchesDpjp && matchesRoom && matchesSearch;
    });
  }, [activeRecords, dpjpFilter, selectedRoomFilter, searchTerm]); 

  // --- LOGIC DATABASE UTAMA ---
  const getCollectionRef = useCallback(() => {
    if (db) return collection(db, `artifacts/${appId}/public/data/medicalRecords`);
    return null;
  }, [db, appId]);
  
  const getConfigRef = useCallback(() => {
      if (db) return doc(db, `artifacts/${appId}/public/data/settings`, 'mainConfig');
      return null;
  }, [db, appId]);

  // 1. Load Settings (DPJP) - dengan retry dan localStorage fallback
  useEffect(() => {
      if (!userId) return; 
      const ref = getConfigRef();
      if (!ref) return;
      
      setIsSettingsLoaded(false);
      setSettingsError(null);
      let retryCount = 0;
      const maxRetries = 3;
      let timeoutId = null;

      const attemptLoad = () => {
        try {
          const unsubscribe = onSnapshot(ref, (snap) => {
              if (snap.exists()) {
                  const data = snap.data();
                  if (data.dpjpProfiles && Array.isArray(data.dpjpProfiles)) {
                  // 1. AUTO-SYNC: Cek dokter baru di constants.js yang belum ada di Firebase
                  const cloudNames = data.dpjpProfiles.map(p => p.name.toLowerCase());
                  const missingFromCloud = initialDpjpProfiles.filter(p => !cloudNames.includes(p.name.toLowerCase()));

                  let finalDpjp = data.dpjpProfiles;

                  if (missingFromCloud.length > 0) {
                      // Gabungkan dan urutkan
                      finalDpjp = [...data.dpjpProfiles, ...missingFromCloud].sort((a, b) => a.name.localeCompare(b.name));
                      // Tanam data baru ke Firebase tanpa menghapus yang lama
                      setDoc(ref, { dpjpProfiles: finalDpjp }, { merge: true }).catch(err => console.error("Auto-sync DPJP failed:", err));
                  }

                  // 2. SIMPAN STATE & LOKAL: Tampilkan di layar & simpan di memori anti-hilang
                  setDpjpProfiles(finalDpjp);
                  localStorage.setItem('backupDpjp', JSON.stringify(finalDpjp));
                    }
                  // load master lists if present dan simpan ke localStorage
                  if (data.masterLabs && Array.isArray(data.masterLabs)) {
                    setMasterLabs(data.masterLabs);
                    localStorage.setItem('masterLabs', JSON.stringify(data.masterLabs));
                  }
                  if (data.masterRads && Array.isArray(data.masterRads)) {
                    setMasterRads(data.masterRads);
                    localStorage.setItem('masterRads', JSON.stringify(data.masterRads));
                  }
                  if (data.masterProcedures && Array.isArray(data.masterProcedures)) {
                    setMasterProcedures(data.masterProcedures);
                    localStorage.setItem('masterProcedures', JSON.stringify(data.masterProcedures));
                  }
                  if (data.masterMedications && Array.isArray(data.masterMedications)) {
                    setMasterMedications(data.masterMedications);
                    localStorage.setItem('masterMedications', JSON.stringify(data.masterMedications));
                  }
                  setIsSettingsLoaded(true);
                  setSettingsError(null);
                  retryCount = 0; // Reset jika berhasil
              } else {
                  // ⚠️ Dokumen tidak ada: initialize dengan DPJP default saja, master kosong
                  setDoc(ref, { 
                    dpjpProfiles: initialDpjpProfiles, 
                    masterLabs: [], 
                    masterRads: [], 
                    masterProcedures: [], 
                    masterMedications: [] 
                  }).catch(err => console.error("Init settings error:", err));
                  setIsSettingsLoaded(true);
                  setSettingsError(null);
              }
          }, (err) => {
              // ⚠️ ERROR: Jangan reset state! Gunakan localStorage sebagai fallback
              console.warn("Firebase settings load error (retry " + (retryCount + 1) + "/" + maxRetries + "):", err.message);
              setSettingsError(err.message);
              
              // Tunggu dan retry jika masih ada kesempatan
              if (retryCount < maxRetries) {
                  retryCount++;
                  timeoutId = setTimeout(attemptLoad, 2000 * retryCount); // Exponential backoff: 2s, 4s, 6s
              } else {
                  // Setelah max retries, load dari localStorage dan anggap berhasil
                  console.log("Max retries reached. Using localStorage fallback for master data.");
                  setIsSettingsLoaded(true);
              }
          });
          
          return () => {
            unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
          };
        } catch (e) {
          console.error("Settings listener setup error:", e);
          setSettingsError(e.message);
          setIsSettingsLoaded(true);
        }
      };

      attemptLoad();
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
  }, [getConfigRef, userId]);

  const dpjpOptions = useMemo(() => dpjpProfiles.map(p => p.name), [dpjpProfiles]);

  // Generic save helper for settings (merges keys) - dengan localStorage backup
  const saveSettings = async (partial) => {
      const ref = getConfigRef();
      if (!ref) return;
      try {
          // Simpan ke localStorage dulu sebagai backup
          if (partial.dpjpProfiles) localStorage.setItem('backupDpjp', JSON.stringify(partial.dpjpProfiles));
          if (partial.masterLabs) localStorage.setItem('masterLabs', JSON.stringify(partial.masterLabs));
          if (partial.masterRads) localStorage.setItem('masterRads', JSON.stringify(partial.masterRads));
          if (partial.masterProcedures) localStorage.setItem('masterProcedures', JSON.stringify(partial.masterProcedures));
          if (partial.masterMedications) localStorage.setItem('masterMedications', JSON.stringify(partial.masterMedications));
          
          // Kemudian simpan ke Firebase
          await setDoc(ref, partial, { merge: true });
          setSettingsError(null);
      } catch(e) { 
          console.error("Save settings error:", e.message);
          alert("Gagal menyimpan setelan ke Firebase. Data sudah tersimpan lokal, akan sinkron saat koneksi baik."); 
      }
  };

  const handleAddDpjp = async () => {
      if (!isSettingsLoaded) return alert("Tunggu data termuat sempurna.");
      if (!newDpjpName.trim()) return alert("Nama DPJP kosong!");
      if (dpjpProfiles.some(p => p.name.toLowerCase() === newDpjpName.trim().toLowerCase())) return alert("Nama sudah ada!");

      let rawNumber = newDpjpWa.trim().replace(/\D/g, ''); 
      if (rawNumber.startsWith('0')) rawNumber = '62' + rawNumber.slice(1); 

      const newProfile = { name: newDpjpName.trim(), waNumber: rawNumber };
      const updated = [...dpjpProfiles, newProfile].sort((a,b) => a.name.localeCompare(b.name));
      await saveSettings({ dpjpProfiles: updated });
      setNewDpjpName(''); setNewDpjpWa('');
  };

  const handleRemoveDpjp = async (name) => {
      if (!isSettingsLoaded) return alert("Tunggu data termuat.");
      if (window.confirm(`Hapus ${name}?`)) {
          const updated = dpjpProfiles.filter(p => p.name !== name);
          await saveSettings({ dpjpProfiles: updated });
      }
  };

  // Handlers for master data (lab, rad, tindakan, terapi)
  const handleAddMaster = async (type) => {
      if (!isSettingsLoaded) return alert('Tunggu data termuat.');
      let updated = [];
      if (type === 'lab') {
          if (!newMasterLab.trim()) return alert('Nama lab kosong');
          if (masterLabs.includes(newMasterLab.trim())) return alert('Sudah ada');
          updated = [...masterLabs, newMasterLab.trim()].sort();
          setMasterLabs(updated); setNewMasterLab('');
          await saveSettings({ masterLabs: updated });
      } else if (type === 'rad') {
          if (!newMasterRad.trim()) return alert('Nama radiologi kosong');
          if (masterRads.includes(newMasterRad.trim())) return alert('Sudah ada');
          updated = [...masterRads, newMasterRad.trim()].sort();
          setMasterRads(updated); setNewMasterRad('');
          await saveSettings({ masterRads: updated });
      } else if (type === 'procedure') {
          if (!newMasterProcedure.trim()) return alert('Nama tindakan kosong');
          if (masterProcedures.includes(newMasterProcedure.trim())) return alert('Sudah ada');
          updated = [...masterProcedures, newMasterProcedure.trim()].sort();
          setMasterProcedures(updated); setNewMasterProcedure('');
          await saveSettings({ masterProcedures: updated });
      } else if (type === 'medication') {
          if (!newMasterMedication.trim()) return alert('Nama terapi/obat kosong');
          if (masterMedications.includes(newMasterMedication.trim())) return alert('Sudah ada');
          updated = [...masterMedications, newMasterMedication.trim()].sort();
          setMasterMedications(updated); setNewMasterMedication('');
          await saveSettings({ masterMedications: updated });
      }
  };

  const handleRemoveMaster = async (type, value) => {
      if (!isSettingsLoaded) return alert('Tunggu data termuat.');
      if (!window.confirm(`Hapus "${value}" dari master ${type}?`)) return;
      if (type === 'lab') {
          const updated = masterLabs.filter(i => i !== value);
          setMasterLabs(updated); await saveSettings({ masterLabs: updated });
      } else if (type === 'rad') {
          const updated = masterRads.filter(i => i !== value);
          setMasterRads(updated); await saveSettings({ masterRads: updated });
      } else if (type === 'procedure') {
          const updated = masterProcedures.filter(i => i !== value);
          setMasterProcedures(updated); await saveSettings({ masterProcedures: updated });
      } else if (type === 'medication') {
          const updated = masterMedications.filter(i => i !== value);
          setMasterMedications(updated); await saveSettings({ masterMedications: updated });
      }
  };

  // --- MONITORING MEDICAL RECORDS ---
  useEffect(() => {
    if (!userId) return;
    const ref = getCollectionRef();
    if (!ref) return;
    const q = query(ref, orderBy('createdAt', 'desc'), limit (1000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
          const docData = d.data();
          
          // --- TRANSLATOR NAMA KAMAR ---
          // Mengubah data lama (K1B1 -> K1A, K1B2 -> K1B) agar muncul di denah baru
          let updatedRoomNumber = docData.roomNumber || '';
          if (updatedRoomNumber.endsWith('B1')) {
              updatedRoomNumber = updatedRoomNumber.replace('B1', 'A');
          } else if (updatedRoomNumber.endsWith('B2')) {
              updatedRoomNumber = updatedRoomNumber.replace('B2', 'B');
          }

          return { 
              id: d.id, ...docData, 
              roomNumber: updatedRoomNumber, // Pakai nama kamar yang sudah diterjemahkan
              createdAt: docData.createdAt?.toDate() || new Date(),
              updatedAt: docData.updatedAt?.toDate() || null
          };
      });
      setRecords(data);
              
              // ✨ TAHAP 3: FILTER DATA HANYA UNTUK BANGSAL USER SAAT INI
                const myWardData = data.filter(r => (r.ward || 'MELATI') === (currentUser?.ward || 'MELATI'));
                
                // Pisahkan pasien aktif & arsip dari data bangsal terpilih
                const active = myWardData.filter(r => !r.isDischarged);
                const archived = myWardData.filter(r => r.isDischarged);
                
                setActiveRecords(active);
                setArchivedRecords(archived); 
                setOccupiedRooms(active.map(r => r.roomNumber));
    }, (err) => console.error("Firestore Error:", err));
    return () => unsubscribe();
  }, [getCollectionRef, userId]);

  // --- UPDATE: Logika Tarik Data (Mendukung Gambar) ---
  const pullDataForField = (field) => {
    if (!historyLogs || historyLogs.length === 0) return alert("Belum ada riwayat.");
    
    // Cari log terakhir yang punya data di field tersebut
    const foundLog = historyLogs.find(log => {
        if (Array.isArray(log[field])) return log[field].length > 0; // Cek jika itu array gambar
        return log[field] && log[field].trim().length > 0; // Cek jika itu teks
    });

    if (foundLog) {
        setFormData(prev => ({ ...prev, [field]: foundLog[field] }));
        alert(`Data ${field === 'evidenceImages' ? 'Gambar' : field.toUpperCase()} berhasil ditarik.`);
    } else { 
        alert(`Tidak ada data ${field === 'evidenceImages' ? 'Gambar' : field.toUpperCase()} di riwayat.`); 
    }
  };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(p => ({ ...p, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      roomNumber: '', name: '', rmNumber: '', gender: '', dpjpName: '', raberName: '', raber2Name: '',
      subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
      admissionDate: new Date().toISOString(), evidenceImages: [], bpjsClass: ''
    });
    setIsEditing(false);
    setShowRaber1(false); setShowRaber2(false);
    setCurrentRecordId(null);
  };

  const handleSelectRoom = (roomNumber) => {
      resetForm();
      setFormData(p => ({ ...p, roomNumber }));
      setShowInputModal(true); 
  };
  
  const handleEditRoom = (patientRecord) => {
      handleEdit(patientRecord);
  };

  const appendText = (field, text) => {
      setFormData(p => ({ ...p, [field]: p[field] ? p[field] + '\n' + text : text }));
  };

  const handleSubmit = (e) => { 
      e.preventDefault();
      if (!formData.name || !formData.roomNumber || !formData.dpjpName) {
          alert('Mohon lengkapi data wajib (Nama, Kamar, DPJP).');
          return;
      }
      
      const isRoomOccupied = occupiedRooms.includes(formData.roomNumber) && 
                             (!isEditing || (isEditing && formData.roomNumber !== activeRecords.find(r => r.id === currentRecordId)?.roomNumber));
      
      if (!isEditing && isRoomOccupied) return alert(`Kamar ${formData.roomNumber} sudah terisi.`);

      const now = Timestamp.now();
      
      // ✨ KODE YANG KEMARIN HILANG DIKEMBALIKAN ✨
      const data = { 
          ...formData, 
          admissionDate: parseDateCM(formData.admissionDate), 
          updatedAt: now,
          ward: currentUser?.ward || 'MELATI' // Stempel Bangsal
      };
      if (!isEditing) data.createdAt = now;
      const ref = getCollectionRef();

      if (isEditing && currentRecordId) {
          updateDoc(doc(ref, currentRecordId), data).catch(err => console.error("Gagal update:", err));
          
          if (db && appId) {
              const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${currentRecordId}/notes`);
              addDoc(notesRef, { 
                  ...formData, 
                  admissionDate: parseDateCM(formData.admissionDate),
                  createdAt: now, 
                  noteType: 'daily_update',
                  savedBy: currentUser?.name || 'System',
                  ward: currentUser?.ward || 'MELATI'
              }).catch(err => console.error("Gagal tambah riwayat:", err));
          }
      } else {
          addDoc(ref, data).then(newDoc => {
              if (db && appId) {
                  const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${newDoc.id}/notes`);
                  addDoc(notesRef, { 
                      ...formData, 
                      admissionDate: parseDateCM(formData.admissionDate),
                      createdAt: now, 
                      noteType: 'daily_update',
                      savedBy: currentUser?.name || 'System',
                      ward: currentUser?.ward || 'MELATI'
                  });
              }
          }).catch(err => console.error("Gagal tambah pasien:", err));
      }

      resetForm();
      setShowInputModal(false);
  };

  const handleSaveQuickTtv = async (ttvString) => {
    if (!quickTtvTarget || !db) return;
    setLoading(true);
    try {
        const ref = doc(db, `artifacts/${appId}/public/data/medicalRecords`, quickTtvTarget.id);
        const oldObjective = quickTtvTarget.objective || '';
        const timeStr = new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        const finalObjective = `[${timeStr}] ${ttvString}\n` + oldObjective;

        await updateDoc(ref, { objective: finalObjective, updatedAt: Timestamp.now() });

        const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${quickTtvTarget.id}/notes`);
        await addDoc(notesRef, { 
            ...quickTtvTarget, 
            objective: finalObjective, 
            noteType: 'ttv_update', 
            createdAt: Timestamp.now(),
            savedBy: currentUser?.name || 'System',
            ward: currentUser?.ward || 'MELATI' // ✨ TAHAP 2: STEMPEL TTV BANGSAL
        });
        setQuickTtvTarget(null); setShowTtvModal(false); 
    } catch (e) { alert("Gagal menyimpan TTV."); } finally { setLoading(false); }
  };

  // --- WAITING LIST LOGIC ---
  const handleAddWaiting = async (data) => {
    try {
        const wlRef = collection(db, `artifacts/${appId}/public/data/waitingList`);
        await addDoc(wlRef, { ...data, createdAt: Timestamp.now() });
    } catch (e) { alert("Gagal: " + e.message); }
  };

  const handleDeleteWaiting = async (id) => {
      if(!window.confirm("Hapus antrean?")) return;
      try { await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, id)); } catch (e) {}
  };

  // --- FUNGSI AUTO-SAVE BUKU CM (INLINE EDIT) ---
    const updateRecord = async (id, updatedFields) => {
        try {
            const colRef = getCollectionRef();
            if (!colRef) return;
            
            // Membuat referensi ke dokumen pasien spesifik
            const docRef = doc(colRef.firestore, colRef.path, id);
            
            // Menembak update ke database Firestore
            await updateDoc(docRef, updatedFields);
            console.log("Auto-save Buku CM berhasil!");
        } catch (error) {
            console.error("Gagal auto-save Buku CM:", error);
            alert("Gagal menyimpan otomatis. Cek koneksi internet.");
        }
    };

  const handleMoveToRoom = async (waitRec) => {
      const isOccupied = activeRecords.some(r => r.roomNumber === waitRec.plannedRoom);
      if (isOccupied) return alert(`Kamar ${waitRec.plannedRoom} masih TERISI!`);
      if(!window.confirm(`Masukkan ${waitRec.name} ke kamar ${waitRec.plannedRoom}?`)) return;
      
      try {
          setLoading(true);
          await addDoc(getCollectionRef(), {
              name: waitRec.name, roomNumber: waitRec.plannedRoom, dpjpName: 'dr. Belum Dipilih', gender: '', 
              createdAt: Timestamp.now(), updatedAt: Timestamp.now(), isDischarged: false,
              planning: waitRec.diagnosis ? `Diagnosa Awal: ${waitRec.diagnosis}` : ''
          });
          await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, waitRec.id));
          setView('dashboard'); 
      } catch (e) { alert("Error saat check-in."); } finally { setLoading(false); }
  };

  const updateWaitingListRoom = async (itemId, newRoom) => {
      const updatedList = waitingList.map(item => item.id === itemId ? { ...item, plannedRoom: newRoom } : item);
      setWaitingList(updatedList);
      try {
          const itemRef = doc(db, `artifacts/${appId}/public/data/waitingList`, itemId);
          await updateDoc(itemRef, { plannedRoom: newRoom });
      } catch(e) { console.error(e); }
  };

  const handleEdit = async (rec) => {
    setFormData({
        roomNumber: rec.roomNumber, name: rec.name, rmNumber: rec.rmNumber || '', gender: rec.gender || '', 
        dpjpName: rec.dpjpName, raberName: rec.raberName || '', raber2Name: rec.raber2Name || '',
        subjective: rec.subjective || '', objective: rec.objective || '', admissionDate: rec.admissionDate || '',
        analysis: rec.analysis || '', planning: rec.planning || '', isDischarged: false, evidenceImages: rec.evidenceImages || [],
        bpjsClass: rec.bpjsClass || ''
    });
    setCurrentRecordId(rec.id);
    setIsEditing(true);
    setShowRaber1(!!rec.raberName);
    setShowRaber2(!!rec.raber2Name);
    
    setHistoryLogs([]); 
    if (db && userId) {
       try {
           const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${rec.id}/notes`);
           const q = query(notesRef, orderBy('createdAt', 'desc'));
           const snapshot = await getDocs(q);
           const logs = snapshot.docs.map(doc => ({
               ...doc.data(),
               updatedAt: doc.data().createdAt?.seconds ? new Date(doc.data().createdAt.seconds * 1000) : new Date()
           }));
           if (logs.length > 0) setHistoryLogs(logs);
           else setHistoryLogs([rec]);
       } catch (e) { console.error("Gagal tarik history:", e); }
    }
    setShowInputModal(true); 
  };

  const handleDischarge = (id, name, room) => {
    setRecordForDischarge({ id, name, room });
};

// --- FUNGSI KLIK LAPOR SHIFT ---
    const handleLaporShift = () => {
        try {
            const waLink = generateShiftReport(activeRecords, records, waitingList, dpjpProfiles, currentWardConfig.name, currentWardConfig.roomList); 
            window.open(`https://wa.me/?text=${waLink}`, '_blank'); 
        } catch (err) {
            alert("Gagal memproses laporan: " + err.message);
            console.error(err);
        }
        setShowLaporModal(false);
    };

    const handleLaporCS = () => {
        // ✨ FIX MULTI-BANGSAL: Cari kasur kosong berdasarkan bangsal aktif
        const occupiedRooms = activeRecords.map(r => r.roomNumber);
        const emptyBeds = currentWardConfig.roomList.filter(room => !occupiedRooms.includes(room));
        
        // Ekstrak angka kamar, buang duplikat, lalu URUTKAN dari terkecil ke terbesar
        const emptyRoomNumbers = [...new Set(emptyBeds.map(room => {
            const match = room.match(/\d+/); // Ambil angkanya saja
            return match ? match[0] : '';
        }))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));

        if (emptyRoomNumbers.length === 0) {
            alert("Semua kamar terisi, tidak ada kamar yang kosong untuk dibersihkan.");
            return;
        }

        // Teks laporan otomatis menyesuaikan nama bangsal aktif
        const teksCS = `Assalamualaikum a. Mohon bantuannya untuk merapikan/membersihkan Kamar yang sudah kosong di *Ruang ${currentWardConfig.name}*:\n\n*Kamar:* ${emptyRoomNumbers.map(n => 'K.' + n).join(', ')}\n\nTerima kasih Banyak.`;
        
        const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(teksCS)}`;
        window.open(waLink, '_blank');
    };

const processDischarge = async (type) => {
    if (!recordForDischarge) return;
    const { id, name, room } = recordForDischarge;
    setLoading(true);
    try {
        const ref = getCollectionRef();
        await updateDoc(doc(ref, id), { 
            isDischarged: true, 
            lastRoom: room || '', 
            roomNumber: '', 
            dischargeDate: new Date().toISOString(), 
            dischargeType: type, // <-- INI KUNCINYA
            updatedAt: Timestamp.now() 
        });
    } catch (e) { console.error(e); } finally { setLoading(false); setRecordForDischarge(null); }
};  
  
  const normalizePhone = (num) => {
      if (!num) return '';
      const digits = String(num).replace(/\D/g, '');
      if (digits.startsWith('0')) return '62' + digits.substring(1);
      if (digits.startsWith('8')) return '62' + digits;
      return digits;
  };


  const handleReportDpjpCount = (drName, count) => {
      const profile = dpjpProfiles.find(p => p.name === drName);
      const phone = normalizePhone(profile?.waNumber);
      if (!phone) return alert(`Nomor WA ${drName} belum disetting.`);
      const salam = getDoctorGreeting(drName);
      const text = `${salam} dokter, izin melaporkan jumlah pasien dokter di Ruang ${currentWardConfig.name} ada ${count} pasien ya. terimakasih`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReportRaber = (drName, patientNames) => {
      const profile = dpjpProfiles.find(p => p.name === drName);
      const phone = normalizePhone(profile?.waNumber);
      if (!phone) return alert(`Nomor WA ${drName} belum disetting.`);
      const salam = getDoctorGreeting(drName);
      const text = `${salam} dokter, izin mengingatkan ada pasien Raber ya di Ruang ${currentWardConfig.name} a.n ${patientNames.join(', ')}. terimakasih`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- FUNGSI PENGGABUNG GAMBAR (ANTI-RIBET) ---
  const combineImages = async (imageSources) => {
      if (!imageSources || imageSources.length === 0) return null;
      if (imageSources.length === 1) return imageSources[0];

      return new Promise((resolve) => {
          const images = imageSources.map(src => {
              const img = new Image();
              img.src = src;
              return img;
          });

          // Tunggu semua gambar termuat
          Promise.all(images.map(img => new Promise(res => img.onload = res))).then(() => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              // Atur lebar mengikuti gambar terlebar, tinggi dijumlahkan semua
              const maxWidth = Math.max(...images.map(img => img.width));
              const totalHeight = images.reduce((sum, img) => sum + img.height + 10, 0); // +10 untuk spasi antar gambar

              canvas.width = maxWidth;
              canvas.height = totalHeight;
              
              // Beri background putih agar rapi
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              let currentY = 0;
              images.forEach(img => {
                  ctx.drawImage(img, (maxWidth - img.width) / 2, currentY); // Draw di tengah
                  currentY += img.height + 10;
              });

              resolve(canvas.toDataURL('image/jpeg', 0.8));
          });
      });
  };

  const handleLapor = async (rec, type) => {
      let targetNumber = '';
      if (type === 'DPJP') {
          const profile = dpjpProfiles.find(p => p.name === rec.dpjpName);
          targetNumber = normalizePhone(profile?.waNumber);
          if (!targetNumber) return alert(`Nomor WA ${rec.dpjpName} belum disetting.`);
      } 
      
      const { labs, rads, tms, others } = parsePlanning(rec.planning);
      const planningText = [...others.filter(Boolean), labs.length > 0 ? `Lab: ${labs.join(', ')}` : null, rads.length > 0 ? `Rad: ${rads.join(', ')}` : null, tms.length > 0 ? `Tndkn: ${tms.join(', ')}` : null].filter(Boolean).join('\n');
      const dpjpInfo = type === 'Forward' ? `\nDPJP: ${rec.dpjpName || '-'}` : '';
      const text = `Dokter dari Ruang ${currentWardConfig.name} Izin Lapor Pasien \n*a.n ${rec.name}* ${dpjpInfo}\n\n*S:*\n${rec.subjective || '-'}\n\n*O:*\n${rec.objective || '-'}\n\n*A:*\n${rec.analysis || '-'}\n\n*P:*\n${planningText || '-'}\n\nMohon advis,\nTerimakasih`;

      try {
          // 1. Salin Teks Laporan
          await navigator.clipboard.writeText(text);
          
          // 2. Proses Gambar Lampiran
          if (rec.evidenceImages && rec.evidenceImages.length > 0) {
              // GABUNGKAN SEMUA GAMBAR JADI SATU!
              const combinedImg = await combineImages(rec.evidenceImages);
              
              const imgWindow = window.open("", "_blank", "width=600,height=800");
              imgWindow.document.write(`
                  <html><head><title>Lampiran Gabungan - ${rec.name}</title></head>
                  <body style="margin:0; background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
                      <p style="font-size:12px;">📸 <b>1 Gambar Gabungan</b> (${rec.evidenceImages.length} Lampiran)</p>
                      <img src="${combinedImg}" style="max-width:95%; border:2px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
                      <p style="font-size:11px; margin-top:15px; color:#aaa;">Tahan gambar lalu pilih <b>"Copy Image"</b> atau <b>"Share"</b> ke WA</p>
                      <button onclick="window.close()" style="margin-top:10px; padding:8px 20px; border-radius:5px; background:#444; color:#fff; border:none;">Tutup</button>
                  </body></html>
              `);
              alert("LAPORAN DISALIN!\n\nSemua lampiran rontgen sudah DIGABUNG menjadi 1 gambar. Silakan copas gambar tersebut ke WA.");
          }
      } catch (err) { console.error(err); }

      const url = targetNumber ? `https://wa.me/${targetNumber}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      setRecordForLapor(null); 
  };

  const handleBulkDischarge = async (ids) => {
    setLoading(true);
    try {
        const ref = getCollectionRef();
        const updatePromises = ids.map(id => {
            // FIX: Ganti 'patients' menjadi 'activeRecords' agar data kamar terbaca
            const p = activeRecords.find(item => item.id === id); 
            return updateDoc(doc(ref, id), { 
                isDischarged: true, 
                lastRoom: p?.roomNumber || '', 
                roomNumber: '', 
                dischargeDate: new Date().toISOString(), 
                updatedAt: Timestamp.now() 
            });
        });
        await Promise.all(updatePromises);
        alert(`${ids.length} pasien berhasil dipulangkan.`); // Tambah notifikasi biar mantap
    } catch (e) { 
        console.error(e); 
        alert("Gagal memulangkan pasien masal.");
    } finally { 
        setLoading(false); 
    }
};

  // --- FUNGSI RESTORE (BATAL PULANG) ---
  const handleRestorePatient = async (id, name) => {
      if (window.confirm(`Kembalikan data ${name} ke Daftar Rawat Inap?\n(Status akan dikembalikan ke "Dirawat", pastikan kamu mengatur ulang kamarnya).`)) {
          try {
              const ref = getCollectionRef();
              await updateDoc(doc(ref, id), { 
                  isDischarged: false, // Balikkan status jadi dirawat
                  updatedAt: Timestamp.now() 
              });
              alert(`Sukses! Data ${name} dikembalikan.`);
              setView('patient-list'); // Arahkan kembali ke daftar pasien
          } catch (e) {
              alert("Gagal mengembalikan pasien.");
              console.error(e);
          }
      }
  };

  // --- FUNGSI HAPUS PERMANEN DARI ARSIP ---
  const handleDeletePermanent = async (id, name) => {
      if (!window.confirm(`PERINGATAN: Hapus permanen data ${name}?\nData ini akan hilang selamanya dari database.`)) return;
      
      setLoading(true);
      try {
          const ref = getCollectionRef();
          await deleteDoc(doc(ref, id));
          alert(`Data ${name} telah dihapus permanen.`);
      } catch (e) {
          alert("Gagal menghapus data.");
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handlePrintTTV = () => {
    const element = document.getElementById('ttv-table-area');
    if (!element) return alert("Tabel tidak ditemukan.");
    const content = element.innerHTML;
    
    const html = `
        <!DOCTYPE html>
        <html><head><title>Print TTV Berwarna</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { 
                font-family: Arial, sans-serif; 
                zoom: 0.85; 
                margin: 0; padding: 0; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            
            /* FIX GARIS: Gunakan border-collapse dan satuan pt agar tidak hilang saat zoom out */
            table { 
                width: 100%; 
                border-collapse: collapse !important; 
                font-size: 8.5pt; 
                table-layout: fixed; 
                border: 0.75pt solid black !important;
            }
            
            th, td { 
                border: 0.5pt solid black !important; /* Garis tipis tapi konsisten */
                padding: 3px 4px !important; 
                vertical-align: top; 
                background-color: white !important;
            }
            
            th { 
                font-weight: bold; 
                text-transform: uppercase;
                text-align: center;
                font-size: 8pt;
            }

            /* FIX WARNA HARI RAWAT: Paksa jadi hitam (Kolom ke-5) */
            td:nth-child(5) { 
                color: black !important; 
                font-weight: bold; 
                text-align: center;
            }
            
            /* Penyesuaian Lebar Kolom */
            td:nth-child(1) { width: 130px; } 
            td:nth-child(2) { width: 60px; text-align: center; font-family: monospace; } 
            td:nth-child(3) { width: 35px; text-align: center; } 
            td:nth-child(4) { width: 100px; text-align: center; font-family: monospace; } 
            td:nth-child(5) { width: 60px; } 
            td:nth-child(6), td:nth-child(7), td:nth-child(8), td:nth-child(9), td:nth-child(10) { width: 42px; text-align: center; } 
            td:nth-child(11) { width: 110px; } 
            
            .no-print { display: none !important; } 
            input { display: none !important; } 
            span.hidden { display: inline !important; }
            h3 { text-align: center; margin: 0 0 10px 0; font-size: 14pt; font-weight: bold; color: black; } 
            .date-print { text-align: center; font-size: 8pt; margin-bottom: 10px; color: #555; }
        </style></head><body>
        <h3>Lembar Observasi Tanda Vital & Rencana Harian</h3>
        <div class="date-print">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
        ${content}
        </body></html>
    `;
    cetakPWA(html, 'Print TTV');
  };
  
  const handlePrintSOAP = () => {
    const element = document.getElementById('ttv-table-area');
    if (!element) return alert("Tabel tidak ditemukan.");
    const content = element.innerHTML;
    
    const html = `
        <!DOCTYPE html>
        <html><head><title>Print Laporan SOAP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        
        <style>
            /* Margin kertas diperkecil maksimal (1 Lembar Portrait) */
            @page { size: A4 portrait; margin: 5mm; }
            
            body { 
                font-family: Arial, sans-serif; 
                zoom: 0.65; /* Skala dikecilkan drastis agar muat 1 lembar */
                margin: 0; 
                padding: 0; 
                /* 2. WAJIB AGAR BACKGROUND & WARNA TERCETAK OLEH PRINTER */
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            
            /* Font dasar diturunkan ke 7pt */
            table { 
                width: 100%; 
                border-collapse: collapse !important; 
                font-size: 7pt; 
                table-layout: fixed; 
            }
            
            /* Padding dikurangi, line-height dirapatkan */
            th, td { 
                border: 1px solid black !important; 
                padding: 3px !important; 
                vertical-align: top; 
                line-height: 1.15; 
            }
            
            th { 
                background-color: #e5e7eb !important; 
                text-align: center; 
                font-size: 8pt !important; 
                font-weight: bold !important; 
            }
            
            /* Lebar Kolom Proporsional di Portrait */
            th:nth-child(1), td:nth-child(1) { width: 18%; } /* Identitas */
            th:nth-child(2), td:nth-child(2) { width: 15%; } /* S */
            th:nth-child(3), td:nth-child(3) { width: 30%; } /* O */
            th:nth-child(4), td:nth-child(4) { width: 12%; } /* A */
            th:nth-child(5), td:nth-child(5) { width: 25%; } /* P */
            th:nth-child(6), td:nth-child(6) { display: none !important; } /* Sembunyikan Aksi */
            
            .no-print { display: none !important; } 
            input { display: none !important; } 
            span.hidden { display: inline !important; }
            
            td { white-space: pre-wrap; word-wrap: break-word; }
            
            h3 { text-align: center; margin: 5px 0 2px 0; font-size: 14pt; text-transform: uppercase; color: #1e3a8a; } 
            .date-print { text-align: center; font-size: 8pt; margin-bottom: 10px; color: #555; }
        </style></head><body>
        <h3>Laporan Operan SOAP - Ruang ${currentWardConfig.name}</h3>
        <div class="date-print">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
        ${content}
        </body></html>
    `;
    
    cetakPWA(html, 'Print SOAP');
  };

  const handlePrintCPO = (record) => {
    if (!record) return;
    const rawRoom = record.roomNumber || '';
    const cleanRoom = rawRoom ? rawRoom.replace(/[AB]$/, '') : '';
    const extractMeds = (text) => {
        if (!text) return [];
        const meds = [];
        text.split('\n').forEach(line => {
            let cleanLine = line.trim().replace(/^[-•*]\s*/, '');
            const lower = cleanLine.toLowerCase();
            if (!cleanLine || cleanLine.length < 3 || cleanLine.includes('--') || lower.includes('rencana:') || lower.startsWith('lab') || lower.startsWith('rad') || lower.startsWith('cek') || lower.startsWith('kontrol') || lower.startsWith('tindakan') || lower.startsWith('tm.')) return;
            const bracketMatch = cleanLine.match(/^(.*?)\s*\(([^)]+)\)$/);
            if (bracketMatch) { meds.push({ nama: bracketMatch[1].trim(), dosis: bracketMatch[2].trim() }); return; }
            const dosageRegex = new RegExp("(\\d+\\s*[xX]\\s*[\\d\\.,]+.*|\\d+\\s*(?:mg|gr|mcg|iu|tpm|cc|ml|L|tetes|ampul|vial|kolf|flash|sachet|tab|cap).*|\\b(?:asnet|k\\/p|prn|stop|aff|drip|bolus)\\b.*|(?:\\/|per)\\s*\\d+\\s*(?:jam|j|menit|m|hari).*)", "i");
            const manualMatch = cleanLine.match(dosageRegex);
            if (manualMatch && manualMatch.index > 2) { meds.push({ nama: cleanLine.substring(0, manualMatch.index).trim(), dosis: cleanLine.substring(manualMatch.index).trim() }); return; }
            if (['inj', 'tab', 'cap', 'infus', 'drip', 'bolus', 'supp', 'nebu', 'obat', 'syr', 'puyer'].some(k => lower.includes(k))) { meds.push({ nama: cleanLine, dosis: '' }); }
        });
        return meds;
    };
    const fullMedList = extractMeds(record.planning);
    const MAX_ROWS = 7; 
    const pages = [];
    for (let i = 0; i < fullMedList.length; i += MAX_ROWS) { pages.push(fullMedList.slice(i, i + MAX_ROWS)); }
    const htmlContent = `
        <html><head><title>Print CPO</title><style>
            @page { size: 330mm 215mm; margin: 0; }
            body { margin: 0; padding: 0; font-family: 'Courier New', monospace; font-size: 10pt; font-weight: bold; }
            .page-container { position: relative; width: 330mm; height: 215mm; overflow: hidden; page-break-after: always; }
            .page-container:last-child { page-break-after: auto; }
            .scan-background { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; opacity: 0.4; }
            @media print { .scan-background { display: none; } }
            .header-ruangan { position: absolute; top: 47mm; left: 13mm; width: 35mm; text-align: center; font-size: 9pt; }
            .header-dpjp { position: absolute; top: 50mm; left: 50mm; width: 100mm; }
            .patient-box { position: absolute; top: 14mm; right: 15mm; width: 90mm; font-size: 10pt; padding-left: 70mm; margin-top: 2mm; }
            .med-row { position: absolute; left: 51mm; width: 150mm; min-height: 8mm; display: flex; align-items: flex-start; padding-top: 1mm; }
            .col-nama { width: 38mm; white-space: normal; word-wrap: break-word; line-height: 1.1; font-size: 9pt; }
            .col-dosis { position: absolute; left: 40mm; width: 35mm; padding-left: 2mm; padding-top: 0.5mm; }
        </style></head><body>
            ${pages.map((pageMeds, pageIndex) => `
                <div class="page-container">
                    <img src="/cpo-overlay.png" class="scan-background" alt="Mal CPO">
                    <div class="header-ruangan"><div>${currentWardConfig.name.toUpperCase()}</div><div style="font-size: 12pt; margin-top: 2mm;">${cleanRoom}</div></div>
                    <div class="header-dpjp">${record.dpjpName || '-'}</div>
                    <div class="patient-box">${record.name.substring(0,25)}</div>
                    ${pageMeds.map((obat, idx) => {                        
                        const startY = 78; const rowHeight = 18; const currentTop = startY + (idx * rowHeight);
                        let displayDosis = obat.dosis ? obat.dosis.replace(/\s+(iv|im|sc|po|oral|tab|cap|supp|drip|bolus|k\/p)\b/gi, '<br>$1') : '';
                        return `<div class="med-row" style="top: ${currentTop}mm;"><div class="col-nama">${obat.nama}</div><div class="col-dosis">${displayDosis}</div></div>`;
                    }).join('')}
                    ${pages.length > 1 ? `<div style="position:absolute; bottom:5mm; right:5mm; font-size:8pt;">Hal ${pageIndex + 1}/${pages.length}</div>` : ''}
                </div>`).join('')}
        </body></html>`;
        
    cetakPWA(htmlContent, 'Print CPO'); // <--- INI YANG BERUBAH
  };
  
  const handlePrintBukuCM = () => {
    const content = document.getElementById('buku-cm-print');
    if (!content) return alert("Konten tidak ditemukan.");
    
    const html = `
        <html><head><title>Cetak Buku Register (CM)</title>
        <style>
            @page { size: A4 portrait; margin: 5mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; zoom: 0.9; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 4px; font-size: 8.5pt; text-align: center; overflow: hidden; }
            th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; font-size: 7.5pt; }
            .text-left { text-align: left !important; padding-left: 5px; }
            
            /* Penyesuaian Lebar Kolom (Total 650px agar pas di A4) */
            th:nth-child(1), td:nth-child(1) { width: 30px; }   /* No */
            th:nth-child(2), td:nth-child(2) { width: 160px; }  /* Nama Pasien */
            th:nth-child(3), td:nth-child(3) { width: 40px; }   /* KMR */
            th:nth-child(4), td:nth-child(4) { width: 75px; }   /* No. RM */
            th:nth-child(5), td:nth-child(5) { width: 110px; }  /* Dokter */
            th:nth-child(6), td:nth-child(6) { width: 35px; }   /* Kls */
            th:nth-child(7), td:nth-child(7) { width: 125px; }  /* Tgl Masuk */
            th:nth-child(8), td:nth-child(8) { width: 75px; }   /* Hr (Lama Rawat) */
            
            input { display: none !important; } 
            span.print-text { display: inline !important; } 
            .no-print { display: none !important; }
            h3 { text-align: center; margin-bottom: 10px; font-size: 14pt; color: #065f46; }
        </style></head><body>
        <h3>BUKU REGISTER RUANGAN (CM) - ${currentWardConfig.name}</h3>
        ${content.innerHTML}
        </body></html>
    `;
    cetakPWA(html, 'Cetak Buku Register (CM)');
};

  const handlePrintLabel = (record) => {
    if (!record) return;
    const html = `
        <html><head><title>Label Pasien - ${record.name}</title>
        <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; gap: 4mm; padding: 5mm; }
            .label-box { width: 64mm; height: 32mm; border: 1px dashed #ccc; padding: 5mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; position: relative; }
            .name { font-size: 10pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
            .rm { font-size: 18pt; font-family: 'Courier New', monospace; font-weight: bold; border-top: 2px solid black; padding-top: 2mm; }
            .room { position: absolute; bottom: 2mm; right: 3mm; font-size: 9pt; font-weight: bold; color: #666; }
            @media print { .label-box { border: 1px solid #eee; } .no-print { display: none; } }
        </style></head><body>
            ${Array(12).fill(0).map(() => `
                <div class="label-box">
                    <div class="name">${record.name}</div>
                    <div class="rm">RM: ${record.rmNumber || '-'}</div>
                    <div class="room">${record.roomNumber || ''}</div>
                </div>
            `).join('')}
        </body></html>
    `;
    cetakPWA(html, `Label Pasien - ${record.name}`); // <--- INI YANG BERUBAH
  };  

  const handleExportExcel = () => {
      if (!records || records.length === 0) return alert("Tidak ada data.");
      const exported = records.filter(r => !r.isDischarged);
      const headers = ["No", "Tanggal", "Jam", "Nama", "Kamar", "DPJP", "Raber 1", "Raber 2", "Status", "S", "O", "A", "Planning Lain", "LAB", "RADIOLOGI", "TINDAKAN"];
      const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      const rows = exported.map((r, index) => {
          const parsedP = parsePlanning(r.planning);
          return [
              index + 1, r.createdAt.toLocaleDateString('id-ID'), r.createdAt.toLocaleTimeString('id-ID'),
              escape(r.name), escape(r.roomNumber), escape(r.dpjpName), escape(r.raberName), escape(r.raber2Name),
              r.isDischarged ? "Pulang" : "Dirawat", escape(r.subjective), escape(r.objective), escape(r.analysis),
              escape(parsedP.others.join('; ')), escape(parsedP.labs.join(', ')), escape(parsedP.rads.join(', ')), escape(parsedP.tms.join(', '))
          ].join(",");
      });
      const csv = [headers.join(","), ...rows].join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      link.download = `Pasien_Melati_${new Date().toLocaleDateString('id-ID')}.csv`;
      link.click();
  };

  // --- STATS CALCULATION (VERSI MULTI-BANGSAL DINAMIS) ---
  const stats = useMemo(() => {
      const currentWard = currentUser?.ward || 'MELATI';
      const currentWardConfig = WARD_CONFIG[currentWard] || WARD_CONFIG['MELATI'];
      
      // Saring data mentah database agar hanya menghitung bangsal yang sedang aktif dibuka
      const wardRecords = records.filter(r => (r.ward || 'MELATI') === currentWard);
      const wardActiveRecords = activeRecords.filter(r => (r.ward || 'MELATI') === currentWard);

      const s = { 
          total: wardRecords.length, 
          active: wardActiveRecords.length, 
          discharged: wardRecords.filter(r => r.isDischarged).length, 
          monthly: {}, 
          dpjpCounts: {}, 
          raberData: {}, 
          emptyCount: 0, 
          emptyMale: 0, 
          emptyFemale: 0 
      };
      
      const occupied = wardActiveRecords.map(r => r.roomNumber);
      
      // Hitung bed kosong berdasarkan kapasitas kamar bangsal aktif
      currentWardConfig.roomList.forEach(room => {
          if (!occupied.includes(room)) {
              const match = room.match(/^(K\d+)([AB])$/);
              if (!match) {
                  s.emptyCount++;
              } else {
                  const roomCode = match[1];
                  const bedCode = match[2];
                  const neighborBed = bedCode === 'A' ? 'B' : 'A';
                  const neighborRoom = `${roomCode}${neighborBed}`;
                  const neighborRec = wardActiveRecords.find(r => r.roomNumber === neighborRoom);

                  if (!neighborRec) {
                      s.emptyCount++;
                  } else if (neighborRec.gender === 'L') {
                      s.emptyMale++;
                  } else {
                      s.emptyFemale++;
                  }
              }
          }
      });      

      // Kalkulasi rekap grafik bulanan khusus bangsal aktif
      wardRecords.forEach(r => {
          const m = r.createdAt.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
          if (!s.monthly[m]) s.monthly[m] = { active: 0, discharged: 0, pulang: 0, pindah: 0, meninggal: 0, lab: 0, rad: 0, tm: 0 };

          if (r.isDischarged) {
              s.monthly[m].discharged++;
              if (r.dischargeType === 'pindah') s.monthly[m].pindah++;
              else if (r.dischargeType === 'meninggal') s.monthly[m].meninggal++;
              else s.monthly[m].pulang++;
          } else {
              s.monthly[m].active++;
          }

          if (r.planning) {
             const lines = r.planning.split('\n');
             lines.forEach(l => {
                 const t = l.trim().toLowerCase();
                 if (t.startsWith('lab.')) s.monthly[m].lab++; 
                 else if (t.startsWith('rad.')) s.monthly[m].rad++; 
                 else if (t.startsWith('tm.')) s.monthly[m].tm++;
             });
          }
      });

      // Hitung jumlah beban pasien per dokter spesialis di bangsal aktif
      wardActiveRecords.forEach(rec => {
          s.dpjpCounts[rec.dpjpName] = (s.dpjpCounts[rec.dpjpName] || 0) + 1;
          [rec.raberName, rec.raber2Name].forEach(dr => { 
              if(dr) { 
                  if(!s.raberData[dr]) s.raberData[dr]=[]; 
                  s.raberData[dr].push(rec.name); 
              } 
          });
      });
      return s;
  }, [records, activeRecords, currentUser]);

  // --- RENDER DASHBOARD ---
  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">
        
        {/* KOLOM KIRI (DENAH KAMAR & FILTER) */}
        <div className="lg:col-span-6 flex flex-col h-[calc(100vh-120px)]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                <div className="flex flex-col gap-2 px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                    
                    {/* HEADER JUDUL & FILTER (SUDAH DIPERBAIKI UNTUK HP) */}
                    <div className="flex justify-between items-center flex-wrap gap-y-2">
                        
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🗺️</span>
                            <div>
                                <h3 className="text-xs font-bold text-indigo-900 uppercase">Kamar</h3>
                                <p className="text-[9px] text-gray-500">
                                    {dpjpFilter.length > 0 || selectedRoomFilter.length !== ROOM_LIST.length || searchTerm ? 'Filter Aktif' : 'Semua'}
                                </p>
                            </div>
                        </div>

                        {/* BARIS FILTER (Sekarang pakai flex-row agar berjejer 1 baris) */}
                        <div className="flex flex-row gap-1.5 items-center w-full md:w-auto flex-1 md:ml-2">
                            
                            {/* Filter Kamar */}
                            <div className="w-[85px] md:w-40 relative z-[55]">
                                <RoomFilterDropdown allRooms={currentWardConfig.roomList} selectedRooms={selectedRoomFilter} onChange={setSelectedRoomFilter} />
                            </div>
                            
                            {/* Filter DPJP Multi-Select */}
                            <div className="w-[100px] md:w-48 relative z-[50]">
                                <DpjpFilterDropdown allOptions={dpjpOptions} selectedOptions={dpjpFilter} onChange={setDpjpFilter} />
                            </div>
                            
                            {/* Search Bar (Nama / RM) */}
                            <div className="relative flex-1">
                                <span className="absolute left-2.5 top-2 text-gray-400 text-[10px]">🔍</span>
                                <input 
                                    type="text" 
                                    placeholder="Cari Nama/RM..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                    className="w-full pl-8 pr-6 py-1.5 border border-indigo-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-500 h-[32px] outline-none" 
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={() => setSearchTerm('')} 
                                        className="absolute right-2 top-2 text-gray-400 hover:text-red-500 font-bold text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>                    
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                    <RoomMap 
                        roomList={currentWardConfig.roomList} 
                        leftRooms={currentWardConfig.leftRooms} 
                        rightRooms={currentWardConfig.rightRooms} 
                        activeRecords={filteredActiveRecords} 
                        onSelectRoom={handleSelectRoom} 
                        onEditRoom={handleEditRoom} 
                        roomFilter={selectedRoomFilter} 
                        waitingList={waitingList} 
                    />
                </div>
            </div>
        </div>
        <div className="lg:col-span-6 h-[calc(100vh-140px)] overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden">
                <div className="bg-indigo-600 px-3 py-2 text-white flex justify-between items-center">
                    <div className="flex items-center space-x-2"><span className="text-xs font-bold uppercase tracking-tight">📋 Waiting List</span><span className="bg-indigo-500 px-2 py-0.5 rounded-full text-[10px] font-mono">{waitingList.length}</span></div>
                    <button onClick={() => setShowWaitingModal(true)} className="bg-white text-indigo-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-50 flex items-center"><span className="mr-1 text-sm">+</span> Tambah</button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                    {waitingList.length === 0 ? <div className="p-6 text-center text-gray-400 italic text-xs">Belum ada antrean.</div> : (
                        <table className="w-full text-[10px] text-left">
                            <thead className="bg-gray-50 sticky top-0 border-b z-10"><tr><th className="p-2 text-center w-8">No</th><th className="p-2">Target</th><th className="p-2">Pasien</th><th className="p-2">Asal</th><th className="p-2 text-center">Aksi</th></tr></thead>
                            <tbody>{waitingList.map((w, idx) => (
                                <tr key={w.id} className="border-b hover:bg-indigo-50 group"><td className="p-2 text-center font-bold text-gray-400">{idx+1}</td><td className="p-2 font-bold text-indigo-700">{w.plannedRoom}</td><td className="p-2"><div className="font-bold">{w.name}</div><div className="text-[9px] text-gray-400 truncate">{w.diagnosis}</div></td><td className="p-2"><div className="font-bold">{w.originRoom}</div>{w.insuranceClass && <div className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded w-fit">{w.insuranceClass}</div>}</td><td className="p-2 text-center"><button onClick={() => handleMoveToRoom(w)} className="bg-green-600 text-white px-2 py-1 rounded font-bold text-[9px]">Masuk</button><button onClick={() => handleDeleteWaiting(w.id)} className="ml-2 text-red-400 opacity-0 group-hover:opacity-100">🗑️</button></td></tr>
                            ))}</tbody>
                        </table>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-100 border border-green-300 text-green-900 rounded p-2 text-center"><span className="text-[9px] font-bold">KOSONG</span><div className="text-xl font-extrabold">{stats.emptyCount}</div></div>
                <div className="bg-sky-100 border border-sky-300 text-sky-900 rounded p-2 text-center"><span className="text-[9px] font-bold">SISA LK</span><div className="text-xl font-extrabold">{stats.emptyMale}</div></div>
                <div className="bg-purple-100 border border-purple-300 text-purple-900 rounded p-2 text-center"><span className="text-[9px] font-bold">SISA PR</span><div className="text-xl font-extrabold">{stats.emptyFemale}</div></div>
            </div>
            <div className="bg-white rounded p-3 border"><h3 className="font-bold text-gray-700 border-b pb-2 mb-3 text-xs uppercase">Pasien per DPJP</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{Object.entries(stats.dpjpCounts).sort((a,b)=>b[1]-a[1]).map(([n,c])=>(<div key={n} className="flex justify-between items-center text-[10px] p-2 bg-gray-50 rounded border hover:bg-indigo-50 group"><span className="truncate font-medium">{n}</span><div className="flex items-center gap-1"><span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{c}</span><button onClick={()=>handleReportDpjpCount(n,c)} className="text-[9px] bg-green-100 text-green-700 p-1 rounded-full opacity-80 group-hover:opacity-100">📱</button></div></div>))}</div>
            </div>
            <div className="bg-white rounded p-3 border"><h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-xs uppercase flex justify-between"><span>🤝 Raber/Konsul</span><span className="bg-yellow-100 px-2 rounded-full">{Object.keys(stats.raberData).length} Dr</span></h3>
                <div className="space-y-2">{Object.entries(stats.raberData).length===0?<div className="text-[10px] text-gray-400 text-center">Nihil.</div>:Object.entries(stats.raberData).map(([d,p])=>(<div key={d} className="text-[10px] bg-yellow-50 p-2 rounded border flex justify-between group"><div className="flex-1"><div className="font-bold text-indigo-800">{d}</div><div className="text-gray-600">({p.join(', ')})</div></div><button onClick={()=>handleReportRaber(d,p)} className="ml-2 bg-green-100 text-green-700 px-2 py-1 rounded opacity-80 group-hover:opacity-100">📱</button></div>))}</div>
            </div>
            <div className="bg-white rounded overflow-hidden border">
             <div className="bg-gray-800 px-3 py-2 text-white text-xs font-bold uppercase">📊 Rekap</div>
             <table className="w-full text-[10px] text-left">
                 <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                     <tr>
                         <th className="p-2">Bulan</th>
                         <th className="p-2 text-center">Aktif</th>
                         <th className="p-2 text-center" title="Pulang Biasa">Plg</th>
                         <th className="p-2 text-center text-indigo-600" title="Pindah Ruangan">Pdh</th>
                         <th className="p-2 text-center text-slate-800" title="Meninggal">Mng</th>
                         <th className="p-2 text-center text-red-600">Lab</th>
                         <th className="p-2 text-center text-blue-600">Rad</th>
                         <th className="p-2 text-center text-green-600">TM</th>
                     </tr>
                 </thead>
                 <tbody>
                     {Object.entries(stats.monthly).map(([m,d])=>(
                         <tr key={m} className="border-b hover:bg-gray-50">
                             <td className="p-2 font-bold text-indigo-900">{m}</td>
                             <td className="p-2 text-center">{d.active}</td>
                             <td className="p-2 text-center font-bold">{d.pulang}</td>
                             <td className="p-2 text-center font-bold text-indigo-600">{d.pindah}</td>
                             <td className="p-2 text-center font-bold text-slate-800">{d.meninggal}</td>
                             <td className="p-2 text-center font-bold text-red-600">{d.lab}</td>
                             <td className="p-2 text-center font-bold text-blue-600">{d.rad}</td>
                             <td className="p-2 text-center font-bold text-green-600">{d.tm}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
         </div>
            <div className="h-10"></div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
        
        {/* HEADER V5 (MENU UNIVERSAL) */}
        <div className="bg-white shadow-sm px-4 h-14 sticky top-0 z-[80] border-b flex justify-between items-center max-w-7xl mx-auto">
            
            {/* 1. KIRI: LOGO (flex-none supaya ukuran paten) */}
            <div onClick={() => setView('dashboard')} className="flex items-center cursor-pointer hover:opacity-80 transition-opacity select-none py-1 flex-none">
                <img src="/logo3.png" alt="SIMPAN Header" className="h-28 object-contain" />
            </div>
            
            {/* 2. TENGAH: PESAN WELCOME (1 Baris Lurus & Presisi di Tengah) */}
            <div className="flex-1 flex justify-center px-4">
                <div className="hidden md:flex bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm">
                    <span className="text-[11px] font-bold text-indigo-900 whitespace-nowrap">
                        Halo {currentUser?.name} 👋, Selamat datang di Ruang {currentWardConfig.name} Aplikasi SIMPAN
                    </span>
                </div>
            </div>
            
            {/* 3. KANAN: SEKERANJANG TOMBOL AKSI & MENU DROPDOWN */}
            <div className="flex items-center gap-2 flex-none">
                
                <button 
                    onClick={() => setShowLaporModal(true)} 
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-indigo-200 transition shadow-sm"
                >
                    <span className="mr-1">📢</span> Lapor
                </button>
                
                <div className={`hidden sm:block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 shadow-green-400' : 'bg-red-500'} ring-2 ring-white`} title={isOnline ? "Online" : "Offline"}></div>
                
                {/* --- MENU NAVIGASI UNIVERSAL --- */}
                <div className="relative group ml-2">
                    <button className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm hover:bg-gray-50 transition">
                        <span>☰</span> MENU ▾
                    </button>
                    
                    <div className="absolute top-full right-0 pt-2 w-48 z-[90] hidden group-hover:block animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1">
                            
                            {/* ✨ SEKSI TENTANG APLIKASI & LINK TRAKTEER NYELIP DI SINI ✨ */}
                            <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-gray-100 mb-1 bg-indigo-50/40">
                                <p className="font-bold text-indigo-900">SIMPAN </p>
                                <p className="text-[9px]">Nursing System Handover </p>
                                <a 
                                    href="https://trakteer.id/481nugroho" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="block mt-1.5 text-[10px] text-indigo-600 font-extrabold hover:underline"
                                >
                                    ☕ Traktir Kopi?
                                </a>
                            </div>

                            <div className="px-4 py-1 border-b border-gray-50 mb-1">
                                <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded w-fit block uppercase">
                                    👤 {currentUser ? currentUser.name : 'Guest'}
                                </span>
                            </div>
                            
                            <button onClick={() => setView('dashboard')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">🏠 Dashboard</button>
                            <button onClick={() => setView('patient-list')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">📋 Daftar Pasien</button>
                            <button onClick={() => setView('archived-list')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">🗃️ Gudang Arsip Pasien</button>
                            <button onClick={() => setView('settings')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">⚙️ Setelan</button>
                            
                            {/* MENU KEUANGAN (HANYA MUNCUL JIKA USER ADALAH PJ) */}
                            {cashflowRole && (
                                <>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button onClick={() => setAppMode('KEUANGAN')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-teal-50 text-teal-700 font-bold">
                                        <Wallet size={14} className="mr-2"/> Panel Keuangan
                                    </button>
                                </>
                            )}

                            {/* ✨ TAHAP 4: MENU SUPERADMIN (HANYA MUNCUL UNTUK DEVELOPER) */}
                            {(currentUser?.role === 'SUPERADMIN' || currentUser?.name?.toLowerCase().includes('abi')) && (
                                <>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <div className="px-3 py-1 bg-purple-50">
                                        <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">👑 God Mode (Admin)</span>
                                    </div>
                                    
                                    <button 
                                        onClick={() => onSwitchWard('MELATI')} 
                                        className={`w-full text-left px-4 py-2 text-xs flex items-center font-bold transition-colors ${currentWardConfig.name === 'Melati' ? 'bg-purple-100 text-purple-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        🏥 Pantau Melati
                                    </button>
                                    
                                    <button 
                                        onClick={() => onSwitchWard('DAHLIA')} 
                                        className={`w-full text-left px-4 py-2 text-xs flex items-center font-bold transition-colors ${currentWardConfig.name === 'Dahlia' ? 'bg-purple-100 text-purple-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        🏥 Pantau Dahlia
                                    </button>
                                </>
                            )}

                            <div className="border-t border-gray-100 my-1"></div>
                            
                            <button onClick={onLogout} className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold flex items-center">🚪 Keluar</button>
                        </div>
                    </div>
                </div>

                <button onClick={() => setShowInputModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow-md text-xs font-bold transition flex items-center gap-1 ml-1">
                    <span>+</span> Baru
                </button>
            </div>
        </div>

        <div className="relative flex flex-row max-w-7xl mx-auto lg:h-[calc(100vh-64px)] overflow-hidden">
            <div className={`fixed top-16 right-0 bottom-0 w-full md:w-[400px] z-[60] bg-white transition-transform duration-300 ease-in-out shadow-2xl border-l ${showWaitingModal ? 'translate-x-0' : 'translate-x-full'}`}>
                <WaitingListInputPanel show={showWaitingModal} onClose={() => setShowWaitingModal(false)} onAdd={handleAddWaiting} availableRooms={ROOM_LIST} occupiedRooms={occupiedRooms} waitingList={waitingList} onUpdateRoom={updateWaitingListRoom} activeRecords={activeRecords}/>
            </div>
            <div className="w-full h-full flex flex-col overflow-hidden">
                <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                    {view === 'dashboard' && renderDashboard()}
                    {view === 'patient-list' && (
                    <div className="h-full flex flex-col bg-gray-50">
                        <div className="p-3 bg-white border-b shadow-sm sticky top-0 z-40 flex-shrink-0 space-y-2">
                            
                            {/* Ditambahkan flex-wrap agar kalau layarnya sempit (HP), elemennya turun ke bawah dengan rapi */}
                            <div className="flex justify-between items-center flex-wrap gap-y-2">
                                
                                {/* 1. Judul & Jumlah Pasien */}
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-lg text-indigo-800">📂 Daftar Pasien</h2>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{filteredActiveRecords.length} Pasien</span>
                                </div>

                                {/* 2. BAGIAN FILTER (Sudah dimodifikasi agar selalu 1 baris di HP) */}
                                <div className="flex flex-row gap-1.5 items-center w-full md:w-auto flex-1 md:mx-2">
                                    <div className="w-[85px] md:w-40 relative z-50">
                                        <RoomFilterDropdown allRooms={currentWardConfig.roomList} selectedRooms={selectedRoomFilter} onChange={setSelectedRoomFilter} />
                                    </div>
                                    <div className="w-[100px] md:w-48 relative z-50">
                                        <DpjpFilterDropdown allOptions={dpjpOptions} selectedOptions={dpjpFilter} onChange={setDpjpFilter} />
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                                        <input type="text" placeholder="Cari..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-6 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 h-[32px] outline-none" />
                                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-red-500 font-bold text-xs">✕</button>}
                                    </div>
                                </div>

                                {/* 3. Tombol Aksi Kanan */}
                                <div className="flex space-x-1">
                                    <button onClick={handleExportExcel} className="text-[10px] px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-600 hover:text-white transition shadow-sm">Excel</button>
                                    <button onClick={() => setShowBulkPrint(true)} className="text-[10px] px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition shadow-sm">🖨️ Cetak OA Banyakan</button>
                                </div>
                                
                            </div>                               
                        </div>
                        
                        <div className="flex-1 overflow-hidden relative z-0">
                            <PatientTable roomList={currentWardConfig.roomList} records={filteredActiveRecords} onEdit={handleEdit} onPrint={(r) => setSelectedRecordForPrint(r)} onShowLaporModal={setRecordForLapor} onDischarge={handleDischarge} onBulkPrint={() => setShowBulkPrint(true)} roomSortOrder={selectedRoomFilter} onPrintTTV={handlePrintTTV} onPrintSOAP={handlePrintSOAP} onQuickTtv={(rec) => { setQuickTtvTarget(rec); setShowTtvModal(true); }} onBulkDischarge={handleBulkDischarge} updateRecord={updateRecord} onPrintBukuCM={handlePrintBukuCM} onPrintLabel={handlePrintLabel} />
                        </div>
                    </div>
                )}

                    {/* --- VIEW 4: ARSIP PASIEN (KOMPONEN BARU) --- */}
                    {view === 'archived-list' && (
                        <div className="h-full overflow-hidden bg-slate-50">
                            <GudangArsip dataPasien={archivedRecords} loading={loading} db={db} onRestore={handleRestorePatient} />                            
                        </div>
                    )}
                    
                    {/* --- VIEW 3: SETELAN (LEVEL 4 - UPDATE) --- */}
                    {view === 'settings' && (
                        <div className="bg-white p-6 rounded shadow h-full overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-bold text-xl text-indigo-900 border-b pb-2 flex items-center gap-2">⚙️ Pusat Pengaturan</h2>
                                {/* Status Indikator */}
                                <div className="flex items-center gap-2">
                                    {settingsError && (
                                        <div className="text-[10px] px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-bold flex items-center gap-1">
                                            ⚠️ Menggunakan data lokal (koneksi bermasalah)
                                        </div>
                                    )}
                                    {!isSettingsLoaded && (
                                        <div className="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 font-bold flex items-center gap-1">
                                            ⏳ Memuat data...
                                        </div>
                                    )}
                                    {isSettingsLoaded && !settingsError && (
                                        <div className="text-[10px] px-2 py-1 rounded bg-green-100 text-green-700 font-bold flex items-center gap-1">
                                            ✓ Data sinkron dengan Firebase
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* 1. PROFIL SAYA */}
                                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">👤 Profil Saya <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">{currentUser.role}</span></h3>
                                    <div className="space-y-3">
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username (ID)</label><input type="text" value={currentUser.id} disabled className="w-full p-2 bg-slate-200 text-slate-500 border rounded text-sm font-mono cursor-not-allowed" /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Tampilan</label><input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500" /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label><input type="text" value={profileForm.pass} onChange={e => setProfileForm({...profileForm, pass: e.target.value})} className="w-full p-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500" /></div>
                                        <button onClick={handleUpdateSelf} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition shadow-sm mt-2">Simpan Perubahan Profil</button>
                                    </div>
                                </div>
                                {/* 2. ADMIN PANEL */}
                                {currentUser.role === 'admin' && (
                                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                                    <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">🛡️ Admin: Manajemen User</h3>
                                    
                                    {/* --- FORM INPUT USER (SEKARANG SUDAH 3 KOLOM) --- */}
                                    <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm mb-4">
                                        <h4 className="text-xs font-bold text-indigo-800 mb-2 uppercase">Tambah / Reset User</h4>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input type="text" placeholder="ID (Username)" value={adminUserForm.id} onChange={e => setAdminUserForm({...adminUserForm, id: e.target.value})} className="p-2 border rounded text-xs" />
                                            <input type="text" placeholder="Nama Lengkap" value={adminUserForm.name} onChange={e => setAdminUserForm({...adminUserForm, name: e.target.value})} className="p-2 border rounded text-xs" />
                                        </div>
                                        
                                        {/* Diubah menjadi grid-cols-3 untuk menampung Pilihan Ruangan */}
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <input type="text" placeholder="Password" value={adminUserForm.pass} onChange={e => setAdminUserForm({...adminUserForm, pass: e.target.value})} className="p-2 border rounded text-xs font-mono" />
                                            
                                            <select value={adminUserForm.role} onChange={e => setAdminUserForm({...adminUserForm, role: e.target.value})} className="p-2 border rounded text-xs bg-white outline-none">
                                                <option value="member">Member</option>
                                                <option value="admin">Admin</option>
                                                <option value="finance_jm">Keuangan (JM)</option>
                                                <option value="finance_kas">Keuangan (KAS)</option>
                                                <option value="finance_doc">Keuangan (Dokter)</option>
                                            </select>

                                            {/* Dropdown Master Mutasi Ruangan Staf */}
                                            <select value={adminUserForm.ward || 'MELATI'} onChange={e => setAdminUserForm({...adminUserForm, ward: e.target.value})} className="p-2 border rounded text-xs bg-white font-bold text-indigo-700 outline-none border-indigo-200">
                                                <option value="MELATI">🏥 Ruang Melati</option>
                                                <option value="DAHLIA">🏥 Ruang Dahlia</option>
                                            </select>
                                        </div>
                                        
                                        <button onClick={handleAdminSaveUser} className="w-full bg-indigo-600 text-white py-1.5 rounded text-xs font-bold hover:bg-indigo-700">Simpan / Update User</button>
                                    </div>

                                    {/* --- TABEL DAFTAR USER (SUDAH DITAMBAH KOLOM RUANGAN) --- */}
                                    <div className="overflow-hidden rounded border border-indigo-200">
                                        <table className="w-full text-left text-xs bg-white">
                                            <thead className="bg-indigo-100 text-indigo-800">
                                                <tr>
                                                    <th className="p-2">ID</th>
                                                    <th className="p-2">Nama</th>
                                                    <th className="p-2">Role</th>
                                                    <th className="p-2">Ruangan</th> {/* Header Baru */}
                                                    <th className="p-2">Pass</th>
                                                    <th className="p-2 text-center">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-indigo-50">
                                                {allUsers.map(u => (
                                                    <tr key={u.id} className="hover:bg-indigo-50">
                                                        <td className="p-2 font-mono text-slate-500">{u.id}</td>
                                                        <td className="p-2 font-bold">{u.name}</td>
                                                        <td className="p-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='member'?'bg-slate-100 text-slate-600':'bg-green-100 text-green-700'}`}>{u.role}</span>
                                                        </td>
                                                        
                                                        {/* Cell Data Indikator Ruangan Bangsal */}
                                                        <td className="p-2 font-extrabold text-indigo-600 text-[10px] tracking-wide">
                                                            📂 {u.ward || 'MELATI'}
                                                        </td>

                                                        <td className="p-2 font-mono text-slate-500">{u.pass}</td>
                                                        <td className="p-2 text-center flex justify-center gap-1">
                                                            {/* Otomatis mengisi data form + default ward saat tombol pensil/edit diklik */}
                                                            <button onClick={()=>setAdminUserForm({ ward: 'MELATI', ...u })} className="bg-yellow-100 text-yellow-700 p-1 rounded">✏️</button>
                                                            {u.id !== currentUser.id && (
                                                                <button onClick={()=>handleAdminDeleteUser(u.id)} className="bg-red-100 text-red-700 p-1 rounded">🗑️</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            </div>
                            <div className="mt-8 pt-6 border-t border-slate-200">
                                <h3 className="font-bold text-gray-700 mb-2">Daftar DPJP & Nomor WA (Master Data)</h3>
                                <div className="flex space-x-2 mb-3"><input type="text" placeholder="Nama Dokter" value={newDpjpName} onChange={(e) => setNewDpjpName(e.target.value)} className="border p-2 rounded text-xs w-1/2 focus:ring-2 focus:ring-indigo-500 outline-none" /><input type="text" placeholder="Nomor WA (08xxx)" value={newDpjpWa} onChange={(e) => setNewDpjpWa(e.target.value)} className="border p-2 rounded text-xs w-1/3 focus:ring-2 focus:ring-indigo-500 outline-none" /><button onClick={handleAddDpjp} disabled={!isSettingsLoaded} className="bg-green-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-green-700 transition disabled:bg-gray-400">+ Tambah</button></div>
                                <div className="border rounded overflow-hidden bg-white shadow-sm max-h-64 overflow-y-auto"><table className="w-full text-left border-collapse"><thead><tr className="bg-gray-100 text-xs text-gray-600 border-b"><th className="p-2 border-r font-bold uppercase">Nama Dokter</th><th className="p-2 border-r font-bold uppercase">No. WA</th><th className="p-2 text-center font-bold uppercase">Aksi</th></tr></thead><tbody>{dpjpProfiles && dpjpProfiles.map((p, idx) => (<tr key={idx} className="border-b text-xs hover:bg-indigo-50 transition"><td className="p-2 border-r font-medium text-gray-800">{p.name}</td><td className="p-2 border-r text-gray-500 font-mono">{p.waNumber}</td><td className="p-2 text-center"><button onClick={() => handleRemoveDpjp(p.name)} disabled={!isSettingsLoaded} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-red-200 rounded hover:bg-red-50 transition text-[10px]">🗑️ Hapus</button></td></tr>))}</tbody></table></div>

                                {/* MASTER DATA: Lab / Radiologi / Tindakan / Terapi */}
                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-3 rounded border">
                                        <h4 className="text-sm font-bold mb-2">Master Lab</h4>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" placeholder="Tambah Lab" value={newMasterLab} onChange={e => setNewMasterLab(e.target.value)} className="flex-1 p-2 border rounded text-xs" />
                                            <button onClick={() => handleAddMaster('lab')} disabled={!isSettingsLoaded} className="bg-green-600 text-white px-3 rounded text-xs font-bold">Tambah</button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto text-xs">
                                            {masterLabs.length === 0 ? <div className="text-gray-400 italic">(Kosong)</div> : masterLabs.map((i, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-1 border-b">
                                                    <div className="truncate">{i}</div>
                                                    <button onClick={() => handleRemoveMaster('lab', i)} className="text-red-500 text-[11px] px-2 rounded">Hapus</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded border">
                                        <h4 className="text-sm font-bold mb-2">Master Radiologi</h4>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" placeholder="Tambah Radiologi" value={newMasterRad} onChange={e => setNewMasterRad(e.target.value)} className="flex-1 p-2 border rounded text-xs" />
                                            <button onClick={() => handleAddMaster('rad')} disabled={!isSettingsLoaded} className="bg-green-600 text-white px-3 rounded text-xs font-bold">Tambah</button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto text-xs">
                                            {masterRads.length === 0 ? <div className="text-gray-400 italic">(Kosong)</div> : masterRads.map((i, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-1 border-b">
                                                    <div className="truncate">{i}</div>
                                                    <button onClick={() => handleRemoveMaster('rad', i)} className="text-red-500 text-[11px] px-2 rounded">Hapus</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded border">
                                        <h4 className="text-sm font-bold mb-2">Master Tindakan / Prosedur</h4>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" placeholder="Tambah Tindakan" value={newMasterProcedure} onChange={e => setNewMasterProcedure(e.target.value)} className="flex-1 p-2 border rounded text-xs" />
                                            <button onClick={() => handleAddMaster('procedure')} disabled={!isSettingsLoaded} className="bg-green-600 text-white px-3 rounded text-xs font-bold">Tambah</button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto text-xs">
                                            {masterProcedures.length === 0 ? <div className="text-gray-400 italic">(Kosong)</div> : masterProcedures.map((i, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-1 border-b">
                                                    <div className="truncate">{i}</div>
                                                    <button onClick={() => handleRemoveMaster('procedure', i)} className="text-red-500 text-[11px] px-2 rounded">Hapus</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-3 rounded border">
                                        <h4 className="text-sm font-bold mb-2">Master Terapi / Obat</h4>
                                        <div className="flex gap-2 mb-2">
                                            <input type="text" placeholder="Tambah Terapi / Obat" value={newMasterMedication} onChange={e => setNewMasterMedication(e.target.value)} className="flex-1 p-2 border rounded text-xs" />
                                            <button onClick={() => handleAddMaster('medication')} disabled={!isSettingsLoaded} className="bg-green-600 text-white px-3 rounded text-xs font-bold">Tambah</button>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto text-xs">
                                            {masterMedications.length === 0 ? <div className="text-gray-400 italic">(Kosong)</div> : masterMedications.map((i, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-1 border-b">
                                                    <div className="truncate">{i}</div>
                                                    <button onClick={() => handleRemoveMaster('medication', i)} className="text-red-500 text-[11px] px-2 rounded">Hapus</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showInputModal && <div className="fixed top-16 right-0 bottom-0 w-full md:w-[500px] z-[60] bg-white shadow-2xl border-l transition-all duration-300 flex flex-col">
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
                    availableRooms={currentWardConfig.roomList.filter(r => !occupiedRooms.includes(r) || (isEditing && r === formData.roomNumber)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))} 
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
                    isFormReady={formData.name && formData.roomNumber && formData.dpjpName} loading={loading} 
                    ALL_PLANNING_OPTIONS={combinedPlanningOptions} 
                    onPrintCPO={() => handlePrintCPO({ ...formData, id: currentRecordId })}
                    onPrintLabel={handlePrintLabel} 
                    masterLabs={masterLabs} masterRads={masterRads} 
                    masterProcedures={masterProcedures} 
                    masterMedications={masterMedications} 
                    archivedRecords={archivedRecords} /></div>}
        </div>
        {recordForLapor && <LaporConfirmationModal patientName={recordForLapor.name} dpjpNumber={dpjpProfiles.find(p => p.name === recordForLapor.dpjpName)?.waNumber} onLaporDpjp={() => handleLapor(recordForLapor, 'DPJP')} onLaporJaga={() => handleLapor(recordForLapor, 'Forward')} onCancel={() => setRecordForLapor(null)} />}
        {selectedRecordForPrint && <PrintView record={selectedRecordForPrint} closePrint={() => setSelectedRecordForPrint(null)} />}
        {showBulkPrint && <BulkPrintView records={filteredActiveRecords} onClose={() => setShowBulkPrint(false)} />}
        {showTtvModal && <TtvModal onClose={() => { setShowTtvModal(false); setQuickTtvTarget(null); }} onSave={(text) => { if (quickTtvTarget) { handleSaveQuickTtv(text); } else { appendText('objective', text); setShowTtvModal(false); } }} />}
        {confirmDetails.isOpen && <ConfirmationModal title={confirmDetails.title} message={confirmDetails.message} onConfirm={confirmDetails.action} onCancel={closeConfirm} />}
        {recordForDischarge && <DischargeModal patientName={recordForDischarge.name} onCancel={() => setRecordForDischarge(null)} onPindah={() => processDischarge('pindah')} onPulang={() => processDischarge('pulang')} onMeninggal={() => processDischarge('meninggal')} />}
        {showLaporModal && <LaporModal onCancel={() => setShowLaporModal(false)}onLaporShift={handleLaporShift} onLaporCS={handleLaporCS}/>}
    
    {/* --- JAM MELAYANG TRANSPARAN (GLASSMORPHISM) DI KANAN BAWAH --- */}
        <div className="fixed bottom-4 right-4 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg z-[50] select-none opacity-50">
            <DigitalClock />
        </div>
    </div>
  );
};

// --- PANEL INPUT WAITING LIST (FINAL: EDIT KAMAR + WARNA GENDER PINTAR) ---
const WaitingListInputPanel = ({ show, onClose, onAdd, availableRooms, waitingList = [], onUpdateRoom, activeRecords = [] }) => {
    
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
        onClose(); 
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

    // LOGIKA PINTAR UNTUK DOT WARNA DROPDOWN (GABUNGAN BARU)
    const getRoomOptionStatus = (roomName) => {
        const SINGLE_BED_ROOMS = ['K7A', 'K8A', 'K9A', 'K11A', 'K12A', 'K14A'];
        
        // 1. Terisi?
        const patient = activeRecords.find(r => r.roomNumber === roomName);
        if (patient) return { dot: '🔴', label: 'Terisi', colorClass: 'text-red-600 font-bold' };

        // 2. Antre?
        const booking = waitingList?.find(w => w.plannedRoom === roomName);
        if (booking) return { dot: '🟡', label: 'Antre', colorClass: 'text-yellow-700 font-bold' };

        // 3. Single Bed Kosong?
        if (SINGLE_BED_ROOMS.includes(roomName)) return { dot: '🟢', label: 'Kosong', colorClass: 'text-green-700 font-bold' };

        // 4. Double Bed (Cek Tetangga Lk/Pr)
        const match = roomName.match(/^(K\d+)([AB])$/);
        if (match) {
            const roomCode = match[1];
            const neighborBed = match[2] === 'A' ? 'B' : 'A';
            const neighborRoomName = `${roomCode}${neighborBed}`;
            
            const neighbor = activeRecords.find(r => r.roomNumber === neighborRoomName);
            if (neighbor) {
                if (neighbor.gender === 'L') return { dot: '🔵', label: 'Sisa Lk', colorClass: 'text-sky-600 font-bold' };
                if (neighbor.gender === 'P') return { dot: '🟣', label: 'Sisa Pr', colorClass: 'text-purple-600 font-bold' };
            }
        }
        
        // 5. Kosong Total
        return { dot: '🟢', label: 'Kosong', colorClass: 'text-green-700 font-bold' };
    };

    return (
        <div className="flex flex-col h-full bg-white shadow-2xl border-r border-indigo-200 relative">
            
            {/* 1. HEADER (TOMBOL SIMPAN DI ATAS - KODINGAN ASLIMU) */}
            <div className="p-3 bg-indigo-700 text-white flex justify-between items-center shadow-md z-10">
                <div className="flex flex-col">
                    <h3 className="font-bold text-sm flex items-center gap-1">📝 Input Antrean</h3>
                    <p className="text-[10px] opacity-80">Isi data pasien inden</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSubmit} className="px-3 py-1.5 text-[10px] bg-white text-indigo-700 font-bold rounded shadow hover:bg-indigo-50 transition flex items-center gap-1">
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
                        <select 
                            className="w-full p-2 text-xs border border-gray-300 rounded bg-white outline-none font-bold focus:ring-2 focus:ring-indigo-500" 
                            value={form.plannedRoom} 
                            onChange={e => setForm({...form, plannedRoom: e.target.value})}
                        >
                            <option value="">- Pilih Kamar -</option>
                            {[...availableRooms]
                                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                                .map(r => {
                                    const status = getRoomOptionStatus(r);
                                    return (
                                        <option key={r} value={r} className={status.colorClass}>
                                            {status.dot} {r} ({status.label})
                                        </option>
                                    );
                            })}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Pasien</label><input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Nama..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Asal</label><input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500" placeholder="IGD/Poli..." value={form.originRoom} onChange={e => setForm({...form, originRoom: e.target.value})} /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kelas</label>
                            <select className="w-full p-2 text-xs border rounded outline-none bg-white focus:ring-1 focus:ring-indigo-500" value={form.insuranceClass} onChange={e => setForm({...form, insuranceClass: e.target.value})}>
                                <option value="">- Pilih -</option><option value="BPJS Kls 1">BPJS Kls 1</option><option value="BPJS Kls 2">BPJS Kls 2</option><option value="BPJS Kls 3">BPJS Kls 3</option><option value="Umum/Asuransi">Umum/Asuransi</option>
                            </select>
                        </div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">No. HP</label><input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500" placeholder="08xxx..." value={form.waNumber} onChange={e => setForm({...form, waNumber: e.target.value})} /></div>
                    </div>
                    <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Diagnosa</label><textarea rows="2" className="w-full p-2 text-xs border rounded outline-none resize-none focus:ring-1 focus:ring-indigo-500" placeholder="Diagnosa..." value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})}></textarea></div>
                </div>

                {/* B. TABEL ANTREAN (DENGAN FITUR EDIT KAMAR ASLIMU) */}
                <div className="p-2 flex-1">
                    <h3 className="px-2 mb-1 text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Daftar Antrean ({waitingList.length})</h3>
                    {waitingList.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 italic text-xs border-2 border-dashed border-gray-200 rounded mt-2 bg-white">Belum ada pasien antre.</div>
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
                                <tbody className="text-xs divide-y divide-gray-100">
                                    {waitingList.map((item) => (
                                        <tr key={item.id} className="hover:bg-indigo-50/50 group transition-colors">
                                            
                                            {/* KOLOM TARGET (BISA DIEDIT) */}
                                            <td className="p-2 font-bold text-indigo-700 w-[130px] align-top">
                                                {editingId === item.id ? (
                                                    <div className="flex items-center gap-1 animate-in zoom-in-95 duration-100">
                                                        <select 
                                                            className="w-full p-1 text-[10px] border border-indigo-300 rounded bg-white focus:ring-1 focus:ring-indigo-500" 
                                                            value={tempRoom} 
                                                            onChange={e => setTempRoom(e.target.value)}
                                                            autoFocus
                                                        >
                                                            {/* Saya pakaikan logic warna pintar juga di dropdown edit ini! */}
                                                            {[...availableRooms]
                                                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                                                            .map(r => {
                                                                const status = getRoomOptionStatus(r);
                                                                return <option key={r} value={r}>{status.dot} {r}</option>
                                                            })}
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

                                            <td className="p-2 align-top">
                                                <div className="font-bold text-gray-800">{item.name}</div>
                                                <div className="text-[9px] text-gray-500 truncate max-w-[120px] leading-tight">{item.diagnosis || '-'}</div>
                                            </td>
                                            <td className="p-2 text-center text-gray-500 text-[10px] align-top pt-3">
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
const PlanningQuickTag = ({ onSelect }) => {
    const tags = [
        // LAB (Merah)
        { label: 'DR', isi: 'Lab. R/ Darah Rutin (DR)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'GDS', isi: 'Lab. R/ GDS', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'GDP-2JPP', isi: 'Lab. R/ GDP-2JPP', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Ur-Cr', isi: 'Lab. R/ Ureum-Creatinin', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Elektrolit', isi: 'Lab. R/ Elektrolit (Na/K/Cl)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'TCM', isi: 'Lab. R/ TCM TB', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Sputum', isi: 'Lab. R/ Sputum', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Urin', isi: 'Lab. R/ Urin', warna: 'bg-red-100 text-red-700 border-red-200' },
        
        // RAD (Biru)
        { label: 'Whole Abd', isi: 'Rad. R/ USG Whole Abdomen', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'Upper Abd', isi: 'Rad. R/ USG Hepatobilier/Upper Abdomen', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'Lower Abd', isi: 'Rad. R/ USG Lower/Ginjal Abdomen', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        
        // TERAPI (Ungu)
        { label: 'PRC', isi: 'Th. Trnfs  PRC, on ke , post ke , premed: , Postmed: ', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Nicardipin', isi: 'Th. Drip Perdipine/Nicardipine  mcg, Kec.  cc/j, Bb  kg', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Vascon', isi: 'Th. Drip vascon/Norepinephrine mcg, Kec.  cc/j, Bb  kg', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Panto', isi: 'Th. Drip pantoprazole 8 mg/j', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        
        // TAMBAHAN (Hitam)
        { label: 'BLPL', isi: 'Rencana BLPL', warna: 'bg-black text-white border-black' },

        // KONSUL (Amber/Emas)
        { label: 'Konsul', isi: 'Konsul TS ke dr. ', warna: 'bg-amber-100 text-amber-900 border-amber-400' }
    ];

    return (
        <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag, idx) => (
                <button 
                    key={idx} 
                    type="button"
                    onClick={() => onSelect(tag.isi)}
                    // Jika BLPL, gunakan gaya simpel. Jika bukan, gunakan gaya standar tombol.
                    className={tag.label === 'BLPL' 
                        ? `px-2 py-1 rounded text-[11px] font-bold border shadow-sm transition hover:opacity-80 ${tag.warna}` 
                        : `px-2 py-1 border rounded text-[9px] font-bold transition shadow-sm hover:opacity-80 ${tag.warna}`
                    }
                >
                    {tag.label}
                </button>
            ))}
        </div>
    );
};
// --- INPUT SIDE PANEL (VERSI SUPER: SHORTCUTS + SMART LAB V10) ---
const InputSidePanel = ({
    showInputModal, setShowInputModal, handleSubmit, formData, handleInputChange,
    resetForm, isEditing, currentRecordId, availableRooms, dpjpOptions,
    showRaber1, setShowRaber1, showRaber2, setShowRaber2, historyLogs,
    pullDataForField, setShowTtvModal, appendText, handleDischarge, setSelectedRecordForPrint,
    setRecordForLapor, isFormReady, loading, ALL_PLANNING_OPTIONS, handleDeleteRecord, onPrintCPO,
    onPrintLabel, masterLabs = [], masterRads = [], masterProcedures = [], masterMedications = [], archivedRecords = []
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
    const [hideSuggestion, setHideSuggestion] = useState(false);
    useEffect(() => { setHideSuggestion(false); }, [formData?.name]);
    const archivedMatches = useMemo(() => {
    // Pakai pengaman tambahan (?.) untuk menghindari error saat formData belum siap
    const currentName = formData?.name || '';
    const currentRm = formData?.rmNumber || '';
    // Cek apakah ada ketikan di Nama ATAU di RM
    const hasName = currentName.length >= 3;
    const hasRm = currentRm.length >= 2;
    
    if (!hasName && !hasRm) return [];
    
    // 1. FILTER DASAR (Pencarian Nama atau RM dengan Pengaman Anti-Crash)
    let matches = archivedRecords.filter(r => {
        if (!r) return false;
        
        // PENGAMAN: Cek pastikan r.name adalah teks, kalau bukan jadikan kosong ('')
        const safeName = typeof r.name === 'string' ? r.name.toLowerCase() : '';
        const matchName = hasName && safeName.includes(currentName.toLowerCase());
        
        const matchRm = hasRm && r.rmNumber && r.rmNumber.includes(currentRm);
        
        return matchName || matchRm;
    });

    // 2. JURUS UX: Sembunyikan saran JIKA nama di form SUDAH SAMA PERSIS dengan di database
    const isAlreadySelected = matches.some(r => {
        const safeName = typeof r.name === 'string' ? r.name.toLowerCase() : '';
        return safeName === currentName.toLowerCase() && currentName.length > 0;
    });
    if (isAlreadySelected) return [];

    // 3. JURUS PASIEN LAMA (Asep Mumuh): Urutkan dari tanggal rawat paling baru
    matches.sort((a, b) => {
        const dateA = a.admissionDate ? new Date(a.admissionDate) : new Date(0);
        const dateB = b.admissionDate ? new Date(b.admissionDate) : new Date(0);
        return dateB - dateA;
    });

    // 4. BUANG GANDA: Sisakan 1 data terbaru jika ada RM atau Nama yang sama
    const uniqueMatches = matches.filter((item, index, self) =>
        index === self.findIndex((t) => {
            const isSameRM = t.rmNumber && item.rmNumber && t.rmNumber === item.rmNumber;
            const isSameName = typeof t.name === 'string' && typeof item.name === 'string' && t.name.toLowerCase() === item.name.toLowerCase();
            return isSameRM || isSameName;
        })
    );

    return uniqueMatches.slice(0, 5); // Tampilkan max 5 saran

}, [formData?.name, formData?.rmNumber, archivedRecords]);

// 👇 TARUH FUNGSI AUTO-FORMAT TANGGAL DI SINI 👇
    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); // Ambil angka saja
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 8); // YYYY (4 digit)
        if (v.length > 8) final += ', ' + v.substring(8, 10); // Koma dan Jam
        if (v.length > 10) final += ':' + v.substring(10, 12); // Menit
        e.target.value = final;
    };

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
    
    // DATA LACAK LENGKAP (gabung konstanta + master lists)
    const lacakOptions = [
        ...Array.from(new Set([...(LAB_CHECKS || []), ...masterLabs])),
        ...Array.from(new Set([...(RADIOLOGY_CHECKS || []), ...masterRads])),
        ...Array.from(new Set([...(MEDICATIONS || []), ...masterMedications])),
        ...Array.from(new Set([...(PROCEDURES || []), ...masterProcedures])),
    ];

    // --- HELPER: KOMPRESI & MULTI UPLOAD GAMBAR ---
    const handleMultiImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const compressedImages = await Promise.all(files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 800; // Kompres ukuran agar ringan
                        const scaleSize = MAX_WIDTH / img.width;
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/jpeg', 0.6)); // Kualitas 60%
                    }
                };
            });
        }));

        handleInputChange({ 
            target: { 
                name: 'evidenceImages', 
                value: [...(formData.evidenceImages || []), ...compressedImages] 
            } 
        });
    };

    const removeImage = (indexToRemove) => {
        const newImages = formData.evidenceImages.filter((_, idx) => idx !== indexToRemove);
        handleInputChange({ target: { name: 'evidenceImages', value: newImages } });
    };
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
        if (prescriptionList.length > 0) { resultP += `\n\n-- Terapi Obat --\n${prescriptionList.join('\n')}`; }

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
        
        // 1. KAMUS MANUAL (Lengkap & Urutan Diperbaiki)
        const manualDictionary = [
            // --- PRIORITAS TINGGI (YANG NAMANYA PANJANG/MIRIP HB) ---
            // Taruh HBsAg, HbA1c, HBeAg di paling atas biar gak dimakan sama 'Hb'
            { key: 'HBsAg', reg: /HBsAg(?: Rapid)?/i },
            { key: 'Anti-HCV', reg: /(?:Anti-HCV|HCV)/i },
            { key: 'HbA1c', reg: /(?:HbA1c|Haemoglobin A1c)/i },
            { key: 'HIV', reg: /(?:HIV|Anti-HIV)/i },            
            { key: 'Hb', reg: /(?:Hemoglobin|\bHb\b)/i }, // Pakai \bHb\b biar lebih ketat (harus kata utuh)
            { key: 'Eritrosit', reg: /(?:Eritrosit|Eritrosit|RBC)/i },          
            { key: 'Leu', reg: /(?:Leukosit|Leu|WBC)/i },
            { key: 'Trmbsit', reg: /(?:Trombosit|Plt|Platelet|Trmbsit)/i },
            { key: 'Ht', reg: /(?:Hematokrit|Ht|HCT)/i },
            { key: 'Na', reg: /(?:Natrium|\bNa\b|Sodium)/i },
            { key: 'K', reg: /(?:Kalium|\bK\b|Potassium)/i },
            { key: 'Cl', reg: /(?:Clorida|Chloride|\bCl\b|Klorida)/i },
            { key: 'Kalsium', reg: /(?:Kalsium|Calsium|\bCa\b)/i },
            { key: 'GDS', reg: /(?:Gula Darah Sewaktu|GDS|Glukosa Sewaktu|Kadar Gula)/i },
            { key: 'GDP', reg: /(?:Gula Darah Puasa|GDP|Glukosa Puasa)/i },
            { key: '2JPP', reg: /(?:Gula Darah 2 Jam PP|GDP-2JPP|Glukosa 2 Jam PP)/i },
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
            { key: 'Gram', reg: /Gram|Pewarnaan/i }, 
            { key: 'CD4', reg: /CD4/i },
            { key: 'Kultur', reg: /Kultur|Culture/i },
            { key: 'MDT/SaDT', reg: /(?:MDT|SaDT|Morfologi Darah Tepi|Apusan Darah|Gambaran Darah Tepi)/i },
        ];
        
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
            const descriptiveTests = ['Gram', 'Sputum', 'Kultur', 'TCM', 'Ag', 'PCR', 'HBeAg', 'HBsAg', 'HIV', 'LED', 'CRP', 'Procal', 'Ferritin', 'CD4', 'MDT'];
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

        const trends = { 'Hb': [], 'Leu': [], 'Plt': [], 'Ht': [], 'GDS': [], 'GDP': [], '2JPP': [], 'Na': [], 'K': [], 'Cl': [], 'Alb': [], 'Cr': [], 'Ur': [] };
        const patterns = {
            'Hb': /(?:Hb|Hemoglobin)[\s:.-]*(\d+(?:\.\d+)?)/i,
            'Leu': /(?:Leu|Leukosit)[\s:.-]*(\d{1,3}(?:\.?\d{3})*)/i,
            'Plt': /(?:Plt|Trombosit|Trombo)[\s:.-]*(\d{1,3}(?:\.?\d{3})*)/i,
            'Ht': /(?:Ht|Hematokrit)[\s:.-]*(\d+(?:\.\d+)?)/i,
            'GDS': /(?:GDS|Gula Darah)[\s:.-]*(\d{2,3})/i,
            'GDP': /(?:GDP|Glukosa Puasa)[\s:.-]*(\d{2,3})/i,
            '2JPP': /(?:2JPP|Glukosa 2 Jam PP)[\s:.-]*(\d{2,3})/i,
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
        if (action === 'discharge') handleDischarge(currentRecordId, formData.name, formData.roomNumber);
    };

    const handleClearSoap = () => {
        if(window.confirm("Kosongkan semua kolom SOAP & Lampiran untuk operan baru?")) {
            // Langsung set ke state awal sekaligus
            handleInputChange({ target: { name: 'subjective', value: '' } });
            handleInputChange({ target: { name: 'objective', value: '' } });
            handleInputChange({ target: { name: 'analysis', value: '' } });
            handleInputChange({ target: { name: 'planning', value: '' } });
            handleInputChange({ target: { name: 'evidenceImages', value: [] } }); // Pastikan PLURAL 's'
            alert("SOAP & Lampiran dibersihkan.");
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
                {/* BAGIAN Tombol Edit (Hanya Muncul Jika isEditing true) */}
                {isEditing && (
                    <>
                        <button type="button" onClick={() => onPrintLabel(formData)} className="p-1.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] shadow-sm hover:bg-purple-200" title="Cetak Label Spuit (12 Pcs)">🏷️</button>
                        <button type="button" onClick={onPrintCPO} className="p-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] shadow-sm hover:bg-blue-200" title="Cetak CPO (Obat)">💊</button>
                        <button type="button" onClick={() => handleQuickAction('lapor')} className="p-1.5 bg-green-100 text-green-700 border border-green-200 rounded text-[10px] shadow-sm hover:bg-green-200" title="Draft Lapor">📱</button>
                        <button type="button" onClick={() => handleQuickAction('print')} className="p-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] shadow-sm hover:bg-gray-200" title="Print (Ctrl+P)">🖨️</button>
                        <button type="button" onClick={() => handleQuickAction('discharge')} className="p-1.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] shadow-sm hover:bg-red-100" title="Keluar">🚪</button>
                        
                        {handleDeleteRecord && (
                            <button type="button" onClick={() => handleDeleteRecord(currentRecordId, formData.name)} className="p-1.5 bg-red-600 text-white border border-red-700 rounded text-[10px] shadow-sm hover:bg-red-800" title="Hapus Data Permanen">🗑️</button>
                        )}
                        <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>
                    </>
                )}

                {/* Tombol Simpan & Tutup (Muncul Selalu) */}
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
                            
                            {/* --- BARIS 1: RESPONSIVE GRID (HP & LAPTOP AMAN) --- */}
                            <div className="flex space-x-2 mb-2 items-start">                                
                                {/* KOLOM 1: GENDER */}
                                <div className="w-[15%] relative">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Gender *</label>
                                    <select 
                                        className="w-full p-2 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 bg-white h-[34px]" 
                                        value={formData.gender} 
                                        onChange={(e) => handleInputChange({ target: { name: 'gender', value: e.target.value } })} 
                                        required
                                    >
                                        <option value="" disabled>-</option>
                                        <option value="L">Lk</option>
                                        <option value="P">Pr</option>
                                    </select>
                                </div>

                                {/* KOLOM 2: NO. RM */}
                                <div className="w-[25%] relative">
                                    <CustomInput 
                                        label="No. RM" 
                                        name="rmNumber" 
                                        value={formData.rmNumber || ''} 
                                        onChange={handleInputChange} 
                                        placeholder="123456" 
                                    />
                                </div>

                                {/* KOLOM 3: KELAS (BARU) */}
                                <div className="w-[20%] relative">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Kls</label>
                                    <select 
                                        className="w-full p-2 text-[11px] border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 bg-white h-[34px]" 
                                        value={formData.bpjsClass || ''} 
                                        onChange={(e) => handleInputChange({ target: { name: 'bpjsClass', value: e.target.value } })} 
                                    >
                                        <option value="">-</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="Umum">Umum</option>
                                    </select>
                                </div>

                                {/* KOLOM 4: TGL MASUK (FIXED: LANGSUNG MASUK MEMORI) */}
                                <div className="w-[40%] relative">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Tgl Masuk</label>
                                    <input 
                                        type="text" 
                                        // Controlled value: Jika berisi format database (-) ubah ke tampilan biasa, jika sedang diketik biarkan apa adanya
                                        value={formData.admissionDate ? (formData.admissionDate.includes('-') ? formatDateCM(formData.admissionDate) : formData.admissionDate) : ''}
                                        onChange={(e) => {
                                            handleDateMasking(e); // Jalankan auto-format garis miring
                                            handleInputChange({ target: { name: 'admissionDate', value: e.target.value } }); // Langsung rekam ke memori
                                        }}
                                        className="w-full p-2 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono bg-white outline-none h-[34px]" 
                                        placeholder="dd/mm/yyyy, hh:mm" 
                                    />
                                </div>
                            </div>

                            {/* --- BARIS 2: NAMA PASIEN | DPJP UTAMA --- */}
                            <div className="flex space-x-2 mb-2 items-start">
                                {/* KOLOM 1: KM */}
                                <div className="w-[20%] relative">
                                    <CustomSelect 
                                        label="Km" 
                                        value={formData.roomNumber} 
                                        onChange={(e) => handleInputChange({ target: { name: 'roomNumber', value: e.target.value } })} 
                                        options={availableRooms} 
                                    />
                                </div>
                                <div className="w-[40%] relative">
                                    <CustomInput 
                                        label="Nama Pasien *" 
                                        name="name" 
                                        value={formData.name} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                    
                                    {/* SUGGESTION LIST PASIEN LAMA */}
                                    {archivedMatches && archivedMatches.length > 0 && formData.name.length > 0 && !archivedMatches.some(old => old.name === formData.name) && !hideSuggestion && (
                                        <div className="absolute z-50 w-full bg-white border-2 border-indigo-500 shadow-2xl rounded-md mt-[-8px] max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                                            
                                            {/* HEADER DITAMBAH STICKY & TOMBOL ABAIKAN */}
                                            <div className="bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white flex justify-between items-center sticky top-0 z-10">
                                                <span>📂 PASIEN LAMA TERDETEKSI</span>
                                                <div className="flex gap-1 items-center">
                                                    <span className="bg-white text-indigo-600 px-1 rounded text-[8px] h-fit flex items-center">ARSIP</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setHideSuggestion(true); 
                                                        }}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm text-[8px] transition cursor-pointer"
                                                    >
                                                        ✕ Abaikan
                                                    </button>
                                                </div>
                                            </div>

                                            {archivedMatches.map(old => (
                                                <div 
                                                    key={old.id} 
                                                    onClick={() => {
                                                        handleInputChange({ target: { name: 'name', value: old.name } });
                                                        handleInputChange({ target: { name: 'rmNumber', value: old.rmNumber || '' } });
                                                        handleInputChange({ target: { name: 'gender', value: old.gender || '' } });
                                                        alert(`Biodata ${old.name} ditarik. Silakan tentukan DPJP hari ini.`);
                                                    }}
                                                    className="p-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors"
                                                >
                                                    <div className="text-[10px] font-bold text-indigo-900 uppercase">{old.name}</div>
                                                    <div className="text-[9px] text-gray-500 font-mono">
                                                    RM: {old.rmNumber || '-'} | {old.gender === 'L' ? 'Lk' : 'Pr'} | Terakhir: {new Date(old.admissionDate).toLocaleDateString('id-ID')}
                                                </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-[40%]">
                                    <CustomSelect 
                                        label="DPJP Utama *" 
                                        value={formData.dpjpName} 
                                        onChange={(e) => handleInputChange({ target: { name: 'dpjpName', value: e.target.value } })} 
                                        options={sortedDpjpOptions} 
                                        required
                                    />
                                </div>
                            </div>

                            {/* --- BARIS 3 (BARU): RABER 1 & RABER 2 (BERJEJER KE SAMPING) --- */}
                            <div className="flex space-x-2 mt-1 min-h-[40px]">
                                {/* KOLOM KIRI (DI BAWAH NAMA PASIEN) */}
                                <div className="w-1/2">
                                    {showRaber1 ? (
                                        <div className="relative">
                                            <CustomSelect 
                                                label="Raber 1" 
                                                value={formData.raberName} 
                                                onChange={(e) => handleInputChange({ target: { name: 'raberName', value: e.target.value } })} 
                                                options={dpjpOptions} 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => { setShowRaber1(false); handleInputChange({ target: { name: 'raberName', value: '' } }); }} 
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition"
                                            >✕</button>
                                        </div>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={() => setShowRaber1(true)} 
                                            className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2"
                                        >+ Tambah Raber 1</button>
                                    )}
                                </div>

                                {/* KOLOM KANAN (DI BAWAH DPJP UTAMA) */}
                                <div className="w-1/2">
                                    {showRaber1 && (
                                        showRaber2 ? (
                                            <div className="relative">
                                                <CustomSelect 
                                                    label="Raber 2" 
                                                    value={formData.raber2Name} 
                                                    onChange={(e) => handleInputChange({ target: { name: 'raber2Name', value: e.target.value } })} 
                                                    options={dpjpOptions} 
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setShowRaber2(false); handleInputChange({ target: { name: 'raber2Name', value: '' } }); }} 
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition"
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={() => setShowRaber2(true)} 
                                                className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2"
                                            >+ Tambah Raber 2</button>
                                        )
                                    )}
                                </div>
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
                            {/* --- TAMBAHAN BARU: MUNCUL DI BAWAH KOLOM OBJEKTIF --- */}
                            {formData.evidenceImages && formData.evidenceImages.length > 0 && (
                                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">🖼️ Lampiran Tersimpan:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.evidenceImages.map((img, idx) => (
                                            <img key={idx} src={img} className="w-10 h-10 object-cover rounded border shadow-sm cursor-pointer hover:scale-150 transition-transform origin-bottom-left" alt="Lampiran" title="Arahkan kursor untuk memperbesar" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CustomTextArea>

                        <CustomTextArea label="A (Analisa)" name="analysis" value={formData.analysis} onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('analysis') : null} pullLabel="Salin A Lalu" />
                        
                        <CustomTextArea 
                        label="P (Planning)" name="planning" value={formData.planning} onChange={handleInputChange}
                        // PROPS HARUS DI SINI (DI DALAM TAG PEMBUKA)
                        onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('planning') : null} 
                        pullLabel="Tarik P"
                    >
                        {/* ISINYA (CHILDREN) TETAP DI SINI */}
                        <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded relative z-0">
                            <PlanningQuickTag onSelect={(text) => appendText('planning', text)} />

                            <TagSelector 
                                label="Smart Planning" 
                                placeholder="Ketik Lab, Rad, Obat..." 
                                options={ALL_PLANNING_OPTIONS.map(o => o.label)} 
                                category="SmartPlan"
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
                                                    ? new Date(log.updatedAt.seconds * 1000).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
                                                    : log.updatedAt instanceof Date 
                                                        ? log.updatedAt.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
                                                        : 'Baru saja'}
                                            </span>
                                            {/* --- LIVE BADGE SIGNATURE (NAMA AKUN) --- */}
                                            {log.savedBy && (
                                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tight">
                                                    👤 {log.savedBy.split(' ')[0]}
                                                </span>
                                            )}
                                            {/* ---------------------------------------- */}
                                        </div>
                                        <button type="button" onClick={() => setRecordForLapor(log)} className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded text-[9px] font-bold hover:bg-green-200 flex items-center transition">📱 WA</button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">S:</span> <span className="text-gray-700">{log.subjective || '-'}</span></div>
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">O:</span> <span className="text-gray-700">{log.objective || '-'}</span></div>
                                        {/* --- TAMBAHAN: TAMPILKAN GAMBAR DI RIWAYAT --- */}
                                        {log.evidenceImages && log.evidenceImages.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {log.evidenceImages.map((img, iIndex) => (
                                                    <img 
                                                        key={iIndex} 
                                                        src={img} 
                                                        className="w-12 h-12 object-cover rounded border border-gray-300 shadow-sm cursor-zoom-in hover:scale-110 transition-transform" 
                                                        alt="Lampiran Riwayat"
                                                        onClick={() => window.open(img, '_blank')} // Klik untuk lihat full-size
                                                        title="Klik untuk memperbesar"
                                                    />
                                                ))}
                                            </div>
                                        )}
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
                        {/* LAMPIRAN FOTO (RONTGEN/LAB) MULTIPLE */}
                        <div className="mt-3 p-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
                            {/* HEADER LABEL & TOMBOL TARIK */}
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                                    📸 Lampiran Foto (Maks 3)
                                </label>
                                
                                {/* TOMBOL TARIK: Hanya muncul jika sedang mode Edit */}
                                {isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={() => pullDataForField('evidenceImages')}
                                        className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 font-bold transition shadow-sm"
                                    >
                                        ↺ Tarik Gambar Lama
                                    </button>
                                )}
                            </div>

                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                capture="environment" 
                                onChange={handleMultiImageUpload}
                                className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2"
                            />
                            
                            {/* TAMPILAN GALLERY THUMBNAIL */}
                            {formData.evidenceImages && formData.evidenceImages.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {formData.evidenceImages.map((imgBase64, idx) => (
                                        <div key={idx} className="relative w-14 h-14">
                                            <img src={imgBase64} className="w-full h-full object-cover rounded border border-slate-300 shadow-sm" alt="Preview" />
                                            <button 
                                                type="button" 
                                                onClick={() => removeImage(idx)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center hover:bg-red-600 shadow-sm"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                        {/* LAMPIRAN FOTO (RONTGEN/LAB) MULTIPLE */}
                        <div className="mt-3 p-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
                            {/* HEADER LABEL & TOMBOL TARIK */}
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                                    📸 Lampiran Foto (Maks 3)
                                </label>
                                
                                {/* TOMBOL TARIK: Hanya muncul jika sedang mode Edit */}
                                {isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={() => pullDataForField('evidenceImages')}
                                        className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 font-bold transition shadow-sm"
                                    >
                                        ↺ Tarik Gambar Lama
                                    </button>
                                )}
                            </div>

                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple 
                                capture="environment" 
                                onChange={handleMultiImageUpload}
                                className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2"
                            />
                            
                            {/* TAMPILAN GALLERY THUMBNAIL */}
                            {formData.evidenceImages && formData.evidenceImages.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {formData.evidenceImages.map((imgBase64, idx) => (
                                        <div key={idx} className="relative w-14 h-14">
                                            <img src={imgBase64} className="w-full h-full object-cover rounded border border-slate-300 shadow-sm" alt="Preview" />
                                            <button 
                                                type="button" 
                                                onClick={() => removeImage(idx)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center hover:bg-red-600 shadow-sm"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const App = () => {
  // 1. State System (VERSI BERSIH & MENGUNCI MEMORI)
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(() => localStorage.getItem('simpan_uid') || null); // Tarik dari memori lokal
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  // 2. State Login Lokal & Mode
  const [currentUser, setCurrentUser] = useState(() => {
      try {
          // Cari apakah di komputer ini sudah pernah login sebelumnya
          return JSON.parse(localStorage.getItem('simpan_user')) || null;
      } catch (e) {
          return null;
      }
  });
  const [loginForm, setLoginForm] = useState({ id: '', pass: '' });
  const [appMode, setAppMode] = useState('MEDIS');
  const [allUsers, setAllUsers] = useState([]); 

  // --- INIT FIREBASE (VERSI BYPASS JARINGAN RS) ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    try {
      const app = initializeApp(firebaseConfig);
      
      // TRIK 1: Bypass WebSocket dan paksa Long-Polling agar tidak kena blokir Wi-Fi RS
      const firestoreInstance = initializeFirestore(app, {
          experimentalForceLongPolling: true 
      });
      
      setDb(firestoreInstance); 
      
    } catch (e) { 
        console.error("Firebase Init Error:", e);
    }

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- MONITORING USER DARI DATABASE (GLOBAL) ---
  useEffect(() => {
      if (!db) return;
      const usersRef = collection(db, 'users');
      // Pastikan 'name' sesuai dengan field di database kamu
      const q = query(usersRef, orderBy('name', 'asc')); 
      
      const unsub = onSnapshot(q, (snap) => {
          const users = snap.docs.map(d => d.data());
          setAllUsers(users);
      });
      return () => unsub();
  }, [db]);
 
  // --- [LEVEL 3] LOGIC LOGIN VIA DATABASE (FINAL) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Cek koneksi db
    if (!db) {
        alert("Database belum siap. Coba refresh halaman.");
        return;
    }

    try {
        // 1. Cari User di Firestore berdasarkan ID (misal: 'abi')
        // Kita paksa lowercase biar tidak case-sensitive
        const targetId = loginForm.id.toLowerCase().trim();
        const userDocRef = doc(db, 'users', targetId);
        
        // Ambil data dari awan...
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // 2. Cek Password (password dari input VS password dari database)
            // 2. Cek Password (password dari input VS password dari database)
            if (userData.pass === loginForm.pass) {
                // SUKSES!
                console.log("Login Berhasil via Firestore:", userData.name);
                
                // ✨ TAHAP 2: BERIKAN CAP BANGSAL DEFAULT JIKA BELUM ADA
                const userWithWard = {
                    ...userData,
                    ward: userData.ward || 'MELATI' // Kalau di database kosong, otomatis jadi MELATI
                };

                setCurrentUser(userWithWard);
                setAppMode('MEDIS');
                setUserId(userWithWard.id); 
                
                // Kunci sesi di memori lokal (fitur anti-logout kemarin)
                localStorage.setItem('simpan_user', JSON.stringify(userWithWard));
                localStorage.setItem('simpan_uid', userWithWard.id);
            } else {
                alert('Password salah!');
            }
        } else {
            alert('Username tidak ditemukan di Database!');
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Terjadi kesalahan koneksi. Cek internet.");
    }
  };

  // ✨ TAHAP 4: FUNGSI SUPERADMIN UNTUK PINDAH RUANGAN
  const handleSwitchWard = (targetWard) => {
      const updatedUser = { ...currentUser, ward: targetWard };
      setCurrentUser(updatedUser);
      
      // Update juga brankas di browser agar tidak hilang saat di-refresh
      localStorage.setItem('simpan_user', JSON.stringify(updatedUser));
      alert(`Beralih ke pantauan Ruang ${targetWard}`);
  };
  const handleInternalLogout = () => {
      setCurrentUser(null);
      setUserId(null);
      setLoginForm({ id: '', pass: '' });
      setAppMode('MEDIS');
      // ✨ SUNTIKKAN INI: Hapus kunci sesi hanya saat klik logout sengaja
      localStorage.removeItem('simpan_user');
      localStorage.removeItem('simpan_uid');
  };

  const getCashflowRole = () => {
      if (!currentUser) return null;
      if (currentUser.role === 'admin') return 'ALL';
      if (currentUser.role === 'finance_jm') return 'JM';
      if (currentUser.role === 'finance_kas') return 'KAS';
      if (currentUser.role === 'finance_doc') return 'DOKTER';
      return null;
  };

  // --- 1. TAMPILAN LOGIN ---
  if (!currentUser) {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
              <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-600"></div>
                  
                  <div className="text-center mb-8 mt-2 flex flex-col items-center">
                      <img src="/logo1.png" alt="Logo SIMPAN" className="h-40 object-contain drop-shadow-sm mb-2" />
                      <p className="text-slate-400 text-[9px] font-medium uppercase tracking-widest mt-2 border-t border-slate-100 pt-2 w-3/4 mx-auto">Authorized Access Only</p>
                  </div>
                  
                  <form onSubmit={handleLogin} className="space-y-5">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Username</label>
                          <div className="relative">
                              <span className="absolute left-3 top-3 text-slate-400">👤</span>
                              <input 
                                  type="text" 
                                  placeholder="Ketik username..." 
                                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm font-medium placeholder:text-slate-400" 
                                  value={loginForm.id} 
                                  onChange={e => setLoginForm({...loginForm, id: e.target.value})}
                                  autoFocus
                              />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                          <div className="relative">
                              <span className="absolute left-3 top-3 text-slate-400">🔒</span>
                              <input 
                                  type="password" 
                                  placeholder="••••••" 
                                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm font-medium placeholder:text-slate-400" 
                                  value={loginForm.pass} 
                                  onChange={e => setLoginForm({...loginForm, pass: e.target.value})} 
                              />
                          </div>
                      </div>

                      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 active:scale-[0.98] transition shadow-lg shadow-indigo-200/50 flex items-center justify-center gap-2 mt-2">
                          <span>🚀</span> Masuk
                      </button>                      
                  </form>
                  
                  <div className="text-center mt-4">
                      <p className="text-[10px] text-slate-400">&copy; 2026 SIMPAN by Abi Nugroho</p>
                  </div>
              </div>
          </div>
      );
  }

  // Loading Check (Sudah dibersihkan dari isAuthReady & isOfflineReady)
  if (!db) return <div className="flex h-screen items-center justify-center text-teal-600 animate-pulse font-bold">Memuat Database...</div>;

  // --- 2. TAMPILAN UTAMA (ROUTING) ---
  return (
      <div className="min-h-screen bg-slate-50">
          {appMode === 'MEDIS' ? (
              <MedicalRecordApp 
                  db={db} 
                  userId={userId} 
                  appId={firebaseConfig.appId} 
                  isOnline={isOnline} 
                  onLogout={handleInternalLogout}
                  userRole={currentUser.role}
                  // Props Penting
                  currentUser={currentUser}
                  appMode={appMode}
                  setAppMode={setAppMode}
                  cashflowRole={getCashflowRole()}
                  onSwitchWard={handleSwitchWard}
              />
          ) : (
              // --- MODE KEUANGAN: HEADER SINGLE (CLEAN LOOK) ---
              <div className="flex flex-col h-screen animate-in fade-in zoom-in-95 duration-300 bg-slate-50">
                  <div className="bg-white border-b px-4 h-14 flex justify-between items-center sticky top-0 z-50 shadow-sm">
                      
                      {/* KIRI: TOMBOL KEMBALI & JUDUL */}
                      <div className="flex items-center gap-3">
                          <button 
                              onClick={() => setAppMode('MEDIS')} 
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
                          >
                              <ChevronLeft size={16}/> Kembali ke Medis
                          </button>
                          <div className="h-6 w-[1px] bg-slate-200"></div>
                          
                          <div className="flex flex-col leading-none justify-center">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mode Keuangan</span>
                              <span className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                                  <Wallet size={16}/> {currentUser.cfLabel}
                              </span>
                          </div>
                      </div>

                      {/* KANAN: USER INFO & LOGOUT */}
                      <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end leading-none">
                              <span className="text-[10px] text-slate-400 font-bold">Logged in as</span>
                              <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
                          </div>
                          <div className="h-6 w-[1px] bg-slate-200"></div>
                          <button 
                              onClick={handleInternalLogout}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-100"
                              title="Keluar / Logout"
                          >
                              <LogOut size={18}/>
                          </button>
                      </div>
                  </div>
                  
                  {/* KONTEN CASHFLOW */}
                  <div className="flex-1 overflow-auto">
                      <Cashflow 
                          currentUser={{
                              ...currentUser,
                              cashflowRole: getCashflowRole(),
                              cashflowLabel: currentUser.cfLabel
                          }} 
                          membersList={allUsers} // Menggunakan data user dari Firestore
                          onLogout={handleInternalLogout} 
                      />
                  </div>
              </div>
          )}
      </div>
  );
};

export default App;