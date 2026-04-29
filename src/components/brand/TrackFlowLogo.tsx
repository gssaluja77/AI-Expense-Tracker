interface TrackFlowLogoProps {
  size?: number;
  className?: string;
}

// The PNG is 1536×1024 (3:2). Plain <img> renders reliably in both server
// and client components without Next.js image-optimizer quirks.
export function TrackFlowLogo({ size = 36, className }: TrackFlowLogoProps) {
  const h = size;
  const w = Math.round(size * 1.5);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/trackflow-icon-1024.png"
      alt="TrackFlow"
      width={w}
      height={h}
      style={{ width: w, height: h, display: "block" }}
      className={className}
    />
  );
}
