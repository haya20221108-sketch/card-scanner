'use client';

export type ProfileId = string | null;

export type CachedProfile = {
  id: string;
  display_name?: string;
  [key: string]: any;
};

export type CollectionRecord = {
  user_id?: string | null;
  profile_id?: ProfileId;
  card_id: string;
  quantity: number;
  updated_at?: string;
  [key: string]: any;
};

export type PendingCollectionChange = {
  id: string;
  type: 'upsert' | 'delete';
  data: CollectionRecord;
  created_at: string;
};

export const STORAGE_KEYS = {
  activeProfileId: 'active_profile_id',
  cachedProfiles: 'cached_profiles',
  cachedRawCollection: 'cached_raw_collection',
  customMasterCards: 'custom_master_cards',
  lastUserId: 'last_user_id',
  masterData: 'master_data_cache',
  masterDataTime: 'master_data_cache_time',
  pendingCollectionChanges: 'pending_collection_changes',
};

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getOnlineStatus = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function normalizeProfileId(value: unknown): ProfileId {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

export function rememberUserId(userId?: string | null) {
  if (!canUseStorage() || !userId) return;
  localStorage.setItem(STORAGE_KEYS.lastUserId, userId);
}

export function getCachedUserId() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(STORAGE_KEYS.lastUserId);
}

export function getActiveProfileId(): ProfileId {
  if (!canUseStorage()) return null;
  return normalizeProfileId(localStorage.getItem(STORAGE_KEYS.activeProfileId));
}

export function setActiveProfileId(profileId: ProfileId) {
  if (!canUseStorage()) return;
  if (profileId) localStorage.setItem(STORAGE_KEYS.activeProfileId, profileId);
  else localStorage.removeItem(STORAGE_KEYS.activeProfileId);
}

export function getCachedProfiles() {
  return readJson<CachedProfile[]>(STORAGE_KEYS.cachedProfiles, []);
}

export function setCachedProfiles(profiles: CachedProfile[]) {
  writeJson(STORAGE_KEYS.cachedProfiles, profiles);
}

function uniqueById(cards: any[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const id = String(card?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function getCustomMasterCards() {
  return readJson<any[]>(STORAGE_KEYS.customMasterCards, []);
}

export function getCachedMasterData() {
  const cached = readJson<any[]>(STORAGE_KEYS.masterData, []);
  return uniqueById([...getCustomMasterCards(), ...cached]);
}

export function setCachedMasterData(cards: any[]) {
  writeJson(STORAGE_KEYS.masterData, uniqueById(cards));
  if (canUseStorage()) localStorage.setItem(STORAGE_KEYS.masterDataTime, Date.now().toString());
}

export function addCustomMasterCards(cards: any[]) {
  const next = uniqueById([...cards, ...getCustomMasterCards()]);
  writeJson(STORAGE_KEYS.customMasterCards, next);
  return next;
}

export function getCachedRawCollection() {
  return readJson<CollectionRecord[]>(STORAGE_KEYS.cachedRawCollection, []);
}

export function setCachedRawCollection(records: CollectionRecord[]) {
  writeJson(STORAGE_KEYS.cachedRawCollection, records);
}

function sameRecord(a: CollectionRecord, b: CollectionRecord) {
  return String(a.card_id) === String(b.card_id)
    && normalizeProfileId(a.profile_id) === normalizeProfileId(b.profile_id)
    && (!b.user_id || !a.user_id || String(a.user_id) === String(b.user_id));
}

export function upsertCachedCollection(record: CollectionRecord) {
  const normalized = {
    ...record,
    profile_id: normalizeProfileId(record.profile_id),
    card_id: String(record.card_id),
    quantity: Math.max(0, Number(record.quantity) || 0),
    updated_at: record.updated_at || new Date().toISOString(),
  };
  const previous = getCachedRawCollection();
  const next = previous.filter((item) => !sameRecord(item, normalized));
  if (normalized.quantity > 0) next.unshift(normalized);
  setCachedRawCollection(next);
  return next;
}

export function deleteCachedCollection(cardId: string, profileId: ProfileId, userId?: string | null) {
  const target = { card_id: cardId, profile_id: normalizeProfileId(profileId), user_id: userId || undefined, quantity: 0 };
  const next = getCachedRawCollection().filter((item) => !sameRecord(item, target));
  setCachedRawCollection(next);
  return next;
}

export function queueCollectionChange(type: PendingCollectionChange['type'], data: CollectionRecord) {
  const normalized = {
    ...data,
    profile_id: normalizeProfileId(data.profile_id),
    card_id: String(data.card_id),
    quantity: Math.max(0, Number(data.quantity) || 0),
  };
  const pending = readJson<PendingCollectionChange[]>(STORAGE_KEYS.pendingCollectionChanges, [])
    .filter((item) => !sameRecord(item.data, normalized));
  pending.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    data: normalized,
    created_at: new Date().toISOString(),
  });
  writeJson(STORAGE_KEYS.pendingCollectionChanges, pending);
  return pending.length;
}

export function getPendingCollectionChanges() {
  return readJson<PendingCollectionChange[]>(STORAGE_KEYS.pendingCollectionChanges, []);
}

export function clearPendingCollectionChanges() {
  writeJson(STORAGE_KEYS.pendingCollectionChanges, []);
}

export function getPendingCollectionCount() {
  return getPendingCollectionChanges().length;
}
