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

async function detectObjects(base64Image: string, projectUrl: string): Promise<RoboflowPrediction[]> {
  if (!API_KEY_ROBO || !projectUrl) return [];
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  try {
    const response = await fetch(
      `https://detect.roboflow.com/${projectUrl}?api_key=${API_KEY_ROBO}`,
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

// 💡 クッキリ画質化：拡大時にブラウザの補間（ボカシ）を完全に切り、ドット単位でシャットアウトする
function getCroppedBase64(imgElement: HTMLImageElement, pred: RoboflowPrediction, scale = 4): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sx = Math.max(0, pred.x - pred.width / 2);
  const sy = Math.max(0, pred.y - pred.height / 2);
  
  canvas.width = pred.width * scale;
  canvas.height = pred.height * scale;

  // 🔥 【超重要】拡大時のスムーズ処理（ボカシ）を完全に無効化
  ctx.imageSmoothingEnabled = false;

  // 💡 主要なブラウザ（Chrome, Safari, Firefox）のキャンバスコンテキストに対して
  // ピクセルを等倍でクッキリ引き伸ばすプロパティを強制セット
  (ctx as any).mozImageSmoothingEnabled = false;
  (ctx as any).webkitImageSmoothingEnabled = false;
  (ctx as any).msImageSmoothingEnabled = false;

  // 元画像の(sx, sy)から切り出し、キャンバス全体へドットを維持したまま拡大描画
  ctx.drawImage(
    imgElement, 
    sx, sy, pred.width, pred.height, 
    0, 0, canvas.width, canvas.height
  );

  // 圧縮ノイズを防ぐため、最高品質(1.0)のJPEG、またはPNG（劣化なし）で書き出し
  // ※より確実な文字の輪郭維持のため、ここではPNG形式に変更しています
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

  console.log('--- 🤖 AIネストスキャン（1行目日本語制限版） ---');

  const addPredictions = await detectObjects(base64Image, PROJECT_ADD || '');
  const cards = addPredictions.filter(p => p.confidence > 0.35 && p.class === 'card');
  const names = addPredictions.filter(p => p.confidence > 0.35 && p.class === 'name');
  const counts = addPredictions.filter(p => p.confidence > 0.35 && p.class === 'count');

  const finalResults: any[] = [];
  let cardIdx = 1;

  const mainImg = new window.Image();
  mainImg.src = base64Image;
  await new Promise((resolve) => { mainImg.onload = resolve; mainImg.onerror = resolve; });

  const imgWidth = mainImg.width;
  const imgHeight = mainImg.height;

  for (const card of cards) {
    const isInsideBottomOmitArea = card.y > (imgHeight * 0.78);
    
    if (isInsideBottomOmitArea) {
      console.log(`  🚫 枠 #${cardIdx} は画面下部のUI除外エリア（下から22%以内）にあるためスキップします。`);
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

    // 数量枠の処理
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

    // 🔥 【今回のコア修正】name枠の処理
    if (linkedNamePred) {
      const nameCroppedBase64 = getCroppedBase64(mainImg, linkedNamePred, 4); 
      if (nameCroppedBase64) {
        // 星の検出
        const starPredictionsInName = await detectObjects(nameCroppedBase64, PROJECT_STAR || '');
        roboflowStarsCount = starPredictionsInName.filter(s => s.confidence > 0.35).length;
        
        // 💡 1行目の名前用に「日本語(jpn)」だけでOCRをかける
        rawNameOcrTextJpn = await runOcr(nameCroppedBase64, 'jpn');
        
        // 💡 2行目以降のランク文字・パック名（英数字交じり）用に「日本語+英語(jpn+eng)」でもOCRをかける
        rawNameOcrTextMix = await runOcr(nameCroppedBase64, 'jpn+eng');
      }
    }

    // 💡 日本語専用OCRから1行目（名前）を抽出してクレンジング
    const linesJpn = rawNameOcrTextJpn.split('\n').map(l => l.replace(/\s+/g, '')).filter(l => l.length > 0);
    const ocrNameRaw = linesJpn[0] || "";

    // 💡 混合OCRから2行目（ランク）と3行目以降（パック名）を抽出してクレンジング
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

    // ランクとパックの確定ロジック
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
        let matches = 0;
        for (const char of masterName) { if (cleanOcrName.includes(char)) matches++; }
        const charMatchRatio = (matches / masterName.length) * 100;
        
        const isSubString = cleanOcrName.includes(masterName) || masterName.includes(cleanOcrName);
        nameScore = isSubString ? Math.max(85, charMatchRatio) : charMatchRatio;
      }

      if (masterPack && cleanOcrPack) {
        let packMatches = 0;
        for (const char of masterPack) { if (cleanOcrPack.includes(char)) packMatches++; }
        const packCharMatchRatio = (packMatches / masterPack.length) * 100;
        const isPackSubString = cleanOcrPack.includes(masterPack) || masterPack.includes(cleanOcrPack);
        packScore = isPackSubString ? Math.max(90, packCharMatchRatio) : packCharMatchRatio;
      }

      let totalScore = (nameScore * 0.5) + (packScore * 0.5);
      
      if (finalStars > 0 && Number(m.rank ?? 0) === finalStars) {
        totalScore += 20; 
      }

      return { ...m, nameScore, packScore, totalScore: Math.min(100, totalScore) };
    }).sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.packScore - a.packScore;
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