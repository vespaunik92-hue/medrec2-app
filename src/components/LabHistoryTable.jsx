import React from 'react';
import { LAB_PATTERNS, LAB_NORMAL_RANGES, LAB_LOW_IS_BAD } from '../constants';

const LabHistoryTable = ({ record }) => {
    // 🧠 SETUP DATA LAB SAMA PERSIS DENGAN APP.JSX ASLI
    const safeObjective = record?.objective || '';
    const labHistory = record?.labHistory;
    const hasHistory = labHistory && labHistory.length > 0;

    // Logika Fallback: Jika history DB kosong, extract langsung dari teks O yang tertulis di kotak
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

    // 🎨 ENGINE WARNA-WARNI DAN INDIKATOR SAKTI (getLabInfo)
    const getLabInfo = (key, val) => {
        if (!val) return { indicator: '', colorClass: 'text-slate-700' };

        // Handle Tubex khusus
        if (key === 'Tubex') {
            const lowerVal = val.toLowerCase();
            if (lowerVal.includes('positif')) {
                return { indicator: '⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
            }
            const num = parseFloat(val);
            if (!isNaN(num) && num >= 4) {
                return { indicator: '⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
            }
            return { indicator: '', colorClass: 'text-green-600 font-medium' };
        }

        // Cek hasil kualitatif (teks huruf/kata)
        const isQualitative = /^[a-zA-Z]/.test(val) || /^(positif|negatif|reaktif|non|detected|neg|pos)/i.test(val);

        if (isQualitative) {
            const lowerVal = val.toLowerCase();
            if (/(positif|reaktif|detected|pos)/.test(lowerVal)) {
                return { indicator: '⚠️', colorClass: 'text-red-600 font-bold bg-red-50 px-1 rounded' };
            }
            if (/(negatif|non.?reaktif|not.?detected|neg)/.test(lowerVal)) {
                return { indicator: '', colorClass: 'text-green-600 font-medium' };
            }
            return { indicator: '', colorClass: 'text-slate-600' };
        }

        // Hasil Numerik (Angka) - Sesuai LAB_NORMAL_RANGES
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
        return { indicator: '', colorClass: 'text-green-600 font-medium' };
    };

    // Jika bener-bener kosong melompong, tampilkan pesan ramah
    if (allKeys.length === 0) {
        return (
            <div className="text-center py-4 text-gray-400">
                <span className="text-2xl">🧪</span>
                <p className="text-[10px] mt-1">Belum ada riwayat laboratorium</p>
                <p className="text-[8px] text-gray-400 mt-0.5">Hasil otomatis terbaca saat Anda menulis teks Lab di Objektif (O)</p>
            </div>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="text-[9px] border-collapse w-full" style={{ minWidth: 'max-content' }}>
                    <thead>
                        <tr>
                            <th className="border border-slate-200 px-1.5 py-0.5 text-left font-bold bg-slate-100 text-slate-700 sticky left-0 z-10 w-14">
                                Hasil
                            </th>
                            {dateColumns.map((d, idx) => (
                                <th 
                                    key={d} 
                                    className={`border border-slate-200 px-2 py-0.5 text-center font-bold min-w-[56px] ${
                                        idx === 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-50 text-slate-500'
                                    }`}
                                >
                                    {d}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {allKeys.map(key => {
                            const cellValues = hasHistory
                                ? labHistory.map(e => (e.values || {})[key] || null)
                                : [(fallbackValues || {})[key] || null];
                            
                            if (cellValues.every(v => !v)) return null;

                            return (
                                <tr key={key} className="hover:bg-slate-50 transition">
                                    <td className="border border-slate-200 px-1.5 py-0.5 font-bold text-slate-700 bg-slate-50 sticky left-0 z-10 w-14">
                                        {key}
                                    </td>
                                    {cellValues.map((val, idx) => {
                                        if (!val) {
                                            return <td key={idx} className="border border-slate-200 px-2 py-0.5 text-center text-slate-300">-</td>;
                                        }
                                        const { indicator, colorClass } = getLabInfo(key, val);
                                        return (
                                            <td 
                                                key={idx} 
                                                className={`border border-slate-200 px-2 py-0.5 text-center font-mono ${colorClass} ${
                                                    idx === 0 ? 'bg-indigo-50/40' : ''
                                                }`}
                                            >
                                                {indicator && <span className="mr-0.5 text-[8px]">{indicator}</span>}
                                                {val}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="text-[7px] text-gray-500 mt-1 flex gap-2 flex-wrap">
                <span><span className="text-green-600">●</span> Normal</span>
                <span><span className="text-red-600 font-bold">↑⚠️</span> Tinggi</span>
                <span><span className="text-blue-600 font-bold">↓</span> Rendah</span>
            </div>
        </div>
    );
};

export default LabHistoryTable;