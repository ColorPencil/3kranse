import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
const root = document.getElementById('root');
const app = <App initialPath={window.location.pathname} />;
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
