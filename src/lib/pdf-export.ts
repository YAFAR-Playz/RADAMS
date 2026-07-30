// Client-only PDF export for the in-app report print view — there's no
// server-side PDF generation for it, so Share/Download render whatever's
// currently on screen (via html2canvas) into a real PDF file (via jsPDF),
// one page per ".report-page" element so each student lands on its own
// page. Dynamically imported so these two fairly heavy libraries never end
// up in the initial page bundle for people who never click these buttons.

const A4_WIDTH_PT = 595.28;

export async function renderElementToPdfBlob(container: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const pageNodes = Array.from(container.querySelectorAll<HTMLElement>(".report-page"));
  const nodes = pageNodes.length ? pageNodes : [container];

  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const node of nodes) {
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pageHeightPt = (canvas.height * A4_WIDTH_PT) / canvas.width;

    if (!pdf) {
      pdf = new jsPDF({ unit: "pt", format: [A4_WIDTH_PT, pageHeightPt] });
    } else {
      pdf.addPage([A4_WIDTH_PT, pageHeightPt], "portrait");
    }
    pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_PT, pageHeightPt);
  }

  if (!pdf) throw new Error("Nothing to export.");
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export type ShareResult = "shared" | "cancelled" | "downloaded";

// Shares the actual PDF file via the Web Share API when the browser
// supports sharing files (mostly mobile browsers); otherwise falls back to
// a direct download, since there's no meaningful "share a link" fallback
// for a file that only exists in the browser's memory.
export async function shareOrDownloadPdf(container: HTMLElement, fileName: string): Promise<ShareResult> {
  const blob = await renderElementToPdfBlob(container);
  const file = new File([blob], fileName, { type: "application/pdf" });

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
      // Sharing failed for some other reason — fall through to download.
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
