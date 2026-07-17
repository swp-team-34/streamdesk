import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Map, Building2, Layers, Maximize2, RadioTower } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const MAPS_BASE = "https://raw.githubusercontent.com/one-zero-eight/maps/main/static";

const FLOOR_TABS = [
  { id: "floor-1", label: "Этаж 1", src: `${MAPS_BASE}/university-floor-1.svg` },
  { id: "floor-2", label: "Этаж 2", src: `${MAPS_BASE}/university-floor-2.svg` },
  { id: "floor-3", label: "Этаж 3", src: `${MAPS_BASE}/university-floor-3.svg` },
  { id: "floor-4", label: "Этаж 4", src: `${MAPS_BASE}/university-floor-4.svg` },
  { id: "floor-5", label: "Этаж 5", src: `${MAPS_BASE}/university-floor-5.svg` },
  { id: "floor-0", label: "Этаж -1", src: `${MAPS_BASE}/university-floor-0.svg` },
  { id: "sport", label: "Спорткомплекс", src: `${MAPS_BASE}/sport-complex.svg` },
  { id: "campus", label: "Кампус", src: `${MAPS_BASE}/campus.svg` },
];

export default function MapsPage() {
  const [activeFloor, setActiveFloor] = useState(FLOOR_TABS[0].id);
  const [fullscreen, setFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const currentMap = FLOOR_TABS.find((t) => t.id === activeFloor);

  const handleFloorChange = (id: string) => {
    setActiveFloor(id);
    setImgError(false);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-[1920px] space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Карты
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Переключение этажей. Просто смотрим схемы без зума и перемещения.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap gap-1 rounded-control border border-border/50 bg-muted/30 p-1">
          {FLOOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFloorChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                activeFloor === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.id.startsWith("floor") ? (
                <Layers className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Building2 className="h-3.5 w-3.5 shrink-0" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        <Card className={cn(
          "overflow-hidden",
          fullscreen && "fixed inset-4 z-50 rounded-dialog shadow-overlay"
        )}>
          <CardContent className="p-0 relative">
            <div
              className="relative w-full min-h-[280px] sm:min-h-[360px] md:min-h-[420px] bg-muted/10 dark:bg-white/95 overflow-hidden flex items-center justify-center select-none"
            >
              {currentMap ? (
                imgError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-muted/30 text-center">
                    <Map className="h-12 w-12 text-primary/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Карта недоступна (проверьте интернет)</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">{currentMap.label}</p>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center origin-center will-change-transform"
                    style={{
                      minWidth: "100%",
                      minHeight: "100%",
                      width: "max(100%, 800px)",
                      height: "max(100%, 600px)",
                    }}
                  >
                    <object
                      data={currentMap.src}
                      type="image/svg+xml"
                      aria-label={currentMap.label}
                      className="block w-full h-full max-w-none pointer-events-none select-none"
                      style={{ objectFit: "contain", minWidth: "100%", minHeight: "100%" }}
                      onError={() => setImgError(true)}
                    >
                      <img
                        src={currentMap.src}
                        alt={currentMap.label}
                        className="block w-full h-full object-contain pointer-events-none"
                        onError={() => setImgError(true)}
                        draggable={false}
                      />
                    </object>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center">
                  <Map className="h-12 w-12 text-primary/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Выберите этаж или здание</p>
                </div>
              )}
              {currentMap && !imgError && (
                <div className="absolute bottom-2 right-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setFullscreen(!fullscreen)}
                    className="rounded-control border border-border/50 bg-card/90 p-2 shadow-xs transition-colors hover:bg-muted"
                    title={fullscreen ? "Выйти из полноэкранного режима" : "Полный экран"}
                  >
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
