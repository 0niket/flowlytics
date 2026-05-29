export function showToast(
  message: string,
  type: 'error' | 'warning' | 'success' | 'info',
  duration: number = 5000
): void {
  // Get or create toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '200';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  // Create message span
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.className = 'toast__close';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.padding = '0';
  closeBtn.style.fontSize = '20px';
  closeBtn.style.lineHeight = '1';
  closeBtn.style.marginLeft = 'auto';
  closeBtn.style.paddingLeft = '12px';

  // Assemble toast
  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);

  // Add to container
  container.appendChild(toast);

  // Add entering animation class
  toast.classList.add('toast--entering');
  setTimeout(() => {
    toast.classList.remove('toast--entering');
  }, 300);

  // Close handler
  const closeToast = () => {
    toast.classList.add('toast--exiting');
    setTimeout(() => {
      toast.remove();
    }, 300);
  };

  // Close button handler
  closeBtn.addEventListener('click', closeToast);

  // Auto-dismiss handler
  const timeoutId = setTimeout(closeToast, duration);

  // Cancel auto-dismiss if manually closed
  toast.addEventListener('remove', () => {
    clearTimeout(timeoutId);
  });
}
