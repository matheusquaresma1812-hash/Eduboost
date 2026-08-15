# EduBoost Pro — PRD

## Problema original
Criar uma plataforma educacional inteligente, adaptativa e organizada do ensino fundamental ao vestibular/universitário, com biblioteca, diagnóstico, trilhas e banco de questões.

## Arquitetura
- Frontend React com navegação por áreas, CSS responsivo e chamadas pela REACT_APP_BACKEND_URL.
- Backend FastAPI com endpoints de biblioteca, diagnóstico e questões.
- MongoDB disponível para persistência futura; respostas atuais usam modelos Pydantic e não expõem _id.
- Tutoria via Emergent LLM usando GPT 5.6 Terra com streaming interno; conteúdo demonstrativo é autoral.

## Personas
- Aluno do Fundamental ao pré-vestibular que precisa de clareza e ritmo personalizado.
- Estudante que quer praticar questões e entender o passo a passo.

## Requisitos principais
- Biblioteca filtrável por etapa e matéria.
- Diagnóstico escolar com geração de trilha adaptada.
- Banco de questões autorais com resolução detalhada.
- Seletor completo de etapas escolares.
- Interface acolhedora, responsiva e com estados de carregamento/erro.

## Implementado — 15/08/2026
- Dashboard inicial com foco do dia, constância semanal e sugestões.
- Biblioteca universal com 6 módulos demonstrativos, busca, filtros e progresso.
- Diagnóstico com seleção de fase, matéria e confiança, integrado à IA.
- Banco de questões com níveis e tema configuráveis, integrado à IA.
- Fallback autoral controlado para manter a prática disponível quando o provedor estiver sem orçamento.
- Navegação mobile e test IDs nos elementos críticos.

## Backlog priorizado
- P0: Persistir perfil, progresso, trilhas e questões respondidas no MongoDB.
- P1: Gestor de trabalhos, provas, prazos e checklist de matérias.
- P1: Histórico de diagnósticos e adaptação automática da trilha.
- P1: Resolver questão com seleção de alternativa e feedback por alternativa.
- P2: Importação de materiais autorizados e alinhamento com sumários PNLD.

## Próximas tarefas
1. Criar perfil escolar persistente e onboarding.
2. Adicionar calendário de trabalhos e provas.
3. Implementar respostas de questões com pontuação e revisão.
4. Expandir a biblioteca autoral por matéria e etapa.

## Atualização visual — 15/08/2026
- Substituída a identidade roxo/lavanda por azul-petróleo e verde-menta em botões, navegação, painéis, destaques e superfícies.
- Atualizado o símbolo da marca para um ícone de formatura, reforçando o posicionamento educacional.
- Contraste e responsividade mobile verificados após a mudança.
