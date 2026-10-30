"use client";

import { ActionTiles, SegmentedControl } from "@khmio/ui";
import { FileDown, ImageDown, Loader2, Printer, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type RefObject } from "react";
import { PAPER_EXPORT_WIDTH, type PaperSize } from "./paper-parts";

// The size switch and the four buttons above a printed document — an
// invoice (design/screens.md B7), a bill or a payment voucher (S13).
// The image and PDF are a picture of the off-screen copy of the document at
// paper width, so Khmer is drawn by the browser and always comes out right.
// Both libraries load only when a button is tapped.

type Busy = "pdf" | "image" | "share" | null;

/** How long the document must stay unchanged before its picture is made for sharing. */
const PREPARE_AFTER_MS = 1200;

/** A4 page and margin, in millimetres. */
const A4 = { width: 210, height: 297, margin: 10 };
/** An 80 mm roll prints about 72 mm wide. */
const RECEIPT = { width: 80, margin: 4 };

/** PNG for the saved image (sharp text); JPEG inside the PDF, which keeps the file small enough to send on Telegram. */
async function renderPicture(node: HTMLElement, size: PaperSize, format: "png" | "jpeg"): Promise<string> {
  const { toJpeg, toPng } = await import("html-to-image");
  const options = { pixelRatio: 2, backgroundColor: "#ffffff", width: PAPER_EXPORT_WIDTH[size], cacheBust: true };
  return format === "png" ? toPng(node, options) : toJpeg(node, { ...options, quality: 0.9 });
}

function download(href: string, fileName: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = dataUrl;
  });
}

/** A4: the picture across the page, continued on more pages when it's long. Receipt: one strip as long as the receipt. */
async function renderPdf(dataUrl: string, size: PaperSize): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { width, height } = await imageSize(dataUrl);
  if (size === "receipt") {
    const imageWidth = RECEIPT.width - RECEIPT.margin * 2;
    const imageHeight = (height / width) * imageWidth;
    const pdf = new jsPDF({ unit: "mm", format: [RECEIPT.width, imageHeight + RECEIPT.margin * 2] });
    pdf.addImage(dataUrl, "JPEG", RECEIPT.margin, RECEIPT.margin, imageWidth, imageHeight);
    return pdf.output("blob");
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const imageWidth = A4.width - A4.margin * 2;
  const imageHeight = (height / width) * imageWidth;
  const pageHeight = A4.height - A4.margin * 2;
  for (let offset = 0, page = 0; offset < imageHeight; offset += pageHeight, page++) {
    if (page > 0) pdf.addPage();
    pdf.addImage(dataUrl, "JPEG", A4.margin, A4.margin - offset, imageWidth, imageHeight);
  }
  return pdf.output("blob");
}

