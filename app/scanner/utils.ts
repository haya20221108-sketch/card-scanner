import { createWorker } from 'tesseract.js';

const API_KEY_ROBO = process.env.NEXT_PUBLIC_ROBOFLOW_API_KEY;
const PROJECT_CARD = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_CARD;
const PROJECT_STAR = process.env.NEXT_PUBLIC_ROBOFLOW_PROJECT_STAR;

/**
 * 表示用データ整形関数 (resolveCardDisplay)
 * スプレッドシートの各列(id, name, group, pack, rank, image)に対応
 */
export const resolveCardDisplay = (card: any) => {
  if (!card) return { id: "---", name: "---", pack: "---", rank: "0", imageUrl: null, hasImage: false };

  // image列またはcroppedImgからURLを取得し、thumbnail APIへ変換
  const rawUrl = card.image || card.croppedImg || "";
  const match = rawUrl.match(/(?:id=|\/d\/|\/open\?id=)([\w-]{25,})/);
  const fileId = match ? match[1] : (card.img_id || null);
  
  const finalImageUrl = fileId 
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` 
    : rawUrl;

  // rank列(数値)を優先し、記号があればカウントする
  const starsStr = String(card.stars !== undefined ? card.stars : (card.rank || "0"));
  const starCount = (starsStr.match(/[⭐★☆⭐︎✴︎✳︎]/g) || []).length;
  const displayRank = starCount > 0 ? starCount : starsStr;

  return {
    id: String(card.id || ""),
    name: String(card.name || "Unknown"),
    group: String(card.group || ""),
    pack: String(card.pack || "---"),
    rank: displayRank,
    imageUrl: finalImageUrl,
    hasImage: !!finalImageUrl && finalImageUrl !== ""
  };
};

export async function analyzeCard(base64Image: string, masterData: any[], setStatus: any) {
  let worker;
  try {
    const cardResponse = await fetch(`https://detect.roboflow.com/${PROJECT_CARD}?api_key=${API_KEY_ROBO}`, {
      method: "POST", body: base64Image.split(',')[1],
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    const cardData = await cardResponse.json();
    if (!cardData.predictions || cardData.predictions.length === 0) return [];

    const results = [];
    worker = await createWorker('jpn');

    for (let i = 0; i < cardData.predictions.length; i++) {
      const card = cardData.predictions[i];
      const fullCanvas = await cropImageSimple(base64Image, card);
      const photoCardImage = fullCanvas.toDataURL("image/png");

      setStatus(`[${i+1}] ランク判定中...`);
      const starResponse = await fetch(`https://detect.roboflow.com/${PROJECT_STAR}?api_key=${API_KEY_ROBO}`, {
        method: "POST", body: photoCardImage.split(',')[1],
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      const starData = await starResponse.json();
      const aiDetectedStars = starData.predictions ? starData.predictions.filter((p: any) => p.class === "star").length : 0;

      setStatus(`[${i+1}] テキスト解析中...`);
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

      console.log(`%c[Card #${i+1}] ${displayData.name} - ${displayData.rank}点`, "color: #3b82f6; font-weight: bold;");

      results.push({
        id: displayData.id,
        name: displayData.name,
        group: displayData.group,
        pack: displayData.pack,
        stars: displayData.rank, // 数値を格納
        croppedImg: displayData.imageUrl,
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