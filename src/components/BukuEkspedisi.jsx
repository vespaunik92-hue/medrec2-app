import React, { useState, useMemo } from 'react';

export const BukuEkspedisiModal = ({ isOpen, onClose, activeRecords = [], archivedRecords = [] }) => {
    if (!isOpen) return null;

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTtd, setSelectedTtd] = useState(null);

    // 🕵️‍♂️ GABUNGKAN DATA TTD DARI SELURUH REKAM MEDIS
    const logsHistory = useMemo(() => {
        const allLogs = [];
        const combined = [...activeRecords, ...archivedRecords];

        combined.forEach(patient => {
            if (Array.isArray(patient.verifiedAgendas)) {
                patient.verifiedAgendas.forEach(agenda => {
                    allLogs.push({
                        ...agenda,
                        patientName: patient.name,
                        roomNumber: patient.lastRoom || patient.roomNumber || 'Arsip',
                        rmNumber: patient.rmNumber || '-'
                    });
                });
            }
        });

        return allLogs.sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));
    }, [activeRecords, archivedRecords]);

    const filteredLogs = logsHistory.filter(log => 
        log.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.penerimaNama.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // =====================================================================
    // 🖨️ ENGINE CETAK BUKU REGISTER EKSPEDISI (FORMAT TABEL LANDSCAPE A4)
    // =====================================================================
    const handlePrintEkspedisiTable = () => {
        const content = document.getElementById('buku-ekspedisi-table-area');
        if (!content) return alert("Konten tabel tidak ditemukan.");
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cetak Buku Ekspedisi Digital</title>
                <style>
                    @page { size: A4 landscape; margin: 8mm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 5px; color: #000; }
                    h3 { text-align: center; margin: 0 0 4px 0; font-size: 14pt; color: #000; text-transform: uppercase; font-weight: bold; }
                    .date { text-align: center; font-size: 8.5pt; color: #475569; margin-bottom: 12px; font-style: italic; }
                    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
                    th, td { border: 0.75pt solid #000; padding: 6px 5px; vertical-align: middle; text-align: left; word-wrap: break-word; }
                    th { background-color: #f1f5f9 !important; font-weight: bold; text-transform: uppercase; font-size: 8pt; text-align: center; }
                    
                    /* Paksa elemen div di dalam sel tabel agar selalu memiliki baris baru */
                    td div { margin: 0; padding: 0; line-height: 1.3; }
                    
                    /* Pengunci Lebar Kolom Kertas Landscape */
                    th:nth-child(1), td:nth-child(1) { width: 35px; text-align: center; }
                    th:nth-child(2), td:nth-child(2) { width: 110px; text-align: center; }
                    th:nth-child(3), td:nth-child(3) { width: 65px; text-align: center; }
                    th:nth-child(4), td:nth-child(4) { width: 160px; }
                    th:nth-child(5), td:nth-child(5) { width: 220px; font-weight: bold; }
                    th:nth-child(6), td:nth-child(6) { width: 120px; }
                    th:nth-child(7), td:nth-child(7) { width: 120px; }
                    
                    /* Sembunyikan kolom tombol aksi "Lihat TTD" saat dicetak kertas */
                    th:nth-child(8), td:nth-child(8) { display: none !important; }
                </style>
            </head>
            <body>
                <h3>BUKU EKSPEDISI SERAH TERIMA DIGITAL RUANGAN</h3>
                <div class="date">Data Kronologis Resmi - Dicetak pada: ${new Date().toLocaleString('id-ID')} WIB</div>
                <table>
                    ${content.innerHTML}
                </table>
                <script>
                    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 400); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-[110] bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* HEADER */}
                <div className="bg-slate-800 text-white px-5 py-3.5 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-sm flex items-center gap-2">📦 BUKU EKSPEDISI & SERAH TERIMA DIGITAL</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Bukti otentik penyerahan sampel laboratorium & penunjang medis ruangan</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✖</button>
                </div>

                {/* BARIS PENCARIAN & AKSI CETAK */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                    <input 
                        type="text" 
                        placeholder="🔍 Cari nama pasien, jenis sampel, atau analis lab..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-1 max-w-md p-2 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-500 bg-white font-medium"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-3 py-1.5 rounded-full font-mono">
                            Total: {filteredLogs.length} Log
                        </span>
                        {filteredLogs.length > 0 && (
                            <button
                                onClick={handlePrintEkspedisiTable}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-sm transition flex items-center gap-1"
                            >
                                🖨️ Cetak Buku Register
                            </button>
                        )}
                    </div>
                </div>

                {/* AREA TABEL UTAMA */}
                <div className="flex-1 overflow-auto custom-scrollbar p-3">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic text-xs">Tidak ditemukan riwayat serah terima penunjang medis.</div>
                    ) : (
                        <table id="buku-ekspedisi-table-area" className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-100 text-slate-600 font-black text-[10px] uppercase sticky top-0 z-10 border-b-2 border-slate-300">
                                <tr>
                                    <th className="p-2.5 text-center w-12">No</th>
                                    <th className="p-2.5 w-32 text-center">Waktu Verifikasi</th>
                                    <th className="p-2.5 w-24 text-center">Kamar</th>
                                    <th className="p-2.5 w-48">Identitas Pasien</th>
                                    <th className="p-2.5">Nama Item / Sampel Pemeriksaan</th>
                                    <th className="p-2.5 w-36">Diserahkan Oleh</th>
                                    <th className="p-2.5 w-36">Diterima Oleh (Lab, Rad, BDRS, Kel. Pasien)</th>
                                    <th className="p-2.5 text-center w-24">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {filteredLogs.map((log, idx) => {
                                    const dateObj = new Date(log.verifiedAt);
                                    const dateStr = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

                                    return (
                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-2.5 text-center font-bold text-slate-400 font-mono">{idx + 1}</td>
                                            <td className="p-2.5 font-mono text-[11px] text-center">
                                                <div className="font-bold text-slate-900">{dateStr}</div>
                                                <div className="text-slate-500 text-[10px] font-semibold">{timeStr} WIB</div>
                                            </td>
                                            <td className="p-2.5 font-black text-indigo-700 text-center">Bed {log.roomNumber}</td>
                                            <td className="p-2.5">
                                                <div className="font-black text-slate-900">{log.patientName}</div>
                                                <div className="text-[10px] text-slate-500 font-mono font-bold">RM: {log.rmNumber}</div>
                                            </td>
                                            <td className="p-2.5 font-bold text-slate-900 bg-slate-50/50">{log.action}</td>
                                            <td className="p-2.5 font-black text-slate-700 uppercase tracking-tight text-[11px]">👤 {log.pengirimNama ? log.pengirimNama.split(' ')[0] : '-'}</td>
                                            <td className="p-2.5 font-black text-emerald-800 uppercase tracking-tight text-[11px]">🔬 {log.penerimaNama}</td>
                                            <td className="p-2.5 text-center">
                                                <button 
                                                    onClick={() => setSelectedTtd(log)}
                                                    className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-2 py-1 rounded border border-indigo-200 text-[10px] font-black shadow-sm transition"
                                                >
                                                    👁️ Lihat TTD
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* --- POPUP LIHAT DETAIL TANDA TANGAN --- */}
            {selectedTtd && (
                <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedTtd(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h4 className="font-black text-slate-800 text-center mb-4 text-xs border-b pb-2 uppercase tracking-wide">🏷️ Berkas Otentik Bukti Penyerahan</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <span className="text-[9px] font-bold text-slate-400 block mb-1">TTD Ruangan</span>
                                <img src={selectedTtd.ttdPengirim} alt="TTD" className="w-full h-20 object-contain border rounded bg-slate-50 mb-1" />
                                <span className="text-xs font-black block truncate">{selectedTtd.pengirimNama}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[9px] font-bold text-slate-400 block mb-1">TTD Petugas Lab</span>
                                <img src={selectedTtd.ttdPenerima} alt="TTD" className="w-full h-20 object-contain border rounded bg-slate-50 mb-1" />
                                <span className="text-xs font-black block truncate text-emerald-800">{selectedTtd.penerimaNama}</span>
                            </div>
                        </div>
                        <button onClick={() => setSelectedTtd(null)} className="mt-5 w-full py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg">Tutup Bukti</button>
                    </div>
                </div>
            )}
        </div>
    );
};