import { supabase } from '../supabase';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { STORAGE_KEYS } from '../offline';

const GAS_MASTER_DATA_URL = 'https://script.google.com/macros/s/AKfycbzE912QE7aAjrxboaW8jLnjJ-tTW7JzePfkREe3vpnTYMsghP4eRMWd_cEK3ffLQn3w4Q/exec';

export async function syncAllData(): Promise<{ success: boolean; message?: string }> {
  try {
    // 1. Fetch master data from GAS
    const gasResponse = await fetch(GAS_MASTER_DATA_URL);
    if (!gasResponse.ok) {
      throw new Error(`Failed to fetch master data from GAS: ${gasResponse.statusText}`);
    }
    const masterData = await gasResponse.json();
    localStorage.setItem(STORAGE_KEYS.masterData, JSON.stringify(masterData));
    localStorage.setItem(STORAGE_KEYS.masterDataTime, Date.now().toString());

    // 2. Fetch user ID (assuming it's available or can be fetched)
    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        localStorage.setItem(STORAGE_KEYS.lastUserId, userId);
      }
    } catch (e) {
      console.warn("Failed to get Supabase user during sync:", e);
    }

    if (userId) {
      // 3. Fetch collection records from Supabase
      const { data: collectionRecords, error: supabaseError } = await supabase.from('collections').select('*').eq('user_id', userId);
      if (supabaseError) {
        throw new Error(`Failed to fetch collection records from Supabase: ${supabaseError.message}`);
      }
      localStorage.setItem(STORAGE_KEYS.cachedRawCollection, JSON.stringify(collectionRecords || []));

      // 4. Fetch profiles from Firebase
      const qp = query(collection(db, "profiles"), where("uuid", "==", userId));
      const qs = await getDocs(qp);
      const profiles = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      localStorage.setItem(STORAGE_KEYS.cachedProfiles, JSON.stringify(profiles));
    } else {
      // Clear user-specific data if no user is logged in
      localStorage.removeItem(STORAGE_KEYS.cachedRawCollection);
      localStorage.removeItem(STORAGE_KEYS.cachedProfiles);
      localStorage.removeItem(STORAGE_KEYS.lastUserId);
    }

    return { success: true, message: "Data synchronized successfully." };
  } catch (error: any) {
    console.error("Error during data synchronization:", error);
    return { success: false, message: error.message || "Unknown synchronization error." };
  }
}