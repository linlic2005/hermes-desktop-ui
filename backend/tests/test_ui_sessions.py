def test_create_list_get_patch_delete_ui_session(client, auth_headers):
    created = client.post("/api/ui/sessions", headers=auth_headers, json={"title": "New Chat", "pinned": True}).json()
    session_id = created["id"]
    assert created["title"] == "New Chat"
    assert created["pinned"] is True

    listed = client.get("/api/ui/sessions", headers=auth_headers).json()
    assert any(item["id"] == session_id for item in listed)

    fetched = client.get(f"/api/ui/sessions/{session_id}", headers=auth_headers).json()
    assert fetched["id"] == session_id

    patched = client.patch(f"/api/ui/sessions/{session_id}", headers=auth_headers, json={"favorite": True, "archived": True}).json()
    assert patched["favorite"] is True
    assert patched["archived"] is True

    active_list = client.get("/api/ui/sessions", headers=auth_headers).json()
    assert not any(item["id"] == session_id for item in active_list)

    archived = client.get("/api/ui/sessions?archived=true", headers=auth_headers).json()
    assert any(item["id"] == session_id for item in archived)

    deleted = client.delete(f"/api/ui/sessions/{session_id}", headers=auth_headers)
    assert deleted.status_code == 200
    assert client.get(f"/api/ui/sessions/{session_id}", headers=auth_headers).status_code == 404


def test_continue_latest_and_resume_official_session_id(client, auth_headers):
    response = client.post(
        "/api/ui/sessions",
        headers=auth_headers,
        json={"continueLatest": True, "resumeOfficialSessionId": "official-1"},
    )
    body = response.json()
    assert body["continueLatest"] is True
    assert body["resumeOfficialSessionId"] == "official-1"


def test_transcript_retrieval(client, auth_headers):
    created = client.post("/api/ui/sessions", headers=auth_headers, json={"title": "Transcript"}).json()
    response = client.get(f"/api/ui/sessions/{created['id']}/transcript", headers=auth_headers)
    body = response.json()
    assert body["uiSessionId"] == created["id"]
    assert body["rawAnsi"] == ""
    assert body["plainText"] == ""
    assert body["chunks"] == []
