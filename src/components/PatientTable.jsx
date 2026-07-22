import React, { useState, useEffect, useMemo } from 'react';
import { ROOM_LIST } from '../constants';
import { formatDateCM, hitungHariCM, getAntibioticDay, parsePlanning } from '../utils/helpers';
import LabRadiologyBoard from './LabRadiologyBoard';

// Taruh di bawah baris import PatientTable.jsx
const extractLatestTtvInline = (objectiveText) => {
    if (!objectiveText) return { td: '-', n: '-', s: '-', spo2: '-' };
    const lines = objectiveText.split('\n');
    let td = '-', n = '-', s = '-', spo2 = '-';
    
    lines.forEach(line => {
        const tdMatch = line.match(/TD[:\s]+(\d+\/\d+)/i);
        const nMatch = line.match(/Nadi[:\s]+(\d+)/i);
        const sMatch = line.match(/Suhu[:\s]+([\d\.,]+)/i);
        const spo2Match = line.match(/SpO2[:\s]+(\d+)/i);
        
        if (tdMatch) td = tdMatch[1];
        if (nMatch) n = nMatch[1];
        if (sMatch) s = sMatch[1];
        if (spo2Match) spo2 = spo2Match[1];
    });
    return { td, n, s, spo2 };
};

const PatientTable = ({ 
    records, onEdit, onPrint, onShowLaporModal, onDischarge, 
    roomSortOrder, onPrintTTV, onPrintSOAP, onQuickTtv, 
    onBulkDischarge, updateRecord, onPrintBukuCM, 
    roomList = ROOM_LIST, db, currentUser, firebaseConfig,
    // 🛡️ Operan Fungsi & Komponen Pembantu dari App.jsx agar tidak ReferenceError
    parsePlanning, getAntibioticDay, hitungHariCM, formatDateCM, 
    parseDateCM, renderLacakTtv, renderObjectiveCell, renderPlanningCell,
    BukuCMTable, GlobalMedicationBoard
}) => {
    
    const [viewMode, setViewMode] = useState('soap');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => { if (!isSelectionMode) setSelectedIds([]); }, [isSelectionMode]);

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(records.map(r => r.id));
        else setSelectedIds([]);
    };

    const handleSelectRow = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const executeBulkDischarge = () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Yakin ingin memulangkan ${selectedIds.length} pasien terpilih? Status kamar akan menjadi KOSONG.`)) {
            onBulkDischarge(selectedIds);
            setIsSelectionMode(false); 
        }
    };

    const sortedRecords = useMemo(() => {
        const isDelviOnly = records.length > 0 && records.every(r => r.dpjpName === 'dr. Delvi, Sp.PD');

        if (isDelviOnly) {
            const uShapeBase = ['K6', 'K4', 'K2', 'K1', 'K3', 'K5', 'K7', 'K8', 'K9', 'K11', 'K12', 'K14', 'K15', 'K13', 'K10'];
            const uShapeOrder = uShapeBase.flatMap(k => [`${k}A`, `${k}B`]);

            return [...records].sort((a, b) => {
                let indexA = uShapeOrder.indexOf(a.roomNumber);
                let indexB = uShapeOrder.indexOf(b.roomNumber);
                if (indexA === -1) indexA = 999;
                if (indexB === -1) indexB = 999;
                return indexA - indexB;
            });
        }

        if (roomSortOrder && roomSortOrder.length > 0 && roomSortOrder.length < 24) {
            return [...records].sort((a, b) => {
                const indexA = roomSortOrder.indexOf(a.roomNumber);
                const indexB = roomSortOrder.indexOf(b.roomNumber);
                return indexA - indexB;
            });
        }

        return [...records].sort((a, b) => 
            a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })
        );
    }, [records, roomSortOrder]);

    const getPreparationAlert = (planningText) => {
        if (!planningText) return null;
        const text = planningText.toLowerCase();
        const alerts = [];
        if (text.includes('gdp') || text.includes('2jpp') || text.includes('profil lipid') || text.includes('asam urat') || text.includes('ct') || text.includes('upper')) alerts.push('PUASA');
        if (text.includes('whole')) alerts.push('PUASA & KKP');
        if (text.includes('lower')) alerts.push('KKP Saja');
        if (alerts.length === 0) return null;
        return (
            <div className="flex flex-wrap gap-1 mb-1">
                {alerts.map((alert, idx) => (
                    <span key={idx} className="bg-red-100 text-red-700 border border-red-200 text-[9px] font-extrabold px-1 rounded whitespace-nowrap">⚠️ {alert}</span>
                ))}
            </div>
        );
    };

    const renderTtvPlanning = (planningText, medicationLogs = {}) => {
        if (!planningText) return '-';
        const { labs, rads, tms, rxs } = parsePlanning(planningText);
        
        if (labs.length === 0 && rads.length === 0 && tms.length === 0 && rxs.length === 0) {
            return <span className="text-gray-300">-</span>;
        }

        return (
            <div className="text-[10px] leading-tight space-y-1">
                {labs.length > 0 && (
                    <div className="text-red-700 font-medium">
                        <span className="font-bold text-[9px] bg-red-50 border border-red-100 px-1 rounded mr-1">LAB: </span>
                        {labs.join(', ')}
                    </div>
                )}
                {rads.length > 0 && (
                    <div className="text-blue-700 font-medium">
                        <span className="font-bold text-[9px] bg-blue-50 border border-blue-100 px-1 rounded mr-1">RAD: </span>
                        {rads.join(', ')}
                    </div>
                )}
                {tms.length > 0 && (
                    <div className="text-emerald-700 font-medium">
                        <span className="font-bold text-[9px] bg-emerald-50 border border-emerald-100 px-1 rounded mr-1">TM: </span>
                        {tms.join(', ')}
                    </div>
                )}
                {rxs.length > 0 && (
                    <div className="text-fuchsia-700 font-medium">
                        <span className="font-bold text-[9px] bg-fuchsia-50 border border-fuchsia-100 px-1 rounded mr-1">TH: </span>
                        {rxs.map((med, idx) => {
                            let badge = '';
                            if (typeof getAntibioticDay === 'function') {
                                const cleanMedName = med.split(/\s+\d/)[0].trim().replace(/\s+(iv|im|sc|po|drip)$/i, '');
                                const hCode = getAntibioticDay(cleanMedName, medicationLogs);
                                if (hCode) badge = ` [🚨 ${hCode}]`;
                            }
                            return (idx > 0 ? ', ' : '') + med + badge;
                        })}
                    </div>
                )}
            </div>
        );
    };

    const getTtvValue = (text, key) => {
        if (!text) return ''; 
        const lines = text.split('\n');
        const regex = new RegExp(`${key}\\s*[:=]?\\s*([0-9\\.,\\/]+)`, 'i');
        const foundLine = lines.find(l => regex.test(l));
        return foundLine ? foundLine.match(regex)[1] : '';
    };

    if (records.length === 0) return <div className="text-center p-10 text-gray-400 italic text-sm bg-white h-full border rounded">Data tidak ditemukan sesuai filter.</div>;

    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); 
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 8); 
        if (v.length > 8) final += ', ' + v.substring(8, 10); 
        if (v.length > 10) final += ':' + v.substring(10, 12); 
        e.target.value = final;
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="flex border-b bg-gray-50 p-1 gap-2 items-center justify-between flex-shrink-0">
                {isSelectionMode ? (
                    <div className="flex gap-2 flex-1 items-center px-2 animate-in fade-in slide-in-from-left-5 duration-300 bg-red-50 rounded py-1">
                        <button onClick={() => setIsSelectionMode(false)} className="text-gray-500 hover:text-gray-700 font-bold text-xs border px-3 py-1 bg-white rounded hover:bg-gray-100 transition">Batal</button>
                        <div className="text-xs font-bold text-red-800 bg-red-100 px-2 py-1 rounded border border-red-200">{selectedIds.length} Dipilih</div>
                        <button onClick={executeBulkDischarge} disabled={selectedIds.length === 0} className={`px-4 py-1 text-xs font-bold text-white rounded shadow-sm transition flex items-center gap-1 ${selectedIds.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'}`}>
                            <span>🚪</span> PULANGKAN {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                        </button>
                    </div>
                ) : (                    
                    <div className="flex gap-1 flex-1">
                        <button onClick={() => setIsSelectionMode(true)} className="px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-[10px] font-bold rounded hover:bg-indigo-50 transition shadow-sm whitespace-nowrap mr-2 flex items-center gap-1"><span>☑️</span> Pilih Banyak</button>
                        <button onClick={() => setViewMode('soap')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'soap' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📝 Mode SOAP</button>
                        <button onClick={() => setViewMode('troli-obat')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'troli-obat' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>🛒 Troli Obat</button>
                        <button onClick={() => setViewMode('lab-board')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'lab-board' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>🧪 Rekap Lab/Rad</button>
                        <button onClick={() => setViewMode('ttv')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'ttv' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📊 Mode TTV</button>
                        <button onClick={() => setViewMode('buku-cm')} className={`flex-1 py-1.5 text-xs font-bold rounded transition gap-2 ${viewMode === 'buku-cm' ? 'bg-emerald-600 text-white shadow-sm border-emerald-600' : 'text-gray-500 hover:bg-gray-200 bg-white border border-gray-200'}`}>📖 Buku CM</button>
                    </div>
                )}
                
                {viewMode === 'ttv' && !isSelectionMode && (
                    <button onClick={onPrintTTV} className="px-3 py-1.5 bg-white border border-green-600 text-green-700 text-[10px] font-bold rounded hover:bg-green-50 transition shadow-sm whitespace-nowrap">🖨️ Cetak Lembar TTV</button>
                )}

                {viewMode === 'soap' && !isSelectionMode && (
                    <button onClick={onPrintSOAP} className="px-3 py-1.5 bg-white border border-blue-600 text-blue-700 text-[10px] font-bold rounded hover:bg-indigo-50 transition shadow-sm whitespace-nowrap">🖨️ Cetak Lembar SOAP</button>
                )}
            </div>

            {viewMode === 'buku-cm' ? (
                <div className="flex-1 bg-gray-50 overflow-hidden">
                    <BukuCMTable roomList={roomList} records={sortedRecords} updateRecord={updateRecord} onPrint={onPrintBukuCM} onEdit={onEdit} />
                </div>
            ) : viewMode === 'lab-board' ? (
                <div className="flex-1 bg-gray-50 overflow-hidden p-2">
                    <LabRadiologyBoard records={sortedRecords} />
                </div>    
            ) : viewMode === 'troli-obat' ? (
                <div className="flex-1 bg-gray-50 overflow-hidden">
                    <GlobalMedicationBoard records={sortedRecords} db={db} currentUser={currentUser} firebaseConfig={firebaseConfig} onEditPatient={onEdit} />
                </div>
            ) : (
                <div id="ttv-table-area" className="overflow-auto flex-1 custom-scrollbar">
                    <table className={`w-full text-xs border-collapse table-fixed ${viewMode === 'ttv' ? 'min-w-[1100px]' : 'min-w-[1000px]'}`}>
                        <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm h-9">
                            <tr>
                                <th className="p-2 border border-gray-300 w-[140px] text-left sticky left-0 bg-gray-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px]">
                                    {isSelectionMode ? (
                                        <div className="flex items-center gap-2 pl-1 bg-white border border-indigo-200 rounded px-1 py-0.5">
                                            <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === sortedRecords.length && sortedRecords.length > 0} className="w-3.5 h-3.5 cursor-pointer accent-indigo-600"/>
                                            <span className="text-[10px] text-indigo-800 font-bold">Pilih Semua</span>
                                        </div>
                                    ) : 'Identitas'}
                                </th>
                                
                                {viewMode === 'soap' ? (
                                    <>
                                        <th className="p-2 border border-gray-300 w-[200px] text-left">S (Subjektif)</th>
                                        <th className="p-2 border border-gray-300 w-[200px] text-left">O (Objektif)</th>
                                        <th className="p-2 border border-gray-300 w-[200px] text-left">A (Analisa)</th>
                                        <th className="p-2 border border-gray-300 w-[250px] text-left">P (Planning)</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-1 border border-gray-300 w-[60px] text-center bg-emerald-50 text-[10px]">No.RM</th>
                                        <th className="p-1 border border-gray-300 w-[35px] text-center bg-emerald-50 text-[10px]">Kls</th>
                                        <th className="p-1 border border-gray-300 w-[100px] text-center bg-emerald-50 text-[10px]">Tgl Msk</th>
                                        <th className="p-1 border border-gray-300 w-[60px] text-center bg-emerald-50 text-[10px]">Hari</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">TD</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">Nadi</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">Suhu</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">RR</th>
                                        <th className="p-1 border border-gray-300 w-[42px] text-center bg-white text-[10px]">SpO2</th>
                                        <th className="p-1 border border-gray-300 w-[110px] text-center bg-gray-50 text-gray-800 font-bold text-[10px]">⚠️ Lacak Hasil</th>
                                        <th className="p-2 border border-gray-300 text-left bg-gray-50 text-gray-800 font-bold text-[10px]">⚠️ Rencana / Persiapan</th>
                                    </>
                                )}
                                <th className="p-2 border border-gray-300 w-[120px] text-center no-print text-[10px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewMode === 'soap' ? (
                                sortedRecords.map((rec, index) => (
                                    <tr 
                                        key={rec.id} 
                                        onClick={() => isSelectionMode ? handleSelectRow(rec.id) : onEdit(rec)} 
                                        className={`cursor-pointer transition-colors border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${selectedIds.includes(rec.id) ? '!bg-indigo-100 border-indigo-200' : 'hover:bg-indigo-50/50'}`}
                                    >
                                        <td className="p-1.5 border-r border-gray-300 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-inherit">
                                            <div className="flex items-start gap-1">
                                                {isSelectionMode && (
                                                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" checked={selectedIds.includes(rec.id)} onChange={() => handleSelectRow(rec.id)} className="w-3.5 h-3.5 cursor-pointer accent-indigo-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-[11px] text-indigo-900 truncate leading-tight">{rec.name}</div>
                                                    <div className="text-[9px] font-mono text-gray-400">RM: {rec.rmNumber || '-'}</div>
                                                    <div className="flex gap-1 mt-0.5">
                                                        <span className="font-bold bg-yellow-100 px-1 rounded text-[9px] border border-yellow-200">{rec.roomNumber}</span>
                                                        <span className="bg-gray-100 px-1 rounded text-[8px] text-gray-500 border">{rec.gender}</span>
                                                    </div>
                                                    <div className="mt-0.5 text-gray-600 italic text-[9px] truncate font-medium">DPJP: {rec.dpjpName}</div>
                                                    {(rec.raberName || rec.raber2Name) && (
                                                        <div className="mt-0.5 text-blue-600 font-bold text-[9px] leading-tight">
                                                            <span className="text-gray-400 font-normal">Rb: </span>
                                                            {[rec.raberName, rec.raber2Name].filter(Boolean).map(name => name).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2 border-r border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.subjective || '-'}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">{renderObjectiveCell(rec.objective)}</td>
                                        <td className="p-2 border-r border-gray-300 align-top whitespace-pre-wrap font-sans">{rec.analysis || '-'}</td>
                                        <td className="p-2 border-r border-gray-300 align-top">{renderPlanningCell(rec.planning, rec.medicationLogs)}</td>
                                        <td className="p-1.5 border-r border-gray-300 align-middle no-print" onClick={(e) => e.stopPropagation()}>
                                            <div className="grid grid-cols-2 gap-1">
                                                <button onClick={() => onEdit(rec)} className="flex flex-col items-center justify-center p-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 border border-yellow-300" title="Edit"><span className="text-sm">✏️</span><span className="text-[8px] font-bold">Edit</span></button>
                                                <button onClick={() => onPrint(rec)} className="flex flex-col items-center justify-center p-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300" title="Cetak"><span className="text-sm">🖨️</span><span className="text-[8px] font-bold">Cetak</span></button>                                                
                                                <button onClick={() => onShowLaporModal(rec)} className="flex flex-col items-center justify-center p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300" title="Lapor WA"><span className="text-sm">📱</span><span className="text-[8px] font-bold">Lapor</span></button>
                                                <button onClick={() => onDischarge(rec.id, rec.name, rec.roomNumber)} className="flex flex-col items-center justify-center p-1 bg-red-100 text-red-700 rounded hover:bg-red-200 border border-red-300" title="Keluar"><span className="text-sm">🚪</span><span className="text-[8px] font-bold">Keluar</span></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                [...roomList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map((room, index) => {
                                    const rec = records.find(r => r.roomNumber === room && !r.isDischarged);
                                    return (
                                        <tr key={room} className={`transition-colors border-b ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${rec ? 'hover:bg-indigo-50/50 cursor-pointer' : ''}`} onClick={() => rec ? onEdit(rec) : null}>
                                            <td className="p-1.5 border-r border-gray-300 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] bg-inherit">
                                                <div className="flex items-start gap-1">
                                                    <div className="flex-1 min-w-0">
                                                        {rec ? (
                                                            <>
                                                                <div className="font-bold text-[11px] text-indigo-900 truncate leading-tight">{rec.name}</div>
                                                                <div className="flex gap-1 mt-0.5">
                                                                    <span className="font-bold bg-yellow-100 px-1 rounded text-[9px] border border-yellow-200">{room}</span>
                                                                    <span className="bg-gray-100 px-1 rounded text-[8px] text-gray-500 border">{rec.gender}</span>
                                                                </div>
                                                                <div className="mt-0.5 text-gray-600 italic text-[9px] truncate font-medium">DPJP: {rec.dpjpName}</div>
                                                                {(rec.raberName || rec.raber2Name) && (
                                                                    <div className="mt-0.5 text-blue-600 font-bold text-[9px] leading-tight">
                                                                        <span className="text-gray-400 font-normal">Rb: </span>
                                                                        {[rec.raberName, rec.raber2Name].filter(Boolean).map(name => name).join(', ')}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="font-bold text-[11px] text-gray-300 truncate leading-tight">...</div>
                                                                <div className="flex gap-1 mt-0.5">
                                                                    <span className="font-bold bg-gray-100 px-1 rounded text-[9px] border border-gray-200 text-gray-400">{room}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-1 border-r border-gray-300 align-middle text-center bg-emerald-50/30 hover:bg-yellow-100/50" onClick={(e) => { if(rec) e.stopPropagation(); }}>
                                                {rec ? (
                                                    <>
                                                        <input type="text" defaultValue={rec.rmNumber || ''} onBlur={(e) => updateRecord(rec.id, { rmNumber: e.target.value })} className="w-full bg-transparent outline-none text-center font-mono text-[9px] no-print focus:border-b border-indigo-500" />
                                                        <span className="hidden print:inline text-[9px] font-mono">{rec.rmNumber || ''}</span>
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center bg-emerald-50/30 hover:bg-yellow-100/50" onClick={(e) => { if(rec) e.stopPropagation(); }}>
                                                {rec ? (
                                                    <>
                                                        <input type="text" defaultValue={rec.bpjsClass || ''} onBlur={(e) => updateRecord(rec.id, { bpjsClass: e.target.value })} className="w-full bg-transparent outline-none text-center text-[9px] no-print focus:border-b border-indigo-500" />
                                                        <span className="hidden print:inline text-[8px]">{rec.bpjsClass || ''}</span>
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center bg-emerald-50/30 hover:bg-yellow-100/50" onClick={(e) => { if(rec) e.stopPropagation(); }}>
                                                {rec ? (
                                                    <>
                                                        <input 
                                                            type="text" 
                                                            defaultValue={formatDateCM(rec.admissionDate)} 
                                                            onChange={handleDateMasking} 
                                                            onBlur={(e) => { const pd = parseDateCM(e.target.value); if(pd !== rec.admissionDate) updateRecord(rec.id, { admissionDate: pd }); }} 
                                                            className="w-full bg-transparent outline-none text-center font-mono text-[9px] no-print focus:border-b border-indigo-500" 
                                                            placeholder="dd/mm/yy hh:mm" 
                                                        />
                                                        <span className="hidden print:inline text-[8px] font-mono">{formatDateCM(rec.admissionDate) || ''}</span>
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-bold text-gray-600 text-[10px]">
                                                {rec ? hitungHariCM(rec.admissionDate) : ''}
                                            </td>

                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono font-bold text-[10px]">{rec ? getTtvValue(rec.objective, 'TD') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'N') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'S') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'RR') : ''}</td>
                                            <td className="p-1 border-r border-gray-300 align-middle text-center font-mono text-[10px]">{rec ? getTtvValue(rec.objective, 'SpO2') : ''}</td>
                                            <td className="p-1.5 border-r border-gray-300 align-top">
                                                {rec ? renderLacakTtv(rec.objective) : null}
                                            </td>
                                            <td className="p-1.5 border-r border-gray-300 align-top">
                                                {rec ? (
                                                    <>
                                                        {getPreparationAlert(rec.planning)}
                                                        {renderTtvPlanning(rec.planning, rec.medicationLogs)}
                                                    </>
                                                ) : null}
                                            </td>
                                            <td className="p-1.5 border-r border-gray-300 align-middle no-print" onClick={(e) => e.stopPropagation()}>
                                                {rec ? (
                                                    <button onClick={() => onQuickTtv(rec)} className="w-full h-full py-2 bg-green-100 text-green-700 rounded border border-green-300 hover:bg-green-200 text-[10px] font-bold shadow-sm flex items-center justify-center" title="Isi TTV Cepat">+ Input TTV</button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PatientTable;