import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Languages, RefreshCw, Cloud, WifiOff } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { fullSync, onSyncStatus, type SyncStatus, getLastSyncTime, getPendingSyncCount, isOnline } from "@/lib/sync";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const unsub = onSyncStatus((status, message) => {
      setSyncStatus(status);
      if (message) setSyncMessage(message);
    });
    return () => { unsub(); };
  }, []);

  const handleSync = async () => {
    const result = await fullSync();
    toast({
      title: result.success ? t('sync_complete', 'Sync Complete') : t('sync_failed', 'Sync Failed'),
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const clearAllData = async () => {
    if (window.confirm("Are you absolutely sure you want to delete ALL records, orders, and inventory? This cannot be undone.")) {
      try {
        await db.records.clear();
        await db.orders.clear();
        await db.inventory.clear();
        toast({
          title: "Success",
          description: "All data has been deleted."
        });
        window.location.reload();
      } catch (err) {
        toast({
          title: "Error",
          description: "Could not delete data.",
          variant: "destructive"
        });
      }
    }
  };

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr';
  };

  const handleExport = async () => {
    try {
      const records = await db.records.toArray();
      const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Backup exported successfully" });
    } catch (e) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          await db.records.clear();
          await db.records.bulkAdd(data);
          toast({ title: "Backup restored successfully" });
        } else {
          throw new Error("Invalid format");
        }
      } catch (error) {
        toast({ title: "Restore failed. Invalid file format.", variant: "destructive" });
      }
      
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            {t('language')}
          </CardTitle>
          <CardDescription>{t("choose_language", "Choose your preferred language")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('english')}</SelectItem>
              <SelectItem value="ar">{t('arabic')}</SelectItem>
            </SelectContent>
          </Select>
        
          <div className="pt-6 border-t">
            <h3 className="text-lg font-medium text-red-600 mb-4">{t("danger_zone", "Danger Zone")}</h3>
            <Button 
              variant="destructive" 
              onClick={clearAllData}
              className="w-full sm:w-auto"
            >
              Delete All System Data
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently delete all production records, orders, and inventory from the database.
            </p>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            {t('server_sync', 'Server Sync')}
          </CardTitle>
          <CardDescription>{t('sync_desc', 'Sync local data with the central server for multi-device access')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isOnline() && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm" data-testid="text-offline-sync-warning">
              <WifiOff className="h-4 w-4 flex-shrink-0" />
              {t('offline_sync_msg', 'You are offline. Changes are saved locally and will sync automatically when connected.')}
            </div>
          )}
          {getPendingSyncCount() > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm" data-testid="text-pending-sync-count">
              <Cloud className="h-4 w-4 flex-shrink-0" />
              {t('pending_changes', '{{count}} changes pending sync', { count: getPendingSyncCount() })}
            </div>
          )}
          <Button 
            className="w-full justify-start" 
            variant="outline" 
            onClick={handleSync}
            disabled={syncStatus === 'syncing' || !isOnline()}
            data-testid="button-sync"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ml-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            {syncStatus === 'syncing' ? t('syncing', 'Syncing...') : t('sync_now', 'Sync Now')}
          </Button>
          {syncMessage && (
            <p className={`text-sm ${syncStatus === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}>
              {syncMessage}
            </p>
          )}
          {getLastSyncTime() > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="text-last-sync-time">
              {t('last_synced', 'Last synced')}: {new Date(getLastSyncTime()).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {t('backup_restore', 'Backup & Restore')}
          </CardTitle>
          <CardDescription>{t('backup_desc', 'Export your data or restore from a previous backup')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full justify-start" variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2 ml-2" />
            {t('export_backup')}
          </Button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImport}
            />
            <Button 
              className="w-full justify-start" 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2 ml-2" />
              {t('restore_backup')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}