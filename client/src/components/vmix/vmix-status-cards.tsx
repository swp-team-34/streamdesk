import { Film, Monitor, Play, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { VmixConnection } from "@/lib/vmix-scheduler-model";
import { cn } from "@/lib/utils";

export function VmixStatusCards({ connection }: { connection: VmixConnection }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Preview</p>
              <p className="text-lg font-bold">{connection.preview || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Program</p>
              <p className="text-lg font-bold">{connection.program || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className={cn("border-l-4", connection.recording ? "border-l-red-500" : "border-l-slate-300")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Film className={cn("h-5 w-5", connection.recording ? "text-red-500" : "text-slate-400")} />
            <div>
              <p className="text-xs text-muted-foreground">Запись</p>
              <p className={cn("text-lg font-bold", connection.recording ? "text-red-500" : "text-muted-foreground")}>
                {connection.recording ? "ON" : "OFF"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className={cn("border-l-4", connection.streaming ? "border-l-purple-500" : "border-l-slate-300")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Video className={cn("h-5 w-5", connection.streaming ? "text-purple-500" : "text-slate-400")} />
            <div>
              <p className="text-xs text-muted-foreground">Стрим</p>
              <p className={cn("text-lg font-bold", connection.streaming ? "text-purple-500" : "text-muted-foreground")}>
                {connection.streaming ? "ON" : "OFF"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
