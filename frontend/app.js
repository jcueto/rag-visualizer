// State management
const state = {
  documents: [],
  isUploading: false
};

// DOM references
const DOM = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  rawTextInput: document.getElementById('rawTextInput'),
  rawTextTitle: document.getElementById('rawTextTitle'),
  addRawTextBtn: document.getElementById('addRawTextBtn'),
  docList: document.getElementById('docList'),
  docCount: document.getElementById('docCount'),
  ragStatus: document.getElementById('ragStatus'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  toastContainer: document.getElementById('toastContainer'),
  mobileToggle: document.getElementById('mobileToggle'),
  sidebar: document.getElementById('sidebar'),
  welcomeMessage: document.querySelector('.welcome-message')
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupMobileToggle();
  setupDropzone();
  setupRawTextInput();
  setupChatInput();
  
  // Set marked options
  marked.setOptions({
    breaks: true,
    gfm: true
  });
  
  await loadDocuments();
}

// === RESPONSIVE ===
function setupMobileToggle() {
  if (!DOM.mobileToggle) return;
  DOM.mobileToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('active');
  });
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        DOM.sidebar.classList.contains('active') && 
        !DOM.sidebar.contains(e.target) && 
        !DOM.mobileToggle.contains(e.target)) {
      DOM.sidebar.classList.remove('active');
    }
  });
}

// === DOCUMENT UPLOAD ===
function setupDropzone() {
  const { dropzone, fileInput } = DOM;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      if (!state.isUploading) dropzone.classList.add('drag-over');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove('drag-over');
    }, false);
  });
  
  dropzone.addEventListener('drop', (e) => {
    if (state.isUploading) return;
    const files = e.dataTransfer.files;
    handleFiles(files);
  }, false);
  
  dropzone.addEventListener('click', () => {
    if (!state.isUploading) fileInput.click();
  });
  
  fileInput.addEventListener('change', function() {
    handleFiles(this.files);
    // Reset input so the same file can be selected again
    this.value = '';
  });
}

function handleFiles(files) {
  if (files.length === 0) return;
  
  Array.from(files).forEach(file => {
    uploadFile(file);
  });
}

async function uploadFile(file) {
  state.isUploading = true;
  DOM.dropzone.classList.add('loading');
  DOM.dropzone.querySelector('p').textContent = 'Uploading...';
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) throw new Error('Upload failed');
    
    showToast(`Uploaded ${file.name}`, 'success');
    await loadDocuments();
  } catch (error) {
    showToast(`Failed to upload ${file.name}`, 'error');
  } finally {
    state.isUploading = false;
    DOM.dropzone.classList.remove('loading');
    DOM.dropzone.querySelector('p').textContent = 'Drop files here or tap to browse';
  }
}

function setupRawTextInput() {
  DOM.addRawTextBtn.addEventListener('click', async () => {
    const text = DOM.rawTextInput.value.trim();
    if (!text) return showToast('Please enter some text', 'warning');
    
    const title = DOM.rawTextTitle.value.trim() || 'Raw Text Snapshot';
    
    const formData = new FormData();
    formData.append('raw_text', text);
    formData.append('title', title);
    
    try {
      DOM.addRawTextBtn.disabled = true;
      DOM.addRawTextBtn.textContent = 'Adding...';
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      DOM.rawTextInput.value = '';
      DOM.rawTextTitle.value = '';
      showToast('Text added to RAG', 'success');
      await loadDocuments();
    } catch (error) {
      showToast('Failed to add text', 'error');
    } finally {
      DOM.addRawTextBtn.disabled = false;
      DOM.addRawTextBtn.textContent = 'Add to RAG';
    }
  });
}

// === DOCUMENT MANAGEMENT ===
async function loadDocuments() {
  try {
    const response = await fetch('/api/documents');
    if (!response.ok) throw new Error('Failed to load documents');
    
    const data = await response.json();
    state.documents = data.documents || [];
    
    renderDocumentList(state.documents);
    updateRagStatus();
  } catch (error) {
    console.error('Error loading docs:', error);
    showToast('Failed to load documents', 'error');
  }
}

