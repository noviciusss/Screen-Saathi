# 60-second demo script

Use synthetic data and a normal public webpage or the checked-in fixture. Do
not show credentials, real identifiers, banking pages, or real recordings.

1. **0–8 s:** Open the extension and accept the privacy explanation. Say that
   Screen Saathi is an AI voice assistant for people who find web pages hard to
   read.
2. **8–20 s:** Press “Prepare this page” on the synthetic service form. Ask in
   Hindi, “यह पेज क्या है?” Show the short spoken explanation and highlighted
   field.
3. **20–42 s:** Start guided form mode. Speak a synthetic name. Show the
   confirmation card, decline once, then repeat and press “हाँ, भरें”. Fill the
   next safe field the same way.
4. **42–52 s:** Show that the Submit button is never pressed and the final line
   tells the user to press it themselves.
5. **52–60 s:** Show a synthetic urgent message and the scam verdict card. End
   with the AI disclosure and the privacy boundary.

Before recording, manually verify microphone permission, audible TTS, latency,
and that the backend uses a public WSS endpoint. Record the actual backend,
model, and credit details in `docs/submission.md`.
