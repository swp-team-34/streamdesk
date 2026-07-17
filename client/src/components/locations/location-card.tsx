import { AlertTriangle, Building2, MapPin, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Location } from "@/lib/location-model";
import {
  RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUS_LABELS,
  RECORDING_PLACE_STATUS_TONES,
  type RecordingPlaceStatus,
} from "@/lib/recording-place-status";
import { cn } from "@/lib/utils";

interface LocationCardProps {
  location: Location;
  issueCount: number;
  canManage: boolean;
  onOpen: () => void;
  onStatusChange: (status: RecordingPlaceStatus) => void;
}

export function LocationCard({
  location,
  issueCount,
  canManage,
  onOpen,
  onStatusChange,
}: LocationCardProps) {
  const status = location.status || "available";

  return (
    <Card
      className={cn(
        "cursor-pointer border-border/50 bg-surface-raised shadow-xs transition hover:border-primary/40 hover:bg-surface-overlay",
        issueCount > 0 && "border-warning/40",
        location.archivedAt && "border-dashed opacity-80",
      )}
      onClick={onOpen}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{location.name}</span>
          </CardTitle>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className={RECORDING_PLACE_STATUS_TONES[status]}>
              {RECORDING_PLACE_STATUS_LABELS[status]}
            </Badge>
            {location.archivedAt && <Badge variant="secondary">Архив</Badge>}
          </div>
        </div>
        {location.type && <p className="text-xs text-muted-foreground">{location.type}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {location.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="line-clamp-2">{location.address}</span>
          </div>
        )}
        {location.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{location.description}</p>
        )}
        {issueCount > 0 && (
          <div className="flex items-center gap-2 rounded-control bg-warning-muted px-2 py-1.5 text-sm text-warning">
            <AlertTriangle className="h-4 w-4" />
            Активные проблемы: {issueCount}
          </div>
        )}
        {Array.isArray(location.attachments) && location.attachments.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            Файлы: {location.attachments.length}
          </div>
        )}
        {canManage && !location.archivedAt && (
          <div onClick={(event) => event.stopPropagation()}>
            <Select value={status} onValueChange={(value) => onStatusChange(value as RecordingPlaceStatus)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORDING_PLACE_STATUSES.map((next) => (
                  <SelectItem key={next} value={next}>{RECORDING_PLACE_STATUS_LABELS[next]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