function renderDocumentList(documents) {
  DOM.docCount.textContent = documents.length;
  DOM.docList.innerHTML = '';
  
  if (documents.length === 0) {
    DOM.docList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.85rem; text-align: center; padding: 1rem 0;">No documents yet</div>';
    return;
  }
  
  documents.forEach((doc, index) => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.style.animationDelay = `${index * 0.05}s`;
    
    card.innerHTML = `
      <div class="doc-icon">${getFileIcon(doc.type)}</div>
      <div class="doc-info">
        <div class="doc-title" title="${doc.title}">${doc.title}</div>
        <div class="doc-meta">${doc.chunks} chunks • ${formatDate(doc.created_at)}</div>
      </div>
      <button class="delete-btn" onclick="deleteDocument('${doc.id}')" title="Delete document">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    
    DOM.docList.appendChild(card);
  });
}

async function deleteDocument(docId) {
  try {
    const response = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Delete failed');
    
    showToast('Document deleted', 'success');
    await loadDocuments();
  } catch (error) {
    showToast('Failed to delete document', 'error');
  }
}

function updateRagStatus() {
  const hasDocs = state.documents.length > 0;
  const dot = DOM.ragStatus.querySelector('.status-dot');
  const text = DOM.ragStatus.querySelector('.status-text');
  
  if (hasDocs) {
    dot.classList.add('active');
    text.textContent = `RAG Active (${state.documents.length} docs)`;
  } else {
    dot.classList.remove('active');
    text.textContent = 'RAG Database Empty';
  }
}

// === CHAT ===
function setupChatInput() {
  DOM.chatInput.addEventListener('input', function() {
    autoGrowTextarea(this);
  });
  
  DOM.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  DOM.sendBtn.addEventListener('click', sendMessage);
}

function autoGrowTextarea(element) {
  element.style.height = 'auto';
  element.style.height = (element.scrollHeight) + 'px';
  if (element.value === '') {
    element.style.height = '44px';
  }
}

async function sendMessage() {
  const message = DOM.chatInput.value.trim();
  if (!message) return;
  
  // Hide welcome message if it's the first chat
  if (DOM.welcomeMessage) {
    DOM.welcomeMessage.style.display = 'none';
  }
  
  renderUserMessage(message);
  
  DOM.chatInput.value = '';
  autoGrowTextarea(DOM.chatInput);
  
  const loadingId = showTypingIndicator();
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) throw new Error('API Error');
    
    const data = await response.json();
    removeTypingIndicator(loadingId);
    renderDualResponse(data);
  } catch (error) {
    console.error('Chat error:', error);
    removeTypingIndicator(loadingId);
    showToast('Failed to get response', 'error');
  }
}

function renderUserMessage(text) {
  const bubble = document.createElement('div');
  bubble.className = 'message user-message';
  bubble.textContent = text;
  
  DOM.chatMessages.appendChild(bubble);
  scrollToBottom();
}

function renderDualResponse(data) {
  const card = document.createElement('div');
  card.className = 'message dual-response';
  
  const hasDocs = state.documents.length > 0;
  let ragContent = '';
  let sourcesContent = '';
  
  if (!hasDocs) {
    ragContent = `
      <div class="empty-rag-state">
        <span>📄</span>
        <p>Upload documents to enable RAG responses</p>
      </div>
    `;
  } else {
    // Generate RAG warning if not relevant
    const warningHtml = data.rag_response.is_relevant ? '' : `
      <div class="off-topic-warning">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>This question appears to be outside the scope of your uploaded documents. The standard response may be more helpful.</span>
      </div>
    `;
    
    // Parse markdown securely
    const parsedRag = DOMPurify.sanitize(marked.parse(data.rag_response.text || 'No response generated.'));
    
    // Generate sources
    if (data.rag_response.sources && data.rag_response.sources.length > 0) {
      const chipsHtml = data.rag_response.sources.map(src => `
        <div class="source-chip" title="${src.chunk_preview.replace(/"/g, '&quot;')}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          ${src.doc_title}
        </div>
      `).join('');
      
      sourcesContent = `
        <div class="sources-container">
          <div class="sources-title">Sources used</div>
          <div class="sources-list">${chipsHtml}</div>
        </div>
      `;
    }
    
    ragContent = `
      ${warningHtml}
      <div class="col-content">${parsedRag}</div>
      ${sourcesContent}
    `;
  }
  
  const parsedStd = DOMPurify.sanitize(marked.parse(data.standard_response.text || 'No response generated.'));
  
  card.innerHTML = `
    <div class="dual-columns">
      <div class="response-column">
        <div class="col-header std-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          Standard Knowledge
        </div>
        <div class="col-body">
          <div class="col-content">${parsedStd}</div>
        </div>
      </div>
      
      <div class="response-column">
        <div class="col-header rag-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          RAG Response
        </div>
        <div class="col-body">
          ${ragContent}
        </div>
      </div>
    </div>
  `;
  
  DOM.chatMessages.appendChild(card);
  scrollToBottom();
}

// === TYPING INDICATOR ===
function showTypingIndicator() {
  const id = 'typing-' + Date.now();
  const card = document.createElement('div');
  card.id = id;
  card.className = 'message dual-response';
  
  const typingHtml = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  
  card.innerHTML = `
    <div class="dual-columns">
      <div class="response-column">
        <div class="col-header std-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          Standard Knowledge
        </div>
        <div class="col-body">
          ${typingHtml}
        </div>
      </div>
      <div class="response-column">
        <div class="col-header rag-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          RAG Response
        </div>
        <div class="col-body">
          ${typingHtml}
        </div>
      </div>
    </div>
  `;
  
  DOM.chatMessages.appendChild(card);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const element = document.getElementById(id);
  if (element) {
    element.remove();
  }
}

// === TOAST NOTIFICATIONS ===
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '!';
  
  toast.innerHTML = `
    <div style="font-weight: bold;">${icon}</div>
    <div>${message}</div>
  `;
  
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// === UTILITIES ===
function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('pdf')) return '📄';
  if (t.includes('doc')) return '📝';
  if (t.includes('txt')) return '📃';
  if (t.includes('raw')) return '✏️';
  return '📄';
}

function scrollToBottom() {
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}
