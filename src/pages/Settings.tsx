import { Header } from '@/components/Header';
import { DockConfiguration } from '@/components/settings/DockConfiguration';
import { CartonCloudIntegration } from '@/components/settings/CartonCloudIntegration';
import { CardConfiguration } from '@/components/settings/CardConfiguration';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DoorOpen, Link2, Users, Clock, LayoutGrid } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'docks';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your CrossDock platform configuration.</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="docks" className="gap-2">
              <DoorOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Docks</span>
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </TabsTrigger>
            <TabsTrigger value="integration" className="gap-2">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Integration</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="defaults" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Defaults</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="docks">
            <Card>
              <CardContent className="pt-6">
                <DockConfiguration />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cards">
            <Card>
              <CardContent className="pt-6">
                <CardConfiguration />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integration">
            <Card>
              <CardContent className="pt-6">
                <CartonCloudIntegration />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-accent" />
                  <h2 className="text-xl font-semibold text-foreground">User & Role Management</h2>
                </div>
                <p className="text-muted-foreground">
                  Manage user accounts and assign roles for access control.
                </p>
                <div className="mt-6 p-8 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground">
                  Coming soon in a future update.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-accent" />
                  <h2 className="text-xl font-semibold text-foreground">Booking Defaults</h2>
                </div>
                <p className="text-muted-foreground">
                  Set default values for time increments, duration, and buffer times.
                </p>
                <div className="mt-6 p-8 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground">
                  Coming soon in a future update.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
