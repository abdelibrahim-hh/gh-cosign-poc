import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { PRStatusBadge } from './components/PRStatusBadge'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [prNumber, setPrNumber] = useState(1)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Co-Signer Dashboard</h1>
      <div className="card">
        <div style={{ marginBottom: "1em" }}>
          <label htmlFor="pr-input" style={{ marginRight: "8px" }}>PR #</label>
          <input
            id="pr-input"
            type="number"
            min={1}
            value={prNumber}
            onChange={(e) => setPrNumber(parseInt(e.target.value, 10) || 1)}
            style={{ width: "80px", padding: "4px 8px" }}
          />
        </div>
        <PRStatusBadge
          owner="abdelibrahim-hh"
          repo="gh-cosign-poc"
          prNumber={prNumber}
        />
      </div>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
