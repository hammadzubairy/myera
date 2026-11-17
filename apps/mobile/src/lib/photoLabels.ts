/** Label for compare slider / thumbnails — matches design "Jun 1, 221 lb". */
export function formatPhotoLabel(photo: {
  taken_on: string;
  weight_lb?: number | null;
}): string {
  const date = photo.taken_on;
  if (photo.weight_lb != null) return `${date}, ${photo.weight_lb} lb`;
  return date;
}
