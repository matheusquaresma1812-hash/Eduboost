import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BookOpen, ChevronRight, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { API } from "../lib/api";

const stages = ["Todos os níveis", "Fundamental 1", "Fundamental 2", "Ensino Médio", "ENEM", "Pré-vestibular"];
const subjects = ["Todas", "Matemática", "Português", "História", "Geografia", "Física", "Química", "Biologia", "Filosofia", "Sociologia", "Inglês", "Artes", "Educação Física"];
const areas = ["Todas as áreas", "Linguagens", "Matemática", "Ciências Humanas", "Ciências da Natureza"];

export default function Library({ setActive }) {
  const [stage, setStage] = useState("Todos os níveis");
  const [subject, setSubject] = useState("Todas");
  const [area, setArea] = useState("Todas as áreas");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axios.get(`${API}/library`).then(({ data }) => setItems(data.items)).catch(() => toast.error("Não foi possível carregar a biblioteca"));
  }, []);

  const filtered = useMemo(() =>
    items.filter((x) => (stage === "Todos os níveis" || x.stage === stage)
      && (subject === "Todas" || x.subject === subject)
      && (area === "Todas as áreas" || x.area === area)
      && `${x.title} ${x.subject} ${x.description}`.toLowerCase().includes(search.toLowerCase()))
    , [items, stage, subject, area, search]);

  return (
    <section className="library-page" data-testid="library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">BIBLIOTECA UNIVERSAL</div>
          <h1>Encontre seu próximo <em>salto.</em></h1>
          <p>Conteúdo autoral inspirado nas coleções PNLD/FNDE e Moderna Plus.</p>
        </div>
        <div className="heading-art"><BookOpen size={38} /><span>+ 240 aulas<br />em construção</span></div>
      </div>

      <div className="search-row">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar uma aula, tema ou matéria" data-testid="library-search-input" /></div>
        <button className="filter-button" onClick={() => document.querySelector('[data-testid="library-area-filters"]')?.scrollIntoView({ behavior: "smooth", block: "center" })} data-testid="library-filter-button"><Filter size={17} /> Filtros</button>
      </div>

      <div className="filter-scroll">{stages.map((x) => <button className={stage === x ? "chip selected" : "chip"} onClick={() => setStage(x)} key={x} data-testid={`stage-filter-${x.toLowerCase().replaceAll(" ", "-")}`}>{x}</button>)}</div>

      <div className="area-filter" data-testid="library-area-filters">
        <span className="eyebrow">ÁREAS DE CONHECIMENTO</span>
        {areas.map((x) => <button className={area === x ? "area-chip selected" : "area-chip"} onClick={() => setArea(x)} key={x} data-testid={`area-filter-${x.toLowerCase().replaceAll(" ", "-")}`}>{x}</button>)}
      </div>

      <div className="section-head">
        <div><span className="eyebrow">CURADORIA PARA VOCÊ</span><h2>Continue explorando</h2></div>
        <div className="subject-tabs">{subjects.map((x) => <button className={subject === x ? "subject-tab selected" : "subject-tab"} onClick={() => setSubject(x)} key={x} data-testid={`subject-filter-${x.toLowerCase()}`}>{x}</button>)}</div>
      </div>

      <div className="library-grid">
        {filtered.map((item) => (
          <article className="study-card" key={item.id} data-testid={`library-card-${item.id}`}>
            <div className={`card-art ${item.color}`}><span>{item.subject}</span><BookOpen size={28} /><strong>{item.title}</strong></div>
            <div className="study-body">
              <div className="study-meta"><span>{item.stage}</span><span>{item.lessons} aulas</span></div>
              <p>{item.description}</p>
              <div className="progress-label"><span>{item.progress ? `${item.progress}% concluído` : "Comece agora"}</span><b>{item.progress}%</b></div>
              <div className="progress-track"><i style={{ width: `${item.progress}%` }} /></div>
              <button onClick={() => { setActive("Minha trilha"); toast.success("Aula adicionada à sua trilha"); }} data-testid={`library-start-${item.id}`}>{item.progress ? "Continuar aula" : "Adicionar à trilha"}<ChevronRight size={16} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
