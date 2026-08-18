import { useEffect } from "react";
import { ScrollTrigger } from "./lib/motion";
import { useRoute } from "./lib/router";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Ticker from "./components/Ticker";
import Problem from "./components/Problem";
import HowItWorks from "./components/HowItWorks";
import Matrix from "./components/Matrix";
import Sources from "./components/Sources";
import Footer from "./components/Footer";
import Console from "./console/Console";

export default function App() {
  const { path, go } = useRoute();
  const isConsole = path.startsWith("/console");

  useEffect(() => {
    // fonts load after first paint and change line boxes, so recompute triggers
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => window.removeEventListener("load", refresh);
  }, [path]);

  return (
    <>
      <div className="grain" />
      <Nav route={isConsole ? "/console" : "/"} onNavigate={go} />

      {isConsole ? (
        <Console />
      ) : (
        <main>
          <Hero onEnter={() => go("/console")} />
          <Ticker />
          <Problem />
          <Ticker invert />
          <HowItWorks />
          <Matrix />
          <Sources />
          <Footer onEnter={() => go("/console")} />
        </main>
      )}
    </>
  );
}
