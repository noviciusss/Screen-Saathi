# ENGAGEMENT_PLAN.md — Screen Saathi

Why this exists: Gnani's participant email says selection is on popular engagement on the LinkedIn/X posts you nominate, followed by review and interviews. Engagement is the least controllable part of the contest, so treat it as a workstream with a calendar, assets, and a log, not as a final-day post.

Rules from the challenge: demo must be public on LinkedIn or X; use `#GnaniAI #GreatIndianAIInternshipChallenge`; purchased or fake engagement is banned; synthetic data only. Do **not** join engagement pods, comment-for-comment groups, or bot services. They are risky under a "no purchased/fake engagement" rule and they hurt your credibility with the people who interview you.

## 1. Principles

1. **One story, told in pieces.** Every post is one new proof point of the same promise: "A voice helper that explains any web page to someone who cannot read it well, and never acts behind their back."
2. **Show, do not describe.** Every post carries a short video. Hindi voice and a visible highlight in the first 3 seconds.
3. **Be specific and honest.** Real numbers (latency, accuracy), real failures, real limits. Do not claim "first". Similar tools exist (see below), so your claim is measured Hindi/Hinglish voice + a safety gate + published numbers.
4. **Make it easy to react.** Each post ends with one genuine question (it doubles as product research).
5. **Be present.** Reply to every comment, especially in the first 24 hours.

## 2. Platform choice

- **Primary: LinkedIn** (best fit for hiring-linked contests and the college/recruiter audience). **Mirror on X** with a shorter caption and the same video. Nominate whichever gets stronger traction, plus the final demo post on the other if it did reasonably.
- Upload video natively (not a YouTube link). Burn in English subtitles (many people watch muted) over Hindi audio. Put repo/install links in the first comment, not the post body (external links in the body are commonly reported to reduce reach).
- Posting times are a heuristic, not a rule: weekday morning (about 8–10 AM IST) or evening (about 7–9 PM IST). Test two slots and keep the better one.

## 3. Content calendar (tied to build phases)

| # | Date (IST) | Post | Asset | Hook idea | Closing question |
|---|---|---|---|---|---|
| 1 | by 18 Oct | **Announcement**: the problem and why | 20 s clip or one image of a confusing government-style page + 1 line of your story | "My parents' generation cannot read most websites. I'm building a voice helper in Hindi." | "Which website confuses your family the most?" |
| 2 | about 22 Oct | **Voice loop works** (Phase 1) | 20–30 s screen + audio capture: hold button, speak Hindi, hear reply | "Hold. Speak. It answers in Hindi. Built on Gnani's speech models." | "Which language should I add next?" |
| 3 | about 27 Oct | **Explain + highlight** (Phase 2 gate; first postable demo) | 30–40 s: confusing page → Hindi explanation → the right button glows | "It does not just read the page. It points at the one button that matters." | "What page should I test it on?" |
| 4 | about 30 Oct | **Form guidance with confirmation** (Phase 3) | 30–40 s on a synthetic form: asks field, reads back, you say yes, it fills, it never submits | "It asks before it types. It never presses Submit." | "Would you let this help your parents?" |
| 5 | about 2 Nov | **Scam check** (Phase 4) — your most shareable clip | 20–30 s: synthetic "KYC expired" message flagged in Hindi with two plain reasons | "Would your family fall for this message? Watch what it says." | "Forward this to someone who needs it." (genuine ask) |
| 6 | **by 4 Nov** | **Final 60-second demo** (nominate this) | 60 s cut with the full story (script in `SPEC.md` / `docs/demo-script.md`) | Strongest 3 seconds from clip 5 or 4 | "Which part would help your family most?" |
| 7 | 6–8 Nov | **Numbers and lessons** | Carousel or short thread: latency p50/p95, accuracy table, 3 things that broke | "Here is what 25 days of building this taught me" | "What would you want measured?" |

Keep posting replies and a short update after close while Gnani verifies engagement. Nomination is for posts 6 and, if strong, one of 3–5 or 7.

