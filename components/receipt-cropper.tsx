"use client";

import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crop as CropIcon, Check, X, RotateCcw, RotateCw } from "lucide-react";

interface ReceiptCropperProps {
  imageSrc: string;
  open: boolean;
  onConfirm: (croppedBlob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

function getDefaultCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, width / height, width, height),
    width,
    height
  );
}

async function cropToBlob(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  rotation: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const cropX = pixelCrop.x * scaleX;
  const cropY = pixelCrop.y * scaleY;
  const cropW = pixelCrop.width * scaleX;
  const cropH = pixelCrop.height * scaleY;

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  canvas.width = Math.round(cropW * cos + cropH * sin);
  canvas.height = Math.round(cropW * sin + cropH * cos);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(image, cropX, cropY, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Chyba při zpracování"))),
      "image/jpeg",
      0.92
    );
  });
}

export function ReceiptCropper({ imageSrc, open, onConfirm, onCancel }: ReceiptCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(getDefaultCrop(width, height));
  }, []);

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return;
    setIsProcessing(true);
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop, rotation);
      const previewUrl = URL.createObjectURL(blob);
      console.log("Účtenka ořezána, velikost:", blob.size);
      onConfirm(blob, previewUrl);
    } catch (err) {
      console.log("Chyba při ořezávání:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const rotate = (deg: number) => setRotation((r) => (r + deg + 360) % 360);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="w-4 h-4" />
            Oříznout účtenku
          </DialogTitle>
        </DialogHeader>

        {/* Plocha pro ořez */}
        <div className="w-full bg-black overflow-auto flex items-center justify-center" style={{ maxHeight: 420, minHeight: 260 }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            minWidth={20}
            minHeight={20}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Účtenka"
              onLoad={onImageLoad}
              style={{
                maxWidth: "100%",
                maxHeight: 420,
                transform: `rotate(${rotation}deg)`,
                transition: "transform 0.2s",
                display: "block",
              }}
            />
          </ReactCrop>
        </div>

        {/* Ovládání */}
        <div className="p-4 space-y-3 bg-background">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">Otočit:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => rotate(-90)}
              className="gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              −90°
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => rotate(90)}
              className="gap-1"
            >
              <RotateCw className="w-4 h-4" />
              +90°
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Táhněte za rohové nebo boční úchyty pro přesný ořez
          </p>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isProcessing}>
              <X className="w-4 h-4 mr-1" />
              Zrušit
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={isProcessing || !completedCrop}>
              {isProcessing ? (
                "Zpracovávám…"
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Potvrdit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
