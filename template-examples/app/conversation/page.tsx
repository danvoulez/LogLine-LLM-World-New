/**
 * Conversation Page
 * 
 * Copy this to your template's app/conversation/page.tsx
 * Shows conversation interface using app actions
 */

'use client';

import { useState, useEffect } from 'react';
import { ConversationPanel } from '@/components/ConversationPanel';
import { getApp, getApps, importApp } from '@/lib/backend-client';
import frontendManifest from '@/../frontend-app-manifest.json';

export default function ConversationPage() {
  const [appId, setAppId] = useState<string>('coding-agent-frontend');
  const [appRegistered, setAppRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAppRegistration();
  }, []);

  const checkAppRegistration = async () => {
    try {
      // Try to get the app
      const app = await getApp('coding-agent-frontend');
      setAppRegistered(true);
      setLoading(false);
    } catch (err: any) {
      if (err.message.includes('not found')) {
        // App not registered, try to import it
        try {
          await importApp(frontendManifest);
          setAppRegistered(true);
          setLoading(false);
        } catch (importErr: any) {
          setError(`Failed to register app: ${importErr.message}`);
          setLoading(false);
        }
      } else {
        setError(`Failed to check app: ${err.message}`);
        setLoading(false);
      }
    }
  };

  const handleRegisterApp = async () => {
    setLoading(true);
    setError(null);
    try {
      await importApp(frontendManifest);
      setAppRegistered(true);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to register app: ${err.message}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !appRegistered) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={handleRegisterApp}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Register App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 bg-white">
        <h1 className="text-2xl font-bold">Conversation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Using app: {appId}
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationPanel
          appId={appId}
          userId={undefined} // Get from auth context
          tenantId="default-tenant" // Get from auth context
        />
      </div>
    </div>
  );
}

