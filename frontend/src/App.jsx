import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, MessageCircle, Search as SearchIcon, Settings } from 'lucide-react';
import { useApp } from './store/AppContext';
import LoginPage from './pages/LoginPage';
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
    <div className="flex-1 flex items-center justify-center pb-24">
      <div className="text-center">
        <SearchIcon size={40} className="text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">Search coming soon</p>
      </div>
    </div>
  );
}

export default function App() {
  const { state, actions } = useApp();
  const SCREENS = {
    discover: <DiscoverScreen />,
    chats:    <ChatsScreen />,
    search:   <SearchScreen />,
    settings: <SettingsScreen />,
  };

  // Pick the right player based on media type
  const mediaType = state.nowPlaying?.type;

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div key={state.activeTab}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex flex-col overflow-hidden">
            {SCREENS[state.activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="relative z-50 shrink-0">
        <div className="absolute inset-0 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/[0.06]" />
        <div className="relative flex items-center justify-around pb-safe pt-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = state.activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => actions.setTab(tab.key)}
                className="flex flex-col items-center gap-0.5 px-4 py-2 relative min-w-[60px]">
                {active && (
                  <motion.div layoutId="tab-bg"
                    className="absolute inset-0 bg-white/[0.06] rounded-xl"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
                )}
                <Icon size={20} className={`relative transition-colors ${active ? 'text-blue-400' : 'text-white/35'}`} />
                <span className={`text-[10px] font-medium relative transition-colors ${active ? 'text-blue-400' : 'text-white/30'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Media players — only one shows at a time */}
      <AnimatePresence>
        {mediaType === 'video'              && <VideoPlayer key="video" />}
        {mediaType === 'image'              && <ImageViewer key="image" />}
        {mediaType === 'audio'              && <AudioPlayer key="audio" />}
        {(mediaType === 'pdf' || mediaType === 'epub') && <PDFViewer key="pdf" />}
      </AnimatePresence>

      {/* Login overlay for Chats tab */}
      <AnimatePresence>
        {state.activeTab === 'chats' && !state.isLoggedIn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40">
            <LoginPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
