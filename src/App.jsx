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
import { 
    LEFT_ROOMS, RIGHT_ROOMS, ROOM_LIST, 
    DEFAULT_DPJP_DATA, LAB_CHECKS, RADIOLOGY_CHECKS, 
    PROCEDURES, MEDICATIONS 
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
const RoomMap = ({ roomList, activeRecords, onSelectRoom, onEditRoom, roomFilter, waitingList }) => {
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
            const neighborRecord = activeRecords.find(r => r.roomNumber === `${roomCode}${neighborBed}`);
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
            {/* WRAPPER UTAMA: flex-col (HP/Portrait) -> md:flex-row (Tablet Landscape/Laptop) */}
            <div className="flex flex-col md:flex-row w-full max-w-5xl gap-2 md:gap-3 bg-white p-1.5 rounded-xl shadow-inner border border-gray-100 justify-center">
                
                {/* KOLOM KIRI: Selalu 2 grid menyamping agar rapi */}
                <div className="grid grid-cols-2 gap-1.5 w-full">
                    {LEFT_ROOMS.map(renderRoom)}
                </div>

                {/* LORONG TENGAH: Sembunyi di HP/Portrait (hidden), Muncul di Landscape (md:flex) */}
                <div className="hidden md:flex flex-col justify-center items-center w-6 bg-gray-100 rounded-full border border-gray-200 shadow-inner relative flex-shrink-0">
                    <div className="absolute top-10 text-gray-300 text-[9px] font-bold tracking-[0.3em]" style={{ writingMode: 'vertical-rl' }}>LORONG</div>
                </div>

                {/* KOLOM KANAN: Selalu 2 grid menyamping agar rapi */}
                <div className="grid grid-cols-2 gap-1.5 w-full">
                    {RIGHT_ROOMS.map(renderRoom)}
                </div>

            </div>
        </div>
    );
};

const BukuCMTable = ({ records, updateRecord, onPrint }) => {
    const formatRoom = (room) => room ? room.replace(/[AB]$/, '') : '';

    // --- 1. URUTKAN KAMAR SECARA NUMERIK (K1, K2, K3...) ---
    const sortedRooms = useMemo(() => {
        return [...ROOM_LIST].sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, []);

    const formatCustomDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d)) return isoString;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yy} ${hh}:${min}`;
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

    // --- 2. SIHIR AUTO-FORMAT TANGGAL ---
    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); 
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 6);
        if (v.length > 6) final += ' ' + v.substring(6, 8);
        if (v.length > 8) final += ':' + v.substring(8, 10);
        e.target.value = final;
    };

    const hitungLamaRawat = (tanggalMasuk) => {
        if (!tanggalMasuk) return '-';
        const start = new Date(tanggalMasuk);
        if (isNaN(start)) return '?';
        const now = new Date();
        const diffTime = now.getTime() - start.getTime();
        return diffTime < 0 ? '0 hr' : Math.floor(diffTime / (1000 * 60 * 60 * 24)) + ' hr'; 
    };

    const handleInlineSave = (id, field, value) => {
        updateRecord(id, { [field]: value });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center no-print flex-shrink-0">
                <div>
                    <h2 className="font-bold text-emerald-800 flex items-center gap-2 text-sm">📖 Buku Register Ruangan (CM)</h2>
                    <p className="text-[9px] text-emerald-600">isi tanggal-jam masuk 2 angka, langsung saja tanpa /</p>
                </div>
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
                                <th className="p-2 border-x border-gray-300 w-[40px] sticky left-0 bg-gray-200 z-50">No</th>
                                <th className="p-2 border-x border-gray-300 w-[180px] sticky left-[40px] bg-gray-200 z-50 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Pasien</th>
                                <th className="p-2 border-x border-gray-300 w-12 bg-gray-100">KMR</th>
                                <th className="p-2 border-x border-gray-300 w-24 bg-gray-100">No. RM</th>
                                <th className="p-2 border-x border-gray-300 min-w-[130px] bg-gray-100">Dokter</th>
                                <th className="p-2 border-x border-gray-300 w-14 bg-gray-100">Kelas</th>
                                <th className="p-2 border-x border-gray-300 w-32 bg-gray-100">Tgl Masuk</th>
                                <th className="p-2 border-x border-gray-300 w-12 bg-gray-100">HR</th>
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
                if (lower.match(/\b(konsul|konsultasi|ts|rawat gabung|alih rawat)\b/)) {
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

// --- HELPER FUNGSI TANGGAL & LAMA RAWAT UNTUK TTV ---
const formatDateCM = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${min}`;
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
    if (diffTime < 0) return '0 hr';
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + ' hr';
};

