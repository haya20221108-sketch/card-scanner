import { supabase } from './supabase';

export type AppProfile = {
  id: number;
  p_uid: string;
  uuid: string;
  name: string;
  created_at?: string;
};

export type InventoryItem = {
  id: number;
  p_uid: string;
  card_id: string;
  count: number;
  created_at: string;
};

// アプリ内アカウント（プロフィール）の一覧を取得
export async function listProfiles(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('uuid', userId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as AppProfile[];
}

// 特定のアカウントの履歴を取得
export async function listInventory(pUid: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('p_uid', pUid) // UIからは p_uid が渡される想定
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as InventoryItem[];
}

// プロフィールの存在を確認し、UI側で期待される形式（p_uidをidとして扱う）に変換して取得
export async function ensureProfiles(userId: string) {
  const profiles = await listProfiles(userId);
  if (profiles.length > 0) {
    return profiles.map(p => ({
      id: p.p_uid,
      display_name: p.name
    }));
  }
  
  // プロフィールが1つもない場合は「メイン」アカウントを自動作成
  const defaultProfile = await createProfile(userId, 'メイン');
  return [{ id: defaultProfile.p_uid, display_name: defaultProfile.name }];
}

// アプリ内アカウントを新規作成
export async function createProfile(userId: string, name: string) {
  const p_uid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ uuid: userId, name, p_uid }])
    .select()
    .single();
  
  if (error) throw error;
  return data as AppProfile;
}

// 所持枚数情報を更新または新規作成（重複時は上書き）
export async function upsertInventoryItem(pUid: string, card_id: string, count: number) {
  const { data, error } = await supabase
    .from('inventory')
    .upsert(
      { p_uid: pUid, card_id, count },
      { onConflict: 'p_uid,card_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as InventoryItem;
}

// アプリ内アカウントの名前を変更
export async function renameProfile(pUid: string, name: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ name })
    .eq('p_uid', pUid)
    .select()
    .single();

  if (error) throw error;
  return data as AppProfile;
}

// 特定のアカウントにカードを追加
export async function addCardToInventory(pUid: string, cardId: string, count: number) {
  // 1. 現在の枚数をDBから直接取得（重複・上書き防止のため）
  const { data: existing } = await supabase
    .from('inventory')
    .select('count')
    .eq('p_uid', pUid)
    .eq('card_id', cardId)
    .maybeSingle();

  const newCount = (existing?.count || 0) + count;

  // 2. 合計値をupsert
  const { data, error } = await supabase
    .from('inventory')
    .upsert({ p_uid: pUid, card_id: cardId, count: newCount }, { onConflict: 'p_uid,card_id' })
    .select()
    .single();

  if (error) throw error;
  return data as InventoryItem;
}

// 接続テスト用
export async function testConnection() {
  const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return true;
}
