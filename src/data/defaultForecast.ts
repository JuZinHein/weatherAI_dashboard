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

export function saveCustomDataset(dataset: ForecastDataset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
  } catch (e) {
    console.error('Failed to save dataset to local storage', e);
  }
}

export function clearCustomDataset(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear custom dataset', e);
  }
}
