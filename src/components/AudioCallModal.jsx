import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Phone,
    PhoneOff,
    Mic,
    MicOff,
    Video,
    VideoOff,
    RefreshCw,
    Volume2,
    VolumeX,
    User,
    Activity,
    Radio,
    Clock,
    AlertCircle,
    ShieldAlert,
    Hospital,
    Camera
} from 'lucide-react';
import {
    startCall,
    answerCall,
    cancelCall,
    endCall,
    rejectCall,
    setStreamMuted,
    setCameraEnabled,
    switchCamera,
    stopMediaStream,
    startIncomingRingtone,
    startOutgoingRingbackTone,
    playCallBeep,
    missedCall
} from '../services/webrtcService';

/**
 * 🎙️📹 MODAL INTERKOM PANGGILAN SUARA & VIDEO KLINIS
 */
export const AudioCallModal = ({
    db,
    appId,
    currentUser,
    session, // { callId, callType, isIncoming, callData, initialTarget, initialPatient }
    onClose
}) => {
    const isIncoming = session?.isIncoming || false;
    const callType = session?.callType || session?.callData?.callType || 'audio';
    const isVideoCall = callType === 'video';

    const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'calling');
    // callStatus: 'calling' | 'ringing' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'cancelled' | 'busy' | 'error'
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [facingMode, setFacingMode] = useState('user');
    const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
    const [durationSeconds, setDurationSeconds] = useState(0);
    const [errorMessage, setErrorMessage] = useState(null);
    const [callData, setCallData] = useState(session?.callData || null);

    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const activeCallHandleRef = useRef(null);
    const callIdRef = useRef(session?.callId || null);
    const remoteAudioRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localVideoRef = useRef(null);
    const ringtoneControllerRef = useRef(null);
    const timerIntervalRef = useRef(null);

    // 🛡️ Ref pelacak status terkini agar cleanup tidak menimpa status 'ended' menjadi 'cancelled'
    const callStatusRef = useRef(isIncoming ? 'incoming' : 'calling');

    useEffect(() => {
        callStatusRef.current = callStatus;

        // 📹 Pasang ulang stream ke elemen <video> begitu status 'connected' (Mencegah Video Hitam)
        if (callStatus === 'connected' && isVideoCall) {
            if (remoteVideoRef.current && remoteStreamRef.current) {
                if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
                    remoteVideoRef.current.srcObject = remoteStreamRef.current;
                }
                remoteVideoRef.current.play().catch(() => { });
            }
            if (localVideoRef.current && localStreamRef.current) {
                if (localVideoRef.current.srcObject !== localStreamRef.current) {
                    localVideoRef.current.srcObject = localStreamRef.current;
                }
            }
        }
    }, [callStatus, isVideoCall]);

    // Dapatkan data pihak lawan bicara & pasien
    const counterpart = isIncoming
        ? (callData?.caller || { name: 'Rekan Medis', role: 'Perawat' })
        : (session?.initialTarget || { name: 'Rekan Medis', role: 'Dokter' });

    const patientInfo = isIncoming
        ? (callData?.patient || {})
        : (session?.initialPatient || {});

    // ========================================================================
    // ⏱️ TIMER DURASI PANGGILAN
    // ========================================================================
    useEffect(() => {
        if (callStatus === 'connected') {
            timerIntervalRef.current = setInterval(() => {
                setDurationSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        }
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [callStatus]);

    const formatDuration = (totalSec) => {
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // ========================================================================
    // 🎵 NADA DERING & SOUND EFFECTS SIKLUS HIDUP PANGGILAN
    // ========================================================================
    useEffect(() => {
        if (callStatus === 'incoming') {
            // Putar nada dering klinis untuk panggilan masuk
            ringtoneControllerRef.current = startIncomingRingtone();
        } else if (callStatus === 'calling' || callStatus === 'ringing') {
            // Putar nada panggil keluar
            if (!ringtoneControllerRef.current) {
                ringtoneControllerRef.current = startOutgoingRingbackTone();
            }
        } else {
            // Matikan nada dering saat tersambung / selesai / dibatalkan
            if (ringtoneControllerRef.current) {
                ringtoneControllerRef.current.stop();
                ringtoneControllerRef.current = null;
            }
        }

        return () => {
            if (ringtoneControllerRef.current) {
                ringtoneControllerRef.current.stop();
                ringtoneControllerRef.current = null;
            }
        };
    }, [callStatus]);

    // ========================================================================
    // 🚀 INISIALISASI PANGGILAN KELUAR (OUTGOING)
    // ========================================================================
    useEffect(() => {
        if (!isIncoming) {
            let isCancelled = false;

            const initiateOutgoingCall = async () => {
                try {
                    setCallStatus('calling');
                    const handle = await startCall({
                        db,
                        appId,
                        callType,
                        callerUser: currentUser,
                        targetUser: session.initialTarget,
                        patientInfo: session.initialPatient,
                        onCallCreated: (createdId) => {
                            callIdRef.current = createdId;
                            if (isCancelled) {
                                cancelCall(db, appId, createdId).catch(() => { });
                            }
                        },
                        onLocalStream: (stream) => {
                            if (isCancelled) {
                                stopMediaStream(stream);
                                return;
                            }
                            localStreamRef.current = stream;
                            if (localVideoRef.current && isVideoCall) {
                                localVideoRef.current.srcObject = stream;
                            }
                        },
                        onRemoteStream: (stream) => {
                            if (isCancelled) return;
                            remoteStreamRef.current = stream;
                            if (remoteAudioRef.current) {
                                remoteAudioRef.current.srcObject = stream;
                                remoteAudioRef.current.play().catch(() => { });
                            }
                            if (remoteVideoRef.current && isVideoCall) {
                                remoteVideoRef.current.srcObject = stream;
                                remoteVideoRef.current.play().catch(() => { });
                            }
                        },
                        onStatusChange: (status, data) => {
                            if (isCancelled) return;
                            if (data) setCallData(data);

                            if (status === 'ringing') {
                                setCallStatus('ringing');
                            } else if (status === 'connected') {
                                playCallBeep('connect');
                                setCallStatus('connected');
                            } else if (status === 'cancelled') {
                                playCallBeep('disconnect');
                                setCallStatus('cancelled');
                                setTimeout(() => handleCloseSession(), 1500);
                            } else if (status === 'rejected') {
                                playCallBeep('disconnect');
                                setCallStatus('rejected');
                                setTimeout(() => handleCloseSession(), 2500);
                            } else if (status === 'ended') {
                                playCallBeep('disconnect');
                                setCallStatus('ended');
                                setTimeout(() => handleCloseSession(), 2000);
                            } else if (status === 'busy') {
                                playCallBeep('disconnect');
                                setCallStatus('busy');
                                setTimeout(() => handleCloseSession(), 2500);
                            } else if (status === 'missed') {
                                playCallBeep('disconnect');
                                setCallStatus('missed');
                                setTimeout(() => handleCloseSession(), 2000);
                            }
                        },
                        onError: (err) => {
                            if (isCancelled) return;
                            console.error("WebRTC startCall error:", err);
                            setErrorMessage(err.message || "Gagal mengakses mikrofon/kamera.");
                            setCallStatus('error');
                        }
                    });

                    // 🛡️ Anti-Ghost Call: Jika efek dibatalkan saat proses await berjalan (StrictMode)
                    if (isCancelled) {
                        if (handle?.callId) {
                            cancelCall(db, appId, handle.callId).catch(() => { });
                        }
                        if (handle?.cleanup) {
                            handle.cleanup();
                        }
                        return;
                    }

                    activeCallHandleRef.current = handle;
                    if (handle?.callId) {
                        callIdRef.current = handle.callId;
                    }
                } catch (err) {
                    if (isCancelled) return;
                    setErrorMessage(err.message || "Gagal memulai panggilan.");
                    setCallStatus('error');
                }
            };

            initiateOutgoingCall();

            // 🛡️ Pembersih Otomatis saat tab ditutup mendadak / berpindah halaman
            const handleBeforeUnload = () => {
                if (callIdRef.current && ['calling', 'ringing'].includes(callStatusRef.current)) {
                    cancelCall(db, appId, callIdRef.current);
                } else if (callIdRef.current && callStatusRef.current === 'connected') {
                    endCall(db, appId, callIdRef.current, 'ended');
                }
            };
            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                isCancelled = true;
                window.removeEventListener('beforeunload', handleBeforeUnload);
                // 🛡️ Hanya ubah status ke 'cancelled' jika panggilan memang masih memanggil/berdering
                if (callIdRef.current && ['calling', 'ringing'].includes(callStatusRef.current)) {
                    cancelCall(db, appId, callIdRef.current).catch(() => { });
                }
                if (activeCallHandleRef.current) {
                    activeCallHandleRef.current.cleanup();
                }
                stopMediaStream(localStreamRef.current);
            };
        }
    }, [isIncoming, callType]);

    // ========================================================================
    // 📞 AKSI: TERIMA PANGGILAN MASUK
    // ========================================================================
    const handleAcceptCall = async () => {
        if (!session?.callId) return;
        try {
            setCallStatus('connecting');
            if (ringtoneControllerRef.current) {
                ringtoneControllerRef.current.stop();
                ringtoneControllerRef.current = null;
            }

            const handle = await answerCall({
                db,
                appId,
                callId: session.callId,
                onLocalStream: (stream) => {
                    localStreamRef.current = stream;
                    if (localVideoRef.current && isVideoCall) {
                        localVideoRef.current.srcObject = stream;
                    }
                },
                onRemoteStream: (stream) => {
                    remoteStreamRef.current = stream;
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = stream;
                        remoteAudioRef.current.play().catch(() => { });
                    }
                    if (remoteVideoRef.current && isVideoCall) {
                        remoteVideoRef.current.srcObject = stream;
                        remoteVideoRef.current.play().catch(() => { });
                    }
                },
                onStatusChange: (status, data) => {
                    if (data) setCallData(data);

                    if (status === 'connected') {
                        playCallBeep('connect');
                        setCallStatus('connected');
                    } else if (status === 'cancelled') {
                        playCallBeep('disconnect');
                        setCallStatus('cancelled');
                        setTimeout(() => handleCloseSession(), 1200);
                    } else if (status === 'ended') {
                        playCallBeep('disconnect');
                        setCallStatus('ended');
                        setTimeout(() => handleCloseSession(), 2000);
                    }
                },
                onError: (err) => {
                    console.error("WebRTC answerCall error:", err);
                    setErrorMessage(err.message || "Gagal menjawab panggilan.");
                    setCallStatus('error');
                }
            });

            activeCallHandleRef.current = handle;
        } catch (err) {
            setErrorMessage(err.message || "Gagal membuka jalur audio/kamera.");
            setCallStatus('error');
        }
    };

    // ========================================================================
    // 🛑 AKSI: BATALKAN / TOLAK / AKHIRI PANGGILAN (ANTI-GHOST CALL)
    // ========================================================================
    const handleCancelOutgoingCall = async () => {
        if (ringtoneControllerRef.current) {
            ringtoneControllerRef.current.stop();
            ringtoneControllerRef.current = null;
        }
        playCallBeep('disconnect');
        setCallStatus('cancelled');

        const activeCallId = session?.callId || activeCallHandleRef.current?.callId || callIdRef.current;
        if (activeCallId) {
            await cancelCall(db, appId, activeCallId);
        }
        handleCloseSession();
    };

    const handleRejectCall = async () => {
        if (ringtoneControllerRef.current) {
            ringtoneControllerRef.current.stop();
            ringtoneControllerRef.current = null;
        }
        playCallBeep('disconnect');
        setCallStatus('rejected');

        const activeCallId = session?.callId || activeCallHandleRef.current?.callId || callIdRef.current;
        if (activeCallId) {
            await rejectCall(db, appId, activeCallId);
        }
        handleCloseSession();
    };

    const handleEndCall = async () => {
        if (ringtoneControllerRef.current) {
            ringtoneControllerRef.current.stop();
            ringtoneControllerRef.current = null;
        }
        playCallBeep('disconnect');
        setCallStatus('ended');

        // ✨ Ditambahkan || callIdRef.current
        const activeCallId = session?.callId || activeCallHandleRef.current?.callId || callIdRef.current;
        if (activeCallId) {
            await endCall(db, appId, activeCallId, 'ended');
        }

        setTimeout(() => {
            handleCloseSession();
        }, 1000);
    };

    const handleMissedCall = async () => {
        if (ringtoneControllerRef.current) {
            ringtoneControllerRef.current.stop();
            ringtoneControllerRef.current = null;
        }
        playCallBeep('disconnect');
        setCallStatus('missed');

        // ✨ Ditambahkan || callIdRef.current
        const activeCallId = session?.callId || activeCallHandleRef.current?.callId || callIdRef.current;
        if (activeCallId) {
            await missedCall(db, appId, activeCallId);
        }
        setTimeout(() => {
            handleCloseSession();
        }, 2000);
    };

    const handleCloseSession = useCallback(() => {
        // 🧹 1. Matikan Paksa Kamera & Mic Lokal sampai ke akarnya
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop(); // Hentikan hardware
                track.enabled = false;
            });
            localStreamRef.current = null;
        }

        // 🧹 2. Hancurkan Stream Remote
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(track => track.stop());
            remoteStreamRef.current = null;
        }

        // 🧹 3. Putus Koneksi WebRTC (PeerConnection)
        if (activeCallHandleRef.current) {
            activeCallHandleRef.current.cleanup();
            activeCallHandleRef.current = null;
        }
        
        // 🧹 4. Matikan elemen Audio/Video HTML untuk melepaskan cache browser
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

        onClose();
    }, [onClose]);

    // Timer Timeout 30 Detik untuk Penelepon
    useEffect(() => {
        let timeoutId;
        if (!isIncoming && (callStatus === 'calling' || callStatus === 'ringing')) {
            timeoutId = setTimeout(() => {
                handleMissedCall();
            }, 30000); // 30 detik
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isIncoming, callStatus]);

    // ========================================================================
    // 🎙️ AKSI: TOGGLE MUTE MIC & KAMERA & FLIP KAMERA
    // ========================================================================
    const handleToggleMute = () => {
        const nextMute = !isMuted;
        setIsMuted(nextMute);
        setStreamMuted(localStreamRef.current, nextMute);
    };

    const handleToggleCamera = () => {
        const nextCamera = !isCameraOn;
        setIsCameraOn(nextCamera);
        setCameraEnabled(localStreamRef.current, nextCamera);
    };

    const handleFlipCamera = async () => {
        if (isSwitchingCamera || !activeCallHandleRef.current?.pc) return;
        try {
            setIsSwitchingCamera(true);
            const result = await switchCamera(activeCallHandleRef.current.pc, localStreamRef.current, facingMode);
            setFacingMode(result.facingMode);
            if (localVideoRef.current && result.stream) {
                localVideoRef.current.srcObject = result.stream;
            }
        } catch (e) {
            console.warn("Gagal flip kamera:", e);
        } finally {
            setIsSwitchingCamera(false);
        }
    };

    // Resolusi Label Peran Lawan Bicara
    const getRoleBadge = (role) => {
        if (role === 'DPJP') return { label: '👨‍⚕️ DPJP / SPESIALIS', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
        if (role === 'Dokter_Jaga') return { label: '🩺 DOKTER JAGA', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/30' };
        return { label: '🙋 PERAWAT RUANGAN', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    };

    const roleBadge = getRoleBadge(counterpart?.role);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
            {/* Hidden Audio Receiver for Audio output */}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            {/* ============================================================ */}
            {/* 📹 TAMPILAN VIDEO CALL (Saat Mode Video Aktif)               */}
            {/* ============================================================ */}
            {isVideoCall ? (
                <div className="relative w-full max-w-2xl h-[85vh] max-h-[720px] overflow-hidden bg-slate-950 rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col items-center justify-between p-4 animate-in zoom-in-95 duration-200">

                    {/* Top Overlay Banner (Identitas Lawan Bicara + Status + Timer) */}
                    <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start pointer-events-none">
                        <div className="bg-slate-900/85 backdrop-blur-md p-3 rounded-2xl border border-slate-700/60 shadow-lg text-left max-w-[70%] pointer-events-auto">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs">📹</span>
                                <span className="text-xs font-bold text-slate-100 truncate">{counterpart?.name || 'Rekan Medis'}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border ${roleBadge.bg}`}>
                                    {roleBadge.label}
                                </span>
                            </div>
                            {patientInfo?.name && (
                                <div className="text-[9px] text-indigo-300 font-medium truncate">
                                    👤 Pasien: {patientInfo.name} (Bed {patientInfo.roomNumber || '-'})
                                </div>
                            )}
                        </div>

                        {/* Status / Timer Badge */}
                        <div className="bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/60 shadow-lg flex items-center gap-2 pointer-events-auto">
                            {callStatus === 'connected' ? (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    <span className="text-xs font-mono font-bold text-emerald-400">{formatDuration(durationSeconds)}</span>
                                </>
                            ) : callStatus === 'ringing' ? (
                                <span className="text-xs font-bold text-amber-300 animate-pulse">Berdering...</span>
                            ) : callStatus === 'calling' ? (
                                <span className="text-xs font-bold text-indigo-300 animate-pulse">Memanggil...</span>
                            ) : callStatus === 'incoming' ? (
                                <span className="text-xs font-bold text-amber-300 animate-pulse">Video Masuk...</span>
                                // 👇 TAMBAHKAN 2 BARIS INI
                            ) : callStatus === 'missed' ? (
                                <span className="text-xs font-bold text-amber-400">Tidak Terjawab</span>
                                // 👆 SAMPAI SINI
                            ) : (
                                <span className="text-xs font-bold text-slate-300 capitalize">{callStatus}</span>
                            )}
                        </div>
                    </div>

                    {/* Main Remote Video Screen */}
                    <div className="relative w-full h-full flex-1 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800">
                        {callStatus === 'connected' ? (
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-6 text-center">
                                <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shadow-xl">
                                    <User className="w-12 h-12 stroke-[1.5]" />
                                </div>
                                <span className="text-sm font-bold text-slate-200">{counterpart?.name}</span>
                                <span className="text-xs text-indigo-300 font-medium">
                                    {callStatus === 'calling' ? "Menghubungkan panggilan video..." :
                                        callStatus === 'ringing' ? "Perangkat lawan bicara berdering..." :
                                            callStatus === 'incoming' ? "Panggilan video masuk..." : "Menunggu video..."}
                                </span>
                            </div>
                        )}

                        {/* Floating Local Camera PiP (Picture in Picture) */}
                        <div className={`absolute bottom-20 right-3 w-28 h-36 md:w-36 md:h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-950 transition-all duration-300 z-10 ${!isCameraOn ? 'opacity-40' : 'opacity-100'}`}>
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {!isCameraOn && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-slate-400 text-[10px] font-bold">
                                    Kamera Mati
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Video Call Toolbar */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-full border border-slate-700/80 shadow-2xl">
                        {callStatus === 'incoming' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleRejectCall}
                                    className="p-3.5 px-5 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer"
                                >
                                    <PhoneOff className="w-5 h-5" />
                                    <span>Tolak</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAcceptCall}
                                    className="p-3.5 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/40 animate-pulse transition cursor-pointer"
                                >
                                    <Video className="w-5 h-5" />
                                    <span>Terima Video</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Mute Mic */}
                                <button
                                    type="button"
                                    onClick={handleToggleMute}
                                    className={`p-3 rounded-full border transition active:scale-95 cursor-pointer ${isMuted ? 'bg-amber-600/40 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                        }`}
                                    title={isMuted ? "Aktifkan Mic" : "Matikan Mic"}
                                >
                                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>

                                {/* Toggle Camera */}
                                <button
                                    type="button"
                                    onClick={handleToggleCamera}
                                    className={`p-3 rounded-full border transition active:scale-95 cursor-pointer ${!isCameraOn ? 'bg-amber-600/40 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                                        }`}
                                    title={isCameraOn ? "Matikan Kamera" : "Nyalakan Kamera"}
                                >
                                    {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                                </button>

                                {/* Flip Camera */}
                                <button
                                    type="button"
                                    onClick={handleFlipCamera}
                                    disabled={isSwitchingCamera || !isCameraOn}
                                    className="p-3 rounded-full bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 active:scale-95 transition cursor-pointer disabled:opacity-40"
                                    title="Ganti Kamera Depan/Belakang"
                                >
                                    <RefreshCw className={`w-5 h-5 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                                </button>

                                {/* End / Cancel Call */}
                                <button
                                    type="button"
                                    onClick={['calling', 'ringing'].includes(callStatus) ? handleCancelOutgoingCall : handleEndCall}
                                    className="p-3 px-5 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition cursor-pointer"
                                    title="Tutup Panggilan"
                                >
                                    <PhoneOff className="w-5 h-5" />
                                    <span>{['calling', 'ringing'].includes(callStatus) ? 'Batalkan' : 'Tutup'}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : (

                /* ============================================================ */
                /* 🎙️ TAMPILAN AUDIO CALL (Interkom Klinis Suara)               */
                /* ============================================================ */
                <div className="relative w-full max-w-sm overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl border border-slate-700/60 shadow-2xl flex flex-col items-center p-6 text-center animate-in zoom-in-95 duration-200">

                    {/* Decorative Top Accent Glow */}
                    <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${callStatus === 'connected' ? 'bg-emerald-500/25' :
                        callStatus === 'incoming' ? 'bg-amber-500/25' :
                            ['rejected', 'ended', 'cancelled'].includes(callStatus) ? 'bg-rose-500/25' :
                                'bg-indigo-500/25'
                        }`}></div>

                    {/* Header Badge */}
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-bold tracking-wider uppercase text-slate-300 mb-6 shadow-inner">
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${callStatus === 'connected' ? 'bg-emerald-400' :
                                callStatus === 'incoming' ? 'bg-amber-400' : 'bg-indigo-400'
                                }`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${callStatus === 'connected' ? 'bg-emerald-500' :
                                callStatus === 'incoming' ? 'bg-amber-500' : 'bg-indigo-500'
                                }`}></span>
                        </span>
                        <span>🎙️ Interkom Suara Klinis</span>
                    </div>

                    {/* Avatar / Audio Sonar Visualizer */}
                    <div className="relative mb-5 flex items-center justify-center">
                        {/* Pulsing Sonar Ring */}
                        <div className={`absolute w-32 h-32 rounded-full transition-all duration-700 ${callStatus === 'connected' ? 'bg-emerald-500/10 scale-110 animate-pulse' :
                            callStatus === 'incoming' ? 'bg-amber-500/15 scale-125 animate-ping' :
                                ['calling', 'ringing'].includes(callStatus) ? 'bg-indigo-500/15 scale-110 animate-pulse' :
                                    'bg-slate-800/40'
                            }`}></div>

                        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-2 transition-all duration-300 ${callStatus === 'connected' ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-emerald-500/20' :
                            callStatus === 'incoming' ? 'bg-amber-950/60 border-amber-400 text-amber-400 shadow-amber-400/20' :
                                ['calling', 'ringing'].includes(callStatus) ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 shadow-indigo-500/20' :
                                    'bg-slate-800 border-slate-700 text-slate-400'
                            }`}>
                            {callStatus === 'connected' ? (
                                /* Live Animated Waveform Bars */
                                <div className="flex items-center gap-1 h-8">
                                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s] h-4"></span>
                                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] h-7"></span>
                                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.45s] h-5"></span>
                                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.2s] h-8"></span>
                                    <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.35s] h-4"></span>
                                </div>
                            ) : (
                                <User className="w-10 h-10 stroke-[1.8]" />
                            )}
                        </div>
                    </div>

                    {/* Counterpart Name & Role */}
                    <h3 className="text-base font-bold text-slate-100 mb-1 max-w-full truncate px-2" title={counterpart?.name}>
                        {counterpart?.name || 'Rekan Medis'}
                    </h3>

                    <div className="flex items-center justify-center gap-1.5 flex-wrap mb-4">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${roleBadge.bg}`}>
                            {roleBadge.label}
                        </span>
                        {(counterpart?.ward || currentUser?.ward) && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                📍 {counterpart?.ward || currentUser?.ward}
                            </span>
                        )}
                    </div>

                    {/* Patient Context Tag */}
                    {patientInfo?.name && (
                        <div className="w-full bg-slate-800/60 border border-slate-700/70 rounded-xl p-2.5 mb-5 text-left">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-0.5">
                                <span>Pasien Terkait:</span>
                            </div>
                            <div className="text-xs font-bold text-slate-200 truncate">
                                👤 {patientInfo.name}
                            </div>
                            <div className="text-[10px] text-indigo-300 font-medium flex items-center gap-2 mt-0.5">
                                <span>Bed {patientInfo.roomNumber || '-'}</span>
                                <span>•</span>
                                <span>Ruang {patientInfo.ward || 'Melati'}</span>
                            </div>
                        </div>
                    )}

                    {/* Call Status & Live Timer */}
                    <div className="mb-6 flex flex-col items-center">
                        {callStatus === 'incoming' && (
                            <div className="text-xs font-bold text-amber-300 animate-pulse flex items-center gap-1.5">
                                <Radio className="w-4 h-4" />
                                <span>Panggilan Suara Masuk...</span>
                            </div>
                        )}
                        {callStatus === 'calling' && (
                            <div className="text-xs font-bold text-indigo-300 animate-pulse flex items-center gap-1.5">
                                <Radio className="w-4 h-4" />
                                <span>Memanggil lawan bicara...</span>
                            </div>
                        )}
                        {callStatus === 'ringing' && (
                            <div className="text-xs font-bold text-amber-300 animate-pulse flex items-center gap-1.5">
                                <Radio className="w-4 h-4" />
                                <span>Berdering...</span>
                            </div>
                        )}
                        {callStatus === 'connecting' && (
                            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                                <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>Menghubungkan audio...</span>
                            </div>
                        )}
                        {callStatus === 'connected' && (
                            <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                    <span>Terhubung</span>
                                </div>
                                <span className="text-slate-500">•</span>
                                <span className="text-xs font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                                    {formatDuration(durationSeconds)}
                                </span>
                            </div>
                        )}
                        {callStatus === 'cancelled' && (
                            <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                <span>Panggilan Dibatalkan</span>
                            </div>
                        )}
                        {callStatus === 'ended' && (
                            <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                <span>Panggilan Berakhir</span>
                            </div>
                        )}
                        {callStatus === 'rejected' && (
                            <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                                <span>Panggilan Ditolak</span>
                            </div>
                        )}
                        {callStatus === 'busy' && (
                            <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                <span>Rekan Medis Sedang Sibuk</span>
                            </div>
                        )}
                        {/* 👇 TAMBAHKAN BLOK INI */}
                        {callStatus === 'missed' && (
                            <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                <span>Panggilan Tak Terjawab</span>
                            </div>
                        )}
                        {/* 👆 SAMPAI SINI */}
                        {callStatus === 'error' && (
                            <div className="text-[11px] font-bold text-rose-400 bg-rose-950/50 p-2 rounded-lg border border-rose-800 flex items-center gap-1.5 text-left">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                                <span>{errorMessage || "Terjadi kendala pada panggilan"}</span>
                            </div>
                        )}
                    </div>

                    {/* Control Action Buttons */}
                    <div className="w-full flex items-center justify-center gap-4">
                        {callStatus === 'incoming' ? (
                            <>
                                {/* Tombol Tolak */}
                                <button
                                    type="button"
                                    onClick={handleRejectCall}
                                    className="flex-1 max-w-[120px] py-3 rounded-2xl bg-rose-600/90 hover:bg-rose-600 active:scale-95 text-white font-bold text-xs flex flex-col items-center gap-1 transition shadow-lg shadow-rose-600/30 border border-rose-500 cursor-pointer"
                                >
                                    <PhoneOff className="w-5 h-5" />
                                    <span>Tolak</span>
                                </button>

                                {/* Tombol Terima */}
                                <button
                                    type="button"
                                    onClick={handleAcceptCall}
                                    className="flex-1 max-w-[120px] py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex flex-col items-center gap-1 transition shadow-lg shadow-emerald-600/30 border border-emerald-400 animate-pulse cursor-pointer"
                                >
                                    <Phone className="w-5 h-5" />
                                    <span>Terima</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Tombol Mute Mic */}
                                {['calling', 'ringing', 'connecting', 'connected'].includes(callStatus) && (
                                    <button
                                        type="button"
                                        onClick={handleToggleMute}
                                        className={`p-3.5 rounded-full border transition active:scale-95 flex items-center justify-center cursor-pointer ${isMuted
                                            ? 'bg-amber-600/30 border-amber-500 text-amber-300 hover:bg-amber-600/40'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                            }`}
                                        title={isMuted ? "Aktifkan Mikrofon" : "Matikan Mikrofon"}
                                    >
                                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                    </button>
                                )}

                                {/* Tombol Batal / Tutup Panggilan */}
                                <button
                                    type="button"
                                    onClick={['calling', 'ringing'].includes(callStatus) ? handleCancelOutgoingCall : handleEndCall}
                                    disabled={['ended', 'rejected', 'cancelled', 'missed'].includes(callStatus)}
                                    className="p-3.5 px-6 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/30 border border-rose-500 cursor-pointer disabled:opacity-50"
                                    title="Tutup / Batalkan Panggilan"
                                >
                                    <PhoneOff className="w-5 h-5" />
                                    <span>{['calling', 'ringing'].includes(callStatus) ? 'Batalkan' : 'Tutup'}</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Sub-label info */}
                    {isMuted && ['connected', 'calling', 'ringing'].includes(callStatus) && (
                        <div className="mt-3 text-[9px] font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-800">
                            🔇 Mikrofon Anda sedang dimatikan (Muted)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AudioCallModal;
