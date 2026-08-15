import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, FileText, Image as ImageIcon, Loader2, Notebook, Sparkles, Trash2, UploadCloud, Wand2 } from "lucide-react";
import { http, extractJson } from "../lib/api";
import { useProfile } from "../lib/profile";

const SUBJECTS = ["Matemática", "Português", "História", "Geografia", "Física", "Química", "Biologia", "Filosofia", "Sociologia", "Inglês", "Redação", "Outras"];

function FlashcardDeck({ cards }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (!cards?.length) return null;
  const card = cards[i];
  return (
    <div className="flashcard-deck" data-testid="flashcard-deck">
      <div className="flashcard-meta"><span>{i + 1}/{cards.length}</span><span className="hint">{card.hint || "Toque para virar"}</span></div>
      <button className={`flashcard ${flip ? "flipped" : ""}`} onClick={() => setFlip((v) => !v)} data-testid="flashcard-flip">
        <div className="face front">{card.front}</div>
        <div className="face back">{card.back}</div>
      </button>
      <div className="flashcard-nav">
        <button onClick={() => { setFlip(false); setI((v) => Math.max(0, v - 1)); }} disabled={i === 0} data-testid="flashcard-prev">Anterior</button>
        <button className="primary-button" onClick={() => { setFlip(false); setI((v) => Math.min(cards.length - 1, v + 1)); }} disabled={i === cards.length - 1} data-testid="flashcard-next">Próxima</button>
      </div>
    </div>
  );
}

