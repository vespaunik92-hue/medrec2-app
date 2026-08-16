import { useMemo } from 'react';
// Ambil data cetak biru kamar bawaan dari constants
import { LEFT_ROOMS, RIGHT_ROOMS } from '../constants'; 

const RoomMap = ({ roomList, leftRooms, rightRooms, activeRecords, onSelectRoom, onEditRoom, roomFilter, waitingList, onSwapBed }) => {

    // ✨ LOGIKA BARU MOBILE: Selang-seling Kiri & Kanan agar Kolom Kiri = Sisi Kiri, Kolom Kanan = Sisi Kanan
    const mobileRoomList = useMemo(() => {
        const left = leftRooms || LEFT_ROOMS;
        const right = rightRooms || RIGHT_ROOMS;
        const combined = [];
        const maxLength = Math.max(left.length, right.length);

        for (let i = 0; i < maxLength; i++) {
            if (i < left.length) combined.push(left[i]);
            if (i < right.length) combined.push(right[i]);
        }
        return combined;
    }, [leftRooms, rightRooms]);

    const renderRoom = (roomNumber) => {
        const record = activeRecords.find(r => r.roomNumber === roomNumber);
        const booked = waitingList?.find(w => w.plannedRoom === roomNumber);
        const isHidden = roomFilter.length !== roomList.length && !roomFilter.includes(roomNumber);

        if (isHidden) return null;

        // Logika Status & Warna Sisa Bed
        let statusText = 'Kosong';
        let statusColor = 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100';

        // ✨ SENSOR TETANGGA: Menyesuaikan deteksi tetangga kasur format KM dan P
        const match = roomNumber.match(/^(K\d+)(KM|P)$/);
        if (!record && !booked && match) {
            const roomCode = match[1];
            const neighborBed = match[2] === 'KM' ? 'P' : 'KM';
            const neighborRoom = `${roomCode}${neighborBed}`;
            const neighborRecord = activeRecords.find(r => r.roomNumber === neighborRoom);
            if (neighborRecord) {
                if (neighborRecord.gender === 'L') {
                    statusText = 'Sisa Lk';
                    statusColor = 'bg-sky-100 border-sky-400 text-sky-800 hover:bg-sky-200';
                } else {
                    statusText = 'Sisa Pr';
                    statusColor = 'bg-purple-100 border-purple-400 text-purple-800 hover:bg-purple-200';
                }
            }
        }

        // 1. RENDER: TERISI (PASIEN)
        if (record) {
            const isMale = record.gender === 'L';

            // 🕒 DETEKSI HARI INI (Bahasa Indonesia: 'senin', 'selasa', dll)
            const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

            // 🤖 SENSOR UTAMA
            const gabunganTeksSOAP = `${record.diagnosis || ''} ${record.analysis || ''} ${record.planning || ''}`.toLowerCase();

            // 🛑 PENGECUALIAN 1: Status Suspek/DD (Tn. Tatang)
            const statusProvisional = gabunganTeksSOAP.includes('dd ckd') || gabunganTeksSOAP.includes('susp ckd') || gabunganTeksSOAP.includes('susp. ckd') || gabunganTeksSOAP.includes('dd hd') || gabunganTeksSOAP.includes('aki dd');

            // 🛑 PENGECUALIAN 2: Pasien Menolak Tindakan (Saran Mandor Abi untuk Bu Marsem)
            const statusMenolak = gabunganTeksSOAP.includes('menolak') || gabunganTeksSOAP.includes('tolak') || gabunganTeksSOAP.includes('tidak mau') || gabunganTeksSOAP.includes('belum bersedia');

            // ✨ EKSEKUSI SENSOR: Balon HD dilarang muncul jika pasien berstatus Suspek ATAU Menolak!
            const isHD = /hd|ckd|hemodialisa/i.test(gabunganTeksSOAP) && !statusProvisional && !statusMenolak;

            // =========================================================================
            // ⚡ MESIN SENSOR HD MULTI-KATEGORI
            // =========================================================================
            let isHDMenyalaHariIni = false;
            let shouldBlinkBorder = false;
            let hdLabel = 'HD';
            let balloonColor = 'bg-rose-600';
            let arrowColor = 'border-t-rose-600';

            if (isHD) {
                if (gabunganTeksSOAP.includes('extra') || gabunganTeksSOAP.includes('ekstra') || gabunganTeksSOAP.includes('cito')) {
                    isHDMenyalaHariIni = true;
                    shouldBlinkBorder = true;
                    hdLabel = 'HD Extra';
                    balloonColor = 'bg-red-600';
                    arrowColor = 'border-t-red-600';
                } else if (gabunganTeksSOAP.includes('inisiasi')) {
                    isHDMenyalaHariIni = true;
                    shouldBlinkBorder = true;
                    hdLabel = 'HD Inisiasi';
                    balloonColor = 'bg-purple-600';
                    arrowColor = 'border-t-purple-600';
                } else if (gabunganTeksSOAP.includes('edukasi')) {
                    isHDMenyalaHariIni = true;
                    shouldBlinkBorder = false;
                    hdLabel = 'Edukasi HD';
                    balloonColor = 'bg-amber-500';
                    arrowColor = 'border-t-amber-500';
                } else {
                    let isJadwalCocok = false;
                    if (gabunganTeksSOAP.includes('senin-kamis') || gabunganTeksSOAP.includes('senin kamis')) {
                        isJadwalCocok = ['senin', 'kamis'].includes(hariIni);
                    } else if (gabunganTeksSOAP.includes('selasa-jumat') || gabunganTeksSOAP.includes('selasa jumat')) {
                        isJadwalCocok = ['selasa', 'jumat'].includes(hariIni);
                    } else if (gabunganTeksSOAP.includes('rabu-sabtu') || gabunganTeksSOAP.includes('rabu sabtu')) {
                        isJadwalCocok = ['rabu', 'sabtu'].includes(hariIni);
                    } else {
                        isJadwalCocok = true;
                    }

                    if (isJadwalCocok) {
                        isHDMenyalaHariIni = true;
                        shouldBlinkBorder = true;
                        hdLabel = 'HD';
                        balloonColor = 'bg-rose-600';
                        arrowColor = 'border-t-rose-600';
                    }
                }
            }

            // 👨‍⚕️ SUNTIKAN OTOMATIS dr. Edi di Layar
            let raberArray = [record.raberName, record.raber2Name].filter(Boolean);
            if (isHD && !raberArray.some(r => r.toLowerCase().includes('edi'))) {
                raberArray.push('dr. Edi');
            }
            const raberTextDisplay = raberArray.join(', ');

            return (
                <div
                    key={roomNumber}
                    onClick={() => onEditRoom(record)}
                    className={`relative flex flex-col p-1.5 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${shouldBlinkBorder
                        ? 'animate-border-hd border-[2.5px] shadow-md ring-2 ring-slate-950/5'
                        : (isMale ? 'border-blue-400 shadow-sm' : 'border-rose-400 shadow-sm')
                        } ${isMale ? 'bg-blue-200' : 'bg-rose-100'}`}
                >
                    {isHDMenyalaHariIni && (
                        <div className="absolute -top-3 -right-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md flex items-center gap-1 z-30 animate-in zoom-in-95 duration-200 uppercase tracking-tight" style={{ backgroundColor: balloonColor }}>
                            <svg className="w-2.5 h-2.5 fill-current text-white animate-pulse shrink-0" viewBox="0 0 24 24">
                                <path d="M12 2c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 17.2c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l.59-.59C7.93 19.26 9.88 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                            </svg>
                            {hdLabel}
                            <div className="absolute -bottom-[5px] right-2.5 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent drop-shadow-sm" style={{ borderTopColor: arrowColor }}></div>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-0.5 border-b border-white/60 pb-0.5">
                        <span className={`font-extrabold text-[11px] ${shouldBlinkBorder ? 'text-slate-950 font-black' : (isMale ? 'text-blue-900' : 'text-rose-900')}`}>
                            {roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2')}
                        </span>

                        <div className="flex gap-1 items-center">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSwapBed) onSwapBed(record);
                                }}
                                className="text-[9px] bg-white/60 hover:bg-white/90 rounded px-1 shadow-sm transition cursor-pointer"
                                title="Tukar Bed">
                                🔀
                            </button>
                            <span className="text-[9px] bg-white/50 rounded px-1">{isMale ? '🚹' : '🚺'}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <span className="font-bold text-xs text-gray-800 leading-none truncate mb-0.5">{record.name}</span>
                        <span className="text-[9px] text-gray-600 font-medium truncate">{record.dpjpName}</span>
                        {raberArray.length > 0 && (
                            <span className="text-[7px] bg-yellow-200 text-yellow-800 px-1 rounded w-fit mt-0.5">Raber: {raberTextDisplay}</span>
                        )}
                    </div>
                </div>
            );
        }

        // 2. RENDER: DIBOOKING (WAITING LIST)
        if (booked) {
            return (
                <div key={roomNumber} className="relative flex flex-col p-1.5 rounded-lg border-2 bg-yellow-50 border-yellow-400 shadow-sm cursor-not-allowed opacity-90 animate-pulse">
                    <div className="flex justify-between items-center mb-0.5 border-b border-yellow-300 pb-0.5">
                        <span className="font-extrabold text-[11px] text-yellow-900">{roomNumber}</span>
                        <span className="text-[9px]">⏳</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <span className="font-bold text-[10px] text-yellow-800 leading-tight">Dipesan a.n</span>
                        <span className="text-[9px] text-yellow-900 font-medium truncate w-full">{booked.name}</span>
                    </div>
                </div>
            );
        }

        // 3. RENDER: KOSONG / SISA BED
        return (
            <div key={roomNumber} onClick={() => onSelectRoom(roomNumber)} className={`relative flex flex-col items-center justify-center p-1 rounded-lg border-2 border-dashed cursor-pointer transition-all ${statusColor}`}>
                <span className="font-extrabold text-[11px] mb-0.5">{roomNumber.replace(/^(K\d+)(KM|P)$/, '$1 • $2')}</span>
                <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-white/80 shadow-sm">{statusText}</span>
            </div>
        );
    };

    return (
        <div className="flex justify-center w-full px-1 py-1">
            <div className="w-full max-w-5xl">
                {/* MOBILE VIEW */}
                <div className="grid grid-cols-2 gap-1.5 mb-2 md:hidden bg-white p-1.5 rounded-xl shadow-inner border border-gray-100">
                    {mobileRoomList.map(renderRoom)}
                </div>

                {/* DESKTOP/TABLET VIEW */}
                <div className="hidden md:flex w-full gap-2 md:gap-3 bg-white p-1.5 rounded-xl shadow-inner border border-gray-100 justify-center">
                    <div className={`grid ${(leftRooms || LEFT_ROOMS).length <= 5 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 w-full`}>
                        {(leftRooms || LEFT_ROOMS).map(renderRoom)}
                    </div>

                    <div className="hidden md:flex flex-col justify-center items-center w-6 bg-gray-100 rounded-full border border-gray-200 shadow-inner relative flex-shrink-0">
                        <div className="absolute top-10 text-gray-300 text-[9px] font-bold tracking-[0.3em]" style={{ writingMode: 'vertical-rl' }}>LORONG</div>
                    </div>

                    <div className={`grid ${(rightRooms || RIGHT_ROOMS).length <= 5 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 w-full`}>
                        {(rightRooms || RIGHT_ROOMS).map(renderRoom)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoomMap;