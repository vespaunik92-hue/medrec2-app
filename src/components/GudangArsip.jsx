import React, { useState, useMemo } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';

const formatTgl = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const GudangArsip = ({ dataPasien, loading, db, onRestore, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  const groupedData = useMemo(() => {
    const groups = {};
    
    const filtered = dataPasien.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchRM = (p.rmNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchName || matchRM;
    });

    filtered.forEach(p => {
      const groupKey = (p.rmNumber || '').trim() || (p.name || '').toLowerCase().trim();
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          name: p.name,
          rmNumber: p.rmNumber || '-',
          history: [] 
        };
      }
      
      groups[groupKey].history.push(p);
    });

    // Mengurutkan riwayat dari yang TERBARU ke TERLAMA di dalam setiap grup pasien
    const finalGroups = Object.values(groups).map(g => {
        g.history.sort((a, b) => new Date(b.admissionDate || 0) - new Date(a.admissionDate || 0));
        return g;
    });

    return finalGroups.sort((a, b) => a.name.localeCompare(b.name));
  }, [dataPasien, searchTerm]);

  const toggleHistorySelection = (id) => {
    setSelectedHistoryIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleGroupSelection = (groupKey) => {
    const groupHistory = groupedData.find(g => g.key === groupKey)?.history || [];
    const groupIds = groupHistory.map(h => h.id);
    const allSelected = groupIds.every(id => selectedHistoryIds.includes(id));
    
    if (allSelected) {
      setSelectedHistoryIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      const newIds = [...selectedHistoryIds];
      groupIds.forEach(id => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      setSelectedHistoryIds(newIds);
    }
  };

  const toggleExpand = (groupKey) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Yakin hapus PERMANEN ${selectedHistoryIds.length} riwayat kunjungan terpilih dari arsip?`)) return;

    const batch = writeBatch(db);
    selectedHistoryIds.forEach((id) => {
      const docRef = doc(db, "artifacts/1:1097108054720:web:a53efbaf9882d5086d0325/public/data/medicalRecords", id); 
      batch.delete(docRef); 
    });

    try {
      await batch.commit();
      setSelectedHistoryIds([]); 
      if (onRefresh) onRefresh(); 
      alert("Riwayat kunjungan berhasil dihapus permanen!");
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  if (loading) return <div className="p-10 text-center text-indigo-600 font-bold animate-pulse">Memuat brankas arsip...</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen flex flex-col">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h2 className="text-xl font-bold text-gray-800">🗃️ Gudang Arsip Terpusat</h2>
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Cari Nama Pasien atau No. RM..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {selectedHistoryIds.length > 0 && (
          <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap font-bold">
            <Trash2 size={18} /> Hapus {selectedHistoryIds.length} Riwayat
          </button>
        )}
      </div>

      <div className="overflow-auto border border-gray-200 rounded-xl shadow-sm bg-white flex-1 max-h-[75vh] custom-scrollbar">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="sticky top-0 z-50 bg-indigo-600 text-white shadow-sm">
            <tr>
              <th className="p-3 w-10 border-b"></th>
              <th className="p-3 w-32 border-b">No. RM</th>
              <th className="p-3 min-w-[250px] border-b">Identitas Pasien</th>
              <th className="p-3 border-b text-center">Total Kunjungan</th>
              <th className="p-3 border-b text-center">Rincian</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-200">
            {groupedData.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-10 text-center text-gray-500 italic">
                  {searchTerm ? 'Pencarian tidak ditemukan.' : 'Belum ada data di arsip.'}
                </td>
              </tr>
            ) : (
              groupedData.map((group) => {
                const isExpanded = expandedGroups[group.key];
                const isAllSelected = group.history.length > 0 && group.history.every(h => selectedHistoryIds.includes(h.id));
                const isSomeSelected = !isAllSelected && group.history.some(h => selectedHistoryIds.includes(h.id));

                return (
                  <React.Fragment key={group.key}>
                    {/* BARIS UTAMA (INDUK PASIEN) */}
                    <tr 
                      className={`hover:bg-indigo-50 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'bg-white'}`}
                      onClick={() => toggleExpand(group.key)}
                    >
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                          checked={isAllSelected}
                          ref={input => { if (input) input.indeterminate = isSomeSelected; }}
                          onChange={() => toggleGroupSelection(group.key)} 
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-600 text-xs">{group.rmNumber}</td>
                      <td className="p-3">
                        <div className="font-extrabold uppercase text-indigo-900">{group.name}</div>
                        {/* Menampilkan Lokasi Rawat Terakhir di baris depan */}
                        <div className="text-[10px] text-gray-500">
                          Rawat Terakhir: <span className="font-bold">{group.history[0]?.ward || '-'}</span> (Kmr. {group.history[0]?.lastRoom || group.history[0]?.roomNumber || '-'})
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold text-xs">
                          {group.history.length} x Dirawat
                        </span>
                      </td>
                      <td className="p-3 text-center text-gray-400">
                        {isExpanded ? <ChevronUp className="inline" /> : <ChevronDown className="inline" />}
                      </td>
                    </tr>

                    {/* BARIS RINCIAN RIWAYAT (MEKAR/COLLAPSE) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="5" className="p-0 bg-slate-50 border-t border-indigo-100 shadow-inner">
                          <div className="px-10 py-3">
                            <table className="w-full text-xs text-left border border-slate-200 bg-white rounded-md overflow-hidden">
                              <thead className="bg-slate-200 text-slate-700">
                                <tr>
                                  <th className="p-2 w-8 text-center"></th>
                                  <th className="p-2 w-28">Tgl Masuk</th>
                                  <th className="p-2 w-40 text-center">Ruang Perawatan</th>
                                  <th className="p-2 text-center text-blue-700">Pindah</th>
                                  <th className="p-2 text-center text-emerald-700">Pulang</th>
                                  <th className="p-2 text-center text-red-700">Meninggal</th>
                                  <th className="p-2 text-center">Aksi Batal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {group.history.map((h, idx) => {
                                  const tipe = h.dischargeType || 'pulang';
                                  const tglKeluar = formatTgl(h.dischargeDate);
                                  
                                  return (
                                    <tr key={h.id} className="hover:bg-slate-50">
                                      <td className="p-2 text-center">
                                        <input 
                                          type="checkbox" 
                                          checked={selectedHistoryIds.includes(h.id)} 
                                          onChange={() => toggleHistorySelection(h.id)}
                                          className="accent-indigo-600 cursor-pointer"
                                        />
                                      </td>
                                      <td className="p-2 font-mono font-bold text-gray-700">{formatTgl(h.admissionDate)}</td>
                                      
                                      {/* TAMPILAN RUANGAN DETAIL */}
                                      <td className="p-2 text-center">
                                        <span className="font-bold text-indigo-700">{h.ward || '-'}</span> 
                                        <span className="text-gray-500 font-medium"> (Kmr. {h.lastRoom || h.roomNumber || '-'})</span>
                                      </td>

                                      <td className="p-2 text-center font-bold text-blue-600">{tipe === 'pindah' ? tglKeluar : '-'}</td>
                                      <td className="p-2 text-center font-bold text-emerald-600">{tipe === 'pulang' ? tglKeluar : '-'}</td>
                                      <td className="p-2 text-center font-bold text-red-600">{tipe === 'meninggal' ? tglKeluar : '-'}</td>
                                      <td className="p-2 text-center">
                                         {idx === 0 ? (
                                            <button 
                                              onClick={() => onRestore && onRestore(h.id, h.name)} 
                                              className="text-[10px] bg-white border border-indigo-300 text-indigo-700 font-bold px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-colors"
                                              title="Batalkan kepulangan & kembalikan ke bangsal"
                                            >
                                              ↩️ Restore
                                            </button>
                                         ) : (
                                            <span className="text-gray-300 text-[10px] italic">Histori Lama</span>
                                         )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GudangArsip;