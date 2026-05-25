/**
 * ThemeManager - Système de personnalisation complet et modulaire
 * Gère: fond d'écran, couleurs des cases, couleurs des tâches, couleurs des rappels
 */

export class ThemeManager {
  constructor() {
    // Paramètres par défaut
    this.defaults = {
      background: { type: 'default', data: null },
      calendar: { bgColor: '#171b26', borderColor: '#3a4259', opacity: 95, textColor: '#cfe0ff' },
      tasks: { devoir: '#4CAF50', evaluation: '#FF9800', conge: '#2196F3', rendezvous: '#9C27B0' },
      reminders: { imminent: '#F44336', proche: '#FF9800', loin: '#2196F3' }
    };

    // État actuel (deep copy des defaults)
    this.settings = JSON.parse(JSON.stringify(this.defaults));
    
    // Callbacks de changement
    this.listeners = [];
    this.isInitialized = false;
  }

  /**
   * Initialise le ThemeManager avec les données utilisateur
   * @param {Object} userData - Données Firestore de l'utilisateur
   */
  init(userData = null) {
    if (userData) {
      this.loadFromUserData(userData);
    }
    this.applyAll();
    this.isInitialized = true;
    console.log('🎨 ThemeManager initialisé');
    return this;
  }

  /**
   * Charge les paramètres depuis les données Firestore
   */
  loadFromUserData(userData) {
    // Background
    if (userData.bgType) {
      this.settings.background.type = userData.bgType;
      this.settings.background.data = this.reconstructBgData(userData);
    }

    // Calendar cells
    if (userData.caseBgColor) {
      this.settings.calendar = {
        bgColor: userData.caseBgColor || this.defaults.calendar.bgColor,
        borderColor: userData.caseBorderColor || this.defaults.calendar.borderColor,
        opacity: userData.caseOpacity ?? this.defaults.calendar.opacity,
        textColor: userData.caseTextColor || this.defaults.calendar.textColor
      };
    }

    // Task colors
    if (userData.devoirColor) {
      this.settings.tasks = {
        devoir: userData.devoirColor || this.defaults.tasks.devoir,
        evaluation: userData.evaluationColor || this.defaults.tasks.evaluation,
        conge: userData.congeColor || this.defaults.tasks.conge,
        rendezvous: userData.rendezvousColor || this.defaults.tasks.rendezvous
      };
    }

    // Reminder colors
    if (userData.rappelImminentColor) {
      this.settings.reminders = {
        imminent: userData.rappelImminentColor || this.defaults.reminders.imminent,
        proche: userData.rappelProcheColor || this.defaults.reminders.proche,
        loin: userData.rappelLoinColor || this.defaults.reminders.loin
      };
    }

    return this;
  }

  /**
   * Reconstruit les données de fond depuis Firestore
   */
  reconstructBgData(userData) {
    const { bgType } = userData;
    if (!bgType || bgType === 'default') return null;

    switch (bgType) {
      case 'color':
        return { color: userData.bgColor || '#0b1020' };
      
      case 'gradient':
        return {
          start: userData.bgGradientStart || '#0b1020',
          end: userData.bgGradientEnd || '#0a0f1a',
          direction: userData.bgGradientDirection || '180deg'
        };
      
      case 'image':
      case 'gif':
        return {
          url: userData.bgImageUrl,
          size: userData.bgImageSize || 'cover',
          repeat: userData.bgImageRepeat || 'no-repeat'
        };
      
      default:
        return null;
    }
  }

  /**
   * Convertit les paramètres pour Firestore
   */
  toFirestoreData() {
    const data = {
      bgType: this.settings.background.type,
      caseBgColor: this.settings.calendar.bgColor,
      caseBorderColor: this.settings.calendar.borderColor,
      caseOpacity: this.settings.calendar.opacity,
      caseTextColor: this.settings.calendar.textColor,
      devoirColor: this.settings.tasks.devoir,
      evaluationColor: this.settings.tasks.evaluation,
      congeColor: this.settings.tasks.conge,
      rendezvousColor: this.settings.tasks.rendezvous,
      rappelImminentColor: this.settings.reminders.imminent,
      rappelProcheColor: this.settings.reminders.proche,
      rappelLoinColor: this.settings.reminders.loin,
      themeUpdatedAt: new Date().toISOString()
    };

    // Données spécifiques au type de fond
    const { type, data: bgData } = this.settings.background;
    if (bgData) {
      switch (type) {
        case 'color':
          data.bgColor = bgData.color;
          break;
        case 'gradient':
          data.bgGradientStart = bgData.start;
          data.bgGradientEnd = bgData.end;
          data.bgGradientDirection = bgData.direction;
          break;
        case 'image':
        case 'gif':
          data.bgImageUrl = bgData.url;
          data.bgImageSize = bgData.size;
          data.bgImageRepeat = bgData.repeat;
          break;
      }
    }

    return data;
  }

