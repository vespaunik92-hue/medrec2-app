import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CustomInput } from '../utils/helpers';
import { LEFT_ROOMS, RIGHT_ROOMS } from '../constants';

// =====================================================================
// 1. MODAL INPUT TTV & KALKULATOR GCS
// =====================================================================
export const TtvModal = ({ onClose, onSave }) => {
    const [ttv, setTtv] = useState({ td: '', n: '', s: '', rr: '', spo2: '' });
    const [gcs, setGcs] = useState({ e: 4, v: 5, m: 6 });

    const totalGcs = gcs.e + gcs.v + gcs.m;

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
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <CustomInput label="TD (mmHg)" value={ttv.td} onChange={e => setTtv({ ...ttv, td: e.target.value })} placeholder="120/80" />
                    <CustomInput label="Nadi (x/m)" value={ttv.n} onChange={e => setTtv({ ...ttv, n: e.target.value })} placeholder="80" />
                    <CustomInput label="Suhu (C)" value={ttv.s} onChange={e => setTtv({ ...ttv, s: e.target.value })} placeholder="36.5" />
                    <CustomInput label="RR (x/m)" value={ttv.rr} onChange={e => setTtv({ ...ttv, rr: e.target.value })} placeholder="20" />
                    <CustomInput label="SpO2 (%)" value={ttv.spo2} onChange={e => setTtv({ ...ttv, spo2: e.target.value })} placeholder="98" />
                </div>
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

// =====================================================================
// 2. MODAL PILIHAN PULANG / PINDAH / KRS PASS
// =====================================================================
export const DischargeModal = ({ patientName, onCancel, onPindah, onPulang, onMeninggal }) => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-red-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-red-800 mb-3 border-b pb-1 uppercase">Keluar: {patientName}</h3>
            <p className="text-[11px] text-gray-600 mb-4">Pilih kategori keluar pasien untuk akurasi laporan:</p>
            <div className="flex flex-col gap-2">
                <button onClick={onPindah} className="w-full px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold shadow-sm flex items-center justify-center gap-2">🏥 Pindah Ruangan</button>
                <button onClick={onPulang} className="w-full px-3 py-2 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold shadow-sm flex items-center justify-center gap-2">🏠 Pulang (KRS/BLPL)</button>
                <button onClick={onMeninggal} className="w-full px-3 py-2 text-xs bg-gray-800 text-white rounded hover:bg-black font-bold shadow-sm flex items-center justify-center gap-2">💀 Meninggal Dunia</button>
            </div>
            <button onClick={onCancel} className="mt-4 w-full px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 font-bold text-center">Batal</button>
        </div>
    </div>
);

// =====================================================================
// 3. MODAL MENU LAPOR GLOBAL (SHIFT / CS)
// =====================================================================
export const LaporModal = ({ onCancel, onLaporShift, onLaporCS }) => (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-indigo-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-indigo-800 mb-3 border-b pb-1 uppercase">Pilih Jenis Laporan</h3>
            <div className="flex flex-col gap-2">
                <button onClick={onLaporShift} className="w-full px-3 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold shadow-sm flex items-center justify-center gap-2">📝 Laporan Shift</button>
                <button onClick={onLaporCS} className="w-full px-3 py-2 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold shadow-sm flex items-center justify-center gap-2">🧹 Lapor CS (Cleaning Service)</button>
            </div>
            <button onClick={onCancel} className="mt-4 w-full px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 font-bold text-center">Batal</button>
        </div>
    </div>
);

