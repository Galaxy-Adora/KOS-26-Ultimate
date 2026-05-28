/**
 * dev-hub.js — KOS Developer Hub & Integration Suite
 * =========================================================================
 * KOS Ultimate 2026 Core Component — Zero HTML Dynamic Memory UI
 */

(function () {
  'use strict';

  // ==========================================
  // §1  DOCUMENTATION DATA LAYER
  // ==========================================
  const KOS_DOCS = {
    intro: {
      title: 'Ecosystem Architecture',
      subtitle: 'Guidelines, module execution hooks, and file declarations required to integrate software seamlessly within KOS Ultimate 2026.',
      template: `
        <div class="dh-card">
          <h2>Kernel-to-App Bridge Matrix</h2>
          <p class="dh-subtitle" style="margin-bottom:12px;">
            KOS apps operate completely without explicit HTML files, dynamically generating and attaching their sandboxed UI structures inside memory spaces mapped directly by the Window Manager.
          </p>
        </div>
        <div class="dh-card" style="border-left: 4px solid var(--accent-green);">
          <h2>System Requirements & Protocol Rules</h2>
          <ul class="dh-steps">
            <li><strong>Zero HTML Files:</strong> DOM layout surfaces must be created programmatically inside Javascript scripts.</li>
            <li><strong>Asynchronous Core Promises:</strong> Storage operations must use <code>await</code> boundaries to preserve layout fluidity.</li>
          </ul>
        </div>
      `
    },
    system: {
      title: 'Manifest & Boot Configuration',
      subtitle: 'Specifications outlining how to register your software inside the primary files.',
      template: `
        <div class="dh-card">
          <h2>1. Modifying App Registry (<span class="dh-badge">kos-manifest.js</span>)</h2>
          <div class="dh-code-box">
            <button class="dh-copy-btn" onclick="KOSDevHub.copyCode(this)">Copy JSON</button>
            <pre><code>{\n  id          : 'devhub',\n  name        : 'Developer Hub',\n  iconClass   : 'icon-developer',\n  faIcon      : 'fa-code',\n  jsPath      : 'apps/dev-hub.js',\n  cssPath     : 'css/apps/dev-hub.css',\n  permissions : ['documents', 'apps'],\n  metadata    : { showInDock: true, searchable: true, isSystemApp: false },\n  initData    : {\n    bodyId: 'devhub-body'\n  }\n}</code></pre>
          </div>
        </div>
      `
    },
    fs: {
      title: 'Unified Storage Engine (KOSFS)',
      subtitle: 'Examines the cross-permission sandboxed storage system built over browser-level IndexedDB hooks.',
      template: `
        <div class="dh-card">
          <h2>System Operations Sandbox (<span class="dh-badge">kos-fs.js</span>)</h2>
          <div class="dh-code-box">
            <button class="dh-copy-btn" onclick="KOSDevHub.copyCode(this)">Copy FS Call</button>
            <pre><code>const docs = await KOSFS.getFilesByType(KOSFS.TYPES.DOCUMENT);</code></pre>
          </div>
        </div>
      `
    },
    modal: {
      title: 'Asynchronous Modals UI (KOSModal)',
      subtitle: 'Construct isolated dialog prompts that suspend foreground operation loops safely through structural script promises.',
      template: `
        <div class="dh-card">
          <h2>Dialog Triggers (<span class="dh-badge">kos-modal.js</span>)</h2>
          <div class="dh-code-box">
            <button class="dh-copy-btn" onclick="KOSDevHub.copyCode(this)">Copy Modal Layout</button>
            <pre><code>await KOSModal.alert({ \n  title: 'Build Finished', \n  message: 'System manifest mapped correctly.', \n  variant: 'success' \n });</code></pre>
          </div>
        </div>
      `
    },
    notif: {
      title: 'Persistent Notification Engine',
      subtitle: 'Feed real-time event updates into the active system-wide dropshelf control interface via background index logs.',
      template: `
        <div class="dh-card">
          <h2>Posting System Logs (<span class="dh-badge">kos-ndb.js</span>)</h2>
          <div class="dh-code-box">
            <button class="dh-copy-btn" onclick="KOSDevHub.copyCode(this)">Copy Notification Code</button>
            <pre><code>await KOSNDB.post('devhub', {\n  title: 'Workspace Connected',\n  body: 'Successfully loaded developer hub asset configurations.',\n  icon: 'fa-solid fa-code-fork'\n});</code></pre>
          </div>
        </div>
      `
    },
    trouble: {
      title: 'Troubleshooting & Viewport Audits',
      subtitle: 'An engineering retrospective outlining why new applications encounter blank white layout canvas surfaces upon boot.',
      template: `
        <div class="dh-card" style="border-left: 4px solid #ff5f56;">
          <h2>The Race Condition: Async DOM Injection</h2>
          <p class="dh-subtitle" style="margin-bottom:12px;">
            <strong>The Problem:</strong> When apps declare their layout mounts to a specific selector string like <code>#devhub-body</code> on basic DOM load triggers, the script fires before <code>kos-wm.js</code> completes constructing the corresponding physical OS window canvas wrapper elements. Consequently, the initialization fails silently and displays a blank screen.
          </p>
        </div>
        <div class="dh-card">
          <h2>The Solution: High-Frequency Lifecyle Polling</h2>
          <p class="dh-subtitle" style="margin-bottom:12px;">
            To build robust applications with zero HTML files, the bootstrapper should use an interval loop runner to constantly monitor the shell context container before launching the application's renderer engine:
          </p>
          <div class="dh-code-box">
            <button class="dh-copy-btn" onclick="KOSDevHub.copyCode(this)">Copy Lifecycle Fix</button>
            <pre><code>// Dynamic Polling Lifecycle Interceptor Block\nconst bootTimer = setInterval(() => {\n  if (document.getElementById('devhub-body')) {\n    const success = MyApp.init('devhub-body');\n    if (success) clearInterval(bootTimer);\n  }\n}, 100);</code></pre>
          </div>
        </div>
      `
    },
    git: {
      title: 'Git Version Management & PR Submissions',
      subtitle: 'Guidelines explaining how to duplicate primary codebase tracks and submit clean application extensions.',
      template: `
        <div class="dh-card">
          <a href="https://github.com/Galaxy-Adora/KOS-26-Ultimate" target="_blank" class="dh-btn-primary">Fork Code Repository Track</a>
        </div>
      `
    }
  };

  // ==========================================
  // §2  DYNAMIC UI INITIALIZATION PROTOCOLS
  // ==========================================
  const DevHubApp = {
    init: function (targetId = 'devhub-body') {
      const parent = document.getElementById(targetId);
      if (!parent) return false;
      parent.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.className = 'dh-wrapper';

      const sidebar = document.createElement('div');
      sidebar.className = 'dh-sidebar';

      const navHeader = document.createElement('div');
      navHeader.className = 'dh-sidebar-title';
      navHeader.textContent = 'Development Core';
      sidebar.appendChild(navHeader);

      const navList = document.createElement('ul');
      navList.className = 'dh-nav-list';

      const links = [
        { id: 'intro', text: 'Ecosystem Architecture', icon: 'fa-compass' },
        { id: 'system', text: 'Manifest Registration', icon: 'fa-file-code' },
        { id: 'fs', text: 'Unified Filesystem API', icon: 'fa-database' },
        { id: 'modal', text: 'Asynchronous Modals UI', icon: 'fa-window-restore' },
        { id: 'notif', text: 'Notification Engine API', icon: 'fa-bell' },
        { id: 'trouble', text: 'Troubleshooting Layouts', icon: 'fa-circle-exclamation' },
        { id: 'git', text: 'GitHub Contributions', icon: 'fa-code-fork' }
      ];

      const content = document.createElement('div');
      content.className = 'dh-content-pane';

      const hBox = document.createElement('div');
      hBox.className = 'dh-header';
      const mainTitle = document.createElement('h1');
      const subTitle = document.createElement('p');
      subTitle.className = 'dh-subtitle';
      hBox.appendChild(mainTitle);
      hBox.appendChild(subTitle);

      const activeViewSpace = document.createElement('div');
      activeViewSpace.style.display = 'flex';
      activeViewSpace.style.flexDirection = 'column';
      activeViewSpace.style.gap = '20px';

      content.appendChild(hBox);
      content.appendChild(activeViewSpace);

      function renderTab(tabId, clickedLi) {
        sidebar.querySelectorAll('.dh-nav-item').forEach(li => li.classList.remove('active'));
        clickedLi.classList.add('active');

        const section = KOS_DOCS[tabId];
        mainTitle.textContent = section.title;
        subTitle.textContent = section.subtitle;
        activeViewSpace.innerHTML = section.template;
        content.scrollTop = 0;
      }

      links.forEach((link, idx) => {
        const li = document.createElement('li');
        li.className = `dh-nav-item${idx === 0 ? ' active' : ''}`;
        li.innerHTML = `<i class="fa-solid ${link.icon}"></i> ${link.text}`;
        li.addEventListener('click', () => renderTab(link.id, li));
        navList.appendChild(li);
      });

      sidebar.appendChild(navList);
      wrapper.appendChild(sidebar);
      wrapper.appendChild(content);
      parent.appendChild(wrapper);

      renderTab('intro', navList.firstChild);
      return true;
    },

    copyCode: function (btn) {
      const code = btn.nextElementSibling?.textContent;
      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        const oldText = btn.textContent;
        btn.textContent = 'Copied! ✓';
        btn.style.background = 'var(--accent-green)';
        btn.style.color = '#fff';
        setTimeout(() => {
          btn.textContent = oldText;
          btn.style.background = '';
          btn.style.color = '';
        }, 1500);
      });
    }
  };

  window.KOSDevHub = DevHubApp;

  // SYSTEM COMPLIANCE INTERCEPTOR BLOCK
  // Polling check to render immediately when Window Manager paints the workspace layout
  const bootTimer = setInterval(() => {
    if (document.getElementById('devhub-body')) {
      const success = KOSDevHub.init('devhub-body');
      if (success) clearInterval(bootTimer);
    }
  }, 100);
})();