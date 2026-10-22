import type { ReactNode } from 'react';

// Se monta de nuevo en cada navegación: da a cada página una única entrada corta (styles/shell.css).
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
