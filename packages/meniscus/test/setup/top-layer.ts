/**
 * jsdom 30 has no dialog methods and no Popover API.
 * These stand-ins keep the state browsers keep (the open attribute, the close
 * event, the return value), without a top layer, focus moves or light dismiss.
 */
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (this.open) throw new DOMException('The dialog is already open.', 'InvalidStateError');
        this.setAttribute('open', '');
      },
    },
    show: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement, result?: string) {
        if (!this.open) return;
        if (result !== undefined) this.returnValue = result;
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    },
  });
  if (!('returnValue' in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, 'returnValue', { configurable: true, writable: true, value: '' });
  }
}

if (typeof HTMLElement !== 'undefined' && typeof (HTMLElement.prototype as { showPopover?: unknown }).showPopover !== 'function') {
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: {
      configurable: true,
      value(this: HTMLElement) {
        this.setAttribute('data-test-popover-open', '');
      },
    },
    hidePopover: {
      configurable: true,
      value(this: HTMLElement) {
        this.removeAttribute('data-test-popover-open');
      },
    },
  });
}

// jsdom's own stylesheet hides every [popover] (it never matches :popover-open).
// Show the ones the stand-in opened, as a browser would, so they stay accessible.
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '[popover][data-test-popover-open] { display: block !important; }';
  document.head.appendChild(style);
}
