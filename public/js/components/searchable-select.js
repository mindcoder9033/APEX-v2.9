/**
 * SearchableSelect Component
 * Lightweight, zero-dependency searchable combobox with keyboard navigation,
 * grouping headers, fuzzy matching, and APEX chamfered motorsport UI.
 */

export class SearchableSelect {
  /**
   * @param {Object} config
   * @param {HTMLElement} config.container - DOM container for the select
   * @param {string} config.id - Element ID prefix
   * @param {string} config.placeholder - Placeholder text
   * @param {Array<Object>} config.options - List of options [{ value, label, group, sublabel }]
   * @param {Function} [config.onSelect] - Callback triggered when item selected
   */
  constructor({ container, id, placeholder = 'Search or select...', options = [], onSelect = null }) {
    this.container = container;
    this.id = id;
    this.placeholder = placeholder;
    this.options = options;
    this.onSelect = onSelect;
    this.selectedValue = null;
    this.selectedLabel = '';
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.filteredItems = [];

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="searchable-select" id="${this.id}-wrapper">
        <div class="select-trigger chamfer-br" id="${this.id}-trigger" tabindex="0" role="combobox" aria-expanded="false" aria-haspopup="listbox">
          <span class="select-value-text" id="${this.id}-display">${this.escapeHtml(this.placeholder)}</span>
          <span class="select-chevron">▾</span>
        </div>

        <div class="select-dropdown chamfer-br" id="${this.id}-dropdown" style="display: none;">
          <div class="select-search-box">
            <input type="text" class="select-search-input" id="${this.id}-search" placeholder="Filter..." autocomplete="off" />
          </div>
          <div class="select-options-list" id="${this.id}-list" role="listbox"></div>
        </div>
      </div>
    `;

    this.wrapper = this.container.querySelector(`#${this.id}-wrapper`);
    this.trigger = this.container.querySelector(`#${this.id}-trigger`);
    this.display = this.container.querySelector(`#${this.id}-display`);
    this.dropdown = this.container.querySelector(`#${this.id}-dropdown`);
    this.searchInput = this.container.querySelector(`#${this.id}-search`);
    this.optionsList = this.container.querySelector(`#${this.id}-list`);

    this.updateOptionsList(this.options);
  }

  bindEvents() {
    // Toggle dropdown
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
    });

    // Search filter input
    this.searchInput.addEventListener('input', () => {
      this.filter(this.searchInput.value);
    });

    // Keyboard navigation in search input
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHighlight(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredItems.length) {
          this.selectItem(this.filteredItems[this.highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        this.trigger.focus();
      }
    });

    // Global click-outside to close
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target)) {
        this.close();
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.dropdown.style.display = 'block';
    this.trigger.setAttribute('aria-expanded', 'true');
    this.trigger.classList.add('active');
    this.searchInput.value = '';
    this.filter('');
    setTimeout(() => this.searchInput.focus(), 20);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dropdown.style.display = 'none';
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.classList.remove('active');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setOptions(newOptions, defaultVal = null) {
    this.options = newOptions || [];
    this.selectedValue = null;
    this.selectedLabel = '';
    this.display.textContent = this.placeholder;
    this.display.classList.remove('has-value');

    if (defaultVal) {
      const match = this.options.find(o => o.value === defaultVal);
      if (match) {
        this.selectItem(match, false);
      }
    }
    this.updateOptionsList(this.options);
  }

  filter(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.filteredItems = [...this.options];
    } else {
      this.filteredItems = this.options.filter(opt => {
        const text = `${opt.group || ''} ${opt.label || ''} ${opt.sublabel || ''}`.toLowerCase();
        return text.includes(q);
      });
    }

    this.highlightedIndex = this.filteredItems.length > 0 ? 0 : -1;
    this.renderListItems();
  }

  updateOptionsList(options) {
    this.filteredItems = [...options];
    this.highlightedIndex = this.filteredItems.length > 0 ? 0 : -1;
    this.renderListItems();
  }

  renderListItems() {
    if (this.filteredItems.length === 0) {
      this.optionsList.innerHTML = `
        <div class="select-no-results">No matching options found</div>
      `;
      return;
    }

    // Group items if any group defined
    let html = '';
    let currentGroup = null;

    this.filteredItems.forEach((opt, idx) => {
      if (opt.group && opt.group !== currentGroup) {
        currentGroup = opt.group;
        html += `<div class="select-group-header">${this.escapeHtml(currentGroup)}</div>`;
      }

      const isSelected = opt.value === this.selectedValue;
      const isHighlighted = idx === this.highlightedIndex;
      const classes = [
        'select-option',
        isSelected ? 'selected' : '',
        isHighlighted ? 'highlighted' : ''
      ].filter(Boolean).join(' ');

      html += `
        <div class="${classes}" data-index="${idx}" role="option" aria-selected="${isSelected}">
          <div class="select-option-main">
            <span class="select-option-label">${this.escapeHtml(opt.label)}</span>
            ${opt.sublabel ? `<span class="select-option-sub">${this.escapeHtml(opt.sublabel)}</span>` : ''}
          </div>
          ${isSelected ? '<span class="select-check">✓</span>' : ''}
        </div>
      `;
    });

    this.optionsList.innerHTML = html;

    // Attach click events
    this.optionsList.querySelectorAll('.select-option').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.getAttribute('data-index'), 10);
        if (this.filteredItems[idx]) {
          this.selectItem(this.filteredItems[idx]);
        }
      });
    });

    this.scrollToHighlighted();
  }

  navigateHighlight(delta) {
    if (this.filteredItems.length === 0) return;
    this.highlightedIndex = Math.max(0, Math.min(this.filteredItems.length - 1, this.highlightedIndex + delta));
    this.renderListItems();
  }

  scrollToHighlighted() {
    const highlightedEl = this.optionsList.querySelector('.select-option.highlighted');
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  selectItem(item, triggerCallback = true) {
    if (!item) return;
    this.selectedValue = item.value;
    this.selectedLabel = item.label;
    this.display.textContent = item.label;
    this.display.classList.add('has-value');

    this.close();
    this.trigger.focus();

    if (triggerCallback && typeof this.onSelect === 'function') {
      this.onSelect(item);
    }
  }

  getValue() {
    return this.selectedValue;
  }

  getLabel() {
    return this.selectedLabel;
  }

  setValue(value, triggerCallback = true) {
    const match = this.options.find(o => o.value === value);
    if (match) {
      this.selectItem(match, triggerCallback);
    } else {
      this.selectedValue = null;
      this.selectedLabel = '';
      this.display.textContent = this.placeholder;
      this.display.classList.remove('has-value');
    }
  }

  reset() {
    this.selectedValue = null;
    this.selectedLabel = '';
    this.display.textContent = this.placeholder;
    this.display.classList.remove('has-value');
    this.close();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
