import Image from "next/image";

interface TrackFlowLogoProps {
  size?: number;
  className?: string;
}

/**
 * Uses next/image so Next.js serves a properly sized WebP at exactly the
 * display resolution (incl. 2× Retina), giving a crisp result instead of
 * letting the browser scale the full 1024×1024 PNG down in CSS.
 */
export function TrackFlowLogo({ size = 36, className }: TrackFlowLogoProps) {
  return (
    <Image
      src="/trackflow-icon-1024.png"
      alt="TrackFlow"
      width={size}
      height={size}
      quality={100}
      priority
      className={className}
    />
  );
}
