'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SessionUserView } from '../view-models';
import { BrandMark } from './brand';
import { ListIcon, PlusIcon, UserIcon } from './icons';

const COUNTS_PATH = '/conteos';
const NEW_COUNT_PATH = '/conteos/nuevo';
const LOGIN_PATH = '/ingresar';

export function AppHeader({
  user,
  logoutAction,
}: {
  user: SessionUserView | null;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const inApp = pathname === COUNTS_PATH || pathname.startsWith(`${COUNTS_PATH}/`);
  const onNewCount = pathname === NEW_COUNT_PATH;

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href={user ? COUNTS_PATH : '/'} className="brand" aria-label="HatoScan, inicio">
          <BrandMark />
          <span className="brand__name">HatoScan</span>
          <span className="brand__context">Inventario aéreo de ganado</span>
        </Link>

        <nav className="nav" aria-label="Principal">
          {user && inApp ? (
            <>
              <Link
                href={COUNTS_PATH}
                className="nav__link nav__link--secondary"
                aria-current={!onNewCount ? 'page' : undefined}
              >
                <ListIcon />
                Conteos
              </Link>
              {user.canReview && !onNewCount && (
                <Link href={NEW_COUNT_PATH} className="button button--primary button--sm nav__cta">
                  <PlusIcon size={16} />
                  <span className="nav__cta-label">Nuevo conteo</span>
                </Link>
              )}
              <form action={logoutAction} className="nav__user">
                <span className="nav__user-name" title={user.id}>
                  <UserIcon size={16} />
                  <span className="nav__user-label">{user.name}</span>
                </span>
                <button type="submit" className="button button--ghost button--sm">
                  Salir
                </button>
              </form>
            </>
          ) : user ? (
            <Link href={COUNTS_PATH} className="button button--primary button--sm">
              Ir a conteos
            </Link>
          ) : (
            pathname !== LOGIN_PATH && (
              <Link href={LOGIN_PATH} className="button button--primary button--sm">
                Ingresar
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
