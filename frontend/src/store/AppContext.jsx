import React, { createContext, useContext, useReducer, useCallback } from 'react';

const Ctx = createContext(null);

const init = {
  user: JSON.parse(localStorage.getItem('airbooks_user') || 'null'),
  isLoggedIn: !!localStorage.getItem('airbooks_token'),
  activeTab: 'discover',
  nowPlaying: null,         // { file, source, chatId }
  discoverChannels: [],
  userChats: [],
};

function reducer(s, a) {
  switch (a.type) {
    case 'LOGIN':
      localStorage.setItem('airbooks_token', a.token);
      localStorage.setItem('airbooks_user', JSON.stringify(a.user));
      return { ...s, isLoggedIn: true, user: a.user };
    case 'LOGOUT':
      localStorage.removeItem('airbooks_token');
      localStorage.removeItem('airbooks_user');
      return { ...s, isLoggedIn: false, user: null };
    case 'SET_TAB':         return { ...s, activeTab: a.tab };
    case 'PLAY':            return { ...s, nowPlaying: a.payload };
    case 'STOP':            return { ...s, nowPlaying: null };
    case 'SET_DISCOVER':    return { ...s, discoverChannels: a.channels };
    case 'SET_CHATS':       return { ...s, userChats: a.chats };
    default:                return s;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  const actions = {
    login:          useCallback((token, user) => dispatch({ type: 'LOGIN', token, user }), []),
    logout:         useCallback(() => dispatch({ type: 'LOGOUT' }), []),
    setTab:         useCallback((tab) => dispatch({ type: 'SET_TAB', tab }), []),
    play:           useCallback((file, source, chatId) => dispatch({ type: 'PLAY', payload: { file, source, chatId } }), []),
    stop:           useCallback(() => dispatch({ type: 'STOP' }), []),
    setDiscover:    useCallback((channels) => dispatch({ type: 'SET_DISCOVER', channels }), []),
    setChats:       useCallback((chats) => dispatch({ type: 'SET_CHATS', chats }), []),
  };
  return <Ctx.Provider value={{ state, actions }}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
