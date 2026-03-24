import { useState } from 'react';
import { Layout } from './components/Layout';
import { RouteSearch } from './components/RouteSearch';
import { RouteDetails } from './components/RouteDetails';
import { StopETA } from './components/StopETA';
import { BookmarksView } from './components/BookmarksView';
import { StopSearch } from './components/StopSearch';
import { StopDetails } from './components/StopDetails';
import { Route, Stop } from './lib/api';

type ViewState = 
  | { type: 'home' }
  | { type: 'route'; route: Route; initialDir?: 'inbound' | 'outbound' }
  | { type: 'stop'; route: Route; stop: Stop; dir: 'inbound' | 'outbound' }
  | { type: 'stop-only'; stop: Stop };

export default function App() {
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'search' | 'stop-search'>('bookmarks');
  const [viewState, setViewState] = useState<ViewState>({ type: 'home' });

  const handleTabChange = (tab: 'bookmarks' | 'search' | 'stop-search') => {
    setActiveTab(tab);
    setViewState({ type: 'home' });
  };

  const handleSelectRoute = (route: Route, initialDir?: 'inbound' | 'outbound') => {
    setViewState({ type: 'route', route, initialDir });
  };

  const handleSelectStop = (route: Route, stop: Stop, dir: 'inbound' | 'outbound') => {
    setViewState({ type: 'stop', route, stop, dir });
  };

  const handleSelectStopOnly = (stop: Stop) => {
    setViewState({ type: 'stop-only', stop });
  };

  const handleBack = () => {
    if (viewState.type === 'stop') {
      setViewState({ type: 'route', route: viewState.route });
    } else if (viewState.type === 'route' || viewState.type === 'stop-only') {
      setViewState({ type: 'home' });
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {viewState.type === 'home' && (
        activeTab === 'bookmarks' ? (
          <BookmarksView 
            onSelectRoute={handleSelectRoute} 
            onSelectStop={handleSelectStop} 
            onSelectStopOnly={handleSelectStopOnly}
          />
        ) : activeTab === 'search' ? (
          <RouteSearch onSelectRoute={handleSelectRoute} />
        ) : (
          <StopSearch onSelectStop={handleSelectStopOnly} />
        )
      )}

      {viewState.type === 'route' && (
        <RouteDetails 
          route={viewState.route} 
          initialDir={viewState.initialDir}
          onBack={handleBack} 
          onSelectStop={handleSelectStop} 
        />
      )}

      {viewState.type === 'stop' && (
        <StopETA 
          route={viewState.route} 
          stop={viewState.stop} 
          dir={viewState.dir} 
          onBack={handleBack} 
        />
      )}

      {viewState.type === 'stop-only' && (
        <StopDetails 
          stop={viewState.stop} 
          onBack={handleBack} 
        />
      )}
    </Layout>
  );
}
