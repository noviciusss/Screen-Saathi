# Evaluation harness

The repository uses synthetic pages and messages only. Build and validate the
60-message scam corpus with:

```bash
python eval/build_scam_corpus.py
python eval/run_scam_eval.py
```

The second command writes `eval/results/scam-summary.json`. It makes no network
calls. To score a saved provider result, pass JSONL rows containing `id` and
`level`:

```bash
python eval/run_scam_eval.py --predictions eval/results/provider-predictions.jsonl
```

Provider results must be recorded separately from the corpus and must include
all 60 ids before the accuracy is used in submission material.