function MindMap({ data }) {
  if (!data?.root) return null;
  const colors = ["mint", "blue", "coral", "amber", "violet", "sun"];
  return (
    <div className="mindmap" data-testid="mindmap">
      <div className="mm-root">{data.root}</div>
      <div className="mm-branches">
        {(data.branches || []).map((b, idx) => (
          <div key={idx} className={`mm-branch ${colors[idx % colors.length]}`}>
            <strong>{b.label}</strong>
            <ul>{(b.children || []).map((c, j) => <li key={j}>{c}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudyCentral() {
  const [profile] = useProfile();
  const [materials, setMaterials] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState(profile?.focus_subjects?.[0] || "Matemática");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState(null);
  const [cards, setCards] = useState([]);
  const [mind, setMind] = useState(null);
  const [rawFlash, setRawFlash] = useState("");
  const [rawMind, setRawMind] = useState("");
  const [busy, setBusy] = useState({ flash: false, mind: false });

  const sessionId = profile?.session_id;

  const load = async () => {
    if (!sessionId) return;
    try {
      const { data } = await http.get(`/study/materials/${sessionId}`);
      setMaterials(data.items || []);
    } catch { /* noop */ }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sessionId]);

  const onUpload = async (file) => {
    if (!file || !sessionId) return;
    const fd = new FormData();
    fd.append("session_id", sessionId);
    fd.append("subject", subject);
    fd.append("title", title || file.name);
    fd.append("file", file);
    setUploading(true);
    try {
      const { data } = await http.post("/study/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMaterials((prev) => [data, ...prev]);
      toast.success("Material enviado!");
      setTitle("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Falha no upload");
    } finally { setUploading(false); }
  };

  const removeMaterial = async (id) => {
    await http.delete(`/study/materials/${id}`);
    setMaterials((prev) => prev.filter((x) => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const genFlashcards = async () => {
    if (!topic) { toast.error("Diga o tema dos flashcards"); return; }
    setBusy((b) => ({ ...b, flash: true }));
    setCards([]); setRawFlash("");
    try {
      const { data } = await http.post("/study/flashcards", { session_id: sessionId, material_id: selected?.id, subject, topic, count: 6 });
      setRawFlash(data.response);
      const json = extractJson(data.response);
      if (json?.flashcards?.length) setCards(json.flashcards);
      else toast.info("A IA retornou texto livre. Rola pra ver.");
    } catch { toast.error("Não foi possível gerar os flashcards"); }
    finally { setBusy((b) => ({ ...b, flash: false })); }
  };

  const genMindmap = async () => {
    if (!topic) { toast.error("Diga o tema do mapa mental"); return; }
    setBusy((b) => ({ ...b, mind: true }));
    setMind(null); setRawMind("");
    try {
      const { data } = await http.post("/study/mindmap", { session_id: sessionId, subject, topic });
      setRawMind(data.response);
      const json = extractJson(data.response);
      if (json?.root) setMind(json);
      else toast.info("Mostrando texto original.");
    } catch { toast.error("Não foi possível gerar o mapa"); }
    finally { setBusy((b) => ({ ...b, mind: false })); }
  };

  return (
    <section className="study-central" data-testid="study-central-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CENTRAL DE ESTUDOS</div>
          <h1>Do caderno para o <em>Notebook inteligente.</em></h1>
          <p>Envie fotos, PDFs ou resumos. A IA transforma em flashcards e mapas mentais.</p>
        </div>
        <div className="diagnostic-orbit"><Notebook size={40} /></div>
      </div>

      <div className="sc-layout">
        <div className="sc-side">
          <div className="sc-uploader">
            <span className="eyebrow">NOVO MATERIAL</span>
            <label>Matéria</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="sc-subject-select">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <label>Título (opcional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Resumo de mitose" data-testid="sc-title-input" />
            <label className="sc-drop">
              <input type="file" accept="image/*,application/pdf,text/plain" onChange={(e) => onUpload(e.target.files?.[0])} data-testid="sc-file-input" />
              <UploadCloud size={22} />
              <strong>Arraste ou clique</strong>
              <span>JPG, PNG, WEBP ou PDF · até 12MB</span>
            </label>
            {uploading && <div className="sc-uploading" data-testid="sc-uploading"><Loader2 className="spin" size={16} /> Enviando…</div>}
          </div>

          <div className="sc-list">
            <span className="eyebrow">SEUS MATERIAIS</span>
            {materials.length === 0 && <p className="sc-empty">Envie seu primeiro caderno ou PDF.</p>}
            {materials.map((m) => (
              <button key={m.id} className={`sc-item ${selected?.id === m.id ? "selected" : ""}`} onClick={() => setSelected(m)} data-testid={`sc-material-${m.id}`}>
                <div className="sc-item-icon">{(m.content_type || "").startsWith("image/") ? <ImageIcon size={17} /> : <FileText size={17} />}</div>
                <div className="sc-item-body">
                  <strong>{m.title}</strong>
                  <span>{m.subject} · {Math.round((m.size || 0) / 1024)} KB</span>
                </div>
                <span className="sc-item-del" onClick={(e) => { e.stopPropagation(); removeMaterial(m.id); }} data-testid={`sc-delete-${m.id}`}><Trash2 size={15} /></span>
              </button>
            ))}
          </div>
        </div>

        <div className="sc-main">
          <div className="sc-tools">
            <div>
              <span className="eyebrow">TEMA PARA A IA</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Mitose e Meiose" data-testid="sc-topic-input" />
            </div>
            <div className="sc-tool-actions">
              <button className="tool-button" onClick={genFlashcards} disabled={busy.flash} data-testid="sc-generate-flashcards"><Sparkles size={16} /> {busy.flash ? "Gerando…" : "Gerar flashcards"}</button>
              <button className="tool-button ghost" onClick={genMindmap} disabled={busy.mind} data-testid="sc-generate-mindmap"><Wand2 size={16} /> {busy.mind ? "Gerando…" : "Gerar mapa mental"}</button>
            </div>
          </div>

          <div className="sc-panel">
            <span className="eyebrow"><Brain size={13} style={{ marginRight: 5 }} /> FLASHCARDS INTELIGENTES</span>
            {cards.length > 0 ? <FlashcardDeck cards={cards} /> : rawFlash ? <pre className="ai-result" data-testid="flashcards-raw">{rawFlash}</pre> : <p className="sc-empty">Escolha um tema e gere seus flashcards.</p>}
          </div>

          <div className="sc-panel">
            <span className="eyebrow"><Wand2 size={13} style={{ marginRight: 5 }} /> MAPA MENTAL</span>
            {mind ? <MindMap data={mind} /> : rawMind ? <pre className="ai-result" data-testid="mindmap-raw">{rawMind}</pre> : <p className="sc-empty">A IA monta um mapa hierárquico baseado no seu tema.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
