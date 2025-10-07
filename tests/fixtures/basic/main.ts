import './style.css'

const app = document.getElementById('app')
if (app) app.textContent = 'SRI fixture'

import('./lazy').then(({ default: message }) => {
  const note = document.createElement('p')
  note.textContent = message
  document.body.appendChild(note)
})
