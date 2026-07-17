import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Camera, Lightbulb, Monitor, Package, MapPin } from "lucide-react";
import { Link } from "wouter";
import {
  DASHBOARD_WIDGET_CARD_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
} from "@/components/dashboard/dashboard-styles";

interface EquipmentStatusProps {
  equipment?: any[];
}

export default function EquipmentStatus({ equipment }: EquipmentStatusProps) {
  const equipmentInUse = equipment?.filter(item => item.status === "in-use") || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "microphone": return <Mic className="h-3 w-3" />;
      case "camera": return <Camera className="h-3 w-3" />;
      case "lighting": return <Lightbulb className="h-3 w-3" />;
      case "computer": return <Monitor className="h-3 w-3" />;
      default: return <Package className="h-3 w-3" />;
    }
  };

  return (
    <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
      <CardHeader className="py-2.5 px-3 sm:px-4 pb-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Package className="w-3.5 h-3.5" />
            Техника
          </CardTitle>
          <Link href="/equipment">
            <Badge variant="outline" className="cursor-pointer px-1.5 py-0 text-[10px] text-muted-foreground hover:bg-muted">
              Все →
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 pt-0">
        {equipmentInUse.length === 0 ? (
          <div className="text-center py-3">
            <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-success-muted">
              <Package className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-xs text-muted-foreground">Вся техника доступна</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {equipmentInUse.slice(0, 4).map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-1.5 ${DASHBOARD_WIDGET_ROW_CLASS}`}
                data-testid={`equipment-${item.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-warning-muted text-warning">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                    {item.location && (
                      <p className="flex items-center gap-0.5 truncate text-[10px] text-muted-foreground">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {item.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
              </div>
            ))}
            {equipmentInUse.length > 4 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                +{equipmentInUse.length - 4} ещё
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