## 4. The 60-second demo (what judges and viewers see)

0–5 s: hook (Hindi voice + highlighted button, or the scam flag).
5–20 s: confusing page → Saathi explains in Hindi, highlights the key button.
20–35 s: form guidance with read-back, user says "haan", field fills, Saathi says "Submit aap khud dabaiye."
35–48 s: scam message flagged with two simple reasons.
48–55 s: "What Saathi will never do" card (never submits, never reads passwords or OTPs, never stores your screen) + one latency number on screen.
55–60 s: models used (Gnani Prisma, Timbre, Evon if Gnani-only mode is live), your name, hashtags, call to try.
Production notes: record at 1080p, subtitles burned in, no real personal data on screen, background noise kept low, voice demo with a real mic (that is also proof of the voice quality).

## 5. Human proof (highest-impact asset)

With consent, record one short session of an older relative using it on a **fake** form. Natural reactions beat polished UI. Do not show real Aadhaar, phone, or account numbers. Ask permission to post their face or voice; if they decline, record hands and screen only.

## 6. Distribution (honest ways to reach people)

- Personal network: share the post and message about 20–30 people individually (friends, seniors, alumni, professors, internship colleagues): "I built this for a Gnani AI contest, would you watch the 60 s demo and share your honest view?" Engagement they give must be real.
- Communities: college clubs and groups, relevant AI/India developer communities, the challenge Discord (where sharing is allowed by its rules). Read each group's rules first; no spam.
- Tag Gnani AI's official page and relevant tool pages in posts where it is natural. Reply to Gnani's own posts about the contest with something useful, not self-promotion.
- Reuse: cut the 60 s demo into three 20 s clips for X and short-video platforms (repost the same story, not new claims).
- Say "thanks" publicly to anyone who tests it or gives feedback, and show a fix you made because of feedback. That reads as authentic and invites more.

## 7. Caption template (adapt, do not copy word for word)

```
[Hook line — one sentence, Hindi or English]

Problem: [1 line, concrete: who struggles, with what]
What I built: [1 line: voice helper that explains the page and guides forms]
What it never does: [1 line: never submits, never reads passwords/OTPs]
Built with: Gnani AI Prisma (speech-to-text), Timbre (text-to-speech) [+ Evon]
Numbers: [one real number, e.g. release-to-first-audio p50]

[One genuine question]

#GnaniAI #GreatIndianAIInternshipChallenge
```

Write in your own voice. Short sentences. One idea per post. Avoid buzzwords and avoid claiming accuracy you have not measured.

## 8. Metrics and log (put in `docs/CHECKPOINT.md` social log)

Per post: date/time, platform, impressions, reactions, comments, reposts/shares, profile views, link clicks if available. After posts 2 and 3, compare: which hook, length, and time slot performed better, then repeat that format. No target numbers are promised; the goal is a rising trend and a few strong, substantive comments (which also help in interviews).

## 9. Risks and how to handle them

| Risk | Handling |
|---|---|
| Demo clips look rough or the Hindi audio is poor | Re-record; use a good mic; test in a quiet room; keep a pre-generated, cached set of demo phrases |
| Showing personal data by accident | Use only the fixture pages and synthetic messages; review each frame before posting |
| Overclaiming | Every number comes from `docs/latency.md` or the eval results; mention limits (banking pages unsupported, Chrome desktop only) |
| Low reach on first posts | Keep the cadence, change the hook, ask a sharper question, repost the clip with a new angle |
| Credits run out during public use | The video is the main evidence; the live backend has a polite "demo credits finished" reply |
| Time pressure steals build days | Batch content work: record clips right after each phase gate, post the same day |

## 10. Checklist before each post

- Video under 60 s (final) or under 40 s (teasers), subtitles on, first 3 seconds strong.
- No real personal data in any frame.
- Hashtags and Gnani tag included.
- One genuine question at the end.
- Link in first comment.
- Logged in `docs/CHECKPOINT.md`.
