/**
 * スキャン結果やマスターデータを画面表示用に整形する
 */
export const resolveCardDisplay = (card: any) => {
  // データがない場合のデフォルト値
  if (!card) {
    return { id: "---", name: "---", pack: "---", rank: "0", imageUrl: null, hasImage: false };
  }

  // 1. Google Drive 403エラー回避 (thumbnail APIを使用)
  // スプレッドシートの 'image' 列、またはスキャン結果の 'croppedImg' からURLを取得
  const rawUrl = card.image || card.croppedImg || "";
  const match = rawUrl.match(/(?:id=|\/d\/|\/open\?id=)([\w-]{25,})/);
  const fileId = match ? match[1] : (card.img_id || null);
  
  // 高画質サムネイルURLを生成（これがGoogle Drive画像を表示する最も安定した方法です）
  const finalImageUrl = fileId 
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` 
    : rawUrl;

  // 2. ランク表示ロジック
  // スキャン結果の 'stars' (数値) またはスプレッドシートの 'rank' 列を参照
  const rawRank = card.stars !== undefined ? card.stars : (card.rank || "0");
  const starsStr = String(rawRank);
  
  // もし「⭐︎⭐︎」のような記号が含まれていたら数を数え、数値ならそのまま使う
  const starCount = (starsStr.match(/[⭐★☆⭐︎✴︎✳︎]/g) || []).length;
  const displayRank = starCount > 0 ? starCount : starsStr;

  return {
    id: String(card.id || ""),
    name: String(card.name || "Unknown"),
    group: String(card.group || ""), // グループ名も保持
    pack: String(card.pack || "---"),
    rank: displayRank, // 最終的に「2」や「3」という数値（または文字列）になる
    imageUrl: finalImageUrl,
    hasImage: !!finalImageUrl && finalImageUrl !== ""
  };
};