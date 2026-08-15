import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Plus, Radar as RadarIcon, RefreshCw, X } from "lucide-react";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

const DIFFS = [{ key: "facil", label: "Fácil" }, { key: "medio", label: "Médio" }, { key: "dificil", label: "Difícil" }];

export default function Revision() {
  const [profile] = useProfile();
  const [topics, setTopics] = useState([]);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState(profile?.focus_subjects?.[0] || "Matemática");
  const [difficulty, setDifficulty] = useState("medio");

  const load = async () => {
    if (!profile?.session_id) return;
    try { const { data } = await http.get(`/revision/topics/${profile.session_id}`); setTopics(data.items || []); } catch { /* noop */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.session_id]);

  const add = async () => {
    if (!topic) { toast.error("Escreva o tópico"); return; }
    try {
      const { data } = await http.post("/revision/topic", { session_id: profile.session_id, topic, subject, difficulty });
      setTopics((prev) => [...prev, { ...data, is_due: true }]);
      // Backend now returns next_due=now so a page reload also keeps this in "HOJE NO RADAR".
      setTopic("");
      toast.success("Adicionado ao radar");
    } catch { toast.error("Falha ao adicionar"); }
  };

  const review = async (id, outcome) => {
    try {
      const { data } = await http.post(`/revision/topic/${id}/review`, { outcome });
      setTopics((prev) => prev.map((t) => t.id === id ? { ...t, ...data, is_due: false } : t));
      toast.success("Revisão registrada");
    } catch { toast.error("Falha ao registrar"); }
  };

  const remove = async (id) => {
    await http.delete(`/revision/topic/${id}`);
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  const due = topics.filter((t) => t.is_due);
  const upcoming = topics.filter((t) => !t.is_due);

  return (
    <section className="radar-page" data-testid="radar-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RADAR DE REVISÃO</div>
          <h1>A curva do esquecimento <em>a seu favor.</em></h1>
          <p>Cada tópico revisado retorna no momento certo: 1, 3, 7, 14, 30, 60 dias.</p>
        </div>
        <div className="diagnostic-orbit"><RadarIcon size={40} /></div>
      </div>

      <div className="radar-layout">
        <div className="radar-form">
          <span className="eyebrow">ADICIONAR TÓPICO</span>
          <label>Tópico</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Guerra Fria" data-testid="radar-topic-input" />
          <label>Matéria</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="radar-subject-input" />
          <label>Dificuldade</label>
          <div className="level-row">{DIFFS.map((d) => <button key={d.key} className={difficulty === d.key ? "level selected" : "level"} onClick={() => setDifficulty(d.key)} data-testid={`radar-diff-${d.key}`}>{d.label}</button>)}</div>
          <button className="primary-button full" onClick={add} data-testid="radar-add-button"><Plus size={15} /> Adicionar</button>
        </div>

        <div className="radar-list">
          <div className="radar-section">
            <div className="radar-head"><span className="eyebrow">HOJE NO RADAR</span><b>{due.length}</b></div>
            {due.length === 0 && <p className="sc-empty">Nada urgente. Bom trabalho!</p>}
            {due.map((t) => (
              <article className="radar-card due" key={t.id} data-testid={`radar-due-${t.id}`}>
                <div>
                  <span className="radar-tag">{t.subject}</span>
                  <strong>{t.topic}</strong>
                  <span className="radar-meta">Nível {t.step + 1} · próxima em {t.next_due?.slice(0, 10)}</span>
                </div>
                <div className="radar-actions">
                  <button className="ok" onClick={() => review(t.id, "ok")} data-testid={`radar-ok-${t.id}`}><CheckCheck size={13} /> Lembrei</button>
                  <button className="doubt" onClick={() => review(t.id, "duvida")} data-testid={`radar-doubt-${t.id}`}><RefreshCw size={13} /> Dúvida</button>
                  <button className="err" onClick={() => review(t.id, "erro")} data-testid={`radar-err-${t.id}`}><X size={13} /> Esqueci</button>
                </div>
              </article>
            ))}
          </div>
          <div className="radar-section">
            <div className="radar-head"><span className="eyebrow">PRÓXIMAS REVISÕES</span><b>{upcoming.length}</b></div>
            {upcoming.map((t) => (
              <article className="radar-card upcoming" key={t.id} data-testid={`radar-upcoming-${t.id}`}>
                <div>
                  <span className="radar-tag">{t.subject}</span>
                  <strong>{t.topic}</strong>
                  <span className="radar-meta">Volta em {t.next_due?.slice(0, 10)}</span>
                </div>
                <button className="radar-remove" onClick={() => remove(t.id)} data-testid={`radar-del-${t.id}`}><X size={14} /></button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
