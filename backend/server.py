from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Response, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import base64
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, ImageContent
from emergentintegrations.llm.openai import OpenAISpeechToText

from storage import init_storage, put_object, get_object, APP_NAME

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Profile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    name: str = "Estudante"
    grade: str
    institution_type: Literal["publica", "federal", "particular"] = "publica"
    focus_subjects: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProfileCreate(BaseModel):
    session_id: str
    name: Optional[str] = "Estudante"
    grade: str
    institution_type: Literal["publica", "federal", "particular"]
    focus_subjects: List[str] = []


class DiagnosticRequest(BaseModel):
    session_id: Optional[str] = None
    grade: str
    focus: str
    confidence: str


class QuestionRequest(BaseModel):
    session_id: Optional[str] = None
    subject: str
    level: str
    topic: str


class FlashcardRequest(BaseModel):
    session_id: Optional[str] = None
    material_id: Optional[str] = None
    topic: str
    subject: str
    count: int = 6


class MindmapRequest(BaseModel):
    session_id: Optional[str] = None
    topic: str
    subject: str


class FeynmanRequest(BaseModel):
    session_id: Optional[str] = None
    topic: str
    explanation: str
    confidence: int = 3


class MetaphorRequest(BaseModel):
    session_id: Optional[str] = None
    topic: str


class PitfallRequest(BaseModel):
    session_id: Optional[str] = None
    subject: str
    topic: str


class PlannerTaskCreate(BaseModel):
    session_id: str
    title: str
    subject: str
    kind: Literal["prova", "trabalho", "revisao", "outro"] = "trabalho"
    due_date: str  # ISO date
    checklist: List[str] = []


class PlannerTaskUpdate(BaseModel):
    completed_items: List[str] = []
    done: bool = False


class RevisionCreate(BaseModel):
    session_id: str
    topic: str
    subject: str
    difficulty: Literal["facil", "medio", "dificil"] = "medio"


class RevisionReview(BaseModel):
    outcome: Literal["ok", "duvida", "erro"]


class DuelStart(BaseModel):
    session_id: Optional[str] = None
    subject: str
    level: str = "Intermediário"


class AiResponse(BaseModel):
    response: str
    model: str


# ---------- AI helpers ----------
AI_MODEL = "gpt-5.6-terra"


def profile_context(profile: Optional[dict]) -> str:
    if not profile:
        return ""
    inst = profile.get("institution_type", "publica")
    tone = {
        "publica": "linguagem simples e acolhedora, com muitos exemplos do dia a dia, cotidiano brasileiro, e foco no ENEM.",
        "federal": "linguagem técnica e aprofundada como em Institutos Federais / colégios técnicos, com rigor conceitual e conexões com aplicações práticas.",
        "particular": "linguagem exigente de escola particular preparatória para vestibulares tradicionais (Fuvest, Unicamp, ITA), com profundidade acadêmica.",
    }.get(inst, "")
    grade = profile.get("grade", "")
    focus = ", ".join(profile.get("focus_subjects", []) or [])
    parts = [f"O aluno está em {grade}.", f"Perfil de instituição: {inst}. Use {tone}"]
    if focus:
        parts.append(f"Matérias em foco: {focus}.")
    return " ".join(parts)


async def run_ai(prompt: str, session: str, profile: Optional[dict] = None,
                 image_b64: Optional[str] = None) -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Integração de IA não configurada")
    ctx = profile_context(profile)
    system = (
        "Você é um tutor brasileiro especialista, acolhedor e direto ao ponto. "
        "Responda sempre em português do Brasil. Use resumos visuais, metáforas do dia a dia, passos curtos e exemplos práticos. "
        "Nunca copie material protegido; sempre gere conteúdo autoral inspirado no PNLD/FNDE e coleções como Moderna Plus. "
        f"{ctx}"
    )
    try:
        chat = LlmChat(api_key=key, session_id=session, system_message=system).with_model("openai", AI_MODEL)
        message_kwargs = {"text": prompt}
        if image_b64:
            message_kwargs["file_contents"] = [ImageContent(image_base64=image_b64)]
        result = []
        async for event in chat.stream_message(UserMessage(**message_kwargs)):
            if isinstance(event, TextDelta):
                result.append(event.content)
        return "".join(result)
    except Exception as exc:
        logger.warning("Falha na IA: %s", exc)
        raise HTTPException(status_code=503, detail="A tutoria inteligente está temporariamente indisponível") from exc


