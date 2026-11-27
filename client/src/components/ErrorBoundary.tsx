import { Component, type ReactNode } from "react";

// =============================================================================
// ErrorBoundary (v3.2) — kisi bhi screen ke crash par safed screen ki jagah
// dostana Hindi screen
// -----------------------------------------------------------------------------
// Masla: app me koi ErrorBoundary thi hi nahi. Ek bhi render error (jaise
// v3.1 ka Certificates hooks-order crash) hote hi React POORA tree gira
// deta tha — screen bilkul safed, aur Capacitor ka back-button listener bhi
// usi mare hue JS tree me hone se back bhi kaam nahi karta tha. User ko
// app zabardasti band karke dobara kholna padta tha.
//
// Hal: ye boundary crash ko yahin pakad leti hai aur ek saaf Hindi screen
// dikhati hai —
//   [🔄 Dobara try karo]  → boundary ki haalat reset; screen dobara banti
//                           hai (data dobara load hoga).
//   [🏠 Home par jao]     → poora app "/" se dobara khulta hai (pakka
//                           ilaaj, login/data bilkul surakshit rehta hai).
// Neeche chhoti si takneeki jaankari (error ka pehla hissa) bhi dikhti
// hai taaki user screenshot bhej sake to wajah turant pata chal jaye.
//
// Ye component jaan-boojh kar bina kisi UI library ke bani hai (sirf
// React + aam button) — taaki agar kabhi koi UI hissa hi crash ki wajah
// ho, tab bhi ye fallback screen hamesha ban sake.
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: (error?.message || String(error) || "").slice(0, 200),
    };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Console me poora saboot — aage ki jaanch ke liye.
    console.error("ErrorBoundary ne ek crash pakda:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "28px 20px",
            boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1 }}>😕</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#0f172a",
              margin: "12px 0 8px",
            }}
          >
            Kuch gadbad ho gayi
          </h2>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0 }}>
            Ghabraiye nahi — aapka saara data bilkul surakshit hai. Is
            screen par ek chhoti si takneeki dikkat aa gayi hai. Neeche
            wale button se dobara koshish karein, aksar ek hi baar me
            theek ho jata hai.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                minHeight: 48,
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                padding: "0 16px",
              }}
            >
              🔄 Dobara try karo
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              style={{
                minHeight: 48,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                padding: "0 16px",
              }}
            >
              🏠 Home par jao
            </button>
          </div>
          {this.state.message ? (
            <p
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "#94a3b8",
                wordBreak: "break-word",
                fontFamily: "monospace",
              }}
            >
              Takneeki jaankari: {this.state.message}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
}
