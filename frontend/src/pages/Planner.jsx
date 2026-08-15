import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, ChevronRight, Plus, Trash2 } from "lucide-react";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

const KINDS = [
  { key: "trabalho", label: "Trabalho" },
  { key: "prova", label: "Prova" },
  { key: "revisao", label: "Revisão" },
  { key: "outro", label: "Outro" },
];

function daysUntil(dueDate) {
  const d = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function Planner() {
  const [profile] = useProfile();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(profile?.focus_subjects?.[0] || "Matemática");
  const [kind, setKind] = useState("trabalho");
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [checklist, setChecklist] = useState("");

  const load = async () => {
    if (!profile?.session_id) return;
    try {
      const { data } = await http.get(`/planner/tasks/${profile.session_id}`);
      setTasks(data.items || []);
    } catch { /* noop */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.session_id]);

  const createTask = async () => {
    if (!title) { toast.error("Dê um título ao trabalho"); return; }
    const items = checklist.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const { data } = await http.post("/planner/task", {
        session_id: profile.session_id, title, subject, kind, due_date: dueDate, checklist: items,
      });
      setTasks((prev) => [...prev, data].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      setTitle(""); setChecklist("");
      toast.success("Adicionado ao seu cronograma");
    } catch { toast.error("Não deu para salvar"); }
  };

  const toggleCheck = async (task, id) => {
    const newList = task.checklist.map((c) => c.id === id ? { ...c, done: !c.done } : c);
    const done = newList.every((c) => c.done) && newList.length > 0;
    try {
      const { data } = await http.patch(`/planner/task/${task.id}`, { checklist: newList, done });
      setTasks((prev) => prev.map((t) => t.id === task.id ? data : t));
    } catch { /* noop */ }
  };

  const removeTask = async (id) => {
    await http.delete(`/planner/task/${id}`);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <section className="planner-page" data-testid="planner-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GESTOR DE PRODUTIVIDADE</div>
          <h1>Prazos, provas e revisões <em>no mesmo lugar.</em></h1>
          <p>Um cronograma visual com checklist de matérias revisadas.</p>
        </div>
        <div className="diagnostic-orbit"><CalendarClock size={40} /></div>
      </div>

      <div className="planner-layout">
        <div className="planner-form">
          <span className="eyebrow">NOVO REGISTRO</span>
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Trabalho de História - Era Vargas" data-testid="planner-title-input" />
          <label>Matéria</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="planner-subject-input" />
          <label>Tipo</label>
          <div className="level-row">{KINDS.map((k) => <button key={k.key} className={kind === k.key ? "level selected" : "level"} onClick={() => setKind(k.key)} data-testid={`planner-kind-${k.key}`}>{k.label}</button>)}</div>
          <label>Data de entrega</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="planner-date-input" />
          <label>Checklist (uma tarefa por linha)</label>
          <textarea rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} placeholder="Ex: Ler capítulo 3&#10;Fazer resumo&#10;Revisar exercícios" data-testid="planner-checklist-input" />
          <button className="primary-button full" onClick={createTask} data-testid="planner-add-button"><Plus size={16} /> Adicionar</button>
        </div>

        <div className="planner-list">
          <span className="eyebrow">SEU CRONOGRAMA</span>
          {tasks.length === 0 && <p className="sc-empty">Nada agendado ainda. Adicione seu primeiro trabalho.</p>}
          {tasks.map((t) => {
            const days = daysUntil(t.due_date);
            const urgency = days < 0 ? "late" : days <= 2 ? "hot" : days <= 7 ? "warm" : "cool";
            const total = t.checklist?.length || 0;
            const doneCount = (t.checklist || []).filter((c) => c.done).length;
            return (
              <article key={t.id} className={`planner-item ${urgency} ${t.done ? "done" : ""}`} data-testid={`planner-item-${t.id}`}>
                <div className="pi-head">
                  <div>
                    <span className="pi-kind">{t.kind}</span>
                    <strong>{t.title}</strong>
                    <span className="pi-sub">{t.subject}</span>
                  </div>
                  <div className="pi-due">
                    <b>{new Date(t.due_date).toLocaleDateString("pt-BR")}</b>
                    <span>{days < 0 ? `${-days} dias atrasado` : days === 0 ? "hoje" : `em ${days} dias`}</span>
                  </div>
                  <button className="pi-del" onClick={() => removeTask(t.id)} data-testid={`planner-delete-${t.id}`}><Trash2 size={15} /></button>
                </div>
                {total > 0 && (
                  <>
                    <div className="pi-progress"><i style={{ width: `${(doneCount / total) * 100}%` }} /></div>
                    <ul className="pi-checklist">
                      {t.checklist.map((c) => (
                        <li key={c.id} className={c.done ? "done" : ""}>
                          <button onClick={() => toggleCheck(t, c.id)} data-testid={`planner-check-${c.id}`}>
                            <CheckCircle2 size={14} /> {c.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
