import React, { useEffect } from 'react';
import { CrowdFlowProvider, useCrowdFlow } from './context/CrowdFlowContext';
import Navbar from './components/Navbar';
import OverviewDashboard from './components/OverviewDashboard';
import VenueEditor from './components/VenueEditor';
import SimulationView from './components/SimulationView';
import AnalyticsView from './components/AnalyticsView';
import ScenarioComparisonView from './components/ScenarioComparisonView';
import RecommendationsView from './components/RecommendationsView';
import LiveMonitoringView from './components/LiveMonitoringView';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

function MainAppContent() {
  const { activeTab, notifications, dismissNotification } = useCrowdFlow();

  // Auto-redirect mobile browsers opening root URL directly to the mobile camera stream
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      (window.innerWidth <= 768 && 'ontouchstart' in window);
    
    const searchParams = new URLSearchParams(window.location.search);
    const forceDesktop = searchParams.get('mode') === 'desktop';
    
    if (isMobileDevice && !forceDesktop && (window.location.pathname === '/' || window.location.pathname === '')) {
      window.location.replace('/mobile-camera.html' + window.location.search);
    }
  }, []);

  return (
    <div className="cf-app-wrapper">
      <Navbar />

      <main className="cf-main-content">
        {activeTab === 'dashboard' && <OverviewDashboard />}
        {activeTab === 'layout' && <VenueEditor />}
        {activeTab === 'simulation' && <SimulationView />}
        {activeTab === 'monitoring' && <LiveMonitoringView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'comparison' && <ScenarioComparisonView />}
        {activeTab === 'recommendations' && <RecommendationsView />}
      </main>

      {/* Floating System Toasts */}
      {notifications.length > 0 && notifications[0] && (
        <div className="cf-toast-container">
          <div className={`cf-toast toast-${notifications[0].type}`}>
            {notifications[0].type === 'error' ? (
              <AlertCircle size={16} className="text-red" />
            ) : notifications[0].type === 'success' ? (
              <CheckCircle size={16} className="text-green" />
            ) : (
              <Info size={16} className="text-blue" />
            )}
            <span className="toast-msg">{notifications[0].text}</span>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => dismissNotification(notifications[0].id)}
              title="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <CrowdFlowProvider>
      <MainAppContent />
    </CrowdFlowProvider>
  );
}
