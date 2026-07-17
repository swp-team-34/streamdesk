import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer, ScanBarcode, RefreshCw } from "lucide-react";
import {
  buildBarcodeLabelBitmapPayload,
  downloadBarcodeLabelPng,
  openBarcodePrintWindow,
  renderCompactBarcodeLabel,
  sanitizeBarcodeFilePart,
} from "@/lib/barcode-label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Equipment } from "@shared/schema";

interface BarcodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
}

export function BarcodeGenerator({ isOpen, onClose, equipment, onBarcodeGenerated }: BarcodeGeneratorProps & { onBarcodeGenerated?: (barcode: string) => void }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [barcodeFormat, setBarcodeFormat] = useState("CODE128");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [equipmentInfo, setEquipmentInfo] = useState<Equipment | null>(null);

  useEffect(() => {
    if (isOpen && equipment) {
      setEquipmentInfo(equipment);
      const value = equipment.inventoryNumber || equipment.barcode || equipment.serialNumber || equipment.id.slice(0, 12).toUpperCase();
      setBarcodeValue(value);
    } else if (!isOpen) {
      setEquipmentInfo(null);
    }
  }, [isOpen, equipment]);

  useEffect(() => {
    if (!isOpen || !barcodeRef.current || !barcodeValue) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!barcodeRef.current) return;
      try {
        renderCompactBarcodeLabel(barcodeRef.current, barcodeValue, { format: barcodeFormat });
      } catch (error) {
        console.error("Error generating barcode:", error);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, barcodeValue, barcodeFormat]);

  const handleDownload = () => {
    if (!barcodeRef.current) return;
    downloadBarcodeLabelPng(barcodeRef.current, `barcode-${sanitizeBarcodeFilePart(barcodeValue)}.png`);
  };

  const handlePrint = () => {
    if (!barcodeRef.current) return;
    openBarcodePrintWindow({
      svg: barcodeRef.current,
      name: equipmentInfo?.name,
      model: equipmentInfo?.model || "",
    });
  };

  const generateRandomBarcode = () => {
    const prefix = "EQ";
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    const newValue = `${prefix}${randomNum}`;
    setBarcodeValue(newValue);
    if (onBarcodeGenerated) {
      onBarcodeGenerated(newValue);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[430px] bg-surface-overlay">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ScanBarcode className="w-5 h-5" />
            Генератор штрих-кода
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Создайте и сохраните штрих-код для оборудования
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {equipmentInfo && (
            <div className="rounded-control border border-border/40 bg-surface-subtle p-3">
              <div className="font-medium text-foreground">{equipmentInfo.name}</div>
              {equipmentInfo.model && (
                <div className="text-sm text-muted-foreground">{equipmentInfo.model}</div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="barcode-value">
              Значение штрих-кода
            </Label>
            <div className="flex gap-2">
              <Input
                id="barcode-value"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value.toUpperCase())}
                placeholder="Введите или сгенерируйте"
                className="border-border/50 bg-surface-raised font-mono"
                data-testid="input-barcode-value"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={generateRandomBarcode}
                title="Сгенерировать новый"
                data-testid="button-generate-barcode"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Формат</Label>
            <Select value={barcodeFormat} onValueChange={setBarcodeFormat}>
              <SelectTrigger className="border-border/50 bg-surface-raised">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
                <SelectItem value="EAN8">EAN-8</SelectItem>
                <SelectItem value="CODE39">Code 39</SelectItem>
                <SelectItem value="ITF14">ITF-14</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {barcodeValue && (
            <div className="flex justify-center overflow-hidden rounded-control border border-border/50 bg-white p-3">
              <svg ref={barcodeRef} data-testid="barcode-preview" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline"
              onClick={handleDownload}
              disabled={!barcodeValue}
              className="w-full"
              data-testid="button-download-barcode"
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать
            </Button>
            <Button 
              onClick={handlePrint}
              disabled={!barcodeValue}
              className="w-full"
              data-testid="button-print-barcode"
            >
              <Printer className="w-4 h-4 mr-2" />
              Печать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EquipmentBarcodeModal({ 
  isOpen, 
  onClose, 
  equipment 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  equipment: Equipment | null;
}) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && equipment) {
      const value = equipment.inventoryNumber || equipment.barcode || equipment.serialNumber || `EQ${equipment.id.slice(0, 10).toUpperCase()}`;
      setBarcodeValue(value);
    } else if (!isOpen) {
      setBarcodeValue("");
    }
  }, [isOpen, equipment]);

  useEffect(() => {
    if (!isOpen || !barcodeRef.current || !barcodeValue) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!barcodeRef.current) return;
      try {
        renderCompactBarcodeLabel(barcodeRef.current, barcodeValue);
      } catch (error) {
        console.error("Error generating barcode:", error);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, barcodeValue]);

  const handleDownload = () => {
    if (!barcodeRef.current) return;
    downloadBarcodeLabelPng(
      barcodeRef.current,
      `barcode-${sanitizeBarcodeFilePart(equipment?.name || barcodeValue)}.png`,
    );
  };

  const handlePrint = async () => {
    if (!barcodeRef.current) return;
    setIsPrinting(true);
    try {
      const label = await buildBarcodeLabelBitmapPayload(barcodeRef.current, barcodeValue);
      const response = await apiRequest("POST", "/api/equipment/labels/print-bitmaps", {
        labels: [label],
      });
      const data = await response.json();
      toast({
        title: "Этикетка отправлена",
        description: `Принтер: ${data?.printer || "TSC"}.`,
      });
    } catch (error: any) {
      toast({
        title: "Ошибка печати",
        description: error?.message || "Не удалось отправить PNG-этикетку на принтер",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!equipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[430px] bg-surface-overlay">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ScanBarcode className="w-5 h-5" />
            Штрих-код оборудования
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {equipment.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-control border border-border/40 bg-surface-subtle p-3 text-center">
            <div className="truncate text-base font-semibold text-foreground sm:text-lg">{equipment.name}</div>
            {equipment.model && (
              <div className="truncate text-sm text-muted-foreground">{equipment.model}</div>
            )}
            {equipment.serialNumber && (
              <div className="mt-1 text-xs text-muted-foreground">
                S/N: {equipment.serialNumber}
              </div>
            )}
          </div>

          <div className="flex justify-center overflow-hidden rounded-control border border-border/50 bg-white p-3">
            <svg ref={barcodeRef} data-testid="equipment-barcode" />
          </div>

          <div className="break-all text-center font-mono text-xs text-muted-foreground">
            {barcodeValue}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline"
              onClick={handleDownload}
              className="w-full"
              data-testid="button-download-equipment-barcode"
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать PNG
            </Button>
            <Button 
              onClick={handlePrint}
              disabled={isPrinting}
              className="w-full"
              data-testid="button-print-equipment-barcode"
            >
              <Printer className="w-4 h-4 mr-2" />
              Печать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
