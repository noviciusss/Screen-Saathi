const button = document.querySelector<HTMLButtonElement>("#request-microphone");
const permissionStatus = document.querySelector<HTMLParagraphElement>("#permission-status");

if (button === null || permissionStatus === null) {
  throw new Error("Permission page controls were not found");
}

button.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    permissionStatus.textContent = "माइक्रोफ़ोन तैयार है।";
  } catch {
    permissionStatus.textContent = "माइक्रोफ़ोन की अनुमति नहीं मिली।";
  }
});
