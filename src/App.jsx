import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// ================= KONFIGURASI FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyB7TPLgYiUkScaqhptQQBH6JqR-8IdjJ24",
  authDomain: "smart-kios-688a6.firebaseapp.com",
  databaseURL: "https://smart-kios-688a6-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-kios-688a6",
  storageBucket: "smart-kios-688a6.firebasestorage.app",
  messagingSenderId: "445757057853",
  appId: "1:445757057853:web:ff12b8a819b6d1472cf354"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [riwayat, setRiwayat] = useState([]);
  const [totalUangAsli, setTotalUangAsli] = useState(0);
  const [jumlahPalsu, setJumlahPalsu] = useState(0);
  const [showPalsuModal, setShowPalsuModal] = useState(false);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      PushNotifications.addListener('registration', (token) => {
        console.log('FCM Token Terdaftar:', token.value);
        const tokenRef = ref(database, 'config/esp_push_token');
        set(tokenRef, token.value); 
      });
    }

    const riwayatRef = ref(database, 'riwayat_scan');
    const unsubscribe = onValue(riwayatRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        let tempTotal = 0;
        let tempPalsu = 0;
        let tempRiwayat = [];

        Object.keys(data).forEach((key) => {
          const item = data[key];
          tempRiwayat.push({ id: key, ...item });

          if (item.status === 'ASLI') {
            const nominalStr = String(item.nominal || '0');
            const nominalAngka = parseInt(nominalStr.replace(/\./g, ''), 10);
            if (!isNaN(nominalAngka)) {
              tempTotal += nominalAngka;
            }
          } else if (item.status === 'PALSU') {
            tempPalsu += 1;
          }
        });

        tempRiwayat.sort((a, b) => (Number(b.waktu_scan) || 0) - (Number(a.waktu_scan) || 0));

        setTotalUangAsli(tempTotal);
        setJumlahPalsu(tempPalsu);
        setRiwayat(tempRiwayat);
        isFirstLoad.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  const formatRupiah = (angka) => {
    return "Rp " + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const formatTanggalWaktu = (timestamp) => {
    const validTimestamp = (typeof timestamp === 'number' && timestamp > 0) ? timestamp : Date.now();
    const date = new Date(validTimestamp);
    
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    
    const hari = days[date.getDay()];
    const tgl = date.getDate().toString().padStart(2, "0");
    const bln = months[date.getMonth()];
    const thn = date.getFullYear();
    const jam = date.getHours().toString().padStart(2, "0");
    const menit = date.getMinutes().toString().padStart(2, "0");
    
    return `${hari}, ${tgl} ${bln} ${thn} - Pukul ${jam}:${menit}`;
  };

  const exportDataToCSV = () => {
    const dataAsli = riwayat.filter((item) => item.status === "ASLI");
    
    if (dataAsli.length === 0) {
      alert("Belum ada transaksi valid untuk diekspor.");
      return;
    }

    let csvContent = "Tanggal,Waktu,Nominal\n";
    
    dataAsli.forEach((item) => {
      const validTimestamp = (typeof item.waktu_scan === 'number' && item.waktu_scan > 0) ? item.waktu_scan : Date.now();
      const date = new Date(validTimestamp);
      
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
      
      const hari = days[date.getDay()];
      const tgl = date.getDate().toString().padStart(2, "0");
      const bln = months[date.getMonth()];
      const thn = date.getFullYear();
      const jam = date.getHours().toString().padStart(2, "0");
      const menit = date.getMinutes().toString().padStart(2, "0");

      const tanggalStr = `${hari} ${tgl} ${bln} ${thn}`;
      const waktuStr = `'${jam}:${menit}`; 
      const nominalStr = `Rp ${item.nominal}`;
      
      const baris = `${tanggalStr},${waktuStr},${nominalStr}\n`;
      csvContent += baris;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Uang_Asli_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderItem = (item) => {
    const isAsli = item.status === "ASLI";
    return (
      <div key={item.id} className="bg-white p-4 rounded-xl mb-3 border border-[#f1f1f3] flex items-center shadow-sm">
        <div className={`w-10 h-10 rounded-lg flex justify-center items-center mr-3 shrink-0 ${isAsli ? 'bg-[#f4f4f5]' : 'bg-[#fff1f2]'}`}>
          {isAsli ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#09090b] truncate">
            {isAsli ? `Rp ${item.nominal}` : "Pemeriksaan Ditolak"}
          </h3>
          <p className="text-[11px] text-[#71717a] mt-1 truncate">
            {formatTanggalWaktu(item.waktu_scan)}
          </p>
        </div>
        <span className={`text-xs ml-2 ${isAsli ? 'text-[#71717a] font-medium' : 'text-[#e11d48] font-bold'}`}>
          {item.status}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans pb-24 selection:bg-zinc-200 relative">
      <main>
        {activeTab === 'dashboard' ? (
          <div className="animate-fade-in">
            <div className="bg-white px-6 pt-10 pb-6 border-b border-[#eeeeee]">
              
              {/* LOGO & HEADER KIOS PINTAR */}
              <div className="flex flex-col items-center mb-6">
                <h1 className="text-[12px] tracking-[0.2em] font-semibold text-[#111111] uppercase">
                  Kios Pintar
                </h1>
              </div>
              
              <p className="text-[13px] text-[#71717a] font-normal">Akumulasi Pendapatan Bersih</p>
              <h2 className="text-4xl font-bold text-[#09090b] mt-1 tracking-tight">
                {formatRupiah(totalUangAsli)}
              </h2>
              
              {/* TOMBOL RIWAYAT UANG PALSU */}
              <div 
                onClick={() => setShowPalsuModal(true)}
                className="flex justify-between items-center mt-5 p-3 bg-[#fff1f2] rounded-xl border border-[#ffe4e6] cursor-pointer hover:bg-[#ffe4e6] transition-colors"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-white rounded-lg flex justify-center items-center mr-3 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <span className="text-[13px] text-[#e11d48] font-semibold">Kasus Uang Palsu</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[13px] text-[#e11d48] font-bold mr-2">{jumlahPalsu} Kasus</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>

            </div>

            <div className="p-5">
              <h3 className="text-sm font-semibold text-[#09090b] mb-3 tracking-wide">Aktivitas Terakhir</h3>
              {riwayat.length === 0 ? (
                <p className="text-center text-[#a1a1aa] mt-10 text-[13px]">Menunggu data pemindaian...</p>
              ) : (
                riwayat.slice(0, 5).map(renderItem)
              )}
            </div>
          </div>
        ) : (
          <div className="p-5 pt-8 animate-fade-in">
            <div className="flex justify-between items-end mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#09090b] tracking-tight">Rekapitulasi</h2>
                <p className="text-[12px] text-[#71717a] mt-1">
                  Total {riwayat.filter(i => i.status === 'ASLI').length} transaksi valid terverifikasi.
                </p>
              </div>
              <button 
                onClick={exportDataToCSV}
                className="bg-[#09090b] text-white px-3 py-2 rounded-md text-[12px] font-semibold hover:bg-[#27272a] transition-colors"
              >
                Unduh CSV
              </button>
            </div>
            {riwayat.filter(i => i.status === 'ASLI').length === 0 ? (
              <p className="text-center text-[#a1a1aa] mt-10 text-[13px]">Belum ada catatan transaksi.</p>
            ) : (
              riwayat.filter(i => i.status === 'ASLI').map(renderItem)
            )}
          </div>
        )}
      </main>

      {/* PANEL (MODAL) RIWAYAT UANG PALSU */}
      {showPalsuModal && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowPalsuModal(false)}></div>
          <div className="relative bg-[#fafafa] w-full h-[75vh] rounded-t-3xl shadow-2xl flex flex-col">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 bg-[#e4e4e7] rounded-full"></div>
            </div>
            <div className="bg-[#fafafa] px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-[#e11d48] tracking-tight">Riwayat Uang Palsu</h2>
                <p className="text-[13px] text-[#71717a] mt-1">Total {jumlahPalsu} deteksi tidak valid</p>
              </div>
              <button onClick={() => setShowPalsuModal(false)} className="p-2 bg-white border border-[#e4e4e7] rounded-full text-[#09090b] hover:bg-[#f4f4f5]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="px-5 pb-5 overflow-y-auto flex-1">
              {riwayat.filter(i => i.status === 'PALSU').length === 0 ? (
                <p className="text-center text-[#a1a1aa] mt-10 text-[13px]">Sistem bersih. Belum ada catatan uang palsu.</p>
              ) : (
                riwayat.filter(i => i.status === 'PALSU').map(renderItem)
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 w-full bg-white flex border-t border-[#eeeeee] pb-6 pt-3 px-2 z-50">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className="flex-1 flex flex-col items-center justify-center outline-none"
        >
          <span className={`text-[13px] transition-colors ${activeTab === 'dashboard' ? 'text-[#09090b] font-bold' : 'text-[#a1a1aa] font-medium'}`}>
            Overview
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('rekap')} 
          className="flex-1 flex flex-col items-center justify-center outline-none"
        >
          <span className={`text-[13px] transition-colors ${activeTab === 'rekap' ? 'text-[#09090b] font-bold' : 'text-[#a1a1aa] font-medium'}`}>
            Rekap
          </span>
        </button>
      </nav>
    </div>
  );
}