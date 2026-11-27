import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { pushModal, popModal } from "@/lib/modalStack";

// =============================================================================
// PrintViewer (v3.1) — print/document ke liye APP KE ANDAR ka full-screen
// viewer
// -----------------------------------------------------------------------------
// Masla (user ki shikayat): "table khol lia to ab close nahi ho rahi" —
// pehle har print (Certificate, Timetable, Report Card, ID Card)
// window.open("", "_blank") + document.write se NAYI browser window me
// khulta tha. Android WebView me wo window Chrome me khul jati thi ya
// atki rehti thi — band karne ka koi pakka rasta nahi tha, back button
// bhi use band nahi karta tha.
//
// Hal: print wala content ab app ke andar hi ek full-screen overlay me
// khulta hai:
//  * Upar bar: title + [🖨 Print] + [✕ Band karo] — band karna hamesha
//    ek tap par, screen par saaf dikhta hai.
//  * Hardware back: khulte hi ye overlay modal-stack me register ho
//    jata hai, isliye back dabane par App.tsx ka handler SABSE PEHLE
//    isey band karta hai (history/app par koi asar nahi).
//  * Print button window.print() chalata hai; index.css ke @media
//    print niyam sirf is viewer ka content print karte hain (baaki
//    app print me gayab). Android WebView me window.print() kabhi
//    kabhi no-op ho sakta hai — tab bhi content screen par dikhta
//    rehta hai aur Band karo hamesha kaam karta hai.
//  * Portal se document.body par render hota hai taaki kisi Dialog ke
//    andar band na rahe aur z-index sabse upar rahe.
//
// Props:
//  title   — upar bar me dikhne wala naam
//  html    — printable HTML string (innerHTML) — Certificates/
//            Timetable/ReportCards/IdCard apne ref ka innerHTML dete
//            hain, bilkul pehle ki document.write wali samagri
//  cssText — us document ke apne <style> (print layout ke liye);
//            viewer ke andar hi lagta hai, band hote hi hat jata hai
//  onClose — band karne ka callback (Band karo + back button dono
//            yahi chalate hain)
// =============================================================================

interface PrintViewerProps {
  title: string;
  html?: string;
  cssText?: string;
  onClose: () => void;
  children?: ReactNode;
}

export default function PrintViewer({
  title,
  html,
  cssText,
  onClose,
  children,
}: PrintViewerProps) {
  // Back button (modal-stack) hamesha taaza onClose chalaye — ref se.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = pushModal(() => closeRef.current());
    // index.css ka @media print isi class se pehchanta hai ki print
    // ke samay sirf viewer dikhana hai.
    document.body.classList.add("sg-print-viewer-open");
    return () => {
      popModal(id);
      document.body.classList.remove("sg-print-viewer-open");
    };
  }, []);

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      // Print na khule to bhi viewer khula rehta hai — user content
      // dekh sakta hai aur Band karo se wapas ja sakta hai.
    }
  };

  return createPortal(
    <div
      className="sg-print-viewer fixed inset-0 z-[9999] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sg-print-viewer-bar no-print flex items-center justify-between gap-2 border-b bg-slate-900 px-3 py-2 text-white">
        <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex min-h-[40px] items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" /> Band karo
          </button>
        </div>
      </div>
      <div className="sg-print-viewer-body min-w-0 flex-1 overflow-auto p-3">
        {cssText ? <style>{cssText}</style> : null}
        {html ? (
          <div
            className="sg-print-area"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="sg-print-area">{children}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
