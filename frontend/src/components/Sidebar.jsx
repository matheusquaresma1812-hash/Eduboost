import { BookOpen, BrainCircuit, CalendarClock, CircleHelp, Compass, Flame, GraduationCap, LayoutDashboard, MicVocal, Notebook, Radar, ScrollText, Swords, X } from "lucide-react";
import { initials, useProfile } from "../lib/profile";

const LINKS = [
  ["Visão geral", LayoutDashboard],
  ["Minha trilha", Compass],
  ["Central de estudos", Notebook],
  ["Feynman", MicVocal],
  ["Correção", ScrollText],
  ["Planner", CalendarClock],
  ["Radar", Radar],
  ["Duelo", Swords],
  ["Biblioteca", BookOpen],
  ["Questões", CircleHelp],
];

export default function Sidebar({ active, setActive, open, setOpen }) {
  const [profile] = useProfile();
  const name = profile?.name || "Explorador";
  const line = profile?.grade || "8º ano";
  const inst = ({ publica: "Rede pública", federal: "Instituto Federal", particular: "Particular" }[profile?.institution_type]) || "Perfil livre";

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} data-testid="main-sidebar">
      <div className="brand">
        <div className="brand-mark"><GraduationCap size={19} /></div>
        <span>EduBoost <b>Pro</b></span>
        <button className="mobile-close" onClick={() => setOpen(false)} data-testid="sidebar-close-button"><X size={18} /></button>
      </div>
      <div className="side-label">APRENDER</div>
      <nav>
        {LINKS.map(([label, Icon]) => (
          <button key={label} className={active === label ? "nav-link active" : "nav-link"} onClick={() => { setActive(label); setOpen(false); }} data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`}>
            <Icon size={17} /><span>{label}</span>
            {active === label && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="side-promo">
        <div className="promo-icon"><Flame size={18} /></div>
        <strong>Seu ritmo está<br />pegando fogo!</strong>
        <span>3 dias seguidos estudando</span>
        <div className="streak-bar"><i /></div>
      </div>
      <div className="profile">
        <div className="avatar" data-testid="sidebar-avatar">{initials(name)}</div>
        <div>
          <strong data-testid="sidebar-profile-name">{name}</strong>
          <span data-testid="sidebar-profile-details">{line} · {inst}</span>
        </div>
      </div>
    </aside>
  );
}
