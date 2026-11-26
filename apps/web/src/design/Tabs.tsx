// A row of tabs (`.tabs` of `.tab`, the current one `.on`). With an icon, the name is in `.tab-label` (the left
// drawer shows only the icon of the tabs not chosen). `children` come after the tabs (a close button…).
import type { ReactNode } from 'react';
import { cls } from './cls';
import { Icon, type IconName } from './Icon';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: IconName;
  title?: string;
}
export interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  children?: ReactNode;
}

export function Tabs<T extends string>({ tabs, value, onChange, className, children }: TabsProps<T>) {
  return (
    <div className={cls('tabs', className)}>
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          className={`tab ${t.id === value ? 'on' : ''}`}
          title={t.title}
          onClick={() => onChange(t.id)}
        >
          {t.icon ? (
            <>
              <Icon name={t.icon} />
              <span className="tab-label">{t.label}</span>
            </>
          ) : (
            t.label
          )}
        </button>
      ))}
      {children}
    </div>
  );
}
