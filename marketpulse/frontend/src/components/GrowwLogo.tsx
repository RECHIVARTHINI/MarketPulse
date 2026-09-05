interface GrowwLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function GrowwLogo({ size = 32, showText = true, className = '' }: GrowwLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Precision Vector Groww Circle Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        <defs>
          <clipPath id="circleClip">
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>
        <g clipPath="url(#circleClip)">
          {/* Top Blue Half */}
          <rect width="100" height="100" fill="#5367FF" />
          {/* Bottom Green Half with Market Step / Wave */}
          <path
            d="M-5 68 L28 46 L48 56 L88 32 L105 40 L105 105 L-5 105 Z"
            fill="#00D09C"
          />
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black tracking-tight text-[#44475B]">
              Market<span className="text-[#5367FF]">Pulse</span>
            </span>
            <span className="rounded-md bg-[#E8FAF5] px-1.5 py-0.5 text-[10px] font-bold text-[#00D09C] border border-[#B3F2DF]">
              Groww Theme
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
