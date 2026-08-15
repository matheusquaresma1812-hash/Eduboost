import os
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

class TestLibrary:
    def test_library_complete_and_serializable(self):
        r = requests.get(f"{BASE_URL}/api/library", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == len(data["items"]) == 27
        assert not any("_id" in item for item in data["items"])
        new_subjects = {"Geografia", "Química", "Filosofia", "Sociologia", "Inglês", "Artes", "Educação Física"}
        assert new_subjects <= {item["subject"] for item in data["items"]}
        for subject in new_subjects:
            rows = [x for x in data["items"] if x["subject"] == subject]
            assert len(rows) == 3
            assert all(x.get("area") and x.get("stage") for x in rows)

    def test_stage_and_subject_filters(self):
        for params, expected in [({"stage":"ENEM"}, 8), ({"subject":"Geografia"}, 3), ({"stage":"Ensino Médio", "subject":"Filosofia"}, 1)]:
            r = requests.get(f"{BASE_URL}/api/library", params=params, timeout=20)
            assert r.status_code == 200
            data = r.json()
            assert data["total"] == len(data["items"]) == expected
            assert all((not params.get("stage") or x["stage"] == params["stage"]) and (not params.get("subject") or x["subject"] == params["subject"]) for x in data["items"])
