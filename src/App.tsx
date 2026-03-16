import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Fix Leaflet Default Icon issue in production ---
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import {
  Search, Plus, Navigation, ThumbsUp, ThumbsDown,
  MapPin, Clock, Calendar, CheckCircle, X,
  ChevronRight, ChevronLeft, Trash2, MoonStar,
  Globe, Info, Share2, AlertCircle, Facebook, Github
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility: Tailwind Class Merger ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Supabase Config ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Interfaces ---
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
  report_count: number;
  distance?: number;
}

// --- Professional Bengali Translations ---
const t = {
  title: "ঈদের নামাজ কয়টায়",
  search: "অনুসন্ধান করুন...",
  addMosque: "নামাজের সময়সূচী যুক্ত করুন",
  myLocation: "আমার বর্তমান অবস্থান",
  anyDistance: "যেকোনো দূরত্ব",
  km: "কিমি",
  away: "দূরে",
  date: "ঈদের তারিখ",
  namazTimes: "নামাজের সময়সূচী",
  verify: "এই তথ্যটি কি সঠিক? আপনার মতামত দিন",
  yes: "হ্যাঁ, সঠিক",
  no: "না, ভুল",
  report: "ভুল তথ্যের জন্য রিপোর্ট করুন",
  remove: "মুছে ফেলুন",
  confirmRemove: "আপনি কি নিশ্চিতভাবে এই জামাতের তথ্যটি মুছে ফেলতে চান?",
  confirmRemoveTime: "আপনি কি এই নির্দিষ্ট সময়টি মুছে ফেলতে চান?",
  reported: "আপনার রিপোর্টটি সফলভাবে গ্রহণ করা হয়েছে।",
  reportedDeleted: "অতিরিক্ত রিপোর্টের কারণে এই তথ্যটি স্বয়ংক্রিয়ভাবে মুছে ফেলা হয়েছে।",
  error: "দুঃখিত, কোনো একটি সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।",
  locationPick: "ম্যাপে ক্লিক করে সঠিক অবস্থানটি চিহ্নিত করুন",
  pickInstruction: "ম্যাপের সঠিক স্থানে ক্লিক করে মসজিদের অবস্থানটি নিশ্চিত করুন",
  mosqueNameBn: "মসজিদ বা স্থানের নাম (বাংলায়)",
  selectedLocation: "নির্বাচিত ভৌগোলিক অবস্থান",
  submit: "সম্পূর্ণ তথ্য জমা দিন",
  cancel: "বাতিল করুন",
  allMosques: "নিকটস্থ সব মসজিদসমূহ",
  shareInfo: "আপনার এলাকার ঈদের জামাতের সঠিক সময় জানিয়ে অন্যদের সময় বাঁচাতে সাহায্য করুন",
  addTime: "আরো জামাত বা সময় যুক্ত করুন",
};

// --- Helpers ---
const formatDateBn = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
};

const convertBnToEn = (str: string) => {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.split('').map(c => bn.indexOf(c) !== -1 ? bn.indexOf(c) : c).join('');
};

const getJamatLabel = (index: number) => {
  const labels = ['১ম জামাত', '২য় জামাত', '৩য় জামাত', '৪র্থ জামাত', '৫ম জামাত'];
  return labels[index] || `${index + 1}তম জামাত`;
};

// --- Components ---

function MapController({ isPickingLocation, onLocationPick, selectedMosqueId, mosques, userLocation }: any) {
  const map = useMap();

  useEffect(() => {
    if (isPickingLocation) {
      map.getContainer().style.cursor = 'crosshair';
      const onClick = (e: L.LeafletMouseEvent) => {
        onLocationPick(e.latlng.lat, e.latlng.lng);
      };
      map.on('click', onClick);
      return () => {
        map.off('click', onClick);
        map.getContainer().style.cursor = '';
      };
    }
  }, [isPickingLocation, map, onLocationPick]);

  useEffect(() => {
    if (selectedMosqueId) {
      const selected = mosques.find((m: any) => m.id === selectedMosqueId);
      if (selected) {
        map.flyTo([selected.lat, selected.lng], 16, { duration: 1.5 });
      }
    }
  }, [selectedMosqueId, mosques, map]);

  useEffect(() => {
    if (userLocation) {
      map.flyTo(userLocation, 14);
    }
  }, [userLocation, map]);

  return null;
}

