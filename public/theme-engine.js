/**
 * ThemeEngine - Système de personnalisation moderne et complet
 * Gère: thèmes prédéfinis, mode clair/sombre, fond d'écran personnalisé,
 * couleurs des cases, tâches, rappels, typographie, animations
 */

// Thèmes prédéfinis
export const PRESET_THEMES = {
  default: {
    name: 'Par défaut',
    icon: '🌙',
    description: 'Thème sombre moderne',
    background: { type: 'default', data: null },
    calendar: { bgColor: '#171b26', borderColor: '#3a4259', opacity: 95, textColor: '#cfe0ff' },
    tasks: { devoir: '#4CAF50', evaluation: '#FF9800', conge: '#2196F3', rendezvous: '#9C27B0' },
    reminders: { imminent: '#F44336', proche: '#FF9800', loin: '#2196F3' },
    ui: { accentColor: '#4dabf7', successColor: '#51cf66', warningColor: '#ffd43b', errorColor: '#ff6b6b' }
  },
  
  light: {
    name: 'Clair',
    icon: '☀️',
    description: 'Thème clair et épuré',
    background: { type: 'color', data: { color: '#f8f9fa' } },
    calendar: { bgColor: '#ffffff', borderColor: '#dee2e6', opacity: 100, textColor: '#212529' },
    tasks: { devoir: '#2b8a3e', evaluation: '#e67700', conge: '#1864ab', rendezvous: '#862e9c' },
    reminders: { imminent: '#c92a2a', proche: '#e67700', loin: '#1864ab' },
    ui: { accentColor: '#1971c2', successColor: '#2b8a3e', warningColor: '#f08c00', errorColor: '#c92a2a' }
  },
  
  ocean: {
    name: 'Océan',
    icon: '🌊',
    description: 'Thème bleu profond',
    background: { type: 'gradient', data: { start: '#0c1e3e', end: '#1a3a5c', direction: '180deg' } },
    calendar: { bgColor: '#1e3a5f', borderColor: '#2d5a87', opacity: 90, textColor: '#e7f5ff' },
    tasks: { devoir: '#40c057', evaluation: '#fab005', conge: '#339af0', rendezvous: '#be4bdb' },
    reminders: { imminent: '#fa5252', proche: '#fab005', loin: '#339af0' },
    ui: { accentColor: '#4dabf7', successColor: '#51cf66', warningColor: '#ffd43b', errorColor: '#ff6b6b' }
  },
  
  forest: {
    name: 'Forêt',
    icon: '🌲',
    description: 'Thème vert nature',
    background: { type: 'gradient', data: { start: '#0d2818', end: '#1a4731', direction: '180deg' } },
    calendar: { bgColor: '#1b4332', borderColor: '#2d6a4f', opacity: 90, textColor: '#d8f3dc' },
    tasks: { devoir: '#95d5b2', evaluation: '#f9c74f', conge: '#74c69d', rendezvous: '#b7b7a4' },
    reminders: { imminent: '#e63946', proche: '#f9c74f', loin: '#74c69d' },
    ui: { accentColor: '#74c69d', successColor: '#95d5b2', warningColor: '#f9c74f', errorColor: '#e63946' }
  },
  
  sunset: {
    name: 'Coucher de soleil',
    icon: '🌅',
    description: 'Thème chaud orange et rose',
    background: { type: 'gradient', data: { start: '#2d1b2e', end: '#5c2a2a', direction: '135deg' } },
    calendar: { bgColor: '#4a1942', borderColor: '#7b2cbf', opacity: 85, textColor: '#ffccd5' },
    tasks: { devoir: '#80ed99', evaluation: '#ff9f1c', conge: '#3a86ff', rendezvous: '#c77dff' },
    reminders: { imminent: '#e71d36', proche: '#ff9f1c', loin: '#3a86ff' },
    ui: { accentColor: '#ff6d00', successColor: '#80ed99', warningColor: '#ff9f1c', errorColor: '#e71d36' }
  },
  
  midnight: {
    name: 'Minuit',
    icon: '🌌',
    description: 'Thème très sombre avec accents violets',
    background: { type: 'gradient', data: { start: '#050508', end: '#0f0f1a', direction: '180deg' } },
    calendar: { bgColor: '#0a0a12', borderColor: '#1a1a2e', opacity: 95, textColor: '#a0a0b0' },
    tasks: { devoir: '#00d9ff', evaluation: '#ff00ff', conge: '#7b2cbf', rendezvous: '#ff006e' },
    reminders: { imminent: '#ff073a', proche: '#ff00ff', loin: '#00d9ff' },
    ui: { accentColor: '#7b2cbf', successColor: '#00d9ff', warningColor: '#ff00ff', errorColor: '#ff073a' }
  },
  
  cyberpunk: {
    name: 'Cyberpunk',
    icon: '⚡',
    description: 'Thème néon futuriste',
    background: { type: 'gradient', data: { start: '#0a0a0a', end: '#1a0a1a', direction: 'radial' } },
    calendar: { bgColor: '#0d0d0d', borderColor: '#ff00ff', opacity: 90, textColor: '#00ffff' },
    tasks: { devoir: '#00ff41', evaluation: '#ff00ff', conge: '#00ffff', rendezvous: '#ffff00' },
    reminders: { imminent: '#ff003c', proche: '#ff00ff', loin: '#00ffff' },
    ui: { accentColor: '#ff00ff', successColor: '#00ff41', warningColor: '#ffff00', errorColor: '#ff003c' }
  },
  
  custom: {
    name: 'Personnel',
    icon: '🎨',
    description: 'Votre thème personnalisé',
    background: { type: 'default', data: null },
    calendar: { bgColor: '#171b26', borderColor: '#3a4259', opacity: 95, textColor: '#cfe0ff' },
    tasks: { devoir: '#4CAF50', evaluation: '#FF9800', conge: '#2196F3', rendezvous: '#9C27B0' },
    reminders: { imminent: '#F44336', proche: '#FF9800', loin: '#2196F3' },
    ui: { accentColor: '#4dabf7', successColor: '#51cf66', warningColor: '#ffd43b', errorColor: '#ff6b6b' }
  }
};

