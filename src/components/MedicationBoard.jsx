import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, updateDoc, collection, addDoc, getDocs, Timestamp, query, where } from 'firebase/firestore';
import { MEDICATIONS, ROOM_LIST } from '../constants';
import { getAntibioticDay, isAntibioticMedicationName } from '../utils/helpers';

// --- COMPONENT: MODAL CATATAN PEMBERIAN OBAT (CPO) INDIVIDUAL (V25 - STRICT BOUNDARY & FLEX 48H) ---
const MedicationMarModal = ({ record, allRecords = [], isOpen, onClose, db, currentUser, firebaseConfig }) => {
    const getSafeYMD = (d = new Date()) => {
        if (isNaN(d)) d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(getSafeYMD());
    const [localLogs, setLocalLogs] = useState(record?.medicationLogs || {});

    useEffect(() => {
        if (isOpen) {
            const safeAllRecords = allRecords || [];
            const realRecord = safeAllRecords.find(r => r.id === record?.id) || record;
            setLocalLogs(realRecord?.medicationLogs || {});
            setSelectedDate(getSafeYMD());
        }
    }, [isOpen, record, allRecords]);

    const todayStr = getSafeYMD();

    const displayDates = useMemo(() => {
        return [-1, 0, 1, 2].map(offset => {
            const parts = (selectedDate || todayStr).split('-');
            const d = new Date(parts[0], parts[1]-1, parts[2]);
            d.setDate(d.getDate() + offset);
            return getSafeYMD(d);
        });
    }, [selectedDate, todayStr]);

    const formatDayHeader = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr === todayStr) return `Hari Ini (${dateStr.split('-').reverse().join('/')})`;
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const tom = new Date(); tom.setDate(tom.getDate() + 1);
        if (dateStr === getSafeYMD(yest)) return `Kemarin (${dateStr.split('-').reverse().join('/')})`;
        if (dateStr === getSafeYMD(tom)) return `Besok (${dateStr.split('-').reverse().join('/')})`;
        return dateStr.split('-').reverse().join('/');
    };

    const shifts = [
        { key: 'jam_12', label: '12:00' },
        { key: 'jam_18', label: '16/18/20' },
        { key: 'jam_24', label: '24:00' },
        { key: 'jam_06', label: '04/06' }
    ];

    const planMeds = (record?.planning || '').split('\n')
        .map(line => line.trim().replace(/^[-*\u2022\d.]+\s*/, ''))
        .filter(line => {
            if (line.length < 3) return false;
            const lower = line.toLowerCase();
            const blacklist = ['diet', 'cek lab', 'darah rutin', 'usg', 'rontgen', 'foto thorax', 'konsul', 'observasi', 'ttv', 'edukasi', 'pulang', 'blpl', 'resep', 'lacak', 'lapor', 'acc', 'aff ', 'terapi lanjut', 'monitoring', 'rawat luka', 'gv', 'ekg', 'hemodialisa'];
            if (blacklist.some(word => lower.includes(word))) return false;
            if (/\bhd\b/i.test(lower)) return false; 
            return /\d+\s*x/i.test(lower) || /\b(mg|gr|mcg|ml|iu|tts|amp|vial|tab|caps|syr|inj|iv|po|im|sc|drip|supp|prn|k\/p|gtt|fls|flash)\b/i.test(lower) || lower.startsWith('th') || lower.startsWith('rx') || /\/\s*\d+\s*jam/i.test(lower);
        });

    const safeLogs = localLogs || {};
    const logMeds = Object.keys(safeLogs)
        .filter(dateStr => displayDates.includes(dateStr))
        .flatMap(dateStr => {
            const shiftsObj = safeLogs[dateStr] || {}; 
            return Object.keys(shiftsObj).filter(med => {
                const shiftData = shiftsObj[med];
                if (!shiftData) return false; 
                return Object.values(shiftData).some(s => s && (s.checked || s.scheduled));
            });
        });
    
    const extractedMeds = Array.from(new Set([...planMeds, ...logMeds]));

    const handleToggleShift = async (medName, dateStr, shift) => {
        const currentDayLogs = safeLogs[dateStr] || {};
        const medLogs = currentDayLogs[medName] || {};
        const shiftLog = medLogs[shift] || { checked: false };

        let updatedShiftLog = {};
        if (shiftLog.checked) {
            updatedShiftLog = { ...shiftLog, checked: false, time: null, by: null };
        } else {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            updatedShiftLog = { ...shiftLog, checked: true, time: timeStr, by: currentUser?.name || 'Perawat' };
        }

        const updatedLogs = {
            ...safeLogs,
            [dateStr]: { ...currentDayLogs, [medName]: { ...medLogs, [shift]: updatedShiftLog } }
        };

        setLocalLogs(updatedLogs);
        try {
            const safeAppId = firebaseConfig?.appId || 'SIMPAN_APP';
            const docRef = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, record.id);
            await updateDoc(docRef, { medicationLogs: updatedLogs });
        } catch (e) {}
    };

    const handleTogglePattern = async (medName, dateStr, shift) => {
        const currentDayLogs = safeLogs[dateStr] || {};
        const medLogs = currentDayLogs[medName] || {};
        const shiftLog = medLogs[shift] || { checked: false };

        const updatedShiftLog = { ...shiftLog, scheduled: !shiftLog.scheduled };
        const updatedLogs = {
            ...safeLogs,
            [dateStr]: { ...currentDayLogs, [medName]: { ...medLogs, [shift]: updatedShiftLog } }
        };

        setLocalLogs(updatedLogs);
        try {
            const safeAppId = firebaseConfig?.appId || 'SIMPAN_APP';
            const docRef = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, record.id);
            await updateDoc(docRef, { medicationLogs: updatedLogs });
        } catch (e) {}
    };

    const changeDate = (offset) => {
        const parts = selectedDate.split('-');
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        d.setDate(d.getDate() + offset);
        setSelectedDate(getSafeYMD(d));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" style={{ zIndex: 9999 }}>
            <div className="bg-slate-50 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">
                
                <div className="bg-emerald-600 text-white px-5 py-4 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-black flex items-center gap-2">💊 Catatan Pemberian Obat (CPO)</h2>
                        <p className="text-emerald-100 text-xs mt-0.5 font-medium">Bed {record?.roomNumber || '-'} - {record?.name || 'Pasien'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-emerald-500 rounded-full transition-colors"><span className="text-xl leading-none">✖</span></button>
                </div>

                <div className="bg-white px-5 py-3 border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm z-10">
                    <div className="flex gap-2">
                        <button onClick={() => changeDate(-1)} className="px-4 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-extrabold rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition shadow-sm">⬅️ Mundur</button>
                        <button onClick={() => setSelectedDate(todayStr)} className={`px-4 py-1.5 border text-xs font-extrabold rounded-lg transition shadow-sm ${selectedDate === todayStr ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>🏠 Hari Ini</button>
                        <button onClick={() => changeDate(1)} className="px-4 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-extrabold rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition shadow-sm">Maju ➡️</button>
                    </div>
                    
                    <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 font-bold text-slate-500 text-sm shadow-inner flex items-center justify-between w-[130px]">
                        <span>{selectedDate.split('-').reverse().join('/')}</span>
                        <span className="text-slate-400 text-xs">📅</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {extractedMeds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400"><span className="text-5xl mb-3">📭</span><p className="font-bold">Belum ada obat yang dijadwalkan.</p></div>
                    ) : (
                        <div className="space-y-4">
                            {extractedMeds.map((med, mIdx) => {
                                const lowerMed = (med || '').toLowerCase();
                                let freq = 1;
                                const freqMatch = lowerMed.match(/(\d+)\s*x/i);
                                if (freqMatch) freq = parseInt(freqMatch[1]);
                                else if (/\/\s*8\s*jam/i.test(lowerMed)) freq = 3;
                                else if (/\/\s*12\s*jam/i.test(lowerMed)) freq = 2;
                                else if (/\/\s*6\s*jam/i.test(lowerMed)) freq = 4;
                                else if (/\/\s*24\s*jam/i.test(lowerMed)) freq = 1;
                                else if (/\/\s*48\s*jam/i.test(lowerMed)) freq = 1;

                                const isStopOrTunda = lowerMed.includes('stop') || lowerMed.includes('tunda');
                                const is48Jam = /\/\s*48\s*jam/i.test(lowerMed);

                                const everCheckedShifts = [];
                                Object.keys(safeLogs).forEach(date => {
                                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return; 
                                    const dayData = safeLogs[date] || {}; 
                                    const medShifts = dayData[med] || {};  
                                    Object.keys(medShifts).forEach(sKey => {
                                        const s = medShifts[sKey];
                                        if (s && (s.checked || s.scheduled) && !everCheckedShifts.includes(sKey)) {
                                            everCheckedShifts.push(sKey);
                                        }
                                    });
                                });

                                let baseActiveShifts = [];
                                if (everCheckedShifts.length > 0) {
                                    if (freq === 1) baseActiveShifts = [...everCheckedShifts];
                                    else if (freq === 2) {
                                        everCheckedShifts.forEach(sKey => {
                                            if (!baseActiveShifts.includes(sKey)) baseActiveShifts.push(sKey);
                                            let partner = sKey === 'jam_12' ? 'jam_24' : sKey === 'jam_24' ? 'jam_12' : sKey === 'jam_18' ? 'jam_06' : 'jam_18';
                                            if (partner && !baseActiveShifts.includes(partner)) baseActiveShifts.push(partner);
                                        });
                                    } else if (freq === 3) {
                                        const hasStandard = everCheckedShifts.some(k => ['jam_12', 'jam_18', 'jam_06'].includes(k));
                                        if (hasStandard) baseActiveShifts = ['jam_12', 'jam_18', 'jam_06'];
                                        everCheckedShifts.forEach(sKey => { if (!baseActiveShifts.includes(sKey)) baseActiveShifts.push(sKey); });
                                    } else baseActiveShifts = ['jam_12', 'jam_18', 'jam_24', 'jam_06'];
                                } else {
                                    // ✨ FIX V25: REGEX BOUNDARY UNTUK INJEKSI
                                    const isInjeksi = /\b(inj|iv|im|sc|drip|vial|amp|inf)\b/i.test(lowerMed);

                                    // ✨ FIX V25: JIKA OBAT 48 JAM ATAU INJEKSI, KOSONGKAN JADWAL AWAL AGAR PERAWAT SET SENDIRI
                                    if (isInjeksi || is48Jam) {
                                        baseActiveShifts = [];
                                    } else {
                                        const isMalam = /malam|\bjam\s*24\b|\b24[:.]00\b/i.test(lowerMed);
                                        const isPagi = /pagi|\bjam\s*12\b|\b12[:.]00\b/i.test(lowerMed);
                                        const isSore = /sore|\bjam\s*(16|18|20)\b|\b(16|18|20)[:.]00\b/i.test(lowerMed);

                                        if (isMalam) baseActiveShifts = ['jam_24'];
                                        else if (isPagi) baseActiveShifts = ['jam_12'];
                                        else if (isSore) baseActiveShifts = ['jam_18'];
                                        else {
                                            // ✨ FIX MANUAL MODE: 1x1 dan 2x1 dipaksa KOSONG sejak awal agar disetel manual oleh perawat
                                            if (freq === 1 || freq === 2) baseActiveShifts = [];
                                            else if (freq === 3) baseActiveShifts = ['jam_12', 'jam_18', 'jam_06'];
                                            else baseActiveShifts = ['jam_12', 'jam_18', 'jam_24', 'jam_06'];
                                        }
                                    }
                                }

                                return (
                                    <div key={mIdx} className={`flex border rounded-xl overflow-x-auto shadow-sm custom-scrollbar transition-shadow ${isStopOrTunda ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200 bg-white hover:shadow-md'}`}>
                                        <div className="w-[180px] sm:w-[220px] flex-shrink-0 p-3 bg-white border-r border-slate-200 sticky left-0 z-10 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="flex items-start gap-1.5 flex-wrap">
                                                <h4 className={`font-bold text-xs leading-snug mt-0.5 ${isStopOrTunda ? 'text-rose-500 line-through' : 'text-slate-800'}`}>📄 {med}</h4>
                                                {isStopOrTunda && <span className="text-[9px] bg-rose-500 text-white px-2 py-0.5 rounded font-black shadow-sm mt-0.5">🛑 STOP</span>}
                                                {is48Jam && <span className="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-black shadow-sm mt-0.5">⏳ 48 JAM</span>}
                                                {typeof getAntibioticDay === 'function' && getAntibioticDay(med, safeLogs) && !isStopOrTunda && (
                                                    <span className="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-black animate-pulse shadow-sm mt-0.5">🚨 {getAntibioticDay(med, safeLogs)}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex bg-slate-50/50">
                                            {displayDates.map((dateStr, dIdx) => {
                                                const isToday = dateStr === todayStr;
                                                const medLogForDate = safeLogs[dateStr]?.[med] || {};
                                                const checkedShiftsForDate = Object.keys(medLogForDate).filter(k => medLogForDate[k] && medLogForDate[k].checked);
                                                
                                                let actShifts = [...baseActiveShifts];
                                                if (isStopOrTunda) { actShifts = []; } 
                                                else if (is48Jam) {
                                                    const prevD = new Date(dateStr.split('-')[0], dateStr.split('-')[1]-1, dateStr.split('-')[2]);
                                                    prevD.setDate(prevD.getDate() - 1);
                                                    const givenYesterday = Object.values(safeLogs[getSafeYMD(prevD)]?.[med] || {}).some(sh => sh && sh.checked);
                                                    if (givenYesterday) actShifts = [];
                                                }

                                                const isRecommended = (shiftKey) => !checkedShiftsForDate.includes(shiftKey) && actShifts.includes(shiftKey);

                                                return (
                                                    <div key={dateStr} className={`w-[220px] sm:w-[250px] p-2 flex-shrink-0 flex flex-col ${dIdx !== displayDates.length - 1 ? 'border-r border-slate-200' : ''}`}>
                                                        <div className={`text-center text-[10px] font-bold py-1 mb-2 rounded shadow-sm ${isToday ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                                                            {formatDayHeader(dateStr)}
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-4 gap-1 flex-1">
                                                            {shifts.map(s => {
                                                                const log = medLogForDate[s.key] || { checked: false, scheduled: false };
                                                                const recommendGlow = isRecommended(s.key);
                                                                
                                                                return (
                                                                    <button 
                                                                        key={s.key} type="button" 
                                                                        onClick={() => !isStopOrTunda && handleToggleShift(med, dateStr, s.key)}
                                                                        disabled={isStopOrTunda}
                                                                        className={`flex flex-col items-center justify-between p-1.5 rounded-lg border transition-all h-[55px] ${log.checked ? 'bg-emerald-50 border-emerald-400 shadow-inner' : recommendGlow ? 'bg-yellow-50 border-yellow-400 ring-1 ring-yellow-400/50 shadow-sm animate-pulse' : isStopOrTunda ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                                                    >
                                                                        <span className={`text-[8px] font-extrabold tracking-tight ${log.checked ? 'text-emerald-800' : recommendGlow ? 'text-yellow-800' : 'text-slate-500'}`}>{s.label}</span>
                                                                        <div className="flex items-center justify-center w-full mt-0.5">
                                                                            <span className="text-[12px] leading-none">{log.checked ? '✅' : '⚪'}</span>
                                                                        </div>
                                                                        <div className="w-full flex justify-between items-end mt-0.5">
                                                                            {!log.checked && !isStopOrTunda ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleTogglePattern(med, dateStr, s.key); }} className={`text-[9px] p-0.5 rounded hover:bg-slate-200 active:bg-slate-300 cursor-pointer mx-auto ${log.scheduled ? 'bg-amber-400 text-slate-950 font-black shadow-xs scale-110' : 'text-slate-300'}`} title="Set Pola Jadwal">🕒</span>
                                                                            ) : log.checked ? (
                                                                                <span className="text-[7.5px] font-bold text-emerald-700 leading-none truncate w-full text-center">{log.time}</span>
                                                                            ) : <span className="h-[14px] w-full"></span>}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-end shrink-0 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl shadow-md hover:bg-slate-700 transition-colors">Selesai</button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENT: MODE TROLI OBAT GLOBAL + AUTO REKAP SHIFT (BANGSAL V25 - STRICT BOUNDARY & FLEX 48H) ---
const GlobalMedicationBoard = ({ records, db, currentUser, firebaseConfig, onEditPatient }) => {
    const getSafeYMD = (d = new Date()) => {
        if (isNaN(d)) d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(getSafeYMD());
    const [localLogsMap, setLocalLogsMap] = useState({});
    const [isRecapMode, setIsRecapMode] = useState(false);

    useEffect(() => {
        const newLogsMap = {};
        records.forEach(r => { newLogsMap[r.id] = r.medicationLogs || {}; });
        setLocalLogsMap(newLogsMap);
    }, [records]);

    const todayStr = getSafeYMD();

    const displayDates = useMemo(() => {
        return [-1, 0, 1, 2].map(offset => {
            const parts = selectedDate.split('-');
            const d = new Date(parts[0], parts[1]-1, parts[2]);
            d.setDate(d.getDate() + offset);
            return getSafeYMD(d);
        });
    }, [selectedDate]);

    const formatDayHeader = (dateStr) => {
        if (dateStr === todayStr) return `Hari Ini (${dateStr.split('-').reverse().join('/')})`;
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const tom = new Date(); tom.setDate(tom.getDate() + 1);
        if (dateStr === getSafeYMD(yest)) return `Kemarin (${dateStr.split('-').reverse().join('/')})`;
        if (dateStr === getSafeYMD(tom)) return `Besok (${dateStr.split('-').reverse().join('/')})`;
        return dateStr.split('-').reverse().join('/');
    };

    const shifts = [
        { key: 'jam_12', label: '12:00' },
        { key: 'jam_18', label: '16/18/20' },
        { key: 'jam_24', label: '24:00' },
        { key: 'jam_06', label: '04/06' }
    ];

    const handleToggleShift = async (recordId, medName, dateStr, shift) => {
        const currentRecordLogs = localLogsMap[recordId] || {};
        const dayLogs = currentRecordLogs[dateStr] || {};
        const medLogs = dayLogs[medName] || {};
        const shiftLog = medLogs[shift] || { checked: false };

        let updatedShiftLog = {};
        if (shiftLog.checked) {
            updatedShiftLog = { ...shiftLog, checked: false, time: null, by: null };
        } else {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            updatedShiftLog = { ...shiftLog, checked: true, time: timeStr, by: currentUser?.name || 'Perawat' };
        }

        const updatedRecordLogs = {
            ...currentRecordLogs,
            [dateStr]: { ...dayLogs, [medName]: { ...medLogs, [shift]: updatedShiftLog } }
        };

        setLocalLogsMap(prev => ({ ...prev, [recordId]: updatedRecordLogs }));
        try {
            const docRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`, recordId);
            await updateDoc(docRef, { medicationLogs: updatedRecordLogs });
        } catch (e) {}
    };

    const handleTogglePattern = async (recordId, medName, dateStr, shift) => {
        const currentRecordLogs = localLogsMap[recordId] || {};
        const dayLogs = currentRecordLogs[dateStr] || {};
        const medLogs = dayLogs[medName] || {};
        const shiftLog = medLogs[shift] || { checked: false };

        const updatedShiftLog = { ...shiftLog, scheduled: !shiftLog.scheduled };
        const updatedRecordLogs = {
            ...currentRecordLogs,
            [dateStr]: { ...dayLogs, [medName]: { ...medLogs, [shift]: updatedShiftLog } }
        };

        setLocalLogsMap(prev => ({ ...prev, [recordId]: updatedRecordLogs }));
        try {
            const docRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`, recordId);
            await updateDoc(docRef, { medicationLogs: updatedRecordLogs });
        } catch (e) {}
    };

    const recordsWithMeds = useMemo(() => {
        const sorted = [...records].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
        
        return sorted.map(record => {
            const currentRecordLogs = localLogsMap[record.id] || {};
            
            const planMeds = (record.planning || '').split('\n')
                .map(line => line.trim().replace(/^[-*\u2022\d.]+\s*/, ''))
                .filter(line => {
                    if (line.length < 3) return false;
                    const lower = line.toLowerCase();
                    const blacklist = ['diet', 'cek lab', 'darah rutin', 'usg', 'rontgen', 'foto thorax', 'konsul', 'observasi', 'ttv', 'edukasi', 'pulang', 'blpl', 'resep', 'lacak', 'lapor', 'acc', 'aff ', 'terapi lanjut', 'monitoring', 'rawat luka', 'gv', 'ekg', 'hemodialisa'];
                    if (blacklist.some(word => lower.includes(word))) return false;
                    if (/\bhd\b/i.test(lower)) return false; 
                    return /\d+\s*x/i.test(lower) || /\b(mg|gr|mcg|ml|iu|tts|amp|vial|tab|caps|syr|inj|iv|po|im|sc|drip|supp|prn|k\/p|gtt|fls|flash)\b/i.test(lower) || lower.startsWith('th') || lower.startsWith('rx') || /\/\s*\d+\s*jam/i.test(lower);
                });

            const logMeds = Object.keys(currentRecordLogs)
                .filter(dateStr => displayDates.includes(dateStr))
                .flatMap(dateStr => {
                    const shiftsObj = currentRecordLogs[dateStr] || {};
                    return Object.keys(shiftsObj).filter(med => Object.values(shiftsObj[med]).some(s => s && (s.checked || s.scheduled)));
                });

            const extractedMeds = Array.from(new Set([...planMeds, ...logMeds]));
            const medsConfig = {};

            extractedMeds.forEach(med => {
                const lowerMed = med.toLowerCase();
                let freq = 1;
                const freqMatch = med.match(/(\d+)\s*x/i);
                if (freqMatch) freq = parseInt(freqMatch[1]);
                else if (/\/\s*8\s*jam/i.test(lowerMed)) freq = 3;
                else if (/\/\s*12\s*jam/i.test(lowerMed)) freq = 2;
                else if (/\/\s*6\s*jam/i.test(lowerMed)) freq = 4;
                else if (/\/\s*24\s*jam/i.test(lowerMed)) freq = 1;
                else if (/\/\s*48\s*jam/i.test(lowerMed)) freq = 1;

                const isStopOrTunda = lowerMed.includes('stop') || lowerMed.includes('tunda');
                const is48Jam = /\/\s*48\s*jam/i.test(lowerMed);

                const everCheckedShifts = [];
                Object.keys(currentRecordLogs).forEach(date => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return; 
                    const dayData = currentRecordLogs[date] || {};
                    const medShifts = dayData[med] || {};
                    Object.keys(medShifts).forEach(sKey => {
                        const s = medShifts[sKey];
                        if (s && (s.checked || s.scheduled) && !everCheckedShifts.includes(sKey)) {
                            everCheckedShifts.push(sKey);
                        }
                    });
                });

                let activeShifts = [];
                if (everCheckedShifts.length > 0) {
                    if (freq === 1) activeShifts = [...everCheckedShifts];
                    else if (freq === 2) {
                        everCheckedShifts.forEach(sKey => {
                            if (!activeShifts.includes(sKey)) activeShifts.push(sKey);
                            let partner = sKey === 'jam_12' ? 'jam_24' : sKey === 'jam_24' ? 'jam_12' : sKey === 'jam_18' ? 'jam_06' : 'jam_18';
                            if (partner && !activeShifts.includes(partner)) activeShifts.push(partner);
                        });
                    } else if (freq === 3) {
                        const hasStandard = everCheckedShifts.some(k => ['jam_12', 'jam_18', 'jam_06'].includes(k));
                        if (hasStandard) activeShifts = ['jam_12', 'jam_18', 'jam_06'];
                        everCheckedShifts.forEach(sKey => { if (!activeShifts.includes(sKey)) activeShifts.push(sKey); });
                    } else activeShifts = ['jam_12', 'jam_18', 'jam_24', 'jam_06'];
                } else {
                    // ✨ FIX V25: MENGGUNAKAN STRICT REGEX BOUNDARY UNTUK INJEKSI (ANTI-COMBIVENT CRASH)
                    const isInjeksi = /\b(inj|iv|im|sc|drip|vial|amp|inf)\b/i.test(lowerMed);

                    // ✨ FIX V25: JIKA OBAT 48 JAM ATAU INJEKSI, KOSONGKAN DEFAULT JAM AGAR TINGGAL KLIK JADWAL NYA
                    if (isInjeksi || is48Jam) {
                        activeShifts = [];
                    } else {
                        const isMalam = /malam|\bjam\s*24\b|\b24[:.]00\b/i.test(lowerMed);
                        const isPagi = /pagi|\bjam\s*12\b|\b12[:.]00\b/i.test(lowerMed);
                        const isSore = /sore|\bjam\s*(16|18|20)\b|\b(16|18|20)[:.]00\b/i.test(lowerMed);

                        if (isMalam) activeShifts = ['jam_24'];
                                        else if (isPagi) activeShifts = ['jam_12'];
                                        else if (isSore) activeShifts = ['jam_18'];
                                        else {
                                        // ✨ FIX MANUAL MODE: 1x1 dan 2x1 dipaksa KOSONG sejak awal agar disetel manual oleh perawat
                                            if (freq === 1 || freq === 2) activeShifts = []; //  SINKRON
                                            else if (freq === 3) activeShifts = ['jam_12', 'jam_18', 'jam_06']; //  SINKRON
                                            else activeShifts = ['jam_12', 'jam_18', 'jam_24', 'jam_06']; //  SINKRON
                                        }
                    }
                }

                medsConfig[med] = { freq, activeShifts, isStopOrTunda, is48Jam };
            });

            return { ...record, extractedMeds, currentRecordLogs, medsConfig };
        }).filter(r => r.extractedMeds.length > 0); 
    }, [records, localLogsMap, displayDates]);

    const recapByShift = useMemo(() => {
        const structure = { jam_12: [], jam_18: [], jam_24: [], jam_06: [] };
        shifts.forEach(s => {
            recordsWithMeds.forEach(p => {
                const dayLogs = p.currentRecordLogs[selectedDate] || {};
                const medsInThisShift = p.extractedMeds.filter(med => {
                    const config = p.medsConfig[med] || { activeShifts: [], isStopOrTunda: false, is48Jam: false };
                    if (config.isStopOrTunda) return false; 
                    
                    let actShifts = [...config.activeShifts];
                    if (config.is48Jam) {
                        const prevD = new Date(selectedDate.split('-')[0], selectedDate.split('-')[1]-1, selectedDate.split('-')[2]);
                        prevD.setDate(prevD.getDate() - 1);
                        const givenYesterday = Object.values(p.currentRecordLogs[getSafeYMD(prevD)]?.[med] || {}).some(sh => sh.checked);
                        if (givenYesterday) actShifts = [];
                    }
                    return dayLogs[med]?.[s.key]?.checked || actShifts.includes(s.key);
                });

                if (medsInThisShift.length > 0) {
                    structure[s.key].push({
                        patientId: p.id, name: p.name, roomNumber: p.roomNumber, bpjsClass: p.bpjsClass, rmNumber: p.rmNumber, dpjpName: p.dpjpName,
                        meds: medsInThisShift.map(medName => ({ name: medName, log: dayLogs[medName]?.[s.key] || { checked: false } }))
                    });
                }
            });
        });
        return structure;
    }, [recordsWithMeds, selectedDate]);

    const changeDate = (offset) => {
        const parts = selectedDate.split('-');
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        d.setDate(d.getDate() + offset);
        setSelectedDate(getSafeYMD(d));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-300">
            <div className="bg-white px-3 py-1.5 shadow-sm border-b border-slate-200 flex justify-between items-center shrink-0 z-20 sticky top-0">
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-black text-rose-700 uppercase tracking-tight flex items-center gap-1">🛒 Troli Obat</h2>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border ml-2">
                        <button type="button" onClick={() => setIsRecapMode(false)} className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md transition ${!isRecapMode ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}>👥 Per Pasien</button>
                        <button type="button" onClick={() => setIsRecapMode(true)} className={`px-2 py-0.5 text-[9px] font-extrabold rounded-md transition flex items-center gap-1 ${isRecapMode ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-600'}`}>📋 Rekap Kerja Shift</button>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={() => changeDate(-1)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[9px] font-extrabold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 transition shadow-sm">⬅️ Mundur</button>
                    <button onClick={() => setSelectedDate(todayStr)} className={`px-2 py-1 border rounded text-[9px] font-extrabold shadow-sm transition ${selectedDate === todayStr ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>🏠 Hari Ini</button>
                    <button onClick={() => changeDate(1)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[9px] font-extrabold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 transition shadow-sm">Maju ➡️</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {!isRecapMode ? (
                    recordsWithMeds.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400"><span className="text-3xl mb-2">📭</span><p className="text-xs font-bold">Tidak ada jadwal obat.</p></div>
                    ) : (
                        recordsWithMeds.map(record => (
                            <div key={record.id} className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden mb-4 last:mb-0">
                                <div onClick={() => onEditPatient && onEditPatient(record)} className="bg-slate-100 p-2.5 border-b border-slate-300 flex justify-between items-center cursor-pointer hover:bg-indigo-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-indigo-600 text-white text-[11px] font-black px-2 py-0.5 rounded shadow-sm">BED {record.roomNumber}</span>
                                        <div><h3 className="font-black text-sm text-slate-800 leading-tight">{record.name} <span className="text-[10px] font-normal text-slate-500 font-mono">({record.rmNumber})</span></h3></div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold">DPJP: {record.dpjpName}</p>
                                </div>

                                <div className="p-3 bg-white">
                                    {record.extractedMeds.map((med, mIdx) => {
                                        const config = record.medsConfig[med] || { activeShifts: [], isStopOrTunda: false, is48Jam: false };
                                        
                                        return (
                                            <div key={mIdx} className={`flex border rounded-lg overflow-x-auto shadow-sm custom-scrollbar mb-2 last:mb-0 ${config.isStopOrTunda ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-slate-50/30 hover:border-emerald-200 transition-colors'}`}>
                                                
                                                <div className="w-[170px] sm:w-[200px] flex-shrink-0 p-2.5 bg-white border-r border-slate-200 sticky left-0 z-10 flex flex-col justify-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    <div className="flex items-start gap-1.5 flex-wrap">
                                                        <h4 className={`font-bold text-[11px] leading-tight ${config.isStopOrTunda ? 'text-rose-500 line-through' : 'text-indigo-900'}`}>📄 {med}</h4>
                                                        {config.isStopOrTunda && <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black shadow-sm mt-0.5">🛑 STOP</span>}
                                                        {config.is48Jam && <span className="text-[8px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-black shadow-sm mt-0.5">⏳ 48 JAM</span>}
                                                        {getAntibioticDay(med, record.currentRecordLogs) && !config.isStopOrTunda && (
                                                            <span className="text-[8px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 font-black animate-pulse shadow-sm mt-0.5">🚨 {getAntibioticDay(med, record.currentRecordLogs)}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex">
                                                    {displayDates.map((dateStr, dIdx) => {
                                                        const isToday = dateStr === todayStr;
                                                        const medLogForDate = record.currentRecordLogs[dateStr]?.[med] || {};
                                                        const checkedShiftsForDate = Object.keys(medLogForDate).filter(k => medLogForDate[k].checked);
                                                        
                                                        let actShifts = [...config.activeShifts];
                                                        if (config.isStopOrTunda) { actShifts = []; } 
                                                        else if (config.is48Jam) {
                                                            const prevD = new Date(dateStr.split('-')[0], dateStr.split('-')[1]-1, dateStr.split('-')[2]);
                                                            prevD.setDate(prevD.getDate() - 1);
                                                            const givenYesterday = Object.values(record.currentRecordLogs[getSafeYMD(prevD)]?.[med] || {}).some(sh => sh.checked);
                                                            if (givenYesterday) actShifts = [];
                                                        }

                                                        const isRecommended = (shiftKey) => !checkedShiftsForDate.includes(shiftKey) && actShifts.includes(shiftKey);

                                                        return (
                                                            <div key={dateStr} className={`w-[220px] sm:w-[250px] p-2 flex-shrink-0 flex flex-col ${dIdx !== displayDates.length - 1 ? 'border-r border-slate-200' : ''}`}>
                                                                <div className={`text-center text-[10px] font-bold py-1 mb-2 rounded shadow-sm ${isToday ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600 border border-slate-300'}`}>
                                                                    {formatDayHeader(dateStr)}
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-4 gap-1 flex-1">
                                                                    {shifts.map(s => {
                                                                        const log = medLogForDate[s.key] || { checked: false, scheduled: false };
                                                                        const recommendGlow = isRecommended(s.key);
                                                                        
                                                                        return (
                                                                            <button 
                                                                                key={s.key} type="button" 
                                                                                onClick={() => !config.isStopOrTunda && handleToggleShift(record.id, med, dateStr, s.key)}
                                                                                disabled={config.isStopOrTunda}
                                                                                className={`flex flex-col items-center justify-between p-1.5 rounded-lg border transition-all h-[55px] ${log.checked ? 'bg-emerald-50 border-emerald-400 shadow-inner' : recommendGlow ? 'bg-yellow-50 border-yellow-400 ring-1 ring-yellow-400/50 shadow-sm animate-pulse' : config.isStopOrTunda ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                                                            >
                                                                                <span className={`text-[8px] font-extrabold tracking-tight ${log.checked ? 'text-emerald-800' : recommendGlow ? 'text-yellow-800' : 'text-slate-500'}`}>{s.label}</span>
                                                                                <div className="flex items-center justify-center w-full mt-0.5">
                                                                                    <span className="text-[12px] leading-none">{log.checked ? '✅' : '⚪'}</span>
                                                                                </div>
                                                                                <div className="w-full flex justify-between items-end mt-0.5">
                                                                                    {!log.checked && !config.isStopOrTunda ? (
                                                                                        <span onClick={(e) => { e.stopPropagation(); handleTogglePattern(record.id, med, dateStr, s.key); }} className={`text-[9px] p-0.5 rounded hover:bg-slate-200 active:bg-slate-300 cursor-pointer mx-auto ${log.scheduled ? 'bg-amber-400 text-slate-950 font-black shadow-xs scale-110' : 'text-slate-300'}`} title="Set Pola Jadwal">🕒</span>
                                                                                    ) : log.checked ? (
                                                                                        <span className="text-[7.5px] font-bold text-emerald-700 leading-none truncate w-full text-center">{log.time}</span>
                                                                                    ) : <span className="h-[14px] w-full"></span>}
                                                                                </div>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {shifts.map(s => {
                            const patientsInShift = recapByShift[s.key] || [];
                            return (
                                <div key={s.key} className="bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col max-h-[75vh] overflow-hidden">
                                    <div className="p-2.5 bg-gradient-to-b from-slate-800 to-slate-900 text-white flex justify-between items-center">
                                        <div><h4 className="text-xs font-black tracking-wider uppercase text-yellow-400">{s.label}</h4></div>
                                        <span className="text-[9px] bg-slate-700 font-black px-2 py-0.5 rounded-full">{patientsInShift.length} Bed</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2.5 bg-slate-50 custom-scrollbar">
                                        {patientsInShift.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 italic text-center py-6">Tidak ada jadwal.</p>
                                        ) : (
                                            patientsInShift.map(p => (
                                                <div key={p.patientId} className="bg-white border border-slate-200 rounded-lg p-2 shadow-xs hover:border-indigo-300 transition-colors">
                                                    <div onClick={() => onEditPatient && onEditPatient({ id: p.patientId, name: p.name, roomNumber: p.roomNumber, bpjsClass: p.bpjsClass, rmNumber: p.rmNumber, dpjpName: p.dpjpName })} className="flex items-center gap-1 border-b border-slate-100 pb-1 mb-1.5 cursor-pointer group">
                                                        <span className="text-[8.5px] bg-indigo-600 text-white px-1 rounded font-black">B{p.roomNumber}</span>
                                                        <h5 className="text-[10px] font-extrabold text-slate-700 group-hover:text-indigo-600">{p.name}</h5>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {p.meds.map((m, idx) => (
                                                            <div key={idx} onClick={() => handleToggleShift(p.patientId, m.name, selectedDate, s.key)} className={`w-full p-1.5 rounded text-left border text-[9.5px] font-bold flex justify-between items-center cursor-pointer transition ${m.log.checked ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                                                <span className="truncate pr-1">💊 {m.name}</span>
                                                                <span className="text-[9px] shrink-0">{m.log.checked ? `✅ (${m.log.time})` : '⚪'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="h-10"></div> 
            </div>
        </div>
    );
};

export { GlobalMedicationBoard, MedicationMarModal };