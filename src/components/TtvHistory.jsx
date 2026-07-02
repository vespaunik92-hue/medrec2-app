import React, { useMemo } from 'react';

const TtvHistory = ({ objective }) => {
    const tableData = useMemo(() => {
        if (!objective) return [];

        const lines = objective.split('\n').map(l => l.trim()).filter(Boolean);
        const historyMap = {};
        
        let currentDateTimeLabel = '-';

        lines.forEach(line => {
            // 1. Tangkap stempel waktu [Nama, DD/MM/YY HH:MM]
            const headerMatch = line.match(/(?:🕒\s*)?\[[^,]+,\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\s+(\d{1,2})[:\.](\d{1,2})\]/);
            if (headerMatch) {
                const d = headerMatch[1].padStart(2, '0');
                const m = headerMatch[2].padStart(2, '0');
                const hr = headerMatch[4].padStart(2, '0');
                const mn = headerMatch[5].padStart(2, '0');
                currentDateTimeLabel = `${d}/${m} ${hr}:${mn}`;
                return;
            }

            if (currentDateTimeLabel === '-') currentDateTimeLabel = 'Sekarang';

            if (!historyMap[currentDateTimeLabel]) {
                historyMap[currentDateTimeLabel] = { td: '-', nadi: '-', suhu: '-', rr: '-', spo2: '-' };
            }

            // 2. TD: Wajib ada garis miring
            const tdMatch = line.match(/\b(?:TD|Tensi|BP)\b\s*[:=]?\s*(\d{2,3}\s*\/\s*\d{2,3})\b/i);
            if (tdMatch) historyMap[currentDateTimeLabel].td = tdMatch[1].replace(/\s+/g, '');

            // 3. Nadi: Gembok \b agar N tidak bentrok dengan Na (Natrium Lab)
            const nadiMatch = line.match(/\b(?:Nadi|HR|N|Nd)\b\s*[:=]?\s*(\d{2,3})\b/i);
            if (nadiMatch) historyMap[currentDateTimeLabel].nadi = nadiMatch[1];

            // 4. Suhu: Gembok \b agar S tidak bentrok dengan SpO2 atau SGOT
            const suhuMatch = line.match(/\b(?:Suhu|T|S)\b\s*[:=]?\s*(\d{2}(?:[.,]\d)?)\b/i);
            if (suhuMatch) historyMap[currentDateTimeLabel].suhu = suhuMatch[1].replace(',', '.');

            // 5. RR: Gembok \b agar R tidak bentrok dengan RBC
            const rrMatch = line.match(/\b(?:RR|Pernapasan|Resp|P|R)\b\s*[:=]?\s*(\d{1,3})\b/i);
            if (rrMatch) historyMap[currentDateTimeLabel].rr = rrMatch[1];

            // 6. SpO2: Aman dari incaran Suhu
            const spo2Match = line.match(/\b(?:SpO2|Saturasi|Sat|Sato2)\b\s*[:=]?\s*(\d{2,3})%?\b/i);
            if (spo2Match) historyMap[currentDateTimeLabel].spo2 = spo2Match[1];
        });

        // 7. Hitung Skor EWS Otomatis (NEWS2 Standard)
        return Object.entries(historyMap).map(([time, vals]) => {
            let score = 0;
            let isValid = false;

            if (vals.td && vals.td !== '-') {
                const sys = parseInt(vals.td.split('/')[0]);
                if (sys <= 90) score += 3;
                else if (sys <= 100) score += 2;
                else if (sys <= 110) score += 1;
                else if (sys >= 220) score += 3;
                isValid = true;
            }

            if (vals.nadi && vals.nadi !== '-') {
                const hr = parseInt(vals.nadi);
                if (hr <= 40) score += 3;
                else if (hr <= 50) score += 1;
                else if (hr >= 131) score += 3;
                else if (hr >= 111) score += 2;
                else if (hr >= 91) score += 1;
                isValid = true;
            }

            if (vals.suhu && vals.suhu !== '-') {
                const temp = parseFloat(vals.suhu);
                if (temp <= 35.0) score += 3;
                else if (temp <= 36.0) score += 1;
                else if (temp >= 39.1) score += 2;
                else if (temp >= 38.1) score += 1;
                isValid = true;
            }

            if (vals.rr && vals.rr !== '-') {
                const rr = parseInt(vals.rr);
                if (rr <= 8) score += 3;
                else if (rr <= 11) score += 1;
                else if (rr >= 25) score += 3;
                else if (rr >= 21) score += 2;
                isValid = true;
            }

            if (vals.spo2 && vals.spo2 !== '-') {
                const spo2 = parseInt(vals.spo2);
                if (spo2 <= 91) score += 3;
                else if (spo2 <= 93) score += 2;
                else if (spo2 <= 95) score += 1;
                isValid = true;
            }

            return { time, ews: isValid ? score : '-', ...vals };
        }).filter(item => item.td !== '-' || item.nadi !== '-' || item.suhu !== '-' || item.rr !== '-' || item.spo2 !== '-');

    }, [objective]);

    const getEwsColor = (score) => {
        if (score === '-') return 'bg-gray-100 text-gray-400';
        if (score === 0) return 'bg-green-100 text-green-700';
        if (score >= 1 && score <= 4) return 'bg-yellow-100 text-yellow-700';
        if (score >= 5 && score <= 6) return 'bg-orange-100 text-orange-700';
        return 'bg-red-100 text-red-700 font-bold animate-pulse';
    };

    if (tableData.length === 0) {
        return <div className="text-center py-6 text-gray-400 text-[10px] italic">Belum ada rekaman TTV / EWS</div>;
    }

    return (
        <div className="overflow-x-auto pb-2 custom-scrollbar">
            <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr className="bg-slate-50 border-b border-gray-200">
                        <th className="p-2 font-extrabold text-slate-500 bg-slate-50 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-20 border-r border-gray-200">
                            PARAMETER
                        </th>
                        {tableData.map((col, idx) => (
                            <th key={idx} className="p-2 font-bold text-indigo-700 text-center min-w-[70px] whitespace-nowrap">
                                {/* ✨ DIBUAT SEJAJAR: Langsung tampilkan col.time tanpa di-split */}
                                {col.time}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-600 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100">TD</td>
                        {tableData.map((col, idx) => (
                            <td key={idx} className="p-2 text-center text-slate-700 font-medium">{col.td}</td>
                        ))}
                    </tr>
                    <tr className="border-b hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-600 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100">Nadi</td>
                        {tableData.map((col, idx) => (
                            <td key={idx} className="p-2 text-center text-slate-700 font-medium">{col.nadi}</td>
                        ))}
                    </tr>
                    <tr className="border-b hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-600 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100">Suhu</td>
                        {tableData.map((col, idx) => (
                            <td key={idx} className="p-2 text-center text-slate-700 font-medium">{col.suhu}</td>
                        ))}
                    </tr>
                    <tr className="border-b hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-600 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100">RR</td>
                        {tableData.map((col, idx) => (
                            <td key={idx} className="p-2 text-center text-slate-700 font-medium">{col.rr}</td>
                        ))}
                    </tr>
                    <tr className="border-b border-gray-300 hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-600 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-100">SpO2</td>
                        {tableData.map((col, idx) => (
                            <td key={idx} className="p-2 text-center text-slate-700 font-medium">{col.spo2 !== '-' ? `${col.spo2}%` : '-'}</td>
                        ))}
                    </tr>
                    <tr className="hover:bg-slate-50 bg-slate-50/50">
                        <td className="p-2 font-extrabold text-slate-800 bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200">EWS</td>
                        {tableData.map((col, idx) => (
                            <td key={idx} className="p-2 text-center">
                                <span className={`inline-block min-w-[24px] px-2 py-1 rounded-full font-bold ${getEwsColor(col.ews)}`}>
                                    {col.ews}
                                </span>
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default TtvHistory;