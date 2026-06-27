import Tesseract from 'tesseract.js';

const API_KEY_ROBO = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
const PROJECT_ADD = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_ADD;
const PROJECT_STAR = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR;

export interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  class: 'card' | 'name' | 'count' | 'star' | string;
  confidence: number;
}

// Colabと100%等しい接触判定アルゴリズム
function isTouching(rectA: RoboflowPrediction, rectB: RoboflowPrediction, margin = 12): boolean {
  const leftA = rectA.x - rectA.width / 2 - margin;
  const rightA = rectA.x + rectA.width / 2 + margin;
  const topA = rectA.y - rectA.height / 2 - margin;
  const bottomA = rectA.y + rectA.height / 2 + margin;

  const leftB = rectB.x - rectB.width / 2;
  const rightB = rectB.x + rectB.width / 2;
  const topB = rectB.y - rectB.height / 2;
  const bottomB = rectB.y + rectB.height / 2;

  return !(rightA < leftB || leftA > rightB || bottomA < topB || topA > bottomB);
}

// サーバー側足切りパラメータを確実に同期するAPIクライアント
async function detectObjects(
  base64Image: string, 
  projectUrl: string, 
  confidence = 0.20, 
  overlap = 0.48
): Promise<RoboflowPrediction[]> {
  if (!API_KEY_ROBO || !projectUrl) return [];
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await fetch(
      `https://detect.roboflow.com/${projectUrl}?api_key=${API_KEY_ROBO}&confidence=${Math.round(confidence * 100)}&overlap=${Math.round(overlap * 100)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cleanBase64,
      }
    );
    const data = await response.json();
    return data.predictions || [];
  } catch (error) {
    console.error(`[Roboflow API Error] URL: ${projectUrl}`, error);
    return [];
  }
}

// Retinaや高解像度ディスプレイによる座標ズレを100%防ぐクッキリ切り出し関数
function getCroppedBase64(imgElement: HTMLImageElement, pred: RoboflowPrediction, scale = 4): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sx = Math.max(0, pred.x - pred.width / 2);
  const sy = Math.max(0, pred.y - pred.height / 2);
  const sw = pred.width;
  const sh = pred.height;
  
  canvas.width = sw * scale;
  canvas.height = sh * scale;

  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    const scaleX = imgElement.naturalWidth / imgElement.width || 1;
    const scaleY = imgElement.naturalHeight / imgElement.height || 1;

    ctx.drawImage(
      imgElement,
      sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY,
      0, 0, canvas.width, canvas.height
    );
  }
  
  return canvas.toDataURL('image/png');
}

// 安全なリソース破棄を保証した高精度OCR
async function runOcr(croppedBase64: string, lang = 'jpn+eng'): Promise<string> {
  const worker = await Tesseract.createWorker(lang);
  try {
    const { data } = await worker.recognize(croppedBase64);
    return data.text || '';
  } catch (err) {
    console.error('[Tesseract OCR Error]', err);
    return '';
  } finally {
    await worker.terminate(); // メモリリークを確実に防止
  }
}

export async function inputAI(base64Image: string, masterData: any[]): Promise<any[]> {
  if (!base64Image || masterData.length === 0) return [];

  console.clear();
  console.log('%c--- 🤖 AIネストスキャン 診断モード開始 ---', 'color: #00e5ff; font-weight: bold; font-size: 14px;');

  const CONFIDENCE_THRESH = 0.20; 
  const OVERLAP_THRESH = 0.48;

  const addPredictions = await detectObjects(base64Image, PROJECT_ADD || '', CONFIDENCE_THRESH, OVERLAP_THRESH);
  console.log(`📊 Roboflow応答: 総パーツ検知数 = ${addPredictions.length} 個`);

  const allCards = addPredictions.filter(p => p.confidence >= CONFIDENCE_THRESH && p.class === 'card');
  const names = addPredictions.filter(p => p.confidence >= CONFIDENCE_THRESH && p.class === 'name');
  const counts = addPredictions.filter(p => p.confidence >= CONFIDENCE_THRESH && p.class === 'count');

  // 確信度トップ6枚を抽出
  const cards = allCards
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6);

  const finalResults: any[] = [];
  
  // 画像アスペクト比・本来の解像度を安全にロード
  const mainImg = new window.Image();
  await new Promise<void>((resolve) => {
    mainImg.onload = () => resolve();
    mainImg.onerror = () => resolve();
    mainImg.src = base64Image;
  });

  const imgHeight = mainImg.height;
  let cardIdx = 1;

  for (const card of cards) {
    console.log(`\n%c==================== カード枠 #${cardIdx} 解析 ====================`, 'color: #ff007f; font-weight: bold;');

    // 画面下部93%以降のナビゲーション除外エリア判定
    if (card.y > (imgHeight * 0.93)) {
      console.log(`%c🚫 スキップ: 下部メニューエリアのため除外されました。`, 'color: #cca000;');
      cardIdx++;
      continue;
    }

    const linkedNamePred = names.find(n => isTouching(card, n));
    const linkedCountPred = counts.find(c => isTouching(card, c));

    let rawNameOcrTextJpn = '';
    let rawNameOcrTextMix = '';
    let parsedCountQty = 1; 
    let roboflowStarsCount = 0; 

    // 1. 数量(count)枠の解析
    if (linkedCountPred) {
      const countCropped = getCroppedBase64(mainImg, linkedCountPred, 3);
      if (countCropped) {
        const countText = await runOcr(countCropped, 'jpn+eng');
        const cleanCountText = countText.replace(/\s+/g, '').toLowerCase();
        const normalized = cleanCountText.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        
        const numMatch = normalized.match(/\d+/);
        if (numMatch) {
          parsedCountQty = Math.max(1, parseInt(numMatch[0], 10));
          console.log(`  🔢 [count] OCR解読成功 ➔ 【 x${parsedCountQty} 】`);
        }
      }
    }

    // 2. 名前(name)枠の解析
    if (linkedNamePred) {
      const nameCroppedBase64 = getCroppedBase64(mainImg, linkedNamePred, 4); 
      if (nameCroppedBase64) {
        // 名前枠の中からさらに星(star)を再検知
        const starPredictionsInName = await detectObjects(nameCroppedBase64, PROJECT_STAR || '', CONFIDENCE_THRESH, OVERLAP_THRESH);
        roboflowStarsCount = starPredictionsInName.filter(s => s.confidence >= CONFIDENCE_THRESH).length;
        
        rawNameOcrTextJpn = await runOcr(nameCroppedBase64, 'jpn');
        rawNameOcrTextMix = await runOcr(nameCroppedBase64, 'jpn+eng');
      }
    }

    const linesJpn = rawNameOcrTextJpn.split('\n').map(l => l.replace(/\s+/g, '')).filter(l => l.length > 0);
    const ocrNameRaw = linesJpn[0] || "";

    const linesMix = rawNameOcrTextMix.split('\n').map(l => l.replace(/\s+/g, '')).filter(l => l.length > 0);
    const ocrRankRaw = linesMix[1] || "";             
    const ocrPackRaw = linesMix.slice(2).join('');    

    const cleanOcrName = ocrNameRaw.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]/g, '').toLowerCase();
    const cleanOcrPack = ocrPackRaw.toLowerCase();

    // OCRが完全に空の場合でも、上位6枠の整合性を保つため未確定枠として保持
    if (!cleanOcrName && !cleanOcrPack) {
      finalResults.push({
        id: `manual-${Date.now()}-${Math.random()}`,
        name: `未確定カード #${cardIdx}`,
        group: '',
        pack: 'その他',
        stars: roboflowStarsCount || 0,
        subtype: '旧',
        quantity: parsedCountQty,
        croppedImg: '',
        x: card.x,
        y: card.y,
        date: Date.now()
      });
      cardIdx++;
      continue;
    }

    let finalStars = roboflowStarsCount;
    let finalPack = ocrPackRaw || 'その他';

    const isPromo = /プロモ|ぷろも|promo/i.test(ocrPackRaw);
    if (isPromo) {
      finalPack = 'other';
      finalStars = 0;
    } else if (roboflowStarsCount === 0) {
      finalStars = ocrRankRaw.length;
    }
    if (finalStars >= 6) finalStars = 5;

    // 3. マスタデータとのスコアリング照合
    const scoredResults = masterData.map((m) => {
      const masterName = String(m.name || '').replace(/\s+/g, '').toLowerCase();
      const masterPack = String(m.pack || '').replace(/\s+/g, '').toLowerCase();
      
      let nameScore = 0;
      let packScore = 0;

      if (masterName && cleanOcrName) {
        if (masterName === cleanOcrName) {
          nameScore = 100;
        } else {
          let matches = 0;
          for (const char of masterName) { if (cleanOcrName.includes(char)) matches++; }
          const maxLen = Math.max(masterName.length, cleanOcrName.length);
          const charMatchRatio = (matches / maxLen) * 100;
          const isSubString = cleanOcrName.includes(masterName) || masterName.includes(cleanOcrName);
          nameScore = isSubString ? Math.max(75, charMatchRatio) : charMatchRatio * 0.5;
        }
      }

      if (masterPack && cleanOcrPack) {
        if (masterPack === cleanOcrPack) {
          packScore = 100;
        } else {
          let packMatches = 0;
          for (const char of masterPack) { if (cleanOcrPack.includes(char)) packMatches++; }
          const maxPackLen = Math.max(masterPack.length, cleanOcrPack.length);
          const packCharMatchRatio = (packMatches / maxPackLen) * 100;
          const isPackSubString = cleanOcrPack.includes(masterPack) || masterPack.includes(cleanOcrPack);
          packScore = isPackSubString ? Math.max(80, packCharMatchRatio) : packCharMatchRatio * 0.5;
        }
      }

      let totalScore = (nameScore * 0.8) + (packScore * 0.2);
      if (finalStars > 0 && Number(m.rank ?? 0) === finalStars) totalScore += 10; 
      if (masterName === cleanOcrName) totalScore += 100;

      return { ...m, nameScore, packScore, totalScore: Math.min(200, totalScore) };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const bestMatch = scoredResults[0];
    const isConfident = (bestMatch?.totalScore || 0) >= 10;

    if (isConfident && bestMatch) {
      console.log(`  🎯 マスタマッチ成功: "${bestMatch.name}" (枚数: x${parsedCountQty})`);
      finalResults.push({
        id: bestMatch.id,
        name: bestMatch.name,
        group: bestMatch.group || '',
        pack: bestMatch.pack || 'その他',
        stars: finalStars, 
        subtype: bestMatch.subtype || '',
        quantity: parsedCountQty, 
        croppedImg: bestMatch.image_url || bestMatch.image || '',
        x: card.x,
        y: card.y,
        date: Date.now()
      });
    } else {
      console.log(`  ❓ 候補なし ➔ 手動生成枠に振り分け (枚数: x${parsedCountQty})`);
      finalResults.push({
        id: `manual-${Date.now()}-${Math.random()}`,
        name: ocrNameRaw || '未確定カード',
        group: '',
        pack: finalPack,
        stars: finalStars,
        subtype: '旧',
        quantity: parsedCountQty, 
        croppedImg: '',
        x: card.x,
        y: card.y,
        date: Date.now()
      });
    }
    cardIdx++;
  }

  console.log('%c--- 🏁 解析完了 ---', 'color: #00e5ff; font-weight: bold;');
  return finalResults;
}