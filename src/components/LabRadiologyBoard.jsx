import React, { useMemo } from 'react';
import { parsePlanning } from '../utils/helpers'; // Pastikan path ini sesuai dengan struktur foldermu

const LabRadiologyBoard = ({ records }) => {
    // 1. Ekstrak dan Kelompokkan Data dari Planning
    const { labGroups, radGroups, totalLabs, totalRads } = useMemo(() => {
        const labs = {};
        const rads = {};
        let tLabs = 0;
        let tRads = 0;

        records.forEach(rec => {
            if (!rec.planning) return;
            // Gunakan mesin pengekstrak bawaanmu
            const parsed = parsePlanning(rec.planning);
            
            // Kelompokkan Lab
            if (parsed.labs && parsed.labs.length > 0) {
                parsed.labs.forEach(labItem => {
                    const testName = labItem.trim().toUpperCase(); // Normalisasi jadi huruf besar
                    if (!labs[testName]) labs[testName] = [];
                    labs[testName].push({ room: rec.roomNumber, name: rec.name });
                    tLabs++;
                });
            }

            // Kelompokkan Radiologi
            if (parsed.rads && parsed.rads.length > 0) {
                parsed.rads.forEach(radItem => {
                    const testName = radItem.trim().toUpperCase();
                    if (!rads[testName]) rads[testName] = [];
                    rads[testName].push({ room: rec.roomNumber, name: rec.name });
                    tRads++;
                });
            }
        });

        // Fungsi agar urutan namanya rapi sesuai Abjad (A-Z)
        const sortObj = (obj) => Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {});

        return { labGroups: sortObj(labs), radGroups: sortObj(rads), totalLabs: tLabs, totalRads: tRads };
    }, [records]);

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 h-full overflow-y-auto printable-card">
            {/* HEADER PAPAN REKAP */}
            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        📋 REKAPITULASI JADWAL LAB & RADIOLOGI
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Otomatis diekstrak dari instruksi Planning (P) pasien yang sedang dirawat.</p>
                </div>
                <button 
                    onClick={() => window.print()}
                    className="no-print bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition flex items-center gap-2"
                >
                    🖨️ Cetak Papan
                </button>
            </div>

            {/* TAMPILAN JIKA TIDAK ADA JADWAL */}
            {totalLabs === 0 && totalRads === 0 && (
                <div className="text-center py-12 text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-lg">
                    Belum ada rencana Lab atau Radiologi untuk saat ini.
                </div>
            )}

            {/* SEKSI LABORATORIUM */}
            {totalLabs > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-extrabold text-blue-900 bg-blue-100 border border-blue-200 px-3 py-1.5 rounded inline-flex items-center gap-2 mb-3">
                        🧪 LABORATORIUM ({totalLabs} Pasien)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(labGroups).map(([testName, patients]) => (
                            <div key={testName} className="border border-slate-300 rounded-md p-2 bg-slate-50 shadow-sm print:break-inside-avoid">
                                <div className="font-black text-slate-800 border-b border-slate-300 pb-1 mb-1.5 flex justify-between items-center">
                                    <span className="text-[13px]">{testName}</span>
                                    <span className="bg-blue-600 text-white px-1.5 rounded text-[10px] font-bold">{patients.length}</span>
                                </div>
                                <ul className="space-y-1">
                                    {patients.map((p, i) => (
                                        <li key={i} className="text-[11px] text-slate-700 flex items-center gap-1.5 border-b border-dashed border-slate-200 last:border-0 pb-1 last:pb-0">
                                            <span className="font-bold text-[10px] bg-white border border-slate-300 px-1 py-0.5 rounded shadow-sm shrink-0 w-8 text-center">
                                                {p.room.replace(/[AB]$/, '')}
                                            </span>
                                            <span className="font-semibold uppercase truncate">{p.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SEKSI RADIOLOGI */}
            {totalRads > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-extrabold text-amber-900 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded inline-flex items-center gap-2 mb-3">
                        ☢️ RADIOLOGI ({totalRads} Pasien)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(radGroups).map(([testName, patients]) => (
                            <div key={testName} className="border border-slate-300 rounded-md p-2 bg-slate-50 shadow-sm print:break-inside-avoid">
                                <div className="font-black text-slate-800 border-b border-slate-300 pb-1 mb-1.5 flex justify-between items-center">
                                    <span className="text-[13px]">{testName}</span>
                                    <span className="bg-amber-600 text-white px-1.5 rounded text-[10px] font-bold">{patients.length}</span>
                                </div>
                                <ul className="space-y-1">
                                    {patients.map((p, i) => (
                                        <li key={i} className="text-[11px] text-slate-700 flex items-center gap-1.5 border-b border-dashed border-slate-200 last:border-0 pb-1 last:pb-0">
                                            <span className="font-bold text-[10px] bg-white border border-slate-300 px-1 py-0.5 rounded shadow-sm shrink-0 w-8 text-center">
                                                {p.room.replace(/[AB]$/, '')}
                                            </span>
                                            <span className="font-semibold uppercase truncate">{p.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* FOOTER KHUSUS SAAT DICETAK */}
            <div className="hidden print:block mt-8 text-right text-[10px] text-gray-500 italic font-medium">
                Dicetak oleh {records.length > 0 ? "E-Ontang-Anting" : "Sistem"} pada: {new Date().toLocaleString('id-ID')}
            </div>
        </div>
    );
};

export default LabRadiologyBoard;