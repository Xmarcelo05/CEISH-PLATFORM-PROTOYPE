import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useCeishStore } from '../../store/ceishStore';

interface Props {
  children: ReactNode;
}

export function AppProviders({ children }: Props) {
  useEffect(() => {
    useCeishStore.getState().cargarConfiguracion();
  }, []);

  return <>{children}</>;
}
