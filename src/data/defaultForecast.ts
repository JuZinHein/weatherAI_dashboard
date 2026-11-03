import forecastJson from './forecastData.json';
import { ForecastDataset } from '../types/forecast';

export const DEFAULT_FORECAST_DATA: ForecastDataset = forecastJson as ForecastDataset;

const STORAGE_KEY = 'nvidia_fcn_myanmar_custom_dataset';

export function loadCurrentDataset(): ForecastDataset {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.temperatureGrid && parsed.leadHours) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load custom dataset from storage, falling back to default', e);
  }
  return DEFAULT_FORECAST_DATA;
}

const IDB_NAME = 'nvidia_fcn_myanmar';
const IDB_STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export function saveCustomDataset(dataset: ForecastDataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
  } catch (e) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* quota */
    }
    console.warn('Forecast is too large for localStorage; keeping it in IndexedDB', e);
  }
  if (typeof indexedDB === 'undefined') return;
  openDb()
    .then((db) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(dataset, STORAGE_KEY);
      tx.onerror = () => console.warn('Failed to save forecast in IndexedDB', tx.error);
    })
    .catch((e) => console.warn('Failed to open IndexedDB', e));
}

/** Used when a long zip (for example 14 days) did not fit in localStorage. */
export async function loadLargeDataset(): Promise<ForecastDataset | null> {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return null;
  } catch {
    /* ignore */
  }
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(STORAGE_KEY);
      req.onsuccess = () => {
        const parsed = req.result as ForecastDataset | undefined;
        if (parsed && parsed.temperatureGrid && parsed.leadHours) resolve(parsed);
        else resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to load forecast from IndexedDB', e);
    return null;
  }
}

export function clearCustomDataset(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear custom dataset', e);
  }
  if (typeof indexedDB === 'undefined') return;
  openDb()
    .then((db) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(STORAGE_KEY);
    })
    .catch((e) => console.warn('Failed to clear IndexedDB forecast', e));
}
