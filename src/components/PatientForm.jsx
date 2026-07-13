import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatDateCM, hitungHariCM, getAntibioticDay, parsePlanning, CustomInput, CustomTextArea, CustomSelect, TagSelector, PlanningQuickTag } from '../utils/helpers';
import {
    doc, updateDoc, collection, addDoc, getDocs,
    Timestamp, query, where, deleteDoc, setDoc, onSnapshot
} from 'firebase/firestore';
import {
    ref as storageRef, uploadString, getDownloadURL
} from 'firebase/storage';
import {
    X, Plus, Trash2, Eye, Calendar, Clock,
    FileText, CheckCircle, AlertCircle, RefreshCw,
    Upload, Image as ImageIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    DEFAULT_DPJP_DATA, LAB_CHECKS, RADIOLOGY_CHECKS,
    PROCEDURES, MEDICATIONS, LAB_DICTIONARY, ANTIBIOTICS_DB,
    LAB_PATTERNS, LAB_NORMAL_RANGES, MEDICATION_TRANSLATOR
} from '../constants';
import LabHistoryTable from './LabHistoryTable'; // 👈 Tambahkan baris sakti ini!
import TtvHistory from './TtvHistory';

// ============================================================================
// 📦 KOMPONEN UTAMA
// ============================================================================

// --- INPUT SIDE PANEL (VERSI SUPER: SHORTCUTS + SMART LAB V10) ---
const PatientForm = ({
    showInputModal, setShowInputModal, handleSubmit, formData, handleInputChange, setFormData,
    resetForm, isEditing, currentRecordId, availableRooms, dpjpOptions,
    showRaber1, setShowRaber1, showRaber2, setShowRaber2, historyLogs,
    pullDataForField, setShowTtvModal, appendText, handleDischarge, setSelectedRecordForPrint,
    setRecordForLapor, isFormReady, loading, ALL_PLANNING_OPTIONS, handleDeleteRecord, onPrintCPO,
    onPrintLabel, masterLabs = [], masterRads = [], masterProcedures = [], masterMedications = [],
    archivedRecords = [], activeRecords = [], onOpenMarModal, db, currentUser, firebaseConfig,
    // ✨ GAMBAR RADIOLOGI props
    onAddRadiologyImage, onRemoveRadiologyImage, onSwapBed
}) => {
    const [activeHistoryTab, setActiveHistoryTab] = useState('lab'); // 👈 Default tab pertama adalah Lab

    // 1. STATE BALON TIP
    const [coEditors, setCoEditors] = useState([]);

    // 2. EFEK BALON TIP (DILENGKAPI PELINDUNG ANTI-BLANK)
    useEffect(() => {
        // ✨ PERHATIKAN TANDA TANYA (?): Ini mencegah layar putih jika data terlambat masuk
        if (showInputModal && currentRecordId && db && currentUser?.name && firebaseConfig?.appId) {
            try {
                const presenceRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/presence/${currentUser.name}`);
                setDoc(presenceRef, { name: currentUser.name, activeAt: new Date().getTime() }).catch(() => {});

                const q = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/presence`);
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const editors = [];
                    snapshot.forEach((d) => {
                        const data = d.data();
                        if (data.name && data.name !== currentUser.name) {
                            editors.push(data.name.split(' ')[0]); 
                        }
                    });
                    setCoEditors(editors);
                });

                return () => {
                    unsubscribe();
                    deleteDoc(presenceRef).catch(() => {});
                };
            } catch (error) {
                console.log("Error Balon Tip:", error); // Menangkap error agar layar tidak mati
            }
        }
    }, [showInputModal, currentRecordId, currentUser?.name, db, firebaseConfig]);
    
    // 1. STATE & REF
    const [showSmartPaste, setShowSmartPaste] = useState(false);
    const [rawPasteData, setRawPasteData] = useState('');
    const scrollRef = useRef(null);
    const [showLabModal, setShowLabModal] = useState(false);
    const [rawLabData, setRawLabData] = useState('');
    const [rawRadData, setRawRadData] = useState('');
    const [hideSuggestion, setHideSuggestion] = useState(false);
    useEffect(() => { setHideSuggestion(false); }, [formData?.name]);    
    const archivedMatches = useMemo(() => {
        const currentName = formData?.name || '';
        const currentRm = formData?.rmNumber || '';
        const hasName = currentName.length >= 3;
        const hasRm = currentRm.length >= 2;
        
        if (!hasName && !hasRm) return [];
        
        let matches = archivedRecords.filter(r => {
            if (!r) return false;
            const safeName = typeof r.name === 'string' ? r.name.toLowerCase() : '';
            const matchName = hasName && safeName.includes(currentName.toLowerCase());
            const matchRm = hasRm && r.rmNumber && r.rmNumber.includes(currentRm);
            return matchName || matchRm;
        });

        matches.sort((a, b) => {
            const dateA = a.admissionDate ? new Date(a.admissionDate) : new Date(0);
            const dateB = b.admissionDate ? new Date(b.admissionDate) : new Date(0);
            return dateB - dateA;
        });

        const uniqueMatches = matches.filter((item, index, self) =>
            index === self.findIndex((t) => {
                const isSameRM = t.rmNumber && item.rmNumber && t.rmNumber === item.rmNumber;
                const isSameName = typeof t.name === 'string' && typeof item.name === 'string' && t.name.toLowerCase() === item.name.toLowerCase();
                return isSameRM || isSameName;
            })
        );

        return uniqueMatches.slice(0, 5);
    }, [formData?.name, formData?.rmNumber, archivedRecords]);

