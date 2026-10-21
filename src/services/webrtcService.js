import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    addDoc,
    onSnapshot
} from 'firebase/firestore';

// ============================================================================
// 🌐 KONFIGURASI STUN SERVER GOOGLE
// ============================================================================
export const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
};

// ============================================================================
// 🎵 WEB AUDIO API: GENERATOR NADA DERING & NADA PANGGIL INTERKOM KLINIS
// ============================================================================

/**
 * Memutar nada dering panggilan masuk (Interkom Klinis Hospital Chime)
 */
export const startIncomingRingtone = () => {
    let isPlaying = true;
    let audioCtx = null;
    let timerId = null;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return { stop: () => { } };
        audioCtx = new AudioContextClass();

        const playChimeSequence = () => {
            if (!isPlaying || !audioCtx || audioCtx.state === 'closed') return;
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => { });
            }

            // Urutan nada ramah khas interkom RS: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
            const notes = [
                { freq: 523.25, time: 0.0, dur: 0.18 },
                { freq: 659.25, time: 0.15, dur: 0.18 },
                { freq: 783.99, time: 0.30, dur: 0.22 },
                { freq: 1046.50, time: 0.48, dur: 0.40 }
            ];

            const startTime = audioCtx.currentTime + 0.05;

            notes.forEach(note => {
                try {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(note.freq, startTime + note.time);

                    // Envelope lembut
                    gain.gain.setValueAtTime(0.001, startTime + note.time);
                    gain.gain.exponentialRampToValueAtTime(0.25, startTime + note.time + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.time + note.dur);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(startTime + note.time);
                    osc.stop(startTime + note.time + note.dur + 0.05);
                } catch (e) { }
            });
        };

        playChimeSequence();
        timerId = setInterval(playChimeSequence, 2400);
    } catch (e) {
        console.warn("AudioContext error on ringtone:", e);
    }

    return {
        stop: () => {
            isPlaying = false;
            if (timerId) clearInterval(timerId);
            if (audioCtx && audioCtx.state !== 'closed') {
                try { audioCtx.close(); } catch (e) { }
            }
        }
    };
};

/**
 * Memutar nada panggil keluar (Ringback Tone / Dialing Tone)
 */
export const startOutgoingRingbackTone = () => {
    let isPlaying = true;
    let audioCtx = null;
    let timerId = null;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return { stop: () => { } };
        audioCtx = new AudioContextClass();

        const playTonePulse = () => {
            if (!isPlaying || !audioCtx || audioCtx.state === 'closed') return;
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => { });
            }

            const startTime = audioCtx.currentTime + 0.05;
            const duration = 1.2; // Bunyi 1.2 detik, jeda 2.5 detik

            [440, 480].forEach(freq => {
                try {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startTime);

                    gain.gain.setValueAtTime(0.001, startTime);
                    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.05);
                    gain.gain.setValueAtTime(0.08, startTime + duration - 0.05);
                    gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(startTime);
                    osc.stop(startTime + duration + 0.05);
                } catch (e) { }
            });
        };

        playTonePulse();
        timerId = setInterval(playTonePulse, 3200);
    } catch (e) {
        console.warn("AudioContext error on ringback:", e);
    }

    return {
        stop: () => {
            isPlaying = false;
            if (timerId) clearInterval(timerId);
            if (audioCtx && audioCtx.state !== 'closed') {
                try { audioCtx.close(); } catch (e) { }
            }
        }
    };
};

/**
 * Suara bip singkat saat panggilan tersambung atau terputus
 */
export const playCallBeep = (type = 'connect') => {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        const startTime = audioCtx.currentTime + 0.02;

        if (type === 'connect') {
            // 2 nada naik
            [600, 880].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const t = startTime + (idx * 0.1);
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.001, t);
                gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.09);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.1);
            });
        } else {
            // 2 nada turun (putus/batal)
            [700, 400].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const t = startTime + (idx * 0.12);
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.001, t);
                gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.11);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.12);
            });
        }

        setTimeout(() => {
            try { audioCtx.close(); } catch (e) { }
        }, 500);
    } catch (e) { }
};

