export default function GoogleMapsEmbed({ lat, lng, query, zoom = 14, title, className = 'w-full h-full' }) {
  const location = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : query || 'Bandung, Indonesia';
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(location)}&z=${zoom}&output=embed`;

  return (
    <iframe
      title={title}
      src={src}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  );
}