// 👇 TARUH FUNGSI AUTO-FORMAT TANGGAL DI SINI 👇
    const handleDateMasking = (e) => {
        let v = e.target.value.replace(/[^\d]/g, ''); // Ambil angka saja
        let final = '';
        if (v.length > 0) final += v.substring(0, 2);
        if (v.length > 2) final += '/' + v.substring(2, 4);
        if (v.length > 4) final += '/' + v.substring(4, 8); // YYYY (4 digit)
        if (v.length > 8) final += ', ' + v.substring(8, 10); // Koma dan Jam
        if (v.length > 10) final += ':' + v.substring(10, 12); // Menit
        e.target.value = final;
    };

    // =====================================
    // 🚀 MESIN PEMINDAH OTOMATIS (P -> O) V2
    // =====================================
    const itemsToMove = useMemo(() => {
        // 1. Gabungkan memori Planning dari shift sebelumnya dan shift saat ini
        const lastPlan = (historyLogs && historyLogs.length > 0) ? historyLogs[0].planning || '' : '';
        const currentPlan = formData.planning || '';
        
        // 2. Ekstrak nama Lab/Rad dari kedua sumber
        const parsedLast = parsePlanning(lastPlan);
        const parsedCurrent = parsePlanning(currentPlan);
        
        // Gabungkan hasil tanpa duplikat
        const allLabs = [...new Set([...(parsedLast.labs || []), ...(parsedCurrent.labs || [])])];
        const allRads = [...new Set([...(parsedLast.rads || []), ...(parsedCurrent.rads || [])])];
        
        const combined = [
            ...allLabs.map(i => ({text: i, type: 'Lab'})),
            ...allRads.map(i => ({text: i, type: 'Rad'}))
        ];

        // 3. KUNCI UTAMA: Tampilkan tombol HANYA JIKA nama Lab/Rad BELUM ADA di kotak Objektif
        const currentObj = (formData.objective || '').toLowerCase();
        return combined.filter(item => !currentObj.includes(item.text.toLowerCase()));
        
    }, [formData.planning, formData.objective, historyLogs]);

    const handleMoveToObjective = (itemText, type) => {
        // 1. Masukkan teks ke kotak O (Objektif) di baris paling atas
        appendText('objective', `Lacak/Lapor: ${itemText}`);

        // 2. BERSIH-BERSIH TOTAL: Hapus dari kotak P (Planning)
        let currentP = formData.planning || '';
        if (currentP.trim()) {
            let lines = currentP.split('\n');
            
            // ✨ FIX BUG: Pelindung Karakter agar kurung "()" terbaca sebagai teks biasa, bukan kode
            const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const safeItemText = escapeRegExp(itemText);

            let newLines = lines.map(line => {
                // Jika baris ini mengandung nama Lab/Rad yang diklik
                if (line.toLowerCase().includes(itemText.toLowerCase())) {
                    
                    // Hapus kata utamanya menggunakan teks yang sudah dilindungi
                    let modified = line.replace(new RegExp(safeItemText, 'gi'), '');
                    
                    // Bersihkan sisa koma, titik, strip, dan spasi yang berantakan
                    modified = modified.replace(/,\s*,/g, ',')
                                       .replace(/:\s*,/g, ':')
                                       .replace(/R\/\s*,/g, 'R/')
                                       .replace(/[-•*]\s*,/g, '-')
                                       .trim();
                    modified = modified.replace(/(^,)|(,$)/g, '').trim();

                    // PISAU SUPER: Jika sisa barisnya cuma "Lab: ", "Rad R/ ", atau sekadar "-" (bullet point), buang barisnya!
                    if (/^[-*•\s]*(Lab|Rad|Radiologi|Laboratorium)\.?\s*(R\/)?\s*:?\s*$/i.test(modified) || modified === '' || modified === '-') {
                        return null; 
                    }
                    return modified;
                }
                return line;
            }).filter(l => l !== null); // Hancurkan baris yang bernilai null

            // Update layar Planning secara seketika
            handleInputChange({ target: { name: 'planning', value: newLines.join('\n') } });
        }
    };
    
    // --- [FITUR BARU] KEYBOARD SHORTCUTS (CTRL+S, CTRL+P, ESC) ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 1. Tombol ESC = Tutup Panel
            if (e.key === 'Escape') {
                if (showSmartPaste || showLabModal) return; // Biarkan modal kecil tutup duluan
                setShowInputModal(false);
                resetForm();
            }

            // 2. CTRL + S = Simpan Data
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault(); 
                if (isFormReady && !loading) {
                    handleSubmit(e);
                }
            }

            // 3. CTRL + ENTER = Simpan Data (Alternatif)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (isFormReady && !loading) {
                    handleSubmit(e);
                }
            }

            // 4. CTRL + P = Print SOAP
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault(); 
                if (formData && formData.name) {
                    setSelectedRecordForPrint(formData);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [formData, isFormReady, loading, handleSubmit, setSelectedRecordForPrint, showSmartPaste, showLabModal]);

    if (!showInputModal) return null;
    
    // DATA LACAK LENGKAP (gabung konstanta + master lists)
    const lacakOptions = [
        ...Array.from(new Set([...(LAB_CHECKS || []), ...masterLabs])),
        ...Array.from(new Set([...(RADIOLOGY_CHECKS || []), ...masterRads])),
        ...Array.from(new Set([...(MEDICATIONS || []), ...masterMedications])),
        ...Array.from(new Set([...(PROCEDURES || []), ...masterProcedures])),
    ];

    // --- HELPER: KOMPRESI GAMBAR (Target ~100-150KB) ---
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Resize: max 1024px, maintain aspect ratio
                    const MAX_WIDTH = 1024;
                    let { width, height } = img;
                    if (width > MAX_WIDTH) {
                        height = (height * MAX_WIDTH) / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress: 75% quality (good balance ~100-150KB)
                    const compressed = canvas.toDataURL('image/jpeg', 0.75);
                    // Log size for debugging
                    const sizeKB = Math.round(compressed.length / 1024);
                    console.log(`Gambar dikompres: ${width}x${height}, ~${sizeKB}KB`);
                    resolve(compressed);
                };
            };
        });
    };

    // --- HELPER: KOMPRESI & MULTI UPLOAD GAMBAR (Evidence Images) ---
    const handleMultiImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const compressedImages = await Promise.all(files.map(file => compressImage(file)));

        handleInputChange({
            target: {
                name: 'evidenceImages',
                value: [...(formData.evidenceImages || []), ...compressedImages]
            }
        });
    };

    const removeImage = (indexToRemove) => {
        const newImages = formData.evidenceImages.filter((_, idx) => idx !== indexToRemove);
        handleInputChange({ target: { name: 'evidenceImages', value: newImages } });
    };
        // --- SMART PASTE V5 (APPEND MODE: GAK NIMPA DATA LAMA) ---
    const handleProcessSmartPaste = () => {
        if (!rawPasteData.trim()) return;

        // Helper: Bersihkan Teks
        const cleanCase = (str) => { if (!str) return ''; return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase()); };

        // Helper Penting: GABUNGKAN TEKS (BARU DI ATAS)
        const appendText = (fieldName, newText) => {
            if (!newText || !newText.trim()) return; 
            const currentText = formData[fieldName] || ''; 
            
            if (!currentText.trim()) {
                handleInputChange({ target: { name: fieldName, value: newText.trim() } });
            } else {
                // ✨ PREPEND: Taruh di atas teks lama
                handleInputChange({ target: { name: fieldName, value: `${newText.trim()}\n\n${currentText.trim()}` } });
            }
        };

        let text = rawPasteData;
        
        // Bersihkan Header Ecalyptus umum
        let cleanText = text
            .replace(/Tanda Vital/gi, '')
            .replace(/Angka/gi, '')
            .replace(/Catatan/gi, ''); 

        // --- SKENARIO 1: CEK HEADER STANDAR (S/O/A/P) ---
        const sMatch = cleanText.match(/Subjektif([\s\S]*?)(?=Objektif|$)/i);
        const oMatch = cleanText.match(/Objektif([\s\S]*?)(?=Assesmen|Asesmen|$)/i);
        const aMatch = cleanText.match(/(?:Assesmen|Asesmen)([\s\S]*?)(?=Rencana|$)/i);
        const pMatch = cleanText.match(/Rencana([\s\S]*)/i);

        if (sMatch || oMatch || aMatch || pMatch) {
            // Gunakan Helper 'appendText' biar gak nimpa
            if (sMatch && sMatch[1]) appendText('subjective', cleanCase(sMatch[1].trim()));
            if (oMatch && oMatch[1]) appendText('objective', cleanCase(oMatch[1].trim()));
            if (aMatch && aMatch[1]) appendText('analysis', cleanCase(aMatch[1].trim()));
            
            // P (Planning) diproses khusus
            if (pMatch && pMatch[1]) processPlanningText(pMatch[1]);
            
        } else {
            // --- SKENARIO 2: DETEKTIF (TANPA HEADER) ---
            let sLines = [], oLines = [], aLines = [], pLines = [];
            const lines = cleanText.split('\n');
            const keywords = {
                S: ['mengeluh', 'keluhan', 'riwayat', 'datang', 'mual', 'muntah', 'pusing', 'nyeri', 'demam', 'batuk', 'sesak', 'bab', 'bak'],
                O: ['lacak', 'mmhg', 'gcs', 'nadi', 'suhu', 'rr', 'spo2', 'td', 'compos', 'mentis', 'apatis', 'somnolen', 'sopor', 'coma', 'akral', 'crt', 'thorax', 'usg', 'rontgen', 'foto', 'ct scan', 'mri', 'kesan', 'kesimpulan'],
                A: ['diagnosa', 'diagnosis', 'susp', 'dd', 'post op', 'post'],
                P: ['rencana', 'terapi', 'instruksi', 'infus', 'inj', 'tab', 'cap', 'drip', 'diet', 'monitor', 'nebu', 'inhalasi', 'o2', 'lpm', 'tpm', 'ml/jam', 'cc/jam', 'pro', 'konsul', 'rawat', 'pulang', 'kontrol', 'x1', 'x 1']
            };

            lines.forEach(line => {
                const lower = line.toLowerCase().trim();
                if (!lower) return;
                if (keywords.P.some(k => lower.includes(k)) || /\d+\s*x\s*\d+/.test(lower) || /\d+\s*mg/.test(lower) || /\d+\s*gr/.test(lower)) { pLines.push(line); }
                else if (keywords.A.some(k => lower.includes(k))) { aLines.push(line); }
                else if (keywords.O.some(k => lower.includes(k))) { oLines.push(line); }
                else if (keywords.S.some(k => lower.includes(k))) { sLines.push(line); }
                else {
                    if (pLines.length > 0 && sLines.length === 0 && oLines.length === 0 && aLines.length === 0) { pLines.push(line); } 
                    else { pLines.push(line); }
                }
            });

            // Gunakan Helper 'appendText'
            if (sLines.length > 0) appendText('subjective', cleanCase(sLines.join('\n')));
            if (oLines.length > 0) appendText('objective', cleanCase(oLines.join('\n')));
            if (aLines.length > 0) appendText('analysis', cleanCase(aLines.join('\n')));
            if (pLines.length > 0) processPlanningText(pLines.join('\n'));
        }

        setShowSmartPaste(false); setRawPasteData('');
    };

    // --- SMART PASTE OBAT: OTOMATIS BABAT HABIS KALIMAT PANJANG ECALYPTUS ---
    const processPlanningText = (rawText) => {
        const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
        const cleanCase = (str) => { if (!str) return ''; return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase()); };

        let finalPlanning = [];
        let prescriptionList = [];
        const lines = rawText.split('\n');

        lines.forEach((line, index) => {
            // Bersihkan bullet point bawaan ecal jika ada di awal teks copas
            let trimmed = line.trim().replace(/^[•\-\*\u2022\.]+\s*/, '');
            if (!trimmed) return;
            const lowerLine = trimmed.toLowerCase();
            if (lowerLine.match(/nama obat|nama resep|aturan pakai|cara penggunaan|no\. resep|^resep -|^-$|^_$/)) return;

            let isMedicine = false;
            let drugName = '';
            let dosage = '';
            
            // LOGIKA DETEKSI FREKUENSI OBAT
            const tableMatch = trimmed.match(/(\d+)\s*dd\s*(\d+)/i);
            const manualMatch = trimmed.match(/(.*?)\s+(\d+\s*[xX]\s*[\d\.,]+.*)/);
            const infusMatch = trimmed.match(/(.*?)\s+(\d+\s*(?:tpm|cc\/jam|ml\/jam|tetes))/i);
            const nebuMatch = trimmed.match(/(?:nebu|inhalasi|uap)\s+(.*)/i);
            const freqMatch = trimmed.match(/(.*?)\s+(\/\s*\d+\s*(?:jam|j)|k\/p|prn)/i);

            if (tableMatch) {
                if (index > 0) {
                    let prevLine = lines[index - 1].trim().replace(/^[•\-\*\u2022\.]+\s*/, '').replace(/Nama Obat|No\. Resep|-/gi, '').trim();
                    if (prevLine.length > 2) { drugName = prevLine; dosage = `${tableMatch[1]}x${tableMatch[2]}`; isMedicine = true; }
                }
            } 
            else if (manualMatch) { drugName = manualMatch[1].trim(); dosage = manualMatch[2].trim().replace(/\s*[xX]\s*/, 'x'); if (drugName.length > 2) isMedicine = true; }
            else if (infusMatch) { drugName = infusMatch[1].trim(); dosage = infusMatch[2].trim(); if (!drugName) drugName = "Cairan Infus"; isMedicine = true; }
            else if (nebuMatch) { drugName = "Nebu " + nebuMatch[1].trim(); dosage = "Sesuai Jadwal"; isMedicine = true; }
            else if (freqMatch) { drugName = freqMatch[1].trim(); dosage = freqMatch[2].trim(); if (drugName.length > 2) isMedicine = true; }

            if (isMedicine) {
                let cleanMed = drugName.toLowerCase().trim();

                // 1. Jalankan Kamus Penerjemah Singkatan dari constants.js
                Object.keys(MEDICATION_TRANSLATOR).forEach(key => {
                    if (cleanMed.includes(key)) {
                        cleanMed = cleanMed.replace(new RegExp(key, 'g'), MEDICATION_TRANSLATOR[key]);
                    }
                });

                // ============================================================
                // 🧠 OPTIMASI BARU: SMART ROUTE DETECTOR (IV vs p.o vs Inhalasi)
                // ============================================================
                let routeSuffix = '';
                const lowerTextForRoute = cleanMed.toLowerCase();
                
                const isSyrup = /(?:sirup|syr)\b/.test(lowerTextForRoute);
                const isNebu = /(?:nebu|nebulizer|inhalasi|uap|respule|combiven|pulmicort)/.test(lowerTextForRoute);

                // Pemilahan Rute Cerdas
                if (isNebu) {
                    routeSuffix = ' (Inhalasi)'; // Otomatis mengunci rute uap/inhalasi
                } else if (/(?:inj|iv|i\.v\.|im|i\.m\.|vial|ampul|amp|drip|infus|inf|lar\s*inf|mg\/ml)/.test(lowerTextForRoute)) {
                    routeSuffix = ' (Iv)';
                } else if (isSyrup) {
                    routeSuffix = ''; // ✨ SELERAMU: Sengaja KOSONG karena teks 'Sirup/Syr' akan kita pertahankan utuh!
                } else if (/(?:tab|tablet|kaps|kapsul|po|p\.o\.|caps|oral|disp)/.test(lowerTextForRoute)) {
                    routeSuffix = ' (p.o)';
                }

                // C. Bersihkan segala bentuk kurung bawaan ecalyptus (seperti (I.V) atau (P.O)) agar tidak dobel
                cleanMed = cleanMed.replace(/\([^)]*\)/g, '');

                // 4. ✨ POTONG SPESIFIKASI KEMASAN & UNGKAPAN MEDIS BERULANG
                cleanMed = cleanMed
                    // ⚠️ Perhatikan: 'sirup' dan 'syr' DIHAPUS dari daftar replace ini agar teksnya tetap bertahan di layar!
                    // ⚠️ Kata 'nebu' dan 'nebulizer' DIMASUKKAN ke sini agar teks depannya bersih karena sudah diganti suffix belakang.
                    .replace(/\b(serb\s*inj|inj(?=\s*\d)|kaps|tab|lar\s*inf|drips\s*\(infus\)|drips|infus(?=\s*\d)|vial|udv|otsuka|ampul|amp|nebu|nebulizer)\b\.?/gi, '')
                    .replace(/\b1000\s*mg\/vial|1000mg\/vial|1000\s*mg\b/gi, '1 gr')
                    .replace(/\b\d+(?:[.,]\d+)?\s*mg\/ml\b/gi, '') // Potong angka konsentrasi (misal 2 Mg/ml)
                    .replace(/mg\/ml/gi, '')           // Potong sisa teks mg/ml
                    .replace(/[\/,\s\-]+$/, '')        // Cukur bersih sisa garis miring/strip di akhir
                    .replace(/\s+/g, ' ')
                    .trim();

                let finalDrugName = toTitleCase(cleanMed) + routeSuffix;
                
                // Masukkan prefiks 'Th.' lurus ke bawah per enter agar terbaca sistem Multiuser & Hari Antibiotik
                prescriptionList.push(`- ${finalDrugName} (${dosage.replace(/\s+/g, '')})`); 
            } 
            else { 
                const nextLine = lines[index + 1] || '';
                if (!nextLine.match(/(\d+)\s*dd\s*(\d+)/i)) { finalPlanning.push(cleanCase(trimmed)); }
            }
        });

        let resultP = "";
        // Hanya masukkan non-obat ke planning
        if (finalPlanning.length > 0) resultP += finalPlanning.join('\n').trim();

        // ✨ REDIREKSI RESEP OBAT: Masukkan ke currentPrescription (persisten), bukan planning
        if (prescriptionList.length > 0) {
            const newRxText = prescriptionList.join('\n');
            const currentRx = formData.currentPrescription || '';
            if (currentRx.trim()) {
                handleInputChange({ target: { name: 'currentPrescription', value: `${newRxText}\n\n${currentRx.trim()}` } });
            } else {
                handleInputChange({ target: { name: 'currentPrescription', value: newRxText } });
            }
        }

        const currentP = formData.planning || '';
        if (currentP.trim()) {
            handleInputChange({ target: { name: 'planning', value: resultP ? `${resultP}\n\n${currentP.trim()}` : currentP.trim() } });
        } else {
            if (resultP) handleInputChange({ target: { name: 'planning', value: resultP } });
        }
    };

    // --- [UPDATE V12] SMART LAB: FULL TEXT PARSER & KUALITATIF SUPPORT ---
    const processLabData = () => {
        if (!rawLabData) return;
        
        // 3. KAMUS GLOBAL
        const globalSources = [...(typeof LAB_CHECKS !== 'undefined' ? LAB_CHECKS : []), ...(typeof RADIOLOGY_CHECKS !== 'undefined' ? RADIOLOGY_CHECKS : [])];
        const dynamicDictionary = globalSources.flatMap(item => {
            return item.split(/[\/,]/).map(part => {
                let cleanKey = part.replace(/\(.*\)/, '').trim();
                if (!cleanKey || cleanKey.length < 2) return null;
                const escapedKey = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return { key: cleanKey, reg: new RegExp(escapedKey, 'i') };
            }).filter(Boolean);
        });

        const formattedLabDictionary = LAB_DICTIONARY.map(item => ({
            key: item.name,
            reg: new RegExp(`(?:${item.keywords.join('|')})`, 'i')
        }));

        const combinedDictionary = [...formattedLabDictionary, ...dynamicDictionary];
        let results = [];
        let pendingName = null; 

        // 4. PROSES BARIS DEMI BARIS
        const lines = rawLabData.split('\n').map(l => l.trim()).filter(l => l);

        lines.forEach(line => {
            // A. BERSIHKAN SAMPAH HEADER ECALYPTUS
            if (/Mikrobiologi|Kimia|Hematologi|Imuno|Rincian Tindakan|Satuan|Nilai Rujukan|Status|Riwayat/i.test(line)) {
                return; 
            }

            let cleanLine = line
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/(High|Low|\(H\)|\(L\)|\*|mg\/dL|mmol\/L|g\/dL|u\/L|%)/gi, '') 
                .replace(/Normal|Rujukan|Nilai/gi, '') 
                .trim();

            if (!cleanLine) return;

            // B. DETEKSI NAMA TES
            let foundKey = null;
            let usedKeyString = ''; 

            for (let item of combinedDictionary) {
                if (item.reg.test(cleanLine)) { 
                    foundKey = item.key; 
                    const match = cleanLine.match(item.reg);
                    if(match) usedKeyString = match[0];
                    break; 
                }
            }
            
            // Mode Belajar (Generic)
            if (!foundKey) {
                const isGarbage = /satuan|hasil|metode|keterangan|pemeriksaan|analisa|dokter|tanda tangan|verifikasi/i.test(cleanLine);
                const isResultKeyword = /(?:Positif|Negatif|Reaktif|Non|Detected|Tidak|Resistan|Sensitif|Sensitive|Resistance|Terlampir|Ditemukan)/i.test(cleanLine);
                const hasNumber = /\d/.test(cleanLine);
                
                if (!hasNumber && !isGarbage && !isResultKeyword && cleanLine.length < 35 && cleanLine.length > 2) {
                    foundKey = cleanLine; 
                    usedKeyString = cleanLine;
                }
            }

            // --- FUNGSI PENCARI NILAI (DESCRIPTIVE FULL TEXT) ---
            // ✨ FIX FINAL: Masukkan Tubex dan Troponin ke daftar ini agar disedot seutuhnya!
            const descriptiveTests = ['Gram', 'Sputum', 'Kultur', 'TCM', 'Ag', 'PCR', 'HBeAg', 'HBsAg', 'HIV', 'LED', 'CRP', 'Procal', 'Ferritin', 'CD4', 'MDT', 'Tubex', 'Troponin', 'Trop'];
            
            const findValue = (text, keyName) => {
                const hasNumber = /\d/.test(text);
                const hasResultWord = /(?:Non[- ]?Reaktif|Positif|Negatif|Reaktif|Non|Detected|Tidak|Resistan|Sensitif|Sensitive|Resistance|Terlampir)/i.test(text);

                if (keyName && descriptiveTests.some(dt => keyName.toLowerCase().includes(dt.toLowerCase()))) {
                    // ✨ FIX: Hanya buang karakter titik dua (:) atau sama dengan (=) di awal teks, jangan yang di tengah!
                    const descVal = text.replace(/^[:=\s]+/, '').trim(); 
                    if (descVal.match(/dengan Reagen/i) && descVal.length < 20) return null; 
                    
                    // ✨ PROTEKSI: Pastikan baris ini benar-benar hasil (mengandung angka atau kata hasil), bukan sisa nama tes
                    if (!hasNumber && !hasResultWord) return null;

                    if (descVal.length < 2) return null; 
                    return descVal; 
                }

                const numMatch = text.match(/(\d{1,5}(?:[\.,']\d+)?)/);
                const isRange = /-|–|<|>/.test(text); 
                const isDate = /\/|:/.test(text); 
                if (numMatch && !isRange && !isDate) return numMatch[0];

                const textMatch = text.match(/(?:Non[- ]?Reaktif|Positif|Negatif|Reaktif|Non|Detected|Tidak|Resistan|Sensitif|Sensitive|Resistance|Terlampir|\+\+\+|\+\+|\+)/i);
                if (textMatch) return textMatch[0];

                return null;
            };

            if (foundKey) {
                pendingName = foundKey;
                let textWithoutKey = cleanLine.replace(usedKeyString, '').trim();
                const val = findValue(textWithoutKey, foundKey);

                if (!val && usedKeyString && cleanLine.startsWith(usedKeyString)) {
                    const remaining = cleanLine.slice(usedKeyString.length).trim();
                    const numMatch = remaining.match(/^(\d{2,5}(?:[\.,']\d+)?)/);
                    if (numMatch) {
                        results.push(`${pendingName} ${numMatch[1]}`);
                        pendingName = null;
                        return;
                    }
                }

                if (val) {
                    results.push(`${pendingName} ${val}`);
                    pendingName = null;
                }
            }
            else if (pendingName) {
                const val = findValue(cleanLine, pendingName);
                if (val) {
                    results.push(`${pendingName} ${val}`);
                    pendingName = null; 
                }
            }
        });

        if (results.length > 0) {
            const uniqueResults = [...new Set(results)];
            const finalString = "Lab:\n" + uniqueResults.join('\n');
            appendText('objective', finalString);
        } else {
             if (confirm("Format tidak terbaca otomatis. Tempel teks mentah saja?")) {
                 appendText('objective', "Lab (Raw):\n" + rawLabData);
             }
        }

        setRawLabData('');
        setShowLabModal(false);
    };

    const processRadData = () => {
        if (!rawRadData.trim()) return;
        let cleanText = rawRadData.trim();
        appendText('objective', `Rad:\n${cleanText}`);
        setRawRadData(''); setShowRadModal(false);
    };

    const handleQuickAction = (action) => {
        const tempRec = {
            ...formData, id: currentRecordId || 'temp', roomNumber: formData.roomNumber, name: formData.name, dpjpName: formData.dpjpName
        };
        if (action === 'print') setSelectedRecordForPrint(tempRec);
        if (action === 'lapor') setRecordForLapor(tempRec);
        if (action === 'discharge') handleDischarge(currentRecordId, formData.name, formData.roomNumber);
    };

    const handleClearSoap = () => {
        if(window.confirm("Kosongkan semua kolom SOAP & Lampiran untuk operan baru?\n\n⚠️ Resep Obat (currentPrescription) TIDAK akan dihapus.")) {
            // Hanya bersihkan S, O, A, P, dan Lampiran.
            // currentPrescription sengaja TIDAK disentuh agar tetap persisten.
            handleInputChange({ target: { name: 'subjective', value: '' } });
            handleInputChange({ target: { name: 'objective', value: '' } });
            handleInputChange({ target: { name: 'analysis', value: '' } });
            handleInputChange({ target: { name: 'planning', value: '' } });
            handleInputChange({ target: { name: 'evidenceImages', value: [] } });
            alert("SOAP & Lampiran dibersihkan.\n✅ Resep Obat tetap tersimpan.");
        }
    };

    const priorityDocs = ["dr. Delvi, Sp.PD", "dr. Dian Ekowati, Sp.PD", "dr. Evan, Sp.P", "dr. Priyo, Sp.PD", "dr. Risa, Sp.PD", "dr. Susilo, Sp.PD"];
    const sortedDpjpOptions = [...(dpjpOptions || [])].sort((a, b) => {
        const idxA = priorityDocs.indexOf(a);
        const idxB = priorityDocs.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.toString().localeCompare(b.toString());
    });

    // --- RENDER UTAMA ---
    return (
        <div className="h-full bg-white border-l border-gray-300 flex flex-col shadow-xl relative overflow-hidden">
            
            {/* A. HEADER BARU */}
            <div className="px-3 py-2 border-b flex justify-between items-center bg-gray-50 shadow-sm z-20 flex-shrink-0 relative">
                <div className="leading-tight overflow-hidden mr-2 flex items-center gap-2">
                    <div>
                        <h2 className="font-bold text-xs text-gray-800 truncate max-w-[150px]">
                            {isEditing ? formData.name : 'Pasien Baru'}
                        </h2>
                        <p className="text-[9px] text-gray-500 font-bold">{formData.roomNumber || 'Pilih Kamar'}</p>
                    </div>
                    {/* ✨ BALON TIP REAL-TIME MULTIUSER DI SINI */}
                    {coEditors.length > 0 && (
                        <div className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse flex items-center shadow-sm">
                            👀 {coEditors.join(', ')} sedang membuka ini
                        </div>
                    )}
                </div>                
                <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* BAGIAN Tombol Edit (Hanya Muncul Jika isEditing true) */}
                {isEditing && (
                    <>                       
                        {/* ✨ TOMBOL TUKAR BED DI HEADER SOAP */}
                        <button 
                            type="button" 
                            onClick={() => onSwapBed && onSwapBed({ id: currentRecordId, name: formData.name, roomNumber: formData.roomNumber })} 
                            className="p-1.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] shadow-sm hover:bg-indigo-200" 
                            title="Tukar/Pindah Bed"
                        >
                            🔀
                        </button>
                        <button type="button" onClick={() => handleQuickAction('lapor')} className="p-1.5 bg-green-100 text-green-700 border border-green-200 rounded text-[10px] shadow-sm hover:bg-green-200" title="Draft Lapor">📱</button>
                        <button type="button" onClick={() => handleQuickAction('print')} className="p-1.5 bg-gray-100 text-gray-700 border border-gray-200 rounded text-[10px] shadow-sm hover:bg-gray-200" title="Print (Ctrl+P)">🖨️</button>
                        <button type="button" onClick={() => handleQuickAction('discharge')} className="p-1.5 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] shadow-sm hover:bg-red-100" title="Keluar">🚪</button>
                        
                        {handleDeleteRecord && (
                            <button type="button" onClick={() => handleDeleteRecord(currentRecordId, formData.name)} className="p-1.5 bg-red-600 text-white border border-red-700 rounded text-[10px] shadow-sm hover:bg-red-800" title="Hapus Data Permanen">🗑️</button>
                        )}
                        <div className="h-5 w-[1px] bg-gray-300 mx-1"></div>
                    </>
                )}

                {/* Tombol Simpan & Tutup (Muncul Selalu) */}
                <button 
                    onClick={handleSubmit} 
                    disabled={loading || !isFormReady} 
                    className={`p-1.5 rounded text-white shadow-sm transition flex items-center justify-center ${loading || !isFormReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    title="Simpan Data (Ctrl+S)"
                >
                    {loading ? '...' : '💾'}
                </button>
                <button onClick={() => { setShowInputModal(false); resetForm(); }} className="p-1.5 bg-white text-gray-400 border border-gray-200 rounded hover:bg-red-50 hover:text-red-500 transition shadow-sm" title="Tutup (Esc)">
                    ✕
                </button>
            </div>
            </div>
            
            {/* B. AREA SCROLL FORM */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-gray-50/50 relative z-0">
                <div className="p-4">
                    {/* 1. Form Identitas */}
                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-3">
                        <form onSubmit={handleSubmit} id="mainForm">
                            
                            {/* --- BARIS 1: RESPONSIVE GRID (HP & LAPTOP AMAN) --- */}
                            <div className="flex space-x-2 mb-2 items-start">                                
                                {/* KOLOM 1: GENDER */}
                                <div className="w-[15%] relative">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Gender *</label>
                                    <select 
                                        className="w-full p-2 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 bg-white h-[34px]" 
                                        value={formData.gender} 
                                        onChange={(e) => handleInputChange({ target: { name: 'gender', value: e.target.value } })} 
                                        required
                                    >
                                        <option value="" disabled>-</option>
                                        <option value="L">Lk</option>
                                        <option value="P">Pr</option>
                                    </select>
                                </div>

                                {/* KOLOM 2: NO. RM */}
                                <div className="w-[25%] relative">
                                    <CustomInput 
                                        label="No. RM" 
                                        name="rmNumber" 
                                        value={formData.rmNumber || ''} 
                                        onChange={handleInputChange} 
                                        placeholder="123456" 
                                    />
                                </div>

                                {/* KOLOM 3: KELAS (BARU) */}
                                <div className="w-[20%] relative">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Kls</label>
                                    <select 
                                        className="w-full p-2 text-[11px] border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 bg-white h-[34px]" 
                                        value={formData.bpjsClass || ''} 
                                        onChange={(e) => handleInputChange({ target: { name: 'bpjsClass', value: e.target.value } })} 
                                    >
                                        <option value="">-</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="Umum">Umum</option>
                                    </select>
                                </div>

                                {/* KOLOM 4: TGL MASUK (FIXED: LANGSUNG MASUK MEMORI) */}
                                <div className="w-[40%] relative">
                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Tgl Masuk</label>
                                    <input 
                                        type="text" 
                                        // Controlled value: Jika berisi format database (-) ubah ke tampilan biasa, jika sedang diketik biarkan apa adanya
                                        value={formData.admissionDate ? (formData.admissionDate.includes('-') ? formatDateCM(formData.admissionDate) : formData.admissionDate) : ''}
                                        onChange={(e) => {
                                            handleDateMasking(e); // Jalankan auto-format garis miring
                                            handleInputChange({ target: { name: 'admissionDate', value: e.target.value } }); // Langsung rekam ke memori
                                        }}
                                        className="w-full p-2 text-xs border border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-indigo-500 font-mono bg-white outline-none h-[34px]" 
                                        placeholder="dd/mm/yyyy, hh:mm" 
                                    />
                                </div>
                            </div>

                            {/* --- BARIS 2: NAMA PASIEN | DPJP UTAMA --- */}
                            <div className="flex space-x-2 mb-2 items-start">
                                {/* KOLOM 1: KM */}
                                <div className="w-[20%] relative">
                                    <CustomSelect 
                                        label="Km" 
                                        value={formData.roomNumber} 
                                        onChange={(e) => handleInputChange({ target: { name: 'roomNumber', value: e.target.value } })} 
                                        options={availableRooms} 
                                    />
                                </div>
                                <div className="w-[40%] relative">
                                    <CustomInput 
                                        label="Nama Pasien *" 
                                        name="name" 
                                        value={formData.name} 
                                        onChange={handleInputChange} 
                                        required 
                                    />
                                    
                                    {/* SUGGESTION LIST PASIEN LAMA */}
                                    {archivedMatches && archivedMatches.length > 0 && (formData.name.length > 0 || formData.rmNumber.length > 0) && !hideSuggestion && (
                                        <div className="absolute z-50 w-full bg-white border-2 border-indigo-500 shadow-2xl rounded-md mt-[-8px] max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                                            
                                            {/* HEADER DITAMBAH STICKY & TOMBOL ABAIKAN */}
                                            <div className="bg-indigo-600 px-2 py-1 text-[9px] font-bold text-white flex justify-between items-center sticky top-0 z-10">
                                                <span>📂 PASIEN LAMA TERDETEKSI</span>
                                                <div className="flex gap-1 items-center">
                                                    <span className="bg-white text-indigo-600 px-1 rounded text-[8px] h-fit flex items-center">ARSIP</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setHideSuggestion(true); 
                                                        }}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm text-[8px] transition cursor-pointer"
                                                    >
                                                        ✕ Abaikan
                                                    </button>
                                                </div>
                                            </div>

                                            {archivedMatches.map(old => (
                                                <div 
                                                    key={old.id} 
                                                    onClick={() => {
                                                        handleInputChange({ target: { name: 'name', value: old.name } });
                                                        handleInputChange({ target: { name: 'rmNumber', value: old.rmNumber || '' } });
                                                        handleInputChange({ target: { name: 'gender', value: old.gender || '' } });
                                                        handleInputChange({ target: { name: 'bpjsClass', value: old.bpjsClass || '' } });
                                                        setHideSuggestion(true);
                                                        alert(`Biodata ${old.name} ditarik. Silakan tentukan DPJP hari ini.`);
                                                    }}
                                                    className="p-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors"
                                                >
                                                    <div className="text-[10px] font-bold text-indigo-900 uppercase">{old.name}</div>
                                                    <div className="text-[9px] text-gray-500 font-mono">
                                                    RM: {old.rmNumber || '-'} | {old.gender === 'L' ? 'Lk' : 'Pr'} | {old.bpjsClass ? `Kls: ${old.bpjsClass}` : 'UMUM'} | Terakhir: {new Date(old.admissionDate).toLocaleDateString('id-ID')}
                                                </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="w-[40%]">
                                    <CustomSelect 
                                        label="DPJP Utama *" 
                                        value={formData.dpjpName} 
                                        onChange={(e) => handleInputChange({ target: { name: 'dpjpName', value: e.target.value } })} 
                                        options={sortedDpjpOptions} 
                                        required
                                    />
                                </div>
                            </div>

                            {/* --- BARIS 3 (BARU): RABER 1 & RABER 2 (BERJEJER KE SAMPING) --- */}
                            <div className="flex space-x-2 mt-1 min-h-[40px]">
                                {/* KOLOM KIRI (DI BAWAH NAMA PASIEN) */}
                                <div className="w-1/2">
                                    {showRaber1 ? (
                                        <div className="relative">
                                            <CustomSelect 
                                                label="Raber 1" 
                                                value={formData.raberName} 
                                                onChange={(e) => handleInputChange({ target: { name: 'raberName', value: e.target.value } })} 
                                                options={dpjpOptions} 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => { setShowRaber1(false); handleInputChange({ target: { name: 'raberName', value: '' } }); }} 
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition"
                                            >✕</button>
                                        </div>
                                    ) : (
                                        <button 
                                            type="button" 
                                            onClick={() => setShowRaber1(true)} 
                                            className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2"
                                        >+ Tambah Raber 1</button>
                                    )}
                                </div>

                                {/* KOLOM KANAN (DI BAWAH DPJP UTAMA) */}
                                <div className="w-1/2">
                                    {showRaber1 && (
                                        showRaber2 ? (
                                            <div className="relative">
                                                <CustomSelect 
                                                    label="Raber 2" 
                                                    value={formData.raber2Name} 
                                                    onChange={(e) => handleInputChange({ target: { name: 'raber2Name', value: e.target.value } })} 
                                                    options={dpjpOptions} 
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setShowRaber2(false); handleInputChange({ target: { name: 'raber2Name', value: '' } }); }} 
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition"
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={() => setShowRaber2(true)} 
                                                className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2"
                                            >+ Tambah Raber 2</button>
                                        )
                                    )}
                                </div>
                            </div>                            
                        </form>
                    </div>

                    {/* 2. SOAP Fields */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1 mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Catatan SOAP Hari Ini</span>
                            <div className="flex gap-1">                                
                                <button type="button" onClick={() => setShowSmartPaste(true)} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded border border-indigo-700 hover:bg-indigo-700 transition font-bold shadow-sm flex items-center animate-pulse">
                                    ⚡ Paste
                                </button>
                                <button type="button" onClick={handleClearSoap} className="text-[9px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm">
                                    🗑️ Reset
                                </button>
                            </div>
                        </div>

                        {/* --- URUTAN BARU: A - P - O - S --- */}

                        <CustomTextArea 
                            label="A (Analisa) / Dx:" 
                            name="analysis" 
                            value={formData.analysis} 
                            onChange={handleInputChange} 
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('analysis') : null} 
                            pullLabel="Salin A Lalu" 
                            // ✨ TAMBAHKAN BUTTON RESET PARSIAL DI SINI:
                            extraButtons={
                                <button 
                                    type="button" 
                                    onClick={() => handleInputChange({ target: { name: 'analysis', value: '' } })} 
                                    className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm"
                                >
                                    🗑️ Reset A
                                </button>
                            }
                        />
                        
                        <CustomTextArea 
                            label="P (Planning)" 
                            name="planning" 
                            value={formData.planning} 
                            onChange={handleInputChange}
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('planning') : null} 
                            pullLabel="Tarik P"
                            // ✨ TAMBAHKAN BUTTON RESET PARSIAL DI SINI:
                            extraButtons={
                                <button 
                                    type="button" 
                                    onClick={() => handleInputChange({ target: { name: 'planning', value: '' } })} 
                                    className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm"
                                >
                                    🗑️ Reset P
                                </button>
                            }
                        >
                            {/* ✨ PANGKAT DINAMIS: Default z-20, tapi saat diklik ngetik naik pangkat ke z-50 agar list dropdown di image_7a01a5.png tidak tertutup */}
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded relative z-20 focus-within:z-50 transition-all">
                                <PlanningQuickTag onSelect={(text) => appendText('planning', text)} />

                                <TagSelector 
                                    label="Smart Planning" 
                                    placeholder="Ketik Lab, Rad, Obat, Protokol..." 
                                    options={ALL_PLANNING_OPTIONS.map(o => o.label)} 
                                    category="SmartPlan"
                                    onSelect={(cat, itemLabel) => {
                                        const found = ALL_PLANNING_OPTIONS.find(o => o.label === itemLabel);
                                        if (found && found.type === 'Protocol') {
                                            // ✨ FIX: Khusus protokol panjang, buat baris baru murni di atas teks lama
                                            setFormData(prev => {
                                                const current = prev.planning || '';
                                                return { ...prev, planning: current.trim() ? `${found.isi.trim()}\n\n${current.trim()}` : found.isi.trim() };
                                            });
                                        } else {
                                            const type = found ? found.type : 'Rx';
                                            let prefix = type === 'Lab' ? 'Lab. R/ ' : type === 'Rad' ? 'Rad. R/ ' : type === 'Med' ? 'TM. ' : 'Th. ';
                                            appendText('planning', `${prefix}${itemLabel}`);
                                        }
                                    }} 
                                />
                            </div>
                        </CustomTextArea>

                        {/* ⚡ TOMBOL PEMINDAH CEPAT (P -> O) */}
                        {itemsToMove.length > 0 && (
                            <div className="mb-2 bg-indigo-50 border border-indigo-200 rounded-lg p-2 shadow-sm animate-in fade-in slide-in-from-top-2">
                                <span className="text-[10px] font-bold text-indigo-800 flex items-center gap-1 mb-1.5">
                                    ⚡ Klik untuk menarik rencana Lab/Rad ke Objektif saat ini:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {itemsToMove.map((item, idx) => (
                                        <button 
                                            key={idx}
                                            type="button"
                                            onClick={() => handleMoveToObjective(item.text, item.type)}
                                            className={`text-[9px] px-2 py-1 rounded border font-bold shadow-sm transition flex items-center gap-1 hover:scale-105 active:scale-95 ${
                                                item.type === 'Lab' 
                                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                                : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                            }`}
                                            title={`Tarik ${item.text} ke Objektif`}
                                        >
                                            {item.type === 'Lab' ? '🧪' : '☢️'} {item.text} ➔
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* 💊 SUB-PLANNING KHUSUS RESEP OBAT (PERSISTEN / TIDAK DIRESET) */}
                        {/* ============================================================ */}                        
                        {/* ✨ PANGKAT DINAMIS: Default z-10 di bawah planning, tapi saat di-hover/diklik naik pangkat ke z-40 agar balon CPO bisa terbang ke atas bebas */}
                        <div className="bg-rose-50 border border-rose-200 rounded-lg shadow-sm relative z-10 hover:z-40 focus-within:z-40 transition-all">
                            
                            {/* ✨ FIX UI: Menambahkan 'rounded-t-lg' di sini agar sudut header tetap melengkung rapi */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-rose-100 border-b border-rose-200 rounded-t-lg">
                                <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1.5">
                                    💊 Resep Obat
                                    <span className="bg-rose-600 text-white text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                        PERSISTEN
                                    </span>
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-rose-500 italic">
                                        Tidak ikut terhapus saat SOAP direset
                                    </span>

                                    {/* ✨ TAMBAHKAN TOMBOL RESET RESEP PATEN DI SINI: */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if(window.confirm("⚠️ PENTING: Anda yakin ingin menghapus seluruh daftar Resep Obat Paten/Persisten pasien ini?")) {
                                                handleInputChange({ target: { name: 'currentPrescription', value: '' } });
                                            }
                                        }}
                                        className="text-[9px] px-2 py-0.5 rounded border font-bold shadow-sm transition bg-red-50 text-red-700 border-red-300 hover:bg-red-600 hover:text-white"
                                        title="Reset khusus kolom resep obat paten"
                                    >
                                        🗑️ Reset Obat
                                    </button>
                                    
                                    {isEditing && (() => {
                                        const combinedPlanAndRx = `${formData.planning || ''}\n${formData.currentPrescription || ''}`;
                                        const abMeds = combinedPlanAndRx.split('\n')
                                            .map(line => line.trim().replace(/^[-*\u2022\d.]+\s*/, ''))
                                            .filter(line => line.length > 2 && (ANTIBIOTICS_DB.some(ab => line.toLowerCase().includes(ab)) || /\bH\d+\b/i.test(line)));
                                        
                                        return (
                                            <div className="relative flex items-center">
                                                {/* 🎈 Balon Antibiotik sekarang aman terbang ke atas tanpa kepotong */}
                                                {abMeds.length > 0 && (
                                                    <div className="absolute bottom-full right-0 mb-1.5 bg-rose-600 text-white text-[9px] font-bold p-1.5 rounded-md shadow-lg flex flex-col items-end z-50 min-w-max border border-rose-700 animate-in slide-in-from-bottom-2 duration-300">
                                                        {abMeds.map((med, idx) => {
                                                            let cleanMed = med.replace(/^(?:inj|tab|drip|inf|fls|syr)\.?\s+/i, '');
                                                            let rawName = cleanMed.split(/\s*\d+\s*x|\s+x\s*\d+|\s*\d+\s*(?:mg|gr|g|mcg|ml|iu)/i)[0].trim().substring(0, 14);
                                                            rawName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
                                                            const hCode = getAntibioticDay(med, formData.medicationLogs) || 'H1';
                                                            
                                                            return (
                                                                <div key={idx} className="whitespace-nowrap leading-tight flex items-center gap-1.5 mb-0.5 last:mb-0">
                                                                    <span className="text-white tracking-wide">{rawName}</span> 
                                                                    <span className="bg-white text-rose-700 px-1 py-[1px] rounded-[3px] text-[8px] font-black">{hCode}</span>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="absolute -bottom-1 right-3 w-2 h-2 bg-rose-600 rotate-45 border-r border-b border-rose-700"></div>
                                                    </div>
                                                )}
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!currentRecordId) {
                                                            alert("⚠️ Simpan data pasien terlebih dahulu sebelum membuka CPO.");
                                                            return;
                                                        }
                                                        if (typeof onOpenMarModal !== 'function') {
                                                            alert("⚠️ Kabel onOpenMarModal belum terpasang.");
                                                            return;
                                                        }
                                                        const safeActiveRecords = activeRecords || [];
                                                        const trueRecord = safeActiveRecords.find(r => r.id === currentRecordId);
                                                        onOpenMarModal(trueRecord || { ...formData, id: currentRecordId });
                                                    }}
                                                    className="text-[9px] px-2 py-0.5 rounded border font-bold shadow-sm transition bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                                                    title="Catatan Pemberian Obat (dari Resep Persisten)"
                                                >
                                                    💊 CPO
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            
                            <CustomTextArea
                                label=""
                                name="currentPrescription"
                                value={formData.currentPrescription || ''}
                                onChange={handleInputChange}
                            />
                        </div>
                        
                        <CustomTextArea label="O (Objektif)" name="objective" value={formData.objective} onChange={handleInputChange}
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('objective') : null} pullLabel="Salin O Lalu"
                            extraButtons={
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => setShowLabModal(true)} className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition font-bold shadow-sm">🧪 Lab</button>
                                    <button type="button" onClick={() => setShowTtvModal(true)} className="text-[9px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 hover:bg-green-100 transition font-bold shadow-sm">+ TTV</button>
                                    <button 
                                        type="button" 
                                        onClick={() => handleInputChange({ target: { name: 'objective', value: '' } })} 
                                        className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm"
                                    >
                                        🗑️ Reset O
                                    </button>
                                </div>
                            } 
                        >
                            <div className="mt-2 p-2 bg-amber-100 border border-amber-100 rounded relative z-10">
                                <TagSelector label="" options={lacakOptions} placeholder="Lacak Lab/Rad..." category="Lacak" onSelect={(_, item) => appendText('objective', `Lacak/Lapor ${item}`)} /></div>
                            {/* --- TAMBAHAN BARU: MUNCUL DI BAWAH KOLOM OBJEKTIF --- */}
                            {formData.evidenceImages && formData.evidenceImages.length > 0 && (
                                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">🖼️ Lampiran Tersimpan:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.evidenceImages.map((img, idx) => (
                                            <img key={idx} src={img} className="w-10 h-10 object-cover rounded border shadow-sm cursor-pointer hover:scale-150 transition-transform origin-bottom-left" alt="Lampiran" title="Arahkan kursor untuk memperbesar" />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CustomTextArea>                       
                       
                        <CustomTextArea 
                            label="S (Subjektif)" 
                            name="subjective" 
                            value={formData.subjective} 
                            onChange={handleInputChange}
                            onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('subjective') : null} 
                            pullLabel="Salin S Lalu" 
                            // ✨ TAMBAHKAN BUTTON RESET PARSIAL DI SINI:
                            extraButtons={
                                <button 
                                    type="button" 
                                    onClick={() => handleInputChange({ target: { name: 'subjective', value: '' } })} 
                                    className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm"
                                >
                                    🗑️ Reset S
                                </button>
                            }
                        />
                    </div>
                    
                    {/* 📊 PLATFORM DATA PENUNJANG & PEMANTAUAN (LAB, TTV, RADIOLOGI SEJAJAR) */}
                    {isEditing && (
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-3">
                            
                            {/* 🛠️ MENU TAB KEMBAR TIGA SEJAJAR */}
                            <div className="flex border-b border-gray-200 bg-slate-50 sticky top-0 z-10">
                                <button
                                    type="button"
                                    onClick={() => setActiveHistoryTab('lab')}
                                    className={`py-2 px-4 text-[10px] font-bold border-b-2 transition-colors flex items-center gap-1 ${
                                        activeHistoryTab === 'lab' 
                                            ? 'border-indigo-500 text-indigo-600 bg-white font-extrabold' 
                                            : 'border-transparent text-gray-400 hover:text-gray-500'
                                    }`}
                                >
                                    🧪 Hasil Lab
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveHistoryTab('ttv')}
                                    className={`py-2 px-4 text-[10px] font-bold border-b-2 transition-colors flex items-center gap-1 ${
                                        activeHistoryTab === 'ttv' 
                                            ? 'border-emerald-500 text-emerald-600 bg-white font-extrabold' 
                                            : 'border-transparent text-gray-400 hover:text-gray-500'
                                    }`}
                                >
                                    📊 TTV / EWS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveHistoryTab('radiologi')}
                                    className={`py-2 px-4 text-[10px] font-bold border-b-2 transition-colors flex items-center gap-1 ${
                                        activeHistoryTab === 'radiologi' 
                                            ? 'border-amber-500 text-amber-600 bg-white font-extrabold' 
                                            : 'border-transparent text-gray-400 hover:text-gray-500'
                                    }`}
                                >
                                    📷 Radiologi & Gambar 
                                    <span className={`ml-1 px-1.5 py-0.2 text-[9px] rounded-full font-mono ${
                                        activeHistoryTab === 'radiologi' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'
                                    }`}>
                                        {formData.radiologyImages?.length || 0}
                                    </span>
                                </button>
                            </div>

                            {/* 📦 KONTEN ISI TAB (Tampil Bergantian Sesuai Pilihan) */}
                            <div className="p-3 min-h-[160px]">
                                
                                {/* 1. KONTEN TAB: LABORATORIUM */}
                                {activeHistoryTab === 'lab' && (
                                    <div className="animate-in fade-in duration-150">
                                        <LabHistoryTable record={{ objective: formData.objective, labHistory: formData.labHistory }} />
                                    </div>
                                )}

                                {/* 2. KONTEN TAB: TANDA-TANDA VITAL */}
                                {activeHistoryTab === 'ttv' && (
                                    <div className="animate-in fade-in duration-150">
                                        <TtvHistory objective={formData.objective} />
                                    </div>
                                )}

                                {/* 3. KONTEN TAB: RADIOLOGI & FOTO LAMPIRAN */}
                                {activeHistoryTab === 'radiologi' && (
                                    <div className="space-y-3 animate-in fade-in duration-150">
                                        
                                        {/* Quick Add Buttons Categories */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka', 'Lainnya'].map(cat => (
                                                <label key={cat} className="cursor-pointer">
                                                    <input type="file" accept="image/*" multiple className="hidden"
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files);
                                                            if (!files.length) return;
                                                            
                                                            const compressed = await Promise.all(files.map(f => compressImage(f)));
                                                            const now = new Date();
                                                            const newImages = compressed.map((imgUrl, idx) => ({
                                                                category: cat,
                                                                imageUrl: imgUrl,
                                                                date: now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                                                                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                                                                uploadedBy: (currentUser?.name || 'Perawat').split(' ')[0],
                                                                id: `img_${Date.now()}_${idx}`
                                                            }));
                                                            onAddRadiologyImage(newImages);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                    <span className="inline-block px-2 py-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition shadow-sm">
                                                        + {cat}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Gallery Grid List (Diubah ke format Baris agar ekspertise bisa dibaca) */}
                                        {formData.radiologyImages && formData.radiologyImages.length > 0 ? (
                                            <div className="flex flex-col gap-2 pt-2 border-t border-dashed border-gray-200">
                                                {formData.radiologyImages.map((img, idx) => {
                                                    const isExpertiseDoc = ['Rontgen', 'USG', 'CT Scan'].includes(img.category);
                                                    
                                                    return (
                                                        <div key={img.id || idx} className="flex gap-2.5 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm group">
                                                            {/* Thumbnail Kiri */}
                                                            <div className="relative shrink-0">
                                                                <img src={img.imageUrl} alt={img.category}
                                                                    className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 cursor-pointer hover:border-amber-400 transition shadow-sm"
                                                                    onClick={() => window.open(img.imageUrl, '_blank')}
                                                                    title={`${img.category} • ${img.uploadedBy}`}
                                                                />
                                                                <span className="absolute -top-1 -left-1 text-[8px] bg-amber-600 text-white px-1 rounded font-bold shadow-sm">
                                                                    {img.category.substring(0, 2)}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Konten Kanan */}
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-[9px] text-slate-500 font-bold">{img.category} • {img.date}</span>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => onRemoveRadiologyImage(img.id || img.imageUrl)}
                                                                        className="bg-red-50 text-red-500 hover:text-white hover:bg-red-500 rounded px-1.5 py-0.5 text-[8px] font-bold transition shadow-sm border border-red-100"
                                                                    >✕ Hapus</button>
                                                                </div>

                                                                {/* ✨ EKSKLUSIF: TAMPILKAN EKSPERTISE & TOMBOL TARIK KE (O) */}
                                                                {isExpertiseDoc && img.kesan ? (
                                                                    <div className="relative bg-slate-50 border border-slate-200 rounded p-1.5 pr-14 text-[10px] text-slate-700 leading-tight whitespace-pre-wrap font-medium">
                                                                        {img.kesan}
                                                                        
                                                                        {/* TOMBOL SAKTI: Salin ke O */}
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => {
                                                                                // Eksekusi penambahan ke form (O)
                                                                                appendText('objective', `${img.category} (${img.date}): ${img.kesan}`);
                                                                                alert(`✅ Ekspertise ${img.category} berhasil disalin ke kolom O (Objektif)!\n\nSilakan cek kolom O.`);
                                                                            }}
                                                                            className="absolute right-1 top-1 bottom-1 flex flex-col items-center justify-center px-1.5 bg-indigo-100 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded shadow-sm transition-all text-[8px] font-extrabold group-hover:ring-1 ring-indigo-400"
                                                                            title="Salin catatan ini ke kolom (O) Objektif"
                                                                        >
                                                                            <span className="text-xs">📥</span>
                                                                            <span>Ke (O)</span>
                                                                        </button>
                                                                    </div>
                                                                ) : isExpertiseDoc ? (
                                                                    <div className="text-[9px] text-slate-400 italic bg-slate-50 p-1.5 rounded border border-dashed border-slate-200">
                                                                        Belum ada ekspertise di-input dari layar Dashboard.
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-gray-400 italic text-[10px]">
                                                Belum ada berkas gambar atau pemeriksaan radiologi.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. RIWAYAT */}
                <div className="bg-gray-100 border-t border-gray-300 flex-1 flex flex-col min-h-[300px]">
                     <div className="p-3 bg-gray-200 border-b border-gray-300 shadow-inner">
                        <h3 className="text-[10px] font-bold text-gray-600 uppercase flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span>🕒 Riwayat Catatan ({historyLogs.length})</span>
                            </div>
                            <span className="text-[9px] font-normal italic text-gray-500">Scroll untuk melihat yg lama ⬇</span>
                        </h3>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-100">
                        {historyLogs && historyLogs.length > 0 ? (
                            historyLogs.map((log, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-300 text-[11px] shadow-sm relative group hover:border-indigo-300 transition">
                                    <div className="flex justify-between items-center mb-2 border-b pb-1 border-dashed border-gray-200">
                                        <div className="flex items-center space-x-2">
                                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">#{historyLogs.length - idx}</span>
                                            <span className="text-[9px] text-gray-400 font-mono">
                                                {log.updatedAt && log.updatedAt.seconds 
                                                    ? new Date(log.updatedAt.seconds * 1000).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
                                                    : log.updatedAt instanceof Date 
                                                        ? log.updatedAt.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')
                                                        : 'Baru saja'}
                                            </span>
                                            {/* --- LIVE BADGE SIGNATURE (NAMA AKUN) --- */}
                                            {log.savedBy && (
                                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tight">
                                                    👤 {log.savedBy.split(' ')[0]}
                                                </span>
                                            )}
                                            {/* ---------------------------------------- */}
                                        </div>
                                        <button type="button" onClick={() => setRecordForLapor(log)} className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded text-[9px] font-bold hover:bg-green-200 flex items-center transition">📱 WA</button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">S:</span> <span className="text-gray-700">{log.subjective || '-'}</span></div>
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">O:</span> <span className="text-gray-700">{log.objective || '-'}</span></div>
                                        {/* --- TAMBAHAN: TAMPILKAN GAMBAR DI RIWAYAT --- */}
                                        {log.evidenceImages && log.evidenceImages.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {log.evidenceImages.map((img, iIndex) => (
                                                    <img 
                                                        key={iIndex} 
                                                        src={img} 
                                                        className="w-12 h-12 object-cover rounded border border-gray-300 shadow-sm cursor-zoom-in hover:scale-110 transition-transform" 
                                                        alt="Lampiran Riwayat"
                                                        onClick={() => window.open(img, '_blank')} // Klik untuk lihat full-size
                                                        title="Klik untuk memperbesar"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">A:</span> <span className="text-gray-700">{log.analysis || '-'}</span></div>
                                        <div className="mt-1">
                                            <div className="flex gap-2 mb-1"><span className="font-bold text-red-600 w-3 shrink-0">P:</span></div>
                                            <div className="pl-5 p-1.5 bg-gray-50 rounded border border-gray-200 text-gray-600 font-mono text-[10px] whitespace-pre-wrap">{log.planning || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400 text-[10px] italic">Belum ada riwayat tercatat...</div>
                        )}
                        <div className="h-10"></div>
                    </div>
                </div>
            </div>

            {/* MODAL-MODAL PENDUKUNG */}
            {/* Modal Smart Paste */}
            {showSmartPaste && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl border-2 border-indigo-500 p-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">⚡ Smart Paste Ecalyptus</h3>
                            <button onClick={() => setShowSmartPaste(false)} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>
                        <div className="text-[10px] text-gray-600 mb-2 bg-blue-50 p-2 rounded border border-blue-100">1. Di Ecalyptus, Blok dari <b>"Subjektif"</b> s/d <b>Akhir Tabel Obat</b>.<br/>2. Copy (Ctrl+C).<br/>3. Paste di kotak bawah ini.</div>
                        <textarea className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none mb-3" placeholder="Paste teks Ecalyptus di sini..." value={rawPasteData} onChange={(e) => setRawPasteData(e.target.value)} autoFocus />
                        <div className="flex gap-2"><button onClick={() => setShowSmartPaste(false)} className="flex-1 py-2 text-xs border rounded hover:bg-gray-100">Batal</button><button onClick={handleProcessSmartPaste} className="flex-1 py-2 text-xs bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-md">Proses & Masukkan 🚀</button></div>
                    </div>
                </div>
            )}
            {/* Modal Lab */}
            {showLabModal && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-lg shadow-2xl border-2 border-blue-500 p-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">🧪 Paste Hasil Lab</h3><button onClick={() => setShowLabModal(false)} className="text-gray-400 hover:text-red-500">✕</button></div>
                        <div className="text-[10px] text-gray-600 mb-2 bg-blue-50 p-2 rounded border border-blue-100">Paste hasil lab mentah (GDS, Elektrolit, dll) di bawah.</div>
                        <textarea className="w-full h-32 border border-gray-300 rounded p-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none mb-3" placeholder="Contoh Paste:&#10;Gula Darah Sewaktu 199 High&#10;Natrium 137..." value={rawLabData} onChange={(e) => setRawLabData(e.target.value)} autoFocus />
                        <div className="flex gap-2"><button onClick={() => setShowLabModal(false)} className="flex-1 py-2 text-xs border rounded hover:bg-gray-100">Batal</button><button onClick={processLabData} className="flex-1 py-2 text-xs bg-blue-600 text-white font-bold rounded hover:bg-blue-700 shadow-md">Proses ke O ⬇️</button></div>
                        {/* LAMPIRAN FOTO (RONTGEN/LAB) MULTIPLE */}
                        <div className="mt-3 p-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
                            {/* HEADER LABEL & TOMBOL TARIK */}
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                                    📸 Lampiran Foto (Maks 3)
                                </label>
                                
                                {/* TOMBOL TARIK: Hanya muncul jika sedang mode Edit */}
                                {isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={() => pullDataForField('evidenceImages')}
                                        className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 font-bold transition shadow-sm"
                                    >
                                        ↺ Tarik Gambar Lama
                                    </button>
                                )}
                            </div>

                            <input 
                                type="file" 
                                accept="image/*" 
                                multiple  
                                onChange={handleMultiImageUpload}
                                className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2"
                            />
                            
                            {/* TAMPILAN GALLERY THUMBNAIL */}
                            {formData.evidenceImages && formData.evidenceImages.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {formData.evidenceImages.map((imgBase64, idx) => (
                                        <div key={idx} className="relative w-14 h-14">
                                            <img src={imgBase64} className="w-full h-full object-cover rounded border border-slate-300 shadow-sm" alt="Preview" />
                                            <button 
                                                type="button" 
                                                onClick={() => removeImage(idx)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center hover:bg-red-600 shadow-sm"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientForm;