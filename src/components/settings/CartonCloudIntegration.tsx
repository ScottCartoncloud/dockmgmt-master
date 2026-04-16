import { useState, useEffect } from 'react';
import { Link2, Eye, EyeOff, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useTestSavedCartonCloudConnection,
  CARTONCLOUD_API_ENDPOINTS,
  DEFAULT_API_BASE_URL,
} from '@/hooks/useCartonCloudSettings';
import { useAuth } from '@/hooks/useAuth';

const CUSTOM_OPTION_VALUE = '__custom__';

export function CartonCloudIntegration() {
  const { data: settings, isLoading } = useCartonCloudSettings();
  const saveSettings = useSaveCartonCloudSettings();
  const deleteSettings = useDeleteCartonCloudSettings();
  const testConnection = useTestCartonCloudConnection();
  const testSavedConnection = useTestSavedCartonCloudConnection();
  const { isSuperUser } = useAuth();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [isCustomUrl, setIsCustomUrl] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);

  // Masked placeholder to show credentials are saved
  const MASKED_VALUE = '••••••••••••••••';

  // Check if a URL is in the standard endpoints list
  const isStandardEndpoint = (url: string) => {
    return CARTONCLOUD_API_ENDPOINTS.some(ep => ep.value === url);
  };

  // NOTE: Credentials (client_id, client_secret) are never exposed to the client for security.
  // When settings exist, we only get metadata. User must re-enter credentials to update.
  useEffect(() => {
    if (settings) {
      // Only set tenant ID and API base URL which are non-sensitive
      setTenantId(settings.cartoncloud_tenant_id);
      
      const savedUrl = settings.api_base_url || DEFAULT_API_BASE_URL;
      if (isStandardEndpoint(savedUrl)) {
        setApiBaseUrl(savedUrl);
        setIsCustomUrl(false);
        setCustomApiUrl('');
      } else {
        // Custom URL - only super users should see this
        setApiBaseUrl(CUSTOM_OPTION_VALUE);
        setIsCustomUrl(true);
        setCustomApiUrl(savedUrl);
      }
      
      setConnectionStatus('success');
      // Clear credential fields - they're stored securely but never returned
      setClientId('');
      setClientSecret('');
      setIsEditingCredentials(false);
    }
  }, [settings]);

  const hasCredentialsSaved = !!settings?.has_credentials;

  // Get the effective API base URL for operations
  const getEffectiveApiBaseUrl = () => {
    if (isCustomUrl && customApiUrl) {
      return customApiUrl;
    }
    return apiBaseUrl === CUSTOM_OPTION_VALUE ? DEFAULT_API_BASE_URL : apiBaseUrl;
  };

  const handleApiEndpointChange = (value: string) => {
    if (value === CUSTOM_OPTION_VALUE) {
      setIsCustomUrl(true);
      setApiBaseUrl(value);
    } else {
      setIsCustomUrl(false);
      setCustomApiUrl('');
      setApiBaseUrl(value);
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('idle');
    
    try {
      let result;
      
      // If no new credentials entered but we have saved settings, test the saved connection
      if (!clientId && !clientSecret && settings) {
        result = await testSavedConnection.mutateAsync();
      } else if (clientId && clientSecret && tenantId) {
        // Test with new credentials
        result = await testConnection.mutateAsync({
          clientId,
          clientSecret,
          tenantId,
          apiBaseUrl: getEffectiveApiBaseUrl(),
        });
      } else {
        toast.error('Please fill in all fields or test existing connection');
        return;
      }

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

    const effectiveApiUrl = getEffectiveApiBaseUrl();

    // Validate custom URL format
    if (isCustomUrl) {
      try {
        const parsed = new URL(effectiveApiUrl);
        if (parsed.protocol !== 'https:') {
          toast.error('Custom API URL must use HTTPS');
          return;
        }
      } catch {
        toast.error('Invalid custom API URL format');
        return;
      }
    }

    try {
      await saveSettings.mutateAsync({
        client_id: clientId,
        client_secret: clientSecret,
        cartoncloud_tenant_id: tenantId,
        api_base_url: effectiveApiUrl,
      });
      // Clear credential fields after successful save for security
      setClientId('');
      setClientSecret('');
      setShowSecret(false);
      setIsEditingCredentials(false);
      setConnectionStatus('success');
      toast.success('CartonCloud settings saved successfully');
    } catch (error) {
      console.error('Save settings error:', error);
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(message);
    }
  };

  const handleStartEditing = () => {
    setIsEditingCredentials(true);
    setClientId('');
    setClientSecret('');
  };

  const handleCancelEditing = () => {
    setIsEditingCredentials(false);
    setClientId('');
    setClientSecret('');
    // Reset API URL to saved value
    if (settings) {
      const savedUrl = settings.api_base_url || DEFAULT_API_BASE_URL;
      if (isStandardEndpoint(savedUrl)) {
        setApiBaseUrl(savedUrl);
        setIsCustomUrl(false);
        setCustomApiUrl('');
      } else {
        setApiBaseUrl(CUSTOM_OPTION_VALUE);
        setIsCustomUrl(true);
        setCustomApiUrl(savedUrl);
      }
    }
  };

  const handleDisconnect = async () => {
    if (!settings?.id) return;

    try {
      await deleteSettings.mutateAsync(settings.id);
      setClientId('');
      setClientSecret('');
      setTenantId('');
      setApiBaseUrl(DEFAULT_API_BASE_URL);
      setCustomApiUrl('');
      setIsCustomUrl(false);
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

  // Get the display value for the current API endpoint
  const getApiEndpointDisplayValue = () => {
    if (isCustomUrl) {
      return customApiUrl || 'Custom URL';
    }
    const endpoint = CARTONCLOUD_API_ENDPOINTS.find(ep => ep.value === apiBaseUrl);
    return endpoint?.label || apiBaseUrl;
  };

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

      {settings && (settings.cartoncloud_tenant_name || settings.cartoncloud_tenant_slug) && (
        <div className="p-3 bg-accent/5 border border-accent/20 rounded-md text-sm">
          <div className="font-medium text-foreground">
            {settings.cartoncloud_tenant_name ?? 'CartonCloud workspace'}
          </div>
          {settings.cartoncloud_tenant_slug && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Slug: <code className="font-mono">{settings.cartoncloud_tenant_slug}</code> · used for "View in CartonCloud" links on bookings
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {hasCredentialsSaved && !isEditingCredentials ? (
          <>
            {/* Show masked credentials when connected and not editing */}
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={MASKED_VALUE}
                disabled
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={MASKED_VALUE}
                disabled
                className="bg-muted/50"
              />
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

            <div className="space-y-2">
              <Label htmlFor="apiEndpoint">API Endpoint</Label>
              <Input
                id="apiEndpoint"
                value={getApiEndpointDisplayValue()}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                The CartonCloud API endpoint for your region
              </p>
            </div>

            <div className="p-3 bg-muted/50 border border-border rounded-md">
              <p className="text-sm text-muted-foreground">
                Credentials are securely stored. Click "Update Credentials" to enter new values.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Show input fields for new credentials */}
            {isEditingCredentials && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm text-primary">
                  Enter your new credentials below. All fields are required to save.
                </p>
              </div>
            )}

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

            <div className="space-y-2">
              <Label htmlFor="apiEndpoint">API Endpoint</Label>
              <Select value={apiBaseUrl} onValueChange={handleApiEndpointChange}>
                <SelectTrigger id="apiEndpoint">
                  <SelectValue placeholder="Select API endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {CARTONCLOUD_API_ENDPOINTS.map((endpoint) => (
                    <SelectItem key={endpoint.value} value={endpoint.value}>
                      {endpoint.label}
                    </SelectItem>
                  ))}
                  {isSuperUser && (
                    <SelectItem value={CUSTOM_OPTION_VALUE}>
                      Custom (Super User only)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the CartonCloud API endpoint for your region. Most tenants use the default endpoint.
              </p>
            </div>

            {isCustomUrl && isSuperUser && (
              <div className="space-y-2">
                <Label htmlFor="customApiUrl">Custom API URL</Label>
                <Input
                  id="customApiUrl"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="https://api.custom.cartoncloud.com"
                />
                <p className="text-xs text-muted-foreground text-amber-600">
                  ⚠️ Custom URLs are for special cases only. Ensure the URL is correct before saving.
                </p>
              </div>
            )}
          </>
        )}

        {connectionStatus === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive">Connection failed. Please check your credentials.</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          {hasCredentialsSaved && !isEditingCredentials ? (
            <>
              {/* Actions when viewing saved credentials */}
              <Button
                onClick={handleTestConnection}
                variant="outline"
                disabled={testSavedConnection.isPending}
              >
                {testSavedConnection.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test Connection
              </Button>

              <Button
                onClick={handleStartEditing}
                variant="secondary"
              >
                Update Credentials
              </Button>

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
            </>
          ) : (
            <>
              {/* Actions when editing or adding new credentials */}
              <Button
                onClick={handleTestConnection}
                variant="outline"
                disabled={
                  testConnection.isPending || 
                  !clientId || !clientSecret || !tenantId ||
                  (isCustomUrl && !customApiUrl)
                }
              >
                {testConnection.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Test Connection
              </Button>

              <Button
                onClick={handleSave}
                disabled={
                  saveSettings.isPending || 
                  !clientId || !clientSecret || !tenantId ||
                  (isCustomUrl && !customApiUrl)
                }
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {saveSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Settings
              </Button>

              {isEditingCredentials && (
                <Button
                  onClick={handleCancelEditing}
                  variant="ghost"
                >
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
