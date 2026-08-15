import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Sparkles, Landmark, School, Building2, ChevronRight } from "lucide-react";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

const GRADES = [
  "1º ano - Fundamental 1", "2º ano - Fundamental 1", "3º ano - Fundamental 1", "4º ano - Fundamental 1", "5º ano - Fundamental 1",
  "6º ano - Fundamental 2", "7º ano - Fundamental 2", "8º ano - Fundamental 2", "9º ano - Fundamental 2",
  "1º ano - Ensino Médio", "2º ano - Ensino Médio", "3º ano - Ensino Médio",
  "Pré-vestibular / Cursinho", "Universitário",
];

const FOCUS = ["Matemática", "Português", "Redação", "História", "Geografia", "Física", "Química", "Biologia", "Filosofia", "Sociologia", "Inglês", "Programação"];

const INSTITUTIONS = [
  { key: "publica", title: "Escola da rede pública", desc: "Ritmo acolhedor, exemplos do cotidiano, foco no ENEM.", icon: School },
  { key: "federal", title: "Instituto Federal / Técnico", desc: "Profundidade técnica, rigor conceitual e aplicações reais.", icon: Landmark },
  { key: "particular", title: "Escola particular", desc: "Ritmo exigente para Fuvest, Unicamp, ITA e vestibulares tradicionais.", icon: Building2 },
];

export default function Onboarding({ onDone }) {
  const [, setProfile] = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(GRADES[7]);
  const [institution, setInstitution] = useState("publica");
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleSubject = (s) => setSubjects((prev) => {
    if (prev.includes(s)) return prev.filter((x) => x !== s);
    if (prev.length >= 4) { toast.info("Escolha até 4 matérias em foco"); return prev; }
    return [...prev, s];
  });
  const subjectsValid = subjects.length >= 2 && subjects.length <= 4;

  const submit = async () => {
    setSaving(true);
    const session_id = (crypto?.randomUUID?.() || `session-${Date.now()}`);
    const payload = { session_id, name: name || "Estudante", grade, institution_type: institution, focus_subjects: subjects };
    try {
      const { data } = await http.post("/profile", payload);
      setProfile(data);
      toast.success(`Bem-vindo(a), ${data.name}!`);
      onDone?.();
    } catch (e) {
      toast.error("Não foi possível salvar o perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="onboarding-shell" data-testid="onboarding-shell">
      <div className="onb-panel">
        <div className="onb-brand"><div className="brand-mark"><GraduationCap size={18} /></div>EduBoost <b>Pro</b></div>
        <span className="step-label">PASSO 0{step + 1} / 03</span>
        {step === 0 && (
          <>
            <h1>Oi! Como quer que a gente te chame?</h1>
            <p>Isso ajuda a IA a personalizar sua trilha.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Alex Martins" className="onb-input" data-testid="onb-name-input" />
            <label className="onb-label">E qual série ou fase escolar você está agora?</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="onb-select" data-testid="onb-grade-select">
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
            <button className="primary-button full" onClick={() => setStep(1)} data-testid="onb-next-1">Continuar <ChevronRight size={16} /></button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Qual o seu contexto de estudo?</h1>
            <p>A IA muda o tom, a profundidade e os exemplos conforme o seu perfil.</p>
            <div className="onb-inst-grid">
              {INSTITUTIONS.map(({ key, title, desc, icon: Icon }) => (
                <button key={key} className={`onb-inst ${institution === key ? "selected" : ""}`} onClick={() => setInstitution(key)} data-testid={`onb-inst-${key}`}>
                  <div className="onb-inst-icon"><Icon size={19} /></div>
                  <div>
                    <strong>{title}</strong>
                    <span>{desc}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="onb-actions">
              <button className="text-button" onClick={() => setStep(0)} data-testid="onb-back-1">Voltar</button>
              <button className="primary-button" onClick={() => setStep(2)} data-testid="onb-next-2">Continuar <ChevronRight size={16} /></button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Onde você quer focar?</h1>
            <p>Escolha entre 2 e 4 matérias — a gente prioriza flashcards, revisão e questões nelas.</p>
            <div className="onb-subjects">
              {FOCUS.map((s) => (
                <button key={s} className={`onb-subject ${subjects.includes(s) ? "selected" : ""}`} onClick={() => toggleSubject(s)} data-testid={`onb-subject-${s.toLowerCase()}`}>{s}</button>
              ))}
            </div>
            <div className="onb-hint" data-testid="onb-subject-hint">{subjects.length}/4 selecionadas · mínimo 2</div>
            <div className="onb-actions">
              <button className="text-button" onClick={() => setStep(1)} data-testid="onb-back-2">Voltar</button>
              <button className="primary-button" onClick={submit} disabled={saving || !subjectsValid} data-testid="onb-submit"><Sparkles size={16} /> {saving ? "Preparando trilha..." : "Entrar no EduBoost"}</button>
            </div>
          </>
        )}
      </div>
      <div className="onb-side" aria-hidden>
        <div className="onb-side-inner">
          <span className="eyebrow">ADAPTATIVO</span>
          <h2>Uma trilha que se ajusta ao seu jeito de aprender.</h2>
          <ul>
            <li>Explicações no seu nível — rede pública, IF ou particular.</li>
            <li>Flashcards e mapas mentais a partir dos seus próprios materiais.</li>
            <li>Feynman por áudio: você ensina, a IA corrige.</li>
            <li>Correção de redação por foto do caderno.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
