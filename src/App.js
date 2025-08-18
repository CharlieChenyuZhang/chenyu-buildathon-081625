import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import "./App.css";

// Import project components
import VisualMemory from "./components/VisualMemory";
import VoiceToSlide from "./components/VoiceToSlide";
import EmployeeEngagement from "./components/EmployeeEngagement";
import CodebaseTimeMachine from "./components/CodebaseTimeMachine";
import InboxTriage from "./components/InboxTriage";

function Navigation() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/visual-memory", label: "Visual Memory" },
    { path: "/voice-to-slide", label: "Voice to Slide" },
    { path: "/employee-engagement", label: "Employee Engagement" },
    { path: "/codebase-time-machine", label: "Codebase Time Machine" },
    { path: "/inbox-triage", label: "Inbox Triage" },
  ];

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsMenuOpen(false);
      }
    };

    handleResize(); // Set initial state
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Handle keyboard events for accessibility
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when menu is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1 className="nav-title">Buildathon Projects</h1>

        {/* Hamburger menu button for mobile */}
        <button
          className={`hamburger ${isMenuOpen ? "active" : ""}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Backdrop overlay for mobile menu */}
        {isMenuOpen && (
          <div className="nav-backdrop" onClick={() => setIsMenuOpen(false)} />
        )}

        <ul className={`nav-menu ${isMenuOpen ? "active" : ""}`}>
          {navItems.map((item) => (
            <li className="nav-item" key={item.path}>
              <Link
                to={item.path}
                className={`nav-link ${
                  location.pathname === item.path ? "active" : ""
                }`}
                onClick={() => setIsMenuOpen(false)}
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
            <Route path="/inbox-triage" element={<InboxTriage />} />
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
          <h3>Inbox Triage Assistant</h3>
          <p>
            Cluster your last 200 emails into actionable groups and archive them
            with one click. Get your inbox organized with AI-powered email
            management.
          </p>
          <Link to="/inbox-triage" className="project-link">
            Open Project
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
