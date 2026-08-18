import { createRoot } from "react-dom/client";
import App from "./App";
import { WalletProvider } from "./lib/wallet";
import "./index.css";

// No StrictMode: its double-invoked effects fight GSAP's context.revert(),
// which leaves SplitText re-splitting an already-split node and freezes the
// reveal tweens at their initial state.
createRoot(document.getElementById("root")!).render(
  <WalletProvider>
    <App />
  </WalletProvider>
);
