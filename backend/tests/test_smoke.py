from screen_saathi.health import health_payload


def test_health_payload_is_content_free() -> None:
    assert health_payload() == {"status": "ok"}
