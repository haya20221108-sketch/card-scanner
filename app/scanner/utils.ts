import { createWorker } from 'tesseract.js';
import { resolveCardDisplay } from '../components/utils'; // resolveCardDisplayをcomponentsからインポート

const API_KEY_ROBO = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
const PROJECT_CARD = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_CARD;
const PROJECT_STAR = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR;

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function analyzeCard(base64Image: string, masterData: any[]) {
  let worker;
  try {
    const cardResponse = await fetchWithTimeout(`https://detect.roboflow.com/${PROJECT_CARD}?api_key=${API_KEY_ROBO}`, {
      method: 'POST',
      body: base64Image.split(',')[1],
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const cardData = await cardResponse.json();
    if (!cardData.predictions || cardData.predictions.length === 0) return [];

    const results = [];
    worker = await createWorker('jpn');

    for (let i = 0; i < cardData.predictions.length; i++) {
      const card = cardData.predictions[i];
      const fullCanvas = await cropImageSimple(base64Image, card);
      const photoCardImage = fullCanvas.toDataURL("image/png");

      const starResponse = await fetchWithTimeout(`https://detect.roboflow.com/${PROJECT_STAR}?api_key=${API_KEY_ROBO}`, {
        method: 'POST',
        body: photoCardImage.split(',')[1],
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const starData = await starResponse.json();
      const aiDetectedStars = starData.predictions ? starData.predictions.filter((p: any) => p.class === "star").length : 0;

      const { data } = await worker.recognize(photoCardImage);
      const ocrName = (data.text || "").split('\n')[0]?.replace(/\s+/g, "").trim() || "";
      const fullOcrText = (data.text || "").replace(/\s+/g, "");

      // スコア計算
      const scoredResults = masterData.map(m => {
        let nScore = 0, rScore = 0, pScore = 0;

        // 1. 名前 (name列)
        const mName = String(m.name || "").replace(/\s+/g, "");
        if (mName && ocrName) {
          let matches = 0;
          for (const c of mName) { if (ocrName.includes(c)) matches++; }
          nScore = (matches / mName.length) * 100;
          if (ocrName.includes(mName)) nScore += 50;
        }

        // 2. ランク (rank列)
        const mRank = parseInt(String(m.rank || "0").replace(/[^0-9]/g, "")) || 0;
        if (aiDetectedStars === mRank) rScore = 80;
        else if (Math.abs(aiDetectedStars - mRank) === 1) rScore = 30;

        // 3. パック (pack列)
        const mPack = String(m.pack || "").replace(/\s+/g, "");
        if (mPack && fullOcrText.includes(mPack)) pScore = 120;

        return { ...m, totalScore: nScore + rScore + pScore, nScore, rScore, pScore, mRank };
      });

      scoredResults.sort((a, b) => b.totalScore - a.totalScore);
      const bestMatch = scoredResults[0];

      // 🌟 エラーガード: 1位が見つからない場合はスキップ
      if (!bestMatch) continue;

      // resolveCardDisplay を使って表示データを準備
      const displayData = resolveCardDisplay(bestMatch);

      console.log(`%c[Card #${i+1}] ${displayData.name} - ${bestMatch.rank}点`, "color: #3b82f6; font-weight: bold;");

      results.push({
        id: bestMatch.id,
        name: displayData.name,
        group: bestMatch.group,
        pack: bestMatch.pack,
        stars: bestMatch.rank, // 数値を格納
        croppedImg: displayData.imageUrl,
        sourceImage: base64Image,
        date: new Date().getTime()
      });
    }

    await worker.terminate();
    return results;
  } catch (error) {
    console.error("解析エラー:", error);
    if (worker) await worker.terminate();
    return [];
  }
}

async function cropImageSimple(base64Str: string, pred: any): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = pred.width; canvas.height = pred.height;
      const startX = pred.x - (pred.width / 2);
      const startY = pred.y - (pred.height / 2);
      ctx.drawImage(img, startX, startY, pred.width, pred.height, 0, 0, pred.width, pred.height);
      resolve(canvas);
    };
    img.src = base64Str;
  });
}