// app/components/utils.ts

interface Card {
  name?: string;
  image_url?: string;
  image?: string;
}

export const resolveCardDisplay = (card: Card) => ({
  name: card.name || 'Unknown Card',
  hasImage: !!(card.image_url || card.image),
  imageUrl: card.image_url || card.image || '',
  isUnknown: !card.name || card.name === '',
});
