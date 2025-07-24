'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sidebar component provides the main navigation menu for the XOB CAT dashboard.
 * 
 * Features:
 * - Fixed positioning on left side below TopNav (ml-64 pt-16 layout)
 * - "Pages" section with navigation links
 * - Active state management using usePathname() hook
 * - Accessibility with proper ARIA labels and roles
 * - Responsive hover states and smooth transitions
 * 
 * Navigation Structure:
 * ┌─────────────┐
 * │ Pages       │
 * │ • View Sessions     │ (default active)
 * │ • Analyze Sessions  │ (coming soon)
 * └─────────────┘
 */

/**
 * Left sidebar navigation component for the XOB CAT dashboard
 */
export default function Sidebar() {
  const pathname = usePathname();

  /** Navigation items configuration */
  const navigationItems = [
    { name: 'View Sessions', href: '/sessions' },
    { name: 'Analyze Sessions', href: '/analyze' },
  ];

  /**
   * Determines if a navigation item is currently active
   * @param href - The href to check against current pathname
   * @returns boolean indicating if the route is active
   */
  const isActive = (href: string) => pathname === href;

  return (
    <nav
      role="navigation"
      aria-label="Sidebar navigation"
      className="fixed left-0 top-16 h-full w-64 bg-white border-r border-gray-200 overflow-y-auto"
    >
      <div className="p-4">
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pages
          </h2>
          <ul className="space-y-1">
            {navigationItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`
                    block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150
                    ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}