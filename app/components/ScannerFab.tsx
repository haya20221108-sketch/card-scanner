'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Move } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { resolveCardDisplay } from './utils';
import { isPublicPath } from './AuthGate';
import { useLayoutEditMode, useUiPlacement } from './useUiPlacement';

const API_KEY_ROBO = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
const PROJECT_CARD = 'card-tvjwd/1';

export type RoboflowPrediction = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  class?: string;
};

/**
 * ヘルパー: Base64からImageオブジェクトを生成
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("画像の読み込みに失敗しました"));
    img.src = src;
  });
};

/**
 * ヘルパー: 予測された領域をCanvasから切り出す
 */
const getCropDataUrl = (img: HTMLImageElement, p: RoboflowPrediction, padding = 0): string => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const startX = Math.max(0, p.x - (p.width / 2) - padding);
  const startY = Math.max(0, p.y - (p.height / 2) - padding);
  const width = Math.min(img.naturalWidth - startX, p.width + padding * 2);
  const height = Math.min(img.naturalHeight - startY, p.height + padding * 2);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, startX, startY, width, height, 0, 0, width, height);
  return canvas.toDataURL("image/png");
};

/**
 * 共通: Roboflowによるカード検出
 */
export async function detectCards(base64Image: string): Promise<RoboflowPrediction[]> {
  if (!API_KEY_ROBO) throw new Error('Roboflow API Key is missing');

  const response = await fetch(`https://detect.roboflow.com/${PROJECT_CARD}?api_key=${API_KEY_ROBO}`, {
    method: 'POST',
    body: base64Image.split(',')[1],
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) throw new Error(`Roboflow request failed: ${response.status}`);

  const data = await response.json();
  const predictions: RoboflowPrediction[] = data.predictions || [];
  
  return predictions
    .filter((p) => Number(p.width) > 0 && Number(p.height) > 0)
    .filter((p) => Number(p.confidence ?? 1) >= 0.2)
}

/**
 * 共通: 1枚のカードを解析（OCR + マスタ照合）
 */
export async function processDetectedCard(
  worker: any,
  img: HTMLImageElement,
  prediction: RoboflowPrediction,
  allPredictions: RoboflowPrediction[],
  masterData: any[],
  index: number,
  sourceBase64: string
) {
  // カード領域のクロップ（表示用）
  const photoCardImage = getCropDataUrl(img, prediction, 12);

  // カード内に含まれる 'name' と 'count' ラベルを検索
  const isInside = (child: RoboflowPrediction, parent: RoboflowPrediction) => {
    return (
      child.x >= parent.x - parent.width / 2 &&
      child.x <= parent.x + parent.width / 2 &&
      child.y >= parent.y - parent.height / 2 &&
      child.y <= parent.y + parent.height / 2
    );
  };

  const namePart = allPredictions.find(p => p.class === 'name' && isInside(p, prediction));
  const countPart = allPredictions.find(p => p.class === 'count' && isInside(p, prediction));

  // --- OCR 処理 ---
  let ocrName = "";
  let detectedQuantity = 1;
  let detectedStars = 0;
  let detectedPack = "";

  // 1. 名前部分のOCR
  const nameTarget = namePart ? getCropDataUrl(img, namePart, 5) : photoCardImage;
  const { data: nameData } = await worker.recognize(nameTarget);
  
  const rawText = nameData.text || '';
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const ocrNameRaw = lines[0] || "";
  const ocrStarLine = lines[1] || "";
  const ocrPackLine = lines.slice(2).join(' '); // 3行目以降を結合して取得

  console.log(`%c[OCR Result] Card #${index + 1}: Name="${ocrNameRaw}", StarsLine="${ocrStarLine}", PackLine="${ocrPackLine}"`, "color: #3b82f6; font-weight: bold;");

  // 改行や記号を除去してマッチング精度を向上
  ocrName = ocrNameRaw.replace(/[^\w\s\u3040-\u30ff\u4e00-\u9faf]/g, '').trim().toLowerCase();
  
  // ルール適用: 2行目の文字数だけ星、3行目はパック
  // 空白（全角・半角）を除去してからカウントすることで、見た目通りの数にする
  detectedStars = ocrStarLine.replace(/\s+/g, '').length;
  detectedPack = ocrPackLine;

  // 2. 枚数（count）部分のOCR: 数字のみを抽出
  if (countPart) {
    const countTarget = getCropDataUrl(img, countPart, 5);
    const { data: countData } = await worker.recognize(countTarget);
    // 枚数部分もスタイル付きで出力
    console.log(`%c[OCR Count] Card #${index + 1}: "${countData.text.trim()}"`, "color: #10b981; font-weight: bold; font-size: 12px;");
    // 数字以外の文字を除去
    const countText = String(countData.text || '').replace(/\D/g, '');
    detectedQuantity = parseInt(countText) || 1;
    console.log(`[AI Logic] Card #${index + 1} - Cleaned Name: "${ocrName}", Parsed Qty: ${detectedQuantity}`);
  } else {
    console.log(`[AI Logic] Card #${index + 1} - Cleaned Name: "${ocrName}" (Count label not found)`);
  }

  const cleanedPackOCR = detectedPack.replace(/\s+/g, '').toLowerCase();

  const scoredResults = masterData.map((m) => {
    const masterName = String(m.name || '').replace(/\s+/g, '').toLowerCase();
    const masterPack = String(m.pack || '').replace(/\s+/g, '').toLowerCase();
    let score = 0;

    // 名前の一致判定
    if (masterName && ocrName) {
      let matches = 0;
      for (const char of masterName) { if (ocrName.includes(char)) matches++; }
      score = (matches / masterName.length) * 100;
      if (ocrName.includes(masterName)) score += 80;
    }

    // パック名の一致判定（ボーナス加算）
    if (masterPack && cleanedPackOCR) {
      if (cleanedPackOCR.includes(masterPack) || masterPack.includes(cleanedPackOCR)) {
        score += 50;
      }
    }

    return { ...m, totalScore: score };
  }).sort((a, b) => b.totalScore - a.totalScore);

  const bestMatch = scoredResults[0] || null;
  const isConfident = (bestMatch?.totalScore || 0) >= 35;
  const matchedCard = isConfident ? bestMatch : null;
  const displayData = resolveCardDisplay(matchedCard || { name: ocrName || "Unknown Card" });

  return {
    id: matchedCard?.id || `manual-roboflow-${Date.now()}-${index}`,
    name: matchedCard?.name || ocrNameRaw || ocrName,
    group: matchedCard?.group || '',
    pack: matchedCard?.pack || detectedPack || '', // DBにある情報を優先表示
    stars: detectedStars, // 2行目の文字数に固定
    subtype: 'その他', // プロモーションはその他
    quantity: detectedQuantity,
    croppedImg: displayData.imageUrl || photoCardImage,
    sourceImage: sourceBase64,
    date: new Date().getTime(),
    p_uid: null,
  };
}

/**
 * scanner用 (一括スキャン): inputAI
 */
export async function inputAI(base64Image: string, masterData: any[]) {
  let worker = null;
  try {
    const predictions = await detectCards(base64Image);
    const cards = predictions.filter(p => p.class === 'card' || !p.class).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    if (cards.length === 0) return [];

    // 画像を一度だけロード
    const img = await loadImage(base64Image);

    const results = [];
    // logger: () => {} を指定して、コンソールを埋め尽くす進捗ログを無効化
    worker = await createWorker('jpn', 1, { 
      logger: () => {},
    });

    for (let i = 0; i < cards.length; i++) {
      const result = await processDetectedCard(worker, img, cards[i], predictions, masterData, i, base64Image);
      results.push(result);
    }

    try { await worker.terminate(); } catch (e) { /* ignore */ }
    return results;
  } catch (error) {
    console.error("inputAI Error:", error);
    if (worker) {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }
    return [];
  }
}

/**
 * direct_add用 (単体追加): directAI
 */
export async function directAI(base64Image: string, masterData: any[]) {
  let worker = null;
  try {
    const predictions = await detectCards(base64Image);
    const cards = predictions.filter(p => p.class === 'card' || !p.class).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    if (cards.length === 0) return [];

    // 画像をロード
    const img = await loadImage(base64Image);

    // 最も確信度の高い1枚を処理
    worker = await createWorker('jpn', 1, { 
      logger: () => {},
    });
    const result = await processDetectedCard(worker, img, cards[0], predictions, masterData, 0, base64Image);
    
    try { await worker.terminate(); } catch (e) { /* ignore */ }
    return [result]; // 配列として返すことでUI側の.map()処理との互換性を維持
  } catch (error) {
    console.error("directAI Error:", error);
    if (worker) {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }
    return []; // エラー時も空配列を返す
  }
}

export function ScannerFab() {
  const pathname = usePathname();
  const { placement, setPlacement } = useUiPlacement('scannerFab');
  const { enabled: editMode } = useLayoutEditMode();
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // 公開ページ、またはスキャン実行画面そのものではボタンを非表示にする
  // "/direct_add" など、スキャンを呼び出したい画面では表示されるようにします
  const hiddenPaths = ['/scanner'];
  if (!pathname || isPublicPath(pathname) || hiddenPaths.includes(pathname)) return null;

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const frame = event.currentTarget.closest('[data-placement-target]') as HTMLDivElement | null;
    if (!frame) return;

    event.preventDefault();
    const rect = frame.getBoundingClientRect();
    dragRef.current = {
      offsetX: event.clientX - (rect.left + rect.width / 2),
      offsetY: event.clientY - rect.bottom,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const centerX = moveEvent.clientX - dragRef.current.offsetX;
      const bottom = window.innerHeight - (moveEvent.clientY - dragRef.current.offsetY);
      setPlacement({
        ...placement,
        x: (centerX / window.innerWidth) * 100,
        bottom,
      });
    };

    const stopDrag = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  };

  return (
    <div
      data-placement-target
      style={{
        left: `${placement.x}%`,
        bottom: `${placement.bottom}px`,
        opacity: placement.opacity ?? 1,
      }}
      className={`fixed -translate-x-1/2 z-40 pointer-events-none ${editMode ? 'z-[90]' : ''}`}
    >
      {editMode && (
        <button
          type="button"
          onPointerDown={startDrag}
          className="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-auto touch-none cursor-grab active:cursor-grabbing w-8 h-8 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 flex items-center justify-center border-4 border-white"
          aria-label="スキャンボタンの位置を変更"
        >
          <Move size={13} />
        </button>
      )}
      <Link
        href="/scanner"
        onClick={(event) => {
          if (editMode) event.preventDefault();
        }}
        className={`pointer-events-auto w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 flex items-center justify-center active:scale-95 transition-transform ${editMode ? 'ring-2 ring-blue-500/40' : ''}`}
        aria-label="スキャンする"
      >
        <Camera size={22} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
