import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CustomBookingField } from '@/hooks/useCustomBookingFields';
import { CustomFieldValues } from '@/types/booking';

interface CustomFieldsRendererProps {
  fields: CustomBookingField[];
  values: CustomFieldValues;
  onChange: (values: CustomFieldValues) => void;
}

export function CustomFieldsRenderer({ fields, values, onChange }: CustomFieldsRendererProps) {
  const updateValue = (fieldId: string, value: string | string[] | Date | null) => {
    onChange({ ...values, [fieldId]: value });
  };

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="text-sm font-medium text-muted-foreground">Custom Fields</div>
      
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.id}>
            {field.label}
            {field.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          
          {field.field_type === 'text' && (
            <Input
              id={field.id}
              value={(values[field.id] as string) || ''}
              onChange={(e) => updateValue(field.id, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          )}
          
          {field.field_type === 'dropdown' && (
            <Select
              value={(values[field.id] as string) || ''}
              onValueChange={(v) => updateValue(field.id, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {field.field_type === 'multiselect' && (
            <MultiSelectField
              field={field}
              value={(values[field.id] as string[]) || []}
              onChange={(v) => updateValue(field.id, v)}
            />
          )}
          
          {field.field_type === 'date' && (
            <DatePickerField
              field={field}
              value={values[field.id] as Date | string | null}
              onChange={(v) => updateValue(field.id, v)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface MultiSelectFieldProps {
  field: CustomBookingField;
  value: string[];
  onChange: (value: string[]) => void;
}

function MultiSelectField({ field, value, onChange }: MultiSelectFieldProps) {
  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border border-input rounded-md bg-background">
        {value.length === 0 ? (
          <span className="text-muted-foreground text-sm">Select options...</span>
        ) : (
          value.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleOption(v)}
            >
              {v}
              <span className="ml-1 text-muted-foreground hover:text-foreground">×</span>
            </Badge>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {field.options.filter(o => !value.includes(o)).map((option) => (
          <Button
            key={option}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toggleOption(option)}
            className="text-xs"
          >
            + {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface DatePickerFieldProps {
  field: CustomBookingField;
  value: Date | string | null;
  onChange: (value: Date | null) => void;
}

function DatePickerField({ field, value, onChange }: DatePickerFieldProps) {
  const dateValue = value instanceof Date 
    ? value 
    : typeof value === 'string' && value 
      ? parseISO(value) 
      : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, 'PPP') : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => onChange(d || null)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