async def get_profile(session_id: Optional[str]) -> Optional[dict]:
    if not session_id:
        return None
    return await db.profiles.find_one({"session_id": session_id}, {"_id": 0})


# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"message": "EduBoost Pro API online", "version": "2.0"}


# ---------- Library (already existed) ----------
LIBRARY = [
    {"id": "math-f1", "subject": "Matemática", "stage": "Fundamental 1", "color": "sun", "title": "Números que contam histórias", "description": "Operações, problemas e raciocínio lógico com exemplos do cotidiano.", "progress": 72, "lessons": 8},
    {"id": "port-f2", "subject": "Português", "stage": "Fundamental 2", "color": "coral", "title": "Leitura com intenção", "description": "Compreensão textual, gramática aplicada e produção de ideias.", "progress": 38, "lessons": 12},
    {"id": "bio-em", "subject": "Biologia", "stage": "Ensino Médio", "color": "mint", "title": "A vida em sistemas", "description": "Ecologia, células e genética explicadas de forma visual.", "progress": 16, "lessons": 10},
    {"id": "enem-mat", "subject": "Matemática", "stage": "ENEM", "color": "blue", "title": "Matemática para o ENEM", "description": "Estratégias para interpretar e resolver problemas de alto rendimento.", "progress": 0, "lessons": 14},
    {"id": "hist-em", "subject": "História", "stage": "Ensino Médio", "color": "amber", "title": "Brasil em movimento", "description": "Conexões entre passado, sociedade e os temas que caem nas provas.", "progress": 54, "lessons": 9},
    {"id": "fis-pre", "subject": "Física", "stage": "Pré-vestibular", "color": "violet", "title": "Energia em ação", "description": "Cinemática, dinâmica e energia com aplicações simples e diretas.", "progress": 0, "lessons": 11},
]
EXTRA_SUBJECTS = [
    ("Geografia", "Ciências Humanas", "mapa", "blue", "Territórios e paisagens", "Leia o mundo pelas relações entre espaço, natureza e sociedade."),
    ("Química", "Ciências da Natureza", "átomo", "mint", "A matéria por dentro", "Descubra átomos, misturas e transformações em situações reais."),
    ("Filosofia", "Ciências Humanas", "ideia", "violet", "Pensar é investigar", "Perguntas clássicas para construir argumentos mais claros."),
    ("Sociologia", "Ciências Humanas", "sociedade", "coral", "A vida em coletivo", "Observe cultura, trabalho e desigualdade com olhar crítico."),
    ("Inglês", "Linguagens", "words", "blue", "English for real life", "Vocabulário e leitura para entender textos do cotidiano."),
    ("Artes", "Linguagens", "criação", "amber", "Ver, criar e sentir", "Arte, repertório e expressão em diferentes tempos e culturas."),
    ("Educação Física", "Linguagens", "movimento", "mint", "Corpo em movimento", "Saúde, esporte e consciência corporal para todas as idades."),
]
for subject, area, topic, color, title, description in EXTRA_SUBJECTS:
    for stage, suffix in [("Fundamental 1", "Descobertas"), ("Ensino Médio", "Conexões"), ("ENEM", "Revisão")]:
        LIBRARY.append({"id": f"{subject.lower().replace(' ', '-')}-{stage.lower().replace(' ', '-')}", "subject": subject, "area": area, "stage": stage, "color": color, "title": f"{title} · {suffix}", "description": description, "progress": 0, "lessons": 8})