// --- Components ---

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 20, scale: 0.9 }}
    className={cn(
      "fixed bottom-28 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md min-w-[280px] max-w-[90vw]",
      type === 'success' ? "bg-emerald-600/95 border-emerald-400/30 text-white" :
        type === 'error' ? "bg-rose-600/95 border-rose-400/30 text-white" :
          "bg-slate-900/95 border-slate-700/30 text-white"
    )}
  >
    {type === 'success' && <CheckCircle size={20} className="shrink-0" />}
    {type === 'error' && <AlertCircle size={20} className="shrink-0" />}
    {type === 'info' && <Info size={20} className="shrink-0" />}
    <span className="text-sm font-bold tracking-tight">{message}</span>
    <button onClick={onClose} className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
  </motion.div>
);

const BnDateInput = ({ value, onChange, placeholder, className }: any) => {
  return (
    <input
      type="date"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
};

export default function App() {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [isFetchingName, setIsFetchingName] = useState(false);
  const [selectedMosqueId, setSelectedMosqueId] = useState<number | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const [newMosque, setNewMosque] = useState<{
    name_en: string;
    name_bn: string;
    lat: number;
    lng: number;
    eid_date: string;
    namaz_times: string[];
  }>({
    name_en: '',
    name_bn: '',
    lat: 0,
    lng: 0,
    eid_date: '',
    namaz_times: ['']
  });

  const markerRefs = useRef<{ [key: number]: L.Marker | null }>({});
  const voterId = useMemo(() => {
    let id = localStorage.getItem('voter_id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 11);
      localStorage.setItem('voter_id', id);
    }
    return id;
  }, []);

  useEffect(() => {
    fetchMosques();

    const subscription = supabase
      .channel('mosque-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mosques' }, () => fetchMosques())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'namaz_times' }, () => fetchMosques())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => fetchMosques())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => fetchMosques())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchMosques = async () => {
    try {
      const { data, error } = await supabase
        .from('mosques')
        .select(`
          *,
          namaz_times (namaz_time),
          votes (is_true),
          reports (id)
        `)
        .eq('status', 'approved');

      if (error) showToast(t.error, 'error');

      const formatted = data.map((m: any) => {
        const trueVotes = m.votes?.filter((v: any) => v.is_true === 1 || v.is_true === true).length || 0;
        const falseVotes = m.votes?.filter((v: any) => v.is_true === 0 || v.is_true === false).length || 0;

        return {
          ...m,
          namaz_times: m.namaz_times?.map((nt: any) => nt.namaz_time) || [],
          true_votes: trueVotes,
          false_votes: falseVotes,
          report_count: m.reports?.length || 0
        };
      });

      setMosques(formatted);
    } catch (err) {
      console.error('Error fetching mosques:', err);
    }
  };

  const handleLocationPick = async (lat: number, lng: number) => {
    setIsFetchingName(true);
    setNewMosque(prev => ({ ...prev, lat, lng }));
    setIsAddModalOpen(true);
    setIsPickingLocation(false);
    setActiveStep(1); // Set to first step when picking

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=bn`);
      const data = await res.json();
      const addr = data.address;
      const name = addr.mosque || addr.amenity || addr.suburb || addr.road || data.display_name.split(',')[0];
      setNewMosque(prev => ({ ...prev, name_bn: name, name_en: name }));
    } catch (err) {
      console.error('Reverse geocoding failed', err);
    } finally {
      setIsFetchingName(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleAddNamazTimeExisting = async (mosqueId: number) => {
    const time = prompt('নতুন নামাজের সময় দিন (যেমন: 08:30 AM)');
    if (!time) return;

    const { error } = await supabase
      .from('namaz_times')
      .insert([{ mosque_id: mosqueId, namaz_time: time }]);

    if (error) showToast(t.error, 'error');
  };

  const handleAddMosque = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTimes = newMosque.namaz_times.filter(t => t.trim() !== '');
    if (cleanedTimes.length === 0) {
      showToast('অনুগ্রহ করে অন্তত একটি নামাজের সময় যোগ করুন', 'info');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: mosque, error: mosqueError } = await supabase
        .from('mosques')
        .insert([{
          name_en: newMosque.name_en,
          name_bn: newMosque.name_bn,
          lat: newMosque.lat,
          lng: newMosque.lng,
          eid_date: newMosque.eid_date,
          status: 'approved'
        }])
        .select()
        .single();

      if (mosqueError) throw mosqueError;

      const timesToInsert = cleanedTimes.map(time => ({
        mosque_id: mosque.id,
        namaz_time: time
      }));

      const { error: timesError } = await supabase
        .from('namaz_times')
        .insert(timesToInsert);

      if (timesError) throw timesError;

      setIsAddModalOpen(false);
      setNewMosque({ name_en: '', name_bn: '', lat: 0, lng: 0, eid_date: '', namaz_times: [''] });
      fetchMosques();
    } catch (err) {
      console.error('Submission failed:', err);
      showToast(t.error, 'error');
    } finally {
      setIsSubmitting(false);
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
    const votedKey = `voted_${mosqueId}`;
    const localVote = localStorage.getItem(votedKey);
    const newVoteString = isTrue ? 'yes' : 'no';

    if (localVote === newVoteString) {
      showToast('আপনার ভোট আগেই গ্রহণ করা হয়েছে।', 'info');
      return;
    }

    try {
      // Check if completely new or just a switch
      const { data: existingVotes, error: fetchError } = await supabase
        .from('votes')
        .select('id')
        .eq('voter_id', voterId)
        .eq('mosque_id', mosqueId);

      if (fetchError) throw fetchError;

      const newVoteValue = isTrue ? 1 : 0;

      if (existingVotes && existingVotes.length > 0) {
        const { error: updateError } = await supabase
          .from('votes')
          .update({ is_true: newVoteValue })
          .eq('id', existingVotes[0].id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('votes')
          .insert([{
            voter_id: voterId,
            mosque_id: mosqueId,
            is_true: newVoteValue
          }]);

        if (insertError) throw insertError;
      }

      localStorage.setItem(votedKey, newVoteString);
      fetchMosques();
    } catch (err) {
      console.error('Voting failed:', err);
      showToast(t.error, 'error');
    }
  };

  const handleReport = async (mosqueId: number) => {
    const reportedKey = `reported_${mosqueId}`;
    if (localStorage.getItem(reportedKey)) return;

    try {
      const { error } = await supabase
        .from('reports')
        .insert([{
          mosque_id: mosqueId,
          reporter_id: voterId,
          reason: 'Reported'
        }]);

      if (error) showToast(t.error, 'error');
      localStorage.setItem(reportedKey, 'true');

      const { count, error: countError } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('mosque_id', mosqueId);

      if (countError) throw countError;

      if (count && count >= 3) {
        await supabase.from('mosques').delete().eq('id', mosqueId);
        alert(t.reportedDeleted);
      } else {
        alert(t.reported);
      }
    } catch (err) {
      console.error('Reporting failed:', err);
    }
  };

  const handleRemoveMosque = async (mosqueId: number) => {
    if (!confirm(t.confirmRemove)) return;
    try {
      await supabase.from('namaz_times').delete().eq('mosque_id', mosqueId);
      await supabase.from('votes').delete().eq('mosque_id', mosqueId);
      await supabase.from('reports').delete().eq('mosque_id', mosqueId);
      const { error } = await supabase.from('mosques').delete().eq('id', mosqueId);
      if (error) throw error;
      fetchMosques();
    } catch (err) {
      console.error('Removal failed:', err);
      showToast(t.error, 'error');
    }
  };

  const handleRemoveNamazTime = async (mosqueId: number, index: number) => {
    if (!confirm(t.confirmRemoveTime)) return;
    try {
      const { data: times, error: listError } = await supabase
        .from('namaz_times')
        .select('id')
        .eq('mosque_id', mosqueId)
        .order('id', { ascending: true });

      if (listError) throw listError;

      const timeToDelete = times[index];
      if (timeToDelete) {
        const { error } = await supabase
          .from('namaz_times')
          .delete()
          .eq('id', timeToDelete.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Time removal failed:', err);
      showToast(t.error, 'error');
    }
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
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch = query === '' ||
          (m.name_en && m.name_en.toLowerCase().includes(query)) ||
          (m.name_bn && m.name_bn.includes(query));

        const matchesDate = dateFilter === '' || m.eid_date === dateFilter;
        const matchesDistance = !distanceFilter || !userLocation || (m.distance !== undefined && m.distance <= distanceFilter);

        return matchesSearch && matchesDate && matchesDistance;
      });
  }, [mosques, searchQuery, dateFilter, distanceFilter, userLocation]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      showToast('আপনার ব্রাউজারে জিওলোকেশন সাপোর্ট করে না', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      (err) => {
        console.error("Geolocation error:", err);
        showToast('আপনার অবস্থান খুঁজে পাওয়া যায়নি', 'error');
      }
    );
  };

  const onMosqueClick = (id: number) => {
    setSelectedMosqueId(id);
    const marker = markerRefs.current[id];
    if (marker) marker.openPopup();
  };

  const mosqueIcon = L.divIcon({
    html: `
      <div class="marker-flag-container">
        <div class="marker-flag-pulse"></div>
        <div class="marker-flag-main">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" fill="white" stroke="#10B981" stroke-width="2"/>
            <path d="M12 6V18M8 10V14M16 10V14" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    `,
    className: 'custom-mosque-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const userLocationIcon = L.divIcon({
    html: `
      <div class="user-location-marker">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    className: 'custom-user-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <div className="h-[100dvh] flex flex-col bg-stone-50 font-sans text-stone-900 overflow-hidden">
      {/* Navbar */}
      <nav className="shrink-0 h-[60px] md:h-[72px] relative z-[2000] bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 px-4 md:px-8 flex items-center justify-between gap-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 shrink-0 group cursor-pointer">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="bg-emerald-50 p-2 rounded-xl text-emerald-600 shadow-sm border border-emerald-100 shrink-0"
            >
              <img src="/favicon.png" className="w-6 h-6 md:w-8 md:h-8 object-contain" alt="logo" />
            </motion.div>
            <div className="flex flex-col">
              <h1 className="text-base md:text-2xl font-black tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
                <span className="text-emerald-600">ঈদের</span> নামাজ কয়টায়
              </h1>
              <div className="hidden xs:flex items-center gap-2 mt-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em]">নামাজের সময় ও স্থান</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end flex-1 max-w-[200px] xs:max-w-[280px] sm:max-w-xs md:max-w-md ml-auto">
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder={t.search}
              className="w-full pl-12 pr-10 py-3 bg-slate-100/50 border border-transparent rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all font-bold text-slate-700 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200/50 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-90"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Quick Access Sidebar/Overlay */}
      <div className="shrink-0 h-[48px] relative z-[1000] bg-white border-b border-stone-100 overflow-x-auto no-scrollbar flex items-center px-4">
        <div className="flex items-center gap-2 min-w-max">
          <div className="text-[10px] md:text-xs font-black text-slate-300 uppercase tracking-widest mr-2 border-r border-slate-100 pr-4">{t.allMosques}</div>
          {filteredMosques.map(m => (
            <button
              key={m.id}
              onClick={() => onMosqueClick(m.id)}
              className={cn(
                "px-5 py-2 md:px-6 md:py-2.5 rounded-full text-xs md:text-sm font-bold transition-all border whitespace-nowrap",
                selectedMosqueId === m.id
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100/50 scale-105"
                  : "bg-white text-slate-500 border-slate-200/60 hover:border-emerald-200 hover:text-emerald-600 hover:bg-emerald-50/30"
              )}
            >
              {m.name_bn}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <MapContainer center={[23.8103, 90.4125]} zoom={13} className="h-full w-full z-0" zoomControl={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapController isPickingLocation={isPickingLocation} onLocationPick={handleLocationPick} selectedMosqueId={selectedMosqueId} mosques={mosques} userLocation={userLocation} />

          {filteredMosques.map(mosque => (
            <Marker
              key={mosque.id}
              position={[mosque.lat, mosque.lng]}
              ref={(el) => (markerRefs.current[mosque.id] = el)}
              icon={mosqueIcon}
              eventHandlers={{ click: () => setSelectedMosqueId(mosque.id) }}
            >
              <Tooltip permanent direction="top" offset={[0, -20]} className="custom-tooltip">{mosque.name_bn}</Tooltip>
              <Popup className="custom-popup" offset={[0, -10]}>
                <div className="w-[280px] bg-white rounded-[24px] overflow-hidden">
                  <div className="bg-emerald-600 p-5 text-white relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMosqueId(null);
                        const marker = markerRefs.current[mosque.id];
                        if (marker) marker.closePopup();
                      }}
                      className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                    >
                      <X size={18} />
                    </button>
                    <h3 className="font-black text-xl md:text-2xl leading-tight tracking-tight pr-8">{mosque.name_bn}</h3>
                    {mosque.distance !== undefined && (
                      <div className="flex items-center gap-1.5 mt-2.5 text-emerald-100 font-bold text-[11px] md:text-xs uppercase tracking-widest">
                        <Navigation size={12} />
                        {mosque.distance.toFixed(1)} {t.km} {t.away}
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-5">
                    <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-100">
                      <div className="text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-slate-400 font-black mb-2 flex items-center gap-2">
                        <Calendar size={14} className="text-emerald-500" />
                        {t.date}
                      </div>
                      <div className="text-base md:text-lg font-black text-slate-800 tracking-tight">{formatDateBn(mosque.eid_date)}</div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                        <Clock size={14} className="text-emerald-500" />
                        {t.namazTimes}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {mosque.namaz_times.map((time, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs md:text-sm font-black text-slate-700 shadow-sm flex items-center gap-2">
                            <span className="text-emerald-600 text-[10px] border-r border-slate-100 pr-2">{getJamatLabel(idx).split(' ')[0]}</span>
                            {time}
                          </div>
                        ))}
                        <button onClick={(e) => { e.stopPropagation(); handleAddNamazTimeExisting(mosque.id); }} className="flex flex-col items-center justify-center bg-stone-50 text-stone-400 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-stone-200 border-dashed hover:bg-stone-100 hover:text-emerald-600 transition-all min-w-[80px]">
                          <Plus size={14} className="mb-0.5" />
                          যুক্ত করুন
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-stone-100">
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <button onClick={() => handleReport(mosque.id)} className="flex items-center justify-center gap-2 py-2 bg-orange-50 text-orange-700 rounded-xl font-bold text-[10px] border border-orange-100 uppercase tracking-widest">
                          <MoonStar size={12} />
                          রিপোর্ট
                        </button>
                        {/* <button onClick={() => handleRemoveMosque(mosque.id)} className="flex items-center justify-center gap-2 py-2 bg-red-50 text-red-700 rounded-xl font-bold text-[10px] border border-red-100 uppercase tracking-widest">
                          <Trash2 size={12} />
                          মুছুন
                        </button> */}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleVote(mosque.id, true)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 border border-emerald-100 shadow-sm transition-all">
                          <ThumbsUp size={14} />
                          {t.yes} ({mosque.true_votes})
                        </button>
                        <button onClick={() => handleVote(mosque.id, false)} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-xs bg-red-50 text-red-700 hover:bg-red-100 active:scale-95 border border-red-100 shadow-sm transition-all">
                          <ThumbsDown size={14} />
                          {t.no} ({mosque.false_votes})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          {userLocation && <Marker position={userLocation} icon={userLocationIcon} />}
        </MapContainer>




        {/* Floating Action Buttons */}
        <div className="fixed bottom-20 right-4 md:right-8 flex flex-col items-end gap-3 z-[1500]">
          <button
            onClick={getUserLocation}
            className="h-12 md:h-14 bg-white text-slate-700 rounded-full shadow-xl hover:bg-slate-50 transition-all active:scale-95 border border-slate-200 flex items-center gap-3 px-5 group"
          >
            <Navigation size={22} className="text-emerald-600 group-hover:rotate-12 transition-transform" />
            <span className="text-sm font-bold pt-0.5">{t.myLocation}</span>
          </button>

          <button
            onClick={() => setIsPickingLocation(true)}
            className={cn(
              "h-14 md:h-16 rounded-full shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 px-8",
              isPickingLocation ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
            )}
            disabled={isPickingLocation}
          >
            <Plus size={24} className="shrink-0 md:size-8" />
            <span className="font-black text-sm md:text-lg pt-0.5 tracking-tight uppercase">{t.addMosque}</span>
          </button>
        </div>

        {/* Location Pick Helper */}
        <AnimatePresence>
          {isPickingLocation && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2000] bg-slate-900/95 text-white px-8 py-5 rounded-[28px] shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-xl min-w-[300px] justify-center">
              <div className="bg-emerald-500 p-2.5 rounded-xl animate-pulse shadow-lg shadow-emerald-500/20"><MapPin size={22} /></div>
              <span className="text-sm md:text-base font-black tracking-tight">{t.pickInstruction}</span>
              <button type="button" onClick={() => setIsPickingLocation(false)} className="ml-4 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <footer className="shrink-0 h-[44px] md:h-[60px] bg-white border-t border-slate-100 flex items-center px-4 relative z-[2000]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-600/10 p-1.5 rounded-lg text-emerald-600">
              <img src="/favicon.png" className="w-5 h-5 md:w-6 md:h-6 object-contain" alt="logo" />
            </div>
            <h2 className="text-xs md:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span className="text-emerald-600">ঈদের</span> নামাজ কয়টায়
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://facebook.com/raihanstack"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-black transition-colors group"
            >
              <Facebook size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest hidden xs:block">
                Facebook
              </span>
            </a>
            <a
              href="https://github.com/raihanstack"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full hover:bg-blue-700 transition-colors group"
            >
              <Github size={18} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest hidden xs:block">
                Github
              </span>
            </a>

            <div className="text-[11px] md:text-sm text-slate-600 font-bold uppercase tracking-wider">
              &copy; {new Date().getFullYear()} raihanstack
            </div>
          </div>
        </div>
      </footer>

      {/* Add Mosque Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="bg-emerald-600 p-8 text-white relative">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="absolute top-8 right-8 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                <div className="flex items-center gap-4 mb-3">
                  <div className="bg-white p-3 rounded-2xl text-emerald-600 shadow-2xl scale-110"><Plus size={28} /></div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">{t.addMosque}</h2>
                </div>
                <p className="text-emerald-50/70 text-sm md:text-base font-bold leading-relaxed max-w-md">{t.shareInfo}</p>

                <div className="flex gap-2 mt-8">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", activeStep >= step ? "bg-white" : "bg-white/10")} />
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                <form onSubmit={handleAddMosque} className="space-y-6">
                  {activeStep === 1 && (
                    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                      <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600"><MapPin size={24} /></div>
                          <div>
                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-0.5">{t.selectedLocation}</div>
                            <div className="text-sm font-mono text-stone-600">{newMosque.lat.toFixed(5)}, {newMosque.lng.toFixed(5)}</div>
                          </div>
                        </div>
                        <CheckCircle size={24} className="text-emerald-500" />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">{t.mosqueNameBn}</label>
                          <input
                            type="text" required placeholder="মসজিদের নাম লিখুন..."
                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-base focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-stone-700 outline-none"
                            value={newMosque.name_bn}
                            onChange={(e) => setNewMosque(prev => ({ ...prev, name_bn: e.target.value, name_en: e.target.value }))}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 2 && (
                    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">ঈদের তারিখ</label>
                        <BnDateInput
                          className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-base focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-stone-700 outline-none"
                          value={newMosque.eid_date}
                          onChange={(val: string) => setNewMosque(prev => ({ ...prev, eid_date: val }))}
                        />
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 3 && (
                    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1 block">{t.namazTimes}</label>
                        <div className="grid grid-cols-1 gap-3">
                          {newMosque.namaz_times.map((time, index) => (
                            <div key={index} className="flex gap-2">
                              <div className="flex-1 bg-stone-50 rounded-2xl border border-stone-100 flex items-center px-5 focus-within:border-emerald-500 transition-all">
                                <Clock size={18} className="text-stone-400 mr-3" />
                                <input
                                  type="time" required
                                  className="w-full py-4 bg-transparent border-none focus:ring-0 text-base font-bold text-stone-700"
                                  value={time}
                                  onChange={(e) => updateNamazTime(index, e.target.value)}
                                />
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg ml-2">{getJamatLabel(index).split(' ')[0]}</span>
                              </div>
                              {newMosque.namaz_times.length > 1 && (
                                <button type="button" onClick={() => removeNamazTime(index)} className="p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors shrink-0"><Trash2 size={20} /></button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={addNamazTime} className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold border-2 border-dashed border-emerald-200 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 mt-2">
                          <Plus size={20} /> {t.addTime}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-8 border-t border-slate-100">
                    {activeStep > 1 && (
                      <button type="button" onClick={() => setActiveStep(prev => prev - 1)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <ChevronLeft size={20} /> পিছনে
                      </button>
                    )}
                    {activeStep < 3 ? (
                      <button type="button" onClick={() => setActiveStep(prev => prev + 1)} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center justify-center gap-2">
                        পরবর্তী <ChevronRight size={20} />
                      </button>
                    ) : (
                      <button type="submit" disabled={isSubmitting} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50">
                        {isSubmitting ? "তথ্য যুক্ত করা হচ্ছে..." : t.submit}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .leaflet-container { background: #f5f5f4 !important; }
        .custom-popup .leaflet-popup-content-wrapper { border-radius: 24px; padding: 0; overflow: hidden; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.15); border: 1px solid rgba(0,0,0,0.05); }
        .custom-popup .leaflet-popup-close-button { display: none; }
        .custom-popup .leaflet-popup-tip { display: none; }
        .custom-popup .leaflet-popup-content { margin: 0; width: 280px !important; }
        .custom-tooltip { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 4px 8px; font-weight: 800; font-size: 10px; color: #065f46; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); white-space: nowrap; }
        .custom-tooltip:before { border-top-color: white; }
        .marker-flag-container { position: relative; display: flex; align-items: center; justify-content: center; }
        .marker-flag-main { background: #059669; color: white; padding: 8px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 2px solid white; position: relative; z-index: 2; }
        .marker-flag-pulse { position: absolute; width: 60px; height: 60px; background: rgba(16, 185, 129, 0.3); border-radius: 50%; animation: pulse 2s infinite; z-index: 1; }
        @keyframes pulse { 0% { transform: scale(0.5); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }
      `}</style>
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
