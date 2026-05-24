import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, MessageCircle, Search as SearchIcon, Settings } from 'lucide-react';
import { useApp } from './store/AppContext';
import LoginPage from './pages/LoginPage';
import InstallPrompt from './components/ui/InstallPrompt';
import DiscoverScreen from './components/discover/DiscoverScreen';
import ChatsScreen from './components/chats/ChatsScreen';
import SettingsScreen from './components/ui/SettingsScreen';
import VideoPlayer from './components/player/VideoPlayer';
import ImageViewer from './components/player/ImageViewer';
import AudioPlayer from './components/player/AudioPlayer';
import PDFViewer from './components/player/PDFViewer';

const TABS = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'chats',    label: 'Chats',    icon: MessageCircle },
  { key: 'search',   label: 'Search',   icon: SearchIcon },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function SearchScreen() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <SearchIcon size={28} className="text-gray-300" />
        </div>
        <p className="text-gray-400 text-sm font-medium">Search coming soon</p>
      </div>
    </div>
  );
}

export default function App() {
  const { state, actions } = useApp();
  const mediaType = state.nowPlaying?.type;

  const SCREENS = {
    discover: <DiscoverScreen />,
    chats:    <ChatsScreen />,
    search:   <SearchScreen />,
    settings: <SettingsScreen />,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f2f2f7', overflow: 'hidden' }}>
      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={state.activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {SCREENS[state.activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation - Telefin style */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        flexShrink: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = state.activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => actions.setTab(tab.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                  padding: '6px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  minWidth: '60px', borderRadius: '12px',
                  background: active ? '#e8f0ff' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={22} color={active ? '#3478f6' : '#8e8e93'} strokeWidth={active ? 2.2 : 1.8} />
                <span style={{
                  fontSize: '10px', fontWeight: active ? '600' : '500',
                  color: active ? '#3478f6' : '#8e8e93',
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Media players */}
      <AnimatePresence>
        {mediaType === 'video'                         && <VideoPlayer key="video" />}
        {mediaType === 'image'                         && <ImageViewer key="image" />}
        {mediaType === 'audio'                         && <AudioPlayer key="audio" />}
        {(mediaType === 'pdf' || mediaType === 'epub') && <PDFViewer key="pdf" />}
      </AnimatePresence>

      <InstallPrompt />

      {/* Login overlay */}
      <AnimatePresence>
        {state.activeTab === 'chats' && !state.isLoggedIn && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          >
            <LoginPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