for item in LIBRARY:
    item.setdefault("area", "Matemática" if item["subject"] == "Matemática" else "Linguagens" if item["subject"] in ["Português", "Inglês", "Artes", "Educação Física"] else "Ciências Humanas" if item["subject"] in ["História", "Geografia", "Filosofia", "Sociologia"] else "Ciências da Natureza")


@api_router.get("/library")
async def get_library(stage: Optional[str] = None, subject: Optional[str] = None):
    items = [x for x in LIBRARY if (not stage or x["stage"] == stage) and (not subject or x["subject"] == subject)]
    return {"items": items, "total": len(items)}


# ---------- Onboarding / Profile ----------
@api_router.post("/profile")
async def upsert_profile(payload: ProfileCreate):
    doc = Profile(**payload.model_dump()).model_dump()
    await db.profiles.update_one(
        {"session_id": payload.session_id},
        {"$set": doc},
        upsert=True,
    )
    return doc


@api_router.get("/profile/{session_id}")
async def get_profile_endpoint(session_id: str):
    doc = await db.profiles.find_one({"session_id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return doc


# ---------- Diagnostic / Questions ----------
@api_router.post("/diagnostic", response_model=AiResponse)
async def create_diagnostic(payload: DiagnosticRequest):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"Crie uma trilha personalizada com 3 etapas (semanas) para um aluno da fase {payload.grade}, "
        f"foco em {payload.focus}, autoconfiança '{payload.confidence}'. "
        "Retorne: 1) um título curto motivador; 2) objetivo da semana; 3) três ações práticas com estimativa de tempo. "
        "Formato em texto simples com títulos claros."
    )
    text = await run_ai(prompt, f"diagnostic-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


@api_router.post("/questions", response_model=AiResponse)
async def create_question(payload: QuestionRequest):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"Crie uma questão autoral de {payload.subject}, nível {payload.level}, sobre {payload.topic}. "
        "Inclua enunciado, 4 alternativas (A-D), gabarito e resolução passo a passo explicando por que cada alternativa está certa ou errada. "
        "Use linguagem clara, adequada ao perfil do aluno."
    )
    try:
        text = await run_ai(prompt, f"question-{uuid.uuid4()}", profile)
        return {"response": text, "model": "GPT 5.6 Terra"}
    except HTTPException:
        fallback = (
            f"QUESTÃO AUTORAL · {payload.subject.upper()}\n\n"
            f"Uma situação prática sobre {payload.topic} pede que você escolha a melhor estratégia. Qual alternativa representa o raciocínio correto?\n\n"
            "A) Aplicar uma regra sem observar os dados.\n"
            f"B) Identificar dados, escolher o conceito de {payload.topic} e conferir o resultado.\n"
            "C) Ignorar a unidade de medida.\n"
            "D) Escolher a alternativa mais longa.\n\nGABARITO: B\n"
        )
        return {"response": fallback, "model": "Trilha autoral EduBoost"}


# ---------- Study Central: uploads ----------
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"}
MAX_UPLOAD_MB = 12


@api_router.post("/study/upload")
async def study_upload(
    session_id: str = Form(...),
    subject: str = Form("Geral"),
    title: str = Form("Material"),
    file: UploadFile = File(...),
):
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado. Envie JPG, PNG, WEBP ou PDF.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Arquivo maior que {MAX_UPLOAD_MB}MB")
    ext = (file.filename or "file").split(".")[-1].lower()
    material_id = str(uuid.uuid4())
    path = f"{APP_NAME}/materials/{session_id}/{material_id}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as exc:
        logger.error("Storage upload failed: %s", exc)
        raise HTTPException(status_code=503, detail="Não foi possível salvar o arquivo. Tente novamente.")
    record = {
        "id": material_id,
        "session_id": session_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result["size"],
        "subject": subject,
        "title": title,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.materials.insert_one(record)
    return {k: v for k, v in record.items() if k != "_id"}


@api_router.get("/study/materials/{session_id}")
async def list_materials(session_id: str):
    docs = await db.materials.find(
        {"session_id": session_id, "is_deleted": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return {"items": docs}


@api_router.delete("/study/materials/{material_id}")
async def delete_material(material_id: str):
    await db.materials.update_one({"id": material_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


@api_router.get("/study/file/{material_id}")
async def download_material(material_id: str):
    doc = await db.materials.find_one({"id": material_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    data, ct = get_object(doc["storage_path"])
    return Response(content=data, media_type=doc.get("content_type", ct))


# ---------- Study Central: flashcards & mindmap ----------
@api_router.post("/study/flashcards", response_model=AiResponse)
async def generate_flashcards(payload: FlashcardRequest):
    profile = await get_profile(payload.session_id)
    material_hint = ""
    if payload.material_id:
        mat = await db.materials.find_one({"id": payload.material_id, "is_deleted": False}, {"_id": 0})
        if mat:
            material_hint = f" Baseie-se no material '{mat['title']}' da matéria {mat['subject']}."
    prompt = (
        f"Gere {payload.count} flashcards no formato JSON estrito sobre '{payload.topic}' de {payload.subject}.{material_hint} "
        'Retorne SOMENTE JSON válido com o formato: {"flashcards":[{"front":"pergunta","back":"resposta","hint":"dica curta"}]} '
        "As perguntas devem ser objetivas, ao estilo Anki, cobrindo conceitos-chave, definições, exemplos e armadilhas comuns."
    )
    text = await run_ai(prompt, f"flash-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


@api_router.post("/study/mindmap", response_model=AiResponse)
async def generate_mindmap(payload: MindmapRequest):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"Crie um mapa mental hierárquico sobre '{payload.topic}' de {payload.subject}. "
        'Retorne SOMENTE JSON válido no formato: {"root":"tema central","branches":[{"label":"ramo 1","children":["sub-tópico","sub-tópico"]}]} '
        "Use 4 a 6 ramos principais, cada um com 2 a 4 sub-tópicos objetivos."
    )
    text = await run_ai(prompt, f"mind-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


# ---------- Metacognition ----------
@api_router.post("/metacog/feynman", response_model=AiResponse)
async def feynman_check(payload: FeynmanRequest):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"O aluno está usando o Método Feynman. Ele está tentando explicar '{payload.topic}' com suas próprias palavras. "
        f"Autoavaliação de confiança: {payload.confidence}/5.\n\n"
        f"Explicação do aluno:\n\"\"\"\n{payload.explanation}\n\"\"\"\n\n"
        "Avalie a explicação de forma acolhedora, apontando: 1) o que está correto (com elogio breve), "
        "2) lacunas ou imprecisões específicas, 3) uma analogia do dia a dia que preencha essas lacunas, "
        "4) uma pergunta socrática que ajude o aluno a aprofundar. "
        "Ao final, dê uma nota de compreensão de 0 a 10 e diga se recomenda revisar."
    )
    text = await run_ai(prompt, f"feyn-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


@api_router.post("/metacog/audio")
async def feynman_audio(
    session_id: Optional[str] = Form(None),
    topic: str = Form(...),
    confidence: int = Form(3),
    audio: UploadFile = File(...),
):
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Integração de STT não configurada")
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Áudio vazio")
    if len(audio_bytes) > 24 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Áudio maior que 24MB")
    try:
        stt = OpenAISpeechToText(api_key=key)
        filename = audio.filename or "recording.webm"
        buf = io.BytesIO(audio_bytes)
        buf.name = filename
        transcript_resp = await stt.transcribe(file=buf, model="whisper-1", response_format="json", language="pt")
        transcript_text = transcript_resp.text if hasattr(transcript_resp, "text") else str(transcript_resp)
    except Exception as exc:
        logger.warning("Whisper failed: %s", exc)
        raise HTTPException(status_code=503, detail="Não foi possível transcrever o áudio agora.")
    profile = await get_profile(session_id)
    feedback = await run_ai(
        f"Método Feynman por áudio. Tópico: '{topic}'. Confiança do aluno: {confidence}/5.\n\n"
        f"Transcrição:\n\"\"\"\n{transcript_text}\n\"\"\"\n\n"
        "Avalie de modo acolhedor: 1) o que ele acertou; 2) lacunas específicas; "
        "3) analogia do dia a dia; 4) pergunta socrática para aprofundar. "
        "Dê nota 0-10 e diga se deve revisar.",
        f"feyn-audio-{uuid.uuid4()}",
        profile,
    )
    return {"transcript": transcript_text, "feedback": feedback, "model": "Whisper-1 + GPT 5.6 Terra"}


@api_router.post("/metacog/metaphor", response_model=AiResponse)
async def metaphor_helper(payload: MetaphorRequest):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"Explique '{payload.topic}' usando 2 metáforas distintas do dia a dia brasileiro. "
        "Cada metáfora deve ter 3 frases curtas: 1) a analogia; 2) por que ela funciona; 3) onde a analogia falha (armadilha)."
    )
    text = await run_ai(prompt, f"meta-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


@api_router.post("/metacog/pitfalls", response_model=AiResponse)
async def pitfalls_generator(payload: PitfallRequest):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"Liste 4 pegadinhas clássicas de {payload.subject} sobre '{payload.topic}' que costumam derrubar alunos em provas. "
        "Para cada uma: 1) exemplo de enunciado curto; 2) armadilha típica; 3) forma correta de evitar. "
        "Formato: texto simples numerado."
    )
    text = await run_ai(prompt, f"pit-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


# ---------- Essay / Handwriting correction (Vision) ----------
@api_router.post("/correction/essay")
async def correct_essay(
    session_id: Optional[str] = Form(None),
    kind: str = Form("redacao"),  # redacao | discursiva
    prompt_context: str = Form(""),
    image: UploadFile = File(...),
):
    content_type = image.content_type or "image/jpeg"
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Envie JPG, PNG ou WEBP")
    data = await image.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem maior que 8MB")
    b64 = base64.b64encode(data).decode("utf-8")
    profile = await get_profile(session_id)
    if kind == "redacao":
        prompt = (
            "Você é um corretor de redação do ENEM. Leia a imagem da redação manuscrita (ou digitada) e faça:\n"
            "1) Transcrição resumida dos parágrafos principais.\n"
            "2) Avaliação por competência (C1 a C5) com nota estimada de 0 a 200 em cada uma e justificativa curta.\n"
            "3) Nota final estimada (0-1000).\n"
            "4) 3 sugestões objetivas de melhoria.\n"
            f"Contexto/tema informado pelo aluno: {prompt_context or 'não informado'}"
        )
    else:
        prompt = (
            "Você é professor corrigindo uma questão discursiva. Leia a imagem manuscrita e faça:\n"
            "1) Transcrição da resposta do aluno.\n"
            "2) Análise passo a passo do raciocínio, apontando o que está correto e o que está errado.\n"
            "3) Resposta modelo curta.\n"
            "4) Nota estimada (0-10) e justificativa.\n"
            f"Enunciado/contexto: {prompt_context or 'não informado'}"
        )
    text = await run_ai(prompt, f"correct-{uuid.uuid4()}", profile, image_b64=b64)
    return {"response": text, "model": "GPT 5.6 Terra Vision"}


# ---------- Planner ----------
@api_router.post("/planner/task")
async def create_task(payload: PlannerTaskCreate):
    task = {
        "id": str(uuid.uuid4()),
        "session_id": payload.session_id,
        "title": payload.title,
        "subject": payload.subject,
        "kind": payload.kind,
        "due_date": payload.due_date,
        "checklist": [{"id": str(uuid.uuid4()), "text": item, "done": False} for item in payload.checklist],
        "done": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(task)
    return {k: v for k, v in task.items() if k != "_id"}


@api_router.get("/planner/tasks/{session_id}")
async def list_tasks(session_id: str):
    docs = await db.tasks.find({"session_id": session_id}, {"_id": 0}).sort("due_date", 1).to_list(500)
    return {"items": docs}


@api_router.patch("/planner/task/{task_id}")
async def update_task(task_id: str, payload: dict):
    update = {}
    if "done" in payload:
        update["done"] = bool(payload["done"])
    if "checklist" in payload:
        update["checklist"] = payload["checklist"]
    if update:
        await db.tasks.update_one({"id": task_id}, {"$set": update})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return doc or {}


@api_router.delete("/planner/task/{task_id}")
async def delete_task(task_id: str):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ---------- Revision Radar (Forgetting Curve) ----------
CURVE_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]


def next_due_after(step: int) -> str:
    """Schedule next review after a successful review at the given step."""
    idx = min(step, len(CURVE_INTERVALS_DAYS) - 1)
    days = CURVE_INTERVALS_DAYS[idx]
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


@api_router.post("/revision/topic")
async def add_revision_topic(payload: RevisionCreate):
    # New topics are immediately due — the first review is right now.
    item = {
        "id": str(uuid.uuid4()),
        "session_id": payload.session_id,
        "topic": payload.topic,
        "subject": payload.subject,
        "difficulty": payload.difficulty,
        "step": 0,
        "next_due": datetime.now(timezone.utc).isoformat(),
        "history": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.revisions.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}


@api_router.get("/revision/topics/{session_id}")
async def list_revision(session_id: str):
    docs = await db.revisions.find({"session_id": session_id}, {"_id": 0}).sort("next_due", 1).to_list(500)
    now = datetime.now(timezone.utc)
    for d in docs:
        try:
            d["is_due"] = datetime.fromisoformat(d["next_due"].replace("Z", "+00:00")) <= now
        except Exception:
            d["is_due"] = True
    return {"items": docs}


@api_router.post("/revision/topic/{topic_id}/review")
async def review_topic(topic_id: str, payload: RevisionReview):
    doc = await db.revisions.find_one({"id": topic_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Tópico não encontrado")
    step = doc.get("step", 0)
    if payload.outcome == "ok":
        step += 1
    elif payload.outcome == "erro":
        step = 0
    # duvida keeps step
    history = doc.get("history", [])
    history.append({"date": datetime.now(timezone.utc).isoformat(), "outcome": payload.outcome})
    upd = {"step": step, "next_due": next_due_after(step), "history": history}
    await db.revisions.update_one({"id": topic_id}, {"$set": upd})
    return {**doc, **upd}


@api_router.delete("/revision/topic/{topic_id}")
async def delete_revision(topic_id: str):
    await db.revisions.delete_one({"id": topic_id})
    return {"ok": True}


# ---------- Duel (single-player vs AI) ----------
@api_router.post("/duel/start", response_model=AiResponse)
async def duel_start(payload: DuelStart):
    profile = await get_profile(payload.session_id)
    prompt = (
        f"Gere 3 questões objetivas de {payload.subject} nível {payload.level} no formato JSON estrito. "
        'Formato: {"questions":[{"prompt":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]}. '
        "As alternativas devem estar em ordem A,B,C,D e 'answer' é o índice 0-3 da correta."
    )
    text = await run_ai(prompt, f"duel-{uuid.uuid4()}", profile)
    return {"response": text, "model": "GPT 5.6 Terra"}


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Object storage inicializado")
    except Exception as e:
        logger.warning("Storage init falhou (será tentado sob demanda): %s", e)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
