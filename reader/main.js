// ZenReader - Main entry point (ES module orchestrator)
'use strict';

// Import all modules to initialise them. Each module self-registers its event
// listeners and restores its own state from storage on import.
import { setShortcutHandlers } from './toolbar.js';
import { toggleBookmarks } from './bookmarks.js';
import { toggleDarkMode } from './core.js';
import { toggleEditMode, toggleFocusMode } from './edit.js';

// Wire up keyboard shortcut handlers (toolbar dispatches Alt+key presses to
// these functions, which live in other modules).
setShortcutHandlers({
  toggleBookmarks,
  toggleDarkMode,
  toggleEditMode,
  toggleFocusMode
});

// Side-effect imports: these modules self-initialise on import.
// core.js  — article loading, rendering, appearance (already imported above for toggleDarkMode)
// export.js — PDF, Markdown, Print button handlers
// tips.js  — Tips/hints card + button handler
import './export.js';
import './tips.js';
