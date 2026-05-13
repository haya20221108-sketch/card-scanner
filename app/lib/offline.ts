export const STORAGE_KEYS = {
  masterData: 'master_data',
  masterDataTime: 'master_data_time',
  rawCollection: 'raw_collection',
  profiles: 'profiles',
  userId: 'user_id',
};

export const getOnlineStatus = () => {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
};

export const getCachedUserId = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.userId);
};

export const setCachedUserId = (id: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.userId, id);
};

export const getCachedMasterData = () => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.masterData);
  return data ? JSON.parse(data) : [];
};

export const getCachedRawCollection = () => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.rawCollection);
  return data ? JSON.parse(data) : [];
};

export const getCachedProfiles = () => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.profiles);
  return data ? JSON.parse(data) : [];
};