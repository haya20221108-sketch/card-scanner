import Tesseract from 'tesseract.js';

const API_KEY_ROBO = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
const PROJECT_ADD = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_ADD;
const PROJECT_STAR = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR;

interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  class: 'card' | 'name' | 'count' | 'star' | string;
  confidence: number;
}

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

// 🎯 修正点：URLパラメータに confidence と overlap を乗せて、サーバー側で画面と同じ枠を抽出させる
async function detectObjects(
  base64Image: string, 
  projectUrl: string, 
  confidence = 0.20, 
  overlap = 0.45
): Promise<RoboflowPrediction[]> {
  if (!API_KEY_ROBO || !projectUrl) return [];
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    // URLの末尾にパラメータを付与
    const response = await fetch(
      `https://detect.roboflow.com/${projectUrl}?api_key=${API_KEY_ROBO}&confidence=${confidence}&overlap=${overlap}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cleanBase64,
      }
    );
    const data = await response.json();
    return data.predictions || [];
  } catch (error) {
    console.error(`[Roboflow] Detection failed for ${projectUrl}:`, error);
    return [];
  }
}

function getCroppedBase64(imgElement: HTMLImageElement, pred: RoboflowPrediction, scale = 4): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sx = Math.max(0, pred.x - pred.width / 2);
  const sy = Math.max(0, pred.y - pred.height / 2);
  
  canvas.width = pred.width * scale;
  canvas.height = pred.height * scale;

  ctx.imageSmoothingEnabled = false;
  (ctx as any).mozImageSmoothingEnabled = false;
  (ctx as any).webkitImageSmoothingEnabled = false;
  (ctx as any).msImageSmoothingEnabled = false;

  ctx.drawImage(
    imgElement, 
    sx, sy, pred.width, pred.height, 
    0, 0, canvas.width, canvas.height
  );

  return canvas.toDataURL('image/png');
}

async function runOcr(croppedBase64: string, lang = 'jpn+eng'): Promise<string> {
  try {
    const worker = await Tesseract.createWorker(lang);
    const { data } = await worker.recognize(croppedBase64);
    await worker.terminate();
    return data.text || '';
  } catch (err) {
    console.error('[OCR Execution Error]', err);
    return '';
  }
}

export async function inputAI(base64Image: string, masterData: any[]): Promise<any[]> {
  if (!base64Image || masterData.length === 0) return [];

  console.log('--- 🤖 AIネストスキャン（条件同期＋誤照合修正版） ---');

  // 🎯 【ここを調整！】Roboflowの画面のツマミと完全に一致させる設定値
  const CONFIDENCE_THRESH = 0.20; 
  const OVERLAP_THRESH = 0.48;

  // 1. APIに画面と同じしきい値を渡してリクエスト
  const addPredictions = await detectObjects(base64Image, PROJECT_ADD || '', CONFIDENCE_THRESH, OVERLAP_THRESH);
  
  // 2. 内部フィルターの閾値も連動
  const cards = addPredictions.filter(p => p.confidence >= CONFIDENCE_THRESH && p.class === 'card');
  const names = addPredictions.filter(p => p.confidence >= CONFIDENCE_THRESH && p.class === 'name');
  const counts = addPredictions.filter(p => p.confidence >= CONFIDENCE_THRESH && p.class === 'count');

  const finalResults: any[] = [];
  let cardIdx = 1;

  const mainImg = new window.Image();
  mainImg.src = base64Image;
  await new Promise((resolve) => { mainImg.onload = resolve; mainImg.onerror = resolve; });

  const imgWidth = mainImg.width;
  const imgHeight = mainImg.height;

  for (const card of cards) {
    // 💡 下段カードの巻き込みを防ぐため、除外判定を「下から7%」の 0.93 に調整
    const isInsideBottomOmitArea = card.y > (imgHeight * 0.93);
    
    if (isInsideBottomOmitArea) {
      console.log(`  🚫 枠 #${cardIdx} は最下部のナビゲーションUIエリアと被るためスキップします。`);
      cardIdx++;
      continue;
    }

    console.log(`\n📦 【カード #${cardIdx}】の解析開始`);

    const linkedNamePred = names.find(n => isTouching(card, n));
    const linkedCountPred = counts.find(c => isTouching(card, c));

    let rawNameOcrTextJpn = '';
    let rawNameOcrTextMix = '';
    let parsedCountQty = 1;
    let roboflowStarsCount = 0; 

    if (linkedCountPred) {
      const countCropped = getCroppedBase64(mainImg, linkedCountPred, 3);
      if (countCropped) {
        const countText = await runOcr(countCropped, 'jpn+eng');
        const cleanCountText = countText.replace(/\s+/g, '');
        const normalized = cleanCountText.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const numMatch = normalized.match(/\d+/);
        if (numMatch) {
          parsedCountQty = Math.max(1, parseInt(numMatch[0], 10));
        }
      }
    }

    if (linkedNamePred) {
      const nameCroppedBase64 = getCroppedBase64(mainImg, linkedNamePred, 4); 
      if (nameCroppedBase64) {
        // 星の検出にも同じしきい値を適用
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

    if (!cleanOcrName && !cleanOcrPack) {
      console.log(`  ⚠️ OCR文字列が完全に空だったためスキップ`);
      cardIdx++;
      continue;
    }

    console.log(`  └ 1行目(名/日本語限定): "${ocrNameRaw}"`);
    console.log(`  └ 2行目(ランク/混合): "${ocrRankRaw}"`);
    console.log(`  └ 3行目以降(パック/混合): "${ocrPackRaw}"`);

    let finalStars = roboflowStarsCount;
    let finalPack = ocrPackRaw || 'その他';

    const isPromo = /プロモ|ぷろも|promo/i.test(ocrPackRaw);

    if (isPromo) {
      finalPack = 'other';
      finalStars = 0;
      console.log(`  💡 プロモーション判定 ➔ パック: "その他" / ランク: 0`);
    } else if (roboflowStarsCount === 0) {
      finalStars = ocrRankRaw.length;
      console.log(`  💡 Roboflow星0個 ➔ 2行目の文字数からランクを設定: 【${finalStars}個】`);
    } else {
      console.log(`  💡 Roboflowが星を検出 ➔ ランク: 【${finalStars}個】`);
    }

    if (finalStars >= 6) {
      console.log(`  ⚠️ ランクが想定外の数値（${finalStars}）になったため、上限の【5】に補正しました。`);
      finalStars = 5;
    }

    // マスタ照合スコアリング
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

      // 名前を圧倒的に最優先（名前80%:パック20%）
      let totalScore = (nameScore * 0.8) + (packScore * 0.2);
      
      if (finalStars > 0 && Number(m.rank ?? 0) === finalStars) {
        totalScore += 10; 
      }

      // 名前完全一致に対する絶対ボーナス
      if (masterName === cleanOcrName) {
        totalScore += 100;
      }

      return { ...m, nameScore, packScore, totalScore: Math.min(200, totalScore) };
    }).sort((a, b) => {
      return b.totalScore - a.totalScore;
    });

    const bestMatch = scoredResults[0];
    const isConfident = (bestMatch?.totalScore || 0) >= 10;

    if (isConfident && bestMatch) {
      console.log(`  🎯 DB合致: "${bestMatch.name}" (Score: ${bestMatch.totalScore.toFixed(1)}) | ランク: ${finalStars}`);
      finalResults.push({
        id: bestMatch.id,
        name: bestMatch.name,
        group: bestMatch.group || '',
        pack: bestMatch.pack || 'その他',
        stars: finalStars, 
        subtype: bestMatch.subtype || '',
        quantity: parsedCountQty,
        croppedImg: bestMatch.image_url || bestMatch.image || '',
        date: Date.now(),
        p_uid: null
      });
    } else {
      console.log(`  ❓ DB未合致（手動生成） ➔ ランク[${finalStars}], パック[${finalPack}]`);
      finalResults.push({
        id: `manual-${Date.now()}-${Math.random()}`,
        name: ocrNameRaw || '未確定カード',
        group: '',
        pack: finalPack,
        stars: finalStars,
        subtype: '',
        quantity: parsedCountQty,
        croppedImg: '',
        date: Date.now(),
        p_uid: null
      });
    }
    cardIdx++;
  }

  console.log('\n--- 🏁 全カードの解析完了 ---');
  return finalResults;
}