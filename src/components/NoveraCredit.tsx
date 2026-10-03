export function NoveraCredit() {
  return (
    <a
      href="https://novera-studio.ru"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-stone-500 hover:text-emerald-400 transition-colors text-xs"
      aria-label="Сделано в NOVERA Studio — перейти на novera-studio.ru"
    >
      {/* Логотип NOVERA */}
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="10" fill="currentColor" />
        <path d="M9 22V10l14 12V10" stroke="white" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Сделано в <span className="font-semibold">NOVERA</span> Studio</span>
    </a>
  );
}
