import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatDateCM, hitungHariCM, getAntibioticDay, parsePlanning,
    isMatchDoctor, CustomInput, CustomTextArea, CustomSelect, TagSelector,
    PlanningQuickTag, buildRxLine, mergePrescriptionText } from '../utils/helpers';
import {
    doc, updateDoc, collection, addDoc, getDocs,
    Timestamp, query, where, deleteDoc, setDoc, onSnapshot, orderBy
} from 'firebase/firestore';
import {
    ref as storageRef, uploadString, getDownloadURL
} from 'firebase/storage';
import {
    X, Plus, Trash2, Eye, Calendar, Clock,
    FileText, CheckCircle, AlertCircle, RefreshCw,
    Upload, Image as ImageIcon, ChevronDown, ChevronUp,
    Check, CheckCheck, Paperclip, Camera
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
    defaultTab, showInputModal, setShowInputModal, handleSubmit, formData, handleInputChange, setFormData,
    resetForm, isEditing, currentRecordId, availableRooms, dpjpOptions,
    showRaber1, setShowRaber1, showRaber2, setShowRaber2, showRaber3, setShowRaber3, historyLogs,
    pullDataForField, setShowTtvModal, appendText, handleDischarge, setSelectedRecordForPrint,
    setRecordForLapor, isFormReady, loading, ALL_PLANNING_OPTIONS, handleDeleteRecord, masterLabs = [], masterRads = [], masterProcedures = [], masterMedications = [],
    archivedRecords = [], activeRecords = [], onOpenMarModal, db, currentUser, firebaseConfig,
    // ✨ GAMBAR RADIOLOGI props
    onAddRadiologyImage, onRemoveRadiologyImage, onSwapBed,
    allUsers = [],
    // 📞 PANGGILAN SUARA WEBRTC INTERKOM
    onStartCall
}) => {
    const [activeHistoryTab, setActiveHistoryTab] = useState('lab'); // 👈 Default tab pertama adalah Lab
    // ✨ EFEK AUTO-DIRECT: Mengubah tab secara otomatis berdasarkan klik pengguna
    // 🛡️ State mandiri untuk Raber 3 (Anti-Gagal)
    const [localShowRaber3, setLocalShowRaber3] = useState(Boolean(formData?.raber3Name));
    const isRaber3Open = (typeof showRaber3 !== 'undefined' ? showRaber3 : localShowRaber3) || Boolean(formData?.raber3Name);

    const handleToggleRaber3 = (status) => {
        if (typeof setShowRaber3 === 'function') {
            setShowRaber3(status);
        }
        setLocalShowRaber3(status);
        if (!status) {
            handleInputChange({ target: { name: 'raber3Name', value: '' } });
        }
    };

    // 1. STATE BALON TIP
    const [coEditors, setCoEditors] = useState([]);

    // 2. EFEK BALON TIP (DILENGKAPI PELINDUNG ANTI-BLANK)
    useEffect(() => {
        // ✨ PERHATIKAN TANDA TANYA (?): Ini mencegah layar putih jika data terlambat masuk
        if (showInputModal && currentRecordId && db && currentUser?.name && firebaseConfig?.appId) {
            try {
                const presenceRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/presence/${currentUser.name}`);
                setDoc(presenceRef, { name: currentUser.name, activeAt: new Date().getTime() }).catch(() => { });

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
                    deleteDoc(presenceRef).catch(() => { });
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
    // ========================================================================
    // 📐 STATE KONTROL VISIBILITAS PANEL (COLLAPSIBLE PANELS)
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const [showChatPanel, setShowChatPanel] = useState(false);

    const [masterTab, setMasterTab] = useState(() => {
        if (defaultTab === 'chat' || defaultTab === 'diskusi') return 'chat';
        if (defaultTab === 'riwayat' || defaultTab === 'history') return 'riwayat';
        return 'soap';
    });
    const [discussions, setDiscussions] = useState([]);
    const [isChatLoading, setIsChatLoading] = useState(true); // ⚡ State pencegah kedipan
    const [chatInput, setChatInput] = useState('');
    const [chatAttachment, setChatAttachment] = useState(null); // 📎 Base64 image attachment
    const [isUploadingChatImg, setIsUploadingChatImg] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false); // 🩻 Menu pilihan attachment (Upload vs Berkas Radiologi)
    const [showRadPickerModal, setShowRadPickerModal] = useState(false); // 🩻 Modal pemilih berkas radiologi
    const [isWaMode, setIsWaMode] = useState(false);
    const [chatTarget, setChatTarget] = useState('DPJP');
    const [urgencyTag, setUrgencyTag] = useState('NORMAL');
    const [chatChannel, setChatChannel] = useState('ALL'); // 👈 KEMBALIKAN BARIS INI
    const chatScrollRef = useRef(null);
    const chatFileInputRef = useRef(null);

    // Sinkronisasi defaultTab dari props ke masterTab
    useEffect(() => {
        if (defaultTab) {
            if (defaultTab === 'chat' || defaultTab === 'diskusi') {
                setMasterTab('chat');
                setShowChatPanel(true);
            } else if (defaultTab === 'riwayat' || defaultTab === 'history') {
                setMasterTab('riwayat');
                setShowHistoryPanel(true);
            } else {
                setMasterTab('soap');
            }
        }
    }, [defaultTab]);

    // 🩺 Filter Dokter Jaga sesuai RS pengguna
    const dokterJagaList = useMemo(() => {
        if (!allUsers || !Array.isArray(allUsers)) return [];
        const myHospital = (currentUser?.hospital || '').toUpperCase();
        return allUsers.filter(u => {
            const uHospital = (u.hospital || '').toUpperCase();
            return u.role === 'Dokter_Jaga' && (!myHospital || uHospital === myHospital);
        });
    }, [allUsers, currentUser?.hospital]);

    // 📂 MESIN FILTER DISKUSI & PENGHITUNG LENCANA (7 SALURAN TERPISAH)
    const { filteredDiscussions, channelCounts } = useMemo(() => {
        const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(currentUser?.role);
        const isJaga = currentUser?.role === 'Dokter_Jaga';
        const isPerawat = !isDoctor;
        const myName = currentUser?.name || '';
        
        const isMainDpjp = isDoctor && !isJaga && isMatchDoctor(myName, formData.dpjpName);
        const isMyRaber1 = isDoctor && !isJaga && isMatchDoctor(myName, formData.raberName);
        const isMyRaber2 = isDoctor && !isJaga && isMatchDoctor(myName, formData.raber2Name);

        // 1. Tentukan Pesan yang Boleh Dilihat oleh User Ini (Privasi Sangat Ketat)
        let visibleDiscussions = discussions.filter(d => {
            const ch = d.channel || (d.role === 'Dokter_Jaga' || d.targetRecipient === 'Semua Dokter Jaga' ? 'NURSE_JAGA' : 'NURSE_DPJP');
            
            if (isPerawat) {
                // Perawat tidak boleh mengintip chat antar-dokter
                return !ch.startsWith('JAGA_');
            }
            if (isJaga) {
                // Dr. Jaga tidak boleh mengintip chat perawat dengan spesialis (kecuali ditarik ke obrolan)
                return !ch.startsWith('NURSE_DPJP') && !ch.startsWith('NURSE_RABER');
            }
            if (isMainDpjp) {
                // DPJP Utama hanya boleh lihat saluran miliknya
                return ch === 'NURSE_DPJP' || ch === 'JAGA_DPJP';
            }
            if (isMyRaber1) {
                // Raber 1 hanya boleh lihat saluran miliknya
                return ch === 'NURSE_RABER1' || ch === 'JAGA_RABER1';
            }
            if (isMyRaber2) {
                // Raber 2 hanya boleh lihat saluran miliknya
                return ch === 'NURSE_RABER2' || ch === 'JAGA_RABER2';
            }
            return true;
        });

        // 2. Mesin Penghitung Angka Lencana (Badge Merah)
        const counts = { all: visibleDiscussions.length, NURSE_DPJP: 0, NURSE_JAGA: 0, JAGA_DPJP: 0, NURSE_RABER1: 0, NURSE_RABER2: 0, JAGA_RABER1: 0, JAGA_RABER2: 0 };
        visibleDiscussions.forEach(d => {
            const ch = d.channel || (d.role === 'Dokter_Jaga' || d.targetRecipient === 'Semua Dokter Jaga' ? 'NURSE_JAGA' : 'NURSE_DPJP');
            if (counts[ch] !== undefined) counts[ch]++;
        });

        // 3. Filter akhir sesuai Tab/Tombol yang sedang diklik
        if (chatChannel !== 'ALL') {
            visibleDiscussions = visibleDiscussions.filter(d => (d.channel || (d.role === 'Dokter_Jaga' || d.targetRecipient === 'Semua Dokter Jaga' ? 'NURSE_JAGA' : 'NURSE_DPJP')) === chatChannel);
        }

        return { filteredDiscussions: visibleDiscussions, channelCounts: counts };
    }, [discussions, chatChannel, currentUser?.role, currentUser?.name, formData.dpjpName, formData.raberName, formData.raber2Name]);
    
    // --- HELPER: KOMPRESI GAMBAR (Target ~100-150KB) ---
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
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
                    const compressed = canvas.toDataURL('image/jpeg', 0.75);
                    const sizeKB = Math.round(compressed.length / 1024);
                    console.log(`Gambar dikompres: ${width}x${height}, ~${sizeKB}KB`);
                    resolve(compressed);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    // --- HELPER: UPLOAD FOTO/LAMPIRAN CHAT ---
    const handleChatImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploadingChatImg(true);
            const compressed = await compressImage(file);
            setChatAttachment(compressed);
        } catch (error) {
            console.error("Gagal kompres gambar chat:", error);
            alert("Gagal memproses gambar: " + error.message);
        } finally {
            setIsUploadingChatImg(false);
            if (e.target) e.target.value = '';
        }
    };

    // 📡 Antena Real-time Chat Cepat & Pengubah Status Read (Centang WA)
    useEffect(() => {
        if (!showInputModal || !currentRecordId || !db || !firebaseConfig?.appId) return;

        setIsChatLoading(true);
        const chatRef = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/discussions`);
        const q = query(chatRef, orderBy('timestamp', 'asc'));

        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDiscussions(docs);
            setIsChatLoading(false);

            // ✨ Centang Biru WA: Jika user/dokter membuka chat, ubah status pesan dari pengirim lain menjadi 'read'
            if (currentUser?.name) {
                const unreadDocs = docs.filter(d => d.senderName !== currentUser.name && d.status !== 'read');
                if (unreadDocs.length > 0) {
                    unreadDocs.forEach(async (d) => {
                        try {
                            const dRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/discussions`, d.id);
                            await updateDoc(dRef, {
                                status: 'read',
                                readAt: new Date().getTime(),
                                readBy: currentUser.name
                            });
                        } catch (e) { }
                    });
                }
            }

            setTimeout(() => {
                if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }, 50);
        }, (err) => {
            console.error("Chat error:", err);
            setIsChatLoading(false);
        });

        return () => unsub();
    }, [showInputModal, currentRecordId, currentUser?.name, db, firebaseConfig]);

    // 🧹 Hapus tanda belum dibaca saat modal dibuka / tab chat aktif
    useEffect(() => {
        if (showInputModal && currentRecordId && db && firebaseConfig?.appId) {
            const myRole = currentUser?.role;
            const isDoctor = ['DPJP', 'Dokter_Jaga'].includes(myRole);
            const parentDocRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`, currentRecordId);

            if (!isDoctor) {
                updateDoc(parentDocRef, { hasUnreadNurse: false }).catch(() => { });
            } else if (myRole === 'DPJP') {
                updateDoc(parentDocRef, { hasUnreadDoctor: false }).catch(() => { });
            } else if (myRole === 'Dokter_Jaga') {
                updateDoc(parentDocRef, { hasUnreadDokterJaga: false }).catch(() => { });
            }
        }
    }, [showInputModal, masterTab, activeHistoryTab, currentRecordId, currentUser, db, firebaseConfig]);

    // 🚀 Fungsi Kirim Pesan + Pemancar Radar Notifikasi ke Dashboard
    const handleSendChat = async () => {
        if ((!chatInput.trim() && !chatAttachment) || !currentRecordId) return;

        const myRole = currentUser?.role || 'member';
        const isSenderDPJP = myRole === 'DPJP';
        const isSenderJaga = myRole === 'Dokter_Jaga';
        const isSenderNurse = !isSenderDPJP && !isSenderJaga && !isWaMode;

        const senderName = isWaMode ? formData.dpjpName : currentUser.name;
        const role = isWaMode ? 'DPJP' : (isSenderNurse ? 'Perawat' : myRole);
        const timestamp = new Date().getTime();
        const messageText = chatInput.trim();

        // 🚏 Tentukan saluran (channel) secara spesifik saat pesan dikirim
        let resolvedChannel = chatChannel !== 'ALL' ? chatChannel : 'NURSE_DPJP';
        
        if (chatChannel === 'ALL') {
            if (isSenderNurse) {
                if (chatTarget === formData.raberName) resolvedChannel = 'NURSE_RABER1';
                else if (chatTarget === formData.raber2Name) resolvedChannel = 'NURSE_RABER2';
                else if (chatTarget === 'Semua Dokter Jaga' || chatTarget?.startsWith('dr.')) resolvedChannel = 'NURSE_JAGA';
                else resolvedChannel = 'NURSE_DPJP';
            } else if (isSenderJaga) {
                if (chatTarget === formData.raberName) resolvedChannel = 'JAGA_RABER1';
                else if (chatTarget === formData.raber2Name) resolvedChannel = 'JAGA_RABER2';
                else if (chatTarget === 'DPJP') resolvedChannel = 'JAGA_DPJP';
                else resolvedChannel = 'NURSE_JAGA';
            } else if (isSenderDPJP || isWaMode) {
                const isMyRaber1 = isMatchDoctor(currentUser?.name, formData.raberName);
                const isMyRaber2 = isMatchDoctor(currentUser?.name, formData.raber2Name);
                
                if (chatTarget === 'Perawat') {
                    if (isMyRaber1) resolvedChannel = 'NURSE_RABER1';
                    else if (isMyRaber2) resolvedChannel = 'NURSE_RABER2';
                    else resolvedChannel = 'NURSE_DPJP';
                } else {
                    if (isMyRaber1) resolvedChannel = 'JAGA_RABER1';
                    else if (isMyRaber2) resolvedChannel = 'JAGA_RABER2';
                    else resolvedChannel = 'JAGA_DPJP';
                }
            }
        }

        // Hitung target notifikasi
        let unreadDoctor = false;
        let unreadDokterJaga = false;
        let unreadNurse = false;

        if (isSenderNurse) {
            if (chatTarget === 'DPJP' || chatTarget === formData.raberName || chatTarget === formData.raber2Name) {
                unreadDoctor = true;
            } else {
                unreadDokterJaga = true;
            }
        } else if (isSenderJaga) {
            if (chatTarget === 'DPJP' || chatTarget === formData.raberName || chatTarget === formData.raber2Name) {
                unreadDoctor = true;
            }
            unreadNurse = true; // Perawat juga menerima info dari dokter jaga
        } else if (isSenderDPJP || isWaMode) {
            if (chatTarget !== 'DPJP' && chatTarget !== formData.raberName && chatTarget !== formData.raber2Name && chatTarget !== 'Perawat') {
                unreadDokterJaga = true;
            }
            unreadNurse = true; // Perawat dapat balasan dari DPJP
        }

        // 🎯 FIX: DEKLARASI PENENTU TARGET DOKTER SPESIFIK (SOLUSI ERROR)
        const resolvedDoctorTarget = chatTarget === 'DPJP' ? (formData.dpjpName || 'DPJP') : chatTarget;

        try {
            // 1. Simpan pesan ke riwayat chat pasien
            const chatRef = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/discussions`);
            await addDoc(chatRef, {
                senderName,
                role,
                message: messageText || (chatAttachment ? '📷 [Foto/Lampiran]' : ''),
                attachment: chatAttachment || null,
                timestamp,
                channel: resolvedChannel,
                isProxyWa: isWaMode,
                loggedBy: isWaMode ? currentUser.name : null,
                targetRecipient: chatTarget,
                unreadDoctorTarget: resolvedDoctorTarget, // Disamakan agar akurat
                urgency: urgencyTag,
                status: 'sent' // ✨ Status sent saat chat dikirim
            });

            // 2. 📡 UPDATE DOKUMEN UTAMA PASIEN (Agar muncul notifikasi terarah di Dashboard)
            const parentDocRef = doc(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords`, currentRecordId);
            await updateDoc(parentDocRef, {
                lastDiscussion: {
                    senderName,
                    role,
                    message: messageText || (chatAttachment ? '📷 [Foto/Lampiran]' : ''),
                    hasAttachment: !!chatAttachment,
                    timestamp,
                    channel: resolvedChannel,
                    targetRecipient: chatTarget,
                    urgency: urgencyTag
                },
                lastSenderRole: role,
                lastSenderName: senderName,
                hasUnreadDoctor: unreadDoctor,
                hasUnreadDokterJaga: unreadDokterJaga,
                // 🔒 Kunci target agar jika chat ditujukan ke Raber, DPJP Utama tidak ikut menyala
                unreadDoctorTarget: unreadDoctor ? resolvedDoctorTarget : null,
                unreadJagaTarget: unreadDokterJaga ? chatTarget : null,
                hasUnreadNurse: unreadNurse,
                isCito: urgencyTag === 'CITO'
            });

            setChatInput('');
            setChatAttachment(null);
            setIsWaMode(false);
        } catch (error) {
            alert("Gagal mengirim log diskusi: " + error.message);
        }
    };

    // 📄 Generator Lembar Konsul Raber Otomatis
    const handleGenerateLembarKonsul = () => {
        const activeRec = activeRecords.find(r => r.id === currentRecordId);
        const realWard = activeRec?.ward || 'MELATI';
        // Bersihkan stempel dari analisa untuk dijadikan Diagnosa
        const cleanDx = (formData.analysis || '-').replace(/(?:🕒\s*)?\[[^\]]+\]\s*/g, '').trim();
        // Format Bed (Misal: K5KM -> K5)
        const cleanBed = formData.roomNumber ? formData.roomNumber.replace(/^(K\d+)(KM|P|A|B|C|D)$/i, '$1') : '';

        const textKonsul = `Yth. ${chatTarget},\nMohon evaluasi dan tatalaksana bersama pasien kami ${formData.name} (Ruang ${realWard}, Bed ${cleanBed}) dengan diagnosa:\n${cleanDx}\n\nTerima kasih.`;
        setChatInput(textKonsul);
    };

    // 🤖 Generator SBAR Otomatis
    const handleGenerateSBAR = () => {
        const cleanTag = (str) => (str || '').replace(/(?:🕒\s*)?\[[^\]]+\]\s*/g, '').trim();
        const s = cleanTag(formData.subjective) || '-';
        const o = cleanTag(formData.objective) || '-';
        const a = cleanTag(formData.analysis) || '-';
        const p = cleanTag(formData.planning) || '-';

        // Ekstrak Resep / Terapi Obat dari planning & resep paten
        const parsed = typeof parsePlanning === 'function' ? parsePlanning(formData.planning) : { rxs: [] };
        const rawRx = [
            ...(parsed.rxs || []),
            cleanTag(formData.currentPrescription)
        ].filter(Boolean);
        const resepText = rawRx.length > 0 ? rawRx.join(', ') : '-';

        const sbar = `*Laporan SBAR Terkini*\nS: ${s}\nO: ${o}\nA: ${a}\nP: ${p}\nResep Obat: ${resepText}`;
        setChatInput(sbar);
    };

    // 📄 Generator Lembar Konsul Raber Otomatis
    const handleGenerateKonsul = () => {
        const activeRec = activeRecords.find(r => r.id === currentRecordId);
        const realWard = activeRec?.ward || 'MELATI';
        const cleanDx = (formData.analysis || '-').replace(/(?:🕒\s*)?\[[^\]]+\]\s*/g, '').trim();

        const textKonsul = `Yth. ${chatTarget},\nMohon evaluasi dan tatalaksana bersama pasien kami ${formData.name} (Ruang ${realWard}, Bed ${formData.roomNumber}) dengan diagnosa:\n${cleanDx}\n\nTerima kasih.`;
        setChatInput(textKonsul);
    };

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
            ...allLabs.map(i => ({ text: i, type: 'Lab' })),
            ...allRads.map(i => ({ text: i, type: 'Rad' }))
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

    // --- ⚡ SMART PASTE UNIVERSAL ECALYPTUS (PROFIL + SOAP AUTO-DETECT) ---
    const handleProcessSmartPaste = () => {
        if (!rawPasteData.trim()) return;

        const rawText = rawPasteData.trim();
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

        // Helper Title Case
        const toTitleCase = (str) => {
            if (!str) return '';
            return str
                .toLowerCase()
                .replace(/(?:^|\s|\/|-)\w/g, match => match.toUpperCase())
                .replace(/\b(Ny|Tn|An|By|Nn|Sdr|Sdri)\b\.?/gi, (m) => {
                    const clean = m.replace('.', '').toLowerCase();
                    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() + '.';
                })
                .trim();
        };

        const cleanCase = (str) => {
            if (!str) return '';
            return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase());
        };

        // Helper parser tanggal: dd/mm/yyyy, hh:mm
        const parseDateVal = (str) => {
            if (!str) return '';
            const clean = str.trim().replace(/-/g, '/');
            const m = clean.match(/(\d{1,2}\/\d{1,2}\/\d{4})(?:[,\s]+(\d{1,2})[:.](\d{1,2}))?/);
            if (m) {
                const datePart = m[1];
                const timePart = m[2] && m[3] ? `${m[2].padStart(2, '0')}:${m[3].padStart(2, '0')}` : '';
                return timePart ? `${datePart}, ${timePart}` : datePart;
            }
            return '';
        };

        // ====================================================================
        // 1. MESIN DETEKSI & EKSTRAKSI PROFIL PASIEN (DENGAN KUNCI PENGAMAN)
        // ====================================================================
        let extractedName = '';
        let extractedRm = '';
        let extractedGender = '';
        let extractedAdmissionDate = '';
        let extractedDpjp = '';
        let extractedBpjsClass = '';
        let hasProfile = false;

        // 🔒 KUNCI PENGAMAN: Cek apakah user benar-benar mem-blok area Profil Pasien Ecalyptus
        // Jika tidak ada kata kunci di bawah ini, DILARANG mengubah Nama Pasien, RM, dsb.
        const hasProfileMarkers = /(?:no\.?\s*rm|no\.?\s*ktp\s*\/\s*nik|detail\s*pasien|laki-laki|perempuan|no\.?\s*surat\s*jaminan|ecalyptus|dpjp|umur|usia)/i.test(rawText);

        if (hasProfileMarkers) {
            // A. NO. RM
            const rmMatch = rawText.match(/(?:no\.?\s*rm|no\.?\s*rekam\s*medis|rekam\s*medis|nomor\s*rm|rm)\s*[:=-]?\s*(\d{4,10})/i);
            if (rmMatch) {
                extractedRm = rmMatch[1].trim();
            } else {
                for (let i = 0; i < lines.length; i++) {
                    if (/^(?:no\.?\s*rm|rm|no\.?\s*rekam\s*medis|nomor\s*rm)$/i.test(lines[i]) && lines[i + 1] && /^\d{4,10}$/.test(lines[i + 1])) { extractedRm = lines[i + 1].trim(); break; } else if (/^\b(\d{6,8})\b$/.test(lines[i])) {
                        extractedRm = lines[i].trim();
                        break;
                    }
                }
            }

            // B. GENDER
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim().toLowerCase();
                if (/^(?:laki[- ]?laki|pria|♂|lk)(?:\s*[♂♀])?$/i.test(l) || /^(?:laki[- ]?laki|pria)/i.test(l)) {
                    extractedGender = 'L';
                    break;
                } else if (/^(?:perempuan|wanita|♀|pr)(?:\s*[♂♀])?$/i.test(l) || /^(?:perempuan|wanita)/i.test(l)) {
                    extractedGender = 'P';
                    break;
                }
            }

            if (!extractedGender) {
                const genderMatch = rawText.match(/(?:jenis\s*kelamin|jk|gender|sex)\s*[:=-]?\s*(perempuan|wanita|laki[- ]?laki|pria|l|p|♀|♂)/i);
                if (genderMatch) {
                    const gVal = genderMatch[1].toLowerCase();
                    if (/perempuan|wanita|♀|^p$/.test(gVal)) extractedGender = 'P';
                    else if (/laki|pria|♂|^l$/.test(gVal)) extractedGender = 'L';
                } else {
                    if (/\b(perempuan|wanita|♀)\b/i.test(rawText)) extractedGender = 'P';
                    else if (/\b(laki[- ]?laki|pria|♂)\b/i.test(rawText)) extractedGender = 'L';
                    else if (/\b(ny|nn|sdri)\b\.?/i.test(rawText)) extractedGender = 'P';
                    else if (/\b(tn|sdr)\b\.?/i.test(rawText)) extractedGender = 'L';
                }
            }

            // C. TANGGAL MASUK / PENDAFTARAN / REGISTRASI
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim().toLowerCase();
                if (/^(?:tgl\.?\s*(?:reg|registrasi|pendaftaran|masuk|admisi|rawat)?|tanggal\s*(?:pendaftaran|masuk|registrasi|admisi|rawat)?|waktu\s*pendaftaran)(?:\s*[:=-]|$)/i.test(l)) {
                    const onLine = lines[i].match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
                    if (onLine) {
                        extractedAdmissionDate = parseDateVal(lines[i]);
                        if (extractedAdmissionDate) break;
                    }
                    if (lines[i + 1]) {
                        const nextLineDate = lines[i + 1].match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
                        if (nextLineDate) {
                            extractedAdmissionDate = parseDateVal(lines[i + 1]);
                            if (extractedAdmissionDate) break;
                        }
                    }
                }
            }

            if (!extractedAdmissionDate) {
                const fullDateMatch = rawText.match(/(?:tgl\.?\s*(?:reg(?:istrasi)?|pendaftaran|masuk|admisi|rawat)?|tanggal\s*(?:masuk|pendaftaran|registrasi)?)\s*[:=-]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}(?:[,\s]+[0-9]{1,2}[:.][0-9]{1,2})?)/i);
                if (fullDateMatch) {
                    extractedAdmissionDate = parseDateVal(fullDateMatch[1]);
                }
            }

            // D. DPJP UTAMA
            let rawDoctorStr = '';
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim().toLowerCase();
                if (/^(?:dpjp\s*utama|dpjp|dokter\s*penanggung\s*jawab|dokter\s*dpjp)(?:\s*[:=-]|$)/i.test(l)) {
                    const sameDoc = lines[i].match(/(?:dpjp\s*utama|dpjp|dokter\s*penanggung\s*jawab|dokter\s*dpjp)\s*[:=-]?\s*(dr\.?\s*.+)/i);
                    if (sameDoc) {
                        rawDoctorStr = sameDoc[1].trim();
                        break;
                    }
                    if (lines[i + 1] && !/^(?:alergi|riwayat|dokter|assesmen|rencana|subjektif|objektif)/i.test(lines[i + 1])) {
                        rawDoctorStr = lines[i + 1].trim();
                        break;
                    }
                }
            }

            if (!rawDoctorStr) {
                const fullDpjp = rawText.match(/(?:dpjp\s*utama|dpjp|dokter\s*penanggung\s*jawab|dokter\s*dpjp)\s*[:=-]?\s*(dr\.?\s*[A-Za-z\s\.\',\-]+)/i);
                if (fullDpjp) rawDoctorStr = fullDpjp[1].trim();
            }

            if (rawDoctorStr && Array.isArray(dpjpOptions) && dpjpOptions.length > 0) {
                const found = dpjpOptions.find(opt => isMatchDoctor(rawDoctorStr, opt));
                if (found) {
                    extractedDpjp = found;
                } else {
                    const cleanRaw = rawDoctorStr.toLowerCase().replace(/^(dr|drg|dokter)\.?\s*/i, '').replace(/,.*$/, '').trim();
                    const foundSub = dpjpOptions.find(opt => {
                        const cleanOpt = opt.toLowerCase().replace(/^(dr|drg|dokter)\.?\s*/i, '').replace(/,.*$/, '').trim();
                        return cleanRaw.includes(cleanOpt) || cleanOpt.includes(cleanRaw);
                    });
                    if (foundSub) extractedDpjp = foundSub;
                    else extractedDpjp = rawDoctorStr;
                }
            } else if (rawDoctorStr) {
                extractedDpjp = rawDoctorStr;
            }

            // E. NAMA PASIEN (Deteksi Presisi Format 1, Format 3, dan Format Umum)
            const explicitNameMatch = rawText.match(/(?:nama\s*pasien|nama\s*lengkap)\s*[:=-]?\s*([A-Za-z\s\.\',\-()]+)/i) ||
                rawText.match(/(?:^|\n)\s*nama\s*[:=-]\s*(?!resep|obat|dokter|ruang|kamar|tindakan)([A-Za-z\s\.\',\-()]+)/i);

            if (explicitNameMatch) {
                let n = explicitNameMatch[1].trim();
                n = n.replace(/\s*\(\s*(?:ny\vert{}tn\vert{}an\vert{}by\vert{}nn\vert{}l\vert{}p\vert{}perempuan\vert{}laki-laki\vert{}\d+)\s*\).*$/i, '').trim();
                extractedName = toTitleCase(n);
            }

            // Jika tanpa label eksplisit, periksa baris di atas baris Gender (Format standar Ecalyptus)
            if (!extractedName) {
                for (let i = 0; i < lines.length; i++) {
                    const currLine = lines[i].trim();
                    const nextLine = (lines[i + 1] || '').trim().toLowerCase();

                    if (/^(?:laki[- ]?laki|perempuan|wanita|pria|♀|♂|lk|pr)(?:\s*[♂♀])?$/i.test(nextLine) ||
                        /^(?:laki[- ]?laki|perempuan|wanita|pria|♀|♂)/i.test(nextLine)) {
                        if (currLine.length >= 3 && /^[A-Za-z\s\.\',\-()]+$/.test(currLine)) {
                            if (!/^(?:ecalyptus|rawat\s*inap|detail\s*pasien|informasi\s*lengkap|pasien\s*lainnya|rekam\s*medis|no\.?\s*rm)/i.test(currLine)) {
                                let n = currLine.replace(/\s*\(\s*(?:ny\vert{}tn\vert{}an\vert{}by\vert{}nn\vert{}l\vert{}p\vert{}perempuan\vert{}laki-laki\vert{}\d+)\s*\).*$/i, '').trim();
                                extractedName = toTitleCase(n);
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback: Baris pertama yang berupa nama orang valid (Sudah diamankan oleh hasProfileMarkers)
            if (!extractedName) {
                for (const line of lines) {
                    const l = line.trim();
                    if (/^(?:ecalyptus|rawat\s*inap|detail\s*pasien|pasien\s*lainnya|informasi\s*lengkap|rekam\s*medis|no\.?\s*rm|rm|tgl|tanggal|dpjp|dokter|usia|umur|jenis\s*kelamin|jk|gender|tekanan|suhu|nadi|rr|spo2|gcs|assesmen|asemen|diagnosa|planning|rencana|subjektif|objektif|resep|nama\s*resep|no\.?\s*resep|nama\s*obat|aturan\s*pakai|catatan|lihat\s*alergi|alergi|ktp|kk|no\.?\s*reg|reg)/i.test(l)) continue;
                    if (/^\d+$/.test(l)) continue;
                    if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(l)) continue;
                    if (/^dr\.\s+/i.test(l)) continue;

                    if (l.length >= 3 && /^[A-Za-z\s\.\',\-()]+$/.test(l)) {
                        let n = l.replace(/\s*\(\s*(?:ny\vert{}tn\vert{}an\vert{}by\vert{}nn\vert{}l\vert{}p\vert{}perempuan\vert{}laki-laki\vert{}\d+)\s*\).*$/i, '').trim();
                        extractedName = toTitleCase(n);
                        break;
                    }
                }
            }

            // F. KELAS BPJS / UMUM
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i].trim().toLowerCase();
                if (/^(?:kelas\s*rawat|hak\s*kelas|kelas|kls)$/i.test(l) && lines[i + 1]) {
                    const val = lines[i + 1].trim().toLowerCase();
                    if (val === 'iii' || val === '3' || val.includes('kelas 3') || val.includes('kelas iii') || val.includes('bpjs 3')) {
                        extractedBpjsClass = '3';
                        break;
                    } else if (val === 'ii' || val === '2' || val.includes('kelas 2') || val.includes('kelas ii') || val.includes('bpjs 2')) {
                        extractedBpjsClass = '2';
                        break;
                    } else if (val === 'i' || val === '1' || val.includes('kelas 1') || val.includes('kelas i') || val.includes('bpjs 1')) {
                        extractedBpjsClass = '1';
                        break;
                    } else if (val.includes('umum')) {
                        extractedBpjsClass = 'Umum';
                        break;
                    } else if (val.includes('vip')) {
                        extractedBpjsClass = 'VIP';
                        break;
                    }
                }
            }

            if (!extractedBpjsClass) {
                const classMatch = rawText.match(/(?:kelas\s*rawat|hak\s*kelas|kelas|kls|bpjs)\s*[:=-]?\s*(kelas\s*(?:iii|ii|i|[123])|bpjs\s*(?:iii|ii|i|[123])|(?:iii|ii|i|[123])|umum|vip|vvip)/i);
                if (classMatch) {
                    const cVal = classMatch[1].toLowerCase();
                    if (cVal.includes('iii') || cVal.includes('3')) extractedBpjsClass = '3';
                    else if (cVal.includes('ii') || cVal.includes('2')) extractedBpjsClass = '2';
                    else if (cVal.includes('i') || cVal.includes('1')) extractedBpjsClass = '1';
                    else if (cVal.includes('umum')) extractedBpjsClass = 'Umum';
                }
            }

            hasProfile = Boolean(extractedName || extractedRm || extractedGender || extractedAdmissionDate || extractedDpjp || extractedBpjsClass);
            
            if (hasProfile) {
                setFormData(prev => {
                    const next = { ...prev };
                    if (extractedName) next.name = extractedName;
                    if (extractedRm) next.rmNumber = extractedRm;
                    if (extractedGender) next.gender = extractedGender;
                    if (extractedAdmissionDate) next.admissionDate = extractedAdmissionDate;
                    if (extractedDpjp) next.dpjpName = extractedDpjp;
                    if (extractedBpjsClass) next.bpjsClass = extractedBpjsClass;
                    return next;
                });
            }
        } // <-- Akhir dari blok Kunci Pengaman Profil (hasProfileMarkers)

        // G. TTV AWAL (Deteksi TTV tetap jalan di luar kunci pengaman profil)
        const tdM = rawText.match(/(?:tekanan\s*darah|td|bp)\s*[:=-]?\s*(\d{2,3}\s*\/\s*\d{2,3})/i);
        const nadiM = rawText.match(/(?:detak\s*jantung|denyut\s*jantung|nadi|pulse|hr)\s*[:=-]?\s*(\d{2,3})/i);
        const suhuM = rawText.match(/(?:suhu(?:\s*tubuh)?|temp|t)\s*[:=-]?\s*(\d{2}(?:[\.,]\d+)?)/i);
        const rrM = rawText.match(/(?:frekuensi\s*pernafasan|pernafasan|respirasi|rr)\s*[:=-]?\s*(\d{1,2})/i);
        const spo2M = rawText.match(/(?:spo2|saturasi(?:\s*oksigen)?)\s*[:=-]?\s*(\d{2,3}\s*%?)/i);

        let ttvParts = [];
        if (tdM) ttvParts.push(`TD: ${tdM[1].trim()}`);
        if (nadiM) ttvParts.push(`N: ${nadiM[1].trim()}`);
        if (suhuM) ttvParts.push(`S: ${suhuM[1].trim().replace(',', '.')}`);
        if (rrM) ttvParts.push(`RR: ${rrM[1].trim()}`);
        if (spo2M) ttvParts.push(`SpO2: ${spo2M[1].trim().replace('%', '')}%`);

        // ====================================================================
        // 2. MESIN DETEKSI & EKSTRAKSI SOAP & RESEP OBAT
        // ====================================================================
        let cleanText = rawText
            .replace(/Tanda Vital/gi, '')
            .replace(/Angka/gi, '')
            .replace(/Catatan/gi, '');
        
        const sMatch = cleanText.match(/Subjektif([\s\S]*?)(?=Objektif|$)/i);
        const oMatch = cleanText.match(/Objektif([\s\S]*?)(?=Assesmen|Asesmen|$)/i);
        const aMatch = cleanText.match(/(?:Assesmen|Asesmen)([\s\S]*?)(?=Rencana|$)/i);
        const pMatch = cleanText.match(/Rencana([\s\S]*)/i);

        let hasSoap = false;

        if (sMatch || oMatch || aMatch || pMatch) {
            hasSoap = true;
            if (sMatch && sMatch[1] && sMatch[1].trim()) appendText('subjective', cleanCase(sMatch[1].trim()));
            if (oMatch && oMatch[1] && oMatch[1].trim()) {
                const oText = cleanCase(oMatch[1].trim());
                appendText('objective', oText);
            } else if (ttvParts.length > 0) {
                appendText('objective', `TTV: ${ttvParts.join(', ')}`);
            }
            if (aMatch && aMatch[1] && aMatch[1].trim()) appendText('analysis', cleanCase(aMatch[1].trim()));
            if (pMatch && pMatch[1] && pMatch[1].trim()) processPlanningText(pMatch[1]);
        } else if (!hasProfile) {
            // Detektif tanpa header (HANYA JIKA BUKAN PROFIL)
            let sLines = [], oLines = [], aLines = [], pLines = [];
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

            if (sLines.length > 0) { hasSoap = true; appendText('subjective', cleanCase(sLines.join('\n'))); }
            if (oLines.length > 0) { hasSoap = true; appendText('objective', cleanCase(oLines.join('\n'))); }
            if (aLines.length > 0) { hasSoap = true; appendText('analysis', cleanCase(aLines.join('\n'))); }
            if (pLines.length > 0) { hasSoap = true; processPlanningText(pLines.join('\n')); }
        } else {
            // Jika ada TTV pendaftaran dari profil, masukkan ke objective
            if (ttvParts.length > 0) {
                appendText('objective', `TTV: ${ttvParts.join(', ')}`);
            }
            // Periksa apakah ada baris planning / resep obat di dalam profil
            const pLines = [];
            lines.forEach(line => {
                const lower = line.toLowerCase().trim();
                if (!lower) return;
                if (/\d+\s*x\s*\d+/.test(lower) || /\d+\s*dd\s*\d+/i.test(lower) || /\d+\s*(?:mg|tpm|cc\/jam|ml\/jam|amp|vial|tab|kaps)/.test(lower)) {
                    pLines.push(line);
                }
            });
            if (pLines.length > 0) {
                hasSoap = true;
                processPlanningText(pLines.join('\n'));
            }
        }

        setShowSmartPaste(false);
        setRawPasteData('');

        let feedbackMsg = '✅ Data Ecalyptus berhasil diekstrak!';
        if (hasProfile && hasSoap) {
            feedbackMsg = '✅ Profil Pasien & Catatan SOAP berhasil diisi otomatis!';
        } else if (hasProfile) {
            feedbackMsg = '✅ Profil Pasien berhasil diisi otomatis!';
        } else if (hasSoap) {
            feedbackMsg = '✅ Catatan SOAP berhasil dimasukkan!';
        }
        alert(feedbackMsg);
    };

    // --- SMART PASTE OBAT: SENSOR ANTI-PECAHAN DOSIS, SENSOR NEBU, & DETEKSI SACHET ---
    const processPlanningText = (rawText) => {
        const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
        const cleanCase = (str) => { if (!str) return ''; return str.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w|\n\s*\w)/g, c => c.toUpperCase()); };

        let finalPlanning = [];
        let prescriptionList = [];
        // Saring baris bersih tanpa noise bullet / garis / strip kosong
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l && l !== '-' && l !== '•' && l !== '–' && l !== '_');

        // 🛡️ SENSOR ANTI-PECAHAN: Deteksi jika baris HANYA berisi angka/satuan dosis tanpa nama obat
        const isOrphanDoseOnly = (str) => {
            const clean = str.toLowerCase()
                .replace(/^(?:nebu|inhalasi|uap|inj|tab|kaps|po|iv)\s*/i, '')
                .replace(/\b(?:\d+(?:[.,]\d+)?|\/|\-|\+|\*|mg|gr|g|mcg|ml|iu|cc|vial|ampul|amp|kolf|fls|sachet|sac|tab|kaps|dd|x)\b/gi, '')
                .replace(/[^a-z]/g, '')
                .trim();
            return clean.length < 2; // Jika sisa huruf < 2, berarti cuma angka/satuan murni
        };

        lines.forEach((line, index) => {
            let trimmed = line.replace(/^[•\-\*\u2022\.]+\s*/, '').trim();
            if (!trimmed) return;
            const lowerLine = trimmed.toLowerCase();
            if (lowerLine.match(/^(?:resep|rencana|nama obat|nama resep|aturan pakai|cara penggunaan|no\.?\s*resep|catatan|jumlah|jml|keterangan|^resep -|^-$|^_$)/i)) return;

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
                    let prevLine = lines[index - 1].replace(/^[•\-\*\u2022\.]+\s*/, '').replace(/Nama Obat|No\. Resep|-/gi, '').trim();
                    if (prevLine.length > 2 && !isOrphanDoseOnly(prevLine)) {
                        drugName = prevLine;
                        dosage = `${tableMatch[1]}x${tableMatch[2]}`;
                        isMedicine = true;
                    }
                }
            }
            else if (manualMatch) {
                const candidateName = manualMatch[1].trim();
                if (candidateName.length > 2 && !isOrphanDoseOnly(candidateName)) {
                    drugName = candidateName;
                    dosage = manualMatch[2].trim().replace(/\s*[xX]\s*/, 'x').replace(/[\s,.;]+$/, '');
                    isMedicine = true;
                }
            }
            else if (infusMatch) {
                drugName = infusMatch[1].trim();
                dosage = infusMatch[2].trim();
                if (!drugName) drugName = "Cairan Infus";
                isMedicine = true;
            }
            else if (nebuMatch) {
                const candidateName = nebuMatch[1].trim();
                if (!isOrphanDoseOnly(candidateName)) {
                    drugName = "Nebu " + candidateName;
                    dosage = "Sesuai Jadwal";
                    isMedicine = true;
                }
            }
            else if (freqMatch) {
                const candidateName = freqMatch[1].trim();
                if (candidateName.length > 2 && !isOrphanDoseOnly(candidateName)) {
                    drugName = candidateName;
                    dosage = freqMatch[2].trim();
                    isMedicine = true;
                }
            }

            if (isMedicine) {
                prescriptionList.push(buildRxLine(drugName, dosage, MEDICATION_TRANSLATOR));
            }
            else {
                const nextLine = lines[index + 1] || '';
                if (!nextLine.match(/(\d+)\s*dd\s*(\d+)/i) && !lowerLine.match(/^(?:resep|rencana|no\.?\s*resep|nama\s*resep|aturan\s*pakai|catatan)/i)) {
                    finalPlanning.push(cleanCase(trimmed));
                }
            }
        });

        prescriptionList = [...new Set(prescriptionList)];

        let resultP = "";
        if (finalPlanning.length > 0) resultP += finalPlanning.join('\n').trim();

        // ✨ REDIREKSI RESEP OBAT: Masukkan ke currentPrescription (persisten), bukan planning
        if (prescriptionList.length > 0) {
            const newRxText = prescriptionList.join('\n');
            const currentRx = formData.currentPrescription || '';
            handleInputChange({ target: { name: 'currentPrescription', value: mergePrescriptionText(currentRx, newRxText) } });
        }

        const currentP = formData.planning || '';
        if (currentP.trim()) {
            if (resultP) handleInputChange({ target: { name: 'planning', value: `${resultP}\n\n${currentP.trim()}` } });
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
                    if (match) usedKeyString = match[0];
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
                let textWithoutKey = cleanLine
                    .replace(usedKeyString, '')
                    .replace(/\(\s*[A-Za-z0-9.\-\/ ]{1,12}\s*\)/g, ' ')
                    .trim();
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
        if (window.confirm("Kosongkan semua kolom SOAP & Lampiran untuk operan baru?\n\n⚠️ Resep Obat (currentPrescription) TIDAK akan dihapus.")) {
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
                            <button type="button" onClick={() => onSwapBed && onSwapBed({ id: currentRecordId, name: formData.name, roomNumber: formData.roomNumber })} className="p-1.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] shadow-sm hover:bg-indigo-200"title="Tukar/Pindah Bed">🔀</button>
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
                    <button type="button" onClick={() => setShowSmartPaste(true)} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded border border-indigo-700 hover:bg-indigo-700 transition font-bold shadow-sm flex items-center animate-pulse">⚡ Smart Paste</button>
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

            {/* MASTER TABS (HANYA MUNCUL DI LAYAR KECIL / HP) */}
            <div className="lg:hidden flex border-b border-gray-300 bg-white sticky top-0 z-20 shadow-sm shrink-0">
                <button
                    type="button"
                    onClick={() => setMasterTab('soap')}
                    className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${masterTab === 'soap' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span>📝 Form SOAP</span>
                </button>
                <button
                    type="button"
                    onClick={() => setMasterTab('riwayat')}
                    className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${masterTab === 'riwayat' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span>🕒 Riwayat</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${masterTab === 'riwayat' ? 'bg-indigo-200 text-indigo-800 font-bold' : 'bg-gray-200 text-gray-700'}`}>
                        {historyLogs?.length || 0}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMasterTab('chat');
                        setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 100);
                    }}
                    className={`flex-1 py-2 text-center text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${masterTab === 'chat' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span>💬 Chat SBAR</span>
                    {discussions.length > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${masterTab === 'chat' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
                            {discussions.length}
                        </span>
                    )}
                </button>
            </div>

            {/* B. AREA RESPONSIVE 3 KOLOM (DESKTOP: GRID 3 KOLOM | HP: TAB AKTIF) */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200 relative z-0 transition-all duration-300 w-full h-full">

                {/* ======================================================== */}
                {/* 📌 KOLOM 1: FORM SOAP + DATA PENUNJANG (LAB/TTV/RAD)   */}
                {/* ======================================================== */}
                <div ref={scrollRef} className={`w-full lg:w-[400px] xl:w-[450px] shrink-0 flex flex-col h-full overflow-y-auto custom-scrollbar bg-white border-r border-slate-200 transition-all duration-300 ${masterTab === 'soap' ? 'flex' : 'hidden lg:flex'}`}>
                    <div className="p-3 space-y-3">
                        {/* 1. Form Identitas */}
                        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
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

                                    {/* KOLOM 4: TGL MASUK */}
                                    <div className="w-[40%] relative">
                                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Tgl Masuk</label>
                                        <input
                                            type="text"
                                            value={formData.admissionDate ? (formData.admissionDate.includes('-') ? formatDateCM(formData.admissionDate) : formData.admissionDate) : ''}
                                            onChange={(e) => {
                                                handleDateMasking(e);
                                                handleInputChange({ target: { name: 'admissionDate', value: e.target.value } });
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

                                {/* --- BARIS 3: RABER 1, RABER 2 & RABER 3 --- */}
                                <div className="flex space-x-2 mt-1 min-h-[40px]">
                                    {/* RABER 1 */}
                                    <div className="w-1/3">
                                        {showRaber1 ? (
                                            <div className="relative">
                                                <CustomSelect
                                                    label="Raber 1"
                                                    value={formData.raberName || ''}
                                                    onChange={(e) => handleInputChange({ target: { name: 'raberName', value: e.target.value } })}
                                                    options={dpjpOptions}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowRaber1(false); handleInputChange({ target: { name: 'raberName', value: '' } }); }}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition cursor-pointer"
                                                >✕</button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setShowRaber1(true)}
                                                className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2 cursor-pointer"
                                            >+ Tambah Raber 1</button>
                                        )}
                                    </div>

                                    {/* RABER 2 */}
                                    <div className="w-1/3">
                                        {showRaber1 && (
                                            showRaber2 ? (
                                                <div className="relative">
                                                    <CustomSelect
                                                        label="Raber 2"
                                                        value={formData.raber2Name || ''}
                                                        onChange={(e) => handleInputChange({ target: { name: 'raber2Name', value: e.target.value } })}
                                                        options={dpjpOptions}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => { setShowRaber2(false); handleInputChange({ target: { name: 'raber2Name', value: '' } }); }}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition cursor-pointer"
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRaber2(true)}
                                                    className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2 cursor-pointer"
                                                >+ Tambah Raber 2</button>
                                            )
                                        )}
                                    </div>
                                    
                                    {/* RABER 3 */}
                                    <div className="w-1/3">
                                        {showRaber1 && showRaber2 && (
                                            isRaber3Open ? (
                                                <div className="relative">
                                                    <CustomSelect
                                                        label="Raber 3"
                                                        value={formData.raber3Name || ''}
                                                        onChange={(e) => handleInputChange({ target: { name: 'raber3Name', value: e.target.value } })}
                                                        options={dpjpOptions}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleRaber3(false)}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center shadow-sm hover:bg-red-700 transition cursor-pointer"
                                                    >✕</button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleRaber3(true)}
                                                    className="text-[10px] text-blue-600 underline font-bold hover:text-blue-800 transition py-2 cursor-pointer"
                                                >+ Tambah Raber 3</button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* 2. SOAP Fields */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1 mb-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Catatan SOAP Hari Ini</span>
                                <div className="flex gap-1">                                    
                                    <button type="button" onClick={handleClearSoap} className="text-[9px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-600 hover:text-white transition font-bold shadow-sm">
                                        🗑️ Reset Semua
                                    </button>
                                </div>
                            </div>

                            {/* --- URUTAN: A - P - RESEP - O - S --- */}

                            <CustomTextArea
                                label="A (Analisa) / Dx:"
                                name="analysis"
                                value={formData.analysis}
                                onChange={handleInputChange}
                                onPullData={historyLogs && historyLogs.length > 0 ? () => pullDataForField('analysis') : null}
                                pullLabel="Salin A Lalu"
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
                                                className={`text-[9px] px-2 py-1 rounded border font-bold shadow-sm transition flex items-center gap-1 hover:scale-105 active:scale-95 ${item.type === 'Lab'
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

                            {/* 💊 SUB-PLANNING KHUSUS RESEP OBAT PATEN */}
                            <div className="bg-rose-50 border border-rose-200 rounded-lg shadow-sm relative z-10 hover:z-40 focus-within:z-40 transition-all">
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

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm("⚠️ PENTING: Anda yakin ingin menghapus seluruh daftar Resep Obat Paten/Persisten pasien ini?")) {
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

                        {/* 📊 PLATFORM DATA PENUNJANG & PEMANTAUAN (LAB, TTV, RADIOLOGI) */}
                        {isEditing && (
                            <div id="chat-history-section" className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mt-3">

                                {/* MENU TAB PENUNJANG */}
                                <div className="flex border-b border-gray-200 bg-slate-50 sticky top-0 z-10">
                                    <button
                                        type="button"
                                        onClick={() => setActiveHistoryTab('lab')}
                                        className={`py-2 px-3 text-[10px] font-bold border-b-2 transition-colors flex items-center gap-1 ${activeHistoryTab === 'lab'
                                            ? 'border-indigo-500 text-indigo-600 bg-white font-extrabold'
                                            : 'border-transparent text-gray-400 hover:text-gray-500'
                                            }`}
                                    >
                                        🧪 Lab
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveHistoryTab('ttv')}
                                        className={`py-2 px-3 text-[10px] font-bold border-b-2 transition-colors flex items-center gap-1 ${activeHistoryTab === 'ttv'
                                            ? 'border-emerald-500 text-emerald-600 bg-white font-extrabold'
                                            : 'border-transparent text-gray-400 hover:text-gray-500'
                                            }`}
                                    >
                                        📊 TTV
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveHistoryTab('radiologi')}
                                        className={`py-2 px-3 text-[10px] font-bold border-b-2 transition-colors flex items-center gap-1 ${activeHistoryTab === 'radiologi'
                                            ? 'border-amber-500 text-amber-600 bg-white font-extrabold'
                                            : 'border-transparent text-gray-400 hover:text-gray-500'
                                            }`}
                                    >
                                        📷 Radiologi
                                        <span className={`ml-1 px-1.5 py-0.2 text-[9px] rounded-full font-mono ${activeHistoryTab === 'radiologi' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'
                                            }`}>
                                            {formData.radiologyImages?.length || 0}
                                        </span>
                                    </button>
                                    {/* Tombol pintasan ke Chat SBAR di HP */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMasterTab('chat');
                                            setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 100);
                                        }}
                                        className="lg:hidden py-2 px-3 text-[10px] font-bold border-b-2 border-transparent text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1 ml-auto"
                                    >
                                        💬 Chat ({discussions.length})
                                    </button>
                                </div>

                                {/* KONTEN ISI TAB PENUNJANG */}
                                <div className="p-3 min-h-[140px]">
                                    {activeHistoryTab === 'lab' && (
                                        <div className="animate-in fade-in duration-150">
                                            <LabHistoryTable record={{ objective: formData.objective, labHistory: formData.labHistory }} />
                                        </div>
                                    )}

                                    {activeHistoryTab === 'ttv' && (
                                        <div className="animate-in fade-in duration-150">
                                            <TtvHistory objective={formData.objective} />
                                        </div>
                                    )}

                                    {activeHistoryTab === 'radiologi' && (
                                        <div
                                            className="space-y-3 animate-in fade-in duration-150 p-2 border-2 border-dashed border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:bg-indigo-50/30 rounded-xl outline-none transition-all"
                                            tabIndex={0}
                                            onPaste={async (e) => {
                                                const items = e.clipboardData?.items;
                                                if (!items) return;

                                                const files = [];
                                                for (let i = 0; i < items.length; i++) {
                                                    if (items[i].type.indexOf("image") !== -1) {
                                                        files.push(items[i].getAsFile());
                                                    }
                                                }
                                                if (!files.length) return;

                                                const compressed = await Promise.all(files.map(f => compressImage(f)));
                                                const now = new Date();
                                                const newImages = compressed.map((imgUrl, idx) => ({
                                                    category: 'Rontgen',
                                                    imageUrl: imgUrl,
                                                    date: now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                                                    time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                                                    uploadedBy: (currentUser?.name || 'Perawat').split(' ')[0],
                                                    id: `img_${Date.now()}_${idx}`
                                                }));
                                                onAddRadiologyImage(newImages);
                                            }}
                                        >
                                            <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg text-center shadow-inner cursor-pointer" title="Klik area ini lalu tekan Ctrl + V">
                                                <p className="text-xs text-indigo-900 font-black mt-1">📋 Klik Kotak Ini, Lalu Tekan Ctrl + V untuk Paste Gambar!</p>
                                                <p className="text-[9px] text-indigo-600 font-medium">(Hasil paste akan masuk Rontgen, bisa diubah via dropdown)</p>
                                            </div>

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
                                                            }}
                                                        />
                                                        <span className="text-[9px] font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-2 py-1 flex items-center gap-1 shadow-sm transition">
                                                            + {cat}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>

                                            {formData.radiologyImages && formData.radiologyImages.length > 0 ? (
                                                <div className="space-y-2">
                                                    {formData.radiologyImages.map((img, idx) => {
                                                        const isExpertiseDoc = ['Rontgen', 'CT Scan', 'USG', 'EKG'].includes(img.category);
                                                        const autoExpertiseText = (() => {
                                                            const objText = formData.objective || '';
                                                            const lines = objText.split('\n');
                                                            for (let l of lines) {
                                                                if (l.toLowerCase().includes(img.category.toLowerCase()) || (img.category === 'Rontgen' && l.toLowerCase().includes('thorax'))) {
                                                                    const parts = l.split(/[:;]/);
                                                                    if (parts.length > 1) return parts.slice(1).join(':').trim();
                                                                }
                                                            }
                                                            return null;
                                                        })();

                                                        return (
                                                            <div key={img.id || idx} className="flex gap-2.5 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm group">
                                                                <div className="relative shrink-0">
                                                                    <img src={img.imageUrl} alt={img.category}
                                                                        className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200 cursor-pointer hover:border-indigo-400 transition shadow-sm"
                                                                        onClick={() => window.open(img.imageUrl, '_blank')}
                                                                        title={`${img.category} • ${img.uploadedBy}`}
                                                                    />
                                                                    <span className="absolute -top-1 -left-1 text-[8px] bg-indigo-600 text-white px-1 rounded font-bold shadow-sm uppercase">
                                                                        {img.category.substring(0, 2)}
                                                                    </span>
                                                                </div>

                                                                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
                                                                    <div className="flex justify-between items-center">
                                                                        <select
                                                                            value={img.category}
                                                                            onChange={(e) => {
                                                                                const newCat = e.target.value;
                                                                                const updated = formData.radiologyImages.map((item, iIdx) =>
                                                                                    iIdx === idx ? { ...item, category: newCat } : item
                                                                                );
                                                                                setFormData(prev => ({ ...prev, radiologyImages: updated }));
                                                                            }}
                                                                            className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-400"
                                                                        >
                                                                            {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka', 'Lainnya'].map(c => (
                                                                                <option key={c} value={c}>{c}</option>
                                                                            ))}
                                                                        </select>

                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-[9px] text-slate-400 font-medium">{img.date}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onRemoveRadiologyImage(img.id || img.imageUrl)}
                                                                                className="bg-red-50 text-red-500 hover:text-white hover:bg-red-500 rounded px-1.5 py-0.5 text-[8px] font-bold transition shadow-sm border border-red-100"
                                                                            >✕ Hapus</button>
                                                                        </div>
                                                                    </div>

                                                                    {isExpertiseDoc && (autoExpertiseText || img.kesan) ? (
                                                                        <div className="relative bg-slate-50 border border-slate-200 rounded p-1.5 pr-14 text-[10px] text-slate-700 leading-tight whitespace-pre-wrap font-medium shadow-inner">
                                                                            {autoExpertiseText ? (
                                                                                <span><b className="text-emerald-700 font-extrabold">[Auto-O]</b> {autoExpertiseText}</span>
                                                                            ) : (
                                                                                img.kesan
                                                                            )}

                                                                            {!autoExpertiseText && img.kesan && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        appendText('objective', `${img.category} (${img.date}): ${img.kesan}`);
                                                                                        alert(`✅ Ekspertise ${img.category} berhasil disalin ke kolom O (Objektif)!`);
                                                                                    }}
                                                                                    className="absolute right-1 top-1 bottom-1 flex flex-col items-center justify-center px-1.5 bg-indigo-100 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded shadow-sm transition-all text-[8px] font-extrabold"
                                                                                >
                                                                                    <span className="text-xs">📥</span>
                                                                                    <span>Ke (O)</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : isExpertiseDoc ? (
                                                                        <div className="text-[9px] text-indigo-500/80 italic bg-indigo-50/30 p-1.5 rounded border border-dashed border-indigo-100 font-medium">
                                                                            💡 Tulis di <b>O (Objektif)</b> dengan format: <span className="font-bold text-slate-600">Thorax; [hasil...]</span> untuk auto-display di sini.
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
                </div>

                {/* ======================================================== */}
                {/* 📌 KOLOM 2: RIWAYAT PASIEN (HISTORY LOGS)               */}
                {/* ======================================================== */}
                {/* Bilah Ramping Vertikal saat Riwayat Disembunyikan (Desktop) */}
                {!showHistoryPanel && (
                    <div className="hidden lg:flex flex-col items-center justify-between py-2.5 px-1 w-10 shrink-0 h-full bg-slate-100 border-r border-slate-200 select-none transition-all duration-300 hover:bg-slate-200/80 z-10">
                        <button
                            type="button"
                            onClick={() => setShowHistoryPanel(true)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 flex items-center justify-center text-xs font-black shadow-sm transition cursor-pointer"
                            title="Buka Panel Riwayat Pasien (◀)"
                        >
                            ◀
                        </button>

                        <div
                            onClick={() => setShowHistoryPanel(true)}
                            className="flex flex-col items-center gap-2 cursor-pointer py-4 group"
                            title="Klik untuk membuka riwayat pasien"
                        >
                            <span className="text-sm">🕒</span>
                            <span
                                className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 group-hover:text-indigo-700 transition"
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            >
                                Riwayat Pasien
                            </span>
                            <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[9px] font-bold px-1 py-0.5 rounded-full font-mono">
                                {historyLogs?.length || 0}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowHistoryPanel(true)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center text-[10px] shadow-sm transition cursor-pointer"
                            title="Perluas Riwayat"
                        >
                            🔍
                        </button>
                    </div>
                )}

                <div className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col h-full overflow-hidden bg-slate-50 border-r border-slate-200 animate-in fade-in transition-all duration-300 ${masterTab === 'riwayat' ? 'flex' : showHistoryPanel ? 'hidden lg:flex' : 'hidden'}`}>
                    <div className="p-2 bg-gray-200 border-b border-gray-300 shadow-inner flex justify-between items-center shrink-0">
                        <h3 className="text-[10px] font-bold text-gray-700 uppercase flex items-center gap-1.5">
                            <span>🕒 Riwayat Catatan Pasien</span>
                            <span className="bg-indigo-100 text-indigo-800 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                                {historyLogs?.length || 0}
                            </span>
                        </h3>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-normal italic text-gray-500 hidden xl:inline">Terbaru di atas ⬇</span>
                            <button
                                type="button"
                                onClick={() => setShowHistoryPanel(false)}
                                className="hidden lg:flex items-center gap-1 text-[9px] font-bold bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-1.5 py-0.5 shadow-sm transition cursor-pointer"
                                title="Sembunyikan Panel Riwayat"
                            >
                                <span className="hidden xl:inline">Sembunyikan</span>
                                <span>▶</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-gray-100">
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
                                            {log.savedBy && (
                                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tight">
                                                    👤 {log.savedBy.split(' ')[0]}
                                                </span>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => setRecordForLapor(log)} className="px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded text-[9px] font-bold hover:bg-green-200 flex items-center transition">📱 WA</button>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">S:</span> <span className="text-gray-700">{log.subjective || '-'}</span></div>
                                        <div className="flex gap-2"><span className="font-bold text-red-600 w-3 shrink-0">O:</span> <span className="text-gray-700">{log.objective || '-'}</span></div>
                                        {log.evidenceImages && log.evidenceImages.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {log.evidenceImages.map((img, iIndex) => (
                                                    <img
                                                        key={iIndex}
                                                        src={img}
                                                        className="w-12 h-12 object-cover rounded border border-gray-300 shadow-sm cursor-zoom-in hover:scale-110 transition-transform"
                                                        alt="Lampiran Riwayat"
                                                        onClick={() => window.open(img, '_blank')}
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

                {/* ======================================================== */}
                {/* 📌 KOLOM 3: RUANG CHAT SBAR & DISKUSI HYBRID            */}
                {/* ======================================================== */}
                {/* Bilah Ramping Vertikal saat Chat SBAR Disembunyikan (Desktop) */}
                {!showChatPanel && (
                    <div className="hidden lg:flex flex-col items-center justify-between py-2.5 px-1 w-10 shrink-0 h-full bg-slate-100 border-l border-slate-200 select-none transition-all duration-300 hover:bg-slate-200/80 z-10">
                        <button
                            type="button"
                            onClick={() => setShowChatPanel(true)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 flex items-center justify-center text-xs font-black shadow-sm transition cursor-pointer"
                            title="Buka Panel Chat SBAR (◀)"
                        >
                            ◀
                        </button>

                        <div
                            onClick={() => setShowChatPanel(true)}
                            className="flex flex-col items-center gap-2 cursor-pointer py-4 group"
                            title="Klik untuk membuka chat SBAR"
                        >
                            <span className="text-sm">💬</span>
                            <span
                                className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 group-hover:text-indigo-700 transition"
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            >
                                Chat SBAR
                            </span>
                            {discussions.length > 0 && (
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full font-mono ${channelCounts.all > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700'}`}>
                                    {discussions.length}
                                </span>
                            )}
                        </div>

                        {onStartCall ? (
                            <button
                                type="button"
                                onClick={() => setShowChatPanel(true)}
                                className="w-7 h-7 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center text-[11px] shadow-sm transition cursor-pointer"
                                title="Buka Chat & Panggilan Suara"
                            >
                                📞
                            </button>
                        ) : (
                            <div className="w-7 h-7"></div>
                        )}
                    </div>
                )}

                <div className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col h-full overflow-hidden bg-slate-50 border-r border-slate-200 animate-in fade-in transition-all duration-300 ${masterTab === 'chat' ? 'flex' : showChatPanel ? 'hidden lg:flex' : 'hidden'}`}>
                    
                    {/* HEADER KOLOM 3: CHATROOM / CHANNEL TABS */}
                    <div className="bg-slate-100 border-b border-slate-200 px-2 py-1.5 flex items-center justify-between gap-1.5 shrink-0 select-none">
                        
                        {/* SISI KIRI: TAB CHANNEL (SCROLL MANDIRI JIKA BANYAK DOKTER/RABER) */}
                        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-1 min-w-0 pr-1 py-0.5">
                            <button
                                type="button"
                                onClick={() => setChatChannel('ALL')}
                                className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                            >
                                <span>Semua</span>
                                <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'ALL' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>{channelCounts.all}</span>
                            </button>
                            
                            {/* --- KHUSUS PERAWAT --- */}
                            {currentUser?.role !== 'DPJP' && currentUser?.role !== 'Dokter_Jaga' && (
                                <>
                                    <button onClick={() => { setChatChannel('NURSE_DPJP'); setChatTarget('DPJP'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_DPJP' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        <span>DPJP</span>
                                        {channelCounts.NURSE_DPJP > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_DPJP' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700 font-bold'}`}>{channelCounts.NURSE_DPJP}</span>}
                                    </button>
                                    {formData.raberName && (
                                        <button onClick={() => { setChatChannel('NURSE_RABER1'); setChatTarget(formData.raberName); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_RABER1' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                            <span>Raber 1</span>
                                            {channelCounts.NURSE_RABER1 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_RABER1' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-700 font-bold'}`}>{channelCounts.NURSE_RABER1}</span>}
                                        </button>
                                    )}
                                    {formData.raber2Name && (
                                        <button onClick={() => { setChatChannel('NURSE_RABER2'); setChatTarget(formData.raber2Name); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_RABER2' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                            <span>Raber 2</span>
                                            {channelCounts.NURSE_RABER2 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_RABER2' ? 'bg-orange-800 text-white' : 'bg-orange-100 text-orange-700 font-bold'}`}>{channelCounts.NURSE_RABER2}</span>}
                                        </button>
                                    )}
                                    <button onClick={() => { setChatChannel('NURSE_JAGA'); setChatTarget('Semua Dokter Jaga'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_JAGA' ? 'bg-teal-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        <span>Dr. Jaga</span>
                                        {channelCounts.NURSE_JAGA > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_JAGA' ? 'bg-teal-800 text-white' : 'bg-teal-100 text-teal-700 font-bold'}`}>{channelCounts.NURSE_JAGA}</span>}
                                    </button>
                                </>
                            )}

                            {/* --- KHUSUS DOKTER JAGA --- */}
                            {currentUser?.role === 'Dokter_Jaga' && (
                                <>
                                    <button onClick={() => { setChatChannel('NURSE_JAGA'); setChatTarget('Perawat'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_JAGA' ? 'bg-teal-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        <span>Perawat</span>
                                        {channelCounts.NURSE_JAGA > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_JAGA' ? 'bg-teal-800 text-white' : 'bg-teal-100 text-teal-700 font-bold'}`}>{channelCounts.NURSE_JAGA}</span>}
                                    </button>
                                    <button onClick={() => { setChatChannel('JAGA_DPJP'); setChatTarget('DPJP'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'JAGA_DPJP' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                        <span>DPJP</span>
                                        {channelCounts.JAGA_DPJP > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'JAGA_DPJP' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700 font-bold'}`}>{channelCounts.JAGA_DPJP}</span>}
                                    </button>
                                    {formData.raberName && (
                                        <button onClick={() => { setChatChannel('JAGA_RABER1'); setChatTarget(formData.raberName); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'JAGA_RABER1' ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                            <span>Raber 1</span>
                                            {channelCounts.JAGA_RABER1 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'JAGA_RABER1' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-700 font-bold'}`}>{channelCounts.JAGA_RABER1}</span>}
                                        </button>
                                    )}
                                    {formData.raber2Name && (
                                        <button onClick={() => { setChatChannel('JAGA_RABER2'); setChatTarget(formData.raber2Name); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'JAGA_RABER2' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                            <span>Raber 2</span>
                                            {channelCounts.JAGA_RABER2 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'JAGA_RABER2' ? 'bg-orange-800 text-white' : 'bg-orange-100 text-orange-700 font-bold'}`}>{channelCounts.JAGA_RABER2}</span>}
                                        </button>
                                    )}
                                </>
                            )}

                            {/* --- KHUSUS DPJP / SPESIALIS RABER --- */}
                            {currentUser?.role === 'DPJP' && (
                                <>
                                    {isMatchDoctor(currentUser?.name, formData.raberName) ? (
                                        <>
                                            <button onClick={() => { setChatChannel('NURSE_RABER1'); setChatTarget('Perawat'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_RABER1' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                <span>Perawat</span>
                                                {channelCounts.NURSE_RABER1 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_RABER1' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700 font-bold'}`}>{channelCounts.NURSE_RABER1}</span>}
                                            </button>
                                            <button onClick={() => { setChatChannel('JAGA_RABER1'); setChatTarget('Semua Dokter Jaga'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'JAGA_RABER1' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                <span>Dr. Jaga</span>
                                                {channelCounts.JAGA_RABER1 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'JAGA_RABER1' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700 font-bold'}`}>{channelCounts.JAGA_RABER1}</span>}
                                            </button>
                                        </>
                                    ) : isMatchDoctor(currentUser?.name, formData.raber2Name) ? (
                                        <>
                                            <button onClick={() => { setChatChannel('NURSE_RABER2'); setChatTarget('Perawat'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_RABER2' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                <span>Perawat</span>
                                                {channelCounts.NURSE_RABER2 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_RABER2' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700 font-bold'}`}>{channelCounts.NURSE_RABER2}</span>}
                                            </button>
                                            <button onClick={() => { setChatChannel('JAGA_RABER2'); setChatTarget('Semua Dokter Jaga'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'JAGA_RABER2' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                <span>Dr. Jaga</span>
                                                {channelCounts.JAGA_RABER2 > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'JAGA_RABER2' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700 font-bold'}`}>{channelCounts.JAGA_RABER2}</span>}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => { setChatChannel('NURSE_DPJP'); setChatTarget('Perawat'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'NURSE_DPJP' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                <span>Perawat</span>
                                                {channelCounts.NURSE_DPJP > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'NURSE_DPJP' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700 font-bold'}`}>{channelCounts.NURSE_DPJP}</span>}
                                            </button>
                                            <button onClick={() => { setChatChannel('JAGA_DPJP'); setChatTarget('Semua Dokter Jaga'); }} className={`px-2 py-1 text-[9px] font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 shrink-0 ${chatChannel === 'JAGA_DPJP' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                <span>Dr. Jaga</span>
                                                {channelCounts.JAGA_DPJP > 0 && <span className={`px-1 py-0.2 rounded-full text-[8px] ${chatChannel === 'JAGA_DPJP' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700 font-bold'}`}>{channelCounts.JAGA_DPJP}</span>}
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* SISI KANAN: TERKUNCI (PINNED) - PANGGILAN SUARA/VIDEO + TOMBOL SEMBUNYIKAN */}
                        <div className="flex items-center gap-1 shrink-0 pl-1.5 border-l border-slate-200">
                            {onStartCall && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            let targetName = chatTarget;
                                            let targetRole = 'Dokter';
                                            if (chatTarget === 'DPJP') {
                                                targetName = formData.dpjpName || 'DPJP Utama';
                                                targetRole = 'DPJP';
                                            } else if (chatTarget === 'Semua Dokter Jaga') {
                                                targetName = 'Semua Dokter Jaga';
                                                targetRole = 'Dokter_Jaga';
                                            } else if (chatTarget === 'Perawat') {
                                                targetName = 'Perawat';
                                                targetRole = 'Perawat';
                                            } else if (chatTarget === formData.raberName) {
                                                targetName = formData.raberName;
                                                targetRole = 'DPJP';
                                            } else if (chatTarget === formData.raber2Name) {
                                                targetName = formData.raber2Name;
                                                targetRole = 'DPJP';
                                            } else if (dokterJagaList.some(d => d.name === chatTarget)) {
                                                targetRole = 'Dokter_Jaga';
                                            }

                                            onStartCall({
                                                callType: 'audio',
                                                targetUser: {
                                                    name: targetName,
                                                    role: targetRole,
                                                    rawTarget: chatTarget
                                                },
                                                patientInfo: {
                                                    id: currentRecordId,
                                                    name: formData.name || 'Pasien',
                                                    roomNumber: formData.roomNumber || '-',
                                                    ward: formData.ward || currentUser?.ward || 'MELATI',
                                                    dpjpName: formData.dpjpName || '-',
                                                    raberName: formData.raberName || '',   // 👈 Tambahkan ini
                                                    raber2Name: formData.raber2Name || ''  // 👈 Tambahkan ini
                                                }
                                            });
                                        }}
                                        className="w-6 h-6 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs flex items-center justify-center transition border border-emerald-500 cursor-pointer"
                                        title={`Panggil Suara ke ${chatTarget || 'Rekan Medis'}`}
                                    >
                                        <span className="text-xs">📞</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            let targetName = chatTarget;
                                            let targetRole = 'Dokter';
                                            if (chatTarget === 'DPJP') {
                                                targetName = formData.dpjpName || 'DPJP Utama';
                                                targetRole = 'DPJP';
                                            } else if (chatTarget === 'Semua Dokter Jaga') {
                                                targetName = 'Semua Dokter Jaga';
                                                targetRole = 'Dokter_Jaga';
                                            } else if (chatTarget === 'Perawat') {
                                                targetName = 'Perawat';
                                                targetRole = 'Perawat';
                                            } else if (chatTarget === formData.raberName) {
                                                targetName = formData.raberName;
                                                targetRole = 'DPJP';
                                            } else if (chatTarget === formData.raber2Name) {
                                                targetName = formData.raber2Name;
                                                targetRole = 'DPJP';
                                            } else if (dokterJagaList.some(d => d.name === chatTarget)) {
                                                targetRole = 'Dokter_Jaga';
                                            }

                                            onStartCall({
                                                callType: 'video',
                                                targetUser: {
                                                    name: targetName,
                                                    role: targetRole,
                                                    rawTarget: chatTarget
                                                },
                                                patientInfo: {
                                                    id: currentRecordId,
                                                    name: formData.name || 'Pasien',
                                                    roomNumber: formData.roomNumber || '-',
                                                    ward: formData.ward || currentUser?.ward || 'MELATI',
                                                    dpjpName: formData.dpjpName || '-',
                                                    raberName: formData.raberName || '',   // 👈 Tambahkan ini
                                                    raber2Name: formData.raber2Name || ''  // 👈 Tambahkan ini
                                                }
                                            });
                                        }}
                                        className="w-6 h-6 rounded-md bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xs flex items-center justify-center transition border border-indigo-500 cursor-pointer"
                                        title={`Panggilan Video ke ${chatTarget || 'Rekan Medis'}`}
                                    >
                                        <span className="text-xs">📹</span>
                                    </button>
                                </>
                            )}

                            {/* TOMBOL SEMBUNYIKAN (PINNED PERMANEN, SELALU TERLIHAT) */}
                            <button
                                type="button"
                                onClick={() => setShowChatPanel(false)}
                                className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 shadow-xs transition cursor-pointer"
                                title="Sembunyikan Panel Chat SBAR"
                            >
                                <span className="text-[10px] font-bold">▶</span>
                            </button>
                        </div>
                    </div>

                    {/* A. RUANG OBROLAN STREAM */}
                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {isChatLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-indigo-500 py-10">
                                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[10px] font-bold text-slate-400">Memuat riwayat chat...</span>
                            </div>
                        ) : filteredDiscussions.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                                <span className="text-4xl opacity-20 mb-2">💬</span>
                                <span className="text-slate-400 italic text-[11px] font-medium">
                                    Belum ada percakapan pada saluran ini.
                                </span>
                                <span className="text-slate-400 text-[9px]">Gunakan form di bawah untuk mengirim pesan / konsul.</span>
                            </div>
                        ) : (
                            filteredDiscussions.map((chat) => {
                                const isMe = chat.senderName === currentUser.name;
                                const isDPJP = chat.role === 'DPJP';
                                const isJaga = chat.role === 'Dokter_Jaga';
                                const isDoctor = isDPJP || isJaga;
                                const imgAttachment = chat.attachment || chat.imageUrl || chat.image;

                                return (
                                    <div key={chat.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className="text-[8px] text-slate-400 font-bold mb-0.5 px-1 flex items-center gap-1">
                                            <span className={`px-1 py-0.2 rounded text-[7px] font-black uppercase ${isDPJP ? 'bg-rose-100 text-rose-800' : isJaga ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700'}`}>
                                                {isDPJP ? '👨‍⚕️ DPJP/Raber' : isJaga ? '🩺 Dr. Jaga' : '🙋 Perawat'}
                                            </span>
                                            <span className="font-bold text-slate-700">{chat.senderName}</span>
                                        </div>
                                        <div className={`relative max-w-[88%] p-2.5 rounded-xl text-[11px] shadow-sm ${isMe ? 'bg-indigo-100 text-indigo-950 rounded-tr-none border border-indigo-200' : isDPJP ? 'bg-rose-50 text-rose-950 rounded-tl-none border border-rose-200' : isJaga ? 'bg-teal-50 text-teal-950 rounded-tl-none border border-teal-200' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}`}>

                                            {/* Badges Info */}
                                            <div className="flex flex-wrap items-center gap-1 mb-1.5">
                                                {chat.isProxyWa && <div className="text-[8px] bg-rose-200/50 text-rose-700 px-1.5 py-0.5 rounded font-bold border border-rose-300">📥 Di-copas WA oleh Ns. {chat.loggedBy?.split(' ')[0]}</div>}
                                                {chat.targetRecipient && <span className="text-[8px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-300">➔ Ke: {chat.targetRecipient}</span>}
                                                {chat.urgency === 'CITO' && <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-300 animate-pulse">🚨 PANGGILAN CITO</span>}
                                                {chat.urgency === 'DELEGASI' && <span className="text-[8px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-300">📋 DELEGASI VISITE</span>}
                                            </div>

                                            {/* Foto / Lampiran Chat */}
                                            {imgAttachment && (
                                                <div className="mb-2">
                                                    <img
                                                        src={imgAttachment}
                                                        alt="Lampiran Chat"
                                                        className="max-h-48 w-auto max-w-full rounded-lg object-contain border border-slate-200 shadow-sm cursor-zoom-in hover:opacity-95 transition bg-black/5"
                                                        onClick={() => window.open(imgAttachment, '_blank')}
                                                        title="Klik untuk melihat ukuran penuh"
                                                    />
                                                </div>
                                            )}

                                            {/* Pesan Teks */}
                                            {chat.message && (
                                                <div className="font-medium leading-relaxed whitespace-pre-wrap">{chat.message}</div>
                                            )}

                                            {/* ⚡ TOMBOL EKSEKUSI TBAK (Khusus Pesan Dokter) */}
                                            {isDoctor && (
                                                <div className="mt-2 pt-1.5 border-t border-rose-200/50 flex flex-wrap gap-1.5">
                                                    <button type="button" onClick={() => { appendText('planning', `Advis ${chat.senderName}: ${chat.message}`); alert('✅ Instruksi disalin ke kotak P!'); }} className="bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[8px] font-black transition shadow-sm">⚡ Jadikan P</button>
                                                    <button type="button" onClick={() => { const currentRx = formData.currentPrescription || ''; const newRx = `- ${chat.message} (Advis ${chat.senderName})`; handleInputChange({ target: { name: 'currentPrescription', value: currentRx ? `${newRx}\n\n${currentRx}` : newRx } }); alert('💊 Disalin ke Resep Obat Paten!'); }} className="bg-white text-purple-600 hover:bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[8px] font-black transition shadow-sm">💊 Jadikan Resep</button>
                                                </div>
                                            )}

                                            {/* ✨ TIMESTAMP + INDIKATOR CENTANG WA (✓ / ✓✓) */}
                                            <div className="flex items-center justify-end gap-1 mt-1 text-[8px] text-slate-400">
                                                <span>
                                                    {new Date(chat.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && (
                                                    chat.status === 'read' ? (
                                                        <span className="text-sky-500 font-bold flex items-center" title="Dibaca">
                                                            <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-bold flex items-center" title="Terkirim">
                                                            <Check className="w-3 h-3 stroke-[2.5]" />
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* B. AREA INPUT HYBRID */}
                    {currentUser?.role === 'Dokter_Jaga' && chatChannel === 'NURSE_DPJP' ? (
                        <div className="bg-rose-50 border-t border-rose-200 p-3 text-center text-rose-700 text-xs font-bold italic shrink-0">
                            🔒 Saluran ini khusus Perawat dan Spesialis. Dokter Jaga tidak dapat membalas di sini.
                        </div>
                    ) : (
                        <div className="bg-white border-t border-slate-200 p-2 space-y-2 shrink-0">
                            {/* SAKLAR MODE & GENERATOR TEMPLATE */}
                            <div className="flex justify-between items-center">
                                <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 w-max">
                                    <button type="button" onClick={() => setIsWaMode(false)} className={`px-2 py-0.5 text-[9px] font-bold rounded transition ${!isWaMode ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🙋 Lapor Saya</button>
                                    <button type="button" onClick={() => setIsWaMode(true)} className={`px-2 py-0.5 text-[9px] font-bold rounded transition ${isWaMode ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📥 Copas Jawaban</button>
                                </div>

                                {!isWaMode && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {chatTarget && chatTarget !== 'Semua Dokter Jaga' && chatTarget !== 'Perawat' && (
                                            <button type="button" onClick={handleGenerateLembarKonsul} className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md font-bold hover:bg-blue-100 transition shadow-sm flex items-center gap-1" title="Gunakan format template lembar konsul resmi">
                                                📄 Konsul
                                            </button>
                                        )}
                                        <button type="button" onClick={handleGenerateSBAR} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold hover:bg-emerald-100 transition shadow-sm flex items-center gap-1">
                                            <span className="animate-pulse">✨</span> SBAR
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* PANEL KONTROL KEPADA & TINGKAT URGENSI */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                                <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                                    <label className="text-[9px] font-bold text-slate-600 shrink-0">Ke:</label>
                                    <select
                                        value={chatTarget}
                                        onChange={(e) => setChatTarget(e.target.value)}
                                        className="w-full text-[9px] font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 text-indigo-900"
                                    >
                                        {chatChannel === 'NURSE_JAGA' && (
                                            <>
                                                <option value="Semua Dokter Jaga">Semua Dokter Jaga</option>
                                                {dokterJagaList.map((doc) => (<option key={doc.id} value={doc.name}>dr. {doc.name.replace(/^dr\.\s*/i, '')}</option>))}
                                            </>
                                        )}
                                        {(chatChannel === 'NURSE_DPJP' || chatChannel === 'JAGA_DPJP' || chatChannel === 'ALL') && (
                                            <>
                                                <option value="DPJP">DPJP ({formData.dpjpName || 'Utama'})</option>
                                                {formData.raberName && <option value={formData.raberName}>Raber 1 ({formData.raberName})</option>}
                                                {formData.raber2Name && <option value={formData.raber2Name}>Raber 2 ({formData.raber2Name})</option>}
                                            </>
                                        )}
                                        {currentUser?.role === 'Dokter_Jaga' && <option value="Perawat">Perawat / Ruangan</option>}
                                    </select>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button type="button" onClick={() => setUrgencyTag('NORMAL')} className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition border ${urgencyTag === 'NORMAL' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>🟢 Rutin</button>
                                    <button type="button" onClick={() => setUrgencyTag('DELEGASI')} className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition border ${urgencyTag === 'DELEGASI' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>📋 Delegasi</button>
                                    <button type="button" onClick={() => setUrgencyTag('CITO')} className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition border ${urgencyTag === 'CITO' ? 'bg-red-600 text-white border-red-600 shadow-sm animate-pulse' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>🚨 CITO</button>
                                </div>
                            </div>

                            {/* ✨ PREVIEW LAMPIRAN FOTO DI CHAT SEBELUM KIRIM */}
                            {chatAttachment && (
                                <div className="relative inline-flex items-center gap-2 p-1.5 bg-slate-100 rounded-lg border border-slate-300 w-fit">
                                    <img src={chatAttachment} alt="Preview Lampiran" className="h-12 w-12 object-cover rounded border border-slate-200" />
                                    <div className="flex flex-col text-[9px] text-slate-600">
                                        <span className="font-bold text-slate-800">📸 Foto Siap Dikirim</span>
                                        <span className="text-[8px] text-slate-400">Klik Kirim untuk melampirkan</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setChatAttachment(null)}
                                        className="ml-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center shadow"
                                        title="Hapus foto"
                                    >✕</button>
                                </div>
                            )}

                            {/* KOTAK KETIK + TOMBOL SISIPKAN FOTO (📎 / 📷) */}
                            <div className="flex gap-1.5 items-end">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={chatFileInputRef}
                                    onChange={handleChatImageUpload}
                                    className="hidden"
                                />

                                <div className="relative shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const radImages = formData?.radiologyImages || [];
                                            if (radImages.length === 0) {
                                                chatFileInputRef.current?.click();
                                            } else {
                                                setShowAttachMenu(prev => !prev);
                                            }
                                        }}
                                        disabled={isUploadingChatImg}
                                        className={`p-2 rounded-xl border transition shadow-sm flex items-center justify-center h-12 w-10 ${chatAttachment ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}
                                        title="Sisipkan Foto/Gambar (📎)"
                                    >
                                        {isUploadingChatImg ? (
                                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <Paperclip className="w-4 h-4" />
                                        )}
                                    </button>

                                    {/* Popover Menu Pilihan Attachment jika Berkas Radiologi Pasien Tersedia */}
                                    {showAttachMenu && (
                                        <>
                                            {/* Click-outside backdrop */}
                                            <div
                                                className="fixed inset-0 z-30"
                                                onClick={() => setShowAttachMenu(false)}
                                            />
                                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150 text-left">
                                                <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                    Sisipkan Lampiran Chat
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowAttachMenu(false);
                                                        chatFileInputRef.current?.click();
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition cursor-pointer"
                                                >
                                                    <span className="text-base">📁</span>
                                                    <div>
                                                        <div className="text-xs font-bold leading-tight">Unggah File Baru</div>
                                                        <div className="text-[9px] text-slate-400 font-normal">Dari galeri / kamera perangkat</div>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowAttachMenu(false);
                                                        setShowRadPickerModal(true);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 flex items-center gap-2.5 transition border-t border-slate-100 cursor-pointer"
                                                >
                                                    <span className="text-base">🩻</span>
                                                    <div>
                                                        <div className="text-xs font-bold leading-tight flex items-center gap-1">
                                                            <span>Berkas Radiologi Pasien</span>
                                                            <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.2 rounded-full font-bold">
                                                                {formData?.radiologyImages?.length || 0}
                                                            </span>
                                                        </div>
                                                        <div className="text-[9px] text-indigo-500 font-normal">Pilih dari foto Rontgen/USG/EKG tersimpan</div>
                                                    </div>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <textarea
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder={isWaMode ? `Paste instruksi di sini...` : urgencyTag === 'CITO' ? "🚨 Ketik panggilan darurat..." : "Ketik pesan / laporan..."}
                                    className={`flex-1 text-[11px] font-medium p-2 border rounded-xl outline-none focus:ring-2 resize-none h-12 custom-scrollbar shadow-inner transition-colors ${isWaMode ? 'bg-rose-50 border-rose-300 focus:ring-rose-500 text-rose-900' : urgencyTag === 'CITO' ? 'bg-red-50/80 border-red-300 focus:ring-red-500 text-red-950 placeholder-red-400' : urgencyTag === 'DELEGASI' ? 'bg-amber-50/60 border-amber-300 focus:ring-amber-500 text-amber-950' : 'bg-indigo-50/50 border-indigo-200 focus:ring-indigo-500 text-indigo-950'}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendChat();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSendChat}
                                    disabled={(!chatInput.trim() && !chatAttachment) || !currentRecordId || isUploadingChatImg}
                                    className={`px-3 h-12 rounded-xl font-black text-xs transition shadow-sm flex items-center justify-center shrink-0 ${(!chatInput.trim() && !chatAttachment) || !currentRecordId ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : isWaMode ? 'bg-rose-600 hover:bg-rose-700 text-white' : urgencyTag === 'CITO' ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                                >
                                    {isWaMode ? 'Simpan' : urgencyTag === 'CITO' ? '🚨 CITO' : 'Kirim'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Pemilih Berkas Radiologi Pasien */}
            {showRadPickerModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-4 py-3 bg-gradient-to-r from-indigo-700 to-indigo-800 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🩻</span>
                                <div>
                                    <h3 className="text-xs font-bold leading-tight">Pilih Berkas Radiologi Pasien</h3>
                                    <p className="text-[10px] text-indigo-200 font-medium">
                                        Klik salah satu foto untuk melampirkan ke pesan chat
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRadPickerModal(false)}
                                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xs font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Grid Daftar Gambar */}
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-slate-50">
                            {formData?.radiologyImages && formData.radiologyImages.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2.5">
                                    {formData.radiologyImages.map((img, idx) => (
                                        <div
                                            key={img.id || idx}
                                            onClick={() => {
                                                setChatAttachment(img.imageUrl);
                                                if (!chatInput.trim()) {
                                                    setChatInput(`Lampiran [${img.category || 'Radiologi'}]: `);
                                                }
                                                setShowRadPickerModal(false);
                                            }}
                                            className="group relative bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition flex flex-col"
                                        >
                                            <div className="relative aspect-square w-full bg-black/5 overflow-hidden">
                                                <img
                                                    src={img.imageUrl}
                                                    alt={img.category}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                />
                                                <span className="absolute top-1.5 left-1.5 text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold shadow-sm uppercase tracking-wider">
                                                    {img.category || 'Foto'}
                                                </span>
                                            </div>
                                            <div className="p-2 flex flex-col justify-between flex-1 bg-white">
                                                <div className="flex justify-between items-center text-[9px] text-slate-500 font-medium mb-1">
                                                    <span>📅 {img.date || '-'}</span>
                                                    <span>⏰ {img.time || ''}</span>
                                                </div>
                                                {img.uploadedBy && (
                                                    <div className="text-[8px] text-slate-400 truncate">
                                                        👤 Oleh: {img.uploadedBy}
                                                    </div>
                                                )}
                                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-indigo-600 text-[9px] font-bold">
                                                    <span>Sisipkan ke Chat</span>
                                                    <span className="group-hover:translate-x-0.5 transition-transform">➔</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400 flex flex-col items-center justify-center gap-2">
                                    <span className="text-3xl opacity-40">🖼️</span>
                                    <p className="text-xs font-medium">Belum ada foto/berkas radiologi pada pasien ini.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-2.5 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
                            <span className="text-[9px] text-slate-400">
                                Total: {formData?.radiologyImages?.length || 0} berkas foto
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowRadPickerModal(false)}
                                className="px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Smart Paste Universal Ecalyptus */}
            {showSmartPaste && (
                <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-indigo-500 p-4 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                                <span>⚡ Smart Paste Ecalyptus (Universal)</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => { setShowSmartPaste(false); setRawPasteData(''); }}
                                className="text-gray-400 hover:text-red-500 text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="text-[10px] text-gray-600 mb-2.5 bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 leading-relaxed">
                            <span className="font-bold text-indigo-900 block mb-1">📋 Panduan Smart Paste Universal:</span>
                            1. Di Ecalyptus, Blok data <b>Profil Pasien</b> (Nama, RM, DPJP), atau <b>Catatan SOAP</b> (Subjektif s/d Resep Obat), atau <b>KEDUANYA</b> sekaligus.<br />
                            2. Copy (<b>Ctrl+C</b>) lalu Paste (<b>Ctrl+V</b>) di kotak bawah ini.<br />
                            3. Sistem otomatis mengenali dan mengisi field Profil & kolom SOAP yang sesuai 🚀.
                        </div>
                        <textarea
                            className="w-full h-36 border border-gray-300 rounded-xl p-2.5 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none mb-3 resize-none shadow-inner"
                            placeholder="Paste teks profil / SOAP Ecalyptus di sini..."
                            value={rawPasteData}
                            onChange={(e) => setRawPasteData(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { setShowSmartPaste(false); setRawPasteData(''); }}
                                className="flex-1 py-2 text-xs font-bold border border-gray-300 rounded-xl hover:bg-gray-100 text-gray-700 transition cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleProcessSmartPaste}
                                disabled={!rawPasteData.trim()}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl shadow-md transition ${!rawPasteData.trim() ? 'bg-indigo-300 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'}`}
                            >
                                Proses & Masukkan 🚀
                            </button>
                        </div>
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