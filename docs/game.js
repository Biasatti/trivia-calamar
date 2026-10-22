export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function selectQuestions(bank) {
  return shuffle([['easy',4],['medium',4],['hard',2]].flatMap(([d,n]) => {
    const pool = bank.filter(q => q.difficulty === d);
    if (pool.length < n) throw new Error('Faltan preguntas para preparar la partida.');
    return shuffle(pool).slice(0,n);
  }));
}
export function formatTime(ms) {
  const s = Math.floor(Math.max(0,ms)/1000);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
export function validateRegistration({first,last,email,consent}) {
  if (!consent) return 'Necesitamos tu autorización para registrar el resultado.';
  if (![first,last].every(s => s.trim().length >= 2 && s.trim().length <= 60)) return 'Ingresá nombre y apellido de entre 2 y 60 caracteres.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Revisá la dirección de mail.';
  return '';
}
export function resultMessage(score) {
  return score === 100 ? '¡Calamar de pura cepa!' : score >= 70 ? '¡Tenés corazón calamar!' : score >= 40 ? '¡La pasión está intacta!' : '¡La próxima es tuya, Calamar!';
}