// ============================================================================
// 🎙️ KONTROL AUDIO & VIDEO STREAM (MUTE, KAMERA, FLIP)
// ============================================================================

/**
 * Toggle enable/disable audio tracks pada stream lokal
 */
export const setStreamMuted = (stream, isMuted) => {
    if (!stream) return;
    stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
};

/**
 * Toggle enable/disable video camera tracks pada stream lokal
 */
export const setCameraEnabled = (stream, isCameraOn) => {
    if (!stream) return;
    stream.getVideoTracks().forEach(track => {
        track.enabled = isCameraOn;
    });
};

/**
 * Menghentikan semua track pada media stream
 */
export const stopMediaStream = (stream) => {
    if (!stream) return;
    try {
        stream.getTracks().forEach(track => {
            try { track.stop(); } catch (e) { }
        });
    } catch (e) { }
};

/**
 * Beralih antara Kamera Depan dan Belakang (Flip Camera)
 */
export const switchCamera = async (pc, localStream, currentFacingMode = 'user') => {
    if (!localStream) return { stream: localStream, facingMode: currentFacingMode };
    const nextFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    try {
        let newStream;
        try {
            newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { exact: nextFacingMode } }
            });
        } catch (err) {
            newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: nextFacingMode }
            });
        }

        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
            const oldVideoTrack = localStream.getVideoTracks()[0];
            if (oldVideoTrack) {
                localStream.removeTrack(oldVideoTrack);
                oldVideoTrack.stop();
            }
            localStream.addTrack(newVideoTrack);

            if (pc) {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(newVideoTrack);
                }
            }
        }
        return { stream: localStream, facingMode: nextFacingMode };
    } catch (e) {
        console.warn("Gagal flip kamera:", e);
        return { stream: localStream, facingMode: currentFacingMode };
    }
};

// ============================================================================
// 📞 LOGIKA WEBRTC CALLING DENGAN SIGNALING FIRESTORE
// ============================================================================

/**
 * 🛡️ Menyamarkan nama pasien di jalur signaling publik Firestore
 * Contoh: "EEN ROHAENI" -> "E*** R***"
 */
const maskPatientName = (fullName = '') => {
    const clean = String(fullName || '').trim();
    if (!clean || clean.toLowerCase() === 'pasien') return 'Pasien';
    return clean
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + '***')
        .join(' ');
};

/**
 * Memulai panggilan suara / video (Caller side)
 * @param {Object} params
 * @param {Object} params.db - Firestore instance
 * @param {string} params.appId - Firebase App ID
 * @param {string} params.callType - 'audio' | 'video'
 * @param {Object} params.callerUser - Info user yang memanggil { name, role, ward, hospital }
 * @param {Object} params.targetUser - Info user target { name, role, rawTarget }
 * @param {Object} params.patientInfo - Info pasien terkait { id, name, roomNumber, ward, dpjpName }
 * @param {Function} params.onLocalStream - Callback saat stream lokal siap
 * @param {Function} params.onRemoteStream - Callback saat stream lawan bicara masuk
 * @param {Function} params.onStatusChange - Callback perubahan status ('calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'cancelled' | 'busy')
 * @param {Function} params.onError - Callback jika terjadi error
 */
