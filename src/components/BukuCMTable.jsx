import React, { useState, useMemo } from 'react';
import { ROOM_LIST } from '../constants';

const BukuCMTable = ({ records, updateRecord, onPrint, roomList = ROOM_LIST, onEdit }) => {
    // 1. STATE UNTUK SORTING (Gaya Excel)
    const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'asc' });

    const formatRoom = (room) => room ? room.replace(/[AB]$/, '') : '';

    // 2. FUNGSI UNTUK MENGUBAH SORTING SAAT HEADER DIKLIK
    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            key = 'default'; // Kembali ke urut kamar bawaan
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // 3. LOGIKA PENGURUTAN DATA
    const sortedRooms = useMemo(() => {
        const baseRooms = [...roomList].sort((a, b) => 
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );

        if (sortConfig.key === 'default') {
            return baseRooms;
        }

        return baseRooms.sort((roomA, roomB) => {
            const recA = records.find(r => r.roomNumber === roomA);
            const recB = records.find(r => r.roomNumber === roomB);

            // Selalu lempar kamar kosong ke bawah saat sorting diaktifkan
            if (!recA && !recB) return 0;
            if (!recA) return 1;
            if (!recB) return -1;

            if (sortConfig.key === 'name') {
                const nameA = (recA.name || '').toLowerCase();
                const nameB = (recB.name || '').toLowerCase();
                if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            } else if (sortConfig.key === 'admissionDate') {
                const dateA = new Date(recA.admissionDate || 0);
                const dateB = new Date(recB.admissionDate || 0);
                // asc = Terlama (tanggal terkecil di atas), desc = Terbaru (tanggal terbesar di atas)
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
    }, [sortConfig, records, roomList]);

    // Helper untuk menampilkan Ikon Panah di Header
    const getSortIcon = (columnKey) => {
        if (sortConfig.key !== columnKey) return <span className="opacity-30">↕️</span>;
        if (sortConfig.direction === 'asc') return <span>🔼</span>;
        return <span>🔽</span>;
    };

    const formatCustomDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d)) return isoString;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
    };

    const parseCustomDate = (text) => {
        if (!text) return '';
        const match = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})[\s,]+(\d{1,2})[\:\.](\d{1,2})/);
        if (match) {
            let [_, d, m, y, h, min] = match;
            if (y.length === 2) y = '20' + y;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}`;
        }
        return text;
    };

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

    const hitungLamaRawat = (tanggalMasuk) => {
        if (!tanggalMasuk) return '-';
        const start = new Date(tanggalMasuk);
        if (isNaN(start)) return '?';
        const now = new Date();
        const diffTime = now.getTime() - start.getTime();
        
        if (diffTime < 0) return '0 hr 0 jm';
        
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        return `${diffDays} hr ${diffHours} jm`; 
    };

    const handleInlineSave = (id, field, value) => {
        updateRecord(id, { [field]: value });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center no-print flex-shrink-0">
                <div>
                    <h2 className="font-bold text-emerald-800 flex items-center gap-2 text-sm">📖 Buku Register Ruangan (CM) | 
                        <p className="text-[9px] text-emerald-600">isi tanggal-jam masuk 2 angka, untuk tahun 4 angka, langsung saja tanpa /</p></h2>                    
                </div>
                {/* DROPDOWN DIHAPUS, SISA TOMBOL CETAK SAJA */}
                <button onClick={onPrint} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow hover:bg-emerald-700 transition flex items-center gap-2">
                    🖨️ Cetak Register
                </button>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
                <style>{`
                    .print-text { display: none; }
                    @media print {
                        body * { visibility: hidden; }
                        #buku-cm-print, #buku-cm-print * { visibility: visible; }
                        #buku-cm-print { position: absolute; left: 0; top: 0; width: 100%; }
                        .no-print { display: none !important; }
                        .print-text { display: block !important; text-align: center; width: 100%; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { 
                            border: 1px solid black !important; padding: 4px; color: black !important; font-size: 11px; text-align: center !important; 
                            position: static !important; box-shadow: none !important; 
                        }
                        th { background-color: #eee !important; -webkit-print-color-adjust: exact; }
                    }
                `}</style>

                <div id="buku-cm-print" className="p-4 pt-0">
                    <table className="w-full text-center border-collapse table-fixed min-w-[900px]">
                        <thead className="bg-gray-100 text-gray-700 text-[10px] uppercase font-bold border-y border-gray-300 sticky top-0 z-40 shadow-sm">
                            <tr>
                                <th className="p-2 border-x border-gray-300 w-[35px] sticky left-0 bg-gray-200 z-50">No</th>
                                
                                {/* HEADER NAMA PASIEN (DIBUAT BISA DIKLIK) */}
                                <th 
                                    className="p-2 border-x border-gray-300 w-[160px] sticky left-[35px] bg-gray-200 z-50 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-gray-300 transition-colors select-none title-attr" 
                                    onClick={() => requestSort('name')}
                                    title="Klik untuk mengurutkan A-Z / Z-A"
                                >
                                    <div className="flex justify-between items-center">
                                        <span>Nama Pasien</span>
                                        <span className="text-[10px]">{getSortIcon('name')}</span>
                                    </div>
                                </th>
                                
                                <th className="p-2 border-x border-gray-300 w-10 bg-gray-100">KMR</th>
                                <th className="p-2 border-x border-gray-300 w-[75px] bg-gray-100">No. RM</th>
                                <th className="p-2 border-x border-gray-300 min-w-[110px] bg-gray-100 text-left">Dokter</th>
                                <th className="p-2 border-x border-gray-300 w-10 bg-gray-100">Kls</th>
                                
                                {/* HEADER TANGGAL MASUK (DIBUAT BISA DIKLIK) */}
                                <th 
                                    className="p-2 border-x border-gray-300 w-[135px] bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors select-none"
                                    onClick={() => requestSort('admissionDate')}
                                    title="Klik untuk mengurutkan Paling Lama / Paling Baru"
                                >
                                    <div className="flex justify-between items-center">
                                        <span>Tgl Masuk</span>
                                        <span className="text-[10px]">{getSortIcon('admissionDate')}</span>
                                    </div>
                                </th>
                                
                                <th className="p-2 border-x border-gray-300 w-[75px] bg-gray-100">Hr</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] divide-y divide-gray-200">
                            {sortedRooms.map((room, index) => {
                                const rec = records.find(r => r.roomNumber === room);
                                
                                return (
                                    // ✨ FIX: Baris ini (<tr>) ditambahkan onClick dan diubah kursornya menjadi jari (pointer)
                                    <tr 
                                        key={room} 
                                        className={`transition-colors ${rec ? 'bg-white hover:bg-emerald-50 cursor-pointer' : 'bg-gray-50 hover:bg-gray-100'}`}
                                        onClick={() => { if(rec && onEdit) onEdit(rec); }}
                                        title={rec ? "Klik untuk buka form SOAP" : ""}
                                    >
                                        <td className="p-1 border-x border-gray-200 text-gray-400 sticky left-0 bg-inherit z-30">
                                            {index + 1}
                                        </td>
                                        <td className="p-1 px-2 border-x border-gray-200 font-bold text-gray-800 uppercase truncate text-left sticky left-[40px] bg-inherit z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {rec ? rec.name : ''}
                                        </td>
                                        <td className="p-1 border-x border-gray-200 font-bold text-indigo-700">
                                            {formatRoom(room)}
                                        </td>
                                        <td className="p-0.5 border-x border-gray-200 bg-yellow-50/20" onClick={(e) => e.stopPropagation()}>
                                            {rec && (
                                                <>
                                                    <input type="text" defaultValue={rec.rmNumber || ''} onBlur={(e) => handleInlineSave(rec.id, 'rmNumber', e.target.value)} className="w-full bg-transparent outline-none text-center font-mono no-print" placeholder="..." />
                                                    <span className="print-text">{rec.rmNumber || ''}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-1 px-2 border-x border-gray-200 leading-tight text-left">
                                            {rec ? (
                                                <>
                                                    <div className="font-bold text-gray-700">{rec.dpjpName}</div>
                                                    {(rec.raberName || rec.raber2Name) && (
                                                        <div className="text-blue-600 font-bold italic text-[9px]">
                                                            Rb: {[rec.raberName, rec.raber2Name].filter(Boolean).map(n => n).join(', ')}
                                                        </div>
                                                    )}
                                                </>
                                            ) : ''}
                                        </td>
                                        <td className="p-0.5 border-x border-gray-200 bg-yellow-50/20" onClick={(e) => e.stopPropagation()}>
                                            {rec && (
                                                <>
                                                    <input type="text" defaultValue={rec.bpjsClass || ''} onBlur={(e) => handleInlineSave(rec.id, 'bpjsClass', e.target.value)} className="w-full bg-transparent outline-none text-center no-print" placeholder="..." />
                                                    <span className="print-text">{rec.bpjsClass || ''}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-0.5 border-x border-gray-200 bg-yellow-50/20" onClick={(e) => e.stopPropagation()}>
                                            {rec && (
                                                <>
                                                    <input 
                                                        type="text" 
                                                        defaultValue={formatCustomDate(rec.admissionDate)} 
                                                        onChange={handleDateMasking}
                                                        onBlur={(e) => { const pd = parseCustomDate(e.target.value); if (pd !== rec.admissionDate) handleInlineSave(rec.id, 'admissionDate', pd); }} 
                                                        className="w-full bg-transparent outline-none text-center font-mono no-print" 
                                                        placeholder="dd/mm/yy hh:mm" 
                                                    />
                                                    <span className="print-text font-mono">{formatCustomDate(rec.admissionDate) || ''}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-1 border-x border-gray-200 font-bold text-rose-600">
                                            {rec ? hitungLamaRawat(rec.admissionDate) : ''}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BukuCMTable;