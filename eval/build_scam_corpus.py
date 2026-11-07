"""Create the synthetic 60-message scam-check corpus used by the eval runner."""

from __future__ import annotations

import json
from pathlib import Path


OUT = Path(__file__).with_name("scam_messages.jsonl")


def build() -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    scam_templates = (
        ("urgent", "Your account is blocked. Verify KYC in 10 minutes at https://verify-synthetic.example."),
        ("otp", "Share the OTP you just received to unlock your synthetic reward."),
        ("payment", "Pay ₹1 to claim the synthetic prize. Send the code to support."),
        ("mismatch", "Your parcel is waiting. Open http://parcel-synthetic.example to avoid a fee."),
    )
    safe_templates = (
        "The library will be closed on Sunday. See the notice at https://library-synthetic.example.",
        "Your synthetic appointment is booked for Monday at 10 AM. Call the public office directly.",
        "This article explains how to update a profile. It does not ask for a password or OTP.",
    )
    for index in range(60):
        if index % 3 == 0:
            signal, text = scam_templates[index % len(scam_templates)]
            level = "likely_scam" if signal in {"otp", "payment"} else "suspicious"
            reasons = ["It creates urgency or asks for sensitive information.", "The message contains an unfamiliar synthetic link."]
            records.append({"id": f"scam-{index + 1:02d}", "text": text, "label": level, "signals": [signal], "reasons": reasons})
        elif index % 3 == 1:
            records.append({"id": f"safe-{index + 1:02d}", "text": safe_templates[index % len(safe_templates)], "label": "looks_ok", "signals": [], "reasons": ["It does not request an OTP, password, or payment."]})
        else:
            records.append({"id": f"review-{index + 1:02d}", "text": "Please review this synthetic notice with the official office before taking action.", "label": "suspicious", "signals": ["review"], "reasons": ["The sender is not verified from the message alone."]})
    return records


if __name__ == "__main__":
    rows = build()
    OUT.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
    print(f"wrote {len(rows)} synthetic messages to {OUT}")
