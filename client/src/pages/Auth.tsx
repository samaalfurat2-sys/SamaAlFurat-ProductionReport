import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, AlertCircle, WifiOff } from "lucide-react";
import { isOnline } from "@/lib/sync";

interface AuthProps {
  onLogin: (role: string, userData?: any) => void;
}

const CACHED_CREDENTIALS_KEY = 'cachedCredentials';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_samaalfurat_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCachedCredentials(): Record<string, { role: string; userData: any; hash: string }> {
  try {
    return JSON.parse(localStorage.getItem(CACHED_CREDENTIALS_KEY) || '{}');
  } catch { return {}; }
}

async function cacheCredentials(username: string, password: string, role: string, userData: any) {
  const cached = getCachedCredentials();
  const hash = await hashPassword(password);
  cached[username] = { role, userData, hash };
  localStorage.setItem(CACHED_CREDENTIALS_KEY, JSON.stringify(cached));
}

async function verifyOfflineCredentials(username: string, password: string): Promise<{ role: string; userData: any } | null> {
  const cached = getCachedCredentials();
  const entry = cached[username];
  if (!entry) return null;
  const hash = await hashPassword(password);
  if (entry.hash === hash) {
    return { role: entry.role, userData: entry.userData };
  }
  return null;
}

const SERVER_URL = (window as any).AndroidBridge?.getServerUrl?.() || '';
const LOGIN_URL = SERVER_URL ? `${SERVER_URL}/api/auth/login` : '/api/auth/login';

export default function Auth({ onLogin }: AuthProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const online = isOnline();

  const handleLogin = async () => {
    if (!username || !password) {
      setError(t('login_fields_required', 'Username and password are required'));
      return;
    }
    
    setLoading(true);
    setError("");
    
    if (!isOnline()) {
      const offlineResult = await verifyOfflineCredentials(username, password);
      if (offlineResult) {
        localStorage.setItem('userData', JSON.stringify(offlineResult.userData));
        onLogin(offlineResult.role, offlineResult.userData);
      } else {
        setError(t('offline_no_cache', 'No internet connection. You must log in online at least once first.'));
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        await cacheCredentials(username, password, data.role, data);
        localStorage.setItem('userData', JSON.stringify(data));
        onLogin(data.role, data);
      } else {
        setError(data.error || t('login_failed', 'Login failed'));
      }
    } catch (e) {
      const offlineResult = await verifyOfflineCredentials(username, password);
      if (offlineResult) {
        localStorage.setItem('userData', JSON.stringify(offlineResult.userData));
        onLogin(offlineResult.role, offlineResult.userData);
      } else {
        setError(t('login_error', 'Connection error. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('app_title', 'Production Report')}</CardTitle>
          <CardDescription>{t('login_subtitle', 'Sign in to continue')}</CardDescription>
          {!online && (
            <div className="flex items-center justify-center gap-2 text-amber-600 text-sm mt-2" data-testid="text-offline-indicator">
              <WifiOff className="h-4 w-4" />
              {t('offline_mode', 'Offline Mode')}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="text-login-error">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('username', 'Username')}</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('enter_username', 'Enter username')}
                className="h-12 text-base"
                autoFocus
                data-testid="input-login-username"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('password', 'Password')}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('enter_password', 'Enter password')}
                className="h-12 text-base"
                data-testid="input-login-password"
              />
            </div>

            <Button
              className="w-full h-12 text-lg font-medium mt-4"
              onClick={handleLogin}
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? t('signing_in', 'Signing in...') : t('sign_in', 'Sign In')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
