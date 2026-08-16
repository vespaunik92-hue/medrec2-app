import React, { useRef, useState, useEffect } from 'react';

// --- KOMPONEN ANAK: PAPAN KANVAS TTD ---
const SignaturePad = ({ label, onSave, onClear }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            onSave(canvasRef.current.toDataURL('image/png'));
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        onClear();
    };

    return (
        <div className="flex flex-col items-center flex-1">
            <span className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">{label}</span>
            <div className="border-2 border-dashed border-indigo-200 rounded-lg overflow-hidden touch-none relative w-full shadow-inner">
                <canvas
                    ref={canvasRef}
                    className="w-full h-28 bg-white cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                <button type="button" onClick={clear} className="absolute bottom-1 right-1 bg-rose-100 text-rose-600 px-2 py-0.5 text-[9px] rounded font-bold shadow-sm hover:bg-rose-200">
                    Ulangi
                </button>
            </div>
        </div>
    );
};

// --- KOMPONEN INDUK 1: JENDELA MODAL SERAH TERIMA TUNGGAL ---
export const HandoverModal = ({ isOpen, onClose, agenda, onSave, currentUser, viewModeData }) => {
    if (!isOpen) return null;

    const [penerimaName, setPenerimaName] = useState('');
    const [ttdPengirim, setTtdPengirim] = useState(null);
    const [ttdPenerima, setTtdPenerima] = useState(null);

    const handleSave = () => {
        if (!penerimaName.trim()) return alert('Nama penerima (Petugas Lab / Farmasi) wajib diisi!');
        if (!ttdPengirim || !ttdPenerima) return alert('Kedua tanda tangan wajib digoreskan sebagai bukti hukum!');

        onSave({
            action: agenda.action,
            pengirimNama: currentUser.name,
            penerimaNama: penerimaName,
            ttdPengirim,
            ttdPenerima,
            verifiedAt: new Date().toISOString()
        });
    };

    if (viewModeData) {
        const dateObj = new Date(viewModeData.verifiedAt);
        return (
            <div className="fixed inset-0 z-[100] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-emerald-600 px-4 py-3 flex justify-between items-center">
                        <h3 className="text-white font-black text-sm flex items-center gap-2">✅ BUKTI SERAH TERIMA</h3>
                        <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">✖</button>
                    </div>
                    <div className="p-5">
                        <div className="text-center mb-5 border-b border-dashed border-slate-200 pb-4">
                            <h4 className="font-black text-slate-800 text-sm">{agenda.action}</h4>
                            <p className="text-xs text-slate-500 mt-1">Pasien: <span className="font-bold text-slate-700">{agenda.name} ({agenda.room})</span></p>
                            <p className="text-[10px] text-emerald-600 font-bold mt-2 bg-emerald-50 inline-block px-2 py-1 rounded-full">
                                Diverifikasi: {dateObj.toLocaleString('id-ID')} WIB
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Pengirim</span>
                                <img src={viewModeData.ttdPengirim} alt="TTD" className="w-full h-20 object-contain border rounded bg-slate-50 mb-1" />
                                <span className="text-[11px] font-black text-slate-800 underline block">{viewModeData.pengirimNama}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Penerima</span>
                                <img src={viewModeData.ttdPenerima} alt="TTD" className="w-full h-20 object-contain border rounded bg-slate-50 mb-1" />
                                <span className="text-[11px] font-black text-slate-800 underline block">{viewModeData.penerimaNama}</span>
                            </div>
                        </div>
                    </div>
                    <div className="p-3 bg-slate-50 border-t">
                        <button onClick={onClose} className="w-full py-2 bg-white border rounded-lg text-xs font-bold text-slate-600 shadow-sm">Tutup</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-amber-500 px-4 py-3 flex justify-between items-center text-white">
                    <h3 className="font-black text-sm">✍️ SERAH TERIMA FISIK</h3>
                    <button onClick={onClose} className="text-lg">✖</button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3">
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs">
                        <span className="font-black text-amber-950 block">{agenda.action}</span>
                        <span className="text-amber-800 font-medium">Pasien: {agenda.name} ({agenda.room})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Pengirim</label>
                            <input type="text" value={currentUser.name} disabled className="w-full p-2 text-xs border rounded bg-slate-100 font-bold text-slate-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Nama Penerima *</label>
                            <input type="text" placeholder="Nama petugas Lab..." value={penerimaName} onChange={e => setPenerimaName(e.target.value)} className="w-full p-2 text-xs border-2 border-indigo-200 rounded font-bold" />
                        </div>
                    </div>
                    <div className="flex gap-2 bg-slate-50 p-2 rounded-xl border">
                        <SignaturePad label="TTD Pengirim" onSave={setTtdPengirim} onClear={() => setTtdPengirim(null)} />
                        <SignaturePad label="TTD Penerima" onSave={setTtdPenerima} onClear={() => setTtdPenerima(null)} />
                    </div>
                </div>
                <div className="p-3 border-t bg-white flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-xs border rounded-lg">Batal</button>
                    <button onClick={handleSave} className="flex-1 py-2 text-xs font-black text-white bg-indigo-600 rounded-lg shadow-md">💾 SIMPAN</button>
                </div>
            </div>
        </div>
    );
};

// =====================================================================
// --- KOMPONEN INDUK 2: BULK HANDOVER MODAL (SISTEM NAMPAN MASAL) ---
// =====================================================================
export const BulkHandoverModal = ({ isOpen, onClose, unverifiedAgendas = [], onSaveBulk, currentUser }) => {
    if (!isOpen) return null;

    const [selectedIds, setSelectedIds] = useState([]);
    const [penerimaName, setPenerimaName] = useState('');
    const [ttdPengirim, setTtdPengirim] = useState(null);
    const [ttdPenerima, setTtdPenerima] = useState(null);

    // Otomatis centang semua sampel di awal biar cepat
    useEffect(() => {
        setSelectedIds(unverifiedAgendas.map((_, idx) => idx));
    }, [unverifiedAgendas]);

    const toggleSelect = (idx) => {
        if (selectedIds.includes(idx)) setSelectedIds(selectedIds.filter(i => i !== idx));
        else setSelectedIds([...selectedIds, idx]);
    };

    const handleSave = () => {
        if (selectedIds.length === 0) return alert('Pilih minimal 1 sampel di dalam nampan!');
        if (!penerimaName.trim()) return alert('Nama Petugas Penerima wajib diisi!');
        if (!ttdPengirim || !ttdPenerima) return alert('Kedua tanda tangan wajib diisi!');

        const chosenAgendas = selectedIds.map(idx => unverifiedAgendas[idx]);
        onSaveBulk(chosenAgendas, {
            pengirimNama: currentUser.name,
            penerimaNama: penerimaName,
            ttdPengirim,
            ttdPenerima,
            verifiedAt: new Date().toISOString()
        });
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
                <div className="bg-indigo-600 px-4 py-3 text-white flex justify-between items-center">
                    <h3 className="font-black text-sm">🧫 SERAH TERIMA NAMPAN MASAL</h3>
                    <button onClick={onClose} className="text-lg">✖</button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pilih Sampel yang Dibawa Dalam Nampan:</span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar border p-2 rounded-lg bg-slate-50">
                        {unverifiedAgendas.map((agenda, idx) => (
                            <label key={idx} className="flex items-center gap-2.5 p-2 bg-white border rounded shadow-sm cursor-pointer hover:bg-indigo-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(idx)}
                                    onChange={() => toggleSelect(idx)}
                                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                />
                                <div className="text-xs">
                                    <span className="font-black text-slate-800 block">{agenda.action}</span>
                                    <span className="text-[10px] text-indigo-600 font-bold">{agenda.room} a.n {agenda.name}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Nama Pengirim</label>
                            <input type="text" value={currentUser.name} disabled className="w-full p-2 text-xs border rounded bg-slate-100 font-bold text-slate-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Nama Penerima Lab *</label>
                            <input type="text" placeholder="Ketik nama analis..." value={penerimaName} onChange={e => setPenerimaName(e.target.value)} className="w-full p-2 text-xs border-2 border-indigo-200 rounded font-bold" />
                        </div>
                    </div>

                    <div className="flex gap-2 bg-slate-50 p-2 rounded-xl border">
                        <SignaturePad label="TTD Perawat" onSave={setTtdPengirim} onClear={() => setTtdPengirim(null)} />
                        <SignaturePad label="TTD Petugas Lab" onSave={setTtdPenerima} onClear={() => setTtdPenerima(null)} />
                    </div>
                </div>
                <div className="p-3 border-t bg-slate-50 flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-xs border rounded-lg bg-white">Batal</button>
                    <button onClick={handleSave} className="flex-1 py-2 text-xs font-black text-white bg-indigo-600 rounded-lg shadow-md">🧪 VERIFIKASI 1 NAMPAN</button>
                </div>
            </div>
        </div>
    );
};