/**
 * Mode Switcher Component
 * 
 * Copy this to your template's components/ directory
 * Allows switching between Code Agent and Conversation modes
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ModeSwitcher() {
  const pathname = usePathname();
  const isConversation = pathname?.startsWith('/conversation');

  return (
    <div className="flex gap-2 p-4 border-b bg-white">
      <Link
        href="/"
        className={`px-4 py-2 rounded-lg transition-colors ${
          !isConversation
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        Code Agent
      </Link>
      <Link
        href="/conversation"
        className={`px-4 py-2 rounded-lg transition-colors ${
          isConversation
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        Conversation
      </Link>
    </div>
  );
}

