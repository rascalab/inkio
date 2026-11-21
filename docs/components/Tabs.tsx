import type { ReactNode } from 'react';

type TabsProps<T extends string> = {
  id: string;
  label: string;
  className: string;
  buttonClassName?: string;
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function Tabs<T extends string>({ id, label, className, buttonClassName, items, value, onChange }: TabsProps<T>) {
  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          id={`${id}-${item.id}-tab`}
          type="button"
          role="tab"
          aria-controls={`${id}-${item.id}-panel`}
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          className={buttonClassName}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            let next: number;
            switch (event.key) {
              case 'ArrowLeft': next = (index + items.length - 1) % items.length; break;
              case 'ArrowRight': next = (index + 1) % items.length; break;
              case 'Home': next = 0; break;
              case 'End': next = items.length - 1; break;
              default: return;
            }
            event.preventDefault();
            const nextId = items[next].id;
            onChange(nextId);
            event.currentTarget.ownerDocument.getElementById(`${id}-${nextId}-tab`)?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, tab, active, className, children }: {
  id: string;
  tab: string;
  active: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      id={`${id}-${tab}-panel`}
      className={className}
      role="tabpanel"
      aria-labelledby={`${id}-${tab}-tab`}
      hidden={!active}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
