import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parsePlanning } from '../utils/helpers';
import { renderPlanningCell } from '../utils/helpers';

// --- KOMPONEN: FILTER KAMAR DROPDOWN ---
export const RoomFilterDropdown = ({ allRooms, selectedRooms, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const toggleRoom = (room) => {
        if (selectedRooms.includes(room)) {
            onChange(selectedRooms.filter(r => r !== room));
        } else {
            onChange([...selectedRooms, room]);
        }
    };

    const toggleAll = () => {
        if (selectedRooms.length === allRooms.length) onChange([]);
        else onChange(allRooms);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 px-2 rounded flex justify-between items-center hover:bg-indigo-50 transition h-[32px] md:h-full"
            >
                <span className="truncate pr-2">{selectedRooms.length === allRooms.length ? 'Semua Kamar Tampil' : `${selectedRooms.length} Kamar Dipilih`}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-300 shadow-xl rounded-lg mt-1 z-50 p-2">
                    <div className="flex justify-between border-b pb-1 mb-2">
                        <button onClick={toggleAll} className="text-[10px] font-bold text-blue-600 hover:underline">
                            {selectedRooms.length === allRooms.length ? 'Uncheck All' : 'Check All'}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="text-[10px] text-red-500 hover:underline">Tutup</button>
                    </div>

                    <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {[...allRooms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(room => (
                            <button
                                key={room}
                                onClick={() => toggleRoom(room)}
                                className={`text-[9px] py-1 rounded border transition ${selectedRooms.includes(room)
                                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm'
                                    : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                                    }`}
                            >
                                {room}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- KOMPONEN: FILTER DPJP MULTI-SELECT DENGAN SEARCH ---
export const DpjpFilterDropdown = ({ allOptions, selectedOptions, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const toggleOption = (opt) => {
        if (selectedOptions.includes(opt)) onChange(selectedOptions.filter(o => o !== opt));
        else onChange([...selectedOptions, opt]);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredList = allOptions.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-indigo-200 text-indigo-700 text-[10px] font-bold py-1.5 px-2 rounded flex justify-between items-center hover:bg-indigo-50 transition h-[32px] md:h-full"
            >
                <span className="truncate pr-2">
                    {selectedOptions.length === 0 ? 'Semua Dokter (DPJP)' : `${selectedOptions.length} Dokter Dipilih`}
                </span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full md:w-64 bg-white border border-gray-300 shadow-xl rounded-lg mt-1 z-[100] p-2">
                    <div className="flex justify-between border-b pb-1 mb-2 items-center">
                        <button onClick={() => onChange([])} className="text-[10px] font-bold text-red-600 hover:underline">Reset</button>
                        <button onClick={() => setIsOpen(false)} className="text-[10px] text-gray-500 hover:underline">Tutup</button>
                    </div>
                    <input
                        type="text"
                        placeholder="Ketik cari dokter..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-1.5 border rounded text-[10px] mb-2 outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50"
                    />
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredList.map(opt => (
                            <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-indigo-50 rounded cursor-pointer border border-transparent hover:border-indigo-100 transition">
                                <input
                                    type="checkbox"
                                    checked={selectedOptions.includes(opt)}
                                    onChange={() => toggleOption(opt)}
                                    className="accent-indigo-600 cursor-pointer w-3 h-3"
                                />
                                <span className="text-[10px] text-gray-700 font-bold truncate">{opt}</span>
                            </label>
                        ))}
                        {filteredList.length === 0 && <div className="text-[10px] text-gray-400 text-center py-2 italic">Tidak ditemukan</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- RENDERER KOTAK PLANNING (DELEGASI KE MESIN UTAMA HELPERS.JSX) ---
export const renderLocalPlanningCell = (rawText, medicationLogs = {}) => {
    return renderPlanningCell(rawText, medicationLogs);
};

// --- KOMPONEN: JAM DIGITAL ---
export const DigitalClock = () => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="flex flex-col items-end leading-none select-none">
            <div className="text-lg font-mono font-bold text-indigo-900">
                {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[9px] text-gray-500 uppercase font-bold">
                {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
        </div>
    );
};