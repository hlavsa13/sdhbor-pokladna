"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function getRecognitionCtor(): (new () => AnyRecognition) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Vrací true, pokud prohlížeč umí rozpoznávání řeči (ověřuje se až v prohlížeči). */
export function useSpeechSupported() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);
  return supported;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zavolá se s rozpoznaným textem po dokončení věty */
  onResult: (text: string) => void;
  /** Probíhá zpracování rozpoznané věty (AI) */
  processing?: boolean;
};

export function VoiceTransactionDialog({ open, onOpenChange, onResult, processing = false }: Props) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<AnyRecognition>(null);
  const finalTextRef = useRef("");

  const stop = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* už zastaveno */
    }
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Tento prohlížeč hlasové zadání nepodporuje.");
      return;
    }
    setError(null);
    setTranscript("");
    finalTextRef.current = "";

    const recognition = new Ctor();
    recognition.lang = "cs-CZ";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: AnyRecognition) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      finalTextRef.current = final;
      setTranscript((final + " " + interim).trim());
    };
    recognition.onerror = (event: AnyRecognition) => {
      console.log("Hlasové zadání – chyba:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Prohlížeč nemá povolený mikrofon. Povolte ho v nastavení stránky.");
      } else if (event.error === "no-speech") {
        setError("Nic jsem neslyšel. Zkuste to znovu.");
      } else {
        setError("Rozpoznání se nepovedlo. Zkuste to znovu.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      const text = finalTextRef.current.trim();
      if (text) onResult(text);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.log("Hlasové zadání – start selhal:", e);
      setError("Mikrofon se nepodařilo spustit.");
    }
  };

  // Po otevření rovnou začít poslouchat, po zavření zastavit
  useEffect(() => {
    if (open) start();
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hlasové zadání</DialogTitle>
          <DialogDescription>
            Např. „příjem dva tisíce pronájem hasičárny hotově“
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <button
            type="button"
            onClick={() => (listening ? stop() : start())}
            disabled={processing}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-colors",
              listening
                ? "bg-primary text-primary-foreground animate-pulse"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            aria-label={listening ? "Zastavit" : "Mluvit"}
          >
            {listening ? <Mic className="w-9 h-9" /> : <MicOff className="w-9 h-9" />}
          </button>

          <p className="text-sm text-muted-foreground flex items-center gap-2 min-h-5">
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Zpracovávám…
              </>
            ) : listening ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Poslouchám…
              </>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : (
              "Klepněte na mikrofon a mluvte"
            )}
          </p>

          {transcript && (
            <p className="w-full rounded-lg bg-muted px-3 py-2 text-sm italic text-center">
              „{transcript}“
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
