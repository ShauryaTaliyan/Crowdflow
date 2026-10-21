import assert from 'assert';
import fs from 'fs';

console.log('🧪 Verifying Chrome Themes Implementation...');

// 1. Verify index.css contains all 3 themes and default
const css = fs.readFileSync('./src/index.css', 'utf-8');

assert(css.includes(':root,'), 'Must define :root');
assert(css.includes('[data-theme="chrome-light"]'), 'Must define [data-theme="chrome-light"]');
assert(css.includes('[data-theme="chrome-dark-titanium"]'), 'Must define [data-theme="chrome-dark-titanium"]');
assert(css.includes('[data-theme="chrome-silver"]'), 'Must define [data-theme="chrome-silver"]');
console.log('✅ PASS: All 3 theme token selectors defined in index.css');

// Verify Google Chrome Minimal Light tokens
assert(css.includes('--bg-app: #f1f3f4;'), 'Chrome Light must use signature #f1f3f4');
assert(css.includes('--bg-surface: #ffffff;'), 'Chrome Light must use #ffffff cards');
assert(css.includes('--primary: #1a73e8;'), 'Chrome Light must use Google Chrome blue #1a73e8');
assert(css.includes('--border-card: #dadce0;'), 'Chrome Light must use Chrome border #dadce0');
console.log('✅ PASS: Google Chrome Minimal Light theme tokens verified');

// Verify Dark Titanium tokens
assert(css.includes('--bg-app: #080a0f;'), 'Dark Titanium must use titanium background');
assert(css.includes('--primary: #38bdf8;'), 'Dark Titanium must use cyan accent');
console.log('✅ PASS: Dark Liquid Chrome & Brushed Titanium tokens verified');

// Verify Silver Reflective tokens
assert(css.includes('--bg-app: #cfd5e1;'), 'Silver Chrome must use silver background');
assert(css.includes('--primary: #0284c7;'), 'Silver Chrome must use cobalt accent');
console.log('✅ PASS: Polished Silver & Reflective Chrome tokens verified');

// 2. Verify ThemeSwitcher component exists and is imported in Navbar
const navbar = fs.readFileSync('./src/components/Navbar.jsx', 'utf-8');
assert(navbar.includes("import ThemeSwitcher from './ThemeSwitcher';"), 'Navbar must import ThemeSwitcher');
assert(navbar.includes('<ThemeSwitcher />'), 'Navbar must render ThemeSwitcher');
console.log('✅ PASS: ThemeSwitcher integrated into Navbar');

// 3. Verify CrowdFlowContext sets default to chrome-light
const context = fs.readFileSync('./src/context/CrowdFlowContext.jsx', 'utf-8');
assert(context.includes("return 'chrome-light';"), "Context default theme must be 'chrome-light'");
assert(context.includes("CHROME_THEMES"), "Context must export CHROME_THEMES");
console.log('✅ PASS: Default theme set to chrome-light in CrowdFlowContext');

console.log('\n🎉 ALL THEME VERIFICATION TESTS PASSED!');