export function DocumentActions({
  target,
  size,
  onSizeChange,
  fileName,
  shareTitle,
  contentKey,
  documentName,
}: {
  /** The off-screen copy at paper width. */
  target: RefObject<HTMLElement>;
  size: PaperSize;
  onSizeChange: (size: PaperSize) => void;
  /** Without extension: "receipt-SOK-123456". */
  fileName: string;
  shareTitle: string;
  /** Changes whenever what the document shows changes, so the picture prepared for sharing is made again. */
  contentKey: string;
  /** "Invoice" or "Receipt", for the share button. */
  documentName: string;
}) {
  const t = useTranslations("Invoice");
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(kind: Exclude<Busy, null>, work: (node: HTMLElement) => Promise<void>) {
    if (!target.current || busy) return;
    setBusy(kind);
    setMessage(null);
    try {
      await work(target.current);
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(t("fileFailed"));
    } finally {
      setBusy(null);
    }
  }

  const saveImage = () =>
    run("image", async (node) => {
      download(await renderPicture(node, size, "png"), `${fileName}.png`);
      setMessage(t("downloaded"));
    });

  const savePdf = () =>
    run("pdf", async (node) => {
      const url = URL.createObjectURL(await renderPdf(await renderPicture(node, size, "jpeg"), size));
      download(url, `${fileName}.pdf`);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(t("downloaded"));
    });

  // The picture to share, made in the background once the document has settled (its QR code and logo
  // loaded): phones open the share sheet only straight after a tap, too soon to make the picture then.
  const [ready, setReady] = useState<{ key: string; file: File; dataUrl: string } | null>(null);
  const readyKey = `${size}|${fileName}|${contentKey}`;
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      const node = target.current;
      if (!node) return;
      renderPicture(node, size, "png")
        .then(async (dataUrl) => {
          const file = new File([await (await fetch(dataUrl)).blob()], `${fileName}.png`, { type: "image/png" });
          if (live) setReady({ key: readyKey, file, dataUrl });
        })
        .catch(() => undefined);
    }, PREPARE_AFTER_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [readyKey, size, fileName, target]);

  // The phone's share sheet with the picture attached (Telegram, Messenger…). Sharing files needs a
  // secure (https) page; elsewhere the picture is saved and the message says why.
  function share() {
    if (busy) return;
    setMessage(null);
    const prepared = ready?.key === readyKey ? ready : null;
    const canShareFiles = (file: File) => window.isSecureContext && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (prepared && canShareFiles(prepared.file)) {
      // Called in the tap itself, before anything is awaited, so the phone allows it.
      navigator.share({ files: [prepared.file], title: shareTitle }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(t("fileFailed"));
      });
      return;
    }
    void run("share", async (node) => {
      const dataUrl = prepared?.dataUrl ?? (await renderPicture(node, size, "png"));
      const file = prepared?.file ?? new File([await (await fetch(dataUrl)).blob()], `${fileName}.png`, { type: "image/png" });
      if (!canShareFiles(file)) {
        download(dataUrl, `${fileName}.png`);
        setMessage(window.isSecureContext ? t("shareUnsupported") : t("shareNeedsHttps"));
        return;
      }
      setReady({ key: readyKey, file, dataUrl });
      try {
        await navigator.share({ files: [file], title: shareTitle });
      } catch (error) {
        // The picture took longer than the phone waits after a tap: it's ready now, so the next tap opens the sheet at once.
        if (error instanceof DOMException && error.name === "NotAllowedError") setMessage(t("shareTapAgain"));
        else throw error;
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("sizeLabel")}</span>
        <SegmentedControl
          value={size}
          onChange={onSizeChange}
          options={[
            { value: "a4", label: t("sizeA4") },
            { value: "receipt", label: t("sizeReceipt") },
          ]}
        />
      </div>
      {/* Sharing comes first: on a phone it's what the invoice is mostly for. Dark teal in both themes, like the track card. */}
      <button
        type="button"
        onClick={share}
        disabled={busy !== null}
        aria-busy={busy === "share"}
        className="group flex min-h-[64px] items-center gap-3 rounded-2xl bg-gradient-to-br from-paper-brand to-nav-bg p-3 pr-4 text-left text-nav-fg shadow-raised transition-transform active:scale-[0.99] disabled:opacity-70 motion-reduce:transition-none"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nav-fg/15 ring-1 ring-nav-fg/25">
          {busy === "share" ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Share2 className="h-5 w-5" aria-hidden="true" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold leading-normal">{t("shareCta", { document: documentName })}</span>
          <span className="text-sm leading-normal text-nav-fg/85">{t("shareHint")}</span>
        </span>
      </button>
      <ActionTiles
        variant="boxed"
        columns={3}
        items={[
          { key: "print", icon: Printer, label: t("print"), onClick: () => window.print(), disabled: busy !== null },
          { key: "image", icon: ImageDown, label: t("saveImage"), onClick: () => void saveImage(), busy: busy === "image", disabled: busy !== null },
          { key: "pdf", icon: FileDown, label: t("downloadPdf"), onClick: () => void savePdf(), busy: busy === "pdf", disabled: busy !== null },
        ]}
      />
      <p className="min-h-[1.5em] text-sm text-muted" role="status" aria-live="polite">
        {busy ? t("working") : message}
      </p>
    </div>
  );
}

/** Paper size and margins for the browser's own printing, matching the chosen size. */
export function PaperPrintStyle({ size }: { size: PaperSize }) {
  const page = size === "a4" ? `size: A4; margin: ${A4.margin}mm;` : `size: ${RECEIPT.width}mm auto; margin: ${RECEIPT.margin}mm;`;
  return <style>{`@media print { @page { ${page} } html, body { background: #fff !important; } }`}</style>;
}
