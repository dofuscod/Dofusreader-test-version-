import { render } from 'preact';
import { App } from './App';
import './db/database';

render(<App />, document.getElementById('app')!);
