import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    Timestamp,
    orderBy,
    getDocs,
    getDoc,
    limit,
} from 'firebase/firestore';
import { AuthScreen } from './components/AuthScreen';
import Cashflow from './components/Cashflow';
import GudangArsip from './components/GudangArsip';
import LabHistoryTable from './components/LabHistoryTable'; // 👈 Tambahkan ini di atas
import TtvHistory from './components/TtvHistory'; // 👈 Tambahkan baris ini
import PatientTable from './components/PatientTable';
import BukuCMTable from './components/BukuCMTable'; // 👈 Taruh di deretan komponen lain
import { GlobalMedicationBoard, MedicationMarModal } from './components/MedicationBoard';
import PatientForm from './components/PatientForm';
import RoomMap from './components/RoomMap';
import {
    formatDateCM, hitungHariCM, getAntibioticDay, parsePlanning, parseDateCM,
    renderLacakTtv, renderObjectiveCell, renderPlanningCell, CustomInput, extractLabSnapshot,
    generateShiftReport, getLabInfo, updateTransfusionText
} from './utils/helpers';
import {
    LEFT_ROOMS, RIGHT_ROOMS, ROOM_LIST,
    DEFAULT_DPJP_DATA, LAB_CHECKS, RADIOLOGY_CHECKS,
    PROCEDURES, MEDICATIONS, WARD_CONFIG, LAB_NORMAL_RANGES, ANTIBIOTICS_DB,
    MEDICATION_TRANSLATOR, LAB_TRANSLATOR, LAB_DICTIONARY,
    LAB_PATTERNS, LAB_LOW_IS_BAD, LAB_TUBEX_POSITIVE_THRESHOLD
} from './constants';
import { LogOut, Wallet, FileText, ChevronLeft } from 'lucide-react';
import { PrintView, BulkPrintView, FormattedObjective, autoSmartDateTransformer, handlePrintTTV, handlePrintSOAP, handlePrintBukuCM } from './components/PrintManager';
import { TtvModal, DischargeModal, LaporModal, ConfirmationModal, LaporConfirmationModal, WaitingListInputPanel } from './components/Modals';
import { RoomFilterDropdown, DpjpFilterDropdown, DigitalClock } from './components/DashboardHelpers';
import { HandoverModal, BulkHandoverModal } from './components/HandoverModal';
import { BukuEkspedisiModal } from './components/BukuEkspedisi';

// --- Global Firebase Configuration (SECURED) ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 🔥 1. TARUH DI SINI: Inisialisasi abadi di LUAR komponen
export const app = initializeApp(firebaseConfig);

const initialDpjpProfiles = DEFAULT_DPJP_DATA;