  /**
   * Applique tous les paramètres
   */
  applyAll() {
    this.applyBackground();
    this.applyCSSVariables();
    this.notifyListeners();
  }

  /**
   * Applique le fond d'écran
   */
  applyBackground() {
    const body = document.body;
    if (!body) return;

    const { type, data } = this.settings.background;

    // Nettoyer l'ancien fond
    const existingBg = document.getElementById('custom-bg');
    if (existingBg) existingBg.remove();

    body.removeAttribute('data-bg-type');
    body.style.cssText = '';

    if (!type || type === 'default') {
      body.style.background = '';
      return;
    }

    body.setAttribute('data-bg-type', type);

    switch (type) {
      case 'color':
        body.style.background = data?.color || '#0b1020';
        break;

      case 'gradient':
        const start = data?.start || '#0b1020';
        const end = data?.end || '#0a0f1a';
        const direction = data?.direction || '180deg';
        if (direction === 'radial') {
          body.style.background = `radial-gradient(circle, ${start}, ${end})`;
        } else {
          body.style.background = `linear-gradient(${direction}, ${start}, ${end})`;
        }
        break;

      case 'image':
      case 'gif':
        if (!data?.url) return;

        const bgDiv = document.createElement('div');
        bgDiv.id = 'custom-bg';
        const size = data.size || 'cover';
        const repeat = data.repeat || 'no-repeat';

        bgDiv.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: url('${data.url}') center / ${size} ${repeat} fixed;
          z-index: -999;
          pointer-events: none;
        `;

        document.body.insertBefore(bgDiv, document.body.firstChild);
        body.style.background = 'none';
        body.style.backgroundColor = 'transparent';
        break;
    }
  }

  /**
   * Applique les variables CSS pour les couleurs dynamiques
   */
  applyCSSVariables() {
    const root = document.documentElement;
    if (!root) return;

    const { calendar, tasks, reminders } = this.settings;
    const opacity = calendar.opacity / 100;

    // Variables pour les cases du calendrier
    root.style.setProperty('--cal-cell-bg', this.hexToRgba(calendar.bgColor, opacity));
    root.style.setProperty('--cal-cell-border', calendar.borderColor);
    root.style.setProperty('--cal-cell-text', calendar.textColor);

    // Variables pour les couleurs des tâches
    root.style.setProperty('--task-devoir', tasks.devoir);
    root.style.setProperty('--task-evaluation', tasks.evaluation);
    root.style.setProperty('--task-conge', tasks.conge);
    root.style.setProperty('--task-rendezvous', tasks.rendezvous);

    // Variables pour les couleurs des rappels
    root.style.setProperty('--rappel-imminent', reminders.imminent);
    root.style.setProperty('--rappel-proche', reminders.proche);
    root.style.setProperty('--rappel-loin', reminders.loin);

    // Variantes avec opacité pour les backgrounds
    root.style.setProperty('--task-devoir-bg', this.hexToRgba(tasks.devoir, 0.12));
    root.style.setProperty('--task-devoir-bg-light', this.hexToRgba(tasks.devoir, 0.08));
    root.style.setProperty('--task-evaluation-bg', this.hexToRgba(tasks.evaluation, 0.16));
    root.style.setProperty('--task-evaluation-bg-light', this.hexToRgba(tasks.evaluation, 0.10));
    root.style.setProperty('--task-conge-bg', this.hexToRgba(tasks.conge, 0.24));
    root.style.setProperty('--task-conge-bg-light', this.hexToRgba(tasks.conge, 0.16));
    root.style.setProperty('--task-rendezvous-bg', this.hexToRgba(tasks.rendezvous, 0.20));
    root.style.setProperty('--task-rendezvous-bg-light', this.hexToRgba(tasks.rendezvous, 0.14));
    root.style.setProperty('--rappel-imminent-bg', this.hexToRgba(reminders.imminent, 0.22));
    root.style.setProperty('--rappel-imminent-bg-light', this.hexToRgba(reminders.imminent, 0.16));
    root.style.setProperty('--rappel-proche-bg', this.hexToRgba(reminders.proche, 0.22));
    root.style.setProperty('--rappel-loin-bg', this.hexToRgba(reminders.loin, 0.22));
  }

  /**
   * Convertit une couleur hex en rgba
   */
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Met à jour une catégorie de paramètres
   */
  updateSetting(category, key, value) {
    if (this.settings[category] && key in this.settings[category]) {
      this.settings[category][key] = value;
      this.applyAll();
      return true;
    }
    return false;
  }

  /**
   * Met à jour le fond d'écran complet
   */
  updateBackground(type, data) {
    this.settings.background = { type, data };
    this.applyBackground();
    this.notifyListeners();
  }

  /**
   * Met à jour les paramètres depuis le formulaire
   */
  updateFromForm(formSettings) {
    this.settings = JSON.parse(JSON.stringify(formSettings));
    this.applyAll();
    return this;
  }

  /**
   * Réinitialise aux valeurs par défaut
   */
  resetToDefaults() {
    this.settings = JSON.parse(JSON.stringify(this.defaults));
    this.applyAll();
    return this;
  }

  /**
   * Ajoute un callback de changement
   */
  onChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * Notifie tous les listeners
   */
  notifyListeners() {
    const settingsCopy = JSON.parse(JSON.stringify(this.settings));
    this.listeners.forEach(cb => {
      try { cb(settingsCopy); } catch (e) { console.warn('Erreur listener ThemeManager:', e); }
    });
  }

  // === GETTERS ===
  getSettings() { return JSON.parse(JSON.stringify(this.settings)); }
  getBackground() { return { ...this.settings.background }; }
  getCalendar() { return { ...this.settings.calendar }; }
  getTasks() { return { ...this.settings.tasks }; }
  getReminders() { return { ...this.settings.reminders }; }
}

/**
 * Récupère les paramètres depuis le formulaire HTML
 */
export function getFormThemeSettings() {
  const bgType = document.getElementById('background-type')?.value || 'default';
  let bgData = null;

  switch (bgType) {
    case 'color':
      bgData = { color: document.getElementById('solid-color')?.value || '#0b1020' };
      break;
    case 'gradient':
      bgData = {
        start: document.getElementById('gradient-start')?.value || '#0b1020',
        end: document.getElementById('gradient-end')?.value || '#0a0f1a',
        direction: document.getElementById('gradient-direction')?.value || '180deg'
      };
      break;
    case 'image':
    case 'gif':
      bgData = {
        url: document.getElementById('media-url')?.value,
        size: document.getElementById('media-size')?.value || 'cover',
        repeat: document.getElementById('media-repeat')?.value || 'no-repeat'
      };
      break;
  }

  return {
    background: { type: bgType, data: bgData },
    calendar: {
      bgColor: document.getElementById('case-bg-color')?.value || '#171b26',
      borderColor: document.getElementById('case-border-color')?.value || '#3a4259',
      opacity: parseInt(document.getElementById('case-opacity')?.value || '95', 10),
      textColor: document.getElementById('case-text-color')?.value || '#cfe0ff'
    },
    tasks: {
      devoir: document.getElementById('devoir-color')?.value || '#4CAF50',
      evaluation: document.getElementById('evaluation-color')?.value || '#FF9800',
      conge: document.getElementById('conge-color')?.value || '#2196F3',
      rendezvous: document.getElementById('rendezvous-color')?.value || '#9C27B0'
    },
    reminders: {
      imminent: document.getElementById('rappel-imminent-color')?.value || '#F44336',
      proche: document.getElementById('rappel-proche-color')?.value || '#FF9800',
      loin: document.getElementById('rappel-loin-color')?.value || '#2196F3'
    }
  };
}

/**
 * Charge les paramètres dans le formulaire HTML
 */
export function loadThemeToForm(settings) {
  // Background type
  const bgTypeSelect = document.getElementById('background-type');
  if (bgTypeSelect) {
    bgTypeSelect.value = settings.background.type;
    // Déclencher l'affichage des bonnes options
    const event = new Event('change');
    bgTypeSelect.dispatchEvent(event);
  }

  // Background data
  if (settings.background.data) {
    const data = settings.background.data;
    switch (settings.background.type) {
      case 'color':
        const solidColor = document.getElementById('solid-color');
        const solidColorHex = document.getElementById('solid-color-hex');
        if (solidColor) solidColor.value = data.color;
        if (solidColorHex) solidColorHex.value = data.color;
        break;

      case 'gradient':
        const gradientStart = document.getElementById('gradient-start');
        const gradientStartHex = document.getElementById('gradient-start-hex');
        const gradientEnd = document.getElementById('gradient-end');
        const gradientEndHex = document.getElementById('gradient-end-hex');
        const gradientDirection = document.getElementById('gradient-direction');
        if (gradientStart) gradientStart.value = data.start;
        if (gradientStartHex) gradientStartHex.value = data.start;
        if (gradientEnd) gradientEnd.value = data.end;
        if (gradientEndHex) gradientEndHex.value = data.end;
        if (gradientDirection) gradientDirection.value = data.direction;
        break;

      case 'image':
      case 'gif':
        const mediaUrl = document.getElementById('media-url');
        const mediaSize = document.getElementById('media-size');
        const mediaRepeat = document.getElementById('media-repeat');
        if (mediaUrl && data.url) mediaUrl.value = data.url;
        if (mediaSize && data.size) mediaSize.value = data.size;
        if (mediaRepeat && data.repeat) mediaRepeat.value = data.repeat;
        break;
    }
  }

  // Calendar cells
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  setValue('case-bg-color', settings.calendar.bgColor);
  setValue('case-bg-color-hex', settings.calendar.bgColor);
  setValue('case-border-color', settings.calendar.borderColor);
  setValue('case-border-color-hex', settings.calendar.borderColor);
  setValue('case-opacity', settings.calendar.opacity);
  setValue('case-opacity-value', settings.calendar.opacity + '%');
  setValue('case-text-color', settings.calendar.textColor);
  setValue('case-text-color-hex', settings.calendar.textColor);

  // Task colors
  setValue('devoir-color', settings.tasks.devoir);
  setValue('devoir-color-hex', settings.tasks.devoir);
  setValue('evaluation-color', settings.tasks.evaluation);
  setValue('evaluation-color-hex', settings.tasks.evaluation);
  setValue('conge-color', settings.tasks.conge);
  setValue('conge-color-hex', settings.tasks.conge);
  setValue('rendezvous-color', settings.tasks.rendezvous);
  setValue('rendezvous-color-hex', settings.tasks.rendezvous);

  // Reminder colors
  setValue('rappel-imminent-color', settings.reminders.imminent);
  setValue('rappel-imminent-color-hex', settings.reminders.imminent);
  setValue('rappel-proche-color', settings.reminders.proche);
  setValue('rappel-proche-color-hex', settings.reminders.proche);
  setValue('rappel-loin-color', settings.reminders.loin);
  setValue('rappel-loin-color-hex', settings.reminders.loin);

  // Mettre à jour l'aperçu
  const preview = document.getElementById('background-preview');
  if (preview) {
    updatePreview();
  }
}

/**
 * Met à jour l'aperçu du fond
 */
export function updatePreview() {
  const preview = document.getElementById('background-preview');
  if (!preview) return;

  preview.style.background = '';
  preview.style.backgroundSize = '';
  preview.style.backgroundRepeat = '';
  preview.style.backgroundPosition = '';

  const type = document.getElementById('background-type')?.value || 'default';
  let background = '';

  switch (type) {
    case 'color':
      background = document.getElementById('solid-color')?.value || '#0b1020';
      break;

    case 'gradient':
      const start = document.getElementById('gradient-start')?.value || '#0b1020';
      const end = document.getElementById('gradient-end')?.value || '#0a0f1a';
      const direction = document.getElementById('gradient-direction')?.value || '180deg';
      if (direction === 'radial') {
        background = `radial-gradient(circle, ${start}, ${end})`;
      } else {
        background = `linear-gradient(${direction}, ${start}, ${end})`;
      }
      break;

    case 'image':
    case 'gif':
      const url = document.getElementById('media-url')?.value;
      if (url) {
        const size = document.getElementById('media-size')?.value || 'cover';
        const repeat = document.getElementById('media-repeat')?.value || 'no-repeat';
        preview.style.background = `url("${url}")`;
        preview.style.backgroundSize = size;
        preview.style.backgroundRepeat = repeat;
        preview.style.backgroundPosition = 'center';
      }
      return;

    default:
      background = `
        radial-gradient(1200px 800px at 20% -10%, rgba(30,144,255,0.15), transparent 60%),
        radial-gradient(900px 600px at 110% 10%, rgba(30,207,107,0.12), transparent 60%),
        linear-gradient(180deg,#0b1020,#0a0f1a)
      `;
  }

  preview.style.background = background;
}

/**
 * Affiche/masque les options de fond selon le type
 */
export function showBackgroundOptions(type) {
  const colorOptions = document.getElementById('color-options');
  const gradientOptions = document.getElementById('gradient-options');
  const mediaOptions = document.getElementById('media-options');

  if (colorOptions) colorOptions.style.display = 'none';
  if (gradientOptions) gradientOptions.style.display = 'none';
  if (mediaOptions) mediaOptions.style.display = 'none';

  switch (type) {
    case 'color':
      if (colorOptions) colorOptions.style.display = 'block';
      break;
    case 'gradient':
      if (gradientOptions) gradientOptions.style.display = 'block';
      break;
    case 'image':
    case 'gif':
      if (mediaOptions) mediaOptions.style.display = 'block';
      break;
  }
}

// Instance globale pour compatibilité
export const themeManager = new ThemeManager();
