import React, { useRef, useEffect, useState, useMemo } from 'react';
import { MEDICATIONS, MEDICATION_TRANSLATOR, LAB_PATTERNS, PROCEDURES, ANTIBIOTICS_DB, LAB_NORMAL_RANGES, ROOM_LIST } from '../constants';

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

// --- PLANNING QUICK TAG (UPGRADED: HYBRID SMART INPUT) ---
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

    // Fungsi 1: Menangani Klik Tag Awal
    const handleSelectTag = (tag) => {
        // Cek pakai regex: Jika ini penunjang (Lab, Rad, TM), cegat dan buka Popover Jadwal!
        if (/^(Lab\.|Rad\.|TM\.)/i.test(tag.isi)) {
            setActiveTag(tag);
            setShowDatePicker(false);
            setCustomDate('');
        } else {
            // Kalau obat, konsul, atau BLPL, langsung tulis tanpa jadwal
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
            // Opsi Ketik Manual (Kurung Siku Kosong)
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
                    
                    {/* OPSI 2: RAPID DATE TOKENS (Paling Sering Dipakai) */}
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                        <button type="button" onClick={() => confirmSchedule('Sore Ini')} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Sore Ini</button>
                        <button type="button" onClick={() => confirmSchedule('Nanti Malam')} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-1.5 rounded text-[10px] font-bold transition shadow-sm">Nanti Malam</button>
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

const renderPlanningCell = (text, medicationLogs = {}) => {
    if (!text) return '-';
    
    const { labs, rads, tms, rxs, others, itemAuthors } = parsePlanning(text);
    
    const renderItem = (title, items, bgClass, borderClass, textClass, isRx = false) => {
        if (items.length === 0) return null;

        return (
            <div key={title} className={`block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm ${bgClass} ${borderClass} ${textClass}`}>
                <span className="mr-1 uppercase">{title}:</span>
                {items.map((item, idx) => {
                    const authors = itemAuthors[item] || [];
                    
                    let abBadge = null;
                    if (isRx) {
                        const cleanMedName = item.split(/[\(\d]/)[0].trim().replace(/\s+(iv|im|sc|po|drip)$/i, '');
                        let hCode = null;
                        if (typeof getAntibioticDay === 'function') {
                            hCode = getAntibioticDay(cleanMedName, medicationLogs);
                        }
                        if (!hCode && typeof isAntibioticMedicationName === 'function' && isAntibioticMedicationName(cleanMedName)) {
                            hCode = 'H1';
                        }
                        if (hCode) {
                            abBadge = <span className="ml-1 text-[9px] bg-rose-100 text-rose-700 px-1 py-[1px] rounded border border-rose-200 font-bold shadow-sm animate-pulse">🚨 {hCode}</span>;
                        }
                    }

                    return (
                        <span key={item}>
                            {idx > 0 && '; '}
                            {item}
                            {abBadge}
                            {/* Balon nama HANYA MUNCUL jika diedit > 1 orang (Saling mengingatkan) */}
                            {authors.length > 1 && (
                                <span className="ml-1 font-normal text-[9px] opacity-70 normal-case">
                                    ({authors.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' & ')})
                                </span>
                            )}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-1">
            {renderItem('Lab', labs, 'bg-red-100', 'border-red-300', 'text-red-500 animate-pulse')}
            {renderItem('Rad', rads, 'bg-blue-100', 'border-blue-400', 'text-blue-500')}
            {renderItem('Tndkn', tms, 'bg-emerald-100', 'border-emerald-400', 'text-emerald-500')}
            {renderItem('Terapi', rxs, 'bg-fuchsia-200', 'border-fuchsia-400', 'text-fuchsia-500', true)}
            
            {others.map((line, idx) => {
                if (line.startsWith('HEADER:')) {
                    const headerText = line.replace('HEADER:', '');
                    return (
                        <div key={`other-${idx}`} className="block mb-1 text-[10px] font-extrabold text-indigo-500 border-b border-indigo-100 pb-0.5 mt-2 first:mt-0">
                            🕒 {headerText}
                        </div>
                    );
                }

                const lower = line.toLowerCase();
                if (lower.match(/\b(blpl|rblpl|pulang|boleh pulang)\b/)) {
                    return <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm bg-black text-white">🎉 {line.toUpperCase()}</div>;
                }
                if (lower.match(/\b(lapor|konsul|konsultasi|ts|rawat gabung|alih rawat)\b/)) {
                    return <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm bg-amber-100 border-amber-400 text-amber-900">👨‍⚕️ {line}</div>;
                }
                if (lower.match(/\b(pindah|transfer|rujuk|pindah kamar)\b/)) {
                    return <div key={`other-${idx}`} className="block mb-1 px-2 py-1 rounded w-fit max-w-full text-[11px] font-bold border shadow-sm bg-indigo-100 border-indigo-400 text-indigo-900">🏥 {line}</div>;
                }
                
                // ✨ Deteksi antibiotik di kategori lain untuk menampilkan badge H
                let abBadge = null;
                if (typeof isAntibioticMedicationName === 'function' && isAntibioticMedicationName(line)) {
                    let hCode = null;
                    if (typeof getAntibioticDay === 'function') {
                        hCode = getAntibioticDay(line, medicationLogs);
                    }
                    if (!hCode) {
                        hCode = 'H1';
                    }
                    if (hCode) {
                        abBadge = <span className="ml-1 text-[9px] bg-rose-100 text-rose-700 px-1 py-[1px] rounded border border-rose-200 font-bold shadow-sm animate-pulse">🚨 {hCode}</span>;
                    }
                }
                
                return (
                    <div key={`other-${idx}`} className="text-xs text-gray-700 whitespace-pre-wrap flex items-center flex-wrap">
                        <span>{line}</span>
                        {abBadge}
                    </div>
                );
            })}
        </div>
    );
};

// --- Helper FormattedObjective: Pewarna Lab Otomatis ---
const FormattedObjective = ({ text }) => {
    if (!text) return <span>-</span>;

    const lines = text.split('\n');

    return (
        <div className="whitespace-pre-wrap">
            {lines.map((line, idx) => {
                const trimmedLine = line.trim();
                const lowerLine = trimmedLine.toLowerCase();

                // Lindungi header waktu agar terukis rapi
                if (/^\[[A-Za-z0-9\s]+,\s*\d{1,2}\/\d{1,2}.*\]$/.test(trimmedLine)) {
                    return (
                        <div key={idx} className="text-[10px] font-extrabold text-indigo-500 border-b border-indigo-100 pb-0.5 mt-1.5 mb-1 first:mt-0">
                            🕒 {trimmedLine}
                        </div>
                    );
                }

                let abnormalType = null;

                for (const [key, pattern] of Object.entries(LAB_PATTERNS || {})) {
                    if (typeof pattern !== 'object' || !pattern.test) continue;
                    const match = trimmedLine.match(pattern);
                    if (match && match[1]) {
                        const valStr = match[1].trim();
                        const range = LAB_NORMAL_RANGES[key];
                        const num = parseFloat(valStr.replace(',', '.'));
                        if (!isNaN(num) && range) {
                            if (num > range.max) abnormalType = 'high';
                            else if (num < range.min) abnormalType = 'low';
                            break;
                        }
                    }
                }

                if (!abnormalType) {
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
    
    // 1. Ambil baris yang mengandung kata "Lacak" (Case-Insensitive)
    const lacakLines = lines.filter(line => line.trim().toLowerCase().startsWith('lacak'));
    
    // 2. Ambil baris sisanya (TTV dan data objektif lainnya)
    const normalLines = lines.filter(line => !line.trim().toLowerCase().startsWith('lacak'));

    let lacakBubble = null;
    if (lacakLines.length > 0) {
        // Ekstrak nama pemeriksaannya saja
        const items = lacakLines.map(line => {
            return line
                .replace(/lacak\/lapor\s*/i, '') // Hapus Lacak/Lapor
                .replace(/lacak\s*/i, '')       // Hapus Lacak
                .trim();
        });

        const combinedItems = items.join(', ');

        lacakBubble = (
            <div className="bg-orange-100 text-orange-900 border border-orange-300 px-2 py-1.5 rounded-lg mb-2 font-bold inline-block w-full shadow-sm animate-pulse">
                <span className="mr-1">⚠️</span> LACAK/LAPOR: {combinedItems}
            </div>
        );
    }

    return (
        <div className="text-xs text-gray-800 font-sans">
            {/* Tampilkan Balon Lacak Terlebih Dahulu Jika Ada */}
            {lacakBubble}
            
            {/* Tampilkan Sisa Teks Objektif menggunakan Mesin Pewarna Lab ✨ */}
            <FormattedObjective text={normalLines.join('\n')} />
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
            const num = parseFloat(valStr);
            const range = LAB_NORMAL_RANGES[key];
            let color = 'text-gray-500';
            if (!isNaN(num) && range) {
                if (num > range.max) color = 'text-red-600 font-bold';
                else if (num < range.min) color = 'text-blue-600 font-bold';
                else color = 'text-gray-700';
            }
            results.push({ key, val: valStr, color });
        }
    });
    return results;
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
        if (key === 'Gram/Sputum') return; // skip multi-line
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
    const collaborators = [];

    // Murni hanya membaca Tag Baru (inline mode): [Abi, 15/06/26 10:04]
    const newTagMatch = content.match(/^\[([A-Za-z0-9\s]+),\s*\d{1,2}\/\d{1,2}[^\]]*\]\s*/);
    if (newTagMatch) {
        author = newTagMatch[1].trim();
        content = content.slice(newTagMatch[0].length);
    }

    // Murni hanya membaca Marker Kolaborator Baru: [Nama]↔
    content = content.replace(/\s*\[([^\]]+)\]↔/g, (_, name) => { 
        collaborators.push(name); 
        return ''; 
    });

    return { author, collaborators, content: content.trim() };
};

const parsePlanning = (text) => {
    if (!text) return { labs: [], rads: [], tms: [], rxs: [], others: [], itemAuthors: {} };

    const lines = text.split('\n').filter(line => line.trim() !== '');
    const res = { labs: [], rads: [], tms: [], rxs: [], others: [], itemAuthors: {} };

    const addItem = (category, rawContent, prefixRegex, authors) => {
        const itemText = rawContent.replace(prefixRegex, '').trim();
        if (!itemText) return;
        if (!res[category].includes(itemText)) res[category].push(itemText);
        if (authors.length > 0) {
            const existing = res.itemAuthors[itemText] || [];
            res.itemAuthors[itemText] = Array.from(new Set([...existing, ...authors]));
        }
    };

    let currentBlockAuthor = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Tangkap Header Murni
        const pureHeaderMatch = trimmed.match(/^\[([A-Za-z0-9\s]+),\s*\d{1,2}\/\d{1,2}.*?\]$/);
        if (pureHeaderMatch) {
            currentBlockAuthor = pureHeaderMatch[1].trim();
            res.others.push(`HEADER:${trimmed}`);
            return;
        }

        const { author, collaborators, content } = extractLineTags(trimmed);
        const effectiveAuthor = author || currentBlockAuthor;
        const authors = [effectiveAuthor, ...collaborators].filter(Boolean);

        const lower = content.toLowerCase();
        // Regex super aman agar tidak memotong isi teks
        if (lower.startsWith('lab. r/')) addItem('labs', content, /^Lab\.\s*R\/\s*/i, authors);
        else if (lower.startsWith('rad. r/')) addItem('rads', content, /^Rad\.\s*R\/\s*/i, authors);
        else if (lower.startsWith('tm.')) addItem('tms', content, /^TM\.\s*/i, authors);
        else if (lower.startsWith('th.')) addItem('rxs', content, /^Th\.\s*/i, authors);
        else if (content) res.others.push(content);
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

// ✨ FUNGSI LAPORAN SHIFT: SEKARANG 100% DINAMIS MULTI-BANGSAL
const generateShiftReport = (activeRecords, records, waitingList, dpjpProfiles, wardName = 'Melati', roomList = []) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // ✨ LOGIKA SHIFT DENGAN TOLERANSI 1 JAM
    const hours = now.getHours();
    let shift = 'Pagi'; 

    // Jika jam 15:00 s/d 21:59 -> Shift Siang
    if (hours >= 15 && hours < 22) shift = 'Siang';
    // Jika jam 22:00 s/d 08:59 -> Shift Malam
    else if (hours >= 22 || hours < 9) shift = 'Malam';
    // Jika di luar itu (09:00 - 14:59) -> Shift Pagi (Default)

    const snow = '❄️'; const rs = '🏥'; const woman = '👩🏼'; const man = '👨';

    // ✨ FIX MULTI-BANGSAL: Pakai roomList aktif (Dahlia/Melati), jika kosong baru pakai ROOM_LIST lama
    const currentRooms = roomList && roomList.length > 0 ? roomList : ROOM_LIST;
    const totalBed = currentRooms.length;
    
    // ✨ FIX ISOLASI: Multi-Bangsal (Disesuaikan dengan format P, KM, & Murni Kamar Melati)
    let isoRooms = [];
    if (wardName.toLowerCase().includes('melati')) isoRooms = ['K14', 'K15P', 'K15KM']; // ✨ K14 murni, K15 pakai P & KM
    else if (wardName.toLowerCase().includes('teratai')) isoRooms = ['K7A', 'K7B'];
    else if (wardName.toLowerCase().includes('anyelir')) isoRooms = ['ISO-A', 'ISO-B'];
    else if (wardName.toLowerCase().includes('anggrek')) isoRooms = ['ISO-A', 'ISO-B'];

    const activeCount = activeRecords.length;
    const occupiedRooms = activeRecords.map(r => r.roomNumber);

    let emptyCount = 0; let emptyMale = 0; let emptyFemale = 0;
    let emptyIso = 0; let emptyIsoMale = 0; let emptyIsoFemale = 0;

    // ✨ HITUNG BEBAN BED KOSONG SECARA PRESISI (FORMAT BARU)
    currentRooms.forEach(room => {
        if (!occupiedRooms.includes(room)) {
            const isIso = isoRooms.includes(room);
            // 🔍 REGEX BARU: Menerawang akhiran P atau KM, jika tidak ada berarti kamar murni/sendiri
            const match = room.match(/^(K\d+)(P|KM)$/);

            if (isIso) {
                if (!match) {
                    emptyIso++; // Masuk sini jika K14 murni kosong
                } else {
                    const roomCode = match[1];
                    const bedCode = match[2];
                    const neighborBed = bedCode === 'P' ? 'KM' : 'P'; // Saklar tukar P ↔ KM
                    const neighborRoom = `${roomCode}${neighborBed}`;
                    const neighborRec = activeRecords.find(r => r.roomNumber === neighborRoom);

                    if (!neighborRec) {
                        emptyIso++;
                    } else if (neighborRec.gender === 'L') {
                        emptyIsoMale++;
                    } else {
                        emptyIsoFemale++;
                    }
                }
            } else {
                // Kamar Umum Tanpa Suffix (Sifat Kamar Tunggal murni tanpa akhiran)
                if (!match) {
                    emptyCount++;
                } else {
                    // Kamar Umum Dengan Suffix P/KM (Sifat Kamar Berpasangan Melati)
                    const roomCode = match[1];
                    const bedCode = match[2];
                    const neighborBed = bedCode === 'P' ? 'KM' : 'P'; // Saklar tukar P ↔ KM
                    const neighborRoom = `${roomCode}${neighborBed}`;
                    const neighborRec = activeRecords.find(r => r.roomNumber === neighborRoom);

                    if (!neighborRec) {
                        emptyCount++;
                    } else if (neighborRec.gender === 'L') {
                        emptyMale++;
                    } else {
                        emptyFemale++;
                    }
                }
            }
        }
    });

    // --- HITUNG INDIKATOR MUTASI PASIEN HARI INI ---
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    
    // ✨ FIX BUG TANGGAL: Helper aman untuk membaca tanggal dari Firebase maupun lokal
    const getSafeDate = (val) => {
        if (!val) return new Date(0);
        return typeof val.toDate === 'function' ? val.toDate() : new Date(val);
    };

    const todayRecords = records.filter(r => r.updatedAt && getSafeDate(r.updatedAt) >= startOfToday);

    const pulangCount = todayRecords.filter(r => r.isDischarged && r.dischargeType === 'pulang').length;
    const blplCount = activeRecords.filter(r => r.statusBolehPulang).length;
    const pindahCount = todayRecords.filter(r => r.isDischarged && r.dischargeType === 'pindah').length;
    const meninggalCount = todayRecords.filter(r => r.isDischarged && r.dischargeType === 'meninggal').length;
    const newPatientCount = activeRecords.filter(r => r.createdAt && getSafeDate(r.createdAt) >= startOfToday).length;

    // --- HITUNG STATISTIK BEBAN DPJP (URUTAN PRIORITAS MELATI) ---
    const dpjpCounts = {};
    activeRecords.forEach(r => {
        if (r.dpjpName) dpjpCounts[r.dpjpName] = (dpjpCounts[r.dpjpName] || 0) + 1;
    });

    const dpjpStats = Object.keys(dpjpCounts).length > 0
        ? Object.entries(dpjpCounts).sort((a, b) => {
            // Master urutan dokter prioritas tetap Melati (dr. Susilo sudah dihapus)
            const priorityDocs = [
                "dr. Delvi, Sp.PD", 
                "dr. Dian Ekowati, Sp.PD",           
                "dr. Priyo, Sp.PD", 
                "dr. Risa, Sp.PD",
                "dr. Evan, Sp.P"
            ];
            
            // a[0] dan b[0] adalah string Nama Dokter
            const idxA = priorityDocs.indexOf(a[0]);
            const idxB = priorityDocs.indexOf(b[0]);
            
            if (idxA !== -1 && idxB !== -1) return idxA - idxB; // Urutkan sesama dokter utama
            if (idxA !== -1) return -1; // Naikkan dokter utama ke atas
            if (idxB !== -1) return 1;  // Naikkan dokter utama ke atas
            return a[0].localeCompare(b[0]); // Sisa dokter konsul lainnya diurutkan A-Z biasa
        }).map(([name, count]) => `• ${name} : ${count} pasien`).join('\n') // Menggunakan Bullet Point '•' sesuai format wa-mu
        : '-';

    // --- HITUNG STATISTIK RAWAT BERSAMA (RABER) & SENSOR OTOMATIS dr. EDI ---
    const raberMap = {};
    const hariIniLapor = now.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

    activeRecords.forEach(r => {
        // 1. Raber manual bawaan form
        [r.raberName, r.raber2Name].forEach(dr => {
            if (dr) {
                if (!raberMap[dr]) raberMap[dr] = [];
                // Mencegah duplikasi nama jika perawat nulis dr. Edi manual
                if (!raberMap[dr].includes(r.name)) raberMap[dr].push(r.name);
            }
        });

        // 2. SENSOR HANTU: Auto-rekap dr. Edi untuk laporan shift
        const gabunganTeksSOAP = `${r.analysis || ''} ${r.planning || ''}`.toLowerCase();
        const isHD = /hd|ckd|hemodialisa/i.test(gabunganTeksSOAP);

        if (isHD) {
            let isJadwalHariIni = false;
            
            if (gabunganTeksSOAP.includes('senin-kamis') || gabunganTeksSOAP.includes('senin kamis')) {
                isJadwalHariIni = ['senin', 'kamis'].includes(hariIniLapor);
            } else if (gabunganTeksSOAP.includes('selasa-jumat') || gabunganTeksSOAP.includes('selasa jumat')) {
                isJadwalHariIni = ['selasa', 'jumat'].includes(hariIniLapor);
            } else if (gabunganTeksSOAP.includes('rabu-sabtu') || gabunganTeksSOAP.includes('rabu sabtu')) {
                isJadwalHariIni = ['rabu', 'sabtu'].includes(hariIniLapor);
            } else {
                isJadwalHariIni = true; // Jika jadwal kosong, default masuk agar tidak ada pasien tertinggal
            }

            // Jika jadwalnya cocok dengan hari ini, masukkan ke kantong dr. Edi
            if (isJadwalHariIni) {
                const namaDrEdi = "dr. Edi";
                if (!raberMap[namaDrEdi]) raberMap[namaDrEdi] = [];
                
                // Pastikan tidak dobel kalau perawat ternyata sudah pilih nama beliau di form
                const hasManualEdi = [r.raberName, r.raber2Name].some(dr => dr && dr.toLowerCase().includes('edi'));
                
                if (!hasManualEdi && !raberMap[namaDrEdi].includes(r.name)) {
                    raberMap[namaDrEdi].push(r.name);
                }
            }
        }
    });

    const raberText = Object.keys(raberMap).length > 0
    ? Object.entries(raberMap).map(([dr, pts]) => `• ${dr} : ${pts.length} pasien (${pts.join(', ')})`).join('\n')
    : '-';

    // --- REKAP PASIEN KASUS DHF ---
    const dhfList = activeRecords.filter(r => r.diagnosa?.toUpperCase().includes('DHF') || r.diagnosa?.toUpperCase().includes('DENGUE'));
    const dhfPatients = dhfList.length > 0
        ? dhfList.map(r => `- K.${r.roomNumber} a.n ${r.name} (${r.dpjpName})`).join('\n')
        : '-';

    // --- REKAP PESANAN KASUR (WAITING LIST) ---
    const constPesanan = waitingList ? waitingList.filter(w => !w.isDischarged) : [];
    const pesananText = constPesanan.length > 0
        ? constPesanan.map(w => `- K.${w.plannedRoom || '?'} a.n ${w.name} (rencana masuk)`).join('\n')
        : '-';

    // --- TEMPLATE TEKS FORMAT UTUH WHATSAPP ---
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

export { CustomInput, CustomTextArea, CustomSelect, TagSelector, FormattedObjective, PlanningQuickTag,
    formatDateCM, parseDateCM, hitungHariCM,
    isAntibioticMedicationName, getAntibioticDay,
    renderPlanningCell, renderObjectiveCell, renderLacakTtv,
    getLabBadges, extractLabSnapshot, parsePlanning,
    getDoctorGreeting, generateShiftReport };