import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export type AppProfile = {
  id: string;
  uuid: string;
  display_name: string;
  created_at?: string;
  [key: string]: any;
};

const profilesCollection = collection(db, 'profiles');

function sortProfiles(profiles: AppProfile[]) {
  return [...profiles].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

export async function listProfiles(userId: string) {
  const snapshot = await getDocs(query(profilesCollection, where('uuid', '==', userId)));
  return sortProfiles(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as AppProfile)));
}

export async function createProfile(userId: string, displayName: string) {
  const createdAt = new Date().toISOString();
  const docRef = await addDoc(profilesCollection, {
    uuid: userId,
    display_name: displayName,
    created_at: createdAt,
  });

  return {
    id: docRef.id,
    uuid: userId,
    display_name: displayName,
    created_at: createdAt,
  };
}

export async function renameProfile(profileId: string, displayName: string) {
  await updateDoc(doc(db, 'profiles', profileId), {
    display_name: displayName,
  });
}

export async function removeProfile(profileId: string) {
  await deleteDoc(doc(db, 'profiles', profileId));
}
