import { useState } from "react";
import { BrainCircuit, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

const SUBJECTS = ["Matemática", "Português", "História", "Geografia", "Física", "Química", "Biologia", "Filosofia", "Sociologia", "Inglês"];

export default function Diagnostic({ setActive }) {
  const [profile] = useProfile();
  const [grade, setGrade] = useState(profile?.grade?.includes("Médio") ? "Ensino Médio" : "Fundamental 2");
  const [focus, setFocus] = useState(profile?.focus_subjects?.[0] || "Matemática");
  const [confidence, setConfidence] = useState("Estou começando");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await http.post("/diagnostic", { session_id: profile?.session_id, grade, focus, confidence });
      setResult(data.response);
      toast.success("Sua trilha foi criada");
    } catch {
      toast.error("A IA está ocupada. Tente novamente em instantes.");
    } finally { setLoading(false); }
  };

  return (
    <section className="diagnostic-page" data-testid="diagnostic-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DIAGNÓSTICO INTELIGENTE</div>
          <h1>Uma trilha feita para <em>você.</em></h1>
          <p>Conte como você aprende. A gente adapta o caminho.</p>
        </div>
        <div className="diagnostic-orbit"><BrainCircuit size={42} /></div>
      </div>
      <div className="diagnostic-layout">
        <div className="diagnostic-form">
          <span className="step-label">01 / 03</span>
          <h2>Em qual fase você está?</h2>
          <p>Isso ajuda a ajustar a linguagem e a profundidade das aulas.</p>
          <div className="option-grid">
            {["Fundamental 1", "Fundamental 2", "Ensino Médio", "ENEM / Vestibular"].map((x) => (
              <button className={grade === x ? "option selected" : "option"} onClick={() => setGrade(x)} key={x} data-testid={`diagnostic-grade-${x.toLowerCase().replaceAll(" ", "-")}`}>{x}<CheckCircle2 size={17} /></button>
            ))}
          </div>
          <label>Qual matéria merece mais atenção agora?</label>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} data-testid="diagnostic-subject-select">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
          <label>Como você se sente com ela?</label>
          <div className="confidence-row">
            {["Estou começando", "Sei o básico", "Quero aprofundar"].map((x) => (
              <button className={confidence === x ? "confidence selected" : "confidence"} onClick={() => setConfidence(x)} key={x} data-testid={`diagnostic-confidence-${x.toLowerCase().replaceAll(" ", "-")}`}>{x}</button>
            ))}
          </div>
          <button className="primary-button full" onClick={submit} disabled={loading} data-testid="diagnostic-submit-button">{loading ? "Criando sua trilha..." : "Criar minha trilha"}<Sparkles size={17} /></button>
        </div>
        <div className="diagnostic-result">
          {result ? (
            <>
              <span className="eyebrow">SUA NOVA TRILHA</span>
              <h2>O caminho começa aqui.</h2>
              <div className="ai-result" data-testid="diagnostic-result">{result}</div>
              <button className="text-button" onClick={() => setActive("Central de estudos")} data-testid="open-central-button">Ir para a central <ChevronRight size={16} /></button>
            </>
          ) : (
            <>
              <div className="result-icon"><Sparkles size={24} /></div>
              <h3>Seu mapa de aprendizagem</h3>
              <p>Responda ao diagnóstico e receba uma sequência que respeita seu momento e ritmo.</p>
              <div className="result-lines"><span /><span /><span /></div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
