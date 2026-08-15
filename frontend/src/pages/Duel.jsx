import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, Sparkles, Swords, Trophy, XCircle } from "lucide-react";
import { http, extractJson } from "../lib/api";
import { useProfile } from "../lib/profile";

export default function Duel() {
  const [profile] = useProfile();
  const [subject, setSubject] = useState(profile?.focus_subjects?.[0] || "Matemática");
  const [level, setLevel] = useState("Intermediário");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState({});
  const [finished, setFinished] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const { data } = await http.post("/duel/start", { session_id: profile?.session_id, subject, level });
      const json = extractJson(data.response);
      if (!json?.questions?.length) { toast.error("Não deu para gerar. Tente de novo."); return; }
      setQuestions(json.questions);
      setI(0);
      setPicks({});
      setFinished(false);
    } catch { toast.error("Falha ao iniciar duelo"); }
    finally { setBusy(false); }
  };

  const answer = (opt) => {
    setPicks((p) => ({ ...p, [i]: opt }));
    setTimeout(() => {
      if (i === questions.length - 1) setFinished(true);
      else setI(i + 1);
    }, 900);
  };

  const q = questions[i];
  const score = Object.entries(picks).filter(([k, v]) => questions[Number(k)]?.answer === v).length;

  return (
    <section className="duel-page" data-testid="duel-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DUELO DE MENTES</div>
          <h1>Você <em>vs.</em> a IA.</h1>
          <p>3 rodadas de raciocínio rápido. Cada acerto vira ponto.</p>
        </div>
        <div className="diagnostic-orbit"><Swords size={40} /></div>
      </div>

      {questions.length === 0 && (
        <div className="duel-config">
          <span className="eyebrow">CONFIGURE A ARENA</span>
          <label>Matéria</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="duel-subject-input" />
          <label>Nível</label>
          <div className="level-row">{["Iniciante", "Intermediário", "Avançado"].map((x) => <button key={x} className={level === x ? "level selected" : "level"} onClick={() => setLevel(x)} data-testid={`duel-level-${x.toLowerCase()}`}>{x}</button>)}</div>
          <button className="primary-button full" onClick={start} disabled={busy} data-testid="duel-start-button"><Sparkles size={16} /> {busy ? "Preparando arena…" : "Começar duelo"}</button>
        </div>
      )}

      {questions.length > 0 && !finished && q && (
        <div className="duel-arena" data-testid="duel-arena">
          <div className="duel-progress"><span>Rodada {i + 1}/{questions.length}</span><b>{score} pts</b></div>
          <div className="duel-card">
            <p className="duel-prompt">{q.prompt}</p>
            <div className="duel-options">
              {q.options?.map((opt, idx) => {
                const picked = picks[i] === idx;
                const revealed = picks[i] !== undefined;
                const correct = q.answer === idx;
                const cls = revealed ? (correct ? "duel-opt correct" : picked ? "duel-opt wrong" : "duel-opt") : "duel-opt";
                return (
                  <button key={idx} className={cls} onClick={() => picks[i] === undefined && answer(idx)} disabled={picks[i] !== undefined} data-testid={`duel-option-${i}-${idx}`}>
                    <span className="opt-letter">{String.fromCharCode(65 + idx)}</span>
                    <span>{opt}</span>
                    {revealed && correct && <CheckCircle2 size={16} />}
                    {revealed && picked && !correct && <XCircle size={16} />}
                  </button>
                );
              })}
            </div>
            {picks[i] !== undefined && q.explanation && (
              <div className="duel-expl">
                <strong>Por quê?</strong>
                <p>{q.explanation}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {finished && (
        <div className="duel-final" data-testid="duel-final">
          <div className="duel-trophy"><Trophy size={30} /></div>
          <h2>Você somou <em>{score}</em> de {questions.length}</h2>
          <p>{score === questions.length ? "Vitória perfeita!" : score >= questions.length / 2 ? "Bom desempenho! Bora aprofundar." : "Boa tentativa. Revisar já é vencer."}</p>
          <button className="primary-button" onClick={start} data-testid="duel-again"><Sparkles size={15} /> Nova arena <ChevronRight size={15} /></button>
        </div>
      )}
    </section>
  );
}
