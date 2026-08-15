import { useState } from "react";
import { CircleHelp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

const SUBJECTS = ["Matemática", "Português", "História", "Geografia", "Física", "Química", "Biologia", "Filosofia", "Sociologia", "Inglês"];

export default function Questions() {
  const [profile] = useProfile();
  const [subject, setSubject] = useState(profile?.focus_subjects?.[0] || "Matemática");
  const [topic, setTopic] = useState("Frações");
  const [level, setLevel] = useState("Intermediário");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await http.post("/questions", { session_id: profile?.session_id, subject, topic, level });
      setResult(data.response);
    } catch { toast.error("Não foi possível gerar a questão agora"); }
    finally { setLoading(false); }
  };

  return (
    <section className="questions-page" data-testid="questions-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">BANCO DE QUESTÕES</div>
          <h1>Aprenda fazendo <em>conexões.</em></h1>
          <p>Questões autorais com resolução passo a passo.</p>
        </div>
        <div className="question-mark"><CircleHelp size={40} /></div>
      </div>
      <div className="question-layout">
        <div className="question-controls">
          <span className="eyebrow">PERSONALIZE O DESAFIO</span>
          <label>Matéria</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="question-subject-select">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
          <label>Tema</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="question-topic-input" />
          <label>Nível</label>
          <div className="level-row">{["Iniciante", "Intermediário", "Avançado"].map((x) => <button className={level === x ? "level selected" : "level"} onClick={() => setLevel(x)} key={x} data-testid={`question-level-${x.toLowerCase()}`}>{x}</button>)}</div>
          <button className="primary-button full" onClick={generate} disabled={loading} data-testid="generate-question-button">{loading ? "Criando questão..." : "Gerar questão"}<Sparkles size={17} /></button>
        </div>
        <div className="question-result">
          {result ? <div className="ai-result" data-testid="question-result">{result}</div> : (
            <>
              <div className="question-empty-icon"><CircleHelp size={27} /></div>
              <h2>Seu próximo desafio espera.</h2>
              <p>Escolha a matéria e o nível. A resolução detalhada aparece depois que você tentar.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
