/**
 * Brand assets — wordmarks and the Slaï mini-mark.
 * Source: secondlife-identity.md §4.
 */

type SvgProps = {
  className?: string;
  title?: string;
};

export function WordmarkSecondlife({
  className,
  title = "secondlife",
}: SvgProps) {
  return (
    <svg
      viewBox="0 0 600 160"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <text
        x="40"
        y="110"
        fontFamily="var(--font-serif)"
        fontSize="96"
        fontWeight="500"
        fill="currentColor"
        letterSpacing="-2"
      >
        secondlife
      </text>
      <polyline
        points="180,55 195,72 188,90 210,108 200,128"
        fill="none"
        stroke="var(--color-goldseam)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="seam-animate"
      />
    </svg>
  );
}

export function WordmarkSlai({ className, title = "Slaï" }: SvgProps) {
  return (
    <svg
      viewBox="0 0 280 160"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <text
        x="40"
        y="110"
        fontFamily="var(--font-serif)"
        fontSize="96"
        fontWeight="500"
        fill="currentColor"
        letterSpacing="-2"
      >
        sla
      </text>
      <text
        x="186"
        y="110"
        fontFamily="var(--font-serif)"
        fontSize="96"
        fontWeight="500"
        fill="currentColor"
      >
        i
      </text>
      <circle cx="201" cy="48" r="5" fill="var(--color-goldseam)" />
      <circle cx="221" cy="48" r="5" fill="var(--color-goldseam)" />
    </svg>
  );
}

/**
 * Slaï mini-mark — the agent's avatar.
 * Two gold dots above an "i", the visual echo of kintsugi.
 */
export function SlaiAvatar({
  className,
  title = "Slaï",
}: SvgProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <rect width="64" height="64" rx="12" fill="var(--color-bone)" />
      <text
        x="32"
        y="48"
        textAnchor="middle"
        fontFamily="var(--font-serif)"
        fontSize="44"
        fontWeight="500"
        fill="var(--color-ink)"
      >
        i
      </text>
      <circle cx="26" cy="18" r="3" fill="var(--color-goldseam)" />
      <circle cx="38" cy="18" r="3" fill="var(--color-goldseam)" />
    </svg>
  );
}
