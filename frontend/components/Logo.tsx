export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-serif text-lg font-semibold tracking-tight">
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 3h8l4 4v14H6z" fill="#fff" stroke="#1d1b17" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 3v4h4" stroke="#1d1b17" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="14" r="3.2" fill="#0f766e" />
        <path d="m14.4 16.4 2.4 2.4" stroke="#0f766e" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      DocuMind
    </span>
  );
}
