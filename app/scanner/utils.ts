'use client';

import { createWorker } from 'tesseract.js';

const API_KEY_ROBO = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
const PROJECT_CARD = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_CARD;
const PROJECT_STAR = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR;

export type RoboflowPrediction = {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  class?: string;
};

export function resolveCardDisplay(card: any) {
  return {
    imageUrl: card?.imageUrl || card?.croppedImg || null,
    name: card?.name || "Unknown Card"
  };
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = src;
  });
};

const getCropDataUrl = (
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  p: RoboflowPrediction,
  padding = 0
): string => {
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
 * 共通: Roboflowによる検出（プロジェクトIDを動的に指定できるように拡張）
 */
export async function detectObjects(base64Image: string, projectId: string): Promise<RoboflowPrediction[]> {
  if (!API_KEY_ROBO) throw new Error('Roboflow API Key is missing');
  if (!projectId) throw new Error('Roboflow Project ID is missing');

  const response = await fetch(`https://detect.roboflow.com/${projectId}?api_key=${API_KEY_ROBO}`, {
    method: 'POST',
    body: base64Image.split(',')[1],
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!response.ok) throw new Error(`Roboflow request failed: ${response.status}`);

  const data = await response.json();
  const predictions: RoboflowPrediction[] = data.predictions || [];
  
  return predictions
    .filter((p) => Number(p.width) > 0 && Number(p.height) > 0)
    .filter((p) => Number(p.confidence ?? 1) >= 0.2); // 閾値は必要に応じて調整してください
}

// 互換性のために残す
export async function detectCards(base64Image: string): Promise<RoboflowPrediction[]> {
  return detectObjects(base64Image, PROJECT_CARD || '');
}

/**
 * 共通: 1枚のカードを解析（2段階検出: カード全体OCR + 切り抜き内から星カウント）
 */
export async function processDetectedCard(
  worker: any,
  img: HTMLImageElement,
  prediction: RoboflowPrediction,
  masterData: any[],
  index: number,
  sourceBase64: string
) {
  const canvas = document.createElement("canvas");
  // 1. PROJECT_CARDの枠を元にカード画像を切り抜く
  const photoCardImage = getCropDataUrl(canvas, img, prediction, 12);

  // ⭐️ 2. 【新ロジック】切り取ったカード画像から PROJECT_STAR を使って星を検出
  let detectedStars = 0;
  if (PROJECT_STAR) {
    try {
      const starPredictions = await detectObjects(photoCardImage, PROJECT_STAR);
      // 'star' などのクラス名で絞り込む場合はフィルターを追加してください (例: p.class === 'star')
      detectedStars = starPredictions.length;
    } catch (err) {
      console.error(`カード #${index + 1} の星検出に失敗しました:`, err);
    }
  }

  // --- OCR 処理（文字と枚数、パック名の特定に使用） ---
  const { data: ocrData } = await worker.recognize(photoCardImage);
  const rawText = ocrData.text || '';
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const ocrNameRaw = lines[0] || "";
  const remainingText = lines.slice(1).join(' '); // 星の行は無視されるか残りに回る

  const ocrName = ocrNameRaw.replace(/[^\w\s\u3040-\u30ff\u4e00-\u9faf]/g, '').trim().toLowerCase();

  const detectedQuantity = 1;
  
  const detectedPack = remainingText.trim();
  const cleanedPackOCR = detectedPack.replace(/\s+/g, '').toLowerCase();

  // 📝 デバッグ用コンソールログ
  console.group(`📸 [2段階検出 AI] カード #${index + 1}`);
  console.log(`%c[星検出結果] ➔ 個数: ${detectedStars}個`, "color: #eab308; font-weight: bold;");
  console.log(`%c[OCR生テキスト]\n%c${rawText}`, "color: #718096; font-weight: bold;", "color: #1a202c; bg: #edf2f7; padding: 4px; border-radius: 4px;");
  console.log(` └ 名前候補: "${ocrNameRaw}"`);
  console.log(` └ 検出枚数: ${detectedQuantity}枚`);
  console.groupEnd();

// --- マスタ照合ロジック ---
  const scoredResults = masterData.map((m) => {
    const masterName = String(m.name || '').replace(/\s+/g, '').toLowerCase();
    const masterPack = String(m.pack || '').replace(/\s+/g, '').toLowerCase();
    
    let nameScore = 0;
    let packScore = 0; // ✨ ボーナスではなく、パック独自のスコアを計算

    // 1. カード名の照合
    if (masterName && ocrName) {
      let matches = 0;
      for (const char of masterName) { if (ocrName.includes(char)) matches++; }
      const charMatchRatio = (matches / masterName.length) * 100;
      const isSubString = ocrName.includes(masterName) || masterName.includes(ocrName);
      nameScore = isSubString ? Math.max(80, charMatchRatio) : charMatchRatio;
    }

    // 2. ✨ パック名の照合（一番名前の近いパックを判定するためのロジック）
    if (masterPack && cleanedPackOCR) {
      let packMatches = 0;
      for (const char of masterPack) {
        if (cleanedPackOCR.includes(char)) packMatches++;
      }
      const packCharMatchRatio = (packMatches / masterPack.length) * 100;
      const isPackSubString = cleanedPackOCR.includes(masterPack) || masterPack.includes(cleanedPackOCR);
      
      // 完全一致や内包関係なら高得点、そうでなければ文字の含有率
      packScore = isPackSubString ? Math.max(90, packCharMatchRatio) : packCharMatchRatio;
    }

    // 3. ✨ 総合スコアの計算
    // パック判定を重視するため、配分を [カード名 50% : パック名 50%] に変更
    // さらに、実数が数えた星の数（stars）とマスタのランクが一致していれば一押し（+10点）
    let totalScore = (nameScore * 0.5) + (packScore * 0.5);
    
    if (Number(m.rank ?? 0) === Number(detectedStars)) {
      totalScore += 10;
    }

    return { ...m, nameScore, packScore, totalScore: Math.min(100, totalScore) };
  }).sort((a, b) => {
    // ① まず総合スコア順
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // ② 総合スコアが同じなら、パック名のスコアが高い方を優先！
    return b.packScore - a.packScore;
  });

  const bestMatch = scoredResults[0] || null;
  // 閾値を少し調整（文字が一部でもパック名と近く一致していれば拾えるように）
  const isConfident = (bestMatch?.totalScore || 0) >= 30;
  const matchedCard = isConfident ? bestMatch : null;

  const displayData = resolveCardDisplay(matchedCard || { name: ocrName || "Unknown Card" });

  return {
    id: matchedCard?.id || `manual-roboflow-${Date.now()}-${index}`,
    name: matchedCard?.name || ocrNameRaw || ocrName,
    group: matchedCard?.group || '',
    pack: matchedCard?.pack || detectedPack || '',
    stars: detectedStars, // ✨ 数えた星の数をそのまま点数にセット！
    subtype: 'その他',
    quantity: detectedQuantity,
    croppedImg: displayData.imageUrl || photoCardImage,
    sourceImage: sourceBase64,
    date: new Date().getTime(),
    p_uid: null,
  };
}

export async function inputAI(base64Image: string, masterData: any[]) {
  let worker = null;
  try {
    const predictions = await detectObjects(base64Image, PROJECT_CARD || '');
    const cards = predictions
      .filter(p => p.class === 'card' || !p.class)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      
    if (cards.length === 0) return [];

    const img = await loadImage(base64Image);
    worker = await createWorker('jpn', 1, { logger: () => {} });

    const promises = cards.map((card, i) =>
      processDetectedCard(worker, img, card, masterData, i, base64Image)
    );
    const results = await Promise.all(promises);

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

export async function directAI(base64Image: string, masterData: any[]) {
  let worker = null;
  try {
    const predictions = await detectObjects(base64Image, PROJECT_CARD || '');
    const cards = predictions
      .filter(p => p.class === 'card' || !p.class)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      
    if (cards.length === 0) return [];

    const img = await loadImage(base64Image);
    worker = await createWorker('jpn', 1, { logger: () => {} });
    
    const result = await processDetectedCard(worker, img, cards[0], masterData, 0, base64Image);
    
    try { await worker.terminate(); } catch (e) { /* ignore */ }
    return [result];
  } catch (error) {
    console.error("directAI Error:", error);
    if (worker) {
      try { await worker.terminate(); } catch (e) { /* ignore */ }
    }
    return [];
  }
}