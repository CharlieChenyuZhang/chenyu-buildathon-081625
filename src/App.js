import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";

// Import project components
import VisualMemory from "./components/VisualMemory";
import VoiceToSlide from "./components/VoiceToSlide";
import EmployeeEngagement from "./components/EmployeeEngagement";
import CodebaseTimeMachine from "./components/CodebaseTimeMachine";
import KnowledgeGraph from "./components/KnowledgeGraph";

function Navigation() {
  const location = useLocation();
  
  const navItems = [
    { path: "/", label: "Home" },
    { path: "/visual-memory", label: "Visual Memory" },
    { path: "/voice-to-slide", label: "Voice to Slide" },
    { path: "/employee-engagement", label: "Employee Engagement" },
    { path: "/codebase-time-machine", label: "Codebase Time Machine" },
    { path: "/knowledge-graph", label: "Knowledge Graph" },
  ];

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1 className="nav-title">Buildathon Projects</h1>
        <ul className="nav-menu">
          {navItems.map((item) => (
            <li className="nav-item" key={item.path}>
              <Link 
                to={item.path} 
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/visual-memory" element={<VisualMemory />} />
            <Route path="/voice-to-slide" element={<VoiceToSlide />} />
            <Route
              path="/employee-engagement"
              element={<EmployeeEngagement />}
            />
            <Route
              path="/codebase-time-machine"
              element={<CodebaseTimeMachine />}
            />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Home() {
  return (
    <div className="home">
      <h1>Welcome to Buildathon Projects</h1>
      <p>Choose a project from the navigation menu above to get started.</p>

      <div className="projects-grid">
        <div className="project-card">
          <h3>Visual Memory Search</h3>
          <p>
            Search your screenshot history using natural language queries for
            both text content AND visual elements.
          </p>
          <Link to="/visual-memory" className="project-link">
            Open Project
          </Link>
        </div>

        <div className="project-card">
          <h3>Voice-to-Slide Generator</h3>
          <p>Generate a polished slide deck from a 3-minute spoken prompt.</p>
          <Link to="/voice-to-slide" className="project-link">
            Open Project
          </Link>
        </div>

        <div className="project-card">
          <h3>Employee Engagement Pulse</h3>
          <p>
            Provide managers with a weekly sentiment dashboard built from all
            messages in configurable Slack channels.
          </p>
          <Link to="/employee-engagement" className="project-link">
            Open Project
          </Link>
        </div>

        <div className="project-card">
          <h3>Codebase Time Machine</h3>
          <p>
            Navigate any codebase through time, understanding evolution of
            features and architectural decisions.
          </p>
          <Link to="/codebase-time-machine" className="project-link">
            Open Project
          </Link>
        </div>

        <div className="project-card">
          <h3>Universal Knowledge-Graph Builder</h3>
          <p>
            Convert a document archive into an interactive knowledge graph with
            NL Q&A.
          </p>
          <Link to="/knowledge-graph" className="project-link">
            Open Project
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
