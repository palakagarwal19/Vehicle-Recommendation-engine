// hooks/useVehicles.js
import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function useVehicles() {
  const [vehicles,          setVehicles]          = useState([]);
  const [vehiclesLoading,   setVehiclesLoading]   = useState(true);
  const [vehiclesLoadingMore, setVehiclesLoadingMore] = useState(false);
  const [search,            setSearchRaw]          = useState('');
  const searchDebounce = useRef(null);

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    setVehiclesLoading(true);
    setVehicles([]);
    const PAGE_SIZE = 200;
    let page = 1, totalPages = 1;
    try {
      while (page <= totalPages) {
        const res   = await fetch(`${API}/vehicles?page=${page}&limit=${PAGE_SIZE}`);
        const json  = await res.json();
        const batch = Array.isArray(json) ? json : (json.vehicles ?? []);
        totalPages  = json.pages ?? 1;
        setVehicles(prev => [...prev, ...batch]);
        if (page === 1) {
          setVehiclesLoading(false);
          if (totalPages > 1) setVehiclesLoadingMore(true);
        }
        page++;
      }
    } catch (e) {
      console.error('Failed to load vehicles:', e);
      setVehiclesLoading(false);
    } finally {
      setVehiclesLoadingMore(false);
    }
  }

  function handleSearch(q) {
    setSearchRaw(q);
    clearTimeout(searchDebounce.current);
    if (q.length < 2) { loadVehicles(); return; }
    searchDebounce.current = setTimeout(async () => {
      setVehiclesLoading(true);
      try {
        const res  = await fetch(`${API}/vehicle-search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setVehicles(data);
      } catch {}
      finally { setVehiclesLoading(false); }
    }, 280);
  }

  return {
    vehicles,
    vehiclesLoading,
    vehiclesLoadingMore,
    search,
    handleSearch,
    reload: loadVehicles,
  };
}