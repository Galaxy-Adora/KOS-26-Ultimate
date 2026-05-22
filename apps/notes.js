'use strict';
window.KOSApps = window.KOSApps || {};

const NotesApp = {
  currentId: null,
  notes: [], // Cache for UI operations

  async init() {
    // 1. Read permissions from manifest and wait for KOSFS kernel filesystem layer
    const manifest = AppManifest.find(a => a.id === 'notes');
    KOSFS.registerApp('notes', manifest?.permissions || ['documents']);
    await KOSFS.ready;

    const body = document.getElementById('notes-body');
    if (!body) return;

    // Render an ultra-friendly layout
    body.innerHTML = `
      <div class="notes-container">
        <aside class="notes-sidebar">
          <div class="notes-sidebar-header">
            <div class="notes-actions-row">
               <button id="create-note-btn" class="liquid-btn primary-action"><i class="fa-solid fa-plus"></i> New Note</button>
               <button id="upload-note-btn" class="liquid-btn secondary-action" title="Upload text file"><i class="fa-solid fa-upload"></i></button>
               <input type="file" id="note-file-picker" accept=".txt,.md,.json,.html,.css,.js" style="display: none;">
            </div>
          </div>
          <div id="notes-list" class="notes-list"></div>
        </aside>
        
        <main class="notes-editor">
          <div class="editor-toolbar" style="display: none;" id="editor-controls">
            <div class="title-rename-container">
              <input type="text" id="active-note-title-input" class="note-title-field" placeholder="Untitled Note">
              <span class="rename-indicator"><i class="fa-solid fa-pen"></i></span>
            </div>
            <div class="toolbar-actions">
              <button id="save-note-btn" class="liquid-btn save-action">Save Changes</button>
              <button id="delete-note-btn" class="liquid-btn delete-action" title="Delete Note"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
          
          <div id="editor-placeholder" class="editor-placeholder-screen">
            <i class="fa-solid fa-file-pen placeholder-icon"></i>
            <h3>No Note Selected</h3>
            <p>Create a new note or select an existing one from the sidebar to begin editing.</p>
          </div>
          
          <textarea id="note-textarea" placeholder="Start typing your thoughts here..." style="display: none;"></textarea>
        </main>
        <div id="notes-toast" class="nt-toast">Saved to Kernel Storage</div>
      </div>
    `;

    this.bindEvents();
    await this.refreshNotesList();
    this.setupKernelListeners();
  },

  async refreshNotesList() {
    const listEl = document.getElementById('notes-list');
    
    try {
      // Fetch files from the central kernel system
      this.notes = await KOSFS.list('notes');

      if (this.notes.length === 0) {
        listEl.innerHTML = '<div class="nt-empty">No notes found. Click "New Note" to create one!</div>';
        this.closeEditor();
        return;
      }

      listEl.innerHTML = this.notes.map(file => `
        <div class="note-item ${this.currentId === file.id ? 'active' : ''}" data-id="${file.id}">
          <i class="fa-solid fa-file-lines note-icon-type"></i>
          <div class="note-item-info">
            <div class="note-item-title">${this.stripExtension(file.name)}</div>
            <div class="note-item-date">${new Date(file.date || Date.now()).toLocaleDateString()}</div>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.note-item').forEach(el => {
        el.onclick = () => this.loadNote(el.dataset.id);
      });

    } catch (err) {
      console.error("Failed to load notes from KOSFS:", err);
      listEl.innerHTML = '<div class="nt-empty error">Failed to connect to storage system.</div>';
    }
  },

  async loadNote(id) {
    try {
      // Read note plain text cleanly via KOSFS API
      const text = await KOSFS.readText('notes', id);
      const meta = this.notes.find(n => n.id === id);
      
      if (!meta) return;
      this.currentId = id;

      // Unhide UI items
      document.getElementById('editor-placeholder').style.display = 'none';
      document.getElementById('editor-controls').style.display = 'flex';
      document.getElementById('note-textarea').style.display = 'block';

      // Assign data values
      document.getElementById('note-textarea').value = text || "";
      document.getElementById('active-note-title-input').value = this.stripExtension(meta.name);

      // Highlight active state in list
      document.querySelectorAll('.note-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
      });

    } catch (err) {
      console.error("Error reading note text:", err);
      this.showToast("Error loading file content");
    }
  },

  closeEditor() {
    this.currentId = null;
    document.getElementById('editor-placeholder').style.display = 'flex';
    document.getElementById('editor-controls').style.display = 'none';
    document.getElementById('note-textarea').style.display = 'none';
  },

  bindEvents() {
    const createBtn = document.getElementById('create-note-btn');
    const uploadBtn = document.getElementById('upload-note-btn');
    const filePicker = document.getElementById('note-file-picker');
    const saveBtn = document.getElementById('save-note-btn');
    const deleteBtn = document.getElementById('delete-note-btn');
    const titleInput = document.getElementById('active-note-title-input');

    // Idiot-proof Creation Handler
    createBtn.onclick = async () => {
      const defaultName = `Note ${this.notes.length + 1}.txt`;
      try {
        const id = await KOSFS.write('notes', '', {
          name: defaultName,
          mimeType: 'text/plain',
          tags: ['note']
        });

        await this.refreshNotesList();
        await this.loadNote(id);
        titleInput.focus();
        titleInput.select(); // Highlight name instantly for fast renaming
      } catch (err) {
        console.error("Failed to write to KOSFS:", err);
      }
    };

    // External Upload Processing Trigger
    uploadBtn.onclick = () => filePicker.click();
    filePicker.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target.result;
          const id = await KOSFS.write('notes', content, {
            name: file.name,
            mimeType: file.type || 'text/plain',
            tags: ['note']
          });
          
          filePicker.value = ''; // Reset input element
          await this.refreshNotesList();
          await this.loadNote(id);
          this.showToast("Imported successfully!");
        } catch (err) {
          console.error("Failed uploading note file to kernel storage:", err);
        }
      };
      reader.readAsText(file);
    };

    // Save File Contents Action
    saveBtn.onclick = async () => {
      if (!this.currentId) return;
      await this.persistActiveNote();
    };

    // Seamless Inline Renaming Action
    titleInput.onblur = async () => {
      if (!this.currentId) return;
      await this.persistActiveNote();
    };
    titleInput.onkeydown = async (e) => {
      if (e.key === 'Enter') {
        titleInput.blur();
      }
    };

    // Direct Removal Action
    deleteBtn.onclick = async () => {
      if (!this.currentId || !confirm("Are you sure you want to delete this note?")) return;
      try {
        await KOSFS.delete('notes', this.currentId);
        this.closeEditor();
        await this.refreshNotesList();
        this.showToast("Note deleted");
      } catch (err) {
        console.error("Failed deleting node through KOSFS:", err);
      }
    };
  },

  async persistActiveNote() {
    const titleInput = document.getElementById('active-note-title-input');
    const content = document.getElementById('note-textarea').value;
    
    let updatedTitle = titleInput.value.trim() || "Untitled Note";
    if (!updatedTitle.endsWith('.txt')) updatedTitle += '.txt';

    try {
      // Due to write rules, overwrite utilizes standard delete + re-write pattern
      const oldMeta = this.notes.find(n => n.id === this.currentId);
      await KOSFS.delete('notes', this.currentId);
      
      const newId = await KOSFS.write('notes', content, {
        name: updatedTitle,
        mimeType: 'text/plain',
        tags: oldMeta?.tags || ['note']
      });

      this.currentId = newId;
      await this.refreshNotesList();
      
      // Keep structural focuses clean
      document.querySelectorAll('.note-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === newId);
      });

      this.showToast("Saved to Kernel Storage");
    } catch (err) {
      console.error("Failed persisting adjustments:", err);
      this.showToast("Error updating file system");
    }
  },

  setupKernelListeners() {
    // Inter-process communications linking back from external events
    KOSBus.on('kos:fs-write', ({ writtenBy }) => {
      if (writtenBy !== 'notes') this.refreshNotesList();
    });
    KOSBus.on('kos:fs-delete', () => this.refreshNotesList());
    KOSBus.on('kos:fs-update', () => this.refreshNotesList());
  },

  showToast(message) {
    const toast = document.getElementById('notes-toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
  },

  stripExtension(filename) {
    return filename.replace(/\.[^/.]+$/, "");
  }
};

window.KOSApps.notes = NotesApp;