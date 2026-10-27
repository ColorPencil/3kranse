import { redirectRootLanguage } from './locale.mjs';
import './styles.css';

// Select the entry language before downloading and hydrating the full page application.
if (!redirectRootLanguage()) import('./mount.jsx');