export const startCall = async ({
    db,
    appId,
    callType = 'audio',
    callerUser,
    targetUser,
    patientInfo,
    onCallCreated = () => { },
    onLocalStream = () => { },
    onRemoteStream = () => { },
    onStatusChange = () => { },
    onError = () => { }
}) => {
    const safeAppId = appId || 'SIMPAN_APP';
    let localStream = null;
    let pc = null;
    let unsubCallDoc = null;
    let unsubAnswerCandidates = null;
    let callDocRef = null;
    let callId = null;

    // 📦 TAMBAHAN 1: Antrean kandidat ICE jika datang sebelum RemoteDescription siap
    const pendingAnswerCandidates = [];

    const cleanup = () => {
        if (unsubCallDoc) { unsubCallDoc(); unsubCallDoc = null; }
        if (unsubAnswerCandidates) { unsubAnswerCandidates(); unsubAnswerCandidates = null; }
        if (pc) {
            try { pc.close(); } catch (e) { }
            pc = null;
        }
        stopMediaStream(localStream);
    };

    try {
        // 1. Ambil izin mikrofon (dan kamera jika video call)
        const mediaConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: callType === 'video' ? {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        onLocalStream(localStream);

        // 2. Inisialisasi RTCPeerConnection
        pc = new RTCPeerConnection(ICE_SERVERS);

        // 3. Masukkan track lokal ke RTCPeerConnection
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });

        // 4. Tangkap stream lawan bicara
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                onRemoteStream(event.streams[0]);
            }
        };

        // 5. Buat dokumen panggilan di Firestore
        const callsCollectionRef = collection(db, `artifacts/${safeAppId}/public/data/calls`);
        callDocRef = doc(callsCollectionRef);
        callId = callDocRef.id;

        const offerCandidatesRef = collection(db, `artifacts/${safeAppId}/public/data/calls/${callId}/offerCandidates`);
        const answerCandidatesRef = collection(db, `artifacts/${safeAppId}/public/data/calls/${callId}/answerCandidates`);

        // 6. Tangkap local ICE candidates & simpan ke subkoleksi offerCandidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(offerCandidatesRef, event.candidate.toJSON()).catch(e => {
                    console.warn("Gagal simpan offer ICE candidate:", e);
                });
            }
        };

        // 7. Buat SDP Offer
        const offerDescription = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video'
        });
        await pc.setLocalDescription(offerDescription);

        // 8. Tulis data panggilan lengkap ke Firestore (Nama pasien disamarkan)
        const callData = {
            id: callId,
            callType, // 'audio' | 'video'
            caller: {
                name: callerUser?.name || 'Staf Medis',
                role: callerUser?.role || 'Perawat',
                ward: callerUser?.ward || '',
                hospital: callerUser?.hospital || ''
            },
            target: {
                name: targetUser?.name || 'Rekan Medis',
                role: targetUser?.role || '',
                rawTarget: targetUser?.rawTarget || targetUser?.name || ''
            },
            patient: {
                id: patientInfo?.id || '',
                name: maskPatientName(patientInfo?.name), // 🛡️ Nama pasien disamarkan di Firestore
                roomNumber: patientInfo?.roomNumber || '-',
                ward: patientInfo?.ward || '',
                dpjpName: patientInfo?.dpjpName || ''
            },
            status: 'calling', // 'calling' | 'ringing' | 'accepted' | 'ended' | 'rejected' | 'cancelled' | 'busy'
            offer: {
                type: offerDescription.type,
                sdp: offerDescription.sdp
            },
            answer: null,
            createdAt: Date.now(),
            ringingAt: null,
            answeredAt: null,
            endedAt: null
        };

        await setDoc(callDocRef, callData);
        onCallCreated(callId); // 👈 BERI TAHU KE KOMPONEN: ID PANGGILAN SUDAH AKTIF
        onStatusChange('calling', callData);

        // 9. Simak status dokumen panggilan untuk mendeteksi 'ringing', 'accepted', 'rejected', 'cancelled', 'ended'
        unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (data.status === 'ringing') {
                onStatusChange('ringing', data);
            } else if (data.status === 'accepted' && data.answer && pc && !pc.currentRemoteDescription) {
                try {
                    const answerDescription = new RTCSessionDescription(data.answer);
                    await pc.setRemoteDescription(answerDescription);

                    // 🚀 TAMBAHAN 2: Masukkan semua kandidat ICE yang sempat mengantre
                    while (pendingAnswerCandidates.length > 0) {
                        const queuedCandidate = pendingAnswerCandidates.shift();
                        try {
                            await pc.addIceCandidate(queuedCandidate);
                        } catch (err) {
                            console.warn("Gagal pasang queued answer ICE candidate:", err);
                        }
                    }

                    onStatusChange('connected', data);
                } catch (e) {
                    console.error("Gagal setRemoteDescription SDP Answer:", e);
                }
            } else if (data.status === 'rejected') {
                onStatusChange('rejected', data);
                cleanup();
            } else if (data.status === 'cancelled') {
                onStatusChange('cancelled', data);
                cleanup();
            } else if (data.status === 'ended') {
                onStatusChange('ended', data);
                cleanup();
            } else if (data.status === 'busy') {
                onStatusChange('busy', data);
                cleanup();
            } else if (data.status === 'missed') {
                onStatusChange('missed', data);
                cleanup();
            }
        });

        // 10. Simak answer ICE candidates yang dikirim oleh Callee
        unsubAnswerCandidates = onSnapshot(answerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added' && pc) {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    // 🛡️ Cek apakah RemoteDescription sudah terpasang atau belum
                    if (pc.currentRemoteDescription) {
                        try {
                            await pc.addIceCandidate(candidate);
                        } catch (e) {
                            console.warn("Gagal menambahkan answer ICE candidate:", e);
                        }
                    } else {
                        pendingAnswerCandidates.push(candidate);
                    }
                }
            });
        });

        // 11. Deteksi status koneksi WebRTC (Jangan matikan saat 'disconnected' sesaat)
        pc.onconnectionstatechange = () => {
            if (!pc) return;
            if (pc.connectionState === 'connected') {
                onStatusChange('connected', null);
            } else if (['failed', 'closed'].includes(pc.connectionState)) {
                onStatusChange('ended', null);
            }
        };

        return {
            callId,
            pc,
            localStream,
            cleanup
        };

    } catch (err) {
        cleanup();
        onError(err);
        throw err;
    }
};

