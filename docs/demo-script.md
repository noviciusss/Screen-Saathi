# Screen Saathi — Official Loom Video Demo Script

> **Target Duration:** 2.5 to 3 minutes  
> **Target Audience:** Gnani.ai Evaluation Jury ("Great Indian AI Internship Challenge")  
> **Setup:** Chrome browser with Screen Saathi Side Panel open on the right (split screen: left 70% web page, right 30% sidepanel).  
> **URL:** `http://127.0.0.1:8000/fixtures/form.html` (Department of Rural Development & Citizen Welfare Synthetic Demo Form).  
> **Speaker Audio:** English presentation / voiceover, with Hindi spoken queries to the assistant.

---

## 🎬 Screen Setup Checklist (Before hitting Record)
1. **Backend Running:**
   ```powershell
   backend\.venv-win\Scripts\uvicorn backend.src.screen_saathi.app:app --reload --port 8000
   ```
2. **Chrome Browser Ready:**
   * Open `http://127.0.0.1:8000/fixtures/form.html`
   * Open the **Screen Saathi** Side Panel (Click the extension icon in Chrome toolbar).
   * Ensure language is set to **हिन्दी (Hindi)** in the side panel.
3. **Audio Check:**
   * Make sure your microphone is selected in Loom.
   * Make sure system audio is captured so Screen Saathi's voice (Gnani Timbre TTS) is clearly heard on the recording.

---

## ⏱️ Video Timeline & Scene Breakdown

### [0:00 – 0:35] Scene 1: The Problem & Solution Overview
* **What to Show on Screen:**
  * Full desktop view with Chrome showing the government application form on the left and the Screen Saathi side panel on the right.
* **What You Say (in English):**
  > *"Hello everyone! Over 300 million Indian citizens — especially the elderly and first-time digital users — struggle to navigate complex digital public infrastructure and government forms. Dense text, confusing dropdowns, and fear of making mistakes hold them back.*
  > 
  > *For the Gnani.ai Great Indian AI Internship Challenge, I built **Screen Saathi** — a voice companion for Google Chrome that understands what is on the user's screen, explains it aloud in their native Indian language, answers questions, and safely helps them fill forms with an uncompromising confirmation gate."*

---

### [0:35 – 1:05] Scene 2: AI Disclosure & Page Understanding
* **What to Show on Screen:**
  * Zoom slightly or keep focus on the side panel.
  * In the side panel, click **"इस पेज को तैयार करें"** (Prepare this page).
  * Show the status indicator change to: *"पेज की जानकारी तैयार है"*.
  * Press and hold the big mic button **"बोलने के लिए दबाएँ"**.
* **What You Speak into Mic (in Hindi):**
  > *"यह पेज किस बारे में है और यहाँ क्या करना है?"*
* **What Happens on Screen:**
  * Release the button.
  * Under **"आपने कहा"**, your transcript appears in Hindi in real-time (powered by **Gnani Prisma STT**).
  * The main header of the form highlights in gold outline.
  * Screen Saathi speaks aloud with **Gnani Timbre TTS** (First turn mandatory AI disclosure):
    > **Saathi says:** *"मैं एक AI voice assistant हूँ। यह प्रधानमंत्री जन कल्याण सेवा का आवेदन पत्र है, जहाँ आप नागरिक सेवाओं के लिए आवेदन कर सकते हैं।"*
* **What You Say (Narrator commentary in English):**
  > *"Notice how the assistant discloses it is an AI, understands the page layout using our client-side snapshot engine, and explains everything in natural, fluent Hindi."*

---

### [1:05 – 1:40] Scene 3: Explain by Default — Voice Q&A for Dropdowns
* **What to Show on Screen:**
  * Point cursor to Section 3 of the form where the dropdown for "सेवा का प्रकार (Service Category)" is located.
  * Notice that the user does NOT need to click open or read through the dropdown choices manually!
* **What You Speak into Mic (in Hindi):**
  > *"इस फॉर्म में कौन-कौन सी सेवाएँ उपलब्ध हैं?"*
* **What Happens on Screen:**
  * Release the button.
  * Screen Saathi immediately identifies the options extracted from the `<select>` element and replies verbally:
    > **Saathi says:** *"यहाँ नल जल योजना, राशन कार्ड, सड़क व नाली मरम्मत, पेंशन और आवास योजना जैसी सेवाएँ उपलब्ध हैं।"*
