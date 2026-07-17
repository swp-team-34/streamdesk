import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Wifi, WifiOff } from "lucide-react";
import {
  DASHBOARD_WIDGET_CARD_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
} from "@/components/dashboard/dashboard-styles";

interface SystemStatusProps {
  systems?: any[];
}

export default function SystemStatus({ systems }: SystemStatusProps) {
  const onlineCount = systems?.filter(s => s.status === 'online').length || 0;
  const totalCount = systems?.length || 0;

  return (
    <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
      <CardHeader className="py-2.5 px-3 sm:px-4 pb-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Server className="w-3.5 h-3.5" />
            Серверы
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">
            {onlineCount}/{totalCount} онл.
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 pt-0">
        <div className="space-y-1.5">
          {systems?.slice(0, 5).map((system) => (
            <div 
              key={system.id} 
              className={`flex items-center justify-between p-1.5 ${DASHBOARD_WIDGET_ROW_CLASS}`}
              data-testid={`system-${system.id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`
                  w-6 h-6 shrink-0 rounded flex items-center justify-center
                  ${system.status === 'online' 
                    ? 'bg-success-muted'
                    : 'bg-error-muted'
                  }
                `}>
                  {system.status === 'online' 
                    ? <Wifi className="h-3 w-3 text-success" />
                    : <WifiOff className="h-3 w-3 text-error" />
                  }
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">{system.name}</span>
                  {system.ipAddress && (
                    <p className="truncate text-[10px] text-muted-foreground">{system.ipAddress}</p>
                  )}
                </div>
              </div>
              <div className={`
                px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0
                ${system.status === 'online' 
                  ? 'bg-success-muted text-success'
                  : 'bg-error-muted text-error'
                }
              `}>
                {system.status === 'online' ? 'Online' : 'Offline'}
              </div>
            </div>
          ))}
          {(!systems || systems.length === 0) && (
            <div className="py-3 text-center text-muted-foreground">
              <Server className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">Нет данных о серверах</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
