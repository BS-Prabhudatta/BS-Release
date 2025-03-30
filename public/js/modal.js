class Modal {
    constructor() {
        this.modal = null;
        this.createModal();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'relative z-[9999] hidden';
        this.modal.setAttribute('aria-labelledby', 'modal-title');
        this.modal.setAttribute('role', 'dialog');
        this.modal.setAttribute('aria-modal', 'true');

        this.modal.innerHTML = `
            <div class="fixed inset-0 bg-gray-500/75 transition-opacity" aria-hidden="true"></div>
            <div class="fixed inset-0 z-[10000] w-screen overflow-y-auto">
                <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div class="sm:flex sm:items-start">
                                <div class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:size-10">
                                    <svg class="size-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                    </svg>
                                </div>
                                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                    <h3 class="text-base font-semibold text-gray-900" id="modal-title"></h3>
                                    <div class="mt-2">
                                        <p class="text-sm text-gray-500" id="modal-message"></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button type="button" id="modal-confirm" class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm text-white shadow-xs hover:bg-red-500 sm:ml-3 sm:w-auto"></button>
                            <button type="button" id="modal-cancel" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm text-gray-900 ring-1 shadow-xs ring-gray-300 ring-inset hover:bg-gray-50 sm:mt-0 sm:w-auto">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // Add event listeners
        this.modal.querySelector('#modal-cancel').addEventListener('click', () => this.hide());
        this.modal.querySelector('.fixed.inset-0').addEventListener('click', () => this.hide());
    }

    show(title, message, confirmText = 'Confirm', onConfirm = null) {
        this.modal.querySelector('#modal-title').textContent = title;
        this.modal.querySelector('#modal-message').textContent = message;
        this.modal.querySelector('#modal-confirm').textContent = confirmText;
        
        if (onConfirm) {
            this.modal.querySelector('#modal-confirm').onclick = () => {
                onConfirm();
                this.hide();
            };
        }

        this.modal.classList.remove('hidden');
    }

    hide() {
        this.modal.classList.add('hidden');
    }

    // Convenience methods
    alert(message, title = 'Alert') {
        return new Promise((resolve) => {
            this.show(title, message, 'OK', () => resolve());
        });
    }

    confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            this.show(title, message, 'Confirm', () => resolve(true));
            this.modal.querySelector('#modal-cancel').onclick = () => {
                resolve(false);
                this.hide();
            };
        });
    }
}

// Wait for DOM to be loaded before creating the modal instance
document.addEventListener('DOMContentLoaded', () => {
    window.modal = new Modal();
}); 