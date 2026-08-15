import { BookOpen, BrainCircuit, ChevronRight, MicVocal, Notebook, Radar, ScrollText, Sparkles, Swords, Target } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "../lib/profile";

export default function Dashboard({ setActive }) {
  const [profile] = useProfile();
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const name = (profile?.name || "estudante").split(" ")[0];
  return (
    <section className="dashboard" data-testid="dashboard-page">
      <div className="welcome">
        <div>
          <div className="eyebrow">{today.toUpperCase()}</div>
          <h1>Olá, {name}. <em>Vamos avançar?</em></h1>
          <p>Seu ecossistema de estudos está pronto. Escolha por onde começar.</p>
        </div>
        <button className="primary-button" onClick={() => setActive("Central de estudos")} data-testid="welcome-central-button"><Notebook size={17} /> Abrir Central de estudos</button>
      </div>

      <div className="feature-bento">
        <button className="bento big" onClick={() => setActive("Central de estudos")} data-testid="bento-central">
          <div className="bento-icon"><Notebook size={22} /></div>
          <h3>Central de estudos</h3>
          <p>Suba fotos do caderno, PDFs e transforme em flashcards e mapas mentais.</p>
          <span className="bento-cta">Enviar material <ChevronRight size={15} /></span>
        </button>
        <button className="bento" onClick={() => setActive("Feynman")} data-testid="bento-feynman">
          <div className="bento-icon"><MicVocal size={20} /></div>
          <h3>Feynman por áudio</h3>
          <p>Explique o conteúdo, a IA transcreve e valida sua compreensão.</p>
        </button>
        <button className="bento" onClick={() => setActive("Correção")} data-testid="bento-correcao">
          <div className="bento-icon"><ScrollText size={20} /></div>
          <h3>Correção inteligente</h3>
          <p>Envie a foto da redação ou discursiva e receba correção passo a passo.</p>
        </button>
        <button className="bento" onClick={() => setActive("Radar")} data-testid="bento-radar">
          <div className="bento-icon"><Radar size={20} /></div>
          <h3>Radar de revisão</h3>
          <p>A curva do esquecimento te avisa quando revisar cada tópico.</p>
        </button>
        <button className="bento" onClick={() => setActive("Duelo")} data-testid="bento-duelo">
          <div className="bento-icon"><Swords size={20} /></div>
          <h3>Duelo de mentes</h3>
          <p>Responda rápido, ganhe pontos, veja o placar contra a IA.</p>
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="focus-panel">
          <div className="panel-top">
            <div><span className="eyebrow">FOCO DE HOJE</span><h2>Continue de onde parou</h2></div>
            <span className="duration">15 min</span>
          </div>
          <div className="focus-content">
            <div className="focus-cover"><BrainCircuit size={34} /><span>MATEMÁTICA</span></div>
            <div>
              <h3>Frações no dia a dia</h3>
              <p>Entenda partes, inteiros e como comparar frações com facilidade.</p>
              <button className="text-button" onClick={() => toast.success("Aula iniciada")} data-testid="start-focus-button">Começar aula <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
        <div className="progress-panel">
          <span className="eyebrow">SUA SEMANA</span>
          <h2>Constância vence pressa.</h2>
          <div className="week">
            <div className="days"><span>SEG</span><i className="done">✓</i><span>TER</span><i className="done">✓</i><span>QUA</span><i className="today">•</i><span>QUI</span><i>·</i><span>SEX</span><i>·</i></div>
          </div>
          <div className="percent"><strong>68%</strong><span>do seu objetivo semanal</span></div>
        </div>
      </div>

      <div className="lower-grid">
        <div>
          <div className="section-head compact"><div><span className="eyebrow">SUGESTÕES INTELIGENTES</span><h2>Para o seu momento</h2></div><button className="link-button" onClick={() => setActive("Biblioteca")} data-testid="see-all-library-button">Ver biblioteca <ChevronRight size={15} /></button></div>
          <div className="suggestions">
            <div className="suggestion blue"><Target size={22} /><span>Desafio rápido</span><strong>3 questões de lógica</strong><button onClick={() => setActive("Questões")} data-testid="quick-challenge-button">Resolver agora <ChevronRight size={15} /></button></div>
            <div className="suggestion coral"><Sparkles size={22} /><span>Trilha recomendada</span><strong>Português sem medo</strong><button onClick={() => setActive("Minha trilha")} data-testid="recommended-trail-button">Ver trilha <ChevronRight size={15} /></button></div>
          </div>
        </div>
        <div className="quote">
          <span>“</span>
          <p>Aprender não é chegar mais rápido. É perceber que você consegue ir mais longe.</p>
          <small>— seu espaço de estudos</small>
        </div>
      </div>
    </section>
  );
}
