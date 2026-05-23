// app/components/utils.ts

interface Card {
  name?: string;
  image_url?: string;
}

export const resolveCardDisplay = (card: Card) => ({
  name: card.name || 'Unknown Card',
  hasImage: !!card.image_url,
  imageUrl: card.image_url || '',
  isUnknown: !card.name || card.name === '',
});
