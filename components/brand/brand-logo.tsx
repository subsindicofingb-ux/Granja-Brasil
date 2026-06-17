import Image from "next/image";
import Link from "next/link";
import { BRAND_LOGO_SRC, BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "hero";

const sizeClasses: Record<BrandLogoSize, string> = {
  xs: "h-8 w-auto max-w-[88px]",
  sm: "h-10 w-auto max-w-[110px]",
  md: "h-14 w-auto max-w-[150px]",
  lg: "h-20 w-auto max-w-[200px]",
  hero: "h-24 w-auto max-w-[240px] sm:h-28 sm:max-w-[280px]",
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  showName?: boolean;
  showTagline?: boolean;
  href?: string;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({
  size = "md",
  showName = false,
  showTagline = false,
  href,
  className,
  priority = false,
}: BrandLogoProps) {
  const content = (
    <div className={cn("flex flex-col items-center gap-2 text-center sm:items-start sm:text-left", className)}>
      <Image
        src={BRAND_LOGO_SRC}
        alt={`Logo ${BRAND_NAME}`}
        width={280}
        height={280}
        priority={priority}
        className={cn("object-contain", sizeClasses[size])}
      />
      {showName && <p className="text-sm font-semibold tracking-wide text-foreground">{BRAND_NAME}</p>}
      {showTagline && (
        <p className="max-w-xs text-xs text-muted-foreground sm:text-sm">{BRAND_TAGLINE}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex rounded-lg transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
