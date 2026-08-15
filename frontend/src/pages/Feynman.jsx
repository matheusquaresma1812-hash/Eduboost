import { useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, MicVocal, Square, Sparkles, Volume2, Wand2, AlertTriangle } from "lucide-react";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

function speak(text) {
  if (!window.speechSynthesis) { toast.error("Seu navegador não suporta síntese de voz"); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

function Recorder({ onFinish }) {
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onFinish(blob);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast.error("Permita o acesso ao microfone para gravar");
    }
  };

  const stop = () => {
    if (!mediaRef.current) return;
    mediaRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  };

  return (
    <div className="recorder" data-testid="feynman-recorder">
      {!recording ? (
        <button className="rec-btn" onClick={start} data-testid="rec-start"><Mic size={20} /> Gravar explicação</button>
      ) : (
        <button className="rec-btn stop" onClick={stop} data-testid="rec-stop"><Square size={16} /> Parar ({seconds}s)</button>
      )}
      {recording && <div className="rec-wave"><span /><span /><span /><span /><span /></div>}
    </div>
  );
}

export default function Feynman() {
  const [profile] = useProfile();
  const [topic, setTopic] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [mode, setMode] = useState("audio");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [metaphor, setMetaphor] = useState("");
  const [pitfalls, setPitfalls] = useState("");
  const [subject, setSubject] = useState(profile?.focus_subjects?.[0] || "Matemática");

  const submitAudio = async (blob) => {
    if (!topic) { toast.error("Digite o tópico antes de gravar"); return; }
    const fd = new FormData();
    fd.append("session_id", profile?.session_id || "");
    fd.append("topic", topic);
    fd.append("confidence", String(confidence));
    fd.append("audio", blob, "recording.webm");
    setBusy(true);
    setTranscript(""); setFeedback("");
    try {
      const { data } = await http.post("/metacog/audio", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setTranscript(data.transcript);
      setFeedback(data.feedback);
      toast.success("Explicação analisada!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Falha ao processar áudio");
    } finally { setBusy(false); }
  };

  const submitText = async () => {
    if (!topic || !text) { toast.error("Preencha o tópico e sua explicação"); return; }
    setBusy(true); setFeedback("");
    try {
      const { data } = await http.post("/metacog/feynman", { session_id: profile?.session_id, topic, explanation: text, confidence });
      setFeedback(data.response);
    } catch { toast.error("Não foi possível analisar agora"); }
    finally { setBusy(false); }
  };

  const genMetaphor = async () => {
    if (!topic) { toast.error("Digite o tópico"); return; }
    setMetaphor("...gerando");
    try {
      const { data } = await http.post("/metacog/metaphor", { session_id: profile?.session_id, topic });
      setMetaphor(data.response);
    } catch { setMetaphor(""); toast.error("Falha ao gerar metáforas"); }
  };

  const genPitfalls = async () => {
    if (!topic) { toast.error("Digite o tópico"); return; }
    setPitfalls("...gerando");
    try {
      const { data } = await http.post("/metacog/pitfalls", { session_id: profile?.session_id, subject, topic });
      setPitfalls(data.response);
    } catch { setPitfalls(""); toast.error("Falha ao gerar pegadinhas"); }
  };

  return (
    <section className="feynman-page" data-testid="feynman-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MÉTODO FEYNMAN</div>
          <h1>Ensine, valide, <em>domine.</em></h1>
          <p>Explique o conteúdo com suas palavras. A IA transcreve, aponta lacunas e sugere metáforas.</p>
        </div>
        <div className="diagnostic-orbit"><MicVocal size={40} /></div>
      </div>

      <div className="feyn-layout">
        <div className="feyn-form">
          <span className="eyebrow">CONFIGURE A SESSÃO</span>
          <label>Matéria</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="feyn-subject-select">
            {["Matemática", "Português", "História", "Geografia", "Física", "Química", "Biologia", "Filosofia", "Sociologia", "Inglês", "Redação"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <label>Tópico</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex: Lei de Ohm, fotossíntese, orações subordinadas" data-testid="feyn-topic-input" />
          <label>Sua confiança agora (1-5)</label>
          <input type="range" min={1} max={5} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} data-testid="feyn-confidence" />
          <div className="feyn-confidence-value">{confidence}/5</div>

          <div className="feyn-mode">
            <button className={mode === "audio" ? "level selected" : "level"} onClick={() => setMode("audio")} data-testid="feyn-mode-audio">Áudio</button>
            <button className={mode === "texto" ? "level selected" : "level"} onClick={() => setMode("texto")} data-testid="feyn-mode-text">Texto</button>
          </div>

          {mode === "audio" ? (
            <Recorder onFinish={submitAudio} />
          ) : (
            <>
              <label>Explique com suas palavras</label>
              <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Comece explicando como se fosse pra um aluno mais novo…" data-testid="feyn-text-input" />
              <button className="primary-button full" onClick={submitText} disabled={busy} data-testid="feyn-text-submit"><Sparkles size={16} /> {busy ? "Analisando…" : "Analisar minha explicação"}</button>
            </>
          )}

          <div className="feyn-tools">
            <button className="tool-button ghost" onClick={genMetaphor} data-testid="feyn-metaphor"><Wand2 size={15} /> Botão metáforas</button>
            <button className="tool-button ghost" onClick={genPitfalls} data-testid="feyn-pitfalls"><AlertTriangle size={15} /> Simular pegadinhas</button>
          </div>
        </div>

        <div className="feyn-result">
          <span className="eyebrow">FEEDBACK DA IA</span>
          {busy && <p className="sc-empty">Processando…</p>}
          {transcript && (
            <div className="feyn-block">
              <strong>Sua transcrição</strong>
              <p data-testid="feyn-transcript">{transcript}</p>
            </div>
          )}
          {feedback && (
            <div className="feyn-block">
              <div className="feyn-block-head">
                <strong>Avaliação</strong>
                <button className="text-button" onClick={() => speak(feedback)} data-testid="feyn-speak"><Volume2 size={14} /> Ouvir</button>
              </div>
              <pre className="ai-result" data-testid="feyn-feedback">{feedback}</pre>
            </div>
          )}
          {metaphor && (
            <div className="feyn-block">
              <strong>Metáforas do dia a dia</strong>
              <pre className="ai-result" data-testid="feyn-metaphor-result">{metaphor}</pre>
            </div>
          )}
          {pitfalls && (
            <div className="feyn-block">
              <strong>Pegadinhas comuns</strong>
              <pre className="ai-result" data-testid="feyn-pitfalls-result">{pitfalls}</pre>
            </div>
          )}
          {!busy && !transcript && !feedback && !metaphor && !pitfalls && <p className="sc-empty">Comece configurando o tema e gravando a explicação.</p>}
        </div>
      </div>
    </section>
  );
}
