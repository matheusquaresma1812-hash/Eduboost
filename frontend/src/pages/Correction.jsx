import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ScrollText, Sparkles, Upload } from "lucide-react";
import { http } from "../lib/api";
import { useProfile } from "../lib/profile";

export default function Correction() {
  const [profile] = useProfile();
  const [kind, setKind] = useState("redacao");
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState(null);
  const [fileObj, setFileObj] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const inputRef = useRef();

  const onFile = (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Envie JPG, PNG ou WEBP"); return; }
    setFileObj(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const submit = async () => {
    if (!fileObj) { toast.error("Envie a foto primeiro"); return; }
    const fd = new FormData();
    fd.append("session_id", profile?.session_id || "");
    fd.append("kind", kind);
    fd.append("prompt_context", prompt);
    fd.append("image", fileObj);
    setBusy(true); setResult("");
    try {
      const { data } = await http.post("/correction/essay", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data.response);
      toast.success("Correção gerada");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Falha na correção");
    } finally { setBusy(false); }
  };

  return (
    <section className="correction-page" data-testid="correction-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CORREÇÃO INTELIGENTE</div>
          <h1>Foto do caderno, <em>correção passo a passo.</em></h1>
          <p>Redações (nota estimada por competência) e questões discursivas manuscritas.</p>
        </div>
        <div className="diagnostic-orbit"><ScrollText size={40} /></div>
      </div>

      <div className="corr-layout">
        <div className="corr-form">
          <span className="eyebrow">O QUE VOU CORRIGIR?</span>
          <div className="level-row">
            <button className={kind === "redacao" ? "level selected" : "level"} onClick={() => setKind("redacao")} data-testid="corr-kind-redacao">Redação (ENEM)</button>
            <button className={kind === "discursiva" ? "level selected" : "level"} onClick={() => setKind("discursiva")} data-testid="corr-kind-discursiva">Questão discursiva</button>
          </div>
          <label>Tema ou enunciado (opcional)</label>
          <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={kind === "redacao" ? "Ex: Os desafios da mobilidade urbana no Brasil" : "Ex: Explique a Lei de Ohm em termos de circuitos residenciais"} data-testid="corr-prompt-input" />

          <div className="corr-drop">
            <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} data-testid="corr-file-input" />
            {preview ? (
              <img src={preview} alt="preview" data-testid="corr-preview" />
            ) : (
              <div className="corr-empty">
                <Camera size={22} />
                <strong>Envie a foto</strong>
                <span>Tire uma foto legível da folha</span>
              </div>
            )}
          </div>

          <div className="corr-actions">
            <button className="tool-button ghost" onClick={() => inputRef.current?.click()} data-testid="corr-choose"><Upload size={15} /> Trocar imagem</button>
            <button className="primary-button" onClick={submit} disabled={busy} data-testid="corr-submit"><Sparkles size={16} /> {busy ? "Corrigindo…" : "Corrigir agora"}</button>
          </div>
        </div>

        <div className="corr-result">
          <span className="eyebrow">PARECER DA IA</span>
          {busy && <p className="sc-empty">A IA está lendo sua imagem…</p>}
          {!busy && !result && <p className="sc-empty">O parecer aparece aqui com nota estimada e sugestões.</p>}
          {result && <pre className="ai-result" data-testid="corr-result">{result}</pre>}
        </div>
      </div>
    </section>
  );
}
