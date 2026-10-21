import React, { useState, useRef, useEffect } from 'react';
import { useCrowdFlow } from '../context/CrowdFlowContext';
import { Sun, Moon, Sparkles, Check, ChevronDown, Palette } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme, cycleTheme, CHROME_THEMES } = useCrowdFlow();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Global hotkey: Press 'T' to cycle theme (when not typing in an input)
  useEffect(() => {
    function handleGlobalKey(e) {
      if (e.key === 't' || e.key === 'T') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
          return;
        }
        cycleTheme();
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [cycleTheme]);

  const currentThemeObj = CHROME_THEMES.find((t) => t.id === theme) || CHROME_THEMES[0];

  const getThemeIcon = (id, size = 14) => {
    switch (id) {
      case 'chrome-light':
        return <Sun size={size} className="theme-icon-light" />;
      case 'chrome-dark-titanium':
        return <Moon size={size} className="theme-icon-titanium" />;
      case 'chrome-silver':
        return <Sparkles size={size} className="theme-icon-silver" />;
      default:
        return <Palette size={size} />;
    }
  };

  return (
    <div className="theme-switcher-box" ref={dropdownRef}>
      {/* Main trigger button */}
      <button
        type="button"
        className="theme-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={`Current Theme: ${currentThemeObj.name}. Click to switch theme.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="theme-icon-wrap">
          {getThemeIcon(theme, 14)}
        </span>
        <span className="theme-current-name">{currentThemeObj.shortName}</span>
        <span className="theme-color-dot" style={{ background: currentThemeObj.accent }} />
        <ChevronDown size={12} className={`theme-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {/* Quick 1-click cycle button */}
      <button
        type="button"
        className="theme-quick-cycle-btn"
        onClick={(e) => {
          e.stopPropagation();
          cycleTheme();
        }}
        title="Quick Toggle Next Theme (Light / Titanium / Silver) — Hotkey: [T]"
      >
        <Palette size={13} />
        <span className="theme-hotkey-badge">T</span>
      </button>

      {/* Theme Selection Dropdown Menu */}
      {isOpen && (
        <div className="theme-dropdown-menu" role="listbox" aria-label="Select Chrome Theme">
          <div className="theme-dropdown-header">
            <div className="theme-dropdown-title-wrap">
              <Palette size={14} style={{ color: 'var(--primary)' }} />
              <span className="theme-dropdown-title">Chrome Background Themes</span>
            </div>
            <span className="theme-dropdown-sub">3 curated chrome aesthetics</span>
          </div>

          <div className="theme-options-list">
            {CHROME_THEMES.map((item) => {
              const isSelected = item.id === theme;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`theme-option-card ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setTheme(item.id);
                    setIsOpen(false);
                  }}
                >
                  {/* Swatch visual preview */}
                  <div
                    className="theme-preview-pill"
                    style={{
                      background: item.previewBg,
                      borderColor: item.previewBorder,
                    }}
                  >
                    <div
                      className="theme-preview-inner"
                      style={{
                        background: item.previewSurface,
                        borderColor: item.previewBorder,
                      }}
                    >
                      <span
                        className="theme-preview-dot"
                        style={{ background: item.accent }}
                      />
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div className="theme-option-info">
                    <div className="theme-option-top">
                      <span className="theme-option-name">{item.name}</span>
                      {item.id === 'chrome-light' && (
                        <span className="theme-tag-default">DEFAULT</span>
                      )}
                    </div>
                    <span className="theme-option-desc">{item.tagline}</span>
                  </div>

                  {/* Selected Checkmark */}
                  {isSelected && (
                    <div className="theme-check-icon">
                      <Check size={14} style={{ color: item.accent }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="theme-dropdown-footer">
            <span>Tip: Press <strong>[T]</strong> to quick-cycle themes. Saved across reloads.</span>
          </div>
        </div>
      )}
    </div>
  );
}
