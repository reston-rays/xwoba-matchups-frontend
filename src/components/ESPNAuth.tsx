'use client';

import React, { useState, useEffect } from 'react';

interface ESPNAuthProps {
  onAuthComplete: (credentials: { espnS2: string; espnSWID: string }) => void;
  onAuthClear: () => void;
  isAuthenticated: boolean;
}

interface ESPNCredentials {
  espnS2: string;
  espnSWID: string;
  expiresAt: number;
}

const ESPN_AUTH_STORAGE_KEY = 'espn_auth_credentials';
const AUTH_EXPIRY_HOURS = 24;

export default function ESPNAuth({ onAuthComplete, onAuthClear, isAuthenticated }: ESPNAuthProps) {
  const [showAuthFlow, setShowAuthFlow] = useState(false);
  const [authStep, setAuthStep] = useState<'start' | 'login' | 'extract' | 'manual'>('start');
  const [espnS2, setEspnS2] = useState('');
  const [espnSWID, setEspnSWID] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const savedCredentials = loadSavedCredentials();
    if (savedCredentials) {
      setEspnS2(savedCredentials.espnS2);
      setEspnSWID(savedCredentials.espnSWID);
      onAuthComplete(savedCredentials);
    }
  }, [onAuthComplete]);

  const loadSavedCredentials = (): ESPNCredentials | null => {
    try {
      const saved = localStorage.getItem(ESPN_AUTH_STORAGE_KEY);
      if (!saved) return null;

      const credentials: ESPNCredentials = JSON.parse(saved);
      
      // Check if credentials are expired
      if (Date.now() > credentials.expiresAt) {
        localStorage.removeItem(ESPN_AUTH_STORAGE_KEY);
        return null;
      }

      return credentials;
    } catch {
      localStorage.removeItem(ESPN_AUTH_STORAGE_KEY);
      return null;
    }
  };

  const saveCredentials = (credentials: { espnS2: string; espnSWID: string }) => {
    const credentialsWithExpiry: ESPNCredentials = {
      ...credentials,
      expiresAt: Date.now() + (AUTH_EXPIRY_HOURS * 60 * 60 * 1000)
    };
    
    localStorage.setItem(ESPN_AUTH_STORAGE_KEY, JSON.stringify(credentialsWithExpiry));
  };

  const handleAuthComplete = () => {
    if (!espnS2.trim() || !espnSWID.trim()) {
      alert('Please enter both ESPN_S2 and SWID values');
      return;
    }

    const credentials = {
      espnS2: espnS2.trim(),
      espnSWID: espnSWID.trim()
    };

    saveCredentials(credentials);
    onAuthComplete(credentials);
    setShowAuthFlow(false);
    setAuthStep('start');
  };

  const handleClearAuth = () => {
    localStorage.removeItem(ESPN_AUTH_STORAGE_KEY);
    setEspnS2('');
    setEspnSWID('');
    onAuthClear();
    setShowAuthFlow(false);
    setAuthStep('start');
  };

  const handleESPNLogin = () => {
    setIsLoading(true);
    
    // Open ESPN in a new window
    const espnWindow = window.open(
      'https://fantasy.espn.com/',
      'espn-auth',
      'width=800,height=600,scrollbars=yes,resizable=yes'
    );

    // Check if window is closed
    const checkClosed = setInterval(() => {
      if (espnWindow?.closed) {
        clearInterval(checkClosed);
        setIsLoading(false);
        setAuthStep('extract');
      }
    }, 1000);

    // Cleanup after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      setIsLoading(false);
      if (espnWindow && !espnWindow.closed) {
        espnWindow.close();
      }
    }, 5 * 60 * 1000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (!showAuthFlow && !isAuthenticated) {
    return (
      <button
        onClick={() => setShowAuthFlow(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
      >
        🔐 Setup ESPN Authentication
      </button>
    );
  }

  if (!showAuthFlow && isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-green-400 text-sm">✓ ESPN Authenticated</span>
        <button
          onClick={handleClearAuth}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">ESPN Authentication Setup</h2>
          <button
            onClick={() => setShowAuthFlow(false)}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {authStep === 'start' && (
          <div className="space-y-4">
            <p className="text-gray-300">
              To access private ESPN leagues, we need your authentication cookies. Choose your preferred method:
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => setAuthStep('login')}
                className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center justify-center gap-2"
              >
                <span>🚀</span>
                <span>Guided Authentication (Recommended)</span>
              </button>
              
              <button
                onClick={() => setAuthStep('manual')}
                className="w-full p-4 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center gap-2"
              >
                <span>⚙️</span>
                <span>Manual Cookie Entry</span>
              </button>
            </div>
          </div>
        )}

        {authStep === 'login' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Step 1: Login to ESPN</h3>
            <p className="text-gray-300">
              Click the button below to open ESPN Fantasy in a new window. Make sure to log in to your ESPN account.
            </p>
            
            <button
              onClick={handleESPNLogin}
              disabled={isLoading}
              className="w-full p-4 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Waiting for login...</span>
                </>
              ) : (
                <>
                  <span>🌐</span>
                  <span>Open ESPN Fantasy</span>
                </>
              )}
            </button>

            {isLoading && (
              <div className="bg-yellow-900 border border-yellow-600 rounded p-3">
                <p className="text-yellow-200 text-sm">
                  ⏳ Please log in to ESPN Fantasy in the new window, then close it when done.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setAuthStep('start')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setAuthStep('manual')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Skip to Manual Entry
              </button>
            </div>
          </div>
        )}

        {authStep === 'extract' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Step 2: Extract Authentication Cookies</h3>
            
            <div className="bg-blue-900 border border-blue-600 rounded p-4">
              <h4 className="font-semibold text-blue-200 mb-2">For Chrome/Edge:</h4>
              <ol className="list-decimal list-inside space-y-1 text-blue-100 text-sm">
                <li>Press F12 to open Developer Tools</li>
                <li>Go to the &quot;Application&quot; tab</li>
                <li>Click &quot;Cookies&quot; in the left sidebar</li>
                <li>Click &quot;https://fantasy.espn.com&quot;</li>
                <li>Find and copy the values for &quot;espn_s2&quot; and &quot;SWID&quot;</li>
              </ol>
            </div>

            <div className="bg-green-900 border border-green-600 rounded p-4">
              <h4 className="font-semibold text-green-200 mb-2">For Safari:</h4>
              <ol className="list-decimal list-inside space-y-1 text-green-100 text-sm">
                <li>Open Developer Tools (Develop menu → Show Web Inspector)</li>
                <li>Go to the &quot;Storage&quot; tab</li>
                <li>Click &quot;Cookies&quot; → &quot;fantasy.espn.com&quot;</li>
                <li>Find and copy the values for &quot;espn_s2&quot; and &quot;SWID&quot;</li>
              </ol>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Paste ESPN_S2 value here"
                value={espnS2}
                onChange={e => setEspnS2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <input
                type="text"
                placeholder="Paste SWID value here (include the curly braces)"
                value={espnSWID}
                onChange={e => setEspnSWID(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAuthStep('login')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAuthComplete}
                disabled={!espnS2.trim() || !espnSWID.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
              >
                Save Authentication
              </button>
            </div>
          </div>
        )}

        {authStep === 'manual' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Manual Cookie Entry</h3>
            
            <div className="bg-gray-700 rounded p-4">
              <h4 className="font-semibold text-gray-200 mb-2">Instructions:</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                <li>Go to <button onClick={() => copyToClipboard('https://fantasy.espn.com/')} className="text-blue-400 hover:text-blue-300 underline">fantasy.espn.com</button> and log in</li>
                <li>Open Developer Tools (F12)</li>
                <li>Navigate to Application/Storage → Cookies → fantasy.espn.com</li>
                <li>Copy the values for &quot;espn_s2&quot; and &quot;SWID&quot; cookies</li>
                <li>Paste them below</li>
              </ol>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ESPN_S2 Cookie:</label>
                <input
                  type="text"
                  placeholder="Paste ESPN_S2 value here"
                  value={espnS2}
                  onChange={e => setEspnS2(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">SWID Cookie:</label>
                <input
                  type="text"
                  placeholder="Paste SWID value here (include the curly braces)"
                  value={espnSWID}
                  onChange={e => setEspnSWID(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-yellow-900 border border-yellow-600 rounded p-3">
              <p className="text-yellow-200 text-sm">
                💡 These credentials will be saved locally and expire after 24 hours for security.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAuthStep('start')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAuthComplete}
                disabled={!espnS2.trim() || !espnSWID.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
              >
                Save Authentication
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}