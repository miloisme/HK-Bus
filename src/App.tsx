import { useState } from 'react';
import { Layout } from './components/Layout';
import { RouteSearch } from './components/RouteSearch';
import { RouteDetails } from './components/RouteDetails';
import { StopETA } from './components/StopETA';
import { BookmarksView } from './components/BookmarksView';
import { StopSearch } from './components/StopSearch';
import { StopDetails } from './components/StopDetails';
import type { RouteVariant, Stop } from './lib/types';

type Tab = 'bookmarks' | 'search' | 'stop-search';

type ViewState =
  | { type: 'home' }
  | { type: 'route'; variant: RouteVariant }
  | { type: 'stop'; variant: RouteVariant; stop: Stop }
  | { type: 'stop-only'; stop: Stop };

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bookmarks');
  const [viewState, setViewState] = useState<ViewState>({ type: 'home' });

  const goHome = (tab: Tab) => {
    setActiveTab(tab);
    setViewState({ type: 'home' });
  };

  const handleBack = () => {
    if (viewState.type === 'stop') {
      setViewState({ type: 'route', variant: viewState.variant });
    } else {
      setViewState({ type: 'home' });
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={goHome}>
      {viewState.type === 'home' && (
        <>
          {activeTab === 'bookmarks' && (
            <BookmarksView
              onSelectRoute={(variant) => setViewState({ type: 'route', variant })}
              onSelectStop={(variant, stop) => setViewState({ type: 'stop', variant, stop })}
              onSelectStopOnly={(stop) => setViewState({ type: 'stop-only', stop })}
            />
          )}
          {activeTab === 'search' && (
            <RouteSearch
              onSelectRoute={(variant) => {
                setActiveTab('search');
                setViewState({ type: 'route', variant });
              }}
            />
          )}
          {activeTab === 'stop-search' && (
            <StopSearch
              onSelectStop={(stop) => {
                setActiveTab('stop-search');
                setViewState({ type: 'stop-only', stop });
              }}
            />
          )}
        </>
      )}

      {viewState.type === 'route' && (
        <RouteDetails
          variant={viewState.variant}
          onBack={handleBack}
          onSelectVariant={(variant) => setViewState({ type: 'route', variant })}
          onSelectStop={(variant, stop) => setViewState({ type: 'stop', variant, stop })}
        />
      )}

      {viewState.type === 'stop' && (
        <StopETA variant={viewState.variant} stop={viewState.stop} onBack={handleBack} />
      )}

      {viewState.type === 'stop-only' && (
        <StopDetails stop={viewState.stop} onBack={handleBack} />
      )}
    </Layout>
  );
}
