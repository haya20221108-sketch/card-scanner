'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Award, Package, Save } from 'lucide-react';
import {
  getCachedMasterData,
  getCachedRawCollection,
  getCachedProfiles,
  normalizeProfileId,
  upsertCachedCollection,
} from '../offline';
import { resolveCardDisplay } from '../components/utils';

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;

  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<{ [profileId: string]: number }>({});

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const loadCardData = () => {
      setLoading(true);
      const allCards = getCachedMasterData();
      const collectionRecords = getCachedRawCollection();
      const cachedProfiles = getCachedProfiles();

      const foundCard = allCards.find(c => String(c.id) === cardId);
      setCard(foundCard);

      // アカウントに紐付かないデータ(null)を除外してセット
      const validProfiles = cachedProfiles.filter((p) => p.id !== null);
      setProfiles(validProfiles);

      const initialQuantities: { [profileId: string]: number } = {};
      validProfiles.forEach(prof => {
        const record = collectionRecords.find(r =>
          String(r.card_id) === cardId &&
          normalizeProfileId(r.profile_id) === normalizeProfileId(prof.id)
        );
        initialQuantities[prof.id!] = record?.quantity || 0;
      });
      setQuantities(initialQuantities);
      setLoading(false);
    };

    loadCardData();

    return () => { isMounted.current = false; };
  }, [cardId]);

  const display = useMemo(() => card ? resolveCardDisplay(card) : null, [card]);

  const handleQuantityChange = (profileId: string, value: string) => {
    const newQuantity = parseInt(value, 10);
    setQuantities(prev => ({
      ...prev,
      [profileId]: isNaN(newQuantity) ? 0 : newQuantity,
    }));
  };

  const handleSave = () => {
    if (!card) return;

    profiles.forEach(prof => {
      const profileId = prof.id;
      const quantity = quantities[profileId!] || 0;

      // upsertCachedCollection を使用してローカルキャッシュを更新
      upsertCachedCollection({
        card_id: card.id,
        profile_id: profileId,
        quantity: quantity,
        // user_id は syncAllData で設定されるため、ここでは不要
      });
    });

    alert('所持数を更新しました！');
    // コレクションページに戻るか、状態を更新して表示を維持
    router.push('/collection');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading card details...</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-slate-400 mb-4">Card not found.</p>
        <Link href="/collection" className="text-blue-600 hover:underline">Back to Collection</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/collection" className="p-2 -ml-2 text-slate-400 active:text-slate-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Card Details</h1>
          <button onClick={handleSave} className="p-2 -mr-2 text-blue-600 active:text-blue-800 transition-colors">
            <Save size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-48 h-48 relative bg-slate-50 rounded-2xl mb-4 overflow-hidden">
            {display?.hasImage ? (
              <Image src={display.imageUrl!} alt={display.name} fill className="object-contain p-4" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-200 uppercase">No Image</div>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 leading-tight mb-2">{display?.name}</h2>
          <div className="flex items-center gap-2 text-blue-500 font-black mb-4">
            <Award size={16} strokeWidth={3} />
            <span className="text-sm uppercase tracking-tighter">Rank {card.rank || 0}</span>
            {card.pack && (
              <>
                <span className="text-slate-300 mx-1">•</span>
                <Package size={14} className="text-slate-400" />
                <span className="text-sm text-slate-500 uppercase tracking-tighter">{card.pack}</span>
              </>
            )}
          </div>

          {/* Quantity Editor per Profile */}
          <div className="w-full space-y-3 mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Quantities per Profile</h3>
            {profiles.length === 0 ? (
              <p className="text-xs text-slate-400">No profiles found. Sync data from settings.</p>
            ) : (
              profiles.map(prof => (
                <div key={prof.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-700">{prof.display_name}</span>
                  <input
                    type="number"
                    min="0"
                    value={quantities[prof.id!]}
                    onChange={(e) => handleQuantityChange(prof.id!, e.target.value)}
                    className="w-20 text-right text-lg font-bold text-blue-600 bg-transparent focus:outline-none"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}