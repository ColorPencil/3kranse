import { renderToString } from 'react-dom/server';
import App, { routeInfo } from './App';
export function render(path) { return { html: renderToString(<App initialPath={path} />), route: routeInfo(path) }; }
