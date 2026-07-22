// src/components/Cashflow.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Wallet, BookOpen, History, CheckCircle, Grid, ChevronLeft, ChevronRight, 
  Edit2, PlusCircle, Trash2, X, TrendingUp, TrendingDown, Download, UserPlus, Zap, Eye, EyeOff,
  Activity, Stethoscope, Shield, ArrowUpDown, Calendar
} from 'lucide-react';

// --- UTILITAS (FIXED NAN) ---
const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const formatDateID = (d) => { if(!d) return ''; const [y,m,da] = d.split('-'); return `${da}/${m}/${y}`; };
const formatNumberInput = (val) => { if (!val && val !== 0) return ''; return new Intl.NumberFormat('id-ID').format(val); };

// FIX: Membersihkan titik agar "200.000" dibaca "200000"
const parseNumberInput = (val) => {
    if (!val) return 0;
    const str = val.toString().replace(/\./g, ''); // Hapus semua titik
    return parseInt(str, 10) || 0;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const IURAN_AMOUNT = 50000;

export default function Cashflow({ currentUser, membersList, onUpdateMembers }) { 
  
  // --- STATE DATA ---
  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem('cf_transactions')) || []);
  const [loans, setLoans] = useState(() => JSON.parse(localStorage.getItem('cf_loans')) || []);
  
  useEffect(() => localStorage.setItem('cf_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('cf_loans', JSON.stringify(loans)), [loans]);

  // --- VIEW STATE ---
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('transaksi'); 
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [showBarChart, setShowBarChart] = useState(true); // Show/hide stacked bar chart
  const [showTrendLine, setShowTrendLine] = useState(true); // Show/hide trend lines
  
  // --- STATE TAMPILAN (FIX BLANK SCREEN) ---
  const [showDetails, setShowDetails] = useState(true); // Toggle Saldo Atas
  const [showTableTotals, setShowTableTotals] = useState(true); // Toggle Total Tabel
  const [statVisibility, setStatVisibility] = useState({ income: true, expense: true, net: true }); // Toggle Mata 1 per 1
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = Baru ke Lama

  const isAdmin = currentUser.cashflowRole === 'ALL';

  // --- FORM STATES ---
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ description: '', amount: '', type: 'IN', date: new Date().toISOString().split('T')[0], category: 'JM' });
  const [loanFormData, setLoanFormData] = useState({ borrower: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '', category: 'JM' });
  const [repayForm, setRepayForm] = useState({ amount: '', date: '' });
  const [newMemberName, setNewMemberName] = useState('');
  
  // Modal States
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [historyModalData, setHistoryModalData] = useState(null); 
  const [iuranModalData, setIuranModalData] = useState(null); 
  const [deleteModalData, setDeleteModalData] = useState(null); 
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [editRepaymentData, setEditRepaymentData] = useState(null);

  // --- HELPER: TOGGLE VISIBILITY ---
  const toggleStat = (key) => setStatVisibility(prev => ({ ...prev, [key]: !prev[key] }));

  // --- LOGIC 1: STATISTIK GLOBAL (HEADER) ---
  const globalStats = useMemo(() => {
    const res = { JM: { balance: 0, income: 0, expense: 0 }, KAS: { balance: 0, income: 0, expense: 0 }, DOKTER: { balance: 0, income: 0, expense: 0 }, TOTAL: 0 };
    transactions.forEach(t => {
        if(res[t.category]) {
            if(t.type === 'IN') { res[t.category].income += t.amount; res[t.category].balance += t.amount; }
            else { res[t.category].expense += t.amount; res[t.category].balance -= t.amount; }
        }
    });
    res.TOTAL = res.JM.balance + res.KAS.balance + res.DOKTER.balance;
    return res;
  }, [transactions]);

  // --- LOGIC 2: TABEL & CHART (RUNNING BALANCE) ---
  const { ledgerData, monthlyStats, chartData, monthlyComparisonData } = useMemo(() => {
      let allTrans = [...transactions].sort((a,b) => new Date(a.date) - new Date(b.date)); // Sort TUA ke MUDA dulu
      if (!isAdmin) { allTrans = allTrans.filter(t => t.category === currentUser.cashflowRole); }

      let runningBalance = 0;
      let monthIn = 0; let monthOut = 0; let monthStartBalance = 0; 
      
      const ledgerResult = []; 
      const chartMap = Array(12).fill(0).map((_, i) => ({ name: MONTHS[i], Masuk: 0, Keluar: 0, Saldo: 0 }));
      
      const startDate = new Date(filterYear, filterMonth, 1);
      const endDate = new Date(filterYear, filterMonth + 1, 0);

      // Calculate monthly comparison (current month and previous month)
      const monthlyData = {};
      const currentMonthKey = `${filterYear}-${filterMonth}`;
      const prevMonth = filterMonth === 0 ? 11 : filterMonth - 1;
      const prevYear = filterMonth === 0 ? filterYear - 1 : filterYear;
      const prevMonthKey = `${prevYear}-${prevMonth}`;
      
      monthlyData[currentMonthKey] = { Masuk: 0, Keluar: 0, Saldo: 0, startBalance: 0 };
      monthlyData[prevMonthKey] = { Masuk: 0, Keluar: 0, Saldo: 0, startBalance: 0 };

      allTrans.forEach(t => {
          // Hitung Saldo Kumulatif (Running Balance)
          if (t.type === 'IN') runningBalance += t.amount; else runningBalance -= t.amount;

          const tDate = new Date(t.date);
          const tMonth = tDate.getMonth();
          const tYear = tDate.getFullYear();
          const monthKey = `${tYear}-${tMonth}`;

          if (tDate < startDate) { monthStartBalance = runningBalance; }

          if (tMonth === filterMonth && tYear === filterYear) {
              if (t.type === 'IN') monthIn += t.amount; else monthOut += t.amount;
              ledgerResult.push({ ...t, currentBalance: runningBalance });
          }

          if (tYear === filterYear) {
              if(t.type === 'IN') chartMap[tMonth].Masuk += t.amount; else chartMap[tMonth].Keluar += t.amount;
              chartMap[tMonth].Saldo = runningBalance; 
          }

          // Aggregate monthly data for comparison
          if (monthlyData[monthKey]) {
              if (t.type === 'IN') monthlyData[monthKey].Masuk += t.amount; 
              else monthlyData[monthKey].Keluar += t.amount;
              monthlyData[monthKey].Saldo = runningBalance;
          }
      });

      // Build comparison data
      const comparisonData = [
          {
              month: `${MONTHS[prevMonth]} ${prevYear}`,
              Masuk: monthlyData[prevMonthKey]?.Masuk || 0,
              Keluar: monthlyData[prevMonthKey]?.Keluar || 0,
              Saldo: monthlyData[prevMonthKey]?.Saldo || 0
          },
          {
              month: `${MONTHS[filterMonth]} ${filterYear}`,
              Masuk: monthlyData[currentMonthKey]?.Masuk || 0,
              Keluar: monthlyData[currentMonthKey]?.Keluar || 0,
              Saldo: monthlyData[currentMonthKey]?.Saldo || 0
          }
      ];

      let lastBal = 0;
      const finalChart = chartMap.map(d => {
          if (d.Masuk===0 && d.Keluar===0 && d.Saldo===0) d.Saldo = lastBal;
          else lastBal = d.Saldo;
          return d;
      });

      // Sortir Tabel Akhir Sesuai Pilihan User
      const finalLedger = sortOrder === 'desc' ? ledgerResult.reverse() : ledgerResult;

      return {
          ledgerData: finalLedger,
          monthlyStats: { income: monthIn, expense: monthOut, net: monthIn - monthOut },
          chartData: finalChart,
          monthlyComparisonData: comparisonData
      };
  }, [transactions, filterMonth, filterYear, isAdmin, currentUser.cashflowRole, sortOrder]);

  // --- LOGIC 3: IURAN & PINJAMAN ---
  const duesMatrix = useMemo(() => {
    const matrix = {};
    if (membersList) { membersList.forEach(m => { matrix[m.id] = {}; MONTHS.forEach(mo => { matrix[m.id][mo] = null; }); }); }
    transactions.forEach(t => { if (t.category === 'KAS' && t.isIuran && new Date(t.date).getFullYear() === filterYear) { if (matrix[t.memberId]) matrix[t.memberId][t.month] = t.id; } });
    return matrix;
  }, [transactions, membersList, filterYear]);

  const filteredLoans = loans.filter(l => isAdmin || l.category === currentUser.cashflowRole);

  // ================= HANDLERS =================
  const handleTransactionSubmit = (e) => {
    e.preventDefault();
    const amountVal = parseNumberInput(formData.amount); // FIX NaN
    if (!formData.description || amountVal <= 0) return alert("Data tidak valid!");
    
    const transCategory = isAdmin ? formData.category : currentUser.cashflowRole; 

    if (editingId) {
        setTransactions(prev => prev.map(t => t.id === editingId ? { ...t, ...formData, amount: amountVal, category: transCategory } : t));
    } else {
        const newTrans = { id: Date.now(), ...formData, amount: amountVal, category: transCategory, user: currentUser.name };
        setTransactions([newTrans, ...transactions]);
    }
    setView('dashboard');
  };

  const deleteTrans = () => {
    const { id } = deleteModalData;
    const transToDelete = transactions.find(t => t.id === id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    
    if (transToDelete && transToDelete.loanReferenceId) {
         setLoans(prev => prev.map(l => {
             if (l.id === transToDelete.loanReferenceId) {
                 const newPaid = l.paidAmount - transToDelete.amount;
                 return { ...l, paidAmount: newPaid, history: l.history.filter(h => h.transactionId !== id), status: newPaid >= l.totalAmount ? 'LUNAS' : 'BELUM' };
             } return l;
         }));
    }
    setDeleteModalData(null);
  };

  // --- HANDLER LAIN (CLEANED UP) ---
  const openTransactionForm = (t) => { setEditingId(t?.id); setFormData(t ? {...t} : {description:'', amount:'', type:'IN', date:new Date().toISOString().split('T')[0], category:isAdmin?'JM':currentUser.cashflowRole}); setView('form'); };
  const openLoanForm = () => { setLoanFormData({ borrower: '', amount: '', date: new Date().toISOString().split('T')[0], notes: '', category: isAdmin ? 'JM' : currentUser.cashflowRole }); setView('loan-form'); };
  
  const submitLoan = (e) => { 
      e.preventDefault(); 
      const val = parseNumberInput(loanFormData.amount); // FIX NaN
      if(val <= 0) return alert("Nominal salah!");
      
      const newL={id:Date.now(),...loanFormData, amount:val, paidAmount:0, status:'BELUM', history:[]}; 
      const newT={id:Date.now()+1, date:loanFormData.date, description:`Pinjaman Keluar: ${loanFormData.borrower}`, amount:val, type:'OUT', category:isAdmin?loanFormData.category:currentUser.cashflowRole, user:currentUser.name, loanReferenceId:newL.id}; 
      setLoans([newL,...loans]); setTransactions([newT,...transactions]); setView('dashboard'); setActiveTab('pinjaman'); 
  };
  
  const submitRepayment = (e) => { 
      e.preventDefault(); 
      const val = parseNumberInput(repayForm.amount); // FIX NaN
      if(val <= 0) return alert("Nominal salah!");
      
      const id=Date.now(); 
      setLoans(p=>p.map(l=>l.id===selectedLoan.id?{...l,paidAmount:l.paidAmount+val, history:[...l.history,{transactionId:id,date:repayForm.date,amount:val}], status:l.paidAmount+val>=l.amount?'LUNAS':'BELUM'}:l)); 
      setTransactions([{id, date:repayForm.date, description:`Cicilan: ${selectedLoan.borrower}`, amount:val, type:'IN', category:selectedLoan.category, user:currentUser.name, loanReferenceId:selectedLoan.id},...transactions]); 
      setView('dashboard'); setActiveTab('pinjaman'); 
  };

  const toggleIuran = (member, month) => { const exist = duesMatrix[member.id][month]; let d = new Date().toISOString().split('T')[0]; if(exist) { const t=transactions.find(tr=>tr.id===exist); if(t) d=t.date; } setIuranModalData({ member, month, date: d, transId: exist }); };
  const handleSaveIuran = () => { const {member,month,date,transId} = iuranModalData; if(!date) return; if(transId) { setTransactions(p=>p.map(t=>t.id===transId ? {...t, date} : t)); } else { const n={id:Date.now(), date, description:`Iuran: ${member.name} (${month} ${filterYear})`, amount:IURAN_AMOUNT, type:'IN', category:'KAS', user:currentUser.name, isIuran:true, memberId:member.id, month}; setTransactions(p=>[n,...p]); } setIuranModalData(null); };
  const handleDeleteIuran = () => { if(iuranModalData.transId) setTransactions(p=>p.filter(t=>t.id!==iuranModalData.transId)); setIuranModalData(null); };
  const handlePayFullYear = (member) => { if(!confirm(`Bayar lunas?`)) return; const n=[]; MONTHS.forEach((m,i)=>{ if(!duesMatrix[member.id][m]) n.push({id:Date.now()+i, date:`${filterYear}-${String(i+1).padStart(2,'0')}-05`, description:`Iuran: ${member.name}`, amount:IURAN_AMOUNT, type:'IN', category:'KAS', user:currentUser.name, isIuran:true, memberId:member.id, month:m}); }); setTransactions([...n,...transactions]); };
  const handleDownloadCSV = () => { const h = ['Tanggal,Uraian,Masuk,Keluar,Saldo']; const r = ledgerData.map(t => `${t.date},"${t.description}",${t.type==='IN'?t.amount:0},${t.type==='OUT'?t.amount:0},${t.currentBalance}`); const l = document.createElement("a"); l.href = encodeURI("data:text/csv;charset=utf-8,"+ [h,...r].join("\n")); l.download = `Laporan_${MONTHS[filterMonth]}.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l); };
  const handleWhatsAppReport = () => {
    // 1. Tentukan Kategori & Label
    const category = isAdmin ? 'ALL' : currentUser.cashflowRole;
    const catLabel = isAdmin ? "LAPORAN GABUNGAN" : currentUser.cashflowLabel;

    // 2. Hitung Saldo Bulan Lalu
    const reportDate = new Date(filterYear, filterMonth, 1);
    const saldoLalu = transactions.reduce((acc, t) => {
        const tDate = new Date(t.date);
        const matchesCategory = isAdmin || t.category === category;
        if (matchesCategory && tDate < reportDate) {
            return t.type === 'IN' ? acc + t.amount : acc - t.amount;
        }
        return acc;
    }, 0);

    // 3. Ambil Rincian Transaksi Bulan Ini (Filter & Sortir)
    const thisMonthTrans = transactions.filter(t => 
        (isAdmin || t.category === category) && 
        new Date(t.date).getMonth() === filterMonth && 
        new Date(t.date).getFullYear() === filterYear
    ).sort((a, b) => new Date(a.date) - new Date(b.date));

    const incomes = thisMonthTrans.filter(t => t.type === 'IN');
    const expenses = thisMonthTrans.filter(t => t.type === 'OUT');

    // KODE ANTI-ERROR EMOJI
    const chartEmoji = '\uD83D\uDCCA'; 

    // 4. Susun Pesan sesuai Template User
    let msg = `${chartEmoji} *Laporan Bulanan: ${catLabel} - ${MONTHS[filterMonth]} ${filterYear}*\n\n`;
    msg += `Saldo bulan Lalu = ${formatRupiah(saldoLalu)}\n\n`;
    
    msg += `*Total Masuk: ${formatRupiah(monthlyStats.income)}*\n`;
    incomes.forEach(t => {
      msg += `- ${t.description} = ${formatRupiah(t.amount)}\n`;
    });
    
    msg += `\n*Total Keluar: ${formatRupiah(monthlyStats.expense)}*\n`;
    expenses.forEach(t => {
      msg += `- ${t.description} = ${formatRupiah(t.amount)}\n`;
    });
    
    msg += `\n*Sisa Saldo sampai saat ini: ${formatRupiah(saldoLalu + monthlyStats.net)}*`;

    // 5. Direct ke WA
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const handleWhatsAppTagihan = (loan) => {
    const sisaHutang = loan.amount - loan.paidAmount;
    
    // Kode Unicode Emoji agar aman di semua perangkat (Laptop/HP)
    const calendarEmoji = '\uD83D\uDCC5';
    const moneyEmoji = '\uD83D\uDCB0';
    const checkEmoji = '\u2705';
    const memoEmoji = '\uD83D\uDCDD';
    const prayEmoji = '\uD83D\uDE4F';

    // Susun Pesan sesuai Template Baru
    let msg = `Assalamualaikum, izin mengingatkan terkait pinjaman uang ${loan.category}.\n`;
    msg += `${calendarEmoji} Tanggal Pinjam: ${formatDateID(loan.date)}\n`;
    msg += `${moneyEmoji} Total Pinjaman: *${formatRupiah(loan.amount)}*\n`;
    msg += `${checkEmoji} Sudah Dibayar: ${formatRupiah(loan.paidAmount)}\n`;
    
    // Looping Rincian Pembayaran (Jika Ada)
    if (loan.history && loan.history.length > 0) {
        loan.history.forEach((h) => {
            msg += `  - ${formatDateID(h.date)} = ${formatRupiah(h.amount)}\n`;
        });
    } else {
        msg += `  - (Belum ada riwayat pembayaran)\n`;
    }
    
    msg += `Sisa Tagihan: *${formatRupiah(sisaHutang)}*\n`;
    
    // Tambahkan Catatan Jika Ada
    if (loan.notes) {
        msg += `${memoEmoji} Catatan: ${loan.notes}\n`;
    }
    
    msg += `Terima kasih atas pengertiannya ${prayEmoji}`;

    // Direct ke WA
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // FIX: Reset Data (Bersihkan LocalStorage)
  const handleResetData = () => { if(confirm("⚠️ HAPUS SEMUA DATA?")) { setTransactions([]); setLoans([]); localStorage.removeItem('cf_transactions'); localStorage.removeItem('cf_loans'); alert("Data bersih."); } };

  // Handler untuk menghapus pinjaman dan transaksi terkaitnya
  const handleDeleteLoan = (loan) => { 
    if(confirm('Hapus pinjaman ini?')) { 
      setLoans(p=>p.filter(l=>l.id!==loan.id));
      setTransactions(prev => prev.filter(t => t.loanReferenceId !== loan.id));
    }
  };

  // Handler untuk menambah anggota baru
  const handleAddMember = () => {
    if(!newMemberName.trim()) return alert('Nama tidak boleh kosong');
    const newMember = { id: Date.now(), name: newMemberName.trim() };
    if(onUpdateMembers) onUpdateMembers([...membersList, newMember]);
    setNewMemberName('');
    setAddMemberModalOpen(false);
  };

  // Handler untuk delete pembayaran dari riwayat
  const deleteRepaymentFromHistory = (historyItem) => {
    if(!confirm('Hapus pembayaran ini?')) return;
    setLoans(p => p.map(l => {
      if(l.id === historyModalData.id) {
        const newHistory = l.history.filter(h => h.transactionId !== historyItem.transactionId);
        const newPaidAmount = l.paidAmount - historyItem.amount;
        return { ...l, history: newHistory, paidAmount: newPaidAmount, status: newPaidAmount >= l.amount ? 'LUNAS' : 'BELUM' };
      }
      return l;
    }));
    setTransactions(prev => prev.filter(t => t.id !== historyItem.transactionId));
    setHistoryModalData(prev => ({ ...prev, history: prev.history.filter(h => h.transactionId !== historyItem.transactionId) }));
  };

  // Handler untuk edit pembayaran
  const handleEditRepaymentSubmit = (e) => {
    e.preventDefault();
    const newAmount = parseNumberInput(editRepaymentData.amount);
    if(newAmount <= 0) return alert('Nominal tidak valid');
    
    const oldAmount = editRepaymentData.historyItem.amount;
    const amountDiff = newAmount - oldAmount;
    
    setLoans(p => p.map(l => {
      if(l.id === editRepaymentData.loan.id) {
        const newHistory = l.history.map(h => h.transactionId === editRepaymentData.historyItem.transactionId ? { ...h, date: editRepaymentData.date, amount: newAmount } : h);
        const newPaidAmount = l.paidAmount + amountDiff;
        return { ...l, history: newHistory, paidAmount: newPaidAmount, status: newPaidAmount >= l.amount ? 'LUNAS' : 'BELUM' };
      }
      return l;
    }));
    setTransactions(prev => prev.map(t => t.id === editRepaymentData.historyItem.transactionId ? { ...t, date: editRepaymentData.date, amount: newAmount } : t));
    setEditRepaymentData(null);
  };

  // ================= RENDER =================
  return (
    <div className="bg-slate-50 min-h-screen p-4 pb-20 font-sans">
      
      {/* 1. FILTER & HEADER */}
      <div className="flex flex-wrap gap-2 mb-6 items-center justify-between sticky top-0 bg-slate-50 z-20 py-2">
          <div className="flex gap-2">
              <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-sm">
                    <button onClick={() => setFilterYear(y => y - 1)} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button>
                    <span className="mx-2 text-sm font-bold text-slate-700">{filterYear}</span>
                    <button onClick={() => setFilterYear(y => y + 1)} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button>
              </div>
              <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-sm">
                    <button onClick={() => setFilterMonth(m => m === 0 ? 11 : m - 1)} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={16}/></button>
                    <span className="mx-2 text-sm font-bold text-slate-700 w-16 text-center">{MONTHS[filterMonth]}</span>
                    <button onClick={() => setFilterMonth(m => m === 11 ? 0 : m + 1)} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={16}/></button>
              </div>
          </div>
          <div className="flex gap-2 ml-auto">
             <button onClick={handleDownloadCSV} className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 shadow-sm"><Download size={14}/> CSV</button>
             {(currentUser.cashflowRole !== 'ALL' || isAdmin) && (
                <button onClick={() => openTransactionForm()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-sm"><PlusCircle size={16}/> Catat</button>
             )}
          </div>
      </div>

      {/* 2. STATISTIK UTAMA (WARNA FIX) */}
      <div className={`grid gap-4 mb-6 ${isAdmin ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
        {isAdmin ? (
            <>
                <StatCard title="JASA MEDIS (JM)" val={globalStats.JM} color="bg-sky-500" icon={<Activity/>} showDetails={showDetails} setShowDetails={setShowDetails} />
                <StatCard title="UANG KAS" val={globalStats.KAS} color="bg-emerald-500" icon={<Wallet/>} showDetails={showDetails} setShowDetails={setShowDetails} />
                <StatCard title="UANG DOKTER" val={globalStats.DOKTER} color="bg-amber-500" icon={<Stethoscope/>} showDetails={showDetails} setShowDetails={setShowDetails} />
            </>
        ) : (
            <StatCard title={currentUser.cashflowLabel} val={globalStats[currentUser.cashflowRole]} color="bg-indigo-500" icon={<Wallet/>} fullWidth showDetails={showDetails} setShowDetails={setShowDetails} />
        )}
      </div>

      {/* 3. TABS MENU */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
         <div className="flex border-b border-slate-100 bg-gray-50 flex-shrink-0">
             {(currentUser.cashflowRole === 'KAS' || isAdmin) && (
                 <button onClick={() => setActiveTab('iuran')} className={`px-4 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'iuran' ? 'bg-white text-emerald-600 border-t-2 border-emerald-600' : 'text-slate-500 hover:bg-gray-100'}`}><Grid size={16}/> Kartu Iuran</button>
             )}
             <button onClick={() => setActiveTab('transaksi')} className={`px-4 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'transaksi' ? 'bg-white text-indigo-600 border-t-2 border-indigo-600' : 'text-slate-500 hover:bg-gray-100'}`}><Wallet size={16}/> Riwayat Transaksi</button>
             <button onClick={() => setActiveTab('pinjaman')} className={`px-4 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'pinjaman' ? 'bg-white text-orange-600 border-t-2 border-orange-600' : 'text-slate-500 hover:bg-gray-100'}`}><BookOpen size={16}/> Buku Pinjaman</button>
         </div>

         {/* === TAB TRANSAKSI (WARNA FIX) === */}
         {activeTab === 'transaksi' && (
             <div className="flex flex-col h-full">
                 
                 {/* B. TABEL FIXED HEADER (UPDATE: HIDE 1-PER-1) */}
                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        
                        <div className="bg-indigo-50 border-y border-indigo-100 p-2 flex justify-between items-center text-xs sticky top-0 z-20">
                            
                            {/* SISI KIRI: Judul Rekap & Tombol Lapor */}
                            <div className="flex items-center gap-3">
                                <div className="font-bold text-indigo-900 uppercase flex items-center gap-2">
                                    📊 Rekap {MONTHS[filterMonth]} {filterYear}
                                </div>
                                
                                {/* TOMBOL LAPOR WA */}
                                <button 
                                    onClick={handleWhatsAppReport}
                                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 shadow-sm transition"
                                >
                                    <span>📢</span> Lapor WA
                                </button>
                            </div>
                            
                            {/* SISI KANAN: KONTROL VISIBILITY INDIVIDU */}
                            <div className="flex gap-3 font-mono font-bold items-center">
                                <div className="flex items-center gap-1 cursor-pointer hover:bg-emerald-100 px-1 rounded transition select-none" onClick={() => toggleStat('income')}>
                                    <span className="text-emerald-700">IN:</span>
                                    <span className={`text-emerald-600 ${!statVisibility.income && 'tracking-widest'}`}>{statVisibility.income ? formatRupiah(monthlyStats.income) : '••••••'}</span>
                                    {statVisibility.income ? <Eye size={10} className="text-emerald-400"/> : <EyeOff size={10} className="text-emerald-400"/>}
                                </div>
                                <div className="flex items-center gap-1 cursor-pointer hover:bg-rose-100 px-1 rounded transition select-none" onClick={() => toggleStat('expense')}>
                                    <span className="text-rose-700">OUT:</span>
                                    <span className={`text-rose-600 ${!statVisibility.expense && 'tracking-widest'}`}>{statVisibility.expense ? formatRupiah(monthlyStats.expense) : '••••••'}</span>
                                    {statVisibility.expense ? <Eye size={10} className="text-rose-400"/> : <EyeOff size={10} className="text-rose-400"/>}
                                </div>
                                <div className="flex items-center gap-1 cursor-pointer bg-white border border-indigo-200 px-2 rounded hover:bg-indigo-50 transition select-none" onClick={() => toggleStat('net')}>
                                    <span className="text-indigo-800">NET:</span>
                                    <span className={`text-indigo-700 ${!statVisibility.net && 'tracking-widest'}`}>{statVisibility.net ? formatRupiah(monthlyStats.net) : '••••••'}</span>
                                    {statVisibility.net ? <Eye size={10} className="text-indigo-400"/> : <EyeOff size={10} className="text-indigo-400"/>}
                                </div>
                            </div>
                        </div>

                        {/* HEADER TABEL KOLOM */}
                        <div className="bg-gray-100 text-gray-600 text-xs font-bold uppercase border-b border-gray-200 flex pr-4"> 
                            <div className="p-3 w-[100px] flex items-center gap-1 cursor-pointer hover:bg-gray-200 transition" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>Tgl <ArrowUpDown size={10}/></div>
                            <div className="p-3 flex-1">Uraian</div>
                            <div className="p-3 w-[110px] text-right text-emerald-700">Masuk</div>
                            <div className="p-3 w-[110px] text-right text-rose-700">Keluar</div>
                            <div className="p-3 w-[120px] text-right text-indigo-900">Saldo</div>
                            <div className="p-3 w-[60px] text-center">#</div>
                        </div>

                        {/* ISI TABEL */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                            {ledgerData.length === 0 ? (
                                <div className="text-center p-10 text-gray-400 italic text-xs">Belum ada transaksi di periode ini.</div>
                            ) : (
                                ledgerData.map((t) => (
                                    <div key={t.id} className="flex text-xs border-b border-gray-100 hover:bg-indigo-50/30 transition-colors items-center">
                                        <div className="p-3 w-[100px] font-mono text-slate-500">{formatDateID(t.date)}</div>
                                        <div className="p-3 flex-1 font-medium text-slate-700">
                                            {t.description} 
                                            {t.isIuran && <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded ml-2 font-bold">IURAN</span>}
                                            {isAdmin && <span className="text-[9px] text-gray-400 ml-1">({t.category})</span>}
                                        </div>
                                        <div className="p-3 w-[110px] text-right font-medium text-emerald-600 bg-emerald-50/10">
                                            {t.type === 'IN' ? formatRupiah(t.amount) : '-'}
                                        </div>
                                        <div className="p-3 w-[110px] text-right font-medium text-rose-600 bg-rose-50/10">
                                            {t.type === 'OUT' ? formatRupiah(t.amount) : '-'}
                                        </div>
                                        <div className="p-3 w-[120px] text-right font-bold text-indigo-800 bg-indigo-50/20">
                                            {formatRupiah(t.currentBalance)}
                                        </div>
                                        <div className="p-3 w-[60px] text-center flex justify-center gap-1">
                                            {!t.isIuran && (
                                                <>
                                                <button onClick={() => openTransactionForm(t)} className="text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                                                <button onClick={() => setDeleteModalData({id: t.id, type: 'transaction'})} className="text-slate-400 hover:text-rose-600"><Trash2 size={12}/></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            
                            <div className="p-8 flex justify-center">
                                <button onClick={handleResetData} className="text-[10px] text-gray-300 flex items-center gap-1 hover:text-red-400 transition" title="Hapus semua data di browser ini">
                                    <Trash2 size={12}/> Reset Data Local
                                </button>
                            </div>
                        </div>
                    </div>

                 {/* A. GRAFIK BATANG BERTUMPUK DENGAN GARIS TREND */}
                 <div className="p-4 border-t border-slate-100 bg-white flex-shrink-0">
                     {/* CHART TITLE & CONTROL BUTTONS */}
                     <div className="flex gap-2 mb-4 items-center justify-between">
                         <h3 className="text-sm font-bold text-slate-700">📊 Perbandingan {MONTHS[filterMonth]} vs {MONTHS[filterMonth === 0 ? 11 : filterMonth - 1]}</h3>
                         <div className="flex gap-2 items-center">
                             <button
                                 onClick={() => setShowBarChart(!showBarChart)}
                                 className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border ${
                                     showBarChart
                                         ? 'bg-indigo-600 border-indigo-600 text-white'
                                         : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                 }`}
                             >
                                 {showBarChart ? '✓' : '○'} Batang
                             </button>
                             <button
                                 onClick={() => setShowTrendLine(!showTrendLine)}
                                 className={`px-3 py-1.5 text-xs font-bold rounded-lg transition border ${
                                     showTrendLine
                                         ? 'bg-emerald-600 border-emerald-600 text-white'
                                         : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                                 }`}
                             >
                                 {showTrendLine ? '✓' : '○'} Trend
                             </button>
                         </div>
                     </div>

                     {/* CHART CONTENT */}
                     <div className="h-64">
                         {!showBarChart && !showTrendLine ? (
                             <div className="flex items-center justify-center h-full text-slate-400 italic text-sm">
                                 Pilih Batang atau Trend untuk menampilkan diagram
                             </div>
                         ) : (
                             <ResponsiveContainer width="100%" height="100%">
                                 <ComposedChart data={monthlyComparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                                     <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false}/>
                                     <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`}/>
                                     <Tooltip formatter={(value) => formatRupiah(value)} cursor={{fill: '#f1f5f9'}}/>
                                     <Legend wrapperStyle={{fontSize:'10px', paddingTop:'10px'}}/>
                                     
                                     {/* BATANG BERTUMPUK */}
                                     {showBarChart && (
                                         <>
                                             <Bar dataKey="Masuk" stackId="a" fill="#10b981" name="Uang Masuk" />
                                             <Bar dataKey="Keluar" stackId="a" fill="#f43f5e" name="Uang Keluar" />
                                             <Bar dataKey="Saldo" stackId="a" fill="#6366f1" name="Saldo Akhir" />
                                         </>
                                     )}
                                     
                                     {/* GARIS TREND (SHOW/HIDE) - WARNA LEBIH DARK/TEGAS */}
                                     {showTrendLine && (
                                         <>
                                             <Line type="monotone" dataKey="Masuk" stroke="#059669" strokeWidth={3} strokeDasharray="5 5" dot={{fill: '#059669', r: 5}} name="Trend Masuk" isAnimationActive={true} />
                                             <Line type="monotone" dataKey="Keluar" stroke="#be123c" strokeWidth={3} strokeDasharray="5 5" dot={{fill: '#be123c', r: 5}} name="Trend Keluar" isAnimationActive={true} />
                                             <Line type="monotone" dataKey="Saldo" stroke="#1e40af" strokeWidth={3} strokeDasharray="5 5" dot={{fill: '#1e40af', r: 5}} name="Trend Saldo" isAnimationActive={true} />
                                         </>
                                     )}
                                 </ComposedChart>
                             </ResponsiveContainer>
                         )}
                     </div>
                 </div>
             </div>
         )}

         {/* --- TAB IURAN --- */}
         {activeTab === 'iuran' && (
             <div className="overflow-x-auto pb-4 p-4">
               <div className="p-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs flex justify-between items-center mb-2 rounded">
                   <span><strong>Tahun:</strong> {filterYear}</span>
                   <button onClick={() => setAddMemberModalOpen(true)} className="flex items-center text-[10px] bg-white border border-emerald-300 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-100"><UserPlus size={12} className="mr-1"/> Anggota</button>
               </div>
               <table className="w-full text-sm border-collapse">
                 <thead>
                   <tr>
                     <th className="p-3 text-left sticky left-0 bg-white z-10 border-b border-r shadow-sm min-w-[150px]">Nama Anggota</th>
                     {MONTHS.map(m => <th key={m} className="p-3 text-center min-w-[50px] border-b bg-slate-50 text-slate-500 font-medium text-xs">{m}</th>)}
                   </tr>
                 </thead>
                 <tbody>
                   {membersList && membersList.map((member, idx) => (
                     <tr key={member.id} className={`hover:bg-slate-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                       <td className="p-3 border-r sticky left-0 bg-white z-10 shadow-sm font-medium text-slate-700 group flex justify-between items-center">
                           <span>{member.name}</span>
                       </td>
                       {MONTHS.map(month => {
                         const isPaid = duesMatrix[member.id] ? duesMatrix[member.id][month] : null;
                         return (
                           <td key={month} className="p-2 text-center border-b border-slate-100">
                               <button onClick={() => toggleIuran(member, month)} className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-all ${isPaid ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                                 {isPaid ? <CheckCircle size={14} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>}
                               </button>
                           </td>
                         );
                       })}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
         )}

         {/* --- TAB PINJAMAN --- */}
         {activeTab === 'pinjaman' && (
             <div className="p-6 bg-slate-50 h-full">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700">Daftar Pinjaman Aktif</h3>
                     {(currentUser.cashflowRole !== 'ALL' || isAdmin) && (
                        <button onClick={openLoanForm} className="text-xs bg-indigo-600 text-white px-3 py-2 rounded font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1"><PlusCircle size={14}/> Pinjam</button>
                     )}
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLoans.length === 0 ? <div className="col-span-full text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Tidak ada data pinjaman aktif.</div> : 
                      filteredLoans.map(loan => {
                        const remaining = loan.amount - loan.paidAmount;
                        const isLunas = remaining <= 0;
                        // FIX: Logic Tombol Hapus (Admin ATAU Pemilik Kategori)
                        const canDelete = isAdmin || currentUser.cashflowRole === loan.category;
                        return (
                          <div key={loan.id} className={`border rounded-xl p-4 relative overflow-hidden bg-white transition hover:shadow-md ${isLunas ? 'border-slate-200 opacity-80' : 'border-indigo-100'}`}>
                            {/* TOMBOL HAPUS PINJAMAN (DIPERBAIKI) */}
                            {canDelete && (
                                <button onClick={() => handleDeleteLoan(loan)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition"><Trash2 size={16}/></button>
                            )}
                            <div className="flex flex-col mb-3 pr-8">
                                <h4 className="font-bold text-slate-800 text-lg">{loan.borrower}</h4>
                                <span className="text-xs text-slate-400">{formatDateID(loan.date)} {isAdmin && <span className="bg-slate-100 px-1 rounded ml-1 text-[10px]">{loan.category}</span>}</span>
                                <span className="text-xs text-slate-500 italic mt-1 bg-slate-100 px-2 py-1 rounded w-fit">"{loan.notes || '-'}"</span>
                            </div>
                            <div className="space-y-2 mb-4 text-sm">
                                <div className="flex justify-between border-b border-dashed pb-2"><span className="text-slate-500">Status</span><span className={`text-xs font-bold px-2 py-0.5 rounded ${isLunas ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isLunas ? 'LUNAS' : 'BELUM'}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Pinjam</span><span className="font-medium">{formatRupiah(loan.amount)}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Bayar</span><span className="font-medium text-emerald-600">{formatRupiah(loan.paidAmount)}</span></div>
                                <div className="flex justify-between pt-2 border-t"><span className="font-bold text-slate-600">Sisa</span><span className="font-bold text-rose-600">{formatRupiah(remaining)}</span></div>
                            </div>
                            <div className="flex gap-2">
                                {!isLunas && (
                                    <>
                                    {/* TOMBOL TAGIH WA (BARU) */}
                                    <button 
                                        onClick={() => handleWhatsAppTagihan(loan)} 
                                        className="flex-1 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-medium rounded-lg text-sm transition flex items-center justify-center gap-1 border border-emerald-100"
                                    >
                                        <span>💬</span> Tagih
                                    </button>
                                    
                                    {/* TOMBOL BAYAR CICILAN */}
                                    <button 
                                        onClick={() => { setSelectedLoan(loan); setRepayForm({ amount: '', date: new Date().toISOString().split('T')[0] }); setView('pay-loan'); }} 
                                        className="flex-1 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 font-medium rounded-lg text-sm transition border border-indigo-100"
                                    >
                                        Bayar
                                    </button>
                                    </>
                                )}
                                
                                {/* TOMBOL RIWAYAT */}
                                {loan.history && loan.history.length > 0 && (
                                    <button 
                                        onClick={() => setHistoryModalData(loan)} 
                                        className="flex-1 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-700 font-medium rounded-lg text-sm transition flex items-center justify-center gap-1 border border-slate-200"
                                    >
                                        <History size={14}/> Riwayat
                                    </button>
                                )}
                            </div>
                          </div>
                        );
                      })
                    }
                 </div>
             </div>
         )}
      </div>

      {/* --- MODALS (FORM INPUT, IURAN, ETC) --- */}
      
      {view === 'form' && (
          <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-sm p-4 flex items-center justify-center">
              <div className="bg-white p-6 rounded-xl shadow-2xl border border-teal-100 max-w-lg w-full animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">{editingId ? 'Edit Transaksi' : 'Catat Transaksi'}</h3><button onClick={() => setView('dashboard')}><X/></button></div>
                  <form onSubmit={handleTransactionSubmit} className="space-y-4">
                      {isAdmin && (
                          <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kategori</label>
                              <select className="w-full p-2 border rounded-lg text-sm bg-gray-50" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                  <option value="JM">Jasa Medis (JM)</option><option value="KAS">Uang Kas</option><option value="DOKTER">Uang Dokter</option>
                              </select>
                          </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setFormData({...formData, type: 'IN'})} className={`p-3 border rounded-lg flex items-center justify-center gap-2 font-bold ${formData.type === 'IN' ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'bg-slate-50'}`}><TrendingUp size={16}/> Pemasukan</button>
                          <button type="button" onClick={() => setFormData({...formData, type: 'OUT'})} className={`p-3 border rounded-lg flex items-center justify-center gap-2 font-bold ${formData.type === 'OUT' ? 'bg-rose-100 border-rose-500 text-rose-800' : 'bg-slate-50'}`}><TrendingDown size={16}/> Pengeluaran</button>
                      </div>
                      <input type="date" className="w-full p-3 border rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                      <input type="text" placeholder="Keterangan..." className="w-full p-3 border rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                      {/* FIX NaN: Gunakan value terformat untuk display */}
                      <input type="text" placeholder="Nominal (Rp)..." className="w-full p-3 border rounded-lg font-bold" value={formatNumberInput(formData.amount)} onChange={e => setFormData({...formData, amount: parseNumberInput(e.target.value)})} required />
                      <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-md">Simpan Transaksi</button>
                  </form>
              </div>
          </div>
      )}

      {/* 2. Loan Form */}
      {view === 'loan-form' && (
          <div className="fixed inset-0 z-50 bg-slate-100 p-4 flex items-center justify-center">
              <div className="bg-white p-6 rounded-xl shadow-lg max-w-lg w-full">
                  <div className="flex justify-between items-center mb-4 text-indigo-800"><h3 className="font-bold text-lg flex items-center gap-2"><BookOpen size={20}/> Catat Pinjaman Baru</h3><button onClick={() => { setView('dashboard'); setActiveTab('pinjaman'); }}><X/></button></div>
                  <form onSubmit={submitLoan} className="space-y-4">
                      {isAdmin && (
                          <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sumber Dana</label>
                              <select className="w-full p-2 border rounded-lg text-sm bg-gray-50" value={loanFormData.category} onChange={e => setLoanFormData({...loanFormData, category: e.target.value})}>
                                  <option value="JM">Jasa Medis (JM)</option><option value="KAS">Uang Kas</option><option value="DOKTER">Uang Dokter</option>
                              </select>
                          </div>
                      )}
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Peminjam</label><input type="text" className="w-full p-3 border rounded-lg" placeholder="Nama..." value={loanFormData.borrower} onChange={e => setLoanFormData({...loanFormData, borrower: e.target.value})} required /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Jumlah Pinjam</label><input type="text" className="w-full p-3 border rounded-lg font-bold" placeholder="Rp..." value={formatNumberInput(loanFormData.amount)} onChange={e => setLoanFormData({...loanFormData, amount: parseNumberInput(e.target.value)})} required /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Tanggal</label><input type="date" className="w-full p-3 border rounded-lg" value={loanFormData.date} onChange={e => setLoanFormData({...loanFormData, date: e.target.value})} required /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Catatan</label><textarea className="w-full p-3 border rounded-lg" placeholder="Keperluan..." value={loanFormData.notes} onChange={e => setLoanFormData({...loanFormData, notes: e.target.value})} rows={2} /></div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-md">Simpan Pinjaman</button>
                  </form>
              </div>
          </div>
      )}

      {/* 3. Pay Loan Form */}
      {view === 'pay-loan' && selectedLoan && (
          <div className="fixed inset-0 z-50 bg-slate-100 p-4 flex items-center justify-center">
              <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full">
                  <div className="flex justify-between items-center mb-4 text-teal-800"><h3 className="font-bold text-lg flex items-center gap-2"><Wallet size={20}/> Bayar Cicilan</h3><button onClick={() => { setView('dashboard'); setActiveTab('pinjaman'); }}><X/></button></div>
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm text-slate-500">Peminjam</div><div className="font-bold text-lg text-slate-800">{selectedLoan.borrower}</div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-200"><span className="text-sm text-slate-500">Sisa Hutang:</span><span className="font-bold text-rose-600">{formatRupiah(selectedLoan.amount - selectedLoan.paidAmount)}</span></div>
                  </div>
                  <form onSubmit={submitRepayment} className="space-y-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Tanggal Bayar</label><input type="date" className="w-full p-3 border rounded-lg" value={repayForm.date} onChange={e => setRepayForm({...repayForm, date: e.target.value})} required /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Jumlah Bayar</label><input type="text" className="w-full p-3 border rounded-lg font-bold text-teal-700" value={formatNumberInput(repayForm.amount)} onChange={e => setRepayForm({...repayForm, amount: parseNumberInput(e.target.value)})} required /></div>
                      <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700">Terima Pembayaran</button>
                  </form>
              </div>
          </div>
      )}

      {/* 4. History Modal (Cicilan) */}
      {historyModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                  <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><History size={20}/> Riwayat Pembayaran</h3>
                      <button onClick={() => setHistoryModalData(null)}><X size={20}/></button>
                  </div>
                  <div className="p-4 max-h-80 overflow-y-auto">
                      {historyModalData.history.length === 0 ? <p className="text-center text-slate-400 italic text-sm">Belum ada pembayaran.</p> : 
                        historyModalData.history.map((h, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 mb-2">
                                <div className="text-sm font-medium text-slate-600 flex items-center gap-2"><Calendar size={14}/> {formatDateID(h.date)}</div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-teal-600">{formatRupiah(h.amount)}</span>
                                    <button onClick={() => setEditRepaymentData({ loan: historyModalData, historyItem: h, date: h.date, amount: h.amount })} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={12}/></button>
                                    <button onClick={() => deleteRepaymentFromHistory(h)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={12}/></button>
                                </div>
                            </div>
                        ))
                      }
                  </div>
              </div>
          </div>
      )}

      {/* 5. Edit Repayment Modal */}
      {editRepaymentData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Cicilan</h3>
                  <form onSubmit={handleEditRepaymentSubmit}>
                      <div className="mb-4">
                          <label className="text-xs font-bold text-slate-500 uppercase">Tanggal</label>
                          <input type="date" className="w-full p-2 border rounded" value={editRepaymentData.date} onChange={e => setEditRepaymentData({...editRepaymentData, date: e.target.value})} />
                      </div>
                      <div className="mb-4">
                          <label className="text-xs font-bold text-slate-500 uppercase">Nominal</label>
                          <input type="text" className="w-full p-2 border rounded font-bold" value={formatNumberInput(editRepaymentData.amount)} onChange={e => setEditRepaymentData({...editRepaymentData, amount: parseNumberInput(e.target.value)})} />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Simpan Perubahan</button>
                      <button type="button" onClick={() => setEditRepaymentData(null)} className="w-full py-2 text-slate-500 mt-2">Batal</button>
                  </form>
              </div>
          </div>
      )}

      {/* 6. Iuran Modal */}
      {iuranModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">{iuranModalData.transId ? 'Edit Iuran' : 'Bayar Iuran'}</h3>
                  <p className="text-sm text-slate-500 mb-4">{iuranModalData.member?.name} - {iuranModalData.month}</p>
                  <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tanggal Bayar</label>
                      <input type="date" className="w-full p-3 border rounded-lg" value={iuranModalData.date} onChange={(e) => setIuranModalData({...iuranModalData, date: e.target.value})} />
                  </div>
                  <button onClick={handleSaveIuran} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-lg mb-2">Simpan Lunas</button>
                  {iuranModalData.transId ? (
                      <button onClick={handleDeleteIuran} className="w-full py-2.5 border border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50">Batalkan (Belum Lunas)</button>
                  ) : (
                      <button onClick={() => setIuranModalData(null)} className="w-full py-2.5 text-slate-500 font-bold">Tutup</button>
                  )}
              </div>
          </div>
      )}

      {/* 7. Delete Confirmation */}
      {deleteModalData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-xs w-full p-6 text-center">
                  <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 mx-auto"><Trash2/></div>
                  <h3 className="font-bold text-lg">Hapus Data?</h3>
                  <div className="flex gap-2 mt-4">
                      <button onClick={() => setDeleteModalData(null)} className="flex-1 py-2 bg-slate-100 rounded">Batal</button>
                      <button onClick={deleteTrans} className="flex-1 py-2 bg-rose-600 text-white rounded font-bold">Hapus</button>
                  </div>
              </div>
          </div>
      )}
      
      {/* 8. Add Member Modal */}
      {addMemberModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
                  <h3 className="font-bold text-lg mb-4">Tambah Anggota Baru</h3>
                  <input type="text" autoFocus placeholder="Nama..." className="w-full p-2 border rounded mb-4" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} />
                  <div className="flex gap-2">
                      <button onClick={() => setAddMemberModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded">Batal</button>
                      <button onClick={handleAddMember} className="flex-1 py-2 bg-emerald-600 text-white rounded font-bold">Simpan</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

// Sub Component Kecil (DENGAN TOGGLE MATA & WARNA FIX)
function StatCard({ title, val, color, icon, fullWidth, showDetails, setShowDetails }) {
    return (
        <div className={`bg-white p-4 rounded-xl shadow-sm border border-l-4 ${color.replace('bg-', 'border-')} ${fullWidth ? 'col-span-full' : ''}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-500 text-xs uppercase font-bold">{title}</span>
                <div className={`p-1.5 rounded text-white ${color}`}>{icon}</div>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl font-bold text-indigo-700">{formatRupiah(val.balance)}</div>
                
                <button onClick={() => setShowDetails(!showDetails)} className="text-slate-400 hover:text-slate-600">
                    {showDetails ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
            </div>

            {showDetails ? (
                <div className="flex gap-3 text-xs animate-in fade-in slide-in-from-top-1">
                    <span className="text-emerald-600 flex items-center bg-emerald-50 px-2 py-1 rounded"><TrendingUp size={12} className="mr-1"/> {formatRupiah(val.income)}</span>
                    <span className="text-rose-600 flex items-center bg-rose-50 px-2 py-1 rounded"><TrendingDown size={12} className="mr-1"/> {formatRupiah(val.expense)}</span>
                </div>
            ) : (
                <div className="text-[10px] text-slate-400 italic">Rincian disembunyikan</div>
            )}
        </div>
    )
}