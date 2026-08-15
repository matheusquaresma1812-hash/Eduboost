"""Public API regression coverage for EduBoost profile, AI, study, planner, radar and duel modules."""
import base64
import json
import os
import re
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"
REQUEST_TIMEOUT = 180
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def extract_json(text):
    """Extract a JSON object from plain or fenced model output."""
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text or "", re.I)
    candidate = fenced.group(1) if fenced else (text or "")
    start, end = candidate.find("{"), candidate.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        return json.loads(candidate[start:end + 1])
    except json.JSONDecodeError:
        return None


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    yield session
    session.close()


@pytest.fixture(scope="session")
def session_id():
    return f"TEST_QA_{uuid.uuid4()}"


@pytest.fixture(scope="session", autouse=True)
def profile(api_client, session_id):
    payload = {
        "session_id": session_id,
        "name": "TEST_QA EduBoost",
        "grade": "3º ano - Ensino Médio",
        "institution_type": "publica",
        "focus_subjects": ["Matemática", "História"],
    }
    response = api_client.post(f"{API}/profile", json=payload, timeout=30)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["session_id"] == session_id
    assert data["grade"] == payload["grade"]
    assert data["institution_type"] == "publica"
    assert data["focus_subjects"] == payload["focus_subjects"]
    return data


class TestCoreAndProfile:
    """Core health, profile persistence, library, and audio route validation."""

    def test_root(self, api_client):
        response = api_client.get(f"{API}/", timeout=30)
        assert response.status_code == 200
        assert response.json() == {"message": "EduBoost Pro API online", "version": "2.0"}

    def test_profile_get_persists_fields(self, api_client, profile, session_id):
        response = api_client.get(f"{API}/profile/{session_id}", timeout=30)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["name"] == "TEST_QA EduBoost"
        assert data["grade"] == "3º ano - Ensino Médio"
        assert data["institution_type"] == "publica"
        assert data["focus_subjects"] == ["Matemática", "História"]
        assert "_id" not in data

    def test_profile_missing_returns_404(self, api_client):
        response = api_client.get(f"{API}/profile/TEST_missing_{uuid.uuid4()}", timeout=30)
        assert response.status_code == 404
        assert response.json()["detail"] == "Perfil não encontrado"

    def test_library_has_27_plus_items_and_filters(self, api_client):
        response = api_client.get(f"{API}/library", timeout=30)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == len(data["items"])
        assert data["total"] >= 27
        assert all("_id" not in item for item in data["items"])
        filtered = api_client.get(f"{API}/library", params={"stage": "Ensino Médio", "subject": "História"}, timeout=30)
        assert filtered.status_code == 200
        filtered_data = filtered.json()
        assert filtered_data["total"] >= 1
        assert all(x["stage"] == "Ensino Médio" and x["subject"] == "História" for x in filtered_data["items"])

    def test_audio_endpoint_exists_and_validates_empty_payload(self, api_client):
        response = api_client.post(f"{API}/metacog/audio", data={}, timeout=30)
        assert response.status_code == 422
        detail = response.json().get("detail")
        assert isinstance(detail, list) and detail


class TestStudyUpload:
    """Study material object-storage upload, Mongo persistence, download, and soft delete."""

    def test_upload_download_list_and_delete(self, api_client, session_id):
        files = {"file": ("TEST_tiny.png", PNG_BYTES, "image/png")}
        form = {"session_id": session_id, "subject": "Matemática", "title": "TEST_PNG Frações"}
        created = api_client.post(f"{API}/study/upload", data=form, files=files, timeout=REQUEST_TIMEOUT)
        assert created.status_code == 200, created.text
        material = created.json()
        material_id = material["id"]
        try:
            assert material["session_id"] == session_id
            assert material["content_type"] == "image/png"
            assert material["title"] == "TEST_PNG Frações"
            assert material["size"] == len(PNG_BYTES)
            assert material["storage_path"]
            assert "_id" not in material

            listed = api_client.get(f"{API}/study/materials/{session_id}", timeout=30)
            assert listed.status_code == 200
            assert any(x["id"] == material_id and x["storage_path"] == material["storage_path"] for x in listed.json()["items"])

            downloaded = api_client.get(f"{API}/study/file/{material_id}", timeout=REQUEST_TIMEOUT)
            assert downloaded.status_code == 200
            assert downloaded.headers["content-type"].startswith("image/png")
            assert downloaded.content == PNG_BYTES
        finally:
            deleted = api_client.delete(f"{API}/study/materials/{material_id}", timeout=30)
            assert deleted.status_code == 200 and deleted.json()["ok"] is True
        missing = api_client.get(f"{API}/study/file/{material_id}", timeout=30)
        assert missing.status_code == 404

    def test_upload_rejects_unsupported_file(self, api_client, session_id):
        response = api_client.post(
            f"{API}/study/upload",
            data={"session_id": session_id, "subject": "Geral", "title": "TEST_bad"},
            files={"file": ("TEST_bad.exe", b"bad", "application/octet-stream")},
            timeout=30,
        )
        assert response.status_code == 400
        assert "não suportado" in response.json()["detail"]


