import { useState, useEffect, useMemo } from 'react';
import { Building2, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useOrganisationSettings,
  WorkingHours,
  getDayName,
  COMMON_TIMEZONES,
} from '@/hooks/useOrganisationSettings';

const OrganisationSettings = () => {
  const {
    timezone,
    workingHours,
    isLoading,
    updateTimezone,
    updateWorkingHours,
    initializeWorkingHours,
    isUpdating,
  } = useOrganisationSettings();

  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [localWorkingHours, setLocalWorkingHours] = useState<WorkingHours[]>(() => {
    // Always start with defaults
    return [
      { tenant_id: '', day_of_week: 0, enabled: false, start_time: '08:00', end_time: '17:00' },
      { tenant_id: '', day_of_week: 1, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: '', day_of_week: 2, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: '', day_of_week: 3, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: '', day_of_week: 4, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: '', day_of_week: 5, enabled: true, start_time: '08:00', end_time: '17:00' },
      { tenant_id: '', day_of_week: 6, enabled: false, start_time: '08:00', end_time: '17:00' },
    ];
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize local state when data loads
  useEffect(() => {
    setSelectedTimezone(timezone);
  }, [timezone]);

  // Sync working hours from database when they load
  useEffect(() => {
    if (workingHours.length > 0 && !initialized) {
      setLocalWorkingHours(workingHours);
      setInitialized(true);
    }
  }, [workingHours, initialized]);

  // Track changes
  useEffect(() => {
    const timezoneChanged = selectedTimezone !== timezone;
    const hoursChanged = JSON.stringify(localWorkingHours) !== JSON.stringify(workingHours);
    setHasChanges(timezoneChanged || hoursChanged);
  }, [selectedTimezone, timezone, localWorkingHours, workingHours]);

  const handleTimezoneChange = (tz: string) => {
    setSelectedTimezone(tz);
  };

  const handleDayToggle = (dayOfWeek: number, enabled: boolean) => {
    console.log('[OrganisationSettings] toggle day', { dayOfWeek, enabled });
    setLocalWorkingHours((prev) =>
      prev.map((h) => (h.day_of_week === dayOfWeek ? { ...h, enabled } : h))
    );
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => {
    console.log('[OrganisationSettings] change time', { dayOfWeek, field, value });
    setLocalWorkingHours((prev) =>
      prev.map((h) => (h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h))
    );
  };

  const handleSave = async () => {
    if (selectedTimezone !== timezone) {
      updateTimezone(selectedTimezone);
    }
    if (JSON.stringify(localWorkingHours) !== JSON.stringify(workingHours)) {
      updateWorkingHours(localWorkingHours);
    }
  };

  const handleReset = () => {
    setSelectedTimezone(timezone);
    setLocalWorkingHours(workingHours.length > 0 ? workingHours : localWorkingHours);
    setHasChanges(false);
  };

  const sortedWorkingHours = useMemo(() => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return [...localWorkingHours].sort(
      (a, b) => order.indexOf(a.day_of_week) - order.indexOf(b.day_of_week)
    );
  }, [localWorkingHours]);

  // Get browser timezone for suggestion
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-semibold text-foreground">Organisation Settings</h2>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-accent" />
        <h2 className="text-xl font-semibold text-foreground">Organisation Settings</h2>
      </div>

      {/* Timezone Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">Timezone</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Set the default timezone for your organisation. This affects how times are displayed and booking availability.
        </p>
        <div className="flex items-center gap-4 max-w-md">
          <div className="flex-1">
            <Label htmlFor="timezone" className="sr-only">Timezone</Label>
            <Select value={selectedTimezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                    {tz === browserTimezone && ' (Browser)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {browserTimezone && selectedTimezone !== browserTimezone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTimezoneChange(browserTimezone)}
            >
              Use browser timezone
            </Button>
          )}
        </div>
      </div>

      {/* Working Hours Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">Working Hours</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure your organisation's working days and hours. Non-working times will be shown differently on the calendar.
        </p>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Day</TableHead>
                <TableHead className="w-[100px]">Enabled</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWorkingHours.map((day) => (
                <TableRow key={day.day_of_week}>
                  <TableCell className="font-medium">{getDayName(day.day_of_week)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={!!day.enabled}
                      onCheckedChange={(checked) => handleDayToggle(day.day_of_week, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={day.start_time}
                      onChange={(e) => handleTimeChange(day.day_of_week, 'start_time', e.target.value)}
                      disabled={!day.enabled}
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={day.end_time}
                      onChange={(e) => handleTimeChange(day.day_of_week, 'end_time', e.target.value)}
                      disabled={!day.enabled}
                      className="w-32"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Save/Reset buttons */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isUpdating}
        >
          {isUpdating ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges || isUpdating}
        >
          Reset
        </Button>
        {hasChanges && (
          <span className="text-sm text-muted-foreground">
            You have unsaved changes
          </span>
        )}
      </div>
    </div>
  );
};

export default OrganisationSettings;
