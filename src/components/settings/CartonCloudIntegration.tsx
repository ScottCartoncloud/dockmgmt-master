import { useState, useEffect } from 'react';
import { Link2, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  useCartonCloudSettings,
  useSaveCartonCloudSettings,
  useDeleteCartonCloudSettings,
  useTestCartonCloudConnection,
} from '@/hooks/useCartonCloudSettings';

export function CartonCloudIntegration() {
  const { data: settings, isLoading } = useCartonCloudSettings();
  const saveSettings = useSaveCartonCloudSettings();
  const deleteSettings = useDeleteCartonCloudSettings();
  const testConnection = useTestCartonCloudConnection();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (settings) {
      setClientId(settings.client_id);
      setClientSecret(settings.client_secret);
      setTenantId(settings.cartoncloud_tenant_id);
      setConnectionStatus('success');
    }
  }, [settings]);

  const handleTestConnection = async () => {
    if (!clientId || !clientSecret || !tenantId) {
      toast.error('Please fill in all fields');
      return;
    }

    setConnectionStatus('idle');
    
    try {
      const result = await testConnection.mutateAsync({
        clientId,
        clientSecret,
        tenantId,
      });

      if (result.success) {
        setConnectionStatus('success');
        toast.success(result.message);
      } else {
        setConnectionStatus('error');
        toast.error(result.message);
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Connection test failed');
    }
  };

  const handleSave = async () => {
    if (!clientId || !clientSecret || !tenantId) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await saveSettings.mutateAsync({
        client_id: clientId,
        client_secret: clientSecret,
        cartoncloud_tenant_id: tenantId,
      });
      toast.success('CartonCloud settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleDisconnect = async () => {
    if (!settings?.id) return;

    try {
      await deleteSettings.mutateAsync(settings.id);
      setClientId('');
      setClientSecret('');
      setTenantId('');
      setConnectionStatus('idle');
      toast.success('CartonCloud integration disconnected');
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = settings && connectionStatus === 'success';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-semibold text-foreground">CartonCloud Integration</h2>
        </div>
        {isConnected && (
          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        )}
      </div>

      <p className="text-muted-foreground">
        Connect your CartonCloud account to link Purchase Orders with cross-dock bookings.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">Client ID</Label>
          <Input
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter your CartonCloud Client ID"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client Secret</Label>
          <div className="relative">
            <Input
              id="clientSecret"
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Enter your CartonCloud Client Secret"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenantId">Tenant ID</Label>
          <Input
            id="tenantId"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="Enter your CartonCloud Tenant ID (UUID)"
          />
          <p className="text-xs text-muted-foreground">
            You can find your Tenant ID in CartonCloud under Settings → API Clients
          </p>
        </div>

        {connectionStatus === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">Connection failed. Please check your credentials.</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <Button
            onClick={handleTestConnection}
            variant="outline"
            disabled={testConnection.isPending || !clientId || !clientSecret || !tenantId}
          >
            {testConnection.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Test Connection
          </Button>

          <Button
            onClick={handleSave}
            disabled={saveSettings.isPending || !clientId || !clientSecret || !tenantId}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </Button>

          {isConnected && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect CartonCloud?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your CartonCloud credentials. You won't be able to search for Purchase Orders until you reconnect.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