class TestProductivityCrud:
    """Planner and radar create/read/update/delete persistence flows."""

    def test_planner_crud_and_checklist_progress_data(self, api_client, session_id):
        payload = {
            "session_id": session_id,
            "title": "TEST_Trabalho de História",
            "subject": "História",
            "kind": "trabalho",
            "due_date": (date.today() + timedelta(days=3)).isoformat(),
            "checklist": ["TEST_Pesquisar", "TEST_Escrever"],
        }
        created = api_client.post(f"{API}/planner/task", json=payload, timeout=30)
        assert created.status_code == 200, created.text
        task = created.json()
        task_id = task["id"]
        try:
            assert task["title"] == payload["title"]
            assert task["subject"] == "História"
            assert task["kind"] == "trabalho"
            assert [x["text"] for x in task["checklist"]] == payload["checklist"]
            assert all(x["done"] is False for x in task["checklist"])

            listed = api_client.get(f"{API}/planner/tasks/{session_id}", timeout=30)
            assert listed.status_code == 200
            assert any(x["id"] == task_id for x in listed.json()["items"])

            changed = [dict(x, done=(i == 0)) for i, x in enumerate(task["checklist"])]
            patched = api_client.patch(f"{API}/planner/task/{task_id}", json={"checklist": changed, "done": False}, timeout=30)
            assert patched.status_code == 200
            assert patched.json()["checklist"][0]["done"] is True
            assert patched.json()["checklist"][1]["done"] is False

            persisted = api_client.get(f"{API}/planner/tasks/{session_id}", timeout=30).json()["items"]
            fetched = next(x for x in persisted if x["id"] == task_id)
            assert fetched["checklist"][0]["done"] is True
        finally:
            deleted = api_client.delete(f"{API}/planner/task/{task_id}", timeout=30)
            assert deleted.status_code == 200 and deleted.json()["ok"] is True
        assert not any(x["id"] == task_id for x in api_client.get(f"{API}/planner/tasks/{session_id}", timeout=30).json()["items"])

    def test_radar_new_topic_is_due_then_review_moves_it(self, api_client, session_id):
        payload = {"session_id": session_id, "topic": "TEST_Guerra Fria", "subject": "História", "difficulty": "medio"}
        created = api_client.post(f"{API}/revision/topic", json=payload, timeout=30)
        assert created.status_code == 200, created.text
        topic = created.json()
        topic_id = topic["id"]
        try:
            listed = api_client.get(f"{API}/revision/topics/{session_id}", timeout=30)
            assert listed.status_code == 200
            persisted = next(x for x in listed.json()["items"] if x["id"] == topic_id)
            assert persisted["topic"] == "TEST_Guerra Fria"
            assert persisted["difficulty"] == "medio"
            assert persisted["is_due"] is True, "A newly added topic must persist in HOJE NO RADAR"
            next_due = datetime.fromisoformat(persisted["next_due"].replace("Z", "+00:00"))
            assert next_due <= datetime.now(timezone.utc), "New topic next_due must be now or in the past"

            reviewed = api_client.post(f"{API}/revision/topic/{topic_id}/review", json={"outcome": "ok"}, timeout=30)
            assert reviewed.status_code == 200
            data = reviewed.json()
            assert data["step"] == 1
            assert data["history"][-1]["outcome"] == "ok"
            after = api_client.get(f"{API}/revision/topics/{session_id}", timeout=30).json()["items"]
            fetched = next(x for x in after if x["id"] == topic_id)
            assert fetched["is_due"] is False
        finally:
            deleted = api_client.delete(f"{API}/revision/topic/{topic_id}", timeout=30)
            assert deleted.status_code == 200 and deleted.json()["ok"] is True


