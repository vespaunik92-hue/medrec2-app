import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection,
    query,
    where,
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
import LabHistoryTable from './components/LabHistoryTable'; // 👈 Tambahkan ini di atas
import TtvHistory from './components/TtvHistory'; // 👈 Tambahkan baris ini
import PatientTable from './components/PatientTable';
import BukuCMTable from './components/BukuCMTable'; // 👈 Taruh di deretan komponen lain
import { GlobalMedicationBoard, MedicationMarModal } from './components/MedicationBoard';
import PatientForm from './components/PatientForm';
import {
    formatDateCM, hitungHariCM, getAntibioticDay, parsePlanning, parseDateCM,
    renderLacakTtv, renderObjectiveCell, renderPlanningCell, CustomInput, extractLabSnapshot,
    generateShiftReport, getLabInfo
} from './utils/helpers';
import {
    LEFT_ROOMS, RIGHT_ROOMS, ROOM_LIST,
    DEFAULT_DPJP_DATA, LAB_CHECKS, RADIOLOGY_CHECKS,
    PROCEDURES, MEDICATIONS, WARD_CONFIG, LAB_NORMAL_RANGES, ANTIBIOTICS_DB,
    MEDICATION_TRANSLATOR, LAB_TRANSLATOR, LAB_DICTIONARY,
    LAB_PATTERNS, LAB_LOW_IS_BAD, LAB_TUBEX_POSITIVE_THRESHOLD
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

// 🔥 1. TARUH DI SINI: Inisialisasi abadi di LUAR komponen
export const app = initializeApp(firebaseConfig);

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

// --- FUNGSI HELPER UNTUK PRINT DI HP/TABLET (ANTI-CRASH) ---
const handlePrintWindow = (elementId, title, paperSize = 'A5') => {
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
                body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: ${paperSize === 'A4' ? '12pt' : '11pt'}; }
                @media print { 
                    @page { size: ${paperSize} portrait; margin: 0.5cm; } 
                    body { margin: 0; } 
                    .no-print { display: none !important; } 
                    .print-break { page-break-after: always; } 
                    #print-container { width: 100%; max-width: ${paperSize === 'A4' ? '210mm' : '148mm'}; margin: 0 auto; } 
                }
            </style>
        </head>
        <body>
            <div id="print-container">${content.innerHTML}</div>
        </body>
        </html>
    `;
    cetakPWA(html, title);
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
                                className={`text-[9px] py-1 rounded border transition ${selectedRooms.includes(room)
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
        if (score >= 14) return 'Composmentis';
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
                    <CustomInput label="TD (mmHg)" value={ttv.td} onChange={e => setTtv({ ...ttv, td: e.target.value })} placeholder="120/80" />
                    <CustomInput label="Nadi (x/m)" value={ttv.n} onChange={e => setTtv({ ...ttv, n: e.target.value })} placeholder="80" />
                    <CustomInput label="Suhu (C)" value={ttv.s} onChange={e => setTtv({ ...ttv, s: e.target.value })} placeholder="36.5" />
                    <CustomInput label="RR (x/m)" value={ttv.rr} onChange={e => setTtv({ ...ttv, rr: e.target.value })} placeholder="20" />
                    <CustomInput label="SpO2 (%)" value={ttv.spo2} onChange={e => setTtv({ ...ttv, spo2: e.target.value })} placeholder="98" />
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
                                {[4, 3, 2, 1].map(v => <GcsOption key={v} label={v === 4 ? 'Spont' : v === 3 ? 'Sound' : v === 2 ? 'Pain' : 'None'} val={v} current={gcs.e} onChange={(val) => setGcs({ ...gcs, e: val })} />)}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="w-4 text-[10px] font-bold">V</span>
                            <div className="flex flex-1 ml-1">
                                {[5, 4, 3, 2, 1].map(v => <GcsOption key={v} label={v === 5 ? 'Orient' : v === 4 ? 'Conf' : v === 3 ? 'Word' : v === 2 ? 'Sound' : 'None'} val={v} current={gcs.v} onChange={(val) => setGcs({ ...gcs, v: val })} />)}
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="w-4 text-[10px] font-bold">M</span>
                            <div className="flex flex-1 ml-1">
                                {[6, 5, 4, 3, 2, 1].map(v => <GcsOption key={v} label={v === 6 ? 'Obey' : v === 5 ? 'Loc' : v === 4 ? 'Flex' : v === 3 ? 'Abn' : v === 2 ? 'Ext' : 'None'} val={v} current={gcs.m} onChange={(val) => setGcs({ ...gcs, m: val })} />)}
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

// ✨ HELPER BARU: KONVERSI TEKS KARTU DASHBOARD MENJADI [HARI INI]
const formatTextToHariIni = (text, rec) => {
    if (!text) return '';
    const today = new Date();

    const namaHariIni = today.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
    const d = today.getDate();
    const m = today.getMonth() + 1;
    const y2 = today.getFullYear().toString().slice(-2);
    const y4 = today.getFullYear();

    const tglVariasi = [
        `${d}/${m}`, `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        `${d}/${m}/${y2}`, `${d}/${m}/${y4}`
    ];

    const lastUpdate = rec.updatedAt?.toDate ? rec.updatedAt.toDate() : (rec.updatedAt ? new Date(rec.updatedAt) : new Date());

    // Cek apakah data ini di-input kemarin
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isUpdatedYesterday = lastUpdate.getDate() === yesterday.getDate() && lastUpdate.getMonth() === yesterday.getMonth();

    let cleaned = text;

    // 1. Jika mengandung tanggal hari ini, langsung kunci jadi [Hari Ini]
    const todayRegex = new RegExp(`\\[[^\\]]*(${tglVariasi.join('|')}|sekarang|hari ini)[^\\]]*\\]`, 'gi');
    if (todayRegex.test(cleaned)) {
        return cleaned.replace(todayRegex, '[Hari Ini]');
    }

    // 2. Jika ditulis kemarin dan mengandung kata "besok/bsk", ubah jadi [Hari Ini]
    if (isUpdatedYesterday && /\b(besok|bsk)\b/i.test(cleaned)) {
        // Ganti format kurung siku besok menjadi [Hari Ini]
        cleaned = cleaned.replace(/\[\s*(besok|bsk)[^\]]*\]/gi, '[Hari Ini]');
        // Toleransi jika ditulis tanpa kurung siku
        cleaned = cleaned.replace(/\b(besok|bsk)\b/gi, '[Hari Ini]');
    }

    return cleaned;
};

const PrintLayout = ({ record, historyLogs = [] }) => {
    if (!record) return null;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'numeric', year: 'numeric'
    });

    // ✨ FIX CETAK: Pisau pencukur stempel nama & logo jam khusus untuk kertas cetak
    const stripAuthorTags = (text) => (text || '').replace(/(?:🕒\s*)?\[[^\]]+,\s*[\d\/]+\s+[\d:]+\]\s*/g, '').trim();

    // Semua (S, O, A, P) sekarang dilewatkan ke mesin pencukur stempel!
    const safeSubjective = stripAuthorTags(record.subjective);
    const safeObjective = stripAuthorTags(record.objective);
    const safeAnalysis = stripAuthorTags(record.analysis);
    const safePlanning = stripAuthorTags(record.planning);

    // 💊 RESEP OBAT PERSISTEN
    const safeCurrentPrescription = (() => {
        if (record.currentPrescription && record.currentPrescription.trim()) {
            return record.currentPrescription.trim();
        }
        const legacyMatch = (record.planning || '').match(/\[RESEP OBAT\]:([\s\S]*)/i);
        return legacyMatch ? legacyMatch[1].trim() : '';
    })();

    // ✨ FIX PRINT: Filter steril agar baris resep obat tidak ikut tercetak ganda di Planning atas
    const filteredPlanningForPrint = useMemo(() => {
        if (!safePlanning) return '';
        return safePlanning.split('\n').filter(line => {
            const trimmed = line.trim();
            // Jika baris dimulai dengan dash '-' dan ada di dalam master resep obat, eliminasi dari planning atas
            if (trimmed.startsWith('-') && safeCurrentPrescription.toLowerCase().includes(trimmed.toLowerCase())) {
                return false;
            }
            return true;
        }).join('\n').trim();
    }, [safePlanning, safeCurrentPrescription]);

    const { others, labs, rads, tms, rxs, itemAuthors } = useMemo(() => {
        if (!filteredPlanningForPrint) return { others: [], labs: [], rads: [], tms: [], rxs: [], itemAuthors: {} };
        return parsePlanning(filteredPlanningForPrint);
    }, [filteredPlanningForPrint]);

    const hasSubjective = safeSubjective && safeSubjective !== '-' && safeSubjective.trim() !== '';

    // Build multi-date lab table from historyLogs + current
    const buildLabTable = () => {
        const allLogs = [
            { objective: safeObjective, updatedAt: new Date() },
            ...historyLogs.map(log => ({ objective: log.objective || '', updatedAt: log.updatedAt }))
        ].filter(log => log.objective);

        const labData = {}; // { Hb: [{date: '17/06', val: '11.2', numVal: 11.2}, ...], ... }
        const dateSet = new Set();

        allLogs.forEach(log => {
            const dateObj = log.updatedAt && log.updatedAt.seconds
                ? new Date(log.updatedAt.seconds * 1000)
                : (log.updatedAt || new Date());
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
            dateSet.add(dateStr);

            Object.keys(LAB_PATTERNS).forEach(key => {
                // ✨ FIX PERBAIKAN 3 TEMPAT B (Baris 1): Gram/Sputum diizinkan tampil di lembar print
                if (key === 'TCM' || key === 'HIV' || key === 'HBsAg' || key === 'Anti-HCV' || key === 'Widal' || key === 'Kultur' || key === 'MDT') return;
                const match = log.objective.match(LAB_PATTERNS[key]);
                if (match) {
                    if (!labData[key]) labData[key] = [];
                    const numVal = parseFloat(match[1].replace(',', '.'));
                    labData[key].push({ date: dateStr, val: match[1], numVal });
                }
            });
        });

        // Sort dates from newest to oldest
        const headers = Array.from(dateSet).sort((a, b) => {
            const [d1, m1] = a.split('/');
            const [d2, m2] = b.split('/');
            const dateA = new Date(2024, parseInt(m1) - 1, parseInt(d1));
            const dateB = new Date(2024, parseInt(m2) - 1, parseInt(d2));
            return dateB - dateA;
        });

        // Build rows with latest value per date (avoid duplicates)
        const rows = {};
        Object.keys(LAB_PATTERNS).forEach(key => {
            // ✨ FIX PERBAIKAN 3 TEMPAT B (Baris 2): Gram/Sputum lolos seleksi baris tabel print
            if (key === 'TCM' || key === 'HIV' || key === 'HBsAg' || key === 'Anti-HCV' || key === 'Widal' || key === 'Kultur' || key === 'MDT') return;
            if (labData[key] && labData[key].length > 0) {
                rows[key] = {};
                // Take the latest entry per date
                const seen = new Set();
                [...labData[key]].reverse().forEach(item => {
                    if (!seen.has(item.date)) {
                        rows[key][item.date] = item;
                        seen.add(item.date);
                    }
                });
            }
        });

        return { headers, rows };
    };

    const { headers, rows } = buildLabTable();
    const hasLabData = headers.length > 0 && Object.keys(rows).length > 0;

    // Helper for color coding - ✏️ FIX: Pakai LAB_NORMAL_RANGES (konsisten dengan FormattedObjective)
    const getLabColor = (key, val) => {
        const range = LAB_NORMAL_RANGES[key];
        if (!range) return 'text-gray-800';
        const num = parseFloat(val);
        if (isNaN(num)) return 'text-gray-800';
        if (num > range.max) return 'text-red-600 font-bold bg-red-50';
        if (num < range.min) return 'text-blue-600 font-bold bg-blue-50';
        return 'text-gray-800';
    };

    // ✨ MULTIUSER & ANTIBIOTIK: Render daftar item digabung jadi satu baris
    const renderItemsWithAuthors = (items, itemAuthors, isRx = false) => {
        return items.map((item, idx) => {
            const authors = itemAuthors[item] || [];

            // ✨ FITUR BARU: Tampilkan Hari Antibiotik di Cetakan
            let abBadge = null;
            if (isRx && typeof getAntibioticDay === 'function') {
                const cleanMedName = item.split(/\s+\d/)[0].trim().replace(/\s+(iv|im|sc|po|drip)$/i, '');
                const hCode = getAntibioticDay(cleanMedName, record.medicationLogs || {});
                if (hCode) {
                    abBadge = <span className="ml-1 text-[9px] font-bold text-black border border-black bg-gray-100 px-1 py-[1px] rounded">🚨 {hCode}</span>;
                }
            }

            return (
                <span key={item}>
                    {idx > 0 && ', '}
                    {item}
                    {abBadge}
                    {authors.length > 1 && (
                        <span className="font-normal text-[9px] opacity-70 normal-case">
                            {' '}({authors.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' & ')})
                        </span>
                    )}
                </span>
            );
        });
    };

    const renderHighlightedOthers = (textArray) => {
        return textArray.map((line, idx) => {
            const lower = line.toLowerCase();
            const dischargeKeywords = ['blpl', 'rblpl', 'pulang', 'boleh pulang'];
            if (dischargeKeywords.some(k => lower.includes(k))) {
                return (
                    <div key={idx} className="font-bold border border-black bg-gray-100 px-1 py-0.5 my-1 rounded text-black text-xs leading-tight w-fit">
                        🎉 {line.toUpperCase()}
                    </div>
                );
            }
            const alertKeywords = ['lab', 'radiologi', 'rontgen', 'usg', 'ct-scan', 'cek darah', 'konsul', 'puasa', 'operasi', 'cito', 'hd'];
            if (alertKeywords.some(k => lower.includes(k))) {
                return (
                    <div key={idx} className="font-bold border border-black bg-gray-100 px-1 py-0.5 my-1 rounded text-black text-xs leading-tight w-fit">
                        ⚠️ {line.toUpperCase()}
                    </div>
                );
            }
            return <div key={idx} className="my-0.5">{line}</div>;
        });
    };

    return (
        <div className="bg-white p-0 text-sm font-sans leading-snug text-black h-full flex flex-col">
            {/* HEADER ATAS */}
            <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2 shrink-0">
                <div className="flex-1">
                    <div className="font-bold text-lg uppercase tracking-wide flex items-center gap-2">
                        <span className="text-sm font-bold border-2 border-black px-2 py-0.5">
                            {/* ✨ FIX PEMOTONG CETAK: Memotong akhiran KM atau P saat cetak lembar APOS */}
                            {record.roomNumber ? record.roomNumber.replace(/(KM|P)$/, '') : ''}
                        </span>
                        <span>{record.name}</span>
                    </div>
                    <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-4 items-center">

                        {/* ✨ FIX CETAK APOS: DPJP Diperbesar (text-[13px]), Ditebalkan (font-black), plus background Abu-abu anti-hilang */}
                        <span
                            className="font-black text-[13px] bg-gray-200 px-1.5 py-0.5 rounded border border-gray-400"
                            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                        >
                            DPJP: {record.dpjpName}
                        </span>

                        {(record.raberName || record.raber2Name) && (
                            <span className="text-gray-600 font-medium italic">
                                Raber: {[record.raberName, record.raber2Name].filter(Boolean).join(', ')}
                            </span>
                        )}
                    </div>
                </div>

                {/* ✨ FIX 3: NAMA PERAWAT DIHILANGKAN (Sisa Info Durasi Hari Rawat Saja) */}
                <div className="text-right flex flex-col items-end justify-start">
                    {record.admissionDate && (
                        <div className="text-[10px] text-gray-700 font-bold">
                            {(() => {
                                const start = new Date(record.admissionDate);
                                if (isNaN(start)) return null;
                                const now = new Date();
                                const diffTime = now.getTime() - start.getTime();
                                if (diffTime < 0) return null;
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const fmtIn = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
                                const fmtOut = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                return `${fmtIn(start)} - ${fmtOut(now)} = ${diffDays} hr ${diffHours} jm`;
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* BODY GRID DATA */}
            <div className="grid grid-cols-2 gap-4 flex-1 items-stretch">
                <div className="border-r-2 border-gray-300 pr-2 flex flex-col">
                    <div className="mb-2">
                        {/* ✨ FIX 1: JUDUL A DITAMBAHKAN "Dx :" */}
                        <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">A (ANALISA) / Dx :</div>
                        <div className="whitespace-pre-wrap font-sans mb-1 pl-1">{safeAnalysis || '-'}</div>
                    </div>

                    <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-1">
                        <div className="font-bold underline mb-2 bg-gray-100 inline-block px-1 text-xs">P (PLANNING)</div>
                        <div className="font-sans pl-1">
                            {others.length > 0 && (
                                <div className="mb-3 leading-relaxed whitespace-pre-wrap">
                                    {renderHighlightedOthers(others)}
                                </div>
                            )}

                            {/* ✨ PENYELAMATAN NAMA AUTHOR & KONVERSI [HARI INI] */}
                            {(labs.length > 0 || rads.length > 0 || tms.length > 0 || rxs.length > 0) && (() => {
                                // 1. Konversi array ke format [Hari Ini] (Ubah rec menjadi record)
                                const displayLabs = labs.map(item => formatTextToHariIni(item, record));
                                const displayRads = rads.map(item => formatTextToHariIni(item, record));
                                const displayTms = tms.map(item => formatTextToHariIni(item, record));

                                // 2. Sinkronisasi ulang dictionary author agar nama perawat tidak hilang
                                const displayItemAuthors = {};
                                if (typeof itemAuthors !== 'undefined' && itemAuthors) {
                                    Object.keys(itemAuthors).forEach(key => {
                                        displayItemAuthors[formatTextToHariIni(key, record)] = itemAuthors[key];
                                    });
                                }

                                // 3. Render HTML dengan data yang sudah bersih
                                return (
                                    <div className="space-y-1 mt-2 border-t border-dotted border-gray-400 pt-2 text-xs">
                                        {displayLabs.length > 0 && (
                                            <div className="flex items-start bg-rose-100 border border-rose-300 text-rose-900 px-1 py-0.5 rounded w-fit max-w-full leading-tight" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                <span className="font-bold w-10 flex-shrink-0 uppercase">Lab.</span>
                                                <span className="flex-1 font-bold underline">: {renderItemsWithAuthors(displayLabs, displayItemAuthors)}</span>
                                            </div>
                                        )}
                                        {displayRads.length > 0 && (
                                            <div className="flex items-start bg-sky-100 border border-sky-300 text-sky-900 px-1 py-0.5 rounded w-fit max-w-full leading-tight" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                <span className="font-bold w-10 flex-shrink-0 uppercase">Rad.</span>
                                                <span className="flex-1 font-bold underline">: {renderItemsWithAuthors(displayRads, displayItemAuthors)}</span>
                                            </div>
                                        )}
                                        {displayTms.length > 0 && (
                                            <div className="flex items-start bg-emerald-100 border border-emerald-300 text-emerald-900 px-1 py-0.5 rounded w-fit max-w-full leading-tight" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                <span className="font-bold w-12 flex-shrink-0 uppercase">Tndkn.</span>
                                                <span className="flex-1 font-bold underline">: {renderItemsWithAuthors(displayTms, displayItemAuthors)}</span>
                                            </div>
                                        )}
                                        {rxs.length > 0 && (
                                            <div className="flex items-start bg-amber-100 border border-amber-300 text-amber-900 px-1 py-0.5 rounded w-fit max-w-full leading-tight" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                <span className="font-bold w-12 flex-shrink-0 uppercase">Terapi.</span>
                                                {/* Obat/Terapi dibiarkan aslinya karena tidak pakai tag [Besok] */}
                                                <span className="flex-1 font-bold underline">: {renderItemsWithAuthors(rxs, itemAuthors, true)}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* 💊 RESEP OBAT PERSISTEN — Terpisah dan Bersih dari Duplikasi */}
                    {safeCurrentPrescription && (
                        <div className="border-t-2 border-dashed border-rose-400 pt-2 mt-2">
                            <div
                                className="font-bold underline mb-1 inline-block px-1 text-xs text-rose-900 bg-rose-100 border border-rose-300 rounded"
                                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                            >
                                💊 RESEP OBAT
                            </div>

                            {/* ✨ FIX PRINT: Membaca baris demi baris resep obat untuk memunculkan Badge Antibiotik di kertas cetak */}
                            <div className="font-mono text-xs pl-1 leading-relaxed text-gray-900 space-y-0.5">
                                {safeCurrentPrescription.split('\n').map((line, lIdx) => {
                                    const trimmed = line.trim();
                                    let abBadge = null;

                                    if (typeof getAntibioticDay === 'function') {
                                        const cleanMedName = trimmed.replace(/^[-\*\s\u2022\d.]+\s*/, '').split(/\s+\d/)[0].trim().replace(/\s+(iv|im|sc|po|drip)$/i, '');
                                        if (ANTIBIOTICS_DB.some(ab => cleanMedName.toLowerCase().includes(ab)) || /\bH\d+\b/i.test(trimmed)) {
                                            const hCode = getAntibioticDay(trimmed, record.medicationLogs || {});
                                            if (hCode) {
                                                abBadge = <span className="ml-2 text-[9px] font-black border border-black bg-gray-100 px-1 py-[px] rounded">🚨 {hCode}</span>;
                                            }
                                        }
                                    }
                                    return (
                                        <div key={lIdx} className="flex items-center flex-wrap">
                                            <span>{line}</span>
                                            {abBadge}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="flex-1"></div>
                </div>

                <div className="flex flex-col">
                    <div className="mb-2">
                        <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">O (OBJEKTIF)</div>
                        <div className="mb-2 font-mono text-sm border border-black p-1.5 rounded bg-white leading-snug">
                            <div className="grid grid-cols-2 gap-x-4">
                                <div>TD : ____</div><div>N  : ____</div><div>S  : ____</div><div>RR : ____</div><div>SpO2: ___</div><div>GCS : ___</div>
                            </div>
                        </div>
                        <div className="font-sans pl-1 mt-1">
                            <FormattedObjective text={safeObjective} />
                        </div>
                    </div>

                    {hasSubjective && (
                        <div className="border-t-2 border-dashed border-gray-400 pt-2 mt-1">
                            <div className="font-bold underline mb-1 bg-gray-100 inline-block px-1 text-xs">S (SUBJEKTIF)</div>
                            <div className="whitespace-pre-wrap font-sans mb-3 pl-1">{safeSubjective}</div>
                        </div>
                    )}
                    <div className="flex-1"></div>
                </div>
            </div>
        </div>
    );
};

const PrintView = ({ record, closePrint, historyLogs = [] }) => {
    const onPrintA5 = () => {
        handlePrintWindow('printable-area', `Cetak APOS - ${record.name}`, 'A5');
    };
    const onPrintA4 = () => {
        handlePrintWindow('printable-area', `Cetak APOS - ${record.name}`, 'A4');
    };

    return (
        <div className="fixed inset-0 bg-white z-[80] p-0 overflow-y-auto">
            {/* Header Controls */}
            <div className="p-4 bg-gray-100 flex justify-between items-center no-print sticky top-0 border-b shadow-sm">
                <h1 className="font-bold text-gray-700">Preview Cetak (APOS)</h1>
                <div className="flex gap-2">
                    <button onClick={onPrintA5} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 flex items-center transition">
                        🖨️ Cetak A5
                    </button>
                    <button onClick={onPrintA4} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow hover:bg-indigo-700 flex items-center transition" title="Pilih A4 jika ingin print 2-per-lembar">
                        🖨️ Cetak A4
                    </button>
                    <button onClick={closePrint} className="px-4 py-2 bg-red-500 text-white rounded text-sm font-bold hover:bg-red-600 transition">Tutup</button>
                </div>
            </div>

            <div id="printable-area" className="p-4 flex justify-center">
                <div className="w-full max-w-4xl">
                    <PrintLayout record={record} historyLogs={historyLogs} />
                </div>
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

    const onPrintA5 = () => {
        handlePrintWindow('bulk-printable-area', 'Cetak Banyak - APOS', 'A5');
    };
    const onPrintA4 = () => {
        handlePrintWindow('bulk-printable-area', 'Cetak Banyak - APOS', 'A4');
    };

    return (
        // POIN 3: z-[150] agar melayang di atas header utama (z-100)
        <div className="fixed inset-0 bg-white z-[150] overflow-y-auto">
            <div className="p-4 bg-indigo-50 flex justify-between items-center no-print sticky top-0 z-50 border-b shadow-sm">
                <div>
                    <h1 className="font-bold text-indigo-900">Cetak Banyak ({sortedToPrint.length} Pasien)</h1>
                    <p className="text-[10px] text-gray-500 italic">*Urutan otomatis berdasarkan nomor kamar</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onPrintA5} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 flex items-center transition">
                        🖨️ Cetak A5
                    </button>
                    <button onClick={onPrintA4} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow hover:bg-indigo-700 flex items-center transition" title="Gunakan setting printer '2 Pages per Sheet' jika ingin A5 di kertas A4">
                        🖨️ Cetak A4
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
const RoomMap = ({ roomList, leftRooms, rightRooms, activeRecords, onSelectRoom, onEditRoom, roomFilter, waitingList, onSwapBed }) => {

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

    // =================================================================================
    // ✨ AREA REVISI FINAL: IMPLEMENTASI KEDIP BORDER (2.1) & SVG GINJAL + BALON TIP (2.2)
    // =================================================================================
    const renderRoom = (roomNumber) => {
        const record = activeRecords.find(r => r.roomNumber === roomNumber);
        const booked = waitingList?.find(w => w.plannedRoom === roomNumber);
        const isHidden = roomFilter.length !== roomList.length && !roomFilter.includes(roomNumber);

        if (isHidden) return null;

        // Logika Status & Warna Sisa Bed
        let statusText = 'Kosong';
        let statusColor = 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100';

        // ✨ SENSOR TETANGGA: Menyesuaikan deteksi tetangga kasur format KM dan P
        const match = roomNumber.match(/^(K\d+)(KM|P)$/);
        if (!record && !booked && match) {
            const roomCode = match[1];
            const neighborBed = match[2] === 'KM' ? 'P' : 'KM';
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

            // 🕒 DETEKSI HARI INI (Bahasa Indonesia: 'senin', 'selasa', dll)
            const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

            // 🤖 SENSOR UTAMA
            const gabunganTeksSOAP = `${record.diagnosis || ''} ${record.analysis || ''} ${record.planning || ''}`.toLowerCase();

            // 🛑 PENGECUALIAN 1: Status Suspek/DD (Tn. Tatang)
            const statusProvisional = gabunganTeksSOAP.includes('dd ckd') || gabunganTeksSOAP.includes('susp ckd') || gabunganTeksSOAP.includes('susp. ckd') || gabunganTeksSOAP.includes('dd hd') || gabunganTeksSOAP.includes('aki dd');

            // 🛑 PENGECUALIAN 2: Pasien Menolak Tindakan (Saran Mandor Abi untuk Bu Marsem)
            const statusMenolak = gabunganTeksSOAP.includes('menolak') || gabunganTeksSOAP.includes('tolak') || gabunganTeksSOAP.includes('tidak mau') || gabunganTeksSOAP.includes('belum bersedia');

            // ✨ EKSEKUSI SENSOR: Balon HD dilarang muncul jika pasien berstatus Suspek ATAU Menolak!
            const isHD = /hd|ckd|hemodialisa/i.test(gabunganTeksSOAP) && !statusProvisional && !statusMenolak;

            // =========================================================================
            // ⚡ MESIN SENSOR HD MULTI-KATEGORI
            // =========================================================================
            let isHDMenyalaHariIni = false;
            let shouldBlinkBorder = false;
            let hdLabel = 'HD';
            let balloonColor = 'bg-rose-600';
            let arrowColor = 'border-t-rose-600';

            if (isHD) {
                if (gabunganTeksSOAP.includes('extra') || gabunganTeksSOAP.includes('ekstra') || gabunganTeksSOAP.includes('cito')) {
                    // Kategori A: HD Cito
                    isHDMenyalaHariIni = true;
                    shouldBlinkBorder = true;
                    hdLabel = 'HD Extra';
                    balloonColor = 'bg-red-600';
                    arrowColor = 'border-t-red-600';
                } else if (gabunganTeksSOAP.includes('inisiasi')) {
                    // Kategori B: HD Inisiasi
                    isHDMenyalaHariIni = true;
                    shouldBlinkBorder = true;
                    hdLabel = 'HD Inisiasi';
                    balloonColor = 'bg-purple-600';
                    arrowColor = 'border-t-purple-600';
                } else if (gabunganTeksSOAP.includes('edukasi')) {
                    // ✨ Kategori C: Edukasi HD (Hanya menyala untuk pasien yang sedang diedukasi dan BELUM menolak)
                    isHDMenyalaHariIni = true;
                    shouldBlinkBorder = false;
                    hdLabel = 'Edukasi HD';
                    balloonColor = 'bg-amber-500';
                    arrowColor = 'border-t-amber-500';
                } else {
                    // Kategori D: HD Rutin Terjadwal
                    let isJadwalCocok = false;
                    if (gabunganTeksSOAP.includes('senin-kamis') || gabunganTeksSOAP.includes('senin kamis')) {
                        isJadwalCocok = ['senin', 'kamis'].includes(hariIni);
                    } else if (gabunganTeksSOAP.includes('selasa-jumat') || gabunganTeksSOAP.includes('selasa jumat')) {
                        isJadwalCocok = ['selasa', 'jumat'].includes(hariIni);
                    } else if (gabunganTeksSOAP.includes('rabu-sabtu') || gabunganTeksSOAP.includes('rabu sabtu')) {
                        isJadwalCocok = ['rabu', 'sabtu'].includes(hariIni);
                    } else {
                        isJadwalCocok = true;
                    }

                    if (isJadwalCocok) {
                        isHDMenyalaHariIni = true;
                        shouldBlinkBorder = true;
                        hdLabel = 'HD';
                        balloonColor = 'bg-rose-600';
                        arrowColor = 'border-t-rose-600';
                    }
                }
            }
            // =========================================================================

            // 👨‍⚕️ SUNTIKAN OTOMATIS dr. Edi di Layar
            let raberArray = [record.raberName, record.raber2Name].filter(Boolean);
            if (isHD && !raberArray.some(r => r.toLowerCase().includes('edi'))) {
                raberArray.push('dr. Edi');
            }
            const raberTextDisplay = raberArray.join(', ');

            return (
                <div
                    key={roomNumber}
                    onClick={() => onEditRoom(record)}
                    // ✨ KONTROL BORDER BERKEDIP DINAMIS BERDASARKAN KATEGORI AKTIF
                    className={`relative flex flex-col p-1.5 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${shouldBlinkBorder
                        ? 'animate-border-hd border-[2.5px] shadow-md ring-2 ring-slate-950/5'
                        : (isMale ? 'border-blue-400 shadow-sm' : 'border-rose-400 shadow-sm')
                        } ${isMale ? 'bg-blue-200' : 'bg-rose-100'}`}
                >

                    {/* ✨ BALON TIP MELAYANG MULTI-KATEGORI (DIKENDALIKAN PROGRAM) */}
                    {isHDMenyalaHariIni && (
                        <div className={`absolute -top-3 -right-2 ${balloonColor} text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md flex items-center gap-1 z-30 animate-in zoom-in-95 duration-200 uppercase tracking-tight`}>
                            {/* Ikon Ginjal Medis Putih */}
                            <svg className="w-2.5 h-2.5 fill-current text-white animate-pulse shrink-0" viewBox="0 0 24 24">
                                <path d="M12 2c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 17.2c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l.59-.59C7.93 19.26 9.88 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                            </svg>
                            {hdLabel}
                            {/* Ekor Segitiga Menyesuaikan Warna Balon */}
                            <div className={`absolute -bottom-[5px] right-2.5 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent ${arrowColor} drop-shadow-sm`}></div>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-0.5 border-b border-white/60 pb-0.5">
                        <span className={`font-extrabold text-[11px] ${shouldBlinkBorder ? 'text-slate-950 font-black' : (isMale ? 'text-blue-900' : 'text-rose-900')}`}>
                            {roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2')}
                        </span>

                        <div className="flex gap-1 items-center">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSwapBed) onSwapBed(record);
                                }}
                                className="text-[9px] bg-white/60 hover:bg-white/90 rounded px-1 shadow-sm transition cursor-pointer"
                                title="Tukar Bed">
                                🔀
                            </button>
                            <span className="text-[9px] bg-white/50 rounded px-1">{isMale ? '🚹' : '🚺'}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <span className="font-bold text-xs text-gray-800 leading-none truncate mb-0.5">{record.name}</span>
                        <span className="text-[9px] text-gray-600 font-medium truncate">{record.dpjpName}</span>
                        {/* Menampilkan Raber yang sudah disuntik dr. Edi */}
                        {raberArray.length > 0 && (
                            <span className="text-[7px] bg-yellow-200 text-yellow-800 px-1 rounded w-fit mt-0.5">Raber: {raberTextDisplay}</span>
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
                <span className="font-extrabold text-[11px] mb-0.5">{roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2')}</span>
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
    // ✨ STATE NAVIGASI KEYBOARD UNTUK MENU DROPDOWN UTAMA
    const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
    const [mainMenuHighlight, setMainMenuHighlight] = useState(-1);
    const menuWrapperRef = useRef(null);
    const [isMarModalOpen, setIsMarModalOpen] = useState(false);
    const [marSelectedRecord, setMarSelectedRecord] = useState(null);

    // Auto-close menu jika pengguna klik di luar area menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuWrapperRef.current && !menuWrapperRef.current.contains(event.target)) {
                setIsMainMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Susunan daftar menu aktif secara dinamis untuk dibaca oleh Keyboard index
    const activeMenuItems = useMemo(() => {
        const items = [
            { type: 'link', label: '☕ Traktir Kopi?', href: 'https://trakteer.id/481nugroho' },
            { type: 'view', label: '🏠 Dashboard', value: 'dashboard' },
            { type: 'view', label: '📋 Daftar Pasien', value: 'patient-list' },
            { type: 'view', label: '⚙️ Setelan', value: 'settings' },
            // ✨ FIX: Gudang Arsip dipindah ke paling bawah kelompok menu utama
            { type: 'view', label: '🗃️ Gudang Arsip Pasien', value: 'archived-list' }
        ];
        if (cashflowRole) items.push({ type: 'finance', label: 'Panel Keuangan' });
        if (currentUser?.role === 'SUPERADMIN' || currentUser?.name?.toLowerCase().includes('abi')) {
            ['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK'].forEach(w => items.push({ type: 'ward', label: `🏥 Ruang ${w}`, ward: w }));
        }
        items.push({ type: 'logout', label: '🚪 Keluar' });
        return items;
    }, [cashflowRole, currentUser]);

    // Mesin pembaca navigasi keyboard
    const handleMenuKeyDown = (e) => {
        if (!isMainMenuOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                setIsMainMenuOpen(true);
                setMainMenuHighlight(0);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMainMenuHighlight(prev => (prev < activeMenuItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMainMenuHighlight(prev => (prev > 0 ? prev - 1 : activeMenuItems.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (mainMenuHighlight >= 0 && mainMenuHighlight < activeMenuItems.length) {
                const item = activeMenuItems[mainMenuHighlight];
                if (item.type === 'link') window.open(item.href, '_blank');
                else if (item.type === 'view') setView(item.value);
                else if (item.type === 'finance') setAppMode('KEUANGAN');
                else if (item.type === 'ward') onSwitchWard(item.ward);
                else if (item.type === 'logout') onLogout();
                setIsMainMenuOpen(false);
                setMainMenuHighlight(-1);
            }
        } else if (e.key === 'Escape') {
            setIsMainMenuOpen(false);
        }
    };

    // Helper pencari index item
    const getMenuIdx = (type, val = '') => {
        return activeMenuItems.findIndex(item => {
            if (type === 'link' || type === 'finance' || type === 'logout') return item.type === type;
            if (type === 'view') return item.type === 'view' && item.value === val;
            if (type === 'ward') return item.type === 'ward' && item.ward === val;
            return false;
        });
    };

    // Helper pembuat huruf Kapital awal kata
    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s)\w/g, m => m.toUpperCase());

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
    // ✨ MODE SOAP: 'personal' = catatan pribadi perawat, 'ruangan' = catatan gabungan/final
    const [soapMode, setSoapMode] = useState('personal');

    // State untuk Data Dinamis (Setelan) - dengan localStorage backup
    const [dpjpProfiles, setDpjpProfiles] = useState(() => {
        try {
            // Coba ambil dari memori browser dulu (jika internet mati/diblokir)
            const localData = JSON.parse(localStorage.getItem('backupDpjp'));
            if (localData && localData.length > 0) return localData;
        } catch (e) { }
        // Jika benar-benar kosong, baru ambil dari constants.js
        return initialDpjpProfiles.map(p => ({ ...p, name: p.name }));
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

        // ✨ SUNTIKAN BARU: Daftarkan Item Bertipe 'Protocol'
        const protocols = [
            { label: 'Protokol Sliding Scale (SC)', type: 'Protocol', isi: 'Th. Sliding Scale (SC tiap 4 jam):\n< 150 : 0 Unit\n150 - 200 : 4 Unit\n200 - 250 : 8 Unit\n250 - 300 : 12 Unit\n300 - 350 : 16 Unit\n350 - 400 : 20 Unit\n> 400 : 24 Unit' },
            { label: 'Protokol GDS (dr. Dian)', type: 'Protocol', isi: 'Th. Cek GDS per 2 jam:\n- Jika GDS > 200 ganti D5% 20 tpm\n- Jika dgn D5% 20 tpm GDS > 200, ganti dgn NaCl 0.9% 20 tpm' }
        ];

        return [...labs, ...rads, ...prots, ...meds, ...protocols].sort((a, b) => a.label.localeCompare(b.label));
    }, [masterLabs, masterRads, masterProcedures, masterMedications]);

    const [view, setView] = useState('dashboard');
    const [rightDashboardTab, setRightDashboardTab] = useState('soap-apo'); // State untuk memori saklar kanan
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentRecordId, setCurrentRecordId] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);
    // ✨ STATE UNTUK CARD TABS (Lab/Radiology)
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [expandedCardTab, setExpandedCardTab] = useState('Lab');
    // --- ANTENA PEMBACA RIWAYAT SOAP (REAL-TIME MULTIUSER) ---
    useEffect(() => {
        // Pelindung agar tidak blank
        if (!db || !appId || !currentRecordId) {
            setHistoryLogs([]);
            return;
        }

        try {
            // ✨ FIX FINAL: Menggunakan variabel 'appId' persis seperti kode 12 Juni
            const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${currentRecordId}/notes`);
            const q = query(notesRef, orderBy('createdAt', 'desc'));

            const unsubscribe = onSnapshot(q, (snap) => {
                const logs = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    updatedAt: d.data().createdAt?.seconds ? new Date(d.data().createdAt.seconds * 1000) : new Date()
                }));
                setHistoryLogs(logs);
            }, (err) => {
                console.error("Gagal mendengarkan data riwayat:", err);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error pada antena riwayat:", error);
        }
    }, [db, appId, currentRecordId]);

    // State Print
    const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);
    const [showBulkPrint, setShowBulkPrint] = useState(false);

    const [showInputModal, setShowInputModal] = useState(false);
    const [recordForLapor, setRecordForLapor] = useState(null);
    const [recordForDischarge, setRecordForDischarge] = useState(null);
    const [showLaporModal, setShowLaporModal] = useState(false);

    // ✨ TEMPEL STATE TUKAR BED DI SINI:
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [patientToSwap, setPatientToSwap] = useState(null);

    const [dpjpFilter, setDpjpFilter] = useState([]);
    const [selectedRoomFilter, setSelectedRoomFilter] = useState(currentWardConfig.roomList);

    const [showRaber1, setShowRaber1] = useState(false);
    const [showRaber2, setShowRaber2] = useState(false);
    const [showTtvModal, setShowTtvModal] = useState(false);


    const [confirmDetails, setConfirmDetails] = useState({ isOpen: false, message: '', title: '', action: () => { } });
    const openConfirm = (title, message, action) => { setConfirmDetails({ isOpen: true, title, message, action }); };
    const closeConfirm = () => { setConfirmDetails({ isOpen: false, message: '', title: '', action: () => { } }); };

    const [formData, setFormData] = useState({
        roomNumber: '', name: '', rmNumber: '', gender: '',
        dpjpName: '', raberName: '', raber2Name: '', admissionDate: '', evidenceImages: [],
        subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
        // ✨ GAMBAR RADIOLOGI: array of {category, imageUrl, date, uploadedBy}
        radiologyImages: [],
    });

    const [newDpjpName, setNewDpjpName] = useState('');
    const [newDpjpWa, setNewDpjpWa] = useState('');

    // --- [LEVEL 4] LOGIC: USER MONITORING & ACTIONS ---

    // 1. Monitor Users (Admin, Karu, & Admin Ruangan)
    useEffect(() => {
        if (!['admin', 'karu', 'admin_ruangan'].includes(currentUser?.role) || !db) return;
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

        // Mengunci otomatis ruangan sesuai lokasi Karu/Admin Ruangan bertugas
        const isLockedWard = ['karu', 'admin_ruangan'].includes(currentUser?.role);
        const targetWard = isLockedWard ? currentUser.ward : (adminUserForm.ward || 'MELATI');

        try {
            const exists = allUsers.find(u => u.id === targetId);

            // Blokir jika Karu/Admin ruangan mencoba mengedit akun dari ruangan lain
            if (exists && isLockedWard && exists.ward !== currentUser.ward) {
                return alert("Gagal! Anda tidak memiliki hak akses untuk memodifikasi perawat dari ruangan lain.");
            }

            if (!exists) {
                await setDoc(doc(db, 'users', targetId), {
                    ...adminUserForm,
                    id: targetId,
                    ward: targetWard,
                    role: adminUserForm.role || 'member',
                    createdAt: Timestamp.now()
                });
                alert(`User baru "${adminUserForm.name}" berhasil ditambahkan ke Ruang ${targetWard}!`);
            } else {
                await updateDoc(doc(db, 'users', targetId), {
                    name: adminUserForm.name,
                    pass: adminUserForm.pass,
                    role: adminUserForm.role,
                    ward: targetWard
                });
                alert(`User "${adminUserForm.name}" berhasil diperbarui.`);
            }
            setAdminUserForm({ id: '', name: '', pass: '', role: 'member', ward: currentUser?.ward || 'MELATI' });
        } catch (e) { alert("Error: " + e.message); }
    };

    // 5. Action: Admin Hapus User
    const handleAdminDeleteUser = async (targetId) => {
        if (targetId === currentUser.id) return alert("Tidak bisa menghapus diri sendiri!");

        const targetUser = allUsers.find(u => u.id === targetId);
        if (['karu', 'admin_ruangan'].includes(currentUser?.role) && targetUser?.ward !== currentUser.ward) {
            return alert("Gagal! Anda hanya bisa menghapus anggota perawat di ruangan Anda sendiri.");
        }

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

    // --- PENCARIAN & FILTER + SORTIR KAMAR (ATURAN DR. DELVI DI DASHBOARD) ---
    const filteredActiveRecords = useMemo(() => {

        // 1. Cek apakah dr. Delvi sedang dipilih di dropdown filter atas
        const isDelviSelected = dpjpFilter.some(dr => dr.toLowerCase().includes('delvi'));

        const filtered = activeRecords.filter(rec => {
            // =====================================================================
            // 🧠 SENSOR DETEKSI PASIEN HD VERSI PINTAR (ANTI FALSE-POSITIF)
            // =====================================================================
            const textScan = `${rec.diagnosis || ''} ${rec.analysis || ''} ${rec.planning || ''}`.toLowerCase();

            // 🛑 1. LAYER PENGECUALIAN (Jika ada kata ini, BATALKAN balon HD rutin)
            const statusMenolak = textScan.includes('menolak hd') || textScan.includes('tolak hd') || textScan.includes('tidak mau hd');
            const statusProvisional = textScan.includes('dd ckd') || textScan.includes('susp ckd') || textScan.includes('susp. ckd') || textScan.includes('dd hd');

            // Proteksi khusus agar tidak bentrok dengan balon ungu (HD Inisiasi / Edukasi)
            const statusInisiasiAtauEdukasi = textScan.includes('inisiasi') || textScan.includes('edukasi hd');

            // 🎯 2. LAYER KONFIRMASI (Kata kunci dasar penanda kasus ginjal/HD)
            const adaKataKunciHD = textScan.includes('hd') || textScan.includes('ckd') || textScan.includes('hemodialisa');

            // 🏆 3. KEPUTUSAN AKHIR BALON HD
            // Balon merah HD hanya akan menyala jika ada kata kunci terkait,
            // BUKAN pasien menolak, BUKAN status diferensial (dd/susp), dan BUKAN kasus inisiasi/edukasi.
            const isHD = adaKataKunciHD && !statusMenolak && !statusProvisional && !statusInisiasiAtauEdukasi;

            // ✨ LOGIKA FILTER DASHBOARD
            // Loloskan pasien jika: Tidak ada filter DPJP, ATAU namanya cocok, ATAU (dr. Delvi dipilih DAN pasien ini HD)
            const matchesDpjp = dpjpFilter.length === 0 ||
                dpjpFilter.includes(rec.dpjpName) ||
                (isDelviSelected && isHD);

            const matchesRoom = selectedRoomFilter.length === currentWardConfig.roomList.length || selectedRoomFilter.includes(rec.roomNumber);
            const term = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                rec.name.toLowerCase().includes(term) ||
                (rec.analysis && rec.analysis.toLowerCase().includes(term)) ||
                (rec.dpjpName && rec.dpjpName.toLowerCase().includes(term)) ||
                (rec.rmNumber && rec.rmNumber.includes(term));

            return matchesDpjp && matchesRoom && matchesSearch;
        });

        // ✨ FIX 1: Terapkan aturan urutan kamar rute U
        // Hanya aktif jika filter DPJP spesifik memilih dr. Delvi saja (agar rapi saat visit)
        const isDelviOnly = dpjpFilter.length === 1 && dpjpFilter[0].toLowerCase().includes('delvi');

        if (isDelviOnly) {
            // Aturan Letter-U khusus dr. Delvi (Mundur dari K6 Kiri, Lanjut K7 Kanan)
            const uShapeBase = ['K6', 'K4', 'K2', 'K1', 'K3', 'K5', 'K7', 'K8', 'K9', 'K11', 'K12', 'K14', 'K15', 'K13', 'K10'];

            // Menerjemahkan uShapeBase ke nama kamar baru (P, KM) secara dinamis
            const uShapeOrder = uShapeBase.flatMap(k => {
                const regex = new RegExp('^' + k + '(P|KM)?$');
                return currentWardConfig.roomList.filter(r => regex.test(r));
            });

            return filtered.sort((a, b) => {
                let indexA = uShapeOrder.indexOf(a.roomNumber);
                let indexB = uShapeOrder.indexOf(b.roomNumber);
                if (indexA === -1) indexA = 999;
                if (indexB === -1) indexB = 999;
                return indexA - indexB;
            });
        }

        // Urutan default (A-Z / Numerik normal dari Kamar 1 sampai Ujung)
        return filtered.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

    }, [activeRecords, dpjpFilter, selectedRoomFilter, searchTerm, currentWardConfig]);

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

    // ✨ FIX DROPDOWN: Mengurutkan filter utama Dashboard berdasarkan Dokter Prioritas Ruangan (Sesuai image_7e06b0.png)
    const dpjpOptions = useMemo(() => {
        const names = dpjpProfiles.map(p => p.name);

        // Daftar dokter utama/prioritas di ruangan (dr. Susilo sudah dihapus karena pensiun)
        const priorityDocs = [
            "dr. Delvi, Sp.PD",
            "dr. Dian Ekowati, Sp.PD",
            "dr. Priyo, Sp.PD",
            "dr. Risa, Sp.PD",
            "dr. Evan, Sp.P",
        ];

        return [...names].sort((a, b) => {
            const idxA = priorityDocs.indexOf(a);
            const idxB = priorityDocs.indexOf(b);

            // Jika keduanya adalah dokter prioritas, urutkan sesuai index priorityDocs
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // Jika hanya A yang prioritas, naikkan ke atas
            if (idxA !== -1) return -1;
            // Jika hanya B yang prioritas, naikkan ke atas
            if (idxB !== -1) return 1;
            // Sisa dokter konsul lainnya diurutkan alfabetis biasa (A-Z)
            return a.localeCompare(b);
        });
    }, [dpjpProfiles]);

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
        } catch (e) {
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
        const updated = [...dpjpProfiles, newProfile].sort((a, b) => a.name.localeCompare(b.name));
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

    // --- MONITORING MEDICAL RECORDS (PASIEN AKTIF SAJA) ---
    useEffect(() => {
        if (!userId) return;
        const ref = getCollectionRef();
        if (!ref) return;

        // 1. QUERY SUPER CEPAT: Hanya tarik pasien yang belum pulang
        const q = query(ref, where('isDischarged', '==', false), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => {
                const docData = d.data();

                // --- TRANSLATOR NAMA KAMAR ---
                let updatedRoomNumber = docData.roomNumber || '';
                if (updatedRoomNumber.endsWith('B1')) {
                    updatedRoomNumber = updatedRoomNumber.replace('B1', 'A');
                } else if (updatedRoomNumber.endsWith('B2')) {
                    updatedRoomNumber = updatedRoomNumber.replace('B2', 'B');
                }

                return {
                    id: d.id, ...docData,
                    roomNumber: updatedRoomNumber,
                    createdAt: docData.createdAt?.toDate() || new Date(),
                    updatedAt: docData.updatedAt?.toDate() || null
                };
            });

            // ✨ ISOLASI BANGSAL (WARD)
            const currentWard = currentUser?.ward || 'MELATI';
            const active = data.filter(r => (r.ward || 'MELATI') === currentWard);

            setRecords(active);
            setActiveRecords(active);
            setOccupiedRooms(active.map(r => r.roomNumber));

        }, (err) => console.error("Firestore Error:", err));

        return () => unsubscribe();
    }, [getCollectionRef, userId, currentUser]);

    // ✨ FIX REKAP: Tarik data arsip diam-diam di background agar tabel rekap langsung terisi
    useEffect(() => {
        if (db && currentUser) {
            fetchArchivedRecords();
        }
    }, [db, currentUser]);

    // Tetap tarik ulang saat buka modal untuk memastikan data rekam medis lama paling update
    useEffect(() => {
        if (showInputModal) {
            fetchArchivedRecords();
        }
    }, [showInputModal]);

    // --- FUNGSI KHUSUS: TARIK DATA GUDANG ARSIP HANYA SAAT DIMINTA ---
    const fetchArchivedRecords = async () => {
        try {
            const ref = getCollectionRef();
            if (!ref) return;

            // Ambil data arsip yang status pulangnya TRUE (Dibatasi 500 agar tidak lemot)
            const q = query(ref, where('isDischarged', '==', true), orderBy('createdAt', 'desc'), limit(500));
            const snapshot = await getDocs(q);
            const archivedData = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id, ...docData,
                    createdAt: docData.createdAt?.toDate() || new Date(),
                    updatedAt: docData.updatedAt?.toDate() || null
                };
            });

            setArchivedRecords(archivedData);
        } catch (error) {
            console.error("Gagal mengambil data arsip:", error);
        }
    };

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

    // ✨ TEMPEL FUNGSI EKSEKUSI TUKAR BED DI SINI:
    const handleExecuteSwap = async (targetRoomNumber) => {
        if (!patientToSwap) return;

        const sourceRoom = patientToSwap.roomNumber;
        if (sourceRoom === targetRoomNumber) {
            alert("⚠️ Pasien sudah berada di bed tersebut.");
            return;
        }

        const occupant = activeRecords.find(r => r.roomNumber === targetRoomNumber);
        const safeAppId = appId || firebaseConfig?.appId || 'SIMPAN_APP';

        try {
            if (occupant) {
                const confirmSwap = window.confirm(`🔀 Bed ${targetRoomNumber} sudah diisi oleh ${occupant.name}.\n\nApakah Anda yakin ingin menukar posisi:\n${patientToSwap.name} (Bed ${sourceRoom})  🔄  ${occupant.name} (Bed ${targetRoomNumber})?`);
                if (!confirmSwap) return;

                const refSource = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, patientToSwap.id);
                const refOccupant = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, occupant.id);

                await Promise.all([
                    updateDoc(refSource, { roomNumber: targetRoomNumber }),
                    updateDoc(refOccupant, { roomNumber: sourceRoom })
                ]);
                alert(`✅ Berhasil menukar posisi ${patientToSwap.name} dan ${occupant.name}!`);
            } else {
                const confirmMove = window.confirm(`➡️ Pindahkan ${patientToSwap.name} ke Bed ${targetRoomNumber} yang kosong?`);
                if (!confirmMove) return;

                const refSource = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, patientToSwap.id);
                await updateDoc(refSource, { roomNumber: targetRoomNumber });
                alert(`✅ Berhasil memindahkan ${patientToSwap.name} ke Bed ${targetRoomNumber}!`);
            }

            setShowSwapModal(false);
            setPatientToSwap(null);
        } catch (error) {
            console.error("Error swapping bed:", error);
            alert("❌ Terjadi kesalahan saat memindahkan bed. Cek koneksi internet.");
        }
    };

    // ✨ FIX FINAL: MESIN PENGELOMPOK ADVIS OTOMATIS BERDASARKAN HARI/WAKTU YANG SAMA (V3)
    const appendText = (field, text) => {
        setFormData(p => {
            const current = p[field] || '';

            if (!text.trim()) return p;

            // 1. Jika kotak input masih kosong melompong, langsung masukkan teks pertama
            if (!current.trim()) {
                return { ...p, [field]: text.trim() };
            }

            // 2. Pecah komponen teks yang baru masuk (Prefix, Nama Item, dan Keterangan Waktu)
            // Regex mencari: Prefix (Lab. R/ dll), Nama Pemeriksaan, dan Kurung Siku [Waktu] di akhir
            const incomingMatch = text.match(/^(Lab\. R\/|Rad\. R\/|TM\.|Th\.|Lacak\/Lapor)\s*(.*?)\s*(\[[^\]]+\])?$/i);

            // Jika teks yang masuk tidak menggunakan prefix standar, lakukan append normal ke baris baru paling bawah
            if (!incomingMatch) {
                let lines = current.split('\n');
                const lastLine = lines[lines.length - 1];
                if (/^(?:🕒\s*)?\[[^\]]+\]\s*$/.test(lastLine.trim())) {
                    lines[lines.length - 1] = `${lastLine.trim()}\n${text.trim()}`;
                    return { ...p, [field]: lines.join('\n') };
                }
                return { ...p, [field]: `${current.trim()}\n${text.trim()}` };
            }

            const prefix = incomingMatch[1];                 // Contoh: "Lab. R/"
            const itemName = incomingMatch[2].trim();         // Contoh: "Tubex"
            const timeTag = (incomingMatch[3] || '').trim();   // Contoh: "[Sore Ini]"

            let lines = current.split('\n');
            let isMerged = false;

            // 3. Scan dari baris paling bawah ke atas untuk mencari pasangan yang cocok
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                const lineMatch = line.match(/^(Lab\. R\/|Rad\. R\/|TM\.|Th\.|Lacak\/Lapor)\s*(.*?)\s*(\[[^\]]+\])?$/i);

                if (lineMatch) {
                    const lPrefix = lineMatch[1];
                    const lItems = lineMatch[2].trim();
                    const lTimeTag = (lineMatch[3] || '').trim();

                    // Normalisasi spasi double agar pencocokan waktu super akurat
                    const normLTime = lTimeTag.toLowerCase().replace(/\s+/g, ' ');
                    const normTime = timeTag.toLowerCase().replace(/\s+/g, ' ');

                    // ⚡ SYARAT GABUNG: Prefix harus sama (misal sama-sama Lab) DAN Waktunya wajib kembar!
                    if (lPrefix.toLowerCase() === prefix.toLowerCase() && normLTime === normTime) {

                        // Cek pencegahan duplikat agar nama pemeriksaan yang sama tidak tertulis dua kali
                        const existingItems = lItems.split(',').map(item => item.trim().toLowerCase());
                        if (!existingItems.includes(itemName.toLowerCase())) {
                            // Masukkan ke baris yang sama, pisahkan dengan koma, pasang kembali label waktunya di ekor
                            lines[i] = `${lPrefix} ${lItems}, ${itemName}${timeTag ? ' ' + timeTag : ''}`;
                        }
                        isMerged = true;
                        break; // Stop pencarian karena sudah berhasil digabungkan
                    }
                }
            }

            // 4. Jika setelah di-scan tidak ditemukan hari/waktu yang cocok, buat baris baru di bawah
            if (!isMerged) {
                const lastLine = lines[lines.length - 1];

                // Proteksi penempatan stempel waktu perawat shift agar tidak tertimpa
                if (/^(?:🕒\s*)?\[[^\]]+\]\s*$/.test(lastLine.trim())) {
                    lines[lines.length - 1] = `${lastLine.trim()}\n${text.trim()}`;
                } else {
                    lines.push(text.trim());
                }
            }

            return { ...p, [field]: lines.join('\n') };
        });
    };

    // =====================================================================
    // ✨ MULTIUSER SOAP MERGE HELPERS (Atomic + Fuzzy Similarity Dedup)
    // =====================================================================

    // --- Hitung kemiripan 2 baris teks (0 = beda total, 1 = identik) ---
    // Pakai Jaccard similarity berbasis kata, cukup ringan & cukup akurat
    // untuk advis singkat seperti "Cek DL ulang besok" vs "DL ulang besok pagi"
    const lineSimilarity = (a, b) => {
        const normalize = (s) => (s || '')
            .toLowerCase()
            .replace(/^\[[^\]]*\]\s*/g, '') // buang tag [nama][jam] saat membandingkan
            .replace(/[^\w\s]/g, ' ')
            .trim();
        const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
        const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
        if (wordsA.size === 0 && wordsB.size === 0) return 1;
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        let intersection = 0;
        wordsA.forEach(w => { if (wordsB.has(w)) intersection++; });
        const union = wordsA.size + wordsB.size - intersection;
        return intersection / union;
    };

    // Ambang batas kemiripan: >= 0.75 dianggap "advis yang sama"
    const SIMILARITY_THRESHOLD = 0.75;

    // --- FORMAT BARU: HEADER TUNGGAL DI ATAS, BUKAN STAMPEL PER BARIS ---
    const tagNewLines = (text, authorName) => {
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
        const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const tag = `[${authorName.charAt(0).toUpperCase() + authorName.slice(1)}, ${dateStr} ${timeStr}]`;

        const cleanText = (text || '').trim();
        if (!cleanText) return '';
        return `${tag}\n${cleanText}`;
    };

    const getNewLines = (currentText, initialText) => {
        const cleanLines = (txt) => (txt || '').split('\n').map(l => l.trim()).filter(Boolean);
        const currentLines = cleanLines(currentText);
        const initialSet = new Set(cleanLines(initialText));
        return currentLines.filter(l => !initialSet.has(l));
    };

    const getRemovedLines = (currentText, initialText) => {
        const cleanLines = (txt) => (txt || '').split('\n').map(l => l.trim()).filter(Boolean);
        const currentSet = new Set(cleanLines(currentText));
        const initialLines = cleanLines(initialText);
        return initialLines.filter(l => !currentSet.has(l));
    };

    // --- SMART MERGE V4: Pemisahan Otak Klinis (Logika O vs P Mandiri) ---
    const smartMergeLines = (dbText, localNewText, removedLines = [], isPlanning = false) => {
        const cleanLines = (txt) => (txt || '').split('\n').map(l => l.trim()).filter(Boolean);

        const dbLines = cleanLines(dbText);
        const localLines = cleanLines(localNewText);

        const isHeaderLine = (l) => /^\[[A-Za-z0-9\s\-]+,\s*\d{1,2}\/\d{1,2}.*\]$/.test(l);

        // Parser cerdas dengan toleransi pembacaan format tahun opsional
        const parseHeader = (headerStr) => {
            const match = headerStr.match(/^\[([A-Za-z0-9\s\-]+),\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?(?:[\s,]+(\d{1,2})[:\.](\d{1,2}))?\]$/);
            if (!match) return null;
            return {
                author: match[1].trim(),
                day: parseInt(match[2], 10),
                month: parseInt(match[3], 10),
                hour: match[4] ? parseInt(match[4], 10) : 0,
                minute: match[5] ? parseInt(match[5], 10) : 0
            };
        };

        const stripTagsForCompare = (l) => {
            if (isHeaderLine(l)) return '';
            return l.replace(/^\[[A-Za-z0-9\s\-]+,\s*\d{1,2}\/\d{1,2}.*?\]\s*/, '')
                .replace(/\s*\[[^\]]+\]↔/g, '')
                .trim().toLowerCase();
        };

        const removedSet = new Set(removedLines.map(stripTagsForCompare).filter(Boolean));

        // Kelompokkan baris database dan lokal ke susunan blok terstruktur
        const parseBlocks = (lines, applyRemovedSet) => {
            const blocks = [];
            let currentBlock = null;
            lines.forEach(l => {
                if (isHeaderLine(l)) {
                    if (currentBlock) blocks.push(currentBlock);
                    currentBlock = { header: l, parsed: parseHeader(l), lines: [] };
                } else if (currentBlock) {
                    const comp = stripTagsForCompare(l);
                    if (!applyRemovedSet || !removedSet.has(comp)) {
                        currentBlock.lines.push(l);
                    }
                }
            });
            if (currentBlock) blocks.push(currentBlock);
            return blocks;
        };

        const dbBlocks = parseBlocks(dbLines, true);
        const localBlocks = parseBlocks(localLines, false);

        if (localBlocks.length === 0) {
            return dbBlocks.map(b => [b.header, ...b.lines].join('\n')).join('\n');
        }

        // Fungsi pembantu untuk melebur dua buah blok perawat
        const mergeTwoBlocks = (dbBlock, localBlock) => {
            const existingAuthor = dbBlock.parsed?.author || '';
            const localAuthor = localBlock.parsed?.author || '';
            let combinedAuthor = existingAuthor;

            if (existingAuthor.toLowerCase() !== localAuthor.toLowerCase() && !existingAuthor.toLowerCase().includes(localAuthor.toLowerCase())) {
                const capLocal = localAuthor.charAt(0).toUpperCase() + localAuthor.slice(1);
                combinedAuthor = `${capLocal}-${existingAuthor}`;
            }

            const timeMatch = localBlock.header.match(/^\[[A-Za-z0-9\s\-]+,(.*)\]$/);
            const newTimePart = timeMatch ? timeMatch[1].trim() : `${localBlock.parsed?.day}/${localBlock.parsed?.month}`;

            dbBlock.header = `[${combinedAuthor}, ${newTimePart}]`;
            if (dbBlock.parsed) dbBlock.parsed.author = combinedAuthor;

            localBlock.lines.forEach(newLine => {
                const newStripped = stripTagsForCompare(newLine);
                if (!newStripped) return;

                // Cek kecocokan teks mutlak atau berbasis kemiripan (untuk rencana tindakan)
                let matchIdx = dbBlock.lines.findIndex(oldLine => stripTagsForCompare(oldLine) === newStripped);
                if (matchIdx === -1) {
                    matchIdx = dbBlock.lines.findIndex(oldLine => lineSimilarity(stripTagsForCompare(oldLine), newStripped) >= SIMILARITY_THRESHOLD);
                }

                if (matchIdx !== -1) {
                    dbBlock.lines[matchIdx] = newLine;
                } else {
                    dbBlock.lines.push(newLine);
                }
            });
        };

        // Jalur pemisahan eksekusi logika
        localBlocks.forEach(localBlock => {
            if (!localBlock.parsed) return;

            let merged = false;
            for (let i = 0; i < dbBlocks.length; i++) {
                const dbBlock = dbBlocks[i];
                if (!dbBlock.parsed) continue;

                // Otak A: Khusus Kolom P (Planning) -> Cari kemiripan teks lintas jam tanpa batas waktu
                if (isPlanning) {
                    let hasSimilarLine = localBlock.lines.some(localLine => {
                        const localStripped = stripTagsForCompare(localLine);
                        return dbBlock.lines.some(dbLine => lineSimilarity(stripTagsForCompare(dbLine), localStripped) >= SIMILARITY_THRESHOLD);
                    });

                    if (hasSimilarLine) {
                        mergeTwoBlocks(dbBlock, localBlock);
                        merged = true;
                        break;
                    }
                }
                // Otak B: Kolom O (Objective/Lab) -> Gunakan sistem sensor ketat toleransi 30 menit
                else if (dbBlock.parsed.day === localBlock.parsed.day && dbBlock.parsed.month === localBlock.parsed.month) {
                    const dbTime = dbBlock.parsed.hour * 60 + dbBlock.parsed.minute;
                    const localTime = localBlock.parsed.hour * 60 + localBlock.parsed.minute;
                    const timeDiff = Math.abs(localTime - dbTime);

                    if (timeDiff <= 5) {
                        mergeTwoBlocks(dbBlock, localBlock);
                        merged = true;
                        break;
                    }
                }
            }

            if (!merged) {
                // Jika benar-benar baru, buat baris stempel terpisah di paling atas
                dbBlocks.unshift(localBlock);
            }
        });

        const finalLines = [];
        dbBlocks.forEach(b => {
            if (b.lines.length > 0) {
                finalLines.push(b.header);
                b.lines.forEach(l => finalLines.push(l));
                finalLines.push("");
            }
        });

        return finalLines.join('\n').trim();
    };

    const handleSubmit = async (e) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        if (!formData.name || !formData.roomNumber || !formData.dpjpName) {
            alert('Mohon lengkapi data wajib (Nama, Kamar, DPJP).');
            return;
        }

        const isRoomOccupied = occupiedRooms.includes(formData.roomNumber) &&
            (!isEditing || (isEditing && formData.roomNumber !== activeRecords.find(r => r.id === currentRecordId)?.roomNumber));

        if (!isEditing && isRoomOccupied) return alert(`Kamar ${formData.roomNumber} sudah terisi.`);

        const now = Timestamp.now();
        const myName = (currentUser?.name || 'perawat').split(' ')[0].toLowerCase();

        // ✨ PROSES UPLOAD GAMBAR (100% CLOUDINARY - BEBAS ERROR)
        const hasEvidence = formData.evidenceImages && formData.evidenceImages.length > 0;
        const hasRadiology = formData.radiologyImages && formData.radiologyImages.length > 0;

        // 🔥 Konfigurasi Cloudinary (Berlaku untuk Lampiran Luka & Radiologi)
        const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dnbijv4p1/image/upload";
        const CLOUDINARY_PRESET = "radiologi_preset";

        // 1. Upload Gambar Lampiran Biasa (Luka dll)
        let finalEvidenceImages = [];
        if (hasEvidence) {
            for (let img of formData.evidenceImages) {
                if (img && img.startsWith('data:image')) {
                    try {
                        const uploadData = new FormData();
                        uploadData.append("file", img);
                        uploadData.append("upload_preset", CLOUDINARY_PRESET);

                        const response = await fetch(CLOUDINARY_URL, {
                            method: "POST",
                            body: uploadData
                        });
                        const resultCloudinary = await response.json();

                        finalEvidenceImages.push(resultCloudinary.secure_url);
                    } catch (err) {
                        console.error("Gagal upload lampiran:", err);
                        alert("Gagal mengunggah foto luka. Pastikan internet stabil.");
                        return;
                    }
                } else {
                    // Jika sudah berupa link, langsung masukkan
                    finalEvidenceImages.push(img);
                }
            }
        }

        // 2. Upload Gambar Rontgen/Radiologi
        let finalRadiologyImages = [];
        if (hasRadiology) {
            for (let rad of formData.radiologyImages) {
                const currentImgData = rad.imageUrl || (typeof rad === 'string' ? rad : '');

                if (currentImgData && currentImgData.startsWith('data:image')) {
                    try {
                        const uploadData = new FormData();
                        uploadData.append("file", currentImgData);
                        uploadData.append("upload_preset", CLOUDINARY_PRESET);

                        const response = await fetch(CLOUDINARY_URL, {
                            method: "POST",
                            body: uploadData
                        });

                        const resultCloudinary = await response.json();

                        finalRadiologyImages.push({
                            ...rad,
                            imageUrl: resultCloudinary.secure_url
                        });
                    } catch (err) {
                        console.error("Gagal upload radiologi:", err);
                        alert(`Gagal mengunggah gambar ${rad.category || 'radiologi'}.`);
                        return;
                    }
                } else {
                    // Jika sudah berupa link, loloskan saja
                    finalRadiologyImages.push(rad);
                }
            }
        }

        // ✨ FIX: Menyiapkan data untuk dikirim ke database
        const baseData = {
            ...formData,
            evidenceImages: finalEvidenceImages,     // <--- Menggunakan Link URL
            radiologyImages: finalRadiologyImages,   // <--- Menggunakan Link URL
            subjective: (formData.subjective || '').trim(),
            objective: (formData.objective || '').trim(),
            analysis: (formData.analysis || '').trim(),
            planning: (formData.planning || '').trim(),
            // 💊 RESEP OBAT PERSISTEN: Selalu disimpan ke root dokumen
            currentPrescription: (formData.currentPrescription || '').trim(),
            admissionDate: parseDateCM(formData.admissionDate),
            updatedAt: now,
            ward: currentUser?.ward || 'MELATI'
        };

        // ✨ MULTIUSER: Field snapshot internal ini hanya dipakai untuk deteksi baris baru,
        // jangan ikut tersimpan ke Firestore.
        delete baseData.initialSubjective;
        delete baseData.initialObjective;
        delete baseData.initialAnalysis;
        delete baseData.initialPlanning;
        delete baseData.initialUpdatedAt;

        const ref = getCollectionRef();

        if (isEditing && currentRecordId) {
            const docRef = doc(ref, currentRecordId);
            const myDisplayName = (currentUser?.name || 'Perawat').split(' ')[0];

            // ✨ MODE PERSONAL: Simpan langsung ke laci pribadi, tidak sentuh root SOAP
            if (soapMode === 'personal') {
                try {
                    const personalKey = currentUser?.name || 'perawat';

                    // ✨ FIX 1: Ambil data dasar (kamar, dpjp, gambar rontgen/luka, dll)
                    let updateData = { ...baseData };

                    // Hapus S,O,A,P utama agar catatan ruangan tidak ikut tertimpa oleh draf pribadi
                    delete updateData.subjective;
                    delete updateData.objective;
                    delete updateData.analysis;
                    delete updateData.planning;

                    // Sisipkan data draf khusus ke laci personal
                    updateData[`personalNotes.${personalKey}.subjective`] = (formData.subjective || '').trim();
                    updateData[`personalNotes.${personalKey}.objective`] = (formData.objective || '').trim();
                    updateData[`personalNotes.${personalKey}.analysis`] = (formData.analysis || '').trim();
                    updateData[`personalNotes.${personalKey}.planning`] = (formData.planning || '').trim();
                    updateData[`personalNotes.${personalKey}.updatedAt`] = now;

                    // 💊 RESEP OBAT: Sifatnya instruksi medis ruangan (seumur hidup pasien),
                    // disimpan langsung ke ROOT dokumen (bukan ke personalNotes) agar persisten
                    // dan bisa dibaca oleh semua perawat serta PrintLayout.
                    updateData.currentPrescription = (formData.currentPrescription || '').trim();

                    await updateDoc(docRef, updateData);
                } catch (e) {
                    console.error("Gagal simpan catatan personal:", e);
                    alert("Gagal menyimpan catatan pribadi: " + (e.message || "periksa koneksi internet."));
                    return;
                }
                resetForm();
                setShowInputModal(false);
                return; // ← Selesai, tidak perlu lanjut ke logika ruangan
            }

            // ✨ MODE RUANGAN: Jalur lama — smartMergeLines ke root SOAP (catatan gabungan final)
            try {
                const docSnap = await getDoc(docRef);
                let result = { ...baseData };

                if (docSnap.exists()) {
                    const latestDbData = docSnap.data();

                    // --- Tracking "Tim Perawat Hari Ini" (reset otomatis tiap hari) ---
                    const lastUpdateDate = latestDbData.updatedAt?.toDate ? latestDbData.updatedAt.toDate() : new Date(0);
                    const today = new Date();
                    let newContributors = [];

                    if (lastUpdateDate.getDate() === today.getDate() && lastUpdateDate.getMonth() === today.getMonth() && lastUpdateDate.getFullYear() === today.getFullYear()) {
                        newContributors = Array.from(new Set([...(latestDbData.contributors || []), myName]));
                    } else {
                        newContributors = [myName];
                    }
                    result.contributors = newContributors;

                    const fields = ['subjective', 'objective', 'analysis', 'planning'];
                    fields.forEach((field) => {
                        const initialField = `initial${field.charAt(0).toUpperCase()}${field.slice(1)}`;
                        const newLines = getNewLines(baseData[field], formData[initialField]);
                        const removedLines = getRemovedLines(baseData[field], formData[initialField]);

                        if (newLines.length === 0 && removedLines.length === 0) {
                            result[field] = (latestDbData[field] || '').trim();
                        } else {
                            const taggedNewLines = newLines.length > 0 ? tagNewLines(newLines.join('\n'), myDisplayName) : '';
                            result[field] = smartMergeLines(latestDbData[field], taggedNewLines, removedLines, field === 'planning');
                        }
                    });
                } else {
                    result.contributors = [myName];
                    // Dokumen baru: tag semua baris SOAP yang diisi sebagai milik perawat ini
                    ['subjective', 'objective', 'analysis', 'planning'].forEach((field) => {
                        if (result[field]) result[field] = tagNewLines(result[field], myDisplayName);
                    });
                }

                // ✨ TABEL LAB MULTI-DATE + TIMESTAMP JAM: Sensitif terhadap koreksi ketat (Hiperkalemi / Gula Darah)
                const rebuildLabHistory = (objectiveText) => {
                    if (!objectiveText) return [];
                    const historyMap = {};
                    const lines = objectiveText.split('\n').map(l => l.trim()).filter(Boolean);

                    const today = new Date();
                    const dToday = String(today.getDate()).padStart(2, '0');
                    const mToday = String(today.getMonth() + 1).padStart(2, '0');
                    const timeToday = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
                    let currentDateTimeLabel = `${dToday}/${mToday}, ${timeToday}`;

                    lines.forEach(line => {
                        Object.keys(LAB_PATTERNS).forEach(key => {
                            // 🔓 Pintu blokir Gram/Sputum di laci penyimpanan utama sudah dicabut!
                            const match = line.match(LAB_PATTERNS[key]);
                            if (match && match[1]) {
                                if (!historyMap[currentDateTimeLabel]) historyMap[currentDateTimeLabel] = {};
                                if (!historyMap[currentDateTimeLabel][key]) {
                                    historyMap[currentDateTimeLabel][key] = match[1].trim().replace(',', '.');
                                }
                            }
                        });
                    });

                    return Object.entries(historyMap).map(([dateTime, values]) => ({ date: dateTime, values }))
                        .sort((a, b) => {
                            const parseDateTime = (str) => {
                                const parts = str.match(/(\d+)\/(\d+),\s*(\d+)\.(\d+)/);
                                if (parts) return new Date(2026, parts[2] - 1, parts[1], parts[3], parts[4]);
                                return new Date(0);
                            };
                            return parseDateTime(b.date) - parseDateTime(a.date);
                        }).slice(0, 10);
                };

                // ✨ FIX HYBRID MERGE: Mencegah kolom jam lama hilang saat teks ditimpa smartMerge
                const existingHistory = (docSnap && docSnap.exists() ? docSnap.data().labHistory : []) || [];
                const combinedHistoryMap = {};

                // 1. Selamatkan data masa lalu dari database (termasuk jam 18:48)
                existingHistory.forEach(item => {
                    if (item.date) {
                        combinedHistoryMap[item.date] = item.values || {};
                    }
                });

                // 2. Ekstrak data terbaru dari teks (jam 18:49)
                const parsedFromText = rebuildLabHistory(result.objective || '');
                parsedFromText.forEach(item => {
                    combinedHistoryMap[item.date] = {
                        ...(combinedHistoryMap[item.date] || {}),
                        ...item.values
                    };
                });

                // 3. Gabungkan dan urutkan semua jam dari yang terbaru ke terlama
                result.labHistory = Object.entries(combinedHistoryMap)
                    .map(([dateLabel, values]) => ({ date: dateLabel, values }))
                    .sort((a, b) => {
                        const parseDateTime = (str) => {
                            // Membaca format "19/06, 18.49" atau "19/06, 18:49"
                            const parts = str.match(/(\d+)\/(\d+)(?:,\s*(\d+)[:\.](\d+))?/);
                            if (parts) {
                                const day = parseInt(parts[1], 10);
                                const month = parseInt(parts[2], 10) - 1;
                                const hour = parts[3] ? parseInt(parts[3], 10) : 0;
                                const min = parts[4] ? parseInt(parts[4], 10) : 0;
                                return new Date(2026, month, day, hour, min);
                            }
                            return new Date(0);
                        };
                        return parseDateTime(b.date) - parseDateTime(a.date);
                    })
                    .slice(0, 10); // Batasi maksimal 10 kolom riwayat ke samping agar tidak kepanjangan

                await setDoc(docRef, result, { merge: true });
                const finalData = result;

                // Simpan rekaman ke Sub-Koleksi Notes (Riwayat) di luar transaksi
                if (db) {
                    // ✅ FIX: Ganti appId menjadi firebaseConfig.appId
                    const notesRef = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/notes`);
                    await addDoc(notesRef, {
                        ...finalData,
                        createdAt: now,
                        noteType: 'daily_update',
                        savedBy: currentUser?.name || 'System'
                    });
                }
            } catch (e) {
                console.error("Gagal update & merge:", e);
                alert("Gagal menyimpan: " + (e.message || "periksa koneksi internet, lalu coba simpan ulang."));
                return;
            }
        } else {
            // Mode Pasien Baru
            baseData.createdAt = now;
            baseData.contributors = [myName];

            // ✨ Inisialisasi labHistory untuk pasien baru (Format Seragam DD/MM/YY)
            const labSnapshot = extractLabSnapshot(baseData.objective || '');
            if (Object.keys(labSnapshot).length > 0) {
                const today = new Date();
                const d = String(today.getDate()).padStart(2, '0');
                const m = String(today.getMonth() + 1).padStart(2, '0');
                const y = String(today.getFullYear()).substring(2);
                const dateLabel = `${d}/${m}/${y}`;
                baseData.labHistory = [{ date: dateLabel, values: labSnapshot }];
            }

            // 🔥 PERBAIKAN: Gunakan 'await' dan panggil firebaseConfig.appId secara lengkap
            try {
                const newDoc = await addDoc(ref, baseData);
                if (db) {
                    // Perbaikan di baris ini: Menggunakan firebaseConfig.appId
                    const notesRef = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${newDoc.id}/notes`);
                    await addDoc(notesRef, {
                        ...baseData,
                        createdAt: now,
                        noteType: 'daily_update',
                        savedBy: currentUser?.name || 'System'
                    });
                }
            } catch (err) {
                console.error("Gagal tambah pasien:", err);
                alert("Gagal menambahkan pasien baru. Periksa jaringan Anda.");
                return;
            }
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
            const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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
        if (!window.confirm("Hapus antrean?")) return;
        try { await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, id)); } catch (e) { }
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
        if (!window.confirm(`Masukkan ${waitRec.name} ke kamar ${waitRec.plannedRoom}?`)) return;

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
        } catch (e) { console.error(e); }
    };

    const handleEdit = async (rec) => {
        const formatPrependOpen = (text) => {
            if (!text || !text.trim()) return '';
            const trimmed = text.trim();
            if (trimmed.startsWith('\n')) return trimmed;
            return `\n\n${trimmed}`;
        };

        // ✨ ENGINE SIKLUS SHIFT (Batas Hari Dinas: 15:00 WIB)
        const getShiftDay = (date) => {
            const d = new Date(date);
            // Jika masih sebelum jam 15:00 (misal 14:00), hitungannya masih ikut Shift Kemarin
            if (d.getHours() < 15) {
                d.setDate(d.getDate() - 1);
            }
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        };

        const lastUpdateDate = rec.updatedAt?.toDate ? rec.updatedAt.toDate() : new Date(0);
        const today = new Date();

        // Deteksi apakah form dibuka di hari Shift yang sama atau sudah ganti Shift
        const isSameShift = getShiftDay(lastUpdateDate) === getShiftDay(today);

        // Ekstraksi resep obat lama agar tidak ikut terhapus
        const extractPrescription = (pText) => {
            if (!pText) return '';
            const match = pText.match(/\[RESEP OBAT\]:([\s\S]*)/i);
            return match ? match[1].trim() : '';
        };
        const activePrescription = rec.currentPrescription || extractPrescription(rec.planning);

        setFormData({
            roomNumber: rec.roomNumber,
            name: rec.name,
            rmNumber: rec.rmNumber || '',
            gender: rec.gender || '',
            dpjpName: rec.dpjpName,
            raberName: rec.raberName || '',
            raber2Name: rec.raber2Name || '',

            // ✨ MODE SOAP: Ambil S-O-A-P dari laci yang sesuai
            // Mode 'personal' → baca dari personalNotes[namaku] (draft pribadi)
            // Mode 'ruangan'  → baca dari root dokumen (catatan gabungan final)
            ...(() => {
                const isPersonal = soapMode === 'personal';
                const src = isPersonal
                    ? (rec.personalNotes?.[currentUser?.name] || {})
                    : rec;
                return {
                    subjective: formatPrependOpen(src.subjective || ''),
                    objective: formatPrependOpen(src.objective || ''),
                    analysis: formatPrependOpen(src.analysis || ''),
                    planning: formatPrependOpen(src.planning || ''),
                    initialSubjective: (src.subjective || '').trim(),
                    initialObjective: (src.objective || '').trim(),
                    initialAnalysis: (src.analysis || '').trim(),
                    initialPlanning: (src.planning || '').trim(),
                };
            })(),

            // 💊 RESEP OBAT DIKUNCI: Tetap bertahan seumur hidup
            currentPrescription: activePrescription,

            isDischarged: false,
            evidenceImages: rec.evidenceImages || [],
            bpjsClass: rec.bpjsClass || '',
            admissionDate: rec.admissionDate || '',
            initialUpdatedAt: rec.updatedAt || null,
            contributors: rec.contributors || [],
            radiologyImages: rec.radiologyImages || []
        });

        setCurrentRecordId(rec.id);
        setIsEditing(true);
        setShowRaber1(!!rec.raberName);
        setShowRaber2(!!rec.raber2Name);
        setShowInputModal(true);
    };

    // ✨ PUBLIKASIKAN KE RUANGAN: Merge catatan pribadi perawat ke root SOAP (catatan gabungan).
    // Bisa dipanggil dari tombol di kartu Ontang-anting (Cara C) ATAU tombol di header
    // modal form saat mode personal aktif (Cara A).
    // ✨ PUBLIKASIKAN KE RUANGAN: Merge catatan pribadi perawat ke root SOAP (catatan gabungan).
    const handlePublishToRoom = async (rec) => {
        if (!rec || !rec.id) return;
        const myName = currentUser?.name || 'perawat';
        const myDisplayName = myName.split(' ')[0];
        const personalNotes = rec.personalNotes?.[myName] || {};

        // Tidak ada catatan pribadi → tidak ada yang dipublikasikan
        const hasContent = ['subjective', 'objective', 'analysis', 'planning']
            .some(f => (personalNotes[f] || '').trim());
        if (!hasContent) {
            alert('Belum ada catatan pribadi untuk dipublikasikan ke ruangan.');
            return;
        }

        try {
            const ref = getCollectionRef();
            const docRef = doc(ref, rec.id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) { alert('Data pasien tidak ditemukan.'); return; }

            const latestDbData = docSnap.data();
            const now = Timestamp.now();
            const myShortName = myDisplayName.charAt(0).toUpperCase() + myDisplayName.slice(1);

            // Merge tiap field pribadi ke root
            const update = { updatedAt: now };
            const fields = ['subjective', 'objective', 'analysis', 'planning'];
            fields.forEach(field => {
                const personalText = (personalNotes[field] || '').trim();
                if (!personalText) {
                    update[field] = latestDbData[field] || '';
                    return;
                }
                const tagged = tagNewLines(personalText, myShortName);
                update[field] = smartMergeLines(latestDbData[field] || '', tagged, [], field === 'planning');
            });

            // ✨ FIX 2: Buka gerbang Gram/Sputum saat draf pribadi dipublikasikan ke ruangan
            const rebuildLabHistory = (objectiveText) => {
                if (!objectiveText) return [];
                const historyMap = {};
                const lines = objectiveText.split('\n').map(l => l.trim()).filter(Boolean);

                const today = new Date();
                const dToday = String(today.getDate()).padStart(2, '0');
                const mToday = String(today.getMonth() + 1).padStart(2, '0');
                const timeToday = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
                let currentDateTimeLabel = `${dToday}/${mToday}, ${timeToday}`;

                lines.forEach(line => {
                    Object.keys(LAB_PATTERNS).forEach(key => {
                        // 🔓 Pintu blokir Gram/Sputum di laci publikasi juga sudah dicabut!
                        const match = line.match(LAB_PATTERNS[key]);
                        if (match && match[1]) {
                            if (!historyMap[currentDateTimeLabel]) historyMap[currentDateTimeLabel] = {};
                            if (!historyMap[currentDateTimeLabel][key]) {
                                historyMap[currentDateTimeLabel][key] = match[1].trim().replace(',', '.');
                            }
                        }
                    });
                });

                return Object.entries(historyMap).map(([dateTime, values]) => ({ date: dateTime, values }))
                    .sort((a, b) => {
                        const parseDateTime = (str) => {
                            const parts = str.match(/(\d+)\/(\d+),\s*(\d+)\.(\d+)/);
                            if (parts) return new Date(2026, parts[2] - 1, parts[1], parts[3], parts[4]);
                            return new Date(0);
                        };
                        return parseDateTime(b.date) - parseDateTime(a.date);
                    }).slice(0, 10);
            };

            const existingHistory = latestDbData.labHistory || [];
            const combinedHistoryMap = {};
            existingHistory.forEach(item => { if (item.date) combinedHistoryMap[item.date] = item.values || {}; });

            const parsedFromText = rebuildLabHistory(update.objective || '');
            parsedFromText.forEach(item => {
                combinedHistoryMap[item.date] = { ...(combinedHistoryMap[item.date] || {}), ...item.values };
            });

            update.labHistory = Object.entries(combinedHistoryMap)
                .map(([dateLabel, values]) => ({ date: dateLabel, values }))
                .sort((a, b) => {
                    const parseDateTime = (str) => {
                        const parts = str.match(/(\d+)\/(\d+)(?:,\s*(\d+)[:\.](\d+))?/);
                        if (parts) {
                            const day = parseInt(parts[1], 10);
                            const month = parseInt(parts[2], 10) - 1;
                            const hour = parts[3] ? parseInt(parts[3], 10) : 0;
                            const min = parts[4] ? parseInt(parts[4], 10) : 0;
                            return new Date(2026, month, day, hour, min);
                        }
                        return new Date(0);
                    };
                    return parseDateTime(b.date) - parseDateTime(a.date);
                }).slice(0, 10);

            // Update kontributor hari ini
            const lastDate = latestDbData.updatedAt?.toDate ? latestDbData.updatedAt.toDate() : new Date(0);
            const today = new Date();
            const sameDay = lastDate.getDate() === today.getDate() && lastDate.getMonth() === today.getMonth() && lastDate.getFullYear() === today.getFullYear();
            const myShortLower = myName.split(' ')[0].toLowerCase();
            update.contributors = sameDay ? Array.from(new Set([...(latestDbData.contributors || []), myShortLower])) : [myShortLower];

            await setDoc(docRef, update, { merge: true });

            // ✨ Opsional: Mengosongkan draf pribadi setelah sukses dipublish agar rapi
            const clearDraft = {
                [`personalNotes.${myName}.subjective`]: '',
                [`personalNotes.${myName}.objective`]: '',
                [`personalNotes.${myName}.analysis`]: '',
                [`personalNotes.${myName}.planning`]: '',
            };
            await updateDoc(docRef, clearDraft);

            alert(`✅ Catatan ${myDisplayName} berhasil dipublikasikan ke Mode Ruangan.`);
        } catch (e) {
            console.error('Gagal publikasi ke ruangan:', e);
            alert('Gagal mempublikasikan: ' + (e.message || 'periksa koneksi internet.'));
        }
    };
    const handleAddRadiologyImage = (newImages) => {
        setFormData(prev => ({
            ...prev,
            radiologyImages: [...(prev.radiologyImages || []), ...newImages]
        }));
    };

    const handleRemoveRadiologyImage = (imageId) => {
        setFormData(prev => ({
            ...prev,
            radiologyImages: (prev.radiologyImages || []).filter(img => img.id !== imageId)
        }));
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
            fetchArchivedRecords();
        } catch (e) { console.error(e); } finally { setLoading(false); setRecordForDischarge(null); }
    };

    const normalizePhone = (num) => {
        if (!num) return '';
        const digits = String(num).replace(/\D/g, '');
        if (digits.startsWith('0')) return '62' + digits.substring(1);
        if (digits.startsWith('8')) return '62' + digits;
        return digits;
    };


    // --- FUNGSI 1: LAPOR JUMLAH KE DPJP (DENGAN FILTER TOLERANSI SALAM) ---
    const handleReportDpjpCount = (drName, count) => {
        const profile = dpjpProfiles.find(p => p.name === drName);
        const phone = profile ? normalizePhone(profile.waNumber) : '';
        if (!phone) return alert(`Nomor WA ${drName} belum disetting.`);

        // 🤖 Pembangkit Salam Waktu Lokal
        const h = new Date().getHours();
        let salam = "Selamat Malam";
        if (h >= 4 && h < 10) salam = "Selamat Pagi";
        else if (h >= 10 && h < 15) salam = "Selamat Siang";
        else if (h >= 15 && h < 18) salam = "Selamat Sore";

        // ✨ LOGIKA SALAM KHUSUS (Toleransi Agama)
        const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
        const isNonMuslim = nonMuslimDoctors.some(name => drName.toLowerCase().includes(name.toLowerCase()));
        const prefixSalam = isNonMuslim ? salam : `Assalamualaikum, ${salam}`;

        const text = `${prefixSalam} dokter, saya ${currentUser?.name} dari Ruang ${currentWardConfig.name}. Izin melaporkan jumlah pasien dokter hari ini ada ${count} pasien ya dok. Terima kasih.`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // --- FUNGSI 2: LAPOR KE RABER / KONSUL (DENGAN FILTER TOLERANSI SALAM & PESAN DR. EDI) ---
    const handleReportRaber = (drName, patientNames) => {
        const profile = dpjpProfiles.find(p => p.name === drName);
        const phone = profile ? normalizePhone(profile.waNumber) : '';

        if (!phone) return alert(`Nomor WA ${drName} belum disetting di Master Data.`);

        // 🤖 Pembangkit Salam Waktu Lokal
        const h = new Date().getHours();
        let salam = "Selamat Malam";
        if (h >= 4 && h < 10) salam = "Selamat Pagi";
        else if (h >= 10 && h < 15) salam = "Selamat Siang";
        else if (h >= 15 && h < 18) salam = "Selamat Sore";

        // ✨ LOGIKA SALAM KHUSUS (Toleransi Agama)
        const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
        const isNonMuslim = nonMuslimDoctors.some(name => drName.toLowerCase().includes(name.toLowerCase()));
        const prefixSalam = isNonMuslim ? salam : `Assalamualaikum, ${salam}`;

        let text = '';

        // ✨ LOGIKA PESAN KHUSUS DR. EDI
        if (drName.toLowerCase().includes('edi')) {
            text = `Assalamualaikum dokter, ini ${currentUser?.name} dari Ruang ${currentWardConfig.name}, mengingatkan ada pasien HD atas nama: ${patientNames.join(', ')}`;
        }
        // Logika pesan untuk dokter raber lainnya
        else {
            text = `${prefixSalam} dokter, saya ${currentUser?.name} dari Ruang ${currentWardConfig.name}. Izin mengingatkan hari ini ada pasien Raber ya dok a.n ${patientNames.join(', ')}. Terima kasih.`;
        }

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
        let salam = '';

        // 1. BUAT SALAM OTOMATIS BERDASARKAN WAKTU
        const h = new Date().getHours();
        let salamWaktu = "Selamat Malam";
        if (h >= 4 && h < 10) salamWaktu = "Selamat Pagi";
        else if (h >= 10 && h < 15) salamWaktu = "Selamat Siang";
        else if (h >= 15 && h < 18) salamWaktu = "Selamat Sore";

        if (type === 'DPJP') {
            const profile = dpjpProfiles.find(p => p.name === rec.dpjpName);
            targetNumber = normalizePhone(profile?.waNumber);
            if (!targetNumber) return alert(`Nomor WA ${rec.dpjpName} belum disetting.`);

            // ✨ FIX 1: Hapus getDoctorGreeting yang bikin error! Kita pakai logika array pintar
            const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
            const isNonMuslim = nonMuslimDoctors.some(name => (rec.dpjpName || '').toLowerCase().includes(name.toLowerCase()));
            salam = isNonMuslim ? salamWaktu : `Assalamualaikum, ${salamWaktu}`;
        } else {
            salam = `Assalamualaikum, ${salamWaktu}`;
        }

        // ✨ MESIN PEMILAH GENDER & USIA (MEMBACA TEKS NAMA)
        const getPatientTitle = (pRecord) => {
            const nameStr = String(pRecord?.name || '').toLowerCase().trim();
            const genderStr = String(pRecord?.gender || '').toLowerCase().trim();

            // 1. CEGAH GELAR GANDA
            if (/^(tn\.|ny\.|an\.|nn\.|by\.|sdr\.)\s/i.test(nameStr)) return "";

            // 2. DETEKSI BAYI/BALITA
            if (nameStr.includes('bln') || nameStr.includes('bulan') || nameStr.includes('hari') || nameStr.includes('by')) return "An. ";

            // 3. DETEKSI ANAK DARI ANGKA TAHUN
            const ageMatch = nameStr.match(/(?:^|\(|\s)(\d+)\s*(?:th|tahun|thn)/i);
            if (ageMatch && parseInt(ageMatch[1]) < 15) return "An. ";

            // 4. DEFAULT DEWASA BERDASARKAN GENDER
            if (genderStr === 'l' || genderStr.includes('laki')) return "Tn. ";
            if (genderStr === 'p' || genderStr.includes('perempuan') || genderStr.includes('wanita')) return "Ny. ";
            return "";
        };

        // ✨ MESIN PEMBERSIH STEMPEL KHUSUS WA
        const cleanForWA = (txt) => (txt || '').replace(/\[[^\]]+,\s*\d{1,2}\/\d{1,2}.*?\]\s*/g, '').trim();

        const patientTitle = getPatientTitle(rec);

        // Bersihkan Planning sebelum dipecah
        const { labs, rads, tms, others } = parsePlanning(cleanForWA(rec.planning));
        let planningText = [...others.filter(Boolean), labs.length > 0 ? `Lab: ${labs.join(', ')}` : null, rads.length > 0 ? `Rad: ${rads.join(', ')}` : null, tms.length > 0 ? `Tndkn: ${tms.join(', ')}` : null].filter(Boolean).join('\n');

        // ✨ FIX FINAL: BUANG LOOP BREAKDOWN AUTOMATIS (LAB, RAD, TM)
        // Kita langsung ambil teks mentah dari kotak P yang sudah dibersihkan untuk WA
        planningText = cleanForWA(rec.planning) || '-';

        // =====================================================================
        // ✨ FIX 2: SUNTIKKAN RESEP OBAT (CPO) KEMBALI KE DALAM TEKS WA (P)
        // =====================================================================
        if (rec.currentPrescription && rec.currentPrescription.trim()) {
            planningText += `\n\n*Terapi / Obat saat ini:*\n${cleanForWA(rec.currentPrescription)}`;
        }

        const dpjpInfo = type === 'Forward' ? `\nDPJP: ${rec.dpjpName || '-'}` : '';

        // ✨ FORMAT BARU (Nama Pasien Dibold Biar Elegan)
        const text = `${salam} dokter, saya ${currentUser?.name} dari Ruang ${currentWardConfig.name}. Izin lapor pasien:\n\n*${patientTitle}${rec.name}* ${dpjpInfo}\n\n*S:*\n${cleanForWA(rec.subjective) || '-'}\n\n*O:*\n${cleanForWA(rec.objective) || '-'}\n\n*A:*\n${cleanForWA(rec.analysis) || '-'}\n\n*P:*\n${planningText}\n\nMohon advisnya dokter,\nTerima kasih.`;

        try {
            await navigator.clipboard.writeText(text);
            if (rec.evidenceImages && rec.evidenceImages.length > 0) {
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
            if (typeof fetchArchivedRecords === 'function') {
                fetchArchivedRecords();
            }
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

    // ✨ FUNGSI HANTU: Mengamankan prop CPO lintas komponen agar tidak blank putih
    const handlePrintCPO = () => { };

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

    // ✨ FUNGSI HANTU: Menjaga prop React agar tidak crash/blank putih
    const handlePrintLabel = () => { };

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

    // --- STATS CALCULATION (VERSI SUPER: MULTI-SUFFIX KEBAL STEMPEL PERAWAT) ---
    const stats = useMemo(() => {
        const currentWard = currentUser?.ward || 'MELATI';
        const currentWardConfig = WARD_CONFIG[currentWard] || WARD_CONFIG['MELATI'];

        // 1. Saring data pasien aktif yang saat ini sedang dirawat di bangsal
        const wardActiveRecords = activeRecords.filter(r => (r.ward || 'MELATI') === currentWard);

        // 2. GABUNGKAN data records ruangan saat ini dengan data dari Gudang Arsip (archivedRecords)
        const wardRecords = records.filter(r => (r.ward || 'MELATI') === currentWard);
        const wardArchivedRecords = (archivedRecords || []).filter(r => (r.ward || 'MELATI') === currentWard);
        const combinedRecords = [...wardRecords, ...wardArchivedRecords];

        const s = {
            total: combinedRecords.length,
            active: wardActiveRecords.length,
            discharged: combinedRecords.filter(r => r.isDischarged || r.status === 'discharged').length,
            monthly: {},
            dpjpCounts: {},
            raberData: {},
            emptyCount: 0,
            emptyMale: 0,
            emptyFemale: 0
        };

        const occupied = wardActiveRecords.map(r => r.roomNumber);

        // ✨ FIX BUG 2: Regex multi-suffix mendukung KM/P (Melati) dan A/B/C/D (Bangsal Lain)
        currentWardConfig.roomList.forEach(room => {
            if (!occupied.includes(room)) {
                const match = room.match(/^(K\d+)(KM|P|A|B|C|D)$/i);
                if (!match) {
                    s.emptyCount++;
                } else {
                    const roomCode = match[1];
                    const bedCode = match[2].toUpperCase();

                    // Saklar tukar pasangan bed dinamis universal
                    let neighborBed = '';
                    if (bedCode === 'KM') neighborBed = 'P';
                    else if (bedCode === 'P') neighborBed = 'KM';
                    else if (bedCode === 'A') neighborBed = 'B';
                    else if (bedCode === 'B') neighborBed = 'A';
                    else if (bedCode === 'C') neighborBed = 'D';
                    else if (bedCode === 'D') neighborBed = 'C';

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

        // Kalkulasi rekap grafik bulanan
        combinedRecords.forEach(r => {
            if (!r.createdAt) return;

            const dateObj = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            const m = dateObj.toLocaleString('id-ID', { month: 'short', year: 'numeric' });

            if (!s.monthly[m]) s.monthly[m] = { active: 0, discharged: 0, pulang: 0, pindah: 0, meninggal: 0, lab: 0, rad: 0, tm: 0 };

            if (r.isDischarged || r.status === 'discharged') {
                s.monthly[m].discharged++;
                if (r.dischargeType === 'pindah') s.monthly[m].pindah++;
                else if (r.dischargeType === 'meninggal') s.monthly[m].meninggal++;
                else s.monthly[m].pulang++;
            } else {
                s.monthly[m].active++;
            }

            // ✨ FIX BUG 3: Gunakan parsePlanning bawaan agar hitungan kebal dari stempel dinas perawat
            if (r.planning) {
                const parsed = parsePlanning(r.planning);
                s.monthly[m].lab += (parsed.labs || []).length;
                s.monthly[m].rad += (parsed.rads || []).length;
                s.monthly[m].tm += (parsed.tms || []).length;
            }
        });

        // 3. Hitung jumlah beban pasien per dokter spesialis di bangsal aktif
        const hariIniStats = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

        wardActiveRecords.forEach(rec => {
            s.dpjpCounts[rec.dpjpName] = (s.dpjpCounts[rec.dpjpName] || 0) + 1;

            [rec.raberName, rec.raber2Name].forEach(dr => {
                if (dr) {
                    if (!s.raberData[dr]) s.raberData[dr] = [];
                    if (!s.raberData[dr].includes(rec.name)) s.raberData[dr].push(rec.name);
                }
            });

            const gabunganTeksSOAP = `${rec.diagnosis || ''} ${rec.analysis || ''} ${rec.planning || ''}`.toLowerCase();

            // 🛑 Pengecualian agar dr. Edi tidak terseret ke pasien Suspek / Menolak HD
            const statusProvisional = gabunganTeksSOAP.includes('dd ckd') || gabunganTeksSOAP.includes('susp ckd') || gabunganTeksSOAP.includes('susp. ckd') || gabunganTeksSOAP.includes('dd hd') || gabunganTeksSOAP.includes('aki dd');
            const statusMenolak = gabunganTeksSOAP.includes('menolak') || gabunganTeksSOAP.includes('tolak') || gabunganTeksSOAP.includes('tidak mau') || gabunganTeksSOAP.includes('belum bersedia');

            // Hanya eksekusi perhitungan jika benar-benar pasien HD murni/rutin
            const isHD = /hd|ckd|hemodialisa/i.test(gabunganTeksSOAP) && !statusProvisional && !statusMenolak;

            if (isHD) {
                let isJadwalHariIni = false;
                if (gabunganTeksSOAP.includes('senin-kamis') || gabunganTeksSOAP.includes('senin kamis')) {
                    isJadwalHariIni = ['senin', 'kamis'].includes(hariIniStats);
                } else if (gabunganTeksSOAP.includes('selasa-jumat') || gabunganTeksSOAP.includes('selasa jumat')) {
                    isJadwalHariIni = ['selasa', 'jumat'].includes(hariIniStats);
                } else if (gabunganTeksSOAP.includes('rabu-sabtu') || gabunganTeksSOAP.includes('rabu sabtu')) {
                    isJadwalHariIni = ['rabu', 'sabtu'].includes(hariIniStats);
                } else {
                    isJadwalHariIni = true;
                }

                if (isJadwalHariIni) {
                    const namaDrEdi = "dr. Edi";
                    if (!s.raberData[namaDrEdi]) s.raberData[namaDrEdi] = [];
                    const hasManualEdi = [rec.raberName, rec.raber2Name].some(dr => dr && dr.toLowerCase().includes('edi'));

                    if (!hasManualEdi && !s.raberData[namaDrEdi].includes(rec.name)) {
                        s.raberData[namaDrEdi].push(rec.name);
                    }
                }
            }
        }); // 🔓 SUNTIKAN AMAN: Menutup loop wardActiveRecords dengan sempurna!

        return s;
    }, [records, activeRecords, archivedRecords, currentUser]);

    // ✨ FITUR BARU: MESIN PEMINDAI AGENDA + AUTO SORTING + RESPONSIF FILTER DASHBOARD (V10 - FINAL)
    const agendaHariIni = useMemo(() => {
        const agendas = [];
        const today = new Date();

        const namaHariIni = today.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
        const d = today.getDate();
        const m = today.getMonth() + 1;
        const y2 = today.getFullYear().toString().slice(-2);
        const y4 = today.getFullYear();

        const tglVariasi = [
            `${d}/${m}`, `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            `${d}/${m}/${y2}`, `${d}/${m}/${y4}`
        ];

        // ⚡ FIX KUNCI UTAMA: Menggunakan filteredActiveRecords agar sinkron dengan filter dashboard atas!
        filteredActiveRecords.forEach(rec => {
            if (!rec.planning) return;

            const { labs, rads, tms } = parsePlanning(rec.planning);
            const allActions = [...labs, ...rads, ...tms];

            const lastUpdate = rec.updatedAt?.toDate ? rec.updatedAt.toDate() : (rec.updatedAt ? new Date(rec.updatedAt) : new Date());
            const isUpdatedToday = lastUpdate.getDate() === today.getDate() && lastUpdate.getMonth() === today.getMonth();

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const isUpdatedYesterday = lastUpdate.getDate() === yesterday.getDate() && lastUpdate.getMonth() === yesterday.getMonth();

            allActions.forEach(action => {
                const lowerAction = action.toLowerCase();
                let isTargetToday = false;

                // Radar A: Deteksi Hari & Tanggal Angka murni
                if (lowerAction.includes(namaHariIni)) isTargetToday = true;
                if (tglVariasi.some(tgl => lowerAction.includes(tgl))) isTargetToday = true;

                // Radar B: Deteksi Sore/Malam dinas berjalan
                if (isUpdatedToday && (lowerAction.includes('sore') || lowerAction.includes('malam') || lowerAction.includes('nanti'))) {
                    isTargetToday = true;
                }

                // Radar C: Deteksi kata "Besok" yang ditulis kemarin (Mundur 1 hari)
                if (isUpdatedYesterday && (lowerAction.includes('besok') || lowerAction.includes('bsk'))) {
                    isTargetToday = true;
                }

                // Radar D: Deteksi kata kustom manual dari Smart Planning
                if (lowerAction.includes('sekarang') || lowerAction.includes('hari ini')) {
                    isTargetToday = true;
                }

                if (isTargetToday) {
                    let icon = '📋';
                    if (rads.includes(action)) icon = '🩻';
                    else if (labs.includes(action)) icon = '🩸';
                    else if (tms.includes(action)) icon = '💉';

                    let cleanedAction = action;
                    const todayRegex = new RegExp(`\\[[^\\]]*(${tglVariasi.join('|')}|sekarang|hari ini)[^\\]]*\\]`, 'gi');

                    if (todayRegex.test(cleanedAction)) {
                        cleanedAction = cleanedAction.replace(todayRegex, '[Hari Ini]');
                    } else {
                        cleanedAction = cleanedAction.replace(/\b(besok|bsk|sekarang|hari ini)\b/gi, '[Hari Ini]');
                    }

                    agendas.push({
                        id: rec.id,
                        room: rec.roomNumber || '',
                        name: rec.name,
                        dpjp: rec.dpjpName,
                        action: cleanedAction,
                        icon: icon
                    });
                }
            });
        });

        // =====================================================================
        // ⚡ ENGINE PENGURUT KAMAR ALAMI (Urut dari K1, K2... K15 secara tertib)
        // =====================================================================
        agendas.sort((a, b) => {
            const numA = parseInt((a.room.match(/\d+/)?.[0] || '999'), 10);
            const numB = parseInt((b.room.match(/\d+/)?.[0] || '999'), 10);

            if (numA !== numB) return numA - numB;
            return a.room.localeCompare(b.room);
        });

        return agendas;
    }, [filteredActiveRecords]); // ⚡ DEPENDENCY UTAMA DIKUNCI KE DATA FILTERED

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
                                        {dpjpFilter.length > 0 || selectedRoomFilter.length !== currentWardConfig.roomList.length || searchTerm ? 'Filter Aktif' : 'Semua'}
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

                            // ✨ KABEL TUKAR BED DITANCAPKAN DI SINI:
                            onSwapBed={(rec) => { setPatientToSwap(rec); setShowSwapModal(true); }}
                        />
                    </div>
                </div>
            </div>
            {/* === SISI KANAN: DYNAMIC PANEL (SOAP vs STATS) === */}
            <div className="lg:col-span-6 h-[calc(100vh-140px)] flex flex-col">

                {/* 1. TOMBOL SAKLAR */}
                <div className="flex bg-white p-1 rounded-lg border border-indigo-200 mb-3 shrink-0 shadow-sm">

                    {/* 📝 TAB 1: E-ONTANG ANTING (KOMPAK TRIPLE-SECTION) */}
                    <div
                        onClick={() => setRightDashboardTab('soap-apo')}
                        className={`flex-1 flex items-center justify-between px-2 rounded-md transition cursor-pointer select-none ${rightDashboardTab === 'soap-apo' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                    >
                        {/* SISI KIRI: Micro Toggle Mode (Locker e.stopPropagation agar tidak bentrok klik tab) */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className={`text-[8px] font-black tracking-tighter ${rightDashboardTab === 'soap-apo' ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {soapMode === 'personal' ? '🙋 Pribadi' : '🏥 Ruangan'}
                            </span>
                            <button
                                onClick={() => setSoapMode(m => m === 'personal' ? 'ruangan' : 'personal')}
                                className={`relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${soapMode === 'ruangan' ? 'bg-emerald-400' : 'bg-slate-300'
                                    }`}
                                role="switch"
                                aria-checked={soapMode === 'ruangan'}
                            >
                                <span className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${soapMode === 'ruangan' ? 'translate-x-2.5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* SISI TENGAH: Judul Tab Utama */}
                        <span className="text-xs font-black text-center flex-1 py-1.5">
                            📝 E-Ontang-Anting
                        </span>

                        {/* SISI KANAN: Tombol Cetak Sel (Diberi width pengunci agar judul tengah tetap presisi simetris) */}
                        <div className="w-14 flex justify-end" onClick={(e) => e.stopPropagation()}>
                            {rightDashboardTab === 'soap-apo' && (
                                <button
                                    onClick={() => setShowBulkPrint(true)}
                                    className="no-print bg-white text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm flex items-center gap-0.5 transition animate-in fade-in zoom-in-95 duration-150"
                                    title="Cetak Seluruh Kartu E-Ontang-Anting"
                                >
                                    🖨️ Cetak
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 📊 TAB 2: STATISTIK */}
                    <button
                        onClick={() => setRightDashboardTab('stats')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 ${rightDashboardTab === 'stats' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        <span>📊 Antrean & Statistik</span>
                        {waitingList && waitingList.length > 0 && (
                            <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px] animate-pulse">{waitingList.length}</span>
                        )}
                    </button>
                </div>

                {/* 2. AREA KONTEN BAWAH */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-10">

                    {rightDashboardTab === 'soap-apo' ? (

                        /* --- SUB-TAB 1: LIVE SOAP (APO) MINI PRINT PREVIEW STYLE --- */
                        <div className="space-y-3">

                            {/* ========================================================= */}
                            {/* 🔔 ALARM AGENDA PENUNJANG HARI INI (PASANG DI SINI)       */}
                            {/* ========================================================= */}
                            {agendaHariIni.length > 0 && (
                                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5 mb-2 border-b border-amber-200 pb-1.5">
                                        <span className="animate-bounce">🔔</span> Agenda Penunjang Terjadwal Hari Ini!
                                    </h3>
                                    <div className="space-y-1.5">
                                        {agendaHariIni.map((agenda, i) => (
                                            <div key={i} className="flex items-start gap-2 bg-white px-2 py-1.5 rounded border border-amber-200 shadow-sm cursor-pointer hover:bg-amber-100 transition" onClick={() => handleEdit(activeRecords.find(r => r.id === agenda.id))}>
                                                <span className="text-sm shrink-0 leading-none pt-0.5">{agenda.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-bold text-slate-800 leading-tight">
                                                        {agenda.action}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                                                        {agenda.room ? agenda.room.replace(/^(K\d+)(KM|P)$/, '$1•$2') : ''} a.n <span className="font-bold text-amber-700">{agenda.name}</span> ({agenda.dpjp})
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* ========================================================= */}
                            {filteredActiveRecords.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 italic text-xs bg-white rounded-lg border">Tidak ada pasien aktif untuk ditampilkan.</div>
                            ) : (
                                filteredActiveRecords.map(rec => {
                                    // Bersihkan spasi kosong karpet merah/sisa input teks (Ditambah toleransi ikon jam)
                                    const stripAuthorTags = (text) => (text || '').replace(/(?:🕒\s*)?\[[^\]]+,\s*[\d\/]+\s+[\d:]+\]\s*/g, '').trim();

                                    // ✨ LOGIKA BARU: Cek apakah isinya benar-benar kosong (hanya tersisa stempel)
                                    const isActuallyEmpty = (text) => stripAuthorTags(text) === '' || stripAuthorTags(text) === '-';

                                    // ✨ MODE SOAP: Tentukan sumber data berdasarkan soapMode
                                    const personalNotes = rec.personalNotes?.[currentUser?.name] || {};
                                    const rawSubj = soapMode === 'personal' ? (personalNotes.subjective || '') : (rec.subjective || '');
                                    const rawObj = soapMode === 'personal' ? (personalNotes.objective || '') : (rec.objective || '');
                                    const rawAna = soapMode === 'personal' ? (personalNotes.analysis || '') : (rec.analysis || '');
                                    // ✨ FIX CARD: Gabungkan draf planning dengan resep utama agar badge obat muncul di layar depan
                                    const rRx = rec.currentPrescription || '';
                                    const rawPlan = soapMode === 'personal'
                                        ? `${personalNotes.planning || ''}\n${rRx}`
                                        : `${rec.planning || ''}\n${rRx}`;

                                    // ✨ PERBAIKAN: Gunakan stripAuthorTags agar SEMUA stempel terhapus dari tampilan E-Ontang-Anting
                                    const safeSubjective = isActuallyEmpty(rawSubj) ? '' : stripAuthorTags(rawSubj);
                                    const safeObjective = isActuallyEmpty(rawObj) ? '' : stripAuthorTags(rawObj);
                                    const safePlanning = isActuallyEmpty(rawPlan) ? '' : rawPlan;

                                    // Analisa tetap kita paksa bersih tanpa stempel (sesuai desain aslimu)
                                    const safeAnalysis = stripAuthorTags(rawAna);

                                    const hasSubjective = safeSubjective && safeSubjective !== '-' && safeSubjective !== '';

                                    return (
                                        <div
                                            key={rec.id}
                                            onClick={() => handleEdit(rec)}
                                            className="bg-white rounded-xl border border-slate-300 shadow-sm p-4 hover:border-indigo-500 hover:shadow-md transition cursor-pointer group text-xs text-black font-sans relative"
                                            title="Klik untuk Edit SOAP Pasien"
                                        >
                                            {/* Header Atas Kartu Ala Lembar Cetak */}
                                            <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                                                        <span className="text-[10px] font-black border-2 border-black px-1.5 py-0.5 bg-slate-50 text-black">
                                                            {rec.roomNumber ? rec.roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2') : ''}
                                                        </span>
                                                        <span className="truncate group-hover:text-indigo-600 transition-colors">{rec.name}</span>
                                                    </div>
                                                    <div className="text-[13px] mt-0.5 flex flex-wrap gap-x-3 font-semibold text-slate-700 items-center">
                                                        {/* ✨ FIX CETAK: Tulisan dibuat tebal pekat (text-black font-black) dan ukurannya diperbesar (text-[14px]) tanpa caps lock */}
                                                        <span className="text-black font-black bg-slate-100/80 px-1 rounded border border-slate-300 text-[13px]">
                                                            DPJP: <span className="text-indigo-950 font-black">{rec.dpjpName}</span>
                                                        </span>

                                                        {(rec.raberName || rec.raber2Name) && (
                                                            <span className="text-slate-500 italic font-medium">
                                                                Rb: {[rec.raberName, rec.raber2Name].filter(Boolean).join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Sisi Kanan Header: Tanggal & Inisial Dinas Ns */}
                                                <div className="text-right flex flex-col items-end justify-start font-bold text-[10px] text-slate-800 shrink-0">

                                                    {/* ✨ BOX BARU: Membuat tombol Cetak & Publis manis berdampingan ke samping */}
                                                    <div className="flex flex-row gap-1.5 mb-1.5">
                                                        {/* ✨ TOMBOL TUKAR BED DI E-ONTANG-ANTING (FIXED) */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Mencegah layar form edit SOAP terbuka otomatis
                                                                setPatientToSwap(rec); // Memakai variabel 'rec' yang valid di baris ini[cite: 3]
                                                                setShowSwapModal(true); // Langsung nyalakan modal penukar bed[cite: 3]
                                                            }}
                                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                                                            title="Tukar / Pindah Bed Pasien"
                                                        >
                                                            🔀 Tukar
                                                        </button>
                                                        {/* TOMBOL CETAK APOS */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Mencegah layar Edit SOAP terbuka tak sengaja
                                                                setSelectedRecordForPrint(rec); // 🚀 Memanggil Modal Print APOS bawaan SIMPAN!
                                                            }}
                                                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition flex items-center gap-1"
                                                            title="Buka Preview Cetak APOS"
                                                        >
                                                            🖨️ Cetak
                                                        </button>

                                                        {/* TOMBOL PUBLIKASIKAN */}
                                                        {soapMode === 'personal' && rec.personalNotes?.[currentUser?.name] && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handlePublishToRoom(rec);
                                                                }}
                                                                className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded border border-amber-300 shadow-sm transition flex items-center gap-1"
                                                                title="Publikasikan catatan pribadimu ke Mode Ruangan (gabungan)"
                                                            >
                                                                📤 Publis
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Detail Tanggal & Kontributor tetap rapi di bawah tombol */}
                                                    {rec.admissionDate && (
                                                        <div>{(() => {
                                                            const start = new Date(rec.admissionDate);
                                                            if (isNaN(start)) return null;
                                                            const now = new Date();
                                                            const diffTime = now.getTime() - start.getTime();
                                                            if (diffTime < 0) return null;
                                                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                                            const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                            const fmtIn = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
                                                            const fmtOut = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                                            return `${fmtIn(start)} - ${fmtOut(now)} = ${diffDays} hr ${diffHours} jm`;
                                                        })()}</div>
                                                    )}
                                                    {rec.contributors && rec.contributors.length > 0 && (
                                                        <div className="text-[9px] text-indigo-700 font-extrabold mt-0.5 uppercase tracking-tight">
                                                            Ns: {rec.contributors.map(n => n.split(' ')[0]).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Grid 2 Kolom Presisi Komponen APOS */}
                                            <div className="grid grid-cols-2 gap-3 pt-0.5 items-stretch">

                                                {/* Kolom Kiri: A (Analisa) & P (Planning) */}
                                                <div className="border-r border-slate-200 pr-2 flex flex-col justify-between gap-2">
                                                    <div>
                                                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">A (ANALISA)/ Dx:</div>
                                                        <div className="whitespace-pre-wrap pl-1 text-slate-800 leading-tight text-[11px] font-medium">{safeAnalysis || '-'}</div>
                                                    </div>

                                                    <div className="border-t border-dashed border-slate-300 pt-1.5">
                                                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">P (PLANNING)</div>
                                                        {/* ✨ FIX 2: Hidupkan Badge Warna-Warni & Kedip di Planning */}
                                                        <div className="pl-1">
                                                            {safePlanning ? renderPlanningCell(safePlanning, rec.medicationLogs) : <span className="text-slate-800 text-[11px] font-medium">-</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Kolom Kanan: O (Objektif) & S (Subektif) */}
                                                <div className="flex flex-col justify-between gap-2">
                                                    <div>
                                                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">O (OBJEKTIF)</div>
                                                        {/* ✨ FIX 3: Hidupkan Lacak Kedip Oranye & Nilai Lab Merah/Biru */}
                                                        <div className="pl-1 text-slate-800 leading-tight text-[11px]">
                                                            {safeObjective ? (
                                                                <div className="bg-slate-50 p-1.5 border border-slate-200 rounded text-slate-700 leading-normal">
                                                                    {renderObjectiveCell(safeObjective)}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-[10px] pl-1">- Belum ada TTV -</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {hasSubjective && (
                                                        <div className="border-t border-dashed border-slate-300 pt-1.5">
                                                            <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">S (SUBJEKTIF)</div>
                                                            <div className="whitespace-pre-wrap pl-1 text-slate-800 leading-tight text-[11px] font-medium">{safeSubjective}</div>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>

                                            {/* ✨ TAB ROW: Lab | Rontgen | USG | CT | EKG | Luka */}
                                            {(() => {
                                                // Lab data setup
                                                const labHistory = rec.labHistory;
                                                const hasHistory = labHistory && labHistory.length > 0;
                                                const fallbackValues = hasHistory ? null : (() => {
                                                    const vals = {};
                                                    Object.keys(LAB_PATTERNS).forEach(key => {
                                                        if (key === 'Gram/Sputum') return;
                                                        const match = safeObjective.match(LAB_PATTERNS[key]);
                                                        if (match && match[1]) vals[key] = match[1].trim().replace(',', '.');
                                                    });
                                                    return Object.keys(vals).length > 0 ? vals : null;
                                                })();
                                                const allKeys = hasHistory
                                                    ? [...new Set(labHistory.flatMap(e => Object.keys(e.values || {})))]
                                                    : (fallbackValues ? Object.keys(fallbackValues) : []);
                                                const dateColumns = hasHistory ? labHistory.map(e => e.date) : ['Terkini'];

                                                return (
                                                    <div className="mt-2 pt-2 border-t-2 border-slate-300">
                                                        {/* Tab Buttons */}
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {/* Lab Tab */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === 'Lab' ? null : rec.id); setExpandedCardTab('Lab'); }}
                                                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === 'Lab'
                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                                                    }`}
                                                            >
                                                                📊 Lab
                                                                {allKeys.length > 0 && (
                                                                    <span className={`px-1 rounded-full text-[8px] ${expandedCardId === rec.id && expandedCardTab === 'Lab' ? 'bg-white/30' : 'bg-blue-200'}`}>
                                                                        {allKeys.length}
                                                                    </span>
                                                                )}
                                                            </button>

                                                            {/* 🔥 TAMBAHKAN TOMBOL TTV INI DI SINI: */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === 'TTV' ? null : rec.id); setExpandedCardTab('TTV'); }}
                                                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === 'TTV'
                                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                                    }`}
                                                            >
                                                                📈 TTV & EWS
                                                            </button>

                                                            {/* Radiology Tabs */}
                                                            {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka'].map(cat => {
                                                                const count = (rec.radiologyImages || []).filter(img => img.category === cat).length;
                                                                const icons = { 'Rontgen': '🩻', 'USG': '🔊', 'CT Scan': '💉', 'EKG': '❤️', 'Luka': '🩹' };
                                                                return (
                                                                    <button
                                                                        key={cat}
                                                                        onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === cat ? null : rec.id); setExpandedCardTab(cat); }}
                                                                        className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === cat
                                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                                                            }`}
                                                                    >
                                                                        {icons[cat]} {cat}
                                                                        {count > 0 && (
                                                                            <span className={`px-1 rounded-full text-[8px] ${expandedCardId === rec.id && expandedCardTab === cat ? 'bg-white/30' : 'bg-indigo-200'}`}>
                                                                                {count}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Tab Content */}
                                                        {expandedCardId === rec.id && (
                                                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                                {/* ✨ VERSI MODULAR: Memanggil komponen luar dengan visual aslinya */}
                                                                {expandedCardTab === 'Lab' && (
                                                                    <LabHistoryTable record={rec} />
                                                                )}

                                                                {/* 🔥 TAMBAHKAN LOGIKA TAMPIL TTV INI DI SINI: */}
                                                                {expandedCardTab === 'TTV' && (
                                                                    <TtvHistory objective={rec.objective} />
                                                                )}

                                                                {/* RADIOLOGY CONTENT */}
                                                                {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka'].includes(expandedCardTab) && (
                                                                    <div className="cursor-default mt-2"> {/* ✨ FIX: Hapus e.stopPropagation() di sini agar kotak putih tetap memicu Form SOAP saat diklik */}

                                                                        {/* ✨ MESIN RADAR: AUTO-DETECT EKSPERTISE DARI (O) OBJEKTIF */}
                                                                        {(() => {
                                                                            const getRadExpertiseFromO = (objective, category) => {
                                                                                if (!objective) return null;
                                                                                // Regex super cerdas: Menyedot teks berdasarkan kategori, dan berhenti otomatis jika bertemu kata USG, CT Scan, Lab, atau TTV
                                                                                const regexMap = {
                                                                                    'Rontgen': /(?:Hasil\s*|Kesan\s*)?(?:Rontgen|Ro\s*Thorax|Thorax|BNO|Foto)(?:\s*Thorax|\s*Polos)?[\s:-]*([^\n]+(?:\n(?!(?:USG|CT Scan|EKG|Lab|TD|Nadi|Suhu|RR|SpO2|S:|A:|P:)).+)*)/i,
                                                                                    'USG': /(?:Hasil\s*|Kesan\s*)?(?:USG|Ultrasonografi)[\s:-]*([^\n]+(?:\n(?!(?:Rontgen|CT Scan|EKG|Lab|TD|Nadi|Suhu|RR|SpO2|S:|A:|P:)).+)*)/i,
                                                                                    'CT Scan': /(?:Hasil\s*|Kesan\s*)?(?:CT Scan|CT-Scan|MSCT)[\s:-]*([^\n]+(?:\n(?!(?:Rontgen|USG|EKG|Lab|TD|Nadi|Suhu|RR|SpO2|S:|A:|P:)).+)*)/i,
                                                                                };
                                                                                if (!regexMap[category]) return null;
                                                                                const match = objective.match(regexMap[category]);
                                                                                if (match && match[1]) {
                                                                                    // Bersihkan stempel waktu/nama perawat jika ada
                                                                                    const cleanMatch = match[1].replace(/(?:🕒\s*)?\[[^\]]+\]\s*/g, '').trim();
                                                                                    return cleanMatch.length > 3 ? cleanMatch : null;
                                                                                }
                                                                                return null;
                                                                            };

                                                                            const extractedText = getRadExpertiseFromO(rec.objective, expandedCardTab);
                                                                            if (extractedText) {
                                                                                return (
                                                                                    <div className="mb-2 bg-indigo-50 border border-indigo-200 p-2 rounded-lg shadow-sm">
                                                                                        <div className="text-[9px] font-black text-indigo-800 uppercase mb-1 flex items-center gap-1">
                                                                                            🤖 Auto-Deteksi Ekspertise dari (O):
                                                                                        </div>
                                                                                        <div className="text-[10px] text-slate-700 font-medium whitespace-pre-wrap leading-snug">
                                                                                            {extractedText}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}

                                                                        {/* GALLERY GAMBAR & CATATAN MANUAL */}
                                                                        {(rec.radiologyImages || []).filter(img => img.category === expandedCardTab).length > 0 ? (
                                                                            <div className="flex flex-col gap-2">
                                                                                {(rec.radiologyImages || []).filter(img => img.category === expandedCardTab).map((img, idx) => {
                                                                                    const hasExpertiseText = ['Rontgen', 'USG', 'CT Scan'].includes(expandedCardTab);

                                                                                    return (
                                                                                        <div key={img.id || idx} className="flex gap-2.5 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm group hover:border-indigo-400 transition-colors">
                                                                                            {/* KIRI: Foto Thumbnail */}
                                                                                            <div className="relative shrink-0" onClick={(e) => e.stopPropagation() /* ✨ LINDUNGI KLIK GAMBAR */}>
                                                                                                <img
                                                                                                    src={img.imageUrl}
                                                                                                    alt={`${img.category} ${idx + 1}`}
                                                                                                    className="w-16 h-16 object-cover rounded-lg border border-slate-300 cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all shadow-sm"
                                                                                                    onClick={() => window.open(img.imageUrl, '_blank')}
                                                                                                    title={`${img.uploadedBy} • ${img.date} ${img.time || ''}`}
                                                                                                />
                                                                                                <div className="absolute -bottom-1 left-1 bg-white/90 text-[7px] text-gray-600 px-1 rounded shadow font-bold">
                                                                                                    {img.date}
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* KANAN: Detail & Input Kesan Tambahan */}
                                                                                            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                                                                                                <div className="text-[9px] text-slate-400 font-bold mb-1 flex justify-between">
                                                                                                    <span>{img.category} #{idx + 1}</span>
                                                                                                    <span>Oleh: {img.uploadedBy} ({img.time || ''})</span>
                                                                                                </div>

                                                                                                {hasExpertiseText ? (
                                                                                                    <textarea
                                                                                                        onClick={(e) => e.stopPropagation()} // ✨ KUNCI 1: Aman untuk diklik!
                                                                                                        onMouseDown={(e) => e.stopPropagation()} // ✨ KUNCI 2: Aman untuk nge-blok/drag teks!
                                                                                                        onKeyDown={(e) => e.stopPropagation()} // ✨ KUNCI 3: Aman dari shortcut keyboard!
                                                                                                        placeholder="Ketik catatan opsional khusus foto ini..."
                                                                                                        defaultValue={img.kesan || ''}
                                                                                                        onBlur={async (e) => {
                                                                                                            const val = e.target.value.trim();
                                                                                                            if (val === (img.kesan || '')) return;

                                                                                                            const updatedImages = (rec.radiologyImages || []).map(item =>
                                                                                                                (item.id === img.id || item.imageUrl === img.imageUrl)
                                                                                                                    ? { ...item, kesan: val }
                                                                                                                    : item
                                                                                                            );

                                                                                                            try {
                                                                                                                const safeAppId = firebaseConfig?.appId || 'SIMPAN_APP';
                                                                                                                const docRef = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, rec.id);
                                                                                                                await updateDoc(docRef, { radiologyImages: updatedImages });
                                                                                                            } catch (err) {
                                                                                                                console.error("Gagal update kesan:", err);
                                                                                                            }
                                                                                                        }}
                                                                                                        className="w-full flex-1 text-[10px] p-1 border border-indigo-100 rounded outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium bg-indigo-50/30 focus:bg-white h-10 leading-tight custom-scrollbar shadow-inner"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="text-[10px] text-slate-400 italic pt-2">
                                                                                                        * Berkas penunjang tanpa lampiran dokumen teks.
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center py-4 text-gray-400">
                                                                                <span className="text-2xl">🖼️</span>
                                                                                <p className="text-[10px] mt-1">Belum ada lampiran gambar {expandedCardTab}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    ) : (

                        /* --- SUB-TAB 2: STATISTIK & WAITING LIST LAMA --- */
                        <>
                            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden">
                                <div className="bg-indigo-600 px-3 py-2 text-white flex justify-between items-center">
                                    <div className="flex items-center space-x-2"><span className="text-xs font-bold uppercase tracking-tight">📋 Waiting List</span><span className="bg-indigo-500 px-2 py-0.5 rounded-full text-[10px] font-mono">{waitingList.length}</span></div>
                                    <button onClick={() => setShowWaitingModal(true)} className="bg-white text-indigo-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-50 flex items-center"><span className="mr-1 text-sm">+</span> Tambah/Edit</button>
                                </div>
                                <div className="max-h-56 overflow-y-auto">
                                    {waitingList.length === 0 ? <div className="p-6 text-center text-gray-400 italic text-xs">Belum ada antrean.</div> : (
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="bg-gray-50 sticky top-0 border-b z-10"><tr><th className="p-2 text-center w-8">No</th><th className="p-2">Target</th><th className="p-2">Pasien</th><th className="p-2">Asal</th><th className="p-2 text-center">Aksi</th></tr></thead>
                                            <tbody>{waitingList.map((w, idx) => (
                                                <tr key={w.id} className="border-b hover:bg-indigo-50 group"><td className="p-2 text-center font-bold text-gray-400">{idx + 1}</td><td className="p-2 font-bold text-indigo-700">{w.plannedRoom}</td><td className="p-2"><div className="font-bold">{w.name}</div><div className="text-[9px] text-gray-400 truncate">{w.diagnosis}</div></td><td className="p-2"><div className="font-bold">{w.originRoom}</div>{w.insuranceClass && <div className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded w-fit">{w.insuranceClass}</div>}</td><td className="p-2 text-center"><button onClick={() => handleMoveToRoom(w)} className="bg-green-600 text-white px-2 py-1 rounded font-bold text-[9px]">Masuk</button><button onClick={() => handleDeleteWaiting(w.id)} className="ml-2 text-red-400 opacity-0 group-hover:opacity-100">🗑️</button></td></tr>
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
                            {/* 📊 SEKSI STATISTIK BEBAN DOKTER BERDASARKAN PRIORITAS (SINKRON 100%) */}
                            <div className="bg-white rounded p-3 border">
                                <h3 className="font-bold text-gray-700 border-b pb-2 mb-3 text-xs uppercase">Pasien per DPJP</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(stats.dpjpCounts).sort((a, b) => {
                                        // Sesuai susunan prioritas di dpjpOptions utama
                                        const priorityDocs = [
                                            "dr. Delvi, Sp.PD",
                                            "dr. Dian Ekowati, Sp.PD",
                                            "dr. Priyo, Sp.PD",
                                            "dr. Risa, Sp.PD",
                                            "dr. Evan, Sp.P"
                                        ];

                                        // a[0] dan b[0] berisi nama string dokter
                                        const idxA = priorityDocs.indexOf(a[0]);
                                        const idxB = priorityDocs.indexOf(b[0]);

                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                        if (idxA !== -1) return -1;
                                        if (idxB !== -1) return 1;
                                        return a[0].localeCompare(b[0]);
                                    }).map(([n, c]) => (
                                        <div key={n} className="flex justify-between items-center text-[10px] p-2 bg-gray-50 rounded border hover:bg-indigo-50 group">
                                            <span className="truncate font-medium">{n}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{c}</span>
                                                <button onClick={() => handleReportDpjpCount(n, c)} className="text-[9px] bg-green-100 text-green-700 p-1 rounded-full opacity-80 group-hover:opacity-100">📱</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white rounded p-3 border"><h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-xs uppercase flex justify-between"><span>🤝 Raber/Konsul</span><span className="bg-yellow-100 px-2 rounded-full">{Object.keys(stats.raberData).length} Dr</span></h3>
                                <div className="space-y-2">{Object.entries(stats.raberData).length === 0 ? <div className="text-[10px] text-gray-400 text-center">Nihil.</div> : Object.entries(stats.raberData).map(([d, p]) => (<div key={d} className="text-[10px] bg-yellow-50 p-2 rounded border flex justify-between group"><div className="flex-1"><div className="font-bold text-indigo-800">{d}</div><div className="text-gray-600">({p.join(', ')})</div></div><button onClick={() => handleReportRaber(d, p)} className="ml-2 bg-green-100 text-green-700 px-2 py-1 rounded opacity-80 group-hover:opacity-100">📱</button></div>))}</div>
                            </div>
                            <div className="bg-white rounded overflow-hidden border">
                                <div className="bg-gray-800 px-3 py-2 text-white text-xs font-bold uppercase">📊 Rekap</div>
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                                        <tr>
                                            <th className="p-2">Bulan</th><th className="p-2 text-center">Aktif</th><th className="p-2 text-center" title="Pulang Biasa">Plg</th><th className="p-2 text-center text-indigo-600" title="Pindah Ruangan">Pdh</th><th className="p-2 text-center text-slate-800" title="Meninggal">Mng</th><th className="p-2 text-center text-red-600">Lab</th><th className="p-2 text-center text-blue-600">Rad</th><th className="p-2 text-center text-green-600">TM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(stats.monthly).map(([m, d]) => (
                                            <tr key={m} className="border-b hover:bg-gray-50">
                                                <td className="p-2 font-bold text-indigo-900">{m}</td><td className="p-2 text-center">{d.active}</td><td className="p-2 text-center font-bold">{d.pulang}</td><td className="p-2 text-center font-bold text-indigo-600">{d.pindah}</td><td className="p-2 text-center font-bold text-slate-800">{d.meninggal}</td><td className="p-2 text-center font-bold text-red-600">{d.lab}</td><td className="p-2 text-center font-bold text-blue-600">{d.rad}</td><td className="p-2 text-center font-bold text-green-600">{d.tm}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                </div>
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

                    {/* --- MENU NAVIGASI UNIVERSAL (UPGRADE KEYBOARD NAVIGATION) --- */}
                    <div className="relative ml-2" ref={menuWrapperRef} onKeyDown={handleMenuKeyDown}>
                        <button
                            onClick={() => { setIsMainMenuOpen(!isMainMenuOpen); setMainMenuHighlight(-1); }}
                            className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm hover:bg-gray-50 transition outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <span>☰</span> MENU ▾
                        </button>

                        {isMainMenuOpen && (
                            <div className="absolute top-full right-0 pt-2 w-48 z-[90] animate-in fade-in zoom-in-95 origin-top-right">
                                <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1">

                                    {/* SEKSI TENTANG APLIKASI & LINK TRAKTEER */}
                                    <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-gray-100 mb-1 bg-indigo-50/40">
                                        <p className="font-bold text-indigo-900">SIMPAN </p>
                                        <p className="text-[9px]">Nursing System Handover </p>
                                        <a
                                            href="https://trakteer.id/481nugroho"
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`block mt-1.5 text-[10px] text-indigo-600 font-extrabold hover:underline p-1 rounded transition-colors ${mainMenuHighlight === getMenuIdx('link') ? 'bg-indigo-100 text-indigo-900 font-black' : ''}`}
                                        >
                                            ☕ Traktir Kopi?
                                        </a>
                                    </div>

                                    <div className="px-4 py-1 border-b border-gray-50 mb-1">
                                        <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded w-fit block uppercase">
                                            👤 {currentUser ? currentUser.name : 'Guest'}
                                        </span>
                                    </div>

                                    <button onClick={() => { setView('dashboard'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'dashboard') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>🏠 Dashboard</button>
                                    <button onClick={() => { setView('patient-list'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'patient-list') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>📋 Daftar Pasien</button>
                                    <button onClick={() => { setView('settings'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'settings') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>⚙️ Setelan</button>
                                    <button onClick={() => { setView('archived-list'); setIsMainMenuOpen(false); fetchArchivedRecords(); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'archived-list') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>🗃️ Gudang Arsip Pasien</button>

                                    {/* MENU KEUANGAN (HANYA MUNCUL JIKA USER ADALAH PJ) */}
                                    {cashflowRole && (
                                        <>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <button onClick={() => { setAppMode('MEDIS'); setAppMode('KEUANGAN'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center font-bold transition-colors ${mainMenuHighlight === getMenuIdx('finance') ? 'bg-indigo-100 text-indigo-900 font-black' : 'hover:bg-teal-50 text-teal-700'}`}>
                                                <Wallet size={14} className="mr-2" /> Panel Keuangan
                                            </button>
                                        </>
                                    )}

                                    {/* MENU SUPERADMIN / GOD MODE SWITCH BANGSAL */}
                                    {(currentUser?.role === 'SUPERADMIN' || currentUser?.name?.toLowerCase().includes('abi')) && (
                                        <>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <div className="px-3 py-1 bg-purple-50">
                                                <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">👑 God Mode (Admin)</span>
                                            </div>
                                            {['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK'].map(wName => (
                                                <button
                                                    key={wName}
                                                    onClick={() => { onSwitchWard(wName); setIsMainMenuOpen(false); }}
                                                    className={`w-full text-left px-4 py-2 text-xs flex items-center font-bold transition-colors ${mainMenuHighlight === getMenuIdx('ward', wName) ? 'bg-indigo-100 text-indigo-900 font-black' : currentWardConfig.name === toTitleCase(wName) ? 'bg-purple-100 text-purple-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                >
                                                    🏥 Ruang {toTitleCase(wName)}
                                                </button>
                                            ))}
                                        </>
                                    )}

                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button onClick={() => { onLogout(); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs text-rose-600 font-bold flex items-center transition-colors ${mainMenuHighlight === getMenuIdx('logout') ? 'bg-rose-100 font-black text-rose-700' : 'hover:bg-rose-50'}`}>🚪 Keluar</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setShowInputModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow-md text-xs font-bold transition flex items-center gap-1 ml-1">
                        <span>+</span> Baru
                    </button>
                </div>
            </div>

            <div className="relative flex flex-row max-w-7xl mx-auto lg:h-[calc(100vh-64px)] overflow-hidden">
                <div className={`fixed top-16 right-0 bottom-0 w-full md:w-[400px] z-[60] bg-white transition-transform duration-300 ease-in-out shadow-2xl border-l ${showWaitingModal ? 'translate-x-0' : 'translate-x-full'}`}>
                    <WaitingListInputPanel show={showWaitingModal} onClose={() => setShowWaitingModal(false)} onAdd={handleAddWaiting} availableRooms={currentWardConfig.roomList} occupiedRooms={occupiedRooms} waitingList={waitingList} onUpdateRoom={updateWaitingListRoom} activeRecords={activeRecords} />
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
                                    {/* ✨ VERSI FINAL PEMANGGIL PATIENT TABLE */}
                                    <PatientTable
                                        roomList={currentWardConfig.roomList}
                                        // ✨ FIX TROLI & CARD: Gabungkan resep obat ke planning secara virtual HANYA jika belum bergabung
                                        records={filteredActiveRecords.map(r => {
                                            const rxText = r.currentPrescription || '';
                                            const alreadyMerged = (r.planning || '').toLowerCase().includes(rxText.toLowerCase().trim());
                                            return {
                                                ...r,
                                                planning: rxText && !alreadyMerged ? `${r.planning || ''}\n${rxText}` : (r.planning || '')
                                            };
                                        })}
                                        onEdit={handleEdit}
                                        onPrint={(r) => setSelectedRecordForPrint(r)}
                                        onShowLaporModal={setRecordForLapor}
                                        onDischarge={handleDischarge}
                                        onBulkPrint={() => setShowBulkPrint(true)}
                                        roomSortOrder={selectedRoomFilter}
                                        onPrintTTV={handlePrintTTV}
                                        onPrintSOAP={handlePrintSOAP}
                                        onQuickTtv={(rec) => { setQuickTtvTarget(rec); setShowTtvModal(true); }}
                                        onBulkDischarge={handleBulkDischarge}
                                        updateRecord={updateRecord}
                                        onPrintBukuCM={handlePrintBukuCM}
                                        onPrintLabel={() => { }}
                                        db={db}
                                        currentUser={currentUser}
                                        firebaseConfig={firebaseConfig}
                                        parsePlanning={parsePlanning}
                                        getAntibioticDay={getAntibioticDay}
                                        hitungHariCM={hitungHariCM}
                                        formatDateCM={formatDateCM}
                                        parseDateCM={parseDateCM}
                                        renderLacakTtv={renderLacakTtv}
                                        renderObjectiveCell={renderObjectiveCell}
                                        renderPlanningCell={renderPlanningCell}
                                        BukuCMTable={BukuCMTable}
                                        GlobalMedicationBoard={GlobalMedicationBoard}
                                    />
                                </div>
                            </div>
                        )}

                        {/* --- VIEW 4: ARSIP PASIEN (KOMPONEN BARU) --- */}
                        {view === 'archived-list' && (
                            <div className="h-full overflow-hidden bg-slate-50">
                                {/* ✨ FIX: Tambahkan onRefresh agar Gudang Arsip bisa menyuruh App memotret ulang data saat ada yang dihapus */}
                                <GudangArsip
                                    dataPasien={archivedRecords}
                                    loading={loading}
                                    db={db}
                                    onRestore={handleRestorePatient}
                                    onRefresh={fetchArchivedRecords}
                                />
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
                                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Tampilan</label><input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500" /></div>
                                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label><input type="text" value={profileForm.pass} onChange={e => setProfileForm({ ...profileForm, pass: e.target.value })} className="w-full p-2 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-indigo-500" /></div>
                                            <button onClick={handleUpdateSelf} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition shadow-sm mt-2">Simpan Perubahan Profil</button>
                                        </div>
                                    </div>
                                    {/* 2. ADMIN & MANAGEMENT PANEL */}
                                    {['admin', 'karu', 'admin_ruangan'].includes(currentUser.role) && (
                                        <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
                                            <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                                {currentUser.role === 'admin' ? '🛡️ God Admin: Manajemen Global' : '📋 Manajemen Anggota Ruangan'}
                                            </h3>

                                            {/* --- FORM INPUT USER --- */}
                                            <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm mb-4">
                                                <h4 className="text-xs font-bold text-indigo-800 mb-2 uppercase">Tambah / Reset Perawat</h4>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <input type="text" placeholder="ID (Username)" value={adminUserForm.id} onChange={e => setAdminUserForm({ ...adminUserForm, id: e.target.value })} className="p-2 border rounded text-xs" />
                                                    <input type="text" placeholder="Nama Lengkap" value={adminUserForm.name} onChange={e => setAdminUserForm({ ...adminUserForm, name: e.target.value })} className="p-2 border rounded text-xs" />
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 mb-2">
                                                    <input type="text" placeholder="Password" value={adminUserForm.pass} onChange={e => setAdminUserForm({ ...adminUserForm, pass: e.target.value })} className="p-2 border rounded text-xs font-mono" />

                                                    <select value={adminUserForm.role} onChange={e => setAdminUserForm({ ...adminUserForm, role: e.target.value })} className="p-2 border rounded text-xs bg-white outline-none">
                                                        <option value="member">Perawat Pelaksana</option>
                                                        <option value="karu">Kepala Ruangan (Karu)</option>
                                                        <option value="admin_ruangan">Admin Ruangan</option>
                                                        <option value="finance_jm">Keuangan (JM)</option>
                                                        <option value="finance_kas">Keuangan (KAS)</option>
                                                        <option value="finance_doc">Keuangan (Dokter)</option>
                                                        {currentUser.role === 'admin' && <option value="admin">God Admin</option>}
                                                    </select>

                                                    {/* Dropdown Pilihan Ruangan (Otomatis Terkunci & Menyesuaikan Pengguna) */}
                                                    <div>
                                                        <select
                                                            value={['karu', 'admin_ruangan'].includes(currentUser.role) ? currentUser.ward : (adminUserForm.ward || 'MELATI')}
                                                            onChange={e => setAdminUserForm({ ...adminUserForm, ward: e.target.value })}
                                                            disabled={['karu', 'admin_ruangan'].includes(currentUser.role)}
                                                            className="w-full p-2 border rounded text-xs bg-white font-bold text-indigo-700 outline-none border-indigo-200 disabled:bg-gray-100 disabled:text-gray-400"
                                                        >
                                                            <option value="MELATI">🏥 Ruang Melati</option>
                                                            <option value="DAHLIA">🏥 Ruang Dahlia</option>
                                                            <option value="TERATAI">🏥 Ruang Teratai</option>
                                                            <option value="ANYELIR">🏥 Ruang Anyelir</option>
                                                            <option value="ANGGREK">🏥 Ruang Anggrek</option>
                                                        </select>
                                                        {['karu', 'admin_ruangan'].includes(currentUser.role) && (
                                                            <p className="text-[9px] text-amber-600 mt-0.5 font-medium">*Hubungi God Admin jika ingin mengajukan mutasi</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <button onClick={handleAdminSaveUser} className="w-full bg-indigo-600 text-white py-1.5 rounded text-xs font-bold hover:bg-indigo-700">Simpan / Update User</button>
                                            </div>

                                            {/* --- TABEL DAFTAR USER (Saringan Sisi Klien Otomatis) --- */}
                                            <div className="overflow-hidden rounded border border-indigo-200">
                                                <table className="w-full text-left text-xs bg-white">
                                                    <thead className="bg-indigo-100 text-indigo-800">
                                                        <tr>
                                                            <th className="p-2">ID</th>
                                                            <th className="p-2">Nama</th>
                                                            <th className="p-2">Role</th>
                                                            <th className="p-2">Ruangan</th>
                                                            <th className="p-2">Pass</th>
                                                            <th className="p-2 text-center">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-indigo-50">
                                                        {allUsers
                                                            .filter(u => currentUser.role === 'admin' || u.ward === currentUser.ward)
                                                            .map(u => (
                                                                <tr key={u.id} className="hover:bg-indigo-50">
                                                                    <td className="p-2 font-mono text-slate-500">{u.id}</td>
                                                                    <td className="p-2 font-bold">{u.name}</td>
                                                                    <td className="p-2">
                                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'karu' ? 'bg-amber-100 text-amber-700' : u.role === 'admin_ruangan' ? 'bg-blue-100 text-blue-700' : u.role === 'member' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>{u.role}</span>
                                                                    </td>
                                                                    <td className="p-2 font-extrabold text-indigo-600 text-[10px] tracking-wide">
                                                                        📂 {u.ward || 'MELATI'}
                                                                    </td>
                                                                    <td className="p-2 font-mono text-slate-500">{u.pass}</td>
                                                                    <td className="p-2 text-center flex justify-center gap-1">
                                                                        <button onClick={() => setAdminUserForm({ ward: currentUser.ward, ...u })} className="bg-yellow-100 text-yellow-700 p-1 rounded">✏️</button>
                                                                        {u.id !== currentUser.id && (
                                                                            <button onClick={() => handleAdminDeleteUser(u.id)} className="bg-red-100 text-red-700 p-1 rounded">🗑️</button>
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
                    {/* ✨ CARA A: Banner Publikasikan — muncul saat Mode Personal + sedang edit pasien */}
                    {soapMode === 'personal' && isEditing && (
                        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-3 py-1.5 gap-2">
                            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                🙋 Mode Pribadi — catatan ini hanya milikmu
                            </span>
                            <button
                                onClick={() => {
                                    const rec = activeRecords.find(r => r.id === currentRecordId);
                                    if (rec) handlePublishToRoom(rec);
                                }}
                                className="shrink-0 px-2.5 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition flex items-center gap-1"
                                title="Gabungkan catatan pribadiku ke catatan ruangan (Mode Gabungan)"
                            >
                                📤 Publikasikan ke Ruangan
                            </button>
                        </div>
                    )}
                    <PatientForm
                        showInputModal={showInputModal}
                        setShowInputModal={setShowInputModal}
                        handleSubmit={handleSubmit}
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setFormData={setFormData}
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
                        archivedRecords={archivedRecords}
                        activeRecords={activeRecords}
                        // ✨ FIX MODAL: Suntik baris obat ke planning sesaat sebelum CPO dibuka agar tidak blank putih
                        onOpenMarModal={(data) => {
                            const combinedData = {
                                ...data,
                                planning: `${data.planning || ''}\n${data.currentPrescription || ''}`
                            };
                            setMarSelectedRecord(combinedData);
                            setIsMarModalOpen(true);
                        }}
                        db={db}
                        currentUser={currentUser}
                        firebaseConfig={firebaseConfig}
                        // ✨ GAMBAR RADIOLOGI
                        onAddRadiologyImage={handleAddRadiologyImage}
                        onRemoveRadiologyImage={handleRemoveRadiologyImage}

                        // ✨ KABEL TUKAR BED DITANCAPKAN DI SINI:
                        onSwapBed={(rec) => { setPatientToSwap(rec); setShowSwapModal(true); }}
                    /></div>}
            </div>
            {/* ✨ JENDELA MELAYANG REKAM OBAT MAR DIGITAL */}
            <MedicationMarModal
                isOpen={isMarModalOpen}
                onClose={() => { setIsMarModalOpen(false); setMarSelectedRecord(null); }}
                record={marSelectedRecord}
                allRecords={records}
                db={db}
                currentUser={currentUser}
                firebaseConfig={firebaseConfig}
            />
            {recordForLapor && <LaporConfirmationModal patientName={recordForLapor.name} dpjpNumber={dpjpProfiles.find(p => p.name === recordForLapor.dpjpName)?.waNumber} onLaporDpjp={() => handleLapor(recordForLapor, 'DPJP')} onLaporJaga={() => handleLapor(recordForLapor, 'Forward')} onCancel={() => setRecordForLapor(null)} />}
            {selectedRecordForPrint && <PrintView record={selectedRecordForPrint} closePrint={() => setSelectedRecordForPrint(null)} historyLogs={historyLogs} />}
            {showBulkPrint && <BulkPrintView records={filteredActiveRecords} onClose={() => setShowBulkPrint(false)} />}
            {showTtvModal && <TtvModal onClose={() => { setShowTtvModal(false); setQuickTtvTarget(null); }} onSave={(text) => { if (quickTtvTarget) { handleSaveQuickTtv(text); } else { appendText('objective', text); setShowTtvModal(false); } }} />}
            {confirmDetails.isOpen && <ConfirmationModal title={confirmDetails.title} message={confirmDetails.message} onConfirm={confirmDetails.action} onCancel={closeConfirm} />}
            {recordForDischarge && <DischargeModal patientName={recordForDischarge.name} onCancel={() => setRecordForDischarge(null)} onPindah={() => processDischarge('pindah')} onPulang={() => processDischarge('pulang')} onMeninggal={() => processDischarge('meninggal')} />}
            {showLaporModal && <LaporModal onCancel={() => setShowLaporModal(false)} onLaporShift={handleLaporShift} onLaporCS={handleLaporCS} />}
            {/* ✨ TEMPEL MODAL TUKAR BED DI SINI: */}
            {showSwapModal && patientToSwap && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm z-[9999]">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">

                        <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center rounded-t-2xl">
                            <div>
                                <h2 className="text-lg font-black flex items-center gap-2">🔀 Panel Tukar Bed Pasien</h2>
                                <p className="text-indigo-100 text-xs mt-0.5 font-medium">Pilih bed tujuan untuk <span className="font-bold bg-indigo-800 px-1.5 py-0.5 rounded text-white">{patientToSwap.name} (Bed {patientToSwap.roomNumber})</span></p>
                            </div>
                            <button onClick={() => setShowSwapModal(false)} className="p-2 hover:bg-indigo-500 rounded-full transition-colors"><span className="text-xl leading-none">✖</span></button>
                        </div>

                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                            <h3 className="text-sm font-bold text-slate-700 mb-3 border-b pb-2">Daftar Bed di {currentWardConfig?.name || 'Bangsal Aktif'}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {(() => {
                                    // 1. Ambil data mentah denah kiri dan kanan dari constants
                                    const left = currentWardConfig?.leftRooms || [];
                                    const right = currentWardConfig?.rightRooms || [];
                                    const orderedRooms = [];

                                    // 2. Hitung jumlah kolom aktif (Melati = 2 kolom, Dahlia = 1 kolom)
                                    const leftCols = left.length <= 5 ? 1 : 2;
                                    const rightCols = right.length <= 5 ? 1 : 2;

                                    let lIdx = 0;
                                    let rIdx = 0;

                                    // 3. Proses Penganyaman: Ambil sebaris kiri, lalu sebaris kanan secara bergantian
                                    while (lIdx < left.length || rIdx < right.length) {
                                        // Masukkan kamar sisi kiri untuk baris ini
                                        for (let i = 0; i < leftCols; i++) {
                                            if (lIdx < left.length) orderedRooms.push(left[lIdx++]);
                                        }
                                        // Masukkan kamar sisi kanan untuk baris ini
                                        for (let i = 0; i < rightCols; i++) {
                                            if (rIdx < right.length) orderedRooms.push(right[rIdx++]);
                                        }
                                    }

                                    // 4. Gambar kotak-kotak tombol bed ke layar sesuai urutan anyaman
                                    return orderedRooms.map((roomNo) => {
                                        const occupant = activeRecords.find(r => r.roomNumber === roomNo);
                                        const isCurrent = roomNo === patientToSwap.roomNumber;

                                        return (
                                            <button
                                                key={roomNo}
                                                onClick={() => !isCurrent && handleExecuteSwap(roomNo)}
                                                disabled={isCurrent}
                                                className={`p-3 rounded-xl border-2 text-left flex flex-col gap-1 transition-all
                                                ${isCurrent ? 'border-indigo-400 bg-indigo-50 opacity-50 cursor-not-allowed' :
                                                        occupant ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-400' :
                                                            'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 shadow-sm'}`}
                                            >
                                                <span className={`text-sm font-black ${isCurrent ? 'text-indigo-600' : occupant ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    Bed {roomNo}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-600 truncate w-full">
                                                    {isCurrent ? '(Posisi Saat Ini)' : occupant ? `👤 ${occupant.name}` : '✅ KOSONG'}
                                                </span>
                                                {occupant && !isCurrent && (
                                                    <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded w-max mt-1">TUKAR POSISI</span>
                                                )}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- JAM MELAYANG TRANSPARAN (GLASSMORPHISM) DI KANAN BAWAH --- */}
            <div className="fixed bottom-4 right-4 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg z-[50] select-none opacity-50">
                <DigitalClock />
            </div>
        </div>
    );
};

// --- PANEL INPUT WAITING LIST (UPDATED: CTRL+S SHORTCUT & QUICK TAGS MENU) ---
const WaitingListInputPanel = ({ show, onClose, onAdd, availableRooms, waitingList = [], onUpdateRoom, activeRecords = [] }) => {

    // State Form Input
    const [form, setForm] = useState({
        name: '', plannedRoom: '', originRoom: '',
        insuranceClass: '', waNumber: '', diagnosis: ''
    });

    // State Edit Kamar (Pensil)
    const [editingId, setEditingId] = useState(null);
    const [tempRoom, setTempRoom] = useState('');

    // ✨ TAMBAHKAN DUA BARIS INI UNTUK KUNCI DROPDOWN TAILWIND PADA HP
    const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
    const roomSelectRef = useRef(null);

    // ✨ AUTO CLOSE MENU SAAT KLIK DI LUAR AREA KOTAK DROPDOWN
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (roomSelectRef.current && !roomSelectRef.current.contains(event.target)) {
                setIsRoomDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- 1. SHORTCUT KEYBOARD: CTRL + S DI MENU ANTREAN ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!show) return;

            // Deteksi Ctrl + S atau Ctrl + Enter
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'Enter')) {
                e.preventDefault(); // Cegah browser menyimpan halaman

                if (form.name && form.plannedRoom) {
                    onAdd(form);
                    setForm({ name: '', plannedRoom: '', originRoom: '', insuranceClass: '', waNumber: '', diagnosis: '' });
                    onClose();
                } else {
                    alert("Gagal! Nama Pasien dan Target Kamar wajib diisi.");
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [show, form, onAdd, onClose]);

    if (!show) return null;

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!form.name || !form.plannedRoom) return alert("Nama dan Rencana Kamar wajib diisi!");
        onAdd(form);
        setForm({ name: '', plannedRoom: '', originRoom: '', insuranceClass: '', waNumber: '', diagnosis: '' });
        onClose();
    };

    const startEditing = (item) => {
        setEditingId(item.id);
        setTempRoom(item.plannedRoom);
    };

    const saveEditing = () => {
        if (onUpdateRoom && tempRoom) {
            onUpdateRoom(editingId, tempRoom);
        }
        setEditingId(null);
    };

    // LOGIKA DOT WARNA DROPDOWN
    const getRoomOptionStatus = (roomName) => {
        const SINGLE_BED_ROOMS = ['K7', 'K8', 'K9', 'K11', 'K12', 'K14'];

        const patient = activeRecords.find(r => r.roomNumber === roomName);
        if (patient) {
            // ✨ FIX FINAL: Bedakan ikon & warna untuk bed yang sudah TERISI sesuai gender
            if (patient.gender === 'L') {
                return { dot: '🚹', label: 'Terisi Lk', colorClass: 'text-blue-700 font-bold' };
            } else {
                // Default ke Perempuan (Atau jika kosong anggap merah/perempuan)
                return { dot: '🚺', label: 'Terisi Pr', colorClass: 'text-rose-700 font-bold' };
            }
        }

        const booking = waitingList?.find(w => w.plannedRoom === roomName);
        if (booking) return { dot: '⏳', label: 'Antre', colorClass: 'text-yellow-700 font-bold' };

        if (SINGLE_BED_ROOMS.includes(roomName)) return { dot: '🟢', label: 'Kosong', colorClass: 'text-green-700 font-bold' };

        const match = roomName.match(/^(K\d+)(KM|P)$/);
        if (match) {
            const roomCode = match[1];
            // Jika bed saat ini KM, cari tetangganya yang P, begitu sebaliknya
            const neighborBed = match[2] === 'KM' ? 'P' : 'KM';
            const neighborRoomName = `${roomCode}${neighborBed}`;

            const neighbor = activeRecords.find(r => r.roomNumber === neighborRoomName);
            if (neighbor) {
                if (neighbor.gender === 'L') return { dot: '🔵', label: 'Sisa Lk', colorClass: 'text-sky-600 font-bold' };
                if (neighbor.gender === 'P') return { dot: '🟣', label: 'Sisa Pr', colorClass: 'text-purple-600 font-bold' };
            }
        }
        return { dot: '🟢', label: 'Kosong', colorClass: 'text-green-700 font-bold' };
    };

    // --- 2. DATA DAFTAR PILIHAN REKOMENDASI (QUICK TAGS) ---
    const quickOrigins = ['IGD', 'Poli Dalam', 'Poli Paru', 'Poli Saraf', 'ICU', 'HD'];
    const quickDiagnoses = ['DHF', 'Dyspnea', 'GEA', 'CKD', 'Stroke', 'CAD', 'DM Tipe 2', 'Hipertensi', 'Pneumonia'];

    return (
        <div className="flex flex-col h-full bg-white shadow-2xl border-r border-indigo-200 relative">

            {/* HEADER */}
            <div className="p-3 bg-indigo-700 text-white flex justify-between items-center shadow-md z-10">
                <div className="flex flex-col">
                    <h3 className="font-bold text-sm flex items-center gap-1">📝 Input Antrean</h3>
                    <p className="text-[10px] opacity-80">Tekan Ctrl + S untuk simpan cepat</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSubmit} className="px-3 py-1.5 text-[10px] bg-white text-indigo-700 font-bold rounded shadow hover:bg-indigo-50 transition flex items-center gap-1">
                        💾 Simpan
                    </button>
                    <button onClick={onClose} className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg">✕</button>
                </div>
            </div>

            {/* AREA UTAMA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 flex flex-col">

                {/* FORM INPUT */}
                <div className="p-4 space-y-3 bg-white border-b border-gray-200 mb-2 shadow-sm">
                    <div>
                        {/* ✨ TIMPA DENGAN VERSI CUSTOM DROPDOWN (ANTI-POLOSAN HP & TAB) */}
                        <div className="relative" ref={roomSelectRef}>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Kamar *</label>

                            {/* Tombol Utama Pemicu Dropdown */}
                            <button
                                type="button"
                                onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                                className="w-full bg-white border border-gray-300 text-gray-800 text-xs font-bold py-2 px-2.5 rounded flex justify-between items-center hover:bg-gray-50 transition shadow-sm h-[34px] outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                {form.plannedRoom ? (
                                    (() => {
                                        const status = getRoomOptionStatus(form.plannedRoom);
                                        return (
                                            <span className={`flex items-center gap-1.5 ${status.colorClass}`}>
                                                <span className="text-sm leading-none">{status.dot}</span>
                                                <span>Bed {form.plannedRoom}</span>
                                                <span className="text-[10px] opacity-75 font-semibold">({status.label})</span>
                                            </span>
                                        );
                                    })()
                                ) : (
                                    <span className="text-gray-400 font-normal">- Pilih Kamar -</span>
                                )}
                                <span className="text-gray-400 text-[9px]">{isRoomDropdownOpen ? '▲' : '▼'}</span>
                            </button>

                            {/* Menu Floating List Kamar Warna-Warni Menembus Batas Mobile */}
                            {isRoomDropdownOpen && (
                                <div className="absolute top-full left-0 w-full bg-white border border-gray-300 shadow-2xl rounded-xl mt-1 z-[200] p-1 max-h-56 overflow-y-auto custom-scrollbar">
                                    {[...availableRooms]
                                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
                                        .map(r => {
                                            const status = getRoomOptionStatus(r);
                                            const isSelected = form.plannedRoom === r;
                                            return (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() => {
                                                        setForm({ ...form, plannedRoom: r });
                                                        setIsRoomDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-2 py-1.5 text-xs rounded-lg transition-all flex items-center gap-2 mb-0.5 last:mb-0 ${status.colorClass} ${isSelected
                                                        ? 'bg-indigo-600 text-white border-indigo-600 font-black'
                                                        : 'hover:bg-slate-100 border-transparent'
                                                        }`}
                                                >
                                                    <span className="text-sm leading-none shrink-0">{status.dot}</span>
                                                    <span className="font-extrabold tracking-tight flex-1">Bed {r}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-gray-600'}`}>
                                                        {status.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Pasien *</label>
                            <input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold" placeholder="Nama..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>

                        {/* INPUT ASAL + MENU SHORTCUT REKOMENDASI TAG */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Asal Pasien</label>
                            <input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="IGD/Poli..." value={form.originRoom} onChange={e => setForm({ ...form, originRoom: e.target.value })} />
                            {/* Menu Tag Selector Asal */}
                            <div className="flex flex-wrap gap-1 mt-1">
                                {quickOrigins.map(ori => (
                                    <button
                                        key={ori} type="button"
                                        onClick={() => setForm({ ...form, originRoom: ori })}
                                        className="text-[8px] bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 px-1 py-0.5 rounded border border-slate-200 transition font-bold"
                                    >
                                        {ori}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kelas Jaminan</label>
                            <select className="w-full p-2 text-xs border rounded outline-none bg-white focus:ring-1 focus:ring-indigo-500" value={form.insuranceClass} onChange={e => setForm({ ...form, insuranceClass: e.target.value })}>
                                <option value="">- Pilih -</option>
                                <option value="BPJS Kls 1">BPJS Kls 1</option>
                                <option value="BPJS Kls 2">BPJS Kls 2</option>
                                <option value="BPJS Kls 3">BPJS Kls 3</option>
                                <option value="Umum/Asuransi">Umum/Asuransi</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">No. HP Keluarga</label>
                            <input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500 font-mono" placeholder="08xxx..." value={form.waNumber} onChange={e => setForm({ ...form, waNumber: e.target.value })} />
                        </div>
                    </div>

                    {/* INPUT DIAGNOSA + MENU SHORTCUT REKOMENDASI TAG */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Diagnosa Awal / Keluhan</label>
                        <textarea rows="2" className="w-full p-2 text-xs border rounded outline-none resize-none focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="Ketik diagnosa medis..." value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })}></textarea>
                        {/* Menu Tag Selector Diagnosa */}
                        <div className="flex flex-wrap gap-1 mt-1">
                            {quickDiagnoses.map(diag => (
                                <button
                                    key={diag} type="button"
                                    onClick={() => {
                                        const currentDiag = form.diagnosis ? form.diagnosis.trim() : '';
                                        // Jika kolom kosong langsung isi, jika ada isinya tambahkan koma spasi
                                        setForm({
                                            ...form,
                                            diagnosis: currentDiag ? `${currentDiag}, ${diag}` : diag
                                        });
                                    }}
                                    className="text-[8px] bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-1.5 py-0.5 rounded border border-indigo-100 transition font-bold"
                                >
                                    +{diag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* TABEL DAFTAR ANTREAN */}
                <div className="p-2 flex-1">
                    <h3 className="px-2 mb-1 text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Daftar Antrean Saat Ini ({waitingList.length})</h3>
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
                                            <td className="p-2 font-bold text-indigo-700 w-[130px] align-top">
                                                {editingId === item.id ? (
                                                    <div className="flex items-center gap-1 animate-in zoom-in-95 duration-100">
                                                        <select
                                                            className="w-full p-1 text-[10px] border border-indigo-300 rounded bg-white focus:ring-1 focus:ring-indigo-500 font-bold"
                                                            value={tempRoom}
                                                            onChange={e => setTempRoom(e.target.value)}
                                                            autoFocus
                                                        >
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
                                            <td className="p-2 text-center text-gray-500 text-[10px] align-top pt-3 font-bold">
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

// --- KOMPONEN GAMBAR & RADIOLOGI (V2 - SMART PASTE ENABLED) ---
const RadiologyGallery = ({ images = [], onAddImage, onRemoveImage, currentUser }) => {
    const [activeCategory, setActiveCategory] = useState('Rontgen');
    const [previewImage, setPreviewImage] = useState(null);

    const CATEGORIES = ['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka', 'Lainnya'];

    // Filter images by active category
    const categoryImages = images.filter(img => img.category === activeCategory);

    // ✨ FITUR MANDOR: ANTENA CLIPBOARD PENDETEKSI CTRL+V (DIRECT PASTE)
    useEffect(() => {
        const handleClipboardPaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // Pindai isi clipboard untuk mendeteksi apakah ada kiriman file gambar
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    const reader = new FileReader();

                    reader.onload = (event) => {
                        const uploadedBy = (currentUser?.name || 'Perawat').split(' ')[0];
                        const now = new Date();

                        // Menjaga keseragaman format tanggal & waktu persisten sesuai V1
                        const dateStr = now.toLocaleDateString('id-ID', {
                            day: '2-digit', month: '2-digit', year: '2-digit'
                        });
                        const timeStr = now.toLocaleTimeString('id-ID', {
                            hour: '2-digit', minute: '2-digit'
                        });

                        // Tembakkan langsung ke database lewat fungsi onAddImage bawaan kartu
                        onAddImage([{
                            category: activeCategory,
                            imageUrl: event.target.result, // base64 link
                            date: dateStr,
                            time: timeStr,
                            uploadedBy: uploadedBy,
                            id: `img_${Date.now()}_${i}`
                        }]);
                    };
                    reader.readAsDataURL(file);
                }
            }
        };

        // Pasang pendengar otomatis di jendela browser laptop RS
        window.addEventListener('paste', handleClipboardPaste);
        return () => window.removeEventListener('paste', handleClipboardPaste);
    }, [activeCategory, currentUser, onAddImage]);

    // Group images by date for display
    const groupedByDate = useMemo(() => {
        const groups = {};
        categoryImages.forEach(img => {
            const dateKey = img.date || 'Unknown';
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(img);
        });
        // Sort groups by date (newest first)
        return Object.entries(groups).sort((a, b) => {
            const dateA = new Date(a[0].split('/').reverse().join('-'));
            const dateB = new Date(b[0].split('/').reverse().join('-'));
            return dateB - dateA;
        });
    }, [categoryImages]);

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const reader = new FileReader();
        let loadedCount = 0;
        const newImages = [];

        files.forEach((file, idx) => {
            reader.onload = (event) => {
                const uploadedBy = (currentUser?.name || 'Perawat').split(' ')[0];
                const now = new Date();
                const dateStr = now.toLocaleDateString('id-ID', {
                    day: '2-digit', month: '2-digit', year: '2-digit'
                });
                const timeStr = now.toLocaleTimeString('id-ID', {
                    hour: '2-digit', minute: '2-digit'
                });

                newImages.push({
                    category: activeCategory,
                    imageUrl: event.target.result,
                    date: dateStr,
                    time: timeStr,
                    uploadedBy: uploadedBy,
                    id: `img_${Date.now()}_${idx}`
                });

                loadedCount++;
                if (loadedCount === files.length) {
                    onAddImage(newImages);
                }
            };
            reader.readAsDataURL(files[idx]);
        });
        e.target.value = '';
    };

    const formatCategoryIcon = (cat) => {
        switch (cat) {
            case 'Rontgen': return '🩻';
            case 'USG': return '🔊';
            case 'CT Scan': return '💉';
            case 'EKG': return '❤️';
            case 'Luka': return '🩹';
            default: return '📷';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-600 px-3 py-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    📷 Gambar & Radiologi
                </h3>
                <span className="text-[10px] text-gray-300">
                    {images.length} file tersimpan
                </span>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
                {CATEGORIES.map(cat => {
                    const count = images.filter(img => img.category === cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${activeCategory === cat
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                                }`}
                        >
                            {formatCategoryIcon(cat)} {cat}
                            {count > 0 && (
                                <span className={`px-1 rounded-full text-[9px] ${activeCategory === cat ? 'bg-white/30' : 'bg-gray-200'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="p-3 space-y-3">
                {/* 🌟 UPGRADE DESAIN BOX: Ditambahkan panduan visual untuk Ctrl + V agar informatif */}
                <div className="border-2 border-dashed border-indigo-300 bg-indigo-50/20 rounded-lg p-4 text-center hover:border-indigo-400 transition-all">
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id={`rad-upload-${activeCategory}`}
                    />
                    <label
                        htmlFor={`rad-upload-${activeCategory}`}
                        className="cursor-pointer flex flex-col items-center gap-1.5"
                    >
                        <span className="text-2xl animate-pulse">📋</span>
                        <span className="text-xs text-indigo-900 font-black">
                            Tekan Ctrl + V untuk Paste Gambar Langsung!
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">
                            Atau klik di sini untuk pilih file dari folder Windows
                        </span>
                    </label>
                </div>

                {/* Gallery */}
                {groupedByDate.length > 0 ? (
                    <div className="space-y-3">
                        {groupedByDate.map(([date, imgs]) => (
                            <div key={date} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                <div className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1">
                                    📅 {date}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {imgs.map((img, idx) => (
                                        <div key={img.id || idx} className="relative group">
                                            <img
                                                src={img.imageUrl}
                                                alt={`${img.category} ${idx + 1}`}
                                                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-indigo-400 hover:scale-105 transition-all shadow-sm"
                                                onClick={() => setPreviewImage(img.imageUrl)}
                                                title={`${img.uploadedBy} • ${img.time || ''}`}
                                            />
                                            <button
                                                onClick={() => onRemoveImage(img.id || img.imageUrl)}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-red-600"
                                                title="Hapus"
                                            >
                                                ✕
                                            </button>
                                            <div className="absolute -bottom-1 -right-1 bg-white/90 text-[8px] text-gray-500 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition">
                                                {img.time}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-gray-400">
                        <span className="text-3xl">🖼️</span>
                        <p className="text-[10px] mt-1">Belum ada {activeCategory}</p>
                        <p className="text-[9px]">Screenshot / Snip gambar lalu tekan Ctrl + V di sini</p>
                    </div>
                )}
            </div>

            {/* Fullscreen Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white w-10 h-10 rounded-full text-xl flex items-center justify-center transition"
                        onClick={() => setPreviewImage(null)}
                    >
                        ✕
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

// ✨ 2. MESIN PEMBACA & PEWARNA OTOMATIS (V3: ANTI SALAH BACA ANGKA DI NAMA LAB)
const FormattedObjective = ({ text }) => {
    if (!text) return <span>-</span>;

    const lines = text.split('\n');

    return (
        <div className="whitespace-pre-wrap">
            {lines.map((line, idx) => {
                const trimmedLine = line.trim();
                const lowerLine = trimmedLine.toLowerCase();

                // ✨ LINDUNGI HEADER WAKTU AGAR TERLUKIS RAPI
                if (/^\[[A-Za-z0-9\s]+,\s*\d{1,2}\/\d{1,2}.*\]$/.test(trimmedLine)) {
                    return (
                        <div key={idx} className="text-[10px] font-extrabold text-indigo-500 border-b border-indigo-100 pb-0.5 mt-1.5 mb-1 first:mt-0">
                            🕒 {trimmedLine}
                        </div>
                    );
                }

                // ✨ Pakai LAB_PATTERNS dari constants.js (regex robust, bukan startsWith)
                let abnormalType = null;

                for (const [key, pattern] of Object.entries(LAB_PATTERNS || {})) {
                    // Skip multi-line patterns (Gram/Sputum, TCM, dll.)
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

const App = () => {
    // 1. State System (VERSI AUTO-LOGOUT IMBAS INAKTIVITAS)
    const [db, setDb] = useState(null);
    const [storage, setStorage] = useState(null);

    // Waktu Batas: 15 Menit (15 * 60 * 1000 ms)
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

    const [userId, setUserId] = useState(() => {
        const uid = localStorage.getItem('simpan_uid');
        const lastActive = localStorage.getItem('simpan_last_active');
        const now = new Date().getTime();

        if (lastActive && (now - parseInt(lastActive) > INACTIVITY_TIMEOUT)) {
            localStorage.removeItem('simpan_user');
            localStorage.removeItem('simpan_uid');
            localStorage.removeItem('simpan_last_active');
            return null;
        }
        return uid;
    });
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    // 2. State Login Lokal & Mode
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const lastActive = localStorage.getItem('simpan_last_active');
            const now = new Date().getTime();

            if (lastActive && (now - parseInt(lastActive) > INACTIVITY_TIMEOUT)) {
                return null;
            }
            return JSON.parse(localStorage.getItem('simpan_user')) || null;
        } catch (e) {
            return null;
        }
    });
    const [loginForm, setLoginForm] = useState({ id: '', pass: '' });
    // ✨ STATE FASE 1: NAVIGASI ONBOARDING SAAS (SMART FORM)
    const [authView, setAuthView] = useState('LOGIN'); // Hanya 2 opsi: 'LOGIN' atau 'REGISTER'
    const [regForm, setRegForm] = useState({
        fullname: '', id: '', pass: '', role: 'Pelaksana',
        rsSelect: '', newRsName: '',
        wardSelect: '', newWardName: '',
        bedCount: 20, layout: '2baris', bedFormat: 'K1'
    });
    const [appMode, setAppMode] = useState('MEDIS');
    const [allUsers, setAllUsers] = useState([]);

    // --- INIT FIREBASE (VERSI BYPASS JARINGAN RS) ---
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        try {
            // 🔥 3. BERSIHKAN DI SINI:
            // (Hapus baris const app = initializeApp(...) dari sini)
            // (Hapus baris const storage = getStorage(...) dari sini)

            // Cukup sisakan engine Database dengan trik Anti-Blokir Wi-Fi RS + BAN SEREP OFFLINE:
            const firestoreInstance = initializeFirestore(app, {
                experimentalForceLongPolling: true,
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
            setDb(firestoreInstance);
        } catch (error) {
            // ✨ FIX VITE HOT-RELOAD: Jika error karena direfresh 2x, panggil instansi yang sudah nyala
            console.warn("Firestore sudah aktif (Hot-Reload), mengambil instansi...");
            setDb(getFirestore(app));
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ⚡ MESIN SENSOR INAKTIVITAS: AUTO LOGOUT JIKA DITINGGAL LAMA
    useEffect(() => {
        if (!currentUser) return;

        let timeoutId;

        const resetTimer = () => {
            localStorage.setItem('simpan_last_active', new Date().getTime());

            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                handleInternalLogout();
                alert("Sesi Anda telah berakhir demi keamanan data pasien & ruangan. Silakan masuk kembali.");
            }, INACTIVITY_TIMEOUT);
        };

        const interaksiEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        // Daftarkan fungsi pemantau ke window browser (Sudah difix agar sintaksnya aman)
        interaksiEvents.forEach(evt => window.addEventListener(evt, resetTimer));

        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            interaksiEvents.forEach(evt => window.removeEventListener(evt, resetTimer));
        };
    }, [currentUser]);

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
                    localStorage.setItem('simpan_last_active', new Date().getTime());
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
        localStorage.removeItem('simpan_last_active');
    };

    const getCashflowRole = () => {
        if (!currentUser) return null;
        if (currentUser.role === 'admin') return 'ALL';
        if (currentUser.role === 'finance_jm') return 'JM';
        if (currentUser.role === 'finance_kas') return 'KAS';
        if (currentUser.role === 'finance_doc') return 'DOKTER';
        return null;
    };

    // --- 1. TAMPILAN LOGIN & ONBOARDING (FASE 1 - SAAS MODE - COMPACT EDITION) ---
    if (!currentUser) {
        // 🗄️ DUMMY DATA FASE 1: Simulasi Database Rumah Sakit yang sudah mendaftar
        const DUMMY_HOSPITALS = {
            'RSUD Bayu Asih': ['Melati', 'Dahlia', 'IGD', 'Teratai', 'Anyelir', 'Anggrek'],
            'RS Bina Kasih': ['Mawar', 'ICU']
        };
        const availableHospitals = Object.keys(DUMMY_HOSPITALS);
        const availableWards = regForm.rsSelect && DUMMY_HOSPITALS[regForm.rsSelect] ? DUMMY_HOSPITALS[regForm.rsSelect] : [];

        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
                {/* 🔄 UPGRADE: Mengurangi padding dari p-8 menjadi p-5 md:p-6 agar lebih padat di layar laptop kecil */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 relative max-h-[95vh] overflow-y-auto custom-scrollbar transition-all duration-300">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-600"></div>

                    {/* HEADER LOGO */}
                    <div className="text-center mb-5 mt-0 flex flex-col items-center animate-in zoom-in-95 duration-500">
                        {/* 🔄 UPGRADE: Logo diperbesar ke h-24 (sebelumnya h-16), tapi tetap aman untuk layar kecil */}
                        <img src="/logo1.png" alt="Logo SIMPAN" className="h-24 md:h-28 object-contain drop-shadow-md mb-1.5" />
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 border-t border-slate-100 pt-2 w-4/5 mx-auto">
                            Sistem Manajemen Pelayanan Abi Nugroho
                        </p>
                    </div>

                    {/* ---------------------------------------------------------------- */}
                    {/* TAMPILAN A: LOGIN STANDAR */}
                    {/* ---------------------------------------------------------------- */}
                    {authView === 'LOGIN' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* 🔄 UPGRADE: space-y-4 jadi space-y-3 */}
                            <form onSubmit={handleLogin} className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Username</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">👤</span>
                                        <input
                                            type="text" placeholder="Ketik username..."
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                                            value={loginForm.id} onChange={e => setLoginForm({ ...loginForm, id: e.target.value })} autoFocus
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-slate-400">🔒</span>
                                        <input
                                            type="password" placeholder="••••••"
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                                            value={loginForm.pass} onChange={e => setLoginForm({ ...loginForm, pass: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex items-center justify-center gap-2 mt-2">
                                    <span>🚀</span> Masuk
                                </button>
                            </form>

                            <div className="mt-4 border-t border-slate-100 pt-3 text-center flex flex-col items-center">
                                <p className="text-[11px] text-slate-500 mb-1.5">Belum punya akun?
                                    <button
                                        onClick={() => setAuthView('REGISTER')}
                                        className="text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-5 py-1.5 rounded-lg transition-colors border border-indigo-100 w-fit"
                                    >
                                        Daftar di sini
                                    </button>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ---------------------------------------------------------------- */}
                    {/* TAMPILAN B: REGISTRASI (SMART FORM) */}
                    {/* ---------------------------------------------------------------- */}
                    {authView === 'REGISTER' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-1.5">
                                <button onClick={() => setAuthView('LOGIN')} className="text-slate-400 hover:text-indigo-600 transition" title="Kembali">
                                    <ChevronLeft size={18} />
                                </button>
                                <h3 className="font-black text-indigo-900 text-sm uppercase">📝 Pendaftaran Akun Baru</h3>
                            </div>

                            {/* 🔄 UPGRADE: space-y-3 jadi space-y-2 */}
                            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); alert("Fase 1 Selesai! Data Smart Form ini siap dirakit ke database di Fase 3."); }}>

                                {/* 1. IDENTITAS DIRI */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Nama Lengkap</label><input type="text" placeholder="Mis: Ns. Abi" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.fullname} onChange={e => setRegForm({ ...regForm, fullname: e.target.value })} required /></div>
                                    <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Username Baru</label><input type="text" placeholder="Mis: abi.ns" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.id} onChange={e => setRegForm({ ...regForm, id: e.target.value })} required /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Password</label><input type="password" placeholder="••••••" className="w-full p-1.5 border rounded bg-slate-50 text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.pass} onChange={e => setRegForm({ ...regForm, pass: e.target.value })} required /></div>
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

                                {/* 2. PILIH / BUAT INSTANSI (SMART DROPDOWN) */}
                                <div className="p-2.5 border border-slate-200 bg-slate-50/50 rounded-lg space-y-2 mt-2">
                                    {/* Rumah Sakit */}
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Rumah Sakit</label>
                                        <select
                                            className="w-full p-1.5 border rounded bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                            value={regForm.rsSelect}
                                            onChange={e => setRegForm({ ...regForm, rsSelect: e.target.value, wardSelect: '' })}
                                            required
                                        >
                                            <option value="">- Pilih Rumah Sakit -</option>
                                            {availableHospitals.map(rs => <option key={rs} value={rs}>{rs}</option>)}
                                            <option value="BUAT_BARU" className="font-bold text-indigo-600">+ 🏥 Buat RS Baru...</option>
                                        </select>

                                        {/* Auto-muncul jika RS Baru dipilih */}
                                        {regForm.rsSelect === 'BUAT_BARU' && (
                                            <div className="mt-1.5 animate-in fade-in slide-in-from-top-1">
                                                <input type="text" placeholder="Ketik Nama Rumah Sakit Baru..." className="w-full p-1.5 border border-indigo-300 rounded bg-indigo-50/30 text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.newRsName} onChange={e => setRegForm({ ...regForm, newRsName: e.target.value })} required />
                                            </div>
                                        )}
                                    </div>

                                    {/* Ruangan */}
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Ruangan</label>
                                        <select
                                            className="w-full p-1.5 border rounded bg-white text-xs outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                                            value={regForm.wardSelect}
                                            onChange={e => setRegForm({ ...regForm, wardSelect: e.target.value })}
                                            disabled={!regForm.rsSelect}
                                            required
                                        >
                                            <option value="">- Pilih Ruangan -</option>
                                            {availableWards.map(w => <option key={w} value={w}>{w}</option>)}
                                            <option value="BUAT_BARU" className="font-bold text-indigo-600">+ 🛏️ Buat Ruangan Baru...</option>
                                        </select>
                                    </div>

                                    {/* Auto-muncul Builder Denah jika Ruangan Baru dipilih */}
                                    {regForm.wardSelect === 'BUAT_BARU' && (
                                        <div className="p-2 border border-indigo-200 bg-indigo-50 rounded-lg space-y-1.5 mt-1.5 animate-in fade-in zoom-in-95 duration-200">
                                            <h4 className="text-[10px] font-black text-indigo-900 border-b border-indigo-100 pb-1 flex items-center gap-1">
                                                ✨ Setup Denah Ruangan Baru
                                            </h4>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Nama Ruangan Baru</label>
                                                <input type="text" placeholder="Mis: IGD / ICU / Melati" className="w-full p-1.5 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" value={regForm.newWardName} onChange={e => setRegForm({ ...regForm, newWardName: e.target.value })} required />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div><label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Total Bed</label><input type="number" min="1" max="100" className="w-full p-1.5 border rounded text-xs text-center" value={regForm.bedCount} onChange={e => setRegForm({ ...regForm, bedCount: parseInt(e.target.value) })} /></div>
                                                <div className="col-span-2">
                                                    <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Format Bed</label>
                                                    <select className="w-full p-1.5 border rounded text-xs bg-white" value={regForm.bedFormat} onChange={e => setRegForm({ ...regForm, bedFormat: e.target.value })}>
                                                        <option value="K1">Awalan "K" (K1, K2)</option>
                                                        <option value="1">Angka Saja (1, 2, 3)</option>
                                                        <option value="1A">Format Blok (1A, 1B)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Layout Lorong</label>
                                                <select className="w-full p-1.5 border rounded text-xs bg-white" value={regForm.layout} onChange={e => setRegForm({ ...regForm, layout: e.target.value })}>
                                                    <option value="1baris">1 Baris Berjejer</option>
                                                    <option value="2baris">2 Baris (Sisi Kiri & Kanan)</option>
                                                </select>
                                            </div>
                                            <p className="text-[8px] text-indigo-600 font-medium italic leading-tight">*Sebagai pembuat ruangan, Anda otomatis dijadikan Admin (Karu) di sini.</p>
                                        </div>
                                    )}
                                </div>

                                {/* WARNING MESSAGE JIKA GABUNG RUANGAN */}
                                {regForm.wardSelect && regForm.wardSelect !== 'BUAT_BARU' && (
                                    <div className="text-[9px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-200 font-medium leading-tight mt-2">
                                        ⚠️ Akun Anda memerlukan persetujuan <b>Admin/Karu {regForm.wardSelect}</b> untuk dapat masuk.
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 transition shadow-md text-sm mt-3">
                                    Daftar Sekarang 🚀
                                </button>
                            </form>
                        </div>
                    )}

                    {/* FOOTER & LINK APRESIASI */}
                    <div className="text-center mt-4 pt-3 border-t border-slate-100 animate-in fade-in duration-500">
                        <a
                            href="https://trakteer.id/481nugroho"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium transition-colors inline-flex items-center gap-1 hover:underline pb-0.5"
                        >
                            ✨ Traktir Kopi?
                        </a>
                        <p className="text-[9px] text-slate-400">&copy; 2026 SIMPAN - E-Ontang-Anting</p>
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
                                <ChevronLeft size={16} /> Kembali ke Medis
                            </button>
                            <div className="h-6 w-[1px] bg-slate-200"></div>

                            <div className="flex flex-col leading-none justify-center">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mode Keuangan</span>
                                <span className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                                    <Wallet size={16} /> {currentUser.cfLabel}
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
                                <LogOut size={18} />
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
                            membersList={allUsers.filter(u => (u.ward || 'MELATI') === currentUser.ward)} // ✨ FIX: Saring anggota perawat per ruangan
                            onLogout={handleInternalLogout}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;