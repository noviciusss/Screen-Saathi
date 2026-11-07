"""Evaluate saved scam verdicts without making provider calls.

Predictions must be JSONL with ``id`` and ``level``. Without predictions this
command validates the corpus and prints its label distribution only.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).parent
CORPUS = ROOT / "scam_messages.jsonl"


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--predictions", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "results" / "scam-summary.json")
    args = parser.parse_args()
    corpus = read_jsonl(CORPUS)
    if len(corpus) != 60 or len({row.get("id") for row in corpus}) != 60:
        raise SystemExit("expected exactly 60 unique synthetic corpus rows")
    summary: dict[str, object] = {
        "messages": len(corpus),
        "labels": dict(Counter(str(row["label"]) for row in corpus)),
        "provider_calls": 0,
    }
    if args.predictions is not None:
        predictions = {str(row["id"]): str(row["level"]) for row in read_jsonl(args.predictions)}
        matched = [(str(row["label"]), predictions[str(row["id"])]) for row in corpus if str(row["id"]) in predictions]
        correct = sum(expected == actual for expected, actual in matched)
        summary.update({"predictions": len(matched), "accuracy": correct / len(matched) if matched else 0.0})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
