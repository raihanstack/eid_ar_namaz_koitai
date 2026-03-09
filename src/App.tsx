import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import { 
  MapPin, 
  Plus, 
  Search, 
  Globe, 
  Navigation,
  Clock,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Info,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  MoonStar,
  Trash2,
  AlertTriangle,
  Lock,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import L from 'leaflet';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket = io();

// --- Types ---
interface Mosque {
  id: number;
  name_en: string;
  name_bn: string;
  lat: number;
  lng: number;
  eid_date: string;
  namaz_times: string[];
  true_votes: number;
  false_votes: number;
  status: 'pending' | 'approved' | 'rejected';
  distance?: number;
}

// --- Translations ---
const t = {
  title: "ঈদের নামাজ কয়টায়",
  search: "মসজিদ খুঁজুন...",
  addMosque: "মসজিদ যোগ করুন",
  mosqueNameBn: "মসজিদের নাম",
  date: "ঈদের তারিখ",
  time: "ঈদের সময়",
  submit: "জমা দিন",
  cancel: "বাতিল",
  verify: "এই তথ্য কি সঠিক?",
  yes: "হ্যাঁ",
  no: "না",
  nearby: "আমার কাছে",
  accuracy: "সঠিকতা",
  votes: "ভোট",
  locationPick: "অবস্থান নির্ধারণ করতে ম্যাপে ক্লিক করুন",
  success: "সফলভাবে জমা দেওয়া হয়েছে!",
  error: "একটি ত্রুটি ঘটেছে। আবার চেষ্টা করুন।",
  pickInstruction: "মসজিদের অবস্থান নির্ধারণ করতে ম্যাপের যেকোনো জায়গায় ক্লিক করুন",
  allMosques: "সব মসজিদ",
  distance: "দূরত্ব",
  within: "মধ্যে",
  km: "কিমি",
  anyDistance: "যেকোনো দূরত্ব",
  fetchingName: "নাম খোঁজা হচ্ছে...",
  addTime: "সময় যোগ করুন",
  namazTimes: "নামাজের সময়সূচী",
  jamatLabels: ["প্রথম জামাত", "দ্বিতীয় জামাত", "তৃতীয় জামাত", "চতুর্থ জামাত", "পঞ্চম জামাত"],
  shareInfo: "কমিউনিটির সাথে নামাজের সময়সূচী শেয়ার করুন।",
  selectedLocation: "নির্বাচিত অবস্থান",
  away: "দূরে",
  report: "রিপোর্ট করুন (৩টি রিপোর্টে মুছে যাবে)",
  remove: "সরাসরি মুছুন",
  confirmRemove: "আপনি কি নিশ্চিত যে আপনি এই মসজিদটি সরাসরি মুছে ফেলতে চান? ভুল তথ্য হলে তবেই মুছুন।",
  confirmRemoveTime: "আপনি কি নিশ্চিত যে আপনি এই নামাজের সময়টি মুছে ফেলতে চান?",
  reported: "রিপোর্ট সফলভাবে জমা দেওয়া হয়েছে!",
  reportedDeleted: "৩টি রিপোর্ট পূর্ণ হওয়ায় মসজিদটি মুছে ফেলা হয়েছে।",
};

const getJamatLabel = (index: number) => {
  const labels = t.jamatLabels;
  return labels[index] || `${index + 1}তম জামাত`;
};

// --- Components ---

const MapController = ({ 
  isPickingLocation, 
  onLocationPick,
  selectedMosqueId,
  mosques
}: { 
  isPickingLocation: boolean, 
  onLocationPick: (lat: number, lng: number) => void,
  selectedMosqueId: number | null,
  mosques: Mosque[]
}) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      if (isPickingLocation) {
        onLocationPick(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  useEffect(() => {
    if (selectedMosqueId) {
      const mosque = mosques.find(m => m.id === selectedMosqueId);
      if (mosque) {
        map.flyTo([mosque.lat, mosque.lng], 16, { duration: 1.5 });
      }
    }
  }, [selectedMosqueId, mosques, map]);

  return null;
};

export default function App() {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [isFetchingName, setIsFetchingName] = useState(false);
  const [newMosque, setNewMosque] = useState({ 
    name_en: '', 
    name_bn: '', 
    lat: 0, 
    lng: 0, 
    eid_date: '', 
    namaz_times: [''] 
  });
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [voterId, setVoterId] = useState<string>('');
  const [selectedMosqueId, setSelectedMosqueId] = useState<number | null>(null);
  const markerRefs = useRef<{ [key: number]: L.Marker | null }>({});

  useEffect(() => {
    let id = localStorage.getItem('voter_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('voter_id', id);
    }
    setVoterId(id);

    fetchMosques();

    socket.on('mosque_added', (mosque: Mosque) => {
      setMosques(prev => [...prev, mosque]);
    });

    socket.on('mosque_removed', ({ id }) => {
      setMosques(prev => prev.filter(m => m.id !== id));
    });

    socket.on('mosque_updated', ({ id, namaz_times }) => {
      setMosques(prev => prev.map(m => m.id === id ? { ...m, namaz_times } : m));
    });

    socket.on('vote_updated', ({ mosque_id, true_votes, false_votes }) => {
      setMosques(prev => prev.map(m => m.id === mosque_id ? { ...m, true_votes, false_votes } : m));
    });

    return () => {
      socket.off('mosque_added');
      socket.off('mosque_removed');
      socket.off('mosque_updated');
      socket.off('vote_updated');
    };
  }, []);

  const fetchMosques = async () => {
    const res = await fetch('/api/mosques');
    const data = await res.json();
    setMosques(data);
  };

  const handleLocationPick = async (lat: number, lng: number) => {
    setIsFetchingName(true);
    setNewMosque(prev => ({ ...prev, lat, lng }));
    setIsAddModalOpen(true);
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=bn`);
      const data = await res.json();
      const name = data.display_name.split(',')[0];
      setNewMosque(prev => ({ ...prev, name_bn: name, name_en: name }));
    } catch (err) {
      console.error('Reverse geocoding failed', err);
    } finally {
      setIsFetchingName(false);
    }
  };

  const handleAddNamazTimeExisting = async (mosqueId: number) => {
    const time = prompt('নতুন নামাজের সময় দিন (যেমন: 08:30 AM)');
    if (!time) return;

    const res = await fetch(`/api/namaz-times/${mosqueId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namaz_time: time })
    });

    if (!res.ok) {
      alert(t.error);
    }
  };

  const handleAddMosque = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty namaz times
    const cleanedTimes = newMosque.namaz_times.filter(t => t.trim() !== '');
    if (cleanedTimes.length === 0) {
      alert('অনুগ্রহ করে অন্তত একটি নামাজের সময় যোগ করুন');
      return;
    }

    const mosqueToSubmit = {
      ...newMosque,
      namaz_times: cleanedTimes
    };

    const res = await fetch('/api/mosques', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mosqueToSubmit)
    });
    if (res.ok) {
      setIsAddModalOpen(false);
      setIsPickingLocation(false);
      setNewMosque({ name_en: '', name_bn: '', lat: 0, lng: 0, eid_date: '', namaz_times: [''] });
    } else {
      alert(t.error);
    }
  };

  const addNamazTime = () => {
    setNewMosque(prev => ({
      ...prev,
      namaz_times: [...prev.namaz_times, '']
    }));
  };

  const removeNamazTime = (index: number) => {
    setNewMosque(prev => ({
      ...prev,
      namaz_times: prev.namaz_times.filter((_, i) => i !== index)
    }));
  };

  const updateNamazTime = (index: number, value: string) => {
    setNewMosque(prev => ({
      ...prev,
      namaz_times: prev.namaz_times.map((t, i) => i === index ? value : t)
    }));
  };

  const handleVote = async (mosqueId: number, isTrue: boolean) => {
    const res = await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mosque_id: mosqueId, is_true: isTrue, voter_id: voterId })
    });

    if (!res.ok) {
      alert(t.error);
    }
  };

  const handleReport = async (mosqueId: number) => {
    const reportedKey = `reported_${mosqueId}`;
    if (localStorage.getItem(reportedKey)) return;

    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mosque_id: mosqueId, reporter_id: voterId })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(reportedKey, 'true');
      if (data.deleted) {
        alert(t.reportedDeleted);
      } else {
        alert(t.report);
      }
    }
  };

  const handleRemoveMosque = async (mosqueId: number) => {
    if (!confirm(t.confirmRemove)) return;

    const res = await fetch(`/api/mosques/${mosqueId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      alert(t.error);
    }
  };

  const handleRemoveNamazTime = async (mosqueId: number, index: number) => {
    if (!confirm(t.confirmRemoveTime)) return;

    const res = await fetch(`/api/namaz-times/${mosqueId}/${index}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      alert(t.error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredMosques = useMemo(() => {
    return mosques
      .map(m => {
        if (userLocation) {
          return { ...m, distance: calculateDistance(userLocation[0], userLocation[1], m.lat, m.lng) };
        }
        return m;
      })
      .filter(m => {
        const matchesSearch = m.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.name_bn.includes(searchQuery);
        
        const matchesDate = dateFilter === '' || m.eid_date === dateFilter;
        const matchesDistance = distanceFilter === null || (m.distance !== undefined && m.distance <= distanceFilter);
        
        return matchesSearch && matchesDate && matchesDistance;
      });
  }, [mosques, searchQuery, dateFilter, distanceFilter, userLocation]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      alert('আপনার ব্রাউজারে জিওলোকেশন সাপোর্ট করে না');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert('আপনার অবস্থান খুঁজে পাওয়া যায়নি');
      }
    );
  };

  const onMosqueClick = (id: number) => {
    setSelectedMosqueId(id);
    const marker = markerRefs.current[id];
    if (marker) {
      marker.openPopup();
    }
  };

  const mosqueIcon = L.divIcon({
    html: `
      <div class="marker-moon-container">
        <div class="marker-moon-pulse"></div>
        <div class="marker-moon-main">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>
        </div>
      </div>
    `,
    className: 'custom-mosque-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 overflow-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[2000] bg-white/90 backdrop-blur-xl border-b border-stone-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-lg shadow-emerald-200">
            <MapPin size={22} />
          </div>
          <h1 className="text-lg font-bold tracking-tight hidden sm:block">{t.title}</h1>
        </div>

        <div className="flex-1 max-w-lg mx-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder={t.search}
              className="w-full pl-10 pr-4 py-2 bg-stone-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <input 
            type="date"
            className="hidden md:block px-4 py-2 bg-stone-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-stone-500"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <select
            className="hidden lg:block px-4 py-2 bg-stone-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 transition-all text-stone-500"
            value={distanceFilter || ''}
            onChange={(e) => setDistanceFilter(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t.anyDistance}</option>
            <option value="1">1 {t.km}</option>
            <option value="5">5 {t.km}</option>
            <option value="10">10 {t.km}</option>
            <option value="25">25 {t.km}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button 
            className="p-2 hover:bg-stone-100 rounded-full transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-600"
          >
            <Globe size={16} />
            <span className="hidden xs:inline">বাংলা</span>
          </button>
        </div>
      </nav>

      {/* Top Overlay List */}
      <div className="fixed top-16 left-0 right-0 z-[1000] bg-white/80 backdrop-blur-md border-b border-stone-100 py-2 overflow-x-auto no-scrollbar shadow-sm">
        <div className="flex items-center gap-2 px-4 min-w-max">
          <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400 uppercase tracking-widest mr-2 border-r border-stone-200 pr-4">
            <Info size={12} />
            {t.allMosques}
          </div>
          {filteredMosques.map(mosque => (
            <button
              key={mosque.id}
              onClick={() => onMosqueClick(mosque.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all border whitespace-nowrap",
                selectedMosqueId === mosque.id 
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md" 
                  : "bg-white text-stone-600 border-stone-200 hover:border-emerald-300 hover:text-emerald-600"
              )}
            >
              {mosque.name_bn}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="h-screen w-full pt-28">
        <MapContainer 
          center={[23.8103, 90.4125]} 
          zoom={13} 
          className="h-full w-full z-0"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <MapController 
            isPickingLocation={isPickingLocation} 
            onLocationPick={handleLocationPick}
            selectedMosqueId={selectedMosqueId}
            mosques={mosques}
          />
          
          {filteredMosques.map(mosque => (
            <Marker 
              key={mosque.id} 
              position={[mosque.lat, mosque.lng]}
              ref={(el) => (markerRefs.current[mosque.id] = el)}
              icon={mosqueIcon}
              eventHandlers={{
                click: () => setSelectedMosqueId(mosque.id)
              }}
            >
              <Tooltip 
                permanent 
                direction="top" 
                offset={[0, -20]} 
                className="custom-tooltip"
              >
                {mosque.name_bn}
              </Tooltip>
              <Popup className="custom-popup" offset={[0, -10]}>
                <div className="p-0 min-w-[260px] overflow-hidden bg-white rounded-[24px]">
                  <div className="bg-emerald-600 p-4 text-white">
                    <h3 className="font-bold text-xl leading-tight">
                      {mosque.name_bn}
                    </h3>
                    {mosque.distance !== undefined && (
                      <div className="flex items-center gap-1.5 mt-2 text-emerald-100 font-medium text-xs">
                        <Navigation size={12} />
                        {mosque.distance.toFixed(1)} {t.km} {t.away}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div className="bg-stone-50 p-3 rounded-2xl border border-stone-100">
                      <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1.5 flex items-center gap-1.5">
                        <Calendar size={12} className="text-emerald-600" />
                        {t.date}
                      </div>
                      <div className="text-sm font-bold text-stone-700">
                        {mosque.eid_date}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Clock size={12} className="text-emerald-600" />
                        {t.namazTimes}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {mosque.namaz_times.map((time, idx) => (
                          <div key={idx} className="relative bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-100 shadow-sm flex flex-col items-center min-w-[80px]">
                            <span className="text-[8px] uppercase tracking-tighter opacity-60 mb-0.5">{getJamatLabel(idx)}</span>
                            {time}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveNamazTime(mosque.id, idx);
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors active:scale-90"
                              title={t.remove}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNamazTimeExisting(mosque.id);
                          }}
                          className="flex flex-col items-center justify-center bg-stone-50 text-stone-400 px-3 py-2 rounded-xl text-[10px] font-bold border border-stone-200 border-dashed hover:bg-stone-100 hover:text-emerald-600 hover:border-emerald-200 transition-all min-w-[80px]"
                        >
                          <Plus size={14} className="mb-0.5" />
                          {t.addTime}
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-stone-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">{t.verify}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button 
                          onClick={() => handleReport(mosque.id)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 transition-all font-bold text-[10px] border border-orange-100"
                          title={t.report}
                        >
                          <MoonStar size={14} />
                          {t.report.split(' ')[0]}
                        </button>
                        <button 
                          onClick={() => handleRemoveMosque(mosque.id)}
                          className="flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all font-bold text-[10px] border border-red-100"
                          title={t.remove}
                        >
                          <Trash2 size={14} />
                          {t.remove}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleVote(mosque.id, true)}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all font-bold text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 border border-emerald-100 shadow-sm"
                        >
                          <ThumbsUp size={16} />
                          {t.yes} ({mosque.true_votes})
                        </button>
                        <button 
                          onClick={() => handleVote(mosque.id, false)}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl transition-all font-bold text-sm bg-red-50 text-red-700 hover:bg-red-100 active:scale-95 border border-red-100 shadow-sm"
                        >
                          <ThumbsDown size={16} />
                          {t.no} ({mosque.false_votes})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {userLocation && <Marker position={userLocation} />}
        </MapContainer>
      </div>

      {/* Location Pick Instruction Overlay */}
      <AnimatePresence>
        {isPickingLocation && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-emerald-500/50 backdrop-blur-md"
          >
            <Navigation size={20} className="animate-pulse" />
            <span className="text-sm font-bold">{t.pickInstruction}</span>
            <button 
              onClick={() => setIsPickingLocation(false)}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-[1000]">
        <button 
          onClick={getUserLocation}
          className="p-4 bg-white text-stone-700 rounded-full shadow-2xl hover:bg-stone-50 transition-all active:scale-95 border border-stone-200"
        >
          <Navigation size={24} />
        </button>
        <button 
          onClick={() => setIsPickingLocation(true)}
          className={cn(
            "p-4 rounded-full shadow-2xl transition-all active:scale-95 flex items-center gap-2 px-6",
            isPickingLocation ? "bg-stone-200 text-stone-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"
          )}
          disabled={isPickingLocation}
        >
          <Plus size={24} />
          <span className="font-bold">{t.addMosque}</span>
        </button>
      </div>

      {/* Add Mosque Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 md:p-12 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-stone-900">{t.addMosque}</h2>
                    <p className="text-stone-500 mt-1">{t.shareInfo}</p>
                  </div>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <form onSubmit={handleAddMosque} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">{t.mosqueNameBn}</label>
                    <div className="relative">
                      <input 
                        type="text" required
                        className="w-full px-5 py-4 bg-stone-50 rounded-2xl border border-stone-100 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                        value={newMosque.name_bn}
                        onChange={e => setNewMosque({...newMosque, name_bn: e.target.value, name_en: e.target.value})}
                      />
                      {isFetchingName && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600 animate-pulse">
                          {t.fetchingName}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">{t.date}</label>
                      <input 
                        type="date" required
                        className="w-full px-5 py-4 bg-stone-50 rounded-2xl border border-stone-100 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                        value={newMosque.eid_date}
                        onChange={e => setNewMosque({...newMosque, eid_date: e.target.value})}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">{t.namazTimes}</label>
                        <button 
                          type="button"
                          onClick={addNamazTime}
                          className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1.5 border border-emerald-100"
                        >
                          <Plus size={14} />
                          {t.addTime}
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {newMosque.namaz_times.map((time, idx) => (
                          <div key={idx} className="flex gap-2">
                            <div className="flex-1 relative">
                              <span className="absolute -top-2 left-3 bg-white px-1 text-[8px] font-bold text-emerald-600 z-10">
                                {getJamatLabel(idx)}
                              </span>
                              <input 
                                type="time" required
                                className="w-full px-5 py-3 bg-stone-50 rounded-2xl border border-stone-100 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                                value={time}
                                onChange={e => updateNamazTime(idx, e.target.value)}
                              />
                            </div>
                            {newMosque.namaz_times.length > 1 && (
                              <button 
                                type="button"
                                onClick={() => removeNamazTime(idx)}
                                className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <X size={20} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">{t.selectedLocation}</div>
                        <div className="text-sm font-mono text-stone-600 mt-0.5">
                          {newMosque.lat.toFixed(6)}, {newMosque.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>
                    <div className="text-emerald-600">
                      <CheckCircle size={24} />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button 
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 py-5 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all active:scale-95"
                    >
                      {t.cancel}
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 active:scale-95"
                    >
                      {t.submit}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .leaflet-container {
          background: #f5f5f4 !important;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 24px;
          padding: 8px;
          box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.15);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .custom-popup .leaflet-popup-tip {
          display: none;
        }
        .custom-popup .leaflet-popup-content {
          margin: 12px;
        }
        .custom-tooltip {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 4px 8px;
          font-weight: 700;
          font-size: 10px;
          color: #065f46;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          white-space: nowrap;
        }
        .custom-tooltip:before {
          border-top-color: white;
        }
        .marker-flag-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .marker-flag-main {
          background: #059669;
          color: white;
          padding: 8px;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          border: 2px solid white;
          position: relative;
          z-index: 2;
        }
        .marker-flag-pulse {
          position: absolute;
          width: 60px;
          height: 60px;
          background: rgba(16, 185, 129, 0.3);
          border-radius: 50%;
          animation: pulse 2s infinite;
          z-index: 1;
        }
        @keyframes pulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
