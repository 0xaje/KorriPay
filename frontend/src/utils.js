export function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");
  const toastIcon = document.getElementById("toast-icon");
  if (!toast || !toastMsg || !toastIcon) return;
  
  toastMsg.textContent = message;
  
  if (type === "success") {
    toast.className = "fixed top-20 left-1/2 -translate-x-1/2 bg-on-secondary-container text-white py-3 px-6 rounded-full font-label-md text-label-md opacity-100 transition-all duration-300 z-[200] shadow-xl flex items-center gap-2 max-w-sm";
    toastIcon.textContent = "check_circle";
  } else {
    toast.className = "fixed top-20 left-1/2 -translate-x-1/2 bg-error text-white py-3 px-6 rounded-full font-label-md text-label-md opacity-100 transition-all duration-300 z-[200] shadow-xl flex items-center gap-2 max-w-sm";
    toastIcon.textContent = "error";
  }

  // Remove pointer events so it's not blocking clicks
  toast.classList.remove("pointer-events-none");
  
  setTimeout(() => {
    toast.classList.add("opacity-0", "pointer-events-none");
    toast.classList.remove("opacity-100");
  }, 3000);
}

export function copyTextToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!");
  }).catch(err => {
    console.error("Could not copy text: ", err);
  });
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
