'use client';
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationMenuContextType {
  activeItem: string | null;
  setActiveItem: (item: string | null) => void;
}

const NavigationMenuContext = React.createContext<NavigationMenuContextType | undefined>(undefined);

export function navigationMenuTriggerStyle() {
  return 'group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:bg-gray-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-gray-100';
}

export function NavigationMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [activeItem, setActiveItem] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveItem(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <NavigationMenuContext.Provider value={{ activeItem, setActiveItem }}>
      <nav ref={containerRef} className={cn('relative z-40 flex max-w-max flex-1 items-center justify-center', className)}>
        {children}
      </nav>
    </NavigationMenuContext.Provider>
  );
}

export function NavigationMenuList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}>
      {children}
    </ul>
  );
}

interface NavigationMenuItemContextType {
  value: string;
}

const NavigationMenuItemContext = React.createContext<NavigationMenuItemContextType | undefined>(undefined);

export function NavigationMenuItem({
  children,
  className,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  value?: string;
}) {
  const autoValue = React.useId();
  const itemValue = value || autoValue;

  return (
    <NavigationMenuItemContext.Provider value={{ value: itemValue }}>
      <li className={cn('relative', className)}>{children}</li>
    </NavigationMenuItemContext.Provider>
  );
}

export function NavigationMenuTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const menuContext = React.useContext(NavigationMenuContext);
  const itemContext = React.useContext(NavigationMenuItemContext);

  if (!menuContext || !itemContext) {
    throw new Error('NavigationMenuTrigger must be inside NavigationMenu and NavigationMenuItem');
  }

  const isOpen = menuContext.activeItem === itemContext.value;

  const toggle = () => {
    menuContext.setActiveItem(isOpen ? null : itemContext.value);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      data-state={isOpen ? 'open' : 'closed'}
      className={cn(navigationMenuTriggerStyle(), 'gap-1', className)}
    >
      {children}
      <ChevronDown
        className={cn(
          'relative top-[1px] ml-1 h-3.5 w-3.5 transition duration-200 text-gray-400',
          isOpen && 'rotate-180'
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export function NavigationMenuContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const menuContext = React.useContext(NavigationMenuContext);
  const itemContext = React.useContext(NavigationMenuItemContext);

  if (!menuContext || !itemContext) {
    throw new Error('NavigationMenuContent must be inside NavigationMenu and NavigationMenuItem');
  }

  const isOpen = menuContext.activeItem === itemContext.value;
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute left-0 top-full mt-2 w-auto min-w-[240px] rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-xl animate-in fade-in-80 zoom-in-95 duration-150 z-50',
        className
      )}
    >
      {children}
    </div>
  );
}

export function NavigationMenuLink({
  children,
  render,
  className,
  onClick,
  ...props
}: {
  children?: React.ReactNode;
  render?: React.ReactNode;
  className?: string;
  onClick?: () => void;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const menuContext = React.useContext(NavigationMenuContext);

  const handleClick = (e: React.MouseEvent<any>) => {
    if (onClick) onClick();
    if (menuContext) menuContext.setActiveItem(null);
  };

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        if ((render as any).props.onClick) (render as any).props.onClick(e);
        handleClick(e);
      },
      className: cn(
        'block select-none rounded-lg p-2.5 leading-none no-underline outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900',
        className,
        (render as any).props.className
      ),
    });
  }

  return (
    <a
      onClick={handleClick}
      className={cn(
        'block select-none rounded-lg p-2.5 leading-none no-underline outline-hidden transition-colors hover:bg-gray-100 hover:text-gray-900',
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}
