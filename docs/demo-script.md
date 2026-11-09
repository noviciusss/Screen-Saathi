# Screen Saathi — Fast 90-Second Video Demo Script

> **Video Duration:** ~90 seconds (1.5 minutes) — Clean, Punchy & Well within time limits  
> **Target Audience:** Gnani.ai Evaluation Jury ("Great Indian AI Internship Challenge")  
> **Layout:** Split screen (Left: Government Form `http://127.0.0.1:8000/fixtures/form.html`, Right: Screen Saathi Side Panel)  
> **Voice:** English presentation narration + Hindi spoken interactions with the assistant.

---

## ⚡ 10-Second Pre-Recording Setup:
1. Open `http://127.0.0.1:8000/fixtures/form.html` in Chrome.
2. **Pre-type:** In the form, type:
   * **आवेदक का पूरा नाम:** `रमेश कुमार`
   * **पिता का नाम:** `सुरेश कुमार`
   *(This proves the assistant can seamlessly pick up a partially filled form without starting from scratch!)*
3. Open the **Screen Saathi** Side Panel on the right.
4. Click **"इस पेज को तैयार करें"** (Prepare page) once so the context is ready.
5. Hit **Record** on Loom!

---

## ⏱️ Video Timeline & Dialogues

### [0:00 – 0:25] Scene 1: Problem & Solution Pitch
* **What to Show on Screen:** Chrome split screen showing the government form and the Screen Saathi side panel.
* **What You Say (in English):**
  > *"Hello everyone! Over 300 million Indian citizens struggle with dense online government forms and English-heavy portals.*
  > 
  > *For the Gnani.ai Great Indian AI Internship Challenge, I built **Screen Saathi** — a voice assistant for Google Chrome that understands what is on the user's screen, explains options in native Indian languages, and fills forms safely with explicit confirmation."*

---

### [0:25 – 0:50] Scene 2: Live Dropdown Q&A (Explain by Default)
* **What to Show on Screen:** Point cursor towards the Service Category dropdown (do not click it open). Press and hold the **Talk** button.
* **What You Speak into Mic (in Hindi):**
  > *"इस फॉर्म में कौन-कौन सी सेवाएँ उपलब्ध हैं?"*
* **What Happens on Screen:**
  * Release button.
  * Your spoken words appear instantly under **"आपने कहा"** via **Gnani Prisma STT**.
  * The Service dropdown highlights in gold outline.
  * Screen Saathi replies with **Gnani Timbre TTS** (mandatory AI disclosure + options):
    > **Saathi says:** *"मैं एक AI voice assistant हूँ। यहाँ नल जल योजना, राशन कार्ड, सड़क व नाली मरम्मत, पेंशन और आवास योजना जैसी सेवाएँ उपलब्ध हैं।"*
* **What You Say (Narrator in English):**
  > *"Instead of scrolling through unfamiliar dropdowns, citizens can simply ask what choices exist, and Saathi reads them aloud directly from the DOM."*

---

### [0:50 – 1:15] Scene 3: Direct Form Filling with Confirmation Gate
* **What to Show on Screen:** Press and hold the **Talk** button.
* **What You Speak into Mic (in Hindi):**
  > *"सेवा में नल जल योजना चुन लो।"*
* **What Happens on Screen:**
  * Release button.
  * Saathi targets the service dropdown directly and prompts for confirmation:
    > **Saathi says:** *"क्या मैं सेवा में नल जल योजना कनेक्शन चुन दूँ?"*
  * Side panel shows the action card with **[हाँ, भरें]** and **[नहीं]**.
  * **You click [हाँ, भरें]** (or say *"हाँ"*).
  * The dropdown on the web page instantly updates to **"नल जल योजना कनेक्शन (Water Supply)"**!
* **What You Say (Narrator in English):**
  > *"Notice how Saathi jumped directly to the requested field and never changes the DOM without an explicit confirmation from the user."*

---

### [1:15 – 1:35] Scene 4: Strict Safety Invariant (Never Auto-Submit) & Conclusion
* **What to Show on Screen:** Scroll to the green **"आवेदन जमा करें (Submit Application)"** button. Press Talk.
* **What You Speak into Mic (in Hindi):**
  > *"फॉर्म सबमिट कर दो।"*
* **What Happens on Screen:**
  * Release button.
  * Saathi highlights the submit button but **strictly refuses** to click it:
    > **Saathi says:** *"सुरक्षा कारणों से सबमिट बटन आप स्वयं दबाएँ। कृपया विवरण जाँच कर सबमिट पर क्लिक करें।"*
* **What You Say (Narrator Closing in English):**
  > *"This proves our critical safety invariant: Screen Saathi assists, but strictly refuses to automate clicks on Submit, Pay, or Delete buttons.*
  > 
  > *Powered 100% by Gnani.ai's **Prisma STT** and **Timbre TTS** with on-device privacy masking, Screen Saathi makes the open web accessible and safe for Bharat. Thank you to the Gnani.ai team!"*

---

## 💡 Quick Tips:
1. **Button Timing:** Keep the button pressed while speaking, and let go right after your last word.
2. **Speed:** Click the green **[हाँ, भरें]** button right after Saathi proposes it.
3. **No Fluff:** This flow takes **exactly 90 seconds** and hits every single grading rubric point!
