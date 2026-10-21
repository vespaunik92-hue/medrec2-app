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
                            className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${highlightedIndex === index ? 'bg-indigo-100 text-indigo-800 font-bold' : 'hover:bg-indigo-50 text-gray-700'
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
                            className={`p-2 text-indigo-700 font-bold cursor-pointer border-t transition-colors ${highlightedIndex === filteredOptions.length ? 'bg-indigo-200' : 'bg-indigo-50 hover:bg-indigo-100'
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
        { label: 'DR', isi: 'Lab. R/ DR', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Tubex', isi: 'Lab. R/ Tubex', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'GDS', isi: 'Lab. R/ GDS', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'GDP', isi: 'Lab. R/ GDP (PUASA)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: '2JPP', isi: 'Lab. R/ 2JPP (PUASA)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'UrCr', isi: 'Lab. R/ UrCr', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Ēlek', isi: 'Lab. R/ Elektrolit (Na/K/Cl)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'AU', isi: 'Lab. R/ Asam Urat (PUASA)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Lipid', isi: 'Lab. R/ Lipid (PUASA)', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'OTPT', isi: 'Lab. R/ OTPT', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'TCM', isi: 'Lab. R/ TCM TB', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Sputum', isi: 'Lab. R/ Sputum', warna: 'bg-red-100 text-red-700 border-red-200' },
        { label: 'Urin', isi: 'Lab. R/ Urin', warna: 'bg-red-100 text-red-700 border-red-200' },

        // RAD (Biru)
        { label: 'Wh. Abd', isi: 'Rad. R/ USG Whole Abd. (Puasa+KKP)', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'Up. Abd', isi: 'Rad. R/ USG Upper Abd. (PUASA)', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'Low. Abd', isi: 'Rad. R/ USG Lower Abd. (KKP)', warna: 'bg-blue-100 text-blue-700 border-blue-200' },
        { label: 'CT Abd', isi: 'Rad. R/ CT Scan Abd. kontras', warna: 'bg-blue-100 text-blue-700 border-blue-200' },

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
                            className={`p-2 cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${highlightedIndex === index ? 'bg-indigo-100 text-indigo-800 font-bold' : 'hover:bg-blue-50 text-gray-700'
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
                            className={`p-2 text-green-700 font-bold cursor-pointer transition-colors border-t border-green-100 ${highlightedIndex === filteredOptions.length ? 'bg-green-200' : 'bg-green-50 hover:bg-green-100'
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
        .replace(/\b\d+\s*x\s*\d+(?:[.,]\d+)?\b/gi, ' ')
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

// 🧮 HITUNG HARI ANTIBIOTIK BERBASIS KUOTA DOSIS (3x1 -> Dosis ke-4 baru H2)
export const getAntibioticDay = (medName, medicationLogs = {}) => {
    if (!medName) return null;

    const normalizedMed = normalizeMedicationName(medName);
    if (!normalizedMed || !isAntibioticMedicationName(normalizedMed)) return null;

    const safeLogs = medicationLogs || {};
    let totalDosesGiven = 0;

    // 1. Hitung total berapa kali obat ini SUDAH dicentang di semua tanggal & shift
    Object.keys(safeLogs).forEach(dateStr => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

        const dayData = safeLogs[dateStr] || {};
        Object.keys(dayData).forEach(key => {
            const normalizedKey = normalizeMedicationName(key);
            if (!normalizedKey) return;

            if (normalizedKey.includes(normalizedMed) || normalizedMed.includes(normalizedKey)) {
                const shiftLog = dayData[key] || {};
                Object.values(shiftLog).forEach(slot => {
                    if (slot && (slot.checked === true || slot.given === true || slot.status === 'given')) {
                        totalDosesGiven++;
                    }
                });
            }
        });
    });

    // 2. Deteksi Aturan Pakai / Frekuensi dari teks nama obat
    const text = medName.toLowerCase();

    // Aturan Khusus 48 Jam (Selang sehari)
    if (text.includes('48') || text.includes('selang')) {
        if (totalDosesGiven <= 1) return 'H1';
        const day48 = (totalDosesGiven - 1) * 2 + 1; // Dosis 2 = H3, Dosis 3 = H5
        return `H${day48}`;
    }

    // Aturan Frekuensi Harian (3x1, 2x1, 1x1, 4x1)
    let dosesPerDay = 3; // Default antibiotik injeksi biasanya 3x1 (tiap 8 jam)
    const matchFreq = text.match(/(\d+)\s*x/i);
    if (matchFreq) {
        dosesPerDay = parseInt(matchFreq[1], 10) || 3;
    }

    // H = jumlah hari yang SUDAH LENGKAP diberikan (minimal H1)
    // 2x1: dosis 4 = H2, dosis 6 = H3 | 3x1: dosis 6 = H2, dosis 9 = H3
    const completedDays = Math.floor(totalDosesGiven / dosesPerDay);
    return `H${Math.max(1, completedDays)}`;
};

// 🎈 BALON TIPS HARI ANTIBIOTIK (per pemberian)
const ABX_SHIFT_ORDER = { jam_12: 0, jam_18: 1, jam_24: 2, jam_06: 3 };
const abxAddDays = (ymd, n) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

export const getAntibioticDoseInfo = (medName, medicationLogs = {}) => {
    if (!medName) return null;
    const normalizedMed = normalizeMedicationName(medName);
    if (!normalizedMed || !isAntibioticMedicationName(normalizedMed)) return null;
    const text = medName.toLowerCase();
    if (text.includes('48') || text.includes('selang')) return null;

    let dpd = 3;
    const mf = text.match(/(\d+)\s*x/i);
    if (mf) dpd = parseInt(mf[1], 10) || 3;

    const found = new Map();
    Object.keys(medicationLogs || {}).forEach(ds => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
        const day = medicationLogs[ds] || {};
        Object.keys(day).forEach(key => {
            const nk = normalizeMedicationName(key);
            if (!nk) return;
            if (nk.includes(normalizedMed) || normalizedMed.includes(nk)) {
                Object.entries(day[key] || {}).forEach(([sk, slot]) => {
                    if (slot && (slot.checked === true || slot.given === true || slot.status === 'given')) {
                        found.set(`${ds}|${sk}`, { ds, sk });
                    }
                });
            }
        });
    });

    const doses = [...found.values()].sort((a, b) =>
        a.ds === b.ds ? (ABX_SHIFT_ORDER[a.sk] ?? 9) - (ABX_SHIFT_ORDER[b.sk] ?? 9) : (a.ds < b.ds ? -1 : 1));

    const byCell = {};
    const rankInDate = {};
    doses.forEach((d, i) => {
        const k = i + 1;
        const r = rankInDate[d.ds] = (rankInDate[d.ds] ?? -1) + 1;
        const h = Math.max(1, Math.floor(k / dpd));
        const mk = (n) => ({ h: n / dpd, dose: n, date: abxAddDays(d.ds, Math.floor((r + (n - k)) / dpd)) });
        byCell[`${d.ds}|${d.sk}`] = { k, h, dpd, isNew: k % dpd === 0 && k / dpd >= 2, next: [mk((h + 1) * dpd), mk((h + 2) * dpd)] };
    });
    const lastD = doses[doses.length - 1];
    return { dpd, total: doses.length, byCell, last: lastD ? byCell[`${lastD.ds}|${lastD.sk}`] : null };
};

const abxLines = (c, prefix) => [
    `${prefix} ke-${c.k} · H${c.h}`,
    ...c.next.map(n => `H${n.h} tercapai: pemberian ke-${n.dose} (≈ ${n.date})`)
];
export const abxCellTip = (info, dateStr, shiftKey) => {
    const c = info?.byCell?.[`${dateStr}|${shiftKey}`];
    return c ? abxLines(c, 'Pemberian').join('|') : undefined;
};
export const abxBadgeTip = (info) => info?.last ? abxLines(info.last, 'Saat ini: pemberian').join('|') : undefined;
export const abxPrintNote = (info) => info?.last
    ? `Ke-${info.last.k} · H${info.last.h} → ` + info.last.next.map(n => `H${n.h}: ke-${n.dose} (≈${n.date})`).join(' · ')
    : '';
export const AbxPill = ({ med, logs, dateStr, shiftKey, variant = 'float' }) => {
    const info = getAntibioticDoseInfo(med, logs);
    const c = info?.byCell?.[`${dateStr}|${shiftKey}`];
    if (!c) return null;

    if (variant === 'print') {
        return (
            <span
                className="inline-block leading-none font-black rounded-full border border-black px-1 py-[0.5px] text-[6.5px]"
                style={{ background: c.isNew ? '#000' : '#fff', color: c.isNew ? '#fff' : '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >H{c.h}</span>
        );
    }

    const tone = c.isNew ? 'bg-rose-600 text-white border-rose-700' : 'bg-blue-100 text-blue-800 border-blue-500';
    const pos = variant === 'float' ? 'absolute -top-2 left-1/2 -translate-x-1/2 z-20' : 'inline-block mb-0.5';
    return (
        <span className={`${pos} ${tone} pointer-events-none whitespace-nowrap rounded-full border px-1.5 py-[1px] text-[8px] font-black leading-none shadow-sm`}>
            H{c.h}
        </span>
    );
};    

// 🎈 Balon tips global (DOM murni, tanpa perlu dipasang di komponen)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__abxTipInstalled) {
    window.__abxTipInstalled = true;
    let box = null, content = null, arrow = null;
    const ensure = () => {
        if (box || !document.body) return;
        const st = document.createElement('style');
        st.textContent = '@media print{#abx-tip-balloon{display:none!important}}';
        document.head.appendChild(st);
        box = document.createElement('div');
        box.id = 'abx-tip-balloon';
        box.style.cssText = 'position:fixed;z-index:99999;display:none;max-width:250px;pointer-events:none;background:#eff6ff;color:#1e293b;border:2px solid #1e3a8a;border-radius:12px;padding:6px 10px;font:600 11px/1.4 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25);';
        content = document.createElement('div');
        arrow = document.createElement('div');
        arrow.style.cssText = 'position:absolute;width:10px;height:10px;background:#eff6ff;border:solid #1e3a8a;transform:translateX(-50%) rotate(45deg);';
        box.appendChild(content); box.appendChild(arrow);
        document.body.appendChild(box);
    };
    const hide = () => { if (box) box.style.display = 'none'; };
    const show = (el) => {
        ensure(); if (!box) return;
        const lines = (el.getAttribute('data-abx-tip') || '').split('|').filter(Boolean);
        if (!lines.length) return hide();
        content.innerHTML = '';
        lines.forEach((t, i) => {
            const p = document.createElement('div');
            p.textContent = t;
            if (i === 0) { p.style.fontWeight = '800'; p.style.color = '#1e3a8a'; }
            content.appendChild(p);
        });
        box.style.display = 'block';
        const r = el.getBoundingClientRect();
        const bw = box.offsetWidth, bh = box.offsetHeight;
        const left = Math.max(6, Math.min(r.left + r.width / 2 - bw / 2, window.innerWidth - bw - 6));
        let top = r.top - bh - 10, below = false;
        if (top < 6) { top = r.bottom + 10; below = true; }
        box.style.left = left + 'px'; box.style.top = top + 'px';
        arrow.style.left = (r.left + r.width / 2 - left) + 'px';
        arrow.style.top = below ? '-7px' : ''; arrow.style.bottom = below ? '' : '-7px';
        arrow.style.borderWidth = below ? '2px 0 0 2px' : '0 2px 2px 0';
    };
    document.addEventListener('mouseover', e => { const el = e.target.closest?.('[data-abx-tip]'); el ? show(el) : hide(); });
    document.addEventListener('click', e => { const el = e.target.closest?.('[data-abx-tip]'); el ? show(el) : hide(); });
    window.addEventListener('scroll', hide, true);
}

// --- 🕒 TIME SLOTS PARSER UNTUK CPO 3 HARI & CETAK ---
export const getMedicationTimeSlots = (medName) => {
    if (!medName) return ['12:00'];
    const text = medName.toLowerCase();

    // 1. Antibiotik atau obat 3x1 tiap 8 jam (Siklus 24:00 -> 08:00 -> 16:00)
    if (text.includes('3x') || text.includes('/8 jam')) {
        return ['08:00', '16:00', '24:00'];
    }

    // 2. Obat 2x1 (tiap 12 jam)
    if (text.includes('2x') || text.includes('/12 jam')) {
        return ['08:00', '20:00'];
    }

    // 3. Obat 1x1 (tiap 24 jam)
    if (text.includes('1x') || text.includes('/24 jam')) {
        return ['08:00'];
    }

    // 4. Obat 4x1 (tiap 6 jam)
    if (text.includes('4x') || text.includes('/6 jam')) {
        return ['06:00', '12:00', '18:00', '24:00'];
    }

    if (text.includes('drip') || text.includes('infus') || text.includes('tpm')) return ['24 Jam'];
    if (text.includes('prn') || text.includes('kp') || text.includes('k/p')) return ['K/P'];

    return ['12:00', '20:00', '24:00', '04:00'];
};

// --- 💊 PARSER OBAT & FREKUENSI CPO (CATATAN PEMBERIAN OBAT) ---
const parseMedicationDetails = (medLine = '', medicationLogs = {}) => {
    if (!medLine || typeof medLine !== 'string') return null;
    const raw = medLine.trim();
    if (!raw || raw.length < 2) return null;

    // Bersihkan peluru / nomor urut di awal teks
    const cleanText = raw.replace(/^[-*\u2022\d.]+\s*/, '').trim();
    if (!cleanText || cleanText.length < 2) return null;

    // Filter daftar hitam non-obat
    const lower = cleanText.toLowerCase();
    const blacklist = ['diet', 'cek lab', 'darah rutin', 'usg', 'rontgen', 'foto thorax', 'konsul', 'observasi', 'ttv', 'edukasi', 'pulang', 'blpl', 'resep', 'lacak', 'lapor', 'acc', 'aff ', 'terapi lanjut', 'monitoring', 'rawat luka', 'gv', 'ekg', 'hemodialisa'];
    if (blacklist.some(b => lower.includes(b))) return null;
    if (/\bhd\b/i.test(lower) && !lower.includes('hcl')) return null;

    // 1. Ekstraksi Rute Pemberian Obat
    let route = 'p.o';
    if (/\b(iv|ivfd|i\.v|injeksi\s*iv|intravena)\b/i.test(lower)) route = 'IV';
    else if (/\b(im|i\.m|intramuskular)\b/i.test(lower)) route = 'IM';
    else if (/\b(sc|s\.c|subkutan)\b/i.test(lower)) route = 'SC';
    else if (/\b(drip|inf|infus)\b/i.test(lower)) route = 'Drip';
    else if (/\b(supp|suppo|suppositoria)\b/i.test(lower)) route = 'Supp';
    else if (/\b(nebu|inhalasi)\b/i.test(lower)) route = 'Nebu';
    else if (/\b(po|p\.o|oral|peroral)\b/i.test(lower)) route = 'p.o';
    else if (/\b(inj|vial|amp)\b/i.test(lower)) route = 'IV';
    else if (/\b(tab|caps|kapsul|syr|sirup)\b/i.test(lower)) route = 'p.o';
    else if (/\b(topikal|salep|tetes|gtt)\b/i.test(lower)) route = 'Topikal';

    // 2. Ekstraksi Frekuensi / Aturan Pakai
    let freqText = '1 x 1';
    let freqNum = 1;
    const tpmMatch = lower.match(/(\d+)\s*tpm/i);
    const freqMatch = lower.match(/(\d+)\s*x\s*([\d\/\.]+|\w+)?/i);
       if (tpmMatch) {
       freqNum = 1;
       freqText = `${tpmMatch[1]} tpm`;
   } else if (freqMatch) {
    } else if (/\/\s*8\s*jam/i.test(lower)) {
        freqNum = 3;
        freqText = '3 x 1 (/8 jam)';
    } else if (/\/\s*12\s*jam/i.test(lower)) {
        freqNum = 2;
        freqText = '2 x 1 (/12 jam)';
    } else if (/\/\s*6\s*jam/i.test(lower)) {
        freqNum = 4;
        freqText = '4 x 1 (/6 jam)';
    } else if (/\/\s*24\s*jam/i.test(lower)) {
        freqNum = 1;
        freqText = '1 x 1 (/24 jam)';
    } else if (/\/\s*48\s*jam/i.test(lower)) {
        freqNum = 1;
        freqText = '1 x / 48 jam';
    } else if (/\b(prn|k\/p|bila perlu)\b/i.test(lower)) {
        freqNum = 1;
        freqText = 'k/p (PRN)';
    }

    // 3. Mapping Jadwal Dinas (Pagi: 07-14 | Sore: 14-21 | Malam: 21-07)
    let slots = [];
    let pagiSchedule = '-';
    let soreSchedule = '-';
    let malamSchedule = '-';

    const isMalam = /malam|\bjam\s*24\b|\b24[:.]00\b/i.test(lower);
    const isPagi = /pagi|\bjam\s*(06|12)\b|\b12[:.]00\b/i.test(lower);
    const isSore = /sore|\bjam\s*(16|18|20)\b|\b18[:.]00\b/i.test(lower);

    if (freqNum >= 4) {
        slots = [
            { key: 'jam_12', label: '12:00', period: 'pagi' },
            { key: 'jam_18', label: '18:00', period: 'sore' },
            { key: 'jam_24', label: '24:00', period: 'malam' },
            { key: 'jam_06', label: '06:00', period: 'malam' }
        ];
        pagiSchedule = '12:00';
        soreSchedule = '18:00';
        malamSchedule = '24:00, 06:00';
    } else if (freqNum === 3) {
        slots = [
            { key: 'jam_12', label: '12:00', period: 'pagi' },
            { key: 'jam_18', label: '18:00', period: 'sore' },
            { key: 'jam_06', label: '06:00', period: 'malam' }
        ];
        pagiSchedule = '12:00';
        soreSchedule = '18:00';
        malamSchedule = '06:00';
    } else if (freqNum === 2) {
        slots = [
            { key: 'jam_12', label: '12:00', period: 'pagi' },
            { key: 'jam_24', label: '24:00', period: 'malam' }
        ];
        pagiSchedule = '12:00';
        soreSchedule = '-';
        malamSchedule = '24:00';
    } else if (freqNum === 1) {
        if (isMalam) {
            slots = [{ key: 'jam_24', label: '24:00', period: 'malam' }];
            pagiSchedule = '-';
            soreSchedule = '-';
            malamSchedule = '24:00';
        } else if (isSore) {
            slots = [{ key: 'jam_18', label: '18:00', period: 'sore' }];
            pagiSchedule = '-';
            soreSchedule = '18:00';
            malamSchedule = '-';
        } else {
            slots = [{ key: 'jam_12', label: '12:00', period: 'pagi' }];
            pagiSchedule = '12:00';
            soreSchedule = '-';
            malamSchedule = '-';
        }
    } else {
        slots = [{ key: 'jam_12', label: '12:00', period: 'pagi' }];
        pagiSchedule = '12:00';
    }

    // 4. Hari Antibiotik
    const antibioticDay = getAntibioticDay(raw, medicationLogs);

    // 5. Ceklis status hari ini berdasarkan medicationLogs
    const todayStr = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    })();

    const dayLogs = medicationLogs?.[todayStr] || {};
    let matchedLogShifts = dayLogs[cleanText] || dayLogs[raw] || {};
    if (Object.keys(matchedLogShifts).length === 0) {
        const normClean = cleanText.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const k of Object.keys(dayLogs)) {
            const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normK && (normK.includes(normClean) || normClean.includes(normK))) {
                matchedLogShifts = dayLogs[k] || {};
                break;
            }
        }
    }

    const slotStatuses = slots.map(s => {
        const shiftData = matchedLogShifts[s.key] || {};
        return {
            ...s,
            checked: Boolean(shiftData.checked),
            time: shiftData.time || null,
            by: shiftData.by || null
        };
    });

    const isStopOrTunda = lower.includes('stop') || lower.includes('tunda');

    return {
        raw,
        cleanText,
        route,
        freqText,
        freqNum,
        slots: slotStatuses,
        pagiSchedule,
        soreSchedule,
        malamSchedule,
        antibioticDay,
        isStopOrTunda
    };
};

const extractActiveMedications = (rec) => {
    if (!rec) return [];

    const rawRx = (rec.currentPrescription || '').trim();
    const rxLines = rawRx ? rawRx.split('\n') : [];

    const planText = (rec.planning || '').trim();
    const planLines = planText ? planText.split('\n') : [];

    const allCandidateLines = [...rxLines];

    planLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('HEADER:')) return;
        const clean = trimmed.replace(/^[-*\u2022\d.]+\s*/, '').trim();
        const lower = clean.toLowerCase();

        if (rxLines.some(rx => rx.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(rx.toLowerCase()))) {
            return;
        }

        if (
            trimmed.startsWith('-') || trimmed.startsWith('•') ||
            lower.startsWith('th.') || lower.startsWith('rx.') ||
            /\d+\s*x/i.test(lower) || /\/\s*\d+\s*jam/i.test(lower) ||
            /\b(mg|gr|mcg|ml|iu|tts|amp|vial|tab|caps|syr|inj|iv|po|im|sc|drip|supp|k\/p|prn)\b/i.test(lower)
        ) {
            allCandidateLines.push(trimmed);
        }
    });

    const medLogs = rec.medicationLogs || {};
    const parsedList = [];
    const seenNames = new Set();

    allCandidateLines.forEach(line => {
        const parsed = parseMedicationDetails(line, medLogs);
        if (parsed && parsed.cleanText) {
            const key = parsed.cleanText.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!seenNames.has(key)) {
                seenNames.add(key);
                parsedList.push(parsed);
            }
        }
    });

    return parsedList;
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

    // 👈 SENSOR RENCANA PULANG: Menandai agar obat pulang TIDAK DIBUANG ke meds
    let isUnderBlpl = false;

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
            isUnderBlpl = true; // 👈 Aktifkan mode BLPL: semua baris berikutnya adalah rincian obat pulang!
        } else if (lower.match(/\b(konsul|konsultasi|ts|rawat gabung|alih rawat)\b/)) {
            actionBadges.push({ type: 'konsul', text: cleanLine });
            isUnderBlpl = false;
        } else if (lower.match(/\b(lapor|lapor\s*\(\+\))\b/)) {
            actionBadges.push({ type: 'lapor', text: cleanLine });
            isUnderBlpl = false;
        } else if (lower.match(/\b(pindah|transfer|rujuk|pindah kamar|pindah anyelir)\b/)) {
            actionBadges.push({ type: 'pindah', text: cleanLine });
            isUnderBlpl = false;
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

        // 3. KATEGORI RESEP OBAT (HANYA BERLAKU JIKA BUKAN OBAT PULANG / !isUnderBlpl)
        else if (
            !isUnderBlpl && (
                cleanLine.startsWith('-') || cleanLine.startsWith('•') ||
                lower.includes('iv') || lower.includes('po') || lower.includes('p.o') ||
                lower.includes('tab') || lower.includes('inj') || lower.includes('amp') ||
                lower.includes('mg') || lower.includes('gr') || lower.includes('kcl') || lower.includes('drip')
            )
        ) {
            const medText = cleanLine.replace(/^[-•]\s*/, '').trim();
            const isAb = checkIsAntibiotic(medText);
            meds.push({ text: medText, isAb });
        }

        // 4. CATATAN LAINNYA (Semua rincian obat pulang akan masuk ke sini dan tampil utuh di kartu!)
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

            {/* 2. CATATAN UMUM & OBAT PULANG */}
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
                            const trnfsMatch = item.match(/(?:trnfs|transfusi)\s+(\d+)\s+([a-zA-Z]+)(?:[,\s]+on\s*ke\s*(\d*))?(?:[,\s]+post\s*ke\s*(\d*))?(?:[,\s]+sisa\s*(\d*))?/i);

                            let autoBadge = null;
                            if (trnfsMatch) {
                                const total = parseInt(trnfsMatch[1], 10) || 0;
                                const on = trnfsMatch[3] ? parseInt(trnfsMatch[3], 10) : 0;
                                const post = trnfsMatch[4] ? parseInt(trnfsMatch[4], 10) : 0;

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

const normalizeDocName = (name) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/^(dr\.|dokter|dr)\s*/i, '')
        .replace(/,\s*(sp\.[a-z]+|sp[a-z]+|m\.kes|mkes|ph\.d|phd|finasim|fics|m\.ked|mked).*$/i, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();
};

const isMatchDoctor = (targetName, filterName) => {
    if (!targetName || !filterName) return false;
    const t = targetName.trim().toLowerCase();
    const f = filterName.trim().toLowerCase();
    if (t === f || t.includes(f) || f.includes(t)) return true;
    const n1 = normalizeDocName(targetName);
    const n2 = normalizeDocName(filterName);
    return Boolean(n1 && n2 && (n1 === n2 || n1.includes(n2) || n2.includes(n1)));
};

// 🧠 SENSOR PUSAT DETEKSI PASIEN HEMODIALISA (HD)
export const getPatientHdInfo = (record) => {
    if (!record) return { isHD: false, isMenyalaHariIni: false, label: '' };

    const textScan = `${record.diagnosis || ''} ${record.analysis || ''} ${record.planning || ''}`.toLowerCase();

    // 🛑 1. Pengecualian Mutlak (Bukan HD / Tolak / Batal / Suspek)
    const isExplicitNonHD = /\b(tidak hd|bukan hd|non[- ]?hd|belum hd|tidak cuci darah|belum cuci darah|tidak mau hd|tolak hd|menolak hd|bukan untuk hd|tidak mau|menolak|tolak|belum bersedia)\b/i.test(textScan);
    const statusProvisional = /\b(dd ckd|susp ckd|susp\. ckd|dd hd|susp hd|aki dd|aki on ckd|acute on ckd)\b/i.test(textScan);

    // 🎯 2. Kata Kunci Konfirmasi HD Nyata
    const adaKataKunciHD = /\b(ckd\s*(?:st(?:age)?\s*v?\d*|\b)?\s*on\s*hd|hemodialisa|hemodialisis|cuci darah|hd\s*rutin|rutin\s*hd)\b/i.test(textScan) ||
        (/\bhd\b/i.test(textScan) && !/\b(tidak|bukan|non|belum|tanpa)\s+hd\b/i.test(textScan) && !textScan.includes('hcl'));

    const statusInisiasi = textScan.includes('inisiasi');
    const statusEdukasi = textScan.includes('edukasi');

    const isHD = (adaKataKunciHD || statusInisiasi || statusEdukasi) && !isExplicitNonHD && !statusProvisional;

    if (!isHD) {
        return { isHD: false, isMenyalaHariIni: false, label: '', shouldBlink: false, color: '', arrowColor: '' };
    }

    const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    const isCitoExtra = /\b(extra|ekstra|cito)\b/i.test(textScan);

    let isMenyalaHariIni = false;
    let shouldBlink = false;
    let label = 'HD';
    let color = 'bg-rose-600';
    let arrowColor = 'border-t-rose-600';

    if (isCitoExtra) {
        isMenyalaHariIni = true;
        shouldBlink = true;
        label = 'HD Extra';
        color = 'bg-red-600';
        arrowColor = 'border-t-red-600';
    } else if (statusInisiasi) {
        isMenyalaHariIni = true;
        shouldBlink = true;
        label = 'HD Inisiasi';
        color = 'bg-purple-600';
        arrowColor = 'border-t-purple-600';
    } else if (statusEdukasi) {
        isMenyalaHariIni = true;
        shouldBlink = false;
        label = 'Edukasi HD';
        color = 'bg-amber-500';
        arrowColor = 'border-t-amber-500';
    } else {
        const isSeninKamis = /(?:senin[\s\-\/,+&]+kamis|kamis[\s\-\/,+&]+senin)/i.test(textScan);
        const isSelasaJumat = /(?:selasa[\s\-\/,+&]+jumat|jumat[\s\-\/,+&]+selasa)/i.test(textScan);
        const isRabuSabtu = /(?:rabu[\s\-\/,+&]+sabtu|sabtu[\s\-\/,+&]+rabu)/i.test(textScan);

        if (isSeninKamis) isMenyalaHariIni = ['senin', 'kamis'].includes(hariIni);
        else if (isSelasaJumat) isMenyalaHariIni = ['selasa', 'jumat'].includes(hariIni);
        else if (isRabuSabtu) isMenyalaHariIni = ['rabu', 'sabtu'].includes(hariIni);
        else isMenyalaHariIni = true;

        shouldBlink = isMenyalaHariIni;
    }

    return { isHD: true, isMenyalaHariIni, label, shouldBlink, color, arrowColor };
};

// 📱 PUSAT FORMAT LAPORAN WA RESMI (INDUK & COMPANION TERPUSAT)
export const buildWhatsAppText = ({
  patient,
  senderName = 'Perawat',
  wardName = 'MELATI',
  type = 'DPJP',
  raberIndex = 0,
  dpjpProfiles = []
}) => {
  // 1. Salam Waktu & Toleransi Dokter Non-Muslim
  const h = new Date().getHours();
  let salamWaktu = "Selamat Malam";
  if (h >= 4 && h < 10) salamWaktu = "Selamat Pagi";
  else if (h >= 10 && h < 15) salamWaktu = "Selamat Siang";
  else if (h >= 15 && h < 18) salamWaktu = "Selamat Sore";

  const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
  const isNonMuslim = nonMuslimDoctors.some(name => (patient.dpjpName || '').toLowerCase().includes(name.toLowerCase()));
  const salam = isNonMuslim ? salamWaktu : 'Assalamualaikum';

  // 2. Format Title Case (Ubah "ABI NUGROHO ANTIK" -> "Abi Nugroho Antik")
  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
  };

  // 3. Deteksi Gelar Pasien Otomatis (Anti Dobel & Ramah Anak/Bayi)
  const rawName = (patient.name || '').trim();
  const nameStr = rawName.toLowerCase();
  const genderStr = String(patient.gender || '').toLowerCase().trim();
  let patientTitle = "";

  if (!/^(tn\.|ny\.|an\.|nn\.|by\.|sdr\.)\s/i.test(nameStr)) {
    if (nameStr.includes('bln') || nameStr.includes('bulan') || nameStr.includes('hari') || nameStr.includes('by')) {
      patientTitle = "An. ";
    } else {
      const ageMatch = nameStr.match(/(?:^|\(|\s)(\d+)\s*(?:th|tahun|thn)/i);
      if (ageMatch && parseInt(ageMatch[1], 10) < 15) {
        patientTitle = "An. ";
      } else if (genderStr === 'l' || genderStr.includes('laki')) {
        patientTitle = "Tn. ";
      } else if (genderStr === 'p' || genderStr.includes('perempuan') || genderStr.includes('wanita')) {
        patientTitle = "Ny. ";
      }
    }
  }

  // Buang gelar lama jika ada di nama, lalu ubah ke Title Case
  const cleanNameOnly = rawName.replace(/^(tn\.|ny\.|an\.|nn\.|by\.|sdr\.)\s+/i, '').trim();
  const formattedName = toTitleCase(cleanNameOnly);

  // 4. Pembersih Stempel Dinas Perawat
  const cleanForWA = (txt) => (txt || '').replace(/(?:🕒\s*)?\[[A-Za-z0-9\s\-_]+,\s*[\d\/\-]+\s+[\d:\.]+\]\s*/g, '').trim();

  // Keterangan Bed
  const bedInfo = patient.roomNumber ? ` (Bed ${patient.roomNumber})` : '';

  // 5. Susun Baris DPJP & Raber (Spasi Bawah & Tanpa Kurung)
  const raberList = [patient.raberName, patient.raber2Name, patient.raber3Name].filter(Boolean);
  
  let doctorSection = '';
  if (patient.dpjpName && type !== 'DPJP') {
    doctorSection += `DPJP: ${patient.dpjpName}\n`;
  }
  if (raberList.length > 0 && type !== 'Raber') {
    doctorSection += `Raber: ${raberList.join(', ')}\n`;
  }

  // 6. Peracikan Blok O (Objektif + Planning + Terapi Th;)
  const objText = cleanForWA(patient.objective);
  const planText = cleanForWA(patient.planning);
  const rxText = cleanForWA(patient.currentPrescription);

  const oParts = [];
  if (objText) oParts.push(objText);
  if (planText) oParts.push(planText);
  if (rxText) oParts.push(`Th;\n${rxText}`);

  const oContent = oParts.length > 0 ? oParts.join('\n\n') : '-';

  // 7. SUSUNAN FINAL FORMAT PESAN WA
  const text = `${salam} dokter, saya ${senderName} dari ruang ${wardName} izin melaporkan:\n` +
    `${patientTitle}${formattedName}\n` +
    `${doctorSection}\n` +
    `Dx: ${cleanForWA(patient.analysis) || '-'}\n\n` +
    `*S:* ${cleanForWA(patient.subjective) || '-'}\n\n` +
    `*O:*\n${oContent}\n\n` +
    `Mohon advisnya dokter.\n` +
    `terimakasih`;

    // 8. Target Nomor WA (DPJP atau Raber terpilih)
  const lookupNumber = (docName) => {
    const cleanDoc = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = cleanDoc(docName);
    if (!target) return '';
    const matchedProfile = dpjpProfiles.find(p => {
      const pClean = cleanDoc(p.name);
      return pClean && (pClean.includes(target) || target.includes(pClean));
    });
    if (!matchedProfile || !matchedProfile.waNumber) return '';
    let rawDigits = String(matchedProfile.waNumber).replace(/\D/g, '');
    if (rawDigits.startsWith('0')) rawDigits = '62' + rawDigits.substring(1);
    else if (rawDigits.startsWith('8')) rawDigits = '62' + rawDigits;
    return rawDigits;
  };

  let targetNumber = '';
  if (type === 'DPJP') {
    targetNumber = lookupNumber(patient.dpjpName);
  } else if (type === 'Raber') {
    targetNumber = lookupNumber([patient.raberName, patient.raber2Name, patient.raber3Name][raberIndex]);
  }

  return { text, targetNumber };
};

// 🧼 PEMBERSIH NAMA OBAT BERSAMA — disamakan dengan Smart Paste di PatientForm.jsx
export const cleanDrugName = (rawName = '', translator = {}) => {
  const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s)\w/g, m => m.toUpperCase());
  let cleanMed = String(rawName).toLowerCase().trim();

  // 1. Kamus penerjemah singkatan (constants.js)
  Object.keys(translator || {}).forEach(key => {
    if (cleanMed.includes(key)) {
      try { cleanMed = cleanMed.replace(new RegExp(key + '(?![a-z])', 'g'), translator[key]); } catch (e) {}
    }
  });

  // 2. Sensor rute
  const t = cleanMed.toLowerCase();
  const isOralForm = /\b(?:tab|tablet|kaps|kapsul|kaplet|sirup|syr|sachet)\b/i.test(t);
  const isNebu = /\b(?:nebu|nebulizer|inhalasi|uap|respule|neb)\b/i.test(t) ||
    (!isOralForm && /(?:combiven|pulmicort|farbivent|ventolin|meptin|atrovent|berotec|flexotide|flutias|flutison|spiriva|symbicort|seretide)/i.test(t));
  const isSachet = /\b(?:sachet|sac|sacc|saset|bungkus|serbuk|pulv|puyer)\b/i.test(t) ||
    /(?:lacto[\s\-]b|oralit|smecta|l[\s\-]bio|vip[\s\-]albumin|interlac|braxidin|biodiar)/i.test(t);
  const isSyrup = /\b(?:sirup|syr|dry\s*syr|drop|drops|suspensi|susp)\b/i.test(t);
  const isInjection = /\b(?:inj|injek|injeksi|iv|i\.v\.|im|i\.m\.|sc|s\.c\.|vial|ampul|amp|drip|infus|inf|lar\s*inf)\b/i.test(t) || /\b(?:asering|kaen|ka-en|d5|d10|dextrose|dekstrosa|glukosa|b[\s\-]?fluid|clinimix|clinoleic|aminoleban|aminofusin|futrolit|ringer|plasma\s*lyte|nutriflex|tutofusin|kabiven|triofusin)\b/i.test(t) || (!isOralForm && /\bna[\s\-]?cl\b|\bnatrium\s*klorida\b/i.test(t)) || /\b(?:i\.?v|i\.?m|s\.?c)\b/i.test(t);
  const isOral = /\b(?:tab|tablet|kaps|kapsul|po|p\.o\.|caps|oral|disp|kaplet)\b/i.test(t)|| /\bp\.?o\b/i.test(t);

  let routeSuffix = '';
  if (isNebu) routeSuffix = ' (nebu)';
  else if (isSachet) routeSuffix = ' (sachet)';
  else if (isInjection) routeSuffix = ' (Iv)';
  else if (isSyrup) routeSuffix = '';
  else if (isOral) routeSuffix = ' (p.o)';
  else routeSuffix = ' (p.o)';

  // 3. Buang isi kurung lama, lalu potong kemasan & ungkapan berulang
  cleanMed = cleanMed.replace(/\([^)]*\)/g, '');
  cleanMed = cleanMed
    .replace(/\b(serb\s*inj|injeksi|injek|inj|kaps|tab|tablet|kapsul|kaplet|po|p\.o|lar\s*inf|drips\s*\(infus\)|drips|infus|vial|udv|otsuka|sanbe|ampul|amp|nebu|nebulizer|sachet|sac|sacc|saset)\b\.?/gi, '')
    .replace(/\b1000\s*mg\/vial|1000mg\/vial|1000\s*mg\b/gi, '1 gr')
    .replace(/\b\d+(?:[.,]\d+)?\s*mg\/ml\b/gi, '')
    .replace(/mg\/ml/gi, '')
    .replace(/\b(?:i\.?v|i\.?m|s\.?c)\.?(?=[\s\/,]|$)(?:\s*\/\s*(?:i\.?v|i\.?m|s\.?c)\.?(?=[\s\/,]|$))*/gi, '')
    .replace(/[\/,\s\-*]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return toTitleCase(cleanMed) + routeSuffix;
};

// 💧 DETEKSI CAIRAN INFUS (NaCl / RL) — apapun nama panjang/merek dari gudang
export const detectInfusionFluid = (rawName = '') => {
  const t = String(rawName).toLowerCase();
  if (/\b(?:tab|tablet|kaps|kapsul|kaplet|sachet|sirup|syr)\b/.test(t)) return null; // garam oral bukan infus
  const vol = t.match(/(\d+)\s*ml\b/);
  if (vol && parseInt(vol[1], 10) < 250) return null; // pelarut/bolus kecil bukan IVFD rumatan
  const conc = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (conc && conc[1].replace(',', '.') !== '0.9') return null; // NaCl 3%, 0,45% dll tetap apa adanya
  if (/\bringer\s*(?:laktat|lactate|lactat)\b|\bringer[\s\-]*lakt|\br[\s\/\.\-]*l\b(?=[\s,\d]|$)/.test(t)) return 'RL';
  if (/\bna[\s\-]?cl\b|\bnatrium\s*klorida\b|\bsodium\s*chloride\b/.test(t)) return 'NaCl';
  return null;
};

// 🌬️ DETEKSI OBAT NEBU/INHALASI — nama merek → label ringkas (dosis/kemasan dibuang)
const NEBU_BRANDS = [
  [/flutison/i, 'Flutison'], [/flutias/i, 'Flutias'], [/fl[ei]xotide/i, 'Flixotide'],
  [/farbivent/i, 'Farbivent'], [/combiven/i, 'Combivent'], [/atrovent/i, 'Atrovent'],
  [/ventolin/i, 'Ventolin'], [/pulmicort/i, 'Pulmicort'], [/meptin/i, 'Meptin'],
  [/berotec/i, 'Berotec'], [/spiriva/i, 'Spiriva'], [/symbicort/i, 'Symbicort'], [/seretide/i, 'Seretide'],
];
export const detectNebuDrug = (rawName = '') => {
  const t = String(rawName).toLowerCase();
  if (/\b(?:tab|tablet|kaps|kapsul|kaplet|sirup|syr|sachet)\b/.test(t)) return null; // bentuk oral
  const hit = NEBU_BRANDS.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
};

// 🍬 DETEKSI DEXTROSE (D5/D10/D40 dll) — buang embel-embel kemasan
const detectDextrose = (rawName = '') => {
  const t = String(rawName).toLowerCase();
  if (/\b(?:tab|tablet|kaps|kapsul|sirup|syr)\b/.test(t)) return null;
  if (/\bna[\s\-]?cl\b|natrium|ringer/.test(t)) return null; // campuran: biarkan apa adanya
  const m = t.match(/\bd-?(5|10|20|25|40|50)\b/);
  let conc = m ? m[1] : null;
  if (!conc && /\b(?:dextrose|dekstrosa|glukosa|glucose)\b/.test(t)) {
    const p = t.match(/(\d+(?:[.,]\d+)?)\s*%/);
    conc = p ? p[1] : null;
  }
  if (!conc) return null;
  const vol = t.match(/(\d+)\s*ml\b/);
  return `D${conc}%` + (vol ? ` ${vol[1]} Ml` : '');
};

// 🧾 SATU PINTU PEMBUAT BARIS RESEP — dipakai Smart Paste & Companion
const buildRxLineRaw = (rawName = '', freqOrDose = '', translator = {}) => {
  const fluid = detectInfusionFluid(rawName);
  if (fluid) {
  const m = String(freqOrDose).match(/(\d+)\s*(?:tpm|tetes)/i);
    return `- IVFD ${fluid} ${m ? m[1] : 20} tpm`;
  }
  const nebu = detectNebuDrug(rawName);
  if (nebu) {
  const f = String(freqOrDose).replace(/\s+/g, '').replace(/[\s,.;]+$/, '');
    return f ? `- ${nebu} (nebu) (${f})` : `- ${nebu} (nebu)`;
  }
  const dex = detectDextrose(rawName);
  if (dex) {
  const f = String(freqOrDose).replace(/\s+/g, '').replace(/[\s,.;]+$/, '');
    return f ? `- ${dex} (Iv) (${f})` : `- ${dex} (Iv)`;
  }
  const name = cleanDrugName(rawName, translator);
  const d = String(freqOrDose).replace(/\s+/g, '').replace(/[\s,.;]+$/, '');
  return d ? `- ${name} (${d})` : `- ${name}`;
};

// ✂️ RAPIKAN BARIS RESEP — tanpa kurung, rute & satuan huruf kecil
const humanizeRxLine = (line = '') => String(line)
  .replace(/[()]/g, ' ')
  .replace(/\bp\.o\b/gi, 'po')
  .replace(/\b(?:mg|gr|mcg|ml|iu)\b/gi, m => m.toLowerCase())
  .replace(/\b(?:iv|im|sc|po|nebu)\b/gi, m => m.toLowerCase())
  .replace(/\s+/g, ' ')
  .trim();

const buildRxLine = (rawName = '', freqOrDose = '', translator = {}) =>
  humanizeRxLine(buildRxLineRaw(rawName, freqOrDose, translator));

export const cleanPrescriptionText = (rawText, translator = {}) => {
  if (!rawText) return '';
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const seen = new Set();
  const cleanedList = [];

  lines.forEach(line => {
    let text = line.replace(/^[-*•\s]+/, '').trim();
    if (!text) return;

    // Pisahkan frekuensi, mis. "(3x1)" atau "3x1"
    let freq = '';
    const freqMatch = text.match(/(\d+\s*x\s*[\d\w\/\.]*|\d+\s*x)/i);
    if (freqMatch) {
      freq = `(${freqMatch[1].replace(/,/g, '').replace(/\s+/g, '')})`;
      text = text.replace(freqMatch[0], ' ').replace(/\(\s*[,.]?\s*\)/g, ' ').trim();
    }

    const entry = buildRxLine(text, freq.replace(/^\(|\)$/g, ''), translator);
    const key = entry.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return;   // buang baris kembar persis
    seen.add(key);

    cleanedList.push(entry);
  });

  return cleanedList.join('\n');
};

// 🗓️ GABUNG (1 baris per hari) & URUTKAN (hari ini → terjauh) BARIS RENCANA — dipakai INDUK & COMPANION
export const mergePlanningText = (currentText = '', incomingText = '') => {
  const incoming = (incomingText || '').trim();
  if (!incoming) return currentText || '';
  const current = (currentText || '').trim();
  if (!current) return incoming;

  const LINE_RE = /^(Lab\. R\/|Rad\. R\/|TM\.|Th\.|Lacak\/Lapor)\s*(.*?)\s*(\[[^\]]+\])?$/i;
  const lines = current.split('\n').map(l => l.trim()).filter(Boolean);

  const inMatch = incoming.match(LINE_RE);
  // Teks bebas (bukan format medis): taruh di paling atas seperti sebelumnya
  if (!inMatch) return `${incoming}\n${lines.join('\n')}`;

  const prefix = inMatch[1].trim();
  const itemName = inMatch[2].trim();
  const timeTag = (inMatch[3] || '').trim();
  const bypass = /^(th|tm)/i.test(prefix); // terapi & tindakan tetap per baris

  let merged = false;
  if (!bypass) {
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(LINE_RE);
      if (!m) continue;
      const lPrefix = m[1].trim();
      const lItems = m[2].trim();
      const lTag = (m[3] || '').trim();
      if (lPrefix.toLowerCase() === prefix.toLowerCase() && norm(lTag) === norm(timeTag)) {
        const existing = lItems.split(',').map(x => x.trim().toLowerCase());
        if (!existing.includes(itemName.toLowerCase())) {
          lines[i] = `${lPrefix} ${lItems}, ${itemName}${timeTag ? ' ' + timeTag : ''}`;
        }
        merged = true;
        break;
      }
    }
  }
  if (!merged) lines.unshift(incoming);

  // ---- Urutkan baris Lab/Rad: hari ini → terjauh (baris lain tetap di posisinya) ----
  const isSched = (l) => /^(Lab\. R\/|Rad\. R\/)/i.test(l);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const DAY = 86400000;
  const today = startOfDay(new Date());

  const sortKey = (l) => {
    const tm = l.match(/\[([^\]]*)\]\s*$/);
    const tag = (tm ? tm[1] : '').trim().toLowerCase();
    let ts;
    const dm = tag.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!tag) ts = Number.MAX_SAFE_INTEGER;                 // jadwal kosong → paling bawah
    else if (dm) {
      const yy = parseInt(dm[3], 10);
      ts = new Date(yy < 100 ? 2000 + yy : yy, parseInt(dm[2], 10) - 1, parseInt(dm[1], 10)).getTime();
    }
    else if (tag.includes('lusa')) ts = today + 2 * DAY;
    else if (tag.includes('besok')) ts = today + DAY;
    else ts = today;                                        // Pagi/Sore Ini, Nanti Malam
    const slot = tag.includes('pagi') ? 0 : tag.includes('sore') ? 1 : tag.includes('malam') ? 2 : 3;
    const type = /^lab/i.test(l) ? 0 : 1;
    return { ts, slot, type };
  };

  const slots = [];
  const sched = [];
  lines.forEach((l, i) => { if (isSched(l)) { slots.push(i); sched.push({ l, k: sortKey(l) }); } });
  sched.sort((a, b) => (a.k.ts - b.k.ts) || (a.k.slot - b.k.slot) || (a.k.type - b.k.type));
  slots.forEach((idx, n) => { lines[idx] = sched[n].l; });

  return lines.join('\n');
};

// 🧬 GABUNG DIAGNOSA (A): tambahkan hanya baris yang BELUM ADA, urutan lama dipertahankan
export const mergeDiagnosisText = (currentText = '', incomingText = '') => {
  const normDx = (s = '') => String(s).toLowerCase()
    .replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const cur = (currentText || '').trim();
  const inc = String(incomingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!inc.length) return currentText || '';
  const seen = new Set(cur.split('\n').map(normDx).filter(Boolean));
  const fresh = [];
  inc.forEach(l => {
    const k = normDx(l);
    if (!k || seen.has(k)) return;
    seen.add(k);
    fresh.push(l);
  });
  if (!fresh.length) return currentText || '';
  return cur ? `${cur}\n${fresh.join('\n')}` : fresh.join('\n');
};

// 💊 GABUNG RESEP: baris lama TIDAK disentuh (ceklis CPO & hitungan H antibiotik aman), hanya obat baru ditambah di akhir
export const mergePrescriptionText = (currentText = '', incomingText = '') => {
  const keyOf = (line) => normalizeMedicationName(String(line).replace(/^\s*[-•*]\s*/, ''))
    .replace(/\b\d+\s*tpm\b/g, '')   // perubahan kecepatan tetes tidak dianggap obat baru
    .replace(/\s+/g, ' ').trim();
  const cur = (currentText || '').trim();
  const inc = String(incomingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!inc.length) return currentText || '';
  const seen = new Set(cur.split('\n').map(keyOf).filter(Boolean));
  const fresh = [];
  inc.forEach(l => {
    const k = keyOf(l);
    if (!k || seen.has(k)) return;
    seen.add(k);
    fresh.push(l);
  });
  if (!fresh.length) return currentText || '';
  return cur ? `${cur}\n${fresh.join('\n')}` : fresh.join('\n');
};

export {
    CustomInput, CustomTextArea, CustomSelect, TagSelector, FormattedObjective, PlanningQuickTag,
    formatDateCM, parseDateCM, hitungHariCM,
    isAntibioticMedicationName,
    parseMedicationDetails, extractActiveMedications,
    renderPlanningCell, renderObjectiveCell, renderLacakTtv,
    getLabBadges, extractLabSnapshot, parsePlanning,
    getDoctorGreeting, generateShiftReport,
    normalizeDocName, isMatchDoctor, buildRxLine
};