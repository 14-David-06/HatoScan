import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppHeader } from '@/presentation/ui/app-header';
import { toSessionUser } from '@/presentation/view-models';
import { logout } from './_auth/actions';
import { currentUser } from './_auth/session';
import '@/presentation/styles.css';

// Archivo variable: el eje de ancho (wdth) da la voz expandida de títulos y cifras.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  title: 'HatoScan',
  description: 'Conteo de ganado en fotos aéreas de dron, con revisión humana.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#151e19' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="es" className={archivo.variable}>
      <body>
        <AppHeader user={user ? toSessionUser(user) : null} logoutAction={logout} />
        {children}
      </body>
    </html>
  );
}