// --- LOGIC UTAMA (MEDICAL RECORD APP - LEVEL 4 COMPLETED) ---
const MedicalRecordApp = ({
    db, userId, appId, isOnline, onLogout,
    currentUser, setAppMode, cashflowRole, onSwitchWard
}) => {

    // ✨ 1. STATE PENAMPUNG DENAH DINAMIS (FASE 2)
    const [dynamicWards, setDynamicWards] = useState({});

    // ✨ 2. SUNTIKAN TAHAP 3: MASTER KEY BANGSAL (DINAMIS DARI FIREBASE)
    const currentWardName = currentUser?.ward || 'MELATI';

    // 👇 FIX: Cari key denah yang cocok walaupun huruf besar/kecilnya beda (Case-Insensitive Failsafe)
    const matchingKey = Object.keys(dynamicWards).find(
        k => k.toLowerCase() === currentWardName.toLowerCase()
    ) || currentWardName;

    const currentWardConfig = dynamicWards[matchingKey] || WARD_CONFIG[currentWardName] || {
        name: currentWardName.charAt(0) + currentWardName.slice(1).toLowerCase(),
        roomList: [], leftRooms: [], rightRooms: []
    };

    // ✨ 3. FITUR BARU: BUILDER DENAH MANUAL DI SETELAN
    const [rebuildForm, setRebuildForm] = useState({ bedCount: 20, layout: '2baris', bedFormat: 'K1' });

    // ✨ FASE 2: UNIVERSAL ROOM BUILDER & SPAWNER (SUPERADMIN CONTROL)
    const handleRebuildWard = async (e) => {
        e.preventDefault();

        // Tentukan target eksekusi (Gunakan input form, jika kosong fallback ke lokasi admin aktif)
        const targetRs = (rebuildForm.rsTarget || currentUser.hospital || 'RSUD BAYU ASIH').toUpperCase().trim();
        const targetWard = (rebuildForm.wardTarget || currentUser.ward || 'MELATI').toUpperCase().trim();

        if (!targetRs || !targetWard) return alert("Nama Rumah Sakit dan Ruangan tidak boleh kosong!");
        if (!confirm(`Apakah Anda yakin ingin membangun/memodifikasi denah Ruang ${targetWard} di ${targetRs}?`)) return;

        const count = rebuildForm.bedCount || 20;
        const format = rebuildForm.bedFormat || 'K1';
        const layout = rebuildForm.layout || '2baris';
        const rooms = [];

        // 1. Generate Array Nama Kasur
        for (let i = 1; i <= count; i++) {
            if (format === 'K1') rooms.push(`K${i}`);
            else if (format === '1A') rooms.push(`${Math.ceil(i / 2)}${i % 2 === 1 ? 'A' : 'B'}`);
            else rooms.push(`${i}`);
        }

        // 2. Pembagian Lorong
        let left = [], right = [];
        if (layout === '1baris') {
            left = rooms;
        } else {
            const mid = Math.ceil(rooms.length / 2);
            left = rooms.slice(0, mid);
            right = rooms.slice(mid);
        }
        const newWardConfig = { roomList: rooms, leftRooms: left, rightRooms: right, name: targetWard };

        // 3. Tembak ke Dokumen Konfigurasi RS Target
        const safeHospName = targetRs.replace(/\s+/g, '_').toUpperCase();
        const configRef = doc(db, `artifacts/${appId}/public/data/settings_${safeHospName}`, 'mainConfig');

        try {
            const snap = await getDoc(configRef);
            let existingWards = snap.exists() && snap.data().wards ? snap.data().wards : {};
            existingWards[targetWard] = newWardConfig; // Daftarkan atau timpa denah ruangan target

            await setDoc(configRef, {
                wards: existingWards,
                // Jika RS ini baru pertama kali dilahirkan oleh Abi, inisialisasi laci datanya agar kosong melompong (Anti-Bocor!)
                ...(snap.exists() ? {} : {
                    dpjpProfiles: targetRs === 'RSUD BAYU ASIH' ? initialDpjpProfiles : [],
                    masterLabs: [], masterRads: [], masterProcedures: [], masterMedications: []
                })
            }, { merge: true });

            alert(`🎉 Sukses! Denah Ruang ${targetWard} di ${targetRs} berhasil dibangun.`);

            // Bersihkan form input target khusus superadmin
            setRebuildForm(prev => ({ ...prev, rsTarget: '', wardTarget: '' }));
        } catch (e) {
            alert("Gagal membangun denah: " + e.message);
        }
    };

    // ✨ 4. STATE UNTUK POP-UP WELCOME GREETING
    const [showWelcomeToast, setShowWelcomeToast] = useState(true);
    useEffect(() => {
        // Hilangkan toast setelah 4.5 detik
        const timer = setTimeout(() => setShowWelcomeToast(false), 4500);
        return () => clearTimeout(timer);
    }, []);

    // --- STATE LEVEL 4: MANAJEMEN USER (BARU) ---
    const [allUsers, setAllUsers] = useState([]); // Daftar user (Admin Only)
    const [profileForm, setProfileForm] = useState({ name: '', pass: '' }); // Form Profil Sendiri
    const [adminUserForm, setAdminUserForm] = useState({ id: '', name: '', pass: '', role: 'member', ward: 'MELATI' });

    // ✨ STATE NAVIGASI KEYBOARD UNTUK MENU DROPDOWN UTAMA
    const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
    const [mainMenuHighlight, setMainMenuHighlight] = useState(-1);
    const menuWrapperRef = useRef(null);
    const [isMarModalOpen, setIsMarModalOpen] = useState(false);
    const [marSelectedRecord, setMarSelectedRecord] = useState(null);

    // ✨ STATE UNTUK MENU ACCORDION GOD MODE
    const [expandedHospital, setExpandedHospital] = useState(null);

    // ✨ RADAR PENDETEKSI RUMAH SAKIT & RUANGAN (MENU GOD MODE)
    const hospitalWardsList = useMemo(() => {
        const hw = {
            'RSUD BAYU ASIH': {
                originalName: 'RSUD BAYU ASIH',
                wards: new Map([
                    ['MELATI', 'MELATI'], ['DAHLIA', 'DAHLIA'], ['TERATAI', 'TERATAI'],
                    ['ANYELIR', 'ANYELIR'], ['ANGGREK', 'ANGGREK']
                ])
            }
        };
        allUsers.forEach(u => {
            // ✨ FIX 1: Beri label otomatis untuk akun jadul yang belum punya RS/Ruangan
            const safeHosp = u.hospital || 'RSUD BAYU ASIH';
            const safeWard = u.ward || 'MELATI';

            const hKey = safeHosp.toUpperCase();
            const wKey = safeWard.toUpperCase();

            if (!hw[hKey]) {
                hw[hKey] = { originalName: safeHosp, wards: new Map() };
            }
            if (!hw[hKey].wards.has(wKey)) {
                hw[hKey].wards.set(wKey, safeWard);
            }
        });

        const result = {};
        Object.keys(hw).forEach(k => {
            result[k] = {
                originalName: hw[k].originalName,
                wards: Array.from(hw[k].wards.values()).sort()
            };
        });
        return result;
    }, [allUsers]);

    // ✨ FUNGSI ACC (APPROVE) USER BARU
    const handleAccUser = async (targetId) => {
        if (!confirm("Setujui akun ini? User akan bisa langsung login.")) return;
        try {
            await updateDoc(doc(db, 'users', targetId), { status: 'approved' });
            alert("✅ Akun berhasil disetujui (ACC)!");
        } catch (e) {
            alert("Gagal ACC: " + e.message);
        }
    };

    // ✨ FITUR BARU: TOMBOL PENGHANCUR RS (KHUSUS SUPERADMIN)
    const handleDeleteHospital = async (rsKey, rsOriginalName) => {
        if (rsKey === 'RSUD BAYU ASIH') {
            return alert("❌ RSUD BAYU ASIH adalah rumah sakit pusat bawaan sistem utama dan TIDAK BOLEH dihapus!");
        }

        if (!confirm(`⚠️ PERINGATAN SANGAT KERAS, MANDOR! ⚠️\n\nApakah Anda yakin ingin menghapus RUMAH SAKIT "${rsOriginalName}" secara permanen?\n\nTindakan ini akan otomatis menyapu bersih:\n1. Cetak biru denah seluruh ruangan di RS ini.\n2. Seluruh akun perawat/staf yang bernaung di RS ini.\n\nData yang sudah terhapus tidak akan bisa dikembalikan lagi!`)) return;

        try {
            setLoading(true);
            const safeHospName = rsKey.replace(/\s+/g, '_').toUpperCase();

            // 1. Hapus Dokumen Konfigurasi Denah & Master Data RS di Firebase
            const configRef = doc(db, `artifacts/${appId}/public/data/settings_${safeHospName}`, 'mainConfig');
            await deleteDoc(configRef);

            // 2. Sapu Bersih Semua User yang Terikat dengan RS ini agar hilang dari Accordion UI
            const rsUsers = allUsers.filter(u => (u.hospital || 'RSUD BAYU ASIH').toUpperCase() === rsKey);
            const deletePromises = rsUsers.map(u => deleteDoc(doc(db, 'users', u.id)));
            await Promise.all(deletePromises);

            alert(`✅ Sukses Besar! Rumah Sakit "${rsOriginalName}" beserta seluruh akun anggotanya telah dihapus bersih dari sistem.`);
        } catch (e) {
            alert("Gagal menghapus Rumah Sakit: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-close menu jika pengguna klik di luar area menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuWrapperRef.current && !menuWrapperRef.current.contains(event.target)) {
                setIsMainMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Susunan daftar menu aktif secara dinamis untuk dibaca oleh Keyboard index
    const activeMenuItems = useMemo(() => {
        const items = [
            { type: 'link', label: '☕ Traktir Kopi?', href: 'https://trakteer.id/481nugroho' },
            { type: 'view', label: '🏠 Dashboard', value: 'dashboard' },
            { type: 'view', label: '📋 Daftar Pasien', value: 'patient-list' },
            { type: 'view', label: '⚙️ Setelan', value: 'settings' },
            // ✨ FIX: Gudang Arsip dipindah ke paling bawah kelompok menu utama
            { type: 'view', label: '🗃️ Gudang Arsip Pasien', value: 'archived-list' }
        ];
        if (cashflowRole) items.push({ type: 'finance', label: 'Panel Keuangan' });
        if (currentUser?.role === 'SUPERADMIN' || currentUser?.name?.toLowerCase().includes('abi')) {
            ['MELATI', 'DAHLIA', 'TERATAI', 'ANYELIR', 'ANGGREK'].forEach(w => items.push({ type: 'ward', label: `🏥 Ruang ${w}`, ward: w }));
        }
        items.push({ type: 'logout', label: '🚪 Keluar' });
        return items;
    }, [cashflowRole, currentUser]);

    // Mesin pembaca navigasi keyboard
    const handleMenuKeyDown = (e) => {
        if (!isMainMenuOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                setIsMainMenuOpen(true);
                setMainMenuHighlight(0);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setMainMenuHighlight(prev => (prev < activeMenuItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMainMenuHighlight(prev => (prev > 0 ? prev - 1 : activeMenuItems.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (mainMenuHighlight >= 0 && mainMenuHighlight < activeMenuItems.length) {
                const item = activeMenuItems[mainMenuHighlight];
                if (item.type === 'link') window.open(item.href, '_blank');
                else if (item.type === 'view') setView(item.value);
                else if (item.type === 'finance') setAppMode('KEUANGAN');
                else if (item.type === 'ward') onSwitchWard(item.ward);
                else if (item.type === 'logout') onLogout();
                setIsMainMenuOpen(false);
                setMainMenuHighlight(-1);
            }
        } else if (e.key === 'Escape') {
            setIsMainMenuOpen(false);
        }
    };

    // Helper pencari index item
    const getMenuIdx = (type, val = '') => {
        return activeMenuItems.findIndex(item => {
            if (type === 'link' || type === 'finance' || type === 'logout') return item.type === type;
            if (type === 'view') return item.type === 'view' && item.value === val;
            if (type === 'ward') return item.type === 'ward' && item.ward === val;
            return false;
        });
    };

    // Helper pembuat huruf Kapital awal kata
    const toTitleCase = (str) => str.toLowerCase().replace(/(?:^|\s)\w/g, m => m.toUpperCase());

    // --- STATE LAMA (TETAP ADA) ---
    const [records, setRecords] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeRecords, setActiveRecords] = useState([]);
    const [archivedRecords, setArchivedRecords] = useState([]);
    const [occupiedRooms, setOccupiedRooms] = useState([]);
    const [waitingList, setWaitingList] = useState([]);
    const [showWaitingModal, setShowWaitingModal] = useState(false);
    const [quickTtvTarget, setQuickTtvTarget] = useState(null);
    const [archiveSearch, setArchiveSearch] = useState('');
    // ✨ MODE SOAP: 'personal' = catatan pribadi perawat, 'ruangan' = catatan gabungan/final
    const [soapMode, setSoapMode] = useState('personal');

    // ✨ FASE 2 & 3: ISOLASI STATE DPJP MURNI PER RUMAH SAKIT (ANTI-BOCOR)
    const [dpjpProfiles, setDpjpProfiles] = useState(() => {
        try {
            const hosp = currentUser?.hospital || 'RSUD BAYU ASIH';
            const safeHospName = hosp.replace(/\s+/g, '_').toUpperCase();
            const localData = JSON.parse(localStorage.getItem(`backupDpjp_${safeHospName}`));
            if (localData && localData.length > 0) return localData;
        } catch (e) { }

        // Hanya berikan dokter bawaan pabrik jika usernya terdaftar di RSUD Bayu Asih
        const isBayuAsih = currentUser?.hospital?.toUpperCase() === 'RSUD BAYU ASIH';
        return isBayuAsih ? initialDpjpProfiles.map(p => ({ ...p, name: p.name })) : [];
    });
    // Master data lists (lab, radiologi, tindakan, terapi) -- dapat diubah lewat Setelan
    // Load dari localStorage sebagai fallback jika Firebase lambat/error
    const [masterLabs, setMasterLabs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('masterLabs')) || []; } catch { return []; }
    });
    const [masterRads, setMasterRads] = useState(() => {
        try { return JSON.parse(localStorage.getItem('masterRads')) || []; } catch { return []; }
    });
    const [masterProcedures, setMasterProcedures] = useState(() => {
        try { return JSON.parse(localStorage.getItem('masterProcedures')) || []; } catch { return []; }
    });
    const [masterMedications, setMasterMedications] = useState(() => {
        try { return JSON.parse(localStorage.getItem('masterMedications')) || []; } catch { return []; }
    });
    // Input fields for master data
    const [newMasterLab, setNewMasterLab] = useState('');
    const [newMasterRad, setNewMasterRad] = useState('');
    const [newMasterProcedure, setNewMasterProcedure] = useState('');
    const [newMasterMedication, setNewMasterMedication] = useState('');
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
    const [settingsError, setSettingsError] = useState(null);

    // Combined planning options (prefer master lists when available)
    const combinedPlanningOptions = useMemo(() => {
        const labs = Array.from(new Set([...(LAB_CHECKS || []), ...masterLabs])).map(i => ({ label: i, type: 'Lab' }));
        const rads = Array.from(new Set([...(RADIOLOGY_CHECKS || []), ...masterRads])).map(i => ({ label: i, type: 'Rad' }));
        const prots = Array.from(new Set([...(PROCEDURES || []), ...masterProcedures])).map(i => ({ label: i, type: 'Med' }));
        const meds = Array.from(new Set([...(MEDICATIONS || []), ...masterMedications])).map(i => ({ label: i, type: 'Rx' }));

        // ✨ SUNTIKAN BARU: Daftarkan Item Bertipe 'Protocol'
        const protocols = [
            { label: 'Protokol Sliding Scale (SC)', type: 'Protocol', isi: 'Th. Sliding Scale (SC tiap 4 jam):\n< 150 : 0 Unit\n150 - 200 : 4 Unit\n200 - 250 : 8 Unit\n250 - 300 : 12 Unit\n300 - 350 : 16 Unit\n350 - 400 : 20 Unit\n> 400 : 24 Unit' },
            { label: 'Protokol GDS (dr. Dian)', type: 'Protocol', isi: 'Th. Cek GDS per 2 jam:\n- Jika GDS > 200 ganti D5% 20 tpm\n- Jika dgn D5% 20 tpm GDS > 200, ganti dgn NaCl 0.9% 20 tpm' }
        ];

        return [...labs, ...rads, ...prots, ...meds, ...protocols].sort((a, b) => a.label.localeCompare(b.label));
    }, [masterLabs, masterRads, masterProcedures, masterMedications]);

    const [view, setView] = useState('dashboard');
    const [rightDashboardTab, setRightDashboardTab] = useState('soap-apo'); // State untuk memori saklar kanan
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentRecordId, setCurrentRecordId] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);
    // ✨ STATE UNTUK CARD TABS (Lab/Radiology)
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [expandedCardTab, setExpandedCardTab] = useState('Lab');
    // --- ANTENA PEMBACA RIWAYAT SOAP (REAL-TIME MULTIUSER) ---
    useEffect(() => {
        // Pelindung agar tidak blank
        if (!db || !appId || !currentRecordId) {
            setHistoryLogs([]);
            return;
        }

        try {
            // ✨ FIX FINAL: Menggunakan variabel 'appId' persis seperti kode 12 Juni
            const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${currentRecordId}/notes`);
            const q = query(notesRef, orderBy('createdAt', 'desc'));

            const unsubscribe = onSnapshot(q, (snap) => {
                const logs = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    updatedAt: d.data().createdAt?.seconds ? new Date(d.data().createdAt.seconds * 1000) : new Date()
                }));
                setHistoryLogs(logs);
            }, (err) => {
                console.error("Gagal mendengarkan data riwayat:", err);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error pada antena riwayat:", error);
        }
    }, [db, appId, currentRecordId]);

    // State Print
    const [selectedRecordForPrint, setSelectedRecordForPrint] = useState(null);
    const [showBulkPrint, setShowBulkPrint] = useState(false);

    const [showInputModal, setShowInputModal] = useState(false);
    const [recordForLapor, setRecordForLapor] = useState(null);
    const [recordForDischarge, setRecordForDischarge] = useState(null);
    const [showLaporModal, setShowLaporModal] = useState(false);

    // ✨ TEMPEL STATE TUKAR BED DI SINI:
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [patientToSwap, setPatientToSwap] = useState(null);

    const [dpjpFilter, setDpjpFilter] = useState([]);
    const [selectedRoomFilter, setSelectedRoomFilter] = useState(currentWardConfig.roomList);
    // ✅ FIX MASALAH 1: Paksa filter untuk auto-select semua kamar saat denah baru selesai diload
    useEffect(() => {
        setSelectedRoomFilter(currentWardConfig.roomList || []);
    }, [currentWardConfig.roomList]);

    const [showRaber1, setShowRaber1] = useState(false);
    const [showRaber2, setShowRaber2] = useState(false);
    const [showTtvModal, setShowTtvModal] = useState(false);


    const [confirmDetails, setConfirmDetails] = useState({ isOpen: false, message: '', title: '', action: () => { } });
    const openConfirm = (title, message, action) => { setConfirmDetails({ isOpen: true, title, message, action }); };
    const closeConfirm = () => { setConfirmDetails({ isOpen: false, message: '', title: '', action: () => { } }); };

    const [formData, setFormData] = useState({
        roomNumber: '', name: '', rmNumber: '', gender: '',
        dpjpName: '', raberName: '', raber2Name: '', admissionDate: '', evidenceImages: [],
        subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
        // ✨ GAMBAR RADIOLOGI: array of {category, imageUrl, date, uploadedBy}
        radiologyImages: [],
    });

    const [newDpjpName, setNewDpjpName] = useState('');
    const [newDpjpWa, setNewDpjpWa] = useState('');

    const [handoverConfig, setHandoverConfig] = useState({ isOpen: false, agenda: null, viewModeData: null });
    const [isBulkHandoverOpen, setIsBulkHandoverOpen] = useState(false); // Saklar Nampan Masal
    const [isBukuEkspedisiOpen, setIsBukuEkspedisiOpen] = useState(false); // Saklar Laci Debat

    // ✨ STATE SAKLAR GESER PAPAN AGENDA (RENCANA AKSI vs LACAK HASIL)
    const [agendaSubTab, setAgendaSubTab] = useState('rencana'); // 'rencana' | 'lacak'

    // --- [LEVEL 4] LOGIC: USER MONITORING & ACTIONS ---

    // 1. Monitor Users (Admin, Karu, & PPJA)
    useEffect(() => {
        if (!['admin', 'karu', 'PPJA'].includes(currentUser?.role) || !db) return;
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('name', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setAllUsers(snap.docs.map(d => d.data()));
        });
        return () => unsub();
    }, [db, currentUser]);

    // 2. Init Profile Form (Saat currentUser berubah)
    useEffect(() => {
        if (currentUser) {
            setProfileForm({ name: currentUser.name, pass: currentUser.pass });
        }
    }, [currentUser]);

    // 3. Action: Update Profil Sendiri
    const handleUpdateSelf = async () => {
        if (!profileForm.name || !profileForm.pass) return alert("Nama dan Password tidak boleh kosong!");
        try {
            const userRef = doc(db, 'users', currentUser.id);
            await updateDoc(userRef, { name: profileForm.name, pass: profileForm.pass });
            alert("Profil berhasil diupdate! Silakan login ulang nanti untuk melihat perubahan.");
        } catch (e) { alert("Gagal update: " + e.message); }
    };

    const handleAdminSaveUser = async () => {
        if (!adminUserForm.id || !adminUserForm.name || !adminUserForm.pass) return alert("Semua kolom wajib diisi!");
        const targetId = adminUserForm.id.toLowerCase().trim().replace(/\s+/g, '_');

        // Mengunci otomatis ruangan sesuai lokasi Karu/PPJA bertugas
        const isLockedWard = ['karu', 'PPJA'].includes(currentUser?.role);
        const targetWard = isLockedWard ? currentUser.ward : (adminUserForm.ward || 'MELATI');

        try {
            const exists = allUsers.find(u => u.id === targetId);

            // Blokir jika Karu/Admin ruangan mencoba mengedit akun dari ruangan lain
            if (exists && isLockedWard && exists.ward !== currentUser.ward) {
                return alert("Gagal! Anda tidak memiliki hak akses untuk memodifikasi perawat dari ruangan lain.");
            }

            if (!exists) {
                await setDoc(doc(db, 'users', targetId), {
                    ...adminUserForm,
                    id: targetId,
                    ward: targetWard,
                    role: adminUserForm.role || 'member',
                    createdAt: Timestamp.now()
                });
                alert(`User baru "${adminUserForm.name}" berhasil ditambahkan ke Ruang ${targetWard}!`);
            } else {
                await updateDoc(doc(db, 'users', targetId), {
                    name: adminUserForm.name,
                    pass: adminUserForm.pass,
                    role: adminUserForm.role,
                    ward: targetWard
                });
                alert(`User "${adminUserForm.name}" berhasil diperbarui.`);
            }
            setAdminUserForm({ id: '', name: '', pass: '', role: 'member', ward: currentUser?.ward || 'MELATI' });
        } catch (e) { alert("Error: " + e.message); }
    };

    // 5. Action: Admin Hapus User
    const handleAdminDeleteUser = async (targetId) => {
        if (targetId === currentUser.id) return alert("Tidak bisa menghapus diri sendiri!");

        const targetUser = allUsers.find(u => u.id === targetId);
        if (['karu', 'admin_ruangan'].includes(currentUser?.role) && targetUser?.ward !== currentUser.ward) {
            return alert("Gagal! Anda hanya bisa menghapus anggota perawat di ruangan Anda sendiri.");
        }

        if (!confirm("Hapus user ini permanen?")) return;
        try {
            await deleteDoc(doc(db, 'users', targetId));
            alert("User dihapus.");
        } catch (e) { alert("Gagal hapus: " + e.message); }
    };

    // --- MONITORING DAFTAR TUNGGU SECARA REAL-TIME ---
    useEffect(() => {
        if (!db || !appId) return;
        const wlRef = collection(db, `artifacts/${appId}/public/data/waitingList`);
        const q = query(wlRef, orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setWaitingList(list);
        }, (err) => console.error("Gagal sinkronisasi Waiting List:", err));
        return () => unsub();
    }, [db, appId]);

    // --- PENCARIAN & FILTER + SORTIR KAMAR (ATURAN DR. DELVI DI DASHBOARD) ---
    const filteredActiveRecords = useMemo(() => {

        // 1. Cek apakah dr. Delvi sedang dipilih di dropdown filter atas
        const isDelviSelected = dpjpFilter.some(dr => dr.toLowerCase().includes('delvi'));

        const filtered = activeRecords.filter(rec => {
            // =====================================================================
            // 🧠 SENSOR DETEKSI PASIEN HD VERSI PINTAR (ANTI FALSE-POSITIF)
            // =====================================================================
            const textScan = `${rec.diagnosis || ''} ${rec.analysis || ''} ${rec.planning || ''}`.toLowerCase();

            // 🛑 1. LAYER PENGECUALIAN (Jika ada kata ini, BATALKAN balon HD rutin)
            const statusMenolak = textScan.includes('menolak hd') || textScan.includes('tolak hd') || textScan.includes('tidak mau hd');
            const statusProvisional = textScan.includes('dd ckd') || textScan.includes('susp ckd') || textScan.includes('susp. ckd') || textScan.includes('dd hd');

            // Proteksi khusus agar tidak bentrok dengan balon ungu (HD Inisiasi / Edukasi)
            const statusInisiasiAtauEdukasi = textScan.includes('inisiasi') || textScan.includes('edukasi hd');

            // 🎯 2. LAYER KONFIRMASI (Kata kunci dasar penanda kasus ginjal/HD)
            const adaKataKunciHD = textScan.includes('hd') || textScan.includes('ckd') || textScan.includes('hemodialisa');

            // 🏆 3. KEPUTUSAN AKHIR BALON HD
            // Balon merah HD hanya akan menyala jika ada kata kunci terkait,
            // BUKAN pasien menolak, BUKAN status diferensial (dd/susp), dan BUKAN kasus inisiasi/edukasi.
            const isHD = adaKataKunciHD && !statusMenolak && !statusProvisional && !statusInisiasiAtauEdukasi;

            // ✨ LOGIKA FILTER DASHBOARD
            // Loloskan pasien jika: Tidak ada filter DPJP, ATAU namanya cocok, ATAU (dr. Delvi dipilih DAN pasien ini HD)
            const matchesDpjp = dpjpFilter.length === 0 ||
                dpjpFilter.includes(rec.dpjpName) ||
                (isDelviSelected && isHD);

            const matchesRoom = selectedRoomFilter.length === currentWardConfig.roomList.length || selectedRoomFilter.includes(rec.roomNumber);
            const term = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                rec.name.toLowerCase().includes(term) ||
                (rec.analysis && rec.analysis.toLowerCase().includes(term)) ||
                (rec.dpjpName && rec.dpjpName.toLowerCase().includes(term)) ||
                (rec.rmNumber && rec.rmNumber.includes(term));

            return matchesDpjp && matchesRoom && matchesSearch;
        });

        // ✨ FIX 1: Terapkan aturan urutan kamar rute U
        // Hanya aktif jika filter DPJP spesifik memilih dr. Delvi saja (agar rapi saat visit)
        const isDelviOnly = dpjpFilter.length === 1 && dpjpFilter[0].toLowerCase().includes('delvi');

        if (isDelviOnly) {
            // Aturan Letter-U khusus dr. Delvi (Mundur dari K6 Kiri, Lanjut K7 Kanan)
            const uShapeBase = ['K6', 'K4', 'K2', 'K1', 'K3', 'K5', 'K7', 'K8', 'K9', 'K11', 'K12', 'K14', 'K15', 'K13', 'K10'];

            // Menerjemahkan uShapeBase ke nama kamar baru (P, KM) secara dinamis
            const uShapeOrder = uShapeBase.flatMap(k => {
                const regex = new RegExp('^' + k + '(P|KM)?$');
                return currentWardConfig.roomList.filter(r => regex.test(r));
            });

            return filtered.sort((a, b) => {
                let indexA = uShapeOrder.indexOf(a.roomNumber);
                let indexB = uShapeOrder.indexOf(b.roomNumber);
                if (indexA === -1) indexA = 999;
                if (indexB === -1) indexB = 999;
                return indexA - indexB;
            });
        }

        // Urutan default (A-Z / Numerik normal dari Kamar 1 sampai Ujung)
        return filtered.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

    }, [activeRecords, dpjpFilter, selectedRoomFilter, searchTerm, currentWardConfig]);

    // --- LOGIC DATABASE UTAMA ---
    const getCollectionRef = useCallback(() => {
        if (db) return collection(db, `artifacts/${appId}/public/data/medicalRecords`);
        return null;
    }, [db, appId]);

    // ✨ FASE 3: ISOLASI DATABASE SETELAN MULTI-RS
    const getConfigRef = useCallback(() => {
        if (!db) return null;

        // Baca nama RS user yang login
        const hosp = currentUser?.hospital || 'RSUD BAYU ASIH';

        // 🛡️ Backward Compatibility: Biar data Bayu Asih yang lama tidak hilang
        if (hosp === 'RSUD BAYU ASIH' || hosp === 'RSUD Bayu Asih') {
            return doc(db, `artifacts/${appId}/public/data/settings`, 'mainConfig');
        } else {
            // 🏥 RS Baru: Buat laci setelan khusus dengan nama RS-nya
            const safeHospName = hosp.replace(/\s+/g, '_').toUpperCase();
            return doc(db, `artifacts/${appId}/public/data/settings_${safeHospName}`, 'mainConfig');
        }
    }, [db, appId, currentUser]);

    // 1. Load Settings (DPJP & Denah Dinamis) - dengan retry dan localStorage fallback
    useEffect(() => {
        if (!userId) return;
        const ref = getConfigRef();
        if (!ref) return;

        setIsSettingsLoaded(false);
        setSettingsError(null);
        let retryCount = 0;
        const maxRetries = 3;
        let timeoutId = null;

        const attemptLoad = () => {
            try {
                const unsubscribe = onSnapshot(ref, (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();

                        // ✨ FASE 2: Tarik Denah Dinamis
                        if (data.wards) setDynamicWards(data.wards);

                        // ✨ FASE 2: Cegah Auto-Sync Dokter Bayu Asih ke RS Lain
                        const isBayuAsih = (currentUser?.hospital || 'RSUD BAYU ASIH').toUpperCase() === 'RSUD BAYU ASIH';
                        let finalDpjp = data.dpjpProfiles || [];

                        if (isBayuAsih && Array.isArray(data.dpjpProfiles)) {
                            // AUTO-SYNC HANYA UNTUK BAYU ASIH
                            const cloudNames = data.dpjpProfiles.map(p => p.name.toLowerCase());
                            const missingFromCloud = initialDpjpProfiles.filter(p => !cloudNames.includes(p.name.toLowerCase()));
                            if (missingFromCloud.length > 0) {
                                finalDpjp = [...data.dpjpProfiles, ...missingFromCloud].sort((a, b) => a.name.localeCompare(b.name));
                                setDoc(ref, { dpjpProfiles: finalDpjp }, { merge: true }).catch(err => console.error(err));
                            }
                        } else if (!isBayuAsih && Array.isArray(data.dpjpProfiles)) {
                            // ✨ AUTO-CLEANUP: Jika RS Lain terinfeksi dokter Bayu Asih (ex: dr. Delvi) karena bug lama, bersihkan otomatis!
                            if (data.dpjpProfiles.some(p => p.name.includes('Delvi') || p.name.includes('Ekowati'))) {
                                finalDpjp = []; // Kosongkan
                                setDoc(ref, { dpjpProfiles: [] }, { merge: true }).catch(err => console.error(err));
                            }
                        }

                        // ✨ Simpan State & Kunci Sesuai Nama RS-nya
                        const safeHospName = (currentUser?.hospital || 'RSUD BAYU ASIH').replace(/\s+/g, '_').toUpperCase();
                        setDpjpProfiles(finalDpjp);
                        localStorage.setItem(`backupDpjp_${safeHospName}`, JSON.stringify(finalDpjp));

                        if (data.masterLabs && Array.isArray(data.masterLabs)) { setMasterLabs(data.masterLabs); localStorage.setItem('masterLabs', JSON.stringify(data.masterLabs)); }
                        if (data.masterRads && Array.isArray(data.masterRads)) { setMasterRads(data.masterRads); localStorage.setItem('masterRads', JSON.stringify(data.masterRads)); }
                        if (data.masterProcedures && Array.isArray(data.masterProcedures)) { setMasterProcedures(data.masterProcedures); localStorage.setItem('masterProcedures', JSON.stringify(data.masterProcedures)); }
                        if (data.masterMedications && Array.isArray(data.masterMedications)) { setMasterMedications(data.masterMedications); localStorage.setItem('masterMedications', JSON.stringify(data.masterMedications)); }

                        setIsSettingsLoaded(true);
                        setSettingsError(null);
                        retryCount = 0;
                    } else {
                        // ⚠️ Dokumen RS Baru belum ada isinya: Buat kosong melompong (Anti Bocor)
                        const isBayuAsih = currentUser?.hospital?.toUpperCase() === 'RSUD BAYU ASIH';
                        setDoc(ref, {
                            dpjpProfiles: isBayuAsih ? initialDpjpProfiles : [],
                            masterLabs: [], masterRads: [], masterProcedures: [], masterMedications: [],
                            wards: {}
                        }).catch(err => console.error("Init settings error:", err));
                        setIsSettingsLoaded(true);
                        setSettingsError(null);
                    }
                }, (err) => {
                    console.warn("Firebase settings load error:", err.message);
                    setSettingsError(err.message);
                    if (retryCount < maxRetries) {
                        retryCount++;
                        timeoutId = setTimeout(attemptLoad, 2000 * retryCount);
                    } else {
                        setIsSettingsLoaded(true);
                    }
                });

                return () => {
                    unsubscribe();
                    if (timeoutId) clearTimeout(timeoutId);
                };
            } catch (e) {
                setSettingsError(e.message);
                setIsSettingsLoaded(true);
            }
        };

        attemptLoad();

        return () => { if (timeoutId) clearTimeout(timeoutId); };
    }, [getConfigRef, userId, currentUser]);

    // ✨ FIX DROPDOWN: Mengurutkan filter utama Dashboard berdasarkan Dokter Prioritas Ruangan (Sesuai image_7e06b0.png)
    const dpjpOptions = useMemo(() => {
        const names = dpjpProfiles.map(p => p.name);

        // Daftar dokter utama/prioritas di ruangan (dr. Susilo sudah dihapus karena pensiun)
        const priorityDocs = [
            "dr. Delvi, Sp.PD",
            "dr. Dian Ekowati, Sp.PD",
            "dr. Priyo, Sp.PD",
            "dr. Risa, Sp.PD",
            "dr. Evan, Sp.P",
        ];

        return [...names].sort((a, b) => {
            const idxA = priorityDocs.indexOf(a);
            const idxB = priorityDocs.indexOf(b);

            // Jika keduanya adalah dokter prioritas, urutkan sesuai index priorityDocs
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // Jika hanya A yang prioritas, naikkan ke atas
            if (idxA !== -1) return -1;
            // Jika hanya B yang prioritas, naikkan ke atas
            if (idxB !== -1) return 1;
            // Sisa dokter konsul lainnya diurutkan alfabetis biasa (A-Z)
            return a.localeCompare(b);
        });
    }, [dpjpProfiles]);

    // Generic save helper for settings (merges keys) - dengan localStorage backup
    const saveSettings = async (partial) => {
        const ref = getConfigRef();
        if (!ref) return;
        try {
            // Simpan ke localStorage dulu sebagai backup
            if (partial.dpjpProfiles) localStorage.setItem('backupDpjp', JSON.stringify(partial.dpjpProfiles));
            if (partial.masterLabs) localStorage.setItem('masterLabs', JSON.stringify(partial.masterLabs));
            if (partial.masterRads) localStorage.setItem('masterRads', JSON.stringify(partial.masterRads));
            if (partial.masterProcedures) localStorage.setItem('masterProcedures', JSON.stringify(partial.masterProcedures));
            if (partial.masterMedications) localStorage.setItem('masterMedications', JSON.stringify(partial.masterMedications));

            // Kemudian simpan ke Firebase
            await setDoc(ref, partial, { merge: true });
            setSettingsError(null);
        } catch (e) {
            console.error("Save settings error:", e.message);
            alert("Gagal menyimpan setelan ke Firebase. Data sudah tersimpan lokal, akan sinkron saat koneksi baik.");
        }
    };

    const handleAddDpjp = async () => {
        if (!isSettingsLoaded) return alert("Tunggu data termuat sempurna.");
        if (!newDpjpName.trim()) return alert("Nama DPJP kosong!");
        if (dpjpProfiles.some(p => p.name.toLowerCase() === newDpjpName.trim().toLowerCase())) return alert("Nama sudah ada!");

        let rawNumber = newDpjpWa.trim().replace(/\D/g, '');
        if (rawNumber.startsWith('0')) rawNumber = '62' + rawNumber.slice(1);

        const newProfile = { name: newDpjpName.trim(), waNumber: rawNumber };
        const updated = [...dpjpProfiles, newProfile].sort((a, b) => a.name.localeCompare(b.name));
        await saveSettings({ dpjpProfiles: updated });
        setNewDpjpName(''); setNewDpjpWa('');
    };

    const handleRemoveDpjp = async (name) => {
        if (!isSettingsLoaded) return alert("Tunggu data termuat.");
        if (window.confirm(`Hapus ${name}?`)) {
            const updated = dpjpProfiles.filter(p => p.name !== name);
            await saveSettings({ dpjpProfiles: updated });
        }
    };

    // Handlers for master data (lab, rad, tindakan, terapi)
    const handleAddMaster = async (type) => {
        if (!isSettingsLoaded) return alert('Tunggu data termuat.');
        let updated = [];
        if (type === 'lab') {
            if (!newMasterLab.trim()) return alert('Nama lab kosong');
            if (masterLabs.includes(newMasterLab.trim())) return alert('Sudah ada');
            updated = [...masterLabs, newMasterLab.trim()].sort();
            setMasterLabs(updated); setNewMasterLab('');
            await saveSettings({ masterLabs: updated });
        } else if (type === 'rad') {
            if (!newMasterRad.trim()) return alert('Nama radiologi kosong');
            if (masterRads.includes(newMasterRad.trim())) return alert('Sudah ada');
            updated = [...masterRads, newMasterRad.trim()].sort();
            setMasterRads(updated); setNewMasterRad('');
            await saveSettings({ masterRads: updated });
        } else if (type === 'procedure') {
            if (!newMasterProcedure.trim()) return alert('Nama tindakan kosong');
            if (masterProcedures.includes(newMasterProcedure.trim())) return alert('Sudah ada');
            updated = [...masterProcedures, newMasterProcedure.trim()].sort();
            setMasterProcedures(updated); setNewMasterProcedure('');
            await saveSettings({ masterProcedures: updated });
        } else if (type === 'medication') {
            if (!newMasterMedication.trim()) return alert('Nama terapi/obat kosong');
            if (masterMedications.includes(newMasterMedication.trim())) return alert('Sudah ada');
            updated = [...masterMedications, newMasterMedication.trim()].sort();
            setMasterMedications(updated); setNewMasterMedication('');
            await saveSettings({ masterMedications: updated });
        }
    };

    const handleRemoveMaster = async (type, value) => {
        if (!isSettingsLoaded) return alert('Tunggu data termuat.');
        if (!window.confirm(`Hapus "${value}" dari master ${type}?`)) return;
        if (type === 'lab') {
            const updated = masterLabs.filter(i => i !== value);
            setMasterLabs(updated); await saveSettings({ masterLabs: updated });
        } else if (type === 'rad') {
            const updated = masterRads.filter(i => i !== value);
            setMasterRads(updated); await saveSettings({ masterRads: updated });
        } else if (type === 'procedure') {
            const updated = masterProcedures.filter(i => i !== value);
            setMasterProcedures(updated); await saveSettings({ masterProcedures: updated });
        } else if (type === 'medication') {
            const updated = masterMedications.filter(i => i !== value);
            setMasterMedications(updated); await saveSettings({ masterMedications: updated });
        }
    };

    // --- MONITORING MEDICAL RECORDS (PASIEN AKTIF SAJA) ---
    useEffect(() => {
        if (!userId) return;
        const ref = getCollectionRef();
        if (!ref) return;

        // 1. QUERY SUPER CEPAT: Hanya tarik pasien yang belum pulang
        const q = query(ref, where('isDischarged', '==', false), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => {
                const docData = d.data();

                // --- TRANSLATOR NAMA KAMAR ---
                let updatedRoomNumber = docData.roomNumber || '';
                if (updatedRoomNumber.endsWith('B1')) {
                    updatedRoomNumber = updatedRoomNumber.replace('B1', 'A');
                } else if (updatedRoomNumber.endsWith('B2')) {
                    updatedRoomNumber = updatedRoomNumber.replace('B2', 'B');
                }

                return {
                    id: d.id, ...docData,
                    roomNumber: updatedRoomNumber,
                    createdAt: docData.createdAt?.toDate() || new Date(),
                    updatedAt: docData.updatedAt?.toDate() || null
                };
            });

            // ✨ ISOLASI BANGSAL (WARD)
            const activeWard = currentUser?.ward || 'MELATI';
            const active = data.filter(r => (r.ward || 'MELATI') === activeWard);

            setRecords(active);
            setActiveRecords(active);
            setOccupiedRooms(active.map(r => r.roomNumber));

        }, (err) => console.error("Firestore Error:", err));

        return () => unsubscribe();
    }, [getCollectionRef, userId, currentUser]);

    // ✨ FIX REKAP: Tarik data arsip diam-diam di background agar tabel rekap langsung terisi
    useEffect(() => {
        if (db && currentUser) {
            fetchArchivedRecords();
        }
    }, [db, currentUser]);

    // Tetap tarik ulang saat buka modal untuk memastikan data rekam medis lama paling update
    useEffect(() => {
        if (showInputModal) {
            fetchArchivedRecords();
        }
    }, [showInputModal]);

    // --- FUNGSI KHUSUS: TARIK DATA GUDANG ARSIP HANYA SAAT DIMINTA ---
    const fetchArchivedRecords = async () => {
        try {
            const ref = getCollectionRef();
            if (!ref) return;

            // Ambil data arsip yang status pulangnya TRUE (Dibatasi 500 agar tidak lemot)
            const q = query(ref, where('isDischarged', '==', true), orderBy('createdAt', 'desc'), limit(500));
            const snapshot = await getDocs(q);
            const archivedData = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id, ...docData,
                    createdAt: docData.createdAt?.toDate() || new Date(),
                    updatedAt: docData.updatedAt?.toDate() || null
                };
            });

            setArchivedRecords(archivedData);
        } catch (error) {
            console.error("Gagal mengambil data arsip:", error);
        }
    };

    // --- UPDATE: Logika Tarik Data (Mendukung Gambar) ---
    const pullDataForField = (field) => {
        if (!historyLogs || historyLogs.length === 0) return alert("Belum ada riwayat.");

        // Cari log terakhir yang punya data di field tersebut
        const foundLog = historyLogs.find(log => {
            if (Array.isArray(log[field])) return log[field].length > 0; // Cek jika itu array gambar
            return log[field] && log[field].trim().length > 0; // Cek jika itu teks
        });

        if (foundLog) {
            setFormData(prev => ({ ...prev, [field]: foundLog[field] }));
            alert(`Data ${field === 'evidenceImages' ? 'Gambar' : field.toUpperCase()} berhasil ditarik.`);
        } else {
            alert(`Tidak ada data ${field === 'evidenceImages' ? 'Gambar' : field.toUpperCase()} di riwayat.`);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
    };

    // ✅ SESUDAHNYA (Dikosongkan):
    const resetForm = () => {
        setFormData({
            roomNumber: '', name: '', rmNumber: '', gender: '', dpjpName: '', raberName: '', raber2Name: '',
            subjective: '', objective: '', analysis: '', planning: '', isDischarged: false,
            admissionDate: '', evidenceImages: [], bpjsClass: ''
        });
        setIsEditing(false);
        setShowRaber1(false); setShowRaber2(false);
        setCurrentRecordId(null);
    };

    const handleSelectRoom = (roomNumber) => {
        resetForm();
        setFormData(p => ({ ...p, roomNumber }));
        setShowInputModal(true);
    };

    const handleEditRoom = (patientRecord) => {
        handleEdit(patientRecord);
    };

    // ✨ TEMPEL FUNGSI EKSEKUSI TUKAR BED DI SINI:
    const handleExecuteSwap = async (targetRoomNumber) => {
        if (!patientToSwap) return;

        const sourceRoom = patientToSwap.roomNumber;
        if (sourceRoom === targetRoomNumber) {
            alert("⚠️ Pasien sudah berada di bed tersebut.");
            return;
        }

        const occupant = activeRecords.find(r => r.roomNumber === targetRoomNumber);
        const safeAppId = appId || firebaseConfig?.appId || 'SIMPAN_APP';

        try {
            if (occupant) {
                const confirmSwap = window.confirm(`🔀 Bed ${targetRoomNumber} sudah diisi oleh ${occupant.name}.\n\nApakah Anda yakin ingin menukar posisi:\n${patientToSwap.name} (Bed ${sourceRoom})  🔄  ${occupant.name} (Bed ${targetRoomNumber})?`);
                if (!confirmSwap) return;

                const refSource = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, patientToSwap.id);
                const refOccupant = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, occupant.id);

                await Promise.all([
                    updateDoc(refSource, { roomNumber: targetRoomNumber }),
                    updateDoc(refOccupant, { roomNumber: sourceRoom })
                ]);
                alert(`✅ Berhasil menukar posisi ${patientToSwap.name} dan ${occupant.name}!`);
            } else {
                const confirmMove = window.confirm(`➡️ Pindahkan ${patientToSwap.name} ke Bed ${targetRoomNumber} yang kosong?`);
                if (!confirmMove) return;

                const refSource = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, patientToSwap.id);
                await updateDoc(refSource, { roomNumber: targetRoomNumber });
                alert(`✅ Berhasil memindahkan ${patientToSwap.name} ke Bed ${targetRoomNumber}!`);
            }

            setShowSwapModal(false);
            setPatientToSwap(null);
        } catch (error) {
            console.error("Error swapping bed:", error);
            alert("❌ Terjadi kesalahan saat memindahkan bed. Cek koneksi internet.");
        }
    }; // <--- INI ADALAH PENUTUP FUNGSI TUKAR BED

        // 🧪 HELPER OTOMATIS: PINDAHKAN ITEM DARI PLANNING KE OBJEKTIF SAAT TTD
    const autoTransferPlanningToObjective = (currentPlanning = '', currentObjective = '', actionText = '') => {
        // 1. Ambil nama pembersih untuk menghapus dari P (Planning)
        const cleanAction = actionText.replace(/\[.*?\]/g, '').trim();

        // 2. Ambil jam TTD saat ini
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

        // 3. Format teks resmi LACAK/LAPOR sesuai kenyamanan perawat (Format Nomor 1)
        const lacakText = `⚠️ LACAK/LAPOR: ${actionText} (${timeStr} WIB)`;
        
        let updatedObjective = currentObjective || '';
        
        if (!updatedObjective.includes(cleanAction)) {
            updatedObjective = updatedObjective.trim() 
                ? `${updatedObjective}\n${lacakText}` 
                : lacakText;
        }

        // 4. Hapus baris pemeriksaan tersebut dari P (PLANNING)
        const planningLines = (currentPlanning || '').split('\n');
        const filteredLines = planningLines.filter(line => !line.toLowerCase().includes(cleanAction.toLowerCase()));
        
        let updatedPlanning = filteredLines.join('\n');
        updatedPlanning = updatedPlanning
            .replace(/🔬\s*LAB:\s*\n(?=\n|$|💉|🩻)/gi, '') // Hapus header LAB jika isinya sudah habis
            .replace(/\n\s*\n/g, '\n')                     // Bersihkan enter dobel
            .trim();

        return { updatedPlanning, updatedObjective };
    };

    // ✨ FUNGSI MENYIMPAN TTD TUNGGAL + OTOMATIS TARIK KE OBJEKTIF + HITUNG TRANSFUSI BDRS
    const handleSaveHandover = async (handoverData) => {
        try {
            setLoading(true);
            const recId = handoverConfig.agenda.id;
            const rec = activeRecords.find(r => r.id === recId);
            
            // 1. Eksekusi perpindahan dari Planning ke Objektif
            let { updatedPlanning, updatedObjective } = autoTransferPlanningToObjective(
                rec.planning, 
                rec.objective, 
                handoverData.action
            );

            // 2. 🩸 SENSOR BDRS: Perbarui hitungan kantong jika agenda merupakan transfusi darah
            const isTransfusion = /trnfs|transfusi|prc|wb|tc|ffp/i.test(handoverData.action || '');
            if (isTransfusion) {
                updatedPlanning = updateTransfusionText(updatedPlanning, handoverData.action);
            }

            const currentVerified = rec.verifiedAgendas || [];
            const updatedVerified = [...currentVerified, handoverData];
            
            // 3. Simpan permanen ke Firestore
            const ref = doc(db, `artifacts/${appId}/public/data/medicalRecords`, recId);
            await updateDoc(ref, { 
                planning: updatedPlanning,
                objective: updatedObjective,
                verifiedAgendas: updatedVerified 
            });
            
            setHandoverConfig({ isOpen: false, agenda: null, viewModeData: null });
            alert("✅ SAH! TTD disimpan, item dipindahkan ke O (Objektif), dan status kantong darah diperbarui.");
        } catch (e) {
            alert("Gagal menyimpan bukti: " + e.message);
        } finally {
            setLoading(false);
        }
    };
    
    // ✨ FUNGSI MENYIMPAN TTD NAMPAN MASAL + OTOMATIS TARIK KE OBJEKTIF + HITUNG TRANSFUSI BDRS
    const handleSaveBulkHandover = async (chosenAgendas, handoverCommon) => {
        try {
            setLoading(true);
            
            // Kelompokkan item berdasarkan ID Pasien
            const groupedByPatientId = {};
            chosenAgendas.forEach(item => {
                if (!groupedByPatientId[item.id]) groupedByPatientId[item.id] = [];
                groupedByPatientId[item.id].push(item.action);
            });

            // Eksekusi massal ke Firestore
            const updatePromises = Object.entries(groupedByPatientId).map(async ([recId, actions]) => {
                const rec = activeRecords.find(r => r.id === recId);
                let currentPlanning = rec.planning || '';
                let currentObjective = rec.objective || '';

                actions.forEach(actionText => {
                    const result = autoTransferPlanningToObjective(currentPlanning, currentObjective, actionText);
                    currentPlanning = result.updatedPlanning;
                    currentObjective = result.updatedObjective;

                    // 🩸 Eksekusi kalkulasi kantong jika item nampan adalah darah
                    if (/trnfs|transfusi|prc|wb|tc|ffp/i.test(actionText)) {
                        currentPlanning = updateTransfusionText(currentPlanning, actionText);
                    }
                });

                const newEntries = actions.map(action => ({
                    ...handoverCommon,
                    action: action
                }));

                const currentVerified = rec.verifiedAgendas || [];
                const docRef = doc(db, `artifacts/${appId}/public/data/medicalRecords`, recId);

                return updateDoc(docRef, { 
                    planning: currentPlanning,
                    objective: currentObjective,
                    verifiedAgendas: [...currentVerified, ...newEntries] 
                });
            });

            await Promise.all(updatePromises);
            setIsBulkHandoverOpen(false);
            alert("🎉 SUKSES NAMPAN! Semua sampel/kantong terverifikasi & data berhasil diperbarui.");
        } catch (e) {
            alert("Gagal memproses serah terima masal: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // ✨ FIX FINAL: MESIN PENGELOMPOK ADVIS OTOMATIS BERDASARKAN HARI/WAKTU YANG SAMA (V3 - REVISI SEKAT NEWLINE TERAPI & TINDAKAN)
    const appendText = (field, text) => {
        setFormData(p => {
            const current = p[field] || '';

            if (!text.trim()) return p;

            // 1. Jika kotak input masih kosong melompong, langsung masukkan teks pertama
            if (!current.trim()) {
                return { ...p, [field]: text.trim() };
            }

            // 2. Pecah komponen teks yang baru masuk (Prefix, Nama Item, dan Keterangan Waktu)
            const incomingMatch = text.match(/^(Lab\. R\/|Rad\. R\/|TM\.|Th\.|Lacak\/Lapor)\s*(.*?)\s*(\[[^\]]+\])?$/i);

            // Jika teks yang masuk tidak menggunakan prefix standar, lakukan append normal ke baris baru paling bawah
            if (!incomingMatch) {
                let lines = current.split('\n');
                const lastLine = lines[lines.length - 1];
                if (/^(?:🕒\s*)?\[[^\]]+\]\s*$/.test(lastLine.trim())) {
                    lines[lines.length - 1] = `${lastLine.trim()}\n${text.trim()}`;
                    return { ...p, [field]: lines.join('\n') };
                }
                return { ...p, [field]: `${current.trim()}\n${text.trim()}` };
            }

            const prefix = incomingMatch[1];                 // Contoh: "Lab. R/" / "Th."
            const itemName = incomingMatch[2].trim();         // Contoh: "Tubex" / "Drip pantoprazole..."
            const timeTag = (incomingMatch[3] || '').trim();   // Contoh: "[Sore Ini]"

            let lines = current.split('\n');
            let isMerged = false;

            // 🔥 BARU: SEKAT PENGECUALIAN (Jika prefix adalah Terapi (Th.) atau Tindakan (TM.), BYPASS penggabungan koma!)
            const shouldBypassMerge = prefix.toLowerCase().startsWith('th') || prefix.toLowerCase().startsWith('tm');

            // 3. Scan dari baris paling bawah ke atas untuk mencari pasangan yang cocok (HANYA JIKA BUKAN TERAPI/TINDAKAN)
            if (!shouldBypassMerge) {
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    const lineMatch = line.match(/^(Lab\. R\/|Rad\. R\/|TM\.|Th\.|Lacak\/Lapor)\s*(.*?)\s*(\[[^\]]+\])?$/i);

                    if (lineMatch) {
                        const lPrefix = lineMatch[1];
                        const lItems = lineMatch[2].trim();
                        const lTimeTag = (lineMatch[3] || '').trim();

                        // Normalisasi spasi double agar pencocokan waktu super akurat
                        const normLTime = lTimeTag.toLowerCase().replace(/\s+/g, ' ');
                        const normTime = timeTag.toLowerCase().replace(/\s+/g, ' ');

                        // ⚡ SYARAT GABUNG LAB/RAD: Prefix harus sama DAN Waktunya wajib kembar!
                        if (lPrefix.toLowerCase() === prefix.toLowerCase() && normLTime === normTime) {
                            const existingItems = lItems.split(',').map(item => item.trim().toLowerCase());
                            if (!existingItems.includes(itemName.toLowerCase())) {
                                lines[i] = `${lPrefix} ${lItems}, ${itemName}${timeTag ? ' ' + timeTag : ''}`;
                            }
                            isMerged = true;
                            break; // Stop pencarian karena sudah berhasil digabungkan
                        }
                    }
                }
            }

            // 4. Jika tidak digabung (atau di-bypass karena Terapi/Tindakan), otomatis buat baris baru di bawah
            if (!isMerged) {
                const lastLine = lines[lines.length - 1];

                // Proteksi penempatan stempel waktu perawat shift agar tidak tertimpa
                if (/^(?:🕒\s*)?\[[^\]]+\]\s*$/.test(lastLine.trim())) {
                    lines[lines.length - 1] = `${lastLine.trim()}\n${text.trim()}`;
                } else {
                    lines.push(text.trim());
                }
            }

            return { ...p, [field]: lines.join('\n') };
        });
    };

    // =====================================================================
    // ✨ MULTIUSER SOAP MERGE HELPERS (Atomic + Fuzzy Similarity Dedup)
    // =====================================================================

    // --- Hitung kemiripan 2 baris teks (0 = beda total, 1 = identik) ---
    // Pakai Jaccard similarity berbasis kata, cukup ringan & cukup akurat
    // untuk advis singkat seperti "Cek DL ulang besok" vs "DL ulang besok pagi"
    const lineSimilarity = (a, b) => {
        const normalize = (s) => (s || '')
            .toLowerCase()
            .replace(/^\[[^\]]*\]\s*/g, '') // buang tag [nama][jam] saat membandingkan
            .replace(/[^\w\s]/g, ' ')
            .trim();
        const wordsA = new Set(normalize(a).split(/\s+/).filter(Boolean));
        const wordsB = new Set(normalize(b).split(/\s+/).filter(Boolean));
        if (wordsA.size === 0 && wordsB.size === 0) return 1;
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        let intersection = 0;
        wordsA.forEach(w => { if (wordsB.has(w)) intersection++; });
        const union = wordsA.size + wordsB.size - intersection;
        return intersection / union;
    };

    // Ambang batas kemiripan: >= 0.75 dianggap "advis yang sama"
    const SIMILARITY_THRESHOLD = 0.75;

    // --- FORMAT BARU: HEADER TUNGGAL DI ATAS, BUKAN STAMPEL PER BARIS ---
    const tagNewLines = (text, authorName) => {
        const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
        const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const tag = `[${authorName.charAt(0).toUpperCase() + authorName.slice(1)}, ${dateStr} ${timeStr}]`;

        const cleanText = (text || '').trim();
        if (!cleanText) return '';
        return `${tag}\n${cleanText}`;
    };

    const getNewLines = (currentText, initialText) => {
        const cleanLines = (txt) => (txt || '').split('\n').map(l => l.trim()).filter(Boolean);
        const currentLines = cleanLines(currentText);
        const initialSet = new Set(cleanLines(initialText));
        return currentLines.filter(l => !initialSet.has(l));
    };

    const getRemovedLines = (currentText, initialText) => {
        const cleanLines = (txt) => (txt || '').split('\n').map(l => l.trim()).filter(Boolean);
        const currentSet = new Set(cleanLines(currentText));
        const initialLines = cleanLines(initialText);
        return initialLines.filter(l => !currentSet.has(l));
    };

    // --- SMART MERGE V4: Pemisahan Otak Klinis (Logika O vs P Mandiri) ---
    const smartMergeLines = (dbText, localNewText, removedLines = [], isPlanning = false) => {
        const cleanLines = (txt) => (txt || '').split('\n').map(l => l.trim()).filter(Boolean);

        const dbLines = cleanLines(dbText);
        const localLines = cleanLines(localNewText);

        const isHeaderLine = (l) => /^\[[A-Za-z0-9\s\-]+,\s*\d{1,2}\/\d{1,2}.*\]$/.test(l);

        // Parser cerdas dengan toleransi pembacaan format tahun opsional
        const parseHeader = (headerStr) => {
            const match = headerStr.match(/^\[([A-Za-z0-9\s\-]+),\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-]\d{2,4})?(?:[\s,]+(\d{1,2})[:\.](\d{1,2}))?\]$/);
            if (!match) return null;
            return {
                author: match[1].trim(),
                day: parseInt(match[2], 10),
                month: parseInt(match[3], 10),
                hour: match[4] ? parseInt(match[4], 10) : 0,
                minute: match[5] ? parseInt(match[5], 10) : 0
            };
        };

        const stripTagsForCompare = (l) => {
            if (isHeaderLine(l)) return '';
            return l.replace(/^\[[A-Za-z0-9\s\-]+,\s*\d{1,2}\/\d{1,2}.*?\]\s*/, '')
                .replace(/\s*\[[^\]]+\]↔/g, '')
                .trim().toLowerCase();
        };

        const removedSet = new Set(removedLines.map(stripTagsForCompare).filter(Boolean));

        // Kelompokkan baris database dan lokal ke susunan blok terstruktur
        const parseBlocks = (lines, applyRemovedSet) => {
            const blocks = [];
            let currentBlock = null;
            lines.forEach(l => {
                if (isHeaderLine(l)) {
                    if (currentBlock) blocks.push(currentBlock);
                    currentBlock = { header: l, parsed: parseHeader(l), lines: [] };
                } else if (currentBlock) {
                    const comp = stripTagsForCompare(l);
                    if (!applyRemovedSet || !removedSet.has(comp)) {
                        currentBlock.lines.push(l);
                    }
                }
            });
            if (currentBlock) blocks.push(currentBlock);
            return blocks;
        };

        const dbBlocks = parseBlocks(dbLines, true);
        const localBlocks = parseBlocks(localLines, false);

        if (localBlocks.length === 0) {
            return dbBlocks.map(b => [b.header, ...b.lines].join('\n')).join('\n');
        }

        // Fungsi pembantu untuk melebur dua buah blok perawat
        const mergeTwoBlocks = (dbBlock, localBlock) => {
            const existingAuthor = dbBlock.parsed?.author || '';
            const localAuthor = localBlock.parsed?.author || '';
            let combinedAuthor = existingAuthor;

            if (existingAuthor.toLowerCase() !== localAuthor.toLowerCase() && !existingAuthor.toLowerCase().includes(localAuthor.toLowerCase())) {
                const capLocal = localAuthor.charAt(0).toUpperCase() + localAuthor.slice(1);
                combinedAuthor = `${capLocal}-${existingAuthor}`;
            }

            const timeMatch = localBlock.header.match(/^\[[A-Za-z0-9\s\-]+,(.*)\]$/);
            const newTimePart = timeMatch ? timeMatch[1].trim() : `${localBlock.parsed?.day}/${localBlock.parsed?.month}`;

            dbBlock.header = `[${combinedAuthor}, ${newTimePart}]`;
            if (dbBlock.parsed) dbBlock.parsed.author = combinedAuthor;

            localBlock.lines.forEach(newLine => {
                const newStripped = stripTagsForCompare(newLine);
                if (!newStripped) return;

                // Cek kecocokan teks mutlak atau berbasis kemiripan (untuk rencana tindakan)
                let matchIdx = dbBlock.lines.findIndex(oldLine => stripTagsForCompare(oldLine) === newStripped);
                if (matchIdx === -1) {
                    matchIdx = dbBlock.lines.findIndex(oldLine => lineSimilarity(stripTagsForCompare(oldLine), newStripped) >= SIMILARITY_THRESHOLD);
                }

                if (matchIdx !== -1) {
                    dbBlock.lines[matchIdx] = newLine;
                } else {
                    dbBlock.lines.push(newLine);
                }
            });
        };

        // Jalur pemisahan eksekusi logika
        localBlocks.forEach(localBlock => {
            if (!localBlock.parsed) return;

            let merged = false;
            for (let i = 0; i < dbBlocks.length; i++) {
                const dbBlock = dbBlocks[i];
                if (!dbBlock.parsed) continue;

                // Otak A: Khusus Kolom P (Planning) -> Cari kemiripan teks lintas jam tanpa batas waktu
                if (isPlanning) {
                    let hasSimilarLine = localBlock.lines.some(localLine => {
                        const localStripped = stripTagsForCompare(localLine);
                        return dbBlock.lines.some(dbLine => lineSimilarity(stripTagsForCompare(dbLine), localStripped) >= SIMILARITY_THRESHOLD);
                    });

                    if (hasSimilarLine) {
                        mergeTwoBlocks(dbBlock, localBlock);
                        merged = true;
                        break;
                    }
                }
                // Otak B: Kolom O (Objective/Lab) -> Gunakan sistem sensor ketat toleransi 30 menit
                else if (dbBlock.parsed.day === localBlock.parsed.day && dbBlock.parsed.month === localBlock.parsed.month) {
                    const dbTime = dbBlock.parsed.hour * 60 + dbBlock.parsed.minute;
                    const localTime = localBlock.parsed.hour * 60 + localBlock.parsed.minute;
                    const timeDiff = Math.abs(localTime - dbTime);

                    if (timeDiff <= 5) {
                        mergeTwoBlocks(dbBlock, localBlock);
                        merged = true;
                        break;
                    }
                }
            }

            if (!merged) {
                // Jika benar-benar baru, buat baris stempel terpisah di paling atas
                dbBlocks.unshift(localBlock);
            }
        });

        const finalLines = [];
        dbBlocks.forEach(b => {
            if (b.lines.length > 0) {
                finalLines.push(b.header);
                b.lines.forEach(l => finalLines.push(l));
                finalLines.push("");
            }
        });

        return finalLines.join('\n').trim();
    };

    const handleSubmit = async (e) => {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        if (!formData.name || !formData.roomNumber || !formData.dpjpName) {
            alert('Mohon lengkapi data wajib (Nama, Kamar, DPJP).');
            return;
        }

        const isRoomOccupied = occupiedRooms.includes(formData.roomNumber) &&
            (!isEditing || (isEditing && formData.roomNumber !== activeRecords.find(r => r.id === currentRecordId)?.roomNumber));

        if (!isEditing && isRoomOccupied) return alert(`Kamar ${formData.roomNumber} sudah terisi.`);

        const now = Timestamp.now();
        const myName = (currentUser?.name || 'perawat').split(' ')[0].toLowerCase();

        // ✨ PROSES UPLOAD GAMBAR (100% CLOUDINARY - BEBAS ERROR)
        const hasEvidence = formData.evidenceImages && formData.evidenceImages.length > 0;
        const hasRadiology = formData.radiologyImages && formData.radiologyImages.length > 0;

        // 🔥 Konfigurasi Cloudinary (Berlaku untuk Lampiran Luka & Radiologi)
        const CLOUDINARY_URL = import.meta.env.VITE_CLOUDINARY_URL;
        const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;

        // 1. Upload Gambar Lampiran Biasa (Luka dll)
        let finalEvidenceImages = [];
        if (hasEvidence) {
            for (let img of formData.evidenceImages) {
                if (img && img.startsWith('data:image')) {
                    try {
                        const uploadData = new FormData();
                        uploadData.append("file", img);
                        uploadData.append("upload_preset", CLOUDINARY_PRESET);

                        const response = await fetch(CLOUDINARY_URL, {
                            method: "POST",
                            body: uploadData
                        });
                        const resultCloudinary = await response.json();

                        finalEvidenceImages.push(resultCloudinary.secure_url);
                    } catch (err) {
                        console.error("Gagal upload lampiran:", err);
                        alert("Gagal mengunggah foto luka. Pastikan internet stabil.");
                        return;
                    }
                } else {
                    // Jika sudah berupa link, langsung masukkan
                    finalEvidenceImages.push(img);
                }
            }
        }

        // 2. Upload Gambar Rontgen/Radiologi
        let finalRadiologyImages = [];
        if (hasRadiology) {
            for (let rad of formData.radiologyImages) {
                const currentImgData = rad.imageUrl || (typeof rad === 'string' ? rad : '');

                if (currentImgData && currentImgData.startsWith('data:image')) {
                    try {
                        const uploadData = new FormData();
                        uploadData.append("file", currentImgData);
                        uploadData.append("upload_preset", CLOUDINARY_PRESET);

                        const response = await fetch(CLOUDINARY_URL, {
                            method: "POST",
                            body: uploadData
                        });

                        const resultCloudinary = await response.json();

                        finalRadiologyImages.push({
                            ...rad,
                            imageUrl: resultCloudinary.secure_url
                        });
                    } catch (err) {
                        console.error("Gagal upload radiologi:", err);
                        alert(`Gagal mengunggah gambar ${rad.category || 'radiologi'}.`);
                        return;
                    }
                } else {
                    // Jika sudah berupa link, loloskan saja
                    finalRadiologyImages.push(rad);
                }
            }
        }

        // ✨ FIX: Menyiapkan data untuk dikirim ke database
        const baseData = {
            ...formData,
            evidenceImages: finalEvidenceImages,     // <--- Menggunakan Link URL
            radiologyImages: finalRadiologyImages,   // <--- Menggunakan Link URL
            subjective: (formData.subjective || '').trim(),
            objective: (formData.objective || '').trim(),
            analysis: (formData.analysis || '').trim(),
            planning: (formData.planning || '').trim(),
            // 💊 RESEP OBAT PERSISTEN: Selalu disimpan ke root dokumen
            currentPrescription: (formData.currentPrescription || '').trim(),
            admissionDate: parseDateCM(formData.admissionDate),
            updatedAt: now,
            ward: currentUser?.ward || 'MELATI'
        };

        // ✨ MULTIUSER: Field snapshot internal ini hanya dipakai untuk deteksi baris baru,
        // jangan ikut tersimpan ke Firestore.
        delete baseData.initialSubjective;
        delete baseData.initialObjective;
        delete baseData.initialAnalysis;
        delete baseData.initialPlanning;
        delete baseData.initialUpdatedAt;

        const ref = getCollectionRef();

        if (isEditing && currentRecordId) {
            const docRef = doc(ref, currentRecordId);
            const myDisplayName = (currentUser?.name || 'Perawat').split(' ')[0];

            // ✨ MODE PERSONAL: Simpan langsung ke laci pribadi, tidak sentuh root SOAP
            if (soapMode === 'personal') {
                try {
                    const personalKey = currentUser?.name || 'perawat';

                    // ✨ FIX 1: Ambil data dasar (kamar, dpjp, gambar rontgen/luka, dll)
                    let updateData = { ...baseData };

                    // Hapus S,O,A,P utama agar catatan ruangan tidak ikut tertimpa oleh draf pribadi
                    delete updateData.subjective;
                    delete updateData.objective;
                    delete updateData.analysis;
                    delete updateData.planning;

                    // Sisipkan data draf khusus ke laci personal
                    updateData[`personalNotes.${personalKey}.subjective`] = (formData.subjective || '').trim();
                    updateData[`personalNotes.${personalKey}.objective`] = (formData.objective || '').trim();
                    updateData[`personalNotes.${personalKey}.analysis`] = (formData.analysis || '').trim();
                    updateData[`personalNotes.${personalKey}.planning`] = (formData.planning || '').trim();
                    updateData[`personalNotes.${personalKey}.updatedAt`] = now;

                    // 💊 RESEP OBAT: Sifatnya instruksi medis ruangan (seumur hidup pasien),
                    // disimpan langsung ke ROOT dokumen (bukan ke personalNotes) agar persisten
                    // dan bisa dibaca oleh semua perawat serta PrintLayout.
                    updateData.currentPrescription = (formData.currentPrescription || '').trim();

                    await updateDoc(docRef, updateData);
                } catch (e) {
                    console.error("Gagal simpan catatan personal:", e);
                    alert("Gagal menyimpan catatan pribadi: " + (e.message || "periksa koneksi internet."));
                    return;
                }
                resetForm();
                setShowInputModal(false);
                return; // ← Selesai, tidak perlu lanjut ke logika ruangan
            }

            // ✨ MODE RUANGAN: Jalur lama — smartMergeLines ke root SOAP (catatan gabungan final)
            try {
                const docSnap = await getDoc(docRef);
                let result = { ...baseData };

                if (docSnap.exists()) {
                    const latestDbData = docSnap.data();

                    // --- Tracking "Tim Perawat Hari Ini" (reset otomatis tiap hari) ---
                    const lastUpdateDate = latestDbData.updatedAt?.toDate ? latestDbData.updatedAt.toDate() : new Date(0);
                    const today = new Date();
                    let newContributors = [];

                    if (lastUpdateDate.getDate() === today.getDate() && lastUpdateDate.getMonth() === today.getMonth() && lastUpdateDate.getFullYear() === today.getFullYear()) {
                        newContributors = Array.from(new Set([...(latestDbData.contributors || []), myName]));
                    } else {
                        newContributors = [myName];
                    }
                    result.contributors = newContributors;

                    const fields = ['subjective', 'objective', 'analysis', 'planning'];
                    fields.forEach((field) => {
                        const initialField = `initial${field.charAt(0).toUpperCase()}${field.slice(1)}`;
                        const newLines = getNewLines(baseData[field], formData[initialField]);
                        const removedLines = getRemovedLines(baseData[field], formData[initialField]);

                        if (newLines.length === 0 && removedLines.length === 0) {
                            result[field] = (latestDbData[field] || '').trim();
                        } else {
                            const taggedNewLines = newLines.length > 0 ? tagNewLines(newLines.join('\n'), myDisplayName) : '';
                            result[field] = smartMergeLines(latestDbData[field], taggedNewLines, removedLines, field === 'planning');
                        }
                    });
                } else {
                    result.contributors = [myName];
                    // Dokumen baru: tag semua baris SOAP yang diisi sebagai milik perawat ini
                    ['subjective', 'objective', 'analysis', 'planning'].forEach((field) => {
                        if (result[field]) result[field] = tagNewLines(result[field], myDisplayName);
                    });
                }

                // ✨ TABEL LAB MULTI-DATE + TIMESTAMP JAM: Sensitif terhadap koreksi ketat (Hiperkalemi / Gula Darah)
                const rebuildLabHistory = (objectiveText) => {
                    if (!objectiveText) return [];
                    const historyMap = {};
                    const lines = objectiveText.split('\n').map(l => l.trim()).filter(Boolean);

                    const today = new Date();
                    const dToday = String(today.getDate()).padStart(2, '0');
                    const mToday = String(today.getMonth() + 1).padStart(2, '0');
                    const timeToday = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
                    let currentDateTimeLabel = `${dToday}/${mToday}, ${timeToday}`;

                    lines.forEach(line => {
                        Object.keys(LAB_PATTERNS).forEach(key => {
                            // 🔓 Pintu blokir Gram/Sputum di laci penyimpanan utama sudah dicabut!
                            const match = line.match(LAB_PATTERNS[key]);
                            if (match && match[1]) {
                                if (!historyMap[currentDateTimeLabel]) historyMap[currentDateTimeLabel] = {};
                                if (!historyMap[currentDateTimeLabel][key]) {
                                    historyMap[currentDateTimeLabel][key] = match[1].trim().replace(',', '.');
                                }
                            }
                        });
                    });

                    return Object.entries(historyMap).map(([dateTime, values]) => ({ date: dateTime, values }))
                        .sort((a, b) => {
                            const parseDateTime = (str) => {
                                const parts = str.match(/(\d+)\/(\d+),\s*(\d+)\.(\d+)/);
                                if (parts) return new Date(2026, parts[2] - 1, parts[1], parts[3], parts[4]);
                                return new Date(0);
                            };
                            return parseDateTime(b.date) - parseDateTime(a.date);
                        }).slice(0, 10);
                };

                // ✨ FIX HYBRID MERGE: Mencegah kolom jam lama hilang saat teks ditimpa smartMerge
                const existingHistory = (docSnap && docSnap.exists() ? docSnap.data().labHistory : []) || [];
                const combinedHistoryMap = {};

                // 1. Selamatkan data masa lalu dari database (termasuk jam 18:48)
                existingHistory.forEach(item => {
                    if (item.date) {
                        combinedHistoryMap[item.date] = item.values || {};
                    }
                });

                // 2. Ekstrak data terbaru dari teks (jam 18:49)
                const parsedFromText = rebuildLabHistory(result.objective || '');
                parsedFromText.forEach(item => {
                    combinedHistoryMap[item.date] = {
                        ...(combinedHistoryMap[item.date] || {}),
                        ...item.values
                    };
                });

                // 3. Gabungkan dan urutkan semua jam dari yang terbaru ke terlama
                result.labHistory = Object.entries(combinedHistoryMap)
                    .map(([dateLabel, values]) => ({ date: dateLabel, values }))
                    .sort((a, b) => {
                        const parseDateTime = (str) => {
                            // Membaca format "19/06, 18.49" atau "19/06, 18:49"
                            const parts = str.match(/(\d+)\/(\d+)(?:,\s*(\d+)[:\.](\d+))?/);
                            if (parts) {
                                const day = parseInt(parts[1], 10);
                                const month = parseInt(parts[2], 10) - 1;
                                const hour = parts[3] ? parseInt(parts[3], 10) : 0;
                                const min = parts[4] ? parseInt(parts[4], 10) : 0;
                                return new Date(2026, month, day, hour, min);
                            }
                            return new Date(0);
                        };
                        return parseDateTime(b.date) - parseDateTime(a.date);
                    })
                    .slice(0, 10); // Batasi maksimal 10 kolom riwayat ke samping agar tidak kepanjangan

                await setDoc(docRef, result, { merge: true });
                const finalData = result;

                // Simpan rekaman ke Sub-Koleksi Notes (Riwayat) di luar transaksi
                if (db) {
                    // ✅ FIX: Ganti appId menjadi firebaseConfig.appId
                    const notesRef = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${currentRecordId}/notes`);
                    await addDoc(notesRef, {
                        ...finalData,
                        createdAt: now,
                        noteType: 'daily_update',
                        savedBy: currentUser?.name || 'System'
                    });
                }
            } catch (e) {
                console.error("Gagal update & merge:", e);
                alert("Gagal menyimpan: " + (e.message || "periksa koneksi internet, lalu coba simpan ulang."));
                return;
            }
        } else {
            // Mode Pasien Baru
            baseData.createdAt = now;
            baseData.contributors = [myName];

            // ✨ Inisialisasi labHistory untuk pasien baru (Format Seragam DD/MM/YY)
            const labSnapshot = extractLabSnapshot(baseData.objective || '');
            if (Object.keys(labSnapshot).length > 0) {
                const today = new Date();
                const d = String(today.getDate()).padStart(2, '0');
                const m = String(today.getMonth() + 1).padStart(2, '0');
                const y = String(today.getFullYear()).substring(2);
                const dateLabel = `${d}/${m}/${y}`;
                baseData.labHistory = [{ date: dateLabel, values: labSnapshot }];
            }

            // 🔥 PERBAIKAN: Gunakan 'await' dan panggil firebaseConfig.appId secara lengkap
            try {
                const newDoc = await addDoc(ref, baseData);
                if (db) {
                    // Perbaikan di baris ini: Menggunakan firebaseConfig.appId
                    const notesRef = collection(db, `artifacts/${firebaseConfig.appId}/public/data/medicalRecords/${newDoc.id}/notes`);
                    await addDoc(notesRef, {
                        ...baseData,
                        createdAt: now,
                        noteType: 'daily_update',
                        savedBy: currentUser?.name || 'System'
                    });
                }
            } catch (err) {
                console.error("Gagal tambah pasien:", err);
                alert("Gagal menambahkan pasien baru. Periksa jaringan Anda.");
                return;
            }
        }

        resetForm();
        setShowInputModal(false);
    };

    const handleSaveQuickTtv = async (ttvString) => {
        if (!quickTtvTarget || !db) return;
        setLoading(true);
        try {
            const ref = doc(db, `artifacts/${appId}/public/data/medicalRecords`, quickTtvTarget.id);
            const oldObjective = quickTtvTarget.objective || '';
            const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const finalObjective = `[${timeStr}] ${ttvString}\n` + oldObjective;

            await updateDoc(ref, { objective: finalObjective, updatedAt: Timestamp.now() });

            const notesRef = collection(db, `artifacts/${appId}/public/data/medicalRecords/${quickTtvTarget.id}/notes`);
            await addDoc(notesRef, {
                ...quickTtvTarget,
                objective: finalObjective,
                noteType: 'ttv_update',
                createdAt: Timestamp.now(),
                savedBy: currentUser?.name || 'System',
                ward: currentUser?.ward || 'MELATI' // ✨ TAHAP 2: STEMPEL TTV BANGSAL
            });
            setQuickTtvTarget(null); setShowTtvModal(false);
        } catch (e) { alert("Gagal menyimpan TTV."); } finally { setLoading(false); }
    };

    // --- WAITING LIST LOGIC ---
    const handleAddWaiting = async (data) => {
        try {
            const wlRef = collection(db, `artifacts/${appId}/public/data/waitingList`);
            await addDoc(wlRef, { ...data, createdAt: Timestamp.now() });
        } catch (e) { alert("Gagal: " + e.message); }
    };

    const handleDeleteWaiting = async (id) => {
        if (!window.confirm("Hapus antrean?")) return;
        try { await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, id)); } catch (e) { }
    };

    // --- FUNGSI AUTO-SAVE BUKU CM (INLINE EDIT) ---
    const updateRecord = async (id, updatedFields) => {
        try {
            const colRef = getCollectionRef();
            if (!colRef) return;

            // Membuat referensi ke dokumen pasien spesifik
            const docRef = doc(colRef.firestore, colRef.path, id);

            // Menembak update ke database Firestore
            await updateDoc(docRef, updatedFields);
            console.log("Auto-save Buku CM berhasil!");
        } catch (error) {
            console.error("Gagal auto-save Buku CM:", error);
            alert("Gagal menyimpan otomatis. Cek koneksi internet.");
        }
    };

    const handleMoveToRoom = async (waitRec) => {
        const isOccupied = activeRecords.some(r => r.roomNumber === waitRec.plannedRoom);
        if (isOccupied) return alert(`Kamar ${waitRec.plannedRoom} masih TERISI!`);
        if (!window.confirm(`Masukkan ${waitRec.name} ke kamar ${waitRec.plannedRoom}?`)) return;

        try {
            setLoading(true);
            await addDoc(getCollectionRef(), {
                name: waitRec.name, roomNumber: waitRec.plannedRoom, dpjpName: 'dr. Belum Dipilih', gender: '',
                createdAt: Timestamp.now(), updatedAt: Timestamp.now(), isDischarged: false,
                planning: waitRec.diagnosis ? `Diagnosa Awal: ${waitRec.diagnosis}` : ''
            });
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/waitingList`, waitRec.id));
            setView('dashboard');
        } catch (e) { alert("Error saat check-in."); } finally { setLoading(false); }
    };

    const updateWaitingListRoom = async (itemId, newRoom) => {
        const updatedList = waitingList.map(item => item.id === itemId ? { ...item, plannedRoom: newRoom } : item);
        setWaitingList(updatedList);
        try {
            const itemRef = doc(db, `artifacts/${appId}/public/data/waitingList`, itemId);
            await updateDoc(itemRef, { plannedRoom: newRoom });
        } catch (e) { console.error(e); }
    };

    const handleEdit = async (rec) => {
        const formatPrependOpen = (text) => {
            if (!text || !text.trim()) return '';
            const trimmed = text.trim();
            if (trimmed.startsWith('\n')) return trimmed;
            return `\n\n${trimmed}`;
        };

        // ✨ ENGINE SIKLUS SHIFT (Batas Hari Dinas: 15:00 WIB)
        const getShiftDay = (date) => {
            const d = new Date(date);
            // Jika masih sebelum jam 15:00 (misal 14:00), hitungannya masih ikut Shift Kemarin
            if (d.getHours() < 15) {
                d.setDate(d.getDate() - 1);
            }
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        };

        const lastUpdateDate = rec.updatedAt?.toDate ? rec.updatedAt.toDate() : new Date(0);
        const today = new Date();

        // Deteksi apakah form dibuka di hari Shift yang sama atau sudah ganti Shift
        const isSameShift = getShiftDay(lastUpdateDate) === getShiftDay(today);

        // Ekstraksi resep obat lama agar tidak ikut terhapus
        const extractPrescription = (pText) => {
            if (!pText) return '';
            const match = pText.match(/\[RESEP OBAT\]:([\s\S]*)/i);
            return match ? match[1].trim() : '';
        };
        const activePrescription = rec.currentPrescription || extractPrescription(rec.planning);

        setFormData({
            roomNumber: rec.roomNumber,
            name: rec.name,
            rmNumber: rec.rmNumber || '',
            gender: rec.gender || '',
            dpjpName: rec.dpjpName,
            raberName: rec.raberName || '',
            raber2Name: rec.raber2Name || '',

            // ✨ MODE SOAP: Ambil S-O-A-P dari laci yang sesuai
            // Mode 'personal' → baca dari personalNotes[namaku] (draft pribadi)
            // Mode 'ruangan'  → baca dari root dokumen (catatan gabungan final)
            ...(() => {
                const isPersonal = soapMode === 'personal';
                const src = isPersonal
                    ? (rec.personalNotes?.[currentUser?.name] || {})
                    : rec;
                return {
                    subjective: formatPrependOpen(src.subjective || ''),
                    objective: formatPrependOpen(src.objective || ''),
                    analysis: formatPrependOpen(src.analysis || ''),
                    planning: formatPrependOpen(src.planning || ''),
                    initialSubjective: (src.subjective || '').trim(),
                    initialObjective: (src.objective || '').trim(),
                    initialAnalysis: (src.analysis || '').trim(),
                    initialPlanning: (src.planning || '').trim(),
                };
            })(),

            // 💊 RESEP OBAT DIKUNCI: Tetap bertahan seumur hidup
            currentPrescription: activePrescription,

            isDischarged: false,
            evidenceImages: rec.evidenceImages || [],
            bpjsClass: rec.bpjsClass || '',
            admissionDate: rec.admissionDate || '',
            initialUpdatedAt: rec.updatedAt || null,
            contributors: rec.contributors || [],
            radiologyImages: rec.radiologyImages || []
        });

        setCurrentRecordId(rec.id);
        setIsEditing(true);
        setShowRaber1(!!rec.raberName);
        setShowRaber2(!!rec.raber2Name);
        setShowInputModal(true);
    };

    // Bisa dipanggil dari tombol di kartu Ontang-anting (Cara C) ATAU tombol di header
    // modal form saat mode personal aktif (Cara A).
    // ✨ PUBLIKASIKAN KE RUANGAN: Merge catatan pribadi perawat ke root SOAP (catatan gabungan).
    const handlePublishToRoom = async (rec) => {
        if (!rec || !rec.id) return;
        const myName = currentUser?.name || 'perawat';
        const myDisplayName = myName.split(' ')[0];
        const personalNotes = rec.personalNotes?.[myName] || {};

        // Tidak ada catatan pribadi → tidak ada yang dipublikasikan
        const hasContent = ['subjective', 'objective', 'analysis', 'planning']
            .some(f => (personalNotes[f] || '').trim());
        if (!hasContent) {
            alert('Belum ada catatan pribadi untuk dipublikasikan ke ruangan.');
            return;
        }

        try {
            const ref = getCollectionRef();
            const docRef = doc(ref, rec.id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) { alert('Data pasien tidak ditemukan.'); return; }

            const latestDbData = docSnap.data();
            const now = Timestamp.now();
            const myShortName = myDisplayName.charAt(0).toUpperCase() + myDisplayName.slice(1);

            // Merge tiap field pribadi ke root
            const update = { updatedAt: now };
            const fields = ['subjective', 'objective', 'analysis', 'planning'];
            fields.forEach(field => {
                const personalText = (personalNotes[field] || '').trim();
                if (!personalText) {
                    update[field] = latestDbData[field] || '';
                    return;
                }
                const tagged = tagNewLines(personalText, myShortName);
                update[field] = smartMergeLines(latestDbData[field] || '', tagged, [], field === 'planning');
            });

            // ✨ FIX 2: Buka gerbang Gram/Sputum saat draf pribadi dipublikasikan ke ruangan
            const rebuildLabHistory = (objectiveText) => {
                if (!objectiveText) return [];
                const historyMap = {};
                const lines = objectiveText.split('\n').map(l => l.trim()).filter(Boolean);

                const today = new Date();
                const dToday = String(today.getDate()).padStart(2, '0');
                const mToday = String(today.getMonth() + 1).padStart(2, '0');
                const timeToday = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
                let currentDateTimeLabel = `${dToday}/${mToday}, ${timeToday}`;

                lines.forEach(line => {
                    Object.keys(LAB_PATTERNS).forEach(key => {
                        // 🔓 Pintu blokir Gram/Sputum di laci publikasi juga sudah dicabut!
                        const match = line.match(LAB_PATTERNS[key]);
                        if (match && match[1]) {
                            if (!historyMap[currentDateTimeLabel]) historyMap[currentDateTimeLabel] = {};
                            if (!historyMap[currentDateTimeLabel][key]) {
                                historyMap[currentDateTimeLabel][key] = match[1].trim().replace(',', '.');
                            }
                        }
                    });
                });

                return Object.entries(historyMap).map(([dateTime, values]) => ({ date: dateTime, values }))
                    .sort((a, b) => {
                        const parseDateTime = (str) => {
                            const parts = str.match(/(\d+)\/(\d+),\s*(\d+)\.(\d+)/);
                            if (parts) return new Date(2026, parts[2] - 1, parts[1], parts[3], parts[4]);
                            return new Date(0);
                        };
                        return parseDateTime(b.date) - parseDateTime(a.date);
                    }).slice(0, 10);
            };

            const existingHistory = latestDbData.labHistory || [];
            const combinedHistoryMap = {};
            existingHistory.forEach(item => { if (item.date) combinedHistoryMap[item.date] = item.values || {}; });

            const parsedFromText = rebuildLabHistory(update.objective || '');
            parsedFromText.forEach(item => {
                combinedHistoryMap[item.date] = { ...(combinedHistoryMap[item.date] || {}), ...item.values };
            });

            update.labHistory = Object.entries(combinedHistoryMap)
                .map(([dateLabel, values]) => ({ date: dateLabel, values }))
                .sort((a, b) => {
                    const parseDateTime = (str) => {
                        const parts = str.match(/(\d+)\/(\d+)(?:,\s*(\d+)[:\.](\d+))?/);
                        if (parts) {
                            const day = parseInt(parts[1], 10);
                            const month = parseInt(parts[2], 10) - 1;
                            const hour = parts[3] ? parseInt(parts[3], 10) : 0;
                            const min = parts[4] ? parseInt(parts[4], 10) : 0;
                            return new Date(2026, month, day, hour, min);
                        }
                        return new Date(0);
                    };
                    return parseDateTime(b.date) - parseDateTime(a.date);
                }).slice(0, 10);

            // Update kontributor hari ini
            const lastDate = latestDbData.updatedAt?.toDate ? latestDbData.updatedAt.toDate() : new Date(0);
            const today = new Date();
            const sameDay = lastDate.getDate() === today.getDate() && lastDate.getMonth() === today.getMonth() && lastDate.getFullYear() === today.getFullYear();
            const myShortLower = myName.split(' ')[0].toLowerCase();
            update.contributors = sameDay ? Array.from(new Set([...(latestDbData.contributors || []), myShortLower])) : [myShortLower];

            await setDoc(docRef, update, { merge: true });

            // ✨ Opsional: Mengosongkan draf pribadi setelah sukses dipublish agar rapi
            const clearDraft = {
                [`personalNotes.${myName}.subjective`]: '',
                [`personalNotes.${myName}.objective`]: '',
                [`personalNotes.${myName}.analysis`]: '',
                [`personalNotes.${myName}.planning`]: '',
            };
            await updateDoc(docRef, clearDraft);

            alert(`✅ Catatan ${myDisplayName} berhasil dipublikasikan ke Mode Ruangan.`);
        } catch (e) {
            console.error('Gagal publikasi ke ruangan:', e);
            alert('Gagal mempublikasikan: ' + (e.message || 'periksa koneksi internet.'));
        }
    };
    const handleAddRadiologyImage = (newImages) => {
        setFormData(prev => ({
            ...prev,
            radiologyImages: [...(prev.radiologyImages || []), ...newImages]
        }));
    };

    const handleRemoveRadiologyImage = (imageId) => {
        setFormData(prev => ({
            ...prev,
            radiologyImages: (prev.radiologyImages || []).filter(img => img.id !== imageId)
        }));
    };

    const handleDischarge = (id, name, room) => {
        setRecordForDischarge({ id, name, room });
    };

    // --- FUNGSI KLIK LAPOR SHIFT ---
    const handleLaporShift = () => {
        try {
            // 🚀 OPER archivedRecords AGAR PASIEN PULANG/PINDAH/MENINGGAL DAPAT DIHITUNG
            const waLink = generateShiftReport(
                activeRecords, 
                archivedRecords, 
                waitingList, 
                dpjpProfiles, 
                currentWardConfig.name, 
                currentWardConfig.roomList
            );
            window.open(`https://wa.me/?text=${waLink}`, '_blank');
        } catch (err) {
            alert("Gagal memproses laporan: " + err.message);
            console.error(err);
        }
        setShowLaporModal(false);
    };

    const handleLaporCS = () => {
        // ✨ FIX MULTI-BANGSAL: Cari kasur kosong berdasarkan bangsal aktif
        const occupiedRooms = activeRecords.map(r => r.roomNumber);
        const emptyBeds = currentWardConfig.roomList.filter(room => !occupiedRooms.includes(room));

        // Ekstrak angka kamar, buang duplikat, lalu URUTKAN dari terkecil ke terbesar
        const emptyRoomNumbers = [...new Set(emptyBeds.map(room => {
            const match = room.match(/\d+/); // Ambil angkanya saja
            return match ? match[0] : '';
        }))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));

        if (emptyRoomNumbers.length === 0) {
            alert("Semua kamar terisi, tidak ada kamar yang kosong untuk dibersihkan.");
            return;
        }

        // Teks laporan otomatis menyesuaikan nama bangsal aktif
        const teksCS = `Assalamualaikum a. Mohon bantuannya untuk merapikan/membersihkan Kamar yang sudah kosong di *Ruang ${currentWardConfig.name}*:\n\n*Kamar:* ${emptyRoomNumbers.map(n => 'K.' + n).join(', ')}\n\nTerima kasih Banyak.`;

        const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(teksCS)}`;
        window.open(waLink, '_blank');
    };

    const processDischarge = async (type) => {
        if (!recordForDischarge) return;
        const { id, name, room } = recordForDischarge;
        setLoading(true);
        try {
            const ref = getCollectionRef();
            await updateDoc(doc(ref, id), {
                isDischarged: true,
                lastRoom: room || '',
                roomNumber: '',
                dischargeDate: new Date().toISOString(),
                dischargeType: type, // <-- INI KUNCINYA
                updatedAt: Timestamp.now()
            });
            fetchArchivedRecords();
        } catch (e) { console.error(e); } finally { setLoading(false); setRecordForDischarge(null); }
    };

    const normalizePhone = (num) => {
        if (!num) return '';
        const digits = String(num).replace(/\D/g, '');
        if (digits.startsWith('0')) return '62' + digits.substring(1);
        if (digits.startsWith('8')) return '62' + digits;
        return digits;
    };


    // --- FUNGSI 1: LAPOR JUMLAH KE DPJP (DENGAN FILTER TOLERANSI SALAM) ---
    const handleReportDpjpCount = (drName, count) => {
        const profile = dpjpProfiles.find(p => p.name === drName);
        const phone = profile ? normalizePhone(profile.waNumber) : '';
        if (!phone) return alert(`Nomor WA ${drName} belum disetting.`);

        // 🤖 Pembangkit Salam Waktu Lokal
        const h = new Date().getHours();
        let salam = "Selamat Malam";
        if (h >= 4 && h < 10) salam = "Selamat Pagi";
        else if (h >= 10 && h < 15) salam = "Selamat Siang";
        else if (h >= 15 && h < 18) salam = "Selamat Sore";

        // ✨ LOGIKA SALAM KHUSUS (Toleransi Agama)
        const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
        const isNonMuslim = nonMuslimDoctors.some(name => drName.toLowerCase().includes(name.toLowerCase()));
        const prefixSalam = isNonMuslim ? salam : `Assalamualaikum, ${salam}`;

        const text = `${prefixSalam} dokter, saya ${currentUser?.name} dari Ruang ${currentWardConfig.name}. Izin melaporkan jumlah pasien dokter hari ini ada ${count} pasien ya dok. Terima kasih.`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // --- FUNGSI 2: LAPOR KE RABER / KONSUL (DENGAN FILTER TOLERANSI SALAM & PESAN DR. EDI) ---
    const handleReportRaber = (drName, patientNames) => {
        const profile = dpjpProfiles.find(p => p.name === drName);
        const phone = profile ? normalizePhone(profile.waNumber) : '';

        if (!phone) return alert(`Nomor WA ${drName} belum disetting di Master Data.`);

        // 🤖 Pembangkit Salam Waktu Lokal
        const h = new Date().getHours();
        let salam = "Selamat Malam";
        if (h >= 4 && h < 10) salam = "Selamat Pagi";
        else if (h >= 10 && h < 15) salam = "Selamat Siang";
        else if (h >= 15 && h < 18) salam = "Selamat Sore";

        // ✨ LOGIKA SALAM KHUSUS (Toleransi Agama)
        const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
        const isNonMuslim = nonMuslimDoctors.some(name => drName.toLowerCase().includes(name.toLowerCase()));
        const prefixSalam = isNonMuslim ? salam : `Assalamualaikum, ${salam}`;

        let text = '';

        // ✨ LOGIKA PESAN KHUSUS DR. EDI
        if (drName.toLowerCase().includes('edi')) {
            text = `Assalamualaikum dokter, ini ${currentUser?.name} dari Ruang ${currentWardConfig.name}, mengingatkan ada pasien HD atas nama: ${patientNames.join(', ')}`;
        }
        // Logika pesan untuk dokter raber lainnya
        else {
            text = `${prefixSalam} dokter, saya ${currentUser?.name} dari Ruang ${currentWardConfig.name}. Izin mengingatkan hari ini ada pasien Raber ya dok a.n ${patientNames.join(', ')}. Terima kasih.`;
        }

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // --- FUNGSI PENGGABUNG GAMBAR (ANTI-RIBET) ---
    const combineImages = async (imageSources) => {
        if (!imageSources || imageSources.length === 0) return null;
        if (imageSources.length === 1) return imageSources[0];

        return new Promise((resolve) => {
            const images = imageSources.map(src => {
                const img = new Image();
                img.src = src;
                return img;
            });

            // Tunggu semua gambar termuat
            Promise.all(images.map(img => new Promise(res => img.onload = res))).then(() => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Atur lebar mengikuti gambar terlebar, tinggi dijumlahkan semua
                const maxWidth = Math.max(...images.map(img => img.width));
                const totalHeight = images.reduce((sum, img) => sum + img.height + 10, 0); // +10 untuk spasi antar gambar

                canvas.width = maxWidth;
                canvas.height = totalHeight;

                // Beri background putih agar rapi
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let currentY = 0;
                images.forEach(img => {
                    ctx.drawImage(img, (maxWidth - img.width) / 2, currentY); // Draw di tengah
                    currentY += img.height + 10;
                });

                resolve(canvas.toDataURL('image/jpeg', 0.8));
            });
        });
    };

    const handleLapor = async (rec, type) => {
        let targetNumber = '';
        let salam = '';

        // 1. BUAT SALAM OTOMATIS BERDASARKAN WAKTU
        const h = new Date().getHours();
        let salamWaktu = "Selamat Malam";
        if (h >= 4 && h < 10) salamWaktu = "Selamat Pagi";
        else if (h >= 10 && h < 15) salamWaktu = "Selamat Siang";
        else if (h >= 15 && h < 18) salamWaktu = "Selamat Sore";

        if (type === 'DPJP') {
            const profile = dpjpProfiles.find(p => p.name === rec.dpjpName);
            targetNumber = normalizePhone(profile?.waNumber);
            if (!targetNumber) return alert(`Nomor WA ${rec.dpjpName} belum disetting.`);

            // ✨ FIX 1: Hapus getDoctorGreeting yang bikin error! Kita pakai logika array pintar
            const nonMuslimDoctors = ['dr. Dian Ekowati', 'dr. Synthia', 'dr. Daniel'];
            const isNonMuslim = nonMuslimDoctors.some(name => (rec.dpjpName || '').toLowerCase().includes(name.toLowerCase()));
            salam = isNonMuslim ? salamWaktu : `Assalamualaikum, ${salamWaktu}`;
        } else {
            salam = `Assalamualaikum, ${salamWaktu}`;
        }

        // ✨ MESIN PEMILAH GENDER & USIA (MEMBACA TEKS NAMA)
        const getPatientTitle = (pRecord) => {
            const nameStr = String(pRecord?.name || '').toLowerCase().trim();
            const genderStr = String(pRecord?.gender || '').toLowerCase().trim();

            // 1. CEGAH GELAR GANDA
            if (/^(tn\.|ny\.|an\.|nn\.|by\.|sdr\.)\s/i.test(nameStr)) return "";

            // 2. DETEKSI BAYI/BALITA
            if (nameStr.includes('bln') || nameStr.includes('bulan') || nameStr.includes('hari') || nameStr.includes('by')) return "An. ";

            // 3. DETEKSI ANAK DARI ANGKA TAHUN
            const ageMatch = nameStr.match(/(?:^|\(|\s)(\d+)\s*(?:th|tahun|thn)/i);
            if (ageMatch && parseInt(ageMatch[1]) < 15) return "An. ";

            // 4. DEFAULT DEWASA BERDASARKAN GENDER
            if (genderStr === 'l' || genderStr.includes('laki')) return "Tn. ";
            if (genderStr === 'p' || genderStr.includes('perempuan') || genderStr.includes('wanita')) return "Ny. ";
            return "";
        };

        // ✨ MESIN PEMBERSIH STEMPEL KHUSUS WA
        const cleanForWA = (txt) => (txt || '').replace(/\[[^\]]+,\s*\d{1,2}\/\d{1,2}.*?\]\s*/g, '').trim();

        const patientTitle = getPatientTitle(rec);

        // Bersihkan Planning sebelum dipecah
        const { labs, rads, tms, others } = parsePlanning(cleanForWA(rec.planning));
        let planningText = [...others.filter(Boolean), labs.length > 0 ? `Lab: ${labs.join(', ')}` : null, rads.length > 0 ? `Rad: ${rads.join(', ')}` : null, tms.length > 0 ? `Tndkn: ${tms.join(', ')}` : null].filter(Boolean).join('\n');

        // ✨ FIX FINAL: BUANG LOOP BREAKDOWN AUTOMATIS (LAB, RAD, TM)
        // Kita langsung ambil teks mentah dari kotak P yang sudah dibersihkan untuk WA
        planningText = cleanForWA(rec.planning) || '-';

        // =====================================================================
        // ✨ FIX 2: SUNTIKKAN RESEP OBAT (CPO) KEMBALI KE DALAM TEKS WA (P)
        // =====================================================================
        if (rec.currentPrescription && rec.currentPrescription.trim()) {
            planningText += `\n\n*Terapi / Obat saat ini:*\n${cleanForWA(rec.currentPrescription)}`;
        }

        const dpjpInfo = type === 'Forward' ? `\nDPJP: ${rec.dpjpName || '-'}` : '';

        // ✨ FORMAT BARU (Nama Pasien Dibold Biar Elegan)
        const text = `${salam} dokter, saya ${currentUser?.name} dari Ruang ${currentWardConfig.name}. Izin lapor pasien:\n\n*${patientTitle}${rec.name}* ${dpjpInfo}\n\n*S:*\n${cleanForWA(rec.subjective) || '-'}\n\n*O:*\n${cleanForWA(rec.objective) || '-'}\n\n*A:*\n${cleanForWA(rec.analysis) || '-'}\n\n*P:*\n${planningText}\n\nMohon advisnya dokter,\nTerima kasih.`;

        try {
            await navigator.clipboard.writeText(text);
            if (rec.evidenceImages && rec.evidenceImages.length > 0) {
                const combinedImg = await combineImages(rec.evidenceImages);
                const imgWindow = window.open("", "_blank", "width=600,height=800");
                imgWindow.document.write(`
                  <html><head><title>Lampiran Gabungan - ${rec.name}</title></head>
                  <body style="margin:0; background:#000; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
                      <p style="font-size:12px;">📸 <b>1 Gambar Gabungan</b> (${rec.evidenceImages.length} Lampiran)</p>
                      <img src="${combinedImg}" style="max-width:95%; border:2px solid white; box-shadow: 0 0 15px rgba(0,0,0,0.5);">
                      <p style="font-size:11px; margin-top:15px; color:#aaa;">Tahan gambar lalu pilih <b>"Copy Image"</b> atau <b>"Share"</b> ke WA</p>
                      <button onclick="window.close()" style="margin-top:10px; padding:8px 20px; border-radius:5px; background:#444; color:#fff; border:none;">Tutup</button>
                  </body></html>
              `);
                alert("LAPORAN DISALIN!\n\nSemua lampiran rontgen sudah DIGABUNG menjadi 1 gambar. Silakan copas gambar tersebut ke WA.");
            }
        } catch (err) { console.error(err); }

        const url = targetNumber ? `https://wa.me/${targetNumber}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        setRecordForLapor(null);
    };

    const handleBulkDischarge = async (ids) => {
        setLoading(true);
        try {
            const ref = getCollectionRef();
            const updatePromises = ids.map(id => {
                // FIX: Ganti 'patients' menjadi 'activeRecords' agar data kamar terbaca
                const p = activeRecords.find(item => item.id === id);
                return updateDoc(doc(ref, id), {
                    isDischarged: true,
                    lastRoom: p?.roomNumber || '',
                    roomNumber: '',
                    dischargeDate: new Date().toISOString(),
                    updatedAt: Timestamp.now()
                });
            });
            await Promise.all(updatePromises);
            if (typeof fetchArchivedRecords === 'function') {
                fetchArchivedRecords();
            }
            alert(`${ids.length} pasien berhasil dipulangkan.`); // Tambah notifikasi biar mantap
        } catch (e) {
            console.error(e);
            alert("Gagal memulangkan pasien masal.");
        } finally {
            setLoading(false);
        }
    };

    // --- FUNGSI RESTORE (BATAL PULANG) ---
    const handleRestorePatient = async (id, name) => {
        if (window.confirm(`Kembalikan data ${name} ke Daftar Rawat Inap?\n(Status akan dikembalikan ke "Dirawat", pastikan kamu mengatur ulang kamarnya).`)) {
            try {
                const ref = getCollectionRef();
                await updateDoc(doc(ref, id), {
                    isDischarged: false, // Balikkan status jadi dirawat
                    updatedAt: Timestamp.now()
                });
                alert(`Sukses! Data ${name} dikembalikan.`);
                setView('patient-list'); // Arahkan kembali ke daftar pasien
            } catch (e) {
                alert("Gagal mengembalikan pasien.");
                console.error(e);
            }
        }
    };

    // --- FUNGSI HAPUS PERMANEN DARI ARSIP ---
    const handleDeletePermanent = async (id, name) => {
        if (!window.confirm(`PERINGATAN: Hapus permanen data ${name}?\nData ini akan hilang selamanya dari database.`)) return;

        setLoading(true);
        try {
            const ref = getCollectionRef();
            await deleteDoc(doc(ref, id));
            alert(`Data ${name} telah dihapus permanen.`);
        } catch (e) {
            alert("Gagal menghapus data.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (!records || records.length === 0) return alert("Tidak ada data.");
        const exported = records.filter(r => !r.isDischarged);
        const headers = ["No", "Tanggal", "Jam", "Nama", "Kamar", "DPJP", "Raber 1", "Raber 2", "Status", "S", "O", "A", "Planning Lain", "LAB", "RADIOLOGI", "TINDAKAN"];
        const escape = (str) => `"${(str || '').replace(/"/g, '""')}"`;
        const rows = exported.map((r, index) => {
            const parsedP = parsePlanning(r.planning);
            return [
                index + 1, r.createdAt.toLocaleDateString('id-ID'), r.createdAt.toLocaleTimeString('id-ID'),
                escape(r.name), escape(r.roomNumber), escape(r.dpjpName), escape(r.raberName), escape(r.raber2Name),
                r.isDischarged ? "Pulang" : "Dirawat", escape(r.subjective), escape(r.objective), escape(r.analysis),
                escape(parsedP.others.join('; ')), escape(parsedP.labs.join(', ')), escape(parsedP.rads.join(', ')), escape(parsedP.tms.join(', '))
            ].join(",");
        });
        const csv = [headers.join(","), ...rows].join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `Pasien_Melati_${new Date().toLocaleDateString('id-ID')}.csv`;
        link.click();
    };

    // --- STATS CALCULATION (VERSI SUPER: MULTI-SUFFIX KEBAL STEMPEL PERAWAT) ---
    const stats = useMemo(() => {
        // ✨ FIX ERROR: Ganti nama variabel jadi activeWard agar tidak bentrok
        const activeWard = currentUser?.ward || 'MELATI';

        // 1. Saring data pasien aktif yang saat ini sedang dirawat di bangsal
        const wardActiveRecords = activeRecords.filter(r => (r.ward || 'MELATI') === activeWard);

        // 2. GABUNGKAN data records ruangan saat ini dengan data dari Gudang Arsip (archivedRecords)
        const wardRecords = records.filter(r => (r.ward || 'MELATI') === activeWard);
        const wardArchivedRecords = (archivedRecords || []).filter(r => (r.ward || 'MELATI') === activeWard);
        const combinedRecords = [...wardRecords, ...wardArchivedRecords];

        const s = {
            total: combinedRecords.length,
            active: wardActiveRecords.length,
            discharged: combinedRecords.filter(r => r.isDischarged || r.status === 'discharged').length,
            monthly: {},
            dpjpCounts: {},
            raberData: {},
            emptyCount: 0,
            emptyMale: 0,
            emptyFemale: 0
        };

        const occupied = wardActiveRecords.map(r => r.roomNumber);

        // ✨ FIX BUG 2: Regex multi-suffix mendukung KM/P (Melati) dan A/B/C/D (Bangsal Lain)
        currentWardConfig.roomList.forEach(room => {
            if (!occupied.includes(room)) {
                const match = room.match(/^(K\d+)(KM|P|A|B|C|D)$/i);
                if (!match) {
                    s.emptyCount++;
                } else {
                    const roomCode = match[1];
                    const bedCode = match[2].toUpperCase();

                    // Saklar tukar pasangan bed dinamis universal
                    let neighborBed = '';
                    if (bedCode === 'KM') neighborBed = 'P';
                    else if (bedCode === 'P') neighborBed = 'KM';
                    else if (bedCode === 'A') neighborBed = 'B';
                    else if (bedCode === 'B') neighborBed = 'A';
                    else if (bedCode === 'C') neighborBed = 'D';
                    else if (bedCode === 'D') neighborBed = 'C';

                    const neighborRoom = `${roomCode}${neighborBed}`;
                    const neighborRec = wardActiveRecords.find(r => r.roomNumber === neighborRoom);

                    if (!neighborRec) {
                        s.emptyCount++;
                    } else if (neighborRec.gender === 'L') {
                        s.emptyMale++;
                    } else {
                        s.emptyFemale++;
                    }
                }
            }
        });

        // Kalkulasi rekap grafik bulanan
        combinedRecords.forEach(r => {
            if (!r.createdAt) return;

            const dateObj = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            const m = dateObj.toLocaleString('id-ID', { month: 'short', year: 'numeric' });

            if (!s.monthly[m]) s.monthly[m] = { active: 0, discharged: 0, pulang: 0, pindah: 0, meninggal: 0, lab: 0, rad: 0, tm: 0 };

            if (r.isDischarged || r.status === 'discharged') {
                s.monthly[m].discharged++;
                if (r.dischargeType === 'pindah') s.monthly[m].pindah++;
                else if (r.dischargeType === 'meninggal') s.monthly[m].meninggal++;
                else s.monthly[m].pulang++;
            } else {
                s.monthly[m].active++;
            }

            // ✨ FIX BUG 3: Gunakan parsePlanning bawaan agar hitungan kebal dari stempel dinas perawat
            if (r.planning) {
                const parsed = parsePlanning(r.planning);
                s.monthly[m].lab += (parsed.labs || []).length;
                s.monthly[m].rad += (parsed.rads || []).length;
                s.monthly[m].tm += (parsed.tms || []).length;
            }
        });

        // 3. Hitung jumlah beban pasien per dokter spesialis di bangsal aktif
        const hariIniStats = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

        wardActiveRecords.forEach(rec => {
            s.dpjpCounts[rec.dpjpName] = (s.dpjpCounts[rec.dpjpName] || 0) + 1;

            [rec.raberName, rec.raber2Name].forEach(dr => {
                if (dr) {
                    if (!s.raberData[dr]) s.raberData[dr] = [];
                    if (!s.raberData[dr].includes(rec.name)) s.raberData[dr].push(rec.name);
                }
            });

            const gabunganTeksSOAP = `${rec.diagnosis || ''} ${rec.analysis || ''} ${rec.planning || ''}`.toLowerCase();

            // 🛑 Pengecualian agar dr. Edi tidak terseret ke pasien Suspek / Menolak HD
            const statusProvisional = gabunganTeksSOAP.includes('dd ckd') || gabunganTeksSOAP.includes('susp ckd') || gabunganTeksSOAP.includes('susp. ckd') || gabunganTeksSOAP.includes('dd hd') || gabunganTeksSOAP.includes('aki dd');
            const statusMenolak = gabunganTeksSOAP.includes('menolak') || gabunganTeksSOAP.includes('tolak') || gabunganTeksSOAP.includes('tidak mau') || gabunganTeksSOAP.includes('belum bersedia');

            // Hanya eksekusi perhitungan jika benar-benar pasien HD murni/rutin
            const isHD = /hd|ckd|hemodialisa/i.test(gabunganTeksSOAP) && !statusProvisional && !statusMenolak;

            if (isHD) {
                let isJadwalHariIni = false;
                if (gabunganTeksSOAP.includes('senin-kamis') || gabunganTeksSOAP.includes('senin kamis')) {
                    isJadwalHariIni = ['senin', 'kamis'].includes(hariIniStats);
                } else if (gabunganTeksSOAP.includes('selasa-jumat') || gabunganTeksSOAP.includes('selasa jumat')) {
                    isJadwalHariIni = ['selasa', 'jumat'].includes(hariIniStats);
                } else if (gabunganTeksSOAP.includes('rabu-sabtu') || gabunganTeksSOAP.includes('rabu sabtu')) {
                    isJadwalHariIni = ['rabu', 'sabtu'].includes(hariIniStats);
                } else {
                    isJadwalHariIni = true;
                }

                if (isJadwalHariIni) {
                    const namaDrEdi = "dr. Edi";
                    if (!s.raberData[namaDrEdi]) s.raberData[namaDrEdi] = [];
                    const hasManualEdi = [rec.raberName, rec.raber2Name].some(dr => dr && dr.toLowerCase().includes('edi'));

                    if (!hasManualEdi && !s.raberData[namaDrEdi].includes(rec.name)) {
                        s.raberData[namaDrEdi].push(rec.name);
                    }
                }
            }
        }); // 🔓 SUNTIKAN AMAN: Menutup loop wardActiveRecords dengan sempurna!

        return s;
    }, [records, activeRecords, archivedRecords, currentUser]);

    // ✨ FITUR BARU: MESIN PEMINDAI AGENDA + AUTO SORTING + RESPONSIF FILTER DASHBOARD (V11 - SUPORT PAGI INI, BLPL & TRANSFUSI DARAH)
    const agendaHariIni = useMemo(() => {
        const agendas = [];
        const today = new Date();

        const namaHariIni = today.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
        const d = today.getDate();
        const m = today.getMonth() + 1;
        const y2 = today.getFullYear().toString().slice(-2);
        const y4 = today.getFullYear();

        const tglVariasi = [
            `${d}/${m}`, `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
            `${d}/${m}/${y2}`, `${d}/${m}/${y4}`
        ];

        // ⚡ FIX KUNCI UTAMA: Menggunakan filteredActiveRecords agar sinkron dengan filter dashboard atas!
        filteredActiveRecords.forEach(rec => {
            if (!rec.planning) return;

            // 1. Ekstrak data planning lengkap (termasuk rxs untuk Terapi / Transfusi)
            const { labs, rads, tms, rxs, others } = parsePlanning(rec.planning);
            const blplItems = (others || []).filter(line => /\b(blpl|rblpl|pulang|boleh pulang|rencana blpl)\b/i.test(line));
            const trnfsItems = [...(rxs || []), ...(others || [])].filter(line => /trnfs|transfusi|prc|wb|tc|ffp/i.test(line));
            
            // Gabungkan seluruh tindakan, penunjang, rencana pulang, dan transfusi
            const allActions = [...labs, ...rads, ...tms, ...blplItems, ...trnfsItems];

            const lastUpdate = rec.updatedAt?.toDate ? rec.updatedAt.toDate() : (rec.updatedAt ? new Date(rec.updatedAt) : new Date());
            const isUpdatedToday = lastUpdate.getDate() === today.getDate() && lastUpdate.getMonth() === today.getMonth();

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const isUpdatedYesterday = lastUpdate.getDate() === yesterday.getDate() && lastUpdate.getMonth() === yesterday.getMonth();

            allActions.forEach(action => {
                const lowerAction = action.toLowerCase();
                let isTargetToday = false;

                // Radar Transfusi: Transfusi aktif otomatis masuk agenda hari ini jika tidak bertanggal besok/lusa
                if (trnfsItems.includes(action)) {
                    const isFuture = /\b(besok|bsk|lusa)\b/i.test(lowerAction) && isUpdatedToday;
                    if (!isFuture) isTargetToday = true;
                }

                // Radar A: Deteksi Hari & Tanggal Angka murni
                if (lowerAction.includes(namaHariIni)) isTargetToday = true;
                if (tglVariasi.some(tgl => lowerAction.includes(tgl))) isTargetToday = true;

                // Radar B: Deteksi Pagi/Siang/Sore/Malam dinas berjalan
                if (isUpdatedToday && (lowerAction.includes('pagi') || lowerAction.includes('siang') || lowerAction.includes('sore') || lowerAction.includes('malam') || lowerAction.includes('nanti'))) {
                    isTargetToday = true;
                }

                // Radar C: Deteksi kata "Besok" yang ditulis kemarin (Mundur 1 hari)
                if (isUpdatedYesterday && (lowerAction.includes('besok') || lowerAction.includes('bsk'))) {
                    isTargetToday = true;
                }

                // Radar D: Deteksi kata kustom manual dari Smart Planning / Tag
                if (lowerAction.includes('sekarang') || lowerAction.includes('hari ini') || lowerAction.includes('pagi ini') || lowerAction.includes('sore ini') || lowerAction.includes('nanti malam')) {
                    isTargetToday = true;
                }

                if (isTargetToday) {
                    let icon = '📋';
                    if (rads.includes(action)) icon = '🩻';
                    else if (labs.includes(action)) icon = '🩸';
                    else if (tms.includes(action)) icon = '💉';
                    else if (trnfsItems.includes(action)) icon = '🩸';
                    else if (blplItems.includes(action) || lowerAction.includes('blpl') || lowerAction.includes('pulang')) icon = '🎉';

                    let cleanedAction = action;
                    const todayRegex = new RegExp(`\\[[^\\]]*(${tglVariasi.join('|')}|sekarang|hari ini|pagi ini|sore ini|nanti malam)[^\\]]*\\]`, 'gi');

                    if (todayRegex.test(cleanedAction)) {
                        cleanedAction = cleanedAction.replace(todayRegex, '[Hari Ini]');
                    } else if (lowerAction.includes('besok') || lowerAction.includes('sekarang') || lowerAction.includes('hari ini') || lowerAction.includes('pagi ini')) {
                        cleanedAction = cleanedAction.replace(/\b(besok|bsk|sekarang|hari ini|pagi ini|sore ini|nanti malam)\b/gi, '[Hari Ini]');
                    }

                    // ✨ SENSOR PINTAR: Cek apakah agenda ini sudah ada di dalam array TTD
                    const verifiedData = (rec.verifiedAgendas || []).find(v => v.action === cleanedAction);

                    agendas.push({
                        id: rec.id,
                        room: rec.roomNumber || '',
                        name: rec.name,
                        dpjp: rec.dpjpName,
                        action: cleanedAction,
                        icon: icon,
                        isVerified: !!verifiedData, // True jika ketemu
                        verifiedData: verifiedData || null // Simpan isi gambarnya
                    });
                }
            });
        });

        // =====================================================================
        // ⚡ ENGINE PENGURUT KAMAR ALAMI (Urut dari K1, K2... K15 secara tertib)
        // =====================================================================
        agendas.sort((a, b) => {
            const numA = parseInt((a.room.match(/\d+/)?.[0] || '999'), 10);
            const numB = parseInt((b.room.match(/\d+/)?.[0] || '999'), 10);

            if (numA !== numB) return numA - numB;
            return a.room.localeCompare(b.room);
        });

        return agendas;
    }, [filteredActiveRecords]); // ⚡ DEPENDENCY UTAMA DIKUNCI KE DATA FILTERED

    // 🔍 SENSOR RADAR: SIKLUS LACAK HASIL DARI KOLOM O (OBJEKTIF)
    const lacakHariIni = useMemo(() => {
        const list = [];

        filteredActiveRecords.forEach(rec => {
            if (!rec.objective) return;

            const lines = rec.objective.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                const lower = trimmed.toLowerCase();
                // Deteksi baris yang memuat instruksi Lacak / Lapor / Simbol ⚠️
                if (lower.startsWith('lacak') || lower.startsWith('⚠️') || lower.includes('lacak/lapor') || lower.includes('lacak:')) {
                    const cleanText = trimmed
                        .replace(/^⚠️\s*/, '')
                        .replace(/^lacak\/lapor:\s*/i, '')
                        .replace(/^lacak:\s*/i, '')
                        .trim();

                    // Tentukan ikon berdasarkan nama pemeriksaan
                    let icon = '🔍';
                    if (/lab|darah|tubex|urin|gds|urcr|elek|elektrolit|lipid|sgot|sgpt|tcm/i.test(lower)) icon = '🧪';
                    else if (/rad|rontgen|thorax|usg|ct scan|bno|foto/i.test(lower)) icon = '🩻';
                    else if (/trnfs|transfusi|prc|darah|wb|tc/i.test(lower)) icon = '🩸';

                    list.push({
                        id: rec.id,
                        room: rec.roomNumber || '',
                        name: rec.name,
                        dpjp: rec.dpjpName,
                        action: cleanText,
                        icon: icon,
                        record: rec
                    });
                }
            });
        });

        // Urutkan berdasarkan nomor kamar
        list.sort((a, b) => {
            const numA = parseInt((a.room.match(/\d+/)?.[0] || '999'), 10);
            const numB = parseInt((b.room.match(/\d+/)?.[0] || '999'), 10);
            if (numA !== numB) return numA - numB;
            return a.room.localeCompare(b.room);
        });

        return list;
    }, [filteredActiveRecords]);

    // --- RENDER DASHBOARD ---
    const renderDashboard = () => (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">

            {/* KOLOM KIRI (DENAH KAMAR & FILTER) */}
            <div className="lg:col-span-6 flex flex-col h-[calc(100vh-120px)]">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
                    <div className="flex flex-col gap-2 px-3 py-2 border-b bg-gray-50 flex-shrink-0">

                        {/* HEADER JUDUL & FILTER (SUDAH DIPERBAIKI UNTUK HP) */}
                        <div className="flex justify-between items-center flex-wrap gap-y-2">

                            <div className="flex items-center gap-2">
                                <span className="text-lg">🗺️</span>
                                <div>
                                    <h3 className="text-xs font-bold text-indigo-900 uppercase">Kamar</h3>
                                    <p className="text-[9px] text-gray-500">
                                        {dpjpFilter.length > 0 || selectedRoomFilter.length !== currentWardConfig.roomList.length || searchTerm ? 'Filter Aktif' : 'Semua'}
                                    </p>
                                </div>
                            </div>

                            {/* BARIS FILTER: Cari Nama/RM -> Semua DPJP -> Semua Kamar */}
                            <div className="flex flex-row gap-1.5 items-center w-full md:w-auto flex-1 md:ml-2">

                                {/* 1. Search Bar (Nama / RM) */}
                                <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-2 text-gray-400 text-[10px]">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Cari Nama/RM..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-6 py-1.5 border border-indigo-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-500 h-[32px] outline-none"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2 top-2 text-gray-400 hover:text-red-500 font-bold text-xs"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* 2. Filter DPJP Multi-Select */}
                                <div className="w-[100px] md:w-48 relative z-[50]">
                                    <DpjpFilterDropdown allOptions={dpjpOptions} selectedOptions={dpjpFilter} onChange={setDpjpFilter} />
                                </div>

                                {/* 3. Filter Kamar */}
                                <div className="w-[85px] md:w-40 relative z-[55]">
                                    <RoomFilterDropdown allRooms={currentWardConfig.roomList} selectedRooms={selectedRoomFilter} onChange={setSelectedRoomFilter} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 bg-gray-50/50">
                        <RoomMap
                            roomList={currentWardConfig.roomList}
                            leftRooms={currentWardConfig.leftRooms}
                            rightRooms={currentWardConfig.rightRooms}
                            activeRecords={filteredActiveRecords}
                            onSelectRoom={handleSelectRoom}
                            onEditRoom={handleEditRoom}
                            roomFilter={selectedRoomFilter}
                            waitingList={waitingList}

                            // ✨ KABEL TUKAR BED DITANCAPKAN DI SINI:
                            onSwapBed={(rec) => { setPatientToSwap(rec); setShowSwapModal(true); }}
                        />
                    </div>
                </div>
            </div>
            {/* === SISI KANAN: DYNAMIC PANEL (SOAP vs STATS) === */}
            <div className="lg:col-span-6 h-[calc(100vh-140px)] flex flex-col">

                {/* 1. TOMBOL SAKLAR */}
                <div className="flex bg-white p-1 rounded-lg border border-indigo-200 mb-3 shrink-0 shadow-sm">

                    {/* 📝 TAB 1: E-ONTANG ANTING (KOMPAK TRIPLE-SECTION) */}
                    <div
                        onClick={() => setRightDashboardTab('soap-apo')}
                        className={`flex-1 flex items-center justify-between px-2 rounded-md transition cursor-pointer select-none ${rightDashboardTab === 'soap-apo' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                    >
                        {/* SISI KIRI: Micro Toggle Mode (Locker e.stopPropagation agar tidak bentrok klik tab) */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className={`text-[8px] font-black tracking-tighter ${rightDashboardTab === 'soap-apo' ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {soapMode === 'personal' ? '🙋 Pribadi' : '🏥 Ruangan'}
                            </span>
                            <button
                                onClick={() => setSoapMode(m => m === 'personal' ? 'ruangan' : 'personal')}
                                className={`relative inline-flex h-3.5 w-6 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${soapMode === 'ruangan' ? 'bg-emerald-400' : 'bg-slate-300'
                                    }`}
                                role="switch"
                                aria-checked={soapMode === 'ruangan'}
                            >
                                <span className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${soapMode === 'ruangan' ? 'translate-x-2.5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* SISI TENGAH: Judul Tab Utama */}
                        <span className="text-xs font-black text-center flex-1 py-1.5">
                            📝 E-Ontang-Anting
                        </span>

                        {/* SISI KANAN: Tombol Cetak Sel (Diberi width pengunci agar judul tengah tetap presisi simetris) */}
                        <div className="w-14 flex justify-end" onClick={(e) => e.stopPropagation()}>
                            {rightDashboardTab === 'soap-apo' && (
                                <button
                                    onClick={() => setShowBulkPrint(true)}
                                    className="no-print bg-white text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm flex items-center gap-0.5 transition animate-in fade-in zoom-in-95 duration-150"
                                    title="Cetak Seluruh Kartu E-Ontang-Anting"
                                >
                                    🖨️ Cetak
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 📊 TAB 2: STATISTIK */}
                    <button
                        onClick={() => setRightDashboardTab('stats')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 ${rightDashboardTab === 'stats' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    >
                        <span>📊 Antrean & Statistik</span>
                        {waitingList && waitingList.length > 0 && (
                            <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px] animate-pulse">{waitingList.length}</span>
                        )}
                    </button>
                </div>

                {/* 2. AREA KONTEN BAWAH */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar pb-10">

                    {rightDashboardTab === 'soap-apo' ? (

                        /* --- SUB-TAB 1: LIVE SOAP (APO) MINI PRINT PREVIEW STYLE --- */
                        <div className="space-y-3">

                            {/* ========================================================= */}
                            {/* 🔔 PAPAN PANTAUAN DINAS (SAKLAR GESER: RENCANA vs LACAK)   */}
                            {/* ========================================================= */}
                            {(agendaHariIni.length > 0 || lacakHariIni.length > 0) && (
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                                    
                                    {/* HEADER: JUDUL + SAKLAR GESER TAB */}
                                    <div className="flex justify-between items-center border-b border-amber-200/80 pb-2 mb-2 flex-wrap gap-2">
                                        
                                        {/* SISI KIRI: SAKLAR GESER DUA MODE */}
                                        <div className="flex items-center bg-amber-200/60 p-0.5 rounded-lg border border-amber-300 shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setAgendaSubTab('rencana')}
                                                className={`px-2.5 py-1 rounded-md text-[10px] font-black transition flex items-center gap-1.5 ${
                                                    agendaSubTab === 'rencana'
                                                        ? 'bg-amber-600 text-white shadow-sm'
                                                        : 'text-amber-900 hover:bg-amber-100/70'
                                                }`}
                                            >
                                                <span className="inline-block animate-bounce text-xs">🔔</span>
                                                <span>AGENDA HARI INI</span>
                                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${agendaSubTab === 'rencana' ? 'bg-amber-800 text-white' : 'bg-amber-300 text-amber-900'}`}>
                                                    {agendaHariIni.length}
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setAgendaSubTab('lacak')}
                                                className={`px-2.5 py-1 rounded-md text-[10px] font-black transition flex items-center gap-1.5 ${
                                                    agendaSubTab === 'lacak'
                                                        ? 'bg-orange-600 text-white shadow-sm'
                                                        : 'text-orange-950 hover:bg-orange-100/70'
                                                }`}
                                            >
                                                <span className="inline-block text-xs">🔍</span>
                                                <span>Lacak Hasil</span>
                                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${agendaSubTab === 'lacak' ? 'bg-orange-800 text-white' : 'bg-orange-300 text-orange-950'}`}>
                                                    {lacakHariIni.length}
                                                </span>
                                            </button>
                                        </div>

                                        {/* SISI KANAN: TOMBOL SERAH TERIMA MASAL (Hanya muncul saat tab Rencana & ada sampel belum TTD) */}
                                        {agendaSubTab === 'rencana' && agendaHariIni.some(a => !a.isVerified) && (
                                            <button 
                                                onClick={() => setIsBulkHandoverOpen(true)}
                                                className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg text-[9px] font-black shadow-sm transition animate-in zoom-in-95 flex items-center gap-1"
                                            >
                                                🧫 Serah Terima Masal
                                            </button>
                                        )}
                                    </div>

                                    {/* KONTEN TAB 1: RENCANA AKSI (PLANNING) */}
                                    {agendaSubTab === 'rencana' && (
                                        <div className="space-y-1.5 animate-in fade-in duration-200">
                                            {agendaHariIni.length === 0 ? (
                                                <div className="text-center py-3 text-amber-700/70 text-[10px] italic font-medium bg-white/50 rounded-lg border border-amber-200">
                                                    ✨ Tidak ada rencana tindakan/pemeriksaan tersisa hari ini.
                                                </div>
                                            ) : (
                                                agendaHariIni.map((agenda, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border shadow-sm transition ${agenda.isVerified ? 'bg-emerald-50/90 border-emerald-300' : 'bg-white border-amber-200 hover:bg-amber-100/60 cursor-pointer'}`} 
                                                        onClick={() => !agenda.isVerified && handleEdit(activeRecords.find(r => r.id === agenda.id))}
                                                    >
                                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                                            <span className="text-sm shrink-0 leading-none pt-0.5">{agenda.isVerified ? '✅' : agenda.icon}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-[11px] font-bold leading-tight ${agenda.isVerified ? 'text-emerald-800 line-through opacity-70' : 'text-slate-800'}`}>
                                                                    {agenda.action}
                                                                </div>
                                                                <div className={`text-[9px] font-medium mt-0.5 ${agenda.isVerified ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                                    {agenda.room ? agenda.room.replace(/^(K\d+)(KM|P)$/, '$1•$2') : ''} a.n <span className={`font-bold ${agenda.isVerified ? 'text-emerald-700' : 'text-amber-700'}`}>{agenda.name}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* TOMBOL AKSI SERAH TERIMA */}
                                                        <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                                            {!agenda.isVerified ? (
                                                                <button 
                                                                    onClick={() => setHandoverConfig({ isOpen: true, agenda, viewModeData: null })} 
                                                                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded text-[9px] font-black border border-amber-300 shadow-sm transition animate-pulse"
                                                                >
                                                                    ✍️ TTD Bukti
                                                                </button>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => setHandoverConfig({ isOpen: true, agenda, viewModeData: agenda.verifiedData })} 
                                                                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2 py-1 rounded text-[9px] font-black border border-emerald-300 shadow-sm transition"
                                                                >
                                                                    👁️ Lihat TTD
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* KONTEN TAB 2: LACAK HASIL (OBJEKTIF) */}
                                    {agendaSubTab === 'lacak' && (
                                        <div className="space-y-1.5 animate-in fade-in duration-200">
                                            {lacakHariIni.length === 0 ? (
                                                <div className="text-center py-4 text-orange-800/70 text-[10px] italic font-medium bg-white/50 rounded-lg border border-orange-200">
                                                    🎉 Semua hasil pemeriksaan laboratorium & radiologi sudah selesai diinput!
                                                </div>
                                            ) : (
                                                lacakHariIni.map((lacak, i) => (
                                                    <div 
                                                        key={i} 
                                                        onClick={() => handleEdit(lacak.record)}
                                                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-orange-200 bg-white hover:bg-orange-50/80 cursor-pointer shadow-sm transition group"
                                                        title="Klik untuk buka SOAP dan input hasil lab/rad"
                                                    >
                                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                                            <span className="text-sm shrink-0 leading-none pt-0.5 animate-pulse">{lacak.icon}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[11px] font-bold text-orange-950 leading-tight flex items-center gap-1.5">
                                                                    <span>{lacak.action}</span>
                                                                    <span className="bg-orange-100 text-orange-700 border border-orange-200 px-1 py-0.2 rounded text-[8px] font-mono font-bold">
                                                                        MENUNGGU HASIL
                                                                    </span>
                                                                </div>
                                                                <div className="text-[9px] text-slate-500 font-medium mt-0.5">
                                                                    {lacak.room ? lacak.room.replace(/^(K\d+)(KM|P)$/, '$1•$2') : ''} a.n <span className="font-bold text-orange-800">{lacak.name}</span> <span className="text-slate-400">({lacak.dpjp})</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* TOMBOL INPUT HASIL */}
                                                        <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                                            <button 
                                                                onClick={() => handleEdit(lacak.record)}
                                                                className="bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded text-[9px] font-black shadow-sm transition flex items-center gap-1"
                                                            >
                                                                ✏️ Input Hasil
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                </div>
                            )}
                            {/* ========================================================= */}
                            {filteredActiveRecords.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 italic text-xs bg-white rounded-lg border">Tidak ada pasien aktif untuk ditampilkan.</div>
                            ) : (
                                filteredActiveRecords.map(rec => {
                                    // Bersihkan spasi kosong karpet merah/sisa input teks (Ditambah toleransi ikon jam)
                                    const stripAuthorTags = (text) => (text || '').replace(/(?:🕒\s*)?\[[^\]]+,\s*[\d\/]+\s+[\d:]+\]\s*/g, '').trim();

                                    // ✨ LOGIKA BARU: Cek apakah isinya benar-benar kosong (hanya tersisa stempel)
                                    const isActuallyEmpty = (text) => stripAuthorTags(text) === '' || stripAuthorTags(text) === '-';

                                    // ✨ MODE SOAP: Tentukan sumber data berdasarkan soapMode
                                    const personalNotes = rec.personalNotes?.[currentUser?.name] || {};
                                    const rawSubj = soapMode === 'personal' ? (personalNotes.subjective || '') : (rec.subjective || '');
                                    const rawObj = soapMode === 'personal' ? (personalNotes.objective || '') : (rec.objective || '');
                                    const rawAna = soapMode === 'personal' ? (personalNotes.analysis || '') : (rec.analysis || '');
                                    // ✨ FIX CARD: Gabungkan draf planning dengan resep utama agar badge obat muncul di layar depan
                                    const rRx = rec.currentPrescription || '';
                                    const rawPlan = soapMode === 'personal'
                                        ? `${personalNotes.planning || ''}\n${rRx}`
                                        : `${rec.planning || ''}\n${rRx}`;

                                    // ✨ PERBAIKAN: Gunakan stripAuthorTags agar SEMUA stempel terhapus dari tampilan E-Ontang-Anting
                                    const safeSubjective = isActuallyEmpty(rawSubj) ? '' : stripAuthorTags(rawSubj);
                                    const safeObjective = isActuallyEmpty(rawObj) ? '' : stripAuthorTags(rawObj);
                                    const safePlanning = isActuallyEmpty(rawPlan) ? '' : stripAuthorTags(rawPlan);

                                    // Analisa tetap kita paksa bersih tanpa stempel (sesuai desain aslimu)
                                    const safeAnalysis = stripAuthorTags(rawAna);

                                    const hasSubjective = safeSubjective && safeSubjective !== '-' && safeSubjective !== '';

                                    return (
                                        <div
                                            key={rec.id}
                                            onClick={() => handleEdit(rec)}
                                            className="bg-white rounded-xl border border-slate-300 shadow-sm p-4 hover:border-indigo-500 hover:shadow-md transition cursor-pointer group text-xs text-black font-sans relative"
                                            title="Klik untuk Edit SOAP Pasien"
                                        >
                                            {/* Header Atas Kartu Ala Lembar Cetak */}
                                            <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                                                        <span className="text-[10px] font-black border-2 border-black px-1.5 py-0.5 bg-slate-50 text-black">
                                                            {rec.roomNumber ? rec.roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2') : ''}
                                                        </span>
                                                        <span className="truncate group-hover:text-indigo-600 transition-colors">{rec.name}</span>
                                                    </div>
                                                    <div className="text-[13px] mt-0.5 flex flex-wrap gap-x-3 font-semibold text-slate-700 items-center">
                                                        {/* ✨ FIX CETAK: Tulisan dibuat tebal pekat (text-black font-black) dan ukurannya diperbesar (text-[14px]) tanpa caps lock */}
                                                        <span className="text-black font-black bg-slate-100/80 px-1 rounded border border-slate-300 text-[13px]">
                                                            DPJP: <span className="text-indigo-950 font-black">{rec.dpjpName}</span>
                                                        </span>

                                                        {(rec.raberName || rec.raber2Name) && (
                                                            <span className="text-slate-500 italic font-medium">
                                                                Rb: {[rec.raberName, rec.raber2Name].filter(Boolean).join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Sisi Kanan Header: Tanggal & Inisial Dinas Ns */}
                                                <div className="text-right flex flex-col items-end justify-start font-bold text-[10px] text-slate-800 shrink-0">

                                                    {/* ✨ BOX BARU: Deretan Tombol Mandor (Lapor, Tukar, Cetak, Keluar) berdampingan */}
                                                    <div className="flex flex-row gap-1.5 mb-1.5 items-center flex-wrap">
                                                        {/* 1. TOMBOL TUKAR BED */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Mencegah layar form edit SOAP terbuka otomatis
                                                                setPatientToSwap(rec); // Memakai variabel 'rec' yang valid di baris ini[cite: 2]
                                                                setShowSwapModal(true); // Langsung nyalakan modal penukar bed[cite: 2]
                                                            }}
                                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                                                            title="Tukar / Pindah Bed Pasien"
                                                        >
                                                            🔀 Tukar
                                                        </button>
                                                        {/* 2. TOMBOL LAPOR/KONSUL */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Mencegah layar form edit SOAP terbuka otomatis
                                                                setRecordForLapor(rec); // 🚀 Picu modal pilihan lapor WA spesifik pasien
                                                            }}
                                                            className="bg-green-50 hover:bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                                                            title="Lapor / Konsul Pasien ke WA"
                                                        >
                                                            📱 Lapor
                                                        </button>

                                                        {/* 3. TOMBOL CETAK APOS */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Mencegah layar Edit SOAP terbuka tak sengaja[cite: 2]
                                                                setSelectedRecordForPrint(rec); // 🚀 Memanggil Modal Print APOS bawaan SIMPAN![cite: 2]
                                                            }}
                                                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 shadow-sm transition flex items-center gap-1 text-[10px] font-bold"
                                                            title="Buka Preview Cetak APOS"
                                                        >
                                                            🖨️ Cetak
                                                        </button>

                                                        {/* 4. 🔥 TOMBOL KELUAR/DISCHARGE CEPAT (BARU) */}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Biar gak buka form SOAP pas diklik[cite: 2]
                                                                handleDischarge(rec.id, rec.name, rec.roomNumber); // 🚀 Picu modal kategori KRS/Pindah Ruangan/Meninggal[cite: 2]
                                                            }}
                                                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm transition"
                                                            title="Pulangkan / Pindahkan Pasien (KRS)"
                                                        >
                                                            🚪 KRS
                                                        </button>

                                                        {/* TOMBOL PUBLIKASIKAN */}
                                                        {soapMode === 'personal' && rec.personalNotes?.[currentUser?.name] && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handlePublishToRoom(rec);
                                                                }}
                                                                className="bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded border border-amber-300 shadow-sm transition flex items-center gap-1"
                                                                title="Publikasikan catatan pribadimu ke Mode Ruangan (gabungan)"
                                                            >
                                                                📤 Publis
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Detail Tanggal & Kontributor tetap rapi di bawah tombol */}
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

                                            {/* Grid 2 Kolom Presisi Komponen APOS */}
                                            <div className="grid grid-cols-2 gap-3 pt-0.5 items-stretch">

                                                {/* Kolom Kiri: A (Analisa) & P (Planning) */}
                                                <div className="border-r border-slate-200 pr-2 flex flex-col justify-between gap-2">
                                                    <div>
                                                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">A (ANALISA)/ Dx:</div>
                                                        <div className="whitespace-pre-wrap pl-1 text-slate-800 leading-tight text-[11px] font-medium">{safeAnalysis || '-'}</div>
                                                    </div>

                                                    <div className="border-t border-dashed border-slate-300 pt-1.5">
                                                        <div className="font-bold underline mb-1 bg-slate-100 inline-block px-1 text-[9px] border border-slate-200 rounded text-slate-700">P (PLANNING)</div>
                                                        {/* ✨ FIX: Menggunakan render lokal agar Terapi & Tindakan ter-enter sempurna */}
                                                        <div className="pl-1">
                                                            {safePlanning ? renderPlanningCell(autoSmartDateTransformer(safePlanning), rec?.medicationLogs) : <span className="text-slate-800 text-[11px] font-medium">-</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Kolom Kanan: O (Objektif) & S (Subektif) */}
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

                                            {/* ✨ TAB ROW: Lab | Rontgen | USG | CT | EKG | Luka */}
                                            {(() => {
                                                // Lab data setup
                                                const labHistory = rec.labHistory;
                                                const hasHistory = labHistory && labHistory.length > 0;
                                                const fallbackValues = hasHistory ? null : (() => {
                                                    const vals = {};
                                                    Object.keys(LAB_PATTERNS).forEach(key => {
                                                        if (key === 'Gram/Sputum') return;
                                                        const match = safeObjective.match(LAB_PATTERNS[key]);
                                                        if (match && match[1]) vals[key] = match[1].trim().replace(',', '.');
                                                    });
                                                    return Object.keys(vals).length > 0 ? vals : null;
                                                })();
                                                const allKeys = hasHistory
                                                    ? [...new Set(labHistory.flatMap(e => Object.keys(e.values || {})))]
                                                    : (fallbackValues ? Object.keys(fallbackValues) : []);
                                                const dateColumns = hasHistory ? labHistory.map(e => e.date) : ['Terkini'];

                                                return (
                                                    <div className="mt-2 pt-2 border-t-2 border-slate-300">
                                                        {/* Tab Buttons */}
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {/* Lab Tab */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === 'Lab' ? null : rec.id); setExpandedCardTab('Lab'); }}
                                                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === 'Lab'
                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                                                    }`}
                                                            >
                                                                📊 Lab
                                                                {allKeys.length > 0 && (
                                                                    <span className={`px-1 rounded-full text-[8px] ${expandedCardId === rec.id && expandedCardTab === 'Lab' ? 'bg-white/30' : 'bg-blue-200'}`}>
                                                                        {allKeys.length}
                                                                    </span>
                                                                )}
                                                            </button>

                                                            {/* 🔥 TAMBAHKAN TOMBOL TTV INI DI SINI: */}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === 'TTV' ? null : rec.id); setExpandedCardTab('TTV'); }}
                                                                className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === 'TTV'
                                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                                    }`}
                                                            >
                                                                📈 TTV & EWS
                                                            </button>

                                                            {/* Radiology Tabs */}
                                                            {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka'].map(cat => {
                                                                const count = (rec.radiologyImages || []).filter(img => img.category === cat).length;
                                                                const icons = { 'Rontgen': '🩻', 'USG': '🔊', 'CT Scan': '💉', 'EKG': '❤️', 'Luka': '🩹' };
                                                                return (
                                                                    <button
                                                                        key={cat}
                                                                        onClick={(e) => { e.stopPropagation(); setExpandedCardId(expandedCardId === rec.id && expandedCardTab === cat ? null : rec.id); setExpandedCardTab(cat); }}
                                                                        className={`px-2 py-0.5 rounded text-[9px] font-bold transition flex items-center gap-1 ${expandedCardId === rec.id && expandedCardTab === cat
                                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                                                            }`}
                                                                    >
                                                                        {icons[cat]} {cat}
                                                                        {count > 0 && (
                                                                            <span className={`px-1 rounded-full text-[8px] ${expandedCardId === rec.id && expandedCardTab === cat ? 'bg-white/30' : 'bg-indigo-200'}`}>
                                                                                {count}
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Tab Content */}
                                                        {expandedCardId === rec.id && (
                                                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                                {/* ✨ VERSI MODULAR: Memanggil komponen luar dengan visual aslinya */}
                                                                {expandedCardTab === 'Lab' && (
                                                                    <LabHistoryTable record={rec} />
                                                                )}

                                                                {/* 🔥 TAMBAHKAN LOGIKA TAMPIL TTV INI DI SINI: */}
                                                                {expandedCardTab === 'TTV' && (
                                                                    <TtvHistory objective={rec.objective} />
                                                                )}

                                                                {/* RADIOLOGY CONTENT */}
                                                                {['Rontgen', 'USG', 'CT Scan', 'EKG', 'Luka'].includes(expandedCardTab) && (
                                                                    <div className="cursor-default mt-2"> {/* ✨ FIX: Hapus e.stopPropagation() di sini agar kotak putih tetap memicu Form SOAP saat diklik */}

                                                                        {/* ✨ MESIN RADAR: AUTO-DETECT EKSPERTISE DARI (O) OBJEKTIF */}
                                                                        {(() => {
                                                                            const getRadExpertiseFromO = (objective, category) => {
                                                                                if (!objective) return null;
                                                                                // Regex super cerdas: Menyedot teks berdasarkan kategori, dan berhenti otomatis jika bertemu kata USG, CT Scan, Lab, atau TTV
                                                                                const regexMap = {
                                                                                    'Rontgen': /(?:Hasil\s*|Kesan\s*)?(?:Rontgen|Ro\s*Thorax|Thorax|BNO|Foto)(?:\s*Thorax|\s*Polos)?[\s:-]*([^\n]+(?:\n(?!(?:USG|CT Scan|EKG|Lab|TD|Nadi|Suhu|RR|SpO2|S:|A:|P:)).+)*)/i,
                                                                                    'USG': /(?:Hasil\s*|Kesan\s*)?(?:USG|Ultrasonografi)[\s:-]*([^\n]+(?:\n(?!(?:Rontgen|CT Scan|EKG|Lab|TD|Nadi|Suhu|RR|SpO2|S:|A:|P:)).+)*)/i,
                                                                                    'CT Scan': /(?:Hasil\s*|Kesan\s*)?(?:CT Scan|CT-Scan|MSCT)[\s:-]*([^\n]+(?:\n(?!(?:Rontgen|USG|EKG|Lab|TD|Nadi|Suhu|RR|SpO2|S:|A:|P:)).+)*)/i,
                                                                                };
                                                                                if (!regexMap[category]) return null;
                                                                                const match = objective.match(regexMap[category]);
                                                                                if (match && match[1]) {
                                                                                    // Bersihkan stempel waktu/nama perawat jika ada
                                                                                    const cleanMatch = match[1].replace(/(?:🕒\s*)?\[[^\]]+\]\s*/g, '').trim();
                                                                                    return cleanMatch.length > 3 ? cleanMatch : null;
                                                                                }
                                                                                return null;
                                                                            };

                                                                            const extractedText = getRadExpertiseFromO(rec.objective, expandedCardTab);
                                                                            if (extractedText) {
                                                                                return (
                                                                                    <div className="mb-2 bg-indigo-50 border border-indigo-200 p-2 rounded-lg shadow-sm">
                                                                                        <div className="text-[9px] font-black text-indigo-800 uppercase mb-1 flex items-center gap-1">
                                                                                            🤖 Auto-Deteksi Ekspertise dari (O):
                                                                                        </div>
                                                                                        <div className="text-[10px] text-slate-700 font-medium whitespace-pre-wrap leading-snug">
                                                                                            {extractedText}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}

                                                                        {/* GALLERY GAMBAR & CATATAN MANUAL */}
                                                                        {(rec.radiologyImages || []).filter(img => img.category === expandedCardTab).length > 0 ? (
                                                                            <div className="flex flex-col gap-2">
                                                                                {(rec.radiologyImages || []).filter(img => img.category === expandedCardTab).map((img, idx) => {
                                                                                    const hasExpertiseText = ['Rontgen', 'USG', 'CT Scan'].includes(expandedCardTab);

                                                                                    return (
                                                                                        <div key={img.id || idx} className="flex gap-2.5 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm group hover:border-indigo-400 transition-colors">
                                                                                            {/* KIRI: Foto Thumbnail */}
                                                                                            <div className="relative shrink-0" onClick={(e) => e.stopPropagation() /* ✨ LINDUNGI KLIK GAMBAR */}>
                                                                                                <img
                                                                                                    src={img.imageUrl}
                                                                                                    alt={`${img.category} ${idx + 1}`}
                                                                                                    className="w-16 h-16 object-cover rounded-lg border border-slate-300 cursor-pointer hover:border-indigo-500 hover:scale-105 transition-all shadow-sm"
                                                                                                    onClick={() => window.open(img.imageUrl, '_blank')}
                                                                                                    title={`${img.uploadedBy} • ${img.date} ${img.time || ''}`}
                                                                                                />
                                                                                                <div className="absolute -bottom-1 left-1 bg-white/90 text-[7px] text-gray-600 px-1 rounded shadow font-bold">
                                                                                                    {img.date}
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* KANAN: Detail & Input Kesan Tambahan */}
                                                                                            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                                                                                                <div className="text-[9px] text-slate-400 font-bold mb-1 flex justify-between">
                                                                                                    <span>{img.category} #{idx + 1}</span>
                                                                                                    <span>Oleh: {img.uploadedBy} ({img.time || ''})</span>
                                                                                                </div>

                                                                                                {hasExpertiseText ? (
                                                                                                    <textarea
                                                                                                        onClick={(e) => e.stopPropagation()} // ✨ KUNCI 1: Aman untuk diklik!
                                                                                                        onMouseDown={(e) => e.stopPropagation()} // ✨ KUNCI 2: Aman untuk nge-blok/drag teks!
                                                                                                        onKeyDown={(e) => e.stopPropagation()} // ✨ KUNCI 3: Aman dari shortcut keyboard!
                                                                                                        placeholder="Ketik catatan opsional khusus foto ini..."
                                                                                                        defaultValue={img.kesan || ''}
                                                                                                        onBlur={async (e) => {
                                                                                                            const val = e.target.value.trim();
                                                                                                            if (val === (img.kesan || '')) return;

                                                                                                            const updatedImages = (rec.radiologyImages || []).map(item =>
                                                                                                                (item.id === img.id || item.imageUrl === img.imageUrl)
                                                                                                                    ? { ...item, kesan: val }
                                                                                                                    : item
                                                                                                            );

                                                                                                            try {
                                                                                                                const safeAppId = firebaseConfig?.appId || 'SIMPAN_APP';
                                                                                                                const docRef = doc(db, `artifacts/${safeAppId}/public/data/medicalRecords`, rec.id);
                                                                                                                await updateDoc(docRef, { radiologyImages: updatedImages });
                                                                                                            } catch (err) {
                                                                                                                console.error("Gagal update kesan:", err);
                                                                                                            }
                                                                                                        }}
                                                                                                        className="w-full flex-1 text-[10px] p-1 border border-indigo-100 rounded outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium bg-indigo-50/30 focus:bg-white h-10 leading-tight custom-scrollbar shadow-inner"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="text-[10px] text-slate-400 italic pt-2">
                                                                                                        * Berkas penunjang tanpa lampiran dokumen teks.
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-center py-4 text-gray-400">
                                                                                <span className="text-2xl">🖼️</span>
                                                                                <p className="text-[10px] mt-1">Belum ada lampiran gambar {expandedCardTab}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    ) : (

                        /* --- SUB-TAB 2: STATISTIK & WAITING LIST LAMA --- */
                        <>
                            <div className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden">
                                <div className="bg-indigo-600 px-3 py-2 text-white flex justify-between items-center">
                                    <div className="flex items-center space-x-2"><span className="text-xs font-bold uppercase tracking-tight">📋 Waiting List</span><span className="bg-indigo-500 px-2 py-0.5 rounded-full text-[10px] font-mono">{waitingList.length}</span></div>
                                    <button onClick={() => setShowWaitingModal(true)} className="bg-white text-indigo-700 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-50 flex items-center"><span className="mr-1 text-sm">+</span> Tambah/Edit</button>
                                </div>
                                <div className="max-h-56 overflow-y-auto">
                                    {waitingList.length === 0 ? <div className="p-6 text-center text-gray-400 italic text-xs">Belum ada antrean.</div> : (
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="bg-gray-50 sticky top-0 border-b z-10"><tr><th className="p-2 text-center w-8">No</th><th className="p-2">Target</th><th className="p-2">Pasien</th><th className="p-2">Asal</th><th className="p-2 text-center">Aksi</th></tr></thead>
                                            <tbody>{waitingList.map((w, idx) => (
                                                <tr key={w.id} className="border-b hover:bg-indigo-50 group"><td className="p-2 text-center font-bold text-gray-400">{idx + 1}</td><td className="p-2 font-bold text-indigo-700">{w.plannedRoom}</td><td className="p-2"><div className="font-bold">{w.name}</div><div className="text-[9px] text-gray-400 truncate">{w.diagnosis}</div></td><td className="p-2"><div className="font-bold">{w.originRoom}</div>{w.insuranceClass && <div className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded w-fit">{w.insuranceClass}</div>}</td><td className="p-2 text-center"><button onClick={() => handleMoveToRoom(w)} className="bg-green-600 text-white px-2 py-1 rounded font-bold text-[9px]">Masuk</button><button onClick={() => handleDeleteWaiting(w.id)} className="ml-2 text-red-400 opacity-0 group-hover:opacity-100">🗑️</button></td></tr>
                                            ))}</tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-green-100 border border-green-300 text-green-900 rounded p-2 text-center"><span className="text-[9px] font-bold">KOSONG</span><div className="text-xl font-extrabold">{stats.emptyCount}</div></div>
                                <div className="bg-sky-100 border border-sky-300 text-sky-900 rounded p-2 text-center"><span className="text-[9px] font-bold">SISA LK</span><div className="text-xl font-extrabold">{stats.emptyMale}</div></div>
                                <div className="bg-purple-100 border border-purple-300 text-purple-900 rounded p-2 text-center"><span className="text-[9px] font-bold">SISA PR</span><div className="text-xl font-extrabold">{stats.emptyFemale}</div></div>
                            </div>
                            {/* 📊 SEKSI STATISTIK BEBAN DOKTER BERDASARKAN PRIORITAS (SINKRON 100%) */}
                            <div className="bg-white rounded p-3 border">
                                <h3 className="font-bold text-gray-700 border-b pb-2 mb-3 text-xs uppercase">Pasien per DPJP</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(stats.dpjpCounts).sort((a, b) => {
                                        // Sesuai susunan prioritas di dpjpOptions utama
                                        const priorityDocs = [
                                            "dr. Delvi, Sp.PD",
                                            "dr. Dian Ekowati, Sp.PD",
                                            "dr. Priyo, Sp.PD",
                                            "dr. Risa, Sp.PD",
                                            "dr. Evan, Sp.P"
                                        ];

                                        // a[0] dan b[0] berisi nama string dokter
                                        const idxA = priorityDocs.indexOf(a[0]);
                                        const idxB = priorityDocs.indexOf(b[0]);

                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                        if (idxA !== -1) return -1;
                                        if (idxB !== -1) return 1;
                                        return a[0].localeCompare(b[0]);
                                    }).map(([n, c]) => (
                                        <div key={n} className="flex justify-between items-center text-[10px] p-2 bg-gray-50 rounded border hover:bg-indigo-50 group">
                                            <span className="truncate font-medium">{n}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{c}</span>
                                                <button onClick={() => handleReportDpjpCount(n, c)} className="text-[9px] bg-green-100 text-green-700 p-1 rounded-full opacity-80 group-hover:opacity-100">📱</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white rounded p-3 border"><h3 className="font-bold text-gray-700 border-b pb-2 mb-2 text-xs uppercase flex justify-between"><span>🤝 Raber/Konsul</span><span className="bg-yellow-100 px-2 rounded-full">{Object.keys(stats.raberData).length} Dr</span></h3>
                                <div className="space-y-2">{Object.entries(stats.raberData).length === 0 ? <div className="text-[10px] text-gray-400 text-center">Nihil.</div> : Object.entries(stats.raberData).map(([d, p]) => (<div key={d} className="text-[10px] bg-yellow-50 p-2 rounded border flex justify-between group"><div className="flex-1"><div className="font-bold text-indigo-800">{d}</div><div className="text-gray-600">({p.join(', ')})</div></div><button onClick={() => handleReportRaber(d, p)} className="ml-2 bg-green-100 text-green-700 px-2 py-1 rounded opacity-80 group-hover:opacity-100">📱</button></div>))}</div>
                            </div>
                            <div className="bg-white rounded overflow-hidden border">
                                <div className="bg-gray-800 px-3 py-2 text-white text-xs font-bold uppercase">📊 Rekap</div>
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                                        <tr>
                                            <th className="p-2">Bulan</th><th className="p-2 text-center">Aktif</th><th className="p-2 text-center" title="Pulang Biasa">Plg</th><th className="p-2 text-center text-indigo-600" title="Pindah Ruangan">Pdh</th><th className="p-2 text-center text-slate-800" title="Meninggal">Mng</th><th className="p-2 text-center text-red-600">Lab</th><th className="p-2 text-center text-blue-600">Rad</th><th className="p-2 text-center text-green-600">TM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(stats.monthly).map(([m, d]) => (
                                            <tr key={m} className="border-b hover:bg-gray-50">
                                                <td className="p-2 font-bold text-indigo-900">{m}</td><td className="p-2 text-center">{d.active}</td><td className="p-2 text-center font-bold">{d.pulang}</td><td className="p-2 text-center font-bold text-indigo-600">{d.pindah}</td><td className="p-2 text-center font-bold text-slate-800">{d.meninggal}</td><td className="p-2 text-center font-bold text-red-600">{d.lab}</td><td className="p-2 text-center font-bold text-blue-600">{d.rad}</td><td className="p-2 text-center font-bold text-green-600">{d.tm}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800 pb-20">

            {/* ✨ FLOATING WELCOME TOAST (MENGHILANG OTOMATIS) */}
            {showWelcomeToast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[100] animate-in slide-in-from-top-5 fade-in duration-500">
                    <div className="bg-indigo-600/95 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-2xl border-2 border-indigo-400/50 flex items-center gap-3">
                        <span className="text-2xl animate-wave">👋</span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-black">Halo, {currentUser?.name.split(' ')[0]}!</span>
                            <span className="text-[10px] text-indigo-100 font-medium">Selamat datang di Ruang {currentWardConfig.name} - {currentUser?.hospital || 'RSUD Bayu Asih'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER V6 (MENU UNIVERSAL + NOTIFIKASI) */}
            <div className="bg-white shadow-sm px-4 h-14 sticky top-0 z-[80] border-b flex justify-between items-center max-w-7xl mx-auto">

                {/* 1. KIRI: LOGO (flex-none supaya ukuran paten) */}
                <div onClick={() => setView('dashboard')} className="flex items-center cursor-pointer hover:opacity-80 transition-opacity select-none py-1 flex-none">
                    <img src="/logo3.png" alt="SIMPAN Header" className="h-28 object-contain" />
                </div>

                {/* 2. TENGAH: KOSONGKAN (Diganti dengan Floating Toast di atas) */}
                <div className="flex-1"></div>

                {/* 3. KANAN: SEKERANJANG TOMBOL AKSI & MENU DROPDOWN */}
                <div className="flex items-center gap-2 flex-none">

                    <button
                        onClick={() => setShowLaporModal(true)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-indigo-200 transition shadow-sm"
                    >
                        <span className="mr-1">📢</span> Lapor
                    </button>

                    <div className={`hidden sm:block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 shadow-green-400' : 'bg-red-500'} ring-2 ring-white`} title={isOnline ? "Online" : "Offline"}></div>

                    {/* --- MENU NAVIGASI UNIVERSAL DENGAN NOTIF RED DOT --- */}
                    <div className="relative ml-2" ref={menuWrapperRef} onKeyDown={handleMenuKeyDown}>
                        <button
                            onClick={() => { setIsMainMenuOpen(!isMainMenuOpen); setMainMenuHighlight(-1); }}
                            className="relative bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm hover:bg-gray-50 transition outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <span>☰</span> MENU ▾
                            {/* ✨ RED DOT NOTIFIKASI JIKA ADA USER PENDING */}
                            {(() => {
                                const pendingCount = allUsers.filter(u => u.status === 'pending' && (currentUser.role === 'admin' || currentUser.role === 'SUPERADMIN' || (u.hospital === currentUser.hospital && u.ward === currentUser.ward))).length;
                                if (pendingCount > 0) return (
                                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-sm border border-white">
                                        {pendingCount}
                                    </span>
                                );
                                return null;
                            })()}
                        </button>

                        {isMainMenuOpen && (
                            <div className="absolute top-full right-0 pt-2 w-48 z-[90] animate-in fade-in zoom-in-95 origin-top-right">
                                <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1">

                                    {/* SEKSI TENTANG APLIKASI & LINK TRAKTEER */}
                                    <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-gray-100 mb-1 bg-indigo-50/40">
                                        <p className="font-bold text-indigo-900">SIMPAN </p>
                                        <p className="text-[9px]">Nursing System Handover </p>
                                        <a
                                            href="https://trakteer.id/481nugroho"
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`block mt-1.5 text-[10px] text-indigo-600 font-extrabold hover:underline p-1 rounded transition-colors ${mainMenuHighlight === getMenuIdx('link') ? 'bg-indigo-100 text-indigo-900 font-black' : ''}`}
                                        >
                                            ☕ Traktir Kopi?
                                        </a>
                                    </div>

                                    <div className="px-4 py-1 border-b border-gray-50 mb-1">
                                        <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded w-fit block uppercase truncate max-w-full">
                                            👤 {currentUser ? currentUser.name : 'Guest'}
                                        </span>
                                    </div>

                                    <button onClick={() => { setView('dashboard'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'dashboard') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>🏠 Dashboard</button>
                                    <button onClick={() => { setView('patient-list'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'patient-list') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>📋 Daftar Pasien</button>

                                    {/* ✨ MENU SETELAN + BADGE ANGKA NOTIFIKASI */}
                                    <button onClick={() => { setView('settings'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'settings') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>
                                        <span>⚙️ Setelan</span>
                                        {(() => {
                                            const pendingCount = allUsers.filter(u => u.status === 'pending' && (currentUser.role === 'admin' || currentUser.role === 'SUPERADMIN' || (u.hospital === currentUser.hospital && u.ward === currentUser.ward))).length;
                                            if (pendingCount > 0) return <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount} Baru</span>;
                                            return null;
                                        })()}
                                    </button>

                                    <button onClick={() => { setView('archived-list'); setIsMainMenuOpen(false); fetchArchivedRecords(); }} className={`w-full text-left px-4 py-2 text-xs flex items-center text-slate-700 transition-colors ${mainMenuHighlight === getMenuIdx('view', 'archived-list') ? 'bg-indigo-100 font-bold text-indigo-900' : 'hover:bg-slate-50'}`}>🗃️ Gudang Arsip Pasien</button>

                                    {/* MENU KEUANGAN (HANYA MUNCUL JIKA USER ADALAH PJ) */}
                                    {cashflowRole && (
                                        <>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <button onClick={() => { setAppMode('MEDIS'); setAppMode('KEUANGAN'); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs flex items-center font-bold transition-colors ${mainMenuHighlight === getMenuIdx('finance') ? 'bg-indigo-100 text-indigo-900 font-black' : 'hover:bg-teal-50 text-teal-700'}`}>
                                                <Wallet size={14} className="mr-2" /> Panel Keuangan
                                            </button>
                                        </>
                                    )}

                                    {/* MENU SUPERADMIN / GOD MODE SWITCH BANGSAL (ALA WINDOWS EXPLORER) */}
                                    {currentUser?.role === 'admin' && (
                                        <>
                                            <div className="border-t border-gray-100 my-1"></div>
                                            <div className="px-3 py-1 bg-purple-50">
                                                <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">👑 God Mode (Multi-RS)</span>
                                            </div>

                                            {/* RENDER FOLDER RUMAH SAKIT */}
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {Object.keys(hospitalWardsList).sort().map(hospKey => {
                                                    const hospData = hospitalWardsList[hospKey];
                                                    const hospName = hospData.originalName; // ✨ Tarik format tulisan aslinya dari database
                                                    return (
                                                        <div key={hospKey} className="flex flex-col">
                                                            {/* NAMA RS (SEBAGAI FOLDER) */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Biar menu utama gak ketutup
                                                                    setExpandedHospital(expandedHospital === hospKey ? null : hospKey);
                                                                }}
                                                                className="w-full text-left px-4 py-2 text-xs flex items-center justify-between font-bold hover:bg-slate-50 text-slate-800 border-b border-slate-50/50"
                                                            >
                                                                <span className="truncate pr-2">🏥 {hospName}</span>
                                                                <span className="text-slate-400 font-mono">{expandedHospital === hospKey ? '[-]' : '[+]'}</span>
                                                            </button>

                                                            {/* ISI FOLDER (NAMA RUANGAN) */}
                                                            {expandedHospital === hospKey && (
                                                                <div className="bg-slate-50 py-1 border-l-2 border-indigo-200 ml-4 mb-1">
                                                                    {/* ✨ FIX: Gunakan hospData.wards.map */}
                                                                    {hospData.wards.map(wName => (
                                                                        <button
                                                                            key={wName}
                                                                            // ✨ FIX: wName & hospName dikirim utuh, TANPA toUpperCase()
                                                                            onClick={() => { onSwitchWard(wName, hospName); setIsMainMenuOpen(false); }}
                                                                            className="w-full text-left pl-6 pr-4 py-1.5 text-[11px] flex items-center font-bold transition-colors hover:bg-indigo-50 text-slate-600 hover:text-indigo-700"
                                                                        >
                                                                            🛏️ Ruang {toTitleCase(wName)}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}

                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button onClick={() => { onLogout(); setIsMainMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs text-rose-600 font-bold flex items-center transition-colors ${mainMenuHighlight === getMenuIdx('logout') ? 'bg-rose-100 font-black text-rose-700' : 'hover:bg-rose-50'}`}>🚪 Keluar</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={() => setShowInputModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg shadow-md text-xs font-bold transition flex items-center gap-1 ml-1">
                        <span>+</span> Baru
                    </button>
                </div>
            </div>

            <div className="relative flex flex-row max-w-7xl mx-auto lg:h-[calc(100vh-64px)] overflow-hidden">
                <div className={`fixed top-16 right-0 bottom-0 w-full md:w-[400px] z-[60] bg-white transition-transform duration-300 ease-in-out shadow-2xl border-l ${showWaitingModal ? 'translate-x-0' : 'translate-x-full'}`}>
                    <WaitingListInputPanel show={showWaitingModal} onClose={() => setShowWaitingModal(false)} onAdd={handleAddWaiting} availableRooms={currentWardConfig.roomList} occupiedRooms={occupiedRooms} waitingList={waitingList} onUpdateRoom={updateWaitingListRoom} activeRecords={activeRecords} />
                </div>
                <div className="w-full h-full flex flex-col overflow-hidden">
                    <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                        {view === 'dashboard' && renderDashboard()}
                        {view === 'patient-list' && (
                            <div className="h-full flex flex-col bg-gray-50">
                                <div className="p-3 bg-white border-b shadow-sm sticky top-0 z-40 flex-shrink-0 space-y-2">

                                    {/* Ditambahkan flex-wrap agar kalau layarnya sempit (HP), elemennya turun ke bawah dengan rapi */}
                                    <div className="flex justify-between items-center flex-wrap gap-y-2">

                                        {/* 1. Judul & Jumlah Pasien */}
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-bold text-lg text-indigo-800">📂 Daftar Pasien</h2>
                                            <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{filteredActiveRecords.length} Pasien</span>
                                        </div>

                                        {/* 2. BAGIAN FILTER: Cari -> Semua DPJP -> Semua Kamar */}
                                        <div className="flex flex-row gap-1.5 items-center w-full md:w-auto flex-1 md:mx-2">
                                            {/* 1. Search Bar */}
                                            <div className="relative flex-1">
                                                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                                                <input 
                                                    type="text" 
                                                    placeholder="Cari Nama/RM..." 
                                                    value={searchTerm} 
                                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                                    className="w-full pl-8 pr-6 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 h-[32px] outline-none" 
                                                />
                                                {searchTerm && (
                                                    <button 
                                                        onClick={() => setSearchTerm('')} 
                                                        className="absolute right-2 top-2 text-gray-400 hover:text-red-500 font-bold text-xs"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>

                                            {/* 2. Filter DPJP */}
                                            <div className="w-[100px] md:w-48 relative z-50">
                                                <DpjpFilterDropdown allOptions={dpjpOptions} selectedOptions={dpjpFilter} onChange={setDpjpFilter} />
                                            </div>

                                            {/* 3. Filter Kamar */}
                                            <div className="w-[85px] md:w-40 relative z-50">
                                                <RoomFilterDropdown allRooms={currentWardConfig.roomList} selectedRooms={selectedRoomFilter} onChange={setSelectedRoomFilter} />
                                            </div>
                                        </div>

                                        {/* 3. Tombol Aksi Kanan */}
                                        <div className="flex space-x-1">
                                            <button onClick={handleExportExcel} className="text-[10px] px-3 py-1.5 bg-white border border-green-200 text-green-700 rounded-lg font-bold hover:bg-green-600 hover:text-white transition shadow-sm">Excel</button>
                                            <button onClick={() => setShowBulkPrint(true)} className="text-[10px] px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-600 hover:text-white transition shadow-sm">🖨️ Cetak OA Banyakan</button>
                                        </div>

                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden relative z-0">
                                    {/* ✨ VERSI FINAL PEMANGGIL PATIENT TABLE */}
                                    <PatientTable
                                        roomList={currentWardConfig.roomList}
                                        // ✨ FIX TROLI & CARD: Gabungkan resep obat ke planning secara virtual HANYA jika belum bergabung
                                        records={filteredActiveRecords.map(r => {
                                            const rxText = r.currentPrescription || '';
                                            const alreadyMerged = (r.planning || '').toLowerCase().includes(rxText.toLowerCase().trim());
                                            return {
                                                ...r,
                                                planning: rxText && !alreadyMerged ? `${r.planning || ''}\n${rxText}` : (r.planning || '')
                                            };
                                        })}
                                        onEdit={handleEdit}
                                        onPrint={(r) => setSelectedRecordForPrint(r)}
                                        onShowLaporModal={setRecordForLapor}
                                        onDischarge={handleDischarge}
                                        onBulkPrint={() => setShowBulkPrint(true)}
                                        roomSortOrder={selectedRoomFilter}
                                        onPrintTTV={() => handlePrintTTV(currentWardConfig.name)}
                                        onPrintSOAP={() => handlePrintSOAP(currentWardConfig.name)}
                                        onQuickTtv={(rec) => { setQuickTtvTarget(rec); setShowTtvModal(true); }}
                                        onBulkDischarge={handleBulkDischarge}
                                        updateRecord={updateRecord}
                                        onPrintBukuCM={() => handlePrintBukuCM(currentWardConfig.name)}
                                        onPrintLabel={() => { }}
                                        db={db}
                                        currentUser={currentUser}
                                        firebaseConfig={firebaseConfig}
                                        parsePlanning={parsePlanning}
                                        getAntibioticDay={getAntibioticDay}
                                        hitungHariCM={hitungHariCM}
                                        formatDateCM={formatDateCM}
                                        parseDateCM={parseDateCM}
                                        renderLacakTtv={renderLacakTtv}
                                        renderObjectiveCell={renderObjectiveCell}
                                        renderPlanningCell={renderPlanningCell}
                                        BukuCMTable={BukuCMTable}
                                        GlobalMedicationBoard={GlobalMedicationBoard}
                                        onOpenEkspedisi={() => setIsBukuEkspedisiOpen(true)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* --- VIEW 4: ARSIP PASIEN (KOMPONEN BARU) --- */}
                        {view === 'archived-list' && (
                            <div className="h-full overflow-hidden bg-slate-50">
                                {/* ✨ FIX: Tambahkan onRefresh agar Gudang Arsip bisa menyuruh App memotret ulang data saat ada yang dihapus */}
                                <GudangArsip
                                    dataPasien={archivedRecords}
                                    loading={loading}
                                    db={db}
                                    onRestore={handleRestorePatient}
                                    onRefresh={fetchArchivedRecords}
                                />
                            </div>
                        )}

                        {/* --- VIEW 3: SETELAN (SaaS CONTROL TOWER INTERFACE) --- */}
                        {view === 'settings' && (
                            <div className="bg-white p-4 md:p-6 rounded-xl shadow-md h-full overflow-y-auto custom-scrollbar">
                                {/* Header Judul Utama */}
                                <div className="flex items-center justify-between mb-6 border-b pb-3 flex-wrap gap-2">
                                    <div>
                                        <h2 className="font-black text-xl text-indigo-950 flex items-center gap-2">⚙️ Pusat Kendali Aplikasi SIMPAN</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">Institusi Aktif: <span className="font-bold text-indigo-600">{currentUser.hospital || 'RSUD BAYU ASIH'}</span> | Ruang: <span className="font-bold text-indigo-600">{currentWardConfig.name}</span></p>
                                    </div>
                                    <div className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-green-50 text-green-700 border border-green-200 shadow-sm">
                                        ● Database Terhubung (Multi-Tenant Node)
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

                                    {/* PANEL KIRI (4 KOLOM): DATA PRIBADI PERAWAT */}
                                    <div className="xl:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                        <h3 className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center justify-between border-b pb-2">
                                            <span>👤 Profil Akun Saya</span>
                                            {/* ✨ FIX: LENCANA JABATAN SESUAI PERMINTAAN ABI */}
                                            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-black border border-indigo-200 shadow-sm">
                                                ⭐ JABATAN: {currentUser.role === 'member' || currentUser.role === 'Pelaksana' ? 'PELAKSANA' : currentUser.role.toUpperCase()}
                                            </span>
                                        </h3>
                                        <div className="space-y-2.5 text-xs">
                                            <div><label className="block font-bold text-slate-500 uppercase mb-1">Username (ID)</label><input type="text" value={currentUser.id} disabled className="w-full p-2 bg-slate-200 text-slate-500 border rounded font-mono cursor-not-allowed" /></div>
                                            <div><label className="block font-bold text-slate-500 uppercase mb-1">Nama Tampilan</label><input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded font-bold" /></div>
                                            <div><label className="block font-bold text-slate-500 uppercase mb-1">Password Masuk</label><input type="text" value={profileForm.pass} onChange={e => setProfileForm({ ...profileForm, pass: e.target.value })} className="w-full p-2 border border-slate-300 rounded font-mono" /></div>
                                            <button onClick={handleUpdateSelf} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition shadow-sm">Simpan Perubahan Profil</button>
                                        </div>
                                    </div>

                                    {/* PANEL KANAN (8 KOLOM): MANAGEMENT GLOBAL MULTI-RS */}
                                    <div className="xl:col-span-8 space-y-6">

                                        {/* MANAGEMENT PANEL USER (DIREKTRIS STRUKTUR RS & RUANGAN) */}
                                        {['admin', 'karu', 'PPJA'].includes(currentUser.role) && (
                                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 space-y-4">
                                                <div className="flex justify-between items-center border-b border-indigo-100 pb-2 flex-wrap gap-2">
                                                    <h3 className="font-black text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                                                        {currentUser.role === 'admin' ? '👑 God Admin: Manajemen Akun Terpimpin' : '📋 Manajemen Anggota Ruangan'}
                                                    </h3>
                                                    {/* Form Input Kilat Perawat Baru */}
                                                    <div className="bg-white p-2 rounded-lg border border-indigo-100 text-[10px] font-bold text-indigo-700">
                                                        Total Terdaftar: {
                                                            currentUser.role === 'admin'
                                                                ? allUsers.length
                                                                : allUsers.filter(u => u.hospital?.toUpperCase() === (currentUser.hospital || 'RSUD BAYU ASIH').toUpperCase() && u.ward?.toUpperCase() === currentUser.ward?.toUpperCase()).length
                                                        } User
                                                    </div>
                                                </div>

                                                {/* KOTAK SPAWNER / TAMBAH PERAWAT BARU */}
                                                <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm space-y-2.5">
                                                    <span className="text-[10px] font-black text-indigo-900 uppercase block">➕ Pendaftaran & Reset Akun Manual</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <input type="text" placeholder="Username (Kecil tanpa spasi)" value={adminUserForm.id} onChange={e => setAdminUserForm({ ...adminUserForm, id: e.target.value })} className="p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                                                        <input type="text" placeholder="Nama Lengkap Perawat" value={adminUserForm.name} onChange={e => setAdminUserForm({ ...adminUserForm, name: e.target.value })} className="p-2 border rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-bold" />
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <input type="text" placeholder="Password Akun" value={adminUserForm.pass} onChange={e => setAdminUserForm({ ...adminUserForm, pass: e.target.value })} className="p-2 border rounded text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
                                                        {/* ✨ FIX: Pilihan Role disesuaikan Kasta */}
                                                        <select value={adminUserForm.role} onChange={e => setAdminUserForm({ ...adminUserForm, role: e.target.value })} className="p-2 border rounded text-xs bg-white outline-none">
                                                            <option value="member">Perawat Pelaksana</option>
                                                            <option value="PPJA">Perawat - PPJA</option>
                                                            {['admin', 'karu'].includes(currentUser.role) && <option value="karu">Kepala Ruangan (Karu)</option>}
                                                            {currentUser.role === 'admin' && <option value="admin">God Admin</option>}
                                                        </select>
                                                        {/* ✨ FIX: Dropdown ruangan Terkunci jika Karu/PPJA */}
                                                        <select
                                                            value={['karu', 'PPJA'].includes(currentUser.role) ? currentUser.ward : (adminUserForm.ward || 'MELATI')}
                                                            onChange={e => setAdminUserForm({ ...adminUserForm, ward: e.target.value.toUpperCase() })}
                                                            disabled={['karu', 'PPJA'].includes(currentUser.role)}
                                                            className="p-2 border rounded text-xs bg-white font-extrabold text-indigo-700 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                                        >
                                                            {currentUser.role === 'admin' ? (
                                                                Object.keys(hospitalWardsList).flatMap(rs => Array.from(hospitalWardsList[rs]?.wards || [])).map(w => (
                                                                    <option key={w} value={w}>Ruang {toTitleCase(w)}</option>
                                                                ))
                                                            ) : (
                                                                <option value={currentUser.ward}>Ruang {toTitleCase(currentUser.ward)}</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                    <button onClick={handleAdminSaveUser} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-lg text-xs font-bold transition shadow-sm">Simpan / Update Otoritas User</button>
                                                </div>

                                                {/* ✨ FIX: STRUKTUR FOLDER GRUP AKUN (TERSENSOR JIKA BUKAN ADMIN) */}
                                                <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                                                    {Object.keys(hospitalWardsList)
                                                        .filter(rsKey => currentUser.role === 'admin' || rsKey === (currentUser.hospital || 'RSUD BAYU ASIH').toUpperCase())
                                                        .sort().map(rsKey => {
                                                            const hospData = hospitalWardsList[rsKey];
                                                            const hospName = hospData.originalName || rsKey;
                                                            const isExpanded = expandedHospital === rsKey || currentUser.role !== 'admin'; // Auto expand if not admin

                                                            return (
                                                                <div key={rsKey} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                                                    {/* ✨ TOMBOL HEADER ACCORDION DENGAN SUNTIKAN TOMBOL TRASH */}
                                                                    <div
                                                                        onClick={() => { if (currentUser.role === 'admin') setExpandedHospital(isExpanded ? null : rsKey) }}
                                                                        className={`w-full flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200 transition select-none ${currentUser.role === 'admin' ? 'hover:bg-slate-100 cursor-pointer' : 'cursor-default'}`}
                                                                    >
                                                                        <span className="text-xs font-black text-slate-800">🏥 {hospName}</span>

                                                                        {/* Wadah Aksi Kanan (Locker stopPropagation agar klik hapus tidak memicu buka-tutup accordion) */}
                                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                                                                                Grup Institusi {currentUser.role === 'admin' ? (isExpanded ? '▼' : '▶') : ''}
                                                                            </span>

                                                                            {/* 🔥 TOMBOL EKSEKUSI MATI RS (Hanya muncul di mata Superadmin Abi) */}
                                                                            {currentUser.role === 'admin' && rsKey !== 'RSUD BAYU ASIH' && (
                                                                                <button
                                                                                    onClick={() => handleDeleteHospital(rsKey, hospName)}
                                                                                    className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-2 py-0.5 rounded-md border border-red-200 font-black text-[9px] transition-all shadow-sm"
                                                                                    title={`Hapus Permanen Institusi ${hospName}`}
                                                                                >
                                                                                    🗑️ Hapus RS
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* ISI FOLDER (RUANGAN & USER) */}
                                                                    {isExpanded && (
                                                                        <div className="p-3 space-y-2 bg-white">
                                                                            {Array.from(hospData.wards || [])
                                                                                .filter(wardName => currentUser.role === 'admin' || wardName.toUpperCase() === (currentUser.ward || 'MELATI').toUpperCase())
                                                                                .map(wardName => {
                                                                                    const roomUsers = allUsers.filter(u =>
                                                                                        (u.hospital || 'RSUD BAYU ASIH').toUpperCase() === rsKey &&
                                                                                        (u.ward || 'MELATI').toUpperCase() === wardName.toUpperCase()
                                                                                    );
                                                                                    if (roomUsers.length === 0) return null;

                                                                                    return (
                                                                                        <div key={wardName} className="ml-1 pl-2 border-l-2 border-indigo-200 space-y-1.5">
                                                                                            <div className="text-[11px] font-extrabold text-indigo-700 flex items-center gap-1">
                                                                                                📂 Ruang {toTitleCase(wardName)} ({roomUsers.length} Staf)
                                                                                            </div>

                                                                                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                                                                                <table className="w-full text-[11px] text-left bg-white">
                                                                                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b text-[10px]">
                                                                                                        <tr>
                                                                                                            <th className="p-2">ID</th>
                                                                                                            <th className="p-2">Nama</th>
                                                                                                            <th className="p-2">Role</th>
                                                                                                            <th className="p-2">Pass</th>
                                                                                                            <th className="p-2 text-center">Status</th>
                                                                                                            <th className="p-2 text-center">Aksi</th>
                                                                                                        </tr>
                                                                                                    </thead>
                                                                                                    <tbody className="divide-y divide-slate-100">
                                                                                                        {roomUsers.map(u => (
                                                                                                            <tr key={u.id} className="hover:bg-indigo-50/40">
                                                                                                                <td className="p-2 font-mono text-slate-500">{u.id}</td>
                                                                                                                <td className="p-2 font-bold text-slate-800">{u.name}</td>
                                                                                                                <td className="p-2">
                                                                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'karu' ? 'bg-amber-100 text-amber-700' : u.role === 'PPJA' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{u.role === 'member' || u.role === 'Pelaksana' ? 'pelaksana' : u.role}</span>
                                                                                                                </td>
                                                                                                                <td className="p-2 font-mono text-slate-400">{u.pass}</td>
                                                                                                                <td className="p-2 text-center">
                                                                                                                    {u.status === 'pending' ? (
                                                                                                                        <button onClick={() => handleAccUser(u.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-0.5 rounded text-[9px] font-black animate-pulse shadow-sm transition">✓ ACC</button>
                                                                                                                    ) : (
                                                                                                                        <span className="text-emerald-600 font-bold text-[9px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Aktif</span>
                                                                                                                    )}
                                                                                                                </td>
                                                                                                                <td className="p-2 text-center flex justify-center gap-1.5">
                                                                                                                    <button onClick={() => setAdminUserForm({ ...u })} className="text-yellow-600 hover:scale-110 transition-transform">✏️</button>
                                                                                                                    {u.id !== currentUser.id && (
                                                                                                                        <button onClick={() => handleAdminDeleteUser(u.id)} className="text-red-500 hover:scale-110 transition-transform">🗑️</button>
                                                                                                                    )}
                                                                                                                </td>
                                                                                                            </tr>
                                                                                                        ))}
                                                                                                    </tbody>
                                                                                                </table>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}

                                        {/* ✨ DYNAMIC ENGINE: UNIVERSAL DENAH BUILDER (HANYA ADMIN & KARU, BUKAN PPJA) */}
                                        {['admin', 'karu'].includes(currentUser.role) && (
                                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-200 shadow-sm space-y-3">
                                                <div>
                                                    <h3 className="font-black text-sky-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                                        {currentUser.role === 'admin' ? '🏗️ Builder Denah Ruangan Universal (SaaS Spawner)' : `🏗️ Builder Denah Ruangan (${currentWardConfig.name})`}
                                                    </h3>
                                                    <p className="text-[10px] text-sky-700 mt-0.5">
                                                        {currentUser.role === 'admin'
                                                            ? 'Sebagai Superadmin, Anda bebas melahirkan RS baru atau membangun denah ruangan mana pun di Indonesia dari panel ini.'
                                                            : 'Modifikasi jumlah kasur dan tata letak denah ruangan Anda di sini.'}
                                                    </p>
                                                </div>

                                                <form onSubmit={handleRebuildWard} className="space-y-3 bg-white p-3 rounded-xl border border-sky-100 shadow-inner">
                                                    {/* Baris Atas: Penentuan Target RS dan Ward secara Fleksibel (HANYA AKTIF UNTUK ADMIN) */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Target Rumah Sakit</label>
                                                            <input
                                                                type="text"
                                                                list="existing-hospitals"
                                                                placeholder="Misal: RS KELUARGA REKSOSUDOMO"
                                                                value={currentUser.role === 'admin' ? (rebuildForm.rsTarget || '') : currentUser.hospital || 'RSUD BAYU ASIH'}
                                                                onChange={e => setRebuildForm({ ...rebuildForm, rsTarget: e.target.value })}
                                                                disabled={currentUser.role !== 'admin'}
                                                                className="w-full p-2 border rounded text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50/50 uppercase disabled:bg-slate-100 disabled:text-slate-500"
                                                            />
                                                            {currentUser.role === 'admin' && (
                                                                <datalist id="existing-hospitals">
                                                                    {Object.keys(hospitalWardsList).map(h => <option key={h} value={h} />)}
                                                                </datalist>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Target Nama Ruangan</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Misal: KRESNA / MELATI / ICU"
                                                                value={currentUser.role === 'admin' ? (rebuildForm.wardTarget || '') : currentUser.ward || 'MELATI'}
                                                                onChange={e => setRebuildForm({ ...rebuildForm, wardTarget: e.target.value })}
                                                                disabled={currentUser.role !== 'admin'}
                                                                className="w-full p-2 border rounded text-xs font-extrabold text-indigo-700 outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50/50 uppercase disabled:bg-slate-100 disabled:text-slate-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Baris Bawah: Konfigurasi Cetak Biru Kasur */}
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-1">
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Total Kasur Bed</label>
                                                            <input type="number" min="1" max="100" value={rebuildForm.bedCount} onChange={e => setRebuildForm({ ...rebuildForm, bedCount: parseInt(e.target.value) || 20 })} className="w-full p-1.5 border rounded text-xs text-center font-bold" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Format Nama</label>
                                                            <select value={rebuildForm.bedFormat} onChange={e => setRebuildForm({ ...rebuildForm, bedFormat: e.target.value })} className="w-full p-1.5 border rounded text-xs bg-white font-bold">
                                                                <option value="K1">Awalan "K" (K1, K2)</option>
                                                                <option value="1">Angka Saja (1, 2, 3)</option>
                                                                <option value="1A">Format Blok (1A, 1B)</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Layout Lorong</label>
                                                            <select value={rebuildForm.layout} onChange={e => setRebuildForm({ ...rebuildForm, layout: e.target.value })} className="w-full p-1.5 border rounded text-xs bg-white font-bold">
                                                                <option value="1baris">1 Baris Berjejer</option>
                                                                <option value="2baris">2 Baris (Kiri & Kanan)</option>
                                                            </select>
                                                        </div>
                                                        <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg font-black text-xs transition shadow-md">
                                                            🏗️ Bangun Denah Target
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}

                                        {/* MASTER DATA OBAT & LAB (TERISOLASI MATANG) */}
                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                            <div className="flex justify-between items-center border-b pb-1.5 mb-3">
                                                <h3 className="font-black text-slate-700 text-xs uppercase tracking-wider">🗂️ Master Data Medis Ruangan</h3>
                                                <span className="text-[10px] bg-slate-100 px-2 py-0.5 text-slate-500 font-bold rounded">Isi Otomatis Mengikuti RS Terpilih</span>
                                            </div>

                                            {/* Baris Input DPJP Baru */}
                                            <div className="flex space-x-2 mb-3">
                                                <input type="text" placeholder="Nama Dokter Baru..." value={newDpjpName} onChange={(e) => setNewDpjpName(e.target.value)} className="border p-2 rounded text-xs w-1/2 outline-none focus:ring-1 focus:ring-indigo-500" />
                                                <input type="text" placeholder="No. WA (08xxxx)" value={newDpjpWa} onChange={(e) => setNewDpjpWa(e.target.value)} className="border p-2 rounded text-xs w-1/3 font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
                                                <button onClick={handleAddDpjp} disabled={!isSettingsLoaded} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm">+ Dokter</button>
                                            </div>

                                            {/* Tabel DPJP */}
                                            <div className="border rounded-xl overflow-hidden bg-white shadow-sm max-h-48 overflow-y-auto custom-scrollbar">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b text-slate-600 font-bold text-[10px] uppercase">
                                                            <th className="p-2 border-r">Nama Dokter Spesialis</th>
                                                            <th className="p-2 border-r">No. WhatsApp</th>
                                                            <th className="p-2 text-center">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {dpjpProfiles.length === 0 ? (
                                                            <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic font-medium">Belum ada dokter spesialis terdaftar di RS ini. Silakan tambahkan di atas.</td></tr>
                                                        ) : dpjpProfiles.map((p, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition">
                                                                <td className="p-2 border-r font-bold text-slate-800">{p.name}</td>
                                                                <td className="p-2 border-r text-slate-500 font-mono">{p.waNumber}</td>
                                                                <td className="p-2 text-center"><button onClick={() => handleRemoveDpjp(p.name)} disabled={!isSettingsLoaded} className="text-red-500 font-bold border border-red-100 px-2 py-0.5 bg-red-50 hover:bg-red-100 rounded text-[10px] transition">Hapus</button></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Grid Komponen Penunjang Medis */}
                                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Master Lab */}
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <h4 className="text-xs font-black text-slate-700 mb-2 uppercase border-b pb-1">🧪 Master Lab</h4>
                                                    <div className="flex gap-1.5 mb-2">
                                                        <input type="text" placeholder="Nama Lab..." value={newMasterLab} onChange={e => setNewMasterLab(e.target.value)} className="flex-1 p-1.5 border rounded text-xs outline-none" />
                                                        <button onClick={() => handleAddMaster('lab')} disabled={!isSettingsLoaded} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">+</button>
                                                    </div>
                                                    <div className="max-h-28 overflow-y-auto custom-scrollbar text-xs divide-y divide-slate-50">
                                                        {masterLabs.length === 0 ? <div className="text-slate-400 italic text-[11px] p-1">(Kosong)</div> : masterLabs.map((i, idx) => (
                                                            <div key={idx} className="flex items-center justify-between py-1 font-medium text-slate-700">
                                                                <div className="truncate">{i}</div>
                                                                <button onClick={() => handleRemoveMaster('lab', i)} className="text-red-500 hover:bg-red-50 px-1.5 rounded transition text-[10px]">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Master Rad */}
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <h4 className="text-xs font-black text-slate-700 mb-2 uppercase border-b pb-1">🩻 Master Radiologi</h4>
                                                    <div className="flex gap-1.5 mb-2">
                                                        <input type="text" placeholder="Nama Rad..." value={newMasterRad} onChange={e => setNewMasterRad(e.target.value)} className="flex-1 p-1.5 border rounded text-xs outline-none" />
                                                        <button onClick={() => handleAddMaster('rad')} disabled={!isSettingsLoaded} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">+</button>
                                                    </div>
                                                    <div className="max-h-28 overflow-y-auto custom-scrollbar text-xs divide-y divide-slate-50">
                                                        {masterRads.length === 0 ? <div className="text-slate-400 italic text-[11px] p-1">(Kosong)</div> : masterRads.map((i, idx) => (
                                                            <div key={idx} className="flex items-center justify-between py-1 font-medium text-slate-700">
                                                                <div className="truncate">{i}</div>
                                                                <button onClick={() => handleRemoveMaster('rad', i)} className="text-red-500 hover:bg-red-50 px-1.5 rounded transition text-[10px]">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Master Tindakan */}
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <h4 className="text-xs font-black text-slate-700 mb-2 uppercase border-b pb-1">💉 Master Tindakan</h4>
                                                    <div className="flex gap-1.5 mb-2">
                                                        <input type="text" placeholder="Nama Tindakan..." value={newMasterProcedure} onChange={e => setNewMasterProcedure(e.target.value)} className="flex-1 p-1.5 border rounded text-xs outline-none" />
                                                        <button onClick={() => handleAddMaster('procedure')} disabled={!isSettingsLoaded} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">+</button>
                                                    </div>
                                                    <div className="max-h-28 overflow-y-auto custom-scrollbar text-xs divide-y divide-slate-50">
                                                        {masterProcedures.length === 0 ? <div className="text-slate-400 italic text-[11px] p-1">(Kosong)</div> : masterProcedures.map((i, idx) => (
                                                            <div key={idx} className="flex items-center justify-between py-1 font-medium text-slate-700">
                                                                <div className="truncate">{i}</div>
                                                                <button onClick={() => handleRemoveMaster('procedure', i)} className="text-red-500 hover:bg-red-50 px-1.5 rounded transition text-[10px]">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Master Obat */}
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                    <h4 className="text-xs font-black text-slate-700 mb-2 uppercase border-b pb-1">💊 Master Terapi / Obat</h4>
                                                    <div className="flex gap-1.5 mb-2">
                                                        <input type="text" placeholder="Nama Obat..." value={newMasterMedication} onChange={e => setNewMasterMedication(e.target.value)} className="flex-1 p-1.5 border rounded text-xs outline-none" />
                                                        <button onClick={() => handleAddMaster('medication')} disabled={!isSettingsLoaded} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm">+</button>
                                                    </div>
                                                    <div className="max-h-28 overflow-y-auto custom-scrollbar text-xs divide-y divide-slate-50">
                                                        {masterMedications.length === 0 ? <div className="text-gray-400 italic text-[11px] p-1">(Kosong)</div> : masterMedications.map((i, idx) => (
                                                            <div key={idx} className="flex items-center justify-between py-1 font-medium text-slate-700">
                                                                <div className="truncate">{i}</div>
                                                                <button onClick={() => handleRemoveMaster('medication', i)} className="text-red-500 hover:bg-red-50 px-1.5 rounded transition text-[10px]">✕</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {showInputModal && <div className="fixed top-16 right-0 bottom-0 w-full md:w-[500px] z-[60] bg-white shadow-2xl border-l transition-all duration-300 flex flex-col">
                    {/* ✨ CARA A: Banner Publikasikan — muncul saat Mode Personal + sedang edit pasien */}
                    {soapMode === 'personal' && isEditing && (
                        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-3 py-1.5 gap-2">
                            <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                                🙋 Mode Pribadi — catatan ini hanya milikmu
                            </span>
                            <button
                                onClick={() => {
                                    const rec = activeRecords.find(r => r.id === currentRecordId);
                                    if (rec) handlePublishToRoom(rec);
                                }}
                                className="shrink-0 px-2.5 py-1 text-[10px] font-bold bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition flex items-center gap-1"
                                title="Gabungkan catatan pribadiku ke catatan ruangan (Mode Gabungan)"
                            >
                                📤 Publikasikan ke Ruangan
                            </button>
                        </div>
                    )}
                    <PatientForm
                        showInputModal={showInputModal}
                        setShowInputModal={setShowInputModal}
                        handleSubmit={handleSubmit}
                        formData={formData}
                        handleInputChange={handleInputChange}
                        setFormData={setFormData}
                        resetForm={resetForm}
                        isEditing={isEditing}
                        currentRecordId={currentRecordId}
                        occupiedRooms={occupiedRooms}
                        availableRooms={currentWardConfig.roomList.filter(r => !occupiedRooms.includes(r) || (isEditing && r === formData.roomNumber)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))}
                        dpjpOptions={dpjpProfiles.map(p => p.name).sort()}
                        dpjpProfiles={dpjpProfiles}
                        showRaber1={showRaber1} setShowRaber1={setShowRaber1}
                        showRaber2={showRaber2} setShowRaber2={setShowRaber2}
                        historyLogs={historyLogs}
                        pullDataForField={pullDataForField}
                        setShowTtvModal={setShowTtvModal}
                        appendText={appendText}
                        handleDischarge={handleDischarge}
                        setSelectedRecordForPrint={setSelectedRecordForPrint}
                        setRecordForLapor={setRecordForLapor}
                        isFormReady={formData.name && formData.roomNumber && formData.dpjpName} loading={loading}
                        ALL_PLANNING_OPTIONS={combinedPlanningOptions}
                        masterLabs={masterLabs} masterRads={masterRads}
                        masterProcedures={masterProcedures}
                        masterMedications={masterMedications}
                        archivedRecords={archivedRecords}
                        activeRecords={activeRecords}
                        // ✨ FIX MODAL: Suntik baris obat ke planning sesaat sebelum CPO dibuka agar tidak blank putih
                        onOpenMarModal={(data) => {
                            const combinedData = {
                                ...data,
                                planning: `${data.planning || ''}\n${data.currentPrescription || ''}`
                            };
                            setMarSelectedRecord(combinedData);
                            setIsMarModalOpen(true);
                        }}
                        db={db}
                        currentUser={currentUser}
                        firebaseConfig={firebaseConfig}
                        // ✨ GAMBAR RADIOLOGI
                        onAddRadiologyImage={handleAddRadiologyImage}
                        onRemoveRadiologyImage={handleRemoveRadiologyImage}

                        // ✨ KABEL TUKAR BED DITANCAPKAN DI SINI:
                        onSwapBed={(rec) => { setPatientToSwap(rec); setShowSwapModal(true); }}
                    /></div>}
            </div>
            {/* ✨ JENDELA MELAYANG REKAM OBAT MAR DIGITAL */}
            <MedicationMarModal
                isOpen={isMarModalOpen}
                onClose={() => { setIsMarModalOpen(false); setMarSelectedRecord(null); }}
                record={marSelectedRecord}
                allRecords={records}
                db={db}
                currentUser={currentUser}
                firebaseConfig={firebaseConfig}
            />
            {recordForLapor && <LaporConfirmationModal patientName={recordForLapor.name} dpjpNumber={dpjpProfiles.find(p => p.name === recordForLapor.dpjpName)?.waNumber} onLaporDpjp={() => handleLapor(recordForLapor, 'DPJP')} onLaporJaga={() => handleLapor(recordForLapor, 'Forward')} onCancel={() => setRecordForLapor(null)} />}
            {selectedRecordForPrint && <PrintView record={selectedRecordForPrint} closePrint={() => setSelectedRecordForPrint(null)} historyLogs={historyLogs} />}
            {showBulkPrint && <BulkPrintView records={filteredActiveRecords} onClose={() => setShowBulkPrint(false)} />}
            {showTtvModal && <TtvModal onClose={() => { setShowTtvModal(false); setQuickTtvTarget(null); }} onSave={(text) => { if (quickTtvTarget) { handleSaveQuickTtv(text); } else { appendText('objective', text); setShowTtvModal(false); } }} />}
            {confirmDetails.isOpen && <ConfirmationModal title={confirmDetails.title} message={confirmDetails.message} onConfirm={confirmDetails.action} onCancel={closeConfirm} />}
            {recordForDischarge && <DischargeModal patientName={recordForDischarge.name} onCancel={() => setRecordForDischarge(null)} onPindah={() => processDischarge('pindah')} onPulang={() => processDischarge('pulang')} onMeninggal={() => processDischarge('meninggal')} />}
            {showLaporModal && <LaporModal onCancel={() => setShowLaporModal(false)} onLaporShift={handleLaporShift} onLaporCS={handleLaporCS} />}
            {/* ✨ TEMPEL MODAL TUKAR BED DI SINI: */}
            {showSwapModal && patientToSwap && (
                <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 backdrop-blur-sm z-[9999]">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">

                        <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center rounded-t-2xl">
                            <div>
                                <h2 className="text-lg font-black flex items-center gap-2">🔀 Panel Tukar Bed Pasien</h2>
                                <p className="text-indigo-100 text-xs mt-0.5 font-medium">Pilih bed tujuan untuk <span className="font-bold bg-indigo-800 px-1.5 py-0.5 rounded text-white">{patientToSwap.name} (Bed {patientToSwap.roomNumber})</span></p>
                            </div>
                            <button onClick={() => setShowSwapModal(false)} className="p-2 hover:bg-indigo-500 rounded-full transition-colors"><span className="text-xl leading-none">✖</span></button>
                        </div>

                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                            <h3 className="text-sm font-bold text-slate-700 mb-3 border-b pb-2">Daftar Bed di {currentWardConfig?.name || 'Bangsal Aktif'}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {(() => {
                                    // 1. Ambil data mentah denah kiri dan kanan dari constants
                                    const left = currentWardConfig?.leftRooms || [];
                                    const right = currentWardConfig?.rightRooms || [];
                                    const orderedRooms = [];

                                    // 2. Hitung jumlah kolom aktif (Melati = 2 kolom, Dahlia = 1 kolom)
                                    const leftCols = left.length <= 5 ? 1 : 2;
                                    const rightCols = right.length <= 5 ? 1 : 2;

                                    let lIdx = 0;
                                    let rIdx = 0;

                                    // 3. Proses Penganyaman: Ambil sebaris kiri, lalu sebaris kanan secara bergantian
                                    while (lIdx < left.length || rIdx < right.length) {
                                        // Masukkan kamar sisi kiri untuk baris ini
                                        for (let i = 0; i < leftCols; i++) {
                                            if (lIdx < left.length) orderedRooms.push(left[lIdx++]);
                                        }
                                        // Masukkan kamar sisi kanan untuk baris ini
                                        for (let i = 0; i < rightCols; i++) {
                                            if (rIdx < right.length) orderedRooms.push(right[rIdx++]);
                                        }
                                    }

                                    // 4. Gambar kotak-kotak tombol bed ke layar sesuai urutan anyaman
                                    return orderedRooms.map((roomNo) => {
                                        const occupant = activeRecords.find(r => r.roomNumber === roomNo);
                                        const isCurrent = roomNo === patientToSwap.roomNumber;

                                        return (
                                            <button
                                                key={roomNo}
                                                onClick={() => !isCurrent && handleExecuteSwap(roomNo)}
                                                disabled={isCurrent}
                                                className={`p-3 rounded-xl border-2 text-left flex flex-col gap-1 transition-all
                                                ${isCurrent ? 'border-indigo-400 bg-indigo-50 opacity-50 cursor-not-allowed' :
                                                        occupant ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-400' :
                                                            'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 shadow-sm'}`}
                                            >
                                                <span className={`text-sm font-black ${isCurrent ? 'text-indigo-600' : occupant ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                    Bed {roomNo}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-600 truncate w-full">
                                                    {isCurrent ? '(Posisi Saat Ini)' : occupant ? `👤 ${occupant.name}` : '✅ KOSONG'}
                                                </span>
                                                {occupant && !isCurrent && (
                                                    <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded w-max mt-1">TUKAR POSISI</span>
                                                )}
                                            </button>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ^^^ INI ADALAH PENUTUP DARI BLOK showSwapModal ^^^ */}

            {/* ✨ JENDELA MODAL KANVAS TTD SERAH TERIMA TUNGGAL */}
            <HandoverModal 
                isOpen={handoverConfig.isOpen}
                onClose={() => setHandoverConfig({ isOpen: false, agenda: null, viewModeData: null })}
                agenda={handoverConfig.agenda}
                onSave={handleSaveHandover}
                currentUser={currentUser}
                viewModeData={handoverConfig.viewModeData}
            />

            {/* ✨ JENDELA MODAL KANVAS TTD SERAH TERIMA NAMPAN MASAL */}
            <BulkHandoverModal 
                isOpen={isBulkHandoverOpen}
                onClose={() => setIsBulkHandoverOpen(false)}
                unverifiedAgendas={agendaHariIni.filter(a => !a.isVerified)}
                onSaveBulk={handleSaveBulkHandover}
                currentUser={currentUser}
            />

            {/* ✨ JENDELA MODAL BUKU EKSPEDISI DIGITAL (LACI RIWAYAT DEBAT) */}
            <BukuEkspedisiModal 
                isOpen={isBukuEkspedisiOpen}
                onClose={() => setIsBukuEkspedisiOpen(false)}
                activeRecords={activeRecords}
                archivedRecords={archivedRecords}
            />

            {/* --- JAM MELAYANG TRANSPARAN (GLASSMORPHISM) DI KANAN BAWAH --- */}
            <div className="fixed bottom-4 right-4 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg z-[50] select-none opacity-50">
                <DigitalClock />
            </div>
        </div>
    );
};

const App = () => {
    // 1. State System (VERSI AUTO-LOGOUT IMBAS INAKTIVITAS)
    const [db, setDb] = useState(null);
    const [storage, setStorage] = useState(null);

    // Waktu Batas: 15 Menit (15 * 60 * 1000 ms)
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

    const [userId, setUserId] = useState(() => {
        const uid = localStorage.getItem('simpan_uid');
        const lastActive = localStorage.getItem('simpan_last_active');
        const now = new Date().getTime();

        if (lastActive && (now - parseInt(lastActive) > INACTIVITY_TIMEOUT)) {
            localStorage.removeItem('simpan_user');
            localStorage.removeItem('simpan_uid');
            localStorage.removeItem('simpan_last_active');
            return null;
        }
        return uid;
    });
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    // 2. State Login Lokal & Mode
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const lastActive = localStorage.getItem('simpan_last_active');
            const now = new Date().getTime();

            if (lastActive && (now - parseInt(lastActive) > INACTIVITY_TIMEOUT)) {
                return null;
            }
            return JSON.parse(localStorage.getItem('simpan_user')) || null;
        } catch (e) {
            return null;
        }
    });
    const [appMode, setAppMode] = useState('MEDIS');
    const [allUsers, setAllUsers] = useState([]);

    // --- INIT FIREBASE (VERSI BYPASS JARINGAN RS) ---
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        try {
            // 🔥 3. BERSIHKAN DI SINI:
            // (Hapus baris const app = initializeApp(...) dari sini)
            // (Hapus baris const storage = getStorage(...) dari sini)

            // Cukup sisakan engine Database dengan trik Anti-Blokir Wi-Fi RS + BAN SEREP OFFLINE:
            const firestoreInstance = initializeFirestore(app, {
                experimentalForceLongPolling: true,
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
            setDb(firestoreInstance);
        } catch (error) {
            // ✨ FIX VITE HOT-RELOAD: Jika error karena direfresh 2x, panggil instansi yang sudah nyala
            console.warn("Firestore sudah aktif (Hot-Reload), mengambil instansi...");
            setDb(getFirestore(app));
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ⚡ MESIN SENSOR INAKTIVITAS: AUTO LOGOUT JIKA DITINGGAL LAMA
    useEffect(() => {
        if (!currentUser) return;

        let timeoutId;

        const resetTimer = () => {
            localStorage.setItem('simpan_last_active', new Date().getTime());

            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                handleInternalLogout();
                alert("Sesi Anda telah berakhir demi keamanan data pasien & ruangan. Silakan masuk kembali.");
            }, INACTIVITY_TIMEOUT);
        };

        const interaksiEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        // Daftarkan fungsi pemantau ke window browser (Sudah difix agar sintaksnya aman)
        interaksiEvents.forEach(evt => window.addEventListener(evt, resetTimer));

        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            interaksiEvents.forEach(evt => window.removeEventListener(evt, resetTimer));
        };
    }, [currentUser]);

    // ✨ TAHAP 4: FUNGSI SUPERADMIN UNTUK PINDAH RUANGAN & RUMAH SAKIT
    const handleSwitchWard = (targetWard, targetHospital) => {
        // Jika targetHospital dikirim, gunakan itu. Jika tidak, gunakan RS yang sedang aktif.
        const finalHospital = targetHospital || currentUser.hospital;

        const updatedUser = {
            ...currentUser,
            ward: targetWard,
            hospital: finalHospital // 👇 Kunci sukses God Mode pindah RS!
        };
        setCurrentUser(updatedUser);

        // Update juga brankas di browser agar tidak hilang saat di-refresh
        localStorage.setItem('simpan_user', JSON.stringify(updatedUser));

        if (targetHospital) {
            alert(`Beralih ke pantauan Ruang ${targetWard} - ${targetHospital}`);
        } else {
            alert(`Beralih ke pantauan Ruang ${targetWard}`);
        }
    };
    const handleInternalLogout = () => {
        setCurrentUser(null);
        setUserId(null);
        setLoginForm({ id: '', pass: '' });
        setAppMode('MEDIS');

        localStorage.removeItem('simpan_user');
        localStorage.removeItem('simpan_uid');
        localStorage.removeItem('simpan_last_active');

        // ✅ FIX 2A: Bersihkan Cache Data Master agar tidak terbawa ke RS Lain!
        localStorage.removeItem('backupDpjp');
        localStorage.removeItem('masterLabs');
        localStorage.removeItem('masterRads');
        localStorage.removeItem('masterProcedures');
        localStorage.removeItem('masterMedications');
    };

    const getCashflowRole = () => {
        if (!currentUser) return null;
        if (currentUser.role === 'admin') return 'ALL';
        if (currentUser.role === 'finance_jm') return 'JM';
        if (currentUser.role === 'finance_kas') return 'KAS';
        if (currentUser.role === 'finance_doc') return 'DOKTER';
        return null;
    };

    // --- 1. TAMPILAN LOGIN & ONBOARDING (FASE 1 - SAAS MODE - COMPACT EDITION) ---
    if (!currentUser) {
        return (
            <AuthScreen 
                db={db} 
                appId={firebaseConfig.appId}
                initialDpjpProfiles={initialDpjpProfiles}
                firebaseConfig={firebaseConfig}
                onLoginSuccess={(userData) => {
                    setCurrentUser(userData);
                    setAppMode('MEDIS');
                    setUserId(userData.id);
                    localStorage.setItem('simpan_user', JSON.stringify(userData));
                    localStorage.setItem('simpan_uid', userData.id);
                    localStorage.setItem('simpan_last_active', new Date().getTime());
                }}
            />
        );
    }

    // Loading Check (Sudah dibersihkan dari isAuthReady & isOfflineReady)
    if (!db) return <div className="flex h-screen items-center justify-center text-teal-600 animate-pulse font-bold">Memuat Database...</div>;

    // --- 2. TAMPILAN UTAMA (ROUTING) ---
    return (
        <div className="min-h-screen bg-slate-50">
            {appMode === 'MEDIS' ? (
                <MedicalRecordApp
                    db={db}
                    userId={userId}
                    appId={firebaseConfig.appId}
                    isOnline={isOnline}
                    onLogout={handleInternalLogout}
                    userRole={currentUser.role}
                    // Props Penting
                    currentUser={currentUser}
                    appMode={appMode}
                    setAppMode={setAppMode}
                    cashflowRole={getCashflowRole()}
                    onSwitchWard={handleSwitchWard}
                />
            ) : (
                // --- MODE KEUANGAN: HEADER SINGLE (CLEAN LOOK) ---
                <div className="flex flex-col h-screen animate-in fade-in zoom-in-95 duration-300 bg-slate-50">
                    <div className="bg-white border-b px-4 h-14 flex justify-between items-center sticky top-0 z-50 shadow-sm">

                        {/* KIRI: TOMBOL KEMBALI & JUDUL */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setAppMode('MEDIS')}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
                            >
                                <ChevronLeft size={16} /> Kembali ke Medis
                            </button>
                            <div className="h-6 w-[1px] bg-slate-200"></div>

                            <div className="flex flex-col leading-none justify-center">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mode Keuangan</span>
                                <span className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                                    <Wallet size={16} /> {currentUser.cfLabel}
                                </span>
                            </div>
                        </div>

                        {/* KANAN: USER INFO & LOGOUT */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end leading-none">
                                <span className="text-[10px] text-slate-400 font-bold">Logged in as</span>
                                <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
                            </div>
                            <div className="h-6 w-[1px] bg-slate-200"></div>
                            <button
                                onClick={handleInternalLogout}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-100"
                                title="Keluar / Logout"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>

                    {/* KONTEN CASHFLOW */}
                    <div className="flex-1 overflow-auto">
                        <Cashflow
                            currentUser={{
                                ...currentUser,
                                cashflowRole: getCashflowRole(),
                                cashflowLabel: currentUser.cfLabel
                            }}
                            membersList={allUsers.filter(u => (u.ward || 'MELATI') === currentUser.ward)} // ✨ FIX: Saring anggota perawat per ruangan
                            onLogout={handleInternalLogout}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;