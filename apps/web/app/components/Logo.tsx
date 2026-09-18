import Image from 'next/image';

// Sert les PNG copiés depuis packages/shared/brand (voir scripts/sync-brand.mjs)
// — jamais une copie éditée à la main. Voir documentation/DESIGN_SYSTEM.md §1.
export default function Logo({ variant = 'icon', className }: { variant?: 'full' | 'icon'; className?: string }) {
  if (variant === 'full') {
    return (
      <Image
        src="/brand/bizflow-logo-full.png"
        alt="BizFlow — Votre activité, sous contrôle"
        width={480}
        height={320}
        className={className}
        priority
      />
    );
  }
  return (
    <Image
      src="/brand/bizflow-icon.png"
      alt="BizFlow"
      width={40}
      height={40}
      className={className}
      priority
    />
  );
}
