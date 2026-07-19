import { Agentation } from 'agentation';

window.Agentation = Agentation;
window.dispatchEvent(new CustomEvent('agentation:loaded'));
console.log('Agentation successfully loaded and initialized');
