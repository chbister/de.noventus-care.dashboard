// Maskiert einen Namen so, dass nur die ersten 3 Buchstaben sichtbar sind.
// Admins sehen den vollen Namen (isAdmin = true).
// Beispiel: "Maria Müller" -> "Mar*** Mül****"
export function maskName(name, isAdmin = false) {
  if (isAdmin || !name) return name;
  return name.trim().split(/\s+/).map(part => {
    if (part.length <= 3) return part;
    return part.slice(0, 3) + '*'.repeat(Math.min(part.length - 3, 5));
  }).join(' ');
}