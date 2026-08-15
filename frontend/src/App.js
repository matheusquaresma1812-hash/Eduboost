import { useEffect, useState } from "react";
import "@/App.css";
import { ChevronRight, Flame, Menu, Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import Sidebar from "./components/Sidebar";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Diagnostic from "./pages/Diagnostic";
import Questions from "./pages/Questions";
import StudyCentral from "./pages/StudyCentral";
import Feynman from "./pages/Feynman";
import Correction from "./pages/Correction";
import Planner from "./pages/Planner";
import Revision from "./pages/Revision";
import Duel from "./pages/Duel";
import { initials, useProfile } from "./lib/profile";

const PAGES = {
  "Visão geral": Dashboard,
  "Minha trilha": Diagnostic,
  "Central de estudos": StudyCentral,
  "Feynman": Feynman,
  "Correção": Correction,
  "Planner": Planner,
  "Radar": Revision,
  "Duelo": Duel,
  "Biblioteca": Library,
  "Questões": Questions,
};

function App() {
  const [profile] = useProfile();
  const [active, setActive] = useState("Visão geral");
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.title = "EduBoost Pro";
  }, []);

  if (!profile) {
    return (
      <div className={`app-shell ${dark ? "theme-dark" : ""}`} data-testid="app-shell">
        <Onboarding onDone={() => setActive("Visão geral")} />
        <Toaster position="top-right" />
      </div>
    );
  }

  const Page = PAGES[active] || Dashboard;
  const name = profile?.name || "Estudante";

  return (
    <div className={`app-shell ${dark ? "theme-dark" : ""}`} data-testid="app-shell">
      <Sidebar active={active} setActive={setActive} open={open} setOpen={setOpen} />
      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)} data-testid="sidebar-menu-button"><Menu size={21} /></button>
          <div className="breadcrumb"><span>Meu espaço</span><ChevronRight size={14} /><b>{active}</b></div>
          <div className="top-actions">
            <div className="top-streak"><Flame size={17} /> 3 dias</div>
            <button className="theme-toggle" onClick={() => setDark((v) => !v)} aria-label={dark ? "Ativar modo claro" : "Ativar modo noturno"} data-testid="theme-toggle-button">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
            <div className="mini-avatar" title={name} data-testid="topbar-avatar">{initials(name)}</div>
          </div>
        </header>
        <Page setActive={setActive} />
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