/**
 * Menjawab panggilan masuk (Callee side)
 * @param {Object} params
 * @param {Object} params.db - Firestore instance
 * @param {string} params.appId - Firebase App ID
 * @param {string} params.callId - ID dokumen panggilan
 * @param {Function} params.onLocalStream - Callback saat stream lokal siap
 * @param {Function} params.onRemoteStream - Callback saat stream lawan bicara masuk
 * @param {Function} params.onStatusChange - Callback perubahan status
 * @param {Function} params.onError - Callback jika terjadi error
 */
export const answerCall = async ({
    db,
    appId,
    callId,
    onLocalStream = () => { },
    onRemoteStream = () => { },
    onStatusChange = () => { },
    onError = () => { }
}) => {
    const safeAppId = appId || 'SIMPAN_APP';
    let localStream = null;
    let pc = null;
    let unsubCallDoc = null;
    let unsubOfferCandidates = null;
    const pendingOfferCandidates = [];
    const callDocRef = doc(db, `artifacts/${safeAppId}/public/data/calls`, callId);

    const cleanup = () => {
        if (unsubCallDoc) { unsubCallDoc(); unsubCallDoc = null; }
        if (unsubOfferCandidates) { unsubOfferCandidates(); unsubOfferCandidates = null; }
        if (pc) {
            try { pc.close(); } catch (e) { }
            pc = null;
        }
        stopMediaStream(localStream);
    };

    try {
        // 1. Ambil data dokumen panggilan & Offer dari Caller
        const callSnapshot = await getDoc(callDocRef);
        if (!callSnapshot.exists()) {
            throw new Error("Dokumen panggilan tidak ditemukan atau telah dibatalkan.");
        }
        const callData = callSnapshot.data();
        if (!callData.offer) {
            throw new Error("Panggilan tidak memiliki data SDP Offer yang valid.");
        }
        if (['cancelled', 'ended', 'missed', 'rejected'].includes(callData.status)) {
            throw new Error("Panggilan sudah berakhir atau dibatalkan oleh penelepon.");
        }

        const isVideoCall = callData.callType === 'video';

        // 2. Ambil izin mikrofon (dan kamera jika video call)
        const mediaConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: isVideoCall ? {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        onLocalStream(localStream);

        // 3. Inisialisasi RTCPeerConnection
        pc = new RTCPeerConnection(ICE_SERVERS);

        // 4. Masukkan track audio/video ke RTCPeerConnection
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });

        // 5. Tangkap stream suara/video lawan bicara
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                onRemoteStream(event.streams[0]);
            }
        };

        const offerCandidatesRef = collection(db, `artifacts/${safeAppId}/public/data/calls/${callId}/offerCandidates`);
        const answerCandidatesRef = collection(db, `artifacts/${safeAppId}/public/data/calls/${callId}/answerCandidates`);

        // 6. Tangkap local ICE candidates & simpan ke subkoleksi answerCandidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                addDoc(answerCandidatesRef, event.candidate.toJSON()).catch(e => {
                    console.warn("Gagal simpan answer ICE candidate:", e);
                });
            }
        };

        // 7. Pasang remote description dari offer
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

        // Jika ada kandidat offer yang mengantre, pasang sekarang
        while (pendingOfferCandidates.length > 0) {
            const queuedCandidate = pendingOfferCandidates.shift();
            try {
                await pc.addIceCandidate(queuedCandidate);
            } catch (err) {
                console.warn("Gagal pasang queued offer ICE candidate:", err);
            }
        }

        // 8. Buat SDP Answer & set sebagai local description
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        // 9. Update dokumen panggilan di Firestore: status 'accepted' + answer
        await updateDoc(callDocRef, {
            answer: {
                type: answerDescription.type,
                sdp: answerDescription.sdp
            },
            status: 'accepted',
            answeredAt: Date.now()
        });

        onStatusChange('connected', callData);

        // 10. Simak offer ICE candidates dari Caller
        unsubOfferCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added' && pc) {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    if (pc.currentRemoteDescription) {
                        try {
                            await pc.addIceCandidate(candidate);
                        } catch (e) {
                            console.warn("Gagal menambahkan offer ICE candidate:", e);
                        }
                    } else {
                        pendingOfferCandidates.push(candidate);
                    }
                }
            });
        });

        // 11. Simak jika penelpon membatalkan atau menutup panggilan
        unsubCallDoc = onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!data) return;
            if (data.status === 'cancelled') {
                onStatusChange('cancelled', data);
                cleanup();
            } else if (data.status === 'ended') {
                onStatusChange('ended', data);
                cleanup();
            } else if (data.status === 'missed') {
                onStatusChange('missed', data);
                cleanup();
            }
        });

        // 12. Deteksi status koneksi WebRTC (Jangan matikan saat 'disconnected' sesaat)
        pc.onconnectionstatechange = () => {
            if (!pc) return;
            if (pc.connectionState === 'connected') {
                onStatusChange('connected', null);
            } else if (['failed', 'closed'].includes(pc.connectionState)) {
                onStatusChange('ended', null);
            }
        };

        return {
            callId,
            pc,
            localStream,
            cleanup
        };

    } catch (err) {
        cleanup();
        onError(err);
        throw err;
    }
};

/**
 * Membatalkan panggilan sebelum diangkat (Caller side)
 */
export const cancelCall = async (db, appId, callId) => {
    return endCall(db, appId, callId, 'cancelled');
};

/**
 * Mengakhiri panggilan (Caller / Callee)
 */
export const endCall = async (db, appId, callId, status = 'ended') => {
    const safeAppId = appId || 'SIMPAN_APP';
    if (!db || !callId) return;

    try {
        const callDocRef = doc(db, `artifacts/${safeAppId}/public/data/calls`, callId);
        await updateDoc(callDocRef, {
            status,
            endedAt: Date.now()
        });
    } catch (e) {
        console.warn("Error updating call status to " + status + ":", e);
    }
};

/**
 * Menolak panggilan masuk
 */
export const rejectCall = async (db, appId, callId) => {
    return endCall(db, appId, callId, 'rejected');
};

/**
 * Menandai panggilan tak terjawab (Timeout)
 */
export const missedCall = async (db, appId, callId) => {
    return endCall(db, appId, callId, 'missed');
};