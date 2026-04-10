import React, { useState } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { Trash2, CheckSquare, Square, Search } from 'lucide-react';

const GudangArsip = ({ dataPasien, loading, db, onRestore }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Logika Pencarian
  const filteredPasien = dataPasien.filter((p) => {
    const matchName = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchRM = (p.rmNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchName || matchRM;
  });

  // Pilih Semua
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPasien.length && filteredPasien.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPasien.map(p => p.id));
    }
  };

  // Pilih Satuan
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Eksekusi Hapus Masal (Path FIX)
  const handleBulkDelete = async () => {
    if (!window.confirm(`Yakin hapus PERMANEN ${selectedIds.length} data terpilih dari arsip?`)) return;

    const batch = writeBatch(db);
    selectedIds.forEach((id) => {
      // PATH DATABASE SUDAH DIPERBAIKI SESUAI App.jsx
      const docRef = doc(db, "artifacts/1:1097108054720:web:a53efbaf9882d5086d0325/public/data/medicalRecords", id); 
      batch.delete(docRef); 
    });

    try {
      await batch.commit();
      setSelectedIds([]);
      alert("Data berhasil dihapus permanen!");
    } catch (err) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  // Helper Format Tanggal
  const formatTgl = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  if (loading) return <div className="p-10 text-center">Loading data arsip...</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen flex flex-col">
      
      {/* HEADER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-3">
        <h2 className="text-xl font-bold text-gray-800">Gudang Arsip</h2>
        
        {/* Kolom Pencarian */}
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

        {/* Tombol Hapus */}
        {selectedIds.length > 0 && (
          <button onClick={handleBulkDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap">
            <Trash2 size={18} /> Hapus {selectedIds.length} Data
          </button>
        )}
      </div>

      {/* TABEL DATA */}
      <div className="overflow-auto border rounded-xl shadow-sm bg-white flex-1 max-h-[75vh] custom-scrollbar">
        <table className="w-full text-sm text-left border-separate border-spacing-0">
          <thead className="sticky top-0 z-50 bg-blue-600 text-white">
            <tr>
              <th className="p-3 sticky left-0 z-50 bg-blue-600 w-12 border-b">
                <button onClick={toggleSelectAll}>
                  {selectedIds.length === filteredPasien.length && filteredPasien.length > 0 ? <CheckSquare size={20}/> : <Square size={20}/>}
                </button>
              </th>
              <th className="p-3 sticky left-12 z-50 bg-blue-600 w-24 border-b border-r text-center">No. RM</th>
              <th className="p-3 sticky left-[144px] z-50 bg-blue-600 w-56 border-b border-r">Nama Pasien</th>
              <th className="p-3 border-b min-w-[80px] text-center">No. Kmr</th>
              <th className="p-3 border-b min-w-[100px] text-center">Tgl Masuk</th>
              <th className="p-3 border-b min-w-[100px] text-center text-blue-200">Tgl Pindah</th>
              <th className="p-3 border-b min-w-[100px] text-center text-green-200">Tgl Pulang</th>
              <th className="p-3 border-b min-w-[100px] text-center text-red-200">Tgl Meninggal</th>
              <th className="p-3 border-b text-center sticky right-0 bg-blue-600 z-40 w-28">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredPasien.map((p) => {
              const tglMasuk = formatTgl(p.admissionDate);
              const tglSelesai = formatTgl(p.dischargeDate);
              const tipeDischarge = p.dischargeType || 'pulang';
              
              return (
                <tr key={p.id} className="hover:bg-blue-50 group transition-colors">
                  <td className="p-3 sticky left-0 z-20 bg-white group-hover:bg-blue-50 border-b text-center">
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                  </td>
                  <td className="p-3 sticky left-12 z-20 bg-white group-hover:bg-blue-50 border-b border-r font-mono text-center text-xs">{p.rmNumber || '-'}</td>
                  <td className="p-3 sticky left-[144px] z-20 bg-white group-hover:bg-blue-50 border-b border-r font-bold uppercase text-xs">{p.name || '-'}</td>
                  <td className="p-3 border-b text-center font-bold text-gray-600">{p.lastRoom || p.roomNumber || '-'}</td>
                  <td className="p-3 border-b text-center text-xs">{tglMasuk}</td>
                  
                  <td className="p-3 border-b text-center font-medium text-xs text-blue-600">{tipeDischarge === 'pindah' ? tglSelesai : '-'}</td>
                  <td className="p-3 border-b text-center font-medium text-xs text-green-600">{tipeDischarge === 'pulang' ? tglSelesai : '-'}</td>
                  <td className="p-3 border-b text-center font-medium text-xs text-red-600">{tipeDischarge === 'meninggal' ? tglSelesai : '-'}</td>
                  
                  <td className="p-3 border-b text-center sticky right-0 bg-white group-hover:bg-blue-50 z-20">
                     {/* TOMBOL BALIKKAN (RESTORE) FIX */}
                     <button 
                        onClick={() => onRestore && onRestore(p.id, p.name)} 
                        className="text-indigo-600 font-bold text-xs border border-indigo-500 px-3 py-1.5 rounded shadow-sm hover:bg-indigo-600 hover:text-white transition-colors"
                        title="Kembalikan ke Daftar Pasien Aktif"
                     >
                        ↩️ Balikkan
                     </button>
                  </td>
                </tr>
              );
            })}

            {filteredPasien.length === 0 && (
              <tr>
                <td colSpan="9" className="p-10 text-center text-gray-500 italic">
                  {searchTerm ? 'Pencarian tidak ditemukan.' : 'Belum ada data di arsip.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GudangArsip;