# EduBoost Pro — Product Requirements Document

## Original Problem Statement
Plataforma educacional adaptativa (Ensino Fundamental → Vestibular/Universitário) chamada EduBoost Pro. Versão Definitiva com onboarding adaptativo, Central de Estudos (upload + flashcards + mapa mental), Metacognição (Feynman áudio, metáforas, pegadinhas), Correção inteligente de redação por foto, Gestor de produtividade, Radar de Revisão (curva do esquecimento) e Duelo de Mentes.

## Target Personas
1. Aluno da Rede Pública — linguagem simples, cotidiano, foco ENEM.
2. Aluno de Instituto Federal / Técnico — rigor conceitual, aplicações reais.
3. Aluno de Escola Particular — foco Fuvest/Unicamp/ITA.

## Tech Stack
- Backend: FastAPI + Python + Motor + Emergentintegrations (GPT-5.6 Terra + OpenAI Whisper + Object Storage)
- Frontend: React 19 + CSS puro + Sonner + Lucide + Axios
- Storage: MongoDB + Emergent Object Storage

## Implemented (2026-02-15)
- Onboarding 3 passos + perfil persistido em Mongo + localStorage.
- Central de Estudos com upload, listagem, soft-delete e geradores de flashcards e mapa mental (JSON parseado).
- Feynman áudio (Whisper) + texto, metáforas, pegadinhas, TTS via speechSynthesis.
- Correção inteligente por foto (Vision GPT-5.6 Terra) — redação e discursiva.
- Planner (CRUD com checklist e urgência).
- Radar de Revisão (curva 1/3/7/14/30/60).
- Duelo de Mentes 3-rodadas.
- Biblioteca / Diagnóstico / Questões (personalizados pelo perfil).
- App.js refatorado em pages/components/lib.

## Backlog
### P1
- Extrair texto real de PDF/imagem para alimentar flashcards.
- Histórico de sessões Feynman.
- Exportar mapa mental como PNG.
### P2
- Duelo multiplayer.
- Sistema de conquistas.
- Foto de perfil no onboarding.

## Known Limitations
- TTS via speechSynthesis (nativo do navegador).
- material_id serve como contexto textual apenas (sem OCR/extract).
- Sem autenticação; identidade por session_id.
