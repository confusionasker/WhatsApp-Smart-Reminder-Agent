export const formatDate = (iso, timeZone) => {
  if (!iso) return '—'
  try {
    // If the ISO string lacks timezone offset or Z, assume UTC
    const normalized = (!iso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) ? `${iso}Z` : iso
    const date = new Date(normalized)
    if (isNaN(date.getTime())) return iso

    const options = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }

    if (timeZone) {
      try {
        return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date)
      } catch {
        // Ignore unrecognized timezone and fall back to browser locale
      }
    }
    return new Intl.DateTimeFormat('en-US', options).format(date)
  } catch {
    return iso
  }
}