* **What You Say (Narrator commentary in English):**
  > *"Instead of struggling through long dropdowns, a user can simply ask what choices exist, and Screen Saathi reads them aloud directly from the page DOM."*

---

### [1:40 – 2:30] Scene 4: Confirmation Gate & Form Filling (Text, DOB, Dropdown)
* **What to Show on Screen:**
  * Focus on the form fields.
  * Demonstrate filling applicant details with the safety confirmation gate.

#### Step 4A: Name & Father's Name
* **What You Speak into Mic (in Hindi):**
  > *"मेरा नाम रमेश कुमार और पिता का नाम सुरेश कुमार भर दो।"*
* **What Happens on Screen:**
  * Release button.
  * Saathi highlights the Name field on the form.
  * A clear confirmation card appears in the side panel:
    * Action: **आवेदक का पूरा नाम: रमेश कुमार**
    * Buttons: **[हाँ, भरें]** / **[नहीं]**
  * Saathi asks: *"क्या मैं आवेदक का नाम रमेश कुमार भर दूँ?"*
  * Click **"हाँ, भरें"** on screen (or say *"हाँ"*).
  * The field on the webpage immediately populates with *"रमेश कुमार"*.

#### Step 4B: Date of Birth (DOB Normalization)
* **What You Speak into Mic (in Hindi):**
  > *"मेरी जन्म तिथि 15 अगस्त 1990 है।"*
* **What Happens on Screen:**
  * Saathi asks: *"क्या मैं जन्म तिथि 15 अगस्त 1990 भर दूँ?"*
  * Click **"हाँ, भरें"**.
  * The date picker is automatically populated with the normalized ISO date (`1990-08-15`), correctly showing the date in Indian format!

#### Step 4C: Dropdown Selection
* **What You Speak into Mic (in Hindi):**
  > *"सेवा में नल जल योजना चुन लो।"*
* **What Happens on Screen:**
  * Saathi asks: *"क्या मैं सेवा में नल जल योजना कनेक्शन चुन दूँ?"*
  * Click **"हाँ, भरें"**.
  * The Service dropdown automatically selects **"नल जल योजना कनेक्शन (Water Supply)"**!

---

### [2:30 – 3:00] Scene 5: Strict Safety Invariants & Tech Stack Summary
* **What to Show on Screen:**
  * Scroll down to the bottom of the form where the green **"आवेदन जमा करें (Submit Application)"** button is located.
  * Try asking Saathi to submit the form.
* **What You Speak into Mic (in Hindi):**
  > *"फॉर्म सबमिट कर दो।"*
* **What Happens on Screen:**
  * Saathi highlights the submit button and replies:
    > **Saathi says:** *"सुरक्षा कारणों से सबमिट बटन आप स्वयं दबाएँ। कृपया विवरण जाँच कर सबमिट पर क्लिक करें।"*
* **What You Say (Narrator conclusion in English):**
  > *"This showcases our core safety invariant: Screen Saathi strictly refuses to automate clicks on Submit, Pay, or Delete buttons. The human remains in full control.*
  > 
  > *To summarize the architecture:*
  > * **Speech:** Powered 100% by Gnani.ai's **Prisma v3 (STT)** and **Timbre v2.5 (TTS)**.
  > * **Privacy:** Automated on-device PII masking (Aadhaar, PAN, and credentials never leave the browser).
  > * **Extension:** Built on Chrome Manifest V3 with modern WXT and React.
  > 
  > *Screen Saathi bridges India's digital divide through trusted, voice-first AI. Thank you to Gnani.ai!"*

---

## 💡 Quick Tips for a Flawless Recording
1. **Hold to Talk:** Keep the Talk button pressed while speaking, and release it as soon as you finish speaking.
2. **Clear Pronunciation:** Speak at a calm, natural pace.
3. **Instant Confirmations:** Click the green **"हाँ, भरें"** button right after Saathi proposes each field action to keep the demo snappy and dynamic.
4. **Loom Settings:** Set Loom video resolution to 1080p so text and Indian language scripts are crisp and readable.