class TestAIEndpoints:
    """GPT-5.6 Terra text, structured study content, helpers, duel, and vision responses."""

    def test_diagnostic_returns_plan_text(self, api_client, session_id):
        response = api_client.post(f"{API}/diagnostic", json={
            "session_id": session_id, "grade": "Ensino Médio", "focus": "Matemática", "confidence": "Sei o básico"
        }, timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["model"] == "GPT 5.6 Terra"
        assert isinstance(data["response"], str) and len(data["response"].strip()) >= 80

    def test_questions_returns_four_alternatives(self, api_client, session_id):
        response = api_client.post(f"{API}/questions", json={
            "session_id": session_id, "subject": "Matemática", "level": "Intermediário", "topic": "Frações"
        }, timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200, response.text
        text = response.json()["response"]
        assert len(text.strip()) >= 80
        for letter in "ABCD":
            assert re.search(rf"(?m)^\s*(?:\*\*)?{letter}[\)\.:-]", text), f"Missing alternative {letter}: {text[:500]}"

    def test_flashcards_and_mindmap_return_content(self, api_client, session_id):
        flash = api_client.post(f"{API}/study/flashcards", json={
            "session_id": session_id, "topic": "Frações", "subject": "Matemática", "count": 6
        }, timeout=REQUEST_TIMEOUT)
        assert flash.status_code == 200, flash.text
        flash_text = flash.json()["response"]
        assert len(flash_text.strip()) >= 40
        parsed_flash = extract_json(flash_text)
        if parsed_flash is not None:
            assert len(parsed_flash.get("flashcards", [])) >= 1
            assert all(x.get("front") and x.get("back") for x in parsed_flash["flashcards"])

        mind = api_client.post(f"{API}/study/mindmap", json={
            "session_id": session_id, "topic": "Frações", "subject": "Matemática"
        }, timeout=REQUEST_TIMEOUT)
        assert mind.status_code == 200, mind.text
        mind_text = mind.json()["response"]
        assert len(mind_text.strip()) >= 40
        parsed_mind = extract_json(mind_text)
        if parsed_mind is not None:
            assert parsed_mind.get("root")
            assert len(parsed_mind.get("branches", [])) >= 1

    def test_feynman_feedback_metaphor_and_pitfalls(self, api_client, session_id):
        feynman = api_client.post(f"{API}/metacog/feynman", json={
            "session_id": session_id, "topic": "Fotossíntese",
            "explanation": "A planta usa luz, água e gás carbônico para produzir açúcar e libera oxigênio.", "confidence": 3
        }, timeout=REQUEST_TIMEOUT)
        assert feynman.status_code == 200, feynman.text
        assert len(feynman.json()["response"].strip()) >= 80

        metaphor = api_client.post(f"{API}/metacog/metaphor", json={"session_id": session_id, "topic": "Fotossíntese"}, timeout=REQUEST_TIMEOUT)
        assert metaphor.status_code == 200, metaphor.text
        assert len(metaphor.json()["response"].strip()) >= 60

        pitfalls = api_client.post(f"{API}/metacog/pitfalls", json={
            "session_id": session_id, "subject": "Biologia", "topic": "Fotossíntese"
        }, timeout=REQUEST_TIMEOUT)
        assert pitfalls.status_code == 200, pitfalls.text
        assert len(pitfalls.json()["response"].strip()) >= 60

    def test_duel_returns_questions_with_four_options(self, api_client, session_id):
        response = api_client.post(f"{API}/duel/start", json={
            "session_id": session_id, "subject": "Matemática", "level": "Intermediário"
        }, timeout=REQUEST_TIMEOUT)
        assert response.status_code == 200, response.text
        text = response.json()["response"]
        parsed = extract_json(text)
        assert parsed and parsed.get("questions"), text[:500]
        question = parsed["questions"][0]
        assert question.get("prompt")
        assert len(question.get("options", [])) == 4
        assert question.get("answer") in range(4)
        assert question.get("explanation")

    def test_correction_vision_returns_text(self, api_client, session_id):
        response = api_client.post(
            f"{API}/correction/essay",
            data={"session_id": session_id, "kind": "redacao", "prompt_context": "TEST_Mobilidade urbana"},
            files={"image": ("TEST_redacao.png", PNG_BYTES, "image/png")},
            timeout=REQUEST_TIMEOUT,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["model"] == "GPT 5.6 Terra Vision"
        assert isinstance(data["response"], str) and len(data["response"].strip()) >= 50
