from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class DiagnosticRequest(BaseModel):
    grade: str
    focus: str
    confidence: str

class QuestionRequest(BaseModel):
    subject: str
    level: str
    topic: str

class AiResponse(BaseModel):
    response: str
    model: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "EduBoost Pro API online", "version": "1.0"}

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
    items = [item for item in LIBRARY if (not stage or item["stage"] == stage) and (not subject or item["subject"] == subject)]
    return {"items": items, "total": len(items)}

async def run_ai(prompt: str, model: str, session: str) -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Integração de IA não configurada")
    try:
        chat = LlmChat(api_key=key, session_id=session, system_message="Você é um tutor brasileiro acolhedor. Responda em português, com clareza, exemplos do cotidiano e passos curtos. Nunca copie material protegido.").with_model("openai", model)
        result = []
        async for event in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(event, TextDelta):
                result.append(event.content)
        return "".join(result)
    except Exception as exc:
        logger.warning("Falha controlada na IA: %s", exc)
        raise HTTPException(status_code=503, detail="A tutoria inteligente está temporariamente indisponível") from exc

@api_router.post("/diagnostic", response_model=AiResponse)
async def create_diagnostic(payload: DiagnosticRequest):
    prompt = f"Crie uma trilha personalizada de 3 etapas para um aluno da fase {payload.grade}, com foco em {payload.focus} e autoconfiança {payload.confidence}. Retorne um título, objetivo da semana e três ações práticas."
    text = await run_ai(prompt, "gpt-5.6-terra", f"diagnostic-{uuid.uuid4()}")
    return {"response": text, "model": "GPT 5.6 Terra"}

@api_router.post("/questions", response_model=AiResponse)
async def create_question(payload: QuestionRequest):
    prompt = f"Crie uma questão autoral de {payload.subject}, nível {payload.level}, sobre {payload.topic}. Inclua enunciado, 4 alternativas, gabarito e resolução passo a passo explicando por que cada alternativa está certa ou errada."
    try:
        text = await run_ai(prompt, "gpt-5.6-terra", f"question-{uuid.uuid4()}")
        return {"response": text, "model": "GPT 5.6 Terra"}
    except HTTPException:
        fallback = f"QUESTÃO AUTORAL · {payload.subject.upper()}\n\nUma situação prática sobre {payload.topic} pede que você escolha a melhor estratégia para resolver o problema. Qual alternativa representa o raciocínio correto?\n\nA) Aplicar uma regra sem observar os dados.\nB) Identificar os dados, escolher o conceito de {payload.topic} e conferir o resultado.\nC) Ignorar a unidade de medida.\nD) Escolher a alternativa mais longa.\n\nGABARITO: B\n\nRESOLUÇÃO PASSO A PASSO\n1. Leia o enunciado e destaque os dados relevantes.\n2. Relacione os dados ao conceito de {payload.topic}.\n3. Faça a operação ou comparação necessária.\n4. Confira se o resultado responde exatamente ao que foi perguntado.\n\nA está errada porque ignora os dados. C está errada porque pode alterar o resultado. D não é um critério matemático. B é correta porque organiza o raciocínio e valida a resposta."
        return {"response": fallback, "model": "Trilha autoral EduBoost"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()