// =====================================================================
// 4. MODAL KONFIRMASI UMUM
// =====================================================================
export const ConfirmationModal = ({ message, onConfirm, onCancel, title, children }) => (
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

// =====================================================================
// 5. MODAL PILIHAN LAPOR WA (PASIEN SPESIFIK)
// =====================================================================
export const LaporConfirmationModal = ({ onLaporDpjp, onLaporJaga, onCancel, patientName, dpjpNumber }) => {
    const formatPhone = (raw) => raw ? '+' + String(raw).replace(/\D/g, '') : '-';
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-4 border-2 border-green-100">
                <h3 className="text-sm font-bold text-green-800 mb-3 border-b pb-1">Lapor Pasien: {patientName}</h3>
                <p className="text-xs text-gray-600 mb-3">Pilih tujuan pengiriman laporan:</p>
                <div className="flex flex-col gap-2">
                    <div className="w-full">
                        <button onClick={onLaporDpjp} disabled={!dpjpNumber} className={`w-full px-3 py-2 text-xs ${dpjpNumber ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} rounded font-bold shadow-sm flex justify-between items-center`}>
                            <span>Ke DPJP Utama</span><span>🚀</span>
                        </button>
                        <div className="text-[9px] text-gray-400 text-right mt-0.5">{dpjpNumber ? formatPhone(dpjpNumber) : 'No. HP Kosong'}</div>
                    </div>
                    <div className="w-full relative">
                        <div className="absolute -top-2 -right-1 bg-yellow-300 text-[8px] font-bold px-1 rounded text-black animate-pulse">BARU</div>
                        <button onClick={() => onLaporJaga()} className="w-full px-3 py-2 text-xs bg-green-600 text-white hover:bg-green-700 rounded font-bold shadow-sm flex justify-between items-center">
                            <span>Ke Dr. Jaga / Raber / Grup</span><span>⏩</span>
                        </button>
                        <div className="text-[9px] text-gray-400 text-right mt-0.5 italic">Pilih kontak sendiri di WA (Forward)</div>
                    </div>
                </div>
                <button onClick={onCancel} className="mt-4 w-full px-3 py-1.5 text-xs border rounded hover:bg-gray-100 text-gray-600 font-bold">Batal</button>
            </div>
        </div>
    );
};

// =====================================================================
// 6. PANEL ANTRIAN DAFTAR TUNGGU (100% STERIL & ORIGINAL)
// =====================================================================
export const WaitingListInputPanel = ({ show, onClose, onAdd, availableRooms, waitingList = [], onUpdateRoom, activeRecords = [] }) => {
    // State Form Input
    const [form, setForm] = useState({
        name: '', plannedRoom: '', originRoom: '',
        insuranceClass: '', waNumber: '', diagnosis: ''
    });

    // State Edit Kamar (Pensil)
    const [editingId, setEditingId] = useState(null);
    const [tempRoom, setTempRoom] = useState('');

    // ✨ KUNCI DROPDOWN TAILWIND PADA HP
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
            if (patient.gender === 'L') {
                return { dot: '🚹', label: 'Terisi Lk', colorClass: 'text-blue-700 font-bold' };
            } else {
                return { dot: '🚺', label: 'Terisi Pr', colorClass: 'text-rose-700 font-bold' };
            }
        }

        const booking = waitingList?.find(w => w.plannedRoom === roomName);
        if (booking) return { dot: '⏳', label: 'Antre', colorClass: 'text-yellow-700 font-bold' };

        if (SINGLE_BED_ROOMS.includes(roomName)) return { dot: '🟢', label: 'Kosong', colorClass: 'text-green-700 font-bold' };

        const match = roomName.match(/^(K\d+)(KM|P)$/);
        if (match) {
            const roomCode = match[1];
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
                        <div className="relative" ref={roomSelectRef}>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Kamar *</label>
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
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Asal Pasien</label>
                            <input type="text" className="w-full p-2 text-xs border rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="IGD/Poli..." value={form.originRoom} onChange={e => setForm({ ...form, originRoom: e.target.value })} />
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

                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Diagnosa Awal / Keluhan</label>
                        <textarea rows="2" className="w-full p-2 text-xs border rounded outline-none resize-none focus:ring-1 focus:ring-indigo-500 font-medium" placeholder="Ketik diagnosa medis..." value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })}></textarea>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {quickDiagnoses.map(diag => (
                                <button
                                    key={diag} type="button"
                                    onClick={() => {
                                        const currentDiag = form.diagnosis ? form.diagnosis.trim() : '';
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