import React, { useRef, useEffect, useState, useMemo } from 'react';
import { MEDICATIONS, MEDICATION_TRANSLATOR, LAB_PATTERNS, PROCEDURES, ANTIBIOTICS_DB, LAB_NORMAL_RANGES, LAB_LOW_IS_BAD, ROOM_LIST, LAB_TUBEX_POSITIVE_THRESHOLD } from '../constants';

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
        <div className="mb-3 border p-2 rounded bg-white relative group hover:border-indigo-300 transition focus-within:z-30">
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

// --- PLANNING QUICK TAG (UPGRADED: HYBRID SMART INPUT DENGAN PAGI INI & BLPL) ---
const PlanningQuickTag = ({ onSelect }) => {
    // State untuk mengontrol Popover Jadwal
    const [activeTag, setActiveTag] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [customDate, setCustomDate] = useState('');

    const tags = [
        // LAB (Merah)
        { label: 'DR', isi: 'Lab. R/ Darah Rutin (DR)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Tubex', isi: 'Lab. R/ Tubex', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'GDS', isi: 'Lab. R/ GDS', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'GDP-2JPP', isi: 'Lab. R/ GDP-2JPP', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Ur-Cr', isi: 'Lab. R/ Ureum-Creatinin', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Ēlek', isi: 'Lab. R/ Elektrolit (Na/K/Cl)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'AU', isi: 'Lab. R/ Asam Urat', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Lipid', isi: 'Lab. R/ Profil Lipid (Kolesterol)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'OTPT', isi: 'Lab. R/ SGOT-SGPT', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'TCM', isi: 'Lab. R/ TCM TB', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Sputum', isi: 'Lab. R/ Sputum', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Urin', isi: 'Lab. R/ Urin', warna: 'bg-red-100 text-red-700 border-red-200' },

        // RAD (Biru)
        { label: 'Whole Abd', isi: 'Rad. R/ USG Whole Abdomen', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'Upper Abd', isi: 'Rad. R/ USG Hepatobilier/Upper Abdomen', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'Lower Abd', isi: 'Rad. R/ USG Lower/Ginjal Abdomen', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'CT Abd', isi: 'Rad. R/ CT Scan Abdomen kontras', warna: 'bg-blue-100 text-blue-700 border-blue-200' },

        // TERAPI (Ungu)
        { label: 'PRC', isi: 'Th. Trnfs  PRC, on ke , post ke , premed: , Postmed: ', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Nicardipin', isi: 'Th. Drip Perdipine/Nicardipine  mcg, Kec.  cc/j, Bb  kg', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Vascon', isi: 'Th. Drip vascon/Norepinephrine mcg, Kec.  cc/j, Bb  kg', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'KCL', isi: 'Th. Koreksi KCL  mEq +  500 ml/8 Jam,  siklus on ke', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'CaGluconas', isi: 'Th. Koreksi CaGluconas  gr + D5 100ml, Bolus Novorapid 10 iu + D40 2 flash', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Panto', isi: 'Th. Drip pantoprazole 8 mg/j', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Sliding Scale', isi: 'Th. Sliding Scale (SC tiap 4 jam):\n< 150 : 0 Unit\n150 - 200 : 4 Unit\n200 - 250 : 8 Unit\n250 - 300 : 12 Unit\n300 - 350 : 16 Unit\n350 - 400 : 20 Unit\n> 400 : 24 Unit', warna: 'bg-purple-100 text-purple-700 border-purple-200' },
        { label: 'Protokol GDS', isi: 'Th. Cek GDS per 2 jam:\n- Jika GDS > 200 ganti D5% 20 tpm\n- Jika dgn D5% 20 tpm GDS > 200, ganti dgn NaCl 0.9% 20 tpm', warna: 'bg-purple-100 text-purple-700 border-purple-200' },

        // TAMBAHAN (Hijau)
        { label: 'GB', isi: 'TM. Ganti Balutan', warna: 'bg-green-100 text-green-700 border-green-200' },
        { label: 'HD', isi: 'TM. Hemodialisa (HD)', warna: 'bg-green-100 text-green-700 border-green-200' },
        { label: 'Pungsi', isi: 'TM. Pungsi Ascites/Parasintesis', warna: 'bg-green-100 text-green-700 border-green-200' },

        // BLPL (Hitam)
        { label: 'BLPL', isi: 'Rencana BLPL', warna: 'bg-black text-white border-black' },

        // KONSUL (Amber/Emas)
        { label: 'Konsul', isi: 'Konsul TS ke dr. ', warna: 'bg-amber-100 text-amber-900 border-amber-400' },
        { label: 'Lapor', isi: 'Lapor (+)', warna: 'bg-amber-100 text-amber-900 border-amber-400' }
    ];

    // Fungsi Pembantu: Menghitung tanggal ke depan secara otomatis
    const getFutureDate = (daysToAdd) => {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    };

    // Fungsi 1: Menangani Klik Tag Awal (Mencegat Lab, Rad, TM, dan BLPL)
    const handleSelectTag = (tag) => {
        if (/^(Lab\.|Rad\.|TM\.)/i.test(tag.isi) || tag.label === 'BLPL') {
            setActiveTag(tag);
            setShowDatePicker(false);
            setCustomDate('');
        } else {
            // Kalau obat atau konsul langsung tulis tanpa jadwal
            onSelect(tag.isi);
        }
    };

    // Fungsi 2: Menggabungkan Jadwal dan Menulis ke Kolom Planning
    const confirmSchedule = (scheduleText) => {
        if (!activeTag) return;
        
        let finalText = activeTag.isi;
        if (scheduleText) {
            finalText = `${activeTag.isi} [${scheduleText}]`;
        } else {
            finalText = `${activeTag.isi} [   ]`; 
        }
        
        onSelect(finalText);
        setActiveTag(null); // Tutup Popover
    };

    return (
        <div className="relative mb-2">
            {/* 1. KUMPULAN TOMBOL TAG NORMAL */}
            <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectTag(tag)}
                        className={tag.label === 'BLPL'
                            ? `px-2 py-1 rounded text-[11px] font-bold border shadow-sm transition hover:opacity-80 ${tag.warna}`
                            : `px-2 py-1 border rounded text-[9px] font-bold transition shadow-sm hover:opacity-80 ${tag.warna}`
                        }
                    >
                        {tag.label}
                    </button>
                ))}
            </div>

            {/* 2. POPOVER MELAYANG (HYBRID SMART INPUT) */}
            {activeTag && (
                <div className="absolute left-0 top-full mt-2 w-full max-w-sm bg-white border border-indigo-200 rounded-xl shadow-2xl z-[150] p-3 animate-in zoom-in-95 fade-in duration-200">
                    <div className="flex justify-between items-center border-b pb-2 mb-2">
                        <span className="text-[10px] font-black text-indigo-900 uppercase">
                            🕒 Kapan <span className="text-indigo-600 bg-indigo-50 px-1 rounded">{activeTag.label}</span> dilakukan?
                        </span>
                        <button type="button" onClick={() => setActiveTag(null)} className="text-gray-400 hover:text-red-500 font-bold text-lg leading-none">×</button>
                    </div>
                    
                    {/* OPSI 2: RAPID DATE TOKENS (DIPERLUAS DENGAN PAGI INI) */}
                    <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                        <button type="button" onClick={() => confirmSchedule('Pagi Ini')} className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Pagi Ini</button>
                        <button type="button" onClick={() => confirmSchedule('Sore Ini')} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Sore Ini</button>
                        <button type="button" onClick={() => confirmSchedule('Nanti Malam')} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Nanti Malam</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                        <button type="button" onClick={() => confirmSchedule(`Besok, ${getFutureDate(1)}`)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Besok Pagi</button>
                        <button type="button" onClick={() => confirmSchedule(`Lusa, ${getFutureDate(2)}`)} className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Lusa</button>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        {/* OPSI 1: KALENDER ASLI (HTML Date Picker) */}
                        <div className="flex-1 relative">
                            {!showDatePicker ? (
                                <button type="button" onClick={() => setShowDatePicker(true)} className="w-full bg-gray-50 hover:bg-gray-200 text-gray-700 border border-gray-300 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm">
                                    📅 Pilih Kalender...
                                </button>
                            ) : (
                                <div className="flex gap-1 animate-in slide-in-from-left-2">
                                    <input 
                                        type="date" 
                                        value={customDate}
                                        onChange={(e) => setCustomDate(e.target.value)}
                                        className="w-full text-[10px] p-1.5 border border-indigo-300 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-900"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (customDate) {
                                                const [y, m, d] = customDate.split('-');
                                                // Convert format YYYY-MM-DD ke DD/MM/YY
                                                confirmSchedule(`${d}/${m}/${y.slice(-2)}`);
                                            } else {
                                                setShowDatePicker(false);
                                            }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded text-[10px] font-bold transition shadow-sm"
                                    >
                                        OK
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* OPSI 3: SMART BRACKET (Ketik Manual) */}
                        <button type="button" onClick={() => confirmSchedule('')} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white border border-slate-700 py-1.5 rounded text-[10px] font-bold transition shadow-sm">
                            ⌨️ Ketik Manual [ ]
                        </button>
                    </div>
                </div>
            )}
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

// ✨ FUNGSI ANTIBIOTIK: MAZHAB CERDAS (MENDUKUNG EJAAN INDONESIA & MULTI-USER KONTEKS)
const normalizeMedicationName = (name = '') => {
    return name.toString().toLowerCase()
        .replace(/\(.+?\)/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(?:tab|tablet|caps|kaps|kapsul|ml|mg|gr|g|mcg|iu|inj|injeksi|drip|inf|iv|im|sc|po|per|x|kali|bid|tid|q\d+h|jam)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const isAntibioticMedicationName = (name = '') => {
    const normalized = normalizeMedicationName(name);
    if (!normalized) return false;
    if (/\bH\d+\b/i.test(name)) return true;
    if (ANTIBIOTICS_DB.some(ab => normalized.includes(ab.toLowerCase()))) return true;
    return /(?:seftri|ceftri|ceftriax|seftriax|cefix|sefix|levoflo|merope|cipro|sipro|metroni|amoxi|amoksi|ampici|ampisi|genta|azithro|cefaz|sefaz|ceftaz|seftaz|sulbactam|clavulanate|linezolid|fosfomycin|vancomycin)/i.test(normalized);
};

const getAntibioticDay = (medName, medicationLogs = {}) => {
    if (!medName) return null;

    const normalizedMed = normalizeMedicationName(medName);
    if (!normalizedMed || !isAntibioticMedicationName(normalizedMed)) return null;

    let checkedDaysCount = 0;
    const safeLogs = medicationLogs || {};

    // 2. Hitung jumlah HARI BERBEDA yang memiliki minimal 1 centangan dinas
    Object.keys(safeLogs).forEach(dateStr => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

        const dayData = safeLogs[dateStr] || {};
        let hasMatch = false;

        Object.keys(dayData).forEach(key => {
            const normalizedKey = normalizeMedicationName(key);
            if (!normalizedKey) return;
            if (normalizedKey.includes(normalizedMed) || normalizedMed.includes(normalizedKey)) {
                const shiftLog = dayData[key] || {};
                const hasCheckedShift = Object.values(shiftLog).some(shift => shift && shift.checked);
                if (hasCheckedShift) hasMatch = true;
            }
        });

        if (hasMatch) checkedDaysCount++;
    });

    // 3. Tampilkan Label Hari Antibiotik
    return checkedDaysCount === 0 ? 'H1' : `H${checkedDaysCount}`;
};

// ✨ RENDERER PLANNING PRESISI: CLONE 100% DARI PRINT PREVIEW
const renderPlanningCell = (text, medicationLogs = {}) => {
    if (!text) return <span className="text-slate-400 italic text-[11px]">-</span>;

    const lines = text.split('\n');
    
    const actionBadges = []; 
    const labs = [];
    const rads = [];
    const tms = [];
    const terapis = []; // Kotak Terapi / Transfusi Khusus
    const meds = [];
    const generalNotes = [];

    // KAMUS ANTIBIOTIK
    const checkIsAntibiotic = (medName) => {
        const abList = [
            'seftri', 'ceftri', 'sefotak', 'cefotax', 'sefepim', 'cefepim', 'sefiksim', 'cefixime',
            'mero', 'meropenem', 'levo', 'levofloxacin', 'cipro', 'ciprofloxacin',
            'amikacin', 'amikasin', 'genta', 'gentamicin', 'gentamisin',
            'ampicil', 'ampisil', 'amoxicil', 'amoksisil', 'amoxan', 'amoxiclav',
            'metro', 'metronidazol', 'azithro', 'azitro', 'cotri', 'kotri',
            'clinda', 'klinda', 'vanco', 'vanko'
        ];
        const clean = medName.toLowerCase().replace(/[^a-z]/g, '');
        return abList.some(ab => clean.includes(ab));
    };

    // MESIN PENYORTIR (Memahami Singkatan Lama)
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('HEADER:')) return;
        
        const cleanLine = trimmed.replace(/^\[Hari Ini.*?\]\s*/i, '');
        const lower = cleanLine.toLowerCase();

        // 1. KATEGORI BADGE AKSI
        if (lower.match(/\b(blpl|rblpl|pulang|boleh pulang|rencana blpl)\b/)) {
            actionBadges.push({ type: 'blpl', text: cleanLine });
        } else if (lower.match(/\b(konsul|konsultasi|ts|rawat gabung|alih rawat)\b/)) {
            actionBadges.push({ type: 'konsul', text: cleanLine });
        } else if (lower.match(/\b(lapor|lapor\s*\(\+\))\b/)) {
            actionBadges.push({ type: 'lapor', text: cleanLine });
        } else if (lower.match(/\b(pindah|transfer|rujuk|pindah kamar|pindah anyelir)\b/)) {
            actionBadges.push({ type: 'pindah', text: cleanLine });
        }
        
        // 2. KATEGORI LAB, RAD, TNDKN, TERAPI (KOTAK WARNA-WARNI)
        else if (lower.includes('lab') || lower.includes('laboratorium') || cleanLine.startsWith('🔬')) {
            labs.push(cleanLine.replace(/^(🔬\s*lab:\s*|lab\.\s*r\/|lab\s*r\/|lab\.\s*:|lab\s*:)/i, '').trim());
        }
        else if (lower.includes('rad') || lower.includes('radiologi') || cleanLine.startsWith('🩻')) {
            rads.push(cleanLine.replace(/^(🩻\s*rad:\s*|rad\.\s*r\/|rad\s*r\/|rad\.\s*:|rad\s*:)/i, '').trim());
        }
        else if (lower.includes('tndkn') || lower.includes('tindakan') || lower.startsWith('tm.') || cleanLine.startsWith('💉')) {
            tms.push(cleanLine.replace(/^(💉\s*tndkn:\s*|tndkn:\s*|tndkn\.\s*:|tm\.\s*)/i, '').trim());
        }
        else if (lower.includes('terapi:') || lower.startsWith('th.') || lower.includes('trnfs') || lower.includes('transfusi')) {
            terapis.push(cleanLine.replace(/^(terapi\.\s*:|terapi:\s*|th\.\s*)/i, '').trim());
        }
        
        // 3. KATEGORI RESEP OBAT
        else if (
            cleanLine.startsWith('-') || cleanLine.startsWith('•') || 
            lower.includes('iv') || lower.includes('po') || lower.includes('p.o') || 
            lower.includes('tab') || lower.includes('inj') || lower.includes('amp') || 
            lower.includes('mg') || lower.includes('gr') || lower.includes('kcl') || lower.includes('drip')
        ) {
            const medText = cleanLine.replace(/^[-•]\s*/, '').trim();
            const isAb = checkIsAntibiotic(medText);
            meds.push({ text: medText, isAb });
        }
        
        // 4. CATATAN LAINNYA
        else {
            generalNotes.push(cleanLine);
        }
    });

    return (
        <div className="space-y-1.5 text-[11px] font-sans">
            
            {/* 1. SEKSI BADGE AKSI (MENUMPUK KE BAWAH) */}
            {actionBadges.length > 0 && (
                <div className="flex flex-col items-start gap-1 mb-1">
                    {actionBadges.map((badge, idx) => {
                        if (badge.type === 'blpl') return <div key={idx} className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase shadow-sm">🎉 {badge.text.toUpperCase()}</div>;
                        if (badge.type === 'konsul') return <div key={idx} className="bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">👨‍⚕️ {badge.text}</div>;
                        if (badge.type === 'lapor') return <div key={idx} className="bg-yellow-100 border border-yellow-300 text-yellow-900 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">👨‍⚕️ {badge.text}</div>;
                        if (badge.type === 'pindah') return <div key={idx} className="bg-indigo-100 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">🚑️ {badge.text}</div>;
                        if (badge.type === 'rujuk') return <div key={idx} className="bg-indigo-100 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">🚑️ {badge.text}</div>;
                        return null;
                    })}
                </div>
            )}

            {/* 2. CATATAN UMUM */}
            {generalNotes.length > 0 && (
                <div className="space-y-0.5 text-slate-800 font-medium mb-1">
                    {generalNotes.map((note, idx) => <div key={idx}>{note}</div>)}
                </div>
            )}

            {/* 3. KOTAK LAB (MERAH BATA) */}
            {labs.length > 0 && (
                <div className="bg-red-50 border border-red-500 rounded-lg p-1.5 shadow-sm">
                    <div className="text-red-700 font-black text-[10px] uppercase mb-0.5 flex items-center gap-1">🔬 R/LAB:</div>
                    <div className="space-y-0.5 pl-1">
                        {labs.map((item, idx) => <div key={idx} className="text-red-900 font-bold">• {item}</div>)}
                    </div>
                </div>
            )}
            
            {/* 4. KOTAK RAD (BIRU MUDA) */}
            {rads.length > 0 && (
                <div className="bg-blue-50 border border-blue-500 rounded-lg p-1.5 shadow-sm">
                    <div className="text-blue-700 font-black text-[10px] uppercase mb-0.5 flex items-center gap-1">🩻 R/RAD:</div>
                    <div className="space-y-0.5 pl-1">
                        {rads.map((item, idx) => <div key={idx} className="text-blue-900 font-bold leading-tight">• {item}</div>)}
                    </div>
                </div>
            )}
            
            {/* 5. KOTAK TNDKN (HIJAU MUDA) */}
            {tms.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-500 rounded-lg p-1.5 shadow-sm">
                    <div className="text-emerald-700 font-black text-[10px] uppercase mb-0.5 flex items-center gap-1">💉 R/TNDKN:</div>
                    <div className="space-y-0.5 pl-1">
                        {tms.map((item, idx) => <div key={idx} className="text-emerald-900 font-bold leading-tight">• {item}</div>)}
                    </div>
                </div>
            )}
            
            {/* 6. KOTAK TERAPI / TRANSFUSI (UNGU DENGAN BADGE AUTO-HITUNG SISA) */}
            {terapis.length > 0 && (
                <div className="bg-purple-50 border border-purple-500 rounded-lg p-1.5 shadow-sm">
                    <div className="text-purple-700 font-black text-[10px] uppercase mb-0.5 flex items-center gap-1">💊 On TERAPI / TRANSFUSI:</div>
                    <div className="space-y-1 pl-1">
                        {terapis.map((item, idx) => {
                            // 🧠 SENSOR HITUNG SISA KANTONG OTOMATIS
                            const trnfsMatch = item.match(/(?:trnfs|transfusi)\s+(\d+)\s+([a-zA-Z]+)(?:[,\s]+on\s*ke\s*(\d*))?(?:[,\s]+post\s*ke\s*(\d*))?(?:[,\s]+sisa\s*(\d*))?/i);
                            
                            let autoBadge = null;
                            if (trnfsMatch) {
                                const total = parseInt(trnfsMatch[1], 10) || 0;
                                const on = trnfsMatch[3] ? parseInt(trnfsMatch[3], 10) : 0;
                                const post = trnfsMatch[4] ? parseInt(trnfsMatch[4], 10) : 0;
                                
                                // Jika sudah ada teks sisa tertulis gunakan itu, jika belum hitung: Total - Post (atau Total - On)
                                let sisaKtg = trnfsMatch[5] !== undefined && trnfsMatch[5] !== '' 
                                    ? parseInt(trnfsMatch[5], 10) 
                                    : (on > 0 ? Math.max(0, total - on) : Math.max(0, total - post));

                                autoBadge = (
                                    <span className="bg-purple-200 text-purple-950 border border-purple-300 px-1.5 py-0.2 rounded text-[9px] font-black shrink-0 ml-1 shadow-sm">
                                        🩸 Sisa: {sisaKtg} labu
                                    </span>
                                );
                            }

                            return (
                                <div key={idx} className="text-purple-900 font-bold leading-tight flex items-center justify-between">
                                    <span>• {item}</span>
                                    {autoBadge}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 7. SEKSI RESEP OBAT (DI BAWAH) */}
            {meds.length > 0 && (
                <div className="pt-1 border-t border-dashed border-slate-200 mt-2">
                    <div className="inline-flex items-center gap-1 bg-red-100 border border-red-200 text-red-700 font-black px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider mb-1">
                        💊 RESEP OBAT
                    </div>
                    <div className="space-y-0.5 pl-0.5">
                        {meds.map((m, idx) => (
                            <div key={idx} className="text-slate-800 text-[11px] leading-tight flex items-center justify-between font-medium">
                                <span>- {m.text}</span>
                                {m.isAb && (
                                    <span className="bg-slate-50 text-slate-800 border border-slate-400 px-1 py-0.5 rounded text-[8px] font-mono font-black ml-1 shadow-sm flex items-center gap-1">
                                        🚨 H1
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
};

// --- Helper FormattedObjective: Pewarna Lab Otomatis Super Cerdas ---
const FormattedObjective = ({ text }) => {
    if (!text) return <span>-</span>;
    const lines = text.split('\n');

    return (
        <div className="whitespace-pre-wrap">
            {lines.map((line, idx) => {
                const trimmedLine = line.trim();
                const lowerLine = trimmedLine.toLowerCase();

                if (/^\[[A-Za-z0-9\s]+,\s*\d{1,2}\/\d{1,2}.*\]$/.test(trimmedLine)) {
                    return (
                        <div key={idx} className="text-[10px] font-extrabold text-indigo-500 border-b border-indigo-100 pb-0.5 mt-1.5 mb-1 first:mt-0">
                            🕒 {trimmedLine}
                        </div>
                    );
                }

                let abnormalType = null;
                let matchedKey = null;
                let matchedVal = null;

                for (const [key, pattern] of Object.entries(LAB_PATTERNS || {})) {
                    if (typeof pattern !== 'object' || !pattern.test) continue;
                    const match = trimmedLine.match(pattern);
                    if (match && match[1]) {
                        matchedKey = key;
                        matchedVal = match[1].trim();
                        break;
                    }
                }

                if (matchedKey) {
                    const valStr = matchedVal;
                    const lowerVal = valStr.toLowerCase();
                    
                    if (matchedKey === 'Tubex') {
                        if (lowerVal.includes('positif')) abnormalType = 'text-bad';
                        else {
                            const num = parseFloat(valStr);
                            if (!isNaN(num) && num >= LAB_TUBEX_POSITIVE_THRESHOLD) abnormalType = 'text-bad';
                        }
                    }
                    // ✨ FIX FINAL DILEMA: Prioritas kemunculan kata kunci pertama di dalam kalimat!
                    else if (/^[a-zA-Z<>]/.test(valStr) || /^(positif|negatif|reaktif|non|detected|neg|pos)/i.test(valStr)) {
                        // Regex akan menangkap kata kunci mana yang posisinya paling depan
                        const firstMatch = lowerVal.match(/\b(non[- ]?reaktif|not.?detected|negatif|neg|positif|reaktif|detected|pos)\b/);
                        if (firstMatch) {
                            const keyword = firstMatch[1];
                            if (/(non[- ]?reaktif|not.?detected|negatif|neg)/.test(keyword)) {
                                abnormalType = null; // Normal (Hijau/Hitam)
                            } else {
                                abnormalType = 'text-bad'; // Pasti Merah ⚠️
                            }
                        }
                    }
                    else {
                        const range = LAB_NORMAL_RANGES[matchedKey];
                        const num = parseFloat(valStr.replace(',', '.'));
                        if (!isNaN(num) && range) {
                            if (num > range.max) abnormalType = 'high';
                            else if (num < range.min) abnormalType = 'low';
                        }
                    }
                }

                if (!abnormalType && !matchedKey) {
                    const isDanger = /(positif|reaktif|detected|ditemukan|resistan)/i.test(lowerLine);
                    const isSafe = /(negatif|non[- ]?reaktif|not detected|tidak ditemukan)/i.test(lowerLine);
                    if (isDanger && !isSafe) abnormalType = 'text-bad';
                }

                let spanClass = "";
                let arrow = "";

                if (abnormalType === 'high') {
                    spanClass = "text-red-600 font-bold bg-red-50 px-1 rounded inline-block shadow-sm";
                    arrow = " ⬆️";
                } else if (abnormalType === 'low') {
                    spanClass = "text-blue-600 font-bold bg-blue-50 px-1 rounded inline-block shadow-sm";
                    arrow = " ⬇️";
                } else if (abnormalType === 'text-bad') {
                    spanClass = "text-red-600 font-bold bg-red-50 px-1 rounded inline-block shadow-sm";
                    arrow = " ⚠️";
                }

                return (
                    <span key={idx}>
                        <span className={spanClass}>
                            {line}{arrow}
                        </span>
                        {idx !== lines.length - 1 && <br />}
                    </span>
                );
            })}
        </div>
    );
};

// --- Helper Baru: Format Objektif dengan Balon Lacak Terintegrasi & Pewarna Lab ---
const renderObjectiveCell = (text) => {
    if (!text) return '-';
    const lines = text.split('\n');
    
    // 1. Ambil baris yang mengandung kata "Lacak", "Lapor", atau diawali dengan emoji ⚠️
    const lacakLines = lines.filter(line => {
        const trimmed = line.trim().toLowerCase();
        return trimmed.startsWith('lacak') || trimmed.startsWith('⚠️') || trimmed.includes('lacak') || trimmed.includes('lapor');
    });
    
    // 2. Ambil baris sisanya (TTV dan data objektif lainnya)
    const normalLines = lines.filter(line => {
        const trimmed = line.trim().toLowerCase();
        return !trimmed.startsWith('lacak') && !trimmed.startsWith('⚠️') && !trimmed.includes('lacak') && !trimmed.includes('lapor');
    });

    let lacakBubble = null;
    if (lacakLines.length > 0) {
        lacakBubble = (
            <div className="space-y-1 mb-1.5">
                {lacakLines.map((line, idx) => {
                    // Bersihkan prefix jika ada dobel ⚠️ atau kata LACAK/LAPOR berulang
                    const cleanText = line
                        .replace(/^⚠️\s*/, '')
                        .replace(/^lacak\/lapor:\s*/i, '')
                        .replace(/^lacak:\s*/i, '')
                        .trim();

                    return (
                        <div 
                            key={idx} 
                            className="bg-orange-100 text-orange-900 border border-orange-300 px-2 py-1.5 rounded-lg font-bold w-full shadow-sm animate-pulse flex items-center justify-between text-xs"
                        >
                            <span>⚠️ LACAK/LAPOR: {cleanText}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="text-xs text-gray-800 font-sans">
            {/* Tampilkan Balon Lacak Terlebih Dahulu Jika Ada */}
            {lacakBubble}
            
            {/* Tampilkan Sisa Teks Objektif menggunakan Mesin Pewarna Lab ✨ */}
            {normalLines.length > 0 && <FormattedObjective text={normalLines.join('\n')} />}
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

// --- HELPER: Extract lab values dari objective teks + color coding normal range ---
const getLabBadges = (objectiveText) => {
    if (!objectiveText) return [];
    const results = [];
    const SKIP_KEYS = ['Gram/Sputum', 'TCM', 'HIV', 'HBsAg', 'Anti-HCV', 'Widal', 'Kultur', 'MDT'];
    Object.keys(LAB_PATTERNS).forEach(key => {
        if (SKIP_KEYS.includes(key)) return;
        const match = objectiveText.match(LAB_PATTERNS[key]);
        if (match && match[1]) {
            const valStr = match[1].trim().replace(',', '.');
            const info = getLabInfo(key, valStr);
            results.push({ key, val: valStr, color: info.colorClass || 'text-gray-700' });
        }
    });
    return results;
};

// ✨ PUSAT OTAK PEWARNAAN & INDIKATOR LAB UNIVERSAL
export const getLabInfo = (key, val) => {
    if (!val) return { indicator: '', colorClass: 'text-slate-700' };
    
    if (key === 'Tubex') {
        const lowerVal = val.toLowerCase();
        if (lowerVal.includes('positif')) {
            return { indicator: '⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
        }
        const num = parseFloat(val);
        if (!isNaN(num) && num >= LAB_TUBEX_POSITIVE_THRESHOLD) {
            return { indicator: '⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
        }
        return { indicator: '', colorClass: 'text-green-600 font-semibold' };
    }

    const isQualitative = /^[a-zA-Z<>]/.test(val) || /^(positif|negatif|reaktif|non|detected|neg|pos)/i.test(val);

    if (isQualitative) {
        const lowerVal = val.toLowerCase();
        
        // ✨ FIX FINAL DILEMA: Siapa cepat, dia dapat!
        const firstMatch = lowerVal.match(/\b(non[- ]?reaktif|not.?detected|negatif|neg|positif|reaktif|detected|pos)\b/);
        
        if (firstMatch) {
            const keyword = firstMatch[1];
            if (/(non[- ]?reaktif|not.?detected|negatif|neg)/.test(keyword)) {
                return { indicator: '', colorClass: 'text-green-600 font-semibold' }; // Aman!
            } else {
                return { indicator: '⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' }; // Bahaya!
            }
        }
        return { indicator: '', colorClass: 'text-slate-600' };
    }

    const range = LAB_NORMAL_RANGES[key];
    if (!range) return { indicator: '', colorClass: 'text-slate-700' };
    const num = parseFloat(val);
    if (isNaN(num)) return { indicator: '', colorClass: 'text-slate-700' };

    if (num < range.min) {
        if (LAB_LOW_IS_BAD.includes(key)) {
            return { indicator: '↓ ⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
        }
        return { indicator: '↓', colorClass: 'text-blue-600 font-bold bg-blue-50 px-1 rounded' };
    }
    if (num > range.max) {
        return { indicator: '↑ ⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
    }
    return { indicator: '', colorClass: 'text-green-600 font-semibold' };
};

// =====================================================================
// ✨ TABEL LAB MULTI-DATE: Ekstrak snapshot nilai lab dari teks objective.
// Dipakai saat save untuk mengupdate field labHistory di dokumen utama,
// sehingga Ontang-anting bisa tampilkan tabel multi-kolom tanggal
// TANPA query subcollection tambahan.
// =====================================================================
const extractLabSnapshot = (objectiveText) => {
    if (!objectiveText) return {};
    const values = {};
    Object.keys(LAB_PATTERNS).forEach(key => {        
        const match = objectiveText.match(LAB_PATTERNS[key]);
        if (match && match[1]) {
            values[key] = match[1].trim().replace(',', '.');
        }
    });
    return values;
};

// --- HELPER: Ekstrak tag [Nama, Tgl Jam] & marker kolaborator ↔ [Nama] di akhir ---
const extractLineTags = (line) => {
    let content = line;
    let author = null;
    let timestamp = null; // ✨ MESIN RADAR WAKTU
    const collaborators = [];

    // Murni hanya membaca Tag Baru (inline mode): [Abi, 15/06/26 10:04]
    const newTagMatch = content.match(/^\[([A-Za-z0-9\s]+),\s*(\d{1,2}\/\d{1,2}[^\]]*)\]\s*/);
    if (newTagMatch) {
        author = newTagMatch[1].trim();
        timestamp = newTagMatch[2].trim(); // Tangkap tanggalnya!
        content = content.slice(newTagMatch[0].length);
    }

    // Murni hanya membaca Marker Kolaborator Baru: [Nama]↔
    content = content.replace(/\s*\[([^\]]+)\]↔/g, (_, name) => { 
        collaborators.push(name); 
        return ''; 
    });

    return { author, timestamp, collaborators, content: content.trim() };
};

const parsePlanning = (text) => {
    if (!text) return { labs: [], rads: [], tms: [], rxs: [], others: [], itemAuthors: {}, itemTimestamps: {} };

    const lines = text.split('\n').filter(line => line.trim() !== '');
    const res = { labs: [], rads: [], tms: [], rxs: [], others: [], itemAuthors: {}, itemTimestamps: {} };

    const addItem = (category, rawContent, prefixRegex, authors, timestamp) => {
        const itemText = rawContent.replace(prefixRegex, '').trim();
        if (!itemText) return;
        if (!res[category].includes(itemText)) res[category].push(itemText);
        if (authors.length > 0) {
            const existing = res.itemAuthors[itemText] || [];
            res.itemAuthors[itemText] = Array.from(new Set([...existing, ...authors]));
        }
        if (timestamp) {
            res.itemTimestamps[itemText] = timestamp; // Rekam jejak waktunya
        }
    };

    let currentBlockAuthor = null;
    let currentBlockTimestamp = null; // ✨ MESIN RADAR WAKTU

    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Tangkap Header Murni
        const pureHeaderMatch = trimmed.match(/^\[([A-Za-z0-9\s]+),\s*(\d{1,2}\/\d{1,2}.*?)\]$/);
        if (pureHeaderMatch) {
            currentBlockAuthor = pureHeaderMatch[1].trim();
            currentBlockTimestamp = pureHeaderMatch[2].trim();
            res.others.push(`HEADER:${trimmed}`);
            return;
        }

        const { author, timestamp, collaborators, content } = extractLineTags(trimmed);
        const effectiveAuthor = author || currentBlockAuthor;
        const effectiveTimestamp = timestamp || currentBlockTimestamp;
        const authors = [effectiveAuthor, ...collaborators].filter(Boolean);

        const lower = content.toLowerCase();
        if (lower.startsWith('lab. r/')) addItem('labs', content, /^Lab\.\s*R\/\s*/i, authors, effectiveTimestamp);
        else if (lower.startsWith('rad. r/')) addItem('rads', content, /^Rad\.\s*R\/\s*/i, authors, effectiveTimestamp);
        else if (lower.startsWith('tm.')) addItem('tms', content, /^TM\.\s*/i, authors, effectiveTimestamp);
        else if (lower.startsWith('th.')) addItem('rxs', content, /^Th\.\s*/i, authors, effectiveTimestamp);
        else if (content) {
            res.others.push(content);
            if (effectiveTimestamp) res.itemTimestamps[content] = effectiveTimestamp;
        }
    });
    return res;
};

// --- HELPER: LOGIKA SALAM DOKTER (TOLERANSI) ---
const getDoctorGreeting = (drName) => {
    const name = (drName || '').toLowerCase();
    
    // Daftar Dokter Non-Muslim (Akan menggunakan Selamat Pagi/Siang/Sore/Malam)
    const nonMuslimDoctors = [
        'dian ekowati', 
        'martin', 
        'irwan',
        'synthia'
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

// ✨ FUNGSI LAPORAN SHIFT: PERHITUNGAN AKURAT PASIEN PULANG, PINDAH, MENINGGAL, BARU & BLPL HARI INI
const generateShiftReport = (activeRecords = [], archivedRecords = [], waitingList = [], dpjpProfiles = [], wardName = 'Melati', roomList = []) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // 1. Logika Shift (Pagi, Siang, Malam)
    const hours = now.getHours();
    let shift = 'Pagi'; 
    if (hours >= 15 && hours < 22) shift = 'Siang';
    else if (hours >= 22 || hours < 9) shift = 'Malam';

    const snow = '❄️'; const rs = '🏥'; const woman = '👩🏼'; const man = '👨';

    // 2. Denah Kamar & Kapasitas Bangsal
    const currentRooms = roomList && roomList.length > 0 ? roomList : ROOM_LIST;
    const totalBed = currentRooms.length;
    
    let isoRooms = [];
    if (wardName.toLowerCase().includes('melati')) isoRooms = ['K14', 'K15P', 'K15KM'];
    else if (wardName.toLowerCase().includes('teratai')) isoRooms = ['K7A', 'K7B'];
    else if (wardName.toLowerCase().includes('anyelir')) isoRooms = ['ISO-A', 'ISO-B'];
    else if (wardName.toLowerCase().includes('anggrek')) isoRooms = ['ISO-A', 'ISO-B'];

    const activeCount = activeRecords.length;
    const occupiedRooms = activeRecords.map(r => r.roomNumber);

    let emptyCount = 0; let emptyMale = 0; let emptyFemale = 0;
    let emptyIso = 0; let emptyIsoMale = 0; let emptyIsoFemale = 0;

    currentRooms.forEach(room => {
        if (!occupiedRooms.includes(room)) {
            const isIso = isoRooms.includes(room);
            const match = room.match(/^(K\d+)(P|KM)$/);

            if (isIso) {
                if (!match) {
                    emptyIso++;
                } else {
                    const roomCode = match[1];
                    const bedCode = match[2];
                    const neighborBed = bedCode === 'P' ? 'KM' : 'P';
                    const neighborRoom = `${roomCode}${neighborBed}`;
                    const neighborRec = activeRecords.find(r => r.roomNumber === neighborRoom);

                    if (!neighborRec) emptyIso++;
                    else if (neighborRec.gender === 'L') emptyIsoMale++;
                    else emptyIsoFemale++;
                }
            } else {
                if (!match) {
                    emptyCount++;
                } else {
                    const roomCode = match[1];
                    const bedCode = match[2];
                    const neighborBed = bedCode === 'P' ? 'KM' : 'P';
                    const neighborRoom = `${roomCode}${neighborBed}`;
                    const neighborRec = activeRecords.find(r => r.roomNumber === neighborRoom);

                    if (!neighborRec) emptyCount++;
                    else if (neighborRec.gender === 'L') emptyMale++;
                    else emptyFemale++;
                }
            }
        }
    });

    // 3. Sensor Penentu Hari Ini (Mulai Pukul 00:00:00 WIB)
    const startOfToday = new Date(); 
    startOfToday.setHours(0, 0, 0, 0);

    const getSafeDate = (val) => {
        if (!val) return new Date(0);
        return typeof val.toDate === 'function' ? val.toDate() : new Date(val);
    };

    // 4. Hitung Pasien KRS Hari Ini (Dari archivedRecords)
    const todayDischarged = (archivedRecords || []).filter(r => {
        const checkDate = r.dischargeDate || r.updatedAt;
        return getSafeDate(checkDate) >= startOfToday;
    });

    const pulangCount = todayDischarged.filter(r => (r.dischargeType || '').toLowerCase() === 'pulang' || !r.dischargeType).length;
    const pindahCount = todayDischarged.filter(r => (r.dischargeType || '').toLowerCase() === 'pindah').length;
    const meninggalCount = todayDischarged.filter(r => (r.dischargeType || '').toLowerCase() === 'meninggal').length;

    // 5. Hitung Pasien Baru Masuk Hari Ini (Dari activeRecords)
    const newPatientCount = (activeRecords || []).filter(r => {
        const isAdmToday = r.admissionDate && getSafeDate(r.admissionDate) >= startOfToday;
        const isCrtToday = r.createdAt && getSafeDate(r.createdAt) >= startOfToday;
        return isAdmToday || isCrtToday;
    }).length;

    // 6. Hitung Pasien Rencana Pulang (BLPL) HARI INI SAJA
    // Memindai kolom P (Planning) pasien aktif yang berisi kata kunci BLPL, dan mengecualikan jika tertulis Besok / Lusa
    const blplCount = (activeRecords || []).filter(r => {
        const p = (r.planning || '').toLowerCase();
        const hasBlplKeyword = /\b(blpl|rblpl|boleh pulang|rencana blpl|rencana pulang)\b/i.test(p);
        if (!hasBlplKeyword) return false;

        const blplLines = p.split('\n').filter(line => /\b(blpl|rblpl|boleh pulang|rencana blpl|rencana pulang)\b/i.test(line));

        return blplLines.some(line => {
            const isFuture = /\b(besok|bsk|lusa|minggu depan)\b/i.test(line) || /\[(?:besok|lusa|\d{1,2}\/\d{1,2})/i.test(line);
            return !isFuture;
        });
    }).length;

    // 7. Hitung Beban DPJP
    const dpjpCounts = {};
    activeRecords.forEach(r => {
        if (r.dpjpName) dpjpCounts[r.dpjpName] = (dpjpCounts[r.dpjpName] || 0) + 1;
    });

    const dpjpStats = Object.keys(dpjpCounts).length > 0
        ? Object.entries(dpjpCounts).sort((a, b) => {
            const priorityDocs = [
                "dr. Delvi, Sp.PD", 
                "dr. Dian Ekowati, Sp.PD",           
                "dr. Priyo, Sp.PD", 
                "dr. Risa, Sp.PD",
                "dr. Evan, Sp.P"
            ];
            const idxA = priorityDocs.indexOf(a[0]);
            const idxB = priorityDocs.indexOf(b[0]);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a[0].localeCompare(b[0]);
        }).map(([name, count]) => `• ${name} : ${count} pasien`).join('\n')
        : '-';

    // 8. Rawat Bersama (Raber) Tanpa Dr. Edi
    const raberMap = {};
    activeRecords.forEach(r => {
        [r.raberName, r.raber2Name].forEach(dr => {
            if (dr) {
                if (dr.toLowerCase().includes('edi')) return;
                if (!raberMap[dr]) raberMap[dr] = [];
                if (!raberMap[dr].includes(r.name)) raberMap[dr].push(r.name);
            }
        });
    });

    const raberText = Object.keys(raberMap).length > 0
        ? Object.entries(raberMap).map(([dr, pts]) => `• ${dr} : ${pts.length} pasien (${pts.join(', ')})`).join('\n')
        : '-';

    // 9. Pasien DHF / Dengue
    const dhfList = activeRecords.filter(r => {
        const textScan = `${r.diagnosis || ''} ${r.analysis || ''} ${r.planning || ''}`.toUpperCase();
        return textScan.includes('DHF') || textScan.includes('DENGUE');
    });
    const dhfPatients = dhfList.length > 0
        ? dhfList.map(r => `- K.${r.roomNumber} a.n ${r.name} (${r.dpjpName})`).join('\n')
        : '-';

    // 10. Daftar Antrean / Pesanan Kamar (Hanya Nama & Asal Ruangan)
    const constPesanan = waitingList ? waitingList.filter(w => !w.isDischarged) : [];
    const pesananText = constPesanan.length > 0
        ? constPesanan.map(w => `- ${w.name} (${w.originRoom || 'IGD'})`).join('\n')
        : '-';

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
${raberText}

*Pasien DHF*:
${dhfPatients}

*Pesanan*:
${pesananText}

*Sampah* : _Clear_

*Perawat jaga* :  orang

Wassalamu'alaikum Wr. Wb`;

    return encodeURIComponent(text);
};

// 🩸 MESIN HITUNG OTOMATIS KANTONG TRANSFUSI SAAT TTD BDRS
export const updateTransfusionText = (planningText = '', actionName = '') => {
    if (!planningText) return planningText;

    const lines = planningText.split('\n');
    let isModified = false;

    const updatedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!/trnfs|transfusi/i.test(trimmed)) return line;

        // Tangkap format: Th. Trnfs 4 PRC, on ke 3, post ke 2, premed: ..., Postmed: ...
        const match = trimmed.match(/(?:th\.\s*)?(?:trnfs|transfusi)\s+(\d+)\s+([a-zA-Z]+)(?:[,\s]+on\s*ke\s*(\d*))?(?:[,\s]+post\s*ke\s*(\d*))?(?:[,\s]+sisa\s*(\d*))?(.*)/i);
        
        if (match) {
            isModified = true;
            const totalBag = parseInt(match[1], 10) || 1;
            const bloodType = match[2].toUpperCase(); // PRC / WB / TC / FFP
            
            // Baca posisi saat ini
            let currentPost = match[4] && match[4].trim() !== '' ? parseInt(match[4], 10) : 0;
            let currentOn = match[3] && match[3].trim() !== '' ? parseInt(match[3], 10) : (currentPost + 1);

            // Majukan hitungan saat TTD kantong baru
            const newPost = currentOn <= totalBag ? currentOn : currentPost + 1;
            const newOn = newPost < totalBag ? newPost + 1 : totalBag;
            const newSisa = Math.max(0, totalBag - newPost);

            const extraNotes = (match[6] || '').trim(); // Pertahankan catatan premed/postmed jika ada

            return `Th. Trnfs ${totalBag} ${bloodType}, on ke ${newOn}, post ke ${newPost}, sisa ${newSisa}${extraNotes ? ' ' + extraNotes : ''}`;
        }
        return line;
    });

    return isModified ? updatedLines.join('\n') : planningText;
};

export { CustomInput, CustomTextArea, CustomSelect, TagSelector, FormattedObjective, PlanningQuickTag,
    formatDateCM, parseDateCM, hitungHariCM,
    isAntibioticMedicationName, getAntibioticDay,
    renderPlanningCell, renderObjectiveCell, renderLacakTtv,
    getLabBadges, extractLabSnapshot, parsePlanning,
    getDoctorGreeting, generateShiftReport,};