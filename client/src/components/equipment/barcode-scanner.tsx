import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Package, MapPin, AlertCircle, CheckCircle, ArrowRight, ArrowLeft, RefreshCw, Edit } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { canEditEquipment, canReserveEquipment } from "@/lib/equipment-permissions";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment } from "@shared/schema";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onEquipmentFound?: (equipment: Equipment) => void;
  onBarcodeScanned?: (barcode: string) => void;
  companyManager?: boolean;
  canRequestCheckout?: boolean;
}

type PermissionState = "prompt" | "granted" | "denied" | "checking";

function getCurrentUser() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('streamstudio_user') || '{}');
  } catch {
    return {};
  }
}

export function BarcodeScanner({
  isOpen,
  onClose,
  onEquipmentFound,
  onBarcodeScanned,
  companyManager = false,
  canRequestCheckout = false,
}: BarcodeScannerProps) {
  const [permissionState, setPermissionState] = useState<PermissionState>("prompt");
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const permissionCleanupRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<any>({});
  
  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const canEdit = canEditEquipment(currentUser) || companyManager;
  const canReserve = canReserveEquipment(currentUser) || companyManager;

  const { data: equipment, isLoading, isError } = useQuery<Equipment>({
    queryKey: ["/api/equipment/barcode", scannedCode],
    queryFn: async () => {
      if (!scannedCode) throw new Error("barcode is empty");
      const response = await fetch(apiUrl(`/api/equipment/barcode/${encodeURIComponent(scannedCode)}`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Equipment not found with this barcode");
      return response.json();
    },
    enabled: !!scannedCode,
  });

  const { data: users = [] } = useQuery<Array<{ id: string; name?: string | null; username?: string | null }>>({
    queryKey: ["/api/users"],
  });

  const getAssignedUserName = (assignedTo: string | null | undefined) => {
    const normalized = String(assignedTo ?? "").trim();
    if (!normalized) return "";

    const matchedUser = users.find((user) => {
      const candidates = [user.id, user.name, user.username]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
      return candidates.includes(normalized);
    });

    return matchedUser?.name?.trim() || matchedUser?.username?.trim() || normalized;
  };

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Equipment> }) => {
      const response = await apiRequest("PUT", `/api/equipment/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/barcode", scannedCode] });
      toast({ title: "Успешно", description: "Статус оборудования обновлён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить статус", variant: "destructive" });
    },
  });

  const checkCameraPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      setError("Ваш браузер не поддерживает доступ к камере");
      setPermissionState("denied");
      return;
    }

    try {
      if (permissionCleanupRef.current) {
        permissionCleanupRef.current();
        permissionCleanupRef.current = null;
      }

      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          
          if (permissionStatus.state === 'granted') {
            setPermissionState("granted");
            return;
          } else if (permissionStatus.state === 'denied') {
            setPermissionState("denied");
            setError("Доступ к камере запрещён. Разрешите доступ в настройках браузера.");
            return;
          }
          
          const handleChange = () => {
            if (permissionStatus.state === 'granted') {
              setPermissionState("granted");
              setError(null);
            } else if (permissionStatus.state === 'denied') {
              setPermissionState("denied");
              setError("Доступ к камере запрещён. Разрешите доступ в настройках браузера.");
            }
          };
          
          permissionStatus.addEventListener('change', handleChange);
          permissionCleanupRef.current = () => {
            permissionStatus.removeEventListener('change', handleChange);
          };
          
          setPermissionState("prompt");
        } catch (e) {
          setPermissionState("prompt");
        }
      } else {
        setPermissionState("prompt");
      }
    } catch (err) {
      setPermissionState("prompt");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkCameraPermission();
    }
    return () => {
      stopScanning();
      if (permissionCleanupRef.current) {
        permissionCleanupRef.current();
        permissionCleanupRef.current = null;
      }
    };
  }, [isOpen, checkCameraPermission]);

  useEffect(() => {
    if (isOpen && permissionState === "granted" && !scanning && !scannedCode && !error) {
      startScanning();
    }
  }, [isOpen, permissionState, scanning, scannedCode, error]);

  const requestCameraPermission = async () => {
    try {
      setError(null);
      setPermissionState("checking");
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState("granted");
    } catch (err: any) {
      console.error("Permission request error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState("denied");
        setError("Доступ к камере запрещён. Разрешите доступ в настройках браузера.");
      } else if (err.name === 'NotFoundError') {
        setPermissionState("denied");
        setError("Камера не найдена на устройстве.");
      } else {
        setError("Не удалось получить доступ к камере: " + err.message);
        setPermissionState("prompt");
      }
    }
  };

  const startScanning = async () => {
    try {
      setError(null);
      setScannedCode(null);
      
      if (!containerRef.current) return;
      
      const html5QrCode = new Html5Qrcode("barcode-reader");
      scannerRef.current = html5QrCode;
      
      const videoConstraints: MediaTrackConstraints = {
        facingMode: "environment",
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      };
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.777778,
          disableFlip: false,
          videoConstraints,
        },
        (decodedText) => {
          setScannedCode(decodedText);
          stopScanning();
        },
        () => {}
      );
      
      setScanning(true);
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      if (err.name === 'NotAllowedError') {
        setPermissionState("denied");
        setError("Доступ к камере запрещён. Разрешите доступ в настройках браузера.");
      } else {
        setError("Не удалось запустить сканер: " + (err.message || "Неизвестная ошибка"));
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    setScannedCode(null);
    setError(null);
    setPermissionState("prompt");
    onClose();
  };

  const handleRescan = () => {
    setScannedCode(null);
    setError(null);
    if (permissionState === "granted") {
      startScanning();
    } else {
      requestCameraPermission();
    }
  };

  const handleTakeEquipment = () => {
    if (equipment) {
      updateEquipmentMutation.mutate({
        id: equipment.id,
        data: { 
          status: "in-use",
          assignedTo: currentUser.id || currentUser.name,
        }
      });
    }
  };

  const handleReturnEquipment = () => {
    if (equipment) {
      updateEquipmentMutation.mutate({
        id: equipment.id,
        data: { 
          status: "available",
          assignedTo: null,
        }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "border-success/25 bg-success-muted text-success";
      case "in-use": return "border-info/25 bg-info-muted text-info";
      case "maintenance": return "border-warning/25 bg-warning-muted text-warning";
      case "broken": return "border-error/25 bg-error-muted text-error";
      default: return "border-border/40 bg-surface-subtle text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "Доступно";
      case "in-use": return "Используется";
      case "maintenance": return "Обслуживание";
      case "broken": return "Сломано";
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md overflow-hidden bg-surface-overlay p-0">
        <DialogHeader className="border-b border-border/50 p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Camera className="w-5 h-5" />
            Сканер штрих-кода
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Наведите камеру на штрих-код оборудования
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4">
          {/* Permission Request State */}
          {(permissionState === "prompt" || permissionState === "checking") && !scannedCode && !error && (
            <div className="text-center py-8 space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-foreground">
                  Разрешите доступ к камере
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Для сканирования штрих-кодов требуется доступ к камере вашего устройства
                </p>
              </div>
              <Button 
                onClick={requestCameraPermission}
                className="w-full"
                disabled={permissionState === "checking"}
                data-testid="button-request-camera"
              >
                {permissionState === "checking" ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                {permissionState === "checking" ? "Проверка..." : "Разрешить камеру"}
              </Button>
            </div>
          )}

          {/* Permission Denied State */}
          {permissionState === "denied" && !scannedCode && (
            <div className="text-center py-8 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-error-muted">
                <AlertCircle className="h-10 w-10 text-error" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-foreground">
                  Доступ к камере запрещён
                </h3>
                <p className="text-sm text-muted-foreground">
                  {error || "Разрешите доступ к камере в настройках браузера и попробуйте снова"}
                </p>
              </div>
              <Button 
                variant="outline"
                onClick={requestCameraPermission}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Попробовать снова
              </Button>
            </div>
          )}

          {/* Scanner View */}
          {permissionState === "granted" && !scannedCode && !error && (
            <div className="space-y-4">
              <div 
                id="barcode-reader" 
                ref={containerRef}
                className="barcode-scanner-view w-full overflow-hidden rounded-surface border border-border/60 bg-black [&_img]:object-cover [&_video]:min-h-[280px] [&_video]:object-cover"
                style={{ minHeight: "280px" }}
              />
              {scanning && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
                  Сканирование...
                </div>
              )}
            </div>
          )}

          {/* Error State (non-permission) */}
          {error && permissionState !== "denied" && (
            <div className="text-center py-8">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-error" />
              <p className="mb-4 text-error">{error}</p>
              <Button onClick={handleRescan}>
                Попробовать снова
              </Button>
            </div>
          )}

          {/* Result View */}
          {scannedCode && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-center gap-2 rounded-control border border-success/25 bg-success-muted p-3">
                <CheckCircle className="h-5 w-5 shrink-0 text-success" />
                <span className="break-all font-mono text-sm text-success">{scannedCode}</span>
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {isError && (
                <Card className="border-warning/25 bg-warning-muted">
                  <CardContent className="py-6 text-center">
                    <Package className="mx-auto mb-4 h-12 w-12 text-warning" />
                    <p className="mb-2 font-medium text-warning">
                      Оборудование не найдено
                    </p>
                    <p className="mb-4 text-sm text-warning">
                      Штрих-код не зарегистрирован в системе
                    </p>
                    {onBarcodeScanned && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          onBarcodeScanned(scannedCode!);
                          handleClose();
                        }}
                        className="w-full"
                        data-testid="button-search-barcode"
                      >
                        Искать в инвентаре
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {equipment && (
                <Card className="animate-in border-border/50 bg-surface-raised shadow-surface fade-in slide-in-from-bottom-4 duration-300" data-testid="scanned-equipment-result">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{equipment.name}</h3>
                        <p className="text-sm text-muted-foreground">{equipment.model}</p>
                      </div>
                      <Badge className={getStatusColor(equipment.status)}>
                        {getStatusText(equipment.status)}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      {equipment.serialNumber && (
                        <div className="flex justify-between text-foreground">
                          <span className="text-muted-foreground">Серийный номер:</span>
                          <span className="font-medium">{equipment.serialNumber}</span>
                        </div>
                      )}
                      {equipment.inventoryNumber && (
                        <div className="flex justify-between text-foreground">
                          <span className="text-muted-foreground">Инв. номер:</span>
                          <span className="font-medium">{equipment.inventoryNumber}</span>
                        </div>
                      )}
                      {equipment.location && (
                        <div className="flex items-center gap-1 text-foreground">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Место:</span>
                          <span className="font-medium ml-1">{equipment.location}</span>
                        </div>
                      )}
                      {equipment.assignedTo && (
                        <div className="flex justify-between text-foreground">
                          <span className="text-muted-foreground">Забрал:</span>
                          <span className="font-medium">{getAssignedUserName(equipment.assignedTo)}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {(canReserve || canEdit) && (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/50 pt-4">
                        {canReserve && equipment.status === "available" ? (
                          <Button 
                            className="col-span-2"
                            onClick={handleTakeEquipment}
                            disabled={updateEquipmentMutation.isPending}
                            data-testid="button-take-equipment"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Взять
                          </Button>
                        ) : canReserve && equipment.status === "in-use" ? (
                          <>
                            <Button 
                              variant="outline"
                              onClick={handleReturnEquipment}
                              disabled={updateEquipmentMutation.isPending}
                              data-testid="button-return-equipment"
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" />
                              Вернуть
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                if (onEquipmentFound) {
                                  onEquipmentFound(equipment);
                                  handleClose();
                                }
                              }}
                              data-testid="button-transfer-equipment"
                            >
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Передать
                            </Button>
                          </>
                        ) : null}
                        
                        {canEdit && (
                        <Button 
                          variant="ghost"
                          className="col-span-2 text-muted-foreground"
                          onClick={() => {
                            if (onEquipmentFound) {
                              onEquipmentFound(equipment);
                              handleClose();
                            }
                          }}
                          data-testid="button-edit-equipment"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Редактировать
                        </Button>
                        )}
                      </div>
                    )}

                    {!canReserve && !canEdit && onEquipmentFound && (
                      <div className="mt-4 border-t border-border/50 pt-4">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            onEquipmentFound(equipment);
                            handleClose();
                          }}
                        >
                          {canRequestCheckout && equipment.status === "available" ? "Запросить выдачу" : "Открыть карточку"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleRescan}
                data-testid="button-scan-again"
              >
                <Camera className="w-4 h-4 mr-2" />
                Сканировать ещё
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
