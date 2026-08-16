import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';

export const RadiologyGallery = ({ images = [], onAddImage, onRemoveImage, currentUser, db, firebaseConfig, record }) => {
    const [activeCategory, setActiveCategory] = useState('Rontgen');
    const [previewImage, setPreviewImage] = useState(null);

    const CATEGORIES = ['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka', 'Lainnya'];

    // Filter images by active category
    const categoryImages = images.filter(img => img.category === activeCategory);

    // ✨ FITUR MANDOR: ANTENA CLIPBOARD PENDETEKSI CTRL+V (DIRECT PASTE)
    useEffect(() => {
        const handleClipboardPaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            // Pindai isi clipboard untuk mendeteksi apakah ada kiriman file gambar
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    const reader = new FileReader();

                    reader.onload = (event) => {
                        const uploadedBy = (currentUser?.name || 'Perawat').split(' ')[0];
                        const now = new Date();

                        // Menjaga keseragaman format tanggal & waktu persisten sesuai V1
                        const dateStr = now.toLocaleDateString('id-ID', {
                            day: '2-digit', month: '2-digit', year: '2-digit'
                        });
                        const timeStr = now.toLocaleTimeString('id-ID', {
                            hour: '2-digit', minute: '2-digit'
                        });

                        // Tembakkan langsung ke database lewat fungsi onAddImage bawaan kartu
                        onAddImage([{
                            category: activeCategory,
                            imageUrl: event.target.result, // base64 link
                            date: dateStr,
                            time: timeStr,
                            uploadedBy: uploadedBy,
                            id: `img_${Date.now()}_${i}`
                        }]);
                    };
                    reader.readAsDataURL(file);
                }
            }
        };

        // Pasang pendengar otomatis di jendela browser laptop RS
        window.addEventListener('paste', handleClipboardPaste);
        return () => window.removeEventListener('paste', handleClipboardPaste);
    }, [activeCategory, currentUser, onAddImage]);

    // Group images by date for display
    const groupedByDate = useMemo(() => {
        const groups = {};
        categoryImages.forEach(img => {
            const dateKey = img.date || 'Unknown';
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(img);
        });
        // Sort groups by date (newest first)
        return Object.entries(groups).sort((a, b) => {
            const dateA = new Date(a[0].split('/').reverse().join('-'));
            const dateB = new Date(b[0].split('/').reverse().join('-'));
            return dateB - dateA;
        });
    }, [categoryImages]);

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const reader = new FileReader();
        let loadedCount = 0;
        const newImages = [];

        files.forEach((file, idx) => {
            reader.onload = (event) => {
                const uploadedBy = (currentUser?.name || 'Perawat').split(' ')[0];
                const now = new Date();
                const dateStr = now.toLocaleDateString('id-ID', {
                    day: '2-digit', month: '2-digit', year: '2-digit'
                });
                const timeStr = now.toLocaleTimeString('id-ID', {
                    hour: '2-digit', minute: '2-digit'
                });

                newImages.push({
                    category: activeCategory,
                    imageUrl: event.target.result,
                    date: dateStr,
                    time: timeStr,
                    uploadedBy: uploadedBy,
                    id: `img_${Date.now()}_${idx}`
                });

                loadedCount++;
                if (loadedCount === files.length) {
                    onAddImage(newImages);
                }
            };
            reader.readAsDataURL(files[idx]);
        });
        e.target.value = '';
    };

    const formatCategoryIcon = (cat) => {
        switch (cat) {
            case 'Rontgen': return '🩻';
            case 'USG': return '🔊';
            case 'CT Scan': return '💉';
            case 'EKG': return '❤️';
            case 'Luka': return '🩹';
            default: return '📷';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-700 to-gray-600 px-3 py-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    📷 Gambar & Radiologi
                </h3>
                <span className="text-[10px] text-gray-300">
                    {images.length} file tersimpan
                </span>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
                {CATEGORIES.map(cat => {
                    const count = images.filter(img => img.category === cat).length;
                    return (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${activeCategory === cat
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'
                                }`}
                        >
                            {formatCategoryIcon(cat)} {cat}
                            {count > 0 && (
                                <span className={`px-1 rounded-full text-[9px] ${activeCategory === cat ? 'bg-white/30' : 'bg-gray-200'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="p-3 space-y-3">
                {/* 🌟 UPGRADE DESAIN BOX: Ditambahkan panduan visual untuk Ctrl + V agar informatif */}
                <div className="border-2 border-dashed border-indigo-300 bg-indigo-50/20 rounded-lg p-4 text-center hover:border-indigo-400 transition-all">
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id={`rad-upload-${activeCategory}`}
                    />
                    <label
                        htmlFor={`rad-upload-${activeCategory}`}
                        className="cursor-pointer flex flex-col items-center gap-1.5"
                    >
                        <span className="text-2xl animate-pulse">📋</span>
                        <span className="text-xs text-indigo-900 font-black">
                            Tekan Ctrl + V untuk Paste Gambar Langsung!
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">
                            Atau klik di sini untuk pilih file dari folder Windows
                        </span>
                    </label>
                </div>

                {/* Gallery */}
                {groupedByDate.length > 0 ? (
                    <div className="space-y-3">
                        {groupedByDate.map(([date, imgs]) => (
                            <div key={date} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                                <div className="text-[10px] font-bold text-gray-500 mb-2 flex items-center gap-1">
                                    📅 {date}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {imgs.map((img, idx) => (
                                        <div key={img.id || idx} className="relative group">
                                            <img
                                                src={img.imageUrl}
                                                alt={`${img.category} ${idx + 1}`}
                                                className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-indigo-400 hover:scale-105 transition-all shadow-sm"
                                                onClick={() => setPreviewImage(img.imageUrl)}
                                                title={`${img.uploadedBy} • ${img.time || ''}`}
                                            />
                                            <button
                                                onClick={() => onRemoveImage(img.id || img.imageUrl)}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md hover:bg-red-600"
                                                title="Hapus"
                                            >
                                                ✕
                                            </button>
                                            <div className="absolute -bottom-1 -right-1 bg-white/90 text-[8px] text-gray-500 px-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition">
                                                {img.time}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-gray-400">
                        <span className="text-3xl">🖼️</span>
                        <p className="text-[10px] mt-1">Belum ada {activeCategory}</p>
                        <p className="text-[9px]">Screenshot / Snip gambar lalu tekan Ctrl + V di sini</p>
                    </div>
                )}
            </div>

            {/* Fullscreen Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white w-10 h-10 rounded-full text-xl flex items-center justify-center transition"
                        onClick={() => setPreviewImage(null)}
                    >
                        ✕
                    </button>
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};