// Configuration par défaut
const DEFAULT_CONFIG = {
  theme: 'default',
  mode: 'auto', // 'light', 'dark', 'auto'
  background: { type: 'default', data: null },
  calendar: { bgColor: '#171b26', borderColor: '#3a4259', opacity: 95, textColor: '#cfe0ff', align: 'center' },
  tasks: { devoir: '#4CAF50', evaluation: '#FF9800', conge: '#2196F3', rendezvous: '#9C27B0' },
  reminders: { imminent: '#F44336', proche: '#FF9800', loin: '#2196F3' },
  ui: { accentColor: '#4dabf7', successColor: '#51cf66', warningColor: '#ffd43b', errorColor: '#ff6b6b' },
  animations: { enabled: true, speed: 'normal' }, // 'slow', 'normal', 'fast', 'none'
  typography: { fontSize: 'medium', compactMode: false } // 'small', 'medium', 'large'
};

export class ThemeEngine {
  constructor() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.listeners = [];
    this.isInitialized = false;
    this.mediaQuery = null;
    
    // Charger depuis localStorage pour affichage immédiat
    this.loadFromLocalStorage();
    
    // Écouter les changements de préférence système
    this.setupSystemThemeListener();
  }

  setupSystemThemeListener() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (this.config.mode === 'auto') {
          this.applyTheme();
        }
      });
    }
  }

  getSystemTheme() {
    if (this.mediaQuery) {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return 'dark';
  }

  getEffectiveMode() {
    if (this.config.mode === 'auto') {
      return this.getSystemTheme();
    }
    return this.config.mode;
  }

  /**
   * Initialise le ThemeEngine avec les données utilisateur
   */
  init(userData = null) {
    if (userData?.themeConfig) {
      this.loadFromUserData(userData.themeConfig);
    } else if (userData) {
      // Migration depuis l'ancien format
      this.migrateFromOldFormat(userData);
    }
    
    this.applyTheme();
    this.saveToLocalStorage();
    this.isInitialized = true;
    console.log('🎨 ThemeEngine initialisé avec le thème:', this.config.theme);
    return this;
  }

  /**
   * Charge depuis le nouveau format themeConfig
   */
  loadFromUserData(themeConfig) {
    if (!themeConfig) return;
    
    // Fusion profonde avec les valeurs par défaut
    this.config = this.deepMerge(DEFAULT_CONFIG, themeConfig);
    
    // Si c'est un thème prédéfini, appliquer ses valeurs de base
    if (this.config.theme !== 'custom' && PRESET_THEMES[this.config.theme]) {
      const preset = PRESET_THEMES[this.config.theme];
      this.config.calendar = { ...preset.calendar };
      this.config.tasks = { ...preset.tasks };
      this.config.reminders = { ...preset.reminders };
      this.config.ui = { ...preset.ui };
    }
  }

  /**
   * Migration depuis l'ancien format
   */
  migrateFromOldFormat(userData) {
    const oldSettings = {
      theme: 'custom',
      mode: 'dark',
      background: {
        type: userData.bgType || 'default',
        data: this.reconstructOldBgData(userData)
      },
      calendar: {
        bgColor: userData.caseBgColor || DEFAULT_CONFIG.calendar.bgColor,
        borderColor: userData.caseBorderColor || DEFAULT_CONFIG.calendar.borderColor,
        opacity: userData.caseOpacity ?? DEFAULT_CONFIG.calendar.opacity,
        textColor: userData.caseTextColor || DEFAULT_CONFIG.calendar.textColor,
        align: userData.caseAlign || DEFAULT_CONFIG.calendar.align
      },
      tasks: {
        devoir: userData.devoirColor || DEFAULT_CONFIG.tasks.devoir,
        evaluation: userData.evaluationColor || DEFAULT_CONFIG.tasks.evaluation,
        conge: userData.congeColor || DEFAULT_CONFIG.tasks.conge,
        rendezvous: userData.rendezvousColor || DEFAULT_CONFIG.tasks.rendezvous
      },
      reminders: {
        imminent: userData.rappelImminentColor || DEFAULT_CONFIG.reminders.imminent,
        proche: userData.rappelProcheColor || DEFAULT_CONFIG.reminders.proche,
        loin: userData.rappelLoinColor || DEFAULT_CONFIG.reminders.loin
      },
      ui: { ...DEFAULT_CONFIG.ui },
      animations: { enabled: true, speed: 'normal' },
      typography: { fontSize: 'medium', compactMode: false }
    };
    
    this.config = oldSettings;
  }

  reconstructOldBgData(userData) {
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
   * Applique un thème prédéfini
   */
  applyPreset(themeKey) {
    if (!PRESET_THEMES[themeKey]) {
      console.warn('Thème inconnu:', themeKey);
      return false;
    }
    
    const preset = PRESET_THEMES[themeKey];
    this.config.theme = themeKey;
    this.config.background = JSON.parse(JSON.stringify(preset.background));
    this.config.calendar = { ...preset.calendar };
    this.config.tasks = { ...preset.tasks };
    this.config.reminders = { ...preset.reminders };
    this.config.ui = { ...preset.ui };
    
    this.applyTheme();
    this.notifyListeners();
    return true;
  }

  /**
   * Définit le mode (clair/sombre/auto)
   */
  setMode(mode) {
    if (!['light', 'dark', 'auto'].includes(mode)) return false;
    this.config.mode = mode;
    this.applyTheme();
    this.notifyListeners();
    return true;
  }

  /**
   * Applique tous les thèmes et styles
   */
  applyTheme() {
    const effectiveMode = this.getEffectiveMode();
    const isLight = effectiveMode === 'light';
    
    // Classe sur le document pour le mode
    document.documentElement.setAttribute('data-theme', effectiveMode);
    document.documentElement.classList.toggle('theme-light', isLight);
    document.documentElement.classList.toggle('theme-dark', !isLight);
    
    // Appliquer le fond
    this.applyBackground();
    
    // Appliquer les variables CSS
    this.applyCSSVariables();
    
    // Appliquer les animations
    this.applyAnimations();
    
    // Appliquer la typographie
    this.applyTypography();
    
    // Sauvegarder dans localStorage
    this.saveToLocalStorage();
  }

  applyBackground() {
    const body = document.body;
    if (!body) return;

    const { type, data } = this.config.background;

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
        
        // Pour les GIFs/images, utiliser 'cover' par défaut pour remplir tout l'écran
        // ou '100% 100%' pour étirer si l'option stretch est sélectionnée
        let size = data.size || 'cover';
        if (size === 'stretch') {
          size = '100% 100%';
        }
        const repeat = data.repeat || 'no-repeat';
        
        // Fallback background color to avoid white showing through
        const fallbackBg = '#0b1020';

        bgDiv.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100%;
          min-height: 100vh;
          background-color: ${fallbackBg};
          background-image: url('${data.url}');
          background-position: center;
          background-size: ${size};
          background-repeat: ${repeat};
          z-index: -999;
          pointer-events: none;
        `;

        document.body.insertBefore(bgDiv, document.body.firstChild);
        body.style.background = 'none';
        body.style.backgroundColor = 'transparent';
        break;
    }
  }

  applyCSSVariables() {
    const root = document.documentElement;
    if (!root) return;

    const { calendar, tasks, reminders, ui } = this.config;
    const opacity = calendar.opacity / 100;

    // Variables pour les cases du calendrier
    root.style.setProperty('--cal-cell-bg', this.hexToRgba(calendar.bgColor, opacity));
    root.style.setProperty('--cal-cell-border', calendar.borderColor);
    root.style.setProperty('--cal-cell-text', calendar.textColor);
    root.style.setProperty('--cal-cell-align', calendar.align || 'center');

    // Variables pour les couleurs des tâches
    root.style.setProperty('--task-devoir', tasks.devoir);
    root.style.setProperty('--task-evaluation', tasks.evaluation);
    root.style.setProperty('--task-conge', tasks.conge);
    root.style.setProperty('--task-rendezvous', tasks.rendezvous);

    // Variables pour les couleurs des rappels
    root.style.setProperty('--rappel-imminent', reminders.imminent);
    root.style.setProperty('--rappel-proche', reminders.proche);
    root.style.setProperty('--rappel-loin', reminders.loin);

    // Variables UI
    root.style.setProperty('--ui-accent', ui.accentColor);
    root.style.setProperty('--ui-success', ui.successColor);
    root.style.setProperty('--ui-warning', ui.warningColor);
    root.style.setProperty('--ui-error', ui.errorColor);

    // Variantes avec opacité
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

  applyAnimations() {
    const root = document.documentElement;
    const { animations } = this.config;
    
    const speeds = {
      none: '0s',
      slow: '0.4s',
      normal: '0.25s',
      fast: '0.15s'
    };
    
    root.style.setProperty('--anim-duration', speeds[animations.speed] || '0.25s');
    root.classList.toggle('no-animations', !animations.enabled || animations.speed === 'none');
  }

  applyTypography() {
    const root = document.documentElement;
    const { typography } = this.config;
    
    const sizes = {
      small: '13px',
      medium: '15px',
      large: '17px'
    };
    
    root.style.setProperty('--base-font-size', sizes[typography.fontSize] || '15px');
    root.classList.toggle('compact-mode', typography.compactMode);
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Met à jour une catégorie complète
   */
  updateCategory(category, values) {
    if (this.config[category]) {
      this.config[category] = { ...this.config[category], ...values };
      this.config.theme = 'custom';
      this.applyTheme();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Met à jour une valeur individuelle
   */
  updateValue(category, key, value) {
    if (this.config[category] && key in this.config[category]) {
      this.config[category][key] = value;
      this.config.theme = 'custom';
      this.applyTheme();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Met à jour le fond d'écran
   */
  updateBackground(type, data) {
    this.config.background = { type, data };
    this.config.theme = 'custom';
    this.applyBackground();
    this.notifyListeners();
  }

  /**
   * Réinitialise aux valeurs par défaut
   */
  reset() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.applyTheme();
    this.notifyListeners();
    return this;
  }

  /**
   * Convertit vers le format Firestore
   */
  toFirestoreData() {
    const data = {
      themeConfig: {
        theme: this.config.theme,
        mode: this.config.mode,
        background: this.config.background,
        calendar: this.config.calendar,
        tasks: this.config.tasks,
        reminders: this.config.reminders,
        ui: this.config.ui,
        animations: this.config.animations,
        typography: this.config.typography,
        updatedAt: new Date().toISOString()
      }
    };

    // Compatibilité ancien format
    const { type, data: bgData } = this.config.background;
    if (bgData) {
      data.bgType = type;
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

    // Compatibilité couleurs ancien format
    data.caseBgColor = this.config.calendar.bgColor;
    data.caseBorderColor = this.config.calendar.borderColor;
    data.caseOpacity = this.config.calendar.opacity;
    data.caseTextColor = this.config.calendar.textColor;
    data.caseAlign = this.config.calendar.align;
    data.devoirColor = this.config.tasks.devoir;
    data.evaluationColor = this.config.tasks.evaluation;
    data.congeColor = this.config.tasks.conge;
    data.rendezvousColor = this.config.tasks.rendezvous;
    data.rappelImminentColor = this.config.reminders.imminent;
    data.rappelProcheColor = this.config.reminders.proche;
    data.rappelLoinColor = this.config.reminders.loin;
    data.themeUpdatedAt = new Date().toISOString();

    return data;
  }

  // === LOCALSTORAGE PERSISTENCE ===
  saveToLocalStorage() {
    try {
      localStorage.setItem('themeEngineConfig', JSON.stringify(this.config));
    } catch (e) {
      console.warn('ThemeEngine: Erreur sauvegarde localStorage:', e);
    }
  }

  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('themeEngineConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = this.deepMerge(DEFAULT_CONFIG, parsed);
        this.applyTheme();
        console.log('🎨 ThemeEngine: Config restaurée depuis localStorage, thème:', this.config.theme);
      }
    } catch (e) {
      console.warn('ThemeEngine: Erreur chargement localStorage:', e);
    }
  }

  // === GETTERS ===
  getConfig() { return JSON.parse(JSON.stringify(this.config)); }
  getPresetThemes() { return PRESET_THEMES; }
  getCurrentTheme() { return this.config.theme; }
  getMode() { return this.config.mode; }
  
  // === UTILITAIRES ===
  deepMerge(target, source) {
    const output = JSON.parse(JSON.stringify(target));
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(output[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }
    return output;
  }

  onChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notifyListeners() {
    const configCopy = this.getConfig();
    this.listeners.forEach(cb => {
      try { cb(configCopy); } catch (e) { console.warn('Erreur listener ThemeEngine:', e); }
    });
  }
}

// Instance globale
export const themeEngine = new ThemeEngine();

/**
 * Fonctions utilitaires pour le formulaire
 */
export function getFormThemeConfig() {
  const bgType = document.getElementById('theme-bg-type')?.value || 'default';
  let bgData = null;

  switch (bgType) {
    case 'color':
      bgData = { color: document.getElementById('theme-solid-color')?.value || '#0b1020' };
      break;
    case 'gradient':
      bgData = {
        start: document.getElementById('theme-gradient-start')?.value || '#0b1020',
        end: document.getElementById('theme-gradient-end')?.value || '#0a0f1a',
        direction: document.getElementById('theme-gradient-direction')?.value || '180deg'
      };
      break;
    case 'image':
    case 'gif':
      bgData = {
        url: document.getElementById('theme-media-url')?.value,
        size: document.getElementById('theme-media-size')?.value || 'cover',
        repeat: document.getElementById('theme-media-repeat')?.value || 'no-repeat'
      };
      break;
  }

  return {
    background: { type: bgType, data: bgData },
    calendar: {
      bgColor: document.getElementById('theme-case-bg')?.value || '#171b26',
      borderColor: document.getElementById('theme-case-border')?.value || '#3a4259',
      opacity: parseInt(document.getElementById('theme-case-opacity')?.value || '95', 10),
      textColor: document.getElementById('theme-case-text')?.value || '#cfe0ff',
      align: document.getElementById('theme-case-align')?.value || 'center'
    },
    tasks: {
      devoir: document.getElementById('theme-devoir')?.value || '#4CAF50',
      evaluation: document.getElementById('theme-evaluation')?.value || '#FF9800',
      conge: document.getElementById('theme-conge')?.value || '#2196F3',
      rendezvous: document.getElementById('theme-rendezvous')?.value || '#9C27B0'
    },
    reminders: {
      imminent: document.getElementById('theme-rappel-imminent')?.value || '#F44336',
      proche: document.getElementById('theme-rappel-proche')?.value || '#FF9800',
      loin: document.getElementById('theme-rappel-loin')?.value || '#2196F3'
    },
    mode: document.getElementById('theme-mode')?.value || 'auto',
    animations: {
      enabled: document.getElementById('theme-anim-enabled')?.checked ?? true,
      speed: document.getElementById('theme-anim-speed')?.value || 'normal'
    },
    typography: {
      fontSize: document.getElementById('theme-font-size')?.value || 'medium',
      compactMode: document.getElementById('theme-compact')?.checked ?? false
    }
  };
}

export function loadConfigToForm(config) {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') {
        el.checked = value;
      } else {
        el.value = value;
      }
    }
  };

  // Mode
  setValue('theme-mode', config.mode);

  // Background
  const bgTypeSelect = document.getElementById('theme-bg-type');
  if (bgTypeSelect) {
    bgTypeSelect.value = config.background.type;
    bgTypeSelect.dispatchEvent(new Event('change'));
  }

  if (config.background.data) {
    const data = config.background.data;
    switch (config.background.type) {
      case 'color':
        setValue('theme-solid-color', data.color);
        setValue('theme-solid-hex', data.color);
        break;
      case 'gradient':
        setValue('theme-gradient-start', data.start);
        setValue('theme-gradient-start-hex', data.start);
        setValue('theme-gradient-end', data.end);
        setValue('theme-gradient-end-hex', data.end);
        setValue('theme-gradient-direction', data.direction);
        break;
      case 'image':
      case 'gif':
        setValue('theme-media-url', data.url);
        setValue('theme-media-size', data.size);
        setValue('theme-media-repeat', data.repeat);
        break;
    }
  }

  // Calendar
  setValue('theme-case-bg', config.calendar.bgColor);
  setValue('theme-case-hex', config.calendar.bgColor);
  setValue('theme-case-border', config.calendar.borderColor);
  setValue('theme-case-border-hex', config.calendar.borderColor);
  setValue('theme-case-opacity', config.calendar.opacity);
  setValue('theme-case-opacity-value', config.calendar.opacity + '%');
  setValue('theme-case-text', config.calendar.textColor);
  setValue('theme-case-text-hex', config.calendar.textColor);
  setValue('theme-case-align', config.calendar.align || 'center');

  // Tasks
  setValue('theme-devoir', config.tasks.devoir);
  setValue('theme-devoir-hex', config.tasks.devoir);
  setValue('theme-evaluation', config.tasks.evaluation);
  setValue('theme-evaluation-hex', config.tasks.evaluation);
  setValue('theme-conge', config.tasks.conge);
  setValue('theme-conge-hex', config.tasks.conge);
  setValue('theme-rendezvous', config.tasks.rendezvous);
  setValue('theme-rendezvous-hex', config.tasks.rendezvous);

  // Reminders
  setValue('theme-rappel-imminent', config.reminders.imminent);
  setValue('theme-rappel-imminent-hex', config.reminders.imminent);
  setValue('theme-rappel-proche', config.reminders.proche);
  setValue('theme-rappel-proche-hex', config.reminders.proche);
  setValue('theme-rappel-loin', config.reminders.loin);
  setValue('theme-rappel-loin-hex', config.reminders.loin);

  // Animations
  setValue('theme-anim-enabled', config.animations.enabled);
  setValue('theme-anim-speed', config.animations.speed);

  // Typography
  setValue('theme-font-size', config.typography.fontSize);
  setValue('theme-compact', config.typography.compactMode);
}

export function updateThemePreview() {
  const preview = document.getElementById('theme-preview');
  if (!preview) return;

  const type = document.getElementById('theme-bg-type')?.value || 'default';
  let background = '';

  switch (type) {
    case 'color':
      background = document.getElementById('theme-solid-color')?.value || '#0b1020';
      break;
    case 'gradient':
      const start = document.getElementById('theme-gradient-start')?.value || '#0b1020';
      const end = document.getElementById('theme-gradient-end')?.value || '#0a0f1a';
      const direction = document.getElementById('theme-gradient-direction')?.value || '180deg';
      if (direction === 'radial') {
        background = `radial-gradient(circle, ${start}, ${end})`;
      } else {
        background = `linear-gradient(${direction}, ${start}, ${end})`;
      }
      break;
    case 'image':
    case 'gif':
      const url = document.getElementById('theme-media-url')?.value;
      if (url) {
        let size = document.getElementById('theme-media-size')?.value || 'cover';
        const repeat = document.getElementById('theme-media-repeat')?.value || 'no-repeat';
        // Convertir 'stretch' en '100% 100%' pour l'aperçu
        if (size === 'stretch') {
          size = '100% 100%';
        }
        preview.style.background = `url("${url}")`;
        preview.style.backgroundSize = size;
        preview.style.backgroundRepeat = repeat;
        preview.style.backgroundPosition = 'center';
        return;
      }
      background = '#0b1020';
      break;
    default:
      background = `
        radial-gradient(1200px 800px at 20% -10%, rgba(30,144,255,0.15), transparent 60%),
        radial-gradient(900px 600px at 110% 10%, rgba(30,207,107,0.12), transparent 60%),
        linear-gradient(180deg,#0b1020,#0a0f1a)
      `;
  }

  preview.style.background = background;
  preview.style.backgroundSize = '';
  preview.style.backgroundRepeat = '';
  preview.style.backgroundPosition = '';
}
