// A side panel of the shell (`.drawer-left`: the players, pushes the stage; `.drawer-right`: the settings, over the
// stage with a `.backdrop`). Open while an ancestor has the class `left-open` / `right-open` (app/App.tsx puts them
// on <body>): the CSS slides it, nothing is unmounted. Its scrolling content: <DrawerBody>.
import type { ReactNode } from 'react';
import { cls } from './cls';

export interface DrawerProps {
  side: 'left' | 'right';
  /** The right drawer: a click on its backdrop closes it. */
  onClose?: () => void;
  className?: string;
  children?: ReactNode;
}

export function Drawer({ side, onClose, className, children }: DrawerProps) {
  const aside = <aside className={cls('drawer', `drawer-${side}`, className)}>{children}</aside>;
  return side === 'right' ? (
    <>
      <div className="backdrop" onClick={onClose} />
      {aside}
    </>
  ) : (
    aside
  );
}

export const DrawerBody = ({ children }: { children: ReactNode }) => <div className="drawer-body">{children}</div>;
