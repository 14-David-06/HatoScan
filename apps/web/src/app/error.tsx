'use client';

import { ErrorScreen } from '@/presentation/screens/error-screen';

// `retry` vuelve a pedir los datos del servidor; `reset` solo limpiaría el estado del límite.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorScreen error={error} retry={retry} />;
}
