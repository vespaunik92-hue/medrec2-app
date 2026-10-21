import React, { memo, useState, useMemo } from 'react';
import { renderPlanningCell, renderObjectiveCell, extractActiveMedications, getAntibioticDay, AbxPill } from '../utils/helpers';
import LabHistoryTable from './LabHistoryTable';
import TtvHistory from './TtvHistory';
import { autoSmartDateTransformer } from './PrintManager'; // 👈 TAMBAHKAN BARIS INI

// Helper pemeriksa kecocokan nama dokter
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

// Buang ekor frekuensi & rute dari baris resep tanpa kurung → sisa nama + dosis
const stripRxTail = (s = '') => s
   .replace(/\s*\([^)]*\)/g, '')
   .replace(/\s+\d+\s*x\s*[\d\w\/\.]*\s*$/i, '')
   .replace(/\s+(?:iv|im|sc|po|nebu)\s*$/i, '')
   .trim();

const PatientApoCard = memo(({
    rec,
    currentUser,
    isDoctor,
    soapMode,
    expandedCardId,
    setExpandedCardId,
    expandedCardTab,
    setExpandedCardTab,
    handleEdit,
    handleToggleVisite,
    setPatientToSwap,
    setShowSwapModal,
    setRecordForLapor,
    setSelectedRecordForPrint,
    handleDischarge,
    handlePublishToRoom,
    handleCardToggleShift,
    setMarSelectedRecord,
    setIsMarModalOpen,
    onOpenMarModal
}) => {
    // 1. Pembersih Stempel Waktu
    const stripAuthorTags = (text) => (text || '').replace(/(?:🕒\s*)?\[[^\]]+,\s*[\d\/]+\s+[\d:]+\]\s*/g, '').trim();
    const isActuallyEmpty = (text) => stripAuthorTags(text) === '' || stripAuthorTags(text) === '-';

    const effectiveSoapMode = isDoctor ? 'ruangan' : soapMode;
    const personalNotes = rec.personalNotes?.[currentUser?.name] || {};
    const rawSubj = effectiveSoapMode === 'personal' ? (personalNotes.subjective || '') : (rec.subjective || '');
    const rawObj = effectiveSoapMode === 'personal' ? (personalNotes.objective || '') : (rec.objective || '');
    const rawAna = effectiveSoapMode === 'personal' ? (personalNotes.analysis || '') : (rec.analysis || '');
    const rawPlan = effectiveSoapMode === 'personal' ? (personalNotes.planning || '') : (rec.planning || '');

    const safeSubjective = isActuallyEmpty(rawSubj) ? '' : stripAuthorTags(rawSubj);
    const safeObjective = isActuallyEmpty(rawObj) ? '' : stripAuthorTags(rawObj);
    const safePlanning = isActuallyEmpty(rawPlan) ? '' : stripAuthorTags(rawPlan);
    const safeAnalysis = stripAuthorTags(rawAna);

    const hasSubjective = safeSubjective && safeSubjective !== '-' && safeSubjective !== '';
    const isMyRaberPatient = isMatchDoctor(rec.raberName, currentUser?.name) || isMatchDoctor(rec.raber2Name, currentUser?.name);

    // 1. State Buka-Tutup Jadwal Jam CPO (Default tertutup)
    const [showCpoSchedule, setShowCpoSchedule] = useState(false);
    
    // 2. 🛡️ Ekstraksi Obat Bersih (Struktur Lama Tetap Utuh + Kebal R/BLPL)
    const activeMeds = useMemo(() => {
        // 👈 KUNCI: Potong teks planning agar BERHENTI sebelum blok R/BLPL / Rencana Pulang
        const planningBeforeBlpl = (rec?.planning || '').split(/\b(?:r\/blpl|rencana\s*blpl|obat\s*pulang)\b/i)[0];

        // A. Saring planning rawat inap: buang stempel [Abi...], Lab, Rad, Tindakan, lepas, dll.
        const validPlanningLines = planningBeforeBlpl
            .split('\n')
            .map(l => l.trim())
            .filter(l => {
                if (!l) return false;
                if (l.startsWith('[') && l.includes(']')) return false; // Buang stempel [Abi, ...]
                const lower = l.toLowerCase();
                if (/^(lab|rad|tm|tndkn|lapor|konsul|rencana|blpl|rblpl|pulang|lepas)/i.test(lower)) return false;
                if (/^(🔬|🩻|💉|⚠️|🎉|👨‍⚕️)/.test(l)) return false;
                return true;
            });

        // B. Ambil resep obat paten (buang tanda strip "-", bullet "•", bintang "*")
        const validRxLines = (rec?.currentPrescription || '')
            .split('\n')
            .map(l => l.replace(/^[\s•\-\*–—]+/, '').trim())
            .filter(Boolean);

        const cleanPlanningText = validPlanningLines.join('\n');
        const cleanRxText = validRxLines.join('\n');
        const combinedText = `${cleanPlanningText}\n${cleanRxText}`.trim();

        // C. Coba panggil parser bawaan helpers
        let parsed = [];
        try {
            parsed = extractActiveMedications(cleanPlanningText, cleanRxText) || [];
        } catch (e) {}

        if (!parsed || parsed.length === 0) {
            try {
                parsed = extractActiveMedications(combinedText) || [];
            } catch (e) {}
        }

        // Pastikan tidak ada teks non-obat yang lolos
        parsed = (parsed || []).filter(m => {
            const txt = (m.raw || m.cleanText || '').toLowerCase();
            return !txt.startsWith('[') && !/^(lab|rad|tm|rencana|blpl|lepas)/i.test(txt);
        });

        // D. 🚀 Fail-Safe: Jika fungsi bawaan helpers kosong, ekstrak dari baris resep obat
        if (parsed.length === 0) {
            const targetLines = [
                ...validRxLines,
                ...validPlanningLines.filter(l => /^(th\.|terapi|infus|trnfs|transfusi)/i.test(l))
            ];

            parsed = targetLines.map(line => {
                const cleanLine = line.replace(/^(th\.|terapi:?)\s*/i, '').trim();
                const isIvfd = /\bivfd\b/i.test(cleanLine);
                const routeMatch = cleanLine.match(/\b(iv|im|po|p\.o|sc|nebu|drip|infus|tab|kaps|inj|vial|amp)\b/i);
                const route = isIvfd ? 'IV' : (routeMatch ? routeMatch[1].toUpperCase().replace(/^PO$/, 'P.O') : 'P.O');
                const tpmMatch = cleanLine.match(/(\d+)\s*tpm/i);
                const freqMatch = cleanLine.match(/(\d+\s*x\s*[\d\w\/\.]*|\d+\s*x)/i);
                const freqText = tpmMatch ? `${tpmMatch[1]} tpm` : (freqMatch ? freqMatch[1].replace(/,/g, '').trim() : '1x1');

                return {
                    raw: cleanLine,
                    cleanText: stripRxTail(cleanLine) || cleanLine,
                    route: route,
                    freqText: freqText
                };
            });
        }

        return parsed;
    }, [rec?.planning, rec?.currentPrescription]);

    // 3. 📅 SETUP TANGGAL & FORMATTER (Ditaruh tepat di bawah activeMeds agar formatTgl selalu terbaca)
    const today = new Date();
    const yesterday = new Date(today); 
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today); 
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatTgl = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });

    const getSafeYMD = (d = new Date()) => {
        if (isNaN(d)) d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const todayYMD = getSafeYMD(today);
    const yesterdayYMD = getSafeYMD(yesterday);
    const tomorrowYMD = getSafeYMD(tomorrow);

    // 4. JAM SHIFT PEMBERIAN OBAT
    const allShifts = [
        { key: 'jam_12', label: '12:00' },
        { key: 'jam_18', label: '18:00' },
        { key: 'jam_24', label: '24:00' },
        { key: 'jam_06', label: '06:00' }
    ];

    // 5. PEMBACA STATUS CEKLIS SHIFT DINAS
    const getShiftLog = (medLogs, dateStr, medObj, sKey) => {
        const dayData = medLogs?.[dateStr] || {};
        if (dayData[medObj.raw]?.[sKey]) return dayData[medObj.raw][sKey];
        if (dayData[medObj.cleanText]?.[sKey]) return dayData[medObj.cleanText][sKey];
        const cleanTarget = (medObj.cleanText || medObj.raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const k of Object.keys(dayData)) {
            const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normK && (normK.includes(cleanTarget) || cleanTarget.includes(normK))) {
                if (dayData[k]?.[sKey]) return dayData[k][sKey];
            }
        }
        return { checked: false, scheduled: false };
    };

    return (
        <div
            onClick={() => handleEdit(rec)}
            className="bg-white rounded-xl border border-slate-300 shadow-sm p-4 hover:border-indigo-500 hover:shadow-md transition cursor-pointer group text-xs text-black font-sans relative"
            title="Klik untuk Edit SOAP Pasien"
        >
            {/* Header Atas Kartu */}
            <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black border-2 border-black px-1.5 py-0.5 bg-slate-50 text-black shrink-0">
                            {isDoctor
                                ? `${rec.ward || 'MELATI'} • ${rec.roomNumber ? rec.roomNumber.replace(/(KM|P)$/i, '') : ''}`
                                : (rec.roomNumber ? rec.roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2') : '')}
                        </span>
                        <span className="text-sm font-black text-slate-900">{rec.name}</span>
                        {isMyRaberPatient && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                🤝 Pasien Konsulan/Raber
                            </span>
                        )}
                        {/* Notifikasi Pesan Belum Dibaca */}
                        {(() => {
                            const myRole = currentUser?.role;
                            const myName = (currentUser?.name || '').trim();

                            if (myRole === 'DPJP') {
                                const target = (rec.unreadDoctorTarget || '').trim();
                                const isTargeted = target
                                    ? (target === 'DPJP' ? isMatchDoctor(rec.dpjpName, myName) : isMatchDoctor(target, myName))
                                    : isMatchDoctor(rec.dpjpName, myName);

                                if (rec.hasUnreadDoctor && isTargeted) {
                                    return (
                                        <span
                                            onClick={(e) => { e.stopPropagation(); handleEdit(rec, 'diskusi'); }}
                                            className="ml-1.5 animate-pulse bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                                        >
                                            💬 {rec.lastDiscussion?.role === 'Dokter_Jaga' ? 'Konsul Dr. Jaga' : 'Laporan Perawat'}
                                        </span>
                                    );
                                }
                            }

                            if (myRole === 'Dokter_Jaga') {
                                const target = (rec.unreadDoctorTarget || rec.unreadJagaTarget || '').trim();
                                const isForMe = !target || target.toLowerCase() === 'semua dokter jaga' || target.toLowerCase() === 'all_jaga' || target === 'Dokter_Jaga' || isMatchDoctor(target, myName);
                                if (rec.hasUnreadDokterJaga && isForMe) {
                                    return (
                                        <span
                                            onClick={(e) => { e.stopPropagation(); handleEdit(rec, 'diskusi'); }}
                                            className="ml-1.5 animate-pulse bg-teal-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 shrink-0 cursor-pointer"
                                        >
                                            🩺 Panggilan Dr. Jaga
                                        </span>
                                    );
                                }
                            }

                            if (!isDoctor && rec.hasUnreadNurse) {
                                return (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); handleEdit(rec, 'diskusi'); }}
                                        className={`ml-1.5 animate-pulse text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 shrink-0 cursor-pointer ${(rec.lastDiscussion?.role === 'Dokter_Jaga' || rec.lastSenderRole === 'Dokter_Jaga') ? 'bg-teal-600' : 'bg-indigo-600'}`}
                                    >
                                        💬 {(rec.lastDiscussion?.role === 'Dokter_Jaga' || rec.lastSenderRole === 'Dokter_Jaga') ? 'Balasan Dr. Jaga' : 'Balasan DPJP'}
                                    </span>
                                );
                            }

                            return null;
                        })()}
                    </div>
                    <div className="text-[13px] mt-0.5 flex flex-wrap gap-x-3 font-semibold text-slate-700 items-center">
                        <span className="text-black font-black bg-slate-100/80 px-1 rounded border border-slate-300 text-[13px]">
                            DPJP: <span className="text-indigo-950 font-black">{rec.dpjpName}</span>
                        </span>
                        {(rec.raberName || rec.raber2Name) && (
                            <span className="text-black font-black text-[13px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                                Raber: <span className="text-blue-800 font-black">{[rec.raberName, rec.raber2Name].filter(Boolean).join(', ')}</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Sisi Kanan Header: Tombol Aksi */}
                <div className="text-right flex flex-col items-end justify-start font-bold text-[10px] text-slate-800 shrink-0">
                    <div className="flex flex-row gap-1.5 mb-1.5 items-center flex-wrap">
                        {isDoctor && (
                            <button
                                type="button"
                                onClick={(e) => handleToggleVisite(rec, e)}
                                className={`px-2 py-0.5 rounded border text-[10px] font-black shadow-sm transition flex items-center gap-1 ${rec.isVisited && rec.lastVisitedDate === new Date().toISOString().split('T')[0]
                                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                    : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border-slate-300'}`}
                                title="Tandai Sudah Visite Hari Ini"
                            >
                                {rec.isVisited && rec.lastVisitedDate === new Date().toISOString().split('T')[0] ? '✓ Sudah Visite' : '○ Visite'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPatientToSwap(rec); setShowSwapModal(true); }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                            title="Tukar / Pindah Bed Pasien"
                        >
                            🔀
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRecordForLapor(rec); }}
                            className="bg-green-50 hover:bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                            title="Lapor / Konsul Pasien ke WA"
                        >
                            📱
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedRecordForPrint(rec); }}
                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                            title="Buka Preview Cetak APOS"
                        >
                            🖨️
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDischarge(rec.id, rec.name, rec.roomNumber); }}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm transition"
                            title="Pulangkan / Pindahkan Pasien (KRS)"
                        >
                            🚪
                        </button>
                        {soapMode === 'personal' && rec.personalNotes?.[currentUser?.name] && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handlePublishToRoom(rec); }}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded border border-amber-300 shadow-sm transition flex items-center gap-1"
                                title="Publikasikan catatan pribadimu ke Mode Ruangan"
                            >
                                📤 Publis
                            </button>
                        )}
                    </div>

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

            {/* Grid 2 Kolom APOS */}
            <div className="grid grid-cols-2 gap-3 pt-0.5 items-stretch">
                <div className="border-r border-slate-200 pr-2 flex flex-col justify-between gap-2">
                    <div>
                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">A (ANALISA)/ Dx:</div>
                        <div className="whitespace-pre-wrap pl-1 text-slate-800 leading-tight text-[11px] font-medium">{safeAnalysis || '-'}</div>
                    </div>
                    <div className="border-t border-dashed border-slate-300 pt-1.5">
                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">P (PLANNING)</div>
                        <div className="pl-1">
                            {/* ✨ FIX: Kembalikan autoSmartDateTransformer di sini */}
                            {safePlanning ? renderPlanningCell(autoSmartDateTransformer(safePlanning), rec?.medicationLogs) : <span className="text-slate-800 text-[11px] font-medium">-</span>}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col justify-between gap-2">
                    <div>
                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">O (OBJEKTIF)</div>
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

            {/* --- KONTENER CPO / RESEP OBAT (DUAL MODE: RINGKAS VS TABEL) --- */}
            <div 
                onClick={(e) => e.stopPropagation()} 
                className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2 select-none"
            >
                {/* 1. HEADER & TOMBOL AKSI */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-rose-300 flex items-center gap-1 shadow-2xs">
                            💊 RESEP OBAT
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                            {activeMeds.length} Obat
                        </span>

                        {/* TOMBOL BUKA-TUTUP JADWAL JAM */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowCpoSchedule(prev => !prev);
                            }}
                            className={`text-[9px] font-black px-2 py-0.5 rounded-md border transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                showCpoSchedule
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-white text-indigo-700 border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                            {showCpoSchedule ? '▲ Tutup Jadwal Jam' : '▼ Buka Jadwal Jam'}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof onOpenMarModal === 'function') {
                                onOpenMarModal(rec);
                            } else if (typeof setIsMarModalOpen === 'function') {
                                const combinedData = {
                                    ...rec,
                                    planning: `${rec.planning || ''}\n${rec.currentPrescription || ''}`
                                };
                                if (typeof setMarSelectedRecord === 'function') {
                                    setMarSelectedRecord(combinedData);
                                }
                                setIsMarModalOpen(true);
                            }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                    >
                        💊 Buka Full CPO
                    </button>
                </div>

                {/* 2. KONTEN DUAL-MODE */}
                {!showCpoSchedule ? (
                    /* 🌟 MODE TUTUP (DEFAULT): TEKS RINGKAS TANPA KOLOM / TABEL (PERSIS MODEL LAMA GAMBAR 1) */
                    <div className="space-y-0.5 pl-1 text-[11px] font-sans text-slate-800 pt-0.5">
                        {activeMeds.length === 0 ? (
                            <div className="text-slate-400 italic text-[10px] py-1">- Belum ada resep obat aktif -</div>
                        ) : (
                            activeMeds.map((med, idx) => {
                                const abBadge = getAntibioticDay(med.raw || med.cleanText, rec.medicationLogs);
                                return (
                                    <div key={idx} className="flex items-center justify-between py-0.5 hover:bg-slate-100/60 rounded px-1 -mx-1 transition">
                                        <div className="leading-tight flex-1">
                                            <span className="text-slate-400 mr-1.5">•</span>
                                            <span className="font-semibold text-slate-900">{med.cleanText || med.raw}</span>
                                            <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                                                {(med.route || 'P.O').toLowerCase().replace('p.o', 'po')} {med.freqText || med.frequency || '1x1'}
                                            </span>
                                            {abBadge && (
                                                <span className="inline-flex bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs ml-1.5 align-middle">
                                                    🚨 {abBadge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* 🌟 MODE BUKA: TABEL LENGKAP 1 BARIS RAPI, SIKLUS ROTASI CERDAS & KUNING KEDIP */
                    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 text-[10px]">
                                <tr>
                                    <th className="p-1.5 font-bold w-[25%] border-r border-slate-300">
                                        Nama Obat & Dosis
                                    </th>
                                    <th className="p-1 border-r border-slate-300 text-center w-[25%]">
                                        <div>Kemarin</div>
                                        <div className="font-normal text-[8px] text-slate-500 font-mono">({formatTgl(yesterday)})</div>
                                    </th>
                                    <th className="p-1 border-r border-slate-300 text-center w-[25%] bg-emerald-50">
                                        <div className="text-emerald-900 font-bold">Hari Ini</div>
                                        <div className="font-normal text-[8px] text-emerald-700 font-mono">({formatTgl(today)})</div>
                                    </th>
                                    <th className="p-1 text-center w-[25%] bg-sky-50">
                                        <div className="text-sky-900 font-bold">Besok</div>
                                        <div className="font-normal text-[8px] text-slate-500 font-mono">({formatTgl(tomorrow)})</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {activeMeds.map((med, mIdx) => {
                                    const lowerMed = (med.raw || med.cleanText || '').toLowerCase();

                                    let freq = 1;
                                    const freqMatch = lowerMed.match(/(\d+)\s*x/i);
                                    if (freqMatch) freq = parseInt(freqMatch[1], 10);
                                    else if (/\/\s*8\s*jam/i.test(lowerMed)) freq = 3;
                                    else if (/\/\s*12\s*jam/i.test(lowerMed)) freq = 2;
                                    else if (/\/\s*6\s*jam/i.test(lowerMed)) freq = 4;

                                    const everCheckedShifts = [];
                                    Object.keys(rec.medicationLogs || {}).forEach(d => {
                                        const medShifts = rec.medicationLogs[d]?.[med.cleanText] || rec.medicationLogs[d]?.[med.raw] || {};
                                        Object.keys(medShifts).forEach(sKey => {
                                            const s = medShifts[sKey];
                                            if (s && (s.checked || s.scheduled) && !everCheckedShifts.includes(sKey)) {
                                                everCheckedShifts.push(sKey);
                                            }
                                        });
                                    });

                                    // ✅ KUNCI PERMANEN SIKLUS 24 (24:00 -> 08:00 -> 16:00):
                                    const hasChecked24 = everCheckedShifts.includes('jam_24');
                                    const hasChecked06 = everCheckedShifts.includes('jam_06'); // Jam 04:00 subuh khusus siklus biasa (12-20-04)
                                    const textHints24 = /\b(jam\s*24|24[:.]00|\b24\b|malam|jam\s*(8|08|16)|(8|08|16)[:.]00)\b/i.test(lowerMed);

                                    // Sekali jam 24 pernah diceklis, KUNCI DI SIKLUS 24 SELAMANYA.
                                    // Jangan gunakan !hasChecked12, karena saat tombol 08:00 diklik, sistem menyimpan kunci 'jam_12'!
                                    const isCycle24 = hasChecked24 || (!hasChecked06 && textHints24);

                                    const isPoOrInhalasi = (
                                        (med.route || '').toUpperCase() === 'P.O' ||
                                        /\b(po|p\.o|tab|kaps|caps|syr|sirup|inhalasi|nebu)\b/i.test(lowerMed) ||
                                        /\/\s*8\s*jam/i.test(lowerMed)
                                    ) && !/\b(iv|inj|injeksi|sc|im|drip|infus|vial|amp)\b/i.test(lowerMed);

                                    const isEligibleAutoYellow = freq === 3 && isPoOrInhalasi;

                                    let autoActiveKeys = [];

                                    if (freq === 3) {
                                        if (everCheckedShifts.length > 0 || isEligibleAutoYellow) {
                                            autoActiveKeys = isCycle24 
                                                ? ['jam_12', 'jam_18', 'jam_24']
                                                : ['jam_12', 'jam_18', 'jam_06'];
                                        }
                                    } else if (freq === 2) {
                                        if (everCheckedShifts.length > 0) {
                                            const pairs2x1 = {
                                                'jam_06': 'jam_18',
                                                'jam_18': 'jam_06',
                                                'jam_12': 'jam_24',
                                                'jam_24': 'jam_12'
                                            };
                                            everCheckedShifts.forEach(k => {
                                                if (!autoActiveKeys.includes(k)) autoActiveKeys.push(k);
                                                const partner = pairs2x1[k];
                                                if (partner && !autoActiveKeys.includes(partner)) autoActiveKeys.push(partner);
                                            });
                                        }
                                    } else if (freq === 4) {
                                        if (everCheckedShifts.length > 0) {
                                            autoActiveKeys = ['jam_12', 'jam_18', 'jam_24', 'jam_06'];
                                        }
                                    } else {
                                        autoActiveKeys = [...everCheckedShifts];
                                    }

                                    let medShifts = [];
                                    if (freq === 3) {
                                        const labels = isCycle24
                                            ? [
                                                { key: 'jam_12', label: '08:00' },
                                                { key: 'jam_18', label: '16:00' },
                                                { key: 'jam_24', label: '24:00' },
                                                { key: 'jam_06', label: '04:00' }
                                            ]
                                            : [
                                                { key: 'jam_12', label: '12:00' },
                                                { key: 'jam_18', label: '20:00' },
                                                { key: 'jam_24', label: '24:00' },
                                                { key: 'jam_06', label: '04:00' }
                                            ];

                                        medShifts = labels.map(s => ({
                                            ...s,
                                            active: autoActiveKeys.includes(s.key)
                                        }));
                                    } else if (freq === 2) {
                                        const isNightPair = everCheckedShifts.includes('jam_24') || /\b(jam\s*24|24[:.]00|malam)\b/i.test(lowerMed);
                                        const labels = isNightPair
                                            ? [
                                                { key: 'jam_12', label: '12:00' },
                                                { key: 'jam_18', label: '18:00' },
                                                { key: 'jam_24', label: '24:00' },
                                                { key: 'jam_06', label: '06:00' }
                                            ]
                                            : [
                                                { key: 'jam_12', label: '12:00' },
                                                { key: 'jam_18', label: '18:00' },
                                                { key: 'jam_24', label: '24:00' },
                                                { key: 'jam_06', label: '06:00' }
                                            ];

                                        medShifts = labels.map(s => ({
                                            ...s,
                                            active: autoActiveKeys.includes(s.key)
                                        }));
                                    } else {
                                        const labels = [
                                            { key: 'jam_12', label: '12:00' },
                                            { key: 'jam_18', label: '18:00' },
                                            { key: 'jam_24', label: '24:00' },
                                            { key: 'jam_06', label: '06:00' }
                                        ];
                                        medShifts = labels.map(s => ({
                                            ...s,
                                            active: autoActiveKeys.includes(s.key)
                                        }));
                                    }

                                    const is48Jam = /\/\s*48\s*jam/i.test(lowerMed);

                                    const renderSlots = (dateStr) => {
                                        const isToday = dateStr === todayYMD;

                                        let wasGivenYesterday = false;
                                        if (is48Jam) {
                                            const [y, m, d] = dateStr.split('-').map(Number);
                                            const prevD = new Date(y, m - 1, d);
                                            prevD.setDate(prevD.getDate() - 1);
                                            const prevDateStr = getSafeYMD(prevD);

                                            wasGivenYesterday = allShifts.some(sh => {
                                                const prevLog = getShiftLog(rec.medicationLogs, prevDateStr, med, sh.key);
                                                return Boolean(prevLog?.checked);
                                            });
                                        }

                                        return (
                                            <div className="flex items-center justify-center flex-nowrap gap-0.5 py-0.5 px-0.5 w-full">
                                                {medShifts.map(s => {
                                                    const log = getShiftLog(rec.medicationLogs, dateStr, med, s.key);
                                                    const isChecked = Boolean(log?.checked);
                                                    
                                                    let isScheduled = Boolean(log?.scheduled) || s.active;
                                                    if (is48Jam && wasGivenYesterday && !isChecked) {
                                                        isScheduled = false;
                                                    }

                                                    return (
                                                        <div 
                                                            key={s.key} 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCardToggleShift?.(rec, med, dateStr, s.key);
                                                            }}
                                                            className={`flex flex-col items-center justify-center text-center p-0.5 rounded cursor-pointer transition select-none flex-1 min-w-[22px] max-w-[28px] ${
                                                                isChecked
                                                                    ? 'bg-emerald-50 border border-emerald-500 shadow-2xs'
                                                                    : isScheduled && isToday
                                                                        ? 'bg-amber-100 border-2 border-amber-400 shadow-xs animate-pulse ring-1 ring-amber-300'
                                                                        : isScheduled
                                                                            ? 'bg-amber-50/70 border border-amber-300'
                                                                            : 'border border-transparent hover:border-slate-200 opacity-30 hover:opacity-100'
                                                            }`}
                                                            title={`${s.label} - ${isChecked ? 'Sudah diceklis' : isScheduled ? 'Terjadwal' : 'Di luar jadwal'}`}
                                                        >
                                                            {isChecked && <AbxPill med={med.raw || med.cleanText} logs={rec.medicationLogs} dateStr={dateStr} shiftKey={s.key} variant="inline" />}
                                                            <span className={`text-[6.5px] font-bold leading-none ${
                                                                isChecked ? 'text-emerald-800' : isScheduled ? 'text-amber-900 font-black' : 'text-slate-400'
                                                            }`}>
                                                                {s.label}
                                                            </span>

                                                            <div className="mt-0.5">
                                                                {isChecked ? (
                                                                    <div className="text-emerald-700 font-black text-[7.5px] leading-tight flex flex-col items-center">
                                                                        <span>✓</span>
                                                                        {log.time && <span className="text-[6px] font-mono leading-none">{log.time}</span>}
                                                                    </div>
                                                                ) : isScheduled && isToday ? (
                                                                    <span className="text-[8.5px] leading-none text-amber-600 font-black">◯</span>
                                                                ) : isScheduled ? (
                                                                    <span className="text-[8.5px] leading-none text-amber-500">◯</span>
                                                                ) : (
                                                                    <span className="text-[8.5px] leading-none text-slate-300">◯</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    };

                                    const abBadge = getAntibioticDay(med.raw || med.cleanText, rec.medicationLogs);

                                    return (
                                        <tr key={mIdx} className="hover:bg-slate-50/70 transition">
                                            <td className="p-1.5 align-top w-[25%] border-r border-slate-200">
                                                <div className="font-bold text-[9.5px] text-slate-800 leading-tight flex flex-wrap gap-1 items-center">
                                                    <span>{med.cleanText || med.raw}</span>
                                                    {abBadge && (
                                                        <span className="bg-rose-50 border border-rose-200 text-rose-600 font-black text-[9px] px-1 py-0.2 rounded shadow-2xs">
                                                            🚨 {abBadge}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[8px] text-slate-500 font-mono mt-0.5">
                                                    {med.route || 'P.O'} • {med.freqText || med.frequency || '1x1'}
                                                </div>
                                            </td>

                                            <td className="p-0.5 border-r border-slate-200 align-middle text-center w-[25%]">
                                                {renderSlots(yesterdayYMD)}
                                            </td>
                                            <td className="p-0.5 border-r border-slate-200 align-middle text-center bg-emerald-50/20 w-[25%]">
                                                {renderSlots(todayYMD)}
                                            </td>
                                            <td className="p-0.5 align-middle text-center bg-sky-50/20 w-[25%]">
                                                {renderSlots(tomorrowYMD)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tab Lab, TTV, Radiologi & Penunjang */}
            <div className="mt-2 pt-2 border-t-2 border-slate-300">
                <div className="flex flex-wrap gap-1 mb-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === 'Lab' ? null : rec.id); setExpandedCardTab('Lab'); }}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === 'Lab' ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'}`}
                    >
                        📊 Lab
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === 'TTV' ? null : rec.id); setExpandedCardTab('TTV'); }}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === 'TTV' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'}`}
                    >
                        📈 TTV & EWS
                    </button>
                    {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka'].map(cat => {
                        const count = (rec.radiologyImages || []).filter(img => img.category === cat).length;
                        const icons = { 'Rontgen': '🩻', 'USG': '🔊', 'CT Scan': '💉', 'EKG': '❤️', 'Luka': '🩹' };
                        return (
                            <button
                                key={cat}
                                onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === cat ? null : rec.id); setExpandedCardTab(cat); }}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === cat ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}
                            >
                                {icons[cat]} {cat}
                                {count > 0 && <span className={`px-1 rounded-full text-[8px] ${expandedCardId === rec.id && expandedCardTab === cat ? 'bg-white/30' : 'bg-indigo-200'}`}>{count}</span>}
                            </button>
                        );
                    })}
                </div>

                {expandedCardId === rec.id && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {expandedCardTab === 'Lab' && <LabHistoryTable record={rec} />}
                        {expandedCardTab === 'TTV' && <TtvHistory objective={rec.objective} />}
                        {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka'].includes(expandedCardTab) && (
                            <div className="cursor-default mt-2 space-y-2">
                                {(() => {
                                    const historyItems = (rec.penunjangHistory || []).filter(p => p.category === expandedCardTab);
                                    return (
                                        <div className="space-y-1.5">
                                            {historyItems.map((item, hIdx) => (
                                                <div key={item.id || hIdx} className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                                                    <div className="text-[9px] font-bold text-slate-400 mb-1 flex justify-between items-center border-b pb-0.5">
                                                        <span className="text-indigo-700 font-black">📋 Ekspertise #{historyItems.length - hIdx}</span>
                                                        <span>{item.date} {item.time ? `(${item.time})` : ''} • Ns. {item.savedBy || 'Staf'}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-800 font-medium whitespace-pre-wrap leading-snug">{item.text}</div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {(rec.radiologyImages || []).filter(img => img.category === expandedCardTab).map((img, idx) => (
                                    <div key={img.id || idx} className="flex gap-2.5 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                        <img
                                            src={img.imageUrl}
                                            alt={`${img.category} ${idx + 1}`}
                                            className="w-16 h-16 object-cover rounded-lg border border-slate-300 cursor-pointer hover:scale-105 transition-all shadow-sm"
                                            onClick={() => window.open(img.imageUrl, '_blank')}
                                        />
                                        <div className="flex-1 min-w-0 text-[10px] text-slate-700 italic">{img.kesan || 'Lampiran gambar medis.'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default PatientApoCard;