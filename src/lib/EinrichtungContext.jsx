import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const EinrichtungContext = createContext(null);

export function EinrichtungProvider({ children }) {
  const [einrichtungen, setEinrichtungen] = useState([]);
  const [selectedEinrichtung, setSelectedEinrichtung] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Einrichtung.list().then(data => {
      setEinrichtungen(data);
      const saved = localStorage.getItem('selectedEinrichtungId');
      if (saved && data.find(e => e.id === saved)) {
        setSelectedEinrichtung(data.find(e => e.id === saved));
      } else if (data.length > 0) {
        setSelectedEinrichtung(data[0]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectEinrichtung = (e) => {
    setSelectedEinrichtung(e);
    localStorage.setItem('selectedEinrichtungId', e.id);
  };

  return (
    <EinrichtungContext.Provider value={{ einrichtungen, selectedEinrichtung, selectEinrichtung, loading }}>
      {children}
    </EinrichtungContext.Provider>
  );
}

export function useEinrichtung() {
  return useContext(EinrichtungContext);
}