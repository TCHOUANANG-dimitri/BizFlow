import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';
import AppShell from './components/AppShell';
import AuthGate from './components/AuthGate';

const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-manrope' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BizFlow',
  description: 'Votre activité, sous contrôle — ventes, caisse, stock au quotidien.',
  // Favicon canonique : bizflow-icon.png depuis packages/shared/brand (copié
  // dans public/brand par scripts/sync-brand.mjs — jamais dupliqué à la main).
  icons: {
    icon: '/brand/bizflow-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