// --- PATIENT TABLE FINAL (DENGAN BUKU CM INLINE DI MODE TTV) ---
const PatientTable = ({ records, onEdit, onPrint, onShowLaporModal, onDischarge, roomSortOrder, onPrintTTV, onQuickTtv, onBulkDischarge, updateRecord, onPrintBukuCM, onPrintLabel }) => {
    
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
        if (v.length > 4) final += '/' + v.substring(4, 6);
        if (v.length > 6) final += ' ' + v.substring(6, 8);
        if (v.length > 8) final += ':' + v.substring(8, 10);
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
            </div>

            {viewMode === 'buku-cm' ? (
                <div className="flex-1 bg-gray-50 overflow-hidden"> {/* Ganti overflow-y-auto jadi overflow-hidden */}
                    <BukuCMTable records={sortedRecords} updateRecord={updateRecord} onPrint={onPrintBukuCM} />
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
                                        <th className="p-1 border border-gray-300 w-[75px] text-center bg-emerald-50 text-[10px]">Tgl Msk</th>
                                        <th className="p-1 border border-gray-300 w-[40px] text-center bg-emerald-50 text-[10px]">Hari</th>
                                        
                                        {/* HEADER TTV ASLI */}
                                        <th className="p-1 border border-gray-300 w-[40px] text-center bg-white text-[10px]">TD</th>
                                        <th className="p-1 border border-gray-300 w-[40px] text-center bg-white text-[10px]">Nadi</th>
                                        <th className="p-1 border border-gray-300 w-[40px] text-center bg-white text-[10px]">Suhu</th>
                                        <th className="p-1 border border-gray-300 w-[40px] text-center bg-white text-[10px]">RR</th>
                                        <th className="p-1 border border-gray-300 w-[40px] text-center bg-white text-[10px]">SpO2</th>
                                        {/* Class w-[250px] dihapus agar kolom rencana otomatis mengisi sisa ruang kertas A4 */}
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
                                                <button onClick={() => onDischarge(rec.id, rec.name, rec.roomNumber)} className="flex flex-col items-center justify-center p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300" title="Pulang"><span className="text-sm">🚪</span><span className="text-[8px] font-bold">Plg</span></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                // --- MODE TTV (24 Kamar Kosong & Terisi) ---
                                [...ROOM_LIST].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map((room, index) => {
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
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-bold text-rose-600 text-[10px]">
                                                {rec ? hitungHariCM(rec.admissionDate) : ''}
                                            </td>

                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono font-bold text-[10px]">{rec ? getTtvValue(rec.objective, 'TD') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'N') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'S') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'RR') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'SpO2') : ''}</td>
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

// --- LOGIC UTAMA (MEDICAL RECORD APP - LEVEL 4 COMPLETED) ---
const MedicalRecordApp = ({ 
    db, userId, appId, isOnline, onLogout, 
    currentUser, setAppMode, cashflowRole 
}) => {
  // --- STATE LEVEL 4: MANAJEMEN USER (BARU) ---
  const [allUsers, setAllUsers] = useState([]); // Daftar user (Admin Only)
  const [profileForm, setProfileForm] = useState({ name: '', pass: '' }); // Form Profil Sendiri
  const [adminUserForm, setAdminUserForm] = useState({ id: '', name: '', pass: '', role: 'member' }); // Form Admin

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
  
  // State untuk Data Dinamis (Setelan)
  const [dpjpProfiles, setDpjpProfiles] = useState(initialDpjpProfiles.map(p => ({...p, name: p.name})));
    // Master data lists (lab, radiologi, tindakan, terapi) -- dapat diubah lewat Setelan
    const [masterLabs, setMasterLabs] = useState([]);
    const [masterRads, setMasterRads] = useState([]);
    const [masterProcedures, setMasterProcedures] = useState([]);
    const [masterMedications, setMasterMedications] = useState([]);
    // Input fields for master data
    const [newMasterLab, setNewMasterLab] = useState('');
    const [newMasterRad, setNewMasterRad] = useState('');
    const [newMasterProcedure, setNewMasterProcedure] = useState('');
    const [newMasterMedication, setNewMasterMedication] = useState('');
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);      

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

  const [dpjpFilter, setDpjpFilter] = useState(''); 
  const [selectedRoomFilter, setSelectedRoomFilter] = useState(ROOM_LIST);
  
  const [showRaber1, setShowRaber1] = useState(false);
  const [showRaber2, setShowRaber2] = useState(false);
  const [showTtvModal, setShowTtvModal] = useState(false);
  
  
  const [confirmDetails, setConfirmDetails] = useState({ isOpen: false, message: '', title: '', action: () => {} });
  const openConfirm = (title, message, action) => { setConfirmDetails({ isOpen: true, title, message, action }); };
  const closeConfirm = () => { setConfirmDetails({ isOpen: false, message: '', title: '', action: () => {} }); };
  
  const [formData, setFormData] = useState({
    roomNumber: '', name: '', rmNumber: '', gender: '', 
    dpjpName: '', raberName: '', raber2Name: '', admissionDate: '',
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

  // 4. Action: Admin Simpan User
  const handleAdminSaveUser = async () => {
      if (!adminUserForm.id || !adminUserForm.name || !adminUserForm.pass) return alert("Semua kolom wajib diisi!");
      const targetId = adminUserForm.id.toLowerCase().trim().replace(/\s+/g, '_');
      try {
          // Cek ID manual di state allUsers untuk menentukan mode (Add/Edit)
          const exists = allUsers.find(u => u.id === targetId);
          if (!exists) {
             await setDoc(doc(db, 'users', targetId), { ...adminUserForm, id: targetId, createdAt: Timestamp.now() });
             alert(`User baru "${adminUserForm.name}" ditambahkan!`);
          } else {
             await updateDoc(doc(db, 'users', targetId), { 
                 name: adminUserForm.name, pass: adminUserForm.pass, role: adminUserForm.role 
             });
             alert(`User "${adminUserForm.name}" diperbarui.`);
          }
          setAdminUserForm({ id: '', name: '', pass: '', role: 'member' });
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
        const matchesDpjp = !dpjpFilter || rec.dpjpName === dpjpFilter;
        const matchesRoom = selectedRoomFilter.length === ROOM_LIST.length || selectedRoomFilter.includes(rec.roomNumber);
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            rec.name.toLowerCase().includes(term) || 
            (rec.analysis && rec.analysis.toLowerCase().includes(term)) ||
            (rec.dpjpName && rec.dpjpName.toLowerCase().includes(term)); 
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

  // 1. Load Settings (DPJP)
  useEffect(() => {
      if (!userId) return; 
      const ref = getConfigRef();
      if (!ref) return;
      setIsSettingsLoaded(false);
      const unsubscribe = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
              const data = snap.data();
              if (data.dpjpProfiles && Array.isArray(data.dpjpProfiles)) {
                  setDpjpProfiles(data.dpjpProfiles);
              }
              // load master lists if present
              if (data.masterLabs && Array.isArray(data.masterLabs)) setMasterLabs(data.masterLabs);
              if (data.masterRads && Array.isArray(data.masterRads)) setMasterRads(data.masterRads);
              if (data.masterProcedures && Array.isArray(data.masterProcedures)) setMasterProcedures(data.masterProcedures);
              if (data.masterMedications && Array.isArray(data.masterMedications)) setMasterMedications(data.masterMedications);
              setIsSettingsLoaded(true);
          } else {
              // initialize with existing DPJP and empty masters
              setDoc(ref, { dpjpProfiles: initialDpjpProfiles, masterLabs: [], masterRads: [], masterProcedures: [], masterMedications: [] }).catch(err => console.error("Init settings error:", err));
              setIsSettingsLoaded(true);
          }
      }, (err) => {
          console.error("Settings Load Error:", err);
          setIsSettingsLoaded(false);
      });
      return () => unsubscribe();
  }, [getConfigRef, userId]);

  const dpjpOptions = useMemo(() => dpjpProfiles.map(p => p.name), [dpjpProfiles]);

  // Generic save helper for settings (merges keys)
  const saveSettings = async (partial) => {
      const ref = getConfigRef();
      if (!ref) return;
      try {
          await setDoc(ref, partial, { merge: true });
      } catch(e) { alert("Gagal menyimpan setelan. Cek koneksi."); }
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
    const q = query(ref, orderBy('createdAt', 'desc'), limit (200));
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
              
              // Pisahkan pasien yang masih dirawat dan yang sudah pulang (Arsip)
              const active = data.filter(r => !r.isDischarged);
              const archived = data.filter(r => r.isDischarged);
              
              setActiveRecords(active);
              setArchivedRecords(archived); // <-- Simpan ke gudang arsip
              setOccupiedRooms(active.map(r => r.roomNumber));
    }, (err) => console.error("Firestore Error:", err));
    return () => unsubscribe();
  }, [getCollectionRef, userId]);

  // --- LOGIC FORM & OPERASIONAL ---
  const pullDataForField = (field) => {
    if (!historyLogs || historyLogs.length === 0) return alert("Belum ada riwayat.");
    const foundLog = historyLogs.find(log => log[field] && log[field].trim().length > 0);
    if (foundLog) {
        setFormData(prev => ({ ...prev, [field]: foundLog[field] }));
        const btn = document.activeElement;
        if(btn && btn.tagName === 'BUTTON') { 
            const originalText = btn.innerText;
            btn.innerText = "✅ Sukses!";
            setTimeout(() => btn.innerText = originalText, 1000);
        }
    } else { alert(`Data ${field.toUpperCase()} tidak ditemukan di riwayat.`); }
  };

  const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(p => ({ ...p, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      roomNumber: '', name: '', rmNumber: '', gender: '', dpjpName: '', raberName: '', raber2Name: '',
      subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
      admissionDate: new Date().toISOString()
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

  const handleSubmit = (e) => { // Hapus kata 'async' di sini
      e.preventDefault();
      if (!formData.name || !formData.roomNumber || !formData.dpjpName) {
          alert('Mohon lengkapi data wajib (Nama, Kamar, DPJP).');
          return;
      }
      
      const isRoomOccupied = occupiedRooms.includes(formData.roomNumber) && 
                             (!isEditing || (isEditing && formData.roomNumber !== activeRecords.find(r => r.id === currentRecordId)?.roomNumber));
      
      if (!isEditing && isRoomOccupied) return alert(`Kamar ${formData.roomNumber} sudah terisi.`);
      else if (isEditing && isRoomOccupied) {
           const existingOccupant = activeRecords.find(r => r.roomNumber === formData.roomNumber && r.id !== currentRecordId);
           if (existingOccupant) return alert(`Kamar ${formData.roomNumber} sudah terisi oleh ${existingOccupant.name}.`);
      }

      // 1. Siapkan Data
      const now = Timestamp.now();
      const data = { ...formData, updatedAt: now };
      if (!isEditing) data.createdAt = now;
      const ref = getCollectionRef();

      // 2. TEMBAK KE DATABASE (Jalan diam-diam di background tanpa 'await')
      if (isEditing && currentRecordId) {
          updateDoc(doc(ref, currentRecordId), data).catch(err => console.error("Gagal update:", err));
      } else {
          addDoc(ref, data).then(newDoc => {
              if (db && appId) {
                  const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${newDoc.id}/notes`);
                  addDoc(notesRef, { ...formData, createdAt: now, noteType: 'daily_update' }).catch(err => console.error("Gagal tambah catatan:", err));
              }
          }).catch(err => console.error("Gagal tambah pasien:", err));
      }

      // 3. AKSI INSTAN: Langsung bersihkan dan tutup layar detik itu juga!
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
            ...quickTtvTarget, objective: finalObjective, noteType: 'ttv_update', createdAt: Timestamp.now() 
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
        analysis: rec.analysis || '', planning: rec.planning || '', isDischarged: false
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
    openConfirm("Konfirmasi Pulang", `Keluarkan pasien ${name}? Data akan dipindah ke Arsip.`, async () => {
        setLoading(true);
        try {
            const ref = getCollectionRef();
            await updateDoc(doc(ref, id), { 
                isDischarged: true, 
                lastRoom: room || '', // Simpan kamar terakhir di sini
                roomNumber: '', 
                dischargeDate: new Date().toISOString(), 
                updatedAt: Timestamp.now() 
            });
        } catch (e) { console.error(e); } finally { setLoading(false); closeConfirm(); }
    });
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
      const text = `${salam} dokter, izin melaporkan jumlah pasien dokter di Melati ada ${count} pasien ya. terimakasih`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleReportRaber = (drName, patientNames) => {
      const profile = dpjpProfiles.find(p => p.name === drName);
      const phone = normalizePhone(profile?.waNumber);
      if (!phone) return alert(`Nomor WA ${drName} belum disetting.`);
      const salam = getDoctorGreeting(drName);
      const text = `${salam} dokter, izin mengingatkan ada pasien Raber ya di Melati a.n ${patientNames.join(', ')}. terimakasih`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleLapor = (rec, type) => {
      let targetNumber = '';
      if (type === 'DPJP') {
          const profile = dpjpProfiles.find(p => p.name === rec.dpjpName);
          targetNumber = normalizePhone(profile?.waNumber);
          if (!targetNumber) return alert(`Nomor WA ${rec.dpjpName} belum disetting.`);
      } 
      const { labs, rads, tms, others } = parsePlanning(rec.planning);
      const planningText = [
          ...others.filter(Boolean),
          labs.length > 0 ? `Lab: ${labs.join(', ')}` : null,
          rads.length > 0 ? `Rad: ${rads.join(', ')}` : null,
          tms.length > 0 ? `Tndkn: ${tms.join(', ')}` : null,
      ].filter(Boolean).join('\n');

      const dpjpInfo = type === 'Forward' ? `\nDPJP: ${rec.dpjpName || '-'}` : '';
      const header = `Dokter Izin Lapor Pasien \na.n ${rec.name} ${dpjpInfo}`;
      const text = `${header}\n\n*S:*\n${rec.subjective || '-'}\n\n*O:*\n${rec.objective || '-'}\n\n*A:*\n${rec.analysis || '-'}\n\n*P:*\n${planningText || '-'}\n\nMohon advis,\nTerimakasih`;

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
        <html><head><title>Print TTV</title>
        <style>
            @page { size: A4 portrait; margin: 5mm; }
            body { font-family: Arial; zoom: 0.85; margin: 0; padding: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 9pt; }
            th, td { border: 1px solid black; padding: 2px 3px; }
            th { background-color: #f0f0f0; text-align: center; height: 25px; font-size: 8pt; }
            td:nth-child(1) { width: 130px; } td:nth-child(2) { width: 55px; text-align: center; font-family: monospace; } td:nth-child(3) { width: 30px; text-align: center; } td:nth-child(4) { width: 65px; text-align: center; font-family: monospace; } td:nth-child(5) { width: 35px; text-align: center; font-weight: bold; }
            td:nth-child(6), td:nth-child(7), td:nth-child(8), td:nth-child(9), td:nth-child(10) { width: 35px; text-align: center; font-family: monospace; } 
            td:nth-child(11) { text-align: left; } 
            .no-print { display: none !important; } input { display: none !important; } span.hidden { display: inline !important; }
            h3 { text-align: center; margin: 5px 0 2px 0; font-size: 14pt; } .date-print { text-align: center; font-size: 8pt; margin-bottom: 5px; color: #555; }
        </style></head><body>
        <h3>Lembar Observasi Tanda Vital & Rencana Harian</h3>
        <div class="date-print">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
        ${content}
        </body></html>
    `;
    cetakPWA(html, 'Print TTV'); // <--- INI YANG BERUBAH
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
                    <div class="header-ruangan"><div>MELATI</div><div style="font-size: 12pt; margin-top: 2mm;">${cleanRoom}</div></div>
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
            th, td { border: 1px solid black; padding: 4px; font-size: 9pt; text-align: center; }
            th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; font-size: 8pt; }
            .text-left { text-align: left !important; }
            th:nth-child(1), td:nth-child(1) { width: 30px; } th:nth-child(2), td:nth-child(2) { width: 180px; } th:nth-child(3), td:nth-child(3) { width: 40px; } th:nth-child(4), td:nth-child(4) { width: 80px; } th:nth-child(5), td:nth-child(5) { width: 150px; } th:nth-child(6), td:nth-child(6) { width: 40px; } th:nth-child(7), td:nth-child(7) { width: 110px; } th:nth-child(8), td:nth-child(8) { width: 40px; }
            input { display: none !important; } span.print-text { display: inline !important; } .no-print { display: none !important; }
            h3 { text-align: center; margin-bottom: 10px; font-size: 14pt; color: #065f46; }
        </style></head><body>
        <h3>BUKU REGISTER RUANGAN (CM) - SIMPAN</h3>
        ${content.innerHTML}
        </body></html>
    `;
    cetakPWA(html, 'Cetak Buku Register (CM)'); // <--- INI YANG BERUBAH
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

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
      const s = { total: records.length, active: activeRecords.length, discharged: records.filter(r => r.isDischarged).length, monthly: {}, dpjpCounts: {}, raberData: {}, emptyCount: 0, emptyMale: 0, emptyFemale: 0 };
      const occupied = activeRecords.map(r => r.roomNumber);
      
      ROOM_LIST.forEach(room => {
          if (!occupied.includes(room)) {
              // UPDATE LOGIC UNTUK FORMAT K1A / K1B
              const match = room.match(/^(K\d+)([AB])$/);
              if (!match) {
                  s.emptyCount++; // Kalau format aneh, anggap kosong biasa
              } else {
                  const roomCode = match[1]; // K1
                  const bedCode = match[2];  // A atau B
                  const neighborBed = bedCode === 'A' ? 'B' : 'A';
                  const neighborRoom = `${roomCode}${neighborBed}`;
                  const neighborRec = activeRecords.find(r => r.roomNumber === neighborRoom);

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

      // ... (SISA KODE STATS DI BAWAHNYA TETAP SAMA SEPERTI SEBELUMNYA) ...
      records.forEach(r => {
          const m = r.createdAt.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
          if (!s.monthly[m]) s.monthly[m] = { active: 0, discharged: 0, lab: 0, rad: 0, tm: 0 };
          r.isDischarged ? s.monthly[m].discharged++ : s.monthly[m].active++;
          if (r.planning) {
             const lines = r.planning.split('\n');
             lines.forEach(l => {
                 const t = l.trim().toLowerCase();
                 if (t.startsWith('lab.')) s.monthly[m].lab++; else if (t.startsWith('rad.')) s.monthly[m].rad++; else if (t.startsWith('tm.')) s.monthly[m].tm++;
             });
          }
      });
      activeRecords.forEach(rec => {
          s.dpjpCounts[rec.dpjpName] = (s.dpjpCounts[rec.dpjpName] || 0) + 1;
          [rec.raberName, rec.raber2Name].forEach(dr => { if(dr) { if(!s.raberData[dr]) s.raberData[dr]=[]; s.raberData[dr].push(rec.name); } });
      });
      return s;
  }, [records, activeRecords]);

  // --- RENDER DASHBOARD ---
  const renderDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">
        <div className="lg:col-span-6 flex flex-col h-[calc(100vh-120px)]">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                <div className="flex justify-between items-center px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2"><span className="text-lg">🗺️</span><div><h3 className="text-xs font-bold text-indigo-900 uppercase">Denah Kamar</h3><p className="text-[9px] text-gray-500">{dpjpFilter || selectedRoomFilter.length !== ROOM_LIST.length ? 'Filter Aktif' : 'Semua Kamar'}</p></div></div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                    <RoomMap roomList={ROOM_LIST} activeRecords={filteredActiveRecords} onSelectRoom={handleSelectRoom} onEditRoom={handleEditRoom} roomFilter={selectedRoomFilter} waitingList={waitingList} />
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
            <div className="bg-white rounded p-3 border"><h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-xs uppercase flex justify-between"><span>🤝 Konsul</span><span className="bg-yellow-100 px-2 rounded-full">{Object.keys(stats.raberData).length} Dr</span></h3>
                <div className="space-y-2">{Object.entries(stats.raberData).length===0?<div className="text-[10px] text-gray-400 text-center">Nihil.</div>:Object.entries(stats.raberData).map(([d,p])=>(<div key={d} className="text-[10px] bg-yellow-50 p-2 rounded border flex justify-between group"><div className="flex-1"><div className="font-bold text-indigo-800">{d}</div><div className="text-gray-600">({p.join(', ')})</div></div><button onClick={()=>handleReportRaber(d,p)} className="ml-2 bg-green-100 text-green-700 px-2 py-1 rounded opacity-80 group-hover:opacity-100">📱</button></div>))}</div>
            </div>
            <div className="bg-white rounded overflow-hidden border"><div className="bg-gray-800 px-3 py-2 text-white text-xs font-bold uppercase">📊 Rekap</div><table className="w-full text-[10px] text-left"><thead className="bg-gray-100 text-gray-500 font-bold border-b"><tr><th className="p-2">Bulan</th><th className="p-2 text-center">Aktif</th><th className="p-2 text-center">Plg</th><th className="p-2 text-center text-red-600">Lab</th><th className="p-2 text-center text-blue-600">Rad</th><th className="p-2 text-center text-green-600">TM</th></tr></thead><tbody>{Object.entries(stats.monthly).map(([m,d])=>(<tr key={m} className="border-b hover:bg-gray-50"><td className="p-2 font-bold text-indigo-900">{m}</td><td className="p-2 text-center">{d.active}</td><td className="p-2 text-center">{d.discharged}</td><td className="p-2 text-center font-bold">{d.lab}</td><td className="p-2 text-center font-bold">{d.rad}</td><td className="p-2 text-center font-bold">{d.tm}</td></tr>))}</tbody></table></div>
            <div className="h-10"></div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">
        {/* HEADER V5 (FIX: Menu Navigasi Stabil) */}
        <div className="bg-white shadow-sm px-4 h-14 sticky top-0 z-[80] border-b flex justify-between items-center max-w-7xl mx-auto">
            <div onClick={() => setView('dashboard')} className="flex items-center cursor-pointer hover:opacity-80 transition-opacity select-none py-1">
                <img src="/logo3.png" alt="SIMPAN Header" className="h-28 object-contain" />
            </div>
            <div className="flex items-center gap-2">
                <div className="hidden lg:block border-r pr-3 mr-1"><DigitalClock /></div>
                <button onClick={() => { const waLink = generateShiftReport(activeRecords, records, waitingList, dpjpProfiles); window.open(`https://wa.me/?text=${waLink}`, '_blank'); }} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-indigo-200 transition shadow-sm"><span className="mr-1">📢</span> Lap.</button>
                <div className={`hidden sm:block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 shadow-green-400' : 'bg-red-500'} ring-2 ring-white`} title={isOnline?"Online":"Offline"}></div>
                
                {cashflowRole ? (
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 relative ml-2">
                        <div className="relative group">
                            <button className="px-3 py-1.5 text-[10px] font-bold rounded flex items-center gap-2 bg-white text-teal-700 shadow-sm border border-slate-100 cursor-pointer"><FileText size={12}/> MEDIS ▾</button>
                            
                            {/* FIX DROPDOWN 1: Pakai pt-2 (padding) dan bg-white dipindah ke dalam */}
                            <div className="absolute top-full right-0 pt-2 w-48 z-[90] hidden group-hover:block animate-in fade-in zoom-in-95 origin-top-right">
                                <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1">
                                    <div className="px-4 py-2 border-b border-gray-100 bg-teal-50/50"><p className="text-[9px] text-gray-500 uppercase font-bold">Menu Navigasi</p></div>
                                    <div className="px-2 py-1"><span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded w-fit block">👤 {currentUser ? currentUser.name : 'Guest'}</span></div>
                                    <button onClick={() => setView('dashboard')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">🏠 Dashboard</button>
                                    <button onClick={() => setView('patient-list')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">📋 Daftar Pasien</button>
                                    <button onClick={() => setView('archived-list')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">🗃️ Gudang Arsip Pasien</button>
                                    <button onClick={() => setView('settings')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">⚙️ Setelan</button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button onClick={onLogout} className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold flex items-center">🚪 Keluar</button>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setAppMode('KEUANGAN')} className="px-3 py-1.5 text-[10px] font-bold rounded flex items-center gap-2 text-slate-500 hover:text-indigo-700 hover:bg-white/60 transition ml-1"><Wallet size={12}/> KEUANGAN</button>
                    </div>
                ) : (
                    <div className="relative group ml-2">
                        <button className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm hover:bg-gray-50"><span>☰</span> MENU ▾</button>
                        
                        {/* FIX DROPDOWN 2: Pakai pt-2 (padding) dan bg-white dipindah ke dalam */}
                        <div className="absolute top-full right-0 pt-2 w-48 z-[90] hidden group-hover:block animate-in fade-in zoom-in-95 origin-top-right">
                            <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1">
                                <div className="px-2 py-1"><span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded w-fit block">👤 {currentUser ? currentUser.name : 'Guest'}</span></div>
                                <button onClick={() => setView('dashboard')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">🏠 Dashboard</button>
                                <button onClick={() => setView('patient-list')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">📋 Daftar Pasien</button>
                                <button onClick={() => setView('settings')} className="w-full text-left px-4 py-2 text-xs flex items-center hover:bg-slate-50 text-slate-700">⚙️ Setelan</button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button onClick={onLogout} className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold flex items-center">🚪 Keluar</button>
                            </div>
                        </div>
                    </div>
                )}
                <button onClick={() => setShowInputModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow-md text-xs font-bold transition flex items-center gap-1 ml-1"><span>+</span> Baru</button>
            </div>
        </div>

        <div className="relative flex flex-row max-w-7xl mx-auto lg:h-[calc(100vh-64px)] overflow-hidden">
            <div className={`fixed top-16 left-0 bottom-0 w-full md:w-[400px] z-[60] bg-white transition-transform duration-300 ease-in-out shadow-2xl border-r ${showWaitingModal ? 'translate-x-0' : '-translate-x-full'}`}>
                <WaitingListInputPanel show={showWaitingModal} onClose={() => setShowWaitingModal(false)} onAdd={handleAddWaiting} availableRooms={ROOM_LIST} occupiedRooms={occupiedRooms} waitingList={waitingList} onUpdateRoom={updateWaitingListRoom} activeRecords={activeRecords}/>
            </div>
            <div className="w-full h-full flex flex-col overflow-hidden">
                <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                    {view === 'dashboard' && renderDashboard()}
                    {view === 'patient-list' && (
                        <div className="h-full flex flex-col bg-gray-50">
                            <div className="p-3 bg-white border-b shadow-sm sticky top-0 z-40 flex-shrink-0 space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2"><h2 className="font-bold text-lg text-indigo-800">📂 Daftar Pasien</h2><span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{filteredActiveRecords.length} Pasien</span></div>
                                    <div className="flex space-x-1">
                                        <button onClick={handleExportExcel} className="text-[10px] px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-600 hover:text-white transition shadow-sm">Excel</button>
                                        <button onClick={() => setShowBulkPrint(true)} className="text-[10px] px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition shadow-sm">🖨️ Cetak Banyak</button>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <div className="w-full md:w-48 relative z-50"><RoomFilterDropdown allRooms={ROOM_LIST} selectedRooms={selectedRoomFilter} onChange={setSelectedRoomFilter} /></div>
                                    <div className="w-full md:w-48">
                                        <select value={dpjpFilter} onChange={(e) => setDpjpFilter(e.target.value)} className="w-full p-1.5 border border-indigo-200 rounded-lg text-xs bg-white h-[32px]">
                                            <option value="">Semua Dokter (DPJP)</option>{dpjpOptions.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                                        <input type="text" placeholder="Cari Nama / Diagnosa / Dokter..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 h-[32px]" />
                                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-red-500 font-bold text-xs">✕</button>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden relative z-0">
                                <PatientTable records={filteredActiveRecords} onEdit={handleEdit} onPrint={(r) => setSelectedRecordForPrint(r)} onShowLaporModal={setRecordForLapor} onDischarge={handleDischarge} onBulkPrint={() => setShowBulkPrint(true)} roomSortOrder={selectedRoomFilter} onPrintTTV={handlePrintTTV} onQuickTtv={(rec) => { setQuickTtvTarget(rec); setShowTtvModal(true); }} onBulkDischarge={handleBulkDischarge} updateRecord={updateRecord} onPrintBukuCM={handlePrintBukuCM} onPrintLabel={handlePrintLabel} />
                            </div>
                        </div>
                    )}

                    {/* --- VIEW 4: ARSIP PASIEN (LEVEL 4 - UPDATE) --- */}
                    {view === 'archived-list' && (
                    <div className="h-full flex flex-col bg-slate-50">
                        <div className="p-4 bg-white border-b shadow-sm sticky top-0 z-40 space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-lg text-slate-800">🗃️ Gudang Arsip Pasien Pulang</h2>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                        {archivedRecords.length} Total Data
                                    </span>
                                </div>
                            </div>

                            {/* --- SEARCHBAR ARSIP --- */}
                            <div className="relative max-w-md">
                                <input 
                                    type="text" 
                                    placeholder="Cari Nama atau No. RM di arsip..." 
                                    className="w-full pl-4 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    value={archiveSearch}
                                    onChange={(e) => setArchiveSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden text-xs">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 w-24 text-center">No. RM</th>
                                            <th className="p-3">Nama Pasien</th>
                                            <th className="p-3 w-20 text-center">Km. Terakhir</th>
                                            <th className="p-3">DPJP Terakhir</th>
                                            <th className="p-3 text-center">Tgl Masuk</th>
                                            <th className="p-3 text-center">Tgl Pulang</th>
                                            <th className="p-3 text-center w-28">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {archivedRecords
                                            .filter(rec => 
                                                rec.name.toLowerCase().includes(archiveSearch.toLowerCase()) || 
                                                (rec.rmNumber && rec.rmNumber.includes(archiveSearch))
                                            )
                                            .map(rec => (
                                            <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3 text-center font-mono text-slate-400">{rec.rmNumber || '-'}</td>
                                                <td className="p-3 font-bold text-slate-800 uppercase">{rec.name}</td>
                                                <td className="p-3 text-center font-bold text-indigo-600 bg-indigo-50/30">{rec.lastRoom || '-'}</td>
                                                <td className="p-3 text-slate-600">{rec.dpjpName}</td>
                                                <td className="p-3 text-center text-slate-400">{formatDateCM(rec.admissionDate) || '-'}</td>
                                                <td className="p-3 text-center font-bold text-rose-500">
                                                    {rec.dischargeDate ? new Date(rec.dischargeDate).toLocaleDateString('id-ID', {day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit'}).replace(/\./g, ':') : '-'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button 
                                                        onClick={() => handleRestorePatient(rec.id, rec.name)}
                                                        className="bg-white text-indigo-600 px-3 py-1.5 rounded border border-indigo-200 hover:bg-indigo-600 hover:text-white transition shadow-sm font-bold text-[10px]"
                                                    >
                                                        ↩️ Balikkan
                                                    </button>
                                                    {/* TOMBOL HAPUS PERMANEN (BARU) */}
                                                    <button 
                                                        onClick={() => handleDeletePermanent(rec.id, rec.name)}
                                                        className="bg-white text-red-600 px-3 py-1.5 rounded border border-red-200 hover:bg-red-600 hover:text-white transition shadow-sm font-bold text-[10px]"
                                                        title="Hapus Permanen dari Database"
                                                    >
                                                        🗑️ Hapus
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                    
                    {/* --- VIEW 3: SETELAN (LEVEL 4 - UPDATE) --- */}
                    {view === 'settings' && (
                        <div className="bg-white p-6 rounded shadow h-full overflow-y-auto">
                            <h2 className="font-bold text-xl mb-6 text-indigo-900 border-b pb-2 flex items-center gap-2">⚙️ Pusat Pengaturan</h2>
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
                                        <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm mb-4">
                                            <h4 className="text-xs font-bold text-indigo-800 mb-2 uppercase">Tambah / Reset User</h4>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <input type="text" placeholder="ID (Username)" value={adminUserForm.id} onChange={e => setAdminUserForm({...adminUserForm, id: e.target.value})} className="p-2 border rounded text-xs" />
                                                <input type="text" placeholder="Nama Lengkap" value={adminUserForm.name} onChange={e => setAdminUserForm({...adminUserForm, name: e.target.value})} className="p-2 border rounded text-xs" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <input type="text" placeholder="Password" value={adminUserForm.pass} onChange={e => setAdminUserForm({...adminUserForm, pass: e.target.value})} className="p-2 border rounded text-xs font-mono" />
                                                <select value={adminUserForm.role} onChange={e => setAdminUserForm({...adminUserForm, role: e.target.value})} className="p-2 border rounded text-xs bg-white">
                                                    <option value="member">Member</option><option value="admin">Admin</option><option value="finance_jm">Keuangan (JM)</option><option value="finance_kas">Keuangan (KAS)</option><option value="finance_doc">Keuangan (Dokter)</option>
                                                </select>
                                            </div>
                                            <button onClick={handleAdminSaveUser} className="w-full bg-indigo-600 text-white py-1.5 rounded text-xs font-bold hover:bg-indigo-700">Simpan / Update User</button>
                                        </div>
                                        <div className="overflow-hidden rounded border border-indigo-200">
                                            <table className="w-full text-left text-xs bg-white"><thead className="bg-indigo-100 text-indigo-800"><tr><th className="p-2">ID</th><th className="p-2">Nama</th><th className="p-2">Role</th><th className="p-2">Pass</th><th className="p-2 text-center">Aksi</th></tr></thead>
                                            <tbody className="divide-y divide-indigo-50">{allUsers.map(u => (
                                                <tr key={u.id} className="hover:bg-indigo-50"><td className="p-2 font-mono text-slate-500">{u.id}</td><td className="p-2 font-bold">{u.name}</td><td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${u.role==='admin'?'bg-purple-100 text-purple-700':u.role==='member'?'bg-slate-100 text-slate-600':'bg-green-100 text-green-700'}`}>{u.role}</span></td><td className="p-2 font-mono text-slate-500">{u.pass}</td><td className="p-2 text-center flex justify-center gap-1"><button onClick={()=>setAdminUserForm(u)} className="bg-yellow-100 text-yellow-700 p-1 rounded">✏️</button>{u.id!==currentUser.id&&(<button onClick={()=>handleAdminDeleteUser(u.id)} className="bg-red-100 text-red-700 p-1 rounded">🗑️</button>)}</td></tr>
                                            ))}</tbody></table>
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
                            {availableRooms.map(r => {
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
                                                            {availableRooms.map(r => {
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
    const archivedMatches = useMemo(() => {
    // Cek apakah ada ketikan di Nama ATAU di RM
    const hasName = formData.name && formData.name.length >= 3;
    const hasRm = formData.rmNumber && formData.rmNumber.length >= 2;
    
    if (!hasName && !hasRm) return [];
    
    return archivedRecords.filter(r => {
        // Cari kecocokan di Nama ATAU RM
        const matchName = hasName && r.name.toLowerCase().includes(formData.name.toLowerCase());
        const matchRm = hasRm && r.rmNumber && r.rmNumber.includes(formData.rmNumber);
        return matchName || matchRm;
    }).slice(0, 5); // Tampilkan max 5 saran
}, [formData.name, formData.rmNumber, archivedRecords]); 
// PERHATIKAN: isEditing dihapus dari batas syarat agar tetap muncul saat validasi

// 👇 TARUH FUNGSI AUTO-FORMAT TANGGAL DI SINI 👇
    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); 
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 6);
        if (v.length > 6) final += ' ' + v.substring(6, 8);
        if (v.length > 8) final += ':' + v.substring(8, 10);
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
        if (action === 'discharge') handleDischarge(currentRecordId, formData.name, formData.roomNumber);
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
                            <button type="button" onClick={() => onPrintLabel(formData)} className="p-1.5 bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] shadow-sm hover:bg-purple-200" title="Cetak Label Spuit (12 Pcs)">🏷️</button>
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
                            
                            {/* --- BARIS 1: KM | GENDER | NO. RM | TGL MASUK --- */}
                            <div className="flex space-x-2 mb-2 items-end">
                                <div className="w-[20%]">
                                    <CustomSelect 
                                        label="Km" 
                                        value={formData.roomNumber} 
                                        onChange={(e) => handleInputChange({ target: { name: 'roomNumber', value: e.target.value } })} 
                                        options={availableRooms} 
                                    />
                                </div>
                                <div className="w-[20%]">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Gender *</label>
                                    <select 
                                        className="w-full p-2 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 bg-white" 
                                        value={formData.gender} 
                                        onChange={(e) => handleInputChange({ target: { name: 'gender', value: e.target.value } })} 
                                        required
                                    >
                                        <option value="" disabled>-</option>
                                        <option value="L">Lk</option>
                                        <option value="P">Pr</option>
                                    </select>
                                </div>
                                <div className="w-[30%]">
                                    <CustomInput 
                                        label="No. RM" 
                                        name="rmNumber" 
                                        value={formData.rmNumber || ''} 
                                        onChange={handleInputChange} 
                                        placeholder="Cont: 123456" 
                                    />
                                </div>
                                <div className="w-[30%] mb-2">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Tgl Masuk </label>
                                    <input 
                                        type="text" 
                                        defaultValue={formatDateCM(formData.admissionDate)}
                                        onChange={handleDateMasking}
                                        onBlur={(e) => handleInputChange({ target: { name: 'admissionDate', value: parseDateCM(e.target.value) } })}
                                        className="w-full p-2 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono bg-white outline-none" 
                                        placeholder="dd/mm/yy hh:mm" 
                                    />
                                </div>
                            </div>

                            {/* --- BARIS 2: NAMA PASIEN | DPJP UTAMA --- */}
                            <div className="flex space-x-2 mb-2 items-start">
                                <div className="w-[50%] relative">
                                    <CustomInput 
                                        label="Nama Pasien *" 
                                        name="name" 
                                        value={formData.name} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                    
                                    {/* SUGGESTION LIST PASIEN LAMA */}
                                    {archivedMatches && archivedMatches.length > 0 && (
                                        <div className="absolute z-50 w-full bg-white border-2 border-indigo-500 shadow-2xl rounded-md mt-[-8px] max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                                            <div className="bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white flex justify-between items-center">
                                                <span>📂 PASIEN LAMA TERDETEKSI</span>
                                                <span className="bg-white text-indigo-600 px-1 rounded text-[8px]">ARSIP</span>
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
                                                        RM: {old.rmNumber || '-'} | {old.gender === 'L' ? 'Lk' : 'Pr'} | {old.dpjpName}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-[50%]">
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
                                                    ? new Date(log.updatedAt.seconds * 1000).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
                                                    : log.updatedAt instanceof Date 
                                                        ? log.updatedAt.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
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
  // 1. State System (VERSI BERSIH)
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null); // Tetap dipakai untuk kompatibilitas MedicalRecordApp
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  // 2. State Login Lokal & Mode
  const [currentUser, setCurrentUser] = useState(null);
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
            if (userData.pass === loginForm.pass) {
                // SUKSES!
                console.log("Login Berhasil via Firestore:", userData.name);
                setCurrentUser(userData);
                setAppMode('MEDIS');
                setUserId(userData.id); 
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

  const handleInternalLogout = () => {
      setCurrentUser(null);
      setUserId(null);
      setLoginForm({ id: '', pass: '' });
      setAppMode('MEDIS');
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
                      <p className="text-[10px] text-slate-400">&copy; 2026 SIMPAN</p>
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

// Percobaan fix PWA branding 2

export default App;