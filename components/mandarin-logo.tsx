"use client"

export function MandarinLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Mandarin orange body */}
      <circle cx="20" cy="22" r="16" fill="url(#orangeGradient)" />
      {/* Highlight */}
      <ellipse cx="14" cy="16" rx="4" ry="3" fill="rgba(255,255,255,0.3)" />
      {/* Stem */}
      <path d="M20 6 L20 10" stroke="#5D7534" strokeWidth="2" strokeLinecap="round" />
      {/* Leaf */}
      <path d="M20 8 Q26 4 28 8 Q26 10 20 8" fill="#7CB342" />
      {/* Cute face - eyes */}
      <circle cx="15" cy="22" r="2" fill="#5D4037" />
      <circle cx="25" cy="22" r="2" fill="#5D4037" />
      {/* Eye highlights */}
      <circle cx="15.5" cy="21.5" r="0.8" fill="white" />
      <circle cx="25.5" cy="21.5" r="0.8" fill="white" />
      {/* Cute smile */}
      <path d="M16 27 Q20 30 24 27" stroke="#5D4037" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Blush */}
      <ellipse cx="11" cy="25" rx="2.5" ry="1.5" fill="rgba(255,138,128,0.5)" />
      <ellipse cx="29" cy="25" rx="2.5" ry="1.5" fill="rgba(255,138,128,0.5)" />
      <defs>
        <radialGradient id="orangeGradient" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#FFB74D" />
          <stop offset="100%" stopColor="#F57C00" />
        </radialGradient>
      </defs>
    </svg>
  )
}
