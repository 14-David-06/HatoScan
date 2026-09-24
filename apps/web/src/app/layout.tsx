import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/presentation/styles.css';

export const metadata: Metadata = {
  title: 'HatoScan',
  description: 'Conteo de ganado en fotos aéreas de dron, con revisión humana.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
